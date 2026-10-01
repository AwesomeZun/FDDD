# FDDD Motion Showreel

**English · v1.1.0 · 15-second and 30-second cuts** | [Korean v1.0.0](README.ko.v1.0.0.md)

A motion graphics showreel for [FDDD](https://github.com/AwesomeZun/FDDD) ([live demo](https://flybrain.kr/en)). The brain geometry, spike recordings, connectivity, protein structures, and docking scores come from FDDD data and engine computations. A self-contained HTML player is the source for frame-by-frame MP4 rendering at 60 fps.

## Watch

Open **[the English HTML player](dist/fddd-showreel-en-v1.1.0.html)** locally. It embeds its fonts, data, and synthesized soundtrack and supports both cuts, scrubbing, and keyboard controls:

- **Space:** play or pause
- **Left / Right:** move one frame
- **Shift + Left / Right:** move one second
- **1 / 2:** select the 15-second or 30-second cut

The repository includes the HTML player and English cover images. MP4 exports are generated locally under `dist/` and are excluded from Git. The original Korean exports remain available in the same local directory.

| Local output in `dist/` | Description |
| --- | --- |
| `fddd-showreel-30s-en-v1.1.0.mp4` | 30-second master: 1920 × 1080, 60 fps, H.264 High, Apple AAC VBR, audio normalized toward −14 LUFS, embedded cover |
| `fddd-showreel-15s-en-v1.1.0.mp4` | 15-second master, independently edited to eight bars rather than trimmed from the longer cut |
| `fddd-showreel-30s-en-share-v1.1.0.mp4` | Lightweight 30-second sharing copy, with a 10 Mbps video bitrate ceiling and embedded cover |
| `fddd-showreel-15s-en-share-v1.1.0.mp4` | Lightweight 15-second sharing copy with embedded cover |
| `fddd-showreel-en-v1.1.0.html` | Self-contained English player, including both cuts and the soundtrack |
| `thumbnails/*-en-cover-1920x1080-v1.1.0.*` | English covers with play icon and duration badge |
| `thumbnails/*-en-share-1200x630-v1.1.0.*` | English link-sharing cards |

The README preview is [`../docs/assets/fddd-showreel-15s-en-v1.1.0.webp`](../docs/assets/fddd-showreel-15s-en-v1.1.0.webp). It is an animated, silent preview of the short cut.

### Covers and previews

- MP4 files contain a cover image (`covr` / `attached_pic`) for players that support it.
- Frame zero is a poster composition for services that use the first video frame. The animation opens by breaking that poster into slices.
- The 1200 × 630 JPEG cards can be used as `og:image` assets when publishing a link.

## Edit and timing

The soundtrack runs at **128 BPM**; one bar is **1.875 seconds**. `src/edl.json` defines scene boundaries and musical sections. Video and audio use the same event lists in `data/events_*.json`. The English edition keeps the original timing, computation recordings, and soundtrack.

| 30-second cut | 15-second cut | Scene | Content | Transition |
| --- | --- | --- | --- | --- |
| 0–3.75 | 0–1.88 | One neuron | Poster → slices → a glowing neuron → zoom out and count to 167,122 | — |
| 3.75–7.5 | 1.88–3.75 | Connectome | 140,024 measured soma locations, computed spikes, anatomical callouts, and 6,241,236 connections | Flash |
| 7.5–11.25 | 3.75–5.63 | 20 brains | Spike-recording tile wall with individual names, steps, and spike counts | Match cut |
| 11.25–15 | 5.63–7.5 | Real docking | PARP1 (4R6E) ribbon and the 15R ligand in its top-ranked Vina pose | Whip |
| 15–18.75 | 7.5–9.38 | Score and reward | −13.09 kcal/mol impact → eight-combination ranking → reward conversion | Impact |
| 18.75–22.5 | 9.38–11.25 | Stay or leave | flybody mesh moving through molecular habitats; learned preference and decoded motor output | Zoom |
| 22.5–26.25 | — | Learning loop | Five cards containing data-driven miniature visuals, then a continuous loop | Glitch |
| 26.25–28.13 | 11.25–13.13 | Principles | Real docking scores. Real spikes. Nothing faked. | Strobe |
| 28.13–30 | 13.13–15 | FDDD | Neuron positions morph into the FDDD logo while recorded spikes continue | Flash |

## Data, computation, and animation

The showreel uses recorded computations. Playing the HTML or video does not launch the full FDDD simulation; the [live demo](https://flybrain.kr/en) runs neural computation in the visitor's browser.

### Source data and computed values

- **Brain point cloud:** 140,024 measured soma positions from MaleCNS v1.0 (`public/data/brain-atlas`). This is the showreel atlas; the live demo uses a smaller display sample.
- **Spikes:** recorded by running FDDD's MaleCNS leaky integrate-and-fire (LIF) engine (`public/engine/malecns/core.js`) in Node with `build/sim.mjs`. Each step computes all 167,122 selected neurons and 6,241,236 connections. The hero recording contains 192 steps; each of the other 19 tiles contains 60 steps with a different seed.
- **Activity panels:** spike counts, regional firing rates, and decoded turn, climb, and thrust outputs come from those same recordings.
- **Connections:** a sample of 7,000 long, strong connections from the connectome filtered to at least five synapses per connection.
- **Proteins:** receptor Cα coordinates used for docking: 350 in 4R6E, 286 in 2P16, and 552 in 3LN1, together with PDB secondary-structure annotations.
- **Ligands and scores:** atom coordinates from top-ranked AutoDock Vina poses, eight scores from `multi-target.json`, a 15 × 20 × 14 Å search box for the featured PARP1 run, and exhaustiveness 8.
- **Reward:** FDDD's proportional-mode formula, linearly rescaling the best score to 1.0 and the worst to 0.05.
- **Learned preference:** fly 01 values from the approximately nine-minute, 20-fly local run documented in [`../docs/brain-reward-loop.md`](../docs/brain-reward-loop.md).
- **Fly:** the anatomical flybody mesh.

### Authored motion and settings

The input schedule, sensory-channel changes, and reward-on intervals were selected for the showreel. The spikes are computed responses to those inputs.

Playback at 12 simulation steps per second, spike afterglow, scanning planes, pulses along connections, cameras, the ligand's approach path, fly motion and wingbeats, logo morphing, and counter animation are authored visual effects. Connection pulses are not measurements of axonal conduction. The fly is not on the molecular physical scale.

**167,122 is the runtime model's selected neuron count, not the official traced count.** See [`../docs/malecns-selection-audit.json`](../docs/malecns-selection-audit.json). Rewards are external learning signals, not calibrated binding affinities. Docking scores do not establish drug efficacy, and raw scores across different targets do not establish clinical superiority.

## Build

From this directory, using the included derived data:

```sh
./make.sh 1.1.1
```

To regenerate data from an FDDD checkout:

```sh
FDDD_DIR=/path/to/FDDD ./make.sh 1.1.1 data
```

`FDDD_DIR` defaults to this repository's root. Use a new semantic version for each revision to preserve previous exports.

The pipeline assembles a silent HTML stage, extracts events, synthesizes the soundtrack, assembles the final HTML, renders covers and 60 fps video, normalizes audio, muxes MP4 masters with covers, and creates lightweight sharing copies.

To rebuild only the English HTML or render it with the existing soundtrack:

```sh
python3 build/build.py --version 1.1.1
python3 build/render.py dist/fddd-showreel-en-v1.1.1.html --version 1.1.1
```

To refresh the animated README preview from a rendered short cut:

```sh
python3 build/preview_webp.py dist/fddd-showreel-15s-en-v1.1.1.mp4 \
  ../docs/assets/fddd-showreel-15s-en-v1.1.1.webp
```

Requirements:

- Node.js 22 or later
- Python 3.11 or later with `numpy`, `scipy`, `fonttools`, `brotli`, `playwright`, and `Pillow`
- FFmpeg with macOS AudioToolbox's `aac_at` encoder
- Playwright Chromium (`python3 -m playwright install chromium`)
- Fonts in `~/Library/Fonts/`: `PretendardVariable.ttf` and `JetBrainsMonoNLNerdFontMono-{Medium,SemiBold,Bold}.ttf`

Fonts are subsetted and embedded. The MP4 pipeline currently uses macOS-specific GPU and audio settings.

## Source layout

- `src/reel.js`: WebGL2 scenes, point clouds, meshes, post-processing, and kinetic typography
- `src/template.html`, `src/edl.json`: player shell and edit decision list
- `build/sim.mjs`: spike recording with the FDDD engine
- `build/prep.py`: molecular, mesh, and connectivity data preparation
- `build/build.py`: single-file HTML assembly and font subsetting
- `build/events.py`: video-event extraction
- `build/audio.py`: music and sound-effect synthesis using NumPy, without sampled recordings
- `build/render.py`: MP4 and cover rendering
- `build/preview.py`: still-frame extraction for review
- `build/preview_webp.py`: animated README preview export (FFmpeg decode, Pillow encode)
- `data/`: derived data, events, and soundtrack
- `versions/v1.0.0/`: preserved Korean source and build scripts; original outputs remain in `dist/`

## Credits and licenses

- **MaleCNS v1.0 connectivity and soma positions:** FlyEM / HHMI Janelia, University of Cambridge, MRC Laboratory of Molecular Biology, and Google Research; CC BY 4.0. “Sexual dimorphism in the complete connectome of the Drosophila male central nervous system” (2026), doi:10.1016/j.cell.2026.08.015.
- **Fly mesh:** flybody, TuragaLab; Apache-2.0.
- **Spike engine:** FDDD MaleCNS LIF engine, based on [fly-connectome-template](https://github.com/cobanov/fly-connectome-template) by Mert Cobanov; Cobanov Template Attribution License 1.0.
- **Structures:** RCSB PDB 4R6E, 2P16, and 3LN1.
- **Docking:** AutoDock Vina / Webina; previously executed FDDD results.
- **Fonts:** Pretendard and JetBrains Mono; SIL Open Font License 1.1, embedded as subsets.
- **Music and sound effects:** synthesized by `build/audio.py`.
- **Motion design:** Claude.

See the repository's [LICENSE](../LICENSE) and [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) for the applicable source and data notices.
