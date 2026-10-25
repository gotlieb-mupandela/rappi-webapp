"""Find a portal home for products in our extra folders that no portal list has.
Usage: python3 scripts/joma-place-orphans.py <ours_full.json> <orphans.json> <sync_report.json> <outdir>
Rules, in order (same top-level tree as the extra folder when possible):
  1. sibling colour: another colour of the same model code is in a portal list -> those folders
  2. model / club name: a portal leaf whose name (minus season, e.g. "26/27") appears in the
     product name -> that leaf (most specific / longest name wins)
  3. otherwise: no portal home (reported, folder kept)
Writes data/joma-portal-placements.json {code: [folderKey, ...]} and <outdir>/placements.json."""
import json,re,sys,os,collections,unicodedata
OURS,ORPH,REP,OUT=sys.argv[1:5]
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
po=json.load(open(os.path.join(ROOT,'data/joma-portal-order.json')))
L={x['code']:x for x in json.load(open(os.path.join(ROOT,'public/listing-index.json')))}
o=json.load(open(OURS)); orph=json.load(open(ORPH)); rep=json.load(open(REP))
nodes={};root={};path={}
def walk(ns,rt,p):
    for n in ns:
        nodes[n['key']]=n; root[n['key']]=rt; path[n['key']]=p+[n['label']]; walk(n['children'],rt,p+[n['label']])
for k,v in o.items():
    if k!='landing': walk(v,k,[k])
def strip(s):
    s=unicodedata.normalize('NFD',s); s=''.join(c for c in s if unicodedata.category(c)!='Mn').lower()
    return re.sub(r'[^a-z0-9]+',' ',s).strip()
def base(c): return c.split('.')[0] if '.' in c else None
where=collections.defaultdict(list)
for k,v in po.items():
    for c in v: where[c].append(k)
bybase=collections.defaultdict(set)
for c in where:
    if base(c): bybase[base(c)].add(c)
# model/club rule may use any portal folder (club folders have Game/Training children)
def stem(c):
    m=re.match(r'^([A-Z]+?)(S|W)\d{2}',c)
    return m.group(1) if m and '.' not in c else None
bystem=collections.defaultdict(set)
for c in where:
    if stem(c): bystem[stem(c)].add(c)
# Folder-level fallback: outlet shoes with no portal list go to the portal's one Footwear > Outlet.
FALLBACK={'kids-outlet':'footwear-outlet'}
# our federation folders whose portal twin carries a translated name
# hand-checked: goalkeeper set from our 'Portero/Portera' folders -> the portal Goalkeeper/Portress > Set
MANUAL={'103242.060':(['wk-set','k1214g-tw-portera-set'],'goalkeeper set; portal Goalkeeper > Set / Portress > Set')}
TWIN={'kit-fed-rumania-2025':'jp-235f5c67cb','kit-fed-coe-winter':'jp-52d5f4276a'}
leaves=[k for k in nodes if po.get(k) or root.get(k)=='OfficialKits']
lab={k:re.sub(r'\s+',' ',re.sub(r'\b(\d\d \d\d|outlet|ss\d\d|fw\d\d|acf|fc|cf)\b','',strip(nodes[k]['label']))).strip() for k in leaves}
cnt=collections.Counter(lab.values())
GENERIC={l for l in cnt if len(l)<4}
# Product-type words are not model names (a "SHORT" folder is not the home of every short).
TYPE=set('football soccer basketball volleyball handball rugby short shorts jacket jackets training urban pants pant long t shirt shirts set sets accessories socks sock polo polos sweatshirt sweatshirts leggings tights top tops skirt skirts dress dresses coach referee basics basic outlet jersey jerseys in stock comfort confort indoor gym fw25 fw26 ss25 ss26 ss27 new collection collections previous season seasons bermuda vest hoodie hooded windbreaker raincoat anorak tracksuit track suit bra bras swimsuit bikini cap caps bag bags ball balls gloves goalkeeper fleece trousers casual cotton polyester summer winter lifestyle running trail tennis padel'.split())
CORE=set('short shorts jacket jackets pants pant long t shirt shirts set sets accessories socks polo polos sweatshirt sweatshirts leggings tights top tops skirt skirts dress dresses basics in stock new collection collections previous season seasons'.split())
SURFACE={'artificial grass','soft ground','semi dry hard terrain','futsal','turf'}
FOOT={'Footwear','FootwearWoman','FootwearJunior'}
SHOE_SUBS={'boots','futsal','turf','football-fg','football-ag','football-sg','football-hg','shoes'}
def is_shoe(c):
    x=L[c]; sub=x.get('subcategory') or ''
    return x.get('category')=='shoes' or sub in SHOE_SUBS or sub.endswith('-shoes')
def ok_root(c,k):
    return (root.get(k) in FOOT)==is_shoe(c)
extra_root={x['key']:root.get(x['key']) for x in rep['kept_extras']}
place={}; why={}; left=[]
for ek,codes in orph.items():
    rt=extra_root.get(ek)
    for c in codes:
        if c not in L: continue
        name=' '+strip(L[c]['displayName'])+' '
        sib=[s for s in bybase.get(base(c),()) if s!=c] if base(c) else []
        fs=sorted({f for s in sib for f in where[s]})
        fs=[f for f in fs if ok_root(c,f)]
        same=[f for f in fs if root.get(f)==rt]
        if fs:
            place[c]=same or fs; why[c]=f"sibling colour {sib[0]}"; continue
        def model_ok(k):
            l=lab[k]
            if not ok_root(c,k) or f' {l} ' not in name: return False
            if is_shoe(c) and l in SURFACE: return True
            if l in GENERIC: return False
            toks=set(l.split())
            # one-word names must not be a type/sport word; longer names only fail if all core type words
            return not toks<=(TYPE if len(toks)==1 else CORE)
        st=stem(c); sib2=sorted(bystem.get(st,())) if st else []
        fs2=sorted({f for x in sib2 for f in where[x] if ok_root(c,f)})
        if fs2:
            same=[f for f in fs2 if root.get(f)==rt]
            place[c]=(same or fs2)[:3]; why[c]=f"same shoe model {st} ({sib2[0]})"; continue
        hits=[k for k in leaves if model_ok(k)]
        # 'Marathon II' is a running model, not the club Marathón
        if re.search(r'Marathon II',L[c]['displayName'],re.I): hits=[k for k in hits if root.get(k)!='OfficialKits']
        # same top-level tree only; club folders (Official Kits) may take kit from anywhere
        hs=[k for k in hits if root.get(k)==rt] or [k for k in hits if root.get(k)=='OfficialKits'] \
            or [k for k in hits if root.get(k) in ('Man','Woman')]  # adult model folder, never a kids one
        if hs:
            best=max(len(lab[k]) for k in hs); hs=[k for k in hs if len(lab[k])==best]
            place[c]=hs[:1]; why[c]=f"model/club name '{nodes[hs[0]]['label']}'"; continue
        if c in MANUAL:
            place[c]=[k for k in MANUAL[c][0] if k in nodes]; why[c]=MANUAL[c][1]; continue
        if TWIN.get(ek) in nodes:
            place[c]=[TWIN[ek]]; why[c]=f"same federation kit; portal folder '{nodes[TWIN[ek]]['label']}'"; continue
        if FALLBACK.get(ek) in nodes:
            place[c]=[FALLBACK[ek]]; why[c]='outlet shoe; portal has one Footwear > Outlet folder'; continue
        left.append({'code':c,'name':L[c]['displayName'],'extra':' > '.join(path.get(ek,[ek]))})
json.dump(place,open(os.path.join(ROOT,'data/joma-portal-placements.json'),'w'),indent=1,sort_keys=True)
json.dump({'placed':{c:{'to':[' > '.join(path[f]) for f in v],'why':why[c]} for c,v in place.items()},'no_home':left},open(os.path.join(OUT,'placements.json'),'w'),indent=1,ensure_ascii=False)
print('placed',len(place),'shoe model',sum(1 for w in why.values() if w.startswith('same shoe')),'fallback',sum(1 for w in why.values() if w.startswith('outlet')),'sibling',sum(1 for w in why.values() if w.startswith('sibling')),'model',sum(1 for w in why.values() if w.startswith('model')),'no home',len(left))
