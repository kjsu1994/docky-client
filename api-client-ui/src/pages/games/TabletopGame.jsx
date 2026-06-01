import { useEffect, useMemo, useRef, useState } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import toast from "react-hot-toast";
import {
  ArrowUp,
  Ban,
  CheckCircle2,
  Copy,
  Crown,
  Dices,
  FlipHorizontal,
  RefreshCw,
  RotateCw,
  Shield,
  Users,
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
import { buildStompConnectHeaders } from "../../adapters/realtimeAdapter.js";
import { useAuth } from "../../contexts/AuthContext.jsx";

const gameConfigs = {
  catan: {
    title: "카탄",
    eyebrow: "기본판 · 확장 선택 · 교역 · 개척",
    description: "자원을 모으고 도로와 마을을 확장해 섬의 주도권을 다투는 전략 보드게임입니다.",
    storageKey: "catan_last_room_id",
    accent: "from-amber-500 via-lime-500 to-sky-500",
    board: "catan",
    guide: [
      {
        title: "승리 조건",
        items: ["선택한 규칙의 목표 승점에 먼저 도달하면 종료됩니다.", "기본판은 3~4인 10점, 5~6인은 확장 인원과 카타니안 1/2 턴 흐름을 따릅니다."],
      },
      {
        title: "턴 흐름",
        items: ["초기 정착지/도로 배치 후 주사위 생산, 도둑 처리, 건설과 교역을 진행합니다.", "거래, 개발 카드, 최장 교역로, 최대 기사력은 서버 판정으로 처리됩니다."],
      },
      {
        title: "확장 선택",
        items: ["방 생성 전에 기본판과 구현된 공식 확장/시나리오를 선택합니다.", "확장별 배, 해적, 기사, 임무, 특수 승점은 선택한 변형의 상태 패널과 액션에서만 나타납니다."],
      },
    ],
  },
  blokus: {
    title: "블로커스",
    eyebrow: "영역 배치 · 코너 접촉 · 추상 전략",
    description: "각자의 조각을 최대한 많이 놓되, 내 조각끼리는 모서리로만 이어야 하는 배치 게임입니다.",
    storageKey: "blokus_last_room_id",
    accent: "from-cyan-500 via-blue-500 to-fuchsia-500",
    board: "blokus",
    guide: [
      {
        title: "배치 원칙",
        items: ["첫 조각은 각 색의 시작점에 닿아야 합니다.", "내 색 조각끼리는 꼭짓점으로만 닿을 수 있고 변으로는 닿을 수 없습니다."],
      },
      {
        title: "종료와 점수",
        items: ["둘 수 있는 조각이 없을 때만 패스가 가능합니다.", "남은 칸은 감점, 모든 조각 사용은 보너스, 마지막 한 칸 조각은 추가 보너스입니다."],
      },
      {
        title: "공식 변형",
        items: ["기본 20x20, 듀오 14x14, 2인 두 색 조종, 3인 공유 색, 2대2 팀전을 선택할 수 있습니다.", "점수 합산과 공유 색 조종 순서는 선택한 변형 기준으로 서버가 계산합니다."],
      },
    ],
  },
  mahe: {
    title: "마헤",
    eyebrow: "거북이 경주 · 주사위 선택 · 업고 가기",
    description: "거북이를 움직여 섬을 한 바퀴 돌고, 알 카드 점수를 모으는 가벼운 가족형 경주 게임입니다.",
    storageKey: "mahe_last_room_id",
    accent: "from-emerald-500 via-teal-500 to-yellow-400",
    board: "mahe",
    guide: [
      {
        title: "주사위 선택",
        items: ["차례에는 주사위를 1~3개까지 굴릴 수 있습니다.", "합계가 7을 넘으면 버스트가 되어 이번 이동을 잃고 해당 거북이 묶음이 시작점으로 돌아갑니다."],
      },
      {
        title: "업고 가기",
        items: ["같은 칸의 거북이는 아래에서 위 순서로 쌓입니다.", "아래 거북이가 움직이면 위에 올라탄 거북이도 함께 이동하고, 선택권은 맨 위 거북이에게 넘어갑니다."],
      },
      {
        title: "득점",
        items: ["섬을 한 바퀴 넘어가면 맨 위 거북이가 현재 알 카드를 받습니다.", "마지막 7점 알 이후 총점이 높고, 동점이면 알 카드가 많은 쪽이 앞섭니다."],
      },
    ],
  },
  dalmuti: {
    title: "달무티",
    eyebrow: "계급 카드 · 선 털기 · 자리 바꾸기",
    description: "카드를 빨리 털수록 다음 라운드의 신분이 올라가는 계급형 클라이밍 카드게임입니다.",
    storageKey: "dalmuti_last_room_id",
    accent: "from-violet-500 via-rose-500 to-amber-500",
    board: "dalmuti",
    guide: [
      {
        title: "트릭 흐름",
        items: ["선 플레이어가 같은 계급 카드 여러 장을 내면, 다음 플레이어는 같은 장수의 더 높은 신분 카드를 내거나 패스합니다.", "모두 패스하면 기준 카드가 비워지고 마지막으로 낸 플레이어가 새 기준을 엽니다."],
      },
      {
        title: "계급과 세금",
        items: ["손패를 먼저 비울수록 다음 손의 계급이 높아집니다.", "달무티와 농노는 세금 교환을 처리하고, 광대 2장 보유 시 혁명 흐름이 열립니다."],
      },
      {
        title: "선택 규칙",
        items: ["4~5인은 줄인 덱을 선택할 수 있습니다.", "첫 판 자동 혁명 규칙은 첫 손을 세금 없이 시작하는 공식 선택 규칙입니다."],
      },
    ],
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
};

const colorClasses = {
  BLUE: "bg-blue-500 border-blue-700",
  YELLOW: "bg-yellow-300 border-yellow-500",
  RED: "bg-rose-500 border-rose-700",
  GREEN: "bg-emerald-500 border-emerald-700",
};

const colorText = {
  BLUE: "text-blue-700",
  YELLOW: "text-yellow-700",
  RED: "text-rose-700",
  GREEN: "text-emerald-700",
};

const colorBgSoft = {
  BLUE: "bg-blue-50 border-blue-100",
  YELLOW: "bg-yellow-50 border-yellow-100",
  RED: "bg-rose-50 border-rose-100",
  GREEN: "bg-emerald-50 border-emerald-100",
};

const MobileGameJumpNav = ({ game }) => {
  const links = mobileJumpLinksByGame[game] || [];
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

const blokusColorLabels = {
  BLUE: "파랑",
  YELLOW: "노랑",
  RED: "빨강",
  GREEN: "초록",
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

const catanResourceKeys = ["BRICK", "LUMBER", "WOOL", "GRAIN", "ORE"];
const catanResourceEntries = catanResourceKeys.map((key) => [key, catanResourceLabels[key]]);
const emptyCatanResourceCounts = () => Object.fromEntries(catanResourceKeys.map((key) => [key, 0]));

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

const get = (obj, snake, camel, fallback = undefined) => obj?.[camel] ?? obj?.[snake] ?? fallback;
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
};

const variantGroupOrderByGame = {
  blokus: ["base", "duo", "playerCount", "team", "other"],
  mahe: ["base", "other"],
  dalmuti: ["base", "optional", "other"],
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

  return (
    <div className={`space-y-3 ${compact ? "max-h-[min(44vh,320px)]" : "max-h-[min(58vh,420px)]"} overflow-auto overscroll-contain pr-1`} role="radiogroup" aria-label={`${gameConfigs[game]?.title || "보드게임"} 규칙과 확장 선택`}>
      {groups.map((group) => (
        <div key={group.key} className="space-y-2">
          <div className="sticky top-0 z-10 -mx-1 flex items-center justify-between gap-2 bg-white/95 px-1 py-1 backdrop-blur">
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

const normalizeCells = (cells) => {
  const minX = Math.min(...cells.map((cell) => cell.x));
  const minY = Math.min(...cells.map((cell) => cell.y));
  return cells
    .map((cell) => ({ x: cell.x - minX, y: cell.y - minY }))
    .sort((a, b) => (a.y - b.y) || (a.x - b.x));
};

const transformCells = (piece, rotation, flipped, anchorX = 0, anchorY = 0) => {
  const baseCells = (piece?.cells || []).map((cell) => ({ x: Number(cell.x), y: Number(cell.y) }));
  const normalizedRotation = ((Number(rotation) % 360) + 360) % 360;
  const transformed = baseCells.map((cell) => {
    const x = flipped ? -cell.x : cell.x;
    const y = cell.y;
    if (normalizedRotation === 90) return { x: y, y: -x };
    if (normalizedRotation === 180) return { x: -x, y: -y };
    if (normalizedRotation === 270) return { x: -y, y: x };
    return { x, y };
  });
  return normalizeCells(transformed).map((cell) => ({ x: cell.x + anchorX, y: cell.y + anchorY }));
};

const BoardPreview = ({ type, room }) => {
  if (type === "blokus") {
    const colors = ["bg-blue-400", "bg-yellow-300", "bg-rose-400", "bg-emerald-400"];
    return (
      <div className="grid aspect-square w-full max-w-[520px] grid-cols-10 gap-1 rounded-2xl bg-slate-950 p-3 shadow-2xl">
        {Array.from({ length: 100 }, (_, index) => (
          <div
            key={index}
            className={`rounded-[4px] ${colors[(index + Math.floor(index / 10)) % colors.length]}`}
            style={{ opacity: index % 3 === 0 ? 0.9 : 0.3 }}
          />
        ))}
      </div>
    );
  }
  if (type === "mahe") {
    return (
      <div className="relative aspect-square w-full max-w-[520px] rounded-full bg-gradient-to-br from-cyan-200 via-emerald-200 to-yellow-100 p-7 shadow-2xl">
        <div className="absolute inset-[18%] rounded-full bg-gradient-to-br from-yellow-200 to-amber-300 shadow-inner" />
        {Array.from({ length: 21 }, (_, index) => {
          const angle = (index / 21) * Math.PI * 2 - Math.PI / 2;
          const x = 50 + Math.cos(angle) * 42;
          const y = 50 + Math.sin(angle) * 42;
          return (
            <div
              key={index}
              className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-white/85 text-center text-[10px] font-black text-teal-700 shadow"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              {index + 1}
            </div>
          );
        })}
        <div className="absolute left-1/2 top-1/2 w-44 -translate-x-1/2 -translate-y-1/2 text-center text-sm font-black text-teal-900">
          알 카드<br />{variantNameOf(room) || "본게임"}
        </div>
      </div>
    );
  }
  if (type === "dalmuti") {
    const ranks = ["1", "2", "3", "4", "5", "6", "광"];
    return (
      <div className="grid w-full max-w-[560px] grid-cols-3 gap-3 rounded-[2rem] bg-gradient-to-br from-slate-950 to-violet-950 p-5 shadow-2xl sm:grid-cols-7">
        {ranks.map((rank, index) => (
          <div key={rank} className="aspect-[2/3] rounded-2xl border border-white/20 bg-white p-3 shadow-xl">
            <div className="text-xs font-black text-slate-400">계급</div>
            <div className="mt-6 text-center text-4xl font-black text-slate-900">{rank}</div>
            <div className="mt-5 text-center text-[10px] font-bold text-slate-500">
              {index === 0 ? "달무티" : index === 6 ? "광대" : "귀족"}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid w-full max-w-[560px] grid-cols-5 gap-2 rounded-[2rem] bg-slate-900 p-5 shadow-2xl">
      {Array.from({ length: 19 }, (_, index) => {
        const terrain = ["bg-amber-300", "bg-emerald-400", "bg-lime-500", "bg-orange-300", "bg-slate-300", "bg-rose-200"][index % 6];
        return <div key={index} className={`aspect-square rotate-45 rounded-xl ${terrain} shadow-lg`} />;
      })}
    </div>
  );
};

const MiniPiece = ({ piece, color = "BLUE" }) => {
  const cells = normalizeCells((piece?.cells || []).map((cell) => ({ x: Number(cell.x), y: Number(cell.y) })));
  const width = Math.max(...cells.map((cell) => cell.x), 0) + 1;
  const height = Math.max(...cells.map((cell) => cell.y), 0) + 1;
  const occupied = new Set(cells.map((cell) => `${cell.x}:${cell.y}`));
  return (
    <div
      className="grid gap-[2px]"
      style={{
        gridTemplateColumns: `repeat(${width}, minmax(0, 0.55rem))`,
        gridTemplateRows: `repeat(${height}, minmax(0, 0.55rem))`,
      }}
    >
      {Array.from({ length: width * height }, (_, index) => {
        const x = index % width;
        const y = Math.floor(index / width);
        return <div key={`${x}:${y}`} className={`h-2.5 w-2.5 rounded-[2px] ${occupied.has(`${x}:${y}`) ? colorClasses[color] || "bg-slate-400" : "bg-transparent"}`} />;
      })}
    </div>
  );
};

const blokusStartCorners = {
  BLUE: { x: 0, y: 0 },
  YELLOW: { x: 19, y: 0 },
  RED: { x: 19, y: 19 },
  GREEN: { x: 0, y: 19 },
};

const blokusPlacementStatus = ({ cells, boardSize, occupied, colorByCell, colorsOnBoard, color, startPoints }) => {
  if (!cells.length) return { legal: false, reason: "" };
  if (cells.some((cell) => cell.x < 0 || cell.y < 0 || cell.x >= boardSize || cell.y >= boardSize)) {
    return { legal: false, reason: "보드 밖" };
  }
  if (cells.some((cell) => occupied.has(`${cell.x}:${cell.y}`))) {
    return { legal: false, reason: "겹침" };
  }
  const firstPiece = !colorsOnBoard.has(color);
  if (firstPiece) {
    const validStartPoints = (startPoints || []).filter((point) => !get(point, "color", "color", null) || get(point, "color", "color", null) === color);
    if (validStartPoints.length) {
      const coversStart = validStartPoints.some((point) => cells.some((cell) => cell.x === Number(point.x) && cell.y === Number(point.y)));
      return coversStart ? { legal: true, reason: "시작점" } : { legal: false, reason: "시작점을 덮어야 함" };
    }
    const corner = blokusStartCorners[color];
    const coversCorner = corner && cells.some((cell) => cell.x === corner.x && cell.y === corner.y);
    return coversCorner ? { legal: true, reason: "시작 모서리" } : { legal: false, reason: "시작 모서리를 덮어야 함" };
  }
  const orthogonal = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const diagonal = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const hasSideContact = cells.some((cell) => orthogonal.some(([dx, dy]) => colorByCell.get(`${cell.x + dx}:${cell.y + dy}`) === color));
  if (hasSideContact) {
    return { legal: false, reason: "같은 색 변 접촉" };
  }
  const hasCornerContact = cells.some((cell) => diagonal.some(([dx, dy]) => colorByCell.get(`${cell.x + dx}:${cell.y + dy}`) === color));
  return hasCornerContact ? { legal: true, reason: "모서리 접촉" } : { legal: false, reason: "같은 색 모서리 접촉 필요" };
};

const blokusPieceOrientations = (piece) => {
  if (!piece?.cells?.length) return [];
  const seen = new Set();
  const orientations = [];
  [false, true].forEach((nextFlipped) => {
    [0, 90, 180, 270].forEach((nextRotation) => {
      const cells = transformCells(piece, nextRotation, nextFlipped, 0, 0);
      const key = cells.map((cell) => `${cell.x}:${cell.y}`).join("|");
      if (!seen.has(key)) {
        seen.add(key);
        orientations.push({ cells, flipped: nextFlipped, rotation: nextRotation });
      }
    });
  });
  return orientations;
};

const blokusLegalPlacementCountForPiece = ({ piece, boardSize, occupied, colorByCell, colorsOnBoard, color, startPoints }) => {
  if (!piece?.cells?.length || !color) return 0;
  let count = 0;
  blokusPieceOrientations(piece).forEach((orientation) => {
    const maxX = Math.max(...orientation.cells.map((cell) => cell.x), 0);
    const maxY = Math.max(...orientation.cells.map((cell) => cell.y), 0);
    for (let y = 0; y < boardSize - maxY; y += 1) {
      for (let x = 0; x < boardSize - maxX; x += 1) {
        const cells = orientation.cells.map((cell) => ({ x: cell.x + x, y: cell.y + y }));
        if (blokusPlacementStatus({ cells, boardSize, occupied, colorByCell, colorsOnBoard, color, startPoints }).legal) {
          count += 1;
        }
      }
    }
  });
  return count;
};

const blokusBoardCellSizes = [16, 20, 24, 30];
const blokusBoardCellSizeStorageKey = "blokus_board_cell_size";

const defaultBlokusBoardCellSize = () => {
  if (typeof window === "undefined") return 24;
  const stored = Number(window.localStorage?.getItem(blokusBoardCellSizeStorageKey) || 0);
  if (blokusBoardCellSizes.includes(stored)) return stored;
  return window.innerWidth < 480 ? 16 : 24;
};

const BlokusBoard = ({ room, gameState, mySeatNo, onAction }) => {
  const [selectedPieceCode, setSelectedPieceCode] = useState("");
  const [rotation, setRotation] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [hoverCell, setHoverCell] = useState(null);
  const [anchorCell, setAnchorCell] = useState(null);
  const [boardCellSize, setBoardCellSize] = useState(defaultBlokusBoardCellSize);
  const boardSize = Number(get(gameState, "board_size", "boardSize", 20));
  const duoRule = Boolean(get(gameState, "duo_rule", "duoRule", false));
  const variantCode = get(gameState, "variant_code", "variantCode", "BASE");
  const currentColor = get(gameState, "current_color", "currentColor", null);
  const currentSeatNo = Number(get(gameState, "current_seat_no", "currentSeatNo", 0));
  const phase = gameState?.phase || "PLAYING";
  const colors = get(gameState, "colors", "colors", []);
  const pieces = get(gameState, "pieces", "pieces", []);
  const scores = get(gameState, "scores", "scores", []);
  const board = get(gameState, "board", "board", []);
  const startPoints = get(gameState, "start_points", "startPoints", []);
  const moveHistory = get(gameState, "move_history", "moveHistory", []);
  const currentColorState = colors.find((item) => item.color === currentColor);
  const currentColorShared = Boolean(get(currentColorState, "shared", "shared", false));
  const currentColorControllers = get(currentColorState, "controller_seat_nos", "controllerSeatNos", []);
  const roomPlayers = playersOf(room);
  const playerName = (seatNo) => roomPlayers.find((player) => seatNoOf(player) === Number(seatNo))?.nickname || `${seatNo}번`;
  const currentTurnLabel = phase === "FINISHED"
    ? "게임 종료"
    : currentColorShared
      ? `${currentColorState?.label || "-"} 공유 색 · 이번 담당 ${playerName(currentSeatNo)}`
      : `${currentColorState?.label || "-"} 차례 · ${mySeatNo === currentSeatNo ? "내 차례" : playerName(currentSeatNo)}`;
  const variantNotice = variantCode === "THREE_PLAYER"
    ? "3인 변형 · 초록은 세 플레이어가 돌아가며 두는 공유 색이며, 최종 점수에는 각자의 파랑/노랑/빨강만 반영됩니다."
    : variantCode === "TWO_PLAYER"
      ? "2인 변형 · 1번은 파랑+빨강, 2번은 노랑+초록을 번갈아 조종하고 두 색 점수를 합산합니다."
      : variantCode === "TEAM"
        ? "2대2 팀전 · 마주 보는 파랑+빨강, 노랑+초록의 점수를 합산합니다."
        : duoRule
          ? "듀오 · 14x14 보드의 두 중앙 시작점에서 시작하고 파랑/노랑만 사용합니다."
          : "";
  const remainingPieceCodes = get(currentColorState, "remaining_piece_codes", "remainingPieceCodes", []);
  const pieceByCode = useMemo(() => {
    const next = new Map();
    pieces.forEach((piece) => next.set(piece.code, piece));
    return next;
  }, [pieces]);
  const selectedPiece = pieceByCode.get(selectedPieceCode);
  const occupied = useMemo(() => {
    const next = new Map();
    board.forEach((cell) => next.set(`${cell.x}:${cell.y}`, cell));
    return next;
  }, [board]);
  const colorByCell = useMemo(() => {
    const next = new Map();
    board.forEach((cell) => next.set(`${cell.x}:${cell.y}`, cell.color));
    return next;
  }, [board]);
  const colorsOnBoard = useMemo(() => new Set(board.map((cell) => cell.color)), [board]);
  const startPointByCell = useMemo(() => {
    const next = new Map();
    startPoints.forEach((point) => next.set(`${Number(point.x)}:${Number(point.y)}`, point));
    return next;
  }, [startPoints]);
  const placementAnchor = anchorCell || hoverCell;
  const hoverCells = useMemo(() => {
    if (!placementAnchor || !selectedPiece || phase !== "PLAYING") return [];
    return transformCells(selectedPiece, rotation, flipped, placementAnchor.x, placementAnchor.y);
  }, [placementAnchor, selectedPiece, rotation, flipped, phase]);
  const placementStatus = useMemo(() => {
    if (!hoverCells.length || !currentColor) return { legal: false, reason: "" };
    return blokusPlacementStatus({ cells: hoverCells, boardSize, occupied, colorByCell, colorsOnBoard, color: currentColor, startPoints });
  }, [hoverCells, boardSize, occupied, colorByCell, colorsOnBoard, currentColor, startPoints]);
  const legalPlacementCountsByPieceCode = useMemo(() => {
    const next = new Map();
    remainingPieceCodes.forEach((pieceCode) => {
      next.set(pieceCode, blokusLegalPlacementCountForPiece({
        piece: pieceByCode.get(pieceCode),
        boardSize,
        occupied,
        colorByCell,
        colorsOnBoard,
        color: currentColor,
        startPoints,
      }));
    });
    return next;
  }, [remainingPieceCodes, pieceByCode, boardSize, occupied, colorByCell, colorsOnBoard, currentColor, startPoints]);
  const selectedPieceLegalCount = Number(legalPlacementCountsByPieceCode.get(selectedPieceCode) || 0);
  const totalLegalPlacementCount = useMemo(
    () => Array.from(legalPlacementCountsByPieceCode.values()).reduce((sum, count) => sum + count, 0),
    [legalPlacementCountsByPieceCode],
  );
  const firstPlayablePieceCode = useMemo(
    () => remainingPieceCodes.find((pieceCode) => Number(legalPlacementCountsByPieceCode.get(pieceCode) || 0) > 0) || "",
    [remainingPieceCodes, legalPlacementCountsByPieceCode],
  );
  const quickPieceCodes = useMemo(() => {
    const selectedCodes = remainingPieceCodes.includes(selectedPieceCode) ? [selectedPieceCode] : [];
    const otherCodes = remainingPieceCodes
      .filter((pieceCode) => pieceCode !== selectedPieceCode)
      .sort((left, right) => {
        const leftCount = Number(legalPlacementCountsByPieceCode.get(left) || 0);
        const rightCount = Number(legalPlacementCountsByPieceCode.get(right) || 0);
        const playableDelta = Number(rightCount > 0) - Number(leftCount > 0);
        if (playableDelta) return playableDelta;
        if (rightCount !== leftCount) return rightCount - leftCount;
        const leftPiece = pieceByCode.get(left);
        const rightPiece = pieceByCode.get(right);
        return Number(rightPiece?.size || rightPiece?.cells?.length || 0) - Number(leftPiece?.size || leftPiece?.cells?.length || 0);
      });
    return [...selectedCodes, ...otherCodes].slice(0, 8);
  }, [remainingPieceCodes, selectedPieceCode, legalPlacementCountsByPieceCode, pieceByCode]);
  const selectedPieceSize = Number(selectedPiece?.size || selectedPiece?.cells?.length || 0);
  const remainingSquares = useMemo(() => remainingPieceCodes.reduce((sum, pieceCode) => {
    const piece = pieceByCode.get(pieceCode);
    return sum + Number(piece?.size || piece?.cells?.length || 0);
  }, 0), [remainingPieceCodes, pieceByCode]);
  const blokusScoreDetailsByColor = useMemo(() => {
    const next = new Map();
    colors.forEach((colorState) => {
      const color = colorState.color;
      const colorRemainingPieceCodes = get(colorState, "remaining_piece_codes", "remainingPieceCodes", []);
      const colorRemainingSquares = colorRemainingPieceCodes.reduce((sum, pieceCode) => {
        const piece = pieceByCode.get(pieceCode);
        return sum + Number(piece?.size || piece?.cells?.length || 0);
      }, 0);
      const completed = colorRemainingPieceCodes.length === 0;
      const lastPieceCode = get(colorState, "last_piece_code", "lastPieceCode", "");
      const shared = Boolean(get(colorState, "shared", "shared", false));
      const controllerSeatNos = get(colorState, "controller_seat_nos", "controllerSeatNos", []);
      const completionBonus = completed ? 15 : 0;
      const monominoBonus = completed && lastPieceCode === "I1" ? 5 : 0;
      const score = Number(get(
        colorState,
        "score",
        "score",
        completed ? completionBonus + monominoBonus : -colorRemainingSquares,
      ));

      next.set(color, {
        color,
        label: get(colorState, "label", "label", blokusColorLabels[color] || color),
        ownerSeatNo: Number(get(colorState, "owner_seat_no", "ownerSeatNo", 0)),
        remainingSquares: colorRemainingSquares,
        completed,
        lastPieceCode,
        completionBonus,
        monominoBonus,
        shared,
        controllerSeatNos,
        score,
      });
    });
    return next;
  }, [colors, pieceByCode]);
  const previewCells = useMemo(() => {
    if (!hoverCells.length) return new Set();
    return new Set(hoverCells.map((cell) => `${cell.x}:${cell.y}`));
  }, [hoverCells]);
  const myTurn = phase === "PLAYING" && currentSeatNo === mySeatNo;
  const canPass = myTurn && totalLegalPlacementCount === 0;
  const selectedPieceBlocked = myTurn && Boolean(selectedPieceCode) && selectedPieceLegalCount <= 0 && totalLegalPlacementCount > 0;
  const scoreDisplayLabel = (score) => {
    const scoreKey = String(get(score, "score_key", "scoreKey", ""));
    const scoreColors = get(score, "colors", "colors", []);
    const colorText = scoreColors.map((color) => blokusColorLabels[color] || color).join("+");
    if (scoreKey.startsWith("TEAM_")) {
      const seatNos = scoreColors
        .map((color) => blokusScoreDetailsByColor.get(color)?.ownerSeatNo)
        .filter(Boolean);
      const names = [...new Set(seatNos)].map(playerName).join("+");
      return names ? `${names} 팀 (${colorText})` : `${score.label || "팀"} (${colorText})`;
    }
    const seatMatch = scoreKey.match(/^SEAT_(\d+)$/);
    if (seatMatch) {
      const name = playerName(Number(seatMatch[1]));
      return colorText ? `${name} (${colorText})` : name;
    }
    return score.label || scoreKey || "점수";
  };
  const winners = scores.filter((score) => Boolean(get(score, "winner", "winner", false)));
  const winnerText = winners.map(scoreDisplayLabel).join(", ");
  const winningScore = winners.length ? Number(get(winners[0], "score", "score", 0)) : 0;
  const blokusTurnGuidance = (() => {
    if (phase === "FINISHED") {
      return winners.length ? `${winnerText} 승리, 최종 ${winningScore}점입니다.` : "게임이 종료되었습니다.";
    }
    if (!myTurn) {
      return `${playerName(currentSeatNo)}님의 ${currentColorState?.label || currentColor || "색"} 차례를 기다리는 중입니다.`;
    }
    if (canPass) {
      return "남은 모든 조각이 막혔습니다. 패스를 눌러 다음 색으로 넘길 수 있습니다.";
    }
    if (selectedPieceBlocked) {
      return "선택한 조각은 둘 수 없습니다. 자동 선택으로 가능한 조각을 고르거나 다른 조각을 확인하세요.";
    }
    if (anchorCell && placementStatus.legal) {
      return `${anchorCell.x + 1}열 ${anchorCell.y + 1}행 기준으로 놓을 수 있습니다. 다시 누르거나 놓기 버튼으로 확정하세요.`;
    }
    if (anchorCell && !placementStatus.legal) {
      return placementStatus.reason ? `선택 위치는 ${placementStatus.reason} 때문에 둘 수 없습니다.` : "선택 위치에는 둘 수 없습니다. 다른 칸을 골라주세요.";
    }
    return selectedPiece ? "조각을 회전/뒤집은 뒤 보드 칸을 선택하세요." : "먼저 둘 조각을 선택하세요.";
  })();
  const blokusQuickFacts = [
    { label: "색", value: currentColorState?.label || currentColor || "-" },
    { label: "조각", value: selectedPiece?.name || "미선택" },
    { label: "가능", value: `${totalLegalPlacementCount.toLocaleString("ko-KR")}곳` },
    { label: "선택", value: anchorCell ? `${anchorCell.x + 1}, ${anchorCell.y + 1}` : "없음" },
  ];
  const placeButtonEnabled = myTurn && Boolean(anchorCell) && Boolean(placementStatus.legal);
  const placeButtonHint = !myTurn
    ? "내 차례가 되면 놓을 수 있습니다."
    : !selectedPiece
      ? "먼저 오른쪽 조각 목록에서 도형을 고르세요."
      : !anchorCell
        ? "보드 칸을 누르면 도형이 덮을 칸이 색으로 표시됩니다."
        : placementStatus.legal
          ? "초록/현재 색 미리보기 칸에 확정 배치할 수 있습니다."
          : placementStatus.reason || "현재 위치에는 놓을 수 없습니다.";

  useEffect(() => {
    if (!remainingPieceCodes.includes(selectedPieceCode)) {
      setSelectedPieceCode(remainingPieceCodes[0] || "");
      setRotation(0);
      setFlipped(false);
      setAnchorCell(null);
    }
  }, [remainingPieceCodes, selectedPieceCode]);

  useEffect(() => {
    setAnchorCell(null);
  }, [selectedPieceCode, rotation, flipped, currentColor]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!blokusBoardCellSizes.includes(boardCellSize)) return;
    window.localStorage?.setItem(blokusBoardCellSizeStorageKey, String(boardCellSize));
  }, [boardCellSize]);

  const selectFirstPlayablePiece = () => {
    if (!firstPlayablePieceCode) return;
    setSelectedPieceCode(firstPlayablePieceCode);
    setRotation(0);
    setFlipped(false);
    setAnchorCell(null);
    setHoverCell(null);
  };

  const place = async (x, y) => {
    if (!myTurn || !selectedPieceCode) return;
    await onAction({
      action_type: "PLACE",
      piece_code: selectedPieceCode,
      anchor_x: x,
      anchor_y: y,
      rotation,
      flipped,
    });
    setAnchorCell(null);
    setHoverCell(null);
  };

  const selectCell = async (x, y) => {
    if (!myTurn || !selectedPieceCode) return;
    const sameAnchor = anchorCell?.x === x && anchorCell?.y === y;
    if (sameAnchor && placementStatus.legal) {
      await place(x, y);
      return;
    }
    setAnchorCell({ x, y });
    setHoverCell(null);
  };

  const pass = async () => {
    if (!myTurn) return;
    await onAction({ action_type: "PASS" });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div id="blokus-board-panel" className="scroll-mt-24 rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-lg sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <Shield className="h-4 w-4 text-primary-600" />
            블로커스 보드
          </div>
          {duoRule && (
            <div className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
              듀오 · 14x14 중앙 시작점
            </div>
          )}
          <div
            className={`rounded-full border px-3 py-1 text-xs font-black ${colorBgSoft[currentColor] || "bg-slate-50"} ${colorText[currentColor] || "text-slate-600"}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {currentTurnLabel}
          </div>
          {myTurn && placementAnchor && (
            <div className={`rounded-full px-3 py-1 text-xs font-black ${placementStatus.legal ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
              {placementStatus.legal ? "배치 가능" : placementStatus.reason || "배치 불가"}
            </div>
          )}
          {myTurn && selectedPiece && !placementAnchor && (
            <div className={`rounded-full px-3 py-1 text-xs font-black ${selectedPieceLegalCount > 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
              선택 조각 가능 위치 {selectedPieceLegalCount.toLocaleString("ko-KR")}곳
            </div>
          )}
          {myTurn && (
            <div className={`rounded-full px-3 py-1 text-xs font-black ${canPass ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
              전체 가능 위치 {totalLegalPlacementCount.toLocaleString("ko-KR")}곳
            </div>
          )}
        </div>
        <div className="mb-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-fuchsia-50 p-3 shadow-sm" role="status" aria-live="polite" aria-atomic="true">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 rounded-2xl p-2 text-white shadow-sm ${colorClasses[currentColor] || "bg-slate-700"}`}>
              <Shield className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-black text-blue-700">지금 할 일</div>
              <div className="mt-0.5 text-sm font-black leading-relaxed text-slate-900">{blokusTurnGuidance}</div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {blokusQuickFacts.map((item) => (
                  <div key={item.label} className="rounded-xl bg-white/80 px-2.5 py-2">
                    <div className="text-[10px] font-bold text-slate-400">{item.label}</div>
                    <div className="truncate text-[11px] font-black text-slate-700">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {phase === "FINISHED" && winners.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <div className="flex items-center gap-2 text-sm font-black text-amber-900">
              <Crown className="h-4 w-4 text-amber-500" />
              최종 승자 · {winnerText}
            </div>
            <div className="text-xs font-black text-amber-700">최종 점수 {winningScore}</div>
          </div>
        )}
        {variantNotice && phase !== "FINISHED" && (
          <div className="mb-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs font-bold leading-relaxed text-sky-800">
            {variantNotice}
            {currentColorShared && currentColorControllers.length > 0 ? ` 현재 공유 색 담당 순서: ${currentColorControllers.map((seatNo) => playerName(seatNo)).join(" → ")}.` : ""}
          </div>
        )}
        <div className="mb-3 flex flex-col gap-2 rounded-xl bg-slate-50 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            {blokusBoardCellSizes.map((size) => (
              <button
                key={size}
                type="button"
                className={`min-h-11 rounded-lg px-3 text-xs font-black ${boardCellSize === size ? "bg-slate-900 text-white" : "bg-white text-slate-600"}`}
                onClick={() => setBoardCellSize(size)}
              >
                {size === 16 ? "모바일" : size === 20 ? "촘촘" : size === 24 ? "표준" : "확대"}
              </button>
            ))}
          </div>
          <div className="text-xs font-bold text-slate-500">
            {anchorCell ? `선택 ${anchorCell.x + 1}, ${anchorCell.y + 1}` : "위치 미선택"}
          </div>
        </div>
        <div className="tabletop-board-scroll overflow-auto rounded-xl border border-slate-300 bg-slate-200">
          <div
            className="grid"
            aria-label="블로커스 보드"
            style={{
              gridTemplateColumns: `repeat(${boardSize}, ${boardCellSize}px)`,
              width: boardSize * boardCellSize,
              height: boardSize * boardCellSize,
            }}
            onMouseLeave={() => {
              if (!anchorCell) setHoverCell(null);
            }}
          >
            {Array.from({ length: boardSize * boardSize }, (_, index) => {
              const x = index % boardSize;
              const y = Math.floor(index / boardSize);
              const cell = occupied.get(`${x}:${y}`);
              const color = cell?.color;
              const preview = previewCells.has(`${x}:${y}`);
              const anchored = anchorCell?.x === x && anchorCell?.y === y;
              const startPoint = startPointByCell.get(`${x}:${y}`);
              const cellLabelParts = [`${x + 1}열 ${y + 1}행`];
              if (cell) {
                cellLabelParts.push(`${blokusColorLabels[color] || color} 조각`);
              } else if (startPoint) {
                cellLabelParts.push("시작점");
              } else {
                cellLabelParts.push("빈 칸");
              }
              if (anchored) cellLabelParts.push("현재 선택 위치");
              if (preview && !cell) cellLabelParts.push(placementStatus.legal ? "배치 미리보기 가능" : placementStatus.reason || "배치 미리보기 불가");
              if (preview && cell) cellLabelParts.push("이미 차지한 칸과 겹침");
              if (myTurn && selectedPiece) cellLabelParts.push(`${selectedPiece.name || selectedPieceCode} 배치 기준`);
              const cellLabel = cellLabelParts.join(" · ");
              return (
                <button
                  key={`${x}:${y}`}
                  type="button"
                  className={[
                    "relative border border-white/60 transition-all",
                    color ? `${colorClasses[color] || "bg-slate-500"} shadow-inner` : startPoint ? "bg-amber-100 hover:bg-amber-200" : "bg-slate-50 hover:bg-slate-100",
                    preview && !cell && placementStatus.legal ? `${colorClasses[currentColor] || "bg-slate-400"} z-10 scale-105 opacity-95 ring-2 ring-slate-950 ring-offset-1 ring-offset-white shadow-[0_0_0_2px_rgba(255,255,255,0.9)_inset]` : "",
                    preview && !cell && !placementStatus.legal ? "z-10 scale-105 bg-rose-300 ring-2 ring-rose-700 ring-offset-1 ring-offset-white" : "",
                    preview && cell ? "z-10 ring-2 ring-rose-700 ring-offset-1 ring-offset-white" : "",
                    anchored ? "z-20 ring-2 ring-slate-950 ring-offset-2 ring-offset-amber-200" : "",
                  ].join(" ")}
                  style={{ width: boardCellSize, height: boardCellSize }}
                  onMouseEnter={() => {
                    if (!anchorCell) setHoverCell({ x, y });
                  }}
                  onFocus={() => {
                    if (!anchorCell) setHoverCell({ x, y });
                  }}
                  onClick={() => selectCell(x, y).catch(() => toast.error("둘 수 없는 위치입니다."))}
                  aria-label={cellLabel}
                  aria-pressed={anchored}
                  title={cellLabel}
                >
                  {startPoint && !cell && (
                    <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500 shadow-sm" />
                  )}
                  {preview && !cell && (
                    <span className={`absolute inset-[22%] rounded-[3px] border ${placementStatus.legal ? "border-white/90 bg-white/25" : "border-rose-900/70 bg-white/20"}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div id="blokus-action-strip" className="tabletop-mobile-action-strip sticky z-20 mt-3 scroll-mt-24 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur xl:hidden">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-slate-500">
            <span className="font-black text-slate-800">{selectedPiece?.name || "조각 선택"}</span>
            <span>{anchorCell ? `선택 ${anchorCell.x + 1}, ${anchorCell.y + 1}` : "보드에서 위치 선택"}</span>
            <span className={selectedPieceLegalCount > 0 ? "text-emerald-600" : "text-rose-600"}>
              가능 위치 {selectedPieceLegalCount.toLocaleString("ko-KR")}
            </span>
          </div>
          <div className="mb-2 grid grid-cols-[auto_auto_minmax(0,1fr)] gap-2">
            <button
              type="button"
              className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700 disabled:opacity-40"
              onClick={() => setRotation((value) => (value + 90) % 360)}
              disabled={!myTurn}
              aria-label={`선택 조각을 90도 회전합니다. 현재 ${rotation}도`}
              title="회전"
            >
              <RotateCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700 disabled:opacity-40"
              onClick={() => setFlipped((value) => !value)}
              disabled={!myTurn}
              aria-label={`선택 조각을 뒤집습니다. 현재 ${flipped ? "뒤집힌 상태" : "기본 방향"}`}
              title="뒤집기"
            >
              <FlipHorizontal className="h-4 w-4" />
            </button>
            <div className="tabletop-scroll-rail flex min-w-0 gap-2 overflow-x-auto pb-1">
              {quickPieceCodes.map((pieceCode) => {
                const piece = pieceByCode.get(pieceCode);
                const selected = pieceCode === selectedPieceCode;
                const legalCount = Number(legalPlacementCountsByPieceCode.get(pieceCode) || 0);
                return (
                  <button
                    key={`quick-${pieceCode}`}
                    type="button"
                    className={`flex h-16 min-w-[78px] flex-col items-center justify-between rounded-xl border px-2 py-1.5 text-[10px] font-black transition ${selected ? "border-slate-900 bg-slate-900 text-white" : legalCount > 0 ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-500"}`}
                    onClick={() => setSelectedPieceCode(pieceCode)}
                    disabled={!myTurn}
                    aria-pressed={selected}
                    aria-label={`${piece?.name || pieceCode} 조각 선택 · ${piece?.size || piece?.cells?.length || 0}칸 · 가능 위치 ${legalCount.toLocaleString("ko-KR")}곳${selected ? " · 현재 선택됨" : ""}`}
                    title={`${piece?.name || pieceCode} · 가능 위치 ${legalCount.toLocaleString("ko-KR")}곳`}
                  >
                    <span className="max-w-full truncate">{piece?.name || pieceCode}</span>
                    <MiniPiece piece={piece} color={currentColor || "BLUE"} />
                  </button>
                );
              })}
              {!quickPieceCodes.length && (
                <div className="flex h-16 min-w-[120px] items-center justify-center rounded-xl bg-slate-50 px-3 text-[11px] font-bold text-slate-400">
                  남은 조각 없음
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <button
              type="button"
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-black text-white ${placeButtonEnabled ? "bg-emerald-600 shadow-lg shadow-emerald-200" : "bg-slate-400 opacity-70"}`}
              disabled={!placeButtonEnabled}
              onClick={() => anchorCell && place(anchorCell.x, anchorCell.y).catch(() => toast.error("놓을 수 없는 위치입니다."))}
            >
              <CheckCircle2 className="h-4 w-4" />
              놓기
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-100 px-3 py-3 text-xs font-black text-slate-700 disabled:opacity-40"
              onClick={() => pass().catch(() => toast.error("아직 놓을 수 있는 조각이 있습니다."))}
              disabled={!canPass}
            >
              패스
            </button>
          </div>
          <div className={`mt-2 rounded-xl px-3 py-2 text-[11px] font-bold ${canPass ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-500"}`}>
            {canPass ? "남은 모든 조각이 막혀 패스할 수 있습니다." : placeButtonHint}
          </div>
          {selectedPieceBlocked && (
            <button
              type="button"
              className="mt-2 inline-flex w-full min-h-11 items-center justify-center rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700"
              onClick={selectFirstPlayablePiece}
            >
              둘 수 있는 조각 자동 선택
            </button>
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-black text-slate-900">조각 선택</div>
            <div className="flex gap-1">
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 disabled:opacity-40"
                onClick={() => setRotation((value) => (value + 90) % 360)}
                disabled={!myTurn}
                aria-label={`선택 조각을 90도 회전합니다. 현재 ${rotation}도`}
                title="회전"
              >
                <RotateCw className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 disabled:opacity-40"
                onClick={() => setFlipped((value) => !value)}
                disabled={!myTurn}
                aria-label={`선택 조각을 뒤집습니다. 현재 ${flipped ? "뒤집힌 상태" : "기본 방향"}`}
                title="뒤집기"
              >
                <FlipHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
            <span>회전 {rotation}도</span>
            <span>{flipped ? "뒤집힘" : "기본 방향"}</span>
          </div>
          <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-black text-slate-700">{selectedPiece?.name || "조각"}</span>
              <span className="text-[11px] font-bold text-slate-500">{selectedPiece ? `${selectedPieceSize}칸` : "-"}</span>
            </div>
            <div className="flex min-h-[54px] items-center justify-center rounded-lg bg-white">
              {selectedPiece ? <MiniPiece piece={{ ...selectedPiece, cells: transformCells(selectedPiece, rotation, flipped, 0, 0) }} color={currentColor || "BLUE"} /> : null}
            </div>
          </div>
          <div className={`mt-3 rounded-xl border px-3 py-2 text-xs font-bold leading-relaxed ${selectedPieceLegalCount > 0 ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-rose-100 bg-rose-50 text-rose-700"}`}>
            {selectedPiece
              ? selectedPieceLegalCount > 0
                ? `현재 보드에서 이 조각을 둘 수 있는 위치가 ${selectedPieceLegalCount.toLocaleString("ko-KR")}곳 있습니다.`
                : "이 조각은 현재 둘 수 없습니다. 다른 조각을 고르거나 모든 조각이 막혔을 때 패스하세요."
              : "놓을 조각을 선택하세요."}
          </div>
          {selectedPieceBlocked && (
            <button
              type="button"
              className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700"
              onClick={selectFirstPlayablePiece}
            >
              둘 수 있는 조각 자동 선택
            </button>
          )}
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-black">
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-slate-600">남은 조각 {remainingPieceCodes.length}개</div>
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-slate-600">남은 칸 {remainingSquares}칸</div>
            <div className={`col-span-2 rounded-xl px-3 py-2 ${canPass ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-600"}`}>
              전체 가능 위치 {totalLegalPlacementCount.toLocaleString("ko-KR")}곳
            </div>
          </div>
          <button
            type="button"
            className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-black text-white ${placeButtonEnabled ? "bg-emerald-600 shadow-lg shadow-emerald-200" : "bg-slate-400 opacity-70"}`}
            disabled={!placeButtonEnabled}
            onClick={() => anchorCell && place(anchorCell.x, anchorCell.y).catch(() => toast.error("둘 수 없는 위치입니다."))}
          >
            <CheckCircle2 className="h-4 w-4" />
            선택 위치에 놓기
          </button>
          <div className={`mt-2 rounded-xl border px-3 py-2 text-[11px] font-bold leading-relaxed ${placeButtonEnabled ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-slate-100 bg-slate-50 text-slate-500"}`}>
            {placeButtonHint}
          </div>
          <div className="mt-3 grid max-h-[360px] grid-cols-2 gap-2 overflow-auto pr-1 sm:grid-cols-3 xl:grid-cols-2">
            {remainingPieceCodes.map((pieceCode) => {
              const piece = pieceByCode.get(pieceCode);
              const selected = pieceCode === selectedPieceCode;
              const legalCount = Number(legalPlacementCountsByPieceCode.get(pieceCode) || 0);
              return (
                <button
                  key={pieceCode}
                  type="button"
                  className={`flex min-h-[82px] flex-col justify-between rounded-xl border p-2 text-left transition ${selected ? "border-slate-900 bg-slate-900 text-white" : legalCount > 0 ? "border-emerald-100 bg-emerald-50 text-emerald-800 hover:border-emerald-300" : "border-slate-200 bg-white text-slate-500 hover:border-slate-400"}`}
                  onClick={() => setSelectedPieceCode(pieceCode)}
                  disabled={!myTurn}
                  aria-label={`${piece?.name || pieceCode} 조각 선택 · ${piece?.size || piece?.cells?.length || 0}칸 · 가능 위치 ${legalCount.toLocaleString("ko-KR")}곳${selected ? " · 현재 선택됨" : ""}`}
                  aria-pressed={selected}
                  title={`${piece?.name || pieceCode} · 가능 위치 ${legalCount.toLocaleString("ko-KR")}곳`}
                >
                  <span className="flex items-center justify-between gap-1 text-[11px] font-black">
                    <span className="min-w-0 truncate">{piece?.name || pieceCode}</span>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] ${selected ? "bg-white/15 text-white" : legalCount > 0 ? "bg-white text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                      {legalCount > 0 ? `${legalCount.toLocaleString("ko-KR")}곳` : "막힘"}
                    </span>
                  </span>
                  <MiniPiece piece={piece} color={currentColor || "BLUE"} />
                </button>
              );
            })}
            {!remainingPieceCodes.length && <div className="col-span-2 rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-400">남은 조각 없음</div>}
          </div>
          <button
            type="button"
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-3 py-3 text-sm font-black text-slate-700 disabled:opacity-40"
            onClick={() => pass().catch(() => toast.error("아직 둘 수 있는 조각이 있습니다."))}
            disabled={!canPass}
          >
            <Ban className="h-4 w-4" />
            {canPass ? "둘 수 없음 · 패스" : "패스 불가"}
          </button>
          <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-bold leading-relaxed text-slate-500">
            {canPass
              ? "남은 모든 조각이 막혔습니다. 서버 규칙상 패스가 승인됩니다."
              : "패스는 남은 모든 조각이 막혔을 때만 가능합니다. 선택 조각이 막혔다면 다른 조각도 확인하세요."}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-black text-slate-900">점수</div>
            <div className="text-[11px] font-bold text-slate-500">남은 칸은 감점 · 완주 +15 · 마지막 1칸 +5</div>
          </div>
          <div className="space-y-2">
            {scores.map((score) => {
              const scoreColors = get(score, "colors", "colors", []);
              return (
                <div key={get(score, "score_key", "scoreKey", score.label)} className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-black text-slate-700">{scoreDisplayLabel(score)}</div>
                    <div className="mt-2 space-y-1">
                      {scoreColors.map((color) => {
                        const detail = blokusScoreDetailsByColor.get(color);
                        return (
                          <div key={color} className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-slate-500">
                            <span className={`h-2.5 w-2.5 rounded-full ${colorClasses[color] || "bg-slate-300"}`} />
                            <span className={`${colorText[color] || "text-slate-600"} font-black`}>{blokusColorLabels[color] || color}</span>
                            {detail?.shared && <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-sky-700">공유 색</span>}
                            {detail?.completed ? (
                              <>
                                <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-emerald-700">완주 +15</span>
                                {detail.monominoBonus > 0 && <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-amber-700">마지막 1칸 +5</span>}
                              </>
                            ) : (
                              <span>남은 {detail?.remainingSquares ?? 0}칸</span>
                            )}
                            <span className="text-slate-400">점수 {detail?.score ?? 0}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 text-sm font-black text-slate-900">
                    {score.winner && <Crown className="h-4 w-4 text-amber-500" />}
                    {score.score}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
          <div className="mb-3 text-sm font-black text-slate-900">최근 수</div>
          <div className="space-y-2">
            {moveHistory.slice(-5).reverse().map((move) => (
              <div key={get(move, "turn_number", "turnNumber", 0)} className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
                {get(move, "turn_number", "turnNumber", 0)}수 · {move.pass ? "패스" : get(move, "piece_code", "pieceCode", "")} · {move.color}
              </div>
            ))}
            {!moveHistory.length && <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-400">아직 기록 없음</div>}
          </div>
        </div>
      </aside>
    </div>
  );
};

const TurtleStack = ({ seatNos = [], compact = false }) => (
  <div className="flex -space-x-1">
    {seatNos.map((seatNo, index) => (
      <span
        key={`${seatNo}-${index}`}
        className={`flex items-center justify-center rounded-full border font-black shadow-sm ${compact ? "h-4 w-4 text-[9px]" : "h-5 w-5 text-[10px]"} ${seatTokenClasses[(seatNo - 1) % seatTokenClasses.length]}`}
        title={`${seatNo}번`}
      >
        {seatNo}
      </span>
    ))}
  </div>
);

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
        onClick={() => choose(count).catch(() => toast.error("주사위 개수 선택 실패"))}
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
        <div className="mb-4 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-3 shadow-sm" role="status" aria-live="polite" aria-atomic="true">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-2xl bg-emerald-600 p-2 text-white shadow-sm">
              <Dices className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-black text-emerald-700">지금 할 일</div>
              <div className="mt-0.5 text-sm font-black leading-relaxed text-slate-900">{maheTurnGuidance}</div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {maheQuickFacts.map((item) => (
                  <div key={item.label} className="rounded-xl bg-white/80 px-2.5 py-2">
                    <div className="text-[10px] font-bold text-slate-400">{item.label}</div>
                    <div className="truncate text-[11px] font-black text-slate-700">{item.value}</div>
                  </div>
                ))}
              </div>
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
                onClick={() => roll().catch(() => toast.error("주사위 굴리기 실패"))}
              >
                굴리기
              </button>
              <button
                type="button"
                className="min-h-11 rounded-xl bg-amber-500 px-3 py-3 text-sm font-black text-white disabled:opacity-40"
                disabled={!canRoll || !dice.length}
                onClick={() => stop().catch(() => toast.error("이동 실패"))}
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
                onClick={() => roll().catch(() => toast.error("주사위 굴리기 실패"))}
              >
                굴리기
              </button>
              <button
                type="button"
                className="min-h-11 rounded-xl bg-amber-500 px-3 py-3 text-sm font-black text-white disabled:opacity-40"
                disabled={!canRoll || !dice.length}
                onClick={() => stop().catch(() => toast.error("이동 실패"))}
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
            {!moveHistory.length && <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-400">아직 기록 없음</div>}
          </div>
        </div>
      </aside>
    </div>
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
  const tone = jester
    ? "from-violet-700 via-fuchsia-600 to-amber-400 text-white"
    : rank <= 3
      ? "from-amber-200 via-white to-rose-100 text-slate-900"
      : rank <= 7
        ? "from-sky-100 via-white to-emerald-100 text-slate-900"
        : "from-stone-100 via-white to-slate-100 text-slate-900";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={cardLabel}
      aria-pressed={selected}
      title={cardLabel}
      className={[
        "relative min-h-[106px] rounded-xl border p-2 text-left shadow-sm transition disabled:opacity-70 sm:min-h-[118px]",
        `bg-gradient-to-br ${tone}`,
        selected ? "tabletop-selected-card border-slate-950 ring-2 ring-slate-950" : "border-slate-200 hover:-translate-y-1 hover:border-slate-400",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-xl font-black sm:text-2xl">{jester ? "광" : rank}</div>
        <div className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-black text-slate-600">{jester ? "와일드" : `${rank}장`}</div>
      </div>
      <div className="absolute inset-x-2 bottom-2 break-words rounded-lg border border-black/5 bg-white/70 px-2 py-1 text-center text-[10px] font-black text-slate-700 sm:text-[11px]">
        {cardName}
      </div>
    </button>
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
      toast.error(selectedPlayStatus.reason);
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
      toast.error(`${required}장을 골라 반환해야 합니다.`);
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
  const playControls = phase === "PLAYING" ? (
    <div className="grid grid-cols-2 gap-2">
      <button
        className="min-h-11 rounded-xl bg-slate-900 px-3 py-3 text-sm font-black text-white disabled:opacity-40"
        disabled={!canPlay || !selectedPlayStatus.legal}
        onClick={() => play().catch(() => toast.error("낼 수 없는 조합입니다."))}
      >
        제출
      </button>
      <button
        className="min-h-11 rounded-xl bg-slate-100 px-3 py-3 text-sm font-black text-slate-700 disabled:opacity-40"
        disabled={!canPlay || !currentTrick}
        onClick={() => pass().catch(() => toast.error("패스할 수 없습니다."))}
      >
        패스
      </button>
    </div>
  ) : null;
  const taxControls = phase === "TAX_RETURN" ? (
    <button
      className="min-h-11 w-full rounded-xl bg-rose-600 px-3 py-3 text-sm font-black text-white disabled:opacity-40"
      disabled={!canReturnTax || selectedCardIds.length !== pendingTaxCount}
      onClick={() => returnTax().catch(() => toast.error("세금 반환 실패"))}
    >
      {canReturnTax ? `선택한 ${selectedCardIds.length}/${pendingTaxCount}장 반환` : "세금 반환 대기"}
    </button>
  ) : null;

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
                  <button className="rounded-xl bg-amber-600 px-3 py-3 text-sm font-black text-white" onClick={() => onAction({ action_type: "DECLARE_REVOLUTION" }).catch(() => toast.error("혁명 선언 실패"))}>
                    혁명 선언
                  </button>
                  <button className="rounded-xl bg-white px-3 py-3 text-sm font-black text-amber-700" onClick={() => onAction({ action_type: "SKIP_REVOLUTION" }).catch(() => toast.error("혁명 포기 실패"))}>
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
                    onClick={() => returnTax().catch(() => toast.error("세금 반환 실패"))}
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
            {!hand.length && <div className="col-span-full rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-400">남은 카드가 없습니다.</div>}
          </div>
        </div>
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
            {!playPile.length && <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-400">아직 제출 없음</div>}
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

const hexPoints = (x, y, radius) =>
  Array.from({ length: 6 }, (_, index) => {
    const angle = ((60 * index - 30) * Math.PI) / 180;
    return `${x + Math.cos(angle) * radius},${y + Math.sin(angle) * radius}`;
  }).join(" ");

const CatanBoard = ({ gameState, players: roomPlayers, mySeatNo, onAction }) => {
  const [selectedVertexId, setSelectedVertexId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [selectedHexId, setSelectedHexId] = useState(null);
  const [targetSeatNo, setTargetSeatNo] = useState("");
  const [buildMode, setBuildMode] = useState("ROAD");
  const [knightMoveSourceId, setKnightMoveSourceId] = useState(null);
  const [shipMoveFromEdgeId, setShipMoveFromEdgeId] = useState(null);
  const [shipMovePath, setShipMovePath] = useState([]);
  const [tradeForm, setTradeForm] = useState({ give: "BRICK", receive: "LUMBER" });
  const [domesticTradeTargetSeatNo, setDomesticTradeTargetSeatNo] = useState("");
  const [domesticOfferForm, setDomesticOfferForm] = useState(emptyCatanResourceCounts);
  const [domesticRequestForm, setDomesticRequestForm] = useState(emptyCatanResourceCounts);
  const [discardForm, setDiscardForm] = useState({ BRICK: 0, LUMBER: 0, WOOL: 0, GRAIN: 0, ORE: 0 });
  const [discardCommodityForm, setDiscardCommodityForm] = useState({ PAPER: 0, CLOTH: 0, COIN: 0 });
  const [goldForm, setGoldForm] = useState({ BRICK: 0, LUMBER: 0, WOOL: 0, GRAIN: 0, ORE: 0 });
  const [camelBidForm, setCamelBidForm] = useState({ WOOL: 0, GRAIN: 0 });
  const [masterMerchantResources, setMasterMerchantResources] = useState({ BRICK: 0, LUMBER: 0, WOOL: 0, GRAIN: 0, ORE: 0 });
  const [masterMerchantCommodities, setMasterMerchantCommodities] = useState({ PAPER: 0, CLOTH: 0, COIN: 0 });
  const [weddingResources, setWeddingResources] = useState({ BRICK: 0, LUMBER: 0, WOOL: 0, GRAIN: 0, ORE: 0 });
  const [weddingCommodities, setWeddingCommodities] = useState({ PAPER: 0, CLOTH: 0, COIN: 0 });
  const [selectedCardId, setSelectedCardId] = useState("");
  const [selectedProgressCardId, setSelectedProgressCardId] = useState("");
  const [roadCardEdges, setRoadCardEdges] = useState([]);
  const [selectedImprovementType, setSelectedImprovementType] = useState("SCIENCE");
  const [selectedCommodityType, setSelectedCommodityType] = useState("PAPER");
  const [selectedAqueductResourceType, setSelectedAqueductResourceType] = useState("BRICK");
  const [selectedSpyCardId, setSelectedSpyCardId] = useState("");
  const [alchemistDice, setAlchemistDice] = useState({ red: 1, white: 1 });
  const phase = gameState?.phase || "SETUP";
  const activeSeatNo = Number(get(gameState, "active_seat_no", "activeSeatNo", 0));
  const pairedTurnRule = Boolean(get(gameState, "paired_turn_rule", "pairedTurnRule", false));
  const seafarersRule = Boolean(get(gameState, "seafarers_rule", "seafarersRule", false));
  const citiesKnightsRule = Boolean(get(gameState, "cities_knights_rule", "citiesKnightsRule", false));
  const tradersBarbariansRule = Boolean(get(gameState, "traders_barbarians_rule", "tradersBarbariansRule", false));
  const fishermenRule = Boolean(get(gameState, "fishermen_rule", "fishermenRule", false));
  const riversRule = Boolean(get(gameState, "rivers_rule", "riversRule", false));
  const caravansRule = Boolean(get(gameState, "caravans_rule", "caravansRule", false));
  const barbarianAttackRule = Boolean(get(gameState, "barbarian_attack_rule", "barbarianAttackRule", false));
  const explorersPiratesRule = Boolean(get(gameState, "explorers_pirates_rule", "explorersPiratesRule", false));
  const friendlyRobberRule = Boolean(get(gameState, "friendly_robber_rule", "friendlyRobberRule", false));
  const seafarersScenarioCode = get(gameState, "seafarers_scenario_code", "seafarersScenarioCode", "");
  const catanianOneSeatNo = Number(get(gameState, "catanian_one_seat_no", "catanianOneSeatNo", 0));
  const catanianTwoSeatNo = Number(get(gameState, "catanian_two_seat_no", "catanianTwoSeatNo", 0));
  const turnNo = Number(get(gameState, "turn_no", "turnNo", 0));
  const robberHexId = Number(get(gameState, "robber_hex_id", "robberHexId", 0));
  const pirateHexId = Number(get(gameState, "pirate_hex_id", "pirateHexId", 0));
  const fishHaulDie = Number(get(gameState, "fish_haul_die", "fishHaulDie", 0));
  const fishHaulsInSupply = Number(get(gameState, "fish_hauls_in_supply", "fishHaulsInSupply", 0));
  const councilDockEdgeIds = get(gameState, "council_dock_edge_ids", "councilDockEdgeIds", []);
  const barbarianPosition = Number(get(gameState, "barbarian_position", "barbarianPosition", 0));
  const barbarianTrackLength = Number(get(gameState, "barbarian_track_length", "barbarianTrackLength", 7));
  const barbarianAttacks = Number(get(gameState, "barbarian_attacks", "barbarianAttacks", 0));
  const citiesKnightsRobberLocked = citiesKnightsRule && barbarianAttacks <= 0;
  const merchantSeatNo = Number(get(gameState, "merchant_seat_no", "merchantSeatNo", 0));
  const merchantHexId = Number(get(gameState, "merchant_hex_id", "merchantHexId", 0));
  const merchantResourceType = get(gameState, "merchant_resource_type", "merchantResourceType", "");
  const merchantFleetSeatNo = Number(get(gameState, "merchant_fleet_seat_no", "merchantFleetSeatNo", 0));
  const merchantFleetCardType = get(gameState, "merchant_fleet_card_type", "merchantFleetCardType", "");
  const oasisHexId = Number(get(gameState, "oasis_hex_id", "oasisHexId", 0));
  const camelSupply = Number(get(gameState, "camel_supply", "camelSupply", 0));
  const pendingCamelPlacements = Number(get(gameState, "pending_camel_placements", "pendingCamelPlacements", 0));
  const camelBidCurrentSeatNo = Number(get(gameState, "camel_bid_current_seat_no", "camelBidCurrentSeatNo", 0));
  const camelPlacerSeatNo = Number(get(gameState, "camel_placer_seat_no", "camelPlacerSeatNo", 0));
  const camelStartEdgeIds = get(gameState, "camel_start_edge_ids", "camelStartEdgeIds", []);
  const camelBids = get(gameState, "camel_bids", "camelBids", []);
  const barbarianAttackSupply = Number(get(gameState, "barbarian_attack_supply", "barbarianAttackSupply", 0));
  const pendingDeserterAttackerSeatNo = Number(get(gameState, "pending_deserter_attacker_seat_no", "pendingDeserterAttackerSeatNo", 0));
  const pendingDeserterTargetSeatNo = Number(get(gameState, "pending_deserter_target_seat_no", "pendingDeserterTargetSeatNo", 0));
  const pendingDeserterKnightLevel = Number(get(gameState, "pending_deserter_knight_level", "pendingDeserterKnightLevel", 0));
  const pendingIntrigueAttackerSeatNo = Number(get(gameState, "pending_intrigue_attacker_seat_no", "pendingIntrigueAttackerSeatNo", 0));
  const pendingIntrigueTargetSeatNo = Number(get(gameState, "pending_intrigue_target_seat_no", "pendingIntrigueTargetSeatNo", 0));
  const pendingIntrigueKnightLevel = Number(get(gameState, "pending_intrigue_knight_level", "pendingIntrigueKnightLevel", 0));
  const pendingDisplacedKnightTargetSeatNo = Number(get(gameState, "pending_displaced_knight_target_seat_no", "pendingDisplacedKnightTargetSeatNo", 0));
  const pendingDisplacedKnightLevel = Number(get(gameState, "pending_displaced_knight_level", "pendingDisplacedKnightLevel", 0));
  const pendingCommercialHarborSeatNo = Number(get(gameState, "pending_commercial_harbor_seat_no", "pendingCommercialHarborSeatNo", 0));
  const pendingCommercialHarborResourceType = get(gameState, "pending_commercial_harbor_resource_type", "pendingCommercialHarborResourceType", "");
  const pendingCommercialHarborSeatNos = get(gameState, "pending_commercial_harbor_seat_nos", "pendingCommercialHarborSeatNos", []);
  const pendingMasterMerchantAttackerSeatNo = Number(get(gameState, "pending_master_merchant_attacker_seat_no", "pendingMasterMerchantAttackerSeatNo", 0));
  const pendingMasterMerchantTargetSeatNo = Number(get(gameState, "pending_master_merchant_target_seat_no", "pendingMasterMerchantTargetSeatNo", 0));
  const pendingMasterMerchantCount = Number(get(gameState, "pending_master_merchant_count", "pendingMasterMerchantCount", 0));
  const pendingSpyAttackerSeatNo = Number(get(gameState, "pending_spy_attacker_seat_no", "pendingSpyAttackerSeatNo", 0));
  const pendingSpyTargetSeatNo = Number(get(gameState, "pending_spy_target_seat_no", "pendingSpyTargetSeatNo", 0));
  const pendingWeddingAttackerSeatNo = Number(get(gameState, "pending_wedding_attacker_seat_no", "pendingWeddingAttackerSeatNo", 0));
  const pendingWeddingSeatNos = get(gameState, "pending_wedding_seat_nos", "pendingWeddingSeatNos", []);
  const lastRoll = Number(get(gameState, "last_roll", "lastRoll", 0));
  const redDie = Number(get(gameState, "red_die", "redDie", 0));
  const eventDie = get(gameState, "event_die", "eventDie", "");
  const dice = get(gameState, "dice", "dice", []);
  const hexes = get(gameState, "hexes", "hexes", []);
  const fogIslandsRule = seafarersScenarioCode === "FOG_ISLANDS";
  const throughDesertRule = seafarersScenarioCode === "THROUGH_DESERT";
  const forgottenTribeRule = seafarersScenarioCode === "FORGOTTEN_TRIBE";
  const clothForCatanRule = seafarersScenarioCode === "CLOTH";
  const hiddenFogCount = hexes.filter((hex) => !Boolean(get(hex, "discovered", "discovered", true))).length;
  const vertices = get(gameState, "vertices", "vertices", []);
  const edges = get(gameState, "edges", "edges", []);
  const ports = get(gameState, "ports", "ports", []);
  const fishingGrounds = get(gameState, "fishing_grounds", "fishingGrounds", []);
  const clothVillages = get(gameState, "cloth_villages", "clothVillages", []);
  const clothVillageGeneralSupply = Number(get(gameState, "cloth_village_general_supply", "clothVillageGeneralSupply", 0));
  const catanPlayers = get(gameState, "players", "players", []);
  const events = get(gameState, "events", "events", []);
  const pendingDiscardSeatNos = get(gameState, "pending_discard_seat_nos", "pendingDiscardSeatNos", []);
  const pendingProgressDiscardSeatNos = get(gameState, "pending_progress_discard_seat_nos", "pendingProgressDiscardSeatNos", []);
  const pendingDefenderProgressSeatNos = get(gameState, "pending_defender_progress_seat_nos", "pendingDefenderProgressSeatNos", []);
  const pendingGoldChoices = get(gameState, "pending_gold_choices", "pendingGoldChoices", []);
  const pendingAqueductChoices = get(gameState, "pending_aqueduct_choices", "pendingAqueductChoices", []);
  const pendingDomesticTrade = get(gameState, "pending_domestic_trade", "pendingDomesticTrade", null);
  const winningPoints = Number(get(gameState, "winning_points", "winningPoints", 10));
  const catanRuleBrief = (() => {
    const targetText = `목표 ${winningPoints}점`;
    if (explorersPiratesRule) {
      return {
        title: "탐험가와 해적",
        summary: "항구 정착지에서 출항해 미발견 해역을 탐험하고, 물고기·향신료·해적 소굴 임무로 점수를 쌓습니다.",
        chips: [targetText, "도둑 없음", "해적 이동", "화물 1대형/2소형"],
        tone: "border-sky-100 bg-sky-50 text-sky-900",
        chipTone: "bg-white/80 text-sky-700",
      };
    }
    if (citiesKnightsRule) {
      return {
        title: "도시와 기사",
        summary: "상품, 도시 발전, 기사 활성화, 야만인 침공이 핵심입니다. 첫 야만인 침공 전에는 도둑 이동이 잠깁니다.",
        chips: [targetText, "두 번째 배치 도시", "진행 카드", "야만인 트랙"],
        tone: "border-rose-100 bg-rose-50 text-rose-900",
        chipTone: "bg-white/80 text-rose-700",
      };
    }
    if (clothForCatanRule) {
      return {
        title: "항해사: 카탄에 천을",
        summary: "부족 마을과 배로 연결해 직물을 얻고, 직물 2개마다 승점 1점을 추가합니다.",
        chips: [targetText, "부족 마을", "직물 교역", "고갈 종료"],
        tone: "border-fuchsia-100 bg-fuchsia-50 text-fuchsia-900",
        chipTone: "bg-white/80 text-fuchsia-700",
      };
    }
    if (forgottenTribeRule) {
      return {
        title: "항해사: 잊힌 부족",
        summary: "부족 섬에는 정착할 수 없고, 배가 선물 해안에 닿으면 승점·개발 카드·항구 선물을 받습니다.",
        chips: [targetText, "선물 해안", "부족 섬 정착 불가", "13점"],
        tone: "border-teal-100 bg-teal-50 text-teal-900",
        chipTone: "bg-white/80 text-teal-700",
      };
    }
    if (throughDesertRule) {
      return {
        title: "항해사: 사막을 지나서",
        summary: "사막 장벽 너머 외국 지역을 개척합니다. 새 외국 지역에 처음 마을을 세우면 특별 승점 2점을 받습니다.",
        chips: [targetText, "본섬 초기 배치", "외국 지역 보너스", "14점"],
        tone: "border-amber-100 bg-amber-50 text-amber-900",
        chipTone: "bg-white/80 text-amber-800",
      };
    }
    if (fogIslandsRule) {
      return {
        title: "항해사: 안개 섬",
        summary: "배나 도로가 안개에 닿으면 타일이 공개됩니다. 발견한 육지는 해당 자원 보상을 주고, 금광은 선택 보상으로 처리됩니다.",
        chips: [targetText, `미발견 ${hiddenFogCount}개`, "특별 승점 없음", "12점"],
        tone: "border-slate-200 bg-slate-50 text-slate-800",
        chipTone: "bg-white text-slate-600",
      };
    }
    if (seafarersScenarioCode === "FOUR_ISLANDS") {
      return {
        title: "항해사: 네 개의 섬",
        summary: "초기 배치한 섬이 홈 섬입니다. 홈이 아닌 섬에 처음 마을을 세우면 섬마다 특별 승점 2점을 얻습니다.",
        chips: [targetText, "홈 섬 기록", "외국 섬 보너스", "13점"],
        tone: "border-cyan-100 bg-cyan-50 text-cyan-900",
        chipTone: "bg-white/80 text-cyan-700",
      };
    }
    if (seafarersScenarioCode === "NEW_SHORES") {
      return {
        title: "항해사: 새 해안",
        summary: "본섬에서 시작해 배로 외딴 섬을 개척합니다. 플레이어별 첫 외국 섬 마을은 특별 승점 2점입니다.",
        chips: [targetText, "배와 해적", "외딴 섬", "14점"],
        tone: "border-cyan-100 bg-cyan-50 text-cyan-900",
        chipTone: "bg-white/80 text-cyan-700",
      };
    }
    if (barbarianAttackRule) {
      return {
        title: "상인과 야만인: 야만인 침공",
        summary: "해안 야만인이 생산지를 점령할 수 있고, 기사 개발 카드로 방어 기사를 모집해 격퇴 점수를 얻습니다.",
        chips: [targetText, "해안 점령", "방어 기사", "12점"],
        tone: "border-red-100 bg-red-50 text-red-900",
        chipTone: "bg-white/80 text-red-700",
      };
    }
    if (caravansRule) {
      return {
        title: "상인과 야만인: 대상단",
        summary: "마을이나 도시 건설 뒤 낙타 입찰이 열리고, 낙타 행렬은 길 길이와 인접 건물 점수에 영향을 줍니다.",
        chips: [targetText, "낙타 입찰", "경로 보너스", "12점"],
        tone: "border-orange-100 bg-orange-50 text-orange-900",
        chipTone: "bg-white/80 text-orange-700",
      };
    }
    if (riversRule) {
      return {
        title: "상인과 야만인: 카탄의 강",
        summary: "강가 건설과 다리로 골드를 얻고, 골드 보유량에 따라 부유/빈곤 정착민 점수가 바뀝니다.",
        chips: [targetText, "다리", "골드 교환", "부유/빈곤"],
        tone: "border-emerald-100 bg-emerald-50 text-emerald-900",
        chipTone: "bg-white/80 text-emerald-700",
      };
    }
    if (fishermenRule) {
      return {
        title: "상인과 야만인: 카탄의 낚시꾼",
        summary: "낚시터에서 물고기 토큰을 얻고, 물고기 시장 액션으로 도둑 이동·자원 획득·도로 건설 등을 선택합니다.",
        chips: [targetText, "낚시터", "물고기 시장", "낡은 장화"],
        tone: "border-sky-100 bg-sky-50 text-sky-900",
        chipTone: "bg-white/80 text-sky-700",
      };
    }
    if (friendlyRobberRule) {
      return {
        title: "상인과 야만인: 친절한 도둑",
        summary: "공개 승점 2점 이하 플레이어의 건물 옆으로 도둑을 옮길 수 없어 초반 탈락감을 줄입니다.",
        chips: [targetText, "2점 이하 보호", "도둑 제한", "10점"],
        tone: "border-lime-100 bg-lime-50 text-lime-900",
        chipTone: "bg-white/80 text-lime-700",
      };
    }
    if (tradersBarbariansRule) {
      return {
        title: pairedTurnRule ? "상인과 야만인: 항만장 5~6인" : "상인과 야만인: 항만장",
        summary: "항구 위 마을과 도시는 항만 점수를 만들고, 단독 3점 이상 선두가 항만장 보너스 2점을 받습니다.",
        chips: [targetText, "항구 점수", "항만장 +2", pairedTurnRule ? "5~6인" : "3~4인"],
        tone: "border-indigo-100 bg-indigo-50 text-indigo-900",
        chipTone: "bg-white/80 text-indigo-700",
      };
    }
    if (pairedTurnRule) {
      return {
        title: "5~6인 확장",
        summary: "카타니안 1이 주사위와 행동을 진행한 뒤 카타니안 2가 후속 행동을 하고, 두 표식이 함께 이동합니다.",
        chips: [targetText, "카타니안 1/2", "확장 보드", "5~6인"],
        tone: "border-amber-100 bg-amber-50 text-amber-900",
        chipTone: "bg-white/80 text-amber-800",
      };
    }
    return {
      title: "기본판",
      summary: "자원 생산, 건설, 항구 교환, 플레이어 거래, 개발 카드, 최장 교역로와 최대 기사력으로 10점을 먼저 달성합니다.",
      chips: [targetText, "3~4인", "거래", "개발 카드"],
      tone: "border-slate-200 bg-slate-50 text-slate-800",
      chipTone: "bg-white text-slate-600",
    };
  })();
  const winnerSeatNo = Number(get(gameState, "winner_seat_no", "winnerSeatNo", 0));
  const myPlayer = catanPlayers.find((player) => Number(get(player, "seat_no", "seatNo", 0)) === mySeatNo);
  const winnerPlayer = catanPlayers.find((player) => Number(get(player, "seat_no", "seatNo", 0)) === winnerSeatNo);
  const winnerVictoryPoints = Number(get(winnerPlayer, "victory_points", "victoryPoints", get(winnerPlayer, "public_victory_points", "publicVictoryPoints", winningPoints)));
  const resources = get(myPlayer, "resources", "resources", {});
  const resourceBank = get(gameState, "resource_bank", "resourceBank", {});
  const commodities = get(myPlayer, "commodities", "commodities", {});
  const cityImprovements = get(myPlayer, "city_improvements", "cityImprovements", {});
  const metropolisTypes = get(myPlayer, "metropolis_types", "metropolisTypes", []);
  const developmentCards = get(myPlayer, "development_cards", "developmentCards", []);
  const devCardAlreadyPlayedThisTurn = Number(get(myPlayer, "dev_card_played_turn_no", "devCardPlayedTurnNo", 0)) === turnNo;
  const playableDevelopmentCards = useMemo(
    () => developmentCards.filter((card) => {
      const purchasedTurnNo = Number(get(card, "purchased_turn_no", "purchasedTurnNo", 0));
      return card.type !== "VICTORY_POINT" && purchasedTurnNo < turnNo;
    }),
    [developmentCards, turnNo]
  );
  const lockedDevelopmentCards = useMemo(
    () => developmentCards.filter((card) => {
      const purchasedTurnNo = Number(get(card, "purchased_turn_no", "purchasedTurnNo", 0));
      return card.type !== "VICTORY_POINT" && purchasedTurnNo >= turnNo;
    }),
    [developmentCards, turnNo]
  );
  const passiveDevelopmentVictoryCards = useMemo(
    () => developmentCards.filter((card) => card.type === "VICTORY_POINT"),
    [developmentCards]
  );
  const progressCards = get(myPlayer, "progress_cards", "progressCards", []);
  const fishermenTokens = get(myPlayer, "fishermen_tokens", "fishermenTokens", []);
  const fishermenFishTotal = Number(get(myPlayer, "fishermen_fish_total", "fishermenFishTotal", 0));
  const myHasOldBoot = Boolean(get(myPlayer, "has_old_boot", "hasOldBoot", false));
  const myGold = Number(get(myPlayer, "gold", "gold", 0));
  const riverGoldTradesUsed = Number(get(myPlayer, "river_gold_trade_turn_no", "riverGoldTradeTurnNo", -1)) === turnNo
    ? Number(get(myPlayer, "river_gold_trades_this_turn", "riverGoldTradesThisTurn", 0))
    : 0;
  const riverGoldTradesRemaining = Math.max(0, 2 - riverGoldTradesUsed);
  const myTurn = activeSeatNo === mySeatNo;
  const domesticResourceTradeRule = !citiesKnightsRule && !explorersPiratesRule;
  const radius = hexes.length > 25 ? 5.2 : 7.2;
  const vertexById = useMemo(() => new Map(vertices.map((vertex) => [Number(vertex.id), vertex])), [vertices]);
  const edgeById = useMemo(() => new Map(edges.map((edge) => [Number(edge.id), edge])), [edges]);
  const clothVillageByVertexId = useMemo(
    () => new Map(clothVillages.map((village) => [Number(get(village, "vertex_id", "vertexId", 0)), village])),
    [clothVillages]
  );
  const clothVillagesWithSupply = clothVillages.filter((village) => Number(get(village, "supply", "supply", 0)) > 0).length;
  const connectedClothVillageCount = clothVillages.filter((village) => (get(village, "connected_seat_nos", "connectedSeatNos", []) || []).length > 0).length;
  const playerName = (seatNo) => roomPlayers.find((player) => seatNoOf(player) === Number(seatNo))?.nickname || `${seatNo}번`;
  const numberedAreaList = (values, suffix = "번") => (values || [])
    .map((value) => `${value}${suffix}`)
    .join(", ");
  const selectedHex = hexes.find((hex) => Number(hex.id) === Number(selectedHexId));
  const robberTargets = useMemo(() => {
    if (!selectedHex) return [];
    const owners = new Set();
    if (selectedHex.terrain === "SEA") {
      (selectedHex.edgeIds || selectedHex.edge_ids || []).forEach((edgeId) => {
        const edge = edgeById.get(Number(edgeId));
        const owner = Number(get(edge, "owner_seat_no", "ownerSeatNo", 0));
        if (owner && owner !== mySeatNo && get(edge, "route_type", "routeType", "") === "SHIP") owners.add(owner);
      });
    } else {
      (selectedHex.vertexIds || selectedHex.vertex_ids || []).forEach((vertexId) => {
        const owner = Number(get(vertexById.get(Number(vertexId)), "owner_seat_no", "ownerSeatNo", 0));
        if (owner && owner !== mySeatNo) owners.add(owner);
      });
    }
    return Array.from(owners)
      .map((seatNo) => catanPlayers.find((player) => Number(get(player, "seat_no", "seatNo", 0)) === seatNo))
      .filter(Boolean)
      .filter((player) => Number(get(player, "resource_count", "resourceCount", 0)) > 0);
  }, [selectedHex, vertexById, edgeById, catanPlayers, mySeatNo]);
  const fishStealTargets = catanPlayers
    .filter((player) => Number(get(player, "seat_no", "seatNo", 0)) !== mySeatNo)
    .filter((player) => Number(get(player, "resource_count", "resourceCount", 0)) + Number(get(player, "commodity_count", "commodityCount", 0)) > 0);
  const oldBootTargets = catanPlayers
    .filter((player) => Number(get(player, "seat_no", "seatNo", 0)) !== mySeatNo)
    .filter((player) => Number(get(player, "public_victory_points", "publicVictoryPoints", get(player, "victory_points", "victoryPoints", 0))) >= Number(get(myPlayer, "public_victory_points", "publicVictoryPoints", get(myPlayer, "victory_points", "victoryPoints", 0))));
  const domesticTradeTargets = catanPlayers.filter((player) => Number(get(player, "seat_no", "seatNo", 0)) !== mySeatNo);
  const fishActionTargets = Array.from(new Map([...fishStealTargets, ...oldBootTargets].map((player) => [Number(get(player, "seat_no", "seatNo", 0)), player])).values());
  const myCardCount = Number(get(myPlayer, "resource_count", "resourceCount", 0)) + Number(get(myPlayer, "commodity_count", "commodityCount", 0));
  const discardRequired = Math.floor(myCardCount / 2);
  const discardTotal = Object.values(discardForm).reduce((sum, value) => sum + Number(value || 0), 0)
    + Object.values(discardCommodityForm).reduce((sum, value) => sum + Number(value || 0), 0);
  const mustDiscard = pendingDiscardSeatNos.map(Number).includes(mySeatNo);
  const mustChooseDefenderProgress = pendingDefenderProgressSeatNos.map(Number).includes(mySeatNo);
  const mustMoveDisplacedKnight = phase === "DISPLACED_KNIGHT_MOVE" && pendingDisplacedKnightTargetSeatNo === mySeatNo;
  const mustRespondWedding = pendingWeddingSeatNos.map(Number).includes(mySeatNo);
  const weddingRequired = mustRespondWedding ? Math.min(2, myCardCount) : 0;
  const weddingTotal = Object.values(weddingResources).reduce((sum, value) => sum + Number(value || 0), 0)
    + Object.values(weddingCommodities).reduce((sum, value) => sum + Number(value || 0), 0);
  const myGoldChoice = pendingGoldChoices.find((choice) => Number(get(choice, "seat_no", "seatNo", 0)) === mySeatNo);
  const myAqueductChoice = pendingAqueductChoices.find((choice) => Number(get(choice, "seat_no", "seatNo", 0)) === mySeatNo);
  const spyTargetPlayer = catanPlayers.find((player) => Number(get(player, "seat_no", "seatNo", 0)) === pendingSpyTargetSeatNo);
  const revealedSpyCards = get(spyTargetPlayer, "progress_cards", "progressCards", []);
  const selectedSpyCard = revealedSpyCards.find((card) => card.id === selectedSpyCardId);
  const masterMerchantTargetPlayer = catanPlayers.find((player) => Number(get(player, "seat_no", "seatNo", 0)) === pendingMasterMerchantTargetSeatNo);
  const masterMerchantTargetResources = get(masterMerchantTargetPlayer, "resources", "resources", {});
  const masterMerchantTargetCommodities = get(masterMerchantTargetPlayer, "commodities", "commodities", {});
  const masterMerchantTotal = Object.values(masterMerchantResources).reduce((sum, value) => sum + Number(value || 0), 0)
    + Object.values(masterMerchantCommodities).reduce((sum, value) => sum + Number(value || 0), 0);
  const goldRequired = Number(get(myGoldChoice, "amount", "amount", 0));
  const goldTotal = Object.values(goldForm).reduce((sum, value) => sum + Number(value || 0), 0);
  const bankAvailableFor = (resource, amount = 1) => {
    const bankCount = resourceBank?.[resource];
    return bankCount == null || Number(bankCount) >= amount;
  };
  const resourceRequestWithinBank = (values) => catanResourceKeys.every((key) => bankAvailableFor(key, Number(values?.[key] || 0)));
  const yearOfPlentyRequest = useMemo(() => {
    if (!tradeForm.give || !tradeForm.receive) {
      return {};
    }
    return [tradeForm.give, tradeForm.receive].reduce((acc, resource) => {
      if (catanResourceKeys.includes(resource)) {
        acc[resource] = Number(acc[resource] || 0) + 1;
      }
      return acc;
    }, {});
  }, [tradeForm.give, tradeForm.receive]);
  const yearOfPlentyWithinBank = resourceRequestWithinBank(yearOfPlentyRequest);
  const goldChoiceWithinBank = resourceRequestWithinBank(goldForm);
  const aqueductWithinBank = bankAvailableFor(selectedAqueductResourceType, 1);
  const selectedDevCard = playableDevelopmentCards.find((card) => card.id === selectedCardId);
  const selectedDevCardPurchasedTurnNo = Number(get(selectedDevCard, "purchased_turn_no", "purchasedTurnNo", 0));
  const canPlaySelectedDevelopmentCard = myTurn
    && Boolean(selectedDevCard)
    && !devCardAlreadyPlayedThisTurn
    && selectedDevCardPurchasedTurnNo < turnNo
    && (
      (selectedDevCard?.type === "YEAR_OF_PLENTY" && yearOfPlentyWithinBank)
      || selectedDevCard?.type === "MONOPOLY"
      || (selectedDevCard?.type === "KNIGHT" && Boolean(selectedHexId))
      || (selectedDevCard?.type === "ROAD_BUILDING" && roadCardEdges.length > 0)
    );
  const selectedProgressCard = progressCards.find((card) => card.id === selectedProgressCardId);
  const selectedProgressType = get(selectedProgressCard, "type", "type", "");
  const selectedProgressSupported = playableProgressTypes.has(selectedProgressType);
  const selectedProgressBlockedByRobberLock = selectedProgressType === "BISHOP" && citiesKnightsRobberLocked;
  const actionProgressCards = useMemo(
    () => progressCards.filter((card) => {
      const cardType = get(card, "type", "type", "");
      return playableProgressTypes.has(cardType) && cardType !== "ALCHEMIST" && !catanProgressVictoryTypes.has(cardType);
    }),
    [progressCards]
  );
  const passiveProgressVictoryCards = progressCards.filter((card) => catanProgressVictoryTypes.has(get(card, "type", "type", "")));
  const sevenDiscardMessage = explorersPiratesRule
    ? "7이 나왔습니다. 손패가 8장 이상인 플레이어는 절반을 버린 뒤 해적선을 이동합니다."
    : citiesKnightsRobberLocked
      ? "7이 나왔습니다. 손패가 8장 이상인 플레이어는 절반을 버리고, 첫 야만인 침공 전이라 도적 이동 없이 행동을 이어갑니다."
      : "7이 나왔습니다. 손패가 8장 이상인 플레이어는 절반을 버린 뒤 도적을 이동합니다.";
  const nonVictoryProgressCards = progressCards.filter((card) => !catanProgressVictoryTypes.has(get(card, "type", "type", "")));
  const selectedDiscardProgressCardId = nonVictoryProgressCards.some((card) => card.id === selectedProgressCardId)
    ? selectedProgressCardId
    : nonVictoryProgressCards[0]?.id || "";
  const progressDiscardRequired = Math.max(0, nonVictoryProgressCards.length - 4);
  const mustDiscardProgress = pendingProgressDiscardSeatNos.map(Number).includes(mySeatNo);
  const alchemistCards = progressCards.filter((card) => get(card, "type", "type", "") === "ALCHEMIST");
  const selectedAlchemistCardId = selectedProgressType === "ALCHEMIST" ? selectedProgressCardId : alchemistCards[0]?.id || "";
  const catanTradeCardLabels = useMemo(
    () => Object.fromEntries(citiesKnightsRule ? [...catanResourceEntries, ...Object.entries(catanCommodityLabels)] : catanResourceEntries),
    [citiesKnightsRule]
  );
  const catanTradeCardEntries = useMemo(() => Object.entries(catanTradeCardLabels), [catanTradeCardLabels]);
  const tradeRatioFor = (cardType) => {
    let ratio = 4;
    if (merchantFleetSeatNo === mySeatNo && cardType === merchantFleetCardType) {
      ratio = 2;
    }
    if (merchantSeatNo === mySeatNo && cardType === merchantResourceType) {
      ratio = 2;
    }
    vertices.forEach((vertex) => {
      if (Number(get(vertex, "owner_seat_no", "ownerSeatNo", 0)) !== mySeatNo) {
        return;
      }
      const portType = get(vertex, "port_type", "portType", "");
      if (portType === "ANY") {
        ratio = Math.min(ratio, 3);
      } else if (portType && portType === cardType) {
        ratio = Math.min(ratio, 2);
      }
    });
    return ratio;
  };
  const giveTradeRatio = tradeRatioFor(tradeForm.give);
  const tradeGiveCount = catanResourceKeys.includes(tradeForm.give)
    ? Number(resources?.[tradeForm.give] || 0)
    : Number(commodities?.[tradeForm.give] || 0);
  const maritimeReceiveWithinBank = !catanResourceKeys.includes(tradeForm.receive) || bankAvailableFor(tradeForm.receive, 1);
  const canMaritimeTrade = myTurn && tradeForm.give !== tradeForm.receive && tradeGiveCount >= giveTradeRatio && maritimeReceiveWithinBank;
  const canBuyDevelopmentCard = myTurn
    && !citiesKnightsRule
    && !explorersPiratesRule
    && Number(resources?.GRAIN || 0) >= 1
    && Number(resources?.WOOL || 0) >= 1
    && Number(resources?.ORE || 0) >= 1;
  const positiveResourceMap = (values) => Object.fromEntries(
    catanResourceKeys
      .map((key) => [key, Math.max(0, Number(values?.[key] || 0))])
      .filter(([, value]) => value > 0)
  );
  const resourceMapTotal = (values) => Object.values(values || {}).reduce((sum, value) => sum + Math.max(0, Number(value || 0)), 0);
  const resourceBundleLabel = (values) => {
    const entries = Object.entries(values || {}).filter(([, value]) => Number(value || 0) > 0);
    if (!entries.length) return "없음";
    return entries.map(([key, value]) => `${catanResourceLabels[key] || key} ${value}`).join(", ");
  };
  const pendingTradeOffer = get(pendingDomesticTrade, "offer_resources", "offerResources", {});
  const pendingTradeRequest = get(pendingDomesticTrade, "request_resources", "requestResources", {});
  const pendingTradeProposerSeatNo = Number(get(pendingDomesticTrade, "proposer_seat_no", "proposerSeatNo", 0));
  const pendingTradeTargetSeatNo = Number(get(pendingDomesticTrade, "target_seat_no", "targetSeatNo", 0));
  const domesticOfferTotal = resourceMapTotal(domesticOfferForm);
  const domesticRequestTotal = resourceMapTotal(domesticRequestForm);
  const domesticOfferExceeded = catanResourceKeys.some((key) => Number(domesticOfferForm[key] || 0) > Number(resources?.[key] || 0));
  const richerPlayers = catanPlayers.filter((player) => Number(get(player, "seat_no", "seatNo", 0)) !== mySeatNo)
    .filter((player) => Number(get(player, "victory_points", "victoryPoints", 0)) > Number(get(myPlayer, "victory_points", "victoryPoints", 0)))
    .filter((player) => Number(get(player, "resource_count", "resourceCount", 0)) + Number(get(player, "commodity_count", "commodityCount", 0)) > 0);
  const spyTargets = catanPlayers.filter((player) => Number(get(player, "seat_no", "seatNo", 0)) !== mySeatNo)
    .filter((player) => Number(get(player, "progress_card_count", "progressCardCount", 0)) > 0);
  const deserterTargets = catanPlayers.filter((player) => Number(get(player, "seat_no", "seatNo", 0)) !== mySeatNo)
    .filter((player) => vertices.some((vertex) => Number(get(vertex, "knight_owner_seat_no", "knightOwnerSeatNo", 0)) === Number(get(player, "seat_no", "seatNo", 0))));
  const selectedVertex = selectedVertexId ? vertexById.get(Number(selectedVertexId)) : null;
  const selectedEdge = selectedEdgeId ? edgeById.get(Number(selectedEdgeId)) : null;
  const selectedHexTerrain = get(selectedHex, "terrain", "terrain", "");
  const selectedHexToken = Number(get(selectedHex, "number_token", "numberToken", 0));
  const selectedHexMissionType = get(selectedHex, "mission_type", "missionType", "");
  const selectedHexBarbarianCount = Number(get(selectedHex, "barbarian_count", "barbarianCount", 0));
  const selectedVertexOwner = Number(get(selectedVertex, "owner_seat_no", "ownerSeatNo", 0));
  const selectedVertexBuilding = get(selectedVertex, "building_type", "buildingType", "");
  const selectedVertexPortType = get(selectedVertex, "port_type", "portType", "");
  const selectedClothVillage = selectedVertex ? clothVillageByVertexId.get(Number(selectedVertex.id)) : null;
  const selectedEdgeOwner = Number(get(selectedEdge, "owner_seat_no", "ownerSeatNo", 0));
  const selectedEdgeRouteType = get(selectedEdge, "route_type", "routeType", "");
  const selectedEdgeCargoLabel = cargoLabelOf(selectedEdge);
  const selectedKnightOwner = Number(get(selectedVertex, "knight_owner_seat_no", "knightOwnerSeatNo", 0));
  const selectedOwnKnight = selectedKnightOwner === mySeatNo;
  const selectedKnightLevel = Number(get(selectedVertex, "knight_level", "knightLevel", 0));
  const selectedKnightActive = Boolean(get(selectedVertex, "knight_active", "knightActive", false));
  const selectedKnightActivatedTurnNo = Number(get(selectedVertex, "knight_activated_turn_no", "knightActivatedTurnNo", 0));
  const selectedKnightHexIds = get(selectedVertex, "hex_ids", "hexIds", []) || [];
  const selectedKnightTouchesRobber = selectedKnightHexIds.map(Number).includes(robberHexId);
  const selectedVertexTouchesOwnRoute = Boolean(selectedVertex)
    && (get(selectedVertex, "edge_ids", "edgeIds", []) || []).some((edgeId) => {
      const edge = edgeById.get(Number(edgeId));
      return edge && Number(get(edge, "owner_seat_no", "ownerSeatNo", 0)) === mySeatNo;
    });
  const remainingKnightCount = Number(get(myPlayer, "remaining_knights", "remainingKnights", 0));
  const selectedVertexKnightBuildWarning = !selectedVertex
    ? ""
    : selectedVertexOwner || selectedKnightOwner
      ? "이미 건물이나 기사가 있는 교차점에는 기사를 배치할 수 없습니다."
      : !selectedVertexTouchesOwnRoute
        ? "기사는 내 도로망에 닿은 빈 교차점에만 배치할 수 있습니다."
        : remainingKnightCount <= 0
          ? "남은 기사 말이 없습니다."
          : "";
  const selectedVertexCanBuildKnight = Boolean(selectedVertex)
    && !selectedVertexKnightBuildWarning;
  const selectedBuildActionDisabled = !myTurn
    || (buildMode === "KNIGHT" && selectedVertex && !selectedVertexCanBuildKnight);
  const hasFortress = Number(cityImprovements?.POLITICS || 0) >= 3;
  const canPromoteKnightLevel = (level) => level > 0 && level < 3 && (level < 2 || hasFortress);
  const selectedKnightCanPromote = selectedOwnKnight && canPromoteKnightLevel(selectedKnightLevel);
  const smithEligibleKnightCount = vertices.filter((vertex) => Number(get(vertex, "knight_owner_seat_no", "knightOwnerSeatNo", 0)) === mySeatNo)
    .filter((vertex) => canPromoteKnightLevel(Number(get(vertex, "knight_level", "knightLevel", 0))))
    .length;
  const selectedProgressBlockedByFortress = selectedProgressType === "SMITH" && smithEligibleKnightCount <= 0;
  const knightMoveSource = knightMoveSourceId ? vertexById.get(Number(knightMoveSourceId)) : null;
  const knightMoveSourceOwner = Number(get(knightMoveSource, "knight_owner_seat_no", "knightOwnerSeatNo", 0));
  const knightMoveSourceActive = Boolean(get(knightMoveSource, "knight_active", "knightActive", false));
  const knightMoveSourceActivatedTurnNo = Number(get(knightMoveSource, "knight_activated_turn_no", "knightActivatedTurnNo", 0));
  const knightMoveSourceLevel = Number(get(knightMoveSource, "knight_level", "knightLevel", 0));
  const knightMoveSourceLabel = knightMoveSource
    ? [
        `${playerName(knightMoveSourceOwner)} 기사 ${knightMoveSourceLevel}`,
        knightMoveSourceActive ? "활성" : "비활성",
      ].join(" · ")
    : "미지정";
  const selectedHexCanReceiveRobber = Boolean(selectedHex)
    && selectedHex.terrain !== "SEA"
    && Number(get(selectedHex, "number_token", "numberToken", 0)) > 0
    && Number(selectedHex.id) !== robberHexId;
  const selectedVertexCanReceiveKnight = Boolean(selectedVertex)
    && Number(selectedVertex.id) !== Number(knightMoveSourceId)
    && !get(selectedVertex, "owner_seat_no", "ownerSeatNo", null);
  const selectedKnightMoveTargetOwner = Number(get(selectedVertex, "knight_owner_seat_no", "knightOwnerSeatNo", 0));
  const selectedKnightMoveTargetLevel = Number(get(selectedVertex, "knight_level", "knightLevel", 0));
  const selectedKnightDestinationReachable = useMemo(() => {
    if (!knightMoveSource || !selectedVertex || !knightMoveSourceOwner) return false;
    const sourceId = Number(knightMoveSource.id);
    const destinationId = Number(selectedVertex.id);
    if (!sourceId || !destinationId || sourceId === destinationId) return false;
    const visited = new Set([sourceId]);
    const frontier = [sourceId];
    while (frontier.length) {
      const currentId = frontier.shift();
      if (currentId === destinationId) return true;
      const current = vertexById.get(Number(currentId));
      if (!current) continue;
      if (currentId !== sourceId) {
        const currentOwner = Number(get(current, "owner_seat_no", "ownerSeatNo", 0));
        const currentKnightOwner = Number(get(current, "knight_owner_seat_no", "knightOwnerSeatNo", 0));
        if ((currentOwner && currentOwner !== knightMoveSourceOwner) || (currentKnightOwner && currentKnightOwner !== knightMoveSourceOwner)) {
          continue;
        }
      }
      const currentEdgeIds = get(current, "edge_ids", "edgeIds", []) || [];
      currentEdgeIds.forEach((edgeId) => {
        const edge = edgeById.get(Number(edgeId));
        if (!edge || Number(get(edge, "owner_seat_no", "ownerSeatNo", 0)) !== knightMoveSourceOwner) return;
        const vertexAId = Number(get(edge, "vertex_aid", "vertexAId", 0));
        const vertexBId = Number(get(edge, "vertex_bid", "vertexBId", 0));
        const nextId = vertexAId === currentId ? vertexBId : vertexBId === currentId ? vertexAId : 0;
        if (nextId && !visited.has(nextId)) {
          visited.add(nextId);
          frontier.push(nextId);
        }
      });
    }
    return false;
  }, [edgeById, knightMoveSource, knightMoveSourceOwner, selectedVertex, vertexById]);
  const selectedKnightCanMove = knightMoveSourceOwner === mySeatNo
    && knightMoveSourceActive
    && knightMoveSourceActivatedTurnNo !== turnNo
    && selectedVertexCanReceiveKnight
    && selectedKnightDestinationReachable
    && (selectedKnightMoveTargetOwner === 0 || (selectedKnightMoveTargetOwner !== mySeatNo && selectedKnightMoveTargetLevel < knightMoveSourceLevel));
  const selectedKnightCanChaseRobber = selectedOwnKnight
    && selectedKnightActive
    && selectedKnightActivatedTurnNo !== turnNo
    && selectedKnightTouchesRobber
    && selectedHexCanReceiveRobber
    && !citiesKnightsRobberLocked;
  const selectedTargetSummaryItems = [];
  if (selectedHex) {
    const producedResource = catanResourceByTerrain[selectedHexTerrain];
    const hexDetails = [
      catanTerrain[selectedHexTerrain]?.label || selectedHexTerrain || "타일",
      selectedHexToken > 0 ? `숫자 ${selectedHexToken}` : "숫자 없음",
    ];
    if (producedResource) hexDetails.push(`생산 ${catanResourceLabels[producedResource] || producedResource}`);
    if (!Boolean(get(selectedHex, "discovered", "discovered", true))) hexDetails.push("미발견");
    if (robberHexId === Number(selectedHex.id)) hexDetails.push("도적");
    if (pirateHexId === Number(selectedHex.id)) hexDetails.push("해적");
    if (selectedHexMissionType) hexDetails.push(catanMissionLabels[selectedHexMissionType] || selectedHexMissionType);
    if (selectedHexBarbarianCount > 0) hexDetails.push(`야만인 ${selectedHexBarbarianCount}`);

    selectedTargetSummaryItems.push({
      key: "hex",
      label: "선택 타일",
      value: hexDetails.join(" · "),
      tone: "border-sky-100 bg-sky-50 text-sky-700",
    });
  }
  if (selectedEdge) {
    const edgeDetails = [
      selectedEdgeRouteType ? catanRouteLabels[selectedEdgeRouteType] || selectedEdgeRouteType : "빈 간선",
    ];
    if (selectedEdgeOwner) edgeDetails.unshift(playerName(selectedEdgeOwner));
    if (Boolean(get(selectedEdge, "bridge_site", "bridgeSite", false)) && selectedEdgeRouteType !== "BRIDGE") edgeDetails.push("다리 자리");
    if (Boolean(get(selectedEdge, "camel", "camel", false))) edgeDetails.push("낙타");
    if (selectedEdgeCargoLabel !== "없음") edgeDetails.push(`화물 ${selectedEdgeCargoLabel}`);
    if (councilDockEdgeIds.map(Number).includes(Number(selectedEdge.id))) edgeDetails.push("의회 선착장");
    if (get(selectedEdge, "forgotten_tribe_gift_type", "forgottenTribeGiftType", "")) edgeDetails.push("부족 선물");

    selectedTargetSummaryItems.push({
      key: "edge",
      label: "선택 간선",
      value: edgeDetails.join(" · "),
      tone: "border-emerald-100 bg-emerald-50 text-emerald-700",
    });
  }
  if (selectedVertex) {
    const vertexDetails = [
      selectedVertexOwner
        ? `${playerName(selectedVertexOwner)} ${catanBuildingLabels[selectedVertexBuilding] || selectedVertexBuilding || "건물"}`
        : "빈 교차점",
    ];
    if (selectedVertexPortType) {
      vertexDetails.push(selectedVertexPortType === "ANY" ? "항구 3:1" : `${catanResourceLabels[selectedVertexPortType] || selectedVertexPortType} 항구 2:1`);
    }
    if (Boolean(get(selectedVertex, "city_wall", "cityWall", false))) vertexDetails.push("성벽");
    if (selectedKnightOwner) vertexDetails.push(`${playerName(selectedKnightOwner)} 기사 ${selectedKnightLevel}${selectedKnightActive ? " 활성" : " 비활성"}`);
    const vertexCargoLabel = cargoLabelOf(selectedVertex);
    if (vertexCargoLabel !== "없음") vertexDetails.push(`화물 ${vertexCargoLabel}`);
    if (selectedClothVillage) {
      const connectedSeatNos = get(selectedClothVillage, "connected_seat_nos", "connectedSeatNos", []) || [];
      const connectedText = connectedSeatNos.length ? connectedSeatNos.map(playerName).join(", ") : "없음";
      vertexDetails.push(`부족 마을 ${get(selectedClothVillage, "number_token", "numberToken", "-")} · 직물 ${get(selectedClothVillage, "supply", "supply", 0)}개 · 연결 ${connectedText}`);
    }

    selectedTargetSummaryItems.push({
      key: "vertex",
      label: "선택 교차점",
      value: vertexDetails.join(" · "),
      tone: "border-amber-100 bg-amber-50 text-amber-700",
    });
  }
  const hasSelectedTarget = selectedTargetSummaryItems.length > 0;
  const mySpiceAdvantageCounts = useMemo(() => {
    const counts = { SWIFT_VOYAGE: 0, PIRATE_BONUS: 0, FAST_GOLD: 0 };
    hexes.forEach((hex) => {
      const missionType = get(hex, "mission_type", "missionType", "");
      const advantageType = get(hex, "spice_advantage_type", "spiceAdvantageType", "");
      const crewSeatNos = get(hex, "crew_seat_nos", "crewSeatNos", []) || [];
      if (missionType === "SPICE" && counts[advantageType] !== undefined && crewSeatNos.map(Number).includes(mySeatNo)) {
        counts[advantageType] += 1;
      }
    });
    return counts;
  }, [hexes, mySeatNo]);
  const fastGoldUsed = Number(get(myPlayer, "fast_gold_sales_turn_no", "fastGoldSalesTurnNo", -1)) === turnNo
    ? Number(get(myPlayer, "fast_gold_sales_this_turn", "fastGoldSalesThisTurn", 0))
    : 0;
  const fastGoldRemaining = Math.max(0, mySpiceAdvantageCounts.FAST_GOLD - fastGoldUsed);
  const shipMoveMaxSteps = 4 + mySpiceAdvantageCounts.SWIFT_VOYAGE;
  const shipMoveMaxEdges = shipMoveMaxSteps + 1;

  useEffect(() => {
    if (!playableDevelopmentCards.some((card) => card.id === selectedCardId)) {
      setSelectedCardId(playableDevelopmentCards[0]?.id || "");
    }
  }, [playableDevelopmentCards, selectedCardId]);

  useEffect(() => {
    const selectableProgressCards = phase === "ACTION" ? actionProgressCards : progressCards;
    if (!selectableProgressCards.some((card) => card.id === selectedProgressCardId)) {
      setSelectedProgressCardId(selectableProgressCards[0]?.id || "");
    }
  }, [actionProgressCards, phase, progressCards, selectedProgressCardId]);

  useEffect(() => {
    setRoadCardEdges([]);
  }, [selectedProgressType, selectedDevCard?.type]);

  useEffect(() => {
    if (revealedSpyCards.some((card) => card.id === selectedSpyCardId)) {
      return;
    }
    setSelectedSpyCardId(revealedSpyCards[0]?.id || "");
  }, [revealedSpyCards, selectedSpyCardId]);

  useEffect(() => {
    if (catanTradeCardLabels[tradeForm.give] && catanTradeCardLabels[tradeForm.receive]) {
      return;
    }
    setTradeForm({
      give: catanTradeCardLabels[tradeForm.give] ? tradeForm.give : "BRICK",
      receive: catanTradeCardLabels[tradeForm.receive] ? tradeForm.receive : "LUMBER",
    });
  }, [catanTradeCardLabels, tradeForm.give, tradeForm.receive]);

  useEffect(() => {
    if (selectedProgressType === "MASTER_MERCHANT" || selectedProgressType === "SPY" || selectedProgressType === "DESERTER") {
      return;
    }
    if (!robberTargets.some((player) => Number(get(player, "seat_no", "seatNo", 0)) === Number(targetSeatNo))) {
      setTargetSeatNo(robberTargets[0] ? String(get(robberTargets[0], "seat_no", "seatNo", "")) : "");
    }
  }, [robberTargets, targetSeatNo, selectedProgressType]);

  const setupBuild = async () => {
    if (!selectedVertexId || !selectedEdgeId) {
      toast.error("정착지와 도로 위치를 선택해주세요.");
      return;
    }
    await onAction({ action_type: "SETUP_BUILD", vertex_id: selectedVertexId, edge_id: selectedEdgeId });
    setSelectedVertexId(null);
    setSelectedEdgeId(null);
  };

  const build = async () => {
    if (buildMode === "ROAD") {
      if (!selectedEdgeId) {
        toast.error("도로 위치를 선택해주세요.");
        return;
      }
      await onAction({ action_type: "BUILD_ROAD", edge_id: selectedEdgeId });
      setSelectedEdgeId(null);
      return;
    }
    if (buildMode === "BRIDGE") {
      if (!selectedEdgeId) {
        toast.error("다리를 놓을 강 간선을 선택해주세요.");
        return;
      }
      await onAction({ action_type: "BUILD_BRIDGE", edge_id: selectedEdgeId });
      setSelectedEdgeId(null);
      return;
    }
    if (buildMode === "SHIP") {
      if (!selectedEdgeId) {
        toast.error("배를 놓을 해상 간선을 선택해주세요.");
        return;
      }
      await onAction({ action_type: "BUILD_SHIP", edge_id: selectedEdgeId });
      setSelectedEdgeId(null);
      return;
    }
    if (buildMode === "MOVE_SHIP") {
      const path = explorersPiratesRule && shipMovePath.length >= 2 ? shipMovePath : [shipMoveFromEdgeId, selectedEdgeId].filter(Boolean);
      if (path.length < 2) {
        toast.error("이동할 배와 새 해상 간선을 선택해주세요.");
        return;
      }
      await onAction({ action_type: "MOVE_SHIP", edge_ids: path });
      setShipMoveFromEdgeId(null);
      setShipMovePath([]);
      setSelectedEdgeId(null);
      return;
    }
    if (buildMode === "KNIGHT") {
      if (!selectedVertexId) {
        toast.error("기사를 놓을 교차점을 선택해주세요.");
        return;
      }
      if (!selectedVertexCanBuildKnight) {
        toast.error(selectedVertexKnightBuildWarning || "기사 배치 조건을 확인해주세요.");
        return;
      }
      await onAction({ action_type: "BUILD_KNIGHT", vertex_id: selectedVertexId });
      setSelectedVertexId(null);
      return;
    }
    if (buildMode === "CITY_WALL") {
      if (!selectedVertexId) {
        toast.error("성벽을 세울 도시를 선택해주세요.");
        return;
      }
      await onAction({ action_type: "BUILD_CITY_WALL", vertex_id: selectedVertexId });
      setSelectedVertexId(null);
      return;
    }
    if (!selectedVertexId) {
      toast.error("교차점을 선택해주세요.");
      return;
    }
    const actionType = buildMode === "CITY"
      ? "BUILD_CITY"
      : buildMode === "HARBOR_SETTLEMENT"
        ? "BUILD_HARBOR_SETTLEMENT"
        : "BUILD_SETTLEMENT";
    await onAction({ action_type: actionType, vertex_id: selectedVertexId });
    setSelectedVertexId(null);
  };

  const moveRobber = async () => {
    if (!selectedHexId) {
      toast.error(explorersPiratesRule ? "해적을 보낼 바다 칸을 선택해주세요." : "도적을 옮길 타일을 선택해주세요.");
      return;
    }
    if (explorersPiratesRule && selectedHex?.terrain !== "SEA") {
      toast.error("E&P에서는 도적 대신 해적선을 바다 칸에 놓습니다.");
      return;
    }
    if (citiesKnightsRobberLocked) {
      toast.error("첫 야만인 침공 전에는 도적을 이동하지 않습니다.");
      return;
    }
    await onAction({
      action_type: selectedHex?.terrain === "SEA" ? "MOVE_PIRATE" : "MOVE_ROBBER",
      hex_id: selectedHexId,
      target_seat_no: targetSeatNo ? Number(targetSeatNo) : null,
    });
    setSelectedHexId(null);
    setTargetSeatNo("");
  };

  const maritimeTrade = async () => {
    if (tradeForm.give === tradeForm.receive) {
      toast.error("서로 다른 자원을 선택해주세요.");
      return;
    }
    if (!maritimeReceiveWithinBank) {
      toast.error("은행에 받을 자원이 부족합니다.");
      return;
    }
    await onAction({ action_type: "MARITIME_TRADE", resource_type: tradeForm.give, target_resource_type: tradeForm.receive });
  };

  const proposeDomesticTrade = async () => {
    const target = Number(domesticTradeTargetSeatNo);
    const offerResources = positiveResourceMap(domesticOfferForm);
    const requestResources = positiveResourceMap(domesticRequestForm);
    if (!target) {
      toast.error("거래할 플레이어를 선택해주세요.");
      return;
    }
    if (resourceMapTotal(offerResources) <= 0 || resourceMapTotal(requestResources) <= 0) {
      toast.error("줄 자원과 받을 자원을 각각 1개 이상 입력해주세요.");
      return;
    }
    if (domesticOfferExceeded) {
      toast.error("내가 가진 자원보다 많이 제안할 수 없습니다.");
      return;
    }
    await onAction({
      action_type: "PROPOSE_TRADE",
      target_seat_no: target,
      resources: offerResources,
      target_resources: requestResources,
    });
    setDomesticOfferForm(emptyCatanResourceCounts());
    setDomesticRequestForm(emptyCatanResourceCounts());
  };

  const respondDomesticTrade = async (actionType) => {
    await onAction({ action_type: actionType });
  };

  const buildSettler = async () => {
    const vertexBuilding = get(selectedVertex, "building_type", "buildingType", "");
    const edgeRoute = get(selectedEdge, "route_type", "routeType", "");
    if (vertexBuilding === "HARBOR_SETTLEMENT") {
      await onAction({ action_type: "BUILD_SETTLER", vertex_id: selectedVertexId });
      return;
    }
    if (edgeRoute === "SHIP") {
      await onAction({ action_type: "BUILD_SETTLER", edge_id: selectedEdgeId });
      return;
    }
    toast.error("항구 정착지나 빈 배를 선택해주세요.");
  };

  const loadSettler = async () => {
    if (!selectedVertexId || !selectedEdgeId) {
      toast.error("정착민이 있는 항구와 싣고 갈 배를 선택해주세요.");
      return;
    }
    await onAction({ action_type: "LOAD_SETTLER", vertex_id: selectedVertexId, edge_id: selectedEdgeId });
  };

  const buildCrew = async () => {
    const vertexBuilding = get(selectedVertex, "building_type", "buildingType", "");
    const edgeRoute = get(selectedEdge, "route_type", "routeType", "");
    if (vertexBuilding === "HARBOR_SETTLEMENT") {
      await onAction({ action_type: "BUILD_CREW", vertex_id: selectedVertexId });
      return;
    }
    if (edgeRoute === "SHIP") {
      await onAction({ action_type: "BUILD_CREW", edge_id: selectedEdgeId });
      return;
    }
    toast.error("승무원을 놓을 항구 정착지나 항구와 닿은 배를 선택해주세요.");
  };

  const unloadCrewToPirateLair = async () => {
    if (!selectedHexId || !selectedEdgeId) {
      toast.error("해적 소굴과 승무원이 탄 배를 선택해주세요.");
      return;
    }
    await onAction({ action_type: "UNLOAD_CREW_TO_PIRATE_LAIR", hex_id: selectedHexId, edge_id: selectedEdgeId });
  };

  const rollFishHaul = async () => {
    await onAction({ action_type: "ROLL_FISH_HAUL" });
  };

  const catchFish = async () => {
    if (!selectedHexId || !selectedEdgeId) {
      toast.error("어획물이 있는 어장과 비어 있는 배를 선택해주세요.");
      return;
    }
    await onAction({ action_type: "CATCH_FISH", hex_id: selectedHexId, edge_id: selectedEdgeId });
  };

  const spendFish = async (actionType, extra = {}) => {
    await onAction({ action_type: actionType, ...extra });
  };

  const collectSpice = async () => {
    if (!selectedHexId || !selectedEdgeId) {
      toast.error("향신료 마을과 승무원이 탄 배를 선택해주세요.");
      return;
    }
    await onAction({ action_type: "COLLECT_SPICE", hex_id: selectedHexId, edge_id: selectedEdgeId });
  };

  const sellResourceForGold = async () => {
    if (fastGoldRemaining <= 0) {
      toast.error("이번 턴에 사용할 빠른 금 이점이 없습니다.");
      return;
    }
    await onAction({ action_type: "SELL_RESOURCE_FOR_GOLD", resource_type: tradeForm.give });
  };

  const spendGoldForResource = async () => {
    if (myGold < 2 || riverGoldTradesRemaining <= 0) {
      toast.error("골드 2개와 남은 교환 횟수를 확인해주세요.");
      return;
    }
    await onAction({ action_type: "SPEND_GOLD_FOR_RESOURCE", resource_type: tradeForm.receive });
  };

  const bidCamel = async () => {
    const wool = Math.max(0, Number(camelBidForm.WOOL) || 0);
    const grain = Math.max(0, Number(camelBidForm.GRAIN) || 0);
    await onAction({ action_type: "BID_CAMEL", resources: { WOOL: wool, GRAIN: grain } });
  };

  const placeCamel = async () => {
    if (!selectedEdgeId) {
      toast.error("낙타를 놓을 경로를 선택해주세요.");
      return;
    }
    await onAction({ action_type: "PLACE_CAMEL", edge_id: selectedEdgeId });
    setSelectedEdgeId(null);
  };

  const recruitBarbarianKnight = async () => {
    if (!selectedDevCard || selectedDevCard.type !== "KNIGHT") {
      toast.error("사용할 기사 개발 카드를 선택해주세요.");
      return;
    }
    if (!selectedEdgeId) {
      toast.error("방어 기사를 놓을 경로를 선택해주세요.");
      return;
    }
    await onAction({ action_type: "RECRUIT_BARBARIAN_KNIGHT", card_ids: [selectedDevCard.id], edge_id: selectedEdgeId });
    setSelectedEdgeId(null);
  };

  const expelBarbarians = async () => {
    if (!selectedHexId) {
      toast.error("격퇴할 야만인 타일을 선택해주세요.");
      return;
    }
    await onAction({ action_type: "EXPEL_BARBARIANS", hex_id: selectedHexId });
    setSelectedHexId(null);
  };

  const chaseAwayPirate = async () => {
    if (!selectedHexId) {
      toast.error("해적을 보낼 바다 칸을 선택해주세요.");
      return;
    }
    await onAction({ action_type: "CHASE_AWAY_PIRATE", hex_id: selectedHexId });
  };

  const transferCargo = async () => {
    if (!selectedVertexId || !selectedEdgeId) {
      toast.error("항구 정착지와 맞닿은 배를 선택해주세요.");
      return;
    }
    await onAction({ action_type: "TRANSFER_CARGO", vertex_id: selectedVertexId, edge_id: selectedEdgeId });
  };

  const deliverCargo = async () => {
    if (!selectedEdgeId) {
      toast.error("의회 선착장에 닿은 화물 실은 배를 선택해주세요.");
      return;
    }
    const cargoType = cargoTypesOf(selectedEdge).find((type) => type === "FISH" || type === "SPICE");
    if (!cargoType) {
      toast.error("납품할 어획물이나 향신료가 실린 배를 선택해주세요.");
      return;
    }
    await onAction({ action_type: "DELIVER_CARGO", edge_id: selectedEdgeId, resource_type: cargoType });
  };

  const foundSettlementFromShip = async () => {
    if (!selectedVertexId || !selectedEdgeId) {
      toast.error("정착민 배와 상륙할 교차점을 선택해주세요.");
      return;
    }
    await onAction({ action_type: "FOUND_SETTLEMENT_FROM_SHIP", vertex_id: selectedVertexId, edge_id: selectedEdgeId });
    setSelectedVertexId(null);
    setSelectedEdgeId(null);
  };

  const discardResources = async () => {
    if (discardTotal !== discardRequired) {
      toast.error(`${discardRequired}장을 정확히 버려야 합니다.`);
      return;
    }
    await onAction({ action_type: "DISCARD_RESOURCES", resources: discardForm, commodities: discardCommodityForm });
    setDiscardForm({ BRICK: 0, LUMBER: 0, WOOL: 0, GRAIN: 0, ORE: 0 });
    setDiscardCommodityForm({ PAPER: 0, CLOTH: 0, COIN: 0 });
  };

  const discardProgressCard = async () => {
    const card = nonVictoryProgressCards.find((item) => item.id === selectedDiscardProgressCardId);
    if (!card) {
      toast.error("버릴 진행 카드를 선택해주세요.");
      return;
    }
    await onAction({ action_type: "DISCARD_PROGRESS_CARD", card_ids: [card.id] });
  };

  const chooseGoldResources = async () => {
    if (!myGoldChoice) return;
    if (goldTotal !== goldRequired) {
      toast.error(`${goldRequired}장을 정확히 선택해주세요.`);
      return;
    }
    if (!goldChoiceWithinBank) {
      toast.error("은행에 선택한 자원이 부족합니다.");
      return;
    }
    await onAction({ action_type: "CHOOSE_GOLD_RESOURCE", resources: goldForm });
    setGoldForm({ BRICK: 0, LUMBER: 0, WOOL: 0, GRAIN: 0, ORE: 0 });
  };

  const chooseAqueductResource = async () => {
    if (!myAqueductChoice) return;
    if (!aqueductWithinBank) {
      toast.error("은행에 선택한 자원이 부족합니다.");
      return;
    }
    await onAction({ action_type: "CHOOSE_AQUEDUCT_RESOURCE", resource_type: selectedAqueductResourceType });
  };

  const chooseMasterMerchantCards = async () => {
    if (pendingMasterMerchantAttackerSeatNo !== mySeatNo) return;
    if (masterMerchantTotal !== pendingMasterMerchantCount) {
      toast.error(`${pendingMasterMerchantCount}장을 정확히 선택해주세요.`);
      return;
    }
    await onAction({ action_type: "CHOOSE_MASTER_MERCHANT_CARDS", resources: masterMerchantResources, commodities: masterMerchantCommodities });
    setMasterMerchantResources({ BRICK: 0, LUMBER: 0, WOOL: 0, GRAIN: 0, ORE: 0 });
    setMasterMerchantCommodities({ PAPER: 0, CLOTH: 0, COIN: 0 });
  };

  const chooseSpyProgressCard = async () => {
    if (!selectedSpyCard) {
      toast.error("가져올 진행 카드를 선택해주세요.");
      return;
    }
    await onAction({ action_type: "CHOOSE_SPY_PROGRESS_CARD", card_ids: [selectedSpyCard.id] });
  };

  const chooseDefenderProgressCard = async () => {
    if (!mustChooseDefenderProgress) {
      toast.error("방어자 진행 카드를 고를 차례가 아닙니다.");
      return;
    }
    await onAction({ action_type: "CHOOSE_DEFENDER_PROGRESS_CARD", improvement_type: selectedImprovementType });
  };

  const respondWeddingCards = async () => {
    if (!mustRespondWedding) return;
    if (weddingTotal !== weddingRequired) {
      toast.error(`${weddingRequired}장을 정확히 선택해주세요.`);
      return;
    }
    await onAction({ action_type: "RESPOND_WEDDING_CARDS", resources: weddingResources, commodities: weddingCommodities });
    setWeddingResources({ BRICK: 0, LUMBER: 0, WOOL: 0, GRAIN: 0, ORE: 0 });
    setWeddingCommodities({ PAPER: 0, CLOTH: 0, COIN: 0 });
  };

  const buyDevelopmentCard = async () => {
    await onAction({ action_type: "BUY_DEVELOPMENT_CARD" });
  };

  const addRoadCardEdge = () => {
    if (!selectedEdgeId) {
      toast.error("도로 카드로 놓을 간선을 선택해주세요.");
      return;
    }
    setRoadCardEdges((prev) => [...prev.filter((edgeId) => edgeId !== selectedEdgeId), selectedEdgeId].slice(-2));
  };

  const addProgressHex = () => {
    if (!selectedHexId) {
      toast.error("진행 카드에 사용할 타일을 선택해주세요.");
      return;
    }
    setRoadCardEdges((prev) => [...prev.filter((hexId) => hexId !== selectedHexId), selectedHexId].slice(-2));
  };

  const playDevelopmentCard = async () => {
    if (!selectedDevCard) {
      toast.error("사용할 개발 카드를 선택해주세요.");
      return;
    }
    const cardType = selectedDevCard.type;
    const payload = {
      action_type: "PLAY_DEVELOPMENT_CARD",
      card_ids: [selectedDevCard.id],
    };
    if (cardType === "KNIGHT") {
      if (!selectedHexId) {
        toast.error("기사가 이동시킬 도적 타일을 선택해주세요.");
        return;
      }
      payload.hex_id = selectedHexId;
      payload.target_seat_no = targetSeatNo ? Number(targetSeatNo) : null;
    }
    if (cardType === "ROAD_BUILDING") {
      if (!roadCardEdges.length) {
        toast.error("도로 건설 카드로 놓을 간선을 추가해주세요.");
        return;
      }
      payload.edge_ids = roadCardEdges;
    }
    if (cardType === "YEAR_OF_PLENTY") {
      if (!yearOfPlentyWithinBank) {
        toast.error("은행에 선택한 자원이 부족합니다.");
        return;
      }
      payload.resource_type = tradeForm.give;
      payload.target_resource_type = tradeForm.receive;
    }
    if (cardType === "MONOPOLY") {
      payload.resource_type = tradeForm.give;
    }
    await onAction(payload);
    setSelectedHexId(null);
    setTargetSeatNo("");
    setRoadCardEdges([]);
  };

  const playAlchemistCard = async () => {
    if (!selectedAlchemistCardId) {
      toast.error("연금술사 카드를 선택해주세요.");
      return;
    }
    await onAction({
      action_type: "PLAY_PROGRESS_CARD",
      card_ids: [selectedAlchemistCardId],
      anchor_x: Number(alchemistDice.red),
      anchor_y: Number(alchemistDice.white),
    });
  };

  const activateKnight = async () => {
    if (!selectedOwnKnight) {
      toast.error("내 기사를 선택해주세요.");
      return;
    }
    await onAction({ action_type: "ACTIVATE_KNIGHT", vertex_id: selectedVertexId });
  };

  const promoteKnight = async () => {
    if (!selectedOwnKnight) {
      toast.error("내 기사를 선택해주세요.");
      return;
    }
    if (!selectedKnightCanPromote) {
      toast.error("강한 기사를 최강 기사로 승급하려면 정치 3단계 요새가 필요합니다.");
      return;
    }
    await onAction({ action_type: "PROMOTE_KNIGHT", vertex_id: selectedVertexId });
  };

  const markKnightMoveSource = () => {
    if (!selectedOwnKnight) {
      toast.error("이동할 내 기사를 선택해주세요.");
      return;
    }
    if (!selectedKnightActive) {
      toast.error("활성화된 기사만 이동할 수 있습니다.");
      return;
    }
    if (selectedKnightActivatedTurnNo === turnNo) {
      toast.error("이번 턴에 활성화한 기사는 다음 턴부터 행동할 수 있습니다.");
      return;
    }
    setKnightMoveSourceId(selectedVertexId);
    toast.success("기사 이동 출발점을 지정했습니다.");
  };

  const moveKnight = async () => {
    if (!knightMoveSourceId) {
      toast.error("이동할 기사의 출발점을 먼저 지정해주세요.");
      return;
    }
    if (!selectedVertexId) {
      toast.error("기사가 이동할 교차점을 선택해주세요.");
      return;
    }
    if (!selectedKnightCanMove) {
      toast.error("내 도로망으로 실제 연결된 빈 교차점이나 더 약한 상대 기사만 선택할 수 있습니다.");
      return;
    }
    await onAction({
      action_type: "MOVE_KNIGHT",
      vertex_id: Number(knightMoveSourceId),
      target_vertex_id: Number(selectedVertexId),
    });
    setKnightMoveSourceId(null);
    setSelectedVertexId(null);
  };

  const chaseRobberWithKnight = async () => {
    if (citiesKnightsRobberLocked) {
      toast.error("첫 야만인 침공 전에는 기사로 도적을 쫓아낼 수 없습니다.");
      return;
    }
    if (!selectedOwnKnight) {
      toast.error("도적과 닿아 있는 내 기사를 선택해주세요.");
      return;
    }
    if (!selectedKnightActive) {
      toast.error("활성화된 기사만 도적을 쫓아낼 수 있습니다.");
      return;
    }
    if (selectedKnightActivatedTurnNo === turnNo) {
      toast.error("이번 턴에 활성화한 기사는 다음 턴부터 행동할 수 있습니다.");
      return;
    }
    if (!selectedKnightTouchesRobber) {
      toast.error("도적과 닿아 있는 기사를 선택해주세요.");
      return;
    }
    if (!selectedHexCanReceiveRobber) {
      toast.error("도적을 옮길 숫자 타일을 선택해주세요.");
      return;
    }
    await onAction({
      action_type: "CHASE_ROBBER_WITH_KNIGHT",
      vertex_id: selectedVertexId,
      hex_id: selectedHexId,
      target_seat_no: targetSeatNo ? Number(targetSeatNo) : null,
    });
    setSelectedHexId(null);
    setTargetSeatNo("");
  };

  const moveDisplacedKnight = async () => {
    if (!mustMoveDisplacedKnight) {
      toast.error("밀려난 기사를 옮길 차례가 아닙니다.");
      return;
    }
    if (!selectedVertexId) {
      toast.error("밀려난 기사가 이동할 빈 교차점을 선택해주세요.");
      return;
    }
    await onAction({ action_type: "MOVE_DISPLACED_KNIGHT", vertex_id: selectedVertexId });
    setSelectedVertexId(null);
  };

  const removeDeserterKnight = async () => {
    if (phase !== "DESERTER_REMOVE" || pendingDeserterTargetSeatNo !== mySeatNo) {
      toast.error("탈영할 기사를 고를 차례가 아닙니다.");
      return;
    }
    if (!selectedVertexId || selectedKnightOwner !== mySeatNo) {
      toast.error("제거할 내 기사를 선택해주세요.");
      return;
    }
    await onAction({ action_type: "REMOVE_DESERTER_KNIGHT", vertex_id: selectedVertexId });
    setSelectedVertexId(null);
  };

  const placeDeserterKnight = async () => {
    if (phase !== "DESERTER_PLACE" || pendingDeserterAttackerSeatNo !== mySeatNo) {
      toast.error("탈영 기사를 배치할 차례가 아닙니다.");
      return;
    }
    if (!selectedVertexId) {
      toast.error("탈영 기사를 배치할 정점을 선택해주세요.");
      return;
    }
    await onAction({ action_type: "PLACE_DESERTER_KNIGHT", vertex_id: selectedVertexId });
    setSelectedVertexId(null);
  };

  const moveIntrigueKnight = async () => {
    if (phase !== "INTRIGUE_MOVE" || pendingIntrigueTargetSeatNo !== mySeatNo) {
      toast.error("음모로 밀려난 기사를 옮길 차례가 아닙니다.");
      return;
    }
    if (!selectedVertexId) {
      toast.error("기사를 옮길 정점을 선택해주세요.");
      return;
    }
    await onAction({ action_type: "MOVE_INTRIGUE_KNIGHT", vertex_id: selectedVertexId });
    setSelectedVertexId(null);
  };

  const respondCommercialHarbor = async () => {
    if (phase !== "COMMERCIAL_HARBOR" || !pendingCommercialHarborSeatNos.map(Number).includes(mySeatNo)) {
      toast.error("상업 항구 응답 차례가 아닙니다.");
      return;
    }
    if (!commodities?.[selectedCommodityType]) {
      toast.error("줄 상품을 선택해주세요.");
      return;
    }
    await onAction({ action_type: "RESPOND_COMMERCIAL_HARBOR", resource_type: selectedCommodityType });
  };

  const buildCityImprovement = async () => {
    await onAction({ action_type: "BUILD_CITY_IMPROVEMENT", improvement_type: selectedImprovementType });
  };

  const playProgressCard = async () => {
    if (!selectedProgressCard) {
      toast.error("사용할 진행 카드를 선택해주세요.");
      return;
    }
    if (!selectedProgressSupported) {
      toast.error("현재 단계에서 사용할 수 없는 진행 카드입니다.");
      return;
    }
    const payload = {
      action_type: "PLAY_PROGRESS_CARD",
      card_ids: [selectedProgressCard.id],
    };
    if (selectedProgressType === "ALCHEMIST") {
      toast.error("연금술사는 주사위 단계에서만 사용할 수 있습니다.");
      return;
    }
    if (selectedProgressType === "ENGINEER") {
      if (!selectedVertexId) {
        toast.error("성벽을 세울 도시를 선택해주세요.");
        return;
      }
      payload.vertex_id = selectedVertexId;
    }
    if (selectedProgressType === "MEDICINE") {
      if (!selectedVertexId) {
        toast.error("도시로 올릴 마을을 선택해주세요.");
        return;
      }
      payload.vertex_id = selectedVertexId;
    }
    if (selectedProgressType === "CRANE") {
      payload.improvement_type = selectedImprovementType;
    }
    if (selectedProgressType === "INVENTOR") {
      if (roadCardEdges.length < 2) {
        toast.error("숫자 토큰을 바꿀 타일 2개를 추가해주세요.");
        return;
      }
      payload.edge_ids = roadCardEdges;
    }
    if (selectedProgressType === "INTRIGUE") {
      if (!selectedVertexId || !selectedKnightOwner || selectedKnightOwner === mySeatNo) {
        toast.error("내 도로에 닿은 상대 기사를 선택해주세요.");
        return;
      }
      payload.vertex_id = selectedVertexId;
    }
    if (selectedProgressType === "BISHOP") {
      if (citiesKnightsRobberLocked) {
        toast.error("주교는 첫 야만인 침공 후부터 사용할 수 있습니다.");
        return;
      }
      if (!selectedHexId || selectedHex?.terrain === "SEA") {
        toast.error("주교로 옮길 육지 타일을 선택해주세요.");
        return;
      }
      payload.hex_id = selectedHexId;
    }
    if (selectedProgressType === "COMMERCIAL_HARBOR") {
      payload.resource_type = tradeForm.give;
    }
    if (selectedProgressType === "DESERTER") {
      const target = targetSeatNo ? Number(targetSeatNo) : Number(get(deserterTargets[0], "seat_no", "seatNo", 0));
      if (!target) {
        toast.error("탈영시킬 상대를 선택해주세요.");
        return;
      }
      payload.target_seat_no = target;
    }
    if (selectedProgressType === "MASTER_MERCHANT") {
      const target = targetSeatNo ? Number(targetSeatNo) : Number(get(richerPlayers[0], "seat_no", "seatNo", 0));
      if (!target) {
        toast.error("대상 플레이어를 선택해주세요.");
        return;
      }
      payload.target_seat_no = target;
    }
    if (selectedProgressType === "MERCHANT") {
      if (!selectedHexId || !catanResourceByTerrain[selectedHex?.terrain]) {
        toast.error("상인을 놓을 생산 타일을 선택해주세요.");
        return;
      }
      payload.hex_id = selectedHexId;
    }
    if (selectedProgressType === "MERCHANT_FLEET") {
      payload.resource_type = tradeForm.give;
    }
    if (selectedProgressType === "SPY") {
      const target = targetSeatNo ? Number(targetSeatNo) : Number(get(spyTargets[0], "seat_no", "seatNo", 0));
      if (!target) {
        toast.error("진행 카드를 가져올 플레이어를 선택해주세요.");
        return;
      }
      payload.target_seat_no = target;
    }
    if (selectedProgressType === "ROAD_BUILDING") {
      if (!roadCardEdges.length) {
        toast.error("도로 건설 카드로 놓을 간선을 추가해주세요.");
        return;
      }
      payload.edge_ids = roadCardEdges;
    }
    if (selectedProgressType === "DIPLOMAT") {
      if (!roadCardEdges.length) {
        toast.error("외교관으로 제거할 열린 도로를 추가해주세요.");
        return;
      }
      payload.edge_ids = roadCardEdges;
    }
    if (selectedProgressType === "RESOURCE_MONOPOLY") {
      payload.resource_type = tradeForm.give;
    }
    if (selectedProgressType === "TRADE_MONOPOLY") {
      payload.resource_type = selectedCommodityType;
    }
    await onAction(payload);
    setRoadCardEdges([]);
    setSelectedVertexId(null);
  };

  const clearSelectedTargets = () => {
    setSelectedHexId(null);
    setSelectedEdgeId(null);
    setSelectedVertexId(null);
  };

  const pairedTurnOneStatus = phase === "SETUP"
    ? "첫 주사위"
    : activeSeatNo === catanianOneSeatNo
      ? phase === "ROLL" ? "주사위/행동" : "행동 중"
      : "대기";
  const pairedTurnTwoStatus = phase === "SETUP"
    ? "후속 행동"
    : activeSeatNo === catanianTwoSeatNo
      ? "행동 중"
      : "대기";
  const pairedTurnHint = phase === "SETUP"
    ? "초기 배치가 끝나면 카타니안 1이 주사위를 굴리고 행동한 뒤, 카타니안 2가 같은 라운드의 후속 행동을 합니다."
    : activeSeatNo === catanianTwoSeatNo
      ? "카타니안 2의 행동이 끝나면 두 표식이 한 칸씩 왼쪽으로 이동합니다."
      : "카타니안 1이 주사위와 행동을 마치면 카타니안 2가 바로 행동합니다.";
  const pairedTurnMyRole = mySeatNo === catanianOneSeatNo
    ? "내 표식은 카타니안 1입니다."
    : mySeatNo === catanianTwoSeatNo
      ? "내 표식은 카타니안 2입니다."
      : "내 차례가 아니면 다음 표식 이동을 기다립니다.";
  const pairedTurnActionNotice = phase === "SETUP"
    ? "초기 배치 중에는 일반 카탄 순서를 따르고, 본게임 시작 후 표식이 적용됩니다."
    : activeSeatNo === catanianTwoSeatNo
      ? "카타니안 2는 주사위를 굴리지 않고 후속 행동만 진행합니다. 종료하면 표식이 이동합니다."
      : activeSeatNo === catanianOneSeatNo
        ? phase === "ROLL"
          ? "카타니안 1이 주사위를 굴린 뒤 행동을 진행합니다."
          : "카타니안 1이 턴을 종료하면 카타니안 2가 바로 후속 행동을 합니다."
        : "다른 플레이어 턴입니다. 현재 표식과 다음 이동 순서를 확인하세요.";
  const catanPhaseLabel = phase === "SETUP" ? "초기 배치"
    : phase === "ROLL" ? "주사위 단계"
      : phase === "DISCARD" ? "자원 버리기"
        : phase === "PROGRESS_DISCARD" ? "진행 카드 버리기"
          : phase === "DEFENDER_PROGRESS_CHOICE" ? "방어자 카드 선택"
            : phase === "GOLD_CHOICE" ? "금광 자원 선택"
              : phase === "AQUEDUCT_CHOICE" ? "수로 자원 선택"
                : phase === "ROBBER" ? (explorersPiratesRule ? "해적 이동" : "도적 이동")
                  : phase === "COMMERCIAL_HARBOR" ? "상업 항구 응답"
                    : phase === "MASTER_MERCHANT_CHOOSE" ? "대상인 카드 선택"
                      : phase === "SPY_CHOOSE" ? "첩자 카드 선택"
                        : phase === "WEDDING_GIVE" ? "혼례 카드 제공"
                          : phase === "DESERTER_REMOVE" ? "탈영 기사 선택"
                            : phase === "DESERTER_PLACE" ? "탈영 기사 배치"
                              : phase === "INTRIGUE_MOVE" ? "음모 기사 이동"
                                : phase === "DISPLACED_KNIGHT_MOVE" ? "밀려난 기사 이동"
                                  : phase === "CAMEL_BID" ? "낙타 입찰"
                                    : phase === "PLACE_CAMEL" ? "낙타 배치"
                                      : phase === "FINISHED" ? "게임 종료"
                                        : "건설과 교환";
  const catanTurnGuidance = (() => {
    if (phase === "FINISHED") {
      return winnerSeatNo > 0 ? `${playerName(winnerSeatNo)} 승리, 최종 ${winnerVictoryPoints}점입니다.` : "게임이 종료되었습니다.";
    }
    if (phase === "SETUP") {
      return myTurn ? "정점과 이어진 간선을 선택한 뒤 초기 배치를 진행하세요." : `${playerName(activeSeatNo)}의 초기 배치를 기다리는 중입니다.`;
    }
    if (phase === "ROLL") {
      if (!myTurn) return `${playerName(activeSeatNo)}의 주사위 단계를 기다리는 중입니다.`;
      if (!citiesKnightsRule && !explorersPiratesRule && playableDevelopmentCards.length > 0) {
        return "주사위를 굴리기 전에 사용 가능한 개발 카드를 먼저 쓸 수 있습니다.";
      }
      return "주사위를 굴려 생산을 진행하세요.";
    }
    if (phase === "DISCARD") {
      return mustDiscard ? `${discardRequired}장을 정확히 골라 버려야 도둑 단계로 넘어갑니다.` : "자원을 버려야 하는 플레이어를 기다리는 중입니다.";
    }
    if (phase === "ROBBER") {
      return myTurn ? `${explorersPiratesRule ? "해적" : "도적"}을 옮길 타일을 선택하고, 훔칠 대상이 있으면 함께 고르세요.` : `${playerName(activeSeatNo)}의 ${explorersPiratesRule ? "해적" : "도적"} 이동을 기다리는 중입니다.`;
    }
    if (phase === "GOLD_CHOICE") {
      return myGoldChoice ? `${goldRequired}장의 자원을 선택하세요. 은행 잔량이 부족한 조합은 사용할 수 없습니다.` : "금광 보상을 선택할 플레이어를 기다리는 중입니다.";
    }
    if (phase === "AQUEDUCT_CHOICE") {
      return myAqueductChoice ? "받을 자원 1장을 선택하세요. 은행에 남은 자원만 선택할 수 있습니다." : "수로 보상을 선택할 플레이어를 기다리는 중입니다.";
    }
    if (phase === "ACTION") {
      if (pendingDomesticTrade) {
        if (pendingTradeTargetSeatNo === mySeatNo) return "거래 제안을 확인하고 수락 또는 거절을 선택하세요.";
        if (pendingTradeProposerSeatNo === mySeatNo) return "상대의 응답을 기다리거나 제안을 취소할 수 있습니다.";
        return "진행 중인 플레이어 거래가 마무리될 때까지 새 거래는 잠시 보류됩니다.";
      }
      if (!myTurn) return `${playerName(activeSeatNo)}의 행동 단계를 기다리는 중입니다.`;
      if (selectedEdgeId && ["ROAD", "BRIDGE", "SHIP", "MOVE_SHIP"].includes(buildMode)) {
        return "선택한 간선으로 건설 또는 이동 액션을 실행할 수 있습니다.";
      }
      if (selectedVertexId && ["SETTLEMENT", "CITY", "HARBOR_SETTLEMENT", "KNIGHT", "CITY_WALL"].includes(buildMode)) {
        return "선택한 정점으로 건설 또는 기사 액션을 실행할 수 있습니다.";
      }
      return "건설, 교환, 개발 카드 사용을 진행한 뒤 턴을 종료하세요.";
    }
    return myTurn ? "필요한 보드 대상을 선택하고 표시된 액션을 진행하세요." : `${playerName(activeSeatNo)}의 처리를 기다리는 중입니다.`;
  })();
  const catanQuickFacts = [
    { label: "단계", value: catanPhaseLabel },
    { label: "차례", value: phase === "FINISHED" ? "종료" : myTurn ? "내 차례" : playerName(activeSeatNo) },
    { label: "목표", value: `${winningPoints}점` },
    { label: "선택", value: hasSelectedTarget ? `${selectedTargetSummaryItems.length}곳` : "없음" },
  ];

  const renderPairedTurnSummary = () => pairedTurnRule && (
    <div className="mb-3 grid gap-2 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-xs font-bold text-amber-800 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.15fr_1.35fr]" role="status" aria-live="polite" aria-atomic="true">
      <div>
        <span className="font-black">카타니안 1</span> · {playerName(catanianOneSeatNo)}
        <span className={`ml-2 ${activeSeatNo === catanianOneSeatNo && phase !== "SETUP" ? "text-amber-700" : "text-amber-600"}`}>
          {pairedTurnOneStatus}
        </span>
      </div>
      <div>
        <span className="font-black">카타니안 2</span> · {playerName(catanianTwoSeatNo)}
        <span className={`ml-2 ${activeSeatNo === catanianTwoSeatNo && phase !== "SETUP" ? "text-lime-700" : "text-amber-600"}`}>
          {pairedTurnTwoStatus}
        </span>
      </div>
      <div className="leading-relaxed text-amber-700">{pairedTurnHint}</div>
      <div className="rounded-xl bg-white/70 px-3 py-2 leading-relaxed text-amber-900">
        <span className="font-black">내 역할</span> · {pairedTurnMyRole}
        <span className="mt-1 block text-amber-700">{pairedTurnActionNotice}</span>
      </div>
    </div>
  );

  const renderSelectedTargetSummary = ({ className = "", surfaceClassName = "bg-slate-50", showActionJump = false } = {}) => (
    <div className={`rounded-2xl border border-slate-200 ${surfaceClassName} p-3 ${className}`} role="status" aria-live="polite" aria-atomic="true">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-black text-slate-900">선택한 보드 대상</div>
        <div className="flex flex-wrap gap-1.5">
          {showActionJump && (
            <a
              href="#catan-action-panel"
              className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-black text-white shadow-sm"
            >
              액션 보기
            </a>
          )}
          {hasSelectedTarget && (
            <button
              type="button"
              className="min-h-0 rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-500 shadow-sm"
              onClick={clearSelectedTargets}
            >
              초기화
            </button>
          )}
        </div>
      </div>
      {hasSelectedTarget ? (
        <div className="grid gap-1.5">
          {selectedTargetSummaryItems.map((item) => (
            <div key={item.key} className={`rounded-xl border px-3 py-2 text-[11px] font-bold leading-relaxed ${item.tone}`}>
              <span className="mr-1 font-black">{item.label}</span>
              {item.value}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl bg-white px-3 py-2 text-[11px] font-bold leading-relaxed text-slate-500">
          보드의 타일, 간선, 정점을 선택하면 이곳에 대상 정보와 공식 규칙에 필요한 단서가 표시됩니다.
        </div>
      )}
    </div>
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <div id="catan-board-panel" className="scroll-mt-24 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-black text-slate-500">카탄</div>
              <div className="text-xl font-black text-slate-900">
                {catanPhaseLabel}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-black">
              <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700" role="status" aria-live="polite" aria-atomic="true">
                {phase === "FINISHED" ? `승자 ${playerName(winnerSeatNo)}` : `현재 ${playerName(activeSeatNo)}`}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">목표 {winningPoints}점</span>
              {!!lastRoll && <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-700">최근 {lastRoll}</span>}
            </div>
          </div>
          <div className="mb-3 rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-sky-50 p-3 shadow-sm" role="status" aria-live="polite" aria-atomic="true">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-2xl bg-amber-600 p-2 text-white shadow-sm">
                <Dices className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-black text-amber-700">지금 할 일</div>
                <div className="mt-0.5 text-sm font-black leading-relaxed text-slate-900">{catanTurnGuidance}</div>
                <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {catanQuickFacts.map((item) => (
                    <div key={item.label} className="rounded-xl bg-white/80 px-2.5 py-2">
                      <div className="text-[10px] font-bold text-slate-400">{item.label}</div>
                      <div className="truncate text-[11px] font-black text-slate-700">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div data-smoke="catan-rule-brief" className={`mb-3 rounded-2xl border p-3 shadow-sm ${catanRuleBrief.tone}`}>
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="mt-0.5 rounded-2xl bg-white/75 p-2 shadow-sm">
                  <Shield className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-black opacity-75">선택 규칙</div>
                  <div className="text-sm font-black leading-snug">{catanRuleBrief.title}</div>
                </div>
              </div>
            </div>
            <div className="mt-2 text-xs font-bold leading-relaxed opacity-90">{catanRuleBrief.summary}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {catanRuleBrief.chips.map((chip) => (
                <span key={chip} className={`rounded-full px-2.5 py-1 text-[10px] font-black ${catanRuleBrief.chipTone}`}>
                  {chip}
                </span>
              ))}
            </div>
          </div>
          {phase === "FINISHED" && winnerSeatNo > 0 && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-black text-amber-900">
                <Crown className="h-4 w-4 text-amber-500" />
                최종 승자 · {playerName(winnerSeatNo)}
              </div>
              <div className="text-xs font-black text-amber-700">
                {winnerVictoryPoints} / {winningPoints}점
              </div>
            </div>
          )}
          {renderPairedTurnSummary()}
          {friendlyRobberRule && (
            <div className="mb-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
              친절한 도둑 적용 · 공개 승점 2점 이하 플레이어의 건물 옆으로 도둑을 옮길 수 없고, 이동할 곳이 없으면 사막으로 갑니다.
            </div>
          )}
          {fishermenRule && (
            <div className="mb-3 rounded-2xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800">
              카탄의 낚시꾼 · 낚시터 숫자가 나오면 물고기 토큰을 얻고, 물고기 시장에서 보너스로 사용할 수 있습니다.
            </div>
          )}
          {riversRule && (
            <div className="mb-3 rounded-2xl border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-800">
              카탄의 강 · 강가에 길이나 마을을 지으면 골드를 얻고, 골드가 가장 많은 플레이어는 부유한 정착민 보너스를 받습니다.
            </div>
          )}
          {caravansRule && (
            <div className="mb-3 rounded-2xl border border-orange-100 bg-orange-50 px-3 py-2 text-xs font-bold text-orange-800">
              대상단 · 마을이나 도시를 지은 턴 끝에 양털/곡물로 낙타 배치권을 입찰합니다. 낙타가 놓인 길은 최장 교역로에서 2칸으로 세고, 낙타 2개 사이의 건물은 승점 1점을 더 얻습니다.
            </div>
          )}
          {fogIslandsRule && (
            <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
              안개 섬 · 배나 도로가 미탐험 교차점에 닿으면 안개 타일이 공개됩니다. 육지 발견 시 해당 자원 1장을 받고, 금광은 자원 선택 단계로 이어집니다. 남은 안개 {hiddenFogCount}개
            </div>
          )}
          {throughDesertRule && (
            <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
              사막을 지나서 · 초기 배치는 본섬에서만 시작합니다. 사막 너머 육지대와 작은 섬은 외국 지역이며, 각 지역 첫 마을마다 특별 승점 2점을 받습니다.
            </div>
          )}
          {forgottenTribeRule && (
            <div className="mb-3 rounded-2xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-bold text-teal-800">
              잊힌 부족 · 작은 부족 섬에는 정착할 수 없습니다. 배가 선물 표식이 있는 해안에 닿으면 승점, 개발 카드, 항구 중 하나를 받고 13점으로 끝납니다.
            </div>
          )}
          {clothForCatanRule && (
            <div className="mb-3 grid gap-2 rounded-2xl border border-fuchsia-100 bg-fuchsia-50 p-3 text-xs font-bold text-fuchsia-800 sm:grid-cols-[1.2fr_0.8fr]">
              <div>
                카탄에 천을 · 부족 마을과 배로 연결하면 직물을 받고, 해당 숫자가 나오면 연결된 플레이어에게 직물이 생산됩니다. 직물 2개마다 승점 1점입니다.
              </div>
              <div className="rounded-xl bg-white/70 px-3 py-2">
                남은 직물 마을 {clothVillagesWithSupply}/{clothVillages.length || "-"}곳 · 공용 {clothVillageGeneralSupply}개 · 연결 {connectedClothVillageCount}곳
              </div>
            </div>
          )}
          {barbarianAttackRule && (
            <div className="mb-3 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-800">
              야만인 침공 · 마을이나 도시를 지으면 해안에 야만인이 상륙합니다. 야만인 3개가 모인 타일은 생산하지 않고, 기사 개발 카드로 방어 기사를 배치해 격퇴할 수 있습니다.
            </div>
          )}
          {citiesKnightsRule && (
            <div className="mb-3 grid gap-2 rounded-2xl border border-rose-100 bg-rose-50 p-3 text-xs font-bold text-rose-800 sm:grid-cols-3">
              <div>
                <span className="font-black">야만인</span> · {barbarianPosition}/{barbarianTrackLength}
              </div>
              <div>
                <span className="font-black">이벤트</span> · {eventDie ? catanEventDieLabels[eventDie] || eventDie : "-"}{redDie ? ` / 적색 ${redDie}` : ""}
              </div>
              <div>
                <span className="font-black">침공</span> · {barbarianAttacks}회
              </div>
            </div>
          )}
          <div className="relative aspect-[1.08/1] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-sky-200 via-cyan-100 to-blue-200 p-2">
            <svg viewBox="-4 -4 108 108" className="h-full w-full drop-shadow-sm">
              <defs>
                <pattern id="catan-terrain-forest" width="8" height="8" patternUnits="userSpaceOnUse">
                  <rect width="8" height="8" fill="#2f8f5b" />
                  <path d="M1 6.6 3 1.2 5 6.6M4.8 6.9 6.7 2.3 7.8 6.9" fill="none" stroke="#14532d" strokeWidth="0.45" opacity="0.42" />
                  <circle cx="2.9" cy="3.4" r="0.75" fill="#bbf7d0" opacity="0.22" />
                </pattern>
                <pattern id="catan-terrain-pasture" width="7" height="7" patternUnits="userSpaceOnUse">
                  <rect width="7" height="7" fill="#8ccf5f" />
                  <path d="M0.4 5.4C1.7 4.5 2.4 6.3 3.6 5.3S5.6 4.7 6.8 5.6" fill="none" stroke="#166534" strokeWidth="0.35" opacity="0.32" />
                  <circle cx="5.4" cy="2" r="0.75" fill="#ecfccb" opacity="0.32" />
                </pattern>
                <pattern id="catan-terrain-field" width="7" height="7" patternUnits="userSpaceOnUse">
                  <rect width="7" height="7" fill="#f2c94c" />
                  <path d="M1 0.5v6M3.5 0.5v6M6 0.5v6" stroke="#a16207" strokeWidth="0.32" opacity="0.32" />
                  <path d="M0.6 2.2h5.9M0.6 4.7h5.9" stroke="#fef3c7" strokeWidth="0.3" opacity="0.45" />
                </pattern>
                <pattern id="catan-terrain-hill" width="8" height="8" patternUnits="userSpaceOnUse">
                  <rect width="8" height="8" fill="#c96f3d" />
                  <path d="M-1 6C1.4 3.4 3.9 7.6 6.2 4.6 7.2 3.3 8 3.4 9 4.2" fill="none" stroke="#7c2d12" strokeWidth="0.4" opacity="0.35" />
                  <path d="M0.5 2.2C2.7 0.7 4.8 3.7 7.5 1.8" fill="none" stroke="#fed7aa" strokeWidth="0.32" opacity="0.35" />
                </pattern>
                <pattern id="catan-terrain-mountain" width="8" height="8" patternUnits="userSpaceOnUse">
                  <rect width="8" height="8" fill="#7f8792" />
                  <path d="M0.5 6.8 2.8 1.3l1.6 3.1 1-1.8 2.4 4.2Z" fill="#475569" opacity="0.52" />
                  <path d="M2.8 1.3 3.7 3.1 2.4 3.1Z" fill="#e2e8f0" opacity="0.55" />
                </pattern>
                <pattern id="catan-terrain-desert" width="8" height="8" patternUnits="userSpaceOnUse">
                  <rect width="8" height="8" fill="#d8b46f" />
                  <path d="M-1 5.5C1.4 4.2 2.8 6.6 5 5.2 6.3 4.4 7.2 4.5 9 5.8" fill="none" stroke="#92400e" strokeWidth="0.35" opacity="0.32" />
                  <circle cx="5.8" cy="2.2" r="0.45" fill="#78350f" opacity="0.28" />
                </pattern>
                <pattern id="catan-terrain-gold" width="7" height="7" patternUnits="userSpaceOnUse">
                  <rect width="7" height="7" fill="#f59e0b" />
                  <path d="M3.5 0.8 4.6 2.4 3.5 4 2.4 2.4Z" fill="#fef3c7" opacity="0.5" />
                  <circle cx="1.2" cy="5.6" r="0.55" fill="#92400e" opacity="0.25" />
                </pattern>
                <pattern id="catan-terrain-sea" width="9" height="9" patternUnits="userSpaceOnUse">
                  <rect width="9" height="9" fill="#38bdf8" />
                  <path d="M-1 3.2C0.8 2.1 2.1 4.2 3.8 3.2S6.2 2.1 8.1 3.2 10.5 3.7 11 3.1M-1 6.8C0.8 5.7 2.1 7.8 3.8 6.8S6.2 5.7 8.1 6.8 10.5 7.3 11 6.7" fill="none" stroke="#075985" strokeWidth="0.4" opacity="0.28" />
                </pattern>
                <pattern id="catan-terrain-unexplored" width="7" height="7" patternUnits="userSpaceOnUse">
                  <rect width="7" height="7" fill="#475569" />
                  <path d="M-1 7 7 -1M2 8 8 2" stroke="#94a3b8" strokeWidth="0.45" opacity="0.28" />
                </pattern>
              </defs>
              {hexes.map((hex) => {
                const rawTerrainKey = String(hex.terrain || "DESERT").toUpperCase();
                const terrainKey = catanTerrain[rawTerrainKey] ? rawTerrainKey : "DESERT";
                const terrain = catanTerrain[terrainKey];
                const terrainPatternId = catanTerrainPatternIds[terrainKey];
                const selected = selectedHexId === Number(hex.id);
                const foreignIsland = Boolean(get(hex, "foreign_island", "foreignIsland", false));
                const forgottenTribeIsland = Boolean(get(hex, "forgotten_tribe_island", "forgottenTribeIsland", false));
                const islandId = Number(get(hex, "island_id", "islandId", 0));
                const fourIslandsHex = seafarersScenarioCode === "FOUR_ISLANDS" && islandId > 0;
                const missionType = get(hex, "mission_type", "missionType", "");
                const pirateLairCaptured = Boolean(get(hex, "pirate_lair_captured", "pirateLairCaptured", false));
                const pirateLairCrewCount = (get(hex, "crew_seat_nos", "crewSeatNos", []) || []).length;
                const spiceAdvantageType = get(hex, "spice_advantage_type", "spiceAdvantageType", "");
                const spiceCrewCount = (get(hex, "crew_seat_nos", "crewSeatNos", []) || []).length;
                const riverTile = Boolean(get(hex, "river_tile", "riverTile", false));
                const oasis = Boolean(get(hex, "oasis", "oasis", false)) || oasisHexId === Number(hex.id);
                const barbarianCoastal = Boolean(get(hex, "barbarian_coastal", "barbarianCoastal", false));
                const barbarianCount = Number(get(hex, "barbarian_count", "barbarianCount", 0));
                const barbarianConquered = Boolean(get(hex, "barbarian_conquered", "barbarianConquered", false));
                const numberToken = Number(get(hex, "number_token", "numberToken", 0));
                const missionFill = missionType === "FISH" ? "#0284c7" : missionType === "PIRATE_LAIR" ? "#7f1d1d" : "#a16207";
                const selectHex = () => setSelectedHexId(Number(hex.id));
                const hexLabel = `${oasis ? "오아시스" : terrain.label} 타일${numberToken ? ` ${numberToken}` : ""}`;
                return (
                  <g
                    key={hex.id}
                    className="cursor-pointer"
                    onClick={selectHex}
                    aria-label={`${hexLabel} 선택`}
                    {...keyboardActivateProps(selectHex)}
                  >
                    <polygon
                      points={hexPoints(Number(hex.x), Number(hex.y), radius)}
                      fill={terrainPatternId ? `url(#${terrainPatternId})` : terrain.fill}
                      stroke={selected ? "#0f172a" : forgottenTribeIsland ? "#5eead4" : foreignIsland ? "#fef3c7" : fourIslandsHex ? "#bae6fd" : "#ffffff"}
                      strokeWidth={selected ? 1.1 : forgottenTribeIsland || foreignIsland || fourIslandsHex ? 0.85 : 0.55}
                    />
                    {(forgottenTribeIsland || foreignIsland || fourIslandsHex) && (
                      <polygon
                        points={hexPoints(Number(hex.x), Number(hex.y), radius - 0.9)}
                        fill="none"
                        stroke={forgottenTribeIsland ? "#0f766e" : foreignIsland ? "#92400e" : "#075985"}
                        strokeWidth="0.32"
                        strokeDasharray="0.9 0.8"
                        opacity="0.75"
                      />
                    )}
                    {barbarianCoastal && (
                      <polygon
                        points={hexPoints(Number(hex.x), Number(hex.y), radius - 1.35)}
                        fill="none"
                        stroke={barbarianConquered ? "#991b1b" : "#f97316"}
                        strokeWidth={barbarianConquered ? 0.55 : 0.35}
                        strokeDasharray={barbarianConquered ? undefined : "0.9 0.85"}
                        opacity="0.9"
                      />
                    )}
                    {riverTile && (
                      <path
                        d={`M ${Number(hex.x) - 5.2} ${Number(hex.y) - 4.8} C ${Number(hex.x) - 1.8} ${Number(hex.y) - 2.2}, ${Number(hex.x) - 2.2} ${Number(hex.y) + 2.1}, ${Number(hex.x) + 5.2} ${Number(hex.y) + 4.8}`}
                        fill="none"
                        stroke="#0284c7"
                        strokeWidth="1.25"
                        strokeLinecap="round"
                        opacity="0.85"
                      />
                    )}
                    {oasis && (
                      <g>
                        <circle cx={Number(hex.x) - 3.5} cy={Number(hex.y) + 3.9} r="2.15" fill="#fed7aa" stroke="#c2410c" strokeWidth="0.35" />
                        <text x={Number(hex.x) - 3.5} y={Number(hex.y) + 4.55} textAnchor="middle" className="select-none text-[1.55px] font-black" fill="#9a3412">오</text>
                      </g>
                    )}
                    <text x={hex.x} y={hex.y - 1.8} textAnchor="middle" className="select-none text-[2.4px] font-black" fill={terrain.text}>
                      {oasis ? "오아시스" : terrain.label}
                    </text>
                    {(forgottenTribeIsland || foreignIsland || fourIslandsHex) && (
                      <text x={hex.x} y={Number(hex.y) + 7.1} textAnchor="middle" className="select-none text-[1.6px] font-black" fill={forgottenTribeIsland ? "#0f766e" : foreignIsland ? "#78350f" : "#075985"}>
                        {forgottenTribeIsland ? "부족" : foreignIsland ? "외섬" : `섬${islandId}`}
                      </text>
                    )}
                    {missionType && (
                      <g>
                        <rect x={Number(hex.x) - 4.3} y={Number(hex.y) - 7.3} width="8.6" height="3.2" rx="1.2" fill={missionFill} opacity="0.92" />
                        <text x={hex.x} y={Number(hex.y) - 5.05} textAnchor="middle" className="select-none text-[1.55px] font-black" fill="#ffffff">
                          {catanMissionLabels[missionType] || missionType}
                        </text>
                      </g>
                    )}
                    {barbarianCount > 0 && (
                      <g>
                        <circle cx={Number(hex.x) + 4.25} cy={Number(hex.y) + 4.65} r="2.15" fill={barbarianConquered ? "#991b1b" : "#fee2e2"} stroke="#7f1d1d" strokeWidth="0.35" />
                        <text x={Number(hex.x) + 4.25} y={Number(hex.y) + 5.35} textAnchor="middle" className="select-none text-[1.75px] font-black" fill={barbarianConquered ? "#ffffff" : "#991b1b"}>
                          {barbarianCount}
                        </text>
                      </g>
                    )}
                    {missionType === "PIRATE_LAIR" && (
                      <g>
                        <rect x={Number(hex.x) - 3.4} y={Number(hex.y) + 4.05} width="6.8" height="2.8" rx="1.1" fill={pirateLairCaptured ? "#dcfce7" : "#fee2e2"} stroke={pirateLairCaptured ? "#15803d" : "#991b1b"} strokeWidth="0.28" />
                        <text x={hex.x} y={Number(hex.y) + 5.95} textAnchor="middle" className="select-none text-[1.35px] font-black" fill={pirateLairCaptured ? "#166534" : "#991b1b"}>
                          {pirateLairCaptured ? "점령" : `${pirateLairCrewCount}/3`}
                        </text>
                      </g>
                    )}
                    {missionType === "SPICE" && spiceAdvantageType && (
                      <g>
                        <rect x={Number(hex.x) - 3.9} y={Number(hex.y) + 4.05} width="7.8" height="2.8" rx="1.1" fill="#fef9c3" stroke="#854d0e" strokeWidth="0.28" />
                        <text x={hex.x} y={Number(hex.y) + 5.95} textAnchor="middle" className="select-none text-[1.25px] font-black" fill="#854d0e">
                          {catanSpiceAdvantageShortLabels[spiceAdvantageType] || spiceAdvantageType} {spiceCrewCount}
                        </text>
                      </g>
                    )}
                    {get(hex, "cargo_type", "cargoType", "") === "FISH" && (
                      <g>
                        <circle cx={Number(hex.x) - 4.2} cy={Number(hex.y) + 4.7} r="2.05" fill="#e0f2fe" stroke="#0369a1" strokeWidth="0.35" />
                        <text x={Number(hex.x) - 4.2} y={Number(hex.y) + 5.28} textAnchor="middle" className="select-none text-[1.35px] font-black" fill="#075985">어</text>
                      </g>
                    )}
                    {!!numberToken && (
                      <g>
                        <circle cx={Number(hex.x)} cy={Number(hex.y) + 2.8} r="2.7" fill="#fff7ed" stroke="#7c2d12" strokeWidth="0.35" />
                        <text x={Number(hex.x)} y={Number(hex.y) + 3.65} textAnchor="middle" className="select-none text-[2.8px] font-black" fill={numberToken === 6 || numberToken === 8 ? "#dc2626" : "#431407"}>
                          {numberToken}
                        </text>
                      </g>
                    )}
                    {robberHexId === Number(hex.id) && (
                      <g>
                        <circle cx={Number(hex.x) + 3.5} cy={Number(hex.y) - 3.8} r="2.2" fill="#111827" />
                        <text x={Number(hex.x) + 3.5} y={Number(hex.y) - 3.1} textAnchor="middle" className="select-none text-[2.1px] font-black" fill="#ffffff">도</text>
                      </g>
                    )}
                    {pirateHexId === Number(hex.id) && (
                      <g>
                        <circle cx={Number(hex.x) + 3.6} cy={Number(hex.y) - 3.8} r="2.25" fill="#7f1d1d" />
                        <text x={Number(hex.x) + 3.6} y={Number(hex.y) - 3.1} textAnchor="middle" className="select-none text-[2px] font-black" fill="#ffffff">해</text>
                      </g>
                    )}
                    {merchantHexId === Number(hex.id) && (
                      <g>
                        <circle cx={Number(hex.x) - 3.6} cy={Number(hex.y) - 3.8} r="2.25" fill="#facc15" stroke="#713f12" strokeWidth="0.35" />
                        <text x={Number(hex.x) - 3.6} y={Number(hex.y) - 3.1} textAnchor="middle" className="select-none text-[2px] font-black" fill="#713f12">상</text>
                      </g>
                    )}
                  </g>
                );
              })}
              {edges.map((edge) => {
                const a = vertexById.get(Number(get(edge, "vertex_aid", "vertexAId", 0)));
                const b = vertexById.get(Number(get(edge, "vertex_bid", "vertexBId", 0)));
                if (!a || !b) return null;
                const owner = Number(get(edge, "owner_seat_no", "ownerSeatNo", 0));
                const ownerColor = catanPlayers.find((player) => Number(get(player, "seat_no", "seatNo", 0)) === owner)?.color;
                const selected = selectedEdgeId === Number(edge.id);
                const routeType = get(edge, "route_type", "routeType", "");
                const riverEdge = Boolean(get(edge, "river_edge", "riverEdge", false));
                const bridgeSite = Boolean(get(edge, "bridge_site", "bridgeSite", false));
                const bridgeBuilt = routeType === "BRIDGE";
                const camel = Boolean(get(edge, "camel", "camel", false));
                const camelStart = camelStartEdgeIds.map(Number).includes(Number(edge.id));
                const barbarianKnightOwner = Number(get(edge, "barbarian_knight_owner_seat_no", "barbarianKnightOwnerSeatNo", 0));
                const barbarianKnightColor = catanPlayers.find((player) => Number(get(player, "seat_no", "seatNo", 0)) === barbarianKnightOwner)?.color;
                const forgottenGiftType = get(edge, "forgotten_tribe_gift_type", "forgottenTribeGiftType", "");
                const forgottenGiftPortType = get(edge, "forgotten_tribe_gift_port_type", "forgottenTribeGiftPortType", "");
                const forgottenGiftClaimedSeatNo = Number(get(edge, "forgotten_tribe_gift_claimed_seat_no", "forgottenTribeGiftClaimedSeatNo", 0));
                const forgottenGiftLabel = forgottenGiftType === "VICTORY_POINT"
                  ? "승"
                  : forgottenGiftType === "DEVELOPMENT_CARD"
                    ? "개"
                    : forgottenGiftPortType === "ANY"
                      ? "3"
                      : "항";
                const edgeMidX = Number(edge.x);
                const edgeMidY = Number(edge.y);
                const selectEdge = () => setSelectedEdgeId(Number(edge.id));
                const edgeLabel = owner
                  ? `${playerName(owner)}의 ${routeType === "SHIP" ? "배" : routeType === "BRIDGE" ? "다리" : "도로"} 경로`
                  : bridgeSite ? "다리 후보 경로" : riverEdge ? "강 경로" : camelStart ? "낙타 시작 경로" : "빈 경로";
                return (
                  <g
                    key={edge.id}
                    className="cursor-pointer"
                    onClick={selectEdge}
                    aria-label={`${edgeLabel} 선택`}
                    {...keyboardActivateProps(selectEdge)}
                  >
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={owner ? catanColorFill[ownerColor] || "#111827" : selected ? "#0f172a" : camelStart ? "#f97316" : bridgeSite ? "#0e7490" : riverEdge ? "#0284c7" : "rgba(15,23,42,0.16)"}
                      strokeWidth={owner ? 1.9 : selected ? 1.5 : camelStart ? 1.45 : bridgeSite ? 1.55 : riverEdge ? 1.35 : 0.9}
                      strokeDasharray={routeType === "SHIP" ? "1.6 1.2" : bridgeSite && !owner ? "1.8 1.1" : camelStart && !camel ? "1.7 1.1" : undefined}
                      strokeLinecap="round"
                    />
                    {forgottenGiftType && (
                      <g className="pointer-events-none">
                        <circle
                          cx={edgeMidX}
                          cy={edgeMidY}
                          r="2.15"
                          fill={forgottenGiftClaimedSeatNo ? "#e2e8f0" : "#ccfbf1"}
                          stroke={forgottenGiftClaimedSeatNo ? "#64748b" : "#0f766e"}
                          strokeWidth="0.38"
                        />
                        <text x={edgeMidX} y={edgeMidY + 0.65} textAnchor="middle" className="select-none text-[1.55px] font-black" fill={forgottenGiftClaimedSeatNo ? "#475569" : "#0f766e"}>
                          {forgottenGiftLabel}
                        </text>
                      </g>
                    )}
                    {(bridgeSite || bridgeBuilt) && (
                      <g className="pointer-events-none">
                        <rect
                          x={edgeMidX - 2.1}
                          y={edgeMidY - 1.25}
                          width="4.2"
                          height="2.5"
                          rx="0.65"
                          fill={bridgeBuilt ? catanColorFill[ownerColor] || "#111827" : "#ecfeff"}
                          stroke={bridgeBuilt ? "#0f172a" : "#0891b2"}
                          strokeWidth="0.35"
                        />
                        <text
                          x={edgeMidX}
                          y={edgeMidY + 0.65}
                          textAnchor="middle"
                          className="select-none text-[1.45px] font-black"
                          fill={bridgeBuilt && ownerColor !== "WHITE" ? "#ffffff" : "#0e7490"}
                        >
                          다
                        </text>
                      </g>
                    )}
                    {(camel || camelStart) && (
                      <g className="pointer-events-none">
                        <circle cx={edgeMidX} cy={edgeMidY} r={camel ? "2.05" : "1.65"} fill={camel ? "#fb923c" : "#ffedd5"} stroke="#9a3412" strokeWidth="0.35" />
                        <text x={edgeMidX} y={edgeMidY + 0.6} textAnchor="middle" className="select-none text-[1.45px] font-black" fill={camel ? "#7c2d12" : "#c2410c"}>
                          낙
                        </text>
                      </g>
                    )}
                    {barbarianKnightOwner > 0 && (
                      <g className="pointer-events-none">
                        <rect x={edgeMidX - 1.75} y={edgeMidY - 1.75} width="3.5" height="3.5" rx="0.7" fill={catanColorFill[barbarianKnightColor] || "#111827"} stroke="#7f1d1d" strokeWidth="0.35" />
                        <text x={edgeMidX} y={edgeMidY + 0.62} textAnchor="middle" className="select-none text-[1.5px] font-black" fill={barbarianKnightColor === "WHITE" ? "#0f172a" : "#ffffff"}>
                          기
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
              {edges.map((edge) => {
                const cargoTypes = cargoTypesOf(edge);
                if (!cargoTypes.length) return null;
                return (
                  <g key={`cargo-${edge.id}`}>
                    {cargoTypes.map((cargoType, index) => {
                      const cargoMark = cargoMarkOf(cargoType);
                      const offset = cargoTypes.length > 1 ? (index === 0 ? -1.45 : 1.45) : 0;
                      return (
                        <g key={`${edge.id}-${cargoType}-${index}`}>
                          <circle cx={Number(edge.x) + offset} cy={edge.y} r="1.78" fill={cargoMark.fill} stroke={cargoMark.stroke} strokeWidth="0.35" />
                          <text x={Number(edge.x) + offset} y={Number(edge.y) + 0.6} textAnchor="middle" className="select-none text-[1.45px] font-black" fill={cargoMark.stroke}>{cargoMark.label}</text>
                        </g>
                      );
                    })}
                  </g>
                );
              })}
              {councilDockEdgeIds.map((edgeId) => {
                const edge = edgeById.get(Number(edgeId));
                if (!edge) return null;
                return (
                  <g key={`council-${edgeId}`}>
                    <circle cx={edge.x} cy={edge.y} r="2.35" fill="#fefce8" stroke="#854d0e" strokeWidth="0.38" />
                    <text x={edge.x} y={Number(edge.y) + 0.7} textAnchor="middle" className="select-none text-[1.65px] font-black" fill="#854d0e">의</text>
                  </g>
                );
              })}
              {fishingGrounds.map((ground) => {
                const edge = edgeById.get(Number(get(ground, "edge_id", "edgeId", 0)));
                const x = Number(get(ground, "x", "x", edge?.x || 0));
                const y = Number(get(ground, "y", "y", edge?.y || 0));
                const numberToken = Number(get(ground, "number_token", "numberToken", 0));
                return (
                  <g key={`fishing-${ground.id}`}>
                    <circle cx={x} cy={y} r="2.8" fill="#e0f2fe" stroke="#0369a1" strokeWidth="0.42" />
                    <text x={x} y={y - 0.45} textAnchor="middle" className="select-none text-[1.25px] font-black" fill="#075985">낚</text>
                    <text x={x} y={y + 1.25} textAnchor="middle" className="select-none text-[1.45px] font-black" fill={numberToken === 6 || numberToken === 8 ? "#dc2626" : "#075985"}>
                      {numberToken}
                    </text>
                  </g>
                );
              })}
              {clothVillages.map((village) => {
                const x = Number(get(village, "x", "x", 0));
                const y = Number(get(village, "y", "y", 0));
                const numberToken = Number(get(village, "number_token", "numberToken", 0));
                const supply = Number(get(village, "supply", "supply", 0));
                const connectedSeatNos = get(village, "connected_seat_nos", "connectedSeatNos", []) || [];
                const villageVertexId = Number(get(village, "vertex_id", "vertexId", 0));
                const selectVillage = () => setSelectedVertexId(villageVertexId);
                return (
                  <g
                    key={`cloth-village-${get(village, "id", "id", get(village, "vertex_id", "vertexId", 0))}`}
                    className="cursor-pointer"
                    onClick={selectVillage}
                    aria-label={`직물 마을 ${numberToken || "-"} 선택`}
                    {...keyboardActivateProps(selectVillage)}
                  >
                    <rect x={x - 3.6} y={y - 3.25} width="7.2" height="6.5" rx="1.8" fill={supply > 0 ? "#fdf4ff" : "#e2e8f0"} stroke={connectedSeatNos.length ? "#a21caf" : "#c026d3"} strokeWidth="0.42" />
                    <text x={x} y={y - 0.55} textAnchor="middle" className="select-none text-[1.45px] font-black" fill={supply > 0 ? "#86198f" : "#475569"}>
                      천 {supply}
                    </text>
                    <text x={x} y={y + 1.45} textAnchor="middle" className="select-none text-[1.45px] font-black" fill={numberToken === 6 || numberToken === 8 ? "#dc2626" : "#86198f"}>
                      {numberToken || "-"} · {connectedSeatNos.length}
                    </text>
                  </g>
                );
              })}
              {ports.map((port) => {
                const edge = edgeById.get(Number(get(port, "edge_id", "edgeId", 0)));
                if (!edge) return null;
                const portType = get(port, "port_type", "portType", "ANY");
                const ratio = Number(port.ratio || 3);
                const label = portType === "ANY" ? `${ratio}:1` : `${catanResourceLabels[portType] || portType} ${ratio}:1`;
                return (
                  <g key={port.id}>
                    <circle cx={edge.x} cy={edge.y} r="2.25" fill="#0f172a" opacity="0.72" />
                    <text x={edge.x} y={Number(edge.y) + 0.65} textAnchor="middle" className="select-none text-[1.65px] font-black" fill="#ffffff">
                      {label}
                    </text>
                  </g>
                );
              })}
              {vertices.map((vertex) => {
                const owner = Number(get(vertex, "owner_seat_no", "ownerSeatNo", 0));
                const ownerColor = catanPlayers.find((player) => Number(get(player, "seat_no", "seatNo", 0)) === owner)?.color;
                const knightOwner = Number(get(vertex, "knight_owner_seat_no", "knightOwnerSeatNo", 0));
                const knightOwnerColor = catanPlayers.find((player) => Number(get(player, "seat_no", "seatNo", 0)) === knightOwner)?.color;
                const knightLevel = Number(get(vertex, "knight_level", "knightLevel", 0));
                const knightActive = Boolean(get(vertex, "knight_active", "knightActive", false));
                const hasCityWall = Boolean(get(vertex, "city_wall", "cityWall", false));
                const selected = selectedVertexId === Number(vertex.id);
                const selectVertex = () => setSelectedVertexId(Number(vertex.id));
                const vertexLabel = owner
                  ? `${playerName(owner)}의 ${get(vertex, "building_type", "buildingType", "") === "CITY" ? "도시" : get(vertex, "building_type", "buildingType", "") === "HARBOR_SETTLEMENT" ? "항구 정착지" : "마을"}`
                  : knightOwner
                    ? `${playerName(knightOwner)}의 기사 위치`
                    : "빈 정점";
                return (
                  <g
                    key={vertex.id}
                    className="cursor-pointer"
                    onClick={selectVertex}
                    aria-label={`${vertexLabel} 선택`}
                    {...keyboardActivateProps(selectVertex)}
                  >
                    <circle
                      cx={vertex.x}
                      cy={vertex.y}
                      r={owner ? 1.9 : selected ? 1.65 : 1.2}
                      fill={owner ? catanColorFill[ownerColor] || "#111827" : selected ? "#0f172a" : "#ffffff"}
                      stroke={ownerColor === "WHITE" ? "#94a3b8" : "#0f172a"}
                      strokeWidth={owner ? 0.45 : 0.25}
                    />
                    {owner && (
                      <text x={vertex.x} y={Number(vertex.y) + 0.75} textAnchor="middle" className="select-none text-[1.9px] font-black" fill={ownerColor === "WHITE" ? "#0f172a" : "#ffffff"}>
                        {get(vertex, "building_type", "buildingType", "") === "CITY" ? "도" : get(vertex, "building_type", "buildingType", "") === "HARBOR_SETTLEMENT" ? "항" : "마"}
                      </text>
                    )}
                    {!!cargoTypesOf(vertex).length && (() => {
                      const cargoTypes = cargoTypesOf(vertex);
                      return (
                        <g>
                          {cargoTypes.map((cargoType, index) => {
                            const cargoMark = cargoMarkOf(cargoType);
                            return (
                              <g key={`${vertex.id}-${cargoType}-${index}`}>
                                <circle cx={Number(vertex.x) + 2.15 + index * 1.65} cy={Number(vertex.y) - 2.15} r="1.35" fill={cargoMark.fill} stroke={cargoMark.stroke} strokeWidth="0.3" />
                                <text x={Number(vertex.x) + 2.15 + index * 1.65} y={Number(vertex.y) - 1.68} textAnchor="middle" className="select-none text-[1.1px] font-black" fill={cargoMark.stroke}>{cargoMark.label}</text>
                              </g>
                            );
                          })}
                        </g>
                      );
                    })()}
                    {hasCityWall && (
                      <circle
                        cx={vertex.x}
                        cy={vertex.y}
                        r="2.65"
                        fill="none"
                        stroke="#facc15"
                        strokeWidth="0.55"
                        strokeDasharray="0.8 0.6"
                      />
                    )}
                    {!!knightOwner && (
                      <g>
                        <rect
                          x={Number(vertex.x) - 1.6}
                          y={Number(vertex.y) - 4.4}
                          width="3.2"
                          height="2.8"
                          rx="0.65"
                          fill={catanColorFill[knightOwnerColor] || "#111827"}
                          stroke={knightActive ? "#fef08a" : "#0f172a"}
                          strokeWidth={knightActive ? 0.55 : 0.28}
                        />
                        <text x={vertex.x} y={Number(vertex.y) - 2.42} textAnchor="middle" className="select-none text-[1.75px] font-black" fill={knightOwnerColor === "WHITE" ? "#0f172a" : "#ffffff"}>
                          기{knightLevel}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
          {renderSelectedTargetSummary({
            className: "tabletop-mobile-action-strip sticky z-20 mt-3 shadow-xl backdrop-blur xl:hidden",
            surfaceClassName: "bg-white/95",
            showActionJump: true,
          })}
        </div>
      </div>

      <aside className="space-y-4">
        <div id="catan-action-panel" className="catan-action-panel scroll-mt-24 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-black text-slate-900">액션</div>
              <div className="text-[11px] font-bold text-slate-500">{catanPhaseLabel} · {myTurn ? "내 차례" : `${playerName(activeSeatNo)} 차례`}</div>
            </div>
            <a
              href="#catan-board-panel"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-black text-slate-700 xl:hidden"
            >
              <ArrowUp className="h-3.5 w-3.5" />
              보드 보기
            </a>
          </div>
          {renderSelectedTargetSummary({ className: "mb-3" })}
          {phase === "SETUP" && (
            <div className="space-y-2">
              {seafarersRule && !explorersPiratesRule && seafarersScenarioCode === "NEW_SHORES" && (
                <div className="rounded-xl bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-800">
                  초기 배치는 본섬에서만 진행합니다. 외딴 섬에 처음 마을을 세우면 특별 승점 2점을 받습니다.
                </div>
              )}
              {seafarersScenarioCode === "FOUR_ISLANDS" && (
                <div className="rounded-xl bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-800">
                  초기 배치한 섬이 내 홈 섬입니다. 다른 섬에 처음 마을을 세우면 섬마다 특별 승점 2점을 받습니다.
                </div>
              )}
              {fogIslandsRule && (
                <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
                  초기 배치는 드러난 섬에서 시작합니다. 안개 타일은 배나 도로가 닿을 때 공개되고, 이 시나리오는 특별 승점 없이 12점으로 끝납니다.
                </div>
              )}
              {throughDesertRule && (
                <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                  초기 배치는 본섬에서만 가능합니다. 해안에서는 도로 대신 배를 놓을 수 있고, 외국 지역에 새 마을을 세우면 지역마다 특별 승점 2점을 받습니다.
                </div>
              )}
              {forgottenTribeRule && (
                <div className="rounded-xl bg-teal-50 px-3 py-2 text-xs font-bold text-teal-800">
                  초기 배치는 본섬에서 시작합니다. 부족 섬은 선물만 받을 수 있는 섬이라 마을을 지을 수 없고, 배로 선물 해안에 닿아야 합니다.
                </div>
              )}
              {clothForCatanRule && (
                <div className="rounded-xl bg-fuchsia-50 px-3 py-2 text-xs font-bold text-fuchsia-800">
                  초기 배치는 두 본섬에서 시작합니다. 가운데 부족 마을에는 정착할 수 없고, 배로 부족 마을과 내 정착지를 연결해야 직물 교역이 시작됩니다.
                </div>
              )}
              {explorersPiratesRule && (
                <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                  첫 배치는 해안의 항구 정착지와 배, 두 번째 배치는 일반 마을 기준으로 진행합니다.
                </div>
              )}
              <button className="w-full rounded-xl bg-slate-900 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={!myTurn} onClick={() => setupBuild().catch(() => toast.error("초기 배치 위치를 확인해주세요."))}>
                {explorersPiratesRule ? "항구/마을과 길 배치" : seafarersRule ? "정착지와 도로/배 배치" : "정착지와 도로 배치"}
              </button>
            </div>
          )}
          {phase === "CAMEL_BID" && (
            <div className="space-y-3">
              <div className="rounded-xl bg-orange-50 px-3 py-2 text-xs font-bold leading-relaxed text-orange-800">
                {playerName(camelBidCurrentSeatNo || activeSeatNo)}이 낙타 배치권에 입찰합니다. 양털과 곡물은 낸 만큼 모두 사용됩니다.
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["WOOL", "양털"],
                  ["GRAIN", "곡물"],
                ].map(([resource, label]) => (
                  <label key={resource} className="rounded-xl bg-slate-50 px-3 py-2">
                    <span className="block text-[11px] font-bold text-slate-500">{label}</span>
                    <input
                      type="number"
                      min="0"
                      max={resources?.[resource] ?? 0}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm font-black"
                      value={camelBidForm[resource]}
                      onChange={(event) => setCamelBidForm((prev) => ({ ...prev, [resource]: Math.max(0, Number(event.target.value) || 0) }))}
                    />
                  </label>
                ))}
              </div>
              {!!camelBids.length && (
                <div className="flex flex-wrap gap-1">
                  {camelBids.map((bid) => (
                    <span key={get(bid, "seat_no", "seatNo", 0)} className="rounded-full bg-orange-100 px-2 py-1 text-[11px] font-black text-orange-700">
                      {playerName(get(bid, "seat_no", "seatNo", 0))} {get(bid, "total", "total", 0)}
                    </span>
                  ))}
                </div>
              )}
              <button className="w-full rounded-xl bg-orange-600 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={!myTurn} onClick={() => bidCamel().catch(() => toast.error("입찰할 양털/곡물 수량을 확인해주세요."))}>
                입찰 제출
              </button>
            </div>
          )}
          {phase === "PLACE_CAMEL" && (
            <div className="space-y-3">
              <div className="rounded-xl bg-orange-50 px-3 py-2 text-xs font-bold leading-relaxed text-orange-800">
                {playerName(camelPlacerSeatNo || activeSeatNo)}이 낙타를 배치합니다. 오아시스 시작 표식 또는 기존 낙타 행렬의 끝 경로를 선택하세요.
              </div>
              <button className="w-full rounded-xl bg-orange-600 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={!myTurn || !selectedEdgeId} onClick={() => placeCamel().catch(() => toast.error("낙타를 놓을 수 있는 경로를 선택해주세요."))}>
                선택 경로에 낙타 배치
              </button>
            </div>
          )}
          {phase === "ROLL" && (
            <div className="space-y-3">
              <button className="w-full rounded-xl bg-amber-600 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={!myTurn} onClick={() => onAction({ action_type: "ROLL_DICE" }).catch(() => toast.error("주사위 굴리기 실패"))}>
                주사위 굴리기
              </button>
              {citiesKnightsRule && !!alchemistCards.length && (
                <div className="space-y-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                  <select className="w-full rounded-xl border border-emerald-100 px-3 py-2 text-xs font-bold" value={selectedAlchemistCardId} onChange={(event) => setSelectedProgressCardId(event.target.value)}>
                    {alchemistCards.map((card) => (
                      <option key={card.id} value={card.id}>연금술사</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <select className="rounded-xl border border-emerald-100 px-3 py-2 text-xs font-bold" value={alchemistDice.red} onChange={(event) => setAlchemistDice((prev) => ({ ...prev, red: Number(event.target.value) }))}>
                      {[1, 2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>적색 {value}</option>)}
                    </select>
                    <select className="rounded-xl border border-emerald-100 px-3 py-2 text-xs font-bold" value={alchemistDice.white} onChange={(event) => setAlchemistDice((prev) => ({ ...prev, white: Number(event.target.value) }))}>
                      {[1, 2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>흰색 {value}</option>)}
                    </select>
                  </div>
                  <button className="w-full rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!myTurn} onClick={() => playAlchemistCard().catch(() => toast.error("연금술사 사용 조건을 확인해주세요."))}>
                    연금술사로 주사위 확정
                  </button>
                </div>
              )}
              {!citiesKnightsRule && !explorersPiratesRule && !!playableDevelopmentCards.length && (
                <div className="space-y-2 rounded-2xl border border-violet-100 bg-violet-50 p-3">
                  <select className="w-full rounded-xl border border-violet-100 px-3 py-2 text-xs font-bold" value={selectedCardId} onChange={(event) => setSelectedCardId(event.target.value)}>
                    {playableDevelopmentCards.map((card) => (
                      <option key={card.id} value={card.id}>{catanDevelopmentLabels[card.type] || card.type}</option>
                    ))}
                  </select>
                  {selectedDevCard?.type === "KNIGHT" && !!robberTargets.length && (
                    <select className="w-full rounded-xl border border-violet-100 px-3 py-2 text-xs font-bold" value={targetSeatNo} onChange={(event) => setTargetSeatNo(event.target.value)}>
                      {robberTargets.map((player) => {
                        const seatNo = Number(get(player, "seat_no", "seatNo", 0));
                        return <option key={seatNo} value={seatNo}>{playerName(seatNo)}에게서 1장 뽑기</option>;
                      })}
                    </select>
                  )}
                  {selectedDevCard?.type === "ROAD_BUILDING" && (
                    <button type="button" className="w-full rounded-xl bg-white px-3 py-2 text-xs font-black text-violet-700" onClick={addRoadCardEdge}>
                      선택 간선 추가 ({roadCardEdges.join(", ") || "없음"})
                    </button>
                  )}
                  <button className="w-full rounded-xl bg-violet-700 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!canPlaySelectedDevelopmentCard} onClick={() => playDevelopmentCard().catch(() => toast.error("개발 카드 사용 조건을 확인해주세요."))}>
                    개발 카드 사용
                  </button>
                  {devCardAlreadyPlayedThisTurn && (
                    <div className="rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-violet-700">
                      개발 카드는 한 턴에 1장만 사용할 수 있습니다.
                    </div>
                  )}
                </div>
              )}
              {!citiesKnightsRule && !explorersPiratesRule && !!lockedDevelopmentCards.length && (
                <div className="rounded-2xl border border-violet-100 bg-violet-50 px-3 py-2 text-[11px] font-bold text-violet-700">
                  이번 턴에 구입한 개발 카드 {lockedDevelopmentCards.length}장은 다음 내 턴부터 사용할 수 있습니다.
                </div>
              )}
              {!citiesKnightsRule && !explorersPiratesRule && !playableDevelopmentCards.length && !!passiveDevelopmentVictoryCards.length && (
                <div className="rounded-2xl border border-violet-100 bg-violet-50 px-3 py-2 text-[11px] font-bold text-violet-700">
                  승점 개발 카드는 사용하지 않아도 내 점수에 자동 반영됩니다.
                </div>
              )}
            </div>
          )}
          {phase === "DISCARD" && (
            <div className="space-y-3">
              <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold leading-relaxed text-rose-700">
                {sevenDiscardMessage}
              </div>
              {mustDiscard ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {catanResourceEntries.map(([key, label]) => (
                      <label key={key} className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                        <span>{label}</span>
                        <input
                          type="number"
                          min="0"
                          max={resources?.[key] ?? 0}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm font-black text-slate-900"
                          value={discardForm[key] || 0}
                          onChange={(event) => setDiscardForm((prev) => ({ ...prev, [key]: Math.max(0, Number(event.target.value || 0)) }))}
                        />
                      </label>
                    ))}
                  </div>
                  {citiesKnightsRule && (
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(catanCommodityLabels).map(([key, label]) => (
                        <label key={key} className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                          <span>{label}</span>
                          <input
                            type="number"
                            min="0"
                            max={commodities?.[key] ?? 0}
                            className="mt-1 w-full rounded-lg border border-rose-100 px-2 py-1 text-sm font-black text-slate-900"
                            value={discardCommodityForm[key] || 0}
                            onChange={(event) => setDiscardCommodityForm((prev) => ({ ...prev, [key]: Math.max(0, Number(event.target.value || 0)) }))}
                          />
                        </label>
                      ))}
                    </div>
                  )}
                  <button className="w-full rounded-xl bg-rose-600 px-3 py-3 text-sm font-black text-white" onClick={() => discardResources().catch(() => toast.error("버릴 자원을 확인해주세요."))}>
                    {discardTotal}/{discardRequired}장 버리기
                  </button>
                </>
              ) : (
                <div className="rounded-xl bg-slate-50 px-3 py-3 text-xs font-bold text-slate-500">
                  버릴 자원이 있는 플레이어를 기다리는 중입니다.
                </div>
              )}
            </div>
          )}
          {phase === "PROGRESS_DISCARD" && (
            <div className="space-y-3 rounded-2xl border border-fuchsia-100 bg-fuchsia-50 p-3">
              <div className="text-xs font-bold leading-relaxed text-fuchsia-800">
                진행 카드는 승점 카드를 제외하고 4장까지만 보유할 수 있습니다. 초과한 플레이어가 직접 버릴 카드를 고릅니다.
              </div>
              {mustDiscardProgress ? (
                <>
                  <select className="w-full rounded-xl border border-fuchsia-100 px-3 py-2 text-xs font-bold" value={selectedDiscardProgressCardId} onChange={(event) => setSelectedProgressCardId(event.target.value)}>
                    {nonVictoryProgressCards.map((card) => {
                      const cardType = get(card, "type", "type", "");
                      return <option key={card.id} value={card.id}>{catanProgressLabels[cardType] || cardType}</option>;
                    })}
                  </select>
                  <button className="w-full rounded-xl bg-fuchsia-700 px-3 py-3 text-sm font-black text-white" onClick={() => discardProgressCard().catch(() => toast.error("버릴 진행 카드를 확인해주세요."))}>
                    {progressDiscardRequired || 1}장 남음
                  </button>
                </>
              ) : (
                <div className="rounded-xl bg-white/70 px-3 py-3 text-xs font-bold text-fuchsia-700">
                  진행 카드를 버릴 플레이어를 기다리는 중입니다.
                </div>
              )}
            </div>
          )}
          {phase === "DEFENDER_PROGRESS_CHOICE" && (
            <div className="space-y-3 rounded-2xl border border-amber-100 bg-amber-50 p-3">
              <div className="text-xs font-bold leading-relaxed text-amber-800">
                야만인을 함께 막아 방어자 점수 대신 진행 카드를 받습니다. 순서: {pendingDefenderProgressSeatNos.map((seatNo) => playerName(seatNo)).join(" → ") || "대기"}
              </div>
              {mustChooseDefenderProgress ? (
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <select className="rounded-xl border border-amber-100 px-3 py-2 text-xs font-bold" value={selectedImprovementType} onChange={(event) => setSelectedImprovementType(event.target.value)}>
                    {Object.entries(catanImprovementLabels).map(([key, label]) => <option key={key} value={key}>{label} 진행 카드</option>)}
                  </select>
                  <button className="rounded-xl bg-amber-700 px-3 py-3 text-sm font-black text-white" onClick={() => chooseDefenderProgressCard().catch(() => toast.error("받을 진행 카드 종류를 확인해주세요."))}>
                    카드 받기
                  </button>
                </div>
              ) : (
                <div className="rounded-xl bg-white/70 px-3 py-3 text-xs font-bold text-amber-700">
                  방어자들이 진행 카드 종류를 선택 중입니다.
                </div>
              )}
            </div>
          )}
          {phase === "DESERTER_REMOVE" && (
            <div className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50 p-3">
              <div className="text-xs font-bold leading-relaxed text-blue-800">
                {playerName(pendingDeserterAttackerSeatNo)}의 탈영병 카드입니다. {playerName(pendingDeserterTargetSeatNo)}이 제거할 자기 기사를 선택합니다.
              </div>
              <button className="w-full rounded-xl bg-blue-700 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={pendingDeserterTargetSeatNo !== mySeatNo} onClick={() => removeDeserterKnight().catch(() => toast.error("제거할 기사를 확인해주세요."))}>
                선택 기사 제거
              </button>
            </div>
          )}
          {phase === "DESERTER_PLACE" && (
            <div className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50 p-3">
              <div className="text-xs font-bold leading-relaxed text-blue-800">
                {playerName(pendingDeserterAttackerSeatNo)}이 {pendingDeserterKnightLevel}단계 탈영 기사를 배치합니다.
              </div>
              <button className="w-full rounded-xl bg-blue-700 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={pendingDeserterAttackerSeatNo !== mySeatNo} onClick={() => placeDeserterKnight().catch(() => toast.error("배치할 정점을 확인해주세요."))}>
                탈영 기사 배치
              </button>
            </div>
          )}
          {phase === "INTRIGUE_MOVE" && (
            <div className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-3">
              <div className="text-xs font-bold leading-relaxed text-indigo-800">
                {playerName(pendingIntrigueAttackerSeatNo)}의 음모 카드입니다. {playerName(pendingIntrigueTargetSeatNo)}이 {pendingIntrigueKnightLevel}단계 기사를 자기 도로망의 빈 정점으로 옮깁니다.
              </div>
              <button className="w-full rounded-xl bg-indigo-700 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={pendingIntrigueTargetSeatNo !== mySeatNo} onClick={() => moveIntrigueKnight().catch(() => toast.error("기사를 옮길 정점을 확인해주세요."))}>
                밀려난 기사 이동
              </button>
            </div>
          )}
          {phase === "DISPLACED_KNIGHT_MOVE" && (
            <div className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-3">
              <div className="text-xs font-bold leading-relaxed text-indigo-800">
                {playerName(pendingDisplacedKnightTargetSeatNo)}의 {pendingDisplacedKnightLevel}단계 기사가 밀려났습니다. 자기 도로망의 빈 교차점을 선택해 옮깁니다.
              </div>
              <button className="w-full rounded-xl bg-indigo-700 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={!mustMoveDisplacedKnight} onClick={() => moveDisplacedKnight().catch(() => toast.error("기사를 옮길 교차점을 확인해주세요."))}>
                밀려난 기사 이동
              </button>
            </div>
          )}
          {phase === "COMMERCIAL_HARBOR" && (
            <div className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
              <div className="text-xs font-bold leading-relaxed text-emerald-800">
                {playerName(pendingCommercialHarborSeatNo)}이 {catanResourceLabels[pendingCommercialHarborResourceType] || pendingCommercialHarborResourceType} 1장을 건넵니다. 대상 플레이어는 줄 상품을 선택합니다.
              </div>
              <select className="w-full rounded-xl border border-emerald-100 px-3 py-2 text-xs font-bold" value={selectedCommodityType} onChange={(event) => setSelectedCommodityType(event.target.value)}>
                {Object.entries(catanCommodityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <button className="w-full rounded-xl bg-emerald-700 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={!pendingCommercialHarborSeatNos.map(Number).includes(mySeatNo)} onClick={() => respondCommercialHarbor().catch(() => toast.error("줄 상품을 확인해주세요."))}>
                상품 주고 자원 받기
              </button>
            </div>
          )}
          {phase === "MASTER_MERCHANT_CHOOSE" && (
            <div className="space-y-3 rounded-2xl border border-amber-100 bg-amber-50 p-3">
              <div className="text-xs font-bold leading-relaxed text-amber-800">
                {playerName(pendingMasterMerchantAttackerSeatNo)}이 {playerName(pendingMasterMerchantTargetSeatNo)}의 손패에서 {pendingMasterMerchantCount}장을 고릅니다.
              </div>
              {pendingMasterMerchantAttackerSeatNo === mySeatNo ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {catanResourceEntries.map(([key, label]) => (
                      <label key={key} className="rounded-xl bg-white/70 px-3 py-2 text-xs font-bold text-amber-800">
                        <span>{label} · 보유 {masterMerchantTargetResources?.[key] || 0}</span>
                        <input
                          type="number"
                          min="0"
                          max={masterMerchantTargetResources?.[key] || 0}
                          className="mt-1 w-full rounded-lg border border-amber-100 px-2 py-1 text-sm font-black text-slate-900"
                          value={masterMerchantResources[key] || 0}
                          onChange={(event) => setMasterMerchantResources((prev) => ({
                            ...prev,
                            [key]: Math.min(masterMerchantTargetResources?.[key] || 0, Math.max(0, Number(event.target.value || 0))),
                          }))}
                        />
                      </label>
                    ))}
                    {Object.entries(catanCommodityLabels).map(([key, label]) => (
                      <label key={key} className="rounded-xl bg-white/70 px-3 py-2 text-xs font-bold text-amber-800">
                        <span>{label} · 보유 {masterMerchantTargetCommodities?.[key] || 0}</span>
                        <input
                          type="number"
                          min="0"
                          max={masterMerchantTargetCommodities?.[key] || 0}
                          className="mt-1 w-full rounded-lg border border-amber-100 px-2 py-1 text-sm font-black text-slate-900"
                          value={masterMerchantCommodities[key] || 0}
                          onChange={(event) => setMasterMerchantCommodities((prev) => ({
                            ...prev,
                            [key]: Math.min(masterMerchantTargetCommodities?.[key] || 0, Math.max(0, Number(event.target.value || 0))),
                          }))}
                        />
                      </label>
                    ))}
                  </div>
                  <button className="w-full rounded-xl bg-amber-700 px-3 py-3 text-sm font-black text-white" onClick={() => chooseMasterMerchantCards().catch(() => toast.error("가져올 카드를 확인해주세요."))}>
                    {masterMerchantTotal}/{pendingMasterMerchantCount}장 가져오기
                  </button>
                </>
              ) : (
                <div className="rounded-xl bg-white/70 px-3 py-3 text-xs font-bold text-amber-700">
                  대상인을 사용한 플레이어가 가져갈 카드를 선택 중입니다.
                </div>
              )}
            </div>
          )}
          {phase === "SPY_CHOOSE" && (
            <div className="space-y-3 rounded-2xl border border-rose-100 bg-rose-50 p-3">
              <div className="text-xs font-bold leading-relaxed text-rose-800">
                {playerName(pendingSpyAttackerSeatNo)}이 {playerName(pendingSpyTargetSeatNo)}의 진행 카드를 확인 중입니다. 승점 진행 카드는 선택할 수 없습니다.
              </div>
              {pendingSpyAttackerSeatNo === mySeatNo ? (
                <>
                  <select className="w-full rounded-xl border border-rose-100 px-3 py-2 text-xs font-bold" value={selectedSpyCardId} onChange={(event) => setSelectedSpyCardId(event.target.value)}>
                    {revealedSpyCards.map((card) => {
                      const cardType = get(card, "type", "type", "");
                      return <option key={card.id} value={card.id}>{catanProgressLabels[cardType] || cardType}</option>;
                    })}
                  </select>
                  <button className="w-full rounded-xl bg-rose-700 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={!revealedSpyCards.length} onClick={() => chooseSpyProgressCard().catch(() => toast.error("가져올 진행 카드를 확인해주세요."))}>
                    선택한 카드 가져오기
                  </button>
                </>
              ) : (
                <div className="rounded-xl bg-white/70 px-3 py-3 text-xs font-bold text-rose-700">
                  첩자를 사용한 플레이어가 가져갈 카드를 선택 중입니다.
                </div>
              )}
            </div>
          )}
          {phase === "WEDDING_GIVE" && (
            <div className="space-y-3 rounded-2xl border border-pink-100 bg-pink-50 p-3">
              <div className="text-xs font-bold leading-relaxed text-pink-800">
                {playerName(pendingWeddingAttackerSeatNo)}의 혼례 카드입니다. 점수가 더 높은 대상 플레이어가 줄 카드 2장을 직접 선택합니다.
              </div>
              {mustRespondWedding ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {catanResourceEntries.map(([key, label]) => (
                      <label key={key} className="rounded-xl bg-white/70 px-3 py-2 text-xs font-bold text-pink-800">
                        <span>{label} · 보유 {resources?.[key] || 0}</span>
                        <input
                          type="number"
                          min="0"
                          max={resources?.[key] || 0}
                          className="mt-1 w-full rounded-lg border border-pink-100 px-2 py-1 text-sm font-black text-slate-900"
                          value={weddingResources[key] || 0}
                          onChange={(event) => setWeddingResources((prev) => ({
                            ...prev,
                            [key]: Math.min(resources?.[key] || 0, Math.max(0, Number(event.target.value || 0))),
                          }))}
                        />
                      </label>
                    ))}
                    {Object.entries(catanCommodityLabels).map(([key, label]) => (
                      <label key={key} className="rounded-xl bg-white/70 px-3 py-2 text-xs font-bold text-pink-800">
                        <span>{label} · 보유 {commodities?.[key] || 0}</span>
                        <input
                          type="number"
                          min="0"
                          max={commodities?.[key] || 0}
                          className="mt-1 w-full rounded-lg border border-pink-100 px-2 py-1 text-sm font-black text-slate-900"
                          value={weddingCommodities[key] || 0}
                          onChange={(event) => setWeddingCommodities((prev) => ({
                            ...prev,
                            [key]: Math.min(commodities?.[key] || 0, Math.max(0, Number(event.target.value || 0))),
                          }))}
                        />
                      </label>
                    ))}
                  </div>
                  <button className="w-full rounded-xl bg-pink-700 px-3 py-3 text-sm font-black text-white" onClick={() => respondWeddingCards().catch(() => toast.error("줄 카드를 확인해주세요."))}>
                    {weddingTotal}/{weddingRequired}장 주기
                  </button>
                </>
              ) : (
                <div className="rounded-xl bg-white/70 px-3 py-3 text-xs font-bold text-pink-700">
                  혼례 대상 플레이어가 줄 카드를 선택 중입니다.
                </div>
              )}
            </div>
          )}
          {phase === "GOLD_CHOICE" && (
            <div className="space-y-3">
              <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold leading-relaxed text-amber-700">
                금광에서 받을 자원을 선택합니다. 마을은 1장, 도시는 원하는 조합 2장을 받습니다.
              </div>
              {myGoldChoice ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {catanResourceEntries.map(([key, label]) => (
                      <label key={key} className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                        <span>{label} · 은행 {resourceBank?.[key] ?? "-"}장</span>
                        <input
                          type="number"
                          min="0"
                          max={Math.min(goldRequired, Number(resourceBank?.[key] ?? goldRequired))}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm font-black text-slate-900"
                          value={goldForm[key] || 0}
                          onChange={(event) => setGoldForm((prev) => ({
                            ...prev,
                            [key]: Math.min(Number(resourceBank?.[key] ?? goldRequired), Math.max(0, Number(event.target.value || 0))),
                          }))}
                        />
                      </label>
                    ))}
                  </div>
                  {!goldChoiceWithinBank && (
                    <div className="rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-amber-700">
                      은행에 부족한 자원은 선택할 수 없습니다.
                    </div>
                  )}
                  <button className="w-full rounded-xl bg-amber-600 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={goldTotal !== goldRequired || !goldChoiceWithinBank} onClick={() => chooseGoldResources().catch(() => toast.error("금광 자원 선택을 확인해주세요."))}>
                    {goldTotal}/{goldRequired}장 받기
                  </button>
                </>
              ) : (
                <div className="rounded-xl bg-slate-50 px-3 py-3 text-xs font-bold text-slate-500">
                  금광 자원을 선택 중인 플레이어를 기다리는 중입니다.
                </div>
              )}
            </div>
          )}
          {phase === "AQUEDUCT_CHOICE" && (
            <div className="space-y-3 rounded-2xl border border-cyan-100 bg-cyan-50 p-3">
              <div className="text-xs font-bold leading-relaxed text-cyan-800">
                생산을 받지 못한 수로 보유 플레이어가 원하는 자원 1장을 선택합니다.
              </div>
              {myAqueductChoice ? (
                <>
                  <select className="w-full rounded-xl border border-cyan-100 px-3 py-2 text-xs font-bold" value={selectedAqueductResourceType} onChange={(event) => setSelectedAqueductResourceType(event.target.value)}>
                    {catanResourceEntries.map(([key, label]) => <option key={key} value={key} disabled={!bankAvailableFor(key, 1)}>{label} · 은행 {resourceBank?.[key] ?? "-"}장</option>)}
                  </select>
                  {!aqueductWithinBank && (
                    <div className="rounded-xl bg-white/70 px-3 py-2 text-[11px] font-bold text-cyan-700">
                      은행에 남은 {catanResourceLabels[selectedAqueductResourceType]} 카드가 없습니다.
                    </div>
                  )}
                  <button className="w-full rounded-xl bg-cyan-700 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={!aqueductWithinBank} onClick={() => chooseAqueductResource().catch(() => toast.error("수로 자원 선택을 확인해주세요."))}>
                    선택한 자원 받기
                  </button>
                </>
              ) : (
                <div className="rounded-xl bg-white/70 px-3 py-3 text-xs font-bold text-cyan-700">
                  수로 자원을 선택 중인 플레이어를 기다리는 중입니다.
                </div>
              )}
            </div>
          )}
          {phase === "ROBBER" && (
            <div className="space-y-3">
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold leading-relaxed text-slate-600">
                {explorersPiratesRule ? "발견된 바다 칸 중 시작 섬과 닿지 않는 곳으로 해적선을 이동합니다." : "선택한 육지 타일로 도적을 이동합니다."}
              </div>
              {!!robberTargets.length && (
                <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" value={targetSeatNo} onChange={(event) => setTargetSeatNo(event.target.value)}>
                  {robberTargets.map((player) => {
                    const seatNo = Number(get(player, "seat_no", "seatNo", 0));
                    return <option key={seatNo} value={seatNo}>{playerName(seatNo)}에게서 1장 뽑기</option>;
                  })}
                </select>
              )}
              <button className="w-full rounded-xl bg-slate-900 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={!myTurn} onClick={() => moveRobber().catch(() => toast.error(explorersPiratesRule ? "해적 이동 실패" : "도적 이동 실패"))}>
                {explorersPiratesRule || selectedHex?.terrain === "SEA" ? "해적 이동" : "도적 이동"}
              </button>
            </div>
          )}
          {phase === "ACTION" && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["ROAD", "도로"],
                  ...(riversRule ? [["BRIDGE", "다리"]] : []),
                  ...(seafarersRule ? [["SHIP", "배"], ["MOVE_SHIP", "배 이동"]] : []),
                  ...(citiesKnightsRule ? [["KNIGHT", "기사"], ["CITY_WALL", "성벽"]] : []),
                  ["SETTLEMENT", "마을"],
                  ...(explorersPiratesRule ? [["HARBOR_SETTLEMENT", "항구 정착지"]] : [["CITY", "도시"]]),
                ].map(([mode, label]) => (
                  <button key={mode} className={`rounded-xl px-3 py-2 text-xs font-black ${buildMode === mode ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`} onClick={() => setBuildMode(mode)}>
                    {label}
                  </button>
                ))}
              </div>
              {seafarersRule && buildMode === "MOVE_SHIP" && (
                explorersPiratesRule ? (
                  <div className="space-y-2 rounded-2xl border border-cyan-100 bg-cyan-50 p-3">
                    <div className="text-xs font-black text-cyan-800">배 이동 경로 {shipMovePath.join(" -> ") || "없음"} · 최대 {shipMoveMaxSteps}칸</div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className="rounded-xl bg-white px-3 py-2 text-xs font-black text-cyan-700 disabled:opacity-40"
                        disabled={!selectedEdgeId || shipMovePath.length >= shipMoveMaxEdges}
                        onClick={() => setShipMovePath((prev) => (selectedEdgeId && !prev.includes(selectedEdgeId) ? [...prev, selectedEdgeId].slice(0, shipMoveMaxEdges) : prev))}
                      >
                        선택 간선 추가
                      </button>
                      <button type="button" className="rounded-xl bg-cyan-100 px-3 py-2 text-xs font-black text-cyan-800" onClick={() => setShipMovePath([])}>
                        경로 초기화
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="w-full rounded-xl bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-700" onClick={() => setShipMoveFromEdgeId(selectedEdgeId)}>
                    선택 간선을 이동할 배로 지정 ({shipMoveFromEdgeId || "없음"})
                  </button>
                )
              )}
              <button className="w-full rounded-xl bg-emerald-600 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={selectedBuildActionDisabled} onClick={() => build().catch(() => toast.error("건설 조건이나 자원을 확인해주세요."))}>
                선택 위치에 실행
              </button>
              {citiesKnightsRule && buildMode === "KNIGHT" && selectedVertexKnightBuildWarning && (
                <div className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-bold leading-relaxed text-rose-700">
                  {selectedVertexKnightBuildWarning}
                </div>
              )}
              {riversRule && (
                <div className="space-y-2 rounded-2xl border border-cyan-100 bg-cyan-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-cyan-800">
                    <span className="font-black">강 골드</span>
                    <span>보유 {myGold}개 · 이번 턴 교환 {riverGoldTradesRemaining}/2회</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <select className="rounded-xl border border-cyan-100 px-3 py-2 text-xs font-bold text-slate-700" value={tradeForm.receive} onChange={(event) => setTradeForm((prev) => ({ ...prev, receive: event.target.value }))}>
                      {catanResourceEntries.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                    </select>
                    <button type="button" className="rounded-xl bg-cyan-700 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!myTurn || myGold < 2 || riverGoldTradesRemaining <= 0} onClick={() => spendGoldForResource().catch(() => toast.error("골드 2개와 받을 자원을 확인해주세요."))}>
                      골드 2개 교환
                    </button>
                  </div>
                  <div className="rounded-xl bg-white/70 px-3 py-2 text-[11px] font-bold leading-relaxed text-cyan-900">
                    다리 표식이 있는 강 간선은 다리 모드로 건설합니다. 다리는 벽돌 2개와 목재 1개가 필요하며 건설 즉시 골드 2개를 얻습니다.
                  </div>
                </div>
              )}
              {caravansRule && (
                <div className="space-y-2 rounded-2xl border border-orange-100 bg-orange-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-orange-800">
                    <span className="font-black">대상단</span>
                    <span>남은 낙타 {camelSupply}개 · 대기 {pendingCamelPlacements}회</span>
                  </div>
                  <div className="rounded-xl bg-white/70 px-3 py-2 text-[11px] font-bold leading-relaxed text-orange-900">
                    마을/도시 건설 후 턴을 종료하면 입찰 단계가 열립니다. 보드의 낙 표식이 낙타 시작 경로와 배치된 행렬입니다.
                  </div>
                </div>
              )}
              {barbarianAttackRule && (
                <div className="space-y-2 rounded-2xl border border-red-100 bg-red-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-red-800">
                    <span className="font-black">야만인 침공</span>
                    <span>남은 야만인 {barbarianAttackSupply}개</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button type="button" className="rounded-xl bg-white px-3 py-2 text-xs font-black text-red-700 disabled:opacity-40" disabled={!myTurn || !selectedEdgeId || selectedDevCard?.type !== "KNIGHT"} onClick={() => recruitBarbarianKnight().catch(() => toast.error("기사 개발 카드와 빈 경로를 확인해주세요."))}>
                      기사 카드로 방어 기사 배치
                    </button>
                    <button type="button" className="rounded-xl bg-red-700 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!myTurn || !selectedHexId} onClick={() => expelBarbarians().catch(() => toast.error("격퇴 조건을 만족하는 야만인 타일을 선택해주세요."))}>
                      선택 타일 야만인 격퇴
                    </button>
                  </div>
                  <div className="rounded-xl bg-white/70 px-3 py-2 text-[11px] font-bold leading-relaxed text-red-900">
                    기 표식은 방어 기사입니다. 야만인 숫자보다 인접 기사가 많으면 격퇴할 수 있고, 포획 야만인 2개마다 승점 1점을 얻습니다.
                  </div>
                </div>
              )}
              {fishermenRule && (
                <div className="space-y-2 rounded-2xl border border-sky-100 bg-sky-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-sky-800">
                    <span className="font-black">물고기 시장</span>
                    <span>보유 {fishermenFishTotal}마리 · 토큰 {fishermenTokens.length}/7개{myHasOldBoot ? " · 낡은 장화" : ""}</span>
                  </div>
                  {!!fishermenTokens.length && (
                    <div className="flex flex-wrap gap-1">
                      {fishermenTokens.map((token, index) => (
                        <span key={`${token}-${index}`} className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-sky-700">{token}마리</span>
                      ))}
                    </div>
                  )}
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <select className="rounded-xl border border-sky-100 px-3 py-2 text-xs font-bold text-slate-700" value={tradeForm.receive} onChange={(event) => setTradeForm((prev) => ({ ...prev, receive: event.target.value }))}>
                      {catanResourceEntries.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                    </select>
                    <button type="button" className="rounded-xl bg-sky-700 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!myTurn || fishermenFishTotal < 4} onClick={() => spendFish("SPEND_FISH_TAKE_RESOURCE", { resource_type: tradeForm.receive }).catch(() => toast.error("물고기 4마리 이상과 받을 자원을 확인해주세요."))}>
                      자원 받기
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button type="button" className="rounded-xl bg-white px-3 py-2 text-xs font-black text-sky-700 disabled:opacity-40" disabled={!myTurn || fishermenFishTotal < 2} onClick={() => spendFish("SPEND_FISH_MOVE_ROBBER").catch(() => toast.error("물고기 2마리 이상이 필요합니다."))}>
                      도둑 사막으로
                    </button>
                    <button type="button" className="rounded-xl bg-white px-3 py-2 text-xs font-black text-sky-700 disabled:opacity-40" disabled={!myTurn || fishermenFishTotal < 5 || !selectedEdgeId} onClick={() => spendFish("SPEND_FISH_BUILD_ROAD", { edge_id: selectedEdgeId }).catch(() => toast.error("물고기 5마리와 건설 가능한 간선을 선택해주세요."))}>
                      무료 도로
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <select className="rounded-xl border border-sky-100 px-3 py-2 text-xs font-bold text-slate-700" value={targetSeatNo} onChange={(event) => setTargetSeatNo(event.target.value)}>
                      <option value="">상대 선택</option>
                      {fishActionTargets.map((player) => {
                        const seatNo = Number(get(player, "seat_no", "seatNo", 0));
                        return <option key={seatNo} value={seatNo}>{playerName(seatNo)} 자원 {get(player, "resource_count", "resourceCount", 0)}장</option>;
                      })}
                    </select>
                    <button type="button" className="rounded-xl bg-sky-700 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!myTurn || fishermenFishTotal < 3 || !targetSeatNo} onClick={() => spendFish("SPEND_FISH_STEAL_RESOURCE", { target_seat_no: Number(targetSeatNo) }).catch(() => toast.error("물고기 3마리와 카드를 가진 상대가 필요합니다."))}>
                      자원 뽑기
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button type="button" className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!myTurn || fishermenFishTotal < 7} onClick={() => spendFish("SPEND_FISH_DRAW_DEVELOPMENT").catch(() => toast.error("물고기 7마리와 남은 개발 카드가 필요합니다."))}>
                      개발 카드 받기
                    </button>
                    <button type="button" className="rounded-xl bg-amber-100 px-3 py-2 text-xs font-black text-amber-800 disabled:opacity-40" disabled={!myTurn || !myHasOldBoot || !targetSeatNo || !oldBootTargets.some((player) => Number(get(player, "seat_no", "seatNo", 0)) === Number(targetSeatNo))} onClick={() => spendFish("GIVE_OLD_BOOT", { target_seat_no: Number(targetSeatNo) }).catch(() => toast.error("나보다 승점이 같거나 높은 플레이어에게만 넘길 수 있습니다."))}>
                      장화 넘기기
                    </button>
                  </div>
                </div>
              )}
              {explorersPiratesRule && (
                <div className="space-y-2 rounded-2xl border border-amber-100 bg-amber-50 p-3">
                  <div className="text-xs font-black text-amber-800">
                    정착민 화물 · 항구/배/상륙 교차점을 선택해 순서대로 처리합니다.
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <button type="button" className="rounded-xl bg-white px-3 py-2 text-xs font-black text-amber-700 disabled:opacity-40" disabled={!myTurn} onClick={() => buildSettler().catch(() => toast.error("정착민을 놓을 항구나 배를 확인해주세요."))}>
                      정착민 준비
                    </button>
                    <button type="button" className="rounded-xl bg-white px-3 py-2 text-xs font-black text-amber-700 disabled:opacity-40" disabled={!myTurn || !selectedVertexId || !selectedEdgeId} onClick={() => loadSettler().catch(() => toast.error("항구와 배가 맞닿아 있는지 확인해주세요."))}>
                      배에 싣기
                    </button>
                    <button type="button" className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!myTurn || !selectedVertexId || !selectedEdgeId} onClick={() => foundSettlementFromShip().catch(() => toast.error("상륙 위치와 거리 규칙을 확인해주세요."))}>
                      상륙 마을
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button type="button" className="rounded-xl bg-violet-50 px-3 py-2 text-xs font-black text-violet-700 disabled:opacity-40" disabled={!myTurn} onClick={() => buildCrew().catch(() => toast.error("승무원을 놓을 항구나 배를 확인해주세요."))}>
                      승무원 준비
                    </button>
                    <button type="button" className="rounded-xl bg-red-700 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!myTurn || !selectedHexId || !selectedEdgeId} onClick={() => unloadCrewToPirateLair().catch(() => toast.error("해적 소굴과 승무원이 탄 배가 맞닿아야 합니다."))}>
                      해적 소굴 공격
                    </button>
                  </div>
                  <div className="rounded-xl bg-white/70 px-3 py-2 text-[11px] font-bold text-amber-800">
                    어획물 공급 {fishHaulsInSupply}개{fishHaulDie ? ` · 최근 어장 주사위 ${fishHaulDie}` : ""} · 선택 화물 {cargoLabelOf(selectedEdge) !== "없음" ? cargoLabelOf(selectedEdge) : cargoLabelOf(selectedVertex)}
                  </div>
                  <div className="rounded-xl bg-yellow-50 px-3 py-2 text-[11px] font-bold text-yellow-800">
                    향신료 이점 · 항해 +{mySpiceAdvantageCounts.SWIFT_VOYAGE} · 해적 {mySpiceAdvantageCounts.PIRATE_BONUS} · 빠른 금 {fastGoldRemaining}/{mySpiceAdvantageCounts.FAST_GOLD}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <button type="button" className="rounded-xl bg-sky-50 px-3 py-2 text-xs font-black text-sky-700 disabled:opacity-40" disabled={!myTurn} onClick={() => rollFishHaul().catch(() => toast.error("이번 턴에는 어장 주사위를 굴릴 수 없습니다."))}>
                      어장 주사위
                    </button>
                    <button type="button" className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!myTurn || !selectedHexId || !selectedEdgeId} onClick={() => catchFish().catch(() => toast.error("어획물이 있는 어장과 빈 배가 맞닿아야 합니다."))}>
                      어획물 싣기
                    </button>
                    <button type="button" className="rounded-xl bg-yellow-600 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!myTurn || !selectedHexId || !selectedEdgeId} onClick={() => collectSpice().catch(() => toast.error("향신료 마을과 승무원 배가 맞닿아야 합니다."))}>
                      향신료 싣기
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                    <select className="rounded-xl border border-yellow-100 px-3 py-2 text-xs font-bold text-slate-700" value={tradeForm.give} onChange={(event) => setTradeForm((prev) => ({ ...prev, give: event.target.value }))}>
                      {catanResourceEntries.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                    </select>
                    <button type="button" className="rounded-xl bg-yellow-700 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!myTurn || fastGoldRemaining <= 0} onClick={() => sellResourceForGold().catch(() => toast.error("판매할 자원과 빠른 금 사용 가능 횟수를 확인해주세요."))}>
                      빠른 금
                    </button>
                    <button type="button" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700 disabled:opacity-40" disabled={!myTurn || !selectedHexId || mySpiceAdvantageCounts.PIRATE_BONUS <= 0} onClick={() => chaseAwayPirate().catch(() => toast.error("내 배가 해적에 닿아 있는지, 보낼 바다 칸을 선택했는지 확인해주세요."))}>
                      해적 몰아내기
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button type="button" className="rounded-xl bg-white px-3 py-2 text-xs font-black text-amber-700 disabled:opacity-40" disabled={!myTurn || !selectedVertexId || !selectedEdgeId} onClick={() => transferCargo().catch(() => toast.error("항구 정착지와 배의 화물 교환 조건을 확인해주세요."))}>
                      항구 화물 교환
                    </button>
                    <button type="button" className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!myTurn || !selectedEdgeId} onClick={() => deliverCargo().catch(() => toast.error("의회 선착장에 닿은 어획물/향신료 배를 선택해주세요."))}>
                      의회에 납품
                    </button>
                  </div>
                </div>
              )}
              {citiesKnightsRule && (
                <div className="space-y-2 rounded-2xl border border-rose-100 bg-rose-50 p-3">
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <select className="rounded-xl border border-rose-100 px-3 py-2 text-xs font-bold" value={selectedImprovementType} onChange={(event) => setSelectedImprovementType(event.target.value)}>
                      {Object.entries(catanImprovementLabels).map(([key, label]) => {
                        const nextLevel = Number(cityImprovements?.[key] || 0) + 1;
                        return <option key={key} value={key}>{label} {Math.min(nextLevel, 5)}단계</option>;
                      })}
                    </select>
                    <button type="button" className="rounded-xl bg-rose-700 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!myTurn} onClick={() => buildCityImprovement().catch(() => toast.error("도시 발전 조건을 확인해주세요."))}>
                      발전
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <button type="button" className="rounded-xl bg-white px-3 py-2 text-xs font-black text-rose-700 disabled:opacity-40" disabled={!myTurn || !selectedOwnKnight} onClick={() => activateKnight().catch(() => toast.error("기사 활성화 조건을 확인해주세요."))}>
                      기사 활성화
                    </button>
                    <button type="button" className="rounded-xl bg-white px-3 py-2 text-xs font-black text-rose-700 disabled:opacity-40" disabled={!myTurn || !selectedKnightCanPromote} onClick={() => promoteKnight().catch(() => toast.error("기사 승급 조건을 확인해주세요."))}>
                      기사 승급
                    </button>
                    <button type="button" className="rounded-xl bg-white px-3 py-2 text-xs font-black text-rose-700 disabled:opacity-40" disabled={!myTurn || !selectedKnightCanChaseRobber} onClick={() => chaseRobberWithKnight().catch(() => toast.error("도적 추방 조건을 확인해주세요."))}>
                      도적 쫓아내기
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" className="rounded-xl bg-white px-3 py-2 text-xs font-black text-rose-700 disabled:opacity-40" disabled={!myTurn || !selectedOwnKnight} onClick={markKnightMoveSource}>
                      이동 출발 지정
                    </button>
                    <button type="button" className="rounded-xl bg-rose-700 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!myTurn || !selectedKnightCanMove} onClick={() => moveKnight().catch(() => toast.error("기사 이동 조건을 확인해주세요."))}>
                      기사 이동
                    </button>
                  </div>
                  {(selectedOwnKnight || knightMoveSource) && (
                    <div className="rounded-lg bg-white/70 px-3 py-2 text-[11px] font-bold text-rose-700">
                      이동 출발 {knightMoveSourceLabel} · 활성 기사는 다음 턴부터 도로망을 따라 이동하거나, 도적과 닿아 있으면 숫자 타일로 도적을 쫓아낼 수 있습니다.
                    </div>
                  )}
                  {knightMoveSource && selectedVertex && !selectedKnightDestinationReachable && (
                    <div className="rounded-lg bg-white/70 px-3 py-2 text-[11px] font-bold text-rose-700">
                      선택한 교차점은 이동 출발점과 내 도로망으로 연결되어 있지 않습니다.
                    </div>
                  )}
                  {!!actionProgressCards.length && (
                    <div className="space-y-2 rounded-xl bg-white/70 p-2">
                      <select className="w-full rounded-xl border border-rose-100 px-3 py-2 text-xs font-bold" value={selectedProgressCardId} onChange={(event) => setSelectedProgressCardId(event.target.value)}>
                        {actionProgressCards.map((card) => {
                          const cardType = get(card, "type", "type", "");
                          return <option key={card.id} value={card.id}>{catanProgressLabels[cardType] || get(card, "title", "title", cardType)}</option>;
                        })}
                      </select>
                      {selectedProgressType === "ALCHEMIST" && (
                        <div className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">
                          연금술사는 주사위 단계에서 굴리기 전에만 사용할 수 있습니다.
                        </div>
                      )}
                      {selectedProgressType === "CRANE" && (
                        <div className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">
                          위 도시 발전 선택값을 상품 1개 할인해 올립니다.
                        </div>
                      )}
                      {selectedProgressType === "ENGINEER" && (
                        <div className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">
                          선택 정점의 내 도시에 성벽을 무료로 세웁니다.
                        </div>
                      )}
                      {selectedProgressType === "INVENTOR" && (
                        <div className="space-y-2">
                          <button type="button" className="w-full rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700" onClick={addProgressHex}>
                            선택 타일 추가 ({roadCardEdges.join(", ") || "없음"})
                          </button>
                          <div className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">
                            2, 6, 8, 12가 아닌 숫자 토큰 2개를 서로 바꿉니다.
                          </div>
                        </div>
                      )}
                      {selectedProgressType === "INTRIGUE" && (
                        <div className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">
                          선택 정점의 상대 기사를 밀어냅니다. 해당 기사는 소유자가 자기 도로망의 빈 정점으로 옮깁니다.
                        </div>
                      )}
                      {selectedProgressType === "MEDICINE" && (
                        <div className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">
                          선택 정점의 내 마을을 곡물 1개와 광석 2개로 도시로 올립니다.
                        </div>
                      )}
                      {selectedProgressType === "BISHOP" && (
                        <div className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">
                          {citiesKnightsRobberLocked ? "첫 야만인 침공 전에는 주교로 도적을 움직일 수 없습니다." : "선택한 육지 타일로 도적을 옮기고 인접 상대마다 1장씩 가져옵니다."}
                        </div>
                      )}
                      {selectedProgressType === "COMMERCIAL_HARBOR" && (
                        <div className="space-y-2">
                          <select className="w-full rounded-xl border border-rose-100 px-3 py-2 text-xs font-bold" value={tradeForm.give} onChange={(event) => setTradeForm((prev) => ({ ...prev, give: event.target.value }))}>
                            {catanResourceEntries.map(([key, label]) => <option key={key} value={key}>{label} 제공</option>)}
                          </select>
                          <div className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">
                            상품을 가진 각 상대가 줄 상품을 직접 고릅니다.
                          </div>
                        </div>
                      )}
                      {selectedProgressType === "DESERTER" && (
                        <select className="w-full rounded-xl border border-rose-100 px-3 py-2 text-xs font-bold" value={targetSeatNo} onChange={(event) => setTargetSeatNo(event.target.value)}>
                          <option value="">대상 선택</option>
                          {deserterTargets.map((player) => {
                            const seatNo = Number(get(player, "seat_no", "seatNo", 0));
                            return <option key={seatNo} value={seatNo}>{playerName(seatNo)} 기사 탈영</option>;
                          })}
                        </select>
                      )}
                      {selectedProgressType === "MASTER_MERCHANT" && (
                        <select className="w-full rounded-xl border border-rose-100 px-3 py-2 text-xs font-bold" value={targetSeatNo} onChange={(event) => setTargetSeatNo(event.target.value)}>
                          <option value="">대상 선택</option>
                          {richerPlayers.map((player) => {
                            const seatNo = Number(get(player, "seat_no", "seatNo", 0));
                            return <option key={seatNo} value={seatNo}>{playerName(seatNo)}에게서 2장</option>;
                          })}
                        </select>
                      )}
                      {selectedProgressType === "MERCHANT" && (
                        <div className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">
                          선택한 생산 타일에 상인을 놓고 해당 자원 2:1 교환과 1점을 받습니다.
                        </div>
                      )}
                      {selectedProgressType === "MERCHANT_FLEET" && (
                        <select className="w-full rounded-xl border border-rose-100 px-3 py-2 text-xs font-bold" value={tradeForm.give} onChange={(event) => setTradeForm((prev) => ({ ...prev, give: event.target.value }))}>
                          {catanTradeCardEntries.map(([key, label]) => <option key={key} value={key}>{label} 2:1</option>)}
                        </select>
                      )}
                      {selectedProgressType === "SPY" && (
                        <div className="space-y-2">
                          <select className="w-full rounded-xl border border-rose-100 px-3 py-2 text-xs font-bold" value={targetSeatNo} onChange={(event) => setTargetSeatNo(event.target.value)}>
                            <option value="">대상 선택</option>
                            {spyTargets.map((player) => {
                              const seatNo = Number(get(player, "seat_no", "seatNo", 0));
                              const count = Number(get(player, "progress_card_count", "progressCardCount", 0));
                              return <option key={seatNo} value={seatNo}>{playerName(seatNo)} 진행 카드 {count}장</option>;
                            })}
                          </select>
                          <div className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">
                            승점 진행 카드는 가져올 수 없습니다.
                          </div>
                        </div>
                      )}
                      {selectedProgressType === "SABOTEUR" && (
                        <div className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">
                          나와 같거나 점수가 높은 상대는 절반을 버리고, 모두 버린 뒤 내 액션 단계로 돌아옵니다.
                        </div>
                      )}
                      {selectedProgressType === "WEDDING" && (
                        <div className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">
                          나보다 점수가 높은 모든 플레이어에게서 최대 2장씩 가져옵니다.
                        </div>
                      )}
                      {selectedProgressType === "ROAD_BUILDING" && (
                        <button type="button" className="w-full rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700" onClick={addRoadCardEdge}>
                          선택 간선 추가 ({roadCardEdges.join(", ") || "없음"})
                        </button>
                      )}
                      {selectedProgressType === "SMITH" && (
                        <div className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">
                          내 기사 최대 2개를 무료로 한 단계씩 승급합니다. 강한 기사를 최강 기사로 올리려면 정치 3단계 요새가 필요합니다.
                        </div>
                      )}
                      {selectedProgressBlockedByFortress && (
                        <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-500">
                          승급 가능한 기사가 없습니다.
                        </div>
                      )}
                      {selectedProgressType === "DIPLOMAT" && (
                        <button type="button" className="w-full rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700" onClick={addRoadCardEdge}>
                          열린 도로 추가 ({roadCardEdges.join(", ") || "없음"})
                        </button>
                      )}
                      {selectedProgressType === "RESOURCE_MONOPOLY" && (
                        <select className="w-full rounded-xl border border-rose-100 px-3 py-2 text-xs font-bold" value={tradeForm.give} onChange={(event) => setTradeForm((prev) => ({ ...prev, give: event.target.value }))}>
                          {catanResourceEntries.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                        </select>
                      )}
                      {selectedProgressType === "TRADE_MONOPOLY" && (
                        <select className="w-full rounded-xl border border-rose-100 px-3 py-2 text-xs font-bold" value={selectedCommodityType} onChange={(event) => setSelectedCommodityType(event.target.value)}>
                          {Object.entries(catanCommodityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                        </select>
                      )}
                      <button type="button" className="w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!myTurn || !selectedProgressSupported || selectedProgressType === "ALCHEMIST" || selectedProgressBlockedByRobberLock || selectedProgressBlockedByFortress} onClick={() => playProgressCard().catch(() => toast.error("진행 카드 사용 조건을 확인해주세요."))}>
                        진행 카드 사용
                      </button>
                    </div>
                  )}
                  {!actionProgressCards.length && (alchemistCards.length > 0 || passiveProgressVictoryCards.length > 0) && (
                    <div className="rounded-xl bg-white/70 px-3 py-2 text-[11px] font-bold leading-relaxed text-rose-700">
                      {alchemistCards.length > 0 && "연금술사는 주사위 단계에서만 사용할 수 있습니다. "}
                      {passiveProgressVictoryCards.length > 0 && "인쇄술과 헌법은 수동으로 쓰지 않는 자동 승점 카드입니다."}
                    </div>
                  )}
                </div>
              )}
              {domesticResourceTradeRule && pendingDomesticTrade && (
                <div className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                  <div className="text-xs font-black text-emerald-900">
                    {playerName(pendingTradeProposerSeatNo)} → {playerName(pendingTradeTargetSeatNo)} 거래 제안
                  </div>
                  <div className="grid gap-2 text-[11px] font-bold text-emerald-800 sm:grid-cols-2">
                    <div className="rounded-xl bg-white/80 px-3 py-2">제공: {resourceBundleLabel(pendingTradeOffer)}</div>
                    <div className="rounded-xl bg-white/80 px-3 py-2">요청: {resourceBundleLabel(pendingTradeRequest)}</div>
                  </div>
                  <div className="rounded-xl bg-white/70 px-3 py-2 text-[11px] font-bold text-emerald-700">
                    이 제안이 수락, 거절, 취소될 때까지 새 거래 제안은 잠시 보류됩니다.
                  </div>
                  {pendingTradeTargetSeatNo === mySeatNo && (
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white" onClick={() => respondDomesticTrade("ACCEPT_TRADE").catch(() => toast.error("보유 자원을 확인해주세요."))}>
                        수락
                      </button>
                      <button type="button" className="rounded-xl bg-white px-3 py-2 text-xs font-black text-emerald-800" onClick={() => respondDomesticTrade("REJECT_TRADE").catch(() => toast.error("거절 처리 실패"))}>
                        거절
                      </button>
                    </div>
                  )}
                  {pendingTradeProposerSeatNo === mySeatNo && (
                    <button type="button" className="w-full rounded-xl bg-white px-3 py-2 text-xs font-black text-emerald-800" onClick={() => respondDomesticTrade("CANCEL_TRADE").catch(() => toast.error("거래 취소 실패"))}>
                      제안 취소
                    </button>
                  )}
                </div>
              )}
              {domesticResourceTradeRule && !pendingDomesticTrade && (
                <div className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-black text-emerald-900">플레이어 거래</div>
                    <select className="rounded-xl border border-emerald-100 bg-white px-2 py-1 text-xs font-bold text-emerald-900" value={domesticTradeTargetSeatNo} onChange={(event) => setDomesticTradeTargetSeatNo(event.target.value)}>
                      <option value="">상대 선택</option>
                      {domesticTradeTargets.map((player) => {
                        const seatNo = Number(get(player, "seat_no", "seatNo", 0));
                        return <option key={seatNo} value={seatNo}>{playerName(seatNo)}</option>;
                      })}
                    </select>
                  </div>
                  <div className="grid gap-3">
                    <div>
                      <div className="mb-1 text-[11px] font-black text-emerald-800">내가 줄 자원</div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                        {catanResourceEntries.map(([key, label]) => (
                          <label key={`offer-${key}`} className="rounded-xl bg-white px-2 py-2">
                            <span className="block text-[10px] font-bold text-slate-500">{label}</span>
                            <input
                              type="number"
                              min="0"
                              max={resources?.[key] ?? 0}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm font-black"
                              value={domesticOfferForm[key]}
                              onChange={(event) => setDomesticOfferForm((prev) => ({ ...prev, [key]: Math.max(0, Number(event.target.value) || 0) }))}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-[11px] font-black text-emerald-800">받을 자원</div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                        {catanResourceEntries.map(([key, label]) => (
                          <label key={`request-${key}`} className="rounded-xl bg-white px-2 py-2">
                            <span className="block text-[10px] font-bold text-slate-500">{label}</span>
                            <input
                              type="number"
                              min="0"
                              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm font-black"
                              value={domesticRequestForm[key]}
                              onChange={(event) => setDomesticRequestForm((prev) => ({ ...prev, [key]: Math.max(0, Number(event.target.value) || 0) }))}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button className="w-full rounded-xl bg-emerald-700 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={!myTurn || !domesticTradeTargetSeatNo || domesticOfferTotal <= 0 || domesticRequestTotal <= 0 || domesticOfferExceeded} onClick={() => proposeDomesticTrade().catch(() => toast.error("거래 제안 실패"))}>
                    거래 제안
                  </button>
                </div>
              )}
              <div className="grid grid-cols-[1fr_1fr] gap-2">
                <select className="rounded-xl border border-slate-200 px-2 py-2 text-xs font-bold" value={tradeForm.give} onChange={(event) => setTradeForm((prev) => ({ ...prev, give: event.target.value }))}>
                  {catanTradeCardEntries.map(([key, label]) => <option key={key} value={key}>{label} {tradeRatioFor(key)}개</option>)}
                </select>
                <select className="rounded-xl border border-slate-200 px-2 py-2 text-xs font-bold" value={tradeForm.receive} onChange={(event) => setTradeForm((prev) => ({ ...prev, receive: event.target.value }))}>
                  {catanTradeCardEntries.map(([key, label]) => <option key={key} value={key}>{label} 1개</option>)}
                </select>
              </div>
              <button className="w-full rounded-xl bg-sky-600 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={!canMaritimeTrade} onClick={() => maritimeTrade().catch(() => toast.error("교환할 자원을 확인해주세요."))}>
                항구/해상 교환 {giveTradeRatio}:1
              </button>
              {!maritimeReceiveWithinBank && (
                <div className="rounded-xl bg-sky-50 px-3 py-2 text-[11px] font-bold text-sky-700">
                  은행에 받을 {catanResourceLabels[tradeForm.receive]} 카드가 없습니다.
                </div>
              )}
              {!citiesKnightsRule && !explorersPiratesRule && (
                <button className="w-full rounded-xl bg-violet-600 px-3 py-3 text-sm font-black text-white disabled:opacity-40" disabled={!canBuyDevelopmentCard} onClick={() => buyDevelopmentCard().catch(() => toast.error("개발 카드 비용을 확인해주세요."))}>
                  개발 카드 구입
                </button>
              )}
              {!citiesKnightsRule && !explorersPiratesRule && !!playableDevelopmentCards.length && (
                <div className="space-y-2 rounded-2xl border border-violet-100 bg-violet-50 p-3">
                  <select className="w-full rounded-xl border border-violet-100 px-3 py-2 text-xs font-bold" value={selectedCardId} onChange={(event) => setSelectedCardId(event.target.value)}>
                    {playableDevelopmentCards.map((card) => (
                      <option key={card.id} value={card.id}>{catanDevelopmentLabels[card.type] || card.type}</option>
                    ))}
                  </select>
                  {selectedDevCard?.type === "KNIGHT" && !!robberTargets.length && (
                    <select className="w-full rounded-xl border border-violet-100 px-3 py-2 text-xs font-bold" value={targetSeatNo} onChange={(event) => setTargetSeatNo(event.target.value)}>
                      {robberTargets.map((player) => {
                        const seatNo = Number(get(player, "seat_no", "seatNo", 0));
                        return <option key={seatNo} value={seatNo}>{playerName(seatNo)}에게서 1장 뽑기</option>;
                      })}
                    </select>
                  )}
                  {selectedDevCard?.type === "ROAD_BUILDING" && (
                    <div className="space-y-2">
                      <button type="button" className="w-full rounded-xl bg-white px-3 py-2 text-xs font-black text-violet-700" onClick={addRoadCardEdge}>
                        선택 간선 추가 ({roadCardEdges.join(", ") || "없음"})
                      </button>
                    </div>
                  )}
                  {(selectedDevCard?.type === "YEAR_OF_PLENTY" || selectedDevCard?.type === "MONOPOLY") && (
                    <div className="rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-violet-700">
                      {selectedDevCard.type === "YEAR_OF_PLENTY" ? "위의 두 자원 선택값을 1장씩 받습니다." : "왼쪽 자원 선택값을 모든 플레이어에게서 가져옵니다."}
                    </div>
                  )}
                  {selectedDevCard?.type === "YEAR_OF_PLENTY" && !yearOfPlentyWithinBank && (
                    <div className="rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-violet-700">
                      은행에 선택한 자원이 부족합니다. 다른 자원 조합을 선택해주세요.
                    </div>
                  )}
                  <button className="w-full rounded-xl bg-violet-700 px-3 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!canPlaySelectedDevelopmentCard} onClick={() => playDevelopmentCard().catch(() => toast.error("개발 카드 사용 조건을 확인해주세요."))}>
                    개발 카드 사용
                  </button>
                  {devCardAlreadyPlayedThisTurn && (
                    <div className="rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-violet-700">
                      개발 카드는 한 턴에 1장만 사용할 수 있습니다.
                    </div>
                  )}
                </div>
              )}
              {!citiesKnightsRule && !explorersPiratesRule && !!lockedDevelopmentCards.length && (
                <div className="rounded-2xl border border-violet-100 bg-violet-50 px-3 py-2 text-[11px] font-bold text-violet-700">
                  이번 턴에 구입한 개발 카드 {lockedDevelopmentCards.length}장은 다음 내 턴부터 사용할 수 있습니다.
                </div>
              )}
              {!citiesKnightsRule && !explorersPiratesRule && !playableDevelopmentCards.length && !!passiveDevelopmentVictoryCards.length && (
                <div className="rounded-2xl border border-violet-100 bg-violet-50 px-3 py-2 text-[11px] font-bold text-violet-700">
                  승점 개발 카드는 사용하지 않아도 내 점수에 자동 반영됩니다.
                </div>
              )}
              {pairedTurnRule && (
                <div className={`rounded-2xl border px-3 py-2 text-[11px] font-bold leading-relaxed ${activeSeatNo === catanianTwoSeatNo ? "border-lime-100 bg-lime-50 text-lime-700" : "border-amber-100 bg-amber-50 text-amber-800"}`}>
                  {pairedTurnActionNotice}
                </div>
              )}
              <button className="w-full rounded-xl bg-slate-100 px-3 py-3 text-sm font-black text-slate-700 disabled:opacity-40" disabled={!myTurn} onClick={() => onAction({ action_type: "END_TURN" }).catch(() => toast.error("턴 종료 실패"))}>
                턴 종료
              </button>
            </div>
          )}
          {phase === "FINISHED" && (
            <div className="rounded-xl bg-amber-50 px-3 py-3 text-sm font-black text-amber-800">
              {playerName(winnerSeatNo)} 승리
            </div>
          )}
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
          <div className="mb-3 text-sm font-black text-slate-900">내 자원</div>
          <div className="grid grid-cols-2 gap-2">
            {catanResourceEntries.map(([key, label]) => (
              <div key={key} className="rounded-xl bg-slate-50 px-3 py-2">
                <div className="text-[11px] font-bold text-slate-500">{label}</div>
                <div className="text-lg font-black text-slate-900">{resources?.[key] ?? 0}</div>
                <div className="text-[10px] font-bold text-slate-400">은행 {resourceBank?.[key] ?? "-"}장</div>
              </div>
            ))}
          </div>
          {citiesKnightsRule && (
            <>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {Object.entries(catanCommodityLabels).map(([key, label]) => (
                  <div key={key} className="rounded-xl bg-rose-50 px-3 py-2">
                    <div className="text-[11px] font-bold text-rose-600">{label}</div>
                    <div className="text-lg font-black text-slate-900">{commodities?.[key] ?? 0}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2">
                <div className="text-[11px] font-bold text-rose-600">도시 발전</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {Object.entries(catanImprovementLabels).map(([key, label]) => (
                    <span key={key} className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-rose-700">
                      {label} {cityImprovements?.[key] ?? 0}
                    </span>
                  ))}
                  {metropolisTypes.map((type) => (
                    <span key={type} className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-black text-white">
                      {catanImprovementLabels[type] || type} 대도시
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2">
                <div className="text-[11px] font-bold text-slate-600">진행 카드</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {progressCards.map((card) => {
                    const cardType = get(card, "type", "type", "");
                    const deckType = get(card, "deck_type", "deckType", "");
                    return (
                      <span key={card.id} className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black ${catanProgressTimingClass(cardType)}`}>
                        <span>{catanProgressLabels[cardType] || get(card, "title", "title", cardType)}</span>
                        {deckType ? <span className="text-[9px] opacity-70">· {catanImprovementLabels[deckType] || deckType}</span> : null}
                        <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[9px]">{catanProgressTimingLabel(cardType)}</span>
                      </span>
                    );
                  })}
                  {!progressCards.length && <span className="text-xs font-bold text-slate-300">없음</span>}
                </div>
              </div>
            </>
          )}
          {!citiesKnightsRule && !explorersPiratesRule && (
            <div className="mt-3 rounded-xl bg-violet-50 px-3 py-2">
              <div className="text-[11px] font-bold text-violet-600">개발 카드</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {developmentCards.map((card) => (
                  <span key={card.id} className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-violet-700">
                    {catanDevelopmentLabels[card.type] || card.type}{card.type === "VICTORY_POINT" ? " · 자동 승점" : ""}
                  </span>
                ))}
                {!developmentCards.length && <span className="text-xs font-bold text-violet-300">없음</span>}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
          <div className="mb-3 text-sm font-black text-slate-900">플레이어</div>
          <div className="space-y-2">
            {catanPlayers.map((player) => {
              const seatNo = Number(get(player, "seat_no", "seatNo", 0));
              const victoryPoints = Number(get(player, "victory_points", "victoryPoints", 0));
              const publicVictoryPoints = Number(get(player, "public_victory_points", "publicVictoryPoints", victoryPoints));
              const developmentVictoryPoints = Number(get(player, "development_victory_points", "developmentVictoryPoints", 0));
              const isMe = seatNo === mySeatNo;
              return (
                <div key={seatNo} className={`rounded-xl border px-3 py-2 ${activeSeatNo === seatNo ? "border-amber-200 bg-amber-50" : "border-slate-100 bg-slate-50"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full border border-slate-300" style={{ backgroundColor: catanColorFill[player.color] || "#111827" }} />
                      <div>
                        <div className="text-sm font-black text-slate-900">{playerName(seatNo)}</div>
                        <div className="text-[11px] font-bold text-slate-500">
                          {citiesKnightsRule
                            ? `자원 ${get(player, "resource_count", "resourceCount", 0)}장 · 상품 ${get(player, "commodity_count", "commodityCount", 0)}장 · 진행 ${get(player, "progress_card_count", "progressCardCount", 0)}장`
                            : `자원 ${get(player, "resource_count", "resourceCount", 0)}장 · 개발 ${get(player, "development_card_count", "developmentCardCount", 0)}장`}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-slate-900">{isMe ? victoryPoints : publicVictoryPoints}점</div>
                      <div className="text-[10px] font-bold text-slate-400">
                        {isMe && developmentVictoryPoints > 0 ? `공개 ${publicVictoryPoints} + 비공개 ${developmentVictoryPoints}` : "공개 승점"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-black">
                    {isMe && developmentVictoryPoints > 0 && <span className="rounded-full bg-violet-100 px-2 py-1 text-violet-700">비공개 승점 +{developmentVictoryPoints}</span>}
                    {get(player, "has_longest_road", "hasLongestRoad", false) && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">최장 교역로</span>}
                    {get(player, "has_largest_army", "hasLargestArmy", false) && <span className="rounded-full bg-violet-100 px-2 py-1 text-violet-700">최대 기사력</span>}
                    {get(player, "has_strongest_ports", "hasStrongestPorts", false) && <span className="rounded-full bg-teal-100 px-2 py-1 text-teal-700">강한 항구</span>}
                    {pairedTurnRule && seatNo === catanianOneSeatNo && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">카타니안 1</span>}
                    {pairedTurnRule && seatNo === catanianTwoSeatNo && <span className="rounded-full bg-lime-100 px-2 py-1 text-lime-700">카타니안 2</span>}
                    {friendlyRobberRule && Number(get(player, "public_victory_points", "publicVictoryPoints", get(player, "victory_points", "victoryPoints", 0))) <= 2 && <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">도둑 보호</span>}
                    <span className="rounded-full bg-white px-2 py-1 text-slate-500">도로 {get(player, "longest_road_length", "longestRoadLength", 0)}</span>
                    {tradersBarbariansRule && <span className="rounded-full bg-white px-2 py-1 text-teal-700">항구 {get(player, "harbor_points", "harborPoints", 0)}</span>}
                    {caravansRule && <span className="rounded-full bg-orange-50 px-2 py-1 text-orange-700">대상단 {get(player, "caravan_victory_points", "caravanVictoryPoints", 0)}</span>}
                    {barbarianAttackRule && <span className="rounded-full bg-red-50 px-2 py-1 text-red-700">포획 {get(player, "captured_barbarians", "capturedBarbarians", 0)} · 기사 {get(player, "remaining_barbarian_knights", "remainingBarbarianKnights", 0)}</span>}
                    {riversRule && <span className="rounded-full bg-cyan-50 px-2 py-1 text-cyan-700">골드 {get(player, "gold", "gold", 0)}</span>}
                    {riversRule && <span className="rounded-full bg-teal-50 px-2 py-1 text-teal-700">다리 {get(player, "remaining_bridges", "remainingBridges", 0)}</span>}
                    {riversRule && Boolean(get(player, "richest_settler", "richestSettler", false)) && <span className="rounded-full bg-yellow-100 px-2 py-1 text-yellow-800">부유한 정착민</span>}
                    {riversRule && Boolean(get(player, "poor_settler", "poorSettler", false)) && <span className="rounded-full bg-slate-200 px-2 py-1 text-slate-700">빈곤한 정착민</span>}
                    {fishermenRule && <span className="rounded-full bg-sky-50 px-2 py-1 text-sky-700">물고기 {get(player, "fishermen_fish_total", "fishermenFishTotal", 0)}마리</span>}
                    {fishermenRule && Boolean(get(player, "has_old_boot", "hasOldBoot", false)) && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">낡은 장화</span>}
                    {seafarersRule && !explorersPiratesRule && Number(get(player, "special_victory_points", "specialVictoryPoints", 0)) > 0 && <span className="rounded-full bg-cyan-100 px-2 py-1 text-cyan-700">외딴 섬 +{get(player, "special_victory_points", "specialVictoryPoints", 0)}</span>}
                    {seafarersScenarioCode === "FOUR_ISLANDS" && (get(player, "home_island_ids", "homeIslandIds", []) || []).length > 0 && <span className="rounded-full bg-white px-2 py-1 text-sky-700">홈 섬 {numberedAreaList(get(player, "home_island_ids", "homeIslandIds", []))}</span>}
                    {seafarersScenarioCode === "FOUR_ISLANDS" && (get(player, "settled_foreign_island_ids", "settledForeignIslandIds", []) || []).length > 0 && <span className="rounded-full bg-cyan-100 px-2 py-1 text-cyan-700">개척 섬 {numberedAreaList(get(player, "settled_foreign_island_ids", "settledForeignIslandIds", []))}</span>}
                    {throughDesertRule && (get(player, "settled_foreign_island_ids", "settledForeignIslandIds", []) || []).length > 0 && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">외국 지역 {numberedAreaList(get(player, "settled_foreign_island_ids", "settledForeignIslandIds", []))}</span>}
                    {forgottenTribeRule && Number(get(player, "forgotten_tribe_gifts_claimed", "forgottenTribeGiftsClaimed", 0)) > 0 && <span className="rounded-full bg-teal-100 px-2 py-1 text-teal-700">선물 {get(player, "forgotten_tribe_gifts_claimed", "forgottenTribeGiftsClaimed", 0)}</span>}
                    {forgottenTribeRule && Number(get(player, "forgotten_tribe_victory_points", "forgottenTribeVictoryPoints", 0)) > 0 && <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">부족 승점 +{get(player, "forgotten_tribe_victory_points", "forgottenTribeVictoryPoints", 0)}</span>}
                    {forgottenTribeRule && (get(player, "pending_forgotten_tribe_port_types", "pendingForgottenTribePortTypes", []) || []).length > 0 && <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">대기 항구 {(get(player, "pending_forgotten_tribe_port_types", "pendingForgottenTribePortTypes", []) || []).length}</span>}
                    {clothForCatanRule && <span className="rounded-full bg-fuchsia-100 px-2 py-1 text-fuchsia-700">직물 {get(player, "cloth_bolts", "clothBolts", 0)} · 승점 +{get(player, "cloth_victory_points", "clothVictoryPoints", 0)}</span>}
                    {clothForCatanRule && Number(get(player, "cloth_villages_connected", "clothVillagesConnected", 0)) > 0 && <span className="rounded-full bg-white px-2 py-1 text-fuchsia-700">연결 마을 {get(player, "cloth_villages_connected", "clothVillagesConnected", 0)}</span>}
                    {explorersPiratesRule && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">금 {get(player, "gold", "gold", 0)}</span>}
                    {explorersPiratesRule && <span className="rounded-full bg-sky-100 px-2 py-1 text-sky-700">항구 정착지 {get(player, "remaining_harbor_settlements", "remainingHarborSettlements", 0)}</span>}
                    {explorersPiratesRule && <span className="rounded-full bg-orange-100 px-2 py-1 text-orange-700">정착민 {get(player, "remaining_settlers", "remainingSettlers", 0)}</span>}
                    {explorersPiratesRule && <span className="rounded-full bg-violet-100 px-2 py-1 text-violet-700">승무원 {get(player, "remaining_crews", "remainingCrews", 0)}</span>}
                    {explorersPiratesRule && Number(get(player, "mission_victory_points", "missionVictoryPoints", 0)) > 0 && <span className="rounded-full bg-purple-100 px-2 py-1 text-purple-700">임무 {get(player, "mission_victory_points", "missionVictoryPoints", 0)}</span>}
                    {explorersPiratesRule && <span className="rounded-full bg-sky-50 px-2 py-1 text-sky-700">어획 {get(player, "fish_delivered", "fishDelivered", 0)}</span>}
                    {explorersPiratesRule && <span className="rounded-full bg-yellow-50 px-2 py-1 text-yellow-700">향신료 {get(player, "spice_delivered", "spiceDelivered", 0)}</span>}
                    {explorersPiratesRule && <span className="rounded-full bg-red-50 px-2 py-1 text-red-700">소굴 {get(player, "pirate_lairs_captured", "pirateLairsCaptured", 0)}</span>}
                    {explorersPiratesRule && Boolean(get(player, "best_fisher", "bestFisher", false)) && <span className="rounded-full bg-sky-600 px-2 py-1 text-white">최고 어부</span>}
                    {explorersPiratesRule && Boolean(get(player, "greatest_spice_merchant", "greatestSpiceMerchant", false)) && <span className="rounded-full bg-yellow-600 px-2 py-1 text-white">최고 향신료상</span>}
                    {explorersPiratesRule && Boolean(get(player, "greatest_pirate_scourge", "greatestPirateScourge", false)) && <span className="rounded-full bg-red-700 px-2 py-1 text-white">해적 소탕왕</span>}
                    {!citiesKnightsRule && !explorersPiratesRule && <span className="rounded-full bg-white px-2 py-1 text-slate-500">기사 {get(player, "played_knight_count", "playedKnightCount", 0)}</span>}
                    {seafarersRule && <span className="rounded-full bg-cyan-100 px-2 py-1 text-cyan-700">남은 배 {get(player, "remaining_ships", "remainingShips", 0)}</span>}
                    {citiesKnightsRule && <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-700">남은 기사 {get(player, "remaining_knights", "remainingKnights", 0)}</span>}
                    {citiesKnightsRule && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">성벽 {get(player, "city_wall_count", "cityWallCount", 0)}</span>}
                    {citiesKnightsRule && merchantSeatNo === seatNo && <span className="rounded-full bg-yellow-100 px-2 py-1 text-yellow-700">상인 {catanResourceLabels[merchantResourceType] || ""}</span>}
                    {citiesKnightsRule && merchantFleetSeatNo === seatNo && <span className="rounded-full bg-sky-100 px-2 py-1 text-sky-700">상선단 {catanTradeCardLabels[merchantFleetCardType] || ""}</span>}
                    {citiesKnightsRule && Number(get(player, "defender_points", "defenderPoints", 0)) > 0 && <span className="rounded-full bg-slate-900 px-2 py-1 text-white">방어자 {get(player, "defender_points", "defenderPoints", 0)}</span>}
                    {citiesKnightsRule && (get(player, "metropolis_types", "metropolisTypes", []) || []).map((type) => (
                      <span key={type} className="rounded-full bg-rose-100 px-2 py-1 text-rose-700">{catanImprovementLabels[type] || type} 대도시</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
          <div className="mb-3 text-sm font-black text-slate-900">기록</div>
          <div className="space-y-2">
            {events.slice(-6).reverse().map((event) => (
              <div key={get(event, "event_no", "eventNo", 0)} className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
                {get(event, "event_no", "eventNo", 0)} · {catanEventLabels[get(event, "event_type", "eventType", "")] || get(event, "event_type", "eventType", "")} · {playerName(get(event, "seat_no", "seatNo", 0))}
                {get(event, "target_seat_no", "targetSeatNo", 0) ? ` → ${playerName(get(event, "target_seat_no", "targetSeatNo", 0))}` : ""}
                {get(event, "resource_type", "resourceType", "") ? ` · ${catanResourceLabels[get(event, "resource_type", "resourceType", "")] || catanCommodityLabels[get(event, "resource_type", "resourceType", "")] || catanCargoLabels[get(event, "resource_type", "resourceType", "")] || catanSpiceAdvantageLabels[get(event, "resource_type", "resourceType", "")] || catanTerrain[get(event, "resource_type", "resourceType", "")]?.label || catanImprovementLabels[get(event, "resource_type", "resourceType", "")] || catanEventDieLabels[get(event, "resource_type", "resourceType", "")] || catanProgressLabels[get(event, "resource_type", "resourceType", "")] || catanDevelopmentLabels[get(event, "resource_type", "resourceType", "")] || get(event, "resource_type", "resourceType", "")}` : ""}
              </div>
            ))}
            {!events.length && <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-400">아직 기록 없음</div>}
          </div>
        </div>
      </aside>
    </div>
  );
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
  const stompRef = useRef(null);
  const gameSubRef = useRef(null);
  const busyRef = useRef(false);
  const actionBusyRef = useRef(false);
  const lobbyLoadSeqRef = useRef(0);
  const roomOpenSeqRef = useRef(0);
  const mountedRef = useRef(false);

  const myMemberId = Number(user?.member_id || user?.memberId || user?.id || 0);
  const players = playersOf(selectedRoom);
  const mySeatNo = seatNoOf(players.find((player) => memberIdOf(player) === myMemberId));
  const status = statusOf(selectedRoom);
  const isHost = selectedRoom && hostMemberIdOf(selectedRoom) === myMemberId;
  const guestPlayers = players.filter((player) => memberIdOf(player) !== hostMemberIdOf(selectedRoom));
  const readyGuestCount = guestPlayers.filter(isReady).length;
  const readyGuests = guestPlayers.every(isReady);
  const roomPlayerCount = players.length;
  const roomMinPlayers = minPlayersOf(selectedRoom);
  const roomMaxPlayers = maxPlayersOf(selectedRoom);
  const enoughPlayers = roomPlayerCount >= roomMinPlayers;
  const withinMaxPlayers = roomMaxPlayers <= 0 || roomPlayerCount <= roomMaxPlayers;
  const startChecks = [
    {
      key: "players",
      done: enoughPlayers && withinMaxPlayers,
      label: "인원 조건",
      detail: `${roomPlayerCount}/${roomMaxPlayers || "-"}명 · 최소 ${roomMinPlayers}명`,
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
  const canStart = isHost && status === "WAITING" && enoughPlayers && withinMaxPlayers && readyGuests;
  const myRoomPlayer = players.find((player) => memberIdOf(player) === myMemberId);
  const myReady = Boolean(myRoomPlayer && isReady(myRoomPlayer));
  const startStatusText = canStart
    ? "시작 가능"
    : startChecks.find((check) => !check.done)?.detail || "시작 대기";
  const selectedVariant = useMemo(() => variants.find((variant) => variant.code === createForm.variantCode) || variants[0], [variants, createForm.variantCode]);
  const selectedSettingsVariant = useMemo(() => variants.find((variant) => variant.code === settingsForm.variantCode), [variants, settingsForm.variantCode]);
  const selectedRoomVariant = useMemo(() => variantForRoom(selectedRoom, variants), [selectedRoom, variants]);
  const selectedRoomVariantName = variantNameOf(selectedRoom) || variantDisplayName(selectedRoomVariant) || "선택한 규칙";
  const selectedRoomVariantTags = variantFeatureTags(game, selectedRoomVariant);
  const selectedRoomPlayerRangeText = roomMinPlayers === roomMaxPlayers
    ? `${roomMinPlayers}명 전용`
    : `${roomMinPlayers}~${roomMaxPlayers || "-"}명`;
  const startRuleHint = `${selectedRoomVariantName}은 ${selectedRoomPlayerRangeText} 규칙입니다. ${
    selectedRoomVariantTags.length ? `핵심 규칙: ${selectedRoomVariantTags.join(" · ")}. ` : ""
  }게스트가 모두 준비하면 방장이 시작할 수 있습니다.`;
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

  const fetchVariants = async (seq = lobbyLoadSeqRef.current) => {
    const nextVariants = await tabletopGameAdapter.fetchVariants(game);
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
    const nextRooms = await tabletopGameAdapter.fetchRooms(game);
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
      toast.error("방 목록을 새로고침하지 못했습니다.");
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
      toast.error("게임 설정 또는 방 목록을 불러오지 못했습니다.");
    }
    setInitialLoading(false);
  };

  const fetchMyRooms = async () => {
    return tabletopGameAdapter.fetchMyRooms(game);
  };

  const clearRoomSelection = (roomId) => {
    roomOpenSeqRef.current += 1;
    realtimeRoomRef.current = null;
    setSelectedRoom(null);
    setGameState(null);
    const storedId = localStorage.getItem(config.storageKey);
    if (!roomId || storedId === String(roomId)) {
      localStorage.removeItem(config.storageKey);
    }
    if (gameSubRef.current) {
      gameSubRef.current.unsubscribe();
      gameSubRef.current = null;
    }
  };

  const handleStateLoadError = (error, roomId, fallbackMessage) => {
    if (isTabletopStateAccessError(error)) {
      clearRoomSelection(roomId);
      toast.error("방 참가자만 상태를 볼 수 있습니다. 다시 입장해주세요.");
      return;
    }
    toast.error(fallbackMessage);
  };

  const fetchState = async (roomId, roomSeq = null) => {
    const payload = await tabletopGameAdapter.fetchState(game, roomId);
    if (!mountedRef.current) return null;
    if (roomSeq !== null && !isLatestRoomOpen(roomSeq)) return null;
    const room = payload?.room || null;
    if (room) setSelectedRoom(room);
    setGameState(payload?.gameState || null);
    return room;
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
      if (payload.room) setSelectedRoom(payload.room);
      if ((game === "dalmuti" || game === "catan") && payload.gameState) {
        fetchState(roomId, roomSeq).catch((error) => {
          if (isLatestRoomOpen(roomSeq)) handleStateLoadError(error, roomId, "비공개 정보를 갱신하지 못했습니다.");
        });
      } else {
        setGameState(payload.gameState || null);
      }
      if (payload.message) toast(payload.message);
    });
    await fetchState(roomId, roomSeq);
  };

  const bindLatestRealtimeRoom = async (client) => {
    const target = realtimeRoomRef.current;
    if (!target) return;
    await bindRealtimeRoom(client, target.roomId, target.roomSeq);
  };

  const ensureSocket = () => {
    if (stompRef.current) return stompRef.current;
    const connectHeaders = buildStompConnectHeaders();
    if (!connectHeaders.Authorization) return null;
    const client = new Client({
      webSocketFactory: () => new SockJS("/ws/chat"),
      connectHeaders,
      reconnectDelay: 3000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });
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
    client.onStompError = () => toast.error("실시간 연결 오류");
    client.activate();
    stompRef.current = client;
    return client;
  };

  const openRoom = async (room) => {
    if (!mountedRef.current) return;
    const roomSeq = ++roomOpenSeqRef.current;
    setSelectedRoom(room);
    const roomId = idOf(room);
    if (!roomId) return;
    localStorage.setItem(config.storageKey, String(roomId));
    setSettingsForm({
      variantCode: variantCodeOf(room),
      turnTimeSeconds: String(turnSecondsOf(room)),
    });

    realtimeRoomRef.current = { roomId, roomSeq };
    const client = ensureSocket();
    await fetchState(roomId, roomSeq).catch((error) => {
      if (!isLatestRoomOpen(roomSeq)) return;
      handleStateLoadError(error, roomId, "방 정보를 불러오지 못했습니다.");
      throw error;
    });
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
          toast.error("게임 설정 또는 방 목록을 불러오지 못했습니다.");
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
        if (room) await openRoom(room);
      } catch {
        if (!active) return;
        setSelectedRoom(null);
        setGameState(null);
      }
    })();
    return () => {
      active = false;
      if (gameSubRef.current) gameSubRef.current.unsubscribe();
      if (stompRef.current) stompRef.current.deactivate();
      realtimeRoomRef.current = null;
      stompRef.current = null;
      gameSubRef.current = null;
    };
  }, [game]);

  const createRoom = async (event) => {
    event.preventDefault();
    if (busyRef.current) {
      toast("이전 방 요청을 처리하는 중입니다.");
      return;
    }
    busyRef.current = true;
    try {
      setBusy(true);
      const room = await tabletopGameAdapter.createRoom(game, {
        title: createForm.title,
        variantCode: createForm.variantCode,
        turnTimeSeconds: Number(createForm.turnTimeSeconds || 30),
      });
      await openRoom(room);
      await fetchRooms();
      toast.success("방 생성 완료");
    } catch {
      toast.error("방 생성 실패");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const joinRoom = async (roomId) => {
    if (busyRef.current) {
      toast("이전 방 요청을 처리하는 중입니다.");
      return;
    }
    busyRef.current = true;
    try {
      setBusy(true);
      const room = await tabletopGameAdapter.joinRoom(game, roomId);
      await openRoom(room);
      await fetchRooms();
      toast.success("방 입장 완료");
    } catch {
      toast.error("방 입장 실패");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const joinByCode = async (event) => {
    event.preventDefault();
    if (busyRef.current) {
      toast("이전 방 요청을 처리하는 중입니다.");
      return;
    }
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      toast.error("방 코드를 입력해주세요.");
      return;
    }
    busyRef.current = true;
    try {
      setBusy(true);
      const room = await tabletopGameAdapter.joinByCode(game, code);
      setJoinCode("");
      await openRoom(room);
      await fetchRooms();
      toast.success("방 코드로 입장했습니다.");
    } catch {
      toast.error("방 코드 입장 실패");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const saveSettings = async () => {
    if (!selectedRoom) return;
    if (busyRef.current) {
      toast("이전 방 요청을 처리하는 중입니다.");
      return;
    }
    if (selectedSettingsTooManyPlayers) {
      toast.error(`현재 ${players.length}명이라 이 규칙으로 변경할 수 없습니다.`);
      return;
    }
    busyRef.current = true;
    try {
      setBusy(true);
      const room = await tabletopGameAdapter.updateSettings(game, idOf(selectedRoom), {
        variantCode: settingsForm.variantCode,
        turnTimeSeconds: Number(settingsForm.turnTimeSeconds || 30),
      });
      setSelectedRoom(room);
      setGameState(null);
      await fetchRooms();
      toast.success("방 설정 저장 완료");
    } catch {
      toast.error("방 설정 저장 실패");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const toggleReady = async () => {
    if (!selectedRoom) return;
    if (busyRef.current) {
      toast("이전 방 요청을 처리하는 중입니다.");
      return;
    }
    busyRef.current = true;
    try {
      setBusy(true);
      await tabletopGameAdapter.toggleReady(game, idOf(selectedRoom));
    } catch {
      toast.error("준비 상태 변경 실패");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const startGame = async () => {
    if (!selectedRoom) return;
    if (busyRef.current) {
      toast("이전 방 요청을 처리하는 중입니다.");
      return;
    }
    busyRef.current = true;
    try {
      setBusy(true);
      await tabletopGameAdapter.startGame(game, idOf(selectedRoom));
      await fetchState(idOf(selectedRoom));
      toast.success("게임 시작");
    } catch {
      toast.error("인원과 준비 상태를 확인해주세요.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const sendAction = async (payload) => {
    if (!selectedRoom) return;
    if (actionBusyRef.current) {
      toast("이전 행동을 처리하는 중입니다.");
      return;
    }
    actionBusyRef.current = true;
    setActionBusy(true);
    try {
      const result = await tabletopGameAdapter.sendAction(game, idOf(selectedRoom), payload);
      if (result?.room) setSelectedRoom(result.room);
      setGameState(result?.gameState || null);
      return result;
    } finally {
      actionBusyRef.current = false;
      setActionBusy(false);
    }
  };

  const forceFinish = async () => {
    if (!selectedRoom) return;
    if (busyRef.current) {
      toast("이전 방 요청을 처리하는 중입니다.");
      return;
    }
    busyRef.current = true;
    try {
      setBusy(true);
      const room = await tabletopGameAdapter.forceFinish(game, idOf(selectedRoom));
      setSelectedRoom(room);
      setGameState(null);
      toast.success("대기방으로 돌아왔습니다.");
    } catch {
      toast.error("게임 종료 실패");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const rematch = async () => {
    if (!selectedRoom) return;
    if (busyRef.current) {
      toast("이전 방 요청을 처리하는 중입니다.");
      return;
    }
    busyRef.current = true;
    try {
      setBusy(true);
      const room = await tabletopGameAdapter.rematch(game, idOf(selectedRoom));
      setSelectedRoom(room);
      setGameState(null);
      toast.success("다시 준비합니다.");
    } catch {
      toast.error("다시 하기 실패");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const leaveRoom = async () => {
    if (!selectedRoom) return;
    if (busyRef.current) {
      toast("이전 방 요청을 처리하는 중입니다.");
      return;
    }
    busyRef.current = true;
    try {
      setBusy(true);
      const roomId = idOf(selectedRoom);
      await tabletopGameAdapter.leaveRoom(game, roomId);
      clearRoomSelection(roomId);
      await fetchRooms();
      toast.success("방 퇴장 완료");
    } catch {
      toast.error("방 퇴장 실패");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const copySelectedRoomCode = async () => {
    const roomCode = codeOf(selectedRoom);
    if (!roomCode || typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      toast.error("방 코드를 복사할 수 없습니다.");
      return;
    }
    try {
      await navigator.clipboard.writeText(roomCode);
      toast.success("방 코드 복사 완료");
    } catch {
      toast.error("방 코드를 복사할 수 없습니다.");
    }
  };

  if (!config) return null;

  return (
    <div className={`tabletop-game tabletop-${game} animate-fade-in space-y-6`}>
      <section className={`overflow-hidden rounded-2xl bg-gradient-to-br ${config.accent} p-[1px] shadow-2xl sm:rounded-[2rem]`}>
        <div className="bg-white p-5 sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1 text-[11px] font-black text-slate-500">
            <Dices className="h-3.5 w-3.5 text-primary-500" />
            {config.eyebrow}
          </div>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-slate-900 sm:text-4xl">{config.title}</h1>
          <p className="mt-3 max-w-3xl text-sm font-medium leading-relaxed text-slate-600 sm:text-base">{config.description}</p>
        </div>
      </section>

      {!selectedRoom && (
        <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]" aria-busy={initialLoading ? "true" : "false"}>
          <form onSubmit={createRoom} className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg sm:p-5" aria-label={`${config.title} 방 만들기`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-lg font-black text-slate-900">방 만들기</div>
              {initialLoading && <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-black text-sky-700">불러오는 중</span>}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3">
              <input
                className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="방 제목"
                aria-label="방 제목"
                value={createForm.title}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
              />
              <select
                className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
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
              <input
                type="text"
                inputMode="numeric"
                className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="턴 시간(초)"
                aria-label="턴 시간 초"
                value={createForm.turnTimeSeconds}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, turnTimeSeconds: event.target.value.replace(/[^\d]/g, "") }))}
                onBlur={() => setCreateForm((prev) => ({ ...prev, turnTimeSeconds: clampDigits(prev.turnTimeSeconds, 5, 180, 30) }))}
              />
              {selectedVariant && (
                <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
                  <span className="mb-1 inline-flex rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-700">
                    {variantGroupLabel(game, selectedVariant)}
                  </span>
                  <div>
                    {get(selectedVariant, "summary", "summary", "")} · {get(selectedVariant, "min_players", "minPlayers", 0)}~{get(selectedVariant, "max_players", "maxPlayers", 0)}명
                  </div>
                  <VariantFeatureTags game={game} variant={selectedVariant} className="mt-2" />
                </div>
              )}
              <button type="submit" className="min-h-11 rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white disabled:opacity-50" disabled={busy || initialLoading || !variants.length} aria-label={`${config.title} ${variantDisplayName(selectedVariant)} 방 만들기`}>
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
            <form onSubmit={joinByCode} className="mt-4 flex flex-col gap-2 sm:flex-row" aria-label={`${config.title} 방 코드 입장`}>
              <input
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase"
                placeholder="방 코드로 입장"
                aria-label="방 코드"
                value={joinCode}
                maxLength={8}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              />
              <button type="submit" className="min-h-11 rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white disabled:opacity-50" disabled={busy || initialLoading || !joinCode.trim()} aria-label={`${joinCode.trim() || "입력한"} 방 코드로 입장`}>
                입장
              </button>
            </form>
            <div className="mt-4 space-y-2.5">
              {initialLoading && !rooms.length && <div className="rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-400" role="status" aria-live="polite">대기방을 불러오는 중입니다.</div>}
              {!initialLoading && !rooms.length && <div className="rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-400">대기 중인 방이 없습니다.</div>}
              {rooms.map((room) => {
                const roomVariant = variantForRoom(room, variants);
                const listedPlayers = playersOf(room);
                const listedMaxPlayers = maxPlayersOf(room);
                const alreadyInListedRoom = listedPlayers.some((player) => memberIdOf(player) === myMemberId);
                const listedRoomFull = listedMaxPlayers > 0 && listedPlayers.length >= listedMaxPlayers;
                const listedJoinDisabled = busy || (listedRoomFull && !alreadyInListedRoom);
                return (
                  <div key={idOf(room)} className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="break-words text-sm font-black text-slate-900">{room.title}</div>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-black">
                        <span className="rounded-full bg-white px-2 py-1 text-slate-600">{variantGroupLabel(game, roomVariant)}</span>
                        <span className={`rounded-full px-2 py-1 ${listedRoomFull ? "bg-rose-50 text-rose-700" : "bg-white text-slate-600"}`}>
                          {listedPlayers.length}/{listedMaxPlayers}명{listedRoomFull ? " · 가득 참" : ""}
                        </span>
                        <span className="rounded-full bg-white px-2 py-1 text-slate-600">코드 {codeOf(room)}</span>
                        {alreadyInListedRoom && <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">참가 중</span>}
                      </div>
                      <div className="mt-2 break-words text-xs font-bold leading-relaxed text-slate-500">
                        {variantNameOf(room)} · {variantSummaryOf(room) || get(roomVariant, "summary", "summary", "")}
                      </div>
                      <VariantFeatureTags game={game} variant={roomVariant} className="mt-2" />
                    </div>
                    <button
                      className="min-h-11 w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[84px]"
                      disabled={listedJoinDisabled}
                      onClick={() => (alreadyInListedRoom ? openRoom(room) : joinRoom(idOf(room)))}
                      aria-label={`${room.title} ${variantNameOf(room)} ${listedPlayers.length}/${listedMaxPlayers}명 ${alreadyInListedRoom ? "열기" : listedRoomFull ? "가득 참" : "입장"}`}
                      title={`${room.title} · ${variantNameOf(room)} · ${listedPlayers.length}/${listedMaxPlayers}명`}
                    >
                      {alreadyInListedRoom ? "열기" : listedRoomFull ? "가득 참" : "입장"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </section>
      )}

      {selectedRoom && (
        <section className="space-y-4">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="break-words text-xl font-black text-slate-900">{selectedRoom.title}</div>
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
                <div className="mt-2 break-words text-xs font-bold leading-relaxed text-slate-500">
                  {variantSummaryOf(selectedRoom) || get(selectedRoomVariant, "summary", "summary", "")}
                </div>
                <VariantFeatureTags game={game} variant={selectedRoomVariant} className="mt-2" />
              </div>
              <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:flex sm:flex-wrap">
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
                {isHost && status === "WAITING" && (
                  <button className="min-h-11 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white disabled:opacity-40" disabled={!canStart || busy} onClick={startGame} aria-label={canStart ? `${selectedRoom.title} 게임 시작` : `${selectedRoom.title} 시작 대기: ${startStatusText}`} title={canStart ? "게임 시작" : startStatusText}>
                    {canStart ? "시작" : "시작 대기"}
                  </button>
                )}
                <button className="min-h-11 rounded-xl bg-rose-50 px-4 py-2 text-sm font-black text-rose-600 disabled:opacity-40" disabled={busy} onClick={leaveRoom} aria-label={`${selectedRoom.title} 방 퇴장`}>
                  퇴장
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
              <div className="rounded-xl bg-slate-50 px-3 py-2" role="status" aria-live="polite" aria-atomic="true"><div className="font-black text-slate-700">상태</div><div className="font-bold text-slate-500">{statusLabels[status] || status}</div></div>
              <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="font-black text-slate-700">규칙</div><div className="font-bold text-slate-500">{variantGroupLabel(game, selectedRoomVariant)}</div></div>
              <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="font-black text-slate-700">인원</div><div className="font-bold text-slate-500">{players.length}/{maxPlayersOf(selectedRoom)}명</div></div>
              <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="font-black text-slate-700">최소 인원</div><div className="font-bold text-slate-500">{minPlayersOf(selectedRoom)}명</div></div>
              <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="font-black text-slate-700">턴 시간</div><div className="font-bold text-slate-500">{turnSecondsOf(selectedRoom)}초</div></div>
              <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="font-black text-slate-700">방장</div><div className="font-bold text-slate-500">{players.find((player) => memberIdOf(player) === hostMemberIdOf(selectedRoom))?.nickname || "-"}</div></div>
            </div>

            {status === "WAITING" && (
              <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-black text-slate-900">시작 조건</div>
                  <div className={`rounded-full px-3 py-1 text-[11px] font-black ${canStart ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {startStatusText}
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  {startChecks.map((check) => (
                    <div key={check.key} className={`rounded-xl border px-3 py-2 ${check.done ? "border-emerald-100 bg-white text-emerald-700" : "border-amber-100 bg-white text-amber-700"}`}>
                      <div className="flex items-center gap-2 text-xs font-black">
                        <span className={`h-2.5 w-2.5 rounded-full ${check.done ? "bg-emerald-500" : "bg-amber-400"}`} />
                        {check.label}
                      </div>
                      <div className="mt-1 text-[11px] font-bold leading-relaxed text-slate-500">{check.detail}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-[11px] font-bold leading-relaxed text-slate-500">
                  {startRuleHint}
                </div>
              </div>
            )}

            {isHost && status === "WAITING" && (
              <div className="mt-4 grid grid-cols-1 gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 md:grid-cols-[1fr_140px_140px]">
                <select
                  className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
                  value={settingsForm.variantCode}
                  aria-label="방 규칙 변경"
                  onChange={(event) => setSettingsForm((prev) => ({ ...prev, variantCode: event.target.value }))}
                >
                  <VariantOptions game={game} variants={variants} disabledCodes={settingsDisabledVariantCodes} />
                </select>
                <input
                  type="text"
                  inputMode="numeric"
                  className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={settingsForm.turnTimeSeconds}
                  aria-label="방 턴 시간 초 변경"
                  onChange={(event) => setSettingsForm((prev) => ({ ...prev, turnTimeSeconds: event.target.value.replace(/[^\d]/g, "") }))}
                  onBlur={() => setSettingsForm((prev) => ({ ...prev, turnTimeSeconds: clampDigits(prev.turnTimeSeconds, 5, 180, 30) }))}
                />
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
                    <div className="mb-1 flex flex-wrap gap-1.5 text-[10px] font-black">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{variantGroupLabel(game, selectedSettingsVariant)}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                        {get(selectedSettingsVariant, "min_players", "minPlayers", 0)}~{get(selectedSettingsVariant, "max_players", "maxPlayers", 0)}명
                      </span>
                    </div>
                    <div>{get(selectedSettingsVariant, "summary", "summary", "")}</div>
                    <VariantFeatureTags game={game} variant={selectedSettingsVariant} className="mt-2" />
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

          {gameState && <MobileGameJumpNav game={game} />}

          <div className="tabletop-board-shell relative" aria-busy={actionBusy ? "true" : "false"}>
            {actionBusy && gameState && (
              <div className="absolute inset-0 z-40 flex items-start justify-center rounded-[1.5rem] bg-white/55 p-4 backdrop-blur-[1px]">
                <div className="sticky top-4 rounded-full border border-sky-100 bg-white px-4 py-2 text-xs font-black text-sky-700 shadow-lg" role="status" aria-live="polite" aria-atomic="true">
                  서버 판정 중 · 잠시만 기다려주세요
                </div>
              </div>
            )}
            {game === "blokus" && gameState ? (
              <BlokusBoard room={selectedRoom} gameState={gameState} mySeatNo={mySeatNo} onAction={sendAction} />
            ) : game === "catan" && gameState ? (
              <CatanBoard gameState={gameState} players={players} mySeatNo={mySeatNo} onAction={sendAction} />
            ) : game === "mahe" && gameState ? (
              <MaheBoard gameState={gameState} players={players} mySeatNo={mySeatNo} onAction={sendAction} />
            ) : game === "dalmuti" && gameState ? (
              <DalmutiBoard gameState={gameState} players={players} mySeatNo={mySeatNo} onAction={sendAction} />
            ) : (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
                  <div className="mb-4 flex items-center gap-2 text-sm font-black text-slate-900">
                    <Shield className="h-4 w-4 text-primary-600" />
                    플레이 보드
                  </div>
                  <div className="flex justify-center">
                    <BoardPreview type={config.board} room={selectedRoom} />
                  </div>
                  <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-bold leading-relaxed text-slate-600">
                    {status === "PLAYING" ? "게임 상태를 불러오는 중입니다. 잠시 후 방을 다시 열어주세요." : "모든 참가자가 준비하면 방장이 게임을 시작할 수 있습니다."}
                  </div>
                </div>

                <aside className="space-y-4">
                  <PlayersPanel players={players} selectedRoom={selectedRoom} status={status} />
                  <GuidePanel lines={config.guide} />
                </aside>
              </div>
            )}

            {(game === "catan" || game === "blokus" || game === "mahe" || game === "dalmuti") && gameState && (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div />
                <aside className="space-y-4">
                  <PlayersPanel players={players} selectedRoom={selectedRoom} status={status} />
                  <GuidePanel lines={config.guide} />
                </aside>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

const PlayersPanel = ({ players, selectedRoom, status }) => (
  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
    <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
      <Users className="h-4 w-4" />
      플레이어
    </div>
    <div className="space-y-2">
      {players.map((player) => {
        const pid = memberIdOf(player);
        const host = pid === hostMemberIdOf(selectedRoom);
        return (
          <div key={pid} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-black text-slate-900">{player.nickname}</div>
              <div className="text-[11px] font-bold text-slate-500">{host ? "방장" : `좌석 ${seatNoOf(player)}`}</div>
            </div>
            {status === "WAITING" && host && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-700">
                <Crown className="h-3.5 w-3.5" />
                방장
              </span>
            )}
            {status === "WAITING" && !host && (
              <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black ${isReady(player) ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                {isReady(player) ? "준비" : "대기"}
              </span>
            )}
            {host && status !== "WAITING" && <Crown className="h-4 w-4 text-amber-500" />}
          </div>
        );
      })}
    </div>
  </div>
);

const GuidePanel = ({ lines }) => (
  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
    <div className="flex items-center justify-between gap-2">
      <div className="text-sm font-black text-slate-900">규칙 기준</div>
      <div className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">서버 판정</div>
    </div>
    <div className="mt-3 space-y-2">
      {lines.map((line) => {
        if (typeof line === "string") {
          return (
            <div key={line} className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold leading-relaxed text-slate-500">
              {line}
            </div>
          );
        }
        const items = Array.isArray(line.items) ? line.items : [];
        return (
          <div key={line.title} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            <div className="text-xs font-black text-slate-800">{line.title}</div>
            <div className="mt-1 space-y-1 text-[11px] font-bold leading-relaxed text-slate-500">
              {items.map((item) => (
                <div key={item} className="flex gap-1.5">
                  <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

export const CatanGame = () => <TabletopGame game="catan" />;
export const BlokusGame = () => <TabletopGame game="blokus" />;
export const MaheGame = () => <TabletopGame game="mahe" />;
export const DalmutiGame = () => <TabletopGame game="dalmuti" />;

export default TabletopGame;
