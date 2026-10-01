# FDDD third-party notices

Modified application based on cobanov/flyjump, pinned c08c86bc18efd8125964b1d2ca4fc1df59700f30, https://github.com/cobanov/flyjump.

Original connectome runtime and BrainScene foundation: Mert Cobanov, Cobanov Template Attribution License 1.0, preserved in LICENSE. Modified for drug-research platform demo: disconnected condition, new encoder/readout, experiment controls, telemetry and scene integration. No Dino gameplay, Chromium code, pretrained controller or training checkpoints copied.

Built with [fly-connectome-template](https://github.com/cobanov/fly-connectome-template) by [Mert Cobanov](https://github.com/cobanov).

MaleCNS v1.0 graph and anatomical atlas: CC BY 4.0. FlyEM / HHMI Janelia, University of Cambridge, MRC Laboratory of Molecular Biology and Google Research. https://male-cns.janelia.org/download/ . Original notices, manifests, hashes and source attribution retained in public/data/connectome and public/data/brain-atlas. Runtime graph retained byte-for-byte in src/data/connectome.json.

Flybody meshes: TuragaLab, https://github.com/TuragaLab/flybody, Apache-2.0. Original LICENSE, NOTICE.md and checksums.json retained in public/data/flybody. New lab scene loads existing binary anatomy using the upstream part/pivot format.

React, React DOM, Three.js, Vite and Playwright retain their package licenses (MIT); TypeScript Apache-2.0. External Google Fonts IBM Plex Mono and Noto Sans KR are optional SIL OFL font requests; system font fallbacks operate offline. No blanket MIT license is asserted for this distribution.

## Current reward studio (supersedes runtime descriptions above)

The active neural engine uses the full FlyWire FAFB139255-cell graph, NOT the archived MaleCNS80-cell circuit. FlyWire data is CC BY-NC4.0, noncommercial only; exact notices in public/data/flywire/NOTICE.md. Engine adapted from snedea/flybrain revision9191824, MIT notice in public/engine/flywire/LICENSE-MIT.txt. Current simple3D inspectors are original; archived Flybody assets are not rendered.

Mol*5.11.0: Copyright2017–now Mol* contributors, MIT. Unmodified license copied to public/licenses/Molstar-LICENSE.txt. https://molstar.org/ .

AutoDock Vina1.2.3/Webina WASM: runtime source versions, Apache2.0 notices and citations in scripts/docking/vendor/. Prepared molecular examples retain their source attribution and raw structures. DOCKSTRING dataset Figshare release16511577.v1 is Apache2.0 per release metadata; exact license and source hashes in public/data/learning/.

BindingDB reference records retain compound IDs, measurement types, PMID and DOI. DailyMed-derived numerical PK facts retain label URLs and conditions. PK-DB is linked as a resource; its data license is not asserted to cover DailyMed data. DiffDock output is absent: public demo failed, documented in docs/diffdock-status.md.

DM Sans and IBM Plex Mono are optional Google Fonts requests with local font fallbacks. No blanket license is asserted across code, measured connectome, clinical reference data and user-provided design images.

## Current MaleCNS v1.0 runtime (supersedes FlyWire runtime)
CC BY4.0 connectivity and annotation data, FlyEM/HHMI Janelia, Cambridge, MRC LMB, Google Research. Source https://male-cns.janelia.org/download/ . Citation https://doi.org/10.1016/j.cell.2026.08.015 . See public/data/malecns/NOTICE.md and manifest.json for transformations and exact counts. Archived FlyWire files retain prior notices; not relicensed. Apache Arrow (Apache2.0) and lz4js (MIT) used only by offline builder.
The MaleCNS model intentionally adds2000 null-status rows to165122 Traced rows.1991 added rows are explicitly Out of scope;9 lack statusLabel. Inclusion does not upgrade their proofreading status. See manifest.selectionAudit. Dataset release and selected runtime are distinct.

## Fruit-fly design reference photograph
`references/drosophila/top-andre-karwath.jpg`: André Karwath (Aka),2005, CC BY-SA2.5. Source https://commons.wikimedia.org/wiki/File:Drosophila_melanogaster_-_top_(aka).jpg . Unmodified photographic reference only; no photograph texture or imported fly mesh in the procedural Three.js candidates.

## README concept illustration
`docs/assets/fddd-overview.jpg` is an AI-generated explanatory illustration created for FDDD. The stylized protein, molecule, fly, network and bars are conceptual artwork, not measured anatomy, connectivity, docking poses or result plots. It contains no Toss logo or third-party brand asset.
