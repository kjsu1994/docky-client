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

const budgets = {
    readyMs: Number(process.env.SMOKE_AUTH_READY_MS || 4000),
    scriptStyleTransferKb: Number(process.env.SMOKE_AUTH_JS_CSS_KB || 130),
};
const debug = process.env.SMOKE_DEBUG === "1";
const userDataDir = mkdtempSync(path.join(tmpdir(), "auth-performance-smoke-"));
const localHosts = new Set(["localhost", "127.0.0.1"]);
const blockedChunkPatterns = [
    /\/assets\/ProtectedRoutes-[^/]+\.js/i,
    /\/assets\/ProtectedAppLayout-[^/]+\.js/i,
    /\/assets\/Home-[^/]+\.js/i,
    /\/assets\/Board(List|Detail|Form)-[^/]+\.js/i,
    /\/assets\/GamesHub-[^/]+\.js/i,
    /\/assets\/TabletopGame-[^/]+\.js/i,
    /\/assets\/Admin[A-Za-z]+-[^/]+\.js/i,
    /\/assets\/PageGuide(Button|Dialog)-[^/]+\.js/i,
    /\/assets\/pageGuides-[^/]+\.js/i,
    /\/assets\/circle-help-[^/]+\.js/i,
    /\/assets\/useBottomNavVisibility-[^/]+\.js/i,
];

let nextMessageId = 1;
const pending = new Map();
const failedLocalRequests = [];
const runtimeErrors = [];
const localAssetRequests = new Map();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

async function evaluate(ws, expression) {
    const response = await send(ws, "Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
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
        return;
    }

    if (message.method === "Network.loadingFinished") {
        const tracked = localAssetRequests.get(message.params?.requestId);
        if (tracked) {
            tracked.encodedDataLength = Number(message.params?.encodedDataLength || tracked.encodedDataLength || 0);
        }
    }
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
        const ws = await createPipeSession(chrome, { debug, testName: "auth-performance-smoke" });
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
            } else {
                trackNetworkEvent(message);
            }
        });

        await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
        await send(ws, "Page.enable");
        await send(ws, "Runtime.enable");
        await send(ws, "Network.enable");
        await send(ws, "Network.setCacheDisabled", { cacheDisabled: true });
        await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
            source: `
                try {
                    localStorage.removeItem("accessToken");
                    localStorage.removeItem("refreshToken");
                    localStorage.removeItem("userRoles");
                    localStorage.removeItem("postOauthRedirect");
                } catch {}
            `,
        });

        await send(ws, "Emulation.setDeviceMetricsOverride", {
            width: 360,
            height: 780,
            deviceScaleFactor: 3,
            mobile: true,
        });
        await send(ws, "Page.navigate", { url: `${baseUrl}/login` });
        const readyMs = await waitForExpression(ws, `(() => {
            const text = document.body?.innerText || "";
            return location.pathname === "/login" && text.includes("로그인") && Boolean(document.querySelector("form button[type='submit']"));
        })()`);
        await waitForExpression(ws, `performance.getEntriesByType("navigation")[0]?.loadEventEnd > 0`);
        await delay(500);

        const loadedAssets = Array.from(localAssetRequests.values());
        const scriptStyleTransferKb = loadedAssets
            .reduce((sum, request) => sum + Number(request.encodedDataLength || 0), 0) / 1024;
        const blockedAssets = loadedAssets
            .map((request) => request.url)
            .filter((url) => blockedChunkPatterns.some((pattern) => pattern.test(url)));

        assertBudget(readyMs, budgets.readyMs, "auth ready ms");
        assertBudget(scriptStyleTransferKb, budgets.scriptStyleTransferKb, "auth JS/CSS transfer KiB");
        if (blockedAssets.length) {
            throw new Error(`auth performance loaded protected app chunks: ${blockedAssets.join(", ")}`);
        }
        if (failedLocalRequests.length) {
            throw new Error(`auth performance local requests failed: ${JSON.stringify(failedLocalRequests.slice(0, 8))}`);
        }
        if (runtimeErrors.length) {
            throw new Error(`auth performance runtime errors: ${runtimeErrors.join(" | ")}`);
        }

        console.log([
            `ready=${readyMs.toFixed(1)}ms/${budgets.readyMs}ms`,
            `jsCss=${scriptStyleTransferKb.toFixed(1)}KiB/${budgets.scriptStyleTransferKb}KiB`,
            `assets=${loadedAssets.length}`,
        ].join(" "));
        console.log("auth-performance-smoke ok");
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
