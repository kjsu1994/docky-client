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
    ArrowRight,
    X,
} from "lucide-react";
import api from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import { hasRole, isAdminUser } from "../utils/authorization";
import toast from "react-hot-toast";
import { LoadingSpinner } from "../components/LoadingSpinner";

const unwrapData = (payload) => payload?.data?.data ?? payload?.data ?? payload ?? null;

// Normalize mixed backend response shapes (data/items/content) into a stable event list.
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

const getMemberIdValue = (member) => {
    const raw = member?.memberId ?? member?.member_id ?? member?.id ?? member?.memberNo ?? member?.member_no ?? member?.member?.memberId ?? member?.member?.member_id ?? null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
};
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

const parseJsonSafe = (value) => {
    if (!value) return null;
    if (typeof value === "object") return value;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
};

const parseReleaseRequestFromMessage = (message) => {
    const text = String(message || "");
    const sanctionMatch = text.match(/sanctionId\s*=\s*(\d+)/i);
    const memberMatch = text.match(/member\s*=\s*([^,]+)/i);
    const requestReasonMatch = text.match(/requestReason\s*=\s*(.+)$/i);
    const sanctionReasonMatch = text.match(/sanctionReason\s*=\s*([^,]+)/i);
    return {
        sanctionId: sanctionMatch ? Number(sanctionMatch[1]) : null,
        memberEmail: memberMatch ? memberMatch[1].trim() : "",
        requestReason: requestReasonMatch ? requestReasonMatch[1].trim() : "",
        sanctionReason: sanctionReasonMatch ? sanctionReasonMatch[1].trim() : "",
    };
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
    const [releaseRequests, setReleaseRequests] = useState({ items: [], page: 1, size: 20, totalElements: 0, totalPages: 0 });
    const [releaseRequestLoading, setReleaseRequestLoading] = useState(false);
    const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
    const [reportList, setReportList] = useState({ items: [], page: 1, size: 20, totalElements: 0, totalPages: 0 });
    const [reportStatusFilter, setReportStatusFilter] = useState("ALL");
    const [roleMembers, setRoleMembers] = useState({ items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 });
    const [roleAudits, setRoleAudits] = useState({ items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 });
    const [roleKeyword, setRoleKeyword] = useState("");
    const [sanctions, setSanctions] = useState({ items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 });
    const [sanctionStatusFilter, setSanctionStatusFilter] = useState("ACTIVE");
    const [sanctionKeyword, setSanctionKeyword] = useState("");
    const [sanctionMemberResults, setSanctionMemberResults] = useState([]);
    const [sanctionMemberLoading, setSanctionMemberLoading] = useState(false);
    const [sanctionSearchError, setSanctionSearchError] = useState("");
    const [selectedSanctionMember, setSelectedSanctionMember] = useState(null);
    const [sanctionReasonInput, setSanctionReasonInput] = useState("");
    const [sanctionDaysInput, setSanctionDaysInput] = useState("");
    const [creatingSanction, setCreatingSanction] = useState(false);
    const [releasingSanctionId, setReleasingSanctionId] = useState(null);
    const [releaseDialog, setReleaseDialog] = useState({ open: false, sanctionId: null, memberEmail: "", notificationId: null });
    const [releaseReasonInput, setReleaseReasonInput] = useState("");
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
    const activeSanctionMemberIds = useMemo(() => {
        const ids = new Set();
        (sanctions.items || []).forEach((item) => {
            const sanctionStatus = item?.sanctionStatus ?? item?.sanction_status;
            const memberId = Number(item?.memberId ?? item?.member_id);
            if (sanctionStatus === "ACTIVE" && Number.isFinite(memberId)) {
                ids.add(memberId);
            }
        });
        return ids;
    }, [sanctions]);
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

    const fetchReleaseRequests = async () => {
        setReleaseRequestLoading(true);
        try {
            const response = await api.get("/admin/sanctions/release-requests", {
                params: { page: 1, size: 50 },
            });
            const payload = unwrapData(response.data) || { items: [], page: 1, size: 50, totalElements: 0, totalPages: 0 };
            setReleaseRequests(payload);
        } finally {
            setReleaseRequestLoading(false);
        }
    };

    const fetchSanctionMembers = async (keyword = sanctionKeyword) => {
        const trimmedKeyword = String(keyword || "").trim();
        if (!trimmedKeyword) {
            setSanctionMemberResults([]);
            setSanctionSearchError("");
            return;
        }

        setSanctionMemberLoading(true);
        setSanctionSearchError("");
        try {
            const response = await api.get("/members/list", {
                params: { keyword: trimmedKeyword, page: 0, size: 20 },
            });
            const payload = unwrapData(response.data);
            const items = payload?.items || payload?.content || payload?.data || payload || [];
            setSanctionMemberResults(Array.isArray(items) ? items : []);
        } catch (err) {
            setSanctionMemberResults([]);
            setSanctionSearchError(err?.response?.data?.message || "Failed to search members.");
        } finally {
            setSanctionMemberLoading(false);
        }
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
            // Load all admin dashboard resources in parallel: summary, KPI, rules, incidents, and realtime events.
            const roleMembersPromise = isMaster
                ? api.get("/admin/roles/members", { params: { keyword: roleKeyword || undefined, page: 1, size: 10 } })
                : Promise.resolve({ data: { data: { items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 } } });
            const roleAuditsPromise = isMaster
                ? api.get("/admin/roles/audits", { params: { page: 1, size: 10 } })
                : Promise.resolve({ data: { data: { items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 } } });

            const [summaryRes, eventsRes, kpiRes, rulesRes, incidentsRes, notificationsRes, reportsRes, sanctionsRes, releaseRequestsRes, moderationBoardsRes, moderationCommentsRes, auditsRes, roleMembersRes, roleAuditsRes] = await Promise.all([
                api.get("/stats/summary"),
                api.get("/stats/anomalies", { params: { limit: 50 } }),
                api.get("/admin/anomalies/kpi", { params: { days: 7 } }),
                api.get("/admin/anomalies/rules"),
                api.get("/admin/anomalies/incidents", { params: { status: nextStatus, page: nextPage, size: 20 } }),
                api.get("/admin/notifications", { params: { readYn: false, page: 1, size: 8 } }),
                api.get("/admin/reports", { params: { status: reportStatusFilter, page: 1, size: 10 } }),
                api.get("/admin/sanctions", { params: { status: sanctionStatusFilter, page: 1, size: 10 } }),
                api.get("/admin/sanctions/release-requests", { params: { page: 1, size: 50 } }),
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
            const nextReleaseRequests = unwrapData(releaseRequestsRes.data) || { items: [], page: 1, size: 50, totalElements: 0, totalPages: 0 };
            const nextModerationBoards = unwrapData(moderationBoardsRes.data) || { items: [], page: 1, size: 8, totalElements: 0, totalPages: 0 };
            const nextModerationComments = unwrapData(moderationCommentsRes.data) || { items: [], page: 1, size: 8, totalElements: 0, totalPages: 0 };
            const nextAudits = unwrapData(auditsRes.data) || { items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 };
            const nextRoleMembers = unwrapData(roleMembersRes.data) || { items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 };
            const nextRoleAudits = unwrapData(roleAuditsRes.data) || { items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 };
            setNotifications(nextNotifications.items || []);
            setNotificationUnreadCount(nextNotifications.unreadCount || 0);
            setReportList(nextReports);
            setSanctions(nextSanctions);
            setReleaseRequests(nextReleaseRequests);
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
            setError(err?.response?.data?.message || "Failed to load admin dashboard.");
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
                incident_status: draft.incidentStatus,
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
        const description = window.prompt("Enter action description.", "");
        if (description === null) return;

        const payload = { action_type: actionType, description };
        if (actionType === "BLOCK_QUEUE_USER") {
            const blockMinutesInput = window.prompt("Block minutes (1-1440)", "30");
            if (blockMinutesInput === null) return;
            payload.block_minutes = Math.max(1, Math.min(1440, Number(blockMinutesInput) || 30));
        }

        await api.post(`/admin/anomalies/incidents/${incidentId}/actions`, payload);
        await fetchIncidents(statusFilter, page);
        await fetchDetail(incidentId);
        await fetchDashboard(statusFilter, page);
    };

    const markNotificationRead = async (notificationId) => {
        await api.patch(`/admin/notifications/${notificationId}/read`, { read_yn: true });
        await fetchNotifications();
        await fetchReleaseRequests();
    };

    const markAllNotificationsRead = async () => {
        await api.post("/admin/notifications/read-all");
        await fetchNotifications();
    };

    const updateReportStatus = async (reportId, reportStatus) => {
        const adminNote = window.prompt("Enter admin note.", "") || "";
        await api.patch(`/admin/reports/${reportId}`, { report_status: reportStatus, admin_note: adminNote });
        await fetchReports(reportStatusFilter);
        await fetchNotifications();
    };
    const createSanction = async () => {
        if (creatingSanction) return;

        const selectedMemberId = getMemberIdValue(selectedSanctionMember);
        if (!selectedMemberId) {
            toast.error("Please select a member to sanction.");
            return;
        }
        if (activeSanctionMemberIds.has(selectedMemberId)) {
            toast.error("This member already has an active sanction.");
            return;
        }
        const reason = sanctionReasonInput.trim();
        if (!reason) {
            toast.error("Please enter a sanction reason.");
            return;
        }

        const days = sanctionDaysInput ? Number(sanctionDaysInput) : undefined;
        const toastId = toast.loading("Creating sanction...");
        setCreatingSanction(true);
        try {
            await api.post("/admin/sanctions", {
                member_id: selectedMemberId,
                reason,
                days: Number.isFinite(days) && days > 0 ? days : undefined,
            });
            toast.success("Sanction created.", { id: toastId });
            setSanctionReasonInput("");
            setSanctionDaysInput("");
            setSanctionKeyword("");
            setSanctionMemberResults([]);
            setSelectedSanctionMember(null);
            await fetchSanctions(sanctionStatusFilter);
            await fetchNotifications();
            await fetchAudits(auditTypeFilter);
        } catch (err) {
            toast.error(err?.response?.data?.message || "Failed to create sanction.", { id: toastId });
        } finally {
            setCreatingSanction(false);
        }
    };

    const releaseSanction = async (sanctionId, options = {}) => {
        if (releasingSanctionId === sanctionId) return;

        const providedReason = typeof options.reason === "string" ? options.reason : "";
        const reason = providedReason.trim();
        if (!reason) {
            toast.error("Please enter a release reason.");
            return false;
        }

        const toastId = toast.loading("Releasing sanction...");
        setReleasingSanctionId(sanctionId);
        try {
            await api.patch(`/admin/sanctions/${sanctionId}/release`, { reason });
            const notificationId = Number(options.notificationId);
            if (Number.isFinite(notificationId) && notificationId > 0) {
                await api.patch(`/admin/notifications/${notificationId}/read`, { read_yn: true });
            }
            toast.success("Sanction released.", { id: toastId });
            await fetchSanctions(sanctionStatusFilter);
            await fetchNotifications();
            await fetchReleaseRequests();
            await fetchAudits(auditTypeFilter);
            return true;
        } catch (err) {
            toast.error(err?.response?.data?.message || "Failed to release sanction.", { id: toastId });
            return false;
        } finally {
            setReleasingSanctionId(null);
        }
    };

    const openReleaseDialog = ({ sanctionId, memberEmail = "", notificationId = null }) => {
        setReleaseReasonInput("");
        setReleaseDialog({ open: true, sanctionId, memberEmail, notificationId });
    };

    const closeReleaseDialog = () => {
        setReleaseDialog({ open: false, sanctionId: null, memberEmail: "", notificationId: null });
        setReleaseReasonInput("");
    };

    const confirmReleaseDialog = async () => {
        if (!Number.isFinite(Number(releaseDialog.sanctionId)) || Number(releaseDialog.sanctionId) <= 0) {
            toast.error("Invalid sanction ID.");
            return;
        }
        const released = await releaseSanction(Number(releaseDialog.sanctionId), {
            reason: releaseReasonInput,
            notificationId: releaseDialog.notificationId,
        });
        if (released) {
            closeReleaseDialog();
        }
    };

    const updateBoardHidden = async (boardId, hiddenYn) => {
        const normalizedBoardId = Number(boardId);
        if (!Number.isFinite(normalizedBoardId) || normalizedBoardId <= 0) {
            toast.error("Invalid board ID.");
            return;
        }
        const normalizedHiddenYn = toHiddenYnLiteral(hiddenYn);
        if (!normalizedHiddenYn) {
            toast.error("Invalid hiddenYn value.");
            return;
        }

        const reason = window.prompt(normalizedHiddenYn === "Y" ? "Enter hide reason." : "Enter restore reason.", "") || "";
        try {
            await api.patch(`/admin/moderation/boards/${normalizedBoardId}`, { hidden_yn: normalizedHiddenYn, reason });
            toast.success(normalizedHiddenYn === "Y" ? "Board hidden." : "Board restored.");
            await fetchModerationBoards(moderationHiddenFilter);
            await fetchAudits(auditTypeFilter);
        } catch (err) {
            toast.error(err?.response?.data?.message || "Failed to update board visibility.");
        }
    };

    const updateCommentHidden = async (commentId, hiddenYn) => {
        const normalizedCommentId = Number(commentId);
        if (!Number.isFinite(normalizedCommentId) || normalizedCommentId <= 0) {
            toast.error("Invalid comment ID.");
            return;
        }
        const normalizedHiddenYn = toHiddenYnLiteral(hiddenYn);
        if (!normalizedHiddenYn) {
            toast.error("Invalid hiddenYn value.");
            return;
        }

        const reason = window.prompt(normalizedHiddenYn === "Y" ? "Enter hide reason." : "Enter restore reason.", "") || "";
        try {
            await api.patch(`/admin/moderation/comments/${normalizedCommentId}`, { hidden_yn: normalizedHiddenYn, reason });
            toast.success(normalizedHiddenYn === "Y" ? "Comment hidden." : "Comment restored.");
            await fetchModerationComments(moderationHiddenFilter);
            await fetchAudits(auditTypeFilter);
        } catch (err) {
            toast.error(err?.response?.data?.message || "Failed to update comment visibility.");
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
            toast.error("Member ID is missing.");
            return;
        }
        const currentRoles = Array.isArray(member.roles) ? member.roles : [];
        const hasAdmin = hasAdminRole(currentRoles);
        // Keep ROLE_USER and toggle ROLE_ADMIN only.
        const nextRoles = hasAdmin
            ? currentRoles.filter((role) => role !== "ROLE_ADMIN")
            : Array.from(new Set([...currentRoles, "ROLE_ADMIN"]));

        const reason = window.prompt(
            hasAdmin ? "Enter reason for removing admin role." : "Enter reason for granting admin role.",
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
            toast.success(hasAdmin ? "Admin role removed." : "Admin role granted.");
        } catch (err) {
            const message = err?.response?.data?.message || "Failed to change admin role.";
            toast.error(message);
            console.error("Failed to update member admin role:", err);
        }
    };

    const searchRoleMembers = async () => {
        try {
            await fetchRoleMembers(roleKeyword);
        } catch (err) {
            toast.error(err?.response?.data?.message || "Failed to search members.");
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
            hard_limit_per_minute: Number(draft.hardLimitPerMinute) || 1,
            z_score_threshold: Number(draft.zScoreThreshold) || 1,
            enabled: Boolean(draft.enabled),
        });

        await refreshRules();
    };

    const createRule = async () => {
        if (!newRule.metric.trim()) {
            window.alert("metric is required.");
            return;
        }

        await api.put("/admin/anomalies/rules", {
            metric: newRule.metric.trim(),
            hard_limit_per_minute: Number(newRule.hardLimitPerMinute) || 1,
            z_score_threshold: Number(newRule.zScoreThreshold) || 1,
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
                <h1 className="text-xl font-black">Admin Only</h1>
                <p className="text-sm font-medium opacity-70">This dashboard requires ROLE_ADMIN permission.</p>
            </div>
        );
    }

    if (loading) return <LoadingSpinner text="Loading admin dashboard..." />;

    if (error) {
        return (
            <div className="rounded-[2rem] border border-rose-100 bg-rose-50/50 p-10 text-rose-800 text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                    <AlertTriangle className="h-8 w-8 text-rose-500" />
                </div>
                <h1 className="text-xl font-black">Load Error</h1>
                <p className="text-sm font-medium opacity-70 mb-4">{error}</p>
                <button
                    onClick={() => fetchDashboard(statusFilter, page)}
                    className="btn-primary"
                >
                    <RefreshCw className="mr-2 h-4 w-4" /> Retry
                </button>
            </div>
        );
    }

    return (
        <section className="space-y-8 animate-fade-in pb-10">
            <div className="flex flex-wrap items-center justify-between gap-6 px-2">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black tracking-tight text-slate-900">Admin Dashboard</h1>
                    <p className="text-sm font-medium text-slate-400">Monitor operations and security status in one place.</p>
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
                        <Download className="mr-2 h-4 w-4" /> Download Report
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <StatCard icon={Users} label="Total Members" value={toNumber(summary?.total_members ?? summary?.totalMembers)} tone="blue" />
                <StatCard icon={MessageSquare} label="Total Posts" value={toNumber(summary?.total_boards ?? summary?.totalBoards)} tone="emerald" />
                <StatCard icon={Eye} label="Today Visitors" value={toNumber(summary?.today_visitors ?? summary?.todayVisitors)} tone="amber" />
                <StatCard icon={Activity} label="Anomaly Events" value={events.length} tone="slate" />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="card p-8">
                    <h2 className="mb-6 flex items-center gap-2 text-lg font-black text-slate-900 tracking-tight">
                        <div className="p-2 rounded-xl bg-primary-50 text-primary-600">
                            <ClipboardList className="h-5 w-5" />
                        </div>
                        Anomaly KPI (7d)
                    </h2>
                    <div className="space-y-4 text-sm">
                        {[
                            { label: "Total Incidents", val: toNumber(kpi?.totalIncidents) },
                            { label: "New", val: toNumber(kpi?.newCount), color: "text-primary-600" },
                            { label: "Reviewing", val: toNumber(kpi?.reviewingCount), color: "text-amber-600" },
                            { label: "Resolved", val: toNumber(kpi?.resolvedCount), color: "text-emerald-600" },
                            { label: "False Positive", val: toNumber(kpi?.falsePositiveCount), color: "text-slate-400" },
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
                        Realtime Anomaly Events
                    </h2>
                    {!events.length ? (
                        <div className="flex flex-col items-center justify-center h-48 rounded-[2rem] bg-slate-50/50 text-slate-400 font-bold">
                        </div>
                    ) : (
                        <div className="max-h-72 overflow-auto rounded-2xl border border-slate-50">
                            <table className="min-w-full text-sm">
                                <thead className="bg-slate-50/50 text-slate-400 font-black uppercase text-[10px] tracking-widest">
                                    <tr>
                                        <th className="px-4 py-4 text-left">Detected At</th>
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
                            User Sanctions
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
                            <button
                                className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-3 py-2 text-xs font-black text-white shadow-lg shadow-primary-100 disabled:opacity-60"
                                onClick={createSanction}
                                disabled={creatingSanction || (selectedSanctionMember && activeSanctionMemberIds.has(getMemberIdValue(selectedSanctionMember)))}
                            >
                                {creatingSanction ? <RefreshCw className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />} {creatingSanction ? "Creating..." : "Create"}
                            </button>
                        </div>
                    </div>
                    <div className="mb-6 space-y-3">
                        <div className="flex gap-2">
                            <input
                                value={sanctionKeyword}
                                onChange={(e) => setSanctionKeyword(e.target.value)}
                                placeholder="Search member (name/email)"
                                className="input-base w-full"
                            />
                            <button
                                className="btn-secondary py-2 px-4 whitespace-nowrap"
                                onClick={() => fetchSanctionMembers(sanctionKeyword)}
                                disabled={sanctionMemberLoading}
                            >
                                {sanctionMemberLoading ? "Searching..." : "Search"}
                            </button>
                        </div>
                        {sanctionSearchError ? (
                            <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{sanctionSearchError}</div>
                        ) : null}
                        {sanctionMemberResults.length ? (
                            <div className="max-h-40 overflow-auto rounded-2xl border border-slate-100 bg-slate-50/40 p-2 space-y-2">
                                {sanctionMemberResults.map((member, idx) => {
                                    const memberId = getMemberIdValue(member);
                                    const isSelected = selectedSanctionMember && getMemberIdValue(selectedSanctionMember) === memberId;
                                    return (
                                        <button
                                            key={memberId || `sanction-member-${idx}`}
                                            type="button"
                                            onClick={() => setSelectedSanctionMember(member)}
                                            className={`w-full rounded-xl px-3 py-2 text-left text-xs font-bold transition-all ${isSelected ? "bg-primary-100 text-primary-700" : "bg-white text-slate-600 hover:bg-primary-50"}`}
                                        >
                                            <div>{member?.name || "(No name)"} ({member?.email || "-"})</div>
                                            <div className="text-[10px] opacity-70">#{memberId || "-"}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : sanctionKeyword.trim() ? (
                            <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-400">No search results.</div>
                        ) : null}
                        <input
                            value={sanctionReasonInput}
                            onChange={(e) => setSanctionReasonInput(e.target.value)}
                            placeholder="Sanction reason"
                            className="input-base w-full"
                        />
                        <input
                            value={sanctionDaysInput}
                            onChange={(e) => setSanctionDaysInput(e.target.value)}
                            placeholder="Sanction days (empty = permanent)"
                            className="input-base w-full"
                        />
                        <div className="text-[11px] font-bold text-slate-500">
                            Selected member: {selectedSanctionMember ? `${selectedSanctionMember?.name || selectedSanctionMember?.email || "user"} (#${getMemberIdValue(selectedSanctionMember) || "-"})` : "None"}
                        </div>
                        {selectedSanctionMember && activeSanctionMemberIds.has(getMemberIdValue(selectedSanctionMember)) ? (
                            <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                                This member is already sanctioned. Duplicate sanctions are blocked.
                            </div>
                        ) : null}
                    </div>
                    <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                        <div className="mb-3 text-xs font-black uppercase tracking-widest text-amber-700">
                            Pending Release Requests ({releaseRequests.items?.length || 0})
                        </div>
                        {releaseRequestLoading ? (
                            <div className="rounded-xl bg-white px-3 py-4 text-xs font-bold text-slate-400">Loading release requests...</div>
                        ) : !releaseRequests.items?.length ? (
                            <div className="rounded-xl bg-white px-3 py-4 text-xs font-bold text-slate-400">No pending release requests.</div>
                        ) : (
                            <div className="space-y-2 max-h-44 overflow-auto pr-1">
                                {releaseRequests.items.map((item) => {
                                    const payload = parseJsonSafe(item?.payloadJson ?? item?.payload_json);
                                    const parsedFromMessage = parseReleaseRequestFromMessage(item?.rawMessage ?? item?.raw_message ?? item?.message);
                                    const sanctionId = Number(
                                        item?.sanctionId
                                        ?? item?.sanction_id
                                        ?? payload?.sanctionId
                                        ?? payload?.sanction_id
                                        ?? parsedFromMessage.sanctionId
                                    );
                                    const memberEmail = (
                                        item?.memberEmail
                                        ?? item?.member_email
                                        ?? payload?.memberEmail
                                        ?? payload?.member_email
                                        ?? parsedFromMessage.memberEmail
                                        ?? "-"
                                    );
                                    const sanctionReason = (
                                        item?.sanctionReason
                                        ?? item?.sanction_reason
                                        ?? payload?.sanctionReason
                                        ?? payload?.sanction_reason
                                        ?? parsedFromMessage.sanctionReason
                                        ?? ""
                                    );
                                    const requestReason = (
                                        item?.requestReason
                                        ?? item?.request_reason
                                        ?? payload?.requestReason
                                        ?? payload?.request_reason
                                        ?? parsedFromMessage.requestReason
                                        ?? ""
                                    );
                                    const notificationId = Number(item?.notificationId ?? item?.notification_id);
                                    return (
                                        <div key={`release-request-${notificationId || Math.random()}`} className="rounded-xl bg-white p-3 text-xs">
                                            <div className="font-bold text-slate-700">{memberEmail}</div>
                                            <div className="mt-1 text-[11px] font-semibold text-slate-500">Sanction #{Number.isFinite(sanctionId) ? sanctionId : "-"}</div>
                                            <div className="mt-1 text-[11px] text-slate-500">Sanction reason: {sanctionReason || "-"}</div>
                                            <div className="mt-1 text-[11px] text-slate-600">Request message: {requestReason || "(empty)"}</div>
                                            <div className="mt-1 text-[10px] font-semibold text-slate-400">{item?.createdAt ?? item?.created_at}</div>
                                            <div className="mt-2 flex gap-2">
                                                <button
                                                    type="button"
                                                    className="rounded-lg bg-primary-600 px-3 py-1.5 font-black text-white disabled:opacity-60"
                                                    disabled={!Number.isFinite(sanctionId) || sanctionId <= 0}
                                                    onClick={() => {
                                                        if (!Number.isFinite(sanctionId) || sanctionId <= 0) {
                                                            toast.error("Invalid sanction request payload.");
                                                            return;
                                                        }
                                                        openReleaseDialog({
                                                            sanctionId,
                                                            memberEmail,
                                                            notificationId,
                                                        });
                                                    }}
                                                >
                                                    Release Now
                                                </button>
                                                <button
                                                    type="button"
                                                    className="rounded-lg bg-slate-100 px-3 py-1.5 font-black text-slate-600"
                                                    disabled={!Number.isFinite(notificationId) || notificationId <= 0}
                                                    onClick={() => {
                                                        if (!Number.isFinite(notificationId) || notificationId <= 0) {
                                                            toast.error("Invalid notification ID.");
                                                            return;
                                                        }
                                                        markNotificationRead(notificationId);
                                                    }}
                                                >
                                                    Mark Read
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    {!sanctions.items?.length ? (
                        <div className="flex flex-col items-center justify-center h-48 rounded-[2rem] bg-slate-50/50 text-slate-400 font-bold text-sm">No sanctions found.</div>
                    ) : (
                        <div className="space-y-4 max-h-[400px] overflow-auto pr-2">
                            {sanctions.items.map((sanction, idx) => {
                                const sanctionId = Number(sanction?.sanctionId ?? sanction?.sanction_id);
                                const sanctionStatus = sanction?.sanctionStatus ?? sanction?.sanction_status;
                                const memberEmail = sanction?.memberEmail ?? sanction?.member_email ?? "-";
                                const reason = sanction?.reason ?? "-";
                                const createdAt = sanction?.createdAt ?? sanction?.created_at;
                                return (
                                <div key={Number.isFinite(sanctionId) ? sanctionId : `sanction-${idx}`} className="p-5 rounded-2xl bg-slate-50/50 border border-slate-100 hover:border-rose-100 transition-colors">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="font-black text-slate-900 text-sm">#{Number.isFinite(sanctionId) ? sanctionId : "-"}</div>
                                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${sanctionStatus === 'ACTIVE' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-600'}`}>
                                            {sanctionStatus || "-"}
                                        </span>
                                    </div>
                                    <div className="text-[13px] font-bold text-slate-600 mb-1">{memberEmail}</div>
                                    <div className="text-[12px] font-medium text-slate-400 mb-4">{reason}</div>
                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-300">
                                        <span>{createdAt}</span>
                                        {sanctionStatus === "ACTIVE" && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-60"
                                                    onClick={() => openReleaseDialog({ sanctionId, memberEmail })}
                                                    disabled={releasingSanctionId === sanctionId || !Number.isFinite(sanctionId)}
                                                    title="Release sanction"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    className="text-primary-600 hover:underline disabled:opacity-60"
                                                    onClick={() => openReleaseDialog({ sanctionId, memberEmail })}
                                                    disabled={releasingSanctionId === sanctionId || !Number.isFinite(sanctionId)}
                                                >
                                                    {releasingSanctionId === sanctionId ? "Releasing..." : "Release"}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )})}
                        </div>
                    )}
                </div>

                <div className="card p-8 xl:col-span-2">
                    <div className="mb-8 flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-lg font-black text-slate-900 tracking-tight">
                            <div className="p-2 rounded-xl bg-primary-50 text-primary-600">
                                <EyeOff className="h-5 w-5" />
                            </div>
                            Content Moderation
                        </h2>
                        <select
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
                            <h3 className="px-2 text-xs font-black text-slate-400 uppercase tracking-widest">Boards</h3>
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
                                                {getHiddenYnValue(board) ? "Restore" : "Hide"}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h3 className="px-2 text-xs font-black text-slate-400 uppercase tracking-widest">Comments</h3>
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
                                                {getHiddenYnValue(comment) ? "Restore" : "Hide"}
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
                        Unified Audit Log
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
                    <div className="flex flex-col items-center justify-center h-48 rounded-[2rem] bg-slate-50/50 text-slate-400 font-bold text-sm">No audit history.</div>
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

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="card p-8">
                    <div className="mb-8 flex items-center justify-between">
                        <h2 className="text-lg font-black text-slate-900 tracking-tight">Admin Notifications</h2>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-[10px] font-black text-rose-600 uppercase">
                                <BellRing className="h-3 w-3" /> {toNumber(notificationUnreadCount)} UNREAD
                            </div>
                            <button className="text-[11px] font-bold text-slate-400 hover:text-primary-600" onClick={markAllNotificationsRead}>Mark all read</button>
                        </div>
                    </div>

                    {!notifications.length ? (
                        <div className="flex flex-col items-center justify-center h-64 rounded-[2rem] bg-slate-50/50 text-slate-400 font-bold text-sm">No unread notifications.</div>
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
                                            Mark as read
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="card p-8">
                    <div className="mb-8 flex items-center justify-between">
                        <h2 className="text-lg font-black text-slate-900 tracking-tight">User Reports</h2>
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
                        <div className="flex flex-col items-center justify-center h-64 rounded-[2rem] bg-slate-50/50 text-slate-400 font-bold text-sm">No reports found.</div>
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
                                        <button className="flex-1 rounded-2xl bg-slate-50 py-2.5 text-[11px] font-black text-slate-600 hover:bg-primary-50 hover:text-primary-600 transition-all" onClick={() => updateReportStatus(report.reportId, "IN_REVIEW")}>IN REVIEW</button>
                                        <button className="flex-1 rounded-2xl bg-emerald-50 py-2.5 text-[11px] font-black text-emerald-600 hover:bg-emerald-100 transition-all" onClick={() => updateReportStatus(report.reportId, "RESOLVED")}>RESOLVED</button>
                                        <button className="flex-1 rounded-2xl bg-rose-50 py-2.5 text-[11px] font-black text-rose-600 hover:bg-rose-100 transition-all" onClick={() => updateReportStatus(report.reportId, "REJECTED")}>REJECT</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="card p-8">
                    <div className="mb-8 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-black text-slate-900 tracking-tight">Role Management</h2>
                            <span className={`rounded-xl px-3 py-1 text-[10px] font-black tracking-widest uppercase ${isMaster ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                {isMaster ? "MASTER ACCESS" : "ADMIN ACCESS"}
                            </span>
                        </div>
                        <button className="text-slate-300 hover:text-primary-600 transition-colors" onClick={() => fetchRoleMembers(roleKeyword)}><RefreshCw className="h-4 w-4" /></button>
                    </div>
                    {!isMaster && (
                        <div className="mb-6 rounded-2xl bg-amber-50 p-4 text-[11px] font-bold text-amber-700 leading-relaxed">
                            Only ROLE_MASTER can grant or revoke admin roles.
                        </div>
                    )}
                    <div className="mb-8 flex gap-3">
                        <div className="relative flex-1">
                            <input
                                value={roleKeyword}
                                onChange={(e) => setRoleKeyword(e.target.value)}
                                placeholder="Search by name or email"
                                className="input-base w-full pl-4 pr-10"
                            />
                        </div>
                        <button className="btn-primary py-2.5 px-6 whitespace-nowrap" onClick={searchRoleMembers}>Search</button>
                    </div>

                    {!roleMembers.items?.length ? (
                        <div className="flex flex-col items-center justify-center h-64 rounded-[2rem] bg-slate-50/50 text-slate-400 font-bold text-sm">No members found.</div>
                    ) : (
                        <div className="space-y-4 max-h-[600px] overflow-auto pr-2">
                            {roleMembers.items.map((member) => (
                                <div key={getMemberIdValue(member) || member.email} className="group p-6 rounded-3xl border border-slate-100 bg-white hover:shadow-xl transition-all duration-300">
                                    <div className="mb-4 flex items-center justify-between">
                                        <div className="space-y-1">
                                            <div className="text-base font-black text-slate-900">{member.name || "(No name)"}</div>
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
                                        {hasAdminRole(member.roles) ? "Remove Admin" : "Grant Admin"}
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
                            Role Change History
                        </h2>
                        <button className="text-slate-300 hover:text-primary-600" onClick={fetchRoleAudits}><RefreshCw className="h-4 w-4" /></button>
                    </div>
                    {!roleAudits.items?.length ? (
                        <div className="flex flex-col items-center justify-center h-64 rounded-[2rem] bg-slate-50/50 text-slate-400 font-bold text-sm">No role change history.</div>
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
                                        <ArrowRight className="h-3 w-3 text-primary-400" />
                                        <span className="text-primary-600">{audit.afterRoles}</span>
                                    </div>
                                    <div className="text-[12px] font-bold text-slate-500 italic"><span className="text-slate-300 font-medium">REASON:</span> {audit.changeReason || "(none)"}</div>
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
                        <p className="text-sm font-medium text-slate-400">Review incidents quickly, assign owners, and execute mitigation actions.</p>
                    </div>
                    <div className="flex items-center gap-4 rounded-3xl bg-slate-50 p-2">
                        <span className="ml-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Status Filter</span>
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
                    <div className="flex flex-col items-center justify-center h-64 rounded-[2rem] bg-slate-50/50 text-slate-400 font-bold text-sm">No incidents found.</div>
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
                                                    placeholder="Assignee"
                                                    onChange={(e) => setIncidentDrafts((prev) => ({
                                                        ...prev,
                                                        [item.incidentId]: { ...draft, assignee: e.target.value },
                                                    }))}
                                                />
                                                <textarea
                                                    className="input-base py-2 px-4 w-full rounded-xl border-0 bg-white shadow-sm text-[12px] font-medium"
                                                    rows={1}
                                                    value={draft.note}
                                                    placeholder="Admin note"
                                                    onChange={(e) => setIncidentDrafts((prev) => ({
                                                        ...prev,
                                                        [item.incidentId]: { ...draft, note: e.target.value },
                                                    }))}
                                                />
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-wrap justify-end gap-2">
                                                    <div className="flex gap-1.5 bg-white p-1 rounded-2xl shadow-sm">
                                                        <button className="p-2 rounded-xl hover:bg-primary-50 text-slate-300 hover:text-primary-600 transition-all" onClick={() => fetchDetail(item.incidentId)} title="View Detail"><Activity className="h-4 w-4" /></button>
                                                        <button className="p-2 rounded-xl hover:bg-rose-50 text-slate-300 hover:text-rose-600 transition-all" onClick={() => applyAction(item.incidentId, "BLOCK_QUEUE_USER")} title="Queue Block"><UserX className="h-4 w-4" /></button>
                                                        <button className="p-2 rounded-xl hover:bg-amber-50 text-slate-300 hover:text-amber-600 transition-all" onClick={() => applyAction(item.incidentId, "WARN_MEMBER")} title="Warn User"><BellRing className="h-4 w-4" /></button>
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
                            <p className="text-sm font-medium text-slate-400">Inspect incident details, action timeline, and decision context.</p>
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
                    <div className="flex flex-col items-center justify-center h-48 rounded-[2rem] bg-slate-50/50 text-slate-400 font-bold text-sm">No detection rules found.</div>
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

            {releaseDialog.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
                        <div className="mb-4 flex items-start justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-black text-slate-900">Release Sanction</h3>
                                <p className="mt-1 text-sm text-slate-500">
                                    Target: {releaseDialog.memberEmail || `#${releaseDialog.sanctionId}`}
                                </p>
                            </div>
                            <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                                onClick={closeReleaseDialog}
                                disabled={releasingSanctionId === releaseDialog.sanctionId}
                                title="Close"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <textarea
                            className="input-base min-h-[110px] w-full"
                            value={releaseReasonInput}
                            onChange={(e) => setReleaseReasonInput(e.target.value)}
                            placeholder="Enter release reason"
                            maxLength={500}
                        />
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={closeReleaseDialog}
                                disabled={releasingSanctionId === releaseDialog.sanctionId}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={confirmReleaseDialog}
                                disabled={releasingSanctionId === releaseDialog.sanctionId}
                            >
                                {releasingSanctionId === releaseDialog.sanctionId ? "Releasing..." : "Release Now"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};







