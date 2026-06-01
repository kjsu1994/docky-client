import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createPipeSession } from "./pipe-websocket-cdp.mjs";

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost";
const smokeAccessToken = process.env.SMOKE_ACCESS_TOKEN || "home-performance-smoke-access-token";
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

const budgets = {
    domContentLoadedMs: Number(process.env.SMOKE_HOME_DCL_MS || 3000),
    loadMs: Number(process.env.SMOKE_HOME_LOAD_MS || 5000),
    readyMs: Number(process.env.SMOKE_HOME_READY_MS || 6000),
    scriptStyleTransferKb: Number(process.env.SMOKE_HOME_JS_CSS_KB || 500),
};
const debug = process.env.SMOKE_DEBUG === "1";
const userDataDir = mkdtempSync(path.join(tmpdir(), "home-performance-smoke-"));
const localHosts = new Set(["localhost", "127.0.0.1"]);

let nextMessageId = 1;
const pending = new Map();
const failedLocalRequests = [];
const runtimeErrors = [];
const localAssetRequests = new Map();

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

async function waitForExpression(ws, expression, timeoutMs = budgets.readyMs) {
    const started = Date.now();
    let lastValue;
    while (Date.now() - started < timeoutMs) {
        lastValue = await evaluate(ws, expression);
        if (lastValue) {
            return Date.now() - started;
        }
        await delay(120);
    }
    throw new Error(`Timed out waiting for expression: ${expression}. Last value: ${JSON.stringify(lastValue)}`);
}

function isLocalUrl(url) {
    try {
        return localHosts.has(new URL(url).hostname);
    } catch {
        return false;
    }
}

function isTrackedAsset(response, resourceType) {
    if (!response?.url || !isLocalUrl(response.url)) return false;
    if (!response.url.includes("/assets/")) return false;
    return resourceType === "Script" || resourceType === "Stylesheet";
}

function trackNetworkEvent(message) {
    if (message.method === "Network.responseReceived") {
        const params = message.params || {};
        if (isTrackedAsset(params.response, params.type)) {
            localAssetRequests.set(params.requestId, {
                url: params.response.url,
                type: params.type,
                encodedDataLength: Number(params.response.encodedDataLength || 0),
            });
        }
        return;
    }

    if (message.method === "Network.loadingFailed") {
        const requestId = message.params?.requestId;
        const tracked = localAssetRequests.get(requestId);
        if (tracked) {
            failedLocalRequests.push({ url: tracked.url, errorText: message.params?.errorText || "unknown" });
        }
        localAssetRequests.delete(requestId);
        return;
    }

    if (message.method === "Network.loadingFinished") {
        const tracked = localAssetRequests.get(message.params?.requestId);
        if (tracked) {
            tracked.encodedDataLength = Number(message.params?.encodedDataLength || tracked.encodedDataLength || 0);
        }
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
                    email: "home-performance-smoke@example.test",
                    name: "Home Performance Smoke",
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

function assertBudget(value, budget, label) {
    if (!Number.isFinite(value) || value < 0) {
        throw new Error(`${label} produced an invalid measurement: ${value}`);
    }
    if (value > budget) {
        throw new Error(`${label} exceeded budget: ${value.toFixed(1)} > ${budget}`);
    }
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

    try {
        const ws = await createPipeSession(chrome, { debug, testName: "home-performance-smoke" });
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
        await send(ws, "Network.setCacheDisabled", { cacheDisabled: true });
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

        await send(ws, "Emulation.setDeviceMetricsOverride", {
            width: 1366,
            height: 900,
            deviceScaleFactor: 1,
            mobile: false,
        });
        await send(ws, "Page.navigate", { url: `${baseUrl}/app` });
        const readyMs = await waitForExpression(ws, `(() => {
            const busySections = Array.from(document.querySelectorAll("section[aria-busy]"));
            const allBusySectionsReady = busySections.length >= 3 && busySections.every((node) => node.getAttribute("aria-busy") === "false");
            const boardsReady = document.querySelector('[aria-labelledby="home-boards-heading"]')?.getAttribute("aria-busy") === "false";
            const quickMenuReady = Boolean(document.querySelector('[aria-labelledby="home-quick-menu-heading"]'));
            return allBusySectionsReady && boardsReady && quickMenuReady;
        })()`);
        await waitForExpression(ws, `performance.getEntriesByType("navigation")[0]?.loadEventEnd > 0`, budgets.loadMs);
        await delay(500);

        const timing = await evaluate(ws, `(() => {
            const navigation = performance.getEntriesByType("navigation")[0];
            return {
                domContentLoadedMs: Number(navigation?.domContentLoadedEventEnd || 0),
                loadMs: Number(navigation?.loadEventEnd || 0),
            };
        })()`);
        const domContentLoadedMs = timing.domContentLoadedMs;
        const loadMs = timing.loadMs;
        const scriptStyleTransferKb = Array.from(localAssetRequests.values())
            .reduce((sum, request) => sum + Number(request.encodedDataLength || 0), 0) / 1024;

        assertBudget(domContentLoadedMs, budgets.domContentLoadedMs, "home DOMContentLoaded ms");
        assertBudget(loadMs, budgets.loadMs, "home load ms");
        assertBudget(readyMs, budgets.readyMs, "home ready ms");
        assertBudget(scriptStyleTransferKb, budgets.scriptStyleTransferKb, "home JS/CSS transfer KiB");
        if (failedLocalRequests.length) {
            throw new Error(`home performance local requests failed: ${JSON.stringify(failedLocalRequests.slice(0, 8))}`);
        }
        if (runtimeErrors.length) {
            throw new Error(`home performance runtime errors: ${runtimeErrors.join(" | ")}`);
        }

        console.log([
            `dcl=${domContentLoadedMs.toFixed(1)}ms/${budgets.domContentLoadedMs}ms`,
            `load=${loadMs.toFixed(1)}ms/${budgets.loadMs}ms`,
            `ready=${readyMs.toFixed(1)}ms/${budgets.readyMs}ms`,
            `jsCss=${scriptStyleTransferKb.toFixed(1)}KiB/${budgets.scriptStyleTransferKb}KiB`,
        ].join(" "));
        console.log("home-performance-smoke ok");
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
