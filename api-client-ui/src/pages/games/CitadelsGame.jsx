import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Coins, Crown, Hammer, RefreshCw, Shield, Sparkles, Target, Users } from "lucide-react";
import { notify, notifyError, notifySuccess } from "../../utils/toast.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import {
  getTabletopMemberId,
  getTabletopRoomCode,
  getTabletopRoomId,
  getTabletopRoomStatus,
  getTabletopSeatNo,
  isTabletopReadyPlayer,
  normalizeTabletopStatePayload,
  tabletopGameAdapter,
} from "../../adapters/tabletopGameAdapter.js";
import { buildStompConnectHeaders, createStompClient, notifyRealtimeError } from "../../adapters/realtimeAdapter.js";
import { useGameSound } from "../../hooks/useGameSound.js";
import { confirmAction } from "../../common/confirmAction.jsx";
import GameRoomChatPanel from "../../common/GameRoomChatPanel.jsx";
import GameRoomPlayersPanel from "../../common/GameRoomPlayersPanel.jsx";
import { clearPageGuideContext, setPageGuideContext } from "../../common/pageGuideContext.js";
import { GameActionCueBar, GameFlowMeter, GameResultSpotlight, GameStartReadinessPanel, GameUxGlyph } from "./GameUxAssets.jsx";
import { TabletopGameArtwork } from "./TabletopGameArtwork.jsx";
import { canUseTabletopSoloAiStart } from "./tabletopStartPolicy.js";

const GAME_CODE = "citadels";
const ROOM_STORAGE_KEY = "citadels_last_room_id";
const ROOM_TITLE_STORAGE_KEY = "citadels_last_room_title";

const statusLabels = {
  WAITING: "대기 중",
  PLAYING: "진행 중",
  FINISHED: "종료",
};

const characterLabels = {
  ASSASSIN: "암살자",
  THIEF: "도둑",
  MAGICIAN: "마술사",
  KING: "왕",
  BISHOP: "주교",
  MERCHANT: "상인",
  ARCHITECT: "건축가",
  WARLORD: "장군",
};

const characterHelp = {
  ASSASSIN: "한 캐릭터를 지정해 이번 라운드 차례를 건너뜁니다.",
  THIEF: "호출될 캐릭터를 지정해 그 플레이어의 금화를 가져옵니다.",
  MAGICIAN: "손패를 다른 플레이어와 교환하거나 원하는 만큼 새로 뽑습니다.",
  KING: "귀족 구역 수입을 받고 다음 라운드 선택 우선권을 가져옵니다.",
  BISHOP: "종교 구역 수입을 받고 장군의 파괴에서 보호됩니다.",
  MERCHANT: "상업 구역 수입과 추가 금화 1개를 얻습니다.",
  ARCHITECT: "카드 2장을 추가로 뽑고 이번 턴 최대 3개까지 지을 수 있습니다.",
  WARLORD: "군사 구역 수입을 받고 다른 도시의 구역을 파괴할 수 있습니다.",
};

const colorLabels = {
  YELLOW: "귀족",
  BLUE: "종교",
  GREEN: "상업",
  RED: "군사",
  PURPLE: "특수",
};

const phaseLabels = {
  CHARACTER_SELECTION: "캐릭터 선택",
  DISTRICT_CHOICE: "구역 카드 선택",
  GRAVEYARD_CHOICE: "묘지 선택",
  TURN_ACTION: "차례 행동",
  FINISHED: "게임 종료",
};

const districtNameLabels = {
  TEMPLE: "사원",
  CHURCH: "교회",
  MONASTERY: "수도원",
  CATHEDRAL: "대성당",
  WATCHTOWER: "감시탑",
  PRISON: "감옥",
  BATTLEFIELD: "전장",
  FORTRESS: "요새",
  TAVERN: "선술집",
  MARKET: "시장",
  TRADING_POST: "교역소",
  DOCKS: "부두",
  HARBOR: "항구",
  TOWN_HALL: "시청",
  MANOR: "영지",
  CASTLE: "성",
  PALACE: "궁전",
  HAUNTED_CITY: "유령 도시",
  KEEP: "성채",
  LABORATORY: "실험실",
  SMITHY: "대장간",
  OBSERVATORY: "천문대",
  LIBRARY: "도서관",
  GRAVEYARD: "묘지",
  DRAGON_GATE: "용의 문",
  UNIVERSITY: "대학교",
  MAGIC_SCHOOL: "마법 학교",
  GREAT_WALL: "만리장성",
  QUARRY: "채석장",
};

const colorClasses = {
  YELLOW: "border-amber-200 bg-amber-50 text-amber-800",
  BLUE: "border-sky-200 bg-sky-50 text-sky-800",
  GREEN: "border-emerald-200 bg-emerald-50 text-emerald-800",
  RED: "border-rose-200 bg-rose-50 text-rose-800",
  PURPLE: "border-violet-200 bg-violet-50 text-violet-800",
};

const colorOrder = ["YELLOW", "BLUE", "GREEN", "RED", "PURPLE"];

const citadelsDistrictArtTones = {
  YELLOW: { sky: "#fef3c7", wall: "#f59e0b", roof: "#92400e", mark: "#fbbf24" },
  BLUE: { sky: "#e0f2fe", wall: "#38bdf8", roof: "#075985", mark: "#0ea5e9" },
  GREEN: { sky: "#d1fae5", wall: "#34d399", roof: "#065f46", mark: "#10b981" },
  RED: { sky: "#ffe4e6", wall: "#fb7185", roof: "#9f1239", mark: "#f43f5e" },
  PURPLE: { sky: "#ede9fe", wall: "#a78bfa", roof: "#4c1d95", mark: "#8b5cf6" },
  DEFAULT: { sky: "#f1f5f9", wall: "#94a3b8", roof: "#334155", mark: "#64748b" },
};

const incomeColorByCharacter = {
  KING: "YELLOW",
  BISHOP: "BLUE",
  MERCHANT: "GREEN",
  WARLORD: "RED",
};

const lobbyCharacterPreview = [
  { code: "ASSASSIN", rank: 1, icon: Target, tone: "bg-rose-50 text-rose-700 border-rose-100" },
  { code: "THIEF", rank: 2, icon: Coins, tone: "bg-amber-50 text-amber-700 border-amber-100" },
  { code: "MAGICIAN", rank: 3, icon: Sparkles, tone: "bg-violet-50 text-violet-700 border-violet-100" },
  { code: "KING", rank: 4, icon: Crown, tone: "bg-yellow-50 text-yellow-700 border-yellow-100" },
  { code: "BISHOP", rank: 5, icon: Shield, tone: "bg-sky-50 text-sky-700 border-sky-100" },
  { code: "MERCHANT", rank: 6, icon: Coins, tone: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  { code: "ARCHITECT", rank: 7, icon: Hammer, tone: "bg-slate-50 text-slate-700 border-slate-100" },
  { code: "WARLORD", rank: 8, icon: Target, tone: "bg-red-50 text-red-700 border-red-100" },
];

const characterRankByCode = Object.fromEntries(lobbyCharacterPreview.map((character) => [character.code, character.rank]));

const CitadelsLobbyPreview = ({ roomCode = "LOBBY", compact = false }) => (
  <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-zinc-950 via-red-950 to-amber-800 p-4 text-white shadow-xl">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-amber-100">
          <Crown className="h-3.5 w-3.5" />
          시티델 대기방
        </div>
        <div className="mt-3 text-xl font-black">캐릭터를 고르고 도시를 완성하는 게임입니다.</div>
        <div className="mt-1 max-w-2xl text-xs font-bold leading-relaxed text-amber-100/90">
          시작하면 매 라운드 비밀 캐릭터 선택, 금화/카드 획득, 구역 건설 순서로 진행합니다.
        </div>
      </div>
      <div className="rounded-2xl bg-white/10 px-4 py-3 text-right">
        <div className="text-[11px] font-black text-amber-100">방 코드</div>
        <div className="text-lg font-black tracking-[0.18em]">{roomCode}</div>
      </div>
    </div>

    <div className={`mt-4 grid gap-2 sm:grid-cols-2 ${compact ? "lg:grid-cols-4" : "lg:grid-cols-4"}`}>
      {lobbyCharacterPreview.map(({ code, rank, icon: Icon, tone }) => (
        <div key={code} className={`rounded-2xl border p-3 shadow-sm ${tone}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/80"><Icon className="h-4 w-4" /></div>
            <span className="text-xs font-black">#{rank}</span>
          </div>
          <div className="mt-3 text-sm font-black">{characterName(code)}</div>
          <div className="mt-1 min-h-[30px] text-[11px] font-bold leading-snug opacity-80">{characterHelp[code]}</div>
        </div>
      ))}
    </div>
  </div>
);

const actionLabels = {
  CHOOSE_CHARACTER: "캐릭터 선택",
  DISCARD_CHARACTER: "캐릭터 버림",
  CHARACTER_CALLED: "캐릭터 호출",
  CHARACTER_SKIPPED: "암살된 캐릭터 건너뜀",
  TAKE_GOLD: "금화 획득",
  DRAW_DISTRICTS: "구역 카드 뽑기",
  KEEP_DISTRICTS: "구역 카드 보관",
  BUILD_DISTRICT: "구역 건설",
  ASSASSIN_TARGET: "암살 대상 지정",
  THIEF_TARGET: "도둑 대상 지정",
  THIEF_STEAL: "금화 훔침",
  MAGICIAN_EXCHANGE: "손패 교환",
  MAGICIAN_REDRAW: "손패 교체",
  COLOR_INCOME: "색상 수입",
  LABORATORY_DISCARD: "실험실 사용",
  SMITHY_DRAW: "대장간 사용",
  WARLORD_DESTROY: "구역 파괴",
  GRAVEYARD_OFFER: "묘지 선택",
  GRAVEYARD_SAVE: "묘지 회수",
  GRAVEYARD_DECLINE: "묘지 포기",
  MERCHANT_BONUS: "상인 보너스",
  ARCHITECT_DRAW: "건축가 추가 카드",
  CROWN_TAKEN: "왕관 획득",
  ROUND_START: "라운드 시작",
  END_TURN: "턴 종료",
  CITY_COMPLETED: "8구역 완성",
  GAME_FINISHED: "게임 종료",
};

const citadelsActionFeedbackLabels = {
  ...actionLabels,
  COLLECT_COLOR_INCOME: "색상 수입 받기",
  KEEP_DISTRICT_CARDS: "구역 카드 보관",
  GRAVEYARD_KEEP: "무덤 회수",
};

const initialCitadelsActionFeedback = () => ({
  status: "idle",
  label: "행동 대기",
  message: "아직 실행한 행동이 없습니다.",
  detail: "캐릭터 선택, 수입, 건설, 특수 능력을 실행하면 처리 결과가 여기에 남습니다.",
});

const citadelsActionLabel = (payload) => {
  const actionType = String(payload?.actionType ?? payload?.action_type ?? "").trim().toUpperCase();
  return citadelsActionFeedbackLabels[actionType] || actionType.replace(/_/g, " ") || "게임 행동";
};

const citadelsFeedbackStatusLabel = (status, actionBusy) => {
  if (actionBusy || status === "pending") return "처리 중";
  if (status === "done") return "반영 완료";
  if (status === "error") return "실패";
  return "대기";
};

const get = (obj, snake, camel, fallback = undefined) => obj?.[camel] ?? obj?.[snake] ?? fallback;
const asArray = (value) => (Array.isArray(value) ? value : []);
const roomIdOf = getTabletopRoomId;
const roomCodeOf = getTabletopRoomCode;
const roomStatusOf = getTabletopRoomStatus;
const rememberResumeRoom = (room) => {
  const roomId = roomIdOf(room);
  if (!roomId) return;
  localStorage.setItem(ROOM_STORAGE_KEY, String(roomId));
  localStorage.setItem(ROOM_TITLE_STORAGE_KEY, String(room?.title || roomCodeOf(room) || "시티델 최근 방"));
};
const clearResumeRoom = (roomId) => {
  const storedId = localStorage.getItem(ROOM_STORAGE_KEY);
  if (!roomId || storedId === String(roomId)) {
    localStorage.removeItem(ROOM_STORAGE_KEY);
    localStorage.removeItem(ROOM_TITLE_STORAGE_KEY);
  }
};
const memberIdOf = (player) => Number(getTabletopMemberId(player) || 0);
const seatNoOf = (player) => Number(getTabletopSeatNo(player) || 0);
const isReady = isTabletopReadyPlayer;
const currentMemberIdOf = (user) => Number(user?.member_id || user?.memberId || user?.id || getTabletopMemberId(user) || 0);
const characterName = (code) => characterLabels[code] || code || "-";
const playerName = (players, seatNo) => players.find((player) => seatNoOf(player) === Number(seatNo))?.nickname || `좌석 ${seatNo}`;
const cardIdOf = (card) => get(card, "id", "id", "");
const cardNameOf = (card) => districtNameLabels[templateCodeOf(card)] || get(card, "name", "name", "-");
const cardColorOf = (card) => get(card, "color", "color", "");
const cardCostOf = (card) => Number(get(card, "cost", "cost", 0));
const templateCodeOf = (card) => get(card, "template_code", "templateCode", "");
const cityOf = (player) => asArray(get(player, "city", "city", []));
const handOf = (player) => asArray(get(player, "hand", "hand", []));
const charactersOf = (player) => asArray(get(player, "character_codes", "characterCodes", []));
const hasDistrict = (player, templateCode) => cityOf(player).some((card) => templateCodeOf(card) === templateCode);

const canBuildDuplicate = (player, card) => {
  const existing = cityOf(player).filter((item) => templateCodeOf(item) === templateCodeOf(card)).length;
  return existing === 0 || (hasDistrict(player, "QUARRY") && existing < 2);
};

const cityColorProgress = (city) => {
  const colors = new Set(city.map(cardColorOf).filter(Boolean));
  const missing = colorOrder.filter((color) => !colors.has(color));
  const hauntedHelps = missing.length === 1 && city.some((card) => templateCodeOf(card) === "HAUNTED_CITY");
  return {
    colors,
    missing,
    completed: missing.length === 0 || hauntedHelps,
    missingText: missing.length ? missing.map((color) => colorLabels[color] || color).join(", ") : "완성",
  };
};

const districtScoreOf = (city) => city.reduce((sum, card) => sum + (["DRAGON_GATE", "UNIVERSITY"].includes(templateCodeOf(card)) ? 8 : cardCostOf(card)), 0);
const citadelsNumberField = (obj, snake, camel, fallback = 0) => {
  const value = get(obj, snake, camel, undefined);
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const citadelsBonusScoreOf = (player) => citadelsNumberField(player, "bonus_score", "bonusScore", 0);
const citadelsScoreOf = (player) => {
  const city = cityOf(player);
  const fallback = districtScoreOf(city) + citadelsBonusScoreOf(player);
  return citadelsNumberField(player, "score", "score", fallback);
};

const buildCitadelsSettlementLedger = ({ players, citadelsPlayers, winnerSeatNo }) => {
  const rows = asArray(citadelsPlayers)
    .map((player) => {
      const city = cityOf(player);
      const seatNo = seatNoOf(player);
      const colorProgress = cityColorProgress(city);
      const characters = charactersOf(player).map(characterName).filter(Boolean);
      const districtScore = districtScoreOf(city);
      const bonusScore = citadelsBonusScoreOf(player);
      return {
        seatNo,
        name: playerName(players, seatNo),
        city,
        cityCount: city.length,
        districtScore,
        bonusScore,
        score: citadelsScoreOf(player),
        gold: citadelsNumberField(player, "gold", "gold", 0),
        character: characters.length ? characters.join(", ") : characterName(get(player, "character_code", "characterCode", "")),
        colorProgress,
        isWinner: Number(winnerSeatNo) > 0 && seatNo === Number(winnerSeatNo),
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.bonusScore !== left.bonusScore) return right.bonusScore - left.bonusScore;
      if (right.districtScore !== left.districtScore) return right.districtScore - left.districtScore;
      return left.seatNo - right.seatNo;
    });
  const winner = rows.find((row) => row.isWinner) || rows[0] || null;
  const runnerUp = rows.find((row) => row.seatNo !== winner?.seatNo) || null;
  const scoreGap = winner && runnerUp ? winner.score - runnerUp.score : 0;
  const gapText = !runnerUp
    ? "단독 정산"
    : scoreGap >= 0
      ? `2위와 ${scoreGap}점 차`
      : `서버 승자 기준 · 점수표 ${Math.abs(scoreGap)}점 열세`;
  const colorText = winner
    ? (winner.colorProgress.completed ? "색상 보너스 조건 충족" : `부족 색상: ${winner.colorProgress.missingText}`)
    : "최종 도시 정보 대기";
  const finalRows = winner ? [winner, ...rows.filter((row) => row.seatNo !== winner.seatNo)] : rows;
  const items = winner ? [
    {
      key: "winner",
      icon: "win",
      label: "승자",
      value: winner.name,
      detail: `${winner.score}점 · ${gapText}`,
    },
    {
      key: "score",
      icon: "score",
      label: "점수 구성",
      value: `${winner.districtScore}+${winner.bonusScore}`,
      detail: `구역 기본점수 ${winner.districtScore}점 · 서버 보너스 ${winner.bonusScore}점`,
    },
    {
      key: "city",
      icon: "stage",
      label: "도시 완성도",
      value: `${winner.cityCount}/8구역`,
      detail: colorText,
    },
    {
      key: "runner",
      icon: "player",
      label: "추격자",
      value: runnerUp ? `${runnerUp.name} ${runnerUp.score}점` : "단독 정산",
      detail: runnerUp ? `${runnerUp.cityCount}구역 · 보너스 ${runnerUp.bonusScore}점` : "다른 최종 점수 행이 없습니다.",
    },
  ] : [];
  return { rows: finalRows, winner, runnerUp, gapText, items };
};

const warlordDestroyCost = (targetPlayer, card) => Math.max(0, cardCostOf(card) - 1 + (hasDistrict(targetPlayer, "GREAT_WALL") ? 1 : 0));

const lastEventSignal = (gameState) => {
  const events = asArray(get(gameState, "events", "events", []));
  const last = events[events.length - 1];
  return last ? `${get(last, "event_no", "eventNo", "")}-${get(last, "event_type", "eventType", "")}` : "";
};

const latestCitadelsEventSummary = (events, players) => {
  const last = asArray(events).at(-1);
  if (!last) {
    return { title: "아직 기록 없음", detail: "첫 행동이 발생하면 최근 기록이 여기에 표시됩니다." };
  }

  const eventType = get(last, "event_type", "eventType", "");
  const seatNo = Number(get(last, "seat_no", "seatNo", 0));
  const characterCode = get(last, "character_code", "characterCode", "");
  const actor = seatNo ? playerName(players, seatNo) : "시스템";
  const character = characterCode ? ` · ${characterName(characterCode)}` : "";
  return {
    title: actionLabels[eventType] || eventType || "게임 진행",
    detail: `${actor}${character}`,
  };
};

const citadelsActorSeatNo = ({ phase, activeSeatNo, chooserSeatNo, pendingChoiceSeatNo, pendingGraveyardSeatNo }) => {
  if (phase === "CHARACTER_SELECTION") return chooserSeatNo;
  if (phase === "DISTRICT_CHOICE") return pendingChoiceSeatNo;
  if (phase === "GRAVEYARD_CHOICE") return pendingGraveyardSeatNo;
  return activeSeatNo;
};

const CitadelsExperiencePanel = ({
  phase,
  currentPhaseLabel,
  status,
  players,
  mySeatNo,
  myGold,
  myHandCount,
  myCityCount,
  myDistrictScore,
  colorProgress,
  activeSeatNo,
  chooserSeatNo,
  pendingChoiceSeatNo,
  pendingGraveyardSeatNo,
  activeCharacter,
  finalRound,
  winnerSeatNo,
  events,
  turnGuidance,
}) => {
  const recent = latestCitadelsEventSummary(events, players);
  const actorSeatNo = citadelsActorSeatNo({ phase, activeSeatNo, chooserSeatNo, pendingChoiceSeatNo, pendingGraveyardSeatNo });
  const actorText = winnerSeatNo ? playerName(players, winnerSeatNo) : actorSeatNo ? playerName(players, actorSeatNo) : "대기 중";
  const actorDetail = winnerSeatNo
    ? "최종 점수 계산이 끝났습니다."
    : activeCharacter
      ? `${characterName(activeCharacter)} 차례`
      : "캐릭터 선택 또는 다음 단계 대기";
  const colorText = colorProgress?.completed ? "색상 보너스 조건 충족" : `부족 색상: ${colorProgress?.missingText || "-"}`;
  const playerText = mySeatNo ? `금화 ${myGold} · 손패 ${myHandCount} · 구역 ${myCityCount}` : "관전 중";
  const phaseDetail = finalRound ? "마지막 라운드 진행 중" : statusLabels[status] || status || "진행 대기";
  const tiles = [
    { key: "phase", icon: "state", label: "단계", value: currentPhaseLabel || "대기", detail: phaseDetail },
    { key: "turn", icon: "turn", label: winnerSeatNo ? "승자" : "행동 주체", value: actorText, detail: actorDetail },
    { key: "player", icon: "player", label: "내 도시", value: playerText, detail: `기본점수 ${myDistrictScore}점 · ${colorText}` },
    { key: "recent", icon: "recent", label: "최근 기록", value: recent.title, detail: recent.detail },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-950 p-3 text-white shadow-inner" data-smoke="citadels-experience-panel">
      <div className="grid gap-2 md:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.key} className="min-h-[92px] rounded-xl border border-white/10 bg-white/10 p-3" data-smoke="citadels-flow-tile">
            <div className="flex items-center gap-2 text-[11px] font-black text-amber-100">
              <GameUxGlyph type={tile.icon} className="h-3.5 w-3.5" />
              {tile.label}
            </div>
            <div className="mt-2 truncate text-sm font-black text-white">{tile.value}</div>
            <div className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-slate-300">{tile.detail}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-start gap-3 rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2">
        <GameUxGlyph type="decision" className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
        <div className="min-w-0">
          <div className="text-[11px] font-black text-amber-100">다음 판단</div>
          <div className="mt-0.5 text-sm font-black leading-relaxed text-white">{turnGuidance}</div>
        </div>
      </div>
    </section>
  );
};

const CitadelsBoardFocusPanel = ({
  phase,
  currentPhaseLabel,
  players,
  mySeatNo,
  myGold,
  myHand,
  myCity,
  myDistrictScore,
  colorProgress,
  activeSeatNo,
  chooserSeatNo,
  pendingChoiceSeatNo,
  pendingGraveyardSeatNo,
  activeCharacter,
  winnerSeatNo,
  finalRound,
  builtThisTurn,
  buildLimit,
  buildableCards,
  actionTaken,
  incomeTaken,
  characterAbilityUsed,
  canBuild,
  isMyTurn,
  isMySelection,
  isMyDistrictChoice,
  isMyGraveyardChoice,
  pendingKeepCount,
  events,
  turnGuidance,
}) => {
  const actorSeatNo = citadelsActorSeatNo({ phase, activeSeatNo, chooserSeatNo, pendingChoiceSeatNo, pendingGraveyardSeatNo });
  const actorText = winnerSeatNo ? playerName(players, winnerSeatNo) : actorSeatNo ? playerName(players, actorSeatNo) : "대기 중";
  const myAction = isMyTurn || isMySelection || isMyDistrictChoice || isMyGraveyardChoice;
  const recent = latestCitadelsEventSummary(events, players);
  const isFinished = phase === "FINISHED" || winnerSeatNo > 0;
  const resultTitle = winnerSeatNo ? `${playerName(players, winnerSeatNo)} 승리` : "최종 점수 계산";
  const resultDetail = winnerSeatNo
    ? "도시 가치, 완성 보너스, 색상 보너스가 모두 합산된 최종 결과입니다."
    : "마지막 라운드 이후 도시 점수와 보너스가 정리됩니다.";
  const nextDecision = (() => {
    if (phase === "FINISHED") return winnerSeatNo ? `${playerName(players, winnerSeatNo)} 승리. 최종 점수와 보너스를 확인하세요.` : "최종 점수 계산이 끝났습니다.";
    if (isMySelection) return "비공개 캐릭터를 고르는 차례입니다. 수입색과 능력 타이밍을 먼저 보세요.";
    if (isMyDistrictChoice) return `${pendingKeepCount}장을 고릅니다. 지금 지을 수 있는 비용과 부족한 색상을 비교하세요.`;
    if (isMyGraveyardChoice) return "파괴된 구역을 금화 1개로 되찾을지 판단하세요.";
    if (isMyTurn && !actionTaken) return "먼저 금화 2개 또는 구역 카드 뽑기 중 하나를 선택하세요.";
    if (isMyTurn && canBuild) return buildableCards ? `건설 가능 ${buildableCards}장. 색상 보너스와 8구역 종료 조건을 같이 보세요.` : "건설 가능한 카드가 없습니다. 능력 사용이나 턴 종료를 검토하세요.";
    if (isMyTurn) return "남은 특수 능력, 수입, 건설 여부를 확인한 뒤 턴을 끝내세요.";
    return turnGuidance;
  })();
  const buildSignal = (() => {
    if (!mySeatNo) return { value: "관전 중", detail: "내 도시 정보가 없으면 전체 진행 흐름만 확인합니다." };
    if (phase === "FINISHED") return { value: `${myDistrictScore}점`, detail: `구역 ${myCity.length}개 · 색상 보너스 ${colorProgress.completed ? "충족" : "미충족"}` };
    if (!canBuild) return { value: `${buildableCards}/${myHand.length}장`, detail: "금화, 중복 구역, 건설 제한 때문에 바로 지을 수 있는 카드가 제한됩니다." };
    return { value: `${buildableCards}/${myHand.length}장`, detail: `건설 ${builtThisTurn}/${buildLimit} · 부족 색상 ${colorProgress.completed ? "없음" : colorProgress.missingText}` };
  })();
  const turnSignal = (() => {
    if (phase === "CHARACTER_SELECTION") return `${playerName(players, chooserSeatNo)} 선택`;
    if (phase === "DISTRICT_CHOICE") return `${playerName(players, pendingChoiceSeatNo)} 구역 선택`;
    if (phase === "GRAVEYARD_CHOICE") return `${playerName(players, pendingGraveyardSeatNo)} 묘지 선택`;
    if (phase === "TURN_ACTION") return `${characterName(activeCharacter)} · ${playerName(players, activeSeatNo)}`;
    if (phase === "FINISHED") return "게임 종료";
    return actorText;
  })();
  const resourceDetail = `금화 ${myGold} · 손패 ${myHand.length} · 구역 ${myCity.length}`;
  const actionLocks = [
    actionTaken ? "기본 행동 완료" : "기본 행동 대기",
    incomeTaken ? "색상 수입 완료" : "색상 수입 가능성 확인",
    characterAbilityUsed ? "능력 사용 완료" : "능력 사용 가능성 확인",
  ].join(" · ");
  const cueTone = isFinished ? "done" : myAction ? "active" : "neutral";
  const cueTitle = isFinished ? "최종 결과 확인" : myAction ? "내 시티델 판단" : `${actorText} 진행 관찰`;
  const cueItems = [
    { label: "단계", value: currentPhaseLabel || "대기", icon: "stage", tone: isFinished ? "done" : "neutral" },
    { label: "행동", value: myAction ? "선택 가능" : actorText, icon: "decision", tone: myAction ? "active" : "neutral" },
    { label: "건설", value: buildSignal.value, icon: "score" },
    { label: "최근", value: recent.title, icon: "recent" },
  ];
  const tiles = [
    {
      key: "table",
      icon: "stage",
      label: "판세",
      value: finalRound ? "마지막 라운드" : currentPhaseLabel || "대기",
      detail: `${turnSignal} · ${myAction ? "내 판단 구간" : "상대 진행 관찰"}`,
    },
    {
      key: "build",
      icon: "score",
      label: "건설 판단",
      value: buildSignal.value,
      detail: buildSignal.detail,
    },
    {
      key: "resource",
      icon: "player",
      label: "내 자원",
      value: mySeatNo ? resourceDetail : "관전 중",
      detail: actionLocks,
    },
    {
      key: "recent",
      icon: "recent",
      label: "근거",
      value: recent.title,
      detail: recent.detail,
    },
  ];
  const citadelsFlowItems = [
    {
      label: "단계",
      value: currentPhaseLabel || "대기",
      detail: finalRound ? "마지막 라운드입니다. 8구역 완성자와 보너스를 확인하세요." : nextDecision,
      icon: "stage",
      tone: isFinished ? "done" : myAction ? "active" : "neutral",
    },
    {
      label: "캐릭터",
      value: phase === "TURN_ACTION" ? characterName(activeCharacter) : turnSignal,
      detail: activeCharacter ? characterHelp[activeCharacter] || "캐릭터 능력 타이밍을 확인하세요." : "비밀 선택 또는 특수 선택 단계입니다.",
      icon: "turn",
      tone: isMyTurn || isMySelection ? "active" : "neutral",
    },
    {
      label: "도시 완성도",
      value: mySeatNo ? `${myCity.length}/8구역` : "관전 중",
      detail: mySeatNo ? `기본점수 ${myDistrictScore}점 · ${colorProgress.completed ? "색상 보너스 가능" : `부족: ${colorProgress.missingText}`}` : "참가자 도시와 점수 흐름을 관찰하세요.",
      icon: "score",
      tone: colorProgress.completed || myCity.length >= 7 ? "waiting" : "neutral",
    },
    {
      label: isFinished ? "결과" : "행동 잠금",
      value: isFinished ? resultTitle : actionTaken ? "기본 행동 완료" : "기본 행동 대기",
      detail: isFinished ? resultDetail : actionLocks,
      icon: isFinished ? "win" : "decision",
      tone: isFinished ? "done" : myAction ? "active" : "neutral",
    },
  ];

  return (
    <section className="rounded-2xl border border-amber-200 bg-white p-3 shadow-lg" data-smoke="citadels-board-focus-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <GameUxGlyph type="turn" className="h-4 w-4 text-amber-600" />
            이번 차례 포커스
          </div>
          <p className="mt-1 text-sm font-bold leading-relaxed text-slate-600">{nextDecision}</p>
        </div>
        <span className={`inline-flex shrink-0 rounded-full px-3 py-1 text-[11px] font-black ${myAction ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
          {myAction ? "내 판단" : actorText}
        </span>
      </div>
      {isFinished && (
        <GameResultSpotlight
          title={resultTitle}
          subtitle="시티델 결과"
          detail={resultDetail}
          metric={recent.title}
          tone="amber"
          smoke="citadels-result-spotlight"
          className="mt-3"
        />
      )}
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {citadelsFlowItems.map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            <div className="text-[10px] font-black text-slate-400">{item.label}</div>
            <div className="mt-0.5 truncate text-sm font-black text-slate-900">{item.value}</div>
            <div className="mt-0.5 line-clamp-1 text-[10px] font-bold text-slate-500">{item.detail}</div>
          </div>
        ))}
      </div>
      <details className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
        <summary className="cursor-pointer text-xs font-black text-slate-600">상세 진행 열기</summary>
        <GameFlowMeter
          title="시티델 라운드 흐름"
          detail="단계, 호출된 캐릭터, 도시 완성도, 행동 잠금 상태를 순서대로 확인합니다."
          items={citadelsFlowItems}
          tone={isFinished ? "amber" : "slate"}
          smoke="citadels-flow-meter"
          className="mt-3"
        />
      </details>
      <GameActionCueBar
        title={cueTitle}
        detail={nextDecision}
        items={cueItems}
        tone={cueTone}
        smoke="citadels-action-cue-bar"
        className="mt-3"
      />
      <div className="mt-3 grid gap-2 md:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.key} className="min-h-[96px] rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" data-smoke="citadels-board-focus-tile">
            <div className="flex items-center gap-2 text-[11px] font-black text-amber-700">
              <GameUxGlyph type={tile.icon} className="h-3.5 w-3.5" />
              {tile.label}
            </div>
            <div className="mt-1 truncate text-sm font-black text-slate-950">{tile.value}</div>
            <div className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-slate-600">{tile.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
};

const buildCitadelsProgressDigest = ({
  phase,
  currentPhaseLabel,
  status,
  players,
  mySeatNo,
  myGold,
  myHand,
  myCity,
  myDistrictScore,
  colorProgress,
  activeSeatNo,
  chooserSeatNo,
  pendingChoiceSeatNo,
  pendingGraveyardSeatNo,
  activeCharacter,
  winnerSeatNo,
  finalRound,
  builtThisTurn,
  buildLimit,
  buildableCards,
  actionTaken,
  incomeTaken,
  characterAbilityUsed,
  events,
  turnGuidance,
}) => {
  const safePlayers = asArray(players);
  const safeHand = asArray(myHand);
  const safeCity = asArray(myCity);
  const progress = colorProgress || cityColorProgress(safeCity);
  const safeEvents = asArray(events);
  const recent = latestCitadelsEventSummary(safeEvents, safePlayers);
  const actorSeatNo = citadelsActorSeatNo({ phase, activeSeatNo, chooserSeatNo, pendingChoiceSeatNo, pendingGraveyardSeatNo });
  const actorName = winnerSeatNo ? playerName(safePlayers, winnerSeatNo) : actorSeatNo ? playerName(safePlayers, actorSeatNo) : "대기 중";
  const phaseValue = phase === "FINISHED" ? "게임 종료" : currentPhaseLabel || phaseLabels[phase] || "대기";
  const roleValue = phase === "TURN_ACTION" && activeCharacter ? characterName(activeCharacter) : phaseValue;
  const statusText = winnerSeatNo
    ? `${playerName(safePlayers, winnerSeatNo)} 승리 정산`
    : finalRound
      ? "마지막 라운드 압력"
      : statusLabels[status] || status || "진행 대기";
  const colorText = progress.completed ? "색상 보너스 조건 충족" : `부족 색상: ${progress.missingText}`;
  const cityValue = mySeatNo ? `${safeCity.length}/8구역` : "관전 중";
  const cityDetail = mySeatNo
    ? `기본 ${myDistrictScore}점 · 금화 ${myGold} · 손패 ${safeHand.length}장`
    : "내 도시 정보 없이 전체 진행을 관찰합니다.";
  const actionLocks = [
    actionTaken ? "기본 행동 완료" : "기본 행동 대기",
    incomeTaken ? "색상 수입 완료" : "색상 수입 확인",
    characterAbilityUsed ? "능력 사용 완료" : "능력 사용 확인",
  ].join(" · ");
  const buildText = phase === "FINISHED" ? "정산" : `건설 ${builtThisTurn}/${buildLimit}`;
  const buildDetail = mySeatNo
    ? `${actionLocks} · 후보 ${buildableCards}/${safeHand.length}장`
    : actionLocks;
  const nodes = [
    {
      key: "recent",
      label: "최근",
      value: recent.title,
      detail: safeEvents.length ? `${recent.detail} · 기록 ${safeEvents.length}개` : recent.detail,
      icon: "recent",
      fill: "#0f172a",
      stroke: "#f59e0b",
      active: safeEvents.length > 0,
    },
    {
      key: "actor",
      label: "주체",
      value: actorName,
      detail: roleValue,
      icon: "turn",
      fill: "#0369a1",
      stroke: "#38bdf8",
      active: Boolean(actorSeatNo || winnerSeatNo),
    },
    {
      key: "city",
      label: "도시",
      value: cityValue,
      detail: `${colorText} · ${cityDetail}`,
      icon: "score",
      fill: "#15803d",
      stroke: "#86efac",
      active: progress.completed || safeCity.length >= 7,
    },
    {
      key: "phase",
      label: "단계",
      value: phaseValue,
      detail: statusText,
      icon: "stage",
      fill: "#7c3aed",
      stroke: "#c4b5fd",
      active: status === "PLAYING" || phase === "FINISHED",
    },
  ];
  const items = [
    {
      key: "recent",
      label: "방금 무엇이 바뀌었나",
      value: recent.title,
      detail: safeEvents.length ? recent.detail : "아직 행동 기록이 없어서 첫 이벤트를 기다립니다.",
      icon: "recent",
    },
    {
      key: "actor",
      label: "캐릭터 흐름",
      value: actorName,
      detail: activeCharacter ? `${characterName(activeCharacter)} 영향권 · ${statusText}` : `${roleValue} · ${statusText}`,
      icon: "turn",
    },
    {
      key: "city",
      label: "도시 압력",
      value: cityValue,
      detail: `${colorText} · ${cityDetail}`,
      icon: "score",
    },
    {
      key: "phase",
      label: "다음 판단",
      value: buildText,
      detail: turnGuidance || buildDetail,
      icon: "decision",
    },
  ];

  return {
    status: status || "",
    phase: phase || "",
    recentCount: safeEvents.length,
    actorSeatNo: Number(actorSeatNo || winnerSeatNo || 0),
    headline: turnGuidance || statusText,
    nodes,
    items,
    actionLocks,
    buildDetail,
  };
};

const CitadelsProgressDigestArt = ({ digest }) => {
  const nodes = asArray(digest?.nodes).slice(0, 4);
  const positions = [
    { x: 70, y: 126 },
    { x: 165, y: 72 },
    { x: 258, y: 126 },
    { x: 350, y: 72 },
  ];
  const shortText = (value, max = 10) => {
    const text = String(value || "");
    return text.length > max ? `${text.slice(0, max - 1)}...` : text;
  };

  return (
    <svg
      viewBox="0 0 420 190"
      role="img"
      aria-label="시티델 최근 진행 요약"
      className="h-52 w-full"
      data-smoke="citadels-progress-digest-art"
    >
      <rect x="10" y="14" width="400" height="162" rx="24" fill="#0f172a" />
      <rect x="24" y="28" width="372" height="134" rx="20" fill="#f8fafc" />
      <path d="M70 126 C116 84 126 76 165 72 S226 112 258 126 S314 92 350 72" fill="none" stroke="#e2e8f0" strokeWidth="18" strokeLinecap="round" />
      <path d="M70 126 C116 84 126 76 165 72 S226 112 258 126 S314 92 350 72" fill="none" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
      <text x="38" y="52" fontSize="12" fontWeight="900" fill="#0f172a">최근 진행 요약</text>
      <text x="382" y="52" textAnchor="end" fontSize="10" fontWeight="900" fill="#64748b">기록 {digest?.recentCount || 0}개</text>
      {nodes.map((node, index) => {
        const point = positions[index] || positions[0];
        return (
          <g key={node.key} data-smoke="citadels-progress-digest-node" data-digest-key={node.key}>
            <circle cx={point.x} cy={point.y} r={29} fill={node.active ? node.fill : "#64748b"} stroke="#ffffff" strokeWidth="6" />
            <circle cx={point.x} cy={point.y} r={34} fill="none" stroke={node.active ? node.stroke : "#cbd5e1"} strokeWidth="3" />
            <text x={point.x} y={point.y - 3} textAnchor="middle" fontSize="10" fontWeight="900" fill="#ffffff">{node.label}</text>
            <text x={point.x} y={point.y + 11} textAnchor="middle" fontSize="8" fontWeight="900" fill="#e0f2fe">{shortText(node.value, 8)}</text>
            <rect x={point.x - 38} y={point.y + 43} width="76" height="18" rx="9" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1.5" />
            <text x={point.x} y={point.y + 55} textAnchor="middle" fontSize="8" fontWeight="900" fill="#334155">{shortText(node.detail, 12)}</text>
          </g>
        );
      })}
      <rect x="42" y="154" width="336" height="16" rx="8" fill="#0f172a" opacity="0.92" />
      <text x="210" y="166" textAnchor="middle" fontSize="9" fontWeight="900" fill="#fef3c7">최근 기록 - 캐릭터 주체 - 도시 압력 - 다음 단계</text>
    </svg>
  );
};

const CitadelsProgressDigestPanel = (props) => {
  const digest = buildCitadelsProgressDigest(props);

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-3 shadow-lg"
      data-smoke="citadels-progress-digest-panel"
      data-status={digest.status}
      data-phase={digest.phase}
      data-recent-count={digest.recentCount}
      data-actor-seat={digest.actorSeatNo}
    >
      <div className="grid gap-3 xl:grid-cols-[minmax(0,380px)_1fr]">
        <CitadelsProgressDigestArt digest={digest} />
        <div className="min-w-0">
          <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-700">시티델 진행 애셋</div>
          <h2 className="mt-2 text-lg font-black text-slate-950">최근 진행 요약</h2>
          <p className="mt-1 text-sm font-bold leading-relaxed text-slate-600">
            방금 무엇이 바뀌었나, 캐릭터 흐름, 도시 압력, 다음 판단을 같은 화면에서 연결합니다.
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {digest.items.map((item) => (
              <div key={item.key} className="min-h-[104px] rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" data-smoke="citadels-progress-digest-item" data-digest-key={item.key}>
                <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500">
                  <GameUxGlyph type={item.icon} className="h-3.5 w-3.5 text-amber-600" />
                  {item.label}
                </div>
                <div className="mt-1 line-clamp-2 text-sm font-black leading-snug text-slate-950">{item.value}</div>
                <div className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-slate-600">{item.detail}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-bold leading-relaxed text-amber-800">
            {digest.headline}
          </div>
        </div>
      </div>
    </section>
  );
};

const CitadelsHistoryEmptyArt = ({ phase, activeCharacter }) => {
  const nodes = [
    { key: "wait", x: 56, y: 86, label: "대기", fill: "#f59e0b" },
    { key: "role", x: 128, y: 54, label: activeCharacter ? "호출" : "순서", fill: "#38bdf8" },
    { key: "city", x: 198, y: 92, label: "도시", fill: "#22c55e" },
    { key: "log", x: 270, y: 58, label: "기록", fill: "#7c3aed" },
  ];

  return (
    <svg
      viewBox="0 0 320 150"
      role="img"
      aria-label="시티델 첫 기록 대기 안내"
      className="h-full min-h-[150px] w-full"
      data-smoke="citadels-history-empty-art"
      focusable="false"
    >
      <rect x="10" y="12" width="300" height="126" rx="22" fill="#0f172a" />
      <path d="M44 106C86 52 118 58 156 84s74 44 118-26" fill="none" stroke="#334155" strokeWidth="15" strokeLinecap="round" />
      <path d="M44 106C86 52 118 58 156 84s74 44 118-26" fill="none" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
      {nodes.map((node, index) => (
        <g key={node.key} data-smoke="citadels-history-empty-node" data-history-node={node.key}>
          <circle cx={node.x} cy={node.y} r="20" fill={node.fill} stroke="#f8fafc" strokeWidth="5" />
          <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="9" fontWeight="900" fill="#ffffff">{node.label}</text>
          <text x={node.x} y={node.y + 33} textAnchor="middle" fontSize="8" fontWeight="900" fill="#cbd5e1">{index + 1}</text>
        </g>
      ))}
      <rect x="28" y="26" width="104" height="24" rx="12" fill="rgba(255,255,255,.1)" stroke="#475569" strokeWidth="2" />
      <text x="80" y="42" textAnchor="middle" fontSize="10" fontWeight="900" fill="#fef3c7">첫 기록 대기</text>
      <text x="292" y="130" textAnchor="end" fontSize="9" fontWeight="900" fill="#cbd5e1">{phaseLabels[phase] || "준비"}</text>
    </svg>
  );
};

const CitadelsHistoryEmptyState = ({ status, phase, activeCharacter, activeSeatNo, players, turnGuidance }) => {
  const actorName = activeSeatNo ? playerName(players, activeSeatNo) : (activeCharacter ? characterName(activeCharacter) : "호출 대기");
  const items = [
    {
      key: "state",
      label: "기록 상태",
      value: "첫 이벤트 대기",
      detail: "캐릭터 호출, 수입, 건설, 능력 사용이 발생하면 이곳에 시간순으로 쌓입니다.",
      icon: "recent",
    },
    {
      key: "phase",
      label: "현재 단계",
      value: phaseLabels[phase] || statusLabels[status] || "대기",
      detail: turnGuidance || "왼쪽 진행 요약에서 다음 판단을 먼저 확인하세요.",
      icon: "stage",
    },
    {
      key: "actor",
      label: "다음 주체",
      value: actorName,
      detail: activeCharacter ? `${characterName(activeCharacter)} 차례의 첫 기록을 기다립니다.` : "캐릭터 선택이나 호출이 시작되면 기록이 열립니다.",
      icon: "turn",
    },
  ];

  return (
    <div
      className="overflow-hidden rounded-2xl border border-amber-100 bg-amber-50/70 p-2 text-amber-950"
      data-smoke="citadels-history-empty-state"
      data-status={status || ""}
      data-phase={phase || ""}
      data-active-seat={activeSeatNo || 0}
      role="status"
      aria-live="polite"
    >
      <div className="overflow-hidden rounded-xl bg-slate-950">
        <CitadelsHistoryEmptyArt phase={phase} activeCharacter={activeCharacter} />
      </div>
      <div className="mt-3 px-1">
        <div className="inline-flex rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-black text-amber-800">기록 대기 브리핑</div>
        <div className="mt-2 text-sm font-black text-slate-950">아직 기록이 없습니다</div>
        <div className="mt-1 text-xs font-bold leading-relaxed text-amber-900/80">
          첫 행동 전에는 기록보다 현재 단계와 다음 주체를 먼저 읽어야 합니다. 행동이 발생하면 이 영역이 실제 로그로 바뀝니다.
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <div key={item.key} className="rounded-xl border border-white/80 bg-white/85 px-3 py-2" data-smoke="citadels-history-empty-item" data-history-key={item.key}>
            <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-700">
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

const CitadelsSettlementLedgerArt = ({ ledger }) => {
  const rows = asArray(ledger?.rows).slice(0, 4);
  const maxScore = Math.max(1, ...rows.map((row) => Math.max(0, row.score)));

  return (
    <svg
      viewBox="0 0 420 240"
      role="img"
      aria-label={`${ledger?.winner?.name || "시티델"} 최종 정산판`}
      className="h-56 w-full"
      data-smoke="citadels-settlement-ledger-art"
    >
      <rect x="10" y="12" width="400" height="216" rx="24" fill="#0f172a" />
      <rect x="22" y="24" width="376" height="192" rx="20" fill="#fff7ed" />
      <rect x="34" y="36" width="352" height="40" rx="16" fill="#fef3c7" />
      <text x="48" y="61" fontSize="13" fontWeight="900" fill="#92400e">정산 요약</text>
      <text x="370" y="61" textAnchor="end" fontSize="13" fontWeight="900" fill="#0f172a">{ledger?.winner?.score || 0}점</text>
      <path d="M52 190 C98 150 128 102 180 122 S256 182 348 96" fill="none" stroke="#fed7aa" strokeWidth="14" strokeLinecap="round" />
      <path d="M52 190 C98 150 128 102 180 122 S256 182 348 96" fill="none" stroke="#92400e" strokeWidth="3" strokeLinecap="round" />
      {rows.map((row, index) => {
        const y = 92 + index * 34;
        const isLeader = row.seatNo === ledger?.winner?.seatNo;
        const barWidth = Math.max(28, Math.round((Math.max(0, row.score) / maxScore) * 128));
        const name = row.name.length > 9 ? `${row.name.slice(0, 8)}...` : row.name;
        return (
          <g key={row.seatNo || row.name} data-smoke="citadels-settlement-player-node">
            <circle cx="50" cy={y + 10} r="15" fill={isLeader ? "#f59e0b" : "#64748b"} stroke="#ffffff" strokeWidth="4" />
            <text x="50" y={y + 14} textAnchor="middle" fontSize="11" fontWeight="900" fill="#ffffff">{index + 1}</text>
            <rect x="72" y={y - 2} width="304" height="24" rx="12" fill={isLeader ? "#fffbeb" : "#ffffff"} stroke={isLeader ? "#f59e0b" : "#e2e8f0"} strokeWidth="2" />
            <rect x="156" y={y + 5} width={barWidth} height="10" rx="5" fill={isLeader ? "#f59e0b" : "#94a3b8"} />
            <text x="84" y={y + 14} fontSize="11" fontWeight="900" fill="#0f172a">{name}</text>
            <text x="362" y={y + 14} textAnchor="end" fontSize="11" fontWeight="900" fill="#0f172a">{row.score}점</text>
          </g>
        );
      })}
      <rect x="42" y="202" width="336" height="16" rx="8" fill="#0f172a" opacity="0.9" />
      <text x="210" y="214" textAnchor="middle" fontSize="9" fontWeight="900" fill="#fef3c7">구역 점수 + 서버 보너스 + 색상 완성 근거 표시</text>
    </svg>
  );
};

const CitadelsSettlementLedgerPanel = ({
  phase,
  players,
  citadelsPlayers,
  winnerSeatNo,
}) => {
  const finished = String(phase || "").toUpperCase() === "FINISHED" || Number(winnerSeatNo) > 0;
  if (!finished) return null;

  const ledger = buildCitadelsSettlementLedger({ players, citadelsPlayers, winnerSeatNo });
  if (!ledger.winner) return null;

  return (
    <section className="rounded-2xl border border-amber-100 bg-white p-3 shadow-lg" data-smoke="citadels-settlement-ledger-panel">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,380px)_1fr]">
        <CitadelsSettlementLedgerArt ledger={ledger} />
        <div className="min-w-0">
          <div className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-[11px] font-black text-amber-700">시티델 정산 요약</div>
          <h2 className="mt-2 text-lg font-black text-slate-950">누가 왜 이겼는지</h2>
          <p className="mt-1 text-sm font-bold leading-relaxed text-slate-600">
            서버 최종 점수를 기준으로 승자, 2위와의 격차, 구역 기본점수, 보너스, 색상 완성 여부를 한 화면에 묶어 보여줍니다.
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {ledger.items.map((item) => (
              <div key={item.key} className="min-h-[104px] rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" data-smoke="citadels-settlement-ledger-item">
                <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500">
                  <GameUxGlyph type={item.icon} className="h-3.5 w-3.5 text-amber-600" />
                  {item.label}
                </div>
                <div className="mt-1 line-clamp-2 text-sm font-black leading-snug text-slate-950">{item.value}</div>
                <div className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-slate-600">{item.detail}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-bold leading-relaxed text-amber-800">
            표시 전용 정산입니다. 서버 승자와 점수 필드를 우선 읽고, 빈 점수만 기존 도시/보너스 필드로 설명합니다.
          </div>
        </div>
      </div>
    </section>
  );
};

const CitadelsSessionActionArt = ({ title, roomCode, playerCount, isHost }) => {
  const nodes = [
    { x: 58, y: 94, label: "점수", fill: "#f59e0b" },
    { x: 136, y: 58, label: "동기화", fill: "#0ea5e9" },
    { x: 222, y: 108, label: "허브", fill: "#10b981" },
    { x: 300, y: 74, label: isHost ? "재시작" : "퇴장", fill: isHost ? "#8b5cf6" : "#f43f5e" },
  ];

  return (
    <svg
      viewBox="0 0 360 190"
      role="img"
      aria-label={`${title} 종료 후 다음 행동 흐름`}
      className="h-44 w-full"
      data-smoke="citadels-session-action-art"
    >
      <rect x="10" y="12" width="340" height="166" rx="24" fill="#0f172a" />
      <rect x="22" y="24" width="316" height="142" rx="20" fill="#fff7ed" />
      <path d="M58 94 C100 42 172 44 218 106 S280 100 300 74" fill="none" stroke="#fed7aa" strokeWidth="12" strokeLinecap="round" />
      <path d="M58 94 C100 42 172 44 218 106 S280 100 300 74" fill="none" stroke="#78350f" strokeWidth="3" strokeLinecap="round" />
      <text x="34" y="45" fontSize="11" fontWeight="900" fill="#92400e">시티델 세션</text>
      <text x="180" y="45" textAnchor="middle" fontSize="15" fontWeight="900" fill="#0f172a">{title}</text>
      <rect x="38" y="134" width="284" height="34" rx="17" fill="#ffffff" stroke="#fde68a" strokeWidth="2" />
      <text x="58" y="156" fontSize="12" fontWeight="900" fill="#0f172a">{roomCode ? `방 ${roomCode}` : "종료된 방"}</text>
      <text x="304" y="156" textAnchor="end" fontSize="12" fontWeight="900" fill="#475569">{playerCount}명</text>
      {nodes.map((node) => (
        <g key={node.label} data-smoke="citadels-session-action-node">
          <circle cx={node.x} cy={node.y} r="24" fill={node.fill} stroke="#ffffff" strokeWidth="5" />
          <circle cx={node.x} cy={node.y} r="30" fill="none" stroke="#fef3c7" strokeWidth="2" />
          <text x={node.x} y={node.y + 5} textAnchor="middle" fontSize="10" fontWeight="900" fill="#ffffff">{node.label}</text>
        </g>
      ))}
    </svg>
  );
};

const CitadelsSessionActionPanel = ({
  selectedRoom,
  gameState,
  players,
  status,
  phase,
  winnerSeatNo,
  isHost,
  busy,
  events,
  myCity,
  colorProgress,
  onRefresh,
  onRematch,
  onLeave,
}) => {
  const normalizedPhase = String(phase || get(gameState, "phase", "phase", "") || "").toUpperCase();
  const finished = status === "FINISHED" || normalizedPhase === "FINISHED" || Number(winnerSeatNo) > 0;
  if (!finished) return null;

  const safeCity = asArray(myCity);
  const winnerName = Number(winnerSeatNo) > 0 ? playerName(players, winnerSeatNo) : "";
  const roomCode = roomCodeOf(selectedRoom);
  const playerCount = players.length || 0;
  const recent = gameState
    ? latestCitadelsEventSummary(events, players)
    : { title: "종료 상태", detail: "강제 종료 또는 최종 정산 후 세션을 정리합니다." };
  const scoreBasis = gameState
    ? `내 도시 ${safeCity.length}구역 · 기본점수 ${districtScoreOf(safeCity)}점 · 색상 보너스 ${colorProgress?.completed ? "충족" : colorProgress?.missingText || "확인 중"}`
    : "최종 상태를 다시 읽으면 점수와 보너스 근거를 다시 확인할 수 있습니다.";
  const resultValue = winnerName ? `${winnerName} 승리` : "시티델 종료";
  const resultDetail = winnerName
    ? `서버가 확정한 최종 승자입니다. 구역 기본 점수, 도시 완성 보너스, 색상 보너스 합산 결과를 확인하세요.`
    : "방이 종료 상태로 전환되었습니다. 상태 새로고침으로 최종 점수와 보너스를 다시 확인하세요.";
  const actionItems = [
    {
      key: "result",
      icon: "win",
      label: "결과 확인",
      value: resultValue,
      detail: resultDetail,
    },
    {
      key: "sync",
      icon: "signal",
      label: "상태 동기화",
      value: "최신 방 상태",
      detail: "종료 직후 비어 있는 정산 정보가 있으면 같은 방 상태를 다시 읽어 최종 표기를 맞춥니다.",
    },
    {
      key: "next",
      icon: "stage",
      label: isHost ? "다음 판 준비" : "다음 선택",
      value: isHost ? "다시 하기" : "게임 허브",
      detail: isHost ? "같은 멤버를 대기 상태로 돌려 새 판을 준비할 수 있습니다." : "허브에서 같은 게임이나 다른 보드게임으로 이동할 수 있습니다.",
    },
    {
      key: "leave",
      icon: "recent",
      label: "세션 정리",
      value: "방 나가기",
      detail: `${recent.title} · ${recent.detail}`,
    },
  ];

  return (
    <section
      className="rounded-2xl border border-amber-100 bg-white p-3 shadow-lg"
      data-smoke="citadels-session-action-panel"
      data-session-status={status || normalizedPhase}
    >
      <div className="grid gap-3 xl:grid-cols-[minmax(0,360px)_1fr]">
        <CitadelsSessionActionArt title={resultValue} roomCode={roomCode} playerCount={playerCount} isHost={Boolean(isHost)} />
        <div className="min-w-0">
          <div className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-[11px] font-black text-amber-700">세션 정리</div>
          <h2 className="mt-2 text-lg font-black text-slate-950">결과 이후 다음 행동</h2>
          <p className="mt-1 text-sm font-bold leading-relaxed text-slate-600">
            승리 근거와 최신 상태를 확인한 뒤 다시 하기, 게임 허브 이동, 방 나가기를 바로 선택할 수 있습니다. {scoreBasis}
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {actionItems.map((item) => (
              <div key={item.key} className="min-h-[104px] rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" data-smoke="citadels-session-action-item">
                <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500">
                  <GameUxGlyph type={item.icon} className="h-3.5 w-3.5 text-amber-600" />
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
              data-smoke="citadels-session-action-refresh"
            >
              <RefreshCw className="h-4 w-4" />
              상태 새로고침
            </button>
            {isHost && (
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-amber-600 px-4 py-2 text-sm font-black text-white disabled:opacity-40"
                disabled={busy}
                onClick={onRematch}
                data-smoke="citadels-session-action-rematch"
              >
                다시 하기
              </button>
            )}
            <Link
              to="/app/games"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-900 hover:text-white"
              data-smoke="citadels-session-action-hub"
            >
              게임 허브
            </Link>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-rose-50 px-4 py-2 text-sm font-black text-rose-600 disabled:opacity-40"
              disabled={busy}
              onClick={onLeave}
              data-smoke="citadels-session-action-leave"
            >
              방 나가기
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

const citadelsSessionRoutePalette = {
  state: { fill: "#f8fafc", stroke: "#64748b", text: "#334155" },
  ready: { fill: "#fef3c7", stroke: "#f59e0b", text: "#92400e" },
  primary: { fill: "#ecfdf5", stroke: "#10b981", text: "#047857" },
  exit: { fill: "#fff1f2", stroke: "#e11d48", text: "#be123c" },
};

const buildCitadelsSessionRouteItems = ({
  status,
  isHost,
  canStart,
  busy,
  myReady,
  selectedRoom,
  players,
  guestPlayers,
  readyGuestCount,
  startBlockedText,
}) => {
  const normalizedStatus = status || "WAITING";
  const safePlayers = asArray(players);
  const safeGuests = asArray(guestPlayers);
  const maxPlayers = Number(selectedRoom?.maxPlayers || 0);
  const minPlayers = Number(selectedRoom?.minPlayers || 0);
  const statusLabel = statusLabels[normalizedStatus] || normalizedStatus;
  const waiting = normalizedStatus === "WAITING";
  const playing = normalizedStatus === "PLAYING";
  const finished = normalizedStatus === "FINISHED";
  const guestsReady = !safeGuests.length || Number(readyGuestCount || 0) >= safeGuests.length;
  const roomSizeText = `${safePlayers.length}/${maxPlayers || "-"}명`;
  const primaryLabel = finished ? "다시 하기" : playing ? "강제 종료" : "시작하기";

  return [
    {
      key: "state",
      label: "궁정 상태",
      value: statusLabel,
      detail: waiting
        ? `${roomSizeText} 입장, 최소 ${minPlayers || "-"}명 조건과 게스트 준비를 확인합니다.`
        : playing
          ? "캐릭터 선택과 도시 건설이 진행 중이라 세션 버튼보다 현재 단계가 우선입니다."
          : "종료된 궁정은 정산 확인, 다시 하기, 나가기 루트로 정리됩니다.",
      icon: "state",
      tone: waiting ? "waiting" : playing ? "active" : "done",
    },
    {
      key: "ready",
      label: "준비 신호",
      value: waiting
        ? (isHost ? `${Number(readyGuestCount || 0)}/${safeGuests.length}명 준비` : myReady ? "내 준비 완료" : "내 준비 대기")
        : "준비 단계 종료",
      detail: waiting
        ? (isHost ? (guestsReady ? "손님 준비가 맞아 시작 조건 판단으로 넘어갑니다." : "아직 준비하지 않은 손님이 있어 시작 버튼이 잠깁니다.") : "참가자는 준비 버튼으로 방장에게 시작 가능 신호를 보냅니다.")
        : "게임 시작 후에는 준비 버튼 대신 캐릭터/도시 행동 흐름을 따라갑니다.",
      icon: "turn",
      tone: waiting ? (guestsReady || myReady ? "done" : "waiting") : "locked",
    },
    {
      key: "primary",
      label: primaryLabel,
      value: finished
        ? (isHost ? (busy ? "다시 여는 중" : "방장 다시 하기") : "방장 선택 대기")
        : playing
          ? (isHost ? (busy ? "처리 중" : "방장 강제 종료") : "진행 흐름 관전")
          : (isHost ? (canStart ? "방장 시작 가능" : "조건 대기") : "방장 시작 대기"),
      detail: finished
        ? (isHost ? "방장이 같은 방을 다시 대기 상태로 열 수 있습니다." : "방장이 다시 하기를 선택하면 같은 궁정에서 다음 판을 이어갑니다.")
        : playing
          ? (isHost ? "강제 종료는 진행 중인 세션을 끝내는 방장 전용 루트입니다." : "진행 중에는 선택/행동 패널이 핵심이고 세션 시작 버튼은 닫힙니다.")
          : (canStart ? "모든 조건이 맞아 실제 시작 버튼이 다음 행동입니다." : startBlockedText || "인원, 준비, 권한 조건이 맞아야 시작할 수 있습니다."),
      icon: finished ? "recent" : playing ? "decision" : "signal",
      tone: finished ? "done" : playing ? (isHost ? "danger" : "active") : canStart ? "done" : "waiting",
    },
    {
      key: "exit",
      label: "나가기",
      value: "언제든 방 나가기",
      detail: finished ? "정산을 확인한 뒤 방을 나가거나 게임 목록으로 이동할 수 있습니다." : "나가기는 기존 방 나가기 버튼을 그대로 사용하며 캐릭터/구역 규칙을 바꾸지 않습니다.",
      icon: "player",
      tone: "neutral",
    },
  ];
};

const CitadelsSessionRouteArt = ({ items, status, isHost, canStart }) => {
  const safeItems = asArray(items);
  const normalizedStatus = status || "WAITING";
  const nodePositions = [
    { x: 58, y: 88 },
    { x: 146, y: 54 },
    { x: 240, y: 88 },
    { x: 330, y: 54 },
  ];

  return (
    <svg
      viewBox="0 0 390 150"
      role="img"
      aria-label="시티델 세션 버튼 루트"
      className="h-full min-h-[148px] w-full"
      data-smoke="citadels-session-route-art"
      data-session-status={normalizedStatus}
      data-host={isHost ? "true" : "false"}
      data-can-start={canStart ? "true" : "false"}
    >
      <rect x="10" y="14" width="370" height="122" rx="24" fill="#fff7ed" />
      <path d="M48 104 C92 42 150 48 194 82 S280 116 336 48" fill="none" stroke="#fed7aa" strokeWidth="14" strokeLinecap="round" />
      <path d="M48 104 C92 42 150 48 194 82 S280 116 336 48" fill="none" stroke="#92400e" strokeWidth="3" strokeLinecap="round" />
      <rect x="28" y="28" width="98" height="26" rx="13" fill="#ffffff" stroke="#fde68a" strokeWidth="2" />
      <text x="77" y="45" textAnchor="middle" fontSize="10" fontWeight="900" fill="#92400e">{normalizedStatus}</text>
      {safeItems.map((item, index) => {
        const position = nodePositions[index] || { x: 58 + index * 88, y: 78 };
        const palette = citadelsSessionRoutePalette[item.key] || citadelsSessionRoutePalette.state;
        return (
          <g key={item.key} data-smoke="citadels-session-route-node" data-route-key={item.key}>
            <circle cx={position.x} cy={position.y} r="25" fill={palette.fill} stroke={palette.stroke} strokeWidth="3" />
            <circle cx={position.x} cy={position.y} r="12" fill="#ffffff" />
            <text x={position.x} y={position.y + 4} textAnchor="middle" fill={palette.text} fontSize="9" fontWeight="900">{index + 1}</text>
            <text x={position.x} y={position.y + 37} textAnchor="middle" fill={palette.text} fontSize="10" fontWeight="900">{item.label}</text>
          </g>
        );
      })}
      <rect x="214" y="110" width="136" height="22" rx="11" fill="#0f172a" opacity="0.9" />
      <text x="282" y="125" textAnchor="middle" fill="#fef3c7" fontSize="10" fontWeight="900">{isHost ? "방장 루트" : "참가자 루트"} · {canStart ? "시작 가능" : "상태 확인"}</text>
    </svg>
  );
};

const CitadelsSessionRoutePanel = ({
  status,
  isHost,
  canStart,
  busy,
  myReady,
  selectedRoom,
  players,
  guestPlayers,
  readyGuestCount,
  startBlockedText,
}) => {
  if (!selectedRoom) return null;
  const normalizedStatus = status || "WAITING";
  const routeItems = buildCitadelsSessionRouteItems({
    status: normalizedStatus,
    isHost,
    canStart,
    busy,
    myReady,
    selectedRoom,
    players,
    guestPlayers,
    readyGuestCount,
    startBlockedText,
  });
  const toneClass = {
    done: "border-emerald-200 bg-emerald-50 text-emerald-900",
    active: "border-sky-200 bg-sky-50 text-sky-900",
    waiting: "border-amber-200 bg-amber-50 text-amber-900",
    locked: "border-slate-200 bg-slate-50 text-slate-700",
    danger: "border-rose-200 bg-rose-50 text-rose-900",
    neutral: "border-slate-200 bg-white text-slate-800",
  };

  return (
    <section
      className="overflow-hidden rounded-2xl border border-amber-100 bg-white p-4 shadow-lg"
      data-smoke="citadels-session-route-panel"
      data-session-status={normalizedStatus}
      data-can-start={canStart ? "true" : "false"}
      data-host={isHost ? "true" : "false"}
      data-busy={busy ? "true" : "false"}
      data-my-ready={myReady ? "true" : "false"}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,380px)_1fr] xl:items-center">
        <CitadelsSessionRouteArt
          items={routeItems}
          status={normalizedStatus}
          isHost={isHost}
          canStart={canStart}
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-black text-amber-700">실제 버튼 안내</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">{isHost ? "방장 기준" : "참가자 기준"}</span>
          </div>
          <h2 className="mt-2 text-lg font-black text-slate-950">시티델 세션 버튼 루트</h2>
          <p className="mt-1 text-sm font-bold leading-relaxed text-slate-600">
            준비, 시작하기, 강제 종료, 다시 하기, 나가기 버튼이 현재 궁정 상태에서 어떤 의미인지 먼저 보여줍니다. 실제 클릭 동작과 권한 조건은 기존 버튼을 그대로 따릅니다.
          </p>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {routeItems.map((item) => (
              <div key={item.key} className={`min-h-[108px] rounded-xl border px-3 py-2 ${toneClass[item.tone] || toneClass.neutral}`} data-smoke="citadels-session-route-item" data-route-key={item.key}>
                <div className="flex items-center gap-1.5 text-[10px] font-black opacity-70">
                  <GameUxGlyph type={item.icon} className="h-3.5 w-3.5" />
                  {item.label}
                </div>
                <div className="mt-1 line-clamp-2 text-sm font-black leading-snug">{item.value}</div>
                <div className="mt-1 line-clamp-3 text-[11px] font-bold leading-relaxed opacity-75">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const citadelsCharacterCodeOf = (value) => {
  if (typeof value === "string") return value;
  return get(value, "code", "code", "") || get(value, "character_code", "characterCode", "");
};

const citadelsCharacterOrderCodes = lobbyCharacterPreview.map((character) => character.code);

const CitadelsCharacterOrderArt = ({ items }) => {
  const toneByStatus = {
    active: { fill: "#f59e0b", stroke: "#92400e", text: "#78350f" },
    mine: { fill: "#ddd6fe", stroke: "#6d28d9", text: "#4c1d95" },
    killed: { fill: "#ffe4e6", stroke: "#be123c", text: "#881337" },
    removed: { fill: "#e2e8f0", stroke: "#64748b", text: "#334155" },
    available: { fill: "#d1fae5", stroke: "#047857", text: "#064e3b" },
    passed: { fill: "#f1f5f9", stroke: "#94a3b8", text: "#475569" },
    waiting: { fill: "#e0f2fe", stroke: "#0284c7", text: "#075985" },
  };
  const xFor = (index) => 34 + index * 52;

  return (
    <svg
      viewBox="0 0 420 188"
      role="img"
      aria-label="시티델 캐릭터 1번부터 8번까지의 호출 순서와 현재 상태"
      className="h-full min-h-[188px] w-full"
      data-smoke="citadels-character-order-art"
    >
      <rect x="10" y="10" width="400" height="168" rx="24" fill="#0f172a" />
      <path d="M34 92H398" fill="none" stroke="#fef3c7" strokeWidth="5" strokeLinecap="round" opacity=".65" />
      <path d="M34 92H398" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 10" />
      <text x="24" y="32" fontSize="11" fontWeight="900" fill="#fde68a">호출 순서</text>
      <text x="300" y="32" fontSize="10" fontWeight="900" fill="#bfdbfe">1번부터 차례대로 공개</text>

      {items.map((item, index) => {
        const tone = toneByStatus[item.statusKey] || toneByStatus.waiting;
        const x = xFor(index);
        return (
          <g key={item.code} transform={`translate(${x} 0)`} data-smoke="citadels-character-order-node">
            <circle cx="0" cy="92" r={item.statusKey === "active" ? 23 : 19} fill={tone.fill} stroke={tone.stroke} strokeWidth="4" />
            <circle cx="0" cy="92" r="8" fill={tone.stroke} opacity=".25" />
            <text x="0" y="87" textAnchor="middle" fontSize="10" fontWeight="900" fill={tone.text}>{item.rank}</text>
            <text x="0" y="102" textAnchor="middle" fontSize="9" fontWeight="900" fill={tone.text}>{item.shortLabel}</text>
            <text x="0" y="136" textAnchor="middle" fontSize="9" fontWeight="900" fill="#f8fafc">{item.status}</text>
            {item.isMine && <path d="M-13 61h26l-6 10H-7Z" fill="#a78bfa" stroke="#f5f3ff" strokeWidth="2" />}
            {item.statusKey === "killed" && <path d="M-14 51 14 79M14 51-14 79" fill="none" stroke="#fb7185" strokeWidth="4" strokeLinecap="round" />}
            {item.statusKey === "active" && <path d="M-18 46h36l-8 12H-10Z" fill="#fbbf24" stroke="#fef3c7" strokeWidth="2" />}
          </g>
        );
      })}

      <rect x="24" y="150" width="364" height="1" fill="#334155" />
      <text x="26" y="166" fontSize="10" fontWeight="900" fill="#cbd5e1">보라 표식은 내 역할, 장식 깃발은 현재 호출 캐릭터입니다.</text>
    </svg>
  );
};

const CitadelsCharacterOrderPanel = ({
  phase,
  currentPhaseLabel,
  players,
  citadelsPlayers,
  myCitadelsPlayer,
  mySeatNo,
  activeSeatNo,
  chooserSeatNo,
  pendingChoiceSeatNo,
  pendingGraveyardSeatNo,
  activeCharacter,
  availableCharacters,
  faceUpRemovedCharacters,
  murderedCharacter,
  selectionStep,
  isMyTurn,
  actionTaken,
  incomeTaken,
  characterAbilityUsed,
  canBuild,
  buildableCards,
  finalRound,
  winnerSeatNo,
}) => {
  const availableCodes = new Set(asArray(availableCharacters).map(citadelsCharacterCodeOf).filter(Boolean));
  const removedCodes = new Set(asArray(faceUpRemovedCharacters).map(citadelsCharacterCodeOf).filter(Boolean));
  const myCharacterCodes = charactersOf(myCitadelsPlayer);
  const ownerByCharacter = new Map();
  asArray(citadelsPlayers).forEach((player) => {
    const seatNo = Number(get(player, "seat_no", "seatNo", 0));
    charactersOf(player).forEach((code) => {
      if (code) ownerByCharacter.set(code, seatNo);
    });
  });
  const activeRank = characterRankByCode[activeCharacter] || 0;
  const actorSeatNo = citadelsActorSeatNo({ phase, activeSeatNo, chooserSeatNo, pendingChoiceSeatNo, pendingGraveyardSeatNo });
  const actorText = winnerSeatNo ? playerName(players, winnerSeatNo) : actorSeatNo ? playerName(players, actorSeatNo) : "대기 중";
  const orderItems = citadelsCharacterOrderCodes.map((code) => {
    const rank = characterRankByCode[code] || 0;
    const ownerSeatNo = ownerByCharacter.get(code) || 0;
    const isMine = myCharacterCodes.includes(code);
    let statusKey = "waiting";
    let status = activeRank && rank > activeRank ? "호출 대기" : "대기";
    let detail = characterHelp[code] || "캐릭터 능력 설명을 확인합니다.";

    if (phase === "FINISHED") {
      statusKey = ownerSeatNo ? "passed" : "removed";
      status = ownerSeatNo ? "최종 보유" : "미공개";
      detail = ownerSeatNo ? `${playerName(players, ownerSeatNo)} 보유 캐릭터입니다.` : "라운드 종료 시 공개되지 않았습니다.";
    } else if (murderedCharacter === code) {
      statusKey = "killed";
      status = "암살 대상";
      detail = "호출되더라도 이번 라운드 차례를 건너뜁니다.";
    } else if (code === activeCharacter) {
      statusKey = "active";
      status = "현재 호출";
      detail = ownerSeatNo ? `${playerName(players, ownerSeatNo)} 차례가 진행 중입니다.` : "현재 호출된 캐릭터입니다.";
    } else if (removedCodes.has(code)) {
      statusKey = "removed";
      status = "공개 제외";
      detail = "이번 라운드 공개 제외 캐릭터라 선택할 수 없습니다.";
    } else if (availableCodes.has(code)) {
      statusKey = "available";
      status = selectionStep === "DISCARD" ? "버림 후보" : "선택 가능";
      detail = "현재 선택 후보에 남아 있는 캐릭터입니다.";
    } else if (isMine) {
      statusKey = "mine";
      status = "내 역할";
      detail = activeRank && rank < activeRank ? "이미 호출 순서가 지났습니다." : "내 차례가 언제 오는지 순서를 확인합니다.";
    } else if (ownerSeatNo) {
      statusKey = activeRank && rank < activeRank ? "passed" : "waiting";
      status = activeRank && rank < activeRank ? "호출 지남" : "선택됨";
      detail = `${playerName(players, ownerSeatNo)}가 보유한 캐릭터입니다.`;
    } else if (activeRank && rank < activeRank) {
      statusKey = "passed";
      status = "호출 지남";
      detail = "이번 라운드 호출 순서가 이미 지나갔습니다.";
    } else if (phase === "CHARACTER_SELECTION") {
      statusKey = "waiting";
      status = "비공개 이동";
      detail = "다른 플레이어가 가져갔거나 비공개로 제외됐을 수 있습니다.";
    }

    return {
      code,
      rank,
      shortLabel: characterName(code).slice(0, 2),
      label: characterName(code),
      status,
      statusKey,
      detail,
      isMine,
    };
  });
  const myRoleText = myCharacterCodes.length
    ? myCharacterCodes.map(characterName).join(", ")
    : phase === "CHARACTER_SELECTION"
      ? "아직 선택 전"
      : mySeatNo
        ? "비공개"
        : "관전 중";
  const removedText = [
    ...asArray(faceUpRemovedCharacters).map(citadelsCharacterCodeOf).filter(Boolean).map(characterName),
    murderedCharacter ? `암살 ${characterName(murderedCharacter)}` : "",
  ].filter(Boolean).join(", ") || "공개 제외 없음";
  const activeText = phase === "CHARACTER_SELECTION"
    ? (selectionStep === "DISCARD" ? "버릴 캐릭터를 고르는 단계" : "비공개 캐릭터 선택 단계")
    : activeCharacter
      ? `${characterName(activeCharacter)} 호출`
      : currentPhaseLabel || "대기 중";
  const actionLockText = phase !== "TURN_ACTION"
    ? currentPhaseLabel || "대기"
    : !isMyTurn
      ? `${actorText} 진행`
      : !actionTaken
        ? "기본 행동 대기"
        : canBuild
          ? `건설 ${buildableCards}장`
          : "턴 종료 판단";
  const actionLockDetail = phase !== "TURN_ACTION"
    ? "선택, 카드 보관, 무덤 선택 같은 별도 단계의 차례를 봅니다."
    : !isMyTurn
      ? "상대 캐릭터 호출 순서와 내 역할의 남은 순서를 비교합니다."
      : !actionTaken
        ? "금화 받기 또는 구역 카드 뽑기를 먼저 선택해야 합니다."
        : canBuild
          ? "건설 후보를 확인한 뒤 색상 보너스와 8구역 종료 조건을 같이 봅니다."
          : "수입, 특수 능력, 턴 종료 가능 여부를 확인합니다.";
  const tiles = [
    {
      key: "order",
      label: "호출 순서",
      value: activeText,
      detail: finalRound ? "마지막 라운드 압력이 켜져 있어 남은 호출 순서가 더 중요합니다." : "1번 암살자부터 8번 장군까지 차례대로 호출됩니다.",
      tone: "border-amber-200 bg-amber-50 text-amber-900",
    },
    {
      key: "mine",
      label: "내 역할",
      value: myRoleText,
      detail: myCharacterCodes.length ? "보라 표식으로 호출 레인에서 내 캐릭터 위치를 표시합니다." : "내 역할이 아직 공개되지 않았으면 순서만 확인합니다.",
      tone: "border-violet-200 bg-violet-50 text-violet-900",
    },
    {
      key: "removed",
      label: "공개 제외",
      value: removedText,
      detail: "공개 제외와 암살 대상은 이번 라운드 선택/호출 판단에서 먼저 제거해야 합니다.",
      tone: "border-rose-200 bg-rose-50 text-rose-900",
    },
    {
      key: "lock",
      label: "행동 잠금",
      value: actionLockText,
      detail: `${actionLockDetail} 기본 행동 ${actionTaken ? "완료" : "대기"} · 수입 ${incomeTaken ? "완료" : "확인"} · 능력 ${characterAbilityUsed ? "완료" : "확인"}`,
      tone: "border-sky-200 bg-sky-50 text-sky-900",
    },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-amber-100 bg-white p-3 shadow-lg" data-smoke="citadels-character-order-panel">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,420px)_1fr]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
          <CitadelsCharacterOrderArt items={orderItems} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                <GameUxGlyph type="turn" className="h-4 w-4 text-amber-600" />
                캐릭터 호출 순서
              </div>
              <p className="mt-1 text-sm font-bold leading-relaxed text-slate-600">
                캐릭터 선택, 암살 제외, 현재 호출, 내 역할 위치를 같은 레인에 묶어 이번 라운드의 남은 판단 순서를 읽습니다.
              </p>
            </div>
            <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-700">
              {actorText}
            </span>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {tiles.map((tile) => (
              <div key={tile.key} className={`min-h-[112px] rounded-xl border p-3 ${tile.tone}`} data-smoke="citadels-character-order-item">
                <div className="text-[11px] font-black">{tile.label}</div>
                <div className="mt-2 truncate text-sm font-black">{tile.value}</div>
                <div className="mt-1 line-clamp-3 text-xs font-bold leading-relaxed opacity-80">{tile.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const buildCitadelsSelectionRouteItems = ({
  selectionStep = "",
  isMySelection = false,
  chooserSeatNo = 0,
  players = [],
  availableCharacters = [],
  faceUpRemovedCharacters = [],
  actionBusy = false,
  turnGuidance = "",
}) => {
  const availableCount = asArray(availableCharacters).length;
  const removedCount = asArray(faceUpRemovedCharacters).length;
  const isDiscard = selectionStep === "DISCARD";
  const chooserText = chooserSeatNo ? playerName(players, chooserSeatNo) : "선택자";
  const lockedText = actionBusy ? "서버 처리 중" : isMySelection ? "내 선택 가능" : `${chooserText} 대기`;

  return [
    {
      key: "step",
      label: "선택 단계",
      value: isDiscard ? "제외" : "선택",
      detail: isDiscard ? "이번 라운드에서 빠질 캐릭터를 먼저 고르는 흐름입니다." : turnGuidance || `${chooserText}님이 이번 라운드 역할을 고릅니다.`,
      tone: "border-amber-200 bg-amber-50 text-amber-900",
      fill: "#f59e0b",
      active: true,
    },
    {
      key: "removed",
      label: "공개 제외",
      value: removedCount ? `${removedCount}장` : "없음",
      detail: removedCount ? "공개 제외 캐릭터는 후보에서 빼고 남은 능력만 비교합니다." : "공개 제외가 없으면 남은 후보 전체를 기준으로 봅니다.",
      tone: "border-rose-200 bg-rose-50 text-rose-900",
      fill: "#e11d48",
      active: removedCount > 0,
    },
    {
      key: "candidates",
      label: "후보 카드",
      value: `${availableCount}장`,
      detail: isMySelection ? "아래 카드 중 하나가 실제 제출 대상입니다." : `${chooserText}님의 선택이 끝나면 후보 수가 줄어듭니다.`,
      tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
      fill: "#059669",
      active: availableCount > 0,
    },
    {
      key: "submit",
      label: "선택 버튼",
      value: lockedText,
      detail: isDiscard ? "카드 버튼을 누르면 이번 라운드 제외 처리가 진행됩니다." : "카드 버튼을 누르면 이번 라운드 역할 선택이 진행됩니다.",
      tone: isMySelection && !actionBusy ? "border-sky-200 bg-sky-50 text-sky-900" : "border-slate-200 bg-slate-50 text-slate-700",
      fill: isMySelection && !actionBusy ? "#0284c7" : "#64748b",
      active: isMySelection && !actionBusy,
    },
  ];
};

const CitadelsSelectionRouteArt = ({ items = [], selectionStep = "", isMySelection = false }) => {
  const nodes = asArray(items);
  const xFor = (index) => 44 + index * 88;

  return (
    <svg
      viewBox="0 0 360 150"
      role="img"
      aria-label="시티델 캐릭터 선택 단계의 공개 제외, 후보 카드, 제출 버튼 흐름"
      className="h-auto w-full"
      data-smoke="citadels-selection-route-art"
      focusable="false"
    >
      <rect x="8" y="8" width="344" height="134" rx="22" fill="#0f172a" stroke="#475569" strokeWidth="3" />
      <path d="M44 92H316" fill="none" stroke="#334155" strokeWidth="14" strokeLinecap="round" />
      <path d="M44 92H316" fill="none" stroke={isMySelection ? "#38bdf8" : "#94a3b8"} strokeWidth="5" strokeLinecap="round" />
      <text x="26" y="34" fontSize="11" fontWeight="900" fill="#fde68a">캐릭터 선택 루트</text>
      <text x="218" y="34" fontSize="10" fontWeight="900" fill="#bfdbfe">{selectionStep === "DISCARD" ? "제외 단계" : "선택 단계"}</text>
      {nodes.map((node, index) => {
        const x = xFor(index);
        return (
          <g key={node.key} data-smoke="citadels-selection-route-node" data-selection-key={node.key}>
            <circle cx={x} cy="92" r={node.active ? "23" : "19"} fill={node.active ? node.fill : "#1e293b"} stroke={node.active ? "#f8fafc" : "#64748b"} strokeWidth="3" />
            <circle cx={x} cy="92" r="8" fill="#ffffff" opacity={node.active ? ".34" : ".16"} />
            <text x={x} y="77" textAnchor="middle" fontSize="9" fontWeight="900" fill="#ffffff">{index + 1}</text>
            <text x={x} y="118" textAnchor="middle" fontSize="9" fontWeight="900" fill="#e2e8f0">{node.label}</text>
          </g>
        );
      })}
      <text x="26" y="134" fontSize="10" fontWeight="900" fill="#cbd5e1">카드 버튼에서 선택/제외 처리가 진행됩니다.</text>
    </svg>
  );
};

const CitadelsSelectionRoutePanel = ({
  selectionStep = "",
  isMySelection = false,
  chooserSeatNo = 0,
  players = [],
  availableCharacters = [],
  faceUpRemovedCharacters = [],
  actionBusy = false,
  turnGuidance = "",
}) => {
  const items = buildCitadelsSelectionRouteItems({
    selectionStep,
    isMySelection,
    chooserSeatNo,
    players,
    availableCharacters,
    faceUpRemovedCharacters,
    actionBusy,
    turnGuidance,
  });
  const availableCount = asArray(availableCharacters).length;
  const removedCount = asArray(faceUpRemovedCharacters).length;
  const modeText = selectionStep === "DISCARD" ? "제외 처리" : "역할 선택";

  return (
    <section
      className="mb-4 overflow-hidden rounded-2xl border border-sky-100 bg-sky-50/50 p-3"
      data-smoke="citadels-selection-route-panel"
      data-selection-step={selectionStep || ""}
      data-my-selection={isMySelection ? "true" : "false"}
      data-available-count={availableCount}
      data-removed-count={removedCount}
      data-action-busy={actionBusy ? "true" : "false"}
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,360px)_1fr]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
          <CitadelsSelectionRouteArt items={items} selectionStep={selectionStep} isMySelection={isMySelection} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                <GameUxGlyph type="decision" className="h-4 w-4 text-sky-600" />
                캐릭터 선택 루트
              </div>
              <p className="mt-1 text-sm font-bold leading-relaxed text-slate-600">
                공개 제외, 후보 카드, 실제 선택 버튼을 같은 흐름으로 묶어 현재 선택 단계의 잠금 이유를 봅니다.
              </p>
            </div>
            <span className="inline-flex shrink-0 rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-700">
              {modeText}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {items.map((item) => (
              <div
                key={item.key}
                className={`min-h-[112px] rounded-xl border p-3 ${item.tone}`}
                data-smoke="citadels-selection-route-item"
                data-selection-key={item.key}
              >
                <div className="text-[11px] font-black">{item.label}</div>
                <div className="mt-2 truncate text-sm font-black">{item.value}</div>
                <div className="mt-1 line-clamp-3 text-xs font-bold leading-relaxed opacity-80">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const CitadelsEconomyLensArt = ({
  gold = 0,
  handCount = 0,
  cityCount = 0,
  buildableCount = 0,
  bestCardName = "후보 없음",
  colorProgress,
  incomeColor = "",
  incomePreview = 0,
}) => {
  const completedColors = colorProgress?.colors || new Set();
  const missingText = colorProgress?.completed ? "색상 완성" : colorProgress?.missingText || "색상 확인";
  const incomeText = incomeColor ? `${colorLabels[incomeColor] || incomeColor} ${incomePreview}` : "0";
  const citySlots = Array.from({ length: 8 }, (_, index) => index);

  return (
    <svg
      viewBox="0 0 360 180"
      role="img"
      aria-label="시티델 금화, 손패, 도시 완성도 요약"
      className="h-full min-h-[180px] w-full"
      data-smoke="citadels-economy-lens-art"
    >
      <rect x="10" y="10" width="340" height="160" rx="22" fill="#0f172a" />
      <rect x="24" y="26" width="94" height="124" rx="18" fill="#fef3c7" stroke="#f59e0b" strokeWidth="4" />
      <circle cx="55" cy="74" r="20" fill="#fbbf24" stroke="#92400e" strokeWidth="4" />
      <circle cx="81" cy="88" r="20" fill="#fde68a" stroke="#92400e" strokeWidth="4" />
      <circle cx="60" cy="105" r="20" fill="#fcd34d" stroke="#92400e" strokeWidth="4" />
      <text x="71" y="48" textAnchor="middle" fontSize="12" fontWeight="900" fill="#92400e">금화</text>
      <text x="71" y="126" textAnchor="middle" fontSize="24" fontWeight="900" fill="#78350f">{gold}</text>

      <rect x="138" y="34" width="74" height="102" rx="14" fill="#e0f2fe" stroke="#0369a1" strokeWidth="4" transform="rotate(-8 175 85)" />
      <rect x="158" y="30" width="74" height="108" rx="14" fill="#f8fafc" stroke="#334155" strokeWidth="4" />
      <rect x="178" y="38" width="74" height="102" rx="14" fill="#ecfdf5" stroke="#047857" strokeWidth="4" transform="rotate(8 215 89)" />
      <text x="195" y="67" textAnchor="middle" fontSize="12" fontWeight="900" fill="#0f172a">손패</text>
      <text x="195" y="96" textAnchor="middle" fontSize="26" fontWeight="900" fill="#0f172a">{handCount}</text>
      <text x="195" y="119" textAnchor="middle" fontSize="11" fontWeight="900" fill="#047857">건설 {buildableCount}</text>

      <rect x="272" y="48" width="58" height="102" rx="10" fill="#fee2e2" stroke="#991b1b" strokeWidth="4" />
      <path d="M281 50V34h13v16M306 50V30h13v20" fill="none" stroke="#991b1b" strokeWidth="5" strokeLinecap="round" />
      <rect x="285" y="79" width="9" height="12" rx="3" fill="#991b1b" opacity=".75" />
      <rect x="305" y="79" width="9" height="12" rx="3" fill="#991b1b" opacity=".75" />
      <rect x="292" y="112" width="18" height="38" rx="4" fill="#7f1d1d" />
      <text x="301" y="68" textAnchor="middle" fontSize="11" fontWeight="900" fill="#7f1d1d">도시</text>

      {citySlots.map((slot) => (
        <rect
          key={slot}
          x={41 + slot * 36}
          y="154"
          width="24"
          height="6"
          rx="3"
          fill={slot < cityCount ? "#f59e0b" : "#475569"}
        />
      ))}

      {colorOrder.map((color, index) => (
        <circle
          key={color}
          cx={135 + index * 18}
          cy="153"
          r="6"
          fill={citadelsDistrictArtTones[color]?.wall || "#94a3b8"}
          opacity={completedColors.has(color) ? "1" : ".3"}
          stroke="#f8fafc"
          strokeWidth="2"
        />
      ))}

      <text x="26" y="20" fontSize="10" fontWeight="900" fill="#fde68a">경제 요약</text>
      <text x="135" y="23" fontSize="10" fontWeight="900" fill="#bfdbfe">{bestCardName}</text>
      <text x="260" y="23" fontSize="10" fontWeight="900" fill="#fecaca">색상 {missingText}</text>
      <text x="271" y="166" fontSize="10" fontWeight="900" fill="#f8fafc">수입 {incomeText}</text>
    </svg>
  );
};

const CitadelsBuildBlockedBriefArt = ({
  myGold = 0,
  handCount = 0,
  tooExpensiveCount = 0,
  duplicateCount = 0,
  builtThisTurn = 0,
  buildLimit = 1,
  canBuild = false,
}) => {
  const limitReached = Number(builtThisTurn) >= Number(buildLimit);
  const activeTone = canBuild && !limitReached ? "#f59e0b" : "#64748b";
  const nodes = [
    { key: "gold", label: "금화", value: `${myGold}`, x: 68, y: 92, active: tooExpensiveCount > 0, fill: "#f59e0b" },
    { key: "hand", label: "손패", value: `${handCount}`, x: 146, y: 55, active: handCount > 0, fill: "#0ea5e9" },
    { key: "dup", label: "중복", value: `${duplicateCount}`, x: 224, y: 92, active: duplicateCount > 0, fill: "#ef4444" },
    { key: "limit", label: "제한", value: `${builtThisTurn}/${buildLimit}`, x: 300, y: 55, active: limitReached, fill: "#8b5cf6" },
  ];

  return (
    <svg
      viewBox="0 0 360 150"
      role="img"
      aria-label="시티델 건설 후보가 없는 이유"
      className="h-auto w-full"
      data-smoke="citadels-build-blocked-art"
      focusable="false"
    >
      <rect x="8" y="8" width="344" height="134" rx="22" fill="#0f172a" stroke="#475569" strokeWidth="3" />
      <path d="M42 114C74 54 118 43 174 82c49 34 94 28 139-34" fill="none" stroke="#334155" strokeWidth="14" strokeLinecap="round" />
      <path d="M42 114C74 54 118 43 174 82c49 34 94 28 139-34" fill="none" stroke={activeTone} strokeWidth="5" strokeLinecap="round" />
      <text x="28" y="34" fontSize="11" fontWeight="900" fill="#fde68a">건설 후보 브리핑</text>
      <text x="28" y="53" fontSize="17" fontWeight="900" fill="#ffffff">왜 지금 지을 카드가 없나</text>
      {nodes.map((node) => (
        <g key={node.key} data-smoke="citadels-build-blocked-node">
          <circle cx={node.x} cy={node.y} r="21" fill={node.active ? node.fill : "#1e293b"} stroke={node.active ? "#f8fafc" : "#64748b"} strokeWidth="3" />
          <text x={node.x} y={node.y - 4} textAnchor="middle" fontSize="9" fontWeight="900" fill={node.active ? "#ffffff" : "#cbd5e1"}>{node.label}</text>
          <text x={node.x} y={node.y + 11} textAnchor="middle" fontSize="11" fontWeight="900" fill="#ffffff">{node.value}</text>
        </g>
      ))}
    </svg>
  );
};

const CitadelsBuildBlockedBrief = ({
  myGold = 0,
  handCount = 0,
  affordableCount = 0,
  tooExpensiveCount = 0,
  duplicateCount = 0,
  canBuild = false,
  builtThisTurn = 0,
  buildLimit = 1,
  colorProgress,
}) => {
  const limitReached = Number(builtThisTurn) >= Number(buildLimit);
  const reason = limitReached
    ? "건설 제한 도달"
    : tooExpensiveCount >= handCount
      ? "금화 부족"
      : duplicateCount > 0
        ? "중복 구역"
        : !canBuild
          ? "행동 순서 대기"
          : "건설 후보 없음";
  const reasonDetail = limitReached
    ? "이번 턴 건설 횟수를 이미 사용해서 추가 건설은 턴 종료 이후를 봐야 합니다."
    : tooExpensiveCount >= handCount
      ? "손패의 모든 구역 비용이 현재 금화보다 높아 바로 지을 수 없습니다."
      : duplicateCount > 0
        ? "금화는 되지만 이미 도시 안에 같은 구역이 있어 중복 제한에 걸립니다."
        : !canBuild
          ? "금화 받기나 카드 뽑기 같은 기본 행동이 먼저 처리되어야 건설 판단이 열립니다."
          : "금화, 중복 구역, 턴 제한을 합치면 지금 즉시 지을 카드가 없습니다.";
  const nextMove = !canBuild
    ? "기본 행동 먼저"
    : tooExpensiveCount > 0
      ? "금화 확보"
      : duplicateCount > 0
        ? "카드 보충"
        : "턴 종료 검토";
  const colorText = colorProgress?.completed ? "색상 보너스 가능" : `부족 색상: ${colorProgress?.missingText || "-"}`;
  const items = [
    {
      key: "reason",
      label: "막힌 이유",
      value: reason,
      detail: reasonDetail,
    },
    {
      key: "basis",
      label: "판정 근거",
      value: `가능 0/${handCount}장`,
      detail: `금화권 ${affordableCount}장 · 비용 초과 ${tooExpensiveCount}장 · 중복 ${duplicateCount}장`,
    },
    {
      key: "next",
      label: "다음 판단",
      value: nextMove,
      detail: `${colorText} · 건설 ${builtThisTurn}/${buildLimit} 상태를 유지하며 다음 액션을 고릅니다.`,
    },
  ];

  return (
    <div data-smoke="citadels-build-blocked-brief" className="mt-3 grid gap-2 rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-sky-50 p-2.5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <CitadelsBuildBlockedBriefArt
        myGold={myGold}
        handCount={handCount}
        tooExpensiveCount={tooExpensiveCount}
        duplicateCount={duplicateCount}
        builtThisTurn={builtThisTurn}
        buildLimit={buildLimit}
        canBuild={canBuild}
      />
      <div className="grid gap-2 md:grid-cols-3">
        {items.map((item) => (
          <div key={item.key} data-smoke="citadels-build-blocked-item" data-build-block-key={item.key} className="rounded-xl border border-white/80 bg-white/85 px-3 py-2">
            <div className="text-[10px] font-black text-amber-600">{item.label}</div>
            <div className="mt-1 text-sm font-black text-slate-950">{item.value}</div>
            <div className="mt-1 text-[11px] font-bold leading-snug text-slate-600">{item.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const CitadelsEconomyLensPanel = ({
  phase,
  myCitadelsPlayer,
  myGold,
  myHand,
  myCity,
  colorProgress,
  buildableCards,
  canBuild,
  builtThisTurn,
  buildLimit,
  incomeColor,
  incomePreview,
  incomeTaken,
  activeCharacter,
  actionTaken,
  isMyTurn,
  pendingChoices,
  pendingKeepCount,
}) => {
  const handCount = myHand.length;
  const cityCount = myCity.length;
  const affordableCards = myHand.filter((card) => cardCostOf(card) <= myGold);
  const tooExpensiveCards = myHand.filter((card) => cardCostOf(card) > myGold);
  const duplicateBlockedCards = myHand.filter((card) => cardCostOf(card) <= myGold && !canBuildDuplicate(myCitadelsPlayer, card));
  const buildableCardList = myHand.filter((card) => cardCostOf(card) <= myGold && canBuildDuplicate(myCitadelsPlayer, card));
  const showBuildBlockedBrief = handCount > 0 && !buildableCardList.length;
  const missingColors = colorProgress.missing || [];
  const bestBuildCard = [...buildableCardList]
    .sort((left, right) => {
      const leftMissing = missingColors.includes(cardColorOf(left)) ? 1 : 0;
      const rightMissing = missingColors.includes(cardColorOf(right)) ? 1 : 0;
      return rightMissing - leftMissing || cardCostOf(right) - cardCostOf(left) || cardNameOf(left).localeCompare(cardNameOf(right), "ko");
    })[0];
  const bestCardName = bestBuildCard ? cardNameOf(bestBuildCard) : "후보 없음";
  const bestCardCost = bestBuildCard ? cardCostOf(bestBuildCard) : 0;
  const bestCardColor = bestBuildCard ? cardColorOf(bestBuildCard) : "";
  const pendingChoiceFit = asArray(pendingChoices).filter((card) => cardCostOf(card) <= myGold || missingColors.includes(cardColorOf(card))).length;
  const cityRemaining = Math.max(0, 8 - cityCount);
  const incomeLabel = incomeColor ? `${colorLabels[incomeColor] || incomeColor} ${incomePreview}금화` : "색상 수입 없음";
  const buildValue = canBuild
    ? `${buildableCards}장 가능`
    : isMyTurn && !actionTaken
      ? "기본 행동 먼저"
      : buildableCards
        ? `${buildableCards}장 후보`
        : "후보 없음";
  const guidance = (() => {
    if (phase === "FINISHED") return "최종 점수는 구역 비용, 완성 보너스, 색상 보너스를 합산해 확인합니다.";
    if (phase === "DISTRICT_CHOICE" && pendingKeepCount) return `${pendingKeepCount}장 선택 중입니다. 부족 색상과 즉시 건설 가능한 비용을 먼저 비교하세요.`;
    if (isMyTurn && !actionTaken) return "금화 2개와 카드 선택 중 어느 쪽이 다음 건설 후보를 늘리는지 먼저 판단하세요.";
    if (isMyTurn && canBuild) return bestBuildCard ? `${bestCardName} 건설이 현재 가장 선명한 후보입니다.` : "건설 후보가 없으면 특수 구역 능력이나 턴 종료를 검토하세요.";
    if (activeCharacter) return `${characterName(activeCharacter)} 차례의 경제 흐름을 관찰하며 내 도시 완성 속도를 비교하세요.`;
    return "금화, 손패, 색상 보너스, 8구역 완성 속도를 같은 기준으로 봅니다.";
  })();
  const tileToneClass = {
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    sky: "border-sky-200 bg-sky-50 text-sky-900",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
  };
  const tiles = [
    {
      key: "build",
      icon: "build",
      label: "건설 후보",
      value: buildValue,
      detail: bestBuildCard
        ? `${bestCardName} · 비용 ${bestCardCost} · ${missingColors.includes(bestCardColor) ? "부족 색상 보강" : "도시 확장"}`
        : `${affordableCards.length}/${handCount}장만 금화로 감당 가능합니다.`,
      tone: "amber",
    },
    {
      key: "gold",
      icon: "coin",
      label: "금화 압력",
      value: `${myGold}금화`,
      detail: incomeTaken ? `${incomeLabel} 수입은 이미 반영됐습니다.` : `${incomeLabel} 기준으로 다음 건설 여유를 봅니다.`,
      tone: "emerald",
    },
    {
      key: "color",
      icon: "score",
      label: "색상 보너스",
      value: colorProgress.completed ? "가능" : `${missingColors.length}색 부족`,
      detail: colorProgress.completed ? "다섯 색상 보너스 조건이 준비됐습니다." : `부족 색상: ${colorProgress.missingText}`,
      tone: "sky",
    },
    {
      key: "finish",
      icon: "stage",
      label: "도시 완성",
      value: `${cityCount}/8구역`,
      detail: cityRemaining ? `종료 압력까지 ${cityRemaining}구역 남음 · 이번 턴 건설 ${builtThisTurn}/${buildLimit}` : "8구역 완성 압력이 이미 발생했습니다.",
      tone: "rose",
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-lg" data-smoke="citadels-economy-lens-panel">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,360px)_1fr]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
          <CitadelsEconomyLensArt
            gold={myGold}
            handCount={handCount}
            cityCount={cityCount}
            buildableCount={buildableCardList.length}
            bestCardName={bestCardName}
            colorProgress={colorProgress}
            incomeColor={incomeColor}
            incomePreview={incomePreview}
          />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                <GameUxGlyph type="coin" className="h-4 w-4 text-amber-600" />
                시티델 경제 요약
              </div>
              <p className="mt-1 text-sm font-bold leading-relaxed text-slate-600">{guidance}</p>
            </div>
            <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-700">
              후보 선택 {pendingChoiceFit ? `${pendingChoiceFit}장 참고` : "대기"}
            </span>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {tiles.map((tile) => (
              <div key={tile.key} className={`min-h-[112px] rounded-xl border p-3 ${tileToneClass[tile.tone]}`} data-smoke="citadels-economy-lens-item">
                <div className="flex items-center gap-2 text-[11px] font-black">
                  <GameUxGlyph type={tile.icon} className="h-3.5 w-3.5" />
                  {tile.label}
                </div>
                <div className="mt-2 truncate text-sm font-black">{tile.value}</div>
                <div className="mt-1 line-clamp-3 text-xs font-bold leading-relaxed opacity-80">{tile.detail}</div>
              </div>
            ))}
          </div>
          {showBuildBlockedBrief && (
            <CitadelsBuildBlockedBrief
              myGold={myGold}
              handCount={handCount}
              affordableCount={affordableCards.length}
              tooExpensiveCount={tooExpensiveCards.length}
              duplicateCount={duplicateBlockedCards.length}
              canBuild={canBuild}
              builtThisTurn={builtThisTurn}
              buildLimit={buildLimit}
              colorProgress={colorProgress}
            />
          )}
        </div>
      </div>
    </section>
  );
};

const CitadelsActionAvailabilityArt = ({
  phase,
  isMyTurn = false,
  actionTaken = false,
  incomeTaken = false,
  characterAbilityUsed = false,
  canBuild = false,
  canEndTurn = false,
  myGold = 0,
  handCount = 0,
  buildableCards = 0,
  incomeColor,
}) => {
  const isTurnAction = phase === "TURN_ACTION";
  const nodes = [
    {
      key: "basic",
      x: 58,
      y: 82,
      label: "기본",
      value: actionTaken ? "완료" : isMyTurn && isTurnAction ? "선택" : "대기",
      state: actionTaken ? "done" : isMyTurn && isTurnAction ? "active" : "locked",
      fill: "#f59e0b",
    },
    {
      key: "income",
      x: 152,
      y: 54,
      label: "수입",
      value: incomeColor ? (incomeTaken ? "완료" : "가능") : characterAbilityUsed ? "능력" : "선택",
      state: incomeTaken || characterAbilityUsed ? "done" : incomeColor && isMyTurn ? "active" : "neutral",
      fill: "#10b981",
    },
    {
      key: "build",
      x: 238,
      y: 92,
      label: "건설",
      value: canBuild ? `${buildableCards}장` : `${handCount}장`,
      state: canBuild ? "active" : "locked",
      fill: "#0ea5e9",
    },
    {
      key: "end",
      x: 324,
      y: 62,
      label: "종료",
      value: canEndTurn ? "가능" : "잠김",
      state: canEndTurn ? "active" : "locked",
      fill: "#8b5cf6",
    },
  ];
  const stateFill = {
    active: "#ffffff",
    done: "#ecfdf5",
    locked: "#f8fafc",
    neutral: "#ffffff",
  };
  const stateStroke = {
    active: "#f8fafc",
    done: "#10b981",
    locked: "#cbd5e1",
    neutral: "#e2e8f0",
  };

  return (
    <svg
      viewBox="0 0 380 150"
      role="img"
      aria-label="시티델 행동 가능성을 기본 행동, 수입, 건설, 턴 종료 순서로 요약한 흐름도"
      className="h-auto w-full"
      data-smoke="citadels-action-availability-art"
      focusable="false"
    >
      <rect x="8" y="8" width="364" height="134" rx="22" fill="#0f172a" stroke="#334155" strokeWidth="3" />
      <text x="24" y="32" fontSize="11" fontWeight="900" fill="#fde68a">행동 가능성 지도</text>
      <text x="24" y="51" fontSize="17" fontWeight="900" fill="#ffffff">기본 → 수입/능력 → 건설 → 종료</text>
      <path d="M58 82C96 35 120 34 152 54s52 70 86 38 56-72 86-30" fill="none" stroke="#334155" strokeWidth="13" strokeLinecap="round" />
      <path d="M58 82C96 35 120 34 152 54s52 70 86 38 56-72 86-30" fill="none" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" />
      <text x="24" y="126" fontSize="10" fontWeight="900" fill="#cbd5e1">{`금화 ${myGold} · 손패 ${handCount} · 건설 후보 ${buildableCards}`}</text>
      {nodes.map((node) => (
        <g key={node.key} data-smoke="citadels-action-availability-node" data-availability-key={node.key} data-state={node.state}>
          <circle cx={node.x} cy={node.y} r="23" fill={stateFill[node.state]} stroke={node.state === "active" ? node.fill : stateStroke[node.state]} strokeWidth="4" />
          <circle cx={node.x} cy={node.y} r="7" fill={node.state === "locked" ? "#94a3b8" : node.fill} />
          <text x={node.x} y={node.y - 31} textAnchor="middle" fontSize="10" fontWeight="900" fill="#f8fafc">{node.label}</text>
          <text x={node.x} y={node.y + 39} textAnchor="middle" fontSize="10" fontWeight="900" fill="#e2e8f0">{node.value}</text>
        </g>
      ))}
    </svg>
  );
};

const CitadelsActionAvailabilityPanel = ({
  currentPhaseLabel,
  phase,
  isMyTurn,
  actionTaken,
  incomeTaken,
  characterAbilityUsed,
  canBuild,
  buildableCards,
  handCount,
  myGold,
  builtThisTurn,
  buildLimit,
  incomeColor,
  incomePreview,
  activeCharacter,
  canEndTurn,
  colorProgress,
  afterWarlordDestruction,
  hasLaboratory,
  hasSmithy,
  canUseLaboratory,
  canUseSmithy,
  actionBusy,
}) => {
  const isTurnAction = phase === "TURN_ACTION";
  const basicValue = !isTurnAction
    ? currentPhaseLabel || "대기"
    : !isMyTurn
      ? "상대 차례"
      : actionTaken
        ? "완료"
        : "선택 가능";
  const basicDetail = !isTurnAction
    ? "현재 단계가 행동 차례로 넘어오면 기본 행동을 선택합니다."
    : !isMyTurn
      ? `${characterName(activeCharacter)} 호출 차례를 기다립니다.`
      : actionTaken
        ? "금화 받기 또는 구역 카드 뽑기가 처리되어 추가 선택을 확인합니다."
        : "금화 2개 받기 또는 구역 카드 뽑기 중 하나를 먼저 고릅니다.";
  const buildValue = canBuild
    ? `${buildableCards}/${handCount}장`
    : afterWarlordDestruction
      ? "종료 대기"
      : !isMyTurn
        ? "대기"
        : !actionTaken
          ? "기본 행동 필요"
          : builtThisTurn >= buildLimit
            ? "제한 도달"
            : "잠김";
  const buildDetail = canBuild
    ? `금화 ${myGold} · 이번 턴 건설 ${builtThisTurn}/${buildLimit} · 색상 보너스 ${colorProgress.completed ? "가능" : `부족: ${colorProgress.missingText}`}`
    : `건설 ${builtThisTurn}/${buildLimit} · 금화 ${myGold} · 중복 구역과 비용 조건을 함께 확인합니다.`;
  const incomeValue = !incomeColor
    ? "없음"
    : incomeTaken
      ? "수입 완료"
      : isMyTurn && !afterWarlordDestruction
        ? "수입 가능"
        : "대기";
  const incomeDetail = incomeColor
    ? `${colorLabels[incomeColor]} 구역 ${incomePreview}개 기준 · 캐릭터 능력 ${characterAbilityUsed ? "사용 완료" : "사용 전"}`
    : `캐릭터 ${characterName(activeCharacter)}는 별도 색상 수입이 없습니다.`;
  const districtAbilityText = [
    hasLaboratory ? `실험실 ${canUseLaboratory ? "가능" : "잠김"}` : "",
    hasSmithy ? `대장간 ${canUseSmithy ? "가능" : "잠김"}` : "",
  ].filter(Boolean).join(" · ");
  const endValue = canEndTurn ? "가능" : actionBusy ? "처리 중" : "잠김";
  const endDetail = !isMyTurn
    ? "상대 차례가 끝나면 다음 호출 또는 선택 단계로 넘어갑니다."
    : !actionTaken
      ? "기본 행동을 먼저 선택해야 턴 종료가 열립니다."
      : afterWarlordDestruction
        ? "장군 파괴 뒤에는 남은 선택을 마치고 턴 종료만 가능합니다."
        : districtAbilityText || "남은 수입, 건설, 캐릭터 능력을 확인한 뒤 종료합니다.";
  const tiles = [
    {
      key: "basic",
      icon: "decision",
      label: "기본 행동",
      value: basicValue,
      detail: basicDetail,
      tone: isMyTurn && !actionTaken ? "active" : actionTaken ? "done" : "neutral",
    },
    {
      key: "build",
      icon: "build",
      label: "건설",
      value: buildValue,
      detail: buildDetail,
      tone: canBuild ? "active" : builtThisTurn >= buildLimit ? "done" : "locked",
    },
    {
      key: "income",
      icon: "coin",
      label: "수입/능력",
      value: incomeValue,
      detail: incomeDetail,
      tone: incomeColor && !incomeTaken && isMyTurn ? "active" : incomeTaken || characterAbilityUsed ? "done" : "neutral",
    },
    {
      key: "end",
      icon: "state",
      label: "턴 종료",
      value: endValue,
      detail: endDetail,
      tone: canEndTurn ? "active" : "locked",
    },
  ];
  const toneClass = {
    active: "border-amber-200 bg-amber-50 text-amber-800",
    done: "border-emerald-200 bg-emerald-50 text-emerald-800",
    locked: "border-slate-200 bg-slate-50 text-slate-600",
    neutral: "border-slate-200 bg-white text-slate-700",
  };

  return (
    <section
      className="mb-3 rounded-2xl border border-slate-100 bg-slate-50 p-3"
      data-smoke="citadels-action-availability-panel"
      data-phase={phase || ""}
      data-my-turn={isMyTurn}
      data-action-taken={actionTaken}
      data-can-build={canBuild}
      data-can-end-turn={canEndTurn}
      data-gold={myGold}
      data-hand-count={handCount}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <GameUxGlyph type="decision" className="h-4 w-4 text-amber-600" />
            행동 가능성
          </div>
          <p className="mt-1 text-xs font-bold leading-relaxed text-slate-600">버튼을 누르기 전에 열려 있는 행동과 잠긴 이유를 확인합니다.</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${isMyTurn ? "bg-amber-100 text-amber-800" : "bg-white text-slate-500"}`}>
          {isMyTurn ? "내 차례" : currentPhaseLabel || "대기"}
        </span>
      </div>
      <div className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
        <CitadelsActionAvailabilityArt
          phase={phase}
          isMyTurn={isMyTurn}
          actionTaken={actionTaken}
          incomeTaken={incomeTaken}
          characterAbilityUsed={characterAbilityUsed}
          canBuild={canBuild}
          canEndTurn={canEndTurn}
          myGold={myGold}
          handCount={handCount}
          buildableCards={buildableCards}
          incomeColor={incomeColor}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {tiles.map((tile) => (
          <div key={tile.key} className={`min-h-[104px] rounded-xl border p-3 ${toneClass[tile.tone] || toneClass.neutral}`} data-smoke="citadels-action-availability-item" data-availability-key={tile.key}>
            <div className="flex items-center gap-2 text-[11px] font-black">
              <GameUxGlyph type={tile.icon} className="h-3.5 w-3.5" />
              {tile.label}
            </div>
            <div className="mt-1 text-sm font-black text-slate-950">{tile.value}</div>
            <div className="mt-1 line-clamp-3 text-xs font-bold leading-relaxed text-slate-600">{tile.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
};

const citadelsActionRouteTone = {
  active: {
    card: "border-amber-200 bg-amber-50 text-amber-900",
    nodeFill: "#fef3c7",
    nodeStroke: "#f59e0b",
    text: "#92400e",
  },
  done: {
    card: "border-emerald-200 bg-emerald-50 text-emerald-800",
    nodeFill: "#dcfce7",
    nodeStroke: "#10b981",
    text: "#047857",
  },
  locked: {
    card: "border-slate-200 bg-slate-50 text-slate-600",
    nodeFill: "#f8fafc",
    nodeStroke: "#cbd5e1",
    text: "#64748b",
  },
  wait: {
    card: "border-sky-100 bg-sky-50 text-sky-800",
    nodeFill: "#e0f2fe",
    nodeStroke: "#0ea5e9",
    text: "#0369a1",
  },
};

const buildCitadelsActionRouteItems = ({
  currentPhaseLabel,
  phase,
  isMyTurn,
  actionTaken,
  incomeTaken,
  characterAbilityUsed,
  canBuild,
  buildableCards,
  handCount,
  myGold,
  builtThisTurn,
  buildLimit,
  incomeColor,
  incomePreview,
  activeCharacter,
  canEndTurn,
  afterWarlordDestruction,
  actionBusy,
}) => {
  const isTurnAction = phase === "TURN_ACTION";
  const characterLabel = characterName(activeCharacter);
  const basicState = actionTaken ? "done" : isMyTurn && isTurnAction ? "active" : "locked";
  const incomeReady = Boolean(incomeColor) && isMyTurn && !incomeTaken && !afterWarlordDestruction;
  const incomeState = incomeTaken || characterAbilityUsed ? "done" : incomeReady ? "active" : "wait";
  const buildState = canBuild ? "active" : builtThisTurn >= buildLimit ? "done" : "locked";
  const endState = canEndTurn ? "active" : actionBusy ? "wait" : "locked";

  return [
    {
      key: "basic",
      icon: "decision",
      label: "기본 행동",
      value: actionTaken ? "완료" : isMyTurn && isTurnAction ? "선택 가능" : currentPhaseLabel || "대기",
      detail: actionTaken
        ? "금화 받기 또는 구역 카드 뽑기가 처리되어 다음 선택을 확인합니다."
        : isMyTurn && isTurnAction
          ? "먼저 금화 2개 또는 구역 카드 뽑기 중 하나를 고르면 후속 버튼이 열립니다."
          : `${characterLabel} 호출 흐름이 내 차례로 넘어오기를 기다립니다.`,
      state: basicState,
    },
    {
      key: "income",
      icon: "coin",
      label: "수입/능력",
      value: incomeColor
        ? incomeTaken
          ? "수입 완료"
          : `+${incomePreview} 금화`
        : characterAbilityUsed
          ? "능력 완료"
          : "색상 없음",
      detail: incomeColor
        ? `${colorLabels[incomeColor]} 구역 수입을 확인하고, 캐릭터 능력은 ${characterAbilityUsed ? "이미 사용했습니다." : "필요하면 같은 구간에서 처리합니다."}`
        : `${characterLabel}는 별도 색상 수입이 없으므로 캐릭터 능력과 건설 가능성만 확인합니다.`,
      state: incomeState,
    },
    {
      key: "build",
      icon: "build",
      label: "건설 판단",
      value: canBuild ? `${buildableCards}/${handCount}장 가능` : `${builtThisTurn}/${buildLimit}회`,
      detail: canBuild
        ? `금화 ${myGold}개로 지을 수 있는 구역을 고릅니다. 중복 구역과 건설 제한은 기존 버튼 조건이 그대로 막습니다.`
        : afterWarlordDestruction
          ? "장군 파괴 뒤에는 추가 건설보다 남은 선택과 턴 종료를 확인합니다."
          : !actionTaken
            ? "기본 행동을 먼저 처리해야 건설 판단이 명확해집니다."
            : "금화, 중복 구역, 건설 횟수 중 하나가 막혀 있어 후보가 없습니다.",
      state: buildState,
    },
    {
      key: "finish",
      icon: "state",
      label: "턴 종료",
      value: canEndTurn ? "가능" : actionBusy ? "처리 중" : "잠김",
      detail: canEndTurn
        ? "수입, 건설, 캐릭터 능력 확인을 마쳤다면 턴 종료로 다음 호출에 넘깁니다."
        : actionBusy
          ? "서버가 방금 보낸 행동을 반영하는 동안 같은 액션을 반복하지 않습니다."
          : "기본 행동이 끝나야 종료가 열립니다. 잠긴 이유는 실제 종료 버튼 상태와 동일합니다.",
      state: endState,
    },
  ];
};

const CitadelsActionRouteArt = ({ items, phase, myGold, handCount, buildableCards }) => {
  const nodes = items.map((item, index) => ({
    ...item,
    x: 50 + index * 98,
    y: index % 2 ? 62 : 92,
    tone: citadelsActionRouteTone[item.state] || citadelsActionRouteTone.wait,
  }));
  const path = nodes.map((node, index) => `${index ? "L" : "M"}${node.x} ${node.y}`).join(" ");

  return (
    <svg
      viewBox="0 0 360 154"
      role="img"
      aria-label="시티델 액션 루트를 기본 행동, 수입과 능력, 건설 판단, 턴 종료 순서로 보여주는 그림"
      className="h-auto w-full"
      data-smoke="citadels-action-route-art"
      focusable="false"
    >
      <rect x="8" y="8" width="344" height="138" rx="20" fill="#111827" stroke="#334155" strokeWidth="3" />
      <rect x="20" y="22" width="320" height="102" rx="16" fill="#fff7ed" />
      <text x="28" y="40" fontSize="10" fontWeight="900" fill="#92400e">시티델 액션 루트</text>
      <text x="332" y="40" textAnchor="end" fontSize="9" fontWeight="900" fill="#475569">{phase || "대기"}</text>
      {nodes.length > 1 && (
        <>
          <path d={path} fill="none" stroke="#fed7aa" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
          <path d={path} fill="none" stroke="#92400e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {nodes.map((node, index) => (
        <g key={node.key} data-smoke="citadels-action-route-node" data-route-key={node.key} data-route-state={node.state}>
          <circle cx={node.x} cy={node.y} r="25" fill={node.tone.nodeFill} stroke={node.tone.nodeStroke} strokeWidth="4" />
          <text x={node.x} y={node.y - 4} textAnchor="middle" fontSize="13" fontWeight="900" fill={node.tone.text}>{index + 1}</text>
          <text x={node.x} y={node.y + 12} textAnchor="middle" fontSize="8" fontWeight="900" fill={node.tone.text}>{node.label.replace(" 판단", "")}</text>
        </g>
      ))}
      <rect x="28" y="128" width="304" height="12" rx="6" fill="#1f2937" />
      <text x="180" y="137" textAnchor="middle" fontSize="9" fontWeight="900" fill="#fde68a">
        {`금화 ${myGold} · 손패 ${handCount} · 건설 후보 ${buildableCards}`}
      </text>
    </svg>
  );
};

const CitadelsActionRoutePanel = ({
  currentPhaseLabel,
  phase,
  isMyTurn,
  actionTaken,
  incomeTaken,
  characterAbilityUsed,
  canBuild,
  buildableCards,
  handCount,
  myGold,
  builtThisTurn,
  buildLimit,
  incomeColor,
  incomePreview,
  activeCharacter,
  canEndTurn,
  afterWarlordDestruction,
  actionBusy,
}) => {
  const items = buildCitadelsActionRouteItems({
    currentPhaseLabel,
    phase,
    isMyTurn,
    actionTaken,
    incomeTaken,
    characterAbilityUsed,
    canBuild,
    buildableCards,
    handCount,
    myGold,
    builtThisTurn,
    buildLimit,
    incomeColor,
    incomePreview,
    activeCharacter,
    canEndTurn,
    afterWarlordDestruction,
    actionBusy,
  });

  return (
    <section
      className="mb-3 overflow-hidden rounded-2xl border border-amber-100 bg-white p-3"
      data-smoke="citadels-action-route-panel"
      data-phase={phase || ""}
      data-my-turn={isMyTurn}
      data-action-taken={actionTaken}
      data-income-color={incomeColor || ""}
      data-can-build={canBuild}
      data-can-end-turn={canEndTurn}
      data-buildable-cards={buildableCards}
    >
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
          <CitadelsActionRouteArt items={items} phase={phase} myGold={myGold} handCount={handCount} buildableCards={buildableCards} />
        </div>
        <div className="flex min-h-[160px] flex-col justify-center">
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black text-white">
            <GameUxGlyph type="decision" className="h-3.5 w-3.5" />
            실제 버튼 순서
          </div>
          <h3 className="mt-3 text-lg font-black text-slate-950">시티델 액션 루트</h3>
          <p className="mt-2 text-sm font-bold leading-relaxed text-slate-600">
            현재 버튼들이 왜 열렸는지, 어떤 순서로 처리하면 되는지 한 번에 확인합니다.
          </p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {items.map((item) => {
          const tone = citadelsActionRouteTone[item.state] || citadelsActionRouteTone.wait;
          return (
            <div key={item.key} className={`min-h-[108px] rounded-xl border p-3 ${tone.card}`} data-smoke="citadels-action-route-item" data-route-key={item.key} data-route-state={item.state}>
              <div className="flex items-center gap-2 text-[11px] font-black">
                <GameUxGlyph type={item.icon} className="h-3.5 w-3.5" />
                {item.label}
              </div>
              <div className="mt-1 text-sm font-black text-slate-950">{item.value}</div>
              <div className="mt-1 line-clamp-3 text-xs font-bold leading-relaxed opacity-80">{item.detail}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

const CitadelsEmptyHandArt = ({
  myGold = 0,
  isMyTurn = false,
  actionTaken = false,
  canBuild = false,
  colorProgress,
}) => {
  const missingCount = colorProgress?.completed ? 0 : colorProgress?.missing?.length || 0;
  const nodes = [
    { key: "draw", x: 78, y: 56, label: "뽑기", active: isMyTurn && !actionTaken, fill: "#f59e0b" },
    { key: "gold", x: 178, y: 34, label: `${myGold}금화`, active: myGold > 0, fill: "#10b981" },
    { key: "build", x: 260, y: 78, label: canBuild ? "후보 0" : "건설 잠김", active: false, fill: "#64748b" },
    { key: "bonus", x: 150, y: 122, label: missingCount ? `${missingCount}색 부족` : "색상 준비", active: !missingCount, fill: "#8b5cf6" },
  ];

  return (
    <svg
      viewBox="0 0 340 160"
      role="img"
      aria-label="손패가 비었을 때 다음 선택지를 요약한 시티델 일러스트"
      className="h-full min-h-[160px] w-full"
      data-smoke="citadels-empty-hand-art"
    >
      <rect x="10" y="12" width="320" height="136" rx="18" fill="#fff7ed" />
      <path d="M38 112c34-28 68-28 102 0s70 27 112-6c22-17 42-21 62-11" fill="none" stroke="#f59e0b" strokeWidth="5" strokeLinecap="round" />
      <rect x="42" y="42" width="54" height="78" rx="10" fill="#ffffff" stroke="#fed7aa" strokeWidth="3" />
      <rect x="52" y="52" width="54" height="78" rx="10" fill="#ffffff" stroke="#fbbf24" strokeWidth="3" />
      <path d="M63 71h28M63 88h20M63 105h26" fill="none" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round" />
      <path d="M206 94h54v34h-54z" fill="#fef3c7" stroke="#f59e0b" strokeWidth="3" />
      <path d="M214 94V77h38v17M221 77V62h22v15" fill="none" stroke="#92400e" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="269" cy="47" r="18" fill="#dcfce7" stroke="#10b981" strokeWidth="3" />
      <path d="M257 47h24M263 39v16M275 39v16" fill="none" stroke="#047857" strokeWidth="3" strokeLinecap="round" />
      <path d="M121 131h98" fill="none" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
      {nodes.map((node) => (
        <g key={node.key} data-smoke="citadels-empty-hand-node" opacity={node.active ? 1 : 0.74}>
          <circle cx={node.x} cy={node.y} r={15} fill={node.active ? node.fill : "#f8fafc"} stroke={node.fill} strokeWidth="3" />
          <circle cx={node.x} cy={node.y} r="5" fill={node.active ? "#ffffff" : node.fill} />
          <text x={node.x} y={node.y + 29} textAnchor="middle" fontSize="11" fontWeight="900" fill="#334155">{node.label}</text>
        </g>
      ))}
    </svg>
  );
};

const CitadelsEmptyHandPanel = ({
  currentPhaseLabel,
  myGold,
  isMyTurn,
  actionTaken,
  incomeTaken,
  activeCharacter,
  canBuild,
  colorProgress,
}) => {
  const hasBasicChoice = isMyTurn && !actionTaken;
  const characterLabel = activeCharacter ? characterName(activeCharacter) : "다음 캐릭터";
  const colorText = colorProgress?.completed ? "색상 보너스 조건 충족" : `부족 색상: ${colorProgress?.missingText || "-"}`;
  const headline = hasBasicChoice
    ? "구역 카드를 뽑아 건설 후보를 다시 만드세요."
    : actionTaken
      ? "기본 행동은 끝났습니다. 남은 수입, 능력, 턴 종료를 확인하세요."
      : `${characterLabel} 차례가 열릴 때까지 다음 선택지를 준비합니다.`;
  const tiles = [
    {
      key: "draw",
      icon: "decision",
      label: "구역 보충",
      value: hasBasicChoice ? "카드 뽑기 우선" : "선택 대기",
      detail: hasBasicChoice ? "손패가 비어 있으므로 새 건설 후보를 만들려면 구역 카드 뽑기가 가장 직접적입니다." : "기본 행동 가능 시점에 구역 카드 뽑기로 선택지를 복구합니다.",
      tone: hasBasicChoice ? "active" : "neutral",
    },
    {
      key: "gold",
      icon: "coin",
      label: "금화",
      value: `${myGold}개 보유`,
      detail: myGold >= 2 ? "비용은 준비되어도 손패가 없으면 지을 구역이 없습니다." : "금화가 적다면 카드 보충 뒤 다음 턴 비용도 함께 봐야 합니다.",
      tone: myGold >= 2 ? "done" : "neutral",
    },
    {
      key: "build",
      icon: "build",
      label: "건설",
      value: canBuild ? "후보 없음" : "잠김",
      detail: "손패가 0장이어서 금화, 중복 구역, 건설 제한보다 먼저 카드 후보가 필요합니다.",
      tone: "locked",
    },
    {
      key: "bonus",
      icon: "score",
      label: "색상 보너스",
      value: colorProgress?.completed ? "준비됨" : "추가 색 필요",
      detail: colorText,
      tone: colorProgress?.completed ? "done" : "neutral",
    },
  ];
  const toneClass = {
    active: "border-amber-200 bg-amber-50 text-amber-900",
    done: "border-emerald-200 bg-emerald-50 text-emerald-800",
    locked: "border-slate-200 bg-slate-50 text-slate-600",
    neutral: "border-white/70 bg-white/80 text-slate-700",
  };

  return (
    <div className="sm:col-span-2 overflow-hidden rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-3" data-smoke="citadels-empty-hand-panel">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_1.1fr]">
        <div className="min-h-[160px] rounded-xl border border-white/80 bg-white/70">
          <CitadelsEmptyHandArt myGold={myGold} isMyTurn={isMyTurn} actionTaken={actionTaken} canBuild={canBuild} colorProgress={colorProgress} />
        </div>
        <div className="flex min-h-[160px] flex-col justify-center rounded-xl border border-white/80 bg-white/75 p-4">
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-800">
            <GameUxGlyph type="decision" className="h-3.5 w-3.5" />
            {currentPhaseLabel || "대기"} · {incomeTaken ? "수입 확인됨" : "수입 확인 필요"}
          </div>
          <h3 className="mt-3 text-lg font-black text-slate-950">손패가 비었습니다</h3>
          <p className="mt-2 text-sm font-bold leading-relaxed text-slate-600">{headline}</p>
          <div className="mt-3 rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white">
            건설 후보 없음 · 금화 {myGold}개 · {colorText}
          </div>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.key} className={`min-h-[108px] rounded-xl border p-3 ${toneClass[tile.tone] || toneClass.neutral}`} data-smoke="citadels-empty-hand-item">
            <div className="flex items-center gap-2 text-[11px] font-black">
              <GameUxGlyph type={tile.icon} className="h-3.5 w-3.5" />
              {tile.label}
            </div>
            <div className="mt-1 text-sm font-black text-slate-950">{tile.value}</div>
            <div className="mt-1 line-clamp-3 text-xs font-bold leading-relaxed opacity-80">{tile.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const buildCitadelsPlayerStateRows = ({ players, selectedRoom, citadelsPlayers, status, activeSeatNo, winnerSeatNo, mySeatNo }) => {
  const roomPlayers = asArray(players);
  const gamePlayers = asArray(citadelsPlayers);
  const hostMemberId = Number(get(selectedRoom, "host_member_id", "hostMemberId", 0));
  const gamePlayersBySeat = new Map(gamePlayers.map((player) => [seatNoOf(player), player]));
  const rows = roomPlayers.map((roomPlayer, index) => {
    const seatNo = seatNoOf(roomPlayer);
    const gamePlayer = gamePlayersBySeat.get(seatNo) || null;
    const city = cityOf(gamePlayer);
    const cityProgress = cityColorProgress(city);
    const characterCodes = charactersOf(gamePlayer);
    const characterCode = characterCodes[0] || get(gamePlayer, "character_code", "characterCode", "");
    const host = memberIdOf(roomPlayer) === hostMemberId;
    const ready = host || isReady(roomPlayer);
    const active = Number(activeSeatNo) > 0 && seatNo === Number(activeSeatNo);
    const winner = Number(winnerSeatNo) > 0 && seatNo === Number(winnerSeatNo);
    const mine = Number(mySeatNo) > 0 && seatNo === Number(mySeatNo);
    const districtScore = districtScoreOf(city);
    const score = gamePlayer ? citadelsScoreOf(gamePlayer) : districtScore;
    const bonusScore = gamePlayer ? citadelsBonusScoreOf(gamePlayer) : 0;
    const gold = gamePlayer ? citadelsNumberField(gamePlayer, "gold", "gold", 0) : 0;
    const hand = handOf(gamePlayer);
    const handCount = gamePlayer ? citadelsNumberField(gamePlayer, "hand_count", "handCount", hand.length) : 0;
    const stateLabel = winner
      ? "승자"
      : active
        ? "현재 차례"
        : mine
          ? "내 좌석"
          : status === "WAITING"
            ? (ready ? "준비 완료" : "준비 대기")
            : (statusLabels[status] || "진행 관찰");

    return {
      key: `room-${memberIdOf(roomPlayer) || seatNo || index}`,
      seatNo,
      name: get(roomPlayer, "nickname", "nickname", playerName(roomPlayers, seatNo)),
      host,
      ready,
      active,
      winner,
      mine,
      city,
      cityCount: city.length,
      cityProgress,
      districtScore,
      score,
      bonusScore,
      gold,
      handCount,
      character: characterName(characterCode),
      stateLabel,
    };
  });
  const roomSeatNos = new Set(rows.map((row) => row.seatNo));
  const extraRows = gamePlayers
    .filter((player) => !roomSeatNos.has(seatNoOf(player)))
    .map((player, index) => {
      const seatNo = seatNoOf(player);
      const city = cityOf(player);
      const cityProgress = cityColorProgress(city);
      const characterCodes = charactersOf(player);
      const characterCode = characterCodes[0] || get(player, "character_code", "characterCode", "");
      const active = Number(activeSeatNo) > 0 && seatNo === Number(activeSeatNo);
      const winner = Number(winnerSeatNo) > 0 && seatNo === Number(winnerSeatNo);
      const mine = Number(mySeatNo) > 0 && seatNo === Number(mySeatNo);
      const hand = handOf(player);

      return {
        key: `state-${seatNo || index}`,
        seatNo,
        name: playerName(roomPlayers, seatNo),
        host: false,
        ready: true,
        active,
        winner,
        mine,
        city,
        cityCount: city.length,
        cityProgress,
        districtScore: districtScoreOf(city),
        score: citadelsScoreOf(player),
        bonusScore: citadelsBonusScoreOf(player),
        gold: citadelsNumberField(player, "gold", "gold", 0),
        handCount: citadelsNumberField(player, "hand_count", "handCount", hand.length),
        character: characterName(characterCode),
        stateLabel: winner ? "승자" : active ? "현재 차례" : mine ? "내 좌석" : (statusLabels[status] || "진행 관찰"),
      };
    });

  return [...rows, ...extraRows].sort((left, right) => left.seatNo - right.seatNo);
};

const citadelsPlayerStateNodeTone = (row) => {
  if (row.winner) return { fill: "#059669", stroke: "#bbf7d0", text: "#ffffff", ring: "#34d399" };
  if (row.active) return { fill: "#d97706", stroke: "#fed7aa", text: "#ffffff", ring: "#f59e0b" };
  if (row.mine) return { fill: "#2563eb", stroke: "#bfdbfe", text: "#ffffff", ring: "#60a5fa" };
  if (row.ready) return { fill: "#475569", stroke: "#e2e8f0", text: "#ffffff", ring: "#94a3b8" };
  return { fill: "#f8fafc", stroke: "#cbd5e1", text: "#64748b", ring: "#cbd5e1" };
};

const CitadelsPlayerStateMapArt = ({ rows, status }) => {
  const nodes = rows.map((row, index) => ({
    ...row,
    x: 56 + (index % 4) * 96,
    y: index < 4 ? 70 : 134,
    tone: citadelsPlayerStateNodeTone(row),
  }));
  const routePath = nodes.map((node, index) => `${index ? "L" : "M"}${node.x} ${node.y}`).join(" ");
  const statusText = statusLabels[status] || status || "대기 중";

  return (
    <svg
      viewBox="0 0 420 188"
      role="img"
      aria-label="시티델 참가자와 도시 진행 상태 지도"
      className="h-full min-h-[188px] w-full"
      data-smoke="citadels-player-state-map-art"
    >
      <rect x="10" y="10" width="400" height="168" rx="24" fill="#0f172a" />
      <rect x="24" y="24" width="372" height="140" rx="20" fill="#fff7ed" />
      <rect x="36" y="38" width="348" height="116" rx="18" fill="#ffffff" />
      <text x="44" y="54" fontSize="10" fontWeight="900" fill="#92400e">참가자 도시 지도</text>
      <text x="376" y="54" textAnchor="end" fontSize="10" fontWeight="900" fill="#0f172a">{statusText}</text>
      {nodes.length > 1 && (
        <>
          <path d={routePath} fill="none" stroke="#fed7aa" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
          <path d={routePath} fill="none" stroke="#92400e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {nodes.map((node) => (
        <g key={node.key} data-smoke="citadels-player-state-map-node">
          <circle cx={node.x} cy={node.y} r="29" fill={node.tone.ring} opacity=".35" />
          <circle cx={node.x} cy={node.y} r="23" fill={node.tone.fill} stroke={node.tone.stroke} strokeWidth="5" />
          <text x={node.x} y={node.y - 1} textAnchor="middle" fontSize="9" fontWeight="900" fill={node.tone.text}>
            {node.seatNo ? `${node.seatNo}번` : "대기"}
          </text>
          <text x={node.x} y={node.y + 12} textAnchor="middle" fontSize="8" fontWeight="900" fill={node.tone.text}>
            {node.cityCount}/8
          </text>
          <text x={node.x} y={node.y + 39} textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#0f172a">
            {node.winner ? "승자" : node.active ? "차례" : node.mine ? "나" : node.host ? "방장" : node.ready ? "준비" : "대기"}
          </text>
        </g>
      ))}
      <rect x="86" y="160" width="248" height="12" rx="6" fill="#f8fafc" />
      <text x="210" y="169" textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#0f172a">좌석 → 역할 → 도시 수 → 점수 압력</text>
    </svg>
  );
};

const CitadelsPlayerStateMapPanel = ({
  selectedRoom,
  players,
  citadelsPlayers,
  status,
  phase,
  activeSeatNo,
  winnerSeatNo,
  mySeatNo,
  startBlockedText,
}) => {
  const rows = buildCitadelsPlayerStateRows({ players, selectedRoom, citadelsPlayers, status, activeSeatNo, winnerSeatNo, mySeatNo });
  const safeRows = rows.length
    ? rows
    : [{
      key: "empty-room",
      seatNo: 0,
      name: "입장 대기",
      host: false,
      ready: false,
      active: false,
      winner: false,
      mine: false,
      city: [],
      cityCount: 0,
      cityProgress: cityColorProgress([]),
      districtScore: 0,
      score: 0,
      bonusScore: 0,
      gold: 0,
      handCount: 0,
      character: "-",
      stateLabel: "참가자 대기",
    }];
  const activeRow = safeRows.find((row) => row.active) || null;
  const winnerRow = safeRows.find((row) => row.winner) || null;
  const myRow = safeRows.find((row) => row.mine) || null;
  const readyRows = safeRows.filter((row) => row.ready).length;
  const totalCityCount = safeRows.reduce((sum, row) => sum + row.cityCount, 0);
  const totalGold = safeRows.reduce((sum, row) => sum + row.gold, 0);
  const completedRows = safeRows.filter((row) => row.cityCount >= 8).length;
  const phaseText = phaseLabels[phase] || phase || statusLabels[status] || "대기";
  const tiles = [
    {
      key: "turn",
      icon: winnerRow ? "score" : "turn",
      label: winnerRow ? "승자" : "현재 차례",
      value: winnerRow?.name || activeRow?.name || "시작 대기",
      detail: winnerRow
        ? `점수 ${winnerRow.score}점 · 보너스 ${winnerRow.bonusScore}점`
        : activeRow
          ? `${activeRow.character} · 도시 ${activeRow.cityCount}/8 · 금화 ${activeRow.gold}`
          : startBlockedText || "방장이 시작하면 캐릭터 선택으로 들어갑니다.",
      tone: winnerRow ? "done" : activeRow ? "active" : "neutral",
    },
    {
      key: "mine",
      icon: "player",
      label: "내 좌석",
      value: myRow ? `${myRow.name} · ${myRow.seatNo}번` : "관전 중",
      detail: myRow ? `손패 ${myRow.handCount}장 · 도시 ${myRow.cityCount}/8 · ${myRow.stateLabel}` : "내 좌석이 없으면 전체 도시 진행만 확인합니다.",
      tone: myRow ? "active" : "neutral",
    },
    {
      key: "city",
      icon: "state",
      label: "도시 압력",
      value: `${totalCityCount}/${safeRows.length * 8}구역`,
      detail: completedRows ? `${completedRows}명이 8구역을 완성했습니다.` : `총 금화 ${totalGold}개 · 색상 보너스와 8구역 진입을 같이 봅니다.`,
      tone: completedRows ? "done" : "neutral",
    },
    {
      key: "ready",
      icon: "decision",
      label: "준비 신호",
      value: status === "WAITING" ? `${readyRows}/${safeRows.length}명 준비` : phaseText,
      detail: status === "WAITING" ? (startBlockedText || "시작 조건을 확인하세요.") : "현재 단계와 도시 진행을 같은 지도에서 확인합니다.",
      tone: status === "WAITING" && readyRows === safeRows.length ? "done" : "neutral",
    },
  ];
  const toneClass = {
    active: "border-amber-200 bg-amber-50 text-amber-900",
    done: "border-emerald-200 bg-emerald-50 text-emerald-800",
    neutral: "border-slate-200 bg-white text-slate-700",
  };

  return (
    <section
      className="overflow-hidden rounded-2xl border border-amber-100 bg-white p-3 shadow-lg"
      data-smoke="citadels-player-state-map-panel"
      data-status={status || "UNKNOWN"}
      data-phase={phase || ""}
      data-player-count={safeRows.length}
    >
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="min-h-[210px] rounded-xl border border-amber-100 bg-amber-50/60">
          <CitadelsPlayerStateMapArt rows={safeRows} status={status} />
        </div>
        <div className="flex min-h-[210px] flex-col justify-between gap-3">
          <div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black text-white">
              <GameUxGlyph type="turn" className="h-3.5 w-3.5" />
              {phaseText}
            </div>
            <h3 className="mt-3 text-lg font-black text-slate-950">참가자 도시 지도</h3>
            <p className="mt-2 text-sm font-bold leading-relaxed text-slate-600">
              좌석, 준비, 현재 차례, 도시 수, 금화, 정산 신호를 한 화면에서 확인합니다.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {tiles.map((tile) => (
              <div key={tile.key} className={`min-h-[104px] rounded-xl border p-3 ${toneClass[tile.tone] || toneClass.neutral}`} data-smoke="citadels-player-state-map-item">
                <div className="flex items-center gap-2 text-[11px] font-black">
                  <GameUxGlyph type={tile.icon} className="h-3.5 w-3.5" />
                  {tile.label}
                </div>
                <div className="mt-1 truncate text-sm font-black text-slate-950">{tile.value}</div>
                <div className="mt-1 line-clamp-3 text-xs font-bold leading-relaxed opacity-80">{tile.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {safeRows.slice(0, 8).map((row) => (
          <div key={row.key} className={`min-h-[86px] rounded-xl border px-3 py-2 ${row.active || row.winner ? "border-amber-200 bg-amber-50" : row.mine ? "border-blue-200 bg-blue-50" : "border-slate-100 bg-slate-50"}`}>
            <div className="flex items-center justify-between gap-2 text-xs font-black text-slate-500">
              <span>{row.seatNo ? `${row.seatNo}번 좌석` : "대기 슬롯"}</span>
              <span>{row.stateLabel}</span>
            </div>
            <div className="mt-1 truncate text-sm font-black text-slate-950">{row.name}</div>
            <div className="mt-1 text-[11px] font-bold text-slate-600">
              도시 {row.cityCount}/8 · 금화 {row.gold} · {row.character}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const CitadelsRoomBriefPanel = ({
  selectedRoom,
  status,
  players,
  guestPlayers,
  readyGuestCount,
  canStart,
  startStatusText,
}) => {
  const statusText = statusLabels[status] || status || "대기 중";
  const readinessText = status === "WAITING"
    ? (canStart ? "모든 조건 충족" : startStatusText)
    : `${statusText} · 현재 단계 패널을 확인하세요`;
  const tiles = [
    {
      key: "decision",
      icon: "decision",
      label: "첫 판단",
      value: "비밀 캐릭터 우선순위",
      detail: "수입 색상, 상대 도시, 능력 타이밍을 보고 이번 라운드 캐릭터를 고릅니다.",
    },
    {
      key: "signal",
      icon: "state",
      label: "승리 신호",
      value: "8구역 완성과 색상 보너스",
      detail: "높은 비용 구역, 5색 보너스, 마지막 라운드 진입 여부가 점수 흐름을 바꿉니다.",
    },
    {
      key: "ready",
      icon: "player",
      label: "시작 준비",
      value: `${players.length}/${selectedRoom?.maxPlayers || "-"}명`,
      detail: status === "WAITING" ? `손님 준비 ${readyGuestCount}/${guestPlayers.length}명 · ${readinessText}` : readinessText,
    },
    {
      key: "rule",
      icon: "stage",
      label: "선택 규칙",
      value: selectedRoom?.variantName || "본게임",
      detail: "기본 8캐릭터, 비밀 선택, 8구역 종료 조건으로 진행합니다.",
    },
  ];

  return (
    <section className="rounded-2xl border border-amber-100 bg-amber-50/70 p-3 shadow-sm" data-smoke="tabletop-room-brief-panel">
      <div className="grid gap-2 md:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.key} className="min-h-[96px] rounded-xl border border-white bg-white/85 p-3 shadow-sm" data-smoke="tabletop-room-brief-tile">
            <div className="flex items-center gap-2 text-[11px] font-black text-amber-700">
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

const buildCitadelsSetupPreviewItems = ({ createForm, variants, rooms }) => {
  const selectedVariant = variants.find((variant) => variant.code === createForm.variantCode) || variants[0] || null;
  const title = createForm.title.trim();
  const turnSeconds = Number(createForm.turnTimeSeconds || 30);
  const waitingRoomCount = Array.isArray(rooms)
    ? rooms.filter((room) => !roomStatusOf(room) || roomStatusOf(room) === "WAITING").length
    : 0;
  const minPlayers = Number(selectedVariant?.minPlayers || 2);
  const maxPlayers = Number(selectedVariant?.maxPlayers || 8);

  return [
    {
      key: "title",
      icon: "state",
      shortLabel: "이름",
      label: "궁정 이름",
      value: title || "방 제목 필요",
      detail: title ? "친구가 찾을 이름으로 대기방을 엽니다." : "방 제목을 입력하면 생성 준비가 명확해집니다.",
    },
    {
      key: "rule",
      icon: "decision",
      shortLabel: "규칙",
      label: "선택 규칙",
      value: selectedVariant?.displayName || "규칙 로딩",
      detail: `${minPlayers}~${maxPlayers}명 · 비밀 캐릭터 선택`,
    },
    {
      key: "tempo",
      icon: "turn",
      shortLabel: "시간",
      label: "턴 템포",
      value: `${turnSeconds || 30}초`,
      detail: "수입, 건설, 캐릭터 능력 판단에 적용됩니다.",
    },
    {
      key: "lobby",
      icon: "player",
      shortLabel: "로비",
      label: "입장 흐름",
      value: waitingRoomCount ? `${waitingRoomCount}개 공개 궁정` : "새 궁정 생성",
      detail: "생성 뒤 준비 상태를 맞추고 캐릭터 선택으로 들어갑니다.",
    },
  ];
};

const CitadelsSetupPreviewArt = ({ items }) => {
  const nodes = items.map((item, index) => ({
    ...item,
    x: 48 + index * 92,
    y: index % 2 ? 98 : 62,
    fill: ["#f59e0b", "#dc2626", "#7c3aed", "#0f766e"][index] || "#64748b",
  }));
  const routePath = nodes.map((node, index) => `${index ? "L" : "M"}${node.x} ${node.y}`).join(" ");

  return (
    <svg
      viewBox="0 0 360 154"
      role="img"
      aria-label="시티델 생성 전 궁정 셋업 경로"
      className="h-full min-h-[154px] w-full"
      data-smoke="citadels-setup-preview-art"
    >
      <rect x="10" y="10" width="340" height="134" rx="22" fill="#0f172a" />
      <rect x="24" y="24" width="312" height="104" rx="18" fill="#fff7ed" />
      <path d={routePath} fill="none" stroke="#fed7aa" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      <path d={routePath} fill="none" stroke="#92400e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <text x="34" y="46" fontSize="10" fontWeight="900" fill="#92400e">궁정 셋업</text>
      <text x="326" y="46" textAnchor="end" fontSize="10" fontWeight="900" fill="#0f172a">캐릭터 선택 전</text>
      {nodes.map((node, index) => (
        <g key={node.key} data-smoke="citadels-setup-preview-node">
          <circle cx={node.x} cy={node.y} r="23" fill={node.fill} stroke="#ffffff" strokeWidth="5" />
          <text x={node.x} y={node.y + 5} textAnchor="middle" fontSize="10" fontWeight="900" fill="#ffffff">{index + 1}</text>
          <text x={node.x} y={node.y + 37} textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#0f172a">{node.shortLabel}</text>
        </g>
      ))}
      <rect x="72" y="130" width="216" height="12" rx="6" fill="#f8fafc" opacity=".95" />
      <text x="180" y="139" textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#0f172a">이름 → 규칙 → 턴 템포 → 준비방</text>
    </svg>
  );
};

const CitadelsSetupPreviewPanel = ({ createForm, variants, rooms }) => {
  const selectedVariant = variants.find((variant) => variant.code === createForm.variantCode) || variants[0] || null;
  const items = buildCitadelsSetupPreviewItems({ createForm, variants, rooms });
  const turnSeconds = Number(createForm.turnTimeSeconds || 30);

  return (
    <section
      className="overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm"
      data-smoke="citadels-setup-preview-panel"
      data-variant-code={selectedVariant?.code || createForm.variantCode || "BASE"}
      data-turn-time={turnSeconds || 30}
      data-public-room-count={Array.isArray(rooms) ? rooms.length : 0}
    >
      <div className="grid gap-3 bg-amber-50/70 p-3 lg:grid-cols-[minmax(0,300px)_1fr]">
        <div className="overflow-hidden rounded-xl bg-slate-950">
          <CitadelsSetupPreviewArt items={items} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                <GameUxGlyph type="stage" className="h-4 w-4 text-amber-600" />
                생성 전 궁정 브리핑
              </div>
              <p className="mt-1 text-xs font-bold leading-relaxed text-slate-600">
                방을 만들기 전에 이름, 규칙, 턴 템포, 입장 흐름이 어떤 플레이 경험을 만드는지 확인합니다.
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-amber-700">
              {selectedVariant?.displayName || "본게임"}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <div key={item.key} className="min-h-[88px] rounded-xl border border-white bg-white px-3 py-2 shadow-sm" data-smoke="citadels-setup-preview-item">
                <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-700">
                  <GameUxGlyph type={item.icon} className="h-3.5 w-3.5" />
                  {item.label}
                </div>
                <div className="mt-1 line-clamp-1 text-sm font-black text-slate-950">{item.value}</div>
                <div className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-slate-600">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const citadelsLobbyRoomCardStatusTone = {
  WAITING: { fill: "#fef3c7", stroke: "#d97706", text: "#78350f", label: "대기" },
  PLAYING: { fill: "#dcfce7", stroke: "#16a34a", text: "#14532d", label: "진행" },
  FINISHED: { fill: "#e2e8f0", stroke: "#64748b", text: "#334155", label: "결과" },
};

const CitadelsLobbyRoomCardArt = ({
  status,
  playerCount,
  minPlayers,
  maxPlayers,
  readyGuests,
  joinable,
  full,
  variantName,
  className = "",
}) => {
  const safeMinPlayers = Math.max(1, Number(minPlayers || 1));
  const safeMaxPlayers = Math.max(safeMinPlayers, Number(maxPlayers || playerCount || safeMinPlayers));
  const safePlayerCount = Math.max(0, Math.min(safeMaxPlayers, Number(playerCount || 0)));
  const slotCount = Math.max(1, Math.min(safeMaxPlayers, 8));
  const tone = citadelsLobbyRoomCardStatusTone[status] || citadelsLobbyRoomCardStatusTone.WAITING;
  const statusText = statusLabels[status] || status || "대기";
  const actionText = joinable ? "입장" : full ? "마감" : status === "PLAYING" ? "진행" : "확인";
  const nodes = [
    {
      key: "court",
      label: String(variantName || "궁정").slice(0, 4),
      fill: "#fffbeb",
      stroke: "#d97706",
      text: "#78350f",
      active: true,
    },
    {
      key: "seat",
      label: `${safePlayerCount}/${safeMaxPlayers}`,
      fill: safePlayerCount >= safeMinPlayers ? "#dcfce7" : "#fef3c7",
      stroke: safePlayerCount >= safeMinPlayers ? "#16a34a" : "#d97706",
      text: safePlayerCount >= safeMinPlayers ? "#14532d" : "#78350f",
      active: safePlayerCount >= safeMinPlayers,
    },
    {
      key: "ready",
      label: readyGuests ? "준비" : "대기",
      fill: readyGuests ? "#dbeafe" : "#f1f5f9",
      stroke: readyGuests ? "#2563eb" : "#64748b",
      text: readyGuests ? "#1e3a8a" : "#334155",
      active: readyGuests,
    },
    {
      key: "enter",
      label: actionText,
      fill: joinable ? "#ede9fe" : "#f8fafc",
      stroke: joinable ? "#7c3aed" : "#94a3b8",
      text: joinable ? "#4c1d95" : "#475569",
      active: joinable,
    },
  ];

  return (
    <svg
      viewBox="0 0 220 150"
      className={className}
      role="img"
      aria-label={`시티델 방 카드 상태 ${statusText}, ${safePlayerCount}/${safeMaxPlayers}명`}
      focusable="false"
      data-smoke="tabletop-lobby-room-card-art"
      data-room-status={status || ""}
      data-joinable={joinable ? "true" : "false"}
    >
      <rect x="4" y="4" width="212" height="142" rx="22" fill="#fffbeb" stroke="#fcd34d" strokeWidth="2" />
      <path d="M20 108c26-22 55-26 86-8 33 20 62 12 86-28 10-17 17-20 26-15v45c-58 26-120 28-198 6Z" fill="#f59e0b" opacity="0.16" />
      <path d="M32 98H188" stroke="#92400e" strokeWidth="4" strokeLinecap="round" opacity="0.42" />
      <g transform="translate(110 72)" opacity="0.13">
        <path d="M-34 34h68l-8-48-16 15-10-26-10 26-16-15Z" fill="#92400e" />
      </g>
      <rect x="16" y="16" width="76" height="26" rx="13" fill="#ffffff" stroke={tone.stroke} strokeWidth="2" />
      <text x="54" y="33" textAnchor="middle" fontSize="11" fontWeight="900" fill={tone.text}>{tone.label}</text>
      <rect x="112" y="16" width="88" height="26" rx="13" fill={joinable ? "#dcfce7" : tone.fill} stroke={joinable ? "#16a34a" : tone.stroke} strokeWidth="2" />
      <text x="156" y="33" textAnchor="middle" fontSize="11" fontWeight="900" fill={joinable ? "#14532d" : tone.text}>{actionText}</text>
      <g transform="translate(22 58)">
        {nodes.map((node, index) => {
          const x = index * 54;
          return (
            <g key={node.key} transform={`translate(${x} 0)`} data-smoke="tabletop-lobby-room-card-node" data-room-card-key={node.key}>
              {index > 0 && <path d="M-36 17H-19" stroke={node.active ? node.stroke : "#94a3b8"} strokeWidth="4" strokeLinecap="round" opacity={node.active ? 0.86 : 0.34} />}
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
            fill={index < safePlayerCount ? "#d97706" : "#fde68a"}
            opacity={index < safePlayerCount ? 0.95 : 0.7}
            data-smoke="tabletop-lobby-room-card-seat"
          />
        ))}
      </g>
    </svg>
  );
};

const citadelsLobbyRoomDecisionToneClasses = {
  access: "border-emerald-100 bg-emerald-50 text-emerald-800",
  seat: "border-sky-100 bg-sky-50 text-sky-800",
  ready: "border-amber-100 bg-amber-50 text-amber-800",
  rule: "border-violet-100 bg-violet-50 text-violet-800",
  neutral: "border-slate-100 bg-slate-50 text-slate-700",
};

const buildCitadelsLobbyRoomDecisionItems = ({
  room,
  status,
  roomPlayers,
  minPlayers,
  maxPlayers,
  full,
  joinable,
  readinessText,
  actionText,
  actionDetail,
}) => {
  const safePlayers = Array.isArray(roomPlayers) ? roomPlayers : [];
  const safeMinPlayers = Math.max(1, Number(minPlayers || 1));
  const safeMaxPlayers = Math.max(safeMinPlayers, Number(maxPlayers || safePlayers.length || safeMinPlayers));
  const openSeats = Math.max(0, safeMaxPlayers - safePlayers.length);
  const statusText = statusLabels[status] || status || "대기 중";
  const roomCode = roomCodeOf(room) || "-";
  const variantName = get(room, "variant_name", "variantName", "본게임");
  const accessValue = joinable
    ? "바로 입장"
    : status === "PLAYING"
      ? "진행 중"
      : full
        ? "정원 마감"
        : status === "FINISHED"
          ? "결과 확인"
          : "상태 확인";

  return [
    {
      key: "access",
      icon: joinable ? "turn" : "decision",
      label: "입장 판단",
      value: accessValue,
      detail: joinable ? actionDetail : `${statusText} · 방 코드 ${roomCode}`,
      tone: joinable ? "access" : "neutral",
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
      icon: status === "WAITING" && safePlayers.length >= safeMinPlayers ? "win" : "state",
      label: "준비",
      value: actionText || "준비 확인",
      detail: readinessText || "참가자 준비도와 시작 조건을 확인합니다.",
      tone: status === "WAITING" && safePlayers.length >= safeMinPlayers ? "access" : "ready",
    },
    {
      key: "rule",
      icon: "stage",
      label: "규칙",
      value: variantName,
      detail: "캐릭터 선택, 금화, 구역 건설 흐름으로 진행됩니다.",
      tone: "rule",
    },
  ];
};

const CitadelsLobbyRoomDecisionRail = ({ items = [] }) => {
  const visibleItems = Array.isArray(items) ? items.filter(Boolean).slice(0, 4) : [];
  if (!visibleItems.length) return null;

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4" data-smoke="tabletop-lobby-room-decision-rail">
      {visibleItems.map((item) => {
        const tone = citadelsLobbyRoomDecisionToneClasses[item.tone] || citadelsLobbyRoomDecisionToneClasses.neutral;
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

const CitadelsLobbyRoomCard = ({ room, busy, onJoin }) => {
  const roomPlayers = asArray(room?.players);
  const maxPlayers = Number(get(room, "max_players", "maxPlayers", 0));
  const minPlayers = Number(get(room, "min_players", "minPlayers", 0));
  const hostMemberId = Number(get(room, "host_member_id", "hostMemberId", 0));
  const status = roomStatusOf(room);
  const statusText = statusLabels[status] || status || "대기";
  const guestPlayers = roomPlayers.filter((player) => memberIdOf(player) !== hostMemberId);
  const readyGuestCount = guestPlayers.filter(isReady).length;
  const readyGuests = guestPlayers.length === 0 || readyGuestCount === guestPlayers.length;
  const enoughPlayers = roomPlayers.length >= minPlayers;
  const full = maxPlayers > 0 && roomPlayers.length >= maxPlayers;
  const joinable = status === "WAITING" && !full;
  const roomCode = roomCodeOf(room);
  const readinessText = status === "WAITING"
    ? readyGuests && enoughPlayers
      ? "시작 조건 충족"
      : `준비 ${readyGuestCount}/${guestPlayers.length}명 · 최소 ${minPlayers}명`
    : `${statusText} · 입장 후 현재 상태를 확인하세요`;
  const actionText = joinable
    ? "입장 가능"
    : full
      ? "정원 마감"
      : status === "PLAYING"
        ? "진행 중"
        : "결과 확인";
  const actionDetail = joinable
    ? "비밀 캐릭터 선택 전 방 상태와 참가자 준비도를 확인하고 입장합니다."
    : full
      ? "좌석이 모두 찼습니다. 새 방을 만들거나 다른 방을 선택하세요."
      : status === "PLAYING"
        ? "이미 시작된 방입니다. 참여 중인 방이면 자동 복귀 목록에서 열립니다."
        : "끝난 방은 다시하기 전까지 새 참가가 닫힙니다.";
  return (
    <article
      className="rounded-2xl border border-slate-100 bg-slate-50 p-3 shadow-sm"
      data-smoke="tabletop-lobby-room-card"
      data-room-status={status || ""}
      data-joinable={joinable ? "true" : "false"}
      data-member-count={roomPlayers.length}
      data-max-players={maxPlayers || ""}
    >
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)] md:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                <GameUxGlyph type="stage" className="h-4 w-4 text-amber-600" />
                <span className="min-w-0 truncate">{room.title}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-black text-slate-500">
                <span className="rounded-full bg-white px-2 py-1">코드 {roomCode}</span>
                <span className="rounded-full bg-white px-2 py-1">{statusText}</span>
                <span className="rounded-full bg-white px-2 py-1">{get(room, "variant_name", "variantName", "본게임")}</span>
                <span className="rounded-full bg-white px-2 py-1">{roomPlayers.length}/{maxPlayers || "-"}명</span>
              </div>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-black ${joinable ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
              {actionText}
            </span>
          </div>

          <button
            type="button"
            disabled={busy || !joinable}
            onClick={() => onJoin(roomIdOf(room))}
            className="mt-3 min-h-10 w-full rounded-xl bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
            data-smoke="tabletop-lobby-room-primary"
          >
            {joinable ? "입장하기" : actionText}
          </button>
        </div>
      </div>
    </article>
  );
};

const CitadelsLobbyEmptyArt = ({ className = "" }) => {
  const nodes = [
    { key: "create", x: 48, y: 99, label: "생성", fill: "#f59e0b" },
    { key: "code", x: 112, y: 34, label: "코드", fill: "#7c3aed" },
    { key: "refresh", x: 178, y: 99, label: "새로고침", fill: "#0ea5e9" },
  ];

  return (
    <svg
      viewBox="0 0 230 136"
      role="img"
      aria-label="시티델 빈 로비 다음 행동 안내"
      className={className}
      data-smoke="citadels-lobby-empty-art"
    >
      <rect x="1" y="1" width="228" height="134" rx="22" fill="#fffbeb" stroke="#fde68a" strokeWidth="2" />
      <path d="M28 111C44 74 76 54 114 54C153 54 190 75 204 111" fill="#ffffff" stroke="#d97706" strokeWidth="2" />
      <path d="M72 103V66l18-15 17 15v37" fill="#fde68a" stroke="#92400e" strokeWidth="2" />
      <path d="M107 103V51l20-18 20 18v52" fill="#fbbf24" stroke="#92400e" strokeWidth="2" />
      <path d="M147 103V68l16-14 16 14v35" fill="#fde68a" stroke="#92400e" strokeWidth="2" />
      <path d="M92 65h34M114 39v20M132 65h34" stroke="#92400e" strokeWidth="2" strokeLinecap="round" />
      <path d="M112 25h26l-13-17z" fill="#facc15" stroke="#92400e" strokeWidth="2" />
      <rect x="96" y="83" width="28" height="20" rx="5" fill="#111827" />
      <rect x="132" y="83" width="18" height="20" rx="5" fill="#111827" />
      <text x="118" y="121" textAnchor="middle" fill="#92400e" fontSize="11" fontWeight="900">방 없음</text>
      {[61, 86, 114, 142, 166].map((cx, index) => (
        <g key={cx} data-smoke="citadels-lobby-empty-node">
          <circle cx={cx} cy={index % 2 ? 112 : 108} r="8" fill="#f59e0b" />
          <circle cx={cx} cy={index % 2 ? 112 : 108} r="3" fill="#fff7ed" />
        </g>
      ))}
      {nodes.map((node) => (
        <g key={node.key} data-smoke="citadels-lobby-empty-node" data-empty-key={node.key}>
          <circle cx={node.x} cy={node.y} r="16" fill={node.fill} />
          <text x={node.x} y={node.y + 4} textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="900">{node.label}</text>
        </g>
      ))}
    </svg>
  );
};

const CitadelsLobbyEmptyState = ({ busy, onRefresh }) => {
  const items = busy
    ? [
        { key: "loading", label: "목록 확인", value: "궁정 조회 중", detail: "공개 시티델 방 목록을 불러오고 있습니다." },
        { key: "create", label: "새 방 만들기", value: "설정 유지", detail: "왼쪽 생성 설정은 그대로 준비되어 있습니다." },
        { key: "code", label: "방코드 입장", value: "초대 코드 대기", detail: "코드를 받았다면 바로 입력할 수 있습니다." },
      ]
    : [
        { key: "create", label: "새 방 만들기", value: "첫 궁정 열기", detail: "규칙과 턴 시간을 확인한 뒤 캐릭터 선택 흐름을 직접 엽니다." },
        { key: "code", label: "방코드 입장", value: "초대 합류", detail: "방장이 공유한 코드를 위 입력칸에 넣으면 같은 궁정으로 이어집니다." },
        { key: "refresh", label: "새로고침", value: "목록 다시 확인", detail: "방금 열린 시티델 대기방이 있는지 다시 조회합니다." },
      ];

  return (
    <div
      className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-violet-50 p-4"
      data-smoke="citadels-lobby-empty-state"
      data-busy={busy ? "true" : "false"}
      role={busy ? "status" : undefined}
      aria-live={busy ? "polite" : undefined}
    >
      <div className="grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)] lg:items-center">
        <CitadelsLobbyEmptyArt className="h-32 w-full" />
        <div className="min-w-0">
          <div className="text-sm font-black text-slate-900">{busy ? "시티델 대기방을 불러오는 중입니다." : "대기방 없음"}</div>
          <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
            {busy ? "목록이 도착하면 바로 입장 가능한 궁정과 캐릭터 선택 준비도를 보여줍니다." : "지금은 공개 시티델 궁정이 없습니다. 새 방을 만들거나 초대 코드로 합류하고, 목록을 다시 확인하세요."}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {items.map((item) => (
              <div key={item.key} className="rounded-xl border border-white/80 bg-white/85 px-3 py-2" data-smoke="citadels-lobby-empty-item" data-empty-key={item.key}>
                <div className="text-[11px] font-black text-amber-700">{item.label}</div>
                <div className="mt-1 text-xs font-black text-slate-900">{item.value}</div>
                <div className="mt-1 text-[11px] font-bold leading-relaxed text-slate-500">{item.detail}</div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-xl bg-slate-900 px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onRefresh}
            disabled={busy}
            data-smoke="citadels-lobby-empty-refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            목록 새로고침
          </button>
        </div>
      </div>
    </div>
  );
};

const buildCitadelsLobbyDirectorPlan = ({ rooms = [], myMemberId = 0 }) => {
  const safeRooms = Array.isArray(rooms) ? rooms : [];
  const waitingRooms = safeRooms.filter((room) => !roomStatusOf(room) || roomStatusOf(room) === "WAITING");
  const myRooms = safeRooms.filter((room) => asArray(room?.players).some((player) => memberIdOf(player) === myMemberId));
  const joinableRooms = waitingRooms.filter((room) => {
    const maxPlayers = Number(get(room, "max_players", "maxPlayers", 0));
    return maxPlayers <= 0 || asArray(room?.players).length < maxPlayers;
  });
  const readyJoinableRooms = joinableRooms.filter((room) => {
    const players = asArray(room?.players);
    const minPlayers = Number(get(room, "min_players", "minPlayers", 0)) || 1;
    return players.length >= minPlayers;
  });
  const readinessScore = (room) => {
    const players = asArray(room?.players);
    const maxPlayers = Math.max(1, Number(get(room, "max_players", "maxPlayers", 0)) || players.length || 1);
    const minPlayers = Math.max(1, Number(get(room, "min_players", "minPlayers", 0)) || 1);
    const hostMemberId = Number(get(room, "host_member_id", "hostMemberId", 0));
    const guests = players.filter((player) => memberIdOf(player) !== hostMemberId);
    const readyGuests = guests.filter(isReady).length;
    const fillRatio = Math.min(1, players.length / maxPlayers);
    const startRatio = Math.min(1, players.length / minPlayers);
    const readyRatio = guests.length ? readyGuests / guests.length : 1;
    return Math.round((fillRatio * 30) + (startRatio * 35) + (readyRatio * 35));
  };
  const candidates = safeRooms
    .map((room, index) => {
      const players = asArray(room?.players);
      const status = roomStatusOf(room) || "WAITING";
      const maxPlayers = Number(get(room, "max_players", "maxPlayers", 0));
      const minPlayers = Number(get(room, "min_players", "minPlayers", 0)) || 1;
      const alreadyInRoom = players.some((player) => memberIdOf(player) === myMemberId);
      const full = maxPlayers > 0 && players.length >= maxPlayers;
      const joinable = status === "WAITING" && !full;
      const readyToStart = status === "WAITING" && players.length >= minPlayers;
      const action = alreadyInRoom ? "open" : joinable ? "join" : "wait";
      const score = readinessScore(room);
      const priority = [
        alreadyInRoom ? 420 : 0,
        joinable ? 220 : 0,
        readyToStart ? 90 : 0,
        score,
        players.length,
      ].reduce((sum, value) => sum + value, 0);
      return {
        key: String(roomIdOf(room) || roomCodeOf(room) || `${room.title || "citadels"}-${index}`),
        room,
        roomId: roomIdOf(room),
        title: room.title || roomCodeOf(room) || "시티델 방",
        variantName: get(room, "variant_name", "variantName", "본게임"),
        status,
        playerCount: players.length,
        minPlayers,
        maxPlayers,
        alreadyInRoom,
        joinable,
        readyToStart,
        action,
        score,
        priority,
        reason: alreadyInRoom
          ? "이미 앉아 있는 궁정 방이라 캐릭터 선택 흐름으로 바로 돌아갈 수 있습니다."
          : joinable
            ? readyToStart
              ? "최소 인원이 맞아 입장 후 준비만 맞추면 왕관 순서로 넘어갈 수 있습니다."
              : "합류하면 비밀 캐릭터 선택을 시작할 인원 조건에 가까워집니다."
            : status === "PLAYING"
              ? "이미 진행 중인 방이라 새 궁정이나 다른 대기방을 보는 편이 좋습니다."
              : "종료되었거나 좌석이 닫힌 방입니다.",
      };
    })
    .sort((a, b) => b.priority - a.priority);
  const recommended = candidates.find((candidate) => candidate.action === "open" || candidate.action === "join") || null;
  const choices = candidates.filter((candidate) => candidate.action === "open" || candidate.action === "join").slice(0, 3);
  const items = [
    {
      key: "court",
      icon: "stage",
      label: "궁정 후보",
      value: joinableRooms.length ? `${joinableRooms.length}개` : "없음",
      detail: joinableRooms.length ? "지금 입장 가능한 시티델 대기방이 있습니다." : "새 궁정을 열면 첫 캐릭터 선택 흐름을 만들 수 있습니다.",
      progress: safeRooms.length ? Math.round((joinableRooms.length / safeRooms.length) * 100) : 0,
    },
    {
      key: "resume",
      icon: "signal",
      label: "이어가기",
      value: myRooms.length ? `${myRooms.length}개` : "없음",
      detail: myRooms.length ? "참여 중인 방을 다시 열어 준비/진행 상태를 확인할 수 있습니다." : "아직 앉은 궁정 방이 없어 새 후보를 고르면 됩니다.",
      progress: myRooms.length ? 100 : 20,
    },
    {
      key: "ready",
      icon: "player",
      label: "시작 임박",
      value: readyJoinableRooms.length ? `${readyJoinableRooms.length}개` : "대기",
      detail: readyJoinableRooms.length ? "최소 인원이 맞은 방이 있어 방장 시작까지 가깝습니다." : "캐릭터 선택 전 인원이 더 모이는 중입니다.",
      progress: joinableRooms.length ? Math.round((readyJoinableRooms.length / joinableRooms.length) * 100) : 0,
    },
    {
      key: "decision",
      icon: "decision",
      label: "추천 판단",
      value: recommended ? recommended.title : "방 만들기",
      detail: recommended ? `${recommended.variantName} 기준으로 가장 빠른 궁정 진입 후보입니다.` : "직접 방을 만들면 초대 코드와 시작 조건을 바로 통제할 수 있습니다.",
      progress: recommended ? recommended.score : 25,
    },
  ];
  return { items, choices, recommended, roomCount: safeRooms.length };
};

const CitadelsLobbyDirectorArt = ({ plan, className = "" }) => {
  const nodes = plan.items.map((item, index) => ({
    ...item,
    x: 54 + (index * 84),
    y: index % 2 === 0 ? 48 : 78,
  }));

  return (
    <svg
      viewBox="0 0 360 136"
      role="img"
      aria-label="시티델 로비 궁정 선택 디렉터"
      className={className}
      data-smoke="citadels-lobby-director-art"
    >
      <rect width="360" height="136" rx="20" fill="#111827" />
      <rect x="18" y="18" width="324" height="100" rx="18" fill="#1f2937" stroke="#78350f" />
      <path d="M34 92 L72 54 L108 82 L152 42 L194 82 L244 48 L324 92" fill="none" stroke="#f59e0b" strokeWidth="2" opacity="0.55" />
      <path d="M44 96 H316" fill="none" stroke="#475569" strokeWidth="7" strokeLinecap="round" />
      <path d="M44 96 H316" fill="none" stroke={plan.recommended ? "#fbbf24" : "#64748b"} strokeWidth="3" strokeLinecap="round" />
      {nodes.map((node, index) => {
        const active = node.key === "decision";
        return (
          <g key={node.key} data-smoke="citadels-lobby-director-node">
            <circle cx={node.x} cy={node.y} r={active ? 19 : 16} fill={active ? "#facc15" : "#374151"} stroke={active ? "#fff7ed" : "#64748b"} strokeWidth="2" />
            <text x={node.x} y={node.y + 4} textAnchor="middle" fill={active ? "#422006" : "#fff7ed"} fontSize="11" fontWeight="900">{index + 1}</text>
            <text x={node.x} y="122" textAnchor="middle" fill="#fde68a" fontSize="10" fontWeight="800">{node.label}</text>
          </g>
        );
      })}
      <rect x="38" y="24" width="116" height="18" rx="9" fill="#111827" stroke="#92400e" />
      <text x="96" y="37" textAnchor="middle" fill="#fde68a" fontSize="10" fontWeight="900">궁정 선택 루트</text>
      <path d="M302 34 h28 l-14 -18 z" fill={plan.recommended ? "#facc15" : "#475569"} />
      <rect x="310" y="34" width="12" height="18" rx="3" fill={plan.recommended ? "#92400e" : "#64748b"} />
    </svg>
  );
};

const CitadelsLobbyDirectorEmptyArt = ({ className = "" }) => {
  const nodes = [
    { key: "create", x: 76, y: 92, label: "생성", fill: "#facc15" },
    { key: "code", x: 180, y: 52, label: "코드", fill: "#a78bfa" },
    { key: "refresh", x: 284, y: 92, label: "갱신", fill: "#34d399" },
  ];

  return (
    <svg
      viewBox="0 0 360 136"
      role="img"
      aria-label="시티델 로비에 바로 들어갈 궁정 방이 없을 때 다음 행동을 안내합니다."
      className={className}
      data-smoke="citadels-lobby-director-empty-art"
    >
      <rect width="360" height="136" rx="20" fill="#111827" />
      <rect x="18" y="18" width="324" height="100" rx="18" fill="#1f2937" stroke="#92400e" />
      <path d="M76 92 C116 36, 244 36, 284 92" fill="none" stroke="#78350f" strokeWidth="8" strokeLinecap="round" />
      <path d="M76 92 C116 36, 244 36, 284 92" fill="none" stroke="#facc15" strokeWidth="3" strokeLinecap="round" />
      <rect x="116" y="18" width="128" height="26" rx="13" fill="#111827" stroke="#92400e" />
      <text x="180" y="35" textAnchor="middle" fill="#fde68a" fontSize="11" fontWeight="900">궁정 후보 없음</text>
      <path d="M156 94 h48 l-24 -34 z" fill="#facc15" />
      <rect x="172" y="94" width="16" height="20" rx="4" fill="#92400e" />
      {nodes.map((node) => (
        <g key={node.key} data-smoke="citadels-lobby-director-empty-node" data-empty-key={node.key}>
          <circle cx={node.x} cy={node.y} r="20" fill={node.fill} />
          <circle cx={node.x} cy={node.y} r="9" fill="#111827" opacity="0.72" />
          <text x={node.x} y={node.y + 34} textAnchor="middle" fill="#fde68a" fontSize="10" fontWeight="900">{node.label}</text>
        </g>
      ))}
    </svg>
  );
};

const CitadelsLobbyDirectorEmptyChoice = () => {
  const items = [
    {
      key: "create",
      icon: "stage",
      label: "새 방 만들기",
      value: "새 궁정 열기",
      detail: "직접 궁정을 열면 선택 규칙, 턴 시간, 초대 흐름을 바로 통제할 수 있습니다.",
    },
    {
      key: "code",
      icon: "input",
      label: "방코드 입장",
      value: "초대 합류",
      detail: "초대받은 궁정 코드는 위 코드 입력 영역에서 기존 합류 흐름 그대로 사용하세요.",
    },
    {
      key: "refresh",
      icon: "signal",
      label: "목록 새로고침",
      value: "후보 재확인",
      detail: "대기 궁정이 생기면 같은 디렉터 영역에 입장 후보와 시작 임박 신호가 표시됩니다.",
    },
  ];

  return (
    <div
      className="rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-3"
      data-smoke="citadels-lobby-director-choice"
      data-empty-game="citadels"
    >
      <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center" data-smoke="citadels-lobby-director-empty-choice">
        <CitadelsLobbyDirectorEmptyArt className="h-32 w-full" />
        <div className="min-w-0">
          <div className="text-sm font-black text-slate-950">추천할 궁정 방이 없습니다</div>
          <p className="mt-1 text-xs font-bold leading-relaxed text-slate-600">
            바로 앉을 궁정 후보가 비어 있어도 캐릭터 선택 흐름은 만들 수 있습니다. 새 궁정을 열거나 초대 코드로 합류하고, 목록을 다시 확인하세요.
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {items.map((item) => (
              <div key={item.key} className="rounded-lg border border-white/80 bg-white px-3 py-2" data-smoke="citadels-lobby-director-empty-item" data-empty-key={item.key}>
                <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-700">
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

const CitadelsLobbyDirectorPanel = ({ rooms, myMemberId, busy, onOpenRoom, onJoinRoom }) => {
  const plan = buildCitadelsLobbyDirectorPlan({ rooms, myMemberId });

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" data-smoke="citadels-lobby-director-panel">
      <div className="grid gap-3 p-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        <CitadelsLobbyDirectorArt plan={plan} className="h-36 w-full" />
        <div className="min-w-0 space-y-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-black text-slate-900">시티델 궁정 디렉터</div>
              <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700">{plan.roomCount}개 궁정 분석</span>
            </div>
            <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
              현재 방 목록만 보고 캐릭터 선택으로 가장 빨리 이어질 궁정 방을 정리합니다.
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {plan.items.map((item) => (
              <div key={item.key} className="min-h-[98px] rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2" data-smoke="citadels-lobby-director-item">
                <div className="flex items-center gap-2 text-[11px] font-black text-amber-700">
                  <GameUxGlyph type={item.icon} className="h-3.5 w-3.5" />
                  {item.label}
                </div>
                <div className="mt-1 truncate text-sm font-black text-slate-950">{item.value}</div>
                <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-relaxed text-slate-600">{item.detail}</div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                  <span className="block h-full rounded-full bg-amber-500" style={{ width: `${Math.max(6, Math.min(100, item.progress))}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {plan.choices.length ? plan.choices.map((choice) => (
              <div key={choice.key} className="grid gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2 sm:grid-cols-[minmax(0,1fr)_108px] sm:items-center" data-smoke="citadels-lobby-director-choice">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-slate-900">{choice.title}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-black text-slate-500">
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">{choice.variantName}</span>
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
                  data-smoke="citadels-lobby-director-primary"
                >
                  {choice.action === "open" ? "열기" : "입장"}
                </button>
              </div>
            )) : (
              <CitadelsLobbyDirectorEmptyChoice />
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

const CitadelsJoinCodeArt = ({ joinCode, className = "" }) => {
  const codeText = String(joinCode || "").trim().toUpperCase();
  const visibleCode = codeText ? codeText.slice(0, 8) : "방코드";
  const nodes = [
    { key: "gate", label: "코드", x: 58 },
    { key: "court", label: "궁정", x: 180 },
    { key: "seat", label: "좌석", x: 302 },
  ];

  return (
    <svg
      viewBox="0 0 360 128"
      role="img"
      aria-label="시티델 방 코드 입장 흐름"
      className={className}
      data-smoke="citadels-join-code-art"
    >
      <rect width="360" height="128" rx="20" fill="#111827" />
      <path d="M34 82 L86 44 L130 72 L178 36 L226 72 L278 44 L326 82" fill="none" stroke="#f59e0b" strokeWidth="2" opacity="0.45" />
      <rect x="28" y="18" width="304" height="48" rx="16" fill="#1f2937" stroke="#78350f" />
      <text x="42" y="38" fill="#fde68a" fontSize="11" fontWeight="800">궁정 초대 코드</text>
      <text x="42" y="58" fill="#fff7ed" fontSize="19" fontWeight="900">{visibleCode}</text>
      <path d="M72 94 H286" fill="none" stroke="#475569" strokeWidth="8" strokeLinecap="round" />
      <path d="M72 94 H286" fill="none" stroke={codeText ? "#fbbf24" : "#94a3b8"} strokeWidth="3" strokeLinecap="round" />
      {nodes.map((node, index) => (
        <g key={node.key} data-smoke="citadels-join-code-node">
          <circle cx={node.x} cy="94" r="18" fill={codeText ? "#92400e" : "#374151"} stroke={codeText ? "#fef3c7" : "#64748b"} strokeWidth="2" />
          <text x={node.x} y="98" textAnchor="middle" fill="#fff7ed" fontSize="11" fontWeight="900">{index + 1}</text>
          <text x={node.x} y="122" textAnchor="middle" fill="#fde68a" fontSize="10" fontWeight="800">{node.label}</text>
        </g>
      ))}
      <path d="M306 35 h28 l-14 -18 z" fill={codeText ? "#facc15" : "#334155"} />
      <rect x="314" y="35" width="12" height="18" rx="3" fill={codeText ? "#92400e" : "#475569"} />
    </svg>
  );
};

const CitadelsJoinCodePanel = ({ joinCode, setJoinCode, busy, joinByCode }) => {
  const hasCode = String(joinCode || "").trim().length > 0;

  return (
    <form
      onSubmit={joinByCode}
      aria-label="시티델 방 코드 입장"
      className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      data-smoke="citadels-join-code-panel"
    >
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-black text-slate-900">
          <GameUxGlyph type="signal" className="h-4 w-4 text-amber-600" />
          방 코드 입장
        </div>
        <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
          초대 코드를 입력하면 같은 궁정 대기방과 캐릭터 선택 흐름으로 이어집니다.
        </div>
      </div>
      <div className="space-y-3 p-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <input
            aria-label="방 코드"
            className="min-h-11 min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase"
            placeholder="방코드"
            value={joinCode}
            maxLength={8}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            data-smoke="citadels-join-code-input"
          />
          <button
            type="submit"
            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
            disabled={busy}
            data-smoke="citadels-join-code-submit"
          >
            입장
          </button>
        </div>
        <div className={`rounded-xl px-3 py-2 text-[11px] font-bold leading-relaxed ${hasCode ? "bg-amber-50 text-amber-800" : "bg-slate-50 text-slate-500"}`} data-smoke="citadels-join-code-status">
          {hasCode ? "입력한 코드로 시티델 방을 찾을 준비가 됐습니다." : "방장이 공유한 코드를 입력하면 공개방을 찾지 않아도 됩니다."}
        </div>
      </div>
    </form>
  );
};

const CitadelsCharacterSigil = ({ code, className = "" }) => {
  const rank = characterRankByCode[code] || 0;
  const pathByCode = {
    ASSASSIN: <path d="M34 14 20 42m4-3 14 12m-6-36 11 7" />,
    THIEF: <path d="M18 29c7-12 25-12 32 0m-35 9c13 8 25 8 38 0M26 25h12" />,
    MAGICIAN: <path d="M28 15v38m-13-20h38m-10-13L20 43m0-23 23 23" />,
    KING: <path d="M15 45h38l-5-24-11 10-8-15-8 15-11-10 5 24Z" />,
    BISHOP: <path d="M29 13v38m-12-25h24m-19 25h14m-8-38c8 7 13 13 13 20 0 9-8 15-13 18-5-3-13-9-13-18 0-7 5-13 13-20Z" />,
    MERCHANT: <path d="M17 41h35M21 32h27M25 21h19m-7-8 9 9-9 9m-10 0-9-9 9-9" />,
    ARCHITECT: <path d="M17 48V27l15-13 15 13v21M24 48V34h14v14M17 27h30" />,
    WARLORD: <path d="M17 49 49 17m-7-4 7 7-12 5m-20 0 24 24m-4-9 9-2" />,
  };

  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false" data-smoke="citadels-character-sigil">
      <circle cx="32" cy="32" r="29" fill="#fff7ed" stroke="#92400e" strokeWidth="4" />
      <circle cx="32" cy="32" r="20" fill="#fed7aa" opacity=".65" />
      <g fill="none" stroke="#7c2d12" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        {pathByCode[code] || <path d="M18 45h28M22 45V24l10-9 10 9v21" />}
      </g>
      {rank > 0 && <circle cx="49" cy="15" r="7" fill="#0f172a" />}
      {rank > 0 && <path d="M49 10v10" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".9" />}
    </svg>
  );
};

const CitadelsDistrictArt = ({ color, cost = 0, compact = false, className = "" }) => {
  const tone = citadelsDistrictArtTones[color] || citadelsDistrictArtTones.DEFAULT;
  const pips = Math.max(0, Math.min(5, Number(cost) || 0));
  return (
    <svg viewBox="0 0 112 78" className={className} aria-hidden="true" focusable="false" data-smoke="citadels-district-card-art">
      <rect x="3" y="3" width="106" height="72" rx="14" fill={tone.sky} stroke={tone.roof} strokeWidth="4" />
      <path d="M16 58h80" stroke={tone.roof} strokeWidth="5" strokeLinecap="round" opacity=".35" />
      <path d="M23 58V36l13-11 13 11v22" fill={tone.wall} stroke={tone.roof} strokeWidth="4" strokeLinejoin="round" />
      <path d="M54 58V29l15-13 15 13v29" fill={tone.wall} stroke={tone.roof} strokeWidth="4" strokeLinejoin="round" />
      <path d="M19 36h34M50 29h38" stroke={tone.roof} strokeWidth="4" strokeLinecap="round" />
      <rect x="30" y="45" width="9" height="13" rx="2" fill="#fff7ed" opacity=".85" />
      <rect x="65" y="40" width="11" height="18" rx="2" fill="#fff7ed" opacity=".85" />
      <path d="M87 18v18m0-16 13 4-13 5" fill="none" stroke={tone.mark} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <g transform={compact ? "translate(18 66)" : "translate(16 66)"}>
        {Array.from({ length: pips }).map((_, index) => (
          <circle key={index} cx={index * 8} cy="0" r="3" fill={tone.roof} opacity=".85" />
        ))}
      </g>
    </svg>
  );
};

const CitadelsCard = ({ card, selected = false, onClick, actionLabel = "" }) => {
  const color = cardColorOf(card);
  const clickable = typeof onClick === "function";
  const className = [
    "min-h-[132px] rounded-2xl border p-3 text-left shadow-sm transition",
    colorClasses[color] || "border-slate-200 bg-slate-50 text-slate-700",
    selected ? "ring-4 ring-slate-900/10" : "",
    clickable ? "hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200" : "",
  ].join(" ");
  const content = (
    <>
      <div className="flex items-start gap-3">
        <CitadelsDistrictArt color={color} cost={cardCostOf(card)} className="h-16 w-24 shrink-0" />
        <div className="min-w-0">
          <div className="break-words text-sm font-black text-slate-900">{cardNameOf(card)}</div>
          <div className="mt-1 text-[11px] font-black text-slate-500">{colorLabels[color] || color}</div>
          {!!actionLabel && <div className="mt-2 text-[11px] font-black text-slate-500">{actionLabel}</div>}
        </div>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-slate-700 shadow-sm">
          {cardCostOf(card)}
        </span>
      </div>
    </>
  );

  return clickable ? (
    <button type="button" className={className} onClick={onClick} data-smoke="citadels-district-card">
      {content}
    </button>
  ) : (
    <div className={className} data-smoke="citadels-district-card">{content}</div>
  );
};

const CharacterButton = ({ code, disabled, onClick, mode = "선택" }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="min-h-[112px] rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-45"
    data-smoke="citadels-character-button"
  >
    <div className="flex items-start gap-3">
      <CitadelsCharacterSigil code={code} className="h-12 w-12 shrink-0" />
      <div className="min-w-0">
        <div className="text-sm font-black text-slate-900">{characterName(code)}</div>
        <div className="mt-1 text-xs font-bold text-slate-500">#{characterRankByCode[code] || "-"} · {mode}</div>
        <div className="mt-2 hidden text-[11px] font-bold leading-relaxed text-slate-500 sm:block">{characterHelp[code]}</div>
      </div>
    </div>
  </button>
);

export const CitadelsGame = () => {
  const { user } = useAuth();
  const [variants, setVariants] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [createForm, setCreateForm] = useState({ title: "", variantCode: "BASE", turnTimeSeconds: "30" });
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(initialCitadelsActionFeedback);
  const [pendingKeepIds, setPendingKeepIds] = useState([]);
  const [redrawIds, setRedrawIds] = useState([]);
  const [laboratoryCardId, setLaboratoryCardId] = useState("");

  const mountedRef = useRef(false);
  const stompRef = useRef(null);
  const stompInitRef = useRef(null);
  const gameSubRef = useRef(null);
  const realtimeRoomRef = useRef(null);

  const myMemberId = currentMemberIdOf(user);
  const players = selectedRoom?.players || [];
  const status = roomStatusOf(selectedRoom);
  const hostMemberId = Number(selectedRoom?.hostMemberId || 0);
  const isHost = Boolean(selectedRoom && hostMemberId === myMemberId);
  const mySeatNo = seatNoOf(players.find((player) => memberIdOf(player) === myMemberId));
  const myReady = players.some((player) => memberIdOf(player) === myMemberId && isReady(player));
  const minPlayers = Number(selectedRoom?.minPlayers || 0);
  const maxPlayers = Number(selectedRoom?.maxPlayers || 0);
  const guestPlayers = players.filter((player) => memberIdOf(player) !== hostMemberId);
  const readyGuestCount = guestPlayers.filter(isReady).length;
  const everyGuestReady = guestPlayers.every(isReady);
  const enoughPlayers = players.length >= minPlayers;
  const withinMaxPlayers = maxPlayers <= 0 || players.length <= maxPlayers;
  const soloAiStartAvailable = canUseTabletopSoloAiStart({ game: GAME_CODE, playerCount: players.length, minPlayers });
  const startPlayerRequirementMet = (enoughPlayers || soloAiStartAvailable) && withinMaxPlayers;
  const canStart = isHost && status === "WAITING" && startPlayerRequirementMet && everyGuestReady;
  const startChecks = [
    {
      key: "players",
      label: "인원",
      done: startPlayerRequirementMet,
      detail: soloAiStartAvailable
        ? `${players.length}/${maxPlayers || "-"}명 · 공식 최소 ${minPlayers}명, 부족 좌석 AI 보충`
        : `${players.length}/${maxPlayers || "-"}명 · 최소 ${minPlayers}명`,
    },
    { key: "ready", label: "준비", done: everyGuestReady, detail: `${readyGuestCount}/${guestPlayers.length}명 준비` },
    { key: "host", label: "권한", done: isHost, detail: isHost ? "방장 시작 가능" : "방장만 시작 가능" },
  ];
  const startBlockedText = canStart ? "모든 조건이 맞았습니다." : startChecks.find((check) => !check.done)?.detail || "시작 대기 중";
  const citadelsLobbySetup = useMemo(() => {
    const selectedVariant = variants.find((variant) => variant.code === createForm.variantCode) || variants[0] || null;
    const title = createForm.title.trim();
    const turnSeconds = Number(createForm.turnTimeSeconds || 0);
    const joinCodeReady = joinCode.trim().length > 0;
    const titleReady = title.length > 0;
    const variantReady = Boolean(selectedVariant);
    const min = Number(selectedVariant?.minPlayers || 0);
    const max = Number(selectedVariant?.maxPlayers || 0);
    const roomReady = titleReady && variantReady;

    return {
      canStart: roomReady,
      statusText: roomReady ? "방 생성 입력 준비" : "방 제목 입력 대기",
      items: [
        {
          label: "방 제목",
          value: titleReady ? title : "제목 필요",
          detail: titleReady ? "생성 버튼을 누르면 이 이름으로 대기방이 열립니다." : "친구가 찾기 쉬운 방 이름을 먼저 적어주세요.",
          icon: "state",
          tone: titleReady ? "done" : "waiting",
          progress: titleReady ? 100 : 25,
        },
        {
          label: "선택 규칙",
          value: selectedVariant?.displayName || "규칙 로딩",
          detail: variantReady ? `${min || "-"}~${max || "-"}명 · 캐릭터 선택과 8구역 종료 조건을 사용합니다.` : "서버에서 규칙 목록을 불러오는 중입니다.",
          icon: "decision",
          tone: variantReady ? "done" : "waiting",
          progress: variantReady ? 100 : 35,
        },
        {
          label: "턴 시간",
          value: turnSeconds ? `${turnSeconds}초` : "기본 30초",
          detail: "캐릭터 선택, 수입, 건설 판단에 적용되는 방 설정입니다.",
          icon: "turn",
          tone: turnSeconds ? "active" : "neutral",
          progress: Math.max(20, Math.min(100, (turnSeconds || 30) / 60 * 100)),
        },
        {
          label: "코드 입장",
          value: joinCodeReady ? joinCode.trim().toUpperCase() : `${rooms.length}개 공개방`,
          detail: joinCodeReady ? "입장을 누르면 입력한 코드의 시티델 방으로 합류합니다." : "공개방을 고르거나 친구 방 코드를 입력해 바로 합류할 수 있습니다.",
          icon: "player",
          tone: joinCodeReady || rooms.length ? "active" : "neutral",
          progress: joinCodeReady ? 100 : Math.min(100, rooms.length * 30),
        },
      ],
      ruleHint: "이 셋업 패널은 현재 입력값을 설명하는 읽기 전용 안내입니다. 방 생성, 코드 입장, 준비, 시작, 캐릭터/구역 규칙과 서버 payload는 그대로 유지됩니다.",
    };
  }, [createForm.title, createForm.turnTimeSeconds, createForm.variantCode, joinCode, rooms.length, variants]);
  const citadelsStartReadiness = useMemo(() => {
    if (!selectedRoom) return null;
    const playerProgress = minPlayers > 0 ? (players.length / minPlayers) * 100 : 100;
    const guestProgress = guestPlayers.length > 0 ? (readyGuestCount / guestPlayers.length) * 100 : 100;
    const startSignalReady = startPlayerRequirementMet && everyGuestReady;
    return {
      canStart,
      statusText: isHost
        ? (startSignalReady ? "방장 시작 가능" : "시작 조건 확인 중")
        : (startSignalReady ? "방장 시작 대기" : "준비 조건 확인 중"),
      items: [
        {
          label: "인원 조건",
          value: `${players.length}/${maxPlayers || "-"}명`,
          detail: startPlayerRequirementMet
            ? (soloAiStartAvailable ? `공식 최소 ${minPlayers}명 기준으로 부족 좌석은 AI가 채웁니다.` : `최소 ${minPlayers}명 조건을 충족했습니다.`)
            : `${Math.max(0, minPlayers - players.length)}명이 더 필요합니다.`,
          icon: "player",
          tone: startPlayerRequirementMet ? "done" : "waiting",
          progress: playerProgress,
        },
        {
          label: "게스트 준비",
          value: guestPlayers.length ? `${readyGuestCount}/${guestPlayers.length}명 준비` : "게스트 없음",
          detail: guestPlayers.length
            ? (everyGuestReady ? "게스트 준비가 완료되었습니다." : "아직 준비하지 않은 게스트가 있습니다.")
            : (soloAiStartAvailable ? "방장 단독 시작 시 부족 좌석은 AI가 채웁니다." : "방장 혼자 대기 중입니다. 최소 인원을 채워야 시작할 수 있습니다."),
          icon: "turn",
          tone: guestPlayers.length ? (everyGuestReady ? "done" : "waiting") : "neutral",
          progress: guestProgress,
        },
        {
          label: "시작 권한",
          value: isHost ? (startSignalReady ? "시작 가능" : "방장 대기") : "방장 전용",
          detail: isHost ? "방장만 현재 방을 시작할 수 있습니다." : "모든 조건이 맞으면 방장이 시작합니다.",
          icon: "signal",
          tone: isHost && startSignalReady ? "done" : startSignalReady ? "active" : "waiting",
        },
        {
          label: "선택 규칙",
          value: selectedRoom.variantName || "기본 규칙",
          detail: `턴 ${Number(selectedRoom.turnTimeSeconds || 30)}초 · 캐릭터 선택부터 시작`,
          icon: "decision",
          tone: "active",
        },
      ],
      ruleHint: soloAiStartAvailable
        ? "시티델은 공식 최소 인원 표기를 유지하고, 방장 단독 시작 시 부족 좌석은 AI가 채웁니다. 시작 후 캐릭터 선택, 건설, 점수 계산은 기존 서버 규칙을 그대로 따릅니다."
        : "시티델은 최소 인원, 게스트 준비, 방장 시작 권한이 맞을 때 시작합니다. 시작 후 캐릭터 선택, 건설, 점수 계산은 기존 서버 규칙을 그대로 따릅니다.",
    };
  }, [canStart, everyGuestReady, guestPlayers.length, isHost, maxPlayers, minPlayers, players.length, readyGuestCount, selectedRoom, soloAiStartAvailable, startPlayerRequirementMet]);
  const selectedGuideVariant = useMemo(() => {
    const code = selectedRoom?.variantCode || createForm.variantCode || "BASE";
    return variants.find((variant) => variant.code === code) || {
      code,
      displayName: selectedRoom?.variantName || "기본판",
      minPlayers: selectedRoom?.minPlayers,
      maxPlayers: selectedRoom?.maxPlayers,
    };
  }, [createForm.variantCode, selectedRoom, variants]);

  useEffect(() => {
    setPageGuideContext({
      game: GAME_CODE,
      variantCode: get(gameState, "variant_code", "variantCode", "") || selectedGuideVariant?.code || "BASE",
      variant: selectedGuideVariant,
      context: selectedRoom ? (gameState || status === "PLAYING" || status === "FINISHED" ? "play" : "waiting-room") : "lobby",
    });
    return clearPageGuideContext;
  }, [gameState, selectedGuideVariant, selectedRoom, status]);

  const phase = get(gameState, "phase", "phase", "");
  const activeSeatNo = Number(get(gameState, "active_seat_no", "activeSeatNo", 0));
  const chooserSeatNo = Number(get(gameState, "chooser_seat_no", "chooserSeatNo", 0));
  const selectionStep = get(gameState, "selection_step", "selectionStep", "");
  const activeCharacter = get(gameState, "active_character_code", "activeCharacterCode", "");
  const pendingChoiceSeatNo = Number(get(gameState, "pending_choice_seat_no", "pendingChoiceSeatNo", 0));
  const pendingKeepCount = Number(get(gameState, "pending_keep_count", "pendingKeepCount", 0));
  const pendingChoices = asArray(get(gameState, "pending_district_choices", "pendingDistrictChoices", []));
  const pendingGraveyardSeatNo = Number(get(gameState, "pending_graveyard_seat_no", "pendingGraveyardSeatNo", 0));
  const pendingGraveyardCard = get(gameState, "pending_graveyard_card", "pendingGraveyardCard", null);
  const actionTaken = Boolean(get(gameState, "action_taken", "actionTaken", false));
  const incomeTaken = Boolean(get(gameState, "income_taken", "incomeTaken", false));
  const characterAbilityUsed = Boolean(get(gameState, "character_ability_used", "characterAbilityUsed", false));
  const builtThisTurn = Number(get(gameState, "built_this_turn", "builtThisTurn", 0));
  const warlordDestroyed = Boolean(get(gameState, "warlord_destroyed", "warlordDestroyed", false));
  const laboratoryUsed = Boolean(get(gameState, "laboratory_used", "laboratoryUsed", false));
  const smithyUsed = Boolean(get(gameState, "smithy_used", "smithyUsed", false));
  const finalRound = Boolean(get(gameState, "final_round", "finalRound", false));
  const winnerSeatNo = Number(get(gameState, "winner_seat_no", "winnerSeatNo", 0));
  const murderedCharacter = get(gameState, "murdered_character_code", "murderedCharacterCode", "");
  const availableCharacters = asArray(get(gameState, "available_characters", "availableCharacters", []));
  const faceUpRemovedCharacters = asArray(get(gameState, "face_up_removed_characters", "faceUpRemovedCharacters", []));
  const citadelsPlayers = asArray(get(gameState, "players", "players", []));
  const events = asArray(get(gameState, "events", "events", []));
  const myCitadelsPlayer = citadelsPlayers.find((player) => Number(get(player, "seat_no", "seatNo", 0)) === mySeatNo) || null;
  const myHand = handOf(myCitadelsPlayer);
  const myCity = cityOf(myCitadelsPlayer);
  const myGold = Number(get(myCitadelsPlayer, "gold", "gold", 0));
  const isMyTurn = phase === "TURN_ACTION" && activeSeatNo === mySeatNo;
  const isMySelection = phase === "CHARACTER_SELECTION" && chooserSeatNo === mySeatNo;
  const isMyDistrictChoice = phase === "DISTRICT_CHOICE" && pendingChoiceSeatNo === mySeatNo;
  const isMyGraveyardChoice = phase === "GRAVEYARD_CHOICE" && pendingGraveyardSeatNo === mySeatNo;
  const buildLimit = activeCharacter === "ARCHITECT" ? 3 : 1;
  const afterWarlordDestruction = activeCharacter === "WARLORD" && warlordDestroyed;
  const canBuild = isMyTurn && actionTaken && builtThisTurn < buildLimit && !afterWarlordDestruction;
  const canEndTurn = isMyTurn && actionTaken && !actionBusy;
  const incomeColor = incomeColorByCharacter[activeCharacter] || "";
  const incomePreview = incomeColor ? myCity.filter((card) => cardColorOf(card) === incomeColor || templateCodeOf(card) === "MAGIC_SCHOOL").length : 0;
  const colorProgress = cityColorProgress(myCity);
  const buildableCards = myHand.filter((card) => cardCostOf(card) <= myGold && canBuildDuplicate(myCitadelsPlayer, card)).length;
  const canUseLaboratory = isMyTurn && hasDistrict(myCitadelsPlayer, "LABORATORY") && !laboratoryUsed && myHand.length > 0 && !afterWarlordDestruction;
  const canUseSmithy = isMyTurn && hasDistrict(myCitadelsPlayer, "SMITHY") && !smithyUsed && myGold >= 2 && !afterWarlordDestruction;
  const actionSignal = lastEventSignal(gameState);

  useGameSound({
    myTurn: isMyTurn || isMySelection || isMyDistrictChoice || isMyGraveyardChoice,
    actionSignal,
  });

  const turnGuidance = (() => {
    if (phase === "FINISHED") return winnerSeatNo ? `${playerName(players, winnerSeatNo)}님이 승리했습니다.` : "점수 계산이 끝났습니다.";
    if (isMyGraveyardChoice) return `${cardNameOf(pendingGraveyardCard)}을 금화 1개로 손패에 되돌릴지 선택하세요.`;
    if (phase === "GRAVEYARD_CHOICE") return `${playerName(players, pendingGraveyardSeatNo)}님의 묘지 선택을 기다리는 중입니다.`;
    if (isMyDistrictChoice) return `${pendingKeepCount}장을 골라 손패에 넣으세요. 지금 지을 수 있는 비용과 부족한 색상을 같이 보세요.`;
    if (phase === "DISTRICT_CHOICE") return `${playerName(players, pendingChoiceSeatNo)}님의 구역 카드 선택을 기다리는 중입니다.`;
    if (isMySelection) return selectionStep === "DISCARD" ? "이번 라운드에서 빠질 캐릭터를 고르세요." : "먼저 쓰고 싶은 능력과 필요한 수입 색을 보고 캐릭터를 고르세요.";
    if (phase === "CHARACTER_SELECTION") return `${playerName(players, chooserSeatNo)}님의 캐릭터 선택을 기다리는 중입니다.`;
    if (isMyTurn && !actionTaken) return "먼저 금화 2개 또는 구역 카드 뽑기를 선택하세요. 지을 카드가 있으면 금화, 손패가 약하면 카드를 권장합니다.";
    if (isMyTurn && canBuild) return buildableCards ? `건설 가능 ${buildableCards}장입니다. 색상 보너스와 8구역 완성 타이밍을 확인하세요.` : "건설할 카드가 없으면 특수 구역 능력이나 턴 종료를 선택하세요.";
    if (isMyTurn && afterWarlordDestruction) return "장군 파괴 뒤에는 턴 종료만 가능합니다.";
    if (isMyTurn) return "필요한 특수 능력을 사용한 뒤 턴을 종료하세요.";
    return `${playerName(players, activeSeatNo)}님의 ${characterName(activeCharacter)} 차례입니다.`;
  })();
  const currentPhaseLabel = phaseLabels[phase] || phase || "대기";
  const selectedRoomId = roomIdOf(selectedRoom);
  const actionFeedbackTone = actionFeedback.status === "error"
    ? "error"
    : actionBusy || actionFeedback.status === "pending"
      ? "pending"
      : actionFeedback.status === "done"
        ? "done"
        : "idle";
  const actionFeedbackItems = useMemo(() => [
    {
      label: "처리 상태",
      value: citadelsFeedbackStatusLabel(actionFeedback.status, actionBusy),
      detail: actionFeedback.label,
      icon: actionFeedback.status === "error" ? "recent" : "signal",
      tone: actionFeedbackTone,
    },
    {
      label: "최근 행동",
      value: actionFeedback.message,
      detail: actionFeedback.detail,
      icon: "decision",
      tone: actionFeedback.status === "error" ? "error" : actionFeedback.status === "done" ? "done" : "neutral",
    },
    {
      label: "현재 단계",
      value: currentPhaseLabel,
      detail: statusLabels[status] || status || "대기",
      icon: "stage",
      tone: phase === "FINISHED" ? "done" : "neutral",
    },
    {
      label: "다음 판단",
      value: actionBusy || actionFeedback.status === "pending" ? "서버 처리 대기" : actionFeedback.status === "error" ? "조건 확인 필요" : "상태 반영 확인",
      detail: actionSignal || turnGuidance,
      icon: "recent",
      tone: actionFeedback.status === "error" ? "error" : actionFeedback.status === "pending" ? "pending" : "neutral",
    },
  ], [actionBusy, actionFeedback, actionFeedbackTone, actionSignal, currentPhaseLabel, phase, status, turnGuidance]);
  const beginnerSteps = (() => {
    if (phase === "FINISHED") {
      return ["최종 점수와 보너스를 확인합니다.", "방장이 다시 하기 또는 나가기를 선택할 수 있습니다.", "다음 판에서는 색상 5종 보너스를 먼저 노려보세요."];
    }
    if (isMySelection) {
      return selectionStep === "DISCARD"
        ? ["이번 라운드에서 제외할 캐릭터를 고릅니다.", "상대가 쓰면 위험한 능력부터 제거하는 편이 안전합니다.", "제외 후 다음 선택 차례를 기다립니다."]
        : ["캐릭터 설명을 보고 이번 라운드 능력을 고릅니다.", "내 도시 색상과 맞는 수입 캐릭터를 우선 고려합니다.", "초보자는 왕, 상인, 건축가처럼 직접 이득이 보이는 캐릭터가 쉽습니다."];
    }
    if (phase === "CHARACTER_SELECTION") {
      return ["다른 플레이어가 비밀 캐릭터를 고르는 중입니다.", "공개 제외 캐릭터를 확인해 이번 라운드에 없는 능력을 기억하세요.", "내 차례가 오면 화면의 캐릭터 카드를 터치합니다."];
    }
    if (isMyDistrictChoice) {
      return [`${pendingKeepCount}장을 선택해 손패에 넣습니다.`, "금화가 많으면 바로 지을 수 있는 낮은 비용 카드를 우선 봅니다.", "색상 보너스가 부족하면 없는 색의 구역을 고르세요."];
    }
    if (phase === "DISTRICT_CHOICE") {
      return ["다른 플레이어가 뽑은 구역 카드를 고르는 중입니다.", "선택이 끝나면 다음 차례가 자동으로 진행됩니다.", "오른쪽 도시 현황에서 상대 구역 수를 확인하세요."];
    }
    if (isMyGraveyardChoice) {
      return ["파괴된 구역을 금화 1개로 회수할지 선택합니다.", "점수가 높거나 색상 보너스에 필요한 구역이면 회수하세요.", "금화가 부족하거나 가치가 낮으면 포기해도 됩니다."];
    }
    if (isMyTurn && !actionTaken) {
      return ["먼저 금화 2개 받기 또는 구역 카드 뽑기 중 하나를 선택합니다.", "지을 카드가 손에 있고 금화가 부족하면 금화를 받으세요.", "손패가 약하거나 선택지가 없으면 구역 카드 뽑기가 안전합니다."];
    }
    if (isMyTurn && canBuild) {
      return ["건설 가능한 카드를 확인합니다.", "색상 보너스에 필요한 색이나 높은 점수 구역을 우선 짓습니다.", "능력을 더 쓸 게 없으면 턴 종료를 누릅니다."];
    }
    if (isMyTurn) {
      return ["캐릭터 특수 능력을 사용할지 확인합니다.", "수입 버튼이나 마술사/장군 능력이 활성화되어 있으면 먼저 판단하세요.", "할 일이 끝났다면 턴 종료를 누릅니다."];
    }
    return [`${playerName(players, activeSeatNo)}님의 차례를 기다립니다.`, "현재 호출된 캐릭터와 능력을 확인하세요.", "상대 도시의 8구역 완성 여부와 색상 보너스를 지켜보세요."];
  })();

  const fetchVariants = async () => {
    const list = await tabletopGameAdapter.fetchVariants(GAME_CODE);
    setVariants(list);
    if (list[0]) setCreateForm((prev) => ({ ...prev, variantCode: prev.variantCode || list[0].code }));
  };

  const fetchRooms = async () => {
    setRooms(await tabletopGameAdapter.fetchRooms(GAME_CODE));
  };

  const fetchState = async (roomId) => {
    const payload = await tabletopGameAdapter.fetchState(GAME_CODE, roomId);
    if (payload?.room) setSelectedRoom(payload.room);
    setGameState(payload?.gameState || null);
    return payload;
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
      client.onStompError = (frame) => {
        void notifyRealtimeError({
          scope: "citadels-game",
          error: frame,
          fallbackMessage: "시티델 실시간 연결에 문제가 생겼습니다. 잠시 뒤 다시 시도해주세요.",
        });
      };
      client.beforeConnect = () => {
        client.connectHeaders = buildStompConnectHeaders();
      };
      client.onConnect = () => {
        bindLatestRealtimeRoom(client).catch(() => {});
      };
      client.activate();
      stompRef.current = client;
      return client;
    }).finally(() => {
      stompInitRef.current = null;
    });
    return stompInitRef.current;
  };

  const bindRealtimeRoom = async (client, roomId) => {
    if (!client?.connected || !roomId) return;
    if (gameSubRef.current) gameSubRef.current.unsubscribe();
    gameSubRef.current = client.subscribe(`/sub/game/${GAME_CODE}/room/${roomId}`, (message) => {
      try {
        const payload = normalizeTabletopStatePayload(JSON.parse(message.body || "{}"));
        if (payload?.room) setSelectedRoom(payload.room);
      } catch {
        // Snapshot reload below handles malformed push payloads.
      }
      fetchState(roomId).catch(() => {});
    });
  };

  const bindLatestRealtimeRoom = async (client) => {
    const target = realtimeRoomRef.current;
    if (!target) return;
    await bindRealtimeRoom(client, target.roomId);
  };

  const openRoom = async (room) => {
    setSelectedRoom(room);
    const roomId = roomIdOf(room);
    if (!roomId) return;
    rememberResumeRoom(room);
    realtimeRoomRef.current = { roomId };
    await fetchState(roomId);
    const client = await ensureSocket();
    if (client?.connected) {
      await bindRealtimeRoom(client, roomId);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    Promise.allSettled([fetchVariants(), fetchRooms()]).catch(() => {});
    return () => {
      mountedRef.current = false;
      if (gameSubRef.current) gameSubRef.current.unsubscribe();
      if (stompRef.current) stompRef.current.deactivate();
      stompRef.current = null;
      stompInitRef.current = null;
      gameSubRef.current = null;
      realtimeRoomRef.current = null;
    };
  }, []);

  useEffect(() => {
    setActionFeedback(initialCitadelsActionFeedback());
  }, [selectedRoomId]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const myRooms = await tabletopGameAdapter.fetchMyRooms(GAME_CODE);
        if (!active) return;
        const storedId = Number(localStorage.getItem(ROOM_STORAGE_KEY) || 0);
        const room = myRooms.find((item) => Number(roomIdOf(item)) === storedId) || myRooms[0];
        if (room) {
          await openRoom(room);
        } else {
          clearResumeRoom();
        }
      } catch {
        // No active Citadels room.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setPendingKeepIds((prev) => {
      const next = prev.filter((id) => pendingChoices.some((card) => cardIdOf(card) === id)).slice(0, pendingKeepCount);
      return next.length === prev.length && next.every((id, index) => id === prev[index]) ? prev : next;
    });
  }, [pendingChoices, pendingKeepCount]);

  useEffect(() => {
    setRedrawIds((prev) => {
      const next = prev.filter((id) => myHand.some((card) => cardIdOf(card) === id));
      return next.length === prev.length && next.every((id, index) => id === prev[index]) ? prev : next;
    });
  }, [myHand]);

  useEffect(() => {
    setLaboratoryCardId((prev) => (myHand.some((card) => cardIdOf(card) === prev) ? prev : ""));
  }, [myHand]);

  const withBusy = async (fn, fallbackMessage) => {
    if (busy || actionBusy) {
      notify("이전 요청을 처리하는 중입니다.");
      return;
    }
    setBusy(true);
    try {
      await fn();
    } catch (error) {
      notifyError(error?.response?.data?.message || fallbackMessage);
    } finally {
      setBusy(false);
    }
  };

  const createRoom = (event) => {
    event.preventDefault();
    withBusy(async () => {
      const room = await tabletopGameAdapter.createRoom(GAME_CODE, {
        title: createForm.title,
        variantCode: createForm.variantCode || "BASE",
        turnTimeSeconds: Number(createForm.turnTimeSeconds || 30),
      });
      await openRoom(room);
      await fetchRooms();
      notifySuccess("시티델 방을 만들었습니다.");
    }, "방 생성에 실패했습니다.");
  };

  const joinByCode = (event) => {
    event.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      notifyError("방 코드를 입력해주세요.");
      return;
    }
    withBusy(async () => {
      const room = await tabletopGameAdapter.joinByCode(GAME_CODE, code);
      setJoinCode("");
      await openRoom(room);
      await fetchRooms();
      notifySuccess("방에 입장했습니다.");
    }, "방 코드 입장에 실패했습니다.");
  };

  const joinRoom = (roomId) => withBusy(async () => {
    const room = await tabletopGameAdapter.joinRoom(GAME_CODE, roomId);
    await openRoom(room);
    await fetchRooms();
    notifySuccess("방에 입장했습니다.");
  }, "방 입장에 실패했습니다.");

  const toggleReady = () => withBusy(async () => {
    await tabletopGameAdapter.toggleReady(GAME_CODE, roomIdOf(selectedRoom));
    await fetchState(roomIdOf(selectedRoom));
  }, "준비 상태 변경에 실패했습니다.");

  const startGame = () => withBusy(async () => {
    await tabletopGameAdapter.startGame(GAME_CODE, roomIdOf(selectedRoom));
    await fetchState(roomIdOf(selectedRoom));
    notifySuccess("시티델을 시작했습니다.");
  }, "인원과 준비 상태를 확인해주세요.");

  const forceFinishGame = async () => {
    const confirmed = await confirmAction({
      title: "진행 중인 게임을 종료할까요?",
      description: "현재 판을 중단하고 같은 방의 대기 상태로 돌아갑니다.",
      confirmText: "종료",
    });
    if (!confirmed) return;
    return withBusy(async () => {
      const room = await tabletopGameAdapter.forceFinish(GAME_CODE, roomIdOf(selectedRoom));
      if (room) setSelectedRoom(room);
      setGameState(null);
      await fetchRooms();
      notifySuccess("게임을 종료했습니다.");
    }, "게임 종료에 실패했습니다.");
  };

  const rematchRoom = () => withBusy(async () => {
    const room = await tabletopGameAdapter.rematch(GAME_CODE, roomIdOf(selectedRoom));
    if (room) setSelectedRoom(room);
    setGameState(null);
    await fetchRooms();
    notifySuccess("다시 하기 대기방으로 전환했습니다.");
  }, "다시 하기에 실패했습니다.");

  const leaveRoom = () => withBusy(async () => {
    await tabletopGameAdapter.leaveRoom(GAME_CODE, roomIdOf(selectedRoom));
    setSelectedRoom(null);
    setGameState(null);
    realtimeRoomRef.current = null;
    clearResumeRoom(roomIdOf(selectedRoom));
    if (gameSubRef.current) gameSubRef.current.unsubscribe();
    await fetchRooms();
    notifySuccess("방에서 나갔습니다.");
  }, "방 나가기에 실패했습니다.");

  const sendAction = async (payload, fallbackMessage = "액션 처리에 실패했습니다.") => {
    if (!selectedRoom || actionBusy) return;
    const actionLabel = citadelsActionLabel(payload);
    setActionBusy(true);
    setActionFeedback({
      status: "pending",
      label: actionLabel,
      message: `${actionLabel} 처리 중`,
      detail: "서버가 행동 조건을 확인하고 시티델 상태를 갱신하는 중입니다.",
    });
    try {
      const result = await tabletopGameAdapter.sendAction(GAME_CODE, roomIdOf(selectedRoom), payload);
      if (result?.room) setSelectedRoom(result.room);
      setGameState(result?.gameState || null);
      setActionFeedback({
        status: "done",
        label: actionLabel,
        message: `${actionLabel} 반영 완료`,
        detail: result?.gameState ? "응답 상태가 단계, 도시, 자원 패널에 반영되었습니다." : "행동 요청이 처리되었고 실시간 상태 갱신을 기다립니다.",
      });
      return result;
    } catch (error) {
      notifyError(error?.response?.data?.message || fallbackMessage);
      setActionFeedback({
        status: "error",
        label: actionLabel,
        message: `${actionLabel} 실패`,
        detail: "차례, 금화, 카드 조건을 확인한 뒤 다시 시도하세요.",
      });
    } finally {
      setActionBusy(false);
    }
  };

  const toggleKeepCard = (cardId) => {
    setPendingKeepIds((prev) => {
      if (prev.includes(cardId)) return prev.filter((id) => id !== cardId);
      if (prev.length >= pendingKeepCount) return [...prev.slice(1), cardId];
      return [...prev, cardId];
    });
  };

  const toggleRedrawCard = (cardId) => {
    setRedrawIds((prev) => (prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]));
  };

  const buildHintForCard = (card) => {
    if (canBuild) {
      if (myGold < cardCostOf(card)) return `금화 ${cardCostOf(card) - myGold}개 부족`;
      if (!canBuildDuplicate(myCitadelsPlayer, card)) return "같은 구역은 이미 건설됨";
      if (colorProgress.missing.includes(cardColorOf(card))) return `${colorLabels[cardColorOf(card)]} 색상 보너스에 도움`;
      return "건설 가능";
    }
    if (activeCharacter === "MAGICIAN" && isMyTurn) return "마술사 교체 선택 가능";
    return "";
  };

  const destroyBlockedReason = (targetPlayer, card) => {
    const characterCodes = charactersOf(targetPlayer);
    if (cityOf(targetPlayer).length >= 8) return "완성 도시는 보호됨";
    if (characterCodes.includes("BISHOP") && murderedCharacter !== "BISHOP") return "주교 보호";
    if (templateCodeOf(card) === "KEEP") return "성채 보호";
    const cost = warlordDestroyCost(targetPlayer, card);
    if (myGold < cost) return `금화 ${cost - myGold}개 부족`;
    return "";
  };

  const renderActionPanel = () => (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-lg font-black text-slate-900">내 손패</div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">금화 {myGold}</div>
        </div>
        <div className="mb-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold leading-relaxed text-slate-600">
          건설 가능 {buildableCards}/{myHand.length}장 · 색상 보너스 {colorProgress.completed ? "가능" : `부족: ${colorProgress.missingText}`}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {myHand.map((card) => (
            <CitadelsCard
              key={cardIdOf(card)}
              card={card}
              selected={redrawIds.includes(cardIdOf(card)) || laboratoryCardId === cardIdOf(card)}
              onClick={activeCharacter === "MAGICIAN" && isMyTurn && !characterAbilityUsed ? () => toggleRedrawCard(cardIdOf(card)) : undefined}
              actionLabel={buildHintForCard(card)}
            />
          ))}
          {!myHand.length && (
            <CitadelsEmptyHandPanel
              currentPhaseLabel={currentPhaseLabel}
              myGold={myGold}
              isMyTurn={isMyTurn}
              actionTaken={actionTaken}
              incomeTaken={incomeTaken}
              activeCharacter={activeCharacter}
              canBuild={canBuild}
              colorProgress={colorProgress}
            />
          )}
        </div>
        {canBuild && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {myHand.map((card) => (
              <button
                key={cardIdOf(card)}
                type="button"
                disabled={actionBusy || myGold < cardCostOf(card) || !canBuildDuplicate(myCitadelsPlayer, card)}
                onClick={() => sendAction({ actionType: "BUILD_DISTRICT", cardIds: [cardIdOf(card)] }, "구역을 건설할 수 없습니다.")}
                className="min-h-10 rounded-xl bg-slate-900 px-3 text-xs font-black text-white disabled:opacity-40"
              >
                <span className="inline-flex items-center justify-center gap-1"><Hammer className="h-3.5 w-3.5" />{cardNameOf(card)} · {cardCostOf(card)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
        <div className="mb-3 text-lg font-black text-slate-900">액션</div>
        <div className="grid gap-2">
          <button type="button" disabled={!isMyTurn || actionTaken || actionBusy} onClick={() => sendAction({ actionType: "TAKE_GOLD" })} className="min-h-12 rounded-xl bg-amber-500 px-4 py-2 text-left text-sm font-black text-white disabled:opacity-40">
            <span className="inline-flex items-center gap-2"><Coins className="h-4 w-4" />금화 2개 받기</span>
          </button>
          <button type="button" disabled={!isMyTurn || actionTaken || actionBusy} onClick={() => sendAction({ actionType: "DRAW_DISTRICTS" })} className="min-h-12 rounded-xl bg-slate-900 px-4 py-2 text-left text-sm font-black text-white disabled:opacity-40">
            <span className="inline-flex items-center gap-2"><BookOpen className="h-4 w-4" />구역 카드 뽑기</span>
            <span className="mt-0.5 block text-[11px] font-bold text-white/75">{hasDistrict(myCitadelsPlayer, "OBSERVATORY") ? "천문대로 3장 중 선택" : "2장 중 1장 선택"}{hasDistrict(myCitadelsPlayer, "LIBRARY") ? " · 도서관으로 더 많이 보관" : ""}</span>
          </button>
          {incomeColor && (
            <button type="button" disabled={!isMyTurn || incomeTaken || afterWarlordDestruction || actionBusy} onClick={() => sendAction({ actionType: "COLLECT_COLOR_INCOME" })} className="min-h-12 rounded-xl bg-emerald-600 px-4 py-2 text-left text-sm font-black text-white disabled:opacity-40">
              <span>{colorLabels[incomeColor]} 수입 받기 · +{incomePreview} 금화</span>
            </button>
          )}
          {activeCharacter === "MAGICIAN" && (
            <button type="button" disabled={!isMyTurn || characterAbilityUsed || actionBusy} onClick={() => sendAction({ actionType: "MAGICIAN_REDRAW", cardIds: redrawIds })} className="min-h-11 rounded-xl bg-violet-600 px-4 text-sm font-black text-white disabled:opacity-40">
              선택 손패 교체 · {redrawIds.length}장
            </button>
          )}
          {hasDistrict(myCitadelsPlayer, "LABORATORY") && (
            <div className="grid gap-2 sm:grid-cols-[1fr_112px]">
              <select aria-label="실험실로 버릴 카드" value={laboratoryCardId} disabled={!canUseLaboratory || actionBusy} onChange={(event) => setLaboratoryCardId(event.target.value)} className="min-h-10 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700">
                <option value="">실험실 카드 선택</option>
                {myHand.map((card) => <option key={cardIdOf(card)} value={cardIdOf(card)}>{cardNameOf(card)} · +2 금화</option>)}
              </select>
              <button type="button" disabled={!canUseLaboratory || !laboratoryCardId || actionBusy} onClick={() => sendAction({ actionType: "LABORATORY_DISCARD", cardIds: [laboratoryCardId] })} className="min-h-10 rounded-xl bg-amber-100 px-3 text-xs font-black text-amber-800 disabled:opacity-40">사용</button>
            </div>
          )}
          {hasDistrict(myCitadelsPlayer, "SMITHY") && (
            <button type="button" disabled={!canUseSmithy || actionBusy} onClick={() => sendAction({ actionType: "SMITHY_DRAW" })} className="min-h-10 rounded-xl bg-slate-800 px-3 text-xs font-black text-white disabled:opacity-40">
              대장간 · 금화 2개로 카드 3장
            </button>
          )}
          <button type="button" disabled={!canEndTurn} onClick={() => sendAction({ actionType: "END_TURN" })} className="min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-black text-slate-700 disabled:opacity-40">
            턴 종료
          </button>
        </div>

        {(activeCharacter === "ASSASSIN" || activeCharacter === "THIEF") && (
          <div className="mt-4 rounded-2xl bg-slate-50 p-3">
            <div className="mb-2 text-xs font-black text-slate-500">{activeCharacter === "ASSASSIN" ? "암살 대상" : "도둑 대상"}</div>
            <div className="grid grid-cols-2 gap-2">
              {Object.keys(characterLabels)
                .filter((code) => code !== activeCharacter && (activeCharacter !== "THIEF" || (code !== "ASSASSIN" && code !== murderedCharacter)))
                .map((code) => (
                  <button key={code} type="button" disabled={!isMyTurn || characterAbilityUsed || actionBusy} onClick={() => sendAction({ actionType: activeCharacter === "ASSASSIN" ? "ASSASSIN_TARGET" : "THIEF_TARGET", pieceCode: code })} className="min-h-9 rounded-xl bg-white px-3 text-xs font-black text-slate-700 disabled:opacity-40">
                    {characterName(code)}
                  </button>
                ))}
            </div>
          </div>
        )}

        {activeCharacter === "MAGICIAN" && (
          <div className="mt-4 rounded-2xl bg-slate-50 p-3">
            <div className="mb-2 text-xs font-black text-slate-500">손패 교환</div>
            <div className="grid gap-2">
              {citadelsPlayers.filter((player) => Number(get(player, "seat_no", "seatNo", 0)) !== mySeatNo).map((player) => {
                const targetSeatNo = Number(get(player, "seat_no", "seatNo", 0));
                return (
                  <button key={targetSeatNo} type="button" disabled={!isMyTurn || characterAbilityUsed || actionBusy} onClick={() => sendAction({ actionType: "MAGICIAN_EXCHANGE", targetSeatNo })} className="min-h-9 rounded-xl bg-white px-3 text-xs font-black text-slate-700 disabled:opacity-40">
                    {playerName(players, targetSeatNo)}와 교환
                  </button>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </section>
  );

  return (
    <div className="animate-fade-in space-y-6">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-red-900 to-amber-600 p-[1px] shadow-2xl sm:rounded-[2rem]">
        <div className="bg-white p-5 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Tabletop
            </div>
            <Link to="/app/games" className="hidden min-h-10 items-center justify-center rounded-xl bg-slate-100 px-4 text-sm font-black text-slate-700 transition hover:bg-slate-900 hover:text-white sm:inline-flex">
              게임 목록
            </Link>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-4xl">시티델</h1>
          </div>
        </div>
      </section>

      {!selectedRoom && (
        <>
        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <form onSubmit={createRoom} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <div className="flex items-center gap-2">
              <div className="text-lg font-black text-slate-900">방 만들기</div>
            </div>
            <div className="mt-4 space-y-3">
              <input aria-label="방 제목" className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="방 제목" value={createForm.title} onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))} />
              <select aria-label="시티델 규칙 선택" className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" value={createForm.variantCode} onChange={(event) => setCreateForm((prev) => ({ ...prev, variantCode: event.target.value }))}>
                {variants.map((variant) => (
                  <option key={variant.code} value={variant.code}>{variant.displayName} · {variant.minPlayers}~{variant.maxPlayers}명</option>
                ))}
              </select>
              <input aria-label="턴 시간" className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" inputMode="numeric" value={createForm.turnTimeSeconds} onChange={(event) => setCreateForm((prev) => ({ ...prev, turnTimeSeconds: event.target.value.replace(/[^\d]/g, "") }))} placeholder="턴 시간(초)" />
              <button type="submit" disabled={busy} className="min-h-11 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white disabled:opacity-50">방 만들기</button>
            </div>
          </form>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between gap-3">
              <div className="text-lg font-black text-slate-900">대기 중인 방</div>
              <button type="button" onClick={() => fetchRooms().catch(() => notifyError("목록을 불러오지 못했습니다."))} className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-slate-100 px-3 text-xs font-black text-slate-700">
                <RefreshCw className="h-3.5 w-3.5" />
                새로고침
              </button>
            </div>
            <CitadelsJoinCodePanel
              joinCode={joinCode}
              setJoinCode={setJoinCode}
              busy={busy}
              joinByCode={joinByCode}
            />
            <div className="mt-4 space-y-2.5">
              {!rooms.length && (
                <CitadelsLobbyEmptyState busy={busy} onRefresh={() => fetchRooms().catch(() => notifyError("목록을 불러오지 못했습니다."))} />
              )}
              {rooms.map((room) => (
                <CitadelsLobbyRoomCard key={roomIdOf(room)} room={room} busy={busy} onJoin={joinRoom} />
              ))}
            </div>
          </section>
        </section>
        </>
      )}

      {selectedRoom && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-xl font-black text-slate-900">{selectedRoom.title}</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-black text-slate-600">
                  <span className="rounded-full bg-slate-100 px-2 py-1">방 코드 {roomCodeOf(selectedRoom)}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1">{statusLabels[status] || status}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1">{selectedRoom.variantName}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1">{players.length}/{selectedRoom.maxPlayers}명</span>
                  {finalRound && <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-700">마지막 라운드</span>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to="/app/games" className="hidden min-h-10 items-center justify-center rounded-xl bg-slate-100 px-4 text-xs font-black text-slate-700 transition hover:bg-slate-900 hover:text-white sm:inline-flex">
                  게임 목록
                </Link>
                {status === "WAITING" && !isHost && (
                  <>
                    <button type="button" disabled={busy} onClick={toggleReady} className="min-h-10 rounded-xl bg-slate-100 px-4 text-xs font-black text-slate-700">
                      {myReady ? "준비 취소" : "준비하기"}
                    </button>
                    <span className="inline-flex min-h-10 items-center rounded-xl bg-amber-50 px-4 text-xs font-black text-amber-700" title="방장만 게임을 시작할 수 있습니다.">
                      방장 시작 대기
                    </span>
                  </>
                )}
                {status === "WAITING" && isHost && (
                  <button type="button" disabled={!canStart || busy} onClick={startGame} className="min-h-10 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white disabled:opacity-50">
                    {soloAiStartAvailable ? "AI와 시작하기" : "시작하기"}
                  </button>
                )}
                {status === "PLAYING" && isHost && (
                  <button type="button" disabled={busy} onClick={forceFinishGame} className="min-h-10 rounded-xl bg-slate-900 px-4 text-xs font-black text-white disabled:opacity-50">
                    강제 종료
                  </button>
                )}
                {status === "FINISHED" && isHost && (
                  <button type="button" disabled={busy} onClick={rematchRoom} className="min-h-10 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white disabled:opacity-50">
                    다시 하기
                  </button>
                )}
                <button type="button" disabled={busy} onClick={leaveRoom} className="min-h-10 rounded-xl bg-rose-50 px-4 text-xs font-black text-rose-600">나가기</button>
              </div>
            </div>
          </div>

          {status === "WAITING" && (
            <GameRoomPlayersPanel
              players={players}
              selectedRoom={selectedRoom}
              roomStatus={status}
              myMemberId={myMemberId}
              hostMemberId={hostMemberId}
              maxPlayers={maxPlayers}
              getMemberId={memberIdOf}
              getSeatNo={seatNoOf}
              getReady={isReady}
              getDetail={(player, { seatNo, isHost }) => `좌석 ${seatNo || "-"}${isHost ? " · 방장" : ""}`}
              dataSmoke="citadels-waiting-player-roster"
            />
          )}

          {gameState && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <main className="space-y-4">
                <section className={`rounded-2xl border p-5 shadow-lg ${isMyTurn || isMySelection || isMyDistrictChoice || isMyGraveyardChoice ? "border-amber-200 bg-amber-50/60" : "border-slate-200 bg-white"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-black text-slate-500">
                        현재 흐름
                      </div>
                      <div className="mt-1 text-2xl font-black text-slate-900">
                        {phase === "CHARACTER_SELECTION" ? `${playerName(players, chooserSeatNo)} 캐릭터 ${selectionStep === "DISCARD" ? "버림" : "선택"}` : phase === "DISTRICT_CHOICE" ? `${playerName(players, pendingChoiceSeatNo)} 구역 카드 선택` : phase === "GRAVEYARD_CHOICE" ? `${playerName(players, pendingGraveyardSeatNo)} 묘지 선택` : phase === "FINISHED" ? "게임 종료" : `${characterName(activeCharacter)} · ${playerName(players, activeSeatNo)} 차례`}
                      </div>
                    </div>
                    {winnerSeatNo > 0 && <div className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-black text-emerald-700">승자 {playerName(players, winnerSeatNo)}</div>}
                  </div>
                  <div className="mt-4 rounded-2xl border border-white/80 bg-white/80 p-3 shadow-sm" role="status" aria-live="polite" aria-atomic="true">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-xl bg-amber-500 p-2 text-white"><Target className="h-4 w-4" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-black text-amber-700">지금 할 일</div>
                        <div className="mt-0.5 text-sm font-black leading-relaxed text-slate-900">{turnGuidance}</div>
                        <div className="mt-2 grid grid-cols-4 gap-1.5">
                          {[
                            { label: "금화", value: myGold },
                            { label: "손패", value: myHand.length },
                            { label: "건설", value: `${builtThisTurn}/${buildLimit}` },
                            { label: "색상", value: colorProgress.completed ? "보너스" : `${5 - colorProgress.missing.length}/5` },
                          ].map((item) => (
                            <div key={item.label} className="min-w-0 rounded-xl bg-slate-50 px-2 py-1.5">
                              <div className="truncate text-[10px] font-bold text-slate-400">{item.label}</div>
                              <div className="truncate text-[11px] font-black text-slate-700">{item.value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {phase === "CHARACTER_SELECTION" && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-lg font-black text-slate-900">캐릭터 선택</div>
                      <div className="text-xs font-bold text-slate-500">{isMySelection ? "내가 처리할 차례입니다." : "선택 차례를 기다리는 중입니다."}</div>
                    </div>
                    {!!faceUpRemovedCharacters.length && (
                      <div className="mb-4 rounded-2xl bg-slate-50 p-3">
                        <div className="mb-2 text-xs font-black text-slate-500">공개로 제외된 캐릭터</div>
                        <div className="flex flex-wrap gap-2">
                          {faceUpRemovedCharacters.map((card) => (
                            <span key={card.code} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">
                              <CitadelsCharacterSigil code={card.code} className="h-5 w-5" />
                              {characterName(card.code)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {availableCharacters.map((card) => (
                        <CharacterButton
                          key={card.code}
                          code={card.code}
                          mode={selectionStep === "DISCARD" ? "버릴 캐릭터" : "선택할 캐릭터"}
                          disabled={!isMySelection || actionBusy}
                          onClick={() => sendAction({ actionType: selectionStep === "DISCARD" ? "DISCARD_CHARACTER" : "CHOOSE_CHARACTER", pieceCode: card.code })}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {phase === "DISTRICT_CHOICE" && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
                    <div className="mb-3 text-lg font-black text-slate-900">구역 카드 보관</div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {pendingChoices.map((card) => {
                        const cardId = cardIdOf(card);
                        return (
                          <CitadelsCard key={cardId} card={card} selected={pendingKeepIds.includes(cardId)} onClick={isMyDistrictChoice ? () => toggleKeepCard(cardId) : undefined} actionLabel={pendingKeepIds.includes(cardId) ? "보관 선택됨" : "클릭해서 선택"} />
                        );
                      })}
                    </div>
                    <button type="button" disabled={!isMyDistrictChoice || pendingKeepIds.length !== pendingKeepCount || actionBusy} onClick={() => sendAction({ actionType: "KEEP_DISTRICT_CARDS", cardIds: pendingKeepIds })} className="mt-4 min-h-11 w-full rounded-xl bg-slate-900 px-4 text-sm font-black text-white disabled:opacity-50">
                      {pendingKeepCount}장 보관
                    </button>
                  </section>
                )}

                {phase === "GRAVEYARD_CHOICE" && (
                  <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-lg">
                    <div className="text-lg font-black text-slate-900">묘지 선택</div>
                    <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">{cardNameOf(pendingGraveyardCard)}을 금화 1개로 손패에 되돌릴 수 있습니다.</div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <button type="button" disabled={!isMyGraveyardChoice || actionBusy || myGold < 1} onClick={() => sendAction({ actionType: "GRAVEYARD_KEEP" })} className="min-h-11 rounded-xl bg-violet-600 px-4 text-sm font-black text-white disabled:opacity-40">금화 1개 내고 회수</button>
                      <button type="button" disabled={!isMyGraveyardChoice || actionBusy} onClick={() => sendAction({ actionType: "GRAVEYARD_DECLINE" })} className="min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-black text-slate-700 disabled:opacity-40">버린 카드로 두기</button>
                    </div>
                  </section>
                )}

                {phase === "TURN_ACTION" && renderActionPanel()}

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
                  <div className="mb-3 flex items-center gap-2 text-lg font-black text-slate-900"><Users className="h-5 w-5" />도시 현황</div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {citadelsPlayers.map((player) => {
                      const seatNo = Number(get(player, "seat_no", "seatNo", 0));
                      const city = cityOf(player);
                      const characterCodes = charactersOf(player);
                      return (
                        <div key={seatNo} className={`rounded-2xl border p-3 ${seatNo === activeSeatNo ? "border-amber-200 bg-amber-50" : "border-slate-100 bg-slate-50"}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-black text-slate-900">{playerName(players, seatNo)}</div>
                            {seatNo === Number(get(gameState, "crown_seat_no", "crownSeatNo", 0)) && <Crown className="h-4 w-4 text-amber-500" />}
                          </div>
                          <div className="mt-1 text-xs font-bold text-slate-500">금화 {get(player, "gold", "gold", 0)} · 손패 {get(player, "hand_count", "handCount", 0)} · 구역 {city.length}</div>
                          {!!characterCodes.length && <div className="mt-2 flex flex-wrap gap-1">{characterCodes.map((code) => <span key={code} className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-600">{characterName(code)}</span>)}</div>}
                          <div className="mt-3 grid gap-2">
                            {city.map((card) => {
                              const blockedReason = destroyBlockedReason(player, card);
                              const canDestroy = activeCharacter === "WARLORD" && isMyTurn && actionTaken && !warlordDestroyed && !blockedReason;
                              return (
                                <div key={cardIdOf(card)} className={`rounded-xl border px-3 py-2 text-xs font-bold ${colorClasses[cardColorOf(card)] || "border-slate-200 bg-white text-slate-700"}`}>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="inline-flex min-w-0 items-center gap-2">
                                      <CitadelsDistrictArt color={cardColorOf(card)} cost={cardCostOf(card)} compact className="h-10 w-14 shrink-0" />
                                      <span className="min-w-0 truncate">{cardNameOf(card)}</span>
                                    </span>
                                    <span className="shrink-0">{cardCostOf(card)}</span>
                                  </div>
                                  {activeCharacter === "WARLORD" && isMyTurn && actionTaken && !warlordDestroyed && (
                                    <button type="button" disabled={!canDestroy || actionBusy} className="mt-2 min-h-8 w-full rounded-lg bg-white/80 px-2 text-[10px] font-black text-rose-700 disabled:text-slate-400 disabled:opacity-70" onClick={() => sendAction({ actionType: "WARLORD_DESTROY", targetSeatNo: seatNo, cardIds: [cardIdOf(card)] })}>
                                      {blockedReason || `파괴 비용 ${warlordDestroyCost(player, card)}`}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {phase === "FINISHED" && <div className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-700">점수 {citadelsScoreOf(player)} · 보너스 {citadelsBonusScoreOf(player)}</div>}
                        </div>
                      );
                    })}
                  </div>
                </section>
              </main>

              <aside className="space-y-4">
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
                  <div className="mb-3 text-sm font-black text-slate-900">최근 기록</div>
                  <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
                    {[...events].slice(-12).reverse().map((event) => {
                      const eventType = get(event, "event_type", "eventType", "");
                      const seatNo = Number(get(event, "seat_no", "seatNo", 0));
                      return (
                        <div key={get(event, "event_no", "eventNo", eventType)} className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                          <div className="font-black text-slate-800">{actionLabels[eventType] || eventType}</div>
                          <div className="mt-1">{seatNo ? playerName(players, seatNo) : "시스템"} · {characterName(get(event, "character_code", "characterCode", ""))}</div>
                        </div>
                      );
                    })}
                    {!events.length && (
                      <CitadelsHistoryEmptyState
                        status={status}
                        phase={phase}
                        activeCharacter={activeCharacter}
                        activeSeatNo={activeSeatNo}
                        players={players}
                        turnGuidance={turnGuidance}
                      />
                    )}
                  </div>
                </section>
              </aside>
            </div>
          )}

          <GameRoomChatPanel
            gameCode={GAME_CODE}
            roomId={roomIdOf(selectedRoom)}
            resetKey={`${status}-${phase || ""}`}
            title="방 채팅"
          />
        </section>
      )}
    </div>
  );
};

export default CitadelsGame;
