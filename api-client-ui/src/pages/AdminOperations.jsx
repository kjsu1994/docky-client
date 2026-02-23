import { useEffect, useMemo, useState } from "react";
import { ShieldAlert, UserSearch, EyeOff, RotateCcw, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import api from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import { isAdminUser } from "../utils/authorization";

const unwrapData = (payload) => payload?.data?.data ?? payload?.data ?? payload ?? null;

const pick = (obj, camel, snake, fallback = null) => {
    if (!obj || typeof obj !== "object") return fallback;
    if (Object.prototype.hasOwnProperty.call(obj, camel) && obj[camel] !== undefined) return obj[camel];
    if (Object.prototype.hasOwnProperty.call(obj, snake) && obj[snake] !== undefined) return obj[snake];
    return fallback;
};

const getMemberIdValue = (member) => {
    const raw = pick(member, "memberId", "member_id", null);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
};

const getModerationItemId = (item, targetType) => {
    const raw = targetType === "BOARD"
        ? pick(item, "boardId", "board_id", null)
        : pick(item, "commentId", "comment_id", null);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
};

const getModerationItemHidden = (item) => Boolean(pick(item, "hiddenYn", "hidden_yn", false));

const getModerationPrimaryText = (item, targetType) => {
    if (targetType === "BOARD") return pick(item, "title", "title", "(No title)");
    return pick(item, "contents", "contents", "(No contents)");
};

const getModerationSecondaryText = (item, targetType) => {
    if (targetType === "BOARD") return pick(item, "boardCreator", "board_creator", "-");
    return pick(item, "writerName", "writer_name", "-");
};

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

    const filteredModerationItems = useMemo(() => {
        const keyword = String(bulkKeyword || "").trim().toLowerCase();
        return (moderationItems || []).filter((item) => {
            const hidden = getModerationItemHidden(item);
            if (bulkHiddenFilter === "HIDDEN" && !hidden) return false;
            if (bulkHiddenFilter === "VISIBLE" && hidden) return false;

            if (!keyword) return true;
            const id = getModerationItemId(item, targetType);
            const primary = getModerationPrimaryText(item, targetType).toLowerCase();
            const secondary = getModerationSecondaryText(item, targetType).toLowerCase();
            return String(id || "").includes(keyword) || primary.includes(keyword) || secondary.includes(keyword);
        });
    }, [bulkHiddenFilter, bulkKeyword, moderationItems, targetType]);

    const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

    const fetchModerationItems = async (nextTargetType = targetType) => {
        setModerationLoading(true);
        setModerationError("");
        try {
            const endpoint = nextTargetType === "BOARD" ? "/admin/moderation/boards" : "/admin/moderation/comments";
            const response = await api.get(endpoint, {
                params: { page: 1, size: 100 },
            });
            const payload = unwrapData(response.data);
            const items = payload?.items || payload?.content || payload?.data || payload || [];
            setModerationItems(Array.isArray(items) ? items : []);
        } catch (err) {
            setModerationItems([]);
            setModerationError(err?.response?.data?.message || "Failed to load moderation list.");
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
            toast.error("Select at least one item.");
            return;
        }

        const endpoint = targetType === "BOARD" ? "/admin/moderation/boards/batch" : "/admin/moderation/comments/batch";
        const payload = {
            ids,
            hidden_yn: actionType === "HIDE",
            reason: reason.trim() || null,
        };

        setBatchLoading(true);
        setBatchError("");
        try {
            const response = await api.patch(endpoint, payload);
            const data = unwrapData(response.data) || {};
            setBatchResult(data);
            await fetchModerationItems(targetType);
            setSelectedIds([]);
            toast.success(actionType === "HIDE" ? "Selected items are now hidden." : "Selected items are now visible.");
        } catch (err) {
            const message = err?.response?.data?.message || "Bulk moderation failed.";
            setBatchError(message);
            toast.error(message);
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
            .map((item) => getModerationItemId(item, targetType))
            .filter((id) => Number.isFinite(id) && id > 0);
        setSelectedIds((prev) => [...new Set([...prev, ...allIds])]);
    };

    const clearSelected = () => setSelectedIds([]);

    const fetchAdminBanners = async () => {
        setBannerLoading(true);
        setBannerError("");
        try {
            const response = await api.get("/admin/banners", {
                params: { page: 1, size: 50 },
            });
            const payload = unwrapData(response.data);
            const items = payload?.items || payload?.content || payload?.data || payload || [];
            setBanners(Array.isArray(items) ? items : []);
        } catch (err) {
            setBanners([]);
            setBannerError(err?.response?.data?.message || "Failed to load banners.");
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
            toast.error("Banner title is required.");
            return;
        }
        const isAdsense = String(bannerForm.renderMode || "").toUpperCase() === "ADSENSE";
        if (isAdsense) {
            if (!String(bannerForm.adProvider || "").trim()) {
                toast.error("Ad provider is required for ADSENSE mode.");
                return;
            }
            if (!String(bannerForm.adsenseClient || "").trim() || !String(bannerForm.adsenseSlot || "").trim()) {
                toast.error("AdSense client and slot are required for ADSENSE mode.");
                return;
            }
        }
        const payload = {
            banner_type: bannerForm.bannerType,
            placement: bannerForm.placement,
            title,
            description: bannerForm.description || null,
            image_url: bannerForm.imageUrl || null,
            link_url: bannerForm.linkUrl || null,
            cta_text: bannerForm.ctaText || null,
            render_mode: bannerForm.renderMode || "CONTENT",
            ad_provider: bannerForm.adProvider || null,
            adsense_client: bannerForm.adsenseClient || null,
            adsense_slot: bannerForm.adsenseSlot || null,
            priority: Number(bannerForm.priority) || 0,
            start_at: bannerForm.startAt ? `${bannerForm.startAt}:00` : null,
            end_at: bannerForm.endAt ? `${bannerForm.endAt}:00` : null,
            target_audience: bannerForm.targetAudience,
            active_yn: Boolean(bannerForm.activeYn),
        };

        setBannerSaving(true);
        try {
            if (editingBannerId) {
                await api.patch(`/admin/banners/${editingBannerId}`, payload);
                toast.success("Banner updated.");
            } else {
                await api.post("/admin/banners", payload);
                toast.success("Banner created.");
            }
            await fetchAdminBanners();
            resetBannerForm();
        } catch (err) {
            toast.error(err?.response?.data?.message || "Failed to save banner.");
        } finally {
            setBannerSaving(false);
        }
    };

    const toggleBannerActive = async (banner) => {
        const bannerId = Number(pick(banner, "bannerId", "banner_id", 0));
        if (!bannerId) return;
        const nextActive = !Boolean(pick(banner, "activeYn", "active_yn", false));
        const toastId = toast.loading("Updating banner state...");
        try {
            await api.patch(`/admin/banners/${bannerId}/active`, { active_yn: nextActive });
            await fetchAdminBanners();
            toast.success(nextActive ? "Banner activated." : "Banner deactivated.", { id: toastId });
        } catch (err) {
            toast.error(err?.response?.data?.message || "Failed to update banner state.", { id: toastId });
        }
    };

    const removeBanner = async (banner) => {
        const bannerId = Number(pick(banner, "bannerId", "banner_id", 0));
        if (!bannerId) return;
        if (!window.confirm("Delete this banner?")) return;
        const toastId = toast.loading("Deleting banner...");
        try {
            await api.delete(`/admin/banners/${bannerId}`);
            await fetchAdminBanners();
            if (editingBannerId === bannerId) resetBannerForm();
            toast.success("Banner deleted.", { id: toastId });
        } catch (err) {
            toast.error(err?.response?.data?.message || "Failed to delete banner.", { id: toastId });
        }
    };

    const startEditBanner = (banner) => {
        const bannerId = Number(pick(banner, "bannerId", "banner_id", 0));
        if (!bannerId) return;
        setEditingBannerId(bannerId);
        setBannerForm({
            bannerType: pick(banner, "bannerType", "banner_type", "NOTICE"),
            placement: pick(banner, "placement", "placement", "HOME_HERO"),
            title: pick(banner, "title", "title", ""),
            description: pick(banner, "description", "description", ""),
            imageUrl: pick(banner, "imageUrl", "image_url", ""),
            linkUrl: pick(banner, "linkUrl", "link_url", ""),
            ctaText: pick(banner, "ctaText", "cta_text", ""),
            renderMode: pick(banner, "renderMode", "render_mode", "CONTENT"),
            adProvider: pick(banner, "adProvider", "ad_provider", ""),
            adsenseClient: pick(banner, "adsenseClient", "adsense_client", ""),
            adsenseSlot: pick(banner, "adsenseSlot", "adsense_slot", ""),
            priority: Number(pick(banner, "priority", "priority", 100)) || 100,
            startAt: String(pick(banner, "startAt", "start_at", "") || "").slice(0, 16),
            endAt: String(pick(banner, "endAt", "end_at", "") || "").slice(0, 16),
            targetAudience: pick(banner, "targetAudience", "target_audience", "ALL"),
            activeYn: Boolean(pick(banner, "activeYn", "active_yn", true)),
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
            const response = await api.get("/members/list", {
                params: { keyword: trimmed, page: 0, size: 20 },
            });
            const payload = unwrapData(response.data);
            const items = payload?.items || payload?.content || payload?.data || payload || [];
            setMemberCandidates(Array.isArray(items) ? items : []);
        } catch (err) {
            setMemberCandidates([]);
            setMemberSearchError(err?.response?.data?.message || "Failed to search members.");
        } finally {
            setMemberSearchLoading(false);
        }
    };

    const fetchMemberDetail = async (memberIdOverride) => {
        const memberId = Number(memberIdOverride ?? memberIdInput);
        if (!Number.isFinite(memberId) || memberId <= 0) {
            toast.error("Enter a valid member ID.");
            return;
        }

        setMemberLoading(true);
        setMemberError("");
        try {
            const response = await api.get(`/admin/members/${memberId}`);
            const data = unwrapData(response.data);
            setMemberDetail(data);
        } catch (err) {
            const message = err?.response?.data?.message || "Failed to fetch member detail.";
            setMemberError(message);
            setMemberDetail(null);
            toast.error(message);
        } finally {
            setMemberLoading(false);
        }
    };

    const selectCandidate = async (member) => {
        const memberId = getMemberIdValue(member);
        if (!memberId) {
            toast.error("Invalid member candidate.");
            return;
        }
        setMemberIdInput(String(memberId));
        setMemberKeyword(`${pick(member, "name", "name", "")} (${pick(member, "email", "email", "")})`);
        setMemberCandidates([]);
        await fetchMemberDetail(memberId);
    };

    if (!isAdmin) {
        return (
            <section className="rounded-[2rem] border border-rose-100 bg-rose-50/50 p-10 text-rose-800 text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                    <ShieldAlert className="h-8 w-8 text-rose-500" />
                </div>
                <h1 className="text-xl font-black">Admin Only Page</h1>
                <p className="text-sm font-medium opacity-70">ROLE_ADMIN or ROLE_MASTER is required.</p>
            </section>
        );
    }

    const memberInfo = pick(memberDetail, "memberInfo", "member_info", {});
    const recentBoards = pick(memberDetail, "recentBoards", "recent_boards", []);
    const recentComments = pick(memberDetail, "recentComments", "recent_comments", []);
    const sanctions = pick(memberDetail, "sanctions", "sanctions", []);
    const receivedReports = pick(memberDetail, "receivedReports", "received_reports", []);
    const madeReports = pick(memberDetail, "madeReports", "made_reports", []);

    return (
        <section className="space-y-8 animate-fade-in pb-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900">Admin Operations</h1>
                    <p className="text-sm font-medium text-slate-400">Bulk moderation tools and member 360 detail lookup.</p>
                </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6">
                <h2 className="text-base font-black text-slate-900">How To Use</h2>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-2xl bg-white p-4">
                        <div className="text-xs font-black uppercase tracking-widest text-primary-600">Bulk Moderation</div>
                        <p className="mt-2 text-sm text-slate-600">
                            Search board/comment list by keyword, select multiple targets, then run hide or recover in one batch.
                        </p>
                    </div>
                    <div className="rounded-2xl bg-white p-4">
                        <div className="text-xs font-black uppercase tracking-widest text-primary-600">Member 360 Detail</div>
                        <p className="mt-2 text-sm text-slate-600">
                            Search a member ID to review profile summary, recent content, sanctions, and report history in one view.
                        </p>
                    </div>
                </div>
                <p className="mt-4 text-xs font-semibold text-slate-500">
                    Note: All actions are audited and reflected in admin logs.
                </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="card p-8 space-y-5">
                    <h2 className="text-lg font-black text-slate-900">Bulk Moderation</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <select className="input-base" value={targetType} onChange={(e) => setTargetType(e.target.value)}>
                            <option value="BOARD">BOARD</option>
                            <option value="COMMENT">COMMENT</option>
                        </select>
                        <select className="input-base" value={bulkHiddenFilter} onChange={(e) => setBulkHiddenFilter(e.target.value)}>
                            <option value="ALL">All status</option>
                            <option value="VISIBLE">Visible only</option>
                            <option value="HIDDEN">Hidden only</option>
                        </select>
                        <button
                            className="btn-primary"
                            disabled={batchLoading}
                            onClick={() => submitBatchModeration("HIDE")}
                        >
                            {batchLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4" />}
                            <span className="ml-2">Hide Selected</span>
                        </button>
                        <button
                            className="btn-secondary"
                            disabled={batchLoading}
                            onClick={() => submitBatchModeration("RECOVER")}
                        >
                            {batchLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                            <span className="ml-2">Recover Selected</span>
                        </button>
                    </div>

                    <input
                        className="input-base"
                        value={bulkKeyword}
                        onChange={(e) => setBulkKeyword(e.target.value)}
                        placeholder="Search by id/title/content/writer"
                    />

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <button
                            type="button"
                            className="rounded-xl bg-slate-100 px-3 py-1.5 font-black text-slate-700 hover:bg-slate-200"
                            onClick={selectAllFiltered}
                            disabled={!filteredModerationItems.length}
                        >
                            Select Filtered
                        </button>
                        <button
                            type="button"
                            className="rounded-xl bg-slate-100 px-3 py-1.5 font-black text-slate-700 hover:bg-slate-200"
                            onClick={clearSelected}
                            disabled={!selectedIds.length}
                        >
                            Clear Selected
                        </button>
                        <span className="font-semibold text-slate-500">Selected: {selectedIds.length}</span>
                    </div>

                    {moderationLoading ? (
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 text-sm text-slate-500">
                            Loading moderation list...
                        </div>
                    ) : moderationError ? (
                        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                            {moderationError}
                        </div>
                    ) : !filteredModerationItems.length ? (
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 text-sm text-slate-500">
                            No matching items.
                        </div>
                    ) : (
                        <div className="max-h-56 overflow-auto rounded-2xl border border-slate-100 bg-slate-50/40 p-2 space-y-2">
                            {filteredModerationItems.map((item, idx) => {
                                const id = getModerationItemId(item, targetType);
                                if (!id) return null;
                                const checked = selectedIdSet.has(id);
                                const hidden = getModerationItemHidden(item);
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
                                                <div className="text-xs font-black text-slate-800">#{id} {getModerationPrimaryText(item, targetType)}</div>
                                                <div className="text-[11px] text-slate-500">{getModerationSecondaryText(item, targetType)}</div>
                                            </div>
                                        </div>
                                        <span className={`rounded-lg px-2 py-0.5 text-[10px] font-black ${hidden ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                                            {hidden ? "HIDDEN" : "VISIBLE"}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    )}

                    <input
                        className="input-base"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Reason (optional, max 500)"
                        maxLength={500}
                    />

                    {batchError ? (
                        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                            {batchError}
                        </div>
                    ) : null}

                    {batchResult ? (
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-sm space-y-1">
                            <div><b>Total requested:</b> {pick(batchResult, "totalRequested", "total_requested", 0)}</div>
                            <div><b>Processed:</b> {pick(batchResult, "processedCount", "processed_count", 0)}</div>
                            <div><b>Failed IDs:</b> {(pick(batchResult, "failedIds", "failed_ids", []) || []).join(", ") || "None"}</div>
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 text-sm text-slate-500">
                            Select targets from the list, then execute bulk moderation.
                        </div>
                    )}
                </div>

                <div className="card p-8 space-y-5">
                    <h2 className="text-lg font-black text-slate-900">Member 360 Detail</h2>
                    <div className="space-y-2">
                        <input
                            className="input-base"
                            value={memberKeyword}
                            onChange={(e) => setMemberKeyword(e.target.value)}
                            placeholder="Search member by name/email"
                        />
                        {memberSearchLoading ? (
                            <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-3 text-xs font-semibold text-slate-500">
                                Searching members...
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
                                    const candidateId = getMemberIdValue(member);
                                    return (
                                        <button
                                            key={candidateId || `member-candidate-${idx}`}
                                            type="button"
                                            onClick={() => selectCandidate(member)}
                                            className="w-full rounded-xl bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-primary-50"
                                        >
                                            <div>{pick(member, "name", "name", "(No name)")} ({pick(member, "email", "email", "-")})</div>
                                            <div className="text-[10px] text-slate-400">#{candidateId || "-"}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : String(memberKeyword || "").trim() ? (
                            <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-3 text-xs font-semibold text-slate-500">
                                No candidates found.
                            </div>
                        ) : null}
                    </div>
                    <div className="flex gap-3">
                        <input
                            className="input-base flex-1"
                            value={memberIdInput}
                            onChange={(e) => setMemberIdInput(e.target.value)}
                            placeholder="Enter member ID"
                        />
                        <button className="btn-primary" disabled={memberLoading} aria-busy={memberLoading} onClick={fetchMemberDetail}>
                            {memberLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UserSearch className="h-4 w-4" />}
                            <span className="ml-2">Search</span>
                        </button>
                    </div>

                    {memberError ? (
                        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                            {memberError}
                        </div>
                    ) : null}

                    {!memberLoading && !memberError && !memberDetail ? (
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 text-sm text-slate-500">
                            Enter a member ID and search.
                        </div>
                    ) : null}
                </div>
            </div>

            <div className="card p-8 space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-black text-slate-900">Banner Management</h2>
                    <button
                        type="button"
                        className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-200"
                        onClick={fetchAdminBanners}
                        disabled={bannerLoading}
                        aria-busy={bannerLoading}
                        data-busy-indicator="true"
                    >
                        {bannerLoading ? "Refreshing..." : "Refresh"}
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <select className="input-base" value={bannerForm.bannerType} onChange={(e) => setBannerForm((prev) => ({ ...prev, bannerType: e.target.value }))}>
                        <option value="NOTICE">NOTICE</option>
                        <option value="AD">AD</option>
                    </select>
                    <select className="input-base" value={bannerForm.renderMode} onChange={(e) => setBannerForm((prev) => ({ ...prev, renderMode: e.target.value }))}>
                        <option value="CONTENT">CONTENT</option>
                        <option value="ADSENSE">ADSENSE</option>
                    </select>
                    <select className="input-base" value={bannerForm.targetAudience} onChange={(e) => setBannerForm((prev) => ({ ...prev, targetAudience: e.target.value }))}>
                        <option value="ALL">ALL</option>
                        <option value="GUEST">GUEST</option>
                        <option value="USER">USER</option>
                        <option value="ADMIN">ADMIN</option>
                    </select>
                    <input className="input-base" value={bannerForm.adProvider} onChange={(e) => setBannerForm((prev) => ({ ...prev, adProvider: e.target.value }))} placeholder="Ad provider (e.g. ADSENSE)" />
                    <input className="input-base md:col-span-2" value={bannerForm.title} onChange={(e) => setBannerForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Banner title" />
                    <textarea className="input-base md:col-span-2 min-h-[88px]" value={bannerForm.description} onChange={(e) => setBannerForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Banner description" />
                    <input className="input-base md:col-span-2" value={bannerForm.imageUrl} onChange={(e) => setBannerForm((prev) => ({ ...prev, imageUrl: e.target.value }))} placeholder="Image URL (optional)" />
                    <input className="input-base md:col-span-2" value={bannerForm.linkUrl} onChange={(e) => setBannerForm((prev) => ({ ...prev, linkUrl: e.target.value }))} placeholder="Link URL (optional)" />
                    <input className="input-base" value={bannerForm.ctaText} onChange={(e) => setBannerForm((prev) => ({ ...prev, ctaText: e.target.value }))} placeholder="CTA text (optional)" />
                    <input className="input-base" value={bannerForm.adsenseClient} onChange={(e) => setBannerForm((prev) => ({ ...prev, adsenseClient: e.target.value }))} placeholder="AdSense client (ca-pub-...)" />
                    <input className="input-base" value={bannerForm.adsenseSlot} onChange={(e) => setBannerForm((prev) => ({ ...prev, adsenseSlot: e.target.value }))} placeholder="AdSense slot ID" />
                    <input className="input-base" type="number" min={0} max={1000} value={bannerForm.priority} onChange={(e) => setBannerForm((prev) => ({ ...prev, priority: e.target.value }))} placeholder="Priority" />
                    <input className="input-base" type="datetime-local" value={bannerForm.startAt} onChange={(e) => setBannerForm((prev) => ({ ...prev, startAt: e.target.value }))} />
                    <input className="input-base" type="datetime-local" value={bannerForm.endAt} onChange={(e) => setBannerForm((prev) => ({ ...prev, endAt: e.target.value }))} />
                    <label className="md:col-span-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <input type="checkbox" checked={bannerForm.activeYn} onChange={(e) => setBannerForm((prev) => ({ ...prev, activeYn: e.target.checked }))} />
                        Active
                    </label>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button className="btn-primary" type="button" onClick={submitBannerForm} disabled={bannerSaving} aria-busy={bannerSaving} data-busy-indicator="true">
                        {bannerSaving ? "Saving..." : editingBannerId ? "Update Banner" : "Create Banner"}
                    </button>
                    {editingBannerId ? (
                        <button className="btn-secondary" type="button" onClick={resetBannerForm} disabled={bannerSaving}>
                            Cancel Edit
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
                        No banners yet.
                    </div>
                ) : (
                    <div className="space-y-3 max-h-[420px] overflow-auto pr-1">
                        {banners.map((banner, idx) => {
                            const bannerId = Number(pick(banner, "bannerId", "banner_id", 0));
                            const activeYn = Boolean(pick(banner, "activeYn", "active_yn", false));
                            const selected = editingBannerId === bannerId;
                            return (
                                <div
                                    key={bannerId || `banner-${idx}`}
                                    className={`rounded-2xl border p-4 cursor-pointer ${selected ? "border-primary-300 bg-primary-50/40" : "border-slate-100 bg-slate-50/30"}`}
                                    onClick={() => startEditBanner(banner)}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-black text-slate-900">#{bannerId} {pick(banner, "title", "title", "-")}</div>
                                            <div className="mt-1 text-[11px] text-slate-500">
                                                {pick(banner, "bannerType", "banner_type", "-")} | {pick(banner, "renderMode", "render_mode", "-")} | {pick(banner, "targetAudience", "target_audience", "-")} | priority {pick(banner, "priority", "priority", 0)}
                                            </div>
                                        </div>
                                        <span className={`rounded-lg px-2 py-0.5 text-[10px] font-black ${activeYn ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                                            {activeYn ? "ACTIVE" : "INACTIVE"}
                                        </span>
                                    </div>
                                    <p className="mt-2 text-xs text-slate-600">{pick(banner, "description", "description", "")}</p>
                                    {(pick(banner, "adProvider", "ad_provider", "") || pick(banner, "adsenseClient", "adsense_client", "")) ? (
                                        <div className="mt-2 text-[11px] text-slate-500">
                                            Provider: {pick(banner, "adProvider", "ad_provider", "-")} | Client: {pick(banner, "adsenseClient", "adsense_client", "-")} | Slot: {pick(banner, "adsenseSlot", "adsense_slot", "-")}
                                        </div>
                                    ) : null}
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <button type="button" className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-black text-white hover:bg-primary-600" onClick={(e) => { e.stopPropagation(); startEditBanner(banner); }}>Edit</button>
                                        <button type="button" className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-200" onClick={() => toggleBannerActive(banner)}>
                                            {activeYn ? "Deactivate" : "Activate"}
                                        </button>
                                        <button type="button" className="rounded-xl bg-rose-100 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-200" onClick={(e) => { e.stopPropagation(); removeBanner(banner); }}>Delete</button>
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
                        <h3 className="text-base font-black text-slate-900">Basic Info</h3>
                        <div className="text-sm"><b>ID:</b> {pick(memberInfo, "memberId", "member_id", "-")}</div>
                        <div className="text-sm"><b>Email:</b> {pick(memberInfo, "email", "email", "-")}</div>
                        <div className="text-sm"><b>Name:</b> {pick(memberInfo, "name", "name", "-")}</div>
                        <div className="text-sm"><b>Status:</b> {pick(memberInfo, "memberStatus", "member_status", "-")}</div>
                        <div className="text-sm"><b>Roles:</b> {(pick(memberInfo, "roles", "roles", []) || []).join(", ") || "-"}</div>
                        <div className="text-sm"><b>Points:</b> {pick(memberInfo, "point", "point", 0)}</div>
                        <div className="text-sm"><b>Trees:</b> {pick(memberInfo, "treeCount", "tree_count", 0)}</div>
                        <div className="text-sm"><b>Boards:</b> {pick(memberInfo, "boardCount", "board_count", 0)}</div>
                        <div className="text-sm"><b>Comments:</b> {pick(memberInfo, "commentCount", "comment_count", 0)}</div>
                    </div>

                    <div className="card p-6 xl:col-span-2">
                        <h3 className="mb-3 text-base font-black text-slate-900">Recent Boards / Comments</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="rounded-2xl bg-slate-50/50 p-4">
                                <div className="mb-2 text-xs font-black text-slate-500 uppercase">Recent Boards</div>
                                {!recentBoards.length ? <div className="text-xs text-slate-400">No data</div> : (
                                    <ul className="space-y-2 text-sm">
                                        {recentBoards.map((board, idx) => (
                                            <li key={`${pick(board, "boardId", "board_id", idx)}-${idx}`} className="flex items-center justify-between gap-2">
                                                <span className="truncate">#{pick(board, "boardId", "board_id", "-")} {pick(board, "title", "title", "-")}</span>
                                                <span className={`text-[10px] font-black ${pick(board, "hiddenYn", "hidden_yn", false) ? "text-rose-600" : "text-emerald-600"}`}>
                                                    {pick(board, "hiddenYn", "hidden_yn", false) ? "HIDDEN" : "VISIBLE"}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <div className="rounded-2xl bg-slate-50/50 p-4">
                                <div className="mb-2 text-xs font-black text-slate-500 uppercase">Recent Comments</div>
                                {!recentComments.length ? <div className="text-xs text-slate-400">No data</div> : (
                                    <ul className="space-y-2 text-sm">
                                        {recentComments.map((comment, idx) => (
                                            <li key={`${pick(comment, "commentId", "comment_id", idx)}-${idx}`} className="flex items-center justify-between gap-2">
                                                <span className="truncate">#{pick(comment, "commentId", "comment_id", "-")} {pick(comment, "contents", "contents", "-")}</span>
                                                <span className={`text-[10px] font-black ${pick(comment, "hiddenYn", "hidden_yn", false) ? "text-rose-600" : "text-emerald-600"}`}>
                                                    {pick(comment, "hiddenYn", "hidden_yn", false) ? "HIDDEN" : "VISIBLE"}
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
                            <div className="mb-2 text-xs font-black text-slate-500 uppercase">Sanctions</div>
                            {!sanctions.length ? <div className="text-xs text-slate-400">No data</div> : (
                                <ul className="space-y-2 text-sm">
                                    {sanctions.map((item, idx) => (
                                        <li key={`${pick(item, "sanctionId", "sanction_id", idx)}-${idx}`}>
                                            #{pick(item, "sanctionId", "sanction_id", "-")} {pick(item, "sanctionStatus", "sanction_status", "-")}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div className="rounded-2xl bg-slate-50/50 p-4">
                            <div className="mb-2 text-xs font-black text-slate-500 uppercase">Received Reports</div>
                            {!receivedReports.length ? <div className="text-xs text-slate-400">No data</div> : (
                                <ul className="space-y-2 text-sm">
                                    {receivedReports.map((item, idx) => (
                                        <li key={`${pick(item, "reportId", "report_id", idx)}-${idx}`}>
                                            #{pick(item, "reportId", "report_id", "-")} {pick(item, "reportStatus", "report_status", "-")}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div className="rounded-2xl bg-slate-50/50 p-4">
                            <div className="mb-2 text-xs font-black text-slate-500 uppercase">Made Reports</div>
                            {!madeReports.length ? <div className="text-xs text-slate-400">No data</div> : (
                                <ul className="space-y-2 text-sm">
                                    {madeReports.map((item, idx) => (
                                        <li key={`${pick(item, "reportId", "report_id", idx)}-${idx}`}>
                                            #{pick(item, "reportId", "report_id", "-")} {pick(item, "reportStatus", "report_status", "-")}
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
