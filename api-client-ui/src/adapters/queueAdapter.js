import api, { getApiErrorMessage } from "../utils/api.js";

const QUEUE_CLIENT_ID_KEY = "ctfmon.queue.clientId";

export const unwrapQueueData = (response) => response?.data?.data ?? response?.data ?? response ?? {};

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizeQueueInfo = (response) => {
    const data = unwrapQueueData(response);

    return {
        user_id: data.user_id ?? data.userId ?? "",
        rank: toNumber(data.rank),
        total_waiting: toNumber(data.total_waiting ?? data.totalWaiting),
        expected_time: toNumber(data.expected_time ?? data.expectedTime),
        status: String(data.status || "WAITING").toUpperCase(),
        waited_seconds: toNumber(data.waited_seconds ?? data.waitedSeconds),
        priority: data.priority || "NORMAL",
        rejoin_grace_seconds: toNumber(data.rejoin_grace_seconds ?? data.rejoinGraceSeconds),
        poll_interval_seconds: toNumber(data.poll_interval_seconds ?? data.pollIntervalSeconds),
    };
};

export const resolveQueuePollIntervalMs = (data, { fallbackMs, maxMs }) => {
    const seconds = toNumber(data?.poll_interval_seconds ?? data?.pollIntervalSeconds);
    if (seconds <= 0) {
        return fallbackMs;
    }
    return Math.min(Math.max(seconds * 1000, fallbackMs), maxMs);
};

export const extractQueueErrorMessage = (error, fallbackMessage) => getApiErrorMessage(error, fallbackMessage);
export const isQueueUnauthorizedError = (error) => Number(error?.response?.status || 0) === 401;

const generateQueueClientId = () => {
    const cryptoApi = globalThis.crypto;
    if (cryptoApi?.randomUUID) {
        return `web-${cryptoApi.randomUUID()}`;
    }
    return `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

export const getQueueClientId = () => {
    if (typeof window === "undefined") {
        return generateQueueClientId();
    }

    try {
        const existing = window.localStorage.getItem(QUEUE_CLIENT_ID_KEY);
        if (existing) return existing;

        const created = generateQueueClientId();
        window.localStorage.setItem(QUEUE_CLIENT_ID_KEY, created);
        return created;
    } catch {
        return generateQueueClientId();
    }
};

const queueRequestConfig = () => ({
    headers: {
        "X-Queue-User": getQueueClientId(),
    },
});

export const queueAdapter = {
    async join() {
        const response = await api.post("/queue/join", null, queueRequestConfig());
        return normalizeQueueInfo(response);
    },

    async fetchStatus() {
        const response = await api.get("/queue/status", queueRequestConfig());
        return normalizeQueueInfo(response);
    },

    async leave() {
        const response = await api.delete("/queue/leave", queueRequestConfig());
        return unwrapQueueData(response);
    },
};
