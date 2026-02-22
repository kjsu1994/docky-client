import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Lock, Leaf } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export const Login = () => {
    const [email, setEmail] = useState("user@gmail.com");
    const [password, setPassword] = useState("qwer1234");
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const { login, loginWithTokens } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const accessToken = params.get("accessToken");
        const refreshToken = params.get("refreshToken");
        const oauthError = params.get("error");

        if (oauthError) {
            toast.error("구글 로그인에 실패했습니다.");
            return;
        }

        if (!accessToken) return;

        const run = async () => {
            setGoogleLoading(true);
            try {
                await loginWithTokens({ accessToken, refreshToken });
                toast.success("구글 로그인 성공!");
                navigate("/app", { replace: true });
            } catch (error) {
                toast.error(error.response?.data?.message || "구글 로그인 처리에 실패했습니다.");
            } finally {
                setGoogleLoading(false);
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        };

        run();
    }, [loginWithTokens, navigate]);

    const handleGoogleLogin = () => {
        window.location.href = "/api/oauth2/authorization/google";
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await login(email, password);
        } catch (error) {
            console.error("Login error:", error);
        } finally {
            setLoading(false);
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
                        NEXT GEN
                    </h1>
                    <p className="text-slate-400 font-bold uppercase text-[11px] tracking-[0.3em]">
                        Experience the Future
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
        </div>
    );
};
