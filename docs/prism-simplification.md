# PRISM geometry simplification

Only new `src/design-studio/prism-models.ts` and tests/docs were added. Existing `models.ts`, studio UI, renderer, benchmark, Vite configuration and MaleCNS application were not edited by this implementation.

## API

- `prismVariants`: three descriptor objects matching the existing candidate descriptor fields.
- `makePrismVariant(level: number): FlyModel`, validated levels0/1/2.
- `prismGeometryCost(model)`: static geometry counts and an **estimated** material-pass draw-call count, not an executed GPU benchmark.

Level0 returns a newly constructed, unmodified `makeCandidate(2)`. Consequently, `model.index` and `root.userData.candidate` remain2 for all levels. A three-item selection UI should explicitly assign its own picker index after construction. Do not mistake the inherited family index for the variant position.

## Generated costs

| Variant | Geometry triangles | Geometry position entries | Renderable objects | Estimated draw calls | Line segments |
|---|---:|---:|---:|---:|---:|
| ORIGINAL |5690|4832|54|56|138|
| LOW |1194|3690|9|11|78|
| MIN |634|1998|9|11|60|

Triangle reductions relative to the unchanged original are79.0% and88.9%. Estimated draw-call reduction is80.4%. The two transparent double-sided wing membranes cause additional rendering passes: expected renderer.info triangle totals are5740/1220/648 if all geometry is visible. **The parent must execute WebGL to verify these estimates and timing.** CPU/GPU time reductions cannot be inferred directly from triangle percentages.

The merged opaque geometry is non-indexed to preserve source normals across material-compatible pieces. Therefore the reduction in allocated position entries is smaller than the reduction in triangle count. Vertex numbers describe allocated attributes, not isolated GPU shader invocation counts.

## Preserved characteristics

Both simplified levels retain the original PRISM material parameters, colors, anatomy metadata, six actual short-leg source groups, two eye lobes, two antennae, short mouthparts, two halteres, four abdominal bands and independently animated wings. World width differs by less than0.002 and length by less than0.000001. MIN loses about0.04 of height from coarser facet extrema, making its silhouette visibly more angular.

LOW uses body icosahedra detail1, small spheres8×5, abdomen8radial×8length divisions and4-sided rods. MIN uses body icosahedra detail0, small spheres6×4, abdomen6×5 and3-sided rods. Broad rounded wing paths remain the same curves with fewer tessellation samples.

Opaque parts merge only with the same original material. Bone/arista line strips and wing outlines/veins are converted explicitly to independent segment pairs before merging; disconnected strips are not spuriously connected. The transparent wing membrane stays separate under each original hinge, retaining its original mirror transform and material/pass behavior. Four opaque body material batches, one body-line batch, and two renderables per wing remain.

Named source parts removed by batching are represented by nonrendering metadata markers. Each marker points to its material batch and source vertex range; `root.userData.batchingManifest` retains per-source ranges and original parent names. These markers are not extra geometry and are not substituted for the source-part checks. Pre-batch counts are stored as `anatomicalPartsBeforeBatch`.

## Verification

Four new tests verify unmodified baseline geometry/materials, anatomical source counts, material equality, finite attributes, bounds, reduced topology/draw-call estimates, and independent line connections. All38project tests and TypeScript typecheck pass. See `docs/prism-tests.log` and `docs/prism-geometry-costs.json`.

No browser tabs opened; visual quality and actual WebGL measurements remain parent integration/QA scope.

## Actual browser verification
Two512×512runs,96frames/candidate/run (docs/prism-benchmark-run1.json andrun2.json): ORIGINAL56draws/5740renderedtriangles, LOW11/1220, MIN11/648. Times ORIGINAL .575/.625ms,LOW .200/.350ms,MIN .225/.325ms. LOW cuts drawcalls80.4%,triangles78.7%, observed synchronous render+GPU-completion time44–65%. LOW/MIN tradeplaces withinnoise; LOW recommended forretainedshape, not anabsolute speedwinner. NoCNScompute included ormodified.38tests pass andbuild/typecheck pass. Studio defaults PRISMcomparison; existing6candidate view retained. Neitheroptimizedvariant applied to mainhabitat yet.

## Levels 3/4: three draw calls (LOW-3, MIN-3)
Same simplified geometry as LOW/MIN (1,194 / 634 geometry triangles). Every nonmoving part (thorax, abdomen, bands, head, eyes, mouthparts, antenna flagellomeres, six legs, two halteres) is merged into ONE mesh whose per-part material colours are baked into a vertex `color` attribute; one MeshStandardMaterial(vertexColors, flatShading, roughness .7). All Line objects (arista, wing outline, veins) removed. Each wing membrane keeps its own hinge and uses one DoubleSide + forceSinglePass transparent material (same tint/opacity), so it renders in one pass. Estimated draw calls: 3 (body 1 + wings 2), vs 11 for LOW/MIN and 56 for ORIGINAL. Vertices stored: 3,534 / 1,878. Rendered wing triangles are no longer doubled. Tests: tests/prism-three-call.test.ts. Actual WebGL timing not yet measured for these levels.

## 100 simultaneous flies (actual browser, 2026-09-14)
Benchmark now accepts `instances` (clones share geometry/materials, separate objects, grid-arranged, individual flight phases). Two 512×512 runs, 96 frames/candidate/run (docs/prism-benchmark-100-run{1,2}.json). Draw calls are the whole frame (a few grid-edge copies are frustum-culled, so 291 rather than 300 for 3-call variants, 5,346 rather than 5,600 for ORIGINAL).

| variant | draw calls | triangles/frame | run1 median | run2 median |
|---|---:|---:|---:|---:|
| ORIGINAL | 5,346 | 544,820 | 86.95 ms | 84.23 ms |
| LOW | 1,065 | 118,436 | 37.43 ms | 30.10 ms |
| MIN | 1,065 | 62,948 | 37.40 ms | 19.13 ms |
| LOW-3 | 291 | 115,818 | 13.40 ms | 13.65 ms |
| MIN-3 | 291 | 61,498 | 16.05 ms | 14.25 ms |

Run 2 had very wide interquartile ranges (MIN 5.6–43.9 ms, LOW 5.8–59.0 ms), so LOW vs MIN in run 2 is not a reliable gap; run 1 showed them identical. LOW-3 vs MIN-3 overlap in both runs. Conclusion: at 100 flies the cost is dominated by draw calls, not triangle count; halving triangles (LOW→MIN) produced no reliable gain, while cutting calls 11→3 per fly gave a ~2.5x reduction. Legs are merged into the body mesh and cost no extra draw calls; removing them would only trim triangles, which this data shows is not the bottleneck. The 3-call variants drop arista/wing-vein lines and use single-pass wings; that is the visible trade-off. 39 tests pass.

## Applied to the main habitat (2026-09-14)
`src/components/ColonyHabitat.tsx` `makeFly` now builds `makePrismVariant(3)` (PRISM LOW-3) per fly, scaled .62 (~1.02 world units nose to tail, matching the old avatar footprint). Per-fly accent (cyan/orange/purple/lime, same `accents` array as before) is baked into thorax/abdomen/head vertex colors (lerp .48/.62/.48), eyes stay reddish-brown, wing membranes tinted 25% toward the accent, body material emissive = accent (selection/feeding pulse). Feeding no longer extends a separate proboscis object (LOW-3 mouthparts are merged); it is shown as a stronger emissive pulse. Per fly: 3 draw calls + label sprite + hidden hit sphere + trail line. Backup of the previous component: `backups/before-low3-avatar/`. 39 tests, typecheck and build pass; brains kept computing after reload (STEP counters advancing, 8/8 complexes loaded).
