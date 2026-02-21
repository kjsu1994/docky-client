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
const getHiddenYnValue = (target) => target?.hiddenYn ?? target?.hidden_yn ?? false;

const STATUS_OPTIONS = ["ALL", "NEW", "REVIEWING", "RESOLVED", "FALSE_POSITIVE"];
const EDITABLE_STATUS_OPTIONS = ["NEW", "REVIEWING", "RESOLVED", "FALSE_POSITIVE"];

const StatCard = ({ icon: Icon, label, value, tone = "slate" }) => {
    const toneClass = {
        slate: "text-slate-700 bg-slate-50 border-slate-200",
        blue: "text-blue-700 bg-blue-50 border-blue-200",
        emerald: "text-emerald-700 bg-emerald-50 border-emerald-200",
        amber: "text-amber-700 bg-amber-50 border-amber-200",
    };

    return (
        <div className={`rounded-xl border p-4 ${toneClass[tone] || toneClass.slate}`}>
            <div className="flex items-center justify-between text-sm font-semibold">
                <span>{label}</span>
                <Icon className="h-4 w-4" />
            </div>
            <div className="mt-2 text-2xl font-bold">{value.toLocaleString()}</div>
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

        const reason = window.prompt(hiddenYn ? "숨김 사유를 입력하세요." : "복구 사유를 입력하세요.", "") || "";
        try {
            await api.patch(`/admin/moderation/boards/${normalizedBoardId}`, { hiddenYn, reason });
            toast.success(hiddenYn ? "게시글을 숨겼습니다." : "게시글을 복구했습니다.");
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

        const reason = window.prompt(hiddenYn ? "숨김 사유를 입력하세요." : "복구 사유를 입력하세요.", "") || "";
        try {
            await api.patch(`/admin/moderation/comments/${normalizedCommentId}`, { hiddenYn, reason });
            toast.success(hiddenYn ? "댓글을 숨겼습니다." : "댓글을 복구했습니다.");
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
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
                <div className="mb-2 flex items-center gap-2 font-bold">
                    <ShieldAlert className="h-5 w-5" /> 관리자 전용 화면
                </div>
                <p className="text-sm">관리자 대시보드는 ROLE_ADMIN만 조회할 수 있습니다.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <div className="mb-3 h-6 w-56 animate-pulse rounded bg-slate-200" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="h-24 animate-pulse rounded bg-slate-100" />
                    <div className="h-24 animate-pulse rounded bg-slate-100" />
                    <div className="h-24 animate-pulse rounded bg-slate-100" />
                    <div className="h-24 animate-pulse rounded bg-slate-100" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
                <div className="mb-2 flex items-center gap-2 font-bold">
                    <AlertTriangle className="h-5 w-5" /> 조회 실패
                </div>
                <p className="mb-4 text-sm">{error}</p>
                <button
                    onClick={() => fetchDashboard(statusFilter, page)}
                    className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                >
                    <RefreshCw className="h-4 w-4" /> 다시 시도
                </button>
            </div>
        );
    }

    return (
        <section className="space-y-5">
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h1 className="text-xl font-bold text-slate-900">관리자 이상탐지 콘솔</h1>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => fetchDashboard(statusFilter, page)}
                            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            <RefreshCw className="h-4 w-4" /> 새로고침
                        </button>
                        <button
                            onClick={downloadReport}
                            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                        >
                            <Download className="h-4 w-4" /> CSV
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard icon={Users} label="전체 회원" value={toNumber(summary?.total_members ?? summary?.totalMembers)} tone="blue" />
                    <StatCard icon={MessageSquare} label="전체 게시글" value={toNumber(summary?.total_boards ?? summary?.totalBoards)} tone="emerald" />
                    <StatCard icon={Eye} label="오늘 방문자" value={toNumber(summary?.today_visitors ?? summary?.todayVisitors)} tone="amber" />
                    <StatCard icon={Activity} label="실시간 이상탐지" value={events.length} tone="slate" />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                <div className="rounded-2xl border bg-white p-5 shadow-sm">
                    <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900">
                        <ClipboardList className="h-5 w-5" /> 운영 KPI (7일)
                    </h2>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span>총 사건</span><b>{toNumber(kpi?.totalIncidents)}</b></div>
                        <div className="flex justify-between"><span>신규</span><b>{toNumber(kpi?.newCount)}</b></div>
                        <div className="flex justify-between"><span>검토중</span><b>{toNumber(kpi?.reviewingCount)}</b></div>
                        <div className="flex justify-between"><span>해결</span><b>{toNumber(kpi?.resolvedCount)}</b></div>
                        <div className="flex justify-between"><span>오탐</span><b>{toNumber(kpi?.falsePositiveCount)}</b></div>
                        <div className="flex justify-between"><span>평균 처리시간(분)</span><b>{toNumber(kpi?.avgResolveMinutes).toFixed(2)}</b></div>
                        <div className="flex justify-between"><span>재발률(%)</span><b>{toNumber(kpi?.recurrenceRate).toFixed(2)}</b></div>
                    </div>
                </div>

                <div className="rounded-2xl border bg-white p-5 shadow-sm xl:col-span-2">
                    <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900">
                        <BellRing className="h-5 w-5" /> 최근 이상탐지 이벤트
                    </h2>
                    {!events.length ? (
                        <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">최근 이벤트가 없습니다.</div>
                    ) : (
                        <div className="max-h-64 overflow-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-slate-50 text-slate-700">
                                    <tr>
                                        <th className="px-2 py-2 text-left">시각</th>
                                        <th className="px-2 py-2 text-left">Metric</th>
                                        <th className="px-2 py-2 text-left">Actor</th>
                                        <th className="px-2 py-2 text-right">Count</th>
                                        <th className="px-2 py-2 text-right">Z</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {events.map((event, idx) => (
                                        <tr key={`${event.metric}-${event.actorId}-${event.detectedAt}-${idx}`} className="border-t">
                                            <td className="px-2 py-2">{event.detectedAt}</td>
                                            <td className="px-2 py-2">{event.metric}</td>
                                            <td className="px-2 py-2">{event.actorId}</td>
                                            <td className="px-2 py-2 text-right">{event.count}</td>
                                            <td className="px-2 py-2 text-right">{toNumber(event.zScore).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                <div className="rounded-2xl border bg-white p-5 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                            <UserX className="h-5 w-5" /> 사용자 제재
                        </h2>
                        <div className="flex items-center gap-2">
                            <select
                                value={sanctionStatusFilter}
                                onChange={(e) => changeSanctionFilter(e.target.value)}
                                className="rounded border px-2 py-1 text-sm"
                            >
                                {SANCTION_STATUS_OPTIONS.map((status) => (
                                    <option key={status} value={status}>{status}</option>
                                ))}
                            </select>
                            <button className="rounded border px-2 py-1 text-xs" onClick={createSanction}>제재 등록</button>
                        </div>
                    </div>
                    {!sanctions.items?.length ? (
                        <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">제재 내역이 없습니다.</div>
                    ) : (
                        <div className="space-y-2">
                            {sanctions.items.map((sanction) => (
                                <div key={sanction.sanctionId} className="rounded-xl border p-3 text-sm">
                                    <div className="mb-1 font-semibold">#{sanction.sanctionId} · {sanction.memberEmail}</div>
                                    <div className="text-xs text-slate-600">{sanction.sanctionStatus} · {sanction.reason}</div>
                                    <div className="text-[11px] text-slate-400">{sanction.createdAt}</div>
                                    {sanction.sanctionStatus === "ACTIVE" && (
                                        <button
                                            className="mt-2 rounded border px-2 py-1 text-xs"
                                            onClick={() => releaseSanction(sanction.sanctionId)}
                                        >
                                            제재 해제
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="rounded-2xl border bg-white p-5 shadow-sm xl:col-span-2">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                            <EyeOff className="h-5 w-5" /> 콘텐츠 모더레이션
                        </h2>
                        <select
                            value={moderationHiddenFilter}
                            onChange={(e) => changeModerationFilter(e.target.value)}
                            className="rounded border px-2 py-1 text-sm"
                        >
                            <option value="ALL">ALL</option>
                            <option value="HIDDEN">HIDDEN</option>
                            <option value="VISIBLE">VISIBLE</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div>
                            <h3 className="mb-2 text-sm font-semibold text-slate-700">게시글</h3>
                            <div className="space-y-2">
                                {(moderationBoards.items || []).map((board) => (
                                    <div key={getBoardIdValue(board) ?? `board-${Math.random()}`} className="rounded border p-2 text-sm">
                                        <div className="font-semibold">#{getBoardIdValue(board)} {board.title}</div>
                                        <div className="text-xs text-slate-500">{getHiddenYnValue(board) ? "HIDDEN" : "VISIBLE"} · {getBoardCreatorValue(board)}</div>
                                        <button
                                            className="mt-1 rounded border px-2 py-1 text-xs"
                                            onClick={() => updateBoardHidden(getBoardIdValue(board), !getHiddenYnValue(board))}
                                        >
                                            {getHiddenYnValue(board) ? <RotateCcw className="mr-1 inline h-3 w-3" /> : <EyeOff className="mr-1 inline h-3 w-3" />}
                                            {getHiddenYnValue(board) ? "복구" : "숨김"}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h3 className="mb-2 text-sm font-semibold text-slate-700">댓글</h3>
                            <div className="space-y-2">
                                {(moderationComments.items || []).map((comment) => (
                                    <div key={getCommentIdValue(comment) ?? `comment-${Math.random()}`} className="rounded border p-2 text-sm">
                                        <div className="font-semibold">#{getCommentIdValue(comment)} (board #{getBoardIdValue(comment)})</div>
                                        <div className="text-xs text-slate-500">{getHiddenYnValue(comment) ? "HIDDEN" : "VISIBLE"} · {getWriterNameValue(comment)}</div>
                                        <button
                                            className="mt-1 rounded border px-2 py-1 text-xs"
                                            onClick={() => updateCommentHidden(getCommentIdValue(comment), !getHiddenYnValue(comment))}
                                        >
                                            {getHiddenYnValue(comment) ? <RotateCcw className="mr-1 inline h-3 w-3" /> : <EyeOff className="mr-1 inline h-3 w-3" />}
                                            {getHiddenYnValue(comment) ? "복구" : "숨김"}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                        <ScrollText className="h-5 w-5" /> 통합 Audit
                    </h2>
                    <select
                        value={auditTypeFilter}
                        onChange={(e) => changeAuditFilter(e.target.value)}
                        className="rounded border px-2 py-1 text-sm"
                    >
                        {AUDIT_TYPE_OPTIONS.map((type) => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                </div>
                {!auditItems.items?.length ? (
                    <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">조회된 감사 이력이 없습니다.</div>
                ) : (
                    <div className="space-y-2">
                        {auditItems.items.map((audit, idx) => (
                            <div key={`${audit.auditType}-${audit.createdAt}-${idx}`} className="rounded border p-3 text-sm">
                                <div className="font-semibold">{audit.auditType} · {audit.actionType}</div>
                                <div className="text-xs text-slate-600">{audit.summary}</div>
                                <div className="text-xs text-slate-500">{audit.actor} · {audit.createdAt}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {isMaster && (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <div className="rounded-2xl border bg-white p-5 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-slate-900">관리자 메신저</h2>
                        <div className="flex items-center gap-2">
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
                                unread {toNumber(notificationUnreadCount)}
                            </span>
                            <button className="rounded border px-2 py-1 text-xs" onClick={markAllNotificationsRead}>전체읽음</button>
                        </div>
                    </div>

                    {!notifications.length ? (
                        <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">새 알림이 없습니다.</div>
                    ) : (
                        <div className="space-y-2">
                            {notifications.map((notification) => (
                                <div key={notification.notificationId} className="rounded-xl border p-3">
                                    <div className="mb-1 flex items-center justify-between">
                                        <div className="text-sm font-semibold">{notification.title}</div>
                                        <span className="text-xs text-slate-500">{notification.severity}</span>
                                    </div>
                                    <p className="mb-2 text-xs text-slate-600">{notification.message}</p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-slate-400">{notification.createdAt}</span>
                                        <button
                                            className="rounded border px-2 py-1 text-xs"
                                            onClick={() => markNotificationRead(notification.notificationId)}
                                        >
                                            읽음
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="rounded-2xl border bg-white p-5 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-slate-900">신고함</h2>
                        <select
                            value={reportStatusFilter}
                            onChange={(e) => changeReportFilter(e.target.value)}
                            className="rounded border px-2 py-1 text-sm"
                        >
                            {REPORT_STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                    </div>

                    {!reportList.items?.length ? (
                        <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">신고 내역이 없습니다.</div>
                    ) : (
                        <div className="space-y-2">
                            {reportList.items.map((report) => (
                                <div key={report.reportId} className="rounded-xl border p-3">
                                    <div className="mb-1 flex items-center justify-between">
                                        <div className="text-sm font-semibold">
                                            #{report.reportId} {report.targetType} {report.targetId}
                                        </div>
                                        <span className="text-xs text-slate-500">{report.reportStatus}</span>
                                    </div>
                                    <p className="mb-2 text-xs text-slate-600">{report.reason} {report.detail ? `- ${report.detail}` : ""}</p>
                                    <div className="flex flex-wrap gap-1">
                                        <button className="rounded border px-2 py-1 text-xs" onClick={() => updateReportStatus(report.reportId, "IN_REVIEW")}>검토중</button>
                                        <button className="rounded border px-2 py-1 text-xs" onClick={() => updateReportStatus(report.reportId, "RESOLVED")}>해결</button>
                                        <button className="rounded border px-2 py-1 text-xs" onClick={() => updateReportStatus(report.reportId, "REJECTED")}>반려</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            )}

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <div className="rounded-2xl border bg-white p-5 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                                <UserCog className="h-5 w-5" /> 권한관리
                            </h2>
                            <span className={`rounded border px-2 py-0.5 text-xs ${isMaster ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-700"}`}>
                                {isMaster ? "내 권한: MASTER" : "내 권한: ADMIN"}
                            </span>
                        </div>
                        <button className="rounded border px-2 py-1 text-xs" onClick={() => fetchRoleMembers(roleKeyword)}>새로고침</button>
                    </div>
                    {!isMaster && (
                        <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            ROLE_MASTER 계정만 관리자 권한 부여/해제가 가능합니다.
                        </div>
                    )}
                    <div className="mb-3 flex gap-2">
                        <input
                            value={roleKeyword}
                            onChange={(e) => setRoleKeyword(e.target.value)}
                            placeholder="이름/이메일 검색"
                            className="w-full rounded border px-2 py-1 text-sm"
                        />
                        <button className="rounded border px-3 py-1 text-sm" onClick={searchRoleMembers}>검색</button>
                    </div>

                    {!roleMembers.items?.length ? (
                        <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">조회된 회원이 없습니다.</div>
                    ) : (
                        <div className="space-y-2">
                            {roleMembers.items.map((member) => (
                                <div key={getMemberIdValue(member) || member.email} className="rounded-xl border p-3">
                                    <div className="mb-1 flex items-center justify-between">
                                        <div className="text-sm font-semibold">{member.name || "(이름없음)"} · #{getMemberIdValue(member)}</div>
                                        <span className="text-xs text-slate-500">{member.memberStatus}</span>
                                    </div>
                                    <div className="mb-2 text-xs text-slate-600">{member.email}</div>
                                    <div className="mb-2 flex flex-wrap gap-1">
                                        {(member.roles || []).map((role) => (
                                            <span key={`${getMemberIdValue(member)}-${role}`} className="rounded border bg-slate-50 px-2 py-0.5 text-[11px]">
                                                {role}
                                            </span>
                                        ))}
                                    </div>
                                    <button
                                        className={`rounded px-2 py-1 text-xs text-white ${hasAdminRole(member.roles) ? "bg-rose-600" : "bg-blue-600"}`}
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

                <div className="rounded-2xl border bg-white p-5 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                            <History className="h-5 w-5" /> 권한 변경 이력
                        </h2>
                        <button className="rounded border px-2 py-1 text-xs" onClick={fetchRoleAudits}>새로고침</button>
                    </div>
                    {!roleAudits.items?.length ? (
                        <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">권한 변경 이력이 없습니다.</div>
                    ) : (
                        <div className="space-y-2">
                            {roleAudits.items.map((audit) => (
                                <div key={audit.roleAuditId} className="rounded-xl border p-3 text-sm">
                                    <div className="mb-1 font-semibold">
                                        #{audit.roleAuditId} · 대상 {audit.targetEmail} (#{audit.targetMemberId})
                                    </div>
                                    <div className="text-xs text-slate-600">변경자: {audit.changedByEmail} (#{audit.changedByMemberId})</div>
                                    <div className="text-xs text-slate-600">변경: {audit.beforeRoles} → {audit.afterRoles}</div>
                                    <div className="text-xs text-slate-600">사유: {audit.changeReason || "(없음)"}</div>
                                    <div className="text-[11px] text-slate-400">{audit.createdAt}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-bold text-slate-900">Incident Inbox (인라인 수정)</h2>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">상태</span>
                        <select
                            value={statusFilter}
                            onChange={(e) => changeFilter(e.target.value)}
                            className="rounded-lg border px-3 py-2 text-sm"
                        >
                            {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {!incidentList.items?.length ? (
                    <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">조회된 사건이 없습니다.</div>
                ) : (
                    <div className="overflow-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 text-slate-700">
                                <tr>
                                    <th className="px-2 py-2 text-left">ID</th>
                                    <th className="px-2 py-2 text-left">Metric</th>
                                    <th className="px-2 py-2 text-left">Actor</th>
                                    <th className="px-2 py-2 text-left">Status</th>
                                    <th className="px-2 py-2 text-left">Assignee</th>
                                    <th className="px-2 py-2 text-left">Note</th>
                                    <th className="px-2 py-2 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {incidentList.items.map((item) => {
                                    const draft = incidentDrafts[item.incidentId] || {
                                        incidentStatus: item.incidentStatus,
                                        assignee: item.assignee || "",
                                        note: item.note || "",
                                    };

                                    return (
                                        <tr key={item.incidentId} className="border-t align-top">
                                            <td className="px-2 py-2">{item.incidentId}</td>
                                            <td className="px-2 py-2">{item.metric}</td>
                                            <td className="px-2 py-2">{item.actorId}</td>
                                            <td className="px-2 py-2">
                                                <select
                                                    className="w-36 rounded border px-2 py-1"
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
                                            <td className="px-2 py-2">
                                                <input
                                                    className="w-40 rounded border px-2 py-1"
                                                    value={draft.assignee}
                                                    onChange={(e) => setIncidentDrafts((prev) => ({
                                                        ...prev,
                                                        [item.incidentId]: { ...draft, assignee: e.target.value },
                                                    }))}
                                                />
                                            </td>
                                            <td className="px-2 py-2">
                                                <textarea
                                                    className="w-64 rounded border px-2 py-1"
                                                    rows={2}
                                                    value={draft.note}
                                                    onChange={(e) => setIncidentDrafts((prev) => ({
                                                        ...prev,
                                                        [item.incidentId]: { ...draft, note: e.target.value },
                                                    }))}
                                                />
                                            </td>
                                            <td className="px-2 py-2">
                                                <div className="flex flex-wrap justify-end gap-1">
                                                    <button className="rounded border px-2 py-1" onClick={() => fetchDetail(item.incidentId)}>상세</button>
                                                    <button className="rounded border px-2 py-1" onClick={() => applyAction(item.incidentId, "BLOCK_QUEUE_USER")}>차단</button>
                                                    <button className="rounded border px-2 py-1" onClick={() => applyAction(item.incidentId, "WARN_MEMBER")}>경고</button>
                                                    <button className="rounded border px-2 py-1" onClick={() => applyAction(item.incidentId, "CLEAR_QUEUE_BLOCK")}>해제</button>
                                                    <button
                                                        className="inline-flex items-center gap-1 rounded bg-slate-900 px-2 py-1 text-white disabled:opacity-50"
                                                        disabled={savingIncidentId === item.incidentId}
                                                        onClick={() => saveIncidentInline(item.incidentId)}
                                                    >
                                                        <Save className="h-3 w-3" /> 저장
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

                <div className="mt-3 flex items-center justify-between text-sm">
                    <span>총 {toNumber(incidentList.totalElements)}건</span>
                    <div className="flex gap-2">
                        <button
                            className="rounded border px-3 py-1 disabled:opacity-40"
                            disabled={page <= 1}
                            onClick={() => changePage(page - 1)}
                        >
                            이전
                        </button>
                        <span>{page} / {Math.max(1, toNumber(incidentList.totalPages))}</span>
                        <button
                            className="rounded border px-3 py-1 disabled:opacity-40"
                            disabled={page >= Math.max(1, toNumber(incidentList.totalPages))}
                            onClick={() => changePage(page + 1)}
                        >
                            다음
                        </button>
                    </div>
                </div>
            </div>

            {selectedDetail?.incident && (
                <div className="rounded-2xl border bg-white p-5 shadow-sm">
                    <h2 className="mb-3 text-lg font-bold text-slate-900">Incident Detail #{selectedDetail.incident.incidentId}</h2>
                    <div className="mb-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                        <div><b>Metric:</b> {selectedDetail.incident.metric}</div>
                        <div><b>Actor:</b> {selectedDetail.incident.actorId}</div>
                        <div><b>Status:</b> {selectedDetail.incident.incidentStatus}</div>
                        <div><b>Z:</b> {selectedDetail.incident.zScore}</div>
                    </div>
                    <div className="mb-3 flex flex-wrap gap-2">
                        <button className="rounded border px-3 py-2" onClick={() => applyAction(selectedDetail.incident.incidentId, "BLOCK_QUEUE_USER")}>큐 차단</button>
                        <button className="rounded border px-3 py-2" onClick={() => applyAction(selectedDetail.incident.incidentId, "WARN_MEMBER")}>경고 플래그</button>
                        <button className="rounded border px-3 py-2" onClick={() => applyAction(selectedDetail.incident.incidentId, "CLEAR_QUEUE_BLOCK")}>차단 해제</button>
                    </div>

                    <div className="rounded-xl border bg-slate-50 p-3">
                        <h3 className="mb-2 font-semibold">Action Timeline</h3>
                        {!selectedDetail.actions?.length ? (
                            <div className="text-sm text-slate-600">기록된 조치가 없습니다.</div>
                        ) : (
                            <ul className="space-y-1 text-sm">
                                {selectedDetail.actions.map((action) => (
                                    <li key={action.actionLogId}>
                                        [{action.createdAt}] {action.actionType} - {action.actor} - {action.description}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900">
                    <Settings className="h-5 w-5" /> 탐지 규칙 관리
                </h2>

                <div className="mb-4 grid grid-cols-1 gap-2 rounded-xl border border-dashed p-3 sm:grid-cols-5 sm:items-center">
                    <input
                        className="rounded border px-2 py-1"
                        placeholder="new.metric.name"
                        value={newRule.metric}
                        onChange={(e) => setNewRule((prev) => ({ ...prev, metric: e.target.value }))}
                    />
                    <input
                        type="number"
                        className="rounded border px-2 py-1"
                        value={newRule.hardLimitPerMinute}
                        onChange={(e) => setNewRule((prev) => ({ ...prev, hardLimitPerMinute: e.target.value }))}
                    />
                    <input
                        type="number"
                        step="0.1"
                        className="rounded border px-2 py-1"
                        value={newRule.zScoreThreshold}
                        onChange={(e) => setNewRule((prev) => ({ ...prev, zScoreThreshold: e.target.value }))}
                    />
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={Boolean(newRule.enabled)}
                            onChange={(e) => setNewRule((prev) => ({ ...prev, enabled: e.target.checked }))}
                        />
                        enabled
                    </label>
                    <button className="inline-flex items-center justify-center gap-1 rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white" onClick={createRule}>
                        <PlusCircle className="h-4 w-4" /> 규칙 추가
                    </button>
                </div>
                {!rules.length ? (
                    <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">등록된 규칙이 없습니다.</div>
                ) : (
                    <div className="space-y-3">
                        {rules.map((rule) => {
                            const draft = ruleDrafts[rule.metric] || {
                                hardLimitPerMinute: rule.hardLimitPerMinute,
                                zScoreThreshold: rule.zScoreThreshold,
                                enabled: rule.enabled,
                            };
                            return (
                                <div key={rule.metric} className="grid grid-cols-1 gap-2 rounded-xl border p-3 sm:grid-cols-5 sm:items-center">
                                    <div className="font-semibold">{rule.metric}</div>
                                    <input
                                        type="number"
                                        className="rounded border px-2 py-1"
                                        value={draft.hardLimitPerMinute}
                                        onChange={(e) => setRuleDrafts((prev) => ({
                                            ...prev,
                                            [rule.metric]: { ...draft, hardLimitPerMinute: e.target.value },
                                        }))}
                                    />
                                    <input
                                        type="number"
                                        step="0.1"
                                        className="rounded border px-2 py-1"
                                        value={draft.zScoreThreshold}
                                        onChange={(e) => setRuleDrafts((prev) => ({
                                            ...prev,
                                            [rule.metric]: { ...draft, zScoreThreshold: e.target.value },
                                        }))}
                                    />
                                    <label className="flex items-center gap-2 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(draft.enabled)}
                                            onChange={(e) => setRuleDrafts((prev) => ({
                                                ...prev,
                                                [rule.metric]: { ...draft, enabled: e.target.checked },
                                            }))}
                                        />
                                        enabled
                                    </label>
                                    <button className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white" onClick={() => saveRule(rule.metric)}>
                                        저장
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
};




