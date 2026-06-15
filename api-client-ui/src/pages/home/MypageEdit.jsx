import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, MapPin, Save, X } from "lucide-react";
import { LoadingSpinner } from "../../components/LoadingSpinner.jsx";
import { ErrorMessage } from "../../components/ErrorMessage.jsx";
import UserAvatar from "../../common/UserAvatar.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { notify, notifyError, notifySuccess } from "../../utils/toast.js";
import { AddressSearchBox } from "../../common/AddressSearchBox.jsx";
import { extractMypageErrorMessage, formatPhoneNumber, isGoogleMember, mypageAdapter } from "../../adapters/mypageAdapter.js";

const PROFILE_IMAGE_ACCEPT = "image/jpeg,image/png,image/gif,image/webp,image/bmp";
const PROFILE_IMAGE_TYPES = new Set(PROFILE_IMAGE_ACCEPT.split(","));

const isHeicLikeFile = (file) => {
    const type = (file?.type || "").toLowerCase();
    const name = (file?.name || "").toLowerCase();
    return type.includes("heic") || type.includes("heif") || name.endsWith(".heic") || name.endsWith(".heif");
};

const isAllowedProfileImageFile = (file) => PROFILE_IMAGE_TYPES.has((file?.type || "").toLowerCase());

export const MypageEdit = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
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

    const memberId = member?.memberId || user?.member_id || user?.memberId || null;
    const level = member?.level || {};
    const oauthMember = useMemo(() => isGoogleMember(member || user), [member, user]);

    const fetchMember = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const data = await mypageAdapter.fetchMember();
            setMember(data);
            setPasswordVerified(false);
            setForm({
                name: data.name || "",
                phone: data.phone || "",
                address: data.address || "",
                addressDetail: "",
                currentPassword: "",
                password: "",
            });
        } catch (err) {
            setError(extractMypageErrorMessage(err, "회원 정보를 불러오지 못했습니다."));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMember();
    }, [fetchMember]);

    const mergedAddress = useMemo(() => [form.address, form.addressDetail]
        .map((value) => (value || "").trim())
        .filter(Boolean)
        .join(" "), [form.address, form.addressDetail]);

    const isDirty = useMemo(() => {
        if (!member) return false;
        return (form.name || "").trim() !== (member.name || "").trim()
            || (form.phone || "").trim() !== (member.phone || "").trim()
            || mergedAddress !== (member.address || "").trim()
            || form.password.trim().length > 0;
    }, [form.name, form.phone, form.password, member, mergedAddress]);

    const handleChange = (event) => {
        const { name, value } = event.target;
        const nextValue = name === "phone" ? formatPhoneNumber(value) : value;
        if (name === "currentPassword") {
            setPasswordVerified(false);
        }
        setForm((current) => ({ ...current, [name]: nextValue }));
    };

    const handleVerifyCurrentPassword = async () => {
        if (oauthMember) {
            setPasswordVerified(true);
            return true;
        }

        const email = member?.email || user?.email || "";
        const currentPassword = form.currentPassword.trim();
        if (!email) {
            notifyError("이메일 정보를 찾을 수 없습니다.");
            return false;
        }
        if (!currentPassword) {
            notifyError("현재 비밀번호를 먼저 입력해 주세요.");
            return false;
        }

        setVerifyingPassword(true);
        try {
            await mypageAdapter.verifyPassword(email, currentPassword);
            setPasswordVerified(true);
            notifySuccess("비밀번호 확인이 완료되었습니다.");
            return true;
        } catch (err) {
            setPasswordVerified(false);
            notifyError(extractMypageErrorMessage(err, "현재 비밀번호가 일치하지 않습니다."));
            return false;
        } finally {
            setVerifyingPassword(false);
        }
    };

    const handleProfileUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!isAllowedProfileImageFile(file)) {
            notifyError("프로필 이미지는 JPG, PNG, GIF, WebP, BMP 형식만 업로드할 수 있습니다.");
            event.target.value = "";
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            notifyError("프로필 이미지는 5MB 이하로 업로드해 주세요.");
            event.target.value = "";
            return;
        }
        if (isHeicLikeFile(file)) {
            notifyError("HEIC/HEIF 이미지는 지원되지 않습니다. JPG 또는 PNG로 변환해 주세요.");
            event.target.value = "";
            return;
        }

        setUploading(true);
        try {
            const updatedMember = await mypageAdapter.uploadProfile(file);
            setMember(updatedMember);
            notifySuccess("프로필 이미지가 변경되었습니다.");
        } catch (err) {
            notifyError(extractMypageErrorMessage(err, "프로필 이미지 업로드에 실패했습니다."));
        } finally {
            setUploading(false);
            event.target.value = "";
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!memberId) {
            notifyError("회원 식별자를 찾을 수 없습니다.");
            return;
        }
        if (!isDirty) {
            notify("변경된 내용이 없습니다.");
            return;
        }

        const nextName = form.name.trim();
        const nextPhone = form.phone.trim();
        const nextPassword = form.password.trim();
        const currentPassword = form.currentPassword.trim();

        if (!nextName) {
            notifyError("이름을 입력해 주세요.");
            return;
        }
        if (!nextPhone) {
            notifyError("전화번호를 입력해 주세요.");
            return;
        }
        if (nextPassword && nextPassword.length < 8) {
            notifyError("새 비밀번호는 8자 이상이어야 합니다.");
            return;
        }
        if (nextPassword && !oauthMember && !passwordVerified) {
            if (!currentPassword) {
                notifyError("새 비밀번호를 변경하려면 현재 비밀번호를 입력해 주세요.");
                return;
            }
            const verified = await handleVerifyCurrentPassword();
            if (!verified) return;
        }

        setSaving(true);
        try {
            await mypageAdapter.updateMember(memberId, {
                name: nextName,
                phone: nextPhone,
                address: mergedAddress || null,
                ...(nextPassword ? { password: nextPassword } : {}),
            });
            notifySuccess("회원 정보가 수정되었습니다.");
            navigate("/app/mypage");
        } catch (err) {
            notifyError(extractMypageErrorMessage(err, "회원 정보 수정에 실패했습니다."));
        } finally {
            setSaving(false);
        }
    };

    const handleAddressResolved = ({ address }) => {
        if (!address) return;
        setForm((current) => ({ ...current, address }));
        setAddressModalOpen(false);
        notifySuccess("주소가 입력되었습니다.");
    };

    if (loading) {
        return <LoadingSpinner text="회원 정보를 불러오는 중입니다..." />;
    }

    if (error) {
        return <ErrorMessage message={error} onRetry={fetchMember} />;
    }

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <div className="flex items-center justify-between gap-3">
                <h1 className="text-2xl font-black text-ink">프로필 수정</h1>
                <button
                    type="button"
                    onClick={() => navigate("/app/mypage")}
                    className="btn-secondary min-h-11 px-4 py-3"
                >
                    <ArrowLeft className="h-4 w-4" />
                    마이페이지로
                </button>
            </div>

            <section className="surface-card space-y-8 p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-5">
                    <UserAvatar
                        name={member?.name}
                        profileUrl={member?.profileUrl}
                        level={level.level}
                        rewardTier={level.rewardTier}
                        frameCode={level.frameCode}
                        size="2xl"
                        className="rounded-2xl border border-line"
                        showLevelBadge
                    />

                    <label className="btn-secondary min-h-11 cursor-pointer px-4 py-3">
                        <Camera className="h-4 w-4" />
                        {uploading ? "업로드 중..." : "프로필 이미지 변경"}
                        <input type="file" accept={PROFILE_IMAGE_ACCEPT} className="hidden" onChange={handleProfileUpload} disabled={uploading} />
                    </label>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <Field label="이메일">
                        <input value={member?.email || ""} disabled className="input-base bg-control" />
                    </Field>

                    <Field label="이름">
                        <input name="name" value={form.name} onChange={handleChange} className="input-base" required />
                    </Field>

                    <Field label="전화번호">
                        <input name="phone" value={form.phone} onChange={handleChange} className="input-base" placeholder="010-0000-0000" required />
                    </Field>

                    <Field label="주소">
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <div className="relative min-w-0 flex-1">
                                <MapPin className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-subtle" />
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
                                className="btn-primary min-h-11 shrink-0 px-4 py-2"
                            >
                                주소 검색
                            </button>
                        </div>
                        <div className="relative mt-2">
                            <MapPin className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-subtle" />
                            <input
                                type="text"
                                name="addressDetail"
                                value={form.addressDetail}
                                onChange={handleChange}
                                className="input-base pl-12"
                                placeholder="상세 주소"
                            />
                        </div>
                    </Field>

                    {!oauthMember ? (
                        <Field label="현재 비밀번호">
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <input
                                    type="password"
                                    name="currentPassword"
                                    value={form.currentPassword}
                                    onChange={handleChange}
                                    className="input-base"
                                    placeholder="비밀번호 변경 시 입력"
                                />
                                <button
                                    type="button"
                                    onClick={handleVerifyCurrentPassword}
                                    disabled={verifyingPassword || !form.currentPassword.trim()}
                                    className={`min-h-11 shrink-0 rounded-xl border px-4 py-2 text-sm font-black transition ${
                                        passwordVerified
                                            ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                                            : "border-line bg-control text-ink-muted hover:bg-control-hover disabled:opacity-60"
                                    }`}
                                >
                                    {verifyingPassword ? "확인 중..." : passwordVerified ? "확인 완료" : "확인"}
                                </button>
                            </div>
                        </Field>
                    ) : (
                        <div className="rounded-xl border border-sky-100 bg-sky-50 p-4 text-sm font-semibold text-sky-800">
                            Google 계정은 현재 비밀번호 확인 없이 프로필 정보를 수정할 수 있습니다.
                        </div>
                    )}

                    <Field label="새 비밀번호">
                        <input
                            type="password"
                            name="password"
                            value={form.password}
                            onChange={handleChange}
                            className="input-base"
                            placeholder="변경할 때만 입력"
                        />
                    </Field>

                    <button
                        type="submit"
                        className="btn-primary inline-flex w-full items-center justify-center gap-2"
                        disabled={saving || !isDirty}
                        aria-busy={saving}
                    >
                        <Save className="h-4 w-4" />
                        {saving ? "저장 중..." : "수정 내용 저장"}
                    </button>
                </form>
            </section>

            {addressModalOpen ? (
                <div className="fixed inset-0 z-[90] bg-slate-900/45 p-4">
                    <div className="modal-panel mx-auto mt-20 w-full max-w-xl p-5">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-black text-ink">주소 검색</h3>
                            <button
                                type="button"
                                onClick={() => setAddressModalOpen(false)}
                                className="icon-button"
                                aria-label="주소 검색 닫기"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <AddressSearchBox onResolved={handleAddressResolved} placeholder="예: 서울시청, 서울역, 강남역" />
                        <div className="mt-3 text-xs font-semibold text-ink-muted">
                            검색 결과를 선택하면 주소 입력칸에 자동으로 반영됩니다.
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

const Field = ({ label, children }) => (
    <div>
        <label className="mb-2 block text-sm font-black text-ink-muted">{label}</label>
        {children}
    </div>
);

export default MypageEdit;
