"""Structural diff of our folder trees vs the Joma B2B portal crawl.
Usage: npx tsx scripts/joma-our-tree.ts /tmp/ours.json &&
       python3 scripts/joma-structure-diff.py /workspace/joma_net/folder_tiles.json /tmp/ours.json [report.md]
Writes data/joma-portal-structure.json (order, labels, landing, images) and a markdown report."""
import json,re,unicodedata,html,collections,sys,os
TILES=sys.argv[1] if len(sys.argv)>1 else TILES
OURS=sys.argv[2] if len(sys.argv)>2 else '/tmp/ours.json'
REPORT=sys.argv[3] if len(sys.argv)>3 else None
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ALIASES={"training polyester":"polyester","training cotton":"cotton","portero":"goalie","entrenador":"coach","arbitro":"referee","árbitro":"referee",
"12 - 14 years boy":"12-14 year old boy","12 - 14 years girl":"12-14 year old girl","1 - 4 years":"1-4 years","6 - 10 years":"6-10 years",
"men":"man","women":"woman","kids":"junior","gloves portero":"goalkeeper gloves","medias":"socks","accessories teamwear":"teamwear accessories",
"accessories running":"running accessories","accessories of racket":"racket accessories","accessories outdoor":"outdoor accessories",
"accessories fitness / gym":"fitness / gym accessories","accessories tiendas":"accessories stores","teamwear catalogue":"teamwear catalogue 2025",
"athletes / combat":"atheletes / combat","cycling":"cycling / triathlon","running / trailrunning":"running / trail","flow":"joma flow",
"intimi":"intimate","confort":"comfort","sandals confort":"comfort sandals","chubasqueros/windbreakers":"raincoats/windbreakers","chubasqueros":"raincoats",
"anoracks/jackets":"anoraks/jackets","básicos":"basics","basicos":"basics","pants corto":"shorts","pants cortos":"shorts","pants largo":"long pants",
"pants largos":"long pants","portera":"goalie","football / futsal":"soccer / futsal","football/futsal":"soccer / futsal","football":"soccer",
"colegial":"schoolboy","kansas set (reversible)":"kansas set","outwear":"outerwear","teamwer collections":"teamwear collections","skirts & pants":"skirts & trousers",
"federations and committees":"committees and federations"}
def norm(v):
    v=ALIASES.get(v.strip().lower(),v)
    v=unicodedata.normalize('NFD',v); v=''.join(c for c in v if unicodedata.category(c)!='Mn').lower()
    v=v.replace('&',' and '); v=re.sub(r'\b(the|and|y)\b',' ',v)
    v=re.sub(r'[^a-z0-9]+',' ',v).strip()
    return ''.join(w[:-1] if w.endswith('s') else w for w in v.split())
JUNK=re.compile(r'available until|n\.o\.s|last season|special offers|^\d{8}_|\.(jpg|png)$|\|',re.I)
rows=json.load(open(TILES))
kids=collections.OrderedDict(); img={}
for r in rows:
    p=html.unescape(r['path']); l=html.unescape(r['label']).strip()
    if JUNK.search(l): continue
    parts=p.split(' > ')
    parent=parts[:-1] if norm(parts[-1])==norm(l) else parts
    if parent and norm(parent[-1])==norm(l): continue
    pk=tuple(norm(x) for x in parent)
    lst=kids.setdefault(pk,[])
    if norm(l) not in [norm(x) for x in lst]: lst.append(l)
    u=r.get('image_url','')
    if u.startswith('http') and 'no-image' not in u: img.setdefault(pk+(norm(l),),u)
ours=json.load(open(OURS))
ourimg=json.load(open(os.path.join(ROOT,'data/joma-tile-images.json')))
ROOTS=[('Man',['Home','Man']),('Woman',['Home','Woman']),('Children',['Home','Children']),('Footwear',['Home','Footwear']),
('FootwearJunior',['Home','Footwear','Junior']),('Accessories',['Home','Accessories']),('Outlet',['Home','Outlet']),('OfficialKits',['Home','Official Kits'])]
import difflib
DOUBT={x.split(' ')[0].split(':',1)[1] for x in json.load(open(os.path.join(ROOT,'data/joma-tile-unmatched.json')))['unmatched'] if x.startswith('folder:')}
def close(a,b):
    if sorted(a.split())==sorted(b.split()): return True
    return difflib.SequenceMatcher(None,norm(a),norm(b)).ratio()>=0.88
rep=collections.defaultdict(list); order_fix={}; label_fix={}; struct_img={}
def walk(nodes,ppath,our_path,pkey):
    pk=tuple(norm(x) for x in ppath)
    portal=kids.get(pk)
    if portal is None:
        rep['no_portal_page'].append(' > '.join(our_path) or '/'); return
    pn=[norm(x) for x in portal]
    matched=[]; used=set()
    pairs={}
    for n in nodes:
        k=norm(n['label'])
        if k in pn: pairs[n['key']]=pn.index(k); used.add(pn.index(k))
    for n in nodes:
        if n['key'] in pairs or n['key'] in DOUBT: continue
        for i,l in enumerate(portal):
            if i not in used and close(n['label'].lower(),l.lower()):
                pairs[n['key']]=i; used.add(i); rep['fuzzy_pairs'].append(f"{n['label']} ~ {l}"); break
    for n in nodes:
        k=norm(n['label'])
        if n['key'] in pairs:
            i=pairs[n['key']]; matched.append((i,n)); k=pn[i]
            pl=portal[i]
            if pl.strip().lower()!=n['label'].strip().lower(): rep['name_diff'].append(f"{' > '.join(our_path+[n['label']])} -> portal '{pl}'"); label_fix[n['key']]=pl
            pimg=img.get(pk+(k,))
            if pimg:
                struct_img[n['key']]=pimg
                if ourimg.get(f"folder:{n['key']}") is None: rep['wrong_image'].append(' > '.join(our_path+[n['label']]))
            walk(n['children'],ppath+[pl],our_path+[n['label']],n['key'])
        else:
            rep['extra'].append(f"{n['key']} ({' > '.join(our_path+[n['label']])})")
    for i,l in enumerate(portal):
        if i not in used: rep['missing'].append(' > '.join(ppath[1:]+[l]))
    seq=[i for i,_ in matched]
    if seq!=sorted(seq):
        rep['wrong_order'].append(' > '.join(our_path) or '(root)')
    if seq!=sorted(seq):
        order_fix[pkey]=[n['key'] for _,n in sorted(matched,key=lambda x:x[0])]+[n['key'] for n in nodes if n['key'] not in pairs]
for name,pp in ROOTS:
    walk(ours[name],pp,[name],'root:'+name)
FIX={'order':order_fix,'labels':label_fix,'images':struct_img}
for k in ['fuzzy_pairs','missing','extra','wrong_order','name_diff','wrong_image','no_portal_page']: print(k,len(rep[k]))
# landing tiles vs portal root children
LP={'men':('Man',['Home','Man']),'women':('Woman',['Home','Woman']),'kids':('Children',['Home','Children']),'footwear':('Footwear',['Home','Footwear']),
'accessories':('Accessories',['Home','Accessories']),'outlet':('Outlet',['Home','Outlet']),'official-kits':('OfficialKits',['Home','Official Kits']),'teams':('Teams',['Home','Man','Teamwear'])}
landing={}
for page,(name,pp) in LP.items():
    portal=kids.get(tuple(norm(x) for x in pp),[]); pn=[norm(x) for x in portal]
    rows=[]
    for lab in ours['landing'][name]:
        k=norm(lab)
        if k in pn:
            i=pn.index(k); rows.append((i,lab,portal[i]))
            if portal[i]!=lab and portal[i].lower()!=lab.lower(): rep['landing_name_diff'].append(f"{page}: {lab} -> {portal[i]}")
        else: rows.append((999,lab,None)); rep['landing_extra'].append(f"{page}: {lab}")
    seq=[r[0] for r in rows if r[0]<999]
    if seq!=sorted(seq): rep['landing_wrong_order'].append(page)
    landing[page]={'order':[r[1] for r in sorted(rows,key=lambda r:r[0])],'labels':{r[1]:r[2] for r in rows if r[2] and r[2].lower()!=r[1].lower()}}
FIX['landing']=landing
FIX['images']={k:v for k,v in sorted(FIX['images'].items())}
json.dump(FIX,open(os.path.join(ROOT,'data/joma-portal-structure.json'),'w'),indent=1,ensure_ascii=False)
if REPORT:
    keys=['missing','extra','wrong_order','name_diff','wrong_image','landing_name_diff','landing_extra','landing_wrong_order','fuzzy_pairs','no_portal_page']
    with open(REPORT,'w') as f:
        f.write('# Our site vs Joma B2B portal: structural diff\n\n| check | count |\n|---|---|\n')
        for k in keys: f.write(f'| {k} | {len(rep[k])} |\n')
        for k in keys:
            f.write(f'\n## {k} ({len(rep[k])})\n\n')
            for x in rep[k]: f.write(f'- {x}\n')
for k in ['landing_name_diff','landing_extra','landing_wrong_order']: print(k,len(rep[k]),rep[k][:30])
