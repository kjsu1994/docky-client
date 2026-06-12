import { useState } from "react";
import { KeyRound, Lock } from "lucide-react";
import { BrandMark } from "../../common/BrandLogo.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { logClientError } from "../../utils/clientDiagnostics.js";
import { notifyError } from "../../utils/toast.js";

export const ForcePasswordChange = () => {
    const { completeRequiredPasswordChange } = useAuth();
    const [formData, setFormData] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    });
    const [loading, setLoading] = useState(false);

    const newPasswordValid = /^[a-zA-Z0-9!@#$%^&*()_+\-=]{8,30}$/.test(formData.newPassword);
    const passwordsMatch = formData.newPassword && formData.newPassword === formData.confirmPassword;
    const canSubmit = formData.currentPassword && newPasswordValid && passwordsMatch && !loading;

    const handleChange = (event) => {
        const { name, value } = event.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!canSubmit) {
            notifyError("비밀번호 입력값을 확인해주세요.");
            return;
        }
        setLoading(true);
        try {
            await completeRequiredPasswordChange({
                currentPassword: formData.currentPassword,
                newPassword: formData.newPassword,
            });
        } catch (error) {
            logClientError("forcePasswordChange.submit", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
            <div className="w-full max-w-md relative z-10 py-8">
                <div className="text-center mb-8">
                    <BrandMark className="mx-auto mb-5 h-20 sm:h-24 max-w-[17rem]" />
                    <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-600/10 text-primary-600">
                        <KeyRound className="h-6 w-6" />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-3">비밀번호 변경</h1>
                    <p className="text-slate-500 text-sm font-bold">새 비밀번호로 변경해야 서비스를 이용할 수 있습니다.</p>
                </div>

                <div className="card p-6 sm:p-10 animate-fade-in bg-white/80 backdrop-blur-xl border-white/50 shadow-2xl shadow-slate-200">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <PasswordInput
                            label="임시 비밀번호"
                            name="currentPassword"
                            value={formData.currentPassword}
                            onChange={handleChange}
                            autoComplete="current-password"
                        />
                        <PasswordInput
                            label="새 비밀번호"
                            name="newPassword"
                            value={formData.newPassword}
                            onChange={handleChange}
                            autoComplete="new-password"
                        />
                        <PasswordInput
                            label="새 비밀번호 확인"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            autoComplete="new-password"
                        />

                        <div className="space-y-1 text-[11px] font-bold">
                            {formData.newPassword && !newPasswordValid && (
                                <p className="text-rose-500">8~30자, 영문/숫자/허용 특수문자만 사용할 수 있습니다.</p>
                            )}
                            {formData.confirmPassword && !passwordsMatch && (
                                <p className="text-rose-500">새 비밀번호가 일치하지 않습니다.</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={!canSubmit}
                            aria-busy={loading}
                            className="btn-primary w-full h-14 text-base tracking-tight shadow-xl shadow-primary-200"
                        >
                            {loading ? "변경 중..." : "비밀번호 변경"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

const PasswordInput = ({ label, name, value, onChange, autoComplete }) => (
    <div className="space-y-2">
        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
        <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary-500 transition-colors" />
            <input
                type="password"
                name={name}
                value={value}
                onChange={onChange}
                className="input-base pl-12 h-14 bg-white font-bold"
                autoComplete={autoComplete}
            />
        </div>
    </div>
);

export default ForcePasswordChange;
