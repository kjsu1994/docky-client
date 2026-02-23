import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
    ArrowRight,
    Sparkles,
    Users,
    MessageSquare,
    Eye,
    TrendingUp,
    TrendingDown,
    Activity,
    MapPin,
    Trophy,
    Dices,
    Newspaper,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import api from "../utils/api";
import { formatNumber, stripHtmlTags } from "../utils/helpers";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";

const unwrapData = (response) => response?.data?.data ?? response?.data ?? null;

const normalizeBoards = (response) => {
    const data = unwrapData(response);
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.content)) return data.content;
    if (Array.isArray(data.items)) return data.items;
    return [];
};

const toValidBannerId = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
};

const normalizeBanners = (response, fallbackName) => {
    const data = unwrapData(response);
    const items = data?.items || data?.content || data || [];
    if (Array.isArray(items) && items.length) {
        return items.map((item, idx) => ({
            id: item.bannerId ?? item.banner_id ?? idx,
            eventBannerId: toValidBannerId(item.bannerId ?? item.banner_id),
            type: item.bannerType ?? item.banner_type ?? "NOTICE",
            title: item.title || "",
            description: item.description || "",
            imageUrl: item.imageUrl ?? item.image_url ?? "",
            linkUrl: item.linkUrl ?? item.link_url ?? "",
            ctaText: item.ctaText ?? item.cta_text ?? "Learn more",
            renderMode: item.renderMode ?? item.render_mode ?? "CONTENT",
            adProvider: item.adProvider ?? item.ad_provider ?? "",
            adsenseClient: item.adsenseClient ?? item.adsense_client ?? "",
            adsenseSlot: item.adsenseSlot ?? item.adsense_slot ?? "",
        }));
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
            ctaText: "둘러보기",
            renderMode: "CONTENT",
            adProvider: "",
            adsenseClient: "",
            adsenseSlot: "",
        },
    ];
};

const toBoardKind = (board) => board?.kind_of_board || board?.kindOfBoard || board?.kind || "FREE_BOARD";

const toPercentLabel = (value) => {
    const num = Number(value) || 0;
    const sign = num > 0 ? "+" : "";
    return `${sign}${num.toFixed(2)}%`;
};

export const Home = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState({ summary: null, compare: null });
    const [recentBoards, setRecentBoards] = useState([]);
    const [heroBanners, setHeroBanners] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(true);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [adsConsent, setAdsConsent] = useState(() => {
        if (typeof window === "undefined") return null;
        const saved = window.localStorage.getItem("ads_personalization_consent");
        if (saved === "personalized" || saved === "non_personalized") return saved;
        return null;
    });

    const impressionSentRef = useRef(new Set());
    const adsenseInitializedRef = useRef(false);

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
        return heroBanners.some(
            (banner) => banner?.renderMode === "ADSENSE" && banner?.adProvider?.toUpperCase() === "ADSENSE"
        );
    }, [heroBanners]);

    const adsenseClientId = useMemo(() => {
        const fromBanner = heroBanners.find((banner) =>
            banner?.renderMode === "ADSENSE" && banner?.adProvider?.toUpperCase() === "ADSENSE" && banner?.adsenseClient
        )?.adsenseClient;
        return fromBanner || import.meta.env.VITE_ADSENSE_CLIENT || "";
    }, [heroBanners]);

    const handleNext = () => {
        if (bannerCount <= 1) return;
        setIsTransitioning(true);
        setCurrentIndex((prev) => prev + 1);
    };

    const handleTransitionEnd = () => {
        if (bannerCount <= 1) return;
        if (currentIndex === bannerCount) {
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
        if (bannerCount <= 1) return;
        const timer = setInterval(handleNext, 4500);
        return () => clearInterval(timer);
    }, [bannerCount]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError("");
            try {
                const [summaryRes, compareRes, freeRes, noticeRes, qaRes, bannerRes] = await Promise.allSettled([
                    api.get("/stats/summary"),
                    api.get("/stats/visitors/compare"),
                    api.get("/boards", { params: { kind: "FREE_BOARD", page: 0, size: 3 } }),
                    api.get("/boards", { params: { kind: "ADMIN_NOTICE", page: 0, size: 3 } }),
                    api.get("/boards", { params: { kind: "QUESTION_ANSWER", page: 0, size: 3 } }),
                    api.get("/banners", {
                        params: {
                            placement: "HOME_HERO",
                            target: user ? "USER" : "GUEST",
                            limit: 10,
                        },
                    }),
                ]);

                setStats({
                    summary: summaryRes.status === "fulfilled" ? unwrapData(summaryRes.value) : null,
                    compare: compareRes.status === "fulfilled" ? unwrapData(compareRes.value) : null,
                });

                const boardItems = [
                    ...(freeRes.status === "fulfilled" ? normalizeBoards(freeRes.value) : []),
                    ...(noticeRes.status === "fulfilled" ? normalizeBoards(noticeRes.value) : []),
                    ...(qaRes.status === "fulfilled" ? normalizeBoards(qaRes.value) : []),
                ].filter(Boolean).sort((a, b) => {
                    const aDate = new Date(a?.created_at || a?.createdAt || 0).getTime();
                    const bDate = new Date(b?.created_at || b?.createdAt || 0).getTime();
                    return bDate - aDate;
                });

                setRecentBoards(boardItems.slice(0, 6));
                const fetchedBanners = normalizeBanners(bannerRes.status === "fulfilled" ? bannerRes.value : null, user?.name || user?.email?.split("@")[0]);
                setHeroBanners(fetchedBanners);
                setCurrentIndex(0);
                setIsTransitioning(true);
                impressionSentRef.current = new Set();
            } catch (fetchError) {
                console.error("Home fetch failed:", fetchError);
                setError("데이터를 불러오는 중 문제가 발생했습니다.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

    const saveAdsConsent = (value) => {
        setAdsConsent(value);
        try {
            window.localStorage.setItem("ads_personalization_consent", value);
        } catch {
            // Ignore localStorage failure
        }
    };

    const sendBannerEvent = async (banner, eventType) => {
        const bannerId = toValidBannerId(banner?.eventBannerId ?? banner?.id);
        if (!bannerId) return;
        try {
            await api.post("/banners/events", {
                banner_id: bannerId,
                event_type: eventType,
                placement: "HOME_HERO",
            });
        } catch {
            // Ignore logging errors on client.
        }
    };

    useEffect(() => {
        if (typeof window === "undefined") return;
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.requestNonPersonalizedAds = adsConsent === "non_personalized" ? 1 : 0;
    }, [adsConsent]);

    useEffect(() => {
        if (!hasAdsenseBanner || !adsenseClientId) return;

        const scriptSrc = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`;
        const exists = Array.from(document.scripts || []).some(
            (script) => script.src && script.src.includes("googlesyndication.com/pagead/js/adsbygoogle.js")
        );

        if (exists) {
            adsenseInitializedRef.current = true;
            return;
        }

        const script = document.createElement("script");
        script.async = true;
        script.src = scriptSrc;
        script.crossOrigin = "anonymous";
        script.onload = () => {
            adsenseInitializedRef.current = true;
        };
        document.head.appendChild(script);
    }, [hasAdsenseBanner, adsenseClientId]);

    useEffect(() => {
        const banner = heroBanners[bannerIndex];
        if (!banner?.id) return;
        const key = String(banner.id);
        if (impressionSentRef.current.has(key)) return;
        impressionSentRef.current.add(key);
        sendBannerEvent(banner, "IMPRESSION");
    }, [bannerIndex, heroBanners]);

    useEffect(() => {
        const banner = heroBanners[bannerIndex];
        const isAdsense = banner?.renderMode === "ADSENSE" && banner?.adProvider?.toUpperCase() === "ADSENSE";
        if (!isAdsense || !adsenseInitializedRef.current) return;
        if (typeof window === "undefined") return;
        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch {
            // Ignore if ads script is not ready yet.
        }
    }, [bannerIndex, heroBanners]);

    if (loading) return <LoadingSpinner text="데이터를 불러오는 중입니다..." />;
    if (error) return <ErrorMessage message={error} />;

    const changeRate = Number(stats.compare?.day_over_day_change_rate || stats.compare?.dayOverDayChangeRate) || 0;

    const openBannerLink = (banner) => {
        if (!banner?.linkUrl) return;
        sendBannerEvent(banner, "CLICK");
        if (banner.linkUrl.startsWith("http://") || banner.linkUrl.startsWith("https://")) {
            window.open(banner.linkUrl, "_blank", "noopener,noreferrer");
            return;
        }
        window.location.href = banner.linkUrl;
    };

    const isAdsenseMode = (banner) => banner?.renderMode === "ADSENSE" && banner?.adProvider?.toUpperCase() === "ADSENSE";

    return (
        <div className="space-y-10 animate-fade-in pb-10">
            <section className="relative overflow-hidden rounded-[2.5rem] border border-slate-200/70 bg-white shadow-2xl shadow-slate-200/70">
                <div
                    className={`flex flex-nowrap min-w-full ${isTransitioning ? "transition-transform duration-700 ease-in-out" : ""}`}
                    style={{ 
                        transform: `translateX(-${currentIndex * 100}%)`
                    }}
                    onTransitionEnd={handleTransitionEnd}
                >
                    {loopBanners.map((banner, idx) => (
                        <div key={`${banner.id}-${idx}`} className="w-full flex-shrink-0">
                            {(() => {
                                const adsense = isAdsenseMode(banner);
                                const imageUrl = String(banner?.imageUrl || "").trim();
                                const hasImageBackground = !adsense && Boolean(imageUrl);
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
                                        {!adsense && !hasImageBackground ? (
                                            <>
                                                <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
                                                <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-primary-300/20 blur-2xl" />
                                            </>
                                        ) : null}
                                        <div className="relative z-10">
                                            <div className={`inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-bold backdrop-blur-md ${adsense ? "bg-slate-100 text-slate-600" : "bg-white/20 text-white"}`}>
                                                <Sparkles className={`h-3.5 w-3.5 ${adsense ? "text-primary-500" : "text-amber-300"}`} />
                                                {banner.type === "AD" ? "Sponsored" : "Notice"}
                                            </div>

                                            {adsense ? (
                                                <div className="mt-4">
                                                    <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-3xl">{banner.title || "Sponsored"}</h1>
                                                    {banner.description ? (
                                                        <p className="mt-2 max-w-3xl text-sm font-medium text-slate-600 sm:text-base">{banner.description}</p>
                                                    ) : null}
                                                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                                        <ins
                                                            className="adsbygoogle"
                                                            style={{ display: "block", minHeight: "130px" }}
                                                            data-ad-client={banner.adsenseClient || adsenseClientId}
                                                            data-ad-slot={banner.adsenseSlot || "0000000000"}
                                                            data-ad-format="auto"
                                                            data-full-width-responsive="true"
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">{banner.title}</h1>
                                                    <p className="mt-3 max-w-2xl text-base font-medium leading-relaxed text-white/90 sm:text-lg">
                                                        {banner.description}
                                                    </p>
                                                    <div className="mt-6 flex flex-wrap items-center gap-3">
                                                        {banner.linkUrl ? (
                                                            <button
                                                                type="button"
                                                                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-black text-primary-700 hover:bg-primary-50"
                                                                onClick={() => openBannerLink(banner)}
                                                            >
                                                                {banner.ctaText || "자세히 보기"}
                                                                <ArrowRight className="h-4 w-4" />
                                                            </button>
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

                {bannerCount > 1 && (
                    <div className="absolute bottom-8 right-8 z-10 sm:bottom-10 sm:right-10">
                        <div className="flex items-center gap-2">
                            {heroBanners.map((banner, idx) => (
                                <button
                                    key={banner.id}
                                    type="button"
                                    className={`h-2.5 rounded-full transition-all ${idx === bannerIndex ? "w-8 bg-primary-500" : "w-2.5 bg-slate-400/70"}`}
                                    onClick={() => {
                                        setIsTransitioning(true);
                                        setCurrentIndex(idx);
                                    }}
                                    aria-label={`banner-${idx + 1}`}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </section>

            <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
                <StatMiniCard icon={Users} label="전체 회원" value={formatNumber(stats.summary?.total_members || stats.summary?.totalMembers || 0)} color="blue" />
                <StatMiniCard icon={MessageSquare} label="전체 게시글" value={formatNumber(stats.summary?.total_boards || stats.summary?.totalBoards || 0)} color="indigo" />
                <StatMiniCard
                    icon={Eye}
                    label="오늘 방문자"
                    value={formatNumber(stats.summary?.today_visitors || stats.summary?.todayVisitors || 0)}
                    color="sky"
                    trend={stats.compare ? { isGrowth: changeRate >= 0, label: toPercentLabel(changeRate) } : null}
                />
                <StatMiniCard icon={Activity} label="활성 사용자" value={formatNumber(stats.summary?.active_members || stats.summary?.activeMembers || 0)} color="slate" />
            </div>

            <section className="space-y-6">
                <div className="flex items-end justify-between px-2">
                    <div className="space-y-1">
                        <h2 className="flex items-center gap-2 text-2xl font-black tracking-tight text-slate-900">빠른 서비스</h2>
                        <p className="text-sm font-medium text-slate-400">자주 사용하는 기능을 바로 실행하세요.</p>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-3 sm:gap-6 lg:grid-cols-5">
                    <QuickMenuLink to="/app/boards/FREE_BOARD" icon={MessageSquare} title="자유게시판" color="blue" />
                    <QuickMenuLink to="/app/optimizer" icon={MapPin} title="중간장소" color="rose" />
                    <QuickMenuLink to="/app/ranks" icon={Trophy} title="랭킹" color="amber" />
                    <QuickMenuLink to="/app/plinko" icon={Dices} title="플링코" color="emerald" />
                    <QuickMenuLink to="/app/news" icon={Newspaper} title="뉴스" color="indigo" />
                </div>
            </section>

            {recentBoards.length > 0 && (
                <section className="space-y-6">
                    <div className="flex items-end justify-between px-2">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-black tracking-tight text-slate-900">최신 게시글</h2>
                            <p className="text-sm font-medium text-slate-400">커뮤니티의 새 글을 빠르게 확인하세요.</p>
                        </div>
                        <Link to="/app/boards/FREE_BOARD" className="group flex items-center gap-2 text-sm font-bold text-primary-600 hover:text-primary-700">
                            전체보기 <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Link>
                    </div>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {recentBoards.map((board, idx) => (
                            <Link
                                key={board?.board_id || board?.boardId || `recent-board-${idx}`}
                                to={`/app/boards/${toBoardKind(board)}/${board?.board_id || board?.boardId}`}
                                className="card group bg-white p-7"
                            >
                                <div className="mb-4 flex items-center gap-2">
                                    <span className="rounded-lg bg-primary-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-primary-600">
                                        {toBoardKind(board).replace("_BOARD", "")}
                                    </span>
                                    <div className="h-1 w-1 rounded-full bg-slate-200" />
                                    <span className="text-[11px] font-bold text-slate-400">{board?.board_creator || board?.boardCreator || "익명"}</span>
                                </div>
                                <h3 className="mb-3 line-clamp-1 text-lg font-bold text-slate-900 transition-colors group-hover:text-primary-600">{board?.title}</h3>
                                <p className="mb-6 line-clamp-2 text-sm font-medium leading-relaxed text-slate-500">
                                    {stripHtmlTags(board?.contents || board?.content || "")}
                                </p>
                                <div className="flex items-center justify-between border-t border-slate-50 pt-5">
                                    <div className="flex items-center gap-3 text-[11px] font-bold text-slate-400">
                                        <span className="flex items-center gap-1.5"><Eye className="h-3.5 w-3.5 text-slate-300" /> {formatNumber(board?.view_count || board?.viewCount || 0)}</span>
                                    </div>
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-300 transition-all duration-300 group-hover:bg-primary-500 group-hover:text-white">
                                        <ArrowRight className="h-4 w-4" />
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {adsConsent === null ? (
                <div className="fixed inset-x-4 top-4 z-50 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:inset-x-auto sm:right-6 sm:w-[420px]">
                    <div className="text-sm font-black text-slate-900">광고 개인화 설정</div>
                    <p className="mt-1 text-xs text-slate-600">
                        맞춤 광고 동의 여부를 선택해 주세요. 선택은 언제든 변경할 수 있습니다.
                    </p>
                    <div className="mt-3 flex gap-2">
                        <button
                            type="button"
                            className="btn-primary flex-1 text-xs"
                            onClick={() => saveAdsConsent("personalized")}
                        >
                            맞춤 광고 동의
                        </button>
                        <button
                            type="button"
                            className="btn-secondary flex-1 text-xs"
                            onClick={() => saveAdsConsent("non_personalized")}
                        >
                            비개인화 광고
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

const StatMiniCard = ({ icon: Icon, label, value, color, trend }) => {
    const colors = {
        blue: "text-blue-600 bg-blue-50/50",
        indigo: "text-indigo-600 bg-indigo-50/50",
        sky: "text-sky-600 bg-sky-50/50",
        slate: "text-slate-600 bg-slate-50/50",
    };

    return (
        <div className="card flex flex-col items-center justify-center bg-white p-6 text-center sm:p-8">
            <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${colors[color]} transition-transform duration-300`}>
                <Icon className="h-7 w-7" />
            </div>
            <p className="mb-1 text-[11px] font-black uppercase tracking-widest text-slate-400">{label}</p>
            <p className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{value}</p>
            {trend && (
                <div className={`mt-2 flex items-center gap-1 text-[11px] font-black ${trend.isGrowth ? "text-primary-600" : "text-rose-600"}`}>
                    {trend.isGrowth ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {trend.label}
                </div>
            )}
        </div>
    );
};

const QuickMenuLink = ({ to, icon: Icon, title, color }) => {
    const colors = {
        blue: "text-blue-500 bg-white shadow-blue-100",
        rose: "text-rose-500 bg-white shadow-rose-100",
        amber: "text-amber-500 bg-white shadow-amber-100",
        emerald: "text-emerald-500 bg-white shadow-emerald-100",
        indigo: "text-indigo-500 bg-white shadow-indigo-100",
        slate: "text-slate-500 bg-white shadow-slate-100",
    };

    return (
        <Link to={to} className="group flex flex-col items-center gap-3 rounded-[2.5rem] p-2">
            <div className={`flex aspect-square w-full items-center justify-center rounded-[2.5rem] bg-white shadow-xl transition-all duration-500 group-hover:-translate-y-2 group-hover:scale-105 group-hover:shadow-2xl group-active:scale-95 ${colors[color]}`}>
                <Icon className="h-8 w-8 sm:h-10 sm:w-10" />
            </div>
            <span className="text-[13px] font-bold text-slate-600 transition-colors group-hover:text-primary-600">{title}</span>
        </Link>
    );
};

export default Home;

