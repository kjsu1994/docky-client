import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Award,
    BarChart3,
    Calendar,
    Edit,
    Heart,
    Mail,
    MessageSquare,
    Phone,
    ShieldCheck,
    TrendingUp,
    User,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { LoadingSpinner } from "../../components/LoadingSpinner.jsx";
import { ErrorMessage } from "../../components/ErrorMessage.jsx";
import { EmptyState } from "../../components/EmptyState.jsx";
import { formatNumber, formatRelativeTime } from "../../utils/helpers.js";
import { normalizeProfileImageUrl } from "../../utils/profileImage.js";
import { trapFocus } from "../../utils/focusTrap.js";
import { notifyError, notifySuccess } from "../../utils/toast.js";
import { extractMypageErrorMessage, isAccountReauthRequiredError, isGoogleMember, mypageAdapter } from "../../adapters/mypageAdapter.js";

const toDisplayDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return formatRelativeTime(date);
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

    const level = member?.level || {};
    const profileImageUrl = normalizeProfileImageUrl(member?.profileUrl || "");
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

    useEffect(() => {
        fetchMember();
    }, [fetchMember]);

    useEffect(() => {
        if (activeTab === "posts") {
            fetchMyBoards();
        } else if (activeTab === "stats") {
            fetchLevelHistory();
        }
    }, [activeTab, fetchLevelHistory, fetchMyBoards]);

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
                            {profileImageUrl ? (
                                <img
                                    src={profileImageUrl}
                                    alt=""
                                    className="h-28 w-28 rounded-2xl border-4 border-white object-cover shadow-xl"
                                />
                            ) : (
                                <div className="flex h-28 w-28 items-center justify-center rounded-2xl border-4 border-white bg-slate-900 text-4xl font-black text-white shadow-xl">
                                    {String(member.name || "사").charAt(0)}
                                </div>
                            )}
                        </div>

                        <div className="min-w-0 flex-1 pt-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="truncate text-2xl font-black text-slate-900">{member.name}</h1>
                                <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-black text-sky-700">레벨 {level.level || 1}</span>
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
                <div className="grid grid-cols-3 gap-2">
                    <TabButton active={activeTab === "profile"} onClick={() => setActiveTab("profile")}>프로필</TabButton>
                    <TabButton active={activeTab === "posts"} onClick={() => setActiveTab("posts")}>작성 글</TabButton>
                    <TabButton active={activeTab === "stats"} onClick={() => setActiveTab("stats")}>활동 통계</TabButton>
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
            <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-bold text-slate-600">다음 레벨까지</span>
                <span className="font-black text-sky-700">{formatNumber(level.currentExp)} / {formatNumber(level.nextLevelExp)}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-sky-500" style={{ width: `${level.progressPercent || 0}%` }} />
            </div>
            <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-500">
                게시글과 댓글 활동으로 경험치를 얻고 레벨을 올릴 수 있습니다.
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
                                <div className="text-sm font-black text-emerald-600">+{formatNumber(item.grantedExp)} 경험치</div>
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
