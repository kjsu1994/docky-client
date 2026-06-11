import api from "../utils/api.js";
import { getStoredAccessToken } from "../utils/authStorage.js";
import { logClientError } from "../utils/clientDiagnostics.js";
import { normalizeExternalUrl } from "../utils/helpers.js";
import { statsAdapter } from "./statsAdapter.js";

export const unwrapHomeData = (response) => response?.data?.data ?? response?.data ?? null;

const BOARD_KIND_LABELS = {
    FREE_BOARD: "사용자게시판",
    ADMIN_NOTICE: "공지사항",
    QUESTION_ANSWER: "질문과 답변",
    ECO_BOARD: "친환경",
    GREEN_BOARD: "녹색생활",
};

export const getHomeBoardKind = (board) => board?.kind_of_board || board?.kindOfBoard || board?.kind || "FREE_BOARD";
export const getHomeBoardKindLabel = (kind) => BOARD_KIND_LABELS[kind] || "게시글";

export const normalizeHomeBoards = (response) => {
    const data = unwrapHomeData(response);
    const items = Array.isArray(data) ? data : data?.content || data?.items || [];
    if (!Array.isArray(items)) return [];

    return items.map((item) => ({
        id: item.boardId ?? item.board_id ?? item.id ?? null,
        kind: getHomeBoardKind(item),
        kindLabel: getHomeBoardKindLabel(getHomeBoardKind(item)),
        title: item.title || "제목 없음",
        contents: item.contents ?? item.content ?? "",
        creator: item.boardCreator ?? item.board_creator ?? "익명",
        viewCount: Number(item.viewCount ?? item.view_count ?? 0) || 0,
        createdAt: item.createdAt ?? item.created_at ?? "",
    }));
};

const toValidBannerId = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
};

const isExternalBannerUrl = (value) => /^https?:\/\//i.test(String(value || ""));
const BANNER_INTERNAL_PATH_MAX_LENGTH = 300;

const normalizeBannerInternalPath = (value) => {
    const raw = String(value || "").trim();
    if (
        !raw ||
        raw.length > BANNER_INTERNAL_PATH_MAX_LENGTH ||
        raw.startsWith("//") ||
        /["'\\\u0000-\u001F\u007F]/.test(raw)
    ) {
        return "";
    }
    if (!raw.startsWith("/")) return "";

    try {
        const parsed = new URL(raw, "https://docky.co.kr");
        const target = `${parsed.pathname}${parsed.search}${parsed.hash}`;
        if (
            target === "/" ||
            target === "/login" ||
            target === "/register" ||
            target === "/queue" ||
            target.startsWith("/queue?") ||
            target === "/app" ||
            target.startsWith("/app/") ||
            target.startsWith("/app?")
        ) {
            return target;
        }
    } catch {
        return "";
    }

    return "";
};

export const normalizeHomeBannerLinkUrl = (value) => {
    const externalUrl = normalizeExternalUrl(value);
    if (externalUrl) return externalUrl;
    return normalizeBannerInternalPath(value);
};

const normalizeBannerAssetUrl = (value) => {
    const url = String(value || "").trim();
    if (!url) return "";
    if (/["'\\\u0000-\u001F\u007F]/.test(url)) return "";
    if (isExternalBannerUrl(url)) return url;
    if (url.startsWith("/") && !url.startsWith("//")) return url;
    return "";
};

const toBannerLinkTarget = (url) => {
    if (!url) return "NONE";
    return isExternalBannerUrl(url) ? "EXTERNAL" : "INTERNAL";
};

const BANNER_IMPRESSION_DEDUP_TTL_MILLIS = 30_000;
const HOME_STATS_TIMEOUT_MILLIS = 2_800;
const HOME_BOARDS_TIMEOUT_MILLIS = 2_800;
const HOME_BANNERS_TIMEOUT_MILLIS = 2_500;
const HOME_DASHBOARD_CACHE_TTL_MILLIS = 20_000;
const HOME_DASHBOARD_CACHE_MAX_ENTRIES = 16;
const BANNER_EVENT_TIMEOUT_MILLIS = 2_000;
const BANNER_EVENT_ENDPOINT = "/banners/events";
const BANNER_EVENT_KEEPALIVE_ENDPOINT = "/api/banners/events";

const homeDashboardCache = new Map();
const homeDashboardInFlight = new Map();

const reserveImpressionDedupKey = (bannerId, eventType, placement) => {
    if (String(eventType || "").toUpperCase() !== "IMPRESSION") {
        return { skip: false, key: null };
    }
    if (typeof window === "undefined" || !window.sessionStorage) {
        return { skip: false, key: null };
    }

    const actorBucket = readStoredAccessToken() ? "auth" : "guest";
    const key = `home_banner_impression:${placement || "HOME_HERO"}:${actorBucket}:${bannerId}`;
    const now = Date.now();
    try {
        const expiresAt = Number(window.sessionStorage.getItem(key) || 0);
        if (expiresAt > now) return { skip: true, key: null };
        window.sessionStorage.setItem(key, String(now + BANNER_IMPRESSION_DEDUP_TTL_MILLIS));
        return { skip: false, key };
    } catch {
        return { skip: false, key: null };
    }
};

const releaseImpressionDedupKey = (key) => {
    if (!key || typeof window === "undefined" || !window.sessionStorage) return;
    try {
        window.sessionStorage.removeItem(key);
    } catch {
        // Ignore storage cleanup failures.
    }
};

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

const createAbortError = () => {
    const error = new Error("Request aborted");
    error.name = "AbortError";
    return error;
};

const throwIfAborted = (signal) => {
    if (!signal?.aborted) return;
    throw createAbortError();
};

const cloneHomeDashboard = (dashboard) => {
    if (typeof structuredClone === "function") return structuredClone(dashboard);
    return JSON.parse(JSON.stringify(dashboard));
};

const getHomeDashboardCacheKey = (user) => {
    if (!user) return "home-dashboard:v1:GUEST";
    const identity = user.memberId ?? user.member_id ?? user.id ?? user.email ?? user.name ?? "user";
    return `home-dashboard:v1:USER:${encodeURIComponent(String(identity))}`;
};

const pruneHomeDashboardCache = () => {
    const now = Date.now();
    for (const [key, cached] of homeDashboardCache) {
        if (!cached || cached.expiresAt <= now) {
            homeDashboardCache.delete(key);
        }
    }
    while (homeDashboardCache.size > HOME_DASHBOARD_CACHE_MAX_ENTRIES) {
        const oldestKey = homeDashboardCache.keys().next().value;
        if (oldestKey === undefined) break;
        homeDashboardCache.delete(oldestKey);
    }
};

const getCachedHomeDashboard = (cacheKey) => {
    const cached = homeDashboardCache.get(cacheKey);
    if (!cached) return null;
    if (cached.expiresAt <= Date.now()) {
        homeDashboardCache.delete(cacheKey);
        return null;
    }
    homeDashboardCache.delete(cacheKey);
    homeDashboardCache.set(cacheKey, cached);
    return cloneHomeDashboard(cached.value);
};

const isCacheableHomeDashboard = (dashboard) => {
    return Boolean(dashboard) &&
        !dashboard.stats?.unavailable &&
        !dashboard.recentBoardsUnavailable &&
        !dashboard.heroBannersUnavailable;
};

const setCachedHomeDashboard = (cacheKey, dashboard) => {
    if (!isCacheableHomeDashboard(dashboard)) return;
    homeDashboardCache.set(cacheKey, {
        expiresAt: Date.now() + HOME_DASHBOARD_CACHE_TTL_MILLIS,
        value: cloneHomeDashboard(dashboard),
    });
    pruneHomeDashboardCache();
};

const publishHomeSection = (entry, section) => {
    if (!entry || entry.controller.signal.aborted) return;
    entry.sectionSnapshot = {
        ...entry.sectionSnapshot,
        ...cloneHomeDashboard(section),
    };
    for (const subscriber of Array.from(entry.sectionSubscribers)) {
        subscriber(section);
    }
};

const subscribeHomeSection = (entry, signal, onSection) => {
    if (!entry || typeof onSection !== "function") return () => {};
    const subscriber = (section) => {
        if (signal?.aborted) return;
        onSection(cloneHomeDashboard(section));
    };

    entry.sectionSubscribers.add(subscriber);
    if (Object.keys(entry.sectionSnapshot).length > 0) {
        subscriber(entry.sectionSnapshot);
    }
    return () => entry.sectionSubscribers.delete(subscriber);
};

const waitForHomeDashboardEntry = (entry, signal, onSection) => {
    if (signal?.aborted) return Promise.reject(createAbortError());

    entry.consumers += 1;
    const unsubscribeSection = subscribeHomeSection(entry, signal, onSection);
    return new Promise((resolve, reject) => {
        let released = false;
        const release = () => {
            if (released) return;
            released = true;
            unsubscribeSection();
            entry.consumers -= 1;
            if (entry.consumers <= 0 && !entry.settled) {
                entry.controller.abort();
            }
        };
        const onAbort = () => {
            release();
            reject(createAbortError());
        };

        signal?.addEventListener("abort", onAbort, { once: true });
        entry.promise.then(
            (value) => {
                signal?.removeEventListener("abort", onAbort);
                release();
                resolve(cloneHomeDashboard(value));
            },
            (error) => {
                signal?.removeEventListener("abort", onAbort);
                release();
                reject(error);
            }
        );
    });
};

const toBannerEventPayload = (bannerId, eventType, placement) => ({
    banner_id: bannerId,
    event_type: String(eventType || "").toUpperCase(),
    placement,
});

const sendClickEventWithBeacon = (payload) => {
    if (typeof window === "undefined" || typeof window.navigator?.sendBeacon !== "function") return false;
    try {
        const body = JSON.stringify(payload);
        const blob = new Blob([body], { type: "application/json" });
        return window.navigator.sendBeacon(BANNER_EVENT_KEEPALIVE_ENDPOINT, blob);
    } catch {
        return false;
    }
};

const readStoredAccessToken = () => {
    return getStoredAccessToken();
};

const sendClickEventWithKeepalive = (payload) => {
    if (typeof window === "undefined" || typeof window.fetch !== "function") return false;
    try {
        const token = readStoredAccessToken();
        const headers = {
            "Content-Type": "application/json",
        };
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
        window.fetch(BANNER_EVENT_KEEPALIVE_ENDPOINT, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            credentials: "same-origin",
            keepalive: true,
        }).catch(() => {});
        return true;
    } catch {
        return false;
    }
};

export const normalizeHomeBanners = (response, fallbackName) => {
    const data = unwrapHomeData(response);
    const items = data?.items || data?.content || data || [];
    if (Array.isArray(items) && items.length) {
        return items.map((item, idx) => {
            const linkUrl = normalizeHomeBannerLinkUrl(item.linkUrl ?? item.link_url ?? "");
            const imageUrl = normalizeBannerAssetUrl(item.imageUrl ?? item.image_url ?? "");

            return {
                id: item.bannerId ?? item.banner_id ?? idx,
                eventBannerId: toValidBannerId(item.bannerId ?? item.banner_id),
                type: item.bannerType ?? item.banner_type ?? "NOTICE",
                title: item.title || "",
                description: item.description || "",
                imageUrl,
                linkUrl,
                linkTarget: toBannerLinkTarget(linkUrl),
                ctaText: item.ctaText ?? item.cta_text ?? "자세히 보기",
                renderMode: item.renderMode ?? item.render_mode ?? "CONTENT",
                adProvider: item.adProvider ?? item.ad_provider ?? "",
                adsenseClient: item.adsenseClient ?? item.adsense_client ?? "",
                adsenseSlot: item.adsenseSlot ?? item.adsense_slot ?? "",
            };
        });
    }

    return [
        {
            id: "fallback-1",
            eventBannerId: null,
            type: "NOTICE",
            title: `안녕하세요, ${fallbackName || "유저"}님!`,
            description: "더 스마트하고 편리한 커뮤니티 생활을 시작해보세요. 새로운 소식과 유용한 도구들이 준비되어 있습니다.",
            imageUrl: "",
            linkUrl: "",
            linkTarget: "NONE",
            ctaText: "둘러보기",
            renderMode: "CONTENT",
            adProvider: "",
            adsenseClient: "",
            adsenseSlot: "",
        },
    ];
};

const fetchLegacyRecentBoards = async ({ signal, timeout } = {}) => {
    const requestConfig = { signal, ...withOptionalTimeout(timeout) };
    const [freeRes, noticeRes] = await Promise.allSettled([
        api.get("/boards", { ...requestConfig, params: { kind: "FREE_BOARD", page: 0, size: 3 } }),
        api.get("/boards", { ...requestConfig, params: { kind: "ADMIN_NOTICE", page: 0, size: 3 } }),
    ]);
    throwIfAborted(signal);

    return {
        items: [
            ...(freeRes.status === "fulfilled" ? normalizeHomeBoards(freeRes.value) : []),
            ...(noticeRes.status === "fulfilled" ? normalizeHomeBoards(noticeRes.value) : []),
        ],
        unavailable: freeRes.status !== "fulfilled" && noticeRes.status !== "fulfilled",
    };
};

const fetchRecentBoards = async ({ signal, timeout, fallbackOnTimeout = true } = {}) => {
    try {
        const params = new URLSearchParams();
        params.append("kind", "FREE_BOARD");
        params.append("kind", "ADMIN_NOTICE");
        params.set("page", "0");
        params.set("size", "6");
        params.set("sort", "createdAt,desc");
        const response = await api.get("/boards/latest", {
            params,
            signal,
            ...withOptionalTimeout(timeout),
        });
        return {
            items: normalizeHomeBoards(response),
            unavailable: false,
        };
    } catch (error) {
        if (isCanceledRequest(error) || signal?.aborted) throw error;
        if (isTimeoutRequest(error) && !fallbackOnTimeout) throw error;
        logClientError("home.boards.latest.fallback", error);
        return fetchLegacyRecentBoards({ signal, timeout });
    }
};

const normalizeStatsSection = (statsRes) => {
    const hasStats = statsRes.status === "fulfilled";
    return {
        summary: hasStats ? statsRes.value.summary : null,
        compare: hasStats ? statsRes.value.visitorsCompare : null,
        unavailable: !hasStats,
    };
};

const normalizeBoardsSection = (boardsRes) => {
    const boardsResult = boardsRes.status === "fulfilled"
        ? boardsRes.value
        : { items: [], unavailable: true };
    const recentBoards = (boardsResult.items || [])
        .filter((board) => board.id)
        .sort((left, right) => {
            const leftTime = new Date(left.createdAt || 0).getTime();
            const rightTime = new Date(right.createdAt || 0).getTime();
            return rightTime - leftTime;
        })
        .slice(0, 6);
    return {
        recentBoards,
        recentBoardsUnavailable: boardsResult.unavailable && recentBoards.length === 0,
    };
};

const normalizeBannersSection = (bannerRes, user) => ({
    heroBannersUnavailable: bannerRes.status !== "fulfilled",
    heroBanners: normalizeHomeBanners(
        bannerRes.status === "fulfilled" ? bannerRes.value : null,
        user?.name || user?.email?.split("@")[0]
    ),
});

const notifyHomeSection = (onSection, signal, section) => {
    if (!onSection || signal?.aborted) return;
    onSection(section);
};

const loadHomeDashboard = async ({ user, signal, onSection } = {}) => {
    const statsSettled = statsAdapter.fetchSummaryAndVisitors({
        signal,
        timeout: HOME_STATS_TIMEOUT_MILLIS,
        fallbackOnTimeout: false,
    }).then(
        (value) => ({ status: "fulfilled", value }),
        (reason) => ({ status: "rejected", reason })
    );
    const boardsSettled = fetchRecentBoards({
        signal,
        timeout: HOME_BOARDS_TIMEOUT_MILLIS,
        fallbackOnTimeout: false,
    }).then(
        (value) => ({ status: "fulfilled", value }),
        (reason) => ({ status: "rejected", reason })
    );
    const bannersSettled = api.get("/banners", {
        params: {
            placement: "HOME_HERO",
            target: user ? "USER" : "GUEST",
            limit: 10,
        },
        signal,
        timeout: HOME_BANNERS_TIMEOUT_MILLIS,
    }).then(
        (value) => ({ status: "fulfilled", value }),
        (reason) => ({ status: "rejected", reason })
    );

    statsSettled.then((statsRes) => notifyHomeSection(onSection, signal, { stats: normalizeStatsSection(statsRes) }));
    boardsSettled.then((boardsRes) => notifyHomeSection(onSection, signal, normalizeBoardsSection(boardsRes)));
    bannersSettled.then((bannerRes) => notifyHomeSection(onSection, signal, normalizeBannersSection(bannerRes, user)));

    const [statsRes, boardsRes, bannerRes] = await Promise.all([statsSettled, boardsSettled, bannersSettled]);
    throwIfAborted(signal);

    const boardsSection = normalizeBoardsSection(boardsRes);
    const bannersSection = normalizeBannersSection(bannerRes, user);

    return {
        stats: normalizeStatsSection(statsRes),
        recentBoards: boardsSection.recentBoards,
        recentBoardsUnavailable: boardsSection.recentBoardsUnavailable,
        heroBanners: bannersSection.heroBanners,
        heroBannersUnavailable: bannersSection.heroBannersUnavailable,
    };
};

const startHomeDashboardRequest = ({ cacheKey, user }) => {
    const controller = new AbortController();
    const entry = {
        consumers: 0,
        controller,
        settled: false,
        promise: null,
        sectionSnapshot: {},
        sectionSubscribers: new Set(),
    };

    entry.promise = loadHomeDashboard({
        user,
        signal: controller.signal,
        onSection: (section) => {
            publishHomeSection(entry, section);
        },
    })
        .then((dashboard) => {
            setCachedHomeDashboard(cacheKey, dashboard);
            return dashboard;
        })
        .finally(() => {
            entry.settled = true;
            homeDashboardInFlight.delete(cacheKey);
        });

    homeDashboardInFlight.set(cacheKey, entry);
    return entry;
};

export const fetchHomeDashboard = async ({ user, signal, force = false, onSection } = {}) => {
    throwIfAborted(signal);
    const cacheKey = getHomeDashboardCacheKey(user);

    if (!force) {
        const cached = getCachedHomeDashboard(cacheKey);
        if (cached) return cached;

        const existing = homeDashboardInFlight.get(cacheKey);
        if (existing) {
            return waitForHomeDashboardEntry(existing, signal, onSection);
        }

        return waitForHomeDashboardEntry(startHomeDashboardRequest({ cacheKey, user }), signal, onSection);
    }

    const dashboard = await loadHomeDashboard({ user, signal, onSection });
    setCachedHomeDashboard(cacheKey, dashboard);
    return cloneHomeDashboard(dashboard);
};

export const peekCachedHomeDashboard = ({ user } = {}) => {
    return getCachedHomeDashboard(getHomeDashboardCacheKey(user));
};

export const trackHomeBannerEvent = async (banner, eventType) => {
    const bannerId = toValidBannerId(banner?.eventBannerId ?? banner?.id);
    if (!bannerId) return;
    const placement = "HOME_HERO";
    const dedupReservation = reserveImpressionDedupKey(bannerId, eventType, placement);
    if (dedupReservation.skip) return;
    const payload = toBannerEventPayload(bannerId, eventType, placement);

    if (payload.event_type === "CLICK") {
        if (readStoredAccessToken()) {
            await api.post(
                BANNER_EVENT_ENDPOINT,
                payload,
                {
                    timeout: BANNER_EVENT_TIMEOUT_MILLIS,
                    meta: {
                        trackNetwork: false,
                    },
                }
            );
            return;
        }

        if (sendClickEventWithBeacon(payload) || sendClickEventWithKeepalive(payload)) {
            return;
        }
    }

    try {
        await api.post(
            BANNER_EVENT_ENDPOINT,
            payload,
            {
                timeout: BANNER_EVENT_TIMEOUT_MILLIS,
                meta: {
                    trackNetwork: false,
                },
            }
        );
    } catch (error) {
        releaseImpressionDedupKey(dedupReservation.key);
        throw error;
    }
};

export const homeAdapter = {
    fetchDashboard: fetchHomeDashboard,
    peekCachedDashboard: peekCachedHomeDashboard,
    trackBannerEvent: trackHomeBannerEvent,
};
