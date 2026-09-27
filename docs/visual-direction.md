# User-supplied visual references

User attached three images after initiating the demo task, without further text. All three read using read_file. Interpret as visual direction for FDDD, not a request to build trading functionality.

Attachments (read-only):
- /Users/kang/.aside/u/0/sessions/2026-09-14_sdWyKQiTn6TaW3s0/attachments/image.png
- /Users/kang/.aside/u/0/sessions/2026-09-14_sdWyKQiTn6TaW3s0/attachments/image-2c792a14-42da-44fb-928a-ffa07e86cc59.png
- /Users/kang/.aside/u/0/sessions/2026-09-14_sdWyKQiTn6TaW3s0/attachments/image-bcfbdada-57a8-4fd2-80aa-77325b3422a0.png

Design synthesis:
- Image 1 ODONATA: near-black elegant instrument-like layout; big 3D insect chamber on left, four colored brain point-cloud panels right; fine technical lines; muted cyan, gold, lavender, pale green. Insect resembles dragonfly, NOT a fruit fly. Use fruit-fly anatomy in our own scene, do not copy dragonfly.
- Image 2 SHERWOOD: dense instrument dashboard; large 3D fly scene upper left, live point-cloud connectome upper right, charts/logs beneath; neon lime highlights, mono telemetry.
- Image 3 FLY/EXCHANGE: Korean labels; dark olive-black panels; top KPI strip; three columns (fly, brain, intervention/control); bottom traces and state metrics; lime/cyan/cream highlights.

Implement an original polished research-lab UI combining cinematic fly + connectome scene and dense, readable functional dashboard. Main hero should not be only text/cards. Desired: 3D orbitable fruit fly with local procedural geometry if no licensed assets, brain point-cloud or graph and time traces, candidate/intervention list, baseline/perturbation/rescue controls, arousal/motor/suppression controls, evidence sidebar, reproducibility/exports. Replace all trading/token elements with scientific controls/results. No financial functions. Distinguish actual biological data vs procedural illustrative anatomy vs synthetic simulation at panel level. Animation must either reflect simulation state or be explicitly illustrative, not fake real telemetry. Numeric counts must reflect actual loaded/simulated/displayed nodes, not copied 139255 neuron claims. No unlicensed copied logos/assets.

Include these requirements in Astra implementation prompt alongside the 6Pro plan and evidence notes. If worker already started, send as design update. User has been told these references will be incorporated.

## Explicit user clarification (highest-priority product direction)

User: "시각적으로는 이런 느낌으로, 단백질 결합, 신약 후보물질 성능 평가 등을 파리가 하는 느낌. 대시보드도 만들어보자."

Build a 'fly-operated drug discovery laboratory', not merely sleep charts. Hero: 3D fruit fly appearing to operate a molecular assay station, examine protein and candidate molecule. Functional dashboard must include protein/ligand binding view (structure, pocket, pose); candidate performance comparison (binding evidence or genuine computed metric, phenotype rescue proxy, toxicity evidence/proxy explicitly differentiated), neural response/control comparison, experiment workflow/logs. Selecting a candidate should coordinate the molecular scene, neural activity and result panels. Keep sleep/hyperarousal as first assay if still appropriate, but add molecular binding layer to the 6Pro specification via follow-up before Astra implementation.

Scientific boundaries: if no docking engine actually executed, never show fabricated kcal/mol as docking results, Kd/IC50 as measured values, or claim actual binding. Use an explicitly illustrative binding scene with real sourced protein if feasible, evidence-backed affinity with assay context when available, and 'not computed' for missing metrics. Synthetic molecule poses/gains only under explicit illustrative/synthetic labels. The fly is a visual operator/metaphor; do not claim its connectome itself calculates molecular binding without a validated mapping.

Assistant acknowledged exact feature direction, so deliver all panels, not just a card-based sleep demo. Need send this change to ChatGPT for a short architecture addendum and then Astra with image refs.

## Latest user priority correction: PLATFORM AND VISUALIZATION FIRST

User explicitly clarified: "실제 약을 찾으라는게 아니고, 저런 플랫폼, 그리고 시각화가 가장 중요해."

This supersedes research-heavy MVP prioritization. Deliver a visually outstanding interactive platform prototype, NOT actual drug discovery, NOT literature/validation project. Synthetic demo data is acceptable; use a concise global 'Demo / simulated data' label, avoid drowning visual UI in disclaimers/evidence cards. Do not delay implementation to obtain real docking, biological evidence, or extensive scientific validation. Keep underlying honesty but primary effort: cinematic 3D fruit fly scientist/operator, animated protein-ligand scene, glowing brain point cloud, responsive coordinated candidate screening dashboard, charts, ranking, pipeline, polished controls and motion. Multiple sample candidates and targets supported by mock data; no need to constrain product to sleep/hyperarousal. The user specifically corrected assistant overemphasis on real drug finding. Tell ChatGPT follow-up to reframe plan into visualization-first product prototype; use Astra to implement this, not an academic assay report.

## Latest clarification: actual upstream fly-brain computation REQUIRED

User: "Fly brain을 활용하는 방식은 다른 레포들에서 가져와야겠지. 실제로."

Do NOT interpret visualization-first as permission to fake brain computation. Requirements jointly: (1) polished platform/visualization, not actual drug discovery; (2) REAL fly-brain use adapted from linked repositories. Inspect and reuse a practical upstream connectome-derived graph and runtime/controller methodology, respecting licenses, pinned revision and provenance. A small real circuit subset is acceptable if explicit; entirely procedural/synthetic brain cannot be the only computation. Feed demo candidate feature vectors/stimuli through that actual connectome-based circuit and use computed outputs to drive the platform's screening/exploration behavior, comparison/ranking and neural visualization. Feature→input and output→platform-action mappings are authored demo policies, not biological drug action. Protein binding scene can be illustrative/demo; do not claim fly connectome predicts molecular affinity. Upstream license/source/version and actual retained node/edge counts must be available in Methods/About. Need CPU/browser performance benchmark, baseline/input perturbation and circuit-disconnection controls to demonstrate outputs actually depend on loaded circuit; report negative result honestly if controls show no meaningful difference. Good candidates to inspect include cobanov/flyjump fixed 80-neuron MaleCNS circuit and trained readout, dzhng/fly-escape selected MaleCNS WASM, snedea/flybrain FlyWire browser LIF, or philshiu model subset. Pick based on verified data availability/license and transparent adaptation. Do not overburden main UI with scientific caveats, but preserve this reality boundary.
