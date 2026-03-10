import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, MapPin, Save, User, X } from "lucide-react";
import axios from "axios";
import api from "../../utils/api.js";
import toast from "react-hot-toast";
import { LoadingSpinner } from "../../components/LoadingSpinner.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { normalizeProfileImageUrl } from "../../utils/profileImage.js";
import { AddressSearchBox } from "../../common/AddressSearchBox.jsx";

const unwrapData = (response) => response?.data?.data ?? response?.data ?? null;
const isHeicLikeFile = (file) => {
    const type = (file?.type || "").toLowerCase();
    const name = (file?.name || "").toLowerCase();
    return type.includes("heic") || type.includes("heif") || name.endsWith(".heic") || name.endsWith(".heif");
};

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

const getAuthProvider = (member) => String(member?.auth_provider || member?.authProvider || "LOCAL").toUpperCase();
const formatPhoneNumber = (rawValue) => {
    const digits = rawValue.replace(/\D/g, "").slice(0, 11);
    if (digits.length < 4) return digits;
    if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
};

export const MypageEdit = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [verifyingPassword, setVerifyingPassword] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [passwordVerified, setPasswordVerified] = useState(false);
    const [addressModalOpen, setAddressModalOpen] = useState(false);
    const [member, setMember] = useState(null);
    const [form, setForm] = useState({
        name: "",
        phone: "",
        address: "",
        addressDetail: "",
        currentPassword: "",
        password: "",
    });

    const memberId = useMemo(
        () => member?.member_id ?? member?.memberId ?? user?.member_id ?? user?.memberId ?? null,
        [member, user]
    );

    const profileUrl = normalizeProfileImageUrl(member?.profile_url || member?.profileUrl || "");
    const authProvider = useMemo(() => getAuthProvider(member || user), [member, user]);
    const oauthMember = authProvider !== "LOCAL";

    const isDirty = useMemo(() => {
        if (!member) return false;
        const nameChanged = (form.name || "").trim() !== (member.name || "").trim();
        const phoneChanged = (form.phone || "").trim() !== (member.phone || "").trim();
        const mergedAddress = [form.address, form.addressDetail].map((v) => (v || "").trim()).filter(Boolean).join(" ");
        const addressChanged = mergedAddress !== ((member.address || "").trim());
        const passwordChanged = form.password.trim().length > 0;
        return nameChanged || phoneChanged || addressChanged || passwordChanged;
    }, [form, member]);

    const fetchMember = async () => {
        setLoading(true);
        try {
            const response = await api.get("/members");
            const data = unwrapData(response);
            setMember(data);
            setPasswordVerified(false);
            setForm({
                name: data?.name || "",
                phone: data?.phone || "",
                address: data?.address || "",
                addressDetail: "",
                currentPassword: "",
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
        const nextValue = name === "phone" ? formatPhoneNumber(value) : value;
        if (name === "currentPassword") {
            setPasswordVerified(false);
        }
        setForm((prev) => ({ ...prev, [name]: nextValue }));
    };

    const handleVerifyCurrentPassword = async () => {
        if (oauthMember) {
            setPasswordVerified(true);
            return;
        }

        const email = member?.email || user?.email || "";
        const currentPassword = form.currentPassword.trim();

        if (!email) {
            toast.error("이메일 정보를 찾을 수 없습니다.");
            return;
        }
        if (!currentPassword) {
            toast.error("현재 비밀번호를 먼저 입력해주세요.");
            return;
        }

        setVerifyingPassword(true);
        try {
            await axios.post("/api/members/login", {
                email,
                password: currentPassword,
            });
            setPasswordVerified(true);
            toast.success("비밀번호 확인이 완료되었습니다.");
        } catch (error) {
            setPasswordVerified(false);
            toast.error(extractErrorMessage(error, "현재 비밀번호가 일치하지 않습니다."));
        } finally {
            setVerifyingPassword(false);
        }
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
        if (isHeicLikeFile(file)) {
            toast.error("HEIC/HEIF 이미지는 지원되지 않습니다. JPG/PNG로 변경 후 업로드해주세요.");
            e.target.value = "";
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        setUploading(true);
        try {
            await api.post("/members/uploadProfile", formData);
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

        const nextPassword = form.password.trim();
        const currentPassword = form.currentPassword.trim();
        const nextPhone = form.phone.trim();

        if (!nextPhone) {
            toast.error("전화번호를 입력해 주세요.");
            return;
        }

        if (nextPassword && !oauthMember && !currentPassword) {
            toast.error("새 비밀번호를 변경하려면 현재 비밀번호를 입력해주세요.");
            return;
        }
        if (nextPassword && !oauthMember && !passwordVerified) {
            toast.error("비밀번호 확인을 완료해주세요.");
            return;
        }
        if (nextPassword && nextPassword.length < 8) {
            toast.error("새 비밀번호는 8자 이상이어야 합니다.");
            return;
        }

        setSaving(true);
        try {
            const mergedAddress = [form.address, form.addressDetail]
                .map((v) => (v || "").trim())
                .filter(Boolean)
                .join(" ");

            const payload = {
                name: (form.name || "").trim(),
                phone: nextPhone,
                address: mergedAddress || null,
            };

            if (nextPassword) {
                if (!oauthMember) {
                    payload.currentPassword = currentPassword;
                }
                payload.password = nextPassword;
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

    const handleAddressResolved = ({ address }) => {
        if (!address) return;
        setForm((prev) => ({
            ...prev,
            address,
        }));
        setAddressModalOpen(false);
        toast.success("주소가 입력되었습니다.");
    };

    if (loading) {
        return <LoadingSpinner text="회원 정보 로딩 중.." />;
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
                        {uploading ? "업로드 중.." : "프로필 이미지 변경"}
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

                    <div className={oauthMember ? "hidden" : ""}>
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
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">전화번호</label>
                        <input
                            name="phone"
                            value={form.phone}
                            onChange={handleChange}
                            className="input-base"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">주소</label>
                        <div className="flex gap-2">
                            <div className="relative group flex-1">
                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary-500 transition-colors" />
                                <input
                                    type="text"
                                    name="address"
                                    value={form.address}
                                    onChange={handleChange}
                                    className="input-base pl-12"
                                    placeholder="주소 검색으로 입력"
                                    readOnly
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setAddressModalOpen(true)}
                                className="shrink-0 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                            >
                                주소 검색
                            </button>
                        </div>
                        <div className="relative group">
                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-primary-500 transition-colors" />
                            <input
                                type="text"
                                name="addressDetail"
                                value={form.addressDetail}
                                onChange={handleChange}
                                className="input-base pl-12"
                                placeholder="상세주소 (동/호수/층수 등)"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">현재 비밀번호 (새 비밀번호 변경 시 필수)</label>
                        <div className={oauthMember ? "hidden" : "flex items-center gap-2"}>
                            <input
                                type="password"
                                name="currentPassword"
                                value={form.currentPassword}
                                onChange={handleChange}
                                className="input-base"
                                placeholder="현재 비밀번호 입력"
                            />
                            <button
                                type="button"
                                onClick={handleVerifyCurrentPassword}
                                disabled={verifyingPassword || !form.currentPassword.trim()}
                                className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                                    passwordVerified
                                        ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                        : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 disabled:opacity-60"
                                }`}
                            >
                                {verifyingPassword ? "확인 중.." : passwordVerified ? "확인 완료" : "확인"}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">새 비밀번호 (선택)</label>
                        {oauthMember && (
                            <p className="mb-2 text-xs font-semibold text-slate-500">
                                {"\uC18C\uC15C \uB85C\uADF8\uC778 \uACC4\uC815\uC740 \uD604\uC7AC \uBE44\uBC00\uBC88\uD638 \uC785\uB825 \uC5C6\uC774 \uC0C8 \uBE44\uBC00\uBC88\uD638\uB97C \uC124\uC815\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4."}
                            </p>
                        )}
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
                        {saving ? "저장 중.." : "수정 내용 저장"}
                    </button>
                </form>
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
                            검색 결과를 선택하면 주소 입력칸에 자동 반영됩니다.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
