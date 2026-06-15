import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createPipeSession } from "./pipe-websocket-cdp.mjs";

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost";
const smokeAccessToken = process.env.SMOKE_ACCESS_TOKEN || "runtime-smoke-access-token";
const useSyntheticMember = !process.env.SMOKE_ACCESS_TOKEN;
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
const userDataDir = mkdtempSync(path.join(tmpdir(), "home-runtime-smoke-"));
const viewports = [
    { name: "desktop", width: 1366, height: 900, mobile: false },
    { name: "galaxy-s26", width: 360, height: 780, mobile: true, deviceScaleFactor: 3 },
];
const localHosts = new Set(["localhost", "127.0.0.1"]);
const replacementChar = String.fromCharCode(0xfffd);
const mojibakeLeadCharCodes = new Set([0x00ec, 0x00eb, 0x00ed]);

let nextMessageId = 1;
const pending = new Map();
const apiResponses = [];
const failedLocalRequests = [];
const runtimeErrors = [];
const requestUrls = new Map();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function encodeBody(value) {
    return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

function send(ws, method, params = {}, timeoutMs = 10000) {
    const id = nextMessageId++;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            pending.delete(id);
            reject(new Error(`${method}: timed out waiting for Chrome DevTools response`));
        }, timeoutMs);
        pending.set(id, { resolve, reject, method, timeoutId });
    });
}

async function evaluate(ws, expression, { awaitPromise = false } = {}) {
    const response = await send(ws, "Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise,
    });
    if (response.result?.exceptionDetails) {
        throw new Error(response.result.exceptionDetails.text || "Runtime evaluation failed");
    }
    return response.result?.result?.value;
}

async function waitForExpression(ws, expression, timeoutMs = 10000) {
    const started = Date.now();
    let lastValue;
    while (Date.now() - started < timeoutMs) {
        lastValue = await evaluate(ws, expression);
        if (lastValue) return lastValue;
        await delay(120);
    }
    throw new Error(`Timed out waiting for expression: ${expression}. Last value: ${JSON.stringify(lastValue)}`);
}

function hasTextCorruption(value) {
    const text = String(value || "");
    if (text.includes(replacementChar)) return true;
    for (let index = 0; index < text.length - 1; index += 1) {
        if (mojibakeLeadCharCodes.has(text.charCodeAt(index)) && text.charCodeAt(index + 1) >= 0x80) {
            return true;
        }
    }
    return false;
}

async function fetchJson(pathname) {
    const response = await fetch(`${baseUrl}${pathname}`);
    const text = await response.text();
    if (!response.ok) {
        throw new Error(`${pathname} returned ${response.status}: ${text.slice(0, 160)}`);
    }
    if (hasTextCorruption(text)) {
        throw new Error(`${pathname} response contains mojibake or replacement characters`);
    }
    return JSON.parse(text);
}

async function assertRuntimeApiReady() {
    const dashboard = await fetchJson("/api/stats/dashboard");
    const dashboardData = dashboard?.data || {};
    if (!dashboardData.summary || !dashboardData.visitors_compare) {
        throw new Error("runtime stats dashboard response is missing summary or visitors_compare");
    }

    const latestBoards = await fetchJson("/api/boards/latest?kind=FREE_BOARD&kind=ADMIN_NOTICE&page=0&size=6");
    if (!Array.isArray(latestBoards)) {
        throw new Error("runtime latest boards response is not an array");
    }

    const banners = await fetchJson("/api/banners?placement=HOME_HERO&target=USER&limit=10");
    if (!Array.isArray(banners?.data?.items)) {
        throw new Error("runtime banners response is missing data.items array");
    }
}

function isImportantLocalRequest(url) {
    try {
        const parsed = new URL(url);
        if (!localHosts.has(parsed.hostname)) return false;
        if (parsed.pathname === "/favicon.ico") return false;
        if (parsed.pathname === "/api/banners/events") return false;
        return parsed.pathname.startsWith("/api/") ||
            parsed.pathname.startsWith("/assets/") ||
            parsed.pathname === "/app" ||
            parsed.pathname === "/";
    } catch {
        return false;
    }
}

function trackNetworkEvent(message) {
    if (message.method === "Network.requestWillBeSent") {
        const requestId = message.params?.requestId;
        const url = message.params?.request?.url;
        if (requestId && isImportantLocalRequest(url)) {
            requestUrls.set(requestId, url);
        }
        return;
    }

    if (message.method === "Network.responseReceived") {
        const response = message.params?.response;
        if (!response?.url || !isImportantLocalRequest(response.url)) return;
        apiResponses.push({ url: response.url, status: response.status });
        return;
    }

    if (message.method === "Network.loadingFailed") {
        const requestId = message.params?.requestId;
        const url = requestUrls.get(requestId);
        requestUrls.delete(requestId);
        if (url) {
            failedLocalRequests.push({ url, requestId, errorText: message.params?.errorText || "unknown" });
        }
        return;
    }

    if (message.method === "Network.loadingFinished") {
        requestUrls.delete(message.params?.requestId);
    }
}

async function handleFetchRequest(ws, message) {
    const params = message.params || {};
    const request = params.request || {};
    const requestId = params.requestId;
    let parsed;

    try {
        parsed = new URL(request.url);
    } catch {
        await send(ws, "Fetch.continueRequest", { requestId });
        return;
    }

    if (useSyntheticMember && request.method === "GET" && parsed.pathname === "/api/members") {
        await send(ws, "Fetch.fulfillRequest", {
            requestId,
            responseCode: 200,
            responseHeaders: [
                { name: "Content-Type", value: "application/json; charset=utf-8" },
                { name: "Cache-Control", value: "no-store" },
            ],
            body: encodeBody({
                data: {
                    member_id: 999,
                    memberId: 999,
                    email: "runtime-smoke@example.test",
                    name: "런타임 검증 사용자",
                    roles: ["ROLE_USER"],
                },
            }),
        });
        return;
    }

    if (useSyntheticMember && parsed.pathname.startsWith("/api/")) {
        const headers = Object.entries(request.headers || {})
            .filter(([name]) => name.toLowerCase() !== "authorization")
            .map(([name, value]) => ({ name, value: String(value) }));
        await send(ws, "Fetch.continueRequest", { requestId, headers });
        return;
    }

    await send(ws, "Fetch.continueRequest", { requestId });
}

async function inspectHomeRuntime(ws, viewport) {
    await send(ws, "Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.deviceScaleFactor ?? (viewport.mobile ? 2 : 1),
        mobile: viewport.mobile,
    });
    await send(ws, "Page.navigate", { url: `${baseUrl}/app` });

    await waitForExpression(ws, `document.body && (document.body.innerText || "").includes("오늘 방문자")`, 12000);
    await waitForExpression(ws, `(document.body?.innerText || "").includes("주요 서비스")`, 12000);
    await waitForExpression(ws, `(document.body?.innerText || "").includes("최신 게시글")`, 12000);
    await waitForExpression(ws, `document.querySelector('[aria-label="홈 통계 요약"]')?.getAttribute("aria-busy") === "false"`, 12000);
    await waitForExpression(ws, `document.querySelector('[aria-labelledby="home-boards-heading"]')?.getAttribute("aria-busy") === "false"`, 12000);

    const state = await evaluate(ws, `(() => {
        const text = document.body?.innerText || "";
        const documentElement = document.documentElement;
        const unsafeLinks = Array.from(document.querySelectorAll("a"))
            .map((node) => node.getAttribute("href") || "")
            .filter((href) => /^(javascript|data|vbscript):/i.test(href) || href.startsWith("//"));
        return {
            url: location.href,
            clientWidth: documentElement.clientWidth,
            scrollWidth: documentElement.scrollWidth,
            hasReplacement: text.includes(String.fromCharCode(0xfffd)),
            hasMojibake: (() => {
                const leadCodes = new Set([0x00ec, 0x00eb, 0x00ed]);
                for (let index = 0; index < text.length - 1; index += 1) {
                    if (leadCodes.has(text.charCodeAt(index)) && text.charCodeAt(index + 1) >= 0x80) return true;
                }
                return false;
            })(),
            hasGlobalError: text.includes("데이터를 불러오는 중 문제가 발생했습니다."),
            hasStatsDelay: text.includes("통계 연결이 지연되고 있습니다."),
            hasBoardsDelay: text.includes("최신 게시글 연결이 지연되고 있습니다."),
            hasBannerDelay: text.includes("운영 배너 연결이 지연되고 있습니다."),
            hasInvestKorean: text.includes("투자 분석"),
            hasInvestEnglish: Array.from(document.querySelectorAll("a")).some((node) => (node.innerText || "").trim() === "Invest"),
            quickMenuLabel: Boolean(document.querySelector('[aria-labelledby="home-quick-menu-heading"]')),
            boardsLabel: Boolean(document.querySelector('[aria-labelledby="home-boards-heading"]')),
            latestAllLabel: Boolean(document.querySelector('a[aria-label="최신 게시글 전체보기"]')),
            unsafeLinks,
        };
    })()`);

    if (state.scrollWidth > state.clientWidth + 1) {
        throw new Error(`home runtime ${viewport.name}: horizontal overflow ${state.clientWidth}/${state.scrollWidth}`);
    }
    if (state.hasReplacement || state.hasMojibake) {
        throw new Error(`home runtime ${viewport.name}: visible text contains encoding corruption`);
    }
    if (state.hasGlobalError || state.hasStatsDelay || state.hasBoardsDelay || state.hasBannerDelay) {
        throw new Error(`home runtime ${viewport.name}: delayed/error state is visible ${JSON.stringify(state)}`);
    }
    if (!state.hasInvestKorean || state.hasInvestEnglish) {
        throw new Error(`home runtime ${viewport.name}: quick menu is not Korean-first ${JSON.stringify(state)}`);
    }
    if (!state.quickMenuLabel || !state.boardsLabel || !state.latestAllLabel) {
        throw new Error(`home runtime ${viewport.name}: accessible section/link labels missing ${JSON.stringify(state)}`);
    }
    if (state.unsafeLinks.length) {
        throw new Error(`home runtime ${viewport.name}: unsafe links rendered ${JSON.stringify(state.unsafeLinks)}`);
    }

    return `home runtime ${viewport.name}: ok ${state.clientWidth}/${state.scrollWidth}`;
}

async function main() {
    await assertRuntimeApiReady();

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
        const ws = await createPipeSession(chrome, { debug, testName: "home-runtime-smoke" });
        ws.addEventListener("message", (event) => {
            const message = JSON.parse(event.data);
            if (message.id && pending.has(message.id)) {
                const waiter = pending.get(message.id);
                pending.delete(message.id);
                clearTimeout(waiter.timeoutId);
                if (message.error) {
                    waiter.reject(new Error(`${waiter.method}: ${message.error.message}`));
                } else {
                    waiter.resolve(message);
                }
                return;
            }
            if (message.method === "Runtime.exceptionThrown") {
                runtimeErrors.push(message.params?.exceptionDetails?.text || "Runtime exception");
            } else if (message.method === "Fetch.requestPaused") {
                handleFetchRequest(ws, message).catch((error) => {
                    runtimeErrors.push(`Fetch handler failed: ${error.message}`);
                });
            } else {
                trackNetworkEvent(message);
            }
        });

        await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
        await send(ws, "Page.enable");
        await send(ws, "Runtime.enable");
        await send(ws, "Network.enable");
        if (useSyntheticMember) {
            await send(ws, "Fetch.enable", {
                patterns: [
                    { urlPattern: "*://localhost*/api/*", requestStage: "Request" },
                    { urlPattern: "*://127.0.0.1*/api/*", requestStage: "Request" },
                ],
            });
        }
        await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
            source: `
                try {
                    localStorage.setItem("accessToken", ${JSON.stringify(smokeAccessToken)});
                    localStorage.setItem("userRoles", JSON.stringify(["ROLE_USER"]));
                    localStorage.removeItem("refreshToken");
                    localStorage.removeItem("ads_personalization_consent");
                    Object.keys(sessionStorage).forEach((key) => {
                        if (key.startsWith("home_banner_impression:")) sessionStorage.removeItem(key);
                    });
                } catch {}
            `,
        });

        const results = [];
        for (const viewport of viewports) {
            results.push(await inspectHomeRuntime(ws, viewport));
        }

        const badApiResponses = apiResponses.filter((response) => {
            try {
                const parsed = new URL(response.url);
                if (parsed.pathname === "/api/banners/events") return false;
                return parsed.pathname.startsWith("/api/") && response.status >= 400;
            } catch {
                return false;
            }
        });
        if (badApiResponses.length) {
            throw new Error(`home runtime API responses failed: ${JSON.stringify(badApiResponses.slice(0, 8))}`);
        }
        if (failedLocalRequests.length) {
            throw new Error(`home runtime local requests failed: ${JSON.stringify(failedLocalRequests.slice(0, 8))}`);
        }
        if (runtimeErrors.length) {
            throw new Error(`home runtime errors: ${runtimeErrors.join(" | ")}`);
        }

        results.forEach((result) => console.log(result));
        console.log(`home-runtime-smoke ok (${results.length} real runtime checks)`);
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
