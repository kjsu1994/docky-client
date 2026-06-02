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
const userDataDir = mkdtempSync(path.join(tmpdir(), "no-thanks-ui-smoke-"));
const blockedTexts = ["Error", "undefined", "NaN", "WAITING", "PLAYING", "room_code", "start_chip_count", "turn_time_seconds"];
const viewports = [
    { name: "desktop", width: 1366, height: 900, mobile: false, interactive: true },
    { name: "mobile", width: 390, height: 844, mobile: true, interactive: false },
];

function assertNoThanksRealtimeSource() {
    const source = readFileSync("src/pages/games/NoThanksGame.jsx", "utf8");
    const requiredSnippets = [
        ["const realtimeRoomRef = useRef(null)", "track the latest realtime room"],
        ["createStompClient", "load the STOMP runtime through the shared async adapter"],
        ["notifyRealtimeError", "route STOMP ERROR frames through the shared safe notifier"],
        ["client.beforeConnect = () =>", "refresh STOMP auth headers before reconnect"],
        ["bindLatestRealtimeRoom(client)", "resubscribe the latest room after reconnect"],
        ["realtimeRoomRef.current = { roomId, chatRoomId: snapshotChatRoomId }", "store the latest game/chat room"],
        ["heartbeatIncoming: 4000", "enable STOMP heartbeat checks"],
    ];
    for (const [snippet, description] of requiredSnippets) {
        if (!source.includes(snippet)) {
            throw new Error(`no-thanks-ui-smoke: NoThanksGame realtime source must ${description}.`);
        }
    }
    if (source.includes("else client.onConnect = ()")) {
        throw new Error("no-thanks-ui-smoke: NoThanksGame must not overwrite STOMP onConnect per room.");
    }
    if (source.includes('import SockJS from "sockjs-client"') || source.includes('import { Client } from "@stomp/stompjs"')) {
        throw new Error("no-thanks-ui-smoke: NoThanksGame must not statically bundle the STOMP runtime into the route chunk.");
    }
    if (source.includes('notifyError("실시간 연결 오류")')) {
        throw new Error("no-thanks-ui-smoke: NoThanksGame must not show raw repeated realtime error toasts.");
    }
    if (source.includes('from "react-hot-toast"') || !source.includes('from "../../utils/toast.js"')) {
        throw new Error("no-thanks-ui-smoke: NoThanksGame must use the dynamic toast helper instead of static react-hot-toast imports.");
    }
    if (!source.includes("key={normalized.key || normalized.id}") || source.includes("key={`${message.createdAt || index}-${index}`}")) {
        throw new Error("no-thanks-ui-smoke: NoThanksGame chat messages must use stable normalized message keys.");
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

const roomSummary = {
    room_id: 41,
    chat_room_id: 901,
    room_code: "NT2026",
    title: "스모크 노땡스",
    room_status: "WAITING",
    host_member_id: 100,
    min_players: 2,
    max_players: 6,
    start_chip_count: 11,
    turn_time_seconds: 15,
    players: [
        {
            member_id: 100,
            nickname: "스모크 플레이어",
            seat_no: 1,
            ready: false,
        },
    ],
};

const waitingState = {
    event_type: "snapshot",
    room_id: 41,
    chat_room_id: 901,
    room_code: "NT2026",
    room_status: "WAITING",
    phase: "WAITING",
    turn_member_id: null,
    turn_deadline_at: null,
    current_card: null,
    pot_chips: 0,
    deck_remaining_count: 0,
    removed_cards: [],
    winner_member_id: null,
    message: "",
    players: [
        {
            member_id: 100,
            nickname: "스모크 플레이어",
            seat_no: 1,
            ready: false,
            chips: 11,
            cards: [],
            score: null,
        },
    ],
};

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
                    name: "스모크 플레이어",
                    roles: ["ROLE_USER"],
                },
            },
        };
    }

    if (method === "GET" && pathname === "/api/chat/rooms") {
        return { status: 200, body: { data: [] } };
    }

    if (method === "GET" && pathname === "/api/game/no-thanks/rooms") {
        return { status: 200, body: [roomSummary] };
    }

    if (method === "GET" && pathname === "/api/game/no-thanks/rooms/me") {
        return { status: 200, body: [] };
    }

    if (method === "POST" && pathname === "/api/game/no-thanks/rooms") {
        return { status: 201, body: roomSummary };
    }

    if (method === "PATCH" && pathname === "/api/game/no-thanks/rooms/41/settings") {
        return {
            status: 200,
            body: {
                ...roomSummary,
                start_chip_count: 12,
                turn_time_seconds: 20,
            },
        };
    }

    if (method === "POST" && pathname === "/api/game/no-thanks/rooms/41/ready") {
        return { status: 200, bodyText: "" };
    }

    if (method === "GET" && pathname === "/api/game/no-thanks/rooms/41/state") {
        return { status: 200, body: waitingState };
    }

    if (method === "GET" && pathname === "/api/chat/room/901/messages") {
        return {
            status: 200,
            body: {
                data: [
                    {
                        message_id: 1,
                        room_id: 901,
                        sender_id: 100,
                        sender_name: "스모크 플레이어",
                        type: "TALK",
                        message: "노땡스 준비 완료",
                        created_at: "2026-06-01T09:00:00+09:00",
                    },
                ],
            },
        };
    }

    if (method === "PATCH" && pathname === "/api/chat/room/901/read") {
        return { status: 204, bodyText: "" };
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
        bodyText: document.body?.innerText?.slice(0, 700) || "",
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

async function inspectNoThanks(cdp, sessionId, viewport) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.mobile ? 2 : 1,
        mobile: viewport.mobile,
    }, sessionId);

    await cdp.send("Page.navigate", { url: `${baseUrl}/app/games/no-thanks` }, sessionId);
    await waitForText(cdp, sessionId, "노땡스");
    await waitForText(cdp, sessionId, "방 만들기");
    await waitForText(cdp, sessionId, "대기 중인 방");
    await waitForText(cdp, sessionId, "스모크 노땡스");
    await waitForText(cdp, sessionId, "코드 NT2026");

    if (viewport.interactive) {
        await setInputValue(cdp, sessionId, "input[placeholder='방 제목']", "스모크 노땡스");
        await setInputValue(cdp, sessionId, "input[placeholder='토큰 개수']", "12");
        await setInputValue(cdp, sessionId, "input[placeholder='제한 시간(초)']", "20");
        await clickButtonByText(cdp, sessionId, "노땡스 방 만들기");
        await waitForText(cdp, sessionId, "방 코드 NT2026");
        await waitForText(cdp, sessionId, "상태");
        await waitForText(cdp, sessionId, "대기");
        await waitForText(cdp, sessionId, "스모크 플레이어");
        await clickButtonByText(cdp, sessionId, "설정 저장");
        await waitForText(cdp, sessionId, "방 설정 저장 완료");
        await waitForText(cdp, sessionId, "20초");
        await clickButtonByText(cdp, sessionId, "준비 토글");
    }

    await assertPageQuality(cdp, sessionId, `no thanks ${viewport.name}`);
    return `no thanks ${viewport.name}: ok`;
}

async function main() {
    assertNoThanksRealtimeSource();
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
        if (!targetId) throw new Error("Could not create Chrome target for no-thanks smoke test.");
        const attachResponse = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
        sessionId = attachResponse.result?.sessionId;
        if (!sessionId) throw new Error("Could not attach to Chrome target for no-thanks smoke test.");

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
                localStorage.removeItem("no_thanks_last_room_id");
            `,
        }, sessionId);

        const results = [];
        for (const viewport of viewports) {
            results.push(await inspectNoThanks(cdp, sessionId, viewport));
        }
        if (runtimeErrors.length) {
            throw new Error(`Runtime errors: ${runtimeErrors.join(" | ")}`);
        }
        results.forEach((result) => console.log(result));
        console.log(`no-thanks-ui-smoke ok (${results.length} responsive checks)`);
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
