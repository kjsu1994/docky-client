import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    User,
    Mail,
    Phone,
    Award,
    TrendingUp,
    MessageSquare,
    Heart,
    Edit,
    Calendar,
    BarChart3,
    TreePine
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import api from "../utils/api";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";
import { formatNumber, formatRelativeTime } from "../utils/helpers";

export const Mypage = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [memberData, setMemberData] = useState(null);
    const [myBoards, setMyBoards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [boardsLoading, setBoardsLoading] = useState(false);
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState("profile"); // profile, posts, stats

    const handleDeleteAccount = async () => {
        const confirmed = window.confirm("정말 회원 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.");
        if (!confirmed) return;

        try {
            await api.delete("/members");
            await logout({ skipApi: true, silent: true });
        } catch (err) {
            console.error("Failed to delete member:", err);
            setError(err.response?.data?.message || "회원 탈퇴에 실패했습니다.");
        }
    };

    // 회원 정보 불러오기
    useEffect(() => {
        const fetchMemberData = async () => {
            setLoading(true);
            setError("");
            try {
                const response = await api.get("/members");
                const data = response.data?.data || response.data;
                setMemberData(data);
            } catch (err) {
                console.error("Failed to fetch member data:", err);
                setError("회원 정보를 불러오는데 실패했습니다.");
            } finally {
                setLoading(false);
            }
        };

        fetchMemberData();
    }, []);

    // 내가 작성한 게시글 불러오기
    useEffect(() => {
        if (activeTab !== "posts") return;

        const fetchMyBoards = async () => {
            setBoardsLoading(true);
            try {
                const response = await api.get("/boards/myBoards", {
                    params: { page: 1, size: 10 }
                });
                const boards = response.data?.data?.content || response.data?.content || [];
                setMyBoards(boards);
            } catch (err) {
                console.error("Failed to fetch my boards:", err);
            } finally {
                setBoardsLoading(false);
            }
        };

        fetchMyBoards();
    }, [activeTab]);

    if (loading) {
        return <LoadingSpinner text="회원 정보 로딩 중..." />;
    }

    if (error) {
        return <ErrorMessage message={error} />;
    }

    if (!memberData) {
        return (
            <div className="card p-12 text-center">
                <p className="text-slate-600">회원 정보를 찾을 수 없습니다.</p>
            </div>
        );
    }

    const levelData = memberData.level_dto || memberData.levelDto || {};

    return (
        <div className="space-y-6">
            {/* 프로필 헤더 */}
            <div className="card overflow-hidden">
                {/* 배경 그라데이션 */}
                <div className="h-32 bg-gradient-to-r from-purple-500 to-purple-600" />

                <div className="px-6 pb-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-16">
                        {/* 프로필 이미지 */}
                        <div className="flex-shrink-0">
                            {memberData.profile_url || memberData.profileUrl ? (
                                <img
                                    src={memberData.profile_url || memberData.profileUrl}
                                    alt={memberData.name}
                                    className="w-32 h-32 rounded-2xl border-4 border-white shadow-xl object-cover"
                                />
                            ) : (
                                <div className="w-32 h-32 rounded-2xl border-4 border-white shadow-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                                    <span className="text-5xl font-bold text-white">
                                        {memberData.name?.charAt(0).toUpperCase() || "U"}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* 프로필 정보 */}
                        <div className="flex-1 pt-4">
                            <div className="flex flex-wrap items-center gap-3 mb-2">
                                <h1 className="text-2xl font-bold text-slate-900">
                                    {memberData.name || "익명"}
                                </h1>
                                <div className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm font-semibold">
                                    Lv. {levelData.level || 1}
                                </div>
                                {memberData.member_status === "ACTIVE" && (
                                    <div className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-semibold">
                                        활성
                                    </div>
                                )}
                            </div>
                            <div className="text-sm text-slate-600 space-y-1">
                                <div className="flex items-center gap-2">
                                    <Mail className="h-4 w-4" />
                                    <span>{memberData.email}</span>
                                </div>
                                {memberData.phone && (
                                    <div className="flex items-center gap-2">
                                        <Phone className="h-4 w-4" />
                                        <span>{memberData.phone}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 수정 버튼 */}
                        <button
                            onClick={() => navigate("/app/mypage/edit")}
                            className="btn-secondary flex items-center gap-2"
                        >
                            <Edit className="h-4 w-4" />
                            프로필 수정
                        </button>
                    </div>

                    {/* 통계 카드 */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                        <StatCard
                            icon={Award}
                            label="총 경험치"
                            value={formatNumber(levelData.total_exp || levelData.totalExp || 0)}
                            color="purple"
                        />
                        <StatCard
                            icon={TrendingUp}
                            label="포인트"
                            value={formatNumber(memberData.point || 0)}
                            color="blue"
                        />
                        <StatCard
                            icon={TreePine}
                            label="나무"
                            value={`${formatNumber(memberData.tree_count || memberData.treeCount || 0)}그루`}
                            color="green"
                        />
                        <StatCard
                            icon={MessageSquare}
                            label="작성 게시글"
                            value={formatNumber(memberData.board_count || memberData.boardCount || 0)}
                            color="orange"
                        />
                    </div>
                </div>
            </div>

            {/* 탭 메뉴 */}
            <div className="card p-2">
                <div className="flex gap-2">
                    <TabButton
                        active={activeTab === "profile"}
                        onClick={() => setActiveTab("profile")}
                    >
                        프로필 정보
                    </TabButton>
                    <TabButton
                        active={activeTab === "posts"}
                        onClick={() => setActiveTab("posts")}
                    >
                        작성한 글
                    </TabButton>
                    <TabButton
                        active={activeTab === "stats"}
                        onClick={() => setActiveTab("stats")}
                    >
                        활동 통계
                    </TabButton>
                </div>
            </div>

            {/* 탭 컨텐츠 */}
            {activeTab === "profile" && (
                <ProfileTab
                    memberData={memberData}
                    levelData={levelData}
                    onDeleteAccount={handleDeleteAccount}
                />
            )}
            {activeTab === "posts" && (
                <PostsTab boards={myBoards} loading={boardsLoading} navigate={navigate} />
            )}
            {activeTab === "stats" && (
                <StatsTab memberData={memberData} levelData={levelData} />
            )}
        </div>
    );
};

// 통계 카드
const StatCard = ({ icon: Icon, label, value, color }) => {
    const colorClasses = {
        purple: "from-purple-500 to-purple-600",
        blue: "from-blue-500 to-blue-600",
        green: "from-green-500 to-green-600",
        orange: "from-orange-500 to-orange-600"
    };

    return (
        <div className="card p-4">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center mb-3`}>
                <Icon className="h-5 w-5 text-white" />
            </div>
            <div className="text-xs text-slate-600 mb-1">{label}</div>
            <div className="text-xl font-bold text-slate-900">{value}</div>
        </div>
    );
};

// 탭 버튼
const TabButton = ({ active, onClick, children }) => (
    <button
        onClick={onClick}
        className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all ${
            active
                ? "bg-purple-600 text-white shadow-lg"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
        }`}
    >
        {children}
    </button>
);

// 프로필 탭
const ProfileTab = ({ memberData, levelData, onDeleteAccount }) => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 기본 정보 */}
            <div className="card p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <User className="h-5 w-5 text-purple-600" />
                    기본 정보
                </h3>
                <div className="space-y-3">
                    <InfoRow label="이름" value={memberData.name || "-"} />
                    <InfoRow label="이메일" value={memberData.email || "-"} />
                    <InfoRow label="전화번호" value={memberData.phone || "-"} />
                    <InfoRow
                        label="회원 상태"
                        value={memberData.member_status === "ACTIVE" ? "활성" : "비활성"}
                    />
                </div>
            </div>

            {/* 레벨 정보 */}
            <div className="card p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Award className="h-5 w-5 text-purple-600" />
                    레벨 정보
                </h3>
                <div className="space-y-4">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-slate-700">현재 레벨</span>
                            <span className="text-2xl font-bold text-purple-600">
                                Lv. {levelData.level || 1}
                            </span>
                        </div>
                        <div className="text-sm text-slate-600">
                            총 경험치: <span className="font-semibold">{formatNumber(levelData.total_exp || levelData.totalExp || 0)}</span>
                        </div>
                    </div>

                    {/* 경험치 바 */}
                    <div>
                        <div className="flex items-center justify-between mb-2 text-sm">
                            <span className="text-slate-600">다음 레벨까지</span>
                            <span className="font-semibold text-purple-600">
                                {levelData.current_exp || levelData.currentExp || 0} / {levelData.next_level_exp || levelData.nextLevelExp || 100}
                            </span>
                        </div>
                        <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all"
                                style={{
                                    width: `${((levelData.current_exp || levelData.currentExp || 0) / (levelData.next_level_exp || levelData.nextLevelExp || 100)) * 100}%`
                                }}
                            />
                        </div>
                    </div>

                    <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg">
                        게시글 작성, 댓글, 좋아요 등의 활동으로 경험치를 얻을 수 있습니다.
                    </div>
                </div>
            </div>

            {/* 환경 활동 */}
            <div className="card p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <TreePine className="h-5 w-5 text-green-600" />
                    환경 활동
                </h3>
                <div className="space-y-3">
                    <InfoRow
                        label="포인트"
                        value={`${formatNumber(memberData.point || 0)}P`}
                    />
                    <InfoRow
                        label="기부한 나무"
                        value={`${formatNumber(memberData.tree_count || memberData.treeCount || 0)}그루`}
                    />
                    <InfoRow
                        label="작성 게시글"
                        value={`${formatNumber(memberData.board_count || memberData.boardCount || 0)}개`}
                    />
                </div>
            </div>

            {/* 계정 관리 */}
            <div className="card p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">계정 관리</h3>
                <div className="space-y-3">
                    <button className="w-full btn-secondary text-left">
                        비밀번호 변경
                    </button>
                    <button
                        onClick={onDeleteAccount}
                        className="w-full px-4 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors text-left font-semibold"
                    >
                        회원 탈퇴
                    </button>
                </div>
            </div>
        </div>
    );
};

// 작성한 글 탭
const PostsTab = ({ boards, loading, navigate }) => {
    if (loading) {
        return <LoadingSpinner text="게시글 로딩 중..." />;
    }

    if (boards.length === 0) {
        return (
            <div className="card p-12 text-center">
                <MessageSquare className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    작성한 게시글이 없습니다
                </h3>
                <p className="text-slate-600 mb-4">
                    첫 번째 게시글을 작성해보세요!
                </p>
                <button
                    onClick={() => navigate("/app/boards/FREE_BOARD")}
                    className="btn-primary"
                >
                    게시글 작성하기
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {boards.map((board) => (
                <div
                    key={board.board_id || board.boardId}
                    className="card p-6 hover:shadow-lg transition-all cursor-pointer"
                    onClick={() =>
                        navigate(
                            `/app/boards/${board.kind_of_board || board.kindOfBoard || "FREE_BOARD"}/${board.board_id || board.boardId}`
                        )
                    }
                >
                    <h3 className="font-bold text-slate-900 text-lg mb-2 line-clamp-1">
                        {board.title}
                    </h3>
                    <p className="text-slate-600 text-sm mb-3 line-clamp-2">
                        {board.contents}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                        <div className="flex items-center gap-1">
                            <Heart className="h-4 w-4" />
                            <span>{formatNumber(board.like_count || board.likeCount || 0)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <TrendingUp className="h-4 w-4" />
                            <span>{formatNumber(board.view_count || board.viewCount || 0)}</span>
                        </div>
                        <div className="flex items-center gap-1 ml-auto">
                            <Calendar className="h-4 w-4" />
                            <span>{formatRelativeTime(new Date(board.created_at || board.createdAt))}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

// 활동 통계 탭
const StatsTab = ({ memberData, levelData }) => {
    return (
        <div className="space-y-6">
            <div className="card p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-purple-600" />
                    활동 통계
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <StatsCard
                        label="레벨"
                        value={levelData.level || 1}
                        color="purple"
                        icon={Award}
                    />
                    <StatsCard
                        label="총 경험치"
                        value={formatNumber(levelData.total_exp || levelData.totalExp || 0)}
                        color="blue"
                        icon={TrendingUp}
                    />
                    <StatsCard
                        label="포인트"
                        value={formatNumber(memberData.point || 0)}
                        color="green"
                        icon={TrendingUp}
                    />
                    <StatsCard
                        label="작성 게시글"
                        value={formatNumber(memberData.board_count || memberData.boardCount || 0)}
                        color="orange"
                        icon={MessageSquare}
                    />
                    <StatsCard
                        label="기부 나무"
                        value={`${formatNumber(memberData.tree_count || memberData.treeCount || 0)}그루`}
                        color="green"
                        icon={TreePine}
                    />
                </div>
            </div>

            {/* 레벨 진행도 */}
            <div className="card p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">레벨 진행도</h3>
                <div className="space-y-4">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-slate-900">
                                Lv. {levelData.level || 1} → Lv. {(levelData.level || 1) + 1}
                            </span>
                            <span className="text-sm text-slate-600">
                                {levelData.current_exp || levelData.currentExp || 0} / {levelData.next_level_exp || levelData.nextLevelExp || 100}
                            </span>
                        </div>
                        <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all"
                                style={{
                                    width: `${((levelData.current_exp || levelData.currentExp || 0) / (levelData.next_level_exp || levelData.nextLevelExp || 100)) * 100}%`
                                }}
                            />
                        </div>
                        <p className="text-sm text-slate-500 mt-2">
                            다음 레벨까지 {(levelData.next_level_exp || levelData.nextLevelExp || 100) - (levelData.current_exp || levelData.currentExp || 0)} 경험치 필요
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// 정보 행
const InfoRow = ({ label, value }) => (
    <div className="flex items-center justify-between py-2 border-b border-slate-200 last:border-0">
        <span className="text-sm text-slate-600">{label}</span>
        <span className="font-semibold text-slate-900">{value}</span>
    </div>
);

// 통계 카드
const StatsCard = ({ label, value, color, icon: Icon }) => {
    const colorClasses = {
        purple: "from-purple-500 to-purple-600",
        blue: "from-blue-500 to-blue-600",
        green: "from-green-500 to-green-600",
        orange: "from-orange-500 to-orange-600"
    };

    return (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center`}>
                    <Icon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                    <div className="text-xs text-slate-600">{label}</div>
                    <div className="text-xl font-bold text-slate-900">{value}</div>
                </div>
            </div>
        </div>
    );
};
