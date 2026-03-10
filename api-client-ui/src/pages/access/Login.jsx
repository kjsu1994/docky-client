import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Lock, Leaf } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import toast from "react-hot-toast";
import api from "../../utils/api.js";

export const Login = () => {
    const [oauthProcessing, setOauthProcessing] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return Boolean(
            params.get("accessToken") ||
            params.get("access_token") ||
            params.get("error")
        );
    });
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [lockInfo, setLockInfo] = useState(null);
    const [releaseReason, setReleaseReason] = useState("");
    const [releaseLoading, setReleaseLoading] = useState(false);
    const { login, loginWithTokens } = useAuth();
    const oauthHandledRef = useRef(false);
    const lockCloseBtnRef = useRef(null);

    const formatDateTime = (value) => {
        if (!value) return "No end date";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return date.toLocaleString();
    };

    useEffect(() => {
        if (oauthHandledRef.current) return;

        const params = new URLSearchParams(window.location.search);
        const accessToken = params.get("accessToken") || params.get("access_token");
        const refreshToken = params.get("refreshToken") || params.get("refresh_token");
        const oauthError = params.get("error");

        if (oauthError) {
            toast.error("구글 로그인에 실패했습니다.");
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
            try {
                await loginWithTokens({ accessToken, refreshToken });
                toast.success("구글 로그인 성공!");
            } catch (error) {
                toast.error(error.response?.data?.message || "구글 로그인 처리에 실패했습니다.");
                oauthHandledRef.current = false;
                setOauthProcessing(false);
            } finally {
                setGoogleLoading(false);
            }
        };

        run();
    }, [loginWithTokens]);

    useEffect(() => {
        if (!lockInfo) return;
        const onKeyDown = (e) => {
            if (e.key === "Escape") setLockInfo(null);
        };
        window.addEventListener("keydown", onKeyDown);
        window.setTimeout(() => lockCloseBtnRef.current?.focus(), 0);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [lockInfo]);

    const handleGoogleLogin = () => {
        setGoogleLoading(true);
        window.location.href = "/api/oauth2/authorization/google";
    };

    if (oauthProcessing) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="card p-8 w-full max-w-md text-center space-y-4">
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600/10 text-primary-600 mx-auto">
                        <Leaf className="h-7 w-7 animate-pulse" />
                    </div>
                    <h1 className="text-xl font-black text-slate-900">구글 로그인 처리중</h1>
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
            const data = error?.response?.data;
            if (data?.code === "ACCOUNT_LOCKED") {
                setLockInfo({
                    email,
                    reason: data?.sanction_info?.reason || "No reason provided",
                    startsAt: data?.sanction_info?.startsAt || data?.sanction_info?.starts_at || null,
                    endsAt: data?.sanction_info?.endsAt || data?.sanction_info?.ends_at || null,
                });
            }
            console.error("Login error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleReleaseRequest = async () => {
        if (!lockInfo?.email || releaseLoading) return;

        const toastId = toast.loading("Submitting release request...");
        setReleaseLoading(true);
        try {
            await api.post("/sanctions/release-request", {
                email: lockInfo.email,
                request_reason: releaseReason.trim() || undefined,
            });
            toast.success("Release request submitted.", { id: toastId });
            setReleaseReason("");
        } catch (error) {
            toast.error(error?.response?.data?.message || "Failed to submit release request.", { id: toastId });
        } finally {
            setReleaseLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background decorative elements */}
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary-100/50 rounded-full blur-3xl opacity-50" />
            <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-sky-100/50 rounded-full blur-3xl opacity-50" />

            <div className="w-full max-w-md relative z-10">
                {/* 로고 & 타이틀 */}
                <div className="text-center mb-10">
                    <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-primary-600 to-primary-400 text-white mb-6 shadow-2xl shadow-primary-200 group hover:scale-110 transition-transform duration-500">
                        <span className="text-3xl font-black italic tracking-tighter">C</span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-3">
                        Welcome
                    </h1>
                    <p className="text-slate-400 font-bold uppercase text-[11px] tracking-[0.3em]">
                        벌꿀오소리 커뮤니티
                    </p>
                </div>

                {/* 로그인 폼 */}
                <div className="card p-10 animate-fade-in bg-white/80 backdrop-blur-xl border-white/50">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                Email Address
                            </label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary-500 transition-colors" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="input-base pl-12 h-14 bg-white font-bold"
                                    placeholder="your@email.com"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                Secure Password
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
                                        AUTHENTICATING...
                                    </span>
                                ) : (
                                    "CONTINUE SIGN IN"
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
                                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="h-5 w-5" />
                                <span className="tracking-tight">{googleLoading ? "REDIRECTING..." : "LOG IN WITH GOOGLE"}</span>
                            </button>
                        </div>
                    </form>

                    <div className="mt-10 pt-8 border-t border-slate-50 text-center">
                        <p className="text-sm font-medium text-slate-400">
                            New to our platform?{" "}
                            <Link
                                to="/register"
                                className="font-black text-primary-600 hover:text-primary-700 underline underline-offset-4 decoration-primary-200"
                            >
                                CREATE ACCOUNT
                            </Link>
                        </p>
                    </div>
                </div>
            </div>

            {lockInfo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
                        <h2 className="text-xl font-black text-slate-900">Account Locked</h2>
                        <p className="mt-2 text-sm text-slate-600">
                            This account is currently sanctioned. Please review the details below.
                        </p>

                        <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                            <div><b>Email:</b> {lockInfo.email}</div>
                            <div><b>Reason:</b> {lockInfo.reason}</div>
                            <div><b>Start:</b> {formatDateTime(lockInfo.startsAt)}</div>
                            <div><b>End:</b> {formatDateTime(lockInfo.endsAt)}</div>
                        </div>

                        <textarea
                            className="input-base mt-4 min-h-[88px] w-full"
                            value={releaseReason}
                            onChange={(e) => setReleaseReason(e.target.value)}
                            placeholder="Add a message for release review (optional)"
                            maxLength={500}
                        />

                        <div className="mt-4 flex gap-2">
                            <button
                                ref={lockCloseBtnRef}
                                type="button"
                                className="btn-secondary flex-1"
                                onClick={() => setLockInfo(null)}
                                disabled={releaseLoading}
                            >
                                Close
                            </button>
                            <button
                                type="button"
                                className="btn-primary flex-1"
                                onClick={handleReleaseRequest}
                                disabled={releaseLoading}
                                aria-busy={releaseLoading}
                                data-busy-indicator="true"
                            >
                                {releaseLoading ? "Submitting..." : "Request Release"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
