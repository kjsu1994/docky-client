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
const userDataDir = mkdtempSync(path.join(tmpdir(), "optimizer-ui-smoke-"));
const viewports = [
    { name: "desktop", width: 1366, height: 900, mobile: false },
    { name: "mobile", width: 390, height: 844, mobile: true },
];
const blockedTexts = ["Loading", "Error", "Failed", "undefined", "NaN"];
const projectRoot = new URL("../", import.meta.url);

function assertOptimizerSourceBoundaries() {
    const loader = readFileSync(new URL("src/utils/daumPostcodeLoader.js", projectRoot), "utf8");
    const optimizer = readFileSync(new URL("src/pages/facility/MeetingOptimizer.jsx", projectRoot), "utf8");
    const adapter = readFileSync(new URL("src/adapters/optimizerAdapter.js", projectRoot), "utf8");
    const toastHelper = readFileSync(new URL("src/utils/toast.js", projectRoot), "utf8");

    if (!loader.includes("https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js")) {
        throw new Error("optimizer source guard: Daum postcode loader must use an explicit https URL");
    }
    if (!loader.includes("DAUM_POSTCODE_LOAD_TIMEOUT_MS") || !loader.includes("setTimeout")) {
        throw new Error("optimizer source guard: Daum postcode loader must keep a bounded timeout");
    }
    if (!optimizer.includes("../../utils/daumPostcodeLoader.js") || /const\s+loadDaumPostcodeScript\s*=/.test(optimizer)) {
        throw new Error("optimizer source guard: MeetingOptimizer must use the shared Daum postcode loader");
    }
    if (optimizer.includes("t1.daumcdn.net") || optimizer.includes("data-daum-postcode")) {
        throw new Error("optimizer source guard: MeetingOptimizer must not define its own postcode script tag");
    }
    if (!toastHelper.includes("export const notifyLoading") || !toastHelper.includes("import(\"react-hot-toast\")")) {
        throw new Error("optimizer source guard: toast helper must expose dynamic loading notifications.");
    }
    if (optimizer.includes("from \"react-hot-toast\"") || /\btoast\.(success|error|loading|custom|dismiss|remove)\b/.test(optimizer)) {
        throw new Error("optimizer source guard: MeetingOptimizer must use the dynamic toast helper instead of static react-hot-toast imports.");
    }
    for (const helperName of ["notifyError", "notifyLoading", "notifySuccess"]) {
        if (!optimizer.includes(helperName)) {
            throw new Error(`optimizer source guard: MeetingOptimizer must keep ${helperName} on the dynamic toast runtime boundary.`);
        }
    }
    if (!adapter.includes("OPTIMIZER_MAX_PARTICIPANTS = 8")
        || !adapter.includes("OPTIMIZER_ADDRESS_MAX_LENGTH = 120")
        || !adapter.includes("normalizeOptimizerAddresses(addresses)")) {
        throw new Error("optimizer source guard: optimizer adapter must normalize and bound request payloads.");
    }
    if (!optimizer.includes("addresses.length >= OPTIMIZER_MAX_PARTICIPANTS")
        || !optimizer.includes("maxLength={OPTIMIZER_ADDRESS_MAX_LENGTH}")
        || !optimizer.includes("최대 {OPTIMIZER_MAX_PARTICIPANTS}명")) {
        throw new Error("optimizer source guard: MeetingOptimizer must expose participant and address bounds in the UI.");
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
                    name: "중간장소 검증자",
                    roles: ["ROLE_USER"],
                },
            },
        };
    }

    if (method === "GET" && pathname === "/api/chat/rooms") {
        return { status: 200, body: { data: [] } };
    }

    if (method === "POST" && pathname === "/api/optimizer/optimize") {
        return {
            status: 200,
            body: {
                candidates: [
                    {
                        name: "서울역",
                        address: "서울 중구 한강대로 405",
                        latitude: 37.5547,
                        longitude: 126.9706,
                    },
                    {
                        name: "시청역",
                        address: "서울 중구 세종대로 지하101",
                        latitude: 37.5657,
                        longitude: 126.9769,
                    },
                    {
                        name: "을지로입구역",
                        address: "서울 중구 을지로 지하42",
                        latitude: 37.566,
                        longitude: 126.982,
                    },
                ],
                avg_travel_time: 24.4,
                travel_time_std_dev: 3.2,
                recommended_reason: "두 출발지 모두 30분 안팎으로 이동할 수 있는 지점입니다.",
                user_results: [
                    { name: "참여자 1", travel_time: 22, summary: "강남역에서 지하철 이동" },
                    { name: "참여자 2", travel_time: 27, summary: "홍대입구역에서 지하철 이동" },
                ],
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

async function waitForText(cdp, sessionId, text, timeoutMs = 7000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (await evaluate(cdp, sessionId, `document.body?.innerText.includes(${JSON.stringify(text)})`)) return;
        await delay(120);
    }
    const pageState = await evaluate(cdp, sessionId, `(() => ({
        href: location.href,
        readyState: document.readyState,
        bodyText: document.body?.innerText?.slice(0, 300) || "",
    }))()`).catch(() => null);
    throw new Error(`Timed out waiting for text: ${text}${pageState ? `; page: ${JSON.stringify(pageState)}` : ""}`);
}

async function waitForInputValue(cdp, sessionId, placeholder, expectedValue, timeoutMs = 7000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (await evaluate(cdp, sessionId, `(() => {
            const input = Array.from(document.querySelectorAll("input"))
                .find((node) => (node.placeholder || "").includes(${JSON.stringify(placeholder)}));
            return Boolean(input?.value?.includes(${JSON.stringify(expectedValue)}));
        })()`)) return;
        await delay(120);
    }
    const values = await evaluate(cdp, sessionId, `Array.from(document.querySelectorAll("input")).map((input) => ({ placeholder: input.placeholder, value: input.value }))`).catch(() => []);
    throw new Error(`Timed out waiting for input value: ${placeholder}=${expectedValue}; values: ${JSON.stringify(values)}`);
}

async function clickByText(cdp, sessionId, text) {
    const target = await evaluate(cdp, sessionId, `(() => {
        const target = Array.from(document.querySelectorAll("button,a,input"))
            .find((node) => (node.innerText || node.value || node.placeholder || node.getAttribute("aria-label") || "").includes(${JSON.stringify(text)}));
        if (!target) return null;
        target.scrollIntoView({ block: "center", inline: "center" });
        const rect = target.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            tag: target.tagName,
        };
    })()`);
    if (!target) throw new Error(`Could not click text: ${text}`);
    await cdp.send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: target.x,
        y: target.y,
    }, sessionId);
    await cdp.send("Input.dispatchMouseEvent", {
        type: "mousePressed",
        x: target.x,
        y: target.y,
        button: "left",
        clickCount: 1,
    }, sessionId);
    await cdp.send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x: target.x,
        y: target.y,
        button: "left",
        clickCount: 1,
    }, sessionId);
}

async function waitForMapPickHandler(cdp, sessionId, timeoutMs = 7000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (await evaluate(cdp, sessionId, `Boolean(window.__smokeNaverHandlers?.rightclick?.length)`)) return;
        await delay(120);
    }
    throw new Error("Timed out waiting for optimizer map pick handler.");
}

async function selectMapTarget(cdp, sessionId, targetIndex) {
    const selected = await evaluate(cdp, sessionId, `(() => {
        const select = Array.from(document.querySelectorAll("select"))
            .find((node) => Array.from(node.options || []).some((option) => option.textContent.includes("참여자")));
        if (!select) return false;
        select.value = String(${targetIndex});
        const reactPropsKey = Object.keys(select).find((key) => key.startsWith("__reactProps$"));
        const onChange = reactPropsKey ? select[reactPropsKey]?.onChange : null;
        if (typeof onChange === "function") {
            onChange({ currentTarget: select, target: select, preventDefault: () => {}, stopPropagation: () => {} });
            return true;
        }
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
    })()`);
    if (!selected) throw new Error(`Could not select optimizer map target: ${targetIndex}`);
}

async function triggerMapPick(cdp, sessionId) {
    const triggered = await evaluate(cdp, sessionId, `(() => {
        const handler = window.__smokeNaverHandlers?.rightclick?.[0];
        if (typeof handler !== "function") return false;
        handler({ coord: new window.naver.maps.LatLng(37.5665, 126.978) });
        return {
            reverseGeocodeIndex: window.__smokeReverseGeocodeIndex,
            bodyText: document.body?.innerText?.slice(0, 160) || "",
        };
    })()`);
    if (!triggered) throw new Error("Could not trigger optimizer map pick handler.");
    if (debug) console.log("triggerMapPick", triggered);
}

async function inspectOptimizer(cdp, sessionId, viewport) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.mobile ? 2 : 1,
        mobile: viewport.mobile,
    }, sessionId);
    const navigation = await cdp.send("Page.navigate", { url: `${baseUrl}/app/optimizer` }, sessionId);
    if (navigation.result?.errorText) {
        throw new Error(`optimizer ${viewport.name}: navigation failed ${navigation.result.errorText}`);
    }

    await waitForText(cdp, sessionId, "중간장소 최적화");
    await waitForMapPickHandler(cdp, sessionId);
    await triggerMapPick(cdp, sessionId);
    await waitForInputValue(cdp, sessionId, "참여자 1 주소", "서울 강남구 테헤란로 152");
    await selectMapTarget(cdp, sessionId, 1);
    await waitForText(cdp, sessionId, "대상: 참여자 2");
    await triggerMapPick(cdp, sessionId);
    await waitForInputValue(cdp, sessionId, "참여자 2 주소", "서울 마포구 양화로 160");
    await clickByText(cdp, sessionId, "중간장소 찾기");
    await waitForText(cdp, sessionId, "추천 후보 3곳");
    await waitForText(cdp, sessionId, "서울역");
    await waitForText(cdp, sessionId, "참여자별 이동시간");
    await delay(500);

    const value = await evaluate(cdp, sessionId, `(() => {
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
            text,
            clientWidth: root.clientWidth,
            scrollWidth: root.scrollWidth,
            bodyWidth: body ? body.scrollWidth : 0,
            overflowNodes,
        };
    })()`);

    for (const text of ["중간장소 최적화", "서울역", "참여자별 이동시간", "두 출발지 모두"]) {
        if (!value.text.includes(text)) {
            throw new Error(`optimizer ${viewport.name}: missing text ${text}`);
        }
    }

    const blocked = blockedTexts.filter((text) => value.text.includes(text));
    if (blocked.length) {
        throw new Error(`optimizer ${viewport.name}: blocked text ${blocked.join(", ")}`);
    }

    const overflow = Math.max(value.scrollWidth, value.bodyWidth) - value.clientWidth;
    if (overflow > 3) {
        throw new Error(`optimizer ${viewport.name}: horizontal overflow ${overflow}px ${JSON.stringify(value.overflowNodes)}`);
    }

    return `optimizer ${viewport.name}: ok ${value.clientWidth}/${value.scrollWidth}`;
}

async function main() {
    assertOptimizerSourceBoundaries();

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
        if (!targetId) throw new Error("Could not create Chrome target for optimizer smoke test.");
        const attachResponse = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
        sessionId = attachResponse.result?.sessionId;
        if (!sessionId) throw new Error("Could not attach to Chrome target for optimizer smoke test.");

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
                const smokeAddresses = [
                    "서울 강남구 테헤란로 152",
                    "서울 마포구 양화로 160",
                    "서울 종로구 종로 1"
                ];
                window.__smokePostcodeIndex = 0;
                window.__smokeReverseGeocodeIndex = 0;
                window.__smokeNaverHandlers = {};
                window.daum = {
                    Postcode: class {
                        constructor(options = {}) { this.options = options; }
                        open() {
                            const address = smokeAddresses[window.__smokePostcodeIndex % smokeAddresses.length];
                            window.__smokePostcodeIndex += 1;
                            this.options.oncomplete && this.options.oncomplete({ roadAddress: address, jibunAddress: address, address });
                        }
                    },
                };
                class SmokeLatLng {
                    constructor(lat, lng) { this._lat = Number(lat); this._lng = Number(lng); this.y = this._lat; this.x = this._lng; }
                    lat() { return this._lat; }
                    lng() { return this._lng; }
                }
                class SmokeMap {
                    constructor(node, options = {}) { this.node = node; this.options = options; this.center = options.center; this.zoom = options.zoom; }
                    setCenter(center) { this.center = center; }
                    setZoom(zoom) { this.zoom = zoom; }
                    fitBounds(bounds) { this.bounds = bounds; }
                    panTo(center) { this.center = center; }
                    getProjection() {
                        return {
                            fromOffsetToCoord: () => new SmokeLatLng(37.5665, 126.978),
                            fromPointToCoord: () => new SmokeLatLng(37.5665, 126.978),
                        };
                    }
                }
                class SmokeMarker {
                    constructor(options = {}) { this.options = options; this.map = options.map; this.position = options.position; }
                    setMap(map) { this.map = map; }
                    getPosition() { return this.position; }
                }
                class SmokeInfoWindow {
                    constructor(options = {}) { this.options = options; this.opened = false; }
                    open() { this.opened = true; }
                    close() { this.opened = false; }
                }
                class SmokeBounds {
                    constructor() { this.points = []; }
                    extend(point) { this.points.push(point); }
                    isEmpty() { return this.points.length === 0; }
                }
                window.naver = {
                    maps: {
                        Map: SmokeMap,
                        Marker: SmokeMarker,
                        InfoWindow: SmokeInfoWindow,
                        LatLng: SmokeLatLng,
                        LatLngBounds: SmokeBounds,
                        Point: class { constructor(x, y) { this.x = x; this.y = y; } },
                        Event: {
                            addListener: (target, type, handler) => {
                                window.__smokeNaverHandlers[type] = window.__smokeNaverHandlers[type] || [];
                                window.__smokeNaverHandlers[type].push(handler);
                                return { target, type, handler };
                            },
                            removeListener: () => {},
                        },
                        Service: {
                            Status: { OK: "OK" },
                            reverseGeocode: ({ coords }, callback) => {
                                const address = smokeAddresses[window.__smokeReverseGeocodeIndex % smokeAddresses.length];
                                window.__smokeReverseGeocodeIndex += 1;
                                callback("OK", {
                                    v2: { address: { roadAddress: address, jibunAddress: address } },
                                });
                            },
                        },
                    },
                };
            `,
        }, sessionId);

        const results = [];
        for (const viewport of viewports) {
            results.push(await inspectOptimizer(cdp, sessionId, viewport));
        }
        if (runtimeErrors.length) {
            throw new Error(`Runtime errors: ${runtimeErrors.join(" | ")}`);
        }
        results.forEach((result) => console.log(result));
        console.log(`optimizer-ui-smoke ok (${results.length} responsive checks)`);
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
