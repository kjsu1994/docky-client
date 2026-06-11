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
const userDataDir = mkdtempSync(path.join(tmpdir(), "auth-ui-smoke-"));
const blockedTexts = ["LOG IN", "SIGN UP", "Loading", "Error", "undefined", "NaN"];

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

function assertStaticLoginLockDialogAccessibility() {
    const source = readFileSync("src/pages/access/Login.jsx", "utf8");
    const requiredSnippets = [
        "import { trapFocus } from \"../../utils/focusTrap.js\"",
        "releaseLoadingRef.current = releaseLoading",
        "document.body.style.overflow = \"hidden\"",
        "previousFocus.focus()",
        "trapFocus(event, lockDialogRef.current)",
        "role=\"presentation\"",
        "role=\"dialog\"",
        "aria-modal=\"true\"",
        "aria-labelledby={lockDialogTitleId}",
        "aria-describedby={lockDialogDescriptionId}",
        "htmlFor={lockReleaseReasonId}",
        "autoFocus",
    ];
    const missing = requiredSnippets.filter((snippet) => !source.includes(snippet));
    if (missing.length) {
        throw new Error(`auth-ui-smoke: login lock dialog accessibility guard missing ${missing.join(", ")}`);
    }
}

function assertStaticAuthRuntimeBoundaries() {
    const source = readFileSync("src/contexts/AuthContext.jsx", "utf8");
    if (source.includes("import { queueAdapter } from \"../adapters/queueAdapter.js\"")
        || !source.includes("await import(\"../adapters/queueAdapter.js\")")) {
        throw new Error("auth-ui-smoke: queue adapter must stay lazy-loaded until post-login queue routing.");
    }
    if (source.includes("from \"../adapters/authAdapter.js\"")
        || !source.includes("const loadAuthAdapter = () => import(\"../adapters/authAdapter.js\")")
        || !source.includes("const { authAdapter } = await loadAuthAdapter()")) {
        throw new Error("auth-ui-smoke: auth adapter must stay lazy-loaded until auth state or auth action needs it.");
    }
    if (!source.includes("getStoredRefreshToken")
        || !source.includes("!token && refreshToken")
        || !source.includes("await refreshAccessToken()")) {
        throw new Error("auth-ui-smoke: auth init must recover from a stored refresh token when the access token is missing.");
    }

    const authStorageSource = readFileSync("src/utils/authStorage.js", "utf8");
    if (!authStorageSource.includes("localRefreshToken")
        || !authStorageSource.includes("sessionRefreshToken")
        || !authStorageSource.includes("localToken || localRefreshToken")
        || !authStorageSource.includes("sessionToken || sessionRefreshToken")) {
        throw new Error("auth-ui-smoke: auth storage must select the store that still has a refresh token.");
    }

    const apiSource = readFileSync("src/utils/api.js", "utf8");
    if (!apiSource.includes("export const refreshAccessToken = async ()")) {
        throw new Error("auth-ui-smoke: refresh token recovery must expose the access-token reissue helper.");
    }

    const appSource = readFileSync("src/App.jsx", "utf8");
    const protectedRoutesSource = readFileSync("src/components/ProtectedRoutes.jsx", "utf8");
    const protectedLayoutSource = readFileSync("src/components/ProtectedAppLayout.jsx", "utf8");
    const appShellOnlyImports = [
        "import { Header } from \"./components/Header\"",
        "import { Header } from \"./components/Header.jsx\"",
        "BottomNavEntry",
        "CustomCursorEntry",
        "FloatingChatEntry",
        "ProtectedAppLayout",
        "./pages/home/Home.jsx",
        "./pages/boards/BoardList.jsx",
        "./pages/games/TabletopGame.jsx",
    ];
    const leakedImports = appShellOnlyImports.filter((snippet) => appSource.includes(snippet));
    if (
        leakedImports.length ||
        !appSource.includes("const ProtectedRoutes = lazy(() =>") ||
        !appSource.includes("import(\"./components/ProtectedRoutes.jsx\")") ||
        !appSource.includes("path=\"/app/*\"") ||
        !protectedRoutesSource.includes("const ProtectedAppLayout = lazy(() =>") ||
        !protectedRoutesSource.includes("import(\"./ProtectedAppLayout.jsx\")") ||
        !protectedRoutesSource.includes("import(\"../pages/home/Home.jsx\")") ||
        !protectedLayoutSource.includes("import { Header } from \"./Header.jsx\"") ||
        !protectedLayoutSource.includes("<FloatingChatEntry />") ||
        !protectedLayoutSource.includes("<BottomNavEntry />")
    ) {
        throw new Error(`auth-ui-smoke: protected route table and app layout must stay out of the public auth shell ${leakedImports.join(", ")}`);
    }

    const loginSource = readFileSync("src/pages/access/Login.jsx", "utf8");
    const registerSource = readFileSync("src/pages/access/Register.jsx", "utf8");
    const queueSource = readFileSync("src/pages/access/Queue.jsx", "utf8");
    const accessSources = [
        ["Login", loginSource],
        ["Register", registerSource],
        ["Queue", queueSource],
    ];
    const staticAccessRuntimeLeaks = accessSources.flatMap(([name, pageSource]) => {
        const leaks = [];
        if (pageSource.includes("from \"react-hot-toast\"")) leaks.push(`${name}:react-hot-toast`);
        if (pageSource.includes("from \"../../adapters/authAdapter.js\"")) leaks.push(`${name}:authAdapter`);
        if (pageSource.includes("from \"../../adapters/queueAdapter.js\"")) leaks.push(`${name}:queueAdapter`);
        return leaks;
    });
    if (
        staticAccessRuntimeLeaks.length ||
        !loginSource.includes("const loadAuthAdapter = () => import(\"../../adapters/authAdapter.js\")") ||
        !registerSource.includes("const loadAuthAdapter = () => import(\"../../adapters/authAdapter.js\")") ||
        !queueSource.includes("const loadQueueAdapter = () => import(\"../../adapters/queueAdapter.js\")") ||
        !loginSource.includes("import { notifyError, notifyLoading, notifySuccess } from \"../../utils/toast.js\"") ||
        !loginSource.includes("notifyLoading(\"해제 요청을 제출하는 중입니다...\"") ||
        !registerSource.includes("import { notifyError, notifySuccess } from \"../../utils/toast.js\"") ||
        !queueSource.includes("import { notifySuccess } from \"../../utils/toast.js\"")
    ) {
        throw new Error(`auth-ui-smoke: public access pages must lazy-load toast/auth/queue runtimes ${staticAccessRuntimeLeaks.join(", ")}`);
    }
}

const parsePostData = (postData) => {
    try {
        return JSON.parse(postData || "{}");
    } catch {
        return {};
    }
};

function routeMock(url, method, postData) {
    const { hostname, pathname } = new URL(url);

    if (method === "GET" && hostname === "oapi.map.naver.com") {
        return { status: 200, contentType: "application/javascript; charset=utf-8", bodyText: "" };
    }

    if (method === "POST" && pathname === "/api/members/login") {
        const payload = parsePostData(postData);
        if (payload.email === "locked@example.com") {
            return {
                status: 423,
                body: {
                    code: "ACCOUNT_LOCKED",
                    message: "계정 이용이 제한되었습니다.",
                    sanction_info: {
                        reason: "스모크 테스트 제재",
                        starts_at: "2026-06-01T09:00:00",
                        ends_at: "2026-06-08T09:00:00",
                    },
                },
            };
        }
        return {
            status: 200,
            headers: [
                { name: "Authorization", value: "Bearer smoke-access-token" },
                { name: "Refresh", value: "Bearer smoke-refresh-token" },
            ],
            body: {
                data: {
                    member_id: 100,
                    email: "smoke@example.com",
                    name: "인증 검증자",
                    roles: ["ROLE_USER"],
                },
            },
        };
    }

    if (method === "GET" && pathname === "/api/members") {
        return {
            status: 200,
            body: {
                data: {
                    member_id: 100,
                    email: "smoke@example.com",
                    name: "인증 검증자",
                    roles: ["ROLE_USER"],
                },
            },
        };
    }

    if (method === "POST" && pathname === "/api/auth/reissue") {
        return {
            status: 200,
            headers: [
                { name: "Authorization", value: "Bearer smoke-reissued-access-token" },
            ],
            body: null,
        };
    }

    if (method === "POST" && pathname === "/api/queue/join") {
        return {
            status: 200,
            body: {
                data: {
                    user_id: "smoke-user",
                    rank: 0,
                    total_waiting: 0,
                    expected_time: 0,
                    status: "ALLOWED",
                    waited_seconds: 0,
                    priority: "NORMAL",
                    rejoin_grace_seconds: 0,
                    poll_interval_seconds: 5,
                },
            },
        };
    }

    if (method === "GET" && pathname === "/api/chat/rooms") {
        return { status: 200, body: { data: [] } };
    }

    if (method === "GET" && pathname === "/api/home/summary") {
        return {
            status: 200,
            body: {
                data: {
                    total_members: 120,
                    total_boards: 340,
                    total_comments: 890,
                    total_trees: 42,
                },
            },
        };
    }

    if (method === "GET" && pathname === "/api/boards") {
        return {
            status: 200,
            headers: [
                { name: "X-Total-Count", value: "0" },
                { name: "X-Total-Pages", value: "1" },
                { name: "X-Page-Number", value: "1" },
                { name: "X-Page-Size", value: "3" },
            ],
            body: [],
        };
    }

    if (method === "GET" && pathname === "/api/banners") {
        return { status: 200, body: { data: { items: [] } } };
    }

    if (method === "GET" && pathname === "/api/members/check-email") {
        return {
            status: 200,
            body: {
                data: {
                    email: "new@example.com",
                    available: true,
                    exists: false,
                },
            },
        };
    }

    if (method === "POST" && pathname === "/api/members/email-verification/send") {
        return {
            status: 200,
            body: {
                data: {
                    email: "new@example.com",
                    expire_minutes: 30,
                    remaining_attempts: 5,
                },
            },
        };
    }

    if (method === "POST" && pathname === "/api/members/email-verification/confirm") {
        return {
            status: 200,
            body: {
                data: {
                    email: "new@example.com",
                    verified: true,
                },
            },
        };
    }

    if (method === "POST" && pathname === "/api/members") {
        return {
            status: 201,
            body: {
                data: {
                    member_id: 101,
                    email: "new@example.com",
                    name: "신규 회원",
                },
            },
        };
    }

    if (method === "POST" && pathname === "/api/sanctions/release-request") {
        return {
            status: 200,
            body: {
                data: {
                    requested: true,
                },
            },
        };
    }

    return null;
}

async function handleFetchRequest(cdp, sessionId, event) {
    const { requestId, request } = event.params;
    const mock = routeMock(request.url, request.method, request.postData);
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
            ...(mock.headers || []),
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
        bodyText: document.body?.innerText?.slice(0, 300) || "",
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

async function clickByText(cdp, sessionId, text) {
    const target = await evaluate(cdp, sessionId, `(() => {
        const target = Array.from(document.querySelectorAll("button,a,input"))
            .find((node) => (node.innerText || node.value || node.placeholder || node.getAttribute("aria-label") || "").includes(${JSON.stringify(text)}));
        if (!target) return null;
        target.scrollIntoView({ block: "center", inline: "center" });
        const rect = target.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
        };
    })()`);
    if (!target) throw new Error(`Could not click text: ${text}`);

    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: target.x, y: target.y }, sessionId);
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: target.x, y: target.y, button: "left", clickCount: 1 }, sessionId);
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: target.x, y: target.y, button: "left", clickCount: 1 }, sessionId);
}

async function clickSelector(cdp, sessionId, selector) {
    const target = await evaluate(cdp, sessionId, `(() => {
        const target = document.querySelector(${JSON.stringify(selector)});
        if (!target) return null;
        target.scrollIntoView({ block: "center", inline: "center" });
        const rect = target.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
        };
    })()`);
    if (!target) throw new Error(`Could not click selector: ${selector}`);

    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: target.x, y: target.y }, sessionId);
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: target.x, y: target.y, button: "left", clickCount: 1 }, sessionId);
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: target.x, y: target.y, button: "left", clickCount: 1 }, sessionId);
}

async function assertNoBlockedText(cdp, sessionId, label) {
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

async function inspectAuth(cdp, sessionId) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: 390,
        height: 844,
        deviceScaleFactor: 2,
        mobile: true,
    }, sessionId);

    await cdp.send("Page.navigate", { url: `${baseUrl}/login?error` }, sessionId);
    await waitForText(cdp, sessionId, "소셜 로그인에 실패했습니다. 다시 시도해주세요.");
    await waitFor(cdp, sessionId, `location.pathname === "/login" && location.search === ""`, "oauth error query cleanup");
    await waitForText(cdp, sessionId, "로그인");
    await assertNoBlockedText(cdp, sessionId, "oauth error");

    await cdp.send("Page.navigate", { url: `${baseUrl}/login` }, sessionId);
    await waitForText(cdp, sessionId, "로그인");
    await setInputValue(cdp, sessionId, "input[type='email']", "locked@example.com");
    await setInputValue(cdp, sessionId, "input[type='password']", "password123");
    await clickSelector(cdp, sessionId, "form button[type='submit']");
    await waitForText(cdp, sessionId, "계정 이용 제한");
    await waitFor(cdp, sessionId, `(() => {
        const dialog = document.querySelector("[role='dialog'][aria-modal='true']");
        if (!dialog) return false;
        const titleId = dialog.getAttribute("aria-labelledby");
        const descriptionId = dialog.getAttribute("aria-describedby");
        return Boolean(
            titleId &&
            descriptionId &&
            document.getElementById(titleId)?.innerText.includes("계정 이용 제한") &&
            document.getElementById(descriptionId)?.innerText.includes("제재 상태") &&
            dialog.querySelector("button")?.innerText.includes("닫기") &&
            document.body.style.overflow === "hidden"
        );
    })()`, "locked account dialog accessibility");
    await setInputValue(cdp, sessionId, "textarea", "검토 부탁드립니다");
    await clickByText(cdp, sessionId, "해제 요청");
    await waitForText(cdp, sessionId, "해제 요청이 제출되었습니다.");
    await clickByText(cdp, sessionId, "닫기");
    await waitFor(cdp, sessionId, `!document.querySelector("[role='dialog'][aria-modal='true']")`, "locked account dialog close");
    await assertNoBlockedText(cdp, sessionId, "locked account dialog");

    await evaluate(cdp, sessionId, `(() => {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem("refreshToken", "smoke-refresh-token");
    })()`);
    await cdp.send("Page.navigate", { url: `${baseUrl}/app` }, sessionId);
    await waitFor(cdp, sessionId, `location.pathname === "/app"`, "mobile refresh-token-only auth recovery");
    await waitFor(cdp, sessionId, `localStorage.getItem("accessToken") === "smoke-reissued-access-token"`, "reissued access token persisted in local storage");
    await assertNoBlockedText(cdp, sessionId, "refresh-token-only recovery");

    await cdp.send("Page.navigate", { url: `${baseUrl}/login` }, sessionId);
    await waitForText(cdp, sessionId, "로그인");
    await setInputValue(cdp, sessionId, "input[type='email']", "smoke@example.com");
    await setInputValue(cdp, sessionId, "input[type='password']", "password123");
    await clickSelector(cdp, sessionId, "form button[type='submit']");
    await waitFor(cdp, sessionId, `location.pathname === "/app"`, "login redirect");
    await assertNoBlockedText(cdp, sessionId, "login");

    await evaluate(cdp, sessionId, `localStorage.clear()`);
    await cdp.send("Page.navigate", { url: `${baseUrl}/register` }, sessionId);
    await waitForText(cdp, sessionId, "회원가입");
    await setInputValue(cdp, sessionId, "input[name='email']", "new@example.com");
    await clickByText(cdp, sessionId, "중복 확인");
    await waitForText(cdp, sessionId, "사용 가능한 이메일입니다.");
    await clickByText(cdp, sessionId, "인증번호 전송");
    await waitForText(cdp, sessionId, "인증번호를 보냈습니다.");
    await setInputValue(cdp, sessionId, "input[name='verificationCode']", "123456");
    await clickByText(cdp, sessionId, "인증 확인");
    await waitForText(cdp, sessionId, "이메일 인증이 완료되었습니다.");
    await setInputValue(cdp, sessionId, "input[name='password']", "password123");
    await setInputValue(cdp, sessionId, "input[name='confirmPassword']", "password123");
    await setInputValue(cdp, sessionId, "input[name='name']", "신규 회원");
    await setInputValue(cdp, sessionId, "input[name='phone']", "01012345678");
    await clickByText(cdp, sessionId, "회원가입 완료");
    await waitFor(cdp, sessionId, `location.pathname === "/login"`, "register redirect");
    await assertNoBlockedText(cdp, sessionId, "register");

    return "auth mobile: ok";
}

async function main() {
    assertStaticLoginLockDialogAccessibility();
    assertStaticAuthRuntimeBoundaries();

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
        if (!targetId) throw new Error("Could not create Chrome target for auth smoke test.");
        const attachResponse = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
        sessionId = attachResponse.result?.sessionId;
        if (!sessionId) throw new Error("Could not attach to Chrome target for auth smoke test.");

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

        const result = await inspectAuth(cdp, sessionId);
        if (runtimeErrors.length) {
            throw new Error(`Runtime errors: ${runtimeErrors.join(" | ")}`);
        }
        console.log(result);
        console.log("auth-ui-smoke ok");
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
