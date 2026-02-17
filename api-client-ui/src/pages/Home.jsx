import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    TrendingUp,
    TrendingDown,
    Users,
    MessageSquare,
    Award,
    ArrowRight,
    Sparkles,
    Activity,
    TreePine,
    UserCheck,
    UserX,
    Eye,
    Calendar,
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
    return [];
};

const normalizeTrend = (response) => {
    const data = unwrapData(response);
    if (!data) return { days: 7, items: [] };
    return {
        days: data.days || 7,
        items: Array.isArray(data.items) ? data.items : [],
    };
};

const toBoardKind = (board) =>
    board?.kind_of_board || board?.kindOfBoard || board?.kind || "FREE_BOARD";

const toChangeRate = (value) => {
    const num = Number(value);
    if (Number.isNaN(num) || !Number.isFinite(num)) return 0;
    return num;
};

const toPercentLabel = (value) => {
    const num = toChangeRate(value);
    const sign = num > 0 ? "+" : "";
    return `${sign}${num.toFixed(2)}%`;
};

const toDateLabel = (value) => {
    if (!value) return "-";
    return String(value).slice(5);
};

export const Home = () => {
    const { user } = useAuth();
    const [summary, setSummary] = useState(null);
    const [visitorsCompare, setVisitorsCompare] = useState(null);
    const [trend, setTrend] = useState({ days: 7, items: [] });
    const [days, setDays] = useState(7);
    const [recentBoards, setRecentBoards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [trendLoading, setTrendLoading] = useState(false);
    const [error, setError] = useState("");

    const fetchTrend = async (selectedDays) => {
        setTrendLoading(true);
        try {
            const trendRes = await api.get("/stats/trend", {
                params: { days: selectedDays },
            });
            setTrend(normalizeTrend(trendRes));
        } catch (trendError) {
            console.error("Failed to fetch stats trend:", trendError);
        } finally {
            setTrendLoading(false);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError("");
            try {
                const [summaryRes, visitorsRes, trendRes, freeRes, ecoRes, greenRes] = await Promise.all([
                    api.get("/stats/summary"),
                    api.get("/stats/visitors/compare"),
                    api.get("/stats/trend", { params: { days: 7 } }),
                    api.get("/boards", { params: { kind: "FREE_BOARD", page: 0, size: 3 } }),
                    api.get("/boards", { params: { kind: "ECO_REVIEW", page: 0, size: 3 } }),
                    api.get("/boards", { params: { kind: "GREEN_ACTIVE", page: 0, size: 3 } }),
                ]);

                const boardItems = [
                    ...normalizeBoards(freeRes),
                    ...normalizeBoards(ecoRes),
                    ...normalizeBoards(greenRes),
                ].sort((a, b) => {
                    const aDate = new Date(a?.created_at || a?.createdAt || 0).getTime();
                    const bDate = new Date(b?.created_at || b?.createdAt || 0).getTime();
                    return bDate - aDate;
                });

                setSummary(unwrapData(summaryRes));
                setVisitorsCompare(unwrapData(visitorsRes));
                setTrend(normalizeTrend(trendRes));
                setRecentBoards(boardItems.slice(0, 6));
            } catch (fetchError) {
                console.error("Failed to fetch home data:", fetchError);
                setError(fetchError?.response?.data?.message || "홈 데이터를 불러오지 못했습니다.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    useEffect(() => {
        if (days === trend.days) return;
        fetchTrend(days);
    }, [days]);

    const changeRate = toChangeRate(visitorsCompare?.day_over_day_change_rate || visitorsCompare?.dayOverDayChangeRate);
    const isGrowth = changeRate >= 0;

    const trendMax = useMemo(() => {
        const maxValue = trend.items.reduce((max, item) => {
            const boardCount = Number(item.new_boards || item.newBoards || 0);
            const commentCount = Number(item.new_comments || item.newComments || 0);
            const visitors = Number(item.visitors || 0);
            return Math.max(max, boardCount, commentCount, visitors);
        }, 0);
        return maxValue <= 0 ? 1 : maxValue;
    }, [trend.items]);

    if (loading) {
        return <LoadingSpinner text="홈 데이터 로딩 중..." />;
    }

    if (error) {
        return <ErrorMessage message={error} />;
    }

    return (
        <div className="space-y-8">
            <div className="card p-8 bg-gradient-to-r from-primary-500 to-primary-600 text-white">
                <div className="flex items-center gap-3 mb-4">
                    <Sparkles className="h-8 w-8" />
                    <h1 className="text-3xl font-bold">
                        환영합니다, {user?.name || user?.email}님!
                    </h1>
                </div>
                <p className="text-primary-100 text-lg">
                    커뮤니티 현황은 통계 API 기반으로 실시간 반영됩니다.
                </p>
            </div>

            {summary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                    <StatCard icon={Users} label="전체 회원" value={formatNumber(summary.total_members || summary.totalMembers || 0)} color="blue" />
                    <StatCard icon={UserCheck} label="활성 회원" value={formatNumber(summary.active_members || summary.activeMembers || 0)} color="green" />
                    <StatCard icon={UserX} label="탈퇴 회원" value={formatNumber(summary.quit_members || summary.quitMembers || 0)} color="rose" />
                    <StatCard icon={MessageSquare} label="전체 게시글" value={formatNumber(summary.total_boards || summary.totalBoards || 0)} color="emerald" />
                    <StatCard icon={Award} label="전체 댓글" value={formatNumber(summary.total_comments || summary.totalComments || 0)} color="purple" />
                    <StatCard icon={Eye} label="오늘 방문자" value={formatNumber(summary.today_visitors || summary.todayVisitors || 0)} color="orange" />
                </div>
            )}

            {visitorsCompare && (
                <div className="card p-6">
                    <div className="flex flex-wrap items-center gap-3 justify-between">
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <Activity className="h-5 w-5 text-primary-600" />
                            방문자 비교
                        </h2>
                        <div
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${
                                isGrowth ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            }`}
                        >
                            {isGrowth ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                            {toPercentLabel(changeRate)}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
                        <MetricTile label="오늘 방문자" value={formatNumber(visitorsCompare.today_visitors || visitorsCompare.todayVisitors || 0)} />
                        <MetricTile label="어제 방문자" value={formatNumber(visitorsCompare.yesterday_visitors || visitorsCompare.yesterdayVisitors || 0)} />
                    </div>
                </div>
            )}

            <div className="card p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary-600" />
                        기간 추이
                    </h2>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">조회 기간</span>
                        <select
                            value={days}
                            onChange={(e) => setDays(Number(e.target.value))}
                            className="input-base"
                            disabled={trendLoading}
                        >
                            <option value={7}>7일</option>
                            <option value={14}>14일</option>
                            <option value={30}>30일</option>
                        </select>
                    </div>
                </div>

                {trendLoading ? (
                    <LoadingSpinner size="sm" text="추이 데이터 로딩 중..." />
                ) : trend.items.length === 0 ? (
                    <div className="text-sm text-slate-500">표시할 추이 데이터가 없습니다.</div>
                ) : (
                    <div className="space-y-3">
                        {trend.items.map((item) => {
                            const visitors = Number(item.visitors || 0);
                            const boards = Number(item.new_boards || item.newBoards || 0);
                            const comments = Number(item.new_comments || item.newComments || 0);
                            return (
                                <div key={item.date} className="rounded-xl border border-slate-200 p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm font-semibold text-slate-700">{toDateLabel(item.date)}</span>
                                        <span className="text-xs text-slate-500">방문자 {formatNumber(visitors)}</span>
                                    </div>
                                    <TrendBar label="방문자" value={visitors} max={trendMax} color="bg-blue-500" />
                                    <TrendBar label="신규 게시글" value={boards} max={trendMax} color="bg-emerald-500" />
                                    <TrendBar label="신규 댓글" value={comments} max={trendMax} color="bg-purple-500" />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div>
                <h2 className="text-xl font-bold text-slate-900 mb-4">
                    바로가기
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <QuickLink to="/app/boards/FREE_BOARD" title="자유게시판" description="자유롭게 이야기를 나눠요" color="blue" />
                    <QuickLink to="/app/boards/ECO_REVIEW" title="Q&A 게시판" description="질문과 답변을 자유롭게 나눠요" color="green" />
                    <QuickLink to="/app/boards/GREEN_ACTIVE" title="녹색활동" description="환경 보호 활동을 기록해요" color="emerald" />
                    <QuickLink to="/app/gpt" title="GPT 질문" description="AI 기반 환경 실천 팁 받기" color="teal" />
                </div>
            </div>

            {recentBoards.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-slate-900">최근 게시글</h2>
                        <Link
                            to="/app/boards/FREE_BOARD"
                            className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
                        >
                            전체보기
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {recentBoards.map((board) => (
                            <Link
                                key={board.board_id || board.boardId}
                                to={`/app/boards/${toBoardKind(board)}/${board.board_id || board.boardId}`}
                                className="card p-5 hover:shadow-lg transition-all"
                            >
                                <h3 className="font-semibold text-slate-900 mb-2 line-clamp-1">
                                    {board.title}
                                </h3>
                                <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                                    {stripHtmlTags(board.contents || board.content || "")}
                                </p>
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                    <span>{board.board_creator || board.boardCreator || "익명"}</span>
                                    <span>조회 {formatNumber(board.view_count || board.viewCount || 0)}</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const TrendBar = ({ label, value, max, color }) => {
    const percent = Math.max(0, Math.min(100, (value / max) * 100));
    return (
        <div className="space-y-1.5 mb-2 last:mb-0">
            <div className="flex items-center justify-between text-xs text-slate-600">
                <span>{label}</span>
                <span>{formatNumber(value)}</span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full ${color}`} style={{ width: `${percent}%` }} />
            </div>
        </div>
    );
};

const MetricTile = ({ label, value }) => (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="text-sm text-slate-600">{label}</div>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
    </div>
);

const StatCard = ({ icon: Icon, label, value, color }) => {
    const colors = {
        blue: "from-blue-500 to-blue-600",
        green: "from-green-500 to-green-600",
        rose: "from-rose-500 to-rose-600",
        emerald: "from-emerald-500 to-emerald-600",
        purple: "from-purple-500 to-purple-600",
        orange: "from-orange-500 to-orange-600",
    };

    return (
        <div className="card p-5">
            <div className="flex items-center gap-4">
                <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${colors[color]} text-white flex items-center justify-center`}>
                    <Icon className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-sm text-slate-600">{label}</p>
                    <p className="text-2xl font-bold text-slate-900">{value}</p>
                </div>
            </div>
        </div>
    );
};

const QuickLink = ({ to, title, description, color }) => {
    const colors = {
        blue: "from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700",
        green: "from-green-500 to-green-600 hover:from-green-600 hover:to-green-700",
        emerald: "from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700",
        teal: "from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700",
    };

    return (
        <Link
            to={to}
            className={`card p-6 bg-gradient-to-br ${colors[color]} text-white hover:shadow-lg transition-all group`}
        >
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold">{title}</h3>
                {title === "녹색활동" && <TreePine className="h-5 w-5 text-white/90" />}
            </div>
            <p className="text-sm text-white/90 mb-4">{description}</p>
            <div className="flex items-center gap-2 text-sm font-medium">
                바로가기
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </div>
        </Link>
    );
};
