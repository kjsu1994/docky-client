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
const userDataDir = mkdtempSync(path.join(tmpdir(), "streaming-ui-smoke-"));
const viewports = [
    { name: "desktop", width: 1366, height: 900, mobile: false },
    { name: "tablet", width: 768, height: 1024, mobile: false },
    { name: "galaxy-s26", width: 360, height: 780, mobile: true, deviceScaleFactor: 3 },
    { name: "short-galaxy-s26", width: 360, height: 740, mobile: true, deviceScaleFactor: 3 },
];
const listTexts = ["영상 스트리밍 허브", "재생 목록", "테스트 강의", "외부 썸네일 차단", "상세 보기", "재생 가능"];
const playerTexts = ["현재 재생", "재생 정보", "목록으로 돌아가기", "플레이리스트"];
const blockedTexts = ["Loading", "Error", "READY", "PROCESSING", "FAILED", "UPLOADING", "undefined", "NaN"];
const hlsRuntimePattern = /(?:\/assets\/hls\.light-[\w-]+\.js|hls\.js\/light|hls\.light)/i;

const streamingSource = readFileSync(path.join(process.cwd(), "src/pages/streaming/StreamingHub.jsx"), "utf8");
if (!streamingSource.includes('import("hls.js/light")')) {
    throw new Error("StreamingHub must dynamically import hls.js/light only after playback info is ready.");
}
if (/import\s+[^;]+from\s+["']hls\.js(?:\/light)?["']/.test(streamingSource)) {
    throw new Error("StreamingHub must not statically import hls.js in the route chunk.");
}

let nextMessageId = 1;
const pending = new Map();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const encodeJson = (value) => Buffer.from(JSON.stringify(value), "utf8").toString("base64");
const encodeText = (value) => Buffer.from(value, "utf8").toString("base64");
const isHlsRuntimeRequest = (url = "") => hlsRuntimePattern.test(url);

function send(ws, method, params = {}) {
    const id = nextMessageId++;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject, method });
    });
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
                    name: "검증 사용자",
                    roles: ["ROLE_USER"],
                },
            },
        };
    }

    if (method === "GET" && pathname === "/api/chat/rooms") {
        return { status: 200, body: { data: [] } };
    }

    if (method === "GET" && pathname === "/api/streaming/videos") {
        return {
            status: 200,
            body: {
                data: {
                    items: [
                        {
                            video_id: 801,
                            title: "테스트 강의",
                            description: "스트리밍 허브의 목록과 재생 화면을 검증합니다.",
                            status: "READY",
                            duration_seconds: 125,
                            thumbnail_url: "/api/streaming/videos/801/thumbnail",
                            playlist_url: "/api/streaming/videos/801/hls/index.m3u8",
                        },
                        {
                            video_id: 802,
                            title: "외부 썸네일 차단",
                            description: "외부 썸네일 URL은 요청하지 않고 기본 썸네일로 표시합니다.",
                            status: "READY",
                            duration_seconds: 95,
                            thumbnail_url: "https://example.com/streaming-thumbnail.jpg",
                            playlist_url: "/api/streaming/videos/802/hls/index.m3u8",
                        },
                    ],
                },
            },
        };
    }

    if (method === "GET" && pathname === "/api/streaming/videos/801/play") {
        return {
            status: 200,
            body: {
                data: {
                    video_id: 801,
                    title: "테스트 강의",
                    status: "READY",
                    duration_seconds: 125,
                    thumbnail_url: "/api/streaming/videos/801/thumbnail",
                    playlist_url: "/api/streaming/videos/801/hls/index.m3u8",
                },
            },
        };
    }

    if (method === "GET" && pathname === "/api/streaming/videos/801/hls/index.m3u8") {
        return {
            status: 200,
            contentType: "application/vnd.apple.mpegurl; charset=utf-8",
            bodyText: "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:4\n#EXTINF:4,\nsegment_00000.ts\n",
        };
    }

    if (method === "GET" && pathname === "/api/streaming/videos/801/hls/segment_00000.ts") {
        return { status: 200, contentType: "video/mp2t", bodyText: "segment" };
    }

    if (method === "GET" && pathname === "/api/streaming/videos/801/thumbnail") {
        return { status: 200, contentType: "image/jpeg", bodyText: "jpeg" };
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
        body: mock.bodyText !== undefined ? encodeText(mock.bodyText) : encodeJson(mock.body),
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

async function waitFor(ws, expression, description, timeoutMs = 7000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (await evaluate(ws, expression)) return;
        await delay(120);
    }
    const pageState = await evaluate(ws, `(() => ({
        href: location.href,
        readyState: document.readyState,
        bodyText: document.body?.innerText?.slice(0, 800) || "",
    }))()`).catch(() => null);
    throw new Error(`Timed out waiting for ${description}${pageState ? `; page: ${JSON.stringify(pageState)}` : ""}`);
}

async function waitForText(ws, text, timeoutMs = 7000) {
    await waitFor(ws, `document.body?.innerText.includes(${JSON.stringify(text)})`, `text: ${text}`, timeoutMs);
}

async function clickButtonByText(ws, text) {
    const ok = await evaluate(ws, `(() => {
        const button = Array.from(document.querySelectorAll("button"))
            .find((node) => node.textContent.includes(${JSON.stringify(text)}) && !node.disabled);
        if (!button) return false;
        button.scrollIntoView({ block: "center", inline: "center" });
        button.click();
        return true;
    })()`);
    if (!ok) throw new Error(`Could not click button text: ${text}`);
}

async function inspectStreaming(ws, viewport, requestLog) {
    const hadHlsBeforeViewport = requestLog.some(isHlsRuntimeRequest);
    const viewportRequestStart = requestLog.length;

    await send(ws, "Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.deviceScaleFactor || (viewport.mobile ? 2 : 1),
        mobile: viewport.mobile,
    });
    await send(ws, "Page.navigate", { url: `${baseUrl}/app/streaming` });

    for (const text of listTexts) {
        await waitForText(ws, text);
    }

    const listHlsRequest = requestLog.slice(viewportRequestStart).find(isHlsRuntimeRequest);
    if (listHlsRequest) {
        throw new Error(`streaming ${viewport.name}: hls runtime loaded before playback: ${listHlsRequest}`);
    }
    const externalThumbnailRequest = requestLog.slice(viewportRequestStart)
        .find((url) => url.includes("example.com/streaming-thumbnail.jpg"));
    if (externalThumbnailRequest) {
        throw new Error(`streaming ${viewport.name}: unsafe external thumbnail was requested: ${externalThumbnailRequest}`);
    }

    await clickButtonByText(ws, "상세 보기");
    for (const text of playerTexts) {
        await waitForText(ws, text);
    }
    await delay(300);

    const nativeHls = await evaluate(ws, `Boolean(document.createElement("video").canPlayType("application/vnd.apple.mpegurl"))`);
    const hlsPlaybackRequest = requestLog.slice(viewportRequestStart).find(isHlsRuntimeRequest);
    if (!nativeHls && !hadHlsBeforeViewport && !hlsPlaybackRequest) {
        throw new Error(`streaming ${viewport.name}: hls runtime was not requested after playback started`);
    }

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

    const missing = [...playerTexts, "테스트 강의"].filter((text) => !value.text.includes(text));
    if (missing.length) {
        throw new Error(`streaming ${viewport.name}: missing text ${missing.join(", ")}`);
    }

    const blocked = blockedTexts.filter((text) => value.text.includes(text));
    if (blocked.length) {
        throw new Error(`streaming ${viewport.name}: blocked text ${blocked.join(", ")}`);
    }

    const overflow = Math.max(value.scrollWidth, value.bodyWidth) - value.clientWidth;
    if (overflow > 3) {
        throw new Error(`streaming ${viewport.name}: horizontal overflow ${overflow}px ${JSON.stringify(value.overflowNodes)}`);
    }

    return `streaming ${viewport.name}: ok ${value.clientWidth}/${value.scrollWidth} ${value.url}`;
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
        const ws = await createPipeSession(chrome, { debug, testName: "streaming-ui-smoke" });
        const runtimeErrors = [];
        const requestLog = [];

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
            } else if (message.method === "Network.requestWillBeSent") {
                requestLog.push(message.params?.request?.url || "");
            } else if (message.method === "Runtime.exceptionThrown") {
                runtimeErrors.push(message.params?.exceptionDetails?.text || "Runtime exception");
            }
        });

        await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
        await send(ws, "Page.enable");
        await send(ws, "Network.enable");
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
                localStorage.setItem("userRoles", JSON.stringify(["ROLE_USER"]));
            `,
        });

        const results = [];
        for (const viewport of viewports) {
            results.push(await inspectStreaming(ws, viewport, requestLog));
        }
        if (runtimeErrors.length) {
            throw new Error(`Runtime errors: ${runtimeErrors.join(" | ")}`);
        }
        results.forEach((result) => console.log(result));
        console.log(`streaming-ui-smoke ok (${results.length} responsive checks)`);
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
