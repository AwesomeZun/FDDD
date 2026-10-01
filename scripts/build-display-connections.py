"""Sample actual MaleCNS edges whose measured endpoints are in the live display.

The sample is a visual guide, not neurite geometry or a representative estimator.
Reservoir sampling is deterministic; live pulses use the source neuron's computed
spike flag. No recorded showreel activity is used by the platform.
"""
import gzip, hashlib, json, random, struct
from pathlib import Path

root = Path(__file__).resolve().parents[1]
base = root / 'public/data/malecns'
points = json.loads((base / 'display-points.json').read_text())['points']
ids = json.loads((base / 'root-ids.json').read_text())
by_id = {p['bodyId']: i for i, p in enumerate(points)}
lookup = {i: by_id[body] for i, body in enumerate(ids) if body in by_id}
raw = gzip.decompress((base / 'connectome.bin.gz').read_bytes())
n, edge_count = struct.unpack_from('<II', raw)
assert n == len(ids)
rng = random.Random(7)
limit, eligible, sample = 7000, 0, []
for pre, post, weight in struct.iter_unpack('<IIf', raw[8:8 + edge_count * 12]):
    a, b = lookup.get(pre), lookup.get(post)
    if a is None or b is None or a == b or abs(weight) < 20:
        continue
    p, q = points[a]['position'], points[b]['position']
    if sum((x-y)**2 for x,y in zip(p,q)) < 6000**2:
        continue
    eligible += 1
    edge = [a, b, weight]
    if len(sample) < limit:
        sample.append(edge)
    else:
        k = rng.randrange(eligible)
        if k < limit:
            sample[k] = edge
sample.sort()
out = {'source': 'MaleCNS selected graph; measured display-point endpoints',
       'graphSha256': hashlib.sha256(raw).hexdigest(),
       'displaySha256': hashlib.sha256((base/'display-points.json').read_bytes()).hexdigest(),
       'eligible': eligible, 'count': len(sample),
       'sampling': 'Seed 7 reservoir; |signed synapse count| >= 20; endpoint distance >= 6000 coordinate units. Long stronger links are emphasized, not representative.',
       'geometry': 'Authored curves between measured soma locations, not reconstructed neurites.',
       'edges': sample}
(base/'display-connections-v3.0.0.json').write_text(json.dumps(out, separators=(',',':'))+'\n')
print(f'{len(sample)} actual edges from {eligible} eligible pairs')
