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
const userDataDir = mkdtempSync(path.join(tmpdir(), "plinko-ui-smoke-"));
const viewports = [
    { name: "desktop", width: 1366, height: 900, mobile: false, interactive: true },
    { name: "mobile", width: 390, height: 844, mobile: true, interactive: false },
];
const blockedTexts = ["Error occurred", "Reroll failed", "Plinko error", "points earned", "ONE PAIR", "TWO PAIR", "FULL HOUSE", "FOUR CARD", "STRAIGHT", "undefined", "NaN"];

function assertPlinkoToastRuntimeBoundary() {
    const source = readFileSync("src/pages/games/LuckyPlinko.jsx", "utf8");
    if (source.includes('from "react-hot-toast"') || !source.includes('from "../../utils/toast.js"')) {
        throw new Error("plinko-ui-smoke: LuckyPlinko must use the dynamic toast helper instead of static react-hot-toast imports.");
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
const encodeJson = (value) => Buffer.from(JSON.stringify(value), "utf8").toString("base64");
const encodeText = (value) => Buffer.from(value, "utf8").toString("base64");

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
                    member_id: 100,
                    email: "player@example.com",
                    name: "검증 플레이어",
                    point: 120,
                    roles: ["ROLE_USER"],
                },
            },
        };
    }

    if (method === "GET" && pathname === "/api/chat/rooms") {
        return { status: 200, body: { data: [] } };
    }

    if (method === "POST" && pathname === "/api/game/dice/roll") {
        return {
            status: 200,
            body: {
                dice: [1, 1, 2, 3, 4],
                rank_name: "ONE PAIR",
                marbles: 1,
                can_reroll: true,
                total_point: 20,
            },
        };
    }

    if (method === "POST" && pathname === "/api/game/plinko/play") {
        return {
            status: 200,
            body: {
                marbles_used: 1,
                landing_slots: [],
                multipliers: [30, 10, 5, 1, 1, 5, 10, 30],
                earned_point: 30,
                total_point: 50,
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

async function waitForPointBalance(cdp, sessionId, value, timeoutMs = 7000) {
    await waitFor(
        cdp,
        sessionId,
        `document.querySelector('[data-smoke="plinko-point-balance"]')?.textContent.replace(/[^0-9]/g, "") === ${JSON.stringify(String(value))}`,
        `plinko point balance: ${value}`,
        timeoutMs,
    );
}

async function clickButtonByText(cdp, sessionId, text) {
    const ok = await evaluate(cdp, sessionId, `(() => {
        const button = Array.from(document.querySelectorAll("button"))
            .find((node) => node.textContent.includes(${JSON.stringify(text)}) && !node.disabled);
        if (!button) return false;
        button.scrollIntoView({ block: "center", inline: "center" });
        button.click();
        return true;
    })()`);
    if (!ok) throw new Error(`Could not click button: ${text}`);
}

async function assertPageQuality(cdp, sessionId, label) {
    const value = await evaluate(cdp, sessionId, `(() => ({
        text: document.body?.innerText || "",
        canvasCount: document.querySelectorAll("canvas").length,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body?.scrollWidth || 0,
    }))()`);
    if (value.canvasCount < 1) {
        throw new Error(`${label}: plinko canvas missing`);
    }
    const blocked = blockedTexts.filter((text) => value.text.includes(text));
    if (blocked.length) {
        throw new Error(`${label}: blocked text ${blocked.join(", ")}`);
    }
    const overflow = Math.max(value.scrollWidth, value.bodyWidth) - value.clientWidth;
    if (overflow > 3) {
        throw new Error(`${label}: horizontal overflow ${overflow}px`);
    }
}

async function inspectPlinko(cdp, sessionId, viewport) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.mobile ? 2 : 1,
        mobile: viewport.mobile,
    }, sessionId);

    await cdp.send("Page.navigate", { url: `${baseUrl}/app/plinko` }, sessionId);
    await waitForText(cdp, sessionId, "실시간 물리 아케이드");
    await waitForText(cdp, sessionId, "보유 포인트");
    await waitForText(cdp, sessionId, "주사위 구역");
    await waitForText(cdp, sessionId, "플링코 보드");

    if (viewport.interactive) {
        await clickButtonByText(cdp, sessionId, "첫 굴림");
        await waitForText(cdp, sessionId, "원 페어", 10000);
        await waitForText(cdp, sessionId, "획득 구슬");
        await waitForPointBalance(cdp, sessionId, 20);
        await clickButtonByText(cdp, sessionId, "바로 시작");
        await waitForText(cdp, sessionId, "30포인트를 획득했습니다.");
        await waitForText(cdp, sessionId, "+30 획득");
        await waitForPointBalance(cdp, sessionId, 50);
    }

    await assertPageQuality(cdp, sessionId, `plinko ${viewport.name}`);
    return `plinko ${viewport.name}: ok`;
}

async function main() {
    assertPlinkoToastRuntimeBoundary();

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
        if (!targetId) throw new Error("Could not create Chrome target for plinko smoke test.");
        const attachResponse = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
        sessionId = attachResponse.result?.sessionId;
        if (!sessionId) throw new Error("Could not attach to Chrome target for plinko smoke test.");

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
            results.push(await inspectPlinko(cdp, sessionId, viewport));
        }
        if (runtimeErrors.length) {
            throw new Error(`Runtime errors: ${runtimeErrors.join(" | ")}`);
        }
        results.forEach((result) => console.log(result));
        console.log(`plinko-ui-smoke ok (${results.length} responsive checks)`);
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
