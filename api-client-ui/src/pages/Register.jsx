import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Lock, User, Phone } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import api from "../utils/api";
import toast from "react-hot-toast";

export const Register = () => {
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        confirmPassword: "",
        name: "",
        phone: "",
    });
    const [loading, setLoading] = useState(false);
    const [checkingEmail, setCheckingEmail] = useState(false);
    const [emailAvailable, setEmailAvailable] = useState(null);
    const [checkedEmail, setCheckedEmail] = useState("");
    const [errors, setErrors] = useState({});
    const { register } = useAuth();
    const hasConfirmValue = formData.confirmPassword.length > 0;
    const passwordsMatch = hasConfirmValue && formData.password === formData.confirmPassword;
    const passwordsMismatch = hasConfirmValue && !passwordsMatch;

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
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validate()) return;

        setLoading(true);
        try {
            await register({
                email: formData.email,
                password: formData.password,
                name: formData.name,
                phone: formData.phone,
            });
        } catch (error) {
            console.error("Register error:", error);
        } finally {
            setLoading(false);
        }
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

                        <button
                            type="submit"
                            disabled={loading}
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
        </div>
    );
};
