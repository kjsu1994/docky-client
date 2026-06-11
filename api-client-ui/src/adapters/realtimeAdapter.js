import { getStoredAccessToken } from "../utils/authStorage.js";

export const DEFAULT_REALTIME_ERROR_MESSAGE = "실시간 연결 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
export const REALTIME_ERROR_NOTICE_COOLDOWN_MS = 8000;

const KOREAN_TEXT_PATTERN = /[가-힣]/;
const KOREAN_SENTENCE_PATTERN = /[가-힣][^.!?\r\n]*(?:[.!?]|$)/g;
const TECHNICAL_MESSAGE_PATTERN =
    /\b(?:accessdeniedexception|bearer|exception|failed|forbidden|http|illegalargument|io\.jsonwebtoken|java\.|jwt|nullpointer|org\.|root_cause|sockjs|stack|stomp|trace|unauthorized|websocket)\b/i;
const lastRealtimeErrorNoticeAt = new Map();

export const buildStompConnectHeaders = () => {
    const token = getStoredAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
};

export const createStompClient = async ({ endpoint = "/ws/chat", ...options } = {}) => {
    const [{ Client }, sockJsModule] = await Promise.all([
        import("@stomp/stompjs"),
        import("sockjs-client"),
    ]);
    const SockJS = sockJsModule.default || sockJsModule;
    return new Client({
        webSocketFactory: () => new SockJS(endpoint),
        ...options,
    });
};

const normalizeMessageCandidate = (value) => (
    typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""
);

const parseMessageCandidates = (text) => {
    const normalized = normalizeMessageCandidate(text);
    if (!normalized || !normalized.startsWith("{")) return [];
    try {
        const parsed = JSON.parse(normalized);
        if (!parsed || typeof parsed !== "object") return [];
        return [parsed.message, parsed.reason, parsed.error].map(normalizeMessageCandidate).filter(Boolean);
    } catch {
        return [];
    }
};

const isSafeRealtimeMessage = (message) => (
    Boolean(message)
    && message.length <= 120
    && KOREAN_TEXT_PATTERN.test(message)
    && !TECHNICAL_MESSAGE_PATTERN.test(message)
);

const toSafeRealtimeMessage = (value) => {
    const message = normalizeMessageCandidate(value);
    if (!message) return "";
    if (isSafeRealtimeMessage(message)) return message;

    const koreanSentence = [...message.matchAll(KOREAN_SENTENCE_PATTERN)]
        .map((match) => normalizeMessageCandidate(match[0]))
        .find(isSafeRealtimeMessage);
    return koreanSentence || "";
};

export const getRealtimeErrorMessage = (frameOrError, fallbackMessage = DEFAULT_REALTIME_ERROR_MESSAGE) => {
    const candidates = [];
    if (typeof frameOrError === "string") {
        candidates.push(frameOrError);
    } else if (frameOrError && typeof frameOrError === "object") {
        candidates.push(frameOrError.headers?.message, frameOrError.body, frameOrError.message);
        candidates.push(...parseMessageCandidates(frameOrError.body));
    }

    const safeMessage = candidates.map(toSafeRealtimeMessage).find(Boolean);
    return safeMessage || fallbackMessage || DEFAULT_REALTIME_ERROR_MESSAGE;
};

export const shouldNotifyRealtimeError = (scope = "global", now = Date.now()) => {
    const key = String(scope || "global");
    const lastNoticeAt = lastRealtimeErrorNoticeAt.get(key) || 0;
    if (now - lastNoticeAt >= 0 && now - lastNoticeAt < REALTIME_ERROR_NOTICE_COOLDOWN_MS) {
        return false;
    }
    lastRealtimeErrorNoticeAt.set(key, now);
    return true;
};

export const notifyRealtimeError = async ({ scope = "global", error, fallbackMessage } = {}) => {
    if (!shouldNotifyRealtimeError(scope)) return false;
    try {
        const { notifyError } = await import("../utils/toast.js");
        notifyError(getRealtimeErrorMessage(error, fallbackMessage));
        return true;
    } catch {
        return false;
    }
};
