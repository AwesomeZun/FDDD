import { useEffect, useState } from "react";
import { useContinuousColony } from "../../lib/useContinuousColony";
import {
  FLY_COUNT_STORAGE_KEY,
  flyCountForDevice,
  normalizeFlyCount,
  type HabitatPair,
} from "../../lib/colonyPolicy";

export const PUBLIC_CAP = 500 * 1024 * 1024;
export const FLY_NAMES = [
  "ION",
  "EMBER",
  "ULTRA",
  "LIME",
  "COBALT",
  "AMBER",
  "VIOLA",
  "MOSS",
  "CORAL",
  "SLATE",
  "OCHRE",
  "TEAL",
  "ROSE",
  "PINE",
  "FLAX",
  "INDIGO",
  "RUST",
  "SAGE",
  "PEARL",
  "ONYX",
];
const locations: [number, number, number][] = [
  [-6, 1, -3.6],
  [-2, 2, -3.8],
  [2, 0.5, -3.4],
  [6, 1.6, -3.8],
  [-6, -0.6, 3.6],
  [-2, 0.6, 3.8],
  [2, 1.5, 3.4],
  [6, 0, 3.6],
];
function initialCount() {
  try {
    const saved = normalizeFlyCount(
      localStorage.getItem(FLY_COUNT_STORAGE_KEY),
    );
    if (saved) return saved;
  } catch {
    /* Optional preference storage. */
  }
  return flyCountForDevice(navigator.hardwareConcurrency);
}
export function useLab() {
  const [pairs, setPairs] = useState<HabitatPair[]>([]);
  const [loadError, setLoadError] = useState("");
  const [flyCount, setCount] = useState(initialCount);
  const [publicMode, setPublicMode] = useState<boolean | null>(null);
  const [manifest, setManifest] = useState<{
    groups: string[];
    classes: Record<string, number>;
  } | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    const json = async (url: string) => {
      const r = await fetch(url, { signal: abort.signal });
      if (!r.ok) throw Error(`Could not load ${url} (${r.status})`);
      return r.json();
    };
    void Promise.all([
      json("/data/docking/multi-target.json"),
      json("/data/docking/structure-scale.json"),
    ])
      .then(([d, scale]) => {
        const list: HabitatPair[] = d.combinations.map((c: any, i: number) => {
          const target = d.targets.find((x: any) => x.id === c.targetId);
          const measured = scale.targets.find(
            (x: any) => x.targetId === c.targetId,
          );
          if (
            !target ||
            c.computed !== true ||
            !Number.isFinite(c.score) ||
            !Number.isFinite(measured?.radiusWorld)
          )
            throw Error(
              "Verified docking data or measured structure dimensions are missing.",
            );
          return {
            id: c.id,
            targetId: c.targetId,
            targetName: target.name,
            compoundId: c.compoundId,
            name: c.name,
            smiles: c.smiles,
            score: c.score,
            poseUrl: c.poseUrl,
            receptorUrl:
              target.displayReceptorPdbqt ??
              target.receptorPdbqt ??
              target.receptorPdb ??
              target.receptorUrl,
            position: locations[i % locations.length],
            radiusWorld: measured.radiusWorld,
            computed: true,
          };
        });
        if (!abort.signal.aborted) setPairs(list);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setLoadError(String(e));
      });
    void json("/data/malecns/manifest.json")
      .then((m) => setManifest({ groups: m.groups, classes: m.classes }))
      .catch(() => {});
    void fetch("/api/docking/status", {
      cache: "no-store",
      signal: abort.signal,
    })
      .then(async (r) => {
        let local = false;
        if (
          r.ok &&
          (r.headers.get("content-type") || "").includes("application/json")
        )
          local = typeof (await r.json())?.status === "string";
        if (!abort.signal.aborted) setPublicMode(!local);
      })
      .catch(() => {
        if (!abort.signal.aborted) setPublicMode(true);
      });
    return () => abort.abort();
  }, []);
  const colony = useContinuousColony(pairs, {
    flyCount,
    storageCapBytes: publicMode === false ? Infinity : PUBLIC_CAP,
  });
  const setFlyCount = (n: number) => {
    setCount(n);
    try {
      localStorage.setItem(FLY_COUNT_STORAGE_KEY, String(n));
    } catch {
      /* Optional preference storage. */
    }
  };
  return {
    pairs,
    loadError,
    manifest,
    publicMode,
    flyCount,
    setFlyCount,
    colony,
  };
}
export const shortTarget = (id: string) =>
  id.startsWith("parp1")
    ? "PARP1"
    : id.startsWith("cox2")
      ? "COX-2"
      : "Factor Xa";
export const shortCompound = (name: string) =>
  name.replace("PARP1 inhibitor ", "");
export const flyName = (index: number) =>
  `${FLY_NAMES[index] ?? "FLY"} ${String(index + 1).padStart(2, "0")}`;
