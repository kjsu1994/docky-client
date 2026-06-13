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
const userDataDir = mkdtempSync(path.join(tmpdir(), "home-ui-smoke-"));
const viewports = [
    { name: "desktop", width: 1366, height: 900, mobile: false },
    { name: "mobile", width: 390, height: 844, mobile: true },
];
const requiredTexts = [
    "오늘 방문자",
    "주요 서비스",
    "투자 분석",
    "최신 게시글",
    "홈 화면 광고 배너",
    "광고 개인화 설정",
    "광고 개인화 설정을 선택하면 이 영역이 활성화됩니다.",
    "테스트 게시글",
    "1분 미만 전",
    "개인정보처리방침",
    "상세 내용 보기",
    "사업자 정보",
    "Docky",
    "김진수",
    "kjsu1701@naver.com",
    "전화번호",
    "호스팅서비스 제공자",
    "구매안전서비스",
];
const blockedTexts = ["Sponsored", "Notice", "Learn more", "Invest", "FREE_BOARD", "ADMIN_NOTICE"];

let nextMessageId = 1;
const pending = new Map();
let bannerEventRequests = 0;
let bannerClickRequests = 0;
let bannerImpressionRequests = 0;
let bannerClickAuthorizationHeaders = [];
let bannerImageRequests = 0;
let statsDashboardRequests = 0;
let statsSummaryRequests = 0;
let statsVisitorsCompareRequests = 0;
let latestBoardsRequests = 0;
let bannerListRequests = 0;
let chatRoomRequests = 0;
let chatSocketInfoRequests = 0;
let floatingChatChunkRequests = 0;
let pageGuideChunkRequests = 0;
let gamesHubChunkRequests = 0;
let headerMenuChunkRequests = 0;
let bottomNavChunkRequests = 0;
let customCursorChunkRequests = 0;
let gamesHubPrefetchVerified = false;
let pageGuideLazyLoadVerified = false;
let forceStatsFailure = false;
let forceBoardsFailure = false;
let forceBannerFailure = false;
let slowStatsDashboard = false;
const observedRequests = [];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function assertStaticFocusTrapUtility() {
    const source = readFileSync("src/utils/focusTrap.js", "utf8");
    const requiredSnippets = [
        "export const getFocusableElements",
        "export const trapFocus",
        "Array.isArray(target)",
        "event.key !== \"Tab\"",
        "event.preventDefault()",
    ];
    const missing = requiredSnippets.filter((snippet) => !source.includes(snippet));
    if (missing.length) {
        throw new Error(`home-ui-smoke: shared focusTrap utility guard missing ${missing.join(", ")}`);
    }
}

function assertStaticPageGuideAccessibility() {
    const appSource = readFileSync("src/App.jsx", "utf8");
    const layoutSource = readFileSync("src/components/ProtectedAppLayout.jsx", "utf8");
    const entrySource = readFileSync("src/common/PageGuideButtonEntry.jsx", "utf8");
    const buttonSource = readFileSync("src/common/PageGuideButton.jsx", "utf8");
    const dialogSource = readFileSync("src/common/PageGuideDialog.jsx", "utf8");
    if (
        appSource.includes("PageGuideButtonEntry") ||
        appSource.includes("PageGuideButton.jsx") ||
        !layoutSource.includes("import { PageGuideButtonEntry } from \"../common/PageGuideButtonEntry.jsx\"") ||
        !layoutSource.includes("<PageGuideButtonEntry />")
    ) {
        throw new Error("home-ui-smoke: page guide launcher must stay out of the public app shell and mount from the protected layout.");
    }
    if (
        !entrySource.includes("const PageGuideButton = lazy(() =>") ||
        !entrySource.includes("import(\"./PageGuideButton.jsx\")") ||
        !entrySource.includes("requestIdleCallback")
    ) {
        throw new Error("home-ui-smoke: page guide button must stay idle lazy-loaded from the protected layout.");
    }
    if (!buttonSource.includes("const PageGuideDialog = lazy(() =>")) {
        throw new Error("home-ui-smoke: page guide dialog must stay lazy-loaded from the app shell.");
    }
    if (!dialogSource.includes("import { trapFocus } from \"../utils/focusTrap.js\"")) {
        throw new Error("home-ui-smoke: page guide dialog must use the shared focusTrap utility.");
    }
    if (!buttonSource.includes("aria-haspopup=\"dialog\"") || !buttonSource.includes("aria-controls={open ? dialogId : undefined}") || !buttonSource.includes("aria-expanded={open}")) {
        throw new Error("home-ui-smoke: page guide trigger must expose dialog relationship state.");
    }
    if (!dialogSource.includes("aria-labelledby={titleId}") || !dialogSource.includes("aria-describedby={descriptionId}")) {
        throw new Error("home-ui-smoke: page guide dialog must connect title and description.");
    }
    if (!dialogSource.includes("closeButtonRef.current?.focus()") || !dialogSource.includes("previousFocus.focus()")) {
        throw new Error("home-ui-smoke: page guide dialog must move focus in and restore it on close.");
    }
    if (!dialogSource.includes("trapFocus(event, dialogRef.current)")) {
        throw new Error("home-ui-smoke: page guide dialog must trap Tab focus while open.");
    }
    if (!dialogSource.includes("guide?.summary || \"페이지 설명을 불러오는 중입니다.\"")) {
        throw new Error("home-ui-smoke: page guide dialog must keep an accessible fallback description while loading.");
    }
}

function assertStaticNetworkIndicatorRuntimeBoundary() {
    const appSource = readFileSync("src/App.jsx", "utf8");
    const entrySource = readFileSync("src/components/GlobalNetworkIndicatorEntry.jsx", "utf8");
    const indicatorSource = readFileSync("src/components/GlobalNetworkIndicator.jsx", "utf8");
    if (appSource.includes("GlobalNetworkIndicator.jsx") || !appSource.includes("GlobalNetworkIndicatorEntry")) {
        throw new Error("home-ui-smoke: app shell must mount GlobalNetworkIndicatorEntry instead of statically importing the indicator UI.");
    }
    const requiredEntrySnippets = [
        "const GlobalNetworkIndicator = lazy(() =>",
        "import(\"./GlobalNetworkIndicator.jsx\")",
        "subscribeNetworkActivity",
        "activeRequests > 0",
    ];
    const missing = requiredEntrySnippets.filter((snippet) => !entrySource.includes(snippet));
    if (missing.length) {
        throw new Error(`home-ui-smoke: network indicator entry must lazy-load on tracked requests ${missing.join(", ")}`);
    }
    if (!indicatorSource.includes("aria-label=\"요청 처리 중\"") || !indicatorSource.includes("network-indicator__bar")) {
        throw new Error("home-ui-smoke: network indicator UI must keep the accessible request-progress affordance.");
    }
}

function assertStaticLoadingSpinnerBoundary() {
    const source = readFileSync("src/components/LoadingSpinner.jsx", "utf8");
    if (source.includes("lucide-react") || source.includes("Loader2")) {
        throw new Error("home-ui-smoke: LoadingSpinner must stay CSS-only so the app fallback does not pull icon runtime into the initial shell.");
    }
    const requiredSnippets = [
        "role={text ? \"status\" : undefined}",
        "aria-live={text ? \"polite\" : undefined}",
        "aria-hidden=\"true\"",
        "border-t-primary-600",
    ];
    const missing = requiredSnippets.filter((snippet) => !source.includes(snippet));
    if (missing.length) {
        throw new Error(`home-ui-smoke: LoadingSpinner must keep accessible CSS loading state ${missing.join(", ")}`);
    }
}

function assertStaticHeaderMenuAccessibility() {
    const headerSource = readFileSync("src/components/Header.jsx", "utf8");
    const dialogSource = readFileSync("src/components/HeaderMenuDialog.jsx", "utf8");
    const headerRequiredSnippets = [
        "const HeaderMenuDialog = lazy(() =>",
        "<Suspense fallback={null}>",
        "aria-haspopup=\"dialog\"",
        "aria-controls={menuOpen ? menuPanelId : undefined}",
        "aria-expanded={menuOpen}",
        "launcherRef={menuButtonRef}",
    ];
    const dialogRequiredSnippets = [
        "import { trapFocus } from \"../utils/focusTrap.js\"",
        "role=\"dialog\"",
        "aria-modal=\"true\"",
        "aria-labelledby={titleId}",
        "aria-describedby={descriptionId}",
        "closeButtonRef.current?.focus()",
        "previousFocus.focus()",
        "launcherRef.current?.focus()",
        "document.body.style.overflow = \"hidden\"",
        "event.key === \"Escape\"",
        "trapFocus(event, panelRef.current)",
    ];
    const missing = [
        ...headerRequiredSnippets.filter((snippet) => !headerSource.includes(snippet)),
        ...dialogRequiredSnippets.filter((snippet) => !dialogSource.includes(snippet)),
    ];
    if (missing.length) {
        throw new Error(`home-ui-smoke: header menu accessibility guard missing ${missing.join(", ")}`);
    }
}

function assertStaticBottomNavRuntimeBoundary() {
    const appSource = readFileSync("src/App.jsx", "utf8");
    const protectedRoutesSource = readFileSync("src/components/ProtectedRoutes.jsx", "utf8");
    const layoutSource = readFileSync("src/components/ProtectedAppLayout.jsx", "utf8");
    const entrySource = readFileSync("src/components/BottomNavEntry.jsx", "utf8");
    const requiredSnippets = [
        "const ProtectedRoutes = lazy(() =>",
        "import(\"./components/ProtectedRoutes.jsx\")",
        "const ProtectedAppLayout = lazy(() =>",
        "import(\"./ProtectedAppLayout.jsx\")",
        "import { BottomNavEntry } from \"./BottomNavEntry.jsx\"",
        "<BottomNavEntry />",
        "const BottomNav = lazy(() => import(\"./BottomNav.jsx\")",
        "window.matchMedia(\"(max-width: 1023px)\")",
    ];
    const sources = [appSource, protectedRoutesSource, layoutSource, entrySource];
    const missing = requiredSnippets.filter((snippet) => !sources.some((source) => source.includes(snippet)));
    if (
        missing.length ||
        appSource.includes("ProtectedAppLayout") ||
        appSource.includes("BottomNavEntry") ||
        appSource.includes("import { BottomNav } from \"./components/BottomNav.jsx\"")
    ) {
        throw new Error(`home-ui-smoke: bottom nav runtime boundary missing ${missing.join(", ")}`);
    }
}

function assertStaticCustomCursorRuntimeBoundary() {
    const appSource = readFileSync("src/App.jsx", "utf8");
    const protectedRoutesSource = readFileSync("src/components/ProtectedRoutes.jsx", "utf8");
    const layoutSource = readFileSync("src/components/ProtectedAppLayout.jsx", "utf8");
    const entrySource = readFileSync("src/components/CustomCursorEntry.jsx", "utf8");
    const requiredSnippets = [
        "const ProtectedRoutes = lazy(() =>",
        "import(\"./components/ProtectedRoutes.jsx\")",
        "const ProtectedAppLayout = lazy(() =>",
        "import(\"./ProtectedAppLayout.jsx\")",
        "import { CustomCursorEntry } from \"./CustomCursorEntry.jsx\"",
        "<CustomCursorEntry />",
        "const CustomCursor = lazy(() => import(\"./CustomCursor.jsx\")",
        "window.addEventListener(\"pointermove\", activate, { passive: true, once: true })",
        "window.matchMedia(\"(prefers-reduced-motion: reduce)\")",
    ];
    const sources = [appSource, protectedRoutesSource, layoutSource, entrySource];
    const missing = requiredSnippets.filter((snippet) => !sources.some((source) => source.includes(snippet)));
    if (
        missing.length ||
        appSource.includes("ProtectedAppLayout") ||
        appSource.includes("CustomCursorEntry") ||
        appSource.includes("import { CustomCursor } from \"./components/CustomCursor.jsx\"")
    ) {
        throw new Error(`home-ui-smoke: custom cursor runtime boundary missing ${missing.join(", ")}`);
    }
}

function assertStaticToastViewportRuntimeBoundary() {
    const appSource = readFileSync("src/App.jsx", "utf8");
    const authSource = readFileSync("src/contexts/AuthContext.jsx", "utf8");
    const apiSource = readFileSync("src/utils/api.js", "utf8");
    const toastHelperSource = readFileSync("src/utils/toast.js", "utf8");
    const confirmActionSource = readFileSync("src/common/confirmAction.jsx", "utf8");
    const promptActionSource = readFileSync("src/common/promptAction.jsx", "utf8");
    const entrySource = readFileSync("src/common/ToastViewportEntry.jsx", "utf8");
    const viewportSource = readFileSync("src/common/ToastViewport.jsx", "utf8");
    const requiredSnippets = [
        "import { ToastViewportEntry } from \"./common/ToastViewportEntry.jsx\"",
        "<ToastViewportEntry />",
        "const ToastViewport = lazy(() =>",
        "import(\"./ToastViewport.jsx\")",
        "requestIdleCallback",
        "import { Toaster } from \"react-hot-toast\"",
        "import(\"react-hot-toast\")",
        "import { loadToast } from \"../utils/toast.js\"",
        "toast = await loadToast()",
        "notifyError",
        "notifySuccess",
    ];
    const sources = [appSource, authSource, apiSource, toastHelperSource, confirmActionSource, promptActionSource, entrySource, viewportSource];
    const missing = requiredSnippets.filter((snippet) => !sources.some((source) => source.includes(snippet)));
    if (
        missing.length ||
        appSource.includes("react-hot-toast") ||
        appSource.includes("<Toaster") ||
        authSource.includes("react-hot-toast") ||
        apiSource.includes("react-hot-toast") ||
        confirmActionSource.includes("from \"react-hot-toast\"") ||
        promptActionSource.includes("from \"react-hot-toast\"")
    ) {
        throw new Error(`home-ui-smoke: toast viewport runtime boundary missing ${missing.join(", ")}`);
    }
}

function assertStaticHomeAdsenseRuntimeBoundary() {
    const homeSource = readFileSync("src/pages/home/Home.jsx", "utf8");
    const runtimeSource = readFileSync("src/pages/home/HomeAdsenseRuntime.jsx", "utf8");
    const helperSource = readFileSync("src/utils/adsense.js", "utf8");
    const requiredSnippets = [
        "const HomeAdsenseRuntime = lazy(() =>",
        "import(\"./HomeAdsenseRuntime.jsx\")",
        "readStoredAdsConsent",
        "isAdsenseBanner",
        "writeStoredAdsConsent",
        "window.adsbygoogle",
        "googlesyndication.com/pagead/js/adsbygoogle.js",
        "onImpression(activeBanner, \"IMPRESSION\")",
        "aria-labelledby=\"home-ads-consent-title\"",
        "aria-label=\"비개인화 광고\"",
    ];
    const sources = [homeSource, runtimeSource, helperSource];
    const missing = requiredSnippets.filter((snippet) => !sources.some((source) => source.includes(snippet)));
    if (
        missing.length ||
        homeSource.includes("window.adsbygoogle") ||
        homeSource.includes("googlesyndication.com/pagead/js/adsbygoogle.js") ||
        homeSource.includes("document.createElement(\"script\")") ||
        homeSource.includes("ADS_CONSENT_STORAGE_KEY") ||
        homeSource.includes("adsensePushKeysRef")
    ) {
        throw new Error(`home-ui-smoke: home AdSense runtime boundary missing ${missing.join(", ")}`);
    }
}

function assertStaticRecentBoardStableKeys() {
    const homeSource = readFileSync("src/pages/home/Home.jsx", "utf8");
    const adapterSource = readFileSync("src/adapters/homeAdapter.js", "utf8");
    if (!adapterSource.includes(".filter((board) => board.id)")) {
        throw new Error("home-ui-smoke: recent home boards must filter out rows without persistent ids.");
    }
    if (!homeSource.includes("key={board.id}") || homeSource.includes("recent-board-${idx}")) {
        throw new Error("home-ui-smoke: recent board cards must use persistent board ids as React keys.");
    }
}

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

function encodeBody(value) {
    return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

function encodeText(value) {
    return Buffer.from(value, "utf8").toString("base64");
}

function routeMock(url, method, postData, headers = {}) {
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
    if (hostname === "pagead2.googlesyndication.com") {
        return {
            status: 200,
            contentType: "application/javascript; charset=utf-8",
            bodyText: "window.adsbygoogle = window.adsbygoogle || [];",
        };
    }
    if (method === "GET" && pathname === "/smoke/home-banner.svg") {
        bannerImageRequests += 1;
        return {
            status: 200,
            contentType: "image/svg+xml; charset=utf-8",
            bodyText: `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="#1d4ed8"/><circle cx="245" cy="46" r="36" fill="#facc15"/><text x="28" y="102" fill="#fff" font-family="Arial" font-size="24" font-weight="700">home banner</text></svg>`,
        };
    }
    const query = parsed.searchParams;

    if (method === "GET" && pathname === "/api/members") {
        return {
            status: 200,
            body: {
                data: {
                    memberId: 999,
                    member_id: 999,
                    name: "검증 사용자",
                    roles: ["ROLE_USER"],
                },
            },
        };
    }
    if (forceStatsFailure && method === "GET" && [
        "/api/stats/dashboard",
        "/api/stats/summary",
        "/api/stats/visitors/compare",
    ].includes(pathname)) {
        return {
            status: 503,
            body: {
                status: 503,
                code: "STATS_UNAVAILABLE",
                message: "통계 서비스를 잠시 사용할 수 없습니다.",
            },
        };
    }
    if (forceBoardsFailure && method === "GET" && ["/api/boards/latest", "/api/boards"].includes(pathname)) {
        return {
            status: 503,
            body: {
                status: 503,
                code: "BOARDS_UNAVAILABLE",
                message: "게시글 목록을 잠시 사용할 수 없습니다.",
            },
        };
    }
    if (method === "GET" && pathname === "/api/stats/dashboard") {
        statsDashboardRequests += 1;
        if (slowStatsDashboard) {
            return {
                status: 200,
                delayMs: 4000,
                body: {
                    data: {
                        summary: {
                            total_members: 1200,
                            total_boards: 340,
                            total_comments: 920,
                            today_visitors: 108,
                            active_members: 1170,
                            quit_members: 30,
                        },
                        visitors_compare: {
                            today_visitors: 108,
                            yesterday_visitors: 90,
                            day_over_day_change_rate: 20,
                        },
                    },
                },
            };
        }
        return {
            status: 200,
            body: {
                data: {
                    summary: {
                        total_members: 1200,
                        total_boards: 340,
                        total_comments: 920,
                        today_visitors: 108,
                        active_members: 1170,
                        quit_members: 30,
                    },
                    visitors_compare: {
                        today_visitors: 108,
                        yesterday_visitors: 90,
                        day_over_day_change_rate: 20,
                    },
                },
            },
        };
    }
    if (method === "GET" && pathname === "/api/stats/summary") {
        statsSummaryRequests += 1;
        return {
            status: 200,
            body: {
                data: {
                    total_members: 1200,
                    total_boards: 340,
                    total_comments: 920,
                    today_visitors: 108,
                    active_members: 1170,
                    quit_members: 30,
                },
            },
        };
    }
    if (method === "GET" && pathname === "/api/stats/visitors/compare") {
        statsVisitorsCompareRequests += 1;
        return {
            status: 200,
            body: {
                data: {
                    today_visitors: 108,
                    yesterday_visitors: 90,
                    day_over_day_change_rate: 20,
                },
            },
        };
    }
    if (method === "GET" && pathname === "/api/boards/latest") {
        latestBoardsRequests += 1;
        return {
            status: 200,
            body: [
                {
                    board_id: 501,
                    kind_of_board: "FREE_BOARD",
                    title: "테스트 게시글",
                    contents: "홈 화면 최신 게시글 표시를 검증합니다.",
                    board_creator: "검증 사용자",
                    view_count: 42,
                    created_at: new Date().toISOString(),
                },
            ],
        };
    }
    if (forceBannerFailure && method === "GET" && pathname === "/api/banners") {
        return {
            status: 503,
            body: {
                status: 503,
                code: "BANNERS_UNAVAILABLE",
                message: "운영 배너를 잠시 사용할 수 없습니다.",
            },
        };
    }
    if (method === "GET" && pathname === "/api/banners") {
        bannerListRequests += 1;
        return {
            status: 200,
            body: {
                data: {
                    items: [
                        {
                            banner_id: 77,
                            banner_type: "AD",
                            title: "홈 화면 광고 배너",
                            description: "광고 동의 전 안내 상태를 검증합니다.",
                            render_mode: "ADSENSE",
                            ad_provider: "ADSENSE",
                            adsense_client: "ca-pub-smoke",
                            adsense_slot: "1234567890",
                        },
                        {
                            banner_id: 78,
                            banner_type: "NOTICE",
                            title: "운영 공지 배너",
                            description: "배너 자동 전환 제어를 검증합니다.",
                            render_mode: "CONTENT",
                            ad_provider: "",
                            link_url: "/app/boards/ADMIN_NOTICE/78",
                            cta_text: "공지 확인",
                        },
                        {
                            banner_id: 79,
                            banner_type: "NOTICE",
                            title: "이미지 공지 배너",
                            description: "보이지 않는 이미지 배너의 지연 로딩을 검증합니다.",
                            image_url: "/smoke/home-banner.svg",
                            render_mode: "CONTENT",
                            ad_provider: "",
                            link_url: "/app/boards/FREE_BOARD/79",
                            cta_text: "이미지 배너 보기",
                        },
                        {
                            banner_id: 80,
                            banner_type: "NOTICE",
                            title: "마지막 공지 배너",
                            description: "순환 배너의 이전 슬라이드 preload 경계를 검증합니다.",
                            render_mode: "CONTENT",
                            ad_provider: "",
                            link_url: "https://example.com/notice/80",
                            cta_text: "외부 안내",
                        },
                        {
                            banner_id: 81,
                            banner_type: "NOTICE",
                            title: "링크 안전성 배너",
                            description: "허용되지 않는 URL은 클릭 링크나 배경 이미지로 만들지 않습니다.",
                            image_url: `/smoke/home-banner.svg");background-image:url(javascript:alert(2))`,
                            render_mode: "CONTENT",
                            ad_provider: "",
                            link_url: "javascript:alert(1)",
                            cta_text: "실행 금지 링크",
                        },
                    ],
                },
            },
        };
    }
    if (method === "POST" && pathname === "/api/banners/events") {
        bannerEventRequests += 1;
        try {
            const payload = JSON.parse(postData || "{}");
            if (payload.event_type === "CLICK") {
                bannerClickRequests += 1;
                bannerClickAuthorizationHeaders.push(headers.Authorization || headers.authorization || "");
            }
            if (payload.event_type === "IMPRESSION") bannerImpressionRequests += 1;
        } catch {
            // Ignore malformed smoke payloads and let the request count assertion fail.
        }
        return { status: 201, body: {}, delayMs: 350 };
    }
    if (method === "GET" && pathname === "/api/chat/rooms") {
        chatRoomRequests += 1;
        return {
            status: 200,
            body: {
                data: [
                    {
                        chat_room_id: 101,
                        title: "운영 회의",
                        type: "GROUP",
                        last_message: "최근 메시지입니다.",
                        unread_count: 2,
                    },
                ],
            },
        };
    }
    if (method === "GET" && pathname === "/ws/chat/info") {
        chatSocketInfoRequests += 1;
        return {
            status: 200,
            body: { websocket: false, origins: ["*:*"], cookie_needed: false, entropy: 123456 },
        };
    }

    return null;
}

async function handleFetchRequest(ws, event) {
    const { requestId, request } = event.params;
    const requestUrl = request.url || "";
    if (/\/(?:api|stats|boards|banners|members|src|assets)\b/i.test(requestUrl)) {
        observedRequests.push(`${request.method} ${requestUrl}`);
        if (observedRequests.length > 20) observedRequests.shift();
    }
    if (/\/FloatingChat(?:\.jsx|-[^/]+\.js)/i.test(requestUrl)) {
        floatingChatChunkRequests += 1;
    }
    if (/PageGuideDialog|pageGuides/i.test(requestUrl)) {
        pageGuideChunkRequests += 1;
    }
    if (/GamesHub/i.test(requestUrl)) {
        gamesHubChunkRequests += 1;
    }
    if (/HeaderMenuDialog/i.test(requestUrl)) {
        headerMenuChunkRequests += 1;
    }
    if (/\/BottomNav(?:\.jsx|-[^/]+\.js)/i.test(requestUrl)) {
        bottomNavChunkRequests += 1;
    }
    if (/\/CustomCursor(?:\.jsx|-[^/]+\.js)/i.test(requestUrl)) {
        customCursorChunkRequests += 1;
    }
    const mock = routeMock(request.url, request.method, request.postData, request.headers);
    if (!mock) {
        await send(ws, "Fetch.continueRequest", { requestId });
        return;
    }
    if (mock.delayMs) {
        await delay(mock.delayMs);
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
    const pageState = await evaluate(ws, `(() => ({
        href: location.href,
        readyState: document.readyState,
        text: (document.body?.innerText || "").slice(0, 600),
    }))()`).catch(() => null);
    const requestState = {
        statsDashboardRequests,
        latestBoardsRequests,
        bannerListRequests,
        bannerEventRequests,
        observedRequests,
    };
    throw new Error(`Timed out waiting for text: ${text}${pageState ? `; page: ${JSON.stringify(pageState)}` : ""}; requests: ${JSON.stringify(requestState)}`);
}

async function waitForExpression(ws, expression, timeoutMs = 6000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (await evaluate(ws, expression)) return;
        await delay(120);
    }
    throw new Error(`Timed out waiting for expression: ${expression}`);
}

async function waitForBannerEventRequestCount(minCount = 1, timeoutMs = 6000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (bannerEventRequests >= minCount) return;
        await delay(40);
    }
    throw new Error(`Timed out waiting for ${minCount} banner event requests`);
}

async function waitForBannerClickRequestCount(minCount = 1, timeoutMs = 6000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (bannerClickRequests >= minCount) return;
        await delay(40);
    }
    throw new Error(`Timed out waiting for ${minCount} banner click requests`);
}

async function waitForAuthenticatedBannerClick(timeoutMs = 6000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (bannerClickAuthorizationHeaders.some((value) => value === "Bearer smoke-access-token")) return;
        await delay(40);
    }
    throw new Error(`Timed out waiting for authenticated banner click event; headers=${JSON.stringify(bannerClickAuthorizationHeaders)}`);
}

async function waitForBannerImageRequestCount(minCount = 1, timeoutMs = 6000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (bannerImageRequests >= minCount) return;
        await delay(40);
    }
    throw new Error(`Timed out waiting for ${minCount} lazy banner image requests`);
}

async function waitForGamesHubChunkRequest(minCount = 1, timeoutMs = 6000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (gamesHubChunkRequests >= minCount) return;
        await delay(40);
    }
    throw new Error(`Timed out waiting for ${minCount} GamesHub chunk requests; observed=${JSON.stringify(observedRequests)}`);
}

async function waitForPageGuideChunkRequest(minCount = 1, timeoutMs = 6000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (pageGuideChunkRequests >= minCount) return;
        await delay(40);
    }
    throw new Error(`Timed out waiting for ${minCount} page guide chunk requests`);
}

async function clickElementByLabel(ws, label) {
    return evaluate(ws, `(() => {
        const button = Array.from(document.querySelectorAll("button, a")).find((node) => {
            const text = node.innerText || "";
            const aria = node.getAttribute("aria-label") || "";
            return text.includes(${JSON.stringify(label)}) || aria.includes(${JSON.stringify(label)});
        });
        if (!button) return "missing";
        button.click();
        return "clicked";
    })()`);
}

async function clickElementByLabelWithoutDefault(ws, label) {
    return evaluate(ws, `(() => {
        const element = Array.from(document.querySelectorAll("button, a")).find((node) => {
            const text = node.innerText || "";
            const aria = node.getAttribute("aria-label") || "";
            return text.includes(${JSON.stringify(label)}) || aria.includes(${JSON.stringify(label)});
        });
        if (!element) return "missing";
        element.addEventListener("click", (event) => event.preventDefault(), { capture: true, once: true });
        element.click();
        return "clicked";
    })()`);
}

async function focusElementByLabel(ws, label) {
    return evaluate(ws, `(() => {
        const element = Array.from(document.querySelectorAll("button, a")).find((node) => {
            const text = node.innerText || "";
            const aria = node.getAttribute("aria-label") || "";
            return text.includes(${JSON.stringify(label)}) || aria.includes(${JSON.stringify(label)});
        });
        if (!element) return "missing";
        element.focus();
        element.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true, pointerType: "mouse" }));
        element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
        element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
        element.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        return document.activeElement === element ? "focused" : "not-focused";
    })()`);
}

async function assertNoFullPageHomeSpinner(ws, context) {
    const hasFullPageSpinner = await evaluate(ws, `document.body?.innerText.includes("데이터를 불러오는 중입니다...")`);
    if (hasFullPageSpinner) {
        throw new Error(`${context}: retry replaced the home content with the full-page loading state`);
    }
}

async function inspectHomeInitialShell(ws) {
    await send(ws, "Emulation.setDeviceMetricsOverride", {
        width: 1366,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
    });
    bannerEventRequests = 0;
    bannerClickRequests = 0;
    bannerImpressionRequests = 0;
    bannerClickAuthorizationHeaders = [];
    bannerImageRequests = 0;
    statsDashboardRequests = 0;
    latestBoardsRequests = 0;
    bannerListRequests = 0;
    headerMenuChunkRequests = 0;
    bottomNavChunkRequests = 0;
    customCursorChunkRequests = 0;
    slowStatsDashboard = true;
    try {
        await send(ws, "Page.navigate", { url: `${baseUrl}/app` });
        await waitForText(ws, "주요 서비스", 1200);
        await waitForText(ws, "게임 허브", 1200);
        await waitForText(ws, "통계를 불러오는 중입니다.", 1200);
        await assertNoFullPageHomeSpinner(ws, "home initial shell");
        const initialA11yState = await evaluate(ws, `(() => ({
            statsBusy: document.querySelector('[aria-label="홈 통계 요약"]')?.getAttribute("aria-busy"),
            statsStatus: Boolean(Array.from(document.querySelectorAll('[role="status"]')).some((node) => (node.innerText || node.getAttribute("aria-label") || "").includes("통계를 불러오는 중입니다."))),
            boardsBusy: document.querySelector('[aria-labelledby="home-boards-heading"]')?.getAttribute("aria-busy"),
            bannerBusy: document.querySelector('[aria-label="홈 배너"]')?.getAttribute("aria-busy"),
        }))()`);
        if (initialA11yState.statsBusy !== "true" || !initialA11yState.statsStatus) {
            throw new Error(`home initial shell: stats loading state is not announced ${JSON.stringify(initialA11yState)}`);
        }
        await waitForText(ws, "홈 화면 광고 배너", 1800);
        await waitForText(ws, "테스트 게시글", 1800);
        await waitForText(ws, "통계를 불러오는 중입니다.", 300);
        if (statsDashboardRequests !== 1 || latestBoardsRequests !== 1 || bannerListRequests !== 1) {
            throw new Error(`home initial shell: expected one dashboard request set, got stats=${statsDashboardRequests} boards=${latestBoardsRequests} banners=${bannerListRequests}`);
        }
        if (headerMenuChunkRequests > 0) {
            throw new Error("home initial shell: header menu chunk loaded before desktop menu activation");
        }
        if (bottomNavChunkRequests > 0) {
            throw new Error("home initial shell: bottom navigation chunk loaded on desktop viewport");
        }
        if (customCursorChunkRequests > 0) {
            throw new Error("home initial shell: custom cursor chunk loaded before pointer activation");
        }
        return "home initial shell: ok";
    } finally {
        slowStatsDashboard = false;
    }
}

async function setInputByPlaceholder(ws, placeholder, value) {
    return evaluate(ws, `(() => {
        const input = Array.from(document.querySelectorAll("input, textarea")).find((node) => node.getAttribute("placeholder") === ${JSON.stringify(placeholder)});
        if (!input) return "missing";
        const descriptor = Object.getOwnPropertyDescriptor(input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value");
        descriptor.set.call(input, ${JSON.stringify(value)});
        input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
        return "changed";
    })()`);
}

async function inspectHome(ws, viewport) {
    await send(ws, "Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.mobile ? 2 : 1,
        mobile: viewport.mobile,
    });
    bannerEventRequests = 0;
    bannerClickRequests = 0;
    bannerImpressionRequests = 0;
    bannerClickAuthorizationHeaders = [];
    bannerImageRequests = 0;
    statsDashboardRequests = 0;
    latestBoardsRequests = 0;
    bannerListRequests = 0;
    chatRoomRequests = 0;
    chatSocketInfoRequests = 0;
    floatingChatChunkRequests = 0;
    pageGuideChunkRequests = 0;
    gamesHubChunkRequests = 0;
    headerMenuChunkRequests = 0;
    bottomNavChunkRequests = 0;
    customCursorChunkRequests = 0;
    await send(ws, "Page.navigate", { url: `${baseUrl}/app` });

    for (const text of requiredTexts) {
        await waitForText(ws, text);
    }
    await delay(250);
    const bottomNavExists = await evaluate(ws, `Boolean(document.querySelector('[aria-label="하단 주요 내비게이션"]'))`);
    if (viewport.mobile && !bottomNavExists) {
        throw new Error(`home ${viewport.name}: bottom navigation missing on mobile viewport`);
    }
    if (!viewport.mobile && bottomNavExists) {
        throw new Error(`home ${viewport.name}: bottom navigation rendered on desktop viewport`);
    }
    if (!viewport.mobile && bottomNavChunkRequests > 0) {
        throw new Error(`home ${viewport.name}: bottom navigation chunk loaded on desktop viewport`);
    }
    if (customCursorChunkRequests > 0) {
        throw new Error(`home ${viewport.name}: custom cursor chunk loaded before pointer activation`);
    }
    await waitForExpression(ws, `Boolean(document.querySelector('[data-page-guide-trigger="true"]'))`, 3500);
    const utilityButtonState = await evaluate(ws, `(() => {
        const toRect = (node) => {
            const rect = node?.getBoundingClientRect?.();
            if (!rect) return null;
            return {
                width: rect.width,
                height: rect.height,
                top: rect.top,
                right: window.innerWidth - rect.right,
                bottom: window.innerHeight - rect.bottom,
                left: rect.left,
            };
        };
        return {
            chat: toRect(document.querySelector('[data-floating-chat-launcher="true"]')),
            guide: toRect(document.querySelector('[data-page-guide-trigger="true"]')),
            viewportHeight: window.innerHeight,
        };
    })()`);
    if (viewport.mobile) {
        if (!utilityButtonState.chat || !utilityButtonState.guide) {
            throw new Error(`home ${viewport.name}: mobile utility buttons missing ${JSON.stringify(utilityButtonState)}`);
        }
        const { chat, guide, viewportHeight } = utilityButtonState;
        if (chat.width > 56 || chat.height > 56 || guide.width > 48 || guide.height > 48) {
            throw new Error(`home ${viewport.name}: utility buttons are too large ${JSON.stringify(utilityButtonState)}`);
        }
        if (chat.top < viewportHeight / 2 || guide.top < viewportHeight / 2 || chat.bottom < 72 || guide.bottom < 72) {
            throw new Error(`home ${viewport.name}: utility buttons overlap primary content or bottom navigation ${JSON.stringify(utilityButtonState)}`);
        }
        if (guide.left >= chat.left) {
            throw new Error(`home ${viewport.name}: utility buttons are not split across bottom corners ${JSON.stringify(utilityButtonState)}`);
        }
        await evaluate(ws, `(() => {
            const spacer = document.createElement("div");
            spacer.id = "__bottomNavSyncSpacer";
            spacer.style.height = "1200px";
            spacer.setAttribute("aria-hidden", "true");
            document.body.appendChild(spacer);
            window.scrollTo(0, document.body.scrollHeight);
        })()`);
        await waitForExpression(ws, `document.querySelector('[data-bottom-nav="true"]')?.getAttribute("data-bottom-nav-visible") === "false"`, 5000);
        await waitForExpression(ws, `(() => {
            const nodes = [
                document.querySelector('[data-floating-chat-launcher="true"]'),
                document.querySelector('[data-page-guide-trigger="true"]'),
            ].filter(Boolean);
            return nodes.length === 2 && nodes.every((node) => {
                const style = getComputedStyle(node);
                return Number(style.opacity) < 0.1 && style.pointerEvents === "none";
            });
        })()`, 5000);
        await evaluate(ws, `(() => {
            window.scrollTo(0, 0);
            document.getElementById("__bottomNavSyncSpacer")?.remove();
        })()`);
        await waitForExpression(ws, `document.querySelector('[data-bottom-nav="true"]')?.getAttribute("data-bottom-nav-visible") === "true"`, 5000);
        await waitForExpression(ws, `(() => {
            const nodes = [
                document.querySelector('[data-floating-chat-launcher="true"]'),
                document.querySelector('[data-page-guide-trigger="true"]'),
            ].filter(Boolean);
            return nodes.length === 2 && nodes.every((node) => {
                const style = getComputedStyle(node);
                return Number(style.opacity) > 0.9 && style.pointerEvents !== "none";
            });
        })()`, 5000);
    }
    await waitForExpression(
        ws,
        `Boolean(document.querySelector('[role="dialog"][aria-labelledby="home-ads-consent-title"][aria-describedby="home-ads-consent-description"]'))`,
        5000
    );
    const a11yState = await evaluate(ws, `(() => ({
        quickMenuLabelled: Boolean(document.getElementById("home-quick-menu-heading") && document.querySelector('[aria-labelledby="home-quick-menu-heading"]')),
        boardsLabelled: Boolean(document.getElementById("home-boards-heading") && document.querySelector('[aria-labelledby="home-boards-heading"]')),
        adDialogLabelled: Boolean(document.querySelector('[role="dialog"][aria-labelledby="home-ads-consent-title"][aria-describedby="home-ads-consent-description"]')),
        statsBusy: document.querySelector('[aria-label="홈 통계 요약"]')?.getAttribute("aria-busy"),
        bannerBusy: document.querySelector('[aria-label="홈 배너"]')?.getAttribute("aria-busy"),
        boardsBusy: document.querySelector('[aria-labelledby="home-boards-heading"]')?.getAttribute("aria-busy"),
        quickMenuAria: Array.from(document.querySelectorAll('a[aria-label$=" 바로가기"]')).map((node) => node.getAttribute("aria-label")),
        latestBoardAria: Array.from(document.querySelectorAll('a[aria-label^="최신 게시글 "]')).map((node) => node.getAttribute("aria-label")),
        latestBoardListAria: Boolean(document.querySelector('a[aria-label="최신 게시글 전체보기"]')),
    }))()`);
    if (!a11yState.quickMenuLabelled || !a11yState.boardsLabelled || !a11yState.adDialogLabelled) {
        throw new Error(`home ${viewport.name}: landmark/dialog labels are incomplete ${JSON.stringify(a11yState)}`);
    }
    if (a11yState.statsBusy !== "false" || a11yState.bannerBusy !== "false" || a11yState.boardsBusy !== "false") {
        throw new Error(`home ${viewport.name}: completed sections still marked busy ${JSON.stringify(a11yState)}`);
    }
    if (!a11yState.latestBoardListAria || !a11yState.quickMenuAria.includes("게임 허브 바로가기") || !a11yState.latestBoardAria.some((label) => label.includes("테스트 게시글"))) {
        throw new Error(`home ${viewport.name}: action links do not expose clear Korean aria labels ${JSON.stringify(a11yState)}`);
    }
    if (chatRoomRequests > 0 || chatSocketInfoRequests > 0) {
        throw new Error(`home ${viewport.name}: floating chat loaded before user activation rooms=${chatRoomRequests} wsInfo=${chatSocketInfoRequests}`);
    }
    if (floatingChatChunkRequests > 0) {
        throw new Error(`home ${viewport.name}: floating chat chunk loaded before user activation`);
    }
    if (!pageGuideLazyLoadVerified && pageGuideChunkRequests > 0) {
        throw new Error(`home ${viewport.name}: page guide chunk loaded before user activation`);
    }
    if (!gamesHubPrefetchVerified && gamesHubChunkRequests > 0) {
        throw new Error(`home ${viewport.name}: games route chunk loaded before link focus/hover intent`);
    }
    if (headerMenuChunkRequests > 0) {
        throw new Error(`home ${viewport.name}: header menu chunk loaded before desktop menu activation`);
    }
    const firstDashboardCounts = {
        statsDashboardRequests,
        latestBoardsRequests,
        bannerListRequests,
    };
    if (
        firstDashboardCounts.statsDashboardRequests !== 1 ||
        firstDashboardCounts.latestBoardsRequests !== 1 ||
        firstDashboardCounts.bannerListRequests !== 1
    ) {
        throw new Error(`home ${viewport.name}: expected one initial dashboard request set, got ${JSON.stringify(firstDashboardCounts)}`);
    }
    if (!pageGuideLazyLoadVerified) {
        if (await clickElementByLabel(ws, "페이지 설명 열기") !== "clicked") {
            throw new Error(`home ${viewport.name}: page guide trigger missing`);
        }
        await waitForPageGuideChunkRequest(1);
        await waitForText(ws, "주요 메뉴, 공지, 게시글, 배너를 한눈에 보는 시작 화면입니다.");
        if (await clickElementByLabel(ws, "페이지 설명 닫기") !== "clicked") {
            throw new Error(`home ${viewport.name}: page guide close button missing`);
        }
        pageGuideLazyLoadVerified = true;
    }
    if (!gamesHubPrefetchVerified) {
        if (await focusElementByLabel(ws, "게임 허브") !== "focused") {
            throw new Error(`home ${viewport.name}: games quick menu focus failed`);
        }
        await waitForGamesHubChunkRequest(1);
        gamesHubPrefetchVerified = true;
    }
    if (await clickElementByLabel(ws, "게임 허브") !== "clicked") {
        throw new Error(`home ${viewport.name}: games quick menu missing`);
    }
    await waitForExpression(ws, `location.pathname === "/app/games"`);
    await evaluate(ws, `history.back()`);
    await waitForExpression(ws, `location.pathname === "/app"`);
    await assertNoFullPageHomeSpinner(ws, `home ${viewport.name} cached return`);
    await waitForText(ws, "오늘 방문자");
    await delay(250);
    const returnDashboardCounts = {
        statsDashboardRequests,
        latestBoardsRequests,
        bannerListRequests,
    };
    if (
        returnDashboardCounts.statsDashboardRequests !== firstDashboardCounts.statsDashboardRequests ||
        returnDashboardCounts.latestBoardsRequests !== firstDashboardCounts.latestBoardsRequests ||
        returnDashboardCounts.bannerListRequests !== firstDashboardCounts.bannerListRequests
    ) {
        throw new Error(`home ${viewport.name}: dashboard cache missed after SPA return ${JSON.stringify(returnDashboardCounts)}`);
    }
    if (bannerImageRequests !== 0) {
        throw new Error(`home ${viewport.name}: offscreen banner image loaded before the banner became adjacent`);
    }
    const unsafeBannerBackgrounds = await evaluate(ws, `Array.from(document.querySelectorAll("[style]"))
        .map((node) => node.style.backgroundImage || node.getAttribute("style") || "")
        .filter((style) => /(?:javascript|data|vbscript):/i.test(style))`);
    if (unsafeBannerBackgrounds.length) {
        throw new Error(`home ${viewport.name}: unsafe banner image URL rendered ${JSON.stringify(unsafeBannerBackgrounds)}`);
    }
    const unsafeBannerLinks = await evaluate(ws, `Array.from(document.querySelectorAll("a"))
        .map((node) => ({ text: node.innerText || "", href: node.getAttribute("href") || "" }))
        .filter((node) => /^(javascript|data|vbscript):/i.test(node.href) || node.href.startsWith("//") || node.text.includes("실행 금지 링크"))`);
    if (unsafeBannerLinks.length) {
        throw new Error(`home ${viewport.name}: unsafe banner CTA link rendered ${JSON.stringify(unsafeBannerLinks)}`);
    }
    await evaluate(ws, `Object.keys(sessionStorage).filter((key) => key.startsWith("home_banner_impression:")).forEach((key) => sessionStorage.removeItem(key)); sessionStorage.removeItem("__homeSmokeBeaconClickSent"); sessionStorage.setItem("__homeSmokeDocumentLoads", "1")`);
    await waitForText(ws, "배너 일시정지");
    const transformBeforeHidden = await evaluate(ws, `document.querySelector('[data-home-banner-track="true"]')?.style.transform`);
    await evaluate(ws, `(() => {
        Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
        document.dispatchEvent(new Event("visibilitychange"));
    })()`);
    await delay(4700);
    const transformWhileHidden = await evaluate(ws, `document.querySelector('[data-home-banner-track="true"]')?.style.transform`);
    await evaluate(ws, `(() => {
        Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
        document.dispatchEvent(new Event("visibilitychange"));
    })()`);
    if (transformWhileHidden !== transformBeforeHidden) {
        throw new Error(`home ${viewport.name}: banner auto-advanced while document was hidden (${transformBeforeHidden} -> ${transformWhileHidden})`);
    }
    const transformBeforeOffscreen = await evaluate(ws, `document.querySelector('[data-home-banner-track="true"]')?.style.transform`);
    await evaluate(ws, `(() => {
        const spacer = document.createElement("div");
        spacer.id = "__homeOffscreenSpacer";
        spacer.style.height = "1400px";
        spacer.setAttribute("aria-hidden", "true");
        document.body.appendChild(spacer);
        window.scrollTo(0, document.body.scrollHeight);
    })()`);
    await waitForExpression(ws, `(() => {
        const banner = document.querySelector('[aria-label="홈 배너"]');
        const rect = banner?.getBoundingClientRect();
        return Boolean(rect && (rect.bottom < 0 || rect.top > window.innerHeight));
    })()`);
    await waitForExpression(ws, `document.querySelector('[aria-label="홈 배너"]')?.getAttribute("data-home-banner-in-view") === "false"`);
    await delay(4700);
    const transformWhileOffscreen = await evaluate(ws, `document.querySelector('[data-home-banner-track="true"]')?.style.transform`);
    await evaluate(ws, `(() => {
        window.scrollTo(0, 0);
        document.getElementById("__homeOffscreenSpacer")?.remove();
    })()`);
    if (transformWhileOffscreen !== transformBeforeOffscreen) {
        throw new Error(`home ${viewport.name}: banner auto-advanced while offscreen (${transformBeforeOffscreen} -> ${transformWhileOffscreen})`);
    }
    if (await clickElementByLabel(ws, "배너 일시정지") !== "clicked") {
        throw new Error(`home ${viewport.name}: banner pause button missing`);
    }
    await waitForText(ws, "배너 재생");
    if (await clickElementByLabel(ws, "채팅창 열기") !== "clicked") {
        throw new Error(`home ${viewport.name}: floating chat launcher missing`);
    }
    await waitForText(ws, "운영 회의");
    if (await setInputByPlaceholder(ws, "채팅방 검색", "없는방") !== "changed") {
        throw new Error(`home ${viewport.name}: floating chat search missing`);
    }
    await waitForText(ws, "검색 결과가 없습니다.");
    if (await setInputByPlaceholder(ws, "채팅방 검색", "") !== "changed") {
        throw new Error(`home ${viewport.name}: floating chat search clear failed`);
    }
    await waitForText(ws, "최근 메시지입니다.");
    await delay(500);
    if (await clickElementByLabel(ws, "배너 1번 보기") !== "clicked") {
        throw new Error(`home ${viewport.name}: AdSense banner selector missing before consent`);
    }
    await waitForExpression(ws, `["translateX(-0%)", "translateX(0%)"].includes(document.querySelector('[data-home-banner-track="true"]')?.style.transform)`);

    const adScriptLoadedBeforeConsent = await evaluate(ws, `Array.from(document.scripts || []).some((script) => script.src.includes("googlesyndication.com/pagead/js/adsbygoogle.js"))`);
    if (adScriptLoadedBeforeConsent) {
        throw new Error(`home ${viewport.name}: AdSense script loaded before consent`);
    }
    if (bannerEventRequests > 0) {
        throw new Error(`home ${viewport.name}: AdSense impression was recorded before consent`);
    }
    if (await clickElementByLabel(ws, "비개인화 광고") !== "clicked") {
        throw new Error(`home ${viewport.name}: AdSense non-personalized consent button missing`);
    }
    await waitForBannerEventRequestCount(1);
    await delay(160);
    const networkIndicatorVisibleDuringBannerEvent = await evaluate(ws, `Boolean(document.querySelector('[aria-label="요청 처리 중"]'))`);
    if (networkIndicatorVisibleDuringBannerEvent) {
        throw new Error(`home ${viewport.name}: banner analytics event triggered the global loading indicator`);
    }
    await waitForText(ws, "광고 설정 변경");
    await waitForExpression(ws, `Array.from(document.scripts || []).some((script) => script.src.includes("googlesyndication.com/pagead/js/adsbygoogle.js"))`);
    const nonPersonalizedFlag = await evaluate(ws, `window.adsbygoogle?.requestNonPersonalizedAds === 1`);
    if (!nonPersonalizedFlag) {
        throw new Error(`home ${viewport.name}: non-personalized AdSense flag was not applied`);
    }
    await waitForExpression(ws, `(window.__homeSmokeAdsensePushCount || 0) === 1`);
    const adsensePushCountAfterConsent = await evaluate(ws, `window.__homeSmokeAdsensePushCount || 0`);
    if (adsensePushCountAfterConsent !== 1) {
        throw new Error(`home ${viewport.name}: expected one AdSense push after consent, got ${adsensePushCountAfterConsent}`);
    }
    if (bannerEventRequests !== 1) {
        throw new Error(`home ${viewport.name}: expected one AdSense impression after consent, got ${bannerEventRequests}`);
    }
    if (bannerImpressionRequests !== 1) {
        throw new Error(`home ${viewport.name}: expected one impression event after consent, got ${bannerImpressionRequests}`);
    }
    const impressionDedupStored = await evaluate(ws, `Boolean(sessionStorage.getItem("home_banner_impression:HOME_HERO:auth:77"))`);
    if (!impressionDedupStored) {
        throw new Error(`home ${viewport.name}: authenticated AdSense impression dedup key was not stored`);
    }
    bannerEventRequests = 0;
    bannerImpressionRequests = 0;
    await evaluate(ws, `(() => {
        const expiresAt = String(Date.now() + 30000);
        sessionStorage.setItem("home_banner_impression:HOME_HERO:78", expiresAt);
        sessionStorage.setItem("home_banner_impression:HOME_HERO:guest:78", expiresAt);
        sessionStorage.removeItem("home_banner_impression:HOME_HERO:auth:78");
        const spacer = document.createElement("div");
        spacer.id = "__homeOffscreenImpressionSpacer";
        spacer.style.height = "1400px";
        spacer.setAttribute("aria-hidden", "true");
        document.body.appendChild(spacer);
        window.scrollTo(0, document.body.scrollHeight);
    })()`);
    await waitForExpression(ws, `document.querySelector('[aria-label="홈 배너"]')?.getAttribute("data-home-banner-in-view") === "false"`);
    if (await clickElementByLabel(ws, "배너 2번 보기") !== "clicked") {
        throw new Error(`home ${viewport.name}: content banner selector missing for offscreen impression check`);
    }
    await delay(250);
    if (bannerEventRequests > 0 || bannerImpressionRequests > 0) {
        throw new Error(`home ${viewport.name}: banner impression was recorded while offscreen events=${bannerEventRequests} impressions=${bannerImpressionRequests}`);
    }
    await evaluate(ws, `(() => {
        window.scrollTo(0, 0);
        document.getElementById("__homeOffscreenImpressionSpacer")?.remove();
    })()`);
    await waitForExpression(ws, `document.querySelector('[aria-label="홈 배너"]')?.getAttribute("data-home-banner-in-view") === "true"`);
    await waitForBannerEventRequestCount(1);
    if (bannerImpressionRequests !== 1) {
        throw new Error(`home ${viewport.name}: visible content banner impression was not recorded after returning onscreen`);
    }
    if (await clickElementByLabel(ws, "배너 1번 보기") !== "clicked") {
        throw new Error(`home ${viewport.name}: first banner selector missing after offscreen impression check`);
    }
    await waitForExpression(ws, `["translateX(-0%)", "translateX(0%)"].includes(document.querySelector('[data-home-banner-track="true"]')?.style.transform)`);
    await delay(120);
    const adsensePushCountAfterReturn = await evaluate(ws, `window.__homeSmokeAdsensePushCount || 0`);
    if (adsensePushCountAfterReturn !== 1) {
        throw new Error(`home ${viewport.name}: AdSense push repeated for the same visible slot, got ${adsensePushCountAfterReturn}`);
    }
    if (await clickElementByLabel(ws, "광고 설정 변경") !== "clicked") {
        throw new Error(`home ${viewport.name}: AdSense settings change button missing`);
    }
    await waitForText(ws, "맞춤 광고 동의 여부를 선택해 주세요.");
    const storedConsentAfterReset = await evaluate(ws, `localStorage.getItem("ads_personalization_consent")`);
    if (storedConsentAfterReset !== null) {
        throw new Error(`home ${viewport.name}: AdSense consent remained in localStorage after reset`);
    }
    await evaluate(ws, `(() => {
        localStorage.setItem("ads_personalization_consent", "personalized");
        window.dispatchEvent(new StorageEvent("storage", {
            key: "ads_personalization_consent",
            oldValue: null,
            newValue: "personalized",
            storageArea: localStorage,
        }));
    })()`);
    await waitForText(ws, "광고 설정 변경");
    await evaluate(ws, `(() => {
        localStorage.removeItem("ads_personalization_consent");
        window.dispatchEvent(new StorageEvent("storage", {
            key: "ads_personalization_consent",
            oldValue: "personalized",
            newValue: null,
            storageArea: localStorage,
        }));
    })()`);
    await waitForText(ws, "맞춤 광고 동의 여부를 선택해 주세요.");
    if (await clickElementByLabel(ws, "다음 배너 보기") !== "clicked") {
        throw new Error(`home ${viewport.name}: next banner button missing`);
    }
    await waitForExpression(ws, `document.querySelector('[data-home-banner-track="true"]')?.style.transform === "translateX(-100%)"`);
    await waitForExpression(ws, `document.querySelector('[aria-label="배너 2번 보기"]')?.getAttribute("aria-current") === "true"`);
    await waitForExpression(ws, `(() => {
        const slides = Array.from(document.querySelectorAll('[aria-roledescription="slide"]'));
        const activeSlides = slides.filter((node) => node.getAttribute("aria-hidden") === "false");
        return activeSlides.length === 1 && activeSlides[0]?.getAttribute("aria-label") === "2 / 5";
    })()`);
    if (await clickElementByLabel(ws, "이전 배너 보기") !== "clicked") {
        throw new Error(`home ${viewport.name}: previous banner button missing`);
    }
    await waitForExpression(ws, `["translateX(-0%)", "translateX(0%)"].includes(document.querySelector('[data-home-banner-track="true"]')?.style.transform)`);
    await waitForExpression(ws, `document.querySelector('[aria-label="배너 1번 보기"]')?.getAttribute("aria-current") === "true"`);
    if (await clickElementByLabel(ws, "배너 4번 보기") !== "clicked") {
        throw new Error(`home ${viewport.name}: external banner selector missing`);
    }
    await waitForExpression(ws, `document.querySelector('[data-home-banner-track="true"]')?.style.transform === "translateX(-300%)"`);
    const externalBannerCtaInfo = await evaluate(ws, `(() => {
        const node = Array.from(document.querySelectorAll("a")).find((item) => (item.innerText || "").includes("외부 안내"));
        return node ? {
            tag: node.tagName,
            href: node.getAttribute("href") || "",
            target: node.getAttribute("target") || "",
            rel: node.getAttribute("rel") || "",
        } : null;
    })()`);
    if (
        !externalBannerCtaInfo ||
        externalBannerCtaInfo.tag !== "A" ||
        externalBannerCtaInfo.href !== "https://example.com/notice/80" ||
        externalBannerCtaInfo.target !== "_blank" ||
        !externalBannerCtaInfo.rel.includes("noopener")
    ) {
        throw new Error(`home ${viewport.name}: external banner CTA is not a safe external link ${JSON.stringify(externalBannerCtaInfo)}`);
    }
    const bannerClicksBeforeExternalClick = bannerClickRequests;
    bannerClickAuthorizationHeaders = [];
    if (await clickElementByLabelWithoutDefault(ws, "외부 안내") !== "clicked") {
        throw new Error(`home ${viewport.name}: external banner CTA missing`);
    }
    await waitForBannerClickRequestCount(bannerClicksBeforeExternalClick + 1);
    await waitForAuthenticatedBannerClick();
    if (await clickElementByLabel(ws, "배너 5번 보기") !== "clicked") {
        throw new Error(`home ${viewport.name}: last banner selector missing`);
    }
    await waitForExpression(ws, `document.querySelector('[data-home-banner-track="true"]')?.style.transform === "translateX(-400%)"`);
    if (await clickElementByLabel(ws, "다음 배너 보기") !== "clicked") {
        throw new Error(`home ${viewport.name}: next banner button missing after last slide`);
    }
    await waitForExpression(ws, `(() => {
        const track = document.querySelector('[data-home-banner-track="true"]');
        const slides = Array.from(document.querySelectorAll('[aria-roledescription="slide"]'));
        const activeSlides = slides.filter((node) => node.getAttribute("aria-hidden") === "false");
        return track?.style.transform === "translateX(-500%)" &&
            activeSlides.length === 1 &&
            slides[0]?.getAttribute("aria-hidden") === "true" &&
            slides[5]?.getAttribute("aria-hidden") === "false" &&
            slides[5]?.getAttribute("aria-label") === "1 / 5";
    })()`);

    const value = await evaluate(ws, `(() => {
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
        throw new Error(`home ${viewport.name}: missing text ${missing.join(", ")}`);
    }

    const blocked = blockedTexts.filter((text) => value.text.includes(text));
    if (blocked.length) {
        throw new Error(`home ${viewport.name}: blocked English text ${blocked.join(", ")}`);
    }

    const overflow = Math.max(value.scrollWidth, value.bodyWidth) - value.clientWidth;
    if (overflow > 3) {
        throw new Error(`home ${viewport.name}: horizontal overflow ${overflow}px ${JSON.stringify(value.overflowNodes)}`);
    }

    const bannerClicksBeforeClick = bannerClickRequests;
    if (await clickElementByLabel(ws, "배너 3번 보기") !== "clicked") {
        throw new Error(`home ${viewport.name}: image banner selector missing`);
    }
    await waitForBannerImageRequestCount(1);
    if (await clickElementByLabel(ws, "배너 2번 보기") !== "clicked") {
        throw new Error(`home ${viewport.name}: content banner selector missing`);
    }
    const bannerCtaInfo = await evaluate(ws, `(() => {
        const node = Array.from(document.querySelectorAll("a")).find((item) => (item.innerText || "").includes("공지 확인"));
        return node ? { tag: node.tagName, href: node.getAttribute("href") || "" } : null;
    })()`);
    if (!bannerCtaInfo || bannerCtaInfo.tag !== "A" || bannerCtaInfo.href !== "/app/boards/ADMIN_NOTICE/78") {
        throw new Error(`home ${viewport.name}: content banner CTA is not a semantic internal link`);
    }
    if (await clickElementByLabel(ws, "공지 확인") !== "clicked") {
        throw new Error(`home ${viewport.name}: content banner CTA missing`);
    }
    await waitForBannerClickRequestCount(bannerClicksBeforeClick + 1);
    await waitForAuthenticatedBannerClick();
    await waitForExpression(ws, `location.pathname === "/app/boards/ADMIN_NOTICE/78"`);
    const documentLoadsAfterBannerClick = await evaluate(ws, `sessionStorage.getItem("__homeSmokeDocumentLoads")`);
    if (documentLoadsAfterBannerClick !== "1") {
        throw new Error(`home ${viewport.name}: internal banner CTA caused a full document reload`);
    }

    return `home ${viewport.name}: ok ${value.clientWidth}/${value.scrollWidth} ${value.url}`;
}

async function inspectHomeStatsPartialFailure(ws) {
    await send(ws, "Emulation.setDeviceMetricsOverride", {
        width: 1366,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
    });
    bannerEventRequests = 0;
    bannerClickRequests = 0;
    bannerImpressionRequests = 0;
    bannerImageRequests = 0;
    forceStatsFailure = true;
    try {
        await send(ws, "Page.navigate", { url: `${baseUrl}/app` });
        await waitForText(ws, "통계 연결이 지연되고 있습니다.");
        await waitForText(ws, "다시 불러오기");
        await waitForText(ws, "테스트 게시글");
        await waitForText(ws, "홈 화면 광고 배너");
        const pageState = await evaluate(ws, `(() => {
            const text = document.body?.innerText || "";
            return {
                hasGlobalError: text.includes("데이터를 불러오는 중 문제가 발생했습니다."),
                statValues: Array.from(document.querySelectorAll("[data-home-stat-value]")).map((node) => node.innerText.trim()),
            };
        })()`);
        if (pageState.hasGlobalError) {
            throw new Error("home stats partial failure: global error replaced partial content");
        }
        if (!pageState.statValues.length || pageState.statValues.some((value) => value !== "-")) {
            throw new Error(`home stats partial failure: expected delayed stat placeholders, got ${JSON.stringify(pageState.statValues)}`);
        }
        forceStatsFailure = false;
        forceBoardsFailure = true;
        forceBannerFailure = true;
        if (await clickElementByLabel(ws, "다시 불러오기") !== "clicked") {
            throw new Error("home stats partial failure: retry button missing");
        }
        await delay(80);
        await assertNoFullPageHomeSpinner(ws, "home stats partial retry");
        await waitForExpression(ws, `Array.from(document.querySelectorAll("[data-home-stat-value]")).every((node) => node.innerText.trim() !== "-")`);
        await waitForExpression(ws, `!(document.body?.innerText || "").includes("통계 연결이 지연되고 있습니다.")`);
        const preservedSections = await evaluate(ws, `(() => {
            const text = document.body?.innerText || "";
            return {
                hasExistingBoard: text.includes("테스트 게시글"),
                hasExistingBanner: text.includes("홈 화면 광고 배너"),
                hasBoardsUnavailable: text.includes("최신 게시글 연결이 지연되고 있습니다."),
                hasBannerUnavailable: text.includes("운영 배너 연결이 지연되고 있습니다."),
            };
        })()`);
        if (
            !preservedSections.hasExistingBoard ||
            !preservedSections.hasExistingBanner ||
            preservedSections.hasBoardsUnavailable ||
            preservedSections.hasBannerUnavailable
        ) {
            throw new Error(`home background retry: existing sections were not preserved ${JSON.stringify(preservedSections)}`);
        }
        return "home stats partial failure: ok";
    } finally {
        forceStatsFailure = false;
        forceBoardsFailure = false;
        forceBannerFailure = false;
    }
}

async function inspectHomeStatsTimeout(ws) {
    await send(ws, "Emulation.setDeviceMetricsOverride", {
        width: 1366,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
    });
    bannerEventRequests = 0;
    bannerClickRequests = 0;
    bannerImpressionRequests = 0;
    bannerImageRequests = 0;
    statsSummaryRequests = 0;
    statsVisitorsCompareRequests = 0;
    slowStatsDashboard = true;
    try {
        await send(ws, "Page.navigate", { url: `${baseUrl}/app` });
        await waitForText(ws, "통계 연결이 지연되고 있습니다.", 6000);
        await waitForText(ws, "테스트 게시글");
        await waitForText(ws, "홈 화면 광고 배너");
        if (statsSummaryRequests > 0 || statsVisitorsCompareRequests > 0) {
            throw new Error(`home stats timeout: timeout triggered split fallback requests summary=${statsSummaryRequests} visitors=${statsVisitorsCompareRequests}`);
        }
        const pageState = await evaluate(ws, `(() => {
            const text = document.body?.innerText || "";
            return {
                hasGlobalError: text.includes("데이터를 불러오는 중 문제가 발생했습니다."),
                statValues: Array.from(document.querySelectorAll("[data-home-stat-value]")).map((node) => node.innerText.trim()),
            };
        })()`);
        if (pageState.hasGlobalError) {
            throw new Error("home stats timeout: global error replaced partial content");
        }
        if (!pageState.statValues.length || pageState.statValues.some((value) => value !== "-")) {
            throw new Error(`home stats timeout: expected delayed stat placeholders, got ${JSON.stringify(pageState.statValues)}`);
        }
        return "home stats timeout: ok";
    } finally {
        slowStatsDashboard = false;
    }
}

async function inspectHomeBoardsPartialFailure(ws) {
    await send(ws, "Emulation.setDeviceMetricsOverride", {
        width: 1366,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
    });
    bannerEventRequests = 0;
    bannerClickRequests = 0;
    bannerImpressionRequests = 0;
    bannerImageRequests = 0;
    forceBoardsFailure = true;
    try {
        await send(ws, "Page.navigate", { url: `${baseUrl}/app` });
        await waitForText(ws, "최신 게시글 연결이 지연되고 있습니다.");
        await waitForText(ws, "잠시 후 다시 불러오면 새 글 목록을 확인할 수 있습니다.");
        await waitForText(ws, "오늘 방문자");
        await waitForText(ws, "홈 화면 광고 배너");
        const pageState = await evaluate(ws, `(() => {
            const text = document.body?.innerText || "";
            return {
                hasGlobalError: text.includes("데이터를 불러오는 중 문제가 발생했습니다."),
                hasEmptyBoards: text.includes("아직 최신 게시글이 없습니다."),
                hasTestBoard: text.includes("테스트 게시글"),
            };
        })()`);
        if (pageState.hasGlobalError) {
            throw new Error("home boards partial failure: global error replaced partial content");
        }
        if (pageState.hasEmptyBoards || pageState.hasTestBoard) {
            throw new Error(`home boards partial failure: expected delayed boards notice, got ${JSON.stringify(pageState)}`);
        }
        forceBoardsFailure = false;
        if (await clickElementByLabel(ws, "다시 불러오기") !== "clicked") {
            throw new Error("home boards partial failure: retry button missing");
        }
        await delay(80);
        await assertNoFullPageHomeSpinner(ws, "home boards partial retry");
        await waitForText(ws, "테스트 게시글");
        await waitForExpression(ws, `!(document.body?.innerText || "").includes("최신 게시글 연결이 지연되고 있습니다.")`);
        return "home boards partial failure: ok";
    } finally {
        forceBoardsFailure = false;
    }
}

async function inspectHomeBannerPartialFailure(ws) {
    await send(ws, "Emulation.setDeviceMetricsOverride", {
        width: 1366,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
    });
    bannerEventRequests = 0;
    bannerClickRequests = 0;
    bannerImpressionRequests = 0;
    bannerImageRequests = 0;
    forceBannerFailure = true;
    try {
        await send(ws, "Page.navigate", { url: `${baseUrl}/app` });
        await waitForText(ws, "운영 배너 연결이 지연되고 있습니다.");
        await waitForText(ws, "오늘 방문자");
        await waitForText(ws, "테스트 게시글");
        const pageState = await evaluate(ws, `(() => {
            const text = document.body?.innerText || "";
            return {
                hasGlobalError: text.includes("데이터를 불러오는 중 문제가 발생했습니다."),
                hasFallbackGreeting: text.includes("안녕하세요"),
                hasAdBanner: text.includes("홈 화면 광고 배너"),
                hasRetry: text.includes("다시 불러오기"),
            };
        })()`);
        if (pageState.hasGlobalError) {
            throw new Error("home banner partial failure: global error replaced partial content");
        }
        if (!pageState.hasFallbackGreeting || pageState.hasAdBanner || !pageState.hasRetry) {
            throw new Error(`home banner partial failure: expected banner delay notice with fallback content, got ${JSON.stringify(pageState)}`);
        }
        forceBannerFailure = false;
        if (await clickElementByLabel(ws, "다시 불러오기") !== "clicked") {
            throw new Error("home banner partial failure: retry button missing");
        }
        await delay(80);
        await assertNoFullPageHomeSpinner(ws, "home banner partial retry");
        await waitForText(ws, "홈 화면 광고 배너");
        await waitForExpression(ws, `!(document.body?.innerText || "").includes("운영 배너 연결이 지연되고 있습니다.")`);
        return "home banner partial failure: ok";
    } finally {
        forceBannerFailure = false;
    }
}

async function main() {
    assertStaticFocusTrapUtility();
    assertStaticLoadingSpinnerBoundary();
    assertStaticNetworkIndicatorRuntimeBoundary();
    assertStaticPageGuideAccessibility();
    assertStaticHeaderMenuAccessibility();
    assertStaticBottomNavRuntimeBoundary();
    assertStaticCustomCursorRuntimeBoundary();
    assertStaticToastViewportRuntimeBoundary();
    assertStaticHomeAdsenseRuntimeBoundary();
    assertStaticRecentBoardStableKeys();

    const chrome = spawn(chromePath, [
        "--headless=new",        "--remote-debugging-pipe",
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
        const ws = await createPipeSession(chrome, { debug, testName: "home-ui-smoke" });
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
        await send(ws, "Fetch.enable", { patterns: [{ urlPattern: "*://localhost*/api/*", requestStage: "Request" },
                { urlPattern: "*://127.0.0.1*/api/*", requestStage: "Request" },
                { urlPattern: "*://localhost*/ws/chat/*", requestStage: "Request" },
                { urlPattern: "*://127.0.0.1*/ws/chat/*", requestStage: "Request" },
                { urlPattern: "*://localhost*/assets/*", requestStage: "Request" },
                { urlPattern: "*://127.0.0.1*/assets/*", requestStage: "Request" },
                { urlPattern: "*://localhost*/src/*", requestStage: "Request" },
                { urlPattern: "*://127.0.0.1*/src/*", requestStage: "Request" },
                { urlPattern: "*://localhost*/smoke/*", requestStage: "Request" },
                { urlPattern: "*://127.0.0.1*/smoke/*", requestStage: "Request" },
                { urlPattern: "https://oapi.map.naver.com/*", requestStage: "Request" },
                { urlPattern: "https://pagead2.googlesyndication.com/*", requestStage: "Request" }] });
        await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
            source: `
                const smokeDocumentLoads = Number(sessionStorage.getItem("__homeSmokeDocumentLoads") || "0");
                sessionStorage.setItem("__homeSmokeDocumentLoads", String(smokeDocumentLoads + 1));
                localStorage.setItem("accessToken", "smoke-access-token");
                localStorage.setItem("refreshToken", "smoke-refresh-token");
                localStorage.setItem("userRoles", JSON.stringify(["ROLE_USER"]));
                window.__homeSmokeBeaconPayloads = [];
                window.__homeSmokeAdsensePushCount = 0;
                window.adsbygoogle = window.adsbygoogle || [];
                const nativeAdsensePush = window.adsbygoogle.push.bind(window.adsbygoogle);
                window.adsbygoogle.push = (...items) => {
                    window.__homeSmokeAdsensePushCount += items.length;
                    return nativeAdsensePush(...items);
                };
                const nativeSendBeacon = typeof navigator.sendBeacon === "function" ? navigator.sendBeacon.bind(navigator) : null;
                const wrappedSendBeacon = (url, data) => {
                    if (String(url || "").includes("/api/banners/events")) {
                        try {
                            sessionStorage.setItem("__homeSmokeBeaconClickSent", "1");
                            window.__homeSmokeBeaconPayloads.push({ event_type: "CLICK", transport: "sendBeacon" });
                            if (data instanceof Blob) {
                                data.text().then((text) => {
                                    try {
                                        window.__homeSmokeBeaconPayloads.push(JSON.parse(text));
                                    } catch {}
                                });
                            } else if (typeof data === "string") {
                                window.__homeSmokeBeaconPayloads.push(JSON.parse(data));
                            }
                        } catch {}
                    }
                    if (nativeSendBeacon) {
                        return nativeSendBeacon(url, data);
                    }
                    try {
                        fetch(url, {
                            method: "POST",
                            body: data,
                            credentials: "same-origin",
                            keepalive: true,
                        }).catch(() => {});
                        return true;
                    } catch {
                        return false;
                    }
                };
                try {
                    Object.defineProperty(navigator, "sendBeacon", {
                        configurable: true,
                        value: wrappedSendBeacon,
                    });
                    if (typeof Navigator !== "undefined" && Navigator.prototype) {
                        Object.defineProperty(Navigator.prototype, "sendBeacon", {
                            configurable: true,
                            value: wrappedSendBeacon,
                        });
                    }
                } catch {
                    navigator.sendBeacon = wrappedSendBeacon;
                }
            `,
        });

        const results = [];
        results.push(await inspectHomeInitialShell(ws));
        for (const viewport of viewports) {
            results.push(await inspectHome(ws, viewport));
        }
        results.push(await inspectHomeStatsPartialFailure(ws));
        results.push(await inspectHomeStatsTimeout(ws));
        results.push(await inspectHomeBoardsPartialFailure(ws));
        results.push(await inspectHomeBannerPartialFailure(ws));
        if (runtimeErrors.length) {
            throw new Error(`Runtime errors: ${runtimeErrors.join(" | ")}`);
        }
        results.forEach((result) => console.log(result));
        console.log(`home-ui-smoke ok (${results.length} responsive checks)`);
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


