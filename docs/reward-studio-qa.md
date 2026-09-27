# Reward studio verification

## Science and computation
- Real DOCKSTRING PARP1 subset:2400 identities; official structure-cluster split, connectivity dedup;1600/400/400. Source score/split hashes verified. Training uses deterministic256/64/64 nested subset, not all2400. Score-stratified benchmark, not prospective hit prevalence.
- Full139255-cell/2698236-edge graph computes16 steps per molecule. Fixed connectome reservoir;268-feature trained sigmoid appetitive readout. Labels appear only in training reward and evaluation metadata, never encoding/inference.
- Actual heldout Spearman.6587078844; molecular-only.7856327773 is BETTER. Shuffled-label.3590514799. No claimed fly advantage or native feeding physiology. Individual heldout mistakes remain visible.
- Final training dataset SHA256b82d68b092b2f1cde525c6d6647af75a989fdb2dd94f9bc906073daac008e566 matches model and results. Whole feature-generation spike archive6144 frames×139255 cells=106948608 bytes. Every frame bit-popcount matches recorded spikeCount; see scripts/verify-training-record.mjs.
- DOCKSTRING target prep/box is not the Webina4R6E protocol. No score pooling, no claimed crystal provenance for DOCKSTRING receptor. Live molecular view shows explicitly identified4R6E reference + calculatedVina pose.
- BindingDB UniProtP09874 API returned7311 records (1194Ki,5588IC50,214Kd,315EC50), cutoff10000nM. Distinct endpoints not merged. PDB API failed500; UniProt route succeeded. DailyMed label-derived PK references are separately displayed. No PK-DB-specific compound record claimed loaded.

## Browser checks
- Mol*5.11 loaded actual experimental receptor + Vina pose; professional controls present.
- Four independent neural activity windows; raw-spike color and decaying highlights, not fabricated waves. HiDPI backing-store overflow caught and CSS size constraint added.
- Simple graphite3D flies, saturatedcyan/orange/violet/lime IDs; three-axis trajectories use actual downstream outputs. Added learned-readout-controlled proboscis display, explicitly authored proxy.
- Live unseen4compound run completed64 full-brain steps. Scores hidden before reveal; response outputs81.0%,46.4%,34.0%,43.3%; revealed references-9.9,-10.5,-9.4,-9.3kcal/mol. These include ranking errors, not cherry-picked success.
- Browser export stored local ZIP public/data/records/neural-assay-1789413883139.zip. All64 rows' bit-popcounts match spikeCounts; manifest contains label-free heldout SMILES and correct model/dataset hash.
- Training button entered real server running state; completion verified separately before delivery.
-17 automated tests passed before final UI-only polish. Build includes lazyMolstar~5MB chunk and optional disabledMP4 Node-module warnings.

## Boundaries
DiffDock official hosted demo blocked: RUNTIME_ERROR, nohardware, /config503, schedulingfailure; no job/pose/confidence generated. Boltz2 researched only. Neither is labeled executed. No experimental affinity inferred from Vina, learnedreadout, PK, or poseconfidence.

### Final pass
Browser-triggered retraining reached complete and preserved reproducible metrics. Final17/17 tests and build passed. Full training archive reverified after rerun. Updated source/model/evidence/records packaged as fddd-reward-studio.zip (56MB). Final screenshot saved in session tmp/studio-final-scene.jpg. Mol* controls restyled dark; neural canvases fit their cells and avoid additive overexposure.
