import api, { getApiErrorMessage } from "../utils/api.js";

export const INVEST_SYMBOL_MAX_LENGTH = 20;
export const INVEST_SYMBOL_QUERY_MAX_LENGTH = 80;
export const INVEST_CHART_INTERVAL_MAX_LENGTH = 10;

export const unwrapInvestData = (response) => response?.data?.data ?? response?.data ?? response ?? null;

const isPlainObject = (value) => (
    value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.prototype.toString.call(value) === "[object Object]"
);

const toSnakeKey = (key) => key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);

export const normalizeInvestPayload = (value) => {
    if (Array.isArray(value)) {
        return value.map(normalizeInvestPayload);
    }

    if (!isPlainObject(value)) {
        return value;
    }

    return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [toSnakeKey(key), normalizeInvestPayload(entry)])
    );
};

const toNumberOrNull = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const sortByMatchScore = (left, right) => {
    const leftScore = Number(left?.match_score);
    const rightScore = Number(right?.match_score);
    if (Number.isFinite(leftScore) && Number.isFinite(rightScore) && leftScore !== rightScore) {
        return rightScore - leftScore;
    }
    return 0;
};

export const normalizeSymbolSuggestResponse = (response) => {
    const data = normalizeInvestPayload(unwrapInvestData(response) || {});
    const items = Array.isArray(data.items) ? [...data.items].sort(sortByMatchScore) : [];

    return {
        ...data,
        items,
    };
};

const normalizeChartPoint = (point) => {
    const normalized = normalizeInvestPayload(point || {});

    return {
        ...normalized,
        trading_date: normalized.trading_date || "",
        open: toNumberOrNull(normalized.open),
        high: toNumberOrNull(normalized.high),
        low: toNumberOrNull(normalized.low),
        close: toNumberOrNull(normalized.close),
        volume: toNumberOrNull(normalized.volume),
        previous_close: toNumberOrNull(normalized.previous_close),
    };
};

export const normalizeChartResponse = (response) => {
    const data = normalizeInvestPayload(unwrapInvestData(response) || {});
    const points = Array.isArray(data.points)
        ? data.points
            .map(normalizeChartPoint)
            .filter((point) => point.trading_date && [point.open, point.high, point.low, point.close].every(Number.isFinite))
        : [];

    return {
        ...data,
        points,
        limitations: Array.isArray(data.limitations) ? data.limitations : [],
    };
};

export const normalizeAnalysisResponse = (response) => normalizeInvestPayload(unwrapInvestData(response) || {});

const normalizePortfolioItem = (item) => {
    const normalized = normalizeInvestPayload(item || {});
    return {
        ...normalized,
        quantity: toNumberOrNull(normalized.quantity),
        average_price: toNumberOrNull(normalized.average_price),
        planned_amount: toNumberOrNull(normalized.planned_amount),
        target_allocation_percent: toNumberOrNull(normalized.target_allocation_percent),
        risk_budget_percent: toNumberOrNull(normalized.risk_budget_percent),
        alert_above_price: toNumberOrNull(normalized.alert_above_price),
        alert_below_price: toNumberOrNull(normalized.alert_below_price),
        position_cost: toNumberOrNull(normalized.position_cost),
        risk_budget_amount: toNumberOrNull(normalized.risk_budget_amount),
        current_price: toNumberOrNull(normalized.current_price),
        current_change_percent: toNumberOrNull(normalized.current_change_percent),
        current_value: toNumberOrNull(normalized.current_value),
        unrealized_pnl: toNumberOrNull(normalized.unrealized_pnl),
        unrealized_pnl_percent: toNumberOrNull(normalized.unrealized_pnl_percent),
        current_allocation_percent: toNumberOrNull(normalized.current_allocation_percent),
        alert_messages: Array.isArray(normalized.alert_messages) ? normalized.alert_messages : [],
    };
};

export const normalizePortfolioResponse = (response) => {
    const data = normalizeInvestPayload(unwrapInvestData(response) || {});
    return {
        ...data,
        items: Array.isArray(data.items) ? data.items.map(normalizePortfolioItem) : [],
        item_count: Number.isFinite(Number(data.item_count)) ? Number(data.item_count) : 0,
        total_planned_amount: toNumberOrNull(data.total_planned_amount),
        total_position_cost: toNumberOrNull(data.total_position_cost),
        total_current_value: toNumberOrNull(data.total_current_value),
        provider_warnings: Array.isArray(data.provider_warnings) ? data.provider_warnings : [],
    };
};

export const normalizePortfolioItemResponse = (response) => normalizePortfolioItem(unwrapInvestData(response) || {});

export const extractInvestErrorMessage = (error, fallbackMessage) => getApiErrorMessage(error, fallbackMessage);

const US_PROVIDER_WARNING_PATTERN = /(alpha vantage|provider issue|api key|제공자 이슈|앱 키|시크릿|SEC 재무|KIS 현재가|실시간 현재가)/i;

export const findUsProviderWarningLimitation = ({ isKr, hasSummary, limitations }) => {
    if (isKr || hasSummary || !Array.isArray(limitations)) return "";
    return limitations.find((item) => (
        typeof item === "string" && US_PROVIDER_WARNING_PATTERN.test(item)
    )) || "";
};

export const investAdapter = {
    async fetchSymbolSuggestions({ market, query, limit = 5 }) {
        const response = await api.get("/invest/symbols/suggest", {
            params: { market, query, limit },
        });
        return normalizeSymbolSuggestResponse(response);
    },

    async fetchChart({ market, symbol, interval }) {
        const response = await api.get("/invest/chart", {
            params: { market, symbol, interval },
        });
        return normalizeChartResponse(response);
    },

    async fetchAnalysisBundle({ market, symbol }) {
        const [v1, v2, v3] = await Promise.all([
            api.get("/invest/analysis", { params: { market, symbol } }),
            api.get("/invest/analysis/v2", { params: { market, symbol } }),
            api.get("/invest/analysis/v3", { params: { market, symbol } }),
        ]);

        return {
            v1: normalizeAnalysisResponse(v1),
            v2: normalizeAnalysisResponse(v2),
            v3: normalizeAnalysisResponse(v3),
        };
    },

    async fetchPortfolio() {
        const response = await api.get("/invest/portfolio");
        return normalizePortfolioResponse(response);
    },

    async savePortfolioItem(payload) {
        const response = await api.post("/invest/portfolio", payload);
        return normalizePortfolioItemResponse(response);
    },

    async updatePortfolioItem(itemId, payload) {
        const response = await api.patch(`/invest/portfolio/${itemId}`, payload);
        return normalizePortfolioItemResponse(response);
    },

    async deletePortfolioItem(itemId) {
        await api.delete(`/invest/portfolio/${itemId}`);
    },
};
