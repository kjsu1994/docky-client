import api, { getApiErrorMessage } from "../utils/api.js";
import { logClientError } from "../utils/clientDiagnostics.js";

const unwrapStatsData = (response) => response?.data?.data ?? response?.data ?? null;

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeStatsSummaryData = (data = {}) => ({
    totalMembers: toNumber(data.total_members ?? data.totalMembers),
    totalBoards: toNumber(data.total_boards ?? data.totalBoards),
    totalComments: toNumber(data.total_comments ?? data.totalComments),
    todayVisitors: toNumber(data.today_visitors ?? data.todayVisitors),
    activeMembers: toNumber(data.active_members ?? data.activeMembers),
    quitMembers: toNumber(data.quit_members ?? data.quitMembers),
});

const normalizeVisitorsCompareData = (data = {}) => ({
    todayVisitors: toNumber(data.today_visitors ?? data.todayVisitors),
    yesterdayVisitors: toNumber(data.yesterday_visitors ?? data.yesterdayVisitors),
    dayOverDayChangeRate: toNumber(data.day_over_day_change_rate ?? data.dayOverDayChangeRate),
});

const isCanceledRequest = (error) => {
    return error?.code === "ERR_CANCELED" || error?.name === "CanceledError" || error?.name === "AbortError";
};

const isTimeoutRequest = (error) => {
    return error?.code === "ECONNABORTED" || String(error?.message || "").toLowerCase().includes("timeout");
};

const withOptionalTimeout = (timeout) => {
    const parsed = Number(timeout);
    return Number.isFinite(parsed) && parsed > 0 ? { timeout: parsed } : {};
};

export const normalizeStatsSummary = (response) => normalizeStatsSummaryData(unwrapStatsData(response) || {});

export const normalizeVisitorsCompare = (response) => normalizeVisitorsCompareData(unwrapStatsData(response) || {});

export const normalizeStatsDashboard = (response) => {
    const data = unwrapStatsData(response) || {};
    return {
        summary: normalizeStatsSummaryData(data.summary ?? data.stats_summary ?? {}),
        visitorsCompare: normalizeVisitorsCompareData(data.visitors_compare ?? data.visitorsCompare ?? {}),
    };
};

export const fetchStatsSummaryAndVisitors = async ({ signal, timeout, fallbackOnTimeout = true } = {}) => {
    const requestConfig = { signal, ...withOptionalTimeout(timeout) };

    try {
        const response = await api.get("/stats/dashboard", requestConfig);
        return normalizeStatsDashboard(response);
    } catch (error) {
        if (isCanceledRequest(error) || signal?.aborted) throw error;
        if (isTimeoutRequest(error) && !fallbackOnTimeout) throw error;
        logClientError("statistics.dashboard.fallback", error);
    }

    const [summaryResponse, visitorsResponse] = await Promise.all([
        api.get("/stats/summary", requestConfig),
        api.get("/stats/visitors/compare", requestConfig),
    ]);
    return {
        summary: normalizeStatsSummary(summaryResponse),
        visitorsCompare: normalizeVisitorsCompare(visitorsResponse),
    };
};

export const normalizeStatsTrend = (response, fallbackDays = 7) => {
    const data = unwrapStatsData(response) || {};
    const days = toNumber(data.days, fallbackDays);
    const items = Array.isArray(data.items) ? data.items : [];

    return {
        days,
        items: items.map((item) => ({
            date: item.date || "",
            newBoards: toNumber(item.new_boards ?? item.newBoards),
            newComments: toNumber(item.new_comments ?? item.newComments),
            visitors: toNumber(item.visitors),
        })),
    };
};

export const statsErrorMessage = (error, fallbackMessage) => getApiErrorMessage(error, fallbackMessage);

export const statsAdapter = {
    async fetchDashboard({ days = 7, signal } = {}) {
        const [dashboard, trendResponse] = await Promise.all([
            fetchStatsSummaryAndVisitors({ signal }),
            api.get("/stats/trend", { params: { days }, signal }),
        ]);

        return {
            summary: dashboard.summary,
            visitorsCompare: dashboard.visitorsCompare,
            trend: normalizeStatsTrend(trendResponse, days),
        };
    },

    fetchSummaryAndVisitors: fetchStatsSummaryAndVisitors,

    async fetchTrend(days, { signal } = {}) {
        const response = await api.get("/stats/trend", {
            params: { days },
            signal,
        });
        return normalizeStatsTrend(response, days);
    },
};
