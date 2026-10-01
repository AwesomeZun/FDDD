import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";

test("display links are unique actual directed MaleCNS edges at the claimed measured endpoints", () => {
  const read = (name: string) =>
    readFileSync(new URL("../public/data/malecns/" + name, import.meta.url));
  const pointsBytes = read("display-points.json"),
    points = JSON.parse(pointsBytes.toString()).points;
  const sample = JSON.parse(read("display-connections-v3.0.0.json").toString());
  const graph = gunzipSync(read("connectome.bin.gz"));
  assert.equal(
    createHash("sha256").update(graph).digest("hex"),
    sample.graphSha256,
  );
  assert.equal(
    createHash("sha256").update(pointsBytes).digest("hex"),
    sample.displaySha256,
  );
  assert.equal(sample.count, 7000);
  assert.equal(sample.edges.length, 7000);
  const roots: string[] = JSON.parse(read("root-ids.json").toString()),
    original = new Map(roots.map((id, i) => [id, i]));
  const wanted = new Map<number, Map<number, number>>();
  let checked = 0;
  for (const [a, b, weight] of sample.edges) {
    assert.ok(
      a >= 0 && a < points.length && b >= 0 && b < points.length && a !== b,
    );
    const pre = original.get(points[a].bodyId)!,
      post = original.get(points[b].bodyId)!;
    assert.notEqual(pre, undefined);
    assert.notEqual(post, undefined);
    const targets = wanted.get(pre) ?? new Map();
    assert.ok(!targets.has(post), "no duplicate link");
    targets.set(post, weight);
    wanted.set(pre, targets);
  }
  for (let i = 0, n = graph.readUInt32LE(4); i < n; i++) {
    const offset = 8 + i * 12,
      targets = wanted.get(graph.readUInt32LE(offset));
    if (!targets) continue;
    const post = graph.readUInt32LE(offset + 4),
      weight = targets.get(post);
    if (weight === undefined) continue;
    assert.equal(graph.readFloatLE(offset + 8), weight);
    targets.delete(post);
    checked++;
  }
  assert.equal(checked, 7000);
});
