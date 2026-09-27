# Independently checked evidence notes

Read 2026-09-14. These support evidence cards, NOT numeric pharmacology parameters or efficacy rankings.

- Caffeine promotes wakefulness via dopamine signaling in Drosophila (Scientific Reports 2016): https://www.nature.com/articles/srep20938 . Reports nighttime sleep loss and dopamine synthesis/PAM dependency; do not equate human adenosine receptor pharmacology with fly receptor mapping.
- Wu et al. 2009: https://www.jneurosci.org/content/29/35/11029 . Caffeine fragments sleep, reduces arousal threshold; PKA dependence but not the known adenosine receptor.
- Nutrition Influences Caffeine-Mediated Sleep Loss in Drosophila (2017): https://pubmed.ncbi.nlm.nih.gov/29029291/ . Food intake and sucrose context confound caffeine sleep assays. Include feeding control in validation roadmap.
- Sleep-Dependent Modulation of Metabolic Rate in Drosophila (2017): https://academic.oup.com/sleep/article/40/8/zsx084/3852476 . Reports gaboxadol-associated increased daytime sleep and reduced metabolic rate. Evidence of fly phenotype, not calibrated receptor occupancy nor human therapeutic effect.
- Experimentally induced active and quiet sleep engage non-overlapping transcriptomes in Drosophila, reviewed preprint v1 (2023): https://elifesciences.org/reviewed-preprints/88198v1 . THIP and dFB activation produce distinct brain activity/transcriptome effects. Version explicitly a reviewed preprint; do not label as final publication.
- A Dynamic Deep Sleep Stage in Drosophila (2013): https://www.jneurosci.org/content/33/16/6917 . Sleep/arousal must be distinguished from simple immobility, using responsiveness and other criteria.

## Constraints

No source above supports assigning a real compound a precise synthetic network gain, EC50, brain exposure, or clinical efficacy. Keep evidence cards separate from synthetic intervention ranking. Neurotransmitter identity is NOT postsynaptic receptor expression. Orthology alone is NOT conserved binding or action. No simulated score should be labeled probability of drug success.

## Repository evidence

- https://github.com/philshiu/Drosophila_brain_model : activation/silencing LIF model; default FlyWire v630, alternate v783 configuration. Optogenetic stimulation is not drug pharmacology.
- https://github.com/YijieYin/connectome_interpreter : effective connectivity, path finding and differentiable firing-rate model. README reports laptop-friendly analyses, not proof of this project's drug inference.
- https://github.com/TuragaLab/flyvis : task-optimized visual-system models, not a sleep/whole-brain pharmacology model.
- https://github.com/cobanov/awesome-fly : curated list. Its CC0 license does not relicense upstream datasets, code or artwork.
- Do NOT use preliminary upstream-review.md's blanket 'all MIT' / 'production-ready' claims. Dataset-specific licenses require separate checks.
