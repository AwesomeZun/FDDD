# Real multi-target docking data

`public/data/docking/multi-target.json` adds **three different proteins and eight actually computed target–compound combinations**. Existing `results.json` and its PARP1 pipeline are unchanged. No UI files are changed.

## Executed results

Scores below are parsed from saved `REMARK VINA RESULT` lines, not fabricated or copied from a benchmark score table. The first four runs already existed and their pose/log evidence is preserved; the last four were executed for this extension with the existing genuine AutoDock Vina 1.2.3 WASM module under Node `worker_threads`.

| Target | Compound | Best score (kcal/mol) | Saved modes |
|---|---|---:|---:|
| Human PARP1, 4R6E chain A | 15R | -13.093 | 5 |
| Human PARP1, 4R6E chain A | Pamiparib | -11.085 | 5 |
| Human PARP1, 4R6E chain A | Niraparib | -10.178 | 5 |
| Human PARP1, 4R6E chain A | Rucaparib | -9.769 | 5 |
| Mouse COX-2, 3LN1 | Celecoxib | -11.880 | 4 |
| Mouse COX-2, 3LN1 | Niraparib | -6.605 | 5 |
| Human factor Xa, 2P16 | Apixaban | -10.248 | 4 |
| Human factor Xa, 2P16 | Niraparib | -7.967 | 5 |

**Do not rank these scores across targets as calibrated affinity or selectivity.** Niraparib on factor Xa and COX-2 is exploratory cross-docking, not validated biological binding. Apixaban and celecoxib are native co-crystal ligand redocking controls, but atom-mapped crystallographic RMSD has not been calculated. Mode RMSDs refer only to the best computed pose within each run. Vina stdout rounds affinities more than the saved pose remarks: e.g. apixaban prints -10.25, but the pose records -10.248. `num_modes=5` is a maximum; energy-range filtering can retain fewer output models.

## Exact consumer schema

```ts
interface MultiTarget {
  schemaVersion: 'fddd-multi-target-docking-v1';
  computed: true;
  generatedAt: string;
  targets: {
    id: string; name: string; pdbId: string; organism: string;
    receptorPdbqt: string; receptorPdb: string;
    sourceUrl: string; structureSourceUrl: string;
    receptorSha256: string; protocolId: string;
  }[];
  combinations: {
    id: string; targetId: string; compoundId: string; name: string;
    smiles: string; smilesKind: string; protocolId: string;
    sourceUrl: string; identitySourceUrl: string;
    inputUrl: string; inputSha256: string; role: string;
    score: number; scoreKcalMol: number;
    poseUrl: string; logUrl: string;
    posesSha256: string; logSha256: string;
    poses: { rank: number; score: number;
      rmsdLowerBoundFromBest: number; rmsdUpperBoundFromBest: number }[];
    computed: true; computedAt: string;
  }[];
  protocols: {
    id: string; targetId: string; tool: string; version: string;
    runtime: string; scoringFunction: 'vina'; units: 'kcal/mol';
    seed: number; exhaustiveness: number; cpu: number; numModes: number;
    box: { center: [number,number,number]; size: [number,number,number] };
    boxSourceUrl: string; boxInputUrl: string; parameterNote: string;
  }[];
  provenance: Record<string,string>;
  notes: string[];
}
```

All local URLs start `/data/docking/`. Use `targetId` to join combinations to targets, not array order. The six distinct compound IDs are `15r`, `pamiparib`, `niraparib`, `rucaparib`, `apixaban`, `celecoxib`. Target IDs are `parp1-4r6e-chain-a`, `factor-xa-2p16`, `cox2-3ln1`.

### 3D scene integration

Use `receptorPdbqt` for the **exact executed receptor**. `receptorPdb` is the complete original RCSB experimental entry, which may have extra chains, waters, ligands and cofactors excluded from the prepared receptor. Receptors and poses retain their native Angstrom coordinates. When distributing proteins into one world, apply the same rigid transform to each protein and its associated ligand poses. Do not center each ligand independently. PDBQT poses contain multiple `MODEL` sections and `ATOM` or `HETATM` records. Default to model 1, with other saved models as alternatives. Rendered world positions or animation are illustrative, not molecular dynamics.

## Reproduce

Run from the project root:

```sh
# New target jobs, genuine Node/WASM Vina. No Python or native Vina needed.
for job in scripts/docking/jobs/*.json; do
  node scripts/docking/run-target.mjs "$job"
done
# Rebuild manifest from existing actual outputs; leaves results.json untouched.
node scripts/docking/build-multi-target.mjs
```

`run-target.mjs` reuses the existing `worker-bootstrap.mjs`, `vendor/vina.js`, `vendor/vina.worker.mjs` and `vendor/vina.wasm`. Exact runtime revision and WASM SHA-256 are in manifest `provenance`. Each new pose `.log` captures the serialized job, exact CLI parameters, Vina output and start/completion timestamps. Initial process stdout/stderr is additionally preserved in `scripts/docking/jobs/*.execution.log`. Scores are extracted from output files; the manifest builder rejects absent pose atoms, score remarks or affinity logs.

All protocols use seed **20260914**, CPU **1**, exhaustiveness **4**, and maximum **5 modes**. Published prepared-example box centers/sizes are retained. The published example seed/exhaustiveness are intentionally overridden. Box dimensions:

- PARP1: center `[-39, 5, -8]`, size `[15, 20, 14]`.
- Factor Xa: center `[7.48497143, 43.97488571, 62.17711429]`, size `[20, 20, 20]`.
- COX-2: center `[30.98857692, -22.28361538, -16.50723077]`, size `[20, 20, 20]`.

## Source and file inventory

Prepared PDBQT receptors, ligands and parameter files are from pinned Webina commit [`4230729e7dad197b4c77912dffe30c8bcdd492ba`](https://github.com/durrantlab/webina/tree/4230729e7dad197b4c77912dffe30c8bcdd492ba/docking_files/benchmarks). The original misspelling `3LN1_liganbd_celecoxib.pdbqt` is preserved. No local protonation or ligand generation was substituted. Input, output, log and runtime SHA-256 hashes are in the manifest. Molecular identity SMILES came from PubChem; connectivity SMILES may omit stereochemistry and are not the executed 3D input.

New files:

- `scripts/docking/run-target.mjs`, `scripts/docking/build-multi-target.mjs`.
- `scripts/docking/jobs/{cox2-3ln1--celecoxib,cox2-3ln1--niraparib,factor-xa-2p16--apixaban,factor-xa-2p16--niraparib}.{json,execution.log}`.
- `public/data/docking/multi-target.json`.
- `public/data/docking/inputs/2P16{.pdb,_docking_params.txt,_ligand_apixaban.pdbqt,_receptor_factor-Xa.pdbqt}`.
- `public/data/docking/inputs/3LN1{.pdb,_docking_params.txt,_liganbd_celecoxib.pdbqt,_receptor_COX-2.pdbqt}`.
- `public/data/docking/identities/{apixaban,celecoxib,2P16,2P16-entity-1,2P16-entity-2,3LN1,3LN1-entity-1}.json`.
- `public/data/docking/poses/{cox2-3ln1--celecoxib,cox2-3ln1--niraparib,factor-xa-2p16--apixaban,factor-xa-2p16--niraparib}.{pdbqt,log}`.
- This document.

Protein provenance: [2P16](https://www.rcsb.org/structure/2P16) is human coagulation factor Xa complexed with apixaban. [3LN1](https://www.rcsb.org/structure/3LN1) is **Mus musculus** prostaglandin G/H synthase 2, not human COX-2. Saved RCSB entry/entity JSON supports these identities. Full experimental PDBs came from `https://files.rcsb.org/download/{PDBID}.pdb`.

Limitations: rigid receptor, one seed, exploratory exhaustiveness, published preparation assumptions, no convergence assessment, no explicit solvent ensemble or receptor flexibility. These scores are neither experimental affinities nor predictions of fly neural activity.
