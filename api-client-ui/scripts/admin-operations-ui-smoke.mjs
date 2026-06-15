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
const userDataDir = mkdtempSync(path.join(tmpdir(), "admin-operations-ui-smoke-"));
const blockedTexts = [
    "Loading",
    "Error",
    "undefined",
    "NaN",
    "MEMBER_ACTIVE",
    "ROLE_USER",
    "ROLE_ADMIN",
    "ROLE_MASTER",
    "PENDING",
    "ACTIVE",
    "NOTICE | CONTENT | ALL",
    "Client:",
    "Slot:",
];
const viewports = [
    { name: "desktop", width: 1366, height: 900, mobile: false, interactive: true },
    { name: "tablet", width: 768, height: 1024, mobile: false, interactive: false },
    { name: "galaxy-s26", width: 360, height: 780, mobile: true, deviceScaleFactor: 3, interactive: false },
    { name: "short-galaxy-s26", width: 360, height: 740, mobile: true, deviceScaleFactor: 3, interactive: false },
];

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

function assertStaticMemberSearchBounds() {
    const adapterSource = readFileSync("src/adapters/adminOperationsAdapter.js", "utf8");
    const pageSource = readFileSync("src/pages/admin/AdminOperations.jsx", "utf8");
    if (!adapterSource.includes("normalizeMemberSearchKeyword(keyword)")) {
        throw new Error("admin-operations-ui-smoke: member candidate search must normalize keyword before /members/list.");
    }
    if (!pageSource.includes("MEMBER_SEARCH_KEYWORD_MAX_LENGTH") || !pageSource.includes("maxLength={MEMBER_SEARCH_KEYWORD_MAX_LENGTH}")) {
        throw new Error("admin-operations-ui-smoke: member search input must be bounded.");
    }
    if (adapterSource.includes("treeCount") || adapterSource.includes("tree_count") || pageSource.includes("treeCount")) {
        throw new Error("admin-operations-ui-smoke: donation tree count must stay removed from admin member detail.");
    }
    if (pageSource.includes("member-candidate-${idx}") || !pageSource.includes("key={candidateId}")) {
        throw new Error("admin-operations-ui-smoke: member search candidates must use real member ids as keys.");
    }
    if (!pageSource.includes("copyMemberId") || !pageSource.includes("navigator.clipboard.writeText")) {
        throw new Error("admin-operations-ui-smoke: member detail must expose member id copy action.");
    }
}

function assertStaticMemberDetailStableIds() {
    const adapterSource = readFileSync("src/adapters/adminOperationsAdapter.js", "utf8");
    const pageSource = readFileSync("src/pages/admin/AdminOperations.jsx", "utf8");
    for (const fallback of ["|| index", "|| idx", "key={`${board.boardId || idx}", "key={`${comment.commentId || idx}", "key={`${item.sanctionId || idx}", "key={`${item.reportId || idx}"]) {
        if (adapterSource.includes(fallback) || pageSource.includes(fallback)) {
            throw new Error("admin-operations-ui-smoke: member detail summaries must not synthesize ids from array indexes.");
        }
    }
    for (const stableKey of ["key={board.boardId}", "key={comment.commentId}", "key={item.sanctionId}", "key={item.reportId}"]) {
        if (!pageSource.includes(stableKey)) {
            throw new Error(`admin-operations-ui-smoke: member detail summary is missing stable key ${stableKey}.`);
        }
    }
    for (const filterGuard of ["filter((board) => board.boardId)", "filter((comment) => comment.commentId)", "filter((sanction) => sanction.sanctionId)", "filter((report) => report.reportId)"]) {
        if (!adapterSource.includes(filterGuard)) {
            throw new Error(`admin-operations-ui-smoke: member detail summaries must filter missing ids with ${filterGuard}.`);
        }
    }
}

function assertStaticBannerFormBounds() {
    const adapterSource = readFileSync("src/adapters/adminOperationsAdapter.js", "utf8");
    const pageSource = readFileSync("src/pages/admin/AdminOperations.jsx", "utf8");
    const fields = ["title", "description", "imageUrl", "linkUrl", "ctaText", "adProvider", "adsenseClient", "adsenseSlot"];
    if (!adapterSource.includes("ADMIN_BANNER_LIMITS") || !adapterSource.includes("clampBannerPriority(form.priority)")) {
        throw new Error("admin-operations-ui-smoke: banner payload must mirror server DTO limits.");
    }
    for (const field of fields) {
        if (!adapterSource.includes(`ADMIN_BANNER_LIMITS.${field}`) || !pageSource.includes(`maxLength={ADMIN_BANNER_LIMITS.${field}}`)) {
            throw new Error(`admin-operations-ui-smoke: banner ${field} input must be bounded.`);
        }
    }
    if (!pageSource.includes("min={ADMIN_BANNER_LIMITS.priorityMin}") || !pageSource.includes("max={ADMIN_BANNER_LIMITS.priorityMax}")) {
        throw new Error("admin-operations-ui-smoke: banner priority input must be clamped.");
    }
    if (!adapterSource.includes("uploadBannerImage(file)") || !adapterSource.includes("/admin/banners/image")) {
        throw new Error("admin-operations-ui-smoke: banner image upload adapter must be wired.");
    }
    if (!pageSource.includes('type="file"')
        || !pageSource.includes("data-banner-image-upload")
        || !pageSource.includes("uploadBannerImageFile")
        || !pageSource.includes("image/jpeg,image/png,image/gif,image/webp,image/bmp")) {
        throw new Error("admin-operations-ui-smoke: banner form must support local image file upload.");
    }
}

function assertStaticModerationBounds() {
    const adapterSource = readFileSync("src/adapters/adminOperationsAdapter.js", "utf8");
    const pageSource = readFileSync("src/pages/admin/AdminOperations.jsx", "utf8");
    if (!adapterSource.includes("ADMIN_MODERATION_REASON_MAX_LENGTH")
        || !adapterSource.includes("toLimitedText(reason, ADMIN_MODERATION_REASON_MAX_LENGTH)")) {
        throw new Error("admin-operations-ui-smoke: moderation reason payload must be bounded.");
    }
    if (!pageSource.includes("ADMIN_MODERATION_REASON_MAX_LENGTH")
        || !pageSource.includes("maxLength={ADMIN_MODERATION_REASON_MAX_LENGTH}")) {
        throw new Error("admin-operations-ui-smoke: moderation reason input must be bounded.");
    }
}

function assertStaticToastRuntimeSplit() {
    const pageSource = readFileSync("src/pages/admin/AdminOperations.jsx", "utf8");
    if (pageSource.includes("react-hot-toast") || /\btoast\.(success|error|loading|custom|dismiss|remove)\b/.test(pageSource)) {
        throw new Error("admin-operations-ui-smoke: AdminOperations must use lazy toast helpers instead of static react-hot-toast imports.");
    }
    for (const helper of ["notifyError", "notifySuccess", "notifyLoading"]) {
        if (!pageSource.includes(helper)) {
            throw new Error(`admin-operations-ui-smoke: AdminOperations must keep ${helper} wired for user feedback.`);
        }
    }
}

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
                    member_id: 999,
                    email: "admin@example.com",
                    name: "관리자",
                    roles: ["ROLE_ADMIN"],
                },
            },
        };
    }

    if (method === "GET" && pathname === "/api/members/admin-mfa/status") {
        return {
            status: 200,
            body: {
                data: {
                    required: true,
                    verified: true,
                    ttl_seconds: 600,
                },
            },
        };
    }

    if (method === "GET" && pathname === "/api/chat/rooms") {
        return { status: 200, body: { data: [] } };
    }

    if (method === "GET" && pathname === "/api/admin/moderation/boards") {
        return {
            status: 200,
            body: {
                data: {
                    items: [
                        {
                            board_id: 501,
                            title: "신고 게시글 샘플",
                            board_creator: "신고 대상자",
                            hidden_yn: false,
                        },
                    ],
                },
            },
        };
    }

    if (method === "PATCH" && pathname === "/api/admin/moderation/boards/batch") {
        return {
            status: 200,
            body: {
                data: {
                    total_requested: 1,
                    processed_count: 1,
                    failed_ids: [],
                },
            },
        };
    }

    if (method === "GET" && pathname === "/api/admin/banners") {
        return {
            status: 200,
            body: {
                data: {
                    items: [
                        {
                            banner_id: 31,
                            banner_type: "NOTICE",
                            placement: "HOME_HERO",
                            title: "운영 공지 배너",
                            description: "관리자 운영 스모크용 배너입니다.",
                            render_mode: "CONTENT",
                            priority: 100,
                            target_audience: "ALL",
                            active_yn: true,
                        },
                    ],
                },
            },
        };
    }

    if (method === "POST" && pathname === "/api/admin/banners") {
        return {
            status: 201,
            body: {
                data: {
                    banner_id: 32,
                    banner_type: "NOTICE",
                    placement: "HOME_HERO",
                    title: "운영 배너",
                    render_mode: "CONTENT",
                    target_audience: "ALL",
                    active_yn: true,
                },
            },
        };
    }

    if (method === "PATCH" && pathname === "/api/admin/banners/31/active") {
        return {
            status: 200,
            body: {
                data: {
                    banner_id: 31,
                    banner_type: "NOTICE",
                    title: "운영 공지 배너",
                    render_mode: "CONTENT",
                    target_audience: "ALL",
                    active_yn: false,
                },
            },
        };
    }

    if (method === "DELETE" && pathname === "/api/admin/banners/31") {
        return { status: 204, bodyText: "" };
    }

    if (method === "GET" && pathname === "/api/members/list") {
        return {
            status: 200,
            body: {
                data: {
                    items: [
                        {
                            member_id: 77,
                            name: "홍길동",
                            email: "hong@example.com",
                        },
                    ],
                },
            },
        };
    }

    if (method === "GET" && pathname === "/api/admin/members/77") {
        return {
            status: 200,
            body: {
                data: {
                    member_info: {
                        member_id: 77,
                        email: "hong@example.com",
                        name: "홍길동",
                        roles: ["ROLE_USER"],
                        member_status: "MEMBER_ACTIVE",
                        point: 120,
                        board_count: 2,
                        comment_count: 5,
                    },
                    recent_boards: [
                        { board_id: 501, title: "최근 게시글", hidden_yn: false },
                    ],
                    recent_comments: [
                        { comment_id: 701, contents: "최근 댓글", hidden_yn: true },
                    ],
                    sanctions: [
                        { sanction_id: 1, sanction_status: "ACTIVE" },
                    ],
                    received_reports: [
                        { report_id: 9, report_status: "PENDING" },
                    ],
                    made_reports: [],
                },
            },
        };
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
        bodyText: document.body?.innerText?.slice(0, 600) || "",
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

async function clickButtonByText(cdp, sessionId, text, scope = "document") {
    const ok = await evaluate(cdp, sessionId, `(() => {
        const root = ${scope};
        const button = Array.from(root.querySelectorAll("button"))
            .find((node) => node.textContent.includes(${JSON.stringify(text)}) && !node.disabled);
        if (!button) return false;
        button.scrollIntoView({ block: "center", inline: "center" });
        button.click();
        return true;
    })()`);
    if (!ok) throw new Error(`Could not click button: ${text}`);
}

async function clickModerationCheckbox(cdp, sessionId, title) {
    const ok = await evaluate(cdp, sessionId, `(() => {
        const label = Array.from(document.querySelectorAll("label"))
            .find((node) => node.textContent.includes(${JSON.stringify(title)}));
        const checkbox = label?.querySelector("input[type='checkbox']");
        if (!checkbox || checkbox.disabled) return false;
        checkbox.click();
        return true;
    })()`);
    if (!ok) throw new Error(`Could not select moderation item: ${title}`);
}

async function clickText(cdp, sessionId, text) {
    const ok = await evaluate(cdp, sessionId, `(() => {
        const target = Array.from(document.querySelectorAll("button,a,label"))
            .find((node) => node.textContent.includes(${JSON.stringify(text)}));
        if (!target) return false;
        target.scrollIntoView({ block: "center", inline: "center" });
        target.click();
        return true;
    })()`);
    if (!ok) throw new Error(`Could not click text: ${text}`);
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

async function inspectAdminOperations(cdp, sessionId, viewport) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.deviceScaleFactor || (viewport.mobile ? 2 : 1),
        mobile: viewport.mobile,
    }, sessionId);

    await cdp.send("Page.navigate", { url: `${baseUrl}/app/admin/operations` }, sessionId);
    await waitForText(cdp, sessionId, "관리자 운영 도구");
    await waitForText(cdp, sessionId, "콘텐츠 일괄 검토");
    await waitForText(cdp, sessionId, "회원 360 상세");
    await waitForText(cdp, sessionId, "배너 관리");
    await waitForText(cdp, sessionId, "신고 게시글 샘플");
    await waitForText(cdp, sessionId, "운영 공지 배너");
    await waitForText(cdp, sessionId, "공지 | 콘텐츠 | 전체");

    if (viewport.interactive) {
        await clickModerationCheckbox(cdp, sessionId, "신고 게시글 샘플");
        await clickButtonByText(cdp, sessionId, "선택 숨김");
        await waitForText(cdp, sessionId, "선택 항목을 숨김 처리했습니다.");
        await waitForText(cdp, sessionId, "처리됨");

        await setInputValue(cdp, sessionId, "input[placeholder='이름 또는 이메일로 회원 검색']", "홍길");
        await waitForText(cdp, sessionId, "홍길동 (hong@example.com)");
        await clickText(cdp, sessionId, "홍길동 (hong@example.com)");
        await waitForText(cdp, sessionId, "기본 정보");
        await waitForText(cdp, sessionId, "hong@example.com");
        await waitForText(cdp, sessionId, "활성");
        await waitForText(cdp, sessionId, "진행 중");
        await waitForText(cdp, sessionId, "대기");

        await setInputValue(cdp, sessionId, "input[placeholder='배너 제목']", "운영 배너");
        await clickButtonByText(cdp, sessionId, "배너 생성");
        await waitForText(cdp, sessionId, "배너를 생성했습니다.");

        await clickButtonByText(cdp, sessionId, "비활성화");
        await waitForText(cdp, sessionId, "배너를 비활성화했습니다.");

        await clickButtonByText(cdp, sessionId, "삭제");
        await waitForText(cdp, sessionId, "배너를 삭제할까요?");
        await clickButtonByText(cdp, sessionId, "삭제", "document.querySelector(\"[role='alertdialog']\")");
        await waitForText(cdp, sessionId, "배너를 삭제했습니다.");
    }

    await assertPageQuality(cdp, sessionId, `admin operations ${viewport.name}`);
    return `admin operations ${viewport.name}: ok`;
}

async function main() {
    assertStaticToastRuntimeSplit();
    assertStaticMemberSearchBounds();
    assertStaticMemberDetailStableIds();
    assertStaticBannerFormBounds();
    assertStaticModerationBounds();
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
        if (!targetId) throw new Error("Could not create Chrome target for admin operations smoke test.");
        const attachResponse = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
        sessionId = attachResponse.result?.sessionId;
        if (!sessionId) throw new Error("Could not attach to Chrome target for admin operations smoke test.");

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
                localStorage.setItem("accessToken", "smoke-admin-access-token");
                localStorage.setItem("refreshToken", "smoke-admin-refresh-token");
                localStorage.setItem("userRoles", JSON.stringify(["ROLE_ADMIN"]));
            `,
        }, sessionId);

        const results = [];
        for (const viewport of viewports) {
            results.push(await inspectAdminOperations(cdp, sessionId, viewport));
        }
        if (runtimeErrors.length) {
            throw new Error(`Runtime errors: ${runtimeErrors.join(" | ")}`);
        }
        results.forEach((result) => console.log(result));
        console.log(`admin-operations-ui-smoke ok (${results.length} responsive checks)`);
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
