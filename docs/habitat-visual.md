# Shared molecular habitat

`ColonyHabitat` owns one Three.js world and one OrbitControls camera. All stations and four fly agents share that world. Drag orbits, wheel/pinch zooms, right-drag pans. Clicking a fly calls `onSelect(flyIndex)`; `selected` identifies a fly, not a protein. No private flight model, synthetic neural activity, orbiting station animation, or decorative circuit traffic is introduced.

## Coordinate provenance and representation

- Every pair fetches its own `receptorUrl` and `poseUrl`. No proxy protein or procedurally generated fold is used. The upstream pair list controls the number, identity and 3D placement of stations, including six or more distinct complexes.
- Fixed-column PDB/PDBQT atoms are read, alternate conformer A or blank accepted, and only the first model is displayed. Receptor Cα atoms form smooth centripetal backbone tubes. Chain changes and distances over 4.7 Å break the trace. This is an interpolated backbone representation, **not** an assigned secondary-structure cartoon or atomic surface.
- Each complex receives one translation to center the receptor and a single uniform scale to a 2.65-world-unit longest dimension. Exactly the same transform applies to its ligand. No independent ligand translation, exaggeration of molecular distances, deformation, or random rotations occur. Different stations are normalized separately, so apparent protein sizes are not a cross-station molecular-size comparison.
- Ligand heavy atoms use atom-colored spheres and two-color sticks. Bonds are inferred from distance and covalent radii, not verified bond order, connectivity, or valence. Geometry comes from the supplied first pose. Computed docking poses are not experimental binding evidence.
- Missing data produce a visible status message, never fabricated molecular geometry.

## Insect design and motion

Four accents: cyan, coral, violet, lime. Each insect has a small head, inset eyes, thorax, tapered three-part abdomen, two translucent wings, six fine articulated line legs, and two short antennae. Body length is approximately .48 world units. Wings are an authored visual animation, not a measured flight signal. There are no huge eyeballs, mechanical spheres, rings, or hovering cards.

The renderer follows supplied `position` with exponential visual interpolation and uses `velocity` for orientation. Trail vertices are only supplied trail coordinates (last 240), never a fabricated path. Pausing freezes wing time and places the insect at its latest supplied position. Selected flies receive a restrained accent emphasis. `feeding`, `learned`, `dwell`, and `frame` do not generate unsubstantiated visual neural claims.

## Lifecycle

Scene creation is independent of data loading; current props are read through a ref in the RAF callback. A separate abortable data effect reacts to pair URLs and positions. Receptor requests are deduplicated within each load. Initial camera framing happens once when stations first arrive and never overrides subsequent user navigation. ResizeObserver updates camera and renderer dimensions. Unmount cancels RAF, aborts fetches, removes listeners, disposes OrbitControls, geometry, materials, label textures and the renderer. Device pixel ratio is capped at 1.7.

The parent supplies the container dimensions; minimum height is 560 px. Styling is scoped inline and does not change any app styles or other components. Mol* can remain as the separate detailed inspection workflow.

## Verification

TypeScript and the production Vite build pass against the real colony policy types. Parser smoke checks found valid Cα backbones in all five currently supplied receptor PDBQT files (286–2208 Cα atoms) and generated/disposed ligand stick meshes for six supplied first-pose files without errors. These are coordinate/rendering checks, not validation of docking accuracy. Browser-level visual acceptance is left to the parent integration session; this component does not modify the application entry point.
