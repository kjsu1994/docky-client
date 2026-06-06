import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const scanRoots = [
    "src",
    "scripts",
    "README.md",
    "docs/SCREEN_API_MAPPING.md",
];

const ignoredDirs = new Set(["node_modules", "dist", ".git"]);
const checkedExtensions = new Set([".js", ".jsx", ".mjs", ".css", ".md"]);
const scriptExtensions = new Set([".js", ".jsx", ".mjs"]);
const textExtensions = new Set([".css", ".md"]);
const badTextPattern = /[\u3400-\u9fff\uf900-\ufaff\ufffd]/u;
const commonMojibakePattern = /(?:\u00ec|\u00eb|\u00ea|\u00ed|\u00c3|\u00c2|\u00e2\u20ac|\u00e2\u20ac\u2122|\u00e2\u20ac\u0153|\u00e2\u20ac\ufffd)/u;
const repeatedQuestionPattern = /\?{2,}/u;
const escapedKoreanPattern = /\\u(?:[aA][c-fC-F][0-9a-fA-F]{2}|[bB-cC][0-9a-fA-F]{3}|[dD][0-7][0-9a-fA-F]{2})/u;
const blockedPhrases = [
    "text-fixed",
    "AUTHENTICATING",
    "CONTINUE SIGN IN",
    "LOG IN WITH GOOGLE",
    "Request Release",
    "Account Locked",
    "No XP history yet",
    "Loading XP history",
    "AdSense client",
    "AdSense slot ID",
    "e.g. login.attempt",
    "v2/v3 issue",
];

const files = [];

const walk = async (relativePath) => {
    const absolutePath = path.join(root, relativePath);
    const info = await stat(absolutePath);

    if (info.isDirectory()) {
        if (ignoredDirs.has(path.basename(relativePath))) return;
        const entries = await readdir(absolutePath);
        await Promise.all(entries.map((entry) => walk(path.join(relativePath, entry))));
        return;
    }

    if (checkedExtensions.has(path.extname(relativePath))) {
        files.push(relativePath);
    }
};

await Promise.all(scanRoots.map(walk));

const mainSource = await readFile(path.join(root, "src", "main.jsx"), "utf8");
const appSource = await readFile(path.join(root, "src", "App.jsx"), "utf8");
const consoleGuardSource = await readFile(path.join(root, "src", "utils", "consoleGuard.js"), "utf8");
const clientDiagnosticsSource = await readFile(path.join(root, "src", "utils", "clientDiagnostics.js"), "utf8");
const apiSource = await readFile(path.join(root, "src", "utils", "api.js"), "utf8");
const toastSource = await readFile(path.join(root, "src", "utils", "toast.js"), "utf8");
const appErrorBoundarySource = await readFile(path.join(root, "src", "common", "AppErrorBoundary.jsx"), "utf8");
const appErrorFallbackSource = await readFile(path.join(root, "src", "common", "AppErrorFallback.jsx"), "utf8");
const helpersSource = await readFile(path.join(root, "src", "utils", "helpers.js"), "utf8");
const authContextSource = await readFile(path.join(root, "src", "contexts", "AuthContext.jsx"), "utf8");
const loginSource = await readFile(path.join(root, "src", "pages", "access", "Login.jsx"), "utf8");
const registerSource = await readFile(path.join(root, "src", "pages", "access", "Register.jsx"), "utf8");
const queueSource = await readFile(path.join(root, "src", "pages", "access", "Queue.jsx"), "utf8");
const homeSource = await readFile(path.join(root, "src", "pages", "home", "Home.jsx"), "utf8");
const statisticsSource = await readFile(path.join(root, "src", "pages", "home", "Statistics.jsx"), "utf8");
const homeAdapterSource = await readFile(path.join(root, "src", "adapters", "homeAdapter.js"), "utf8");
const statsAdapterSource = await readFile(path.join(root, "src", "adapters", "statsAdapter.js"), "utf8");
const adminAnomaliesSource = await readFile(path.join(root, "src", "pages", "admin", "AdminAnomalies.jsx"), "utf8");
const newsSource = await readFile(path.join(root, "src", "pages", "facility", "News.jsx"), "utf8");
const todoCalendarSource = await readFile(path.join(root, "src", "pages", "facility", "TodoCalendar.jsx"), "utf8");
const boardAdapterSource = await readFile(path.join(root, "src", "adapters", "boardAdapter.js"), "utf8");
const useBoardsSource = await readFile(path.join(root, "src", "hooks", "useBoards.js"), "utf8");
const commentsSource = await readFile(path.join(root, "src", "components", "Comments.jsx"), "utf8");
const boardListSource = await readFile(path.join(root, "src", "pages", "boards", "BoardList.jsx"), "utf8");
const boardDetailSource = await readFile(path.join(root, "src", "pages", "boards", "BoardDetail.jsx"), "utf8");
const boardFormSource = await readFile(path.join(root, "src", "pages", "boards", "BoardForm.jsx"), "utf8");
const chatSource = await readFile(path.join(root, "src", "pages", "chat", "Chat.jsx"), "utf8");
const floatingChatSource = await readFile(path.join(root, "src", "components", "FloatingChat.jsx"), "utf8");
const focusTrapSource = await readFile(path.join(root, "src", "utils", "focusTrap.js"), "utf8");
const confirmActionSource = await readFile(path.join(root, "src", "common", "confirmAction.jsx"), "utf8");
const promptActionSource = await readFile(path.join(root, "src", "common", "promptAction.jsx"), "utf8");
const daumPostcodeLoaderSource = await readFile(path.join(root, "src", "utils", "daumPostcodeLoader.js"), "utf8");
const naverMapsLoaderSource = await readFile(path.join(root, "src", "utils", "naverMapsLoader.js"), "utf8");

const lineNumberAt = (source, index) => source.slice(0, index).split("\n").length;

const patternLine = (source, pattern) => {
    const index = source.search(pattern);
    return index >= 0 ? lineNumberAt(source, index) : null;
};

const skipExpression = (source, startIndex) => {
    let depth = 1;
    let index = startIndex;

    while (index < source.length && depth > 0) {
        const char = source[index];

        if (char === "'" || char === "\"" || char === "`") {
            index = skipString(source, index, true).endIndex;
            continue;
        }
        if (char === "{") {
            depth += 1;
        } else if (char === "}") {
            depth -= 1;
        }

        index += 1;
    }

    return index;
};

const skipString = (source, startIndex, expressionMode = false) => {
    const quote = source[startIndex];
    let index = startIndex + 1;
    const segments = [];
    let segmentStart = index;

    while (index < source.length) {
        const char = source[index];

        if (char === "\\") {
            index += 2;
            continue;
        }
        if (quote !== "`" && (char === "\n" || char === "\r")) {
            break;
        }
        if (quote === "`" && char === "$" && source[index + 1] === "{") {
            if (!expressionMode && segmentStart < index) {
                segments.push({ start: segmentStart, text: source.slice(segmentStart, index) });
            }
            index = skipExpression(source, index + 2);
            segmentStart = index;
            continue;
        }
        if (char === quote) {
            if (!expressionMode && segmentStart < index) {
                segments.push({ start: segmentStart, text: source.slice(segmentStart, index) });
            }
            index += 1;
            break;
        }

        index += 1;
    }

    return { endIndex: index, segments };
};

const extractStringSegments = (source) => {
    const segments = [];
    let index = 0;

    while (index < source.length) {
        const char = source[index];
        if (char === "/" && source[index + 1] === "/") {
            const endIndex = source.indexOf("\n", index + 2);
            index = endIndex >= 0 ? endIndex + 1 : source.length;
            continue;
        }
        if (char === "/" && source[index + 1] === "*") {
            const endIndex = source.indexOf("*/", index + 2);
            index = endIndex >= 0 ? endIndex + 2 : source.length;
            continue;
        }
        if (char === "'" || char === "\"" || char === "`") {
            const literal = skipString(source, index);
            segments.push(...literal.segments);
            index = literal.endIndex;
            continue;
        }

        index += 1;
    }

    return segments;
};

const failures = [];
const sourceConsoleWarnErrorFiles = new Set();

for (const file of files) {
    const source = await readFile(path.join(root, file), "utf8");
    const normalizedFile = file.split(path.sep).join("/");
    const extension = path.extname(file);

    if (badTextPattern.test(source)) {
        failures.push(`${file}:${patternLine(source, badTextPattern)}: mojibake-like text`);
    }
    if (commonMojibakePattern.test(source)) {
        failures.push(`${file}:${patternLine(source, commonMojibakePattern)}: common UTF-8 mojibake pattern`);
    }

    if (normalizedFile === "scripts/text-quality-smoke.mjs") {
        continue;
    }

    if (escapedKoreanPattern.test(source)) {
        failures.push(`${file}:${patternLine(source, escapedKoreanPattern)}: escaped Korean text`);
    }

    if (scriptExtensions.has(extension)) {
        for (const segment of extractStringSegments(source)) {
            const index = segment.text.search(repeatedQuestionPattern);
            if (index >= 0) {
                failures.push(`${file}:${lineNumberAt(source, segment.start + index)}: suspicious repeated question marks in text literal`);
            }
        }
    } else if (textExtensions.has(extension) && repeatedQuestionPattern.test(source)) {
        failures.push(`${file}:${patternLine(source, repeatedQuestionPattern)}: suspicious repeated question marks in text`);
    }

    if (normalizedFile.startsWith("src/") && /console\.(log|debug|info)\s*\(/.test(source)) {
        failures.push(`${file}: production console log/debug/info`);
    }
    if (normalizedFile.startsWith("src/") && normalizedFile !== "src/utils/consoleGuard.js" && /console\.(warn|error)\s*\(/.test(source)) {
        sourceConsoleWarnErrorFiles.add(normalizedFile);
    }
    if (normalizedFile.startsWith("src/") && /(?:window\.)?(alert|confirm|prompt)\s*\(/.test(source)) {
        failures.push(`${file}: blocking browser dialog`);
    }
    if (normalizedFile.startsWith("src/")) {
        for (const match of source.matchAll(/<a\b[^>]*target="_blank"[^>]*>/gs)) {
            if (!/rel="[^"]*\bnoopener\b[^"]*\bnoreferrer\b[^"]*"/.test(match[0])) {
                failures.push(`${file}:${lineNumberAt(source, match.index)}: target=_blank link without noopener noreferrer`);
            }
        }
        for (const match of source.matchAll(/window\.open\([^)]*["_']_blank["_'][^)]*\)/g)) {
            if (!/\bnoopener\b/.test(match[0]) || !/\bnoreferrer\b/.test(match[0])) {
                failures.push(`${file}:${lineNumberAt(source, match.index)}: window.open _blank without noopener,noreferrer`);
            }
        }
    }

    for (const phrase of blockedPhrases) {
        if (source.includes(phrase)) {
            failures.push(`${file}: blocked phrase "${phrase}"`);
        }
    }
}

if (sourceConsoleWarnErrorFiles.size > 0) {
    if (!mainSource.includes("installProductionConsoleGuard();")) {
        failures.push("src/main.jsx: production console guard is not installed");
    }
    if (!consoleGuardSource.includes("import.meta.env.PROD")
        || !consoleGuardSource.includes("ctfmon_debug_console")
        || !consoleGuardSource.includes("debug_console")) {
        failures.push("src/utils/consoleGuard.js: production console guard opt-in contract is missing");
    }
}

if (!clientDiagnosticsSource.includes("import.meta.env.DEV")
    || !clientDiagnosticsSource.includes("safeClientError")
    || !clientDiagnosticsSource.includes("toSafePath")
    || clientDiagnosticsSource.includes("response?.data")
    || clientDiagnosticsSource.includes("headers")) {
    failures.push("src/utils/clientDiagnostics.js: safe client diagnostics contract is missing");
}

const fieldErrorIndex = apiSource.indexOf("Array.isArray(data?.fieldErrors)");
const serverMessageIndex = apiSource.indexOf("isUserFacingServerMessage(serverMessage)");
if (!apiSource.includes("TECHNICAL_SERVER_MESSAGE_PATTERN")
    || !apiSource.includes("const normalizeValidationReason")
    || !apiSource.includes("root_cause")
    || fieldErrorIndex < 0
    || serverMessageIndex < 0
    || serverMessageIndex < fieldErrorIndex) {
    failures.push("src/utils/api.js: Korean safe API error-message contract is missing");
}

if (!toastSource.includes("scheduleToastCleanup")
    || !toastSource.includes("dismissAndRemoveToast")
    || !toastSource.includes("cleanupTimers")
    || !toastSource.includes("게임을 시작했습니다.")
    || !toastSource.includes("플레이어가 입장했습니다.")
    || !toastSource.includes("방을 만들었습니다.")
    || !toastSource.includes("행동이 반영되었습니다.")
    || !toastSource.includes("방 설정을 저장했습니다.")
    || !toastSource.includes("__toastRuntimeTest")
    || toastSource.includes("Math.max(0, duration) + Math.max(0, removeDelay)")
    || toastSource.includes("?뚮")) {
    failures.push("src/utils/toast.js: Korean managed toast cleanup contract is missing");
}

if (!helpersSource.includes("logClientError(\"storage.set\"")
    || !helpersSource.includes("logClientError(\"storage.remove\"")
    || /console\.(warn|error)\s*\(/.test(helpersSource)) {
    failures.push("src/utils/helpers.js: storage failures must use safe client diagnostics");
}

if (!authContextSource.includes("logClientError(\"auth.member.fetch\"")
    || !authContextSource.includes("logClientError(\"auth.queue.join\"")
    || !authContextSource.includes("logClientError(\"auth.logout\"")
    || /console\.error\s*\(/.test(authContextSource)) {
    failures.push("src/contexts/AuthContext.jsx: auth errors must use safe client diagnostics");
}

if (!loginSource.includes("logClientError(\"login.submit\"")
    || /console\.error\s*\(/.test(loginSource)) {
    failures.push("src/pages/access/Login.jsx: login errors must use safe client diagnostics");
}
if (!loginSource.includes("notifyLoading(\"해제 요청을 제출하는 중입니다...\"")
    || loginSource.includes("loadToast")) {
    failures.push("src/pages/access/Login.jsx: release request toasts must use managed Korean loading helper");
}

if (!registerSource.includes("logClientError(\"register.submit\"")
    || /console\.error\s*\(/.test(registerSource)) {
    failures.push("src/pages/access/Register.jsx: register errors must use safe client diagnostics");
}

if (!queueSource.includes("logClientError(\"queue.status.fetch\"")
    || /console\.error\s*\(/.test(queueSource)) {
    failures.push("src/pages/access/Queue.jsx: queue errors must use safe client diagnostics");
}

if (!homeSource.includes("logClientError(\"home.dashboard.fetch\"")
    || /console\.error\s*\(/.test(homeSource)) {
    failures.push("src/pages/home/Home.jsx: home dashboard errors must use safe client diagnostics");
}

if (!statisticsSource.includes("logClientError(\"statistics.trend.fetch\"")
    || !statisticsSource.includes("logClientError(\"statistics.dashboard.fetch\"")
    || /console\.error\s*\(/.test(statisticsSource)) {
    failures.push("src/pages/home/Statistics.jsx: statistics errors must use safe client diagnostics");
}

if (!homeAdapterSource.includes("logClientError(\"home.boards.latest.fallback\"")
    || /console\.(warn|error)\s*\(/.test(homeAdapterSource)) {
    failures.push("src/adapters/homeAdapter.js: home adapter fallback errors must use safe client diagnostics");
}

if (!statsAdapterSource.includes("logClientError(\"statistics.dashboard.fallback\"")
    || /console\.(warn|error)\s*\(/.test(statsAdapterSource)) {
    failures.push("src/adapters/statsAdapter.js: stats adapter fallback errors must use safe client diagnostics");
}

if (!adminAnomaliesSource.includes("logClientError(\"admin.anomalies.roleMembers.refresh\"")
    || !adminAnomaliesSource.includes("logClientError(\"admin.anomalies.memberRole.update\"")
    || /console\.error\s*\(/.test(adminAnomaliesSource)) {
    failures.push("src/pages/admin/AdminAnomalies.jsx: admin role errors must use safe client diagnostics");
}

if (!newsSource.includes("logClientError(\"news.search.fetch\"")
    || /console\.error\s*\(/.test(newsSource)) {
    failures.push("src/pages/facility/News.jsx: news fetch errors must use safe client diagnostics");
}

if (!todoCalendarSource.includes("logClientError(\"todo.range.fetch\"")
    || !todoCalendarSource.includes("logClientError(\"todo.create\"")
    || !todoCalendarSource.includes("logClientError(\"todo.toggle\"")
    || !todoCalendarSource.includes("logClientError(\"todo.delete\"")
    || !todoCalendarSource.includes("logClientError(\"todo.save\"")
    || /console\.error\s*\(/.test(todoCalendarSource)) {
    failures.push("src/pages/facility/TodoCalendar.jsx: todo errors must use safe client diagnostics");
}

if (!boardAdapterSource.includes("logClientError(\"boards.adapter.fallbackList\"")
    || /console\.error\s*\(/.test(boardAdapterSource)) {
    failures.push("src/adapters/boardAdapter.js: board adapter fallback errors must use safe client diagnostics");
}

if (!useBoardsSource.includes("logClientError(\"boards.list.fetch\"")
    || /console\.error\s*\(/.test(useBoardsSource)) {
    failures.push("src/hooks/useBoards.js: board list fetch errors must use safe client diagnostics");
}

if (!commentsSource.includes("logClientError(\"comments.fetch\"")
    || !commentsSource.includes("logClientError(\"comments.create\"")
    || !commentsSource.includes("logClientError(\"comments.update\"")
    || !commentsSource.includes("logClientError(\"comments.delete\"")
    || !commentsSource.includes("logClientError(\"comments.like\"")
    || !commentsSource.includes("logClientError(\"comments.report\"")
    || /console\.error\s*\(/.test(commentsSource)) {
    failures.push("src/components/Comments.jsx: comment errors must use safe client diagnostics");
}

if (!boardListSource.includes("logClientError(\"boards.list.delete\"")
    || /console\.error\s*\(/.test(boardListSource)) {
    failures.push("src/pages/boards/BoardList.jsx: board list errors must use safe client diagnostics");
}

if (!boardDetailSource.includes("logClientError(\"boards.detail.fetch\"")
    || !boardDetailSource.includes("logClientError(\"boards.detail.like\"")
    || !boardDetailSource.includes("logClientError(\"boards.detail.delete\"")
    || !boardDetailSource.includes("logClientError(\"boards.detail.download\"")
    || !boardDetailSource.includes("logClientError(\"boards.detail.report\"")
    || /console\.error\s*\(/.test(boardDetailSource)) {
    failures.push("src/pages/boards/BoardDetail.jsx: board detail errors must use safe client diagnostics");
}

if (!boardFormSource.includes("logClientError(\"boards.form.load\"")
    || !boardFormSource.includes("logClientError(\"boards.form.imageUpload\"")
    || !boardFormSource.includes("logClientError(\"boards.form.save\"")
    || /console\.error\s*\(/.test(boardFormSource)) {
    failures.push("src/pages/boards/BoardForm.jsx: board form errors must use safe client diagnostics");
}

if (!chatSource.includes("logClientError(\"chat.send\"")
    || /console\.error\s*\(/.test(chatSource)) {
    failures.push("src/pages/chat/Chat.jsx: chat send errors must use safe client diagnostics");
}

if (!floatingChatSource.includes("logClientError(\"floatingChat.markRead\"")
    || /console\.error\s*\(/.test(floatingChatSource)) {
    failures.push("src/components/FloatingChat.jsx: floating chat errors must use safe client diagnostics");
}

if (!appSource.includes("<AppErrorBoundary resetKey={location.pathname}>")
    || !appErrorBoundarySource.includes("static getDerivedStateFromError")
    || !appErrorBoundarySource.includes("componentDidUpdate")
    || !appErrorBoundarySource.includes("logClientError(\"app.render\"")
    || /console\.error\s*\(/.test(appErrorBoundarySource)
    || !appErrorBoundarySource.includes("const AppErrorFallback = React.lazy(() =>")
    || !appErrorBoundarySource.includes("import(\"./AppErrorFallback.jsx\")")
    || appErrorBoundarySource.includes("lucide-react")
    || !appErrorFallbackSource.includes("화면을 다시 불러와야 합니다")
    || !appErrorFallbackSource.includes("다시 시도")
    || !appErrorFallbackSource.includes("새로고침")
    || !appErrorFallbackSource.includes("홈으로 이동")) {
    failures.push("src/common/AppErrorBoundary.jsx: global Korean render-error fallback runtime boundary is missing");
}

if (!confirmActionSource.includes("role=\"alertdialog\"")
    || !confirmActionSource.includes("import { trapFocus } from \"../utils/focusTrap.js\"")
    || !confirmActionSource.includes("aria-labelledby={titleId}")
    || !confirmActionSource.includes("aria-describedby={descriptionId}")
    || !confirmActionSource.includes("cancelRef.current?.focus()")
    || !confirmActionSource.includes("restoreFocus(previousFocus)")
    || !confirmActionSource.includes("document.activeElement instanceof HTMLElement")
    || !confirmActionSource.includes("trapFocus(event, [cancelRef.current, confirmRef.current])")
    || !confirmActionSource.includes("confirmRef.current")
    || !confirmActionSource.includes("event.key === \"Escape\"")) {
    failures.push("src/common/confirmAction.jsx: accessible confirm action toast contract is missing");
}

if (!promptActionSource.includes("role=\"dialog\"")
    || !promptActionSource.includes("import { trapFocus } from \"../utils/focusTrap.js\"")
    || !promptActionSource.includes("aria-labelledby={titleId}")
    || !promptActionSource.includes("aria-describedby={description ? descriptionId : undefined}")
    || !promptActionSource.includes("inputRef.current?.focus()")
    || !promptActionSource.includes("restoreFocus(previousFocus)")
    || !promptActionSource.includes("document.activeElement instanceof HTMLElement")
    || !promptActionSource.includes("trapFocus(event, [inputRef.current, cancelRef.current, submitRef.current])")
    || !promptActionSource.includes("cancelRef.current")
    || !promptActionSource.includes("submitRef.current")
    || !promptActionSource.includes("event.key === \"Escape\"")
    || !promptActionSource.includes("aria-required={required}")) {
    failures.push("src/common/promptAction.jsx: accessible prompt action toast contract is missing");
}

if (!focusTrapSource.includes("export const getFocusableElements")
    || !focusTrapSource.includes("export const trapFocus")
    || !focusTrapSource.includes("Array.isArray(target)")
    || !focusTrapSource.includes("event.key !== \"Tab\"")
    || !focusTrapSource.includes("event.preventDefault()")) {
    failures.push("src/utils/focusTrap.js: shared focus trap contract is missing");
}

if (!daumPostcodeLoaderSource.includes("주소 검색 스크립트를 불러오지 못했습니다.")
    || daumPostcodeLoaderSource.includes("Daum postcode")
    || daumPostcodeLoaderSource.includes("postcode script failed to load")
    || daumPostcodeLoaderSource.includes("postcode script load timed out")) {
    failures.push("src/utils/daumPostcodeLoader.js: Korean postcode loader error contract is missing");
}

if (!naverMapsLoaderSource.includes("지도 SDK를 불러오지 못했습니다.")
    || naverMapsLoaderSource.includes("Naver Maps SDK")
    || naverMapsLoaderSource.includes("maps namespace")
    || naverMapsLoaderSource.includes("failed to load")) {
    failures.push("src/utils/naverMapsLoader.js: Korean map loader error contract is missing");
}

if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
}

console.log(`text-quality-smoke ok (${files.length} files)`);
