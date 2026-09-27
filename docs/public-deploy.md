# Public static deployment (drug.flybrain.kr on Vercel)

## What is deployed
`npm run build` → `dist/` (57 MB after pruning). Vite copies `public/` into `dist/`, then `scripts/postbuild-public.mjs` removes local-only data and adds `THIRD_PARTY_NOTICES.txt` + `LICENSE.txt`:
- removed: `data/records/` (767 MB of local assay archives), `data/flywire/` (CC BY-NC archive; nothing in the runtime fetches it), `data/learning/training-spikes.bin` (102 MB raw; UI now says "local project only").
- `.vercelignore` also keeps these plus `backups/ upstream/ references/ docs/ dist/ node_modules/ scripts/docking scripts/learning-data` out of the source upload.
- Largest served files: `data/malecns/connectome.bin.gz` 27 MB (engine already detects the gzip magic byte and only inflates when needed, so it works whether or not a CDN strips Content-Encoding), Mol* JS chunk, `data/docking` 9.7 MB.
- `vercel.json`: build `npm run build`, output `dist`, `cleanUrls:false`, 1 h revalidating cache for `/engine/*` and `/data/malecns/*`, immutable for hashed `/assets/*`, `X-Content-Type-Options: nosniff`. No COOP/COEP: the workers use plain ArrayBuffers (no SharedArrayBuffer) and Mol* loads cross-origin resources.

## Runtime behaviour on the public build
- **Public mode detection**: the app GETs `/api/docking/status`; a JSON `{status}` answer means the local assay server; anything else (Vercel's 404) sets public mode. Until the probe answers, the storage cap is applied (never bypassed by a race).
- Public mode UI: header line "Public build · drug.flybrain.kr · all brain steps are computed in your browser; nothing is uploaded"; "Save CNS records to project" is replaced by a disabled, honest note; the reward-learning panel (not mounted on the main page) no longer links the 102 MB training file.
- **Recording cap**: full-frame spike recording continues into IndexedDB until 500 MB of raw spike bytes; after that computation and display continue but frames are no longer stored, and a status line reports how many computed steps were not stored. Local build: unlimited.
- **Device-adaptive colony size**: `flyCountForDevice(hardwareConcurrency)` = floor(cores/2) clamped to 4..20, snapped down to {4,8,12,20} (e.g. 8 cores→4, 16→8, 24→12, 40+→20). Override via the "BRAINS" selector (stored in `localStorage['fddd.fly-count']`); changing it restarts the colony session. Every fly is still one full 167,122-neuron worker; nothing is shared or approximated. `MAX_FLY_COUNT=20` (`FLY_COUNT` alias kept).

## Cannot work statically (by design, disclosed in UI)
- Saving record archives to the project (`POST /api/records`), re-running Vina docking (`/api/docking/run`), retraining the readout (`/api/learning/run`).

## Not done here
- Vercel project creation / domain / Cloudflare DNS (parent session).

## Deployed 2026-09-15 (KST)
- Vercel project `flybrain-drug` (account sjkang89-1530), production alias https://flybrain-drug.vercel.app, custom domain https://drug.flybrain.kr (HTTPS 200 verified).
- Cloudflare zone flybrain.kr (free plan) created in Sjkang89@gmail.com's account; nameservers damon/phoenix.ns.cloudflare.com; imported apex/www A records (222.234.220.139, registrar parking, proxied) left as-is; `drug` CNAME → cname.vercel-dns.com, DNS only.
- Registrar ITEASY (아이티이지): nameservers changed from ns1/ns2.ksdom.kr to Cloudflare via mypage (email code verification), result 변경완료. Other domains in the account (flybrain.co.kr, toyz.kr, toyz.co.kr) untouched.
- Deployed via `npx vercel deploy --prod` from the project directory (no git repo, no push). `.vercel/` project link is in the project folder.
- Public build verified in browser: auto colony size 8 on this 16-core machine, brains computing, public-mode notices, disabled project-save button, connectome.bin.gz served as application/octet-stream (27,352,793 bytes, no content-encoding), engine inflates client-side.
