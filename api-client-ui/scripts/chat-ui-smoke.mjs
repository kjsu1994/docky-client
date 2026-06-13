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
const userDataDir = mkdtempSync(path.join(tmpdir(), "chat-ui-smoke-"));
const viewports = [
    { name: "desktop", width: 1366, height: 900, mobile: false },
    { name: "mobile", width: 390, height: 844, mobile: true },
];
const listTexts = ["채팅방", "운영 회의", "최근 메시지입니다.", "대화방을 선택해주세요."];
const roomTexts = ["운영 회의", "실시간", "배포 일정 확인했습니다.", "release-note.pdf", "PDF", "차단된 첨부", "첨부파일을 표시할 수 없습니다."];
const blockedTexts = ["Chat Room", "Anonymous", "Invite", "Loading", "Error", "ME"];

let nextMessageId = 1;
const pending = new Map();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function assertStaticChatAuthWiring() {
    const adapterSource = readFileSync("src/adapters/realtimeAdapter.js", "utf8");
    if (!adapterSource.includes("buildStompConnectHeaders") || !adapterSource.includes("Bearer ${token}")) {
        throw new Error("chat-ui-smoke: realtimeAdapter must build STOMP Authorization headers.");
    }
    if (!adapterSource.includes("notifyRealtimeError")
        || !adapterSource.includes("getRealtimeErrorMessage")
        || !adapterSource.includes("REALTIME_ERROR_NOTICE_COOLDOWN_MS")) {
        throw new Error("chat-ui-smoke: realtimeAdapter must centralize safe STOMP error notification handling.");
    }
    const chatAdapterSource = readFileSync("src/adapters/chatAdapter.js", "utf8");
    if (!chatAdapterSource.includes("member_ids: memberIds")) {
        throw new Error("chat-ui-smoke: chat room creation must send member_ids for the server snake_case contract.");
    }
    if (!chatAdapterSource.includes("normalizeMemberSearchKeyword(keyword)")) {
        throw new Error("chat-ui-smoke: chat member search must normalize keyword before /members/list.");
    }
    if (!chatAdapterSource.includes("getApiErrorMessage(error, fallback)")) {
        throw new Error("chat-ui-smoke: chat errors must use the shared API error formatter.");
    }
    if (!chatAdapterSource.includes("compareMessagesByChronology")
        || !chatAdapterSource.includes(".sort(compareMessagesByChronology)")) {
        throw new Error("chat-ui-smoke: chat messages must use one shared stable chronology comparator.");
    }
    if (chatAdapterSource.includes("Math.random().toString(36)")) {
        throw new Error("chat-ui-smoke: chat message ids must not use random fallback fingerprints.");
    }
    if (!chatAdapterSource.includes("hasPersistentMessageId")
        || !chatAdapterSource.includes("isSamePersistentMessage")
        || !chatAdapterSource.includes("isMatchingOptimisticMessage")) {
        throw new Error("chat-ui-smoke: chat adapter must separate server-id duplicates from optimistic/fingerprint fallback messages.");
    }
    const memberSearchBoundsSource = readFileSync("src/adapters/memberSearchBounds.js", "utf8");
    if (!memberSearchBoundsSource.includes("MEMBER_SEARCH_KEYWORD_MAX_LENGTH = 80")) {
        throw new Error("chat-ui-smoke: member search keyword bound must stay at 80 characters.");
    }

    for (const sourcePath of [
        "src/pages/chat/Chat.jsx",
        "src/components/FloatingChat.jsx",
        "src/pages/games/LasVegasGame.jsx",
        "src/pages/games/NoThanksGame.jsx",
        "src/pages/games/TabletopGame.jsx",
    ]) {
        const source = readFileSync(sourcePath, "utf8");
        if (!source.includes("buildStompConnectHeaders")) {
            throw new Error(`chat-ui-smoke: ${sourcePath} must use realtimeAdapter STOMP auth headers.`);
        }
        if (!source.includes("createStompClient")) {
            throw new Error(`chat-ui-smoke: ${sourcePath} must lazy-load the STOMP runtime through realtimeAdapter.`);
        }
        if (!source.includes("notifyRealtimeError")) {
            throw new Error(`chat-ui-smoke: ${sourcePath} must route STOMP ERROR frames through the shared safe notifier.`);
        }
        if (source.includes('notifyError("실시간 연결 오류")')) {
            throw new Error(`chat-ui-smoke: ${sourcePath} still shows raw repeated realtime error toasts.`);
        }
        if (source.includes('import SockJS from "sockjs-client"') || source.includes('import { Client } from "@stomp/stompjs"')) {
            throw new Error(`chat-ui-smoke: ${sourcePath} still statically imports the STOMP runtime.`);
        }
        if (source.includes("Bearer ${localStorage.getItem(\"accessToken\")")) {
            throw new Error(`chat-ui-smoke: ${sourcePath} still sends raw localStorage token headers.`);
        }
        if ((sourcePath === "src/pages/chat/Chat.jsx" || sourcePath === "src/components/FloatingChat.jsx")
            && (!source.includes("MEMBER_SEARCH_KEYWORD_MAX_LENGTH") || !source.includes("maxLength={MEMBER_SEARCH_KEYWORD_MAX_LENGTH}"))) {
            throw new Error(`chat-ui-smoke: ${sourcePath} must bound member search input length.`);
        }
        if (["src/pages/chat/Chat.jsx", "src/components/FloatingChat.jsx", "src/pages/games/LasVegasGame.jsx", "src/pages/games/NoThanksGame.jsx"].includes(sourcePath)
            && !source.includes("compareMessagesByChronology")) {
            throw new Error(`chat-ui-smoke: ${sourcePath} must keep realtime chat messages in stable chronology order.`);
        }
        if ((sourcePath === "src/pages/chat/Chat.jsx" || sourcePath === "src/components/FloatingChat.jsx")
            && (source.includes("key={roomId || Math.random()}") || !source.includes("getRoomKey(room, idx)"))) {
            throw new Error(`chat-ui-smoke: ${sourcePath} must use deterministic room list keys.`);
        }
        if ((sourcePath === "src/pages/chat/Chat.jsx" || sourcePath === "src/components/FloatingChat.jsx")
            && (!source.includes("key={normalized.key || normalized.id}") || source.includes("key={normalized.key || normalized.id || idx}"))) {
            throw new Error(`chat-ui-smoke: ${sourcePath} must render chat messages with deterministic normalized keys only.`);
        }
        if ((sourcePath === "src/pages/chat/Chat.jsx" || sourcePath === "src/components/FloatingChat.jsx")
            && (!source.includes("isSamePersistentMessage")
                || !source.includes("isMatchingOptimisticMessage")
                || !source.includes("!hasPersistentMessageId(normalized)"))) {
            throw new Error(`chat-ui-smoke: ${sourcePath} must avoid fingerprint dedupe for server-id chat messages.`);
        }
        if ((sourcePath === "src/pages/chat/Chat.jsx" || sourcePath === "src/components/FloatingChat.jsx")
            && (!source.includes("첨부파일을 표시할 수 없습니다.") || source.includes("href={messageFileUrl || undefined}"))) {
            throw new Error(`chat-ui-smoke: ${sourcePath} must render invalid attachment URLs as a disabled file state.`);
        }
    }
}

function assertStaticChatToastRuntimeBoundary() {
    for (const sourcePath of [
        "src/pages/chat/Chat.jsx",
        "src/components/FloatingChat.jsx",
    ]) {
        const source = readFileSync(sourcePath, "utf8");
        if (source.includes("from \"react-hot-toast\"") || /\btoast\.(success|error|loading|custom|dismiss|remove)\b/.test(source)) {
            throw new Error(`chat-ui-smoke: ${sourcePath} must use the dynamic toast helper instead of static react-hot-toast imports.`);
        }
        if (!source.includes("notifyError") || !source.includes("notifySuccess")) {
            throw new Error(`chat-ui-smoke: ${sourcePath} must keep chat success/error notifications on the dynamic toast runtime boundary.`);
        }
    }
}

function assertStaticChatSendFailureUx() {
    const requiredSnippets = [
        "채팅방을 선택한 뒤 메시지를 보내 주세요.",
        "채팅 연결이 아직 준비되지 않았습니다. 잠시 후 다시 보내 주세요.",
        "메시지를 전송하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.",
        "filter((message) => message.id !== tempId)",
        "방 제목을 입력해 주세요.",
        "방이 생성되었습니다. 멤버를 초대해 보세요.",
    ];

    for (const sourcePath of [
        "src/pages/chat/Chat.jsx",
        "src/components/FloatingChat.jsx",
    ]) {
        const source = readFileSync(sourcePath, "utf8");
        const missing = requiredSnippets.filter((snippet) => !source.includes(snippet));
        if (missing.length) {
            throw new Error(`chat-ui-smoke: ${sourcePath} must keep polished send failure UX snippets: ${missing.join(", ")}`);
        }
        for (const blocked of ["메시지 전송 실패", "방 제목을 입력해주세요", "초대해보세요!"]) {
            if (source.includes(blocked)) {
                throw new Error(`chat-ui-smoke: ${sourcePath} still has rough chat feedback copy: ${blocked}`);
            }
        }
    }

    const floatingSource = readFileSync("src/components/FloatingChat.jsx", "utf8");
    if (!floatingSource.includes("fetchRooms({ force: true })")) {
        throw new Error("chat-ui-smoke: floating chat must resync room previews after send failure.");
    }
}

function assertStaticFloatingChatAccessibility() {
    const source = readFileSync("src/components/FloatingChat.jsx", "utf8");
    if (!source.includes("aria-haspopup=\"dialog\"") || !source.includes("aria-controls={isOpen ? panelId : undefined}") || !source.includes("aria-expanded={isOpen && !isMinimized}")) {
        throw new Error("chat-ui-smoke: floating chat launcher must expose dialog relationship state.");
    }
    if (!source.includes("data-floating-chat-panel=\"true\"") || !source.includes("role=\"dialog\"") || !source.includes("aria-labelledby={panelTitleId}") || !source.includes("aria-describedby={panelDescriptionId}")) {
        throw new Error("chat-ui-smoke: floating chat panel must be labelled as a dialog.");
    }
    if (!source.includes("panelCloseButtonRef.current?.focus()") || !source.includes("launcherRef.current?.focus()")) {
        throw new Error("chat-ui-smoke: floating chat panel must move focus in and restore launcher focus.");
    }
    if (!source.includes("event.key === \"Escape\"") || !source.includes("closeChat()")) {
        throw new Error("chat-ui-smoke: floating chat panel must close from Escape.");
    }
    if (!source.includes("trapFocus(event, panelRef.current)")) {
        throw new Error("chat-ui-smoke: floating chat panel must trap Tab focus while open.");
    }
    if (!source.includes("aria-modal=\"true\"") || !source.includes("aria-labelledby={modalTitleId}") || !source.includes("aria-describedby={modalDescriptionId}") || !source.includes("modalCloseButtonRef.current?.focus()")) {
        throw new Error("chat-ui-smoke: floating chat create/invite modal must keep ARIA and focus wiring.");
    }
    if (!source.includes("trapFocus(event, modalPanelRef.current)")) {
        throw new Error("chat-ui-smoke: floating chat create/invite modal must trap Tab focus while open.");
    }
    if (!/useEffect\(\(\) => \(\) => \{[\s\S]*clearTimeout\(dragHoldTimerRef\.current\)[\s\S]*dragHoldTimerRef\.current = null;[\s\S]*\}, \[\]\);/.test(source)) {
        throw new Error("chat-ui-smoke: floating chat drag hold timer must be cleared on unmount.");
    }
    if (!/dragHoldTimerRef\.current = setTimeout\(\(\) => \{[\s\S]*dragHoldTimerRef\.current = null;[\s\S]*setDragReady\(true\)/.test(source)) {
        throw new Error("chat-ui-smoke: floating chat drag hold timer callback must clear the stored timer handle.");
    }
}

function assertStaticFullChatAccessibility() {
    const source = readFileSync("src/pages/chat/Chat.jsx", "utf8");
    if (!source.includes("useId") || !source.includes("modalTitleId") || !source.includes("modalDescriptionId")) {
        throw new Error("chat-ui-smoke: full chat create/invite modal must use stable ARIA ids.");
    }
    if (!source.includes("role=\"dialog\"") || !source.includes("aria-modal=\"true\"") || !source.includes("aria-labelledby={modalTitleId}") || !source.includes("aria-describedby={modalDescriptionId}")) {
        throw new Error("chat-ui-smoke: full chat create/invite modal must be labelled as a modal dialog.");
    }
    if (!source.includes("modalCloseButtonRef.current?.focus()") || !source.includes("previousFocus.focus()") || !source.includes("event.key === \"Escape\"")) {
        throw new Error("chat-ui-smoke: full chat create/invite modal must support focus movement, restoration, and Escape close.");
    }
    if (!source.includes("trapFocus(event, modalPanelRef.current)")) {
        throw new Error("chat-ui-smoke: full chat create/invite modal must trap Tab focus while open.");
    }
    if (!source.includes("htmlFor={roomTitleInputId}") || !source.includes("id={roomTitleInputId}") || !source.includes("htmlFor={memberSearchInputId}") || !source.includes("id={memberSearchInputId}")) {
        throw new Error("chat-ui-smoke: full chat modal inputs must be connected to labels.");
    }
    for (const label of [
        "채팅방 목록 새로고침",
        "AI 채팅방 열기",
        "새 채팅방 만들기",
        "채팅방 목록 열기",
        "파일 첨부",
        "메시지 보내기",
        "채팅 모달 닫기",
    ]) {
        if (!source.includes(label)) {
            throw new Error(`chat-ui-smoke: full chat missing icon button label ${label}.`);
        }
    }
}

async function waitForJson(url, timeoutMs = 10000) {
    const started = Date.now();
    let lastError;
    while (Date.now() - started < timeoutMs) {
        try {
            const response = await fetch(url);
            if (response.ok) return response.json();
            lastError = new Error(`${response.status} ${response.statusText}`);
        } catch (error) {
            lastError = error;
        }
        await delay(120);
    }
    throw lastError || new Error(`Timed out waiting for ${url}`);
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
                    email: "smoke@example.com",
                    name: "검증 사용자",
                    member_status: "MEMBER_ACTIVE",
                    roles: ["ROLE_USER"],
                },
            },
        };
    }
    if (method === "GET" && pathname === "/api/members/notifications/unread-count") {
        return { status: 200, body: { data: { unreadCount: 0 } } };
    }
    if (method === "GET" && pathname === "/api/chat/rooms") {
        return {
            status: 200,
            body: {
                data: [
                    {
                        chat_room_id: 101,
                        title: "운영 회의",
                        type: "GROUP",
                        last_message: "최근 메시지입니다.",
                        last_message_time: "2026-06-01T09:30:00+09:00",
                        unread_count: 2,
                    },
                ],
            },
        };
    }
    if (method === "GET" && pathname === "/api/chat/room/101/messages") {
        return {
            status: 200,
            body: {
                data: [
                    {
                        message_id: 1,
                        roomId: 101,
                        senderId: 100,
                        senderName: "운영자",
                        message: "배포 일정 확인했습니다.",
                        type: "TALK",
                        createdAt: "2026-06-01T09:25:00+09:00",
                    },
                    {
                        message_id: 2,
                        roomId: 101,
                        senderId: 999,
                        senderName: "검증 사용자",
                        message: "release-note.pdf",
                        type: "FILE",
                        fileName: "release-note.pdf",
                        fileUrl: "/api/chat/file/download?path=chat%2Frelease-note.pdf&name=release-note.pdf",
                        fileContentType: "application/pdf",
                        fileSize: 2048,
                        fileImage: false,
                        createdAt: "2026-06-01T09:28:00+09:00",
                    },
                    {
                        message_id: 3,
                        roomId: 101,
                        senderId: 100,
                        senderName: "운영자",
                        message: "차단된 첨부",
                        type: "FILE",
                        fileName: "차단된 첨부",
                        fileUrl: "https://example.com/private.pdf",
                        fileContentType: "application/pdf",
                        fileSize: 4096,
                        fileImage: false,
                        createdAt: "2026-06-01T09:29:00+09:00",
                    },
                ],
            },
        };
    }
    if (method === "GET" && pathname === "/api/chat/room/101/members") {
        return {
            status: 200,
            body: {
                data: [
                    { member_id: 999, name: "검증 사용자", email: "smoke@example.com" },
                    { member_id: 100, name: "운영자", email: "ops@example.com" },
                ],
            },
        };
    }
    if (method === "PATCH" && pathname === "/api/chat/room/101/read") {
        return { status: 200, body: {} };
    }
    if (method === "GET" && pathname === "/api/members/list") {
        return {
            status: 200,
            body: {
                data: [
                    { member_id: 100, name: "운영자", email: "ops@example.com" },
                    { member_id: 101, name: "디자이너", email: "design@example.com" },
                ],
            },
        };
    }
    if (method === "GET" && pathname === "/ws/chat/info") {
        return {
            status: 200,
            body: { websocket: false, origins: ["*:*"], cookie_needed: false, entropy: 123456 },
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
    const bodyText = await evaluate(ws, `document.body?.innerText.slice(0, 900) || ""`);
    throw new Error(`Timed out waiting for text: ${text}. Body: ${bodyText}`);
}

async function clickButtonByText(ws, text) {
    return evaluate(ws, `(() => {
        const button = Array.from(document.querySelectorAll("button")).find((node) => {
            const label = node.getAttribute("aria-label") || "";
            return node.textContent.includes(${JSON.stringify(text)}) || label.includes(${JSON.stringify(text)});
        });
        if (!button) return "missing";
        button.click();
        return "clicked";
    })()`);
}

async function setInputByPlaceholder(ws, placeholder, value) {
    return evaluate(ws, `(() => {
        const input = Array.from(document.querySelectorAll("input, textarea")).find((node) => node.getAttribute("placeholder") === ${JSON.stringify(placeholder)});
        if (!input) return "missing";
        const descriptor = Object.getOwnPropertyDescriptor(input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value");
        descriptor.set.call(input, ${JSON.stringify(value)});
        input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
        return "changed";
    })()`);
}

async function inspectTextAndOverflow(ws, viewport, label, requiredTexts) {
    for (const text of requiredTexts) {
        await waitForText(ws, text);
    }
    await delay(250);

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

    const missing = requiredTexts.filter((text) => !value.text.includes(text));
    if (missing.length) {
        throw new Error(`${label} ${viewport.name}: missing text ${missing.join(", ")}`);
    }

    const blocked = blockedTexts.filter((text) => value.text.includes(text));
    if (blocked.length) {
        throw new Error(`${label} ${viewport.name}: blocked text ${blocked.join(", ")}`);
    }

    const overflow = Math.max(value.scrollWidth, value.bodyWidth) - value.clientWidth;
    if (overflow > 3) {
        throw new Error(`${label} ${viewport.name}: horizontal overflow ${overflow}px ${JSON.stringify(value.overflowNodes)}`);
    }

    return `${label} ${viewport.name}: ok ${value.clientWidth}/${value.scrollWidth} ${value.url}`;
}

async function inspectChat(ws, viewport) {
    await send(ws, "Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.mobile ? 2 : 1,
        mobile: viewport.mobile,
    });

    await send(ws, "Page.navigate", { url: `${baseUrl}/app/chat` });
    const listResult = await inspectTextAndOverflow(ws, viewport, "chat list", listTexts);

    if (await setInputByPlaceholder(ws, "방 이름 또는 최근 메시지 검색", "없는방") !== "changed") {
        throw new Error(`chat ${viewport.name}: room search input missing`);
    }
    await waitForText(ws, "검색 결과가 없습니다.");
    if (await setInputByPlaceholder(ws, "방 이름 또는 최근 메시지 검색", "") !== "changed") {
        throw new Error(`chat ${viewport.name}: room search clear failed`);
    }
    await waitForText(ws, "운영 회의");

    if (await clickButtonByText(ws, "운영 회의") !== "clicked") {
        throw new Error(`chat ${viewport.name}: room button missing`);
    }
    const roomResult = await inspectTextAndOverflow(ws, viewport, "chat room", roomTexts);
    const composerControls = await evaluate(ws, `(() => {
        const input = Array.from(document.querySelectorAll("textarea,input"))
            .find((node) => (node.placeholder || "").includes("메시지를 입력") || (node.placeholder || "").includes("질문을 입력"));
        const text = document.body?.innerText || "";
        return {
            hasInput: Boolean(input),
            maxLength: input ? input.maxLength : null,
            hasCounter: text.includes("0 / 2,000"),
        };
    })()`);
    if (!composerControls.hasInput || composerControls.maxLength !== 2000 || !composerControls.hasCounter) {
        throw new Error(`chat ${viewport.name}: composer controls failed ${JSON.stringify(composerControls)}`);
    }

    if (await clickButtonByText(ws, "초대") !== "clicked") {
        throw new Error(`chat ${viewport.name}: invite button missing`);
    }
    const inviteResult = await inspectTextAndOverflow(ws, viewport, "chat invite", ["멤버 초대", "운영자", "디자이너"]);

    return [listResult, roomResult, inviteResult];
}

async function main() {
    assertStaticChatAuthWiring();
    assertStaticChatToastRuntimeBoundary();
    assertStaticChatSendFailureUx();
    assertStaticFloatingChatAccessibility();
    assertStaticFullChatAccessibility();

    const chrome = spawn(chromePath, [
        "--headless=new",        "--remote-debugging-pipe",
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
        const ws = await createPipeSession(chrome, { debug, testName: "chat-ui-smoke" });
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
                { urlPattern: "*://localhost/ws/chat/*", requestStage: "Request" },
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
            results.push(...await inspectChat(ws, viewport));
        }
        if (runtimeErrors.length) {
            throw new Error(`Runtime errors: ${runtimeErrors.join(" | ")}`);
        }
        results.forEach((result) => console.log(result));
        console.log(`chat-ui-smoke ok (${results.length} responsive checks)`);
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


