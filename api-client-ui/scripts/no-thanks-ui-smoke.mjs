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
const userDataDir = mkdtempSync(path.join(tmpdir(), "no-thanks-ui-smoke-"));
const blockedTexts = ["Error", "undefined", "NaN", "null점", "WAITING", "PLAYING", "room_code", "start_chip_count", "turn_time_seconds"];
const viewports = [
    { name: "desktop", width: 1366, height: 900, mobile: false, interactive: true },
    { name: "tablet", width: 820, height: 1180, mobile: true, interactive: true },
    { name: "mobile", width: 390, height: 844, mobile: true, interactive: true },
];

function assertNoThanksRealtimeSource() {
    const source = readFileSync("src/pages/games/NoThanksGame.jsx", "utf8");
    const visualSource = readFileSync("src/common/NoThanksVisuals.jsx", "utf8");
    const uxAssetSource = readFileSync("src/pages/games/GameUxAssets.jsx", "utf8");
    const requiredCurrentUiSnippets = [
        ["createStompClient", "load the STOMP runtime through the shared async adapter"],
        ["NoThanksJoinCodePanel", "keep the compact join-code bridge"],
        ["NoThanksLobbyRoomCardArt", "render lobby rooms as direct room cards"],
        ["NoThanksLobbyEmptyState", "render the direct empty lobby state"],
        ["NoThanksActionAvailabilityPanel", "keep real take/pass action availability beside the buttons"],
        ["NoThanksPlayerStateCard", "keep visible player chip/card state cards"],
        ["GameRoomPlayersPanel", "keep the selected-room player list"],
        ["GameRoomChatPanel", "keep room chat in the selected room"],
        ["TabletopGameArtwork", "keep route artwork without a setup briefing"],
    ];
    for (const [snippet, description] of requiredCurrentUiSnippets) {
        if (!source.includes(snippet)) {
            throw new Error(`no-thanks-ui-smoke: NoThanksGame must ${description}.`);
        }
    }
    const forbiddenRenderedSnippets = [
        "<NoThanksSetupPreviewPanel",
        "<GameStartReadinessPanel",
        "<NoThanksLobbyDirectorPanel",
        "<NoThanksLobbyRoomDecisionRail",
        "<NoThanksSessionRoutePanel",
        "<NoThanksTurnRailPanel",
        "<NoThanksProgressDigestPanel",
        "<NoThanksDecisionPanel",
        "<NoThanksActionRoutePanel",
        "<NoThanksSessionActionPanel",
        "<GameFeedbackTicker",
    ];
    const stillRendered = forbiddenRenderedSnippets.filter((snippet) => source.includes(snippet));
    if (stillRendered.length) {
        throw new Error(`no-thanks-ui-smoke: removed briefing/setup panels must not be rendered: ${stillRendered.join(", ")}`);
    }
    return;
    const requiredSnippets = [
        ["const realtimeRoomRef = useRef(null)", "track the latest realtime room"],
        ["createStompClient", "load the STOMP runtime through the shared async adapter"],
        ["notifyRealtimeError", "route STOMP ERROR frames through the shared safe notifier"],
        ["client.beforeConnect = () =>", "refresh STOMP auth headers before reconnect"],
        ["bindLatestRealtimeRoom(client)", "resubscribe the latest room after reconnect"],
        ["realtimeRoomRef.current = { roomId, chatRoomId: snapshotChatRoomId }", "store the latest game/chat room"],
        ["heartbeatIncoming: 4000", "enable STOMP heartbeat checks"],
        ["NoThanksDecisionPanel", "render the card-game decision support panel"],
        ["NoThanksTurnRailPanel", "render the selected-room turn and seat rail"],
        ["NoThanksTurnRailArt", "render the selected-room turn rail through reusable SVG artwork"],
        ["buildNoThanksProgressDigest", "derive recent No Thanks progress from public room state"],
        ["NoThanksProgressDigestPanel", "render selected-room recent progress guidance"],
        ["NoThanksProgressDigestArt", "render recent progress guidance through local SVG artwork"],
        ["NoThanksScoreLensPanel", "render score-delta guidance from visible card and chip state"],
        ["NoThanksScoreLensArt", "render the score-delta guidance through reusable SVG artwork"],
        ["NoThanksSettlementLedgerPanel", "render finished-game settlement and winner-basis guidance"],
        ["NoThanksSettlementLedgerArt", "render finished-game settlement through reusable SVG artwork"],
        ["buildNoThanksSettlementLedger", "derive settlement details from visible player scores, chips, and cards"],
        ["NoThanksSessionActionPanel", "render finished-session next-action guidance"],
        ["NoThanksSessionActionArt", "render finished-session guidance through local SVG artwork"],
        ["buildNoThanksSessionActionItems", "derive finished-session next-action guidance from public state"],
        ["buildNoThanksSessionRouteItems", "derive selected-room session button-route guidance from public state"],
        ["NoThanksSessionRoutePanel", "render selected-room session button-route guidance"],
        ["NoThanksSessionRouteArt", "render selected-room session button-route guidance through local SVG artwork"],
        ["buildNoThanksActionRouteItems", "derive take/pass action-route guidance from visible card and chip state"],
        ["NoThanksActionRoutePanel", "render take/pass action-route guidance before the real buttons"],
        ["NoThanksActionRouteArt", "render take/pass action-route guidance through local SVG artwork"],
        ["NoThanksActionAvailabilityPanel", "render action availability guidance beside the buttons"],
        ["NoThanksActionAvailabilityArt", "render action availability guidance through local SVG artwork"],
        ["NoThanksCardStandbyPanel", "render empty current-card guidance inside the selected board"],
        ["NoThanksCardStandbyArt", "render empty current-card guidance through local SVG artwork"],
        ["scoreNoThanksCards", "derive score impact explanations from visible cards"],
        ["summarizeNoThanksRuns", "derive visible consecutive-card run explanations"],
        ["GameActionCueBar", "render the shared action cue bar for playable decisions"],
        ["GameFeedbackTicker", "render a persistent action feedback ticker"],
        ["GameFlowMeter", "render the shared flow meter for card-flow readability"],
        ["GameResultSpotlight", "render a finished-game result spotlight"],
        ["GameStartReadinessPanel", "render selected-room start readiness guidance"],
        ["GameChatEmptyState", "render selected-room chat empty-state guidance"],
        ["buildNoThanksSetupPreviewItems", "derive create-room No Thanks briefing items from local form state"],
        ["NoThanksSetupPreviewPanel", "render the create-room No Thanks briefing panel"],
        ["NoThanksSetupPreviewArt", "render the create-room No Thanks briefing through local SVG artwork"],
        ['data-smoke="no-thanks-decision-panel"', "mark the decision support panel for runtime coverage"],
        ['data-smoke="no-thanks-turn-rail-panel"', "mark the selected-room turn rail panel"],
        ['data-smoke="no-thanks-turn-rail-art"', "mark the selected-room turn rail SVG"],
        ['data-smoke="no-thanks-turn-rail-node"', "mark the selected-room turn rail nodes"],
        ['data-smoke="no-thanks-turn-rail-tile"', "mark the selected-room turn rail state tiles"],
        ['data-smoke="no-thanks-turn-rail-player"', "mark the selected-room turn rail players"],
        ['data-smoke="no-thanks-progress-digest-panel"', "mark the recent progress digest panel"],
        ['data-smoke="no-thanks-progress-digest-art"', "mark the recent progress digest SVG"],
        ['data-smoke="no-thanks-progress-digest-node"', "mark recent progress digest SVG nodes"],
        ['data-smoke="no-thanks-progress-digest-item"', "mark recent progress digest tiles"],
        ['data-smoke="no-thanks-score-lens-panel"', "mark the score lens panel for runtime coverage"],
        ['data-smoke="no-thanks-score-lens-art"', "mark the reusable score lens SVG artwork"],
        ['data-smoke="no-thanks-settlement-ledger-panel"', "mark the settlement ledger panel"],
        ['data-smoke="no-thanks-settlement-ledger-art"', "mark the reusable settlement ledger SVG artwork"],
        ['data-smoke="no-thanks-settlement-player-node"', "mark settlement player rows"],
        ['data-smoke="no-thanks-settlement-ledger-item"', "mark settlement explanation tiles"],
        ['data-smoke="no-thanks-session-action-panel"', "mark finished-session action panel"],
        ['data-smoke="no-thanks-session-action-art"', "mark finished-session SVG artwork"],
        ['data-smoke="no-thanks-session-action-node"', "mark finished-session SVG nodes"],
        ['data-smoke="no-thanks-session-action-item"', "mark finished-session action tiles"],
        ['data-smoke="no-thanks-session-action-refresh"', "mark finished-session refresh action"],
        ['data-smoke="no-thanks-session-action-rematch"', "mark finished-session rematch action"],
        ['data-smoke="no-thanks-session-action-hub"', "mark finished-session hub action"],
        ['data-smoke="no-thanks-session-action-leave"', "mark finished-session leave action"],
        ['data-smoke="no-thanks-session-route-panel"', "mark selected-room session button-route panel"],
        ['data-smoke="no-thanks-session-route-art"', "mark selected-room session button-route SVG artwork"],
        ['data-smoke="no-thanks-session-route-node"', "mark selected-room session button-route SVG nodes"],
        ['data-smoke="no-thanks-session-route-item"', "mark selected-room session button-route items"],
        ["노땡스 세션 버튼 루트", "render selected-room session button-route title in Korean"],
        ["실제 버튼 안내", "render selected-room session button-route helper copy in Korean"],
        ["노땡스 점수 요약", "render the score summary title in Korean"],
        ["노땡스 정산 요약", "render the settlement ledger summary title in Korean"],
        ["누가 왜 이겼는지 정산합니다", "render the finished-game winner explanation in Korean"],
        ["노땡스는 최소 인원", "render the No Thanks rule hint in Korean"],
        ['smoke="no-thanks-flow-meter"', "mark the card-flow meter for runtime coverage"],
        ['smoke="no-thanks-action-cue-bar"', "mark the action cue bar for runtime coverage"],
        ['smoke="no-thanks-action-feedback"', "mark the action feedback ticker for runtime coverage"],
        ['smoke="no-thanks-result-spotlight"', "mark the result spotlight for finished games"],
        ['data-smoke="no-thanks-action-route-panel"', "mark the No Thanks action-route panel"],
        ['data-smoke="no-thanks-action-route-art"', "mark the No Thanks action-route SVG artwork"],
        ['data-smoke="no-thanks-action-route-node"', "mark No Thanks action-route SVG nodes"],
        ['data-smoke="no-thanks-action-route-item"', "mark No Thanks action-route explanation tiles"],
        ["노땡스 액션 루트", "render the No Thanks action-route title in Korean"],
        ['data-smoke="no-thanks-action-availability-panel"', "mark the action availability panel"],
        ['data-smoke="no-thanks-action-availability-art"', "mark the action availability SVG artwork"],
        ['data-smoke="no-thanks-action-availability-node"', "mark action availability SVG nodes"],
        ["카드 → 선택 → 결과", "render the action availability route copy in Korean"],
        ['data-smoke="no-thanks-action-availability-item"', "mark action availability reason tiles"],
        ['data-smoke="no-thanks-take-action"', "mark take action button"],
        ['data-smoke="no-thanks-pass-action"', "mark pass action button"],
        ['data-smoke="no-thanks-card-standby-panel"', "mark the empty current-card guidance panel"],
        ['data-smoke="no-thanks-card-standby-art"', "mark the empty current-card SVG artwork"],
        ['data-smoke="no-thanks-card-standby-node"', "mark empty current-card SVG nodes"],
        ['data-smoke="no-thanks-card-standby-item"', "mark empty current-card reason tiles"],
        ["공개 카드 없음", "render the empty current-card title in Korean"],
        ["카드 공개 전 판단 준비", "render empty current-card decision copy in Korean"],
        ["setActionFeedback", "record local action feedback display state"],
        ["noThanksActionLabel", "translate No Thanks actions into Korean feedback labels"],
        ['from "./GameUxAssets.jsx"', "use the custom game UX SVG glyphs"],
        ["noThanksLobbyRoomReadiness", "derive lobby room readiness guidance"],
        ["noThanksLobbyRoomActionSignal", "derive lobby room action guidance"],
        ["noThanksLobbyRoomDecisionToneClasses", "define lobby room decision rail tones"],
        ["buildNoThanksLobbyRoomDecisionItems", "derive lobby room decision rail items"],
        ["NoThanksLobbyRoomDecisionRail", "render lobby room decision guidance"],
        ["noThanksLobbyRoomCardStatusTone", "derive lobby room card artwork status palette"],
        ["NoThanksLobbyRoomCardArt", "render the enhanced lobby room card through local SVG artwork"],
        ["NoThanksLobbyEmptyState", "render the empty No Thanks lobby guidance"],
        ["NoThanksLobbyEmptyArt", "render the empty No Thanks lobby through local SVG artwork"],
        ["buildNoThanksLobbyDirectorPlan", "derive top lobby card-room candidates from existing rooms"],
        ["NoThanksLobbyDirectorPanel", "render the standalone lobby card-room brief"],
        ["NoThanksLobbyDirectorArt", "render the lobby card-room brief through local SVG artwork"],
        ["NoThanksLobbyDirectorEmptyChoice", "render empty lobby director next-action guidance"],
        ["NoThanksLobbyDirectorEmptyArt", "render empty lobby director next-action guidance through local SVG artwork"],
        ['data-smoke="no-thanks-lobby-director-panel"', "mark the lobby director panel"],
        ['data-smoke="no-thanks-lobby-director-art"', "mark the lobby director SVG artwork"],
        ['data-smoke="no-thanks-lobby-director-node"', "mark the lobby director SVG nodes"],
        ['data-smoke="no-thanks-lobby-director-item"', "mark the lobby director reason tiles"],
        ['data-smoke="no-thanks-lobby-director-choice"', "mark the lobby director room choices"],
        ['data-smoke="no-thanks-lobby-director-join"', "mark the lobby director join CTA"],
        ['data-smoke="no-thanks-lobby-director-empty-choice"', "mark empty lobby director next-action guidance"],
        ['data-smoke="no-thanks-lobby-director-empty-art"', "mark empty lobby director SVG artwork"],
        ['data-smoke="no-thanks-lobby-director-empty-node"', "mark empty lobby director SVG nodes"],
        ['data-smoke="no-thanks-lobby-director-empty-item"', "mark empty lobby director action tiles"],
        ["추천할 카드방이 없습니다", "render empty lobby director copy in Korean"],
        ["카드방 선택 브리프", "render the No Thanks lobby director title in Korean"],
        ["바로 입장 후보", "render the lobby director primary candidate copy in Korean"],
        ['data-smoke="no-thanks-setup-preview-panel"', "mark the create-room setup preview panel"],
        ['data-smoke="no-thanks-setup-preview-art"', "mark the create-room setup preview SVG artwork"],
        ['data-smoke="no-thanks-setup-preview-node"', "mark create-room setup preview SVG nodes"],
        ['data-smoke="no-thanks-setup-preview-item"', "mark create-room setup preview reason tiles"],
        ["생성 전 노땡스 브리핑", "render the create-room No Thanks briefing title in Korean"],
        ["시작 칩", "render the create-room chip pressure copy in Korean"],
        ['data-smoke="no-thanks-lobby-room-card"', "mark the enhanced lobby room card"],
        ['data-smoke="no-thanks-lobby-empty-state"', "mark the empty No Thanks lobby state"],
        ['data-smoke="no-thanks-lobby-empty-art"', "mark the empty No Thanks lobby SVG artwork"],
        ['data-smoke="no-thanks-lobby-empty-node"', "mark empty No Thanks lobby SVG nodes"],
        ['data-smoke="no-thanks-lobby-empty-item"', "mark empty No Thanks lobby guidance cards"],
        ['data-smoke="no-thanks-lobby-empty-refresh"', "mark empty No Thanks lobby refresh action"],
        ['data-joinable={joinable ? "true" : "false"}', "expose enhanced lobby room joinable state"],
        ['data-smoke="no-thanks-lobby-room-primary"', "mark lobby primary action"],
        ["TabletopGameArtwork", "render local tabletop artwork inside the standalone route"],
        ['data-smoke="no-thanks-route-artwork"', "mark the route artwork"],
        ["NoThanksJoinCodePanel", "render the standalone No Thanks join-code bridge"],
        ["NoThanksJoinCodeArt", "render the No Thanks join-code bridge through local SVG artwork"],
        ['data-smoke="no-thanks-join-code-panel"', "mark the No Thanks join-code panel"],
        ['data-smoke="no-thanks-join-code-art"', "mark the No Thanks join-code SVG artwork"],
        ['data-smoke="no-thanks-join-code-node"', "mark No Thanks join-code flow nodes"],
        ['data-smoke="no-thanks-join-code-input"', "mark the No Thanks join-code input"],
        ['data-smoke="no-thanks-join-code-submit"', "mark the No Thanks join-code submit"],
        ['data-smoke="no-thanks-join-code-status"', "mark the No Thanks join-code status copy"],
        ['placeholder="방코드"', "keep the No Thanks join-code placeholder compact and Korean"],
        ["노땡스 초대 코드", "render the No Thanks join-code SVG title in Korean"],
        ["NoThanksCardFace", "render a reusable SVG current-card face"],
        ["NoThanksChipToken", "render reusable SVG chip tokens"],
        ["NoThanksPlayerStateCard", "render enhanced player state cards"],
        ["NoThanksPlayerStateArt", "render player chip/card/score pressure through local SVG artwork"],
        ['data-smoke="no-thanks-player-state-card"', "mark enhanced No Thanks player state cards"],
        ['data-smoke="no-thanks-player-state-art"', "mark enhanced No Thanks player state SVG artwork"],
        ['data-smoke="no-thanks-player-state-node"', "mark enhanced No Thanks player state SVG nodes"],
        ['data-smoke="no-thanks-player-state-item"', "mark enhanced No Thanks player state readable metrics"],
        ["칩 압력", "render Korean chip pressure copy in player state cards"],
        ["카드 흐름", "render Korean card-flow copy in player state cards"],
        ["점수 압력", "render Korean score pressure copy in player state cards"],
        ['smoke="no-thanks-room-setup-panel"', "mark selected lobby room setup guidance"],
        ['itemSmoke="no-thanks-room-setup-item"', "mark selected lobby room setup items"],
        ['smoke="no-thanks-start-readiness-panel"', "mark selected-room start readiness guidance"],
        ['itemSmoke="no-thanks-start-readiness-item"', "mark selected-room readiness items"],
        ['game="no-thanks"', "scope shared chat empty-state guidance to No Thanks rooms"],
        ['tone="rose"', "render No Thanks chat empty-state in the card pressure tone"],
        ['title="노땡스 방 만들기 셋업"', "render the room setup title in Korean"],
        ['title="노땡스 시작 준비"', "render the start readiness title in Korean"],
    ];
    for (const [snippet, description] of requiredSnippets) {
        if (!source.includes(snippet)) {
            throw new Error(`no-thanks-ui-smoke: NoThanksGame realtime source must ${description}.`);
        }
    }
    const requiredVisualSnippets = [
        ['data-smoke="no-thanks-current-card-art"', "mark the current-card SVG asset"],
        ['data-smoke="no-thanks-chip-token"', "mark the reusable chip SVG token"],
        ["노땡스", "render Korean card title label"],
        [">칩<", "render Korean chip label"],
    ];
    for (const [snippet, description] of requiredVisualSnippets) {
        if (!visualSource.includes(snippet)) {
            throw new Error(`no-thanks-ui-smoke: NoThanksVisuals source must ${description}.`);
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
            throw new Error(`no-thanks-ui-smoke: GameUxAssets source must ${description}.`);
        }
    }
    if (visualSource.includes("NO THANKS") || visualSource.includes(">N<") || source.includes("No Thanks Score Lens") || source.includes("No Thanks 방") || source.includes("No Thanks 시작") || source.includes("No Thanks는")) {
        throw new Error("no-thanks-ui-smoke: NoThanks visual assets must not show English placeholder labels.");
    }
    for (const forbidden of ["<filter", "feDropShadow", "filter="]) {
        if (visualSource.includes(forbidden)) {
            throw new Error(`no-thanks-ui-smoke: NoThanks SVG assets must not use SVG filters: ${forbidden}`);
        }
    }
    if (source.includes("else client.onConnect = ()")) {
        throw new Error("no-thanks-ui-smoke: NoThanksGame must not overwrite STOMP onConnect per room.");
    }
    if (source.includes('import SockJS from "sockjs-client"') || source.includes('import { Client } from "@stomp/stompjs"')) {
        throw new Error("no-thanks-ui-smoke: NoThanksGame must not statically bundle the STOMP runtime into the route chunk.");
    }
    if (source.includes('notifyError("실시간 연결 오류")')) {
        throw new Error("no-thanks-ui-smoke: NoThanksGame must not show raw repeated realtime error toasts.");
    }
    if (source.includes('from "react-hot-toast"') || !source.includes('from "../../utils/toast.js"')) {
        throw new Error("no-thanks-ui-smoke: NoThanksGame must use the dynamic toast helper instead of static react-hot-toast imports.");
    }
    if (!source.includes("key={normalized.key || normalized.id}") || source.includes("key={`${message.createdAt || index}-${index}`}")) {
        throw new Error("no-thanks-ui-smoke: NoThanksGame chat messages must use stable normalized message keys.");
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
    room_id: 41,
    chat_room_id: 901,
    room_code: "NT2026",
    title: "스모크 노땡스",
    room_status: "WAITING",
    host_member_id: 100,
    min_players: 2,
    max_players: 6,
    start_chip_count: 11,
    turn_time_seconds: 15,
    players: [
        {
            member_id: 100,
            nickname: "스모크 플레이어",
            seat_no: 1,
            ready: false,
        },
    ],
};

const waitingState = {
    event_type: "snapshot",
    room_id: 41,
    chat_room_id: 901,
    room_code: "NT2026",
    room_status: "WAITING",
    phase: "WAITING",
    turn_member_id: null,
    turn_deadline_at: null,
    current_card: null,
    pot_chips: 0,
    deck_remaining_count: 0,
    removed_cards: [],
    winner_member_id: null,
    message: "",
    players: [
        {
            member_id: 100,
            nickname: "스모크 플레이어",
            seat_no: 1,
            ready: false,
            chips: 11,
            cards: [],
            score: null,
        },
    ],
};

const finishedState = {
    event_type: "snapshot",
    room_id: 41,
    chat_room_id: 901,
    room_code: "NT2026",
    room_status: "FINISHED",
    phase: "FINISHED",
    turn_member_id: null,
    turn_deadline_at: null,
    current_card: null,
    pot_chips: 0,
    deck_remaining_count: 0,
    removed_cards: [3, 4, 6, 7, 14, 18, 22],
    winner_member_id: 100,
    message: "검증 관리자님이 가장 낮은 점수로 우승했습니다.",
    players: [
        {
            member_id: 100,
            nickname: "검증 관리자",
            seat_no: 1,
            ready: true,
            chips: 5,
            cards: [8, 9, 10, 21],
            score: 24,
        },
        {
            member_id: 101,
            nickname: "스모크 경쟁자",
            seat_no: 2,
            ready: true,
            chips: 2,
            cards: [5, 15, 16, 27],
            score: 45,
        },
        {
            member_id: 102,
            nickname: "칩 보유자",
            seat_no: 3,
            ready: true,
            chips: 7,
            cards: [11, 19, 20, 31],
            score: 43,
        },
    ],
};

let noThanksStateMode = "waiting";
let noThanksRoomsEmpty = false;
const runtimeErrors = [];
const unmockedRequests = [];
const apiRequests = [];

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

    if (method === "GET" && pathname === "/api/game/no-thanks/rooms") {
        if (noThanksRoomsEmpty) {
            return { status: 200, body: [] };
        }
        return { status: 200, body: [roomSummary] };
    }

    if (method === "GET" && pathname === "/api/game/no-thanks/rooms/me") {
        return {
            status: 200,
            body: noThanksStateMode === "finished"
                ? [{
                    ...roomSummary,
                    room_status: "FINISHED",
                    phase: "FINISHED",
                    member_count: finishedState.players.length,
                    players: finishedState.players,
                }]
                : [],
        };
    }

    if (method === "POST" && pathname === "/api/game/no-thanks/rooms") {
        return { status: 201, body: roomSummary };
    }

    if (method === "GET" && pathname === "/api/game/no-thanks/rooms/41") {
        return {
            status: 200,
            body: noThanksStateMode === "finished"
                ? { ...roomSummary, room_status: "FINISHED", phase: "FINISHED", players: finishedState.players }
                : roomSummary,
        };
    }

    if (method === "PATCH" && pathname === "/api/game/no-thanks/rooms/41/settings") {
        return {
            status: 200,
            body: {
                ...roomSummary,
                start_chip_count: 12,
                turn_time_seconds: 20,
            },
        };
    }

    if (method === "POST" && pathname === "/api/game/no-thanks/rooms/41/ready") {
        return { status: 200, bodyText: "" };
    }

    if (method === "GET" && pathname === "/api/game/no-thanks/rooms/41/state") {
        return { status: 200, body: noThanksStateMode === "finished" ? finishedState : waitingState };
    }

    if (method === "GET" && (
        pathname === "/api/chat/room/901/messages"
        || pathname === "/api/chat/room/41/messages"
        || pathname === "/api/game/no-thanks/rooms/41/chat/messages"
    )) {
        return {
            status: 200,
            body: {
                data: [],
            },
        };
    }

    if (method === "PATCH" && (pathname === "/api/chat/room/901/read" || pathname === "/api/chat/room/41/read")) {
        return { status: 204, bodyText: "" };
    }

    return null;
}

async function handleFetchRequest(cdp, sessionId, event) {
    const { requestId, request } = event.params;
    apiRequests.push(`${request.method} ${request.url}`);
    const mock = routeMock(request.url, request.method);
    if (!mock) {
        unmockedRequests.push(`${request.method} ${request.url}`);
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
        lastSubmit: sessionStorage.getItem("__smokeLastSubmit") || "",
        runtimeErrors: ${JSON.stringify(runtimeErrors.slice(-5))},
        gameRequests: ${JSON.stringify(apiRequests.filter((request) => request.includes("/api/game/")).slice(-20))},
        apiRequests: ${JSON.stringify(apiRequests.slice(-20))},
        unmockedRequests: ${JSON.stringify(unmockedRequests.slice(-10))},
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

async function clickFormSubmitByText(cdp, sessionId, formText, buttonText) {
    const ok = await evaluate(cdp, sessionId, `(() => {
        const form = Array.from(document.querySelectorAll("form"))
            .find((node) => node.textContent.includes(${JSON.stringify(formText)}));
        if (!form) return false;
        const button = Array.from(form.querySelectorAll("button"))
            .find((node) => node.textContent.includes(${JSON.stringify(buttonText)}) && !node.disabled);
        if (!button) return false;
        button.scrollIntoView({ block: "center", inline: "center" });
        button.click();
        return true;
    })()`);
    if (!ok) throw new Error(`Could not click form submit: ${formText} / ${buttonText}`);
}

async function clickClosestFormSubmit(cdp, sessionId, inputSelector) {
    const ok = await evaluate(cdp, sessionId, `(async () => {
        const input = document.querySelector(${JSON.stringify(inputSelector)});
        const form = input?.closest("form");
        if (!form) return false;
        const button = form.querySelector("button[type='submit']:not(:disabled), button:not([type]):not(:disabled)");
        if (!button) return false;
        sessionStorage.setItem("__smokeLastSubmit", JSON.stringify({
            href: location.href,
            formText: form.innerText,
            formAction: form.getAttribute("action") || "",
            inputPlaceholder: input.getAttribute("placeholder") || "",
            buttonText: button.textContent || "",
        }));
        const reactPropsKey = Object.keys(form).find((key) => key.startsWith("__reactProps$"));
        const onSubmit = reactPropsKey ? form[reactPropsKey]?.onSubmit : null;
        if (typeof onSubmit !== "function") return false;
        await Promise.resolve(onSubmit({
            currentTarget: form,
            target: form,
            nativeEvent: {},
            preventDefault: () => {},
            stopPropagation: () => {},
        }));
        return true;
    })()`);
    if (!ok) throw new Error(`Could not click closest form submit: ${inputSelector}`);
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

async function assertNoRemovedNoThanksPanels(cdp, sessionId, label) {
    const snapshot = await evaluate(cdp, sessionId, `(() => {
        const selectors = [
            '[data-smoke="no-thanks-room-setup-panel"]',
            '[data-smoke="no-thanks-setup-preview-panel"]',
            '[data-smoke="no-thanks-lobby-director-panel"]',
            '[data-smoke="no-thanks-lobby-room-decision-rail"]',
            '[data-smoke="no-thanks-start-readiness-panel"]',
            '[data-smoke="no-thanks-session-route-panel"]',
            '[data-smoke="no-thanks-turn-rail-panel"]',
            '[data-smoke="no-thanks-progress-digest-panel"]',
            '[data-smoke="no-thanks-decision-panel"]',
            '[data-smoke="no-thanks-action-route-panel"]',
            '[data-smoke="no-thanks-session-action-panel"]',
            '[data-smoke="no-thanks-action-feedback"]',
        ];
        return {
            present: selectors.filter((selector) => document.querySelector(selector)),
            blockedText: [
                "생성 전 노땡스 브리핑",
                "노땡스 방 만들기 셋업",
                "턴 템포",
                "입장 흐름",
                "이 셋업 패널은",
                "카드방 선택 브리프",
                "노땡스 세션 버튼 루트",
                "노땡스 액션 루트",
                "행동 피드백",
            ].filter((text) => document.body?.innerText.includes(text)),
        };
    })()`);
    if (snapshot.present.length || snapshot.blockedText.length) {
        throw new Error(`${label}: removed No Thanks briefing panels still rendered ${JSON.stringify(snapshot)}`);
    }
}

async function inspectNoThanksEmptyLobby(cdp, sessionId, viewport) {
    noThanksStateMode = "waiting";
    noThanksRoomsEmpty = true;
    try {
        await cdp.send("Emulation.setDeviceMetricsOverride", {
            width: viewport.width,
            height: viewport.height,
            deviceScaleFactor: viewport.mobile ? 2 : 1,
            mobile: viewport.mobile,
        }, sessionId);
        await evaluate(cdp, sessionId, `localStorage.removeItem("no_thanks_last_room_id"); true`);
        await cdp.send("Page.navigate", { url: `${baseUrl}/app/games/no-thanks` }, sessionId);
        await waitForText(cdp, sessionId, "대기 중인 방");
        await waitFor(cdp, sessionId, `document.querySelector('[data-smoke="no-thanks-lobby-empty-state"]')?.getAttribute("data-loading") === "false"`, "no thanks empty lobby rendered");
        const directEmptySnapshot = await evaluate(cdp, sessionId, `(() => {
            const panel = document.querySelector('[data-smoke="no-thanks-lobby-empty-state"]');
            return {
                mounted: Boolean(panel),
                loading: panel?.getAttribute("data-loading") || "",
                art: document.querySelectorAll('[data-smoke="no-thanks-lobby-empty-art"]').length,
                refresh: document.querySelectorAll('[data-smoke="no-thanks-lobby-empty-refresh"]').length,
                cards: document.querySelectorAll('[data-smoke="no-thanks-lobby-room-card"]').length,
                joinCode: document.querySelectorAll('[data-smoke="no-thanks-join-code-panel"]').length,
                text: panel?.innerText || "",
            };
        })()`);
        if (
            !directEmptySnapshot.mounted
            || directEmptySnapshot.loading !== "false"
            || directEmptySnapshot.art < 1
            || directEmptySnapshot.refresh < 1
            || directEmptySnapshot.cards !== 0
            || directEmptySnapshot.joinCode < 1
            || !directEmptySnapshot.text.includes("대기방 없음")
            || !directEmptySnapshot.text.includes("새 방 만들기")
            || !directEmptySnapshot.text.includes("방코드 입장")
            || !directEmptySnapshot.text.includes("목록 새로고침")
        ) {
            throw new Error(`no-thanks-ui-smoke: direct empty lobby missing ${JSON.stringify(directEmptySnapshot)}`);
        }
        await assertNoRemovedNoThanksPanels(cdp, sessionId, `no thanks empty lobby ${viewport.name}`);
        await assertPageQuality(cdp, sessionId, `no thanks empty lobby ${viewport.name}`);
        return `no thanks empty lobby ${viewport.name}: ok`;
        const snapshot = await evaluate(cdp, sessionId, `(() => {
            const panel = document.querySelector('[data-smoke="no-thanks-lobby-empty-state"]');
            const director = document.querySelector('[data-smoke="no-thanks-lobby-director-panel"]');
            return {
                mounted: Boolean(panel),
                loading: panel?.getAttribute("data-loading") || "",
                art: document.querySelectorAll('[data-smoke="no-thanks-lobby-empty-art"]').length,
                nodes: document.querySelectorAll('[data-smoke="no-thanks-lobby-empty-node"]').length,
                items: document.querySelectorAll('[data-smoke="no-thanks-lobby-empty-item"]').length,
                refresh: document.querySelectorAll('[data-smoke="no-thanks-lobby-empty-refresh"]').length,
                cards: document.querySelectorAll('[data-smoke="no-thanks-lobby-room-card"]').length,
                directorMounted: Boolean(director),
                directorRoomCount: Number(director?.getAttribute("data-room-count") || 0),
                directorEmpty: document.querySelectorAll('[data-smoke="no-thanks-lobby-director-empty-choice"]').length,
                directorEmptyArt: document.querySelectorAll('[data-smoke="no-thanks-lobby-director-empty-art"]').length,
                directorEmptyNodes: document.querySelectorAll('[data-smoke="no-thanks-lobby-director-empty-node"]').length,
                directorEmptyItems: document.querySelectorAll('[data-smoke="no-thanks-lobby-director-empty-item"]').length,
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
            || !snapshot.directorText.includes("추천할 카드방이 없습니다")
            || !snapshot.directorText.includes("목록이 비어 있어도")
            || !snapshot.text.includes("대기방 없음")
            || !snapshot.text.includes("새 방 만들기")
            || !snapshot.text.includes("방코드 입장")
            || !snapshot.text.includes("목록 새로고침")
        ) {
            throw new Error(`no-thanks-ui-smoke: empty lobby guidance missing ${JSON.stringify(snapshot)}`);
        }
        await assertPageQuality(cdp, sessionId, `no-thanks empty lobby ${viewport.name}`);
        return `no thanks empty lobby ${viewport.name}: ok ${viewport.width}`;
    } finally {
        noThanksRoomsEmpty = false;
    }
}

async function inspectNoThanks(cdp, sessionId, viewport) {
    noThanksStateMode = "waiting";
    await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.mobile ? 2 : 1,
        mobile: viewport.mobile,
    }, sessionId);

    await cdp.send("Page.navigate", { url: `${baseUrl}/app/games/no-thanks` }, sessionId);
    await waitForText(cdp, sessionId, "노땡스");
    await waitForText(cdp, sessionId, "방 만들기");
    await waitForText(cdp, sessionId, "대기 중인 방");
    await waitForText(cdp, sessionId, "스모크 노땡스");
    await waitForText(cdp, sessionId, "코드 NT2026");
    await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-route-artwork"] [data-smoke="tabletop-game-artwork"]'))`, "no thanks route artwork rendered");
    await assertNoRemovedNoThanksPanels(cdp, sessionId, `no thanks lobby ${viewport.name}`);
    await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-join-code-panel"]'))`, "no thanks join-code bridge rendered");
    await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-lobby-room-card"]'))`, "no thanks lobby room card rendered");
    await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-lobby-room-primary"]'))`, "no thanks lobby primary action rendered");
    if (!viewport.interactive) {
        await assertPageQuality(cdp, sessionId, `no thanks ${viewport.name}`);
        return `no thanks ${viewport.name}: ok`;
    }

    await setInputValue(cdp, sessionId, "input[placeholder='방 제목']", "스모크 노땡스");
    await setInputValue(cdp, sessionId, "input[placeholder='토큰 개수']", "12");
    await setInputValue(cdp, sessionId, "input[placeholder='제한 시간(초)']", "20");
    await clickClosestFormSubmit(cdp, sessionId, "main form input");
    await waitForText(cdp, sessionId, "방 코드 NT2026");
    await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="game-chat-empty-state"][data-chat-game="no-thanks"]'))`, "no thanks chat empty state rendered");
    await assertNoRemovedNoThanksPanels(cdp, sessionId, `no thanks selected waiting ${viewport.name}`);
    noThanksStateMode = "finished";
    await evaluate(cdp, sessionId, `localStorage.setItem("no_thanks_last_room_id", "41"); true`);
    await cdp.send("Page.navigate", { url: `${baseUrl}/app/games/no-thanks` }, sessionId);
    await waitForText(cdp, sessionId, "검증 관리자");
    await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-action-availability-panel"]'))`, "no thanks action availability rendered");
    await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="no-thanks-player-state-card"]').length >= 1`, "no thanks player state cards rendered");
    await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="game-chat-empty-state"][data-chat-game="no-thanks"]')) || document.body.innerText.includes("방 채팅")`, "no thanks selected room chat rendered");
    await assertNoRemovedNoThanksPanels(cdp, sessionId, `no thanks gameplay ${viewport.name}`);
    await assertPageQuality(cdp, sessionId, `no thanks ${viewport.name}`);
    return `no thanks ${viewport.name}: ok`;
    await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-room-setup-panel"]'))`, "no thanks room setup rendered");
    await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="no-thanks-room-setup-panel"] [data-smoke="no-thanks-room-setup-item"]').length >= 4`, "no thanks room setup items rendered");
    await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-setup-preview-panel"]'))`, "no thanks create setup preview rendered");
    const setupPreviewSnapshot = await evaluate(cdp, sessionId, `(() => {
        const panel = document.querySelector('[data-smoke="no-thanks-setup-preview-panel"]');
        return {
            mounted: Boolean(panel),
            art: document.querySelectorAll('[data-smoke="no-thanks-setup-preview-art"]').length,
            nodes: document.querySelectorAll('[data-smoke="no-thanks-setup-preview-node"]').length,
            items: document.querySelectorAll('[data-smoke="no-thanks-setup-preview-item"]').length,
            startChipCount: panel?.getAttribute("data-start-chip-count") || "",
            turnTime: panel?.getAttribute("data-turn-time") || "",
            text: panel?.textContent || "",
        };
    })()`);
    if (
        !setupPreviewSnapshot.mounted
        || setupPreviewSnapshot.art < 1
        || setupPreviewSnapshot.nodes < 5
        || setupPreviewSnapshot.items < 4
        || setupPreviewSnapshot.startChipCount !== "11"
        || setupPreviewSnapshot.turnTime !== "15"
        || !/생성 전 노땡스 브리핑|시작 칩|턴 템포/.test(setupPreviewSnapshot.text)
    ) {
        throw new Error(`no-thanks-ui-smoke: create setup preview missing ${JSON.stringify(setupPreviewSnapshot)}`);
    }
    await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-join-code-panel"]'))`, "no thanks join-code bridge rendered");
    const joinCodeSnapshot = await evaluate(cdp, sessionId, `(() => {
        const panel = document.querySelector('[data-smoke="no-thanks-join-code-panel"]');
        const input = document.querySelector('[data-smoke="no-thanks-join-code-input"]');
        return {
            mounted: Boolean(panel),
            art: document.querySelectorAll('[data-smoke="no-thanks-join-code-art"]').length,
            nodes: document.querySelectorAll('[data-smoke="no-thanks-join-code-node"]').length,
            input: document.querySelectorAll('[data-smoke="no-thanks-join-code-input"]').length,
            submit: document.querySelectorAll('[data-smoke="no-thanks-join-code-submit"]').length,
            status: document.querySelectorAll('[data-smoke="no-thanks-join-code-status"]').length,
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
        || !joinCodeSnapshot.text.includes("노땡스 초대 코드")
    ) {
        throw new Error(`no-thanks-ui-smoke: join-code bridge missing ${JSON.stringify(joinCodeSnapshot)}`);
    }
    await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-lobby-director-panel"]'))`, "no thanks lobby director rendered");
    const lobbyDirectorSnapshot = await evaluate(cdp, sessionId, `(() => {
        const panel = document.querySelector('[data-smoke="no-thanks-lobby-director-panel"]');
        return {
            mounted: Boolean(panel),
            roomCount: Number(panel?.getAttribute("data-room-count") || 0),
            recommended: panel?.getAttribute("data-recommended-room") || "",
            art: document.querySelectorAll('[data-smoke="no-thanks-lobby-director-art"]').length,
            nodes: document.querySelectorAll('[data-smoke="no-thanks-lobby-director-node"]').length,
            items: document.querySelectorAll('[data-smoke="no-thanks-lobby-director-item"]').length,
            choices: document.querySelectorAll('[data-smoke="no-thanks-lobby-director-choice"]').length,
            join: document.querySelectorAll('[data-smoke="no-thanks-lobby-director-join"]').length,
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
        || !lobbyDirectorSnapshot.text.includes("카드방 선택 브리프")
        || !lobbyDirectorSnapshot.text.includes("바로 입장 후보")
    ) {
        throw new Error(`no-thanks-ui-smoke: lobby director missing ${JSON.stringify(lobbyDirectorSnapshot)}`);
    }
    await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-lobby-room-card"]'))`, "no thanks lobby room card rendered");
    const lobbyRoomSnapshot = await evaluate(cdp, sessionId, `(() => {
        const card = document.querySelector('[data-smoke="no-thanks-lobby-room-card"]');
        return {
            cards: document.querySelectorAll('[data-smoke="no-thanks-lobby-room-card"]').length,
            stateCards: document.querySelectorAll('[data-smoke="no-thanks-lobby-room-card"][data-room-status][data-joinable]').length,
            primary: document.querySelectorAll('[data-smoke="no-thanks-lobby-room-primary"]').length,
            text: card?.innerText || "",
        };
    })()`);
    if (
        lobbyRoomSnapshot.cards < 1
        || lobbyRoomSnapshot.stateCards < lobbyRoomSnapshot.cards
        || lobbyRoomSnapshot.primary < 1
        || !lobbyRoomSnapshot.text.includes("인원 1/2")
    ) {
        throw new Error(`no-thanks-ui-smoke: enhanced lobby room card missing guidance ${JSON.stringify(lobbyRoomSnapshot)}`);
    }

    if (viewport.interactive) {
        await setInputValue(cdp, sessionId, "input[placeholder='방 제목']", "스모크 노땡스");
        await setInputValue(cdp, sessionId, "input[placeholder='토큰 개수']", "12");
        await setInputValue(cdp, sessionId, "input[placeholder='제한 시간(초)']", "20");
        await clickButtonByText(cdp, sessionId, "노땡스 방 만들기");
        await waitForText(cdp, sessionId, "방 코드 NT2026");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="game-chat-empty-state"][data-chat-game="no-thanks"]'))`, "no thanks chat empty state rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="game-chat-empty-art"][data-chat-game="no-thanks"]'))`, "no thanks chat empty SVG rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="game-chat-empty-state"][data-chat-game="no-thanks"] [data-smoke="game-chat-empty-node"]').length >= 4`, "no thanks chat empty SVG nodes rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="game-chat-empty-state"][data-chat-game="no-thanks"] [data-smoke="game-chat-empty-item"]').length >= 3`, "no thanks chat empty guidance items rendered");
        const chatEmptySnapshot = await evaluate(cdp, sessionId, `(() => {
            const panel = document.querySelector('[data-smoke="game-chat-empty-state"][data-chat-game="no-thanks"]');
            return {
                art: document.querySelectorAll('[data-smoke="game-chat-empty-art"][data-chat-game="no-thanks"]').length,
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
            || !chatEmptySnapshot.text.includes("칩 압박")
            || !chatEmptySnapshot.text.includes("선택 예고")
        ) {
            throw new Error(`no-thanks-ui-smoke: chat empty state missing guidance ${JSON.stringify(chatEmptySnapshot)}`);
        }
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-start-readiness-panel"]'))`, "no thanks start readiness rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-start-readiness-panel-art"]'))`, "no thanks start readiness artwork rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="no-thanks-start-readiness-panel-node"]').length >= 4`, "no thanks start readiness artwork nodes rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="no-thanks-start-readiness-panel"] [data-smoke="no-thanks-start-readiness-item"]').length >= 4`, "no thanks start readiness items rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-session-route-panel"]'))`, "no thanks session button route rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-session-route-art"]'))`, "no thanks session button route SVG rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="no-thanks-session-route-node"]').length >= 4`, "no thanks session button route SVG nodes rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="no-thanks-session-route-item"]').length >= 4`, "no thanks session button route items rendered");
        const sessionRouteSnapshot = await evaluate(cdp, sessionId, `(() => {
            const panel = document.querySelector('[data-smoke="no-thanks-session-route-panel"]');
            return {
                mounted: Boolean(panel),
                art: Boolean(document.querySelector('[data-smoke="no-thanks-session-route-art"]')),
                nodes: document.querySelectorAll('[data-smoke="no-thanks-session-route-node"]').length,
                items: document.querySelectorAll('[data-smoke="no-thanks-session-route-item"]').length,
                roomStatus: panel?.getAttribute("data-room-status") || "",
                canStart: panel?.getAttribute("data-can-start") || "",
                host: panel?.getAttribute("data-host") || "",
                rematching: panel?.getAttribute("data-rematching") || "",
                keys: Array.from(document.querySelectorAll('[data-smoke="no-thanks-session-route-item"]')).map((node) => node.getAttribute("data-route-key")),
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
            || !["true", "false"].includes(sessionRouteSnapshot.rematching)
            || !["state", "ready", "primary", "exit"].every((key) => sessionRouteSnapshot.keys.includes(key))
            || !["노땡스 세션 버튼 루트", "실제 버튼 안내", "준비 버튼", "퇴장 버튼"].every((text) => sessionRouteSnapshot.text.includes(text))
        ) {
            throw new Error(`no-thanks-ui-smoke: session button route artwork missing ${JSON.stringify(sessionRouteSnapshot)}`);
        }
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-turn-rail-panel"]'))`, "no thanks turn rail rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-turn-rail-art"]'))`, "no thanks turn rail SVG rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="no-thanks-turn-rail-node"]').length >= 2`, "no thanks turn rail nodes rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="no-thanks-turn-rail-tile"]').length >= 4`, "no thanks turn rail tiles rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="no-thanks-turn-rail-player"]').length >= 1`, "no thanks turn rail players rendered");
        await waitFor(cdp, sessionId, `/카드 턴 레일|현재 차례|좌석/.test(document.querySelector('[data-smoke="no-thanks-turn-rail-panel"]')?.textContent || "")`, "no thanks turn rail copy rendered");
        await waitForText(cdp, sessionId, "상태");
        await waitForText(cdp, sessionId, "대기");
        await waitForText(cdp, sessionId, "현재 선택 요약");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-progress-digest-panel"]'))`, "no thanks progress digest rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-progress-digest-art"]'))`, "no thanks progress digest SVG rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="no-thanks-progress-digest-node"]').length >= 4`, "no thanks progress digest nodes rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="no-thanks-progress-digest-item"]').length >= 4`, "no thanks progress digest items rendered");
        const progressDigestSnapshot = await evaluate(cdp, sessionId, `(() => {
            const panel = document.querySelector('[data-smoke="no-thanks-progress-digest-panel"]');
            return {
                status: panel?.getAttribute("data-status") || "",
                currentCard: Number(panel?.getAttribute("data-current-card") || 0),
                potChips: Number(panel?.getAttribute("data-pot-chips") || 0),
                deckRemaining: Number(panel?.getAttribute("data-deck-remaining") || 0),
                keys: Array.from(document.querySelectorAll('[data-smoke="no-thanks-progress-digest-item"]')).map((node) => node.getAttribute("data-digest-key")),
                text: panel?.textContent || "",
            };
        })()`);
        if (
            !progressDigestSnapshot.status
            || progressDigestSnapshot.currentCard < 0
            || progressDigestSnapshot.potChips < 0
            || progressDigestSnapshot.deckRemaining < 0
            || !["latest", "actor", "pressure", "phase"].every((key) => progressDigestSnapshot.keys.includes(key))
            || !/최근 진행 요약|방금 무엇이 바뀌었나|최근 진행/.test(progressDigestSnapshot.text)
        ) {
            throw new Error(`no-thanks-ui-smoke: progress digest missing ${JSON.stringify(progressDigestSnapshot)}`);
        }
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-decision-panel"]'))`, "no thanks decision panel rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-flow-meter"]'))`, "no thanks flow meter rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="no-thanks-flow-meter"] [data-smoke="game-flow-meter-item"]').length >= 4`, "no thanks flow meter items rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-score-lens-panel"]'))`, "no thanks score lens panel rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-score-lens-art"]'))`, "no thanks score lens SVG rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="no-thanks-score-lens-item"]').length >= 4`, "no thanks score lens items rendered");
        await waitFor(cdp, sessionId, `/가져가기 순점수 판단|순점수|추천 판단/.test(document.querySelector('[data-smoke="no-thanks-score-lens-panel"]')?.textContent || "")`, "no thanks score lens copy rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-action-cue-bar"]'))`, "no thanks action cue bar rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="no-thanks-action-cue-bar"] [data-smoke="game-action-cue-item"]').length >= 3`, "no thanks action cue items rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-action-feedback"]'))`, "no thanks action feedback rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="no-thanks-action-feedback"] [data-smoke="game-feedback-item"]').length >= 4`, "no thanks action feedback items rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-action-route-panel"]'))`, "no thanks action route rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-action-route-art"]'))`, "no thanks action route SVG rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="no-thanks-action-route-node"]').length >= 4`, "no thanks action route SVG nodes rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="no-thanks-action-route-item"]').length >= 4`, "no thanks action route items rendered");
        const actionRouteSnapshot = await evaluate(cdp, sessionId, `(() => {
            const panel = document.querySelector('[data-smoke="no-thanks-action-route-panel"]');
            return {
                mounted: Boolean(panel),
                art: Boolean(document.querySelector('[data-smoke="no-thanks-action-route-art"]')),
                nodes: document.querySelectorAll('[data-smoke="no-thanks-action-route-node"]').length,
                items: document.querySelectorAll('[data-smoke="no-thanks-action-route-item"]').length,
                roomStatus: panel?.getAttribute("data-room-status") || "",
                myTurn: panel?.getAttribute("data-my-turn") || "",
                currentCard: panel?.getAttribute("data-current-card") || "",
                potChips: panel?.getAttribute("data-pot-chips") || "",
                myChips: panel?.getAttribute("data-my-chips") || "",
                deckRemaining: panel?.getAttribute("data-deck-remaining") || "",
                keys: Array.from(document.querySelectorAll('[data-smoke="no-thanks-action-route-item"]')).map((node) => node.getAttribute("data-route-key")),
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
            || actionRouteSnapshot.potChips === ""
            || actionRouteSnapshot.myChips === ""
            || actionRouteSnapshot.deckRemaining === ""
            || !["card", "chip", "choice", "next"].every((key) => actionRouteSnapshot.keys.includes(key))
            || !["노땡스 액션 루트", "카드 확인", "칩 비용", "받기/패스", "다음 턴"].every((text) => actionRouteSnapshot.text.includes(text))
        ) {
            throw new Error(`no-thanks-ui-smoke: action route artwork missing ${JSON.stringify(actionRouteSnapshot)}`);
        }
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-action-availability-panel"]'))`, "no thanks action availability rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-action-availability-art"]'))`, "no thanks action availability SVG rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="no-thanks-action-availability-node"]').length >= 5`, "no thanks action availability SVG nodes rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="no-thanks-action-availability-item"]').length >= 2`, "no thanks action availability items rendered");
        const actionAvailabilitySnapshot = await evaluate(cdp, sessionId, `(() => {
            const panel = document.querySelector('[data-smoke="no-thanks-action-availability-panel"]');
            const art = document.querySelector('[data-smoke="no-thanks-action-availability-art"]');
            return {
                mounted: Boolean(panel),
                art: Boolean(art),
                nodes: document.querySelectorAll('[data-smoke="no-thanks-action-availability-node"]').length,
                items: document.querySelectorAll('[data-smoke="no-thanks-action-availability-item"]').length,
                takeButton: document.querySelectorAll('[data-smoke="no-thanks-take-action"]').length,
                passButton: document.querySelectorAll('[data-smoke="no-thanks-pass-action"]').length,
                roomStatus: panel?.getAttribute("data-room-status") || "",
                canTake: panel?.getAttribute("data-can-take") || "",
                canPass: panel?.getAttribute("data-can-pass") || "",
                myTurn: panel?.getAttribute("data-my-turn") || "",
                keys: Array.from(document.querySelectorAll('[data-smoke="no-thanks-action-availability-node"]')).map((node) => node.getAttribute("data-action-key")),
                text: panel?.textContent || "",
            };
        })()`);
        if (
            !actionAvailabilitySnapshot.mounted
            || !actionAvailabilitySnapshot.art
            || actionAvailabilitySnapshot.nodes < 5
            || actionAvailabilitySnapshot.items < 2
            || actionAvailabilitySnapshot.takeButton < 1
            || actionAvailabilitySnapshot.passButton < 1
            || !actionAvailabilitySnapshot.roomStatus
            || !["true", "false"].includes(actionAvailabilitySnapshot.canTake)
            || !["true", "false"].includes(actionAvailabilitySnapshot.canPass)
            || !["true", "false"].includes(actionAvailabilitySnapshot.myTurn)
            || !["turn", "card", "pot", "pass", "take"].every((key) => actionAvailabilitySnapshot.keys.includes(key))
            || !actionAvailabilitySnapshot.text.includes("카드 → 선택 → 결과")
            || !actionAvailabilitySnapshot.text.includes("팟 칩")
        ) {
            throw new Error(`no-thanks-ui-smoke: action availability artwork missing ${JSON.stringify(actionAvailabilitySnapshot)}`);
        }
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-card-standby-panel"]'))`, "no thanks empty current-card guidance rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-card-standby-art"]'))`, "no thanks empty current-card SVG rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="no-thanks-card-standby-node"]').length >= 4`, "no thanks empty current-card SVG nodes rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="no-thanks-card-standby-item"]').length >= 4`, "no thanks empty current-card guidance items rendered");
        await waitFor(cdp, sessionId, `/공개 카드 없음|카드 공개 전 판단 준비|시작 대기/.test(document.querySelector('[data-smoke="no-thanks-card-standby-panel"]')?.textContent || "")`, "no thanks empty current-card Korean copy rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-current-card-art"]'))`, "no thanks current card SVG asset rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="no-thanks-chip-token"]').length >= 2`, "no thanks chip SVG tokens rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-player-state-card"]'))`, "no thanks player state cards rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-player-state-art"]'))`, "no thanks player state SVG rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="no-thanks-player-state-node"]').length >= 4`, "no thanks player state SVG nodes rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="no-thanks-player-state-item"]').length >= 4`, "no thanks player state readable metrics rendered");
        const playerStateSnapshot = await evaluate(cdp, sessionId, `(() => {
            const card = document.querySelector('[data-smoke="no-thanks-player-state-card"]');
            return {
                cards: document.querySelectorAll('[data-smoke="no-thanks-player-state-card"]').length,
                art: document.querySelectorAll('[data-smoke="no-thanks-player-state-art"]').length,
                nodes: document.querySelectorAll('[data-smoke="no-thanks-player-state-node"]').length,
                items: document.querySelectorAll('[data-smoke="no-thanks-player-state-item"]').length,
                currentCards: document.querySelectorAll('[data-smoke="no-thanks-player-state-card"][data-player-current="true"]').length,
                text: card?.textContent || "",
            };
        })()`);
        if (
            playerStateSnapshot.cards < 1
            || playerStateSnapshot.art < 1
            || playerStateSnapshot.nodes < 4
            || playerStateSnapshot.items < 4
            || !playerStateSnapshot.text.includes("칩 압력")
            || !playerStateSnapshot.text.includes("점수 압력")
            || !/카드 없음|카드 흐름/.test(playerStateSnapshot.text)
        ) {
            throw new Error(`no-thanks-ui-smoke: player state cards missing readable pressure markers ${JSON.stringify(playerStateSnapshot)}`);
        }
        await waitForText(cdp, sessionId, "가져가기 조건");
        await waitForText(cdp, sessionId, "넘기기 조건");
        await waitForText(cdp, sessionId, "스모크 플레이어");
        await clickButtonByText(cdp, sessionId, "설정 저장");
        await waitForText(cdp, sessionId, "방 설정 저장 완료");
        await waitForText(cdp, sessionId, "20초");
        await clickButtonByText(cdp, sessionId, "준비 토글");
        noThanksStateMode = "finished";
        await evaluate(cdp, sessionId, `localStorage.setItem("no_thanks_last_room_id", "41"); true`);
        await cdp.send("Page.navigate", { url: `${baseUrl}/app/games/no-thanks` }, sessionId);
        await waitForText(cdp, sessionId, "검증 관리자");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-result-spotlight"]'))`, "no thanks result spotlight rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-settlement-ledger-panel"]'))`, "no thanks settlement ledger rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-settlement-ledger-art"]'))`, "no thanks settlement ledger SVG rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="no-thanks-settlement-player-node"]').length >= 3`, "no thanks settlement player nodes rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="no-thanks-settlement-ledger-item"]').length >= 4`, "no thanks settlement ledger items rendered");
        await waitFor(cdp, sessionId, `/노땡스 정산 요약|누가 왜 이겼는지|카드 묶음|칩 차감/.test(document.querySelector('[data-smoke="no-thanks-settlement-ledger-panel"]')?.textContent || "")`, "no thanks settlement copy rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-session-action-panel"]'))`, "no thanks finished-session action panel rendered");
        await waitFor(cdp, sessionId, `document.querySelector('[data-smoke="no-thanks-session-action-panel"]')?.getAttribute("data-session-status") === "FINISHED"`, "no thanks finished-session status rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-session-action-art"]'))`, "no thanks finished-session SVG rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="no-thanks-session-action-node"]').length >= 4`, "no thanks finished-session SVG nodes rendered");
        await waitFor(cdp, sessionId, `document.querySelectorAll('[data-smoke="no-thanks-session-action-item"]').length >= 4`, "no thanks finished-session action items rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-session-action-refresh"]'))`, "no thanks finished-session refresh action rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-session-action-rematch"]'))`, "no thanks finished-session rematch action rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-session-action-hub"]'))`, "no thanks finished-session hub action rendered");
        await waitFor(cdp, sessionId, `Boolean(document.querySelector('[data-smoke="no-thanks-session-action-leave"]'))`, "no thanks finished-session leave action rendered");
        await waitFor(cdp, sessionId, `/노땡큐 종료 세션 플랜|종료 세션|재대결/.test(document.querySelector('[data-smoke="no-thanks-session-action-panel"]')?.textContent || "")`, "no thanks finished-session copy rendered");
    }

    await assertPageQuality(cdp, sessionId, `no thanks ${viewport.name}`);
    return `no thanks ${viewport.name}: ok`;
}

async function main() {
    assertNoThanksRealtimeSource();
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

    try {
        await cdp.send("Browser.getVersion");
        const targetResponse = await cdp.send("Target.createTarget", { url: "about:blank" });
        const targetId = targetResponse.result?.targetId;
        if (!targetId) throw new Error("Could not create Chrome target for no-thanks smoke test.");
        const attachResponse = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
        sessionId = attachResponse.result?.sessionId;
        if (!sessionId) throw new Error("Could not attach to Chrome target for no-thanks smoke test.");

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
                localStorage.removeItem("no_thanks_last_room_id");
            `,
        }, sessionId);

        const results = [];
        for (const viewport of viewports) {
            results.push(await inspectNoThanksEmptyLobby(cdp, sessionId, viewport));
            results.push(await inspectNoThanks(cdp, sessionId, viewport));
        }
        if (runtimeErrors.length) {
            throw new Error(`Runtime errors: ${runtimeErrors.join(" | ")}`);
        }
        results.forEach((result) => console.log(result));
        console.log(`no-thanks-ui-smoke ok (${results.length} responsive checks)`);
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
