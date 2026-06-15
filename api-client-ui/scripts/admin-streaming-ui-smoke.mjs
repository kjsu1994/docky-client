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
const userDataDir = mkdtempSync(path.join(tmpdir(), "admin-streaming-ui-smoke-"));
const blockedTexts = ["Loading", "Error", "undefined", "NaN", "READY", "PROCESSING", "FAILED", "UPLOADING", "ROLE_ADMIN", "ROLE_MASTER"];
const viewports = [
    { name: "desktop", width: 1366, height: 900, mobile: false, interactive: true },
    { name: "tablet", width: 768, height: 1024, mobile: false, interactive: false },
    { name: "galaxy-s26", width: 360, height: 780, mobile: true, deviceScaleFactor: 3, interactive: false },
    { name: "short-galaxy-s26", width: 360, height: 740, mobile: true, deviceScaleFactor: 3, interactive: false },
];
const adminStreamingSource = readFileSync("src/pages/admin/AdminStreamingStudio.jsx", "utf8");

function assertStaticAdminStreamingToastRuntimeBoundary() {
    if (adminStreamingSource.includes("from \"react-hot-toast\"") || /\btoast\.(success|error|loading|custom|dismiss|remove)\b/.test(adminStreamingSource)) {
        throw new Error("admin-streaming-ui-smoke: AdminStreamingStudio must use the dynamic toast helper instead of static react-hot-toast imports.");
    }
    for (const helper of ["loadToast", "notifyError", "notifySuccess"]) {
        if (!adminStreamingSource.includes(helper)) {
            throw new Error(`admin-streaming-ui-smoke: AdminStreamingStudio must keep ${helper} on the dynamic toast runtime boundary.`);
        }
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
                    member_id: 999,
                    email: "admin@example.com",
                    name: "관리자",
                    roles: ["ROLE_ADMIN"],
                },
            },
        };
    }

    if (method === "GET" && pathname === "/api/members/admin-mfa/status") {
        return {
            status: 200,
            body: {
                data: {
                    required: true,
                    verified: true,
                    ttl_seconds: 600,
                },
            },
        };
    }

    if (method === "GET" && pathname === "/api/chat/rooms") {
        return { status: 200, body: { data: [] } };
    }

    if (method === "GET" && pathname === "/api/admin/streaming/videos") {
        return {
            status: 200,
            body: {
                data: {
                    items: [
                        {
                            video_id: 901,
                            title: "관리자 업로드 샘플",
                            description: "스트리밍 스튜디오 검증 영상입니다.",
                            status: "READY",
                            source_extension: "mp4",
                            file_size: 73400320,
                            duration_seconds: 90,
                            thumbnail_url: "/api/streaming/videos/901/thumbnail",
                        },
                        {
                            video_id: 904,
                            title: "외부 썸네일 관리자 샘플",
                            description: "외부 썸네일 URL은 요청하지 않습니다.",
                            status: "READY",
                            source_extension: "mp4",
                            file_size: 10485760,
                            duration_seconds: 45,
                            thumbnail_url: "https://example.com/admin-streaming-thumbnail.jpg",
                        },
                    ],
                },
            },
        };
    }

    if (method === "GET" && pathname === "/api/admin/streaming/videos/inbox") {
        return {
            status: 200,
            body: {
                data: {
                    items: [
                        {
                            file_name: "inbox-lecture.mp4",
                            title: "인박스 강의",
                            source_extension: "mp4",
                            file_size: 104857600,
                            ready: true,
                        },
                    ],
                },
            },
        };
    }

    if (method === "POST" && pathname === "/api/admin/streaming/videos/batch") {
        return {
            status: 201,
            body: {
                data: {
                    items: [
                        {
                            video_id: 902,
                            title: "브라우저 업로드 샘플",
                            status: "UPLOADING",
                            source_extension: "mp4",
                            file_size: 1024,
                        },
                    ],
                },
            },
        };
    }

    if (method === "POST" && pathname === "/api/admin/streaming/videos/inbox/import") {
        return {
            status: 201,
            body: {
                data: {
                    items: [
                        {
                            video_id: 903,
                            title: "인박스 강의",
                            status: "UPLOADING",
                            source_extension: "mp4",
                            file_size: 104857600,
                        },
                    ],
                },
            },
        };
    }

    if (method === "DELETE" && pathname === "/api/admin/streaming/videos/901") {
        return { status: 204, bodyText: "" };
    }

    if (method === "GET" && pathname === "/api/streaming/videos/901/thumbnail") {
        return { status: 200, contentType: "image/jpeg", bodyText: "jpeg" };
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

async function waitFor(cdp, sessionId, expression, description, timeoutMs = 7000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (await evaluate(cdp, sessionId, expression)) return;
        await delay(120);
    }
    const pageState = await evaluate(cdp, sessionId, `(() => ({
        href: location.href,
        readyState: document.readyState,
        bodyText: document.body?.innerText?.slice(0, 500) || "",
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

async function setSyntheticFile(cdp, sessionId, selector) {
    const ok = await evaluate(cdp, sessionId, `(() => {
        const input = document.querySelector(${JSON.stringify(selector)});
        if (!input) return false;
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(new File(["smoke"], "admin-upload-smoke.mp4", { type: "video/mp4" }));
        input.files = dataTransfer.files;
        const reactPropsKey = Object.keys(input).find((key) => key.startsWith("__reactProps$"));
        const onChange = reactPropsKey ? input[reactPropsKey]?.onChange : null;
        if (typeof onChange === "function") {
            onChange({ currentTarget: input, target: input, preventDefault: () => {}, stopPropagation: () => {} });
            return true;
        }
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
    })()`);
    if (!ok) throw new Error(`Could not set file input: ${selector}`);
}

async function clickButtonByText(cdp, sessionId, text, scope = "document") {
    const ok = await evaluate(cdp, sessionId, `(() => {
        const root = ${scope};
        const button = Array.from(root.querySelectorAll("button"))
            .find((node) => node.textContent.includes(${JSON.stringify(text)}) && !node.disabled);
        if (!button) return false;
        button.scrollIntoView({ block: "center", inline: "center" });
        button.click();
        return true;
    })()`);
    if (!ok) throw new Error(`Could not click button: ${text}`);
}

async function clickInboxCheckbox(cdp, sessionId, fileName) {
    const ok = await evaluate(cdp, sessionId, `(() => {
        const label = Array.from(document.querySelectorAll("label"))
            .find((node) => node.textContent.includes(${JSON.stringify(fileName)}));
        const checkbox = label?.querySelector("input[type='checkbox']");
        if (!checkbox || checkbox.disabled) return false;
        checkbox.click();
        return true;
    })()`);
    if (!ok) throw new Error(`Could not select inbox file: ${fileName}`);
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

async function inspectAdminStreaming(cdp, sessionId, viewport, requestLog) {
    const viewportRequestStart = requestLog.length;

    await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.deviceScaleFactor || (viewport.mobile ? 2 : 1),
        mobile: viewport.mobile,
    }, sessionId);

    await cdp.send("Page.navigate", { url: `${baseUrl}/app/admin/streaming` }, sessionId);
    await waitForText(cdp, sessionId, "스트리밍 스튜디오");
    await waitForText(cdp, sessionId, "영상 업로드");
    await waitForText(cdp, sessionId, "inbox 반입");
    await waitForText(cdp, sessionId, "관리자 업로드 샘플");
    await waitForText(cdp, sessionId, "외부 썸네일 관리자 샘플");
    await waitForText(cdp, sessionId, "재생 가능");
    await waitForText(cdp, sessionId, "인박스 강의");

    const externalThumbnailRequest = requestLog.slice(viewportRequestStart)
        .find((url) => url.includes("example.com/admin-streaming-thumbnail.jpg"));
    if (externalThumbnailRequest) {
        throw new Error(`admin streaming ${viewport.name}: unsafe external thumbnail was requested: ${externalThumbnailRequest}`);
    }

    if (viewport.interactive) {
        await setInputValue(cdp, sessionId, "input[placeholder='영상 제목']", "브라우저 업로드 샘플");
        await setInputValue(cdp, sessionId, "textarea", "스모크 검증 설명");
        await setSyntheticFile(cdp, sessionId, "#streaming-file-input");
        await waitForText(cdp, sessionId, "선택 파일 1개");
        await clickButtonByText(cdp, sessionId, "업로드 시작");
        await waitForText(cdp, sessionId, "영상 업로드가 등록되었습니다.");

        await clickInboxCheckbox(cdp, sessionId, "inbox-lecture.mp4");
        await clickButtonByText(cdp, sessionId, "선택 파일 가져오기");
        await waitForText(cdp, sessionId, "inbox 영상 가져오기가 시작되었습니다.");

        await clickButtonByText(cdp, sessionId, "삭제");
        await waitForText(cdp, sessionId, "영상을 삭제할까요?");
        await clickButtonByText(cdp, sessionId, "삭제", "document.querySelector(\"[role='alertdialog']\")");
        await waitForText(cdp, sessionId, "영상이 삭제되었습니다.");
    }

    await assertPageQuality(cdp, sessionId, `admin streaming ${viewport.name}`);
    return `admin streaming ${viewport.name}: ok`;
}

async function main() {
    assertStaticAdminStreamingToastRuntimeBoundary();

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
        const requestLog = [];

    try {
        await cdp.send("Browser.getVersion");
        const targetResponse = await cdp.send("Target.createTarget", { url: "about:blank" });
        const targetId = targetResponse.result?.targetId;
        if (!targetId) throw new Error("Could not create Chrome target for admin streaming smoke test.");
        const attachResponse = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
        sessionId = attachResponse.result?.sessionId;
        if (!sessionId) throw new Error("Could not attach to Chrome target for admin streaming smoke test.");

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
            } else if (message.method === "Network.requestWillBeSent") {
                requestLog.push(message.params?.request?.url || "");
            }
        });

        await cdp.send("Page.enable", {}, sessionId);
        await cdp.send("Network.enable", {}, sessionId);
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
                localStorage.setItem("accessToken", "smoke-admin-access-token");
                localStorage.setItem("refreshToken", "smoke-admin-refresh-token");
                localStorage.setItem("userRoles", JSON.stringify(["ROLE_ADMIN"]));
            `,
        }, sessionId);

        const results = [];
        for (const viewport of viewports) {
            results.push(await inspectAdminStreaming(cdp, sessionId, viewport, requestLog));
        }
        if (runtimeErrors.length) {
            throw new Error(`Runtime errors: ${runtimeErrors.join(" | ")}`);
        }
        results.forEach((result) => console.log(result));
        console.log(`admin-streaming-ui-smoke ok (${results.length} responsive checks)`);
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
