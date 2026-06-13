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
    path: "/app/games/mahe",
    label: "mahe empty lobby",
    emptyLobbyGame: "mahe",
    expectedTexts: ["마헤", "방 만들기", "대기방 없음", "새 방 만들기", "방코드 입장"],
    assertTabletopEmptyLobby: true,
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
    label: "telestrations draw room",
    telestrationsPhase: "DRAW",
    expectedTexts: ["텔레스트레이션", "그림 제출", "보고 그릴 문장", "그림 도구 상태"],
    assertTelestrationsDraw: true,
  },
  {
    path: "/app/games/telestrations",
    label: "telestrations guess image room",
    telestrationsPhase: "GUESS",
    expectedTexts: ["텔레스트레이션", "문장 추측", "보고 추측할 그림", "그림만 보고 떠오르는 문장을 적으세요"],
    assertTelestrationsImage: true,
  },
  {
    path: "/app/games/telestrations",
    label: "telestrations reveal room",
    telestrationsPhase: "REVEAL",
    expectedTexts: ["텔레스트레이션", "공개 리플레이", "공개 해석", "문구 변화"],
    assertTelestrationsReveal: true,
  },
  {
    path: "/app/games/telestrations",
    label: "telestrations reveal empty room",
    telestrationsPhase: "REVEAL",
    telestrationsEmptyReveal: true,
    expectedTexts: ["텔레스트레이션", "공개 리플레이", "공개 내용 대기", "아직 공개된 내용이 없습니다"],
    assertTelestrationsRevealEmpty: true,
  },
  {
    path: "/app/games/mafia",
    label: "mafia lobby",
    expectedTexts: ["마피아", "방 만들기", "입장", "경찰+의사", "특수직 없음", "5~12명"],
  },
  {
    path: "/app/games/citadels",
    label: "citadels lobby",
    expectedTexts: ["시티델", "방 만들기", "입장", "본게임", "2~7명"],
  },
  {
    path: "/app/games/citadels",
    label: "citadels empty lobby",
    emptyLobbyGame: "citadels",
    expectedTexts: ["시티델", "방 만들기", "대기방 없음", "새 방 만들기", "방코드 입장"],
    assertCitadelsEmptyLobby: true,
  },
  {
    path: "/app/poker",
    label: "poker lobby",
    expectedTexts: ["포커", "방 만들기", "입장", "텍사스 홀덤", "5장 드로우"],
  },
  {
    path: "/app/games/no-thanks",
    label: "no thanks lobby",
    expectedTexts: ["노땡스", "방 만들기", "입장", "방코드 입장", "대기 중인 방"],
  },
  {
    path: "/app/games/las-vegas",
    label: "las vegas active",
    expectedTexts: ["공개 굴림", "직전 배팅 위치", "검증 사용자님이 벨라지오에 주사위 2개를 배팅했습니다."],
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
  roomFlowGame: null,
  soloAiFlowGame: null,
  requests: [],
  telestrationsPhase: "PROMPT",
  telestrationsEmptyReveal: false,
  emptyLobbyGame: "",
  blokusEmptyPieces: false,
  catanDiscardPhase: false,
  catanDomesticTradePending: false,
  catanProgressDiscardPhase: false,
  catanWeddingGivePhase: false,
  citadelsBlockedBuild: false,
  citadelsSelectionPhase: false,
  dalmutiEmptyHand: false,
  mafiaEmptyTargets: false,
  mafiaFinishedResult: false,
  pokerActionTurn: false,
  pokerFiveCardDraw: false,
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
  const source = [
    "src/pages/games/TabletopGame.jsx",
    "src/pages/games/BlokusBoard.jsx",
    "src/pages/games/CatanBoard.jsx",
    "src/pages/games/MaheBoard.jsx",
    "src/pages/games/DalmutiBoard.jsx",
    "src/pages/games/SixNimmtBoard.jsx",
    "src/pages/games/TelestrationsBoard.jsx",
    "src/pages/games/MafiaBoard.jsx",
    "src/pages/games/PokerBoard.jsx",
  ].map((filePath) => readFileSync(filePath, "utf8")).join("\n");
  const requiredSnippets = [
    ["realtimeRoomRef.current = { roomId, roomSeq }", "tracks the latest opened realtime room"],
    ["client.onConnect = () => {", "binds after STOMP CONNECT"],
    ["bindLatestRealtimeRoom(client)", "resubscribes the latest room after reconnect"],
    ["createStompClient", "loads the STOMP runtime through the shared async adapter"],
    ["notifyRealtimeError", "routes STOMP ERROR frames through the shared safe notifier"],
    ["client.beforeConnect = () =>", "refreshes STOMP auth headers before reconnect"],
    ["await fetchState(roomId, roomSeq).catch", "loads a REST snapshot before relying on realtime"],
    ["client.subscribe(`/sub/game/${game}/room/${roomId}`", "subscribes to the active tabletop room topic"],
    ['game === "poker" || game === "telestrations" || game === "mafia") && payload.gameState', "refetches viewer-specific Telestrations state after realtime broadcasts"],
    ["TabletopExperienceRibbon", "keeps a shared tabletop status ribbon mounted in room screens"],
    ['data-smoke="tabletop-experience-ribbon"', "marks the tabletop status ribbon for UI smoke coverage"],
    ["TabletopTurnOrderPanel", "keeps a shared tabletop turn-order rail mounted in room screens"],
    ["TabletopTurnOrderArt", "renders tabletop turn order through reusable SVG artwork"],
    ['data-smoke="tabletop-turn-order-panel"', "marks the tabletop turn-order panel for UI smoke coverage"],
    ['data-smoke="tabletop-turn-order-art"', "marks the tabletop turn-order SVG artwork"],
    ['data-smoke="tabletop-turn-order-node"', "marks tabletop turn-order SVG seat nodes"],
    ['data-smoke="tabletop-turn-order-player"', "marks tabletop turn-order player cards"],
    ["TabletopLobbyBriefPanel", "keeps a shared tabletop lobby-readiness brief mounted before room creation"],
    ["buildTabletopSetupPreviewItems", "derives a shared create-room setup preview from existing form and variant state"],
    ["TabletopSetupPreviewPanel", "keeps a shared create-room setup preview mounted inside tabletop lobbies"],
    ["TabletopSetupPreviewArt", "renders the create-room setup preview through reusable SVG artwork"],
    ["TabletopJoinCodePanel", "keeps a shared tabletop join-code bridge mounted in common board-game lobbies"],
    ["TabletopJoinCodeArt", "renders tabletop join-code entry through reusable SVG artwork"],
    ['data-smoke="tabletop-lobby-brief-panel"', "marks the tabletop lobby brief panel for UI smoke coverage"],
    ['data-smoke="tabletop-lobby-brief-tile"', "marks the tabletop lobby brief tiles for UI smoke coverage"],
    ['data-smoke="tabletop-setup-preview-panel"', "marks the tabletop create-room setup preview panel"],
    ['data-smoke="tabletop-setup-preview-art"', "marks the tabletop create-room setup preview SVG artwork"],
    ['data-smoke="tabletop-setup-preview-node"', "marks tabletop setup preview SVG nodes"],
    ['data-smoke="tabletop-setup-preview-item"', "marks tabletop setup preview cards"],
    ["buildTabletopLobbyDirectorPlan", "derives shared tabletop lobby room candidates from existing rooms"],
    ["TabletopLobbyDirectorPanel", "keeps a shared tabletop lobby director mounted before room cards"],
    ["TabletopLobbyDirectorArt", "renders the tabletop lobby director through local SVG artwork"],
    ["TabletopLobbyDirectorEmptyChoice", "renders shared tabletop empty director next-action guidance"],
    ["TabletopLobbyDirectorEmptyArt", "renders shared tabletop empty director through local SVG artwork"],
    ['data-smoke="tabletop-lobby-director-panel"', "marks the tabletop lobby director panel for UI smoke coverage"],
    ['data-smoke="tabletop-lobby-director-art"', "marks the tabletop lobby director SVG artwork"],
    ['data-smoke="tabletop-lobby-director-node"', "marks tabletop lobby director SVG nodes"],
    ['data-smoke="tabletop-lobby-director-item"', "marks tabletop lobby director reason tiles"],
    ['data-smoke="tabletop-lobby-director-choice"', "marks tabletop lobby director room choices"],
    ['data-smoke="tabletop-lobby-director-empty-choice"', "marks tabletop lobby director empty next-action guidance"],
    ['data-smoke="tabletop-lobby-director-empty-art"', "marks tabletop lobby director empty SVG artwork"],
    ['data-smoke="tabletop-lobby-director-empty-node"', "marks tabletop lobby director empty SVG nodes"],
    ['data-smoke="tabletop-lobby-director-empty-item"', "marks tabletop lobby director empty action tiles"],
    ['data-smoke="tabletop-lobby-director-primary"', "marks tabletop lobby director primary actions"],
    ["추천할 대기방이 없습니다", "shows Korean shared tabletop empty director copy"],
    ['data-smoke="tabletop-join-code-panel"', "marks the tabletop join-code panel for UI smoke coverage"],
    ['data-smoke="tabletop-join-code-art"', "marks the tabletop join-code SVG artwork"],
    ['data-smoke="tabletop-join-code-node"', "marks tabletop join-code flow nodes"],
    ['data-smoke="tabletop-join-code-input"', "marks tabletop join-code input"],
    ['data-smoke="tabletop-join-code-submit"', "marks tabletop join-code submit"],
    ['data-smoke="tabletop-join-code-status"', "marks tabletop join-code status copy"],
    ["tabletopLobbyRoomReadiness", "derives lobby room readiness from existing room players"],
    ["tabletopLobbyRoomActionSignal", "derives lobby room action guidance from existing room status"],
    ["buildTabletopLobbyRoomDecisionItems", "derives shared tabletop lobby room access/seat/ready/rule decision tiles"],
    ["TabletopLobbyRoomDecisionRail", "renders shared tabletop lobby room decision tiles inside room cards"],
    ["tabletopLobbyRoomDecisionToneClasses", "defines tabletop lobby room decision tile tones"],
    ["TabletopLobbyRoomCardArt", "renders shared tabletop lobby room-card state through local SVG artwork"],
    ["tabletopLobbyRoomCardPalettes", "defines per-game tabletop lobby room-card SVG palettes"],
    ['data-smoke="tabletop-lobby-room-card"', "marks tabletop lobby room cards for UI smoke coverage"],
    ['data-smoke="tabletop-lobby-room-card-art"', "marks tabletop lobby room-card SVG artwork"],
    ['data-smoke="tabletop-lobby-room-card-node"', "marks tabletop lobby room-card SVG state nodes"],
    ['data-smoke="tabletop-lobby-room-card-seat"', "marks tabletop lobby room-card SVG seat markers"],
    ['data-smoke="tabletop-lobby-room-decision-rail"', "marks tabletop lobby room decision rails"],
    ['data-smoke="tabletop-lobby-room-decision-item"', "marks tabletop lobby room decision tiles"],
    ["data-decision-key={item.key}", "marks tabletop lobby room decision tile keys"],
    ["입장 판단", "shows tabletop lobby room access decision copy"],
    ["규칙", "shows tabletop lobby room rule decision copy"],
    ["TabletopLobbyEmptyState", "renders shared tabletop empty lobby guidance when room lists are empty"],
    ["TabletopLobbyEmptyArt", "renders shared tabletop empty lobby through local SVG artwork"],
    ['data-smoke="tabletop-lobby-empty-state"', "marks shared tabletop empty lobby states for UI smoke coverage"],
    ['data-smoke="tabletop-lobby-empty-art"', "marks shared tabletop empty lobby SVG artwork"],
    ['data-smoke="tabletop-lobby-empty-node"', "marks shared tabletop empty lobby SVG nodes"],
    ['data-smoke="tabletop-lobby-empty-item"', "marks shared tabletop empty lobby guidance cards"],
    "data-joinable={listedCanJoin ? \"true\" : \"false\"}",
    ['data-smoke="tabletop-lobby-room-readiness"', "marks tabletop lobby room readiness tiles for UI smoke coverage"],
    ['data-smoke="tabletop-lobby-room-action-signal"', "marks tabletop lobby room action signals for UI smoke coverage"],
    ['data-smoke="tabletop-lobby-room-slot"', "marks tabletop lobby room seat bars for UI smoke coverage"],
    ['data-smoke="tabletop-lobby-room-primary"', "marks tabletop lobby room primary actions for UI smoke coverage"],
    ["TabletopRoomBriefPanel", "keeps a shared room-entry brief mounted in selected room screens"],
    ["TabletopRoomBriefArt", "renders shared tabletop room-entry through local SVG artwork"],
    ["tabletopRoomBriefArtTones", "derives shared tabletop room-entry SVG tones"],
    ["tabletopRoomBriefs", "defines per-game room-entry player guidance"],
    ['data-smoke="tabletop-room-brief-panel"', "marks the tabletop room brief panel for UI smoke coverage"],
    ['data-smoke="tabletop-room-brief-art"', "marks the tabletop room brief SVG artwork"],
    ['data-smoke="tabletop-room-brief-node"', "marks tabletop room brief SVG nodes"],
    ['data-smoke="tabletop-room-brief-tile"', "marks the tabletop room brief tiles for UI smoke coverage"],
    ["buildTabletopSessionRouteItems", "derives shared tabletop selected-room button route guidance from existing room state"],
    ["TabletopSessionRoutePanel", "keeps shared tabletop selected-room button route guidance above session controls"],
    ["TabletopSessionRouteArt", "renders shared tabletop selected-room button route guidance through local SVG artwork"],
    ['data-smoke="tabletop-session-route-panel"', "marks shared tabletop selected-room button route guidance"],
    ['data-smoke="tabletop-session-route-art"', "marks shared tabletop selected-room button route SVG artwork"],
    ['data-smoke="tabletop-session-route-node"', "marks shared tabletop selected-room button route SVG nodes"],
    ['data-smoke="tabletop-session-route-item"', "marks shared tabletop selected-room button route explanation tiles"],
    ["세션 버튼 루트", "renders shared tabletop selected-room button route Korean headline"],
    ["실제 버튼", "renders shared tabletop selected-room primary-button explanation"],
    ["TabletopStartReadinessPanel", "keeps a shared tabletop start-readiness panel mounted before start"],
    ["TabletopStartReadinessArt", "renders shared tabletop start-readiness through local SVG artwork"],
    ["tabletopStartReadinessArtTones", "derives shared tabletop start-readiness SVG tones"],
    ['data-smoke="tabletop-start-readiness-panel"', "marks the tabletop start-readiness panel for UI smoke coverage"],
    ['data-smoke="tabletop-start-readiness-art"', "marks the tabletop start-readiness SVG artwork"],
    ['data-smoke="tabletop-start-readiness-node"', "marks tabletop start-readiness SVG nodes"],
    ['data-smoke="tabletop-start-readiness-item"', "marks tabletop start-readiness reason tiles for UI smoke coverage"],
    ["TabletopBoardFocusPanel", "keeps a shared active-board state focus panel mounted before gameplay boards"],
    ["buildTabletopScoreSignal", "builds per-game score and outcome signals from loaded tabletop state"],
    ["tabletopResultGapText", "shows runner-up score gaps in shared tabletop result explanations"],
    ["buildTabletopProgressDigest", "derives a shared recent-progress digest from loaded tabletop events"],
    ["TabletopProgressDigestPanel", "keeps a shared recent-progress digest mounted before gameplay boards"],
    ["TabletopProgressDigestArt", "renders recent progress through reusable SVG artwork"],
    ['data-smoke="tabletop-progress-digest-panel"', "marks the tabletop recent-progress digest panel"],
    ['data-smoke="tabletop-progress-digest-art"', "marks the tabletop recent-progress digest SVG artwork"],
    ['data-smoke="tabletop-progress-digest-node"', "marks tabletop recent-progress digest SVG nodes"],
    ['data-smoke="tabletop-progress-digest-item"', "marks tabletop recent-progress digest tiles"],
    ["TabletopOutcomeInsightPanel", "keeps a shared finished-state outcome insight panel mounted before session actions"],
    ["TabletopOutcomeInsightArt", "renders finished-state outcome insight through reusable SVG artwork"],
    ["buildTabletopOutcomeInsightItems", "derives outcome insight tiles from existing room and game state"],
    ["tabletopOutcomeBriefs", "defines per-game finished-state outcome interpretation copy"],
    ["블로커스 점수는 남은 조각 손실", "explains why Blokus winners won in finished states"],
    ["동점이면 알 카드 수", "explains Mahe result tie and egg-card basis in finished states"],
    ["가장 먼저 손패를 비워", "explains why the Dalmuti winner becomes next Grand Dalmuti"],
    ["가져간 카드의 황소머리 합계", "explains why Six Nimmt winners won in finished states"],
    ["텔레스트레이션은 승패보다", "explains Telestrations finished replay outcome without inventing a winner"],
    ['data-smoke="tabletop-board-focus-panel"', "marks the tabletop active-board focus panel for UI smoke coverage"],
    ['data-smoke="tabletop-board-focus-tile"', "marks the tabletop active-board focus tiles for UI smoke coverage"],
    ["TabletopHistoryEmptyState", "renders a shared empty recent-history state for board-game logs"],
    ["TabletopHistoryEmptyArt", "renders empty recent-history guidance through local SVG artwork"],
    ['data-smoke="tabletop-history-empty-state"', "marks the tabletop empty history guidance panel"],
    ['data-smoke="tabletop-history-empty-art"', "marks the tabletop empty history SVG artwork"],
    ['data-smoke="tabletop-history-empty-node"', "marks tabletop empty history SVG nodes"],
    ['data-smoke="tabletop-history-empty-item"', "marks tabletop empty history explanation tiles"],
    ['data-smoke="tabletop-focus-history-empty"', "marks the Catan focus-panel empty history guidance mount"],
    ["아직 배치 기록이 없습니다", "explains why a Blokus log can be empty before the first placement"],
    ["아직 이동 기록이 없습니다", "explains why a Mahe log can be empty before the first move"],
    ["아직 카탄 기록이 없습니다", "explains why a Catan log can be empty before the first production/action"],
    ["아직 카드 기록이 없습니다", "explains why a Six Nimmt log can be empty before the first reveal"],
    ['data-smoke="tabletop-outcome-insight-panel"', "marks the tabletop finished-state outcome insight panel"],
    ['data-smoke="tabletop-outcome-insight-art"', "marks the tabletop finished-state outcome insight SVG artwork"],
    ['data-smoke="tabletop-outcome-insight-node"', "marks tabletop finished-state outcome insight SVG nodes"],
    ['data-smoke="tabletop-outcome-insight-item"', "marks tabletop finished-state outcome insight tiles"],
    ['data-outcome-key={item.key}', "marks each tabletop outcome insight tile with a stable meaning key"],
    ['data-outcome-phase={phase}', "keeps finished tabletop outcome phase visible for smoke coverage"],
    ["왜 끝났는지 먼저 읽기", "renders Korean outcome insight headline"],
    ["TabletopSessionActionPanel", "keeps a shared finished-session action panel mounted after board result context"],
    ["TabletopSessionActionArt", "renders finished-session next actions through reusable SVG artwork"],
    ['data-smoke="tabletop-session-action-panel"', "marks the tabletop finished-session action panel"],
    ['data-smoke="tabletop-session-action-art"', "marks the tabletop finished-session SVG artwork"],
    ['data-smoke="tabletop-session-action-node"', "marks tabletop finished-session SVG action nodes"],
    ['data-smoke="tabletop-session-action-item"', "marks tabletop finished-session action tiles"],
    ['data-smoke="tabletop-session-action-refresh"', "marks tabletop finished-session refresh CTA"],
    ['data-smoke="tabletop-session-action-rematch"', "marks tabletop finished-session rematch CTA"],
    ['data-smoke="tabletop-session-action-hub"', "marks tabletop finished-session hub CTA"],
    ['data-smoke="tabletop-session-action-leave"', "marks tabletop finished-session leave CTA"],
    ["TabletopActionReadinessPanel", "keeps a shared tabletop action-readiness panel mounted before gameplay boards"],
    ["TabletopActionReadinessArt", "renders shared tabletop action-readiness through local SVG artwork"],
    ["tabletopActionReadinessArtTones", "derives action-readiness SVG tones from existing readiness item state"],
    ["buildTabletopActionReadinessItems", "derives action readiness copy from existing tabletop game state"],
    ['data-smoke="tabletop-action-readiness-panel"', "marks the tabletop action-readiness panel for UI smoke coverage"],
    ['data-smoke="tabletop-action-readiness-art"', "marks the tabletop action-readiness SVG artwork"],
    ['data-smoke="tabletop-action-readiness-node"', "marks tabletop action-readiness SVG nodes"],
    ['data-smoke="tabletop-action-readiness-item"', "marks tabletop action-readiness reason tiles for UI smoke coverage"],
    ["GameActionCueBar", "uses the shared action cue bar before gameplay boards"],
    ['smoke="tabletop-action-cue-bar"', "marks the tabletop action cue bar for UI smoke coverage"],
    ["GameFlowMeter", "uses the custom SVG flow meter inside dedicated tabletop boards"],
    ['data-smoke="catan-flow-meter"', "marks the compact Catan bottom flow summary"],
    ['data-smoke="catan-flow-summary-item"', "marks compact Catan bottom flow summary tiles"],
    ["CatanVictoryTrackPanel", "renders Catan victory-race pressure from loaded score state"],
    ["CatanVictoryTrackArt", "renders Catan victory progress through reusable SVG artwork"],
    ['data-smoke="catan-victory-track-panel"', "marks the Catan victory track panel"],
    ['data-smoke="catan-victory-track-art"', "marks the Catan victory track SVG artwork"],
    ['data-smoke="catan-victory-track-node"', "marks Catan victory track player nodes"],
    ['data-smoke="catan-victory-track-item"', "marks Catan victory track explanation tiles"],
    ["CatanDiceOutcomePanel", "renders Catan dice outcome guidance from loaded game state"],
    ["CatanDiceFaceArt", "renders Catan dice through reusable SVG artwork"],
    ['data-smoke="catan-dice-outcome-panel"', "marks the Catan dice outcome panel"],
    ['data-smoke="catan-dice-face-art"', "marks Catan dice face SVG assets"],
    ["buildCatanDiscardPlannerItems", "derives Catan discard requirement and selection guidance from loaded discard state"],
    ["CatanDiscardPlannerPanel", "renders Catan discard-stage selection guidance"],
    ["CatanDiscardPlannerArt", "renders Catan discard-stage guidance through local SVG artwork"],
    ['data-smoke="catan-discard-planner-panel"', "marks the Catan discard planner panel"],
    ['data-smoke="catan-discard-planner-art"', "marks Catan discard planner SVG artwork"],
    ['data-smoke="catan-discard-planner-node"', "marks Catan discard planner SVG nodes"],
    ['data-smoke="catan-discard-planner-item"', "marks Catan discard planner explanation tiles"],
    ['data-smoke="catan-discard-planner-chip"', "marks Catan discard selected-resource chips"],
    ["버리기 플래너", "labels the Catan discard planner in Korean"],
    ["정확히 몇 장을 버려야 하는지", "explains exact Catan discard count before submit"],
    ["buildCatanProgressDiscardPlannerItems", "derives Catan progress-card discard guidance from loaded progress-card state"],
    ["CatanProgressDiscardPlannerPanel", "renders Catan progress-card discard guidance"],
    ["CatanProgressDiscardPlannerArt", "renders Catan progress-card discard guidance through local SVG artwork"],
    ['data-smoke="catan-progress-discard-planner-panel"', "marks the Catan progress-card discard planner panel"],
    ['data-smoke="catan-progress-discard-planner-art"', "marks Catan progress-card discard planner SVG artwork"],
    ['data-smoke="catan-progress-discard-planner-node"', "marks Catan progress-card discard SVG nodes"],
    ['data-smoke="catan-progress-discard-planner-item"', "marks Catan progress-card discard explanation tiles"],
    ['data-smoke="catan-progress-discard-planner-chip"', "marks Catan progress-card discard candidate chips"],
    ["진행 카드 버리기 플래너", "labels the Catan progress-card discard planner in Korean"],
    ["4장 한도 안으로 정리", "explains the Catan progress-card limit before submit"],
    ["buildCatanDomesticTradeReviewItems", "derives Catan domestic-trade response guidance from loaded pending trade state"],
    ["CatanDomesticTradeReviewPanel", "renders Catan domestic-trade response guidance"],
    ["CatanDomesticTradeReviewArt", "renders Catan domestic-trade response guidance through local SVG artwork"],
    ['data-smoke="catan-domestic-trade-review-panel"', "marks the Catan domestic-trade review panel"],
    ['data-smoke="catan-domestic-trade-review-art"', "marks Catan domestic-trade review SVG artwork"],
    ['data-smoke="catan-domestic-trade-review-node"', "marks Catan domestic-trade review SVG nodes"],
    ['data-smoke="catan-domestic-trade-review-item"', "marks Catan domestic-trade review explanation tiles"],
    ["거래 제안 해석", "labels the Catan domestic-trade review in Korean"],
    ["무엇을 주고 무엇을 받는지", "explains pending Catan trade bundles before response"],
    ["buildCatanWeddingResponseItems", "derives Catan wedding response guidance from loaded wedding state"],
    ["CatanWeddingResponsePanel", "renders Catan wedding response guidance"],
    ["CatanWeddingResponseArt", "renders Catan wedding response guidance through local SVG artwork"],
    ['data-smoke="catan-wedding-response-panel"', "marks the Catan wedding response panel"],
    ['data-smoke="catan-wedding-response-art"', "marks Catan wedding response SVG artwork"],
    ['data-smoke="catan-wedding-response-node"', "marks Catan wedding response SVG nodes"],
    ['data-smoke="catan-wedding-response-item"', "marks Catan wedding response explanation tiles"],
    ['data-smoke="catan-wedding-response-chip"', "marks Catan wedding response card chips"],
    ["혼례 응답 플래너", "labels the Catan wedding response planner in Korean"],
    ["정확히 몇 장을 줄지", "explains exact Catan wedding response count before submit"],
    ["CatanResourceStrategyPanel", "renders Catan resource and build-readiness strategy from loaded game state"],
    ["CatanResourceStrategyArt", "renders Catan resource-to-score strategy through local SVG artwork"],
    ['data-smoke="catan-resource-strategy-panel"', "marks the Catan resource strategy panel"],
    ['data-smoke="catan-resource-strategy-art"', "marks the Catan resource strategy SVG artwork"],
    ['data-smoke="catan-resource-strategy-node"', "marks Catan resource strategy SVG nodes"],
    ['data-smoke="catan-resource-token-art"', "marks Catan local SVG resource tokens"],
    ["자원 → 건설 → 교환 → 승점", "renders Korean Catan resource strategy route copy"],
    ["CatanActionAtlasPanel", "renders Catan action target and lock guidance from loaded game state"],
    ["CatanActionAtlasArt", "renders Catan action guidance through reusable SVG artwork"],
    ['data-smoke="catan-action-atlas-panel"', "marks the Catan action atlas panel"],
    ['data-smoke="catan-action-atlas-art"', "marks reusable Catan action atlas SVG artwork"],
    ["buildCatanActionRouteItems", "derives Catan phase, target, button, and end-turn route guidance from loaded game state"],
    ["CatanActionRoutePanel", "renders Catan action-route guidance beside the existing action buttons"],
    ["CatanActionRouteArt", "renders Catan action-route guidance through local SVG artwork"],
    ['data-smoke="catan-action-route-panel"', "marks the Catan action-route panel"],
    ['data-smoke="catan-action-route-art"', "marks Catan action-route SVG artwork"],
    ['data-smoke="catan-action-route-node"', "marks Catan action-route SVG nodes"],
    ['data-smoke="catan-action-route-item"', "marks Catan action-route explanation tiles"],
    ["카탄 액션 루트", "renders Korean Catan action-route copy"],
    ['smoke="catan-result-spotlight"', "marks the Catan finished-game result explanation spotlight"],
    ["catanResultDetail", "derives Catan finished-game winner explanation from loaded score state"],
    ['data-smoke="blokus-bottom-summary"', "marks the compact Blokus bottom summary"],
    ['data-smoke="blokus-bottom-summary-item"', "marks compact Blokus bottom summary tiles"],
    ["남은 압박", "renders compact Blokus remaining-pressure copy"],
    ["BlokusPieceArt", "renders Blokus pieces through reusable SVG artwork"],
    ['data-smoke="blokus-piece-art"', "marks reusable Blokus piece artwork"],
    ["buildBlokusActionRouteItems", "derives Blokus piece/orientation/cell/submit route guidance from loaded board state"],
    ["BlokusActionRoutePanel", "renders Blokus action-route guidance below the real placement controls"],
    ["BlokusActionRouteArt", "renders Blokus action-route guidance through local SVG artwork"],
    ['data-smoke="blokus-action-route-panel"', "marks the Blokus action-route panel"],
    ['data-smoke="blokus-action-route-art"', "marks Blokus action-route SVG artwork"],
    ['data-smoke="blokus-action-route-node"', "marks Blokus action-route SVG nodes"],
    ['data-smoke="blokus-action-route-item"', "marks Blokus action-route explanation tiles"],
    ["블로커스 액션 루트", "renders Korean Blokus action-route copy"],
    ["BlokusRemainingPiecesEmptyPanel", "renders Blokus empty remaining-piece guidance from loaded game state"],
    ["BlokusRemainingPiecesEmptyArt", "renders Blokus empty remaining-piece guidance through reusable SVG artwork"],
    ['data-smoke="blokus-remaining-empty-panel"', "marks the Blokus empty remaining-piece panel"],
    ['data-smoke="blokus-remaining-empty-art"', "marks reusable Blokus empty remaining-piece SVG artwork"],
    ['data-smoke="blokus-remaining-empty-node"', "marks Blokus empty remaining-piece route nodes"],
    ['data-smoke="blokus-remaining-empty-item"', "marks Blokus empty remaining-piece explanation tiles"],
    ["남은 조각 브리핑", "explains why the Blokus remaining-piece list can be empty"],
    ['data-smoke="mahe-bottom-summary"', "marks the compact Mahe bottom summary"],
    ['data-smoke="mahe-bottom-summary-item"', "marks compact Mahe bottom summary tiles"],
    ["MaheTurtleArt", "renders Mahe turtle pieces through reusable SVG artwork"],
    ['data-smoke="mahe-turtle-art"', "marks reusable Mahe turtle artwork"],
    ["buildMaheActionRouteItems", "derives Mahe roll/stop/choice route guidance from loaded game state"],
    ["MaheActionRoutePanel", "renders Mahe action-route guidance beside the board"],
    ["MaheActionRouteArt", "renders Mahe action-route guidance through local SVG artwork"],
    ['data-smoke="mahe-action-route-panel"', "marks the Mahe action-route panel"],
    ['data-smoke="mahe-action-route-art"', "marks Mahe action-route SVG artwork"],
    ['data-smoke="mahe-action-route-node"', "marks Mahe action-route SVG nodes"],
    ['data-smoke="mahe-action-route-item"', "marks Mahe action-route explanation tiles"],
    ["마헤 선택 루트", "renders Korean Mahe action-route copy"],
    ['smoke="dalmuti-flow-meter"', "marks the Dalmuti board flow meter"],
    ["DalmutiCardArt", "renders Dalmuti cards through reusable SVG artwork"],
    ['data-smoke="dalmuti-card-art"', "marks reusable Dalmuti card artwork"],
    ["DalmutiPlayAdvisorPanel", "renders Dalmuti play guidance from loaded game state"],
    ["DalmutiPlayAdvisorArt", "renders Dalmuti play guidance through reusable SVG artwork"],
    ['data-smoke="dalmuti-play-advisor-panel"', "marks the Dalmuti play advisor panel"],
    ['data-smoke="dalmuti-play-advisor-art"', "marks reusable Dalmuti play advisor SVG artwork"],
    ["buildDalmutiActionRouteItems", "derives Dalmuti tax/revolution/play/pass route guidance from loaded game state"],
    ["DalmutiActionRoutePanel", "renders Dalmuti action-route guidance near the action buttons"],
    ["DalmutiActionRouteArt", "renders Dalmuti action-route guidance through local SVG artwork"],
    ['data-smoke="dalmuti-action-route-panel"', "marks the Dalmuti action-route panel"],
    ['data-smoke="dalmuti-action-route-art"', "marks Dalmuti action-route SVG artwork"],
    ['data-smoke="dalmuti-action-route-node"', "marks Dalmuti action-route SVG nodes"],
    ['data-smoke="dalmuti-action-route-item"', "marks Dalmuti action-route explanation tiles"],
    ["달무티 액션 루트", "renders Korean Dalmuti action-route copy"],
    ["DalmutiRankPressurePanel", "renders Dalmuti hand depletion and rank pressure from loaded game state"],
    ["DalmutiRankPressureArt", "renders Dalmuti rank pressure through reusable SVG artwork"],
    ['data-smoke="dalmuti-rank-pressure-panel"', "marks the Dalmuti rank pressure panel"],
    ['data-smoke="dalmuti-rank-pressure-art"', "marks reusable Dalmuti rank pressure SVG artwork"],
    ['data-smoke="dalmuti-rank-pressure-node"', "marks Dalmuti rank pressure SVG player nodes"],
    ['data-smoke="dalmuti-rank-pressure-item"', "marks Dalmuti rank pressure explanation tiles"],
    ["DalmutiPlayPileEmptyState", "renders Dalmuti current-pile empty guidance from loaded game state"],
    ["DalmutiPlayPileEmptyArt", "renders Dalmuti current-pile empty guidance through reusable SVG artwork"],
    ['data-smoke="dalmuti-play-pile-empty-state"', "marks the Dalmuti current-pile empty guidance panel"],
    ['data-smoke="dalmuti-play-pile-empty-art"', "marks reusable Dalmuti current-pile empty SVG artwork"],
    ['data-smoke="dalmuti-play-pile-empty-node"', "marks Dalmuti current-pile empty SVG state nodes"],
    ['data-smoke="dalmuti-play-pile-empty-item"', "marks Dalmuti current-pile empty explanation tiles"],
    ["DalmutiEmptyHandPanel", "renders Dalmuti empty-hand guidance from loaded game state"],
    ["DalmutiEmptyHandArt", "renders Dalmuti empty-hand guidance through reusable SVG artwork"],
    ['data-smoke="dalmuti-empty-hand-panel"', "marks the Dalmuti empty-hand guidance panel"],
    ['data-smoke="dalmuti-empty-hand-art"', "marks reusable Dalmuti empty-hand SVG artwork"],
    ['data-smoke="dalmuti-empty-hand-node"', "marks Dalmuti empty-hand SVG state nodes"],
    ['data-smoke="dalmuti-empty-hand-item"', "marks Dalmuti empty-hand explanation tiles"],
    ['smoke="six-nimmt-flow-meter"', "marks the Six Nimmt board flow meter"],
    ["SixNimmtCardArt", "renders Six Nimmt cards through reusable SVG artwork"],
    ['data-smoke="six-nimmt-card-art"', "marks reusable Six Nimmt card artwork"],
    ["SixNimmtRiskPanel", "renders Six Nimmt row risk guidance from loaded game state"],
    ["SixNimmtRowRiskArt", "renders Six Nimmt row risk meters through reusable SVG artwork"],
    ["SixNimmtTurnPressurePanel", "renders Six Nimmt selection and reveal pressure from loaded game state"],
    ["SixNimmtTurnPressureArt", "renders Six Nimmt selection pressure through reusable SVG artwork"],
    ["buildSixNimmtActionRouteItems", "derives Six Nimmt select/reveal/row/penalty route guidance from loaded game state"],
    ["SixNimmtActionRoutePanel", "renders Six Nimmt action-route guidance beside the board"],
    ["SixNimmtActionRouteArt", "renders Six Nimmt action-route guidance through local SVG artwork"],
    ['data-smoke="six-nimmt-risk-panel"', "marks the Six Nimmt row risk guidance panel"],
    ['data-smoke="six-nimmt-row-risk-art"', "marks reusable Six Nimmt row risk SVG meters"],
    ['data-smoke="six-nimmt-turn-pressure-panel"', "marks the Six Nimmt turn pressure panel"],
    ['data-smoke="six-nimmt-turn-pressure-art"', "marks reusable Six Nimmt turn pressure SVG artwork"],
    ['data-smoke="six-nimmt-turn-pressure-node"', "marks Six Nimmt turn pressure player nodes"],
    ['data-smoke="six-nimmt-turn-pressure-item"', "marks Six Nimmt turn pressure explanation tiles"],
    ['data-smoke="six-nimmt-action-route-panel"', "marks the Six Nimmt action-route panel"],
    ['data-smoke="six-nimmt-action-route-art"', "marks Six Nimmt action-route SVG artwork"],
    ['data-smoke="six-nimmt-action-route-node"', "marks Six Nimmt action-route SVG nodes"],
    ['data-smoke="six-nimmt-action-route-item"', "marks Six Nimmt action-route explanation tiles"],
    ["식스님트 액션 루트", "renders Korean Six Nimmt action-route copy"],
    ['smoke="telestrations-flow-meter"', "marks the Telestrations board flow meter"],
    ["TelestrationsChainArt", "renders Telestrations relay progress through reusable SVG artwork"],
    ['data-smoke="telestrations-chain-art"', "marks reusable Telestrations chain artwork"],
    ["TelestrationsInputGuidePanel", "renders Telestrations input guidance from loaded game state"],
    ["TelestrationsClueLensArt", "renders Telestrations clue guidance through reusable SVG artwork"],
    ["buildTelestrationsActionRouteItems", "derives Telestrations clue/input/submit/next route guidance from loaded game state"],
    ["TelestrationsActionRoutePanel", "renders Telestrations action-route guidance below the real inputs"],
    ["TelestrationsActionRouteArt", "renders Telestrations action-route guidance through local SVG artwork"],
    ["TelestrationsDrawingToolPanel", "renders Telestrations drawing tool state from local canvas controls"],
    ["TelestrationsDrawingToolArt", "renders Telestrations drawing tool state through reusable SVG artwork"],
    ["TelestrationsRevealInsightPanel", "renders Telestrations reveal interpretation from loaded book entries"],
    ["TelestrationsRevealArcArt", "renders Telestrations reveal drift through reusable SVG artwork"],
    ["TelestrationsEntryEmptyState", "renders Telestrations empty entry guidance from loaded replay state"],
    ["TelestrationsEntryEmptyArt", "renders Telestrations empty entry guidance through reusable SVG artwork"],
    ['data-smoke="telestrations-input-guide-panel"', "marks the Telestrations input guidance panel"],
    ['data-smoke="telestrations-clue-lens-art"', "marks reusable Telestrations clue lens SVG artwork"],
    ['data-smoke="telestrations-action-route-panel"', "marks the Telestrations action-route panel"],
    ['data-smoke="telestrations-action-route-art"', "marks Telestrations action-route SVG artwork"],
    ['data-smoke="telestrations-action-route-node"', "marks Telestrations action-route SVG nodes"],
    ['data-smoke="telestrations-action-route-item"', "marks Telestrations action-route explanation tiles"],
    ['data-smoke="telestrations-drawing-tool-panel"', "marks the Telestrations drawing tool panel"],
    ['data-smoke="telestrations-drawing-tool-art"', "marks reusable Telestrations drawing tool SVG artwork"],
    ['data-smoke="telestrations-drawing-tool-node"', "marks Telestrations drawing tool SVG nodes"],
    ['data-smoke="telestrations-drawing-tool-item"', "marks Telestrations drawing tool explanation tiles"],
    ['data-smoke="telestrations-reveal-insight-panel"', "marks the Telestrations reveal interpretation panel"],
    ['data-smoke="telestrations-reveal-arc-art"', "marks reusable Telestrations reveal SVG artwork"],
    ['data-smoke="telestrations-reveal-current"', "marks the current Telestrations replay item summary"],
    ['data-smoke="telestrations-entry-empty-state"', "marks the Telestrations empty entry guidance panel"],
    ['data-smoke="telestrations-entry-empty-art"', "marks reusable Telestrations empty entry SVG artwork"],
    ['data-smoke="telestrations-entry-empty-node"', "marks Telestrations empty entry route nodes"],
    ['data-smoke="telestrations-entry-empty-item"', "marks Telestrations empty entry explanation tiles"],
    ["공개 내용 대기", "explains why a Telestrations replay entry is not visible yet"],
    ["그림 도구 상태", "shows drawing tool state before Telestrations drawing submission"],
    ["브러시 굵기", "explains current Telestrations brush size"],
    ["캔버스 잉크", "explains whether the drawing canvas has ink"],
    ["제출 전 캔버스 점검", "summarizes Telestrations drawing submission readiness"],
    ["텔레스트레이션 액션 루트", "renders Korean Telestrations action-route copy"],
    ['smoke="mafia-flow-meter"', "marks the Mafia board flow meter"],
    ["MafiaRoleSigil", "renders Mafia roles through reusable SVG artwork"],
    ['data-smoke="mafia-role-sigil"', "marks reusable Mafia role artwork"],
    ["MafiaTargetIntelPanel", "renders Mafia action target guidance from loaded game state"],
    ["MafiaTargetIntelArt", "renders Mafia target/balance guidance through reusable SVG artwork"],
    ["MafiaTargetEmptyBrief", "renders Mafia empty-target guidance from loaded action state"],
    ["MafiaTargetEmptyBriefArt", "renders Mafia empty-target guidance through reusable SVG artwork"],
    ["MafiaVotePressurePanel", "renders Mafia survival and vote pressure from loaded game state"],
    ["MafiaVotePressureArt", "renders Mafia vote pressure through reusable SVG artwork"],
    ["buildMafiaActionRouteItems", "derives Mafia state/target/submit/advance route guidance from loaded game state"],
    ["MafiaActionRoutePanel", "renders Mafia action-route guidance below the real target buttons"],
    ["MafiaActionRouteArt", "renders Mafia action-route guidance through local SVG artwork"],
    ['data-smoke="mafia-target-intel-panel"', "marks the Mafia target intelligence panel"],
    ['data-smoke="mafia-target-intel-art"', "marks reusable Mafia target intelligence SVG artwork"],
    ['data-smoke="mafia-target-empty-brief"', "marks Mafia empty-target explanation panel"],
    ['data-smoke="mafia-target-empty-art"', "marks reusable Mafia empty-target SVG artwork"],
    ['data-smoke="mafia-target-empty-node"', "marks Mafia empty-target SVG nodes"],
    ['data-smoke="mafia-target-empty-item"', "marks Mafia empty-target explanation tiles"],
    ["비어 있는 이유", "explains why Mafia target candidates are unavailable"],
    ["행동 제출 완료", "explains locked Mafia candidate state after submission"],
    ['data-smoke="mafia-vote-pressure-panel"', "marks the Mafia vote pressure panel"],
    ['data-smoke="mafia-vote-pressure-art"', "marks reusable Mafia vote pressure SVG artwork"],
    ['data-smoke="mafia-vote-pressure-node"', "marks Mafia vote pressure player nodes"],
    ['data-smoke="mafia-vote-pressure-item"', "marks Mafia vote pressure explanation tiles"],
    ['data-smoke="mafia-action-route-panel"', "marks the Mafia action-route panel"],
    ['data-smoke="mafia-action-route-art"', "marks Mafia action-route SVG artwork"],
    ['data-smoke="mafia-action-route-node"', "marks Mafia action-route SVG nodes"],
    ['data-smoke="mafia-action-route-item"', "marks Mafia action-route explanation tiles"],
    ["마피아 액션 루트", "renders Korean Mafia action-route copy"],
    ['smoke="mafia-result-spotlight"', "marks the Mafia finished-game result explanation spotlight"],
    ["mafiaResultDetail", "derives Mafia finished-game winner explanation from loaded survival state"],
    ["buildMafiaOutcomeLedgerItems", "derives Mafia finished-game winner reasoning items from loaded outcome state"],
    ["MafiaOutcomeLedgerPanel", "renders Mafia finished-game winner reasoning panel"],
    ["MafiaOutcomeLedgerArt", "renders Mafia finished-game outcome SVG artwork"],
    ['data-smoke="mafia-outcome-ledger-panel"', "marks the Mafia finished-game outcome ledger"],
    ['data-smoke="mafia-outcome-ledger-art"', "marks reusable Mafia outcome ledger SVG artwork"],
    ['data-smoke="mafia-outcome-ledger-node"', "marks Mafia outcome ledger SVG nodes"],
    ['data-smoke="mafia-outcome-ledger-item"', "marks Mafia outcome reasoning tiles"],
    ["마피아 결과 해설", "labels the Mafia result explanation panel in Korean"],
    ["누가 왜 이겼는지", "explains who won and why in Mafia finished state"],
    ["생존 균형", "shows the final Mafia survival balance"],
    ["PlayingCardArt", "renders poker cards through the reusable SVG playing-card asset"],
    ["playingCardSuitLabel", "labels selectable poker cards by accessible suit names"],
    ['smoke="poker-card-art"', "marks reusable poker card art for runtime smoke coverage"],
    ['id="poker-table-panel"', "keeps the Poker table section addressable from the compact rail"],
    ['id="poker-action-panel"', "keeps the Poker action section addressable from the compact rail"],
    ["현재 비용", "shows the current Poker call cost in the action panel"],
    ['핸드 {handNo || "-"} / {maxHands || "-"}', "moves the Poker hand counter into the chip status panel"],
    ["buildPokerActionRouteItems", "derives Poker button-route guidance from loaded action state"],
    ["PokerActionRoutePanel", "renders Poker action route guidance near the real action buttons"],
    ["PokerActionRouteArt", "renders Poker action route through local SVG artwork"],
    ['data-smoke="poker-action-route-panel"', "marks the Poker action route panel"],
    ['data-smoke="poker-action-route-art"', "marks reusable Poker action route SVG artwork"],
    ['data-smoke="poker-action-route-node"', "marks Poker action route SVG nodes"],
    ['data-smoke="poker-action-route-item"', "marks Poker action route explanation tiles"],
    ["포커 액션 루트", "labels Poker button-route guidance in Korean"],
    ["PokerCommunityStandbyPanel", "renders Poker no-community-card guidance from loaded hand state"],
    ["PokerCommunityStandbyArt", "renders Poker no-community-card guidance through reusable SVG artwork"],
    ['data-smoke="poker-community-standby-panel"', "marks the Poker community standby panel"],
    ['data-smoke="poker-community-standby-art"', "marks reusable Poker community standby SVG artwork"],
    ['data-smoke="poker-community-standby-node"', "marks Poker community standby SVG nodes"],
    ['data-smoke="poker-community-standby-item"', "marks Poker community standby explanation tiles"],
    ["공용 카드 브리핑", "explains why Poker community cards can be empty"],
    ["PokerHiddenCardsBrief", "renders Poker hidden/folded card guidance in showdown rows"],
    ["PokerHiddenCardsBriefArt", "renders Poker hidden/folded card guidance through local SVG artwork"],
    ['data-smoke="poker-hidden-cards-brief"', "marks Poker hidden/folded card guidance"],
    ['data-smoke="poker-hidden-cards-brief-art"', "marks Poker hidden/folded card SVG artwork"],
    ['data-smoke="poker-hidden-cards-brief-node"', "marks Poker hidden/folded card SVG nodes"],
    ['data-smoke="poker-hidden-cards-brief-item"', "marks Poker hidden/folded card explanation tiles"],
    ["폴드로 비공개", "explains folded Poker cards are intentionally hidden"],
    ["비교 제외", "explains folded Poker cards are excluded from showdown comparison"],
    ["PokerShowdownBreakdownPanel", "renders Poker showdown result guidance from loaded hand state"],
    ["PokerShowdownTraceArt", "renders Poker showdown result guidance through reusable SVG artwork"],
    ['data-smoke="poker-showdown-breakdown-panel"', "marks the Poker showdown breakdown panel"],
    ['data-smoke="poker-showdown-trace-art"', "marks reusable Poker showdown trace SVG artwork"],
    ["tabletopPlayerPanelScore", "derives player panel score and state labels from loaded room/game state"],
    ['data-smoke="tabletop-players-panel"', "marks the enhanced tabletop players panel"],
    ['data-smoke="tabletop-player-card"', "marks enhanced tabletop player cards"],
    ["TabletopGuideBriefArt", "renders shared tabletop rule guidance through local SVG artwork"],
    ['data-smoke="tabletop-guide-panel"', "marks the shared tabletop rule guide panel"],
    ['data-smoke="tabletop-guide-art"', "marks the shared tabletop rule guide SVG artwork"],
    ['data-smoke="tabletop-guide-node"', "marks the shared tabletop rule guide SVG nodes"],
    ['data-smoke="tabletop-guide-item"', "marks the shared tabletop rule guide briefing tiles"],
    ["규칙 브리핑", "labels the shared tabletop rule guide artwork"],
    ["판정과 행동 연결", "explains that rule reading connects server judgment and player action"],
    ["GameResultSpotlight", "uses the shared result spotlight for finished board states"],
    ['smoke="tabletop-result-spotlight"', "marks the shared tabletop result spotlight"],
    ["승리 근거", "shows why the winner won in finished board-game states"],
    ["승리 조건", "shows the final team condition in social deduction results"],
    ["tabletopLatestActionText", "summarizes the most recent tabletop action for player state awareness"],
    ["tabletopPhaseLabel", "normalizes each game phase into a player-facing Korean label"],
    ['from "./GameUxAssets.jsx"', "uses the custom game UX SVG asset set in tabletop screens"],
    ['GameUxGlyph type="turn"', "uses the custom turn glyph in the shared status ribbon"],
    ['from "./TabletopGameArtwork.jsx"', "uses the custom tabletop game artwork asset set in room screens"],
    ['data-smoke="tabletop-route-artwork"', "marks the route-intro artwork frame for UI smoke coverage"],
    ["buildPokerResultExplanation", "builds a local poker winner explanation when the server does not provide result detail"],
    ["resultDetail || pokerResultExplanation", "prefers server poker result detail but falls back to local hand comparison"],
    ['smoke="poker-result-explanation"', "marks poker winner explanation for runtime smoke coverage"],
  ];
  for (const [snippet, description] of requiredSnippets) {
    if (!source.includes(snippet)) {
      throw new Error(`tabletop-ui-smoke: TabletopGame realtime source must ${description}.`);
    }
  }
  for (const forbidden of ["<filter", "feDropShadow", "filter="]) {
    if (source.includes(forbidden)) {
      throw new Error(`tabletop-ui-smoke: board-game SVG assets must not use SVG filters: ${forbidden}`);
    }
  }
  const sixNimmtRealtimeBranchStart = source.indexOf('if (game === "six-nimmt" && payload.gameState) {');
  const sixNimmtRealtimeBranchEnd = source.indexOf('} else if ((game === "dalmuti"', sixNimmtRealtimeBranchStart);
  const sixNimmtRealtimeBranch = sixNimmtRealtimeBranchStart >= 0 && sixNimmtRealtimeBranchEnd > sixNimmtRealtimeBranchStart
    ? source.slice(sixNimmtRealtimeBranchStart, sixNimmtRealtimeBranchEnd)
    : "";
  if (!sixNimmtRealtimeBranch
    || !sixNimmtRealtimeBranch.includes("enqueueSixNimmtReplayStep(payload.gameState)")
    || !sixNimmtRealtimeBranch.includes("deferSixNimmtFinalState(payload.gameState)")
    || !sixNimmtRealtimeBranch.includes("refreshSixNimmtViewerHand(roomId, roomSeq)")
    || !source.includes("mergeSixNimmtRealtimeState(prev, nextState,")) {
    throw new Error("tabletop-ui-smoke: Six Nimmt realtime must route replay, final, and viewer-hand updates explicitly.");
  }
  if (sixNimmtRealtimeBranch.includes("fetchState(")) {
    throw new Error("tabletop-ui-smoke: Six Nimmt realtime must not immediately refetch stale REST state after a public selection update.");
  }
  if (!source.includes('if (game === "six-nimmt" && result?.gameState)')) {
    throw new Error("tabletop-ui-smoke: Six Nimmt actions must merge the viewer-specific action response.");
  }
  if (source.includes("else client.onConnect = () =>")) {
    throw new Error("tabletop-ui-smoke: openRoom must not overwrite STOMP onConnect per room.");
  }
  if (source.includes("const BoardPreview")) {
    throw new Error("tabletop-ui-smoke: fallback board visuals must use reusable SVG artwork, not the legacy CSS BoardPreview.");
  }
  if (source.includes('SPADES: "♠"') || source.includes("pokerSuitSymbols")) {
    throw new Error("tabletop-ui-smoke: poker card faces must use reusable SVG playing-card assets instead of text suit glyphs.");
  }
  const artworkSource = readFileSync("src/pages/games/TabletopGameArtwork.jsx", "utf8");
  const requiredArtworkLabels = ["포커", "라스베가스", "노땡스", "카탄", "블로커스", "마헤", "달무티", "젝스님트", "텔레스트레이션", "마피아", "시티델", "게임 아트워크"];
  const requiredSourceLabels = ["턴 순서", "계급 압력", 'jester ? "광대"', "`${rank}장`"];
  if (!requiredSourceLabels.every((label) => source.includes(label)) || !requiredArtworkLabels.every((label) => artworkSource.includes(label))) {
    throw new Error("tabletop-ui-smoke: tabletop SVG labels must use Korean turn-order and Dalmuti card copy.");
  }
  const forbiddenArtworkLabels = ['label: "Poker"', 'label: "Las Vegas"', 'label: "Catan"', 'label: "Blokus"', 'label: "Mahe"', 'label: "Dalmuti"', 'label: "6 nimmt!"', 'label: "Telestrations"', 'label: "Mafia"', 'label: "Citadels"', "game artwork"];
  if (source.includes("TURN ORDER") || source.includes("Mahe Reward Pressure") || source.includes("Dalmuti Rank Pressure") || source.includes('"WILD"') || forbiddenArtworkLabels.some((label) => artworkSource.includes(label))) {
    throw new Error("tabletop-ui-smoke: tabletop SVG labels must not show English placeholder copy.");
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

function assertCitadelsLobbyEmptySource() {
  const source = readFileSync("src/pages/games/CitadelsGame.jsx", "utf8");
  const requiredSnippets = [
    ["CitadelsLobbyEmptyState", "render empty Citadels lobby guidance"],
    ["CitadelsLobbyEmptyArt", "render empty Citadels lobby through local SVG artwork"],
    ['data-smoke="citadels-lobby-empty-state"', "mark the empty Citadels lobby state"],
    ['data-smoke="citadels-lobby-empty-art"', "mark the empty Citadels lobby SVG artwork"],
    ['data-smoke="citadels-lobby-empty-node"', "mark empty Citadels lobby SVG nodes"],
    ['data-smoke="citadels-lobby-empty-item"', "mark empty Citadels lobby guidance cards"],
    ['data-smoke="citadels-lobby-empty-refresh"', "mark empty Citadels lobby refresh action"],
    ["새 방 만들기", "show Korean new-room guidance in the empty Citadels lobby"],
    ["방코드 입장", "show Korean room-code guidance in the empty Citadels lobby"],
  ];
  for (const [snippet, description] of requiredSnippets) {
    if (!source.includes(snippet)) {
      throw new Error(`tabletop-ui-smoke: CitadelsGame source must ${description}.`);
    }
  }
  for (const forbidden of ["<filter", "feDropShadow", "filter=", "clipPath", "<mask", "blur("]) {
    if (source.includes(forbidden)) {
      throw new Error(`tabletop-ui-smoke: Citadels SVG assets must not use forbidden SVG effects: ${forbidden}`);
    }
  }
}

function assertActionToastSingleton() {
  const toastSource = readFileSync("src/utils/toast.js", "utf8");
  const requiredSnippets = [
    "const DEFAULT_TOAST_ID = \"app-action-toast\"",
    "const singleToastOptions = (options) => ({",
    "id: options?.id || DEFAULT_TOAST_ID",
    "const showManagedToast = (rawMessage, suppliedOptions, emitter) =>",
    "scheduleToastCleanup(toast, id, options.duration, options.removeDelay)",
    "toast.success(message, toastOptions)",
    "toast.error(message, toastOptions)",
    "toast(message, toastOptions)",
  ];
  const missing = requiredSnippets.filter((snippet) => !toastSource.includes(snippet));
  if (missing.length) {
    throw new Error(`tabletop-ui-smoke: action toasts must replace the same bottom-left slot instead of stacking: ${missing.join(", ")}`);
  }
}

function assertSixNimmtActionSource() {
  const source = [
    "src/pages/games/TabletopGame.jsx",
    "src/pages/games/SixNimmtBoard.jsx",
  ].map((filePath) => readFileSync(filePath, "utf8")).join("\n");
  const requiredSnippets = [
    "const officialRows = possibleRows.filter((item) => item.index === bestIndex);",
    "공식 규칙상 가장 가까운 행에 자동 배치",
    'disabled={!selectedCardId} onClick={selectCard}',
    'phase !== "SELECTING"',
    "previousHand.filter((card) => sixNimmtCardId(card) !== nextSelectedCardId)",
  ];
  const missing = requiredSnippets.filter((snippet) => !source.includes(snippet));
  if (missing.length) {
    throw new Error(`tabletop-ui-smoke: Six Nimmt optional row/realtime guards missing: ${missing.join(", ")}`);
  }
  if (source.includes("selectedNeedsRowTap") || source.includes("selectedHasOptionalRows") || source.includes("disabled={!selectedCardId ||")) {
    throw new Error("tabletop-ui-smoke: Six Nimmt must not block card submit only because multiple compatible rows exist.");
  }
}

function assertCitadelsExperienceSource() {
  const source = readFileSync("src/pages/games/CitadelsGame.jsx", "utf8");
  const uxAssetSource = readFileSync("src/pages/games/GameUxAssets.jsx", "utf8");
  const requiredSnippets = [
    'from "./GameUxAssets.jsx"',
    'from "./TabletopGameArtwork.jsx"',
    "CitadelsExperiencePanel",
    "CitadelsBoardFocusPanel",
    "buildCitadelsProgressDigest",
    "CitadelsProgressDigestPanel",
    "CitadelsProgressDigestArt",
    "CitadelsHistoryEmptyState",
    "CitadelsHistoryEmptyArt",
    "CitadelsSettlementLedgerPanel",
    "CitadelsSettlementLedgerArt",
    "CitadelsCharacterOrderPanel",
    "CitadelsCharacterOrderArt",
    "CitadelsEconomyLensPanel",
    "CitadelsEconomyLensArt",
    "CitadelsBuildBlockedBrief",
    "CitadelsBuildBlockedBriefArt",
    "CitadelsActionAvailabilityPanel",
    "CitadelsActionAvailabilityArt",
    "CitadelsEmptyHandPanel",
    "CitadelsEmptyHandArt",
    "CitadelsSessionActionPanel",
    "CitadelsSessionActionArt",
    "buildCitadelsSessionRouteItems",
    "CitadelsSessionRoutePanel",
    "CitadelsSessionRouteArt",
    "CitadelsCharacterSigil",
    "CitadelsDistrictArt",
    "CitadelsLobbyRoomCard",
    "CitadelsJoinCodePanel",
    "CitadelsJoinCodeArt",
    "buildCitadelsSetupPreviewItems",
    "CitadelsSetupPreviewPanel",
    "CitadelsSetupPreviewArt",
    "buildCitadelsLobbyDirectorPlan",
    "CitadelsLobbyDirectorPanel",
    "CitadelsLobbyDirectorArt",
    "CitadelsLobbyDirectorEmptyChoice",
    "CitadelsLobbyDirectorEmptyArt",
    "CitadelsRoomBriefPanel",
    "buildCitadelsPlayerStateRows",
    "CitadelsPlayerStateMapPanel",
    "CitadelsPlayerStateMapArt",
    "GameStartReadinessPanel",
    "latestCitadelsEventSummary",
    "buildCitadelsSettlementLedger",
    "citadelsScoreOf",
    "citadelsBonusScoreOf",
    'data-smoke="citadels-experience-panel"',
    'data-smoke="citadels-flow-tile"',
    'data-smoke="citadels-board-focus-panel"',
    'data-smoke="citadels-board-focus-tile"',
    'data-smoke="citadels-progress-digest-panel"',
    'data-smoke="citadels-progress-digest-art"',
    'data-smoke="citadels-progress-digest-node"',
    'data-smoke="citadels-progress-digest-item"',
    'data-smoke="citadels-history-empty-state"',
    'data-smoke="citadels-history-empty-art"',
    'data-smoke="citadels-history-empty-node"',
    'data-smoke="citadels-history-empty-item"',
    'data-smoke="citadels-settlement-ledger-panel"',
    'data-smoke="citadels-settlement-ledger-art"',
    'data-smoke="citadels-settlement-player-node"',
    'data-smoke="citadels-settlement-ledger-item"',
    'data-smoke="citadels-character-order-panel"',
    'data-smoke="citadels-character-order-art"',
    'data-smoke="citadels-character-order-node"',
    'data-smoke="citadels-character-order-item"',
    "buildCitadelsSelectionRouteItems",
    "CitadelsSelectionRoutePanel",
    "CitadelsSelectionRouteArt",
    'data-smoke="citadels-selection-route-panel"',
    'data-smoke="citadels-selection-route-art"',
    'data-smoke="citadels-selection-route-node"',
    'data-smoke="citadels-selection-route-item"',
    "캐릭터 선택 루트",
    "선택 버튼",
    'data-smoke="citadels-economy-lens-panel"',
    'data-smoke="citadels-economy-lens-art"',
    'data-smoke="citadels-economy-lens-item"',
    'data-smoke="citadels-build-blocked-brief"',
    'data-smoke="citadels-build-blocked-art"',
    'data-smoke="citadels-build-blocked-node"',
    'data-smoke="citadels-build-blocked-item"',
    "건설 후보 브리핑",
    "막힌 이유",
    "금화 부족",
    'data-smoke="citadels-action-availability-panel"',
    'data-smoke="citadels-action-availability-art"',
    'data-smoke="citadels-action-availability-node"',
    'data-smoke="citadels-action-availability-item"',
    "기본 → 수입/능력 → 건설 → 종료",
    "buildCitadelsActionRouteItems",
    "CitadelsActionRoutePanel",
    "CitadelsActionRouteArt",
    'data-smoke="citadels-action-route-panel"',
    'data-smoke="citadels-action-route-art"',
    'data-smoke="citadels-action-route-node"',
    'data-smoke="citadels-action-route-item"',
    "시티델 액션 루트",
    'data-smoke="citadels-empty-hand-panel"',
    'data-smoke="citadels-empty-hand-art"',
    'data-smoke="citadels-empty-hand-node"',
    'data-smoke="citadels-empty-hand-item"',
    'data-smoke="citadels-session-action-panel"',
    'data-smoke="citadels-session-action-art"',
    'data-smoke="citadels-session-action-node"',
    'data-smoke="citadels-session-action-item"',
    'data-smoke="citadels-session-action-refresh"',
    'data-smoke="citadels-session-action-rematch"',
    'data-smoke="citadels-session-action-hub"',
    'data-smoke="citadels-session-action-leave"',
    'data-smoke="citadels-session-route-panel"',
    'data-smoke="citadels-session-route-art"',
    'data-smoke="citadels-session-route-node"',
    'data-smoke="citadels-session-route-item"',
    "시티델 세션 버튼 루트",
    "실제 버튼 안내",
    'data-smoke="citadels-character-sigil"',
    'data-smoke="citadels-character-button"',
    'data-smoke="citadels-district-card-art"',
    'data-smoke="citadels-district-card"',
    "CitadelsLobbyRoomCardArt",
    "citadelsLobbyRoomCardStatusTone",
    'data-smoke="tabletop-lobby-room-card"',
    'data-smoke="tabletop-lobby-room-card-art"',
    'data-smoke="tabletop-lobby-room-card-node"',
    'data-smoke="tabletop-lobby-room-card-seat"',
    "data-joinable={joinable ? \"true\" : \"false\"}",
    'data-smoke="tabletop-lobby-room-primary"',
    'data-smoke="citadels-join-code-panel"',
    'data-smoke="citadels-join-code-art"',
    'data-smoke="citadels-join-code-node"',
    'data-smoke="citadels-join-code-input"',
    'data-smoke="citadels-join-code-submit"',
    'data-smoke="citadels-join-code-status"',
    'data-smoke="citadels-lobby-director-panel"',
    'data-smoke="citadels-lobby-director-art"',
    'data-smoke="citadels-lobby-director-node"',
    'data-smoke="citadels-lobby-director-item"',
    'data-smoke="citadels-lobby-director-choice"',
    'data-smoke="citadels-lobby-director-empty-choice"',
    'data-smoke="citadels-lobby-director-empty-art"',
    'data-smoke="citadels-lobby-director-empty-node"',
    'data-smoke="citadels-lobby-director-empty-item"',
    'data-smoke="citadels-lobby-director-primary"',
    "추천할 궁정 방이 없습니다",
    'data-smoke="citadels-setup-preview-panel"',
    'data-smoke="citadels-setup-preview-art"',
    'data-smoke="citadels-setup-preview-node"',
    'data-smoke="citadels-setup-preview-item"',
    'placeholder="방코드"',
    "GameFlowMeter",
    'smoke="citadels-flow-meter"',
    'smoke="citadels-action-cue-bar"',
    'GameActionCueBar',
    'GameResultSpotlight',
    'smoke="citadels-result-spotlight"',
    'data-smoke="tabletop-room-brief-panel"',
    'data-smoke="tabletop-room-brief-tile"',
    'data-smoke="citadels-player-state-map-panel"',
    'data-smoke="citadels-player-state-map-art"',
    'data-smoke="citadels-player-state-map-node"',
    'data-smoke="citadels-player-state-map-item"',
    'GameUxGlyph type="turn"',
    'GameUxGlyph type="decision"',
    "시티델 정산 요약",
    "생성 전 궁정 브리핑",
    "궁정 셋업",
    "참가자 도시 지도",
    "좌석, 준비, 현재 차례, 도시 수, 금화",
    "턴 템포",
    "누가 왜 이겼는지",
    "최근 진행 요약",
    "방금 무엇이 바뀌었나",
    "캐릭터 흐름",
    "도시 압력",
    "서버 최종 점수",
    "setActionFeedback",
    "citadelsActionLabel",
    "손패가 비었습니다",
    "구역 보충",
    "건설 후보 없음",
  ];
  const missing = requiredSnippets.filter((snippet) => !source.includes(snippet));
  if (missing.length) {
    throw new Error(`tabletop-ui-smoke: Citadels experience panel guard missing: ${missing.join(", ")}`);
  }
  const requiredUxAssetSnippets = [
    ["GameStartReadinessArt", "render start readiness through shared local SVG artwork"],
    ["startReadinessArtTones", "derive start readiness SVG tones from readiness item state"],
    ["data-smoke={artSmoke}", "mark the start readiness SVG artwork for route smoke coverage"],
    ["data-smoke={nodeSmoke}", "mark start readiness SVG nodes for route smoke coverage"],
    ['data-can-start={canStart ? "true" : "false"}', "expose start readiness launch state without changing behavior"],
  ];
  const missingUxAssetSnippets = requiredUxAssetSnippets.filter(([snippet]) => !uxAssetSource.includes(snippet));
  if (missingUxAssetSnippets.length) {
    throw new Error(`tabletop-ui-smoke: GameUxAssets source missing ${missingUxAssetSnippets.map(([, description]) => description).join(", ")}`);
  }
}

function simulateSixNimmtRealtimeMerge(previousState, realtimeState, mySeatNo) {
  const players = realtimeState.players.map((player) => {
    if (player.seatNo !== mySeatNo) return player;
    const previousPlayer = previousState.players.find((item) => item.seatNo === mySeatNo);
    const selectedCard = Object.prototype.hasOwnProperty.call(player, "selectedCard")
      ? player.selectedCard
      : previousPlayer.selectedCard;
    const nextHand = player.hand?.length
      ? player.hand
      : selectedCard
        ? previousPlayer.hand.filter((card) => card.id !== selectedCard.id)
        : previousPlayer.hand;
    return { ...previousPlayer, ...player, hand: nextHand, selectedCard };
  });
  return { ...previousState, ...realtimeState, players };
}

function assertSixNimmtRealtimeSimulation() {
  const previousState = {
    phase: "SELECTING",
    players: [
      { seatNo: 1, hand: [sixNimmtCard(24), sixNimmtCard(37)], selected: false, selectedCard: null },
      { seatNo: 2, hand: [], selected: false, selectedCard: null },
    ],
  };
  const realtimeState = {
    phase: "SELECTING",
    selectedSeatNos: [1],
    players: [
      { seatNo: 1, hand: [], handCount: 1, selected: true, selectedCard: sixNimmtCard(24) },
      { seatNo: 2, hand: [], handCount: 2, selected: false },
    ],
  };
  const merged = simulateSixNimmtRealtimeMerge(previousState, realtimeState, 1);
  const mine = merged.players.find((player) => player.seatNo === 1);
  if (!mine.selected || mine.hand.length !== 1 || mine.hand[0].id !== "C37" || mine.selectedCard.id !== "C24") {
    throw new Error(`tabletop-ui-smoke: Six Nimmt realtime merge simulation failed ${JSON.stringify(mine)}`);
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
  const soloAiHost = role === "host" && mockState.soloAiFlowGame === game;
  if (soloAiHost) {
    players.push(player(hostMemberId, 1, false, "검증 사용자"));
  } else {
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

function citadelsSmokeCard(id, templateCode, color, cost) {
  return {
    id,
    templateCode,
    template_code: templateCode,
    name: templateCode,
    color,
    cost,
  };
}

function citadelsSmokeGameState(room) {
  const blockedBuildMode = Boolean(mockState.citadelsBlockedBuild);
  const selectionPhaseMode = Boolean(mockState.citadelsSelectionPhase);
  const players = (room.players || []).map((roomPlayer, index) => {
    const seatNo = Number(roomPlayer.seatNo || roomPlayer.seat_no || index + 1);
    const isMe = Number(roomPlayer.memberId || roomPlayer.member_id || 0) === 999;
    const hand = isMe && blockedBuildMode
      ? [
          citadelsSmokeCard("h-expensive-dragon", "DRAGON_GATE", "PURPLE", 6),
          citadelsSmokeCard("h-expensive-palace", "PALACE", "YELLOW", 5),
        ]
      : [];
    return {
      seatNo,
      seat_no: seatNo,
      gold: isMe && blockedBuildMode ? 0 : isMe ? 4 : 2,
      handCount: isMe ? hand.length : 1,
      hand_count: isMe ? hand.length : 1,
      hand,
      city: [
        citadelsSmokeCard(`c-${seatNo}-temple`, "TEMPLE", "BLUE", 1),
        citadelsSmokeCard(`c-${seatNo}-tavern`, "TAVERN", "GREEN", 1),
      ],
      characterCodes: !selectionPhaseMode && seatNo === 1 ? ["MERCHANT"] : [],
      character_codes: !selectionPhaseMode && seatNo === 1 ? ["MERCHANT"] : [],
      score: 2,
      bonusScore: 0,
      bonus_score: 0,
    };
  });
  return {
    game: "CITADELS",
    variantCode: room.variantCode || room.variant_code || "BASE",
    variant_code: room.variantCode || room.variant_code || "BASE",
    phase: selectionPhaseMode ? "CHARACTER_SELECTION" : "TURN_ACTION",
    activeSeatNo: selectionPhaseMode ? 0 : 1,
    active_seat_no: selectionPhaseMode ? 0 : 1,
    chooserSeatNo: selectionPhaseMode ? 1 : 0,
    chooser_seat_no: selectionPhaseMode ? 1 : 0,
    pendingChoiceSeatNo: 0,
    pending_choice_seat_no: 0,
    pendingGraveyardSeatNo: 0,
    pending_graveyard_seat_no: 0,
    activeCharacterCode: selectionPhaseMode ? "" : "MERCHANT",
    active_character_code: selectionPhaseMode ? "" : "MERCHANT",
    selectionStep: selectionPhaseMode ? "CHOOSE" : "",
    selection_step: selectionPhaseMode ? "CHOOSE" : "",
    actionTaken: selectionPhaseMode ? false : blockedBuildMode,
    action_taken: selectionPhaseMode ? false : blockedBuildMode,
    incomeTaken: false,
    income_taken: false,
    characterAbilityUsed: false,
    character_ability_used: false,
    builtThisTurn: 0,
    built_this_turn: 0,
    finalRound: false,
    final_round: false,
    winnerSeatNo: 0,
    winner_seat_no: 0,
    crownSeatNo: 1,
    crown_seat_no: 1,
    availableCharacters: selectionPhaseMode ? [{ code: "ASSASSIN" }, { code: "THIEF" }, { code: "MAGICIAN" }, { code: "KING" }] : [],
    available_characters: selectionPhaseMode ? [{ code: "ASSASSIN" }, { code: "THIEF" }, { code: "MAGICIAN" }, { code: "KING" }] : [],
    faceUpRemovedCharacters: selectionPhaseMode ? [{ code: "BISHOP" }] : [],
    face_up_removed_characters: selectionPhaseMode ? [{ code: "BISHOP" }] : [],
    players,
    events: [],
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
  const discardMode = Boolean(mockState.catanDiscardPhase);
  const domesticTradeMode = Boolean(mockState.catanDomesticTradePending);
  const progressDiscardMode = Boolean(mockState.catanProgressDiscardPhase);
  const weddingMode = Boolean(mockState.catanWeddingGivePhase);
  const players = (room.players || []).map(catanSmokePlayer);
  if (!players[1]) {
    players.push(catanSmokePlayer({ seatNo: 2, seat_no: 2 }, 1));
  }
  if (discardMode && players[0]) {
    players[0].resources = { BRICK: 2, LUMBER: 2, WOOL: 2, GRAIN: 2, ORE: 1 };
    players[0].resourceCount = 9;
    players[0].resource_count = 9;
    players[0].victoryPoints = 2;
    players[0].victory_points = 2;
    players[0].publicVictoryPoints = 2;
    players[0].public_victory_points = 2;
  }
  if (progressDiscardMode && players[0]) {
    const progressCards = [
      { id: "pc-1", type: "CRANE", title: "크레인" },
      { id: "pc-2", type: "ENGINEER", title: "기술자" },
      { id: "pc-3", type: "INVENTOR", title: "발명가" },
      { id: "pc-4", type: "MERCHANT", title: "상인" },
      { id: "pc-5", type: "SPY", title: "첩자" },
      { id: "pc-6", type: "PRINTER", title: "인쇄술" },
    ];
    players[0].progressCards = progressCards;
    players[0].progress_cards = progressCards;
    players[0].victoryPoints = 3;
    players[0].victory_points = 3;
    players[0].publicVictoryPoints = 3;
    players[0].public_victory_points = 3;
  }
  if (domesticTradeMode && players[0] && players[1]) {
    players[0].resources = { BRICK: 1, LUMBER: 1, WOOL: 1, GRAIN: 2, ORE: 0 };
    players[0].resourceCount = 5;
    players[0].resource_count = 5;
    players[1].resources = { BRICK: 0, LUMBER: 2, WOOL: 0, GRAIN: 0, ORE: 1 };
    players[1].resourceCount = 3;
    players[1].resource_count = 3;
  }
  if (weddingMode && players[0]) {
    players[0].resources = { BRICK: 1, LUMBER: 1, WOOL: 0, GRAIN: 1, ORE: 0 };
    players[0].commodities = { PAPER: 1, CLOTH: 0, COIN: 0 };
    players[0].resourceCount = 3;
    players[0].resource_count = 3;
    players[0].commodityCount = 1;
    players[0].commodity_count = 1;
    players[0].victoryPoints = 6;
    players[0].victory_points = 6;
    players[0].publicVictoryPoints = 6;
    players[0].public_victory_points = 6;
  }
  return {
    game: "CATAN",
    variantCode: room.variantCode || room.variant_code || "BASE",
    variant_code: room.variantCode || room.variant_code || "BASE",
    phase: weddingMode ? "WEDDING_GIVE" : progressDiscardMode ? "PROGRESS_DISCARD" : discardMode ? "DISCARD" : domesticTradeMode ? "ACTION" : "ROLL",
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
    citiesKnightsRule: progressDiscardMode || weddingMode,
    cities_knights_rule: progressDiscardMode || weddingMode,
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
    dice: discardMode ? [3, 4] : [],
    lastRoll: discardMode ? 7 : 0,
    last_roll: discardMode ? 7 : 0,
    events: [],
    pendingDiscardSeatNos: discardMode ? [1] : [],
    pending_discard_seat_nos: discardMode ? [1] : [],
    pendingProgressDiscardSeatNos: progressDiscardMode ? [1] : [],
    pending_progress_discard_seat_nos: progressDiscardMode ? [1] : [],
    pendingWeddingAttackerSeatNo: weddingMode ? 2 : 0,
    pending_wedding_attacker_seat_no: weddingMode ? 2 : 0,
    pendingWeddingSeatNos: weddingMode ? [1] : [],
    pending_wedding_seat_nos: weddingMode ? [1] : [],
    pendingDefenderProgressSeatNos: [],
    pending_defender_progress_seat_nos: [],
    pendingGoldChoices: [],
    pending_gold_choices: [],
    pendingAqueductChoices: [],
    pending_aqueduct_choices: [],
    pendingDomesticTrade: domesticTradeMode ? {
      proposerSeatNo: 2,
      proposer_seat_no: 2,
      targetSeatNo: 1,
      target_seat_no: 1,
      offerResources: { LUMBER: 1, ORE: 1 },
      offer_resources: { LUMBER: 1, ORE: 1 },
      requestResources: { GRAIN: 2 },
      request_resources: { GRAIN: 2 },
    } : null,
    pending_domestic_trade: domesticTradeMode ? {
      proposerSeatNo: 2,
      proposer_seat_no: 2,
      targetSeatNo: 1,
      target_seat_no: 1,
      offerResources: { LUMBER: 1, ORE: 1 },
      offer_resources: { LUMBER: 1, ORE: 1 },
      requestResources: { GRAIN: 2 },
      request_resources: { GRAIN: 2 },
    } : null,
  };
}

function blokusSmokeGameState(room) {
  const emptyPiecesMode = Boolean(mockState.blokusEmptyPieces);
  const remainingPieceCodes = emptyPiecesMode ? [] : ["I1", "I2"];
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
        remainingPieceCodes,
        remaining_piece_codes: remainingPieceCodes,
        lastPieceCode: emptyPiecesMode ? "I1" : "",
        last_piece_code: emptyPiecesMode ? "I1" : "",
        shared: false,
        controllerSeatNos: [1],
        controller_seat_nos: [1],
        score: emptyPiecesMode ? 20 : -3,
      },
    ],
    scores: [
      { scoreKey: "SEAT_1", score_key: "SEAT_1", label: "검증 사용자", colors: ["BLUE"], score: emptyPiecesMode ? 20 : -3, winner: false },
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

function dalmutiSmokeCard(id, rank, name, jester = false) {
  return {
    id,
    rank,
    name,
    jester,
  };
}

function dalmutiSmokeGameState(room) {
  const emptyHandMode = Boolean(mockState.dalmutiEmptyHand);
  const players = (room.players || []).map((roomPlayer, index) => {
    const seatNo = Number(roomPlayer?.seatNo || roomPlayer?.seat_no || index + 1);
    const isMe = Number(roomPlayer?.memberId || roomPlayer?.member_id || 0) === 999;
    const hand = isMe
      ? emptyHandMode
        ? []
        : [
            dalmutiSmokeCard(`d-${seatNo}-1a`, 1, "달무티"),
            dalmutiSmokeCard(`d-${seatNo}-1b`, 1, "달무티"),
            dalmutiSmokeCard(`d-${seatNo}-3`, 3, "대주교"),
            dalmutiSmokeCard(`d-${seatNo}-8`, 8, "석공"),
            dalmutiSmokeCard(`d-${seatNo}-j`, 13, "광대", true),
          ]
      : [];
    const handCount = isMe ? hand.length : emptyHandMode ? Math.max(1, 6 - index) : 5;
    return {
      seatNo,
      seat_no: seatNo,
      role: seatNo === 1 ? "DALMUTI" : seatNo === 2 ? "MERCHANT" : seatNo === 3 ? "PEASANT" : "LESSER_PEASANT",
      score: seatNo === 1 ? 3 : 0,
      roundScore: emptyHandMode && isMe ? 8 : 0,
      round_score: emptyHandMode && isMe ? 8 : 0,
      outOrder: emptyHandMode && isMe ? 1 : null,
      out_order: emptyHandMode && isMe ? 1 : null,
      hand,
      handCount,
      hand_count: handCount,
    };
  });
  const turnOrderSeatNos = players.map((player) => Number(player.seatNo));
  const myRoomPlayer = (room.players || []).find((roomPlayer) => Number(roomPlayer?.memberId || roomPlayer?.member_id || 0) === 999);
  const mySeatNo = Number(myRoomPlayer?.seatNo || myRoomPlayer?.seat_no || 1);
  const activeSeatNo = emptyHandMode ? (players.find((player) => Number(player.seatNo) !== Number(mySeatNo))?.seatNo || mySeatNo) : 1;
  const currentTrick = emptyHandMode
    ? {
        seatNo: mySeatNo,
        seat_no: mySeatNo,
        rank: 3,
        rank_name: "대주교",
        rankName: "대주교",
        count: 1,
      }
    : null;
  return {
    game: "DALMUTI",
    variantCode: room.variantCode || room.variant_code || "BASE",
    variant_code: room.variantCode || room.variant_code || "BASE",
    variantName: room.variantName || room.variant_name || "본게임",
    variant_name: room.variantName || room.variant_name || "본게임",
    phase: "PLAYING",
    roundNo: 1,
    round_no: 1,
    activeSeatNo,
    active_seat_no: activeSeatNo,
    leadSeatNo: mySeatNo,
    lead_seat_no: mySeatNo,
    currentTrick,
    current_trick: currentTrick,
    taxExchanges: [],
    tax_exchanges: [],
    playPile: emptyHandMode ? [{ seatNo: mySeatNo, seat_no: mySeatNo, rankName: "대주교", rank_name: "대주교", count: 1 }] : [],
    play_pile: emptyHandMode ? [{ seatNo: mySeatNo, seat_no: mySeatNo, rankName: "대주교", rank_name: "대주교", count: 1 }] : [],
    events: [
      {
        eventNo: 1,
        event_no: 1,
        eventType: emptyHandMode ? "PLAYER_OUT" : "ROUND_STARTED",
        event_type: emptyHandMode ? "PLAYER_OUT" : "ROUND_STARTED",
        seatNo: mySeatNo,
        seat_no: mySeatNo,
        message: emptyHandMode ? "검증 사용자가 손패를 모두 비웠습니다." : "1번째 손이 시작되었습니다.",
      },
    ],
    revolutionEligibleSeatNos: [],
    revolution_eligible_seat_nos: [],
    revolutionDeclinedSeatNos: [],
    revolution_declined_seat_nos: [],
    consecutivePassSeatNos: emptyHandMode ? [activeSeatNo] : [],
    consecutive_pass_seat_nos: emptyHandMode ? [activeSeatNo] : [],
    outSeatNos: emptyHandMode ? [mySeatNo] : [],
    out_seat_nos: emptyHandMode ? [mySeatNo] : [],
    turnOrderSeatNos,
    turn_order_seat_nos: turnOrderSeatNos,
    nextTurnOrderSeatNos: [],
    next_turn_order_seat_nos: [],
    strippedDeckRule: false,
    stripped_deck_rule: false,
    firstDealRevolutionRule: false,
    first_deal_revolution_rule: false,
    removedRanks: [],
    removed_ranks: [],
    players,
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
  const fiveCardDraw = Boolean(mockState.pokerFiveCardDraw);
  const actionTurn = Boolean(mockState.pokerActionTurn);
  const communityCards = fiveCardDraw ? [] : [
    pokerCard("A", "SPADES", 14),
    pokerCard("7", "CLUBS", 7),
    pokerCard("K", "DIAMONDS", 13),
    pokerCard("2", "HEARTS", 2),
    pokerCard("9", "SPADES", 9),
  ];
  const firstHoleCards = fiveCardDraw
    ? [
        pokerCard("A", "HEARTS", 14),
        pokerCard("Q", "SPADES", 12),
        pokerCard("Q", "CLUBS", 12),
        pokerCard("6", "DIAMONDS", 6),
        pokerCard("3", "SPADES", 3),
      ]
    : [pokerCard("A", "HEARTS", 14), pokerCard("Q", "SPADES", 12)];
  const secondHoleCards = fiveCardDraw
    ? [
        pokerCard("K", "CLUBS", 13),
        pokerCard("J", "HEARTS", 11),
        pokerCard("9", "CLUBS", 9),
        pokerCard("4", "HEARTS", 4),
        pokerCard("2", "DIAMONDS", 2),
      ]
    : [pokerCard("K", "CLUBS", 13), pokerCard("J", "HEARTS", 11)];
  return {
    game: "POKER",
    variantCode: fiveCardDraw ? "FIVE_CARD_DRAW" : "TEXAS_HOLDEM",
    variant_code: fiveCardDraw ? "FIVE_CARD_DRAW" : "TEXAS_HOLDEM",
    mode: fiveCardDraw ? "FIVE_CARD_DRAW" : "TEXAS_HOLDEM",
    variantName: fiveCardDraw ? "파이브 카드 드로우" : "텍사스 홀덤",
    variant_name: fiveCardDraw ? "파이브 카드 드로우" : "텍사스 홀덤",
    phase: actionTurn ? "PREFLOP" : "HAND_FINISHED",
    handNo: 1,
    hand_no: 1,
    maxHands: 8,
    max_hands: 8,
    activeSeatNo: actionTurn ? 1 : 0,
    active_seat_no: actionTurn ? 1 : 0,
    dealerSeatNo: 1,
    dealer_seat_no: 1,
    smallBlind: 5,
    small_blind: 5,
    bigBlind: 10,
    big_blind: 10,
    fixedBet: 10,
    fixed_bet: 10,
    ante: 0,
    pot: actionTurn ? 35 : 0,
    lastPot: 85,
    last_pot: 85,
    callAmount: actionTurn ? 10 : 0,
    call_amount: actionTurn ? 10 : 0,
    maxDrawCards: 3,
    max_draw_cards: 3,
    winnerSeatNo: 1,
    winner_seat_no: 1,
    availableActions: actionTurn ? ["FOLD", "CALL", "RAISE", "ALL_IN"] : [],
    available_actions: actionTurn ? ["FOLD", "CALL", "RAISE", "ALL_IN"] : [],
    communityCards,
    community_cards: communityCards,
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
        handRankLabel: fiveCardDraw ? "원페어 Q" : "원페어 A",
        hand_rank_label: fiveCardDraw ? "원페어 Q" : "원페어 A",
        holeCards: firstHoleCards,
        hole_cards: firstHoleCards,
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
        handRankLabel: fiveCardDraw ? "하이카드 K" : "원페어 K",
        hand_rank_label: fiveCardDraw ? "하이카드 K" : "원페어 K",
        holeCards: secondHoleCards,
        hole_cards: secondHoleCards,
      },
      {
        seatNo: 3,
        seat_no: 3,
        name: "AI 3",
        bot: true,
        chips: 960,
        currentBet: 0,
        current_bet: 0,
        folded: true,
        allIn: false,
        all_in: false,
        handRankLabel: "",
        hand_rank_label: "",
        holeCards: [],
        hole_cards: [],
      },
    ],
    events: [
      { eventNo: 1, event_no: 1, message: "쇼다운이 시작되었습니다.", eventType: "SHOWDOWN", event_type: "SHOWDOWN" },
    ],
  };
}

function mafiaSmokeGameState(room = roomFor("mafia", "host", "PLAYING")) {
  const finishedMode = Boolean(mockState.mafiaFinishedResult);
  const phaseEndsAt = finishedMode ? Date.now() : Date.now() + 30000;
  const emptyTargetsMode = Boolean(mockState.mafiaEmptyTargets);
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
    alivePlayerCount: finishedMode ? 4 : 5,
    alive_player_count: finishedMode ? 4 : 5,
    aliveMafiaCount: finishedMode ? 0 : 1,
    alive_mafia_count: finishedMode ? 0 : 1,
    aliveTownCount: 4,
    alive_town_count: 4,
    roundNo: 1,
    round_no: 1,
    phase: finishedMode ? "FINISHED" : "NIGHT_MAFIA",
    phaseStartedAt: Date.now() - 3000,
    phase_started_at: Date.now() - 3000,
    phaseEndsAt,
    phase_ends_at: phaseEndsAt,
    phaseDurationSeconds: finishedMode ? 0 : 30,
    phase_duration_seconds: finishedMode ? 0 : 30,
    turnSeconds: finishedMode ? 0 : 30,
    turn_seconds: finishedMode ? 0 : 30,
    policeEnabled: true,
    police_enabled: true,
    doctorEnabled: true,
    doctor_enabled: true,
    narratorLine: finishedMode ? "시민팀이 마지막 투표로 마피아를 찾아냈습니다." : "1번째 밤입니다. 마피아는 제거할 대상을 고르세요.",
    narrator_line: finishedMode ? "시민팀이 마지막 투표로 마피아를 찾아냈습니다." : "1번째 밤입니다. 마피아는 제거할 대상을 고르세요.",
    viewerSeatNo: 1,
    viewer_seat_no: 1,
    myRole: "MAFIA",
    my_role: "MAFIA",
    myTeam: "MAFIA",
    my_team: "MAFIA",
    myAlive: true,
    my_alive: true,
    mySubmitted: finishedMode || emptyTargetsMode,
    my_submitted: finishedMode || emptyTargetsMode,
    myTask: finishedMode ? "게임이 종료되었습니다. 최종 결과 해설을 확인하세요." : emptyTargetsMode ? "행동을 제출했습니다. 사회자 진행을 기다리세요." : "마피아 대상을 선택하세요. 마피아끼리 같은 사람을 고르면 성공합니다.",
    my_task: finishedMode ? "게임이 종료되었습니다. 최종 결과 해설을 확인하세요." : emptyTargetsMode ? "행동을 제출했습니다. 사회자 진행을 기다리세요." : "마피아 대상을 선택하세요. 마피아끼리 같은 사람을 고르면 성공합니다.",
    availableActions: finishedMode || emptyTargetsMode ? [] : ["MAFIA_KILL"],
    available_actions: finishedMode || emptyTargetsMode ? [] : ["MAFIA_KILL"],
    winnerTeam: finishedMode ? "TOWN" : "",
    winner_team: finishedMode ? "TOWN" : "",
    outcomeMessage: finishedMode ? "시민팀이 마지막 투표에서 마피아를 모두 제거했습니다." : "",
    outcome_message: finishedMode ? "시민팀이 마지막 투표에서 마피아를 모두 제거했습니다." : "",
    mafiaSeatNos: [1],
    mafia_seat_nos: [1],
    completedSeatNos: emptyTargetsMode ? [1] : [],
    completed_seat_nos: emptyTargetsMode ? [1] : [],
    votedSeatNos: [],
    voted_seat_nos: [],
    players: [
      { seatNo: 1, seat_no: 1, role: "MAFIA", team: "MAFIA", alive: !finishedMode },
      { seatNo: 2, seat_no: 2, role: "", team: "", alive: true },
      { seatNo: 3, seat_no: 3, role: "", team: "", alive: true },
      { seatNo: 4, seat_no: 4, role: "", team: "", alive: true },
      { seatNo: 5, seat_no: 5, role: "", team: "", alive: true },
    ].slice(0, Math.max(5, room.players?.length || 5)),
    events: [
      {
        eventNo: 1,
        event_no: 1,
        eventType: finishedMode ? "GAME_FINISHED" : "PHASE_NIGHT_MAFIA",
        event_type: finishedMode ? "GAME_FINISHED" : "PHASE_NIGHT_MAFIA",
        seatNo: 0,
        seat_no: 0,
        message: finishedMode ? "시민팀이 마지막 투표에서 마피아를 모두 제거했습니다." : "1번째 밤입니다. 마피아는 제거할 대상을 고르세요.",
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
  const emptyRevealMode = normalizedPhase === "REVEAL" && Boolean(mockState.telestrationsEmptyReveal);
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
    ? emptyRevealMode
      ? []
      : [
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
  if (method === "POST" && pathname === "/api/auth/reissue") {
    return {
      status: 200,
      headers: [{ name: "Authorization", value: "Bearer smoke-token" }],
      body: { data: { accessToken: "smoke-token" } },
    };
  }
  if (method === "GET" && pathname === "/api/members/notifications/unread-count") {
    return { status: 200, body: { data: 0 } };
  }
  if (method === "GET" && pathname === "/api/banners") {
    return { status: 200, body: { data: [] } };
  }
  if (method === "POST" && pathname === "/api/banners/events") {
    return { status: 200, body: { data: true } };
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
  if (game === "telestrations" && mockState.roomFlowGame !== "telestrations") {
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
  if (method === "GET" && suffix === "rooms") {
    if (mockState.emptyLobbyGame === game) {
      return { status: 200, body: [] };
    }
    return { status: 200, body: variantsByGame[game] ? [roomFor(game, "public")] : [] };
  }
  if (method === "GET" && suffix === "rooms/me") {
    return { status: 200, body: [] };
  }
  if (method === "POST" && suffix === "rooms") {
    const room = roomFor(game, "host");
    room.title = body.title || room.title;
    room.variantCode = body.variant_code || body.variantCode || room.variantCode;
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
  if (method === "POST" && /^rooms\/\d+\/force-finish$/.test(suffix)) {
    recordRequest("forceFinish", game, pathname, body);
    const room = mockState.activeRoomsByGame.get(game) || roomFor(game, "host");
    room.roomStatus = "FINISHED";
    room.room_status = "FINISHED";
    mockState.activeRoomsByGame.set(game, room);
    return { status: 200, body: room };
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
          : game === "dalmuti" && room.roomStatus === "PLAYING"
            ? dalmutiSmokeGameState(room)
            : game === "six-nimmt" && room.roomStatus === "PLAYING"
              ? sixNimmtSmokeGameState(room)
              : game === "telestrations" && room.roomStatus === "PLAYING"
                ? telestrationsSmokeGameState()
                : game === "poker" && room.roomStatus === "PLAYING"
                  ? pokerSmokeGameState(room)
                  : game === "mafia" && room.roomStatus === "PLAYING"
                    ? mafiaSmokeGameState(room)
                    : game === "citadels" && room.roomStatus === "PLAYING"
                      ? citadelsSmokeGameState(room)
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
      ...(mock.headers || []),
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

async function waitForExpression(ws, expression, label, timeoutMs = 12000) {
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

function resetRoomFlowMockFlags() {
  mockState.dalmutiEmptyHand = false;
  mockState.blokusEmptyPieces = false;
  mockState.catanDiscardPhase = false;
  mockState.catanDomesticTradePending = false;
  mockState.catanProgressDiscardPhase = false;
  mockState.catanWeddingGivePhase = false;
  mockState.citadelsBlockedBuild = false;
  mockState.citadelsSelectionPhase = false;
  mockState.mafiaEmptyTargets = false;
  mockState.mafiaFinishedResult = false;
  mockState.pokerActionTurn = false;
  mockState.pokerFiveCardDraw = false;
}

async function runRoomFlowSmoke(ws, game) {
  mockState.requests = mockState.requests.filter((request) => request.game !== game);
  mockState.roomFlowGame = game;
  mockState.soloAiFlowGame = null;
  mockState.activeRoomsByGame.delete(game);
  resetRoomFlowMockFlags();
  mockState.pokerFiveCardDraw = game === "poker";

  await navigateToGame(ws, game);
  const title = `${gameNames[game]} 자동 검증 방`;
  await setInputByAriaLabel(ws, "방 제목", title);
  await clickButtonByText(ws, "방 만들기");
  await waitForText(ws, "방 코드");
  const startButtonText = game === "citadels" ? "시작하기" : "시작";
  await waitForEnabledButton(ws, startButtonText);
  if (game === "citadels") {
    await waitForText(ws, title);
  } else {
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="${game}-waiting-player-roster"]'))`, `${game} waiting players panel rendered`);
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="${game}-waiting-player-roster-item"]').length >= 1`, `${game} waiting player rows rendered`);
  }
  assertRequest(game, "create", (request) => request.body?.title === title, "create-room POST payload");

  await clickButtonByText(ws, startButtonText);
  await waitForText(ws, "진행 중");
  if (game === "citadels") {
    await waitForText(ws, "진행 중");
  }
  if (["catan", "blokus", "mahe", "dalmuti"].includes(game)) {
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="tabletop-players-panel"]'))`, `${game} enhanced players panel rendered`);
    await waitForExpression(ws, `(() => {
      const panel = document.querySelector('[data-smoke="tabletop-players-panel"]');
      const text = panel?.textContent || "";
      return Boolean(panel)
        && document.querySelectorAll('[data-smoke="tabletop-player-card"]').length >= 1
        && /플레이어|좌석|방장|내 좌석|현재 차례/.test(text);
    })()`, `${game} compact players panel copy rendered`);
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="tabletop-player-card"]').length >= 1`, `${game} enhanced player cards rendered`);
  }
  if (game === "catan") {
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="catan-rule-brief"]'))`, "catan selected rule brief");
    await waitForExpression(ws, `document.querySelector('[data-smoke="catan-rule-brief"]')?.textContent.includes("10")`, "catan rule target");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="catan-flow-meter"]'))`, "catan compact bottom flow rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="catan-flow-summary-item"]').length >= 4`, "catan compact bottom flow items rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="catan-victory-track-panel"]'))`, "catan victory track panel rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="catan-victory-track-art"]'))`, "catan victory track SVG rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="catan-victory-track-node"]').length >= 1`, "catan victory track nodes rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="catan-victory-track-item"]').length >= 4`, "catan victory track items rendered");
    await waitForExpression(ws, `/승리 트랙|목표까지|선두/.test(document.querySelector('[data-smoke="catan-victory-track-panel"]')?.textContent || "")`, "catan victory track copy rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="catan-dice-outcome-panel"]'))`, "catan dice outcome panel rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="catan-dice-face-art"]').length >= 2`, "catan dice SVG face assets rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="catan-dice-signal-item"]').length >= 4`, "catan dice signal items rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="catan-dice-production-item"]').length >= 5`, "catan dice production items rendered");
    await waitForExpression(ws, `/주사위|생산|굴림/.test(document.querySelector('[data-smoke="catan-dice-outcome-panel"]')?.textContent || "")`, "catan dice panel explains roll or production state");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="catan-resource-strategy-panel"]'))`, "catan resource strategy panel rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="catan-resource-strategy-art"]'))`, "catan resource strategy SVG rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="catan-resource-strategy-node"]').length >= 4`, "catan resource strategy SVG nodes rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="catan-resource-token-art"]').length >= 5`, "catan resource SVG token assets rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="catan-build-readiness-card"]').length >= 4`, "catan build readiness cards rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="catan-score-race-item"]').length >= 1`, "catan score race rendered");
    await waitForExpression(ws, `/자원 → 건설 → 교환 → 승점/.test(document.querySelector('[data-smoke="catan-resource-strategy-panel"]')?.textContent || "")`, "catan resource strategy route copy rendered");
    await waitForExpression(ws, `(() => { const panel = document.querySelector('[data-smoke="catan-resource-strategy-panel"]'); const keys = Array.from(document.querySelectorAll('[data-smoke="catan-resource-strategy-node"]')).map((node) => node.getAttribute("data-strategy-key")); return Boolean(panel && panel.getAttribute("data-phase") && panel.getAttribute("data-my-turn") !== null && panel.getAttribute("data-resource-total") !== null && panel.getAttribute("data-ready-builds") !== null && ["resource", "build", "trade", "score"].every((key) => keys.includes(key))); })()`, "catan resource strategy metadata rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="catan-action-atlas-panel"]'))`, "catan action atlas panel rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="catan-action-atlas-art"]'))`, "catan action atlas SVG rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="catan-action-atlas-item"]').length >= 4`, "catan action atlas items rendered");
    await waitForExpression(ws, `/액션 아틀라스|보드 대상|주 액션/.test(document.querySelector('[data-smoke="catan-action-atlas-panel"]')?.textContent || "")`, "catan action atlas guidance copy rendered");

    mockState.catanDiscardPhase = true;
    await navigateToGame(ws, game);
    await setInputByAriaLabel(ws, "방 제목", `${gameNames[game]} 버리기 검증 방`);
    await clickButtonByText(ws, "방 만들기");
    await waitForText(ws, "방 코드");
    await waitForEnabledButton(ws, startButtonText);
    await clickButtonByText(ws, startButtonText);
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="catan-discard-planner-panel"]'))`, "catan discard planner panel rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="catan-discard-planner-art"]'))`, "catan discard planner SVG rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="catan-discard-planner-node"]').length >= 4`, "catan discard planner SVG nodes rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="catan-discard-planner-item"]').length >= 4`, "catan discard planner items rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="catan-discard-planner-chip"]').length >= 5`, "catan discard planner chips rendered");
    await waitForExpression(ws, `/버리기 플래너|정확히 몇 장을 버려야 하는지|필요 장수|선택한 카드/.test(document.querySelector('[data-smoke="catan-discard-planner-panel"]')?.textContent || "")`, "catan discard planner Korean copy rendered");
    await waitForExpression(ws, `(() => {
      const panel = document.querySelector('[data-smoke="catan-discard-planner-panel"]');
      const keys = Array.from(panel?.querySelectorAll('[data-smoke="catan-discard-planner-item"]') || []).map((node) => node.getAttribute("data-discard-key"));
      return Boolean(panel)
        && panel.getAttribute("data-must-discard") === "true"
        && panel.getAttribute("data-discard-required") === "4"
        && panel.getAttribute("data-discard-total") === "0"
        && panel.getAttribute("data-pending-count") === "1"
        && ["requirement", "selection", "composition", "next"].every((key) => keys.includes(key));
    })()`, "catan discard planner metadata rendered");
    mockState.catanDiscardPhase = false;

    mockState.catanProgressDiscardPhase = true;
    await navigateToGame(ws, game);
    await setInputByAriaLabel(ws, "방 제목", `${gameNames[game]} 진행 카드 버리기 검증 방`);
    await clickButtonByText(ws, "방 만들기");
    await waitForText(ws, "방 코드");
    await waitForEnabledButton(ws, startButtonText);
    await clickButtonByText(ws, startButtonText);
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="catan-progress-discard-planner-panel"]'))`, "catan progress discard planner panel rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="catan-progress-discard-planner-art"]'))`, "catan progress discard planner SVG rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="catan-progress-discard-planner-node"]').length >= 4`, "catan progress discard planner SVG nodes rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="catan-progress-discard-planner-item"]').length >= 4`, "catan progress discard planner items rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="catan-progress-discard-planner-chip"]').length >= 5`, "catan progress discard planner chips rendered");
    await waitForExpression(ws, `/진행 카드 버리기 플래너|4장 한도 안으로 정리|보유 한도|버릴 카드/.test(document.querySelector('[data-smoke="catan-progress-discard-planner-panel"]')?.textContent || "")`, "catan progress discard planner Korean copy rendered");
    await waitForExpression(ws, `(() => {
      const panel = document.querySelector('[data-smoke="catan-progress-discard-planner-panel"]');
      const keys = Array.from(panel?.querySelectorAll('[data-smoke="catan-progress-discard-planner-item"]') || []).map((node) => node.getAttribute("data-progress-key"));
      return Boolean(panel)
        && panel.getAttribute("data-must-discard-progress") === "true"
        && panel.getAttribute("data-progress-discard-required") === "1"
        && panel.getAttribute("data-non-victory-count") === "5"
        && panel.getAttribute("data-selected-card-id") === "pc-1"
        && ["limit", "selection", "excluded", "next"].every((key) => keys.includes(key));
    })()`, "catan progress discard planner metadata rendered");
    mockState.catanProgressDiscardPhase = false;

    mockState.catanDomesticTradePending = true;
    await navigateToGame(ws, game);
    await setInputByAriaLabel(ws, "방 제목", `${gameNames[game]} 거래 응답 검증 방`);
    await clickButtonByText(ws, "방 만들기");
    await waitForText(ws, "방 코드");
    await waitForEnabledButton(ws, startButtonText);
    await clickButtonByText(ws, startButtonText);
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="catan-domestic-trade-review-panel"]'))`, "catan domestic trade review panel rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="catan-domestic-trade-review-art"]'))`, "catan domestic trade review SVG rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="catan-domestic-trade-review-node"]').length >= 4`, "catan domestic trade review SVG nodes rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="catan-domestic-trade-review-item"]').length >= 4`, "catan domestic trade review items rendered");
    await waitForExpression(ws, `/거래 제안 해석|무엇을 주고 무엇을 받는지|거래 주체|응답 선택/.test(document.querySelector('[data-smoke="catan-domestic-trade-review-panel"]')?.textContent || "")`, "catan domestic trade review Korean copy rendered");
    await waitForExpression(ws, `(() => {
      const panel = document.querySelector('[data-smoke="catan-domestic-trade-review-panel"]');
      const keys = Array.from(panel?.querySelectorAll('[data-smoke="catan-domestic-trade-review-item"]') || []).map((node) => node.getAttribute("data-trade-key"));
      return Boolean(panel)
        && panel.getAttribute("data-trade-role") === "target"
        && panel.getAttribute("data-offer-total") === "2"
        && panel.getAttribute("data-request-total") === "2"
        && ["route", "offer", "request", "decision"].every((key) => keys.includes(key));
    })()`, "catan domestic trade review metadata rendered");
    mockState.catanDomesticTradePending = false;

    mockState.catanWeddingGivePhase = true;
    await navigateToGame(ws, game);
    await setInputByAriaLabel(ws, "방 제목", `${gameNames[game]} 혼례 응답 검증 방`);
    await clickButtonByText(ws, "방 만들기");
    await waitForText(ws, "방 코드");
    await waitForEnabledButton(ws, startButtonText);
    await clickButtonByText(ws, startButtonText);
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="catan-wedding-response-panel"]'))`, "catan wedding response panel rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="catan-wedding-response-art"]'))`, "catan wedding response SVG rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="catan-wedding-response-node"]').length >= 4`, "catan wedding response SVG nodes rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="catan-wedding-response-item"]').length >= 4`, "catan wedding response items rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="catan-wedding-response-chip"]').length >= 4`, "catan wedding response chips rendered");
    await waitForExpression(ws, `/혼례 응답 플래너|정확히 몇 장을 줄지|필요 장수|선택한 카드/.test(document.querySelector('[data-smoke="catan-wedding-response-panel"]')?.textContent || "")`, "catan wedding response Korean copy rendered");
    await waitForExpression(ws, `(() => {
      const panel = document.querySelector('[data-smoke="catan-wedding-response-panel"]');
      const keys = Array.from(panel?.querySelectorAll('[data-smoke="catan-wedding-response-item"]') || []).map((node) => node.getAttribute("data-wedding-key"));
      return Boolean(panel)
        && panel.getAttribute("data-must-wedding") === "true"
        && panel.getAttribute("data-wedding-required") === "2"
        && panel.getAttribute("data-wedding-total") === "0"
        && panel.getAttribute("data-pending-count") === "1"
        && ["trigger", "requirement", "selection", "composition"].every((key) => keys.includes(key));
    })()`, "catan wedding response metadata rendered");
    mockState.catanWeddingGivePhase = false;
  }
  if (game === "blokus") {
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="blokus-bottom-summary"]'))`, "blokus compact bottom summary rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="blokus-bottom-summary-item"]').length >= 4`, "blokus compact bottom summary items rendered");
    await waitForExpression(ws, `/차례|선택 조각|배치 판정|남은 압박/.test(document.querySelector('[data-smoke="blokus-bottom-summary"]')?.textContent || "")`, "blokus compact bottom summary copy rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="blokus-piece-art"]').length >= 2`, "blokus piece SVG assets rendered");
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

    mockState.blokusEmptyPieces = true;
    await navigateToGame(ws, game);
    await setInputByAriaLabel(ws, "방 제목", `${gameNames[game]} 빈 조각 검증 방`);
    await clickButtonByText(ws, "방 만들기");
    await waitForText(ws, "방 코드");
    await waitForEnabledButton(ws, startButtonText);
    await clickButtonByText(ws, startButtonText);
    await waitForText(ws, "진행 중");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="blokus-remaining-empty-panel"]'))`, "blokus empty remaining-piece panel rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="blokus-remaining-empty-art"]'))`, "blokus empty remaining-piece SVG rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="blokus-remaining-empty-node"]').length >= 4`, "blokus empty remaining-piece nodes rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="blokus-remaining-empty-item"]').length >= 4`, "blokus empty remaining-piece guidance items rendered");
    await waitForExpression(ws, `/남은 조각 브리핑|남은 조각이 없습니다|패스로 턴 넘기기/.test(document.querySelector('[data-smoke="blokus-remaining-empty-panel"]')?.textContent || "")`, "blokus empty remaining-piece copy rendered");
    await waitForExpression(ws, `(() => { const panel = document.querySelector('[data-smoke="blokus-remaining-empty-panel"]'); const keys = Array.from(document.querySelectorAll('[data-smoke="blokus-remaining-empty-item"]')).map((node) => node.getAttribute("data-empty-key")); return Boolean(panel && panel.getAttribute("data-can-pass") === "true" && panel.getAttribute("data-completed") === "true" && ["empty", "turn", "pass", "score"].every((key) => keys.includes(key))); })()`, "blokus empty remaining-piece metadata rendered");
    mockState.blokusEmptyPieces = false;
  }
  if (game === "mahe") {
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="mahe-bottom-summary"]'))`, "mahe compact bottom summary rendered", 15000);
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="mahe-bottom-summary-item"]').length >= 4`, "mahe compact bottom summary items rendered");
    await waitForExpression(ws, `/마헤 흐름 요약|하단 참고|현재 보상|선두/.test(document.querySelector('[data-smoke="mahe-bottom-summary"]')?.textContent || "")`, "mahe compact bottom summary copy rendered");
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
    await waitForExpression(
      ws,
      `document.querySelectorAll('[data-smoke="mahe-turtle-art"]').length >= 2`,
      "mahe turtle SVG artwork rendered"
    );
  }
  if (game === "dalmuti") {
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="dalmuti-flow-meter"]'))`, "dalmuti flow meter rendered", 15000);
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="dalmuti-flow-meter"] [data-smoke="game-flow-meter-item"]').length >= 4`, "dalmuti flow meter items rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="dalmuti-card-art"]').length >= 2`, "dalmuti card SVG assets rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="dalmuti-play-advisor-panel"]'))`, "dalmuti play advisor panel rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="dalmuti-play-advisor-art"]'))`, "dalmuti play advisor SVG rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="dalmuti-play-advisor-item"]').length >= 4`, "dalmuti play advisor items rendered");
    await waitForExpression(ws, `/카드 제출 판단|제출 기준|선택 묶음/.test(document.querySelector('[data-smoke="dalmuti-play-advisor-panel"]')?.textContent || "")`, "dalmuti play advisor copy rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="dalmuti-rank-pressure-panel"]'))`, "dalmuti rank pressure panel rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="dalmuti-rank-pressure-art"]'))`, "dalmuti rank pressure SVG rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="dalmuti-rank-pressure-node"]').length >= 2`, "dalmuti rank pressure nodes rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="dalmuti-rank-pressure-item"]').length >= 4`, "dalmuti rank pressure items rendered");
    await waitForExpression(ws, `/손패 레이스|현재 선|패스 압력/.test(document.querySelector('[data-smoke="dalmuti-rank-pressure-panel"]')?.textContent || "")`, "dalmuti rank pressure copy rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="dalmuti-play-pile-empty-state"]'))`, "dalmuti current pile empty state rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="dalmuti-play-pile-empty-art"]'))`, "dalmuti current pile empty SVG rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="dalmuti-play-pile-empty-node"]').length >= 4`, "dalmuti current pile empty SVG nodes rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="dalmuti-play-pile-empty-item"]').length >= 4`, "dalmuti current pile empty guidance items rendered");
    await waitForExpression(ws, `/제출 더미 브리핑|아직 제출된 카드가 없습니다|패스 흐름/.test(document.querySelector('[data-smoke="dalmuti-play-pile-empty-state"]')?.textContent || "")`, "dalmuti current pile empty copy rendered");
    await waitForExpression(ws, `(() => { const panel = document.querySelector('[data-smoke="dalmuti-play-pile-empty-state"]'); const keys = Array.from(document.querySelectorAll('[data-smoke="dalmuti-play-pile-empty-item"]')).map((node) => node.getAttribute("data-pile-key")); return Boolean(panel && panel.getAttribute("data-phase") && panel.getAttribute("data-pass-progress") && ["pile", "rule", "actor", "pass"].every((key) => keys.includes(key))); })()`, "dalmuti current pile empty metadata rendered");
    mockState.dalmutiEmptyHand = true;
    await navigateToGame(ws, game);
    await setInputByAriaLabel(ws, "방 제목", `${gameNames[game]} 빈 손패 검증 방`);
    await clickButtonByText(ws, "방 만들기");
    await waitForText(ws, "방 코드");
    await waitForEnabledButton(ws, startButtonText);
    await clickButtonByText(ws, startButtonText);
    await waitForText(ws, "진행 중");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="dalmuti-empty-hand-panel"]'))`, "dalmuti empty-hand panel rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="dalmuti-empty-hand-art"]'))`, "dalmuti empty-hand SVG rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="dalmuti-empty-hand-node"]').length >= 4`, "dalmuti empty-hand nodes rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="dalmuti-empty-hand-item"]').length >= 4`, "dalmuti empty-hand guidance items rendered");
    await waitForExpression(ws, `/손패 완료 상태|이번 손 위치|관전 대기/.test(document.querySelector('[data-smoke="dalmuti-empty-hand-panel"]')?.textContent || "")`, "dalmuti empty-hand guidance copy rendered");
    await waitForExpression(ws, `document.querySelector('[data-smoke="dalmuti-empty-hand-panel"]')?.getAttribute("data-phase") === "PLAYING"`, "dalmuti empty-hand state marker rendered");
    mockState.dalmutiEmptyHand = false;
  }
  if (game === "six-nimmt") {
    await waitForText(ws, "내 손패");
    await waitForText(ws, "선택한 카드 제출");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="six-nimmt-flow-meter"]'))`, "six-nimmt flow meter rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="six-nimmt-flow-meter"] [data-smoke="game-flow-meter-item"]').length >= 4`, "six-nimmt flow meter items rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="six-nimmt-card-art"]').length >= 8`, "six-nimmt card SVG assets rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="six-nimmt-turn-pressure-panel"]'))`, "six-nimmt turn pressure panel rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="six-nimmt-turn-pressure-art"]'))`, "six-nimmt turn pressure SVG rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="six-nimmt-turn-pressure-node"]').length >= 2`, "six-nimmt turn pressure nodes rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="six-nimmt-turn-pressure-item"]').length >= 4`, "six-nimmt turn pressure items rendered");
    await waitForExpression(ws, `/선택 잠금|공개 순서|벌점 레이스/.test(document.querySelector('[data-smoke="six-nimmt-turn-pressure-panel"]')?.textContent || "")`, "six-nimmt turn pressure copy rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="six-nimmt-risk-panel"]'))`, "six-nimmt risk panel rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="six-nimmt-risk-item"]').length >= 4`, "six-nimmt risk items rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="six-nimmt-row-risk-art"]').length >= 4`, "six-nimmt row risk SVG assets rendered");
    await waitForExpression(ws, `/행 위험|벌점|압박/.test(document.querySelector('[data-smoke="six-nimmt-risk-panel"]')?.textContent || "")`, "six-nimmt risk guidance copy rendered");
  }
  if (game === "telestrations") {
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="telestrations-flow-meter"]'))`, "telestrations flow meter rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="telestrations-flow-meter"] [data-smoke="game-flow-meter-item"]').length >= 4`, "telestrations flow meter items rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="telestrations-chain-art"]'))`, "telestrations chain SVG asset rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="telestrations-input-guide-panel"]'))`, "telestrations input guide panel rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="telestrations-clue-lens-art"]'))`, "telestrations clue lens SVG rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="telestrations-input-guide-item"]').length >= 4`, "telestrations input guide items rendered");
    await waitForExpression(ws, `/입력 판단|보고 있는 단서|품질 목표/.test(document.querySelector('[data-smoke="telestrations-input-guide-panel"]')?.textContent || "")`, "telestrations input guidance copy rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="telestrations-action-route-panel"]'))`, "telestrations action-route panel rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="telestrations-action-route-art"]'))`, "telestrations action-route SVG rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="telestrations-action-route-node"]').length >= 4`, "telestrations action-route SVG nodes rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="telestrations-action-route-item"]').length >= 4`, "telestrations action-route items rendered");
    await waitForExpression(ws, `/텔레스트레이션 액션 루트|단서 확인|입력 준비|제출|다음 흐름/.test(document.querySelector('[data-smoke="telestrations-action-route-panel"]')?.textContent || "")`, "telestrations action-route Korean copy rendered");
    await waitForExpression(ws, `(() => { const panel = document.querySelector('[data-smoke="telestrations-action-route-panel"]'); const keys = Array.from(document.querySelectorAll('[data-smoke="telestrations-action-route-item"]')).map((node) => node.getAttribute("data-route-key")); return Boolean(panel && panel.getAttribute("data-phase") && panel.getAttribute("data-submitted") !== null && panel.getAttribute("data-awaiting-previous") !== null && panel.getAttribute("data-text-length") !== null && panel.getAttribute("data-has-ink") !== null && panel.getAttribute("data-progress") !== null && ["clue", "input", "submit", "next"].every((key) => keys.includes(key))); })()`, "telestrations action-route metadata rendered");
  }
  if (game === "poker") {
    await waitForText(ws, "내 족보");
    await waitForText(ws, "현재 비용");
    await waitForText(ws, "핸드");
    await waitForText(ws, "승리 사유");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="poker-result-explanation"]'))`, "poker result explanation rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('#poker-table-panel'))`, "poker table panel rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('#poker-action-panel'))`, "poker action panel rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('#poker-players-panel'))`, "poker chip/player status panel rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="poker-showdown-breakdown-panel"]'))`, "poker showdown breakdown panel rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="poker-showdown-trace-art"]'))`, "poker showdown trace SVG rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="poker-showdown-breakdown-item"]').length >= 2`, "poker showdown breakdown items rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="poker-showdown-trace-node"]').length >= 2`, "poker showdown trace nodes rendered");
    await waitForExpression(ws, `/쇼다운 해설|승리 근거|비교 카드/.test(document.querySelector('[data-smoke="poker-showdown-breakdown-panel"]')?.textContent || "")`, "poker showdown copy rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="poker-hidden-cards-brief"][data-hidden-state="folded"]'))`, "poker folded hidden-card guidance rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="poker-hidden-cards-brief-art"]'))`, "poker hidden-card SVG rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="poker-hidden-cards-brief-node"]').length >= 2`, "poker hidden-card SVG nodes rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="poker-hidden-cards-brief-item"]').length >= 2`, "poker hidden-card explanation items rendered");
    await waitForExpression(ws, `/카드 상태|폴드로 비공개|비교 제외/.test(document.querySelector('[data-smoke="poker-hidden-cards-brief"]')?.textContent || "")`, "poker hidden-card guidance copy rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="poker-card-art"]').length >= 7`, "poker reusable SVG cards rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="poker-community-standby-panel"][data-community-mode="five-card-draw"]'))`, "poker five-card draw community standby panel rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="poker-community-standby-art"]'))`, "poker community standby SVG rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="poker-community-standby-node"]').length >= 4`, "poker community standby SVG nodes rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="poker-community-standby-item"]').length >= 4`, "poker community standby explanation tiles rendered");
    await waitForExpression(ws, `/공용 카드 브리핑|공용 카드가 없습니다|최대 3장 교체/.test(document.querySelector('[data-smoke="poker-community-standby-panel"]')?.textContent || "")`, "poker community standby explains empty shared cards");
    await waitForExpression(ws, `(() => {
      const panel = document.querySelector('[data-smoke="poker-community-standby-panel"]');
      const keys = Array.from(panel?.querySelectorAll('[data-smoke="poker-community-standby-item"]') || []).map((node) => node.getAttribute("data-community-key"));
      return Boolean(panel)
        && panel.getAttribute("data-community-mode") === "five-card-draw"
        && ["board", "private", "draw", "result"].every((key) => keys.includes(key));
    })()`, "poker community standby metadata rendered");
    mockState.pokerFiveCardDraw = false;
  }
  if (game === "mafia") {
    await waitForText(ws, "내 역할");
    await waitForText(ws, "습격 대상 확정");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="mafia-stage"]'))`, "mafia stage rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="mafia-flow-meter"]'))`, "mafia flow meter rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="mafia-flow-meter"] [data-smoke="game-flow-meter-item"]').length >= 4`, "mafia flow meter items rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="mafia-target-intel-panel"]'))`, "mafia target intel panel rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="mafia-target-intel-art"]'))`, "mafia target intel SVG rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="mafia-target-intel-item"]').length >= 4`, "mafia target intel items rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="mafia-target-candidate"]').length >= 3`, "mafia target candidates rendered");
    await waitForExpression(ws, `/이번 목표|선택 대상|승리 압력/.test(document.querySelector('[data-smoke="mafia-target-intel-panel"]')?.textContent || "")`, "mafia target guidance copy rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="mafia-vote-pressure-panel"]'))`, "mafia vote pressure panel rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="mafia-vote-pressure-art"]'))`, "mafia vote pressure SVG rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="mafia-vote-pressure-node"]').length >= 5`, "mafia vote pressure player nodes rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="mafia-vote-pressure-item"]').length >= 4`, "mafia vote pressure items rendered");
    await waitForExpression(ws, `/추리 투표 압박|생존 균형|처형 위험/.test(document.querySelector('[data-smoke="mafia-vote-pressure-panel"]')?.textContent || "")`, "mafia vote pressure copy rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="mafia-role-sigil"]').length >= 2`, "mafia role SVG assets rendered");

    mockState.mafiaEmptyTargets = true;
    await navigateToGame(ws, game);
    await setInputByAriaLabel(ws, "방 제목", `${gameNames[game]} 빈 대상 검증 방`);
    await clickButtonByText(ws, "방 만들기");
    await waitForText(ws, "방 코드");
    await waitForEnabledButton(ws, startButtonText);
    await clickButtonByText(ws, startButtonText);
    await waitForText(ws, "진행 중");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="mafia-target-empty-brief"]'))`, "mafia empty-target brief rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="mafia-target-empty-art"]'))`, "mafia empty-target SVG rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="mafia-target-empty-node"]').length >= 3`, "mafia empty-target SVG nodes rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="mafia-target-empty-item"]').length >= 3`, "mafia empty-target guidance items rendered");
    await waitForExpression(ws, `/비어 있는 이유|행동 제출 완료|생존 균형/.test(document.querySelector('[data-smoke="mafia-target-empty-brief"]')?.textContent || "")`, "mafia empty-target guidance copy rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="mafia-target-candidate"]').length === 0`, "mafia empty-target state has no selectable candidates");
    mockState.mafiaEmptyTargets = false;

    mockState.mafiaFinishedResult = true;
    await navigateToGame(ws, game);
    await setInputByAriaLabel(ws, "방 제목", `${gameNames[game]} 결과 해설 검증 방`);
    await clickButtonByText(ws, "방 만들기");
    await waitForText(ws, "방 코드");
    await waitForEnabledButton(ws, startButtonText);
    await clickButtonByText(ws, startButtonText);
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="mafia-result-spotlight"]'))`, "mafia result spotlight rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="mafia-outcome-ledger-panel"]'))`, "mafia outcome ledger panel rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="mafia-outcome-ledger-art"]'))`, "mafia outcome ledger SVG rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="mafia-outcome-ledger-node"]').length >= 4`, "mafia outcome ledger SVG nodes rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="mafia-outcome-ledger-item"]').length >= 4`, "mafia outcome ledger items rendered");
    await waitForExpression(ws, `/마피아 결과 해설|누가 왜 이겼는지|승리 조건|생존 균형/.test(document.querySelector('[data-smoke="mafia-outcome-ledger-panel"]')?.textContent || "")`, "mafia outcome ledger Korean copy rendered");
    await waitForExpression(ws, `(() => {
      const panel = document.querySelector('[data-smoke="mafia-outcome-ledger-panel"]');
      const keys = Array.from(panel?.querySelectorAll('[data-smoke="mafia-outcome-ledger-item"]') || []).map((node) => node.getAttribute("data-outcome-key"));
      return Boolean(panel)
        && panel.getAttribute("data-winner-team") === "TOWN"
        && panel.getAttribute("data-alive-mafia") === "0"
        && panel.getAttribute("data-alive-town") === "4"
        && ["winner", "condition", "survival", "trace"].every((key) => keys.includes(key));
    })()`, "mafia outcome ledger metadata rendered");
    mockState.mafiaFinishedResult = false;
  }
  if (game === "citadels") {
    await waitForText(ws, "현재 흐름");
    await waitForText(ws, "행동 가능성");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="citadels-action-availability-panel"]'))`, "citadels action availability panel rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="citadels-action-availability-art"]'))`, "citadels action availability SVG rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="citadels-action-availability-node"]').length >= 4`, "citadels action availability SVG nodes rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="citadels-action-availability-item"]').length >= 4`, "citadels action availability items rendered");
    await waitForExpression(ws, `/기본 행동|턴 종료|기본 → 수입\\/능력 → 건설 → 종료/.test(document.querySelector('[data-smoke="citadels-action-availability-panel"]')?.textContent || "")`, "citadels action availability explains button state");
    await waitForExpression(ws, `(() => { const panel = document.querySelector('[data-smoke="citadels-action-availability-panel"]'); const keys = Array.from(document.querySelectorAll('[data-smoke="citadels-action-availability-node"]')).map((node) => node.getAttribute("data-availability-key")); return Boolean(panel && panel.getAttribute("data-phase") && panel.getAttribute("data-my-turn") !== null && panel.getAttribute("data-can-build") !== null && panel.getAttribute("data-gold") !== null && ["basic", "income", "build", "end"].every((key) => keys.includes(key))); })()`, "citadels action availability metadata rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="citadels-empty-hand-panel"]'))`, "citadels empty hand panel rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="citadels-empty-hand-art"]'))`, "citadels empty hand SVG rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="citadels-empty-hand-node"]').length >= 4`, "citadels empty hand SVG nodes rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="citadels-empty-hand-item"]').length >= 4`, "citadels empty hand guidance items rendered");
    await waitForExpression(ws, `/손패가 비었습니다|구역 보충|건설 후보 없음/.test(document.querySelector('[data-smoke="citadels-empty-hand-panel"]')?.textContent || "")`, "citadels empty hand panel explains why build is blocked");

    mockState.citadelsSelectionPhase = true;
    await navigateToGame(ws, game);
    await setInputByAriaLabel(ws, "방 제목", `${gameNames[game]} 선택 루트 검증 방`);
    await clickButtonByText(ws, "방 만들기");
    await waitForText(ws, "방 코드");
    await waitForEnabledButton(ws, startButtonText);
    await clickButtonByText(ws, startButtonText);
    await waitForText(ws, "진행 중");
    await waitForText(ws, "캐릭터 선택");
    await waitForText(ws, "공개로 제외된 캐릭터");
    mockState.citadelsSelectionPhase = false;

    mockState.citadelsBlockedBuild = true;
    await navigateToGame(ws, game);
    await setInputByAriaLabel(ws, "방 제목", `${gameNames[game]} 건설 막힘 검증 방`);
    await clickButtonByText(ws, "방 만들기");
    await waitForText(ws, "방 코드");
    await waitForEnabledButton(ws, startButtonText);
    await clickButtonByText(ws, startButtonText);
    await waitForText(ws, "진행 중");
    await waitForText(ws, "금화 0");
    await waitForText(ws, "건설 가능 0/2장");
    mockState.citadelsBlockedBuild = false;
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="citadels-district-card-art"]').length >= 4`, "citadels reusable SVG district cards rendered");
  }
  if (game === "citadels") {
    await clickButtonByText(ws, "강제 종료");
    await waitForEnabledButton(ws, "종료");
    await clickButtonByText(ws, "종료");
    await waitForText(ws, "종료");
    assertRequest(game, "forceFinish", null, "force-finish POST request");
  }
  if (game !== "citadels") {
    await clickButtonByText(ws, "강제 종료");
    await waitForEnabledButton(ws, "종료");
    await clickButtonByText(ws, "종료");
    await waitForText(ws, "종료");
    await waitForEnabledButton(ws, "다시 하기");
    assertRequest(game, "forceFinish", null, "force-finish POST request");
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
  mockState.roomFlowGame = null;
  return `${game} room flow: ok create/start/join-by-code/ready`;
}

async function assertSoloAiFirstActionAvailable(ws, game) {
  if (game === "poker") {
    await waitForExpression(ws, `(() => {
      const panel = document.querySelector("#poker-action-panel");
      const enabled = Array.from(panel?.querySelectorAll("button") || []).filter((button) => !button.disabled);
      return Boolean(panel) && enabled.length >= 3;
    })()`, "poker solo AI first betting actions enabled");
    return;
  }
  if (game === "catan") {
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="catan-action-atlas-panel"]'))`, "catan solo AI action atlas rendered");
    await waitForExpression(ws, `Array.from(document.querySelectorAll("button")).some((button) => !button.disabled && button.textContent.includes("주사위 굴리기"))`, "catan solo AI roll action enabled");
    return;
  }
  if (game === "six-nimmt") {
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="six-nimmt-action-route-panel"]'))`, "six-nimmt solo AI action route rendered");
    const clicked = await evaluate(ws, `(() => {
      const button = Array.from(document.querySelectorAll("button")).find((node) => !node.disabled && (node.getAttribute("aria-label") || "").includes("카드"));
      if (!button) return false;
      button.click();
      return true;
    })()`);
    if (!clicked) throw new Error("six-nimmt solo AI: selectable hand card not found");
    await waitForExpression(ws, `Boolean(document.querySelector("#six-nimmt-action-strip button:not(:disabled)"))`, "six-nimmt solo AI submit action enabled");
    return;
  }
  if (game === "mafia") {
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="mafia-target-candidate"]').length >= 3`, "mafia solo AI target candidates rendered");
    const clicked = await evaluate(ws, `(() => {
      const button = Array.from(document.querySelectorAll('[data-smoke="mafia-board"] button')).find((node) => !node.disabled && String(node.className || "").includes("min-h-16"));
      if (!button) return false;
      button.click();
      return true;
    })()`);
    if (!clicked) throw new Error("mafia solo AI: selectable target button not found");
    await waitForExpression(ws, `Array.from(document.querySelectorAll('[data-smoke="mafia-board"] button')).some((node) => !node.disabled && String(node.className || "").includes("bg-rose-600"))`, "mafia solo AI submit action enabled");
    return;
  }
  throw new Error(`Unsupported solo AI first-action smoke game: ${game}`);
}

async function runSoloAiRoomFlowSmoke(ws, game) {
  mockState.requests = mockState.requests.filter((request) => request.game !== game);
  mockState.roomFlowGame = game;
  mockState.soloAiFlowGame = game;
  mockState.activeRoomsByGame.delete(game);
  resetRoomFlowMockFlags();
  mockState.pokerActionTurn = game === "poker";

  try {
    await navigateToGame(ws, game);
    const title = `${gameNames[game]} solo AI smoke room`;
    await setInputByAriaLabel(ws, "방 제목", title);
    await clickButtonByText(ws, "방 만들기");
    await waitForText(ws, "방 코드");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="${game}-waiting-player-roster-item"]').length === 1`, `${game} solo AI waiting roster contains only host`);
    await waitForEnabledButton(ws, "AI와 시작");
    assertRequest(game, "create", (request) => request.body?.title === title, "solo AI create-room POST payload");

    await clickButtonByText(ws, "AI와 시작");
    await waitForText(ws, "진행 중");
    await assertSoloAiFirstActionAvailable(ws, game);
    assertRequest(game, "start", null, "solo AI start POST request");
    return `${game} solo AI flow: ok create/ai-start/first-action`;
  } finally {
    mockState.roomFlowGame = null;
    mockState.soloAiFlowGame = null;
    mockState.pokerActionTurn = false;
  }
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
    (request) => request.body?.title === title && (request.body?.variant_code || request.body?.variantCode) === variantCode,
    `create-room POST payload for ${variantCode}`
  );
  return `${game} ${variantCode} variant create: ok`;
}

async function inspectPage(ws, testCase, viewport) {
  mockState.telestrationsPhase = testCase.telestrationsPhase || "PROMPT";
  mockState.telestrationsEmptyReveal = Boolean(testCase.telestrationsEmptyReveal);
  mockState.emptyLobbyGame = testCase.emptyLobbyGame || "";
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
        tabletopLobbyBrief: {
          mounted: Boolean(document.querySelector('[data-smoke="tabletop-lobby-brief-panel"]')),
          tiles: document.querySelectorAll('[data-smoke="tabletop-lobby-brief-tile"]').length,
          text: document.querySelector('[data-smoke="tabletop-lobby-brief-panel"]')?.innerText || "",
        },
        tabletopSetupPreview: {
          mounted: Boolean(document.querySelector('[data-smoke="tabletop-setup-preview-panel"]')),
          art: document.querySelectorAll('[data-smoke="tabletop-setup-preview-art"]').length,
          nodes: document.querySelectorAll('[data-smoke="tabletop-setup-preview-node"]').length,
          items: document.querySelectorAll('[data-smoke="tabletop-setup-preview-item"]').length,
          variantCode: document.querySelector('[data-smoke="tabletop-setup-preview-panel"]')?.getAttribute("data-variant-code") || "",
          turnSeconds: Number(document.querySelector('[data-smoke="tabletop-setup-preview-panel"]')?.getAttribute("data-turn-seconds") || 0),
          text: document.querySelector('[data-smoke="tabletop-setup-preview-panel"]')?.innerText || "",
        },
        tabletopLobbyDirector: {
          mounted: Boolean(document.querySelector('[data-smoke="tabletop-lobby-director-panel"]')),
          art: document.querySelectorAll('[data-smoke="tabletop-lobby-director-art"]').length,
          nodes: document.querySelectorAll('[data-smoke="tabletop-lobby-director-node"]').length,
          items: document.querySelectorAll('[data-smoke="tabletop-lobby-director-item"]').length,
          choices: document.querySelectorAll('[data-smoke="tabletop-lobby-director-choice"]').length,
          empty: document.querySelectorAll('[data-smoke="tabletop-lobby-director-empty-choice"]').length,
          emptyArt: document.querySelectorAll('[data-smoke="tabletop-lobby-director-empty-art"]').length,
          emptyNodes: document.querySelectorAll('[data-smoke="tabletop-lobby-director-empty-node"]').length,
          emptyItems: document.querySelectorAll('[data-smoke="tabletop-lobby-director-empty-item"]').length,
          primary: document.querySelectorAll('[data-smoke="tabletop-lobby-director-primary"]').length,
          text: document.querySelector('[data-smoke="tabletop-lobby-director-panel"]')?.innerText || "",
        },
        tabletopJoinCode: {
          mounted: Boolean(document.querySelector('[data-smoke="tabletop-join-code-panel"]')),
          art: document.querySelectorAll('[data-smoke="tabletop-join-code-art"]').length,
          nodes: document.querySelectorAll('[data-smoke="tabletop-join-code-node"]').length,
          input: document.querySelectorAll('[data-smoke="tabletop-join-code-input"]').length,
          submit: document.querySelectorAll('[data-smoke="tabletop-join-code-submit"]').length,
          status: document.querySelectorAll('[data-smoke="tabletop-join-code-status"]').length,
          placeholder: document.querySelector('[data-smoke="tabletop-join-code-input"]')?.getAttribute("placeholder") || "",
          text: document.querySelector('[data-smoke="tabletop-join-code-panel"]')?.innerText || "",
        },
        tabletopRouteArtwork: {
          mounted: Boolean(document.querySelector('[data-smoke="tabletop-route-artwork"]')),
          artwork: document.querySelectorAll('[data-smoke="tabletop-route-artwork"] [data-smoke="tabletop-game-artwork"]').length,
        },
        citadelsRouteArtwork: {
          mounted: Boolean(document.querySelector('[data-smoke="citadels-route-artwork"]')),
          artwork: document.querySelectorAll('[data-smoke="citadels-route-artwork"] [data-smoke="tabletop-game-artwork"]').length,
        },
        citadelsJoinCode: {
          mounted: Boolean(document.querySelector('[data-smoke="citadels-join-code-panel"]')),
          art: document.querySelectorAll('[data-smoke="citadels-join-code-art"]').length,
          nodes: document.querySelectorAll('[data-smoke="citadels-join-code-node"]').length,
          input: document.querySelectorAll('[data-smoke="citadels-join-code-input"]').length,
          submit: document.querySelectorAll('[data-smoke="citadels-join-code-submit"]').length,
          status: document.querySelectorAll('[data-smoke="citadels-join-code-status"]').length,
          placeholder: document.querySelector('[data-smoke="citadels-join-code-input"]')?.getAttribute("placeholder") || "",
          text: document.querySelector('[data-smoke="citadels-join-code-panel"]')?.innerText || "",
        },
        citadelsLobbyDirector: {
          mounted: Boolean(document.querySelector('[data-smoke="citadels-lobby-director-panel"]')),
          art: document.querySelectorAll('[data-smoke="citadels-lobby-director-art"]').length,
          nodes: document.querySelectorAll('[data-smoke="citadels-lobby-director-node"]').length,
          items: document.querySelectorAll('[data-smoke="citadels-lobby-director-item"]').length,
          choices: document.querySelectorAll('[data-smoke="citadels-lobby-director-choice"]').length,
          empty: document.querySelectorAll('[data-smoke="citadels-lobby-director-empty-choice"]').length,
          emptyArt: document.querySelectorAll('[data-smoke="citadels-lobby-director-empty-art"]').length,
          emptyNodes: document.querySelectorAll('[data-smoke="citadels-lobby-director-empty-node"]').length,
          emptyItems: document.querySelectorAll('[data-smoke="citadels-lobby-director-empty-item"]').length,
          primary: document.querySelectorAll('[data-smoke="citadels-lobby-director-primary"]').length,
          text: document.querySelector('[data-smoke="citadels-lobby-director-panel"]')?.innerText || "",
        },
        citadelsRoomSetup: {
          mounted: Boolean(document.querySelector('[data-smoke="citadels-room-setup-panel"]')),
          items: document.querySelectorAll('[data-smoke="citadels-room-setup-panel"] [data-smoke="citadels-room-setup-item"]').length,
          text: document.querySelector('[data-smoke="citadels-room-setup-panel"]')?.innerText || "",
        },
        citadelsSetupPreview: {
          mounted: Boolean(document.querySelector('[data-smoke="citadels-setup-preview-panel"]')),
          art: document.querySelectorAll('[data-smoke="citadels-setup-preview-art"]').length,
          nodes: document.querySelectorAll('[data-smoke="citadels-setup-preview-node"]').length,
          items: document.querySelectorAll('[data-smoke="citadels-setup-preview-item"]').length,
          variantCode: document.querySelector('[data-smoke="citadels-setup-preview-panel"]')?.getAttribute("data-variant-code") || "",
          turnSeconds: Number(document.querySelector('[data-smoke="citadels-setup-preview-panel"]')?.getAttribute("data-turn-time") || 0),
          text: document.querySelector('[data-smoke="citadels-setup-preview-panel"]')?.innerText || "",
        },
        citadelsLobbyEmpty: {
          states: document.querySelectorAll('[data-smoke="citadels-lobby-empty-state"]').length,
          art: document.querySelectorAll('[data-smoke="citadels-lobby-empty-art"]').length,
          nodes: document.querySelectorAll('[data-smoke="citadels-lobby-empty-node"]').length,
          items: document.querySelectorAll('[data-smoke="citadels-lobby-empty-item"]').length,
          refresh: document.querySelectorAll('[data-smoke="citadels-lobby-empty-refresh"]').length,
          busy: Array.from(document.querySelectorAll('[data-smoke="citadels-lobby-empty-state"]')).map((node) => node.getAttribute("data-busy")),
          text: Array.from(document.querySelectorAll('[data-smoke="citadels-lobby-empty-state"]')).map((node) => node.innerText).join("\\n"),
        },
        tabletopLobbyRooms: {
          cards: document.querySelectorAll('[data-smoke="tabletop-lobby-room-card"]').length,
          art: document.querySelectorAll('[data-smoke="tabletop-lobby-room-card-art"]').length,
          nodes: document.querySelectorAll('[data-smoke="tabletop-lobby-room-card-node"]').length,
          cardSeats: document.querySelectorAll('[data-smoke="tabletop-lobby-room-card-seat"]').length,
          stateCards: Array.from(document.querySelectorAll('[data-smoke="tabletop-lobby-room-card"]')).filter((node) => node.getAttribute("data-room-status") !== null && node.getAttribute("data-joinable") !== null).length,
          decisionRails: document.querySelectorAll('[data-smoke="tabletop-lobby-room-decision-rail"]').length,
          decisionItems: document.querySelectorAll('[data-smoke="tabletop-lobby-room-decision-item"]').length,
          decisionKeys: Array.from(document.querySelectorAll('[data-smoke="tabletop-lobby-room-decision-item"]')).map((node) => node.getAttribute("data-decision-key")),
          readiness: document.querySelectorAll('[data-smoke="tabletop-lobby-room-readiness"]').length,
          actions: document.querySelectorAll('[data-smoke="tabletop-lobby-room-action-signal"]').length,
          slots: document.querySelectorAll('[data-smoke="tabletop-lobby-room-slot"]').length,
          primary: document.querySelectorAll('[data-smoke="tabletop-lobby-room-primary"]').length,
          text: Array.from(document.querySelectorAll('[data-smoke="tabletop-lobby-room-card"]')).map((node) => node.innerText).join("\\n"),
        },
        tabletopLobbyEmpty: {
          states: document.querySelectorAll('[data-smoke="tabletop-lobby-empty-state"]').length,
          art: document.querySelectorAll('[data-smoke="tabletop-lobby-empty-art"]').length,
          nodes: document.querySelectorAll('[data-smoke="tabletop-lobby-empty-node"]').length,
          items: document.querySelectorAll('[data-smoke="tabletop-lobby-empty-item"]').length,
          loading: Array.from(document.querySelectorAll('[data-smoke="tabletop-lobby-empty-state"]')).map((node) => node.getAttribute("data-loading")),
          text: Array.from(document.querySelectorAll('[data-smoke="tabletop-lobby-empty-state"]')).map((node) => node.innerText).join("\\n"),
        },
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
  const tabletopLobbyLabels = new Set(["catan lobby", "blokus lobby", "mahe lobby", "dalmuti lobby", "six nimmt lobby", "mafia lobby", "poker lobby"]);
  const tabletopLobbyRoomCardLabels = new Set([...tabletopLobbyLabels, "citadels lobby"]);
  if (tabletopLobbyLabels.has(testCase.label) && (
    !value.tabletopJoinCode.mounted
    || value.tabletopJoinCode.input < 1
    || value.tabletopJoinCode.submit < 1
    || value.tabletopJoinCode.placeholder !== "방코드"
  )) {
    throw new Error(`${testCase.label} ${viewport.name}: tabletop join-code bridge missing ${JSON.stringify(value.tabletopJoinCode)}`);
  }
  if (tabletopLobbyLabels.has(testCase.label) && (!value.tabletopRouteArtwork.mounted || value.tabletopRouteArtwork.artwork < 1)) {
    throw new Error(`${testCase.label} ${viewport.name}: tabletop route artwork missing ${JSON.stringify(value.tabletopRouteArtwork)}`);
  }
  if (testCase.assertTabletopEmptyLobby) {
    const empty = value.tabletopLobbyEmpty;
    if (
      empty.states < 1
      || empty.art < 1
      || empty.nodes < 3
      || empty.items < 3
      || !empty.loading.includes("false")
      || value.tabletopLobbyRooms.cards !== 0
      || !empty.text.includes("대기방 없음")
      || !empty.text.includes("새 방 만들기")
      || !empty.text.includes("방코드 입장")
      || !empty.text.includes("새로고침")
    ) {
      throw new Error(`${testCase.label} ${viewport.name}: tabletop empty lobby missing ${JSON.stringify({ empty, rooms: value.tabletopLobbyRooms })}`);
    }
  }
  if (testCase.assertCitadelsEmptyLobby) {
    const empty = value.citadelsLobbyEmpty;
    if (
      empty.states < 1
      || empty.art < 1
      || empty.nodes < 6
      || empty.items < 3
      || empty.refresh < 1
      || !empty.busy.includes("false")
      || value.tabletopLobbyRooms.cards !== 0
      || !empty.text.includes("대기방 없음")
      || !empty.text.includes("새 방 만들기")
      || !empty.text.includes("방코드 입장")
      || !empty.text.includes("목록 새로고침")
    ) {
      throw new Error(`${testCase.label} ${viewport.name}: citadels empty lobby missing ${JSON.stringify({ empty, rooms: value.tabletopLobbyRooms })}`);
    }
  }
  if (testCase.label === "citadels lobby" && (
    !value.citadelsJoinCode.mounted
    || value.citadelsJoinCode.input < 1
    || value.citadelsJoinCode.submit < 1
    || value.citadelsJoinCode.placeholder !== "방코드"
  )) {
    throw new Error(`${testCase.label} ${viewport.name}: citadels join-code bridge missing ${JSON.stringify(value.citadelsJoinCode)}`);
  }
  if (tabletopLobbyRoomCardLabels.has(testCase.label)) {
    const roomTelemetry = value.tabletopLobbyRooms;
    const requiresTabletopSignals = tabletopLobbyLabels.has(testCase.label);
    if (
      roomTelemetry.cards < 1
      || roomTelemetry.stateCards < roomTelemetry.cards
      || (requiresTabletopSignals && roomTelemetry.readiness < 1)
      || (requiresTabletopSignals && roomTelemetry.actions < 1)
      || (requiresTabletopSignals && roomTelemetry.slots < 1)
      || roomTelemetry.primary < 1
      || !/합류 추천|입장 가능|방장 시작 가능|정원 마감/.test(roomTelemetry.text)
    ) {
      throw new Error(`${testCase.label} ${viewport.name}: tabletop lobby room card telemetry missing ${JSON.stringify(roomTelemetry)}`);
    }
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
  if (testCase.assertTelestrationsDraw) {
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="telestrations-drawing-tool-panel"]'))`, "telestrations drawing tool panel rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="telestrations-drawing-tool-art"]'))`, "telestrations drawing tool SVG rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="telestrations-drawing-tool-node"]').length >= 4`, "telestrations drawing tool swatches rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="telestrations-drawing-tool-item"]').length >= 4`, "telestrations drawing tool items rendered");
    await waitForExpression(ws, `/그림 도구 상태|브러시 굵기|캔버스 잉크|제출 전 캔버스 점검/.test(document.querySelector('[data-smoke="telestrations-drawing-tool-panel"]')?.textContent || "")`, "telestrations drawing tool copy rendered");
    await waitForExpression(ws, `(() => { const panel = document.querySelector('[data-smoke="telestrations-drawing-tool-panel"]'); const keys = Array.from(document.querySelectorAll('[data-smoke="telestrations-drawing-tool-item"]')).map((node) => node.getAttribute("data-tool-key")); return Boolean(panel && panel.getAttribute("data-brush-size") === "5" && panel.getAttribute("data-has-ink") === "false" && panel.getAttribute("data-submitted") === "false" && ["brush", "color", "ink", "submit"].every((key) => keys.includes(key))); })()`, "telestrations drawing tool metadata rendered");
  }
  if (testCase.assertTelestrationsReveal) {
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="telestrations-reveal-insight-panel"]'))`, "telestrations reveal insight panel rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="telestrations-reveal-arc-art"]'))`, "telestrations reveal SVG rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="telestrations-reveal-insight-item"]').length >= 4`, "telestrations reveal insight items rendered");
    await waitForExpression(ws, `/공개 해석|문구 변화|현재 보고 있는 항목/.test(document.querySelector('[data-smoke="telestrations-reveal-insight-panel"]')?.textContent || "")`, "telestrations reveal interpretation copy rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="telestrations-reveal-current"]'))`, "telestrations current reveal item rendered");
  }
  if (testCase.assertTelestrationsRevealEmpty) {
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="telestrations-entry-empty-state"][data-entry-phase="REVEAL"]'))`, "telestrations empty reveal entry panel rendered");
    await waitForExpression(ws, `Boolean(document.querySelector('[data-smoke="telestrations-entry-empty-art"]'))`, "telestrations empty reveal SVG rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="telestrations-entry-empty-node"]').length >= 4`, "telestrations empty reveal nodes rendered");
    await waitForExpression(ws, `document.querySelectorAll('[data-smoke="telestrations-entry-empty-item"]').length >= 4`, "telestrations empty reveal guidance items rendered");
    await waitForExpression(ws, `/공개 내용 대기|아직 공개된 내용이 없습니다|공개 리플레이/.test(document.querySelector('[data-smoke="telestrations-entry-empty-state"]')?.textContent || "")`, "telestrations empty reveal guidance copy rendered");
    await waitForExpression(ws, `(() => { const panel = document.querySelector('[data-smoke="telestrations-entry-empty-state"]'); const keys = Array.from(document.querySelectorAll('[data-smoke="telestrations-entry-empty-item"]')).map((node) => node.getAttribute("data-entry-key")); return Boolean(panel && panel.getAttribute("data-step-label") && ["book", "step", "submit", "replay"].every((key) => keys.includes(key))); })()`, "telestrations empty reveal metadata rendered");
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
  assertCitadelsLobbyEmptySource();
  assertActionToastSingleton();
  assertSixNimmtActionSource();
  assertCitadelsExperienceSource();
  assertSixNimmtRealtimeSimulation();
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
    const flowGames = ["catan", "blokus", "mahe", "dalmuti", "six-nimmt", "telestrations", "poker", "mafia", "citadels"];
    for (const game of flowGames) {
      flowResults.push(await runRoomFlowSmoke(cdp, game));
    }
    const soloAiResults = [];
    const soloAiFlowGames = ["poker", "catan", "six-nimmt", "mafia"];
    for (const game of soloAiFlowGames) {
      soloAiResults.push(await runSoloAiRoomFlowSmoke(cdp, game));
    }
    const variantResults = [];
    for (const item of variantCreateCases) {
      variantResults.push(await runVariantCreateSmoke(cdp, item));
    }
    const expectedPageChecks = cases.length * viewports.length;
    if (results.length !== expectedPageChecks || flowResults.length !== flowGames.length || soloAiResults.length !== soloAiFlowGames.length || variantResults.length !== variantCreateCases.length) {
      throw new Error(`Incomplete tabletop smoke coverage: pages ${results.length}/${expectedPageChecks}, flows ${flowResults.length}/${flowGames.length}, solo AI ${soloAiResults.length}/${soloAiFlowGames.length}, variants ${variantResults.length}/${variantCreateCases.length}`);
    }
    if (runtimeErrors.length) {
      throw new Error(`Runtime errors: ${runtimeErrors.join(" | ")}`);
    }
    results.forEach((result) => {
      console.log(`${result.case} ${result.viewport}: ok ${result.width}/${result.scrollWidth} ${result.url}`);
    });
    flowResults.forEach((result) => console.log(result));
    soloAiResults.forEach((result) => console.log(result));
    variantResults.forEach((result) => console.log(result));
    console.log(`tabletop-ui-smoke ok (${results.length} responsive page checks, ${flowResults.length} room flows, ${soloAiResults.length} solo AI flows, ${variantResults.length} variant create checks)`);
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
