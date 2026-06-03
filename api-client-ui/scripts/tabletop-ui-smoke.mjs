import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost";
const chromePath = process.env.CHROME_PATH || [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((candidate) => existsSync(candidate));

if (!chromePath) {
  throw new Error("Chrome or Edge executable was not found. Set CHROME_PATH to run this smoke test.");
}

const debug = process.env.SMOKE_DEBUG === "1";
const userDataDir = mkdtempSync(path.join(tmpdir(), "tabletop-ui-smoke-"));
const viewports = [
  { name: "desktop", width: 1366, height: 900, mobile: false },
  { name: "tablet", width: 820, height: 1180, mobile: true },
  { name: "mobile", width: 390, height: 844, mobile: true },
];
const cases = [
  {
    path: "/app/games",
    label: "game hub",
    expectedTexts: ["게임 목록", "카탄", "블로커스", "마헤", "달무티", "마피아", "시티델"],
  },
  {
    path: "/app/games/catan",
    label: "catan lobby",
    expectedTexts: ["카탄", "방 만들기", "입장", "본게임", "5-6인 확장"],
  },
  {
    path: "/app/games/blokus",
    label: "blokus lobby",
    expectedTexts: ["블로커스", "방 만들기", "입장", "본게임", "듀오"],
  },
  {
    path: "/app/games/mahe",
    label: "mahe lobby",
    expectedTexts: ["마헤", "방 만들기", "입장", "본게임", "거북이 업기"],
  },
  {
    path: "/app/games/dalmuti",
    label: "dalmuti lobby",
    expectedTexts: ["달무티", "방 만들기", "입장", "본게임", "첫 손 세금 없음"],
  },
  {
    path: "/app/games/six-nimmt",
    label: "six nimmt lobby",
    expectedTexts: ["6 nimmt!", "방 만들기", "입장", "본게임", "벌점"],
  },
  {
    path: "/app/games/telestrations",
    label: "telestrations prompt room",
    expectedTexts: ["텔레스트레이션", "방 코드", "시작 문장", "내 비밀 시작 문장을 입력하세요.", "진행 현황"],
  },
  {
    path: "/app/games/telestrations",
    label: "telestrations guess image room",
    telestrationsPhase: "GUESS",
    expectedTexts: ["텔레스트레이션", "문장 추측", "보고 추측할 그림", "그림만 보고 떠오르는 문장을 적으세요"],
    assertTelestrationsImage: true,
  },
  {
    path: "/app/games/mafia",
    label: "mafia lobby",
    expectedTexts: ["마피아", "방 만들기", "입장", "경찰+의사", "특수직 없음", "5~6명 1명"],
  },
  {
    path: "/app/games/citadels",
    label: "citadels lobby",
    expectedTexts: ["시티델", "방 만들기", "입장", "본게임", "비밀 캐릭터"],
  },
  {
    path: "/app/poker",
    label: "poker lobby",
    expectedTexts: ["포커", "방 만들기", "입장", "텍사스 홀덤", "5장 드로우"],
  },
  {
    path: "/app/games/no-thanks",
    label: "no thanks lobby",
    expectedTexts: ["노땡스", "방 만들기", "입장", "토큰 개수", "대기 중인 방"],
  },
  {
    path: "/app/games/las-vegas",
    label: "las vegas active",
    expectedTexts: ["공개 굴림", "직전 배팅 위치", "검증 사용자님이 Bellagio에 주사위 2개를 배팅했습니다."],
  },
];

const variantsByGame = {
  catan: [
    variant("BASE", "본게임", false, 3, 4, "기본 섬과 10점 목표", ["3~4인", "승점 10점", "기본 섬"]),
    variant("FIVE_SIX", "5-6인 확장", true, 5, 6, "추가 인원용 공식 확장", ["5~6인", "카타니안 1/2", "확장 보드"]),
  ],
  blokus: [
    variant("BASE", "본게임", false, 4, 4, "20x20 보드와 네 색 조각", ["4인", "20x20", "모서리 연결"]),
    variant("DUO", "듀오", true, 2, 2, "14x14 2인 전용 규칙", ["14x14", "2인 전용", "중앙 시작점"]),
    variant("TWO_PLAYER", "2인 변형", false, 2, 2, "두 명이 두 색씩 조종", ["2인", "두 색 조종", "점수 합산"]),
    variant("THREE_PLAYER", "3인 변형", false, 3, 3, "남는 색을 번갈아 배치", ["3인", "공유 초록", "순환 조종"]),
    variant("TEAM", "2대2 팀전", false, 4, 4, "마주 보는 색의 점수 합산", ["2대2", "팀 점수", "마주 보는 색"]),
  ],
  mahe: [
    variant("BASE", "본게임", false, 2, 7, "거북이 업기와 알 카드 점수", ["2~7인", "거북이 업기", "알 카드"]),
  ],
  dalmuti: [
    variant("BASE", "본게임", false, 4, 8, "계급 카드와 세금", ["4~8인", "세금", "혁명"]),
    variant("STRIPPED_DECK", "줄인 덱", true, 4, 5, "4~5인 공식 선택 규칙", ["4~5인", "일부 계급 제외", "빠른 패"]),
    variant("FIRST_DEAL_REVOLUTION", "첫 손 세금 없음", true, 4, 8, "첫 판 혁명 선택 규칙", ["첫 손 세금 없음", "혁명 선택", "공식 선택 규칙"]),
  ],
  "six-nimmt": [
    variant("BASE", "본게임", false, 2, 10, "숫자 카드를 행에 붙이고 벌점을 피하는 공식 규칙", ["2~10인", "6번째 회수", "66벌점"]),
  ],
  telestrations: [
    variant("BASE", "본게임", false, 3, 8, "문장과 그림을 번갈아 넘기는 파티 게임", ["3~8인", "그림 릴레이", "리플레이 공개"]),
  ],
  mafia: [
    variant("BASE", "경찰+의사", false, 5, 12, "마피아, 경찰, 의사가 모두 들어가는 사회자 진행형 마피아", ["5~12인", "경찰", "의사"]),
    variant("POLICE_ONLY", "경찰만", false, 5, 12, "경찰은 있고 의사는 없는 빠른 추리 규칙", ["5~12인", "경찰 포함", "의사 제외"]),
    variant("DOCTOR_ONLY", "의사만", false, 5, 12, "의사는 있고 경찰은 없는 심리전 규칙", ["5~12인", "의사 포함", "경찰 제외"]),
    variant("NO_SPECIALS", "특수직 없음", false, 5, 12, "마피아와 시민만으로 진행하는 단순 규칙", ["5~12인", "마피아", "시민"]),
  ],
  poker: [
    variant("TEXAS_HOLDEM", "텍사스 홀덤", false, 2, 8, "홀카드 2장과 공용 카드 5장으로 가장 강한 5장 족보를 만듭니다.", ["2~8인", "블라인드", "족보 보조"]),
    variant("FIVE_CARD_DRAW", "5장 드로우", false, 2, 6, "손패 5장을 받고 한 번 교체한 뒤 족보를 비교합니다.", ["2~6인", "최대 3장 교체", "공식 룰"]),
  ],
  citadels: [
    variant("BASE", "본게임", false, 2, 7, "기본 8개 캐릭터와 8구역 종료 조건", ["2~7인", "비밀 캐릭터", "도시 건설"]),
  ],
};

const variantCreateCases = [
  { game: "catan", variantCode: "FIVE_SIX" },
  { game: "blokus", variantCode: "DUO" },
  { game: "blokus", variantCode: "TWO_PLAYER" },
  { game: "blokus", variantCode: "THREE_PLAYER" },
  { game: "blokus", variantCode: "TEAM" },
  { game: "dalmuti", variantCode: "STRIPPED_DECK" },
  { game: "dalmuti", variantCode: "FIRST_DEAL_REVOLUTION" },
  { game: "mafia", variantCode: "POLICE_ONLY" },
  { game: "mafia", variantCode: "DOCTOR_ONLY" },
  { game: "mafia", variantCode: "NO_SPECIALS" },
];

const mockState = {
  nextRoomId: 1000,
  activeRoomsByGame: new Map(),
  requests: [],
  telestrationsPhase: "PROMPT",
};

const TELESTRATIONS_SMOKE_IMAGE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420">
  <rect width="640" height="420" fill="#fff7ed"/>
  <circle cx="188" cy="172" r="78" fill="#38bdf8" stroke="#0f172a" stroke-width="10"/>
  <rect x="308" y="110" width="176" height="154" rx="28" fill="#facc15" stroke="#0f172a" stroke-width="10"/>
  <path d="M145 302c82-66 202-68 308-4" fill="none" stroke="#16a34a" stroke-width="20" stroke-linecap="round"/>
  <path d="M426 85l55-42 9 68 65 16-60 30 5 70-49-51-69 22 33-61z" fill="#fb7185" stroke="#0f172a" stroke-width="8" stroke-linejoin="round"/>
</svg>`)}`;

function assertTabletopRealtimeSource() {
  const source = readFileSync("src/pages/games/TabletopGame.jsx", "utf8");
  const requiredSnippets = [
    ["realtimeRoomRef.current = { roomId, roomSeq }", "tracks the latest opened realtime room"],
    ["client.onConnect = () => {", "binds after STOMP CONNECT"],
    ["bindLatestRealtimeRoom(client)", "resubscribes the latest room after reconnect"],
    ["createStompClient", "loads the STOMP runtime through the shared async adapter"],
    ["notifyRealtimeError", "routes STOMP ERROR frames through the shared safe notifier"],
    ["client.beforeConnect = () =>", "refreshes STOMP auth headers before reconnect"],
    ["await fetchState(roomId, roomSeq).catch", "loads a REST snapshot before relying on realtime"],
    ["client.subscribe(`/sub/game/${game}/room/${roomId}`", "subscribes to the active tabletop room topic"],
    ['game === "telestrations") && payload.gameState', "refetches viewer-specific Telestrations state after realtime broadcasts"],
  ];
  for (const [snippet, description] of requiredSnippets) {
    if (!source.includes(snippet)) {
      throw new Error(`tabletop-ui-smoke: TabletopGame realtime source must ${description}.`);
    }
  }
  const sixNimmtRealtimeBranch = source.match(/if \(game === "six-nimmt" && payload\.gameState\) \{([\s\S]*?)\} else if/);
  if (!sixNimmtRealtimeBranch || !sixNimmtRealtimeBranch[1].includes("mergeSixNimmtRealtimeState")) {
    throw new Error("tabletop-ui-smoke: Six Nimmt realtime must merge public selection updates immediately.");
  }
  if (sixNimmtRealtimeBranch[1].includes("fetchState(")) {
    throw new Error("tabletop-ui-smoke: Six Nimmt realtime must not immediately refetch stale REST state after a public selection update.");
  }
  if (!source.includes('if (game === "six-nimmt" && result?.gameState)')) {
    throw new Error("tabletop-ui-smoke: Six Nimmt actions must merge the viewer-specific action response.");
  }
  if (source.includes("else client.onConnect = () =>")) {
    throw new Error("tabletop-ui-smoke: openRoom must not overwrite STOMP onConnect per room.");
  }
  if (source.includes('import SockJS from "sockjs-client"') || source.includes('import { Client } from "@stomp/stompjs"')) {
    throw new Error("tabletop-ui-smoke: TabletopGame must not statically bundle the STOMP runtime into the board-game route chunk.");
  }
  if (source.includes('notifyError("실시간 연결 오류")')) {
    throw new Error("tabletop-ui-smoke: TabletopGame must not show raw repeated realtime error toasts.");
  }
  if (source.includes('from "react-hot-toast"') || !source.includes('from "../../utils/toast.js"')) {
    throw new Error("tabletop-ui-smoke: TabletopGame must use the dynamic toast helper instead of static react-hot-toast imports.");
  }
}

function assertActionToastSingleton() {
  const toastSource = readFileSync("src/utils/toast.js", "utf8");
  const requiredSnippets = [
    "const DEFAULT_TOAST_ID = \"app-action-toast\"",
    "const singleToastOptions = (options) => ({",
    "id: options?.id || DEFAULT_TOAST_ID",
    "toast.success(message, singleToastOptions(options))",
    "toast.error(message, singleToastOptions(options))",
    "toast(message, singleToastOptions(options))",
  ];
  const missing = requiredSnippets.filter((snippet) => !toastSource.includes(snippet));
  if (missing.length) {
    throw new Error(`tabletop-ui-smoke: action toasts must replace the same bottom-left slot instead of stacking: ${missing.join(", ")}`);
  }
}

class PipeCdp {
  constructor(chrome) {
    this.chrome = chrome;
    this.nextMessageId = 1;
    this.buffer = Buffer.alloc(0);
    this.pending = new Map();
    this.messageHandlers = [];
    this.sessionId = null;

    chrome.stdio[4].on("data", (chunk) => this.handleData(chunk));
    chrome.once("exit", (code) => {
      const error = new Error(`Chrome exited before CDP command completed${code === null ? "" : `: ${code}`}`);
      for (const waiter of this.pending.values()) {
        clearTimeout(waiter.timeoutId);
        waiter.reject(error);
      }
      this.pending.clear();
    });
  }

  onMessage(handler) {
    this.messageHandlers.push(handler);
  }

  send(method, params = {}, sessionId = null, timeoutMs = 10000) {
    const id = this.nextMessageId++;
    const message = sessionId ? { id, method, params, sessionId } : { id, method, params };
    if (debug) console.log("cdp send", id, method, sessionId || "browser");
    this.chrome.stdio[3].write(`${JSON.stringify(message)}\0`);
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method}: timed out waiting for Chrome DevTools response`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, method, timeoutId });
    });
  }

  handleData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    let frameEnd = this.buffer.indexOf(0);
    while (frameEnd !== -1) {
      const raw = this.buffer.subarray(0, frameEnd).toString("utf8");
      this.buffer = this.buffer.subarray(frameEnd + 1);
      frameEnd = this.buffer.indexOf(0);
      if (!raw) continue;

      const message = JSON.parse(raw);
      if (debug) console.log("cdp recv", message.id || message.method, message.sessionId || "browser");
      if (message.id && this.pending.has(message.id)) {
        const waiter = this.pending.get(message.id);
        this.pending.delete(message.id);
        clearTimeout(waiter.timeoutId);
        if (message.error) {
          waiter.reject(new Error(`${waiter.method}: ${message.error.message}`));
        } else {
          waiter.resolve(message);
        }
        continue;
      }
      for (const handler of this.messageHandlers) {
        handler(message);
      }
    }
  }
}
const gameNames = {
  catan: "카탄",
  blokus: "블로커스",
  mahe: "마헤",
  dalmuti: "달무티",
  "six-nimmt": "식스님트",
  telestrations: "텔레스트레이션",
  mafia: "마피아",
  poker: "포커",
  citadels: "시티델",
  "las-vegas": "라스베가스",
};
const gameCodePrefix = {
  catan: "CATN",
  blokus: "BLOK",
  mahe: "MAHE",
  dalmuti: "DALM",
  "six-nimmt": "SIXN",
  telestrations: "TELE",
  mafia: "MAFI",
  poker: "POKR",
  citadels: "CITD",
};

function variant(code, displayName, expansion, minPlayers, maxPlayers, summary, featureTags) {
  return {
    code,
    displayName,
    display_name: displayName,
    expansion,
    minPlayers,
    min_players: minPlayers,
    maxPlayers,
    max_players: maxPlayers,
    summary,
    featureTags,
    feature_tags: featureTags,
  };
}

function parseJson(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function formatRuntimeException(details = {}) {
  const exception = details.exception || {};
  return [
    details.text,
    exception.description,
    exception.value,
  ].filter(Boolean).join(": ");
}

function formatConsoleArgs(args = []) {
  return args
    .map((arg) => {
      if (arg.value !== undefined) return typeof arg.value === "string" ? arg.value : JSON.stringify(arg.value);
      if (arg.description) return arg.description;
      if (arg.preview?.properties?.length) {
        return `{${arg.preview.properties.map((property) => `${property.name}:${property.value}`).join(",")}}`;
      }
      return arg.type || "";
    })
    .filter(Boolean)
    .join(" ");
}

function player(memberId, seatNo, ready, nickname = `검증 ${seatNo}`) {
  return {
    memberId,
    member_id: memberId,
    nickname,
    seatNo,
    seat_no: seatNo,
    ready,
  };
}

function roomFor(game, role, roomStatus = "WAITING") {
  const selectedVariant = variantsByGame[game][0];
  const roomId = ++mockState.nextRoomId;
  const minPlayers = Number(selectedVariant.minPlayers || selectedVariant.min_players || 2);
  const maxPlayers = Number(selectedVariant.maxPlayers || selectedVariant.max_players || minPlayers);
  const hostMemberId = role === "host" ? 999 : 700 + roomId;
  const code = `${gameCodePrefix[game]}${String(roomId).slice(-4)}`.slice(0, 8).toUpperCase();
  const players = [];
  for (let seatNo = 1; seatNo <= minPlayers; seatNo++) {
    if (seatNo === 1) {
      players.push(player(hostMemberId, seatNo, false, role === "host" ? "검증 사용자" : "상대 방장"));
    } else if (role === "guest" && seatNo === 2) {
      players.push(player(999, seatNo, false, "검증 사용자"));
    } else {
      players.push(player(800 + roomId + seatNo, seatNo, true, `준비 게스트 ${seatNo}`));
    }
  }
  if (role === "guest" && !players.some((item) => item.memberId === 999)) {
    players.push(player(999, players.length + 1, false, "검증 사용자"));
  }
  return {
    roomId,
    room_id: roomId,
    gameCode: game,
    game_code: game,
    gameName: gameNames[game],
    game_name: gameNames[game],
    variantCode: selectedVariant.code,
    variant_code: selectedVariant.code,
    variantName: selectedVariant.displayName,
    variant_name: selectedVariant.displayName,
    variantSummary: selectedVariant.summary,
    variant_summary: selectedVariant.summary,
    variantFeatureTags: selectedVariant.featureTags,
    variant_feature_tags: selectedVariant.featureTags,
    roomCode: code,
    room_code: code,
    title: `${gameNames[game]} 스모크 방`,
    roomStatus,
    room_status: roomStatus,
    hostMemberId,
    host_member_id: hostMemberId,
    chatRoomId: 9000 + roomId,
    chat_room_id: 9000 + roomId,
    minPlayers,
    min_players: minPlayers,
    maxPlayers,
    max_players: maxPlayers,
    turnTimeSeconds: 30,
    turn_time_seconds: 30,
    players,
  };
}

const catanResourceBank = {
  BRICK: 19,
  LUMBER: 19,
  WOOL: 19,
  GRAIN: 19,
  ORE: 19,
};

const catanEmptyResources = {
  BRICK: 0,
  LUMBER: 0,
  WOOL: 0,
  GRAIN: 0,
  ORE: 0,
};

const catanEmptyCommodities = {
  PAPER: 0,
  CLOTH: 0,
  COIN: 0,
};

function catanSmokePlayer(roomPlayer, index) {
  const seatNo = Number(roomPlayer?.seatNo || roomPlayer?.seat_no || index + 1);
  const color = ["RED", "BLUE", "WHITE", "ORANGE", "GREEN", "BROWN"][seatNo - 1] || "RED";
  return {
    seatNo,
    seat_no: seatNo,
    color,
    resources: { ...catanEmptyResources },
    commodities: { ...catanEmptyCommodities },
    cityImprovements: { SCIENCE: 0, TRADE: 0, POLITICS: 0 },
    city_improvements: { SCIENCE: 0, TRADE: 0, POLITICS: 0 },
    metropolisTypes: [],
    metropolis_types: [],
    developmentCards: [],
    development_cards: [],
    progressCards: [],
    progress_cards: [],
    fishermenTokens: [],
    fishermen_tokens: [],
    victoryPoints: 0,
    victory_points: 0,
    publicVictoryPoints: 0,
    public_victory_points: 0,
    resourceCount: 0,
    resource_count: 0,
    commodityCount: 0,
    commodity_count: 0,
  };
}

function catanSmokeGameState(room) {
  const players = (room.players || []).map(catanSmokePlayer);
  return {
    game: "CATAN",
    variantCode: room.variantCode || room.variant_code || "BASE",
    variant_code: room.variantCode || room.variant_code || "BASE",
    phase: "ROLL",
    activeSeatNo: 1,
    active_seat_no: 1,
    playerCount: players.length,
    player_count: players.length,
    winningPoints: 10,
    winning_points: 10,
    turnNo: 1,
    turn_no: 1,
    pairedTurnRule: false,
    paired_turn_rule: false,
    seafarersRule: false,
    seafarers_rule: false,
    citiesKnightsRule: false,
    cities_knights_rule: false,
    tradersBarbariansRule: false,
    traders_barbarians_rule: false,
    fishermenRule: false,
    fishermen_rule: false,
    riversRule: false,
    rivers_rule: false,
    caravansRule: false,
    caravans_rule: false,
    barbarianAttackRule: false,
    barbarian_attack_rule: false,
    explorersPiratesRule: false,
    explorers_pirates_rule: false,
    friendlyRobberRule: false,
    friendly_robber_rule: false,
    seafarersScenarioCode: "",
    seafarers_scenario_code: "",
    robberHexId: 0,
    robber_hex_id: 0,
    pirateHexId: 0,
    pirate_hex_id: 0,
    barbarianTrackLength: 7,
    barbarian_track_length: 7,
    hexes: [],
    vertices: [],
    edges: [],
    ports: [],
    fishingGrounds: [],
    fishing_grounds: [],
    clothVillages: [],
    cloth_villages: [],
    players,
    resourceBank: { ...catanResourceBank },
    resource_bank: { ...catanResourceBank },
    dice: [],
    events: [],
    pendingDiscardSeatNos: [],
    pending_discard_seat_nos: [],
    pendingProgressDiscardSeatNos: [],
    pending_progress_discard_seat_nos: [],
    pendingDefenderProgressSeatNos: [],
    pending_defender_progress_seat_nos: [],
    pendingGoldChoices: [],
    pending_gold_choices: [],
    pendingAqueductChoices: [],
    pending_aqueduct_choices: [],
    pendingDomesticTrade: null,
    pending_domestic_trade: null,
  };
}

function blokusSmokeGameState(room) {
  return {
    game: "BLOKUS",
    variantCode: room.variantCode || room.variant_code || "BASE",
    variant_code: room.variantCode || room.variant_code || "BASE",
    phase: "PLAYING",
    boardSize: 20,
    board_size: 20,
    currentColor: "BLUE",
    current_color: "BLUE",
    currentSeatNo: 1,
    current_seat_no: 1,
    board: [],
    startPoints: [{ x: 0, y: 0, color: "BLUE" }],
    start_points: [{ x: 0, y: 0, color: "BLUE" }],
    pieces: [
      { code: "I1", name: "1칸", size: 1, cells: [{ x: 0, y: 0 }] },
      { code: "I2", name: "2칸", size: 2, cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
    ],
    colors: [
      {
        color: "BLUE",
        label: "파랑",
        ownerSeatNo: 1,
        owner_seat_no: 1,
        remainingPieceCodes: ["I1", "I2"],
        remaining_piece_codes: ["I1", "I2"],
        shared: false,
        controllerSeatNos: [1],
        controller_seat_nos: [1],
        score: -3,
      },
    ],
    scores: [
      { scoreKey: "SEAT_1", score_key: "SEAT_1", label: "검증 사용자", colors: ["BLUE"], score: -3, winner: false },
    ],
    moveHistory: [],
    move_history: [],
  };
}

function maheSmokeGameState() {
  return {
    game: "MAHE",
    variantName: "본게임",
    variant_name: "본게임",
    phase: "ROLLING",
    trackSize: 21,
    track_size: 21,
    activeSeatNo: 1,
    active_seat_no: 1,
    decisionSeatNo: 0,
    decision_seat_no: 0,
    currentEgg: 4,
    current_egg: 4,
    dice: [2],
    diceSum: 2,
    dice_sum: 2,
    finalEggRound: false,
    final_egg_round: false,
    eggDeck: [3, 5, 7],
    egg_deck: [3, 5, 7],
    turtles: [
      { seatNo: 1, seat_no: 1, position: 0 },
      { seatNo: 2, seat_no: 2, position: 0 },
    ],
    stacks: [
      { position: 0, seatNos: [1, 2], seat_nos: [1, 2] },
    ],
    scores: [
      { seatNo: 1, seat_no: 1, score: 0, cards: [], winner: false },
      { seatNo: 2, seat_no: 2, score: 0, cards: [], winner: false },
    ],
    moveHistory: [],
    move_history: [],
  };
}

function sixNimmtCard(value) {
  const bulls = value === 55 ? 7 : value % 11 === 0 ? 5 : value % 10 === 5 ? 2 : 1;
  return { id: `C${value}`, value, bulls };
}

function sixNimmtSmokeGameState() {
  return {
    game: "SIX_NIMMT",
    variantCode: "BASE",
    variant_code: "BASE",
    phase: "SELECTING",
    roundNo: 1,
    round_no: 1,
    turnNo: 1,
    turn_no: 1,
    activeSeatNo: 0,
    active_seat_no: 0,
    pendingCard: null,
    pending_card: null,
    selectedSeatNos: [2],
    selected_seat_nos: [2],
    rows: [
      { cards: [sixNimmtCard(12), sixNimmtCard(18)] },
      { cards: [sixNimmtCard(29), sixNimmtCard(35), sixNimmtCard(42)] },
      { cards: [sixNimmtCard(51)] },
      { cards: [sixNimmtCard(72), sixNimmtCard(88)] },
    ],
    players: [
      {
        seatNo: 1,
        seat_no: 1,
        hand: [8, 24, 37, 55, 63, 77, 91, 99, 103, 104].map(sixNimmtCard),
        selected: false,
        totalPenalty: 0,
        total_penalty: 0,
        roundPenalty: 0,
        round_penalty: 0,
        handCount: 10,
        hand_count: 10,
      },
      {
        seatNo: 2,
        seat_no: 2,
        hand: [],
        selected: true,
        totalPenalty: 3,
        total_penalty: 3,
        roundPenalty: 3,
        round_penalty: 3,
        handCount: 9,
        hand_count: 9,
      },
    ],
    events: [
      { eventNo: 1, event_no: 1, eventType: "ROUND_STARTED", event_type: "ROUND_STARTED", seatNo: 0, seat_no: 0 },
    ],
  };
}

function pokerCard(rank, suit, value) {
  return { id: `${rank}${suit.slice(0, 1)}`, rank, suit, value };
}

function pokerSmokeGameState() {
  return {
    game: "POKER",
    variantCode: "TEXAS_HOLDEM",
    variant_code: "TEXAS_HOLDEM",
    variantName: "텍사스 홀덤",
    variant_name: "텍사스 홀덤",
    mode: "TEXAS_HOLDEM",
    phase: "FLOP",
    handNo: 1,
    hand_no: 1,
    maxHands: 8,
    max_hands: 8,
    activeSeatNo: 1,
    active_seat_no: 1,
    dealerSeatNo: 1,
    dealer_seat_no: 1,
    smallBlind: 5,
    small_blind: 5,
    bigBlind: 10,
    big_blind: 10,
    fixedBet: 10,
    fixed_bet: 10,
    ante: 0,
    pot: 35,
    lastPot: 0,
    last_pot: 0,
    callAmount: 10,
    call_amount: 10,
    maxDrawCards: 3,
    max_draw_cards: 3,
    winnerSeatNo: 0,
    winner_seat_no: 0,
    availableActions: ["FOLD", "CALL", "RAISE", "ALL_IN"],
    available_actions: ["FOLD", "CALL", "RAISE", "ALL_IN"],
    communityCards: [
      pokerCard("A", "SPADES", 14),
      pokerCard("7", "CLUBS", 7),
      pokerCard("K", "DIAMONDS", 13),
    ],
    community_cards: [
      pokerCard("A", "SPADES", 14),
      pokerCard("7", "CLUBS", 7),
      pokerCard("K", "DIAMONDS", 13),
    ],
    players: [
      {
        seatNo: 1,
        seat_no: 1,
        name: "검증 사용자",
        bot: false,
        chips: 980,
        currentBet: 10,
        current_bet: 10,
        folded: false,
        allIn: false,
        all_in: false,
        holeCards: [pokerCard("A", "HEARTS", 14), pokerCard("Q", "SPADES", 12)],
        hole_cards: [pokerCard("A", "HEARTS", 14), pokerCard("Q", "SPADES", 12)],
      },
      {
        seatNo: 2,
        seat_no: 2,
        name: "AI 2",
        bot: true,
        chips: 970,
        currentBet: 20,
        current_bet: 20,
        folded: false,
        allIn: false,
        all_in: false,
        holeCards: [],
        hole_cards: [],
      },
    ],
    events: [
      { eventNo: 1, event_no: 1, message: "플롭이 공개되었습니다.", eventType: "FLOP", event_type: "FLOP" },
    ],
  };
}

function mafiaSmokeGameState(room = roomFor("mafia", "host", "PLAYING")) {
  const phaseEndsAt = Date.now() + 30000;
  return {
    game: "MAFIA",
    variantCode: "BASE",
    variant_code: "BASE",
    variantName: "경찰+의사",
    variant_name: "경찰+의사",
    playerCount: 5,
    player_count: 5,
    mafiaCount: 1,
    mafia_count: 1,
    alivePlayerCount: 5,
    alive_player_count: 5,
    aliveMafiaCount: 1,
    alive_mafia_count: 1,
    aliveTownCount: 4,
    alive_town_count: 4,
    roundNo: 1,
    round_no: 1,
    phase: "NIGHT_MAFIA",
    phaseStartedAt: Date.now() - 3000,
    phase_started_at: Date.now() - 3000,
    phaseEndsAt,
    phase_ends_at: phaseEndsAt,
    phaseDurationSeconds: 30,
    phase_duration_seconds: 30,
    turnSeconds: 30,
    turn_seconds: 30,
    policeEnabled: true,
    police_enabled: true,
    doctorEnabled: true,
    doctor_enabled: true,
    narratorLine: "1번째 밤입니다. 마피아는 제거할 대상을 고르세요.",
    narrator_line: "1번째 밤입니다. 마피아는 제거할 대상을 고르세요.",
    viewerSeatNo: 1,
    viewer_seat_no: 1,
    myRole: "MAFIA",
    my_role: "MAFIA",
    myTeam: "MAFIA",
    my_team: "MAFIA",
    myAlive: true,
    my_alive: true,
    mySubmitted: false,
    my_submitted: false,
    myTask: "마피아 대상을 선택하세요. 마피아끼리 같은 사람을 고르면 성공합니다.",
    my_task: "마피아 대상을 선택하세요. 마피아끼리 같은 사람을 고르면 성공합니다.",
    availableActions: ["MAFIA_KILL"],
    available_actions: ["MAFIA_KILL"],
    mafiaSeatNos: [1],
    mafia_seat_nos: [1],
    completedSeatNos: [],
    completed_seat_nos: [],
    votedSeatNos: [],
    voted_seat_nos: [],
    players: [
      { seatNo: 1, seat_no: 1, role: "MAFIA", team: "MAFIA", alive: true },
      { seatNo: 2, seat_no: 2, role: "", team: "", alive: true },
      { seatNo: 3, seat_no: 3, role: "", team: "", alive: true },
      { seatNo: 4, seat_no: 4, role: "", team: "", alive: true },
      { seatNo: 5, seat_no: 5, role: "", team: "", alive: true },
    ].slice(0, Math.max(5, room.players?.length || 5)),
    events: [
      {
        eventNo: 1,
        event_no: 1,
        eventType: "PHASE_NIGHT_MAFIA",
        event_type: "PHASE_NIGHT_MAFIA",
        seatNo: 0,
        seat_no: 0,
        message: "1번째 밤입니다. 마피아는 제거할 대상을 고르세요.",
      },
    ],
  };
}

function telestrationsSmokeRoom() {
  return {
    roomId: 32,
    room_id: 32,
    gameCode: "telestrations",
    game_code: "telestrations",
    gameName: "텔레스트레이션",
    game_name: "텔레스트레이션",
    variantCode: "BASE",
    variant_code: "BASE",
    variantName: "본게임",
    variant_name: "본게임",
    variantSummary: "문장과 그림을 번갈아 넘기는 파티 게임",
    variant_summary: "문장과 그림을 번갈아 넘기는 파티 게임",
    variantFeatureTags: ["3~8인", "그림 릴레이", "리플레이 공개"],
    variant_feature_tags: ["3~8인", "그림 릴레이", "리플레이 공개"],
    roomCode: "TELE0032",
    room_code: "TELE0032",
    title: "텔레스트레이션 스모크 방",
    roomStatus: "PLAYING",
    room_status: "PLAYING",
    hostMemberId: 999,
    host_member_id: 999,
    chatRoomId: 9032,
    chat_room_id: 9032,
    minPlayers: 3,
    min_players: 3,
    maxPlayers: 8,
    max_players: 8,
    turnTimeSeconds: 30,
    turn_time_seconds: 30,
    players: [
      player(999, 1, false, "검증 사용자"),
      player(126, 2, true, "준비 게스트 2"),
      player(4, 3, true, "준비 게스트 3"),
    ],
  };
}

function telestrationsSmokeGameState(phase = mockState.telestrationsPhase || "PROMPT") {
  const normalizedPhase = String(phase || "PROMPT").toUpperCase();
  const promptEntry = {
    type: "PROMPT",
    stepNo: 0,
    step_no: 0,
    authorSeatNo: 1,
    author_seat_no: 1,
    text: "달 위에서 라면을 먹는 탐험가",
  };
  const drawingEntry = {
    type: "DRAW",
    stepNo: 1,
    step_no: 1,
    authorSeatNo: 2,
    author_seat_no: 2,
    imageData: TELESTRATIONS_SMOKE_IMAGE,
    image_data: TELESTRATIONS_SMOKE_IMAGE,
  };
  const guessEntry = {
    type: "GUESS",
    stepNo: 2,
    step_no: 2,
    authorSeatNo: 3,
    author_seat_no: 3,
    text: "달에서 점심을 먹는 우주비행사",
  };
  const activeEntries = normalizedPhase === "PROMPT"
    ? []
    : normalizedPhase === "DRAW"
      ? [promptEntry]
      : [promptEntry, drawingEntry];
  const revealEntries = [promptEntry, drawingEntry, guessEntry];
  const books = normalizedPhase === "REVEAL"
    ? [
        { ownerSeatNo: 1, owner_seat_no: 1, entries: revealEntries },
        { ownerSeatNo: 2, owner_seat_no: 2, entries: revealEntries },
        { ownerSeatNo: 3, owner_seat_no: 3, entries: revealEntries },
      ]
    : [
        { ownerSeatNo: 1, owner_seat_no: 1, entries: activeEntries },
        { ownerSeatNo: 2, owner_seat_no: 2, entries: [] },
        { ownerSeatNo: 3, owner_seat_no: 3, entries: [] },
      ];
  const currentStepByPhase = {
    PROMPT: 0,
    DRAW: 1,
    GUESS: 2,
    REVEAL: 3,
  };
  const currentTaskByPhase = {
    PROMPT: "내 비밀 시작 문장을 입력하세요.",
    DRAW: "문장을 보고 그림을 그리세요.",
    GUESS: "그림만 보고 떠오르는 문장을 적으세요.",
    REVEAL: "책자별 변화를 순서대로 확인하세요.",
  };
  return {
    game: "TELESTRATIONS",
    variantCode: "BASE",
    variant_code: "BASE",
    variantName: "본게임",
    variant_name: "본게임",
    playerCount: 3,
    player_count: 3,
    currentStep: currentStepByPhase[normalizedPhase] ?? 0,
    current_step: currentStepByPhase[normalizedPhase] ?? 0,
    totalSteps: 3,
    total_steps: 3,
    phase: normalizedPhase,
    activeSeatNo: 0,
    active_seat_no: 0,
    completedSeatNos: [],
    completed_seat_nos: [],
    books,
    events: [
      {
        eventNo: 1,
        event_no: 1,
        eventType: "GAME_STARTED",
        event_type: "GAME_STARTED",
        seatNo: 0,
        seat_no: 0,
        message: "각자 시작 문장을 적습니다.",
      },
    ],
    activeBook: { ownerSeatNo: 1, owner_seat_no: 1, entries: activeEntries },
    active_book: { ownerSeatNo: 1, owner_seat_no: 1, entries: activeEntries },
    mySubmitted: false,
    my_submitted: false,
    currentTask: currentTaskByPhase[normalizedPhase] || "현재 단계의 입력을 제출하세요.",
    current_task: currentTaskByPhase[normalizedPhase] || "현재 단계의 입력을 제출하세요.",
  };
}

function lasVegasSmokeRoom() {
  return {
    roomId: 9090,
    room_id: 9090,
    roomCode: "LVSMOKE",
    room_code: "LVSMOKE",
    title: "라스베가스 스모크 방",
    roomStatus: "PLAYING",
    room_status: "PLAYING",
    hostMemberId: 999,
    host_member_id: 999,
    chatRoomId: 9191,
    chat_room_id: 9191,
    minPlayers: 2,
    min_players: 2,
    maxPlayers: 6,
    max_players: 6,
    roundCount: 3,
    round_count: 3,
    currentRoundNo: 1,
    current_round_no: 1,
    turnTimeSeconds: 50,
    turn_time_seconds: 50,
    players: [
      player(999, 1, false, "검증 사용자"),
      player(1001, 2, true, "상대 플레이어"),
    ],
  };
}

function lasVegasSmokeState() {
  return {
    eventType: "snapshot",
    event_type: "snapshot",
    roomId: 9090,
    room_id: 9090,
    roomCode: "LVSMOKE",
    room_code: "LVSMOKE",
    roomStatus: "PLAYING",
    room_status: "PLAYING",
    phase: "PLAYING",
    roundNo: 1,
    round_no: 1,
    roundCount: 3,
    round_count: 3,
    turnMemberId: 1001,
    turn_member_id: 1001,
    turnDeadlineAt: new Date(Date.now() + 60000).toISOString(),
    turn_deadline_at: new Date(Date.now() + 60000).toISOString(),
    chatRoomId: 9191,
    chat_room_id: 9191,
    winnerMemberId: null,
    winner_member_id: null,
    message: null,
    currentRoll: [2, 2, 5, 6],
    current_roll: [2, 2, 5, 6],
    lastPlacedMemberId: 999,
    last_placed_member_id: 999,
    lastPlacedCasinoNo: 1,
    last_placed_casino_no: 1,
    lastPlacedDiceCount: 2,
    last_placed_dice_count: 2,
    lastPlacedAt: new Date(Date.now() - 8000).toISOString(),
    last_placed_at: new Date(Date.now() - 8000).toISOString(),
    players: [
      { memberId: 999, member_id: 999, nickname: "검증 사용자", seatNo: 1, seat_no: 1, ready: false, totalMoney: 30000, total_money: 30000, remainingDice: 6, remaining_dice: 6 },
      { memberId: 1001, member_id: 1001, nickname: "상대 플레이어", seatNo: 2, seat_no: 2, ready: false, totalMoney: 10000, total_money: 10000, remainingDice: 4, remaining_dice: 4 },
    ],
    casinos: [1, 2, 3, 4, 5, 6].map((casinoNo) => {
      const moneyCards = casinoNo === 1 ? [50000, 30000] : [40000, 30000];
      const diceByPlayer = casinoNo === 1 ? { 999: 2 } : {};
      return {
        casinoNo,
        casino_no: casinoNo,
        moneyCards,
        money_cards: moneyCards,
        totalMoney: moneyCards.reduce((sum, value) => sum + value, 0),
        total_money: moneyCards.reduce((sum, value) => sum + value, 0),
        diceByPlayer,
        dice_by_player: diceByPlayer,
      };
    }),
  };
}

function recordRequest(kind, game, pathname, body) {
  mockState.requests.push({ kind, game, pathname, body });
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function send(cdp, method, params = {}) {
  return cdp.send(method, params, cdp.sessionId);
}

function decodeResponseBody(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

function routeMock(url, method, postData = "") {
  const parsed = new URL(url);
  const hostname = parsed.hostname;
  const pathname = parsed.pathname;
  const body = parseJson(postData);
  if (method === "GET" && hostname === "oapi.map.naver.com") {
    return { status: 200, contentType: "application/javascript; charset=utf-8", bodyText: "" };
  }
  if (method === "GET" && pathname === "/api/members") {
    return {
      status: 200,
      body: {
        data: {
          memberId: 999,
          member_id: 999,
          name: "검증 사용자",
          nickname: "검증 사용자",
          roles: ["ROLE_USER"],
        },
      },
    };
  }
  if (method === "GET" && pathname === "/api/chat/rooms") {
    return { status: 200, body: { data: [] } };
  }
  if (method === "GET" && /^\/api\/chat\/room\/\d+\/messages$/.test(pathname)) {
    return { status: 200, body: { data: [] } };
  }
  if (method === "PATCH" && /^\/api\/chat\/room\/\d+\/read$/.test(pathname)) {
    return { status: 200, body: { data: true } };
  }
  const match = pathname.match(/^\/api\/game\/([^/]+)\/(.+)$/);
  if (!match) return null;
  const [, game, suffix] = match;
  if (game === "las-vegas") {
    if (method === "GET" && suffix === "rooms") {
      return { status: 200, body: [] };
    }
    if (method === "GET" && suffix === "rooms/me") {
      return { status: 200, body: [lasVegasSmokeRoom()] };
    }
    if (method === "GET" && /^rooms\/\d+\/state$/.test(suffix)) {
      return { status: 200, body: lasVegasSmokeState() };
    }
  }
  if (game === "telestrations") {
    if (method === "GET" && suffix === "rooms") {
      return { status: 200, body: [] };
    }
    if (method === "GET" && suffix === "rooms/me") {
      return { status: 200, body: [telestrationsSmokeRoom()] };
    }
    if (method === "GET" && /^rooms\/\d+\/state$/.test(suffix)) {
      return {
        status: 200,
        body: {
          eventType: "snapshot",
          event_type: "snapshot",
          message: null,
          room: telestrationsSmokeRoom(),
          variants: variantsByGame.telestrations,
          gameState: telestrationsSmokeGameState(),
          game_state: telestrationsSmokeGameState(),
        },
      };
    }
  }
  if (method === "GET" && suffix === "variants") {
    return { status: 200, body: variantsByGame[game] || [] };
  }
  if (method === "GET" && (suffix === "rooms" || suffix === "rooms/me")) {
    return { status: 200, body: [] };
  }
  if (method === "POST" && suffix === "rooms") {
    const room = roomFor(game, "host");
    room.title = body.title || room.title;
    room.variantCode = body.variant_code || room.variantCode;
    room.variant_code = room.variantCode;
    mockState.activeRoomsByGame.set(game, room);
    recordRequest("create", game, pathname, body);
    return { status: 200, body: room };
  }
  if (method === "POST" && suffix === "rooms/join-by-code") {
    const room = roomFor(game, "guest");
    room.roomCode = body.room_code || room.roomCode;
    room.room_code = room.roomCode;
    mockState.activeRoomsByGame.set(game, room);
    recordRequest("joinByCode", game, pathname, body);
    return { status: 200, body: room };
  }
  if (method === "POST" && /^rooms\/\d+\/ready$/.test(suffix)) {
    recordRequest("ready", game, pathname, body);
    const room = mockState.activeRoomsByGame.get(game);
    const me = room?.players?.find((item) => item.memberId === 999);
    if (me) {
      me.ready = true;
    }
    return { status: 200, body: {} };
  }
  if (method === "POST" && /^rooms\/\d+\/start$/.test(suffix)) {
    recordRequest("start", game, pathname, body);
    const room = mockState.activeRoomsByGame.get(game);
    if (room) {
      room.roomStatus = "PLAYING";
      room.room_status = "PLAYING";
    }
    return { status: 200, body: {} };
  }
  if (method === "GET" && /^rooms\/\d+\/state$/.test(suffix)) {
    const room = mockState.activeRoomsByGame.get(game) || roomFor(game, "host");
    mockState.activeRoomsByGame.set(game, room);
    const gameState = game === "catan" && room.roomStatus === "PLAYING"
      ? catanSmokeGameState(room)
      : game === "blokus" && room.roomStatus === "PLAYING"
        ? blokusSmokeGameState(room)
        : game === "mahe" && room.roomStatus === "PLAYING"
          ? maheSmokeGameState(room)
          : game === "six-nimmt" && room.roomStatus === "PLAYING"
            ? sixNimmtSmokeGameState(room)
            : game === "poker" && room.roomStatus === "PLAYING"
              ? pokerSmokeGameState(room)
              : game === "mafia" && room.roomStatus === "PLAYING"
                ? mafiaSmokeGameState(room)
              : null;
    return {
      status: 200,
      body: {
        eventType: "snapshot",
        event_type: "snapshot",
        message: null,
        room,
        variants: variantsByGame[game] || [],
        gameState,
        game_state: gameState,
      },
    };
  }
  return null;
}

async function handleFetchRequest(ws, event) {
  const { requestId, request } = event.params;
  if (debug) console.log("fetch", request.method, request.url);
  const mock = routeMock(request.url, request.method, request.postData);
  if (!mock) {
    await send(ws, "Fetch.continueRequest", { requestId });
    return;
  }
  await send(ws, "Fetch.fulfillRequest", {
    requestId,
    responseCode: mock.status,
    responseHeaders: [
      { name: "Content-Type", value: mock.contentType || "application/json; charset=utf-8" },
      { name: "Cache-Control", value: "no-store" },
    ],
    body: mock.bodyText !== undefined ? Buffer.from(mock.bodyText, "utf8").toString("base64") : decodeResponseBody(mock.body),
  });
}

async function waitForAppIdle(ws) {
  await send(ws, "Runtime.evaluate", {
    awaitPromise: true,
    expression: "new Promise((resolve) => setTimeout(resolve, 900))",
  });
}

async function evaluate(ws, expression) {
  const response = await send(ws, "Runtime.evaluate", {
    awaitPromise: true,
    returnByValue: true,
    expression,
  });
  return response.result?.result?.value;
}

async function waitForExpression(ws, expression, label, timeoutMs = 6000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(ws, expression)) return;
    await delay(120);
  }
  const pageState = await evaluate(ws, `(() => ({
    href: location.href,
    readyState: document.readyState,
    bodyText: document.body?.innerText?.slice(0, 700) || "",
  }))()`).catch(() => null);
  throw new Error(`Timed out waiting for ${label}${pageState ? `; page: ${JSON.stringify(pageState)}` : ""}`);
}

async function waitForText(ws, text) {
  await waitForExpression(
    ws,
    `document.body && document.body.innerText.includes(${JSON.stringify(text)})`,
    `text ${text}`
  );
}

async function waitForEnabledButton(ws, text) {
  await waitForExpression(
    ws,
    `Array.from(document.querySelectorAll("button")).some((button) => button.innerText.trim() === ${JSON.stringify(text)} && !button.disabled)`,
    `enabled button ${text}`
  );
}

async function setInputByAriaLabel(ws, label, value) {
  const result = await evaluate(ws, `(() => {
    const input = Array.from(document.querySelectorAll("input, textarea")).find((node) => node.getAttribute("aria-label") === ${JSON.stringify(label)});
    if (!input) return false;
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value");
    descriptor.set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return input.value;
  })()`);
  if (result === false) throw new Error(`Input with aria-label ${label} not found`);
}

async function setSelectByAriaLabel(ws, label, value) {
  const result = await evaluate(ws, `(() => {
    const select = Array.from(document.querySelectorAll("select")).find((node) => node.getAttribute("aria-label") === ${JSON.stringify(label)});
    if (!select) return "missing";
    const option = Array.from(select.options).find((item) => item.value === ${JSON.stringify(value)} && !item.disabled);
    if (!option) return "option-missing";
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(select), "value");
    descriptor.set.call(select, ${JSON.stringify(value)});
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return select.value;
  })()`);
  if (result !== value) throw new Error(`Select ${label} could not be set to ${value}: ${result}`);
}

async function clickButtonByText(ws, text) {
  const result = await evaluate(ws, `(() => {
    const button = Array.from(document.querySelectorAll("button")).find((node) => node.innerText.trim() === ${JSON.stringify(text)} && !node.disabled);
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (!result) throw new Error(`Enabled button ${text} not found`);
}

async function resetGameStorage(ws) {
  await evaluate(ws, `(() => {
    localStorage.setItem("accessToken", "smoke-access-token");
    localStorage.setItem("refreshToken", "smoke-refresh-token");
    localStorage.setItem("userRoles", JSON.stringify(["ROLE_USER"]));
    ["catan_last_room_id", "blokus_last_room_id", "mahe_last_room_id", "dalmuti_last_room_id", "six_nimmt_last_room_id", "telestrations_last_room_id", "mafia_last_room_id", "poker_last_room_id", "citadels_last_room_id", "las_vegas_last_room_id", "no_thanks_last_room_id"].forEach((key) => localStorage.removeItem(key));
    return true;
  })()`);
}

async function navigateToGame(ws, game) {
  await send(ws, "Emulation.setDeviceMetricsOverride", {
    width: 1366,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await resetGameStorage(ws);
  const path = game === "poker" ? "/app/poker" : `/app/games/${game}`;
  await send(ws, "Page.navigate", { url: `${baseUrl}${path}` });
  await waitForText(ws, "방 만들기");
  await waitForEnabledButton(ws, "방 만들기");
}

function assertRequest(game, kind, predicate, description) {
  const request = mockState.requests.find((candidate) => candidate.game === game && candidate.kind === kind && (!predicate || predicate(candidate)));
  if (!request) {
    throw new Error(`${game} room flow: missing ${description}`);
  }
}

async function runRoomFlowSmoke(ws, game) {
  mockState.requests = mockState.requests.filter((request) => request.game !== game);
  mockState.activeRoomsByGame.delete(game);

  await navigateToGame(ws, game);
  const title = `${gameNames[game]} 자동 검증 방`;
  await setInputByAriaLabel(ws, "방 제목", title);
  await clickButtonByText(ws, "방 만들기");
  await waitForText(ws, "방 코드");
  const startButtonText = game === "citadels" ? "시작하기" : "시작";
  await waitForEnabledButton(ws, startButtonText);
  assertRequest(game, "create", (request) => request.body?.title === title, "create-room POST payload");

  await clickButtonByText(ws, startButtonText);
  await waitForText(ws, "진행 중");
  if (game === "catan") {
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="catan-rule-brief"]'))`, "catan selected rule brief");
    await waitForExpression(ws, `document.querySelector('[data-smoke="catan-rule-brief"]')?.textContent.includes("10")`, "catan rule target");
  }
  if (game === "blokus") {
    await waitForText(ws, "보드 칸을 누르면");
    const clicked = await evaluate(ws, `(() => {
      const button = Array.from(document.querySelectorAll("button")).find((node) => (node.getAttribute("aria-label") || "").startsWith("1열 1행"));
      if (!button) return false;
      button.click();
      return true;
    })()`);
    if (!clicked) throw new Error("blokus room flow: board cell button not found");
    await waitForText(ws, "초록/현재 색");
    await waitForText(ws, "선택 위치에 놓기");
  }
  if (game === "mahe") {
    await send(ws, "Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await waitForExpression(
      ws,
      `(() => {
        const panel = document.querySelector('[data-smoke="mahe-side-dice-panel"]');
        return Boolean(panel) && getComputedStyle(panel).display === "none";
      })()`,
      "mahe duplicate dice panel hidden on mobile"
    );
    await waitForExpression(
      ws,
      `document.querySelectorAll('[data-smoke="mahe-turtle-token"]').length >= 2`,
      "mahe turtle tokens rendered"
    );
  }
  if (game === "six-nimmt") {
    await waitForText(ws, "내 손패");
    await waitForText(ws, "선택한 카드 제출");
  }
  if (game === "poker") {
    await waitForText(ws, "내 족보");
    await waitForText(ws, "추천 판단");
  }
  if (game === "mafia") {
    await waitForText(ws, "내 역할");
    await waitForText(ws, "습격 대상 확정");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="mafia-stage"]'))`, "mafia stage rendered");
  }
  assertRequest(game, "start", null, "start POST request");

  await navigateToGame(ws, game);
  await setInputByAriaLabel(ws, "방 코드", "FLOW1234");
  await waitForEnabledButton(ws, "입장");
  await clickButtonByText(ws, "입장");
  await waitForText(ws, "준비하기");
  assertRequest(game, "joinByCode", (request) => request.body?.room_code === "FLOW1234", "join-by-code POST payload");

  await clickButtonByText(ws, "준비하기");
  await delay(300);
  assertRequest(game, "ready", null, "ready POST request");
  return `${game} room flow: ok create/start/join-by-code/ready`;
}

async function runVariantCreateSmoke(ws, { game, variantCode }) {
  mockState.requests = mockState.requests.filter((request) => request.game !== game);
  mockState.activeRoomsByGame.delete(game);

  await navigateToGame(ws, game);
  await setSelectByAriaLabel(ws, `${gameNames[game]} 규칙 선택`, variantCode);
  const title = `${gameNames[game]} ${variantCode} 검증 방`;
  await setInputByAriaLabel(ws, "방 제목", title);
  await clickButtonByText(ws, "방 만들기");
  await waitForText(ws, "방 코드");
  assertRequest(
    game,
    "create",
    (request) => request.body?.title === title && request.body?.variant_code === variantCode,
    `create-room POST payload for ${variantCode}`
  );
  return `${game} ${variantCode} variant create: ok`;
}

async function inspectPage(ws, testCase, viewport) {
  mockState.telestrationsPhase = testCase.telestrationsPhase || "PROMPT";
  await send(ws, "Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.mobile ? 2 : 1,
    mobile: viewport.mobile,
  });
  await send(ws, "Page.navigate", { url: `${baseUrl}${testCase.path}` });
  await waitForAppIdle(ws);
  for (const text of testCase.expectedTexts) {
    await waitForText(ws, text);
  }
  await waitForAppIdle(ws);
  const response = await send(ws, "Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const root = document.documentElement;
      const body = document.body;
      const text = body ? body.innerText : "";
      const overflowNodes = Array.from(document.querySelectorAll("body *"))
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return {
            tag: node.tagName,
            text: (node.innerText || node.getAttribute("aria-label") || "").trim().slice(0, 60),
            width: Math.round(rect.width),
            right: Math.round(rect.right),
            className: String(node.className || "").slice(0, 80),
          };
        })
        .filter((node) => node.right > root.clientWidth + 2 && node.width > 0)
        .slice(0, 5);
      return {
        url: location.href,
        title: document.title,
        text,
        clientWidth: root.clientWidth,
        scrollWidth: root.scrollWidth,
        bodyWidth: body ? body.scrollWidth : 0,
        overflowNodes,
        gameCards: Array.from(document.querySelectorAll('[data-smoke="game-card"]')).map((card) => ({
          title: card.getAttribute("data-game-title") || "",
          minPlayers: Number(card.getAttribute("data-min-players")),
          maxPlayers: Number(card.getAttribute("data-max-players")),
        })),
        variantChoiceGrids: Array.from(document.querySelectorAll('[data-smoke="variant-choice-grid"]')).map((grid) => {
          const rect = grid.getBoundingClientRect();
          const style = getComputedStyle(grid);
          return {
            compact: grid.getAttribute("data-compact") === "true",
            overflowY: style.overflowY,
            clientHeight: Math.round(grid.clientHeight),
            scrollHeight: Math.round(grid.scrollHeight),
            rectHeight: Math.round(rect.height),
          };
        }),
      };
    })()`,
  });
  const value = response.result?.result?.value;
  if (!value) {
    throw new Error(`${testCase.label} ${viewport.name}: failed to inspect page`);
  }
  const missing = testCase.expectedTexts.filter((needle) => !value.text.includes(needle));
  if (missing.length) {
    throw new Error(`${testCase.label} ${viewport.name}: missing text ${missing.join(", ")} at ${value.url}`);
  }
  if (value.text.includes("로그인") && !testCase.expectedTexts.includes("로그인")) {
    throw new Error(`${testCase.label} ${viewport.name}: redirected to login at ${value.url}`);
  }
  const trappedVariantGrid = value.variantChoiceGrids.find((grid) => {
    const canScrollInternally = ["auto", "scroll"].includes(grid.overflowY) && grid.scrollHeight > grid.clientHeight + 2;
    return canScrollInternally && (!grid.compact || viewport.mobile);
  });
  if (trappedVariantGrid) {
    throw new Error(`${testCase.label} ${viewport.name}: variant choice grid must use page scroll, not an inner scroll trap ${JSON.stringify(trappedVariantGrid)}`);
  }
  const overflow = Math.max(value.scrollWidth, value.bodyWidth) - value.clientWidth;
  if (overflow > 3) {
    throw new Error(`${testCase.label} ${viewport.name}: horizontal overflow ${overflow}px ${JSON.stringify(value.overflowNodes)}`);
  }
  if (testCase.label === "game hub") {
    if (!value.gameCards.length) {
      throw new Error(`${testCase.label} ${viewport.name}: game cards were not rendered with smoke metadata`);
    }
    const unsortedPair = value.gameCards.find((card, index, cards) => {
      const next = cards[index + 1];
      if (!next) return false;
      if (!Number.isFinite(card.minPlayers) || !Number.isFinite(card.maxPlayers)
          || !Number.isFinite(next.minPlayers) || !Number.isFinite(next.maxPlayers)) {
        return true;
      }
      return card.minPlayers > next.minPlayers
        || (card.minPlayers === next.minPlayers && card.maxPlayers > next.maxPlayers);
    });
    if (unsortedPair) {
      throw new Error(`${testCase.label} ${viewport.name}: game cards must be sorted by min players, then max players: ${JSON.stringify(value.gameCards)}`);
    }
  }
  if (testCase.assertTelestrationsImage) {
    await waitForExpression(
      ws,
      `(() => {
        const image = document.querySelector('[data-smoke="telestrations-entry-image"]');
        if (!image) return false;
        const rect = image.getBoundingClientRect();
        return image.complete && image.naturalWidth > 0 && rect.width > 100 && rect.height > 100;
      })()`,
      `${testCase.label} rendered image`
    );
    const imageStats = await evaluate(ws, `(() => {
      const frame = document.querySelector('[data-smoke="telestrations-entry-image-frame"]');
      const image = document.querySelector('[data-smoke="telestrations-entry-image"]');
      const frameRect = frame?.getBoundingClientRect();
      const imageRect = image?.getBoundingClientRect();
      return {
        frameWidth: Math.round(frameRect?.width || 0),
        frameHeight: Math.round(frameRect?.height || 0),
        imageWidth: Math.round(imageRect?.width || 0),
        imageHeight: Math.round(imageRect?.height || 0),
        naturalWidth: image?.naturalWidth || 0,
        naturalHeight: image?.naturalHeight || 0,
      };
    })()`);
    if (!imageStats || imageStats.frameHeight < 180 || imageStats.imageHeight < 100 || imageStats.naturalWidth <= 0) {
      throw new Error(`${testCase.label} ${viewport.name}: Telestrations image did not render with a stable frame ${JSON.stringify(imageStats)}`);
    }
  }
  return {
    case: testCase.label,
    viewport: viewport.name,
    width: value.clientWidth,
    scrollWidth: value.scrollWidth,
    url: value.url,
  };
}

async function main() {
  assertTabletopRealtimeSource();
  assertActionToastSingleton();
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--remote-debugging-pipe",
    `--user-data-dir=${userDataDir}`,
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] });

  chrome.stderr.on("data", () => {});
  const waitForChromeExit = () => new Promise((resolve) => {
    if (chrome.exitCode !== null) {
      resolve();
      return;
    }
    chrome.once("exit", resolve);
  });
  try {
    const cdp = new PipeCdp(chrome);
    await cdp.send("Browser.getVersion");
    const targetResponse = await cdp.send("Target.createTarget", { url: "about:blank" });
    const targetId = targetResponse.result?.targetId;
    if (!targetId) throw new Error("Could not create Chrome target for tabletop smoke test.");
    const attachResponse = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    cdp.sessionId = attachResponse.result?.sessionId;
    if (!cdp.sessionId) throw new Error("Could not attach to Chrome target for tabletop smoke test.");
    const runtimeErrors = [];
    cdp.onMessage((message) => {
      if (message.sessionId !== cdp.sessionId) return;
      if (message.method === "Fetch.requestPaused") {
        handleFetchRequest(cdp, message).catch((error) => {
          if (!String(error.message || "").includes("Invalid InterceptionId")) {
            runtimeErrors.push(error.message);
          }
        });
      } else if (message.method === "Runtime.exceptionThrown") {
        const errorText = formatRuntimeException(message.params?.exceptionDetails) || "Runtime exception";
        runtimeErrors.push(errorText);
        console.error(errorText);
      } else if (message.method === "Runtime.consoleAPICalled" && message.params?.type === "error") {
        const errorText = formatConsoleArgs(message.params.args);
        if (errorText) {
          runtimeErrors.push(errorText);
          console.error(errorText);
        }
      }
    });
    await send(cdp, "Page.enable");
    await send(cdp, "Runtime.enable");
    await send(cdp, "Fetch.enable", {
      patterns: [
        { urlPattern: "*://localhost*/api/*", requestStage: "Request" },
        { urlPattern: "*://127.0.0.1*/api/*", requestStage: "Request" },
        { urlPattern: "https://oapi.map.naver.com/*", requestStage: "Request" },
      ],
    });
    await send(cdp, "Page.addScriptToEvaluateOnNewDocument", {
      source: `
        localStorage.setItem("accessToken", "smoke-access-token");
        localStorage.setItem("refreshToken", "smoke-refresh-token");
        localStorage.setItem("userRoles", JSON.stringify(["ROLE_USER"]));
        localStorage.setItem("ctfmon_debug_console", "1");
      `,
    });

    const results = [];
    for (const testCase of cases) {
      for (const viewport of viewports) {
        results.push(await inspectPage(cdp, testCase, viewport));
      }
    }
    const flowResults = [];
    const flowGames = ["catan", "blokus", "mahe", "dalmuti", "six-nimmt", "poker", "mafia", "citadels"];
    for (const game of flowGames) {
      flowResults.push(await runRoomFlowSmoke(cdp, game));
    }
    const variantResults = [];
    for (const item of variantCreateCases) {
      variantResults.push(await runVariantCreateSmoke(cdp, item));
    }
    const expectedPageChecks = cases.length * viewports.length;
    if (results.length !== expectedPageChecks || flowResults.length !== flowGames.length || variantResults.length !== variantCreateCases.length) {
      throw new Error(`Incomplete tabletop smoke coverage: pages ${results.length}/${expectedPageChecks}, flows ${flowResults.length}/${flowGames.length}, variants ${variantResults.length}/${variantCreateCases.length}`);
    }
    if (runtimeErrors.length) {
      throw new Error(`Runtime errors: ${runtimeErrors.join(" | ")}`);
    }
    results.forEach((result) => {
      console.log(`${result.case} ${result.viewport}: ok ${result.width}/${result.scrollWidth} ${result.url}`);
    });
    flowResults.forEach((result) => console.log(result));
    variantResults.forEach((result) => console.log(result));
    console.log(`tabletop-ui-smoke ok (${results.length} responsive page checks, ${flowResults.length} room flows, ${variantResults.length} variant create checks)`);
  } finally {
    if (chrome.exitCode === null) {
      chrome.kill();
      await Promise.race([waitForChromeExit(), delay(1500)]);
    }
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        rmSync(userDataDir, { recursive: true, force: true });
        break;
      } catch (error) {
        if (attempt === 5) {
          console.warn(`Could not remove temporary Chrome profile ${userDataDir}: ${error.message}`);
          break;
        }
        await delay(300);
      }
    }
  }
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
