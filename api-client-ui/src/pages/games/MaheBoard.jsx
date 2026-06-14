import { useMemo } from "react";
import { Crown, Dices, Shield } from "lucide-react";
import { getTabletopSeatNo } from "../../adapters/tabletopGameAdapter.js";

const get = (obj, snake, camel, fallback = undefined) => obj?.[camel] ?? obj?.[snake] ?? fallback;
const listOf = (value) => (Array.isArray(value) ? value : []);
const seatNoOf = (player) => Number(getTabletopSeatNo(player) || 0);

const TabletopHistoryEmptyArt = ({ tone = "slate", gameLabel = "기록", nextLabel = "첫 행동" }) => {
  const palette = {
    slate: { bg: "#0f172a", node: "#38bdf8", accent: "#f59e0b", line: "#e2e8f0", soft: "#dbeafe" },
    blokus: { bg: "#111827", node: "#06b6d4", accent: "#a855f7", line: "#e0f2fe", soft: "#cffafe" },
    mahe: { bg: "#064e3b", node: "#22c55e", accent: "#facc15", line: "#dcfce7", soft: "#bbf7d0" },
    catan: { bg: "#451a03", node: "#f59e0b", accent: "#0ea5e9", line: "#fef3c7", soft: "#fde68a" },
    "six-nimmt": { bg: "#7f1d1d", node: "#f97316", accent: "#84cc16", line: "#fff7ed", soft: "#fed7aa" },
  }[tone] || {
    bg: "#0f172a",
    node: "#38bdf8",
    accent: "#f59e0b",
    line: "#e2e8f0",
    soft: "#dbeafe",
  };
  const nodes = [
    { key: "start", x: 48, y: 66, label: "시작", fill: palette.node },
    { key: "action", x: 128, y: 38, label: nextLabel, fill: palette.accent },
    { key: "log", x: 208, y: 70, label: "기록", fill: "#64748b" },
  ];
  return (
    <svg
      viewBox="0 0 260 116"
      role="img"
      aria-label={`${gameLabel} 첫 기록 대기 안내`}
      className="h-auto w-full"
      data-smoke="tabletop-history-empty-art"
    >
      <rect x="8" y="8" width="244" height="100" rx="18" fill={palette.bg} />
      <path d="M48 66C78 20 112 28 140 48s55 44 88 6" fill="none" stroke={palette.line} strokeWidth="5" strokeLinecap="round" opacity=".82" />
      <rect x="28" y="84" width="204" height="12" rx="6" fill={palette.soft} opacity=".22" />
      {nodes.map((node) => (
        <g key={node.key} data-smoke="tabletop-history-empty-node" data-history-node={node.key}>
          <circle cx={node.x} cy={node.y} r="17" fill={node.fill} stroke="#ffffff" strokeWidth="4" />
          <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="8" fontWeight="900" fill="#ffffff">{node.label}</text>
        </g>
      ))}
      <text x="22" y="26" fontSize="9" fontWeight="900" fill="#bfdbfe">최근 행동</text>
      <text x="238" y="26" textAnchor="end" fontSize="9" fontWeight="900" fill="#e2e8f0">{gameLabel}</text>
    </svg>
  );
};

const TabletopHistoryEmptyState = ({
  game = "tabletop",
  title = "아직 기록이 없습니다",
  detail = "첫 행동이 끝나면 이 영역에 최근 기록이 쌓입니다.",
  nextAction = "첫 행동",
}) => {
  const gameLabel = game === "mahe" ? "마헤" : title;
  const items = [
    { label: "현재 상태", value: "기록 대기", detail: "아직 서버가 전달한 행동 로그가 없습니다." },
    { label: "다음 변화", value: nextAction, detail: "첫 행동이 처리되면 최근 기록, 주체, 결과가 같은 위치에 표시됩니다." },
  ];
  return (
    <div
      className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50 p-2"
      data-smoke="tabletop-history-empty-state"
      data-history-game={game}
    >
      <div className="grid gap-2 sm:grid-cols-[minmax(0,190px)_1fr]">
        <div className="overflow-hidden rounded-lg bg-slate-950">
          <TabletopHistoryEmptyArt tone={game} gameLabel={gameLabel} nextLabel={nextAction} />
        </div>
        <div className="min-w-0 p-1">
          <div className="text-xs font-black text-slate-900">{title}</div>
          <div className="mt-1 text-[11px] font-bold leading-relaxed text-slate-500">{detail}</div>
          <div className="mt-2 grid gap-1.5">
            {items.map((item) => (
              <div key={item.label} className="rounded-lg bg-white px-2 py-1.5" data-smoke="tabletop-history-empty-item">
                <div className="text-[9px] font-black text-slate-400">{item.label}</div>
                <div className="text-[11px] font-black text-slate-900">{item.value}</div>
                <div className="text-[10px] font-bold leading-snug text-slate-500">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const maheEventLabels = {
  ROLL_DIE: "주사위",
  STOP_ROLLING: "멈춤",
  CHOOSE_DICE_COUNT: "주사위 개수 지시",
  MOVE: "이동",
  SCORE: "알 획득",
  BUST: "실패",
};

const maheRiskToneClasses = {
  ready: "border-slate-100 bg-slate-50 text-slate-600",
  safe: "border-emerald-100 bg-emerald-50 text-emerald-700",
  caution: "border-amber-100 bg-amber-50 text-amber-700",
  danger: "border-rose-100 bg-rose-50 text-rose-700",
  bust: "border-rose-200 bg-rose-100 text-rose-800",
};

const buildMaheDiceSumRows = (diceCount) => {
  const sums = new Map();
  const walk = (depth, sum) => {
    if (depth === diceCount) {
      sums.set(sum, (sums.get(sum) || 0) + 1);
      return;
    }
    for (let face = 1; face <= 6; face += 1) {
      walk(depth + 1, sum + face);
    }
  };
  walk(0, 0);
  return Array.from(sums.entries())
    .map(([sum, ways]) => ({ sum, ways }))
    .sort((left, right) => left.sum - right.sum);
};

const maheDiceSumsByCount = {
  1: buildMaheDiceSumRows(1),
  2: buildMaheDiceSumRows(2),
  3: buildMaheDiceSumRows(3),
};

const summarizeMaheDiceChoice = (diceCount, activePosition, trackSize) => {
  const rows = maheDiceSumsByCount[diceCount] || [];
  const totalWays = rows.reduce((sum, row) => sum + row.ways, 0);
  const safeRows = rows.filter((row) => row.sum <= 7);
  const safeWays = safeRows.reduce((sum, row) => sum + row.ways, 0);
  const bustWays = totalWays - safeWays;
  const scoreWays = safeRows.reduce((sum, row) => {
    const steps = row.sum * diceCount;
    return sum + (activePosition + steps >= trackSize ? row.ways : 0);
  }, 0);
  const safeSteps = safeRows.map((row) => row.sum * diceCount);
  const expectedSafeSteps = safeWays
    ? safeRows.reduce((sum, row) => sum + row.sum * diceCount * row.ways, 0) / safeWays
    : 0;

  return {
    diceCount,
    safePercent: totalWays ? Math.round((safeWays / totalWays) * 100) : 0,
    bustPercent: totalWays ? Math.round((bustWays / totalWays) * 100) : 0,
    scorePercent: totalWays ? Math.round((scoreWays / totalWays) * 100) : 0,
    minSafeSteps: safeSteps.length ? Math.min(...safeSteps) : 0,
    maxSafeSteps: safeSteps.length ? Math.max(...safeSteps) : 0,
    expectedSafeSteps: Math.round(expectedSafeSteps * 10) / 10,
  };
};

const maheTurtleSvgPalettes = [
  { shell: "#34d399", shellStroke: "#047857", body: "#bef264", bodyStroke: "#65a30d", text: "#064e3b" },
  { shell: "#38bdf8", shellStroke: "#0369a1", body: "#a5f3fc", bodyStroke: "#0891b2", text: "#0c4a6e" },
  { shell: "#fcd34d", shellStroke: "#b45309", body: "#fde68a", bodyStroke: "#d97706", text: "#78350f" },
  { shell: "#fb7185", shellStroke: "#be123c", body: "#fbcfe8", bodyStroke: "#db2777", text: "#881337" },
  { shell: "#a78bfa", shellStroke: "#6d28d9", body: "#f0abfc", bodyStroke: "#c026d3", text: "#4c1d95" },
  { shell: "#2dd4bf", shellStroke: "#0f766e", body: "#a7f3d0", bodyStroke: "#059669", text: "#134e4a" },
  { shell: "#fdba74", shellStroke: "#c2410c", body: "#fde68a", bodyStroke: "#d97706", text: "#7c2d12" },
  { shell: "#cbd5e1", shellStroke: "#475569", body: "#e2e8f0", bodyStroke: "#64748b", text: "#0f172a" },
];

const MaheTurtleArt = ({ seatNo, compact = false, className = "" }) => {
  const svgPalette = maheTurtleSvgPalettes[(Number(seatNo) - 1) % maheTurtleSvgPalettes.length] || maheTurtleSvgPalettes[0];
  const label = `${seatNo}번 거북이`;
  return (
    <svg
      viewBox="0 0 96 72"
      className={`${compact ? "h-6 w-8" : "h-8 w-11"} shrink-0 ${className}`}
      title={label}
      aria-label={label}
      role="img"
      data-smoke="mahe-turtle-token"
    >
      <g data-smoke="mahe-turtle-art">
        <ellipse cx="70" cy="38" rx="13" ry="11" fill={svgPalette.body} stroke={svgPalette.bodyStroke} strokeWidth="4" />
        <path d="M20 36l-11 8 11 8z" fill={svgPalette.body} stroke={svgPalette.bodyStroke} strokeWidth="4" strokeLinejoin="round" />
        <ellipse cx="33" cy="18" rx="10" ry="7" fill={svgPalette.body} stroke={svgPalette.bodyStroke} strokeWidth="4" transform="rotate(-18 33 18)" />
        <ellipse cx="33" cy="56" rx="10" ry="7" fill={svgPalette.body} stroke={svgPalette.bodyStroke} strokeWidth="4" transform="rotate(18 33 56)" />
        <ellipse cx="46" cy="38" rx="28" ry="22" fill={svgPalette.shell} stroke={svgPalette.shellStroke} strokeWidth="5" />
        <path d="M27 37c10-11 29-13 42-1" fill="none" stroke="rgba(255,255,255,0.58)" strokeWidth="4" strokeLinecap="round" />
        <path d="M46 17v42M24 38h52" stroke={svgPalette.shellStroke} strokeWidth="2.5" strokeLinecap="round" opacity="0.45" />
        <circle cx="76" cy="34" r="2.8" fill="#0f172a" />
        <text x="46" y="45" textAnchor="middle" fontSize="22" fontWeight="900" fill={svgPalette.text}>{seatNo}</text>
      </g>
    </svg>
  );
};

const TurtleStack = ({ seatNos = [], compact = false }) => (
  <div className={`flex items-center ${compact ? "-space-x-2" : "-space-x-1.5"}`}>
    {seatNos.map((seatNo, index) => (
      <MaheTurtleArt key={`${seatNo}-${index}`} seatNo={seatNo} compact={compact} />
    ))}
  </div>
);

const maheActionRouteTone = {
  ready: { fill: "#f8fafc", stroke: "#64748b", text: "#334155", soft: "#e2e8f0" },
  safe: { fill: "#ecfdf5", stroke: "#059669", text: "#047857", soft: "#bbf7d0" },
  caution: { fill: "#fffbeb", stroke: "#f59e0b", text: "#b45309", soft: "#fde68a" },
  danger: { fill: "#fff1f2", stroke: "#e11d48", text: "#be123c", soft: "#fecdd3" },
  bust: { fill: "#ffe4e6", stroke: "#be123c", text: "#9f1239", soft: "#fecdd3" },
};

const buildMaheActionRouteItems = ({
  phase,
  canRoll,
  canChoose,
  diceCount = 0,
  diceSum = 0,
  diceRollsLeft = 0,
  safeRemaining = 0,
  nextBustRolls = [],
  stopSteps = 0,
  stopScores = false,
  projectedSteps = 0,
  projectedDestination = 0,
  scoreRecipientText = "",
  bustReturnText = "",
  finalEggText = "",
  currentEgg = null,
  riskLevel = "ready",
}) => {
  const isFinished = phase === "FINISHED";
  const isChoosing = phase === "CHOOSE_DICE_COUNT";
  const actionValue = isFinished
    ? "결과 확인"
    : canChoose
      ? "주사위 개수 선택"
      : canRoll
        ? diceCount > 0
          ? "굴릴지 멈출지 선택"
          : "첫 주사위 굴림"
        : "차례 대기";
  const actionDetail = isFinished
    ? "알 카드 정산과 최종 점수를 확인합니다."
    : isChoosing
      ? "업힌 거북이의 맨 위 플레이어가 이번 굴림 개수를 정합니다."
      : canRoll
        ? "현재 합계, 남은 굴림 수, 보상 가능성을 함께 보고 판단합니다."
        : "현재 차례 플레이어의 선택이 끝나면 루트가 갱신됩니다.";
  const stopValue = stopSteps > 0
    ? `${stopSteps}칸 이동`
    : diceCount > 0
      ? "이동 없음"
      : "첫 굴림 전";
  const stopDetail = stopSteps > 0
    ? stopScores
      ? `${currentEgg ?? "-"}점 알 획득 후보입니다. ${scoreRecipientText}`
      : `멈추면 ${projectedDestination || "출발점"}번 칸 흐름으로 이동합니다.`
    : diceCount > 0
      ? "합계가 초과되어 서버 정산을 기다립니다."
      : "첫 굴림 뒤 멈춤 루트가 열립니다.";
  const riskValue = diceCount <= 0
    ? "초과 없음"
    : diceRollsLeft <= 0
      ? "자동 이동"
      : `${nextBustRolls.length}/6 초과`;
  const riskDetail = diceCount <= 0
    ? "첫 주사위는 실패 위험 없이 차례를 시작합니다."
    : diceRollsLeft <= 0
      ? "세 번째 주사위까지 안전하면 현재 합계로 이동합니다."
      : nextBustRolls.length
        ? `초과 눈 ${nextBustRolls.join(", ")} · 안전 여유 ${Math.max(0, safeRemaining)}`
        : "다음 굴림도 모두 안전한 상태입니다.";
  const outcomeValue = stopScores
    ? "보상 가능"
    : projectedSteps > 0
      ? `${projectedSteps}칸 후보`
      : isFinished
        ? "정산 완료"
        : "위험 확인";
  const outcomeDetail = finalEggText
    || (stopScores ? scoreRecipientText : bustReturnText)
    || "결승선을 넘는 거북이 스택의 맨 위 플레이어가 알을 받습니다.";

  return [
    {
      key: "action",
      label: "이번 선택",
      value: actionValue,
      detail: actionDetail,
      tone: canRoll || canChoose ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-slate-100 bg-slate-50 text-slate-700",
    },
    {
      key: "stop",
      label: "멈춤 루트",
      value: stopValue,
      detail: stopDetail,
      tone: stopScores ? "border-amber-100 bg-amber-50 text-amber-800" : "border-slate-100 bg-white text-slate-700",
    },
    {
      key: "risk",
      label: "굴림 위험",
      value: riskValue,
      detail: riskDetail,
      tone: riskLevel === "danger" || riskLevel === "bust" ? "border-rose-100 bg-rose-50 text-rose-800" : "border-cyan-100 bg-cyan-50 text-cyan-800",
    },
    {
      key: "outcome",
      label: "보상 판단",
      value: outcomeValue,
      detail: outcomeDetail,
      tone: stopScores ? "border-amber-100 bg-amber-50 text-amber-800" : "border-violet-100 bg-violet-50 text-violet-800",
    },
  ];
};

const MaheActionRouteArt = ({
  phase,
  canRoll,
  canChoose,
  diceCount = 0,
  diceSum = 0,
  diceRollsLeft = 0,
  nextBustRolls = [],
  stopSteps = 0,
  stopScores = false,
  riskLevel = "ready",
}) => {
  const tone = maheActionRouteTone[riskLevel] || maheActionRouteTone.ready;
  const stateLabel = phase === "FINISHED"
    ? "결과"
    : canChoose
      ? "개수"
      : canRoll
        ? diceCount > 0
          ? "선택"
          : "시작"
        : "대기";
  const riskText = diceCount <= 0
    ? "안전"
    : diceRollsLeft <= 0
      ? "이동"
      : `${nextBustRolls.length}/6`;
  const nodes = [
    { key: "turn", label: "차례", value: stateLabel, x: 54, y: 72, fill: canRoll || canChoose ? "#ecfdf5" : "#f8fafc", stroke: canRoll || canChoose ? "#059669" : "#94a3b8", text: canRoll || canChoose ? "#047857" : "#475569" },
    { key: "dice", label: "합계", value: String(diceSum || 0), x: 142, y: 72, fill: tone.fill, stroke: tone.stroke, text: tone.text },
    { key: "risk", label: "위험", value: riskText, x: 230, y: 72, fill: diceCount > 0 && nextBustRolls.length >= 4 ? "#fff1f2" : "#ecfeff", stroke: diceCount > 0 && nextBustRolls.length >= 4 ? "#e11d48" : "#0891b2", text: diceCount > 0 && nextBustRolls.length >= 4 ? "#be123c" : "#0e7490" },
    { key: "stop", label: "멈춤", value: stopSteps > 0 ? `${stopSteps}` : "-", x: 318, y: 72, fill: stopScores ? "#fffbeb" : "#ffffff", stroke: stopScores ? "#f59e0b" : "#cbd5e1", text: stopScores ? "#b45309" : "#475569" },
  ];

  return (
    <svg
      viewBox="0 0 372 144"
      className="h-full min-h-[118px] w-full"
      role="img"
      aria-label={`마헤 선택 루트, 현재 합계 ${diceSum || 0}, 멈춤 이동 ${stopSteps || 0}칸`}
      data-smoke="mahe-action-route-art"
    >
      <rect x="10" y="10" width="352" height="124" rx="24" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="3" />
      <path d="M54 72h264" stroke={tone.soft} strokeWidth="12" strokeLinecap="round" />
      <path d="M54 72h264" stroke={tone.stroke} strokeWidth="4" strokeLinecap="round" opacity="0.72" />
      {nodes.map((node) => (
        <g key={node.key} data-smoke="mahe-action-route-node" data-route-key={node.key}>
          <circle cx={node.x} cy={node.y} r="30" fill="#ffffff" stroke={node.stroke} strokeWidth="4" />
          <circle cx={node.x} cy={node.y} r="21" fill={node.fill} stroke="#ffffff" strokeWidth="3" />
          <text x={node.x} y={node.y - 5} textAnchor="middle" fontSize="9" fontWeight="900" fill={node.text}>{node.label}</text>
          <text x={node.x} y={node.y + 13} textAnchor="middle" fontSize="16" fontWeight="900" fill={node.text}>{node.value}</text>
        </g>
      ))}
      <rect x="38" y="112" width="284" height="18" rx="9" fill="#ffffff" stroke="#e2e8f0" />
      <text x="180" y="125" textAnchor="middle" fontSize="10" fontWeight="900" fill="#475569">
        굴림 · 멈춤 · 보상 판단
      </text>
      {stopScores && (
        <g>
          <circle cx="338" cy="36" r="16" fill="#fef3c7" stroke="#f59e0b" strokeWidth="3" />
          <text x="338" y="41" textAnchor="middle" fontSize="12" fontWeight="900" fill="#b45309">알</text>
        </g>
      )}
    </svg>
  );
};

const MaheActionRoutePanel = ({
  phase,
  canRoll,
  canChoose,
  dice = [],
  diceSum = 0,
  diceRollsLeft = 0,
  safeRemaining = 0,
  nextBustRolls = [],
  stopSteps = 0,
  stopScores = false,
  projectedSteps = 0,
  projectedDestination = 0,
  scoreRecipientText = "",
  bustReturnText = "",
  finalEggText = "",
  currentEgg = null,
  riskLevel = "ready",
}) => {
  const diceCount = dice.length || 0;
  const items = buildMaheActionRouteItems({
    phase,
    canRoll,
    canChoose,
    diceCount,
    diceSum,
    diceRollsLeft,
    safeRemaining,
    nextBustRolls,
    stopSteps,
    stopScores,
    projectedSteps,
    projectedDestination,
    scoreRecipientText,
    bustReturnText,
    finalEggText,
    currentEgg,
    riskLevel,
  });

  return (
    <section
      data-smoke="mahe-action-route-panel"
      data-phase={phase || ""}
      data-can-roll={canRoll ? "true" : "false"}
      data-can-choose={canChoose ? "true" : "false"}
      data-dice-count={diceCount}
      data-stop-steps={stopSteps}
      className="mb-4 overflow-hidden rounded-2xl border border-teal-100 bg-gradient-to-br from-white via-teal-50 to-amber-50 p-3 shadow-sm sm:rounded-[1.5rem] sm:p-4"
    >
      <div className="space-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-[11px] font-black text-teal-700">마헤 선택 루트</div>
              <h3 className="text-base font-black text-slate-900">굴림, 멈춤, 보상 판단</h3>
            </div>
            <div className="rounded-full border border-teal-100 bg-white px-3 py-1 text-[11px] font-black text-teal-700">
              합계 {diceSum || 0} · 주사위 {diceCount}/3
            </div>
          </div>
          <div data-smoke="mahe-action-route-art" className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-black text-slate-600">
            {items.map((item) => (
              <span key={`route-chip-${item.key}`} data-smoke="mahe-action-route-node" data-route-key={item.key} className="rounded-full bg-white px-2.5 py-1">
                {item.label}: {item.value}
              </span>
            ))}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {items.map((item) => (
              <div key={item.key} data-smoke="mahe-action-route-item" data-route-key={item.key} className={`rounded-xl border px-3 py-2 ${item.tone}`}>
                <div className="text-[10px] font-black opacity-70">{item.label}</div>
                <div className="mt-0.5 text-sm font-black leading-snug">{item.value}</div>
                <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-relaxed opacity-80">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const MaheBoard = ({ gameState, players: roomPlayers = [], mySeatNo, onAction }) => {
  const trackSize = Number(get(gameState, "track_size", "trackSize", 21));
  const variantName = get(gameState, "variant_name", "variantName", "본게임");
  const phase = gameState?.phase || "ROLLING";
  const activeSeatNo = Number(get(gameState, "active_seat_no", "activeSeatNo", 0));
  const decisionSeatNo = Number(get(gameState, "decision_seat_no", "decisionSeatNo", 0));
  const currentEgg = get(gameState, "current_egg", "currentEgg", null);
  const dice = get(gameState, "dice", "dice", []);
  const diceSum = Number(get(gameState, "dice_sum", "diceSum", 0));
  const turtles = get(gameState, "turtles", "turtles", []);
  const stacks = get(gameState, "stacks", "stacks", []);
  const scores = get(gameState, "scores", "scores", []);
  const eggDeck = get(gameState, "egg_deck", "eggDeck", []);
  const finalEggRound = Boolean(get(gameState, "final_egg_round", "finalEggRound", false));
  const moveHistory = get(gameState, "move_history", "moveHistory", []);
  const activeTurtle = turtles.find((turtle) => Number(get(turtle, "seat_no", "seatNo", 0)) === activeSeatNo);
  const activePosition = Number(activeTurtle?.position || 0);
  const projectedDiceCount = dice.length || 1;
  const projectedSteps = diceSum > 0 && diceSum <= 7 ? diceSum * projectedDiceCount : 0;
  const projectedDestination = projectedSteps ? (activePosition + projectedSteps) % trackSize : activePosition;
  const projectedScores = projectedSteps ? activePosition + projectedSteps >= trackSize : false;
  const safeRemaining = Math.max(0, 7 - diceSum);
  const diceRollsLeft = Math.max(0, 3 - dice.length);
  const nextSafeRolls = dice.length > 0 && diceRollsLeft > 0
    ? [1, 2, 3, 4, 5, 6].filter((value) => value <= safeRemaining)
    : [];
  const nextBustRolls = dice.length > 0 && diceRollsLeft > 0
    ? [1, 2, 3, 4, 5, 6].filter((value) => value > safeRemaining)
    : [];
  const stopSteps = diceSum > 0 && diceSum <= 7 ? diceSum * dice.length : 0;
  const stopScores = stopSteps > 0 && activePosition + stopSteps >= trackSize;
  const riskLevel = diceSum > 7
    ? "bust"
    : dice.length === 0
      ? "ready"
      : safeRemaining <= 1
        ? "danger"
        : safeRemaining <= 3
          ? "caution"
          : "safe";
  const riskLabel = diceSum > 7
    ? "합계 초과"
    : dice.length === 0
      ? "첫 주사위는 안전"
      : diceRollsLeft === 0
        ? "세 번째 주사위 자동 이동"
        : `다음 주사위 위험 ${nextBustRolls.length}/6`;
  const startSeatNos = turtles
    .filter((turtle) => Number(turtle.position) === 0)
    .map((turtle) => Number(get(turtle, "seat_no", "seatNo", 0)))
    .filter(Boolean);
  const stackByPosition = useMemo(() => {
    const next = new Map();
    stacks.forEach((stack) => next.set(Number(stack.position), get(stack, "seat_nos", "seatNos", [])));
    return next;
  }, [stacks]);
  const activeStackSeatNos = stackByPosition.get(activePosition) || (activeSeatNo ? [activeSeatNo] : []);
  const activeStackIndex = activeStackSeatNos.indexOf(activeSeatNo);
  const activeMovingSeatNos = activeStackIndex >= 0 ? activeStackSeatNos.slice(activeStackIndex) : (activeSeatNo ? [activeSeatNo] : []);
  const activeStackTopSeatNo = activeStackSeatNos.length ? activeStackSeatNos[activeStackSeatNos.length - 1] : activeSeatNo;
  const projectedScorerSeatNo = activeMovingSeatNos.length ? activeMovingSeatNos[activeMovingSeatNos.length - 1] : activeSeatNo;
  const activeIsCarried = activeStackTopSeatNo && activeStackTopSeatNo !== activeSeatNo;
  const canRoll = phase === "ROLLING" && activeSeatNo === mySeatNo;
  const canChoose = phase === "CHOOSE_DICE_COUNT" && decisionSeatNo === mySeatNo;
  const winners = scores.filter((score) => Boolean(get(score, "winner", "winner", false)));
  const playerName = (seatNo) => roomPlayers.find((player) => seatNoOf(player) === Number(seatNo))?.nickname || `${seatNo}번`;
  const scoreBySeatNo = new Map(scores.map((score) => [Number(get(score, "seat_no", "seatNo", 0)), score]));
  const maheRewardPressureRows = (turtles.length ? turtles : scores.map((score) => ({
    seatNo: get(score, "seat_no", "seatNo", 0),
    seat_no: get(score, "seat_no", "seatNo", 0),
    position: 0,
  })))
    .map((turtle) => {
      const seatNo = Number(get(turtle, "seat_no", "seatNo", 0));
      const position = Number(get(turtle, "position", "position", 0)) || 0;
      const stackSeatNos = (stackByPosition.get(position) || [seatNo]).map(Number).filter(Boolean);
      const stackIndex = stackSeatNos.indexOf(seatNo);
      const score = scoreBySeatNo.get(seatNo) || {};
      const cards = listOf(get(score, "cards", "cards", []));
      return {
        seatNo,
        name: playerName(seatNo),
        position,
        score: Number(get(score, "score", "score", 0)) || 0,
        cardsCount: cards.length,
        stackDepth: stackSeatNos.length,
        stackIndex: stackIndex >= 0 ? stackIndex : 0,
        topSeatNo: stackSeatNos.length ? stackSeatNos[stackSeatNos.length - 1] : seatNo,
        isLeader: false,
      };
    })
    .filter((row) => row.seatNo);
  const maheRewardLeaderScore = Math.max(0, ...maheRewardPressureRows.map((row) => Number(row.score || 0)));
  maheRewardPressureRows.forEach((row) => {
    row.isLeader = Number(row.score || 0) === maheRewardLeaderScore && maheRewardLeaderScore > 0;
  });
  const activeStackOrderText = activeStackSeatNos.length
    ? activeStackSeatNos.map((seatNo) => playerName(seatNo)).join(" → ")
    : "-";
  const activeMovingText = activeMovingSeatNos.length
    ? activeMovingSeatNos.map((seatNo) => playerName(seatNo)).join(", ")
    : "-";
  const carriedChoiceText = activeIsCarried
    ? `${playerName(activeStackTopSeatNo)}님이 맨 위에 있어 ${playerName(activeSeatNo)}님의 주사위 개수를 정합니다.`
    : `${playerName(activeSeatNo)}님이 직접 주사위를 굴립니다.`;
  const winnerText = winners.map((score) => playerName(get(score, "seat_no", "seatNo", 0))).join(", ");
  const winningScore = winners.length ? Number(get(winners[0], "score", "score", 0)) : 0;
  const turnMessage = phase === "FINISHED"
    ? "모든 알 카드가 정산되었습니다."
    : phase === "CHOOSE_DICE_COUNT"
      ? carriedChoiceText
      : `${playerName(activeSeatNo)}님이 주사위를 굴립니다.`;
  const bustReturnText = activeMovingSeatNos.length > 1
    ? `합계가 8 이상이면 ${activeMovingText} 모두 출발점으로 돌아갑니다.`
    : "합계가 8 이상이면 현재 거북이가 출발점으로 돌아갑니다.";
  const scoreRecipientText = projectedScorerSeatNo
    ? `결승선을 넘으면 맨 위 ${playerName(projectedScorerSeatNo)}님이 알을 받습니다.`
    : "결승선을 넘으면 맨 위 거북이가 알을 받습니다.";
  const finalEggText = finalEggRound
    ? "이 7점 알을 누군가 획득하면 게임이 끝납니다."
    : eggDeck.length === 0
      ? "현재 알이 사라지면 마지막 7점 알이 공개됩니다."
      : "";
  const mahePhaseLabel = phase === "FINISHED" ? "게임 종료"
    : phase === "CHOOSE_DICE_COUNT" ? "주사위 개수 선택"
      : "주사위 굴리기";
  const maheTurnGuidance = (() => {
    if (phase === "FINISHED") {
      return winnerText ? `${winnerText} 승리, 총 ${winningScore}점입니다.` : "모든 알 카드가 정산되었습니다.";
    }
    if (phase === "CHOOSE_DICE_COUNT") {
      return canChoose ? "업힌 거북이의 맨 위 플레이어로서 주사위 개수를 선택하세요." : `${playerName(decisionSeatNo)}님의 주사위 개수 선택을 기다리는 중입니다.`;
    }
    if (!canRoll) {
      return `${playerName(activeSeatNo)}님의 주사위 선택을 기다리는 중입니다.`;
    }
    if (!dice.length) {
      return "주사위 1개부터 굴립니다. 이후 더 굴릴지 멈출지 선택하세요.";
    }
    if (diceSum > 7) {
      return `${bustReturnText} 서버가 이동 실패를 정리합니다.`;
    }
    return `지금 멈추면 ${stopSteps}칸 이동합니다. 더 굴리면 ${riskLabel.toLowerCase()}입니다.`;
  })();
  const maheQuickFacts = [
    { label: "단계", value: mahePhaseLabel },
    { label: "차례", value: phase === "FINISHED" ? "종료" : canRoll || canChoose ? "내 차례" : playerName(activeSeatNo || decisionSeatNo) },
    { label: "합계", value: String(diceSum || 0) },
    { label: "알", value: `${currentEgg ?? "-"}점` },
  ];
  const maheRewardLeader = maheRewardPressureRows.slice().sort((left, right) => (
    Number(right.score || 0) - Number(left.score || 0)
    || Number(right.cardsCount || 0) - Number(left.cardsCount || 0)
    || Number(right.position || 0) - Number(left.position || 0)
  ))[0] || null;
  const maheClosestToGoal = maheRewardPressureRows.slice().sort((left, right) => Number(right.position || 0) - Number(left.position || 0))[0] || null;
  const maheBottomSummaryItems = [
    {
      key: "turn",
      label: "차례",
      value: mahePhaseLabel,
      detail: turnMessage,
      tone: phase === "FINISHED" ? "border-amber-100 bg-amber-50 text-amber-800" : canRoll || canChoose ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-slate-100 bg-slate-50 text-slate-700",
    },
    {
      key: "risk",
      label: "위험",
      value: riskLabel,
      detail: diceSum > 7 ? bustReturnText : `멈추면 ${stopSteps || 0}칸 · 실패 눈 ${nextBustRolls.length}/6`,
      tone: riskLevel === "bust" || riskLevel === "danger" ? "border-rose-100 bg-rose-50 text-rose-800" : riskLevel === "caution" ? "border-amber-100 bg-amber-50 text-amber-800" : "border-cyan-100 bg-cyan-50 text-cyan-800",
    },
    {
      key: "egg",
      label: "알",
      value: `${currentEgg ?? "-"}점`,
      detail: `${eggDeck.length}장 남음${stopScores || projectedScores ? ` · ${scoreRecipientText}` : ""}${finalEggText ? ` · ${finalEggText}` : ""}`,
      tone: stopScores || projectedScores || finalEggRound ? "border-amber-100 bg-amber-50 text-amber-800" : "border-slate-100 bg-white text-slate-700",
    },
    {
      key: "leader",
      label: "선두",
      value: maheRewardLeader ? `${maheRewardLeader.name} ${maheRewardLeader.score}점` : "대기",
      detail: maheClosestToGoal ? `결승선에 가까운 말: ${maheClosestToGoal.name} · ${maheClosestToGoal.position}/${trackSize}` : "점수판이 도착하면 선두와 결승선 거리가 표시됩니다.",
      tone: "border-emerald-100 bg-emerald-50 text-emerald-800",
    },
  ];
  const startActive = activePosition === 0;
  const startProjected = Boolean(projectedSteps) && projectedDestination === 0;
  const startSpaceLabel = startSeatNos.length
    ? [
        `출발점 · 아래에서 위 순서 ${startSeatNos.map((seatNo) => playerName(seatNo)).join(" → ")}`,
        startActive ? "현재 차례 거북이 위치" : "",
        startProjected ? `${projectedSteps}칸 이동 시 도착 예정` : "",
        startProjected && projectedScores ? "알 획득 가능" : "",
      ].filter(Boolean).join(" · ")
    : [
        "출발점 · 비어 있음",
        startActive ? "현재 차례 거북이 위치" : "",
        startProjected ? `${projectedSteps}칸 이동 시 도착 예정` : "",
      ].filter(Boolean).join(" · ");
  const diceChoiceSummaries = useMemo(
    () => [1, 2, 3].map((count) => summarizeMaheDiceChoice(count, activePosition, trackSize)),
    [activePosition, trackSize],
  );
  const choiceSummaryByCount = useMemo(
    () => new Map(diceChoiceSummaries.map((summary) => [summary.diceCount, summary])),
    [diceChoiceSummaries],
  );
  const nextRollOutcomes = useMemo(() => {
    if (phase !== "ROLLING" || !dice.length || diceRollsLeft <= 0 || diceSum > 7) {
      return [];
    }
    const nextDiceCount = dice.length + 1;
    return [1, 2, 3, 4, 5, 6].map((face) => {
      const nextSum = diceSum + face;
      const bust = nextSum > 7;
      const steps = bust ? 0 : nextSum * nextDiceCount;
      return {
        face,
        bust,
        steps,
        sum: nextSum,
        scores: steps > 0 && activePosition + steps >= trackSize,
      };
    });
  }, [activePosition, dice.length, diceRollsLeft, diceSum, phase, trackSize]);

  const roll = async () => onAction({ action_type: "ROLL_DIE" });
  const stop = async () => onAction({ action_type: "STOP_ROLLING" });
  const choose = async (diceCount) => onAction({ action_type: "CHOOSE_DICE_COUNT", dice_count: diceCount });
  const renderDiceChoiceButton = (count) => {
    const summary = choiceSummaryByCount.get(count) || summarizeMaheDiceChoice(count, activePosition, trackSize);
    const tone = summary.bustPercent >= 70
      ? "bg-rose-600 hover:bg-rose-700"
      : summary.bustPercent > 0
        ? "bg-amber-500 hover:bg-amber-600"
        : "bg-emerald-600 hover:bg-emerald-700";
    const choiceLabel = [
      `${count}개 선택`,
      `안전 ${summary.safePercent}%`,
      `실패 ${summary.bustPercent}%`,
      `성공 ${summary.minSafeSteps}-${summary.maxSafeSteps}칸`,
      summary.scorePercent > 0 ? `득점 가능 ${summary.scorePercent}%` : `성공 평균 ${summary.expectedSafeSteps}칸`,
      canChoose ? "선택 가능" : "선택 대기",
    ].join(" · ");
    return (
      <button
        key={count}
        type="button"
        className={`min-h-[74px] rounded-xl px-3 py-2.5 text-left text-white shadow-sm transition disabled:opacity-40 ${tone}`}
        disabled={!canChoose}
        onClick={() => choose(count).catch(() => notifyError("주사위 개수 선택 실패"))}
        aria-label={choiceLabel}
        title={choiceLabel}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-black">{count}개</span>
          <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-black">안전 {summary.safePercent}%</span>
        </div>
        <div className="mt-1 text-[10px] font-bold leading-relaxed text-white/85">
          실패 {summary.bustPercent}% · 성공 {summary.minSafeSteps}-{summary.maxSafeSteps}칸
        </div>
        <div className="text-[10px] font-bold leading-relaxed text-white/85">
          {summary.scorePercent > 0 ? `득점 가능 ${summary.scorePercent}%` : `성공 평균 ${summary.expectedSafeSteps}칸`}
        </div>
      </button>
    );
  };
  const renderNextRollPreview = () => {
    if (!nextRollOutcomes.length) {
      return null;
    }
    const nextDiceCount = dice.length + 1;
    return (
      <div className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-1 text-[11px] font-black text-slate-700">
          <span>다음 주사위 결과</span>
          {nextDiceCount === 3 && <span className="text-amber-600">세 번째는 안전하면 즉시 이동</span>}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {nextRollOutcomes.map((outcome) => {
            const outcomeLabel = [
              `다음 눈 ${outcome.face}`,
              `합계 ${outcome.sum}`,
              outcome.bust ? "실패" : `${outcome.steps}칸 이동`,
              outcome.scores ? "알 획득 가능" : "",
            ].filter(Boolean).join(" · ");
            return (
              <div
                key={outcome.face}
                className={`rounded-lg border px-2 py-1.5 text-[10px] font-black leading-tight ${
                  outcome.bust
                    ? "border-rose-100 bg-rose-50 text-rose-700"
                    : outcome.scores
                      ? "border-amber-100 bg-amber-50 text-amber-700"
                      : "border-emerald-100 bg-emerald-50 text-emerald-700"
                }`}
                role="img"
                aria-label={outcomeLabel}
                title={outcomeLabel}
              >
                <div className="flex items-center justify-between gap-1">
                  <span>{outcome.face}</span>
                  <span>합 {outcome.sum}</span>
                </div>
                <div className="mt-0.5 text-[9px] font-bold">
                  {outcome.bust ? "실패" : `${outcome.steps}칸`}
                  {outcome.scores ? " · 알 가능" : ""}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div id="mahe-board-panel" className="scroll-mt-24 rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-lg sm:p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <Shield className="h-4 w-4 text-primary-600" />
            마헤 트랙
          </div>
          <div className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
            {phase === "FINISHED" ? "게임 종료" : `${playerName(activeSeatNo)} 차례`}
          </div>
          <div className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
            {variantName}
          </div>
        </div>
        <div className="mb-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2.5" role="status" aria-live="polite" aria-atomic="true">
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl bg-emerald-600 p-2 text-white shadow-sm">
              <Dices className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1 text-sm font-black leading-relaxed text-slate-900">
              {maheTurnGuidance}
            </div>
            <div className="flex shrink-0 flex-wrap gap-1.5">
              {maheQuickFacts.slice(2).map((item) => (
                <span key={item.label} className="rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-black text-slate-600">
                  {item.label} {item.value}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-[620px] rounded-full bg-gradient-to-br from-cyan-100 via-emerald-100 to-amber-100 p-2 shadow-inner sm:p-4">
          <div className="absolute inset-[24%] rounded-full bg-gradient-to-br from-amber-200 to-yellow-300 shadow-inner" />
          <div className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-white/80 bg-white/90 text-center shadow-lg sm:h-24 sm:w-24 lg:h-28 lg:w-28">
            <div className="text-[11px] font-black text-slate-500">{finalEggRound ? "마지막 보상" : "현재 알"}</div>
            <div className="text-2xl font-black text-amber-600">{currentEgg ?? "-"}</div>
            <div className="mt-1 text-[10px] font-bold text-slate-400">남은 카드 {eggDeck.length}</div>
          </div>
          <div
            className={`absolute left-1/2 top-[62%] max-w-[72%] -translate-x-1/2 rounded-full border bg-white/90 px-2 py-1.5 shadow sm:top-[60%] sm:px-3 sm:py-2 ${startProjected ? "tabletop-projected-space border-amber-300 ring-2 ring-amber-200" : startActive ? "tabletop-active-space border-emerald-300 ring-2 ring-emerald-200" : "border-slate-200"}`}
            role="img"
            aria-label={startSpaceLabel}
            title={startSpaceLabel}
          >
            <TurtleStack seatNos={startSeatNos} compact={startSeatNos.length > 4} />
          </div>
          {Array.from({ length: trackSize - 1 }, (_, index) => {
            const position = index + 1;
            const angle = (index / (trackSize - 1)) * Math.PI * 2 - Math.PI / 2;
            const x = 50 + Math.cos(angle) * 43;
            const y = 50 + Math.sin(angle) * 43;
            const seatNos = stackByPosition.get(position) || [];
            const activePositionCell = position === activePosition;
            const projectedPositionCell = position === projectedDestination && projectedSteps;
            const spaceLabel = [
              `${position}번 칸`,
              seatNos.length ? `아래에서 위 순서 ${seatNos.map((seatNo) => playerName(seatNo)).join(" → ")}` : "비어 있음",
              activePositionCell ? "현재 차례 거북이 위치" : "",
              projectedPositionCell ? `${projectedSteps}칸 이동 시 도착 예정` : "",
              projectedPositionCell && projectedScores ? "알 획득 가능" : "",
            ].filter(Boolean).join(" · ");
            return (
              <div
                key={position}
                className={`absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border bg-white/90 text-[10px] font-black shadow sm:h-10 sm:w-10 lg:h-12 lg:w-12 ${projectedPositionCell ? "tabletop-projected-space border-amber-300 text-amber-700 ring-2 ring-amber-200" : activePositionCell ? "tabletop-active-space border-emerald-300 text-emerald-700 ring-2 ring-emerald-200" : "border-white text-slate-400"}`}
                style={{ left: `${x}%`, top: `${y}%` }}
                role="img"
                aria-label={spaceLabel}
                title={spaceLabel}
              >
                <span>{position}</span>
                {!!seatNos.length && <TurtleStack seatNos={seatNos} compact />}
              </div>
            );
          })}
        </div>
        <div id="mahe-action-strip" className="tabletop-mobile-action-strip sticky z-20 mt-3 scroll-mt-24 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur xl:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-black text-slate-900" role="status" aria-live="polite" aria-atomic="true">{turnMessage}</div>
            <div className={`rounded-full px-2 py-1 text-[11px] font-black ${diceSum > 7 ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
              합계 {diceSum || 0}
            </div>
          </div>
          {activeStackSeatNos.length > 1 && (
            <div className="mt-2 rounded-xl border border-teal-100 bg-teal-50 px-3 py-2 text-[11px] font-bold leading-relaxed text-teal-700">
              아래→위 {activeStackOrderText} · 이번 이동 {activeMovingText}
              {activeIsCarried ? ` · 선택권 ${playerName(activeStackTopSeatNo)}` : ""}
              {projectedScores || stopScores ? ` · ${scoreRecipientText}` : ""}
            </div>
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((index) => (
                <div key={index} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-base font-black text-slate-800">
                  {dice[index] || "-"}
                </div>
              ))}
            </div>
            <div className={`min-w-0 flex-1 rounded-xl border px-2 py-1.5 text-[11px] font-bold leading-relaxed ${maheRiskToneClasses[riskLevel]}`}>
              {riskLabel}
              {stopSteps > 0 ? ` · 멈추면 ${stopSteps}칸` : ""}
            </div>
          </div>
          {renderNextRollPreview()}
          <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-bold leading-relaxed text-slate-500">
            {bustReturnText}
            {(projectedScores || stopScores) ? ` ${scoreRecipientText}` : ""}
            {finalEggText ? ` ${finalEggText}` : ""}
          </div>
          {phase === "CHOOSE_DICE_COUNT" ? (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {[1, 2, 3].map(renderDiceChoiceButton)}
            </div>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="min-h-11 rounded-xl bg-slate-900 px-3 py-3 text-sm font-black text-white disabled:opacity-40"
                disabled={!canRoll || dice.length >= 3}
                onClick={() => roll().catch(() => notifyError("주사위 굴리기 실패"))}
              >
                굴리기
              </button>
              <button
                type="button"
                className="min-h-11 rounded-xl bg-amber-500 px-3 py-3 text-sm font-black text-white disabled:opacity-40"
                disabled={!canRoll || !dice.length}
                onClick={() => stop().catch(() => notifyError("이동 실패"))}
              >
                멈추기
              </button>
            </div>
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <div data-smoke="mahe-side-dice-panel" className="hidden rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-lg sm:p-4 xl:block">
          <div className="text-sm font-black text-slate-900">주사위</div>
          <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold leading-relaxed text-slate-500" role="status" aria-live="polite" aria-atomic="true">
            {turnMessage}
          </div>
          {activeStackSeatNos.length > 1 && (
            <div className="mt-2 rounded-xl border border-teal-100 bg-teal-50 px-3 py-2 text-xs font-bold leading-relaxed text-teal-700">
              <div className="font-black">업고 가기</div>
              <div>아래→위 {activeStackOrderText}</div>
              <div>이번 이동 {activeMovingText}</div>
              {activeIsCarried && <div>맨 위 거북이 {playerName(activeStackTopSeatNo)}님이 주사위 개수를 정합니다.</div>}
              {(projectedScores || stopScores) && <div>{scoreRecipientText}</div>}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            {[0, 1, 2].map((index) => (
              <div key={index} className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-xl font-black text-slate-800">
                {dice[index] || "-"}
              </div>
            ))}
          </div>
          <div className={`mt-3 rounded-xl px-3 py-2 text-sm font-black ${diceSum > 7 ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-600"}`}>
            합계 {diceSum}
          </div>
          <div className={`mt-2 rounded-xl border px-3 py-2 text-xs font-bold leading-relaxed ${maheRiskToneClasses[riskLevel]}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-black">{riskLabel}</span>
              <span>안전 한도 {safeRemaining}</span>
            </div>
            {dice.length > 0 && diceRollsLeft > 0 && (
              <div className="mt-1">
                안전 눈 {nextSafeRolls.join(", ") || "없음"} · 실패 눈 {nextBustRolls.join(", ") || "없음"}
              </div>
            )}
            {stopSteps > 0 && (
              <div className="mt-1">
                지금 멈추면 {stopSteps}칸 이동{stopScores ? ` · ${playerName(projectedScorerSeatNo)}님 ${currentEgg ?? 0}점 알 획득 가능` : ""}
              </div>
            )}
            <div className="mt-1">{bustReturnText}</div>
          </div>
          {renderNextRollPreview()}
          {projectedSteps > 0 && (
            <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
              예상 이동 {projectedSteps}칸 · 도착 {projectedDestination || "출발점"}
              {projectedScores ? ` · ${playerName(projectedScorerSeatNo)}님 ${currentEgg ?? 0}점 획득 가능` : ""}
            </div>
          )}
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-bold">
            <div className="rounded-xl bg-amber-50 px-3 py-2 text-amber-700">
              {finalEggRound ? "마지막 보상" : "공개 알"} {currentEgg ?? "-"}점
            </div>
            <div className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-700">
              남은 알 {eggDeck.length}장
            </div>
          </div>
          {finalEggText && (
            <div className="mt-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-bold leading-relaxed text-amber-800">
              {finalEggText}
            </div>
          )}
          {phase === "CHOOSE_DICE_COUNT" ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[1, 2, 3].map(renderDiceChoiceButton)}
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="min-h-11 rounded-xl bg-slate-900 px-3 py-3 text-sm font-black text-white disabled:opacity-40"
                disabled={!canRoll || dice.length >= 3}
                onClick={() => roll().catch(() => notifyError("주사위 굴리기 실패"))}
              >
                굴리기
              </button>
              <button
                type="button"
                className="min-h-11 rounded-xl bg-amber-500 px-3 py-3 text-sm font-black text-white disabled:opacity-40"
                disabled={!canRoll || !dice.length}
                onClick={() => stop().catch(() => notifyError("이동 실패"))}
              >
                멈추기
              </button>
            </div>
          )}
        </div>

        <div id="dalmuti-status-panel" className="scroll-mt-24 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-black text-slate-900">점수</div>
            <div className="text-[11px] font-bold text-slate-500">동점이면 알 카드를 더 많이 모은 플레이어가 앞섭니다.</div>
          </div>
          {phase === "FINISHED" && winners.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
              <div className="flex items-center gap-2 text-sm font-black text-amber-900">
                <Crown className="h-4 w-4 text-amber-500" />
                최종 승자 · {winnerText}
              </div>
              <div className="text-xs font-black text-amber-700">총 {winningScore}점</div>
            </div>
          )}
          <div className="space-y-2">
            {scores.map((score) => {
              const seatNo = Number(get(score, "seat_no", "seatNo", 0));
              return (
                <div key={seatNo || score.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <TurtleStack seatNos={[seatNo]} />
                    <div>
                      <div className="text-xs font-black text-slate-700">{playerName(seatNo)}</div>
                      <div className="text-[10px] font-bold text-slate-400">
                        알 {(score.cards || []).length}장 · {(score.cards || []).join(", ") || "-"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-black text-slate-900">
                    {score.winner && <Crown className="h-4 w-4 text-amber-500" />}
                    {score.score}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
          <div className="mb-3 text-sm font-black text-slate-900">최근 기록</div>
          <div className="space-y-2">
            {moveHistory.slice(-5).reverse().map((move) => (
              <div key={get(move, "turn_number", "turnNumber", 0)} className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
                {get(move, "turn_number", "turnNumber", 0)} · {maheEventLabels[get(move, "action_type", "actionType", "")] || get(move, "action_type", "actionType", "")} · {playerName(get(move, "active_seat_no", "activeSeatNo", 0))}
                {Number(get(move, "steps", "steps", 0)) > 0 ? ` · ${get(move, "steps", "steps", 0)}칸` : ""}
                {Number(get(move, "value", "value", 0)) > 0 ? ` · ${get(move, "value", "value", 0)}점` : ""}
              </div>
            ))}
            {!moveHistory.length && (
              <TabletopHistoryEmptyState
                game="mahe"
                title="아직 이동 기록이 없습니다"
                detail="첫 주사위 선택이 처리되면 이동 칸, 거북이, 알 카드 흐름이 이 기록 영역에 쌓입니다."
                nextAction="첫 이동"
              />
            )}
          </div>
        </div>
      </aside>
    </div>
    <section data-smoke="mahe-bottom-summary" className="rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-lg sm:p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-black text-slate-900">마헤 흐름 요약</div>
        <div className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">하단 참고</div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {maheBottomSummaryItems.map((item) => (
          <div key={item.key} className={`rounded-xl border px-3 py-2 ${item.tone}`} data-smoke="mahe-bottom-summary-item" data-summary-key={item.key}>
            <div className="text-[10px] font-black opacity-70">{item.label}</div>
            <div className="mt-0.5 truncate text-sm font-black">{item.value}</div>
            <div className="mt-0.5 line-clamp-1 text-[10px] font-bold opacity-70">{item.detail}</div>
          </div>
        ))}
      </div>
    </section>
    </>
  );
};

export { MaheBoard };
export default MaheBoard;
