# Actual docking pipeline

Completed locally: 4 actual compounds against HUMAN PARP1 catalytic domain, PDB4R6E chainA. AutoDock Vina1.2.3 compiled to WebAssembly (published MolModa/Webina build), executed through an original small Node worker_threads browser-worker adapter. No invented/synthetic scores. See public/data/docking/results.json for exact manifest, hashes, provenance revisions, and all limitations. Files include prepared PDBQT inputs, RCSB original4R6E/4HHY PDB downloads, actual output poses, stdout logs.

## Why PARP1 rather than proposed BRD4
Native AutoDock Vina1.2.7 binary and RDKit preparation libraries were blocked by macOS code-loading policy. No system security settings were disabled. Switched to published WebAssembly Vina and already-prepared, documented Webina PARP1 inputs. Native/tool preparation attempts remain isolated under .tools/docking and are NOT runtime dependencies.

## Reproduce
From project root: `node scripts/docking/run-all.mjs` (Node22+; no native Vina/Python/Meeko required). All required runtime files included in scripts/docking/vendor. No network required for reruns. `--manifest-only` only re-parses existing actual outputs and MUST NOT be presented as a new docking execution.

Fixed seed20260914, exhaustiveness4, CPU1, five modes; box center(-39,5,-8), dimensions(15,20,14) Å from published4R6E-A example. PDBQT preparation is inherited from Webina examples. Do not claim Meeko was successfully used. Do not claim a pH/protonation protocol absent from the source.

Compounds: niraparib (4R6E co-crystal control), rucaparib (4RV6), pamiparib, experimental PARP1 inhibitor CCD15R (4HHY).15R is a real deposited compound, not a named approved drug. Full identity available at https://www.rcsb.org/ligand/15R.

Scores are exploratory Vina scores, lower/more negative better within this run. They are NOT measured binding affinity, Kd/Ki/IC50, efficacy or evidence of target engagement. No conversion to molar affinity. No atom-mapped crystallographic redocking RMSD performed. Output RMSD columns are relative to best docked pose, not the experimental pose. Only single seed/rigid receptor with modest search effort; water, protonation, receptor flexibility and ligand-size bias limit interpretation.

The fly/neural layer must remain explicitly separate from the docking calculator: it can inspect/visualize these actual outputs, not scientifically infer affinity from FlyWire activity.

Licensing: Webina Apache2.0 license included in vendor. Vina1.2.3 attribution/license and MolModa build-source notice added in vendor/NOTICE.md. Prepared input source provenance is pinned in results.json. RCSB structure source URLs retained.
