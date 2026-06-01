import api, { getApiErrorMessage } from "../utils/api.js";

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

export const queueAdapter = {
    async join() {
        const response = await api.post("/queue/join");
        return normalizeQueueInfo(response);
    },

    async fetchStatus() {
        const response = await api.get("/queue/status");
        return normalizeQueueInfo(response);
    },

    async leave() {
        const response = await api.delete("/queue/leave");
        return unwrapQueueData(response);
    },
};
