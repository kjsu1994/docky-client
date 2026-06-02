import api, { getApiErrorMessage } from "../utils/api.js";
import { normalizeExternalUrl } from "../utils/helpers.js";

export const NEWS_DEFAULT_QUERY = "기후위기";
export const NEWS_DEFAULT_SORT = "sim";
export const NEWS_DEFAULT_DISPLAY = 20;
export const NEWS_QUERY_MAX_LENGTH = 60;

const SORT_VALUES = new Set(["sim", "date"]);

const unwrapNewsData = (response) => response?.data?.data ?? response?.data ?? {};

const cleanNewsText = (value) => {
    if (!value) return "";
    return String(value)
        .replace(/<[^>]*>/g, "")
        .replace(/&quot;/g, "\"")
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
};

const normalizeSort = (sort) => SORT_VALUES.has(sort) ? sort : NEWS_DEFAULT_SORT;

const normalizeDisplay = (display) => {
    const parsed = Number(display);
    if (!Number.isFinite(parsed)) return NEWS_DEFAULT_DISPLAY;
    return Math.max(10, Math.min(50, parsed));
};

export const normalizeNewsQuery = (query) => {
    const normalized = String(query || "").trim();
    if (!normalized) return NEWS_DEFAULT_QUERY;
    return normalized.slice(0, NEWS_QUERY_MAX_LENGTH);
};

export const normalizeNewsResponse = (response) => {
    const payload = unwrapNewsData(response);
    const items = Array.isArray(payload) ? payload : payload?.items || [];
    return {
        total: Number(payload?.total || items.length || 0),
        start: Number(payload?.start || 1),
        display: Number(payload?.display || items.length || 0),
        items: Array.isArray(items)
            ? items.map((item, index) => {
                const link = normalizeExternalUrl(item.link || item.originallink);
                const originalLink = normalizeExternalUrl(item.originallink || item.originalLink || item.link);
                return {
                    id: `${link || originalLink || "news"}-${index}`,
                    title: cleanNewsText(item.title),
                    description: cleanNewsText(item.description),
                    link,
                    originalLink,
                    pubDate: item.pubDate || item.pub_date || "",
                };
            }).filter((item) => item.title && item.link)
            : [],
    };
};

export const newsErrorMessage = (error, fallbackMessage) => getApiErrorMessage(error, fallbackMessage);

export const newsAdapter = {
    async search({ query = NEWS_DEFAULT_QUERY, sort = NEWS_DEFAULT_SORT, display = NEWS_DEFAULT_DISPLAY, start = 1 } = {}) {
        const normalizedQuery = normalizeNewsQuery(query);
        const normalizedSort = normalizeSort(sort);
        const normalizedDisplay = normalizeDisplay(display);
        const response = await api.get("/news", {
            params: {
                query: normalizedQuery,
                sort: normalizedSort,
                display: normalizedDisplay,
                start,
            },
        });
        return normalizeNewsResponse(response);
    },
};
