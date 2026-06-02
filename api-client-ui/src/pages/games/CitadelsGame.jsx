import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, CheckCircle2, Coins, Crown, Hammer, RefreshCw, Shield, Sparkles, Target, Users } from "lucide-react";
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

const GAME_CODE = "citadels";
const ROOM_STORAGE_KEY = "citadels_last_room_id";

const statusLabels = {
  WAITING: "대기 중",
  PLAYING: "진행 중",
  FINISHED: "종료",
};

const get = (obj, snake, camel, fallback = undefined) => obj?.[camel] ?? obj?.[snake] ?? fallback;
const roomIdOf = getTabletopRoomId;
const roomCodeOf = getTabletopRoomCode;
const roomStatusOf = getTabletopRoomStatus;
const memberIdOf = (player) => Number(getTabletopMemberId(player) || 0);
const seatNoOf = (player) => Number(getTabletopSeatNo(player) || 0);
const isReady = isTabletopReadyPlayer;
const asArray = (value) => (Array.isArray(value) ? value : []);

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

const colorLabels = {
  YELLOW: "귀족",
  BLUE: "종교",
  GREEN: "상업",
  RED: "군사",
  PURPLE: "특수",
};

const colorClasses = {
  YELLOW: "border-amber-200 bg-amber-50 text-amber-800",
  BLUE: "border-sky-200 bg-sky-50 text-sky-800",
  GREEN: "border-emerald-200 bg-emerald-50 text-emerald-800",
  RED: "border-rose-200 bg-rose-50 text-rose-800",
  PURPLE: "border-violet-200 bg-violet-50 text-violet-800",
};

const colorOrder = ["YELLOW", "BLUE", "GREEN", "RED", "PURPLE"];

const incomeColorByCharacter = {
  KING: "YELLOW",
  BISHOP: "BLUE",
  MERCHANT: "GREEN",
  WARLORD: "RED",
};

const characterHelp = {
  ASSASSIN: {
    summary: "한 캐릭터를 지정해 이번 라운드 차례를 건너뛰게 합니다.",
    hint: "상대가 고를 것 같은 고순위 캐릭터나, 지금 가장 앞선 플레이어에게 필요한 캐릭터를 노리세요.",
  },
  THIEF: {
    summary: "암살자/도둑이 아닌 캐릭터 하나를 지정해 그 캐릭터가 호출될 때 금화를 모두 가져옵니다.",
    hint: "상인이 많은 금화를 모으기 쉽고, 건축가/장군은 큰 지출 전에 금화를 들고 있을 때가 많습니다.",
  },
  MAGICIAN: {
    summary: "다른 플레이어와 손패를 맞바꾸거나, 원하는 손패를 버리고 같은 수만큼 새로 뽑습니다.",
    hint: "손패가 적거나 비싼 카드뿐이면 교체가 좋고, 상대 손패 수가 많으면 교환이 강합니다.",
  },
  KING: {
    summary: "귀족 구역 수입을 받을 수 있고 다음 라운드 캐릭터 선택을 먼저 합니다.",
    hint: "선택 순서가 중요할 때 좋습니다. 노란 구역이 많다면 수입도 챙기세요.",
  },
  BISHOP: {
    summary: "종교 구역 수입을 받을 수 있고 장군에게 도시가 보호됩니다.",
    hint: "완성 직전 도시나 비싼 구역이 있을 때 안정적인 선택입니다.",
  },
  MERCHANT: {
    summary: "상업 구역 수입을 받을 수 있고 주요 행동 후 금화 1개를 추가로 받습니다.",
    hint: "초반에는 거의 항상 안정적입니다. 싼 녹색 구역이 많을수록 수입이 커집니다.",
  },
  ARCHITECT: {
    summary: "주요 행동 후 구역 카드 2장을 더 뽑고, 이번 턴 최대 3개 구역을 건설할 수 있습니다.",
    hint: "금화가 충분하고 손패가 많을 때 폭발력이 큽니다.",
  },
  WARLORD: {
    summary: "군사 구역 수입을 받을 수 있고, 주요 행동 뒤 구역 하나를 비용을 내고 파괴할 수 있습니다.",
    hint: "완성 직전 상대를 늦추거나, 내 싼 구역을 비워 더 좋은 구역을 지을 때도 쓸 수 있습니다.",
  },
};

const districtEffectLabels = {
  HAUNTED_CITY: "최종 색상 보너스를 맞출 때 부족한 색 하나를 보완할 수 있습니다.",
  KEEP: "장군에게 파괴되지 않습니다.",
  LABORATORY: "턴마다 손패 1장을 버리고 금화 2개를 받을 수 있습니다.",
  SMITHY: "턴마다 금화 2개를 내고 구역 카드 3장을 뽑을 수 있습니다.",
  OBSERVATORY: "구역 카드 뽑기를 선택하면 3장 중 1장을 보관합니다.",
  LIBRARY: "구역 카드 뽑기를 선택하면 뽑은 카드를 모두 보관합니다.",
  GRAVEYARD: "장군이 내 구역을 파괴하면 금화 1개로 그 카드를 손패로 되돌릴 수 있습니다.",
  DRAGON_GATE: "건설 비용은 6이지만 점수 계산 때 8점입니다.",
  UNIVERSITY: "건설 비용은 6이지만 점수 계산 때 8점입니다.",
  MAGIC_SCHOOL: "색상 수입을 받을 때 현재 캐릭터 색 구역처럼 셉니다.",
  GREAT_WALL: "내 구역을 파괴하려면 장군이 금화 1개를 더 냅니다.",
  QUARRY: "같은 이름의 구역을 최대 2개까지 건설할 수 있습니다.",
};

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

const characterName = (code) => characterLabels[code] || code || "-";
const playerName = (players, seatNo) => players.find((player) => seatNoOf(player) === Number(seatNo))?.nickname || `좌석 ${seatNo}`;
const cityOf = (player) => asArray(get(player, "city", "city", []));
const handOf = (player) => asArray(get(player, "hand", "hand", []));
const charactersOf = (player) => asArray(get(player, "character_codes", "characterCodes", []));
const cardIdOf = (card) => get(card, "id", "id", "");
const cardColorOf = (card) => get(card, "color", "color", "");
const cardCostOf = (card) => Number(get(card, "cost", "cost", 0));
const cardNameOf = (card) => get(card, "name", "name", "-");
const templateCodeOf = (card) => get(card, "template_code", "templateCode", "");

const hasDistrict = (player, templateCode) => cityOf(player).some((card) => templateCodeOf(card) === templateCode);

const canBuildDuplicate = (player, card) => {
  const existing = cityOf(player).filter((item) => templateCodeOf(item) === templateCodeOf(card)).length;
  return existing === 0 || (hasDistrict(player, "QUARRY") && existing < 2);
};

const scoreValueOf = (card) => (["DRAGON_GATE", "UNIVERSITY"].includes(templateCodeOf(card)) ? 8 : cardCostOf(card));

const districtScoreOf = (city) => city.reduce((sum, card) => sum + scoreValueOf(card), 0);

const warlordDestroyCost = (targetPlayer, card) => Math.max(0, cardCostOf(card) - 1 + (hasDistrict(targetPlayer, "GREAT_WALL") ? 1 : 0));

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

const lastCitadelsEventSignal = (gameState) => {
  const events = asArray(get(gameState, "events", "events", []));
  const last = events[events.length - 1];
  return last ? `${get(last, "event_no", "eventNo", "")}-${get(last, "event_type", "eventType", "")}` : "";
};

const CitadelsCard = ({ card, selected = false, onClick, actionLabel = "" }) => {
  const color = cardColorOf(card);
  const clickable = typeof onClick === "function";
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="break-words text-sm font-black text-slate-900">{cardNameOf(card)}</div>
          <div className="mt-1 text-[11px] font-black text-slate-500">{colorLabels[color] || color}</div>
        </div>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-slate-700 shadow-sm">
          {cardCostOf(card)}
        </span>
      </div>
      {!!actionLabel && <div className="mt-3 text-[11px] font-black text-slate-500">{actionLabel}</div>}
    </>
  );

  const className = [
    "min-h-[112px] rounded-2xl border p-3 text-left shadow-sm transition",
    colorClasses[color] || "border-slate-200 bg-slate-50 text-slate-700",
    selected ? "ring-4 ring-slate-900/10" : "",
    clickable ? "hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200" : "",
  ].join(" ");

  if (!clickable) return <div className={className}>{content}</div>;
  return (
    <button type="button" className={className} onClick={onClick}>
      {content}
    </button>
  );
};

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
  const [pendingKeepIds, setPendingKeepIds] = useState([]);
  const [redrawIds, setRedrawIds] = useState([]);
  const [laboratoryCardId, setLaboratoryCardId] = useState("");

  const stompRef = useRef(null);
  const stompInitRef = useRef(null);
  const gameSubRef = useRef(null);
  const mountedRef = useRef(false);

  const myMemberId = Number(getTabletopMemberId(user) || user?.id || 0);
  const players = selectedRoom?.players || [];
  const mySeatNo = seatNoOf(players.find((player) => memberIdOf(player) === myMemberId));
  const status = roomStatusOf(selectedRoom);
  const hostMemberId = Number(selectedRoom?.hostMemberId || 0);
  const isHost = Boolean(selectedRoom && hostMemberId === myMemberId);
  const readyMemberIds = useMemo(() => new Set(players.filter(isReady).map(memberIdOf)), [players]);
  const myReady = readyMemberIds.has(myMemberId);
  const minPlayers = Number(selectedRoom?.minPlayers || 0);
  const maxPlayers = Number(selectedRoom?.maxPlayers || 0);
  const everyGuestReady = players.filter((player) => memberIdOf(player) !== hostMemberId).every(isReady);
  const canStart = isHost && status === "WAITING" && players.length >= minPlayers && players.length <= maxPlayers && everyGuestReady;

  const statePhase = get(gameState, "phase", "phase", "");
  const activeSeatNo = Number(get(gameState, "active_seat_no", "activeSeatNo", 0));
  const chooserSeatNo = Number(get(gameState, "chooser_seat_no", "chooserSeatNo", 0));
  const selectionStep = get(gameState, "selection_step", "selectionStep", "");
  const activeCharacter = get(gameState, "active_character_code", "activeCharacterCode", "");
  const pendingChoiceSeatNo = Number(get(gameState, "pending_choice_seat_no", "pendingChoiceSeatNo", 0));
  const pendingKeepCount = Number(get(gameState, "pending_keep_count", "pendingKeepCount", 0));
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
  const pendingChoices = asArray(get(gameState, "pending_district_choices", "pendingDistrictChoices", []));
  const citadelsPlayers = asArray(get(gameState, "players", "players", []));
  const events = asArray(get(gameState, "events", "events", []));
  const myCitadelsPlayer = citadelsPlayers.find((player) => Number(get(player, "seat_no", "seatNo", 0)) === mySeatNo) || null;
  const myHand = handOf(myCitadelsPlayer);
  const myCity = cityOf(myCitadelsPlayer);
  const myGold = Number(get(myCitadelsPlayer, "gold", "gold", 0));
  const isMyTurn = statePhase === "TURN_ACTION" && activeSeatNo === mySeatNo;
  const isMySelection = statePhase === "CHARACTER_SELECTION" && chooserSeatNo === mySeatNo;
  const isMyDistrictChoice = statePhase === "DISTRICT_CHOICE" && pendingChoiceSeatNo === mySeatNo;
  const isMyGraveyardChoice = statePhase === "GRAVEYARD_CHOICE" && pendingGraveyardSeatNo === mySeatNo;
  const buildLimit = activeCharacter === "ARCHITECT" ? 3 : 1;
  const afterWarlordDestruction = activeCharacter === "WARLORD" && warlordDestroyed;
  const canBuild = isMyTurn && actionTaken && builtThisTurn < buildLimit && !afterWarlordDestruction;
  const canEndTurn = isMyTurn && actionTaken && !actionBusy;
  const incomeColor = incomeColorByCharacter[activeCharacter] || "";
  const incomePreview = incomeColor
    ? myCity.filter((card) => cardColorOf(card) === incomeColor || templateCodeOf(card) === "MAGIC_SCHOOL").length
    : 0;
  const colorProgress = cityColorProgress(myCity);
  const affordableCards = myHand.filter((card) => cardCostOf(card) <= myGold).length;
  const buildableCards = myHand.filter((card) => cardCostOf(card) <= myGold && canBuildDuplicate(myCitadelsPlayer, card)).length;
  const canUseLaboratory = isMyTurn && !afterWarlordDestruction && hasDistrict(myCitadelsPlayer, "LABORATORY") && !laboratoryUsed && myHand.length > 0;
  const canUseSmithy = isMyTurn && !afterWarlordDestruction && hasDistrict(myCitadelsPlayer, "SMITHY") && !smithyUsed && myGold >= 2;
  const activeCharacterHelp = characterHelp[activeCharacter];
  const turnGuidance = (() => {
    if (statePhase === "FINISHED") return winnerSeatNo ? `${playerName(players, winnerSeatNo)}님이 승리했습니다.` : "점수 계산이 끝났습니다.";
    if (isMyGraveyardChoice) return `${cardNameOf(pendingGraveyardCard)}을 금화 1개로 손패에 되돌릴지 선택하세요.`;
    if (statePhase === "GRAVEYARD_CHOICE") return `${playerName(players, pendingGraveyardSeatNo)}님의 묘지 선택을 기다리는 중입니다.`;
    if (isMyDistrictChoice) return `${pendingKeepCount}장을 골라 손패에 넣으세요. 비싼 카드보다 지금 지을 수 있는 색상도 같이 보세요.`;
    if (statePhase === "DISTRICT_CHOICE") return `${playerName(players, pendingChoiceSeatNo)}님의 구역 카드 선택을 기다리는 중입니다.`;
    if (isMySelection) return selectionStep === "DISCARD" ? "남길 캐릭터 조합을 보고 버릴 캐릭터를 고르세요." : "이번 라운드에 먼저 쓰고 싶은 능력과 필요한 수입 색을 보고 고르세요.";
    if (statePhase === "CHARACTER_SELECTION") return `${playerName(players, chooserSeatNo)}님의 캐릭터 선택을 기다리는 중입니다.`;
    if (isMyTurn && !actionTaken) return "먼저 금화 2개 또는 구역 카드 뽑기를 선택하세요. 지을 카드가 있으면 금화, 손패가 약하면 카드를 권장합니다.";
    if (isMyTurn && afterWarlordDestruction) return "장군 파괴는 턴 끝 능력입니다. 이제 턴을 종료하세요.";
    if (isMyTurn && canBuild) return buildableCards ? `건설 가능 ${buildableCards}장입니다. 색상 보너스와 8구역 완성 타이밍을 같이 확인하세요.` : "건설 가능한 카드가 없으면 특수 구역 능력이나 턴 종료를 선택하세요.";
    if (isMyTurn) return "필요한 특수 능력을 사용한 뒤 턴을 종료하세요.";
    return `${playerName(players, activeSeatNo)}님의 ${characterName(activeCharacter)} 차례입니다.`;
  })();
  const quickFacts = [
    { label: "금화", value: `${myGold}` },
    { label: "손패", value: `${myHand.length}장` },
    { label: "건설", value: `${builtThisTurn}/${buildLimit}` },
    { label: "색상", value: colorProgress.completed ? "보너스 가능" : `${5 - colorProgress.missing.length}/5` },
  ];
  const actionSignal = lastCitadelsEventSignal(gameState);

  useGameSound({
    myTurn: isMyTurn || isMySelection || isMyDistrictChoice || isMyGraveyardChoice,
    actionSignal,
  });

  const fetchVariants = async () => {
    const list = await tabletopGameAdapter.fetchVariants(GAME_CODE);
    setVariants(list);
    if (list[0]) {
      setCreateForm((prev) => ({ ...prev, variantCode: prev.variantCode || list[0].code }));
    }
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

  const fetchMyRooms = async () => tabletopGameAdapter.fetchMyRooms(GAME_CODE);

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
          fallbackMessage: "Citadels 실시간 연결에 문제가 생겼습니다. 잠시 후 다시 시도해주세요.",
        });
      };
      client.beforeConnect = () => {
        client.connectHeaders = buildStompConnectHeaders();
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
        // fall through to snapshot reload
      }
      fetchState(roomId).catch(() => {});
    });
  };

  const openRoom = async (room) => {
    setSelectedRoom(room);
    const roomId = roomIdOf(room);
    if (!roomId) return;
    localStorage.setItem(ROOM_STORAGE_KEY, String(roomId));
    await fetchState(roomId);
    const client = await ensureSocket();
    if (client?.connected) {
      await bindRealtimeRoom(client, roomId);
    } else if (client) {
      client.onConnect = () => bindRealtimeRoom(client, roomId);
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
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const myRooms = await fetchMyRooms();
        if (!active) return;
        const storedId = Number(localStorage.getItem(ROOM_STORAGE_KEY) || 0);
        const room = myRooms.find((item) => Number(roomIdOf(item)) === storedId) || myRooms[0];
        if (room) await openRoom(room);
      } catch {
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
      notifySuccess("Citadels 방을 만들었습니다.");
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
  }, "준비 상태 변경에 실패했습니다.");

  const startGame = () => withBusy(async () => {
    await tabletopGameAdapter.startGame(GAME_CODE, roomIdOf(selectedRoom));
    await fetchState(roomIdOf(selectedRoom));
    notifySuccess("Citadels를 시작했습니다.");
  }, "인원과 준비 상태를 확인해주세요.");

  const forceFinishGame = () => withBusy(async () => {
    const roomId = roomIdOf(selectedRoom);
    const room = await tabletopGameAdapter.forceFinish(GAME_CODE, roomId);
    if (room) setSelectedRoom(room);
    await fetchRooms();
    notifySuccess("게임을 종료했습니다.");
  }, "게임 종료에 실패했습니다.");

  const rematchRoom = () => withBusy(async () => {
    const roomId = roomIdOf(selectedRoom);
    const room = await tabletopGameAdapter.rematch(GAME_CODE, roomId);
    if (room) setSelectedRoom(room);
    setGameState(null);
    await fetchRooms();
    notifySuccess("다시 하기 대기방으로 전환했습니다.");
  }, "다시 하기에 실패했습니다.");

  const leaveRoom = () => withBusy(async () => {
    const roomId = roomIdOf(selectedRoom);
    await tabletopGameAdapter.leaveRoom(GAME_CODE, roomId);
    setSelectedRoom(null);
    setGameState(null);
    localStorage.removeItem(ROOM_STORAGE_KEY);
    if (gameSubRef.current) gameSubRef.current.unsubscribe();
    await fetchRooms();
    notifySuccess("방에서 나갔습니다.");
  }, "방 나가기에 실패했습니다.");

  const sendAction = async (payload, fallbackMessage = "액션 처리에 실패했습니다.") => {
    if (!selectedRoom || actionBusy) return;
    setActionBusy(true);
    try {
      const result = await tabletopGameAdapter.sendAction(GAME_CODE, roomIdOf(selectedRoom), payload);
      if (result?.room) setSelectedRoom(result.room);
      setGameState(result?.gameState || null);
      return result;
    } catch (error) {
      notifyError(error?.response?.data?.message || fallbackMessage);
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
    const effect = districtEffectLabels[templateCodeOf(card)];
    if (canBuild) {
      if (myGold < cardCostOf(card)) return `금화 ${cardCostOf(card) - myGold}개 부족`;
      if (!canBuildDuplicate(myCitadelsPlayer, card)) return "같은 구역은 이미 있음";
      if (colorProgress.missing.includes(cardColorOf(card))) return `${colorLabels[cardColorOf(card)]} 색상 보너스에 도움`;
      return effect || "건설 가능";
    }
    if (activeCharacter === "MAGICIAN") return "마술사 교체 선택 가능";
    return effect || "";
  };

  const buildDistrict = (card) => sendAction({ actionType: "BUILD_DISTRICT", cardIds: [cardIdOf(card)] }, "구역을 건설할 수 없습니다.");
  const chooseCharacter = (code) => sendAction({ actionType: "CHOOSE_CHARACTER", pieceCode: code }, "캐릭터를 선택할 수 없습니다.");
  const discardCharacter = (code) => sendAction({ actionType: "DISCARD_CHARACTER", pieceCode: code }, "캐릭터를 버릴 수 없습니다.");
  const useLaboratory = () => sendAction({ actionType: "LABORATORY_DISCARD", cardIds: [laboratoryCardId] }, "실험실을 사용할 수 없습니다.");
  const useSmithy = () => sendAction({ actionType: "SMITHY_DRAW" }, "대장간을 사용할 수 없습니다.");
  const resolveGraveyard = (keep) => sendAction({ actionType: keep ? "GRAVEYARD_KEEP" : "GRAVEYARD_DECLINE" }, "묘지 선택을 처리할 수 없습니다.");

  return (
    <div className="animate-fade-in space-y-6">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-red-900 to-amber-600 p-[1px] shadow-2xl sm:rounded-[2rem]">
        <div className="bg-white p-5 sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            Tabletop
          </div>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-slate-900 sm:text-4xl">Citadels</h1>
          <p className="mt-3 max-w-3xl text-sm font-medium leading-relaxed text-slate-600 sm:text-base">
            비밀 캐릭터를 고르고 금화와 구역 카드를 운영해 가장 가치 있는 도시를 완성하는 공식 기본 규칙 기반 보드게임입니다.
          </p>
        </div>
      </section>

      {!selectedRoom && (
        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <form onSubmit={createRoom} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-lg">
            <div className="text-lg font-black text-slate-900">방 만들기</div>
            <div className="mt-4 space-y-3">
              <input aria-label="방 제목" className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="방 제목" value={createForm.title} onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))} />
              <select aria-label="Citadels 규칙 선택" className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" value={createForm.variantCode} onChange={(event) => setCreateForm((prev) => ({ ...prev, variantCode: event.target.value }))}>
                {variants.map((variant) => (
                  <option key={variant.code} value={variant.code}>{variant.displayName} · {variant.minPlayers}~{variant.maxPlayers}인</option>
                ))}
              </select>
              <input aria-label="턴 시간" className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" inputMode="numeric" value={createForm.turnTimeSeconds} onChange={(event) => setCreateForm((prev) => ({ ...prev, turnTimeSeconds: event.target.value.replace(/[^\d]/g, "") }))} placeholder="턴 시간(초)" />
              <button type="submit" disabled={busy} className="min-h-11 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white disabled:opacity-50">방 만들기</button>
            </div>
          </form>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between gap-3">
              <div className="text-lg font-black text-slate-900">대기 중인 방</div>
              <button type="button" onClick={() => fetchRooms().catch(() => notifyError("목록을 불러오지 못했습니다."))} className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-slate-100 px-3 text-xs font-black text-slate-700">
                <RefreshCw className="h-3.5 w-3.5" />
                새로고침
              </button>
            </div>
            <form onSubmit={joinByCode} className="mt-4 flex gap-2">
              <input aria-label="방 코드" className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase" placeholder="방 코드" value={joinCode} maxLength={8} onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
              <button type="submit" className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white">입장</button>
            </form>
            <div className="mt-4 space-y-2.5">
              {!rooms.length && <div className="rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-400">대기 중인 방이 없습니다.</div>}
              {rooms.map((room) => {
                const full = room.players.length >= Number(room.maxPlayers || 0);
                return (
                  <div key={roomIdOf(room)} className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-black text-slate-900">{room.title}</div>
                      <div className="mt-1 text-xs font-bold text-slate-500">코드 {roomCodeOf(room)} · {room.players.length}/{room.maxPlayers}인 · {room.variantName}</div>
                    </div>
                    <button type="button" disabled={busy || full} onClick={() => joinRoom(roomIdOf(room))} className="min-h-10 rounded-xl bg-slate-900 px-4 text-xs font-black text-white disabled:opacity-50">
                      {full ? "인원 가득참" : "입장하기"}
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
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-lg">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xl font-black text-slate-900">{selectedRoom.title}</div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-black text-slate-600">
                  <span className="rounded-full bg-slate-100 px-2 py-1">방 코드 {roomCodeOf(selectedRoom)}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1">{statusLabels[status] || status}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1">{selectedRoom.variantName}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1">{players.length}/{selectedRoom.maxPlayers}인</span>
                  {finalRound && <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-700">마지막 라운드</span>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {status === "WAITING" && !isHost && (
                  <button type="button" disabled={busy} onClick={toggleReady} className="min-h-10 rounded-xl bg-slate-100 px-4 text-xs font-black text-slate-700">
                    {myReady ? "준비 취소" : "준비하기"}
                  </button>
                )}
                {status === "WAITING" && isHost && (
                  <button type="button" disabled={!canStart || busy} onClick={startGame} className="min-h-10 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white disabled:opacity-50">
                    시작
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
            {status === "WAITING" && (
              <div className="mt-4 grid gap-2 md:grid-cols-3">
                {players.map((player) => {
                  const host = memberIdOf(player) === hostMemberId;
                  return (
                    <div key={memberIdOf(player)} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-2 text-sm font-black text-slate-800">
                        <span>{player.nickname}</span>
                        {host ? <Crown className="h-4 w-4 text-amber-500" /> : <CheckCircle2 className={`h-4 w-4 ${isReady(player) ? "text-emerald-500" : "text-slate-300"}`} />}
                      </div>
                      <div className="mt-1 text-[11px] font-bold text-slate-500">{host ? "방장" : isReady(player) ? "준비 완료" : "대기 중"}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {gameState && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <main className="space-y-4">
                <section className={`rounded-[1.5rem] border p-5 shadow-lg ${isMyTurn || isMySelection || isMyDistrictChoice || isMyGraveyardChoice ? "border-amber-200 bg-amber-50/60" : "border-slate-200 bg-white"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-slate-500">현재 흐름</div>
                      <div className="mt-1 text-2xl font-black text-slate-900">
                        {statePhase === "CHARACTER_SELECTION" ? `${playerName(players, chooserSeatNo)} 캐릭터 ${selectionStep === "DISCARD" ? "버림" : "선택"}` : statePhase === "DISTRICT_CHOICE" ? `${playerName(players, pendingChoiceSeatNo)} 구역 카드 선택` : statePhase === "GRAVEYARD_CHOICE" ? `${playerName(players, pendingGraveyardSeatNo)} 묘지 선택` : statePhase === "FINISHED" ? "게임 종료" : `${characterName(activeCharacter)} · ${playerName(players, activeSeatNo)} 차례`}
                      </div>
                    </div>
                    {winnerSeatNo > 0 && <div className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-black text-emerald-700">승자 {playerName(players, winnerSeatNo)}</div>}
                  </div>
                  <div className="mt-4 rounded-2xl border border-white/80 bg-white/80 p-3 shadow-sm" role="status" aria-live="polite" aria-atomic="true">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-xl bg-amber-500 p-2 text-white">
                        <Target className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-black text-amber-700">지금 할 일</div>
                        <div className="mt-0.5 text-sm font-black leading-relaxed text-slate-900">{turnGuidance}</div>
                        <div className="mt-2 grid grid-cols-4 gap-1.5">
                          {quickFacts.map((item) => (
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

                {statePhase === "CHARACTER_SELECTION" && (
                  <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-lg">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-lg font-black text-slate-900">캐릭터 선택</div>
                      <div className="text-xs font-bold text-slate-500">{isMySelection ? "내가 처리할 차례입니다." : "선택 차례를 기다리는 중입니다."}</div>
                    </div>
                    {!!faceUpRemovedCharacters.length && (
                      <div className="mb-4 rounded-2xl bg-slate-50 p-3">
                        <div className="mb-2 text-xs font-black text-slate-500">공개로 제외된 캐릭터</div>
                        <div className="flex flex-wrap gap-2">
                          {faceUpRemovedCharacters.map((card) => <span key={card.code} className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">{characterName(card.code)}</span>)}
                        </div>
                      </div>
                    )}
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {availableCharacters.map((card) => (
                        <button
                          key={card.code}
                          type="button"
                          disabled={!isMySelection || actionBusy}
                          onClick={() => (selectionStep === "DISCARD" ? discardCharacter(card.code) : chooseCharacter(card.code))}
                          className="min-h-[92px] rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <div className="text-sm font-black text-slate-900">{card.rank}. {characterName(card.code)}</div>
                          <div className="mt-1 text-xs font-bold text-slate-500">{selectionStep === "DISCARD" ? "버릴 캐릭터" : "선택할 캐릭터"}</div>
                          <div className="mt-2 hidden text-[11px] font-bold leading-relaxed text-slate-500 sm:block">
                            {characterHelp[card.code]?.summary}
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {statePhase === "DISTRICT_CHOICE" && (
                  <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-lg">
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

                {statePhase === "GRAVEYARD_CHOICE" && (
                  <section className="rounded-[1.5rem] border border-violet-100 bg-white p-5 shadow-lg">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-black text-slate-900">묘지 선택</div>
                        <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
                          {cardNameOf(pendingGraveyardCard)}을 금화 1개로 손패에 되돌릴 수 있습니다.
                        </div>
                      </div>
                      <div className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">
                        {playerName(players, pendingGraveyardSeatNo)}
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <button type="button" disabled={!isMyGraveyardChoice || actionBusy || myGold < 1} onClick={() => resolveGraveyard(true)} className="min-h-11 rounded-xl bg-violet-600 px-4 text-sm font-black text-white disabled:opacity-40">
                        금화 1개 내고 회수
                      </button>
                      <button type="button" disabled={!isMyGraveyardChoice || actionBusy} onClick={() => resolveGraveyard(false)} className="min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-black text-slate-700 disabled:opacity-40">
                        버린 카드로 두기
                      </button>
                    </div>
                  </section>
                )}

                {statePhase === "TURN_ACTION" && (
                  <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-lg">
                      <div className="mb-3 text-lg font-black text-slate-900">내 손패</div>
                      <div className="mb-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold leading-relaxed text-slate-600">
                        금화 {myGold} · 바로 지을 수 있는 카드 {buildableCards}/{myHand.length}장 · 색상 보너스 {colorProgress.completed ? "가능" : `부족: ${colorProgress.missingText}`}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {myHand.map((card) => (
                          <CitadelsCard key={cardIdOf(card)} card={card} selected={redrawIds.includes(cardIdOf(card)) || laboratoryCardId === cardIdOf(card)} onClick={activeCharacter === "MAGICIAN" && isMyTurn && !characterAbilityUsed ? () => toggleRedrawCard(cardIdOf(card)) : undefined} actionLabel={buildHintForCard(card)} />
                        ))}
                        {!myHand.length && <div className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-400">손패가 없습니다.</div>}
                      </div>
                      {canBuild && (
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          {myHand.map((card) => (
                            <button key={cardIdOf(card)} type="button" disabled={actionBusy || myGold < cardCostOf(card) || !canBuildDuplicate(myCitadelsPlayer, card)} onClick={() => buildDistrict(card)} className="min-h-10 rounded-xl bg-slate-900 px-3 text-xs font-black text-white disabled:opacity-40">
                              <span className="inline-flex items-center justify-center gap-1"><Hammer className="h-3.5 w-3.5" />{cardNameOf(card)} · {cardCostOf(card)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-lg">
                      <div className="mb-3 text-lg font-black text-slate-900">액션</div>
                      <div className="grid gap-2">
                        <button type="button" disabled={!isMyTurn || actionTaken || actionBusy} onClick={() => sendAction({ actionType: "TAKE_GOLD" })} className="min-h-12 rounded-xl bg-amber-500 px-4 py-2 text-left text-sm font-black text-white disabled:opacity-40">
                          <span className="inline-flex items-center gap-2"><Coins className="h-4 w-4" />금화 2개 받기</span>
                          <span className="mt-0.5 block text-[11px] font-bold text-white/85">현재 손패 중 {affordableCards}장을 비용만 보면 지을 수 있습니다.</span>
                        </button>
                        <button type="button" disabled={!isMyTurn || actionTaken || actionBusy} onClick={() => sendAction({ actionType: "DRAW_DISTRICTS" })} className="min-h-12 rounded-xl bg-slate-900 px-4 py-2 text-left text-sm font-black text-white disabled:opacity-40">
                          <span className="inline-flex items-center gap-2"><BookOpen className="h-4 w-4" />구역 카드 뽑기</span>
                          <span className="mt-0.5 block text-[11px] font-bold text-white/75">{hasDistrict(myCitadelsPlayer, "OBSERVATORY") ? "천문대로 3장 중 선택" : "2장 중 1장 선택"}{hasDistrict(myCitadelsPlayer, "LIBRARY") ? " · 도서관으로 더 많이 보관" : ""}</span>
                        </button>
                        {["KING", "BISHOP", "MERCHANT", "WARLORD"].includes(activeCharacter) && (
                          <button type="button" disabled={!isMyTurn || incomeTaken || afterWarlordDestruction || actionBusy} onClick={() => sendAction({ actionType: "COLLECT_COLOR_INCOME" })} className="min-h-12 rounded-xl bg-emerald-600 px-4 py-2 text-left text-sm font-black text-white disabled:opacity-40">
                            <span>색상 수입 받기 · +{incomePreview} 금화</span>
                            <span className="mt-0.5 block text-[11px] font-bold text-white/80">{colorLabels[incomeColor]} 구역과 마법학교를 셉니다.</span>
                          </button>
                        )}
                        {activeCharacter === "MAGICIAN" && (
                          <button type="button" disabled={!isMyTurn || characterAbilityUsed || actionBusy} onClick={() => sendAction({ actionType: "MAGICIAN_REDRAW", cardIds: redrawIds })} className="min-h-11 rounded-xl bg-violet-600 px-4 text-sm font-black text-white disabled:opacity-40">선택 손패 교체 · {redrawIds.length}장</button>
                        )}
                        {(hasDistrict(myCitadelsPlayer, "LABORATORY") || hasDistrict(myCitadelsPlayer, "SMITHY")) && (
                          <div className="grid gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-2">
                            {hasDistrict(myCitadelsPlayer, "LABORATORY") && (
                              <div className="grid gap-2 sm:grid-cols-[1fr_132px]">
                                <select aria-label="실험실로 버릴 카드" className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700" value={laboratoryCardId} disabled={!canUseLaboratory || actionBusy} onChange={(event) => setLaboratoryCardId(event.target.value)}>
                                  <option value="">실험실 카드 선택</option>
                                  {myHand.map((card) => <option key={cardIdOf(card)} value={cardIdOf(card)}>{cardNameOf(card)} · +2 금화</option>)}
                                </select>
                                <button type="button" disabled={!canUseLaboratory || !laboratoryCardId || actionBusy} onClick={useLaboratory} className="min-h-10 rounded-xl bg-amber-100 px-3 text-xs font-black text-amber-800 disabled:opacity-40">실험실 사용</button>
                              </div>
                            )}
                            {hasDistrict(myCitadelsPlayer, "SMITHY") && (
                              <button type="button" disabled={!canUseSmithy || actionBusy} onClick={useSmithy} className="min-h-10 rounded-xl bg-slate-800 px-3 text-xs font-black text-white disabled:opacity-40">
                                대장간 · 금화 2개로 카드 3장
                              </button>
                            )}
                          </div>
                        )}
                        <button type="button" disabled={!canEndTurn} onClick={() => sendAction({ actionType: "END_TURN" })} className="min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-black text-slate-700 disabled:opacity-40">턴 종료</button>
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
                )}

                <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-lg">
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
                            {city.map((card) => (
                              (() => {
                                const destroyCost = warlordDestroyCost(player, card);
                                const bishopProtected = characterCodes.includes("BISHOP") && murderedCharacter !== "BISHOP";
                                const destroyBlockedReason = city.length >= 8
                                  ? "완성 도시는 보호됨"
                                  : bishopProtected
                                    ? "주교 보호"
                                    : templateCodeOf(card) === "KEEP"
                                      ? "성채 보호"
                                      : myGold < destroyCost
                                        ? `금화 ${destroyCost - myGold}개 부족`
                                        : "";
                                const canDestroy = activeCharacter === "WARLORD" && isMyTurn && actionTaken && !warlordDestroyed && !destroyBlockedReason;
                                return (
                                  <div key={cardIdOf(card)} className={`rounded-xl border px-3 py-2 text-xs font-bold ${colorClasses[cardColorOf(card)] || "border-slate-200 bg-white text-slate-700"}`}>
                                    <div className="flex items-center justify-between gap-2">
                                      <span>{cardNameOf(card)}</span>
                                      <span>{cardCostOf(card)}</span>
                                    </div>
                                    {districtEffectLabels[templateCodeOf(card)] && (
                                      <div className="mt-1 hidden text-[10px] font-bold leading-relaxed opacity-80 sm:block">{districtEffectLabels[templateCodeOf(card)]}</div>
                                    )}
                                    {activeCharacter === "WARLORD" && isMyTurn && actionTaken && !warlordDestroyed && (
                                      <button type="button" disabled={!canDestroy || actionBusy} className="mt-2 min-h-8 w-full rounded-lg bg-white/80 px-2 text-[10px] font-black text-rose-700 disabled:text-slate-400 disabled:opacity-70" onClick={() => sendAction({ actionType: "WARLORD_DESTROY", targetSeatNo: seatNo, cardIds: [cardIdOf(card)] })}>
                                        {destroyBlockedReason || `파괴 비용 ${destroyCost}`}
                                      </button>
                                    )}
                                  </div>
                                );
                              })()
                            ))}
                          </div>
                          {statePhase === "FINISHED" && <div className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-700">점수 {get(player, "score", "score", 0)} · 보너스 {get(player, "bonus_score", "bonusScore", 0)}</div>}
                        </div>
                      );
                    })}
                  </div>
                </section>
              </main>

              <aside className="space-y-4">
                <section className="hidden rounded-[1.5rem] border border-amber-100 bg-white p-4 shadow-lg xl:block">
                  <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900"><Target className="h-4 w-4 text-amber-600" />플레이 도움</div>
                  <div className="space-y-2 text-xs font-bold leading-relaxed text-slate-600">
                    {activeCharacterHelp && (
                      <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2">
                        <div className="font-black text-amber-800">{characterName(activeCharacter)}</div>
                        <div className="mt-1">{activeCharacterHelp.summary}</div>
                        <div className="mt-1 text-amber-700">{activeCharacterHelp.hint}</div>
                      </div>
                    )}
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <div className="font-black text-slate-800">도시 점검</div>
                      <div className="mt-1">구역 기본점수 {districtScoreOf(myCity)}점 · 색상 보너스 {colorProgress.completed ? "가능" : `부족: ${colorProgress.missingText}`}</div>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {colorOrder.map((color) => (
                        <div key={color} className={`rounded-xl border px-2 py-1.5 text-center text-[10px] font-black ${colorProgress.colors.has(color) ? colorClasses[color] : "border-slate-100 bg-slate-50 text-slate-400"}`}>
                          {colorLabels[color]}
                        </div>
                      ))}
                    </div>
                    {murderedCharacter && (
                      <div className="rounded-xl bg-rose-50 px-3 py-2 text-rose-700">이번 라운드 암살 대상: {characterName(murderedCharacter)}</div>
                    )}
                  </div>
                </section>
                <section className="hidden rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg xl:block">
                  <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900"><Shield className="h-4 w-4" />규칙 기준</div>
                  <div className="space-y-2 text-xs font-bold leading-relaxed text-slate-500">
                    <div className="rounded-xl bg-slate-50 px-3 py-2">캐릭터는 비공개로 선택하고 1번 암살자부터 8번 장군까지 순서대로 호출됩니다.</div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">차례에는 금화 2개 또는 구역 카드 뽑기 중 하나를 선택한 뒤 구역을 건설할 수 있습니다.</div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">누군가 8번째 구역을 건설하면 현재 라운드까지만 진행하고 점수를 계산합니다.</div>
                  </div>
                </section>
                <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
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
                  </div>
                </section>
              </aside>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default CitadelsGame;
