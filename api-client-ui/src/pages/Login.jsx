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
        <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* 로고 & 타이틀 */}
                <div className="text-center mb-8">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 text-white mb-4 shadow-lg">
                        <Leaf className="h-8 w-8" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">
                        벌꿀오소리 커뮤니티
                    </h1>
                    <p className="text-slate-600">
                        이것저것 사부작해보는 공간
                    </p>
                </div>

                {/* 로그인 폼 */}
                <div className="card p-8 animate-fade-in">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                이메일
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="input-base pl-11"
                                    placeholder="example@email.com"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                비밀번호
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="input-base pl-11"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                  <div className="loading-spinner" />
                  로그인 중...
                </span>
                            ) : (
                                "로그인"
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            disabled={googleLoading}
                            className="btn-secondary w-full flex items-center justify-center gap-2"
                        >
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white border border-slate-200 text-[11px] font-bold text-slate-700">
                                G
                            </span>
                            {googleLoading ? "구글 로그인 처리 중..." : "Google로 로그인"}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t text-center">
                        <p className="text-sm text-slate-600">
                            계정이 없으신가요?{" "}
                            <Link
                                to="/register"
                                className="font-semibold text-primary-600 hover:text-primary-700"
                            >
                                회원가입
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
