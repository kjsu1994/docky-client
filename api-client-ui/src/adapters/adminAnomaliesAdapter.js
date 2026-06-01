import api, { getApiErrorMessage } from "../utils/api.js";

export const unwrapAdminData = (payload) => payload?.data?.data ?? payload?.data ?? payload ?? null;

export const emptyAdminPage = (size = 10) => ({
    items: [],
    page: 1,
    size,
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
        page: Number(data.page || 1),
        size: Number(data.size || size),
        totalElements: Number(data.totalElements ?? data.total_elements ?? 0),
        totalPages: Number(data.totalPages ?? data.total_pages ?? 0),
        ...(data.unreadCount !== undefined || data.unread_count !== undefined
            ? { unreadCount: Number(data.unreadCount ?? data.unread_count ?? 0) }
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

export const buildIncidentUpdatePayload = ({ incidentStatus, assignee, note } = {}) => ({
    incident_status: incidentStatus,
    assignee,
    note,
});

export const buildIncidentActionPayload = ({ actionType, description, blockMinutes } = {}) => ({
    action_type: actionType,
    description,
    ...(blockMinutes === undefined ? {} : { block_minutes: Math.max(1, Math.min(1440, Number(blockMinutes) || 30)) }),
});

export const buildRulePayload = ({ metric, hardLimitPerMinute, zScoreThreshold, enabled } = {}) => ({
    metric: String(metric || "").trim(),
    hard_limit_per_minute: Number(hardLimitPerMinute) || 1,
    z_score_threshold: Number(zScoreThreshold) || 1,
    enabled: Boolean(enabled),
});

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
        const response = await api.get("/members/list", { params: { keyword, page, size } });
        const payload = unwrapAdminData(response.data);
        const items = payload?.items || payload?.content || payload?.data || payload || [];
        return Array.isArray(items) ? items : [];
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
        const response = await api.get("/admin/audits", { params: { type, page, size } });
        return normalizeAdminPage(response.data, size);
    },

    async fetchRoleMembers({ keyword, page = 1, size = 10 } = {}) {
        const response = await api.get("/admin/roles/members", {
            params: { keyword: keyword || undefined, page, size },
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
        const roleMembersPromise = isMaster
            ? api.get("/admin/roles/members", { params: { keyword: roleKeyword || undefined, page: 1, size: 10 } })
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
            api.get("/admin/audits", { params: { type: auditType, page: 1, size: 10 } }),
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
        await api.patch(`/admin/reports/${reportId}`, { report_status: reportStatus, admin_note: adminNote });
    },

    async createSanction({ memberId, reason, days }) {
        await api.post("/admin/sanctions", {
            member_id: memberId,
            reason,
            days: Number.isFinite(days) && days > 0 ? days : undefined,
        });
    },

    async releaseSanction(sanctionId, { reason }) {
        await api.patch(`/admin/sanctions/${sanctionId}/release`, { reason });
    },

    async updateBoardHidden(boardId, { hiddenYn, reason }) {
        await api.patch(`/admin/moderation/boards/${boardId}`, { hidden_yn: hiddenYn, reason });
    },

    async updateCommentHidden(commentId, { hiddenYn, reason }) {
        await api.patch(`/admin/moderation/comments/${commentId}`, { hidden_yn: hiddenYn, reason });
    },

    async updateMemberAdminRole(memberId, { roles, reason }) {
        await api.patch(`/admin/roles/members/${memberId}`, { roles, reason });
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
