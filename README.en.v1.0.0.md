# FDDD · Fly-Driven Drug Development

<p align="center">
  <a href="https://flybrain.kr"><img src="docs/assets/fddd-showreel-15s.webp" alt="FDDD 15-second motion showreel — connectome, protein docking, fly swarm" width="100%"></a>
</p>

[한국어](README.md) | **English**

**A browser-based research demo where fruit-fly neural models explore molecules and learn preferences from molecular docking scores.**

![Molecular docking leads to reward, a fruit-fly neural model, and exploration and preference](docs/assets/fddd-overview.jpg)

**Molecular docking → Reward → Fruit-fly neural model → Exploration & preference**

*AI-generated 3D concept illustration for explanation only. It does not depict actual molecular structures, neural connectivity, or experimental results.*

## Try it live

- **Main site: https://flybrain.kr/**
- **Alternative address for the same demo: https://drug.flybrain.kr/**
- **English page: https://flybrain.kr/en** · You can also switch with `KO | EN` at the top right.

No installation or login is needed. The demo starts automatically after loading its data. Neural computation runs **in your browser**, not on a server.

## What am I looking at?

The scene contains proteins, small molecules, and virtual fruit flies moving among them. Each fly runs an independent neural model based on **MaleCNS**, a measured map of connections between fruit-fly neurons.

Molecular docking is **a computational method for estimating how a small molecule might fit into a protein**. FDDD loads results from completed AutoDock Vina runs, converts the scores into rewards, and updates each fly's preference for the candidates it visits. You can watch where the flies go, how long they stay, and how their neural activity and preferences change.

> In short, this is **an experimental space that turns docking results into virtual fly exploration and learning**. It is not an experiment that gives drugs to living flies, or a service that proves a drug works.

## A quick tour

1. **Explore the central 3D scene.** Drag to rotate, scroll to zoom, and right-drag to pan.
2. **Select a fly or a brain tile below the scene.** Inspect that individual's neural activity, motor output, and learned preferences. Use `Follow selected fly` to follow it with the camera.
3. **Compare the molecule cards below.** `Vina kcal/mol` is the precomputed docking score. `residence · last 3 min` is the share of time actually recorded near each destination in the simulation during the last three minutes. These are different measures.
4. **Toggle `Reward ON / OFF`.** OFF freezes preference updates, but flight and neural computation continue. Use `Pause colony` to pause the whole simulation.
5. For a closer look at a protein and molecule, select its card and click **`Selected complex in Mol*`**.

**If it runs slowly:** Set `BRAINS` to 4 and keep only one demo tab open. Options are 4, 8, 12, and 20 flies; the default is chosen for your device. Changing the count restarts the session. A desktop browser is recommended because several neural models run at once.

## How does it work?

```text
Previously executed molecular docking results
                    ↓
Convert scores into rewards → update preference for the contacted candidate
                    ↓
Send reward to gustatory inputs + compute each fly's neural model
                    ↓
Computed motor output + authored movement and residence rules
                    ↓
Explore the next candidate; display activity and residence distribution
```

The policy favors higher-reward candidates without sending every fly to just one candidate. It selects destinations in proportion to learned values while retaining some exploration. Residence rankings in a short run need not match the docking-score rankings exactly.

## What is measured, computed, or designed?

| Component | Current implementation |
| --- | --- |
| **Connectivity data** | MaleCNS v1.0 brain and ventral nerve cord (VNC) connectivity from a single male fruit fly |
| **Neural computation per fly** | **167,122 selected neurons** and **6,241,236 directed connections**, computed independently for each fly. Only connections with at least 5 synapses are retained |
| **Brain visualization** | Activity displayed at **28,195 measured soma locations**. The picture uses a sample; computation covers the entire selected neuron population |
| **Structures and docking** | **8 executed combinations** involving 3 proteins and 6 distinct molecules. Experimental structures and computed docking poses are shown |
| **Reward input** | Reward is sent to **1,428 neurons** annotated as gustatory in MaleCNS. The input mapping and strength are authored rules |
| **Learning and movement** | Score-to-reward conversion, candidate preference updates, and flight/residence rules are engineered. Computed neural output influences movement |

**Important limits**

- Docking scores are not experimentally measured binding affinities or drug efficacy. Raw scores across different proteins do not establish clinical superiority.
- The flies learn from rewards derived from known docking results. The neural model does not independently discover binding strength or validate new drugs.
- The connectivity is measured, but neural dynamics, sensory/motor mappings, and preference learning are simplified models. This is not a claim of biological synaptic plasticity or validated fruit-fly behavior.
- **167,122 is not the officially traced neuron count.** It includes 165,122 `Traced` neurons plus 2,000 additional selected rows. Of those additions, 1,991 are labeled `Out of scope` in the source. This is a selected, filtered model, not the complete unfiltered source graph. [Selection and provenance](public/data/malecns/NOTICE.md)
- Fly avatars are visual representations and are not on the same physical scale as the molecules.

## Public sites and recording

Both domains serve **the same static web demo**. The public site computes neural activity in the browser and displays completed docking results. It does not run new docking jobs or retrain models on a server.

Neural recordings are not uploaded. They remain in that browser's IndexedDB. The public build records up to **500 MB of raw spike data**; after that, recording stops but computation and display continue. **Starting a new session automatically deletes previous-session recordings.** The public build cannot save recordings into a project folder.

## Run locally

Node.js 22 or later is recommended.

```sh
git clone https://github.com/AwesomeZun/FDDD.git
cd FDDD
npm ci
npm run build
npm run serve
```

Open http://localhost:5177/. The repository includes the MaleCNS runtime data and completed docking results needed for the basic demo.

```sh
npm test            # Run tests
npm run typecheck   # Check types
```

On the local server, `Save CNS records to project` saves current-session recordings under `public/data/records/`. Save before reloading if you want to keep them. The browser Downloads folder is not used. The local build does not have the public build's 500 MB cap, so watch disk usage.

Large raw data (`upstream/`), backups, session recordings, archived FlyWire data, raw training spikes, and local docking tools (`.tools/`) are not included on GitHub. **Running the demo is different from rerunning docking.** New docking runs require separate tool setup.

## Further reading

- [Docking combinations, methods, and reproduction](docs/multi-target-docking.md)
- [Reward input and preference learning, including change history](docs/brain-reward-loop.md)
- [MaleCNS provenance, selection, and model limits](public/data/malecns/NOTICE.md)
- [MaleCNS data manifest](public/data/malecns/manifest.json)
- [Public deployment configuration and limits, including deployment history](docs/public-deploy.md)

Detailed documents also contain experiments from earlier implementations. Use this README for an overview of the current demo.

## Credits and licenses

MaleCNS data comes from FlyEM / HHMI Janelia, the University of Cambridge, the MRC Laboratory of Molecular Biology, and Google Research, under **CC BY 4.0**. Molecular docking uses AutoDock Vina / Webina; detailed structure viewing uses Mol*.

Code, data, and tools have separate licenses. Before reuse, review and preserve [LICENSE](LICENSE), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), and the notices accompanying each dataset.

Built with [fly-connectome-template](https://github.com/cobanov/fly-connectome-template) by [Mert Cobanov](https://github.com/cobanov).
