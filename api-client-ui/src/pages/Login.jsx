import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginMember } from "../api/members";

export default function Login() {
    const navigate = useNavigate();

    const [form, setForm] = useState({
        email: "codestates1@gmail.com",
        password: "abcd1234",
    });

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState("");

    const onChange = (e) => {
        const { name, value } = e.target;
        setForm((p) => ({ ...p, [name]: value }));
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setResult(null);

        try {
            const result = await loginMember(form);

            // 1) result 자체가 null/undefined면 즉시 중단
            if (!result) {
                throw new Error("loginMember() 반환값이 null 입니다. members.js의 return 누락/import 불일치 확인 필요");
            }

            // 2) 토큰이 없으면(Authorization 헤더를 못 읽은 케이스 포함) 중단
            if (!result.accessToken) {
                throw new Error(
                    "로그인 응답에서 accessToken을 찾지 못했습니다. (Authorization 헤더 노출(CORS Expose-Headers) 또는 파싱 로직 확인 필요)"
                );
            }

            // 3) accessToken 저장
            localStorage.setItem("accessToken", result.accessToken);

            // 4) refreshToken 저장 (있는 경우)
            if (result.refreshToken) {
                localStorage.setItem("refreshToken", result.refreshToken);
            }

            // 5) memberId 저장
            if (result.memberId) {
                localStorage.setItem("memberId", String(result.memberId));
            }

            // 6) 이동
            navigate("/app", { replace: true });

        } catch (err) {
            const msg =
                err?.response?.data?.message ||
                err?.response?.statusText ||
                err.message;
            setError(String(msg));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="border-b bg-white">
                <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-slate-900 text-white grid place-items-center font-bold">
                            CS
                        </div>
                        <div>
                            <div className="text-sm font-semibold text-slate-900">
                                Community API Client
                            </div>
                            <div className="text-xs text-slate-500">
                                Backend API를 화면으로 검증/사용
                            </div>
                        </div>
                    </div>

                    <div className="text-xs text-slate-500">
                        POST <span className="font-mono">/members/login</span>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-6xl px-4 py-10">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <section className="lg:col-span-2">
                        <div className="rounded-2xl border bg-white shadow-sm">
                            <div className="p-6 border-b">
                                <h1 className="text-xl font-bold text-slate-900">로그인</h1>
                                <p className="mt-1 text-sm text-slate-600">
                                    회원 로그인 API를 UI로 실행합니다. (테스트/관리용)
                                </p>
                            </div>

                            <form onSubmit={onSubmit} className="p-6 space-y-5">
                                <Field label="Email" hint="예: codestates1@gmail.com">
                                    <input
                                        name="email"
                                        value={form.email}
                                        onChange={onChange}
                                        placeholder="codestates1@gmail.com"
                                        className={inputClass}
                                        autoComplete="email"
                                    />
                                </Field>

                                <Field label="Password" hint="예: abcd1234">
                                    <input
                                        type="password"
                                        name="password"
                                        value={form.password}
                                        onChange={onChange}
                                        placeholder="••••••••"
                                        className={inputClass}
                                        autoComplete="current-password"
                                    />
                                </Field>

                                <div className="flex items-center gap-3">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {loading ? "로그인 중..." : "로그인"}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => navigate("/members/create")}
                                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        회원가입
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setForm({email: "", password: ""});
                                            setError("");
                                            setResult(null);
                                        }}
                                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        초기화
                                    </button>

                                    <div className="ml-auto text-xs text-slate-500">
                                        API: <span className="font-mono">http://localhost:8080</span>
                                    </div>
                                </div>

                                {error && (
                                    <div
                                        className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                        <div className="font-semibold mb-1">요청 실패</div>
                                        <div className="break-words">{error}</div>
                                    </div>
                                )}
                            </form>
                        </div>
                    </section>

                    <aside className="lg:col-span-1 space-y-6">
                        <div className="rounded-2xl border bg-white shadow-sm">
                            <div className="p-6 border-b">
                                <div className="text-sm font-semibold text-slate-900">
                                    응답(JSON)
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                    API 응답을 그대로 표시합니다.
                                </div>
                            </div>

                            <div className="p-6">
                                {!result ? (
                                    <div className="text-sm text-slate-500">
                                        아직 응답이 없습니다. 로그인 버튼을 눌러보세요.
                                    </div>
                                ) : (
                                    <pre className="text-xs rounded-xl bg-slate-900 text-slate-100 p-4 overflow-auto max-h-[360px]">
{JSON.stringify(result, null, 2)}
                  </pre>
                                )}
                            </div>
                        </div>

                        <div className="rounded-2xl border bg-white shadow-sm">
                            <div className="p-6 border-b">
                                <div className="text-sm font-semibold text-slate-900">다음 작업 추천</div>
                                <div className="mt-1 text-xs text-slate-500">로그인 이후 확장 순서</div>
                            </div>

                            <div className="p-6 space-y-3 text-sm text-slate-700">
                                <Step n="1" text="토큰 저장 + 보호 API 호출 테스트" />
                                <Step n="2" text="메인(/app)에서 회원정보 조회 화면" />
                                <Step n="3" text="로그아웃 + 토큰 만료 처리" />
                                <Step n="4" text="게시판/댓글 화면 보호 라우팅 적용" />
                            </div>
                        </div>
                    </aside>
                </div>
            </main>
        </div>
    );
}

function Field({ label, hint, children }) {
    return (
        <div>
            <div className="flex items-baseline justify-between">
                <label className="block text-sm font-semibold text-slate-800">{label}</label>
                {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
            </div>
            <div className="mt-2">{children}</div>
        </div>
    );
}

function Step({ n, text }) {
    return (
        <div className="flex items-start gap-3">
            <div className="h-6 w-6 rounded-lg bg-slate-100 text-slate-900 grid place-items-center text-xs font-bold border">
                {n}
            </div>
            <div className="leading-6">{text}</div>
        </div>
    );
}

const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300";
