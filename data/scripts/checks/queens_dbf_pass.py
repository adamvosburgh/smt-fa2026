"""Pass 1 for the frontage check: pull the Queens columns out of MapPLUTO's DBF.

A DBF is fixed-width records after a fixed-length header, so the whole file can
be sliced by byte offset with numpy. 856,687 records in under four seconds, no
geo stack. Writes queens_dbf.npz into $SMT_SCRATCH (default /tmp/smt-checks).
"""
import struct, os, numpy as np
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SCRATCH = os.environ.get("SMT_SCRATCH", "/tmp/smt-checks")
os.makedirs(SCRATCH, exist_ok=True)
BASE = os.path.join(REPO, "data/original/nyc_mappluto_26v2_shp/MapPLUTO")
want = ["borocode","block","bldgclass","longitude","latitude","lotarea"]
f = open(BASE + ".dbf","rb")
head = f.read(32)
n_rec, hlen, rlen = struct.unpack("<IHH", head[4:12])
off, cols = 1, {}
for _ in range((hlen-33)//32):
    fd = f.read(32)
    if fd[:1] == b"\x0d": break
    name = fd[:11].split(b"\x00")[0].decode("latin-1").lower()
    ln = fd[16]; cols[name] = (off, ln); off += ln
print(n_rec, rlen, {w: cols[w] for w in want}, flush=True)
f.seek(hlen)
out = {w: [] for w in want}
CH = 100000
done = 0
while done < n_rec:
    k = min(CH, n_rec-done)
    buf = np.frombuffer(f.read(k*rlen), dtype=np.uint8)
    if buf.size < k*rlen: k = buf.size//rlen; buf = buf[:k*rlen]
    m = buf.reshape(k, rlen)
    for w in want:
        o,l = cols[w]
        out[w].append(m[:, o:o+l].copy())
    done += k
f.close()
arrs = {w: np.concatenate(out[w]) for w in want}
def tostr(a):
    return np.array([bytes(r).decode("latin-1").strip() for r in a])
boro = arrs["borocode"][:,0]  # single char field
qmask = np.array([bytes(r).decode("latin-1").strip()=="4" for r in arrs["borocode"]])
print("queens rows:", int(qmask.sum()), flush=True)
idx = np.nonzero(qmask)[0].astype(np.int64)
res = {"row": idx}
for w in ["block","bldgclass","longitude","latitude","lotarea"]:
    res[w] = tostr(arrs[w][qmask])
np.savez_compressed(os.path.join(SCRATCH, "queens_dbf.npz"), **res)
print("saved", {k: res[k][:3].tolist() if k!="row" else res[k][:3].tolist() for k in res}, flush=True)
