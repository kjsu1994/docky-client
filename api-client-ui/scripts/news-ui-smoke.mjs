import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
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
const userDataDir = mkdtempSync(path.join(tmpdir(), "news-ui-smoke-"));
const viewports = [
    { name: "desktop", width: 1366, height: 900, mobile: false },
    { name: "tablet", width: 768, height: 1024, mobile: false },
    { name: "galaxy-s26", width: 360, height: 780, mobile: true, deviceScaleFactor: 3 },
    { name: "short-galaxy-s26", width: 360, height: 740, mobile: true, deviceScaleFactor: 3 },
];
const requiredTexts = ["환경 뉴스", "빠른 검색어", "기후위기", "검색 결과", "읽기", "원문 보기"];
const blockedTexts = ["CLAUDE", "CODEX", "엔트로픽", "Loading", "Error"];
const NEWS_QUERY_MAX_LENGTH = 60;

let nextMessageId = 1;
const pending = new Map();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
                    memberId: 999,
                    member_id: 999,
                    name: "검증 사용자",
                    roles: ["ROLE_USER"],
                },
            },
        };
    }
    if (method === "GET" && pathname === "/api/news") {
        const query = parsed.searchParams.get("query") || "기후위기";
        const itemTitle = query.includes("탄소중립") ? "탄소중립 정책 점검" : "기후위기 대응 뉴스";
        return {
            status: 200,
            body: {
                total: 42,
                start: 1,
                display: 20,
                items: [
                    {
                        title: `<b>${itemTitle}</b>`,
                        description: `${query} 관련 최신 환경 뉴스를 검증합니다.`,
                        link: "https://news.example.com/article",
                        originallink: "https://example.com/article",
                        pubDate: "Mon, 01 Jun 2026 10:00:00 +0900",
                    },
                ],
            },
        };
    }
    if (method === "GET" && pathname === "/api/chat/rooms") {
        return { status: 200, body: { data: [] } };
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
    throw new Error(`Timed out waiting for text: ${text}`);
}

async function inspectNews(ws, viewport) {
    await send(ws, "Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.deviceScaleFactor || (viewport.mobile ? 2 : 1),
        mobile: viewport.mobile,
    });
    await send(ws, "Page.navigate", { url: `${baseUrl}/app/news` });

    for (const text of requiredTexts) {
        await waitForText(ws, text);
    }

    const searchBounds = await evaluate(ws, `(() => {
        const input = document.querySelector('input[type="search"]');
        return {
            hasInput: Boolean(input),
            maxLength: input ? input.maxLength : null,
        };
    })()`);
    if (!searchBounds.hasInput || searchBounds.maxLength !== NEWS_QUERY_MAX_LENGTH) {
        throw new Error(`news ${viewport.name}: search input bounds missing ${JSON.stringify(searchBounds)}`);
    }

    const searched = await evaluate(ws, `(() => {
        const input = document.querySelector('input[type="search"]');
        if (!input) return "missing-input";
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        setter.call(input, "탄소중립");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        const button = Array.from(document.querySelectorAll("button")).find((node) => node.textContent.includes("검색"));
        if (!button) return "missing-button";
        button.click();
        return "clicked";
    })()`);
    if (searched !== "clicked") {
        throw new Error(`news ${viewport.name}: search action failed before request (${searched})`);
    }
    await waitForText(ws, "탄소중립 정책 점검");
    await delay(300);

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

    const missing = [...requiredTexts, "탄소중립 정책 점검"].filter((text) => !value.text.includes(text));
    if (missing.length) {
        throw new Error(`news ${viewport.name}: missing text ${missing.join(", ")}`);
    }

    const blocked = blockedTexts.filter((text) => value.text.includes(text));
    if (blocked.length) {
        throw new Error(`news ${viewport.name}: blocked text ${blocked.join(", ")}`);
    }

    const overflow = Math.max(value.scrollWidth, value.bodyWidth) - value.clientWidth;
    if (overflow > 3) {
        throw new Error(`news ${viewport.name}: horizontal overflow ${overflow}px ${JSON.stringify(value.overflowNodes)}`);
    }

    return `news ${viewport.name}: ok ${value.clientWidth}/${value.scrollWidth} ${value.url}`;
}

async function main() {
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
        const ws = await createPipeSession(chrome, { debug, testName: "news-ui-smoke" });
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
                { urlPattern: "https://oapi.map.naver.com/*", requestStage: "Request" }] });
        await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
            source: `
                localStorage.setItem("accessToken", "smoke-access-token");
                localStorage.setItem("refreshToken", "smoke-refresh-token");
                localStorage.setItem("userRoles", JSON.stringify(["ROLE_USER"]));
            `,
        });

        const results = [];
        for (const viewport of viewports) {
            results.push(await inspectNews(ws, viewport));
        }
        if (runtimeErrors.length) {
            throw new Error(`Runtime errors: ${runtimeErrors.join(" | ")}`);
        }
        results.forEach((result) => console.log(result));
        console.log(`news-ui-smoke ok (${results.length} responsive checks)`);
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


