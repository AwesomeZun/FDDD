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
  const [view, setView] = useState<"habitat" | "molecule">("habitat"),
    [follow, setFollow] = useState(false),
    [reset, setReset] = useState(0);
  const [modal, setModal] = useState<
      "methods" | "film" | "structure" | "session" | null
    >(null),
    [pendingCount, setPendingCount] = useState<number | null>(null);
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
      className="platform"
      data-version="2.0.0"
      data-ready={colony.ready}
      data-paused={colony.paused}
    >
      <a className="skip-link" href="#experiment">
        {l("Skip to the experiment", "실험으로 바로 가기")}
      </a>
      <header className="site-header">
        <a className="wordmark" href="#observatory" aria-label="FDDD home">
          <span className="brand-symbol" aria-hidden="true">
            f.
          </span>
          <strong>
            FDDD<span>FLY-DRIVEN DRUG DEVELOPMENT</span>
          </strong>
        </a>
        <nav aria-label={l("Main navigation", "주 메뉴")}>
          <a href="#observatory">{l("Observatory", "관측실")}</a>
          <a href="#experiment">{l("Experiment", "실험")}</a>
          <a href="#colony">{l("Colony", "개체군")}</a>
        </nav>
        <div className="header-tools">
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
            GitHub <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>
      <main>
        <section
          className="observatory"
          id="observatory"
          aria-labelledby="hero-title"
        >
          <div className="hero-copy">
            <div className="eyebrow">
              <i className="tiny-cross" />{" "}
              {l(
                "A living experiment. In your browser.",
                "브라우저 안에서 움직이는 실험.",
              )}
            </div>
            <h1 id="hero-title">
              {l("Small brain.", "작은 뇌.")}
              <br />
              <em>{l("Big questions.", "커다란 질문.")}</em>
            </h1>
            <p className="hero-description">
              {l(
                "Real neural connections. Real docking results. Watch fruit-fly models explore molecules—and learn a preference.",
                "실측 신경 연결과 실제 도킹 결과. 초파리 모델이 분자들을 탐색하고 선호를 배우는 과정을 관찰하세요.",
              )}
            </p>
            <div className="hero-actions">
              <a className="button primary" href="#experiment">
                {l("Explore the experiment", "실험 살펴보기")} <span>↘</span>
              </a>
              <button
                className="text-button film-button"
                onClick={() => setModal("film")}
              >
                <i className="play-icon" aria-hidden="true" />
                {l("Watch the film", "쇼릴 보기")}
                <small>30 SEC</small>
              </button>
            </div>
            <div className="hero-proof">
              <span>
                <i className="status-dot" />
                {l("Computed on your device", "이 기기에서 직접 계산")}
              </span>
              <span>
                {l("Research demo · open source", "연구 데모 · 오픈 소스")}
              </span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="orbital orbital-one" aria-hidden="true" />
            <div className="orbital orbital-two" aria-hidden="true" />
            <div className="visual-topline">
              <span className="eyebrow">MALECNS / NEURAL OBSERVATORY</span>
              <span className="coordinate-mark">
                01—{String(flyCount).padStart(2, "0")}
              </span>
            </div>
            <NeuralObservatory
              identity={selectedFly}
              frame={frame}
              paused={colony.paused}
              resetKey={reset}
            />
            <div className="brain-caption">
              <span className="caption-line" />
              <div>
                <strong>167,122</strong>
                <span>
                  {l(
                    "neurons. One independent model.",
                    "개의 뉴런. 하나의 독립적인 모델.",
                  )}
                </span>
              </div>
            </div>
            <div className="visual-bottomline">
              <span>
                <i className={"status-dot " + (active ? "active" : "")} />
                {status}
              </span>
              <button
                className="text-button"
                onClick={() => setReset((n) => n + 1)}
              >
                {l("Reset view", "시점 초기화")} ↻
              </button>
            </div>
            <div className="neural-readout">
              <div className="readout-heading">
                <span>{flyName(selectedFly)}</span>
                <span>
                  {frame ? "STEP " + number(frame.tick) : "AWAITING ENGINE"}
                </span>
              </div>
              <div className="spike-number">
                {frame ? number(frame.spikeCount) : "—"}
                <small>{l("spikes / step", "스파이크 / 스텝")}</small>
              </div>
              <LiveTrace
                identity={selectedFly}
                value={frame?.spikeCount}
                tick={frame?.tick}
              />
              <span className="readout-foot">
                {l(
                  "Observed activity · selected individual",
                  "관측된 활동 · 선택한 개체",
                )}
              </span>
            </div>
          </div>
          <div className="hero-bottom">
            <span className="sample-note">
              {l(
                "Measured soma positions · brightness follows computed activity",
                "실측 세포체 위치 · 밝기는 계산된 활동을 표시합니다",
              )}
              <small>
                {number(CNS.displayCount)}{" "}
                {l(
                  "displayed / all selected neurons computed",
                  "개 표시 / 선택된 전체 뉴런 계산",
                )}
              </small>
            </span>
            <span className="scroll-note">
              {l("FOLLOW THE SIGNAL", "신호를 따라 살펴보기")} <span>↓</span>
            </span>
          </div>
        </section>
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
                  "evidence-tag " + ([1, 3, 4].includes(step) ? "authored" : "")
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
        <section
          className="experiment-section"
          id="experiment"
          aria-labelledby="experiment-title"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">02 / THE EXPERIMENT</span>
              <h2 id="experiment-title">
                {l(
                  "Observe. Compare. Explore.",
                  "관찰하고, 비교하고, 탐색하세요.",
                )}
              </h2>
            </div>
            <p>
              {l(
                "Select a candidate to inspect its docking result. Select a fly to follow its own learning.",
                "후보를 선택해 도킹 결과를 보고, 개체를 선택해 각자의 학습을 관찰하세요.",
              )}
            </p>
          </div>
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
            <div className="world-panel">
              <div className="world-header">
                <div
                  role="group"
                  aria-label={l("Observation view", "관찰 화면")}
                >
                  <button
                    className={view === "habitat" ? "selected" : ""}
                    aria-pressed={view === "habitat"}
                    onClick={() => setView("habitat")}
                  >
                    {l("Living habitat", "탐색 서식지")}
                  </button>
                  <button
                    className={view === "molecule" ? "selected" : ""}
                    aria-pressed={view === "molecule"}
                    disabled={!pick}
                    onClick={() => setView("molecule")}
                  >
                    {l("Docking pose", "도킹 자세")}
                  </button>
                </div>
                <span className="dimension-tag">INTERACTIVE 3D</span>
              </div>
              <div className="world-viewport">
                {view === "habitat" ? (
                  <ColonyHabitat
                    pairs={pairs}
                    flies={colony.flies}
                    paused={colony.paused}
                    selected={selectedFly}
                    onSelect={selectFly}
                    follow={follow}
                  />
                ) : pick ? (
                  <MoleculeScene pair={pick} />
                ) : null}
                {view === "habitat" ? (
                  <div className="world-overlay">
                    <span>
                      {l(
                        "A shared world. Independent brains.",
                        "같은 공간. 독립적인 뇌.",
                      )}
                    </span>
                    <button
                      className={"follow-button " + (follow ? "selected" : "")}
                      aria-pressed={follow}
                      onClick={() => setFollow(!follow)}
                    >
                      {follow
                        ? l("Stop following", "추적 중지")
                        : l("Follow", "추적")}{" "}
                      {flyName(selectedFly)} <span>⌖</span>
                    </button>
                  </div>
                ) : (
                  pick && (
                    <div className="pose-overlay">
                      <span className="eyebrow">
                        {shortTarget(pick.targetId)} / VINA POSE 01
                      </span>
                      <strong>{shortCompound(pick.name)}</strong>
                      <span className="pose-score">
                        {pick.score.toFixed(2).replace("-", "−")}
                        <small>kcal/mol</small>
                      </span>
                      <button
                        className="button secondary"
                        onClick={() => setModal("structure")}
                      >
                        {l("Inspect in Mol*", "Mol*에서 자세히 보기")} ↗
                      </button>
                    </div>
                  )
                )}
              </div>
              <div className="world-caption">
                <span>
                  {l("Drag to orbit", "드래그로 회전")}{" "}
                  <span aria-hidden="true">·</span>{" "}
                  {view === "habitat"
                    ? l("Scroll to zoom", "스크롤로 확대")
                    : l(
                        "Experimental coordinates + computed pose",
                        "실험 구조 좌표 + 계산된 자세",
                      )}
                </span>
                <span>
                  {view === "habitat"
                    ? l(
                        "Fly avatars are not to molecular scale.",
                        "초파리와 분자의 물리적 축척은 다릅니다.",
                      )
                    : l(
                        "Selecting a candidate does not steer a fly.",
                        "후보 선택은 개체의 이동을 바꾸지 않습니다.",
                      )}
                </span>
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
                    <b>{frame && manifest ? (rates[i] * 100).toFixed(1) + "%" : "—"}</b>
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
          <div className="outcome-panel">
            <div>
              <span className="eyebrow">
                {l("OBSERVED OUTCOME", "관측된 결과")}
              </span>
              <h3>
                {l("Where do they choose to stay?", "어디에 머물고 있을까요?")}
              </h3>
              <p>
                {l(
                  "Share of recorded near-candidate residence in the last 3 minutes. This changes as the colony explores.",
                  "최근 3분 동안 후보 근처에 머문 시간의 비율입니다. 개체군의 탐색에 따라 달라집니다.",
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
                    onClick={() => setCandidate(i)}
                    title={p.targetName + " / " + p.name}
                  >
                    <span>
                      <strong>{shortCompound(p.name)}</strong>
                      <small>{shortTarget(p.targetId)}</small>
                    </span>
                    <div>
                      <i style={{ height: Math.max(0, share) + "%" }} />
                    </div>
                    <b>{totalResidence ? share.toFixed(1) + "%" : "—"}</b>
                  </button>
                );
              })}
              {!totalResidence && (
                <span className="residence-empty">
                  {l(
                    "Collecting the first visits…",
                    "첫 방문을 기록하고 있습니다…",
                  )}
                </span>
              )}
            </div>
          </div>
        </section>
        <section
          className="colony-section"
          id="colony"
          aria-labelledby="colony-title"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">03 / THE COLONY</span>
              <h2 id="colony-title">
                {l(
                  "Same wiring. Different journeys.",
                  "같은 연결. 서로 다른 여정.",
                )}
              </h2>
            </div>
            <p>
              {l(
                "Every fly runs an independent neural model. Select any individual to bring its activity into focus.",
                "모든 개체가 독립적인 신경망 모델을 실행합니다. 개체를 선택하면 해당 활동을 자세히 볼 수 있습니다.",
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
          <div className="colony-summary">
            <span>
              <b>{flyCount}</b> {l("independent brains", "개의 독립적 신경망")}
            </span>
            <span>
              <b>{number(flyCount * CNS.neuronCount)}</b>{" "}
              {l("neurons computed per colony step", "개 뉴런 / 개체군 스텝")}
            </span>
            <a href="#observatory">
              {l("Return to", "활동 보기:")} {flyName(selectedFly)} ↑
            </a>
          </div>
        </section>
        <section className="reality-section">
          <div>
            <span className="eyebrow">
              BUILT ON REAL DATA. CLEAR ABOUT THE MODEL.
            </span>
            <h2>
              {l("Real signals.", "실제 신호.")}
              <br />
              <em>{l("Honest boundaries.", "명확한 해석 범위.")}</em>
            </h2>
          </div>
          <div>
            <p>
              {l(
                "Measured neural wiring. Executed docking. Computed spikes. The learning policy and movement rules are designed models—not proof of a drug’s efficacy or a complete biological fly.",
                "실측 신경 연결, 실행된 도킹, 계산된 스파이크를 사용합니다. 학습 정책과 이동 규칙은 설계된 모델이며, 약효의 증명이나 초파리 생물학 전체의 재현을 뜻하지 않습니다.",
              )}
            </p>
            <button
              className="button secondary"
              onClick={() => setModal("methods")}
            >
              {l("Methods, sources & limits", "방법·출처·한계")} ↗
            </button>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <a className="footer-wordmark" href="#observatory">
          FDDD<span>FLY-DRIVEN DRUG DEVELOPMENT</span>
        </a>
        <div>
          <span>MaleCNS v1.0 · CC BY 4.0</span>
          <span>AutoDock Vina / Webina · Mol* · fly-connectome-template</span>
          <a href="https://github.com/cobanov/fly-connectome-template">
            Built with fly-connectome-template by Mert Cobanov ↗
          </a>
        </div>
        <div>
          <a href="/THIRD_PARTY_NOTICES.txt">
            {l("Credits & licenses", "크레딧과 라이선스")} ↗
          </a>
          <span>FDDD / v2.0.0</span>
        </div>
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
                      "measured soma locations are displayed. The full selected population is computed.",
                      "개 실측 세포체 위치를 표시하고 선택된 전체 뉴런을 계산합니다.",
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
                "Neural computation runs on your device. Recordings stay in this browser’s IndexedDB and are never uploaded. Starting a new session replaces earlier-session recordings.",
                "신경망 계산은 이 기기에서 실행됩니다. 기록은 이 브라우저의 IndexedDB에만 남으며 업로드되지 않습니다. 새 세션을 시작하면 이전 세션의 기록을 교체합니다.",
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
                `Changing to ${pendingCount} brains restarts the experiment. Current learned preferences and earlier-session browser recordings will be replaced. Pause and learning settings are kept.`,
                `${pendingCount}개 개체로 바꾸면 실험이 다시 시작됩니다. 현재 학습된 선호와 이전 세션의 브라우저 기록을 교체합니다. 일시정지와 학습 설정은 유지합니다.`,
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
