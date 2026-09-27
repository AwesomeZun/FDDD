# Actual connectome-conditioned reward learning

## What is implemented

A real trained appetitive **readout** consumes response features from the entire measured FlyWire LIF graph. All139,255 cell states and applicable weighted edges are computed for each of16 steps per compound. The connectome weights remain FIXED. Only the268-feature sigmoid readout weights and bias are plastic. This is supervised reward imitation / an engineered reward-prediction-error update, NOT a biologically validated feeding circuit, natural chemoreceptor encoding, whole-brain synaptic learning, or autonomous reinforcement-learning environment.

Real data: DOCKSTRING PARP1 dataset, Figshare DOI10.6084/m9.figshare.16511577.v1, docking scores rather than measured affinity. Dataset/source split details live in docs/learning-data.md and public/data/learning/audit.json. Existing cluster-disjoint split is retained. Within each split, a fixed-seed ID-ordered shuffle selects256 train,64 validation,64 test compounds from the larger curated dataset. No performance-based sample selection occurs.

## Input and learning protocol

1. Canonical SMILES token descriptors and a128-bin hashed token1–3gram representation provide label-free chemical encoding. It is intentionally simple and is not a chemical-receptor model or RDKit Morgan fingerprint.
2. Four authored sensory phases, four LIF steps each. Each phase uses8 bounded channels; docking scores never enter the encoder, circuit, or inference API.
3. For each phase, mean spike fraction in each of61 anatomical groups plus6 downstream rate bins gives67 features. Four phases yield268 features. All group counts originate from the actual full graph computation.
4. Training-only docking-score empirical ranks define food-reward targets, with more negative scores giving higher reward. Test/validation labels do not define normalization. Feature means/scales are training-only.
5. Online delta update: weight += rate*(reward-sigmoid(readout))*normalizedFeature, with L2=.002. Learning rates .002/.008/.02 and epochs1–100 are selected by validation MAE. Test is evaluated once after selection. Selected rate .008, epoch4 in this run.
6. Controls: constant untrained readout, seeded random readout, shuffled training reward labels (same validation selection protocol), and a molecular-token-only model without connectome features.

## Actual heldout results (64 compounds)

| Model | Spearman | Reward MAE | Top-quartile precision | Enrichment factor |
|---|---:|---:|---:|---:|
| Trained neural readout |0.658708|0.182877|0.4375|1.75|
| Untrained constant |0|0.251556|0.1875|0.75|
| Random readout |-0.375940|0.255095|0.0625|0.25|
| Shuffled-label control |0.359051|0.233206|0.3125|1.25|
| Molecular-only baseline |0.785633|0.145793|0.6875|2.75|

The trained neural readout improves on these untrained/shuffled controls but **does not beat the molecular-only baseline**. It would be incorrect to claim that a fly brain is superior to conventional molecular ML. Only one seed and a small test sample were evaluated. Source sampling is score-stratified; these enrichment metrics describe this benchmark sample, not prospective library hit discovery. No experimental affinity, efficacy, selectivity, or pharmacokinetic prediction is established.

## Artifacts and UI contract

- `src/lib/rewardLearning.ts`: `chemicalFeatures(smiles)`, `chemicalSensory(smiles, phase)`, `aggregateCircuitFeatures(steps, groupSizes)`, `predictFeeding(model, features)`, `rewardForScore`, `rankCorrelation`, `NEURAL_STEPS=16`.
- `public/data/learning/model.json`: trained268 weights, bias, training-only normalization, reference reward scores, group sizes, split IDs, source/dataset/graph hashes and metrics.
- `public/data/learning/training-result.json`: actual computed training curves, controls, and per-compound cached neural response features,16-step total spike traces and frozen predictions. Ground-truth labels are isolated under `evaluationOnly`. UI must not use those labels to generate a heldout feeding response.
- Inference: `predictFeeding(model, row.neuralFeatures)` returns0–1 learned response. Cached rows are actual precomputed circuit trials, not a new live trial; label them accordingly. For a fresh live trial, reset the full engine, call `chemicalSensory(smiles, Math.floor(t/4))` for t0..15, collect groupSpikeCounts/motorRates, then aggregate and predict. Do not substitute arbitrary motion/feeding intensity from the docking score.
- Training feature generation now additionally records every cell's spike flag at every circuit step: training-spikes.bin (6,144 frames,106,948,608 bytes), training-spike-frames.jsonl and training-sorted-to-original.json. All frame popcounts are verified by scripts/verify-training-record.mjs. The existing browser recorder separately captures full-cell live trial spikes. Membrane potentials are not retained.

Reproduce: `node --experimental-strip-types scripts/train-reward.mjs` from project root. No external ML service or Python runtime needed. `node --experimental-strip-types --test tests/reward-learning.test.ts`:5/5 pass. Source uses actual bundled full graph and real downloaded dataset; no synthetic training labels or fallback success are substituted.
