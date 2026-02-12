import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    TrendingUp,
    Users,
    MessageSquare,
    Award,
    ArrowRight,
    Sparkles
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import api from "../utils/api";
import { formatNumber } from "../utils/helpers";
import { LoadingSpinner } from "../components/LoadingSpinner";

export const Home = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [recentBoards, setRecentBoards] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 최근 게시글 가져오기 (각 카테고리별)
                const [freeRes, ecoRes, greenRes] = await Promise.all([
                    api.get("/boards", { params: { kind: "FREE_BOARD", page: 1, size: 3 } }),
                    api.get("/boards", { params: { kind: "ECO_REVIEW", page: 1, size: 3 } }),
                    api.get("/boards", { params: { kind: "GREEN_ACTIVE", page: 1, size: 3 } }),
                ]);

                const allBoards = [
                    ...(freeRes.data.data?.content || []),
                    ...(ecoRes.data.data?.content || []),
                    ...(greenRes.data.data?.content || []),
                ].slice(0, 6);

                setRecentBoards(allBoards);

                // 통계 데이터 (실제 API가 있다면 대체)
                setStats({
                    totalMembers: 1234,
                    totalPosts: 5678,
                    totalComments: 12345,
                    todayVisitors: 234,
                });
            } catch (error) {
                console.error("Failed to fetch data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return <LoadingSpinner text="데이터 로딩 중..." />;
    }

    return (
        <div className="space-y-8">
            {/* 웰컴 배너 */}
            <div className="card p-8 bg-gradient-to-r from-primary-500 to-primary-600 text-white">
                <div className="flex items-center gap-3 mb-4">
                    <Sparkles className="h-8 w-8" />
                    <h1 className="text-3xl font-bold">
                        환영합니다, {user?.name || user?.email}님!
                    </h1>
                </div>
                <p className="text-primary-100 text-lg">
                    벌꿀오소리 커뮤니티에서 일상을 공유하고 소통하세요.
                </p>
            </div>

            {/* 통계 카드 */}
            {stats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard
                        icon={Users}
                        label="전체 회원"
                        value={formatNumber(stats.totalMembers)}
                        color="blue"
                    />
                    <StatCard
                        icon={MessageSquare}
                        label="전체 게시글"
                        value={formatNumber(stats.totalPosts)}
                        color="green"
                    />
                    <StatCard
                        icon={Award}
                        label="전체 댓글"
                        value={formatNumber(stats.totalComments)}
                        color="purple"
                    />
                    <StatCard
                        icon={TrendingUp}
                        label="오늘 방문자"
                        value={formatNumber(stats.todayVisitors)}
                        color="orange"
                    />
                </div>
            )}

            {/* 빠른 링크 */}
            <div>
                <h2 className="text-xl font-bold text-slate-900 mb-4">
                    바로가기
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <QuickLink
                        to="/app/boards/FREE_BOARD"
                        title="자유게시판"
                        description="자유롭게 이야기를 나눠요"
                        color="blue"
                    />
                    <QuickLink
                        to="/app/boards/ECO_REVIEW"
                        title="친환경 리뷰"
                        description="친환경 제품 후기를 공유해요"
                        color="green"
                    />
                    <QuickLink
                        to="/app/boards/GREEN_ACTIVE"
                        title="녹색활동"
                        description="환경 보호 활동을 기록해요"
                        color="emerald"
                    />
                </div>
            </div>

            {/* 최근 게시글 */}
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
                                to={`/app/boards/${board.board_kind || board.boardKind}/${
                                    board.board_id || board.boardId
                                }`}
                                className="card p-5 hover:shadow-lg transition-all"
                            >
                                <h3 className="font-semibold text-slate-900 mb-2 line-clamp-1">
                                    {board.title}
                                </h3>
                                <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                                    {board.contents || board.content || ""}
                                </p>
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                    <span>{board.board_creator || board.boardCreator}</span>
                                    <span>
                    조회 {board.view_count || board.viewCount || 0}
                  </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const StatCard = ({ icon: Icon, label, value, color }) => {
    const colors = {
        blue: "from-blue-500 to-blue-600",
        green: "from-green-500 to-green-600",
        purple: "from-purple-500 to-purple-600",
        orange: "from-orange-500 to-orange-600",
    };

    return (
        <div className="card p-6">
            <div className="flex items-center gap-4">
                <div
                    className={`h-12 w-12 rounded-xl bg-gradient-to-br ${colors[color]} text-white flex items-center justify-center`}
                >
                    <Icon className="h-6 w-6" />
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
    };

    return (
        <Link
            to={to}
            className={`card p-6 bg-gradient-to-br ${colors[color]} text-white hover:shadow-lg transition-all group`}
        >
            <h3 className="text-lg font-bold mb-2">{title}</h3>
            <p className="text-sm text-white/90 mb-4">{description}</p>
            <div className="flex items-center gap-2 text-sm font-medium">
                바로가기
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </div>
        </Link>
    );
};