# Real public docking-score learning dataset

## Delivered

`public/data/learning/dataset.json` contains **2,400 real DOCKSTRING molecules and published PARP1 docking scores**, not fabricated labels and not scores recalculated by this demo. Contract: `source`, `target`, `scoreType`, `units`, `sampling`, `compounds[{id,inchikey,smiles,score,cluster,originalSplit,sourceRow,split}]`.

- Train:1,600 molecules,938 official chemical clusters.
- Validation:400 molecules,272 clusters.
- Test:400 molecules,400 clusters.
- Zero cluster overlap between partitions; zero full InChIKey duplicates; zero InChIKey connectivity-layer duplicates.
- All source identity/SMILES joins verified; every score is from the original PARP1 column. Original source row numbers retained.
- Input is SMILES only (or features derived exclusively from SMILES). `score`, split/group/source identifiers MUST NOT become chemical features. During held-out prediction, do not inject target score or reward.

## Immutable source and licensing

Official website https://dockstring.github.io/ points to Figshare article16511577/version1:

- DOI https://doi.org/10.6084/m9.figshare.16511577.v1
- Score table file35948138: https://ndownloader.figshare.com/files/35948138
- Official cluster split file35948123: https://ndownloader.figshare.com/files/35948123
- Score TSV99,384,215 bytes, official MD5 `d0553abd8563bfbbe862eb1d7ec6be6d`.
- Split TSV25,023,533 bytes, official MD5 `46660336fbc138d5429c3137f081a423`.
- Both MD5 hashes matched downloaded bytes. SHA256 hashes are in dataset.source.hashes.
- Figshare metadata declares **Apache2.0**. Original metadata is preserved in `figshare-release.json`, license text in `LICENSE-APACHE-2.0.txt`.
- Citation: García-Ortegón et al., DOCKSTRING: Easy Molecular Docking Yields Better Benchmarks for Ligand Design, JCIM62(15),3486–3502(2022), DOI10.1021/acs.jcim.1c01334.

Source full dataset:260,155 molecules. Published release includes scores for58targets, includingPARP1. Official split contains221,274train and38,881test molecules,51,557clusters; no cluster crosses original splits. No need to regenerate fingerprints or claim a new scaffold calculation.

## Split and subset protocol

1. Verify official MD5 hashes before parsing.
2. Join score and cluster tables on full InChIKey and exact source SMILES.
3. Deterministically select one representative per first14characters of InChIKey (connectivity layer), using seededSHA256 identity ranking. This is stricter than exact identity deduplication and suppresses alternate-stereoisomer duplication.
4. Preserve original official test clusters. Assign whole original training clusters to validation when seeded cluster hash modulo5 equals0; remaining training clusters stay training. Seed20260914.
5. Compute10score-bin cutpoints from final training pool only.
6. Within each split/bin, choose compounds by SHA256(seed,identity), with160train/40validation/40test perbin. This is a predeclared balanced-score benchmark, not performance-driven cherry-picking.
7. Verify no final cross-split clusters or duplicate connectivity. Preserve chosen rows in `subset-source.tsv`, audit counts/ranges/hashes in `audit.json`.

**Important limitations:** This is the released DOCKSTRING **structure-cluster split**, NOT a newly computed Bemis–Murcko scaffold split. Similarity between different clusters is not guaranteed to be zero. Stratifying the held-out subset by score makes ranking/association evaluation meaningful across the score range, but changes the population distribution: do not present class prevalence, calibration, hit rates or enrichment as population-estimated performance without correction. Do not tune after inspecting the test labels. Validation is available for design choices.

## Docking score is not experimental affinity

Scores are in kcal/mol; lower/more negative is favorable under this docking protocol. They are not measuredKd,Ki,IC50, validatedfreeenergy or clinical efficacy. A learned feeding response is a supervised/reward-trained surrogate for **published docking score**, not a demonstrated biological ability of flies to measure affinity. The current fullFlyWireLIF graph does not automatically learn merely because scores are fed to it; learning and held-out tests must actually be implemented and logged by the parent model work.

## Do not mix two PARP1 protocols

The existing four-compound Webina demo uses PDB4R6E, Vina1.2.3, box[-39,5,-8]/[15,20,14]. DOCKSTRING distributes a different PARP1 target and box centered[26.835,11.332,27.744], size[30,30,30]. **Do not pool their labels or show the four-compound demo as held-out validation of DOCKSTRING calibration.**

For visualization/reference, `PARP1_target.pdbqt` and `PARP1_conf.txt` were saved from the DOCKSTRING repository pinned at commit`b5398322da8864fc6ac54061582db0850483a309` (2025-10-06). Provenance is in `target-provenance.json`. This is the currently distributed target at a pinned revision; exact identity with the 2022 scoring input was not independently certified. No experimental PDB ID is inferred from its stripped preparedPDBQT.

## Reproduction

```sh
bash scripts/learning-data/download-and-build.sh
# Or use already downloaded immutable TSVs:
node scripts/learning-data/build.mjs --cache /absolute/folder/with/the/two/tsvs
```

Uses only Node core APIs and curl. No Python/nativeRDKit dependency, no numerical affinity synthesis. Full source TSVs were downloaded to sessiontmp to avoid adding125MB to the deliverable; the compact source subset and pinned download/checksum instructions are permanent.
