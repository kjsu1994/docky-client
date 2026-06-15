import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, Phone, ShieldCheck, User } from "lucide-react";
import { BrandMark } from "../../common/BrandLogo.jsx";
import { notifyError, notifySuccess } from "../../utils/toast.js";
import { logClientError } from "../../utils/clientDiagnostics.js";

const loadAuthAdapter = () => import("../../adapters/authAdapter.js");
const RESEND_COOLDOWN_SECONDS = 60;

const formatPhoneNumber = (rawValue) => {
    const digits = rawValue.replace(/\D/g, "").slice(0, 11);
    if (digits.length < 4) return digits;
    if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
};

export const AccountRecovery = ({ initialMode = "find-id" }) => {
    const navigate = useNavigate();
    const [mode, setMode] = useState(initialMode === "password-reset" ? "password-reset" : "find-id");
    const [findForm, setFindForm] = useState({ name: "", phone: "" });
    const [findLoading, setFindLoading] = useState(false);
    const [findResult, setFindResult] = useState(null);
    const [resetEmail, setResetEmail] = useState("");
    const [resetCode, setResetCode] = useState("");
    const [resetStep, setResetStep] = useState("email");
    const [resetLoading, setResetLoading] = useState(false);
    const [resetStatus, setResetStatus] = useState("");
    const [resendCooldown, setResendCooldown] = useState(0);

    useEffect(() => {
        setMode(initialMode === "password-reset" ? "password-reset" : "find-id");
    }, [initialMode]);

    useEffect(() => {
        if (resendCooldown <= 0) return undefined;
        const timer = window.setInterval(() => {
            setResendCooldown((current) => (current > 0 ? current - 1 : 0));
        }, 1000);
        return () => window.clearInterval(timer);
    }, [resendCooldown]);

    const normalizedEmail = resetEmail.trim();
    const emailValid = /\S+@\S+\.\S+/.test(normalizedEmail);
    const codeReady = /^\d{6}$/.test(resetCode.trim());
    const findReady = findForm.name.trim().length > 0 && /^010-\d{3,4}-\d{4}$/.test(findForm.phone);

    const title = useMemo(() => (mode === "find-id" ? "아이디 찾기" : "비밀번호 찾기"), [mode]);

    const switchMode = (nextMode) => {
        setMode(nextMode);
        navigate(nextMode === "find-id" ? "/account-recovery/find-id" : "/account-recovery/password-reset", { replace: true });
    };

    const handleFindSubmit = async (event) => {
        event.preventDefault();
        if (!findReady || findLoading) return;
        setFindLoading(true);
        setFindResult(null);
        try {
            const { authAdapter } = await loadAuthAdapter();
            const result = await authAdapter.findLoginId({
                name: findForm.name.trim(),
                phone: findForm.phone,
            });
            setFindResult(result);
        } catch (error) {
            const { extractAuthErrorMessage } = await loadAuthAdapter();
            notifyError(extractAuthErrorMessage(error, "아이디 찾기 요청에 실패했습니다."));
            logClientError("accountRecovery.findId", error);
        } finally {
            setFindLoading(false);
        }
    };

    const handleSendResetCode = async (event) => {
        event.preventDefault();
        if (!emailValid || resetLoading || resendCooldown > 0) return;
        setResetLoading(true);
        setResetStatus("");
        try {
            const { authAdapter } = await loadAuthAdapter();
            const result = await authAdapter.sendPasswordResetVerification(normalizedEmail);
            setResetStep("code");
            setResetCode("");
            setResendCooldown(RESEND_COOLDOWN_SECONDS);
            setResetStatus(result?.message || "입력한 정보가 일치하면 이메일로 안내를 보냈습니다.");
            notifySuccess("인증 안내를 보냈습니다.");
        } catch (error) {
            const { extractAuthErrorMessage } = await loadAuthAdapter();
            const message = extractAuthErrorMessage(error, "인증 안내 발송에 실패했습니다.");
            setResetStatus(message);
            notifyError(message);
            logClientError("accountRecovery.sendResetCode", error);
        } finally {
            setResetLoading(false);
        }
    };

    const handleConfirmResetCode = async (event) => {
        event.preventDefault();
        if (!emailValid || !codeReady || resetLoading) return;
        setResetLoading(true);
        setResetStatus("");
        try {
            const { authAdapter } = await loadAuthAdapter();
            await authAdapter.confirmPasswordResetVerification({ email: normalizedEmail, code: resetCode.trim() });
            const issued = await authAdapter.issueTemporaryPassword(normalizedEmail);
            setResetStep("done");
            setResetStatus(issued?.message || "임시 비밀번호를 이메일로 발급했습니다.");
            notifySuccess("임시 비밀번호를 이메일로 발급했습니다.");
        } catch (error) {
            const { extractAuthErrorMessage } = await loadAuthAdapter();
            const message = extractAuthErrorMessage(error, "인증 확인에 실패했습니다.");
            setResetStatus(message);
            notifyError(message);
            logClientError("accountRecovery.confirmResetCode", error);
        } finally {
            setResetLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-transparent flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
            <div className="bg-vibe" />
            <div className="w-full max-w-md relative z-10 py-8">
                <div className="text-center mb-8">
                    <BrandMark className="mx-auto mb-5 h-20 sm:h-24 max-w-[17rem]" />
                    <h1 className="text-3xl sm:text-4xl font-black text-ink tracking-tight mb-3">{title}</h1>
                    <p className="text-ink-subtle font-bold uppercase text-[11px] tracking-[0.24em]">Docky account</p>
                </div>

                <div className="surface-panel motion-panel-in p-6 sm:p-10">
                    <div className="mb-6 grid grid-cols-2 rounded-panel bg-control p-1">
                        <button
                            type="button"
                            onClick={() => switchMode("find-id")}
                            className={`h-11 rounded-xl text-sm font-black transition ${
                                mode === "find-id" ? "bg-surface text-primary-600 shadow-card" : "text-ink-muted"
                            }`}
                        >
                            아이디 찾기
                        </button>
                        <button
                            type="button"
                            onClick={() => switchMode("password-reset")}
                            className={`h-11 rounded-xl text-sm font-black transition ${
                                mode === "password-reset" ? "bg-surface text-primary-600 shadow-card" : "text-ink-muted"
                            }`}
                        >
                            비밀번호 찾기
                        </button>
                    </div>

                    {mode === "find-id" ? (
                        <form onSubmit={handleFindSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-ink-subtle uppercase tracking-widest ml-1">이름</label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ink-subtle group-focus-within:text-primary-500 transition-colors" />
                                    <input
                                        type="text"
                                        value={findForm.name}
                                        onChange={(event) => setFindForm((prev) => ({ ...prev, name: event.target.value }))}
                                        className="input-base pl-12 h-14 font-bold"
                                        placeholder="가입한 이름"
                                        autoComplete="name"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-ink-subtle uppercase tracking-widest ml-1">전화번호</label>
                                <div className="relative group">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ink-subtle group-focus-within:text-primary-500 transition-colors" />
                                    <input
                                        type="tel"
                                        value={findForm.phone}
                                        onChange={(event) => setFindForm((prev) => ({ ...prev, phone: formatPhoneNumber(event.target.value) }))}
                                        className="input-base pl-12 h-14 font-bold"
                                        placeholder="010-0000-0000"
                                        inputMode="numeric"
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={!findReady || findLoading}
                                aria-busy={findLoading}
                                className="btn-primary w-full h-14 text-base tracking-tight shadow-xl shadow-primary-200"
                            >
                                {findLoading ? "확인 중..." : "아이디 확인"}
                            </button>

                            {findResult && (
                                <div className="surface-card p-4">
                                    <p className="text-sm font-bold text-ink-muted">{findResult.message}</p>
                                    {findResult.maskedEmails.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            {findResult.maskedEmails.map((maskedEmail) => (
                                                <div key={maskedEmail} className="rounded-card bg-surface px-4 py-3 text-sm font-black text-ink shadow-card">
                                                    {maskedEmail}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </form>
                    ) : (
                        <form onSubmit={resetStep === "email" ? handleSendResetCode : handleConfirmResetCode} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-ink-subtle uppercase tracking-widest ml-1">이메일</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ink-subtle group-focus-within:text-primary-500 transition-colors" />
                                    <input
                                        type="email"
                                        value={resetEmail}
                                        onChange={(event) => {
                                            setResetEmail(event.target.value);
                                            setResetStep("email");
                                            setResetCode("");
                                            setResetStatus("");
                                        }}
                                        className="input-base pl-12 h-14 font-bold"
                                        placeholder="가입한 이메일"
                                        autoComplete="email"
                                    />
                                </div>
                            </div>

                            {resetStep !== "email" && (
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-ink-subtle uppercase tracking-widest ml-1">인증번호</label>
                                    <div className="relative group">
                                        <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ink-subtle group-focus-within:text-primary-500 transition-colors" />
                                        <input
                                            type="text"
                                            value={resetCode}
                                            onChange={(event) => setResetCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                                            className="input-base pl-12 h-14 font-bold tracking-[0.3em]"
                                            placeholder="123456"
                                            inputMode="numeric"
                                            disabled={resetStep === "done"}
                                        />
                                    </div>
                                </div>
                            )}

                            {resetStatus && (
                                <div className="surface-card p-4 text-sm font-bold text-ink-muted">
                                    {resetStatus}
                                </div>
                            )}

                            {resetStep === "done" ? (
                                <Link to="/login" className="btn-primary flex h-14 w-full items-center justify-center text-base tracking-tight shadow-xl shadow-primary-200">
                                    로그인으로 이동
                                </Link>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={resetLoading || !emailValid || (resetStep === "code" && !codeReady) || (resetStep === "email" && resendCooldown > 0)}
                                    aria-busy={resetLoading}
                                    className="btn-primary w-full h-14 text-base tracking-tight shadow-xl shadow-primary-200"
                                >
                                    {resetLoading
                                        ? "처리 중..."
                                        : resetStep === "email"
                                          ? resendCooldown > 0
                                            ? `${resendCooldown}초 후 재요청`
                                            : "인증 안내 받기"
                                          : "인증 후 임시 비밀번호 발급"}
                                </button>
                            )}
                        </form>
                    )}

                    <div className="mt-8 pt-6 border-t border-line">
                        <Link to="/login" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-control bg-control text-sm font-black text-ink-muted hover:bg-control-hover">
                            <ArrowLeft className="h-4 w-4" />
                            로그인으로 돌아가기
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccountRecovery;
