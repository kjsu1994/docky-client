import { useEffect, useMemo, useState } from "react";
import {
    TrendingUp,
    TrendingDown,
    Users,
    MessageSquare,
    Award,
    Activity,
    UserCheck,
    UserX,
    Eye,
    Calendar,
} from "lucide-react";
import api from "../../utils/api.js";
import { formatNumber } from "../../utils/helpers.js";
import { LoadingSpinner } from "../../components/LoadingSpinner.jsx";
import { ErrorMessage } from "../../components/ErrorMessage.jsx";

// API 응답에서 실제 데이터를 추출하는 헬퍼 함수
const unwrapData = (response) => response?.data?.data ?? response?.data ?? null;

// 기간별 추이 데이터 정규화 함수
const normalizeTrend = (response) => {
    const data = unwrapData(response);
    if (!data) return { days: 7, items: [] };
    return {
        days: data.days || 7,
        items: Array.isArray(data.items) ? data.items : [],
    };
};

// 증감률을 숫자형으로 변환하는 함수
const toChangeRate = (value) => {
    const num = Number(value);
    if (Number.isNaN(num) || !Number.isFinite(num)) return 0;
    return num;
};

// 백분율 라벨을 생성하는 함수 (예: +10.00%)
const toPercentLabel = (value) => {
    const num = toChangeRate(value);
    const sign = num > 0 ? "+" : "";
    return `${sign}${num.toFixed(2)}%`;
};

// 날짜 문자열을 'MM-DD' 형식으로 변환하는 함수
const toDateLabel = (value) => {
    if (!value) return "-";
    return String(value).slice(5);
};

// 통계 페이지 컴포넌트
export const Statistics = () => {
    const [summary, setSummary] = useState(null);
    const [visitorsCompare, setVisitorsCompare] = useState(null);
    const [trend, setTrend] = useState({ days: 7, items: [] });
    const [days, setDays] = useState(7);
    const [loading, setLoading] = useState(true);
    const [trendLoading, setTrendLoading] = useState(false);
    const [error, setError] = useState("");

    // 기간별 추이 데이터를 비동기적으로 가져오는 함수
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

    // 컴포넌트 마운트 시 통계 데이터를 가져오는 효과
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError("");
            try {
                const [summaryRes, visitorsRes, trendRes] = await Promise.all([
                    api.get("/stats/summary"),
                    api.get("/stats/visitors/compare"),
                    api.get("/stats/trend", { params: { days: 7 } }),
                ]);

                setSummary(unwrapData(summaryRes));
                setVisitorsCompare(unwrapData(visitorsRes));
                setTrend(normalizeTrend(trendRes));
            } catch (fetchError) {
                console.error("Failed to fetch statistics data:", fetchError);
                setError(fetchError?.response?.data?.message || "통계 데이터를 불러오지 못했습니다.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // 'days' 상태가 변경될 때마다 새로운 추이 데이터를 가져오는 효과
    useEffect(() => {
        if (days === trend.days) return;
        fetchTrend(days);
    }, [days]);

    const changeRate = toChangeRate(visitorsCompare?.day_over_day_change_rate || visitorsCompare?.dayOverDayChangeRate);
    const isGrowth = changeRate >= 0;

    // 추이 데이터의 최대값을 계산 (차트 렌더링에 사용)
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
        return <LoadingSpinner text="통계 데이터 로딩 중..." />;
    }

    if (error) {
        return <ErrorMessage message={error} />;
    }

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-slate-900">커뮤니티 통계</h1>

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
        </div>
    );
};

// 추이 데이터 막대그래프 컴포넌트
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

// 단일 메트릭 타일 컴포넌트
const MetricTile = ({ label, value }) => (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="text-sm text-slate-600">{label}</div>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
    </div>
);

// 단일 통계 카드 컴포넌트
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

export default Statistics;
