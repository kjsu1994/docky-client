import { useEffect, useMemo, useState } from "react";
import { Crown } from "lucide-react";
import { notifyError } from "../../utils/toast.js";
import { GameFlowMeter, GameUxGlyph } from "./GameUxAssets.jsx";

const get = (obj, snake, camel, fallback = undefined) => obj?.[camel] ?? obj?.[snake] ?? fallback;
const listOf = (value) => (Array.isArray(value) ? value : []);
const seatNoOf = (player) => Number(get(player, "seat_no", "seatNo", 0));

const dalmutiRoleLabels = {
  GREATER_DALMUTI: "대 달무티",
  LESSER_DALMUTI: "소 달무티",
  MERCHANT: "상인",
  LESSER_PEON: "소 농노",
  GREATER_PEON: "대 농노",
};

const dalmutiPhaseLabels = {
  REVOLUTION_DECISION: "혁명 선택",
  TAX_RETURN: "세금 반환",
  PLAYING: "진행 중",
  FINISHED: "한 판 종료",
};

const dalmutiEventLabels = {
  AUTO_REVOLUTION: "자동 혁명",
  REVOLUTION: "혁명",
  RETURN_TAX: "세금 반환",
  TAX_APPLIED: "세금 적용",
  PLAY: "제출",
  PASS: "패스",
  TRICK_CLEARED: "판 정리",
  OUT: "탈출",
};

const dalmutiRankLabels = {
  1: "위대한 달무티",
  2: "대주교",
  3: "시종장",
  4: "남작부인",
  5: "수도원장",
  6: "기사",
  7: "재봉사",
  8: "석공",
  9: "요리사",
  10: "양치기",
  11: "석공노동자",
  12: "농노",
  13: "광대",
};

const dalmutiRankLabel = (rank) => dalmutiRankLabels[Number(rank)] || `${rank}계급`;
const dalmutiCardPalettes = {
  high: {
    paper: "#fff7ed",
    rim: "#92400e",
    wash: "#fde68a",
    ink: "#1f2937",
    accent: "#dc2626",
    badge: "#78350f",
  },
  mid: {
    paper: "#f0fdfa",
    rim: "#0f766e",
    wash: "#99f6e4",
    ink: "#134e4a",
    accent: "#0ea5e9",
    badge: "#155e75",
  },
  low: {
    paper: "#f8fafc",
    rim: "#475569",
    wash: "#e2e8f0",
    ink: "#334155",
    accent: "#64748b",
    badge: "#1e293b",
  },
  jester: {
    paper: "#312e81",
    rim: "#fbbf24",
    wash: "#a855f7",
    ink: "#f8fafc",
    accent: "#f97316",
    badge: "#fef3c7",
  },
};

const dalmutiMarkPositions = [
  [80, 92],
  [58, 78],
  [102, 78],
  [58, 112],
  [102, 112],
  [80, 130],
  [42, 96],
  [118, 96],
];

const DalmutiCardArt = ({ rank, jester, name, selected }) => {
  const palette = jester
    ? dalmutiCardPalettes.jester
    : rank <= 3
      ? dalmutiCardPalettes.high
      : rank <= 7
        ? dalmutiCardPalettes.mid
        : dalmutiCardPalettes.low;
  const displayRank = jester ? "J" : String(rank || "?");
  const displayName = jester ? "광대" : String(name || dalmutiRankLabel(rank)).slice(0, 7);
  const caption = jester ? "와일드" : rank <= 3 ? "상위 계급" : rank <= 7 ? "중간 계급" : "하위 계급";
  const markCount = jester ? 0 : Math.max(1, Math.min(dalmutiMarkPositions.length, rank || 1));

  return (
    <svg
      data-smoke="dalmuti-card-art"
      viewBox="0 0 160 224"
      className="block w-full"
      style={{ aspectRatio: "5 / 7" }}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="6" y="6" width="148" height="212" rx="18" fill={palette.paper} stroke={selected ? "#0f172a" : palette.rim} strokeWidth={selected ? 5 : 3} />
      <path d="M22 26h116v148c-25 18-54 24-86 16-14-4-24-11-30-20Z" fill={palette.wash} opacity={jester ? 0.42 : 0.58} />
      <path d="M22 32c24 14 48 14 72 0 18-10 34-9 46 2v30c-18-13-36-13-54 0-28 19-55 17-64-5Z" fill="#ffffff" opacity={jester ? 0.14 : 0.55} />
      <rect x="18" y="18" width="38" height="42" rx="10" fill={jester ? "#1e1b4b" : "#ffffff"} opacity={jester ? 0.72 : 0.82} />
      <text x="37" y="46" textAnchor="middle" fontSize="25" fontWeight="900" fill={palette.ink}>{displayRank}</text>
      <rect x="104" y="18" width="38" height="24" rx="12" fill={jester ? palette.badge : "#ffffff"} opacity={jester ? 0.95 : 0.85} />
      <text x="123" y="34" textAnchor="middle" fontSize="11" fontWeight="900" fill={jester ? "#581c87" : palette.badge}>{jester ? "광대" : `${rank}장`}</text>
      {jester ? (
        <g>
          <path d="M43 133c8-36 19-58 35-66 13 12 21 25 25 40 9-23 20-38 34-45 8 33 3 60-15 82-23 16-49 15-79-11Z" fill="#fbbf24" stroke="#1e1b4b" strokeWidth="6" strokeLinejoin="round" />
          <path d="M55 132c9-22 17-37 25-45 10 11 16 25 18 42 9-20 19-33 30-39 0 21-8 38-25 51-17 7-33 5-48-9Z" fill="#f97316" opacity="0.78" />
          <circle cx="78" cy="67" r="9" fill="#fb7185" stroke="#fef3c7" strokeWidth="4" />
          <circle cx="136" cy="62" r="9" fill="#22c55e" stroke="#fef3c7" strokeWidth="4" />
          <circle cx="42" cy="133" r="8" fill="#38bdf8" stroke="#fef3c7" strokeWidth="4" />
        </g>
      ) : (
        <g>
          <path d="M49 142h62l8 24H41Z" fill="#ffffff" opacity="0.72" />
          <path d="M46 144l14-29 21 22 21-22 14 29Z" fill={palette.accent} opacity="0.86" stroke={palette.rim} strokeWidth="3" strokeLinejoin="round" />
          {dalmutiMarkPositions.slice(0, markCount).map(([cx, cy], index) => (
            <g key={`${cx}-${cy}`}>
              {rank <= 3 ? (
                <path d={`M${cx} ${cy - 9}l6 7 9 1-6 6 2 9-11-5-10 5 2-9-7-6 10-1Z`} fill="#ffffff" stroke={palette.rim} strokeWidth="2" opacity={index > 5 ? 0.62 : 0.9} />
              ) : (
                <circle cx={cx} cy={cy} r={rank <= 7 ? 8 : 7} fill="#ffffff" stroke={palette.accent} strokeWidth="3" opacity={index > 5 ? 0.62 : 0.9} />
              )}
            </g>
          ))}
        </g>
      )}
      <rect x="20" y="176" width="120" height="28" rx="14" fill={jester ? "#1e1b4b" : "#ffffff"} opacity={jester ? 0.68 : 0.82} />
      <text x="80" y="195" textAnchor="middle" fontSize="14" fontWeight="900" fill={palette.ink}>{displayName}</text>
      <text x="80" y="213" textAnchor="middle" fontSize="9" fontWeight="800" fill={jester ? "#fde68a" : palette.badge}>{caption}</text>
      {selected && (
        <g>
          <rect x="34" y="65" width="92" height="24" rx="12" fill="#0f172a" opacity="0.9" />
          <text x="80" y="82" textAnchor="middle" fontSize="12" fontWeight="900" fill="#ffffff">선택됨</text>
        </g>
      )}
    </svg>
  );
};

const DalmutiCard = ({ card, selected, onClick, disabled }) => {
  const rank = Number(card?.rank || 0);
  const jester = Boolean(card?.jester);
  const cardName = card?.name || "카드";
  const cardLabel = [
    cardName,
    jester ? "광대 와일드 카드" : `${rank}계급 카드`,
    selected ? "선택됨" : "선택 안 됨",
    disabled ? "현재 선택 불가" : "선택 가능",
  ].join(" · ");
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={cardLabel}
      aria-pressed={selected}
      title={cardLabel}
      className={[
        "relative rounded-xl border bg-white p-1.5 text-left shadow-sm transition disabled:opacity-70",
        selected ? "tabletop-selected-card border-slate-950 ring-2 ring-slate-950" : "border-slate-200 hover:-translate-y-1 hover:border-slate-400",
      ].join(" ")}
    >
      <DalmutiCardArt rank={rank} jester={jester} name={cardName} selected={selected} />
    </button>
  );
};

const DalmutiPlayAdvisorArt = ({
  selectedRank = 0,
  selectedCount = 0,
  requiredRank = 0,
  requiredCount = 0,
  legal = false,
  phase = "PLAYING",
}) => {
  const selectedLabel = selectedCount
    ? selectedRank ? dalmutiRankLabel(selectedRank) : "광대"
    : "미선택";
  const requiredLabel = requiredCount
    ? `${dalmutiRankLabel(requiredRank)} ${requiredCount}장`
    : "새 기준";
  const resultFill = legal ? "#dcfce7" : selectedCount ? "#ffe4e6" : "#f8fafc";
  const resultStroke = legal ? "#16a34a" : selectedCount ? "#e11d48" : "#94a3b8";
  const resultText = legal ? "제출 가능" : selectedCount ? "조건 불일치" : "선택 대기";
  const selectedSlots = Array.from({ length: Math.max(1, Math.min(5, selectedCount || requiredCount || 1)) }, (_, index) => index);
  const requiredSlots = Array.from({ length: Math.max(1, Math.min(5, requiredCount || selectedCount || 1)) }, (_, index) => index);

  return (
    <svg
      viewBox="0 0 360 220"
      className="h-full min-h-[150px] w-full"
      role="img"
      aria-label={`달무티 제출 판단, 기준 ${requiredLabel}, 선택 ${selectedLabel} ${selectedCount}장`}
      data-smoke="dalmuti-play-advisor-art"
    >
      <defs>
        <linearGradient id="dalmutiAdvisorWash" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#f5f3ff" />
          <stop offset="0.55" stopColor="#ffffff" />
          <stop offset="1" stopColor="#ecfeff" />
        </linearGradient>
      </defs>
      <rect x="14" y="14" width="332" height="192" rx="28" fill="url(#dalmutiAdvisorWash)" stroke="#ffffff" strokeWidth="3" />
      <path d="M72 155c35-56 83-84 144-84 32 0 60 8 84 24" fill="none" stroke="#ddd6fe" strokeWidth="14" strokeLinecap="round" />
      <path d="M74 155c36-46 83-69 142-69 33 0 61 8 84 24" fill="none" stroke="#7c3aed" strokeWidth="5" strokeLinecap="round" opacity="0.62" />
      <g>
        <rect x="42" y="56" width="104" height="76" rx="18" fill="#312e81" opacity="0.12" />
        <rect x="34" y="48" width="116" height="88" rx="18" fill="#ffffff" stroke="#c4b5fd" strokeWidth="3" />
        <text x="92" y="72" textAnchor="middle" fontSize="12" fontWeight="900" fill="#6d28d9">현재 기준</text>
        <text x="92" y="98" textAnchor="middle" fontSize="18" fontWeight="900" fill="#312e81">{requiredLabel}</text>
        <g>
          {requiredSlots.map((slot) => (
            <rect key={slot} x={58 + slot * 13} y="111" width="24" height="32" rx="6" fill="#ede9fe" stroke="#7c3aed" strokeWidth="2" opacity={slot < requiredCount || !requiredCount ? 1 : 0.42} />
          ))}
        </g>
      </g>
      <g>
        <rect x="218" y="56" width="104" height="76" rx="18" fill="#312e81" opacity="0.12" />
        <rect x="210" y="48" width="116" height="88" rx="18" fill="#ffffff" stroke={resultStroke} strokeWidth="3" />
        <text x="268" y="72" textAnchor="middle" fontSize="12" fontWeight="900" fill="#0f766e">선택 묶음</text>
        <text x="268" y="98" textAnchor="middle" fontSize="18" fontWeight="900" fill="#0f172a">{selectedLabel}</text>
        <g>
          {selectedSlots.map((slot) => (
            <rect key={slot} x={234 + slot * 13} y="111" width="24" height="32" rx="6" fill={resultFill} stroke={resultStroke} strokeWidth="2" opacity={slot < selectedCount || !selectedCount ? 1 : 0.42} />
          ))}
        </g>
      </g>
      <g>
        <circle cx="180" cy="92" r="30" fill={resultFill} stroke={resultStroke} strokeWidth="4" />
        <path d={legal ? "M166 92l10 10 20-23" : "M168 80l24 24M192 80l-24 24"} fill="none" stroke={legal ? "#16a34a" : selectedCount ? "#e11d48" : "#64748b"} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <rect x="92" y="164" width="176" height="34" rx="17" fill={resultFill} stroke={resultStroke} strokeWidth="3" />
      <text x="180" y="186" textAnchor="middle" fontSize="14" fontWeight="900" fill={legal ? "#166534" : selectedCount ? "#be123c" : "#475569"}>{phase === "FINISHED" ? "결과 확인" : resultText}</text>
    </svg>
  );
};

const DalmutiPlayAdvisorPanel = ({
  phase,
  canPlay,
  canReturnTax,
  canDecideRevolution,
  selectedCards = [],
  selectedPlayStatus,
  currentTrick,
  currentTrickCount = 0,
  currentTrickRank = 0,
  handRankGroups = [],
  pendingTaxCount = 0,
  passCount = 0,
  requiredPassCount = 0,
  taxProgressText = "",
  selectionHint = "",
  trickClearHint = "",
}) => {
  const normalSelectedCards = selectedCards.filter((card) => !card.jester);
  const selectedRank = normalSelectedCards.length ? Number(normalSelectedCards[0].rank || 0) : 0;
  const selectedCount = selectedCards.length;
  const jokerCount = handRankGroups.find((group) => group.jester)?.cards.length || 0;
  const requiredCount = currentTrick ? currentTrickCount : 0;
  const requiredRank = currentTrick ? currentTrickRank : 0;
  const candidateGroups = handRankGroups
    .filter((group) => !group.jester)
    .filter((group) => {
      if (phase !== "PLAYING") return false;
      if (!currentTrick) return group.cards.length > 0;
      return group.rank < currentTrickRank && group.cards.length + jokerCount >= currentTrickCount;
    });
  const bestCandidate = candidateGroups[0];
  const legal = Boolean(phase === "PLAYING" && canPlay && selectedPlayStatus?.legal);
  const advisorMode = phase === "TAX_RETURN"
    ? "세금 반환"
    : phase === "REVOLUTION_DECISION"
      ? "혁명 판단"
      : phase === "FINISHED"
        ? "결과 확인"
        : canPlay
          ? "제출 판단"
          : "차례 대기";
  const selectedLabel = selectedCount
    ? `${selectedRank ? dalmutiRankLabel(selectedRank) : "광대"} ${selectedCount}장`
    : "선택 없음";
  const criteriaText = phase === "TAX_RETURN"
    ? `${pendingTaxCount}장 반환 필요`
    : currentTrick
      ? `${dalmutiRankLabel(currentTrickRank)} ${currentTrickCount}장보다 높은 같은 장수`
      : "같은 계급 여러 장으로 새 기준 생성";
  const candidateText = bestCandidate
    ? `${bestCandidate.label} ${Math.min(bestCandidate.cards.length, currentTrickCount || bestCandidate.cards.length)}장`
    : phase === "PLAYING" ? "즉시 후보 없음" : advisorMode;
  const guideItems = [
    {
      label: "제출 기준",
      value: criteriaText,
      detail: currentTrick ? trickClearHint : "기준이 없으면 같은 계급 묶음으로 새 흐름을 열 수 있습니다.",
      tone: "border-violet-100 bg-violet-50 text-violet-800",
    },
    {
      label: "선택 묶음",
      value: selectedLabel,
      detail: selectionHint || selectedPlayStatus?.reason || "카드를 선택하면 제출 가능 여부가 여기서 분해됩니다.",
      tone: selectedCount ? (selectedPlayStatus?.legal ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-rose-100 bg-rose-50 text-rose-800") : "border-slate-100 bg-white text-slate-700",
    },
    {
      label: "빠른 후보",
      value: candidateText,
      detail: jokerCount ? `광대 ${jokerCount}장은 부족한 장수를 보탤 수 있습니다.` : "현재 손패의 계급 묶음을 기준으로 계산했습니다.",
      tone: bestCandidate ? "border-cyan-100 bg-cyan-50 text-cyan-800" : "border-slate-100 bg-white text-slate-600",
    },
    {
      label: phase === "TAX_RETURN" ? "반환 진행" : "패스 압력",
      value: phase === "TAX_RETURN" ? taxProgressText : currentTrick ? `${passCount}/${requiredPassCount}` : "새 기준",
      detail: phase === "REVOLUTION_DECISION" ? "광대 2장을 가진 플레이어의 혁명 선언 단계입니다." : phase === "TAX_RETURN" ? "세금 반환이 끝나야 라운드가 진행됩니다." : "모두 패스하면 현재 기준이 정리되고 다음 기준으로 넘어갑니다.",
      tone: "border-amber-100 bg-amber-50 text-amber-800",
    },
  ];

  return (
    <section data-smoke="dalmuti-play-advisor-panel" className="mt-4 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-cyan-50 p-3 shadow-sm sm:rounded-[1.5rem] sm:p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(220px,0.78fr)_minmax(0,1fr)]">
        <div className="min-h-[170px]">
          <DalmutiPlayAdvisorArt
            selectedRank={selectedRank}
            selectedCount={selectedCount}
            requiredRank={requiredRank}
            requiredCount={requiredCount}
            legal={legal}
            phase={phase}
          />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-black uppercase text-violet-700">Dalmuti Play Advisor</div>
              <h3 className="text-base font-black text-slate-900">카드 제출 판단</h3>
            </div>
            <div className={`rounded-full border px-3 py-1 text-[11px] font-black ${legal || canReturnTax || canDecideRevolution ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}`}>
              {advisorMode}
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {guideItems.map((item) => (
              <div key={item.label} data-smoke="dalmuti-play-advisor-item" className={`rounded-xl border px-3 py-2.5 ${item.tone}`}>
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

const DalmutiRankPressureArt = ({ rows = [], activeSeatNo = 0, leadSeatNo = 0, maxHandCount = 12 }) => {
  const safeMax = Math.max(1, Number(maxHandCount) || 12);
  const visibleRows = rows.slice(0, 6);
  const laneStart = 112;
  const laneWidth = 228;

  return (
    <svg
      viewBox="0 0 420 236"
      className="h-full min-h-[170px] w-full"
      role="img"
      aria-label="달무티 손패 소진과 계급 압력"
      data-smoke="dalmuti-rank-pressure-art"
    >
      <rect x="14" y="14" width="392" height="208" rx="26" fill="#faf5ff" stroke="#ddd6fe" strokeWidth="3" />
      <path d="M44 190h316" stroke="#c4b5fd" strokeWidth="5" strokeLinecap="round" />
      <path d="M340 78v118" stroke="#7c3aed" strokeWidth="3" strokeLinecap="round" strokeDasharray="5 6" />
      <text x="337" y="68" textAnchor="middle" fontSize="11" fontWeight="900" fill="#6d28d9">0장</text>
      <rect x="30" y="28" width="182" height="38" rx="15" fill="#ffffff" stroke="#c4b5fd" strokeWidth="2" />
      <text x="46" y="52" fontSize="13" fontWeight="900" fill="#6d28d9">손패 레이스</text>
      <text x="134" y="52" fontSize="10" fontWeight="800" fill="#64748b">먼저 비우면 다음 계급 상승</text>

      {visibleRows.map((row, index) => {
        const y = 86 + index * 28;
        const remainingRatio = Math.max(0, Math.min(1, Number(row.handCount || 0) / safeMax));
        const progress = row.outOrder ? 1 : Math.max(0.08, 1 - remainingRatio);
        const barWidth = progress * laneWidth;
        const active = Number(row.seatNo) === Number(activeSeatNo);
        const lead = Number(row.seatNo) === Number(leadSeatNo);
        const mine = Boolean(row.isMe);
        const fill = row.outOrder ? "#16a34a" : active ? "#f59e0b" : mine ? "#0284c7" : lead ? "#7c3aed" : "#64748b";
        return (
          <g key={row.seatNo || index} data-smoke="dalmuti-rank-pressure-node">
            <text x="34" y={y + 5} fontSize="11" fontWeight="900" fill={fill}>{row.name}</text>
            <rect x={laneStart} y={y - 8} width={laneWidth} height="13" rx="7" fill="#e9d5ff" opacity="0.8" />
            <rect x={laneStart} y={y - 8} width={barWidth} height="13" rx="7" fill={fill} opacity="0.78" />
            <circle cx={laneStart + barWidth} cy={y - 1.5} r={active ? 8 : 6} fill="#ffffff" stroke={fill} strokeWidth={active ? 4 : 3} />
            <text x={laneStart + barWidth} y={y + 3} textAnchor="middle" fontSize="8" fontWeight="900" fill={fill}>{row.seatNo}</text>
            <text x="382" y={y + 5} textAnchor="end" fontSize="10" fontWeight="900" fill="#475569">
              {row.outOrder ? `${row.outOrder}등` : `${row.handCount}장`}
            </text>
          </g>
        );
      })}
      <rect x="246" y="28" width="110" height="38" rx="15" fill="#ffffff" stroke="#7c3aed" strokeWidth="2" />
      <text x="301" y="52" textAnchor="middle" fontSize="12" fontWeight="900" fill="#5b21b6">계급 압력</text>
    </svg>
  );
};

const DalmutiRankPressurePanel = ({
  rows = [],
  phase = "PLAYING",
  activeSeatNo = 0,
  leadSeatNo = 0,
  passCount = 0,
  requiredPassCount = 0,
  currentTrickLabel = "새 기준",
  nextLeaderName = "",
}) => {
  const activeRow = rows.find((row) => Number(row.seatNo) === Number(activeSeatNo));
  const leadRow = rows.find((row) => Number(row.seatNo) === Number(leadSeatNo));
  const me = rows.find((row) => row.isMe);
  const raceLeader = rows
    .filter((row) => !row.outOrder)
    .slice()
    .sort((left, right) => Number(left.handCount || 0) - Number(right.handCount || 0) || Number(left.orderIndex || 0) - Number(right.orderIndex || 0))[0]
    || rows.find((row) => row.outOrder);
  const maxHandCount = Math.max(1, ...rows.map((row) => Number(row.handCount || 0)));
  const finishedCount = rows.filter((row) => row.outOrder).length;
  const passText = requiredPassCount > 0 ? `${passCount}/${requiredPassCount}` : "새 기준";
  const items = [
    {
      label: "손패 레이스",
      value: raceLeader ? `${raceLeader.name} ${raceLeader.outOrder ? `${raceLeader.outOrder}등` : `${raceLeader.handCount}장`}` : "대기",
      detail: me ? `내 손패 ${me.handCount}장 · 먼저 비우면 다음 계급 순서가 올라갑니다.` : "플레이어별 남은 장수를 같은 축으로 비교합니다.",
      tone: "border-violet-100 bg-violet-50 text-violet-800",
    },
    {
      label: "현재 선",
      value: leadRow ? leadRow.name : activeRow?.name || "대기",
      detail: `현재 기준: ${currentTrickLabel}`,
      tone: "border-cyan-100 bg-cyan-50 text-cyan-800",
    },
    {
      label: "패스 압력",
      value: passText,
      detail: requiredPassCount > 0 ? "필요 패스가 채워지면 기준이 정리되고 새 기준으로 넘어갑니다." : "기준이 없으면 차례 플레이어가 새 묶음을 열 수 있습니다.",
      tone: requiredPassCount > 0 && passCount >= requiredPassCount ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-amber-100 bg-amber-50 text-amber-800",
    },
    {
      label: phase === "FINISHED" ? "다음 계급" : "완료 현황",
      value: phase === "FINISHED" && nextLeaderName ? `${nextLeaderName} 다음 대달무티` : `${finishedCount}/${rows.length}명 완료`,
      detail: "라운드 결과가 다음 손의 계급 순서로 이어집니다.",
      tone: phase === "FINISHED" ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-slate-100 bg-white text-slate-700",
    },
  ];

  return (
    <section data-smoke="dalmuti-rank-pressure-panel" className="mt-4 overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-slate-50 p-3 shadow-sm sm:rounded-[1.5rem] sm:p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1fr)]">
        <div className="min-h-[176px]">
          <DalmutiRankPressureArt rows={rows} activeSeatNo={activeSeatNo} leadSeatNo={leadSeatNo} maxHandCount={maxHandCount} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-[11px] font-black text-violet-700">계급 압력</div>
              <h3 className="text-base font-black text-slate-900">누가 먼저 손패를 비우는지 확인</h3>
            </div>
            <div className="rounded-full border border-violet-100 bg-white px-3 py-1 text-[11px] font-black text-violet-700">
              {rows.length}명 레이스
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <div key={item.label} data-smoke="dalmuti-rank-pressure-item" className={`rounded-xl border px-3 py-2.5 ${item.tone}`}>
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

const DalmutiEmptyHandArt = ({
  phaseLabel = "",
  outOrder = 0,
  activeName = "",
  nextLeaderName = "",
  passText = "",
}) => {
  const completed = Number(outOrder || 0) > 0;
  const activeLabel = String(activeName || "대기").slice(0, 5);
  const leaderLabel = String(nextLeaderName || "대기").slice(0, 5);
  const statusLabel = completed ? `${outOrder}등` : "대기";
  const nodes = [
    { label: "손패", value: "0장", x: 72, y: 90, fill: "#0f766e", bg: "#ccfbf1" },
    { label: "순위", value: statusLabel, x: 168, y: 140, fill: completed ? "#16a34a" : "#64748b", bg: completed ? "#dcfce7" : "#f8fafc" },
    { label: "차례", value: activeLabel, x: 270, y: 90, fill: "#7c3aed", bg: "#ede9fe" },
    { label: "다음", value: leaderLabel, x: 342, y: 144, fill: "#0369a1", bg: "#e0f2fe" },
  ];

  return (
    <svg
      viewBox="0 0 420 230"
      className="h-full min-h-[170px] w-full"
      role="img"
      aria-label={`달무티 빈 손패 안내, ${phaseLabel}, ${completed ? `${outOrder}등 완료` : "순위 대기"}`}
      data-smoke="dalmuti-empty-hand-art"
    >
      <rect x="14" y="14" width="392" height="208" rx="26" fill="#f0fdfa" stroke="#99f6e4" strokeWidth="3" />
      <path d="M68 156c50-62 112-76 188-44 38 16 70 18 100 6" fill="none" stroke="#bae6fd" strokeWidth="16" strokeLinecap="round" />
      <path d="M70 156c50-51 111-61 184-32 38 15 70 16 99 3" fill="none" stroke="#0f766e" strokeWidth="5" strokeLinecap="round" opacity="0.68" />
      <rect x="34" y="30" width="184" height="40" rx="16" fill="#ffffff" stroke="#5eead4" strokeWidth="2" />
      <text x="52" y="55" fontSize="13" fontWeight="900" fill="#0f766e">손패 완료</text>
      <text x="134" y="55" fontSize="10" fontWeight="800" fill="#64748b">{phaseLabel}</text>
      <rect x="238" y="30" width="116" height="40" rx="16" fill="#ffffff" stroke="#bfdbfe" strokeWidth="2" />
      <text x="296" y="55" textAnchor="middle" fontSize="11" fontWeight="900" fill="#0369a1">패스 {passText || "대기"}</text>
      {nodes.map((node) => (
        <g key={node.label} data-smoke="dalmuti-empty-hand-node">
          <circle cx={node.x + 5} cy={node.y + 7} r="30" fill={node.fill} opacity="0.12" />
          <rect x={node.x - 34} y={node.y - 24} width="78" height="56" rx="18" fill="#ffffff" stroke={node.fill} strokeWidth="3" />
          <rect x={node.x - 24} y={node.y - 16} width="58" height="18" rx="9" fill={node.bg} />
          <text x={node.x + 5} y={node.y - 2} textAnchor="middle" fontSize="10" fontWeight="900" fill={node.fill}>{node.label}</text>
          <text x={node.x + 5} y={node.y + 20} textAnchor="middle" fontSize="13" fontWeight="900" fill="#0f172a">{node.value}</text>
        </g>
      ))}
    </svg>
  );
};

const DalmutiEmptyHandPanel = ({
  phase = "PLAYING",
  phaseLabel = "",
  outOrder = 0,
  activeName = "",
  nextLeaderName = "",
  currentTrickLabel = "새 기준",
  passCount = 0,
  requiredPassCount = 0,
  turnNotice = "",
  trickClearHint = "",
  nextOrderText = "",
}) => {
  const completed = Number(outOrder || 0) > 0;
  const passText = requiredPassCount > 0 ? `${passCount}/${requiredPassCount}` : "새 기준";
  const positionValue = completed
    ? `${outOrder}등으로 손패 완료`
    : phase === "FINISHED" ? "결과 확정 대기" : "순위 확정 대기";
  const flowValue = phase === "FINISHED" ? "결과 확인" : activeName ? `${activeName} 차례` : phaseLabel;
  const nextValue = phase === "FINISHED" && nextLeaderName ? `${nextLeaderName} 다음 대달무티` : "관전 대기";
  const items = [
    {
      label: "손패 상태",
      value: "모두 제출 완료",
      detail: "남은 카드가 없어 추가 제출은 없습니다.",
      tone: "border-emerald-100 bg-emerald-50 text-emerald-800",
    },
    {
      label: "이번 손 위치",
      value: positionValue,
      detail: completed ? "손패를 비운 순서가 다음 계급 순서에 반영됩니다." : "서버가 아웃 순서를 확정하면 결과 영역에 반영됩니다.",
      tone: completed ? "border-teal-100 bg-teal-50 text-teal-800" : "border-slate-100 bg-white text-slate-700",
    },
    {
      label: "현재 흐름",
      value: flowValue,
      detail: phase === "FINISHED" ? nextOrderText || "다음 손 계급 순서를 확인하세요." : `${currentTrickLabel} · 패스 ${passText}`,
      tone: "border-violet-100 bg-violet-50 text-violet-800",
    },
    {
      label: "다음 행동",
      value: nextValue,
      detail: phase === "FINISHED" ? "결과와 다음 손 계급을 확인하고 새 라운드를 기다리세요." : trickClearHint || turnNotice || "현재 기준과 패스 흐름을 지켜보면 됩니다.",
      tone: "border-cyan-100 bg-cyan-50 text-cyan-800",
    },
  ];

  return (
    <section
      data-smoke="dalmuti-empty-hand-panel"
      data-phase={phase}
      data-out-order={outOrder || ""}
      data-pass-progress={passText}
      className="col-span-full overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-violet-50 p-3 sm:p-4"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(210px,0.74fr)_minmax(0,1fr)]">
        <div className="min-h-[170px]">
          <DalmutiEmptyHandArt
            phaseLabel={phaseLabel}
            outOrder={outOrder}
            activeName={activeName}
            nextLeaderName={nextLeaderName}
            passText={passText}
          />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-[11px] font-black text-emerald-700">손패 0장</div>
              <h3 className="text-base font-black text-slate-900">손패 완료 상태</h3>
            </div>
            <div className="rounded-full border border-emerald-100 bg-white px-3 py-1 text-[11px] font-black text-emerald-700">
              {phaseLabel}
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <div key={item.label} data-smoke="dalmuti-empty-hand-item" className={`rounded-xl border px-3 py-2.5 ${item.tone}`}>
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

const DalmutiPlayPileEmptyArt = ({ phase, activeName, leadName, currentTrickLabel, passText }) => {
  const nodes = [
    { key: "lead", x: 54, y: 76, label: leadName ? "현재 선" : "새 선", value: String(leadName || activeName || "대기").slice(0, 5), fill: "#7c3aed" },
    { key: "rule", x: 126, y: 44, label: "기준", value: String(currentTrickLabel || "새 기준").slice(0, 6), fill: "#0ea5e9" },
    { key: "pass", x: 198, y: 84, label: "패스", value: String(passText || "대기").slice(0, 5), fill: "#f59e0b" },
    { key: "pile", x: 270, y: 52, label: "더미", value: "0장", fill: "#10b981" },
  ];

  return (
    <svg
      viewBox="0 0 320 132"
      className="h-full min-h-[132px] w-full"
      role="img"
      aria-label="달무티 현재 제출 더미 대기 안내"
      data-smoke="dalmuti-play-pile-empty-art"
      focusable="false"
    >
      <rect x="10" y="12" width="300" height="108" rx="22" fill="#0f172a" />
      <path d="M42 93C78 50 112 46 154 70s76 28 124-18" fill="none" stroke="#334155" strokeWidth="14" strokeLinecap="round" />
      <path d="M42 93C78 50 112 46 154 70s76 28 124-18" fill="none" stroke="#a78bfa" strokeWidth="4" strokeLinecap="round" />
      {nodes.map((node, index) => (
        <g key={node.key} data-smoke="dalmuti-play-pile-empty-node" data-pile-node={node.key}>
          <circle cx={node.x} cy={node.y} r="20" fill={node.fill} stroke="#ffffff" strokeWidth="5" />
          <text x={node.x} y={node.y - 2} textAnchor="middle" fontSize="8" fontWeight="900" fill="#ffffff">{node.label}</text>
          <text x={node.x} y={node.y + 11} textAnchor="middle" fontSize="8" fontWeight="900" fill="#f8fafc">{node.value}</text>
          <text x={node.x} y={node.y + 34} textAnchor="middle" fontSize="8" fontWeight="900" fill="#cbd5e1">{index + 1}</text>
        </g>
      ))}
      <rect x="26" y="24" width="92" height="22" rx="11" fill="rgba(255,255,255,.1)" stroke="#475569" strokeWidth="2" />
      <text x="72" y="39" textAnchor="middle" fontSize="9" fontWeight="900" fill="#f5f3ff">제출 대기</text>
      <text x="292" y="108" textAnchor="end" fontSize="9" fontWeight="900" fill="#cbd5e1">{dalmutiPhaseLabels[phase] || phase || "대기"}</text>
    </svg>
  );
};

const DalmutiPlayPileEmptyState = ({
  phase = "PLAYING",
  activeName = "",
  leadName = "",
  currentTrickLabel = "새 기준",
  passCount = 0,
  requiredPassCount = 0,
  turnNotice = "",
}) => {
  const passText = requiredPassCount > 0 ? `${passCount}/${requiredPassCount}` : "새 기준";
  const items = [
    {
      key: "pile",
      label: "현재 더미",
      value: "아직 제출 없음",
      detail: "이번 기준에서 실제로 내려온 카드가 생기면 이 영역이 제출 기록으로 바뀝니다.",
      icon: "recent",
    },
    {
      key: "rule",
      label: "제출 기준",
      value: currentTrickLabel || "새 기준",
      detail: currentTrickLabel === "새 기준" ? "차례 플레이어가 같은 계급 묶음으로 새 기준을 엽니다." : "현재 기준보다 높은 계급을 같은 장수로 내야 합니다.",
      icon: "decision",
    },
    {
      key: "actor",
      label: "다음 차례",
      value: activeName || leadName || "대기",
      detail: turnNotice || "현재 차례와 패스 흐름을 확인하세요.",
      icon: "turn",
    },
    {
      key: "pass",
      label: "패스 흐름",
      value: passText,
      detail: requiredPassCount > 0 ? "필요 패스가 채워지면 기준이 정리되고 새 선으로 넘어갑니다." : "아직 기준이 없어서 패스 압력은 열리지 않았습니다.",
      icon: "state",
    },
  ];

  return (
    <div
      className="overflow-hidden rounded-2xl border border-violet-100 bg-violet-50/70 p-2"
      data-smoke="dalmuti-play-pile-empty-state"
      data-phase={phase}
      data-pass-progress={passText}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="overflow-hidden rounded-xl bg-slate-950">
        <DalmutiPlayPileEmptyArt
          phase={phase}
          activeName={activeName}
          leadName={leadName}
          currentTrickLabel={currentTrickLabel}
          passText={passText}
        />
      </div>
      <div className="mt-3 space-y-2 px-1">
        <div className="inline-flex rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-black text-violet-700">제출 더미 브리핑</div>
        <div className="text-sm font-black text-slate-950">아직 제출된 카드가 없습니다</div>
        <div className="text-xs font-bold leading-relaxed text-violet-900/75">
          첫 제출이 열리기 전에는 누가 기준을 만들고, 패스 압력이 언제 생기는지를 먼저 확인해야 합니다.
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <div key={item.key} className="rounded-xl border border-white/80 bg-white/85 px-3 py-2" data-smoke="dalmuti-play-pile-empty-item" data-pile-key={item.key}>
            <div className="flex items-center gap-1.5 text-[10px] font-black text-violet-700">
              <GameUxGlyph type={item.icon} className="h-3.5 w-3.5" />
              {item.label}
            </div>
            <div className="mt-1 line-clamp-1 text-xs font-black text-slate-950">{item.value}</div>
            <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-relaxed text-slate-600">{item.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const dalmutiActionRouteTone = {
  ready: { fill: "#ecfdf5", stroke: "#059669", text: "#047857", soft: "#bbf7d0" },
  active: { fill: "#eef2ff", stroke: "#4f46e5", text: "#3730a3", soft: "#c7d2fe" },
  caution: { fill: "#fffbeb", stroke: "#f59e0b", text: "#b45309", soft: "#fde68a" },
  blocked: { fill: "#fff1f2", stroke: "#e11d48", text: "#be123c", soft: "#fecdd3" },
  idle: { fill: "#f8fafc", stroke: "#94a3b8", text: "#475569", soft: "#e2e8f0" },
};

const buildDalmutiActionRouteItems = ({
  phase = "PLAYING",
  phaseLabel = "",
  canPlay = false,
  canReturnTax = false,
  canDecideRevolution = false,
  selectedCards = [],
  selectedPlayStatus = { legal: false, reason: "" },
  currentTrick = null,
  currentTrickLabel = "새 기준",
  currentTrickCount = 0,
  pendingTaxCount = 0,
  passCount = 0,
  requiredPassCount = 0,
  taxProgressText = "",
  activeName = "",
  leadName = "",
  eligibleCount = 0,
  declinedCount = 0,
  handCount = 0,
}) => {
  const selectedCount = selectedCards.length;
  const isFinished = phase === "FINISHED";
  const canSubmitPlay = Boolean(phase === "PLAYING" && canPlay && selectedPlayStatus?.legal);
  const canSubmitTax = Boolean(phase === "TAX_RETURN" && canReturnTax && selectedCount === Number(pendingTaxCount || 0));
  const passAvailable = Boolean(phase === "PLAYING" && canPlay && currentTrick);
  const phaseDetail = phase === "TAX_RETURN"
    ? "세금 반환 단계에서는 지정된 장수만큼 카드를 골라 반환합니다."
    : phase === "REVOLUTION_DECISION"
      ? "혁명 단계에서는 선언과 포기 중 하나만 선택합니다."
      : phase === "PLAYING"
        ? "제출 기준을 이기거나, 이미 기준이 있으면 패스할 수 있습니다."
        : isFinished
          ? "라운드 결과와 다음 계급 순서를 확인합니다."
          : "현재 단계의 서버 판정을 기다립니다.";

  return [
    {
      key: "phase",
      label: "단계 확인",
      value: phaseLabel || phase || "대기",
      artValue: phase === "TAX_RETURN" ? "세금" : phase === "REVOLUTION_DECISION" ? "혁명" : isFinished ? "결과" : "플레이",
      detail: phaseDetail,
      toneKey: canPlay || canReturnTax || canDecideRevolution ? "active" : isFinished ? "ready" : "idle",
      tone: canPlay || canReturnTax || canDecideRevolution ? "border-indigo-100 bg-indigo-50 text-indigo-800" : isFinished ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-slate-100 bg-white text-slate-700",
    },
    {
      key: "select",
      label: "카드 선택",
      value: phase === "TAX_RETURN" ? `${selectedCount}/${pendingTaxCount || 0}장` : `${selectedCount}장 선택`,
      artValue: phase === "TAX_RETURN" ? `${selectedCount}/${pendingTaxCount || 0}` : `${selectedCount}`,
      detail: phase === "TAX_RETURN"
        ? canReturnTax
          ? `세금 반환에 필요한 ${pendingTaxCount}장을 맞추면 반환 버튼이 열립니다.`
          : `${taxProgressText || "다른 플레이어의 반환"}을 기다립니다.`
        : phase === "REVOLUTION_DECISION"
          ? "혁명 결정은 카드 선택이 아니라 선언/포기 버튼으로 처리됩니다."
          : selectedCount
            ? selectedPlayStatus?.reason || "선택 묶음의 제출 가능 여부를 확인합니다."
            : `손패 ${Number(handCount || 0).toLocaleString("ko-KR")}장 중 같은 계급 묶음을 고릅니다.`,
      toneKey: phase === "TAX_RETURN" && canSubmitTax ? "ready" : selectedCount ? (selectedPlayStatus?.legal || canSubmitTax ? "ready" : "blocked") : canReturnTax || canPlay ? "caution" : "idle",
      tone: phase === "TAX_RETURN" && canSubmitTax ? "border-emerald-100 bg-emerald-50 text-emerald-800" : selectedCount ? (selectedPlayStatus?.legal || canSubmitTax ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-rose-100 bg-rose-50 text-rose-800") : canReturnTax || canPlay ? "border-amber-100 bg-amber-50 text-amber-800" : "border-slate-100 bg-white text-slate-700",
    },
    {
      key: "submit",
      label: "제출/반환",
      value: canSubmitTax ? "반환 가능" : canSubmitPlay ? "제출 가능" : isFinished ? "결과 확인" : "잠김",
      artValue: canSubmitTax ? "반환" : canSubmitPlay ? "제출" : isFinished ? "결과" : "잠김",
      detail: canSubmitTax
        ? "기존 RETURN_TAX payload로 선택한 카드 id만 보냅니다."
        : canSubmitPlay
          ? "기존 PLAY payload로 선택한 card_ids만 보냅니다."
          : isFinished
            ? "이번 라운드 제출 흐름은 종료되었습니다."
            : selectedPlayStatus?.reason || "제출 조건이 맞아야 버튼이 열립니다.",
      toneKey: canSubmitTax || canSubmitPlay || isFinished ? "ready" : "idle",
      tone: canSubmitTax || canSubmitPlay || isFinished ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-slate-100 bg-slate-50 text-slate-700",
    },
    {
      key: "fallback",
      label: "패스/혁명",
      value: canDecideRevolution ? "선언/포기" : passAvailable ? "패스 가능" : currentTrick ? `${passCount}/${requiredPassCount}` : "대기",
      artValue: canDecideRevolution ? "혁명" : passAvailable ? "패스" : currentTrick ? `${passCount}/${requiredPassCount}` : "-",
      detail: canDecideRevolution
        ? `혁명 대상 ${eligibleCount}명 중 ${declinedCount}명이 포기했습니다. 선언 또는 포기를 고릅니다.`
        : passAvailable
          ? `${currentTrickLabel} 기준을 넘기 어렵다면 기존 PASS payload로 넘길 수 있습니다.`
          : currentTrick
            ? `${leadName || activeName || "선 플레이어"}의 기준이 유지되는 동안 패스 흐름을 관찰합니다.`
            : "새 기준이 열리면 패스 대신 카드 제출로 흐름을 시작합니다.",
      toneKey: canDecideRevolution || passAvailable ? "caution" : currentTrick ? "active" : "idle",
      tone: canDecideRevolution || passAvailable ? "border-amber-100 bg-amber-50 text-amber-800" : currentTrick ? "border-indigo-100 bg-indigo-50 text-indigo-800" : "border-slate-100 bg-white text-slate-700",
    },
  ];
};

const DalmutiActionRouteArt = ({
  phase = "PLAYING",
  items = [],
  canPlay = false,
  canReturnTax = false,
  canDecideRevolution = false,
}) => {
  const routeItems = items.length ? items : [
    { key: "phase", label: "단계", artValue: "-", toneKey: "idle" },
    { key: "select", label: "선택", artValue: "-", toneKey: "idle" },
    { key: "submit", label: "제출", artValue: "-", toneKey: "idle" },
    { key: "fallback", label: "패스", artValue: "-", toneKey: "idle" },
  ];
  const activeIndex = phase === "TAX_RETURN"
    ? 2
    : phase === "REVOLUTION_DECISION"
      ? 3
      : routeItems.findIndex((item) => item.toneKey === "caution" || item.toneKey === "blocked");
  const safeActiveIndex = activeIndex >= 0 ? activeIndex : canPlay || canReturnTax || canDecideRevolution ? 1 : 0;

  return (
    <svg
      data-smoke="dalmuti-action-route-art"
      viewBox="0 0 400 150"
      className="h-full min-h-[124px] w-full"
      role="img"
      aria-label="달무티 액션 루트"
      focusable="false"
    >
      <rect x="10" y="10" width="380" height="130" rx="24" fill="#f8fafc" stroke="#ddd6fe" strokeWidth="3" />
      <path d="M58 75h284" stroke="#ddd6fe" strokeWidth="14" strokeLinecap="round" />
      <path d="M58 75h284" stroke={canPlay || canReturnTax || canDecideRevolution ? "#7c3aed" : "#94a3b8"} strokeWidth="4" strokeLinecap="round" opacity="0.72" />
      {routeItems.map((item, index) => {
        const x = 58 + index * 94.6;
        const tone = dalmutiActionRouteTone[item.toneKey] || dalmutiActionRouteTone.idle;
        const active = index === safeActiveIndex;
        return (
          <g key={item.key} data-smoke="dalmuti-action-route-node" data-route-key={item.key}>
            <circle cx={x} cy="75" r={active ? 34 : 31} fill="#ffffff" stroke={tone.stroke} strokeWidth={active ? "5" : "4"} />
            <circle cx={x} cy="75" r="22" fill={tone.fill} stroke="#ffffff" strokeWidth="3" />
            <text x={x} y="70" textAnchor="middle" fontSize="9" fontWeight="900" fill={tone.text}>{item.label}</text>
            <text x={x} y="89" textAnchor="middle" fontSize="13" fontWeight="900" fill={tone.text}>{item.artValue}</text>
          </g>
        );
      })}
      <rect x="64" y="116" width="272" height="18" rx="9" fill="#ffffff" stroke="#c4b5fd" />
      <text x="200" y="129" textAnchor="middle" fontSize="10" fontWeight="900" fill="#5b21b6">
        단계 확인 &gt; 카드 선택 &gt; 제출/반환 &gt; 패스/혁명
      </text>
      <text x="30" y="28" fontSize="10" fontWeight="900" fill="#5b21b6">{phase || "DALMUTI"}</text>
    </svg>
  );
};

const DalmutiActionRoutePanel = ({
  phase = "PLAYING",
  phaseLabel = "",
  canPlay = false,
  canReturnTax = false,
  canDecideRevolution = false,
  selectedCards = [],
  selectedPlayStatus = { legal: false, reason: "" },
  currentTrick = null,
  currentTrickLabel = "새 기준",
  currentTrickCount = 0,
  pendingTaxCount = 0,
  passCount = 0,
  requiredPassCount = 0,
  taxProgressText = "",
  activeName = "",
  leadName = "",
  eligibleCount = 0,
  declinedCount = 0,
  handCount = 0,
}) => {
  const items = buildDalmutiActionRouteItems({
    phase,
    phaseLabel,
    canPlay,
    canReturnTax,
    canDecideRevolution,
    selectedCards,
    selectedPlayStatus,
    currentTrick,
    currentTrickLabel,
    currentTrickCount,
    pendingTaxCount,
    passCount,
    requiredPassCount,
    taxProgressText,
    activeName,
    leadName,
    eligibleCount,
    declinedCount,
    handCount,
  });

  return (
    <section
      data-smoke="dalmuti-action-route-panel"
      data-phase={phase || ""}
      data-can-play={canPlay ? "true" : "false"}
      data-can-tax={canReturnTax ? "true" : "false"}
      data-can-revolution={canDecideRevolution ? "true" : "false"}
      data-selected-count={selectedCards.length}
      data-pass-progress={currentTrick ? `${passCount}/${requiredPassCount}` : ""}
      className="overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-white via-violet-50 to-cyan-50 p-3 shadow-sm sm:rounded-[1.5rem] sm:p-4"
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(220px,0.82fr)_minmax(0,1fr)] lg:items-center">
        <div className="min-h-[132px]">
          <DalmutiActionRouteArt
            phase={phase}
            items={items}
            canPlay={canPlay}
            canReturnTax={canReturnTax}
            canDecideRevolution={canDecideRevolution}
          />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-[11px] font-black text-violet-700">달무티 액션 루트</div>
              <h3 className="text-base font-black text-slate-900">세금, 혁명, 제출, 패스 판단</h3>
            </div>
            <div className="rounded-full border border-violet-100 bg-white px-3 py-1 text-[11px] font-black text-violet-700">
              {canPlay || canReturnTax || canDecideRevolution ? "내가 결정" : phaseLabel || phase || "대기"}
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <div key={item.key} data-smoke="dalmuti-action-route-item" data-route-key={item.key} className={`min-h-[102px] rounded-xl border px-3 py-2.5 ${item.tone}`}>
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

const DalmutiBoard = ({ gameState, players: roomPlayers, mySeatNo, onAction }) => {
  const [selectedCardIds, setSelectedCardIds] = useState([]);
  const phase = gameState?.phase || "PLAYING";
  const roundNo = Number(get(gameState, "round_no", "roundNo", 1));
  const activeSeatNo = Number(get(gameState, "active_seat_no", "activeSeatNo", 0));
  const leadSeatNo = Number(get(gameState, "lead_seat_no", "leadSeatNo", 0));
  const currentTrick = get(gameState, "current_trick", "currentTrick", null);
  const dalmutiPlayers = get(gameState, "players", "players", []);
  const taxExchanges = get(gameState, "tax_exchanges", "taxExchanges", []);
  const playPile = get(gameState, "play_pile", "playPile", []);
  const events = get(gameState, "events", "events", []);
  const eligibleSeatNos = get(gameState, "revolution_eligible_seat_nos", "revolutionEligibleSeatNos", []);
  const declinedSeatNos = get(gameState, "revolution_declined_seat_nos", "revolutionDeclinedSeatNos", []);
  const consecutivePassSeatNos = get(gameState, "consecutive_pass_seat_nos", "consecutivePassSeatNos", []);
  const outSeatNos = get(gameState, "out_seat_nos", "outSeatNos", []);
  const turnOrderSeatNos = get(gameState, "turn_order_seat_nos", "turnOrderSeatNos", []);
  const nextTurnOrderSeatNos = get(gameState, "next_turn_order_seat_nos", "nextTurnOrderSeatNos", []);
  const strippedDeckRule = Boolean(get(gameState, "stripped_deck_rule", "strippedDeckRule", false));
  const firstDealRevolutionRule = Boolean(get(gameState, "first_deal_revolution_rule", "firstDealRevolutionRule", false));
  const removedRanks = get(gameState, "removed_ranks", "removedRanks", []);
  const removedRankLabel = Array.isArray(removedRanks) ? removedRanks.map(dalmutiRankLabel).join(", ") : "";
  const myPlayer = dalmutiPlayers.find((player) => Number(get(player, "seat_no", "seatNo", 0)) === mySeatNo);
  const hand = get(myPlayer, "hand", "hand", []);
  const pendingTax = taxExchanges.find((exchange) => Number(get(exchange, "dalmuti_seat_no", "dalmutiSeatNo", 0)) === mySeatNo && !exchange.completed);
  const eligibleSeatNoSet = useMemo(
    () => new Set((Array.isArray(eligibleSeatNos) ? eligibleSeatNos : []).map((seatNo) => Number(seatNo)).filter(Boolean)),
    [eligibleSeatNos],
  );
  const declinedSeatNoSet = useMemo(
    () => new Set((Array.isArray(declinedSeatNos) ? declinedSeatNos : []).map((seatNo) => Number(seatNo)).filter(Boolean)),
    [declinedSeatNos],
  );
  const canPlay = phase === "PLAYING" && activeSeatNo === mySeatNo;
  const canReturnTax = phase === "TAX_RETURN" && Boolean(pendingTax);
  const canDecideRevolution = phase === "REVOLUTION_DECISION" && eligibleSeatNoSet.has(mySeatNo) && !declinedSeatNoSet.has(mySeatNo);
  const selectedCards = hand.filter((card) => selectedCardIds.includes(card.id));
  const selectedPlayStatus = useMemo(() => {
    if (!selectedCards.length) {
      return { legal: false, reason: "제출할 카드를 선택하세요." };
    }
    const normalCards = selectedCards.filter((card) => !card.jester);
    const rank = normalCards.length ? Number(normalCards[0].rank) : 13;
    if (normalCards.some((card) => Number(card.rank) !== rank)) {
      return { legal: false, reason: "광대가 아닌 카드는 같은 계급이어야 합니다." };
    }
    const count = selectedCards.length;
    if (currentTrick) {
      const trickCount = Number(get(currentTrick, "count", "count", 0));
      const trickRank = Number(get(currentTrick, "rank", "rank", 0));
      if (count !== trickCount) {
        return { legal: false, reason: `현재 기준과 같은 ${trickCount}장을 내야 합니다.` };
      }
      if (rank >= trickRank) {
        return { legal: false, reason: `${dalmutiRankLabel(trickRank)}보다 높은 계급이어야 합니다.` };
      }
    }
    return { legal: true, reason: `${dalmutiRankLabel(rank)} ${count}장 제출 가능` };
  }, [selectedCards, currentTrick]);
  const pendingTaxCount = Number(get(pendingTax, "count", "count", 0));
  const handRankGroups = useMemo(() => {
    const groups = new Map();
    hand.forEach((card) => {
      const jester = Boolean(card.jester);
      const rank = Number(card.rank || 0);
      const key = jester ? "JESTER" : String(rank);
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          rank,
          jester,
          label: jester ? "광대" : dalmutiRankLabel(rank),
          cards: [],
        });
      }
      groups.get(key).cards.push(card);
    });
    return Array.from(groups.values()).sort((a, b) => {
      if (a.jester !== b.jester) return a.jester ? 1 : -1;
      return a.rank - b.rank;
    });
  }, [hand]);
  const currentTrickCount = Number(get(currentTrick, "count", "count", 0));
  const currentTrickRank = Number(get(currentTrick, "rank", "rank", 0));
  const quickSelectLimit = phase === "PLAYING" && currentTrickCount > 0
    ? currentTrickCount
    : phase === "TAX_RETURN" && pendingTaxCount > 0
      ? pendingTaxCount
      : 0;
  const quickSelectGroupStatusByKey = useMemo(() => {
    const jokerCount = handRankGroups.find((group) => group.jester)?.cards.length || 0;
    const statuses = new Map();
    handRankGroups.forEach((group) => {
      let disabled = phase === "REVOLUTION_DECISION" || phase === "FINISHED";
      let tone = disabled ? "blocked" : "neutral";
      let badge = `${group.cards.length}장`;
      let reason = quickSelectLimit > 0 ? `최대 ${quickSelectLimit}장` : `${group.cards.length}장 보유`;

      if (phase === "PLAYING" && currentTrick) {
        if (group.jester) {
          disabled = true;
          tone = "blocked";
          badge = "불가";
          reason = "광대 단독은 가장 낮은 기준";
        } else if (group.rank >= currentTrickRank) {
          disabled = true;
          tone = "blocked";
          badge = "낮음";
          reason = `${dalmutiRankLabel(currentTrickRank)}보다 높아야 함`;
        } else {
          const missingCount = Math.max(0, currentTrickCount - group.cards.length);
          if (group.cards.length + jokerCount < currentTrickCount) {
            disabled = true;
            tone = "blocked";
            badge = "부족";
            reason = `${currentTrickCount}장 필요`;
          } else {
            tone = "ready";
            badge = "가능";
            reason = missingCount > 0 ? `광대 ${missingCount}장 보충` : `${currentTrickCount}장 제출 가능`;
          }
        }
      } else if (phase === "TAX_RETURN" && pendingTaxCount > 0) {
        tone = "tax";
        badge = "반환";
        reason = `${Math.min(group.cards.length, pendingTaxCount)}장 빠른 선택`;
      } else if (phase === "FINISHED") {
        badge = "종료";
        reason = "다음 손을 기다리세요";
      } else if (phase === "REVOLUTION_DECISION") {
        badge = "대기";
        reason = "혁명 선택 중";
      }

      statuses.set(group.key, { disabled, tone, badge, reason });
    });
    return statuses;
  }, [currentTrick, currentTrickCount, currentTrickRank, handRankGroups, pendingTaxCount, phase, quickSelectLimit]);
  const selectedQuickGroupKey = useMemo(() => {
    if (!selectedCards.length) return "";
    const normalCards = selectedCards.filter((card) => !card.jester);
    if (!normalCards.length) return selectedCards.every((card) => card.jester) ? "JESTER" : "";
    const rank = Number(normalCards[0].rank);
    return normalCards.every((card) => Number(card.rank) === rank) ? String(rank) : "";
  }, [selectedCards]);
  const selectedCardSummaryItems = useMemo(() => selectedCards.map((card) => ({
    id: card.id,
    label: Boolean(card.jester) ? "광대" : dalmutiRankLabel(Number(card.rank || 0)),
    jester: Boolean(card.jester),
  })), [selectedCards]);
  const selectionHint = phase === "TAX_RETURN" && pendingTax
    ? selectedCardIds.length === pendingTaxCount
      ? `반환할 카드 ${pendingTaxCount}장이 선택되었습니다.`
      : `농노에게 돌려줄 카드 ${pendingTaxCount}장을 선택하세요.`
    : phase === "REVOLUTION_DECISION"
      ? "광대 2장을 가진 플레이어는 혁명을 선언하거나 포기할 수 있습니다."
      : phase === "FINISHED"
        ? "이번 라운드가 끝났습니다. 결과와 다음 계급을 확인하세요."
        : selectedCards.length
          ? selectedPlayStatus.reason
          : currentTrick
            ? `${get(currentTrick, "rank_name", "rankName", "카드")} ${Number(get(currentTrick, "count", "count", 0))}장보다 높은 계급을 같은 장수로 내야 합니다.`
            : "같은 계급 카드를 여러 장 내거나 광대를 와일드로 함께 낼 수 있습니다.";
  const selectionHintTone = phase === "TAX_RETURN" && pendingTax
    ? selectedCardIds.length === pendingTaxCount
      ? "bg-emerald-50 text-emerald-700"
      : "bg-rose-50 text-rose-700"
    : selectedCardIds.length
      ? selectedPlayStatus.legal
        ? "bg-emerald-50 text-emerald-700"
        : "bg-rose-50 text-rose-700"
      : "bg-slate-50 text-slate-500";
  const orderedDalmutiPlayers = useMemo(() => {
    const order = new Map(turnOrderSeatNos.map((seatNo, index) => [Number(seatNo), index]));
    return [...dalmutiPlayers].sort((a, b) => {
      const seatA = Number(get(a, "seat_no", "seatNo", 0));
      const seatB = Number(get(b, "seat_no", "seatNo", 0));
      return (order.get(seatA) ?? seatA + 100) - (order.get(seatB) ?? seatB + 100);
    });
  }, [dalmutiPlayers, turnOrderSeatNos]);
  const orderedDalmutiScores = useMemo(() => {
    return [...dalmutiPlayers].sort((a, b) => {
      const scoreA = Number(get(a, "score", "score", 0));
      const scoreB = Number(get(b, "score", "score", 0));
      if (scoreA !== scoreB) return scoreB - scoreA;
      return Number(get(a, "seat_no", "seatNo", 0)) - Number(get(b, "seat_no", "seatNo", 0));
    });
  }, [dalmutiPlayers]);

  useEffect(() => {
    setSelectedCardIds((prev) => prev.filter((cardId) => hand.some((card) => card.id === cardId)));
  }, [hand]);

  const toggleCard = (cardId) => {
    setSelectedCardIds((prev) => (prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]));
  };

  const quickSelectRankGroup = (group) => {
    const limit = quickSelectLimit > 0 ? quickSelectLimit : group.cards.length;
    let nextCards = group.cards.slice(0, limit);
    if (phase === "PLAYING" && currentTrick && !group.jester && nextCards.length < limit) {
      const jokers = handRankGroups.find((item) => item.jester)?.cards || [];
      nextCards = [...nextCards, ...jokers.slice(0, limit - nextCards.length)];
    }
    setSelectedCardIds(nextCards.map((card) => card.id));
  };

  const play = async () => {
    if (!selectedPlayStatus.legal) {
      notifyError(selectedPlayStatus.reason);
      return;
    }
    await onAction({ action_type: "PLAY", card_ids: selectedCardIds });
    setSelectedCardIds([]);
  };

  const pass = async () => {
    await onAction({ action_type: "PASS" });
    setSelectedCardIds([]);
  };

  const returnTax = async () => {
    const required = Number(get(pendingTax, "count", "count", 0));
    if (selectedCardIds.length !== required) {
      notifyError(`${required}장을 골라 반환해야 합니다.`);
      return;
    }
    await onAction({ action_type: "RETURN_TAX", card_ids: selectedCardIds });
    setSelectedCardIds([]);
  };

  const playerName = (seatNo) => roomPlayers.find((player) => seatNoOf(player) === Number(seatNo))?.nickname || `${seatNo}번`;
  const taxExchangeRows = Array.isArray(taxExchanges) ? taxExchanges : [];
  const completedTaxCount = taxExchangeRows.filter((exchange) => Boolean(get(exchange, "completed", "completed", false))).length;
  const taxProgressText = taxExchangeRows.length
    ? `세금 반환 ${completedTaxCount}/${taxExchangeRows.length}`
    : "세금 없음";
  const holdingSeatNos = dalmutiPlayers
    .filter((player) => !get(player, "out_order", "outOrder", null) && Number(get(player, "hand_count", "handCount", 0)) > 0)
    .map((player) => Number(get(player, "seat_no", "seatNo", 0)))
    .filter(Boolean);
  const trickLeaderSeatNo = Number(get(currentTrick, "seat_no", "seatNo", 0));
  const trickLeaderHasCards = holdingSeatNos.includes(trickLeaderSeatNo);
  const requiredPassCount = currentTrick
    ? Math.max(0, holdingSeatNos.length - (trickLeaderHasCards ? 1 : 0))
    : 0;
  const passCount = Array.isArray(consecutivePassSeatNos) ? consecutivePassSeatNos.length : 0;
  const passSeatText = Array.isArray(consecutivePassSeatNos) && consecutivePassSeatNos.length
    ? consecutivePassSeatNos.map(playerName).join(", ")
    : "아직 없음";
  const trickClearHint = trickLeaderHasCards
    ? `${playerName(trickLeaderSeatNo)}님을 제외한 플레이어가 모두 패스하면 기준이 정리됩니다.`
    : "기준을 낸 플레이어가 이미 나갔으므로 남은 플레이어가 모두 패스하면 다음 선이 정해집니다.";
  const currentTrickLabel = currentTrick
    ? `${get(currentTrick, "rank_name", "rankName", "카드")} ${currentTrickCount}장`
    : "새 기준";
  const dalmutiRankPressureRows = orderedDalmutiPlayers.map((player, index) => {
    const seatNo = Number(get(player, "seat_no", "seatNo", 0));
    const handList = get(player, "hand", "hand", []);
    const handCount = Number(get(player, "hand_count", "handCount", Array.isArray(handList) ? handList.length : 0)) || 0;
    const outOrder = Number(get(player, "out_order", "outOrder", 0)) || 0;
    const role = get(player, "role", "role", "");
    const nextRole = get(player, "next_role", "nextRole", "");
    return {
      seatNo,
      name: playerName(seatNo),
      handCount,
      outOrder,
      score: Number(get(player, "score", "score", 0)) || 0,
      roleLabel: dalmutiRoleLabels[role] || role || `${index + 1}순서`,
      nextRoleLabel: dalmutiRoleLabels[nextRole] || nextRole || "",
      orderIndex: index,
      isMe: Number(seatNo) === Number(mySeatNo),
    };
  }).filter((row) => row.seatNo);
  const dalmutiNextLeaderName = nextTurnOrderSeatNos.length ? playerName(nextTurnOrderSeatNos[0]) : "";
  const dalmutiTurnNotice = phase === "TAX_RETURN"
    ? canReturnTax
      ? `내가 세금 반환할 차례입니다. 농노에게 돌려줄 카드 ${pendingTaxCount}장을 고르세요.`
      : `${taxProgressText} · 달무티 계급 플레이어의 반환을 기다리는 중입니다.`
    : phase === "REVOLUTION_DECISION"
      ? canDecideRevolution
        ? "내 혁명 결정 차례입니다. 광대 2장을 공개해 혁명하거나 이번 손의 혁명을 포기할 수 있습니다."
        : `혁명 결정 대기 · ${eligibleSeatNos.map(playerName).join(", ") || "대상 없음"}`
      : phase === "FINISHED"
        ? "이번 손이 끝났습니다. 다음 손 계급 순서와 누적 점수를 확인하세요."
        : activeSeatNo === mySeatNo
          ? currentTrick
            ? `내 차례입니다. ${get(currentTrick, "rank_name", "rankName", "카드")} ${currentTrickCount}장보다 높은 계급을 같은 ${currentTrickCount}장으로 내거나 패스하세요.`
            : "내 차례입니다. 같은 계급 카드 여러 장으로 새 기준을 열 수 있습니다."
          : currentTrick
            ? `${playerName(activeSeatNo)}님 차례입니다. 패스 ${passCount}/${requiredPassCount} · 기준이 유지되는 동안 같은 장수만 낼 수 있습니다.`
            : `${playerName(activeSeatNo)}님이 새 기준을 여는 중입니다.`;
  const dalmutiTurnNoticeTone = canPlay || canReturnTax || canDecideRevolution
    ? "border-violet-200 bg-violet-50 text-violet-900"
    : phase === "FINISHED"
      ? "border-emerald-100 bg-emerald-50 text-emerald-800"
      : phase === "TAX_RETURN"
        ? "border-rose-100 bg-rose-50 text-rose-800"
        : "border-slate-100 bg-slate-50 text-slate-700";
  const dalmutiQuickFacts = [
    { label: "단계", value: dalmutiPhaseLabels[phase] || phase },
    { label: "차례", value: phase === "FINISHED" ? "종료" : activeSeatNo === mySeatNo ? "내 차례" : playerName(activeSeatNo) },
    { label: "선택", value: `${selectedCardIds.length}장` },
    { label: "기준", value: currentTrick ? `${get(currentTrick, "rank_name", "rankName", "카드")} ${currentTrickCount}장` : "새 기준" },
  ];
  const dalmutiFlowItems = [
    {
      label: "단계",
      value: dalmutiPhaseLabels[phase] || phase,
      detail: dalmutiTurnNotice,
      icon: "stage",
      tone: phase === "FINISHED" ? "done" : canPlay || canReturnTax || canDecideRevolution ? "active" : "neutral",
    },
    {
      label: phase === "TAX_RETURN" ? "세금" : phase === "REVOLUTION_DECISION" ? "혁명" : "차례",
      value: phase === "TAX_RETURN" ? taxProgressText : phase === "REVOLUTION_DECISION" ? `${eligibleSeatNos.length}명 대상` : activeSeatNo ? playerName(activeSeatNo) : "대기",
      detail: phase === "TAX_RETURN" ? `반환 대기 ${taxExchangeRows.length - completedTaxCount}건` : phase === "REVOLUTION_DECISION" ? `${declinedSeatNoSet.size}명 보류/거절` : `패스 ${passCount}/${requiredPassCount}`,
      icon: "turn",
      tone: canReturnTax || canDecideRevolution || canPlay ? "active" : "neutral",
    },
    {
      label: "제출 기준",
      value: currentTrick ? `${get(currentTrick, "rank_name", "rankName", "카드")} ${currentTrickCount}장` : "새 기준",
      detail: currentTrick ? trickClearHint : "같은 계급 여러 장으로 새 기준을 열 수 있습니다.",
      icon: "decision",
      tone: currentTrick ? "waiting" : "neutral",
    },
    {
      label: phase === "FINISHED" ? "결과" : "선택 카드",
      value: phase === "FINISHED" && nextTurnOrderSeatNos.length ? `${playerName(nextTurnOrderSeatNos[0])} 다음 대달무티` : `${selectedCardIds.length}장 선택`,
      detail: phase === "FINISHED" ? "다음 라운드 계급 순서를 확인하세요." : selectedPlayStatus.reason,
      icon: phase === "FINISHED" ? "win" : "input",
      tone: phase === "FINISHED" ? "done" : selectedCards.length ? (selectedPlayStatus.legal ? "active" : "danger") : "neutral",
    },
  ];
  const playControls = phase === "PLAYING" ? (
    <div className="grid grid-cols-2 gap-2">
      <button
        className="min-h-11 rounded-xl bg-slate-900 px-3 py-3 text-sm font-black text-white disabled:opacity-40"
        disabled={!canPlay || !selectedPlayStatus.legal}
        onClick={() => play().catch(() => notifyError("낼 수 없는 조합입니다."))}
      >
        제출
      </button>
      <button
        className="min-h-11 rounded-xl bg-slate-100 px-3 py-3 text-sm font-black text-slate-700 disabled:opacity-40"
        disabled={!canPlay || !currentTrick}
        onClick={() => pass().catch(() => notifyError("패스할 수 없습니다."))}
      >
        패스
      </button>
    </div>
  ) : null;
  const taxControls = phase === "TAX_RETURN" ? (
    <button
      className="min-h-11 w-full rounded-xl bg-rose-600 px-3 py-3 text-sm font-black text-white disabled:opacity-40"
      disabled={!canReturnTax || selectedCardIds.length !== pendingTaxCount}
      onClick={() => returnTax().catch(() => notifyError("세금 반환 실패"))}
    >
      {canReturnTax ? `선택한 ${selectedCardIds.length}/${pendingTaxCount}장 반환` : "세금 반환 대기"}
    </button>
  ) : null;
  const dalmutiPhaseLabel = dalmutiPhaseLabels[phase] || phase;
  const myDalmutiRankRow = dalmutiRankPressureRows.find((row) => row.isMe);
  const myOutOrder = Number(get(myPlayer || {}, "out_order", "outOrder", 0)) || Number(myDalmutiRankRow?.outOrder || 0);
  const dalmutiEmptyHandActiveName = phase === "FINISHED" ? "종료" : activeSeatNo ? playerName(activeSeatNo) : "대기";
  const dalmutiEmptyHandNextOrder = nextTurnOrderSeatNos.length
    ? nextTurnOrderSeatNos.map((seatNo, index) => `${index + 1}. ${playerName(seatNo)}`).join(" · ")
    : turnOrderSeatNos.length
      ? turnOrderSeatNos.map((seatNo, index) => `${index + 1}. ${playerName(seatNo)}`).join(" · ")
      : "다음 순서 대기";

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-black text-slate-500">달무티</div>
              <div className="text-xl font-black text-slate-900">{dalmutiPhaseLabels[phase] || phase}</div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-black">
              {strippedDeckRule && (
                <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">
                  줄인 덱 · 제외 {removedRankLabel || "낮은 계급"}
                </span>
              )}
              {firstDealRevolutionRule && (
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700">
                  첫 판 자동 혁명
                </span>
              )}
              <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">{roundNo}번째 손</span>
              <span className="rounded-full bg-violet-50 px-3 py-1 text-violet-700">현재 {playerName(activeSeatNo)}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">선 {playerName(leadSeatNo)}</span>
            </div>
          </div>
          <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-bold leading-relaxed ${dalmutiTurnNoticeTone}`} role="status" aria-live="polite" aria-atomic="true">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-2xl bg-violet-700 p-2 text-white shadow-sm">
                <Crown className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black opacity-70">지금 할 일</div>
                <div className="mt-1">{dalmutiTurnNotice}</div>
                <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {dalmutiQuickFacts.map((item) => (
                    <div key={item.label} className="rounded-xl bg-white/75 px-2.5 py-2">
                      <div className="text-[10px] font-bold opacity-60">{item.label}</div>
                      <div className="truncate text-[11px] font-black">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {currentTrick ? (
            <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3">
              <div className="text-xs font-black text-violet-500">현재 기준</div>
              <div className="mt-1 text-sm font-black text-violet-900">
                {playerName(get(currentTrick, "seat_no", "seatNo", 0))} · {get(currentTrick, "rank_name", "rankName", "카드")} {currentTrick.count}장
              </div>
              <div className="mt-2 grid gap-2 text-[11px] font-bold leading-relaxed text-violet-700 sm:grid-cols-2">
                <div className="rounded-xl bg-white/80 px-3 py-2">
                  패스 {passCount}/{requiredPassCount} · {passSeatText}
                </div>
                <div className="rounded-xl bg-white/80 px-3 py-2">
                  {trickClearHint}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500">
              새 판을 여는 플레이어가 원하는 장수와 계급을 낼 수 있습니다.
            </div>
          )}

          {turnOrderSeatNos.length > 0 && (
            <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <div className="text-xs font-black text-slate-500">현재 계급 순서</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {turnOrderSeatNos.map((seatNo, index) => (
                  <span key={`${seatNo}-${index}`} className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700">
                    {index + 1}. {playerName(seatNo)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {phase === "FINISHED" && nextTurnOrderSeatNos.length > 0 && (
            <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
              <div className="text-xs font-black text-emerald-700">다음 손 계급 순서</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {nextTurnOrderSeatNos.map((seatNo, index) => (
                  <span key={`${seatNo}-${index}`} className="rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-800">
                    {index + 1}. {playerName(seatNo)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {phase === "FINISHED" && (
            <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3">
              <div className="text-xs font-black text-violet-700">이번 손 결과</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {outSeatNos.map((seatNo, index) => {
                  const player = dalmutiPlayers.find((item) => Number(get(item, "seat_no", "seatNo", 0)) === Number(seatNo));
                  return (
                    <div key={`${seatNo}-${index}`} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-700">
                      <span>{index + 1}등 · {playerName(seatNo)}</span>
                      <span className="text-violet-700">+{get(player, "round_score", "roundScore", 0)}점</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {phase === "REVOLUTION_DECISION" && (
            <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-3">
              <div className="text-sm font-black text-amber-900">
                {firstDealRevolutionRule && Boolean(get(gameState, "revolution_declared", "revolutionDeclared", false))
                  ? "첫 손 자동 혁명으로 세금은 없습니다. 대 농노가 광대 2장을 가졌다면 대혁명을 선택할 수 있습니다."
                  : "광대 2장을 가진 플레이어는 혁명을 선언할 수 있습니다."}
              </div>
              <div className="mt-2 text-xs font-bold text-amber-700">
                대상: {eligibleSeatNos.map(playerName).join(", ")}
              </div>
              {canDecideRevolution && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="rounded-xl bg-amber-600 px-3 py-3 text-sm font-black text-white" onClick={() => onAction({ action_type: "DECLARE_REVOLUTION" }).catch(() => notifyError("혁명 선언 실패"))}>
                    혁명 선언
                  </button>
                  <button className="rounded-xl bg-white px-3 py-3 text-sm font-black text-amber-700" onClick={() => onAction({ action_type: "SKIP_REVOLUTION" }).catch(() => notifyError("혁명 포기 실패"))}>
                    포기
                  </button>
                </div>
              )}
            </div>
          )}

          {phase === "TAX_RETURN" && (
            <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-black text-rose-900">{taxProgressText}</div>
                <div className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-rose-700">
                  농노의 최고 카드는 자동으로 올라갑니다.
                </div>
              </div>
              {!!taxExchangeRows.length && (
                <div className="mb-3 grid gap-2 sm:grid-cols-2">
                  {taxExchangeRows.map((exchange) => {
                    const dalmutiSeatNo = Number(get(exchange, "dalmuti_seat_no", "dalmutiSeatNo", 0));
                    const peonSeatNo = Number(get(exchange, "peon_seat_no", "peonSeatNo", 0));
                    const count = Number(get(exchange, "count", "count", 0));
                    const completed = Boolean(get(exchange, "completed", "completed", false));
                    return (
                      <div key={`${dalmutiSeatNo}-${peonSeatNo}-${count}`} className={`rounded-xl border px-3 py-2 text-xs font-bold leading-relaxed ${completed ? "border-emerald-100 bg-white text-emerald-700" : dalmutiSeatNo === mySeatNo ? "border-rose-200 bg-white text-rose-800" : "border-rose-100 bg-white/70 text-rose-700"}`}>
                        <div className="font-black">
                          {playerName(dalmutiSeatNo)} 반환 {count}장
                        </div>
                        <div className="mt-1">
                          {playerName(peonSeatNo)}의 최고 카드 {count}장을 받고, 선택한 카드 {count}장을 돌려줍니다.
                        </div>
                        <div className="mt-1 text-[11px]">
                          {completed ? "완료" : dalmutiSeatNo === mySeatNo ? "내가 선택해야 합니다." : "대기 중"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {canReturnTax ? (
                <>
                  <div className="text-sm font-black text-rose-900">농노에게 돌려줄 카드 {pendingTax.count}장을 선택하세요.</div>
                  <button
                    className="mt-3 w-full rounded-xl bg-rose-600 px-3 py-3 text-sm font-black text-white disabled:opacity-40"
                    disabled={selectedCardIds.length !== pendingTaxCount}
                    onClick={() => returnTax().catch(() => notifyError("세금 반환 실패"))}
                  >
                    선택한 카드 반환
                  </button>
                </>
              ) : (
                <div className="text-sm font-black text-rose-900">달무티 계급 플레이어의 세금 반환을 기다리는 중입니다.</div>
              )}
            </div>
          )}
        </div>

        <div id="dalmuti-hand-panel" className="scroll-mt-24 rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-lg sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-black text-slate-900">내 손패</div>
            <div className="flex flex-wrap gap-1.5 text-[11px] font-black">
              <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">보유 {hand.length}장</span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">선택 {selectedCardIds.length}장</span>
            </div>
          </div>
          {!!handRankGroups.length && (
            <div className="mb-3 rounded-2xl bg-slate-50 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-black text-slate-800">계급 빠른 선택</div>
                <button
                  type="button"
                  className="min-h-0 rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-500 shadow-sm"
                  onClick={() => setSelectedCardIds([])}
                  disabled={!selectedCardIds.length}
                >
                  선택 해제
                </button>
              </div>
              <div className="tabletop-scroll-rail flex gap-2 overflow-x-auto pb-1">
                {handRankGroups.map((group) => {
                  const groupStatus = quickSelectGroupStatusByKey.get(group.key) || {
                    disabled: phase === "REVOLUTION_DECISION" || phase === "FINISHED",
                    tone: "neutral",
                    badge: `${group.cards.length}장`,
                    reason: `${group.cards.length}장 보유`,
                  };
                  const selected = selectedQuickGroupKey === group.key;
                  const groupToneClass = selected
                    ? "bg-slate-900 text-white shadow-lg"
                    : groupStatus.tone === "ready"
                      ? "border border-emerald-100 bg-emerald-50 text-emerald-800 shadow-sm hover:border-emerald-300"
                      : groupStatus.tone === "tax"
                        ? "border border-rose-100 bg-rose-50 text-rose-800 shadow-sm hover:border-rose-300"
                        : groupStatus.tone === "blocked"
                          ? "border border-slate-100 bg-slate-100 text-slate-400"
                          : "border border-white bg-white text-slate-700 shadow-sm hover:bg-slate-100";
                  return (
                    <button
                      key={group.key}
                      type="button"
                      className={[
                        "min-h-[64px] min-w-[116px] rounded-xl px-3 py-2 text-left transition disabled:opacity-55",
                        groupToneClass,
                      ].join(" ")}
                      disabled={groupStatus.disabled}
                      onClick={() => quickSelectRankGroup(group)}
                      aria-label={`${group.label} 빠른 선택 · ${groupStatus.badge} · ${groupStatus.reason}${selected ? " · 현재 선택됨" : ""}`}
                      aria-pressed={selected}
                      title={`${group.label} · ${groupStatus.badge} · ${groupStatus.reason}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-black">{group.label}</span>
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black ${selected ? "bg-white/15 text-white" : "bg-white/80 text-current"}`}>
                          {groupStatus.badge}
                        </span>
                      </div>
                      <div className={`mt-0.5 text-[10px] font-bold ${selected ? "text-white/70" : "text-slate-400"}`}>
                        {groupStatus.reason}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 text-[11px] font-bold leading-relaxed text-slate-500">
                {quickSelectLimit > 0
                  ? `현재 기준에 맞춰 ${quickSelectLimit}장까지 고릅니다. 부족하면 광대가 와일드 카드로 함께 선택됩니다.`
                  : "계급을 누르면 같은 계급 카드를 한 번에 선택합니다."}
              </div>
            </div>
          )}
          <div id="dalmuti-action-strip" className="tabletop-mobile-action-strip sticky z-20 -mx-1 mb-3 scroll-mt-24 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur xl:static xl:mx-0 xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none xl:backdrop-blur-none">
            <div className={`mb-2 rounded-xl border px-3 py-2 text-[11px] font-black leading-relaxed xl:hidden ${dalmutiTurnNoticeTone}`} role="status" aria-live="polite" aria-atomic="true">
              {dalmutiTurnNotice}
            </div>
            <div className={`rounded-xl px-3 py-2 text-xs font-black leading-relaxed ${selectionHintTone}`} role="status" aria-live="polite" aria-atomic="true">
              {selectionHint}
            </div>
            {!!selectedCardSummaryItems.length && (
              <div className="mt-2 flex items-center gap-2 rounded-xl bg-slate-50 px-2 py-2">
                <div className="tabletop-scroll-rail flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1">
                  {selectedCardSummaryItems.map((item, index) => (
                    <span
                      key={`${item.id}-${index}`}
                      className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${item.jester ? "bg-violet-100 text-violet-700" : "bg-white text-slate-700 shadow-sm"}`}
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-500 shadow-sm disabled:opacity-40"
                  onClick={() => setSelectedCardIds([])}
                  disabled={!selectedCardIds.length}
                >
                  해제
                </button>
              </div>
            )}
            {playControls && <div className="mt-2">{playControls}</div>}
            {taxControls && <div className="mt-2">{taxControls}</div>}
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2 md:grid-cols-6">
            {hand.map((card) => (
              <DalmutiCard
                key={card.id}
                card={card}
                selected={selectedCardIds.includes(card.id)}
                onClick={() => toggleCard(card.id)}
                disabled={phase === "REVOLUTION_DECISION" || phase === "FINISHED"}
              />
            ))}
            {!hand.length && (
              <DalmutiEmptyHandPanel
                phase={phase}
                phaseLabel={dalmutiPhaseLabel}
                outOrder={myOutOrder}
                activeName={dalmutiEmptyHandActiveName}
                nextLeaderName={dalmutiNextLeaderName}
                currentTrickLabel={currentTrickLabel}
                passCount={passCount}
                requiredPassCount={requiredPassCount}
                turnNotice={dalmutiTurnNotice}
                trickClearHint={trickClearHint}
                nextOrderText={dalmutiEmptyHandNextOrder}
              />
            )}
          </div>
        </div>

        <section className="scroll-mt-24 space-y-3 rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-lg sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-black text-slate-900">핵심 요약</div>
              <div className="mt-0.5 text-xs font-bold text-slate-500">손패와 실제 제출 버튼을 확인한 뒤 세금, 혁명, 패스 압박만 압축해서 봅니다.</div>
            </div>
            <div className="rounded-full bg-violet-50 px-3 py-1 text-[11px] font-black text-violet-700">
              {dalmutiPhaseLabel}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {dalmutiFlowItems.map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="text-[10px] font-black text-slate-400">{item.label}</div>
                <div className="mt-0.5 truncate text-sm font-black text-slate-900">{item.value}</div>
                <div className="mt-0.5 line-clamp-1 text-[10px] font-bold text-slate-500">{item.detail}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <aside className="space-y-4">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
          <div className="mb-3 text-sm font-black text-slate-900">계급과 손패</div>
          <div className="space-y-2">
            {orderedDalmutiPlayers.map((player) => {
              const seatNo = Number(get(player, "seat_no", "seatNo", 0));
              const outOrder = get(player, "out_order", "outOrder", null);
              return (
                <div key={seatNo} className={`rounded-xl border px-3 py-2 ${activeSeatNo === seatNo ? "border-violet-200 bg-violet-50" : "border-slate-100 bg-slate-50"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-slate-900">{playerName(seatNo)}</div>
                      <div className="text-[11px] font-bold text-slate-500">
                        {dalmutiRoleLabels[player.role] || player.role} · 누적 {get(player, "score", "score", 0)}점
                        {Number(get(player, "round_score", "roundScore", 0)) > 0 ? ` · 이번 +${get(player, "round_score", "roundScore", 0)}` : ""}
                      </div>
                    </div>
                    <div className="text-right text-xs font-black text-slate-600">
                      {outOrder ? `${outOrder}등` : `${get(player, "hand_count", "handCount", 0)}장`}
                    </div>
                  </div>
                  {get(player, "next_role", "nextRole", null) && (
                    <div className="mt-1 text-[10px] font-bold text-emerald-600">
                      다음 계급: {dalmutiRoleLabels[get(player, "next_role", "nextRole", "")] || get(player, "next_role", "nextRole", "")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
          <div className="mb-3 text-sm font-black text-slate-900">누적 점수</div>
          <div className="space-y-2">
            {orderedDalmutiScores.map((player, index) => {
              const seatNo = Number(get(player, "seat_no", "seatNo", 0));
              return (
                <div key={seatNo} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                  <span>{index + 1}. {playerName(seatNo)}</span>
                  <span className="font-black text-slate-900">{get(player, "score", "score", 0)}점</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
          <div className="mb-3 text-sm font-black text-slate-900">최근 제출</div>
          <div className="space-y-2">
            {playPile.slice(-5).reverse().map((play, index) => (
              <div key={`${get(play, "seat_no", "seatNo", 0)}-${index}`} className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
                {playerName(get(play, "seat_no", "seatNo", 0))} · {get(play, "rank_name", "rankName", "")} {play.count}장
              </div>
            ))}
            {!playPile.length && (
              <DalmutiPlayPileEmptyState
                phase={phase}
                activeName={activeSeatNo ? playerName(activeSeatNo) : ""}
                leadName={leadSeatNo ? playerName(leadSeatNo) : ""}
                currentTrickLabel={currentTrickLabel}
                passCount={passCount}
                requiredPassCount={requiredPassCount}
                turnNotice={dalmutiTurnNotice}
              />
            )}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
          <div className="mb-3 text-sm font-black text-slate-900">기록</div>
          <div className="space-y-2">
            {events.slice(-6).reverse().map((event) => (
              <div key={get(event, "event_no", "eventNo", 0)} className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
                {get(event, "event_no", "eventNo", 0)} · {dalmutiEventLabels[get(event, "event_type", "eventType", "")] || get(event, "event_type", "eventType", "")} · {get(event, "seat_no", "seatNo", 0) ? playerName(get(event, "seat_no", "seatNo", 0)) : "시스템"}
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
};

export { DalmutiBoard };
export default DalmutiBoard;
