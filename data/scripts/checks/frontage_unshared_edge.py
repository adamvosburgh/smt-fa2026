"""Check: does the unshared lot edge identify the street frontage in Queens?

Run BEFORE and AFTER rewriting the siting step in pencil.py. This is the
evidence behind the siting step, and re-running it is how a new implementation
gets checked against a known answer.

The structural fact it exploits: a NYC tax BLOCK is bounded by streets, so every
shared lot line lies inside a block. Sharing can be computed block by block and
never needs a citywide spatial index. 500 blocks run in about 8 seconds in pure
Python and numpy, with no geo stack.

    python3 data/scripts/checks/queens_dbf_pass.py      # writes queens_dbf.npz
    python3 data/scripts/checks/frontage_unshared_edge.py

Measured 2026-09-04, MapPLUTO 26v2, 500 random Queens blocks with 8+ one-to-two-
family lots, 13,670 such lots. A correct reimplementation should reproduce these
within sampling noise:

    lots with no unshared edge          65      0.5%
    exactly one unshared edge        11,614    85.0%
    two (corner and through lots)     1,461    10.7%
    three or more                       595     4.4%
    median unshared share of perimeter          11.8%
    frontage normal points out of block         97.4%

and, against the rear-yard box shipped in data/processed/pencil/lots.bin:

    back direction points INTO the block    new 96.5%   old 55.5%
    directional resultant per 120ft cell    new 0.999   old 0.608

The 0.608 reproduces the 0.60 reported in
"2026-09-01 Notes — 02 Does It Pencil, What Is Still Wrong.md", which is what
validates the metric. The two methods disagree by more than 90 degrees on 43.0%
of lots and are near-exact reversals on 33.5%, so about a third of the drawn
cottages are currently at the wrong end of the lot.

Paths assume the scratch npz sits beside this file's output dir; edit SCRATCH if
you move it.
"""
import json, math, os, random, sys
import numpy as np
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SCRATCH = os.environ.get("SMT_SCRATCH", "/tmp/smt-checks")
os.makedirs(SCRATCH, exist_ok=True)
sys.path.insert(0, os.path.join(REPO, "data", "scripts"))
from pencil import read_shape_index, read_outer_ring
BASE = os.path.join(REPO, "data/original/nyc_mappluto_26v2_shp/MapPLUTO")
SNAP, STEP, SHARED_FRAC = 3.0, 3.0, 0.5

d = np.load(os.path.join(SCRATCH, "queens_dbf.npz"), allow_pickle=False)
row, block, bcls = d["row"], d["block"], d["bldgclass"]
lon = np.array([float(x) for x in d["longitude"]])
lat = np.array([float(x) for x in d["latitude"]])
isab = np.array([b[:1] in ("A","B") for b in bcls])

byblock = {}
for i in range(len(row)):
    byblock.setdefault(block[i], []).append(i)
elig = [b for b,v in byblock.items() if sum(1 for i in v if isab[i]) >= 8 and len(v) <= 400]
print(f"queens lots {len(row):,}  blocks {len(byblock):,}  eligible blocks {len(elig):,}", flush=True)
random.seed(20260904); sample = random.sample(elig, min(500, len(elig)))

idx = read_shape_index(BASE); fh = open(BASE + ".shp","rb")

def edges(ring):
    out=[]
    for k in range(len(ring)-1):
        p,q = ring[k], ring[k+1]
        dx,dy = q[0]-p[0], q[1]-p[1]; L=math.hypot(dx,dy)
        if L < 0.5: continue
        n=max(2,int(L/STEP)+1); t=np.linspace(0,1,n)
        kx=np.rint((p[0]+dx*t)/SNAP).astype(np.int64); ky=np.rint((p[1]+dy*t)/SNAP).astype(np.int64)
        out.append((kx*4000000+ky,(p[0]+q[0])/2,(p[1]+q[1])/2,dy/L,-dx/L,L))
    return out

recs=[]; nofree=0; blocks_used=0
for blk in sample:
    members=byblock[blk]; geoms=[]
    for i in members:
        r = read_outer_ring(fh, idx, int(row[i]))
        if r is None or len(r)<4: continue
        geoms.append((i, np.asarray(r,dtype=np.float64)))
    if len(geoms)<4: continue
    blocks_used+=1
    K=[];O=[];per=[]
    for li,(i,ring) in enumerate(geoms):
        es=edges(ring); per.append(es)
        for e in es: K.append(e[0]); O.append(np.full(e[0].shape,li,np.int32))
    if not K: continue
    K=np.concatenate(K);O=np.concatenate(O)
    o=np.lexsort((O,K)); K,O=K[o],O[o]
    u=np.ones(len(K),bool); u[1:]=(K[1:]!=K[:-1])|(O[1:]!=O[:-1])
    ku,cn=np.unique(K[u],return_counts=True); multi=ku[cn>=2]
    bcx=float(np.mean([g[1][:,0].mean() for g in geoms])); bcy=float(np.mean([g[1][:,1].mean() for g in geoms]))
    for li,(i,ring) in enumerate(geoms):
        if not isab[i]: continue
        cx,cy = ring[:-1,0].mean(), ring[:-1,1].mean()
        fx=fy=0.0; nfree=0; freeL=0.0; totL=0.0
        for (kk,mx,my,nx,ny,L) in per[li]:
            totL+=L
            if float(np.isin(kk,multi).mean())>=SHARED_FRAC: continue
            if (mx-cx)*nx+(my-cy)*ny<0: nx,ny=-nx,-ny
            fx+=nx*L; fy+=ny*L; nfree+=1; freeL+=L
        mag=math.hypot(fx,fy)
        if nfree==0 or mag<1e-9: nofree+=1; continue
        fx,fy=fx/mag,fy/mag
        recs.append(dict(blk=blk,i=int(i),cx=cx,cy=cy,backx=-fx,backy=-fy,
                         lon=lon[i],lat=lat[i],nfree=nfree,
                         free_share=freeL/totL,
                         outward=bool((cx-bcx)*fx+(cy-bcy)*fy>0)))
fh.close()
json.dump(recs, open(os.path.join(SCRATCH, "frontage_new.json"),"w"))
nf=np.array([r["nfree"] for r in recs]); fs=np.array([r["free_share"] for r in recs])
print(json.dumps({
 "blocks_used": blocks_used,
 "one_two_family_lots_measured": len(recs),
 "lots_with_no_free_edge": nofree,
 "free_edges_1": int((nf==1).sum()), "free_edges_2": int((nf==2).sum()), "free_edges_3plus": int((nf>=3).sum()),
 "median_free_perimeter_share": round(float(np.median(fs)),3),
 "frontage_points_out_of_block": round(float(np.mean([r["outward"] for r in recs])),4),
}, indent=1), flush=True)
