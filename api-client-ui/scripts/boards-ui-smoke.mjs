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

const debug = process.env.SMOKE_DEBUG === "1";
const userDataDir = mkdtempSync(path.join(tmpdir(), "boards-ui-smoke-"));
const viewports = [
    { name: "desktop", width: 1366, height: 900, mobile: false },
    { name: "mobile", width: 390, height: 844, mobile: true },
];
const blockedTexts = ["Board", "Loading", "Error", "undefined", "NaN"];
const dangerousDetailHtml = `
    <p>안전한 본문</p>
    <img src="x" onerror="window.__boardXssFired='img'">
    <script>window.__boardXssFired='script'</script>
    <a href="javascript:window.__boardXssFired='link'">위험 링크</a>
    <iframe srcdoc="<script>window.__boardXssFired='iframe'</script>"></iframe>
`;

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

const boardRows = {
    FREE_BOARD: [
        {
            board_id: 501,
            title: "나무 심기 후기 공유",
            contents: "<p>주말에 함께 심은 나무 관리 경험을 공유합니다.</p>",
            board_creator: "초록회원",
            created_at: "2026-05-30T09:00:00",
            view_count: 183,
            like_count: 27,
            kind_of_board: "FREE_BOARD",
        },
        {
            board_id: 502,
            title: "동네 줍기 모임 안내",
            contents: "<p>토요일 오전 하천 주변 정리 모임을 엽니다.</p>",
            board_creator: "실천회원",
            created_at: "2026-05-29T13:20:00",
            view_count: 141,
            like_count: 19,
            kind_of_board: "FREE_BOARD",
        },
    ],
    ADMIN_NOTICE: [
        {
            board_id: 701,
            title: "운영 점검 공지",
            contents: "<p>새벽 시간대 짧은 점검이 예정되어 있습니다.</p>",
            board_creator: "관리자",
            created_at: "2026-05-31T07:00:00",
            view_count: 920,
            like_count: 52,
            kind_of_board: "ADMIN_NOTICE",
            is_notice: true,
        },
    ],
};

function routeMock(url, method) {
    const parsedUrl = new URL(url);
    const { hostname, pathname, searchParams } = parsedUrl;

    if (method === "GET" && hostname === "oapi.map.naver.com") {
        return { status: 200, contentType: "application/javascript; charset=utf-8", bodyText: "" };
    }

    if (method === "GET" && pathname === "/api/members") {
        return {
            status: 200,
            body: {
                data: {
                    member_id: 100,
                    name: "게시판 검증자",
                    roles: ["ROLE_USER"],
                },
            },
        };
    }

    if (method === "GET" && pathname === "/api/chat/rooms") {
        return { status: 200, body: { data: [] } };
    }

    if (method === "GET" && pathname === "/api/boards") {
        const kind = searchParams.get("kind") || "FREE_BOARD";
        const rows = boardRows[kind] || [];
        return {
            status: 200,
            headers: [
                { name: "X-Total-Count", value: String(rows.length) },
                { name: "X-Total-Pages", value: "1" },
                { name: "X-Page-Number", value: "1" },
                { name: "X-Page-Size", value: searchParams.get("size") || "10" },
            ],
            body: rows,
        };
    }

    if (method === "GET" && pathname === "/api/boards/501") {
        return {
            status: 200,
            body: {
                board_id: 501,
                title: "나무 심기 후기 공유",
                contents: dangerousDetailHtml,
                board_creator: "게시판 검증자",
                created_at: "2026-05-30T09:00:00",
                view_count: 183,
                like_count: 27,
                kind_of_board: "FREE_BOARD",
                member: {
                    member_id: 100,
                    name: "게시판 검증자",
                },
                upload_dto: [
                    {
                        file_id: 9101,
                        file_name: "활동사진.jpg",
                    },
                ],
            },
        };
    }

    if (method === "GET" && pathname === "/api/comments") {
        return {
            status: 200,
            body: {
                data: [],
                page_info: {
                    page: Number(searchParams.get("page") || 1),
                    size: Number(searchParams.get("size") || 20),
                    total_elements: 0,
                    total_pages: 1,
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

async function waitForText(cdp, sessionId, text, timeoutMs = 7000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (await evaluate(cdp, sessionId, `document.body?.innerText.includes(${JSON.stringify(text)})`)) return;
        await delay(120);
    }
    const pageState = await evaluate(cdp, sessionId, `(() => ({
        href: location.href,
        readyState: document.readyState,
        bodyText: document.body?.innerText?.slice(0, 300) || "",
    }))()`).catch(() => null);
    throw new Error(`Timed out waiting for text: ${text}${pageState ? `; page: ${JSON.stringify(pageState)}` : ""}`);
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

async function inspectBoards(cdp, sessionId, viewport) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.mobile ? 2 : 1,
        mobile: viewport.mobile,
    }, sessionId);

    const navigation = await cdp.send("Page.navigate", { url: `${baseUrl}/app/boards/FREE_BOARD` }, sessionId);
    if (navigation.result?.errorText) {
        throw new Error(`boards ${viewport.name}: navigation failed ${navigation.result.errorText}`);
    }

    await waitForText(cdp, sessionId, "사용자게시판");
    await waitForText(cdp, sessionId, "운영 점검 공지");
    await waitForText(cdp, sessionId, "나무 심기 후기 공유");
    await clickByText(cdp, sessionId, "일반");
    await waitForText(cdp, sessionId, "동네 줍기 모임 안내");
    await delay(400);

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
            text,
            clientWidth: root.clientWidth,
            scrollWidth: root.scrollWidth,
            bodyWidth: body ? body.scrollWidth : 0,
            overflowNodes,
        };
    })()`);

    for (const text of ["사용자게시판", "나무 심기 후기 공유", "동네 줍기 모임 안내"]) {
        if (!value.text.includes(text)) {
            throw new Error(`boards ${viewport.name}: missing text ${text}`);
        }
    }

    const blocked = blockedTexts.filter((text) => value.text.includes(text));
    if (blocked.length) {
        throw new Error(`boards ${viewport.name}: blocked text ${blocked.join(", ")}`);
    }

    const overflow = Math.max(value.scrollWidth, value.bodyWidth) - value.clientWidth;
    if (overflow > 3) {
        throw new Error(`boards ${viewport.name}: horizontal overflow ${overflow}px ${JSON.stringify(value.overflowNodes)}`);
    }

    return `boards ${viewport.name}: ok ${value.clientWidth}/${value.scrollWidth}`;
}

async function inspectBoardDetailSanitizer(cdp, sessionId) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: 1366,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
    }, sessionId);

    await evaluate(cdp, sessionId, "window.__boardXssFired = false");
    const navigation = await cdp.send("Page.navigate", { url: `${baseUrl}/app/boards/FREE_BOARD/501` }, sessionId);
    if (navigation.result?.errorText) {
        throw new Error(`boards detail sanitizer: navigation failed ${navigation.result.errorText}`);
    }

    await waitForText(cdp, sessionId, "안전한 본문");
    await waitForText(cdp, sessionId, "첨부파일 (1)");
    await delay(500);

    const safety = await evaluate(cdp, sessionId, `(() => {
        const root = document.querySelector(".board-contents");
        if (!root) return { missingRoot: true };
        const eventAttrNode = Array.from(root.querySelectorAll("*"))
            .find((node) => Array.from(node.attributes).some((attr) => attr.name.toLowerCase().startsWith("on")));
        return {
            missingRoot: false,
            xssFired: window.__boardXssFired || false,
            hasBlockedNode: Boolean(root.querySelector("script,style,iframe,object,embed,svg,math")),
            hasEventAttr: Boolean(eventAttrNode),
            hasJavascriptHref: Boolean(root.querySelector("a[href^='javascript:' i]")),
            hasUnsafeDataImage: Boolean(root.querySelector("img[src^='data:' i]")),
            text: root.innerText,
        };
    })()`);

    if (safety.missingRoot) {
        throw new Error("boards detail sanitizer: content root not found");
    }
    if (safety.xssFired || safety.hasBlockedNode || safety.hasEventAttr || safety.hasJavascriptHref || safety.hasUnsafeDataImage) {
        throw new Error(`boards detail sanitizer failed: ${JSON.stringify(safety)}`);
    }
    if (!safety.text.includes("안전한 본문") || !safety.text.includes("위험 링크")) {
        throw new Error(`boards detail sanitizer: sanitized text missing ${JSON.stringify(safety)}`);
    }

    const commentControls = await evaluate(cdp, sessionId, `(() => {
        const textarea = Array.from(document.querySelectorAll("textarea"))
            .find((node) => (node.placeholder || "").includes("댓글"));
        return {
            hasTextarea: Boolean(textarea),
            maxLength: textarea ? textarea.maxLength : null,
            hasCounter: document.body?.innerText?.includes("0 / 2,000") || false,
        };
    })()`);

    if (!commentControls.hasTextarea || commentControls.maxLength !== 2000 || !commentControls.hasCounter) {
        throw new Error(`boards detail comment controls failed: ${JSON.stringify(commentControls)}`);
    }

    await clickByText(cdp, sessionId, "게시글 신고");
    await waitForText(cdp, sessionId, "운영자가 검토할 내용을 입력해 주세요.");
    const reportDialog = await evaluate(cdp, sessionId, `(() => {
        const reasonInput = Array.from(document.querySelectorAll("input"))
            .find((node) => (node.placeholder || "").includes("신고 사유"));
        const detailTextarea = Array.from(document.querySelectorAll("textarea"))
            .find((node) => (node.placeholder || "").includes("구체적인 내용"));
        const text = document.body?.innerText || "";
        return {
            hasReasonInput: Boolean(reasonInput),
            reasonMaxLength: reasonInput ? reasonInput.maxLength : null,
            detailMaxLength: detailTextarea ? detailTextarea.maxLength : null,
            hasReasonCounter: reasonInput ? text.includes(\`\${reasonInput.value.length} / 120\`) : false,
            hasDetailCounter: text.includes("0 / 2,000"),
        };
    })()`);

    if (
        !reportDialog.hasReasonInput ||
        reportDialog.reasonMaxLength !== 120 ||
        reportDialog.detailMaxLength !== 2000 ||
        !reportDialog.hasReasonCounter ||
        !reportDialog.hasDetailCounter
    ) {
        throw new Error(`boards detail report dialog controls failed: ${JSON.stringify(reportDialog)}`);
    }

    return "boards detail sanitizer: ok";
}

async function main() {
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
        if (!targetId) throw new Error("Could not create Chrome target for boards smoke test.");
        const attachResponse = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
        sessionId = attachResponse.result?.sessionId;
        if (!sessionId) throw new Error("Could not attach to Chrome target for boards smoke test.");

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
            `,
        }, sessionId);

        const results = [];
        for (const viewport of viewports) {
            results.push(await inspectBoards(cdp, sessionId, viewport));
        }
        results.push(await inspectBoardDetailSanitizer(cdp, sessionId));
        if (runtimeErrors.length) {
            throw new Error(`Runtime errors: ${runtimeErrors.join(" | ")}`);
        }
        results.forEach((result) => console.log(result));
        console.log(`boards-ui-smoke ok (${results.length} responsive checks)`);
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
