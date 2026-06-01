import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
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
const userDataDir = mkdtempSync(path.join(tmpdir(), "facility-ui-smoke-"));
const viewports = [
    { name: "desktop", width: 1366, height: 900, mobile: false },
    { name: "mobile", width: 390, height: 844, mobile: true },
];
const tabChecks = [
    { tab: "주차장", heading: "주차장 요금비교", result: "시청 공영주차장" },
    { tab: "화장실", heading: "화장실 찾기", result: "청계천 공중화장실" },
    { tab: "도서관", heading: "도서관 찾기", result: "중앙도서관" },
    { tab: "대피소", heading: "대피소 찾기", result: "시민안전 대피소" },
    { tab: "의료시설", heading: "의료시설 찾기", result: "서울의료원" },
];
const blockedTexts = ["Parking", "Restroom", "Library", "Bunker", "Medical", "Loading", "Error"];

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

function encodeBody(value) {
    return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

function encodeText(value) {
    return Buffer.from(value, "utf8").toString("base64");
}

function lotBody(items) {
    return {
        data: {
            total_count: items.length,
            items,
        },
    };
}

function routeMock(url, method) {
    const { hostname, pathname } = new URL(url);

    if (method === "GET" && hostname === "oapi.map.naver.com") {
        return {
            status: 200,
            contentType: "application/javascript; charset=utf-8",
            bodyText: "",
        };
    }

    if (method === "GET" && pathname === "/api/members") {
        return {
            status: 200,
            body: {
                data: {
                    member_id: 100,
                    name: "시설 검증자",
                    roles: ["ROLE_USER"],
                },
            },
        };
    }

    if (method === "GET" && pathname === "/api/parking/lots") {
        return {
            status: 200,
            body: lotBody([
                {
                    parking_lot_id: 11,
                    parking_name: "시청 공영주차장",
                    road_address: "서울 중구 세종대로",
                    fee_info: "유료",
                    base_fee: 1200,
                    base_time_minutes: 30,
                    extra_fee: 600,
                    extra_time_minutes: 10,
                    weekday_start: "09:00",
                    weekday_end: "22:00",
                    parking_spaces: 120,
                    phone_number: "02-0000-0000",
                    latitude: 37.5665,
                    longitude: 126.978,
                    distance_km: 0.4,
                },
            ]),
        };
    }

    if (method === "GET" && pathname === "/api/restrooms/lots") {
        return {
            status: 200,
            body: lotBody([
                {
                    restroom_lot_id: 21,
                    restroom_name: "청계천 공중화장실",
                    restroom_type: "공중화장실",
                    road_address: "서울 종로구 청계천로",
                    opening_time: "상시",
                    male_toilet_count: 3,
                    female_toilet_count: 4,
                    emergency_bell_yn: "Y",
                    entrance_cctv_yn: "Y",
                    latitude: 37.569,
                    longitude: 126.982,
                    distance_km: 0.8,
                },
            ]),
        };
    }

    if (method === "GET" && pathname === "/api/libraries/lots") {
        return {
            status: 200,
            body: lotBody([
                {
                    library_lot_id: 31,
                    library_name: "중앙도서관",
                    library_type: "공공도서관",
                    road_address: "서울 중구 도서관길",
                    weekday_start: "09:00",
                    weekday_end: "20:00",
                    reading_seat_count: 180,
                    book_count: 45000,
                    phone_number: "02-1111-1111",
                    homepage_url: "https://example.com",
                    latitude: 37.565,
                    longitude: 126.98,
                    distance_km: 1.1,
                },
            ]),
        };
    }

    if (method === "GET" && pathname === "/api/bunkers/lots") {
        return {
            status: 200,
            body: lotBody([
                {
                    bunker_lot_id: 41,
                    facility_name: "시민안전 대피소",
                    road_address: "서울 중구 안전로",
                    operation_status: "사용중",
                    facility_category: "민방위대피시설",
                    facility_location: "지하 1층",
                    max_capacity: 560,
                    facility_area_square_meter: 320,
                    latitude: 37.567,
                    longitude: 126.981,
                    distance_km: 0.7,
                },
            ]),
        };
    }

    if (method === "GET" && pathname === "/api/medical/lots") {
        return {
            status: 200,
            body: lotBody([
                {
                    medical_lot_id: 51,
                    institution_name: "서울의료원",
                    institution_type: "종합병원",
                    road_address: "서울 중구 의료로",
                    primary_equipment_category: "CT",
                    total_equipment_count: 12,
                    equipment_type_count: 4,
                    opened_at: "2024-01-01",
                    latitude: 37.568,
                    longitude: 126.983,
                    distance_km: 1.2,
                },
            ]),
        };
    }

    if (method === "GET" && pathname === "/api/medical/lots/51") {
        return {
            status: 200,
            body: {
                data: {
                    equipment_items: [
                        {
                            equipment_category_name: "CT",
                            equipment_category_code: "C01",
                            equipment_type_name: "전산화단층촬영장치",
                            equipment_type_code: "C0101",
                            model_name: "검증 모델",
                            permit_no: "K-0001",
                        },
                    ],
                },
            },
        };
    }

    if (method === "GET" && pathname === "/api/chat/rooms") {
        return { status: 200, body: { data: [] } };
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
        body: mock.bodyText !== undefined ? encodeText(mock.bodyText) : encodeBody(mock.body),
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
        title: document.title,
        readyState: document.readyState,
        bodyText: document.body?.innerText?.slice(0, 300) || "",
        bodyLength: document.body?.innerHTML?.length || 0,
    }))()`).catch(() => null);
    throw new Error(`Timed out waiting for text: ${text}${pageState ? `; page: ${JSON.stringify(pageState)}` : ""}`);
}

async function clickByText(cdp, sessionId, text) {
    const clicked = await evaluate(cdp, sessionId, `(() => {
        const target = Array.from(document.querySelectorAll("button,a"))
            .find((node) => (node.innerText || node.getAttribute("aria-label") || "").includes(${JSON.stringify(text)}));
        if (!target) return false;
        target.click();
        return true;
    })()`);
    if (!clicked) throw new Error(`Could not click text: ${text}`);
}

async function inspectFacility(cdp, sessionId, viewport) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.mobile ? 2 : 1,
        mobile: viewport.mobile,
    }, sessionId);
    const navigation = await cdp.send("Page.navigate", { url: `${baseUrl}/app/facility` }, sessionId);
    if (navigation.result?.errorText) {
        throw new Error(`facility ${viewport.name}: navigation failed ${navigation.result.errorText}`);
    }
    await waitForText(cdp, sessionId, "주변 찾기");

    for (const check of tabChecks) {
        await clickByText(cdp, sessionId, check.tab);
        await waitForText(cdp, sessionId, check.heading);
        await waitForText(cdp, sessionId, check.result);
    }
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

    for (const text of ["주차장", "화장실", "도서관", "대피소", "의료시설", "서울의료원"]) {
        if (!value.text.includes(text)) {
            throw new Error(`facility ${viewport.name}: missing text ${text}`);
        }
    }

    const blocked = blockedTexts.filter((text) => value.text.includes(text));
    if (blocked.length) {
        throw new Error(`facility ${viewport.name}: blocked English text ${blocked.join(", ")}`);
    }

    const overflow = Math.max(value.scrollWidth, value.bodyWidth) - value.clientWidth;
    if (overflow > 3) {
        throw new Error(`facility ${viewport.name}: horizontal overflow ${overflow}px ${JSON.stringify(value.overflowNodes)}`);
    }

    return `facility ${viewport.name}: ok ${value.clientWidth}/${value.scrollWidth}`;
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

    const cdp = new PipeCdp(chrome);
    let sessionId = null;
    const runtimeErrors = [];

    try {
        await cdp.send("Browser.getVersion");
        const targetResponse = await cdp.send("Target.createTarget", { url: "about:blank" });
        const targetId = targetResponse.result?.targetId;
        if (!targetId) {
            throw new Error("Could not create Chrome target for facility smoke test.");
        }
        const attachResponse = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
        sessionId = attachResponse.result?.sessionId;
        if (!sessionId) {
            throw new Error("Could not attach to Chrome target for facility smoke test.");
        }

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
            } else if (debug && message.method?.startsWith("Network.")) {
                const params = message.params || {};
                const request = params.request || {};
                const response = params.response || {};
                console.log("network", message.method, request.url || response.url || params.errorText || params.requestId || "");
            }
        });

        await cdp.send("Page.enable", {}, sessionId);
        await cdp.send("Runtime.enable", {}, sessionId);
        await cdp.send("Network.enable", {}, sessionId);
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
                class SmokeLatLng {
                    constructor(lat, lng) { this._lat = Number(lat); this._lng = Number(lng); this.y = this._lat; this.x = this._lng; }
                    lat() { return this._lat; }
                    lng() { return this._lng; }
                }
                class SmokeMap {
                    constructor(node, options = {}) { this.node = node; this.options = options; this.center = options.center; }
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
                    constructor(options = {}) { this.options = options; this.map = options.map; }
                    setMap(map) { this.map = map; }
                }
                class SmokeInfoWindow {
                    constructor(options = {}) { this.options = options; this.opened = false; }
                    open() { this.opened = true; }
                    close() { this.opened = false; }
                }
                class SmokeBounds {
                    constructor() { this.points = []; }
                    extend(point) { this.points.push(point); }
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
                            addListener: (target, type, handler) => ({ target, type, handler }),
                            removeListener: () => {},
                        },
                    },
                };
            `,
        }, sessionId);

        const results = [];
        for (const viewport of viewports) {
            results.push(await inspectFacility(cdp, sessionId, viewport));
        }
        if (runtimeErrors.length) {
            throw new Error(`Runtime errors: ${runtimeErrors.join(" | ")}`);
        }
        results.forEach((result) => console.log(result));
        console.log(`facility-ui-smoke ok (${results.length} responsive checks)`);
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
