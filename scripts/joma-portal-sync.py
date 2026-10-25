"""Sync our folder trees and folder product lists to the Joma B2B portal crawl.
Usage: npx tsx scripts/joma-our-tree.ts /tmp/ours.json   (raw tree, JOMA_PORTAL_RAW=1)
       python3 scripts/joma-portal-sync.py <folder_tiles.json> <folder_products.jsonl> /tmp/ours.json <outdir>
Writes data/joma-portal-structure.json (order, labels, images, landing kept, added, removed),
data/joma-portal-order.json (key -> portal codes mapped to our SKUs, portal order),
updates data/folder-collection-order.json and writes a report to <outdir>/sync_report.json."""
import json,re,unicodedata,html,collections,sys,os,hashlib,difflib
TILES,PRODS,OURS,OUT=sys.argv[1:5]
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.argv=[sys.argv[0]]
src=open(os.path.join(ROOT,'scripts/joma-structure-diff.py')).read()
import re as _re
ns={'re':re,'unicodedata':unicodedata,'__file__':os.path.join(ROOT,'scripts/joma-structure-diff.py')}
exec(src[src.index('ALIASES='):src.index('JUNK=')],ns); exec(src[src.index('JUNK='):src.index('rows=json.load')],ns)
norm=ns['norm']; JUNK=ns['JUNK']
# ---- portal tree: children order from tiles, plus folders seen in product lists
kids=collections.OrderedDict(); label_of={}; img={}
def addchild(pk,l):
    lst=kids.setdefault(pk,[])
    if norm(l) not in [norm(x) for x in lst]: lst.append(l)
for r in json.load(open(TILES)):
    p=html.unescape(r['path']); l=html.unescape(r['label']).strip()
    # tile captions carry a status after '|' (N.O.S / CONTINUITY, AVAILABLE UNTIL 2028, ...): not part of the name
    if not l.endswith('.jpg'): l=l.split('|')[0].strip()
    if JUNK.search(l): continue
    parts=p.split(' > ')
    parent=parts[:-1] if norm(parts[-1])==norm(l) else parts
    if parent and norm(parent[-1])==norm(l): continue
    pk=tuple(norm(x) for x in parent); addchild(pk,l)
    u=r.get('image_url','')
    if u.startswith('http') and 'no-image' not in u: img.setdefault(pk+(norm(l),),u)
# Some product lists are stored under the Spanish name while the portal page shows the English
# tile (e.g. 12-14 boy > Pants shows SHORTS, its list is 'Pantalón corto'). Same folder: use the tile.
ALIAS={('home > children > 12-14 year old boy > pants','pantalón corto'):'SHORTS',
       ('home > children > 12-14 year old boy > pants','pantalón largo'):'LONG TROUSERS',
       ('home > children > 12-14 year old boy > pants','pantalón largo cotton'):'COTTON LONG TROUSERS',
       ('home > children > 12-14 year old girl > teamwear > football & futsal > accessories','balones'):'Balls',
       ('home > children > 12-14 year old girl > teamwear > portress','guantes'):'Gloves',
       ('home > children > 12-14 year old girl > teamwear > portress','accesorios'):'Accessories'}
pcodes={}
for line in open(PRODS):
    r=json.loads(line); parts=html.unescape(r['path']).split(' > ')
    for i in range(1,len(parts)):
        a=ALIAS.get((' > '.join(parts[:i]).lower(),parts[i].lower()))
        if a: parts[i]=a
    for i in range(2,len(parts)): addchild(tuple(norm(x) for x in parts[:i]),parts[i])
    pcodes[tuple(norm(x) for x in parts)]=r['codes']
# ---- our catalog codes
cat=json.load(open(os.path.join(ROOT,'data/products.json')))
ourcodes={p['code'] for p in cat}
LIVE={x['code'] for x in json.load(open(os.path.join(ROOT,'public/listing-index.json')))}
base_pack=collections.defaultdict(list)
for c in ourcodes:
    m=re.match(r'^(.*)\.P\d+$',c)
    if m: base_pack[m.group(1)].append(c)
    if c.endswith('V'): base_pack[c[:-1]].append(c)
stats=collections.Counter(); unmatched_codes=set()
def mapcode(c):
    if c in ourcodes: stats['exact']+=1; return [c]
    if c in base_pack: stats['pack_variant']+=1; return sorted(base_pack[c])
    stats['none']+=1; unmatched_codes.add(c); return []
# ---- pair ours with portal
ours=json.load(open(OURS))
DOUBT={x.split(' ')[0].split(':',1)[1] for x in json.load(open(os.path.join(ROOT,'data/joma-tile-unmatched.json')))['unmatched'] if x.startswith('folder:')}
# our Spanish folder names whose portal folder carries the English name
SAME={norm('Portero'):[norm('Goalkeeper'),norm('Portress')],norm('Basicos'):[norm('Racket basics')]}
def close(a,b):
    if sorted(a.split())==sorted(b.split()): return True
    return difflib.SequenceMatcher(None,norm(a),norm(b)).ratio()>=0.88
# Our Footwear root is the men's sport list (Woman reuses it minus a few); on the portal that is Footwear > MAN.
ROOTS=[('Man',['Home','Man']),('Woman',['Home','Woman']),('Children',['Home','Children']),('Footwear',['Home','Footwear','MAN']),('FootwearWoman',['Home','Footwear','WOMAN']),
('FootwearJunior',['Home','Footwear','Junior']),('Accessories',['Home','Accessories']),('Outlet',['Home','Outlet']),('OfficialKits',['Home','Official Kits'])]
path_key={}; paired=set(); seen_keys=set(); order={}; labels={}; images={}; added=collections.defaultdict(list); added_by=collections.defaultdict(dict)
newfolders=[]; extra_nodes={}
def newkey(ppath): return 'jp-'+hashlib.md5(' > '.join(ppath).encode()).hexdigest()[:10]
_hd={}
def has_data(pk):
    if pk not in _hd: _hd[pk]=pk in pcodes or any(has_data(pk+(norm(c),)) for c in kids.get(pk,[]))
    return _hd[pk]
skipped_empty=[]
def build_new(ppath,parent_key):
    """Create a new folder for portal path ppath (and its portal subtree). Folders with no
    product list anywhere below are not created (they would be empty); they are reported."""
    pk=tuple(norm(x) for x in ppath); key=newkey(ppath)
    if not has_data(pk): skipped_empty.append(' > '.join(ppath[1:])); return None
    node={'key':key,'label':ns['display_label'](ppath[-1]),'children':[]}
    path_key[pk]=key; newfolders.append((' > '.join(ppath[1:]),key))
    u=img.get(pk)
    if u: images[key]=u
    for c in kids.get(pk,[]):
        ch=build_new(ppath+[c],key)
        if ch: node['children'].append(ch)
    return node
def walk(nodes,ppath,pkey):
    pk=tuple(norm(x) for x in ppath)
    for n in nodes: seen_keys.add(n['key'])
    portal=kids.get(pk)
    if portal is None:
        return
    pn=[norm(x) for x in portal]; pairs={}; used=set()
    for n in nodes:
        k=norm(n['label']); k=next((a for a in SAME.get(k,[]) if a in pn),k)
        if k in pn and pn.index(k) not in used: pairs[n['key']]=pn.index(k); used.add(pn.index(k))
    for n in nodes:
        if n['key'] in pairs or n['key'] in DOUBT: continue
        for i,l in enumerate(portal):
            if i not in used and close(n['label'].lower(),l.lower()): pairs[n['key']]=i; used.add(i); break
    slot={}
    for n in nodes:
        if n['key'] in pairs:
            i=pairs[n['key']]; pl=portal[i]; slot[i]=n['key']; paired.add(n['key'])
            path_key[pk+(pn[i],)]=n['key']
            if pl.strip().lower()!=n['label'].strip().lower(): labels[n['key']]=ns['display_label'](pl)
            u=img.get(pk+(pn[i],))
            if u: images[n['key']]=u
            walk(n['children'],ppath+[pl],n['key'])
        else:
            extra_nodes[n['key']]=(n,' > '.join(ppath[1:]+[n['label']]))
    for i,l in enumerate(portal):
        if i in slot: continue
        prev=added_by[pkey].get(norm(l))
        if prev: slot[i]=prev; path_key[pk+(pn[i],)]=prev; continue
        node=build_new(ppath+[l],pkey)
        if not node: continue
        added[pkey].append(node); added_by[pkey][norm(l)]=node['key']; slot[i]=node['key']
    keys=[slot[i] for i in sorted(slot)]
    prev=order.get(pkey)
    order[pkey]=keys+[k for k in (prev or []) if k not in keys]+[n['key'] for n in nodes if n['key'] not in keys and n['key'] not in (prev or [])]
for name,pp in ROOTS: walk(ours[name],pp,'root:'+name)
# Portal Footwear > Outlet sits beside MAN/WOMAN/JUNIOR; ours is the Outlet folder in the footwear list.
path_key[tuple(norm(x) for x in ['Home','Footwear','Outlet'])]='footwear-outlet'; paired.add('footwear-outlet'); extra_nodes.pop('footwear-outlet',None)
# ---- product lists
direct=json.load(open(os.path.join(ROOT,'data/folder-collection-order.json')))
portal_order={}; nodata=[]; total=0; unplaced=[]
for pk,codes in pcodes.items():
    key=path_key.get(pk)
    if not key: stats['portal_path_unplaced']+=1; unplaced.append(' > '.join(pk)); continue
    out=[]
    for c in codes:
        total+=1
        for m in mapcode(c):
            if m not in out: out.append(m)
    portal_order[key]=out
# leaves (no children) that have no portal product list
def leaves_of(pk,key,label):
    ch=kids.get(pk)
    if not ch:
        if pk not in pcodes: nodata.append(' > '.join(label))
        return
    for c in ch: leaves_of(pk+(norm(c),),None,label+[c])
for name,pp in ROOTS:
    for c in kids.get(tuple(norm(x) for x in pp),[]): leaves_of(tuple(norm(x) for x in pp)+(norm(c),),None,pp[1:]+[c])
nodata=sorted(set(nodata))
# Products with no portal list placed into a portal folder by scripts/joma-place-orphans.py
# (sibling colour, same model or club). They go after the portal's own products.
PLACE=os.path.join(ROOT,'data/joma-portal-placements.json')
placed=json.load(open(PLACE)) if os.path.exists(PLACE) else {}
for code,keys in placed.items():
    for key in keys:
        lst=portal_order.setdefault(key,list(direct.get(key,[])))
        if code not in lst: lst.append(code)
# membership: portal list replaces ours for every folder that has one
new_direct=dict(direct)
for key,codes in portal_order.items(): new_direct[key]=codes
# ---- extras: remove if every product is covered by portal folders
portal_all={c for v in portal_order.values() for c in v}
extra_only={k:v for k,v in extra_nodes.items() if k not in paired}
def subtree_codes(n):
    s=set(direct.get(n['key'],[]))
    for c in n['children']: s|=subtree_codes(c)
    return s
removed=[]; kept=[]
# Duplicate tiles merged into the portal folder (all products are socks; portal SOCKS page was not crawled).
MERGE={'acc-socks':'acc-medias'}
for src,dst in MERGE.items():
    if src in extra_only:
        tgt=new_direct.setdefault(dst,[])
        for c in direct.get(src,[]):
            if c not in tgt: tgt.append(c)
        removed.append(src); extra_only.pop(src)
for k,(n,where) in extra_only.items():
    # only live products count: hidden / sold-out ones have nowhere to show anyway
    cs=subtree_codes(n); live=[c for c in cs if c in LIVE]
    unc=[c for c in live if c not in portal_all]
    if not unc: removed.append(k)
    else: kept.append({'key':k,'where':where,'products':len(live),'not_in_portal':len(unc),'sample':sorted(unc)[:8]})
for k in removed: new_direct.pop(k,None)
def drop(n):
    for c in n['children']: new_direct.pop(c['key'],None); drop(c)
for k in removed: drop(extra_nodes[k][0])
old=json.load(open(os.path.join(ROOT,'data/joma-portal-structure.json')))
S={'order':order,'labels':labels,'images':dict(sorted(images.items())),'landing':old.get('landing',{}),'added':added,'removed':removed}
json.dump(S,open(os.path.join(ROOT,'data/joma-portal-structure.json'),'w'),indent=1,ensure_ascii=False)
json.dump(portal_order,open(os.path.join(ROOT,'data/joma-portal-order.json'),'w'))
json.dump(new_direct,open(os.path.join(ROOT,'data/folder-collection-order.json'),'w'),indent=1)
uniq=set(c for v in pcodes.values() for c in v)
rep={'stats':dict(stats),'unique_portal_codes':len(uniq),'unique_exact':len(uniq&ourcodes),
 'unique_pack_variant':len({c for c in uniq if c not in ourcodes and c in base_pack}),'unmatched_codes':sorted(unmatched_codes),
 'added_folders':len(newfolders),'added':newfolders,'removed_extras':removed,'unplaced_lists':unplaced,'kept_extras':kept,'leaves_without_product_data':nodata,'not_created_no_data':skipped_empty,
 'portal_folders_with_lists':len(pcodes),'mapped_lists':len(portal_order)}
json.dump(rep,open(os.path.join(OUT,'sync_report.json'),'w'),indent=1,ensure_ascii=False)
for k in ['stats','unique_portal_codes','unique_exact','unique_pack_variant','added_folders','portal_folders_with_lists','mapped_lists']: print(k,rep[k])
print('not created (no data)',len(skipped_empty));print('removed',len(removed),'kept',len(kept),'nodata leaves',len(nodata),'unmatched codes',len(unmatched_codes))
