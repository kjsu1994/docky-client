import api, { getApiErrorMessage } from "../utils/api.js";
import { normalizeMemberSearchKeyword } from "./memberSearchBounds.js";

export { MEMBER_SEARCH_KEYWORD_MAX_LENGTH } from "./memberSearchBounds.js";

export const ADMIN_ANOMALY_TEXT_LIMITS = Object.freeze({
    incidentAssignee: 100,
    incidentNote: 4000,
    incidentActionDescription: 1000,
    reportAdminNote: 2000,
    sanctionReason: 500,
    moderationReason: 500,
    roleReason: 300,
    ruleMetric: 100,
});

export const ADMIN_AUDIT_PAGE_SIZE_MAX = 200;

const ADMIN_AUDIT_TYPES = new Set(["ALL", "ROLE", "REPORT", "MODERATION", "SANCTION", "ANOMALY"]);

export const unwrapAdminData = (payload) => payload?.data?.data ?? payload?.data ?? payload ?? null;

const toFiniteInteger = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
};

const normalizePageNumber = (value, fallback = 1) => Math.max(1, toFiniteInteger(value, fallback));

const normalizePageSize = (value, fallback = 10, max = ADMIN_AUDIT_PAGE_SIZE_MAX) => {
    const fallbackSize = Math.max(1, Math.min(max, toFiniteInteger(fallback, 10)));
    return Math.max(1, Math.min(max, toFiniteInteger(value, fallbackSize)));
};

const toNonNegativeInteger = (value, fallback = 0) => Math.max(0, toFiniteInteger(value, fallback));

export const normalizeAuditType = (value) => {
    const normalized = String(value || "ALL").trim().toUpperCase();
    return ADMIN_AUDIT_TYPES.has(normalized) ? normalized : "ALL";
};

export const emptyAdminPage = (size = 10) => ({
    items: [],
    page: 1,
    size: normalizePageSize(size),
    totalElements: 0,
    totalPages: 0,
});

export const normalizeAdminPage = (payload, size = 10) => {
    const data = unwrapAdminData(payload);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return emptyAdminPage(size);
    }
    return {
        items: Array.isArray(data.items) ? data.items : Array.isArray(data.content) ? data.content : [],
        page: normalizePageNumber(data.page ?? 1),
        size: normalizePageSize(data.size, size),
        totalElements: toNonNegativeInteger(data.totalElements ?? data.total_elements ?? 0),
        totalPages: toNonNegativeInteger(data.totalPages ?? data.total_pages ?? 0),
        ...(data.unreadCount !== undefined || data.unread_count !== undefined
            ? { unreadCount: toNonNegativeInteger(data.unreadCount ?? data.unread_count ?? 0) }
            : {}),
    };
};

export const normalizeAnomalyEvents = (payload) => {
    const root = unwrapAdminData(payload);
    if (Array.isArray(root)) return root;
    if (Array.isArray(root?.data)) return root.data;
    if (Array.isArray(root?.items)) return root.items;
    if (Array.isArray(root?.content)) return root.content;
    return [];
};

export const adminAnomaliesErrorMessage = (error, fallbackMessage) => getApiErrorMessage(error, fallbackMessage);

const emptyMasterPageResponse = (size = 10) => ({ data: { data: emptyAdminPage(size) } });

const hiddenYnParam = (hidden) => hidden === "ALL" ? undefined : hidden === "HIDDEN";

const toLimitedText = (value, maxLength) => String(value || "").trim().slice(0, maxLength);

const toPositiveInteger = (value, fallback = 1) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 1 ? Math.trunc(parsed) : fallback;
};

const toPositiveNumber = (value, fallback = 1) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeMemberCandidate = (member) => ({
    memberId: toPositiveNumber(
        member?.memberId ?? member?.member_id ?? member?.id ?? member?.memberNo ?? member?.member_no,
        0,
    ),
    name: member?.name ?? member?.memberName ?? member?.member_name ?? "",
    email: member?.email ?? "",
    roles: Array.isArray(member?.roles) ? member.roles : [],
    memberStatus: member?.memberStatus ?? member?.member_status ?? "",
});

export const buildIncidentUpdatePayload = ({ incidentStatus, assignee, note } = {}) => ({
    incident_status: incidentStatus,
    assignee: toLimitedText(assignee, ADMIN_ANOMALY_TEXT_LIMITS.incidentAssignee),
    note: toLimitedText(note, ADMIN_ANOMALY_TEXT_LIMITS.incidentNote),
});

export const buildIncidentActionPayload = ({ actionType, description, blockMinutes } = {}) => ({
    action_type: actionType,
    description: toLimitedText(description, ADMIN_ANOMALY_TEXT_LIMITS.incidentActionDescription),
    ...(blockMinutes === undefined ? {} : { block_minutes: Math.max(1, Math.min(1440, Number(blockMinutes) || 30)) }),
});

export const buildRulePayload = ({ metric, hardLimitPerMinute, zScoreThreshold, enabled } = {}) => ({
    metric: toLimitedText(metric, ADMIN_ANOMALY_TEXT_LIMITS.ruleMetric),
    hard_limit_per_minute: toPositiveInteger(hardLimitPerMinute),
    z_score_threshold: toPositiveNumber(zScoreThreshold),
    enabled: Boolean(enabled),
});

const commandCenterSection = async ({ key, label, enabled = true, disabledMessage = "", fallback, load }) => {
    if (!enabled) {
        return {
            key,
            data: fallback,
            source: { key, label, ok: true, skipped: true, message: disabledMessage },
        };
    }

    try {
        return {
            key,
            data: await load(),
            source: { key, label, ok: true, skipped: false, message: "" },
        };
    } catch (error) {
        return {
            key,
            data: fallback,
            source: {
                key,
                label,
                ok: false,
                skipped: false,
                message: adminAnomaliesErrorMessage(error, `${label} 데이터를 불러오지 못했습니다.`),
            },
        };
    }
};

export const adminAnomaliesAdapter = {
    async fetchIncidents(status, page, size = 20) {
        const response = await api.get("/admin/anomalies/incidents", { params: { status, page, size } });
        return normalizeAdminPage(response.data, size);
    },

    async fetchIncidentDetail(incidentId) {
        const response = await api.get(`/admin/anomalies/incidents/${incidentId}`);
        return unwrapAdminData(response.data);
    },

    async fetchNotifications({ readYn = false, page = 1, size = 8 } = {}) {
        const response = await api.get("/admin/notifications", { params: { readYn, page, size } });
        return normalizeAdminPage(response.data, size);
    },

    async fetchReports({ status, page = 1, size = 10 } = {}) {
        const response = await api.get("/admin/reports", { params: { status, page, size } });
        return normalizeAdminPage(response.data, size);
    },

    async fetchSanctions({ status, page = 1, size = 10 } = {}) {
        const response = await api.get("/admin/sanctions", { params: { status, page, size } });
        return normalizeAdminPage(response.data, size);
    },

    async fetchReleaseRequests({ page = 1, size = 50 } = {}) {
        const response = await api.get("/admin/sanctions/release-requests", { params: { page, size } });
        return normalizeAdminPage(response.data, size);
    },

    async searchMembers({ keyword, page = 0, size = 20 } = {}) {
        const normalizedKeyword = normalizeMemberSearchKeyword(keyword);
        const response = await api.get("/members/list", { params: { keyword: normalizedKeyword || undefined, page, size } });
        const payload = unwrapAdminData(response.data);
        const items = payload?.items || payload?.content || payload?.data || payload || [];
        return Array.isArray(items) ? items.map(normalizeMemberCandidate).filter((member) => member.memberId) : [];
    },

    async fetchModerationBoards({ hidden, page = 1, size = 8 } = {}) {
        const response = await api.get("/admin/moderation/boards", {
            params: { hiddenYn: hiddenYnParam(hidden), page, size },
        });
        return normalizeAdminPage(response.data, size);
    },

    async fetchModerationComments({ hidden, page = 1, size = 8 } = {}) {
        const response = await api.get("/admin/moderation/comments", {
            params: { hiddenYn: hiddenYnParam(hidden), page, size },
        });
        return normalizeAdminPage(response.data, size);
    },

    async fetchAudits({ type, page = 1, size = 10 } = {}) {
        const safePage = normalizePageNumber(page);
        const safeSize = normalizePageSize(size, 10, ADMIN_AUDIT_PAGE_SIZE_MAX);
        const response = await api.get("/admin/audits", {
            params: { type: normalizeAuditType(type), page: safePage, size: safeSize },
        });
        return normalizeAdminPage(response.data, safeSize);
    },

    async fetchRoleMembers({ keyword, page = 1, size = 10 } = {}) {
        const normalizedKeyword = normalizeMemberSearchKeyword(keyword);
        const response = await api.get("/admin/roles/members", {
            params: { keyword: normalizedKeyword || undefined, page, size },
        });
        return normalizeAdminPage(response.data, size);
    },

    async fetchRoleAudits({ page = 1, size = 10 } = {}) {
        const response = await api.get("/admin/roles/audits", { params: { page, size } });
        return normalizeAdminPage(response.data, size);
    },

    async fetchRules() {
        const response = await api.get("/admin/anomalies/rules");
        const rules = unwrapAdminData(response.data);
        return Array.isArray(rules) ? rules : [];
    },

    async fetchDashboard({
        isMaster,
        roleKeyword,
        reportStatus,
        sanctionStatus,
        moderationHidden,
        auditType,
        incidentStatus,
        incidentPage,
    }) {
        const normalizedRoleKeyword = normalizeMemberSearchKeyword(roleKeyword);
        const normalizedAuditType = normalizeAuditType(auditType);
        const roleMembersPromise = isMaster
            ? api.get("/admin/roles/members", { params: { keyword: normalizedRoleKeyword || undefined, page: 1, size: 10 } })
            : Promise.resolve(emptyMasterPageResponse(10));
        const roleAuditsPromise = isMaster
            ? api.get("/admin/roles/audits", { params: { page: 1, size: 10 } })
            : Promise.resolve(emptyMasterPageResponse(10));

        const [
            summaryRes,
            eventsRes,
            kpiRes,
            rulesRes,
            incidentsRes,
            notificationsRes,
            reportsRes,
            sanctionsRes,
            releaseRequestsRes,
            moderationBoardsRes,
            moderationCommentsRes,
            auditsRes,
            roleMembersRes,
            roleAuditsRes,
        ] = await Promise.all([
            api.get("/stats/summary"),
            api.get("/stats/anomalies", { params: { limit: 50 } }),
            api.get("/admin/anomalies/kpi", { params: { days: 7 } }),
            api.get("/admin/anomalies/rules"),
            api.get("/admin/anomalies/incidents", { params: { status: incidentStatus, page: incidentPage, size: 20 } }),
            api.get("/admin/notifications", { params: { readYn: false, page: 1, size: 8 } }),
            api.get("/admin/reports", { params: { status: reportStatus, page: 1, size: 10 } }),
            api.get("/admin/sanctions", { params: { status: sanctionStatus, page: 1, size: 10 } }),
            api.get("/admin/sanctions/release-requests", { params: { page: 1, size: 50 } }),
            api.get("/admin/moderation/boards", { params: { hiddenYn: hiddenYnParam(moderationHidden), page: 1, size: 8 } }),
            api.get("/admin/moderation/comments", { params: { hiddenYn: hiddenYnParam(moderationHidden), page: 1, size: 8 } }),
            api.get("/admin/audits", { params: { type: normalizedAuditType, page: 1, size: 10 } }),
            roleMembersPromise,
            roleAuditsPromise,
        ]);

        const rules = unwrapAdminData(rulesRes.data);
        return {
            summary: unwrapAdminData(summaryRes.data),
            events: normalizeAnomalyEvents(eventsRes.data),
            kpi: unwrapAdminData(kpiRes.data),
            rules: Array.isArray(rules) ? rules : [],
            incidents: normalizeAdminPage(incidentsRes.data, 20),
            notifications: normalizeAdminPage(notificationsRes.data, 8),
            reports: normalizeAdminPage(reportsRes.data, 10),
            sanctions: normalizeAdminPage(sanctionsRes.data, 10),
            releaseRequests: normalizeAdminPage(releaseRequestsRes.data, 50),
            moderationBoards: normalizeAdminPage(moderationBoardsRes.data, 8),
            moderationComments: normalizeAdminPage(moderationCommentsRes.data, 8),
            audits: normalizeAdminPage(auditsRes.data, 10),
            roleMembers: normalizeAdminPage(roleMembersRes.data, 10),
            roleAudits: normalizeAdminPage(roleAuditsRes.data, 10),
        };
    },

    async fetchCommandCenter({ isMaster = false } = {}) {
        const sectionSpecs = [
            {
                key: "summary",
                label: "서비스 통계",
                fallback: null,
                load: async () => unwrapAdminData((await api.get("/stats/summary")).data),
            },
            {
                key: "events",
                label: "이상징후 이벤트",
                fallback: [],
                load: async () => normalizeAnomalyEvents((await api.get("/stats/anomalies", { params: { limit: 50 } })).data),
            },
            {
                key: "kpi",
                label: "이상징후 KPI",
                fallback: null,
                load: async () => unwrapAdminData((await api.get("/admin/anomalies/kpi", { params: { days: 7 } })).data),
            },
            {
                key: "rules",
                label: "이상징후 규칙",
                fallback: [],
                load: async () => {
                    const rules = unwrapAdminData((await api.get("/admin/anomalies/rules")).data);
                    return Array.isArray(rules) ? rules : [];
                },
            },
            {
                key: "incidents",
                label: "이상징후 사건",
                fallback: emptyAdminPage(20),
                load: async () => normalizeAdminPage(
                    (await api.get("/admin/anomalies/incidents", { params: { status: "ALL", page: 1, size: 20 } })).data,
                    20,
                ),
            },
            {
                key: "notifications",
                label: "관리자 알림",
                fallback: emptyAdminPage(12),
                load: async () => normalizeAdminPage(
                    (await api.get("/admin/notifications", { params: { readYn: false, page: 1, size: 12 } })).data,
                    12,
                ),
            },
            {
                key: "reports",
                label: "신고",
                fallback: emptyAdminPage(12),
                load: async () => normalizeAdminPage(
                    (await api.get("/admin/reports", { params: { status: "OPEN", page: 1, size: 12 } })).data,
                    12,
                ),
            },
            {
                key: "sanctions",
                label: "제재",
                fallback: emptyAdminPage(12),
                load: async () => normalizeAdminPage(
                    (await api.get("/admin/sanctions", { params: { status: "ACTIVE", page: 1, size: 12 } })).data,
                    12,
                ),
            },
            {
                key: "releaseRequests",
                label: "제재 해제 요청",
                fallback: emptyAdminPage(50),
                load: async () => normalizeAdminPage(
                    (await api.get("/admin/sanctions/release-requests", { params: { page: 1, size: 50 } })).data,
                    50,
                ),
            },
            {
                key: "moderationBoards",
                label: "게시글 검토",
                fallback: emptyAdminPage(10),
                load: async () => normalizeAdminPage(
                    (await api.get("/admin/moderation/boards", { params: { hiddenYn: undefined, page: 1, size: 10 } })).data,
                    10,
                ),
            },
            {
                key: "moderationComments",
                label: "댓글 검토",
                fallback: emptyAdminPage(10),
                load: async () => normalizeAdminPage(
                    (await api.get("/admin/moderation/comments", { params: { hiddenYn: undefined, page: 1, size: 10 } })).data,
                    10,
                ),
            },
            {
                key: "audits",
                label: "감사 이력",
                fallback: emptyAdminPage(12),
                load: async () => normalizeAdminPage(
                    (await api.get("/admin/audits", { params: { type: "ALL", page: 1, size: 12 } })).data,
                    12,
                ),
            },
            {
                key: "roleMembers",
                label: "권한 회원",
                enabled: isMaster,
                disabledMessage: "마스터 권한에서만 조회됩니다.",
                fallback: emptyAdminPage(10),
                load: async () => normalizeAdminPage(
                    (await api.get("/admin/roles/members", { params: { page: 1, size: 10 } })).data,
                    10,
                ),
            },
            {
                key: "roleAudits",
                label: "권한 감사",
                enabled: isMaster,
                disabledMessage: "마스터 권한에서만 조회됩니다.",
                fallback: emptyAdminPage(10),
                load: async () => normalizeAdminPage(
                    (await api.get("/admin/roles/audits", { params: { page: 1, size: 10 } })).data,
                    10,
                ),
            },
        ];

        const sections = await Promise.all(sectionSpecs.map(commandCenterSection));
        return sections.reduce((acc, section) => {
            acc[section.key] = section.data;
            acc.sources[section.key] = section.source;
            return acc;
        }, { sources: {} });
    },

    async updateIncident(incidentId, draft) {
        await api.patch(`/admin/anomalies/incidents/${incidentId}`, buildIncidentUpdatePayload(draft));
    },

    async applyIncidentAction(incidentId, payload) {
        await api.post(`/admin/anomalies/incidents/${incidentId}/actions`, buildIncidentActionPayload(payload));
    },

    async markNotificationRead(notificationId) {
        await api.patch(`/admin/notifications/${notificationId}/read`, { read_yn: true });
    },

    async markAllNotificationsRead() {
        await api.post("/admin/notifications/read-all");
    },

    async updateReportStatus(reportId, { reportStatus, adminNote }) {
        await api.patch(`/admin/reports/${reportId}`, {
            report_status: reportStatus,
            admin_note: toLimitedText(adminNote, ADMIN_ANOMALY_TEXT_LIMITS.reportAdminNote),
        });
    },

    async createSanction({ memberId, reason, days }) {
        await api.post("/admin/sanctions", {
            member_id: memberId,
            reason: toLimitedText(reason, ADMIN_ANOMALY_TEXT_LIMITS.sanctionReason),
            days: Number.isFinite(days) && days > 0 ? days : undefined,
        });
    },

    async releaseSanction(sanctionId, { reason }) {
        await api.patch(`/admin/sanctions/${sanctionId}/release`, {
            reason: toLimitedText(reason, ADMIN_ANOMALY_TEXT_LIMITS.sanctionReason),
        });
    },

    async updateBoardHidden(boardId, { hiddenYn, reason }) {
        await api.patch(`/admin/moderation/boards/${boardId}`, {
            hidden_yn: hiddenYn,
            reason: toLimitedText(reason, ADMIN_ANOMALY_TEXT_LIMITS.moderationReason),
        });
    },

    async updateCommentHidden(commentId, { hiddenYn, reason }) {
        await api.patch(`/admin/moderation/comments/${commentId}`, {
            hidden_yn: hiddenYn,
            reason: toLimitedText(reason, ADMIN_ANOMALY_TEXT_LIMITS.moderationReason),
        });
    },

    async updateMemberAdminRole(memberId, { roles, reason }) {
        await api.patch(`/admin/roles/members/${memberId}`, {
            roles,
            reason: toLimitedText(reason, ADMIN_ANOMALY_TEXT_LIMITS.roleReason),
        });
    },

    async saveRule(metric, draft) {
        await api.put("/admin/anomalies/rules", buildRulePayload({ metric, ...draft }));
    },

    async createRule(rule) {
        await api.put("/admin/anomalies/rules", buildRulePayload(rule));
    },

    async downloadReport(days = 7) {
        const response = await api.get("/admin/anomalies/report", {
            params: { days },
            responseType: "blob",
        });
        return response.data;
    },
};
