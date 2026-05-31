import { useEffect, useMemo, useState } from "react";
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
    TreePine,
} from "lucide-react";
import axios from "axios";
import { useAuth } from "../../contexts/AuthContext.jsx";
import toast from "react-hot-toast";
import api from "../../utils/api.js";
import { LoadingSpinner } from "../../components/LoadingSpinner.jsx";
import { ErrorMessage } from "../../components/ErrorMessage.jsx";
import { formatNumber, formatRelativeTime, stripHtmlTags } from "../../utils/helpers.js";
import { normalizeProfileImageUrl } from "../../utils/profileImage.js";

const unwrapData = (response) => response?.data?.data ?? response?.data ?? null;

const normalizeBoardKind = (board) =>
    board?.kind_of_board || board?.kindOfBoard || board?.kind || "FREE_BOARD";

const normalizeMyBoards = (response) => {
    const data = unwrapData(response);
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.content)) return data.content;
    if (Array.isArray(data.boards)) return data.boards;
    return [];
};

const normalizeLevelHistory = (response) => {
    const data = unwrapData(response);
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.content)) return data.content;
    return [];
};

const getRawMemberStatus = (member) => member?.member_status || member?.memberStatus || "MEMBER_ACTIVE";
const normalizeMemberStatus = (member) => String(getRawMemberStatus(member)).toUpperCase();
const isActiveMember = (member) => {
    const status = normalizeMemberStatus(member);
    return status === "ACTIVE" || status === "MEMBER_ACTIVE";
};
const getMemberStatusLabel = (member) => (isActiveMember(member) ? "ACTIVE" : "INACTIVE");
const getAuthProvider = (member) => String(member?.auth_provider || member?.authProvider || "LOCAL").toUpperCase();
const isGoogleAuthMember = (member) => getAuthProvider(member) === "GOOGLE";

const toSafeNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

const pickNumber = (source, keys) => {
    for (const key of keys) {
        const value = toSafeNumber(source?.[key]);
        if (value !== null) return value;
    }
    return null;
};

const resolveLevelProgressInfo = (levelData) => {
    // 백엔드 DTO 필드명이 환경별로 다를 수 있어 후보 키를 순차적으로 확인한다.
    const current = pickNumber(levelData, [
        "current_exp",
        "currentExp",
        "exp",
        "level_exp",
        "levelExp",
        "now_exp",
        "nowExp",
    ]);
    let next = pickNumber(levelData, [
        "next_level_exp",
        "nextLevelExp",
        "next_exp",
        "nextExp",
        "required_exp",
        "requiredExp",
        "target_exp",
        "targetExp",
        "max_exp",
        "maxExp",
    ]);
    const remaining = pickNumber(levelData, [
        "remaining_exp",
        "remainingExp",
        "need_exp",
        "needExp",
        "to_next_exp",
        "toNextExp",
    ]);
    const progressRaw = pickNumber(levelData, [
        "progress",
        "progress_rate",
        "progressRate",
        "progress_percent",
        "progressPercent",
        "exp_progress",
        "expProgress",
    ]);

    const safeCurrent = Math.max(0, current ?? 0);
    if ((next === null || next <= 0) && remaining !== null) {
        next = safeCurrent + Math.max(0, remaining);
    }
    if (next !== null && next > 0 && safeCurrent > next) {
        // 일부 응답은 next 값을 남은 경험치로 내려줄 수 있어 현재값보다 작으면 보정한다.
        next = safeCurrent + next;
    }

    const safeNext = Math.max(1, Math.round((next ?? safeCurrent) || 1));
    const neededExp = Math.max(safeNext - safeCurrent, 0);

    let progress = 0;
    if (progressRaw !== null) {
        progress = progressRaw <= 1 ? progressRaw * 100 : progressRaw;
    } else if (safeNext > 0) {
        progress = (safeCurrent / safeNext) * 100;
    }
    if (neededExp === 0 && safeCurrent > 0) {
        progress = 100;
    }

    return {
        currentExp: Math.round(safeCurrent),
        nextExp: safeNext,
        neededExp: Math.round(neededExp),
        progress: Math.max(0, Math.min(100, progress)),
    };
};

const toDisplayDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return formatRelativeTime(date);
};

export const Mypage = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [memberData, setMemberData] = useState(null);
    const [myBoards, setMyBoards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [boardsLoading, setBoardsLoading] = useState(false);
    const [levelHistoryLoading, setLevelHistoryLoading] = useState(false);
    const [levelHistory, setLevelHistory] = useState([]);
    const [deletingAccount, setDeletingAccount] = useState(false);
    const [deletePassword, setDeletePassword] = useState("");
    const [deletePasswordChecking, setDeletePasswordChecking] = useState(false);
    const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
    const [oauthWithdrawVerified, setOauthWithdrawVerified] = useState(false);
    const [oauthReauthLoading, setOauthReauthLoading] = useState(false);
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState("profile");

    const levelData = useMemo(
        () => memberData?.level_dto || memberData?.levelDto || {},
        [memberData]
    );
    const profileImageUrl = normalizeProfileImageUrl(memberData?.profile_url || memberData?.profileUrl || "");
    const memberActive = isActiveMember(memberData);
    const googleAuthMember = isGoogleAuthMember(memberData);

    const fetchMemberData = async () => {
        setLoading(true);
        setError("");
        try {
            const response = await api.get("/members");
            const data = unwrapData(response);
            setMemberData(data || null);
        } catch (err) {
            console.error("Failed to fetch member data:", err);
            setError(err.response?.data?.message || "회원 정보를 불러오는데 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const openDeleteConfirmModal = () => {
        if (deletingAccount || deletePasswordChecking || oauthReauthLoading) return;
        setDeletePassword("");
        setShowDeleteConfirmModal(true);
    };

    const closeDeleteConfirmModal = () => {
        if (deletingAccount || deletePasswordChecking || oauthReauthLoading) return;
        setShowDeleteConfirmModal(false);
        setDeletePassword("");
    };

    const startGoogleWithdrawReauth = () => {
        if (oauthReauthLoading || deletingAccount) return;
        setOauthReauthLoading(true);
        setOauthWithdrawVerified(false);
        localStorage.setItem("postOauthRedirect", "/app/mypage?withdraw_reauth=1");
        window.location.href = "/api/oauth2/authorization/google?prompt=select_account";
    };

    const handleDeleteAccount = async () => {
        if (deletingAccount || deletePasswordChecking || oauthReauthLoading) return;

        if (googleAuthMember) {
            if (!oauthWithdrawVerified) {
                toast.error("구글 계정은 재인증이 필요합니다. 먼저 진행해주세요.");
                return;
            }
        } else {
            const email = memberData?.email || user?.email || "";
            const password = deletePassword;

            if (!email) {
                toast.error("이메일 정보를 찾을 수 없습니다.");
                return;
            }
            if (!password.trim()) {
                toast.error("비밀번호를 입력해주세요.");
                return;
            }

            try {
                setDeletePasswordChecking(true);
                await axios.post("/api/members/login", {
                    email,
                    password,
                });
            } catch (err) {
                toast.error(err?.response?.data?.message || "비밀번호가 일치하지 않습니다.");
                return;
            } finally {
                setDeletePasswordChecking(false);
            }
        }

        try {
            setDeletingAccount(true);
            await api.delete("/members");
            toast.success("회원 탈퇴 처리되었습니다.");
            setShowDeleteConfirmModal(false);
            setDeletePassword("");
            setOauthWithdrawVerified(false);
            await logout({ skipApi: true, silent: true });
        } catch (err) {
            console.error("Failed to delete member:", err);
            const code = err?.response?.data?.code;
            if (code === "ACCOUNT_REAUTH_REQUIRED") {
                setOauthWithdrawVerified(false);
                toast.error("구글 재인증이 만료되어 탈퇴를 진행할 수 없습니다.");
                return;
            }
            setError(err.response?.data?.message || "회원 탈퇴에 실패했습니다.");
            toast.error(err.response?.data?.message || "회원 탈퇴에 실패했습니다.");
        } finally {
            setDeletingAccount(false);
        }
    };

    useEffect(() => {
        fetchMemberData();
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const shouldVerify = params.get("withdraw_reauth") === "1";
        if (!shouldVerify) return;

        const verify = async () => {
            try {
                await api.post("/members/withdraw/reauth");
                setOauthWithdrawVerified(true);
                toast.success("구글 재인증 확인이 완료되었습니다. 이제 탈퇴를 진행할 수 있습니다.");
            } catch (err) {
                setOauthWithdrawVerified(false);
                toast.error(err?.response?.data?.message || "구글 재인증에 실패했습니다.");
            } finally {
                params.delete("withdraw_reauth");
                const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
                window.history.replaceState({}, document.title, next);
                setOauthReauthLoading(false);
            }
        };

        verify();
    }, []);

    useEffect(() => {
        if (activeTab !== "posts") return;

        const fetchMyBoards = async () => {
            setBoardsLoading(true);
            try {
                const response = await api.get("/boards/myBoards", {
                    params: { page: 0, size: 10 },
                });
                setMyBoards(normalizeMyBoards(response));
            } catch (err) {
                console.error("Failed to fetch my boards:", err);
                setMyBoards([]);
            } finally {
                setBoardsLoading(false);
            }
        };

        fetchMyBoards();
    }, [activeTab]);

    useEffect(() => {
        if (activeTab !== "stats") return;

        const fetchLevelHistory = async () => {
            setLevelHistoryLoading(true);
            try {
                const response = await api.get("/members/level/history", {
                    params: { page: 1, size: 12 },
                });
                setLevelHistory(normalizeLevelHistory(response));
            } catch (err) {
                console.error("Failed to fetch level history:", err);
                setLevelHistory([]);
            } finally {
                setLevelHistoryLoading(false);
            }
        };

        fetchLevelHistory();
    }, [activeTab]);

    if (loading) {
        return <LoadingSpinner text="회원 정보 로딩 중.." />;
    }

    if (error) {
        return <ErrorMessage message={error} onRetry={fetchMemberData} />;
    }

    if (!memberData) {
        return (
            <div className="card p-12 text-center">
                <p className="text-slate-600">회원 정보를 찾을 수 없습니다.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="card overflow-hidden">
                <div className="h-32 bg-gradient-to-r from-purple-500 to-purple-600" />

                <div className="px-6 pb-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-16">
                        <div className="flex-shrink-0">
                            {profileImageUrl ? (
                                <img
                                    src={profileImageUrl}
                                    alt={memberData.name || "profile"}
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

                        <div className="flex-1 pt-4">
                            <div className="flex flex-wrap items-center gap-3 mb-2">
                                <h1 className="text-2xl font-bold text-slate-900">
                                    {memberData.name || user?.name || "Anonymous"}
                                </h1>
                                <div className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm font-semibold">
                                    Lv. {levelData.level || 1}
                                </div>
                                {memberActive && (
                                    <div className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-semibold">
                                        활성
                                    </div>
                                )}
                            </div>
                            <div className="text-sm text-slate-600 space-y-1">
                                <div className="flex items-center gap-2">
                                    <Mail className="h-4 w-4" />
                                    <span>{memberData.email || user?.email || "-"}</span>
                                </div>
                                {memberData.phone && (
                                    <div className="flex items-center gap-2">
                                        <Phone className="h-4 w-4" />
                                        <span>{memberData.phone}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={() => navigate("/app/mypage/edit")}
                            className="btn-secondary flex items-center gap-2"
                        >
                            <Edit className="h-4 w-4" />
                            프로필 수정
                        </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                        <StatCard
                            icon={Award}
                            label="Total EXP"
                            value={formatNumber(levelData.total_exp || levelData.totalExp || 0)}
                            color="purple"
                        />
                        <StatCard
                            icon={TrendingUp}
                            label="Points"
                            value={formatNumber(memberData.point || 0)}
                            color="blue"
                        />
                        <StatCard
                            icon={TreePine}
                            label="Trees"
                            value={`${formatNumber(memberData.tree_count || memberData.treeCount || 0)} trees`}
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

            <div className="card p-2">
                <div className="flex gap-2">
                    <TabButton active={activeTab === "profile"} onClick={() => setActiveTab("profile")}>
                        프로필 정보                    </TabButton>
                    <TabButton active={activeTab === "posts"} onClick={() => setActiveTab("posts")}>
                        작성한 글
                    </TabButton>
                    <TabButton active={activeTab === "stats"} onClick={() => setActiveTab("stats")}>
                        활동 통계                    </TabButton>
                </div>
            </div>

            {activeTab === "profile" && (
                <ProfileTab
                    memberData={memberData}
                    levelData={levelData}
                    levelHistory={levelHistory}
                    levelHistoryLoading={levelHistoryLoading}
                    onDeleteAccount={openDeleteConfirmModal}
                    deletingAccount={deletingAccount}
                />
            )}
            {activeTab === "posts" && (
                <PostsTab boards={myBoards} loading={boardsLoading} navigate={navigate} />
            )}
            {activeTab === "stats" && (
                <StatsTab
                    memberData={memberData}
                    levelData={levelData}
                    levelHistory={levelHistory}
                    levelHistoryLoading={levelHistoryLoading}
                />
            )}

            {showDeleteConfirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <button
                        type="button"
                        className="absolute inset-0 bg-slate-900/55"
                        onClick={closeDeleteConfirmModal}
                        aria-label="닫기"
                    />
                    <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                        <h3 className="text-lg font-bold text-slate-900">회원 탈퇴 확인</h3>
                        <p className="mt-2 text-sm text-slate-600">
                            {googleAuthMember
                                ? "Google 계정은 재인증 후 최종 탈퇴가 가능합니다."
                                : "탈퇴를 진행하려면 현재 비밀번호를 입력해주세요."}
                        </p>

                        {!googleAuthMember && (
                            <div className="mt-4 space-y-2">
                                <label htmlFor="delete-account-password" className="block text-sm font-semibold text-slate-700">
                                    비밀번호
                                </label>
                                <input
                                    id="delete-account-password"
                                    type="password"
                                    className="input-base"
                                    value={deletePassword}
                                    onChange={(e) => setDeletePassword(e.target.value)}
                                    placeholder="현재 비밀번호 입력"
                                    disabled={deletingAccount || deletePasswordChecking}
                                    autoFocus
                                />
                            </div>
                        )}

                        {googleAuthMember && (
                            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                                {oauthWithdrawVerified
                                    ? "재인증 확인이 완료되었습니다. 최종 탈퇴를 진행하세요."
                                    : "먼저 Google 재인증을 진행한 뒤 최종 탈퇴를 진행하세요."}
                            </div>
                        )}

                        <div className="mt-6 flex justify-end gap-2">
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={closeDeleteConfirmModal}
                                disabled={deletingAccount || deletePasswordChecking || oauthReauthLoading}
                            >
                                취소
                            </button>
                            {googleAuthMember ? (
                                <button
                                    type="button"
                                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
                                    onClick={oauthWithdrawVerified ? handleDeleteAccount : startGoogleWithdrawReauth}
                                    disabled={deletingAccount || oauthReauthLoading}
                                >
                                    {oauthReauthLoading
                                        ? "Google 재인증 이동 중.."
                                        : oauthWithdrawVerified
                                            ? (deletingAccount ? "탈퇴 처리 중.." : "최종 탈퇴")
                                            : "Google 재인증 시작"}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
                                    onClick={handleDeleteAccount}
                                    disabled={deletingAccount || deletePasswordChecking || !deletePassword.trim()}
                                >
                                    {deletePasswordChecking ? "비밀번호 확인 중.." : deletingAccount ? "탈퇴 처리 중.." : "최종 탈퇴"}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
const StatCard = ({ icon: Icon, label, value, color }) => {
    const colorClasses = {
        purple: "from-purple-500 to-purple-600",
        blue: "from-blue-500 to-blue-600",
        green: "from-green-500 to-green-600",
        orange: "from-orange-500 to-orange-600",
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

const ProfileTab = ({ memberData, levelData, levelHistory, levelHistoryLoading, onDeleteAccount, deletingAccount }) => {
    const levelProgress = resolveLevelProgressInfo(levelData);
    const progress = levelProgress.progress;
    const currentExp = levelProgress.currentExp;
    const nextExp = levelProgress.nextExp;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <User className="h-5 w-5 text-purple-600" />
                    기본 정보
                </h3>
                <div className="space-y-3">
                    <InfoRow label="Name" value={memberData.name || "-"} />
                    <InfoRow label="Email" value={memberData.email || "-"} />
                    <InfoRow label="Phone" value={memberData.phone || "-"} />
                    <InfoRow label="Member Status" value={getMemberStatusLabel(memberData)} />
                </div>
            </div>

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
                            총 경험치 <span className="font-semibold">{formatNumber(levelData.total_exp || levelData.totalExp || 0)}</span>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2 text-sm">
                            <span className="text-slate-600">다음 레벨까지</span>
                            <span className="font-semibold text-purple-600">
                                {formatNumber(currentExp)} / {formatNumber(nextExp)}
                            </span>
                        </div>
                        <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg">
                        게시글 작성, 댓글, 좋아요 등의 활동으로 경험치를 얻을 수 있습니다.
                    </div>
                </div>
            </div>

            <div className="card p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <TreePine className="h-5 w-5 text-green-600" />
                    환경 활동
                </h3>
                <div className="space-y-3">
                    <InfoRow label="Points" value={`${formatNumber(memberData.point || 0)}P`} />
                    <InfoRow label="Trees Planted" value={`${formatNumber(memberData.tree_count || memberData.treeCount || 0)} trees`} />
                    <InfoRow label="Posts" value={`${formatNumber(memberData.board_count || memberData.boardCount || 0)} posts`} />
                </div>
            </div>

            <div className="card p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">계정 관리</h3>
                <div className="space-y-3">
                    <button
                        onClick={onDeleteAccount}
                        disabled={deletingAccount}
                        className="w-full px-4 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors text-left font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {deletingAccount ? "탈퇴 처리 중.." : "회원 탈퇴"}
                    </button>
                </div>
            </div>

            <div className="card p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">경험치 이력</h3>
                {levelHistoryLoading ? (
                    <LoadingSpinner text="경험치 이력을 불러오는 중..." />
                ) : !levelHistory.length ? (
                    <div className="text-sm text-slate-500">아직 경험치 이력이 없습니다.</div>
                ) : (
                    <div className="space-y-2">
                        {levelHistory.map((item) => (
                            <div key={item.ledger_id || item.ledgerId} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="text-sm font-semibold text-slate-900">
                                        {item.reason || item.event_type || item.eventType}
                                    </div>
                                    <div className="text-sm font-black text-emerald-600">
                                        +{formatNumber(item.granted_exp ?? item.grantedExp ?? 0)} XP
                                    </div>
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                    차감 {formatNumber(item.penalty_exp ?? item.penaltyExp ?? 0)} | {toDisplayDate(item.created_at || item.createdAt) || "-"}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const PostsTab = ({ boards, loading, navigate }) => {
    if (loading) {
        return <LoadingSpinner text="게시글 로딩 중.." />;
    }

    if (boards.length === 0) {
        return (
            <div className="card p-12 text-center">
                <MessageSquare className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">작성한 게시글이 없습니다</h3>
                <p className="text-slate-600 mb-4">첫 번째 게시글을 작성해보세요!</p>
                <button onClick={() => navigate("/app/boards/FREE_BOARD")} className="btn-primary">
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
                        navigate(`/app/boards/${normalizeBoardKind(board)}/${board.board_id || board.boardId}`)
                    }
                >
                    <h3 className="font-bold text-slate-900 text-lg mb-2 line-clamp-1">{board.title}</h3>
                    <p className="text-slate-600 text-sm mb-3 line-clamp-2">
                        {stripHtmlTags(board.contents || board.content || "")}
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
                            <span>{toDisplayDate(board.created_at || board.createdAt) || "-"}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

const StatsTab = ({ memberData, levelData, levelHistory, levelHistoryLoading }) => {
    const levelProgress = resolveLevelProgressInfo(levelData);
    const progress = levelProgress.progress;
    const currentExp = levelProgress.currentExp;
    const nextExp = levelProgress.nextExp;
    const neededExp = levelProgress.neededExp;

    return (
        <div className="space-y-6">
            <div className="card p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-purple-600" />
                    활동 통계
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <StatsCard label="레벨" value={levelData.level || 1} color="purple" icon={Award} />
                    <StatsCard
                        label="Total EXP"
                        value={formatNumber(levelData.total_exp || levelData.totalExp || 0)}
                        color="blue"
                        icon={TrendingUp}
                    />
                    <StatsCard label="Points" value={formatNumber(memberData.point || 0)} color="green" icon={TrendingUp} />
                    <StatsCard
                        label="작성 게시글"
                        value={formatNumber(memberData.board_count || memberData.boardCount || 0)}
                        color="orange"
                        icon={MessageSquare}
                    />
                    <StatsCard
                        label="Trees Planted"
                        value={`${formatNumber(memberData.tree_count || memberData.treeCount || 0)} trees`}
                        color="green"
                        icon={TreePine}
                    />
                </div>
            </div>

            <div className="card p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">레벨 진행도</h3>
                <div className="space-y-4">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-slate-900">
                                Lv. {levelData.level || 1} {"->"} Lv. {(levelData.level || 1) + 1}
                            </span>
                            <span className="text-sm text-slate-600">
                                {formatNumber(currentExp)} / {formatNumber(nextExp)}
                            </span>
                        </div>
                        <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-sm text-slate-500 mt-2">
                            다음 레벨까지 {formatNumber(neededExp)} 경험치 필요
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const InfoRow = ({ label, value }) => (
    <div className="flex items-center justify-between py-2 border-b border-slate-200 last:border-0">
        <span className="text-sm text-slate-600">{label}</span>
        <span className="font-semibold text-slate-900">{value}</span>
    </div>
);

const StatsCard = ({ label, value, color, icon: Icon }) => {
    const colorClasses = {
        purple: "from-purple-500 to-purple-600",
        blue: "from-blue-500 to-blue-600",
        green: "from-green-500 to-green-600",
        orange: "from-orange-500 to-orange-600",
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


