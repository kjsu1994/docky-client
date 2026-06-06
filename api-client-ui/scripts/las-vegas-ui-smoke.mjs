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
const userDataDir = mkdtempSync(path.join(tmpdir(), "las-vegas-ui-smoke-"));
const blockedTexts = ["Error", "undefined", "NaN", "room_code", "round_count", "turn_time_seconds", "current_roll"];
const viewports = [
    { name: "desktop", width: 1366, height: 900, mobile: false, interactive: true },
    { name: "mobile", width: 390, height: 844, mobile: true, interactive: false },
];

function assertLasVegasRealtimeSource() {
    const source = readFileSync("src/pages/games/LasVegasGame.jsx", "utf8");
    const visualSource = readFileSync("src/common/LasVegasVisuals.jsx", "utf8");
    const uxAssetSource = readFileSync("src/pages/games/GameUxAssets.jsx", "utf8");
    const requiredSnippets = [
        ["const realtimeRoomRef = useRef(null)", "track the latest realtime room"],
        ["createStompClient", "load the STOMP runtime through the shared async adapter"],
        ["notifyRealtimeError", "route STOMP ERROR frames through the shared safe notifier"],
        ["client.beforeConnect = () =>", "refresh STOMP auth headers before reconnect"],
        ["bindLatestRealtimeRoom(client)", "resubscribe the latest room after reconnect"],
        ["realtimeRoomRef.current = { roomId, chatRoomId: snapshotChatRoomId }", "store the latest game/chat room"],
        ["heartbeatIncoming: 4000", "enable STOMP heartbeat checks"],
        ["LasVegasDecisionPanel", "render the board-game decision support panel"],
        ["LasVegasTurnRailPanel", "render the selected-room turn and seat rail"],
        ["LasVegasTurnRailArt", "render the selected-room turn rail through reusable SVG artwork"],
        ["buildLasVegasProgressDigest", "derive recent Las Vegas progress from public room state"],
        ["LasVegasProgressDigestPanel", "render selected-room recent progress guidance"],
        ["LasVegasProgressDigestArt", "render recent progress guidance through local SVG artwork"],
        ["LasVegasCasinoPressurePanel", "render casino reward and tie pressure guidance"],
        ["LasVegasCasinoPressureArt", "render casino pressure through reusable SVG artwork"],
        ["LasVegasSettlementLedgerPanel", "render casino settlement and winner-basis guidance"],
        ["LasVegasSettlementLedgerArt", "render settlement guidance through reusable SVG artwork"],
        ["buildLasVegasSettlementLedger", "derive settlement ledger from public casino and player state"],
        ["LasVegasSessionActionPanel", "render finished-session next-action guidance"],
        ["LasVegasSessionActionArt", "render finished-session guidance through local SVG artwork"],
        ["buildLasVegasSessionActionItems", "derive finished-session next-action guidance from public state"],
        ["buildLasVegasSessionRouteItems", "derive selected-room session button-route guidance from public state"],
        ["LasVegasSessionRoutePanel", "render selected-room session button-route guidance"],
        ["LasVegasSessionRouteArt", "render selected-room session button-route guidance through local SVG artwork"],
        ['aria-label="라스베가스 카지노 압력 렌즈"', "render casino pressure SVG with a Korean accessible label"],
        ["buildLasVegasCasinoPressureRows", "derive casino pressure from public dice and reward state"],
        ["buildLasVegasActionRouteItems", "derive roll/casino/settlement route guidance from public game state"],
        ["LasVegasActionRoutePanel", "render roll-to-casino action-route guidance before the real buttons"],
        ["LasVegasActionRouteArt", "render roll-to-casino action-route guidance through local SVG artwork"],
        ["LasVegasActionAvailabilityPanel", "render action availability guidance beside the buttons"],
        ["LasVegasActionAvailabilityArt", "render action availability guidance through local SVG artwork"],
        ["LasVegasRollStandbyPanel", "render empty public-roll guidance inside the selected board"],
        ["LasVegasRollStandbyArt", "render empty public-roll guidance through local SVG artwork"],
        ["buildLasVegasDecisionRows", "derive casino risk/reward explanations from public state"],
        ["GameActionCueBar", "render the shared action cue bar for playable decisions"],
        ["GameFeedbackTicker", "render a persistent action feedback ticker"],
        ["GameFlowMeter", "render the shared flow meter for round readability"],
        ["GameResultSpotlight", "render a finished-game result spotlight"],
        ["GameStartReadinessPanel", "render selected-room start readiness guidance"],
        ["GameChatEmptyState", "render selected-room chat empty-state guidance"],
        ["buildLasVegasSetupPreviewItems", "derive create-room casino briefing items from local form state"],
        ["LasVegasSetupPreviewPanel", "render the create-room casino briefing panel"],
        ["LasVegasSetupPreviewArt", "render the create-room casino briefing through local SVG artwork"],
        ['data-smoke="las-vegas-decision-panel"', "mark the decision support panel for runtime coverage"],
        ['data-smoke="las-vegas-turn-rail-panel"', "mark the selected-room turn rail panel"],
        ['data-smoke="las-vegas-turn-rail-art"', "mark the selected-room turn rail SVG"],
        ['data-smoke="las-vegas-turn-rail-node"', "mark the selected-room turn rail nodes"],
        ['data-smoke="las-vegas-turn-rail-tile"', "mark the selected-room turn rail state tiles"],
        ['data-smoke="las-vegas-turn-rail-player"', "mark the selected-room turn rail players"],
        ['data-smoke="las-vegas-progress-digest-panel"', "mark the recent progress digest panel"],
        ['data-smoke="las-vegas-progress-digest-art"', "mark the recent progress digest SVG"],
        ['data-smoke="las-vegas-progress-digest-node"', "mark recent progress digest SVG nodes"],
        ['data-smoke="las-vegas-progress-digest-item"', "mark recent progress digest tiles"],
        ['data-smoke="las-vegas-casino-pressure-panel"', "mark the casino pressure lens panel"],
        ['data-smoke="las-vegas-casino-pressure-art"', "mark the casino pressure lens SVG"],
        ['data-smoke="las-vegas-casino-pressure-item"', "mark casino pressure reason tiles"],
        ['data-smoke="las-vegas-settlement-ledger-panel"', "mark the settlement ledger panel"],
        ['data-smoke="las-vegas-settlement-ledger-art"', "mark the settlement ledger SVG"],
        ['data-smoke="las-vegas-settlement-casino-node"', "mark settlement casino nodes"],
        ['data-smoke="las-vegas-settlement-ledger-item"', "mark settlement ledger reason tiles"],
        ['data-smoke="las-vegas-session-action-panel"', "mark finished-session action panel"],
        ['data-smoke="las-vegas-session-action-art"', "mark finished-session SVG artwork"],
        ['data-smoke="las-vegas-session-action-node"', "mark finished-session SVG nodes"],
        ['data-smoke="las-vegas-session-action-item"', "mark finished-session action tiles"],
        ['data-smoke="las-vegas-session-action-refresh"', "mark finished-session refresh action"],
        ['data-smoke="las-vegas-session-action-rematch"', "mark finished-session rematch action"],
        ['data-smoke="las-vegas-session-action-hub"', "mark finished-session hub action"],
        ['data-smoke="las-vegas-session-action-leave"', "mark finished-session leave action"],
        ['data-smoke="las-vegas-session-route-panel"', "mark selected-room session button-route panel"],
        ['data-smoke="las-vegas-session-route-art"', "mark selected-room session button-route SVG artwork"],
        ['data-smoke="las-vegas-session-route-node"', "mark selected-room session button-route SVG nodes"],
        ['data-smoke="las-vegas-session-route-item"', "mark selected-room session button-route items"],
        ["라스베가스 세션 버튼 루트", "render selected-room session button-route title in Korean"],
        ["실제 버튼 안내", "render selected-room session button-route helper copy in Korean"],
        ['smoke="las-vegas-flow-meter"', "mark the round flow meter for runtime coverage"],
        ['smoke="las-vegas-action-cue-bar"', "mark the action cue bar for runtime coverage"],
        ['smoke="las-vegas-action-feedback"', "mark the action feedback ticker for runtime coverage"],
        ['smoke="las-vegas-result-spotlight"', "mark the result spotlight for finished games"],
        ['data-smoke="las-vegas-action-route-panel"', "mark the Las Vegas action-route panel"],
        ['data-smoke="las-vegas-action-route-art"', "mark the Las Vegas action-route SVG artwork"],
        ['data-smoke="las-vegas-action-route-node"', "mark Las Vegas action-route SVG nodes"],
        ['data-smoke="las-vegas-action-route-item"', "mark Las Vegas action-route explanation tiles"],
        ["라스베가스 액션 루트", "render the Las Vegas action-route title in Korean"],
        ['data-smoke="las-vegas-action-availability-panel"', "mark the action availability panel"],
        ['data-smoke="las-vegas-action-availability-art"', "mark the action availability SVG artwork"],
        ['data-smoke="las-vegas-action-availability-node"', "mark action availability SVG nodes"],
        ["굴림 → 후보 → 카지노", "render the action availability route copy in Korean"],
        ['data-smoke="las-vegas-action-availability-item"', "mark action availability reason tiles"],
        ['data-smoke="las-vegas-roll-action"', "mark roll action button"],
        ['data-smoke="las-vegas-roll-standby-panel"', "mark the empty public-roll guidance panel"],
        ['data-smoke="las-vegas-roll-standby-art"', "mark the empty public-roll SVG artwork"],
        ['data-smoke="las-vegas-roll-standby-node"', "mark empty public-roll SVG nodes"],
        ['data-smoke="las-vegas-roll-standby-item"', "mark empty public-roll reason tiles"],
        ["공개 주사위 없음", "render the empty public-roll title in Korean"],
        ["굴림 전 보드 상태", "render empty public-roll board-state copy in Korean"],
        ["setActionFeedback", "record local action feedback display state"],
        ["lasVegasActionLabel", "translate Las Vegas actions into Korean feedback labels"],
        ['from "./GameUxAssets.jsx"', "use the custom game UX SVG glyphs"],
        ["lasVegasLobbyRoomReadiness", "derive lobby room readiness guidance"],
        ["lasVegasLobbyRoomActionSignal", "derive lobby room action guidance"],
        ["lasVegasLobbyRoomDecisionToneClasses", "define lobby room decision rail tones"],
        ["buildLasVegasLobbyRoomDecisionItems", "derive lobby room decision rail items"],
        ["LasVegasLobbyRoomDecisionRail", "render lobby room decision guidance"],
        ["lasVegasLobbyRoomCardStatusTone", "derive lobby room card artwork status palette"],
        ["LasVegasLobbyRoomCardArt", "render the enhanced lobby room card through local SVG artwork"],
        ["LasVegasLobbyEmptyState", "render the empty Las Vegas lobby guidance"],
        ["LasVegasLobbyEmptyArt", "render the empty Las Vegas lobby through local SVG artwork"],
        ["buildLasVegasLobbyDirectorPlan", "derive top lobby table candidates from existing rooms"],
        ["LasVegasLobbyDirectorPanel", "render the standalone lobby table brief"],
        ["LasVegasLobbyDirectorArt", "render the lobby table brief through local SVG artwork"],
        ["LasVegasLobbyDirectorEmptyChoice", "render empty lobby director next-action guidance"],
        ["LasVegasLobbyDirectorEmptyArt", "render empty lobby director next-action guidance through local SVG artwork"],
        ['data-smoke="las-vegas-lobby-director-panel"', "mark the lobby director panel"],
        ['data-smoke="las-vegas-lobby-director-art"', "mark the lobby director SVG artwork"],
        ['data-smoke="las-vegas-lobby-director-node"', "mark the lobby director SVG nodes"],
        ['data-smoke="las-vegas-lobby-director-item"', "mark the lobby director reason tiles"],
        ['data-smoke="las-vegas-lobby-director-choice"', "mark the lobby director room choices"],
        ['data-smoke="las-vegas-lobby-director-join"', "mark the lobby director join CTA"],
        ['data-smoke="las-vegas-lobby-director-empty-choice"', "mark empty lobby director next-action guidance"],
        ['data-smoke="las-vegas-lobby-director-empty-art"', "mark empty lobby director SVG artwork"],
        ['data-smoke="las-vegas-lobby-director-empty-node"', "mark empty lobby director SVG nodes"],
        ['data-smoke="las-vegas-lobby-director-empty-item"', "mark empty lobby director action tiles"],
        ["추천할 카지노 테이블이 없습니다", "render empty lobby director copy in Korean"],
        ["카지노 테이블 브리프", "render the Las Vegas lobby director title in Korean"],
        ["바로 입장 후보", "render the lobby director primary candidate copy in Korean"],
        ['data-smoke="las-vegas-setup-preview-panel"', "mark the create-room setup preview panel"],
        ['data-smoke="las-vegas-setup-preview-art"', "mark the create-room setup preview SVG artwork"],
        ['data-smoke="las-vegas-setup-preview-node"', "mark create-room setup preview SVG nodes"],
        ['data-smoke="las-vegas-setup-preview-item"', "mark create-room setup preview reason tiles"],
        ["생성 전 카지노 브리핑", "render the create-room casino briefing title in Korean"],
        ["턴 템포", "render the create-room tempo copy in Korean"],
        ['data-smoke="las-vegas-lobby-room-card"', "mark the enhanced lobby room card"],
        ['data-smoke="las-vegas-lobby-room-card-art"', "mark the enhanced lobby room card SVG artwork"],
        ['data-smoke="las-vegas-lobby-room-card-node"', "mark enhanced lobby room card SVG nodes"],
        ['data-smoke="las-vegas-lobby-room-card-seat"', "mark enhanced lobby room card seat markers"],
        ['data-smoke="las-vegas-lobby-empty-state"', "mark the empty Las Vegas lobby state"],
        ['data-smoke="las-vegas-lobby-empty-art"', "mark the empty Las Vegas lobby SVG artwork"],
        ['data-smoke="las-vegas-lobby-empty-node"', "mark empty Las Vegas lobby SVG nodes"],
        ['data-smoke="las-vegas-lobby-empty-item"', "mark empty Las Vegas lobby guidance cards"],
        ['data-smoke="las-vegas-lobby-empty-refresh"', "mark empty Las Vegas lobby refresh action"],
        ['data-joinable={joinable ? "true" : "false"}', "expose enhanced lobby room joinable state"],
        ['data-smoke="las-vegas-lobby-room-decision-rail"', "mark lobby decision guidance rail"],
        ['data-smoke="las-vegas-lobby-room-decision-item"', "mark lobby decision guidance items"],
        ["data-decision-key={item.key}", "expose stable lobby decision item keys"],
        ["입장 판단", "render lobby decision access copy in Korean"],
        ["규칙", "render lobby decision rule copy in Korean"],
        ['data-smoke="las-vegas-lobby-room-readiness"', "mark lobby readiness guidance"],
        ['data-smoke="las-vegas-lobby-room-action-signal"', "mark lobby action guidance"],
        ['data-smoke="las-vegas-lobby-room-slot"', "mark lobby seat fill bars"],
        ['data-smoke="las-vegas-lobby-room-primary"', "mark lobby primary action"],
        ["TabletopGameArtwork", "render local tabletop artwork inside the standalone route"],
        ['data-smoke="las-vegas-route-artwork"', "mark the route artwork"],
        ['data-smoke="las-vegas-room-artwork"', "mark the selected-room artwork"],
        ["LasVegasJoinCodePanel", "render the standalone Las Vegas join-code bridge"],
        ["LasVegasJoinCodeArt", "render the Las Vegas join-code bridge through local SVG artwork"],
        ['data-smoke="las-vegas-join-code-panel"', "mark the Las Vegas join-code panel"],
        ['data-smoke="las-vegas-join-code-art"', "mark the Las Vegas join-code SVG artwork"],
        ['data-smoke="las-vegas-join-code-node"', "mark Las Vegas join-code flow nodes"],
        ['data-smoke="las-vegas-join-code-input"', "mark the Las Vegas join-code input"],
        ['data-smoke="las-vegas-join-code-submit"', "mark the Las Vegas join-code submit"],
        ['data-smoke="las-vegas-join-code-status"', "mark the Las Vegas join-code status copy"],
        ['placeholder="방코드"', "keep the Las Vegas join-code placeholder compact and Korean"],
        ["카지노 초대 코드", "render the Las Vegas join-code SVG title in Korean"],
        ["CasinoEmptyLaneArt", "render empty casino lanes through reusable SVG artwork"],
        ["CasinoTableSign", "render a reusable SVG casino table sign inside each casino panel"],
        ['data-smoke="las-vegas-casino-panel"', "mark Korean casino cards for runtime coverage"],
        ['smoke="las-vegas-room-setup-panel"', "mark selected lobby room setup guidance"],
        ['itemSmoke="las-vegas-room-setup-item"', "mark selected lobby room setup items"],
        ['smoke="las-vegas-start-readiness-panel"', "mark selected-room start readiness guidance"],
        ['itemSmoke="las-vegas-start-readiness-item"', "mark selected-room readiness items"],
        ['game="las-vegas"', "scope shared chat empty-state guidance to Las Vegas rooms"],
        ['tone="amber"', "render Las Vegas chat empty-state in the casino table tone"],
    ];
    for (const [snippet, description] of requiredSnippets) {
        if (!source.includes(snippet)) {
            throw new Error(`las-vegas-ui-smoke: LasVegasGame realtime source must ${description}.`);
        }
    }
    const requiredVisualSnippets = [
        ['data-smoke="las-vegas-casino-sign-art"', "mark reusable casino sign SVG assets"],
        ['data-smoke="las-vegas-casino-empty-lane"', "mark empty casino reward/dice lanes"],
        ['data-smoke="las-vegas-casino-empty-lane-art"', "mark empty casino lane SVG assets"],
        ['data-smoke="las-vegas-casino-empty-lane-node"', "mark empty casino lane SVG nodes"],
        ['data-smoke="las-vegas-dice-face"', "mark reusable dice SVG assets"],
        ['data-smoke="las-vegas-money-card"', "mark reusable money card assets"],
        ['data-smoke="las-vegas-dice-count-badge"', "mark reusable dice count assets"],
        ["라스베가스", "render Korean money-card label"],
        ["카지노", "render Korean casino-sign label"],
        ["머니 대기", "render Korean empty-money lane copy"],
        ["주사위 대기", "render Korean empty-dice lane copy"],
        ["{count}개", "render Korean dice-count label"],
    ];
    for (const [snippet, description] of requiredVisualSnippets) {
        if (!visualSource.includes(snippet)) {
            throw new Error(`las-vegas-ui-smoke: LasVegasVisuals source must ${description}.`);
        }
    }
    const requiredUxAssetSnippets = [
        ["GameStartReadinessArt", "render start readiness through shared local SVG artwork"],
        ["GameChatEmptyArt", "render chat empty-state through shared local SVG artwork"],
        ["startReadinessArtTones", "derive start readiness SVG tones from readiness item state"],
        ["data-smoke={artSmoke}", "mark the start readiness SVG artwork for route smoke coverage"],
        ["data-smoke={nodeSmoke}", "mark start readiness SVG nodes for route smoke coverage"],
        ['data-can-start={canStart ? "true" : "false"}', "expose start readiness launch state without changing behavior"],
        ['data-smoke="game-chat-empty-state"', "mark the shared chat empty-state shell"],
        ['data-smoke="game-chat-empty-art"', "mark the shared chat empty-state SVG artwork"],
        ['data-smoke="game-chat-empty-node"', "mark the shared chat empty-state SVG nodes"],
        ['data-smoke="game-chat-empty-item"', "mark the shared chat empty-state guidance items"],
        ["chatEmptyTones", "derive chat empty-state palette locally"],
    ];
    for (const [snippet, description] of requiredUxAssetSnippets) {
        if (!uxAssetSource.includes(snippet)) {
            throw new Error(`las-vegas-ui-smoke: GameUxAssets source must ${description}.`);
        }
    }
    if (visualSource.includes(">CASINO<") || visualSource.includes(">Las Vegas<") || visualSource.includes("x{count}")) {
        throw new Error("las-vegas-ui-smoke: LasVegas visual assets must not show English placeholder labels.");
    }
    if (source.includes('label: "WIN"') || source.includes('label: "LEDGER"') || source.includes('label: "ROOM"') || source.includes('label: "NEXT"')) {
        throw new Error("las-vegas-ui-smoke: finished-session action art must use Korean node labels.");
    }
    if (source.includes("subscribeAll")) {
        throw new Error("las-vegas-ui-smoke: LasVegasGame must not keep per-room onConnect subscribeAll closures.");
    }
    if (source.includes('import SockJS from "sockjs-client"') || source.includes('import { Client } from "@stomp/stompjs"')) {
        throw new Error("las-vegas-ui-smoke: LasVegasGame must not statically bundle the STOMP runtime into the route chunk.");
    }
    if (source.includes('notifyError("실시간 연결 오류")')) {
        throw new Error("las-vegas-ui-smoke: LasVegasGame must not show raw repeated realtime error toasts.");
    }
    if (!source.includes("카지노 압력") || !source.includes("우선 후보")) {
        throw new Error("las-vegas-ui-smoke: casino pressure SVG must use Korean in-world labels.");
    }
    if (source.includes("CASINO PRESSURE") || source.includes("BEST LANE") || source.includes('aria-label="Las Vegas casino pressure lens"')) {
        throw new Error("las-vegas-ui-smoke: casino pressure SVG must not show English placeholder labels.");
    }
    if (source.includes(">Casino {casinoNo}<") || source.includes("`Table ${casinoNo}`")) {
        throw new Error("las-vegas-ui-smoke: casino cards must not show English fallback labels.");
    }
    if (source.includes('from "react-hot-toast"') || !source.includes('from "../../utils/toast.js"')) {
        throw new Error("las-vegas-ui-smoke: LasVegasGame must use the dynamic toast helper instead of static react-hot-toast imports.");
    }
    if (!source.includes("key={normalized.key || normalized.id}") || source.includes("key={`${msg.createdAt || idx}-${idx}`}")) {
        throw new Error("las-vegas-ui-smoke: LasVegasGame chat messages must use stable normalized message keys.");
    }
}

class PipeCdp {
    constructor(chrome) {
        this.chrome = chrome;
        this.nextMessageId = 1;
        this.buffer = Buffer.alloc(0);
        this.pending = new Map();
        this.messageHandlers = [];

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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const encodeJson = (value) => Buffer.from(JSON.stringify(value), "utf8").toString("base64");
const encodeText = (value) => Buffer.from(value, "utf8").toString("base64");

const roomSummary = {
    room_id: 51,
    chat_room_id: 951,
    room_code: "LV2026",
    title: "스모크 라스베가스",
    room_status: "WAITING",
    host_member_id: 100,
    min_players: 2,
    max_players: 6,
    round_count: 3,
    turn_time_seconds: 50,
    current_round_no: 0,
    players: [
        { member_id: 100, nickname: "스모크 플레이어", seat_no: 1, ready: false },
    ],
};

const statePayload = {
    event_type: "snapshot",
    room_id: 51,
    room_code: "LV2026",
    room_status: "WAITING",
    phase: "WAITING",
    round_no: 0,
    round_count: 3,
    turn_member_id: null,
    turn_deadline_at: null,
    chat_room_id: 951,
    winner_member_id: null,
    message: "",
    current_roll: [],
    last_placed_member_id: null,
    last_placed_casino_no: null,
    last_placed_dice_count: 0,
    last_placed_at: null,
    players: [
        {
            member_id: 100,
            nickname: "스모크 플레이어",
            seat_no: 1,
            ready: false,
            total_money: 0,
            remaining_dice: 8,
        },
    ],
    casinos: [1, 2, 3, 4, 5, 6].map((casinoNo) => ({
        casino_no: casinoNo,
        money_cards: [70000, 50000],
        total_money: 120000,
        dice_by_player: {},
    })),
};

const finishedStatePayload = {
    ...statePayload,
    room_status: "FINISHED",
    phase: "FINISHED",
    round_no: 3,
    winner_member_id: 100,
    message: "검증 플레이어가 카지노 보상을 가장 많이 모아 우승했습니다.",
    players: [
        {
            member_id: 100,
            nickname: "검증 플레이어",
            seat_no: 1,
            ready: true,
            total_money: 620000,
            remaining_dice: 0,
        },
        {
            member_id: 101,
            nickname: "도전자",
            seat_no: 2,
            ready: true,
            total_money: 420000,
            remaining_dice: 0,
        },
        {
            member_id: 102,
            nickname: "칩 수집가",
            seat_no: 3,
            ready: true,
            total_money: 340000,
            remaining_dice: 0,
        },
    ],
    casinos: [
        { casino_no: 1, money_cards: [80000, 50000], total_money: 130000, dice_by_player: { 100: 4, 101: 2 } },
        { casino_no: 2, money_cards: [90000, 60000], total_money: 150000, dice_by_player: { 101: 3, 102: 1 } },
        { casino_no: 3, money_cards: [70000, 50000], total_money: 120000, dice_by_player: { 100: 2, 102: 2 } },
        { casino_no: 4, money_cards: [100000, 40000], total_money: 140000, dice_by_player: { 100: 3, 101: 1 } },
        { casino_no: 5, money_cards: [80000, 70000], total_money: 150000, dice_by_player: { 102: 4, 100: 1 } },
        { casino_no: 6, money_cards: [110000, 60000], total_money: 170000, dice_by_player: { 100: 5, 101: 5, 102: 2 } },
    ],
};

let lasVegasStateMode = "waiting";
let lasVegasRoomsEmpty = false;

function routeMock(url, method) {
    const { hostname, pathname } = new URL(url);

    if (method === "GET" && hostname === "oapi.map.naver.com") {
        return { status: 200, contentType: "application/javascript; charset=utf-8", bodyText: "" };
    }

    if (method === "GET" && pathname === "/api/members") {
        return {
            status: 200,
            body: {
                data: {
                    member_id: 100,
                    email: "player@example.com",
                    name: "스모크 플레이어",
                    roles: ["ROLE_USER"],
                },
            },
        };
    }

    if (method === "GET" && pathname === "/api/chat/rooms") {
        return { status: 200, body: { data: [] } };
    }

    if (method === "GET" && pathname === "/api/game/las-vegas/rooms") {
        if (lasVegasRoomsEmpty) {
            return { status: 200, body: [] };
        }
        return { status: 200, body: [roomSummary] };
    }

    if (method === "GET" && pathname === "/api/game/las-vegas/rooms/me") {
        return {
            status: 200,
            body: lasVegasStateMode === "finished"
                ? [{
                    ...roomSummary,
                    room_status: "FINISHED",
                    phase: "FINISHED",
                    member_count: finishedStatePayload.players.length,
                    players: finishedStatePayload.players,
                }]
                : [],
        };
    }

    if (method === "POST" && pathname === "/api/game/las-vegas/rooms") {
        return { status: 201, body: roomSummary };
    }

    if (method === "GET" && pathname === "/api/game/las-vegas/rooms/51/state") {
        return { status: 200, body: lasVegasStateMode === "finished" ? finishedStatePayload : statePayload };
    }

    if (method === "PATCH" && pathname === "/api/game/las-vegas/rooms/51/settings") {
        return {
            status: 200,
            body: {
                ...roomSummary,
                round_count: 4,
                turn_time_seconds: 60,
            },
        };
    }

    if (method === "POST" && pathname === "/api/game/las-vegas/rooms/51/ready") {
        return { status: 200, bodyText: "" };
    }

    if (method === "GET" && pathname === "/api/chat/room/951/messages") {
        return {
            status: 200,
            body: {
                data: [],
            },
        };
    }

    if (method === "PATCH" && pathname === "/api/chat/room/951/read") {
        return { status: 204, bodyText: "" };
    }

    return null;
}

async function handleFetchRequest(cdp, sessionId, event) {
    const { requestId, request } = event.params;
    const mock = routeMock(request.url, request.method);
    if (!mock) {
        await cdp.send("Fetch.continueRequest", { requestId }, sessionId);
        return;
    }

    await cdp.send("Fetch.fulfillRequest", {
        requestId,
        responseCode: mock.status,
        responseHeaders: [
            { name: "Content-Type", value: mock.contentType || "application/json; charset=utf-8" },
            { name: "Cache-Control", value: "no-store" },
        ],
        body: mock.bodyText !== undefined ? encodeText(mock.bodyText) : encodeJson(mock.body),
    }, sessionId);
}

async function evaluate(cdp, sessionId, expression) {
    const response = await cdp.send("Runtime.evaluate", {
        awaitPromise: true,
        returnByValue: true,
        expression,
    }, sessionId);
    return response.result?.result?.value;
}

async function waitFor(cdp, sessionId, expression, description, timeoutMs = 7000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (await evaluate(cdp, sessionId, expression)) return;
        await delay(120);
    }
    const pageState = await evaluate(cdp, sessionId, `(() => ({
        href: location.href,
        readyState: document.readyState,
        bodyText: document.body?.innerText?.slice(0, 700) || "",
    }))()`).catch(() => null);
    throw new Error(`Timed out waiting for ${description}${pageState ? `; page: ${JSON.stringify(pageState)}` : ""}`);
}

async function waitForText(cdp, sessionId, text, timeoutMs = 7000) {
    await waitFor(cdp, sessionId, `document.body?.innerText.includes(${JSON.stringify(text)})`, `text: ${text}`, timeoutMs);
}

async function setInputValue(cdp, sessionId, selector, value) {
    const ok = await evaluate(cdp, sessionId, `(() => {
        const input = document.querySelector(${JSON.stringify(selector)});
        if (!input) return false;
        input.focus();
        input.value = ${JSON.stringify(value)};
        const reactPropsKey = Object.keys(input).find((key) => key.startsWith("__reactProps$"));
        const onChange = reactPropsKey ? input[reactPropsKey]?.onChange : null;
        if (typeof onChange === "function") {
            onChange({ currentTarget: input, target: input, preventDefault: () => {}, stopPropagation: () => {} });
            return true;
        }
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
    })()`);
    if (!ok) throw new Error(`Could not set input value: ${selector}`);
}

async function clickButtonByText(cdp, sessionId, text) {
    const ok = await evaluate(cdp, sessionId, `(() => {
        const button = Array.from(document.querySelectorAll("button"))
            .find((node) => node.textContent.includes(${JSON.stringify(text)}) && !node.disabled);
        if (!button) return false;
        button.scrollIntoView({ block: "center", inline: "center" });
        button.click();
        return true;
    })()`);
    if (!ok) throw new Error(`Could not click button: ${text}`);
}

async function assertPageQuality(cdp, sessionId, label) {
    const value = await evaluate(cdp, sessionId, `(() => ({
        text: document.body?.innerText || "",
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body?.scrollWidth || 0,
    }))()`);
    const blocked = blockedTexts.filter((text) => value.text.includes(text));
    if (blocked.length) {
        throw new Error(`${label}: blocked text ${blocked.join(", ")}`);
    }
    const overflow = Math.max(value.scrollWidth, value.bodyWidth) - value.clientWidth;
    if (overflow > 3) {
        throw new Error(`${label}: horizontal overflow ${overflow}px`);
    }
}

async function inspectLasVegasEmptyLobby(cdp, sessionId, viewport) {
    lasVegasStateMode = "waiting";
    lasVegasRoomsEmpty = true;
    try {
        await cdp.send("Emulation.setDeviceMetricsOverride", {
            width: viewport.width,
            height: viewport.height,
            deviceScaleFactor: viewport.mobile ? 2 : 1,
            mobile: viewport.mobile,
        }, sessionId);
        await evaluate(cdp, sessionId, `localStorage.removeItem("las_vegas_last_room_id"); true`);
        await cdp.send("Page.navigate", { url: `${baseUrl}/app/games/las-vegas` }, sessionId);
        await waitForText(cdp, sessionId, "대기 중인 방");
        await waitFor(cdp, sessionId, `document.querySelector('[data-smoke="las-vegas-lobby-empty-state"]')?.getAttribute("data-loading") === "false"`, "las vegas empty lobby rendered");
        const snapshot = await evaluate(cdp, sessionId, `(() => {
            const panel = document.querySelector('[data-smoke="las-vegas-lobby-empty-state"]');
            const director = document.querySelector('[data-smoke="las-vegas-lobby-director-panel"]');
            return {
                mounted: Boolean(panel),
                loading: panel?.getAttribute("data-loading") || "",
                art: document.querySelectorAll('[data-smoke="las-vegas-lobby-empty-art"]').length,
                nodes: document.querySelectorAll('[data-smoke="las-vegas-lobby-empty-node"]').length,
                items: document.querySelectorAll('[data-smoke="las-vegas-lobby-empty-item"]').length,
                refresh: document.querySelectorAll('[data-smoke="las-vegas-lobby-empty-refresh"]').length,
                cards: document.querySelectorAll('[data-smoke="las-vegas-lobby-room-card"]').length,
                directorMounted: Boolean(director),
                directorRoomCount: Number(director?.getAttribute("data-room-count") || 0),
                directorEmpty: document.querySelectorAll('[data-smoke="las-vegas-lobby-director-empty-choice"]').length,
                directorEmptyArt: document.querySelectorAll('[data-smoke="las-vegas-lobby-director-empty-art"]').length,
                directorEmptyNodes: document.querySelectorAll('[data-smoke="las-vegas-lobby-director-empty-node"]').length,
                directorEmptyItems: document.querySelectorAll('[data-smoke="las-vegas-lobby-director-empty-item"]').length,
                directorText: director?.innerText || "",
                text: panel?.innerText || "",
            };
        })()`);
        if (
            !snapshot.mounted
            || snapshot.loading !== "false"
            || snapshot.art < 1
            || snapshot.nodes < 6
            || snapshot.items < 3
            || snapshot.refresh < 1
            || snapshot.cards !== 0
            || !snapshot.directorMounted
            || snapshot.directorRoomCount !== 0
            || snapshot.directorEmpty < 1
            || snapshot.directorEmptyArt < 1
            || snapshot.directorEmptyNodes < 3
            || snapshot.directorEmptyItems < 3
            || !snapshot.directorText.includes("추천할 카지노 테이블이 없습니다")
            || !snapshot.directorText.includes("비어 있는 목록")
            || !snapshot.text.includes("대기방 없음")
            || !snapshot.text.includes("새 방 만들기")
            || !snapshot.text.includes("방코드 입장")
            || !snapshot.text.includes("목록 새로고침")
        ) {
            throw new Error(`las-vegas-ui-smoke: empty lobby guidance missing ${JSON.stringify(snapshot)}`);
        }
        await assertPageQuality(cdp, sessionId, `las-vegas empty lobby ${viewport.name}`);
        return `las vegas empty lobby ${viewport.name}: ok ${viewport.width}`;
    } finally {
        lasVegasRoomsEmpty = false;
    }
}

async function inspectLasVegas(cdp, sessionId, viewport) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.mobile ? 2 : 1,
        mobile: viewport.mobile,
    }, sessionId);

    lasVegasStateMode = "waiting";
    await evaluate(cdp, sessionId, `localStorage.removeItem("las_vegas_last_room_id"); true`);
    await cdp.send("Page.navigate", { url: `${baseUrl}/app/games/las-vegas` }, sessionId);
    await waitForText(cdp, sessionId, "라스베가스 라이브 테이블");
    await waitForText(cdp, sessionId, "방 만들기");
    await waitForText(cdp, sessionId, "대기 중인 방");
    await waitForText(cdp, sessionId, "스모크 라스베가스");
    await waitForText(cdp, sessionId, "코드 LV2026");
    await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-route-artwork"] [data-smoke="tabletop-game-artwork"]'))`, "las vegas route artwork rendered");
    await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-room-setup-panel"]'))`, "las vegas room setup rendered");
    await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="las-vegas-room-setup-panel"] [data-smoke="las-vegas-room-setup-item"]').length >= 4`, "las vegas room setup items rendered");
    await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-setup-preview-panel"]'))`, "las vegas create setup preview rendered");
    const setupPreviewSnapshot = await evaluate(cdp, sessionId, `(() => {
        const panel = document.querySelector('[data-smoke="las-vegas-setup-preview-panel"]');
        return {
            mounted: Boolean(panel),
            art: document.querySelectorAll('[data-smoke="las-vegas-setup-preview-art"]').length,
            nodes: document.querySelectorAll('[data-smoke="las-vegas-setup-preview-node"]').length,
            items: document.querySelectorAll('[data-smoke="las-vegas-setup-preview-item"]').length,
            roundCount: panel?.getAttribute("data-round-count") || "",
            turnTime: panel?.getAttribute("data-turn-time") || "",
            text: panel?.textContent || "",
        };
    })()`);
    if (
        !setupPreviewSnapshot.mounted
        || setupPreviewSnapshot.art < 1
        || setupPreviewSnapshot.nodes < 6
        || setupPreviewSnapshot.items < 4
        || setupPreviewSnapshot.roundCount !== "3"
        || setupPreviewSnapshot.turnTime !== "50"
        || !/생성 전 카지노 브리핑|라운드 압력|턴 템포/.test(setupPreviewSnapshot.text)
    ) {
        throw new Error(`las-vegas-ui-smoke: create setup preview missing ${JSON.stringify(setupPreviewSnapshot)}`);
    }
    await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-join-code-panel"]'))`, "las vegas join-code bridge rendered");
    const joinCodeSnapshot = await evaluate(cdp, sessionId, `(() => {
        const panel = document.querySelector('[data-smoke="las-vegas-join-code-panel"]');
        const input = document.querySelector('[data-smoke="las-vegas-join-code-input"]');
        return {
            mounted: Boolean(panel),
            art: document.querySelectorAll('[data-smoke="las-vegas-join-code-art"]').length,
            nodes: document.querySelectorAll('[data-smoke="las-vegas-join-code-node"]').length,
            input: document.querySelectorAll('[data-smoke="las-vegas-join-code-input"]').length,
            submit: document.querySelectorAll('[data-smoke="las-vegas-join-code-submit"]').length,
            status: document.querySelectorAll('[data-smoke="las-vegas-join-code-status"]').length,
            placeholder: input?.getAttribute("placeholder") || "",
            text: panel?.textContent || "",
        };
    })()`);
    if (
        !joinCodeSnapshot.mounted
        || joinCodeSnapshot.art < 1
        || joinCodeSnapshot.nodes < 3
        || joinCodeSnapshot.input < 1
        || joinCodeSnapshot.submit < 1
        || joinCodeSnapshot.status < 1
        || joinCodeSnapshot.placeholder !== "방코드"
        || !joinCodeSnapshot.text.includes("카지노 초대 코드")
    ) {
        throw new Error(`las-vegas-ui-smoke: join-code bridge missing ${JSON.stringify(joinCodeSnapshot)}`);
    }
    await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-lobby-director-panel"]'))`, "las vegas lobby director rendered");
    const lobbyDirectorSnapshot = await evaluate(cdp, sessionId, `(() => {
        const panel = document.querySelector('[data-smoke="las-vegas-lobby-director-panel"]');
        return {
            mounted: Boolean(panel),
            roomCount: Number(panel?.getAttribute("data-room-count") || 0),
            recommended: panel?.getAttribute("data-recommended-room") || "",
            art: document.querySelectorAll('[data-smoke="las-vegas-lobby-director-art"]').length,
            nodes: document.querySelectorAll('[data-smoke="las-vegas-lobby-director-node"]').length,
            items: document.querySelectorAll('[data-smoke="las-vegas-lobby-director-item"]').length,
            choices: document.querySelectorAll('[data-smoke="las-vegas-lobby-director-choice"]').length,
            join: document.querySelectorAll('[data-smoke="las-vegas-lobby-director-join"]').length,
            text: panel?.innerText || "",
        };
    })()`);
    if (
        !lobbyDirectorSnapshot.mounted
        || lobbyDirectorSnapshot.roomCount < 1
        || !lobbyDirectorSnapshot.recommended
        || lobbyDirectorSnapshot.art < 1
        || lobbyDirectorSnapshot.nodes < 4
        || lobbyDirectorSnapshot.items < 4
        || lobbyDirectorSnapshot.choices < 1
        || lobbyDirectorSnapshot.join < 1
        || !lobbyDirectorSnapshot.text.includes("카지노 테이블 브리프")
        || !lobbyDirectorSnapshot.text.includes("바로 입장 후보")
    ) {
        throw new Error(`las-vegas-ui-smoke: lobby director missing ${JSON.stringify(lobbyDirectorSnapshot)}`);
    }
    await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-lobby-room-card"]'))`, "las vegas lobby room card rendered");
    const lobbyRoomSnapshot = await evaluate(cdp, sessionId, `(() => {
        const card = document.querySelector('[data-smoke="las-vegas-lobby-room-card"]');
        return {
            cards: document.querySelectorAll('[data-smoke="las-vegas-lobby-room-card"]').length,
            art: document.querySelectorAll('[data-smoke="las-vegas-lobby-room-card-art"]').length,
            nodes: document.querySelectorAll('[data-smoke="las-vegas-lobby-room-card-node"]').length,
            cardSeats: document.querySelectorAll('[data-smoke="las-vegas-lobby-room-card-seat"]').length,
            stateCards: document.querySelectorAll('[data-smoke="las-vegas-lobby-room-card"][data-room-status][data-joinable]').length,
            decisionRails: document.querySelectorAll('[data-smoke="las-vegas-lobby-room-decision-rail"]').length,
            decisionItems: document.querySelectorAll('[data-smoke="las-vegas-lobby-room-decision-item"]').length,
            decisionKeys: Array.from(document.querySelectorAll('[data-smoke="las-vegas-lobby-room-decision-item"]')).map((item) => item.dataset.decisionKey),
            readiness: document.querySelectorAll('[data-smoke="las-vegas-lobby-room-readiness"]').length,
            action: document.querySelectorAll('[data-smoke="las-vegas-lobby-room-action-signal"]').length,
            slots: document.querySelectorAll('[data-smoke="las-vegas-lobby-room-slot"]').length,
            primary: document.querySelectorAll('[data-smoke="las-vegas-lobby-room-primary"]').length,
            text: card?.innerText || "",
        };
    })()`);
    if (
        lobbyRoomSnapshot.cards < 1
        || lobbyRoomSnapshot.art < 1
        || lobbyRoomSnapshot.nodes < 4
        || lobbyRoomSnapshot.cardSeats < 1
        || lobbyRoomSnapshot.stateCards < lobbyRoomSnapshot.cards
        || lobbyRoomSnapshot.decisionRails < lobbyRoomSnapshot.cards
        || lobbyRoomSnapshot.decisionItems < lobbyRoomSnapshot.cards * 4
        || !["access", "seat", "ready", "rule"].every((key) => lobbyRoomSnapshot.decisionKeys.includes(key))
        || lobbyRoomSnapshot.readiness < 1
        || lobbyRoomSnapshot.action < 1
        || lobbyRoomSnapshot.slots < 1
        || lobbyRoomSnapshot.primary < 1
        || !lobbyRoomSnapshot.text.includes("입장 판단")
        || !lobbyRoomSnapshot.text.includes("규칙")
        || !lobbyRoomSnapshot.text.includes("인원 1/2")
        || !lobbyRoomSnapshot.text.includes("합류 추천")
    ) {
        throw new Error(`las-vegas-ui-smoke: enhanced lobby room card missing guidance ${JSON.stringify(lobbyRoomSnapshot)}`);
    }

    if (viewport.interactive) {
        await setInputValue(cdp, sessionId, "input[placeholder='새 방 제목']", "스모크 라스베가스");
        await clickButtonByText(cdp, sessionId, "방 만들기");
        await waitForText(cdp, sessionId, "방 코드 LV2026");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-room-artwork"] [data-smoke="tabletop-game-artwork"]'))`, "las vegas selected room artwork rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="game-chat-empty-state"][data-chat-game="las-vegas"]'))`, "las vegas chat empty state rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="game-chat-empty-art"][data-chat-game="las-vegas"]'))`, "las vegas chat empty SVG rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="game-chat-empty-state"][data-chat-game="las-vegas"] [data-smoke="game-chat-empty-node"]').length >= 4`, "las vegas chat empty SVG nodes rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="game-chat-empty-state"][data-chat-game="las-vegas"] [data-smoke="game-chat-empty-item"]').length >= 3`, "las vegas chat empty guidance items rendered");
        const chatEmptySnapshot = await evaluate(cdp, sessionId, `(() => {
            const panel = document.querySelector('[data-smoke="game-chat-empty-state"][data-chat-game="las-vegas"]');
            return {
                art: document.querySelectorAll('[data-smoke="game-chat-empty-art"][data-chat-game="las-vegas"]').length,
                nodes: panel?.querySelectorAll('[data-smoke="game-chat-empty-node"]').length || 0,
                items: panel?.querySelectorAll('[data-smoke="game-chat-empty-item"]').length || 0,
                text: panel?.textContent || "",
            };
        })()`);
        if (
            chatEmptySnapshot.art < 1
            || chatEmptySnapshot.nodes < 4
            || chatEmptySnapshot.items < 3
            || !chatEmptySnapshot.text.includes("아직 채팅 내역이 없습니다")
            || !chatEmptySnapshot.text.includes("배팅 방향")
            || !chatEmptySnapshot.text.includes("준비 확인")
        ) {
            throw new Error(`las-vegas-ui-smoke: chat empty state missing guidance ${JSON.stringify(chatEmptySnapshot)}`);
        }
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-start-readiness-panel"]'))`, "las vegas start readiness rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-start-readiness-panel-art"]'))`, "las vegas start readiness artwork rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="las-vegas-start-readiness-panel-node"]').length >= 4`, "las vegas start readiness artwork nodes rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="las-vegas-start-readiness-panel"] [data-smoke="las-vegas-start-readiness-item"]').length >= 4`, "las vegas start readiness items rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-session-route-panel"]'))`, "las vegas session button route rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-session-route-art"]'))`, "las vegas session button route SVG rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="las-vegas-session-route-node"]').length >= 4`, "las vegas session button route SVG nodes rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="las-vegas-session-route-item"]').length >= 4`, "las vegas session button route items rendered");
        const sessionRouteSnapshot = await evaluate(cdp, sessionId, `(() => {
            const panel = document.querySelector('[data-smoke="las-vegas-session-route-panel"]');
            return {
                mounted: Boolean(panel),
                art: Boolean(document.querySelector('[data-smoke="las-vegas-session-route-art"]')),
                nodes: document.querySelectorAll('[data-smoke="las-vegas-session-route-node"]').length,
                items: document.querySelectorAll('[data-smoke="las-vegas-session-route-item"]').length,
                roomStatus: panel?.getAttribute("data-room-status") || "",
                canStart: panel?.getAttribute("data-can-start") || "",
                host: panel?.getAttribute("data-host") || "",
                forceFinishing: panel?.getAttribute("data-force-finishing") || "",
                rematching: panel?.getAttribute("data-rematching") || "",
                keys: Array.from(document.querySelectorAll('[data-smoke="las-vegas-session-route-item"]')).map((node) => node.getAttribute("data-route-key")),
                text: panel?.textContent || "",
            };
        })()`);
        if (
            !sessionRouteSnapshot.mounted
            || !sessionRouteSnapshot.art
            || sessionRouteSnapshot.nodes < 4
            || sessionRouteSnapshot.items < 4
            || !sessionRouteSnapshot.roomStatus
            || !["true", "false"].includes(sessionRouteSnapshot.canStart)
            || !["true", "false"].includes(sessionRouteSnapshot.host)
            || !["true", "false"].includes(sessionRouteSnapshot.forceFinishing)
            || !["true", "false"].includes(sessionRouteSnapshot.rematching)
            || !["state", "ready", "primary", "exit"].every((key) => sessionRouteSnapshot.keys.includes(key))
            || !["라스베가스 세션 버튼 루트", "실제 버튼 안내", "준비 버튼", "퇴장 버튼"].every((text) => sessionRouteSnapshot.text.includes(text))
        ) {
            throw new Error(`las-vegas-ui-smoke: session button route artwork missing ${JSON.stringify(sessionRouteSnapshot)}`);
        }
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-turn-rail-panel"]'))`, "las vegas turn rail rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-turn-rail-art"]'))`, "las vegas turn rail SVG rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="las-vegas-turn-rail-node"]').length >= 2`, "las vegas turn rail nodes rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="las-vegas-turn-rail-tile"]').length >= 4`, "las vegas turn rail tiles rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="las-vegas-turn-rail-player"]').length >= 1`, "las vegas turn rail players rendered");
        await waitFor(cdp, sessionId, `/카지노 턴 레일|현재 차례|좌석/.test(document.querySelector('[data-smoke="las-vegas-turn-rail-panel"]')?.textContent || "")`, "las vegas turn rail copy rendered");
        await waitForText(cdp, sessionId, "라운드 0 / 3");
        await waitForText(cdp, sessionId, "판단 보조");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-progress-digest-panel"]'))`, "las vegas progress digest rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-progress-digest-art"]'))`, "las vegas progress digest SVG rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="las-vegas-progress-digest-node"]').length >= 4`, "las vegas progress digest nodes rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="las-vegas-progress-digest-item"]').length >= 4`, "las vegas progress digest items rendered");
        const progressDigestSnapshot = await evaluate(cdp, sessionId, `(() => {
            const panel = document.querySelector('[data-smoke="las-vegas-progress-digest-panel"]');
            return {
                status: panel?.getAttribute("data-status") || "",
                roundNo: Number(panel?.getAttribute("data-round-no") || 0),
                rollCount: Number(panel?.getAttribute("data-roll-count") || 0),
                placedCount: Number(panel?.getAttribute("data-placed-count") || 0),
                keys: Array.from(document.querySelectorAll('[data-smoke="las-vegas-progress-digest-item"]')).map((node) => node.getAttribute("data-digest-key")),
                text: panel?.textContent || "",
            };
        })()`);
        if (
            !progressDigestSnapshot.status
            || progressDigestSnapshot.roundNo < 0
            || progressDigestSnapshot.rollCount < 0
            || progressDigestSnapshot.placedCount < 0
            || !["latest", "actor", "density", "phase"].every((key) => progressDigestSnapshot.keys.includes(key))
            || !/최근 진행 요약|방금 무엇이 바뀌었나|최근 진행/.test(progressDigestSnapshot.text)
        ) {
            throw new Error(`las-vegas-ui-smoke: progress digest missing ${JSON.stringify(progressDigestSnapshot)}`);
        }
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-decision-panel"]'))`, "las vegas decision panel rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-flow-meter"]'))`, "las vegas flow meter rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="las-vegas-flow-meter"] [data-smoke="game-flow-meter-item"]').length >= 4`, "las vegas flow meter items rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-casino-pressure-panel"]'))`, "las vegas casino pressure lens rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-casino-pressure-art"]'))`, "las vegas casino pressure SVG rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="las-vegas-casino-pressure-item"]').length >= 4`, "las vegas casino pressure items rendered");
        await waitFor(cdp, sessionId, `/카지노 압력 렌즈|우선 후보|동점 위험/.test(document.querySelector('[data-smoke="las-vegas-casino-pressure-panel"]')?.textContent || "")`, "las vegas casino pressure copy rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-settlement-ledger-panel"]'))`, "las vegas settlement ledger rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-settlement-ledger-art"]'))`, "las vegas settlement ledger SVG rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="las-vegas-settlement-casino-node"]').length >= 6`, "las vegas settlement casino nodes rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="las-vegas-settlement-ledger-item"]').length >= 4`, "las vegas settlement ledger items rendered");
        await waitFor(cdp, sessionId, `/라스베가스 정산 렌즈|동점 제거|총 보유금/.test(document.querySelector('[data-smoke="las-vegas-settlement-ledger-panel"]')?.textContent || "")`, "las vegas settlement ledger copy rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-action-cue-bar"]'))`, "las vegas action cue bar rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="las-vegas-action-cue-bar"] [data-smoke="game-action-cue-item"]').length >= 3`, "las vegas action cue items rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-action-feedback"]'))`, "las vegas action feedback rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="las-vegas-action-feedback"] [data-smoke="game-feedback-item"]').length >= 4`, "las vegas action feedback items rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-action-route-panel"]'))`, "las vegas action route rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-action-route-art"]'))`, "las vegas action route SVG rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="las-vegas-action-route-node"]').length >= 4`, "las vegas action route SVG nodes rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="las-vegas-action-route-item"]').length >= 4`, "las vegas action route items rendered");
        const actionRouteSnapshot = await evaluate(cdp, sessionId, `(() => {
            const panel = document.querySelector('[data-smoke="las-vegas-action-route-panel"]');
            return {
                mounted: Boolean(panel),
                art: Boolean(document.querySelector('[data-smoke="las-vegas-action-route-art"]')),
                nodes: document.querySelectorAll('[data-smoke="las-vegas-action-route-node"]').length,
                items: document.querySelectorAll('[data-smoke="las-vegas-action-route-item"]').length,
                roomStatus: panel?.getAttribute("data-room-status") || "",
                myTurn: panel?.getAttribute("data-my-turn") || "",
                canRoll: panel?.getAttribute("data-can-roll") || "",
                canBet: panel?.getAttribute("data-can-bet") || "",
                rolledDice: Number(panel?.getAttribute("data-rolled-dice") || 0),
                round: panel?.getAttribute("data-round") || "",
                keys: Array.from(document.querySelectorAll('[data-smoke="las-vegas-action-route-item"]')).map((node) => node.getAttribute("data-route-key")),
                text: panel?.textContent || "",
            };
        })()`);
        if (
            !actionRouteSnapshot.mounted
            || !actionRouteSnapshot.art
            || actionRouteSnapshot.nodes < 4
            || actionRouteSnapshot.items < 4
            || !actionRouteSnapshot.roomStatus
            || !["true", "false"].includes(actionRouteSnapshot.myTurn)
            || !["true", "false"].includes(actionRouteSnapshot.canRoll)
            || !["true", "false"].includes(actionRouteSnapshot.canBet)
            || actionRouteSnapshot.rolledDice < 0
            || !actionRouteSnapshot.round
            || !["turn", "roll", "casino", "result"].every((key) => actionRouteSnapshot.keys.includes(key))
            || !["라스베가스 액션 루트", "차례 확인", "주사위 굴림", "카지노 선택", "다음 정산"].every((text) => actionRouteSnapshot.text.includes(text))
        ) {
            throw new Error(`las-vegas-ui-smoke: action route artwork missing ${JSON.stringify(actionRouteSnapshot)}`);
        }
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-action-availability-panel"]'))`, "las vegas action availability rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-action-availability-art"]'))`, "las vegas action availability SVG rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="las-vegas-action-availability-node"]').length >= 4`, "las vegas action availability SVG nodes rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="las-vegas-action-availability-item"]').length >= 2`, "las vegas action availability items rendered");
        const actionAvailabilitySnapshot = await evaluate(cdp, sessionId, `(() => {
            const panel = document.querySelector('[data-smoke="las-vegas-action-availability-panel"]');
            const art = document.querySelector('[data-smoke="las-vegas-action-availability-art"]');
            return {
                mounted: Boolean(panel),
                art: Boolean(art),
                nodes: document.querySelectorAll('[data-smoke="las-vegas-action-availability-node"]').length,
                items: document.querySelectorAll('[data-smoke="las-vegas-action-availability-item"]').length,
                rollButton: document.querySelectorAll('[data-smoke="las-vegas-roll-action"]').length,
                betButtons: document.querySelectorAll('[data-smoke="las-vegas-bet-action"]').length,
                roomStatus: panel?.getAttribute("data-room-status") || "",
                canRoll: panel?.getAttribute("data-can-roll") || "",
                canBet: panel?.getAttribute("data-can-bet") || "",
                myTurn: panel?.getAttribute("data-my-turn") || "",
                rolledDice: Number(panel?.getAttribute("data-rolled-dice") || 0),
                keys: Array.from(document.querySelectorAll('[data-smoke="las-vegas-action-availability-node"]')).map((node) => node.getAttribute("data-action-key")),
                text: panel?.textContent || "",
            };
        })()`);
        if (
            !actionAvailabilitySnapshot.mounted
            || !actionAvailabilitySnapshot.art
            || actionAvailabilitySnapshot.nodes < 4
            || actionAvailabilitySnapshot.items < 2
            || actionAvailabilitySnapshot.rollButton < 1
            || !actionAvailabilitySnapshot.roomStatus
            || !["true", "false"].includes(actionAvailabilitySnapshot.canRoll)
            || !["true", "false"].includes(actionAvailabilitySnapshot.canBet)
            || !["true", "false"].includes(actionAvailabilitySnapshot.myTurn)
            || actionAvailabilitySnapshot.rolledDice < 0
            || !["turn", "roll", "candidate", "casino"].every((key) => actionAvailabilitySnapshot.keys.includes(key))
            || !actionAvailabilitySnapshot.text.includes("굴림 → 후보 → 카지노")
            || !/같은 눈 모두 배팅|먼저 굴리기|행동 대기/.test(actionAvailabilitySnapshot.text)
        ) {
            throw new Error(`las-vegas-ui-smoke: action availability artwork missing ${JSON.stringify(actionAvailabilitySnapshot)}`);
        }
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-roll-standby-panel"]'))`, "las vegas empty public-roll guidance rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-roll-standby-art"]'))`, "las vegas empty public-roll SVG rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="las-vegas-roll-standby-node"]').length >= 4`, "las vegas empty public-roll SVG nodes rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="las-vegas-roll-standby-item"]').length >= 4`, "las vegas empty public-roll guidance items rendered");
        await waitFor(cdp, sessionId, `/공개 주사위 없음|굴림 전 보드 상태|주사위 굴리기/.test(document.querySelector('[data-smoke="las-vegas-roll-standby-panel"]')?.textContent || "")`, "las vegas empty public-roll Korean copy rendered");
        await waitForText(cdp, sessionId, "행동 가능성");
        await waitForText(cdp, sessionId, "굴리기 조건");
        await waitForText(cdp, sessionId, "배팅 조건");
        await waitForText(cdp, sessionId, "벨라지오");
        await waitFor(cdp, sessionId, `(() => {
            const panels = [...document.querySelectorAll('[data-smoke="las-vegas-casino-panel"]')];
            return panels.length >= 6
                && panels.every((panel) => /\\d번 카지노/.test(panel.textContent || ""))
                && panels.every((panel) => !/Casino\\s+\\d|Table\\s+\\d/.test(panel.textContent || ""));
        })()`, "las vegas casino panels use Korean labels");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="las-vegas-casino-sign-art"]').length >= 6`, "las vegas casino sign SVG assets rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="las-vegas-casino-empty-lane"][data-lane="dice"]').length >= 1`, "las vegas empty casino dice lanes rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="las-vegas-casino-empty-lane-art"]').length >= 1`, "las vegas empty casino lane SVG rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="las-vegas-casino-empty-lane-node"]').length >= 2`, "las vegas empty casino lane SVG nodes rendered");
        await waitFor(cdp, sessionId, `/주사위 대기|첫 배팅/.test(document.querySelector('[data-smoke="las-vegas-casino-empty-lane"][data-lane="dice"]')?.textContent || "")`, "las vegas empty casino lane copy rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="las-vegas-money-card"]').length >= 6`, "las vegas money card assets rendered");
        await waitForText(cdp, sessionId, "스모크 플레이어");
        await clickButtonByText(cdp, sessionId, "방 설정 저장");
        await waitForText(cdp, sessionId, "설정 저장 완료");
        await waitForText(cdp, sessionId, "60초");
        await clickButtonByText(cdp, sessionId, "준비하기");
        lasVegasStateMode = "finished";
        await evaluate(cdp, sessionId, `localStorage.setItem("las_vegas_last_room_id", "51"); true`);
        await cdp.send("Page.navigate", { url: `${baseUrl}/app/games/las-vegas` }, sessionId);
        await waitForText(cdp, sessionId, "검증 플레이어");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-result-spotlight"]'))`, "las vegas result spotlight rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-session-action-panel"]'))`, "las vegas finished-session action panel rendered");
        await waitFor(cdp, sessionId, `document.querySelector('[data-smoke="las-vegas-session-action-panel"]')?.getAttribute("data-session-status") === "FINISHED"`, "las vegas finished-session status rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-session-action-art"]'))`, "las vegas finished-session SVG rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="las-vegas-session-action-node"]').length >= 4`, "las vegas finished-session SVG nodes rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="las-vegas-session-action-item"]').length >= 4`, "las vegas finished-session action items rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-session-action-refresh"]'))`, "las vegas finished-session refresh action rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-session-action-rematch"]'))`, "las vegas finished-session rematch action rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-session-action-hub"]'))`, "las vegas finished-session hub action rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="las-vegas-session-action-leave"]'))`, "las vegas finished-session leave action rendered");
        await waitFor(cdp, sessionId, `/라스베가스 종료 세션 플랜|종료 세션|재대결/.test(document.querySelector('[data-smoke="las-vegas-session-action-panel"]')?.textContent || "")`, "las vegas finished-session copy rendered");
    }

    await assertPageQuality(cdp, sessionId, `las vegas ${viewport.name}`);
    return `las vegas ${viewport.name}: ok`;
}

async function main() {
    assertLasVegasRealtimeSource();
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

    if (debug) {
        chrome.stderr.on("data", (chunk) => process.stderr.write(chunk));
    } else {
        chrome.stderr.on("data", () => {});
    }

    const waitForChromeExit = () => new Promise((resolve) => {
        if (chrome.exitCode !== null) {
            resolve();
            return;
        }
        chrome.once("exit", resolve);
    });

    const cdp = new PipeCdp(chrome);
    let sessionId = null;
    const runtimeErrors = [];

    try {
        await cdp.send("Browser.getVersion");
        const targetResponse = await cdp.send("Target.createTarget", { url: "about:blank" });
        const targetId = targetResponse.result?.targetId;
        if (!targetId) throw new Error("Could not create Chrome target for las-vegas smoke test.");
        const attachResponse = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
        sessionId = attachResponse.result?.sessionId;
        if (!sessionId) throw new Error("Could not attach to Chrome target for las-vegas smoke test.");

        cdp.onMessage((message) => {
            if (message.sessionId !== sessionId) return;
            if (message.method === "Fetch.requestPaused") {
                handleFetchRequest(cdp, sessionId, message).catch((error) => {
                    if (!String(error.message || "").includes("Invalid InterceptionId")) {
                        runtimeErrors.push(error.message);
                    }
                });
            } else if (message.method === "Runtime.exceptionThrown") {
                runtimeErrors.push(message.params?.exceptionDetails?.text || "Runtime exception");
            }
        });

        await cdp.send("Page.enable", {}, sessionId);
        await cdp.send("Runtime.enable", {}, sessionId);
        await cdp.send("Fetch.enable", {
            patterns: [
                { urlPattern: "*://localhost*/api/*", requestStage: "Request" },
                { urlPattern: "*://127.0.0.1*/api/*", requestStage: "Request" },
                { urlPattern: "https://oapi.map.naver.com/*", requestStage: "Request" },
            ],
        }, sessionId);
        await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
            source: `
                localStorage.setItem("accessToken", "smoke-access-token");
                localStorage.setItem("refreshToken", "smoke-refresh-token");
                localStorage.setItem("userRoles", JSON.stringify(["ROLE_USER"]));
                localStorage.removeItem("las_vegas_last_room_id");
            `,
        }, sessionId);

        const results = [];
        for (const viewport of viewports) {
            results.push(await inspectLasVegasEmptyLobby(cdp, sessionId, viewport));
            results.push(await inspectLasVegas(cdp, sessionId, viewport));
        }
        if (runtimeErrors.length) {
            throw new Error(`Runtime errors: ${runtimeErrors.join(" | ")}`);
        }
        results.forEach((result) => console.log(result));
        console.log(`las-vegas-ui-smoke ok (${results.length} responsive checks)`);
    } finally {
        if (chrome.exitCode === null) {
            chrome.kill();
            await Promise.race([waitForChromeExit(), delay(1500)]);
        }
        for (let attempt = 1; attempt <= 5; attempt += 1) {
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
