import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Lock, Leaf } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { BrandMark } from "../../common/BrandLogo.jsx";
import { trapFocus } from "../../utils/focusTrap.js";
import { logClientError } from "../../utils/clientDiagnostics.js";
import { loadToast, notifyError, notifySuccess } from "../../utils/toast.js";

const loadAuthAdapter = () => import("../../adapters/authAdapter.js");

export const Login = () => {
    const [oauthProcessing, setOauthProcessing] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return Boolean(
            params.get("accessToken") ||
            params.get("access_token") ||
            params.has("error")
        );
    });
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [naverLoading, setNaverLoading] = useState(false);
    const [lockInfo, setLockInfo] = useState(null);
    const [releaseReason, setReleaseReason] = useState("");
    const [releaseLoading, setReleaseLoading] = useState(false);
    const { login, loginWithTokens } = useAuth();
    const oauthHandledRef = useRef(false);
    const releaseLoadingRef = useRef(false);
    const lockDialogRef = useRef(null);
    const lockCloseBtnRef = useRef(null);
    const lockDialogTitleId = useId();
    const lockDialogDescriptionId = useId();
    const lockReleaseReasonId = useId();

    const formatDateTime = (value) => {
        if (!value) return "종료일 없음";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return date.toLocaleString();
    };

    useEffect(() => {
        if (oauthHandledRef.current) return;

        const params = new URLSearchParams(window.location.search);
        const accessToken = params.get("accessToken") || params.get("access_token");
        const refreshToken = params.get("refreshToken") || params.get("refresh_token");
        const oauthError = params.has("error");

        if (oauthError) {
            window.history.replaceState({}, document.title, window.location.pathname);
            notifyError("소셜 로그인에 실패했습니다. 다시 시도해주세요.");
            oauthHandledRef.current = true;
            setOauthProcessing(false);
            return;
        }

        if (!accessToken) {
            setOauthProcessing(false);
            return;
        }
        oauthHandledRef.current = true;
        window.history.replaceState({}, document.title, window.location.pathname);
        setOauthProcessing(true);

        const run = async () => {
            setGoogleLoading(true);
            setNaverLoading(true);
            try {
                await loginWithTokens({ accessToken, refreshToken });
                notifySuccess("소셜 로그인 성공!");
            } catch (error) {
                const { extractAuthErrorMessage } = await loadAuthAdapter();
                notifyError(extractAuthErrorMessage(error, "소셜 로그인 처리에 실패했습니다."));
                oauthHandledRef.current = false;
                setOauthProcessing(false);
            } finally {
                setGoogleLoading(false);
                setNaverLoading(false);
            }
        };

        run();
    }, [loginWithTokens]);

    useEffect(() => {
        releaseLoadingRef.current = releaseLoading;
    }, [releaseLoading]);

    useEffect(() => {
        if (!lockInfo) return undefined;
        const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const previousOverflow = document.body.style.overflow;
        const closeLockDialog = () => {
            if (releaseLoadingRef.current) return;
            setLockInfo(null);
        };
        const onKeyDown = (event) => {
            if (event.key === "Escape") {
                closeLockDialog();
                return;
            }
            trapFocus(event, lockDialogRef.current);
        };

        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", onKeyDown);
        window.setTimeout(() => lockCloseBtnRef.current?.focus(), 0);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", onKeyDown);
            if (previousFocus?.isConnected && typeof previousFocus.focus === "function") {
                previousFocus.focus();
            }
        };
    }, [lockInfo]);

    const handleGoogleLogin = () => {
        setGoogleLoading(true);
        window.location.href = "/api/oauth2/authorization/google";
    };

    const handleNaverLogin = () => {
        setNaverLoading(true);
        window.location.href = "/api/oauth2/authorization/naver";
    };

    const closeLockDialog = () => {
        if (releaseLoadingRef.current) return;
        setLockInfo(null);
    };

    if (oauthProcessing) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="card p-8 w-full max-w-md text-center space-y-4">
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600/10 text-primary-600 mx-auto">
                        <Leaf className="h-7 w-7 animate-pulse" />
                    </div>
                    <h1 className="text-xl font-black text-slate-900">소셜 로그인 처리중</h1>
                    <p className="text-sm text-slate-500">잠시만 기다려주세요. 자동으로 이동합니다.</p>
                    <div className="flex items-center justify-center gap-2 text-primary-600 font-bold text-sm">
                        <div className="loading-spinner !w-4 !h-4 !border-2 border-primary-200 border-t-primary-600" />
                        인증 확인중...
                    </div>
                </div>
            </div>
        );
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await login(email, password);
        } catch (error) {
            const { extractAccountLockInfo } = await loadAuthAdapter();
            const nextLockInfo = extractAccountLockInfo(error, email);
            if (nextLockInfo) {
                setLockInfo(nextLockInfo);
            }
            logClientError("login.submit", error);
        } finally {
            setLoading(false);
        }
    };

    const handleReleaseRequest = async () => {
        if (!lockInfo?.email || releaseLoading) return;

        setReleaseLoading(true);
        const toast = await loadToast().catch(() => null);
        const toastId = toast?.loading("해제 요청을 제출하는 중...");
        try {
            const { authAdapter, extractAuthErrorMessage } = await loadAuthAdapter();
            await authAdapter.requestSanctionRelease({ email: lockInfo.email, reason: releaseReason });
            if (toast && toastId) {
                toast.success("해제 요청이 제출되었습니다.", { id: toastId });
            } else {
                notifySuccess("해제 요청이 제출되었습니다.");
            }
            setReleaseReason("");
        } catch (error) {
            const { extractAuthErrorMessage } = await loadAuthAdapter();
            const message = extractAuthErrorMessage(error, "해제 요청 제출에 실패했습니다.");
            if (toast && toastId) {
                toast.error(message, { id: toastId });
            } else {
                notifyError(message);
            }
        } finally {
            setReleaseLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
            <div className="w-full max-w-md relative z-10">
                <div className="text-center mb-10">
                    <BrandMark className="mx-auto mb-6 h-24 max-w-[18rem] transition-transform duration-500 hover:scale-105" />
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-3">
                        로그인
                    </h1>
                    <p className="text-slate-400 font-bold uppercase text-[11px] tracking-[0.3em]">
                        CTFMON community
                    </p>
                </div>

                {/* 로그인 폼 */}
                <div className="card p-10 animate-fade-in bg-white/80 backdrop-blur-xl border-white/50">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                이메일
                            </label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary-500 transition-colors" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="input-base pl-12 h-14 bg-white font-bold"
                                    placeholder="이메일 주소"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                비밀번호
                            </label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary-500 transition-colors" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="input-base pl-12 h-14 bg-white font-bold"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <div className="pt-2 space-y-4">
                            <button
                                type="submit"
                                disabled={loading}
                                aria-busy={loading}
                                className="btn-primary w-full h-14 text-base tracking-tight shadow-xl shadow-primary-200"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-3">
                                        <div className="loading-spinner border-white/30 border-t-white" />
                                        인증 확인 중...
                                    </span>
                                ) : (
                                    "로그인"
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={handleGoogleLogin}
                                disabled={googleLoading}
                                aria-busy={googleLoading}
                                data-busy-indicator="true"
                                className="btn-secondary w-full h-14 flex items-center justify-center gap-3 border-slate-100 hover:border-slate-200"
                            >
                                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="구글" className="h-5 w-5" />
                                <span className="tracking-tight">{googleLoading ? "이동 중..." : "구글로 로그인"}</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleNaverLogin}
                                disabled={naverLoading}
                                aria-busy={naverLoading}
                                data-busy-indicator="true"
                                className="w-full h-14 flex items-center justify-center gap-3 rounded-2xl border border-[#03c75a] bg-[#03c75a] px-4 font-black text-white shadow-sm transition-all hover:bg-[#02b351] disabled:cursor-wait disabled:opacity-70"
                            >
                                <span className="flex h-5 w-5 items-center justify-center rounded bg-white text-sm font-black text-[#03c75a]">N</span>
                                <span className="tracking-tight">{naverLoading ? "이동 중..." : "네이버로 로그인"}</span>
                            </button>
                        </div>
                    </form>

                    <div className="mt-10 pt-8 border-t border-slate-50 text-center">
                        <p className="text-sm font-medium text-slate-400">
                            처음이신가요?{" "}
                            <Link
                                to="/register"
                                className="font-black text-primary-600 hover:text-primary-700 underline underline-offset-4 decoration-primary-200"
                            >
                                회원가입
                            </Link>
                        </p>
                    </div>
                </div>
            </div>

            {lockInfo && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) closeLockDialog();
                    }}
                >
                    <div
                        ref={lockDialogRef}
                        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={lockDialogTitleId}
                        aria-describedby={lockDialogDescriptionId}
                    >
                        <h2 id={lockDialogTitleId} className="text-xl font-black text-slate-900">계정 이용 제한</h2>
                        <p id={lockDialogDescriptionId} className="mt-2 text-sm text-slate-600">
                            현재 이 계정은 제재 상태입니다. 아래 내용을 확인하고 필요하면 해제를 요청하세요.
                        </p>

                        <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                            <div><b>이메일:</b> {lockInfo.email}</div>
                            <div><b>사유:</b> {lockInfo.reason}</div>
                            <div><b>시작:</b> {formatDateTime(lockInfo.startsAt)}</div>
                            <div><b>종료:</b> {formatDateTime(lockInfo.endsAt)}</div>
                        </div>

                        <label htmlFor={lockReleaseReasonId} className="sr-only">해제 요청 사유</label>
                        <textarea
                            id={lockReleaseReasonId}
                            className="input-base mt-4 min-h-[88px] w-full"
                            value={releaseReason}
                            onChange={(e) => setReleaseReason(e.target.value)}
                            placeholder="해제 검토에 필요한 내용을 입력하세요. (선택)"
                            maxLength={500}
                        />

                        <div className="mt-4 flex gap-2">
                            <button
                                ref={lockCloseBtnRef}
                                type="button"
                                autoFocus
                                className="btn-secondary flex-1"
                                onClick={closeLockDialog}
                                disabled={releaseLoading}
                            >
                                닫기
                            </button>
                            <button
                                type="button"
                                className="btn-primary flex-1"
                                onClick={handleReleaseRequest}
                                disabled={releaseLoading}
                                aria-busy={releaseLoading}
                                data-busy-indicator="true"
                            >
                                {releaseLoading ? "제출 중..." : "해제 요청"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
