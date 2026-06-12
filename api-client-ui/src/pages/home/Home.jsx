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
    Clock3,
    Search,
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

const HOME_RESUME_SOURCES = [
    { key: "poker_last_room_id", titleKey: "poker_last_room_title", title: "포커", to: "/app/poker", type: "room" },
    { key: "las_vegas_last_room_id", titleKey: "las_vegas_last_room_title", title: "Las Vegas", to: "/app/games/las-vegas", type: "room" },
    { key: "no_thanks_last_room_id", titleKey: "no_thanks_last_room_title", title: "No Thanks", to: "/app/games/no-thanks", type: "room" },
    { key: "catan_last_room_id", titleKey: "catan_last_room_title", title: "카탄", to: "/app/games/catan", type: "room" },
    { key: "blokus_last_room_id", titleKey: "blokus_last_room_title", title: "블로커스", to: "/app/games/blokus", type: "room" },
    { key: "mahe_last_room_id", titleKey: "mahe_last_room_title", title: "마헤", to: "/app/games/mahe", type: "room" },
    { key: "dalmuti_last_room_id", titleKey: "dalmuti_last_room_title", title: "달무티", to: "/app/games/dalmuti", type: "room" },
    { key: "six_nimmt_last_room_id", titleKey: "six_nimmt_last_room_title", title: "6 nimmt!", to: "/app/games/six-nimmt", type: "room" },
    { key: "telestrations_last_room_id", titleKey: "telestrations_last_room_title", title: "텔레스트레이션", to: "/app/games/telestrations", type: "room" },
    { key: "mafia_last_room_id", titleKey: "mafia_last_room_title", title: "마피아", to: "/app/games/mafia", type: "room" },
    { key: "citadels_last_room_id", titleKey: "citadels_last_room_title", title: "시티델", to: "/app/games/citadels", type: "room" },
    { key: "good_etc_rpg_save_v1", title: "Good_ETC RPG", to: "/app/games/video/rpg", type: "progress" },
];

const HOME_QUICK_COMMANDS = [
    { title: "사용자게시판", hint: "새 글과 커뮤니티", to: "/app/boards/FREE_BOARD", prefetch: "boards" },
    { title: "게임 허브", hint: "보드게임과 비디오게임", to: "/app/games", prefetch: "games" },
    { title: "포커", hint: "방 입장형 카드 게임", to: "/app/poker", prefetch: "games" },
    { title: "주변 찾기", hint: "시설 검색", to: "/app/facility", prefetch: "facility" },
    { title: "투자 분석", hint: "지역·시설 분석", to: "/app/invest", prefetch: "invest" },
    { title: "최신 게시글", hint: "최근 커뮤니티 글", to: "/app/boards/FREE_BOARD", prefetch: "boards" },
];

const readHomeStorage = (key) => {
    if (typeof window === "undefined") return "";
    try {
        return window.localStorage.getItem(key) || "";
    } catch {
        return "";
    }
};

const summarizeProgressSave = (rawValue) => {
    try {
        const parsed = JSON.parse(rawValue);
        const level = parsed?.level || parsed?.player?.level;
        const chapter = parsed?.chapter || parsed?.currentChapter;
        if (level) return `Lv.${level} 저장됨`;
        if (chapter) return `${chapter} 진행 중`;
    } catch {
        // 저장 포맷은 게임 쪽 소유이므로 홈에서는 실패 시 일반 문구만 표시한다.
    }
    return "저장된 진행";
};

const readHomeResumeEntries = () => {
    return HOME_RESUME_SOURCES.map((source) => {
        const rawValue = readHomeStorage(source.key);
        if (!rawValue) return null;
        const roomTitle = source.titleKey ? readHomeStorage(source.titleKey).trim() : "";
        return {
            key: source.key,
            title: source.title,
            to: source.to,
            type: source.type,
            detail: source.type === "progress" ? summarizeProgressSave(rawValue) : roomTitle || "최근 방",
        };
    }).filter(Boolean).slice(0, 4);
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
    const [resumeEntries, setResumeEntries] = useState(readHomeResumeEntries);
    const [quickQuery, setQuickQuery] = useState("");

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

    const quickMenuItems = useMemo(() => {
        const items = [
            { to: "/app/boards/FREE_BOARD", icon: MessageSquare, title: "사용자게시판", color: "blue", prefetch: "boards" },
            { to: "/app/facility", icon: Car, title: "주변 찾기", color: "sky", prefetch: "facility" },
            { to: "/app/games", icon: Dices, title: "게임 허브", color: "amber", prefetch: "games" },
            { to: "/app/invest", icon: Bot, title: "투자 분석", color: "blue", prefetch: "invest" },
        ];
        if (!resumeEntries.length) return items;
        return [items[2], items[0], items[1], items[3]];
    }, [resumeEntries.length]);

    const quickSearchResults = useMemo(() => {
        const query = quickQuery.trim().toLowerCase();
        if (!query) return [];
        return HOME_QUICK_COMMANDS.filter((item) => {
            return `${item.title} ${item.hint}`.toLowerCase().includes(query);
        }).slice(0, 4);
    }, [quickQuery]);

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
        if (typeof window === "undefined") return;
        const refreshResumeEntries = () => setResumeEntries(readHomeResumeEntries());
        refreshResumeEntries();
        window.addEventListener("storage", refreshResumeEntries);
        window.addEventListener("focus", refreshResumeEntries);
        return () => {
            window.removeEventListener("storage", refreshResumeEntries);
            window.removeEventListener("focus", refreshResumeEntries);
        };
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
        <div className="space-y-8 animate-fade-in pb-10 sm:space-y-9 lg:space-y-10">
            <section
                className="max-w-full rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm"
                aria-label="홈 통계 요약"
                aria-busy={statsPending}
            >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-black" aria-label="홈 빠른 상태">
                        <Link to="/app/games" className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700 hover:bg-amber-100">
                            {resumeEntries.length ? `이어하기 ${resumeEntries.length}` : "게임 바로 시작"}
                        </Link>
                        <Link to="/app/boards/FREE_BOARD" className="rounded-full bg-primary-50 px-3 py-1.5 text-primary-700 hover:bg-primary-100">
                            최신 글 {recentBoards.length || "-"}
                        </Link>
                    </div>
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

            <HomeResumeStrip entries={resumeEntries} />

            <section
                ref={bannerSectionRef}
                className="relative overflow-hidden rounded-[1.5rem] bg-white shadow-xl shadow-slate-200/60 sm:rounded-[2rem]"
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
                    <div className="min-h-[160px] bg-gradient-to-br from-slate-900 to-primary-700 p-4 text-white sm:min-h-[220px] sm:p-7 lg:min-h-[240px]" data-home-banner-loading="true" role="status" aria-live="polite" aria-label="운영 배너를 불러오는 중입니다.">
                        <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1 text-xs font-bold text-white backdrop-blur-md">
                            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                            운영 배너 불러오는 중
                        </div>
                        <div className="mt-5 max-w-2xl space-y-3 sm:mt-7">
                            <div className="h-7 w-3/4 rounded-2xl bg-white/20 sm:h-9" />
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
                                            backgroundImage: `url("${imageUrl}")`,
                                            backgroundSize: "cover",
                                            backgroundPosition: "center",
                                        }
                                        : undefined;

                                    return (
                                        <div
                                            className={`relative min-h-[160px] p-4 sm:min-h-[220px] sm:p-7 lg:min-h-[240px] ${adsense ? "bg-white text-slate-900" : "text-white"} ${!adsense && !hasImageBackground ? "bg-gradient-to-br from-primary-600 to-primary-400" : ""}`}
                                            style={contentBannerStyle}
                                        >
                                            <div className={`relative z-10 ${hasImageBackground ? "max-w-3xl [text-shadow:0_2px_12px_rgba(15,23,42,0.72)]" : ""}`}>
                                                <div className={`inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-bold ${adsense ? "bg-slate-100 text-slate-600" : hasImageBackground ? "bg-slate-950/40 text-white shadow-sm backdrop-blur-[2px]" : "bg-white/20 text-white backdrop-blur-md"}`}>
                                                    <Sparkles className={`h-3.5 w-3.5 ${adsense ? "text-primary-500" : "text-amber-300"}`} />
                                                    {banner.type === "AD" ? "광고" : "공지"}
                                                </div>

                                                {adsense ? (
                                                    <div className="mt-3">
                                                        <h1 className="text-lg font-black tracking-tight text-slate-900 sm:text-2xl">{banner.title || "광고"}</h1>
                                                        {banner.description ? (
                                                            <p className="mt-2 line-clamp-2 max-w-3xl text-sm font-medium text-slate-600">{banner.description}</p>
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
                                                        <h1 className="mt-3 line-clamp-2 text-xl font-black tracking-tight sm:text-4xl lg:text-5xl">{banner.title}</h1>
                                                        <p className="mt-2 line-clamp-2 max-w-2xl text-sm font-semibold leading-relaxed text-white sm:text-base">
                                                            {banner.description}
                                                        </p>
                                                        <div className="mt-4 flex flex-wrap items-center gap-3">
                                                            {banner.linkUrl && banner.linkTarget === "EXTERNAL" ? (
                                                                <a
                                                                    href={banner.linkUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className={`inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-black ${hasImageBackground ? "text-slate-950 hover:bg-white/90" : "text-primary-700 hover:bg-primary-50"}`}
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
                                                                    className={`inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-black ${hasImageBackground ? "text-slate-950 hover:bg-white/90" : "text-primary-700 hover:bg-primary-50"}`}
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
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur sm:px-5">
                        <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
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
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 sm:h-9 sm:w-9"
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
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 sm:h-9 sm:w-9"
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
                                    className={`h-2.5 rounded-full transition-all ${idx === bannerIndex ? "w-8 bg-primary-500" : "w-2.5 bg-slate-300"}`}
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

            <section className="space-y-4" aria-labelledby="home-quick-menu-heading">
                <div className="flex items-end justify-between px-2">
                    <div className="space-y-1">
                        <h2 id="home-quick-menu-heading" className="flex items-center gap-2 text-xl font-black tracking-tight text-slate-900 sm:text-2xl">주요 서비스</h2>
                        <p className="text-sm font-medium text-slate-400">주요 기능을 바로 실행하세요.</p>
                    </div>
                </div>
                <HomeQuickSearch
                    query={quickQuery}
                    results={quickSearchResults}
                    onQueryChange={setQuickQuery}
                />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-4">
                    {quickMenuItems.map((item) => (
                        <QuickMenuLink key={item.to} {...item} />
                    ))}
                </div>
            </section>

            <section className="space-y-4" aria-labelledby="home-boards-heading" aria-busy={boardsPending}>
                <div className="flex items-end justify-between px-2">
                    <div className="space-y-1">
                        <h2 id="home-boards-heading" className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">최신 게시글</h2>
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
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3" data-home-boards-loading="true" role="status" aria-live="polite" aria-label="최신 게시글을 불러오는 중입니다.">
                        {[0, 1, 2].map((item) => (
                            <div key={item} className="card bg-white p-4 sm:p-5">
                                <div className="mb-3 h-4 w-28 rounded-lg bg-slate-100" />
                                <div className="mb-3 h-5 w-3/4 rounded-xl bg-slate-100" />
                                <div className="space-y-2">
                                    <div className="h-4 w-full rounded-full bg-slate-100" />
                                    <div className="h-4 w-2/3 rounded-full bg-slate-100" />
                                </div>
                                <div className="mt-4 border-t border-slate-50 pt-3">
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
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {recentBoards.map((board) => {
                            const boardTimeLabel = toBoardTimeLabel(board.createdAt);
                            return (
                                <Link
                                    key={board.id}
                                    to={`/app/boards/${board.kind}/${board.id}`}
                                    className="card group bg-white p-4 sm:p-5"
                                    onPointerEnter={prefetchBoardDetailRoute}
                                    onFocus={prefetchBoardDetailRoute}
                                    onTouchStart={prefetchBoardDetailRoute}
                                    aria-label={`최신 게시글 ${board.title || "제목 없음"} 자세히 보기`}
                                >
                                    <div className="mb-3 flex flex-wrap items-center gap-2">
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
                                    <h3 className="mb-2 line-clamp-1 text-base font-bold text-slate-900 transition-colors group-hover:text-primary-600 sm:text-lg">{board.title}</h3>
                                    <p className="mb-4 line-clamp-1 text-sm font-medium leading-relaxed text-slate-500 sm:line-clamp-2">
                                        {stripHtmlTags(board.contents)}
                                    </p>
                                    <div className="flex items-center justify-between border-t border-slate-50 pt-3">
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

            <PrivacyPolicyFooter />
        </div>
    );
};

const HomeResumeStrip = ({ entries }) => {
    if (!entries.length) return null;

    return (
        <section className="rounded-2xl border border-amber-100 bg-amber-50/70 p-3 shadow-sm sm:p-4" aria-label="최근 이어하기" data-smoke="home-resume-strip">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-amber-600 shadow-sm">
                        <Clock3 className="h-4 w-4" />
                    </span>
                    <div>
                        <h2 className="text-sm font-black text-slate-900">최근 이어하기</h2>
                        <p className="text-xs font-bold text-slate-500">진행 중인 방과 저장된 게임만 표시합니다.</p>
                    </div>
                </div>
                <Link to="/app/games" className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-amber-700 shadow-sm hover:text-amber-800">
                    전체 게임
                </Link>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {entries.map((entry) => (
                    <Link
                        key={entry.key}
                        to={entry.to}
                        className="group flex min-w-0 items-center justify-between gap-3 rounded-xl border border-white bg-white/90 px-3 py-2 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-md"
                    >
                        <span className="min-w-0">
                            <span className="block truncate text-sm font-black text-slate-900">{entry.title}</span>
                            <span className="block truncate text-xs font-bold text-slate-500">{entry.detail}</span>
                        </span>
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-black text-amber-700 group-hover:bg-amber-200">
                            이어하기
                        </span>
                    </Link>
                ))}
            </div>
        </section>
    );
};

const HomeQuickSearch = ({ query, results, onQueryChange }) => {
    const hasQuery = query.trim().length > 0;

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" data-smoke="home-quick-search">
            <label className="sr-only" htmlFor="home-quick-search">빠른 이동 검색</label>
            <div className="flex items-center gap-2">
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                    id="home-quick-search"
                    type="search"
                    value={query}
                    onChange={(event) => onQueryChange(event.target.value)}
                    placeholder="게임, 게시판, 주변 찾기 검색"
                    className="min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none placeholder:text-slate-400"
                    autoComplete="off"
                />
            </div>
            {hasQuery ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" role="list" aria-label="빠른 이동 검색 결과">
                    {results.length ? results.map((item) => {
                        const handlePrefetch = () => {
                            if (item.prefetch) prefetchHomeRoute(item.prefetch);
                        };
                        return (
                            <Link
                                key={`${item.to}-${item.title}`}
                                to={item.to}
                                className="rounded-xl bg-slate-50 px-3 py-2 text-left transition hover:bg-primary-50"
                                onPointerEnter={handlePrefetch}
                                onFocus={handlePrefetch}
                                onTouchStart={handlePrefetch}
                                aria-label={`${item.title} 바로 이동`}
                                role="listitem"
                            >
                                <span className="block text-sm font-black text-slate-900">{item.title}</span>
                                <span className="block text-xs font-bold text-slate-500">{item.hint}</span>
                            </Link>
                        );
                    }) : (
                        <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500" role="status">
                            일치하는 바로가기가 없습니다.
                        </div>
                    )}
                </div>
            ) : null}
        </div>
    );
};

const PrivacyPolicyFooter = () => {
    const businessInfo = [
        ["상호", "Docky"],
        ["대표자", "김진수"],
        ["사업자등록번호", "    "],
        ["통신판매업신고번호", "    "],
        ["사업장 주소", "대전광역시 서구 계룡로"],
        ["전화번호", "    "],
        ["고객센터", "kjsu1701@naver.com"],
        ["개인정보 보호 문의", "kjsu1701@naver.com"],
        ["호스팅서비스 제공자", "자체 서버 및 Cloudflare"],
        ["사업자정보 확인", "등록 완료 후 공정거래위원회 공개정보로 확인 가능"],
    ];
    const privacyItems = [
        {
            title: "처리 목적",
            body: "회원가입과 로그인, 게시판·채팅·게임·알림 등 서비스 제공, 부정 이용 방지, 보안 사고 대응, 이용 통계 개선을 위해 필요한 범위에서 개인정보를 처리합니다.",
        },
        {
            title: "처리 항목",
            body: "계정 식별정보, 이름 또는 닉네임, 이메일, 휴대전화번호, 프로필 이미지, 서비스 이용기록, 접속 로그, IP 주소, 쿠키 및 인증 토큰 등 서비스 이용 과정에서 필요한 정보가 처리될 수 있습니다.",
        },
        {
            title: "보유 기간",
            body: "개인정보는 처리 목적 달성 또는 회원 탈퇴 시 지체 없이 파기합니다. 다만 관계 법령에 따라 보존이 필요한 경우 해당 법령에서 정한 기간 동안 분리 보관합니다.",
        },
        {
            title: "제3자 제공 및 위탁",
            body: "법령에 근거가 있거나 이용자의 동의가 있는 경우를 제외하고 개인정보를 제3자에게 제공하지 않습니다. 서비스 운영에 필요한 외부 처리위탁이 발생하는 경우 수탁자와 업무 내용을 공개하고 필요한 보호조치를 적용합니다.",
        },
        {
            title: "정보주체 권리",
            body: "이용자는 개인정보의 열람, 정정, 삭제, 처리정지, 동의 철회를 요청할 수 있으며, 서비스는 본인 확인 후 관련 법령이 정한 절차에 따라 처리합니다.",
        },
        {
            title: "안전성 확보조치",
            body: "접근권한 관리, 인증정보 보호, 전송구간 암호화, 접속기록 관리, 파일 업로드 제한, 개인정보 접근 최소화 등 기술적·관리적 보호조치를 적용합니다.",
        },
    ];

    return (
        <footer className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-[11px] text-slate-500 shadow-sm sm:px-4" aria-labelledby="home-footer-info-heading">
            <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h2 id="home-footer-info-heading" className="text-xs font-black text-slate-800 sm:text-sm">사업자 정보 및 개인정보처리방침</h2>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-black text-slate-600">시행일 2026.06.03</span>
                </div>
                <p className="font-medium leading-snug">
                    전자상거래 등에서의 소비자보호에 관한 법률 및 개인정보 보호법에 따라 Docky 운영자 정보와 개인정보 처리 기준을 고지합니다.
                </p>
                <dl className="flex flex-wrap gap-x-3 gap-y-1 leading-snug">
                    {businessInfo.map(([label, value]) => (
                        <div key={label} className="inline-flex min-w-0 items-baseline gap-1">
                            <dt className="shrink-0 font-black text-slate-700">{label}</dt>
                            <dd className="min-w-0 break-words font-bold text-slate-500">{value}</dd>
                        </div>
                    ))}
                </dl>
                <p className="font-bold leading-snug text-amber-700">
                    사업자등록번호, 통신판매업신고번호, 전화번호는 등록 완료 후 갱신하며, 유료 상품 또는 결제 기능 제공 시 거래조건·청약철회·환불·분쟁처리·구매안전서비스 적용 여부를 별도 고지합니다.
                </p>
            </div>

            <details className="mt-2 rounded-xl bg-slate-50 px-3 py-2">
                <summary className="cursor-pointer text-xs font-black text-slate-700 sm:text-sm">개인정보처리방침 상세 내용 보기</summary>
                <p className="mt-3 font-medium leading-snug">
                    Docky는 개인정보 보호법 등 관계 법령에 따라 이용자의 개인정보를 필요한 범위에서만 처리하며, 처리 목적이 달성된 정보는 지체 없이 파기합니다.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {privacyItems.map((item) => (
                        <section key={item.title} className="rounded-xl border border-slate-200 bg-white p-2.5">
                            <h3 className="font-black text-slate-700">{item.title}</h3>
                            <p className="mt-1 leading-snug">{item.body}</p>
                        </section>
                    ))}
                </div>
                <div className="mt-2 rounded-xl border border-slate-200 bg-white p-2.5 leading-snug">
                    개인정보 보호 관련 문의, 권리 행사, 불만 처리는 사이트 내 문의 기능 또는 관리자 연락 채널로 접수할 수 있습니다. 방침 변경 시 변경 내용과 시행일을 서비스 화면에 공지합니다.
                </div>
            </details>
        </footer>
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
            className="group flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:scale-95 sm:min-h-[132px]"
            onPointerEnter={handlePrefetch}
            onFocus={handlePrefetch}
            onTouchStart={handlePrefetch}
            aria-label={`${title} 바로가기`}
        >
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-md transition-all duration-300 group-hover:scale-105 sm:h-16 sm:w-16 lg:h-20 lg:w-20 ${colors[color]}`}>
                <Icon className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10" />
            </div>
            <span className="text-center text-sm font-bold leading-tight text-slate-600 transition-colors group-hover:text-primary-600 sm:text-base">{title}</span>
        </Link>
    );
};

export default Home;
