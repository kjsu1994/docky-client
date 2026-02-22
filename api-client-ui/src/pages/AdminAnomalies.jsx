import { useEffect, useMemo, useState } from "react";
import {
    AlertTriangle,
    RefreshCw,
    ShieldAlert,
    Users,
    MessageSquare,
    Eye,
    Activity,
    Download,
    Settings,
    ClipboardList,
    BellRing,
    PlusCircle,
    Save,
    UserCog,
    History,
    UserX,
    EyeOff,
    RotateCcw,
    ScrollText,
} from "lucide-react";
import api from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import { hasRole, isAdminUser } from "../utils/authorization";
import toast from "react-hot-toast";

const unwrapData = (payload) => payload?.data?.data ?? payload?.data ?? payload ?? null;

// 백엔드 응답 래퍼(data/items/content)가 달라도 이벤트 목록을 안정적으로 파싱한다.
const toEventList = (payload) => {
    const root = payload?.data ?? payload;
    if (Array.isArray(root)) return root;
    if (Array.isArray(root?.data)) return root.data;
    if (Array.isArray(root?.items)) return root.items;
    if (Array.isArray(root?.content)) return root.content;
    return [];
};

const toNumber = (value) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return 0;
    return parsed;
};

const getMemberIdValue = (member) => member?.memberId ?? member?.member_id ?? null;
const getBoardIdValue = (board) => board?.boardId ?? board?.board_id ?? null;
const getCommentIdValue = (comment) => comment?.commentId ?? comment?.comment_id ?? null;
const getBoardCreatorValue = (board) => board?.boardCreator ?? board?.board_creator ?? '';
const getWriterNameValue = (comment) => comment?.writerName ?? comment?.writer_name ?? '';
const getHiddenYnValue = (target) => {
    const value = target?.hiddenYn ?? target?.hidden_yn;
    return value === "Y" || value === true;
};
const toHiddenYnLiteral = (value) => {
    if (value === "Y" || value === true) return "Y";
    if (value === "N" || value === false) return "N";
    return null;
};

const STATUS_OPTIONS = ["ALL", "NEW", "REVIEWING", "RESOLVED", "FALSE_POSITIVE"];
const EDITABLE_STATUS_OPTIONS = ["NEW", "REVIEWING", "RESOLVED", "FALSE_POSITIVE"];

const StatCard = ({ icon: Icon, label, value, tone = "slate" }) => {
    const toneClass = {
        slate: "text-slate-600 bg-slate-50/50 border-slate-100",
        blue: "text-primary-600 bg-primary-50/50 border-primary-100",
        emerald: "text-emerald-600 bg-emerald-50/50 border-emerald-100",
        amber: "text-amber-600 bg-amber-50/50 border-amber-100",
    };

    return (
        <div className={`card p-6 flex flex-col items-center justify-center text-center ${toneClass[tone] || toneClass.slate}`}>
            <div className="mb-3 p-3 rounded-2xl bg-white shadow-sm">
                <Icon className="h-6 w-6" />
            </div>
            <div className="text-[11px] font-black uppercase tracking-widest opacity-70 mb-1">
                {label}
            </div>
            <div className="text-3xl font-black tracking-tight text-slate-900">{value.toLocaleString()}</div>
        </div>
    );
};

export const AdminAnomalies = () => {
    const { user } = useAuth();
    const isAdmin = useMemo(() => isAdminUser(user), [user]);
    const isMaster = useMemo(() => {
        if (!user) return false;
        return (
            hasRole(user.roles, "ROLE_MASTER") ||
            hasRole(user.role, "ROLE_MASTER") ||
            hasRole(user.member?.roles, "ROLE_MASTER") ||
            hasRole(user.member?.role, "ROLE_MASTER")
        );
    }, [user]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [savingIncidentId, setSavingIncidentId] = useState(null);

    const [summary, setSummary] = useState(null);
    const [events, setEvents] = useState([]);
    const [kpi, setKpi] = useState(null);
    const [rules, setRules] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
    const [reportList, setReportList] = useState({ items: [], page: 1, size: 20, totalElements: 0, totalPages: 0 });
    const [reportStatusFilter, setReportStatusFilter] = useState("ALL");
    const [roleMembers, setRoleMembers] = useState({ items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 });
    const [roleAudits, setRoleAudits] = useState({ items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 });
    const [roleKeyword, setRoleKeyword] = useState("");
    const [sanctions, setSanctions] = useState({ items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 });
    const [sanctionStatusFilter, setSanctionStatusFilter] = useState("ALL");
    const [moderationBoards, setModerationBoards] = useState({ items: [], page: 1, size: 8, totalElements: 0, totalPages: 0 });
    const [moderationComments, setModerationComments] = useState({ items: [], page: 1, size: 8, totalElements: 0, totalPages: 0 });
    const [moderationHiddenFilter, setModerationHiddenFilter] = useState("ALL");
    const [auditItems, setAuditItems] = useState({ items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 });
    const [auditTypeFilter, setAuditTypeFilter] = useState("ALL");

    const [statusFilter, setStatusFilter] = useState("ALL");
    const [page, setPage] = useState(1);
    const [incidentList, setIncidentList] = useState({ items: [], page: 1, size: 20, totalElements: 0, totalPages: 0 });
    const [selectedDetail, setSelectedDetail] = useState(null);
    const [ruleDrafts, setRuleDrafts] = useState({});
    const [incidentDrafts, setIncidentDrafts] = useState({});
    const [newRule, setNewRule] = useState({ metric: "", hardLimitPerMinute: 60, zScoreThreshold: 3.0, enabled: true });

    const REPORT_STATUS_OPTIONS = ["ALL", "OPEN", "IN_REVIEW", "RESOLVED", "REJECTED"];
    const SANCTION_STATUS_OPTIONS = ["ALL", "ACTIVE", "RELEASED"];
    const AUDIT_TYPE_OPTIONS = ["ALL", "ROLE", "REPORT", "MODERATION", "SANCTION", "ANOMALY"];

    const fetchIncidents = async (nextStatus = statusFilter, nextPage = page) => {
        const response = await api.get("/admin/anomalies/incidents", {
            params: { status: nextStatus, page: nextPage, size: 20 },
        });
        const payload = unwrapData(response.data) || { items: [], page: 1, size: 20, totalElements: 0, totalPages: 0 };
        setIncidentList(payload);
        setIncidentDrafts(
            (payload.items || []).reduce((acc, item) => {
                acc[item.incidentId] = {
                    incidentStatus: item.incidentStatus,
                    assignee: item.assignee || "",
                    note: item.note || "",
                };
                return acc;
            }, {})
        );
    };

    const fetchDetail = async (incidentId) => {
        const response = await api.get(`/admin/anomalies/incidents/${incidentId}`);
        setSelectedDetail(unwrapData(response.data));
    };

    const fetchNotifications = async () => {
        const response = await api.get("/admin/notifications", {
            params: { readYn: false, page: 1, size: 8 },
        });
        const payload = unwrapData(response.data);
        setNotifications(payload?.items || []);
        setNotificationUnreadCount(payload?.unreadCount || 0);
    };

    const fetchReports = async (status = reportStatusFilter) => {
        const response = await api.get("/admin/reports", {
            params: { status, page: 1, size: 10 },
        });
        const payload = unwrapData(response.data) || { items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 };
        setReportList(payload);
    };

    const fetchSanctions = async (status = sanctionStatusFilter) => {
        const response = await api.get("/admin/sanctions", {
            params: { status, page: 1, size: 10 },
        });
        const payload = unwrapData(response.data) || { items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 };
        setSanctions(payload);
    };

    const fetchModerationBoards = async (hidden = moderationHiddenFilter) => {
        const hiddenYn = hidden === "ALL" ? undefined : hidden === "HIDDEN";
        const response = await api.get("/admin/moderation/boards", {
            params: { hiddenYn, page: 1, size: 8 },
        });
        const payload = unwrapData(response.data) || { items: [], page: 1, size: 8, totalElements: 0, totalPages: 0 };
        setModerationBoards(payload);
    };

    const fetchModerationComments = async (hidden = moderationHiddenFilter) => {
        const hiddenYn = hidden === "ALL" ? undefined : hidden === "HIDDEN";
        const response = await api.get("/admin/moderation/comments", {
            params: { hiddenYn, page: 1, size: 8 },
        });
        const payload = unwrapData(response.data) || { items: [], page: 1, size: 8, totalElements: 0, totalPages: 0 };
        setModerationComments(payload);
    };

    const fetchAudits = async (type = auditTypeFilter) => {
        const response = await api.get("/admin/audits", {
            params: { type, page: 1, size: 10 },
        });
        const payload = unwrapData(response.data) || { items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 };
        setAuditItems(payload);
    };

    const fetchRoleMembers = async (keyword = roleKeyword) => {
        if (!isMaster) return;
        const response = await api.get("/admin/roles/members", {
            params: { keyword: keyword || undefined, page: 1, size: 10 },
        });
        const payload = unwrapData(response.data) || { items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 };
        setRoleMembers(payload);
    };

    const fetchRoleAudits = async () => {
        if (!isMaster) return;
        const response = await api.get("/admin/roles/audits", {
            params: { page: 1, size: 10 },
        });
        const payload = unwrapData(response.data) || { items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 };
        setRoleAudits(payload);
    };

    const fetchDashboard = async (nextStatus = statusFilter, nextPage = page) => {
        setLoading(true);
        setError("");
        try {
            // 관리자 운영 대시보드 핵심 데이터(통계/KPI/규칙/사건함/실시간 이벤트)를 일괄 조회한다.
            const roleMembersPromise = isMaster
                ? api.get("/admin/roles/members", { params: { keyword: roleKeyword || undefined, page: 1, size: 10 } })
                : Promise.resolve({ data: { data: { items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 } } });
            const roleAuditsPromise = isMaster
                ? api.get("/admin/roles/audits", { params: { page: 1, size: 10 } })
                : Promise.resolve({ data: { data: { items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 } } });

            const [summaryRes, eventsRes, kpiRes, rulesRes, incidentsRes, notificationsRes, reportsRes, sanctionsRes, moderationBoardsRes, moderationCommentsRes, auditsRes, roleMembersRes, roleAuditsRes] = await Promise.all([
                api.get("/stats/summary"),
                api.get("/stats/anomalies", { params: { limit: 50 } }),
                api.get("/admin/anomalies/kpi", { params: { days: 7 } }),
                api.get("/admin/anomalies/rules"),
                api.get("/admin/anomalies/incidents", { params: { status: nextStatus, page: nextPage, size: 20 } }),
                api.get("/admin/notifications", { params: { readYn: false, page: 1, size: 8 } }),
                api.get("/admin/reports", { params: { status: reportStatusFilter, page: 1, size: 10 } }),
                api.get("/admin/sanctions", { params: { status: sanctionStatusFilter, page: 1, size: 10 } }),
                api.get("/admin/moderation/boards", {
                    params: { hiddenYn: moderationHiddenFilter === "ALL" ? undefined : moderationHiddenFilter === "HIDDEN", page: 1, size: 8 },
                }),
                api.get("/admin/moderation/comments", {
                    params: { hiddenYn: moderationHiddenFilter === "ALL" ? undefined : moderationHiddenFilter === "HIDDEN", page: 1, size: 8 },
                }),
                api.get("/admin/audits", { params: { type: auditTypeFilter, page: 1, size: 10 } }),
                roleMembersPromise,
                roleAuditsPromise,
            ]);

            const nextRules = unwrapData(rulesRes.data) || [];
            const nextIncidents = unwrapData(incidentsRes.data) || { items: [], page: 1, size: 20, totalElements: 0, totalPages: 0 };
            setSummary(unwrapData(summaryRes.data));
            setEvents(toEventList(eventsRes.data));
            setKpi(unwrapData(kpiRes.data));
            setRules(nextRules);
            setIncidentList(nextIncidents);
            const nextNotifications = unwrapData(notificationsRes.data) || { items: [], unreadCount: 0 };
            const nextReports = unwrapData(reportsRes.data) || { items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 };
            const nextSanctions = unwrapData(sanctionsRes.data) || { items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 };
            const nextModerationBoards = unwrapData(moderationBoardsRes.data) || { items: [], page: 1, size: 8, totalElements: 0, totalPages: 0 };
            const nextModerationComments = unwrapData(moderationCommentsRes.data) || { items: [], page: 1, size: 8, totalElements: 0, totalPages: 0 };
            const nextAudits = unwrapData(auditsRes.data) || { items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 };
            const nextRoleMembers = unwrapData(roleMembersRes.data) || { items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 };
            const nextRoleAudits = unwrapData(roleAuditsRes.data) || { items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 };
            setNotifications(nextNotifications.items || []);
            setNotificationUnreadCount(nextNotifications.unreadCount || 0);
            setReportList(nextReports);
            setSanctions(nextSanctions);
            setModerationBoards(nextModerationBoards);
            setModerationComments(nextModerationComments);
            setAuditItems(nextAudits);
            if (isMaster) {
                setRoleMembers(nextRoleMembers);
                setRoleAudits(nextRoleAudits);
            }
            setRuleDrafts(
                nextRules.reduce((acc, rule) => {
                    acc[rule.metric] = {
                        hardLimitPerMinute: rule.hardLimitPerMinute,
                        zScoreThreshold: rule.zScoreThreshold,
                        enabled: rule.enabled,
                    };
                    return acc;
                }, {})
            );
            setIncidentDrafts(
                (nextIncidents.items || []).reduce((acc, item) => {
                    acc[item.incidentId] = {
                        incidentStatus: item.incidentStatus,
                        assignee: item.assignee || "",
                        note: item.note || "",
                    };
                    return acc;
                }, {})
            );
        } catch (err) {
            setError(err?.response?.data?.message || "관리자 대시보드를 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isAdmin) {
            setLoading(false);
            return;
        }
        fetchDashboard("ALL", 1);
    }, [isAdmin]);

    const changeFilter = async (nextStatus) => {
        setStatusFilter(nextStatus);
        setPage(1);
        await fetchDashboard(nextStatus, 1);
    };

    const changePage = async (nextPage) => {
        setPage(nextPage);
        await fetchIncidents(statusFilter, nextPage);
    };

    const changeReportFilter = async (nextStatus) => {
        setReportStatusFilter(nextStatus);
        await fetchReports(nextStatus);
    };

    const saveIncidentInline = async (incidentId) => {
        const draft = incidentDrafts[incidentId];
        if (!draft) return;

        setSavingIncidentId(incidentId);
        try {
            await api.patch(`/admin/anomalies/incidents/${incidentId}`, {
                incidentStatus: draft.incidentStatus,
                assignee: draft.assignee,
                note: draft.note,
            });
            await fetchIncidents(statusFilter, page);
            if (selectedDetail?.incident?.incidentId === incidentId) {
                await fetchDetail(incidentId);
            }
            await fetchDashboard(statusFilter, page);
        } finally {
            setSavingIncidentId(null);
        }
    };

    const applyAction = async (incidentId, actionType) => {
        const description = window.prompt("조치 메모를 입력하세요.", "");
        if (description === null) return;

        const payload = { actionType, description };
        if (actionType === "BLOCK_QUEUE_USER") {
            const blockMinutesInput = window.prompt("차단 시간(분)을 입력하세요.", "30");
            if (blockMinutesInput === null) return;
            payload.blockMinutes = Math.max(1, Math.min(1440, Number(blockMinutesInput) || 30));
        }

        await api.post(`/admin/anomalies/incidents/${incidentId}/actions`, payload);
        await fetchIncidents(statusFilter, page);
        await fetchDetail(incidentId);
        await fetchDashboard(statusFilter, page);
    };

    const markNotificationRead = async (notificationId) => {
        await api.patch(`/admin/notifications/${notificationId}/read`, { readYn: true });
        await fetchNotifications();
    };

    const markAllNotificationsRead = async () => {
        await api.post("/admin/notifications/read-all");
        await fetchNotifications();
    };

    const updateReportStatus = async (reportId, reportStatus) => {
        const adminNote = window.prompt("처리 메모를 입력하세요.", "") || "";
        await api.patch(`/admin/reports/${reportId}`, { reportStatus, adminNote });
        await fetchReports(reportStatusFilter);
        await fetchNotifications();
    };

    const createSanction = async () => {
        const memberIdInput = window.prompt("제재할 회원 ID를 입력하세요.", "");
        if (!memberIdInput) return;
        const reason = window.prompt("제재 사유를 입력하세요.", "운영 정책 위반");
        if (!reason) return;
        const daysInput = window.prompt("제재 기간(일, 비우면 무기한)", "");
        const days = daysInput ? Number(daysInput) : undefined;
        try {
            await api.post("/admin/sanctions", {
                memberId: Number(memberIdInput),
                reason,
                days: Number.isFinite(days) && days > 0 ? days : undefined,
            });
            toast.success("회원 제재를 등록했습니다.");
            await fetchSanctions(sanctionStatusFilter);
            await fetchNotifications();
            await fetchAudits(auditTypeFilter);
        } catch (err) {
            toast.error(err?.response?.data?.message || "회원 제재 등록에 실패했습니다.");
        }
    };

    const releaseSanction = async (sanctionId) => {
        const reason = window.prompt("제재 해제 사유를 입력하세요.", "") || "";
        try {
            await api.patch(`/admin/sanctions/${sanctionId}/release`, { reason });
            toast.success("회원 제재를 해제했습니다.");
            await fetchSanctions(sanctionStatusFilter);
            await fetchAudits(auditTypeFilter);
        } catch (err) {
            toast.error(err?.response?.data?.message || "제재 해제에 실패했습니다.");
        }
    };

    const updateBoardHidden = async (boardId, hiddenYn) => {
        const normalizedBoardId = Number(boardId);
        if (!Number.isFinite(normalizedBoardId) || normalizedBoardId <= 0) {
            toast.error("유효한 게시글 ID를 찾지 못했습니다.");
            return;
        }
        const normalizedHiddenYn = toHiddenYnLiteral(hiddenYn);
        if (!normalizedHiddenYn) {
            toast.error("hiddenYn 값이 올바르지 않습니다.");
            return;
        }

        const reason = window.prompt(normalizedHiddenYn === "Y" ? "숨김 사유를 입력하세요." : "복구 사유를 입력하세요.", "") || "";
        try {
            await api.patch(`/admin/moderation/boards/${normalizedBoardId}`, { hiddenYn: normalizedHiddenYn, reason });
            toast.success(normalizedHiddenYn === "Y" ? "게시글을 숨겼습니다." : "게시글을 복구했습니다.");
            await fetchModerationBoards(moderationHiddenFilter);
            await fetchAudits(auditTypeFilter);
        } catch (err) {
            toast.error(err?.response?.data?.message || "게시글 모더레이션에 실패했습니다.");
        }
    };

    const updateCommentHidden = async (commentId, hiddenYn) => {
        const normalizedCommentId = Number(commentId);
        if (!Number.isFinite(normalizedCommentId) || normalizedCommentId <= 0) {
            toast.error("유효한 댓글 ID를 찾지 못했습니다.");
            return;
        }
        const normalizedHiddenYn = toHiddenYnLiteral(hiddenYn);
        if (!normalizedHiddenYn) {
            toast.error("hiddenYn 값이 올바르지 않습니다.");
            return;
        }

        const reason = window.prompt(normalizedHiddenYn === "Y" ? "숨김 사유를 입력하세요." : "복구 사유를 입력하세요.", "") || "";
        try {
            await api.patch(`/admin/moderation/comments/${normalizedCommentId}`, { hiddenYn: normalizedHiddenYn, reason });
            toast.success(normalizedHiddenYn === "Y" ? "댓글을 숨겼습니다." : "댓글을 복구했습니다.");
            await fetchModerationComments(moderationHiddenFilter);
            await fetchAudits(auditTypeFilter);
        } catch (err) {
            toast.error(err?.response?.data?.message || "댓글 모더레이션에 실패했습니다.");
        }
    };

    const changeSanctionFilter = async (status) => {
        setSanctionStatusFilter(status);
        await fetchSanctions(status);
    };

    const changeModerationFilter = async (hiddenFilter) => {
        setModerationHiddenFilter(hiddenFilter);
        await Promise.all([
            fetchModerationBoards(hiddenFilter),
            fetchModerationComments(hiddenFilter),
        ]);
    };

    const changeAuditFilter = async (type) => {
        setAuditTypeFilter(type);
        await fetchAudits(type);
    };

    const hasAdminRole = (roles) => Array.isArray(roles) && roles.includes("ROLE_ADMIN");

    const updateMemberAdminRole = async (member) => {
        const memberId = getMemberIdValue(member);
        if (!memberId) {
            toast.error("회원 ID를 확인할 수 없습니다.");
            return;
        }
        const currentRoles = Array.isArray(member.roles) ? member.roles : [];
        const hasAdmin = hasAdminRole(currentRoles);
        // ROLE_USER는 기본 유지하고 ROLE_ADMIN만 토글해 운영 사고를 줄인다.
        const nextRoles = hasAdmin
            ? currentRoles.filter((role) => role !== "ROLE_ADMIN")
            : Array.from(new Set([...currentRoles, "ROLE_ADMIN"]));

        const reason = window.prompt(
            hasAdmin ? "관리자 권한 해제 사유를 입력하세요." : "관리자 권한 부여 사유를 입력하세요.",
            ""
        );
        if (reason === null) return;

        try {
            await api.patch(`/admin/roles/members/${memberId}`, {
                roles: nextRoles,
                reason,
            });
            await fetchRoleMembers(roleKeyword);
            await fetchRoleAudits();
            await fetchNotifications();
            toast.success(hasAdmin ? "관리자 권한을 해제했습니다." : "관리자 권한을 부여했습니다.");
        } catch (err) {
            const message = err?.response?.data?.message || "권한 변경에 실패했습니다.";
            toast.error(message);
            console.error("Failed to update member admin role:", err);
        }
    };

    const searchRoleMembers = async () => {
        try {
            await fetchRoleMembers(roleKeyword);
        } catch (err) {
            toast.error(err?.response?.data?.message || "회원 조회에 실패했습니다.");
            console.error("Failed to search role members:", err);
        }
    };

    const refreshRules = async () => {
        const rulesRes = await api.get("/admin/anomalies/rules");
        const nextRules = unwrapData(rulesRes.data) || [];
        setRules(nextRules);
        setRuleDrafts(
            nextRules.reduce((acc, rule) => {
                acc[rule.metric] = {
                    hardLimitPerMinute: rule.hardLimitPerMinute,
                    zScoreThreshold: rule.zScoreThreshold,
                    enabled: rule.enabled,
                };
                return acc;
            }, {})
        );
    };

    const saveRule = async (metric) => {
        const draft = ruleDrafts[metric];
        if (!draft) return;

        await api.put("/admin/anomalies/rules", {
            metric,
            hardLimitPerMinute: Number(draft.hardLimitPerMinute) || 1,
            zScoreThreshold: Number(draft.zScoreThreshold) || 1,
            enabled: Boolean(draft.enabled),
        });

        await refreshRules();
    };

    const createRule = async () => {
        if (!newRule.metric.trim()) {
            window.alert("metric 값을 입력하세요.");
            return;
        }

        await api.put("/admin/anomalies/rules", {
            metric: newRule.metric.trim(),
            hardLimitPerMinute: Number(newRule.hardLimitPerMinute) || 1,
            zScoreThreshold: Number(newRule.zScoreThreshold) || 1,
            enabled: Boolean(newRule.enabled),
        });

        setNewRule({ metric: "", hardLimitPerMinute: 60, zScoreThreshold: 3.0, enabled: true });
        await refreshRules();
    };

    const downloadReport = async () => {
        const response = await api.get("/admin/anomalies/report", {
            params: { days: 7 },
            responseType: "blob",
        });

        const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `anomaly-report-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    };

    if (!isAdmin) {
        return (
            <div className="rounded-[2rem] border border-rose-100 bg-rose-50/50 p-10 text-rose-800 text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                    <ShieldAlert className="h-8 w-8 text-rose-500" />
                </div>
                <h1 className="text-xl font-black">관리자 전용 화면</h1>
                <p className="text-sm font-medium opacity-70">관리자 대시보드는 ROLE_ADMIN 권한이 필요합니다.</p>
            </div>
        );
    }

    if (loading) return <LoadingSpinner text="관리 대시보드를 로드 중입니다..." />;

    if (error) {
        return (
            <div className="rounded-[2rem] border border-rose-100 bg-rose-50/50 p-10 text-rose-800 text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                    <AlertTriangle className="h-8 w-8 text-rose-500" />
                </div>
                <h1 className="text-xl font-black">조회 실패</h1>
                <p className="text-sm font-medium opacity-70 mb-4">{error}</p>
                <button
                    onClick={() => fetchDashboard(statusFilter, page)}
                    className="btn-primary"
                >
                    <RefreshCw className="mr-2 h-4 w-4" /> 다시 시도
                </button>
            </div>
        );
    }

    return (
        <section className="space-y-8 animate-fade-in pb-10">
            <div className="flex flex-wrap items-center justify-between gap-6 px-2">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black tracking-tight text-slate-900">관리자 대시보드</h1>
                    <p className="text-sm font-medium text-slate-400">커뮤니티의 모든 활동과 보안 상태를 모니터링합니다.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fetchDashboard(statusFilter, page)}
                        className="btn-secondary py-2.5 px-4"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </button>
                    <button
                        onClick={downloadReport}
                        className="btn-primary"
                    >
                        <Download className="mr-2 h-4 w-4" /> 리포트 다운로드
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <StatCard icon={Users} label="전체 회원" value={toNumber(summary?.total_members ?? summary?.totalMembers)} tone="blue" />
                <StatCard icon={MessageSquare} label="전체 게시글" value={toNumber(summary?.total_boards ?? summary?.totalBoards)} tone="emerald" />
                <StatCard icon={Eye} label="오늘 방문자" value={toNumber(summary?.today_visitors ?? summary?.todayVisitors)} tone="amber" />
                <StatCard icon={Activity} label="탐지 이벤트" value={events.length} tone="slate" />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="card p-8">
                    <h2 className="mb-6 flex items-center gap-2 text-lg font-black text-slate-900 tracking-tight">
                        <div className="p-2 rounded-xl bg-primary-50 text-primary-600">
                            <ClipboardList className="h-5 w-5" />
                        </div>
                        운영 KPI (7일)
                    </h2>
                    <div className="space-y-4 text-sm">
                        {[
                            { label: "총 사건", val: toNumber(kpi?.totalIncidents) },
                            { label: "신규", val: toNumber(kpi?.newCount), color: "text-primary-600" },
                            { label: "검토중", val: toNumber(kpi?.reviewingCount), color: "text-amber-600" },
                            { label: "해결", val: toNumber(kpi?.resolvedCount), color: "text-emerald-600" },
                            { label: "오탐", val: toNumber(kpi?.falsePositiveCount), color: "text-slate-400" },
                        ].map(item => (
                            <div key={item.label} className="flex justify-between items-center py-1 border-b border-slate-50 last:border-0">
                                <span className="font-bold text-slate-500">{item.label}</span>
                                <b className={`text-base font-black ${item.color || "text-slate-900"}`}>{item.val}</b>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card p-8 xl:col-span-2">
                    <h2 className="mb-6 flex items-center gap-2 text-lg font-black text-slate-900 tracking-tight">
                        <div className="p-2 rounded-xl bg-primary-50 text-primary-600">
                            <BellRing className="h-5 w-5" />
                        </div>
                        최근 이상탐지 이벤트
                    </h2>
                    {!events.length ? (
                        <div className="flex flex-col items-center justify-center h-48 rounded-[2rem] bg-slate-50/50 text-slate-400 font-bold">
                            최근 탐지된 이벤트가 없습니다.
                        </div>
                    ) : (
                        <div className="max-h-72 overflow-auto rounded-2xl border border-slate-50">
                            <table className="min-w-full text-sm">
                                <thead className="bg-slate-50/50 text-slate-400 font-black uppercase text-[10px] tracking-widest">
                                    <tr>
                                        <th className="px-4 py-4 text-left">시각</th>
                                        <th className="px-4 py-4 text-left">Metric</th>
                                        <th className="px-4 py-4 text-left">Actor</th>
                                        <th className="px-4 py-4 text-right">Z-Score</th>
                                    </tr>
                                </thead>
                                <tbody className="font-bold text-slate-600">
                                    {events.map((event, idx) => (
                                        <tr key={`${event.metric}-${event.actorId}-${event.detectedAt}-${idx}`} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-4 text-[11px] font-medium">{event.detectedAt}</td>
                                            <td className="px-4 py-4"><span className="px-2 py-1 rounded-lg bg-slate-100 text-[10px] uppercase">{event.metric}</span></td>
                                            <td className="px-4 py-4 text-slate-900">{event.actorId}</td>
                                            <td className="px-4 py-4 text-right text-primary-600 font-black">{toNumber(event.zScore).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="card p-8">
                    <div className="mb-8 flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-lg font-black text-slate-900 tracking-tight">
                            <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                                <UserX className="h-5 w-5" />
                            </div>
                            사용자 제재
                        </h2>
                        <div className="flex items-center gap-2">
                            <select
                                value={sanctionStatusFilter}
                                onChange={(e) => changeSanctionFilter(e.target.value)}
                                className="input-base py-1.5 px-3 w-auto rounded-xl text-xs font-bold border-0 bg-slate-50"
                            >
                                {SANCTION_STATUS_OPTIONS.map((status) => (
                                    <option key={status} value={status}>{status}</option>
                                ))}
                            </select>
                            <button className="p-2 rounded-xl bg-primary-600 text-white shadow-lg shadow-primary-100" onClick={createSanction}><PlusCircle className="h-4 w-4" /></button>
                        </div>
                    </div>
                    {!sanctions.items?.length ? (
                        <div className="flex flex-col items-center justify-center h-48 rounded-[2rem] bg-slate-50/50 text-slate-400 font-bold text-sm">제재 내역이 없습니다.</div>
                    ) : (
                        <div className="space-y-4 max-h-[400px] overflow-auto pr-2">
                            {sanctions.items.map((sanction) => (
                                <div key={sanction.sanctionId} className="p-5 rounded-2xl bg-slate-50/50 border border-slate-100 hover:border-rose-100 transition-colors">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="font-black text-slate-900 text-sm">#{sanction.sanctionId}</div>
                                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${sanction.sanctionStatus === 'ACTIVE' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-600'}`}>
                                            {sanction.sanctionStatus}
                                        </span>
                                    </div>
                                    <div className="text-[13px] font-bold text-slate-600 mb-1">{sanction.memberEmail}</div>
                                    <div className="text-[12px] font-medium text-slate-400 mb-4">{sanction.reason}</div>
                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-300">
                                        <span>{sanction.createdAt}</span>
                                        {sanction.sanctionStatus === "ACTIVE" && (
                                            <button
                                                className="text-primary-600 hover:underline"
                                                onClick={() => releaseSanction(sanction.sanctionId)}
                                            >
                                                제재 해제
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="card p-8 xl:col-span-2">
                    <div className="mb-8 flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-lg font-black text-slate-900 tracking-tight">
                            <div className="p-2 rounded-xl bg-primary-50 text-primary-600">
                                <EyeOff className="h-5 w-5" />
                            </div>
                            콘텐츠 모더레이션
                        </h2>
                        <select
                            value={moderationHiddenFilter}
                            onChange={(e) => changeModerationFilter(e.target.value)}
                            className="input-base py-1.5 px-4 w-auto rounded-xl text-xs font-bold border-0 bg-slate-50"
                        >
                            <option value="ALL">ALL FILTERS</option>
                            <option value="HIDDEN">HIDDEN ONLY</option>
                            <option value="VISIBLE">VISIBLE ONLY</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                        <div className="space-y-4">
                            <h3 className="px-2 text-xs font-black text-slate-400 uppercase tracking-widest">게시글</h3>
                            <div className="space-y-3">
                                {(moderationBoards.items || []).map((board) => (
                                    <div key={getBoardIdValue(board) ?? `board-${Math.random()}`} className="group p-5 rounded-2xl border border-slate-50 bg-slate-50/30 hover:bg-white hover:shadow-xl transition-all duration-300">
                                        <div className="flex items-start justify-between gap-3 mb-2">
                                            <div className="font-bold text-slate-900 text-sm line-clamp-1 group-hover:text-primary-600 transition-colors">#{getBoardIdValue(board)} {board.title}</div>
                                            <span className={`flex-shrink-0 px-2 py-0.5 rounded-lg text-[9px] font-black tracking-wider ${getHiddenYnValue(board) ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {getHiddenYnValue(board) ? "HIDDEN" : "VISIBLE"}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-bold text-slate-400">{getBoardCreatorValue(board)}</span>
                                            <button
                                                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-black transition-all ${getHiddenYnValue(board) ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}
                                                onClick={() => updateBoardHidden(getBoardIdValue(board), !getHiddenYnValue(board))}
                                            >
                                                {getHiddenYnValue(board) ? <RotateCcw className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                                                {getHiddenYnValue(board) ? "복구" : "숨김"}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h3 className="px-2 text-xs font-black text-slate-400 uppercase tracking-widest">댓글</h3>
                            <div className="space-y-3">
                                {(moderationComments.items || []).map((comment) => (
                                    <div key={getCommentIdValue(comment) ?? `comment-${Math.random()}`} className="group p-5 rounded-2xl border border-slate-50 bg-slate-50/30 hover:bg-white hover:shadow-xl transition-all duration-300">
                                        <div className="flex items-start justify-between gap-3 mb-2">
                                            <div className="font-bold text-slate-900 text-sm line-clamp-1 group-hover:text-primary-600 transition-colors">#{getCommentIdValue(comment)} (board #{getBoardIdValue(comment)})</div>
                                            <span className={`flex-shrink-0 px-2 py-0.5 rounded-lg text-[9px] font-black tracking-wider ${getHiddenYnValue(comment) ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {getHiddenYnValue(comment) ? "HIDDEN" : "VISIBLE"}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-bold text-slate-400">{getWriterNameValue(comment)}</span>
                                            <button
                                                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-black transition-all ${getHiddenYnValue(comment) ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}
                                                onClick={() => updateCommentHidden(getCommentIdValue(comment), !getHiddenYnValue(comment))}
                                            >
                                                {getHiddenYnValue(comment) ? <RotateCcw className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                                                {getHiddenYnValue(comment) ? "복구" : "숨김"}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card p-8">
                <div className="mb-8 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-lg font-black text-slate-900 tracking-tight">
                        <div className="p-2 rounded-xl bg-primary-50 text-primary-600">
                            <ScrollText className="h-5 w-5" />
                        </div>
                        통합 Audit Log
                    </h2>
                    <select
                        value={auditTypeFilter}
                        onChange={(e) => changeAuditFilter(e.target.value)}
                        className="input-base py-1.5 px-4 w-auto rounded-xl text-xs font-bold border-0 bg-slate-50"
                    >
                        {AUDIT_TYPE_OPTIONS.map((type) => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                </div>
                {!auditItems.items?.length ? (
                    <div className="flex flex-col items-center justify-center h-48 rounded-[2rem] bg-slate-50/50 text-slate-400 font-bold text-sm">감사 이력이 없습니다.</div>
                ) : (
                    <div className="space-y-3">
                        {auditItems.items.map((audit, idx) => (
                            <div key={`${audit.auditType}-${audit.createdAt}-${idx}`} className="flex flex-wrap items-center justify-between p-5 rounded-2xl bg-slate-50/30 border border-slate-50 hover:bg-white transition-all">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-primary-600 uppercase tracking-widest">{audit.auditType}</span>
                                        <div className="h-1 w-1 rounded-full bg-slate-200" />
                                        <span className="text-sm font-bold text-slate-900">{audit.actionType}</span>
                                    </div>
                                    <p className="text-[13px] font-medium text-slate-500">{audit.summary}</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-[11px] font-black text-slate-900">{audit.actor}</div>
                                    <div className="text-[10px] font-bold text-slate-300">{audit.createdAt}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {isMaster && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="card p-8">
                    <div className="mb-8 flex items-center justify-between">
                        <h2 className="text-lg font-black text-slate-900 tracking-tight">관리자 메신저</h2>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-[10px] font-black text-rose-600 uppercase">
                                <BellRing className="h-3 w-3" /> {toNumber(notificationUnreadCount)} UNREAD
                            </div>
                            <button className="text-[11px] font-bold text-slate-400 hover:text-primary-600" onClick={markAllNotificationsRead}>전체읽음</button>
                        </div>
                    </div>

                    {!notifications.length ? (
                        <div className="flex flex-col items-center justify-center h-64 rounded-[2rem] bg-slate-50/50 text-slate-400 font-bold text-sm">새 알림이 없습니다.</div>
                    ) : (
                        <div className="space-y-4 max-h-[500px] overflow-auto pr-2">
                            {notifications.map((notification) => (
                                <div key={notification.notificationId} className="group p-6 rounded-3xl bg-slate-50/50 border border-slate-100 hover:bg-white hover:shadow-xl transition-all">
                                    <div className="mb-3 flex items-center justify-between">
                                        <div className="text-sm font-black text-slate-900 line-clamp-1">{notification.title}</div>
                                        <span className="px-2 py-0.5 rounded-lg bg-slate-200 text-[9px] font-black text-slate-600 uppercase tracking-tighter">{notification.severity}</span>
                                    </div>
                                    <p className="mb-5 text-[13px] font-medium text-slate-500 leading-relaxed">{notification.message}</p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-slate-300">{notification.createdAt}</span>
                                        <button
                                            className="btn-primary py-1.5 px-4 text-[11px]"
                                            onClick={() => markNotificationRead(notification.notificationId)}
                                        >
                                            읽음 처리
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="card p-8">
                    <div className="mb-8 flex items-center justify-between">
                        <h2 className="text-lg font-black text-slate-900 tracking-tight">사용자 신고함</h2>
                        <select
                            value={reportStatusFilter}
                            onChange={(e) => changeReportFilter(e.target.value)}
                            className="input-base py-1.5 px-4 w-auto rounded-xl text-xs font-bold border-0 bg-slate-50"
                        >
                            {REPORT_STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                    </div>

                    {!reportList.items?.length ? (
                        <div className="flex flex-col items-center justify-center h-64 rounded-[2rem] bg-slate-50/50 text-slate-400 font-bold text-sm">신고 내역이 없습니다.</div>
                    ) : (
                        <div className="space-y-4 max-h-[500px] overflow-auto pr-2">
                            {reportList.items.map((report) => (
                                <div key={report.reportId} className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm">
                                    <div className="mb-4 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-slate-900 tracking-tighter">#{report.reportId}</span>
                                            <span className="px-2 py-0.5 rounded-lg bg-primary-50 text-[9px] font-black text-primary-600 uppercase tracking-widest">{report.targetType}</span>
                                            <span className="text-[10px] font-bold text-slate-400">ID: {report.targetId}</span>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black tracking-tight ${report.reportStatus === 'OPEN' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                            {report.reportStatus}
                                        </span>
                                    </div>
                                    <p className="mb-6 text-sm font-bold text-slate-700 leading-relaxed">{report.reason} <span className="text-slate-400 font-medium">{report.detail ? `- ${report.detail}` : ""}</span></p>
                                    <div className="flex flex-wrap gap-2">
                                        <button className="flex-1 rounded-2xl bg-slate-50 py-2.5 text-[11px] font-black text-slate-600 hover:bg-primary-50 hover:text-primary-600 transition-all" onClick={() => updateReportStatus(report.reportId, "IN_REVIEW")}>검토중</button>
                                        <button className="flex-1 rounded-2xl bg-emerald-50 py-2.5 text-[11px] font-black text-emerald-600 hover:bg-emerald-100 transition-all" onClick={() => updateReportStatus(report.reportId, "RESOLVED")}>해결</button>
                                        <button className="flex-1 rounded-2xl bg-rose-50 py-2.5 text-[11px] font-black text-rose-600 hover:bg-rose-100 transition-all" onClick={() => updateReportStatus(report.reportId, "REJECTED")}>반려</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            )}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="card p-8">
                    <div className="mb-8 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-black text-slate-900 tracking-tight">권한 관리</h2>
                            <span className={`rounded-xl px-3 py-1 text-[10px] font-black tracking-widest uppercase ${isMaster ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                {isMaster ? "MASTER ACCESS" : "ADMIN ACCESS"}
                            </span>
                        </div>
                        <button className="text-slate-300 hover:text-primary-600 transition-colors" onClick={() => fetchRoleMembers(roleKeyword)}><RefreshCw className="h-4 w-4" /></button>
                    </div>
                    {!isMaster && (
                        <div className="mb-6 rounded-2xl bg-amber-50 p-4 text-[11px] font-bold text-amber-700 leading-relaxed">
                            ROLE_MASTER 계정만 관리자 권한 부여/해제가 가능합니다.
                        </div>
                    )}
                    <div className="mb-8 flex gap-3">
                        <div className="relative flex-1">
                            <input
                                value={roleKeyword}
                                onChange={(e) => setRoleKeyword(e.target.value)}
                                placeholder="이름 또는 이메일로 검색"
                                className="input-base w-full pl-4 pr-10"
                            />
                        </div>
                        <button className="btn-primary py-2.5 px-6 whitespace-nowrap" onClick={searchRoleMembers}>검색</button>
                    </div>

                    {!roleMembers.items?.length ? (
                        <div className="flex flex-col items-center justify-center h-64 rounded-[2rem] bg-slate-50/50 text-slate-400 font-bold text-sm">조회된 회원이 없습니다.</div>
                    ) : (
                        <div className="space-y-4 max-h-[600px] overflow-auto pr-2">
                            {roleMembers.items.map((member) => (
                                <div key={getMemberIdValue(member) || member.email} className="group p-6 rounded-3xl border border-slate-100 bg-white hover:shadow-xl transition-all duration-300">
                                    <div className="mb-4 flex items-center justify-between">
                                        <div className="space-y-1">
                                            <div className="text-base font-black text-slate-900">{member.name || "(이름없음)"}</div>
                                            <div className="text-xs font-bold text-slate-400">{member.email} <span className="ml-2">#{getMemberIdValue(member)}</span></div>
                                        </div>
                                        <span className={`px-2 py-1 rounded-lg text-[9px] font-black tracking-widest uppercase ${member.memberStatus === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                                            {member.memberStatus}
                                        </span>
                                    </div>
                                    <div className="mb-6 flex flex-wrap gap-1.5">
                                        {(member.roles || []).map((role) => (
                                            <span key={`${getMemberIdValue(member)}-${role}`} className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                                                {role}
                                            </span>
                                        ))}
                                    </div>
                                    <button
                                        className={`w-full rounded-2xl py-3 text-xs font-black transition-all ${hasAdminRole(member.roles) ? "bg-rose-50 text-rose-600 hover:bg-rose-100" : "bg-primary-50 text-primary-600 hover:bg-primary-100"}`}
                                        onClick={() => updateMemberAdminRole(member)}
                                        disabled={!isMaster}
                                    >
                                        {hasAdminRole(member.roles) ? "관리자 해제" : "관리자 부여"}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="card p-8">
                    <div className="mb-8 flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-lg font-black text-slate-900 tracking-tight">
                            <History className="h-5 w-5 text-primary-600" />
                            권한 변경 이력
                        </h2>
                        <button className="text-slate-300 hover:text-primary-600" onClick={fetchRoleAudits}><RefreshCw className="h-4 w-4" /></button>
                    </div>
                    {!roleAudits.items?.length ? (
                        <div className="flex flex-col items-center justify-center h-64 rounded-[2rem] bg-slate-50/50 text-slate-400 font-bold text-sm">변경 이력이 없습니다.</div>
                    ) : (
                        <div className="space-y-4 max-h-[700px] overflow-auto pr-2">
                            {roleAudits.items.map((audit) => (
                                <div key={audit.roleAuditId} className="p-6 rounded-3xl bg-slate-50/30 border border-slate-50">
                                    <div className="mb-4 flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-slate-400">
                                        <span>#{audit.roleAuditId}</span>
                                        <span>{audit.createdAt}</span>
                                    </div>
                                    <div className="mb-4 space-y-2">
                                        <div className="text-[13px] font-bold text-slate-900"><span className="text-slate-400">TARGET:</span> {audit.targetEmail} (#{audit.targetMemberId})</div>
                                        <div className="text-[13px] font-bold text-slate-900"><span className="text-slate-400">ADMIN:</span> {audit.changedByEmail}</div>
                                    </div>
                                    <div className="mb-4 flex items-center gap-3 py-3 px-4 rounded-2xl bg-white shadow-sm font-black text-xs">
                                        <span className="text-slate-300 line-through decoration-rose-400">{audit.beforeRoles}</span>
                                        <ArrowRight className="h-3 w-3 text-primary-400" />
                                        <span className="text-primary-600">{audit.afterRoles}</span>
                                    </div>
                                    <div className="text-[12px] font-bold text-slate-500 italic"><span className="text-slate-300 font-medium">REASON:</span> {audit.changeReason || "(없음)"}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="card p-8 overflow-hidden">
                <div className="mb-10 flex flex-wrap items-center justify-between gap-6">
                    <div className="space-y-1">
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Incident Inbox</h2>
                        <p className="text-sm font-medium text-slate-400">실시간으로 탐지된 이상 활동을 즉시 처리합니다.</p>
                    </div>
                    <div className="flex items-center gap-4 rounded-3xl bg-slate-50 p-2">
                        <span className="ml-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">상태 필터</span>
                        <select
                            value={statusFilter}
                            onChange={(e) => changeFilter(e.target.value)}
                            className="input-base py-2 px-6 w-auto rounded-2xl border-0 bg-white shadow-sm text-sm font-black"
                        >
                            {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {!incidentList.items?.length ? (
                    <div className="flex flex-col items-center justify-center h-64 rounded-[2rem] bg-slate-50/50 text-slate-400 font-bold text-sm">조회된 사건이 없습니다.</div>
                ) : (
                    <div className="overflow-x-auto -mx-8">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-50/50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                <tr>
                                    <th className="px-8 py-5 text-left">ID</th>
                                    <th className="px-8 py-5 text-left">Detected Metric</th>
                                    <th className="px-8 py-5 text-left">Actor Info</th>
                                    <th className="px-8 py-5 text-left">Processing Status</th>
                                    <th className="px-8 py-5 text-left">Assignee / Note</th>
                                    <th className="px-8 py-5 text-right">Instant Action</th>
                                </tr>
                            </thead>
                            <tbody className="font-bold text-slate-600">
                                {incidentList.items.map((item) => {
                                    const draft = incidentDrafts[item.incidentId] || {
                                        incidentStatus: item.incidentStatus,
                                        assignee: item.assignee || "",
                                        note: item.note || "",
                                    };

                                    return (
                                        <tr key={item.incidentId} className="border-t border-slate-50 group transition-all hover:bg-slate-50/50 align-top">
                                            <td className="px-8 py-6 font-black text-slate-900">#{item.incidentId}</td>
                                            <td className="px-8 py-6"><span className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-600 text-[11px] uppercase tracking-tighter">{item.metric}</span></td>
                                            <td className="px-8 py-6 text-slate-900">{item.actorId}</td>
                                            <td className="px-8 py-6">
                                                <select
                                                    className="input-base py-2 px-4 w-40 rounded-xl border-0 bg-white shadow-sm text-[12px] font-black"
                                                    value={draft.incidentStatus}
                                                    onChange={(e) => setIncidentDrafts((prev) => ({
                                                        ...prev,
                                                        [item.incidentId]: { ...draft, incidentStatus: e.target.value },
                                                    }))}
                                                >
                                                    {EDITABLE_STATUS_OPTIONS.map((status) => (
                                                        <option key={status} value={status}>{status}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-8 py-6 space-y-2">
                                                <input
                                                    className="input-base py-2 px-4 w-full rounded-xl border-0 bg-white shadow-sm text-[12px] font-bold"
                                                    value={draft.assignee}
                                                    placeholder="담당자 입력"
                                                    onChange={(e) => setIncidentDrafts((prev) => ({
                                                        ...prev,
                                                        [item.incidentId]: { ...draft, assignee: e.target.value },
                                                    }))}
                                                />
                                                <textarea
                                                    className="input-base py-2 px-4 w-full rounded-xl border-0 bg-white shadow-sm text-[12px] font-medium"
                                                    rows={1}
                                                    value={draft.note}
                                                    placeholder="처리 내역 메모"
                                                    onChange={(e) => setIncidentDrafts((prev) => ({
                                                        ...prev,
                                                        [item.incidentId]: { ...draft, note: e.target.value },
                                                    }))}
                                                />
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-wrap justify-end gap-2">
                                                    <div className="flex gap-1.5 bg-white p-1 rounded-2xl shadow-sm">
                                                        <button className="p-2 rounded-xl hover:bg-primary-50 text-slate-300 hover:text-primary-600 transition-all" onClick={() => fetchDetail(item.incidentId)} title="상세조회"><Activity className="h-4 w-4" /></button>
                                                        <button className="p-2 rounded-xl hover:bg-rose-50 text-slate-300 hover:text-rose-600 transition-all" onClick={() => applyAction(item.incidentId, "BLOCK_QUEUE_USER")} title="접속차단"><UserX className="h-4 w-4" /></button>
                                                        <button className="p-2 rounded-xl hover:bg-amber-50 text-slate-300 hover:text-amber-600 transition-all" onClick={() => applyAction(item.incidentId, "WARN_MEMBER")} title="경고발송"><BellRing className="h-4 w-4" /></button>
                                                    </div>
                                                    <button
                                                        className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 text-[12px] font-black text-white hover:bg-primary-600 disabled:opacity-20 transition-all duration-300"
                                                        disabled={savingIncidentId === item.incidentId}
                                                        onClick={() => saveIncidentInline(item.incidentId)}
                                                    >
                                                        {savingIncidentId === item.incidentId ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Save className="h-3.5 w-3.5" />} 
                                                        SAVE
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="mt-10 flex items-center justify-between bg-slate-50/50 p-6 rounded-[2rem]">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Total: {toNumber(incidentList.totalElements)} incidents</span>
                    <div className="flex items-center gap-6">
                        <button
                            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm text-slate-400 hover:text-primary-600 disabled:opacity-30 transition-all"
                            disabled={page <= 1}
                            onClick={() => changePage(page - 1)}
                        >
                            <ArrowRight className="h-5 w-5 rotate-180" />
                        </button>
                        <span className="text-sm font-black text-slate-900">{page} <span className="text-slate-300 mx-2">/</span> {Math.max(1, toNumber(incidentList.totalPages))}</span>
                        <button
                            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm text-slate-400 hover:text-primary-600 disabled:opacity-30 transition-all"
                            disabled={page >= Math.max(1, toNumber(incidentList.totalPages))}
                            onClick={() => changePage(page + 1)}
                        >
                            <ArrowRight className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>

            {selectedDetail?.incident && (
                <div className="card p-10 bg-slate-900 text-white animate-slide-up">
                    <div className="mb-10 flex flex-wrap items-center justify-between gap-6">
                        <div className="space-y-2">
                            <h2 className="text-3xl font-black tracking-tight">Incident Deep Dive <span className="text-primary-400">#{selectedDetail.incident.incidentId}</span></h2>
                            <p className="text-sm font-medium text-slate-400">탐지된 활동에 대한 상세 데이터 및 타임라인 분석</p>
                        </div>
                        <button className="text-slate-500 hover:text-white transition-colors" onClick={() => setSelectedDetail(null)}><X className="h-8 w-8" /></button>
                    </div>
                    
                    <div className="mb-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                        {[
                            { label: "Detected Metric", val: selectedDetail.incident.metric, color: "text-primary-400" },
                            { label: "Target Actor", val: selectedDetail.incident.actorId, color: "text-white" },
                            { label: "Current Status", val: selectedDetail.incident.incidentStatus, color: "text-amber-400" },
                            { label: "Z-Score Analysis", val: selectedDetail.incident.zScore, color: "text-rose-400" },
                        ].map(stat => (
                            <div key={stat.label} className="p-6 rounded-[2rem] bg-white/5 border border-white/10">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{stat.label}</p>
                                <p className={`text-xl font-black tracking-tight ${stat.color}`}>{stat.val}</p>
                            </div>
                        ))}
                    </div>

                    <div className="mb-12 space-y-4">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest px-2">Decision Actions</h3>
                        <div className="flex flex-wrap gap-4">
                            <button className="flex-1 rounded-[2rem] bg-primary-600 py-6 text-sm font-black hover:bg-primary-700 transition-all shadow-xl shadow-primary-900/40" onClick={() => applyAction(selectedDetail.incident.incidentId, "BLOCK_QUEUE_USER")}>QUEUE BLOCK</button>
                            <button className="flex-1 rounded-[2rem] bg-white/5 border border-white/10 py-6 text-sm font-black hover:bg-white/10 transition-all" onClick={() => applyAction(selectedDetail.incident.incidentId, "WARN_MEMBER")}>WARN USER</button>
                            <button className="flex-1 rounded-[2rem] bg-white/5 border border-white/10 py-6 text-sm font-black hover:bg-white/10 transition-all" onClick={() => applyAction(selectedDetail.incident.incidentId, "CLEAR_QUEUE_BLOCK")}>RESTORE ACCESS</button>
                        </div>
                    </div>

                    <div className="rounded-[2.5rem] bg-black/30 p-10">
                        <h3 className="mb-8 flex items-center gap-3 text-lg font-black tracking-tight">
                            <History className="h-5 w-5 text-primary-400" />
                            Action Timeline Analysis
                        </h3>
                        {!selectedDetail.actions?.length ? (
                            <div className="flex flex-col items-center justify-center h-48 text-slate-600 font-bold italic">No actions recorded for this incident.</div>
                        ) : (
                            <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-white/5">
                                {selectedDetail.actions.map((action) => (
                                    <div key={action.actionLogId} className="relative pl-10">
                                        <div className="absolute left-0 top-1.5 h-6 w-6 rounded-full bg-slate-900 border-4 border-primary-500 shadow-xl" />
                                        <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] font-black text-primary-400 uppercase tracking-widest">{action.actionType}</span>
                                                <div className="h-1 w-1 rounded-full bg-slate-700" />
                                                <span className="text-[13px] font-black">{action.actor}</span>
                                            </div>
                                            <span className="text-[11px] font-bold text-slate-500">{action.createdAt}</span>
                                        </div>
                                        <p className="text-sm font-medium text-slate-400 leading-relaxed bg-white/5 p-4 rounded-2xl">{action.description}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="card p-8">
                <div className="mb-10 flex items-center gap-3 px-2">
                    <div className="p-2 rounded-xl bg-slate-900 text-white shadow-xl shadow-slate-200">
                        <Settings className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Detection Rule Management</h2>
                        <p className="text-[12px] font-medium text-slate-400 uppercase tracking-widest">Global Threshold Configuration</p>
                    </div>
                </div>

                <div className="mb-12 grid grid-cols-1 gap-4 rounded-[2.5rem] bg-slate-50/50 p-6 sm:grid-cols-5 sm:items-center border-2 border-dashed border-slate-200">
                    <div className="px-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Metric Name</p>
                        <input
                            className="input-base border-0 shadow-sm rounded-2xl font-bold"
                            placeholder="e.g. login.attempt"
                            value={newRule.metric}
                            onChange={(e) => setNewRule((prev) => ({ ...prev, metric: e.target.value }))}
                        />
                    </div>
                    <div className="px-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Hard Limit / m</p>
                        <input
                            type="number"
                            className="input-base border-0 shadow-sm rounded-2xl font-bold"
                            value={newRule.hardLimitPerMinute}
                            onChange={(e) => setNewRule((prev) => ({ ...prev, hardLimitPerMinute: e.target.value }))}
                        />
                    </div>
                    <div className="px-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Z-Threshold</p>
                        <input
                            type="number"
                            step="0.1"
                            className="input-base border-0 shadow-sm rounded-2xl font-bold"
                            value={newRule.zScoreThreshold}
                            onChange={(e) => setNewRule((prev) => ({ ...prev, zScoreThreshold: e.target.value }))}
                        />
                    </div>
                    <div className="flex items-center justify-center pt-4 sm:pt-6">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div className={`flex h-12 w-20 items-center rounded-full p-1 transition-all duration-300 ${newRule.enabled ? 'bg-primary-500' : 'bg-slate-300'}`}>
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={Boolean(newRule.enabled)}
                                    onChange={(e) => setNewRule((prev) => ({ ...prev, enabled: e.target.checked }))}
                                />
                                <div className={`h-10 w-10 rounded-full bg-white shadow-md transition-all duration-300 ${newRule.enabled ? 'translate-x-8' : 'translate-x-0'}`} />
                            </div>
                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover:text-primary-600 transition-colors">Enabled</span>
                        </label>
                    </div>
                    <div className="pt-4 sm:pt-6 px-2">
                        <button className="w-full btn-primary shadow-xl shadow-primary-200" onClick={createRule}>
                            <PlusCircle className="mr-2 h-4 w-4" /> CREATE RULE
                        </button>
                    </div>
                </div>
                
                {!rules.length ? (
                    <div className="flex flex-col items-center justify-center h-48 rounded-[2rem] bg-slate-50/50 text-slate-400 font-bold text-sm">등록된 탐지 규칙이 없습니다.</div>
                ) : (
                    <div className="space-y-4">
                        {rules.map((rule) => {
                            const draft = ruleDrafts[rule.metric] || {
                                hardLimitPerMinute: rule.hardLimitPerMinute,
                                zScoreThreshold: rule.zScoreThreshold,
                                enabled: rule.enabled,
                            };
                            return (
                                <div key={rule.metric} className="group grid grid-cols-1 gap-6 rounded-[2rem] bg-white border border-slate-100 p-8 sm:grid-cols-5 sm:items-center transition-all hover:shadow-xl hover:-translate-y-1">
                                    <div className="font-black text-slate-900 text-lg tracking-tight px-2">{rule.metric}</div>
                                    <div className="px-2">
                                        <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Limit / min</p>
                                        <input
                                            type="number"
                                            className="input-base py-2.5 px-4 bg-slate-50/50 border-0 rounded-xl font-black text-sm"
                                            value={draft.hardLimitPerMinute}
                                            onChange={(e) => setRuleDrafts((prev) => ({
                                                ...prev,
                                                [rule.metric]: { ...draft, hardLimitPerMinute: e.target.value },
                                            }))}
                                        />
                                    </div>
                                    <div className="px-2">
                                        <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Z-Score</p>
                                        <input
                                            type="number"
                                            step="0.1"
                                            className="input-base py-2.5 px-4 bg-slate-50/50 border-0 rounded-xl font-black text-sm"
                                            value={draft.zScoreThreshold}
                                            onChange={(e) => setRuleDrafts((prev) => ({
                                                ...prev,
                                                [rule.metric]: { ...draft, zScoreThreshold: e.target.value },
                                            }))}
                                        />
                                    </div>
                                    <div className="flex items-center justify-center pt-2">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <div className={`flex h-8 w-14 items-center rounded-full p-1 transition-all duration-300 ${draft.enabled ? 'bg-primary-500' : 'bg-slate-300'}`}>
                                                <input
                                                    type="checkbox"
                                                    className="hidden"
                                                    checked={Boolean(draft.enabled)}
                                                    onChange={(e) => setRuleDrafts((prev) => ({
                                                        ...prev,
                                                        [rule.metric]: { ...draft, enabled: e.target.checked },
                                                    }))}
                                                />
                                                <div className={`h-6 w-6 rounded-full bg-white shadow-sm transition-all duration-300 ${draft.enabled ? 'translate-x-6' : 'translate-x-0'}`} />
                                            </div>
                                        </label>
                                    </div>
                                    <div className="px-2">
                                        <button className="w-full h-12 rounded-2xl bg-slate-900 text-white text-[11px] font-black hover:bg-primary-600 transition-all uppercase tracking-widest" onClick={() => saveRule(rule.metric)}>
                                            UPDATE
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
};



