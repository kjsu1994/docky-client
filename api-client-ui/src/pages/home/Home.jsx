import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
    ArrowLeft,
    ArrowRight,
    Sparkles,
    MessageSquare,
    Eye,
    TrendingUp,
    TrendingDown,
    Car,
    Dices,
    Bot,
    Pause,
    Play,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { formatNumber, formatRelativeTime, stripHtmlTags } from "../../utils/helpers.js";
import { ErrorMessage } from "../../components/ErrorMessage.jsx";
import { EmptyState } from "../../components/EmptyState.jsx";
import { homeAdapter } from "../../adapters/homeAdapter.js";
import { isAdsenseBanner, readStoredAdsConsent } from "../../utils/adsense.js";
import { logClientError } from "../../utils/clientDiagnostics.js";

const HomeAdsenseRuntime = lazy(() =>
    import("./HomeAdsenseRuntime.jsx").then((module) => ({ default: module.HomeAdsenseRuntime }))
);

const toPercentLabel = (value) => {
    const num = Number(value) || 0;
    const sign = num > 0 ? "+" : "";
    return `${sign}${num.toFixed(2)}%`;
};

const toBoardTimeLabel = (value) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return formatRelativeTime(parsed);
};

const prefersReducedMotion = () => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

const isDocumentHidden = () => {
    return typeof document !== "undefined" && Boolean(document.hidden);
};

const isCanceledRequest = (error) => {
    return error?.code === "ERR_CANCELED" || error?.name === "CanceledError" || error?.name === "AbortError";
};

const hasResolvedStats = (value) => Boolean(value?.summary || value?.compare);
const hasItems = (items) => Array.isArray(items) && items.length > 0;

const HOME_ROUTE_PREFETCHERS = {
    boards: () => import("../boards/BoardList.jsx"),
    boardDetail: () => import("../boards/BoardDetail.jsx"),
    facility: () => import("../facility/FacilityFinder.jsx"),
    games: () => import("../games/GamesHub.jsx"),
    invest: () => import("../facility/InvestAssistant.jsx"),
};

const prefetchedHomeRoutes = new Set();

const prefetchHomeRoute = (routeKey) => {
    const loader = HOME_ROUTE_PREFETCHERS[routeKey];
    if (!loader || prefetchedHomeRoutes.has(routeKey)) return;
    prefetchedHomeRoutes.add(routeKey);
    loader().catch(() => prefetchedHomeRoutes.delete(routeKey));
};

export const Home = () => {
    const { user } = useAuth();
    const initialDashboardRef = useRef(homeAdapter.peekCachedDashboard({ user }));
    const [stats, setStats] = useState(() => initialDashboardRef.current?.stats || { summary: null, compare: null, unavailable: false });
    const [recentBoards, setRecentBoards] = useState(() => initialDashboardRef.current?.recentBoards || []);
    const [recentBoardsUnavailable, setRecentBoardsUnavailable] = useState(() => Boolean(initialDashboardRef.current?.recentBoardsUnavailable));
    const [heroBanners, setHeroBanners] = useState(() => initialDashboardRef.current?.heroBanners || []);
    const [heroBannersUnavailable, setHeroBannersUnavailable] = useState(() => Boolean(initialDashboardRef.current?.heroBannersUnavailable));
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(true);
    const [isBannerPaused, setIsBannerPaused] = useState(prefersReducedMotion);
    const [isBannerInteracting, setIsBannerInteracting] = useState(false);
    const [isPageHidden, setIsPageHidden] = useState(isDocumentHidden);
    const [isBannerInView, setIsBannerInView] = useState(true);
    const [loading, setLoading] = useState(() => !initialDashboardRef.current);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [adsConsent, setAdsConsent] = useState(readStoredAdsConsent);

    const impressionSentRef = useRef(new Set());
    const dashboardAbortRef = useRef(null);
    const bannerSectionRef = useRef(null);
    const touchStartRef = useRef({ x: 0, y: 0 });
    const statsRef = useRef(stats);
    const recentBoardsRef = useRef(recentBoards);
    const heroBannersRef = useRef(heroBanners);

    const bannerCount = heroBanners.length;

    const loopBanners = useMemo(() => {
        if (bannerCount === 0) return [];
        if (bannerCount === 1) return heroBanners;
        return [...heroBanners, heroBanners[0]];
    }, [heroBanners, bannerCount]);

    const bannerIndex = useMemo(() => {
        if (bannerCount === 0) return 0;
        return currentIndex % bannerCount;
    }, [currentIndex, bannerCount]);

    const hasAdsenseBanner = useMemo(() => {
        return heroBanners.some(isAdsenseBanner);
    }, [heroBanners]);

    const adsenseClientId = useMemo(() => {
        const fromBanner = heroBanners.find((banner) => isAdsenseBanner(banner) && banner?.adsenseClient)?.adsenseClient;
        return fromBanner || import.meta.env.VITE_ADSENSE_CLIENT || "";
    }, [heroBanners]);

    const handleNext = () => {
        if (bannerCount <= 1) return;
        setIsTransitioning(true);
        setCurrentIndex((prev) => {
            // 복제 슬라이드(마지막 index)에서 transition reset 전에 추가 이동이 겹치면
            // index overflow로 빈 화면이 보일 수 있어 상한을 고정한다.
            if (prev >= bannerCount) return prev;
            return prev + 1;
        });
    };

    const handlePrev = () => {
        if (bannerCount <= 1) return;
        // 첫 배너에서 이전 스와이프 시 끝 배너로 자연스럽게 이동시키기 위한 보정.
        if (currentIndex === 0) {
            setIsTransitioning(false);
            setCurrentIndex(bannerCount - 1);
            return;
        }
        setIsTransitioning(true);
        setCurrentIndex((prev) => prev - 1);
    };

    const handleTransitionEnd = () => {
        if (bannerCount <= 1) return;
        if (currentIndex >= bannerCount) {
            setIsTransitioning(false);
            setCurrentIndex(0);
        }
    };

    useEffect(() => {
        if (isTransitioning) return;
        const frame = window.requestAnimationFrame(() => setIsTransitioning(true));
        return () => window.cancelAnimationFrame(frame);
    }, [isTransitioning]);

    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return;
        const query = window.matchMedia("(prefers-reduced-motion: reduce)");
        const handleChange = (event) => {
            if (event.matches) setIsBannerPaused(true);
        };
        handleChange(query);
        query.addEventListener?.("change", handleChange);
        return () => query.removeEventListener?.("change", handleChange);
    }, []);

    useEffect(() => {
        if (typeof document === "undefined") return;
        const handleVisibilityChange = () => setIsPageHidden(isDocumentHidden());
        handleVisibilityChange();
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }, []);

    useEffect(() => {
        const bannerSection = bannerSectionRef.current;
        if (!bannerSection || typeof IntersectionObserver === "undefined") {
            setIsBannerInView(true);
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsBannerInView(Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.15));
            },
            { threshold: [0, 0.15] }
        );
        observer.observe(bannerSection);
        return () => observer.disconnect();
    }, [bannerCount]);

    useEffect(() => {
        if (bannerCount <= 1 || isBannerPaused || isBannerInteracting || isPageHidden || !isBannerInView) return;
        const timer = setInterval(() => {
            setIsTransitioning(true);
            setCurrentIndex((prev) => {
                if (prev >= bannerCount) return prev;
                return prev + 1;
            });
        }, 4500);
        return () => clearInterval(timer);
    }, [bannerCount, isBannerInView, isBannerInteracting, isBannerPaused, isPageHidden]);

    const updateStats = useCallback((nextStats) => {
        statsRef.current = nextStats;
        setStats(nextStats);
    }, []);

    const updateRecentBoards = useCallback((nextBoards, unavailable) => {
        recentBoardsRef.current = nextBoards;
        setRecentBoards(nextBoards);
        setRecentBoardsUnavailable(Boolean(unavailable));
    }, []);

    const updateHeroBanners = useCallback((nextBanners, unavailable) => {
        heroBannersRef.current = nextBanners;
        setHeroBanners(nextBanners);
        setHeroBannersUnavailable(Boolean(unavailable));
        setCurrentIndex(0);
        setIsTransitioning(true);
        impressionSentRef.current = new Set();
    }, []);

    const applyDashboard = useCallback((result, { preserveExistingOnUnavailable = false } = {}) => {
        if (!(preserveExistingOnUnavailable && result.stats?.unavailable && hasResolvedStats(statsRef.current))) {
            updateStats(result.stats);
        }

        const nextRecentBoards = result.recentBoards || [];
        const preserveRecentBoards = preserveExistingOnUnavailable &&
            result.recentBoardsUnavailable &&
            !hasItems(nextRecentBoards) &&
            hasItems(recentBoardsRef.current);
        if (!preserveRecentBoards) {
            updateRecentBoards(nextRecentBoards, result.recentBoardsUnavailable);
        }

        const nextHeroBanners = result.heroBanners || [];
        const preserveHeroBanners = preserveExistingOnUnavailable &&
            result.heroBannersUnavailable &&
            hasItems(heroBannersRef.current);
        if (!preserveHeroBanners) {
            updateHeroBanners(nextHeroBanners, result.heroBannersUnavailable);
        }
    }, [updateHeroBanners, updateRecentBoards, updateStats]);

    const applyDashboardSection = useCallback((section, { preserveExistingOnUnavailable = false } = {}) => {
        if (Object.prototype.hasOwnProperty.call(section, "stats")) {
            if (!(preserveExistingOnUnavailable && section.stats?.unavailable && hasResolvedStats(statsRef.current))) {
                updateStats(section.stats);
            }
        }
        if (Object.prototype.hasOwnProperty.call(section, "recentBoards")) {
            const nextRecentBoards = section.recentBoards || [];
            const preserveRecentBoards = preserveExistingOnUnavailable &&
                section.recentBoardsUnavailable &&
                !hasItems(nextRecentBoards) &&
                hasItems(recentBoardsRef.current);
            if (!preserveRecentBoards) {
                updateRecentBoards(nextRecentBoards, section.recentBoardsUnavailable);
            }
        }
        if (Object.prototype.hasOwnProperty.call(section, "heroBanners")) {
            const nextHeroBanners = section.heroBanners || [];
            const preserveHeroBanners = preserveExistingOnUnavailable &&
                section.heroBannersUnavailable &&
                hasItems(heroBannersRef.current);
            if (!preserveHeroBanners) {
                updateHeroBanners(nextHeroBanners, section.heroBannersUnavailable);
            }
        }
    }, [updateHeroBanners, updateRecentBoards, updateStats]);

    const fetchData = useCallback(async ({ background = false } = {}) => {
        if (background && dashboardAbortRef.current) return;
        if (dashboardAbortRef.current) {
            dashboardAbortRef.current.abort();
            dashboardAbortRef.current = null;
        }

        const cachedDashboard = background ? null : homeAdapter.peekCachedDashboard({ user });
        if (cachedDashboard) {
            applyDashboard(cachedDashboard);
            setRefreshing(false);
            setLoading(false);
            setError("");
            return;
        }

        const controller = new AbortController();
        dashboardAbortRef.current = controller;

        if (background) {
            setRefreshing(true);
        } else {
            setRefreshing(false);
            setLoading(true);
            setError("");
        }
        try {
            const result = await homeAdapter.fetchDashboard({
                user,
                signal: controller.signal,
                force: background,
                onSection: (section) => {
                    if (controller.signal.aborted || dashboardAbortRef.current !== controller) return;
                    applyDashboardSection(section, { preserveExistingOnUnavailable: background });
                },
            });
            if (controller.signal.aborted || dashboardAbortRef.current !== controller) return;
            applyDashboard(result, { preserveExistingOnUnavailable: background });
        } catch (fetchError) {
            if (isCanceledRequest(fetchError) || controller.signal.aborted || dashboardAbortRef.current !== controller) {
                return;
            }
            logClientError("home.dashboard.fetch", fetchError);
            if (!background) {
                setError("데이터를 불러오는 중 문제가 발생했습니다.");
            }
        } finally {
            if (dashboardAbortRef.current === controller) {
                dashboardAbortRef.current = null;
                if (background) {
                    setRefreshing(false);
                }
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }
    }, [applyDashboard, applyDashboardSection, user]);

    const refreshDashboard = useCallback(() => {
        fetchData({ background: true });
    }, [fetchData]);

    const prefetchBoardListRoute = useCallback(() => prefetchHomeRoute("boards"), []);
    const prefetchBoardDetailRoute = useCallback(() => prefetchHomeRoute("boardDetail"), []);

    useEffect(() => {
        fetchData();
        return () => {
            if (dashboardAbortRef.current) {
                dashboardAbortRef.current.abort();
                dashboardAbortRef.current = null;
            }
        };
    }, [fetchData]);

    const sendBannerEvent = useCallback(async (banner, eventType) => {
        try {
            await homeAdapter.trackBannerEvent(banner, eventType);
        } catch {
            // Ignore logging errors on client.
        }
    }, []);

    useEffect(() => {
        const banner = heroBanners[bannerIndex];
        if (!banner?.id) return;
        if (isAdsenseBanner(banner)) return;
        if (isPageHidden || !isBannerInView) return;
        const key = String(banner.id);
        if (impressionSentRef.current.has(key)) return;
        impressionSentRef.current.add(key);
        sendBannerEvent(banner, "IMPRESSION");
    }, [bannerIndex, heroBanners, isBannerInView, isPageHidden, sendBannerEvent]);

    const shouldLoadBannerMedia = (slideIndex) => {
        if (bannerCount <= 1) return true;
        const normalizedSlideIndex = slideIndex % bannerCount;
        const normalizedCurrentIndex = currentIndex % bannerCount;
        const distance = Math.abs(normalizedSlideIndex - normalizedCurrentIndex);
        return distance <= 1 || distance === bannerCount - 1;
    };

    const isActiveBannerSlide = (slideIndex) => {
        if (bannerCount <= 1) return true;
        if (currentIndex >= bannerCount) return slideIndex === bannerCount;
        return slideIndex === currentIndex;
    };

    if (error) return <ErrorMessage message={error} onRetry={fetchData} />;

    const changeRate = Number(stats.compare?.dayOverDayChangeRate) || 0;
    const statsPending = loading && !stats.summary && !stats.unavailable;
    const boardsPending = loading && recentBoards.length === 0 && !recentBoardsUnavailable;
    const bannersPending = loading && bannerCount === 0 && !heroBannersUnavailable;
    const statsUnavailable = Boolean(stats.unavailable);
    const statValue = (value) => (statsPending || statsUnavailable) ? "-" : formatNumber(value || 0);

    return (
        <div className="space-y-10 animate-fade-in pb-10">
            <section
                className="max-w-full rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm"
                aria-label="홈 통계 요약"
                aria-busy={statsPending}
            >
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                    <HeaderStat label="전체 회원" value={statValue(stats.summary?.totalMembers)} />
                    <HeaderStat label="전체 게시글" value={statValue(stats.summary?.totalBoards)} />
                    <HeaderStat
                        label="오늘 방문자"
                        value={statValue(stats.summary?.todayVisitors)}
                        trend={!statsUnavailable && stats.compare ? { isGrowth: changeRate >= 0, label: toPercentLabel(changeRate) } : null}
                    />
                    <HeaderStat label="활성 사용자" value={statValue(stats.summary?.activeMembers)} />
                </div>
                {statsPending ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500" role="status" aria-live="polite">
                        <span>통계를 불러오는 중입니다.</span>
                    </div>
                ) : statsUnavailable ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700" role="status" aria-live="polite">
                        <span>통계 연결이 지연되고 있습니다.</span>
                        <button
                            type="button"
                            className="rounded-full bg-white px-3 py-1 font-black text-amber-700 shadow-sm hover:text-amber-800 disabled:opacity-60"
                            onClick={refreshDashboard}
                            disabled={refreshing}
                            aria-label="통계 다시 불러오기"
                        >
                            {refreshing ? "다시 불러오는 중" : "다시 불러오기"}
                        </button>
                    </div>
                ) : null}
            </section>

            <section
                ref={bannerSectionRef}
                className="relative overflow-hidden rounded-[2.5rem] border border-slate-200/70 bg-white shadow-2xl shadow-slate-200/70"
                aria-label="홈 배너"
                aria-roledescription="carousel"
                aria-busy={bannersPending}
                data-home-banner-in-view={isBannerInView ? "true" : "false"}
                onTouchStart={(e) => {
                    const touch = e.touches?.[0];
                    if (!touch) return;
                    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
                }}
                onTouchEnd={(e) => {
                    const touch = e.changedTouches?.[0];
                    if (!touch || bannerCount <= 1) return;
                    const deltaX = touch.clientX - touchStartRef.current.x;
                    const deltaY = touch.clientY - touchStartRef.current.y;
                    const minSwipeDistance = 40;
                    const isHorizontalSwipe = Math.abs(deltaX) > minSwipeDistance && Math.abs(deltaX) > Math.abs(deltaY);
                    if (!isHorizontalSwipe) return;
                    setIsBannerPaused(true);
                    if (deltaX < 0) handleNext();
                    if (deltaX > 0) handlePrev();
                }}
                onMouseEnter={() => setIsBannerInteracting(true)}
                onMouseLeave={() => setIsBannerInteracting(false)}
                onFocusCapture={() => setIsBannerInteracting(true)}
                onBlurCapture={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                        setIsBannerInteracting(false);
                    }
                }}
            >
                {heroBannersUnavailable ? (
                    <div className="absolute left-4 right-4 top-4 z-20 flex justify-end pointer-events-none sm:left-auto sm:right-6">
                        <div className="pointer-events-auto max-w-full rounded-2xl border border-amber-100 bg-white/95 px-4 py-3 text-xs font-bold text-amber-800 shadow-xl backdrop-blur" role="status" aria-live="polite">
                            <div className="flex flex-wrap items-center justify-end gap-2">
                                <span>운영 배너 연결이 지연되고 있습니다.</span>
                                <button
                                    type="button"
                                    className="rounded-full bg-amber-50 px-3 py-1 font-black text-amber-700 hover:text-amber-800 disabled:opacity-60"
                                    onClick={refreshDashboard}
                                    disabled={refreshing}
                                    aria-label="운영 배너 다시 불러오기"
                                >
                                    {refreshing ? "다시 불러오는 중" : "다시 불러오기"}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : null}
                {bannersPending ? (
                    <div className="min-h-[240px] bg-gradient-to-br from-slate-900 to-primary-700 p-8 text-white sm:min-h-[280px] sm:p-10" data-home-banner-loading="true" role="status" aria-live="polite" aria-label="운영 배너를 불러오는 중입니다.">
                        <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1 text-xs font-bold text-white backdrop-blur-md">
                            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                            운영 배너 불러오는 중
                        </div>
                        <div className="mt-8 max-w-2xl space-y-4">
                            <div className="h-9 w-3/4 rounded-2xl bg-white/20" />
                            <div className="h-4 w-full rounded-full bg-white/15" />
                            <div className="h-4 w-2/3 rounded-full bg-white/15" />
                        </div>
                    </div>
                ) : (
                    <div
                        className={`flex flex-nowrap min-w-full ${isTransitioning ? "transition-transform duration-700 ease-in-out" : ""}`}
                        data-home-banner-track="true"
                        aria-live={isBannerPaused ? "polite" : "off"}
                        style={{
                            transform: `translateX(-${currentIndex * 100}%)`
                        }}
                        onTransitionEnd={handleTransitionEnd}
                    >
                        {loopBanners.map((banner, idx) => (
                            <div
                                key={`${banner.id}-${idx}`}
                                className="w-full flex-shrink-0"
                                aria-hidden={!isActiveBannerSlide(idx)}
                                aria-roledescription="slide"
                                aria-label={`${(idx % bannerCount) + 1} / ${bannerCount}`}
                            >
                                {(() => {
                                    const adsense = isAdsenseBanner(banner);
                                    const imageUrl = String(banner?.imageUrl || "").trim();
                                    const shouldLoadMedia = shouldLoadBannerMedia(idx);
                                    const hasImageBackground = shouldLoadMedia && !adsense && Boolean(imageUrl);
                                    // 운영 배너 규칙/ops rule: CONTENT + image_url는 배너 전체 배경으로 사용.
                                    const contentBannerStyle = hasImageBackground
                                        ? {
                                            backgroundImage: `linear-gradient(120deg, rgba(2, 6, 23, 0.72), rgba(30, 64, 175, 0.48)), url("${imageUrl}")`,
                                            backgroundSize: "cover",
                                            backgroundPosition: "center",
                                        }
                                        : undefined;

                                    return (
                                        <div
                                            className={`relative min-h-[240px] p-8 sm:min-h-[280px] sm:p-10 ${adsense ? "bg-white text-slate-900" : "text-white"} ${!adsense && !hasImageBackground ? "bg-gradient-to-br from-primary-600 to-primary-400" : ""}`}
                                            style={contentBannerStyle}
                                        >
                                            <div className="relative z-10">
                                                <div className={`inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-bold backdrop-blur-md ${adsense ? "bg-slate-100 text-slate-600" : "bg-white/20 text-white"}`}>
                                                    <Sparkles className={`h-3.5 w-3.5 ${adsense ? "text-primary-500" : "text-amber-300"}`} />
                                                    {banner.type === "AD" ? "광고" : "공지"}
                                                </div>

                                                {adsense ? (
                                                    <div className="mt-4">
                                                        <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-3xl">{banner.title || "광고"}</h1>
                                                        {banner.description ? (
                                                            <p className="mt-2 max-w-3xl text-sm font-medium text-slate-600 sm:text-base">{banner.description}</p>
                                                        ) : null}
                                                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                                            {adsConsent === null ? (
                                                                <div className="flex min-h-[130px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-4 text-center text-xs font-bold text-slate-500" role="status" aria-live="polite">
                                                                    광고 개인화 설정을 선택하면 이 영역이 활성화됩니다.
                                                                </div>
                                                            ) : (
                                                                <ins
                                                                    className="adsbygoogle"
                                                                    style={{ display: "block", minHeight: "130px" }}
                                                                    data-ad-client={banner.adsenseClient || adsenseClientId}
                                                                    data-ad-slot={banner.adsenseSlot || "0000000000"}
                                                                    data-ad-format="auto"
                                                                    data-full-width-responsive="true"
                                                                />
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">{banner.title}</h1>
                                                        <p className="mt-3 max-w-2xl text-base font-medium leading-relaxed text-white/90 sm:text-lg">
                                                            {banner.description}
                                                        </p>
                                                        <div className="mt-6 flex flex-wrap items-center gap-3">
                                                            {banner.linkUrl && banner.linkTarget === "EXTERNAL" ? (
                                                                <a
                                                                    href={banner.linkUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-black text-primary-700 hover:bg-primary-50"
                                                                    onClick={() => sendBannerEvent(banner, "CLICK")}
                                                                    tabIndex={isActiveBannerSlide(idx) ? undefined : -1}
                                                                >
                                                                    {banner.ctaText || "자세히 보기"}
                                                                    <ArrowRight className="h-4 w-4" />
                                                                </a>
                                                            ) : null}
                                                            {banner.linkUrl && banner.linkTarget === "INTERNAL" ? (
                                                                <Link
                                                                    to={banner.linkUrl}
                                                                    className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-black text-primary-700 hover:bg-primary-50"
                                                                    onClick={() => sendBannerEvent(banner, "CLICK")}
                                                                    tabIndex={isActiveBannerSlide(idx) ? undefined : -1}
                                                                >
                                                                    {banner.ctaText || "자세히 보기"}
                                                                    <ArrowRight className="h-4 w-4" />
                                                                </Link>
                                                            ) : null}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        ))}
                    </div>
                )}

                {bannerCount > 1 && (
                    <div className="absolute inset-x-6 bottom-6 z-10 flex flex-wrap items-center justify-between gap-3 sm:inset-x-10 sm:bottom-10">
                        <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/90 px-3 py-2 text-xs font-black text-slate-700 shadow-lg backdrop-blur transition hover:bg-white"
                            onClick={() => setIsBannerPaused((prev) => !prev)}
                            aria-pressed={isBannerPaused}
                            aria-label={isBannerPaused ? "배너 자동 전환 재생" : "배너 자동 전환 일시정지"}
                        >
                            {isBannerPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                            {isBannerPaused ? "배너 재생" : "배너 일시정지"}
                        </button>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-white/90 text-slate-700 shadow-lg backdrop-blur transition hover:bg-white"
                                onClick={() => {
                                    setIsBannerPaused(true);
                                    handlePrev();
                                }}
                                aria-label="이전 배너 보기"
                                title="이전 배너 보기"
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-white/90 text-slate-700 shadow-lg backdrop-blur transition hover:bg-white"
                                onClick={() => {
                                    setIsBannerPaused(true);
                                    handleNext();
                                }}
                                aria-label="다음 배너 보기"
                                title="다음 배너 보기"
                            >
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            {heroBanners.map((banner, idx) => (
                                <button
                                    key={banner.id}
                                    type="button"
                                    className={`h-2.5 rounded-full transition-all ${idx === bannerIndex ? "w-8 bg-primary-500" : "w-2.5 bg-slate-400/70"}`}
                                    onClick={() => {
                                        setIsBannerPaused(true);
                                        setIsTransitioning(true);
                                        setCurrentIndex(idx);
                                    }}
                                    aria-label={`배너 ${idx + 1}번 보기`}
                                    aria-current={idx === bannerIndex ? "true" : undefined}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </section>

            <section className="space-y-6" aria-labelledby="home-quick-menu-heading">
                <div className="flex items-end justify-between px-2">
                    <div className="space-y-1">
                        <h2 id="home-quick-menu-heading" className="flex items-center gap-2 text-2xl font-black tracking-tight text-slate-900">주요 서비스</h2>
                        <p className="text-sm font-medium text-slate-400">주요 기능을 바로 실행하세요.</p>
                    </div>
                </div>
                <div className="grid grid-cols-4 gap-2 sm:gap-4 lg:grid-cols-4">
                    <QuickMenuLink to="/app/boards/FREE_BOARD" icon={MessageSquare} title="사용자게시판" color="blue" prefetch="boards" />
                    <QuickMenuLink to="/app/facility" icon={Car} title="주변 찾기" color="sky" prefetch="facility" />
                    <QuickMenuLink to="/app/games" icon={Dices} title="게임 허브" color="amber" prefetch="games" />
                    <QuickMenuLink to="/app/invest" icon={Bot} title="투자 분석" color="blue" prefetch="invest" />
                </div>
            </section>

            <section className="space-y-6" aria-labelledby="home-boards-heading" aria-busy={boardsPending}>
                <div className="flex items-end justify-between px-2">
                    <div className="space-y-1">
                        <h2 id="home-boards-heading" className="text-2xl font-black tracking-tight text-slate-900">최신 게시글</h2>
                        <p className="text-sm font-medium text-slate-400">커뮤니티의 새 글을 빠르게 확인하세요.</p>
                    </div>
                    <Link
                        to="/app/boards/FREE_BOARD"
                        className="group flex items-center gap-2 text-sm font-bold text-primary-600 hover:text-primary-700"
                        onPointerEnter={prefetchBoardListRoute}
                        onFocus={prefetchBoardListRoute}
                        onTouchStart={prefetchBoardListRoute}
                        aria-label="최신 게시글 전체보기"
                    >
                        전체보기 <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                </div>
                {boardsPending ? (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3" data-home-boards-loading="true" role="status" aria-live="polite" aria-label="최신 게시글을 불러오는 중입니다.">
                        {[0, 1, 2].map((item) => (
                            <div key={item} className="card bg-white p-7">
                                <div className="mb-4 h-5 w-32 rounded-lg bg-slate-100" />
                                <div className="mb-3 h-6 w-3/4 rounded-xl bg-slate-100" />
                                <div className="space-y-2">
                                    <div className="h-4 w-full rounded-full bg-slate-100" />
                                    <div className="h-4 w-2/3 rounded-full bg-slate-100" />
                                </div>
                                <div className="mt-6 border-t border-slate-50 pt-5">
                                    <div className="h-4 w-20 rounded-full bg-slate-100" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : recentBoardsUnavailable ? (
                    <div className="rounded-[2rem] border border-amber-100 bg-amber-50/80 p-6 shadow-sm" role="status" aria-live="polite">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-black text-amber-800">최신 게시글 연결이 지연되고 있습니다.</p>
                                <p className="mt-1 text-xs font-bold text-amber-700">잠시 후 다시 불러오면 새 글 목록을 확인할 수 있습니다.</p>
                            </div>
                            <button
                                type="button"
                                className="rounded-full bg-white px-4 py-2 text-xs font-black text-amber-700 shadow-sm hover:text-amber-800 disabled:opacity-60"
                                onClick={refreshDashboard}
                                disabled={refreshing}
                                aria-label="최신 게시글 다시 불러오기"
                            >
                                {refreshing ? "다시 불러오는 중" : "다시 불러오기"}
                            </button>
                        </div>
                    </div>
                ) : recentBoards.length > 0 ? (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {recentBoards.map((board, idx) => {
                            const boardTimeLabel = toBoardTimeLabel(board.createdAt);
                            return (
                                <Link
                                    key={board.id}
                                    to={`/app/boards/${board.kind}/${board.id}`}
                                    className="card group bg-white p-7"
                                    onPointerEnter={prefetchBoardDetailRoute}
                                    onFocus={prefetchBoardDetailRoute}
                                    onTouchStart={prefetchBoardDetailRoute}
                                    aria-label={`최신 게시글 ${board.title || "제목 없음"} 자세히 보기`}
                                >
                                    <div className="mb-4 flex flex-wrap items-center gap-2">
                                        <span className="rounded-lg bg-primary-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-primary-600">
                                            {board.kindLabel || "게시글"}
                                        </span>
                                        <div className="h-1 w-1 rounded-full bg-slate-200" />
                                        <span className="text-[11px] font-bold text-slate-400">{board.creator}</span>
                                        {boardTimeLabel ? (
                                            <>
                                                <div className="h-1 w-1 rounded-full bg-slate-200" />
                                                <span className="text-[11px] font-bold text-slate-400">{boardTimeLabel}</span>
                                            </>
                                        ) : null}
                                    </div>
                                    <h3 className="mb-3 line-clamp-1 text-lg font-bold text-slate-900 transition-colors group-hover:text-primary-600">{board.title}</h3>
                                    <p className="mb-6 line-clamp-2 text-sm font-medium leading-relaxed text-slate-500">
                                        {stripHtmlTags(board.contents)}
                                    </p>
                                    <div className="flex items-center justify-between border-t border-slate-50 pt-5">
                                        <div className="flex items-center gap-3 text-[11px] font-bold text-slate-400">
                                            <span className="flex items-center gap-1.5"><Eye className="h-3.5 w-3.5 text-slate-300" /> {formatNumber(board.viewCount)}</span>
                                        </div>
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-300 transition-all duration-300 group-hover:bg-primary-500 group-hover:text-white">
                                            <ArrowRight className="h-4 w-4" />
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                ) : (
                    <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white">
                        <EmptyState message="아직 최신 게시글이 없습니다." subMessage="첫 게시글을 작성해 커뮤니티를 시작해보세요." />
                    </div>
                )}
            </section>

            {hasAdsenseBanner ? (
                <Suspense fallback={null}>
                    <HomeAdsenseRuntime
                        activeBanner={heroBanners[bannerIndex]}
                        adsConsent={adsConsent}
                        adsenseClientId={adsenseClientId}
                        bannerIndex={bannerIndex}
                        isBannerInView={isBannerInView}
                        isPageHidden={isPageHidden}
                        onConsentChange={setAdsConsent}
                        onImpression={sendBannerEvent}
                    />
                </Suspense>
            ) : null}
        </div>
    );
};

const HeaderStat = ({ label, value, trend }) => {
    return (
        <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">{label}</span>
            <span className="text-sm font-black text-slate-900" data-home-stat-value="true">{value}</span>
            {trend ? (
                <span className={`inline-flex items-center gap-1 text-[11px] font-black ${trend.isGrowth ? "text-primary-600" : "text-rose-600"}`}>
                    {trend.isGrowth ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {trend.label}
                </span>
            ) : null}
        </div>
    );
};

const QuickMenuLink = ({ to, icon: Icon, title, color, prefetch }) => {
    const colors = {
        blue: "text-blue-500 bg-white shadow-blue-100",
        rose: "text-rose-500 bg-white shadow-rose-100",
        sky: "text-sky-500 bg-white shadow-sky-100",
        amber: "text-amber-500 bg-white shadow-amber-100",
        emerald: "text-emerald-500 bg-white shadow-emerald-100",
        indigo: "text-indigo-500 bg-white shadow-indigo-100",
        slate: "text-slate-500 bg-white shadow-slate-100",
    };

    const handlePrefetch = () => {
        if (prefetch) prefetchHomeRoute(prefetch);
    };

    return (
        <Link
            to={to}
            className="group flex flex-col items-center gap-1.5 rounded-[1.5rem] p-2"
            onPointerEnter={handlePrefetch}
            onFocus={handlePrefetch}
            onTouchStart={handlePrefetch}
            aria-label={`${title} 바로가기`}
        >
            <div className={`flex aspect-square w-full items-center justify-center rounded-[1.5rem] border border-slate-200 bg-white shadow-lg transition-all duration-500 group-hover:-translate-y-1 group-hover:scale-105 group-hover:shadow-xl group-active:scale-95 ${colors[color]}`}>
                <Icon className="h-10 w-10 sm:h-20 sm:w-20 lg:h-24 lg:w-24" />
            </div>
            <span className="text-center text-[14px] font-bold leading-tight text-slate-600 transition-colors group-hover:text-primary-600 sm:text-[18px] lg:text-[20px]">{title}</span>
        </Link>
    );
};

export default Home;



