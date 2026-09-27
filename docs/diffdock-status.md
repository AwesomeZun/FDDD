# DiffDock-L execution status

Checked: 2026-09-14T19:08:41Z

## Result: [blocked] official public demo unavailable

Requested calculation: one DiffDock-L pose prediction for public PARP1 chain A from PDB 4R6E with niraparib, alongside the separate Vina work.

**No inference job was submitted or executed. No DiffDock pose, confidence score, or affinity result exists from this check.** No inputs were uploaded, no account was used, and no paid resources or local GPU stack were installed.

The official repository explicitly links this Hugging Face Space and says the default repository model is DiffDock-L (February 2024 update):
- https://github.com/gcorso/DiffDock
- https://huggingface.co/spaces/reginabarzilaygroup/DiffDock-Web

## Direct evidence

1. The demo page displayed `runtime error`, `Scheduling failure: unable to schedule`, and `Container logs: Failed to retrieve error logs: SSE is not enabled`.
2. Official Space metadata API returned runtime stage `RUNTIME_ERROR`, errorMessage `Scheduling failure: unable to schedule`, current hardware `null`, requested hardware `t4-small`, and one requested replica.
3. The hosted application's `/config` endpoint returned HTTP **503**. Therefore no usable inference API was available through this official deployment.

Saved evidence (relative to repository root):
- `public/data/diffdock/official-demo-runtime-error.png`
- `public/data/diffdock/space-api-status.json`
- `public/data/diffdock/demo-config-headers.txt`
- `public/data/diffdock/demo-config-response.txt`
- `public/data/diffdock/space-Dockerfile.txt`

API source: https://huggingface.co/api/spaces/reginabarzilaygroup/DiffDock-Web

Application endpoint: https://reginabarzilaygroup-diffdock-web.hf.space/config

Dockerfile source: https://huggingface.co/spaces/reginabarzilaygroup/DiffDock-Web/raw/main/Dockerfile

## Version caveat

The Space repository SHA reported by the API was `d134c1dd0cabde8478b80aceb22d09355d30c675`. This is **not a verified inference-engine or model-weights version**. Its Dockerfile uses the unpinned image `FROM rbgcsail/diffdock`. The exact running DiffDock commit, image digest and weights could not be established because the service was unavailable. Do not label this as a completed DiffDock-L run.

## Scientific interpretation and next step

DiffDock confidence measures predicted pose quality, **not binding affinity**, and is not interchangeable with Vina's docking score. The official README explicitly states DiffDock does not predict binding affinity.

The smallest next step is for the official demo operator to restore the failed deployment, then submit one calculation using a protein-only chain-A PDB extracted from the existing public 4R6E structure and the verified niraparib identity. DiffDock accepts protein PDB, not the prepared Vina PDBQT receptor. Only then should actual output SDF coordinates and confidence be added to the visualization. Retain exact inference settings and model/image provenance if the restored service exposes them.

This was a bounded availability/execution check, not a local installation attempt. No UI, libraries, packages or other project files were edited.
