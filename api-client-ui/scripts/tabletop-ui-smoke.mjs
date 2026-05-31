import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
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

const port = Number(process.env.CHROME_DEBUG_PORT || 9337);
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
    expectedTexts: ["신규 보드게임", "카탄", "블로커스", "마헤", "달무티"],
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
  ],
  mahe: [
    variant("BASE", "본게임", false, 2, 7, "거북이 업기와 알 카드 점수", ["2~7인", "거북이 업기", "알 카드"]),
  ],
  dalmuti: [
    variant("BASE", "본게임", false, 4, 8, "계급 카드와 세금", ["4~8인", "세금", "혁명"]),
    variant("FIRST_DEAL_REVOLUTION", "첫 손 세금 없음", true, 4, 8, "첫 판 혁명 선택 규칙", ["첫 손 세금 없음", "혁명 선택", "공식 선택 규칙"]),
  ],
};

let nextMessageId = 1;
const mockState = {
  nextRoomId: 1000,
  activeRoomsByGame: new Map(),
  requests: [],
};
const gameNames = {
  catan: "카탄",
  blokus: "블로커스",
  mahe: "마헤",
  dalmuti: "달무티",
  "las-vegas": "라스베가스",
};
const gameCodePrefix = {
  catan: "CATN",
  blokus: "BLOK",
  mahe: "MAHE",
  dalmuti: "DALM",
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

async function waitForJson(url, timeoutMs = 10000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await delay(120);
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

function send(ws, method, params = {}) {
  const id = nextMessageId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, method });
  });
}

const pending = new Map();

function decodeResponseBody(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

function routeMock(url, method, postData = "") {
  const parsed = new URL(url);
  const pathname = parsed.pathname;
  const body = parseJson(postData);
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
  const mock = routeMock(request.url, request.method, request.postData);
  if (!mock) {
    await send(ws, "Fetch.continueRequest", { requestId });
    return;
  }
  await send(ws, "Fetch.fulfillRequest", {
    requestId,
    responseCode: mock.status,
    responseHeaders: [
      { name: "Content-Type", value: "application/json; charset=utf-8" },
      { name: "Cache-Control", value: "no-store" },
    ],
    body: decodeResponseBody(mock.body),
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
  throw new Error(`Timed out waiting for ${label}`);
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
    ["catan_last_room_id", "blokus_last_room_id", "mahe_last_room_id", "dalmuti_last_room_id", "las_vegas_last_room_id"].forEach((key) => localStorage.removeItem(key));
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
  await send(ws, "Page.navigate", { url: `${baseUrl}/app/games/${game}` });
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
  await waitForEnabledButton(ws, "시작");
  assertRequest(game, "create", (request) => request.body?.title === title, "create-room POST payload");

  await clickButtonByText(ws, "시작");
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

async function inspectPage(ws, testCase, viewport) {
  await send(ws, "Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.mobile ? 2 : 1,
    mobile: viewport.mobile,
  });
  await send(ws, "Page.navigate", { url: `${baseUrl}${testCase.path}` });
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
  const overflow = Math.max(value.scrollWidth, value.bodyWidth) - value.clientWidth;
  if (overflow > 3) {
    throw new Error(`${testCase.label} ${viewport.name}: horizontal overflow ${overflow}px ${JSON.stringify(value.overflowNodes)}`);
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
  const chrome = spawn(chromePath, [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });

  chrome.stderr.on("data", () => {});
  const waitForChromeExit = () => new Promise((resolve) => {
    if (chrome.exitCode !== null) {
      resolve();
      return;
    }
    chrome.once("exit", resolve);
  });
  try {
    await waitForJson(`http://127.0.0.1:${port}/json/version`);
    const targetResponse = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
    if (!targetResponse.ok) {
      throw new Error(`Could not open Chrome target: ${targetResponse.status} ${targetResponse.statusText}`);
    }
    const target = await targetResponse.json();
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    const runtimeErrors = [];
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const waiter = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) {
          waiter.reject(new Error(`${waiter.method}: ${message.error.message}`));
        } else {
          waiter.resolve(message);
        }
        return;
      }
      if (message.method === "Fetch.requestPaused") {
        handleFetchRequest(ws, message).catch((error) => {
          if (!String(error.message || "").includes("Invalid InterceptionId")) {
            runtimeErrors.push(error.message);
          }
        });
      } else if (message.method === "Runtime.exceptionThrown") {
        runtimeErrors.push(message.params?.exceptionDetails?.text || "Runtime exception");
      }
    });
    await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
    await send(ws, "Page.enable");
    await send(ws, "Runtime.enable");
    await send(ws, "Fetch.enable", { patterns: [{ urlPattern: "*://localhost/api/*", requestStage: "Request" }] });
    await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
      source: `
        localStorage.setItem("accessToken", "smoke-access-token");
        localStorage.setItem("refreshToken", "smoke-refresh-token");
        localStorage.setItem("userRoles", JSON.stringify(["ROLE_USER"]));
      `,
    });

    const results = [];
    for (const testCase of cases) {
      for (const viewport of viewports) {
        results.push(await inspectPage(ws, testCase, viewport));
      }
    }
    const flowResults = [];
    for (const game of ["catan", "blokus", "mahe", "dalmuti"]) {
      flowResults.push(await runRoomFlowSmoke(ws, game));
    }
    if (runtimeErrors.length) {
      throw new Error(`Runtime errors: ${runtimeErrors.join(" | ")}`);
    }
    results.forEach((result) => {
      console.log(`${result.case} ${result.viewport}: ok ${result.width}/${result.scrollWidth} ${result.url}`);
    });
    flowResults.forEach((result) => console.log(result));
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

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
