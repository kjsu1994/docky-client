import { useEffect, useState } from "react";
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
    Calculator,
    Bot,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import api from "../utils/api";
import { formatNumber, stripHtmlTags } from "../utils/helpers";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";

// API 응답에서 실제 데이터를 추출하는 헬퍼 함수
const unwrapData = (response) => response?.data?.data ?? response?.data ?? null;

// API 응답의 게시글 데이터를 정규화하는 함수
const normalizeBoards = (response) => {
    const data = unwrapData(response);
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.content)) return data.content;
    return [];
};

// 게시글 객체에서 게시판 종류를 식별하는 함수
const toBoardKind = (board) =>
    board?.kind_of_board || board?.kindOfBoard || board?.kind || "FREE_BOARD";

// 증감률 라벨 생성 헬퍼
const toPercentLabel = (value) => {
    const num = Number(value) || 0;
    const sign = num > 0 ? "+" : "";
    return `${sign}${num.toFixed(2)}%`;
};

// 홈 페이지 컴포넌트
export const Home = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState({ summary: null, compare: null });
    const [recentBoards, setRecentBoards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // 마우스 추적 핸들러 (Spotlight Effect)
    const handleMouseMove = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        e.currentTarget.style.setProperty("--mouse-x", `${x}px`);
        e.currentTarget.style.setProperty("--mouse-y", `${y}px`);
    };

    // 컴포넌트 마운트 시 데이터 로드
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError("");
            try {
                // 통계 및 최근 게시글 병렬 요청
                const [summaryRes, compareRes, freeRes, noticeRes, qaRes] = await Promise.allSettled([
                    api.get("/stats/summary"),
                    api.get("/stats/visitors/compare"),
                    api.get("/boards", { params: { kind: "FREE_BOARD", page: 0, size: 3 } }),
                    api.get("/boards", { params: { kind: "ADMIN_NOTICE", page: 0, size: 3 } }),
                    api.get("/boards", { params: { kind: "QUESTION_ANSWER", page: 0, size: 3 } }),
                ]);

                // 통계 데이터 처리
                setStats({
                    summary: summaryRes.status === "fulfilled" ? unwrapData(summaryRes.value) : null,
                    compare: compareRes.status === "fulfilled" ? unwrapData(compareRes.value) : null,
                });

                // 게시글 데이터 처리 및 정렬
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
            } catch (fetchError) {
                console.error("Critical home data fetch failure:", fetchError);
                setError("데이터를 불러오는 중 문제가 발생했습니다.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) return <LoadingSpinner text="데이터를 불러오고 있습니다..." />;
    if (error) return <ErrorMessage message={error} />;

    const changeRate = Number(stats.compare?.day_over_day_change_rate || stats.compare?.dayOverDayChangeRate) || 0;

    return (
        <div className="space-y-10 animate-fade-in pb-10">
            {/* 상단 웰컴 섹션 */}
            <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary-600 to-primary-400 p-10 text-white shadow-2xl shadow-primary-200">
                <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
                <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-primary-300/20 blur-2xl" />
                <div className="relative z-10 space-y-4">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1 text-xs font-bold backdrop-blur-md">
                        <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                        Today's Update
                    </div>
                    <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
                        안녕하세요, <span className="text-primary-100">{user?.name || user?.email?.split("@")[0]}</span>님!
                    </h1>
                    <p className="max-w-xl text-lg font-medium text-primary-50/90 leading-relaxed">
                        더 스마트하고 편리한 커뮤니티 생활을 시작해보세요.<br/>
                        새로운 소식과 유용한 도구들이 준비되어 있습니다.
                    </p>
                </div>
            </div>

            {/* 통계 대시보드 섹션 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <StatMiniCard 
                    icon={Users} 
                    label="전체 회원" 
                    value={formatNumber(stats.summary?.total_members || stats.summary?.totalMembers || 0)} 
                    color="blue" 
                    onMouseMove={handleMouseMove}
                />
                <StatMiniCard 
                    icon={MessageSquare} 
                    label="전체 게시글" 
                    value={formatNumber(stats.summary?.total_boards || stats.summary?.totalBoards || 0)} 
                    color="indigo" 
                    onMouseMove={handleMouseMove}
                />
                <StatMiniCard 
                    icon={Eye} 
                    label="오늘 방문자" 
                    value={formatNumber(stats.summary?.today_visitors || stats.summary?.todayVisitors || 0)} 
                    color="sky"
                    onMouseMove={handleMouseMove}
                    trend={stats.compare ? {
                        isGrowth: changeRate >= 0,
                        label: toPercentLabel(changeRate)
                    } : null}
                />
                <StatMiniCard 
                    icon={Activity} 
                    label="실시간 활성" 
                    value={formatNumber(stats.summary?.active_members || stats.summary?.activeMembers || 0)} 
                    color="slate" 
                    onMouseMove={handleMouseMove}
                />
            </div>

            {/* 주요 메뉴 퀵링크 */}
            <section className="space-y-6">
                <div className="flex items-end justify-between px-2">
                    <div className="space-y-1">
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                            빠른 서비스 바로가기
                        </h2>
                        <p className="text-sm font-medium text-slate-400">자주 사용하는 기능을 더 빠르게 이용하세요.</p>
                    </div>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-6">
                    <QuickMenuLink to="/app/boards/FREE_BOARD" icon={MessageSquare} title="자유게시판" color="blue" onMouseMove={handleMouseMove} />
                    <QuickMenuLink to="/app/optimizer" icon={MapPin} title="중간장소" color="rose" onMouseMove={handleMouseMove} />
                    <QuickMenuLink to="/app/ranks" icon={Trophy} title="랭킹" color="amber" onMouseMove={handleMouseMove} />
                    <QuickMenuLink to="/app/plinko" icon={Dices} title="플링코" color="emerald" onMouseMove={handleMouseMove} />
                    <QuickMenuLink to="/app/news" icon={Newspaper} title="뉴스" color="indigo" onMouseMove={handleMouseMove} />
                    <QuickMenuLink to="/app/gpt" icon={Bot} title="GPT 질문" color="slate" onMouseMove={handleMouseMove} />
                </div>
            </section>

            {/* 최근 게시글 섹션 */}
            {recentBoards.length > 0 && (
                <section className="space-y-6">
                    <div className="flex items-end justify-between px-2">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">최신 게시글</h2>
                            <p className="text-sm font-medium text-slate-400">커뮤니티의 새로운 소식을 확인해보세요.</p>
                        </div>
                        <Link to="/app/boards/FREE_BOARD" className="group flex items-center gap-2 text-sm font-bold text-primary-600 hover:text-primary-700">
                            전체보기 <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Link>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {recentBoards.map((board) => (
                            <Link
                                key={board?.board_id || board?.boardId || Math.random()}
                                to={`/app/boards/${toBoardKind(board)}/${board?.board_id || board?.boardId}`}
                                onMouseMove={handleMouseMove}
                                className="card spotlight-card group bg-white p-7"
                            >
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="rounded-lg bg-primary-50 px-2.5 py-1 text-[10px] font-black text-primary-600 uppercase tracking-wider">
                                        {toBoardKind(board).replace("_BOARD", "")}
                                    </span>
                                    <div className="h-1 w-1 rounded-full bg-slate-200" />
                                    <span className="text-[11px] font-bold text-slate-400">
                                        {board?.board_creator || board?.boardCreator || "익명"}
                                    </span>
                                </div>
                                <h3 className="mb-3 text-lg font-bold text-slate-900 line-clamp-1 group-hover:text-primary-600 transition-colors">
                                    {board?.title}
                                </h3>
                                <p className="mb-6 text-sm font-medium text-slate-500 line-clamp-2 leading-relaxed">
                                    {stripHtmlTags(board?.contents || board?.content || "")}
                                </p>
                                <div className="flex items-center justify-between pt-5 border-t border-slate-50">
                                    <div className="flex items-center gap-3 text-[11px] font-bold text-slate-400">
                                        <span className="flex items-center gap-1.5"><Eye className="h-3.5 w-3.5 text-slate-300" /> {formatNumber(board?.view_count || board?.viewCount || 0)}</span>
                                    </div>
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-300 group-hover:bg-primary-500 group-hover:text-white transition-all duration-300">
                                        <ArrowRight className="h-4 w-4" />
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
};

// 미니 통계 카드 컴포넌트
const StatMiniCard = ({ icon: Icon, label, value, color, trend, onMouseMove }) => {
    const colors = {
        blue: "text-blue-600 bg-blue-50/50",
        indigo: "text-indigo-600 bg-indigo-50/50",
        sky: "text-sky-600 bg-sky-50/50",
        slate: "text-slate-600 bg-slate-50/50",
    };

    return (
        <div onMouseMove={onMouseMove} className="card spotlight-card flex flex-col items-center justify-center bg-white p-6 sm:p-8 text-center group">
            <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${colors[color]} group-hover:scale-110 transition-transform duration-300`}>
                <Icon className="h-7 w-7" />
            </div>
            <p className="mb-1 text-[11px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
            <p className="text-2xl font-black text-slate-900 tracking-tight sm:text-3xl">{value}</p>
            {trend && (
                <div className={`mt-2 flex items-center gap-1 text-[11px] font-black ${trend.isGrowth ? "text-primary-600" : "text-rose-600"}`}>
                    {trend.isGrowth ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {trend.label}
                </div>
            )}
        </div>
    );
};

// 퀵 메뉴 링크 컴포넌트
const QuickMenuLink = ({ to, icon: Icon, title, color, onMouseMove }) => {
    const colors = {
        blue: "text-blue-500 bg-white shadow-blue-100",
        rose: "text-rose-500 bg-white shadow-rose-100",
        amber: "text-amber-500 bg-white shadow-amber-100",
        emerald: "text-emerald-500 bg-white shadow-emerald-100",
        indigo: "text-indigo-500 bg-white shadow-indigo-100",
        slate: "text-slate-500 bg-white shadow-slate-100",
    };

    return (
        <Link to={to} onMouseMove={onMouseMove} className="flex flex-col items-center gap-3 group spotlight-card p-2 rounded-[2.5rem]">
            <div className={`flex w-full aspect-square items-center justify-center rounded-[2.5rem] bg-white shadow-xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 group-hover:shadow-2xl group-active:scale-95 ${colors[color]}`}>
                <Icon className="h-8 w-8 sm:h-10 sm:w-10" />
            </div>
            <span className="text-[13px] font-bold text-slate-600 group-hover:text-primary-600 transition-colors">{title}</span>
        </Link>
    );
};

export default Home;
