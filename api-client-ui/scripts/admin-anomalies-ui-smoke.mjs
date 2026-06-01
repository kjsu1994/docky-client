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

const debug = process.env.SMOKE_DEBUG === "1";
const userDataDir = mkdtempSync(path.join(tmpdir(), "admin-anomalies-ui-smoke-"));
const viewports = [
    { name: "desktop", width: 1366, height: 900, mobile: false, interactive: true },
    { name: "mobile", width: 390, height: 844, mobile: true, interactive: false },
];
const requiredTexts = [
    "관리자 대시보드",
    "전체 회원",
    "이상징후 KPI",
    "실시간 이상징후 이벤트",
    "회원 제재",
    "통합 감사 로그",
    "관리자 알림",
    "사용자 신고",
    "권한 관리",
    "권한 변경 이력",
    "이상징후 사건함",
    "탐지 규칙 관리",
    "관리자",
    "회원",
];
const blockedTexts = ["Loading", "Error", "undefined", "NaN", "ROLE_USER", "ROLE_ADMIN", "ROLE_MASTER", "NEW", "REVIEWING", "ACTIVE", "OPEN"];

let nextMessageId = 1;
const pending = new Map();
let incidentDetailRequests = 0;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const encodeBody = (value) => Buffer.from(JSON.stringify(value), "utf8").toString("base64");
const encodeText = (value) => Buffer.from(value, "utf8").toString("base64");

function send(ws, method, params = {}) {
    const id = nextMessageId++;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject, method });
    });
}

const page = (items, size = 10, extra = {}) => ({
    data: {
        items,
        page: 1,
        size,
        totalElements: items.length,
        totalPages: 1,
        ...extra,
    },
});

const incident = {
    incidentId: 41,
    metric: "login.attempt",
    actorId: "member-77",
    incidentStatus: "NEW",
    assignee: "보안팀",
    note: "로그인 시도 급증 확인",
    zScore: 4.8,
    detectedAt: "2026-06-01 10:00",
};

function routeMock(url, method) {
    const parsed = new URL(url);
    const { hostname, pathname } = parsed;

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
                    name: "검증 마스터",
                    email: "master@example.com",
                    roles: ["ROLE_MASTER"],
                },
            },
        };
    }
    if (method === "GET" && pathname === "/api/chat/rooms") {
        return { status: 200, body: { data: [] } };
    }
    if (method === "GET" && pathname === "/api/stats/summary") {
        return {
            status: 200,
            body: {
                data: {
                    total_members: 142,
                    total_boards: 58,
                    total_comments: 390,
                    today_visitors: 117,
                },
            },
        };
    }
    if (method === "GET" && pathname === "/api/stats/anomalies") {
        return {
            status: 200,
            body: {
                data: [
                    {
                        metric: "login.attempt",
                        actorId: "member-77",
                        detectedAt: "2026-06-01 10:00",
                        zScore: 4.8,
                    },
                ],
            },
        };
    }
    if (method === "GET" && pathname === "/api/admin/anomalies/kpi") {
        return {
            status: 200,
            body: {
                data: {
                    totalIncidents: 3,
                    newCount: 1,
                    reviewingCount: 1,
                    resolvedCount: 1,
                    falsePositiveCount: 0,
                },
            },
        };
    }
    if (method === "GET" && pathname === "/api/admin/anomalies/rules") {
        return {
            status: 200,
            body: {
                data: [
                    {
                        metric: "login.attempt",
                        hardLimitPerMinute: 30,
                        zScoreThreshold: 3.2,
                        enabled: true,
                    },
                ],
            },
        };
    }
    if (method === "GET" && pathname === "/api/admin/anomalies/incidents") {
        return { status: 200, body: page([incident], 20) };
    }
    if (method === "GET" && pathname === "/api/admin/anomalies/incidents/41") {
        incidentDetailRequests += 1;
        return {
            status: 200,
            body: {
                data: {
                    incident,
                    actions: [
                        {
                            actionLogId: 8,
                            actionType: "회원 경고",
                            actor: "master@example.com",
                            description: "로그인 시도 급증 안내",
                            createdAt: "2026-06-01 10:05",
                        },
                    ],
                },
            },
        };
    }
    if (method === "GET" && pathname === "/api/admin/notifications") {
        return {
            status: 200,
            body: page([
                {
                    notificationId: 7,
                    title: "이상징후 알림",
                    message: "로그인 시도 급증이 감지되었습니다.",
                    severity: "높음",
                    createdAt: "2026-06-01 10:00",
                },
            ], 8, { unreadCount: 1 }),
        };
    }
    if (method === "GET" && pathname === "/api/admin/reports") {
        return {
            status: 200,
            body: page([
                {
                    reportId: 12,
                    targetType: "BOARD",
                    targetId: 501,
                    reportStatus: "OPEN",
                    reason: "스팸 신고",
                    detail: "반복 홍보 게시글",
                },
            ], 10),
        };
    }
    if (method === "GET" && pathname === "/api/admin/sanctions") {
        return {
            status: 200,
            body: page([
                {
                    sanctionId: 21,
                    memberEmail: "blocked@example.com",
                    reason: "스팸 반복",
                    sanctionStatus: "ACTIVE",
                    createdAt: "2026-06-01 09:00",
                },
            ], 10),
        };
    }
    if (method === "GET" && pathname === "/api/admin/sanctions/release-requests") {
        return { status: 200, body: page([], 50) };
    }
    if (method === "GET" && pathname === "/api/admin/moderation/boards") {
        return {
            status: 200,
            body: page([
                {
                    boardId: 501,
                    board_id: 501,
                    title: "검토 게시글",
                    boardCreator: "작성자",
                    board_creator: "작성자",
                    hiddenYn: false,
                    hidden_yn: false,
                },
            ], 8),
        };
    }
    if (method === "GET" && pathname === "/api/admin/moderation/comments") {
        return {
            status: 200,
            body: page([
                {
                    commentId: 601,
                    comment_id: 601,
                    contents: "검토 댓글",
                    commentCreator: "댓글러",
                    comment_creator: "댓글러",
                    hiddenYn: false,
                    hidden_yn: false,
                },
            ], 8),
        };
    }
    if (method === "GET" && pathname === "/api/admin/audits") {
        return {
            status: 200,
            body: page([
                {
                    auditType: "SANCTION",
                    actionType: "제재 등록",
                    summary: "반복 스팸 계정 제재",
                    actor: "master@example.com",
                    createdAt: "2026-06-01 09:10",
                },
            ], 10),
        };
    }
    if (method === "GET" && pathname === "/api/admin/roles/members") {
        return {
            status: 200,
            body: page([
                {
                    memberId: 77,
                    member_id: 77,
                    name: "검증 회원",
                    email: "member@example.com",
                    roles: ["ROLE_USER", "ROLE_ADMIN"],
                    memberStatus: "ACTIVE",
                    member_status: "ACTIVE",
                },
            ], 10),
        };
    }
    if (method === "GET" && pathname === "/api/admin/roles/audits") {
        return {
            status: 200,
            body: page([
                {
                    roleAuditId: 31,
                    targetEmail: "member@example.com",
                    targetMemberId: 77,
                    changedByEmail: "master@example.com",
                    afterRoles: "ROLE_USER,ROLE_ADMIN",
                    changeReason: "운영 검증",
                    createdAt: "2026-06-01 09:30",
                },
            ], 10),
        };
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

async function waitForText(ws, text, timeoutMs = 7000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (await evaluate(ws, `document.body?.innerText.includes(${JSON.stringify(text)})`)) return;
        await delay(120);
    }
    const bodyText = await evaluate(ws, `document.body?.innerText.slice(0, 1000) || ""`);
    throw new Error(`Timed out waiting for text: ${text}. Body: ${bodyText}`);
}

async function inspectQuality(ws, label) {
    const value = await evaluate(ws, `(() => {
        const root = document.documentElement;
        const body = document.body;
        const text = body ? body.innerText : "";
        const overflowNodes = Array.from(document.querySelectorAll("body *"))
            .map((node) => {
                const rect = node.getBoundingClientRect();
                return {
                    tag: node.tagName,
                    text: (node.innerText || node.getAttribute("aria-label") || node.getAttribute("title") || "").trim().slice(0, 80),
                    width: Math.round(rect.width),
                    right: Math.round(rect.right),
                };
            })
            .filter((node) => node.right > root.clientWidth + 2 && node.width > 0)
            .slice(0, 5);
        return {
            text,
            url: location.href,
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
        const details = blocked.map((text) => {
            const index = value.text.indexOf(text);
            return `${text}: ${value.text.slice(Math.max(0, index - 80), index + text.length + 80)}`;
        });
        throw new Error(`${label}: blocked text ${blocked.join(", ")}\n${details.join("\n")}`);
    }

    const overflow = Math.max(value.scrollWidth, value.bodyWidth) - value.clientWidth;
    if (overflow > 3) {
        throw new Error(`${label}: horizontal overflow ${overflow}px ${JSON.stringify(value.overflowNodes)}`);
    }

    return `${label}: ok ${value.clientWidth}/${value.scrollWidth} ${value.url}`;
}

async function clickButtonByTitle(ws, title) {
    return evaluate(ws, `(() => {
        const button = Array.from(document.querySelectorAll("button")).find((node) => node.getAttribute("title") === ${JSON.stringify(title)});
        if (!button) return "missing";
        button.scrollIntoView({ block: "center", inline: "center" });
        button.click();
        return "clicked";
    })()`);
}

async function inspectAdminAnomalies(ws, viewport) {
    await send(ws, "Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.mobile ? 2 : 1,
        mobile: viewport.mobile,
    });
    await send(ws, "Page.navigate", { url: `${baseUrl}/app/admin/anomalies` });

    for (const text of requiredTexts) {
        await waitForText(ws, text);
    }

    if (viewport.interactive) {
        if (await clickButtonByTitle(ws, "상세 보기") !== "clicked") {
            throw new Error("admin anomalies desktop: incident detail button missing");
        }
        await waitForText(ws, "사건 상세 분석");
        await waitForText(ws, "대기열 차단");
        await waitForText(ws, "로그인 시도 급증 안내");
        if (incidentDetailRequests < 1) {
            throw new Error("admin anomalies desktop: incident detail API was not requested");
        }
    }

    await delay(250);
    return inspectQuality(ws, `admin anomalies ${viewport.name}`);
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
        const ws = await createPipeSession(chrome, { debug, testName: "admin-anomalies-ui-smoke" });
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
                localStorage.setItem("accessToken", "smoke-master-access-token");
                localStorage.setItem("refreshToken", "smoke-master-refresh-token");
                localStorage.setItem("userRoles", JSON.stringify(["ROLE_MASTER"]));
            `,
        });

        const results = [];
        for (const viewport of viewports) {
            results.push(await inspectAdminAnomalies(ws, viewport));
        }
        if (runtimeErrors.length) {
            throw new Error(`Runtime errors: ${runtimeErrors.join(" | ")}`);
        }
        results.forEach((result) => console.log(result));
        console.log(`admin-anomalies-ui-smoke ok (${results.length} responsive checks)`);
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
