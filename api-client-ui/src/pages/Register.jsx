import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Lock, User, Phone, MapPin, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import api from "../utils/api";
import toast from "react-hot-toast";
import { AddressSearchBox } from "../common/AddressSearchBox";

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
    const [loading, setLoading] = useState(false);
    const [checkingEmail, setCheckingEmail] = useState(false);
    const [emailAvailable, setEmailAvailable] = useState(null);
    const [checkedEmail, setCheckedEmail] = useState("");
    const [errors, setErrors] = useState({});
    const [addressModalOpen, setAddressModalOpen] = useState(false);
    const { register } = useAuth();
    const hasConfirmValue = formData.confirmPassword.length > 0;
    const passwordsMatch = hasConfirmValue && formData.password === formData.confirmPassword;
    const passwordsMismatch = hasConfirmValue && !passwordsMatch;
    const emailFormatValid = /\S+@\S+\.\S+/.test(formData.email);
    const passwordValid = formData.password.length >= 8;
    const nameValid = formData.name.trim().length > 0;
    const phoneValid = formData.phone.trim().length > 0;
    const emailChecked = checkedEmail === formData.email && emailAvailable === true;

    const submitBlockMessage = !formData.email
        ? "이메일을 입력해주세요."
        : !emailFormatValid
          ? "올바른 이메일 형식을 입력해주세요."
          : !emailChecked
            ? "이메일 중복 확인을 완료해주세요."
            : !passwordValid
              ? "비밀번호는 8자 이상이어야 합니다."
              : !passwordsMatch
                ? "비밀번호 확인이 일치하지 않습니다."
                : !nameValid
                  ? "이름을 입력해주세요."
                  : !phoneValid
                    ? "전화번호를 입력해주세요."
                    : "";
    const canSubmit = !loading && !submitBlockMessage;

    const formatPhoneNumber = (rawValue) => {
        const digits = rawValue.replace(/\D/g, "").slice(0, 11);
        if (digits.length < 4) return digits;
        if (digits.length < 8) return digits.slice(0, 3) + "-" + digits.slice(3);
        return digits.slice(0, 3) + "-" + digits.slice(3, 7) + "-" + digits.slice(7);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        const nextValue = name === "phone" ? formatPhoneNumber(value) : value;
        setFormData((prev) => ({ ...prev, [name]: nextValue }));

        if (name === "email") {
            setCheckedEmail("");
            setEmailAvailable(null);
        }

        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: "" }));
        }

        if ((name === "password" || name === "confirmPassword") && errors.confirmPassword) {
            setErrors((prev) => ({ ...prev, confirmPassword: "" }));
        }

        if (name === "email" && errors.email) {
            setErrors((prev) => ({ ...prev, email: "" }));
        }
    };

    const handleCheckDuplicate = async () => {
        const email = formData.email.trim();
        if (!email) {
            setErrors((prev) => ({ ...prev, email: "Enter your email first." }));
            return;
        }

        if (!/\S+@\S+\.\S+/.test(email)) {
            setErrors((prev) => ({ ...prev, email: "Invalid email format." }));
            return;
        }

        setCheckingEmail(true);
        try {
            const response = await api.get("/members/check-email", { params: { email } });
            const payload = response.data?.data || response.data;
            const available = !!payload?.available;

            setCheckedEmail(email);
            setEmailAvailable(available);

            if (available) {
                toast.success("This email is available.");
                setErrors((prev) => ({ ...prev, email: "" }));
            } else {
                setErrors((prev) => ({ ...prev, email: "This email is already in use." }));
                toast.error("This email is already in use.");
            }
        } catch (error) {
            setCheckedEmail("");
            setEmailAvailable(null);
            setErrors((prev) => ({ ...prev, email: error?.response?.data?.message || "Failed to check email." }));
            toast.error("Failed to check email.");
        } finally {
            setCheckingEmail(false);
        }
    };

    const validate = () => {
        const newErrors = {};

        if (!formData.email) {
            newErrors.email = "Enter your email.";
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = "Invalid email format.";
        } else if (checkedEmail !== formData.email || emailAvailable !== true) {
            newErrors.email = "Please complete duplicate email check.";
        }

        if (!formData.password) {
            newErrors.password = "Enter password.";
        } else if (formData.password.length < 8) {
            newErrors.password = "Password must be at least 8 characters.";
        }

        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = "Passwords do not match.";
        }

        if (!formData.name) {
            newErrors.name = "Enter your name.";
        }

        if (!formData.phone) {
            newErrors.phone = "Enter phone number.";
        }

        setErrors(newErrors);
        const firstErrorField = Object.keys(newErrors)[0] || null;
        return { ok: Object.keys(newErrors).length === 0, firstErrorField };
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
            // 기본주소+상세주소를 하나의 저장 주소로 합쳐서 전송.
            // Merge base address and detail into a single persisted address field.
            const mergedAddress = [formData.address, formData.addressDetail]
                .map((v) => (v || "").trim())
                .filter(Boolean)
                .join(" ");
            await register({
                email: formData.email,
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

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary-100/50 rounded-full blur-3xl opacity-50" />
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-sky-100/50 rounded-full blur-3xl opacity-50" />

            <div className="w-full max-w-md relative z-10 py-10">
                <div className="text-center mb-10">
                    <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-primary-600 to-primary-400 text-white mb-6 shadow-2xl shadow-primary-200 group hover:scale-110 transition-transform duration-500">
                        <span className="text-3xl font-black italic tracking-tighter">C</span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-3">JOIN US</h1>
                    <p className="text-slate-400 font-bold uppercase text-[11px] tracking-[0.3em]">START YOUR JOURNEY TODAY</p>
                </div>

                <div className="card p-10 animate-fade-in bg-white/80 backdrop-blur-xl border-white/50 shadow-2xl shadow-slate-200">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                            <div className="flex gap-2">
                                <div className="relative group flex-1">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary-500 transition-colors" />
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className={`input-base pl-12 h-14 bg-white font-bold ${errors.email ? "border-rose-300 ring-4 ring-rose-100" : ""}`}
                                        placeholder="your@email.com"
                                    />
                                </div>
                                <button
                                    type="button"
                                    disabled={loading || checkingEmail}
                                    aria-busy={checkingEmail}
                                    data-busy-indicator="true"
                                    onClick={handleCheckDuplicate}
                                    className="btn-primary w-25 h-14 text-base tracking-tight shadow-xl shadow-primary-100 mt-0"
                                >
                                    {checkingEmail ? "CHECKING..." : "CHECK"}
                                </button>
                            </div>
                            {!errors.email && checkedEmail === formData.email.trim() && emailAvailable === true && (
                                <p className="mt-1 ml-1 text-[10px] font-black text-emerald-600 uppercase tracking-wider">Email is available.</p>
                            )}
                            {!errors.email && formData.email && !emailFormatValid && (
                                <p className="mt-1 ml-1 text-[10px] font-black text-rose-500 uppercase tracking-wider">Invalid email format.</p>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary-500 transition-colors" />
                                    <input
                                        type="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        className={`input-base pl-12 h-14 bg-white font-bold text-xs ${errors.password ? "border-rose-300 ring-4 ring-rose-100" : ""}`}
                                        placeholder="Min 8 chars"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm</label>
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
                                        placeholder="Repeat"
                                    />
                                </div>
                            </div>
                        </div>
                        {(errors.password || errors.confirmPassword) && (
                            <p className="mt-1 ml-1 text-[10px] font-black text-rose-500 uppercase tracking-wider">{errors.password || errors.confirmPassword}</p>
                        )}
                        {!errors.password && !errors.confirmPassword && passwordsMismatch && (
                            <p className="mt-1 ml-1 text-[10px] font-black text-rose-500 uppercase tracking-wider">Passwords do not match.</p>
                        )}
                        {!errors.password && !errors.confirmPassword && passwordsMatch && (
                            <p className="mt-1 ml-1 text-[10px] font-black text-sky-600 uppercase tracking-wider">Passwords match.</p>
                        )}
                        {!errors.password && formData.password && !passwordValid && (
                            <p className="mt-1 ml-1 text-[10px] font-black text-rose-500 uppercase tracking-wider">Password must be at least 8 characters.</p>
                        )}

                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary-500 transition-colors" />
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className={`input-base pl-12 h-14 bg-white font-bold ${errors.name ? "border-rose-300 ring-4 ring-rose-100" : ""}`}
                                    placeholder="Enter your name"
                                />
                            </div>
                            {errors.name && <p className="mt-1 ml-1 text-[10px] font-black text-rose-500 uppercase tracking-wider">{errors.name}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
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
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Address (Optional)</label>
                            <div className="flex gap-2">
                                <div className="relative group flex-1">
                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary-500 transition-colors" />
                                    <input
                                        type="text"
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        className="input-base pl-12 h-14 bg-white font-bold"
                                        placeholder="주소 검색으로 입력"
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
                                    placeholder="상세주소 (동/호수/층수 등)"
                                />
                            </div>
                            <p className="mt-1 ml-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                선택 입력 항목입니다.
                            </p>
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
                                    CREATING ACCOUNT...
                                </span>
                            ) : (
                                "COMPLETE REGISTRATION"
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
                            Already have an account?{" "}
                            <Link
                                to="/login"
                                className="font-black text-primary-600 hover:text-primary-700 underline underline-offset-4 decoration-primary-200"
                            >
                                LOG IN
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
                            placeholder="예: 서울시청, 판교역, 부산역"
                        />
                        <div className="mt-3 text-xs font-semibold text-slate-500">
                            검색 결과를 선택하면 회원가입 주소 입력칸에 자동 반영됩니다.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
