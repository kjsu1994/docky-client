import { useState } from "react";
import { createMember } from "../api/members";
import { useNavigate } from "react-router-dom";

export default function MemberCreate() {
    const navigate = useNavigate();

    const [form, setForm] = useState({
        email: "",
        password: "",
        name: "",
        phone: "",
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
            const data = await createMember(form);
            setResult(data);
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
            {/* Top bar */}
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
                        POST <span className="font-mono">/members</span>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="mx-auto max-w-6xl px-4 py-10">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Card */}
                    <section className="lg:col-span-2">
                        <div className="rounded-2xl border bg-white shadow-sm">
                            <div className="p-6 border-b">
                                <h1 className="text-xl font-bold text-slate-900">회원 생성</h1>
                                <p className="mt-1 text-sm text-slate-600">
                                    회원 생성 API를 UI로 실행합니다. (테스트/관리용)
                                </p>
                            </div>

                            <form onSubmit={onSubmit} className="p-6 space-y-5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label="Email" hint="예: user@example.com">
                                        <input
                                            name="email"
                                            value={form.email}
                                            onChange={onChange}
                                            placeholder="user@example.com"
                                            className={inputClass}
                                            autoComplete="email"
                                        />
                                    </Field>

                                    <Field label="Phone" hint="예: 010-1234-5678">
                                        <input
                                            name="phone"
                                            value={form.phone}
                                            onChange={onChange}
                                            placeholder="010-1234-5678"
                                            className={inputClass}
                                            autoComplete="tel"
                                        />
                                    </Field>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label="Name" hint="표시 이름">
                                        <input
                                            name="name"
                                            value={form.name}
                                            onChange={onChange}
                                            placeholder="홍길동"
                                            className={inputClass}
                                            autoComplete="name"
                                        />
                                    </Field>

                                    <Field label="Password" hint="8자 이상 권장">
                                        <input
                                            type="password"
                                            name="password"
                                            value={form.password}
                                            onChange={onChange}
                                            placeholder="••••••••"
                                            className={inputClass}
                                            autoComplete="new-password"
                                        />
                                    </Field>
                                </div>

                                <div className="flex items-center gap-3">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {loading ? "생성 중..." : "회원 생성"}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => navigate("/login")}
                                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        로그인으로
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setForm({email: "", password: "", name: "", phone: ""});
                                            setError("");
                                            setResult(null);
                                        }}
                                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        초기화
                                    </button>

                                    <div className="ml-auto text-xs text-slate-500">
                                        Docker:{" "}
                                        <span className="font-mono">http://localhost:5174</span>
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

                    {/* Right: Result */}
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
                                        아직 응답이 없습니다. 회원 생성 버튼을 눌러보세요.
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
                                <div className="text-sm font-semibold text-slate-900">
                                    다음 작업 추천
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                    API 화면을 빠르게 확장하는 순서
                                </div>
                            </div>

                            <div className="p-6 space-y-3 text-sm text-slate-700">
                                <Step n="1" text="회원 목록(GET /members) 테이블 만들기" />
                                <Step n="2" text="로그인(POST) + JWT 저장" />
                                <Step n="3" text="보호 API 호출 시 Authorization 자동 첨부" />
                                <Step n="4" text="게시판/댓글/파일 업로드 화면 확장" />
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
                <label className="block text-sm font-semibold text-slate-800">
                    {label}
                </label>
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
