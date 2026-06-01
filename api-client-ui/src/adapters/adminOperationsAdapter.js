import api, { getApiErrorMessage } from "../utils/api.js";

const unwrapAdminOperationsData = (response) => response?.data?.data ?? response?.data ?? response ?? null;

const pick = (obj, camel, snake, fallback = null) => {
    if (!obj || typeof obj !== "object") return fallback;
    if (Object.prototype.hasOwnProperty.call(obj, camel) && obj[camel] !== undefined) return obj[camel];
    if (Object.prototype.hasOwnProperty.call(obj, snake) && obj[snake] !== undefined) return obj[snake];
    return fallback;
};

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const toPositiveNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const listItems = (response) => {
    const payload = unwrapAdminOperationsData(response);
    const items = payload?.items || payload?.content || payload?.data || payload || [];
    return Array.isArray(items) ? items : [];
};

const asArray = (value) => Array.isArray(value) ? value : [];

const labelFrom = (value, labels, fallback = "-") => {
    const key = String(value || "").trim().toUpperCase();
    return key ? labels[key] || fallback : fallback;
};

const MEMBER_STATUS_LABELS = {
    MEMBER_ACTIVE: "활성",
    ACTIVE: "활성",
    MEMBER_SLEEP: "휴면",
    SLEEP: "휴면",
    MEMBER_QUIT: "탈퇴",
    QUIT: "탈퇴",
};

const ROLE_LABELS = {
    ROLE_USER: "회원",
    ROLE_ADMIN: "관리자",
    ROLE_MASTER: "마스터",
    USER: "회원",
    ADMIN: "관리자",
    MASTER: "마스터",
};

const BANNER_TYPE_LABELS = {
    NOTICE: "공지",
    AD: "광고",
};

const BANNER_RENDER_MODE_LABELS = {
    CONTENT: "콘텐츠",
    ADSENSE: "애드센스",
};

const TARGET_AUDIENCE_LABELS = {
    ALL: "전체",
    GUEST: "방문자",
    USER: "회원",
    ADMIN: "관리자",
};

const SANCTION_STATUS_LABELS = {
    ACTIVE: "진행 중",
    EXPIRED: "만료",
    RELEASED: "해제",
    CANCELLED: "취소",
};

const REPORT_STATUS_LABELS = {
    PENDING: "대기",
    REVIEWING: "검토 중",
    RESOLVED: "처리 완료",
    REJECTED: "반려",
    DISMISSED: "기각",
};

const roleLabelsFrom = (roles) => asArray(roles)
    .map((role) => labelFrom(role, ROLE_LABELS, "알 수 없는 권한"))
    .filter(Boolean);

export const adminOperationsErrorMessage = (error, fallbackMessage) => getApiErrorMessage(error, fallbackMessage);

export const normalizeModerationItem = (item, targetType) => {
    const isBoard = targetType === "BOARD";
    const id = toPositiveNumber(isBoard
        ? pick(item, "boardId", "board_id")
        : pick(item, "commentId", "comment_id"));
    const boardId = toPositiveNumber(pick(item, "boardId", "board_id"));
    const primaryText = isBoard
        ? pick(item, "title", "title", "(제목 없음)")
        : pick(item, "contents", "contents", "(내용 없음)");
    const secondaryText = isBoard
        ? pick(item, "boardCreator", "board_creator", "-")
        : pick(item, "writerName", "writer_name", "-");

    return {
        id,
        boardId,
        targetType,
        primaryText,
        secondaryText,
        hiddenYn: Boolean(pick(item, "hiddenYn", "hidden_yn", false)),
        moderatedBy: pick(item, "moderatedBy", "moderated_by", ""),
        moderatedAt: pick(item, "moderatedAt", "moderated_at", ""),
        moderateReason: pick(item, "moderateReason", "moderate_reason", ""),
        createdAt: pick(item, "createdAt", "created_at", ""),
    };
};

export const normalizeBatchResult = (response) => {
    const data = unwrapAdminOperationsData(response) || {};
    return {
        totalRequested: toNumber(pick(data, "totalRequested", "total_requested", 0)),
        processedCount: toNumber(pick(data, "processedCount", "processed_count", 0)),
        failedIds: Array.isArray(pick(data, "failedIds", "failed_ids", [])) ? pick(data, "failedIds", "failed_ids", []) : [],
    };
};

export const normalizeBanner = (banner) => ({
    bannerId: toPositiveNumber(pick(banner, "bannerId", "banner_id")),
    bannerType: pick(banner, "bannerType", "banner_type", "NOTICE"),
    bannerTypeLabel: labelFrom(pick(banner, "bannerType", "banner_type", "NOTICE"), BANNER_TYPE_LABELS),
    placement: pick(banner, "placement", "placement", "HOME_HERO"),
    title: pick(banner, "title", "title", ""),
    description: pick(banner, "description", "description", ""),
    imageUrl: pick(banner, "imageUrl", "image_url", ""),
    linkUrl: pick(banner, "linkUrl", "link_url", ""),
    ctaText: pick(banner, "ctaText", "cta_text", ""),
    renderMode: pick(banner, "renderMode", "render_mode", "CONTENT"),
    renderModeLabel: labelFrom(pick(banner, "renderMode", "render_mode", "CONTENT"), BANNER_RENDER_MODE_LABELS),
    adProvider: pick(banner, "adProvider", "ad_provider", ""),
    adsenseClient: pick(banner, "adsenseClient", "adsense_client", ""),
    adsenseSlot: pick(banner, "adsenseSlot", "adsense_slot", ""),
    priority: toNumber(pick(banner, "priority", "priority", 100), 100),
    startAt: pick(banner, "startAt", "start_at", ""),
    endAt: pick(banner, "endAt", "end_at", ""),
    targetAudience: pick(banner, "targetAudience", "target_audience", "ALL"),
    targetAudienceLabel: labelFrom(pick(banner, "targetAudience", "target_audience", "ALL"), TARGET_AUDIENCE_LABELS),
    activeYn: Boolean(pick(banner, "activeYn", "active_yn", true)),
    createdAt: pick(banner, "createdAt", "created_at", ""),
    modifiedAt: pick(banner, "modifiedAt", "modified_at", ""),
});

const toNullableText = (value) => {
    const text = String(value || "").trim();
    return text || null;
};

const toBannerPayload = (form) => ({
    banner_type: form.bannerType,
    placement: form.placement,
    title: String(form.title || "").trim(),
    description: toNullableText(form.description),
    image_url: toNullableText(form.imageUrl),
    link_url: toNullableText(form.linkUrl),
    cta_text: toNullableText(form.ctaText),
    render_mode: form.renderMode || "CONTENT",
    ad_provider: toNullableText(form.adProvider),
    adsense_client: toNullableText(form.adsenseClient),
    adsense_slot: toNullableText(form.adsenseSlot),
    priority: Number(form.priority) || 0,
    start_at: form.startAt ? `${form.startAt}:00` : null,
    end_at: form.endAt ? `${form.endAt}:00` : null,
    target_audience: form.targetAudience,
    active_yn: Boolean(form.activeYn),
});

export const normalizeMemberCandidate = (member) => ({
    memberId: toPositiveNumber(pick(member, "memberId", "member_id")),
    name: pick(member, "name", "name", "(이름 없음)"),
    email: pick(member, "email", "email", "-"),
});

const normalizeBoardSummary = (board, index = 0) => ({
    boardId: toPositiveNumber(pick(board, "boardId", "board_id")) || index,
    title: pick(board, "title", "title", "-"),
    hiddenYn: Boolean(pick(board, "hiddenYn", "hidden_yn", false)),
    createdAt: pick(board, "createdAt", "created_at", ""),
});

const normalizeCommentSummary = (comment, index = 0) => ({
    commentId: toPositiveNumber(pick(comment, "commentId", "comment_id")) || index,
    boardId: toPositiveNumber(pick(comment, "boardId", "board_id")),
    contents: pick(comment, "contents", "contents", "-"),
    hiddenYn: Boolean(pick(comment, "hiddenYn", "hidden_yn", false)),
    createdAt: pick(comment, "createdAt", "created_at", ""),
});

const normalizeSanctionSummary = (sanction, index = 0) => ({
    sanctionId: toPositiveNumber(pick(sanction, "sanctionId", "sanction_id")) || index,
    sanctionStatus: pick(sanction, "sanctionStatus", "sanction_status", "-"),
    sanctionStatusLabel: labelFrom(pick(sanction, "sanctionStatus", "sanction_status", "-"), SANCTION_STATUS_LABELS),
    reason: pick(sanction, "reason", "reason", ""),
    startsAt: pick(sanction, "startsAt", "starts_at", ""),
    endsAt: pick(sanction, "endsAt", "ends_at", ""),
    createdAt: pick(sanction, "createdAt", "created_at", ""),
});

const normalizeReportSummary = (report, index = 0) => ({
    reportId: toPositiveNumber(pick(report, "reportId", "report_id")) || index,
    targetType: pick(report, "targetType", "target_type", ""),
    targetId: toPositiveNumber(pick(report, "targetId", "target_id")),
    reason: pick(report, "reason", "reason", ""),
    reportStatus: pick(report, "reportStatus", "report_status", "-"),
    reportStatusLabel: labelFrom(pick(report, "reportStatus", "report_status", "-"), REPORT_STATUS_LABELS),
    createdAt: pick(report, "createdAt", "created_at", ""),
});

export const normalizeMemberDetail = (response) => {
    const data = unwrapAdminOperationsData(response) || {};
    const memberInfo = pick(data, "memberInfo", "member_info", {}) || {};
    const roles = pick(memberInfo, "roles", "roles", []);

    return {
        memberInfo: {
            memberId: toPositiveNumber(pick(memberInfo, "memberId", "member_id")),
            email: pick(memberInfo, "email", "email", "-"),
            name: pick(memberInfo, "name", "name", "-"),
            roles: Array.isArray(roles) ? roles : [],
            roleLabels: roleLabelsFrom(roles),
            memberStatus: pick(memberInfo, "memberStatus", "member_status", "-"),
            memberStatusLabel: labelFrom(pick(memberInfo, "memberStatus", "member_status", "-"), MEMBER_STATUS_LABELS),
            point: toNumber(pick(memberInfo, "point", "point", 0)),
            treeCount: toNumber(pick(memberInfo, "treeCount", "tree_count", 0)),
            boardCount: toNumber(pick(memberInfo, "boardCount", "board_count", 0)),
            commentCount: toNumber(pick(memberInfo, "commentCount", "comment_count", 0)),
            createdAt: pick(memberInfo, "createdAt", "created_at", ""),
            level: toNumber(pick(memberInfo, "level", "level", 0)),
            totalExp: toNumber(pick(memberInfo, "totalExp", "total_exp", 0)),
        },
        recentBoards: asArray(pick(data, "recentBoards", "recent_boards", [])).map(normalizeBoardSummary),
        recentComments: asArray(pick(data, "recentComments", "recent_comments", [])).map(normalizeCommentSummary),
        sanctions: asArray(pick(data, "sanctions", "sanctions", [])).map(normalizeSanctionSummary),
        receivedReports: asArray(pick(data, "receivedReports", "received_reports", [])).map(normalizeReportSummary),
        madeReports: asArray(pick(data, "madeReports", "made_reports", [])).map(normalizeReportSummary),
    };
};

export const adminOperationsAdapter = {
    async fetchModerationItems(targetType) {
        const endpoint = targetType === "BOARD" ? "/admin/moderation/boards" : "/admin/moderation/comments";
        const response = await api.get(endpoint, {
            params: { page: 1, size: 50 },
        });
        return listItems(response).map((item) => normalizeModerationItem(item, targetType)).filter((item) => item.id);
    },

    async updateModerationBatch({ targetType, ids, hiddenYn, reason }) {
        const endpoint = targetType === "BOARD" ? "/admin/moderation/boards/batch" : "/admin/moderation/comments/batch";
        const response = await api.patch(endpoint, {
            ids,
            hidden_yn: hiddenYn,
            reason: reason?.trim() || null,
        });
        return normalizeBatchResult(response);
    },

    async fetchBanners() {
        const response = await api.get("/admin/banners", {
            params: { page: 1, size: 50 },
        });
        return listItems(response).map(normalizeBanner).filter((banner) => banner.bannerId);
    },

    async saveBanner({ bannerId, form }) {
        const payload = toBannerPayload(form);
        const response = bannerId
            ? await api.patch(`/admin/banners/${bannerId}`, payload)
            : await api.post("/admin/banners", payload);
        return normalizeBanner(unwrapAdminOperationsData(response));
    },

    async updateBannerActive({ bannerId, activeYn }) {
        const response = await api.patch(`/admin/banners/${bannerId}/active`, { active_yn: activeYn });
        return normalizeBanner(unwrapAdminOperationsData(response));
    },

    async deleteBanner(bannerId) {
        await api.delete(`/admin/banners/${bannerId}`);
    },

    async fetchMemberCandidates(keyword) {
        const response = await api.get("/members/list", {
            params: { keyword, page: 0, size: 20 },
        });
        return listItems(response).map(normalizeMemberCandidate).filter((member) => member.memberId);
    },

    async fetchMemberDetail(memberId) {
        const response = await api.get(`/admin/members/${memberId}`);
        return normalizeMemberDetail(response);
    },
};
