import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createPipeSession } from "./pipe-websocket-cdp.mjs";

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
const userDataDir = mkdtempSync(path.join(tmpdir(), "hub-ui-smoke-"));
const viewports = [
    { name: "desktop", width: 1366, height: 900, mobile: false },
    { name: "mobile", width: 390, height: 844, mobile: true },
];

const allMenuTexts = [
    "검증 관리자",
    "핵심 서비스",
    "편의 도구",
    "게임",
    "계정",
    "관리자",
    "스트리밍 스튜디오",
    "커뮤니티 플랫폼 V2.0",
];
const allMenuLinks = [
    "/app",
    "/app/todos",
    "/app/statistics",
    "/app/streaming",
    "/app/boards/FREE_BOARD",
    "/app/boards/QUESTION_ANSWER",
    "/app/invest",
    "/app/optimizer",
    "/app/facility",
    "/app/ranks",
    "/app/news",
    "/app/games",
    "/app/poker",
    "/app/games/las-vegas",
    "/app/games/no-thanks",
    "/app/games/catan",
    "/app/games/blokus",
    "/app/games/mahe",
    "/app/games/dalmuti",
    "/app/games/six-nimmt",
    "/app/games/telestrations",
    "/app/games/mafia",
    "/app/games/citadels",
    "/app/mypage",
    "/app/mypage/edit",
    "/app/admin/anomalies",
    "/app/admin/operations",
    "/app/admin/streaming",
];
const gamesHubTexts = [
    "게임 허브",
    "게임을 선택하세요",
    "게임 목록",
    "포커",
    "카탄",
    "블로커스",
    "마헤",
    "달무티",
    "6 nimmt!",
    "텔레스트레이션",
    "마피아",
    "Las Vegas",
    "No Thanks",
    "시티델",
];
const blockedTexts = ["Loading", "Error", "undefined", "ROLE_ADMIN", "ROLE_MASTER"];

let nextMessageId = 1;
const pending = new Map();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function assertStaticGamesHubManualAccessibility() {
    const source = readFileSync("src/pages/games/GamesHub.jsx", "utf8");
    const requiredSnippets = [
        "useCallback",
        "useId",
        "useRef",
        "aria-labelledby={titleId}",
        "aria-describedby={descriptionId}",
        "ref={closeButtonRef}",
        "closeButtonRef.current?.focus()",
        "previousFocus.focus()",
        "onClose={closeManual}",
    ];
    const missing = requiredSnippets.filter((snippet) => !source.includes(snippet));
    if (missing.length) {
        throw new Error(`games hub manual accessibility guard missing: ${missing.join(", ")}`);
    }
}

function assertStaticVideoGameRoomDesign() {
    const roomSource = readFileSync("src/pages/games/GoodEtcVideoGame.jsx", "utf8");
    const artworkSource = readFileSync("src/pages/games/VideoGameArtwork.jsx", "utf8");
    const uxAssetSource = readFileSync("src/pages/games/GameUxAssets.jsx", "utf8");
    const tabletopArtworkSource = readFileSync("src/pages/games/TabletopGameArtwork.jsx", "utf8");
    const requiredRoomSnippets = [
        "VideoGameArtwork type={videoGameCode}",
        "directionControls",
        "aria-label=\"방 제목\"",
        "aria-label=\"방 코드\"",
        "transportLabel",
        "frameStatusText",
        "videoGamePlayBriefs",
        "videoGameStageHudBriefs",
        "readableVideoGameProfiles",
        "readableVideoGamePlayBriefs",
        "readableVideoGameStageHudBriefs",
        "initialReadableVideoInputFeedback",
        "readableVideoInputFeedbackStatusLabel",
        "readableVideoInputControlLabel",
        "실시간 교전",
        "입력 전송 중",
        "발사",
        "대시",
        "VideoGameLobbyBriefPanel",
        "VideoGameExperiencePanel",
        "VideoGameStageHud",
        "VideoGameStageHudMapArt",
        "videoGameStageHudPalettes",
        "VideoGameStageGatePanel",
        "VideoGameStageGateArt",
        "buildVideoGameStageGateItems",
        "VideoGameFrameStandbyPanel",
        "VideoGameFrameStandbyArt",
        "VideoGameTacticalBrief",
        "VideoGameTacticalScene",
        "VideoGameSignalBridgePanel",
        "VideoGameSignalBridgeArt",
        "VideoGameInputTracePanel",
        "VideoGameInputTraceArt",
        "VideoGameSyncRailPanel",
        "VideoGameSyncRailArt",
        "buildVideoGameSessionRouteItems",
        "VideoGameSessionRoutePanel",
        "VideoGameSessionRouteArt",
        "VideoGameResultBreakdownPanel",
        "VideoGameResultTraceArt",
        "buildVideoGameResultBreakdown",
        "VideoGameSessionActionPanel",
        "VideoGameSessionActionArt",
        "VideoControlGlyph",
        "VideoGameInputDeck",
        "buildVideoGameInputRouteItems",
        "VideoGameInputRoutePanel",
        "VideoGameInputRouteArt",
        "VideoGameControlIntentPanel",
        "VideoGameControlIntentArt",
        "buildVideoGameControlIntents",
        "videoControlIntentFor",
        "VideoGameMobileControlPanel",
        "VideoGameMobileControlMapArt",
        "VideoGameRoomReadinessPanel",
        "VideoGameRoomReadinessArt",
        "VideoGameRoomSetupPanel",
        "VideoGameRoomSetupArt",
        "VideoGameInputProfileBrief",
        "VideoGameInputProfileBriefArt",
        "VideoGameJoinCodePanel",
        "VideoGameJoinCodeArt",
        "VideoGameLobbyEmptyState",
        "VideoGameLobbyEmptyArt",
        "buildVideoGameMatchmakingPlan",
        "buildVideoGameMatchmakingCandidates",
        "VideoGameMatchmakingPanel",
        "VideoGameMatchmakingArt",
        "VideoGameMatchmakingEmptyChoice",
        "VideoGameMatchmakingEmptyArt",
        "GameResultSpotlight",
        'data-smoke="video-game-lobby-brief-panel"',
        'data-smoke="video-game-lobby-brief-tile"',
        'data-smoke="video-game-room-setup-panel"',
        'data-smoke="video-game-room-setup-art"',
        'data-smoke="video-game-room-setup-node"',
        'data-smoke="video-game-room-setup-item"',
        'data-smoke="video-game-input-profile-brief"',
        'data-smoke="video-game-input-profile-art"',
        'data-smoke="video-game-input-profile-node"',
        'data-smoke="video-game-input-profile-item"',
        "입력 프로필",
        "액션 버튼 중심",
        'data-smoke="video-game-join-code-panel"',
        'data-smoke="video-game-join-code-art"',
        'data-smoke="video-game-join-code-node"',
        'data-smoke="video-game-join-code-input"',
        'data-smoke="video-game-join-code-submit"',
        'data-smoke="video-game-join-code-status"',
        'data-smoke="video-game-lobby-empty-state"',
        'data-smoke="video-game-lobby-empty-art"',
        'data-smoke="video-game-lobby-empty-node"',
        'data-smoke="video-game-lobby-empty-item"',
        'data-smoke="video-game-matchmaking-panel"',
        'data-smoke="video-game-matchmaking-art"',
        'data-smoke="video-game-matchmaking-node"',
        'data-smoke="video-game-matchmaking-item"',
        'data-smoke="video-game-matchmaking-choice"',
        'data-smoke="video-game-matchmaking-empty-choice"',
        'data-smoke="video-game-matchmaking-empty-art"',
        'data-smoke="video-game-matchmaking-empty-node"',
        'data-smoke="video-game-matchmaking-empty-item"',
        '"video-game-matchmaking-open"',
        '"video-game-matchmaking-join"',
        "추천할 대기방이 없습니다",
        'data-smoke="video-game-experience-panel"',
        'data-smoke="video-game-flow-tile"',
        'data-smoke="video-game-tactical-brief"',
        'data-smoke="video-game-tactical-scene"',
        'data-smoke="video-game-tactical-lane"',
        'data-smoke="video-game-signal-bridge-panel"',
        'data-smoke="video-game-signal-bridge-art"',
        'data-smoke="video-game-signal-bridge-item"',
        'data-smoke="video-game-input-trace-panel"',
        'data-smoke="video-game-input-trace-art"',
        'data-smoke="video-game-input-trace-node"',
        'data-smoke="video-game-input-trace-item"',
        'data-smoke="video-game-sync-rail-panel"',
        'data-smoke="video-game-sync-rail-art"',
        'data-smoke="video-game-sync-rail-node"',
        'data-smoke="video-game-sync-rail-tile"',
        'data-smoke="video-game-sync-rail-player"',
        'data-smoke="video-game-session-route-panel"',
        'data-smoke="video-game-session-route-art"',
        'data-smoke="video-game-session-route-node"',
        'data-smoke="video-game-session-route-item"',
        "세션 버튼 루트",
        "실제 버튼",
        'data-smoke="video-game-result-breakdown-panel"',
        'data-smoke="video-game-result-breakdown-item"',
        'data-smoke="video-game-result-trace-art"',
        'data-smoke="video-game-result-trace-node"',
        'data-smoke="video-game-session-action-panel"',
        'data-smoke="video-game-session-action-art"',
        'data-smoke="video-game-session-action-node"',
        'data-smoke="video-game-session-action-item"',
        'data-smoke="video-game-session-action-refresh"',
        'data-smoke="video-game-session-action-hub"',
        'data-smoke="video-game-session-action-leave"',
        'data-smoke="video-game-stage-brief"',
        'data-smoke="video-game-stage-hud-art"',
        'data-smoke="video-game-stage-hud-node"',
        'data-smoke="video-game-stage-gate-panel"',
        'data-smoke="video-game-stage-gate-art"',
        'data-smoke="video-game-stage-gate-node"',
        'data-smoke="video-game-stage-gate-item"',
        'data-smoke="video-game-frame-standby-panel"',
        'data-smoke="video-game-frame-standby-art"',
        'data-smoke="video-game-frame-standby-node"',
        'data-smoke="video-game-frame-standby-item"',
        'data-smoke="video-game-hud-tile"',
        'data-smoke="video-game-input-deck"',
        'data-smoke="video-game-input-tile"',
        'data-smoke="video-game-input-route-panel"',
        'data-smoke="video-game-input-route-art"',
        'data-smoke="video-game-input-route-node"',
        'data-smoke="video-game-input-route-item"',
        "상태 확인 → 이동 → 액션 → 해제/피드백",
        'data-smoke="video-game-control-strip"',
        'data-smoke="video-game-control-chip"',
        'data-smoke="video-game-control-intent-panel"',
        'data-smoke="video-game-control-intent-art"',
        'data-smoke="video-game-control-intent-node"',
        'data-smoke="video-game-control-intent-item"',
        'data-smoke="video-game-mobile-control-panel"',
        'data-smoke="video-game-mobile-control-map-art"',
        'data-smoke="video-game-mobile-control-map-node"',
        "모바일 조작 지도",
        'data-smoke="video-game-mobile-direction-pad"',
        'data-smoke="video-game-mobile-action-pad"',
        'data-smoke="video-game-mobile-control-button"',
        'data-smoke="video-game-mobile-action-button"',
        'data-smoke="video-game-mobile-control-status"',
        'data-smoke="video-game-room-readiness-panel"',
        'data-smoke="video-game-room-readiness-art"',
        'data-smoke="video-game-room-readiness-node"',
        'data-smoke="video-game-room-readiness-item"',
        'data-smoke="video-game-stage-shell"',
        'smoke="video-game-result-spotlight"',
        "setInputFeedback",
        "videoInputControlLabel",
        "videoInputTraceToneClasses",
        'data-smoke="video-game-room-card"',
        'data-smoke="video-game-room-readiness"',
        'data-smoke="video-game-room-action-signal"',
        'data-smoke="video-game-room-slot"',
        'data-smoke="video-game-room-open"',
        'data-smoke="video-game-room-primary"',
        "getVideoRoomReadySignal",
        "getVideoRoomActionSignal",
        "getVideoRoomTacticalSignals",
        "buildVideoRoomDecisionItems",
        "VideoGameRoomDecisionRail",
        "VideoGameRoomCardArt",
        "videoRoomCardStateTone",
        "videoRoomDecisionToneClasses",
        'data-smoke="video-game-room-decision-rail"',
        'data-smoke="video-game-room-decision-item"',
        "data-decision-key={item.key}",
        "입장 판단",
        "플레이 리듬",
        'data-smoke="video-game-room-tactical-signal"',
        'data-smoke="video-game-room-card-art"',
        'data-smoke="video-game-room-card-node"',
        'data-smoke="video-game-room-card-seat"',
        "data-can-join={canJoin ? \"true\" : \"false\"}",
        "aria-pressed={active}",
        "onKeyDown: (event) => handleKeyDown(event, control)",
        "onKeyUp: (event) => handleKeyUp(event, control)",
        "pressedControlLabel",
        "GameUxGlyph type=\"stage\"",
        "목표 → 위험 → 입력 → 보상",
        "HUD 지도",
        "왜 화면이 안 보이나요",
        "화면 대기",
        "다음 행동",
        "GameUxGlyph type=\"input\"",
        "GameUxGlyph type=\"signal\"",
        "GameUxGlyph type=\"decision\"",
        "GameUxGlyph type={tile.icon}",
        "매치메이킹 브리프",
        "바로 시작 후보",
        "좌석 여유",
        "입력 리듬",
    ];
    const missingRoomSnippets = requiredRoomSnippets.filter((snippet) => !roomSource.includes(snippet));
    if (missingRoomSnippets.length) {
        throw new Error(`video game room design guard missing: ${missingRoomSnippets.join(", ")}`);
    }
    for (const snippet of ["입력 중", "게임화면 연결", "동기화 레일", "게임화면 준비", "Good ETC 입력 브리지 흐름"]) {
        if (!roomSource.includes(snippet)) {
            throw new Error(`video game SVG polish guard missing Korean bridge/sync label: ${snippet}`);
        }
    }
    for (const forbidden of ['"LIVE"', '"HOST"', '"GUEST"', '"INPUT"', '"WAIT"', ">SEAT<", "IFRAME LINKED", "LINK PENDING", "WAITING ROOM", "SYNC RAIL", "IFRAME READY", "LAUNCH ROUTE", "READY CHECK", "Launch Director", 'placeholder="ROOMCODE"']) {
        if (roomSource.includes(forbidden)) {
            throw new Error(`video game SVG polish guard forbids visible English placeholder label: ${forbidden}`);
        }
    }
    for (const code of ["arena", "fortress", "defense", "kart", "bomb", "snake", "coin", "rpg"]) {
        if (!artworkSource.includes(`${code}: {`)) {
            throw new Error(`video game artwork profile missing: ${code}`);
        }
    }
    if (!artworkSource.includes('data-smoke="video-game-artwork"')) {
        throw new Error("video game artwork smoke marker missing");
    }
    for (const snippet of ["artworkLabel", "게임 아트워크", 'role="img"', "aria-label={artworkLabel}", 'aria-hidden="true"', 'focusable="false"']) {
        if (!artworkSource.includes(snippet)) {
            throw new Error(`video game artwork accessibility guard missing: ${snippet}`);
        }
    }
    if (!artworkSource.includes("export const VideoControlGlyph") || !artworkSource.includes('data-smoke="video-game-control-glyph"')) {
        throw new Error("video game control SVG asset guard missing");
    }
    for (const snippet of [
        'eyebrow: "네온 아레나"',
        'hud: ["조준", "대시", "동기"]',
        'hud: ["각도", "화력", "바람"]',
        'hud: ["공세", "타워", "스킬"]',
        'hud: ["폭탄", "회피", "연쇄"]',
        'hud: ["시간", "콤보", "부스트"]',
    ]) {
        if (!artworkSource.includes(snippet)) {
            throw new Error(`video game artwork must use Korean in-world HUD labels: ${snippet}`);
        }
    }
    for (const forbidden of ['hud: ["AIM"', 'hud: ["ANGLE"', 'hud: ["WAVE"', 'hud: ["BOMB"', 'hud: ["QUEST"']) {
        if (artworkSource.includes(forbidden)) {
            throw new Error(`video game artwork must not show English placeholder HUD labels: ${forbidden}`);
        }
    }
    const hubSource = readFileSync("src/pages/games/GamesHub.jsx", "utf8");
    for (const snippet of [
        "gameExperienceProfiles",
        "gameHubAdvisorProfiles",
        "GameHubJourneyPanel",
        "GameHubResumePanel",
        "GameHubResumeEmptyState",
        "resumePanelProfiles",
        "gameHubResumeStorageKeys",
        "gameHubResumeTitleStorageKey",
        "readGameHubResumeEntries",
        "createGameHubResumeEntry",
        "summarizeGameHubProgressSave",
        "저장된 비디오게임 흐름",
        "첫 비디오게임 방 열기",
        "GameHubChoiceMapPanel",
        "GameHubChoiceMapArt",
        "gameHubFilterOptions",
        "GameHubQuickFilterPanel",
        "GameHubFilterLensArt",
        "GameHubFilterResultPanel",
        "GameHubFilterResultArt",
        "GameHubSectionEmptyState",
        "GameHubSectionEmptyArt",
        "GameHubSectionFilterBrief",
        "GameHubSectionFilterBriefArt",
        "buildGameHubReadinessPlan",
        "GameHubReadinessPanel",
        "GameHubReadinessMatrixArt",
        "buildGameHubLaunchPlan",
        "GameHubLaunchDirectorPanel",
        "GameHubLaunchDirectorArt",
        "GameHubLaunchDirectorEmptyChoice",
        "GameHubLaunchDirectorEmptyArt",
        "GameHubAdvisor",
        "GameHubAdvisorCompassArt",
        "buildGameCardBriefItems",
        "GameCardBriefPanel",
        "getBoardGameRuleGuide",
        "boardGameManual",
        "추천 선택",
        "첫 판단 포인트",
        "결과 이해",
        "대표 경험",
        "선택 지도",
        "보드게임 선택 지도",
        "비디오게임 선택 지도",
        "조건 필터",
        "지금 시작 판단",
        "시작 디렉터",
        "시작 경로",
        "추천할 게임 후보가 없습니다",
        "빈 후보 경로",
        "준비 체크",
        "혼자 가능",
        'data-smoke="game-fit-advisor"',
        'data-smoke="game-fit-advisor-art"',
        'data-smoke="game-fit-advisor-node"',
        'data-smoke="game-fit-advisor-signal"',
        'data-smoke="game-fit-pick"',
        'data-smoke="game-hub-journey-panel"',
        'data-smoke="game-hub-journey-step"',
        'data-smoke="game-hub-resume-panel"',
        'data-smoke="game-hub-resume-empty"',
        'data-smoke="game-hub-resume-empty-entry"',
        'data-smoke="game-hub-resume-item"',
        'data-active-tab={activeTab}',
        'resumeStorageKey: "poker_last_room_id"',
        'resumeStorageKey: "las_vegas_last_room_id"',
        'resumeStorageKey: "no_thanks_last_room_id"',
        'resumeStorageKey: "catan_last_room_id"',
        'resumeStorageKey: "citadels_last_room_id"',
        'resumeStorageKey: "good_etc_rpg_save_v1"',
        'data-smoke="game-hub-choice-map-panel"',
        'data-smoke="game-hub-choice-map-art"',
        'data-smoke="game-hub-choice-map-dot"',
        'data-smoke="game-hub-choice-map-lane"',
        'data-smoke="game-hub-filter-panel"',
        'data-smoke="game-hub-filter-lens-art"',
        'data-smoke="game-hub-filter-lens-bar"',
        'data-smoke="game-hub-filter-option"',
        'data-smoke="game-hub-filter-result-panel"',
        'data-smoke="game-hub-filter-result-art"',
        'data-smoke="game-hub-filter-result-node"',
        'data-smoke="game-hub-filter-result-item"',
        'data-smoke="game-hub-filter-result-entry"',
        'data-smoke="game-hub-filter-result-reset"',
        'data-smoke="game-hub-section-empty-state"',
        'data-smoke="game-hub-section-empty-art"',
        'data-smoke="game-hub-section-empty-node"',
        'data-smoke="game-hub-section-empty-item"',
        'data-smoke="game-hub-section-empty-reset"',
        'data-smoke="game-hub-section-filter-brief"',
        'data-smoke="game-hub-section-filter-art"',
        'data-smoke="game-hub-section-filter-node"',
        'data-smoke="game-hub-section-filter-item"',
        'data-smoke="game-hub-section-filter-reset"',
        "GameHubVideoBridgePanel",
        "GameHubVideoBridgeArt",
        "Good_ETC 입력 브리지",
        "비디오게임 입장 전 브리지 점검",
        'data-smoke="game-hub-video-bridge-panel"',
        'data-smoke="game-hub-video-bridge-art"',
        'data-smoke="game-hub-video-bridge-node"',
        'data-smoke="game-hub-video-bridge-item"',
        'data-smoke="game-hub-video-bridge-entry"',
        'data-smoke="game-hub-video-bridge-manual"',
        'data-smoke="game-card-brief-panel"',
        'data-smoke="game-card-brief-item"',
        "GameUxGlyph type=\"decision\"",
        "GameUxGlyph type={page.icon}",
        "PlayingCardArt",
        'smoke="game-hub-poker-card-art"',
        'from "./TabletopGameArtwork.jsx"',
        "tabletopGameArtProfiles[type]",
        "TabletopGameArtwork type={type}",
    ]) {
        if (!hubSource.includes(snippet)) {
            throw new Error(`games hub experience guard missing: ${snippet}`);
        }
    }
    for (const removedSnippet of [
        "GameHubHeroShowcase",
        "GameHubCollectionAtlasArt",
        'data-smoke="game-hub-asset-showcase"',
        'data-smoke="game-hub-collection-art"',
        'data-smoke="game-hub-showcase-item"',
        "GameHubResumeArt",
        "GameHubResumeInsightRail",
        'data-smoke="game-hub-resume-art"',
        'data-smoke="game-hub-resume-insight-rail"',
    ]) {
        if (hubSource.includes(removedSnippet)) {
            throw new Error(`removed games hub UI is still present: ${removedSnippet}`);
        }
    }
    for (const snippet of ["glyphPaths", "decision", "stage", "input", "signal", "PlayingCardArt", "PlayingCardSuitIcon", "playingCardSuitLabel"]) {
        if (!uxAssetSource.includes(snippet)) {
            throw new Error(`game UX SVG asset guard missing: ${snippet}`);
        }
    }
    for (const code of ["poker", "dice", "cards", "catan", "blokus", "mahe", "dalmuti", "six-nimmt", "telestrations", "mafia", "citadels"]) {
        if (!tabletopArtworkSource.includes(`${JSON.stringify(code)}:`) && !tabletopArtworkSource.includes(`${code}: {`)) {
            throw new Error(`tabletop game artwork profile missing: ${code}`);
        }
    }
    if (!tabletopArtworkSource.includes('data-smoke="tabletop-game-artwork"')) {
        throw new Error("tabletop game artwork smoke marker missing");
    }
    for (const label of ["포커", "라스베가스", "노땡스", "카탄", "블로커스", "마헤", "달무티", "젝스님트", "텔레스트레이션", "마피아", "시티델", "게임 아트워크"]) {
        if (!tabletopArtworkSource.includes(label)) {
            throw new Error(`tabletop game artwork must use Korean artwork labels: ${label}`);
        }
    }
    for (const forbidden of ['label: "Poker"', 'label: "Las Vegas"', 'label: "Catan"', 'label: "Blokus"', 'label: "Mahe"', 'label: "Dalmuti"', 'label: "6 nimmt!"', 'label: "Telestrations"', 'label: "Mafia"', 'label: "Citadels"', "game artwork"]) {
        if (tabletopArtworkSource.includes(forbidden)) {
            throw new Error(`tabletop game artwork must not show English artwork labels: ${forbidden}`);
        }
    }
}

function send(ws, method, params = {}) {
    const id = nextMessageId++;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject, method });
    });
}

function encodeBody(value) {
    return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

function encodeText(value) {
    return Buffer.from(value, "utf8").toString("base64");
}

const videoGameRouteTitles = {
    arena: "LAN Arena",
    fortress: "Fortress",
    defense: "Defense",
    kart: "Kart Dash",
    bomb: "Bomb Battle",
    snake: "Snake Rush",
    coin: "Coin Collector",
    rpg: "Good_ETC RPG",
};

const videoGameSmokeCodePrefix = (code) => code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5).padEnd(5, "X");

const buildVideoGameSmokeRooms = (code) => {
    if (code === "coin") {
        return [];
    }
    const title = videoGameRouteTitles[code] || code;
    const roomTitle = code === "arena" ? "스모크 아레나" : `스모크 ${title}`;
    const joinTitle = code === "arena" ? "입장 대기 아레나" : `입장 대기 ${title}`;
    const prefix = videoGameSmokeCodePrefix(code);
    return [
        {
        room_id: 71,
        game_code: code,
        room_code: `${prefix}71`,
        title: roomTitle,
        room_status: "WAITING",
        host_member_id: 999,
        chat_room_id: 971,
        min_players: 1,
        max_players: 8,
        turn_time_seconds: 30,
        players: [
            { member_id: 999, nickname: "검증 관리자", seat_no: 1, ready: true },
            { member_id: 777, nickname: "게스트 파일럿", seat_no: 2, ready: true },
        ],
        },
        {
        room_id: 72,
        game_code: code,
        room_code: `${prefix}72`,
        title: joinTitle,
        room_status: "WAITING",
        host_member_id: 777,
        chat_room_id: 972,
        min_players: 1,
        max_players: 8,
        turn_time_seconds: 30,
        players: [
            { member_id: 777, nickname: "호스트 파일럿", seat_no: 1, ready: true },
        ],
        },
    ];
};

const videoGameSmokeState = (room) => {
    const selectedRoom = room.game_code === "arena" && Number(room.room_id) === 71
        ? { ...room, room_status: "FINISHED", roomStatus: "FINISHED" }
        : room;
    return {
        event_type: "SNAPSHOT",
        message: "",
        room: selectedRoom,
        game: {
            code: selectedRoom.game_code,
            display_name: videoGameRouteTitles[selectedRoom.game_code] || selectedRoom.game_code,
            min_players: 1,
            max_players: 8,
            summary: `${videoGameRouteTitles[selectedRoom.game_code] || selectedRoom.game_code} 런타임 검증`,
            storage_policy: "DB room + STOMP state",
        },
        game_state: {
            transport: "mock-stomp",
            phase: selectedRoom.room_status,
            hud: "runtime smoke",
            winner_seat_no: 1,
            winner_reason: "처치 3회와 생존 점수로 가장 앞섰습니다.",
            scoreboard: [
                { seat_no: 1, nickname: "검증 관리자", score: 320, kills: 3, rank: 1, reason: "처치와 생존 점수가 가장 높습니다." },
                { seat_no: 2, nickname: "게스트 파일럿", score: 180, kills: 1, rank: 2 },
            ],
        },
    };
};

function routeMock(url, method) {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    const pathname = parsed.pathname;

    if (hostname === "oapi.map.naver.com") {
        return {
            status: 200,
            contentType: "application/javascript; charset=utf-8",
            bodyText: "window.naver = window.naver || { maps: {} };",
        };
    }
    if (method === "GET" && pathname === "/api/members") {
        return {
            status: 200,
            body: {
                data: {
                    member_id: 999,
                    memberId: 999,
                    name: "검증 관리자",
                    email: "admin@example.com",
                    roles: ["ROLE_ADMIN"],
                },
            },
        };
    }
    if (method === "GET" && pathname === "/api/chat/rooms") {
        return { status: 200, body: { data: [] } };
    }
    const videoRoomsMatch = pathname.match(/^\/api\/game\/video\/([^/]+)\/rooms$/);
    if (method === "GET" && videoRoomsMatch) {
        return { status: 200, body: buildVideoGameSmokeRooms(videoRoomsMatch[1]) };
    }
    const videoMyRoomsMatch = pathname.match(/^\/api\/game\/video\/([^/]+)\/rooms\/me$/);
    if (method === "GET" && videoMyRoomsMatch) {
        const rooms = buildVideoGameSmokeRooms(videoMyRoomsMatch[1]);
        return { status: 200, body: rooms[0] ? [rooms[0]] : [] };
    }
    const videoRoomStateMatch = pathname.match(/^\/api\/game\/video\/([^/]+)\/rooms\/(\d+)\/state$/);
    if (method === "GET" && videoRoomStateMatch) {
        const rooms = buildVideoGameSmokeRooms(videoRoomStateMatch[1]);
        const room = rooms.find((item) => Number(item.room_id) === Number(videoRoomStateMatch[2])) || rooms[0];
        return { status: 200, body: videoGameSmokeState(room) };
    }
    const videoRoomJoinMatch = pathname.match(/^\/api\/game\/video\/([^/]+)\/rooms\/(\d+)\/join$/);
    if (method === "POST" && videoRoomJoinMatch) {
        const rooms = buildVideoGameSmokeRooms(videoRoomJoinMatch[1]);
        const room = rooms.find((item) => Number(item.room_id) === Number(videoRoomJoinMatch[2])) || rooms[1];
        return {
            status: 200,
            body: {
                ...room,
                players: [
                    ...room.players,
                    { member_id: 999, nickname: "검증 관리자", seat_no: 2, ready: false },
                ],
            },
        };
    }

    return null;
}

async function handleFetchRequest(ws, event) {
    const { requestId, request } = event.params;
    const mock = routeMock(request.url, request.method);
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
        body: mock.bodyText == null ? encodeBody(mock.body) : encodeText(mock.bodyText),
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

async function waitForText(ws, text, timeoutMs = 6000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (await evaluate(ws, `document.body?.innerText.includes(${JSON.stringify(text)})`)) return;
        await delay(120);
    }
    const bodyText = await evaluate(ws, `document.body?.innerText.slice(0, 800) || ""`);
    throw new Error(`Timed out waiting for text: ${text}. Body: ${bodyText}`);
}

async function waitForSelector(ws, selector, timeoutMs = 6000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (await evaluate(ws, `Boolean(document.querySelector(${JSON.stringify(selector)}))`)) return;
        await delay(120);
    }
    const bodyText = await evaluate(ws, `document.body?.innerText.slice(0, 800) || ""`);
    throw new Error(`Timed out waiting for selector: ${selector}. Body: ${bodyText}`);
}

async function waitForExpression(ws, expression, label, timeoutMs = 6000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (await evaluate(ws, expression)) return;
        await delay(120);
    }
    const bodyText = await evaluate(ws, `document.body?.innerText.slice(0, 800) || ""`);
    throw new Error(`Timed out waiting for expression: ${label}. Body: ${bodyText}`);
}

async function countSelector(ws, selector) {
    return evaluate(ws, `document.querySelectorAll(${JSON.stringify(selector)}).length`);
}

async function clickFirstSelector(ws, selector) {
    const clicked = await evaluate(ws, `(() => {
        const node = document.querySelector(${JSON.stringify(selector)});
        if (!node) return false;
        node.scrollIntoView({ block: "center", inline: "center" });
        node.click();
        return true;
    })()`);
    if (!clicked) {
        throw new Error(`Could not click selector: ${selector}`);
    }
}

async function setViewport(ws, viewport) {
    await send(ws, "Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.mobile ? 2 : 1,
        mobile: viewport.mobile,
    });
}

async function inspectPageFrame(ws, label, requiredTexts) {
    const value = await evaluate(ws, `(() => {
        const root = document.documentElement;
        const body = document.body;
        const text = body ? body.innerText : "";
        const overflowNodes = Array.from(document.querySelectorAll("body *"))
            .map((node) => {
                const rect = node.getBoundingClientRect();
                return {
                    tag: node.tagName,
                    text: (node.innerText || node.getAttribute("aria-label") || "").trim().slice(0, 80),
                    width: Math.round(rect.width),
                    right: Math.round(rect.right),
                };
            })
            .filter((node) => node.right > root.clientWidth + 2 && node.width > 0)
            .slice(0, 5);
        return {
            url: location.href,
            text,
            clientWidth: root.clientWidth,
            scrollWidth: root.scrollWidth,
            bodyWidth: body ? body.scrollWidth : 0,
            overflowNodes,
        };
    })()`);

    const missing = requiredTexts.filter((text) => !value.text.includes(text));
    if (missing.length) {
        throw new Error(`${label}: missing text ${missing.join(", ")}`);
    }

    const blocked = blockedTexts.filter((text) => value.text.includes(text));
    if (blocked.length) {
        throw new Error(`${label}: blocked text ${blocked.join(", ")}`);
    }

    const overflow = Math.max(value.scrollWidth, value.bodyWidth) - value.clientWidth;
    if (overflow > 3) {
        throw new Error(`${label}: horizontal overflow ${overflow}px ${JSON.stringify(value.overflowNodes)}`);
    }

    return value;
}

async function inspectAllMenu(ws, viewport) {
    await setViewport(ws, viewport);
    await send(ws, "Page.navigate", { url: `${baseUrl}/app/all-menu` });
    for (const text of allMenuTexts) {
        await waitForText(ws, text);
    }
    await delay(250);

    const value = await inspectPageFrame(ws, `all-menu ${viewport.name}`, allMenuTexts);
    const missingLinks = await evaluate(ws, `(() => {
        const links = new Set(Array.from(document.querySelectorAll("a[href]")).map((node) => node.getAttribute("href")));
        return ${JSON.stringify(allMenuLinks)}.filter((href) => !links.has(href));
    })()`);
    if (missingLinks.length) {
        throw new Error(`all-menu ${viewport.name}: missing links ${missingLinks.join(", ")}`);
    }

    return `all-menu ${viewport.name}: ok ${value.clientWidth}/${value.scrollWidth} ${value.url}`;
}

async function clickByAriaLabel(ws, label) {
    return evaluate(ws, `(() => {
        const targetLabel = ${JSON.stringify(label)};
        const node = Array.from(document.querySelectorAll("button, a")).find((item) => {
            const ariaLabel = item.getAttribute("aria-label") || "";
            return ariaLabel === targetLabel || ariaLabel.startsWith(targetLabel + ":");
        });
        if (!node) return "missing";
        node.click();
        return "clicked";
    })()`);
}

const seededResumeStorage = {
    board: {
        poker_last_room_id: "101",
        poker_last_room_title: "포커 토요일 방",
        las_vegas_last_room_id: "202",
        las_vegas_last_room_title: "라스베가스 주사위 방",
        no_thanks_last_room_id: "303",
        no_thanks_last_room_title: "노 땡스 칩 방",
        catan_last_room_id: "404",
        catan_last_room_title: "카탄 교역 준비방",
    },
    video: {
        good_etc_rpg_save_v1: JSON.stringify({ player: { level: 12 }, zoneName: "서약의 숲", questTitle: "첫 원정" }),
    },
};

async function setResumeStorageForSmoke(ws, activeTab, values) {
    await evaluate(ws, `(() => {
        const values = ${JSON.stringify(values)};
        const keys = Object.keys(values);
        for (const key of keys) {
            if (values[key] === null) {
                localStorage.removeItem(key);
            } else {
                localStorage.setItem(key, values[key]);
            }
        }
        window.dispatchEvent(new StorageEvent("storage", { key: null }));
        return true;
    })()`);
}

async function inspectResumeEmptyState(ws, viewport, activeTab) {
    const seeded = seededResumeStorage[activeTab] || {};
    const emptyValues = Object.fromEntries(Object.keys(seeded).map((key) => [key, null]));
    await setResumeStorageForSmoke(ws, activeTab, emptyValues);
    await waitForExpression(ws, `document.querySelector('[data-smoke="game-hub-resume-panel"]')?.getAttribute("data-resume-count") === "0"`, `games hub ${activeTab} resume empty count`);
    const emptyState = await evaluate(ws, `(() => {
        const panel = document.querySelector('[data-smoke="game-hub-resume-panel"]');
        const empty = panel?.querySelector('[data-smoke="game-hub-resume-empty"]');
        return {
            panelTab: panel?.getAttribute("data-active-tab") || "",
            panelCount: Number(panel?.getAttribute("data-resume-count") || 0),
            mounted: Boolean(empty),
            emptyTab: empty?.getAttribute("data-empty-tab") || "",
            art: empty?.querySelectorAll('[data-smoke="game-hub-resume-empty-art"]').length || 0,
            nodes: empty?.querySelectorAll('[data-smoke="game-hub-resume-empty-node"]').length || 0,
            items: empty?.querySelectorAll('[data-smoke="game-hub-resume-empty-item"]').length || 0,
            entries: empty?.querySelectorAll('[data-smoke="game-hub-resume-empty-entry"]').length || 0,
            links: Array.from(empty?.querySelectorAll('a[href]') || []).map((node) => node.getAttribute("href")),
            text: empty?.innerText || "",
        };
    })()`);
    const expectedLink = activeTab === "video" ? "/app/games/video/arena" : "/app/poker";
    const expectedTitle = activeTab === "video" ? "저장된 비디오게임 흐름이 없습니다" : "저장된 방이 없습니다";
    if (
        emptyState.panelTab !== activeTab ||
        emptyState.panelCount !== 0 ||
        !emptyState.mounted ||
        emptyState.emptyTab !== activeTab ||
        emptyState.art !== 0 ||
        emptyState.nodes !== 0 ||
        emptyState.items !== 0 ||
        emptyState.entries < 1 ||
        !emptyState.links.includes(expectedLink) ||
        !emptyState.text.includes(expectedTitle) ||
        !emptyState.text.includes("최근 방 없음")
    ) {
        throw new Error(`games-hub ${viewport.name}: ${activeTab} resume empty state missing ${JSON.stringify(emptyState)}`);
    }
    await setResumeStorageForSmoke(ws, activeTab, seeded);
    const expectedCount = Object.keys(seeded).filter((key) => !key.endsWith("_title")).length;
    await waitForExpression(ws, `Number(document.querySelector('[data-smoke="game-hub-resume-panel"]')?.getAttribute("data-resume-count") || 0) >= ${expectedCount}`, `games hub ${activeTab} resume restored`);
}

async function inspectGamesHub(ws, viewport) {
    await setViewport(ws, viewport);
    await send(ws, "Page.navigate", { url: `${baseUrl}/app/games` });
    for (const text of gamesHubTexts) {
        await waitForText(ws, text);
    }
    const heroArea = await evaluate(ws, `(() => {
        const showcase = document.querySelector('[data-smoke="game-hub-asset-showcase"]');
        const firstSection = document.querySelector("section");
        return {
            showcaseMounted: Boolean(showcase),
            tabCount: document.querySelectorAll('[role="tablist"][aria-label="게임 종류"] [role="tab"]').length,
            text: firstSection?.innerText || "",
        };
    })()`);
    if (
        heroArea.showcaseMounted ||
        heroArea.tabCount < 2 ||
        !heroArea.text.includes("게임을 선택하세요")
    ) {
        throw new Error(`games-hub ${viewport.name}: compact game selector missing ${JSON.stringify(heroArea)}`);
    }
    const boardResumePanel = await evaluate(ws, `(() => {
        const panel = document.querySelector('[data-smoke="game-hub-resume-panel"]');
        return {
            mounted: Boolean(panel),
            activeTab: panel?.getAttribute("data-active-tab") || "",
            count: Number(panel?.getAttribute("data-resume-count") || 0),
            art: panel?.querySelectorAll('[data-smoke="game-hub-resume-art"]').length || 0,
            nodes: panel?.querySelectorAll('[data-smoke="game-hub-resume-art-node"]').length || 0,
            insightRail: panel?.querySelectorAll('[data-smoke="game-hub-resume-insight-rail"]').length || 0,
            insightArt: panel?.querySelectorAll('[data-smoke="game-hub-resume-insight-art"]').length || 0,
            insightNodes: panel?.querySelectorAll('[data-smoke="game-hub-resume-insight-node"]').length || 0,
            insightItems: panel?.querySelectorAll('[data-smoke="game-hub-resume-insight-item"]').length || 0,
            roomResumeCount: Number(panel?.querySelector('[data-smoke="game-hub-resume-insight-rail"]')?.getAttribute("data-room-resume-count") || 0),
            progressResumeCount: Number(panel?.querySelector('[data-smoke="game-hub-resume-insight-rail"]')?.getAttribute("data-progress-resume-count") || 0),
            items: panel?.querySelectorAll('[data-smoke="game-hub-resume-item"]').length || 0,
            links: Array.from(panel?.querySelectorAll('[data-smoke="game-hub-resume-item"]') || []).map((node) => node.getAttribute("href")),
            storageKeys: Array.from(panel?.querySelectorAll('[data-smoke="game-hub-resume-item"]') || []).map((node) => node.getAttribute("data-storage-key")),
            text: panel?.innerText || "",
        };
    })()`);
    if (
        !boardResumePanel.mounted ||
        boardResumePanel.activeTab !== "board" ||
        boardResumePanel.count < 4 ||
        boardResumePanel.art !== 0 ||
        boardResumePanel.nodes !== 0 ||
        boardResumePanel.insightRail !== 0 ||
        boardResumePanel.insightArt !== 0 ||
        boardResumePanel.insightNodes !== 0 ||
        boardResumePanel.insightItems !== 0 ||
        boardResumePanel.roomResumeCount !== 0 ||
        boardResumePanel.progressResumeCount !== 0 ||
        boardResumePanel.items < 4 ||
        !boardResumePanel.links.includes("/app/poker") ||
        !boardResumePanel.links.includes("/app/games/catan") ||
        !boardResumePanel.storageKeys.includes("poker_last_room_id") ||
        !boardResumePanel.storageKeys.includes("catan_last_room_id") ||
        !boardResumePanel.text.includes("포커 토요일 방") ||
        !boardResumePanel.text.includes("카탄 교역 준비방") ||
        boardResumePanel.text.includes("방 #") ||
        boardResumePanel.text.includes("우선 복귀") ||
        boardResumePanel.text.includes("방 기록") ||
        boardResumePanel.text.includes("첫 확인") ||
        boardResumePanel.text.includes("후보 범위")
    ) {
        throw new Error(`games-hub ${viewport.name}: resume panel missing ${JSON.stringify(boardResumePanel)}`);
    }
    const boardFilterPanel = await evaluate(ws, `(() => {
        const panel = document.querySelector('[data-smoke="game-hub-filter-panel"]');
        return {
            mounted: Boolean(panel),
            activeFilter: panel?.getAttribute("data-active-filter") || "",
            art: panel?.querySelectorAll('[data-smoke="game-hub-filter-lens-art"]').length || 0,
            bars: panel?.querySelectorAll('[data-smoke="game-hub-filter-lens-bar"]').length || 0,
            options: panel?.querySelectorAll('[data-smoke="game-hub-filter-option"]').length || 0,
            selected: panel?.querySelectorAll('[data-smoke="game-hub-filter-option"][data-selected="true"]').length || 0,
            text: panel?.innerText || "",
        };
    })()`);
    if (!boardFilterPanel.mounted || boardFilterPanel.activeFilter !== "all" || boardFilterPanel.options < 4 || boardFilterPanel.selected !== 1 || !boardFilterPanel.text.includes("조건 필터") || !boardFilterPanel.text.includes("혼자 가능")) {
        throw new Error(`games-hub ${viewport.name}: board filter panel missing ${JSON.stringify(boardFilterPanel)}`);
    }
    const expectedOrder = ["포커", "블로커스", "Las Vegas", "마헤", "시티델", "6 nimmt!", "No Thanks", "카탄", "텔레스트레이션", "달무티", "마피아"];
    if (await clickByAriaLabel(ws, "카탄 설명서 열기") !== "clicked") {
        throw new Error(`games-hub ${viewport.name}: catan manual button missing`);
    }
    await waitForText(ws, "공식 룰 핵심");
    await waitForText(ws, "자원");
    await waitForText(ws, "설명서는 입문 안내입니다.");
    if (await clickByAriaLabel(ws, "설명서 닫기") !== "clicked") {
        throw new Error(`games-hub ${viewport.name}: manual close button missing`);
    }
    await delay(200);

    const catanLink = await evaluate(ws, `Array.from(document.querySelectorAll("a[href]")).some((node) => node.getAttribute("href") === "/app/games/catan" && (node.getAttribute("aria-label") || "").includes("카탄 입장하기"))`);
    if (!catanLink) {
        throw new Error(`games-hub ${viewport.name}: catan entry link missing`);
    }

    const cardOrder = await evaluate(ws, `Array.from(document.querySelectorAll('[data-smoke="game-card"]')).map((node) => node.getAttribute("data-game-title"))`);
    if (JSON.stringify(cardOrder) !== JSON.stringify(expectedOrder)) {
        throw new Error(`games-hub ${viewport.name}: player-count order mismatch ${JSON.stringify(cardOrder)}`);
    }
    if (false) {
    const boardCardFlow = await evaluate(ws, `(() => {
        const rails = Array.from(document.querySelectorAll('[data-smoke="game-card-flow-rail"]'));
        return {
            rails: rails.length,
            boardRails: rails.filter((node) => node.getAttribute("data-flow-type") === "board").length,
            steps: document.querySelectorAll('[data-smoke="game-card-flow-step"]').length,
            text: document.body?.innerText || "",
        };
    })()`);
    if (boardCardFlow.rails < expectedOrder.length || boardCardFlow.boardRails < expectedOrder.length || boardCardFlow.steps < expectedOrder.length * 4 || !boardCardFlow.text.includes("첫 행동") || !boardCardFlow.text.includes("차례·근거")) {
        throw new Error(`games-hub ${viewport.name}: board card flow rail missing ${JSON.stringify(boardCardFlow)}`);
    }
    const boardCardBrief = await evaluate(ws, `(() => {
        const cards = Array.from(document.querySelectorAll('[data-smoke="game-card"]'));
        const panels = cards.map((card) => card.querySelector('[data-smoke="game-card-brief-panel"]')).filter(Boolean);
        return {
            cards: cards.length,
            panels: panels.length,
            boardPanels: panels.filter((node) => node.getAttribute("data-brief-type") === "board").length,
            art: document.querySelectorAll('[data-smoke="game-card-brief-art"]').length,
            nodes: document.querySelectorAll('[data-smoke="game-card-brief-node"]').length,
            items: document.querySelectorAll('[data-smoke="game-card-brief-item"]').length,
            text: document.body?.innerText || "",
        };
    })()`);
    if (
        boardCardBrief.panels < expectedOrder.length ||
        boardCardBrief.boardPanels < expectedOrder.length ||
        boardCardBrief.art < expectedOrder.length ||
        boardCardBrief.nodes < expectedOrder.length * 4 ||
        boardCardBrief.items < expectedOrder.length * 4 ||
        !boardCardBrief.text.includes("입장 전 요약") ||
        !boardCardBrief.text.includes("결과 이해") ||
        !boardCardBrief.text.includes("승패 근거")
    ) {
        throw new Error(`games-hub ${viewport.name}: board card brief panel missing ${JSON.stringify(boardCardBrief)}`);
    }
    const boardSelectionSignals = await evaluate(ws, `(() => {
        const cards = Array.from(document.querySelectorAll('[data-smoke="game-card"]'));
        const panels = cards.map((card) => card.querySelector('[data-smoke="game-card-selection-panel"]')).filter(Boolean);
        return {
            cards: cards.length,
            panels: panels.length,
            boardPanels: panels.filter((node) => node.getAttribute("data-selection-type") === "board").length,
            art: document.querySelectorAll('[data-smoke="game-card-selection-art"]').length,
            nodes: document.querySelectorAll('[data-smoke="game-card-selection-node"]').length,
            items: document.querySelectorAll('[data-smoke="game-card-selection-item"]').length,
            keys: Array.from(document.querySelectorAll('[data-smoke="game-card-selection-item"]')).map((node) => node.getAttribute("data-selection-key")),
            text: document.body?.innerText || "",
        };
    })()`);
    if (
        boardSelectionSignals.panels < expectedOrder.length ||
        boardSelectionSignals.boardPanels < expectedOrder.length ||
        boardSelectionSignals.art < expectedOrder.length ||
        boardSelectionSignals.nodes < expectedOrder.length * 3 ||
        boardSelectionSignals.items < expectedOrder.length * 3 ||
        !["fit", "first", "manual"].every((key) => boardSelectionSignals.keys.includes(key)) ||
        !boardSelectionSignals.text.includes("선택 신호") ||
        !boardSelectionSignals.text.includes("추천 상황") ||
        !boardSelectionSignals.text.includes("첫 10초")
    ) {
        throw new Error(`games-hub ${viewport.name}: board card selection signal missing ${JSON.stringify(boardSelectionSignals)}`);
    }
    const groupedLabelVisible = await evaluate(ws, `document.body?.innerText.includes("신규 보드게임") || document.body?.innerText.includes("기존 게임")`);
    if (groupedLabelVisible) {
        throw new Error(`games-hub ${viewport.name}: grouped game labels must not be visible`);
    }
    }
    if (false) {
    const boardAdvisor = await evaluate(ws, `(() => {
        const advisor = document.querySelector('[data-smoke="game-fit-advisor"]');
        return {
            mounted: Boolean(advisor),
            count: document.querySelectorAll('[data-smoke="game-fit-pick"]').length,
            art: advisor?.querySelectorAll('[data-smoke="game-fit-advisor-art"]').length || 0,
            nodes: advisor?.querySelectorAll('[data-smoke="game-fit-advisor-node"]').length || 0,
            signals: advisor?.querySelectorAll('[data-smoke="game-fit-advisor-signal"]').length || 0,
            text: advisor?.innerText || "",
        };
    })()`);
    if (!boardAdvisor.mounted || boardAdvisor.count < 4 || boardAdvisor.art < 1 || boardAdvisor.nodes < 4 || boardAdvisor.signals < 4 || !boardAdvisor.text.includes("보드게임 추천 선택")) {
        throw new Error(`games-hub ${viewport.name}: board game fit advisor missing ${JSON.stringify(boardAdvisor)}`);
    }
    }
    if (await clickByAriaLabel(ws, "혼자 가능 필터") !== "clicked") {
        throw new Error(`games-hub ${viewport.name}: solo filter button missing`);
    }
    await waitForExpression(ws, `document.querySelector('[data-smoke="game-hub-filter-panel"]')?.getAttribute("data-active-filter") === "solo"`, "games hub solo filter applied");
    const soloFilteredCards = await evaluate(ws, `Array.from(document.querySelectorAll('[data-smoke="game-card"]')).map((node) => node.getAttribute("data-game-title"))`);
    if (JSON.stringify(soloFilteredCards) !== JSON.stringify(["포커"])) {
        throw new Error(`games-hub ${viewport.name}: solo filter mismatch ${JSON.stringify(soloFilteredCards)}`);
    }
    if (false) {
    const soloReadinessPanel = await evaluate(ws, `(() => {
        const panel = document.querySelector('[data-smoke="game-hub-readiness-panel"]');
        return {
            activeFilter: panel?.getAttribute("data-active-filter") || "",
            visibleCount: Number(panel?.getAttribute("data-visible-count") || 0),
            picks: Array.from(panel?.querySelectorAll('[data-smoke="game-hub-readiness-pick"]') || []).map((node) => node.getAttribute("data-game-title")),
        };
    })()`);
    if (soloReadinessPanel.activeFilter !== "solo" || soloReadinessPanel.visibleCount !== 1 || JSON.stringify(soloReadinessPanel.picks) !== JSON.stringify(["포커"])) {
        throw new Error(`games-hub ${viewport.name}: solo readiness panel mismatch ${JSON.stringify(soloReadinessPanel)}`);
    }
    const soloLaunchDirector = await evaluate(ws, `(() => {
        const panel = document.querySelector('[data-smoke="game-hub-launch-director-panel"]');
        return {
            activeFilter: panel?.getAttribute("data-active-filter") || "",
            visibleCount: Number(panel?.getAttribute("data-visible-count") || 0),
            choices: Array.from(panel?.querySelectorAll('[data-smoke="game-hub-launch-choice"]') || []).map((node) => node.getAttribute("data-game-title")),
        };
    })()`);
    }
    if (false) {
    const soloFilterResult = await evaluate(ws, `(() => {
        const panel = document.querySelector('[data-smoke="game-hub-filter-result-panel"]');
        return {
            mounted: Boolean(panel),
            activeTab: panel?.getAttribute("data-active-tab") || "",
            activeFilter: panel?.getAttribute("data-active-filter") || "",
            visibleCount: Number(panel?.getAttribute("data-visible-count") || 0),
            art: panel?.querySelectorAll('[data-smoke="game-hub-filter-result-art"]').length || 0,
            nodes: panel?.querySelectorAll('[data-smoke="game-hub-filter-result-node"]').length || 0,
            items: panel?.querySelectorAll('[data-smoke="game-hub-filter-result-item"]').length || 0,
            entries: panel?.querySelectorAll('[data-smoke="game-hub-filter-result-entry"]').length || 0,
            resets: panel?.querySelectorAll('[data-smoke="game-hub-filter-result-reset"]').length || 0,
        };
    })()`);
    if (
        !soloFilterResult.mounted ||
        soloFilterResult.activeTab !== "board" ||
        soloFilterResult.activeFilter !== "solo" ||
        soloFilterResult.visibleCount !== 1 ||
        soloFilterResult.art < 1 ||
        soloFilterResult.nodes < 4 ||
        soloFilterResult.items < 3 ||
        soloFilterResult.entries < 1 ||
        soloFilterResult.resets < 1
    ) {
        throw new Error(`games-hub ${viewport.name}: solo filter result panel missing ${JSON.stringify(soloFilterResult)}`);
    }
    const soloSectionFilterBrief = await evaluate(ws, `(() => {
        const panel = document.querySelector('[data-smoke="game-hub-section-filter-brief"]');
        return {
            mounted: Boolean(panel),
            activeTab: panel?.getAttribute("data-active-tab") || "",
            activeFilter: panel?.getAttribute("data-active-filter") || "",
            sectionTitle: panel?.getAttribute("data-section-title") || "",
            visibleCount: Number(panel?.getAttribute("data-visible-count") || 0),
            hiddenCount: Number(panel?.getAttribute("data-hidden-count") || 0),
            art: panel?.querySelectorAll('[data-smoke="game-hub-section-filter-art"]').length || 0,
            nodes: panel?.querySelectorAll('[data-smoke="game-hub-section-filter-node"]').length || 0,
            items: panel?.querySelectorAll('[data-smoke="game-hub-section-filter-item"]').length || 0,
            resets: panel?.querySelectorAll('[data-smoke="game-hub-section-filter-reset"]').length || 0,
            keys: Array.from(panel?.querySelectorAll('[data-smoke="game-hub-section-filter-item"]') || []).map((node) => node.getAttribute("data-filter-key")),
            text: panel?.innerText || "",
        };
    })()`);
    if (
        !soloSectionFilterBrief.mounted ||
        soloSectionFilterBrief.activeTab !== "board" ||
        soloSectionFilterBrief.activeFilter !== "solo" ||
        soloSectionFilterBrief.visibleCount !== 1 ||
        soloSectionFilterBrief.hiddenCount < 1 ||
        soloSectionFilterBrief.art < 1 ||
        soloSectionFilterBrief.nodes < 4 ||
        soloSectionFilterBrief.items < 3 ||
        soloSectionFilterBrief.resets < 1 ||
        !["visible", "hidden", "recover"].every((key) => soloSectionFilterBrief.keys.includes(key)) ||
        !soloSectionFilterBrief.text.includes("필터 브리핑") ||
        !soloSectionFilterBrief.text.includes("숨겨진 후보") ||
        !soloSectionFilterBrief.text.includes("전체 보기")
    ) {
        throw new Error(`games-hub ${viewport.name}: solo section filter brief missing ${JSON.stringify(soloSectionFilterBrief)}`);
    }
    if (false && (soloLaunchDirector.activeFilter !== "solo" || soloLaunchDirector.visibleCount !== 1 || JSON.stringify(soloLaunchDirector.choices) !== JSON.stringify(["포커"]))) {
        throw new Error(`games-hub ${viewport.name}: solo launch director mismatch ${JSON.stringify(soloLaunchDirector)}`);
    }
    if (await clickByAriaLabel(ws, "전체 필터로 결과 다시 보기") !== "clicked") {
        throw new Error(`games-hub ${viewport.name}: filter result reset button missing`);
    }
    await waitForExpression(ws, `document.querySelector('[data-smoke="game-hub-filter-panel"]')?.getAttribute("data-active-filter") === "all"`, "games hub filter result reset restored all");
    }
    if (await clickByAriaLabel(ws, "전체 필터") !== "clicked") {
        throw new Error(`games-hub ${viewport.name}: all filter button missing`);
    }
    await waitForExpression(ws, `document.querySelector('[data-smoke="game-hub-filter-panel"]')?.getAttribute("data-active-filter") === "all"`, "games hub all filter restored");
    const restoredCards = await evaluate(ws, `Array.from(document.querySelectorAll('[data-smoke="game-card"]')).map((node) => node.getAttribute("data-game-title"))`);
    if (JSON.stringify(restoredCards) !== JSON.stringify(expectedOrder)) {
        throw new Error(`games-hub ${viewport.name}: all filter restore mismatch ${JSON.stringify(restoredCards)}`);
    }

    const boardValue = await inspectPageFrame(ws, `games-hub ${viewport.name}`, gamesHubTexts);

    const videoTabClicked = await evaluate(ws, `(() => {
        const tab = Array.from(document.querySelectorAll('button[role="tab"]')).find((node) => node.innerText.includes("비디오게임"));
        if (!tab) return false;
        tab.click();
        return true;
    })()`);
    if (!videoTabClicked) {
        throw new Error(`games-hub ${viewport.name}: video game tab missing`);
    }
    const videoResumePanel = await evaluate(ws, `(() => {
        const panel = document.querySelector('[data-smoke="game-hub-resume-panel"]');
        return {
            mounted: Boolean(panel),
            activeTab: panel?.getAttribute("data-active-tab") || "",
            count: Number(panel?.getAttribute("data-resume-count") || 0),
            art: panel?.querySelectorAll('[data-smoke="game-hub-resume-art"]').length || 0,
            nodes: panel?.querySelectorAll('[data-smoke="game-hub-resume-art-node"]').length || 0,
            insightRail: panel?.querySelectorAll('[data-smoke="game-hub-resume-insight-rail"]').length || 0,
            insightArt: panel?.querySelectorAll('[data-smoke="game-hub-resume-insight-art"]').length || 0,
            insightNodes: panel?.querySelectorAll('[data-smoke="game-hub-resume-insight-node"]').length || 0,
            insightItems: panel?.querySelectorAll('[data-smoke="game-hub-resume-insight-item"]').length || 0,
            roomResumeCount: Number(panel?.querySelector('[data-smoke="game-hub-resume-insight-rail"]')?.getAttribute("data-room-resume-count") || 0),
            progressResumeCount: Number(panel?.querySelector('[data-smoke="game-hub-resume-insight-rail"]')?.getAttribute("data-progress-resume-count") || 0),
            items: panel?.querySelectorAll('[data-smoke="game-hub-resume-item"]').length || 0,
            links: Array.from(panel?.querySelectorAll('[data-smoke="game-hub-resume-item"]') || []).map((node) => node.getAttribute("href")),
            storageKeys: Array.from(panel?.querySelectorAll('[data-smoke="game-hub-resume-item"]') || []).map((node) => node.getAttribute("data-storage-key")),
            resumeKinds: Array.from(panel?.querySelectorAll('[data-smoke="game-hub-resume-item"]') || []).map((node) => node.getAttribute("data-resume-kind")),
            text: panel?.innerText || "",
        };
    })()`);
    if (
        !videoResumePanel.mounted ||
        videoResumePanel.activeTab !== "video" ||
        videoResumePanel.count < 1 ||
        videoResumePanel.art !== 0 ||
        videoResumePanel.nodes !== 0 ||
        videoResumePanel.insightRail !== 0 ||
        videoResumePanel.insightArt !== 0 ||
        videoResumePanel.insightNodes !== 0 ||
        videoResumePanel.insightItems !== 0 ||
        videoResumePanel.progressResumeCount !== 0 ||
        videoResumePanel.items < 1 ||
        !videoResumePanel.links.includes("/app/games/video/rpg") ||
        !videoResumePanel.storageKeys.includes("good_etc_rpg_save_v1") ||
        !videoResumePanel.resumeKinds.includes("progress") ||
        !videoResumePanel.text.includes("저장된 비디오게임 흐름") ||
        !videoResumePanel.text.includes("이어가기 화면 열기") ||
        videoResumePanel.text.includes("저장 흐름") ||
        videoResumePanel.text.includes("입력·세션 상태")
    ) {
        throw new Error(`games-hub ${viewport.name}: video resume panel missing ${JSON.stringify(videoResumePanel)}`);
    }
    const videoFilterPanel = await evaluate(ws, `(() => {
        const panel = document.querySelector('[data-smoke="game-hub-filter-panel"]');
        return {
            mounted: Boolean(panel),
            activeFilter: panel?.getAttribute("data-active-filter") || "",
            art: panel?.querySelectorAll('[data-smoke="game-hub-filter-lens-art"]').length || 0,
            bars: panel?.querySelectorAll('[data-smoke="game-hub-filter-lens-bar"]').length || 0,
            options: panel?.querySelectorAll('[data-smoke="game-hub-filter-option"]').length || 0,
            text: panel?.innerText || "",
        };
    })()`);
    if (!videoFilterPanel.mounted || videoFilterPanel.activeFilter !== "all" || videoFilterPanel.options < 4 || !videoFilterPanel.text.includes("조건 필터")) {
        throw new Error(`games-hub ${viewport.name}: video filter panel missing ${JSON.stringify(videoFilterPanel)}`);
    }
    if (false) {
    const videoBridgePanel = await evaluate(ws, `(() => {
        const panel = document.querySelector('[data-smoke="game-hub-video-bridge-panel"]');
        return {
            mounted: Boolean(panel),
            activeFilter: panel?.getAttribute("data-active-filter") || "",
            visibleCount: Number(panel?.getAttribute("data-visible-count") || 0),
            bridgeCount: Number(panel?.getAttribute("data-bridge-count") || 0),
            art: panel?.querySelectorAll('[data-smoke="game-hub-video-bridge-art"]').length || 0,
            nodes: panel?.querySelectorAll('[data-smoke="game-hub-video-bridge-node"]').length || 0,
            items: panel?.querySelectorAll('[data-smoke="game-hub-video-bridge-item"]').length || 0,
            entries: panel?.querySelectorAll('[data-smoke="game-hub-video-bridge-entry"]').length || 0,
            manuals: panel?.querySelectorAll('[data-smoke="game-hub-video-bridge-manual"]').length || 0,
            links: Array.from(panel?.querySelectorAll('a[href]') || []).map((node) => node.getAttribute("href")),
            text: panel?.innerText || "",
        };
    })()`);
    if (
        !videoBridgePanel.mounted ||
        videoBridgePanel.activeFilter !== "all" ||
        videoBridgePanel.visibleCount < 8 ||
        videoBridgePanel.bridgeCount < 8 ||
        videoBridgePanel.art < 1 ||
        videoBridgePanel.nodes < 4 ||
        videoBridgePanel.items < 4 ||
        videoBridgePanel.entries < 1 ||
        videoBridgePanel.manuals < 1 ||
        !videoBridgePanel.links.includes("/app/games/video/rpg") ||
        !videoBridgePanel.text.includes("Good_ETC 입력 브리지") ||
        !videoBridgePanel.text.includes("비디오게임 입장 전 브리지 점검") ||
        !videoBridgePanel.text.includes("결과 이해")
    ) {
        throw new Error(`games-hub ${viewport.name}: video bridge panel missing ${JSON.stringify(videoBridgePanel)}`);
    }
    }
    if (false) {
    const videoReadinessPanel = await evaluate(ws, `(() => {
        const panel = document.querySelector('[data-smoke="game-hub-readiness-panel"]');
        return {
            mounted: Boolean(panel),
            activeTab: panel?.getAttribute("data-active-tab") || "",
            activeFilter: panel?.getAttribute("data-active-filter") || "",
            visibleCount: Number(panel?.getAttribute("data-visible-count") || 0),
            art: panel?.querySelectorAll('[data-smoke="game-hub-readiness-art"]').length || 0,
            nodes: panel?.querySelectorAll('[data-smoke="game-hub-readiness-node"]').length || 0,
            items: panel?.querySelectorAll('[data-smoke="game-hub-readiness-item"]').length || 0,
            picks: panel?.querySelectorAll('[data-smoke="game-hub-readiness-pick"]').length || 0,
            entries: panel?.querySelectorAll('[data-smoke="game-hub-readiness-entry"]').length || 0,
            manuals: panel?.querySelectorAll('[data-smoke="game-hub-readiness-manual"]').length || 0,
            text: panel?.innerText || "",
        };
    })()`);
    if (
        !videoReadinessPanel.mounted ||
        videoReadinessPanel.activeTab !== "video" ||
        videoReadinessPanel.activeFilter !== "all" ||
        videoReadinessPanel.visibleCount < 8 ||
        videoReadinessPanel.art < 1 ||
        videoReadinessPanel.nodes < 4 ||
        videoReadinessPanel.items < 4 ||
        videoReadinessPanel.picks < 2 ||
        videoReadinessPanel.entries < 2 ||
        videoReadinessPanel.manuals < 2 ||
        !videoReadinessPanel.text.includes("준비 매트릭스")
    ) {
        throw new Error(`games-hub ${viewport.name}: video readiness panel missing ${JSON.stringify(videoReadinessPanel)}`);
    }
    const videoLaunchDirector = await evaluate(ws, `(() => {
        const panel = document.querySelector('[data-smoke="game-hub-launch-director-panel"]');
        return {
            mounted: Boolean(panel),
            activeTab: panel?.getAttribute("data-active-tab") || "",
            activeFilter: panel?.getAttribute("data-active-filter") || "",
            visibleCount: Number(panel?.getAttribute("data-visible-count") || 0),
            art: panel?.querySelectorAll('[data-smoke="game-hub-launch-director-art"]').length || 0,
            routeNodes: panel?.querySelectorAll('[data-smoke="game-hub-launch-route-node"]').length || 0,
            routeItems: panel?.querySelectorAll('[data-smoke="game-hub-launch-route-item"]').length || 0,
            choices: panel?.querySelectorAll('[data-smoke="game-hub-launch-choice"]').length || 0,
            entries: panel?.querySelectorAll('[data-smoke="game-hub-launch-entry"]').length || 0,
            manuals: panel?.querySelectorAll('[data-smoke="game-hub-launch-manual"]').length || 0,
            text: panel?.innerText || "",
        };
    })()`);
    if (
        !videoLaunchDirector.mounted ||
        videoLaunchDirector.activeTab !== "video" ||
        videoLaunchDirector.activeFilter !== "all" ||
        videoLaunchDirector.visibleCount < 8 ||
        videoLaunchDirector.art < 1 ||
        videoLaunchDirector.routeNodes < 4 ||
        videoLaunchDirector.routeItems < 4 ||
        videoLaunchDirector.choices < 3 ||
        videoLaunchDirector.entries < 3 ||
        videoLaunchDirector.manuals < 3 ||
        !videoLaunchDirector.text.includes("비디오게임 시작 디렉터") ||
        !videoLaunchDirector.text.includes("입력 브리지")
    ) {
        throw new Error(`games-hub ${viewport.name}: video launch director missing ${JSON.stringify(videoLaunchDirector)}`);
    }
    }
    for (const text of ["비디오게임 목록", "LAN Arena", "Fortress", "Defense", "Kart Dash", "Bomb Battle", "Snake Rush", "Coin Collector", "Good_ETC RPG"]) {
        await waitForText(ws, text);
    }
    const videoArtworkCount = await evaluate(ws, `document.querySelectorAll('[data-smoke="video-game-artwork"]').length`);
    if (videoArtworkCount < 8) {
        throw new Error(`games-hub ${viewport.name}: video game artwork count too low ${videoArtworkCount}`);
    }
    const videoOrder = await evaluate(ws, `Array.from(document.querySelectorAll('[data-smoke="game-card"]')).map((node) => node.getAttribute("data-game-title"))`);
    const expectedVideoOrder = ["Good_ETC RPG", "Fortress", "Defense", "LAN Arena", "Kart Dash", "Bomb Battle", "Snake Rush", "Coin Collector"];
    if (JSON.stringify(videoOrder) !== JSON.stringify(expectedVideoOrder)) {
        throw new Error(`games-hub ${viewport.name}: video player-count order mismatch ${JSON.stringify(videoOrder)}`);
    }
    if (false) {
    const videoCardFlow = await evaluate(ws, `(() => {
        const rails = Array.from(document.querySelectorAll('[data-smoke="game-card-flow-rail"]'));
        return {
            rails: rails.length,
            videoRails: rails.filter((node) => node.getAttribute("data-flow-type") === "video").length,
            steps: document.querySelectorAll('[data-smoke="game-card-flow-step"]').length,
            text: document.body?.innerText || "",
        };
    })()`);
    if (videoCardFlow.rails < expectedVideoOrder.length || videoCardFlow.videoRails < expectedVideoOrder.length || videoCardFlow.steps < expectedVideoOrder.length * 4 || !videoCardFlow.text.includes("첫 입력") || !videoCardFlow.text.includes("입력·결과")) {
        throw new Error(`games-hub ${viewport.name}: video card flow rail missing ${JSON.stringify(videoCardFlow)}`);
    }
    const videoCardBrief = await evaluate(ws, `(() => {
        const cards = Array.from(document.querySelectorAll('[data-smoke="game-card"]'));
        const panels = cards.map((card) => card.querySelector('[data-smoke="game-card-brief-panel"]')).filter(Boolean);
        return {
            cards: cards.length,
            panels: panels.length,
            videoPanels: panels.filter((node) => node.getAttribute("data-brief-type") === "video").length,
            art: document.querySelectorAll('[data-smoke="game-card-brief-art"]').length,
            nodes: document.querySelectorAll('[data-smoke="game-card-brief-node"]').length,
            items: document.querySelectorAll('[data-smoke="game-card-brief-item"]').length,
            text: document.body?.innerText || "",
        };
    })()`);
    if (
        videoCardBrief.panels < expectedVideoOrder.length ||
        videoCardBrief.videoPanels < expectedVideoOrder.length ||
        videoCardBrief.art < expectedVideoOrder.length ||
        videoCardBrief.nodes < expectedVideoOrder.length * 4 ||
        videoCardBrief.items < expectedVideoOrder.length * 4 ||
        !videoCardBrief.text.includes("입장 전 요약") ||
        !videoCardBrief.text.includes("결과 이해") ||
        !videoCardBrief.text.includes("점수·피드백")
    ) {
        throw new Error(`games-hub ${viewport.name}: video card brief panel missing ${JSON.stringify(videoCardBrief)}`);
    }
    const videoSelectionSignals = await evaluate(ws, `(() => {
        const cards = Array.from(document.querySelectorAll('[data-smoke="game-card"]'));
        const panels = cards.map((card) => card.querySelector('[data-smoke="game-card-selection-panel"]')).filter(Boolean);
        return {
            cards: cards.length,
            panels: panels.length,
            videoPanels: panels.filter((node) => node.getAttribute("data-selection-type") === "video").length,
            art: document.querySelectorAll('[data-smoke="game-card-selection-art"]').length,
            nodes: document.querySelectorAll('[data-smoke="game-card-selection-node"]').length,
            items: document.querySelectorAll('[data-smoke="game-card-selection-item"]').length,
            keys: Array.from(document.querySelectorAll('[data-smoke="game-card-selection-item"]')).map((node) => node.getAttribute("data-selection-key")),
            text: document.body?.innerText || "",
        };
    })()`);
    if (
        videoSelectionSignals.panels < expectedVideoOrder.length ||
        videoSelectionSignals.videoPanels < expectedVideoOrder.length ||
        videoSelectionSignals.art < expectedVideoOrder.length ||
        videoSelectionSignals.nodes < expectedVideoOrder.length * 3 ||
        videoSelectionSignals.items < expectedVideoOrder.length * 3 ||
        !["fit", "first", "manual"].every((key) => videoSelectionSignals.keys.includes(key)) ||
        !videoSelectionSignals.text.includes("선택 신호") ||
        !videoSelectionSignals.text.includes("추천 상황") ||
        !videoSelectionSignals.text.includes("첫 10초")
    ) {
        throw new Error(`games-hub ${viewport.name}: video card selection signal missing ${JSON.stringify(videoSelectionSignals)}`);
    }
    }
    if (false) {
    const videoAdvisor = await evaluate(ws, `(() => {
        const advisor = document.querySelector('[data-smoke="game-fit-advisor"]');
        return {
            mounted: Boolean(advisor),
            count: document.querySelectorAll('[data-smoke="game-fit-pick"]').length,
            art: advisor?.querySelectorAll('[data-smoke="game-fit-advisor-art"]').length || 0,
            nodes: advisor?.querySelectorAll('[data-smoke="game-fit-advisor-node"]').length || 0,
            signals: advisor?.querySelectorAll('[data-smoke="game-fit-advisor-signal"]').length || 0,
            text: advisor?.innerText || "",
        };
    })()`);
    if (!videoAdvisor.mounted || videoAdvisor.count < 4 || videoAdvisor.art < 1 || videoAdvisor.nodes < 4 || videoAdvisor.signals < 4 || !videoAdvisor.text.includes("비디오게임 추천 선택")) {
        throw new Error(`games-hub ${viewport.name}: video game fit advisor missing ${JSON.stringify(videoAdvisor)}`);
    }

    }
    await inspectPageFrame(ws, `games-hub video ${viewport.name}`, [
        "게임 허브",
        "비디오게임 목록",
        "LAN Arena",
        "Fortress",
        "Defense",
        "Kart Dash",
        "Bomb Battle",
        "Snake Rush",
        "Coin Collector",
        "Good_ETC RPG",
    ]);
    return `games-hub ${viewport.name}: ok ${boardValue.clientWidth}/${boardValue.scrollWidth} ${boardValue.url}`;
}

async function inspectVideoGameRoomFlow(ws, viewport) {
    await setViewport(ws, viewport);
    await send(ws, "Page.navigate", { url: `${baseUrl}/app/games/video/arena` });
    await waitForText(ws, "LAN Arena");
    await waitForSelector(ws, '[data-smoke="video-game-join-code-panel"]');
    if (false) {
    await waitForSelector(ws, '[data-smoke="video-game-lobby-brief-panel"]');
    await waitForSelector(ws, '[data-smoke="video-game-room-setup-panel"]');
    await waitForSelector(ws, '[data-smoke="video-game-room-setup-art"]');
    await waitForSelector(ws, '[data-smoke="video-game-join-code-panel"]');
    await waitForSelector(ws, '[data-smoke="video-game-join-code-art"]');
    await waitForSelector(ws, '[data-smoke="video-game-matchmaking-panel"]');
    await waitForSelector(ws, '[data-smoke="video-game-matchmaking-art"]');
    }
    await waitForSelector(ws, '[data-smoke="video-game-room-card"]');

    if (false) {
    const lobbyBriefTiles = await countSelector(ws, '[data-smoke="video-game-lobby-brief-tile"]');
    const setupTiles = await countSelector(ws, '[data-smoke="video-game-room-setup-item"]');
    const setupNodes = await countSelector(ws, '[data-smoke="video-game-room-setup-node"]');
    const joinCodeNodes = await countSelector(ws, '[data-smoke="video-game-join-code-node"]');
    const roomCards = await countSelector(ws, '[data-smoke="video-game-room-card"]');
    const roomCardArt = await countSelector(ws, '[data-smoke="video-game-room-card-art"]');
    const roomCardNodes = await countSelector(ws, '[data-smoke="video-game-room-card-node"]');
    const roomCardSeats = await countSelector(ws, '[data-smoke="video-game-room-card-seat"]');
    const readinessTiles = await countSelector(ws, '[data-smoke="video-game-room-readiness"]');
    const actionTiles = await countSelector(ws, '[data-smoke="video-game-room-action-signal"]');
    const tacticalTiles = await countSelector(ws, '[data-smoke="video-game-room-tactical-signal"]');
    const slotBars = await countSelector(ws, '[data-smoke="video-game-room-slot"]');
    if (lobbyBriefTiles < 3 || setupTiles < 4 || setupNodes < 4 || joinCodeNodes < 3 || roomCards < 2 || roomCardArt < 2 || roomCardNodes < 8 || roomCardSeats < 4 || readinessTiles < 2 || actionTiles < 2 || tacticalTiles < 6 || slotBars < 4) {
        throw new Error(`video-game-room ${viewport.name}: lobby card telemetry missing ${JSON.stringify({ lobbyBriefTiles, setupTiles, setupNodes, joinCodeNodes, roomCards, roomCardArt, roomCardNodes, roomCardSeats, readinessTiles, actionTiles, tacticalTiles, slotBars })}`);
    }
    const matchmakingState = await evaluate(ws, `(() => {
        const panel = document.querySelector('[data-smoke="video-game-matchmaking-panel"]');
        return {
            mounted: Boolean(panel),
            roomCount: Number(panel?.getAttribute("data-room-count") || 0),
            recommended: panel?.getAttribute("data-recommended-room") || "",
            art: document.querySelectorAll('[data-smoke="video-game-matchmaking-art"]').length,
            nodes: document.querySelectorAll('[data-smoke="video-game-matchmaking-node"]').length,
            items: document.querySelectorAll('[data-smoke="video-game-matchmaking-item"]').length,
            choices: document.querySelectorAll('[data-smoke="video-game-matchmaking-choice"]').length,
            openButtons: document.querySelectorAll('[data-smoke="video-game-matchmaking-open"]').length,
            joinButtons: document.querySelectorAll('[data-smoke="video-game-matchmaking-join"]').length,
            text: panel?.innerText || "",
        };
    })()`);
    if (!matchmakingState.mounted || matchmakingState.roomCount < 2 || !matchmakingState.recommended || matchmakingState.art < 1 || matchmakingState.nodes < 4 || matchmakingState.items < 4 || matchmakingState.choices < 2 || matchmakingState.openButtons < 1 || matchmakingState.joinButtons < 1 || !matchmakingState.text.includes("매치메이킹 브리프") || !matchmakingState.text.includes("바로 시작 후보") || !matchmakingState.text.includes("좌석 여유")) {
        throw new Error(`video-game-room ${viewport.name}: matchmaking panel missing ${JSON.stringify(matchmakingState)}`);
    }
    const setupState = await evaluate(ws, `(() => {
        const panel = document.querySelector('[data-smoke="video-game-room-setup-panel"]');
        return {
            text: panel?.innerText || "",
            requestedMax: Number(panel?.getAttribute("data-requested-max") || 0),
            roomCount: Number(panel?.getAttribute("data-room-count") || 0),
            codeReady: panel?.getAttribute("data-code-ready") || "",
            art: document.querySelectorAll('[data-smoke="video-game-room-setup-art"]').length,
            nodes: document.querySelectorAll('[data-smoke="video-game-room-setup-node"]').length,
            keys: Array.from(document.querySelectorAll('[data-smoke="video-game-room-setup-node"]')).map((node) => node.getAttribute("data-setup-key")),
            inputProfile: {
                brief: document.querySelectorAll('[data-smoke="video-game-input-profile-brief"]').length,
                art: document.querySelectorAll('[data-smoke="video-game-input-profile-art"]').length,
                nodes: document.querySelectorAll('[data-smoke="video-game-input-profile-node"]').length,
                items: document.querySelectorAll('[data-smoke="video-game-input-profile-item"]').length,
                keys: Array.from(document.querySelectorAll('[data-smoke="video-game-input-profile-item"]')).map((node) => node.getAttribute("data-input-profile-key")),
            },
        };
    })()`);
    const inputProfileReady = setupState.inputProfile?.brief >= 1 &&
        setupState.inputProfile?.art >= 1 &&
        setupState.inputProfile?.nodes >= 4 &&
        setupState.inputProfile?.items >= 3 &&
        ["structure", "primary", "bridge"].every((key) => setupState.inputProfile.keys.includes(key));
    if (!setupState.text.includes("방 만들기 셋업") || !setupState.text.includes("입력 브릿지") || !setupState.text.includes("입력 프로필") || !setupState.text.includes("입력 구조") || setupState.art < 1 || setupState.nodes < 4 || !inputProfileReady || setupState.requestedMax < 1 || setupState.roomCount < 0 || !["title", "players", "invite", "input"].every((key) => setupState.keys.includes(key))) {
        throw new Error(`video-game-room ${viewport.name}: room setup panel missing SVG setup guidance ${JSON.stringify(setupState)}`);
    }
    const joinCodeState = await evaluate(ws, `(() => {
        const panel = document.querySelector('[data-smoke="video-game-join-code-panel"]');
        const input = document.querySelector('[data-smoke="video-game-join-code-input"]');
        return {
            text: panel?.innerText || "",
            placeholder: input?.getAttribute("placeholder") || "",
            art: document.querySelectorAll('[data-smoke="video-game-join-code-art"]').length,
            submit: document.querySelectorAll('[data-smoke="video-game-join-code-submit"]').length,
            status: document.querySelectorAll('[data-smoke="video-game-join-code-status"]').length,
        };
    })()`);
    if (joinCodeState.placeholder !== "방코드" || joinCodeState.art < 1 || joinCodeState.submit < 1 || joinCodeState.status < 1 || !joinCodeState.text.includes("코드 입장") || !joinCodeState.text.includes("초대 코드")) {
        throw new Error(`video-game-room ${viewport.name}: join-code bridge missing Korean guidance ${JSON.stringify(joinCodeState)}`);
    }
    }
    const lobbyState = await evaluate(ws, `(() => ({
        joinCodePanel: document.querySelectorAll('[data-smoke="video-game-join-code-panel"]').length,
        joinCodeInput: document.querySelectorAll('[data-smoke="video-game-join-code-input"]').length,
        joinCodeSubmit: document.querySelectorAll('[data-smoke="video-game-join-code-submit"]').length,
        roomCards: document.querySelectorAll('[data-smoke="video-game-room-card"]').length,
        roomDecisionRails: document.querySelectorAll('[data-smoke="video-game-room-decision-rail"]').length,
        roomDecisionItems: document.querySelectorAll('[data-smoke="video-game-room-decision-item"]').length,
        roomReadiness: document.querySelectorAll('[data-smoke="video-game-room-readiness"]').length,
        roomActionSignals: document.querySelectorAll('[data-smoke="video-game-room-action-signal"]').length,
        tacticalTiles: document.querySelectorAll('[data-smoke="video-game-room-tactical-signal"]').length,
        slotBars: document.querySelectorAll('[data-smoke="video-game-room-slot"]').length,
        openButtons: document.querySelectorAll('[data-smoke="video-game-room-open"]').length,
        text: document.body?.innerText || "",
    }))()`);
    if (
        lobbyState.joinCodePanel < 1 ||
        lobbyState.joinCodeInput < 1 ||
        lobbyState.joinCodeSubmit < 1 ||
        lobbyState.roomCards < 1 ||
        lobbyState.roomDecisionRails < lobbyState.roomCards ||
        lobbyState.roomDecisionItems < lobbyState.roomCards * 4 ||
        lobbyState.roomReadiness < lobbyState.roomCards ||
        lobbyState.roomActionSignals < lobbyState.roomCards ||
        lobbyState.tacticalTiles < lobbyState.roomCards * 3 ||
        lobbyState.slotBars < lobbyState.roomCards * 2 ||
        lobbyState.openButtons < 1 ||
        !lobbyState.text.includes("방 만들기") ||
        !lobbyState.text.includes("코드 입장")
    ) {
        throw new Error(`video-game-room ${viewport.name}: lobby essentials missing ${JSON.stringify(lobbyState)}`);
    }

    await inspectPageFrame(ws, `video-game lobby ${viewport.name}`, ["LAN Arena"]);
    await clickFirstSelector(ws, '[data-smoke="video-game-room-open"]');
    await waitForSelector(ws, '[data-smoke="video-game-stage-shell"]');
    await waitForSelector(ws, '[data-smoke="video-game-frame-standby-panel"]');
    await waitForSelector(ws, '[data-smoke="video-game-result-spotlight"]');
    await waitForSelector(ws, '[data-smoke="video-game-result-breakdown-panel"]');
    await waitForSelector(ws, '[data-smoke="video-game-mobile-control-panel"]');

    const selectedRoomState = await evaluate(ws, `(() => ({
        stageShell: document.querySelectorAll('[data-smoke="video-game-stage-shell"]').length,
        playRail: document.querySelectorAll('[data-smoke="video-game-play-rail"]').length,
        flowMeter: document.querySelectorAll('[data-smoke="video-game-flow-meter"]').length,
        inputFeedback: document.querySelectorAll('[data-smoke="video-game-input-feedback"]').length,
        actionCue: document.querySelectorAll('[data-smoke="video-game-action-cue-bar"]').length,
        removedStageBrief: document.querySelectorAll('[data-smoke="video-game-stage-brief"]').length,
        removedStageGate: document.querySelectorAll('[data-smoke="video-game-stage-gate-panel"]').length,
        removedInputDeck: document.querySelectorAll('[data-smoke="video-game-input-deck"]').length,
        removedDesktopPad: document.querySelectorAll('[data-smoke="video-game-desktop-command-panel"]').length,
        frameStandby: document.querySelectorAll('[data-smoke="video-game-frame-standby-panel"]').length,
        frameStandbyStatus: document.querySelector('[data-smoke="video-game-frame-standby-panel"]')?.getAttribute("data-stage-status") || "",
        frameStandbyReason: document.querySelector('[data-smoke="video-game-frame-standby-panel"]')?.getAttribute("data-frame-reason") || "",
        frameStandbyArt: document.querySelectorAll('[data-smoke="video-game-frame-standby-art"]').length,
        frameStandbyNodes: document.querySelectorAll('[data-smoke="video-game-frame-standby-node"]').length,
        frameStandbyItems: document.querySelectorAll('[data-smoke="video-game-frame-standby-item"]').length,
        artwork: document.querySelectorAll('[data-smoke="video-game-artwork"]').length,
        resultSpotlight: document.querySelectorAll('[data-smoke="video-game-result-spotlight"]').length,
        resultBreakdown: document.querySelectorAll('[data-smoke="video-game-result-breakdown-panel"]').length,
        resultBreakdownItems: document.querySelectorAll('[data-smoke="video-game-result-breakdown-item"]').length,
        resultTraceArt: document.querySelectorAll('[data-smoke="video-game-result-trace-art"]').length,
        resultTraceNodes: document.querySelectorAll('[data-smoke="video-game-result-trace-node"]').length,
        resultWinner: document.querySelector('[data-smoke="video-game-result-breakdown-panel"]')?.getAttribute("data-winner-name") || "",
        mobileControlPanel: document.querySelectorAll('[data-smoke="video-game-mobile-control-panel"]').length,
        mobileControlVisible: (() => {
            const panel = document.querySelector('[data-smoke="video-game-mobile-control-panel"]');
            if (!panel) return false;
            const style = getComputedStyle(panel);
            const rect = panel.getBoundingClientRect();
            return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
        })(),
        mobileControlMapArt: document.querySelectorAll('[data-smoke="video-game-mobile-control-map-art"]').length,
        mobileControlMapNodes: document.querySelectorAll('[data-smoke="video-game-mobile-control-map-node"]').length,
        mobileControlMapKeys: Array.from(document.querySelectorAll('[data-smoke="video-game-mobile-control-map-node"]')).map((node) => node.getAttribute("data-control-map-key")),
        mobileControlMapStatus: document.querySelector('[data-smoke="video-game-mobile-control-map-art"]')?.getAttribute("data-stage-status") || "",
        mobileControlMapBridgeReady: document.querySelector('[data-smoke="video-game-mobile-control-map-art"]')?.getAttribute("data-bridge-ready") || "",
        mobileControlMapText: document.querySelector('[data-smoke="video-game-mobile-control-map-art"]')?.textContent || "",
        mobileDirectionPad: document.querySelectorAll('[data-smoke="video-game-mobile-direction-pad"]').length,
        mobileDirectionButtons: document.querySelectorAll('[data-smoke="video-game-mobile-control-button"]').length,
        mobileActionPad: document.querySelectorAll('[data-smoke="video-game-mobile-action-pad"]').length,
        mobileActionButtons: document.querySelectorAll('[data-smoke="video-game-mobile-action-button"]').length,
        mobileControlStatus: document.querySelectorAll('[data-smoke="video-game-mobile-control-status"]').length,
        text: document.body?.innerText || "",
    }))()`);
    if (selectedRoomState.stageShell < 1 || selectedRoomState.playRail !== 0 || selectedRoomState.flowMeter !== 0 || selectedRoomState.inputFeedback !== 0 || selectedRoomState.actionCue !== 0 || selectedRoomState.removedStageBrief !== 0 || selectedRoomState.removedStageGate !== 0 || selectedRoomState.removedInputDeck !== 0 || selectedRoomState.removedDesktopPad !== 0 || selectedRoomState.frameStandby < 1 || selectedRoomState.frameStandbyStatus !== "FINISHED" || selectedRoomState.frameStandbyReason !== "결과 검토" || selectedRoomState.frameStandbyArt < 1 || selectedRoomState.frameStandbyNodes < 4 || selectedRoomState.frameStandbyItems < 4 || selectedRoomState.artwork < 1 || selectedRoomState.resultSpotlight < 1 || selectedRoomState.resultBreakdown < 1 || selectedRoomState.resultBreakdownItems < 4 || selectedRoomState.resultTraceArt < 1 || selectedRoomState.resultTraceNodes < 2 || !selectedRoomState.resultWinner || selectedRoomState.mobileControlPanel < 1 || selectedRoomState.mobileControlVisible !== viewport.mobile || (viewport.mobile && (selectedRoomState.mobileDirectionPad < 1 || selectedRoomState.mobileDirectionButtons < 4 || selectedRoomState.mobileActionPad < 1 || selectedRoomState.mobileActionButtons < 2 || selectedRoomState.mobileControlStatus < 1))) {
        throw new Error(`video-game-room ${viewport.name}: selected room panels missing ${JSON.stringify(selectedRoomState)}`);
    }
    if (viewport.mobile && (selectedRoomState.mobileControlMapArt < 1 || selectedRoomState.mobileControlMapNodes < 4 || !["direction", "action", "hold", "bridge"].every((key) => selectedRoomState.mobileControlMapKeys.includes(key)) || selectedRoomState.mobileControlMapStatus !== "FINISHED" || selectedRoomState.mobileControlMapBridgeReady !== "false" || !selectedRoomState.mobileControlMapText.includes("모바일 조작 지도") || !selectedRoomState.mobileControlMapText.includes("iframe 브리지"))) {
        throw new Error(`video-game-room ${viewport.name}: mobile control map missing ${JSON.stringify(selectedRoomState)}`);
    }
    if (!selectedRoomState.text.includes("스모크 아레나") || !selectedRoomState.text.includes("mock-stomp") || !selectedRoomState.text.includes("종료")) {
        throw new Error(`video-game-room ${viewport.name}: selected room text missing ${JSON.stringify(selectedRoomState.text.slice(0, 700))}`);
    }
    if (!selectedRoomState.text.includes("왜 화면이 안 보이나요") || !selectedRoomState.text.includes("화면 대기") || !selectedRoomState.text.includes("다음 행동")) {
        throw new Error(`video-game-room ${viewport.name}: frame standby copy missing ${JSON.stringify(selectedRoomState.text.slice(0, 900))}`);
    }
    const value = await inspectPageFrame(ws, `video-game selected ${viewport.name}`, ["LAN Arena", "스모크 아레나"]);
    if (!selectedRoomState.text.includes("결과 해석") || !selectedRoomState.text.includes("승리 근거") || !selectedRoomState.text.includes("검증 관리자")) {
        throw new Error(`video-game-room ${viewport.name}: result explanation copy missing ${JSON.stringify(selectedRoomState.text.slice(0, 900))}`);
    }
    if (false) {
    if (!selectedRoomState.text.includes("스모크 아레나") || !selectedRoomState.text.includes("mock-stomp") || !selectedRoomState.text.includes("세션 종료")) {
        throw new Error(`video-game-room ${viewport.name}: selected room text missing ${JSON.stringify(selectedRoomState.text.slice(0, 700))}`);
    }
    if (!selectedRoomState.text.includes("왜 화면이 안 보이나요") || !selectedRoomState.text.includes("화면 대기") || !selectedRoomState.text.includes("다음 행동")) {
        throw new Error(`video-game-room ${viewport.name}: frame standby copy missing ${JSON.stringify(selectedRoomState.text.slice(0, 900))}`);
    }
    const value = await inspectPageFrame(ws, `video-game selected ${viewport.name}`, ["LAN Arena", "스모크 아레나"]);
    if (!selectedRoomState.text.includes("결과 해석") || !selectedRoomState.text.includes("승리 근거") || !selectedRoomState.text.includes("검증 관리자")) {
        throw new Error(`video-game-room ${viewport.name}: result explanation copy missing ${JSON.stringify(selectedRoomState.text.slice(0, 900))}`);
    }
    if (!selectedRoomState.text.includes("실시간 상태") || !selectedRoomState.text.includes("발사") || !selectedRoomState.text.includes("대시") || !selectedRoomState.text.includes("입력 대기")) {
        throw new Error(`video-game-room ${viewport.name}: readable Korean control/profile copy missing ${JSON.stringify(selectedRoomState.text.slice(0, 900))}`);
    }
    }
    return `video-game-room ${viewport.name}: ok ${value.clientWidth}/${value.scrollWidth} ${value.url}`;
}

async function inspectVideoGameLobbyRoute(ws, viewport, code) {
    const title = videoGameRouteTitles[code];
    const expectsEmptyLobby = code === "coin";
    await setViewport(ws, viewport);
    await send(ws, "Page.navigate", { url: `${baseUrl}/app/games/video/${code}` });
    await waitForText(ws, title);
    await waitForSelector(ws, '[data-smoke="video-game-join-code-panel"]');
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="video-game-room-card"], [data-smoke="video-game-lobby-empty-state"]'))`, `video-game ${code} lobby content`);
    if (false) {
    await waitForSelector(ws, '[data-smoke="video-game-lobby-brief-panel"]');
    await waitForSelector(ws, '[data-smoke="video-game-room-setup-panel"]');
    await waitForSelector(ws, '[data-smoke="video-game-input-profile-brief"]');
    await waitForSelector(ws, '[data-smoke="video-game-input-profile-art"]');
    await waitForSelector(ws, '[data-smoke="video-game-matchmaking-panel"]');
    if (expectsEmptyLobby) {
        await waitForSelector(ws, '[data-smoke="video-game-lobby-empty-state"]');
        await waitForSelector(ws, '[data-smoke="video-game-matchmaking-empty-choice"]');
    } else {
        await waitForSelector(ws, '[data-smoke="video-game-room-card"]');
    }
    const state = await evaluate(ws, `(() => ({
        roomCards: document.querySelectorAll('[data-smoke="video-game-room-card"]').length,
        roomCardArt: document.querySelectorAll('[data-smoke="video-game-room-card-art"]').length,
        roomCardNodes: document.querySelectorAll('[data-smoke="video-game-room-card-node"]').length,
        roomCardSeats: document.querySelectorAll('[data-smoke="video-game-room-card-seat"]').length,
        roomDecisionRails: document.querySelectorAll('[data-smoke="video-game-room-decision-rail"]').length,
        roomDecisionItems: document.querySelectorAll('[data-smoke="video-game-room-decision-item"]').length,
        roomDecisionKeys: Array.from(document.querySelectorAll('[data-smoke="video-game-room-decision-item"]')).map((node) => node.getAttribute("data-decision-key")),
        tacticalTiles: document.querySelectorAll('[data-smoke="video-game-room-tactical-signal"]').length,
        emptyStates: document.querySelectorAll('[data-smoke="video-game-lobby-empty-state"]').length,
        emptyArt: document.querySelectorAll('[data-smoke="video-game-lobby-empty-art"]').length,
        emptyNodes: document.querySelectorAll('[data-smoke="video-game-lobby-empty-node"]').length,
        emptyItems: document.querySelectorAll('[data-smoke="video-game-lobby-empty-item"]').length,
        emptyModes: Array.from(document.querySelectorAll('[data-smoke="video-game-lobby-empty-state"]')).map((node) => node.getAttribute("data-empty-mode")),
        artwork: document.querySelectorAll('[data-smoke="video-game-artwork"]').length,
        matchmaking: document.querySelectorAll('[data-smoke="video-game-matchmaking-panel"]').length,
        matchmakingArt: document.querySelectorAll('[data-smoke="video-game-matchmaking-art"]').length,
        matchmakingItems: document.querySelectorAll('[data-smoke="video-game-matchmaking-item"]').length,
        matchmakingChoices: document.querySelectorAll('[data-smoke="video-game-matchmaking-choice"]').length,
        matchmakingEmpty: document.querySelectorAll('[data-smoke="video-game-matchmaking-empty-choice"]').length,
        matchmakingEmptyArt: document.querySelectorAll('[data-smoke="video-game-matchmaking-empty-art"]').length,
        matchmakingEmptyNodes: document.querySelectorAll('[data-smoke="video-game-matchmaking-empty-node"]').length,
        matchmakingEmptyItems: document.querySelectorAll('[data-smoke="video-game-matchmaking-empty-item"]').length,
        inputProfileBrief: document.querySelectorAll('[data-smoke="video-game-input-profile-brief"]').length,
        inputProfileArt: document.querySelectorAll('[data-smoke="video-game-input-profile-art"]').length,
        inputProfileNodes: document.querySelectorAll('[data-smoke="video-game-input-profile-node"]').length,
        inputProfileItems: document.querySelectorAll('[data-smoke="video-game-input-profile-item"]').length,
        inputProfileKeys: Array.from(document.querySelectorAll('[data-smoke="video-game-input-profile-item"]')).map((node) => node.getAttribute("data-input-profile-key")),
        inputProfileText: document.querySelector('[data-smoke="video-game-input-profile-brief"]')?.innerText || "",
        text: document.body?.innerText || "",
    }))()`);
    const routeInputProfileReady = state.inputProfileBrief >= 1 &&
        state.inputProfileArt >= 1 &&
        state.inputProfileNodes >= 4 &&
        state.inputProfileItems >= 3 &&
        ["structure", "primary", "bridge"].every((key) => state.inputProfileKeys.includes(key)) &&
        state.inputProfileText.includes("입력 구조") &&
        state.inputProfileText.includes("주 입력") &&
        state.inputProfileText.includes("전달 상태");
    if (!routeInputProfileReady) {
        throw new Error(`video-game ${code} ${viewport.name}: input profile brief missing ${JSON.stringify(state)}`);
    }
    if (code === "defense" && (!state.inputProfileText.includes("액션 버튼 중심") || !state.inputProfileText.includes("고정 방향키"))) {
        throw new Error(`video-game ${code} ${viewport.name}: action-focused input profile missing ${JSON.stringify(state.inputProfileText)}`);
    }
    if (expectsEmptyLobby) {
        if (
            state.roomCards !== 0 ||
            state.emptyStates < 2 ||
            state.emptyArt < 2 ||
            state.emptyNodes < 6 ||
            state.emptyItems < 6 ||
            !state.emptyModes.includes("mine") ||
            !state.emptyModes.includes("joinable") ||
            state.artwork < 2 ||
            state.matchmaking < 1 ||
            state.matchmakingArt < 1 ||
            state.matchmakingItems < 4 ||
            state.matchmakingChoices < 1 ||
            state.matchmakingEmpty < 1 ||
            state.matchmakingEmptyArt < 1 ||
            state.matchmakingEmptyNodes < 3 ||
            state.matchmakingEmptyItems < 3 ||
            !state.text.includes("새 방 만들기") ||
            !state.text.includes("초대 코드") ||
            !state.text.includes("대기방 없음") ||
            !state.text.includes("추천할 대기방이 없습니다") ||
            !state.text.includes("공개 후보가 비어")
        ) {
            throw new Error(`video-game ${code} ${viewport.name}: empty lobby guidance missing ${JSON.stringify(state)}`);
        }
    } else if (
        state.roomCards < 2 ||
        state.roomCardArt < 2 ||
        state.roomCardNodes < 8 ||
        state.roomCardSeats < 4 ||
        state.roomDecisionRails < state.roomCards ||
        state.roomDecisionItems < state.roomCards * 4 ||
        !["access", "seat", "ready", "rhythm"].every((key) => state.roomDecisionKeys.includes(key)) ||
        !state.text.includes("입장 판단") ||
        !state.text.includes("플레이 리듬") ||
        state.tacticalTiles < 6 ||
        state.artwork < 2 ||
        state.matchmaking < 1 ||
        state.matchmakingArt < 1 ||
        state.matchmakingItems < 4 ||
        state.matchmakingChoices < 2
    ) {
        throw new Error(`video-game ${code} ${viewport.name}: lobby coverage missing ${JSON.stringify(state)}`);
    }
    if (!state.text.includes("매치메이킹 브리프") || !state.text.includes("바로 시작 후보")) {
        throw new Error(`video-game ${code} ${viewport.name}: matchmaking copy missing ${JSON.stringify(state.text.slice(0, 700))}`);
    }
    if (!expectsEmptyLobby && !state.text.includes(`스모크 ${title}`) && code !== "arena") {
        throw new Error(`video-game ${code} ${viewport.name}: generated room title missing ${JSON.stringify(state.text.slice(0, 700))}`);
    }
    }
    const routeState = await evaluate(ws, `(() => ({
        joinCodePanel: document.querySelectorAll('[data-smoke="video-game-join-code-panel"]').length,
        joinCodeInput: document.querySelectorAll('[data-smoke="video-game-join-code-input"]').length,
        joinCodeSubmit: document.querySelectorAll('[data-smoke="video-game-join-code-submit"]').length,
        roomCards: document.querySelectorAll('[data-smoke="video-game-room-card"]').length,
        roomDecisionRails: document.querySelectorAll('[data-smoke="video-game-room-decision-rail"]').length,
        roomDecisionItems: document.querySelectorAll('[data-smoke="video-game-room-decision-item"]').length,
        roomDecisionKeys: Array.from(document.querySelectorAll('[data-smoke="video-game-room-decision-item"]')).map((node) => node.getAttribute("data-decision-key")),
        tacticalTiles: document.querySelectorAll('[data-smoke="video-game-room-tactical-signal"]').length,
        roomSlots: document.querySelectorAll('[data-smoke="video-game-room-slot"]').length,
        openButtons: document.querySelectorAll('[data-smoke="video-game-room-open"]').length,
        emptyStates: document.querySelectorAll('[data-smoke="video-game-lobby-empty-state"]').length,
        emptyItems: document.querySelectorAll('[data-smoke="video-game-lobby-empty-item"]').length,
        artwork: document.querySelectorAll('[data-smoke="video-game-artwork"]').length,
        text: document.body?.innerText || "",
    }))()`);
    if (
        routeState.joinCodePanel < 1 ||
        routeState.joinCodeInput < 1 ||
        routeState.joinCodeSubmit < 1 ||
        routeState.artwork < 1 ||
        !routeState.text.includes(title)
    ) {
        throw new Error(`video-game ${code} ${viewport.name}: route shell missing ${JSON.stringify(routeState)}`);
    }
    if (expectsEmptyLobby) {
        if (routeState.roomCards !== 0 && routeState.emptyStates < 1) {
            throw new Error(`video-game ${code} ${viewport.name}: empty lobby state missing ${JSON.stringify(routeState)}`);
        }
    } else if (
        routeState.roomCards < 1 ||
        routeState.roomDecisionRails < routeState.roomCards ||
        routeState.roomDecisionItems < routeState.roomCards * 4 ||
        !["access", "seat", "ready", "rhythm"].every((key) => routeState.roomDecisionKeys.includes(key)) ||
        routeState.tacticalTiles < routeState.roomCards * 3 ||
        routeState.roomSlots < routeState.roomCards * 2 ||
        routeState.openButtons < 1
    ) {
        throw new Error(`video-game ${code} ${viewport.name}: lobby route essentials missing ${JSON.stringify(routeState)}`);
    }
    const value = await inspectPageFrame(ws, `video-game ${code} lobby ${viewport.name}`, [title]);
    return `video-game ${code} lobby ${viewport.name}: ok ${value.clientWidth}/${value.scrollWidth} ${value.url}`;
}

async function main() {
    assertStaticGamesHubManualAccessibility();
    assertStaticVideoGameRoomDesign();

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

    try {
        const ws = await createPipeSession(chrome, { debug, testName: "hub-ui-smoke" });
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
        await send(ws, "Fetch.enable", {
            patterns: [
                { urlPattern: "*://localhost*/api/*", requestStage: "Request" },
                { urlPattern: "*://127.0.0.1*/api/*", requestStage: "Request" },
                { urlPattern: "https://oapi.map.naver.com/*", requestStage: "Request" },
            ],
        });
        await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
            source: `
                localStorage.setItem("accessToken", "smoke-access-token");
                localStorage.setItem("refreshToken", "smoke-refresh-token");
                localStorage.setItem("userRoles", JSON.stringify(["ROLE_ADMIN"]));
                localStorage.setItem("poker_last_room_id", "101");
                localStorage.setItem("poker_last_room_title", "포커 토요일 방");
                localStorage.setItem("las_vegas_last_room_id", "202");
                localStorage.setItem("las_vegas_last_room_title", "라스베가스 주사위 방");
                localStorage.setItem("no_thanks_last_room_id", "303");
                localStorage.setItem("no_thanks_last_room_title", "노 땡스 칩 방");
                localStorage.setItem("catan_last_room_id", "404");
                localStorage.setItem("catan_last_room_title", "카탄 교역 준비방");
                localStorage.setItem("good_etc_rpg_save_v1", JSON.stringify({ player: { level: 12 }, zoneName: "서약의 숲", questTitle: "첫 원정" }));
            `,
        });

        const results = [];
        for (const viewport of viewports) {
            results.push(await inspectAllMenu(ws, viewport));
            results.push(await inspectGamesHub(ws, viewport));
            results.push(await inspectVideoGameRoomFlow(ws, viewport));
            for (const code of Object.keys(videoGameRouteTitles).filter((item) => item !== "arena")) {
                results.push(await inspectVideoGameLobbyRoute(ws, viewport, code));
            }
        }
        if (runtimeErrors.length) {
            throw new Error(`Runtime errors: ${runtimeErrors.join(" | ")}`);
        }
        results.forEach((result) => console.log(result));
        console.log(`hub-ui-smoke ok (${results.length} responsive checks)`);
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
