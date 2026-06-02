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
const userDataDir = mkdtempSync(path.join(tmpdir(), "hub-ui-smoke-"));
const viewports = [
    { name: "desktop", width: 1366, height: 900, mobile: false },
    { name: "mobile", width: 390, height: 844, mobile: true },
];

const allMenuTexts = [
    "검증 관리자",
    "핵심 서비스",
    "편의 도구",
    "게임",
    "계정",
    "관리자",
    "스트리밍 스튜디오",
    "커뮤니티 플랫폼 V2.0",
];
const allMenuLinks = [
    "/app",
    "/app/todos",
    "/app/statistics",
    "/app/streaming",
    "/app/boards/FREE_BOARD",
    "/app/boards/QUESTION_ANSWER",
    "/app/invest",
    "/app/optimizer",
    "/app/facility",
    "/app/ranks",
    "/app/news",
    "/app/games",
    "/app/plinko",
    "/app/games/las-vegas",
    "/app/games/no-thanks",
    "/app/games/catan",
    "/app/games/blokus",
    "/app/games/mahe",
    "/app/games/dalmuti",
    "/app/games/citadels",
    "/app/mypage",
    "/app/mypage/edit",
    "/app/admin/anomalies",
    "/app/admin/operations",
    "/app/admin/streaming",
];
const gamesHubTexts = [
    "게임 허브",
    "게임을 선택하세요",
    "게임 목록",
    "카탄",
    "블로커스",
    "마헤",
    "달무티",
    "Lucky Plinko",
    "Las Vegas",
    "No Thanks",
    "Citadels",
];
const blockedTexts = ["Loading", "Error", "undefined", "ROLE_ADMIN", "ROLE_MASTER"];

let nextMessageId = 1;
const pending = new Map();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function assertStaticGamesHubManualAccessibility() {
    const source = readFileSync("src/pages/games/GamesHub.jsx", "utf8");
    const requiredSnippets = [
        "useCallback",
        "useId",
        "useRef",
        "aria-labelledby={titleId}",
        "aria-describedby={descriptionId}",
        "ref={closeButtonRef}",
        "closeButtonRef.current?.focus()",
        "previousFocus.focus()",
        "onClose={closeManual}",
    ];
    const missing = requiredSnippets.filter((snippet) => !source.includes(snippet));
    if (missing.length) {
        throw new Error(`games hub manual accessibility guard missing: ${missing.join(", ")}`);
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
                    memberId: 999,
                    name: "검증 관리자",
                    email: "admin@example.com",
                    roles: ["ROLE_ADMIN"],
                },
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
    const bodyText = await evaluate(ws, `document.body?.innerText.slice(0, 800) || ""`);
    throw new Error(`Timed out waiting for text: ${text}. Body: ${bodyText}`);
}

async function setViewport(ws, viewport) {
    await send(ws, "Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.mobile ? 2 : 1,
        mobile: viewport.mobile,
    });
}

async function inspectPageFrame(ws, label, requiredTexts) {
    const value = await evaluate(ws, `(() => {
        const root = document.documentElement;
        const body = document.body;
        const text = body ? body.innerText : "";
        const overflowNodes = Array.from(document.querySelectorAll("body *"))
            .map((node) => {
                const rect = node.getBoundingClientRect();
                return {
                    tag: node.tagName,
                    text: (node.innerText || node.getAttribute("aria-label") || "").trim().slice(0, 80),
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
        throw new Error(`${label}: missing text ${missing.join(", ")}`);
    }

    const blocked = blockedTexts.filter((text) => value.text.includes(text));
    if (blocked.length) {
        throw new Error(`${label}: blocked text ${blocked.join(", ")}`);
    }

    const overflow = Math.max(value.scrollWidth, value.bodyWidth) - value.clientWidth;
    if (overflow > 3) {
        throw new Error(`${label}: horizontal overflow ${overflow}px ${JSON.stringify(value.overflowNodes)}`);
    }

    return value;
}

async function inspectAllMenu(ws, viewport) {
    await setViewport(ws, viewport);
    await send(ws, "Page.navigate", { url: `${baseUrl}/app/all-menu` });
    for (const text of allMenuTexts) {
        await waitForText(ws, text);
    }
    await delay(250);

    const value = await inspectPageFrame(ws, `all-menu ${viewport.name}`, allMenuTexts);
    const missingLinks = await evaluate(ws, `(() => {
        const links = new Set(Array.from(document.querySelectorAll("a[href]")).map((node) => node.getAttribute("href")));
        return ${JSON.stringify(allMenuLinks)}.filter((href) => !links.has(href));
    })()`);
    if (missingLinks.length) {
        throw new Error(`all-menu ${viewport.name}: missing links ${missingLinks.join(", ")}`);
    }

    return `all-menu ${viewport.name}: ok ${value.clientWidth}/${value.scrollWidth} ${value.url}`;
}

async function clickByAriaLabel(ws, label) {
    return evaluate(ws, `(() => {
        const node = Array.from(document.querySelectorAll("button, a")).find((item) => item.getAttribute("aria-label") === ${JSON.stringify(label)});
        if (!node) return "missing";
        node.click();
        return "clicked";
    })()`);
}

async function inspectGamesHub(ws, viewport) {
    await setViewport(ws, viewport);
    await send(ws, "Page.navigate", { url: `${baseUrl}/app/games` });
    for (const text of gamesHubTexts) {
        await waitForText(ws, text);
    }

    if (await clickByAriaLabel(ws, "카탄 설명서 열기") !== "clicked") {
        throw new Error(`games-hub ${viewport.name}: catan manual button missing`);
    }
    await waitForText(ws, "처음 시작 순서");
    await waitForText(ws, "초보 팁");
    await waitForText(ws, "설명서는 입문 안내입니다.");
    if (await clickByAriaLabel(ws, "설명서 닫기") !== "clicked") {
        throw new Error(`games-hub ${viewport.name}: manual close button missing`);
    }
    await delay(200);

    const catanLink = await evaluate(ws, `Array.from(document.querySelectorAll("a[href]")).some((node) => node.getAttribute("href") === "/app/games/catan" && (node.getAttribute("aria-label") || "").includes("카탄 입장하기"))`);
    if (!catanLink) {
        throw new Error(`games-hub ${viewport.name}: catan entry link missing`);
    }

    const cardOrder = await evaluate(ws, `Array.from(document.querySelectorAll('[data-smoke="game-card"]')).map((node) => node.getAttribute("data-game-title"))`);
    const expectedOrder = ["Lucky Plinko", "블로커스", "Las Vegas", "마헤", "Citadels", "No Thanks", "카탄", "달무티"];
    if (JSON.stringify(cardOrder) !== JSON.stringify(expectedOrder)) {
        throw new Error(`games-hub ${viewport.name}: player-count order mismatch ${JSON.stringify(cardOrder)}`);
    }
    const groupedLabelVisible = await evaluate(ws, `document.body?.innerText.includes("신규 보드게임") || document.body?.innerText.includes("기존 게임")`);
    if (groupedLabelVisible) {
        throw new Error(`games-hub ${viewport.name}: grouped game labels must not be visible`);
    }

    const value = await inspectPageFrame(ws, `games-hub ${viewport.name}`, gamesHubTexts);
    return `games-hub ${viewport.name}: ok ${value.clientWidth}/${value.scrollWidth} ${value.url}`;
}

async function main() {
    assertStaticGamesHubManualAccessibility();

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
        const ws = await createPipeSession(chrome, { debug, testName: "hub-ui-smoke" });
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
        await send(ws, "Fetch.enable", {
            patterns: [
                { urlPattern: "*://localhost*/api/*", requestStage: "Request" },
                { urlPattern: "*://127.0.0.1*/api/*", requestStage: "Request" },
                { urlPattern: "https://oapi.map.naver.com/*", requestStage: "Request" },
            ],
        });
        await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
            source: `
                localStorage.setItem("accessToken", "smoke-access-token");
                localStorage.setItem("refreshToken", "smoke-refresh-token");
                localStorage.setItem("userRoles", JSON.stringify(["ROLE_ADMIN"]));
            `,
        });

        const results = [];
        for (const viewport of viewports) {
            results.push(await inspectAllMenu(ws, viewport));
            results.push(await inspectGamesHub(ws, viewport));
        }
        if (runtimeErrors.length) {
            throw new Error(`Runtime errors: ${runtimeErrors.join(" | ")}`);
        }
        results.forEach((result) => console.log(result));
        console.log(`hub-ui-smoke ok (${results.length} responsive checks)`);
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
