import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Lock, User, Phone, Leaf } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export const Register = () => {
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        confirmPassword: "",
        name: "",
        phone: "",
    });
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const { register } = useAuth();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        // 입력 시 해당 필드 에러 제거
        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: "" }));
        }
    };

    const validate = () => {
        const newErrors = {};

        if (!formData.email) {
            newErrors.email = "이메일을 입력해주세요";
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = "올바른 이메일 형식이 아닙니다";
        }

        if (!formData.password) {
            newErrors.password = "비밀번호를 입력해주세요";
        } else if (formData.password.length < 8) {
            newErrors.password = "비밀번호는 8자 이상이어야 합니다";
        }

        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = "비밀번호가 일치하지 않습니다";
        }

        if (!formData.name) {
            newErrors.name = "이름을 입력해주세요";
        }

        if (!formData.phone) {
            newErrors.phone = "전화번호를 입력해주세요";
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
        <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* 로고 & 타이틀 */}
                <div className="text-center mb-8">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 text-white mb-4 shadow-lg">
                        <Leaf className="h-8 w-8" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">회원가입</h1>
                    <p className="text-slate-600">
                        탄소저감 커뮤니티에 오신 것을 환영합니다
                    </p>
                </div>

                {/* 회원가입 폼 */}
                <div className="card p-8 animate-fade-in">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* 이메일 */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                이메일
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className={`input-base pl-11 ${
                                        errors.email ? "border-red-300 focus:border-red-500 focus:ring-red-500" : ""
                                    }`}
                                    placeholder="example@email.com"
                                />
                            </div>
                            {errors.email && (
                                <p className="mt-1 text-xs text-red-600">{errors.email}</p>
                            )}
                        </div>

                        {/* 비밀번호 */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                비밀번호
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className={`input-base pl-11 ${
                                        errors.password ? "border-red-300 focus:border-red-500 focus:ring-red-500" : ""
                                    }`}
                                    placeholder="8자 이상"
                                />
                            </div>
                            {errors.password && (
                                <p className="mt-1 text-xs text-red-600">{errors.password}</p>
                            )}
                        </div>

                        {/* 비밀번호 확인 */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                비밀번호 확인
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    className={`input-base pl-11 ${
                                        errors.confirmPassword ? "border-red-300 focus:border-red-500 focus:ring-red-500" : ""
                                    }`}
                                    placeholder="비밀번호 재입력"
                                />
                            </div>
                            {errors.confirmPassword && (
                                <p className="mt-1 text-xs text-red-600">
                                    {errors.confirmPassword}
                                </p>
                            )}
                        </div>

                        {/* 이름 */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                이름
                            </label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className={`input-base pl-11 ${
                                        errors.name ? "border-red-300 focus:border-red-500 focus:ring-red-500" : ""
                                    }`}
                                    placeholder="홍길동"
                                />
                            </div>
                            {errors.name && (
                                <p className="mt-1 text-xs text-red-600">{errors.name}</p>
                            )}
                        </div>

                        {/* 전화번호 */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                전화번호
                            </label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className={`input-base pl-11 ${
                                        errors.phone ? "border-red-300 focus:border-red-500 focus:ring-red-500" : ""
                                    }`}
                                    placeholder="010-1234-5678"
                                />
                            </div>
                            {errors.phone && (
                                <p className="mt-1 text-xs text-red-600">{errors.phone}</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                  <div className="loading-spinner" />
                  가입 중...
                </span>
                            ) : (
                                "회원가입"
                            )}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t text-center">
                        <p className="text-sm text-slate-600">
                            이미 계정이 있으신가요?{" "}
                            <Link
                                to="/login"
                                className="font-semibold text-primary-600 hover:text-primary-700"
                            >
                                로그인
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};