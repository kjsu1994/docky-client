import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Award,
    BarChart3,
    Calendar,
    CheckCircle2,
    Download,
    Edit,
    FileText,
    Heart,
    LogOut,
    Mail,
    MessageSquare,
    MonitorSmartphone,
    Phone,
    RefreshCw,
    ShieldCheck,
    TrendingUp,
    Trash2,
    User,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { LoadingSpinner } from "../../components/LoadingSpinner.jsx";
import { ErrorMessage } from "../../components/ErrorMessage.jsx";
import { EmptyState } from "../../components/EmptyState.jsx";
import UserAvatar from "../../common/UserAvatar.jsx";
import { formatNumber, formatRelativeTime } from "../../utils/helpers.js";
import { trapFocus } from "../../utils/focusTrap.js";
import { notifyError, notifySuccess } from "../../utils/toast.js";
import { writeStoredAdsConsent } from "../../utils/adsense.js";
import { authAdapter, extractAuthErrorMessage } from "../../adapters/authAdapter.js";
import { extractMypageErrorMessage, isAccountReauthRequiredError, isGoogleMember, mypageAdapter } from "../../adapters/mypageAdapter.js";

const toDisplayDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return formatRelativeTime(date);
};

const formatSignedExp = (value) => {
    const numeric = Number(value) || 0;
    const sign = numeric >= 0 ? "+" : "-";
    return `${sign}${formatNumber(Math.abs(numeric))}`;
};

export const Mypage = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [member, setMember] = useState(null);
    const [myBoards, setMyBoards] = useState([]);
    const [levelHistory, setLevelHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [boardsLoading, setBoardsLoading] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState("profile");
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deletePassword, setDeletePassword] = useState("");
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [passwordChecking, setPasswordChecking] = useState(false);
    const [oauthWithdrawVerified, setOauthWithdrawVerified] = useState(false);
    const [oauthReauthLoading, setOauthReauthLoading] = useState(false);
    const [sessions, setSessions] = useState([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [sessionBusyKey, setSessionBusyKey] = useState("");
    const [privacySummary, setPrivacySummary] = useState(null);
    const [privacyLoading, setPrivacyLoading] = useState(false);
    const [privacyBusyKey, setPrivacyBusyKey] = useState("");
    const [privacyExporting, setPrivacyExporting] = useState(false);

    const level = member?.level || {};
    const tierLabel = level.tierName || level.frameLabel || level.rewardTier || "아이언";
    const googleMember = useMemo(() => isGoogleMember(member), [member]);

    const fetchMember = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            setMember(await mypageAdapter.fetchMember());
        } catch (err) {
            setError(extractMypageErrorMessage(err, "회원 정보를 불러오지 못했습니다."));
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchMyBoards = useCallback(async () => {
        setBoardsLoading(true);
        try {
            setMyBoards(await mypageAdapter.fetchMyBoards());
        } catch (err) {
            notifyError(extractMypageErrorMessage(err, "작성한 게시글을 불러오지 못했습니다."));
            setMyBoards([]);
        } finally {
            setBoardsLoading(false);
        }
    }, []);

    const fetchLevelHistory = useCallback(async () => {
        setHistoryLoading(true);
        try {
            setLevelHistory(await mypageAdapter.fetchLevelHistory());
        } catch (err) {
            notifyError(extractMypageErrorMessage(err, "경험치 이력을 불러오지 못했습니다."));
            setLevelHistory([]);
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    const fetchSessions = useCallback(async () => {
        setSessionsLoading(true);
        try {
            setSessions(await authAdapter.fetchLoginSessions());
        } catch (err) {
            notifyError(extractAuthErrorMessage(err, "Login sessions could not be loaded."));
            setSessions([]);
        } finally {
            setSessionsLoading(false);
        }
    }, []);

    const fetchPrivacySummary = useCallback(async () => {
        setPrivacyLoading(true);
        try {
            setPrivacySummary(await mypageAdapter.fetchPrivacySummary());
        } catch (err) {
            notifyError(extractMypageErrorMessage(err, "개인정보 설정을 불러오지 못했습니다."));
            setPrivacySummary(null);
        } finally {
            setPrivacyLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMember();
    }, [fetchMember]);

    useEffect(() => {
        if (activeTab === "posts") {
            fetchMyBoards();
        } else if (activeTab === "stats") {
            fetchLevelHistory();
        } else if (activeTab === "security") {
            fetchSessions();
        } else if (activeTab === "privacy") {
            fetchPrivacySummary();
        }
    }, [activeTab, fetchLevelHistory, fetchMyBoards, fetchPrivacySummary, fetchSessions]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("withdraw_reauth") !== "1") return;

        const verify = async () => {
            try {
                await mypageAdapter.grantWithdrawReauth();
                setOauthWithdrawVerified(true);
                notifySuccess("Google 재인증이 확인되었습니다. 이제 탈퇴를 진행할 수 있습니다.");
            } catch (err) {
                setOauthWithdrawVerified(false);
                notifyError(extractMypageErrorMessage(err, "Google 재인증 확인에 실패했습니다."));
            } finally {
                params.delete("withdraw_reauth");
                const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
                window.history.replaceState({}, document.title, nextUrl);
                setOauthReauthLoading(false);
            }
        };

        verify();
    }, []);

    const openDeleteModal = useCallback(() => {
        if (deleteBusy || passwordChecking || oauthReauthLoading) return;
        setDeletePassword("");
        setDeleteModalOpen(true);
    }, [deleteBusy, oauthReauthLoading, passwordChecking]);

    const closeDeleteModal = useCallback(() => {
        if (deleteBusy || passwordChecking || oauthReauthLoading) return;
        setDeletePassword("");
        setDeleteModalOpen(false);
    }, [deleteBusy, oauthReauthLoading, passwordChecking]);

    const startGoogleWithdrawReauth = () => {
        if (oauthReauthLoading || deleteBusy) return;
        setOauthReauthLoading(true);
        setOauthWithdrawVerified(false);
        localStorage.setItem("postOauthRedirect", "/app/mypage?withdraw_reauth=1");
        window.location.href = "/api/oauth2/authorization/google?prompt=select_account";
    };

    const handleDeleteAccount = async () => {
        if (!member || deleteBusy || passwordChecking || oauthReauthLoading) return;

        if (googleMember) {
            if (!oauthWithdrawVerified) {
                notifyError("Google 계정은 재인증 후 탈퇴할 수 있습니다.");
                return;
            }
        } else {
            const email = member.email || user?.email || "";
            if (!email) {
                notifyError("이메일 정보를 찾을 수 없습니다.");
                return;
            }
            if (!deletePassword.trim()) {
                notifyError("현재 비밀번호를 입력해 주세요.");
                return;
            }
            try {
                setPasswordChecking(true);
                await mypageAdapter.verifyPassword(email, deletePassword.trim());
            } catch (err) {
                notifyError(extractMypageErrorMessage(err, "현재 비밀번호가 일치하지 않습니다."));
                return;
            } finally {
                setPasswordChecking(false);
            }
        }

        try {
            setDeleteBusy(true);
            await mypageAdapter.deleteAccount();
            notifySuccess("회원 탈퇴가 완료되었습니다.");
            await logout({ skipApi: true, silent: true });
        } catch (err) {
            if (isAccountReauthRequiredError(err)) {
                setOauthWithdrawVerified(false);
                notifyError("Google 재인증이 만료되었습니다. 다시 인증해 주세요.");
                return;
            }
            notifyError(extractMypageErrorMessage(err, "회원 탈퇴에 실패했습니다."));
        } finally {
            setDeleteBusy(false);
        }
    };

    const handleLogoutOtherSessions = async () => {
        if (sessionBusyKey) return;
        setSessionBusyKey("others");
        try {
            const response = await authAdapter.logoutOtherSessions();
            const revokedCount = Number(response?.revoked_count ?? response?.revokedCount ?? 0);
            notifySuccess(revokedCount > 0 ? `${revokedCount} other sessions logged out.` : "No other active sessions.");
            await fetchSessions();
        } catch (err) {
            notifyError(extractAuthErrorMessage(err, "Other sessions could not be logged out."));
        } finally {
            setSessionBusyKey("");
        }
    };

    const handleRevokeSession = async (sessionId) => {
        if (!sessionId || sessionBusyKey) return;
        setSessionBusyKey(sessionId);
        try {
            await authAdapter.revokeLoginSession(sessionId);
            notifySuccess("Session logged out.");
            await fetchSessions();
        } catch (err) {
            notifyError(extractAuthErrorMessage(err, "Session could not be logged out."));
        } finally {
            setSessionBusyKey("");
        }
    };

    const handleUpdatePrivacyConsent = async (consentType, granted) => {
        if (!consentType || privacyBusyKey) return;
        setPrivacyBusyKey(consentType);
        try {
            const response = await mypageAdapter.updatePrivacyConsent(consentType, granted);
            const updatedConsent = response.consent;
            setPrivacySummary((previous) => {
                if (!previous || !updatedConsent?.consentType) return previous;
                return {
                    ...previous,
                    consents: previous.consents.map((consent) => (
                        consent.consentType === updatedConsent.consentType ? updatedConsent : consent
                    )),
                };
            });
            if (consentType === "ADS_PERSONALIZATION") {
                writeStoredAdsConsent(granted ? "personalized" : "non_personalized");
            }
            notifySuccess("동의 설정이 저장되었습니다.");
        } catch (err) {
            notifyError(extractMypageErrorMessage(err, "동의 설정을 저장하지 못했습니다."));
        } finally {
            setPrivacyBusyKey("");
        }
    };

    const handleDownloadPrivacyExport = async () => {
        if (privacyExporting) return;
        setPrivacyExporting(true);
        try {
            await mypageAdapter.downloadPrivacyExport();
            notifySuccess("내 데이터 파일을 내려받았습니다.");
        } catch (err) {
            notifyError(extractMypageErrorMessage(err, "내 데이터 내보내기에 실패했습니다."));
        } finally {
            setPrivacyExporting(false);
        }
    };

    if (loading) {
        return <LoadingSpinner text="회원 정보를 불러오는 중입니다..." />;
    }

    if (error) {
        return <ErrorMessage message={error} onRetry={fetchMember} />;
    }

    if (!member) {
        return <EmptyState message="회원 정보를 찾을 수 없습니다." subMessage="다시 로그인한 뒤 확인해 주세요." />;
    }

    return (
        <div className="space-y-6">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="h-28 bg-gradient-to-r from-slate-900 via-sky-700 to-emerald-600" />
                <div className="px-5 pb-6 sm:px-6">
                    <div className="-mt-14 flex flex-col gap-4 sm:flex-row sm:items-end">
                        <div className="shrink-0">
                            <UserAvatar
                                name={member.name}
                                profileUrl={member.profileUrl}
                                level={level.level}
                                rewardTier={level.rewardTier}
                                frameCode={level.frameCode}
                                size="3xl"
                                className="rounded-2xl border-4 border-white shadow-xl"
                                showLevelBadge
                            />
                        </div>

                        <div className="min-w-0 flex-1 pt-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="truncate text-2xl font-black text-slate-900">{member.name}</h1>
                                <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-black text-sky-700">레벨 {level.level || 1}</span>
                                <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-black text-amber-700">{tierLabel}</span>
                                <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-black text-emerald-700">{member.statusLabel}</span>
                            </div>
                            <div className="mt-2 space-y-1 text-sm font-medium text-slate-500">
                                <div className="flex items-center gap-2"><Mail className="h-4 w-4" />{member.email || "-"}</div>
                                {member.phone ? <div className="flex items-center gap-2"><Phone className="h-4 w-4" />{member.phone}</div> : null}
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => navigate("/app/mypage/edit")}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-200"
                        >
                            <Edit className="h-4 w-4" />
                            프로필 수정
                        </button>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
                        <SummaryCard icon={Award} label="누적 경험치" value={formatNumber(level.totalExp)} tone="sky" />
                        <SummaryCard icon={TrendingUp} label="보유 포인트" value={`${formatNumber(member.point)}P`} tone="emerald" />
                        <SummaryCard icon={MessageSquare} label="작성 게시글" value={`${formatNumber(member.boardCount)}개`} tone="amber" />
                    </div>
                </div>
            </section>

            <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    <TabButton active={activeTab === "profile"} onClick={() => setActiveTab("profile")}>프로필</TabButton>
                    <TabButton active={activeTab === "posts"} onClick={() => setActiveTab("posts")}>작성 글</TabButton>
                    <TabButton active={activeTab === "stats"} onClick={() => setActiveTab("stats")}>활동 통계</TabButton>
                    <TabButton active={activeTab === "security"} onClick={() => setActiveTab("security")}>보안</TabButton>
                    <TabButton active={activeTab === "privacy"} onClick={() => setActiveTab("privacy")}>개인정보</TabButton>
                </div>
            </div>

            {activeTab === "profile" ? (
                <ProfileTab member={member} level={level} onDeleteAccount={openDeleteModal} deleteBusy={deleteBusy} />
            ) : null}
            {activeTab === "posts" ? (
                <PostsTab boards={myBoards} loading={boardsLoading} navigate={navigate} />
            ) : null}
            {activeTab === "stats" ? (
                <StatsTab member={member} level={level} history={levelHistory} historyLoading={historyLoading} />
            ) : null}
            {activeTab === "security" ? (
                <SecurityTab
                    sessions={sessions}
                    loading={sessionsLoading}
                    busyKey={sessionBusyKey}
                    onRefresh={fetchSessions}
                    onLogoutOtherSessions={handleLogoutOtherSessions}
                    onRevokeSession={handleRevokeSession}
                />
            ) : null}
            {activeTab === "privacy" ? (
                <PrivacyTab
                    summary={privacySummary}
                    loading={privacyLoading}
                    busyKey={privacyBusyKey}
                    exporting={privacyExporting}
                    onRefresh={fetchPrivacySummary}
                    onUpdateConsent={handleUpdatePrivacyConsent}
                    onExport={handleDownloadPrivacyExport}
                    onDeleteAccount={openDeleteModal}
                    deleteBusy={deleteBusy}
                />
            ) : null}

            {deleteModalOpen ? (
                <DeleteAccountModal
                    googleMember={googleMember}
                    oauthWithdrawVerified={oauthWithdrawVerified}
                    oauthReauthLoading={oauthReauthLoading}
                    deleteBusy={deleteBusy}
                    passwordChecking={passwordChecking}
                    deletePassword={deletePassword}
                    setDeletePassword={setDeletePassword}
                    onClose={closeDeleteModal}
                    onStartGoogleReauth={startGoogleWithdrawReauth}
                    onDelete={handleDeleteAccount}
                />
            ) : null}
        </div>
    );
};

const toneClasses = {
    sky: "bg-sky-50 text-sky-700",
    emerald: "bg-emerald-50 text-emerald-700",
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
};

const SummaryCard = ({ icon: Icon, label, value, tone }) => (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${toneClasses[tone] || toneClasses.sky}`}>
            <Icon className="h-5 w-5" />
        </div>
        <div className="text-xs font-bold text-slate-500">{label}</div>
        <div className="mt-1 text-xl font-black text-slate-900">{value}</div>
    </div>
);

const TabButton = ({ active, onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        className={`min-h-11 rounded-xl px-2 py-3 text-sm font-black transition-all ${
            active ? "bg-slate-900 text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
        }`}
    >
        {children}
    </button>
);

const SecurityTab = ({
    sessions,
    loading,
    busyKey,
    onRefresh,
    onLogoutOtherSessions,
    onRevokeSession,
}) => {
    const hasOtherSessions = sessions.some((session) => !Boolean(session.current));

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
                        <ShieldCheck className="h-5 w-5 text-sky-600" />
                        로그인 기기 관리
                    </h2>
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                        현재 로그인된 기기를 확인하고 사용하지 않는 세션을 종료할 수 있습니다.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={loading || Boolean(busyKey)}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        새로고침
                    </button>
                    <button
                        type="button"
                        onClick={onLogoutOtherSessions}
                        disabled={loading || Boolean(busyKey) || !hasOtherSessions}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                        <LogOut className="h-4 w-4" />
                        다른 기기 로그아웃
                    </button>
                </div>
            </div>

            {loading ? (
                <LoadingSpinner text="로그인 기기 목록을 불러오는 중입니다..." />
            ) : !sessions.length ? (
                <EmptyState message="활성 로그인 기기가 없습니다." subMessage="다시 로그인하면 현재 기기가 표시됩니다." />
            ) : (
                <div className="space-y-3">
                    {sessions.map((session) => {
                        const sessionId = session.session_id || session.sessionId;
                        const current = Boolean(session.current);
                        const busy = busyKey === sessionId;
                        return (
                            <div
                                key={sessionId}
                                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <MonitorSmartphone className="h-4 w-4 shrink-0 text-slate-500" />
                                        <span className="break-words text-sm font-black text-slate-900">
                                            {session.device_label || session.deviceLabel || "Unknown device"}
                                        </span>
                                        {current ? (
                                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-700">
                                                현재 기기
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-500">
                                        <span>마지막 사용 {toDisplayDate(session.last_used_at || session.lastUsedAt) || "-"}</span>
                                        <span>만료 {toDisplayDate(session.expires_at || session.expiresAt) || "-"}</span>
                                        <span>{session.remember ? "자동 로그인" : "일반 로그인"}</span>
                                    </div>
                                </div>
                                {current ? null : (
                                    <button
                                        type="button"
                                        onClick={() => onRevokeSession(sessionId)}
                                        disabled={Boolean(busyKey)}
                                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-black text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                                    >
                                        {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                        로그아웃
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
};

const exportIncludeLabels = {
    profile: "프로필",
    consents: "동의 설정",
    boards: "게시글",
    comments: "댓글",
    retentionPolicy: "보관 정책",
};

const consentSourceLabels = {
    LEGACY_ACCOUNT: "기존 계정 기준",
    DEFAULT: "기본값",
    USER_SETTING: "직접 설정",
};

const PrivacyTab = ({
    summary,
    loading,
    busyKey,
    exporting,
    onRefresh,
    onUpdateConsent,
    onExport,
    onDeleteAccount,
    deleteBusy,
}) => {
    const consents = summary?.consents || [];
    const retentionPolicy = summary?.retentionPolicy || [];
    const exportIncludes = summary?.exportIncludes || [];

    if (loading) {
        return <LoadingSpinner text="개인정보 설정을 불러오는 중입니다..." />;
    }

    if (!summary) {
        return (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <EmptyState message="개인정보 설정을 불러오지 못했습니다." subMessage="잠시 후 다시 시도해 주세요." />
                <div className="flex justify-center">
                    <button type="button" onClick={onRefresh} className="btn-secondary">
                        다시 불러오기
                    </button>
                </div>
            </section>
        );
    }

    return (
        <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
                            <FileText className="h-5 w-5 text-sky-600" />
                            내 데이터와 동의 설정
                        </h2>
                        <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                            저장된 계정 정보와 작성 콘텐츠 범위를 확인하고, 선택 동의를 변경할 수 있습니다.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={onRefresh}
                            disabled={loading || Boolean(busyKey) || exporting}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                            새로고침
                        </button>
                        <button
                            type="button"
                            onClick={onExport}
                            disabled={exporting || Boolean(busyKey)}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-60"
                        >
                            {exporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            내 데이터 받기
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                    {consents.map((consent) => {
                        const busy = busyKey === consent.consentType;
                        const disabled = consent.required || Boolean(busyKey);
                        return (
                            <div key={consent.consentType} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="break-words text-sm font-black text-slate-900">{consent.label}</span>
                                            <span className={`rounded-full px-2.5 py-1 text-xs font-black ${
                                                consent.required ? "bg-slate-200 text-slate-700" : "bg-sky-100 text-sky-700"
                                            }`}>
                                                {consent.required ? "필수" : "선택"}
                                            </span>
                                        </div>
                                        <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                                            {consent.required
                                                ? "서비스 이용을 위해 유지되는 필수 동의입니다."
                                                : "원하면 언제든지 켜거나 끌 수 있습니다."}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={consent.granted}
                                        aria-label={`${consent.label} ${consent.granted ? "동의함" : "동의하지 않음"}`}
                                        onClick={() => onUpdateConsent(consent.consentType, !consent.granted)}
                                        disabled={disabled}
                                        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${
                                            consent.granted ? "bg-emerald-500" : "bg-slate-300"
                                        } disabled:cursor-not-allowed disabled:opacity-70`}
                                    >
                                        <span
                                            className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${
                                                consent.granted ? "translate-x-6" : "translate-x-1"
                                            }`}
                                        />
                                    </button>
                                </div>
                                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                                    {busy ? (
                                        <span className="inline-flex items-center gap-1 text-sky-700">
                                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                            저장 중
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1">
                                            <CheckCircle2 className={`h-3.5 w-3.5 ${consent.granted ? "text-emerald-600" : "text-slate-400"}`} />
                                            {consent.granted ? "동의" : "미동의"}
                                        </span>
                                    )}
                                    <span>{consentSourceLabels[consent.source] || consent.source || "기록 없음"}</span>
                                    {consent.updatedAt ? <span>{toDisplayDate(consent.updatedAt)}</span> : null}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-sm font-black text-slate-900">내보내기 포함 항목</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {exportIncludes.map((item) => (
                            <span key={item} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700">
                                {exportIncludeLabels[item] || item}
                            </span>
                        ))}
                    </div>
                </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    보관 및 삭제 기준
                </h2>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {retentionPolicy.map((item) => (
                        <div key={item.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <div className="text-sm font-black text-slate-900">{item.title}</div>
                            <div className="mt-2 text-xs font-black text-emerald-700">{item.period}</div>
                            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{item.description}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="mb-3 flex items-center gap-2 text-lg font-black text-slate-900">
                    <Trash2 className="h-5 w-5 text-rose-600" />
                    계정 삭제 요청
                </h2>
                <p className="mb-4 text-sm font-semibold leading-6 text-slate-500">
                    탈퇴하면 계정은 비활성화되며, 법령과 서비스 운영상 필요한 보관 기간이 끝난 정보는 삭제 대상이 됩니다.
                </p>
                <button
                    type="button"
                    onClick={onDeleteAccount}
                    disabled={deleteBusy}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700 hover:bg-rose-100 disabled:opacity-60 sm:w-auto"
                >
                    <Trash2 className="h-4 w-4" />
                    {deleteBusy ? "탈퇴 처리 중..." : "회원 탈퇴 진행"}
                </button>
            </section>
        </div>
    );
};

const ProfileTab = ({ member, level, onDeleteAccount, deleteBusy }) => (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900">
                <User className="h-5 w-5 text-sky-600" />
                기본 정보
            </h2>
            <InfoRow label="이름" value={member.name} />
            <InfoRow label="이메일" value={member.email || "-"} />
            <InfoRow label="전화번호" value={member.phone || "-"} />
            <InfoRow label="로그인 방식" value={member.authProviderLabel} />
            <InfoRow label="회원 상태" value={member.statusLabel} />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900">
                <Award className="h-5 w-5 text-amber-600" />
                레벨 정보
            </h2>
            <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-600">현재 레벨</span>
                <span className="text-2xl font-black text-slate-900">레벨 {level.level || 1}</span>
            </div>
            <InfoRow label="현재 티어" value={level.tierName || level.frameLabel || level.rewardTier || "-"} />
            <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-bold text-slate-600">다음 레벨까지</span>
                <span className="font-black text-sky-700">{formatNumber(level.currentExp)} / {formatNumber(level.nextLevelExp)}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-sky-500" style={{ width: `${level.progressPercent || 0}%` }} />
            </div>
            <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-500">
                게시글, 댓글, 좋아요, 게임 참여로 경험치를 얻고 레벨을 올릴 수 있습니다.
            </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900">
                <BarChart3 className="h-5 w-5 text-emerald-600" />
                활동 요약
            </h2>
            <InfoRow label="보유 포인트" value={`${formatNumber(member.point)}P`} />
            <InfoRow label="작성 게시글" value={`${formatNumber(member.boardCount)}개`} />
            <InfoRow label="작성 댓글" value={`${formatNumber(member.commentCount)}개`} />
        </section>

        <section className="rounded-2xl border border-rose-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900">
                <ShieldCheck className="h-5 w-5 text-rose-600" />
                계정 관리
            </h2>
            <p className="mb-4 text-sm font-medium leading-6 text-slate-500">
                탈퇴하면 계정 상태가 비활성화되며, 다시 이용하려면 같은 이메일로 재가입 절차를 진행해야 합니다.
            </p>
            <button
                type="button"
                onClick={onDeleteAccount}
                disabled={deleteBusy}
                className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm font-black text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
            >
                {deleteBusy ? "탈퇴 처리 중..." : "회원 탈퇴"}
            </button>
        </section>
    </div>
);

const PostsTab = ({ boards, loading, navigate }) => {
    if (loading) {
        return <LoadingSpinner text="작성한 게시글을 불러오는 중입니다..." />;
    }
    if (!boards.length) {
        return (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <EmptyState message="작성한 게시글이 없습니다." subMessage="첫 번째 게시글을 작성해 보세요." />
                <div className="flex justify-center">
                    <button type="button" onClick={() => navigate("/app/boards/FREE_BOARD")} className="btn-primary">
                        게시글 작성하기
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {boards.map((board) => (
                <button
                    key={board.id}
                    type="button"
                    className="block w-full rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-sky-200 hover:shadow-md"
                    onClick={() => navigate(`/app/boards/${board.kind}/${board.id}`)}
                >
                    <h3 className="line-clamp-1 text-lg font-black text-slate-900">{board.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{board.preview || "본문 미리보기가 없습니다."}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-500">
                        <span className="inline-flex items-center gap-1"><Heart className="h-4 w-4 text-rose-500" />좋아요 {formatNumber(board.likeCount)}</span>
                        <span className="inline-flex items-center gap-1"><TrendingUp className="h-4 w-4 text-sky-500" />조회 {formatNumber(board.viewCount)}</span>
                        <span className="ml-auto inline-flex items-center gap-1"><Calendar className="h-4 w-4" />{toDisplayDate(board.createdAt) || "-"}</span>
                    </div>
                </button>
            ))}
        </div>
    );
};

const StatsTab = ({ member, level, history, historyLoading }) => (
    <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900">
                <BarChart3 className="h-5 w-5 text-sky-600" />
                활동 통계
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard icon={Award} label="레벨" value={`레벨 ${level.level || 1}`} tone="sky" />
                <SummaryCard icon={TrendingUp} label="누적 경험치" value={formatNumber(level.totalExp)} tone="emerald" />
                <SummaryCard icon={TrendingUp} label="보유 포인트" value={`${formatNumber(member.point)}P`} tone="green" />
                <SummaryCard icon={MessageSquare} label="작성 게시글" value={`${formatNumber(member.boardCount)}개`} tone="amber" />
            </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-black text-slate-900">레벨 진행도</h2>
            <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-black text-slate-900">레벨 {level.level || 1} → 레벨 {(level.level || 1) + 1}</span>
                <span className="font-bold text-slate-600">{formatNumber(level.currentExp)} / {formatNumber(level.nextLevelExp)}</span>
            </div>
            <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${level.progressPercent || 0}%` }} />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-500">다음 레벨까지 {formatNumber(level.remainingExp)} 경험치가 필요합니다.</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-black text-slate-900">경험치 이력</h2>
            {historyLoading ? (
                <LoadingSpinner text="경험치 이력을 불러오는 중입니다..." />
            ) : !history.length ? (
                <EmptyState message="아직 경험치 이력이 없습니다." subMessage="게시글과 댓글 활동을 시작하면 이력이 표시됩니다." />
            ) : (
                <div className="space-y-2">
                    {history.map((item) => (
                        <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-black text-slate-900">{item.label}</div>
                                <div className={`text-sm font-black ${Number(item.grantedExp) < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                                    {formatSignedExp(item.grantedExp)} 경험치
                                </div>
                            </div>
                            <div className="mt-1 text-xs font-semibold text-slate-500">
                                기준 {formatNumber(item.baseExp)} · 차감 {formatNumber(item.penaltyExp)} · {toDisplayDate(item.createdAt) || "-"}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    </div>
);

const InfoRow = ({ label, value }) => (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-0">
        <span className="text-sm font-bold text-slate-500">{label}</span>
        <span className="text-right text-sm font-black text-slate-900">{value}</span>
    </div>
);

const DeleteAccountModal = ({
    googleMember,
    oauthWithdrawVerified,
    oauthReauthLoading,
    deleteBusy,
    passwordChecking,
    deletePassword,
    setDeletePassword,
    onClose,
    onStartGoogleReauth,
    onDelete,
}) => {
    const titleId = useId();
    const descriptionId = useId();
    const passwordId = useId();
    const dialogRef = useRef(null);
    const cancelButtonRef = useRef(null);
    const passwordInputRef = useRef(null);
    const closeDisabled = deleteBusy || passwordChecking || oauthReauthLoading;

    useEffect(() => {
        const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const focusTimer = window.setTimeout(() => {
            if (googleMember) {
                cancelButtonRef.current?.focus();
                return;
            }
            passwordInputRef.current?.focus();
        }, 0);

        return () => {
            window.clearTimeout(focusTimer);
            document.body.style.overflow = previousOverflow;
            if (previousFocus?.isConnected) previousFocus.focus();
        };
    }, [googleMember]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === "Escape" && !closeDisabled) {
                event.preventDefault();
                onClose();
                return;
            }
            trapFocus(event, dialogRef.current);
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [closeDisabled, onClose]);

    return (
    <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4"
        role="presentation"
        onMouseDown={(event) => {
            if (event.target === event.currentTarget && !closeDisabled) onClose();
        }}
    >
        <div
            ref={dialogRef}
            className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
        >
            <h3 id={titleId} className="text-lg font-black text-slate-900">회원 탈퇴 확인</h3>
            <p id={descriptionId} className="mt-2 text-sm font-medium leading-6 text-slate-600">
                {googleMember
                    ? "Google 계정은 재인증 후 최종 탈퇴할 수 있습니다."
                    : "탈퇴를 진행하려면 현재 비밀번호를 입력해 주세요."}
            </p>

            {!googleMember ? (
                <div className="mt-4 space-y-2">
                    <label htmlFor={passwordId} className="block text-sm font-bold text-slate-700">
                        현재 비밀번호
                    </label>
                    <input
                        ref={passwordInputRef}
                        id={passwordId}
                        type="password"
                        className="input-base"
                        value={deletePassword}
                        onChange={(event) => setDeletePassword(event.target.value)}
                        placeholder="현재 비밀번호 입력"
                        disabled={deleteBusy || passwordChecking}
                    />
                </div>
            ) : (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-600">
                    {oauthWithdrawVerified
                        ? "재인증이 완료되었습니다. 최종 탈퇴를 진행할 수 있습니다."
                        : "먼저 Google 재인증을 진행해 주세요."}
                </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
                <button ref={cancelButtonRef} type="button" className="btn-secondary" onClick={onClose} disabled={closeDisabled}>
                    취소
                </button>
                {googleMember ? (
                    <button
                        type="button"
                        className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-black text-white transition hover:bg-rose-700 disabled:opacity-60"
                        onClick={oauthWithdrawVerified ? onDelete : onStartGoogleReauth}
                        disabled={deleteBusy || oauthReauthLoading}
                    >
                        {oauthReauthLoading ? "Google 재인증 이동 중..." : oauthWithdrawVerified ? (deleteBusy ? "탈퇴 처리 중..." : "최종 탈퇴") : "Google 재인증 시작"}
                    </button>
                ) : (
                    <button
                        type="button"
                        className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-black text-white transition hover:bg-rose-700 disabled:opacity-60"
                        onClick={onDelete}
                        disabled={deleteBusy || passwordChecking || !deletePassword.trim()}
                    >
                        {passwordChecking ? "비밀번호 확인 중..." : deleteBusy ? "탈퇴 처리 중..." : "최종 탈퇴"}
                    </button>
                )}
            </div>
        </div>
    </div>
    );
};

export default Mypage;
