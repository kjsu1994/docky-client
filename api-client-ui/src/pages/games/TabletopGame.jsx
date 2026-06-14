import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { notify, notifyError, notifySuccess } from "../../utils/toast.js";
import {
  ArrowUp,
  CheckCircle2,
  Copy,
  Crown,
  Dices,
  Gavel,
  RefreshCw,
  Shield,
  Skull,
  Sun,
  Timer,
  Users,
  Volume2,
} from "lucide-react";
import {
  getTabletopMemberId,
  getTabletopRoomCode,
  getTabletopRoomId,
  getTabletopRoomStatus,
  getTabletopSeatNo,
  isTabletopStateAccessError,
  isTabletopReadyPlayer,
  normalizeTabletopStatePayload,
  tabletopGameAdapter,
} from "../../adapters/tabletopGameAdapter.js";
import { buildStompConnectHeaders, createStompClient, notifyRealtimeError } from "../../adapters/realtimeAdapter.js";
import { realtimeReplayAdapter } from "../../adapters/realtimeReplayAdapter.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useGameSound } from "../../hooks/useGameSound.js";
import { confirmAction } from "../../common/confirmAction.jsx";
import GameRoomChatPanel from "../../common/GameRoomChatPanel.jsx";
import GameRoomPlayersPanel from "../../common/GameRoomPlayersPanel.jsx";
import UserAvatar from "../../common/UserAvatar.jsx";
import { clearPageGuideContext, setPageGuideContext } from "../../common/pageGuideContext.js";
import { GameActionCueBar, GameFlowMeter, GameResultSpotlight, GameUxGlyph, PlayingCardArt, playingCardSuitLabel } from "./GameUxAssets.jsx";
import { canUseTabletopSoloAiStart, supportsTabletopAiBotStart } from "./tabletopStartPolicy.js";

const PokerBoard = lazy(() => import("./PokerBoard.jsx").then((module) => ({ default: module.PokerBoard })));
const CatanBoard = lazy(() => import("./CatanBoard.jsx").then((module) => ({ default: module.CatanBoard })));
const MaheBoard = lazy(() => import("./MaheBoard.jsx").then((module) => ({ default: module.MaheBoard })));
const BlokusBoard = lazy(() => import("./BlokusBoard.jsx").then((module) => ({ default: module.BlokusBoard })));
const DalmutiBoard = lazy(() => import("./DalmutiBoard.jsx").then((module) => ({ default: module.DalmutiBoard })));
const SixNimmtBoard = lazy(() => import("./SixNimmtBoard.jsx").then((module) => ({ default: module.SixNimmtBoard })));
const TelestrationsBoard = lazy(() => import("./TelestrationsBoard.jsx").then((module) => ({ default: module.TelestrationsBoard })));
const MafiaBoard = lazy(() => import("./MafiaBoard.jsx").then((module) => ({ default: module.MafiaBoard })));

const TabletopBoardFallback = () => (
  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 text-center text-sm font-black text-slate-500 shadow-lg" role="status" aria-live="polite">
    Loading board...
  </div>
);

const gameConfigs = {
  catan: {
    title: "카탄",
    eyebrow: "기본판 · 확장 선택 · 교역 · 개척",
    description: "자원을 모으고 도로와 마을을 확장해 섬의 주도권을 다투는 전략 보드게임입니다.",
    storageKey: "catan_last_room_id",
    accent: "from-amber-500 via-lime-500 to-sky-500",
    board: "catan",
  },
  blokus: {
    title: "블로커스",
    eyebrow: "영역 배치 · 코너 접촉 · 추상 전략",
    description: "각자의 조각을 최대한 많이 놓되, 내 조각끼리는 모서리로만 이어야 하는 배치 게임입니다.",
    storageKey: "blokus_last_room_id",
    accent: "from-cyan-500 via-blue-500 to-fuchsia-500",
    board: "blokus",
  },
  mahe: {
    title: "마헤",
    eyebrow: "거북이 경주 · 주사위 선택 · 업고 가기",
    description: "거북이를 움직여 섬을 한 바퀴 돌고, 알 카드 점수를 모으는 가벼운 가족형 경주 게임입니다.",
    storageKey: "mahe_last_room_id",
    accent: "from-emerald-500 via-teal-500 to-yellow-400",
    board: "mahe",
  },
  dalmuti: {
    title: "달무티",
    eyebrow: "계급 카드 · 선 털기 · 자리 바꾸기",
    description: "카드를 빨리 털수록 다음 라운드의 신분이 올라가는 계급형 클라이밍 카드게임입니다.",
    storageKey: "dalmuti_last_room_id",
    accent: "from-violet-500 via-rose-500 to-amber-500",
    board: "dalmuti",
  },
  "six-nimmt": {
    title: "6 nimmt!",
    eyebrow: "동시 카드 선택 · 4개 행 · 66벌점 종료",
    description: "손패에서 카드를 동시에 고르고, 낮은 카드부터 행에 붙입니다. 여섯 번째 카드가 되면 그 행을 가져가 벌점을 받는 카드 게임입니다.",
    storageKey: "six_nimmt_last_room_id",
    accent: "from-rose-500 via-amber-500 to-lime-500",
    board: "six-nimmt",
  },
  telestrations: {
    title: "텔레스트레이션",
    eyebrow: "문장 · 그림 · 추측 · 리플레이",
    description: "처음 문장을 적고, 다음 사람은 그림을 그리고, 또 다음 사람은 그림을 보고 문장을 추측하는 파티형 릴레이 게임입니다.",
    storageKey: "telestrations_last_room_id",
    accent: "from-sky-500 via-fuchsia-500 to-amber-400",
    board: "telestrations",
  },
  mafia: {
    title: "마피아",
    eyebrow: "사회자 TTS · 비밀 역할 · 낮 토론 · 투표",
    description: "정해진 시간에 따라 사회자 음성이 밤과 낮을 진행하고, 마피아·경찰·의사 포함 여부를 선택해 즐기는 파티 추리 게임입니다.",
    storageKey: "mafia_last_room_id",
    accent: "from-zinc-950 via-indigo-950 to-rose-900",
    board: "mafia",
  },
  poker: {
    title: "포커",
    eyebrow: "텍사스 홀덤 · 5장 드로우 · 족보 보조",
    description: "텍사스 홀덤과 5장 드로우 포커를 고르고, 혼자 시작하면 AI 봇이 자동으로 들어오는 칩 기반 포커입니다.",
    storageKey: "poker_last_room_id",
    accent: "from-emerald-700 via-zinc-900 to-rose-700",
    board: "poker",
  },
};

const mobileJumpLinksByGame = {
  catan: [
    { href: "#catan-board-panel", label: "보드" },
    { href: "#catan-action-panel", label: "액션" },
  ],
  blokus: [
    { href: "#blokus-board-panel", label: "보드" },
    { href: "#blokus-action-strip", label: "놓기" },
  ],
  mahe: [
    { href: "#mahe-board-panel", label: "트랙" },
    { href: "#mahe-action-strip", label: "굴리기" },
  ],
  dalmuti: [
    { href: "#dalmuti-status-panel", label: "판세" },
    { href: "#dalmuti-hand-panel", label: "손패" },
    { href: "#dalmuti-action-strip", label: "제출" },
  ],
  "six-nimmt": [
    { href: "#six-nimmt-board-panel", label: "행" },
    { href: "#six-nimmt-hand-panel", label: "손패" },
    { href: "#six-nimmt-action-strip", label: "선택" },
  ],
  telestrations: [
    { href: "#telestrations-task-panel", label: "입력" },
    { href: "#telestrations-replay-panel", label: "공개" },
  ],
  mafia: [
    { href: "#mafia-stage-panel", label: "진행" },
    { href: "#mafia-action-panel", label: "행동" },
    { href: "#mafia-players-panel", label: "명단" },
  ],
  poker: [
    { href: "#poker-table-panel", label: "테이블" },
    { href: "#poker-action-panel", label: "액션" },
    { href: "#poker-players-panel", label: "칩" },
  ],
};

const MobileGameJumpNav = ({ game, gameState }) => {
  const phase = String(gameState?.phase || "").toUpperCase();
  let links = mobileJumpLinksByGame[game] || [];
  if (game === "telestrations" && phase !== "REVEAL") {
    links = links.filter((link) => link.href !== "#telestrations-replay-panel");
  }
  if (!links.length) return null;

  return (
    <nav className="tabletop-mobile-jump-nav sticky z-30 rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-lg backdrop-blur xl:hidden" aria-label="게임 화면 빠른 이동">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}>
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="inline-flex min-h-10 items-center justify-center rounded-xl px-3 text-xs font-black text-slate-700 hover:bg-slate-100 focus:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            {link.label}
          </a>
        ))}
      </div>
    </nav>
  );
};

const seatTokenClasses = [
  "bg-blue-500 text-white border-blue-700",
  "bg-rose-500 text-white border-rose-700",
  "bg-emerald-500 text-white border-emerald-700",
  "bg-amber-400 text-slate-900 border-amber-600",
  "bg-violet-500 text-white border-violet-700",
  "bg-cyan-500 text-white border-cyan-700",
  "bg-slate-800 text-white border-slate-950",
];

const statusLabels = {
  WAITING: "대기 중",
  PLAYING: "진행 중",
  FINISHED: "종료",
  CANCELLED: "취소",
};

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

const keyboardActivateProps = (onActivate) => ({
  role: "button",
  tabIndex: 0,
  onKeyDown: (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onActivate();
  },
});

const maheEventLabels = {
  ROLL_DIE: "주사위",
  STOP_ROLLING: "멈춤",
  CHOOSE_DICE_COUNT: "주사위 개수 지시",
  MOVE: "이동",
  SCORE: "알 획득",
  BUST: "실패",
};

const catanTerrain = {
  FOREST: { label: "숲", fill: "#2f8f5b", text: "#ffffff" },
  PASTURE: { label: "목초지", fill: "#8ccf5f", text: "#17350f" },
  FIELD: { label: "밀밭", fill: "#f2c94c", text: "#4a3500" },
  HILL: { label: "언덕", fill: "#c96f3d", text: "#ffffff" },
  MOUNTAIN: { label: "산", fill: "#7f8792", text: "#ffffff" },
  DESERT: { label: "사막", fill: "#d8b46f", text: "#5a3c10" },
  GOLD: { label: "금광", fill: "#f59e0b", text: "#451a03" },
  SEA: { label: "바다", fill: "#38bdf8", text: "#075985" },
  UNEXPLORED: { label: "미발견", fill: "#475569", text: "#f8fafc" },
};

const catanTerrainPatternIds = {
  FOREST: "catan-terrain-forest",
  PASTURE: "catan-terrain-pasture",
  FIELD: "catan-terrain-field",
  HILL: "catan-terrain-hill",
  MOUNTAIN: "catan-terrain-mountain",
  DESERT: "catan-terrain-desert",
  GOLD: "catan-terrain-gold",
  SEA: "catan-terrain-sea",
  UNEXPLORED: "catan-terrain-unexplored",
};

const catanResourceLabels = {
  BRICK: "벽돌",
  LUMBER: "목재",
  WOOL: "양털",
  GRAIN: "곡물",
  ORE: "광석",
  WOOL_GRAIN: "양털/곡물",
};

const catanTerrainResourceType = {
  FOREST: "LUMBER",
  PASTURE: "WOOL",
  FIELD: "GRAIN",
  HILL: "BRICK",
  MOUNTAIN: "ORE",
  GOLD: "GOLD",
};

const catanResourceKeys = ["BRICK", "LUMBER", "WOOL", "GRAIN", "ORE"];
const catanResourceEntries = catanResourceKeys.map((key) => [key, catanResourceLabels[key]]);
const emptyCatanResourceCounts = () => Object.fromEntries(catanResourceKeys.map((key) => [key, 0]));

const catanResourceArtProfiles = {
  BRICK: { fill: "#dc2626", stroke: "#7f1d1d", wash: "#fecaca", ink: "#fff7ed" },
  LUMBER: { fill: "#92400e", stroke: "#451a03", wash: "#fde68a", ink: "#fff7ed" },
  WOOL: { fill: "#f8fafc", stroke: "#64748b", wash: "#e0f2fe", ink: "#0f172a" },
  GRAIN: { fill: "#facc15", stroke: "#a16207", wash: "#fef9c3", ink: "#451a03" },
  ORE: { fill: "#64748b", stroke: "#1e293b", wash: "#e2e8f0", ink: "#f8fafc" },
};

const CatanResourceTokenArt = ({ type, count = 0, bankCount = null, className = "" }) => {
  const profile = catanResourceArtProfiles[type] || catanResourceArtProfiles.BRICK;
  const label = catanResourceLabels[type] || type;
  const safeCount = Math.max(0, Number(count || 0));
  const bankLabel = bankCount == null ? "은행 -" : `은행 ${bankCount}`;
  const countScale = Math.min(1, safeCount / 6);

  return (
    <svg
      viewBox="0 0 96 112"
      className={className}
      data-smoke="catan-resource-token-art"
      role="img"
      aria-label={`${label} 보유 ${safeCount}장, ${bankLabel}`}
    >
      <rect x="7" y="7" width="82" height="98" rx="16" fill={profile.wash} stroke={profile.stroke} strokeWidth="3" />
      <rect x="15" y="15" width="66" height="82" rx="12" fill="#ffffff" opacity=".72" />
      <g transform="translate(48 44)">
        {type === "BRICK" && (
          <>
            <rect x="-25" y="-18" width="22" height="13" rx="3" fill={profile.fill} stroke={profile.stroke} strokeWidth="2" />
            <rect x="-1" y="-18" width="26" height="13" rx="3" fill={profile.fill} stroke={profile.stroke} strokeWidth="2" />
            <rect x="-18" y="-3" width="36" height="13" rx="3" fill="#ef4444" stroke={profile.stroke} strokeWidth="2" />
            <rect x="-26" y="12" width="24" height="13" rx="3" fill={profile.fill} stroke={profile.stroke} strokeWidth="2" />
            <rect x="4" y="12" width="22" height="13" rx="3" fill="#ef4444" stroke={profile.stroke} strokeWidth="2" />
          </>
        )}
        {type === "LUMBER" && (
          <>
            {[-14, 0, 14].map((offset) => (
              <g key={offset} transform={`translate(${offset} ${offset === 0 ? 4 : 0}) rotate(${offset / 2})`}>
                <rect x="-6" y="-25" width="12" height="50" rx="6" fill={profile.fill} stroke={profile.stroke} strokeWidth="2" />
                <path d="M-2-18c5 8-4 16 2 25" fill="none" stroke={profile.wash} strokeWidth="2" strokeLinecap="round" opacity=".65" />
              </g>
            ))}
          </>
        )}
        {type === "WOOL" && (
          <>
            {[
              [-16, -4, 14], [0, -14, 16], [16, -4, 14], [-9, 11, 14], [11, 10, 15],
            ].map(([x, y, r]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={profile.fill} stroke={profile.stroke} strokeWidth="2" />
            ))}
            <circle cx="5" cy="0" r="8" fill={profile.stroke} opacity=".8" />
          </>
        )}
        {type === "GRAIN" && (
          <>
            <path d="M0 28V-27" stroke={profile.stroke} strokeWidth="4" strokeLinecap="round" />
            {[-19, -10, -1, 8, 17].map((y, index) => (
              <g key={y}>
                <ellipse cx="-10" cy={y} rx="7" ry="11" fill={profile.fill} stroke={profile.stroke} strokeWidth="1.7" transform={`rotate(${-35 - index * 3} -10 ${y})`} />
                <ellipse cx="10" cy={y + 3} rx="7" ry="11" fill={profile.fill} stroke={profile.stroke} strokeWidth="1.7" transform={`rotate(${35 + index * 3} 10 ${y + 3})`} />
              </g>
            ))}
          </>
        )}
        {type === "ORE" && (
          <>
            <polygon points="-22,12 -14,-18 6,-26 26,-8 20,22 -6,28" fill={profile.fill} stroke={profile.stroke} strokeWidth="2.4" />
            <polygon points="-6,-10 8,-18 17,-5 8,5" fill="#94a3b8" opacity=".72" />
            <polygon points="-18,12 -7,5 5,25 -8,26" fill="#334155" opacity=".55" />
          </>
        )}
      </g>
      <rect x="18" y="78" width="58" height="16" rx="8" fill={profile.stroke} opacity=".9" />
      <rect x="18" y="78" width={Math.max(8, 58 * countScale)} height="16" rx="8" fill={profile.fill} />
      <text x="48" y="72" textAnchor="middle" fill="#0f172a" fontSize="13" fontWeight="900">{label}</text>
      <text x="48" y="91" textAnchor="middle" fill={profile.ink} fontSize="12" fontWeight="900">{safeCount}장</text>
    </svg>
  );
};

const CatanResourceStrategyArt = ({
  resources = {},
  buildSignals = [],
  tradeSummary = "",
  scoreRace = [],
  myCardCount = 0,
  phase = "",
  myTurn = false,
}) => {
  const resourceTotal = catanResourceKeys.reduce((sum, key) => sum + Math.max(0, Number(resources?.[key] || 0)), 0);
  const readyBuilds = buildSignals.filter((item) => item.ready).length;
  const affordableBuilds = buildSignals.filter((item) => item.affordable || item.ready).length;
  const leader = scoreRace[0];
  const tradeReady = /가능|교환|항구|은행/.test(tradeSummary || "");
  const nodes = [
    {
      key: "resource",
      x: 58,
      y: 83,
      label: "자원",
      value: `${resourceTotal}장`,
      active: resourceTotal > 0,
      fill: "#f59e0b",
    },
    {
      key: "build",
      x: 150,
      y: 52,
      label: "건설",
      value: readyBuilds ? `${readyBuilds}개` : affordableBuilds ? "차례" : "부족",
      active: readyBuilds > 0,
      fill: "#10b981",
    },
    {
      key: "trade",
      x: 242,
      y: 92,
      label: "교환",
      value: tradeReady ? "검토" : "대기",
      active: tradeReady,
      fill: "#0ea5e9",
    },
    {
      key: "score",
      x: 334,
      y: 62,
      label: "승점",
      value: leader ? `${leader.points}/${leader.target}` : "-",
      active: Boolean(leader),
      fill: "#8b5cf6",
    },
  ];

  return (
    <svg
      viewBox="0 0 390 150"
      className="h-auto w-full"
      data-smoke="catan-resource-strategy-art"
      role="img"
      aria-label="카탄 자원에서 건설, 교환, 승점 압박으로 이어지는 전략 흐름"
      focusable="false"
    >
      <rect x="8" y="8" width="374" height="134" rx="24" fill="#0f172a" stroke="#334155" strokeWidth="3" />
      <path d="M58 83C96 40 118 35 150 52s55 68 92 40 59-68 92-30" fill="none" stroke="#334155" strokeWidth="13" strokeLinecap="round" />
      <path d="M58 83C96 40 118 35 150 52s55 68 92 40 59-68 92-30" fill="none" stroke={myTurn ? "#fbbf24" : "#64748b"} strokeWidth="4" strokeLinecap="round" />
      <text x="24" y="32" fontSize="11" fontWeight="900" fill="#fde68a">자원 전략 지도</text>
      <text x="24" y="51" fontSize="17" fontWeight="900" fill="#ffffff">자원 → 건설 → 교환 → 승점</text>
      <text x="24" y="126" fontSize="10" fontWeight="900" fill="#cbd5e1">{`${myTurn ? "내 차례" : "관찰"} · 손패 ${myCardCount} · ${phase || "상태 확인"}`}</text>
      {nodes.map((node) => (
        <g key={node.key} data-smoke="catan-resource-strategy-node" data-strategy-key={node.key} data-active={node.active ? "true" : "false"}>
          <circle cx={node.x} cy={node.y} r="23" fill={node.active ? "#ffffff" : "#f8fafc"} stroke={node.active ? node.fill : "#cbd5e1"} strokeWidth="4" />
          <circle cx={node.x} cy={node.y} r="7" fill={node.active ? node.fill : "#94a3b8"} />
          <text x={node.x} y={node.y - 31} textAnchor="middle" fontSize="10" fontWeight="900" fill="#f8fafc">{node.label}</text>
          <text x={node.x} y={node.y + 39} textAnchor="middle" fontSize="10" fontWeight="900" fill="#e2e8f0">{node.value}</text>
        </g>
      ))}
    </svg>
  );
};

const CatanResourceStrategyPanel = ({
  resources = {},
  resourceBank = {},
  buildSignals = [],
  scoreRace = [],
  myCardCount = 0,
  tradeSummary = "",
  phase = "",
  myTurn = false,
  className = "",
}) => {
  const resourceTotal = catanResourceKeys.reduce((sum, key) => sum + Math.max(0, Number(resources?.[key] || 0)), 0);
  const readyBuildCount = buildSignals.filter((item) => item.ready).length;

  return (
    <section
      className={`rounded-[1.5rem] border border-slate-200 bg-slate-950 p-4 text-white shadow-lg ${className}`}
      data-smoke="catan-resource-strategy-panel"
      data-phase={phase || ""}
      data-my-turn={myTurn ? "true" : "false"}
      data-resource-total={resourceTotal}
      data-ready-builds={readyBuildCount}
      data-card-count={myCardCount}
      aria-label="카탄 자원과 건설 판단"
    >
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="text-[11px] font-black uppercase tracking-wide text-amber-200">Resource Board</div>
        <div className="mt-1 text-base font-black">자원과 다음 건설 판단</div>
        <div className="mt-1 text-xs font-bold leading-relaxed text-slate-300">
          {myTurn ? "내 보유 자원으로 가능한 건설·교환 신호를 즉시 확인합니다." : "자원은 충분해도 실제 실행은 내 차례에만 가능합니다."}
        </div>
      </div>
      <div className="rounded-xl bg-white/10 px-3 py-2 text-right ring-1 ring-white/10">
        <div className="text-[10px] font-black text-slate-400">손패 압박</div>
        <div className="text-xl font-black text-amber-100">{myCardCount}</div>
        <div className="text-[10px] font-bold text-slate-400">{phase === "DISCARD" ? "버리기 단계" : "자원+상품"}</div>
      </div>
    </div>
    <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
      <CatanResourceStrategyArt
        resources={resources}
        buildSignals={buildSignals}
        tradeSummary={tradeSummary}
        scoreRace={scoreRace}
        myCardCount={myCardCount}
        phase={phase}
        myTurn={myTurn}
      />
    </div>
    <div className="mt-4 grid grid-cols-5 gap-1.5">
      {catanResourceEntries.map(([key]) => (
        <CatanResourceTokenArt
          key={key}
          type={key}
          count={resources?.[key] ?? 0}
          bankCount={resourceBank?.[key] ?? null}
          className="h-24 w-full"
        />
      ))}
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2" data-smoke="catan-build-readiness-list">
      {buildSignals.map((item) => (
        <div
          key={item.key}
          className={`min-h-[92px] rounded-xl border px-3 py-2 ${item.ready ? "border-emerald-300/40 bg-emerald-400/15" : item.affordable ? "border-amber-300/40 bg-amber-400/15" : "border-white/10 bg-white/10"}`}
          data-smoke="catan-build-readiness-card"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-black">{item.label}</div>
            <span className={`rounded-full px-2 py-1 text-[10px] font-black ${item.ready ? "bg-emerald-300 text-emerald-950" : item.affordable ? "bg-amber-200 text-amber-950" : "bg-white/10 text-slate-300"}`}>
              {item.ready ? "가능" : item.affordable ? "차례 대기" : "재료 부족"}
            </span>
          </div>
          <div className="mt-1 text-[11px] font-bold leading-relaxed text-slate-300">{item.cost}</div>
          <div className="mt-1 text-[11px] font-bold leading-relaxed text-slate-400">{item.detail}</div>
        </div>
      ))}
    </div>
    <div className="mt-4 rounded-xl bg-white/10 p-3 ring-1 ring-white/10">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-black text-slate-200">승점 레이스</div>
        <div className="text-[10px] font-bold text-slate-400">{tradeSummary}</div>
      </div>
      <div className="mt-2 space-y-2">
        {scoreRace.map((player) => (
          <div key={player.seatNo} data-smoke="catan-score-race-item">
            <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-bold">
              <span className={player.isMe ? "text-amber-100" : "text-slate-300"}>{player.name}</span>
              <span className="text-slate-400">{player.points}/{player.target}점</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${player.isMe ? "bg-amber-300" : "bg-sky-300"}`}
                style={{ width: `${player.progress}%` }}
              />
            </div>
          </div>
        ))}
        {!scoreRace.length && <div className="text-xs font-bold text-slate-500">플레이어 승점 정보가 아직 없습니다.</div>}
      </div>
    </div>
    </section>
  );
};

const CatanVictoryTrackArt = ({ rows = [], target = 10, leaderSeatNo = 0, mySeatNo = 0 }) => {
  const visibleRows = rows.slice(0, 4);
  const safeTarget = Math.max(1, Number(target || 10));

  return (
    <svg
      data-smoke="catan-victory-track-art"
      viewBox="0 0 420 230"
      className="h-auto w-full"
      role="img"
      aria-label={`카탄 승리 트랙 목표 ${safeTarget}점`}
      focusable="false"
    >
      <rect x="12" y="12" width="396" height="206" rx="28" fill="#f8fafc" stroke="#fde68a" strokeWidth="3" />
      <path d="M36 184c44-42 78-50 116-24 31 22 62 19 100-11 46-36 90-25 132 35v32H36Z" fill="#fef3c7" opacity=".7" />
      <rect x="54" y="46" width="300" height="16" rx="8" fill="#e2e8f0" />
      <path d="M354 36v44" stroke="#92400e" strokeWidth="4" strokeLinecap="round" />
      <path d="M340 43h34l-9 10 9 10h-34Z" fill="#f59e0b" stroke="#92400e" strokeWidth="2" />
      <text x="354" y="30" textAnchor="middle" fontSize="13" fontWeight="900" fill="#92400e">목표 {safeTarget}</text>
      {visibleRows.map((row, index) => {
        const y = 86 + index * 35;
        const progress = Math.max(0, Math.min(1, Number(row.visiblePoints || 0) / safeTarget));
        const x = 54 + progress * 300;
        const isLeader = row.seatNo === leaderSeatNo;
        const isMe = row.seatNo === mySeatNo;
        const fill = isLeader ? "#f59e0b" : isMe ? "#06b6d4" : "#94a3b8";
        return (
          <g key={row.seatNo || index} data-smoke="catan-victory-track-node">
            <rect x="54" y={y - 7} width="300" height="14" rx="7" fill="#e2e8f0" />
            <rect x="54" y={y - 7} width={Math.max(10, x - 54)} height="14" rx="7" fill={fill} opacity=".9" />
            <circle cx={x} cy={y} r={isLeader ? 16 : 13} fill="#ffffff" stroke={fill} strokeWidth={isLeader ? 5 : 4} />
            <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="900" fill="#0f172a">{row.visiblePoints}</text>
            <text x="32" y={y + 4} textAnchor="middle" fontSize="11" fontWeight="900" fill="#334155">{index + 1}</text>
            <text x="368" y={y + 4} fontSize="11" fontWeight="900" fill={isLeader ? "#92400e" : isMe ? "#0e7490" : "#475569"}>
              {isLeader ? "선두" : isMe ? "나" : `${row.remaining}점 남음`}
            </text>
          </g>
        );
      })}
      <rect x="38" y="188" width="154" height="28" rx="14" fill="#ffffff" stroke="#fde68a" />
      <text x="115" y="207" textAnchor="middle" fontSize="12" fontWeight="900" fill="#92400e">공개 승점 기준</text>
      <rect x="218" y="188" width="150" height="28" rx="14" fill="#ffffff" stroke="#bae6fd" />
      <text x="293" y="207" textAnchor="middle" fontSize="12" fontWeight="900" fill="#075985">내 숨은 점수 포함</text>
    </svg>
  );
};

const CatanVictoryTrackPanel = ({ rows = [], target = 10, phase = "", mySeatNo = 0 }) => {
  if (!rows.length) return null;
  const leader = rows[0];
  const mine = rows.find((row) => row.seatNo === mySeatNo) || null;
  const safeTarget = Math.max(1, Number(target || 10));
  const leaderRemaining = Math.max(0, safeTarget - Number(leader?.visiblePoints || 0));
  const myRemaining = mine ? Math.max(0, safeTarget - Number(mine.visiblePoints || 0)) : null;
  const gap = mine ? Math.max(0, Number(leader?.visiblePoints || 0) - Number(mine.visiblePoints || 0)) : 0;
  const finished = phase === "FINISHED";
  const items = [
    {
      label: finished ? "승자" : "선두",
      value: leader ? `${leader.name} ${leader.visiblePoints}점` : "-",
      detail: leaderRemaining <= 0 ? "목표 점수에 도달한 상태입니다." : `목표까지 ${leaderRemaining}점 남았습니다.`,
      tone: "border-amber-100 bg-amber-50 text-amber-900",
    },
    {
      label: "내 격차",
      value: mine ? (gap > 0 ? `${gap}점 차이` : "동률/선두권") : "참가 대기",
      detail: mine ? `내 목표까지 ${myRemaining}점 남았습니다.` : "내 좌석 점수 정보가 아직 없습니다.",
      tone: "border-sky-100 bg-sky-50 text-sky-900",
    },
    {
      label: "보너스 압력",
      value: `${rows.reduce((sum, row) => sum + row.bonusCount, 0)}개 신호`,
      detail: "최장 교역로, 최대 기사력, 특별/임무/방어자 점수 같은 공개 보너스 신호입니다.",
      tone: "border-violet-100 bg-violet-50 text-violet-900",
    },
    {
      label: "판단 기준",
      value: finished ? "결과 확인" : "점수 레이스",
      detail: "상대는 공개 승점 중심, 내 점수는 서버가 내려준 내 승점 정보를 함께 읽습니다.",
      tone: "border-slate-200 bg-white text-slate-700",
    },
  ];

  return (
    <section data-smoke="catan-victory-track-panel" className="mb-3 overflow-hidden rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-sky-50 p-3 shadow-sm sm:rounded-[1.5rem]">
      <div className="grid gap-3 lg:grid-cols-[1fr_1.05fr]">
        <CatanVictoryTrackArt rows={rows} target={safeTarget} leaderSeatNo={leader?.seatNo || 0} mySeatNo={mySeatNo} />
        <div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-xs font-black text-amber-700">승리 트랙</div>
              <div className="mt-1 text-base font-black text-slate-950">누가 목표에 가장 가까운지 확인</div>
              <div className="mt-1 text-xs font-bold leading-relaxed text-slate-600">
                목표 {safeTarget}점까지 남은 거리와 공개 보너스 압력을 보드 조작 전에 읽습니다.
              </div>
            </div>
            <span className="rounded-full border border-amber-100 bg-white px-3 py-1 text-[11px] font-black text-amber-700">
              목표까지 {leaderRemaining}점
            </span>
          </div>
          <div className="mt-3 grid gap-2">
            {items.map((item) => (
              <div key={item.label} data-smoke="catan-victory-track-item" className={`rounded-xl border px-3 py-2 ${item.tone}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-black opacity-60">{item.label}</div>
                    <div className="mt-0.5 text-sm font-black leading-snug">{item.value}</div>
                  </div>
                </div>
                <div className="mt-1 text-[11px] font-bold leading-snug opacity-75">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const CatanActionAtlasArt = ({ activeKey = "build", items = [] }) => {
  const profiles = {
    build: { x: 74, label: "건설", color: "#059669", wash: "#d1fae5" },
    target: { x: 190, label: "대상", color: "#0284c7", wash: "#e0f2fe" },
    trade: { x: 306, label: "교환", color: "#d97706", wash: "#fef3c7" },
  };
  const activeProfile = profiles[activeKey] || profiles.build;
  const activeIndex = Math.max(0, ["build", "target", "trade"].indexOf(activeKey));
  const progressWidth = 116 * activeIndex;

  return (
    <svg
      data-smoke="catan-action-atlas-art"
      viewBox="0 0 380 210"
      className="h-auto w-full"
      role="img"
      aria-label={`카탄 액션 아틀라스 ${activeProfile.label}`}
      focusable="false"
    >
      <rect x="10" y="10" width="360" height="190" rx="28" fill="#f8fafc" stroke="#bbf7d0" strokeWidth="3" />
      <path d="M38 152c46-31 86-39 120-22 40 20 77 18 112-6 31-21 55-12 78 26v40H38Z" fill={activeProfile.wash} opacity="0.72" />
      <path d="M74 102h232" fill="none" stroke="#d1d5db" strokeWidth="10" strokeLinecap="round" />
      <path d={`M74 102h${progressWidth}`} fill="none" stroke="#0f172a" strokeWidth="10" strokeLinecap="round" />
      {Object.entries(profiles).map(([key, profile]) => {
        const active = key === activeKey;
        return (
          <g key={key} data-smoke="catan-action-atlas-node">
            <circle cx={profile.x} cy="102" r={active ? 34 : 27} fill={active ? profile.color : "#ffffff"} stroke={active ? "#0f172a" : "#cbd5e1"} strokeWidth={active ? 5 : 3} />
            {key === "build" && (
              <g>
                <path d={`M${profile.x - 18} 111l18-20 18 20v18h-36Z`} fill={active ? "#ffffff" : profile.wash} stroke={active ? "#ffffff" : profile.color} strokeWidth="2" />
                <path d={`M${profile.x - 10} 129v-14h20v14`} fill="none" stroke={active ? profile.color : "#064e3b"} strokeWidth="4" strokeLinecap="round" />
              </g>
            )}
            {key === "target" && (
              <g>
                <circle cx={profile.x} cy="102" r="14" fill={active ? "#ffffff" : profile.wash} stroke={active ? "#ffffff" : profile.color} strokeWidth="3" />
                <path d={`M${profile.x - 22} 102h44M${profile.x} 80v44`} stroke={active ? profile.color : "#075985"} strokeWidth="4" strokeLinecap="round" />
              </g>
            )}
            {key === "trade" && (
              <g>
                <path d={`M${profile.x - 20} 95h36l-8-8M${profile.x + 20} 112h-36l8 8`} fill="none" stroke={active ? "#ffffff" : profile.color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx={profile.x - 21} cy="115" r="5" fill={active ? "#ffffff" : profile.wash} />
                <circle cx={profile.x + 21} cy="92" r="5" fill={active ? "#ffffff" : profile.wash} />
              </g>
            )}
            <text x={profile.x} y="60" textAnchor="middle" fontSize="13" fontWeight="900" fill={active ? "#0f172a" : "#64748b"}>{profile.label}</text>
          </g>
        );
      })}
      <rect x="44" y="24" width="116" height="28" rx="14" fill="#ffffff" stroke="#bbf7d0" />
      <text x="102" y="43" textAnchor="middle" fontSize="12" fontWeight="900" fill="#047857">{activeProfile.label} 판단</text>
      <rect x="206" y="24" width="110" height="28" rx="14" fill="#ffffff" stroke="#dbeafe" />
      <text x="261" y="43" textAnchor="middle" fontSize="12" fontWeight="900" fill="#1e3a8a">근거 {items.length}개</text>
      <rect x="60" y="166" width="260" height="24" rx="12" fill="#ffffff" stroke="#e2e8f0" />
      <text x="190" y="182" textAnchor="middle" fontSize="11" fontWeight="900" fill="#334155">선택값과 버튼 잠금 이유를 먼저 확인</text>
    </svg>
  );
};

const CatanActionAtlasPanel = ({ title = "", detail = "", activeKey = "build", items = [] }) => (
  <section data-smoke="catan-action-atlas-panel" className="mb-3 overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-3 shadow-sm sm:rounded-[1.5rem]">
    <div className="grid gap-3">
      <CatanActionAtlasArt activeKey={activeKey} items={items} />
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-xs font-black text-emerald-600">액션 아틀라스</div>
            <div className="mt-1 text-base font-black text-slate-950">{title}</div>
            <div className="mt-1 text-xs font-bold leading-relaxed text-slate-600">{detail}</div>
          </div>
          <span className="rounded-full border border-emerald-100 bg-white px-3 py-1 text-[11px] font-black text-emerald-700">
            {items.filter((item) => item.ready).length}/{items.length} 준비
          </span>
        </div>
        <div className="mt-3 grid gap-2">
          {items.map((item) => (
            <div key={item.key} data-smoke="catan-action-atlas-item" className={`rounded-xl border px-3 py-2 ${item.ready ? "border-emerald-100 bg-white" : "border-slate-100 bg-slate-50"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[10px] font-black text-slate-400">{item.label}</div>
                  <div className="mt-0.5 text-sm font-black leading-snug text-slate-900">{item.value}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${item.ready ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                  {item.ready ? "준비" : "잠금"}
                </span>
              </div>
              <div className="mt-1 text-[11px] font-bold leading-snug text-slate-500">{item.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

const buildCatanActionRouteItems = ({
  phase = "SETUP",
  phaseLabel = "",
  myTurn = false,
  activeName = "",
  lastRoll = null,
  mustDiscard = false,
  discardTotal = 0,
  discardRequired = 0,
  myGoldChoice = null,
  goldRequired = 0,
  myAqueductChoice = null,
  catanBuildTargetReady = false,
  catanRobberTargetReady = false,
  hasSelectedTarget = false,
  buildMode = "",
  catanBuildTargetKind = "",
  selectedBuildActionDisabled = false,
  canMaritimeTrade = false,
  canBuyDevelopmentCard = false,
  actionProgressCount = 0,
  pendingDomesticTrade = false,
  catanTradeSummary = "",
  catanTurnGuidance = "",
  winnerSeatNo = 0,
  winnerVictoryPoints = 0,
  winningPoints = 10,
}) => {
  const normalizedPhase = String(phase || "SETUP");
  const activePlayerLabel = activeName || "상대";
  const specialTurnReady = Boolean(mustDiscard || myGoldChoice || myAqueductChoice);
  const actionSupportReady = Boolean(canMaritimeTrade || canBuyDevelopmentCard || actionProgressCount > 0 || pendingDomesticTrade);
  const targetReady = normalizedPhase === "ROBBER" ? catanRobberTargetReady : catanBuildTargetReady || hasSelectedTarget;
  const mainReady = (() => {
    if (normalizedPhase === "FINISHED") return Boolean(winnerSeatNo);
    if (normalizedPhase === "ROLL") return myTurn;
    if (normalizedPhase === "DISCARD") return mustDiscard && Number(discardRequired) > 0 && Number(discardTotal) === Number(discardRequired);
    if (normalizedPhase === "GOLD_CHOICE") return Boolean(myGoldChoice);
    if (normalizedPhase === "AQUEDUCT_CHOICE") return Boolean(myAqueductChoice);
    if (normalizedPhase === "ROBBER") return myTurn && catanRobberTargetReady;
    if (normalizedPhase === "SETUP") return myTurn && catanBuildTargetReady;
    if (normalizedPhase === "ACTION") return myTurn && (actionSupportReady || (catanBuildTargetReady && !selectedBuildActionDisabled));
    return myTurn || specialTurnReady;
  })();

  const stateValue = (() => {
    if (normalizedPhase === "FINISHED") return winnerSeatNo ? `승자 확정 ${winnerVictoryPoints}/${winningPoints}점` : "결과 확정";
    if (normalizedPhase === "ROLL") return lastRoll ? `최근 주사위 ${lastRoll}` : "주사위 대기";
    if (normalizedPhase === "DISCARD") return mustDiscard ? `${discardTotal}/${discardRequired}장 버리기` : "버리기 대기";
    if (normalizedPhase === "GOLD_CHOICE") return myGoldChoice ? `${goldRequired}장 선택` : "금광 보상 대기";
    if (normalizedPhase === "AQUEDUCT_CHOICE") return myAqueductChoice ? "수로 보상 선택" : "수로 보상 대기";
    if (normalizedPhase === "ROBBER") return "도적/해적 이동";
    if (normalizedPhase === "ACTION") return myTurn ? "내 행동 단계" : `${activePlayerLabel} 행동`;
    if (normalizedPhase === "SETUP") return "초기 배치";
    return phaseLabel || normalizedPhase;
  })();

  const targetValue = (() => {
    if (normalizedPhase === "FINISHED") return "결과 확인";
    if (normalizedPhase === "DISCARD") return mustDiscard ? "버릴 카드 수 입력" : "다른 플레이어 대기";
    if (normalizedPhase === "GOLD_CHOICE") return myGoldChoice ? "받을 자원 입력" : "선택 순서 대기";
    if (normalizedPhase === "AQUEDUCT_CHOICE") return myAqueductChoice ? "수로 자원 선택" : "선택 순서 대기";
    if (normalizedPhase === "ROBBER") return catanRobberTargetReady ? "대상 타일 선택 완료" : "타일 선택 필요";
    if (normalizedPhase === "SETUP") return catanBuildTargetReady ? "정점+간선 선택 완료" : "정점과 간선 선택";
    if (normalizedPhase === "ACTION") {
      if (catanBuildTargetReady) return `${catanBuildTargetKind || "대상"} 선택 완료`;
      if (hasSelectedTarget) return "선택값 확인";
      return `${catanBuildTargetKind || catanBuildModeLabels[buildMode] || "건설 대상"} 선택`;
    }
    return hasSelectedTarget ? "선택 완료" : "선택 대기";
  })();

  const mainValue = (() => {
    if (normalizedPhase === "FINISHED") return "승리 근거 검토";
    if (normalizedPhase === "ROLL") return "주사위 굴리기";
    if (normalizedPhase === "DISCARD") return mustDiscard ? "버리기 제출" : "대기";
    if (normalizedPhase === "GOLD_CHOICE") return "자원 받기";
    if (normalizedPhase === "AQUEDUCT_CHOICE") return "자원 받기";
    if (normalizedPhase === "ROBBER") return catanRobberTargetReady ? "이동 실행" : "대상 필요";
    if (normalizedPhase === "SETUP") return catanBuildTargetReady ? "초기 배치 실행" : "배치 대상 필요";
    if (normalizedPhase === "ACTION") {
      if (pendingDomesticTrade) return "거래 응답";
      if (catanBuildTargetReady) return selectedBuildActionDisabled ? "조건 확인" : `${catanBuildModeLabels[buildMode] || "건설"} 실행`;
      if (canMaritimeTrade) return "해상 교환";
      if (canBuyDevelopmentCard) return "개발 카드 구매";
      if (actionProgressCount > 0) return `진행 카드 ${actionProgressCount}장`;
      if (selectedBuildActionDisabled) return "조건 확인";
      return "건설/교환 선택";
    }
    return phaseLabel || "단계 처리";
  })();

  const finishValue = (() => {
    if (normalizedPhase === "FINISHED") return "게임 종료";
    if (normalizedPhase === "ACTION") {
      if (pendingDomesticTrade) return "거래 처리 후 종료";
      return myTurn ? "행동 후 종료" : "상대 턴 대기";
    }
    if (normalizedPhase === "ROLL") return "행동 단계로 이동";
    if (normalizedPhase === "SETUP") return "다음 배치 순서";
    if (["DISCARD", "GOLD_CHOICE", "AQUEDUCT_CHOICE", "ROBBER"].includes(normalizedPhase)) return "처리 후 계속";
    return "다음 단계";
  })();

  return [
    {
      key: "state",
      label: "상태 확인",
      value: stateValue,
      ready: myTurn || specialTurnReady || normalizedPhase === "FINISHED",
      detail: catanTurnGuidance || "현재 단계와 차례 권한을 확인한 뒤 다음 버튼으로 이동합니다.",
    },
    {
      key: "target",
      label: "보드 대상",
      value: targetValue,
      ready: targetReady || ["DISCARD", "GOLD_CHOICE", "AQUEDUCT_CHOICE", "FINISHED"].includes(normalizedPhase),
      detail: normalizedPhase === "ROBBER"
        ? "선택한 타일과 약탈 후보가 도적/해적 이동 버튼의 근거가 됩니다."
        : "보드 클릭이나 입력값이 실제 실행 버튼의 근거가 됩니다.",
    },
    {
      key: "main",
      label: "실행 버튼",
      value: mainValue,
      ready: mainReady,
      detail: normalizedPhase === "ACTION"
        ? "건설, 교환, 카드 버튼은 기존 조건을 그대로 읽어 가능한 행동만 강조합니다."
        : "필요한 선택값이 채워지면 현재 단계의 제출 버튼으로 이어집니다.",
    },
    {
      key: "finish",
      label: "턴 종료",
      value: finishValue,
      ready: normalizedPhase === "FINISHED" || (normalizedPhase === "ACTION" && myTurn),
      detail: normalizedPhase === "ACTION"
        ? (actionSupportReady ? `${catanTradeSummary || "교환/카드 선택"}도 확인한 뒤 턴 종료로 넘깁니다.` : "할 일을 마치면 턴 종료 버튼으로 다음 차례를 넘깁니다.")
        : "현재 특수 처리가 끝나면 서버의 다음 단계 흐름을 그대로 따릅니다.",
    },
  ];
};

const CatanActionRouteArt = ({ items = [] }) => {
  const routeItems = items.length ? items : [
    { key: "state", label: "상태", ready: false },
    { key: "target", label: "대상", ready: false },
    { key: "main", label: "실행", ready: false },
    { key: "finish", label: "종료", ready: false },
  ];
  const activeIndex = Math.max(0, routeItems.findIndex((item) => !item.ready));
  const nodes = routeItems.map((item, index) => ({
    ...item,
    x: 54 + index * 92,
    active: index === activeIndex,
  }));

  return (
    <svg data-smoke="catan-action-route-art" viewBox="0 0 380 170" role="img" aria-label="카탄 액션 루트" className="h-auto w-full">
      <rect x="8" y="10" width="364" height="150" rx="18" fill="#f8fafc" stroke="#bae6fd" strokeWidth="2" />
      <path d="M48 112C92 58 132 58 168 112S248 164 324 74" fill="none" stroke="#7dd3fc" strokeWidth="9" strokeLinecap="round" />
      <path d="M48 112C92 58 132 58 168 112S248 164 324 74" fill="none" stroke="#0f766e" strokeWidth="3" strokeLinecap="round" />
      {nodes.map((item, index) => (
        <g key={item.key} data-smoke="catan-action-route-node" data-route-key={item.key}>
          {index < nodes.length - 1 && (
            <path d={`M${item.x + 32} 82H${nodes[index + 1].x - 32}`} stroke={item.ready ? "#0f766e" : "#cbd5e1"} strokeWidth="4" strokeLinecap="round" />
          )}
          <rect x={item.x - 34} y={item.active ? 48 : 54} width="68" height="58" rx="14" fill={item.ready ? "#ccfbf1" : "#ffffff"} stroke={item.active ? "#0f766e" : item.ready ? "#14b8a6" : "#cbd5e1"} strokeWidth={item.active ? "3" : "2"} />
          <circle cx={item.x} cy={item.active ? 66 : 72} r="13" fill={item.ready ? "#0f766e" : "#e2e8f0"} />
          <text x={item.x} y={item.active ? 70 : 76} textAnchor="middle" fontSize="12" fontWeight="900" fill={item.ready ? "#ffffff" : "#475569"}>{index + 1}</text>
          <text x={item.x} y={item.active ? 98 : 104} textAnchor="middle" fontSize="11" fontWeight="900" fill="#0f172a">{item.label}</text>
        </g>
      ))}
      <rect x="28" y="20" width="124" height="26" rx="13" fill="#ffffff" stroke="#bae6fd" />
      <text x="90" y="37" textAnchor="middle" fontSize="12" fontWeight="900" fill="#0369a1">카탄 액션 루트</text>
      <rect x="208" y="130" width="126" height="24" rx="12" fill="#ffffff" stroke="#99f6e4" />
      <text x="271" y="146" textAnchor="middle" fontSize="11" fontWeight="900" fill="#0f766e">버튼 조건은 그대로 유지</text>
    </svg>
  );
};

const CatanActionRoutePanel = ({
  phase = "SETUP",
  myTurn = false,
  buildMode = "",
  targetReady = false,
  canMaritimeTrade = false,
  canBuyDevelopmentCard = false,
  actionProgressCount = 0,
  items = [],
}) => (
  <section
    data-smoke="catan-action-route-panel"
    data-phase={phase}
    data-my-turn={myTurn ? "true" : "false"}
    data-build-mode={buildMode || "none"}
    data-target-ready={targetReady ? "true" : "false"}
    data-can-trade={canMaritimeTrade ? "true" : "false"}
    data-can-development={canBuyDevelopmentCard ? "true" : "false"}
    data-action-count={String(actionProgressCount)}
    className="mb-3 overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-teal-50 p-3 shadow-sm sm:rounded-[1.5rem]"
  >
    <div className="grid gap-3">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-xs font-black text-sky-700">카탄 액션 루트</div>
            <div className="mt-1 text-base font-black text-slate-950">상태 확인 → 보드 대상 → 실행 버튼 → 턴 종료</div>
            <div className="mt-1 text-xs font-bold leading-relaxed text-slate-600">현재 단계에서 실제 버튼까지 이어지는 순서만 보여주는 읽기 전용 안내입니다.</div>
          </div>
          <span className="rounded-full border border-sky-100 bg-white px-3 py-1 text-[11px] font-black text-sky-700">
            {items.filter((item) => item.ready).length}/{items.length} 준비
          </span>
        </div>
        <div data-smoke="catan-action-route-art" className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-black text-slate-600">
          {items.map((item) => (
            <span key={`route-chip-${item.key}`} data-smoke="catan-action-route-node" data-route-key={item.key} className={`rounded-full px-2.5 py-1 ${item.ready ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-500"}`}>
              {item.label}: {item.value}
            </span>
          ))}
        </div>
        <div className="mt-3 grid gap-2">
          {items.map((item) => (
            <div key={item.key} data-smoke="catan-action-route-item" data-route-key={item.key} className={`rounded-xl border px-3 py-2 ${item.ready ? "border-teal-100 bg-white" : "border-slate-100 bg-slate-50"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[10px] font-black text-slate-400">{item.label}</div>
                  <div className="mt-0.5 text-sm font-black leading-snug text-slate-900">{item.value}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${item.ready ? "bg-teal-100 text-teal-700" : "bg-slate-200 text-slate-600"}`}>
                  {item.ready ? "준비" : "확인"}
                </span>
              </div>
              <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-snug text-slate-500">{item.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

const catanResourceByTerrain = {
  HILL: "BRICK",
  FOREST: "LUMBER",
  PASTURE: "WOOL",
  FIELD: "GRAIN",
  MOUNTAIN: "ORE",
};

const catanCommodityLabels = {
  PAPER: "종이",
  CLOTH: "직물",
  COIN: "동전",
};

const catanCargoLabels = {
  SETTLER: "정착민",
  FISH: "물고기",
  SPICE: "향신료",
  CREW: "승무원",
  OLD_BOOT: "낡은 장화",
};

const catanMissionLabels = {
  FISH: "어장",
  SPICE: "향신료 마을",
  PIRATE_LAIR: "해적 소굴",
};

const catanSpiceAdvantageLabels = {
  SWIFT_VOYAGE: "빠른 항해",
  PIRATE_BONUS: "해적 보너스",
  FAST_GOLD: "빠른 금",
  SUCCESS: "성공",
  MISS: "실패",
};

const catanSpiceAdvantageShortLabels = {
  SWIFT_VOYAGE: "항해",
  PIRATE_BONUS: "해적",
  FAST_GOLD: "금",
};

const catanImprovementLabels = {
  SCIENCE: "과학",
  TRADE: "상업",
  POLITICS: "정치",
};

const catanDevelopmentLabels = {
  ANY: "3:1 항구",
  DEVELOPMENT_CARD: "개발 카드",
  KNIGHT: "기사",
  VICTORY_POINT: "승점",
  ROAD_BUILDING: "도로 건설",
  YEAR_OF_PLENTY: "풍년",
  MONOPOLY: "독점",
};

const catanBuildingLabels = {
  SETTLEMENT: "마을",
  CITY: "도시",
  HARBOR_SETTLEMENT: "항구 정착지",
};

const catanRouteLabels = {
  ROAD: "도로",
  SHIP: "배",
  BRIDGE: "다리",
};

const catanBuildModeLabels = {
  ROAD: "도로",
  BRIDGE: "다리",
  SHIP: "배",
  MOVE_SHIP: "배 이동",
  KNIGHT: "기사",
  CITY_WALL: "성벽",
  SETTLEMENT: "마을",
  CITY: "도시",
  HARBOR_SETTLEMENT: "항구 정착지",
};

const catanProgressLabels = {
  ALCHEMIST: "연금술사",
  CRANE: "기중기",
  ENGINEER: "기술자",
  INVENTOR: "발명가",
  IRRIGATION: "관개",
  MEDICINE: "의학",
  MINING: "채광",
  PRINTER: "인쇄술",
  ROAD_BUILDING: "도로 건설",
  SMITH: "대장장이",
  COMMERCIAL_HARBOR: "상업 항구",
  MASTER_MERCHANT: "대상인",
  MERCHANT: "상인",
  MERCHANT_FLEET: "상선단",
  RESOURCE_MONOPOLY: "자원 독점",
  TRADE_MONOPOLY: "상품 독점",
  BISHOP: "주교",
  CONSTITUTION: "헌법",
  DESERTER: "탈영병",
  DIPLOMAT: "외교관",
  INTRIGUE: "음모",
  SABOTEUR: "파괴 공작",
  SPY: "첩자",
  WARLORD: "장군",
  WEDDING: "혼례",
};

const catanProgressVictoryTypes = new Set(["PRINTER", "CONSTITUTION"]);

const catanEventDieLabels = {
  BARBARIAN_SHIP: "야만인선",
  SCIENCE: "과학",
  TRADE: "상업",
  POLITICS: "정치",
  FRIENDLY_ROBBER_DESERT: "친절한 도둑 사막 이동",
};

const playableProgressTypes = new Set([
  "ALCHEMIST",
  "CRANE",
  "ENGINEER",
  "INVENTOR",
  "IRRIGATION",
  "MEDICINE",
  "MINING",
  "ROAD_BUILDING",
  "SMITH",
  "WARLORD",
  "RESOURCE_MONOPOLY",
  "TRADE_MONOPOLY",
  "BISHOP",
  "COMMERCIAL_HARBOR",
  "DESERTER",
  "DIPLOMAT",
  "INTRIGUE",
  "MASTER_MERCHANT",
  "MERCHANT",
  "MERCHANT_FLEET",
  "SPY",
  "SABOTEUR",
  "WEDDING",
]);

const catanProgressTimingLabel = (cardType) => {
  if (catanProgressVictoryTypes.has(cardType)) return "자동 승점";
  if (cardType === "ALCHEMIST") return "주사위 전";
  if (playableProgressTypes.has(cardType)) return "행동 단계";
  return "상태 확인";
};

const catanProgressTimingClass = (cardType) => {
  if (catanProgressVictoryTypes.has(cardType)) return "bg-amber-50 text-amber-700";
  if (cardType === "ALCHEMIST") return "bg-emerald-50 text-emerald-700";
  if (playableProgressTypes.has(cardType)) return "bg-white text-slate-700";
  return "bg-slate-100 text-slate-500";
};

const catanProgressDiscardTone = (status = "waiting") => {
  if (status === "ready") return "border-fuchsia-100 bg-fuchsia-50 text-fuchsia-950";
  if (status === "protected") return "border-amber-100 bg-amber-50 text-amber-950";
  if (status === "active") return "border-violet-100 bg-violet-50 text-violet-950";
  return "border-slate-100 bg-slate-50 text-slate-900";
};

const buildCatanProgressDiscardPlannerItems = ({
  nonVictoryCards = [],
  progressCards = [],
  selectedCardId = "",
  discardRequired = 0,
  mustDiscardProgress = false,
  pendingNames = [],
} = {}) => {
  const safeNonVictoryCards = listOf(nonVictoryCards);
  const safeProgressCards = listOf(progressCards);
  const required = Math.max(0, Number(discardRequired) || 0);
  const victoryCards = safeProgressCards.filter((card) => catanProgressVictoryTypes.has(get(card, "type", "type", "")));
  const selectedCard = safeNonVictoryCards.find((card) => String(card.id) === String(selectedCardId)) || safeNonVictoryCards[0] || null;
  const selectedType = get(selectedCard, "type", "type", "");
  const waitText = pendingNames.length ? pendingNames.join(" · ") : "대기 없음";

  return [
    {
      key: "limit",
      label: "보유 한도",
      value: `비승점 ${safeNonVictoryCards.length}/4장`,
      detail: required > 0 ? `${required}장을 버리면 진행 카드 한도 안으로 돌아갑니다.` : "현재 진행 카드 한도 안에 있습니다.",
      status: required > 0 ? "active" : "ready",
    },
    {
      key: "selection",
      label: "버릴 카드",
      value: selectedCard ? (catanProgressLabels[selectedType] || selectedType || "선택 카드") : "선택 필요",
      detail: mustDiscardProgress ? "아래 선택 상자의 카드가 그대로 제출됩니다." : `${waitText} 플레이어의 선택을 기다립니다.`,
      status: mustDiscardProgress && selectedCard ? "ready" : "waiting",
    },
    {
      key: "excluded",
      label: "제외 카드",
      value: `자동 승점 ${victoryCards.length}장`,
      detail: "인쇄술과 헌법 같은 승점 진행 카드는 버리기 후보에서 제외됩니다.",
      status: victoryCards.length ? "protected" : "waiting",
    },
    {
      key: "next",
      label: "다음 처리",
      value: mustDiscardProgress ? "카드 제출" : "대기",
      detail: "대상자가 초과 카드를 버리면 서버가 다음 카탄 단계로 진행합니다.",
      status: mustDiscardProgress ? "active" : "waiting",
    },
  ];
};

const CatanProgressDiscardPlannerArt = ({ items = [], selectedCardId = "", discardRequired = 0, nonVictoryCount = 0, mustDiscardProgress = false }) => {
  const required = Math.max(0, Number(discardRequired) || 0);
  const accent = mustDiscardProgress ? "#a21caf" : "#64748b";
  const progress = Math.max(0.08, Math.min(1, Number(nonVictoryCount || 0) / Math.max(4, Number(nonVictoryCount || 0))));
  const nodes = [
    { key: "limit", x: 72, y: 124 },
    { key: "selection", x: 204, y: 72 },
    { key: "excluded", x: 344, y: 124 },
    { key: "next", x: 486, y: 72 },
  ];

  return (
    <svg
      data-smoke="catan-progress-discard-planner-art"
      viewBox="0 0 560 210"
      className="h-auto w-full"
      role="img"
      aria-label={`카탄 진행 카드 버리기 ${required}장`}
      focusable="false"
    >
      <rect x="10" y="10" width="540" height="190" rx="24" fill="#fdf4ff" stroke={accent} strokeWidth="3" />
      <path d="M70 124C139 42 214 45 282 104c73 64 143 58 204-32" fill="none" stroke="#f5d0fe" strokeWidth="18" strokeLinecap="round" />
      <path d="M70 124C139 42 214 45 282 104c73 64 143 58 204-32" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" />
      <text x="32" y="42" fontSize="13" fontWeight="900" fill="#701a75">진행 카드 한도 정리</text>
      <rect x="32" y="160" width="496" height="18" rx="9" fill="#fae8ff" stroke="#e879f9" strokeWidth="2" />
      <rect x="32" y="160" width={496 * progress} height="18" rx="9" fill={accent} opacity=".82" />
      <text x="280" y="174" textAnchor="middle" fontSize="11" fontWeight="900" fill="#ffffff">비승점 {nonVictoryCount}장 · 버리기 {required}장</text>
      {nodes.map((node, index) => {
        const item = items.find((candidate) => candidate.key === node.key) || {};
        const nodeFill = item.status === "ready" ? "#f0fdf4" : item.status === "protected" ? "#fef3c7" : item.status === "active" ? "#fae8ff" : "#f8fafc";
        const nodeStroke = item.status === "ready" ? "#16a34a" : item.status === "protected" ? "#d97706" : item.status === "active" ? "#a21caf" : "#94a3b8";
        return (
          <g key={node.key} data-smoke="catan-progress-discard-planner-node" data-progress-key={node.key}>
            <circle cx={node.x} cy={node.y} r="28" fill={nodeFill} stroke={nodeStroke} strokeWidth="5" />
            <text x={node.x} y={node.y + 5} textAnchor="middle" fontSize="14" fontWeight="900" fill="#0f172a">{index + 1}</text>
            <text x={node.x} y={node.y + 45} textAnchor="middle" fontSize="10" fontWeight="900" fill="#581c87">{item.label || node.key}</text>
          </g>
        );
      })}
      {selectedCardId && (
        <text x="528" y="42" textAnchor="end" fontSize="10" fontWeight="900" fill="#86198f">선택 {selectedCardId}</text>
      )}
    </svg>
  );
};

const CatanProgressDiscardPlannerPanel = ({
  progressCards = [],
  nonVictoryCards = [],
  selectedCardId = "",
  discardRequired = 0,
  mustDiscardProgress = false,
  pendingNames = [],
}) => {
  const safeNonVictoryCards = listOf(nonVictoryCards);
  const items = buildCatanProgressDiscardPlannerItems({
    nonVictoryCards: safeNonVictoryCards,
    progressCards,
    selectedCardId,
    discardRequired,
    mustDiscardProgress,
    pendingNames,
  });

  return (
    <section
      data-smoke="catan-progress-discard-planner-panel"
      data-must-discard-progress={mustDiscardProgress ? "true" : "false"}
      data-progress-discard-required={Math.max(0, Number(discardRequired) || 0)}
      data-non-victory-count={safeNonVictoryCards.length}
      data-selected-card-id={selectedCardId || ""}
      className="rounded-2xl border border-fuchsia-200 bg-white p-3 shadow-lg"
    >
      <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
        <CatanProgressDiscardPlannerArt
          items={items}
          selectedCardId={selectedCardId}
          discardRequired={discardRequired}
          nonVictoryCount={safeNonVictoryCards.length}
          mustDiscardProgress={mustDiscardProgress}
        />
        <div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-xs font-black text-fuchsia-700">진행 카드 버리기 플래너</div>
              <div className="mt-1 text-lg font-black text-slate-950">4장 한도 안으로 정리</div>
              <div className="mt-1 text-xs font-bold leading-relaxed text-slate-600">
                승점 진행 카드는 제외하고, 실제 버릴 후보와 선택된 카드를 제출 전에 다시 보여줍니다.
              </div>
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-black ${mustDiscardProgress ? "bg-fuchsia-100 text-fuchsia-800" : "bg-slate-100 text-slate-600"}`}>
              {mustDiscardProgress ? "내가 버릴 차례" : "다른 플레이어 대기"}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <div
                key={item.key}
                data-smoke="catan-progress-discard-planner-item"
                data-progress-key={item.key}
                className={`min-h-[92px] rounded-xl border px-3 py-2 ${catanProgressDiscardTone(item.status)}`}
              >
                <div className="text-[10px] font-black opacity-70">{item.label}</div>
                <div className="mt-0.5 line-clamp-2 text-sm font-black leading-snug">{item.value}</div>
                <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-snug opacity-75">{item.detail}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {safeNonVictoryCards.slice(0, 8).map((card) => {
              const cardType = get(card, "type", "type", "");
              const selected = String(card.id) === String(selectedCardId);
              return (
                <span
                  key={card.id}
                  data-smoke="catan-progress-discard-planner-chip"
                  data-card-id={card.id}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-black ${selected ? "bg-fuchsia-100 text-fuchsia-800" : "bg-slate-100 text-slate-500"}`}
                >
                  {catanProgressLabels[cardType] || cardType}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

const catanDomesticTradeReviewTone = (status = "waiting") => {
  if (status === "ready") return "border-emerald-100 bg-emerald-50 text-emerald-950";
  if (status === "warning") return "border-amber-100 bg-amber-50 text-amber-950";
  if (status === "mine") return "border-sky-100 bg-sky-50 text-sky-950";
  return "border-slate-100 bg-slate-50 text-slate-900";
};

const catanTradeBundleRows = (values = {}) => catanResourceKeys
  .map((key) => ({
    key,
    label: catanResourceLabels[key] || key,
    count: Math.max(0, Number(values?.[key] || 0)),
  }))
  .filter((row) => row.count > 0);

const catanTradeBundleText = (values = {}) => {
  const rows = catanTradeBundleRows(values);
  return rows.length ? rows.map((row) => `${row.label} ${row.count}`).join(" · ") : "없음";
};

const buildCatanDomesticTradeReviewItems = ({
  offer = {},
  request = {},
  proposerName = "",
  targetName = "",
  proposerSeatNo = 0,
  targetSeatNo = 0,
  mySeatNo = 0,
  resources = {},
} = {}) => {
  const offerRows = catanTradeBundleRows(offer);
  const requestRows = catanTradeBundleRows(request);
  const offerTotal = offerRows.reduce((sum, row) => sum + row.count, 0);
  const requestTotal = requestRows.reduce((sum, row) => sum + row.count, 0);
  const isTarget = Number(targetSeatNo) === Number(mySeatNo);
  const isProposer = Number(proposerSeatNo) === Number(mySeatNo);
  const canPayRequest = requestRows.every((row) => Number(resources?.[row.key] || 0) >= row.count);
  const roleValue = isTarget ? "응답자" : isProposer ? "제안자" : "관전";
  const decisionValue = isTarget ? "수락 또는 거절" : isProposer ? "제안 취소 가능" : "결과 대기";

  return [
    {
      key: "route",
      label: "거래 주체",
      value: `${proposerName || "제안자"} → ${targetName || "응답자"}`,
      detail: `내 위치: ${roleValue}`,
      status: isTarget ? "ready" : isProposer ? "mine" : "waiting",
    },
    {
      key: "offer",
      label: "상대가 주는 것",
      value: catanTradeBundleText(offer),
      detail: `제공 묶음 ${offerTotal}장`,
      status: offerTotal > 0 ? "ready" : "waiting",
    },
    {
      key: "request",
      label: isTarget ? "내가 주는 것" : "요청 묶음",
      value: catanTradeBundleText(request),
      detail: isTarget
        ? canPayRequest ? "보유 자원으로 수락할 수 있는 요청입니다." : "요청 자원이 부족하면 수락이 실패할 수 있습니다."
        : `요청 묶음 ${requestTotal}장`,
      status: isTarget && !canPayRequest ? "warning" : requestTotal > 0 ? "ready" : "waiting",
    },
    {
      key: "decision",
      label: "응답 선택",
      value: decisionValue,
      detail: isTarget ? "수락하면 제공/요청 묶음이 서버에서 교환됩니다." : isProposer ? "상대 응답 전까지 제안을 취소할 수 있습니다." : "해당 플레이어의 응답을 기다립니다.",
      status: isTarget ? "ready" : isProposer ? "mine" : "waiting",
    },
  ];
};

const CatanDomesticTradeReviewArt = ({ items = [], offer = {}, request = {}, myRole = "waiting" }) => {
  const offerTotal = catanTradeBundleRows(offer).reduce((sum, row) => sum + row.count, 0);
  const requestTotal = catanTradeBundleRows(request).reduce((sum, row) => sum + row.count, 0);
  const accent = myRole === "target" ? "#059669" : myRole === "proposer" ? "#0284c7" : "#64748b";
  const nodes = [
    { key: "route", x: 74, y: 122 },
    { key: "offer", x: 206, y: 74 },
    { key: "request", x: 346, y: 122 },
    { key: "decision", x: 486, y: 74 },
  ];

  return (
    <svg
      data-smoke="catan-domestic-trade-review-art"
      viewBox="0 0 560 210"
      className="h-auto w-full"
      role="img"
      aria-label={`카탄 거래 제안 제공 ${offerTotal}장 요청 ${requestTotal}장`}
      focusable="false"
    >
      <rect x="10" y="10" width="540" height="190" rx="24" fill="#ecfdf5" stroke={accent} strokeWidth="3" />
      <path d="M72 122C124 58 184 44 252 86c76 47 135 54 226-22" fill="none" stroke="#bbf7d0" strokeWidth="18" strokeLinecap="round" />
      <path d="M72 122C124 58 184 44 252 86c76 47 135 54 226-22" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" />
      <text x="32" y="42" fontSize="13" fontWeight="900" fill="#064e3b">거래 제안 해석</text>
      <rect x="54" y="160" width="210" height="18" rx="9" fill="#d1fae5" stroke="#34d399" strokeWidth="2" />
      <rect x="318" y="160" width="176" height="18" rx="9" fill="#dbeafe" stroke="#38bdf8" strokeWidth="2" />
      <text x="159" y="174" textAnchor="middle" fontSize="11" fontWeight="900" fill="#065f46">제공 {offerTotal}장</text>
      <text x="406" y="174" textAnchor="middle" fontSize="11" fontWeight="900" fill="#075985">요청 {requestTotal}장</text>
      {nodes.map((node, index) => {
        const item = items.find((candidate) => candidate.key === node.key) || {};
        const nodeFill = item.status === "ready" ? "#dcfce7" : item.status === "warning" ? "#fef3c7" : item.status === "mine" ? "#e0f2fe" : "#f8fafc";
        const nodeStroke = item.status === "ready" ? "#16a34a" : item.status === "warning" ? "#d97706" : item.status === "mine" ? "#0284c7" : "#94a3b8";
        return (
          <g key={node.key} data-smoke="catan-domestic-trade-review-node" data-trade-key={node.key}>
            <circle cx={node.x} cy={node.y} r="28" fill={nodeFill} stroke={nodeStroke} strokeWidth="5" />
            <text x={node.x} y={node.y + 5} textAnchor="middle" fontSize="14" fontWeight="900" fill="#0f172a">{index + 1}</text>
            <text x={node.x} y={node.y + 45} textAnchor="middle" fontSize="10" fontWeight="900" fill="#064e3b">{item.label || node.key}</text>
          </g>
        );
      })}
    </svg>
  );
};

const CatanDomesticTradeReviewPanel = ({
  offer = {},
  request = {},
  proposerName = "",
  targetName = "",
  proposerSeatNo = 0,
  targetSeatNo = 0,
  mySeatNo = 0,
  resources = {},
}) => {
  const myRole = Number(targetSeatNo) === Number(mySeatNo)
    ? "target"
    : Number(proposerSeatNo) === Number(mySeatNo)
      ? "proposer"
      : "waiting";
  const items = buildCatanDomesticTradeReviewItems({
    offer,
    request,
    proposerName,
    targetName,
    proposerSeatNo,
    targetSeatNo,
    mySeatNo,
    resources,
  });

  return (
    <section
      data-smoke="catan-domestic-trade-review-panel"
      data-trade-role={myRole}
      data-offer-total={catanTradeBundleRows(offer).reduce((sum, row) => sum + row.count, 0)}
      data-request-total={catanTradeBundleRows(request).reduce((sum, row) => sum + row.count, 0)}
      className="rounded-2xl border border-emerald-200 bg-white p-3 shadow-lg"
    >
      <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
        <CatanDomesticTradeReviewArt items={items} offer={offer} request={request} myRole={myRole} />
        <div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-xs font-black text-emerald-700">거래 제안 해석</div>
              <div className="mt-1 text-lg font-black text-slate-950">무엇을 주고 무엇을 받는지</div>
              <div className="mt-1 text-xs font-bold leading-relaxed text-slate-600">
                현재 제안의 제공/요청 묶음과 내가 눌러야 할 실제 버튼을 응답 전에 정리합니다.
              </div>
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-black ${myRole === "target" ? "bg-emerald-100 text-emerald-800" : myRole === "proposer" ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-600"}`}>
              {myRole === "target" ? "응답 필요" : myRole === "proposer" ? "내 제안" : "응답 대기"}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <div
                key={item.key}
                data-smoke="catan-domestic-trade-review-item"
                data-trade-key={item.key}
                className={`min-h-[92px] rounded-xl border px-3 py-2 ${catanDomesticTradeReviewTone(item.status)}`}
              >
                <div className="text-[10px] font-black opacity-70">{item.label}</div>
                <div className="mt-0.5 line-clamp-2 text-sm font-black leading-snug">{item.value}</div>
                <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-snug opacity-75">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const catanWeddingResponseTone = (status = "waiting") => {
  if (status === "ready") return "border-emerald-100 bg-emerald-50 text-emerald-950";
  if (status === "over") return "border-amber-100 bg-amber-50 text-amber-950";
  if (status === "active") return "border-pink-100 bg-pink-50 text-pink-950";
  return "border-slate-100 bg-slate-50 text-slate-900";
};

const catanWeddingSelectedRows = (resources = {}, commodities = {}) => [
  ...catanResourceKeys.map((key) => ({
    key,
    label: catanResourceLabels[key] || key,
    count: Math.max(0, Number(resources?.[key] || 0)),
    type: "resource",
  })),
  ...Object.entries(catanCommodityLabels).map(([key, label]) => ({
    key,
    label,
    count: Math.max(0, Number(commodities?.[key] || 0)),
    type: "commodity",
  })),
].filter((row) => row.count > 0);

const catanWeddingBundleRows = ({
  resources = {},
  commodities = {},
  resourceSelection = {},
  commoditySelection = {},
} = {}) => [
  ...catanResourceKeys.map((key) => ({
    key,
    label: catanResourceLabels[key] || key,
    held: Math.max(0, Number(resources?.[key] || 0)),
    selected: Math.max(0, Number(resourceSelection?.[key] || 0)),
    type: "resource",
  })),
  ...Object.entries(catanCommodityLabels).map(([key, label]) => ({
    key,
    label,
    held: Math.max(0, Number(commodities?.[key] || 0)),
    selected: Math.max(0, Number(commoditySelection?.[key] || 0)),
    type: "commodity",
  })),
].filter((row) => row.held > 0 || row.selected > 0);

const catanWeddingBundleText = (resources = {}, commodities = {}) => {
  const rows = catanWeddingSelectedRows(resources, commodities);
  return rows.length ? rows.map((row) => `${row.label} ${row.count}`).join(" · ") : "아직 선택 없음";
};

const buildCatanWeddingResponseItems = ({
  attackerName = "",
  mustRespondWedding = false,
  weddingRequired = 0,
  weddingTotal = 0,
  weddingResources = {},
  weddingCommodities = {},
  resources = {},
  commodities = {},
  pendingNames = [],
} = {}) => {
  const required = Math.max(0, Number(weddingRequired) || 0);
  const total = Math.max(0, Number(weddingTotal) || 0);
  const selectedRows = catanWeddingSelectedRows(weddingResources, weddingCommodities);
  const availableTotal = catanWeddingBundleRows({ resources, commodities }).reduce((sum, row) => sum + row.held, 0);
  const selectionStatus = !mustRespondWedding ? "waiting" : total === required ? "ready" : total > required ? "over" : "active";
  const pendingText = pendingNames.length ? pendingNames.join(" · ") : "대상 없음";

  return [
    {
      key: "trigger",
      label: "혼례 대상",
      value: attackerName ? `${attackerName}의 혼례` : "혼례 응답",
      detail: mustRespondWedding ? "내가 줄 카드 선택 대상입니다." : `응답 대기: ${pendingText}`,
      status: mustRespondWedding ? "active" : "waiting",
    },
    {
      key: "requirement",
      label: "필요 장수",
      value: mustRespondWedding ? `${required}장 정확히` : "다른 플레이어 대기",
      detail: mustRespondWedding ? `보유 ${availableTotal}장 기준으로 제출 장수를 맞춥니다.` : "대상 플레이어의 선택이 끝나면 다음 단계로 진행됩니다.",
      status: mustRespondWedding ? "active" : "waiting",
    },
    {
      key: "selection",
      label: "선택한 카드",
      value: `${total}/${required}장`,
      detail: !mustRespondWedding
        ? "현재는 내가 제출할 차례가 아닙니다."
        : total === required
          ? "제출 버튼을 누르기 전 구성만 마지막으로 확인하면 됩니다."
          : total > required
            ? "필요 장수보다 많이 골랐습니다."
            : "아직 필요한 장수보다 적게 골랐습니다.",
      status: selectionStatus,
    },
    {
      key: "composition",
      label: "선택 구성",
      value: catanWeddingBundleText(weddingResources, weddingCommodities),
      detail: selectedRows.length ? `자원/상품 합계 ${total}장` : "아래 입력에서 줄 자원이나 상품을 고릅니다.",
      status: selectedRows.length ? selectionStatus : "waiting",
    },
  ];
};

const CatanWeddingResponseArt = ({ items = [], weddingRequired = 0, weddingTotal = 0, mustRespondWedding = false }) => {
  const required = Math.max(0, Number(weddingRequired) || 0);
  const total = Math.max(0, Number(weddingTotal) || 0);
  const progress = required > 0 ? Math.min(1, total / required) : 0;
  const accent = !mustRespondWedding ? "#64748b" : total === required ? "#db2777" : total > required ? "#d97706" : "#ec4899";
  const nodes = [
    { key: "trigger", x: 72, y: 122 },
    { key: "requirement", x: 206, y: 74 },
    { key: "selection", x: 346, y: 122 },
    { key: "composition", x: 486, y: 74 },
  ];

  return (
    <svg
      data-smoke="catan-wedding-response-art"
      viewBox="0 0 560 210"
      className="h-auto w-full"
      role="img"
      aria-label={`카탄 혼례 응답 선택 ${total}장 필요 ${required}장`}
      focusable="false"
    >
      <rect x="10" y="10" width="540" height="190" rx="24" fill="#fdf2f8" stroke={accent} strokeWidth="3" />
      <path d="M70 122C128 46 190 48 250 92c70 52 140 58 232-24" fill="none" stroke="#fbcfe8" strokeWidth="18" strokeLinecap="round" />
      <path d="M70 122C128 46 190 48 250 92c70 52 140 58 232-24" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" />
      <text x="32" y="42" fontSize="13" fontWeight="900" fill="#831843">혼례 응답 경로</text>
      <rect x="34" y="160" width="492" height="18" rx="9" fill="#fce7f3" stroke="#f472b6" strokeWidth="2" />
      <rect x="34" y="160" width={492 * progress} height="18" rx="9" fill={accent} opacity=".84" />
      <text x="280" y="174" textAnchor="middle" fontSize="11" fontWeight="900" fill={progress > 0.38 ? "#ffffff" : "#831843"}>선택 {total}장 · 필요 {required}장</text>
      {nodes.map((node, index) => {
        const item = items.find((candidate) => candidate.key === node.key) || {};
        const nodeFill = item.status === "ready" ? "#dcfce7" : item.status === "over" ? "#fef3c7" : item.status === "active" ? "#fce7f3" : "#f8fafc";
        const nodeStroke = item.status === "ready" ? "#16a34a" : item.status === "over" ? "#d97706" : item.status === "active" ? "#db2777" : "#94a3b8";
        return (
          <g key={node.key} data-smoke="catan-wedding-response-node" data-wedding-key={node.key}>
            <circle cx={node.x} cy={node.y} r="28" fill={nodeFill} stroke={nodeStroke} strokeWidth="5" />
            <text x={node.x} y={node.y + 5} textAnchor="middle" fontSize="14" fontWeight="900" fill="#0f172a">{index + 1}</text>
            <text x={node.x} y={node.y + 45} textAnchor="middle" fontSize="10" fontWeight="900" fill="#831843">{item.label || node.key}</text>
          </g>
        );
      })}
    </svg>
  );
};

const CatanWeddingResponsePanel = ({
  attackerName = "",
  mustRespondWedding = false,
  weddingRequired = 0,
  weddingTotal = 0,
  weddingResources = {},
  weddingCommodities = {},
  resources = {},
  commodities = {},
  pendingNames = [],
}) => {
  const items = buildCatanWeddingResponseItems({
    attackerName,
    mustRespondWedding,
    weddingRequired,
    weddingTotal,
    weddingResources,
    weddingCommodities,
    resources,
    commodities,
    pendingNames,
  });
  const bundleRows = catanWeddingBundleRows({
    resources,
    commodities,
    resourceSelection: weddingResources,
    commoditySelection: weddingCommodities,
  });

  return (
    <section
      data-smoke="catan-wedding-response-panel"
      data-must-wedding={mustRespondWedding ? "true" : "false"}
      data-wedding-required={Math.max(0, Number(weddingRequired) || 0)}
      data-wedding-total={Math.max(0, Number(weddingTotal) || 0)}
      data-pending-count={pendingNames.length}
      className="rounded-2xl border border-pink-200 bg-white p-3 shadow-lg"
    >
      <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
        <CatanWeddingResponseArt
          items={items}
          weddingRequired={weddingRequired}
          weddingTotal={weddingTotal}
          mustRespondWedding={mustRespondWedding}
        />
        <div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-xs font-black text-pink-700">혼례 응답 플래너</div>
              <div className="mt-1 text-lg font-black text-slate-950">정확히 몇 장을 줄지</div>
              <div className="mt-1 text-xs font-bold leading-relaxed text-slate-600">
                제출 버튼을 누르기 전에 필요 장수, 현재 선택 수, 자원/상품 구성을 한 번에 확인합니다.
              </div>
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-black ${mustRespondWedding ? "bg-pink-100 text-pink-800" : "bg-slate-100 text-slate-600"}`}>
              {mustRespondWedding ? "응답 필요" : "응답 대기"}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <div
                key={item.key}
                data-smoke="catan-wedding-response-item"
                data-wedding-key={item.key}
                className={`min-h-[92px] rounded-xl border px-3 py-2 ${catanWeddingResponseTone(item.status)}`}
              >
                <div className="text-[10px] font-black opacity-70">{item.label}</div>
                <div className="mt-0.5 line-clamp-2 text-sm font-black leading-snug">{item.value}</div>
                <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-snug opacity-75">{item.detail}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {bundleRows.slice(0, 8).map((row) => (
              <span
                key={row.key}
                data-smoke="catan-wedding-response-chip"
                data-card-key={row.key}
                data-selected={row.selected > 0 ? "true" : "false"}
                className={`rounded-full px-2.5 py-1 text-[10px] font-black ${row.selected > 0 ? "bg-pink-100 text-pink-800" : "bg-slate-100 text-slate-500"}`}
              >
                {row.label} 보유 {row.held} · 선택 {row.selected}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const catanEventLabels = {
  SETUP_BUILD: "초기 배치",
  ROLL: "주사위",
  ROLL_SEVEN: "7 처리",
  RESOURCE_SUPPLY_SHORTAGE: "자원 공급 부족",
  CATAN_EVENT_DIE: "이벤트 주사위",
  DRAW_PROGRESS_CARD: "진행 카드 획득",
  DISCARD_RESOURCES: "자원 버림",
  DISCARD_PROGRESS_CARD: "진행 카드 버림",
  PROGRESS_CARD_LIMIT: "진행 카드 한도",
  CHOOSE_GOLD_RESOURCE: "금광 선택",
  AQUEDUCT_AVAILABLE: "수로 선택 가능",
  CHOOSE_AQUEDUCT_RESOURCE: "수로 자원 선택",
  MOVE_ROBBER: "도적 이동",
  MOVE_PIRATE: "해적 이동",
  BUILD_ROAD: "도로 건설",
  BUILD_BRIDGE: "다리 건설",
  BUILD_SHIP: "배 건설",
  MOVE_SHIP: "배 이동",
  FOREIGN_ISLAND_BONUS: "외딴 섬 보너스",
  FORGOTTEN_TRIBE_GIFT: "잊힌 부족 선물",
  FORGOTTEN_TRIBE_HARBOR: "선물 항구 배치",
  CLOTH_TRADE_START: "부족 마을 직물 교역",
  CLOTH_PRODUCTION: "직물 생산",
  CLOTH_DEPLETION_FINISH: "직물 고갈 종료",
  DISCOVER_HEX: "탐험 발견",
  BUILD_SETTLER: "정착민 준비",
  LOAD_SETTLER: "정착민 승선",
  BUILD_CREW: "승무원 준비",
  UNLOAD_CREW_TO_PIRATE_LAIR: "해적 소굴 공격",
  PIRATE_LAIR_CAPTURED: "해적 소굴 점령",
  ROLL_FISH_HAUL: "어획물 출현",
  CATCH_FISH: "어획물 적재",
  COLLECT_SPICE: "향신료 적재",
  SELL_RESOURCE_FOR_GOLD: "빠른 금 교환",
  CHASE_AWAY_PIRATE: "해적 몰아내기",
  TRANSFER_CARGO: "화물 교환",
  DELIVER_CARGO: "의회 납품",
  PIRATE_REMOVED_FISH: "해적 어획물 제거",
  FOUND_SETTLEMENT_FROM_SHIP: "상륙 마을 건설",
  PAY_PIRATE_TRIBUTE: "해적 통행료",
  BUILD_KNIGHT: "기사 배치",
  ACTIVATE_KNIGHT: "기사 활성화",
  PROMOTE_KNIGHT: "기사 승급",
  MOVE_KNIGHT: "기사 이동",
  KNIGHT_DISPLACED: "기사 밀림",
  KNIGHT_DISPLACED_REMOVED: "기사 제거",
  MOVE_DISPLACED_KNIGHT: "밀린 기사 이동",
  CHASE_ROBBER_WITH_KNIGHT: "기사 도적 추방",
  BUILD_CITY_IMPROVEMENT: "도시 발전",
  BUILD_CITY_WALL: "도시 성벽",
  PLAY_PROGRESS_CARD: "진행 카드 사용",
  BARBARIAN_DEFENDED: "야만인 방어",
  BARBARIAN_RAID: "야만인 약탈",
  BARBARIAN_CITY_PILLAGED: "도시 약탈",
  DEFENDER_PROGRESS_AVAILABLE: "방어자 진행 카드",
  CHOOSE_DEFENDER_PROGRESS_CARD: "방어자 카드 선택",
  BUILD_SETTLEMENT: "마을 건설",
  BUILD_HARBOR_SETTLEMENT: "항구 정착지 건설",
  BUILD_CITY: "도시 건설",
  GAIN_GOLD: "금 획득",
  RIVER_GOLD: "강 골드 획득",
  SPEND_GOLD_FOR_RESOURCE: "골드 자원 교환",
  CAMEL_BID_START: "낙타 입찰 시작",
  BID_CAMEL: "낙타 입찰",
  CAMEL_PLACER: "낙타 배치권",
  PLACE_CAMEL: "낙타 배치",
  BARBARIAN_LANDS: "야만인 상륙",
  RECRUIT_BARBARIAN_KNIGHT: "방어 기사 배치",
  EXPEL_BARBARIANS: "야만인 격퇴",
  BUY_DEVELOPMENT_CARD: "개발 카드 구입",
  PLAY_DEVELOPMENT_CARD: "개발 카드 사용",
  PROGRESS_ALCHEMIST: "연금술사",
  PROGRESS_COMMERCIAL_HARBOR: "상업 항구",
  COMMERCIAL_HARBOR_EXCHANGE: "상업 항구 교환",
  DOMESTIC_TRADE_PROPOSED: "플레이어 거래 제안",
  DOMESTIC_TRADE_ACCEPTED: "플레이어 거래 성립",
  DOMESTIC_TRADE_REJECTED: "플레이어 거래 거절",
  DOMESTIC_TRADE_CANCELLED: "플레이어 거래 취소",
  PROGRESS_SPY_REVEAL: "첩자 카드 확인",
  PROGRESS_DESERTER: "탈영병",
  DESERTER_REMOVE_KNIGHT: "탈영 기사 제거",
  DESERTER_PLACE_KNIGHT: "탈영 기사 배치",
  PROGRESS_INTRIGUE: "음모",
  INTRIGUE_MOVE_KNIGHT: "음모 기사 이동",
  PROGRESS_MERCHANT_FLEET: "상선단",
  MASTER_MERCHANT_TAKE: "대상인 카드 선택",
  PROGRESS_INVENTOR: "발명가",
  PROGRESS_SABOTEUR: "파괴 공작",
  PROGRESS_SPY: "첩자",
  WEDDING_GIVE_CARDS: "혼례 카드 제공",
  FISHERMEN_TOKEN: "물고기 토큰 획득",
  FISHERMEN_OLD_BOOT: "낡은 장화 획득",
  FISHERMEN_EMPTY_SUPPLY: "물고기 토큰 부족",
  SPEND_FISH_MOVE_ROBBER: "물고기로 도둑 이동",
  SPEND_FISH_STEAL_RESOURCE: "물고기로 자원 뽑기",
  SPEND_FISH_TAKE_RESOURCE: "물고기로 자원 획득",
  SPEND_FISH_BUILD_ROAD: "물고기로 도로 건설",
  SPEND_FISH_DRAW_DEVELOPMENT: "물고기로 개발 카드",
  GIVE_OLD_BOOT: "낡은 장화 넘기기",
  MARITIME_TRADE: "해상 교환",
  END_TURN: "턴 종료",
};

const catanColorFill = {
  RED: "#ef4444",
  BLUE: "#2563eb",
  WHITE: "#f8fafc",
  ORANGE: "#f97316",
  GREEN: "#16a34a",
  BROWN: "#92400e",
};

const catanDiceDotPositions = {
  1: [[24, 24]],
  2: [[15, 15], [33, 33]],
  3: [[15, 15], [24, 24], [33, 33]],
  4: [[15, 15], [33, 15], [15, 33], [33, 33]],
  5: [[15, 15], [33, 15], [24, 24], [15, 33], [33, 33]],
  6: [[15, 13], [33, 13], [15, 24], [33, 24], [15, 35], [33, 35]],
};

const CatanDiceFaceArt = ({ value = 0, red = false, muted = false, className = "" }) => {
  const safeValue = Number(value || 0);
  const dots = catanDiceDotPositions[safeValue] || [];
  const shellFill = red ? "#dc2626" : muted ? "#e2e8f0" : "#ffffff";
  const stroke = red ? "#7f1d1d" : "#0f172a";
  const ink = red ? "#fff7ed" : muted ? "#64748b" : "#0f172a";

  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      data-smoke="catan-dice-face-art"
      role="img"
      aria-label={safeValue > 0 ? `${red ? "적색 " : ""}주사위 ${safeValue}` : "주사위 대기"}
    >
      <rect x="4" y="4" width="40" height="40" rx="11" fill={shellFill} stroke={stroke} strokeWidth="3" opacity={muted ? ".86" : "1"} />
      <rect x="9" y="9" width="30" height="30" rx="8" fill="rgba(255,255,255,.22)" />
      {dots.length ? dots.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3.4" fill={ink} />
      )) : (
        <path d="M17 24h14" stroke={ink} strokeWidth="4" strokeLinecap="round" opacity=".75" />
      )}
    </svg>
  );
};

const CatanDiceOutcomePanel = ({
  diceFaces = [],
  lastRoll = 0,
  redDie = 0,
  eventDie = "",
  phase = "",
  myTurn = false,
  pendingDiscardCount = 0,
  productionSummary = [],
  resourceBank = {},
  robberLocked = false,
  explorersPiratesRule = false,
  citiesKnightsRule = false,
}) => {
  const normalizedFaces = Array.isArray(diceFaces) ? diceFaces.map(Number).filter((value) => value > 0) : [];
  const inferredWhiteDie = redDie > 0 && lastRoll > redDie && lastRoll - redDie <= 6 ? lastRoll - redDie : 0;
  const faces = normalizedFaces.length
    ? normalizedFaces.slice(0, 3)
    : redDie > 0
      ? [redDie, inferredWhiteDie || 0]
      : [0, 0];
  const isSeven = Number(lastRoll || 0) === 7;
  const hasRoll = Number(lastRoll || 0) > 0;
  const eventLabel = eventDie ? catanEventDieLabels[eventDie] || eventDie : "이벤트 없음";
  const productionText = productionSummary.length
    ? productionSummary.map((item) => `${item.label} ${item.count}`).join(" · ")
    : hasRoll && !isSeven
      ? "생산 후보 없음"
      : "굴림 후 표시";
  const primaryTitle = !hasRoll
    ? phase === "ROLL" ? "주사위 굴림 대기" : "최근 굴림 없음"
    : isSeven
      ? explorersPiratesRule ? "7 처리 · 해적 이동" : robberLocked ? "7 처리 · 도적 잠금" : "7 처리 · 도둑 압박"
      : `생산 숫자 ${lastRoll}`;
  const primaryDetail = !hasRoll
    ? myTurn ? "굴림 전 개발 카드나 진행 카드 타이밍을 먼저 확인하고, 주사위를 굴리면 생산 근거가 여기로 이동합니다." : "현재 플레이어의 주사위 굴림을 기다리는 중입니다."
    : isSeven
      ? pendingDiscardCount > 0
        ? `${pendingDiscardCount}명이 손패를 줄인 뒤 ${explorersPiratesRule ? "해적" : "도둑"} 이동 단계로 이어집니다.`
        : robberLocked
          ? "첫 야만인 침공 전이라 도적 이동 없이 손패 처리만 확인합니다."
          : `${explorersPiratesRule ? "해적" : "도둑"}을 옮길 타일과 훔칠 대상을 확인해야 합니다.`
      : `${productionText} · 도둑이 막은 타일과 은행 잔량은 실제 지급 결과에 영향을 줍니다.`;
  const signalItems = [
    {
      key: "roll",
      label: "굴림 결과",
      value: hasRoll ? String(lastRoll) : "대기",
      detail: hasRoll ? primaryTitle : phase === "ROLL" ? "주사위 버튼 대기" : "최근 기록 없음",
      tone: hasRoll ? "bg-amber-50 text-amber-800" : "bg-slate-50 text-slate-600",
    },
    {
      key: "event",
      label: citiesKnightsRule ? "이벤트 주사위" : "이벤트",
      value: eventLabel,
      detail: citiesKnightsRule ? "야만인선/진행 카드 계열 신호를 확인합니다." : "기본판은 이벤트 주사위가 없을 수 있습니다.",
      tone: eventDie ? "bg-rose-50 text-rose-800" : "bg-slate-50 text-slate-600",
    },
    {
      key: "discard",
      label: "손패 압박",
      value: isSeven ? `${pendingDiscardCount}명 확인` : "없음",
      detail: isSeven ? "8장 이상 보유자는 절반을 버립니다." : "7이 아닐 때는 생산/행동 단계가 중심입니다.",
      tone: isSeven ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-700",
    },
    {
      key: "bank",
      label: "은행 신호",
      value: `${catanResourceKeys.reduce((sum, key) => sum + Math.max(0, Number(resourceBank?.[key] || 0)), 0)}장`,
      detail: "자원 공급 부족 이벤트가 있으면 지급량이 달라질 수 있습니다.",
      tone: "bg-sky-50 text-sky-800",
    },
  ];

  return (
    <section className="mb-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg" data-smoke="catan-dice-outcome-panel">
      <div className="grid gap-0 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="bg-slate-950 p-4 text-white">
          <div className="text-[11px] font-black uppercase tracking-wide text-amber-200">Dice Readout</div>
          <div className="mt-2 flex items-center gap-2">
            {faces.map((face, index) => (
              <CatanDiceFaceArt key={`${face}-${index}`} value={face} red={redDie > 0 && index === 0} muted={!face} className="h-16 w-16" />
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-white/10 bg-white/10 px-3 py-2">
            <div className="text-[11px] font-black text-slate-300">결과 해석</div>
            <div className="mt-1 text-sm font-black leading-snug text-white">{primaryTitle}</div>
            <div className="mt-1 text-xs font-bold leading-relaxed text-slate-300">{primaryDetail}</div>
          </div>
        </div>
        <div className="p-3">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {signalItems.map((item) => (
              <div key={item.key} className={`min-h-[96px] rounded-xl border border-slate-100 px-3 py-2 ${item.tone}`} data-smoke="catan-dice-signal-item">
                <div className="text-[10px] font-black opacity-70">{item.label}</div>
                <div className="mt-1 truncate text-sm font-black">{item.value}</div>
                <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-relaxed opacity-75">{item.detail}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-5">
            {catanResourceKeys.map((key) => {
              const produced = productionSummary.find((item) => item.key === key);
              return (
                <div key={key} className="rounded-xl border border-slate-100 bg-slate-50 px-2 py-2" data-smoke="catan-dice-production-item">
                  <div className="text-[10px] font-black text-slate-500">{catanResourceLabels[key]}</div>
                  <div className="mt-1 text-sm font-black text-slate-950">{produced?.count || 0}개 후보</div>
                  <div className="mt-1 text-[10px] font-bold text-slate-500">은행 {resourceBank?.[key] ?? "-"}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

const get = (obj, snake, camel, fallback = undefined) => obj?.[camel] ?? obj?.[snake] ?? fallback;
const listOf = (value) => (Array.isArray(value) ? value : []);

const catanDiscardPlannerTone = (status = "waiting") => {
  if (status === "ready") return "border-emerald-100 bg-emerald-50 text-emerald-950";
  if (status === "over") return "border-rose-100 bg-rose-50 text-rose-950";
  if (status === "under") return "border-amber-100 bg-amber-50 text-amber-950";
  return "border-slate-100 bg-slate-50 text-slate-900";
};

const buildCatanDiscardPlannerItems = ({
  mustDiscard = false,
  discardRequired = 0,
  discardTotal = 0,
  resourceRows = [],
  commodityRows = [],
  pendingNames = [],
  explorersPiratesRule = false,
  robberLocked = false,
} = {}) => {
  const required = Math.max(0, Number(discardRequired) || 0);
  const total = Math.max(0, Number(discardTotal) || 0);
  const remaining = Math.max(0, required - total);
  const over = Math.max(0, total - required);
  const selectedRows = [...resourceRows, ...commodityRows].filter((row) => Number(row.selected || 0) > 0);
  const selectionText = selectedRows.length
    ? selectedRows.map((row) => `${row.label} ${row.selected}`).join(" · ")
    : "아직 선택 없음";
  const waitText = pendingNames.length ? pendingNames.join(" · ") : "대기 없음";
  const status = !mustDiscard ? "waiting" : total === required ? "ready" : total > required ? "over" : "under";
  const nextValue = explorersPiratesRule ? "해적 이동" : robberLocked ? "도적 잠금 유지" : "도둑 이동";

  return [
    {
      key: "requirement",
      label: "필요 장수",
      value: mustDiscard ? `${required}장 정확히` : "내 차례 아님",
      detail: mustDiscard ? "보유 카드 절반을 정확히 선택해야 다음 단계로 넘어갑니다." : `${waitText} 플레이어의 선택을 기다립니다.`,
      status: mustDiscard ? "under" : "waiting",
    },
    {
      key: "selection",
      label: "선택한 카드",
      value: `${total}/${required}장`,
      detail: status === "ready"
        ? "필요 장수와 일치합니다. 제출 버튼으로 확정할 수 있습니다."
        : status === "over"
          ? `${over}장 초과 선택했습니다. 숫자를 줄여야 합니다.`
          : mustDiscard
            ? `${remaining}장을 더 골라야 합니다.`
            : "현재 내가 버릴 대상이 아닙니다.",
      status,
    },
    {
      key: "composition",
      label: "선택 구성",
      value: selectionText,
      detail: selectedRows.length ? "입력칸에서 고른 자원/상품 구성을 그대로 요약합니다." : "아래 입력칸에서 버릴 자원을 고르면 여기에 바로 요약됩니다.",
      status: selectedRows.length ? "ready" : "waiting",
    },
    {
      key: "next",
      label: "다음 처리",
      value: nextValue,
      detail: "모든 대상자가 정확히 버리면 서버가 7 처리의 다음 단계를 진행합니다.",
      status: status === "ready" ? "ready" : "waiting",
    },
  ];
};

const CatanDiscardPlannerArt = ({ items = [], discardTotal = 0, discardRequired = 0, mustDiscard = false }) => {
  const required = Math.max(0, Number(discardRequired) || 0);
  const total = Math.max(0, Number(discardTotal) || 0);
  const safeRequired = Math.max(1, required);
  const progress = Math.max(0, Math.min(1.15, total / safeRequired));
  const ready = mustDiscard && required > 0 && total === required;
  const over = mustDiscard && total > required;
  const accent = ready ? "#059669" : over ? "#e11d48" : mustDiscard ? "#d97706" : "#64748b";
  const nodes = [
    { key: "requirement", x: 74, y: 126 },
    { key: "selection", x: 206, y: 76 },
    { key: "composition", x: 346, y: 126 },
    { key: "next", x: 486, y: 76 },
  ];

  return (
    <svg
      data-smoke="catan-discard-planner-art"
      viewBox="0 0 560 210"
      className="h-auto w-full"
      role="img"
      aria-label={`카탄 버리기 ${total}/${required}장 선택`}
      focusable="false"
    >
      <rect x="10" y="10" width="540" height="190" rx="24" fill="#fff7ed" stroke={accent} strokeWidth="3" />
      <path d="M74 126C132 50 206 46 278 102c76 59 141 55 208-26" fill="none" stroke="#fed7aa" strokeWidth="18" strokeLinecap="round" />
      <path d="M74 126C132 50 206 46 278 102c76 59 141 55 208-26" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" />
      <text x="32" y="42" fontSize="13" fontWeight="900" fill="#7c2d12">7 처리 · 버리기 플래너</text>
      <rect x="32" y="160" width="496" height="18" rx="9" fill="#ffedd5" stroke="#fdba74" strokeWidth="2" />
      <rect x="32" y="160" width={Math.min(496, 496 * progress)} height="18" rx="9" fill={accent} opacity=".86" />
      <text x="280" y="174" textAnchor="middle" fontSize="11" fontWeight="900" fill={ready || over ? "#ffffff" : "#7c2d12"}>{total}/{required}장</text>
      {nodes.map((node, index) => {
        const item = items.find((candidate) => candidate.key === node.key) || {};
        const nodeFill = item.status === "ready" ? "#dcfce7" : item.status === "over" ? "#ffe4e6" : item.status === "under" ? "#fef3c7" : "#f8fafc";
        const nodeStroke = item.status === "ready" ? "#16a34a" : item.status === "over" ? "#e11d48" : item.status === "under" ? "#d97706" : "#94a3b8";
        return (
          <g key={node.key} data-smoke="catan-discard-planner-node" data-discard-key={node.key}>
            <circle cx={node.x} cy={node.y} r="28" fill={nodeFill} stroke={nodeStroke} strokeWidth="5" />
            <text x={node.x} y={node.y + 5} textAnchor="middle" fontSize="14" fontWeight="900" fill="#0f172a">{index + 1}</text>
            <text x={node.x} y={node.y + 45} textAnchor="middle" fontSize="10" fontWeight="900" fill="#431407">{item.label || node.key}</text>
          </g>
        );
      })}
    </svg>
  );
};

const CatanDiscardPlannerPanel = ({
  resources = {},
  commodities = {},
  discardForm = {},
  discardCommodityForm = {},
  discardRequired = 0,
  discardTotal = 0,
  mustDiscard = false,
  pendingNames = [],
  citiesKnightsRule = false,
  explorersPiratesRule = false,
  robberLocked = false,
}) => {
  const resourceRows = catanResourceEntries.map(([key, label]) => ({
    key,
    label,
    owned: Math.max(0, Number(resources?.[key] || 0)),
    selected: Math.max(0, Number(discardForm?.[key] || 0)),
  }));
  const commodityRows = citiesKnightsRule
    ? Object.entries(catanCommodityLabels).map(([key, label]) => ({
      key,
      label,
      owned: Math.max(0, Number(commodities?.[key] || 0)),
      selected: Math.max(0, Number(discardCommodityForm?.[key] || 0)),
    }))
    : [];
  const items = buildCatanDiscardPlannerItems({
    mustDiscard,
    discardRequired,
    discardTotal,
    resourceRows,
    commodityRows,
    pendingNames,
    explorersPiratesRule,
    robberLocked,
  });
  const selectedRows = [...resourceRows, ...commodityRows].filter((row) => row.selected > 0);

  return (
    <section
      data-smoke="catan-discard-planner-panel"
      data-must-discard={mustDiscard ? "true" : "false"}
      data-discard-required={Math.max(0, Number(discardRequired) || 0)}
      data-discard-total={Math.max(0, Number(discardTotal) || 0)}
      data-pending-count={pendingNames.length}
      className="rounded-2xl border border-orange-200 bg-white p-3 shadow-lg"
    >
      <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
        <CatanDiscardPlannerArt
          items={items}
          discardTotal={discardTotal}
          discardRequired={discardRequired}
          mustDiscard={mustDiscard}
        />
        <div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-xs font-black text-orange-700">버리기 플래너</div>
              <div className="mt-1 text-lg font-black text-slate-950">정확히 몇 장을 버려야 하는지</div>
              <div className="mt-1 text-xs font-bold leading-relaxed text-slate-600">
                아래 숫자 입력으로 선택한 자원과 상품을 읽어, 제출 전에 부족/초과 상태를 한 번 더 보여줍니다.
              </div>
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-black ${mustDiscard ? "bg-orange-100 text-orange-800" : "bg-slate-100 text-slate-600"}`}>
              {mustDiscard ? "내가 버릴 차례" : "다른 플레이어 대기"}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <div
                key={item.key}
                data-smoke="catan-discard-planner-item"
                data-discard-key={item.key}
                className={`min-h-[92px] rounded-xl border px-3 py-2 ${catanDiscardPlannerTone(item.status)}`}
              >
                <div className="text-[10px] font-black opacity-70">{item.label}</div>
                <div className="mt-0.5 line-clamp-2 text-sm font-black leading-snug">{item.value}</div>
                <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-snug opacity-75">{item.detail}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(selectedRows.length ? selectedRows : resourceRows.slice(0, 5)).map((row) => (
              <span
                key={row.key}
                data-smoke="catan-discard-planner-chip"
                data-discard-key={row.key}
                className={`rounded-full px-2.5 py-1 text-[10px] font-black ${row.selected ? "bg-orange-100 text-orange-800" : "bg-slate-100 text-slate-500"}`}
              >
                {row.label} {row.selected}/{row.owned}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

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
  const config = gameConfigs[game] || {};
  const gameLabel = config.title || title;
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
const idOf = getTabletopRoomId;
const codeOf = getTabletopRoomCode;
const statusOf = getTabletopRoomStatus;
const playersOf = (room) => (Array.isArray(room?.players) ? room.players : []);
const memberIdOf = (player) => Number(getTabletopMemberId(player) || 0);
const seatNoOf = (player) => Number(getTabletopSeatNo(player) || 0);
const isReady = isTabletopReadyPlayer;
const variantNameOf = (room) => room?.variantName || "";
const variantCodeOf = (room) => room?.variantCode || "BASE";
const variantSummaryOf = (room) => room?.variantSummary || "";
const maxPlayersOf = (room) => Number(room?.maxPlayers || 0);
const minPlayersOf = (room) => Number(room?.minPlayers || 0);
const hostMemberIdOf = (room) => Number(room?.hostMemberId || 0);
const turnSecondsOf = (room) => Number(room?.turnTimeSeconds || 30);
const clampTabletopBotCount = (value, minValue = 0, maxValue = 0) => {
  const parsed = Math.floor(Number(value || 0));
  const safeValue = Number.isFinite(parsed) ? parsed : 0;
  return Math.max(minValue, Math.min(maxValue, safeValue));
};
const defaultStartBotCountForRoom = (game, room) => {
  const playerCount = playersOf(room).length;
  const minPlayers = minPlayersOf(room);
  const maxPlayers = maxPlayersOf(room);
  if (!supportsTabletopAiBotStart(game, minPlayers) || playerCount <= 0 || maxPlayers <= playerCount) return 0;
  if (String(game || "").toLowerCase() === "poker" && playerCount === 1) {
    return Math.min(3, maxPlayers - playerCount);
  }
  return Math.max(0, Math.min(maxPlayers - playerCount, minPlayers - playerCount));
};

const tabletopTurnSeatForSound = (game, gameState) => {
  if (!gameState || gameState.phase === "FINISHED") return 0;
  if (game === "blokus") return Number(get(gameState, "current_seat_no", "currentSeatNo", 0));
  if (game === "mahe") return Number(get(gameState, "decision_seat_no", "decisionSeatNo", 0) || get(gameState, "active_seat_no", "activeSeatNo", 0));
  if (game === "dalmuti") {
    const phase = gameState.phase || "";
    if (phase === "TAX_RETURN") {
      const exchange = listOf(get(gameState, "tax_exchanges", "taxExchanges", [])).find((item) => !item.completed);
      return Number(get(exchange, "dalmuti_seat_no", "dalmutiSeatNo", 0));
    }
    if (phase === "REVOLUTION_DECISION") {
      const declined = new Set(listOf(get(gameState, "revolution_declined_seat_nos", "revolutionDeclinedSeatNos", [])).map(Number));
      const next = listOf(get(gameState, "revolution_eligible_seat_nos", "revolutionEligibleSeatNos", [])).map(Number).find((seatNo) => !declined.has(seatNo));
      return Number(next || 0);
    }
    return Number(get(gameState, "active_seat_no", "activeSeatNo", 0));
  }
  return Number(get(gameState, "active_seat_no", "activeSeatNo", 0));
};

const tabletopActionSignalForSound = (game, gameState) => {
  if (!gameState) return "";
  const eventSource = game === "blokus" || game === "mahe"
    ? listOf(get(gameState, "move_history", "moveHistory", []))
    : listOf(get(gameState, "events", "events", []));
  const last = eventSource[eventSource.length - 1];
  if (!last) return "";
  return [
    game,
    get(last, "event_no", "eventNo", get(last, "turn_number", "turnNumber", "")),
    get(last, "event_type", "eventType", get(last, "action_type", "actionType", "")),
    get(last, "seat_no", "seatNo", get(last, "active_seat_no", "activeSeatNo", "")),
  ].join(":");
};

const tabletopPlayerName = (players, seatNo) => {
  const normalizedSeatNo = Number(seatNo || 0);
  if (!normalizedSeatNo) return "-";
  return players.find((player) => seatNoOf(player) === normalizedSeatNo)?.nickname || `${normalizedSeatNo}번`;
};

const tabletopBotProfiles = (gameState) => listOf(get(gameState, "bot_profiles", "botProfiles", []))
  .map((profile) => ({
    seatNo: Number(get(profile, "seat_no", "seatNo", 0)),
    name: String(get(profile, "name", "name", "") || ""),
    archetype: String(get(profile, "archetype", "archetype", "") || ""),
    styleSummary: String(get(profile, "style_summary", "styleSummary", "") || ""),
  }))
  .filter((profile) => profile.seatNo > 0);

const tabletopPlayersWithBotProfiles = (players, gameState) => {
  const realPlayers = Array.isArray(players) ? players : [];
  const occupiedSeats = new Set(realPlayers.map(seatNoOf).filter(Boolean));
  const botPlayers = tabletopBotProfiles(gameState)
    .filter((profile) => !occupiedSeats.has(profile.seatNo))
    .map((profile) => ({
      memberId: 0,
      seatNo: profile.seatNo,
      nickname: profile.name || `AI ${profile.seatNo}`,
      profileUrl: "",
      level: 0,
      rewardTier: "",
      frameCode: "",
      __bot: true,
      __botProfile: profile,
    }));
  return [...realPlayers, ...botPlayers].sort((left, right) => seatNoOf(left) - seatNoOf(right));
};

const tabletopPhaseLabel = (game, gameState, status) => {
  const phase = String(get(gameState, "phase", "phase", "") || "").toUpperCase();
  if (!phase) return statusLabels[status] || status || "대기";
  if (game === "dalmuti") return dalmutiPhaseLabels[phase] || phase;
  if (game === "six-nimmt") return sixNimmtPhaseLabels[phase] || phase;
  if (game === "telestrations") return telestrationsPhaseLabels[phase] || phase;
  if (game === "mafia") return mafiaPhaseLabels[phase] || phase;
  if (game === "poker") return pokerPhaseLabels[phase] || phase;
  if (game === "mahe") {
    if (phase === "ROLLING") return "주사위 굴림";
    if (phase === "CHOOSE_DICE_COUNT") return "주사위 개수 선택";
    if (phase === "FINISHED") return "게임 종료";
  }
  if (game === "blokus") return phase === "FINISHED" ? "게임 종료" : "조각 배치";
  if (game === "catan") {
    const catanLabels = {
      INITIAL_PLACEMENT: "초기 배치",
      ROLL_DICE: "주사위 굴림",
      ROBBER: "도둑 처리",
      ACTION: "건설·교역",
      DISCARD: "자원 버리기",
      FINISHED: "게임 종료",
    };
    return catanLabels[phase] || phase;
  }
  return phase;
};

const tabletopLatestActionText = (game, gameState, players) => {
  if (!gameState) return "아직 게임 로그가 없습니다.";
  const eventSource = game === "blokus" || game === "mahe"
    ? listOf(get(gameState, "move_history", "moveHistory", []))
    : listOf(get(gameState, "events", "events", []));
  const last = eventSource[eventSource.length - 1];
  if (!last) return "아직 게임 로그가 없습니다.";
  const message = get(last, "message", "message", "");
  if (message) return message;
  const eventType = String(get(last, "event_type", "eventType", get(last, "action_type", "actionType", "")) || "");
  const seatNo = Number(get(last, "seat_no", "seatNo", get(last, "active_seat_no", "activeSeatNo", 0)));
  const actor = tabletopPlayerName(players, seatNo);
  if (game === "blokus") {
    const turn = get(last, "turn_number", "turnNumber", "");
    return `${turn ? `${turn}수 · ` : ""}${actor} ${last.pass ? "패스" : `${get(last, "piece_code", "pieceCode", "조각")} 배치`}`;
  }
  if (game === "mahe") return `${actor} · ${maheEventLabels[eventType] || eventType || "최근 행동"}`;
  if (game === "dalmuti") return `${actor} · ${dalmutiEventLabels[eventType] || eventType || "최근 행동"}`;
  if (game === "catan") return `${actor} · ${catanEventLabels[eventType] || eventType || "최근 행동"}`;
  if (game === "six-nimmt") return `${actor} · ${sixNimmtEventLabels[eventType] || eventType || "최근 행동"}`;
  if (game === "poker") return `${actor} · ${eventType || "최근 행동"}`;
  return `${actor} · ${eventType || "최근 행동"}`;
};

const tabletopRecentEventSource = (game, gameState) => {
  if (!gameState) return [];
  return game === "blokus" || game === "mahe"
    ? listOf(get(gameState, "move_history", "moveHistory", []))
    : listOf(get(gameState, "events", "events", []));
};

const tabletopEventTypeLabel = (game, eventType) => {
  if (game === "catan") return catanEventLabels[eventType] || eventType;
  if (game === "mahe") return maheEventLabels[eventType] || eventType;
  if (game === "dalmuti") return dalmutiEventLabels[eventType] || eventType;
  if (game === "six-nimmt") return sixNimmtEventLabels[eventType] || eventType;
  if (game === "mafia") return mafiaPhaseLabels[eventType] || eventType;
  return eventType || "진행 기록";
};

const buildTabletopProgressDigest = (game, gameState, players, status) => {
  const events = tabletopRecentEventSource(game, gameState);
  const recentEvents = events.slice(-3).reverse();
  const latest = events[events.length - 1] || null;
  const latestType = String(get(latest, "event_type", "eventType", get(latest, "action_type", "actionType", "")) || "");
  const latestSeatNo = Number(get(latest, "seat_no", "seatNo", get(latest, "active_seat_no", "activeSeatNo", 0)));
  const actor = latestSeatNo ? tabletopPlayerName(players, latestSeatNo) : latest ? "시스템" : "대기";
  const latestSummary = tabletopLatestActionText(game, gameState, players);
  const phaseLabel = tabletopPhaseLabel(game, gameState, status);
  const eventNo = get(latest, "event_no", "eventNo", get(latest, "turn_number", "turnNumber", ""));
  const eventLabel = tabletopEventTypeLabel(game, latestType);
  const isFinished = String(get(gameState, "phase", "phase", "") || "").toUpperCase() === "FINISHED" || status === "FINISHED";

  const items = [
    {
      key: "latest",
      icon: "recent",
      label: "최근 진행",
      value: latestSummary,
      detail: latest ? "가장 마지막 서버 기록을 플레이어 문장으로 요약했습니다." : "첫 기록이 생기면 이 영역이 갱신됩니다.",
    },
    {
      key: "actor",
      icon: "player",
      label: "행동 주체",
      value: actor,
      detail: latest ? `${eventLabel || "진행"} 기록의 기준 좌석입니다.` : "아직 행동 주체가 없습니다.",
    },
    {
      key: "count",
      icon: "signal",
      label: "기록 밀도",
      value: `${events.length}개`,
      detail: recentEvents.length ? `최근 ${recentEvents.length}개 기록을 흐름으로 묶었습니다.` : "아직 표시할 최근 기록이 없습니다.",
    },
    {
      key: "phase",
      icon: isFinished ? "win" : "stage",
      label: isFinished ? "결과 상태" : "현재 단계",
      value: phaseLabel,
      detail: eventNo ? `기록 번호 ${eventNo} 이후의 보드 상태입니다.` : "현재 단계와 최신 기록을 함께 봅니다.",
    },
  ];

  return { events, recentEvents, latestType, items, eventLabel };
};

const TabletopProgressDigestArt = ({ digest }) => {
  const nodes = digest.items.map((item, index) => ({
    ...item,
    x: 52 + index * 92,
    y: index % 2 === 0 ? 76 : 118,
    fill: ["#0ea5e9", "#10b981", "#f59e0b", "#f43f5e"][index] || "#64748b",
  }));

  return (
    <svg
      viewBox="0 0 360 188"
      role="img"
      aria-label="보드게임 최근 진행 요약"
      className="h-full min-h-[188px] w-full"
      data-smoke="tabletop-progress-digest-art"
    >
      <rect x="10" y="10" width="340" height="168" rx="22" fill="#0f172a" />
      <rect x="24" y="30" width="312" height="132" rx="18" fill="#f8fafc" />
      <path d="M52 76 C86 38 122 132 144 118 S214 76 236 76 S294 136 328 118" fill="none" stroke="#cbd5e1" strokeWidth="13" strokeLinecap="round" />
      <path d="M52 76 C86 38 122 132 144 118 S214 76 236 76 S294 136 328 118" fill="none" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
      <text x="34" y="25" fontSize="10" fontWeight="900" fill="#bfdbfe">최근 진행</text>
      <text x="326" y="25" textAnchor="end" fontSize="10" fontWeight="900" fill="#e2e8f0">{digest.events.length}개 기록</text>
      {nodes.map((node, index) => (
        <g key={node.key} data-smoke="tabletop-progress-digest-node">
          <circle cx={node.x} cy={node.y} r="22" fill={node.fill} stroke="#ffffff" strokeWidth="5" />
          <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="10" fontWeight="900" fill="#ffffff">{index + 1}</text>
          <text x={node.x} y={node.y + (index % 2 === 0 ? 38 : -32)} textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#0f172a">{node.label}</text>
        </g>
      ))}
      <rect x="64" y="148" width="232" height="13" rx="7" fill="#e2e8f0" />
      <text x="180" y="158" textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#0f172a">최근 기록 → 행동 주체 → 기록 밀도 → 현재 단계</text>
    </svg>
  );
};

const TabletopProgressDigestPanel = ({ game, gameState, players, status }) => {
  if (!gameState) return null;
  const digest = buildTabletopProgressDigest(game, gameState, players, status);

  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      data-smoke="tabletop-progress-digest-panel"
      data-event-count={digest.events.length}
      data-recent-count={digest.recentEvents.length}
      data-latest-type={digest.latestType}
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,340px)_1fr]">
        <div className="bg-slate-950 p-3">
          <TabletopProgressDigestArt digest={digest} />
        </div>
        <div className="p-3 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-500">
                <GameUxGlyph type="recent" className="h-3.5 w-3.5 text-primary-600" />
                최근 진행 요약
              </div>
              <h3 className="mt-2 text-base font-black text-slate-950 sm:text-lg">방금 무엇이 바뀌었는가</h3>
            </div>
            <span className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-black text-white">
              {digest.eventLabel || "진행 기록"}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {digest.items.map((item) => (
              <div key={item.key} className="min-h-[108px] rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" data-smoke="tabletop-progress-digest-item" data-digest-key={item.key}>
                <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400">
                  <GameUxGlyph type={item.icon} className="h-3.5 w-3.5 text-primary-600" />
                  {item.label}
                </div>
                <div className="mt-1 line-clamp-2 text-sm font-black leading-snug text-slate-950">{item.value}</div>
                <div className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-slate-600">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const tabletopNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const tabletopStateSeatNo = (item) => tabletopNumber(get(item, "seat_no", "seatNo", 0));

const tabletopStateName = (players, item) => {
  const directName = get(item, "name", "name", "") || get(item, "nickname", "nickname", "") || get(item, "label", "label", "");
  if (directName) return directName;
  return tabletopPlayerName(players, tabletopStateSeatNo(item));
};

const tabletopScoreRows = (rows, players, scoreReader, order = "desc") => {
  const mapped = rows
    .map((row) => ({
      row,
      seatNo: tabletopStateSeatNo(row),
      name: tabletopStateName(players, row),
      score: scoreReader(row),
      winner: Boolean(get(row, "winner", "winner", false)),
    }))
    .filter((row) => Number.isFinite(row.score));
  return mapped.sort((left, right) => order === "asc" ? left.score - right.score : right.score - left.score);
};

const tabletopWinnerNames = (winners) => winners.map((row) => `${row.name}님`).join(", ");

const tabletopRunnerUp = (scoreRows, winners) => scoreRows.find((row) => !winners.includes(row));

const tabletopResultGapText = (winner, runnerUp, { lowerIsBetter = false, unit = "점" } = {}) => {
  if (!winner || !runnerUp) return "";
  const gap = lowerIsBetter ? runnerUp.score - winner.score : winner.score - runnerUp.score;
  if (!Number.isFinite(gap) || gap <= 0) return "";
  return `2위 ${runnerUp.name}님과 ${gap}${unit} 차이입니다.`;
};

const buildTabletopScoreSignal = (game, gameState, players) => {
  const phase = String(get(gameState, "phase", "phase", "") || "").toUpperCase();
  const statePlayers = listOf(get(gameState, "players", "players", []));

  if (game === "catan") {
    const winningPoints = tabletopNumber(get(gameState, "winning_points", "winningPoints", 10), 10) || 10;
    const winnerSeatNo = tabletopNumber(get(gameState, "winner_seat_no", "winnerSeatNo", 0));
    const scoreRows = tabletopScoreRows(
      statePlayers,
      players,
      (player) => tabletopNumber(get(player, "public_victory_points", "publicVictoryPoints", get(player, "victory_points", "victoryPoints", 0)))
    );
    const winner = winnerSeatNo
      ? scoreRows.find((row) => row.seatNo === winnerSeatNo) || { name: tabletopPlayerName(players, winnerSeatNo), score: 0 }
      : null;
    const leader = scoreRows[0];
    if (phase === "FINISHED" && winner) {
      return {
        value: `${winner.name} 승리`,
        detail: `목표 ${winningPoints}점에 도달해 최종 승자가 확정되었습니다.`,
      };
    }
    if (leader) {
      return {
        value: `${leader.name} ${leader.score}/${winningPoints}점`,
        detail: `공개 승점 기준 선두입니다. 목표까지 ${Math.max(0, winningPoints - leader.score)}점 남았습니다.`,
      };
    }
  }

  if (game === "blokus") {
    const scoreRows = tabletopScoreRows(
      listOf(get(gameState, "scores", "scores", [])),
      players,
      (score) => tabletopNumber(get(score, "score", "score", 0))
    );
    const winners = scoreRows.filter((row) => row.winner);
    if (phase === "FINISHED" && winners.length) {
      const runnerUp = tabletopRunnerUp(scoreRows, winners);
      const gapText = tabletopResultGapText(winners[0], runnerUp);
      const winnerLead = winners.length > 1
        ? `${tabletopWinnerNames(winners)}이 공동 ${winners[0].score}점으로 승리했습니다.`
        : `${tabletopWinnerNames(winners)}이 최종 ${winners[0].score}점으로 승리했습니다.`;
      return {
        value: `${winners.map((row) => row.name).join(", ")} 승리`,
        detail: `${winnerLead}${gapText ? ` ${gapText}` : ""} 블로커스 점수는 남은 조각 손실, 모든 조각 사용 보너스, 마지막 한 칸 조각 보너스를 서버가 합산한 결과입니다.`,
      };
    }
    if (scoreRows[0]) {
      return {
        value: `${scoreRows[0].name} ${scoreRows[0].score}점`,
        detail: "현재 표시 점수 기준 선두입니다. 둘 수 있는 조각과 막힌 경로를 함께 보세요.",
      };
    }
  }

  if (game === "mahe") {
    const scoreRows = tabletopScoreRows(
      listOf(get(gameState, "scores", "scores", [])),
      players,
      (score) => tabletopNumber(get(score, "score", "score", 0))
    );
    const winners = scoreRows.filter((row) => row.winner);
    if (phase === "FINISHED" && winners.length) {
      const runnerUp = tabletopRunnerUp(scoreRows, winners);
      const gapText = tabletopResultGapText(winners[0], runnerUp);
      const winningEggCount = listOf(get(winners[0].row, "cards", "cards", [])).length;
      const eggCountText = winningEggCount ? ` 획득한 알 카드는 ${winningEggCount}장입니다.` : "";
      const winnerLead = winners.length > 1
        ? `${tabletopWinnerNames(winners)}이 알 카드 총점 ${winners[0].score}점으로 공동 승리했습니다.`
        : `${tabletopWinnerNames(winners)}이 알 카드 총점 ${winners[0].score}점으로 승리했습니다.`;
      return {
        value: `${winners.map((row) => row.name).join(", ")} 승리`,
        detail: `${winnerLead}${gapText ? ` ${gapText}` : ""}${eggCountText} 최종 알 카드 합계가 승리 기준이며 동점이면 알 카드 수와 서버 판정 순서가 함께 반영됩니다.`,
      };
    }
    if (scoreRows[0]) {
      const currentEgg = tabletopNumber(get(gameState, "current_egg", "currentEgg", 0));
      return {
        value: `${scoreRows[0].name} ${scoreRows[0].score}점`,
        detail: currentEgg ? `현재 알 ${currentEgg}점이 다음 위험 보상입니다.` : "알 카드 점수 기준 선두입니다.",
      };
    }
  }

  if (game === "dalmuti") {
    const nextOrder = listOf(get(gameState, "next_turn_order_seat_nos", "nextTurnOrderSeatNos", [])).map(Number).filter(Boolean);
    const outSeatNos = listOf(get(gameState, "out_seat_nos", "outSeatNos", [])).map(Number).filter(Boolean);
    if (phase === "FINISHED" && nextOrder.length) {
      const firstSeatNo = nextOrder[0];
      const firstName = tabletopPlayerName(players, firstSeatNo);
      const escapedNames = outSeatNos.slice(0, 3).map((seatNo) => `${tabletopPlayerName(players, seatNo)}님`);
      const escapedText = escapedNames.length ? ` 탈출 순서: ${escapedNames.join(" → ")}${outSeatNos.length > escapedNames.length ? " ..." : ""}.` : "";
      return {
        value: `${firstName} 다음 대달무티`,
        detail: `${firstName}님이 가장 먼저 손패를 비워 이번 판 1순위가 되었고, 다음 라운드의 대달무티 자리를 받습니다. ${nextOrder.length}명 순위가 다음 계급과 세금 교환 흐름을 정합니다.${escapedText}`,
      };
    }
    return {
      value: outSeatNos.length ? `${outSeatNos.length}명 탈출` : `라운드 ${tabletopNumber(get(gameState, "round_no", "roundNo", 1), 1)}`,
      detail: "손패를 먼저 비운 순서가 다음 계급과 자리 이점을 만듭니다.",
    };
  }

  if (game === "six-nimmt") {
    const scoreRows = tabletopScoreRows(
      statePlayers,
      players,
      (player) => tabletopNumber(get(player, "total_penalty", "totalPenalty", 0)),
      "asc"
    );
    const winners = scoreRows.filter((row) => row.winner);
    if (phase === "FINISHED" && winners.length) {
      const runnerUp = tabletopRunnerUp(scoreRows, winners);
      const gapText = tabletopResultGapText(winners[0], runnerUp, { lowerIsBetter: true });
      const winnerLead = winners.length > 1
        ? `${tabletopWinnerNames(winners)}이 누적 벌점 ${winners[0].score}점으로 공동 승리했습니다.`
        : `${tabletopWinnerNames(winners)}이 누적 벌점 ${winners[0].score}점으로 승리했습니다.`;
      return {
        value: `${winners.map((row) => row.name).join(", ")} 승리`,
        detail: `${winnerLead}${gapText ? ` ${gapText}` : ""} 6 nimmt!는 벌점이 낮을수록 유리하므로 가져간 카드의 황소머리 합계가 최종 근거입니다.`,
      };
    }
    if (scoreRows[0]) {
      const selectedCount = listOf(get(gameState, "selected_seat_nos", "selectedSeatNos", [])).length;
      return {
        value: `${scoreRows[0].name} 벌점 ${scoreRows[0].score}`,
        detail: `카드 선택 ${selectedCount}/${statePlayers.length || "-"}명 완료. 낮은 벌점이 유리합니다.`,
      };
    }
  }

  if (game === "telestrations") {
    const currentStep = tabletopNumber(get(gameState, "current_step", "currentStep", 0));
    const totalSteps = tabletopNumber(get(gameState, "total_steps", "totalSteps", 0));
    const completedCount = listOf(get(gameState, "completed_seat_nos", "completedSeatNos", [])).length;
    if (phase === "FINISHED") {
      return {
        value: "릴레이 완료",
        detail: "텔레스트레이션은 승패보다 책자별 원문, 그림, 추측이 어떻게 바뀌었는지가 결과입니다. 공개 리플레이에서 원문과 마지막 추측의 차이를 비교하세요.",
      };
    }
    return {
      value: phase === "REVEAL" ? "공개 단계" : `${Math.min(currentStep + 1, totalSteps || currentStep + 1)}/${totalSteps || "-"}단계`,
      detail: `${completedCount}명 제출 완료. 책자별로 제한된 정보만 이어받는 흐름입니다.`,
    };
  }

  if (game === "mafia") {
    const winnerTeam = String(get(gameState, "winner_team", "winnerTeam", "") || "");
    const outcomeMessage = get(gameState, "outcome_message", "outcomeMessage", "") || "";
    if (phase === "FINISHED" && winnerTeam) {
      return {
        value: winnerTeam === "MAFIA" ? "마피아팀 승리" : "시민팀 승리",
        detail: outcomeMessage || "생존 균형과 투표 결과로 승패가 확정되었습니다.",
      };
    }
    const aliveMafia = tabletopNumber(get(gameState, "alive_mafia_count", "aliveMafiaCount", 0));
    const aliveTown = tabletopNumber(get(gameState, "alive_town_count", "aliveTownCount", 0));
    return {
      value: `마피아 ${aliveMafia} · 시민 ${aliveTown}`,
      detail: "남은 인원 균형이 투표 압박과 밤 행동의 위험도를 결정합니다.",
    };
  }

  if (game === "poker") {
    const winnerSeatNo = tabletopNumber(get(gameState, "winner_seat_no", "winnerSeatNo", 0));
    const resultTitle = get(gameState, "result_title", "resultTitle", "");
    const resultDetail = get(gameState, "result_detail", "resultDetail", "");
    if ((phase === "HAND_FINISHED" || phase === "FINISHED") && winnerSeatNo) {
      return {
        value: resultTitle || `${tabletopPlayerName(players, winnerSeatNo)} 승리`,
        detail: resultDetail || `직전 팟 ${tabletopNumber(get(gameState, "last_pot", "lastPot", 0))}칩이 정산되었습니다.`,
      };
    }
    return {
      value: `팟 ${tabletopNumber(get(gameState, "pot", "pot", 0))}칩`,
      detail: `콜 ${tabletopNumber(get(gameState, "call_amount", "callAmount", 0))}칩 · ${tabletopNumber(get(gameState, "hand_no", "handNo", 0))}/${tabletopNumber(get(gameState, "max_hands", "maxHands", 0)) || "-"}핸드`,
    };
  }

  return {
    value: tabletopPhaseLabel(game, gameState, "PLAYING"),
    detail: "현재 서버 상태를 기준으로 판세를 확인하세요.",
  };
};

const buildTabletopDecisionSignal = (game, gameState, players, status, mySeatNo, startStatusText) => {
  const phase = String(get(gameState, "phase", "phase", "") || "").toUpperCase();
  const activeSeatNo = tabletopTurnSeatForSound(game, gameState);
  const activeName = activeSeatNo ? tabletopPlayerName(players, activeSeatNo) : "";
  const brief = tabletopRoomBriefs[game] || {};
  const myTurn = Boolean(status === "PLAYING" && activeSeatNo && Number(mySeatNo) === activeSeatNo);
  if (status === "WAITING") {
    return {
      value: "시작 조건 확인",
      detail: startStatusText || "참가자 준비와 인원 조건을 먼저 맞추세요.",
    };
  }
  if (phase === "FINISHED" || status === "FINISHED") {
    return {
      value: "결과 확인",
      detail: brief.winSignal || "승자와 점수 흐름을 확인한 뒤 다시하기를 선택하세요.",
    };
  }
  if (game === "six-nimmt" && phase === "SELECTING") {
    const myState = statePlayersForDecision(gameState).find((player) => tabletopStateSeatNo(player) === Number(mySeatNo));
    return {
      value: Boolean(get(myState, "selected", "selected", false)) ? "카드 제출 완료" : "카드 선택 필요",
      detail: "모두 선택하면 카드가 공개되고 위험 행 선택 여부가 결정됩니다.",
    };
  }
  if (game === "telestrations") {
    const mySubmitted = Boolean(get(gameState, "my_submitted", "mySubmitted", false));
    return {
      value: mySubmitted ? "제출 완료" : "내 입력 제출",
      detail: get(gameState, "current_task", "currentTask", "") || brief.firstDecision || "현재 단계 입력을 완료하세요.",
    };
  }
  if (game === "mafia") {
    const mySubmitted = Boolean(get(gameState, "my_submitted", "mySubmitted", false));
    return {
      value: mySubmitted ? "행동 제출 완료" : "역할 행동 확인",
      detail: get(gameState, "my_task", "myTask", "") || brief.firstDecision || "현재 단계에서 가능한 대상과 투표 흐름을 확인하세요.",
    };
  }
  if (myTurn) {
    return {
      value: "내 행동 선택",
      detail: brief.firstDecision || "강조된 액션 패널에서 가능한 행동을 선택하세요.",
    };
  }
  return {
    value: activeName ? `${activeName} 대기` : "동시 진행 확인",
    detail: brief.winSignal || "상대 행동 이후 바뀌는 점수, 카드, 말 위치를 확인하세요.",
  };
};

const statePlayersForDecision = (gameState) => listOf(get(gameState, "players", "players", []));

const TabletopBoardFocusPanel = ({ game, gameState, players, status, mySeatNo, startStatusText }) => {
  if (!gameState) return null;
  const phaseLabel = tabletopPhaseLabel(game, gameState, status);
  const activeSeatNo = tabletopTurnSeatForSound(game, gameState);
  const activeName = activeSeatNo ? tabletopPlayerName(players, activeSeatNo) : "동시 진행";
  const scoreSignal = buildTabletopScoreSignal(game, gameState, players);
  const decisionSignal = buildTabletopDecisionSignal(game, gameState, players, status, mySeatNo, startStatusText);
  const latestAction = tabletopLatestActionText(game, gameState, players);
  const hasRecentEvents = tabletopRecentEventSource(game, gameState).length > 0;
  const normalizedPhase = String(get(gameState, "phase", "phase", "") || "").toUpperCase();
  const isFinished = normalizedPhase === "FINISHED" || normalizedPhase === "HAND_FINISHED" || status === "FINISHED";
  const myTurn = Boolean(status === "PLAYING" && activeSeatNo && Number(mySeatNo) === activeSeatNo);
  const cueTone = isFinished ? "done" : myTurn ? "active" : status === "WAITING" ? "waiting" : "neutral";
  const cueTitle = isFinished ? "결과 확인" : myTurn ? "내 행동 차례" : activeSeatNo ? `${activeName} 차례 관찰` : "동시 진행 확인";
  const cueItems = [
    { label: "단계", value: phaseLabel, icon: "stage", tone: isFinished ? "done" : "neutral" },
    { label: "행동", value: decisionSignal.value, icon: "decision", tone: myTurn ? "active" : "neutral" },
    { label: "판세", value: scoreSignal.value, icon: isFinished ? "win" : "score", tone: isFinished ? "done" : "neutral" },
    { label: "근거", value: latestAction, icon: "recent" },
  ];
  const tiles = [
    {
      key: "phase",
      icon: "stage",
      label: "현재 단계",
      value: phaseLabel,
      detail: activeSeatNo ? `${activeName} 차례 기준으로 보드를 읽으세요.` : "동시 선택 또는 공개 단계입니다.",
    },
    {
      key: "score",
      icon: isFinished ? "win" : "score",
      label: isFinished ? "결과" : "판세",
      value: scoreSignal.value,
      detail: scoreSignal.detail,
    },
    {
      key: "decision",
      icon: "decision",
      label: "다음 판단",
      value: decisionSignal.value,
      detail: decisionSignal.detail,
    },
    {
      key: "recent",
      icon: "recent",
      label: "최근 근거",
      value: latestAction,
      detail: "방금 바뀐 정보가 이번 판단의 기준입니다.",
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-lg" data-smoke="tabletop-board-focus-panel">
      {isFinished && (
        <GameResultSpotlight
          title={scoreSignal.value}
          subtitle="게임 결과"
          detail={scoreSignal.detail}
          metric={latestAction}
          smoke="tabletop-result-spotlight"
          className="mb-3"
        />
      )}
      <GameActionCueBar
        title={cueTitle}
        detail={decisionSignal.detail}
        items={cueItems}
        tone={cueTone}
        smoke="tabletop-action-cue-bar"
        className="mb-3"
      />
      {game === "catan" && !hasRecentEvents && !isFinished && (
        <div className="mb-3" data-smoke="tabletop-focus-history-empty">
          <TabletopHistoryEmptyState
            game="catan"
            title="아직 카탄 기록이 없습니다"
            detail="주사위, 생산, 건설, 거래가 처리되면 좌석과 자원 근거가 이 기록 영역에 쌓입니다."
            nextAction="첫 생산"
          />
        </div>
      )}
      <div className="grid gap-2 md:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.key} className="min-h-[112px] rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" data-smoke="tabletop-board-focus-tile">
            <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500">
              <GameUxGlyph type={tile.icon} className="h-3.5 w-3.5" />
              {tile.label}
            </div>
            <div className="mt-1 line-clamp-2 text-sm font-black leading-snug text-slate-950">{tile.value}</div>
            <div className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-slate-600">{tile.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
};

const tabletopOutcomeBriefs = {
  catan: {
    condition: "목표 승점 도달",
    basis: "공개 승점, 보너스 표식, 비공개 승점이 서버 최종 점수로 합산됩니다.",
    review: "승점 트랙과 보너스 표식을 다시 확인하면 왜 끝났는지 가장 빨리 이해할 수 있습니다.",
    tone: "amber",
  },
  blokus: {
    condition: "남은 조각 손실 최소화",
    basis: "남은 조각 점수, 모든 조각 사용 보너스, 마지막 한 칸 조각 보너스가 최종 점수입니다.",
    review: "영토 압박과 남은 조각을 보면 승자와 격차의 이유가 드러납니다.",
    tone: "sky",
  },
  mahe: {
    condition: "알 카드 총점 우위",
    basis: "트랙 보상으로 얻은 알 카드 합계가 승리 기준이며 동점이면 카드 수와 서버 판정 순서가 반영됩니다.",
    review: "마지막 보상 압력과 누적 알 카드 수를 보면 추격 실패 지점이 보입니다.",
    tone: "emerald",
  },
  dalmuti: {
    condition: "가장 먼저 손패 비우기",
    basis: "손패를 비운 순서가 다음 계급과 세금 흐름을 정합니다.",
    review: "손패 레이스와 패스 압력을 보면 다음 대달무티가 왜 결정됐는지 알 수 있습니다.",
    tone: "violet",
  },
  "six-nimmt": {
    condition: "누적 벌점 최소화",
    basis: "가져간 카드의 황소머리 합계가 낮을수록 유리합니다.",
    review: "행 위험과 선택 잠금을 보면 어느 선택이 벌점 격차를 만들었는지 보입니다.",
    tone: "rose",
  },
  telestrations: {
    condition: "릴레이 공개 완료",
    basis: "텔레스트레이션은 승패보다 원문, 그림, 추측이 어떻게 변했는지 보는 공개 경험이 핵심입니다.",
    review: "공개 해석 패널에서 문구 변화와 현재 항목을 따라가면 라운드 흐름이 이해됩니다.",
    tone: "cyan",
  },
  mafia: {
    condition: "팀 승리 조건 충족",
    basis: "마피아와 시민 생존 수, 처형/밤 결과, 서버 승리 팀 판정이 결과 근거입니다.",
    review: "투표 압박과 목표 인텔을 다시 보면 어느 밤/낮 선택이 승패를 갈랐는지 보입니다.",
    tone: "zinc",
  },
  poker: {
    condition: "핸드 또는 최종 팟 승리",
    basis: "서버 결과 설명을 우선하고, 없으면 공개 카드와 족보 비교로 승리 근거를 해석합니다.",
    review: "쇼다운 해설과 비교 카드를 보면 누가 어떤 족보로 팟을 가져갔는지 확인할 수 있습니다.",
    tone: "slate",
  },
};

const tabletopOutcomeToneClasses = {
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  sky: "border-sky-200 bg-sky-50 text-sky-900",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
  violet: "border-violet-200 bg-violet-50 text-violet-900",
  rose: "border-rose-200 bg-rose-50 text-rose-900",
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-900",
  zinc: "border-zinc-200 bg-zinc-50 text-zinc-900",
  slate: "border-slate-200 bg-slate-50 text-slate-900",
};

const tabletopOutcomeIsVisible = (gameState, status) => {
  const phase = String(get(gameState, "phase", "phase", "") || "").toUpperCase();
  return status === "FINISHED" || phase === "FINISHED" || phase === "HAND_FINISHED";
};

const buildTabletopOutcomeInsightItems = ({ game, config, selectedRoom, gameState, players, status }) => {
  const brief = tabletopOutcomeBriefs[game] || {
    condition: "종료 조건 충족",
    basis: "서버가 계산한 최종 점수와 승자 표식을 기준으로 결과를 표시합니다.",
    review: "결과 스포트라이트와 최근 행동을 함께 보면 판정 근거를 확인할 수 있습니다.",
    tone: "slate",
  };
  const scoreSignal = gameState
    ? buildTabletopScoreSignal(game, gameState, players)
    : {
        value: statusLabels[status] || `${config.title} 종료`,
        detail: `${config.title} 방이 종료 상태입니다. 상태 새로고침으로 최신 정산을 다시 확인할 수 있습니다.`,
      };
  const latestAction = gameState ? tabletopLatestActionText(game, gameState, players) : "방이 종료 상태로 전환되었습니다.";
  const roomCode = codeOf(selectedRoom);
  const playerCount = players.length || playersOf(selectedRoom).length || 0;
  const phase = String(get(gameState, "phase", "phase", status || "") || status || "FINISHED").toUpperCase();
  return [
    {
      key: "condition",
      icon: "stage",
      label: "승리 조건",
      value: brief.condition,
      detail: brief.basis,
      tone: tabletopOutcomeToneClasses[brief.tone] || tabletopOutcomeToneClasses.slate,
    },
    {
      key: "basis",
      icon: "win",
      label: "판정 근거",
      value: scoreSignal.value,
      detail: scoreSignal.detail,
      tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
    },
    {
      key: "review",
      icon: "decision",
      label: "다시 볼 지점",
      value: "결과 해석",
      detail: brief.review,
      tone: "border-cyan-200 bg-cyan-50 text-cyan-900",
    },
    {
      key: "session",
      icon: "recent",
      label: "세션 기록",
      value: roomCode ? `방 ${roomCode}` : `${playerCount || "-"}명 참여`,
      detail: `${phase} 상태입니다. 최근 기준: ${latestAction}`,
      tone: "border-slate-200 bg-slate-50 text-slate-800",
    },
  ];
};

const TabletopOutcomeInsightArt = ({ game, title, items = [] }) => {
  const brief = tabletopOutcomeBriefs[game] || tabletopOutcomeBriefs.poker;
  const colorByTone = {
    amber: "#f59e0b",
    sky: "#0ea5e9",
    emerald: "#10b981",
    violet: "#8b5cf6",
    rose: "#f43f5e",
    cyan: "#06b6d4",
    zinc: "#3f3f46",
    slate: "#475569",
  };
  const accent = colorByTone[brief.tone] || "#475569";
  const nodes = [
    { x: 58, y: 86, label: "조건" },
    { x: 142, y: 50, label: "근거" },
    { x: 238, y: 92, label: "해석" },
    { x: 322, y: 58, label: "다음" },
  ];
  return (
    <svg
      viewBox="0 0 380 150"
      role="img"
      aria-label={`${title} 종료 결과 해석 흐름`}
      className="h-36 w-full"
      data-smoke="tabletop-outcome-insight-art"
    >
      <rect x="12" y="14" width="356" height="122" rx="22" fill="#0f172a" />
      <path d="M42 104 C92 38 150 42 206 92 S302 94 342 42" fill="none" stroke="#334155" strokeWidth="11" strokeLinecap="round" />
      <path d="M42 104 C92 38 150 42 206 92 S302 94 342 42" fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" />
      <text x="28" y="36" fill="#cbd5e1" fontSize="11" fontWeight="900">OUTCOME</text>
      <text x="190" y="36" textAnchor="middle" fill="#ffffff" fontSize="14" fontWeight="900">{title}</text>
      {nodes.map((node, index) => (
        <g key={node.label} data-smoke="tabletop-outcome-insight-node">
          <circle cx={node.x} cy={node.y} r="21" fill={index === 1 ? "#fef3c7" : "#e0f2fe"} />
          <circle cx={node.x} cy={node.y} r="13" fill={index === 1 ? accent : "#0f172a"} />
          <text x={node.x} y={node.y + 4} textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="900">{index + 1}</text>
          <text x={node.x} y={node.y + 34} textAnchor="middle" fill="#dbeafe" fontSize="10" fontWeight="900">{node.label}</text>
        </g>
      ))}
      <rect x="82" y="112" width="216" height="20" rx="10" fill="#ffffff" opacity="0.12" />
      <text x="190" y="126" textAnchor="middle" fill="#f8fafc" fontSize="10" fontWeight="900">{items[0]?.value || "종료 조건"} · {items[1]?.value || "결과 확인"}</text>
    </svg>
  );
};

const TabletopOutcomeInsightPanel = ({ game, config, selectedRoom, gameState, players, status }) => {
  if (!tabletopOutcomeIsVisible(gameState, status)) return null;
  const items = buildTabletopOutcomeInsightItems({ game, config, selectedRoom, gameState, players, status });
  const phase = String(get(gameState, "phase", "phase", status || "") || status || "FINISHED").toUpperCase();
  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-3 shadow-lg"
      data-smoke="tabletop-outcome-insight-panel"
      data-outcome-game={game}
      data-outcome-status={status || ""}
      data-outcome-phase={phase}
    >
      <div className="grid gap-3 xl:grid-cols-[minmax(0,360px)_1fr] xl:items-center">
        <TabletopOutcomeInsightArt game={game} title={config.title} items={items} />
        <div className="min-w-0">
          <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-700">결과 인사이트 · 4단계</div>
          <h2 className="mt-2 text-lg font-black text-slate-950">왜 끝났는지 먼저 읽기</h2>
          <p className="mt-1 text-sm font-bold leading-relaxed text-slate-600">
            게임별 종료 조건과 판정 근거를 분리해 보여줍니다. 점수판을 다시 훑기 전에 승리 기준, 격차, 다시 볼 지점을 빠르게 확인하세요.
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {items.map((item) => (
              <div key={item.key} className={`min-h-[104px] rounded-xl border px-3 py-2 ${item.tone}`} data-smoke="tabletop-outcome-insight-item" data-outcome-key={item.key}>
                <div className="flex items-center gap-1.5 text-[10px] font-black opacity-70">
                  <GameUxGlyph type={item.icon} className="h-3.5 w-3.5" />
                  {item.label}
                </div>
                <div className="mt-1 line-clamp-2 text-sm font-black leading-snug">{item.value}</div>
                <div className="mt-1 line-clamp-3 text-xs font-bold leading-relaxed opacity-75">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const TabletopSessionActionArt = ({ title, roomCode, playerCount, isHost }) => {
  const nodes = [
    { x: 54, y: 92, label: "결과", fill: "#10b981" },
    { x: 128, y: 54, label: "동기화", fill: "#38bdf8" },
    { x: 210, y: 104, label: "허브", fill: "#f59e0b" },
    { x: 286, y: 70, label: isHost ? "재시작" : "퇴장", fill: isHost ? "#8b5cf6" : "#f43f5e" },
  ];

  return (
    <svg
      viewBox="0 0 340 180"
      role="img"
      aria-label={`${title} 종료 후 행동 흐름`}
      className="h-40 w-full"
      data-smoke="tabletop-session-action-art"
    >
      <rect x="8" y="10" width="324" height="160" rx="22" fill="#f8fafc" />
      <path d="M56 92 C96 40 158 42 206 102 S272 92 286 70" fill="none" stroke="#cbd5e1" strokeWidth="9" strokeLinecap="round" />
      <path d="M56 92 C96 40 158 42 206 102 S272 92 286 70" fill="none" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
      <rect x="34" y="132" width="268" height="32" rx="16" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
      <text x="52" y="153" fontSize="12" fontWeight="900" fill="#0f172a">{roomCode ? `방 ${roomCode}` : "종료된 방"}</text>
      <text x="264" y="153" textAnchor="end" fontSize="12" fontWeight="900" fill="#475569">{playerCount}명</text>
      <text x="26" y="34" fontSize="11" fontWeight="900" fill="#64748b">보드게임 세션</text>
      <text x="170" y="34" textAnchor="middle" fontSize="14" fontWeight="900" fill="#0f172a">{title}</text>
      {nodes.map((node) => (
        <g key={node.label} data-smoke="tabletop-session-action-node">
          <circle cx={node.x} cy={node.y} r="22" fill={node.fill} stroke="#ffffff" strokeWidth="5" />
          <circle cx={node.x} cy={node.y} r="27" fill="none" stroke="#e2e8f0" strokeWidth="2" />
          <text x={node.x} y={node.y + 5} textAnchor="middle" fontSize="10" fontWeight="900" fill="#ffffff">{node.label}</text>
        </g>
      ))}
    </svg>
  );
};

const TabletopSessionActionPanel = ({
  game,
  config,
  selectedRoom,
  gameState,
  players,
  status,
  isHost,
  busy,
  onRefresh,
  onRematch,
  onLeave,
}) => {
  const phase = String(get(gameState, "phase", "phase", "") || "").toUpperCase();
  if (status !== "FINISHED" && phase !== "FINISHED") return null;

  const scoreSignal = gameState
    ? buildTabletopScoreSignal(game, gameState, players)
    : {
        value: statusLabels[status] || "게임 종료",
        detail: `${config.title} 방이 종료되었습니다. 결과 정보가 비어 있으면 상태 새로고침으로 최신 정산을 확인하세요.`,
      };
  const latestAction = gameState ? tabletopLatestActionText(game, gameState, players) : "방이 종료 상태로 전환되었습니다.";
  const roomCode = codeOf(selectedRoom);
  const playerCount = players.length || playersOf(selectedRoom).length || 0;
  const actionItems = [
    {
      key: "result",
      icon: "win",
      label: "결과 확인",
      value: scoreSignal.value,
      detail: scoreSignal.detail,
    },
    {
      key: "sync",
      icon: "signal",
      label: "상태 동기화",
      value: "최신 방 상태",
      detail: "결과 직후 비어 있는 정산 정보가 있으면 방 상태를 다시 읽어 확인합니다.",
    },
    {
      key: "next",
      icon: "stage",
      label: isHost ? "다음 판 준비" : "다음 선택",
      value: isHost ? "다시 하기" : "게임 허브",
      detail: isHost ? "같은 방 멤버를 대기 상태로 돌려 재도전 흐름을 열 수 있습니다." : "허브에서 같은 게임이나 다른 보드게임을 고를 수 있습니다.",
    },
    {
      key: "leave",
      icon: "recent",
      label: "세션 정리",
      value: "방 나가기",
      detail: latestAction,
    },
  ];

  return (
    <section
      className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-lg"
      data-smoke="tabletop-session-action-panel"
      data-session-status={status || phase}
    >
      <div className="grid gap-3 xl:grid-cols-[minmax(0,340px)_1fr]">
        <TabletopSessionActionArt title={config.title} roomCode={roomCode} playerCount={playerCount} isHost={Boolean(isHost)} />
        <div className="min-w-0">
          <div className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700">세션 정리</div>
          <h2 className="mt-2 text-lg font-black text-slate-950">결과 이후 다음 행동</h2>
          <p className="mt-1 text-sm font-bold leading-relaxed text-slate-600">
            승리 근거를 확인한 뒤 상태를 새로고침하거나, 허브로 돌아가거나, 방을 나가 세션을 정리할 수 있습니다.
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {actionItems.map((item) => (
              <div key={item.key} className="min-h-[104px] rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" data-smoke="tabletop-session-action-item">
                <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500">
                  <GameUxGlyph type={item.icon} className="h-3.5 w-3.5 text-emerald-600" />
                  {item.label}
                </div>
                <div className="mt-1 line-clamp-2 text-sm font-black leading-snug text-slate-950">{item.value}</div>
                <div className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-slate-600">{item.detail}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white disabled:opacity-40"
              disabled={busy}
              onClick={onRefresh}
              data-smoke="tabletop-session-action-refresh"
            >
              <RefreshCw className="h-4 w-4" />
              상태 새로고침
            </button>
            {isHost && (
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white disabled:opacity-40"
                disabled={busy}
                onClick={onRematch}
                data-smoke="tabletop-session-action-rematch"
              >
                다시 하기
              </button>
            )}
            <Link
              to="/app/games"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-900 hover:text-white"
              data-smoke="tabletop-session-action-hub"
            >
              게임 허브
            </Link>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-rose-50 px-4 py-2 text-sm font-black text-rose-600 disabled:opacity-40"
              disabled={busy}
              onClick={onLeave}
              data-smoke="tabletop-session-action-leave"
            >
              방 나가기
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

const buildTabletopActionReadinessItems = ({ game, gameState, players, status, mySeatNo, startStatusText, actionBusy }) => {
  const phase = String(get(gameState, "phase", "phase", "") || "").toUpperCase();
  const activeSeatNo = tabletopTurnSeatForSound(game, gameState);
  const activeName = activeSeatNo ? tabletopPlayerName(players, activeSeatNo) : "동시 진행";
  const myTurn = Boolean(status === "PLAYING" && activeSeatNo && Number(mySeatNo) === activeSeatNo);
  const phaseLabel = tabletopPhaseLabel(game, gameState, status);
  const scoreSignal = buildTabletopScoreSignal(game, gameState, players);
  const decisionSignal = buildTabletopDecisionSignal(game, gameState, players, status, mySeatNo, startStatusText);
  const latestAction = tabletopLatestActionText(game, gameState, players);
  const myState = statePlayersForDecision(gameState).find((player) => tabletopStateSeatNo(player) === Number(mySeatNo));
  const genericLock = actionBusy
    ? "서버 판정 중이라 새 행동은 잠시 잠깁니다."
    : myTurn
      ? "강조된 버튼, 선택한 대상, 보드 위 합법 위치를 확인하세요."
      : `${activeName} 차례가 끝나면 내 선택 가능성이 다시 갱신됩니다.`;
  const profile = (() => {
    if (status === "WAITING") {
      return {
        input: "준비 상태",
        inputDetail: startStatusText || "인원과 준비 상태를 맞추면 방장이 시작할 수 있습니다.",
        lock: "시작 조건",
        lockDetail: startStatusText || "아직 게임 시작 전입니다.",
        next: "게임 시작",
        nextDetail: "시작 후 이 영역이 실제 행동 조건으로 바뀝니다.",
        icon: "player",
      };
    }
    if (phase === "FINISHED" || status === "FINISHED") {
      return {
        input: "결과 확인",
        inputDetail: scoreSignal.detail,
        lock: "행동 종료",
        lockDetail: "이번 판의 행동 입력은 닫혔습니다. 결과와 다시하기 흐름을 확인하세요.",
        next: scoreSignal.value,
        nextDetail: latestAction,
        icon: "win",
      };
    }
    if (game === "catan") {
      const catanInputByPhase = {
        INITIAL_PLACEMENT: ["초기 배치", "정착지와 도로 후보를 보고 다음 생산 자원 조합을 만듭니다."],
        ROLL_DICE: ["주사위 굴림", "굴림 후 생산, 도둑, 건설·교역 단계가 열립니다."],
        ROBBER: ["도둑 처리", "도둑 위치와 약탈 대상을 골라 자원 흐름을 흔듭니다."],
        ACTION: ["건설·교역", "자원, 비용, 교역 조건을 보고 건설하거나 턴을 넘깁니다."],
        DISCARD: ["자원 버리기", "초과 자원 수량에 맞춰 버릴 카드를 선택합니다."],
      };
      const [input, inputDetail] = catanInputByPhase[phase] || ["카탄 행동", "현재 단계의 강조 버튼과 보드 후보를 확인하세요."];
      return {
        input,
        inputDetail,
        lock: "조건 확인",
        lockDetail: myTurn ? "자원 보유량, 도둑 처리, 선택 대상이 맞아야 버튼이 열립니다." : `${activeName}님의 단계가 끝날 때까지 대기합니다.`,
        next: "승점 흐름",
        nextDetail: scoreSignal.detail,
        icon: "build",
      };
    }
    if (game === "blokus") {
      const remainingPieces = listOf(get(myState, "remaining_pieces", "remainingPieces", [])).length || tabletopNumber(get(myState, "remaining_piece_count", "remainingPieceCount", 0));
      return {
        input: myTurn ? "조각+칸 선택" : "배치 대기",
        inputDetail: myTurn ? "조각을 고른 뒤 보드 칸을 찍으면 합법 배치 여부가 표시됩니다." : `${activeName}님의 조각 배치를 관찰하세요.`,
        lock: "잠김 이유",
        lockDetail: myTurn ? "내 색 차례, 남은 조각, 모서리 연결, 겹침 여부가 모두 맞아야 배치됩니다." : genericLock,
        next: remainingPieces ? `남은 조각 ${remainingPieces}개` : "영역 싸움",
        nextDetail: scoreSignal.detail,
        icon: "build",
      };
    }
    if (game === "mahe") {
      const dice = listOf(get(gameState, "dice", "dice", []));
      const diceRollsLeft = tabletopNumber(get(gameState, "dice_rolls_left", "diceRollsLeft", 0));
      return {
        input: phase === "CHOOSE_DICE_COUNT" ? "주사위 개수" : phase === "ROLLING" ? "굴림/멈춤" : "트랙 확인",
        inputDetail: phase === "CHOOSE_DICE_COUNT" ? "위험률과 이동 칸 수를 비교해 1~3개 중 선택합니다." : `현재 주사위 ${dice.length}개 · 남은 굴림 ${diceRollsLeft}회`,
        lock: "실패 조건",
        lockDetail: "합계가 7을 넘으면 차례가 무너집니다. 다음 굴림 미리보기를 먼저 보세요.",
        next: "보상 카드",
        nextDetail: scoreSignal.detail,
        icon: "coin",
      };
    }
    if (game === "dalmuti") {
      return {
        input: phase === "TAX_RETURN" ? "세금 반납" : phase === "REVOLUTION_DECISION" ? "혁명 결정" : "카드 제출",
        inputDetail: decisionSignal.detail,
        lock: "제출 기준",
        lockDetail: phase === "PLAYING" ? "같은 계급, 필요한 장수, 현재 기준보다 높은 조합일 때 제출할 수 있습니다." : "현재 단계의 대상자와 선택 수량 조건을 맞춰야 합니다.",
        next: "계급 순서",
        nextDetail: scoreSignal.detail,
        icon: "input",
      };
    }
    if (game === "six-nimmt") {
      const mySubmitted = Boolean(get(myState, "selected", "selected", false));
      return {
        input: phase === "SELECTING" ? (mySubmitted ? "카드 제출 완료" : "카드 선택") : "행 선택",
        inputDetail: phase === "SELECTING" ? "손패에서 낼 카드 한 장을 고르면 공개 단계까지 대기합니다." : "가져갈 위험 행을 직접 골라 벌점을 줄입니다.",
        lock: "진행 조건",
        lockDetail: mySubmitted ? "다른 플레이어 선택이 끝나면 카드가 공개됩니다." : "선택 카드가 없거나 현재 단계가 아니면 제출할 수 없습니다.",
        next: "벌점 압박",
        nextDetail: scoreSignal.detail,
        icon: "decision",
      };
    }
    if (game === "telestrations") {
      const mySubmitted = Boolean(get(gameState, "my_submitted", "mySubmitted", false));
      return {
        input: mySubmitted ? "제출 완료" : "문장/그림 제출",
        inputDetail: get(gameState, "current_task", "currentTask", "") || decisionSignal.detail,
        lock: "입력 조건",
        lockDetail: mySubmitted ? "다른 플레이어 제출을 기다립니다." : "현재 라운드 입력이 비어 있으면 제출할 수 없습니다.",
        next: "릴레이 변화",
        nextDetail: latestAction,
        icon: "input",
      };
    }
    if (game === "mafia") {
      const mySubmitted = Boolean(get(gameState, "my_submitted", "mySubmitted", false));
      return {
        input: mySubmitted ? "행동 제출 완료" : "대상 선택",
        inputDetail: get(gameState, "my_task", "myTask", "") || decisionSignal.detail,
        lock: "역할/단계",
        lockDetail: mySubmitted ? "밤/투표 결과 공개를 기다립니다." : "내 역할, 생존 상태, 현재 단계에 맞는 대상만 선택할 수 있습니다.",
        next: "생존 균형",
        nextDetail: scoreSignal.detail,
        icon: "player",
      };
    }
    if (game === "poker") {
      const callAmount = tabletopNumber(get(gameState, "call_amount", "callAmount", 0));
      const pot = tabletopNumber(get(gameState, "pot", "pot", 0));
      return {
        input: myTurn ? "베팅 판단" : "상대 액션 대기",
        inputDetail: phase === "DRAW" ? "교체할 카드를 고르거나 그대로 진행합니다." : `콜 ${callAmount}칩 · 팟 ${pot}칩`,
        lock: "베팅 조건",
        lockDetail: myTurn ? "현재 콜 금액, 보유 칩, 드로우 단계 조건에 맞는 버튼만 열립니다." : genericLock,
        next: "쇼다운 근거",
        nextDetail: scoreSignal.detail,
        icon: "coin",
      };
    }
    return {
      input: decisionSignal.value,
      inputDetail: decisionSignal.detail,
      lock: "선택 조건",
      lockDetail: genericLock,
      next: scoreSignal.value,
      nextDetail: scoreSignal.detail,
      icon: "decision",
    };
  })();

  return [
    {
      key: "turn",
      icon: "turn",
      label: "내 차례",
      value: actionBusy ? "판정 중" : myTurn ? "행동 가능" : status === "PLAYING" ? `${activeName} 대기` : phaseLabel,
      detail: myTurn ? "지금 선택 가능한 버튼과 보드 후보를 확인하세요." : decisionSignal.detail,
      tone: actionBusy ? "pending" : myTurn ? "active" : "neutral",
    },
    {
      key: "input",
      icon: profile.icon || "decision",
      label: "필요 입력",
      value: profile.input,
      detail: profile.inputDetail,
      tone: myTurn ? "active" : "neutral",
    },
    {
      key: "lock",
      icon: "state",
      label: profile.lock,
      value: actionBusy ? "서버 판정" : myTurn ? "조건 확인" : "대기",
      detail: profile.lockDetail,
      tone: actionBusy ? "pending" : myTurn ? "waiting" : "neutral",
    },
    {
      key: "next",
      icon: phase === "FINISHED" ? "win" : "recent",
      label: "다음 변화",
      value: profile.next,
      detail: profile.nextDetail,
      tone: phase === "FINISHED" ? "done" : "neutral",
    },
  ];
};

const tabletopActionReadinessArtTones = {
  active: { fill: "#ecfdf5", stroke: "#10b981", text: "#047857", accent: "#34d399" },
  waiting: { fill: "#fffbeb", stroke: "#f59e0b", text: "#92400e", accent: "#fbbf24" },
  pending: { fill: "#eff6ff", stroke: "#3b82f6", text: "#1d4ed8", accent: "#60a5fa" },
  done: { fill: "#f0fdf4", stroke: "#22c55e", text: "#166534", accent: "#86efac" },
  neutral: { fill: "#f8fafc", stroke: "#94a3b8", text: "#334155", accent: "#cbd5e1" },
};

const tabletopActionReadinessArtLabels = {
  turn: "차례",
  input: "입력",
  lock: "조건",
  next: "다음",
};

const TabletopActionReadinessArt = ({ items = [], myTurn, actionBusy, phaseLabel, className = "" }) => {
  const nodes = items.slice(0, 4);
  const routeTone = actionBusy ? "#2563eb" : myTurn ? "#059669" : "#64748b";
  const statusText = actionBusy ? "서버 조정" : myTurn ? "내 차례" : phaseLabel || "상태 확인";
  const headline = actionBusy ? "처리 확인" : myTurn ? "행동 가능" : "상황 대기";
  const points = [
    { x: 54, y: 118 },
    { x: 154, y: 84 },
    { x: 254, y: 118 },
    { x: 354, y: 84 },
  ];
  const routePath = `M ${points[0].x} ${points[0].y} C 94 94, 114 94, ${points[1].x} ${points[1].y} S 214 106, ${points[2].x} ${points[2].y} S 314 94, ${points[3].x} ${points[3].y}`;

  const iconPathFor = (key) => {
    if (key === "turn") return "M -9 0 h18 M 2 -7 l7 7 -7 7";
    if (key === "input") return "M -9 -6 h18 v12 h-18 z M -4 0 h8";
    if (key === "lock") return "M -8 -1 h16 v9 h-16 z M -4 -1 v-4 a4 4 0 0 1 8 0 v4";
    return "M -8 6 l7 -12 6 8 4 -5";
  };

  return (
    <svg
      viewBox="0 0 420 180"
      role="img"
      aria-label="보드게임 행동 준비 흐름"
      className={className}
      data-smoke="tabletop-action-readiness-art"
    >
      <rect x="10" y="10" width="400" height="160" rx="20" fill="#ffffff" stroke="#e2e8f0" />
      <rect x="22" y="22" width="152" height="44" rx="14" fill="#f8fafc" stroke="#e2e8f0" />
      <text x="34" y="40" fill="#0f172a" fontSize="14" fontWeight="900">행동 준비</text>
      <text x="34" y="56" fill="#64748b" fontSize="11" fontWeight="800">{headline}</text>
      <rect x="292" y="25" width="88" height="30" rx="15" fill={myTurn ? "#dcfce7" : actionBusy ? "#dbeafe" : "#f1f5f9"} stroke={myTurn ? "#86efac" : actionBusy ? "#93c5fd" : "#cbd5e1"} />
      <text x="336" y="44" textAnchor="middle" fill={myTurn ? "#166534" : actionBusy ? "#1d4ed8" : "#475569"} fontSize="11" fontWeight="900">{statusText}</text>
      <path d={routePath} fill="none" stroke={routeTone} strokeWidth="12" strokeLinecap="round" opacity="0.12" />
      <path d={routePath} fill="none" stroke={routeTone} strokeWidth="3" strokeLinecap="round" />
      <polygon points="366,84 354,77 355,91" fill={routeTone} />
      {nodes.map((node, index) => {
        const point = points[index] || points[points.length - 1];
        const tone = tabletopActionReadinessArtTones[node.tone] || tabletopActionReadinessArtTones.neutral;
        const label = tabletopActionReadinessArtLabels[node.key] || node.label || "";
        return (
          <g key={node.key || `${label}-${index}`} data-smoke="tabletop-action-readiness-node" data-action-key={node.key || ""}>
            <circle cx={point.x} cy={point.y} r="28" fill={tone.fill} stroke={tone.stroke} strokeWidth="3" />
            <circle cx={point.x} cy={point.y} r="18" fill="#ffffff" stroke={tone.accent} strokeWidth="2" />
            <path d={iconPathFor(node.key)} transform={`translate(${point.x} ${point.y - 2})`} fill="none" stroke={tone.text} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <text x={point.x} y={point.y + 44} textAnchor="middle" fill={tone.text} fontSize="12" fontWeight="900">{label}</text>
          </g>
        );
      })}
      <text x="210" y="160" textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="800">차례 → 입력 → 조건 → 다음 변화</text>
    </svg>
  );
};

const TabletopActionReadinessPanel = ({ game, gameState, players, status, mySeatNo, startStatusText, actionBusy }) => {
  if (!gameState) return null;
  const phaseLabel = tabletopPhaseLabel(game, gameState, status);
  const activeSeatNo = tabletopTurnSeatForSound(game, gameState);
  const myTurn = Boolean(status === "PLAYING" && activeSeatNo && Number(mySeatNo) === activeSeatNo);
  const items = buildTabletopActionReadinessItems({ game, gameState, players, status, mySeatNo, startStatusText, actionBusy });
  const shellTone = actionBusy
    ? "border-sky-200 bg-sky-50"
    : myTurn
      ? "border-emerald-200 bg-emerald-50"
      : "border-slate-200 bg-white";
  const pillTone = actionBusy
    ? "bg-sky-100 text-sky-700"
    : myTurn
      ? "bg-emerald-100 text-emerald-800"
      : "bg-slate-100 text-slate-600";
  const tileTone = {
    active: "border-emerald-200 bg-white text-emerald-800",
    waiting: "border-amber-200 bg-white text-amber-800",
    pending: "border-sky-200 bg-white text-sky-800",
    done: "border-emerald-200 bg-emerald-50 text-emerald-800",
    neutral: "border-slate-100 bg-white text-slate-700",
  };

  return (
    <section className={`rounded-2xl border p-3 shadow-sm ${shellTone}`} data-smoke="tabletop-action-readiness-panel" data-my-turn={myTurn ? "true" : "false"} data-action-busy={actionBusy ? "true" : "false"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-black text-slate-950">
            <GameUxGlyph type="decision" className="h-4 w-4 text-emerald-600" />
            행동 준비
          </div>
          <p className="mt-1 text-xs font-bold leading-relaxed text-slate-600">실제 버튼을 누르기 전에 차례, 필요한 입력, 잠김 조건, 다음 변화를 확인합니다.</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-black ${pillTone}`}>
          {actionBusy ? "서버 판정" : myTurn ? "내 행동 가능" : phaseLabel}
        </span>
      </div>
      <TabletopActionReadinessArt items={items} myTurn={myTurn} actionBusy={actionBusy} phaseLabel={phaseLabel} className="mt-3 h-44 w-full" />
      <div className="mt-3 grid gap-2 md:grid-cols-4">
        {items.map((item) => (
          <div key={item.key} className={`min-h-[108px] rounded-xl border px-3 py-2 ${tileTone[item.tone] || tileTone.neutral}`} data-smoke="tabletop-action-readiness-item">
            <div className="flex items-center gap-1.5 text-[10px] font-black">
              <GameUxGlyph type={item.icon} className="h-3.5 w-3.5" />
              {item.label}
            </div>
            <div className="mt-1 line-clamp-2 text-sm font-black leading-snug text-slate-950">{item.value}</div>
            <div className="mt-1 line-clamp-3 text-xs font-bold leading-relaxed text-slate-600">{item.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
};

const TabletopExperienceRibbon = ({
  game,
  gameState,
  players,
  status,
  mySeatNo,
  isHost,
  myReady,
  canStart,
  startStatusText,
}) => {
  const phaseLabel = tabletopPhaseLabel(game, gameState, status);
  const activeSeatNo = tabletopTurnSeatForSound(game, gameState);
  const activeName = activeSeatNo ? tabletopPlayerName(players, activeSeatNo) : "-";
  const myTurn = Boolean(status === "PLAYING" && activeSeatNo && Number(mySeatNo) === activeSeatNo);
  const latestAction = tabletopLatestActionText(game, gameState, players);
  const myStateText = status === "WAITING"
    ? isHost
      ? canStart ? "방장 · 시작 가능" : `방장 · ${startStatusText}`
      : myReady ? "준비 완료" : "준비 필요"
    : myTurn ? "지금 내 차례" : activeSeatNo ? `${activeName} 차례 대기` : "상태 확인";
  const currentTask = status === "WAITING"
    ? canStart ? "게임 시작 버튼을 누르면 본게임으로 진입합니다." : startStatusText
    : myTurn ? "강조된 액션 패널에서 가능한 행동을 선택하세요." : `${activeName}님의 행동을 기다리는 중입니다.`;

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-slate-950 p-3 text-white shadow-inner" data-smoke="tabletop-experience-ribbon">
      <div className="grid gap-2 md:grid-cols-4">
        <div className="rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/10">
          <div className="flex items-center gap-1.5 text-[10px] font-black text-white/55">
            <GameUxGlyph type="state" className="h-3.5 w-3.5" />
            진행 상태
          </div>
          <div className="mt-1 text-sm font-black">{statusLabels[status] || status || "대기"}</div>
          <div className="mt-0.5 truncate text-[11px] font-bold text-white/55">{phaseLabel}</div>
        </div>
        <div className={`rounded-xl px-3 py-2 ring-1 ${myTurn ? "bg-emerald-400 text-slate-950 ring-emerald-200" : "bg-white/10 text-white ring-white/10"}`}>
          <div className={`flex items-center gap-1.5 text-[10px] font-black ${myTurn ? "text-slate-800" : "text-white/55"}`}>
            <GameUxGlyph type="turn" className="h-3.5 w-3.5" />
            현재 차례
          </div>
          <div className="mt-1 truncate text-sm font-black">{status === "PLAYING" ? activeName : "대기방"}</div>
          <div className={`mt-0.5 truncate text-[11px] font-bold ${myTurn ? "text-slate-800/75" : "text-white/55"}`}>{myTurn ? "내 행동 필요" : phaseLabel}</div>
        </div>
        <div className="rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/10">
          <div className="flex items-center gap-1.5 text-[10px] font-black text-white/55">
            <GameUxGlyph type="player" className="h-3.5 w-3.5" />
            내 상태
          </div>
          <div className="mt-1 truncate text-sm font-black">{myStateText}</div>
          <div className="mt-0.5 truncate text-[11px] font-bold text-white/55">좌석 {mySeatNo || "-"}</div>
        </div>
        <div className="rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/10">
          <div className="flex items-center gap-1.5 text-[10px] font-black text-white/55">
            <GameUxGlyph type="recent" className="h-3.5 w-3.5" />
            최근 행동
          </div>
          <div className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-white/80">{latestAction}</div>
        </div>
      </div>
      <div className="mt-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold leading-relaxed text-white/70">
        {currentTask}
      </div>
    </section>
  );
};

const tabletopTurnOrderTone = ({ winner, active, mine, ready }) => {
  if (winner) return { fill: "#10b981", stroke: "#047857", text: "#ecfdf5", label: "승리" };
  if (active) return { fill: "#f59e0b", stroke: "#92400e", text: "#fffbeb", label: "현재 차례" };
  if (mine) return { fill: "#38bdf8", stroke: "#0369a1", text: "#f0f9ff", label: "내 좌석" };
  if (ready) return { fill: "#e0f2fe", stroke: "#0284c7", text: "#0f172a", label: "준비" };
  return { fill: "#f8fafc", stroke: "#94a3b8", text: "#0f172a", label: "대기" };
};

const TabletopTurnOrderArt = ({ players, selectedRoom, status, activeSeatNo, winnerSeatNos, mySeatNo }) => {
  const visiblePlayers = players.slice(0, 8);
  const count = Math.max(visiblePlayers.length, 1);
  const pathPoints = visiblePlayers.length
    ? visiblePlayers.map((_, index) => {
        const x = 34 + (count === 1 ? 150 : (index * 300) / (count - 1));
        const y = 66 + (index % 2 === 0 ? -12 : 12);
        return `${x},${y}`;
      })
    : ["34,66", "334,66"];
  const routePath = `M ${pathPoints.join(" L ")}`;

  return (
    <svg
      viewBox="0 0 360 132"
      className="h-full w-full"
      role="img"
      aria-label="보드게임 턴 순서 시각화"
      data-smoke="tabletop-turn-order-art"
    >
      <rect x="8" y="8" width="344" height="116" rx="24" fill="#0f172a" />
      <path d="M22 105 C82 72 122 112 172 72 S276 38 338 70" fill="none" stroke="#1e293b" strokeWidth="18" strokeLinecap="round" />
      <path d={routePath} fill="none" stroke="#64748b" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      {visiblePlayers.length ? visiblePlayers.map((player, index) => {
        const seatNo = seatNoOf(player);
        const mine = Number(mySeatNo) === seatNo;
        const active = Number(activeSeatNo) === seatNo && status === "PLAYING";
        const winner = winnerSeatNos.has(seatNo);
        const host = memberIdOf(player) === hostMemberIdOf(selectedRoom);
        const ready = host || isReady(player);
        const tone = tabletopTurnOrderTone({ winner, active, mine, ready });
        const x = 34 + (count === 1 ? 150 : (index * 300) / (count - 1));
        const y = 66 + (index % 2 === 0 ? -12 : 12);
        return (
          <g key={memberIdOf(player) || seatNo || index} transform={`translate(${x} ${y})`} data-smoke="tabletop-turn-order-node">
            <circle r={active ? 18 : 15} fill={tone.fill} stroke={tone.stroke} strokeWidth="4" />
            <circle r="7" fill={tone.text} opacity=".95" />
            <text x="0" y="34" textAnchor="middle" fontSize="9" fontWeight="900" fill="#e2e8f0">{seatNo || index + 1}</text>
          </g>
        );
      }) : (
        <g data-smoke="tabletop-turn-order-node">
          <circle cx="180" cy="66" r="16" fill="#f8fafc" stroke="#94a3b8" strokeWidth="4" />
          <text x="180" y="101" textAnchor="middle" fontSize="9" fontWeight="900" fill="#e2e8f0">대기</text>
        </g>
      )}
      <text x="24" y="30" fontSize="10" fontWeight="900" fill="#cbd5e1">턴 순서</text>
      <text x="336" y="30" textAnchor="end" fontSize="10" fontWeight="900" fill="#cbd5e1">{statusLabels[status] || status || "대기"}</text>
    </svg>
  );
};

const TabletopTurnOrderPanel = ({ game, gameState, players, selectedRoom, status, mySeatNo }) => {
  const activeSeatNo = tabletopTurnSeatForSound(game, gameState);
  const winnerSeatNos = tabletopPlayerPanelWinners(gameState);
  const phaseLabel = tabletopPhaseLabel(game, gameState, status);
  const latestAction = tabletopLatestActionText(game, gameState, players);
  const readyCount = players.filter((player) => memberIdOf(player) === hostMemberIdOf(selectedRoom) || isReady(player)).length;
  const activeName = activeSeatNo ? tabletopPlayerName(players, activeSeatNo) : "";
  const winnerNames = players
    .filter((player) => winnerSeatNos.has(seatNoOf(player)))
    .map((player) => player.nickname)
    .filter(Boolean);
  const summaryText = winnerNames.length
    ? `${winnerNames.join(", ")} 승리`
    : status === "WAITING"
      ? `준비 ${readyCount}/${players.length}`
      : activeName
        ? `${activeName} 차례`
        : phaseLabel;
  const detailText = status === "WAITING"
    ? "좌석 순서와 준비 상태를 보고 시작 조건을 맞춥니다."
    : winnerNames.length
      ? "승자 좌석과 최종 점수 흐름을 확인한 뒤 다시하기를 선택합니다."
      : "좌석 순서, 내 좌석, 현재 차례를 기준으로 보드를 읽습니다.";

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg" data-smoke="tabletop-turn-order-panel">
      <div className="grid gap-3 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="min-h-[132px] overflow-hidden rounded-2xl bg-slate-950" data-smoke="tabletop-turn-order-art-wrap">
          <TabletopTurnOrderArt
            players={players}
            selectedRoom={selectedRoom}
            status={status}
            activeSeatNo={activeSeatNo}
            winnerSeatNos={winnerSeatNos}
            mySeatNo={mySeatNo}
          />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                <GameUxGlyph type="turn" className="h-4 w-4 text-amber-600" />
                턴 순서
              </div>
              <p className="mt-1 text-xs font-bold leading-relaxed text-slate-600">{detailText}</p>
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600" data-smoke="tabletop-turn-order-summary">
              {summaryText}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {players.map((player, index) => {
              const seatNo = seatNoOf(player);
              const mine = Number(mySeatNo) === seatNo;
              const active = Number(activeSeatNo) === seatNo && status === "PLAYING";
              const winner = winnerSeatNos.has(seatNo);
              const host = memberIdOf(player) === hostMemberIdOf(selectedRoom);
              const ready = host || isReady(player);
              const scoreText = tabletopPlayerPanelScore(game, gameState, seatNo);
              const tone = tabletopTurnOrderTone({ winner, active, mine, ready });
              return (
                <div key={memberIdOf(player) || seatNo || index} className="min-h-[94px] rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" data-smoke="tabletop-turn-order-player">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-black text-slate-950">{player.nickname || `좌석 ${seatNo || index + 1}`}</span>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black" style={{ backgroundColor: tone.fill, color: tone.text }}>
                      {tone.label}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] font-bold leading-relaxed text-slate-500">
                    좌석 {seatNo || "-"}{host ? " · 방장" : ""}{scoreText ? ` · ${scoreText}` : ""}
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-200">
                    <div className="h-1.5 rounded-full" style={{ width: active || winner ? "100%" : mine ? "72%" : ready ? "52%" : "28%", backgroundColor: tone.stroke }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold leading-relaxed text-slate-600">
            최근 근거: {latestAction}
          </div>
        </div>
      </div>
    </section>
  );
};

const tabletopRoomBriefs = {
  catan: {
    objective: "자원 생산 위치를 선점하고 도로, 마을, 도시로 승점을 먼저 쌓는 전략 게임입니다.",
    firstDecision: "초기 배치에서 어떤 자원 조합을 가져갈지 정합니다.",
    winSignal: "목표 승점에 가까운 공개 점수와 항구/개발 카드 흐름을 봅니다.",
  },
  blokus: {
    objective: "내 조각을 최대한 많이 놓고 상대 확장 경로를 막는 공간 장악 게임입니다.",
    firstDecision: "초반에는 모서리 연결을 유지하면서 중앙 진입로를 열어 둡니다.",
    winSignal: "남은 조각 칸 수가 적을수록 유리합니다.",
  },
  mahe: {
    objective: "거북이를 전진시켜 알 카드를 얻되, 욕심내다 7을 넘기면 차례가 무너집니다.",
    firstDecision: "주사위를 몇 개까지 굴릴지 위험도를 보고 정합니다.",
    winSignal: "알 카드 점수와 업힌 위치가 다음 보상 흐름을 만듭니다.",
  },
  dalmuti: {
    objective: "손패를 먼저 비워 계급을 올리고 다음 판의 유리한 자리로 이동합니다.",
    firstDecision: "같은 계급 카드를 몇 장씩 낼지, 언제 패스할지 정합니다.",
    winSignal: "먼저 탈출한 순서가 다음 계급과 세금 흐름을 결정합니다.",
  },
  "six-nimmt": {
    objective: "동시에 카드를 내고 벌점이 적은 행을 피하는 숫자 카드 게임입니다.",
    firstDecision: "내 카드가 어느 행에 붙을지, 여섯 번째가 될 위험을 봅니다.",
    winSignal: "누적 벌점 66점에 가까운 플레이어와 위험 행을 확인합니다.",
  },
  telestrations: {
    objective: "문장과 그림이 번갈아 이어지는 파티 릴레이입니다.",
    firstDecision: "현재 단계가 문장 입력인지 그림 입력인지 확인하고 제한된 정보만 보고 제출합니다.",
    winSignal: "마지막 공개에서 원래 문장이 어떻게 변했는지가 보상입니다.",
  },
  mafia: {
    objective: "밤에는 비밀 역할, 낮에는 토론과 투표로 진영 승리를 노립니다.",
    firstDecision: "내 역할과 현재 단계에서 가능한 대상이 누구인지 먼저 봅니다.",
    winSignal: "생존한 마피아와 시민 수의 균형이 승패 조건입니다.",
  },
  poker: {
    objective: "칩을 지키면서 강한 족보나 좋은 교체/베팅 기회를 노립니다.",
    firstDecision: "현재 패, 콜 금액, 팟 크기를 비교해 참여할지 정합니다.",
    winSignal: "쇼다운에서는 족보와 키커, 중도에는 폴드 유도가 승리 이유가 됩니다.",
  },
};

const tabletopRoomBriefArtTones = {
  first: { fill: "#eef2ff", stroke: "#6366f1", text: "#3730a3", accent: "#818cf8" },
  win: { fill: "#f0fdf4", stroke: "#22c55e", text: "#166534", accent: "#86efac" },
  ready: { fill: "#fffbeb", stroke: "#f59e0b", text: "#92400e", accent: "#fbbf24" },
  rule: { fill: "#f8fafc", stroke: "#94a3b8", text: "#334155", accent: "#cbd5e1" },
};

const tabletopRoomBriefArtLabels = {
  first: "첫 판단",
  win: "승리 신호",
  ready: "시작 준비",
  rule: "선택 규칙",
};

const TabletopRoomBriefArt = ({ tiles = [], status, canStart, className = "" }) => {
  const nodes = tiles.slice(0, 4);
  const routeTone = status === "WAITING" ? (canStart ? "#059669" : "#d97706") : "#2563eb";
  const statusText = status === "WAITING" ? (canStart ? "시작 가능" : "대기 확인") : (statusLabels[status] || status || "상태 확인");
  const points = [
    { x: 54, y: 112 },
    { x: 154, y: 82 },
    { x: 254, y: 112 },
    { x: 354, y: 82 },
  ];
  const routePath = `M ${points[0].x} ${points[0].y} C 94 88, 114 88, ${points[1].x} ${points[1].y} S 214 100, ${points[2].x} ${points[2].y} S 314 88, ${points[3].x} ${points[3].y}`;

  const iconPathFor = (key) => {
    if (key === "first") return "M -9 0 h18 M 2 -7 l7 7 -7 7";
    if (key === "win") return "M -8 6 l4 -12 5 8 5 -8 4 12 z";
    if (key === "ready") return "M -9 1 l5 5 13 -13";
    return "M -9 -5 h18 v10 h-18 z M -4 0 h8";
  };

  return (
    <svg
      viewBox="0 0 420 174"
      role="img"
      aria-label="보드게임 방 입장 브리프 흐름"
      className={className}
      data-smoke="tabletop-room-brief-art"
    >
      <rect x="10" y="10" width="400" height="154" rx="20" fill="#ffffff" stroke="#e2e8f0" />
      <rect x="24" y="22" width="158" height="42" rx="14" fill="#f8fafc" stroke="#e2e8f0" />
      <text x="36" y="40" fill="#0f172a" fontSize="14" fontWeight="900">방 입장 브리프</text>
      <text x="36" y="56" fill="#64748b" fontSize="11" fontWeight="800">첫 10초 판단</text>
      <rect x="286" y="24" width="96" height="30" rx="15" fill={status === "WAITING" ? (canStart ? "#dcfce7" : "#fef3c7") : "#dbeafe"} stroke={status === "WAITING" ? (canStart ? "#86efac" : "#fcd34d") : "#93c5fd"} />
      <text x="334" y="43" textAnchor="middle" fill={status === "WAITING" ? (canStart ? "#166534" : "#92400e") : "#1d4ed8"} fontSize="11" fontWeight="900">{statusText}</text>
      <path d={routePath} fill="none" stroke={routeTone} strokeWidth="12" strokeLinecap="round" opacity="0.12" />
      <path d={routePath} fill="none" stroke={routeTone} strokeWidth="3" strokeLinecap="round" />
      <polygon points="366,82 354,75 355,89" fill={routeTone} />
      {nodes.map((node, index) => {
        const point = points[index] || points[points.length - 1];
        const tone = tabletopRoomBriefArtTones[node.key] || tabletopRoomBriefArtTones.rule;
        const label = tabletopRoomBriefArtLabels[node.key] || node.label || "";
        return (
          <g key={node.key || `${label}-${index}`} data-smoke="tabletop-room-brief-node" data-brief-key={node.key || ""}>
            <circle cx={point.x} cy={point.y} r="28" fill={tone.fill} stroke={tone.stroke} strokeWidth="3" />
            <circle cx={point.x} cy={point.y} r="18" fill="#ffffff" stroke={tone.accent} strokeWidth="2" />
            <path d={iconPathFor(node.key)} transform={`translate(${point.x} ${point.y - 2})`} fill="none" stroke={tone.text} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <text x={point.x} y={point.y + 44} textAnchor="middle" fill={tone.text} fontSize="12" fontWeight="900">{label}</text>
          </g>
        );
      })}
      <text x="210" y="155" textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="800">첫 판단 → 승리 신호 → 시작 준비 → 선택 규칙</text>
    </svg>
  );
};

const TabletopRoomBriefPanel = ({
  game,
  config,
  selectedRoom,
  selectedRoomVariant,
  status,
  players,
  readyGuestCount,
  guestPlayers,
  canStart,
  startStatusText,
}) => {
  const brief = tabletopRoomBriefs[game] || {};
  const variantName = variantNameOf(selectedRoom) || variantDisplayName(selectedRoomVariant) || "기본 규칙";
  const variantSummaryText = variantSummaryOf(selectedRoom) || variantSummary(selectedRoomVariant) || brief.objective || "";
  const maxPlayers = maxPlayersOf(selectedRoom);
  const playerSummary = `${players.length}/${maxPlayers || "-"}명`;
  const readySummary = guestPlayers.length ? `게스트 준비 ${readyGuestCount}/${guestPlayers.length}` : "방장만으로 시작 가능";
  const startSummary = status === "WAITING" ? (canStart ? "시작 가능" : startStatusText) : (statusLabels[status] || status || "진행 중");
  const tiles = [
    {
      key: "first",
      icon: "decision",
      label: "첫 판단",
      value: brief.firstDecision || "현재 단계의 강조된 행동을 먼저 확인합니다.",
      detail: brief.objective || config.description,
    },
    {
      key: "win",
      icon: "state",
      label: "승리 신호",
      value: brief.winSignal || "점수와 완료 조건을 확인합니다.",
      detail: variantSummaryText,
    },
    {
      key: "ready",
      icon: "player",
      label: "시작 준비",
      value: startSummary,
      detail: `${playerSummary} · ${readySummary}`,
    },
    {
      key: "rule",
      icon: "stage",
      label: "선택 규칙",
      value: variantName,
      detail: variantSummaryText || `${config.title} 방 규칙을 확인하세요.`,
    },
  ];

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" data-smoke="tabletop-room-brief-panel" data-room-status={status || ""} data-can-start={canStart ? "true" : "false"}>
      <div data-smoke="tabletop-room-brief-art" className="mb-3 flex flex-wrap gap-1.5 text-[11px] font-black text-slate-600">
        <span className="rounded-full bg-slate-100 px-2.5 py-1">{startSummary}</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1">{playerSummary}</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1">{variantName}</span>
      </div>
      <div className="grid gap-2 md:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.key} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" data-smoke="tabletop-room-brief-tile">
            <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500">
              <GameUxGlyph type={tile.icon} className="h-3.5 w-3.5" />
              {tile.label}
            </div>
            <div className="mt-1 line-clamp-2 text-sm font-black leading-snug text-slate-900">{tile.value}</div>
            <div className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-slate-500">{tile.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
};

const tabletopSessionRoutePalette = {
  state: { fill: "#eef2ff", stroke: "#4f46e5", accent: "#818cf8", text: "#3730a3" },
  ready: { fill: "#ecfdf5", stroke: "#059669", accent: "#34d399", text: "#065f46" },
  primary: { fill: "#fffbeb", stroke: "#d97706", accent: "#f59e0b", text: "#92400e" },
  exit: { fill: "#fff1f2", stroke: "#e11d48", accent: "#fb7185", text: "#9f1239" },
};

const buildTabletopSessionRouteItems = ({
  status,
  isHost,
  canStart,
  busy,
  myReady,
  players,
  guestPlayers,
  readyGuestCount,
  selectedRoomVariantName,
  selectedRoomPlayerRangeText,
  startStatusText,
}) => {
  const normalizedStatus = status || "WAITING";
  const totalGuests = guestPlayers.length;
  const readyText = totalGuests ? `게스트 준비 ${readyGuestCount}/${totalGuests}` : "방장 단독 시작 가능";
  const primaryValue = busy
    ? "요청 처리 중"
    : normalizedStatus === "WAITING" && isHost
      ? (canStart ? "시작 가능" : "시작 잠김")
      : normalizedStatus === "WAITING"
        ? (myReady ? "준비 취소 가능" : "준비하기")
        : normalizedStatus === "PLAYING" && isHost
          ? "강제 종료"
          : normalizedStatus === "PLAYING"
            ? "게임 진행 중"
            : normalizedStatus === "FINISHED" && isHost
              ? "다시 하기"
              : normalizedStatus === "FINISHED"
                ? "결과 확인"
                : "상태 확인";
  const primaryDetail = busy
    ? "요청 처리 중에는 같은 버튼을 반복 실행하지 않도록 잠깁니다."
    : normalizedStatus === "WAITING" && isHost && canStart
      ? "방장은 시작 버튼으로 현재 규칙의 첫 턴을 열 수 있습니다."
      : normalizedStatus === "WAITING" && isHost
        ? startStatusText || "최소 인원과 게스트 준비가 맞아야 시작 버튼이 열립니다."
        : normalizedStatus === "WAITING"
          ? "참가자는 준비하기 버튼으로 방장의 시작 조건을 맞춥니다."
          : normalizedStatus === "PLAYING" && isHost
            ? "방장은 강제 종료 버튼으로 진행 중인 세션을 정리할 수 있습니다."
            : normalizedStatus === "PLAYING"
              ? "플레이 중에는 보드와 행동 패널을 먼저 확인합니다."
              : normalizedStatus === "FINISHED" && isHost
                ? "방장은 다시 하기 버튼으로 같은 방에서 다음 판을 준비할 수 있습니다."
                : "결과 패널과 플레이어 상태를 확인한 뒤 나가기를 선택할 수 있습니다.";

  return [
    {
      key: "state",
      icon: normalizedStatus === "FINISHED" ? "win" : normalizedStatus === "PLAYING" ? "turn" : "state",
      label: "현재 상태",
      short: statusLabels[normalizedStatus] || normalizedStatus || "대기",
      value: statusLabels[normalizedStatus] || normalizedStatus || "대기",
      detail: normalizedStatus === "WAITING"
        ? "대기방에서 준비, 규칙, 인원을 맞추는 단계입니다."
        : normalizedStatus === "PLAYING"
          ? "보드와 행동 패널에서 지금 가능한 선택을 확인합니다."
          : normalizedStatus === "FINISHED"
            ? "승자와 정산 근거를 확인하고 다음 행동을 고릅니다."
            : "현재 방 상태를 먼저 확인합니다.",
    },
    {
      key: "ready",
      icon: "player",
      label: "준비 조건",
      short: canStart ? "충족" : "확인",
      value: canStart ? "시작 조건 충족" : readyText,
      detail: canStart
        ? `${players.length}명이 ${selectedRoomVariantName || "선택 규칙"} 조건을 만족했습니다.`
        : `${readyText}입니다. ${selectedRoomPlayerRangeText || "인원 규칙"}도 함께 확인하세요.`,
    },
    {
      key: "primary",
      icon: "decision",
      label: "실제 버튼",
      short: isHost ? "방장" : "참가",
      value: primaryValue,
      detail: primaryDetail,
    },
    {
      key: "exit",
      icon: "recent",
      label: "정리/나가기",
      short: normalizedStatus === "FINISHED" ? "결과 후" : "방 관리",
      value: normalizedStatus === "FINISHED" ? "결과 후 정리" : "방 나가기",
      detail: normalizedStatus === "PLAYING"
        ? "플레이 중 퇴장은 방 상태에 영향을 줄 수 있으니 보드 상태를 먼저 확인하세요."
        : "방 나가기는 현재 방을 닫고 게임 목록 또는 로비 탐색으로 돌아가는 흐름입니다.",
    },
  ];
};

const TabletopSessionRouteArt = ({ items = [], status = "", canStart = false, isHost = false }) => {
  const statusText = statusLabels[status] || status || "대기";
  const routeTone = status === "FINISHED" ? "#f59e0b" : canStart || status === "PLAYING" ? "#10b981" : "#38bdf8";
  const points = [
    { x: 48, y: 78 },
    { x: 132, y: 54 },
    { x: 216, y: 102 },
    { x: 300, y: 78 },
  ];

  return (
    <svg
      viewBox="0 0 360 156"
      role="img"
      aria-label="보드게임 세션 버튼 루트"
      className="h-full min-h-[150px] w-full"
      data-smoke="tabletop-session-route-art"
    >
      <rect x="0" y="0" width="360" height="156" rx="20" fill="#0f172a" />
      <rect x="18" y="18" width="324" height="120" rx="18" fill="#f8fafc" />
      <path d="M48 78 C88 34 122 34 160 78 S232 122 292 78" fill="none" stroke="#cbd5e1" strokeWidth="8" strokeLinecap="round" />
      <path d="M48 78 C88 34 122 34 160 78 S232 122 292 78" fill="none" stroke={routeTone} strokeWidth="4" strokeLinecap="round" />
      <text x="28" y="38" fill="#334155" fontSize="14" fontWeight="900">세션 버튼 루트</text>
      <text x="286" y="38" fill="#64748b" fontSize="11" fontWeight="800" textAnchor="end">{isHost ? "방장" : "참가자"}</text>
      <text x="334" y="38" fill="#64748b" fontSize="11" fontWeight="800" textAnchor="end">{statusText}</text>
      {items.slice(0, 4).map((item, index) => {
        const point = points[index] || points[points.length - 1];
        const palette = tabletopSessionRoutePalette[item.key] || tabletopSessionRoutePalette.state;
        return (
          <g key={item.key} data-smoke="tabletop-session-route-node" data-route-key={item.key}>
            <circle cx={point.x} cy={point.y} r="22" fill={palette.fill} stroke={palette.stroke} strokeWidth="3" />
            <circle cx={point.x} cy={point.y} r="8" fill={palette.accent} />
            <text x={point.x} y={point.y + 38} fill={palette.text} fontSize="11" fontWeight="900" textAnchor="middle">{item.label}</text>
            <text x={point.x} y={point.y + 52} fill="#475569" fontSize="9" fontWeight="800" textAnchor="middle">{item.short}</text>
          </g>
        );
      })}
    </svg>
  );
};

const TabletopSessionRoutePanel = ({
  status,
  isHost,
  canStart,
  busy,
  myReady,
  players,
  guestPlayers,
  readyGuestCount,
  selectedRoomVariantName,
  selectedRoomPlayerRangeText,
  startStatusText,
}) => {
  const routeItems = buildTabletopSessionRouteItems({
    status,
    isHost,
    canStart,
    busy,
    myReady,
    players,
    guestPlayers,
    readyGuestCount,
    selectedRoomVariantName,
    selectedRoomPlayerRangeText,
    startStatusText,
  });
  const summary = status === "WAITING"
    ? (canStart ? "시작 가능" : startStatusText || "시작 대기")
    : statusLabels[status] || status || "상태 확인";

  return (
    <section
      className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3"
      data-smoke="tabletop-session-route-panel"
      data-session-status={status || ""}
      data-can-start={canStart ? "true" : "false"}
      data-host={isHost ? "true" : "false"}
      data-busy={busy ? "true" : "false"}
      data-ready={myReady ? "true" : "false"}
    >
      <div className="space-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                <GameUxGlyph type="decision" className="h-4 w-4 text-primary-600" />
                세션 버튼 루트
              </div>
              <p className="mt-1 text-xs font-bold leading-relaxed text-slate-600">
                상단의 실제 준비, 시작, 강제 종료, 다시 하기, 나가기 버튼이 어떤 상태에서 쓰이는지 한눈에 정리합니다.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-600 ring-1 ring-slate-200">
              {summary}
            </span>
          </div>
          <div data-smoke="tabletop-session-route-art" className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-black text-slate-600">
            {routeItems.map((item) => (
              <span key={`route-chip-${item.key}`} data-smoke="tabletop-session-route-node" data-route-key={item.key} className="rounded-full bg-white px-2.5 py-1">
                {item.label}: {item.value}
              </span>
            ))}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {routeItems.map((item) => (
              <div
                key={item.key}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2"
                data-smoke="tabletop-session-route-item"
                data-route-key={item.key}
              >
                <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500">
                  <GameUxGlyph type={item.icon} className="h-3.5 w-3.5" />
                  {item.label}
                </div>
                <div className="mt-1 line-clamp-2 text-sm font-black leading-snug text-slate-950">{item.value}</div>
                <div className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-slate-600">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const tabletopStartReadinessToneClasses = {
  done: {
    shell: "border-emerald-100 bg-emerald-50 text-emerald-950",
    icon: "bg-emerald-600 text-white",
    detail: "text-emerald-800",
    bar: "bg-emerald-500",
  },
  active: {
    shell: "border-primary-100 bg-primary-50 text-primary-950",
    icon: "bg-primary-600 text-white",
    detail: "text-primary-800",
    bar: "bg-primary-500",
  },
  waiting: {
    shell: "border-amber-100 bg-amber-50 text-amber-950",
    icon: "bg-amber-500 text-slate-950",
    detail: "text-amber-800",
    bar: "bg-amber-500",
  },
  neutral: {
    shell: "border-slate-100 bg-slate-50 text-slate-950",
    icon: "bg-slate-900 text-white",
    detail: "text-slate-600",
    bar: "bg-slate-400",
  },
};

const tabletopStartReadinessArtTones = {
  done: { fill: "#ecfdf5", stroke: "#10b981", text: "#047857", accent: "#34d399" },
  active: { fill: "#eef2ff", stroke: "#6366f1", text: "#3730a3", accent: "#818cf8" },
  waiting: { fill: "#fffbeb", stroke: "#f59e0b", text: "#92400e", accent: "#fbbf24" },
  neutral: { fill: "#f8fafc", stroke: "#94a3b8", text: "#334155", accent: "#cbd5e1" },
};

const tabletopStartReadinessArtLabels = {
  players: "인원",
  ready: "준비",
  host: "방장",
  rule: "규칙",
};

const TabletopStartReadinessArt = ({ items = [], canStart, startStatusText, className = "" }) => {
  const nodes = items.slice(0, 4);
  const routeTone = canStart ? "#059669" : "#d97706";
  const statusText = canStart ? "시작 가능" : startStatusText || "대기";
  const points = [
    { x: 54, y: 112 },
    { x: 154, y: 82 },
    { x: 254, y: 112 },
    { x: 354, y: 82 },
  ];
  const routePath = `M ${points[0].x} ${points[0].y} C 94 88, 114 88, ${points[1].x} ${points[1].y} S 214 100, ${points[2].x} ${points[2].y} S 314 88, ${points[3].x} ${points[3].y}`;

  const iconPathFor = (key) => {
    if (key === "players") return "M -9 6 c2 -6 16 -6 18 0 M -5 -2 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0";
    if (key === "ready") return "M -9 1 l5 5 13 -13";
    if (key === "host") return "M -10 4 l4 -10 6 8 6 -8 4 10 z";
    return "M -9 -5 h18 v10 h-18 z M -4 0 h8";
  };

  return (
    <svg
      viewBox="0 0 420 174"
      role="img"
      aria-label="보드게임 시작 준비 흐름"
      className={className}
      data-smoke="tabletop-start-readiness-art"
    >
      <rect x="10" y="10" width="400" height="154" rx="20" fill="#ffffff" stroke="#e2e8f0" />
      <rect x="24" y="22" width="154" height="42" rx="14" fill="#f8fafc" stroke="#e2e8f0" />
      <text x="36" y="40" fill="#0f172a" fontSize="14" fontWeight="900">시작 준비</text>
      <text x="36" y="56" fill="#64748b" fontSize="11" fontWeight="800">대기방 체크</text>
      <rect x="286" y="24" width="96" height="30" rx="15" fill={canStart ? "#dcfce7" : "#fef3c7"} stroke={canStart ? "#86efac" : "#fcd34d"} />
      <text x="334" y="43" textAnchor="middle" fill={canStart ? "#166534" : "#92400e"} fontSize="11" fontWeight="900">{statusText}</text>
      <path d={routePath} fill="none" stroke={routeTone} strokeWidth="12" strokeLinecap="round" opacity="0.12" />
      <path d={routePath} fill="none" stroke={routeTone} strokeWidth="3" strokeLinecap="round" />
      <polygon points="366,82 354,75 355,89" fill={routeTone} />
      {nodes.map((node, index) => {
        const point = points[index] || points[points.length - 1];
        const tone = tabletopStartReadinessArtTones[node.tone] || tabletopStartReadinessArtTones.neutral;
        const label = tabletopStartReadinessArtLabels[node.key] || node.label || "";
        return (
          <g key={node.key || `${label}-${index}`} data-smoke="tabletop-start-readiness-node" data-readiness-key={node.key || ""}>
            <circle cx={point.x} cy={point.y} r="28" fill={tone.fill} stroke={tone.stroke} strokeWidth="3" />
            <circle cx={point.x} cy={point.y} r="18" fill="#ffffff" stroke={tone.accent} strokeWidth="2" />
            <path d={iconPathFor(node.key)} transform={`translate(${point.x} ${point.y - 2})`} fill="none" stroke={tone.text} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <text x={point.x} y={point.y + 44} textAnchor="middle" fill={tone.text} fontSize="12" fontWeight="900">{label}</text>
          </g>
        );
      })}
      <text x="210" y="155" textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="800">인원 → 준비 → 권한 → 선택 규칙</text>
    </svg>
  );
};

const TabletopStartReadinessPanel = ({
  startChecks,
  startStatusText,
  canStart,
  isHost,
  selectedRoomVariantName,
  selectedRoomPlayerRangeText,
  selectedRoomVariantTags,
  startRuleHint,
}) => {
  const iconByKey = {
    players: "player",
    ready: "state",
    host: "decision",
  };
  const readinessItems = [
    ...(Array.isArray(startChecks) ? startChecks : []).map((check) => ({
      key: check.key,
      icon: iconByKey[check.key] || "state",
      label: check.label,
      value: check.done ? "충족" : "대기",
      detail: check.detail,
      tone: check.done ? (check.key === "host" && isHost && canStart ? "active" : "done") : "waiting",
      progress: check.done ? 100 : check.key === "host" ? 44 : 32,
    })),
    {
      key: "rule",
      icon: "stage",
      label: "선택 규칙",
      value: selectedRoomVariantName || "기본 규칙",
      detail: `${selectedRoomPlayerRangeText || "인원 규칙 확인"}${selectedRoomVariantTags?.length ? ` · ${selectedRoomVariantTags.slice(0, 2).join(" · ")}` : ""}`,
      tone: "neutral",
      progress: 100,
    },
  ];

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" data-smoke="tabletop-start-readiness-panel" data-can-start={canStart ? "true" : "false"}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <GameUxGlyph type="decision" className="h-4 w-4 text-primary-600" />
            시작 준비
          </div>
          <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
            방장이 무엇을 기다리는지와 선택한 규칙이 시작 조건에 맞는지 확인합니다.
          </div>
        </div>
        <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black ${canStart ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
          {startStatusText}
        </span>
      </div>
      <div className="px-3 pt-3">
        <TabletopStartReadinessArt items={readinessItems} canStart={canStart} startStatusText={startStatusText} className="h-44 w-full" />
      </div>
      <div className="grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-4">
        {readinessItems.map((item) => {
          const tone = tabletopStartReadinessToneClasses[item.tone] || tabletopStartReadinessToneClasses.neutral;
          return (
            <div key={item.key} className={`min-h-[116px] rounded-xl border px-3 py-2 ${tone.shell}`} data-smoke="tabletop-start-readiness-item">
              <div className="flex items-start gap-2">
                <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tone.icon}`}>
                  <GameUxGlyph type={item.icon} className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-black opacity-70">{item.label}</div>
                    <div className="shrink-0 text-xs font-black">{item.value}</div>
                  </div>
                  <div className={`mt-1 line-clamp-2 text-[11px] font-bold leading-relaxed ${tone.detail}`}>{item.detail}</div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/80">
                    <span className={`block h-full rounded-full ${tone.bar}`} style={{ width: `${item.progress}%` }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-slate-100 px-4 py-3 text-[11px] font-bold leading-relaxed text-slate-500">
        {startRuleHint}
      </div>
    </section>
  );
};

const TabletopLobbyBriefPanel = ({
  game,
  config,
  selectedVariant,
  rooms,
  initialLoading,
  roomsRefreshing,
  createForm,
}) => {
  const brief = tabletopRoomBriefs[game] || {};
  const safeRooms = Array.isArray(rooms) ? rooms : [];
  const waitingRooms = safeRooms.filter((room) => !statusOf(room) || statusOf(room) === "WAITING");
  const joinableRooms = waitingRooms.filter((room) => {
    const playerCount = playersOf(room).length;
    const maxPlayers = maxPlayersOf(room);
    return maxPlayers <= 0 || playerCount < maxPlayers;
  });
  const selectedName = variantDisplayName(selectedVariant) || "기본 규칙";
  const selectedSummary = variantSummary(selectedVariant) || brief.objective || "";
  const selectedPlayers = selectedVariant ? variantPlayerLabel(selectedVariant) : "인원 확인 중";
  const turnTime = String(createForm?.turnTimeSeconds || "30").trim() || "30";
  const roomSignal = initialLoading
    ? "방 목록 확인 중"
    : roomsRefreshing
      ? "새로고침 중"
      : joinableRooms.length
        ? `${joinableRooms.length}/${safeRooms.length}개 입장 가능`
        : "새 방 만들기 추천";
  const titleSignal = String(createForm?.title || "").trim() ? "제목 입력됨" : "제목은 비워도 생성 가능";
  const tiles = [
    {
      key: "rule",
      icon: "state",
      label: "선택 규칙",
      value: selectedName,
      detail: `${selectedPlayers} · ${selectedSummary || `${config.title} 기본 흐름`}`,
    },
    {
      key: "rooms",
      icon: "player",
      label: "입장 가능",
      value: roomSignal,
      detail: safeRooms.length ? "대기방이 있으면 먼저 입장하고, 가득 찼다면 새 방을 만드세요." : "현재 열린 방이 없으면 왼쪽에서 새 방을 만들면 됩니다.",
    },
    {
      key: "host",
      icon: "stage",
      label: "호스트 준비",
      value: `${turnTime}초 턴`,
      detail: `${titleSignal} · 생성 후 참가자 준비 상태가 맞으면 시작할 수 있습니다.`,
    },
    {
      key: "decision",
      icon: "decision",
      label: game === "poker" ? "추천 판단" : "첫 판단",
      value: brief.firstDecision || "규칙과 인원 확인",
      detail: brief.objective || "방에 들어가기 전 규칙, 인원, 시작 조건을 먼저 확인하세요.",
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-lg" data-smoke="tabletop-lobby-brief-panel">
      <div className="grid gap-2 md:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.key} className="min-h-[104px] rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" data-smoke="tabletop-lobby-brief-tile">
            <div className="flex items-center gap-2 text-[11px] font-black text-slate-500">
              <GameUxGlyph type={tile.icon} className="h-3.5 w-3.5" />
              {tile.label}
            </div>
            <div className="mt-2 truncate text-sm font-black text-slate-950">{tile.value}</div>
            <div className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-slate-600">{tile.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
};

const tabletopSetupPreviewToneClasses = {
  active: {
    shell: "border-emerald-100 bg-emerald-50 text-emerald-950",
    icon: "bg-emerald-600 text-white",
    detail: "text-emerald-800",
  },
  waiting: {
    shell: "border-amber-100 bg-amber-50 text-amber-950",
    icon: "bg-amber-500 text-slate-950",
    detail: "text-amber-800",
  },
  neutral: {
    shell: "border-slate-100 bg-slate-50 text-slate-950",
    icon: "bg-slate-900 text-white",
    detail: "text-slate-600",
  },
  focus: {
    shell: "border-sky-100 bg-sky-50 text-sky-950",
    icon: "bg-sky-600 text-white",
    detail: "text-sky-800",
  },
};

const tabletopSetupTempoLabel = (seconds) => {
  if (seconds <= 20) return "빠른 압박";
  if (seconds <= 45) return "표준 리듬";
  if (seconds <= 90) return "전략 숙고";
  return "긴 호흡";
};

const buildTabletopSetupPreviewItems = ({ game, config, selectedVariant, createForm, rooms = [] }) => {
  const minPlayers = selectedVariant ? variantMinPlayers(selectedVariant) : 0;
  const maxPlayers = selectedVariant ? variantMaxPlayers(selectedVariant) : 0;
  const playersLabel = selectedVariant ? variantPlayerLabel(selectedVariant) : "인원 확인 중";
  const turnSeconds = Math.max(5, Math.min(180, Number(createForm?.turnTimeSeconds || 30) || 30));
  const tempoLabel = tabletopSetupTempoLabel(turnSeconds);
  const titleReady = Boolean(String(createForm?.title || "").trim());
  const waitingRooms = (Array.isArray(rooms) ? rooms : []).filter((room) => !statusOf(room) || statusOf(room) === "WAITING");
  const featureTags = variantFeatureTags(game, selectedVariant).slice(0, 3);
  const variantName = variantDisplayName(selectedVariant) || "기본 규칙";
  const summary = variantSummary(selectedVariant) || config.description || `${config.title} 기본 진행`;

  return [
    {
      key: "rule",
      icon: "state",
      label: "규칙 체감",
      value: variantName,
      detail: `${playersLabel} · ${summary}`,
      tone: "focus",
      progress: maxPlayers ? Math.min(100, Math.max(22, (minPlayers / maxPlayers) * 100)) : 46,
    },
    {
      key: "tempo",
      icon: "turn",
      label: "턴 템포",
      value: `${turnSeconds}초 · ${tempoLabel}`,
      detail: turnSeconds <= 20
        ? "짧은 턴은 빠른 판단과 실수를 유도합니다. 초보자 방이면 조금 늘리는 편이 읽기 쉽습니다."
        : turnSeconds <= 45
          ? "대부분의 보드게임에서 대기감과 판단 시간이 균형 잡히는 기본 템포입니다."
          : "긴 턴은 협상, 규칙 확인, 복잡한 선택이 많은 판에 어울립니다.",
      tone: turnSeconds <= 20 ? "waiting" : turnSeconds <= 90 ? "active" : "neutral",
      progress: Math.min(100, Math.max(18, (turnSeconds / 180) * 100)),
    },
    {
      key: "seats",
      icon: "player",
      label: "인원 압력",
      value: playersLabel,
      detail: waitingRooms.length
        ? `현재 대기방 ${waitingRooms.length}개가 있어 새 방은 다른 규칙이나 인원대가 필요할 때 더 의미가 있습니다.`
        : "대기방이 없으므로 새 방을 만들면 첫 선택지가 됩니다.",
      tone: waitingRooms.length ? "neutral" : "active",
      progress: maxPlayers ? Math.min(100, Math.max(20, (maxPlayers / Math.max(1, Math.max(maxPlayers, 8))) * 100)) : 38,
    },
    {
      key: "host",
      icon: "decision",
      label: "방장 체크",
      value: titleReady ? "제목 입력됨" : "제목 없이 생성 가능",
      detail: featureTags.length
        ? `표시 규칙: ${featureTags.join(" · ")}. 생성 뒤에는 참가자 준비 상태를 보고 시작하면 됩니다.`
        : "생성 뒤에는 참가자 준비 상태와 최소 인원 조건을 확인한 다음 시작하면 됩니다.",
      tone: titleReady ? "active" : "waiting",
      progress: titleReady ? 100 : 42,
    },
  ];
};

const TabletopSetupPreviewArt = ({ items, game, className = "" }) => {
  const palette = {
    catan: ["#f97316", "#22c55e"],
    blokus: ["#2563eb", "#facc15"],
    mahe: ["#14b8a6", "#f59e0b"],
    dalmuti: ["#7c3aed", "#f59e0b"],
    "six-nimmt": ["#dc2626", "#facc15"],
    telestrations: ["#0ea5e9", "#a855f7"],
    mafia: ["#be123c", "#334155"],
    poker: ["#16a34a", "#f43f5e"],
  }[game] || ["#2563eb", "#f59e0b"];
  const nodes = items.map((item, index) => ({
    ...item,
    x: 56 + (index * 90),
    y: index % 2 === 0 ? 116 : 78,
  }));

  return (
    <svg
      viewBox="0 0 380 168"
      role="img"
      aria-label="보드게임 방 설정 프리뷰"
      className={className}
      data-smoke="tabletop-setup-preview-art"
    >
      <rect width="380" height="168" rx="22" fill="#0f172a" />
      <rect x="18" y="18" width="344" height="132" rx="18" fill="#111827" stroke="#334155" strokeWidth="2" />
      <path d="M42 120 C88 48 148 138 196 86 S292 40 336 110" fill="none" stroke={palette[0]} strokeWidth="9" strokeLinecap="round" opacity="0.14" />
      <path d="M42 120 C88 48 148 138 196 86 S292 40 336 110" fill="none" stroke={palette[1]} strokeWidth="3" strokeLinecap="round" opacity="0.72" />
      <text x="34" y="44" fill="#f8fafc" fontSize="17" fontWeight="900">방 설정 프리뷰</text>
      <text x="34" y="64" fill="#94a3b8" fontSize="10" fontWeight="800">규칙, 템포, 인원, 방장 체크</text>
      {nodes.map((node, index) => (
        <g key={node.key} data-smoke="tabletop-setup-preview-node">
          <circle cx={node.x} cy={node.y} r="22" fill={index === 0 ? palette[0] : index === 1 ? palette[1] : "#1e293b"} stroke="#e2e8f0" strokeWidth="2" />
          <text x={node.x} y={node.y + 4} textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="900">{index + 1}</text>
          <text x={node.x} y="146" textAnchor="middle" fill="#cbd5e1" fontSize="10" fontWeight="900">{node.label}</text>
        </g>
      ))}
      <circle cx="332" cy="38" r="10" fill="#22c55e" />
      <path d="M327 38 l4 4 8 -9" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const TabletopSetupPreviewPanel = ({ game, config, selectedVariant, createForm, rooms }) => {
  const items = buildTabletopSetupPreviewItems({ game, config, selectedVariant, createForm, rooms });
  const turnSeconds = Math.max(5, Math.min(180, Number(createForm?.turnTimeSeconds || 30) || 30));

  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      data-smoke="tabletop-setup-preview-panel"
      data-variant-code={selectedVariant?.code || "BASE"}
      data-turn-seconds={String(turnSeconds)}
    >
      <div className="grid gap-3 p-3 lg:grid-cols-[240px_minmax(0,1fr)]">
        <TabletopSetupPreviewArt items={items} game={game} className="h-40 w-full" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                <GameUxGlyph type="build" className="h-4 w-4 text-primary-600" />
                설정 도움말
              </div>
              <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
                방을 만들기 전에 이 규칙과 턴 시간이 어떤 플레이 감각을 만들지 먼저 정리합니다.
              </div>
            </div>
            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">
              읽기 전용
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.map((item) => {
              const tone = tabletopSetupPreviewToneClasses[item.tone] || tabletopSetupPreviewToneClasses.neutral;
              return (
                <div key={item.key} className={`min-h-[112px] rounded-xl border px-3 py-2 ${tone.shell}`} data-smoke="tabletop-setup-preview-item">
                  <div className="flex items-center gap-2 text-[11px] font-black">
                    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${tone.icon}`}>
                      <GameUxGlyph type={item.icon} className="h-4 w-4" />
                    </span>
                    {item.label}
                  </div>
                  <div className="mt-2 truncate text-sm font-black">{item.value}</div>
                  <div className={`mt-1 line-clamp-3 text-xs font-bold leading-relaxed ${tone.detail}`}>{item.detail}</div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/80">
                    <span className="block h-full rounded-full bg-current opacity-70" style={{ width: `${Math.max(6, Math.min(100, item.progress))}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

const buildTabletopLobbyDirectorPlan = ({ rooms = [], variants = [], game, myMemberId = 0 }) => {
  const safeRooms = Array.isArray(rooms) ? rooms : [];
  const waitingRooms = safeRooms.filter((room) => !statusOf(room) || statusOf(room) === "WAITING");
  const myRooms = safeRooms.filter((room) => playersOf(room).some((player) => memberIdOf(player) === myMemberId));
  const joinableRooms = waitingRooms.filter((room) => {
    const maxPlayers = maxPlayersOf(room);
    return maxPlayers <= 0 || playersOf(room).length < maxPlayers;
  });
  const readyJoinableRooms = joinableRooms.filter((room) => playersOf(room).length >= minPlayersOf(room));
  const roomWithVariantName = (room) => {
    const variant = variantForRoom(room, variants);
    return variantDisplayName(variant) || variantNameOf(room) || "기본 규칙";
  };
  const readinessScore = (room) => {
    const players = playersOf(room);
    const hostMemberId = hostMemberIdOf(room);
    const guests = players.filter((player) => memberIdOf(player) !== hostMemberId);
    const readyGuests = guests.filter(isReady).length;
    const minPlayers = Math.max(1, minPlayersOf(room));
    const maxPlayers = Math.max(minPlayers, maxPlayersOf(room) || minPlayers);
    const fillRatio = Math.min(1, players.length / maxPlayers);
    const startRatio = Math.min(1, players.length / minPlayers);
    const readyRatio = guests.length ? readyGuests / guests.length : 1;
    return Math.round((fillRatio * 32) + (startRatio * 34) + (readyRatio * 34));
  };
  const candidates = safeRooms
    .map((room, index) => {
      const players = playersOf(room);
      const status = statusOf(room) || "WAITING";
      const maxPlayers = maxPlayersOf(room);
      const minPlayers = minPlayersOf(room) || 1;
      const alreadyInRoom = players.some((player) => memberIdOf(player) === myMemberId);
      const full = maxPlayers > 0 && players.length >= maxPlayers;
      const joinable = status === "WAITING" && !full;
      const readyToStart = status === "WAITING" && players.length >= minPlayers;
      const action = alreadyInRoom ? "open" : joinable ? "join" : "wait";
      const priority = [
        alreadyInRoom ? 400 : 0,
        joinable ? 220 : 0,
        readyToStart ? 90 : 0,
        readinessScore(room),
        players.length,
      ].reduce((sum, value) => sum + value, 0);
      return {
        key: String(idOf(room) || codeOf(room) || `${room.title || "room"}-${index}`),
        room,
        roomId: idOf(room),
        title: room.title || codeOf(room) || "대기방",
        variantName: roomWithVariantName(room),
        status,
        playerCount: players.length,
        minPlayers,
        maxPlayers,
        alreadyInRoom,
        joinable,
        readyToStart,
        action,
        score: readinessScore(room),
        priority,
        reason: alreadyInRoom
          ? "이미 참여 중인 방이라 이어 들어가는 흐름이 가장 빠릅니다."
          : joinable
            ? readyToStart
              ? "시작 조건이 맞아 입장 후 바로 준비 흐름으로 갈 수 있습니다."
              : "입장하면 최소 인원 조건에 가까워지는 방입니다."
            : status === "PLAYING"
              ? "이미 진행 중이라 지금은 관전 대신 다른 대기방을 보는 편이 좋습니다."
              : "완료되었거나 정원이 찬 방입니다.",
      };
    })
    .sort((a, b) => b.priority - a.priority);
  const recommended = candidates.find((candidate) => candidate.action === "open" || candidate.action === "join") || null;
  const choices = candidates.filter((candidate) => candidate.action === "open" || candidate.action === "join").slice(0, 3);
  const items = [
    {
      key: "availability",
      icon: "player",
      label: "입장 후보",
      value: joinableRooms.length ? `${joinableRooms.length}개` : "없음",
      detail: joinableRooms.length ? "지금 누르면 바로 대기방에 합류할 수 있습니다." : "새 방을 만들면 첫 선택이 더 명확합니다.",
      progress: safeRooms.length ? Math.round((joinableRooms.length / safeRooms.length) * 100) : 0,
    },
    {
      key: "resume",
      icon: "signal",
      label: "이어가기",
      value: myRooms.length ? `${myRooms.length}개` : "없음",
      detail: myRooms.length ? "이미 앉은 방이 있어 같은 흐름으로 돌아갈 수 있습니다." : "참여 중인 방이 없어서 새 후보를 고르면 됩니다.",
      progress: myRooms.length ? 100 : 20,
    },
    {
      key: "start",
      icon: "stage",
      label: "시작 임박",
      value: readyJoinableRooms.length ? `${readyJoinableRooms.length}개` : "대기",
      detail: readyJoinableRooms.length ? "최소 인원을 만족한 방이 있어 준비 신호만 맞추면 됩니다." : "아직 인원이 모이는 중입니다.",
      progress: joinableRooms.length ? Math.round((readyJoinableRooms.length / joinableRooms.length) * 100) : 0,
    },
    {
      key: "choice",
      icon: "decision",
      label: "선택 기준",
      value: recommended ? recommended.title : "방 만들기",
      detail: recommended ? `${recommended.variantName} 기준으로 가장 빠른 진입 후보입니다.` : `${game ? "현재 게임" : "보드게임"}은 직접 방을 열면 첫 선택이 분명합니다.`,
      progress: recommended ? recommended.score : 25,
    },
  ];
  return { items, choices, recommended, roomCount: safeRooms.length };
};

const TabletopLobbyDirectorArt = ({ plan, className = "" }) => {
  const nodes = plan.items.map((item, index) => ({
    ...item,
    x: 54 + (index * 84),
    y: index % 2 === 0 ? 50 : 76,
  }));
  const recommendedIndex = Math.max(0, nodes.findIndex((node) => node.key === "choice"));

  return (
    <svg
      viewBox="0 0 360 136"
      role="img"
      aria-label="보드게임 로비 방 선택 디렉터"
      className={className}
      data-smoke="tabletop-lobby-director-art"
    >
      <rect width="360" height="136" rx="20" fill="#0f172a" />
      <rect x="18" y="18" width="324" height="100" rx="18" fill="#111827" stroke="#334155" />
      <path d={`M${nodes[0]?.x || 54} ${nodes[0]?.y || 50} C126 18 190 112 ${nodes[3]?.x || 306} ${nodes[3]?.y || 76}`} fill="none" stroke="#38bdf8" strokeWidth="3" opacity="0.35" />
      <path d={`M${nodes[1]?.x || 138} ${nodes[1]?.y || 76} C162 104 238 24 ${nodes[2]?.x || 222} ${nodes[2]?.y || 50}`} fill="none" stroke="#facc15" strokeWidth="2" opacity="0.45" />
      {nodes.map((node, index) => {
        const active = index === recommendedIndex;
        return (
          <g key={node.key} data-smoke="tabletop-lobby-director-node">
            <circle cx={node.x} cy={node.y} r={active ? 19 : 16} fill={active ? "#facc15" : "#1e293b"} stroke={active ? "#f8fafc" : "#64748b"} strokeWidth="2" />
            <text x={node.x} y={node.y + 4} textAnchor="middle" fill={active ? "#422006" : "#e2e8f0"} fontSize="11" fontWeight="900">{index + 1}</text>
            <text x={node.x} y="122" textAnchor="middle" fill="#cbd5e1" fontSize="10" fontWeight="800">{node.label}</text>
          </g>
        );
      })}
      <rect x="42" y="24" width="104" height="18" rx="9" fill="#0f172a" stroke="#334155" />
      <text x="94" y="37" textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="900">방 선택 루트</text>
      <circle cx="316" cy="30" r="10" fill={plan.recommended ? "#22c55e" : "#64748b"} />
      <path d="M311 30 l4 4 8 -9" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const TabletopLobbyDirectorEmptyArt = ({ game, className = "" }) => {
  const title = gameConfigs[game]?.title || "보드게임";
  const safeTitle = String(title).slice(0, 10);
  const nodes = [
    { key: "create", x: 78, y: 94, label: "생성", fill: "#38bdf8" },
    { key: "code", x: 180, y: 52, label: "코드", fill: "#a78bfa" },
    { key: "refresh", x: 282, y: 94, label: "갱신", fill: "#34d399" },
  ];

  return (
    <svg
      viewBox="0 0 360 136"
      role="img"
      aria-label={`${title} 로비에 바로 들어갈 방이 없을 때 다음 행동을 안내합니다.`}
      className={className}
      data-smoke="tabletop-lobby-director-empty-art"
    >
      <rect width="360" height="136" rx="20" fill="#0f172a" />
      <rect x="18" y="18" width="324" height="100" rx="18" fill="#111827" stroke="#334155" />
      <path d="M78 94 C116 34, 244 34, 282 94" fill="none" stroke="#334155" strokeWidth="8" strokeLinecap="round" />
      <path d="M78 94 C116 34, 244 34, 282 94" fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
      <rect x="119" y="18" width="122" height="26" rx="13" fill="#0f172a" stroke="#334155" />
      <text x="180" y="35" textAnchor="middle" fill="#e0f2fe" fontSize="11" fontWeight="900">후보 없음</text>
      <rect x="124" y="84" width="112" height="22" rx="11" fill="#164e63" />
      <text x="180" y="99" textAnchor="middle" fill="#ecfeff" fontSize="12" fontWeight="900">{safeTitle}</text>
      {nodes.map((node) => (
        <g key={node.key} data-smoke="tabletop-lobby-director-empty-node" data-empty-key={node.key}>
          <circle cx={node.x} cy={node.y} r="20" fill={node.fill} />
          <circle cx={node.x} cy={node.y} r="9" fill="#020617" opacity="0.72" />
          <text x={node.x} y={node.y + 34} textAnchor="middle" fill="#cbd5e1" fontSize="10" fontWeight="900">{node.label}</text>
        </g>
      ))}
    </svg>
  );
};

const TabletopLobbyDirectorEmptyChoice = ({ game }) => {
  const title = gameConfigs[game]?.title || "보드게임";
  const items = [
    {
      key: "create",
      icon: "decision",
      label: "새 방 만들기",
      value: "직접 출발",
      detail: `${title} 방을 만들면 규칙, 턴 시간, 초대 흐름을 바로 통제할 수 있습니다.`,
    },
    {
      key: "code",
      icon: "input",
      label: "방코드 입장",
      value: "초대 합류",
      detail: "친구가 준 코드는 위 코드 입력 영역에서 기존 합류 흐름 그대로 사용하세요.",
    },
    {
      key: "refresh",
      icon: "signal",
      label: "목록 새로고침",
      value: "후보 재확인",
      detail: "대기방이 생기면 같은 디렉터 영역에 입장 후보와 시작 임박 신호가 표시됩니다.",
    },
  ];

  return (
    <div
      className="rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-3"
      data-smoke="tabletop-lobby-director-choice"
      data-empty-game={game}
    >
      <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center" data-smoke="tabletop-lobby-director-empty-choice">
        <TabletopLobbyDirectorEmptyArt game={game} className="h-32 w-full" />
        <div className="min-w-0">
          <div className="text-sm font-black text-slate-950">추천할 대기방이 없습니다</div>
          <p className="mt-1 text-xs font-bold leading-relaxed text-slate-600">
            입장 후보가 비어 있어도 로비 흐름은 이어집니다. 새 방을 만들거나 방코드로 합류하고, 목록 갱신 후 바로 들어갈 방을 다시 확인하세요.
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {items.map((item) => (
              <div key={item.key} className="rounded-lg border border-white/80 bg-white px-3 py-2" data-smoke="tabletop-lobby-director-empty-item" data-empty-key={item.key}>
                <div className="flex items-center gap-1.5 text-[10px] font-black text-sky-700">
                  <GameUxGlyph type={item.icon} className="h-3.5 w-3.5" />
                  {item.label}
                </div>
                <div className="mt-1 text-xs font-black text-slate-950">{item.value}</div>
                <div className="mt-1 text-[10px] font-bold leading-relaxed text-slate-500">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const TabletopLobbyDirectorPanel = ({
  game,
  rooms,
  variants,
  myMemberId,
  busy,
  onOpenRoom,
  onJoinRoom,
}) => {
  const plan = buildTabletopLobbyDirectorPlan({ rooms, variants, game, myMemberId });

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" data-smoke="tabletop-lobby-director-panel">
      <div className="grid gap-3 p-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        <TabletopLobbyDirectorArt plan={plan} className="h-36 w-full" />
        <div className="min-w-0 space-y-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-black text-slate-900">방 목록 도움말</div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">{plan.roomCount}개 방 분석</span>
            </div>
            <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
              지금 보이는 방 목록만 보고 이어가기, 바로 입장, 방 만들기 판단을 정리합니다.
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {plan.items.map((item) => (
              <div key={item.key} className="min-h-[98px] rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" data-smoke="tabletop-lobby-director-item">
                <div className="flex items-center gap-2 text-[11px] font-black text-slate-500">
                  <GameUxGlyph type={item.icon} className="h-3.5 w-3.5 text-primary-600" />
                  {item.label}
                </div>
                <div className="mt-1 truncate text-sm font-black text-slate-950">{item.value}</div>
                <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-relaxed text-slate-600">{item.detail}</div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                  <span className="block h-full rounded-full bg-primary-500" style={{ width: `${Math.max(6, Math.min(100, item.progress))}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {plan.choices.length ? plan.choices.map((choice) => (
              <div key={choice.key} className="grid gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2 sm:grid-cols-[minmax(0,1fr)_108px] sm:items-center" data-smoke="tabletop-lobby-director-choice">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-slate-900">{choice.title}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-black text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5">{choice.variantName}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5">{choice.playerCount}/{choice.maxPlayers || "-"}명</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5">{choice.action === "open" ? "이어가기" : "입장 후보"}</span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-relaxed text-slate-500">{choice.reason}</div>
                </div>
                <button
                  type="button"
                  className="min-h-10 rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                  disabled={busy}
                  onClick={() => (choice.action === "open" ? onOpenRoom(choice.room) : onJoinRoom(choice.roomId))}
                  data-smoke="tabletop-lobby-director-primary"
                >
                  {choice.action === "open" ? "열기" : "입장"}
                </button>
              </div>
            )) : (
              <TabletopLobbyDirectorEmptyChoice game={game} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

const TabletopJoinCodeArt = ({ game, joinCode, className = "" }) => {
  const codeText = String(joinCode || "").trim().toUpperCase();
  const visibleCode = codeText ? codeText.slice(0, 8) : "방코드";
  const palette = {
    catan: ["#f97316", "#22c55e"],
    blokus: ["#2563eb", "#facc15"],
    mahe: ["#14b8a6", "#f59e0b"],
    dalmuti: ["#7c3aed", "#f59e0b"],
    "six-nimmt": ["#dc2626", "#facc15"],
    telestrations: ["#0ea5e9", "#a855f7"],
    mafia: ["#be123c", "#334155"],
    poker: ["#16a34a", "#f43f5e"],
  }[game] || ["#2563eb", "#f59e0b"];
  const nodes = [
    { key: "code", label: "코드", x: 58 },
    { key: "match", label: "방 확인", x: 180 },
    { key: "seat", label: "좌석", x: 302 },
  ];

  return (
    <svg
      viewBox="0 0 360 128"
      role="img"
      aria-label="보드게임 방 코드 입장 흐름"
      className={className}
      data-smoke="tabletop-join-code-art"
    >
      <rect width="360" height="128" rx="20" fill="#0f172a" />
      <path d="M26 78 C76 34 118 104 166 64 C214 24 266 36 334 82" fill="none" stroke={palette[0]} strokeWidth="2" opacity="0.35" />
      <rect x="26" y="18" width="308" height="50" rx="16" fill="#111827" stroke="#334155" />
      <text x="42" y="37" fill="#cbd5e1" fontSize="11" fontWeight="800">공유 방 코드</text>
      <text x="42" y="58" fill="#ffffff" fontSize="19" fontWeight="900">{visibleCode}</text>
      <path d="M72 94 H286" fill="none" stroke="#475569" strokeWidth="8" strokeLinecap="round" />
      <path d="M72 94 H286" fill="none" stroke={codeText ? palette[1] : "#94a3b8"} strokeWidth="3" strokeLinecap="round" />
      {nodes.map((node, index) => (
        <g key={node.key} data-smoke="tabletop-join-code-node">
          <circle cx={node.x} cy="94" r="18" fill={codeText ? palette[0] : "#1f2937"} stroke={codeText ? "#f8fafc" : "#64748b"} strokeWidth="2" />
          <text x={node.x} y="98" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="900">{index + 1}</text>
          <text x={node.x} y="122" textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="800">{node.label}</text>
        </g>
      ))}
      <circle cx="318" cy="32" r="10" fill={codeText ? "#facc15" : "#334155"} />
      <path d="M314 32 h8 M318 28 v8" stroke={codeText ? "#422006" : "#94a3b8"} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

const TabletopJoinCodePanel = ({ game, config, joinCode, setJoinCode, busy, initialLoading, joinByCode }) => {
  const hasCode = String(joinCode || "").trim().length > 0;

  return (
    <form
      onSubmit={joinByCode}
      className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      aria-label={`${config.title} 방 코드 입장`}
      data-smoke="tabletop-join-code-panel"
    >
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-black text-slate-900">
          <GameUxGlyph type="signal" className="h-4 w-4 text-amber-600" />
          방 코드 입장
        </div>
        <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
          친구가 공유한 코드를 입력하면 같은 대기방과 좌석 흐름으로 바로 이어집니다.
        </div>
      </div>
      <div className="space-y-3 p-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <input
            className="min-h-11 min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase"
            placeholder="방코드"
            aria-label="방 코드"
            value={joinCode}
            maxLength={8}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            data-smoke="tabletop-join-code-input"
          />
          <button
            type="submit"
            className="min-h-11 rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
            disabled={busy || initialLoading || !joinCode.trim()}
            aria-label={`${joinCode.trim() || "입력한"} 방 코드로 입장`}
            data-smoke="tabletop-join-code-submit"
          >
            입장
          </button>
        </div>
        <div className={`rounded-xl px-3 py-2 text-[11px] font-bold leading-relaxed ${hasCode ? "bg-amber-50 text-amber-800" : "bg-slate-50 text-slate-500"}`} data-smoke="tabletop-join-code-status">
          {hasCode ? "입력한 코드로 대기방을 찾을 준비가 됐습니다." : "방장이 공유한 코드를 입력하면 공개방 목록을 탐색하지 않아도 됩니다."}
        </div>
      </div>
    </form>
  );
};

const tabletopRoomStatusTone = (status) => {
  if (status === "PLAYING") return "bg-emerald-100 text-emerald-700";
  if (status === "FINISHED") return "bg-slate-200 text-slate-600";
  return "bg-amber-100 text-amber-700";
};

const tabletopLobbyRoomReadiness = (room) => {
  const status = statusOf(room);
  const players = playersOf(room);
  const hostMemberId = hostMemberIdOf(room);
  const guests = players.filter((player) => memberIdOf(player) !== hostMemberId);
  const readyGuests = guests.filter(isReady).length;
  const minPlayers = minPlayersOf(room);
  const maxPlayers = maxPlayersOf(room);
  if (status !== "WAITING") {
    return {
      done: status === "PLAYING",
      value: statusLabels[status] || status || "진행 중",
      detail: status === "PLAYING" ? "이미 시작된 방입니다." : "종료된 방은 새 방을 만드는 편이 좋습니다.",
    };
  }
  if (players.length < minPlayers) {
    return {
      done: false,
      value: `인원 ${players.length}/${minPlayers}`,
      detail: `${Math.max(0, minPlayers - players.length)}명이 더 들어오면 시작 조건을 맞춥니다.`,
    };
  }
  if (!guests.length) {
    return {
      done: true,
      value: "방장 시작 가능",
      detail: maxPlayers > 1 ? "추가 인원을 기다리거나 바로 시작할 수 있습니다." : "혼자 진행 가능한 방입니다.",
    };
  }
  return {
    done: readyGuests === guests.length,
    value: `게스트 준비 ${readyGuests}/${guests.length}`,
    detail: readyGuests === guests.length ? "준비 조건을 만족했습니다." : "아직 준비하지 않은 게스트가 있습니다.",
  };
};

const tabletopLobbyRoomActionSignal = (room, alreadyInListedRoom) => {
  const status = statusOf(room);
  const players = playersOf(room);
  const maxPlayers = maxPlayersOf(room);
  const minPlayers = minPlayersOf(room);
  const full = maxPlayers > 0 && players.length >= maxPlayers;
  if (alreadyInListedRoom) {
    return {
      value: status === "PLAYING" ? "플레이 재입장" : "내 방 열기",
      detail: status === "PLAYING" ? "진행 중인 판으로 돌아갈 수 있습니다." : "멤버 준비 상태와 시작 조건을 확인하세요.",
    };
  }
  if (status !== "WAITING") {
    return { value: status === "PLAYING" ? "진행 중" : "종료됨", detail: "입장 대신 다른 대기 방을 고르거나 새 방을 만드세요." };
  }
  if (full) {
    return { value: "정원 마감", detail: "빈 좌석이 생기기 전까지 입장할 수 없습니다." };
  }
  if (players.length < minPlayers) {
    return { value: "합류 추천", detail: "입장하면 시작 조건에 가까워집니다." };
  }
  return { value: "입장 가능", detail: "입장 후 준비를 누르면 방장이 시작할 수 있습니다." };
};

const tabletopLobbyRoomDecisionToneClasses = {
  access: "border-emerald-100 bg-emerald-50 text-emerald-800",
  seat: "border-sky-100 bg-sky-50 text-sky-800",
  ready: "border-amber-100 bg-amber-50 text-amber-800",
  rule: "border-violet-100 bg-violet-50 text-violet-800",
  neutral: "border-slate-100 bg-slate-50 text-slate-700",
};

const buildTabletopLobbyRoomDecisionItems = ({
  room,
  game,
  variantLabel,
  alreadyInRoom,
  status,
  players,
  minPlayers,
  maxPlayers,
  roomFull,
  canJoin,
  readiness,
  actionSignal,
}) => {
  const safePlayers = Array.isArray(players) ? players : [];
  const safeMinPlayers = Math.max(1, Number(minPlayers || 1));
  const safeMaxPlayers = Math.max(safeMinPlayers, Number(maxPlayers || safePlayers.length || safeMinPlayers));
  const openSeats = Math.max(0, safeMaxPlayers - safePlayers.length);
  const statusText = statusLabels[status] || status || "대기 중";
  const roomCode = codeOf(room) || "-";
  const accessValue = alreadyInRoom
    ? "내 참여 방"
    : canJoin
      ? "바로 입장"
      : status === "PLAYING"
        ? "진행 중"
        : roomFull
          ? "정원 마감"
          : status === "FINISHED"
            ? "결과 확인"
            : "상태 확인";
  const accessDetail = alreadyInRoom
    ? `${statusText} · 방 코드 ${roomCode}`
    : actionSignal?.detail || `${statusText} 상태를 먼저 확인하세요.`;
  const variantName = variantNameOf(room) || variantLabel || gameConfigs[game]?.title || "기본 규칙";

  return [
    {
      key: "access",
      icon: alreadyInRoom || canJoin ? "turn" : "decision",
      label: "입장 판단",
      value: accessValue,
      detail: accessDetail,
      tone: alreadyInRoom || canJoin ? "access" : "neutral",
    },
    {
      key: "seat",
      icon: "player",
      label: "인원",
      value: `${safePlayers.length}/${safeMaxPlayers}명`,
      detail: openSeats > 0 ? `빈 좌석 ${openSeats}개 · 최소 ${safeMinPlayers}명` : "빈 좌석이 없습니다.",
      tone: openSeats > 0 ? "seat" : "neutral",
    },
    {
      key: "ready",
      icon: readiness?.done ? "win" : "state",
      label: "준비",
      value: readiness?.value || "준비 확인",
      detail: readiness?.detail || "방장의 시작 조건과 참가자 준비 상태를 확인합니다.",
      tone: readiness?.done ? "access" : "ready",
    },
    {
      key: "rule",
      icon: "stage",
      label: "규칙",
      value: variantLabel || gameConfigs[game]?.title || "보드게임",
      detail: `${variantName} · 턴 제한 ${turnSecondsOf(room) || "-"}초`,
      tone: "rule",
    },
  ];
};

const TabletopLobbyRoomDecisionRail = ({ items = [] }) => {
  const visibleItems = Array.isArray(items) ? items.filter(Boolean).slice(0, 4) : [];
  if (!visibleItems.length) return null;

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4" data-smoke="tabletop-lobby-room-decision-rail">
      {visibleItems.map((item) => {
        const tone = tabletopLobbyRoomDecisionToneClasses[item.tone] || tabletopLobbyRoomDecisionToneClasses.neutral;
        return (
          <div key={item.key} className={`min-h-[94px] rounded-xl border px-3 py-2 ${tone}`} data-smoke="tabletop-lobby-room-decision-item" data-decision-key={item.key}>
            <div className="flex items-center gap-1.5 text-[10px] font-black opacity-75">
              <GameUxGlyph type={item.icon || "state"} className="h-3.5 w-3.5" />
              {item.label}
            </div>
            <div className="mt-1 truncate text-sm font-black leading-tight">{item.value}</div>
            {item.detail && <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-relaxed opacity-70">{item.detail}</div>}
          </div>
        );
      })}
    </div>
  );
};

const tabletopLobbyRoomCardPalettes = {
  catan: { bg: "#fffbeb", primary: "#f59e0b", secondary: "#22c55e", accent: "#0ea5e9", text: "#78350f" },
  blokus: { bg: "#ecfeff", primary: "#0891b2", secondary: "#6366f1", accent: "#ec4899", text: "#164e63" },
  mahe: { bg: "#f7fee7", primary: "#65a30d", secondary: "#f59e0b", accent: "#0ea5e9", text: "#365314" },
  dalmuti: { bg: "#fff7ed", primary: "#ea580c", secondary: "#facc15", accent: "#7c3aed", text: "#7c2d12" },
  "six-nimmt": { bg: "#fff1f2", primary: "#e11d48", secondary: "#f97316", accent: "#0f766e", text: "#881337" },
  telestrations: { bg: "#f8fafc", primary: "#2563eb", secondary: "#14b8a6", accent: "#f97316", text: "#1e3a8a" },
  mafia: { bg: "#f1f5f9", primary: "#475569", secondary: "#dc2626", accent: "#7c3aed", text: "#0f172a" },
  poker: { bg: "#ecfdf5", primary: "#059669", secondary: "#dc2626", accent: "#0f172a", text: "#064e3b" },
};

const tabletopLobbyRoomCardStatusTone = {
  WAITING: { fill: "#fef3c7", stroke: "#d97706", text: "#78350f", label: "대기" },
  PLAYING: { fill: "#dcfce7", stroke: "#16a34a", text: "#14532d", label: "진행" },
  FINISHED: { fill: "#e2e8f0", stroke: "#64748b", text: "#334155", label: "결과" },
};

const TabletopLobbyRoomCardArt = ({
  game,
  status,
  players,
  minPlayers,
  maxPlayers,
  readiness,
  alreadyInRoom,
  joinable,
  full,
  variantLabel,
  className = "",
}) => {
  const palette = tabletopLobbyRoomCardPalettes[game] || tabletopLobbyRoomCardPalettes.catan;
  const tone = tabletopLobbyRoomCardStatusTone[status] || tabletopLobbyRoomCardStatusTone.WAITING;
  const playerCount = Array.isArray(players) ? players.length : 0;
  const safeMinPlayers = Math.max(1, Number(minPlayers || 1));
  const safeMaxPlayers = Math.max(safeMinPlayers, Number(maxPlayers || playerCount || safeMinPlayers));
  const slotCount = Math.max(1, Math.min(safeMaxPlayers, 8));
  const statusText = statusLabels[status] || status || "대기";
  const actionText = alreadyInRoom ? "내 방" : joinable ? "입장" : full ? "마감" : status === "PLAYING" ? "진행" : "대기";
  const nodes = [
    {
      key: "rule",
      label: String(variantLabel || gameConfigs[game]?.title || "규칙").slice(0, 4),
      fill: "#ffffff",
      stroke: palette.primary,
      text: palette.text,
      active: true,
    },
    {
      key: "seat",
      label: `${playerCount}/${safeMaxPlayers}`,
      fill: playerCount >= safeMinPlayers ? "#dcfce7" : "#fef3c7",
      stroke: playerCount >= safeMinPlayers ? "#16a34a" : "#d97706",
      text: playerCount >= safeMinPlayers ? "#14532d" : "#78350f",
      active: playerCount >= safeMinPlayers,
    },
    {
      key: "ready",
      label: readiness?.done ? "준비" : "확인",
      fill: readiness?.done ? "#dbeafe" : "#f1f5f9",
      stroke: readiness?.done ? "#2563eb" : "#64748b",
      text: readiness?.done ? "#1e3a8a" : "#334155",
      active: Boolean(readiness?.done),
    },
    {
      key: "action",
      label: actionText,
      fill: alreadyInRoom || joinable ? "#ede9fe" : "#f8fafc",
      stroke: alreadyInRoom || joinable ? "#7c3aed" : "#94a3b8",
      text: alreadyInRoom || joinable ? "#4c1d95" : "#475569",
      active: alreadyInRoom || joinable,
    },
  ];

  return (
    <svg
      viewBox="0 0 220 150"
      className={className}
      role="img"
      aria-label={`${gameConfigs[game]?.title || "보드게임"} 방 카드 상태 ${statusText}, ${playerCount}/${safeMaxPlayers}명`}
      focusable="false"
      data-smoke="tabletop-lobby-room-card-art"
      data-room-status={status || ""}
      data-joinable={joinable ? "true" : "false"}
    >
      <rect x="4" y="4" width="212" height="142" rx="22" fill={palette.bg} stroke="#cbd5e1" strokeWidth="2" />
      <path d="M18 106c30-26 58-29 86-9 31 22 60 13 86-30 10-16 18-20 28-16v48c-58 27-124 30-200 7Z" fill={palette.secondary} opacity="0.18" />
      <path d="M24 96H196" stroke={palette.primary} strokeWidth="4" strokeLinecap="round" opacity="0.45" />
      <rect x="16" y="16" width="76" height="26" rx="13" fill="#ffffff" stroke={tone.stroke} strokeWidth="2" />
      <text x="54" y="33" textAnchor="middle" fontSize="11" fontWeight="900" fill={tone.text}>{tone.label}</text>
      <rect x="112" y="16" width="88" height="26" rx="13" fill={alreadyInRoom || joinable ? "#dcfce7" : tone.fill} stroke={alreadyInRoom || joinable ? "#16a34a" : tone.stroke} strokeWidth="2" />
      <text x="156" y="33" textAnchor="middle" fontSize="11" fontWeight="900" fill={alreadyInRoom || joinable ? "#14532d" : tone.text}>{actionText}</text>
      <g transform="translate(22 58)">
        {nodes.map((node, index) => {
          const x = index * 54;
          return (
            <g key={node.key} transform={`translate(${x} 0)`} data-smoke="tabletop-lobby-room-card-node" data-room-card-key={node.key}>
              {index > 0 && <path d="M-36 17H-19" stroke={node.active ? node.stroke : "#94a3b8"} strokeWidth="4" strokeLinecap="round" opacity={node.active ? 0.85 : 0.34} />}
              <circle cx="17" cy="17" r="17" fill={node.fill} stroke={node.stroke} strokeWidth="3" />
              <text x="17" y="21" textAnchor="middle" fontSize="9" fontWeight="900" fill={node.text}>{index + 1}</text>
              <text x="17" y="46" textAnchor="middle" fontSize="9" fontWeight="900" fill={node.text}>{node.label}</text>
            </g>
          );
        })}
      </g>
      <g transform="translate(16 128)" aria-hidden="true">
        {Array.from({ length: slotCount }).map((_, index) => (
          <rect
            key={index}
            x={index * 24}
            y="0"
            width="17"
            height="8"
            rx="4"
            fill={index < playerCount ? palette.accent : "#cbd5e1"}
            opacity={index < playerCount ? 0.95 : 0.7}
            data-smoke="tabletop-lobby-room-card-seat"
          />
        ))}
      </g>
    </svg>
  );
};

const TabletopLobbyEmptyArt = ({ game, className = "" }) => {
  const config = gameConfigs[game] || {};
  const palette = tabletopLobbyRoomCardPalettes[game] || tabletopLobbyRoomCardPalettes.catan;
  const nodes = [
    { key: "scan", label: "목록", x: 44, y: 62, active: false },
    { key: "create", label: "생성", x: 110, y: 40, active: true },
    { key: "invite", label: "코드", x: 176, y: 62, active: true },
  ];

  return (
    <svg
      viewBox="0 0 220 132"
      className={className}
      role="img"
      aria-label={`${config.title || "보드게임"} 대기방이 없을 때 새 방과 초대 코드를 안내합니다.`}
      focusable="false"
      data-smoke="tabletop-lobby-empty-art"
      data-game-code={game || ""}
    >
      <rect x="4" y="4" width="212" height="124" rx="22" fill={palette.bg} stroke="#cbd5e1" strokeWidth="2" />
      <path d="M20 92c33-26 62-30 92-9 34 24 66 11 96-36v60c-62 20-127 23-188-15Z" fill={palette.secondary} opacity="0.16" />
      <path d="M26 88C60 61 86 64 112 80C144 100 175 76 202 44" fill="none" stroke={palette.primary} strokeWidth="4" strokeLinecap="round" opacity="0.55" />
      {nodes.map((node, index) => (
        <g key={node.key} data-smoke="tabletop-lobby-empty-node" data-empty-key={node.key}>
          {index > 0 && (
            <path
              d={`M${nodes[index - 1].x + 18} ${nodes[index - 1].y}C${nodes[index - 1].x + 34} ${nodes[index - 1].y - 28} ${node.x - 34} ${node.y - 28} ${node.x - 18} ${node.y}`}
              fill="none"
              stroke={node.active ? palette.accent : "#94a3b8"}
              strokeWidth="3"
              strokeLinecap="round"
              opacity={node.active ? 0.75 : 0.36}
            />
          )}
          <circle cx={node.x} cy={node.y} r="18" fill={node.active ? "#ffffff" : "#f8fafc"} stroke={node.active ? palette.accent : "#94a3b8"} strokeWidth="3" />
          <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="10" fontWeight="900" fill={node.active ? palette.text : "#475569"}>{index + 1}</text>
          <text x={node.x} y={node.y + 31} textAnchor="middle" fontSize="10" fontWeight="900" fill="#334155">{node.label}</text>
        </g>
      ))}
      <rect x="25" y="16" width="72" height="22" rx="11" fill="#ffffff" stroke="#e2e8f0" />
      <text x="61" y="31" textAnchor="middle" fontSize="10" fontWeight="900" fill="#475569">방 없음</text>
      <rect x="122" y="16" width="74" height="22" rx="11" fill={palette.primary} opacity="0.16" />
      <text x="159" y="31" textAnchor="middle" fontSize="10" fontWeight="900" fill={palette.text}>새 흐름</text>
    </svg>
  );
};

const TabletopLobbyEmptyState = ({ game, config, initialLoading }) => {
  const title = config?.title || "보드게임";
  const guideItems = initialLoading
    ? [
      { key: "loading", label: "목록 상태", value: "불러오는 중", detail: "대기방 목록을 받는 동안 생성 설정과 초대 코드 경로를 먼저 확인할 수 있습니다." },
      { key: "create", label: "다음 준비", value: "세팅 확인", detail: "방이 없으면 선택한 규칙과 턴 시간을 기준으로 새 방을 만들게 됩니다." },
      { key: "invite", label: "초대 경로", value: "코드 대기", detail: "친구가 공유한 방코드가 있다면 목록 수신 후 바로 입장 흐름으로 이어집니다." },
    ]
    : [
      { key: "empty", label: "공개 목록", value: "대기방 없음", detail: "지금 입장할 공개 방이 없으니 새 방을 만들면 첫 선택지가 됩니다." },
      { key: "create", label: "다음 행동", value: "새 방 만들기", detail: "왼쪽 설정을 확인한 뒤 방을 만들면 다른 플레이어가 바로 합류할 수 있습니다." },
      { key: "invite", label: "초대 경로", value: "방코드 입장", detail: "이미 받은 코드가 있으면 공개 목록을 기다리지 말고 코드로 합류하세요." },
    ];

  return (
    <div
      className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-3"
      role={initialLoading ? "status" : undefined}
      aria-live={initialLoading ? "polite" : undefined}
      data-smoke="tabletop-lobby-empty-state"
      data-game-code={game || ""}
      data-loading={initialLoading ? "true" : "false"}
    >
      <div className="grid gap-3 lg:grid-cols-[190px_minmax(0,1fr)] lg:items-center">
        <TabletopLobbyEmptyArt game={game} className="h-28 w-full" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-600">{title}</span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">{initialLoading ? "목록 수신" : "입장 후보 없음"}</span>
          </div>
          <div className="mt-2 text-sm font-black text-slate-900">
            {initialLoading ? "대기방을 불러오는 중입니다." : "대기 중인 방이 없습니다."}
          </div>
          <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
            빈 로비도 멈춘 화면이 아니라 새 방 만들기, 방코드 입장, 새로고침 중 어느 경로를 선택할지 알려야 합니다.
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {guideItems.map((item) => (
              <div key={item.key} className="rounded-xl border border-slate-200 bg-white px-3 py-2" data-smoke="tabletop-lobby-empty-item" data-empty-key={item.key}>
                <div className="text-[10px] font-black text-slate-400">{item.label}</div>
                <div className="mt-0.5 text-xs font-black text-slate-900">{item.value}</div>
                <div className="mt-1 text-[11px] font-bold leading-relaxed text-slate-500">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const variantDisplayName = (variant) => variant?.displayName || variant?.code || "";
const variantExpansion = (variant) => Boolean(variant?.expansion);
const variantMinPlayers = (variant) => Number(variant?.minPlayers || 0);
const variantMaxPlayers = (variant) => Number(variant?.maxPlayers || 0);
const variantSummary = (variant) => variant?.summary || "";
const variantPlayerLabel = (variant) => {
  const minPlayers = variantMinPlayers(variant);
  const maxPlayers = variantMaxPlayers(variant);
  if (!minPlayers && !maxPlayers) return "인원 정보 없음";
  return minPlayers === maxPlayers ? `${minPlayers}인 전용` : `${minPlayers}~${maxPlayers}인`;
};
const variantKindLabel = (variant) => variantExpansion(variant) ? "확장/선택 규칙" : "본게임";

const variantFeatureTags = (game, variant) => {
  const serverTags = get(variant, "feature_tags", "featureTags", []);
  if (Array.isArray(serverTags) && serverTags.length) return serverTags;
  const code = String(variant?.code || "").toUpperCase();
  if (game === "catan") {
    if (code === "BASE") return ["3~4인", "승점 10점", "기본 섬"];
    if (code === "FIVE_SIX") return ["5~6인", "카타니안 1/2", "확장 보드"];
    if (code === "CITIES_KNIGHTS") return ["기사", "도시 발전", "야만인"];
    if (code === "EXPLORERS_PIRATES") return ["탐험", "화물", "임무"];
    if (code.includes("FRIENDLY_ROBBER")) return ["친절한 도둑", "초반 보호", "도둑 제한"];
    if (code.includes("FISHERMEN")) return ["물고기 토큰", "낚시터", "보너스 액션"];
    if (code.includes("RIVERS")) return ["강", "골드", "부유/빈곤"];
    if (code.includes("CARAVANS")) return ["낙타", "입찰", "경로 보너스"];
    if (code.includes("BARBARIAN_ATTACK")) return ["해안 침공", "방어 기사", "격퇴"];
    if (code.includes("TRADERS_BARBARIANS")) return ["항만장", "항구 점수", code.includes("FIVE_SIX") ? "5~6인" : "3~4인"];
    if (code.includes("CLOTH")) return ["천 교역", "부족 마을", "14점"];
    if (code.includes("FOG")) return ["안개 섬", "미탐험 타일", "발견"];
    if (code.includes("FOUR_ISLANDS")) return ["네 섬", "외국 섬", "13점"];
    if (code.includes("THROUGH_DESERT")) return ["사막 너머", "외국 지역", "14점"];
    if (code.includes("FORGOTTEN_TRIBE")) return ["잊힌 부족", "선물 토큰", "13점"];
    if (code.includes("SEAFARERS")) return ["배", "해상로", "해적"];
  }
  if (game === "blokus") {
    if (code === "DUO") return ["14x14", "2인 전용", "중앙 시작점"];
    if (code === "TWO_PLAYER") return ["2인", "각자 두 색", "점수 합산"];
    if (code === "THREE_PLAYER") return ["3인", "공유 초록", "순환 조종"];
    if (code === "TEAM") return ["2대2", "마주 보는 색", "팀 점수"];
    return ["20x20", "21개 조각", "코너 접촉"];
  }
  if (game === "mahe") {
    return ["2~7인", "거북이 업기", "알 카드"];
  }
  if (game === "dalmuti") {
    if (code === "STRIPPED_DECK") return ["4~5인", "낮은 계급 제외", "빠른 손패"];
    if (code === "FIRST_DEAL_REVOLUTION") return ["첫 손 세금 없음", "혁명 선택", "공식 선택 규칙"];
    return ["4~8인", "세금", "혁명"];
  }
  if (game === "telestrations") {
    return ["3~8인", "그림 릴레이", "리플레이 공개"];
  }
  if (game === "mafia") {
    if (code === "POLICE_ONLY") return ["5~12인", "경찰 포함", "의사 제외"];
    if (code === "DOCTOR_ONLY") return ["5~12인", "의사 포함", "경찰 제외"];
    if (code === "NO_SPECIALS") return ["5~12인", "마피아", "시민"];
    return ["5~12인", "경찰", "의사"];
  }
  if (game === "poker") {
    if (code === "SHORT") return ["1~8인", "100칩", "빠른판"];
    if (code === "FIVE_CARD_DRAW") return ["1~6인", "5장 손패", "1회 교체"];
    if (code === "DEEP") return ["1~8인", "500칩", "딥스택"];
    return ["1~8인", "200칩", "AI 봇"];
  }
  return [];
};

const catanVariantGroupLabels = {
  base: "기본판",
  fiveSix: "5~6인 확장",
  seafarers: "항해사",
  citiesKnights: "도시와 기사",
  tradersBarbarians: "상인과 야만인",
  explorersPirates: "탐험가와 해적",
  other: "기타",
};

const catanVariantGroupOrder = ["base", "fiveSix", "seafarers", "citiesKnights", "tradersBarbarians", "explorersPirates", "other"];
const mafiaCountGuideText = "마피아 수: 5~6명 1명 · 7~9명 2명 · 10~12명 3명";

const catanVariantGroupOf = (variant) => {
  const code = String(variant?.code || "").toUpperCase();
  if (code === "BASE") return "base";
  if (code === "FIVE_SIX") return "fiveSix";
  if (code.startsWith("SEAFARERS")) return "seafarers";
  if (code === "CITIES_KNIGHTS") return "citiesKnights";
  if (code.startsWith("TRADERS_BARBARIANS")) return "tradersBarbarians";
  if (code === "EXPLORERS_PIRATES") return "explorersPirates";
  return "other";
};

const unsupportedCatanVariantGroups = new Set(["seafarers", "citiesKnights", "tradersBarbarians", "explorersPirates"]);

const isSupportedTabletopVariant = (game, variant) => (
  game !== "catan" || !unsupportedCatanVariantGroups.has(catanVariantGroupOf(variant))
);

const visibleTabletopVariants = (game, variants) => (
  (Array.isArray(variants) ? variants : []).filter((variant) => isSupportedTabletopVariant(game, variant))
);

const isVisibleTabletopRoom = (game, room) => (
  game !== "catan" || isSupportedTabletopVariant(game, { code: variantCodeOf(room) })
);

const visibleTabletopRooms = (game, rooms) => (
  (Array.isArray(rooms) ? rooms : []).filter((room) => isVisibleTabletopRoom(game, room))
);

const variantGroupLabelsByGame = {
  blokus: {
    base: "기본판",
    duo: "블로커스 듀오",
    playerCount: "인원 변형",
    team: "팀전",
    other: "선택 규칙",
  },
  mahe: {
    base: "본게임",
    other: "선택 규칙",
  },
  dalmuti: {
    base: "본게임",
    optional: "공식 선택 규칙",
    other: "선택 규칙",
  },
  poker: {
    base: "텍사스 홀덤",
    draw: "5장 드로우",
    other: "텍사스 홀덤",
  },
  mafia: {
    base: "경찰+의사",
    police: "경찰 포함",
    doctor: "의사 포함",
    simple: "기본 심리전",
    other: "역할 조합",
  },
};

const variantGroupOrderByGame = {
  blokus: ["base", "duo", "playerCount", "team", "other"],
  mahe: ["base", "other"],
  dalmuti: ["base", "optional", "other"],
  poker: ["base", "draw", "other"],
  mafia: ["base", "police", "doctor", "simple", "other"],
};

const variantGroupOf = (game, variant) => {
  if (game === "catan") return catanVariantGroupOf(variant);
  const code = String(variant?.code || "").toUpperCase();
  if (code === "BASE") return "base";
  if (game === "blokus") {
    if (code === "DUO") return "duo";
    if (code === "TWO_PLAYER" || code === "THREE_PLAYER") return "playerCount";
    if (code === "TEAM") return "team";
  }
  if (game === "dalmuti" && (code === "STRIPPED_DECK" || code === "FIRST_DEAL_REVOLUTION")) return "optional";
  if (game === "poker" && code === "FIVE_CARD_DRAW") return "draw";
  if (game === "mafia") {
    if (code === "POLICE_ONLY") return "police";
    if (code === "DOCTOR_ONLY") return "doctor";
    if (code === "NO_SPECIALS") return "simple";
  }
  return "other";
};

const variantGroupLabel = (game, variant) => {
  if (game === "catan") {
    return catanVariantGroupLabels[catanVariantGroupOf(variant)] || catanVariantGroupLabels.other;
  }
  const labels = variantGroupLabelsByGame[game] || {};
  const group = variantGroupOf(game, variant);
  return labels[group] || (variantExpansion(variant) ? "선택 규칙" : "본게임");
};

const variantA11yLabel = (game, variant, { selected = false, disabled = false, disabledReason = "" } = {}) => {
  const tags = variantFeatureTags(game, variant);
  return [
    variantDisplayName(variant),
    variantGroupLabel(game, variant),
    variantKindLabel(variant),
    variantPlayerLabel(variant),
    variantSummary(variant),
    tags.length ? `핵심 특징 ${tags.join(", ")}` : "",
    selected ? "현재 선택됨" : "",
    disabled ? `선택 불가${disabledReason ? `: ${disabledReason}` : ""}` : "",
  ].filter(Boolean).join(" · ");
};

const variantGroupsFor = (game, variants) => {
  const safeVariants = Array.isArray(variants) ? variants : [];
  if (game !== "catan") {
    const labels = variantGroupLabelsByGame[game] || { base: "본게임", other: "선택 규칙" };
    const order = variantGroupOrderByGame[game] || ["base", "other"];
    return order
      .map((key) => ({
        key,
        label: labels[key] || "선택 규칙",
        variants: safeVariants.filter((variant) => variantGroupOf(game, variant) === key),
      }))
      .filter((group) => group.variants.length > 0);
  }
  return catanVariantGroupOrder
    .map((key) => ({
      key,
      label: catanVariantGroupLabels[key],
      variants: safeVariants.filter((variant) => catanVariantGroupOf(variant) === key),
    }))
    .filter((group) => group.variants.length > 0);
};

const VariantOptions = ({ game, variants, disabledCodes = new Set() }) => (
  <>
    {variantGroupsFor(game, variants).map((group) => (
      <optgroup key={group.key} label={group.label}>
        {group.variants.map((variant) => (
          <option key={variant.code} value={variant.code} disabled={disabledCodes.has(String(variant.code || ""))}>
            {variantDisplayName(variant)} · {variantPlayerLabel(variant)} · {variantKindLabel(variant)}
          </option>
        ))}
      </optgroup>
    ))}
  </>
);

const VariantFeatureTags = ({ game, variant, selected = false, disabled = false, className = "" }) => {
  const tags = variantFeatureTags(game, variant);
  if (!tags.length) return null;
  const chipClassName = selected && !disabled
    ? "bg-white/15 text-white"
    : disabled
      ? "bg-white/60 text-slate-300"
      : "bg-slate-100 text-slate-600";
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {tags.map((tag) => (
        <span key={tag} className={`rounded-full px-2 py-0.5 text-[10px] font-black ${chipClassName}`}>
          {tag}
        </span>
      ))}
    </div>
  );
};

const VariantChoiceGrid = ({ game, variants, value, onChange, compact = false, disabledCodes = new Set(), disabledReasonByCode = {} }) => {
  const groups = variantGroupsFor(game, variants);
  if (!groups.length) return null;
  const wrapperClassName = compact
    ? "space-y-3 overflow-visible pr-0 md:max-h-[min(54vh,360px)] md:overflow-auto md:overscroll-contain md:pr-1"
    : "space-y-3 overflow-visible pr-0";
  const groupHeaderClassName = compact
    ? "md:sticky md:top-0 z-10 -mx-1 flex items-center justify-between gap-2 bg-white/95 px-1 py-1 backdrop-blur"
    : "-mx-1 flex items-center justify-between gap-2 bg-white px-1 py-1";

  return (
    <div className={wrapperClassName} role="radiogroup" aria-label={`${gameConfigs[game]?.title || "보드게임"} 규칙과 확장 선택`} data-smoke="variant-choice-grid" data-compact={compact ? "true" : "false"}>
      {groups.map((group) => (
        <div key={group.key} className="space-y-2">
          <div className={groupHeaderClassName}>
            <div className="text-[11px] font-black text-slate-500">{group.label}</div>
            <div className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">{group.variants.length}개</div>
            <div className="h-px flex-1 bg-slate-100" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {group.variants.map((variant) => {
              const selected = variant.code === value;
              const variantCode = String(variant.code || "");
              const minPlayers = variantMinPlayers(variant);
              const maxPlayers = variantMaxPlayers(variant);
              const disabled = disabledCodes.has(variantCode);
              const disabledReason = disabledReasonByCode[variantCode];
              const a11yLabel = variantA11yLabel(game, variant, { selected, disabled, disabledReason });
              return (
                <button
                  key={variant.code}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-disabled={disabled}
                  aria-label={a11yLabel}
                  title={a11yLabel}
                  disabled={disabled}
                  className={[
                    "min-h-[112px] rounded-xl border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200/70",
                    selected && disabled
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : selected
                      ? "border-slate-900 bg-slate-900 text-white shadow-lg"
                      : disabled
                      ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50",
                  ].join(" ")}
                  onClick={() => {
                    if (!disabled) onChange(variant.code);
                  }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="break-words text-xs font-black">{variantDisplayName(variant)}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${selected && !disabled ? "bg-white/15 text-white" : variantExpansion(variant) ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                          {variantExpansion(variant) ? "확장" : "본게임"}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${selected && !disabled ? "bg-white/15 text-white" : "bg-sky-50 text-sky-700"}`}>
                          {minPlayers === maxPlayers ? `${minPlayers}인` : `${minPlayers}~${maxPlayers}명`}
                        </span>
                      </div>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black ${selected && !disabled ? "bg-emerald-400/20 text-emerald-100" : selected ? "bg-rose-100 text-rose-700" : "bg-white/70 text-slate-400"}`}>
                      {selected && <CheckCircle2 className="h-3 w-3" />}
                      {selected ? "선택됨" : group.label}
                    </span>
                  </div>
                  <div className={`mt-2 text-[11px] font-bold leading-relaxed ${selected && !disabled ? "text-white/75" : disabled ? "text-slate-400" : "text-slate-500"}`}>
                    {variantSummary(variant)}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <span className={`inline-flex min-h-7 items-center justify-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black ${selected && !disabled ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600"}`}>
                      <Users className="h-3 w-3" />
                      {variantPlayerLabel(variant)}
                    </span>
                    <span className={`inline-flex min-h-7 items-center justify-center rounded-lg px-2 py-1 text-[10px] font-black ${selected && !disabled ? "bg-white/15 text-white" : variantExpansion(variant) ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                      {variantKindLabel(variant)}
                    </span>
                  </div>
                  <VariantFeatureTags game={game} variant={variant} selected={selected} disabled={disabled} className="mt-2" />
                  {disabledReason && (
                    <div className="mt-2 text-[11px] font-black leading-relaxed text-rose-600">
                      {disabledReason}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

const variantForRoom = (room, variants) => {
  const code = variantCodeOf(room);
  return (Array.isArray(variants) ? variants : []).find((variant) => variant.code === code) || {
    code,
    displayName: variantNameOf(room),
    summary: variantSummaryOf(room),
    featureTags: room?.variantFeatureTags || [],
    expansion: false,
    minPlayers: minPlayersOf(room),
    maxPlayers: maxPlayersOf(room),
  };
};
const cargoTypesOf = (carrier) => {
  const cargoTypes = get(carrier, "cargo_types", "cargoTypes", []);
  if (Array.isArray(cargoTypes) && cargoTypes.length) return cargoTypes;
  const cargoType = get(carrier, "cargo_type", "cargoType", "");
  return cargoType ? [cargoType] : [];
};
const cargoLabelOf = (carrier) => {
  const cargoTypes = cargoTypesOf(carrier);
  return cargoTypes.length ? cargoTypes.map((cargoType) => catanCargoLabels[cargoType] || cargoType).join(" · ") : "없음";
};

const catanCargoMarks = {
  SETTLER: { fill: "#f59e0b", stroke: "#78350f", label: "정" },
  FISH: { fill: "#e0f2fe", stroke: "#0369a1", label: "어" },
  SPICE: { fill: "#fef3c7", stroke: "#92400e", label: "향" },
  CREW: { fill: "#ede9fe", stroke: "#6d28d9", label: "승" },
};

const cargoMarkOf = (cargoType) => catanCargoMarks[cargoType] || { fill: "#e2e8f0", stroke: "#334155", label: "?" };

const clampDigits = (value, min, max, fallback) => {
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  if (!digits) return String(fallback);
  const parsed = Number.parseInt(digits, 10);
  return String(Math.min(max, Math.max(min, Number.isFinite(parsed) ? parsed : fallback)));
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

const telestrationsPhaseLabels = {
  PROMPT: "시작 문장",
  DRAW: "그림 그리기",
  GUESS: "문장 추측",
  REVEAL: "공개 리플레이",
  FINISHED: "종료",
};

const mafiaPhaseLabels = {
  ROLE_REVEAL: "역할 확인",
  NIGHT_MAFIA: "밤 · 마피아",
  NIGHT_POLICE: "밤 · 경찰",
  NIGHT_DOCTOR: "밤 · 의사",
  DAWN: "아침 결과",
  DISCUSSION: "낮 토론",
  VOTING: "투표",
  TRIAL_RESULT: "투표 결과",
  FINISHED: "게임 종료",
};

const pokerPhaseLabels = {
  OPENING_BET: "첫 베팅",
  PREFLOP: "프리플롭",
  FLOP: "플롭",
  TURN: "턴",
  RIVER: "리버",
  DRAW: "카드 교체",
  FINAL_BET: "마지막 베팅",
  HAND_FINISHED: "핸드 종료",
  FINISHED: "게임 종료",
};


const tabletopActionTypeLabels = {
  PLACE: "조각 배치",
  PASS: "패스",
  ROLL_DIE: "주사위 굴리기",
  STOP_ROLLING: "굴림 멈추기",
  CHOOSE_DICE_COUNT: "주사위 개수 선택",
  PLAY: "카드 내기",
  RETURN_TAX: "세금 카드 반납",
  DECLARE_REVOLUTION: "혁명 선언",
  SKIP_REVOLUTION: "혁명 포기",
  SETUP_BUILD: "초기 배치",
  ROLL_DICE: "주사위 굴리기",
  BUILD_ROAD: "도로 건설",
  BUILD_BRIDGE: "다리 건설",
  BUILD_SHIP: "배 건설",
  MOVE_SHIP: "배 이동",
  BUILD_KNIGHT: "기사 배치",
  BUILD_CITY_WALL: "성벽 건설",
  BUILD_SETTLEMENT: "마을 건설",
  BUILD_CITY: "도시 건설",
  MOVE_ROBBER: "도둑 이동",
  MOVE_PIRATE: "해적 이동",
  MARITIME_TRADE: "해상 교역",
  PROPOSE_TRADE: "교역 제안",
  ACCEPT_TRADE: "교역 수락",
  REJECT_TRADE: "교역 거절",
  BUILD_SETTLER: "개척자 준비",
  LOAD_SETTLER: "개척자 승선",
  BUILD_CREW: "선원 배치",
  UNLOAD_CREW_TO_PIRATE_LAIR: "해적 소굴 상륙",
  ROLL_FISH_HAUL: "물고기 수확",
  CATCH_FISH: "물고기 획득",
  SPEND_FISH_TAKE_RESOURCE: "물고기 교환",
  COLLECT_SPICE: "향신료 수집",
  SELL_RESOURCE_FOR_GOLD: "자원 판매",
  SPEND_GOLD_FOR_RESOURCE: "금화 교환",
  BID_CAMEL: "낙타 입찰",
  PLACE_CAMEL: "낙타 배치",
  RECRUIT_BARBARIAN_KNIGHT: "야만족 기사 모집",
  EXPEL_BARBARIANS: "야만족 축출",
  CHASE_AWAY_PIRATE: "해적 추방",
  TRANSFER_CARGO: "화물 이동",
  DELIVER_CARGO: "화물 전달",
  FOUND_SETTLEMENT_FROM_SHIP: "해상 정착",
  DISCARD_RESOURCES: "자원 버리기",
  DISCARD_PROGRESS_CARD: "발전 카드 버리기",
  CHOOSE_GOLD_RESOURCE: "금 자원 선택",
  CHOOSE_AQUEDUCT_RESOURCE: "수로 자원 선택",
  CHOOSE_MASTER_MERCHANT_CARDS: "상인 카드 선택",
  CHOOSE_SPY_PROGRESS_CARD: "스파이 카드 선택",
  CHOOSE_DEFENDER_PROGRESS_CARD: "방어자 카드 선택",
  RESPOND_WEDDING_CARDS: "혼례 카드 응답",
  BUY_DEVELOPMENT_CARD: "발전 카드 구매",
  PLAY_DEVELOPMENT_CARD: "발전 카드 사용",
  PLAY_PROGRESS_CARD: "진보 카드 사용",
  ACTIVATE_KNIGHT: "기사 활성화",
  PROMOTE_KNIGHT: "기사 승급",
  MOVE_KNIGHT: "기사 이동",
  CHASE_ROBBER_WITH_KNIGHT: "기사로 도둑 추방",
  MOVE_DISPLACED_KNIGHT: "밀린 기사 이동",
  REMOVE_DESERTER_KNIGHT: "탈영 기사 제거",
  PLACE_DESERTER_KNIGHT: "탈영 기사 배치",
  MOVE_INTRIGUE_KNIGHT: "음모 기사 이동",
  RESPOND_COMMERCIAL_HARBOR: "상업항 응답",
  BUILD_CITY_IMPROVEMENT: "도시 개선",
  END_TURN: "턴 종료",
  SELECT_CARD: "카드 선택",
  CHOOSE_ROW: "줄 선택",
  SUBMIT_PROMPT: "시작 문장 제출",
  SUBMIT_GUESS: "추측 제출",
  SUBMIT_DRAWING: "그림 제출",
  END_GAME: "게임 종료",
  MAFIA_KILL: "마피아 습격",
  POLICE_CHECK: "경찰 조사",
  DOCTOR_SAVE: "의사 보호",
  VOTE: "투표",
  ADVANCE: "단계 진행",
  CHECK: "체크",
  CALL: "콜",
  BET: "베팅",
  RAISE: "레이즈",
  FOLD: "폴드",
  DRAW: "카드 교체",
  STAND_PAT: "그대로 진행",
};

export const TabletopGame = ({ game }) => {
  const config = gameConfigs[game];
  const { user } = useAuth();
  const [variants, setVariants] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [roomsRefreshing, setRoomsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [createForm, setCreateForm] = useState({ title: "", variantCode: "BASE", turnTimeSeconds: "30" });
  const [settingsForm, setSettingsForm] = useState({ variantCode: "BASE", turnTimeSeconds: "30" });
  const [startBotCount, setStartBotCount] = useState(0);
  const stompRef = useRef(null);
  const stompInitRef = useRef(null);
  const gameSubRef = useRef(null);
  const busyRef = useRef(false);
  const actionBusyRef = useRef(false);
  const startRoomKeyRef = useRef("");
  const lobbyLoadSeqRef = useRef(0);
  const roomOpenSeqRef = useRef(0);
  const mountedRef = useRef(false);
  const gameStateRef = useRef(null);
  const lastGameEventIdRef = useRef(null);
  const lastGameServerSentAtRef = useRef(0);
  const mySeatNoRef = useRef(0);
  const sixNimmtReplayQueueRef = useRef([]);
  const sixNimmtQueuedEventNosRef = useRef(new Set());
  const sixNimmtReplayTimerRef = useRef(null);
  const sixNimmtFinalFallbackTimerRef = useRef(null);
  const sixNimmtReplayRunningRef = useRef(false);
  const sixNimmtPendingFinalStateRef = useRef(null);
  const sixNimmtHandRefreshInFlightRef = useRef(null);
  const sixNimmtHandRefreshPendingRef = useRef(null);

  const myMemberId = Number(user?.member_id || user?.memberId || user?.id || 0);
  const players = playersOf(selectedRoom);
  const displayPlayers = useMemo(() => tabletopPlayersWithBotProfiles(players, gameState), [players, gameState]);
  const mySeatNo = seatNoOf(players.find((player) => memberIdOf(player) === myMemberId));
  const syncMySeatNoFromRoom = (room) => {
    const seatNo = seatNoOf(playersOf(room).find((player) => memberIdOf(player) === myMemberId));
    mySeatNoRef.current = seatNo || 0;
    return seatNo;
  };
  const status = statusOf(selectedRoom);
  const soundTurnSeatNo = tabletopTurnSeatForSound(game, gameState);
  const soundActionSignal = tabletopActionSignalForSound(game, gameState);
  const isHost = selectedRoom && hostMemberIdOf(selectedRoom) === myMemberId;
  const guestPlayers = players.filter((player) => memberIdOf(player) !== hostMemberIdOf(selectedRoom));
  const readyGuestCount = guestPlayers.filter(isReady).length;
  const readyGuests = guestPlayers.every(isReady);
  const roomPlayerCount = players.length;
  const roomMinPlayers = minPlayersOf(selectedRoom);
  const roomMaxPlayers = maxPlayersOf(selectedRoom);
  const enoughPlayers = roomPlayerCount >= roomMinPlayers;
  const withinMaxPlayers = roomMaxPlayers <= 0 || roomPlayerCount <= roomMaxPlayers;
  const soloAiStartAvailable = canUseTabletopSoloAiStart({ game, playerCount: roomPlayerCount, minPlayers: roomMinPlayers });
  const aiBotStartSupported = supportsTabletopAiBotStart(game, roomMinPlayers);
  const startBotMin = aiBotStartSupported
    ? Math.max(String(game || "").toLowerCase() === "poker" && roomPlayerCount === 1 ? 1 : 0, roomMinPlayers - roomPlayerCount)
    : 0;
  const startBotMax = aiBotStartSupported && roomMaxPlayers > roomPlayerCount ? roomMaxPlayers - roomPlayerCount : 0;
  const effectiveStartBotCount = aiBotStartSupported
    ? clampTabletopBotCount(startBotCount, startBotMin, startBotMax)
    : 0;
  const startPlayerCount = roomPlayerCount + effectiveStartBotCount;
  const startUsesBots = effectiveStartBotCount > 0;
  const startBotOptions = aiBotStartSupported && startBotMax >= startBotMin
    ? Array.from({ length: startBotMax - startBotMin + 1 }, (_, index) => startBotMin + index)
    : [];
  const showStartBotSelector = isHost && status === "WAITING" && startBotMax > 0 && startBotOptions.length > 0;
  const startWithinMaxPlayers = roomMaxPlayers <= 0 || startPlayerCount <= roomMaxPlayers;
  const startPlayerRequirementMet = startPlayerCount >= roomMinPlayers && withinMaxPlayers && startWithinMaxPlayers;
  const startChecks = [
    {
      key: "players",
      done: startPlayerRequirementMet,
      label: "인원 조건",
      detail: startUsesBots
        ? `${roomPlayerCount}+AI ${effectiveStartBotCount}/${roomMaxPlayers || "-"}명 · 최소 ${roomMinPlayers}명`
        : `${roomPlayerCount}/${roomMaxPlayers || "-"}명 · 최소 ${roomMinPlayers}명`,
    },
    {
      key: "ready",
      done: readyGuests,
      label: "게스트 준비",
      detail: `${readyGuestCount}/${guestPlayers.length}명 준비`,
    },
    {
      key: "host",
      done: Boolean(isHost),
      label: "시작 권한",
      detail: isHost ? "방장 시작 가능" : "방장이 시작합니다",
    },
  ];
  const canStart = isHost && status === "WAITING" && startPlayerRequirementMet && readyGuests;
  const myRoomPlayer = players.find((player) => memberIdOf(player) === myMemberId);
  const myReady = Boolean(myRoomPlayer && isReady(myRoomPlayer));
  const startStatusText = canStart
    ? "시작 가능"
    : startChecks.find((check) => !check.done)?.detail || "시작 대기";
  const selectedVariant = useMemo(() => variants.find((variant) => variant.code === createForm.variantCode) || variants[0], [variants, createForm.variantCode]);
  const selectedSettingsVariant = useMemo(() => variants.find((variant) => variant.code === settingsForm.variantCode), [variants, settingsForm.variantCode]);
  const selectedRoomVariant = useMemo(() => variantForRoom(selectedRoom, variants), [selectedRoom, variants]);
  useEffect(() => {
    if (!selectedRoom || status !== "WAITING") {
      startRoomKeyRef.current = "";
      setStartBotCount(0);
      return;
    }
    const roomKey = [
      game,
      idOf(selectedRoom) || "",
      variantCodeOf(selectedRoom),
      roomPlayerCount,
      roomMinPlayers,
      roomMaxPlayers,
    ].join(":");
    const nextBase = startRoomKeyRef.current === roomKey
      ? startBotCount
      : defaultStartBotCountForRoom(game, selectedRoom);
    startRoomKeyRef.current = roomKey;
    const nextCount = clampTabletopBotCount(nextBase, startBotMin, startBotMax);
    if (nextCount !== startBotCount) {
      setStartBotCount(nextCount);
    }
  }, [game, roomMaxPlayers, roomMinPlayers, roomPlayerCount, selectedRoom, startBotCount, startBotMax, startBotMin, status]);
  useEffect(() => {
    const stateVariantCode = get(gameState, "variant_code", "variantCode", "");
    const stateMode = get(gameState, "mode", "mode", "");
    const roomVariantCode = selectedRoom ? variantCodeOf(selectedRoom) : "";
    setPageGuideContext({
      game,
      variantCode: stateVariantCode || stateMode || roomVariantCode || createForm.variantCode || selectedVariant?.code || "BASE",
      mode: stateMode,
      variant: selectedRoom ? selectedRoomVariant : selectedVariant,
      context: selectedRoom ? (gameState || status === "PLAYING" ? "play" : "waiting-room") : "lobby",
    });
    return clearPageGuideContext;
  }, [createForm.variantCode, game, gameState, selectedRoom, selectedRoomVariant, selectedVariant, status]);
  useGameSound({
    myTurn: Boolean(status === "PLAYING" && mySeatNo && soundTurnSeatNo === mySeatNo),
    actionSignal: soundActionSignal,
  });
  const selectedRoomVariantName = variantNameOf(selectedRoom) || variantDisplayName(selectedRoomVariant) || "선택한 규칙";
  const selectedRoomVariantTags = variantFeatureTags(game, selectedRoomVariant);
  const selectedRoomPlayerRangeText = roomMinPlayers === roomMaxPlayers
    ? `${roomMinPlayers}명 전용`
    : `${roomMinPlayers}~${roomMaxPlayers || "-"}명`;
  const startRuleHint = `${selectedRoomVariantName}은 ${selectedRoomPlayerRangeText} 규칙입니다. ${
    selectedRoomVariantTags.length ? `핵심 규칙: ${selectedRoomVariantTags.join(" · ")}. ` : ""
  }게스트가 모두 준비하면 방장이 시작할 수 있습니다.`;
  const effectiveStartRuleHint = startUsesBots
    ? `${startRuleHint} 선택한 AI ${effectiveStartBotCount}명을 추가해 ${startPlayerCount}명으로 시작합니다.`
    : startRuleHint;
  const settingsDisabledVariantCodes = useMemo(() => {
    const playerCount = players.length;
    return new Set(
      variants
        .filter((variant) => playerCount > variantMaxPlayers(variant))
        .map((variant) => String(variant.code || ""))
    );
  }, [players.length, variants]);
  const settingsDisabledReasonByCode = useMemo(() => {
    const playerCount = players.length;
    return Object.fromEntries(
      variants
        .filter((variant) => playerCount > variantMaxPlayers(variant))
        .map((variant) => [
          String(variant.code || ""),
          `현재 ${playerCount}명이라 최대 ${variantMaxPlayers(variant)}명 규칙으로 바꿀 수 없습니다.`,
        ])
    );
  }, [players.length, variants]);
  const selectedSettingsTooManyPlayers = Boolean(selectedSettingsVariant && players.length > variantMaxPlayers(selectedSettingsVariant));
  const isLatestLobbyLoad = (seq) => mountedRef.current && seq === lobbyLoadSeqRef.current;
  const isLatestRoomOpen = (seq) => mountedRef.current && seq === roomOpenSeqRef.current;
  const realtimeRoomRef = useRef(null);

  const resetRealtimeReplayCursor = () => {
    lastGameEventIdRef.current = null;
    lastGameServerSentAtRef.current = 0;
  };

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);
  useEffect(() => {
    mySeatNoRef.current = mySeatNo || 0;
  }, [mySeatNo]);

  const clearSixNimmtReplayTimers = () => {
    if (sixNimmtReplayTimerRef.current) {
      window.clearTimeout(sixNimmtReplayTimerRef.current);
      sixNimmtReplayTimerRef.current = null;
    }
    if (sixNimmtFinalFallbackTimerRef.current) {
      window.clearTimeout(sixNimmtFinalFallbackTimerRef.current);
      sixNimmtFinalFallbackTimerRef.current = null;
    }
  };

  const clearSixNimmtReplay = () => {
    clearSixNimmtReplayTimers();
    sixNimmtReplayQueueRef.current = [];
    sixNimmtQueuedEventNosRef.current = new Set();
    sixNimmtReplayRunningRef.current = false;
    sixNimmtPendingFinalStateRef.current = null;
    sixNimmtHandRefreshPendingRef.current = null;
  };

  const applySixNimmtState = (nextState) => {
    setGameState((prev) => {
      const merged = mergeSixNimmtRealtimeState(prev, nextState, mySeatNoRef.current || mySeatNo);
      gameStateRef.current = merged;
      return merged;
    });
  };

  const flushSixNimmtPendingFinal = () => {
    const pendingFinal = sixNimmtPendingFinalStateRef.current;
    sixNimmtPendingFinalStateRef.current = null;
    if (sixNimmtFinalFallbackTimerRef.current) {
      window.clearTimeout(sixNimmtFinalFallbackTimerRef.current);
      sixNimmtFinalFallbackTimerRef.current = null;
    }
    if (pendingFinal) {
      applySixNimmtState(pendingFinal);
    }
  };

  const playNextSixNimmtReplayStep = () => {
    const nextStep = sixNimmtReplayQueueRef.current.shift();
    if (!nextStep) {
      sixNimmtReplayRunningRef.current = false;
      flushSixNimmtPendingFinal();
      return;
    }
    sixNimmtReplayRunningRef.current = true;
    applySixNimmtState(nextStep);
    sixNimmtReplayTimerRef.current = window.setTimeout(() => {
      sixNimmtReplayTimerRef.current = null;
      playNextSixNimmtReplayStep();
    }, SIX_NIMMT_REPLAY_STEP_MS);
  };

  const enqueueSixNimmtReplayStep = (stepState) => {
    if (!stepState) return;
    const stepEventNo = sixNimmtLatestEventNo(stepState);
    if (stepEventNo && sixNimmtQueuedEventNosRef.current.has(stepEventNo)) return;
    const currentEventNo = sixNimmtLatestEventNo(gameStateRef.current);
    if (!sixNimmtPendingFinalStateRef.current
      && !sixNimmtReplayRunningRef.current
      && sixNimmtReplayQueueRef.current.length === 0
      && stepEventNo <= currentEventNo) {
      return;
    }
    if (sixNimmtFinalFallbackTimerRef.current) {
      window.clearTimeout(sixNimmtFinalFallbackTimerRef.current);
      sixNimmtFinalFallbackTimerRef.current = null;
    }
    if (stepEventNo) sixNimmtQueuedEventNosRef.current.add(stepEventNo);
    sixNimmtReplayQueueRef.current.push(stepState);
    if (!sixNimmtReplayRunningRef.current && !sixNimmtReplayTimerRef.current) {
      playNextSixNimmtReplayStep();
    }
  };

  const deferSixNimmtFinalState = (finalState) => {
    if (!finalState) return;
    const replaySteps = buildSixNimmtReplayStepsFromFinal(gameStateRef.current, finalState);
    sixNimmtPendingFinalStateRef.current = finalState;
    if (replaySteps.length) {
      if (sixNimmtFinalFallbackTimerRef.current) {
        window.clearTimeout(sixNimmtFinalFallbackTimerRef.current);
        sixNimmtFinalFallbackTimerRef.current = null;
      }
      replaySteps.forEach(enqueueSixNimmtReplayStep);
      return;
    }
    if (sixNimmtReplayRunningRef.current || sixNimmtReplayQueueRef.current.length > 0 || sixNimmtReplayTimerRef.current) {
      return;
    }
    if (sixNimmtFinalFallbackTimerRef.current) {
      window.clearTimeout(sixNimmtFinalFallbackTimerRef.current);
    }
    sixNimmtFinalFallbackTimerRef.current = window.setTimeout(() => {
      sixNimmtFinalFallbackTimerRef.current = null;
      if (!sixNimmtReplayRunningRef.current && sixNimmtReplayQueueRef.current.length === 0) {
        flushSixNimmtPendingFinal();
      }
    }, SIX_NIMMT_FINAL_FALLBACK_MS);
  };

  const fetchVariants = async (seq = lobbyLoadSeqRef.current) => {
    const nextVariants = visibleTabletopVariants(game, await tabletopGameAdapter.fetchVariants(game));
    if (!isLatestLobbyLoad(seq)) return;
    setVariants(nextVariants);
    if (nextVariants.length) {
      setCreateForm((prev) => {
        const exists = nextVariants.some((variant) => variant.code === prev.variantCode);
        return { ...prev, variantCode: exists ? prev.variantCode : nextVariants[0].code };
      });
    }
  };

  const fetchRooms = async (seq = lobbyLoadSeqRef.current) => {
    const nextRooms = visibleTabletopRooms(game, await tabletopGameAdapter.fetchRooms(game));
    if (!isLatestLobbyLoad(seq)) return;
    setRooms(nextRooms);
  };

  const refreshRooms = async () => {
    const seq = ++lobbyLoadSeqRef.current;
    setRoomsRefreshing(true);
    setLoadError("");
    try {
      await fetchRooms(seq);
    } catch {
      if (!isLatestLobbyLoad(seq)) return;
      setLoadError("방 목록을 새로고침하지 못했습니다.");
      notifyError("방 목록을 새로고침하지 못했습니다.");
    } finally {
      if (isLatestLobbyLoad(seq)) setRoomsRefreshing(false);
    }
  };

  const retryLobbyLoad = async () => {
    const seq = ++lobbyLoadSeqRef.current;
    setInitialLoading(true);
    setLoadError("");
    const results = await Promise.allSettled([fetchVariants(seq), fetchRooms(seq)]);
    if (!isLatestLobbyLoad(seq)) return;
    if (results.some((result) => result.status === "rejected")) {
      setLoadError("게임 설정 또는 방 목록을 불러오지 못했습니다.");
      notifyError("게임 설정 또는 방 목록을 불러오지 못했습니다.");
    }
    setInitialLoading(false);
  };

  const fetchMyRooms = async () => {
    return visibleTabletopRooms(game, await tabletopGameAdapter.fetchMyRooms(game));
  };

  const resumeTitleStorageKey = config.storageKey.replace(/_id$/, "_title");
  const rememberRoomSelection = (room) => {
    const roomId = idOf(room);
    if (!roomId) return;
    localStorage.setItem(config.storageKey, String(roomId));
    localStorage.setItem(resumeTitleStorageKey, String(room?.title || codeOf(room) || `${config.title} 최근 방`));
  };

  const clearRoomSelection = (roomId) => {
    roomOpenSeqRef.current += 1;
    resetRealtimeReplayCursor();
    clearSixNimmtReplay();
    sixNimmtHandRefreshInFlightRef.current = null;
    realtimeRoomRef.current = null;
    mySeatNoRef.current = 0;
    setSelectedRoom(null);
    gameStateRef.current = null;
    setGameState(null);
    const storedId = localStorage.getItem(config.storageKey);
    if (!roomId || storedId === String(roomId)) {
      localStorage.removeItem(config.storageKey);
      localStorage.removeItem(resumeTitleStorageKey);
    }
    if (gameSubRef.current) {
      gameSubRef.current.unsubscribe();
      gameSubRef.current = null;
    }
  };

  const handleStateLoadError = (error, roomId, fallbackMessage) => {
    if (isTabletopStateAccessError(error)) {
      clearRoomSelection(roomId);
      notifyError("방 참가자만 상태를 볼 수 있습니다. 다시 입장해주세요.");
      return;
    }
    notifyError(fallbackMessage);
  };

  const fetchState = async (roomId, roomSeq = null) => {
    const payload = await tabletopGameAdapter.fetchState(game, roomId);
    if (!mountedRef.current) return null;
    if (roomSeq !== null && !isLatestRoomOpen(roomSeq)) return null;
    const room = payload?.room || null;
    if (room) {
      syncMySeatNoFromRoom(room);
      setSelectedRoom(room);
    }
    const nextGameState = payload?.gameState || null;
    gameStateRef.current = nextGameState;
    setGameState(nextGameState);
    return room;
  };

  const refreshSixNimmtViewerHand = (roomId, roomSeq) => {
    if (sixNimmtHandRefreshInFlightRef.current === roomSeq) {
      sixNimmtHandRefreshPendingRef.current = { roomId, roomSeq };
      return;
    }
    sixNimmtHandRefreshInFlightRef.current = roomSeq;
    fetchState(roomId, roomSeq)
      .catch((error) => {
        if (isLatestRoomOpen(roomSeq)) handleStateLoadError(error, roomId, "비공개 손패 정보를 갱신하지 못했습니다.");
      })
      .finally(() => {
        if (sixNimmtHandRefreshInFlightRef.current === roomSeq) {
          sixNimmtHandRefreshInFlightRef.current = null;
        }
        const pending = sixNimmtHandRefreshPendingRef.current;
        if (pending && pending.roomSeq === roomSeq && isLatestRoomOpen(roomSeq)) {
          sixNimmtHandRefreshPendingRef.current = null;
          refreshSixNimmtViewerHand(pending.roomId, pending.roomSeq);
        }
      });
  };

  const applyTabletopRealtimePayload = (payload, roomId, roomSeq, { notifyMessage = true } = {}) => {
    if (!payload || !isLatestRoomOpen(roomSeq)) return false;
    const sentAt = Date.parse(payload.serverSentAt || "");
    if (Number.isFinite(sentAt) && sentAt < lastGameServerSentAtRef.current) return false;
    if (Number.isFinite(sentAt)) lastGameServerSentAtRef.current = sentAt;
    if (payload.eventId) lastGameEventIdRef.current = payload.eventId;

    if (payload.room) {
      syncMySeatNoFromRoom(payload.room);
      setSelectedRoom(payload.room);
    }
    if (game === "six-nimmt" && payload.gameState) {
      const eventType = String(get(payload, "event_type", "eventType", "") || "").toLowerCase();
      const viewerSeatNo = mySeatNoRef.current || mySeatNo;
      const needsViewerHandRefresh = sixNimmtNeedsViewerHandRefresh(payload.gameState, viewerSeatNo);
      let viewerRefreshRequested = false;
      const requestViewerRefresh = () => {
        viewerRefreshRequested = true;
        refreshSixNimmtViewerHand(roomId, roomSeq);
      };
      if (eventType === "six_nimmt_resolution_step") {
        enqueueSixNimmtReplayStep(payload.gameState);
      } else if (sixNimmtHasNewPlacementEvents(gameStateRef.current, payload.gameState)
        || sixNimmtReplayRunningRef.current
        || sixNimmtReplayQueueRef.current.length > 0
        || sixNimmtReplayTimerRef.current) {
        deferSixNimmtFinalState(payload.gameState);
      } else {
        requestViewerRefresh();
      }
      if (needsViewerHandRefresh && !viewerRefreshRequested) {
        requestViewerRefresh();
      }
    } else if ((game === "dalmuti" || game === "catan" || game === "poker" || game === "telestrations" || game === "mafia") && payload.gameState) {
      fetchState(roomId, roomSeq).catch((error) => {
        if (isLatestRoomOpen(roomSeq)) handleStateLoadError(error, roomId, "Failed to refresh private game state.");
      });
    } else {
      const nextGameState = payload.gameState || null;
      gameStateRef.current = nextGameState;
      setGameState(nextGameState);
    }
    if (notifyMessage && payload.message) notify(payload.message);
    return true;
  };

  const replayTabletopRoomEvents = async (roomId, roomSeq) => {
    const afterMessageId = lastGameEventIdRef.current;
    if (!afterMessageId || !isLatestRoomOpen(roomSeq)) return;
    const replay = await realtimeReplayAdapter.fetchGameRoom(game, roomId, { afterMessageId, limit: 50 });
    if (replay.fullSyncRequired) {
      await fetchState(roomId, roomSeq);
      return;
    }
    replay.events.forEach((event) => {
      if (!isLatestRoomOpen(roomSeq)) return;
      const payload = normalizeTabletopStatePayload(event.payload);
      if (!payload?.eventId && event.messageId) payload.eventId = event.messageId;
      applyTabletopRealtimePayload(payload, roomId, roomSeq);
    });
  };

  const bindRealtimeRoom = async (client, roomId, roomSeq) => {
    if (!client?.connected || !isLatestRoomOpen(roomSeq)) return;
    if (gameSubRef.current) gameSubRef.current.unsubscribe();
    gameSubRef.current = client.subscribe(`/sub/game/${game}/room/${roomId}`, (message) => {
      if (!isLatestRoomOpen(roomSeq)) return;
      let payload;
      try {
        payload = normalizeTabletopStatePayload(JSON.parse(message.body || "{}"));
      } catch {
        fetchState(roomId, roomSeq).catch((error) => {
          if (isLatestRoomOpen(roomSeq)) handleStateLoadError(error, roomId, "방 정보를 갱신하지 못했습니다.");
        });
        return;
      }
      applyTabletopRealtimePayload(payload, roomId, roomSeq);
    });
    await replayTabletopRoomEvents(roomId, roomSeq).catch((error) => {
      if (isLatestRoomOpen(roomSeq)) handleStateLoadError(error, roomId, "Failed to replay missed room events.");
    });
    await fetchState(roomId, roomSeq);
  };

  const bindLatestRealtimeRoom = async (client) => {
    const target = realtimeRoomRef.current;
    if (!target) return;
    await bindRealtimeRoom(client, target.roomId, target.roomSeq);
  };

  const ensureSocket = async () => {
    if (stompRef.current) return stompRef.current;
    if (stompInitRef.current) return stompInitRef.current;
    const connectHeaders = buildStompConnectHeaders();
    if (!connectHeaders.Authorization) return null;
    stompInitRef.current = createStompClient({
      endpoint: "/ws/chat",
      connectHeaders,
      reconnectDelay: 3000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    }).then((client) => {
      if (!mountedRef.current) return null;
      client.beforeConnect = () => {
        client.connectHeaders = buildStompConnectHeaders();
      };
      client.onConnect = () => {
        bindLatestRealtimeRoom(client).catch((error) => {
          const target = realtimeRoomRef.current;
          if (target && isLatestRoomOpen(target.roomSeq)) {
            handleStateLoadError(error, target.roomId, "방 정보를 불러오지 못했습니다.");
          }
        });
      };
      client.onStompError = (frame) => {
        void notifyRealtimeError({
          scope: `tabletop-game-${game}`,
          error: frame,
          fallbackMessage: "게임 실시간 연결 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        });
      };
      client.activate();
      stompRef.current = client;
      return client;
    }).finally(() => {
      stompInitRef.current = null;
    });
    return stompInitRef.current;
  };

  const openRoom = async (room) => {
    if (!mountedRef.current) return;
    const roomSeq = ++roomOpenSeqRef.current;
    resetRealtimeReplayCursor();
    syncMySeatNoFromRoom(room);
    setSelectedRoom(room);
    const roomId = idOf(room);
    if (!roomId) return;
    rememberRoomSelection(room);
    setSettingsForm({
      variantCode: variantCodeOf(room),
      turnTimeSeconds: String(turnSecondsOf(room)),
    });

    realtimeRoomRef.current = { roomId, roomSeq };
    const clientPromise = ensureSocket();
    await fetchState(roomId, roomSeq).catch((error) => {
      if (!isLatestRoomOpen(roomSeq)) return;
      handleStateLoadError(error, roomId, "방 정보를 불러오지 못했습니다.");
      throw error;
    });
    const client = await clientPromise;
    if (client?.connected) {
      await bindRealtimeRoom(client, roomId, roomSeq).catch((error) => {
        if (isLatestRoomOpen(roomSeq)) handleStateLoadError(error, roomId, "방 정보를 불러오지 못했습니다.");
      });
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const seq = ++lobbyLoadSeqRef.current;
    let active = true;
    setInitialLoading(true);
    setLoadError("");

    Promise.allSettled([fetchVariants(seq), fetchRooms(seq)])
      .then((results) => {
        if (!active || !isLatestLobbyLoad(seq)) return;
        if (results.some((result) => result.status === "rejected")) {
          setLoadError("게임 설정 또는 방 목록을 불러오지 못했습니다.");
          notifyError("게임 설정 또는 방 목록을 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (active && isLatestLobbyLoad(seq)) setInitialLoading(false);
      });

    return () => {
      active = false;
    };
  }, [game]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const myRooms = await fetchMyRooms();
        if (!active) return;
        const storedId = Number(localStorage.getItem(config.storageKey) || 0);
        const room = myRooms.find((item) => Number(idOf(item)) === storedId) || myRooms[0];
        if (room) {
          await openRoom(room);
        } else {
          clearRoomSelection();
        }
      } catch {
        if (!active) return;
        mySeatNoRef.current = 0;
        setSelectedRoom(null);
        gameStateRef.current = null;
        setGameState(null);
      }
    })();
    return () => {
      active = false;
      clearSixNimmtReplay();
      if (gameSubRef.current) gameSubRef.current.unsubscribe();
      if (stompRef.current) stompRef.current.deactivate();
      realtimeRoomRef.current = null;
      stompRef.current = null;
      stompInitRef.current = null;
      gameSubRef.current = null;
    };
  }, [game]);

  const createRoom = async (event) => {
    event.preventDefault();
    if (busyRef.current) {
      notify("이전 방 요청을 처리하는 중입니다.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const title = String(formData.get("title") ?? createForm.title ?? "");
    const variantCode = String(formData.get("variantCode") || createForm.variantCode || "");
    const turnTimeSeconds = Number(formData.get("turnTimeSeconds") || createForm.turnTimeSeconds || 30);
    busyRef.current = true;
    try {
      setBusy(true);
      const room = await tabletopGameAdapter.createRoom(game, {
        title,
        variantCode,
        turnTimeSeconds,
      });
      await openRoom(room);
      await fetchRooms();
      notifySuccess("방 생성 완료");
    } catch {
      notifyError("방 생성 실패");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const joinRoom = async (roomId) => {
    if (busyRef.current) {
      notify("이전 방 요청을 처리하는 중입니다.");
      return;
    }
    busyRef.current = true;
    try {
      setBusy(true);
      const room = await tabletopGameAdapter.joinRoom(game, roomId);
      await openRoom(room);
      await fetchRooms();
      notifySuccess("방 입장 완료");
    } catch {
      notifyError("방 입장 실패");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const joinByCode = async (event) => {
    event.preventDefault();
    if (busyRef.current) {
      notify("이전 방 요청을 처리하는 중입니다.");
      return;
    }
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      notifyError("방 코드를 입력해주세요.");
      return;
    }
    busyRef.current = true;
    try {
      setBusy(true);
      const room = await tabletopGameAdapter.joinByCode(game, code);
      setJoinCode("");
      await openRoom(room);
      await fetchRooms();
      notifySuccess("방 코드로 입장했습니다.");
    } catch {
      notifyError("방 코드 입장 실패");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const saveSettings = async () => {
    if (!selectedRoom) return;
    if (busyRef.current) {
      notify("이전 방 요청을 처리하는 중입니다.");
      return;
    }
    if (selectedSettingsTooManyPlayers) {
      notifyError(`현재 ${players.length}명이라 이 규칙으로 변경할 수 없습니다.`);
      return;
    }
    busyRef.current = true;
    try {
      setBusy(true);
      const room = await tabletopGameAdapter.updateSettings(game, idOf(selectedRoom), {
        variantCode: settingsForm.variantCode,
        turnTimeSeconds: Number(settingsForm.turnTimeSeconds || 30),
      });
      syncMySeatNoFromRoom(room);
      setSelectedRoom(room);
      gameStateRef.current = null;
      setGameState(null);
      await fetchRooms();
      notifySuccess("방 설정 저장 완료");
    } catch {
      notifyError("방 설정 저장 실패");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const toggleReady = async () => {
    if (!selectedRoom) return;
    if (busyRef.current) {
      notify("이전 방 요청을 처리하는 중입니다.");
      return;
    }
    busyRef.current = true;
    try {
      setBusy(true);
      await tabletopGameAdapter.toggleReady(game, idOf(selectedRoom));
    } catch {
      notifyError("준비 상태 변경 실패");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const startGame = async () => {
    if (!selectedRoom) return;
    if (busyRef.current) {
      notify("이전 방 요청을 처리하는 중입니다.");
      return;
    }
    busyRef.current = true;
    try {
      setBusy(true);
      const roomId = idOf(selectedRoom);
      const startOptions = startUsesBots ? { botCount: effectiveStartBotCount } : undefined;
      await tabletopGameAdapter.startGame(game, roomId, startOptions);
      try {
        await fetchState(roomId, roomOpenSeqRef.current);
      } catch (error) {
        if (game !== "telestrations") throw error;
        setSelectedRoom((prev) => prev ? { ...prev, roomStatus: "PLAYING" } : prev);
        notify("게임을 시작했습니다. 화면 상태를 동기화하는 중입니다.");
      }
      notifySuccess("게임 시작");
    } catch {
      notifyError("인원과 준비 상태를 확인해주세요.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const sendAction = async (payload) => {
    if (!selectedRoom) return;
    if (actionBusyRef.current) {
      notify("이전 행동을 처리하는 중입니다.");
      return;
    }
    const roomId = idOf(selectedRoom);
    actionBusyRef.current = true;
    setActionBusy(true);
    try {
      const result = await tabletopGameAdapter.sendAction(game, roomId, payload);
      if (result?.room) {
        syncMySeatNoFromRoom(result.room);
        setSelectedRoom(result.room);
      }
      if (game === "six-nimmt" && result?.gameState) {
        if (sixNimmtHasNewPlacementEvents(gameStateRef.current, result.gameState)) {
          deferSixNimmtFinalState(result.gameState);
        } else {
          applySixNimmtState(result.gameState);
        }
      } else {
        const nextGameState = result?.gameState || null;
        gameStateRef.current = nextGameState;
        setGameState(nextGameState);
      }
      return result;
    } catch (error) {
      if (roomId) {
        await fetchState(roomId, roomOpenSeqRef.current).catch(() => {});
      }
      throw error;
    } finally {
      actionBusyRef.current = false;
      setActionBusy(false);
    }
  };

  const forceFinish = async () => {
    if (!selectedRoom) return;
    if (busyRef.current) {
      notify("이전 방 요청을 처리하는 중입니다.");
      return;
    }
    const confirmed = await confirmAction({
      title: "진행 중인 게임을 종료할까요?",
      description: "현재 판을 중단하고 같은 방의 대기 상태로 돌아갑니다.",
      confirmText: "종료",
    });
    if (!confirmed) return;
    busyRef.current = true;
    try {
      setBusy(true);
      const room = await tabletopGameAdapter.forceFinish(game, idOf(selectedRoom));
      syncMySeatNoFromRoom(room);
      setSelectedRoom(room);
      gameStateRef.current = null;
      setGameState(null);
      notifySuccess("대기방으로 돌아왔습니다.");
    } catch {
      notifyError("게임 종료 실패");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const rematch = async () => {
    if (!selectedRoom) return;
    if (busyRef.current) {
      notify("이전 방 요청을 처리하는 중입니다.");
      return;
    }
    busyRef.current = true;
    try {
      setBusy(true);
      const room = await tabletopGameAdapter.rematch(game, idOf(selectedRoom));
      syncMySeatNoFromRoom(room);
      setSelectedRoom(room);
      gameStateRef.current = null;
      setGameState(null);
      notifySuccess("다시 준비합니다.");
    } catch {
      notifyError("다시 하기 실패");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const leaveRoom = async () => {
    if (!selectedRoom) return;
    if (busyRef.current) {
      notify("이전 방 요청을 처리하는 중입니다.");
      return;
    }
    busyRef.current = true;
    try {
      setBusy(true);
      const roomId = idOf(selectedRoom);
      await tabletopGameAdapter.leaveRoom(game, roomId);
      clearRoomSelection(roomId);
      await fetchRooms();
      notifySuccess("방 퇴장 완료");
    } catch {
      notifyError("방 퇴장 실패");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const copySelectedRoomCode = async () => {
    const roomCode = codeOf(selectedRoom);
    if (!roomCode || typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      notifyError("방 코드를 복사할 수 없습니다.");
      return;
    }
    try {
      await navigator.clipboard.writeText(roomCode);
      notifySuccess("방 코드 복사 완료");
    } catch {
      notifyError("방 코드를 복사할 수 없습니다.");
    }
  };

  if (!config) return null;

  return (
    <div className={`tabletop-game tabletop-${game} animate-fade-in space-y-6`}>
      <section className={`overflow-hidden rounded-2xl bg-gradient-to-br ${config.accent} p-[1px] shadow-2xl sm:rounded-[2rem]`}>
        <div className="bg-white p-5 sm:p-8">
          <div className="grid gap-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1 text-[11px] font-black text-slate-500">
                  <Dices className="h-3.5 w-3.5 text-primary-500" />
                  {config.eyebrow}
                </div>
                <Link to="/app/games" className="hidden min-h-10 items-center justify-center rounded-xl bg-slate-100 px-4 text-sm font-black text-slate-700 transition hover:bg-slate-900 hover:text-white sm:inline-flex">
                  게임 목록
                </Link>
              </div>
              <h1 className="mt-4 text-2xl font-black tracking-tight text-slate-900 sm:text-4xl">{config.title}</h1>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px] font-black text-slate-600" data-smoke="tabletop-route-artwork">
              <span data-smoke="tabletop-game-artwork" className="rounded-full bg-slate-100 px-2.5 py-1">{config.title}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1">{config.eyebrow}</span>
            </div>
          </div>
        </div>
      </section>

      {!selectedRoom && (
        <section className="space-y-4" aria-busy={initialLoading ? "true" : "false"}>
          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <form onSubmit={createRoom} className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg sm:p-5" aria-label={`${config.title} 방 만들기`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-lg font-black text-slate-900">방 만들기</div>
              {initialLoading && <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-black text-sky-700">불러오는 중</span>}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3">
              <div className="text-[11px] font-black text-ink-muted">방 제목</div>
              <input
                name="title"
                className="min-h-11 rounded-xl border border-line bg-control px-3 py-2 text-sm font-bold text-ink placeholder:text-ink-subtle focus:border-primary-500 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-focus/20"
                placeholder="방 제목"
                aria-label="방 제목"
                value={createForm.title}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
              />
              <div className="text-[11px] font-black text-ink-muted">규칙</div>
              <select
                name="variantCode"
                className="min-h-11 rounded-xl border border-line bg-control px-3 py-2 text-sm font-bold text-ink focus:border-primary-500 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-focus/20"
                value={createForm.variantCode}
                aria-label={`${config.title} 규칙 선택`}
                disabled={initialLoading || !variants.length}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, variantCode: event.target.value }))}
              >
                <VariantOptions game={game} variants={variants} />
              </select>
              {variants.length ? (
                <VariantChoiceGrid
                  game={game}
                  variants={variants}
                  value={createForm.variantCode}
                  onChange={(variantCode) => setCreateForm((prev) => ({ ...prev, variantCode }))}
                />
              ) : (
                <div className="rounded-xl bg-slate-50 px-3 py-4 text-sm font-bold leading-relaxed text-slate-500" role="status" aria-live="polite">
                  {initialLoading ? "선택 가능한 규칙을 불러오는 중입니다." : "선택 가능한 규칙을 불러오지 못했습니다. 잠시 후 새로고침해주세요."}
                </div>
              )}
              <div className="text-[11px] font-black text-ink-muted">턴 제한 시간</div>
              <input
                name="turnTimeSeconds"
                type="text"
                inputMode="numeric"
                className="min-h-11 rounded-xl border border-line bg-control px-3 py-2 text-sm font-bold text-ink placeholder:text-ink-subtle focus:border-primary-500 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-focus/20"
                placeholder="턴 시간(초)"
                aria-label="턴 시간 초"
                value={createForm.turnTimeSeconds}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, turnTimeSeconds: event.target.value.replace(/[^\d]/g, "") }))}
                onBlur={() => setCreateForm((prev) => ({ ...prev, turnTimeSeconds: clampDigits(prev.turnTimeSeconds, 5, 180, 30) }))}
              />
              {selectedVariant && (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
                  <span className="inline-flex rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-700">
                    {variantGroupLabel(game, selectedVariant)}
                  </span>
                  <span className="text-[11px] font-black text-slate-500">
                    {get(selectedVariant, "min_players", "minPlayers", 0)}~{get(selectedVariant, "max_players", "maxPlayers", 0)}명
                  </span>
                </div>
              )}
              <button type="submit" data-smoke="tabletop-create-room-submit" className="min-h-11 rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white disabled:opacity-50" disabled={busy || initialLoading || !variants.length} aria-label={`${config.title} ${variantDisplayName(selectedVariant)} 방 만들기`}>
                {initialLoading ? "준비 중" : "방 만들기"}
              </button>
            </div>
          </form>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-lg font-black text-slate-900">대기 중인 방</div>
              <button type="button" className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-700 disabled:opacity-50" onClick={refreshRooms} disabled={roomsRefreshing || initialLoading} aria-label={`${config.title} 대기방 목록 새로고침`}>
                <RefreshCw className={`h-3.5 w-3.5 ${roomsRefreshing ? "animate-spin" : ""}`} />
                {roomsRefreshing ? "갱신 중" : "새로고침"}
              </button>
            </div>
            {!!loadError && (
              <div className="mt-3 flex flex-col gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-bold leading-relaxed text-rose-700 sm:flex-row sm:items-center sm:justify-between" role="alert">
                <span>{loadError}</span>
                <button
                  type="button"
                  className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg bg-white px-3 py-1.5 text-xs font-black text-rose-700 shadow-sm disabled:opacity-50"
                  onClick={retryLobbyLoad}
                  disabled={initialLoading}
                >
                  다시 시도
                </button>
              </div>
            )}
            <TabletopJoinCodePanel
              game={game}
              config={config}
              joinCode={joinCode}
              setJoinCode={setJoinCode}
              busy={busy}
              initialLoading={initialLoading}
              joinByCode={joinByCode}
            />
            <div className="mt-4 space-y-2.5">
              {initialLoading && !rooms.length && (
                <TabletopLobbyEmptyState game={game} config={config} initialLoading />
              )}
              {!initialLoading && !rooms.length && (
                <TabletopLobbyEmptyState game={game} config={config} initialLoading={false} />
              )}
              {rooms.map((room) => {
                const roomVariant = variantForRoom(room, variants);
                const listedPlayers = playersOf(room);
                const listedMaxPlayers = maxPlayersOf(room);
                const listedMinPlayers = minPlayersOf(room);
                const listedStatus = statusOf(room);
                const alreadyInListedRoom = listedPlayers.some((player) => memberIdOf(player) === myMemberId);
                const listedRoomFull = listedMaxPlayers > 0 && listedPlayers.length >= listedMaxPlayers;
                const listedJoinDisabled = busy || (!alreadyInListedRoom && (listedRoomFull || listedStatus !== "WAITING"));
                const listedCanJoin = listedStatus === "WAITING" && !listedRoomFull;
                const readiness = tabletopLobbyRoomReadiness(room);
                const actionSignal = tabletopLobbyRoomActionSignal(room, alreadyInListedRoom);
                const hostPlayer = listedPlayers.find((player) => memberIdOf(player) === hostMemberIdOf(room));
                const statusTone = tabletopRoomStatusTone(listedStatus);
                const listedVariantGroupLabel = variantGroupLabel(game, roomVariant);
                const roomHelpText = [
                  variantNameOf(room),
                  variantSummaryOf(room) || get(roomVariant, "summary", "summary", ""),
                  readiness.detail,
                  actionSignal.detail,
                ].filter(Boolean).join(" · ");
                return (
                  <div
                    key={idOf(room)}
                    className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3"
                    data-smoke="tabletop-lobby-room-card"
                    data-room-status={listedStatus || ""}
                    data-joinable={listedCanJoin ? "true" : "false"}
                    data-member-count={listedPlayers.length}
                    data-max-players={listedMaxPlayers || ""}
                  >
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_168px] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="break-words text-sm font-black text-slate-900">{room.title}</div>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ${statusTone}`}>
                            {statusLabels[listedStatus] || listedStatus || "대기 중"}
                          </span>
                          {alreadyInListedRoom && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">참가 중</span>}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-black">
                          <span className="rounded-full bg-white px-2 py-1 text-slate-600">{listedVariantGroupLabel}</span>
                          <span
                            className={`rounded-full px-2 py-1 ${listedRoomFull ? "bg-rose-50 text-rose-700" : "bg-white text-slate-600"}`}
                            data-smoke="tabletop-lobby-room-slot"
                          >
                            {listedPlayers.length}/{listedMaxPlayers || "-"}명{listedRoomFull ? " · 가득 참" : ""}
                          </span>
                          <span className="rounded-full bg-white px-2 py-1 text-slate-600">최소 {listedMinPlayers || "-"}명</span>
                          <span className="rounded-full bg-white px-2 py-1 text-slate-600">코드 {codeOf(room)}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-500">
                          <span>방장 {hostPlayer?.nickname || "-"}</span>
                          <span>턴 {turnSecondsOf(room)}초</span>
                          <span data-smoke="tabletop-lobby-room-readiness">{readiness.value}</span>
                          <span className="sr-only" data-smoke="tabletop-lobby-room-action-signal">{actionSignal.value}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="min-h-11 w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={listedJoinDisabled}
                        onClick={() => (alreadyInListedRoom ? openRoom(room) : joinRoom(idOf(room)))}
                        aria-label={`${room.title} ${variantNameOf(room)} ${listedPlayers.length}/${listedMaxPlayers || "-"}명 ${alreadyInListedRoom ? "열기" : listedRoomFull ? "가득 참" : listedStatus !== "WAITING" ? "진행 중" : "입장"}`}
                        title={`${room.title} · ${variantNameOf(room)} · ${listedPlayers.length}/${listedMaxPlayers || "-"}명`}
                        data-smoke="tabletop-lobby-room-primary"
                      >
                        {alreadyInListedRoom ? "열기" : listedRoomFull ? "가득 참" : listedStatus !== "WAITING" ? "진행 중" : "입장"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          </div>
        </section>
      )}

      {selectedRoom && (
        <section className="space-y-4">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="break-words text-xl font-black text-slate-900">{selectedRoom.title}</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-black">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">방 코드 {codeOf(selectedRoom)}</span>
                  <button
                    type="button"
                    className="inline-flex min-h-8 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-700"
                    onClick={copySelectedRoomCode}
                    title="방 코드 복사"
                    aria-label={`방 코드 ${codeOf(selectedRoom)} 복사`}
                  >
                    <Copy className="h-3 w-3" />
                    코드 복사
                  </button>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">{variantGroupLabel(game, selectedRoomVariant)}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">{variantNameOf(selectedRoom)}</span>
                </div>
              </div>
              <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:flex sm:flex-wrap">
                <Link to="/app/games" className="hidden min-h-11 items-center justify-center rounded-xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-900 hover:text-white sm:inline-flex">
                  게임 목록
                </Link>
                {isHost && status === "PLAYING" && (
                  <button className="min-h-11 rounded-xl bg-amber-100 px-4 py-2 text-sm font-black text-amber-700 disabled:opacity-40" disabled={busy} onClick={forceFinish} aria-label={`${selectedRoom.title} 게임 강제 종료`}>
                    강제 종료
                  </button>
                )}
                {isHost && status === "FINISHED" && (
                  <button className="min-h-11 rounded-xl bg-emerald-100 px-4 py-2 text-sm font-black text-emerald-700 disabled:opacity-40" disabled={busy} onClick={rematch} aria-label={`${selectedRoom.title} 다시 하기`}>
                    다시 하기
                  </button>
                )}
                {status === "WAITING" && !isHost && (
                  <button className="min-h-11 rounded-xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 disabled:opacity-40" disabled={busy} onClick={toggleReady} aria-label={myReady ? `${selectedRoom.title} 준비 취소` : `${selectedRoom.title} 준비하기`}>
                    {myReady ? "준비 취소" : "준비하기"}
                  </button>
                )}
                {showStartBotSelector && (
                  <label className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-control px-3 py-2 text-xs font-black text-ink">
                    <span className="shrink-0">추가 AI</span>
                    <select
                      className="min-h-7 rounded-lg border border-line bg-surface px-2 py-1 text-xs font-black text-ink focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-focus/20"
                      value={effectiveStartBotCount}
                      aria-label="추가 AI 수"
                      disabled={busy}
                      onChange={(event) => setStartBotCount(clampTabletopBotCount(event.target.value, startBotMin, startBotMax))}
                    >
                      {startBotOptions.map((count) => (
                        <option key={count} value={count}>{count}명</option>
                      ))}
                    </select>
                  </label>
                )}
                {isHost && status === "WAITING" && (
                  <button className="min-h-11 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white disabled:opacity-40" disabled={!canStart || busy} onClick={startGame} aria-label={canStart ? `${selectedRoom.title} 게임 시작` : `${selectedRoom.title} 시작 대기: ${startStatusText}`} title={canStart ? effectiveStartRuleHint : startStatusText}>
                    {canStart ? (startUsesBots || soloAiStartAvailable ? "AI와 시작" : "시작") : "시작 대기"}
                  </button>
                )}
                <button className="min-h-11 rounded-xl bg-rose-50 px-4 py-2 text-sm font-black text-rose-600 disabled:opacity-40" disabled={busy} onClick={leaveRoom} aria-label={`${selectedRoom.title} 방 퇴장`}>
                  퇴장
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-xl bg-slate-50 px-3 py-2" role="status" aria-live="polite" aria-atomic="true"><div className="font-black text-slate-700">상태</div><div className="font-bold text-slate-500">{statusLabels[status] || status}</div></div>
              <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="font-black text-slate-700">규칙</div><div className="font-bold text-slate-500">{variantGroupLabel(game, selectedRoomVariant)}</div></div>
              <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="font-black text-slate-700">인원</div><div className="font-bold text-slate-500">{status === "WAITING" && startUsesBots ? `${players.length}+AI ${effectiveStartBotCount}/${maxPlayersOf(selectedRoom)}명` : `${players.length}/${maxPlayersOf(selectedRoom)}명`}</div></div>
            </div>

            {isHost && status === "WAITING" && (
              <div className="mt-4 grid grid-cols-1 gap-2 rounded-2xl border border-line bg-control p-3 md:grid-cols-[minmax(0,1fr)_160px_140px]">
                <label className="space-y-1.5">
                  <span className="block text-[11px] font-black text-ink-muted">규칙</span>
                <select
                  className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm font-bold text-ink focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-focus/20"
                  value={settingsForm.variantCode}
                  aria-label="방 규칙 변경"
                  onChange={(event) => setSettingsForm((prev) => ({ ...prev, variantCode: event.target.value }))}
                >
                  <VariantOptions game={game} variants={variants} disabledCodes={settingsDisabledVariantCodes} />
                </select>
                </label>
                <label className="space-y-1.5">
                  <span className="block text-[11px] font-black text-ink-muted">턴 제한</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm font-bold text-ink focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-focus/20"
                  value={settingsForm.turnTimeSeconds}
                  aria-label="방 턴 시간 초 변경"
                  onChange={(event) => setSettingsForm((prev) => ({ ...prev, turnTimeSeconds: event.target.value.replace(/[^\d]/g, "") }))}
                  onBlur={() => setSettingsForm((prev) => ({ ...prev, turnTimeSeconds: clampDigits(prev.turnTimeSeconds, 5, 180, 30) }))}
                />
                </label>
                <button className="min-h-11 rounded-xl bg-slate-900 px-3 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40" disabled={selectedSettingsTooManyPlayers || busy} onClick={saveSettings} type="button" aria-label={selectedSettingsTooManyPlayers ? "현재 인원 때문에 방 설정 저장 불가" : "방 설정 저장"} title={selectedSettingsTooManyPlayers ? "현재 인원이 선택한 규칙의 최대 인원을 초과합니다." : "방 설정 저장"}>
                  설정 저장
                </button>
                <div className="md:col-span-3">
                  <VariantChoiceGrid
                    game={game}
                    variants={variants}
                    value={settingsForm.variantCode}
                    compact
                    disabledCodes={settingsDisabledVariantCodes}
                    disabledReasonByCode={settingsDisabledReasonByCode}
                    onChange={(variantCode) => setSettingsForm((prev) => ({ ...prev, variantCode }))}
                  />
                </div>
                {selectedSettingsVariant && (
                  <div className="rounded-xl bg-white px-3 py-2 text-xs font-bold leading-relaxed text-slate-500 md:col-span-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1.5 text-[10px] font-black">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{variantGroupLabel(game, selectedSettingsVariant)}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                          {get(selectedSettingsVariant, "min_players", "minPlayers", 0)}~{get(selectedSettingsVariant, "max_players", "maxPlayers", 0)}명
                        </span>
                      </div>
                    </div>
                    {players.length < Number(get(selectedSettingsVariant, "min_players", "minPlayers", 0)) && (
                      <div className="mt-1 text-amber-700">
                        현재 인원으로는 시작할 수 없습니다. 최소 {get(selectedSettingsVariant, "min_players", "minPlayers", 0)}명이 필요합니다.
                      </div>
                    )}
                    {players.length > Number(get(selectedSettingsVariant, "max_players", "maxPlayers", 0)) && (
                      <div className="mt-1 text-rose-700">
                        현재 인원이 이 규칙의 최대 인원을 초과합니다.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {busy && !actionBusy && (
              <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-700" role="status" aria-live="polite" aria-atomic="true">
                방 요청을 처리하는 중입니다.
              </div>
            )}
            {actionBusy && (
              <div className="mt-3 rounded-xl bg-sky-50 px-3 py-2 text-xs font-black text-sky-700" role="status" aria-live="polite" aria-atomic="true">
                서버에서 행동을 판정하는 중입니다.
              </div>
            )}
          </div>

          {status === "WAITING" && (
            <GameRoomPlayersPanel
              players={players}
              selectedRoom={selectedRoom}
              roomStatus={status}
              myMemberId={myMemberId}
              hostMemberId={hostMemberIdOf(selectedRoom)}
              maxPlayers={maxPlayersOf(selectedRoom)}
              getMemberId={memberIdOf}
              getSeatNo={seatNoOf}
              getReady={isReady}
              getDetail={(player, { seatNo, isHost }) => `좌석 ${seatNo || "-"}${isHost ? " · 방장" : ""}`}
              dataSmoke={`${game}-waiting-player-roster`}
            />
          )}

          {gameState && (
            <>
              <MobileGameJumpNav game={game} gameState={gameState} />
              <div className="tabletop-board-shell relative" aria-busy={actionBusy ? "true" : "false"}>
            {actionBusy && gameState && (
              <div className="absolute inset-0 z-40 flex items-start justify-center rounded-[1.5rem] bg-white/55 p-4 backdrop-blur-[1px]">
                <div className="sticky top-4 rounded-full border border-sky-100 bg-white px-4 py-2 text-xs font-black text-sky-700 shadow-lg" role="status" aria-live="polite" aria-atomic="true">
                  서버 판정 중 · 잠시만 기다려주세요
                </div>
              </div>
            )}
            {game === "blokus" && gameState ? (
              <Suspense fallback={<TabletopBoardFallback />}>
                <BlokusBoard room={selectedRoom} gameState={gameState} mySeatNo={mySeatNo} onAction={sendAction} />
              </Suspense>
            ) : game === "catan" && gameState ? (
              <Suspense fallback={<TabletopBoardFallback />}>
                <CatanBoard gameState={gameState} players={displayPlayers} mySeatNo={mySeatNo} onAction={sendAction} />
              </Suspense>
            ) : game === "mahe" && gameState ? (
              <Suspense fallback={<TabletopBoardFallback />}>
                <MaheBoard gameState={gameState} players={displayPlayers} mySeatNo={mySeatNo} onAction={sendAction} />
              </Suspense>
            ) : game === "dalmuti" && gameState ? (
              <Suspense fallback={<TabletopBoardFallback />}>
                <DalmutiBoard gameState={gameState} players={displayPlayers} mySeatNo={mySeatNo} onAction={sendAction} />
              </Suspense>
            ) : game === "six-nimmt" && gameState ? (
              <Suspense fallback={<TabletopBoardFallback />}>
                <SixNimmtBoard gameState={gameState} players={displayPlayers} mySeatNo={mySeatNo} onAction={sendAction} />
              </Suspense>
            ) : game === "telestrations" && gameState ? (
              <Suspense fallback={<TabletopBoardFallback />}>
                <TelestrationsBoard gameState={gameState} players={displayPlayers} mySeatNo={mySeatNo} isHost={isHost} onAction={sendAction} />
              </Suspense>
            ) : game === "mafia" && gameState ? (
              <Suspense fallback={<TabletopBoardFallback />}>
                <MafiaBoard gameState={gameState} players={displayPlayers} mySeatNo={mySeatNo} isHost={isHost} onAction={sendAction} />
              </Suspense>
            ) : game === "poker" && gameState ? (
              <Suspense fallback={<TabletopBoardFallback />}>
                <PokerBoard gameState={gameState} players={displayPlayers} mySeatNo={mySeatNo} onAction={sendAction} />
              </Suspense>
            ) : null}

            {(game === "catan" || game === "blokus" || game === "mahe" || game === "dalmuti") && gameState && (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div />
                <aside className="space-y-4">
                  <PlayersPanel game={game} gameState={gameState} players={displayPlayers} selectedRoom={selectedRoom} status={status} mySeatNo={mySeatNo} />
                </aside>
              </div>
            )}
              </div>
            </>
          )}

          <GameRoomChatPanel
            gameCode={game}
            roomId={idOf(selectedRoom)}
            resetKey={`${status}-${get(gameState, "phase", "phase", "")}`}
            title="방 채팅"
          />
        </section>
      )}
    </div>
  );
};

const tabletopPlayerPanelScore = (game, gameState, seatNo) => {
  if (!gameState || !seatNo) return "";
  const statePlayers = listOf(get(gameState, "players", "players", []));
  const statePlayer = statePlayers.find((player) => tabletopStateSeatNo(player) === Number(seatNo));
  const scoreRows = listOf(get(gameState, "scores", "scores", []));
  const scoreRow = scoreRows.find((row) => tabletopStateSeatNo(row) === Number(seatNo));
  if (game === "catan" && statePlayer) {
    const points = tabletopNumber(get(statePlayer, "public_victory_points", "publicVictoryPoints", get(statePlayer, "victory_points", "victoryPoints", NaN)), NaN);
    return Number.isFinite(points) ? `${points}점` : "";
  }
  if (game === "blokus" && scoreRow) {
    const score = tabletopNumber(get(scoreRow, "score", "score", NaN), NaN);
    return Number.isFinite(score) ? `${score}점` : "";
  }
  if (game === "mahe" && (statePlayer || scoreRow)) {
    const source = statePlayer || scoreRow;
    const score = tabletopNumber(get(source, "score", "score", get(source, "egg_score", "eggScore", NaN)), NaN);
    return Number.isFinite(score) ? `${score}점` : "";
  }
  if (game === "dalmuti" && statePlayer) {
    const cardCount = tabletopNumber(get(statePlayer, "card_count", "cardCount", get(statePlayer, "hand_count", "handCount", NaN)), NaN);
    const rank = get(statePlayer, "rank", "rank", "");
    if (Number.isFinite(cardCount)) return `${cardCount}장`;
    if (rank) return dalmutiRankLabel(rank);
  }
  const genericScore = tabletopNumber(get(statePlayer, "score", "score", get(scoreRow, "score", "score", NaN)), NaN);
  return Number.isFinite(genericScore) ? `${genericScore}점` : "";
};

const tabletopPlayerPanelWinners = (gameState) => {
  const winners = new Set();
  const winnerSeatNo = tabletopNumber(get(gameState, "winner_seat_no", "winnerSeatNo", 0));
  if (winnerSeatNo) winners.add(winnerSeatNo);
  listOf(get(gameState, "winner_seat_nos", "winnerSeatNos", [])).forEach((seatNo) => {
    const normalized = Number(seatNo);
    if (normalized) winners.add(normalized);
  });
  [...listOf(get(gameState, "players", "players", [])), ...listOf(get(gameState, "scores", "scores", []))].forEach((item) => {
    if (Boolean(get(item, "winner", "winner", false))) {
      const seatNo = tabletopStateSeatNo(item);
      if (seatNo) winners.add(seatNo);
    }
  });
  return winners;
};

const PlayersPanel = ({ game, gameState, players, selectedRoom, status, mySeatNo }) => {
  const activeSeatNo = tabletopTurnSeatForSound(game, gameState);
  const winnerSeatNos = tabletopPlayerPanelWinners(gameState);

  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg" data-smoke="tabletop-players-panel">
      <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
        <GameUxGlyph type="player" className="h-4 w-4 text-primary-600" />
        플레이어
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-1">
        {players.map((player) => {
          const pid = memberIdOf(player);
          const seatNo = seatNoOf(player);
          const host = pid === hostMemberIdOf(selectedRoom);
          const active = activeSeatNo === seatNo;
          const mine = Number(mySeatNo) === seatNo;
          const winner = winnerSeatNos.has(seatNo);
          const scoreText = tabletopPlayerPanelScore(game, gameState, seatNo);
          const botProfile = player.__botProfile || null;
          const bot = Boolean(player.__bot || botProfile);
          const cardTone = winner
            ? "border-emerald-200 bg-emerald-50"
            : active
              ? "border-amber-200 bg-amber-50"
              : mine
                ? "border-sky-200 bg-sky-50"
                : "border-slate-100 bg-slate-50";
          const tags = [
            winner ? { key: "winner", label: "승리", className: "bg-emerald-600 text-white" } : null,
            active && !winner ? { key: "active", label: "현재 차례", className: "bg-amber-100 text-amber-800" } : null,
            mine && !winner ? { key: "mine", label: "내 좌석", className: "bg-sky-100 text-sky-700" } : null,
            bot && !winner ? { key: "bot", label: "AI", className: "bg-violet-100 text-violet-700" } : null,
          ].filter(Boolean);
          return (
            <div key={pid || seatNo} className={`rounded-xl border px-3 py-2 ${cardTone}`} data-smoke="tabletop-player-card">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <UserAvatar
                    name={player.nickname}
                    profileUrl={player.profileUrl}
                    level={player.level}
                    rewardTier={player.rewardTier}
                    frameCode={player.frameCode}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-slate-900">{player.nickname}</div>
                    <div className="truncate text-[11px] font-bold text-slate-500">
                      좌석 {seatNo || "-"}{host ? " · 방장" : ""}{scoreText ? ` · ${scoreText}` : ""}
                    </div>
                    {botProfile && (
                      <div className="mt-0.5 truncate text-[10px] font-bold text-violet-600" data-smoke="tabletop-bot-profile">
                        {botProfile.archetype || "AI"}{botProfile.styleSummary ? ` - ${botProfile.styleSummary}` : ""}
                      </div>
                    )}
                  </div>
                </div>
                {!!tags.length && (
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {tags.map((tag) => (
                      <span key={tag.key} className={`inline-flex rounded-full px-2 py-1 text-[10px] font-black ${tag.className}`} data-smoke={`tabletop-player-${tag.key}`}>
                        {tag.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const normalizeGuideEntries = (lines = []) => (Array.isArray(lines) ? lines : [])
  .map((line, index) => {
    if (typeof line === "string") {
      return {
        key: `line-${index}`,
        title: index === 0 ? "핵심 규칙" : "규칙 메모",
        items: [line].filter(Boolean),
        flat: true,
      };
    }
    const items = Array.isArray(line?.items) ? line.items.filter(Boolean) : [];
    return {
      key: line?.title || `section-${index}`,
      title: line?.title || "규칙 묶음",
      items,
      flat: false,
    };
  })
  .filter((entry) => entry.title || entry.items.length);

const guideItemPreview = (entry) => entry?.items?.[0] || entry?.title || "규칙 확인";

const buildGuideBriefItems = (entries) => {
  const ruleCount = entries.reduce((sum, entry) => sum + Math.max(entry.items.length, 1), 0);
  const first = entries[0];
  const decision = entries.find((entry) => entry.items.length > 1) || entries[1] || first;
  const final = entries[entries.length - 1] || first;
  return {
    ruleCount,
    items: [
      {
        key: "basis",
        label: "판정 기준",
        value: entries.length ? `${entries.length}개 묶음` : "규칙 대기",
        detail: entries.length ? `${ruleCount}개 규칙 문장을 서버 판정 기준으로 읽습니다.` : "규칙 정보가 도착하면 이 영역에서 먼저 요약합니다.",
      },
      {
        key: "first",
        label: "첫 확인",
        value: first?.title || "핵심 규칙",
        detail: guideItemPreview(first),
      },
      {
        key: "watch",
        label: "주의 지점",
        value: decision?.title || final?.title || "잠금 조건",
        detail: guideItemPreview(decision || final),
      },
    ],
  };
};

const TabletopGuideBriefArt = ({ sectionCount = 0, ruleCount = 0 }) => {
  const nodes = [
    { key: "rules", label: "규칙", value: `${sectionCount}`, x: 58, y: 94, fill: "#2563eb" },
    { key: "judge", label: "판정", value: `${ruleCount}`, x: 146, y: 58, fill: "#7c3aed" },
    { key: "lock", label: "잠금", value: "확인", x: 234, y: 94, fill: "#f59e0b" },
    { key: "play", label: "행동", value: "연결", x: 318, y: 58, fill: "#059669" },
  ];

  return (
    <svg
      viewBox="0 0 380 140"
      role="img"
      aria-label="보드게임 규칙 브리핑 흐름"
      className="h-auto w-full"
      data-smoke="tabletop-guide-art"
      focusable="false"
    >
      <rect x="8" y="8" width="364" height="124" rx="22" fill="#0f172a" stroke="#334155" strokeWidth="3" />
      <path d="M58 94C99 42 116 42 146 58c43 23 53 56 88 36 37-21 53-55 84-36" fill="none" stroke="#475569" strokeWidth="12" strokeLinecap="round" />
      <path d="M58 94C99 42 116 42 146 58c43 23 53 56 88 36 37-21 53-55 84-36" fill="none" stroke="#93c5fd" strokeWidth="5" strokeLinecap="round" />
      <text x="26" y="34" fill="#bfdbfe" fontSize="11" fontWeight="900">규칙 브리핑</text>
      <text x="26" y="54" fill="#ffffff" fontSize="17" fontWeight="900">판정과 행동 연결</text>
      {nodes.map((node) => (
        <g key={node.key} data-smoke="tabletop-guide-node" data-guide-node={node.key}>
          <circle cx={node.x} cy={node.y} r="22" fill={node.fill} stroke="#f8fafc" strokeWidth="3" />
          <text x={node.x} y={node.y - 2} textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="900">{node.label}</text>
          <text x={node.x} y={node.y + 13} textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="900">{node.value}</text>
        </g>
      ))}
      <rect x="254" y="24" width="92" height="28" rx="12" fill="#1e293b" stroke="#94a3b8" />
      <text x="300" y="43" textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="900">서버 판정 유지</text>
    </svg>
  );
};

const GuidePanel = ({ lines }) => {
  const entries = normalizeGuideEntries(lines);
  const guideBrief = buildGuideBriefItems(entries);

  return (
    <div
      className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg"
      data-smoke="tabletop-guide-panel"
      data-guide-sections={entries.length}
      data-guide-rules={guideBrief.ruleCount}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-black text-slate-900">도움말</div>
        <div className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">서버 판정</div>
      </div>
      <div data-smoke="tabletop-guide-art" className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-black text-slate-600">
        <span className="rounded-full bg-slate-100 px-2.5 py-1">규칙 묶음 {entries.length}</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1">문장 {guideBrief.ruleCount}</span>
      </div>
      <div className="mt-3 grid gap-2">
        {guideBrief.items.map((item) => (
          <div key={item.key} className="rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2" data-smoke="tabletop-guide-item" data-guide-key={item.key}>
            <div className="text-[10px] font-black text-blue-700">{item.label}</div>
            <div className="mt-1 text-sm font-black text-slate-950">{item.value}</div>
            <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-relaxed text-slate-600">{item.detail}</div>
          </div>
        ))}
      </div>
      <details className="mt-3 rounded-xl bg-slate-50 px-3 py-2">
        <summary className="cursor-pointer text-xs font-black text-slate-700">상세 규칙 열기</summary>
        <div className="mt-2 space-y-2">
        {entries.map((entry) => (
          entry.flat ? (
            <div key={entry.key} className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold leading-relaxed text-slate-500">
              {entry.items[0]}
            </div>
          ) : (
            <div key={entry.key} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="text-xs font-black text-slate-800">{entry.title}</div>
              <div className="mt-1 space-y-1 text-[11px] font-bold leading-relaxed text-slate-500">
                {entry.items.map((item) => (
                  <div key={item} className="flex gap-1.5">
                    <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        ))}
        </div>
      </details>
    </div>
  );
};

export const CatanGame = () => <TabletopGame game="catan" />;
export const BlokusGame = () => <TabletopGame game="blokus" />;
export const MaheGame = () => <TabletopGame game="mahe" />;
export const DalmutiGame = () => <TabletopGame game="dalmuti" />;
export const SixNimmtGame = () => <TabletopGame game="six-nimmt" />;
export const TelestrationsGame = () => <TabletopGame game="telestrations" />;
export const MafiaGame = () => <TabletopGame game="mafia" />;
export const PokerGame = () => <TabletopGame game="poker" />;

export default TabletopGame;
