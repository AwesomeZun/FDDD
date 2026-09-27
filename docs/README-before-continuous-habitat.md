# FDDD · Molecular reward-learning studio

Local noncommercial research demo. Real docking, full measured-connectome computation, a genuinely trained appetitive readout, and explicit held-out evaluation. No claim of biological drug discovery or superiority over standard ML.

## Run

Node22+ recommended; verified with Node26.5. From this directory:

```sh
npm install
npm run build
npm run serve
```

Open http://localhost:5177/. Use the included Node server, not just a static preview, for Re-dock, Train readout again, and server-side record copies. PORT can override the default.

## What to try

1. Inspect the actual4R6E PARP1 structure and calculated Vina poses in Mol*5.11.
2. Inspect compounds: four simple3D inspectors, saturated identity accents, actual multi-color neural activity and true3D output trajectories.
3. Run4unseen molecules: the frozen model sees molecular inputs only. All139255 neurons run live for16 steps per molecule. Appetitive readout drives an explicitly illustrative proboscis response.
4. Reveal held-out answers after inference; incorrect rankings remain visible.
5. Export brain records: lossless spike flags for every cell at each computed step, molecular/brain identity, time, rootID mapping and protocol. IndexedDB stores the run; the Node server also saves exported ZIPs under public/data/records/.
6. Train readout again actually reruns training; it is not a training animation. Re-dock locally actually runs AutoDock Vina1.2.3/Webina WASM.

## Data and honest results

- DOCKSTRING PARP1:2400 source-backed compounds, official structure-cluster split1600/400/400. The reproducible lightweight model trains on256, validates64, tests64. More negative docking scores imply greater training reward.
- Fixed fullFlyWire graph139255 cells/2698236 weighted edges. Only268-feature appetitive readout weights learn. This is not native feeding-circuit plasticity or a physiological drug-response model.
- Heldout Spearman0.659; molecular-only baseline0.786 is better. The source benchmark is outcome-stratified, so no population hit-rate or affinity calibration claim.
- Training feature-generation spikes:6144 complete cell-state firing frames,106948608bytes, validated popcounts. Membrane voltages are not recorded.
- Separate localVina run: realPARP1/4R6E and15R, pamiparib, niraparib, rucaparib. DOCKSTRING has a different docking protocol and numerical scales are not pooled.
- BindingDB reference:7311 filteredPARP1 experimental endpoints, kept separate byKi/Kd/IC50/EC50. DailyMed provides the displayed humanPK values. PK is not PARP1affinity or an efficacy ranking.
- DiffDock official demo is blocked (RUNTIME_ERROR/503); no DiffDock result is fabricated. Boltz2 is researched but not executed. Mol* displays actual crystal coordinates, not an AlphaFold prediction.

## Reproduce and verify

```sh
node scripts/docking/run-all.mjs
node --experimental-strip-types scripts/train-reward.mjs
node scripts/verify-training-record.mjs
npm test
```

See docs/learning-data.md, docs/reward-learning.md, docs/docking-methods.md, docs/reward-studio-qa.md and docs/diffdock-status.md. Public source URLs, hashes, structures, rawdocking logs, weights, splitIDs, controls and predictions are bundled. The record binary indexes sorted-engine neuron positions; map via training-sorted-to-original.json then /data/flywire/root-ids.json.

## Licensing and reference images

FlyWire data CC BY-NC4.0: noncommercial only; code licenses do not grant commercial data rights. Preserve LICENSE, THIRD_PARTY_NOTICES.md and all bundlednotices. Mol*MIT; Vina/Webina and DOCKSTRING notices preserved. Archived Flybody assets remain Apache2.0 but are not used by current simple avatars.

Built with [fly-connectome-template](https://github.com/cobanov/fly-connectome-template) by [Mert Cobanov](https://github.com/cobanov). Cobanov Template Attribution License1.0 applies.

The three original user design references remain in references/design/. They are references, not licensed reusable product artwork; do not copy their layouts.
