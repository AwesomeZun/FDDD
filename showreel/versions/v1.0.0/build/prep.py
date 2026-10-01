"""FDDD 쇼릴용 정적 데이터를 준비합니다.

- edges.bin.gz   : MaleCNS 커넥톰에서 실제 연결(시냅스 5개 이상)을 골라 atlas 인덱스 쌍으로 저장합니다.
- molecules.json : 도킹에 실제로 쓴 수용체의 Cα 좌표, 2차 구조, Vina 1순위 포즈 원자를 저장합니다.
- fly.bin.gz     : flybody(Apache-2.0) 초파리 메시를 int16/uint16으로 양자화합니다.

사용법: FDDD_DIR=/path/to/FDDD python3 build/prep.py
"""
import gzip
import json
import os
import struct
import sys

import numpy as np

FDDD = os.environ.get("FDDD_DIR")
if not FDDD:
    sys.exit("FDDD_DIR 환경 변수가 필요합니다.")
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data")
D = lambda *p: os.path.join(FDDD, "public", "data", *p)


# ---------------------------------------------------------------- 커넥톰 연결선
def build_edges():
    raw = gzip.open(D("malecns", "connectome.bin.gz")).read()
    n, e = struct.unpack_from("<II", raw, 0)
    ed = np.frombuffer(raw, dtype=np.dtype([("pre", "<u4"), ("post", "<u4"), ("w", "<f4")]), count=e, offset=8)
    root_ids = json.load(open(D("malecns", "root-ids.json")))
    atlas_ids = np.fromfile(D("brain-atlas", "ids.bin"), dtype="<u4")
    pos = np.fromfile(D("brain-atlas", "positions.bin"), dtype="<f4").reshape(-1, 3)
    index_of = {int(s): i for i, s in enumerate(root_ids)}
    orig_to_atlas = np.full(n, -1, dtype=np.int64)
    for k, a in enumerate(atlas_ids):
        orig_to_atlas[index_of[int(a)]] = k
    pa = orig_to_atlas[ed["pre"]]
    pb = orig_to_atlas[ed["post"]]
    ok = (pa >= 0) & (pb >= 0)
    pa, pb, w = pa[ok], pb[ok], ed["w"][ok]
    dist = np.linalg.norm(pos[pa] - pos[pb], axis=1)
    half = (pos.max(0) - pos.min(0)).max() / 2
    rng = np.random.default_rng(7)
    # 먼 거리 연결을 우선하되, 시냅스 수(|w|)가 큰 연결일수록 잘 뽑히도록 가중 표본을 만듭니다.
    long = dist > 0.22 * half
    cand = np.nonzero(long & (np.abs(w) >= np.quantile(np.abs(w[long]), 0.80)))[0]
    p = np.abs(w[cand]).astype(np.float64)
    p /= p.sum()
    pick = rng.choice(cand, size=min(7000, len(cand)), replace=False, p=p)
    pick = pick[np.argsort(pa[pick])]
    out = np.stack([pa[pick], pb[pick]], axis=1).astype("<u4")
    wq = np.clip(np.abs(w[pick]) / np.abs(w[pick]).max() * 255, 1, 255).astype("u1")
    blob = struct.pack("<I", len(pick)) + out.tobytes() + wq.tobytes()
    open(os.path.join(OUT, "edges.bin.gz"), "wb").write(gzip.compress(blob, 9))
    print("edges", len(pick), "of", int(ok.sum()), "atlas-internal;", "total", e, "min syn |w|", float(np.abs(w[pick]).min()))


# ---------------------------------------------------------------- 분자 구조
def parse_ss(pdb_path, chain):
    ss = []
    for line in open(pdb_path):
        if line.startswith("HELIX ") and (chain is None or line[19] == chain):
            ss.append(("H", int(line[21:25]), int(line[33:37])))
        elif line.startswith("SHEET ") and (chain is None or line[21] == chain):
            ss.append(("E", int(line[22:26]), int(line[33:37])))
    return ss


def parse_ca(pdbqt_path, chain=None):
    res, xyz = [], []
    for line in open(pdbqt_path):
        if line.startswith("ATOM") and line[12:16].strip() == "CA":
            ch = line[21]
            if chain and ch.strip() and ch != chain:
                continue
            if line[16] not in (" ", "A"):
                continue
            res.append(int(line[22:26]))
            xyz.append([float(line[30:38]), float(line[38:46]), float(line[46:54])])
    return res, xyz


def parse_pose(pdbqt_path):
    atoms = []
    for line in open(pdbqt_path):
        if line.startswith("ENDMDL"):
            break
        if line.startswith(("ATOM", "HETATM")):
            t = line[77:79].strip()
            if t in ("H", "HD", "HS"):
                continue
            el = {"A": "C", "OA": "O", "NA": "N", "SA": "S", "N": "N", "C": "C", "O": "O", "F": "F", "Cl": "Cl", "CL": "Cl", "S": "S"}.get(t, t[0])
            atoms.append([float(line[30:38]), float(line[38:46]), float(line[46:54]), el])
    xyz = np.array([a[:3] for a in atoms])
    bonds = []
    for i in range(len(atoms)):
        for j in range(i + 1, len(atoms)):
            if np.linalg.norm(xyz[i] - xyz[j]) < 1.75:
                bonds.append([i, j])
    return atoms, bonds


def build_molecules():
    mt = json.load(open(D("docking", "multi-target.json")))
    targets = {}
    spec = {
        "parp1-4r6e-chain-a": ("4R6E-A_receptor_parp-1.pdbqt", "4R6E.pdb", "A", "PARP1"),
        "factor-xa-2p16": ("2P16_receptor_factor-Xa.pdbqt", "2P16.pdb", None, "인자 Xa"),
        "cox2-3ln1": ("cox2-3ln1-visual.pdbqt", "3LN1.pdb", "A", "COX-2"),
    }
    for t in mt["targets"]:
        rec, pdb, chain, short = spec[t["id"]]
        res, xyz = parse_ca(D("docking", "inputs", rec), chain)
        ss_ranges = parse_ss(D("docking", "inputs", pdb), chain)
        ss = []
        for r in res:
            s = "C"
            for kind, a, b in ss_ranges:
                if a <= r <= b:
                    s = kind
            ss.append(s)
        targets[t["id"]] = {"name": t["name"], "short": short, "pdbId": t["pdbId"], "organism": t["organism"],
                            "res": res, "ca": [[round(v, 2) for v in p] for p in xyz], "ss": "".join(ss)}
        print(t["id"], "CA", len(res), "SS H/E", "".join(ss).count("H"), "".join(ss).count("E"))
    combos = []
    for c in mt["combinations"]:
        pose = os.path.join(FDDD, "public", c["poseUrl"].lstrip("/"))
        atoms, bonds = parse_pose(pose)
        combos.append({"id": c["id"], "targetId": c["targetId"], "compoundId": c["compoundId"], "name": c["name"],
                       "score": c["score"], "role": c.get("role", ""),
                       "atoms": [[round(a[0], 2), round(a[1], 2), round(a[2], 2), a[3]] for a in atoms], "bonds": bonds})
        print(c["id"], c["score"], "heavy atoms", len(atoms), "bonds", len(bonds))
    json.dump({"targets": targets, "combinations": combos}, open(os.path.join(OUT, "molecules.json"), "w"), ensure_ascii=False, separators=(",", ":"))


# ---------------------------------------------------------------- 초파리 메시
def build_fly():
    meta = json.load(open(D("flybody", "model.json")))
    raw = open(D("flybody", "model.bin"), "rb").read()
    parts = []
    allpos = []
    for p in meta["parts"]:
        pos = np.frombuffer(raw, dtype="<f4", count=p["positionCount"] * 3, offset=p["positionByteOffset"]).reshape(-1, 3)
        idx = np.frombuffer(raw, dtype="<u4", count=p["indexCount"], offset=p["indexByteOffset"])
        assert idx.max() < 65536
        parts.append((p, pos, idx))
        allpos.append(pos)
    allpos = np.concatenate(allpos)
    lo, hi = allpos.min(0), allpos.max(0)
    center = (lo + hi) / 2
    half = float((hi - lo).max() / 2)
    print("fly bbox", lo, hi, "half", half)
    header = {"half": half, "center": center.tolist(), "pivots": meta["pivots"], "parts": []}
    blobs = []
    off = 0
    for p, pos, idx in parts:
        q = np.round((pos - center) / half * 32767).astype("<i2")
        i16 = idx.astype("<u2")
        b = q.tobytes() + i16.tobytes()
        header["parts"].append({"group": p["group"], "material": p["material"], "offset": off, "verts": len(pos), "indices": len(idx)})
        blobs.append(b)
        off += len(b)
        if off % 4:
            pad = 4 - off % 4
            blobs.append(b"\0" * pad)
            off += pad
    hj = json.dumps(header).encode()
    hj += b" " * ((4 - len(hj) % 4) % 4)
    blob = struct.pack("<I", len(hj)) + hj + b"".join(blobs)
    open(os.path.join(OUT, "fly.bin.gz"), "wb").write(gzip.compress(blob, 9))
    print("fly gz", os.path.getsize(os.path.join(OUT, "fly.bin.gz")))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    build_molecules()
    build_fly()
    build_edges()
