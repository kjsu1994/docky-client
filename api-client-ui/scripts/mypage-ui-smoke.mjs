import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { normalizeProfileImageUrl } from "../src/utils/profileImage.js";

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
const userDataDir = mkdtempSync(path.join(tmpdir(), "mypage-ui-smoke-"));
const viewports = [
    { name: "desktop", width: 1366, height: 900, mobile: false },
    { name: "mobile", width: 390, height: 844, mobile: true },
];
const profileTexts = ["검증 사용자", "누적 경험치", "보유 포인트", "프로필 수정", "계정 관리"];
const postsTexts = ["작성 글", "테스트 게시글", "좋아요", "조회"];
const statsTexts = ["활동 통계", "경험치 이력", "게시글 작성 보상", "다음 레벨까지"];
const editTexts = ["프로필 수정", "이메일", "전화번호", "주소", "주소 검색", "수정 내용 저장"];
const blockedTexts = ["Total EXP", "Points", "Trees", "Anonymous", "Name", "Email", "Phone", "Member Status", "Loading", "Error"];
const mypageSource = readFileSync(new URL("../src/pages/home/Mypage.jsx", import.meta.url), "utf8");
const mypageEditSource = readFileSync(new URL("../src/pages/home/MypageEdit.jsx", import.meta.url), "utf8");

function assertStaticMypageToastRuntimeBoundary() {
    for (const [name, source] of [
        ["Mypage", mypageSource],
        ["MypageEdit", mypageEditSource],
    ]) {
        if (source.includes("from \"react-hot-toast\"") || /\btoast\.(success|error|loading|custom|dismiss|remove)\b/.test(source)) {
            throw new Error(`mypage-ui-smoke: ${name} must use the dynamic toast helper instead of static react-hot-toast imports.`);
        }
    }
    if (!mypageSource.includes("notifyError") || !mypageSource.includes("notifySuccess")) {
        throw new Error("mypage-ui-smoke: Mypage must keep success/error notifications on the dynamic toast runtime boundary.");
    }
    if (!mypageEditSource.includes("notifyError") || !mypageEditSource.includes("notifySuccess") || !mypageEditSource.includes("notify(")) {
        throw new Error("mypage-ui-smoke: MypageEdit must keep plain/success/error notifications on the dynamic toast runtime boundary.");
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

function encodeBody(value) {
    return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

function encodeText(value) {
    return Buffer.from(value, "utf8").toString("base64");
}

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
                    email: "smoke@example.com",
                    name: "검증 사용자",
                    phone: "010-1234-5678",
                    address: "서울특별시 중구 세종대로 110",
                    point: "6400",
                    board_count: 3,
                    comment_count: 8,
                    member_status: "MEMBER_ACTIVE",
                    auth_provider: "LOCAL",
                    levelDto: {
                        level: 7,
                        totalExp: 1820,
                        currentExp: 320,
                        nextLevelExp: 500,
                        remainingExp: 180,
                        progressPercent: 64,
                    },
                    roles: ["ROLE_USER"],
                },
            },
        };
    }
    if (method === "GET" && pathname === "/api/boards/myBoards") {
        return {
            status: 200,
            body: {
                data: [
                    {
                        board_id: 501,
                        kind_of_board: "FREE_BOARD",
                        title: "테스트 게시글",
                        contents: "<p>마이페이지 작성 글 미리보기입니다.</p>",
                        like_count: 12,
                        view_count: 87,
                        created_at: "2026-06-01T09:00:00",
                    },
                ],
            },
        };
    }
    if (method === "GET" && pathname === "/api/members/level/history") {
        return {
            status: 200,
            body: {
                data: [
                    {
                        ledger_id: 77,
                        event_type: "BOARD_CREATE",
                        base_exp: 10,
                        penalty_exp: 0,
                        granted_exp: 10,
                        created_at: "2026-06-01T08:30:00",
                    },
                ],
            },
        };
    }
    if (method === "GET" && pathname === "/api/chat/rooms") {
        return { status: 200, body: { data: [] } };
    }
    if (method === "GET" && pathname === "/api/members/notifications/unread-count") {
        return { status: 200, body: { data: { unreadCount: 0 } } };
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
        body: mock.bodyText == null ? encodeBody(mock.body) : encodeText(mock.bodyText),
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

async function waitForText(cdp, sessionId, text, timeoutMs = 7000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (await evaluate(cdp, sessionId, `document.body?.innerText.includes(${JSON.stringify(text)})`)) return;
        await delay(120);
    }
    const bodyText = await evaluate(cdp, sessionId, `document.body?.innerText.slice(0, 800) || ""`);
    throw new Error(`Timed out waiting for text: ${text}. Body: ${bodyText}`);
}

async function clickButtonByText(cdp, sessionId, text) {
    return evaluate(cdp, sessionId, `(() => {
        const button = Array.from(document.querySelectorAll("button")).find((node) => node.textContent.includes(${JSON.stringify(text)}));
        if (!button) return "missing";
        button.click();
        return "clicked";
    })()`);
}

async function inspectTextAndOverflow(cdp, sessionId, viewport, label, requiredTexts) {
    for (const text of requiredTexts) {
        await waitForText(cdp, sessionId, text);
    }
    await delay(250);

    const value = await evaluate(cdp, sessionId, `(() => {
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
        throw new Error(`${label} ${viewport.name}: missing text ${missing.join(", ")} at ${value.url}. Body: ${value.text.slice(0, 800)}`);
    }

    const blocked = blockedTexts.filter((text) => value.text.includes(text));
    if (blocked.length) {
        throw new Error(`${label} ${viewport.name}: blocked text ${blocked.join(", ")}`);
    }

    const overflow = Math.max(value.scrollWidth, value.bodyWidth) - value.clientWidth;
    if (overflow > 3) {
        throw new Error(`${label} ${viewport.name}: horizontal overflow ${overflow}px ${JSON.stringify(value.overflowNodes)}`);
    }

    return `${label} ${viewport.name}: ok ${value.clientWidth}/${value.scrollWidth} ${value.url}`;
}

async function inspectMypage(cdp, sessionId, viewport) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.mobile ? 2 : 1,
        mobile: viewport.mobile,
    }, sessionId);

    await cdp.send("Page.navigate", { url: `${baseUrl}/app/mypage` }, sessionId);
    const profileResult = await inspectTextAndOverflow(cdp, sessionId, viewport, "mypage profile", profileTexts);
    if (debug) {
        console.log("mypage after profile", await evaluate(cdp, sessionId, `({
            url: location.href,
            text: document.body?.innerText.slice(0, 240) || ""
        })`));
    }

    const postsClickResult = await clickButtonByText(cdp, sessionId, "작성 글");
    if (debug) {
        console.log("mypage posts click", postsClickResult, await evaluate(cdp, sessionId, `({
            url: location.href,
            text: document.body?.innerText.slice(0, 240) || ""
        })`));
    }
    if (postsClickResult !== "clicked") {
        throw new Error(`mypage ${viewport.name}: posts tab missing`);
    }
    const postsResult = await inspectTextAndOverflow(cdp, sessionId, viewport, "mypage posts", postsTexts);

    if (await clickButtonByText(cdp, sessionId, "활동 통계") !== "clicked") {
        throw new Error(`mypage ${viewport.name}: stats tab missing`);
    }
    const statsResult = await inspectTextAndOverflow(cdp, sessionId, viewport, "mypage stats", statsTexts);

    await cdp.send("Page.navigate", { url: `${baseUrl}/app/mypage/edit` }, sessionId);
    const editResult = await inspectTextAndOverflow(cdp, sessionId, viewport, "mypage edit", editTexts);

    return [profileResult, postsResult, statsResult, editResult];
}

async function main() {
    assertStaticMypageToastRuntimeBoundary();
    if (mypageSource.includes("심은 나무") || mypageSource.includes("treeCount")) {
        throw new Error("mypage-ui-smoke: donation tree count must stay removed from mypage.");
    }

    const deleteModalSnippets = [
        "role=\"dialog\"",
        "aria-modal=\"true\"",
        "aria-labelledby={titleId}",
        "aria-describedby={descriptionId}",
        "passwordInputRef.current?.focus()",
        "cancelButtonRef.current?.focus()",
        "previousFocus.focus()",
        "document.body.style.overflow = \"hidden\"",
        "event.key === \"Escape\"",
        "trapFocus(event, dialogRef.current)",
        "role=\"presentation\"",
        "onMouseDown={(event) => {",
    ];
    const missingDeleteModalSnippets = deleteModalSnippets.filter((snippet) => !mypageSource.includes(snippet));
    if (missingDeleteModalSnippets.length) {
        throw new Error(`mypage delete account modal accessibility guard missing: ${missingDeleteModalSnippets.join(", ")}`);
    }

    if (!mypageEditSource.includes("PROFILE_IMAGE_ACCEPT = \"image/jpeg,image/png,image/gif,image/webp,image/bmp\"")) {
        throw new Error("mypage profile upload must keep the raster-only accept list.");
    }
    if (!mypageEditSource.includes("isAllowedProfileImageFile(file)")) {
        throw new Error("mypage profile upload must validate raster image MIME types before upload.");
    }
    const googleProfileUrl = "https://lh3.googleusercontent.com/a/avatar";
    const externalUploadLikeUrl = "https://example.com/upload-files/profile/avatar.png";
    if (normalizeProfileImageUrl(googleProfileUrl) !== googleProfileUrl) {
        throw new Error("profile URL normalization must preserve external OAuth image URLs.");
    }
    if (normalizeProfileImageUrl(externalUploadLikeUrl) !== externalUploadLikeUrl) {
        throw new Error("profile URL normalization must not proxy external upload-like URLs.");
    }
    if (normalizeProfileImageUrl("http://localhost:9000/upload-files/profile/avatar.png") !== "/api/image/view?path=profile%2Favatar.png") {
        throw new Error("profile URL normalization must proxy trusted internal profile objects.");
    }
    if (normalizeProfileImageUrl("/api/image/view?path=boards%2F1%2Favatar.png") !== "") {
        throw new Error("profile URL normalization must reject non-profile image proxy paths.");
    }

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
        if (!targetId) {
            throw new Error("Could not create Chrome target for mypage smoke test.");
        }
        const attachResponse = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
        sessionId = attachResponse.result?.sessionId;
        if (!sessionId) {
            throw new Error("Could not attach to Chrome target for mypage smoke test.");
        }

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
            } else if (debug && message.method?.startsWith("Network.")) {
                const params = message.params || {};
                const request = params.request || {};
                const response = params.response || {};
                console.log("network", message.method, request.url || response.url || params.errorText || params.requestId || "");
            }
        });

        await cdp.send("Page.enable", {}, sessionId);
        await cdp.send("Runtime.enable", {}, sessionId);
        await cdp.send("Network.enable", {}, sessionId);
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
            `,
        }, sessionId);

        const results = [];
        for (const viewport of viewports) {
            results.push(...await inspectMypage(cdp, sessionId, viewport));
        }
        if (runtimeErrors.length) {
            throw new Error(`Runtime errors: ${runtimeErrors.join(" | ")}`);
        }
        results.forEach((result) => console.log(result));
        console.log(`mypage-ui-smoke ok (${results.length} responsive checks)`);
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

