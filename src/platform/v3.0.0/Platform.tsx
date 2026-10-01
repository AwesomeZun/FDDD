import { lazy, Suspense, useEffect, useState, type KeyboardEvent } from "react";
import { LangContext, useLang, useLangState } from "../../lib/i18n";
import { CNS } from "../../lib/cnsDataset";
import {
  FLY_COUNT_OPTIONS,
  externalReward,
  rewardScale,
} from "../../lib/colonyPolicy";
import { ColonyHabitat } from "../../components/ColonyHabitat";
import { BrainGrid } from "../../components/BrainGrid";
import {
  REGIONS,
  REGION_CSS,
  regionRates,
} from "../../components/brainRegions";
import {
  useLab,
  FLY_NAMES,
  PUBLIC_CAP,
  flyName,
  shortCompound,
  shortTarget,
} from "./useLab";
import { NeuralObservatory } from "./NeuralObservatory";
import { MoleculeScene } from "./MoleculeScene";
import { LiveTrace } from "./LiveTrace";
import { Modal } from "./Modal";
import "./platform.css";
const MolecularStudio = lazy(() =>
  import("../../components/MolecularStudio").then((m) => ({
    default: m.MolecularStudio,
  })),
);
const number = (n: number) => n.toLocaleString("en-US");
const clock = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
const stepNames = [
  ["Dock", "도킹"],
  ["Reward", "보상"],
  ["Compute", "뇌 계산"],
  ["Explore", "탐색"],
  ["Learn", "선호 학습"],
];
function Lab() {
  const { lang, setLang } = useLang(),
    l = (en: string, ko: string) => (lang === "ko" ? ko : en);
  const {
    pairs,
    loadError,
    manifest,
    publicMode,
    flyCount,
    setFlyCount,
    colony,
  } = useLab();
  const [selectedFly, setSelectedFly] = useState(0),
    [candidate, setCandidate] = useState(0),
    [step, setStep] = useState(0);
  const [view, setView] = useState<"brain" | "habitat" | "molecule">("brain"),
    [follow, setFollow] = useState(true),
    [reset, setReset] = useState(0),
    [connections, setConnections] = useState(true);
  const [modal, setModal] = useState<
      "methods" | "film" | "structure" | "session" | null
    >(null),
    [pendingCount, setPendingCount] = useState<number | null>(null);
  const [bootSeconds, setBootSeconds] = useState(0);
  useEffect(() => {
    setBootSeconds(0);
    if (colony.ready) return;
    const timer = setInterval(() => setBootSeconds((x) => x + 1), 1000);
    return () => clearInterval(timer);
  }, [colony.ready, flyCount]);
  const [filter, setFilter] = useState("all"),
    [help, setHelp] = useState(false);
  const fly = colony.flies[selectedFly],
    frame = fly?.frame,
    pick = pairs[candidate],
    destination = pairs[fly?.destination ?? -1];
  const reward = pick ? externalReward(pick, rewardScale(pairs)) : null,
    totalResidence = colony.recentResidence.reduce((a, b) => a + b, 0);
  const rates = regionRates(
    frame?.groupSpikeCounts,
    manifest?.groups ?? [],
    manifest?.classes ?? {},
  );
  const errors = loadError || colony.error;
  const restartExperiment = () => {
    if (loadError) window.location.reload();
    else colony.restart();
  };
  useEffect(() => {
    setSelectedFly((i) => Math.min(i, flyCount - 1));
  }, [flyCount]);
  const status = errors
    ? l("Needs attention", "확인 필요")
    : !colony.ready
      ? l("Initializing", "초기화 중")
      : colony.paused
        ? l("Paused", "일시정지")
        : l("Live computation", "실시간 계산 중");
  const active = !errors && colony.ready && !colony.paused;
  const selectFly = (n: number) => {
    setSelectedFly(n);
  };
  const ranked = pairs
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => filter === "all" || shortTarget(p.targetId) === filter)
    .sort((a, b) => a.p.score - b.p.score);
  const stepCopy = [
    [
      l(
        "Start with a real docking result.",
        "실제로 실행한 도킹 결과에서 시작합니다.",
      ),
      l(
        "AutoDock Vina estimates how a molecule fits a protein. These eight scores come from completed runs. Select a candidate below to inspect its calculated pose.",
        "AutoDock Vina는 분자가 단백질에 들어맞는 자세를 계산합니다. 아래 8개 조합은 실제 실행 결과입니다. 후보를 선택하면 계산된 결합 자세를 볼 수 있습니다.",
      ),
      pick ? `${pick.score.toFixed(2)} kcal/mol` : "—",
      l("Executed Vina score", "실행된 Vina 점수"),
    ],
    [
      l(
        "Turn a known score into a reward.",
        "알려진 점수를 보상으로 바꿉니다.",
      ),
      l(
        "An authored rule rescales scores from 0.05 to 1.00. During contact, this signal enters gustatory inputs, modulated by the fly’s current preference. It is not a binding-affinity measurement.",
        "설계한 규칙으로 점수를 0.05–1.00의 보상으로 바꿉니다. 접촉 중에는 현재 선호값을 곱한 신호가 미각 입력으로 전달됩니다. 보상은 결합 친화도 측정값이 아닙니다.",
      ),
      reward?.toFixed(2) ?? "—",
      l("Potential reward for this candidate", "선택한 후보의 보상 크기"),
    ],
    [
      l("Compute every selected neuron.", "선택된 뉴런 전체를 계산합니다."),
      l(
        "Each fly runs an independent MaleCNS model with 167,122 selected neurons and 6,241,236 connections. Neurons accumulate input and fire at a threshold. The flashes above follow these computed spikes.",
        "개체마다 선택된 뉴런 167,122개와 연결 6,241,236개로 이루어진 독립적인 MaleCNS 모델이 있습니다. 뉴런은 입력을 모아 문턱값을 넘으면 발화합니다. 위의 밝은 점은 이 계산된 스파이크를 표시합니다.",
      ),
      frame ? number(frame.spikeCount) : "—",
      l(
        "Spikes in the selected fly’s latest step",
        "선택한 개체의 최신 스파이크 수",
      ),
    ],
    [
      l(
        "Let neural output influence the journey.",
        "신경망 출력이 탐색에 영향을 줍니다.",
      ),
      l(
        "Decoded motor output works with engineered steering and residence rules. Flies travel between molecular habitats, stay near candidates, then leave to explore.",
        "해독된 운동 출력이 설계된 이동·체류 규칙과 함께 작동합니다. 개체들은 분자 서식지 사이를 이동하고, 후보 근처에 머물다가 다시 탐색합니다.",
      ),
      destination ? shortCompound(destination.name) : "—",
      l("Current destination of the selected fly", "선택한 개체의 현재 목적지"),
    ],
    [
      l("Watch a preference take shape.", "선호가 형성되는 과정을 관찰합니다."),
      l(
        "Contact with candidates updates learned values while learning is on. A higher reward can increase preference; some exploration remains. Residence is observed behavior, not the docking score.",
        "학습이 켜져 있으면 후보와 접촉할 때 선호값을 갱신합니다. 높은 보상은 선호를 높일 수 있고, 일부 탐색은 계속 유지됩니다. 체류율과 도킹 점수는 서로 다른 지표입니다.",
      ),
      pick && fly ? `${Math.round((fly.learned[candidate] ?? 0) * 100)}%` : "—",
      l(
        "Selected fly’s preference for this candidate",
        "선택한 개체의 해당 후보 선호도",
      ),
    ],
  ];
  const tabKeys = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      const n =
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? 4
            : (i + (e.key === "ArrowRight" ? 1 : 4)) % 5;
      setStep(n);
      document.getElementById("flow-tab-" + n)?.focus();
    }
  };
  return (
    <div
      className="platform dashboard"
      data-version="3.0.0"
      data-ready={colony.ready}
      data-paused={colony.paused}
    >
      <a className="skip-link" href="#experiment">
        {l("Skip to the experiment", "실험으로 바로 가기")}
      </a>
      <header className="site-header">
        <a className="wordmark" href="#experiment" aria-label="FDDD home">
          <span className="brand-symbol" aria-hidden="true">
            f.
          </span>
          <strong>
            FDDD<span>NEURAL DISCOVERY LAB</span>
          </strong>
        </a>
        <span className="workspace-label">EXPERIMENT / 001</span>
        <div className="header-tools">
          <button className="text-button" onClick={() => setModal("film")}>
            <i className="play-icon" />
            {l("Watch the film", "쇼릴 보기")}
          </button>
          <button className="text-button" onClick={() => setModal("methods")}>
            {l("Methods & evidence", "방법과 근거")} ↗
          </button>
          <div className="language" aria-label="Language">
            <button aria-pressed={lang === "en"} onClick={() => setLang("en")}>
              EN
            </button>
            <span>/</span>
            <button aria-pressed={lang === "ko"} onClick={() => setLang("ko")}>
              KO
            </button>
          </div>
          <a
            className="github-link"
            href="https://github.com/AwesomeZun/FDDD"
            target="_blank"
            rel="noreferrer"
          >
            GitHub ↗
          </a>
        </div>
      </header>
      <main id="experiment">
        <div className="dashboard-title">
          <div>
            <span className="eyebrow">
              REAL CONNECTIVITY. LIVE COMPUTATION.
            </span>
            <h1>
              {l("Follow the signal.", "신호를 따라가세요.")}{" "}
              <em>{l("Watch it move.", "움직임을 관찰하세요.")}</em>
            </h1>
          </div>
          <p>
            {l(
              "Docking scores become rewards. Watch each fly learn where to go.",
              "도킹 점수를 보상으로 바꿉니다. 개체가 선호를 학습하는 과정을 관찰하세요.",
            )}
            <small>
              {number(CNS.neuronCount)} neurons × {flyCount} independent brains
            </small>
          </p>
        </div>
        <div
          className="experiment-controls"
          aria-label={l("Experiment controls", "실험 제어")}
        >
          <div className={"experiment-status " + (active ? "running" : "")}>
            <i className="status-dot" />
            <span>{status}</span>
            <small>{clock(colony.elapsed)}</small>
          </div>
          <div className="control-cluster">
            <label>
              {l("Brains", "개체 수")}
              <select
                aria-label={l("Number of brains", "개체 수")}
                value={flyCount}
                disabled={colony.exporting}
                onChange={(e) => setPendingCount(Number(e.target.value))}
              >
                {FLY_COUNT_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="pause-button"
              disabled={!colony.ready || colony.exporting}
              onClick={colony.paused ? colony.resume : colony.pause}
            >
              <span aria-hidden="true">{colony.paused ? "▶" : "Ⅱ"}</span>
              {colony.paused ? l("Resume", "계속") : l("Pause", "일시정지")}
            </button>
            <button
              className="learning-toggle"
              role="switch"
              aria-checked={colony.training}
              onClick={() => colony.setTraining(!colony.training)}
              aria-label={l("Preference learning", "선호 학습")}
            >
              <span className="toggle-track">
                <i />
              </span>
              {colony.training
                ? l("Learning on", "학습 켜짐")
                : l("Learning off", "학습 꺼짐")}
            </button>
            <button
              className="info-button"
              aria-label={l("Explain learning control", "학습 제어 설명")}
              aria-expanded={help}
              onClick={() => setHelp(!help)}
            >
              ?
            </button>
          </div>
          <button
            className="session-button"
            onClick={() => setModal("session")}
          >
            <span className="record-dot" />
            {(colony.bytes / 1048576).toFixed(1)} MB{" "}
            <span>{l("Session", "세션")} ↗</span>
          </button>
        </div>
        {help && (
          <div className="inline-explanation" role="status">
            {l(
              "Learning off freezes the candidate preference values. Neural computation, reward input, and flight continue. Pause stops the whole simulation. Changing the brain count starts a new session.",
              "학습을 끄면 후보별 선호값의 갱신이 멈춥니다. 신경망 계산·보상 입력·비행은 계속됩니다. 일시정지는 전체 시뮬레이션을 멈춥니다. 개체 수를 바꾸면 새 세션이 시작됩니다.",
            )}
          </div>
        )}
        {errors && (
          <div className="error-notice" role="alert">
            <b>
              {l(
                "The experiment needs attention.",
                "실험 상태를 확인해 주세요.",
              )}
            </b>
            <p>{errors}</p>
            {loadError && (
              <button onClick={() => location.reload()}>
                {l("Reload data", "데이터 다시 불러오기")}
              </button>
            )}
          </div>
        )}
        {colony.recordingCapped && (
          <div className="inline-explanation" role="status">
            {l(
              "The 500 MB recording limit has been reached. Live computation continues; new spike frames are no longer saved.",
              "500 MB 기록 한도에 도달했습니다. 실시간 계산은 계속되지만 새 스파이크 프레임은 저장하지 않습니다.",
            )}
          </div>
        )}

        {colony.recordingIssue && (
          <div className="storage-note" role="status">
            {l(
              "Live simulation is running. Browser recording is unavailable; new frames are not saved.",
              "실시간 시뮬레이션은 실행 중입니다. 브라우저 기록을 사용할 수 없어 새 프레임을 저장하지 않습니다.",
            )}
            <details>
              <summary>{l("Recording details", "기록 상태 자세히")}</summary>
              {colony.recordingIssue}
            </details>
          </div>
        )}
        {!colony.ready && !errors && (
          <div className="boot-panel" role="status">
            <span className="boot-spinner" />
            <div>
              <strong>
                {l(
                  "Starting the real neural simulation",
                  "실제 신경망 계산을 시작합니다",
                )}
              </strong>
              <span>
                {colony.initializedBrains
                  ? `${colony.initializedBrains} / ${flyCount} brains prepared`
                  : l(
                      "Loading the neural graph (27 MB) and preparing independent brains…",
                      "신경 연결 데이터(27 MB)를 불러오고 독립적인 신경망을 준비합니다…",
                    )}{" "}
                · {bootSeconds}s
              </span>
            </div>
            <progress value={colony.initializedBrains} max={flyCount} />
            {bootSeconds > 15 && (
              <button className="button secondary" onClick={colony.restart}>
                {l("Retry start", "다시 시작")}
              </button>
            )}
          </div>
        )}
        {errors && (
          <div className="recovery-actions">
            <button className="button primary" onClick={restartExperiment}>
              {l("Restart simulation", "시뮬레이션 다시 시작")}
            </button>
            {flyCount > 4 && (
              <button
                className="button secondary"
                onClick={() => {
                  setFlyCount(4);
                  restartExperiment();
                }}
              >
                {l("Restart with 4 brains", "4개 신경망으로 다시 시작")}
              </button>
            )}
          </div>
        )}

        <div className="workbench">
          <aside className="candidate-panel">
            <div className="panel-title">
              <span>{l("Molecular candidates", "분자 후보")}</span>
              <small>
                {pairs.length} {l("EXECUTED", "실행 결과")}
              </small>
            </div>
            <div
              className="target-filters"
              role="group"
              aria-label={l("Filter by protein", "단백질별 필터")}
            >
              {["all", "PARP1", "COX-2", "Factor Xa"].map((f) => (
                <button
                  key={f}
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                >
                  {f === "all" ? l("All", "전체") : f}
                </button>
              ))}
            </div>
            <div className="list-heading">
              <span>{l("COMPOUND / TARGET", "화합물 / 표적")}</span>
              <span>kcal/mol</span>
            </div>
            <div className="candidate-list">
              {ranked.map(({ p, i }) => (
                <button
                  key={p.id}
                  aria-pressed={candidate === i}
                  className={candidate === i ? "selected" : ""}
                  onClick={() => {
                    setCandidate(i);
                    setView("molecule");
                  }}
                >
                  <span className="candidate-order">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="candidate-name">
                    <strong>{shortCompound(p.name)}</strong>
                    <small>{shortTarget(p.targetId)}</small>
                  </span>
                  <b>{p.score.toFixed(2).replace("-", "−")}</b>
                  <span className="candidate-chevron">↗</span>
                </button>
              ))}
              {!pairs.length && (
                <p className="panel-loading">
                  {l(
                    "Loading executed docking results…",
                    "실행된 도킹 결과를 불러오는 중…",
                  )}
                </p>
              )}
            </div>
            <div className="candidate-note">
              {l(
                "More negative is a better Vina score. Scores across different proteins are not calibrated binding affinities.",
                "더 음수인 값이 더 좋은 Vina 점수입니다. 서로 다른 단백질의 점수는 보정된 결합 친화도가 아닙니다.",
              )}
            </div>
          </aside>

          <div className="world-panel live-stage">
            <div
              className="stage-tabs"
              role="group"
              aria-label={l("Observation view", "관찰 화면")}
            >
              <button
                aria-pressed={view === "brain"}
                className={view === "brain" ? "selected" : ""}
                onClick={() => setView("brain")}
              >
                <span>01</span>
                {l("Brain", "뇌 활동")}
              </button>
              <button
                aria-pressed={view === "molecule"}
                className={view === "molecule" ? "selected" : ""}
                disabled={!pick}
                onClick={() => setView("molecule")}
              >
                <span>02</span>
                {l("Docking", "도킹")}
              </button>
              <button
                aria-pressed={view === "habitat"}
                className={view === "habitat" ? "selected" : ""}
                onClick={() => setView("habitat")}
              >
                <span>03</span>
                {l("Flight", "비행")}
              </button>
              <span className="stage-live">
                <i className={"status-dot " + (active ? "active" : "")} />
                {active ? "LIVE" : status}
              </span>
            </div>
            <div className={"world-viewport stage-" + view}>
              {view === "brain" ? (
                <>
                  <NeuralObservatory
                    identity={selectedFly}
                    frame={frame}
                    paused={colony.paused}
                    resetKey={reset}
                    connections={connections}
                  />
                  <div className="stage-ident">
                    <span className="eyebrow">MALECNS / COMPUTED SPIKES</span>
                    <h2>{flyName(selectedFly)}</h2>
                    <p>
                      {number(CNS.displayCount)} measured positions
                      <br />
                      {number(CNS.neuronCount)} neurons computed
                    </p>
                  </div>
                  <button
                    className="connection-toggle"
                    aria-pressed={connections}
                    onClick={() => setConnections(!connections)}
                  >
                    {connections
                      ? l("Connections on", "연결선 켜짐")
                      : l("Connections off", "연결선 꺼짐")}
                    <small>
                      {l(
                        "7,000 real links · animated paths",
                        "실제 연결 7,000개 · 경로는 연출",
                      )}
                    </small>
                  </button>
                  <button
                    className="stage-reset button secondary"
                    onClick={() => setReset((n) => n + 1)}
                  >
                    {l("Reset brain view", "뇌 시점 초기화")} ↻
                  </button>
                  <div className="stage-scale">
                    {l(
                      "Drag the brain to rotate. Flashes follow computed spikes; curves are visual guides.",
                      "드래그로 뇌를 회전합니다. 밝은 점은 계산된 스파이크입니다.",
                    )}
                  </div>
                </>
              ) : view === "habitat" ? (
                <>
                  <ColonyHabitat
                    pairs={pairs}
                    flies={colony.flies}
                    paused={colony.paused}
                    selected={selectedFly}
                    onSelect={selectFly}
                    follow={follow}
                    onReset={() => setFollow(false)}
                  />
                  <div className="flight-ident">
                    <span className="eyebrow">
                      {follow
                        ? "TRACKING INDIVIDUAL"
                        : "SHARED MOLECULAR HABITAT"}
                    </span>
                    <h2>
                      {follow
                        ? flyName(selectedFly)
                        : l("The colony", "개체군")}
                    </h2>
                    <p>
                      {destination
                        ? l("Travelling to ", "현재 목적지: ") +
                          shortCompound(destination.name)
                        : l(
                            "Waiting for the first computed step",
                            "첫 계산 스텝을 준비합니다",
                          )}
                    </p>
                  </div>
                  <div className="world-overlay">
                    <span>
                      {frame
                        ? `STEP ${number(frame.tick)} · ${number(frame.spikeCount)} SPIKES`
                        : "WAITING FOR ENGINE"}
                    </span>
                    <button
                      className={"follow-button " + (follow ? "selected" : "")}
                      aria-pressed={follow}
                      onClick={() => setFollow(!follow)}
                    >
                      {follow
                        ? l("Show all habitats", "전체 서식지 보기")
                        : l("Follow selected fly", "선택한 개체 추적")}{" "}
                      ⌖
                    </button>
                  </div>
                </>
              ) : pick ? (
                <>
                  <MoleculeScene pair={pick} />
                  <div className="pose-overlay">
                    <span className="eyebrow">
                      {shortTarget(pick.targetId)} / EXECUTED VINA POSE
                    </span>
                    <h2>{shortCompound(pick.name)}</h2>
                    <span className="pose-score">
                      {pick.score.toFixed(2).replace("-", "−")}
                      <small>kcal/mol</small>
                    </span>
                    <button
                      className="button primary"
                      onClick={() => setModal("structure")}
                    >
                      {l("Inspect in Mol*", "Mol*에서 자세히 보기")} ↗
                    </button>
                  </div>
                </>
              ) : null}
            </div>
            <div className="live-signal-path">
              <div>
                <span>{l("DESTINATION", "목적지")}</span>
                <strong>
                  {destination ? shortCompound(destination.name) : "—"}
                </strong>
              </div>
              <i>→</i>
              <div>
                <span>{l("REWARD INPUT", "보상 입력")}</span>
                <strong>{frame?.sensory[8]?.toFixed(2) ?? "—"}</strong>
              </div>
              <i>→</i>
              <div>
                <span>{l("NEURAL OUTPUT", "신경 출력")}</span>
                <strong>
                  {frame ? number(frame.spikeCount) + " spikes" : "—"}
                </strong>
              </div>
              <i>→</i>
              <div>
                <span>{l("MOTION", "움직임")}</span>
                <strong>
                  {fly ? Math.hypot(...fly.velocity).toFixed(2) : "—"}
                  <small> units/s</small>
                </strong>
              </div>
            </div>
          </div>
          <aside className="individual-panel">
            <div className="panel-title">
              <span>{l("Selected individual", "선택한 개체")}</span>
              <i className="status-dot" />
            </div>
            <div className="individual-selector">
              <button
                aria-label={l("Previous fly", "이전 개체")}
                onClick={() =>
                  selectFly((selectedFly + flyCount - 1) % flyCount)
                }
              >
                ‹
              </button>
              <strong>{flyName(selectedFly)}</strong>
              <button
                aria-label={l("Next fly", "다음 개체")}
                onClick={() => selectFly((selectedFly + 1) % flyCount)}
              >
                ›
              </button>
            </div>
            <div className="individual-live">
              <span className="eyebrow">
                {l("COMPUTED NEURAL ACTIVITY", "계산된 신경 활동")}
              </span>
              <div className="spike-number">
                {frame ? number(frame.spikeCount) : "—"}
                <small>spikes / step</small>
              </div>
              <LiveTrace
                identity={selectedFly}
                value={frame?.spikeCount}
                tick={frame?.tick}
              />
              <div className="readout-heading">
                <span>
                  {frame
                    ? "STEP " + number(frame.tick)
                    : l("Preparing engine", "계산 준비 중")}
                </span>
                <span>{active ? "LIVE" : status}</span>
              </div>
            </div>
            <div className="destination-card">
              <small>{l("CURRENT DESTINATION", "현재 목적지")}</small>
              <strong>
                {destination ? shortCompound(destination.name) : "—"}
              </strong>
              <span>
                {destination
                  ? shortTarget(destination.targetId)
                  : l("Waiting for the engine", "계산 준비 중")}
              </span>
            </div>
            <div className="preference-card">
              <div>
                <span>{l("Preference for", "이 후보의 선호도")}</span>
                <strong>{pick ? shortCompound(pick.name) : "—"}</strong>
              </div>
              <b>
                {pick && fly
                  ? Math.round((fly.learned[candidate] ?? 0) * 100)
                  : "—"}
                <small>%</small>
              </b>
            </div>
            <div className="meter">
              <i
                style={{ width: (fly?.learned[candidate] ?? 0) * 100 + "%" }}
              />
            </div>
            <p className="metric-explanation">
              {colony.training
                ? l(
                    "Updated from rewards during contact.",
                    "접촉 중 받는 보상으로 갱신됩니다.",
                  )
                : l(
                    "Frozen while learning is off.",
                    "학습이 꺼져 있어 선호값을 유지합니다.",
                  )}
            </p>
            <div className="region-activity">
              <span className="eyebrow">
                {l("NEURAL ACTIVITY BY REGION", "영역별 신경 활동")}
              </span>
              {REGIONS.map((r, i) => (
                <div key={r.id}>
                  <span>{r.label.toLowerCase().replace("vnc ", "")}</span>
                  <div>
                    <i
                      style={{
                        width: Math.min(100, (rates[i] / 0.3) * 100) + "%",
                        background: REGION_CSS[i],
                      }}
                    />
                  </div>
                  <b>
                    {frame && manifest
                      ? (rates[i] * 100).toFixed(1) + "%"
                      : "—"}
                  </b>
                </div>
              ))}
            </div>
            <div className="motor-readout">
              <span className="eyebrow">
                {l("DECODED MOTOR OUTPUT", "해독된 운동 출력")}
              </span>
              <div>
                {["Turn", "Climb", "Thrust"].map((x, i) => (
                  <span key={x}>
                    <small>{x}</small>
                    <b>{frame?.output[i]?.toFixed(2) ?? "—"}</b>
                  </span>
                ))}
              </div>
            </div>
          </aside>
        </div>
        <section
          className="colony-section"
          id="colony"
          aria-labelledby="colony-title"
        >
          <div className="compact-heading">
            <div>
              <span className="eyebrow">INDEPENDENT BRAINS</span>
              <h2 id="colony-title">
                {l("Same wiring. Different journeys.", "같은 연결. 다른 여정.")}
              </h2>
            </div>
            <p>
              {l(
                "Select any individual to follow its activity and flight.",
                "개체를 선택하면 해당 신경 활동과 비행을 추적할 수 있습니다.",
              )}
            </p>
          </div>
          <BrainGrid
            flies={colony.flies}
            pairs={pairs}
            selected={selectedFly}
            onSelect={selectFly}
            names={FLY_NAMES}
            count={flyCount}
          />
        </section>
        <section className="residence-section">
          <div className="compact-heading">
            <div>
              <span className="eyebrow">
                OBSERVED BEHAVIOR · LAST 3 MINUTES
              </span>
              <h2>{l("Where are they staying?", "어디에 머물고 있을까요?")}</h2>
            </div>
            <p>
              {l(
                "Observed residence is different from a docking score or a learned value.",
                "관측된 체류율은 도킹 점수·학습값과 서로 다른 지표입니다.",
              )}
            </p>
          </div>
          <div className="residence-chart">
            {pairs.map((p, i) => {
              const share = totalResidence
                ? ((colony.recentResidence[i] ?? 0) / totalResidence) * 100
                : 0;
              return (
                <button
                  key={p.id}
                  aria-pressed={candidate === i}
                  onClick={() => {
                    setCandidate(i);
                    setView("molecule");
                  }}
                >
                  <span>
                    <strong>{shortCompound(p.name)}</strong>
                    <small>{shortTarget(p.targetId)}</small>
                  </span>
                  <div>
                    <i style={{ height: share + "%" }} />
                  </div>
                  <b>{totalResidence ? share.toFixed(1) + "%" : "—"}</b>
                </button>
              );
            })}
            {!totalResidence && (
              <span className="residence-empty">
                {l("Waiting for the first visits", "첫 방문을 기다립니다")}
              </span>
            )}
          </div>
        </section>
        <details className="loop-guide">
          <summary>
            {l(
              "How does docking become a learned preference?",
              "도킹 점수에서 선호 학습까지, 어떻게 작동할까요?",
            )}
            <span>+</span>
          </summary>{" "}
          <section className="signal-section" aria-labelledby="signal-title">
            <div className="section-heading">
              <div>
                <span className="eyebrow">01 / THE IDEA</span>
                <h2 id="signal-title">
                  {l("Follow the signal.", "신호를 따라가 보세요.")}
                </h2>
              </div>
              <p>
                {l(
                  "From a molecular fit to a learned preference. Five steps, one continuous loop.",
                  "분자가 들어맞는 자세에서 학습된 선호까지. 다섯 단계가 하나의 루프로 이어집니다.",
                )}
              </p>
            </div>
            <div
              className="signal-tabs"
              role="tablist"
              aria-label={l("How the experiment works", "실험의 작동 원리")}
            >
              {stepNames.map((s, i) => (
                <button
                  key={s[0]}
                  id={"flow-tab-" + i}
                  role="tab"
                  aria-selected={step === i}
                  aria-controls="signal-panel"
                  tabIndex={step === i ? 0 : -1}
                  onKeyDown={(e) => tabKeys(e, i)}
                  onClick={() => setStep(i)}
                >
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <strong>{s[lang === "ko" ? 1 : 0]}</strong>
                  <i aria-hidden="true">{i === 4 ? "↺" : "→"}</i>
                </button>
              ))}
            </div>
            <div
              className="signal-panel"
              id="signal-panel"
              role="tabpanel"
              aria-labelledby={"flow-tab-" + step}
            >
              <div>
                <span
                  className={
                    "evidence-tag " +
                    ([1, 3, 4].includes(step) ? "authored" : "")
                  }
                >
                  {[1, 3, 4].includes(step)
                    ? l("Authored model", "설계된 모델")
                    : l("Computed from data", "데이터에서 계산")}
                </span>
                <h3>{stepCopy[step][0]}</h3>
                <p>{stepCopy[step][1]}</p>
              </div>
              <div className="signal-metric">
                <small>{stepCopy[step][3]}</small>
                <strong>{stepCopy[step][2]}</strong>
                <button
                  className="text-button"
                  onClick={() => setStep((step + 1) % 5)}
                >
                  {l("Next step", "다음 단계")} →
                </button>
              </div>
            </div>
          </section>
        </details>
        <div className="science-footnote">
          {l(
            "Measured connectivity · Computed docking and spikes · Authored learning and movement. A research model, not evidence of drug efficacy.",
            "실측 연결 · 계산된 도킹과 스파이크 · 설계된 학습과 이동. 약효를 입증하는 실험이 아닌 연구 모델입니다.",
          )}
          <button className="text-button" onClick={() => setModal("methods")}>
            {l("Methods, sources & limits", "방법·출처·한계")} ↗
          </button>
        </div>
      </main>
      <footer className="site-footer">
        <span>FDDD / LIVE LAB v3.0.0</span>
        <a href="https://github.com/cobanov/fly-connectome-template">
          Built with fly-connectome-template by Mert Cobanov ↗
        </a>
        <a href="/THIRD_PARTY_NOTICES.txt">Credits & licenses ↗</a>
      </footer>
      {modal === "film" && (
        <Modal
          title={l("FDDD · Motion showreel", "FDDD · 모션 쇼릴")}
          onClose={() => setModal(null)}
          wide
          closeLabel={l("Close", "닫기")}
        >
          <iframe
            className="film-frame"
            src="/showreel/v1.1.0/index.html"
            title="FDDD English motion showreel"
            allow="autoplay"
          />
          <p className="modal-note">
            {l(
              "A film made from recorded computations. Your live experiment continues in the background.",
              "계산 기록으로 만든 영상입니다. 실제 실험은 배경에서 계속 실행됩니다.",
            )}
          </p>
        </Modal>
      )}
      {modal === "structure" && pick && (
        <Modal
          title={shortTarget(pick.targetId) + " / " + shortCompound(pick.name)}
          onClose={() => setModal(null)}
          wide
          closeLabel={l("Close", "닫기")}
        >
          <Suspense
            fallback={
              <div className="structure-loading">
                {l(
                  "Opening molecular inspection…",
                  "분자 구조 뷰어를 여는 중…",
                )}
              </div>
            }
          >
            <MolecularStudio
              receptorPath={pick.receptorUrl}
              posePath={pick.poseUrl}
              name={pick.targetName + " / " + pick.name}
            />
          </Suspense>
          <p className="modal-note">
            {l(
              "Experimental receptor coordinates and the top-ranked Vina pose. The live colony continues behind this view.",
              "실험 수용체 좌표와 Vina 1순위 자세입니다. 개체군 계산은 배경에서 계속됩니다.",
            )}
          </p>
        </Modal>
      )}
      {modal === "methods" && (
        <Modal
          title={l("What you are seeing", "지금 보고 있는 것")}
          onClose={() => setModal(null)}
          closeLabel={l("Close", "닫기")}
        >
          <div className="methods-content">
            <p className="modal-lead">
              {l(
                "A browser experiment connecting molecular docking rewards to the behavior of independent fruit-fly neural models.",
                "분자 도킹의 보상을 독립적인 초파리 신경망 모델의 행동으로 연결하는 브라우저 실험입니다.",
              )}
            </p>
            <div className="method-grid">
              <article>
                <span className="evidence-tag">
                  {l("Measured / computed", "측정·계산")}
                </span>
                <h3>{l("The evidence", "사용한 근거")}</h3>
                <ul>
                  <li>
                    MaleCNS v1.0: {number(CNS.neuronCount)}{" "}
                    {l("selected neurons;", "개 선택 뉴런,")}{" "}
                    {number(CNS.edgeCount)}{" "}
                    {l(
                      "directed connections per fly.",
                      "개 방향성 연결 / 개체.",
                    )}
                  </li>
                  <li>
                    {number(CNS.displayCount)}{" "}
                    {l(
                      "measured soma locations are displayed. The full selected population is computed. The 7,000 displayed links are sampled from real directed connections; curved paths and travelling light are visual guides, not neurite geometry or measured propagation speed.",
                      "개 실측 세포체 위치를 표시하고 선택된 전체 뉴런을 계산합니다. 표시한 연결선 7,000개는 실제 방향성 연결의 표본입니다. 곡선 경로와 빛의 이동은 시각적 표현이며 실제 신경돌기 형태나 측정된 전파 속도가 아닙니다.",
                    )}
                  </li>
                  <li>
                    {l(
                      "Eight executed Vina combinations, three proteins, six distinct molecules. Experimental receptor structures and calculated poses.",
                      "실행된 Vina 조합 8개, 단백질 3종, 분자 6종. 실험 수용체 구조와 계산된 결합 자세를 사용합니다.",
                    )}
                  </li>
                  <li>
                    {l(
                      "Every spike count and motor readout comes from the live leaky integrate-and-fire (LIF) neural model.",
                      "스파이크 수와 운동 출력은 입력을 누적하고 일부를 누설하며 문턱값에서 발화하는 leaky integrate-and-fire (LIF) 모델의 실시간 계산에서 나옵니다.",
                    )}
                  </li>
                </ul>
              </article>
              <article>
                <span className="evidence-tag authored">
                  {l("Authored / modeled", "설계·모델")}
                </span>
                <h3>{l("The interpretation", "해석의 범위")}</h3>
                <ul>
                  <li>
                    {l(
                      "Score-to-reward mapping, sensory inputs, preference learning, steering, and residence rules are engineered.",
                      "점수의 보상 변환, 감각 입력, 선호 학습, 이동·체류 규칙은 설계한 것입니다.",
                    )}
                  </li>
                  <li>
                    {l(
                      "The model learns from known scores; it does not independently discover binding strength.",
                      "모델은 알려진 점수로 학습하며 결합력을 독립적으로 발견하지 않습니다.",
                    )}
                  </li>
                  <li>
                    {l(
                      "Cross-target scores are not calibrated affinities. No drug efficacy or validated fly behavior is claimed.",
                      "표적 간 점수는 보정된 결합 친화도가 아닙니다. 약효나 검증된 초파리 행동을 주장하지 않습니다.",
                    )}
                  </li>
                  <li>
                    {l(
                      "Glow and viewing motion are presentation effects. Fly avatars are not on the molecular physical scale.",
                      "빛 번짐과 관찰 시점의 회전은 표시 효과입니다. 개체 아바타와 분자는 실제 물리적 축척이 다릅니다.",
                    )}
                  </li>
                </ul>
              </article>
            </div>
            <details>
              <summary>
                {l("Neuron selection and model scope", "뉴런 선택과 모델 범위")}
              </summary>
              <p>
                {l(
                  "167,122 includes 165,122 Traced neurons and 2,000 additional annotated rows. Of those additions, 1,991 are labeled Out of scope. Connections with fewer than five synapses are excluded. This is a selected, filtered brain + ventral nerve cord model from one male specimen.",
                  "167,122개에는 Traced 뉴런 165,122개와 추가 주석 행 2,000개가 포함됩니다. 추가분 중 1,991개는 Out of scope로 표시됩니다. 시냅스가 5개 미만인 연결은 제외했습니다. 수컷 한 개체의 뇌와 복측 신경삭에서 선택·필터링한 모델입니다.",
                )}
              </p>
            </details>
            <div className="method-links">
              <a
                href="/data/malecns/NOTICE.md"
                target="_blank"
                rel="noreferrer"
              >
                MaleCNS provenance ↗
              </a>
              <a
                href="/data/docking/multi-target.json"
                target="_blank"
                rel="noreferrer"
              >
                Executed docking data ↗
              </a>
              <a
                href="https://github.com/AwesomeZun/FDDD"
                target="_blank"
                rel="noreferrer"
              >
                Source code & methods ↗
              </a>
            </div>
          </div>
        </Modal>
      )}
      {modal === "session" && (
        <Modal
          title={l("Your session", "현재 세션")}
          onClose={() => setModal(null)}
          closeLabel={l("Close", "닫기")}
        >
          <div className="session-content">
            <div className="session-stats">
              <span>
                <strong>{number(colony.steps)}</strong>
                {l("brain steps recorded", "기록한 뇌 계산 스텝")}
              </span>
              <span>
                <strong>
                  {(colony.bytes / 1048576).toFixed(1)}
                  <small> MB</small>
                </strong>
                {l("raw spike data", "원시 스파이크 데이터")}
              </span>
            </div>
            <p>
              {l(
                "Neural computation runs on your device. Recordings stay in this browser’s IndexedDB and are never uploaded. Inactive session recordings are cleaned up; recordings in other active tabs are kept.",
                "신경망 계산은 이 기기에서 실행됩니다. 기록은 이 브라우저의 IndexedDB에만 남으며 업로드되지 않습니다. 종료된 세션의 기록을 정리하며 다른 활성 탭의 기록은 유지합니다.",
              )}
            </p>
            {publicMode !== false ? (
              <p>
                {l(
                  `The public demo stores up to ${PUBLIC_CAP / 1048576} MB. At the limit, recording stops and live computation continues. Project-folder export is available when running the local project server.`,
                  `공개 데모는 최대 ${PUBLIC_CAP / 1048576} MB를 기록합니다. 한도에 도달하면 기록만 멈추고 계산은 계속합니다. 프로젝트 폴더 저장은 로컬 프로젝트 서버에서 사용할 수 있습니다.`,
                )}
              </p>
            ) : (
              <>
                <p>
                  {l(
                    "This local server can save the current recordings to public/data/records/. Export pauses the colony; resume it when you are ready.",
                    "현재 로컬 서버에서는 public/data/records/에 기록을 저장할 수 있습니다. 저장 중에는 개체군이 일시정지되며, 저장 후 다시 시작할 수 있습니다.",
                  )}
                </p>
                <button
                  className="button primary"
                  disabled={!colony.steps || colony.exporting}
                  onClick={() => void colony.exportRecords()}
                >
                  {colony.exporting
                    ? l("Saving…", "저장 중…")
                    : l("Save records to project", "프로젝트에 기록 저장")}
                </button>
              </>
            )}
            {colony.exportStatus !== "idle" && (
              <p role="status">
                {colony.exportStatus === "saved"
                  ? l("Saved to ", "저장 완료: ") + colony.savedPath
                  : colony.exportStatus === "error"
                    ? l(
                        "Export failed. Browser recordings are retained.",
                        "저장에 실패했습니다. 브라우저 기록은 유지됩니다.",
                      )
                    : l(
                        "Saving recorded segments…",
                        "기록을 저장하고 있습니다…",
                      )}
              </p>
            )}
          </div>
        </Modal>
      )}
      {pendingCount !== null && (
        <Modal
          title={l("Start a new colony?", "새 개체군을 시작할까요?")}
          onClose={() => setPendingCount(null)}
          closeLabel={l("Close", "닫기")}
        >
          <div className="session-content">
            <p>
              {l(
                `Changing to ${pendingCount} brains restarts the experiment. Current learned preferences will reset. Pause and learning settings are kept. Recordings in other active tabs are preserved.`,
                `${pendingCount}개 개체로 바꾸면 실험이 다시 시작됩니다. 현재 학습된 선호값을 초기화합니다. 일시정지·학습 설정과 다른 활성 탭의 기록은 유지합니다.`,
              )}
            </p>
            <div className="modal-actions">
              <button
                className="button secondary"
                onClick={() => setPendingCount(null)}
              >
                {l("Keep this session", "현재 세션 유지")}
              </button>
              <button
                className="button primary"
                onClick={() => {
                  setFlyCount(pendingCount);
                  setSelectedFly(0);
                  setPendingCount(null);
                }}
              >
                {l("Start new colony", "새 개체군 시작")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
export function Platform() {
  const state = useLangState();
  return (
    <LangContext.Provider value={state}>
      <Lab />
    </LangContext.Provider>
  );
}
