import { useEffect, useMemo, useState } from "react";
import { ShieldAlert, UserSearch, EyeOff, RotateCcw, RefreshCw } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { isAdminUser } from "../../utils/authorization.js";
import { confirmAction } from "../../common/confirmAction.jsx";
import { notifyError, notifyLoading, notifySuccess } from "../../utils/toast.js";
import {
    ADMIN_BANNER_LIMITS,
    ADMIN_MODERATION_REASON_MAX_LENGTH,
    MEMBER_SEARCH_KEYWORD_MAX_LENGTH,
    adminOperationsAdapter,
    adminOperationsErrorMessage,
} from "../../adapters/adminOperationsAdapter.js";

export const AdminOperations = () => {
    const { user } = useAuth();
    const isAdmin = useMemo(() => isAdminUser(user), [user]);

    const [targetType, setTargetType] = useState("BOARD");
    const [bulkKeyword, setBulkKeyword] = useState("");
    const [bulkHiddenFilter, setBulkHiddenFilter] = useState("ALL");
    const [reason, setReason] = useState("");
    const [moderationItems, setModerationItems] = useState([]);
    const [moderationLoading, setModerationLoading] = useState(false);
    const [moderationError, setModerationError] = useState("");
    const [selectedIds, setSelectedIds] = useState([]);
    const [batchLoading, setBatchLoading] = useState(false);
    const [batchError, setBatchError] = useState("");
    const [batchResult, setBatchResult] = useState(null);

    const [memberIdInput, setMemberIdInput] = useState("");
    const [memberKeyword, setMemberKeyword] = useState("");
    const [memberCandidates, setMemberCandidates] = useState([]);
    const [memberSearchLoading, setMemberSearchLoading] = useState(false);
    const [memberSearchError, setMemberSearchError] = useState("");
    const [memberLoading, setMemberLoading] = useState(false);
    const [memberError, setMemberError] = useState("");
    const [memberDetail, setMemberDetail] = useState(null);

    const [bannerLoading, setBannerLoading] = useState(false);
    const [bannerSaving, setBannerSaving] = useState(false);
    const [bannerError, setBannerError] = useState("");
    const [banners, setBanners] = useState([]);
    const [editingBannerId, setEditingBannerId] = useState(null);
    const [bannerForm, setBannerForm] = useState({
        bannerType: "NOTICE",
        placement: "HOME_HERO",
        title: "",
        description: "",
        imageUrl: "",
        linkUrl: "",
        ctaText: "",
        renderMode: "CONTENT",
        adProvider: "",
        adsenseClient: "",
        adsenseSlot: "",
        priority: 100,
        startAt: "",
        endAt: "",
        targetAudience: "ALL",
        activeYn: true,
    });

    const updateBannerTextField = (field, value, maxLength) => {
        setBannerForm((prev) => ({
            ...prev,
            [field]: String(value || "").slice(0, maxLength),
        }));
    };

    const updateBannerPriority = (value) => {
        const text = String(value ?? "");
        if (!text) {
            setBannerForm((prev) => ({ ...prev, priority: "" }));
            return;
        }
        const parsed = Number(text);
        if (!Number.isFinite(parsed)) return;
        const clamped = Math.min(
            ADMIN_BANNER_LIMITS.priorityMax,
            Math.max(ADMIN_BANNER_LIMITS.priorityMin, Math.trunc(parsed)),
        );
        setBannerForm((prev) => ({ ...prev, priority: String(clamped) }));
    };

    const filteredModerationItems = useMemo(() => {
        const keyword = String(bulkKeyword || "").trim().toLowerCase();
        return (moderationItems || []).filter((item) => {
            const hidden = Boolean(item.hiddenYn);
            if (bulkHiddenFilter === "HIDDEN" && !hidden) return false;
            if (bulkHiddenFilter === "VISIBLE" && hidden) return false;

            if (!keyword) return true;
            const id = item.id;
            const primary = String(item.primaryText || "").toLowerCase();
            const secondary = String(item.secondaryText || "").toLowerCase();
            return String(id || "").includes(keyword) || primary.includes(keyword) || secondary.includes(keyword);
        });
    }, [bulkHiddenFilter, bulkKeyword, moderationItems]);

    const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

    const fetchModerationItems = async (nextTargetType = targetType) => {
        setModerationLoading(true);
        setModerationError("");
        try {
            const items = await adminOperationsAdapter.fetchModerationItems(nextTargetType);
            setModerationItems(items);
        } catch (err) {
            setModerationItems([]);
            setModerationError(adminOperationsErrorMessage(err, "검토 목록을 불러오지 못했습니다."));
        } finally {
            setModerationLoading(false);
        }
    };

    useEffect(() => {
        setSelectedIds([]);
        setBatchResult(null);
        fetchModerationItems();
    }, [targetType]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchMemberCandidates(memberKeyword);
        }, 250);
        return () => clearTimeout(timer);
    }, [memberKeyword]);

    useEffect(() => {
        fetchAdminBanners();
    }, []);

    const submitBatchModeration = async (actionType) => {
        const ids = [...new Set(selectedIds)].filter((value) => Number.isFinite(Number(value)) && Number(value) > 0);
        if (!ids.length) {
            notifyError("항목을 하나 이상 선택하세요.");
            return;
        }

        setBatchLoading(true);
        setBatchError("");
        try {
            const data = await adminOperationsAdapter.updateModerationBatch({
                targetType,
                ids,
                hiddenYn: actionType === "HIDE",
                reason,
            });
            setBatchResult(data);
            await fetchModerationItems(targetType);
            setSelectedIds([]);
            notifySuccess(actionType === "HIDE" ? "선택 항목을 숨김 처리했습니다." : "선택 항목을 공개 처리했습니다.");
        } catch (err) {
            const message = adminOperationsErrorMessage(err, "일괄 처리에 실패했습니다.");
            setBatchError(message);
            notifyError(message);
        } finally {
            setBatchLoading(false);
        }
    };

    const toggleSelectId = (id) => {
        const normalized = Number(id);
        if (!Number.isFinite(normalized) || normalized <= 0) return;
        setSelectedIds((prev) => (
            prev.includes(normalized)
                ? prev.filter((item) => item !== normalized)
                : [...prev, normalized]
        ));
    };

    const selectAllFiltered = () => {
        const allIds = filteredModerationItems
            .map((item) => item.id)
            .filter((id) => Number.isFinite(id) && id > 0);
        setSelectedIds((prev) => [...new Set([...prev, ...allIds])]);
    };

    const clearSelected = () => setSelectedIds([]);

    const fetchAdminBanners = async () => {
        setBannerLoading(true);
        setBannerError("");
        try {
            const items = await adminOperationsAdapter.fetchBanners();
            setBanners(items);
        } catch (err) {
            setBanners([]);
            setBannerError(adminOperationsErrorMessage(err, "배너 목록을 불러오지 못했습니다."));
        } finally {
            setBannerLoading(false);
        }
    };

    const resetBannerForm = () => {
        setEditingBannerId(null);
        setBannerForm({
            bannerType: "NOTICE",
            placement: "HOME_HERO",
            title: "",
            description: "",
            imageUrl: "",
            linkUrl: "",
            ctaText: "",
            renderMode: "CONTENT",
            adProvider: "",
            adsenseClient: "",
            adsenseSlot: "",
            priority: 100,
            startAt: "",
            endAt: "",
            targetAudience: "ALL",
            activeYn: true,
        });
    };

    const submitBannerForm = async () => {
        const title = String(bannerForm.title || "").trim();
        if (!title) {
            notifyError("배너 제목을 입력하세요.");
            return;
        }
        const isAdsense = String(bannerForm.renderMode || "").toUpperCase() === "ADSENSE";
        if (isAdsense) {
            if (!String(bannerForm.adProvider || "").trim()) {
                notifyError("애드센스 모드에서는 광고 제공자를 입력해야 합니다.");
                return;
            }
            if (!String(bannerForm.adsenseClient || "").trim() || !String(bannerForm.adsenseSlot || "").trim()) {
                notifyError("애드센스 클라이언트 ID와 슬롯 ID를 모두 입력해야 합니다.");
                return;
            }
        }
        setBannerSaving(true);
        try {
            await adminOperationsAdapter.saveBanner({ bannerId: editingBannerId, form: bannerForm });
            notifySuccess(editingBannerId ? "배너를 수정했습니다." : "배너를 생성했습니다.");
            await fetchAdminBanners();
            resetBannerForm();
        } catch (err) {
            notifyError(adminOperationsErrorMessage(err, "배너 저장에 실패했습니다."));
        } finally {
            setBannerSaving(false);
        }
    };

    const toggleBannerActive = async (banner) => {
        const bannerId = Number(banner.bannerId || 0);
        if (!bannerId) return;
        const nextActive = !Boolean(banner.activeYn);
        const loadingToast = await notifyLoading("배너 상태를 변경하는 중입니다...");
        try {
            await adminOperationsAdapter.updateBannerActive({ bannerId, activeYn: nextActive });
            await fetchAdminBanners();
            loadingToast.success(nextActive ? "배너를 활성화했습니다." : "배너를 비활성화했습니다.");
        } catch (err) {
            loadingToast.error(adminOperationsErrorMessage(err, "배너 상태 변경에 실패했습니다."));
        }
    };

    const removeBanner = async (banner) => {
        const bannerId = Number(banner.bannerId || 0);
        if (!bannerId) return;
        const confirmed = await confirmAction({
            title: "배너를 삭제할까요?",
            description: "운영 노출 목록에서 즉시 제거됩니다.",
            confirmText: "삭제",
        });
        if (!confirmed) return;
        const loadingToast = await notifyLoading("배너를 삭제하는 중입니다...");
        try {
            await adminOperationsAdapter.deleteBanner(bannerId);
            await fetchAdminBanners();
            if (editingBannerId === bannerId) resetBannerForm();
            loadingToast.success("배너를 삭제했습니다.");
        } catch (err) {
            loadingToast.error(adminOperationsErrorMessage(err, "배너 삭제에 실패했습니다."));
        }
    };

    const startEditBanner = (banner) => {
        const bannerId = Number(banner.bannerId || 0);
        if (!bannerId) return;
        setEditingBannerId(bannerId);
        setBannerForm({
            bannerType: banner.bannerType || "NOTICE",
            placement: banner.placement || "HOME_HERO",
            title: banner.title || "",
            description: banner.description || "",
            imageUrl: banner.imageUrl || "",
            linkUrl: banner.linkUrl || "",
            ctaText: banner.ctaText || "",
            renderMode: banner.renderMode || "CONTENT",
            adProvider: banner.adProvider || "",
            adsenseClient: banner.adsenseClient || "",
            adsenseSlot: banner.adsenseSlot || "",
            priority: Number(banner.priority) || 100,
            startAt: String(banner.startAt || "").slice(0, 16),
            endAt: String(banner.endAt || "").slice(0, 16),
            targetAudience: banner.targetAudience || "ALL",
            activeYn: Boolean(banner.activeYn),
        });
    };

    const fetchMemberCandidates = async (keyword) => {
        const trimmed = String(keyword || "").trim();
        if (!trimmed) {
            setMemberCandidates([]);
            setMemberSearchError("");
            return;
        }

        setMemberSearchLoading(true);
        setMemberSearchError("");
        try {
            const items = await adminOperationsAdapter.fetchMemberCandidates(trimmed);
            setMemberCandidates(items);
        } catch (err) {
            setMemberCandidates([]);
            setMemberSearchError(adminOperationsErrorMessage(err, "회원을 검색하지 못했습니다."));
        } finally {
            setMemberSearchLoading(false);
        }
    };

    const fetchMemberDetail = async (memberIdOverride) => {
        const memberId = Number(memberIdOverride ?? memberIdInput);
        if (!Number.isFinite(memberId) || memberId <= 0) {
            notifyError("올바른 회원 ID를 입력하세요.");
            return;
        }

        setMemberLoading(true);
        setMemberError("");
        try {
            const data = await adminOperationsAdapter.fetchMemberDetail(memberId);
            setMemberDetail(data);
        } catch (err) {
            const message = adminOperationsErrorMessage(err, "회원 상세 정보를 불러오지 못했습니다.");
            setMemberError(message);
            setMemberDetail(null);
            notifyError(message);
        } finally {
            setMemberLoading(false);
        }
    };

    const selectCandidate = async (member) => {
        const memberId = member.memberId;
        if (!memberId) {
            notifyError("선택한 회원 정보를 확인할 수 없습니다.");
            return;
        }
        setMemberIdInput(String(memberId));
        setMemberKeyword(`${member.name || ""} (${member.email || ""})`);
        setMemberCandidates([]);
        await fetchMemberDetail(memberId);
    };

    if (!isAdmin) {
        return (
            <section className="rounded-[2rem] border border-rose-100 bg-rose-50/50 p-10 text-rose-800 text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                    <ShieldAlert className="h-8 w-8 text-rose-500" />
                </div>
                <h1 className="text-xl font-black">관리자 전용 페이지</h1>
                <p className="text-sm font-medium opacity-70">관리자 또는 마스터 권한이 필요합니다.</p>
            </section>
        );
    }

    const memberInfo = memberDetail?.memberInfo || {};
    const recentBoards = memberDetail?.recentBoards || [];
    const recentComments = memberDetail?.recentComments || [];
    const sanctions = memberDetail?.sanctions || [];
    const receivedReports = memberDetail?.receivedReports || [];
    const madeReports = memberDetail?.madeReports || [];

    return (
        <section className="space-y-8 animate-fade-in pb-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900">관리자 운영 도구</h1>
                    <p className="text-sm font-medium text-slate-400">콘텐츠 일괄 조치와 회원 상세 정보를 한 화면에서 처리합니다.</p>
                </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6">
                <h2 className="text-base font-black text-slate-900">사용 방법</h2>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-2xl bg-white p-4">
                        <div className="text-xs font-black tracking-widest text-primary-600">일괄 검토</div>
                        <p className="mt-2 text-sm text-slate-600">
                            게시글/댓글을 검색하고 여러 대상을 선택한 뒤 숨김 또는 복구를 한 번에 실행합니다.
                        </p>
                    </div>
                    <div className="rounded-2xl bg-white p-4">
                        <div className="text-xs font-black tracking-widest text-primary-600">회원 360 상세</div>
                        <p className="mt-2 text-sm text-slate-600">
                            회원을 검색해 프로필, 최근 활동, 제재, 신고 이력을 한 화면에서 확인합니다.
                        </p>
                    </div>
                </div>
                <p className="mt-4 text-xs font-semibold text-slate-500">
                    모든 관리자 조치는 감사 로그에 기록됩니다.
                </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="card p-8 space-y-5">
                    <h2 className="text-lg font-black text-slate-900">콘텐츠 일괄 검토</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <select className="input-base" value={targetType} onChange={(e) => setTargetType(e.target.value)}>
                            <option value="BOARD">게시글</option>
                            <option value="COMMENT">댓글</option>
                        </select>
                        <select className="input-base" value={bulkHiddenFilter} onChange={(e) => setBulkHiddenFilter(e.target.value)}>
                            <option value="ALL">전체 상태</option>
                            <option value="VISIBLE">공개 항목만</option>
                            <option value="HIDDEN">숨김 항목만</option>
                        </select>
                        <button
                            className="btn-primary"
                            disabled={batchLoading}
                            onClick={() => submitBatchModeration("HIDE")}
                        >
                            {batchLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4" />}
                            <span className="ml-2">선택 숨김</span>
                        </button>
                        <button
                            className="btn-secondary"
                            disabled={batchLoading}
                            onClick={() => submitBatchModeration("RECOVER")}
                        >
                            {batchLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                            <span className="ml-2">선택 복구</span>
                        </button>
                    </div>

                    <input
                        className="input-base"
                        value={bulkKeyword}
                        onChange={(e) => setBulkKeyword(e.target.value)}
                        placeholder="ID, 제목, 내용, 작성자로 검색"
                    />

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <button
                            type="button"
                            className="rounded-xl bg-slate-100 px-3 py-1.5 font-black text-slate-700 hover:bg-slate-200"
                            onClick={selectAllFiltered}
                            disabled={!filteredModerationItems.length}
                        >
                            필터 결과 전체 선택
                        </button>
                        <button
                            type="button"
                            className="rounded-xl bg-slate-100 px-3 py-1.5 font-black text-slate-700 hover:bg-slate-200"
                            onClick={clearSelected}
                            disabled={!selectedIds.length}
                        >
                            선택 해제
                        </button>
                        <span className="font-semibold text-slate-500">선택: {selectedIds.length}</span>
                    </div>

                    {moderationLoading ? (
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 text-sm text-slate-500">
                            검토 목록을 불러오는 중입니다...
                        </div>
                    ) : moderationError ? (
                        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                            {moderationError}
                        </div>
                    ) : !filteredModerationItems.length ? (
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 text-sm text-slate-500">
                            조건에 맞는 항목이 없습니다.
                        </div>
                    ) : (
                        <div className="max-h-56 overflow-auto rounded-2xl border border-slate-100 bg-slate-50/40 p-2 space-y-2">
                            {filteredModerationItems.map((item, idx) => {
                                const id = item.id;
                                if (!id) return null;
                                const checked = selectedIdSet.has(id);
                                const hidden = Boolean(item.hiddenYn);
                                return (
                                    <label
                                        key={`${targetType}-${id}-${idx}`}
                                        className={`flex cursor-pointer items-start justify-between gap-3 rounded-xl border px-3 py-2 ${checked ? "border-primary-300 bg-primary-50" : "border-slate-100 bg-white"}`}
                                    >
                                        <div className="flex items-start gap-2">
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggleSelectId(id)}
                                                className="mt-1"
                                            />
                                            <div>
                                                <div className="text-xs font-black text-slate-800">#{id} {item.primaryText}</div>
                                                <div className="text-[11px] text-slate-500">{item.secondaryText}</div>
                                            </div>
                                        </div>
                                        <span className={`rounded-lg px-2 py-0.5 text-[10px] font-black ${hidden ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                                            {hidden ? "숨김" : "공개"}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    )}

                    <input
                        className="input-base"
                        value={reason}
                        onChange={(e) => setReason(e.target.value.slice(0, ADMIN_MODERATION_REASON_MAX_LENGTH))}
                        placeholder="사유 (선택, 최대 500자)"
                        maxLength={ADMIN_MODERATION_REASON_MAX_LENGTH}
                    />

                    {batchError ? (
                        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                            {batchError}
                        </div>
                    ) : null}

                    {batchResult ? (
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-sm space-y-1">
                            <div><b>요청:</b> {batchResult.totalRequested}</div>
                            <div><b>처리됨:</b> {batchResult.processedCount}</div>
                            <div><b>실패 ID:</b> {(batchResult.failedIds || []).join(", ") || "없음"}</div>
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 text-sm text-slate-500">
                            목록에서 대상을 선택한 뒤 일괄 조치를 실행하세요.
                        </div>
                    )}
                </div>

                <div className="card p-8 space-y-5">
                    <h2 className="text-lg font-black text-slate-900">회원 360 상세</h2>
                    <div className="space-y-2">
                        <input
                            className="input-base"
                            value={memberKeyword}
                            onChange={(e) => setMemberKeyword(e.target.value.slice(0, MEMBER_SEARCH_KEYWORD_MAX_LENGTH))}
                            maxLength={MEMBER_SEARCH_KEYWORD_MAX_LENGTH}
                            placeholder="이름 또는 이메일로 회원 검색"
                        />
                        <p className="text-right text-[11px] font-semibold text-slate-400">
                            검색어 {memberKeyword.length}/{MEMBER_SEARCH_KEYWORD_MAX_LENGTH}자
                        </p>
                        {memberSearchLoading ? (
                            <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-3 text-xs font-semibold text-slate-500">
                                회원을 검색하는 중입니다...
                            </div>
                        ) : null}
                        {memberSearchError ? (
                            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
                                {memberSearchError}
                            </div>
                        ) : null}
                        {memberCandidates.length ? (
                            <div className="max-h-44 overflow-auto rounded-2xl border border-slate-100 bg-slate-50/50 p-2 space-y-2">
                                {memberCandidates.map((member, idx) => {
                                    const candidateId = member.memberId;
                                    return (
                                        <button
                                            key={candidateId || `member-candidate-${idx}`}
                                            type="button"
                                            onClick={() => selectCandidate(member)}
                                            className="w-full rounded-xl bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-primary-50"
                                        >
                                            <div>{member.name || "(이름 없음)"} ({member.email || "-"})</div>
                                            <div className="text-[10px] text-slate-400">#{candidateId || "-"}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : String(memberKeyword || "").trim() ? (
                            <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-3 text-xs font-semibold text-slate-500">
                                검색 결과가 없습니다.
                            </div>
                        ) : null}
                    </div>
                    <div className="flex gap-3">
                        <input
                            className="input-base flex-1"
                            value={memberIdInput}
                            onChange={(e) => setMemberIdInput(e.target.value)}
                            placeholder="회원 ID 입력"
                        />
                        <button className="btn-primary" disabled={memberLoading} aria-busy={memberLoading} onClick={fetchMemberDetail}>
                            {memberLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UserSearch className="h-4 w-4" />}
                            <span className="ml-2">조회</span>
                        </button>
                    </div>

                    {memberError ? (
                        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                            {memberError}
                        </div>
                    ) : null}

                    {!memberLoading && !memberError && !memberDetail ? (
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 text-sm text-slate-500">
                            회원 ID를 입력하고 조회하세요.
                        </div>
                    ) : null}
                </div>
            </div>

            <div className="card p-8 space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-black text-slate-900">배너 관리</h2>
                    <button
                        type="button"
                        className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-200"
                        onClick={fetchAdminBanners}
                        disabled={bannerLoading}
                        aria-busy={bannerLoading}
                        data-busy-indicator="true"
                    >
                        {bannerLoading ? "새로고침 중..." : "새로고침"}
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <select className="input-base" value={bannerForm.bannerType} onChange={(e) => setBannerForm((prev) => ({ ...prev, bannerType: e.target.value }))}>
                        <option value="NOTICE">공지</option>
                        <option value="AD">광고</option>
                    </select>
                    <select className="input-base" value={bannerForm.renderMode} onChange={(e) => setBannerForm((prev) => ({ ...prev, renderMode: e.target.value }))}>
                        <option value="CONTENT">콘텐츠</option>
                        <option value="ADSENSE">애드센스</option>
                    </select>
                    <select className="input-base" value={bannerForm.targetAudience} onChange={(e) => setBannerForm((prev) => ({ ...prev, targetAudience: e.target.value }))}>
                        <option value="ALL">전체</option>
                        <option value="GUEST">방문자</option>
                        <option value="USER">회원</option>
                        <option value="ADMIN">관리자</option>
                    </select>
                    <input className="input-base" value={bannerForm.adProvider} onChange={(e) => updateBannerTextField("adProvider", e.target.value, ADMIN_BANNER_LIMITS.adProvider)} maxLength={ADMIN_BANNER_LIMITS.adProvider} placeholder="광고 제공자 코드 (예: ADSENSE)" />
                    <input className="input-base md:col-span-2" value={bannerForm.title} onChange={(e) => updateBannerTextField("title", e.target.value, ADMIN_BANNER_LIMITS.title)} maxLength={ADMIN_BANNER_LIMITS.title} placeholder="배너 제목" />
                    <textarea className="input-base md:col-span-2 min-h-[88px]" value={bannerForm.description} onChange={(e) => updateBannerTextField("description", e.target.value, ADMIN_BANNER_LIMITS.description)} maxLength={ADMIN_BANNER_LIMITS.description} placeholder="배너 설명" />
                    <input className="input-base md:col-span-2" value={bannerForm.imageUrl} onChange={(e) => updateBannerTextField("imageUrl", e.target.value, ADMIN_BANNER_LIMITS.imageUrl)} maxLength={ADMIN_BANNER_LIMITS.imageUrl} placeholder="이미지 URL (선택)" />
                    <input className="input-base md:col-span-2" value={bannerForm.linkUrl} onChange={(e) => updateBannerTextField("linkUrl", e.target.value, ADMIN_BANNER_LIMITS.linkUrl)} maxLength={ADMIN_BANNER_LIMITS.linkUrl} placeholder="연결 URL (선택)" />
                    <input className="input-base" value={bannerForm.ctaText} onChange={(e) => updateBannerTextField("ctaText", e.target.value, ADMIN_BANNER_LIMITS.ctaText)} maxLength={ADMIN_BANNER_LIMITS.ctaText} placeholder="버튼 문구 (선택)" />
                    <input className="input-base" value={bannerForm.adsenseClient} onChange={(e) => updateBannerTextField("adsenseClient", e.target.value, ADMIN_BANNER_LIMITS.adsenseClient)} maxLength={ADMIN_BANNER_LIMITS.adsenseClient} placeholder="애드센스 클라이언트 (ca-pub-...)" />
                    <input className="input-base" value={bannerForm.adsenseSlot} onChange={(e) => updateBannerTextField("adsenseSlot", e.target.value, ADMIN_BANNER_LIMITS.adsenseSlot)} maxLength={ADMIN_BANNER_LIMITS.adsenseSlot} placeholder="애드센스 슬롯 ID" />
                    <input className="input-base" type="number" min={ADMIN_BANNER_LIMITS.priorityMin} max={ADMIN_BANNER_LIMITS.priorityMax} value={bannerForm.priority} onChange={(e) => updateBannerPriority(e.target.value)} placeholder="우선순위" />
                    <input className="input-base" type="datetime-local" value={bannerForm.startAt} onChange={(e) => setBannerForm((prev) => ({ ...prev, startAt: e.target.value }))} />
                    <input className="input-base" type="datetime-local" value={bannerForm.endAt} onChange={(e) => setBannerForm((prev) => ({ ...prev, endAt: e.target.value }))} />
                    <label className="md:col-span-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <input type="checkbox" checked={bannerForm.activeYn} onChange={(e) => setBannerForm((prev) => ({ ...prev, activeYn: e.target.checked }))} />
                        사용 중
                    </label>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button className="btn-primary" type="button" onClick={submitBannerForm} disabled={bannerSaving} aria-busy={bannerSaving} data-busy-indicator="true">
                        {bannerSaving ? "저장 중..." : editingBannerId ? "배너 수정" : "배너 생성"}
                    </button>
                    {editingBannerId ? (
                        <button className="btn-secondary" type="button" onClick={resetBannerForm} disabled={bannerSaving}>
                            수정 취소
                        </button>
                    ) : null}
                </div>

                {bannerError ? (
                    <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                        {bannerError}
                    </div>
                ) : null}

                {!banners.length ? (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 text-sm text-slate-500">
                        등록된 배너가 없습니다.
                    </div>
                ) : (
                    <div className="space-y-3 max-h-[420px] overflow-auto pr-1">
                        {banners.map((banner, idx) => {
                            const bannerId = Number(banner.bannerId || 0);
                            const activeYn = Boolean(banner.activeYn);
                            const selected = editingBannerId === bannerId;
                            return (
                                <div
                                    key={bannerId || `banner-${idx}`}
                                    className={`rounded-2xl border p-4 cursor-pointer ${selected ? "border-primary-300 bg-primary-50/40" : "border-slate-100 bg-slate-50/30"}`}
                                    onClick={() => startEditBanner(banner)}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-black text-slate-900">#{bannerId} {banner.title || "-"}</div>
                                            <div className="mt-1 text-[11px] text-slate-500">
                                                {banner.bannerTypeLabel || "-"} | {banner.renderModeLabel || "-"} | {banner.targetAudienceLabel || "-"} | 우선순위 {banner.priority || 0}
                                            </div>
                                        </div>
                                        <span className={`rounded-lg px-2 py-0.5 text-[10px] font-black ${activeYn ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                                            {activeYn ? "활성" : "비활성"}
                                        </span>
                                    </div>
                                    <p className="mt-2 text-xs text-slate-600">{banner.description || ""}</p>
                                    {(banner.adProvider || banner.adsenseClient) ? (
                                        <div className="mt-2 text-[11px] text-slate-500">
                                            제공자: {banner.adProvider || "-"} | 클라이언트 ID: {banner.adsenseClient || "-"} | 슬롯 ID: {banner.adsenseSlot || "-"}
                                        </div>
                                    ) : null}
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <button type="button" className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-black text-white hover:bg-primary-600" onClick={(e) => { e.stopPropagation(); startEditBanner(banner); }}>수정</button>
                                        <button type="button" className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-200" onClick={(e) => { e.stopPropagation(); toggleBannerActive(banner); }}>
                                            {activeYn ? "비활성화" : "활성화"}
                                        </button>
                                        <button type="button" className="rounded-xl bg-rose-100 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-200" onClick={(e) => { e.stopPropagation(); removeBanner(banner); }}>삭제</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {memberDetail ? (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="card p-6 xl:col-span-1 space-y-3">
                        <h3 className="text-base font-black text-slate-900">기본 정보</h3>
                        <div className="text-sm"><b>ID:</b> {memberInfo.memberId || "-"}</div>
                        <div className="text-sm"><b>이메일:</b> {memberInfo.email || "-"}</div>
                        <div className="text-sm"><b>이름:</b> {memberInfo.name || "-"}</div>
                        <div className="text-sm"><b>상태:</b> {memberInfo.memberStatusLabel || "-"}</div>
                        <div className="text-sm"><b>권한:</b> {(memberInfo.roleLabels || []).join(", ") || "-"}</div>
                        <div className="text-sm"><b>포인트:</b> {memberInfo.point || 0}</div>
                        <div className="text-sm"><b>나무:</b> {memberInfo.treeCount || 0}</div>
                        <div className="text-sm"><b>게시글:</b> {memberInfo.boardCount || 0}</div>
                        <div className="text-sm"><b>댓글:</b> {memberInfo.commentCount || 0}</div>
                    </div>

                    <div className="card p-6 xl:col-span-2">
                        <h3 className="mb-3 text-base font-black text-slate-900">최근 게시글 / 댓글</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="rounded-2xl bg-slate-50/50 p-4">
                                <div className="mb-2 text-xs font-black text-slate-500">최근 게시글</div>
                                {!recentBoards.length ? <div className="text-xs text-slate-400">데이터 없음</div> : (
                                    <ul className="space-y-2 text-sm">
                                        {recentBoards.map((board, idx) => (
                                            <li key={`${board.boardId || idx}-${idx}`} className="flex items-center justify-between gap-2">
                                                <span className="truncate">#{board.boardId || "-"} {board.title || "-"}</span>
                                                <span className={`text-[10px] font-black ${board.hiddenYn ? "text-rose-600" : "text-emerald-600"}`}>
                                                    {board.hiddenYn ? "숨김" : "공개"}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <div className="rounded-2xl bg-slate-50/50 p-4">
                                <div className="mb-2 text-xs font-black text-slate-500">최근 댓글</div>
                                {!recentComments.length ? <div className="text-xs text-slate-400">데이터 없음</div> : (
                                    <ul className="space-y-2 text-sm">
                                        {recentComments.map((comment, idx) => (
                                            <li key={`${comment.commentId || idx}-${idx}`} className="flex items-center justify-between gap-2">
                                                <span className="truncate">#{comment.commentId || "-"} {comment.contents || "-"}</span>
                                                <span className={`text-[10px] font-black ${comment.hiddenYn ? "text-rose-600" : "text-emerald-600"}`}>
                                                    {comment.hiddenYn ? "숨김" : "공개"}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="card p-6 xl:col-span-3 grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="rounded-2xl bg-slate-50/50 p-4">
                            <div className="mb-2 text-xs font-black text-slate-500">제재 이력</div>
                            {!sanctions.length ? <div className="text-xs text-slate-400">데이터 없음</div> : (
                                <ul className="space-y-2 text-sm">
                                    {sanctions.map((item, idx) => (
                                        <li key={`${item.sanctionId || idx}-${idx}`}>
                                            #{item.sanctionId || "-"} {item.sanctionStatusLabel || "-"}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div className="rounded-2xl bg-slate-50/50 p-4">
                            <div className="mb-2 text-xs font-black text-slate-500">받은 신고</div>
                            {!receivedReports.length ? <div className="text-xs text-slate-400">데이터 없음</div> : (
                                <ul className="space-y-2 text-sm">
                                    {receivedReports.map((item, idx) => (
                                        <li key={`${item.reportId || idx}-${idx}`}>
                                            #{item.reportId || "-"} {item.reportStatusLabel || "-"}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div className="rounded-2xl bg-slate-50/50 p-4">
                            <div className="mb-2 text-xs font-black text-slate-500">작성한 신고</div>
                            {!madeReports.length ? <div className="text-xs text-slate-400">데이터 없음</div> : (
                                <ul className="space-y-2 text-sm">
                                    {madeReports.map((item, idx) => (
                                        <li key={`${item.reportId || idx}-${idx}`}>
                                            #{item.reportId || "-"} {item.reportStatusLabel || "-"}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
        </section>
    );
};
