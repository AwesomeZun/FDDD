import { CNS } from "./cnsDataset.ts";
import { useEffect, useRef, useState } from "react";
import { FlightExperiment } from "./flight.ts";
import {
  pruneOtherSessions,
  holdRecordingSession,
  openRecordingDB,
  NeuralRecord,
  type Sample,
} from "./neuralRecord.ts";
/** Rolling window for the displayed residence share, so the exploration pass does not dominate forever. */
const RECENT_WINDOW_SECONDS = 180;
const CONTACT_HYSTERESIS = 0.9;
import {
  rewardScale,
  contactRadius,
  arenaBounds,
  advanceFly,
  chooseDestination,
  colonySensory,
  createFly,
  externalReward,
  FLY_SEED,
  learnPreference,
  rewardInput,
  updateLeaveDrive,
  shouldLeave,
  scoreFreePair,
  seededRandom,
  SEGMENT_STEPS,
  SPIKE_BYTES,
  type ColonyFly,
  type HabitatPair,
} from "./colonyPolicy.ts";
export type { ColonyFly, HabitatPair } from "./colonyPolicy.ts";
const snapshotFly = (f: ColonyFly): ColonyFly => ({
  ...f,
  position: [...f.position],
  velocity: [...f.velocity],
  dwell: [...f.dwell],
  learned: [...f.learned],
  trail: [...f.trail],
});
type Controls = { resume: () => void; exportRecords: () => Promise<void> };
// Cursor reads one run at a time: the archive catalogue never grows in JS memory.
async function nextRun(
  db: IDBDatabase,
  session: string,
  after?: IDBValidKey,
): Promise<{
  key: IDBValidKey;
  id: string;
  metadata: Record<string, unknown>;
} | null> {
  return new Promise((resolve, reject) => {
    const r = db
      .transaction("runs")
      .objectStore("runs")
      .openCursor(
        after === undefined ? undefined : IDBKeyRange.lowerBound(after, true),
      );
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      const c = r.result;
      if (!c) {
        resolve(null);
        return;
      }
      if (c.value.metadata?.colonySession === session)
        resolve({ key: c.key, id: c.value.id, metadata: c.value.metadata });
      else c.continue();
    };
  });
}
export type ColonyOptions = {
  /** Live colony size; each fly is its own full CNS worker. */ flyCount: number;
  /** Stop storing new frames once this many raw spike bytes are in IndexedDB (computation continues). Infinity = unlimited (local build). */ storageCapBytes: number;
};
export function useContinuousColony(
  pairs: HabitatPair[],
  options: ColonyOptions,
) {
  const flyCount = options.flyCount;
  const [flies, setFlies] = useState<ColonyFly[]>([]),
    [ready, setReady] = useState(false),
    [paused, setPaused] = useState(false),
    [error, setError] = useState(""),
    [steps, setSteps] = useState(0),
    [bytes, setBytes] = useState(0),
    [training, setTrainingState] = useState(true),
    [recentResidence, setRecentResidence] = useState<number[]>([]),
    [elapsed, setElapsed] = useState(0),
    [recordingCapped, setRecordingCapped] = useState(false),
    [droppedSteps, setDroppedSteps] = useState(0);
  const capRef = useRef(options.storageCapBytes);
  capRef.current = options.storageCapBytes;
  const [recordingIssue, setRecordingIssue] = useState(""),
    [initializedBrains, setInitializedBrains] = useState(0),
    [restartKey, setRestartKey] = useState(0);
  const [exporting, setExporting] = useState(false),
    [exportStatus, setExportStatus] = useState<
      "idle" | "saving" | "saved" | "error"
    >("idle"),
    [savedPath, setSavedPath] = useState(""),
    [savedSegments, setSavedSegments] = useState(0);
  const pauseRef = useRef(false),
    trainingRef = useRef(true),
    controls = useRef<Controls | null>(null);
  // Equal-value UI rerenders must not restart the workers. Dataset changes start a new session.
  const signature =
    JSON.stringify(pairs) + "|flies=" + flyCount + "|restart=" + restartKey;
  useEffect(() => {
    if (!pairs.length) {
      setReady(false);
      setFlies([]);
      return;
    }
    let animation = 0,
      lastMotion = 0,
      lastPublish = 0;
    let stopped = false,
      timer: ReturnType<typeof setTimeout> | undefined,
      inFlight: Promise<void> = Promise.resolve(),
      record: NeuralRecord | null = null,
      segment = 0,
      totalSteps = 0,
      totalBytes = 0,
      seconds = 0,
      pending: Sample[] = [],
      fatal = false,
      exporting = false;
    const dwellHistory: { t: number; totals: number[] }[] = [];
    let lastDwellSnapshot = 0;
    const session =
        "colony-" + Date.now() + "-" + Math.random().toString(36).slice(2),
      seeds = Array.from({ length: flyCount }, (_, i) => FLY_SEED(i)),
      units = seeds.map((seed) => new FlightExperiment(seed)),
      randoms = seeds.map((seed) => seededRandom(seed));
    const population = units.map((_, i) =>
        createFly(i, pairs.length, flyCount),
      ),
      age = units.map(() => 0),
      contact = units.map(() => 0),
      residence = units.map(() => 0),
      leaveDrive = units.map(() => 0),
      observed = units.map(() => Array(pairs.length).fill(false));
    const inputs = pairs.map(scoreFreePair),
      rewards = pairs.map((pair) => externalReward(pair, rewardScale(pairs))),
      bounds = arenaBounds(inputs);
    const metadata = () => ({
      colonySession: session,
      recordingLease: releaseSession !== null,
      segment: segment++,
      pairs,
      brainCount: flyCount,
      dataset: CNS.id,
      neuronCount: CNS.neuronCount,
      edgeCount: CNS.edgeCount,
      stepSeconds: 0.05,
      segmentMaxSteps: SEGMENT_STEPS,
      policy:
        "authored 3D steering + online reward candidate preference; reward channel (sensory[8]) into MaleCNS gustatory neurons; brain-driven leave rule on descending output; not affinity inference",
      seeds,
      recordingNote:
        "Every fly records its full " +
        SPIKE_BYTES +
        "-byte spike bitset each 50 ms tick: about " +
        ((flyCount * SPIKE_BYTES * 20) / 1048576).toFixed(1) +
        " MB/s into IndexedDB.",
    });
    const newRecord = async () => {
      const next = new NeuralRecord();
      try {
        await next.init(metadata());
      } catch (e) {
        next.close();
        throw e;
      }
      record?.close();
      record = next;
    };
    const fail = (e: unknown) => {
      if (!stopped) {
        setError(
          String(e) +
            (pending.length
              ? " | " +
                pending.length +
                " computed spike records retained in memory. Resume/export retries storage; do not reload."
              : ""),
        );
        pauseRef.current = true;
        setPaused(true);
      }
    };
    let dropped = 0,
      recordingEnabled = true,
      computedRounds = 0;
    let releaseSession: (() => void) | null = null;
    const storageFailed = (e: unknown) => {
      recordingEnabled = false;
      if (!stopped) setRecordingIssue(String(e));
    };
    // Storage cap (public build): once reached, computed frames are no longer stored. They are counted as dropped and reported, never silently discarded.
    const persist = async () => {
      if (!recordingEnabled || !pending.length) return;
      if (totalBytes >= capRef.current) {
        dropped += pending.length;
        pending = [];
        if (!stopped) {
          setRecordingCapped(true);
          setDroppedSteps(dropped);
        }
        return;
      }
      try {
        if (!record) await newRecord();
        if (record!.steps >= SEGMENT_STEPS) await newRecord();
        await record!.append(pending);
        totalSteps += pending.length;
        totalBytes += pending.reduce((s, p) => s + p.bits.byteLength, 0);
        pending = [];
        if (!stopped) {
          setSteps(totalSteps);
          setBytes(totalBytes);
        }
      } catch (e) {
        storageFailed(e);
      }
    };
    const schedule = () => {
      if (!stopped) timer = setTimeout(tick, 50);
    };
    const run = async () => {
      if (stopped || pauseRef.current || exporting || fatal) return;
      try {
        await persist(); // Retry the exact failed batch before computing anything else.
        if (stopped) return;
        const trainThisStep = trainingRef.current;
        const tCompute = performance.now();
        const results = await Promise.allSettled(
          units.map(async (u, i) => {
            const fly = population[i],
              index = fly.destination;
            const before = Math.hypot(
              ...fly.position.map((v, j) => v - inputs[index].position[j]),
            );
            const reward = rewardInput(
              fly,
              index,
              rewards[index],
              before < contactRadius(inputs[index]),
            );
            const frame = await u.inspectAsync(
              [
                ...colonySensory(inputs[index], fly, computedRounds % 4),
                reward,
              ],
              "baseline",
              recordingEnabled,
            );
            if (
              recordingEnabled &&
              (!frame.spikeBits || frame.spikeBits.length !== SPIKE_BYTES)
            )
              throw Error(
                "Full MaleCNS neuron spike bitset absent; engine halted",
              );
            if (
              frame.neuronCount !== CNS.neuronCount ||
              frame.edgeCount !== CNS.edgeCount
            )
              throw Error("Unexpected graph dimensions");
            if (recordingEnabled && frame.spikeBits)
              pending.push({
                fly: i,
                compoundId: pairs[index].id,
                tick: frame.tick,
                spikeCount: frame.spikeCount,
                time: frame.time,
                sensory: frame.sensory,
                mode: trainThisStep ? "colony-training" : "colony-frozen",
                position: [...fly.position],
                velocity: [...fly.velocity],
                destination: index,
                feeding: fly.feeding,
                learned: [...fly.learned],
                bits: frame.spikeBits,
              });
            else {
              dropped++;
              if (!stopped) setDroppedSteps(dropped);
            }
            fly.frame = frame;
            leaveDrive[i] = updateLeaveDrive(leaveDrive[i], frame.output);
            const distance = Math.hypot(
              ...fly.position.map((v, j) => v - inputs[index].position[j]),
            );
            fly.feeding =
              distance < contactRadius(inputs[index]) ? fly.learned[index] : 0;
            if (contact[i] >= 1) {
              observed[i][index] = true;
              learnPreference(
                fly,
                index,
                rewards[index],
                trainThisStep && trainingRef.current,
              );
              contact[i] = 0;
            }
            // Leave decision comes from the computed descending output (see colonyPolicy shouldLeave), not a timer table.
            if (
              shouldLeave(
                leaveDrive[i],
                reward,
                residence[i],
                age[i],
                distance <
                  contactRadius(inputs[index]) +
                    (residence[i] > 0 ? CONTACT_HYSTERESIS : 0),
                observed[i].some((seen) => !seen),
              )
            ) {
              const unseen = observed[i]
                .map((seen, j) => (seen ? -1 : j))
                .filter((j) => j >= 0);
              fly.destination = unseen.length
                ? unseen[Math.floor(randoms[i]() * unseen.length)]
                : chooseDestination(fly.learned, randoms[i]);
              age[i] = 0;
              contact[i] = 0;
              residence[i] = 0;
            }
          }),
        );
        // Preserve successful peers even if one worker failed. No Promise.all early rejection loss.
        const failed = results.find((r) => r.status === "rejected");
        if (failed?.status === "rejected") {
          fatal = true;
          await persist();
          throw failed.reason;
        }
        computedRounds++;
        const tPersist = performance.now();
        await persist();
        const tEnd = performance.now();
        // Diagnostic only: last tick timing (all-worker compute wait vs IndexedDB persist), readable from devtools.
        (globalThis as any).__fdddTiming = {
          computeMs: tPersist - tCompute,
          persistMs: tEnd - tPersist,
          workerComputeMsMax: Math.max(
            ...population.map((f) => f.frame?.computeMs ?? 0),
          ),
          workerComputeMsMean:
            population.reduce((a, f) => a + (f.frame?.computeMs ?? 0), 0) /
            population.length,
          flies: flyCount,
          at: Date.now(),
          fly0: {
            dest: population[0].destination,
            distance: Math.hypot(
              ...population[0].position.map(
                (v, j) => v - inputs[population[0].destination].position[j],
              ),
            ),
            contactRadius: contactRadius(inputs[population[0].destination]),
            residence: residence[0],
            age: age[0],
            contact: contact[0],
            leaveDrive: leaveDrive[0],
            speed: Math.hypot(...population[0].velocity),
            observed: observed[0].filter(Boolean).length,
          },
          gapSincePrevMs:
            Date.now() - ((globalThis as any).__fdddTiming?.at ?? Date.now()),
        };
      } catch (e) {
        fail(e);
      }
    };
    function tick() {
      inFlight = run().finally(schedule);
    }
    function motion(now: number) {
      // Wall-clock motion: when the main thread is busy (many brains, many views) animation frames arrive late; allow up to 1 s
      // of elapsed time per frame and integrate flight in <=50 ms sub-steps so simulation seconds track real seconds.
      const dt = lastMotion ? Math.min(1, (now - lastMotion) / 1000) : 0;
      lastMotion = now;
      if (!stopped && !pauseRef.current && !exporting && !fatal) {
        seconds += dt;
        for (const fly of population) {
          if (!fly.frame) continue;
          const i = fly.id,
            index = fly.destination;
          const sub = Math.max(1, Math.ceil(dt / 0.05));
          let distance = 0;
          for (let k = 0; k < sub; k++)
            distance = advanceFly(
              fly,
              inputs[index],
              fly.frame.output,
              dt / sub,
              bounds,
            );
          age[i] += dt;
          // Residence is credited only to the fly's own destination while in contact with it (not to whichever complex is nearest),
          // so large neighbouring structures do not absorb passing flies.
          if (
            distance <
            contactRadius(inputs[index]) +
              (residence[i] > 0 ? CONTACT_HYSTERESIS : 0)
          )
            fly.dwell[index] += dt;
          // Hysteresis: once resident, brief excursions up to CONTACT_HYSTERESIS beyond the contact radius do not reset the contact clock (fast orbiting flies bounce in and out).
          const inContactNow =
            distance <
            contactRadius(inputs[index]) +
              (residence[i] > 0 ? CONTACT_HYSTERESIS : 0);
          if (inContactNow) {
            contact[i] += dt;
            residence[i] += dt;
          } else contact[i] = 0;
        }
        if (now - lastPublish >= 50) {
          lastPublish = now;
          setFlies(population.map(snapshotFly));
          setElapsed(seconds);
        }
        {
          const totals = pairs.map((_, j) =>
            population.reduce((a, f) => a + (f.dwell[j] ?? 0), 0),
          );
          const now = seconds;
          if (now - lastDwellSnapshot >= 5) {
            dwellHistory.push({ t: now, totals });
            lastDwellSnapshot = now;
            while (
              dwellHistory.length &&
              dwellHistory[0].t < now - RECENT_WINDOW_SECONDS - 5
            )
              dwellHistory.shift();
          }
          const base = dwellHistory[0]?.totals ?? totals.map(() => 0);
          if (!stopped)
            setRecentResidence(
              totals.map((v, j) => Math.max(0, v - (base[j] ?? 0))),
            );
        }
      }
      if (!stopped) animation = requestAnimationFrame(motion);
    }
    const exportRecords = async () => {
      if (exporting) return;
      exporting = true;
      pauseRef.current = true;
      setPaused(true);
      setExporting(true);
      setExportStatus("saving");
      setSavedPath("");
      setSavedSegments(0);
      setError("");
      try {
        await inFlight;
        recordingEnabled = true;
        await persist();
        if (!recordingEnabled)
          throw Error("Browser recording storage is still unavailable.");
        setRecordingIssue("");
        const db = await openRecordingDB();
        try {
          let after: IDBValidKey | undefined;
          for (;;) {
            const row = await nextRun(db, session, after);
            if (!row) break;
            after = row.key;
            // NeuralRecord has no reopen API. Reattach its public run identifier and open the
            // existing DB through init; chunks remain immutable and the original metadata is retained.
            const archive = new NeuralRecord();
            Object.defineProperty(archive, "id", { value: row.id });
            try {
              await archive.init(row.metadata);
              // Recompute bounded segment counters for accurate existing exporter manifests.
              const counts = await new Promise<{
                steps: number;
                bytes: number;
              }>((resolve, reject) => {
                let n = 0,
                  b = 0;
                const r = db
                  .transaction("chunks")
                  .objectStore("chunks")
                  .openCursor(
                    IDBKeyRange.bound(
                      [row.id, 0],
                      [row.id, Number.MAX_SAFE_INTEGER],
                    ),
                  );
                r.onerror = () => reject(r.error);
                r.onsuccess = () => {
                  const c = r.result;
                  if (!c) {
                    resolve({ steps: n, bytes: b });
                    return;
                  }
                  for (const x of c.value.rows) {
                    n++;
                    b += x.byteLength;
                  }
                  c.continue();
                };
              });
              archive.steps = counts.steps;
              archive.bytes = counts.bytes;
              if (counts.steps) {
                const saved = await archive.export(
                  {
                    ...row.metadata,
                    training: trainingRef.current,
                    totalSessionSteps: totalSteps,
                    license: CNS.license,
                    warning:
                      "Cross-target Vina uncalibrated. Candidate preference, not blind affinity discovery.",
                  },
                  units[0].rootIds,
                  units[0].sortedToOriginal,
                );
                if (!stopped) {
                  setSavedPath(saved.projectPath);
                  setSavedSegments((n) => n + 1);
                }
              }
            } finally {
              archive.close();
            }
          }
        } finally {
          db.close();
        }
        if (!stopped) setExportStatus("saved");
      } catch (e) {
        if (!stopped) setExportStatus("error");
        fail(e);
      } finally {
        exporting = false;
        if (!stopped) setExporting(false);
      }
    };
    controls.current = {
      resume: () => {
        if (!fatal && !exporting) {
          pauseRef.current = false;
          setPaused(false);
          setError("");
        }
      },
      exportRecords,
    };
    setReady(false);
    setInitializedBrains(0);
    setRecordingIssue("");
    setError("");
    setExporting(false);
    setExportStatus("idle");
    setRecordingCapped(false);
    setDroppedSteps(0);
    setSavedPath("");
    setSavedSegments(0);
    setSteps(0);
    setBytes(0);
    setElapsed(0);
    setFlies(population.map(snapshotFly));
    inFlight = (async () => {
      try {
        let initializedCount = 0;
        const initialized = await Promise.allSettled(
          units.map(async (u) => {
            await u.init();
            if (!stopped) setInitializedBrains(++initializedCount);
          }),
        );
        const failure = initialized.find((r) => r.status === "rejected");
        if (failure?.status === "rejected") throw failure.reason;
        if (stopped) return;
        releaseSession = await holdRecordingSession(session);
        if (stopped) {
          releaseSession?.();
          return;
        }
        try {
          await pruneOtherSessions(session);
          await newRecord();
        } catch (e) {
          storageFailed(e);
        }
        if (!stopped) {
          setReady(true);
          schedule();
          animation = requestAnimationFrame(motion);
        }
      } catch (e) {
        fatal = true;
        fail(e);
      }
    })();
    return () => {
      stopped = true;
      clearTimeout(timer);
      cancelAnimationFrame(animation);
      controls.current = null;
      if (!population.some((f) => f.frame)) units.forEach((u) => u.dispose());
      // Let an already computed batch commit before closing. Workers are not killed mid-step.
      void inFlight.finally(() => {
        units.forEach((u) => u.dispose());
        record?.close();
        releaseSession?.();
      });
    };
    // signature is the complete value dependency, including scores and positions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  const pause = () => {
    pauseRef.current = true;
    setPaused(true);
  };
  const resume = () => controls.current?.resume();
  const setTraining = (v: boolean) => {
    trainingRef.current = v;
    setTrainingState(v);
  };
  const restart = () => {
    pauseRef.current = false;
    setPaused(false);
    setRestartKey((n) => n + 1);
  };
  return {
    restart,
    initializedBrains,
    recordingIssue,
    recentResidence,
    flyCount,
    recordingCapped,
    droppedSteps,
    exporting,
    exportStatus,
    savedPath,
    savedSegments,
    flies,
    ready,
    paused,
    pause,
    resume,
    error,
    steps,
    bytes,
    exportRecords: async () => {
      await controls.current?.exportRecords();
    },
    training,
    setTraining,
    elapsed,
  };
}
