# Common molecular scale correction

## Defect removed
Previously `makeProteinComplex` independently normalized every receptor's longest dimension to2.65world units. This erased real size differences between prepared structures. Receptor/ligand internal alignment was retained, but inter-complex size comparison was invalid.

## Current behavior
- ALL receptor and ligand coordinates use `WORLD_UNITS_PER_ANGSTROM = 0.03` from `src/lib/molecularScale.ts`.
- No per-target normalization; source coordinates are translated to a bounding-box center and uniformly scaled with the same constant. Ribbon width, atom glyphs and bonds retain the same Å-based dimensions across targets.
- Shared habitat now uses an **orthographic 3D camera**, retaining rotation, depth, lighting, occlusion, pan and zoom while eliminating near/far perspective magnification. This is not a flat2D rendering.
- Camera fitting waits for all complex geometry and labels, then fits actual transformed bounds. Labels sit below each receptor's actual lower y bound.
- A screen-calibrated, zoom-aware Å/nm scale bar is displayed. Fly bodies are explicitly labeled navigation avatars, NOT physically molecular-scale organisms.
- This corrects relative sizes of the **prepared coordinate structures**, not hypothetical full-length proteins. PARP1 is a catalytic-domain structure; COX-2's prepared model contains4crystal chains. These4chains must not be described as proof of a physiological tetramer.

| Prepared target | Cα atoms | x/y/z extent (Å) | x/y/z extent (world) | Enclosing atom radius (world) |
|---|---:|---|---|---:|
| PARP1 /4R6E chainA |350|61.425 /59.264 /50.933|1.84275 /1.77792 /1.52799|1.1577761521|
| FactorXa /2P16 |286|62.603 /50.629 /40.815|1.87809 /1.51887 /1.22445|1.0270891170|
| COX-2 /3LN1 fourchains |2208|109.555 /90.167 /139.439|3.28665 /2.70501 /4.18317|2.3373204614|

COX-2's longest-axis extent is139.439/61.425=2.27007times the PARP1 prepared structure, and the world-coordinate ratio is identical. Multiple copies of the same receptor have identical world and orthographic apparent scale.

## Parent integration contract
`public/data/docking/structure-scale.json` contains:
- `worldUnitsPerAngstrom`
- `targets[]`: `targetId`, `receptorUrl`, SHA256, `dimensionsAngstrom`, `dimensionsWorld`, `radiusWorld`, `minYWorld`, `maxYWorld`, atom/CA/chain counts.

The parent should attach `radiusWorld` to each `HabitatPair` at initial data load. An authored orbit/contact threshold may use this radius plus an avatar margin; this remains a bounding-sphere proximity heuristic, NOT a measured molecular surface or binding event. Existing fixed orbit1.6/contact2.0assumptions should be removed. With a .4world margin, COX-2 orbit radius≈2.7373; the old movement bounds x±7.5,z±5.5 clip paths near outer stations. Increase/dynamically derive bounds (e.g. x±9.5,z±7.5) while preserving current station positions.

Regenerate metadata with `node --experimental-strip-types scripts/molecular-scale.mjs` after changing receptor inputs.

## Verification
4newtests in `tests/molecular-scale.test.ts` pass:
1. all receptors/ligands share .03scale;
2. real extent ratios and4-chain COX-2 identity preserved;
3. receptor–ligand distances and positions transformed identically;
4. orthographic projected length invariant under changing station depth.
Typecheck passes. Browser QA belongs to parent. No project data file coordinates were altered; only renderer scaling/camera and new derived metadata changed.
