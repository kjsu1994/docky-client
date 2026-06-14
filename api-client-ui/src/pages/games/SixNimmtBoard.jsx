import { useEffect, useRef, useState } from "react";

const get = (obj, snake, camel, fallback = undefined) => obj?.[camel] ?? obj?.[snake] ?? fallback;
const listOf = (value) => (Array.isArray(value) ? value : []);
const seatNoOf = (player) => Number(get(player, "seat_no", "seatNo", 0));

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
  const gameLabel = title;
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

const sixNimmtPhaseLabels = {
  SELECTING: "카드 선택",
  RESOLVING: "카드 배치",
  ROW_CHOICE: "행 선택",
  FINISHED: "게임 종료",
};

const sixNimmtEventLabels = {
  ROUND_STARTED: "라운드 시작",
  SELECT_CARD: "카드 제출 완료",
  PLACE_CARD: "카드 배치",
  REVEAL: "카드 공개",
  ROW_CHOICE_REQUIRED: "행 선택 필요",
  TAKE_ROW: "행 회수",
  ROW_TAKEN: "행 회수",
  NEXT_TURN: "다음 턴",
  ROUND_FINISHED: "라운드 종료",
  GAME_FINISHED: "게임 종료",
};

const sixNimmtCardValue = (card) => Number(get(card, "value", "value", 0));
const sixNimmtCardBulls = (card) => Number(get(card, "bulls", "bulls", 0));
const sixNimmtCardId = (card) => get(card, "id", "id", "");
const sixNimmtRowCards = (row) => listOf(get(row, "cards", "cards", []));
const sixNimmtRowPenalty = (row) => sixNimmtRowCards(row).reduce((sum, card) => sum + sixNimmtCardBulls(card), 0);
const sixNimmtPlacementEventTypes = new Set(["PLACE_CARD", "ROW_TAKEN"]);
const sixNimmtEventNo = (event) => Number(get(event, "event_no", "eventNo", 0));
const sixNimmtEventType = (event) => String(get(event, "event_type", "eventType", "") || "").toUpperCase();
const SIX_NIMMT_REPLAY_STEP_MS = 650;
const SIX_NIMMT_FINAL_FALLBACK_MS = 1200;
const sixNimmtRowsSignature = (rows = []) => rows
  .map((row) => sixNimmtRowCards(row).map((card) => sixNimmtCardId(card) || sixNimmtCardValue(card)).join(","))
  .join("|");
const sixNimmtEventsSignature = (events = []) => events
  .map((event) => `${sixNimmtEventNo(event)}:${sixNimmtEventType(event)}`)
  .join("|");
const sixNimmtLatestEventNo = (state) => listOf(get(state, "events", "events", []))
  .reduce((latest, event) => Math.max(latest, sixNimmtEventNo(event)), 0);
const sixNimmtHasNewPlacementEvents = (previousState, nextState) => {
  const previousEventNo = sixNimmtLatestEventNo(previousState);
  return listOf(get(nextState, "events", "events", []))
    .some((event) => sixNimmtEventNo(event) > previousEventNo && sixNimmtPlacementEventTypes.has(sixNimmtEventType(event)));
};
const sixNimmtPlayerForSeat = (state, seatNo) => {
  const normalizedSeatNo = Number(seatNo);
  if (!state || !normalizedSeatNo) return null;
  return listOf(get(state, "players", "players", []))
    .find((player) => Number(get(player, "seat_no", "seatNo", 0)) === normalizedSeatNo) || null;
};
const sixNimmtHandCount = (player) => Number(get(player, "hand_count", "handCount", 0)) || 0;
const sixNimmtHandLength = (player) => listOf(get(player, "hand", "hand", [])).length;
const sixNimmtNeedsViewerHandRefresh = (realtimeState, mySeatNo) => {
  const realtimePlayer = sixNimmtPlayerForSeat(realtimeState, mySeatNo);
  if (!realtimePlayer) return false;
  const expectedHandCount = sixNimmtHandCount(realtimePlayer);
  if (expectedHandCount <= 0 || sixNimmtHandLength(realtimePlayer) > 0) return false;
  return true;
};
const buildSixNimmtReplayStepsFromFinal = (previousState, finalState) => {
  const previousRows = cloneSixNimmtRows(get(previousState, "rows", "rows", []));
  if (!previousRows.length || !finalState) return [];
  const previousEventNo = sixNimmtLatestEventNo(previousState);
  const finalEvents = listOf(get(finalState, "events", "events", []));
  const placementEvents = finalEvents
    .filter((event) => sixNimmtEventNo(event) > previousEventNo && sixNimmtPlacementEventTypes.has(sixNimmtEventType(event)))
    .sort((a, b) => sixNimmtEventNo(a) - sixNimmtEventNo(b));
  if (!placementEvents.length) return [];

  let nextRows = previousRows;
  return placementEvents.map((event) => {
    const eventNo = sixNimmtEventNo(event);
    nextRows = applySixNimmtPlacementEventToRows(nextRows, event);
    return {
      ...finalState,
      phase: "RESOLVING",
      rows: cloneSixNimmtRows(nextRows),
      events: finalEvents.filter((candidate) => sixNimmtEventNo(candidate) <= eventNo),
    };
  });
};
const sixNimmtBullsForValue = (value) => {
  const safeValue = Number(value) || 0;
  if (safeValue === 55) return 7;
  if (safeValue % 11 === 0) return 5;
  if (safeValue % 10 === 0) return 3;
  if (safeValue % 5 === 0) return 2;
  return 1;
};
const sixNimmtCardFromEvent = (event) => {
  const value = Number(get(event, "card_value", "cardValue", 0));
  if (!value) return null;
  return {
    id: `C${value}`,
    value,
    bulls: Number(get(event, "card_bulls", "cardBulls", 0)) || sixNimmtBullsForValue(value),
    seatNo: Number(get(event, "seat_no", "seatNo", 0)),
  };
};
const sixNimmtEventRowIndex = (event) => {
  const indexes = listOf(get(event, "row_indexes", "rowIndexes", []));
  const index = Number(indexes[0]);
  return Number.isInteger(index) && index >= 0 ? index : null;
};
const cloneSixNimmtRows = (rows = []) => listOf(rows).map((row) => ({
  ...row,
  cards: sixNimmtRowCards(row).map((card) => ({ ...card })),
}));
const applySixNimmtPlacementEventToRows = (sourceRows, event) => {
  const eventType = sixNimmtEventType(event);
  if (!sixNimmtPlacementEventTypes.has(eventType)) return cloneSixNimmtRows(sourceRows);
  const rowIndex = sixNimmtEventRowIndex(event);
  const card = sixNimmtCardFromEvent(event);
  const rows = cloneSixNimmtRows(sourceRows);
  if (rowIndex === null || !card || !rows[rowIndex]) return rows;
  if (eventType === "ROW_TAKEN") {
    rows[rowIndex] = { ...rows[rowIndex], cards: [card] };
    return rows;
  }
  const cards = sixNimmtRowCards(rows[rowIndex]);
  const alreadyPlaced = cards.some((existingCard) => sixNimmtCardValue(existingCard) === card.value);
  rows[rowIndex] = { ...rows[rowIndex], cards: alreadyPlaced ? cards : [...cards, card] };
  return rows;
};

const sixNimmtCardPalettes = {
  low: { paper: "#fefce8", rim: "#a16207", wash: "#fde68a", ink: "#1f2937", accent: "#84cc16", badge: "#713f12" },
  medium: { paper: "#fff7ed", rim: "#c2410c", wash: "#fed7aa", ink: "#431407", accent: "#fb923c", badge: "#9a3412" },
  high: { paper: "#fff1f2", rim: "#be123c", wash: "#fecdd3", ink: "#3f0a17", accent: "#e11d48", badge: "#9f1239" },
  extreme: { paper: "#450a0a", rim: "#fde68a", wash: "#b91c1c", ink: "#fff7ed", accent: "#f97316", badge: "#fef3c7" },
};

const sixNimmtPenaltyMarks = [
  [40, 110],
  [58, 102],
  [76, 110],
  [94, 102],
  [112, 110],
  [58, 126],
  [94, 126],
];

const SixNimmtCardArt = ({ card, selected = false }) => {
  const value = sixNimmtCardValue(card);
  const bulls = sixNimmtCardBulls(card);
  const palette = bulls >= 7
    ? sixNimmtCardPalettes.extreme
    : bulls >= 5
      ? sixNimmtCardPalettes.high
      : bulls >= 2
        ? sixNimmtCardPalettes.medium
        : sixNimmtCardPalettes.low;
  const markCount = Math.max(1, Math.min(sixNimmtPenaltyMarks.length, bulls || 1));

  return (
    <svg
      data-smoke="six-nimmt-card-art"
      viewBox="0 0 152 212"
      className="block w-full"
      style={{ aspectRatio: "5 / 7" }}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="6" y="6" width="140" height="200" rx="17" fill={palette.paper} stroke={selected ? "#0f172a" : palette.rim} strokeWidth={selected ? 5 : 3} />
      <path d="M20 30h112v128c-28 18-56 20-84 8-17-7-27-18-28-33Z" fill={palette.wash} opacity={bulls >= 7 ? 0.42 : 0.7} />
      <path d="M22 36c18 8 39 8 62 0 20-7 36-5 48 6v22c-17-8-34-8-52 1-25 12-50 8-58-9Z" fill="#ffffff" opacity={bulls >= 7 ? 0.12 : 0.55} />
      <rect x="18" y="18" width="44" height="28" rx="14" fill={bulls >= 7 ? "#7f1d1d" : "#ffffff"} opacity={bulls >= 7 ? 0.72 : 0.86} />
      <text x="40" y="37" textAnchor="middle" fontSize="15" fontWeight="900" fill={palette.ink}>{bulls}벌점</text>
      <rect x="96" y="18" width="36" height="28" rx="14" fill={bulls >= 7 ? palette.badge : "#ffffff"} opacity="0.9" />
      <text x="114" y="37" textAnchor="middle" fontSize="16" fontWeight="900" fill={bulls >= 7 ? "#7f1d1d" : palette.badge}>x{bulls}</text>
      <text x="76" y="95" textAnchor="middle" fontSize={value >= 100 ? 54 : 62} fontWeight="950" fill={palette.ink}>{value}</text>
      <g>
        {sixNimmtPenaltyMarks.slice(0, markCount).map(([cx, cy], index) => (
          <g key={`${cx}-${cy}`}>
            <path d={`M${cx - 12} ${cy + 2}c-5-10 0-20 12-20s17 10 12 20c8-2 14 2 15 9-11 0-15 5-19 12h-20c-4-7-8-12-19-12 1-7 7-11 15-9Z`} fill={bulls >= 7 ? "#fef3c7" : "#ffffff"} stroke={palette.rim} strokeWidth="2" opacity={index > 4 ? 0.64 : 0.94} />
            <circle cx={cx - 5} cy={cy + 2} r="2" fill={palette.rim} opacity="0.8" />
            <circle cx={cx + 5} cy={cy + 2} r="2" fill={palette.rim} opacity="0.8" />
          </g>
        ))}
      </g>
      <rect x="24" y="164" width="104" height="26" rx="13" fill={bulls >= 7 ? "#7f1d1d" : "#ffffff"} opacity={bulls >= 7 ? 0.72 : 0.86} />
      <text x="76" y="182" textAnchor="middle" fontSize="12" fontWeight="900" fill={palette.ink}>{bulls >= 5 ? "고위험 카드" : bulls >= 2 ? "주의 카드" : "저위험 카드"}</text>
      {selected && (
        <g>
          <rect x="42" y="48" width="68" height="22" rx="11" fill="#0f172a" opacity="0.92" />
          <text x="76" y="64" textAnchor="middle" fontSize="11" fontWeight="900" fill="#ffffff">선택됨</text>
        </g>
      )}
    </svg>
  );
};

const mergeSixNimmtRealtimeState = (previousState, realtimeState, mySeatNo) => {
  if (!realtimeState) return previousState || null;
  if (!previousState || !mySeatNo) return realtimeState;
  const previousPlayers = listOf(get(previousState, "players", "players", []));
  const realtimePlayers = listOf(get(realtimeState, "players", "players", []));
  const previousBySeat = new Map(previousPlayers.map((player) => [Number(get(player, "seat_no", "seatNo", 0)), player]));
  const selectedSeatNos = new Set(listOf(get(realtimeState, "selected_seat_nos", "selectedSeatNos", [])).map(Number));
  return {
    ...previousState,
    ...realtimeState,
    players: realtimePlayers.map((player) => {
      const seatNo = Number(get(player, "seat_no", "seatNo", 0));
      if (seatNo !== Number(mySeatNo)) return player;
      const previousPlayer = previousBySeat.get(seatNo);
      if (!previousPlayer) return player;
      const realtimeHand = listOf(get(player, "hand", "hand", []));
      const hasRealtimeSelectedCard = Object.prototype.hasOwnProperty.call(player, "selectedCard")
        || Object.prototype.hasOwnProperty.call(player, "selected_card");
      const realtimeSelected = Boolean(get(player, "selected", "selected", false)) || selectedSeatNos.has(seatNo);
      const nextSelectedCard = hasRealtimeSelectedCard
        ? get(player, "selected_card", "selectedCard", null)
        : realtimeSelected
          ? get(previousPlayer, "selected_card", "selectedCard", null)
          : null;
      const nextSelectedCardId = sixNimmtCardId(nextSelectedCard);
      const previousHand = listOf(get(previousPlayer, "hand", "hand", []));
      const nextHand = realtimeHand.length
        ? realtimeHand
        : nextSelectedCardId
          ? previousHand.filter((card) => sixNimmtCardId(card) !== nextSelectedCardId)
          : previousHand;
      return {
        ...previousPlayer,
        ...player,
        hand: nextHand,
        selectedCard: nextSelectedCard,
      };
    }),
  };
};

const SixNimmtCard = ({ card, selected = false, disabled = false, onClick, note = "", compact = false }) => {
  const clickable = typeof onClick === "function";
  const cardLabel = [
    `${sixNimmtCardValue(card)} 카드`,
    `${sixNimmtCardBulls(card)}벌점`,
    note,
    selected ? "선택됨" : "",
    disabled ? "현재 선택 불가" : clickable ? "선택 가능" : "",
  ].filter(Boolean).join(" · ");
  const className = [
    compact ? "rounded-md p-1 sm:rounded-xl sm:p-1.5" : "rounded-xl p-2 sm:rounded-2xl sm:p-3",
    "border bg-white text-left shadow-sm transition",
    selected ? "border-slate-900 ring-4 ring-slate-900/10" : "border-slate-200",
    disabled ? "opacity-50" : "",
    clickable && !disabled ? "hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200" : "",
  ].join(" ");
  const content = (
    <>
      <SixNimmtCardArt card={card} selected={selected} />
      {note && <div className={`${compact ? "mt-0.5 max-h-[22px] overflow-hidden text-[8px] leading-tight sm:mt-1 sm:max-h-none sm:text-[10px] sm:leading-snug" : "mt-2 min-h-[30px] text-[11px]"} font-bold text-slate-500`}>{note}</div>}
    </>
  );
  return clickable ? (
    <button type="button" disabled={disabled} className={className} onClick={onClick} aria-label={cardLabel} aria-pressed={selected} title={cardLabel}>{content}</button>
  ) : (
    <div className={className} title={cardLabel}>{content}</div>
  );
};

const sixNimmtRiskProfiles = {
  calm: {
    label: "낮은 압박",
    textClass: "text-emerald-700",
    borderClass: "border-emerald-100 bg-emerald-50/80",
    fill: "#10b981",
    wash: "#d1fae5",
  },
  watch: {
    label: "주의",
    textClass: "text-amber-700",
    borderClass: "border-amber-100 bg-amber-50/80",
    fill: "#d97706",
    wash: "#fef3c7",
  },
  danger: {
    label: "위험",
    textClass: "text-rose-700",
    borderClass: "border-rose-100 bg-rose-50/80",
    fill: "#e11d48",
    wash: "#ffe4e6",
  },
};

const sixNimmtRiskLevel = ({ cardCount, penalty }) => {
  if (cardCount >= 5 || penalty >= 8) return "danger";
  if (cardCount >= 4 || penalty >= 5) return "watch";
  return "calm";
};

const SixNimmtRowRiskArt = ({ cardCount = 0, penalty = 0, level = "calm", active = false, recommended = false }) => {
  const profile = sixNimmtRiskProfiles[level] || sixNimmtRiskProfiles.calm;
  const safeCount = Math.max(0, Math.min(5, Number(cardCount) || 0));
  const bullCount = Math.max(1, Math.min(7, Number(penalty) || 1));

  return (
    <svg
      data-smoke="six-nimmt-row-risk-art"
      viewBox="0 0 180 72"
      className="h-16 w-full"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="6" width="172" height="60" rx="18" fill={profile.wash} stroke={active ? "#0f172a" : profile.fill} strokeWidth={active ? 3 : 2} opacity="0.96" />
      <path d="M18 48c22-12 42-12 60 0 17 11 38 10 64-5" fill="none" stroke={profile.fill} strokeWidth="4" strokeLinecap="round" opacity="0.26" />
      {Array.from({ length: 5 }).map((_, index) => {
        const filled = index < safeCount;
        const x = 18 + index * 26;
        return (
          <g key={index}>
            <rect x={x} y="18" width="20" height="28" rx="7" fill={filled ? "#ffffff" : "none"} stroke={filled ? profile.fill : "#94a3b8"} strokeWidth="2" opacity={filled ? 0.96 : 0.38} />
            {filled && <text x={x + 10} y="36" textAnchor="middle" fontSize="10" fontWeight="900" fill={profile.fill}>{index + 1}</text>}
          </g>
        );
      })}
      <g transform="translate(140 18)">
        <path d="M12 2c8 0 12 7 8 14 6-1 10 2 11 7-8 0-11 4-14 8H5C2 27-1 23-9 23c1-5 5-8 11-7C-2 9 4 2 12 2Z" fill="#ffffff" stroke={profile.fill} strokeWidth="2" opacity="0.95" />
        <circle cx="7" cy="15" r="2" fill={profile.fill} />
        <circle cx="17" cy="15" r="2" fill={profile.fill} />
        <text x="12" y="45" textAnchor="middle" fontSize="12" fontWeight="900" fill={profile.fill}>{penalty}</text>
      </g>
      {recommended && (
        <g>
          <rect x="14" y="52" width="54" height="16" rx="8" fill="#064e3b" opacity="0.95" />
          <text x="41" y="64" textAnchor="middle" fontSize="9" fontWeight="900" fill="#ffffff">추천 회수</text>
        </g>
      )}
      {bullCount >= 5 && (
        <g opacity="0.65">
          {Array.from({ length: bullCount - 4 }).map((_, index) => (
            <circle key={index} cx={124 + index * 7} cy="54" r="2.3" fill={profile.fill} />
          ))}
        </g>
      )}
    </svg>
  );
};

const SixNimmtTurnPressureArt = ({
  playerSignals = [],
  selectedCount = 0,
  playerCount = 0,
  phase = "",
  pendingCardValue = 0,
  activeSeatNo = 0,
  mySeatNo = 0,
}) => {
  const safePlayerCount = Math.max(0, Number(playerCount) || playerSignals.length || 0);
  const safeSelectedCount = Math.max(0, Math.min(safePlayerCount || playerSignals.length, Number(selectedCount) || 0));
  const selectedRatio = safePlayerCount ? safeSelectedCount / safePlayerCount : 0;
  const visiblePlayers = playerSignals.length
    ? playerSignals.slice(0, 8)
    : Array.from({ length: Math.max(1, safePlayerCount || 1) }, (_, index) => ({
      seatNo: index + 1,
      name: `${index + 1}번`,
      shortName: `${index + 1}`,
      selected: false,
    })).slice(0, 8);
  const slotGap = visiblePlayers.length > 1 ? 500 / (visiblePlayers.length - 1) : 0;
  const isRowChoice = phase === "ROW_CHOICE";
  const isLocked = safePlayerCount > 0 && safeSelectedCount >= safePlayerCount;
  const revealFill = isRowChoice ? "#f97316" : isLocked ? "#10b981" : "#0f172a";
  const pendingLabel = pendingCardValue ? `${pendingCardValue}` : isLocked ? "공개" : "대기";

  return (
    <svg
      data-smoke="six-nimmt-turn-pressure-art"
      viewBox="0 0 640 236"
      className="h-auto w-full"
      role="img"
      aria-label={`식스님트 선택 잠금 ${safeSelectedCount}/${safePlayerCount || "-"}명`}
      focusable="false"
    >
      <rect x="10" y="10" width="620" height="216" rx="26" fill="#f8fafc" stroke="#fde68a" strokeWidth="3" />
      <path d="M42 68c58-26 111-28 159-6 54 25 111 25 172 0 65-26 120-18 166 25v104c-63-31-125-30-187 2-56 29-114 27-176-8-54-31-112-33-134-6Z" fill="#fef3c7" opacity="0.7" />
      <rect x="70" y="58" width="500" height="22" rx="11" fill="#e2e8f0" />
      <rect x="70" y="58" width={500 * selectedRatio} height="22" rx="11" fill={revealFill} />
      <text x="320" y="53" textAnchor="middle" fontSize="12" fontWeight="900" fill="#92400e">선택 잠금</text>
      <text x="320" y="76" textAnchor="middle" fontSize="12" fontWeight="900" fill="#ffffff">{safeSelectedCount}/{safePlayerCount || "-"}명</text>
      {visiblePlayers.map((player, index) => {
        const cx = visiblePlayers.length > 1 ? 70 + index * slotGap : 320;
        const selected = Boolean(player.selected);
        const active = Number(player.seatNo) === Number(activeSeatNo);
        const mine = Number(player.seatNo) === Number(mySeatNo);
        const fill = selected ? "#10b981" : active ? "#f97316" : "#ffffff";
        const stroke = mine ? "#0f172a" : selected ? "#047857" : active ? "#c2410c" : "#94a3b8";
        return (
          <g key={`${player.seatNo}-${index}`} data-smoke="six-nimmt-turn-pressure-node">
            <path d={`M${cx} 80v24`} stroke={selected ? "#10b981" : "#cbd5e1"} strokeWidth="4" strokeLinecap="round" />
            <circle cx={cx} cy="120" r={mine ? 27 : 23} fill={fill} stroke={stroke} strokeWidth={mine ? 5 : 3} />
            <text x={cx} y="125" textAnchor="middle" fontSize="11" fontWeight="900" fill={selected || active ? "#ffffff" : "#475569"}>{player.shortName}</text>
            <text x={cx} y="158" textAnchor="middle" fontSize="10" fontWeight="900" fill={selected ? "#047857" : active ? "#c2410c" : "#64748b"}>
              {selected ? "잠금" : active ? "행 선택" : "대기"}
            </text>
          </g>
        );
      })}
      {playerSignals.length > visiblePlayers.length && (
        <text x="580" y="160" textAnchor="middle" fontSize="12" fontWeight="900" fill="#64748b">+{playerSignals.length - visiblePlayers.length}</text>
      )}
      <g transform="translate(252 168)">
        <rect x="0" y="0" width="136" height="44" rx="16" fill="#ffffff" stroke={revealFill} strokeWidth="3" />
        <path d="M23 30c15-18 31-19 48-3 17 15 33 13 52-7" fill="none" stroke={revealFill} strokeWidth="5" strokeLinecap="round" opacity="0.55" />
        <rect x="54" y="7" width="28" height="30" rx="8" fill={revealFill} />
        <text x="68" y="28" textAnchor="middle" fontSize="12" fontWeight="900" fill="#ffffff">{pendingLabel}</text>
      </g>
    </svg>
  );
};

const SixNimmtTurnPressurePanel = ({
  playerSignals = [],
  pressureItems = [],
  selectedCount = 0,
  playerCount = 0,
  phase = "",
  pendingCard = null,
  activeSeatNo = 0,
  mySeatNo = 0,
}) => {
  const pendingValue = sixNimmtCardValue(pendingCard);
  const phaseLabel = sixNimmtPhaseLabels[phase] || phase || "대기";

  return (
    <section data-smoke="six-nimmt-turn-pressure-panel" className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-[1.5rem] sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black text-amber-700">선택 공개 압박</div>
          <div className="mt-1 text-base font-black text-slate-950 sm:text-lg">선택 잠금과 공개 순서</div>
        </div>
        <div className="rounded-2xl bg-amber-50 px-3 py-2 text-right">
          <div className="text-[10px] font-black text-amber-700">현재 단계</div>
          <div className="mt-0.5 text-sm font-black text-slate-900">{phaseLabel}</div>
        </div>
      </div>
      <div data-smoke="six-nimmt-turn-pressure-art" className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-black text-slate-600">
        <span className="rounded-full bg-slate-100 px-2.5 py-1">{selectedCount}/{playerCount || "-"}명 잠금</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1">{pendingValue ? `${pendingValue} 처리` : phaseLabel}</span>
        {playerSignals.slice(0, 4).map((signal) => (
          <span key={signal.seatNo} data-smoke="six-nimmt-turn-pressure-node" className={`rounded-full px-2.5 py-1 ${Number(signal.seatNo) === Number(mySeatNo) ? "bg-sky-50 text-sky-700" : Number(signal.seatNo) === Number(activeSeatNo) ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
            {signal.seatNo}번 {signal.selected ? "잠금" : "대기"}
          </span>
        ))}
      </div>
      <div className="mt-3">
        <div className="grid gap-2 md:grid-cols-4">
          {pressureItems.map((item) => (
            <div key={item.label} data-smoke="six-nimmt-turn-pressure-item" className={`rounded-xl border px-3 py-2 ${item.className}`}>
              <div className="text-[10px] font-black text-slate-500">{item.label}</div>
              <div className="mt-1 text-sm font-black text-slate-950">{item.value}</div>
              <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-relaxed text-slate-600">{item.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const sixNimmtActionRouteTone = {
  idle: { fill: "#f8fafc", stroke: "#94a3b8", text: "#475569", soft: "#e2e8f0" },
  active: { fill: "#fff7ed", stroke: "#f97316", text: "#c2410c", soft: "#fed7aa" },
  ready: { fill: "#ecfdf5", stroke: "#10b981", text: "#047857", soft: "#bbf7d0" },
  risk: { fill: "#fff1f2", stroke: "#e11d48", text: "#be123c", soft: "#fecdd3" },
  wait: { fill: "#eff6ff", stroke: "#3b82f6", text: "#1d4ed8", soft: "#bfdbfe" },
};

const buildSixNimmtActionRouteItems = ({
  phase = "",
  waitingSelection = false,
  needsRowChoice = false,
  mySelected = false,
  selectedCardValue = 0,
  pendingCardValue = 0,
  selectedPreview = null,
  selectedAnchorX = null,
  selectedRowIndex = null,
  recommendedRowIndex = -1,
  selectedCount = 0,
  playerCount = 0,
  waitingCount = 0,
}) => {
  const possibleRows = listOf(selectedPreview?.possibleRows);
  const previewLabel = selectedPreview?.label || "카드 선택 대기";
  const previewPenalty = Number(selectedPreview?.penalty || 0);
  const rowTarget = needsRowChoice
    ? recommendedRowIndex >= 0
      ? `${recommendedRowIndex + 1}행 추천`
      : "행 선택 필요"
    : selectedAnchorX !== null
      ? `${Number(selectedAnchorX) + 1}행 지정`
      : selectedRowIndex !== null
        ? `${Number(selectedRowIndex) + 1}행 후보`
        : possibleRows.length
          ? `${possibleRows.map((item) => Number(item.index) + 1).join(", ")}행 가능`
          : "자동 배치";
  const revealValue = pendingCardValue
    ? `${pendingCardValue} 카드 처리`
    : selectedCount >= playerCount && playerCount > 0
      ? "낮은 숫자부터 공개"
      : `${waitingCount}명 대기`;

  return [
    {
      key: "select",
      label: "카드 선택",
      value: mySelected ? "제출 완료" : selectedCardValue ? `${selectedCardValue} 카드` : waitingSelection ? "선택 필요" : "대기",
      detail: mySelected ? "내 카드는 공개 큐에 잠겼습니다." : waitingSelection ? "손패에서 한 장을 고르면 배치 후보와 벌점 위험이 미리 표시됩니다." : "다음 선택 단계가 오면 손패 선택이 열립니다.",
      tone: mySelected ? "border-emerald-100 bg-emerald-50 text-emerald-800" : waitingSelection ? "border-amber-100 bg-amber-50 text-amber-800" : "border-slate-100 bg-slate-50 text-slate-700",
    },
    {
      key: "reveal",
      label: "공개 순서",
      value: revealValue,
      detail: pendingCardValue ? "현재 공개된 카드의 행 배치를 먼저 끝내야 다음 카드가 처리됩니다." : "선택이 모두 잠기면 서버 규칙대로 낮은 숫자부터 행에 붙습니다.",
      tone: pendingCardValue ? "border-sky-100 bg-sky-50 text-sky-800" : "border-slate-100 bg-white text-slate-700",
    },
    {
      key: "row",
      label: "행 판단",
      value: rowTarget,
      detail: needsRowChoice ? "강제 회수 상황입니다. 벌점이 가장 낮은 행을 먼저 비교하세요." : selectedPreview ? `${previewLabel} 기준으로 행 후보를 비교합니다.` : "카드를 고르면 가능한 행과 자동 배치 기준이 표시됩니다.",
      tone: needsRowChoice ? "border-orange-100 bg-orange-50 text-orange-800" : "border-cyan-100 bg-cyan-50 text-cyan-800",
    },
    {
      key: "penalty",
      label: "벌점 영향",
      value: previewPenalty ? `${previewPenalty}벌점 위험` : selectedPreview ? "벌점 없음" : "위험 대기",
      detail: previewPenalty ? "선택 카드가 여섯 번째가 되거나 강제 회수 대상이면 이 벌점이 즉시 중요해집니다." : "행 카드 수와 황소 머리 점수를 함께 보고 손실을 줄입니다.",
      tone: previewPenalty ? "border-rose-100 bg-rose-50 text-rose-800" : "border-violet-100 bg-violet-50 text-violet-800",
    },
  ];
};

const SixNimmtActionRouteArt = ({
  phase = "",
  waitingSelection = false,
  needsRowChoice = false,
  mySelected = false,
  selectedCardValue = 0,
  pendingCardValue = 0,
  previewPenalty = 0,
}) => {
  const revealActive = Boolean(pendingCardValue) || mySelected;
  const nodes = [
    {
      key: "select",
      label: "선택",
      value: mySelected ? "완료" : selectedCardValue || (waitingSelection ? "필요" : "-"),
      tone: mySelected ? sixNimmtActionRouteTone.ready : waitingSelection ? sixNimmtActionRouteTone.active : sixNimmtActionRouteTone.idle,
    },
    {
      key: "reveal",
      label: "공개",
      value: pendingCardValue || (revealActive ? "대기" : "-"),
      tone: pendingCardValue ? sixNimmtActionRouteTone.wait : revealActive ? sixNimmtActionRouteTone.ready : sixNimmtActionRouteTone.idle,
    },
    {
      key: "row",
      label: "행",
      value: needsRowChoice ? "선택" : phase === "SELECTING" ? "예측" : "대기",
      tone: needsRowChoice ? sixNimmtActionRouteTone.active : phase === "SELECTING" ? sixNimmtActionRouteTone.wait : sixNimmtActionRouteTone.idle,
    },
    {
      key: "penalty",
      label: "벌점",
      value: previewPenalty ? `${previewPenalty}` : "회피",
      tone: previewPenalty ? sixNimmtActionRouteTone.risk : sixNimmtActionRouteTone.ready,
    },
  ];

  return (
    <svg
      viewBox="0 0 400 150"
      className="h-full min-h-[124px] w-full"
      role="img"
      aria-label="식스님트 액션 루트"
      data-smoke="six-nimmt-action-route-art"
      focusable="false"
    >
      <rect x="10" y="10" width="380" height="130" rx="24" fill="#f8fafc" stroke="#fee2e2" strokeWidth="3" />
      <path d="M58 75h284" stroke="#fee2e2" strokeWidth="14" strokeLinecap="round" />
      <path d="M58 75h284" stroke="#dc2626" strokeWidth="4" strokeLinecap="round" opacity="0.72" />
      {nodes.map((node, index) => {
        const x = 58 + index * 94.6;
        return (
          <g key={node.key} data-smoke="six-nimmt-action-route-node" data-route-key={node.key}>
            <circle cx={x} cy="75" r="31" fill="#ffffff" stroke={node.tone.stroke} strokeWidth="4" />
            <circle cx={x} cy="75" r="22" fill={node.tone.fill} stroke="#ffffff" strokeWidth="3" />
            <text x={x} y="70" textAnchor="middle" fontSize="9" fontWeight="900" fill={node.tone.text}>{node.label}</text>
            <text x={x} y="89" textAnchor="middle" fontSize="13" fontWeight="900" fill={node.tone.text}>{node.value}</text>
          </g>
        );
      })}
      <rect x="74" y="116" width="252" height="18" rx="9" fill="#ffffff" stroke="#fecaca" />
      <text x="200" y="129" textAnchor="middle" fontSize="10" fontWeight="900" fill="#7f1d1d">
        선택 → 공개 → 행 판단 → 벌점 회피
      </text>
    </svg>
  );
};

const SixNimmtActionRoutePanel = ({
  phase = "",
  waitingSelection = false,
  needsRowChoice = false,
  mySelected = false,
  selectedCard = null,
  pendingCard = null,
  selectedPreview = null,
  selectedAnchorX = null,
  selectedRowIndex = null,
  recommendedRowIndex = -1,
  selectedCount = 0,
  playerCount = 0,
  waitingCount = 0,
}) => {
  const selectedCardValue = sixNimmtCardValue(selectedCard);
  const pendingCardValue = sixNimmtCardValue(pendingCard);
  const previewPenalty = Number(selectedPreview?.penalty || 0);
  const items = buildSixNimmtActionRouteItems({
    phase,
    waitingSelection,
    needsRowChoice,
    mySelected,
    selectedCardValue,
    pendingCardValue,
    selectedPreview,
    selectedAnchorX,
    selectedRowIndex,
    recommendedRowIndex,
    selectedCount,
    playerCount,
    waitingCount,
  });

  return (
    <section
      data-smoke="six-nimmt-action-route-panel"
      data-phase={phase || ""}
      data-waiting-selection={waitingSelection ? "true" : "false"}
      data-row-choice={needsRowChoice ? "true" : "false"}
      data-my-selected={mySelected ? "true" : "false"}
      data-selected-card={selectedCardValue || ""}
      className="mt-3 overflow-hidden rounded-2xl border border-red-100 bg-gradient-to-br from-white via-red-50 to-amber-50 p-3 shadow-sm sm:mt-4 sm:rounded-[1.5rem] sm:p-4"
    >
      <div className="space-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-[11px] font-black text-red-700">식스님트 액션 루트</div>
              <h3 className="text-base font-black text-slate-900">선택, 공개, 행 판단</h3>
            </div>
            <div className="rounded-full border border-red-100 bg-white px-3 py-1 text-[11px] font-black text-red-700">
              {selectedCount}/{playerCount || "-"}명 잠금
            </div>
          </div>
          <div data-smoke="six-nimmt-action-route-art" className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-black text-slate-600">
            {items.map((item) => (
              <span key={`route-chip-${item.key}`} data-smoke="six-nimmt-action-route-node" data-route-key={item.key} className="rounded-full bg-white px-2.5 py-1">
                {item.label}: {item.value}
              </span>
            ))}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <div key={item.key} data-smoke="six-nimmt-action-route-item" data-route-key={item.key} className={`min-h-[102px] rounded-xl border px-3 py-2.5 ${item.tone}`}>
                <div className="text-[10px] font-black opacity-70">{item.label}</div>
                <div className="mt-0.5 text-sm font-black leading-snug">{item.value}</div>
                <div className="mt-1 text-[11px] font-bold leading-relaxed opacity-80">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const SixNimmtRiskPanel = ({
  rows = [],
  waitingSelection = false,
  needsRowChoice = false,
  selectedCard = null,
  selectedPreview = null,
  selectedRowIndex = null,
  recommendedRowIndex = -1,
  pendingCard = null,
}) => {
  const selectedValue = sixNimmtCardValue(selectedCard);
  const pendingValue = sixNimmtCardValue(pendingCard);
  const possibleRowSet = new Set(listOf(selectedPreview?.possibleRows).map((item) => Number(item.index)));
  const activeRowIndex = selectedRowIndex !== null && possibleRowSet.has(Number(selectedRowIndex))
    ? Number(selectedRowIndex)
    : Number(selectedPreview?.rowIndex ?? -1);
  const rowSignals = rows.map((row, index) => {
    const cards = sixNimmtRowCards(row);
    const penalty = sixNimmtRowPenalty(row);
    const cardCount = cards.length;
    const tail = cards[cards.length - 1] || null;
    const tailValue = sixNimmtCardValue(tail);
    const possible = possibleRowSet.has(index);
    const active = activeRowIndex === index;
    const recommended = needsRowChoice && recommendedRowIndex === index;
    const forcedTake = active && selectedPreview?.penalty > 0;
    const level = forcedTake || (needsRowChoice && recommended) ? sixNimmtRiskLevel({ cardCount, penalty }) : sixNimmtRiskLevel({ cardCount, penalty });
    const reason = needsRowChoice
      ? `${index + 1}행을 가져가면 ${penalty}벌점입니다.${recommended ? " 현재 최저 벌점 후보입니다." : ""}`
      : forcedTake
        ? `선택 카드가 ${index + 1}행의 여섯 번째가 되어 ${penalty}벌점을 가져갈 수 있습니다.`
        : possible
          ? `${selectedValue || "선택 카드"}를 이 행에 놓을 수 있습니다.${cardCount >= 4 ? " 다음 배치가 여섯 번째 위험입니다." : ""}`
          : cardCount >= 4
            ? "이미 4장 이상이라 다음 배치가 여섯 번째 위험입니다."
            : penalty >= 5
              ? "벌점 밀도가 높아 회수 시 손실이 큽니다."
              : "현재는 비교적 낮은 압박입니다.";
    return { index, cards, penalty, cardCount, tailValue, possible, active, recommended, level, reason };
  });
  const focusSignal = rowSignals.find((item) => item.active) || rowSignals.find((item) => item.recommended) || rowSignals.slice().sort((left, right) => right.penalty - left.penalty)[0] || null;
  const titleDetail = needsRowChoice
    ? `${pendingValue || "대기 카드"} 카드 때문에 행을 하나 회수해야 합니다.`
    : waitingSelection && selectedCard
      ? `${selectedValue} 카드의 예상 행과 벌점 압박입니다.`
      : waitingSelection
        ? "손패에서 카드를 고르면 행별 배치 후보가 강조됩니다."
        : "다음 공개 처리 전에 행별 회수 위험을 읽습니다.";

  return (
    <section data-smoke="six-nimmt-risk-panel" className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-slate-50 p-3 shadow-sm sm:rounded-[1.5rem] sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black text-amber-700">행 위험 해석</div>
          <div className="mt-1 text-base font-black text-slate-950 sm:text-lg">행별 벌점 압박</div>
          <div className="mt-1 max-w-2xl text-xs font-bold leading-relaxed text-slate-600">{titleDetail}</div>
        </div>
        {focusSignal && (
          <div className={`rounded-2xl border px-3 py-2 text-right ${sixNimmtRiskProfiles[focusSignal.level]?.borderClass || sixNimmtRiskProfiles.calm.borderClass}`}>
            <div className="text-[10px] font-black text-slate-500">핵심 신호</div>
            <div className={`mt-0.5 text-sm font-black ${sixNimmtRiskProfiles[focusSignal.level]?.textClass || sixNimmtRiskProfiles.calm.textClass}`}>
              {focusSignal.index + 1}행 · {focusSignal.penalty}벌점
            </div>
          </div>
        )}
      </div>
      <div className="mt-3 grid gap-2 lg:grid-cols-4">
        {rowSignals.map((signal) => {
          const profile = sixNimmtRiskProfiles[signal.level] || sixNimmtRiskProfiles.calm;
          return (
            <div
              key={signal.index}
              data-smoke="six-nimmt-risk-item"
              className={`rounded-2xl border p-2 ${signal.active ? "border-slate-900 bg-white shadow-md" : profile.borderClass}`}
            >
              <SixNimmtRowRiskArt
                cardCount={signal.cardCount}
                penalty={signal.penalty}
                level={signal.level}
                active={signal.active}
                recommended={signal.recommended}
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-black text-slate-900">{signal.index + 1}행 · 끝 {signal.tailValue || "-"}</div>
                <div className={`rounded-full bg-white px-2 py-1 text-[10px] font-black ${profile.textClass}`}>{profile.label}</div>
              </div>
              <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-relaxed text-slate-600">{signal.reason}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

const SixNimmtBoard = ({ gameState, players: roomPlayers = [], mySeatNo, onAction }) => {
  const [selectedCardId, setSelectedCardId] = useState("");
  const [selectedRowIndex, setSelectedRowIndex] = useState(null);
  const [displayRows, setDisplayRows] = useState([]);
  const replayEventNoRef = useRef(0);
  const replayTimersRef = useRef([]);
  const phase = get(gameState, "phase", "phase", "");
  const rows = listOf(get(gameState, "rows", "rows", []));
  const statePlayers = listOf(get(gameState, "players", "players", []));
  const selectedSeatNos = new Set(listOf(get(gameState, "selected_seat_nos", "selectedSeatNos", [])).map(Number));
  const activeSeatNo = Number(get(gameState, "active_seat_no", "activeSeatNo", 0));
  const pendingCard = get(gameState, "pending_card", "pendingCard", null);
  const events = listOf(get(gameState, "events", "events", []));
  const rowsSignature = sixNimmtRowsSignature(rows);
  const eventsSignature = sixNimmtEventsSignature(events);
  const roundNo = Number(get(gameState, "round_no", "roundNo", 0));
  const turnNo = Number(get(gameState, "turn_no", "turnNo", 0));
  const myPlayer = statePlayers.find((player) => Number(get(player, "seat_no", "seatNo", 0)) === Number(mySeatNo)) || null;
  const myHand = listOf(get(myPlayer, "hand", "hand", [])).slice().sort((a, b) => sixNimmtCardValue(a) - sixNimmtCardValue(b));
  const myHandKey = myHand.map(sixNimmtCardId).join("|");
  const mySelected = Boolean(get(myPlayer, "selected", "selected", false)) || selectedSeatNos.has(Number(mySeatNo));
  const selectedCard = myHand.find((card) => sixNimmtCardId(card) === selectedCardId) || null;
  const needsRowChoice = phase === "ROW_CHOICE" && activeSeatNo === Number(mySeatNo) && pendingCard;
  const waitingSelection = phase === "SELECTING" && !mySelected;
  const playerNameBySeat = (seatNo) => roomPlayers.find((player) => seatNoOf(player) === Number(seatNo))?.nickname || `${seatNo}번`;
  const recommendedRowIndex = rows.reduce((best, row, index) => {
    const penalty = sixNimmtRowPenalty(row);
    return best.index < 0 || penalty < best.penalty ? { index, penalty } : best;
  }, { index: -1, penalty: Number.MAX_SAFE_INTEGER }).index;

  useEffect(() => {
    if (!myHand.some((card) => sixNimmtCardId(card) === selectedCardId)) {
      setSelectedCardId("");
      setSelectedRowIndex(null);
    }
  }, [myHandKey, selectedCardId]);

  useEffect(() => {
    if (mySelected || phase !== "SELECTING") {
      setSelectedCardId("");
      setSelectedRowIndex(null);
    }
  }, [mySelected, phase]);

  useEffect(() => {
    const clearReplayTimers = () => {
      replayTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      replayTimersRef.current = [];
    };
    clearReplayTimers();

    const latestEventNo = events.reduce((latest, event) => Math.max(latest, sixNimmtEventNo(event)), 0);
    const previousEventNo = replayEventNoRef.current;
    const newEvents = events.filter((event) => sixNimmtEventNo(event) > previousEventNo);
    const placementEvents = newEvents.filter((event) => sixNimmtPlacementEventTypes.has(sixNimmtEventType(event)));
    const roundReset = newEvents.some((event) => sixNimmtEventType(event) === "ROUND_STARTED");
    const canReplayPlacements = previousEventNo > 0
      && placementEvents.length > 0
      && !roundReset
      && displayRows.length === rows.length;

    replayEventNoRef.current = latestEventNo;
    if (!canReplayPlacements) {
      setDisplayRows(cloneSixNimmtRows(rows));
      return clearReplayTimers;
    }

    let nextRows = cloneSixNimmtRows(displayRows);
    placementEvents.forEach((event, index) => {
      const applyPlacement = () => {
        nextRows = applySixNimmtPlacementEventToRows(nextRows, event);
        setDisplayRows(nextRows);
      };
      if (index === 0) {
        applyPlacement();
        return;
      }
      const timer = window.setTimeout(applyPlacement, index * 140);
      replayTimersRef.current.push(timer);
    });

    const finishTimer = window.setTimeout(() => {
      setDisplayRows(cloneSixNimmtRows(rows));
      replayTimersRef.current = [];
    }, placementEvents.length * 140 + 80);
    replayTimersRef.current.push(finishTimer);

    return clearReplayTimers;
  }, [eventsSignature, rowsSignature]);

  const rowTail = (row) => {
    const cards = sixNimmtRowCards(row);
    return cards[cards.length - 1] || null;
  };

  const possibleRowsForCard = (card) => {
    const value = sixNimmtCardValue(card);
    return rows
      .map((row, index) => ({ index, row, tail: sixNimmtCardValue(rowTail(row)), penalty: sixNimmtRowPenalty(row), full: sixNimmtRowCards(row).length >= 5 }))
      .filter((item) => item.tail < value);
  };

  const previewForCard = (card) => {
    const value = sixNimmtCardValue(card);
    let bestIndex = -1;
    let bestTail = -1;
    rows.forEach((row, index) => {
      const tailValue = sixNimmtCardValue(rowTail(row));
      if (tailValue < value && tailValue > bestTail) {
        bestTail = tailValue;
        bestIndex = index;
      }
    });
    const possibleRows = possibleRowsForCard(card);
    if (bestIndex < 0) return { label: "행 선택 필요", tone: "text-amber-700", rowIndex: -1, penalty: 0, possibleRows };
    const officialRows = possibleRows.filter((item) => item.index === bestIndex);
    const row = rows[bestIndex];
    if (sixNimmtRowCards(row).length >= 5) {
      return { label: `${bestIndex + 1}행 회수`, tone: "text-rose-700", rowIndex: bestIndex, penalty: sixNimmtRowPenalty(row), possibleRows: officialRows };
    }
    return { label: `${bestIndex + 1}행 배치`, tone: "text-emerald-700", rowIndex: bestIndex, penalty: 0, possibleRows: officialRows };
  };

  const selectCard = async () => {
    if (!selectedCardId || !waitingSelection) return;
    await onAction({ actionType: "SELECT_CARD", cardIds: [selectedCardId] });
  };
  const chooseRow = async (rowIndex) => {
    if (!needsRowChoice) return;
    await onAction({ actionType: "CHOOSE_ROW", anchorX: rowIndex });
  };

  const selectedPreview = selectedCard ? previewForCard(selectedCard) : null;
  const selectedAnchorX = null;
  const boardRows = displayRows.length === rows.length ? displayRows : rows;
  const phaseLabel = sixNimmtPhaseLabels[phase] || phase || "-";
  const mostDangerousRow = rows.reduce((best, row, index) => {
    const penalty = sixNimmtRowPenalty(row);
    const cardCount = sixNimmtRowCards(row).length;
    if (best.index < 0 || penalty > best.penalty || (penalty === best.penalty && cardCount > best.cardCount)) {
      return { index, penalty, cardCount };
    }
    return best;
  }, { index: -1, penalty: 0, cardCount: 0 });
  const sixNimmtTurnPlayers = statePlayers.map((player) => {
    const seatNo = Number(get(player, "seat_no", "seatNo", 0));
    const name = playerNameBySeat(seatNo);
    const playerSelectedCard = get(player, "selected_card", "selectedCard", null);
    const selected = Boolean(get(player, "selected", "selected", false)) || selectedSeatNos.has(seatNo) || Boolean(playerSelectedCard);
    return {
      seatNo,
      name,
      shortName: name.replace(/\s+/g, "").slice(0, 3) || `${seatNo}`,
      selected,
      selectedCardValue: sixNimmtCardValue(playerSelectedCard),
      totalPenalty: Number(get(player, "total_penalty", "totalPenalty", 0)),
      roundPenalty: Number(get(player, "round_penalty", "roundPenalty", 0)),
      handCount: Number(get(player, "hand_count", "handCount", 0)),
    };
  });
  const sixNimmtPlayerCount = sixNimmtTurnPlayers.length || roomPlayers.length || 0;
  const sixNimmtSelectedCount = Math.max(selectedSeatNos.size, sixNimmtTurnPlayers.filter((player) => player.selected).length);
  const sixNimmtWaitingCount = Math.max(0, sixNimmtPlayerCount - sixNimmtSelectedCount);
  const sixNimmtFlowItems = [
    {
      label: "라운드",
      value: `${roundNo || "-"}R · ${turnNo || "-"}턴`,
      detail: phaseLabel,
      icon: "stage",
      tone: "neutral",
    },
    {
      label: "제출",
      value: `${selectedSeatNos.size}/${statePlayers.length || "-"}명`,
      detail: mySelected ? "내 카드는 제출 완료" : waitingSelection ? "내 카드 선택 필요" : "공개 대기",
      icon: "player",
      tone: mySelected ? "done" : waitingSelection ? "active" : "waiting",
    },
    {
      label: "위험 행",
      value: mostDangerousRow.index >= 0 ? `${mostDangerousRow.index + 1}행 · ${mostDangerousRow.penalty}벌점` : "-",
      detail: mostDangerousRow.index >= 0 ? `${mostDangerousRow.cardCount}/5장 상태` : "행 정보 대기",
      icon: "score",
      tone: mostDangerousRow.penalty >= 8 || mostDangerousRow.cardCount >= 4 ? "danger" : "waiting",
    },
    {
      label: "내 예측",
      value: mySelected ? "제출 완료" : selectedPreview ? selectedPreview.label : needsRowChoice ? "행 선택 필요" : "카드 선택",
      detail: selectedPreview?.penalty ? `${selectedPreview.penalty}벌점 위험` : selectedPreview ? "공식 규칙상 가장 가까운 행에 자동 배치" : "선택 전 미리보기",
      icon: "decision",
      tone: selectedPreview?.penalty ? "danger" : mySelected ? "done" : "neutral",
    },
  ];

  return (
    <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-4">
      <main className="space-y-2 xl:space-y-4">
        <section id="six-nimmt-board-panel" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg sm:rounded-[1.5rem] sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
            <div>
              <div className="text-xs font-black text-slate-500 sm:text-sm">라운드 {roundNo} · 턴 {turnNo}</div>
              <div className="mt-0.5 text-lg font-black text-slate-900 sm:mt-1 sm:text-2xl">{phaseLabel}</div>
              <div className="mt-2 hidden max-w-2xl text-[11px] font-bold leading-relaxed text-slate-500 sm:block sm:text-xs">
                모두 카드를 한 장씩 고르면 낮은 숫자부터 처리됩니다. 내 카드보다 작은 끝 카드 중 가장 큰 행에 붙고, 여섯 번째가 되면 그 행의 벌점을 가져갑니다.
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-right sm:rounded-2xl sm:px-4 sm:py-3">
              <div className="text-[9px] font-black text-slate-400 sm:text-[11px]">선택 완료</div>
              <div className="text-base font-black text-slate-900 sm:text-lg">{selectedSeatNos.size}/{statePlayers.length}</div>
            </div>
          </div>

          <div className="mt-3 grid gap-2 text-xs font-black text-slate-700 sm:grid-cols-4">
            {sixNimmtFlowItems.map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="text-[10px] text-slate-400">{item.label}</div>
                <div className="mt-0.5 truncate text-sm text-slate-900">{item.value}</div>
              </div>
            ))}
          </div>

          {needsRowChoice && (
            <div className="mt-2 rounded-xl border border-amber-100 bg-amber-50 p-2 text-xs font-bold leading-relaxed text-amber-800 sm:mt-4 sm:rounded-2xl sm:p-3 sm:text-sm">
              {playerNameBySeat(activeSeatNo)}님이 {sixNimmtCardValue(pendingCard)} 카드를 놓을 행을 선택해야 합니다. 벌점이 가장 낮은 행이 기본 추천입니다.
            </div>
          )}

          <div className="mt-2 grid gap-1.5 sm:mt-4 sm:gap-3">
            {boardRows.map((row, index) => {
              const cards = sixNimmtRowCards(row);
              const penalty = sixNimmtRowPenalty(row);
              const selectedRow = selectedPreview?.rowIndex === index;
              const automaticRowCandidate = waitingSelection && selectedRow;
              const recommended = needsRowChoice && recommendedRowIndex === index;
              return (
                <div key={index} className={`rounded-lg border p-1.5 transition sm:rounded-2xl sm:p-3 ${selectedRow ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-1 sm:mb-2 sm:gap-2">
                    <div className="text-xs font-black text-slate-900 sm:text-sm">{index + 1}행</div>
                    <div className="flex flex-wrap items-center gap-1 text-[9px] font-black sm:gap-1.5 sm:text-[11px]">
                      <span className="rounded-full bg-white px-1.5 py-0.5 text-slate-600 sm:px-2 sm:py-1">{cards.length}/5장</span>
                      <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-rose-700 sm:px-2 sm:py-1">{penalty}벌점</span>
                      {automaticRowCandidate && <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-sky-700 sm:px-2 sm:py-1">자동 배치</span>}
                      {recommended && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-emerald-700 sm:px-2 sm:py-1">추천</span>}
                    </div>
                  </div>
                  <div className="block w-full rounded-lg text-left">
                    <div className="grid grid-cols-5 gap-1 sm:gap-2">
                    {cards.map((card) => <SixNimmtCard key={sixNimmtCardId(card)} card={card} compact />)}
                    {Array.from({ length: Math.max(0, 5 - cards.length) }).map((_, emptyIndex) => (
                      <div key={`empty-${emptyIndex}`} className="min-h-[46px] rounded-md border border-dashed border-slate-200 bg-white/70 sm:min-h-[76px] sm:rounded-xl" />
                    ))}
                    </div>
                  </div>
                  {needsRowChoice && (
                    <button type="button" onClick={() => chooseRow(index)} className="mt-2 min-h-9 w-full rounded-xl bg-slate-900 px-3 text-xs font-black text-white sm:mt-3 sm:min-h-10">
                      이 행 가져가기 · {penalty}벌점
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section id="six-nimmt-hand-panel" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg sm:rounded-[1.5rem] sm:p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 sm:mb-3">
            <div>
              <div className="text-sm font-black text-slate-900 sm:text-lg">내 손패</div>
              <div className="mt-0.5 text-[11px] font-bold text-slate-500 sm:mt-1 sm:text-xs">{mySelected ? "이번 턴 카드를 제출했습니다." : "카드를 고르면 예상 배치와 벌점을 먼저 볼 수 있습니다."}</div>
            </div>
            {selectedPreview && (
              <div className={`rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black sm:px-3 sm:text-xs ${selectedPreview.tone}`}>
                {selectedPreview.label}{selectedPreview.penalty ? ` · ${selectedPreview.penalty}벌점` : ""}
              </div>
            )}
          </div>
          <div className="grid grid-cols-5 gap-1 sm:gap-2 lg:grid-cols-5">
            {myHand.map((card) => {
              const preview = previewForCard(card);
              const possibleRowLabel = preview.rowIndex >= 0
                ? `${preview.rowIndex + 1}행 자동`
                : "행 회수 선택";
              return (
                <SixNimmtCard
                  key={sixNimmtCardId(card)}
                  card={card}
                  selected={sixNimmtCardId(card) === selectedCardId}
                  disabled={!waitingSelection}
                  onClick={() => {
                    setSelectedCardId(sixNimmtCardId(card));
                    setSelectedRowIndex(null);
                  }}
                  note={`${possibleRowLabel} · ${preview.label}${preview.penalty ? ` · ${preview.penalty}벌점` : ""}`}
                  compact
                />
              );
            })}
          </div>
          <div id="six-nimmt-action-strip" className="tabletop-mobile-action-strip sticky bottom-3 z-20 mt-2 scroll-mt-24 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-xl backdrop-blur sm:mt-4 sm:p-3 xl:static xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none">
            {waitingSelection ? (
              <button type="button" disabled={!selectedCardId} onClick={selectCard} className="min-h-12 w-full rounded-xl bg-slate-900 px-4 text-sm font-black text-white disabled:opacity-40">
                선택한 카드 제출
              </button>
            ) : needsRowChoice ? (
              <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-black leading-relaxed text-amber-800">가져갈 행을 위에서 선택하세요.</div>
            ) : (
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-black leading-relaxed text-slate-500">다른 플레이어의 선택을 기다리는 중입니다.</div>
            )}
          </div>
        </section>

        <section data-smoke="six-nimmt-compact-summary" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg sm:rounded-[1.5rem] sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-black text-slate-900">핵심 요약</div>
              <div className="mt-0.5 text-xs font-bold text-slate-500">보드와 손패를 본 뒤 필요한 판단만 압축해서 확인합니다.</div>
            </div>
            <div className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-black text-amber-700">
              {sixNimmtSelectedCount}/{sixNimmtPlayerCount || "-"}명 선택
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                key: "phase",
                label: "현재 단계",
                value: phaseLabel,
                detail: mySelected ? "내 카드는 제출 완료" : waitingSelection ? "손패에서 한 장 선택" : needsRowChoice ? "가져갈 행 선택" : "진행 대기",
              },
              {
                key: "lock",
                label: "선택 잠금",
                value: `${sixNimmtSelectedCount}/${sixNimmtPlayerCount || "-"}명`,
                detail: sixNimmtWaitingCount > 0 ? `${sixNimmtWaitingCount}명 대기` : "공개 준비 완료",
              },
              {
                key: "risk",
                label: "주의 행",
                value: mostDangerousRow.index >= 0 ? `${mostDangerousRow.index + 1}행 · ${mostDangerousRow.penalty}벌점` : "-",
                detail: mostDangerousRow.index >= 0 ? `${mostDangerousRow.cardCount}/5장` : "행 정보 대기",
              },
              {
                key: "preview",
                label: "내 예측",
                value: mySelected ? "제출 완료" : selectedPreview ? selectedPreview.label : needsRowChoice ? "행 선택 필요" : "카드 선택",
                detail: selectedPreview?.penalty ? `${selectedPreview.penalty}벌점 위험` : selectedPreview ? "자동 배치 후보" : "선택 전",
              },
            ].map((item) => (
              <div key={item.key} data-smoke="six-nimmt-compact-summary-item" className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="text-[10px] font-black text-slate-400">{item.label}</div>
                <div className="mt-0.5 truncate text-sm font-black text-slate-900">{item.value}</div>
                <div className="mt-0.5 truncate text-[11px] font-bold text-slate-500">{item.detail}</div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <aside className="space-y-4">
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
          <div className="mb-3 text-sm font-black text-slate-900">벌점 현황</div>
          <div className="grid gap-2">
            {statePlayers.map((player) => {
              const seatNo = Number(get(player, "seat_no", "seatNo", 0));
              const totalPenalty = Number(get(player, "total_penalty", "totalPenalty", 0));
              const roundPenalty = Number(get(player, "round_penalty", "roundPenalty", 0));
              const winner = Boolean(get(player, "winner", "winner", false));
              return (
                <div key={seatNo} className={`rounded-2xl border px-3 py-2 ${seatNo === Number(mySeatNo) ? "border-amber-200 bg-amber-50" : "border-slate-100 bg-slate-50"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-black text-slate-900">{playerNameBySeat(seatNo)}</div>
                    {winner && <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700">승리</span>}
                  </div>
                  <div className="mt-1 text-xs font-bold text-slate-500">총 {totalPenalty} · 이번 라운드 {roundPenalty} · 손패 {get(player, "hand_count", "handCount", 0)}장</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
          <div className="mb-3 text-sm font-black text-slate-900">최근 기록</div>
          <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
            {[...events].slice(-12).reverse().map((event) => {
              const eventType = get(event, "event_type", "eventType", "");
              const normalizedEventType = String(eventType || "").toUpperCase();
              const seatNo = Number(get(event, "seat_no", "seatNo", 0));
              const cardValue = get(event, "card_value", "cardValue", "");
              const displayCardValue = normalizedEventType === "SELECT_CARD" ? "" : cardValue;
              const value = get(event, "value", "value", "");
              return (
                <div key={get(event, "event_no", "eventNo", eventType)} className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                  <div className="font-black text-slate-800">{sixNimmtEventLabels[normalizedEventType] || eventType}</div>
                  <div className="mt-1">{seatNo ? playerNameBySeat(seatNo) : "시스템"}{displayCardValue ? ` · 카드 ${displayCardValue}` : ""}{value ? ` · ${value}` : ""}</div>
                </div>
              );
            })}
            {!events.length && (
              <TabletopHistoryEmptyState
                game="six-nimmt"
                title="아직 카드 기록이 없습니다"
                detail="카드 선택이나 행 회수가 처리되면 공개 순서와 벌점 근거가 이 기록 영역에 쌓입니다."
                nextAction="첫 공개"
              />
            )}
          </div>
        </section>
      </aside>
    </div>
  );
};

export { SixNimmtBoard };
export default SixNimmtBoard;
