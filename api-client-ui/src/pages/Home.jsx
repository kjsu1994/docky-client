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

    if (loading) return <LoadingSpinner text="홈 대시보드 구성 중..." />;
    if (error) return <ErrorMessage message={error} />;

    const changeRate = Number(stats.compare?.day_over_day_change_rate || stats.compare?.dayOverDayChangeRate) || 0;

    return (
        <div className="space-y-8 animate-fade-in">
            {/* 상단 웰컴 섹션 */}
            <div className="card p-8 bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-xl overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32 blur-3xl pointer-events-none" />
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <Sparkles className="h-8 w-8 text-amber-300" />
                        <h1 className="text-3xl font-black italic tracking-tighter uppercase">
                            Welcome Back, {user?.name || user?.email?.split("@")[0]}!
                        </h1>
                    </div>
                    <p className="text-primary-100 text-lg font-medium">
                        커뮤니티와 함께 탄소 저감을 실천하고 지구를 지켜보세요.
                    </p>
                </div>
            </div>

            {/* 통계 대시보드 섹션 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatMiniCard 
                    icon={Users} 
                    label="전체 회원" 
                    value={formatNumber(stats.summary?.total_members || stats.summary?.totalMembers || 0)} 
                    color="blue" 
                />
                <StatMiniCard 
                    icon={MessageSquare} 
                    label="전체 게시글" 
                    value={formatNumber(stats.summary?.total_boards || stats.summary?.totalBoards || 0)} 
                    color="emerald" 
                />
                <StatMiniCard 
                    icon={Eye} 
                    label="오늘 방문자" 
                    value={formatNumber(stats.summary?.today_visitors || stats.summary?.todayVisitors || 0)} 
                    color="orange"
                    trend={stats.compare ? {
                        isGrowth: changeRate >= 0,
                        label: toPercentLabel(changeRate)
                    } : null}
                />
                <StatMiniCard 
                    icon={Activity} 
                    label="활성 멤버" 
                    value={formatNumber(stats.summary?.active_members || stats.summary?.activeMembers || 0)} 
                    color="indigo" 
                />
            </div>

            {/* 주요 메뉴 퀵링크 */}
            <section>
                <h2 className="text-xl font-black text-slate-900 mb-6 italic flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary-600" />
                    주요 서비스 바로가기
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    <QuickMenuLink to="/app/boards/FREE_BOARD" icon={MessageSquare} title="자유게시판" color="blue" />
                    <QuickMenuLink to="/app/optimizer" icon={MapPin} title="중간장소" color="rose" />
                    <QuickMenuLink to="/app/ranks" icon={Trophy} title="랭킹" color="amber" />
                    <QuickMenuLink to="/app/plinko" icon={Dices} title="럭키플링코" color="emerald" />
                    <QuickMenuLink to="/app/news" icon={Newspaper} title="뉴스" color="indigo" />
                    <QuickMenuLink to="/app/gpt" icon={Bot} title="GPT 질문" color="teal" />
                </div>
            </section>

            {/* 최근 게시글 섹션 */}
            {recentBoards.length > 0 && (
                <section>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-black text-slate-900 italic flex items-center gap-2">
                            <Activity className="h-5 w-5 text-primary-600" />
                            최신 게시글 피드
                        </h2>
                        <Link to="/app/boards/FREE_BOARD" className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5">
                            전체보기 <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {recentBoards.map((board) => (
                            <Link
                                key={board?.board_id || board?.boardId || Math.random()}
                                to={`/app/boards/${toBoardKind(board)}/${board?.board_id || board?.boardId}`}
                                className="card p-6 hover:shadow-xl transition-all border border-slate-100 group bg-white"
                            >
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                                        {toBoardKind(board).replace("_BOARD", "")}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                        {board?.board_creator || board?.boardCreator || "익명"}
                                    </span>
                                </div>
                                <h3 className="font-bold text-slate-900 mb-2 line-clamp-1 group-hover:text-primary-600 transition-colors">
                                    {board?.title}
                                </h3>
                                <p className="text-sm text-slate-500 mb-4 line-clamp-2 leading-relaxed">
                                    {stripHtmlTags(board?.contents || board?.content || "")}
                                </p>
                                <div className="flex items-center justify-between pt-4 border-t border-slate-50 text-[11px] text-slate-400">
                                    <div className="flex items-center gap-3">
                                        <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {formatNumber(board?.view_count || board?.viewCount || 0)}</span>
                                    </div>
                                    <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-primary-500" />
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
const StatMiniCard = ({ icon: Icon, label, value, color, trend }) => {
    const colors = {
        blue: "bg-blue-50 text-blue-600",
        emerald: "bg-emerald-50 text-emerald-600",
        orange: "bg-orange-50 text-orange-600",
        indigo: "bg-indigo-50 text-indigo-600",
    };

    return (
        <div className="card p-5 bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">{label}</p>
                    <p className="text-2xl font-black text-slate-900 tracking-tighter">{value}</p>
                    {trend && (
                        <div className={`flex items-center gap-1 mt-1 text-[10px] font-black ${trend.isGrowth ? "text-green-600" : "text-red-600"}`}>
                            {trend.isGrowth ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {trend.label}
                        </div>
                    )}
                </div>
                <div className={`p-3 rounded-2xl ${colors[color]}`}>
                    <Icon className="h-5 w-5" />
                </div>
            </div>
        </div>
    );
};

// 퀵 메뉴 링크 컴포넌트
const QuickMenuLink = ({ to, icon: Icon, title, color }) => {
    const colors = {
        blue: "text-blue-600 bg-blue-50 hover:bg-blue-600",
        rose: "text-rose-600 bg-rose-50 hover:bg-rose-600",
        amber: "text-amber-600 bg-amber-50 hover:bg-amber-600",
        emerald: "text-emerald-600 bg-emerald-50 hover:bg-emerald-600",
        indigo: "text-indigo-600 bg-indigo-50 hover:bg-indigo-600",
        teal: "text-teal-600 bg-teal-50 hover:bg-teal-600",
    };

    return (
        <Link to={to} className="flex flex-col items-center gap-2 group">
            <div className={`w-full aspect-square rounded-[2rem] flex items-center justify-center transition-all group-hover:shadow-lg group-hover:-translate-y-1 group-hover:text-white ${colors[color]}`}>
                <Icon className="h-6 w-6" />
            </div>
            <span className="text-xs font-black text-slate-700 italic">{title}</span>
        </Link>
    );
};

export default Home;
