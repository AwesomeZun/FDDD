import { zipSync, strToU8 } from "fflate";
export type SavedNeuralRecord = {
  projectPath: string;
  url: string;
  bytes: number;
  runId: string;
};
export type Sample = {
  fly: number;
  compoundId: string;
  tick: number;
  spikeCount: number;
  time: number;
  sensory: number[];
  mode: string;
  position?: number[];
  velocity?: number[];
  destination?: number;
  feeding?: number;
  learned?: number[];
  bits: Uint8Array;
};
function request<T>(r: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
const DB_NAME = "fddd-neural-assays";
const SESSION_LOCK = "fddd-recording-session:";
/** A live tab owns only its session; other tabs can identify it without opening its records. */
export async function holdRecordingSession(
  session: string,
): Promise<(() => void) | null> {
  if (!navigator.locks) return null;
  return new Promise((resolve) => {
    void navigator.locks
      .request(
        SESSION_LOCK + session,
        () =>
          new Promise<void>((release) => {
            resolve(release);
          }),
      )
      .catch(() => resolve(null));
  });
}
/** Bounded open: unavailable/blocked storage must not prevent neural computation. */
export function openRecordingDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 2);
    let settled = false;
    const finishError = (e: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(e);
    };
    const timer = setTimeout(
      () => finishError(Error("Browser recording storage did not respond.")),
      5000,
    );
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains("chunks"))
        r.result.createObjectStore("chunks", { keyPath: "key" });
      if (!r.result.objectStoreNames.contains("runs"))
        r.result.createObjectStore("runs", { keyPath: "id" });
    };
    r.onblocked = () =>
      finishError(Error("Another tab is upgrading browser recording storage."));
    r.onerror = () => finishError(r.error);
    r.onsuccess = () => {
      if (settled) {
        r.result.close();
        return;
      }
      settled = true;
      clearTimeout(timer);
      const db = r.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}
/** Never delete the shared database: a blocked delete queues later opens forever.
 * Prune only inactive, leased sessions in bounded background transactions.
 * Legacy/untracked records and other live tabs are preserved. */
export async function pruneOtherSessions(
  keepSession: string,
): Promise<{ mode: "ranges" | "nothing"; runs: number }> {
  if (!navigator.locks?.query) return { mode: "nothing", runs: 0 };
  const db = await openRecordingDB();
  let runs: {
    id: string;
    metadata?: { colonySession?: string; recordingLease?: boolean };
  }[];
  try {
    runs = (await request(
      db.transaction("runs").objectStore("runs").getAll(),
    )) as typeof runs;
  } finally {
    db.close();
  }
  const locks = await navigator.locks.query(),
    active = new Set((locks.held ?? []).map((x) => x.name));
  const others = runs.filter(
    (x) =>
      x.metadata?.recordingLease === true &&
      x.metadata.colonySession !== keepSession &&
      !active.has(SESSION_LOCK + x.metadata.colonySession),
  );
  if (!others.length) return { mode: "nothing", runs: 0 };
  void (async () => {
    const db2 = await openRecordingDB();
    try {
      for (const run of others) {
        const tx = db2.transaction(["chunks", "runs"], "readwrite");
        tx.objectStore("chunks").delete(
          IDBKeyRange.bound([run.id, 0], [run.id, Number.MAX_SAFE_INTEGER]),
        );
        tx.objectStore("runs").delete(run.id);
        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        });
        await new Promise((r) => setTimeout(r, 20));
      }
    } finally {
      db2.close();
    }
  })().catch((e) =>
    console.warn("[fddd] inactive recording cleanup skipped", e),
  );
  return { mode: "ranges", runs: others.length };
}
export class NeuralRecord {
  readonly id =
    "assay-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
  private db!: IDBDatabase;
  steps = 0;
  bytes = 0;
  sequence = 0;
  async init(metadata: Record<string, unknown> = {}) {
    this.db = await openRecordingDB();
    await request(
      this.db
        .transaction("runs", "readwrite")
        .objectStore("runs")
        .put({ id: this.id, createdAt: new Date().toISOString(), metadata }),
    );
  }
  async append(samples: Sample[]) {
    const rows = samples.map(({ bits, ...meta }) => ({
      ...meta,
      byteLength: bits.length,
    }));
    const tx = this.db.transaction("chunks", "readwrite");
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? Error("Recording aborted"));
    });
    tx.objectStore("chunks").put({
      key: [this.id, this.sequence++],
      rows,
      bits: samples.map(
        (s) => new Blob([s.bits.slice().buffer as ArrayBuffer]),
      ),
    });
    await done;
    this.steps += samples.length;
    this.bytes += samples.reduce((a, s) => a + s.bits.length, 0);
  }
  async export(
    manifest: Record<string, unknown>,
    rootIds: string[],
    sortedToOriginal: Uint32Array,
  ) {
    const chunks = await request(
      this.db
        .transaction("chunks")
        .objectStore("chunks")
        .getAll(
          IDBKeyRange.bound([this.id, 0], [this.id, Number.MAX_SAFE_INTEGER]),
        ),
    );
    const parts: Uint8Array[][] = [],
      offsets: number[] = [],
      rows: Record<string, unknown>[] = [];
    for (const chunk of chunks)
      for (let j = 0; j < chunk.rows.length; j++) {
        const r = chunk.rows[j],
          bits = new Uint8Array(await chunk.bits[j].arrayBuffer());
        while (parts.length <= r.fly) {
          parts.push([]);
          offsets.push(0);
        }
        rows.push({
          ...r,
          byteOffset: offsets[r.fly],
          file: `brain-${r.fly + 1}.spikes.bin`,
        });
        offsets[r.fly] += bits.length;
        parts[r.fly].push(bits);
      }
    const files: Record<string, Uint8Array> = {
      "manifest.json": strToU8(
        JSON.stringify(
          {
            ...manifest,
            runId: this.id,
            encoding: `LSB-first bitset, sorted-engine neuron index,${rootIds.length} valid bits per frame; trailing bits zero`,
            recorded:
              "Every computed neuron spike flag at every inspection step. Membrane potentials are NOT retained.",
            storedNeuronCount: rootIds.length,
            brainFiles: parts.length,
            steps: this.steps,
          },
          null,
          2,
        ),
      ),
      "frames.jsonl": strToU8(rows.map((r) => JSON.stringify(r)).join("\n")),
      "root-ids.json": strToU8(JSON.stringify(rootIds)),
      "sorted-to-original.json": strToU8(
        JSON.stringify(Array.from(sortedToOriginal)),
      ),
    };
    parts.forEach((p, i) => {
      const a = new Uint8Array(offsets[i]);
      let at = 0;
      for (const b of p) {
        a.set(b, at);
        at += b.length;
      }
      files[`brain-${i + 1}.spikes.bin`] = a;
    });
    const zip = zipSync(files, { level: 3 });
    const blob = new Blob([zip.buffer as ArrayBuffer], {
      type: "application/zip",
    });
    try {
      const response = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/zip" },
        body: blob,
        redirect: "error",
        signal: AbortSignal.timeout(120000),
      });
      if (!response.ok)
        throw Error(
          `Project recording server rejected save (HTTP ${response.status}).`,
        );
      const saved = await response.json();
      if (
        typeof saved.url !== "string" ||
        !/^\/data\/records\/[A-Za-z0-9_-]+\.zip$/.test(saved.url) ||
        saved.bytes !== zip.byteLength
      )
        throw Error(
          "Project recording server returned an invalid save confirmation.",
        );
      return {
        projectPath: "public" + saved.url,
        url: saved.url,
        bytes: saved.bytes,
        runId: this.id,
      } satisfies SavedNeuralRecord;
    } catch (e) {
      throw Error(
        "Project save failed. All recorded chunks remain in IndexedDB; no browser download was started. Keep this page and retry with the local project server available. " +
          String(e),
      );
    }
  }
  close() {
    this.db?.close();
  }
}
