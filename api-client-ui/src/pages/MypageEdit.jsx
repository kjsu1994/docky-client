import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Save, User } from "lucide-react";
import api from "../utils/api";
import toast from "react-hot-toast";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useAuth } from "../contexts/AuthContext";
import { normalizeProfileImageUrl } from "../utils/profileImage";

const unwrapData = (response) => response?.data?.data ?? response?.data ?? null;

const extractErrorMessage = (error, fallback) => {
    const data = error?.response?.data;
    if (!data) return fallback;

    if (Array.isArray(data.fieldErrors) && data.fieldErrors.length > 0) {
        return data.fieldErrors.map((item) => `${item.field}: ${item.reason}`).join(", ");
    }
    if (Array.isArray(data.violationErrors) && data.violationErrors.length > 0) {
        return data.violationErrors.map((item) => `${item.propertyPath}: ${item.reason}`).join(", ");
    }

    return data.message || fallback;
};

export const MypageEdit = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [member, setMember] = useState(null);
    const [form, setForm] = useState({
        name: "",
        phone: "",
        password: "",
    });

    const memberId = useMemo(
        () => member?.member_id ?? member?.memberId ?? user?.member_id ?? user?.memberId ?? null,
        [member, user]
    );
    const profileUrl = normalizeProfileImageUrl(member?.profile_url || member?.profileUrl || "");
    const isDirty = useMemo(() => {
        if (!member) return false;
        const nameChanged = (form.name || "").trim() !== (member.name || "").trim();
        const phoneChanged = (form.phone || "").trim() !== (member.phone || "").trim();
        const passwordChanged = form.password.trim().length > 0;
        return nameChanged || phoneChanged || passwordChanged;
    }, [form, member]);

    const fetchMember = async () => {
        setLoading(true);
        try {
            const response = await api.get("/members");
            const data = unwrapData(response);
            setMember(data);
            setForm({
                name: data?.name || "",
                phone: data?.phone || "",
                password: "",
            });
        } catch (error) {
            toast.error(extractErrorMessage(error, "회원 정보를 불러오지 못했습니다."));
            navigate("/app/mypage");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMember();
    }, [navigate]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleProfileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            toast.error("이미지 파일만 업로드할 수 있습니다.");
            e.target.value = "";
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error("프로필 이미지는 5MB 이하로 업로드해주세요.");
            e.target.value = "";
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        setUploading(true);
        try {
            await api.post("/members/uploadProfile", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            await fetchMember();
            toast.success("프로필 이미지가 업데이트되었습니다.");
        } catch (error) {
            toast.error(extractErrorMessage(error, "프로필 업로드에 실패했습니다."));
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!memberId) {
            toast.error("회원 식별자를 찾을 수 없습니다.");
            return;
        }
        if (!isDirty) {
            toast("변경된 내용이 없습니다.");
            return;
        }

        setSaving(true);
        try {
            const payload = {
                name: (form.name || "").trim(),
                phone: (form.phone || "").trim(),
            };
            if (form.password.trim()) {
                payload.password = form.password;
            }

            await api.patch(`/members/${memberId}`, payload);
            toast.success("회원 정보가 수정되었습니다.");
            navigate("/app/mypage");
        } catch (error) {
            toast.error(extractErrorMessage(error, "회원 정보 수정에 실패했습니다."));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <LoadingSpinner text="회원 정보 로딩 중..." />;
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-900">프로필 수정</h1>
                <button
                    type="button"
                    onClick={() => navigate("/app/mypage")}
                    className="btn-secondary flex items-center gap-2"
                >
                    <ArrowLeft className="h-4 w-4" />
                    마이페이지로
                </button>
            </div>

            <div className="card p-8 space-y-8">
                <div className="flex items-center gap-5">
                    {profileUrl ? (
                        <img
                            src={profileUrl}
                            alt="프로필"
                            className="h-24 w-24 rounded-2xl object-cover border border-slate-200"
                        />
                    ) : (
                        <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-primary-500 to-emerald-600 text-white flex items-center justify-center">
                            <User className="h-10 w-10" />
                        </div>
                    )}
                    <label className="btn-secondary cursor-pointer inline-flex items-center gap-2">
                        <Camera className="h-4 w-4" />
                        {uploading ? "업로드 중..." : "프로필 이미지 변경"}
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleProfileUpload}
                            disabled={uploading}
                        />
                    </label>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">이메일</label>
                        <input
                            value={member?.email || ""}
                            disabled
                            className="input-base bg-slate-100"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">이름</label>
                        <input
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            className="input-base"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">전화번호</label>
                        <input
                            name="phone"
                            value={form.phone}
                            onChange={handleChange}
                            className="input-base"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            새 비밀번호 (선택)
                        </label>
                        <input
                            type="password"
                            name="password"
                            value={form.password}
                            onChange={handleChange}
                            className="input-base"
                            placeholder="변경 시에만 입력"
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn-primary w-full inline-flex items-center justify-center gap-2"
                        disabled={saving || !isDirty}
                        aria-busy={saving}
                        data-busy-indicator="true"
                    >
                        <Save className="h-4 w-4" />
                        {saving ? "저장 중..." : "수정 내용 저장"}
                    </button>
                </form>
            </div>
        </div>
    );
};
