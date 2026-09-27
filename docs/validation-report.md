# FDDD v1.0.0 validation report

Executed 2026-09-14 in this workspace, Node v22.22.3, macOS arm64.

- `npm run typecheck`: PASS.
- `npm run build`: PASS; Vite 6.1.0, 37 transformed modules, production build 1.25 s. JS 812.80 kB / 221.09 kB gzip; CSS 14.01 kB / 3.93 kB gzip. Vite warns about the >500 kB Three.js-containing chunk; this is a load-size limitation, not a failed build.
- `npm test`: PASS 5/5; test runner total 111.642 ms. Validates graph counts/contact count and exact SHA256; seeded full-run state determinism; input sensitivity and disconnected/silenced conditions; descending-output/readout dependence and multiple actions; finite priorities and JSON/CSV export structure.
- `npm run benchmark`: 5,000 steps after 500 warm-up steps, three circuit conditions per step. Total 180.296875 ms; mean 0.036059375 ms; p50 internal compute 0.028917 ms; p95 0.082167 ms. CPU recurrence timing only: excludes browser rendering, GPU and UI. Maximum baseline–disconnected priority difference 30.6209725. Observed actions HOLD, REVIEW, SCAN; ADVANCE did not occur in this benchmark. No superiority conclusion follows.
- Local Vite HTTP endpoint returned 200.
- Playwright browser QA attempted with cached Chromium 1228 and installed Google Chrome. Both launch processes closed immediately (`browserType.launch: Target page, context or browser has been closed`). No screenshot or browser interaction pass is claimed. `scripts/browser-qa.mjs` is provided for supervisor execution with `CHROME_PATH` override; it covers desktop/mobile, start/pause/reset, step, condition, candidate, target, JSON download and methods dialog. Visual composition, WebGL rendering, orbit behavior, responsive overflow and download UI still require that browser review.

Build portability: native Rollup/esbuild initially stalled in this runtime, so package overrides use WASM equivalents and .npmrc disables optional native modules/install scripts. Final build and test commands above succeeded. No public deployment or git push.
