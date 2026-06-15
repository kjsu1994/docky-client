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
const userDataDir = mkdtempSync(path.join(tmpdir(), "support-ui-smoke-"));
const viewports = [
    { name: "desktop", width: 1366, height: 900, mobile: false },
    { name: "tablet", width: 768, height: 1024, mobile: false },
    { name: "galaxy-s26", width: 360, height: 780, mobile: true, deviceScaleFactor: 3 },
    { name: "short-galaxy-s26", width: 360, height: 740, mobile: true, deviceScaleFactor: 3 },
];
const requiredTexts = [
    "신고/문의 상태",
    "접수한 신고의 처리 상태",
    "새로고침",
    "Q&A",
    "스팸 홍보 신고",
    "운영 답변",
    "1 / 2",
    "총 12건",
    "접수 기록",
];
const blockedTexts = ["Support", "Report Status", "Loading", "Error"];

let nextMessageId = 1;
const pending = new Map();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function assertStaticSupportRuntimeBoundary() {
    const source = readFileSync("src/pages/support/SupportCenter.jsx", "utf8");
    if (source.includes("from \"react-hot-toast\"") || /\btoast\.(success|error|loading|custom|dismiss|remove)\b/.test(source)) {
        throw new Error("support-ui-smoke: SupportCenter must use the dynamic toast helper instead of static react-hot-toast imports.");
    }
    if (!source.includes("notifyError")) {
        throw new Error("support-ui-smoke: SupportCenter must keep failure notifications on the dynamic toast runtime boundary.");
    }
    if (!source.includes('to="/app/boards/QUESTION_ANSWER"')) {
        throw new Error("support-ui-smoke: SupportCenter must keep the Q&A board link.");
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

function routeMock(url, method) {
    const parsed = new URL(url);
    const pathname = parsed.pathname;

    if (method === "GET" && pathname === "/api/members") {
        return {
            status: 200,
            body: {
                data: {
                    member_id: 999,
                    email: "smoke@example.com",
                    name: "검증 사용자",
                    member_status: "MEMBER_ACTIVE",
                    roles: ["ROLE_USER"],
                },
            },
        };
    }
    if (method === "GET" && pathname === "/api/members/notifications/unread-count") {
        return { status: 200, body: { data: { unreadCount: 0 } } };
    }
    if (method === "GET" && pathname === "/api/chat/rooms") {
        return { status: 200, body: { data: [] } };
    }
    if (method === "GET" && pathname === "/api/reports/my") {
        return {
            status: 200,
            body: {
                data: {
                    items: [
                        {
                            report_id: 701,
                            target_type: "BOARD",
                            target_id: 501,
                            reason: "스팸 홍보 신고",
                            detail: "게시글 본문에 반복 홍보 링크가 포함되어 있습니다.",
                            report_status: "RESOLVED",
                            admin_note: "운영 정책에 따라 게시글을 제한했습니다.",
                            handled_at: "2026-06-10T09:00:00+09:00",
                            created_at: "2026-06-09T09:00:00+09:00",
                        },
                    ],
                    page: 1,
                    size: 10,
                    totalElements: 12,
                    totalPages: 2,
                },
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
            { name: "Content-Type", value: "application/json; charset=utf-8" },
            { name: "Cache-Control", value: "no-store" },
        ],
        body: encodeBody(mock.body),
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

async function waitForText(ws, text, timeoutMs = 7000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (await evaluate(ws, `document.body?.innerText.includes(${JSON.stringify(text)})`)) return;
        await delay(120);
    }
    const bodyText = await evaluate(ws, `document.body?.innerText.slice(0, 900) || ""`);
    throw new Error(`Timed out waiting for text: ${text}. Body: ${bodyText}`);
}

async function inspectSupport(ws, viewport) {
    await send(ws, "Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.deviceScaleFactor || (viewport.mobile ? 2 : 1),
        mobile: viewport.mobile,
    });

    await send(ws, "Page.navigate", { url: `${baseUrl}/app/support` });
    for (const text of requiredTexts) {
        await waitForText(ws, text);
    }
    await delay(250);

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
        throw new Error(`support ${viewport.name}: missing text ${missing.join(", ")}`);
    }
    const blocked = blockedTexts.filter((text) => value.text.includes(text));
    if (blocked.length) {
        throw new Error(`support ${viewport.name}: blocked text ${blocked.join(", ")}`);
    }
    const overflow = Math.max(value.scrollWidth, value.bodyWidth) - value.clientWidth;
    if (overflow > 3) {
        throw new Error(`support ${viewport.name}: horizontal overflow ${overflow}px ${JSON.stringify(value.overflowNodes)}`);
    }
    return `support ${viewport.name}: ok ${value.clientWidth}/${value.scrollWidth} ${value.url}`;
}

async function main() {
    assertStaticSupportRuntimeBoundary();

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
        const ws = await createPipeSession(chrome, { debug, testName: "support-ui-smoke" });
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
                handleFetchRequest(ws, message).catch((error) => runtimeErrors.push(error.message));
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
            ],
        });
        await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
            source: `
                localStorage.setItem("accessToken", "smoke-access-token");
                localStorage.setItem("refreshToken", "smoke-refresh-token");
                localStorage.setItem("userRoles", JSON.stringify(["ROLE_USER"]));
            `,
        });

        const results = [];
        for (const viewport of viewports) {
            results.push(await inspectSupport(ws, viewport));
        }
        if (runtimeErrors.length) {
            throw new Error(`Runtime errors: ${runtimeErrors.join(" | ")}`);
        }
        results.forEach((result) => console.log(result));
        console.log(`support-ui-smoke ok (${results.length} responsive checks)`);
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
