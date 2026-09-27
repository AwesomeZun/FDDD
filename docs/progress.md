# FDDD work in progress, 2026-09-14

User requests runnable demo inspired by https://github.com/cobanov/awesome-fly, with strategy in ChatGPT Chat mode 6PRO and implementation by Astra. Do not substitute own planning or model without disclosure. Finish build and browser verification, not just a plan.

## Planning
- Browser targetId 3979FED14466737893F0FF8789BB1549 was attached, New chat clicked, Chat selected and 6 Pro Power 5/5 verified through model menu.
- Prompt saved docs/chatgpt-planning-prompt.txt.
- Request accepted, visible user prompt matches FDDD. Title now FDDD 데모 명세 작성. Browser reports stale URL https://chatgpt.com/c/6aa69366-6a60-83ea-8c8d-a0aa647a9a09 (previous research profile), so DO NOT trust URL alone. Match title/prompt before interactions.
- Last 17:06:58Z response generating with Stop answering; intermediate says verify repository metadata/pins/files, select reduced sleep/hyperarousal phenotype, keep MaleCNS anatomical template separate from FlyWire IDs. Shows Pro thinking. Composer later changed to Instant without assistant switching; original request definitely submitted under 6 Pro. Do not resend or interrupt.
- Need capture final raw response (snapshot first; use inspected region innerText if needed), save docs/chatgpt-6pro-plan.md. Keep actual original plan in full. Then implement via Astra.

## Astra ready
- /Applications/Codex.app disappeared between listing and execution (possibly app update). Installed temporary CLI 0.154.0 at /Users/kang/.aside/u/0/sessions/2026-09-14_sdWyKQiTn6TaW3s0/tmp/codex-runner/node_modules/.bin/codex.
- Verified connection: codex exec --skip-git-repo-check -m gpt-6-astra -c model_reasoning_effort='"low"' -s read-only --ephemeral 'Reply only ASTRA_READY. Do not read files or run tools.' returned ASTRA_READY; log tmp/astra-check.log verifies model gpt-6-astra/provider openai.
- For implementation run same CLI exec -C project path --skip-git-repo-check -m gpt-6-astra -c model_reasoning_effort='"low"' -s workspace-write with prompt referencing full plan + docs/evidence-notes.md; preserve stdout log and final output. Background shell with log works. Existing ~/.codex config has hooks and loads many tokens; no need to inspect credentials. Do not change global config.
- User wants complete runnable locally verified demo, no public deploy authorized/required. Implementation source in project, deliver portable HTML/demo bundle under session artifacts; proof screenshot in tmp.

## Evidence
- docs/evidence-notes.md includes independently searched sleep papers and constraints, links. Critical: no real compounds ranked by made-up circuit gains; evidence cards vs synthetic intervention ranking separate. Need science-aware demonstrator, not fake drug discovery.
- Parallel agent report tmp/upstream-review.md had overclaims then corrected. Do NOT blindly copy; prioritize original sources and 6Pro plan.
- Primary repo pages independently read via webfetch: awesome-fly, Drosophila_brain_model, flyvis, connectome_interpreter. No code cloned/reused yet.

## Next
1. Retrieve finished 6 Pro plan once ready.
2. Launch Astra implementing polished runnable demo with reproducible scoring/controls, source/evidence disclosure, tests, responsive visuals, export. Synthetic fallback allowed only visibly labeled.
3. Independently run tests, inspect UI with browser snapshot, test controls/export/reset, screenshot, repair via Astra if needed.
4. Deliver link/artifact and concise limitations, update project MEMORY.md.

## 17:14Z newest state SUPERSEDES earlier plan

User clarified visuals/platform first, not actual discovery; actual fly-brain computation REQUIRED. Read docs/visual-direction.md final sections.
ChatGPT original run stopped to revise direction; then site reported workspace advanced usage exhausted, Pro menu disabled. 6Pro final plan BLOCKED, user informed, no payment. Do NOT keep polling ChatGPT. Actual conversation URL status subagent found https://chatgpt.com/c/6aa82897-7240-83ea-af8a-428b13ad480b (parent has stale URL bug).
Upstream cloned at upstream/flyjump commit c08c86bc18efd8125964b1d2ca4fc1df59700f30. Parent inspected license and connectome.ts: 3 iterations, leak .7 gain1.4 outputGain4, normalized signed leaky tanh. 80 cells/1296 edges measured topology; modeled dynamics. Flybody assets and atlas available; preserve licenses/linked credits.
Astra IMPLEMENTATION RUNNING background PID31447. CLI exec -C project -m gpt-6-astra -c model_reasoning_effort='"low"' -s workspace-write --add-dir session/artifacts --output-last-message session/tmp/astra-final.txt - < docs/astra-implementation-prompt.txt > session/tmp/astra-build.log. Log confirms implementing. DO NOT launch duplicate. Full paths use /Users/kang/.aside/u/0/sessions/2026-09-14_sdWyKQiTn6TaW3s0 prefix. Use status subagent for routine empty checks. Final tmp/astra-final.txt / docs/astra-result.md when done.
Next: independently npm test/build, start local Vite, browser snapshot/screenshots and interactive checks candidate/target/pause/reset/ablation/export. Request Astra repairs if needed through resume CLI (read help). Strong visuals required. Deliver functioning localhost and bundle artifact + screenshot proof. Source project, outputs artifacts, proof tmp. No public deploy. User already informed final 6Pro plan blocked but actual Astra implementation proceeding.

## 17:18Z recovery
First Astra run FAILED before reading/writing due nested macOS sandbox_apply Operation not permitted. No implementation existed. User informed. Relaunched same explicit task with -s danger-full-access (session itself already full filesystem; no approval bypass flag) to avoid unsupported nested sandbox. NEW PID34474, logs tmp/astra-build-v2.log, final tmp/astra-final-v2.txt. Do not mistake old final.txt for success/new completion. Need verify v2 tools actually succeed; initial log only acknowledged task. All other directions unchanged.

## 17:25Z implementation in progress
Status worker erroneously called v2 BLOCKED by looking at OLD v1 final despite instructions. Parent directly checked contradiction: v2 log successful writes; no final-v2 exists yet. Astra says actual circuit/controls/export wired, now styling/testing. Root src exists, CSS not yet created at check. DO NOT restart while working. Potential review points when done: BrainScene WebGL constructor upstream has no try/catch (LabScene does); candidate row ranking uses latest stateful sequence outputs so labels must be demo priority not assay efficacy. Real connectome.ts is correctly adapted with disconnected/silenced controls. LabScene uses actual Flybody mesh scale5.5; protein/ligand illustrative procedural geometry. Wait for current agent completion then browser review.

## 17:32Z independent validation
Parent ran /Users/kang/.local/bin/node --experimental-strip-types --test tests/*.test.ts: ALL 5 PASS (graph hash/notices, deterministic full run, input/disconnection sensitivity, actual descending readout dependence, export). Benchmark 5000 steps x3 conditions total174.767ms mean .03495ms p95 .07825ms; delta30.62; actions HOLD REVIEW SCAN. This validates real computation, not efficacy. Astra still solving npm/build native esbuild SIGKILL + ENOTEMPTY issues, modified scripts to node paths/rollup wasm and esbuild-wasm. Do not concurrent install. Parent tsc attempt failed missing typescript while agent changing node_modules. User informed tests passed, web build compatibility pending. Status workers have produced incorrect stale log summaries; verify actual final-v2 and project files before believing completion/blocker. No browser preview yet.

## Four-fly colony update
Completed cute original four-avatar rendering, four independent full139255-cell workers, four colored brain portraits, selected-only silencing/disconnection, v4 per-fly export records. Build and8tests pass; browser verifies one fly silenced while remaining3active. See docs/colony-browser-qa.md and original-behavior-map.md. Production localhost:5174 left running allbaseline; artifact fddd-four-fly-colony.zip supersedes single-fly delivery. Upstream10behavior policies are documented, not all ported. Binding remains separate proposed computation, not a claimed result.

## Final reward studio delivery
Local5177 is canonical. Real DOCKSTRING-trained readout, heldout live tests, Mol*5.11 structure viewer, high-contrast3D inspectors, full-cell recordings and BindingDB/DailyMed evidence integrated. Browser retraining complete,17/17 tests/build pass,6144 training-frame popcounts verified. Latest package fddd-reward-studio.zip. See reward-studio-qa.md and README. DiffDock remains explicitly blocked, no output fabricated. Molecular-only baseline outperforms neural readout; no brain-superiority or physiological feeding claim.

## Continuous habitat revision
User corrected the finite assay/static scene: wanted4flies continuously roaming one shared3D molecular space,2brains each side, reference-video-like dynamic activity, attractive simple insect design and multiple real proteins/ligands. Implemented auto-running4fullgraph workers, online score-reward candidate preference, score-free inputs, surface orbits, geometric residence, full spike/position records. Real8Vina combinations across3targets/6molecules. New25tests pass, build passes;13exported segments/12572full frames all verified. Source and coordinates preserved; fixed COX-2 interleavedchain visualization. Latest package fddd-continuous-habitat.zip; local5177. MaleCNSbrain+VNC public availability confirmed but current runtime remains femaleFlyWirebrain only. See habitat-qa.md and cns-data-scope.md.
