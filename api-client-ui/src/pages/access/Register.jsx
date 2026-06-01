import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Lock, User, Phone, MapPin, ShieldCheck, X } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import toast from "react-hot-toast";
import { AddressSearchBox } from "../../common/AddressSearchBox.jsx";
import { authAdapter, extractAuthErrorMessage, getAuthErrorCode } from "../../adapters/authAdapter.js";

const RESEND_COOLDOWN_SECONDS = 60;
const MAX_CONFIRM_FAILURES = 5;

const parseRetrySeconds = (message, fallbackSeconds = RESEND_COOLDOWN_SECONDS) => {
    const match = String(message || "").match(/(\d+)\s*seconds?/i);
    if (!match) {
        return fallbackSeconds;
    }
    return Number(match[1]);
};

export const Register = () => {
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        confirmPassword: "",
        name: "",
        phone: "",
        address: "",
        addressDetail: "",
    });
    const [verificationCode, setVerificationCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [checkingEmail, setCheckingEmail] = useState(false);
    const [sendingVerification, setSendingVerification] = useState(false);
    const [confirmingVerification, setConfirmingVerification] = useState(false);
    const [emailAvailable, setEmailAvailable] = useState(null);
    const [checkedEmail, setCheckedEmail] = useState("");
    const [verifiedEmail, setVerifiedEmail] = useState("");
    const [verificationStatus, setVerificationStatus] = useState("");
    const [resendCooldown, setResendCooldown] = useState(0);
    const [remainingAttempts, setRemainingAttempts] = useState(null);
    const [errors, setErrors] = useState({});
    const [addressModalOpen, setAddressModalOpen] = useState(false);
    const { register } = useAuth();

    useEffect(() => {
        if (resendCooldown <= 0) {
            return undefined;
        }

        const timer = window.setInterval(() => {
            setResendCooldown((current) => (current > 0 ? current - 1 : 0));
        }, 1000);

        return () => window.clearInterval(timer);
    }, [resendCooldown]);

    const normalizedEmail = formData.email.trim();
    const hasConfirmValue = formData.confirmPassword.length > 0;
    const passwordsMatch = hasConfirmValue && formData.password === formData.confirmPassword;
    const passwordsMismatch = hasConfirmValue && !passwordsMatch;
    const emailFormatValid = /\S+@\S+\.\S+/.test(formData.email);
    const passwordValid = formData.password.length >= 8;
    const nameValid = formData.name.trim().length > 0;
    const phoneValid = formData.phone.trim().length > 0;
    const emailChecked = checkedEmail === normalizedEmail && emailAvailable === true;
    const emailVerified = verifiedEmail === normalizedEmail;
    const codeReady = /^\d{6}$/.test(verificationCode.trim());

    const submitBlockMessage = !formData.email
        ? "이메일을 입력해 주세요."
        : !emailFormatValid
          ? "올바른 이메일 주소를 입력해 주세요."
          : !emailChecked
            ? "이메일 중복 확인을 먼저 완료해 주세요."
            : !emailVerified
              ? "회원가입 전에 이메일 인증을 완료해 주세요."
              : !passwordValid
                ? "비밀번호는 8자 이상이어야 합니다."
                : !passwordsMatch
                  ? "비밀번호가 일치하지 않습니다."
                  : !nameValid
                    ? "이름을 입력해 주세요."
                    : !phoneValid
                      ? "전화번호를 입력해 주세요."
                      : "";
    const canSubmit = !loading && !submitBlockMessage;

    const formatPhoneNumber = (rawValue) => {
        const digits = rawValue.replace(/\D/g, "").slice(0, 11);
        if (digits.length < 4) return digits;
        if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
        return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    };

    const resetVerificationState = () => {
        setVerifiedEmail("");
        setVerificationCode("");
        setVerificationStatus("");
        setResendCooldown(0);
        setRemainingAttempts(null);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        const nextValue = name === "phone" ? formatPhoneNumber(value) : value;
        setFormData((prev) => ({ ...prev, [name]: nextValue }));

        if (name === "email") {
            setCheckedEmail("");
            setEmailAvailable(null);
            resetVerificationState();
        }

        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: "" }));
        }

        if ((name === "password" || name === "confirmPassword") && errors.confirmPassword) {
            setErrors((prev) => ({ ...prev, confirmPassword: "" }));
        }
    };

    const handleCheckDuplicate = async () => {
        if (!normalizedEmail) {
            setErrors((prev) => ({ ...prev, email: "이메일을 먼저 입력해 주세요." }));
            return;
        }

        if (!emailFormatValid) {
            setErrors((prev) => ({ ...prev, email: "이메일 형식이 올바르지 않습니다." }));
            return;
        }

        setCheckingEmail(true);
        try {
            const payload = await authAdapter.checkEmailAvailability(normalizedEmail);
            const available = payload.available;

            setCheckedEmail(normalizedEmail);
            setEmailAvailable(available);
            resetVerificationState();

            if (available) {
                setErrors((prev) => ({ ...prev, email: "" }));
                toast.success("사용 가능한 이메일입니다.");
            } else {
                setErrors((prev) => ({ ...prev, email: "이미 사용 중인 이메일입니다." }));
                toast.error("이미 사용 중인 이메일입니다.");
            }
        } catch (error) {
            setCheckedEmail("");
            setEmailAvailable(null);
            resetVerificationState();
            const message = extractAuthErrorMessage(error, "이메일 확인에 실패했습니다.");
            setErrors((prev) => ({ ...prev, email: message }));
            toast.error(message);
        } finally {
            setCheckingEmail(false);
        }
    };

    const handleSendVerification = async () => {
        if (!emailChecked) {
            toast.error("이메일 중복 확인을 먼저 완료해 주세요.");
            return;
        }

        if (resendCooldown > 0) {
            toast.error(`${resendCooldown}초 후에 다시 보낼 수 있습니다.`);
            return;
        }

        setSendingVerification(true);
        try {
            await authAdapter.sendEmailVerification(normalizedEmail);
            setVerifiedEmail("");
            setRemainingAttempts(MAX_CONFIRM_FAILURES);
            setResendCooldown(RESEND_COOLDOWN_SECONDS);
            setVerificationStatus("인증번호를 보냈습니다. 받은 편지함과 스팸함을 확인해 주세요.");
            setErrors((prev) => ({ ...prev, verificationCode: "" }));
            toast.success("인증번호를 보냈습니다.");
        } catch (error) {
            const message = extractAuthErrorMessage(error, "인증번호 전송에 실패했습니다.");
            if (getAuthErrorCode(error) === "EMAIL_VERIFICATION_REQUEST_RATE_LIMITED") {
                const waitSeconds = parseRetrySeconds(message);
                setResendCooldown(waitSeconds);
            }
            setVerificationStatus(message);
            toast.error(message);
        } finally {
            setSendingVerification(false);
        }
    };

    const handleConfirmVerification = async () => {
        const code = verificationCode.trim();
        if (!emailChecked) {
            toast.error("이메일 중복 확인을 먼저 완료해 주세요.");
            return;
        }
        if (!/^\d{6}$/.test(code)) {
            setErrors((prev) => ({ ...prev, verificationCode: "인증번호는 6자리 숫자여야 합니다." }));
            return;
        }

        setConfirmingVerification(true);
        try {
            await authAdapter.confirmEmailVerification({ email: normalizedEmail, code });
            setVerifiedEmail(normalizedEmail);
            setRemainingAttempts(MAX_CONFIRM_FAILURES);
            setVerificationStatus("이메일 인증이 완료되었습니다.");
            setErrors((prev) => ({ ...prev, verificationCode: "" }));
            toast.success("이메일 인증이 완료되었습니다.");
        } catch (error) {
            const codeValue = getAuthErrorCode(error);
            const message = extractAuthErrorMessage(error, "인증번호 확인에 실패했습니다.");
            setVerifiedEmail("");

            if (codeValue === "EMAIL_VERIFICATION_CODE_INVALID") {
                setRemainingAttempts((current) => {
                    const next = (current ?? MAX_CONFIRM_FAILURES) - 1;
                    return Math.max(0, next);
                });
            }

            if (codeValue === "EMAIL_VERIFICATION_ATTEMPTS_EXCEEDED") {
                setRemainingAttempts(0);
            }

            setVerificationStatus(message);
            setErrors((prev) => ({ ...prev, verificationCode: message }));
            toast.error(message);
        } finally {
            setConfirmingVerification(false);
        }
    };

    const validate = () => {
        const nextErrors = {};

        if (!normalizedEmail) {
            nextErrors.email = "이메일을 입력해 주세요.";
        } else if (!emailFormatValid) {
            nextErrors.email = "이메일 형식이 올바르지 않습니다.";
        } else if (!emailChecked) {
            nextErrors.email = "이메일 중복 확인을 완료해 주세요.";
        } else if (!emailVerified) {
            nextErrors.verificationCode = "이메일 인증을 완료해 주세요.";
        }

        if (!formData.password) {
            nextErrors.password = "비밀번호를 입력해 주세요.";
        } else if (!passwordValid) {
            nextErrors.password = "비밀번호는 8자 이상이어야 합니다.";
        }

        if (formData.password !== formData.confirmPassword) {
            nextErrors.confirmPassword = "비밀번호가 일치하지 않습니다.";
        }

        if (!nameValid) {
            nextErrors.name = "이름을 입력해 주세요.";
        }

        if (!phoneValid) {
            nextErrors.phone = "전화번호를 입력해 주세요.";
        }

        setErrors(nextErrors);
        const firstErrorField = Object.keys(nextErrors)[0] || null;
        return { ok: Object.keys(nextErrors).length === 0, firstErrorField };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const { ok, firstErrorField } = validate();
        if (!ok) {
            if (firstErrorField) {
                const target = document.querySelector(`[name="${firstErrorField}"]`);
                target?.focus();
            }
            return;
        }

        setLoading(true);
        try {
            const mergedAddress = [formData.address, formData.addressDetail]
                .map((value) => (value || "").trim())
                .filter(Boolean)
                .join(" ");

            await register({
                email: normalizedEmail,
                password: formData.password,
                name: formData.name,
                phone: formData.phone,
                address: mergedAddress || undefined,
            });
        } catch (error) {
            console.error("Register error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddressResolved = ({ address }) => {
        if (!address) return;
        setFormData((prev) => ({ ...prev, address }));
        setAddressModalOpen(false);
        toast.success("주소가 입력되었습니다.");
    };

    const confirmHelpText = emailVerified
        ? "이메일 인증이 완료되었습니다."
        : remainingAttempts === 0
          ? "인증 시도 횟수를 모두 사용했습니다. 새 인증번호를 요청해 주세요."
          : remainingAttempts != null
            ? `인증 가능 횟수 ${remainingAttempts}회 남음`
            : "인증번호를 요청해 이메일 인증을 시작해 주세요.";

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
            <div className="w-full max-w-md relative z-10 py-10">
                <div className="text-center mb-10">
                    <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-primary-600 to-primary-400 text-white mb-6 shadow-2xl shadow-primary-200 group hover:scale-110 transition-transform duration-500">
                        <span className="text-3xl font-black italic tracking-tighter">C</span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-3">회원가입</h1>
                    <p className="text-slate-400 font-bold uppercase text-[11px] tracking-[0.3em]">이메일 인증 회원가입</p>
                </div>

                <div className="card p-10 animate-fade-in bg-white/80 backdrop-blur-xl border-white/50 shadow-2xl shadow-slate-200">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">이메일</label>
                            <div className="flex gap-2">
                                <div className="relative group flex-1">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary-500 transition-colors" />
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className={`input-base pl-12 h-14 bg-white font-bold ${errors.email ? "border-rose-300 ring-4 ring-rose-100" : ""}`}
                                        placeholder="이메일 주소"
                                    />
                                </div>
                                <button
                                    type="button"
                                    disabled={loading || checkingEmail}
                                    aria-busy={checkingEmail}
                                    onClick={handleCheckDuplicate}
                                    className="btn-primary h-14 px-4 text-xs tracking-tight shadow-xl shadow-primary-100 mt-0"
                                >
                                    {checkingEmail ? "확인 중..." : "중복 확인"}
                                </button>
                            </div>
                            {errors.email && <p className="mt-1 ml-1 text-[10px] font-black text-rose-500 uppercase tracking-wider">{errors.email}</p>}
                            {!errors.email && emailChecked && (
                                <p className="mt-1 ml-1 text-[10px] font-black text-emerald-600 uppercase tracking-wider">사용 가능한 이메일입니다.</p>
                            )}
                        </div>

                        <div className="space-y-3 rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <ShieldCheck className={`h-5 w-5 ${emailVerified ? "text-emerald-500" : "text-slate-300"}`} />
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">이메일 인증</p>
                                        <p className="text-sm font-bold text-slate-700">
                                            {emailVerified ? "인증이 완료되었습니다." : "회원가입을 완료하려면 6자리 인증번호를 입력해 주세요."}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleSendVerification}
                                    disabled={loading || sendingVerification || !emailChecked || resendCooldown > 0}
                                    className="rounded-xl bg-slate-900 px-4 py-3 text-[11px] font-black uppercase tracking-wider text-white disabled:bg-slate-300"
                                >
                                    {sendingVerification ? "전송 중..." : resendCooldown > 0 ? `${resendCooldown}초` : "인증번호 전송"}
                                </button>
                            </div>

                            <div className="flex gap-2">
                                <div className="relative group flex-1">
                                    <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary-500 transition-colors" />
                                    <input
                                        type="text"
                                        name="verificationCode"
                                        value={verificationCode}
                                        onChange={(e) => {
                                            setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                                            if (errors.verificationCode) {
                                                setErrors((prev) => ({ ...prev, verificationCode: "" }));
                                            }
                                        }}
                                        className={`input-base pl-12 h-14 bg-white font-bold tracking-[0.3em] ${errors.verificationCode ? "border-rose-300 ring-4 ring-rose-100" : ""}`}
                                        placeholder="123456"
                                        inputMode="numeric"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleConfirmVerification}
                                    disabled={loading || confirmingVerification || !emailChecked || !codeReady || remainingAttempts === 0}
                                    className="rounded-xl bg-primary-600 px-4 py-3 text-[11px] font-black uppercase tracking-wider text-white disabled:bg-primary-200"
                                >
                                    {confirmingVerification ? "확인 중..." : "인증 확인"}
                                </button>
                            </div>
                            {errors.verificationCode && (
                                <p className="text-[10px] font-black uppercase tracking-wider text-rose-500">{errors.verificationCode}</p>
                            )}
                            <p className={`text-[10px] font-black uppercase tracking-wider ${emailVerified ? "text-emerald-600" : "text-slate-500"}`}>
                                {confirmHelpText}
                            </p>
                            {!!verificationStatus && (
                                <p className="text-[10px] font-bold text-slate-500">{verificationStatus}</p>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">비밀번호</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary-500 transition-colors" />
                                    <input
                                        type="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        className={`input-base pl-12 h-14 bg-white font-bold text-xs ${errors.password ? "border-rose-300 ring-4 ring-rose-100" : ""}`}
                                        placeholder="8자 이상 입력"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">비밀번호 확인</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary-500 transition-colors" />
                                    <input
                                        type="password"
                                        name="confirmPassword"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        className={`input-base pl-12 h-14 bg-white font-bold text-xs ${
                                            errors.confirmPassword || passwordsMismatch
                                                ? "border-rose-300 ring-4 ring-rose-100"
                                                : passwordsMatch
                                                  ? "border-sky-300 ring-4 ring-sky-100"
                                                  : ""
                                        }`}
                                        placeholder="비밀번호 다시 입력"
                                    />
                                </div>
                            </div>
                        </div>
                        {(errors.password || errors.confirmPassword) && (
                            <p className="mt-1 ml-1 text-[10px] font-black text-rose-500 uppercase tracking-wider">{errors.password || errors.confirmPassword}</p>
                        )}
                        {!errors.password && !errors.confirmPassword && passwordsMismatch && (
                            <p className="mt-1 ml-1 text-[10px] font-black text-rose-500 uppercase tracking-wider">비밀번호가 일치하지 않습니다.</p>
                        )}
                        {!errors.password && !errors.confirmPassword && passwordsMatch && (
                            <p className="mt-1 ml-1 text-[10px] font-black text-sky-600 uppercase tracking-wider">비밀번호가 일치합니다.</p>
                        )}

                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">이름</label>
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary-500 transition-colors" />
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className={`input-base pl-12 h-14 bg-white font-bold ${errors.name ? "border-rose-300 ring-4 ring-rose-100" : ""}`}
                                    placeholder="이름을 입력해 주세요"
                                />
                            </div>
                            {errors.name && <p className="mt-1 ml-1 text-[10px] font-black text-rose-500 uppercase tracking-wider">{errors.name}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">전화번호</label>
                            <div className="relative group">
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary-500 transition-colors" />
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className={`input-base pl-12 h-14 bg-white font-bold ${errors.phone ? "border-rose-300 ring-4 ring-rose-100" : ""}`}
                                    placeholder="010-0000-0000"
                                />
                            </div>
                            {errors.phone && <p className="mt-1 ml-1 text-[10px] font-black text-rose-500 uppercase tracking-wider">{errors.phone}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">주소 (선택)</label>
                            <div className="flex gap-2">
                                <div className="relative group flex-1">
                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary-500 transition-colors" />
                                    <input
                                        type="text"
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        className="input-base pl-12 h-14 bg-white font-bold"
                                        placeholder="주소 검색"
                                        readOnly
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setAddressModalOpen(true)}
                                    className="h-14 rounded-xl bg-slate-900 px-4 text-xs font-black text-white hover:bg-slate-800"
                                >
                                    주소 검색
                                </button>
                            </div>
                            <div className="relative group">
                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary-500 transition-colors" />
                                <input
                                    type="text"
                                    name="addressDetail"
                                    value={formData.addressDetail}
                                    onChange={handleChange}
                                    className="input-base pl-12 h-14 bg-white font-bold"
                                    placeholder="상세 주소 입력"
                                />
                            </div>
                            <p className="mt-1 ml-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">선택 입력 항목입니다.</p>
                        </div>

                        <button
                            type="submit"
                            disabled={!canSubmit}
                            aria-busy={loading}
                            className="btn-primary w-full h-14 text-base tracking-tight shadow-xl shadow-primary-200 mt-4"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-3">
                                    <div className="loading-spinner border-white/30 border-t-white" />
                                    가입 처리 중...
                                </span>
                            ) : (
                                "회원가입 완료"
                            )}
                        </button>
                        {!!submitBlockMessage && (
                            <p className="mt-1 text-center text-[11px] font-bold text-slate-500" aria-live="polite">
                                {submitBlockMessage}
                            </p>
                        )}
                    </form>

                    <div className="mt-10 pt-8 border-t border-slate-50 text-center">
                        <p className="text-sm font-medium text-slate-400">
                            이미 계정이 있으신가요?{" "}
                            <Link
                                to="/login"
                                className="font-black text-primary-600 hover:text-primary-700 underline underline-offset-4 decoration-primary-200"
                            >
                                로그인
                            </Link>
                        </p>
                    </div>
                </div>
            </div>

            {addressModalOpen && (
                <div className="fixed inset-0 z-[90] bg-slate-900/45 p-4">
                    <div className="mx-auto mt-20 w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-black text-slate-900">주소 검색</h3>
                            <button
                                type="button"
                                onClick={() => setAddressModalOpen(false)}
                                className="rounded-lg bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
                                aria-label="주소 검색 닫기"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <AddressSearchBox
                            onResolved={handleAddressResolved}
                            placeholder="예: 서울시청, 서울역, 강남역"
                        />
                        <div className="mt-3 text-xs font-semibold text-slate-500">
                            검색 결과를 선택하면 회원가입 주소 입력칸에 자동으로 반영됩니다.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
