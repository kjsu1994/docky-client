import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import {
    ADMIN_ANOMALY_TEXT_LIMITS,
    MEMBER_SEARCH_KEYWORD_MAX_LENGTH,
    adminAnomaliesAdapter,
    adminAnomaliesErrorMessage,
} from "../../adapters/adminAnomaliesAdapter.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { hasRole, isAdminUser } from "../../utils/authorization.js";
import { logClientError } from "../../utils/clientDiagnostics.js";
import { notify, notifyError, notifyLoading, notifySuccess } from "../../utils/toast.js";
import { LoadingSpinner } from "../../components/LoadingSpinner.jsx";
import { promptAction } from "../../common/promptAction.jsx";
import { trapFocus } from "../../utils/focusTrap.js";

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
const toHiddenYnBoolean = (value) => {
    if (value === "Y" || value === true) return true;
    if (value === "N" || value === false) return false;
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
const INCIDENT_STATUS_LABELS = {
    ALL: "전체",
    NEW: "신규",
    REVIEWING: "검토 중",
    RESOLVED: "해결",
    FALSE_POSITIVE: "오탐",
};
const REPORT_STATUS_LABELS = {
    ALL: "전체",
    OPEN: "접수",
    IN_REVIEW: "검토 중",
    RESOLVED: "해결",
    REJECTED: "반려",
};
const SANCTION_STATUS_LABELS = {
    ALL: "전체",
    ACTIVE: "진행 중",
    RELEASED: "해제됨",
};
const AUDIT_TYPE_LABELS = {
    ALL: "전체",
    ROLE: "권한",
    REPORT: "신고",
    MODERATION: "검토",
    SANCTION: "제재",
    ANOMALY: "이상징후",
    BANNER: "배너",
};
const TARGET_TYPE_LABELS = {
    BOARD: "게시글",
    COMMENT: "댓글",
};
const ROLE_ACCESS_LABELS = {
    MASTER: "마스터 권한",
    ADMIN: "관리자 권한",
};
const ROLE_LABELS = {
    ROLE_MASTER: "마스터",
    ROLE_ADMIN: "관리자",
    ROLE_USER: "회원",
};
const MEMBER_STATUS_LABELS = {
    ACTIVE: "활성",
    DORMANT: "휴면",
    WITHDRAWN: "탈퇴",
    BANNED: "차단",
};
const labelOf = (labels, value, fallback = "-") => labels?.[value] || value || fallback;
const roleLabelOf = (role) => ROLE_LABELS[role] || "알 수 없는 권한";
const roleListLabelOf = (roles) => {
    if (Array.isArray(roles)) {
        const labels = roles.map((role) => roleLabelOf(String(role || "").trim())).filter(Boolean);
        return labels.length ? labels.join(", ") : "-";
    }
    const value = String(roles || "").trim();
    if (!value) return "-";
    if (!value.includes("ROLE_") && !value.includes(",")) return value;
    return value
        .split(/[,\s]+/)
        .filter(Boolean)
        .map((role) => roleLabelOf(role.trim()))
        .join(", ");
};
const normalizeNotificationLink = (notification) => {
    const value = String(notification?.linkUrl ?? notification?.link_url ?? "").trim();
    if (!value || value.length > 300) return "";
    if (value !== "/app" && !value.startsWith("/app/")) return "";
    if (
        value.startsWith("//") ||
        /[\\\r\n"'<>]/.test(value)
    ) {
        return "";
    }
    return value;
};
const toIncidentActionKey = (incidentId, actionType) => `${Number(incidentId) || 0}:${actionType || ""}`;
const compactKeyPart = (value) => String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
const fallbackKey = (prefix, ...parts) => `${prefix}-${parts.map(compactKeyPart).join("-")}`;

const StatCard = ({ icon: Icon, label, value, tone = "slate", hint = "", title = "" }) => {
    const toneClass = {
        slate: "text-slate-600 bg-slate-50/50 border-slate-100",
        blue: "text-primary-600 bg-primary-50/50 border-primary-100",
        emerald: "text-emerald-600 bg-emerald-50/50 border-emerald-100",
        amber: "text-amber-600 bg-amber-50/50 border-amber-100",
        rose: "text-rose-600 bg-rose-50/50 border-rose-100",
    };

    return (
        <div className={`card p-6 flex flex-col items-center justify-center text-center ${toneClass[tone] || toneClass.slate}`} title={title || undefined}>
            <div className="mb-3 p-3 rounded-2xl bg-white shadow-sm">
                <Icon className="h-6 w-6" />
            </div>
            <div className="text-[11px] font-black uppercase tracking-widest opacity-70 mb-1">
                {label}
            </div>
            <div className="text-3xl font-black tracking-tight text-slate-900">{value.toLocaleString()}</div>
            {hint ? (
                <div className="mt-2 text-[11px] font-black uppercase tracking-widest opacity-70">
                    {hint}
                </div>
            ) : null}
        </div>
    );
};

export const AdminAnomalies = () => {
    const navigate = useNavigate();
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
    const [applyingIncidentActionKey, setApplyingIncidentActionKey] = useState("");

    const [summary, setSummary] = useState(null);
    const [events, setEvents] = useState([]);
    const [kpi, setKpi] = useState(null);
    const [rules, setRules] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [releaseRequests, setReleaseRequests] = useState({ items: [], page: 1, size: 20, totalElements: 0, totalPages: 0 });
    const [releaseRequestLoading, setReleaseRequestLoading] = useState(false);
    const [releaseRequestError, setReleaseRequestError] = useState("");
    const [reportDownloading, setReportDownloading] = useState(false);
    const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
    const [realtimeOperations, setRealtimeOperations] = useState(null);
    const [realtimeOperationsError, setRealtimeOperationsError] = useState("");
    const [markingNotificationIds, setMarkingNotificationIds] = useState(() => new Set());
    const [markingAllNotifications, setMarkingAllNotifications] = useState(false);
    const [reportList, setReportList] = useState({ items: [], page: 1, size: 20, totalElements: 0, totalPages: 0 });
    const [reportStatusFilter, setReportStatusFilter] = useState("ALL");
    const [reportLoading, setReportLoading] = useState(false);
    const [reportError, setReportError] = useState("");
    const [updatingReportKey, setUpdatingReportKey] = useState("");
    const [roleMembers, setRoleMembers] = useState({ items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 });
    const [roleMemberLoading, setRoleMemberLoading] = useState(false);
    const [roleMemberError, setRoleMemberError] = useState("");
    const [roleAudits, setRoleAudits] = useState({ items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 });
    const [roleKeyword, setRoleKeyword] = useState("");
    const [sanctions, setSanctions] = useState({ items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 });
    const [sanctionStatusFilter, setSanctionStatusFilter] = useState("ACTIVE");
    const [sanctionLoading, setSanctionLoading] = useState(false);
    const [sanctionError, setSanctionError] = useState("");
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
    const releaseDialogRef = useRef(null);
    const releaseDialogCloseRef = useRef(null);
    const releaseDialogTitleId = useId();
    const releaseDialogDescriptionId = useId();
    const releaseReasonInputId = useId();
    const [moderationBoards, setModerationBoards] = useState({ items: [], page: 1, size: 8, totalElements: 0, totalPages: 0 });
    const [moderationComments, setModerationComments] = useState({ items: [], page: 1, size: 8, totalElements: 0, totalPages: 0 });
    const [moderationHiddenFilter, setModerationHiddenFilter] = useState("ALL");
    const [moderationLoading, setModerationLoading] = useState(false);
    const [moderationError, setModerationError] = useState("");
    const [moderationActionKey, setModerationActionKey] = useState("");
    const [auditItems, setAuditItems] = useState({ items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 });
    const [auditTypeFilter, setAuditTypeFilter] = useState("ALL");
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditError, setAuditError] = useState("");
    const [roleAuditLoading, setRoleAuditLoading] = useState(false);
    const [roleAuditError, setRoleAuditError] = useState("");

    const [statusFilter, setStatusFilter] = useState("ALL");
    const [page, setPage] = useState(1);
    const [incidentList, setIncidentList] = useState({ items: [], page: 1, size: 20, totalElements: 0, totalPages: 0 });
    const [selectedDetail, setSelectedDetail] = useState(null);
    const [ruleDrafts, setRuleDrafts] = useState({});
    const [incidentDrafts, setIncidentDrafts] = useState({});
    const [newRule, setNewRule] = useState({ metric: "", hardLimitPerMinute: 60, zScoreThreshold: 3.0, enabled: true });

    const REPORT_STATUS_OPTIONS = ["ALL", "OPEN", "IN_REVIEW", "RESOLVED", "REJECTED"];
    const SANCTION_STATUS_OPTIONS = ["ALL", "ACTIVE", "RELEASED"];
    const AUDIT_TYPE_OPTIONS = ["ALL", "ROLE", "REPORT", "MODERATION", "SANCTION", "ANOMALY", "BANNER"];
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
        const payload = await adminAnomaliesAdapter.fetchIncidents(nextStatus, nextPage, 20);
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
        setSelectedDetail(await adminAnomaliesAdapter.fetchIncidentDetail(incidentId));
    };

    const fetchNotifications = async () => {
        const payload = await adminAnomaliesAdapter.fetchNotifications({ readYn: false, page: 1, size: 8 });
        setNotifications(payload?.items || []);
        setNotificationUnreadCount(payload?.unreadCount || 0);
    };

    const fetchReports = async (status = reportStatusFilter) => {
        setReportLoading(true);
        setReportError("");
        try {
            const payload = await adminAnomaliesAdapter.fetchReports({ status, page: 1, size: 10 });
            setReportList(payload);
            return payload;
        } catch (err) {
            const message = adminAnomaliesErrorMessage(err, "신고 내역을 불러오지 못했습니다.");
            setReportError(message);
            notifyError(message);
            return null;
        } finally {
            setReportLoading(false);
        }
    };

    const fetchSanctions = async (status = sanctionStatusFilter) => {
        setSanctionLoading(true);
        setSanctionError("");
        try {
            const payload = await adminAnomaliesAdapter.fetchSanctions({ status, page: 1, size: 10 });
            setSanctions(payload);
            return payload;
        } catch (err) {
            const message = adminAnomaliesErrorMessage(err, "제재 내역을 불러오지 못했습니다.");
            setSanctionError(message);
            notifyError(message);
            return null;
        } finally {
            setSanctionLoading(false);
        }
    };

    const fetchReleaseRequests = async () => {
        setReleaseRequestLoading(true);
        setReleaseRequestError("");
        try {
            const payload = await adminAnomaliesAdapter.fetchReleaseRequests({ page: 1, size: 50 });
            setReleaseRequests(payload);
            return payload;
        } catch (err) {
            const message = adminAnomaliesErrorMessage(err, "제재 해제 요청을 불러오지 못했습니다.");
            setReleaseRequestError(message);
            notifyError(message);
            return null;
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
            setSanctionMemberResults(await adminAnomaliesAdapter.searchMembers({ keyword: trimmedKeyword, page: 0, size: 20 }));
        } catch (err) {
            setSanctionMemberResults([]);
            setSanctionSearchError(adminAnomaliesErrorMessage(err, "회원을 검색하지 못했습니다."));
        } finally {
            setSanctionMemberLoading(false);
        }
    };

    const copyMemberId = async (member) => {
        const memberId = getMemberIdValue(member);
        if (!memberId) {
            notifyError("회원 ID를 확인할 수 없습니다.");
            return;
        }
        try {
            await navigator.clipboard.writeText(String(memberId));
            notifySuccess(`회원 ID #${memberId}를 복사했습니다.`);
        } catch (err) {
            notifyError("회원 ID를 복사하지 못했습니다.");
        }
    };

    const fetchModerationBoards = async (hidden = moderationHiddenFilter) => {
        setModerationBoards(await adminAnomaliesAdapter.fetchModerationBoards({ hidden, page: 1, size: 8 }));
    };

    const fetchModerationComments = async (hidden = moderationHiddenFilter) => {
        setModerationComments(await adminAnomaliesAdapter.fetchModerationComments({ hidden, page: 1, size: 8 }));
    };

    const refreshModerationItems = async (hidden = moderationHiddenFilter) => {
        if (moderationLoading || moderationActionKey) return null;
        setModerationLoading(true);
        setModerationError("");
        try {
            await Promise.all([
                fetchModerationBoards(hidden),
                fetchModerationComments(hidden),
            ]);
            return true;
        } catch (err) {
            const message = adminAnomaliesErrorMessage(err, "콘텐츠 검토 목록을 불러오지 못했습니다.");
            setModerationError(message);
            notifyError(message);
            return null;
        } finally {
            setModerationLoading(false);
        }
    };

    const fetchAudits = async (type = auditTypeFilter) => {
        setAuditLoading(true);
        setAuditError("");
        try {
            const payload = await adminAnomaliesAdapter.fetchAudits({ type, page: 1, size: 10 });
            setAuditItems(payload);
            return payload;
        } catch (err) {
            const message = adminAnomaliesErrorMessage(err, "감사 로그를 불러오지 못했습니다.");
            setAuditError(message);
            notifyError(message);
            return null;
        } finally {
            setAuditLoading(false);
        }
    };

    const fetchRoleMembers = async (keyword = roleKeyword) => {
        if (!isMaster) return;
        setRoleMembers(await adminAnomaliesAdapter.fetchRoleMembers({ keyword, page: 1, size: 10 }));
    };

    const refreshRoleMembers = async () => {
        if (!isMaster || roleMemberLoading) return null;
        setRoleMemberLoading(true);
        setRoleMemberError("");
        try {
            await fetchRoleMembers(roleKeyword);
            return true;
        } catch (err) {
            const message = adminAnomaliesErrorMessage(err, "회원을 검색하지 못했습니다.");
            setRoleMemberError(message);
            notifyError(message);
            logClientError("admin.anomalies.roleMembers.refresh", err);
            return null;
        } finally {
            setRoleMemberLoading(false);
        }
    };

    const fetchRoleAudits = async () => {
        if (!isMaster) return;
        setRoleAuditLoading(true);
        setRoleAuditError("");
        try {
            const payload = await adminAnomaliesAdapter.fetchRoleAudits({ page: 1, size: 10 });
            setRoleAudits(payload);
            return payload;
        } catch (err) {
            const message = adminAnomaliesErrorMessage(err, "권한 변경 이력을 불러오지 못했습니다.");
            setRoleAuditError(message);
            notifyError(message);
            return null;
        } finally {
            setRoleAuditLoading(false);
        }
    };

    const fetchDashboard = async (nextStatus = statusFilter, nextPage = page) => {
        setLoading(true);
        setError("");
        try {
            const dashboard = await adminAnomaliesAdapter.fetchDashboard({
                isMaster,
                roleKeyword,
                reportStatus: reportStatusFilter,
                sanctionStatus: sanctionStatusFilter,
                moderationHidden: moderationHiddenFilter,
                auditType: auditTypeFilter,
                incidentStatus: nextStatus,
                incidentPage: nextPage,
            });
            const sectionError = (key) => {
                const source = dashboard.sources?.[key];
                return source && source.ok === false ? source.message : "";
            };

            const nextRules = dashboard.rules || [];
            const nextIncidents = dashboard.incidents || { items: [], page: 1, size: 20, totalElements: 0, totalPages: 0 };
            setSummary(dashboard.summary);
            setEvents(dashboard.events || []);
            setKpi(dashboard.kpi);
            setRules(nextRules);
            setIncidentList(nextIncidents);
            const nextNotifications = dashboard.notifications || { items: [], unreadCount: 0 };
            const nextReports = dashboard.reports || { items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 };
            const nextSanctions = dashboard.sanctions || { items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 };
            const nextReleaseRequests = dashboard.releaseRequests || { items: [], page: 1, size: 50, totalElements: 0, totalPages: 0 };
            const nextModerationBoards = dashboard.moderationBoards || { items: [], page: 1, size: 8, totalElements: 0, totalPages: 0 };
            const nextModerationComments = dashboard.moderationComments || { items: [], page: 1, size: 8, totalElements: 0, totalPages: 0 };
            const nextAudits = dashboard.audits || { items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 };
            const nextRoleMembers = dashboard.roleMembers || { items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 };
            const nextRoleAudits = dashboard.roleAudits || { items: [], page: 1, size: 10, totalElements: 0, totalPages: 0 };
            const nextRealtimeOperations = dashboard.realtimeOperations || null;
            setNotifications(nextNotifications.items || []);
            setNotificationUnreadCount(nextNotifications.unreadCount || 0);
            setRealtimeOperations(nextRealtimeOperations);
            setRealtimeOperationsError(sectionError("realtimeOperations"));
            setReportList(nextReports);
            setReportError(sectionError("reports"));
            setSanctions(nextSanctions);
            setSanctionError(sectionError("sanctions"));
            setReleaseRequests(nextReleaseRequests);
            setReleaseRequestError(sectionError("releaseRequests"));
            setModerationBoards(nextModerationBoards);
            setModerationComments(nextModerationComments);
            setModerationError([sectionError("moderationBoards"), sectionError("moderationComments")].filter(Boolean).join(" "));
            setAuditItems(nextAudits);
            setAuditError(sectionError("audits"));
            if (isMaster) {
                setRoleMembers(nextRoleMembers);
                setRoleAudits(nextRoleAudits);
                setRoleMemberError(sectionError("roleMembers"));
                setRoleAuditError(sectionError("roleAudits"));
            } else {
                setRoleMemberError("");
                setRoleAuditError("");
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
            setError(adminAnomaliesErrorMessage(err, "관리자 대시보드를 불러오지 못했습니다."));
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

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchSanctionMembers(sanctionKeyword);
        }, 250);
        return () => clearTimeout(timer);
    }, [sanctionKeyword]);

    useEffect(() => {
        if (!releaseDialog.open) return undefined;
        const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const previousOverflow = document.body.style.overflow;
        const onKeyDown = (event) => {
            if (event.key === "Escape") {
                closeReleaseDialog();
                return;
            }
            trapFocus(event, releaseDialogRef.current);
        };

        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", onKeyDown);
        window.setTimeout(() => releaseDialogCloseRef.current?.focus(), 0);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", onKeyDown);
            if (previousFocus?.isConnected && typeof previousFocus.focus === "function") {
                previousFocus.focus();
            }
        };
    }, [releaseDialog.open, releasingSanctionId]);

    const changeFilter = async (nextStatus) => {
        setStatusFilter(nextStatus);
        setPage(1);
        await fetchDashboard(nextStatus, 1);
    };

    const changePage = async (nextPage) => {
        setPage(nextPage);
        await fetchIncidents(statusFilter, nextPage);
    };

    const isIncidentActionApplying = (incidentId, actionType = "") => {
        const prefix = `${Number(incidentId) || 0}:`;
        if (!applyingIncidentActionKey.startsWith(prefix)) return false;
        return !actionType || applyingIncidentActionKey === toIncidentActionKey(incidentId, actionType);
    };

    const changeReportFilter = async (nextStatus) => {
        if (reportLoading || updatingReportKey) return;
        setReportStatusFilter(nextStatus);
        await fetchReports(nextStatus);
    };

    const saveIncidentInline = async (incidentId) => {
        const draft = incidentDrafts[incidentId];
        if (!draft) return;

        setSavingIncidentId(incidentId);
        try {
            await adminAnomaliesAdapter.updateIncident(incidentId, draft);
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
        const normalizedIncidentId = Number(incidentId);
        if (!Number.isFinite(normalizedIncidentId) || normalizedIncidentId <= 0) {
            notifyError("사건 ID가 올바르지 않습니다.");
            return false;
        }
        if (applyingIncidentActionKey) {
            return false;
        }

        const actionKey = toIncidentActionKey(normalizedIncidentId, actionType);
        setApplyingIncidentActionKey(actionKey);
        try {
            const description = await promptAction({
                title: "조치 설명",
                label: "설명",
                placeholder: "조치 내용을 입력하세요",
                maxLength: ADMIN_ANOMALY_TEXT_LIMITS.incidentActionDescription,
            });
            if (description === null) return false;

            const payload = { actionType, description };
            if (actionType === "BLOCK_QUEUE_USER") {
                const blockMinutesInput = await promptAction({
                    title: "큐 차단 시간",
                    label: "차단 시간(분)",
                    initialValue: "30",
                    placeholder: "1-1440",
                    inputMode: "numeric",
                    required: true,
                    maxLength: 4,
                });
                if (blockMinutesInput === null) return false;
                payload.blockMinutes = Math.max(1, Math.min(1440, Number(blockMinutesInput) || 30));
            }

            await adminAnomaliesAdapter.applyIncidentAction(normalizedIncidentId, payload);
            notifySuccess("조치를 실행했습니다.");
            await fetchIncidents(statusFilter, page);
            await fetchDetail(normalizedIncidentId);
            await fetchDashboard(statusFilter, page);
            return true;
        } catch (err) {
            notifyError(adminAnomaliesErrorMessage(err, "이상징후 조치를 실행하지 못했습니다."));
            return false;
        } finally {
            setApplyingIncidentActionKey("");
        }
    };

    const removeNotificationLocally = (normalizedId) => {
        setNotifications((prev) =>
            (prev || []).filter((item) => Number(item?.notificationId ?? item?.notification_id) !== normalizedId)
        );
        setReleaseRequests((prev) => ({
            ...prev,
            items: (prev?.items || []).filter((item) => Number(item?.notificationId ?? item?.notification_id) !== normalizedId),
            totalElements: Math.max(0, Number(prev?.totalElements || 0) - 1),
        }));
        setNotificationUnreadCount((prev) => Math.max(0, Number(prev || 0) - 1));
    };

    const markNotificationRead = async (notificationId, { quietMissing = false } = {}) => {
        const normalizedId = Number(notificationId);
        if (!Number.isFinite(normalizedId) || normalizedId <= 0) {
            notifyError("알림 ID가 올바르지 않습니다.");
            return false;
        }
        if (markingNotificationIds.has(normalizedId)) {
            return false;
        }

        setMarkingNotificationIds((prev) => new Set(prev).add(normalizedId));
        try {
            await adminAnomaliesAdapter.markNotificationRead(normalizedId);
            removeNotificationLocally(normalizedId);
            return true;
        } catch (err) {
            const missingNotification =
                err?.response?.status === 404 ||
                err?.response?.data?.code === "ADMIN_NOTIFICATION_NOT_FOUND";
            if (missingNotification) {
                removeNotificationLocally(normalizedId);
                if (!quietMissing) {
                    notify("이미 처리되었거나 삭제된 알림입니다.");
                }
                return true;
            }
            notifyError(adminAnomaliesErrorMessage(err, "알림을 읽음 처리하지 못했습니다."));
            return false;
        } finally {
            setMarkingNotificationIds((prev) => {
                const next = new Set(prev);
                next.delete(normalizedId);
                return next;
            });
        }
    };

    const markAllNotificationsRead = async () => {
        if (markingAllNotifications || (!notifications.length && toNumber(notificationUnreadCount) <= 0)) {
            return;
        }
        setMarkingAllNotifications(true);
        try {
            await adminAnomaliesAdapter.markAllNotificationsRead();
            setNotifications([]);
            setNotificationUnreadCount(0);
            setReleaseRequests((prev) => ({
                ...prev,
                items: [],
                totalElements: 0,
                totalPages: 0,
            }));
            setReleaseRequestError("");
            notifySuccess("모든 알림을 읽음 처리했습니다.");
        } catch (err) {
            notifyError(adminAnomaliesErrorMessage(err, "알림을 모두 읽음 처리하지 못했습니다."));
        } finally {
            setMarkingAllNotifications(false);
        }
    };

    const updateReportStatus = async (reportId, reportStatus) => {
        const normalizedReportId = Number(reportId);
        if (!Number.isFinite(normalizedReportId) || normalizedReportId <= 0) {
            notifyError("신고 ID가 올바르지 않습니다.");
            return;
        }
        if (reportLoading || updatingReportKey) return;

        const actionKey = `${normalizedReportId}:${reportStatus}`;
        setUpdatingReportKey(actionKey);
        try {
            const adminNote = await promptAction({
                title: "신고 처리 메모",
                label: "관리자 메모",
                placeholder: "처리 내용을 입력하세요",
                maxLength: ADMIN_ANOMALY_TEXT_LIMITS.reportAdminNote,
            });
            if (adminNote === null) return;
            await adminAnomaliesAdapter.updateReportStatus(normalizedReportId, { reportStatus, adminNote });
            notifySuccess("신고 상태를 변경했습니다.");
            await fetchReports(reportStatusFilter);
            await fetchNotifications();
        } catch (err) {
            notifyError(adminAnomaliesErrorMessage(err, "신고 상태를 변경하지 못했습니다."));
        } finally {
            setUpdatingReportKey("");
        }
    };
    const createSanction = async () => {
        if (creatingSanction) return;

        const selectedMemberId = getMemberIdValue(selectedSanctionMember);
        if (!selectedMemberId) {
            notifyError("제재할 회원을 선택하세요.");
            return;
        }
        if (activeSanctionMemberIds.has(selectedMemberId)) {
            notifyError("이미 진행 중인 제재가 있는 회원입니다.");
            return;
        }
        const reason = sanctionReasonInput.trim();
        if (!reason) {
            notifyError("제재 사유를 입력하세요.");
            return;
        }

        const days = sanctionDaysInput ? Number(sanctionDaysInput) : undefined;
        setCreatingSanction(true);
        const loadingToast = await notifyLoading("제재를 등록하는 중입니다...");
        try {
            await adminAnomaliesAdapter.createSanction({ memberId: selectedMemberId, reason, days });
            loadingToast.success("제재를 등록했습니다.");
            setSanctionReasonInput("");
            setSanctionDaysInput("");
            setSanctionKeyword("");
            setSanctionMemberResults([]);
            setSelectedSanctionMember(null);
            await fetchSanctions(sanctionStatusFilter);
            await fetchNotifications();
            await fetchAudits(auditTypeFilter);
        } catch (err) {
            loadingToast.error(adminAnomaliesErrorMessage(err, "제재 등록에 실패했습니다."));
        } finally {
            setCreatingSanction(false);
        }
    };

    const releaseSanction = async (sanctionId, options = {}) => {
        const normalizedSanctionId = Number(sanctionId);
        if (!Number.isFinite(normalizedSanctionId) || normalizedSanctionId <= 0) {
            notifyError("제재 ID가 올바르지 않습니다.");
            return false;
        }
        if (releasingSanctionId !== null) return false;

        const providedReason = typeof options.reason === "string" ? options.reason : "";
        const reason = providedReason.trim();
        if (!reason) {
            notifyError("제재 해제 사유를 입력하세요.");
            return false;
        }

        setReleasingSanctionId(normalizedSanctionId);
        const loadingToast = await notifyLoading("제재를 해제하는 중입니다...");
        try {
            const notificationId = Number(options.notificationId);
            await adminAnomaliesAdapter.releaseSanction(normalizedSanctionId, {
                reason,
                notificationId,
            });
            if (Number.isFinite(notificationId) && notificationId > 0) {
                await markNotificationRead(notificationId, { quietMissing: true });
            }
            loadingToast.success("제재를 해제했습니다.");
            await fetchSanctions(sanctionStatusFilter);
            await fetchNotifications();
            await fetchReleaseRequests();
            await fetchAudits(auditTypeFilter);
            return true;
        } catch (err) {
            loadingToast.error(adminAnomaliesErrorMessage(err, "제재 해제에 실패했습니다."));
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
        if (releasingSanctionId !== null) return;
        setReleaseDialog({ open: false, sanctionId: null, memberEmail: "", notificationId: null });
        setReleaseReasonInput("");
    };

    const confirmReleaseDialog = async () => {
        if (releasingSanctionId !== null) return;
        if (!Number.isFinite(Number(releaseDialog.sanctionId)) || Number(releaseDialog.sanctionId) <= 0) {
            notifyError("제재 ID가 올바르지 않습니다.");
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
            notifyError("게시글 ID가 올바르지 않습니다.");
            return;
        }
        if (moderationLoading || moderationActionKey) return;
        const normalizedHiddenYn = toHiddenYnBoolean(hiddenYn);
        if (normalizedHiddenYn === null) {
            notifyError("숨김 상태 값이 올바르지 않습니다.");
            return;
        }

        setModerationActionKey(`board:${normalizedBoardId}`);
        setModerationError("");
        try {
            const reason = await promptAction({
                title: normalizedHiddenYn ? "게시글 숨김 사유" : "게시글 복구 사유",
                label: "사유",
                placeholder: normalizedHiddenYn ? "숨김 사유를 입력하세요" : "복구 사유를 입력하세요",
                maxLength: ADMIN_ANOMALY_TEXT_LIMITS.moderationReason,
            });
            if (reason === null) return;
            await adminAnomaliesAdapter.updateBoardHidden(normalizedBoardId, { hiddenYn: normalizedHiddenYn, reason });
            notifySuccess(normalizedHiddenYn ? "게시글을 숨김 처리했습니다." : "게시글을 복구했습니다.");
            await fetchModerationBoards(moderationHiddenFilter);
            await fetchAudits(auditTypeFilter);
        } catch (err) {
            const message = adminAnomaliesErrorMessage(err, "게시글 표시 상태 변경에 실패했습니다.");
            setModerationError(message);
            notifyError(message);
        } finally {
            setModerationActionKey("");
        }
    };

    const updateCommentHidden = async (commentId, hiddenYn) => {
        const normalizedCommentId = Number(commentId);
        if (!Number.isFinite(normalizedCommentId) || normalizedCommentId <= 0) {
            notifyError("댓글 ID가 올바르지 않습니다.");
            return;
        }
        if (moderationLoading || moderationActionKey) return;
        const normalizedHiddenYn = toHiddenYnBoolean(hiddenYn);
        if (normalizedHiddenYn === null) {
            notifyError("숨김 상태 값이 올바르지 않습니다.");
            return;
        }

        setModerationActionKey(`comment:${normalizedCommentId}`);
        setModerationError("");
        try {
            const reason = await promptAction({
                title: normalizedHiddenYn ? "댓글 숨김 사유" : "댓글 복구 사유",
                label: "사유",
                placeholder: normalizedHiddenYn ? "숨김 사유를 입력하세요" : "복구 사유를 입력하세요",
                maxLength: ADMIN_ANOMALY_TEXT_LIMITS.moderationReason,
            });
            if (reason === null) return;
            await adminAnomaliesAdapter.updateCommentHidden(normalizedCommentId, { hiddenYn: normalizedHiddenYn, reason });
            notifySuccess(normalizedHiddenYn ? "댓글을 숨김 처리했습니다." : "댓글을 복구했습니다.");
            await fetchModerationComments(moderationHiddenFilter);
            await fetchAudits(auditTypeFilter);
        } catch (err) {
            const message = adminAnomaliesErrorMessage(err, "댓글 표시 상태 변경에 실패했습니다.");
            setModerationError(message);
            notifyError(message);
        } finally {
            setModerationActionKey("");
        }
    };

    const changeSanctionFilter = async (status) => {
        if (sanctionLoading || creatingSanction || releasingSanctionId !== null) return;
        setSanctionStatusFilter(status);
        await fetchSanctions(status);
    };

    const changeModerationFilter = async (hiddenFilter) => {
        if (moderationLoading || moderationActionKey) return;
        setModerationHiddenFilter(hiddenFilter);
        await refreshModerationItems(hiddenFilter);
    };

    const changeAuditFilter = async (type) => {
        if (auditLoading) return;
        setAuditTypeFilter(type);
        await fetchAudits(type);
    };

    const hasAdminRole = (roles) => Array.isArray(roles) && roles.includes("ROLE_ADMIN");

    const updateMemberAdminRole = async (member) => {
        const memberId = getMemberIdValue(member);
        if (!memberId) {
            notifyError("회원 ID가 없습니다.");
            return;
        }
        const currentRoles = Array.isArray(member.roles) ? member.roles : [];
        const hasAdmin = hasAdminRole(currentRoles);
        // ROLE_USER는 유지하고 ROLE_ADMIN만 토글한다.
        const nextRoles = hasAdmin
            ? currentRoles.filter((role) => role !== "ROLE_ADMIN")
            : Array.from(new Set([...currentRoles, "ROLE_ADMIN"]));

        const reason = await promptAction({
            title: hasAdmin ? "관리자 권한 해제 사유" : "관리자 권한 부여 사유",
            label: "사유",
            placeholder: hasAdmin ? "권한 해제 사유를 입력하세요" : "권한 부여 사유를 입력하세요",
            maxLength: ADMIN_ANOMALY_TEXT_LIMITS.roleReason,
        });
        if (reason === null) return;

        try {
            await adminAnomaliesAdapter.updateMemberAdminRole(memberId, { roles: nextRoles, reason });
            await fetchRoleMembers(roleKeyword);
            await fetchRoleAudits();
            await fetchNotifications();
            notifySuccess(hasAdmin ? "관리자 권한을 해제했습니다." : "관리자 권한을 부여했습니다.");
        } catch (err) {
            const message = adminAnomaliesErrorMessage(err, "관리자 권한 변경에 실패했습니다.");
            notifyError(message);
            logClientError("admin.anomalies.memberRole.update", err);
        }
    };

    const searchRoleMembers = async () => {
        await refreshRoleMembers();
    };

    const refreshRules = async () => {
        const nextRules = await adminAnomaliesAdapter.fetchRules();
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

        await adminAnomaliesAdapter.saveRule(metric, draft);

        await refreshRules();
    };

    const createRule = async () => {
        if (!newRule.metric.trim()) {
            notifyError("지표 이름을 입력하세요.");
            return;
        }

        await adminAnomaliesAdapter.createRule({
            metric: newRule.metric.trim(),
            hardLimitPerMinute: Number(newRule.hardLimitPerMinute) || 1,
            zScoreThreshold: Number(newRule.zScoreThreshold) || 1,
            enabled: Boolean(newRule.enabled),
        });

        setNewRule({ metric: "", hardLimitPerMinute: 60, zScoreThreshold: 3.0, enabled: true });
        await refreshRules();
    };

    const downloadReport = async () => {
        if (reportDownloading) return;
        setReportDownloading(true);
        const loadingToast = await notifyLoading("보고서를 준비하는 중입니다...");
        try {
            const blobData = await adminAnomaliesAdapter.downloadReport(7);
            const blob = new Blob([blobData], { type: "text/csv;charset=utf-8;" });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `anomaly-report-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            loadingToast.success("보고서를 다운로드했습니다.");
        } catch (err) {
            loadingToast.error(adminAnomaliesErrorMessage(err, "보고서 다운로드에 실패했습니다."));
        } finally {
            setReportDownloading(false);
        }
    };

    const realtimeCounters = Array.isArray(realtimeOperations?.counters) ? realtimeOperations.counters : [];
    const realtimeFullSyncFromCounters = realtimeCounters
        .filter((counter) => String(counter?.operation || "") === "replay_sync"
            && String(counter?.outcome || "") === "full_sync_required")
        .reduce((sum, counter) => sum + toNumber(counter?.count), 0);
    const realtimeFullSyncValue = realtimeOperations?.fullSyncRequiredEvents ?? realtimeOperations?.full_sync_required_events;
    const realtimeFullSyncEvents = realtimeFullSyncValue === undefined
        ? realtimeFullSyncFromCounters
        : toNumber(realtimeFullSyncValue);
    const realtimeRedisAvailable = !realtimeOperations
        || (realtimeOperations.redisAvailable ?? realtimeOperations.redis_available) !== false;
    const realtimeOperationsUnavailable = Boolean(realtimeOperationsError) || !realtimeRedisAvailable;
    const realtimeOperationsHint = realtimeOperationsUnavailable
        ? "source unavailable"
        : realtimeFullSyncEvents > 0 ? "needs review" : "";
    const realtimeOperationsTitle = realtimeOperationsError
        || (!realtimeRedisAvailable ? "Realtime operations Redis unavailable" : "Realtime replay full-sync recoveries in the last 60 minutes");

    if (!isAdmin) {
        return (
            <div className="rounded-[2rem] border border-rose-100 bg-rose-50/50 p-10 text-rose-800 text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                    <ShieldAlert className="h-8 w-8 text-rose-500" />
                </div>
                <h1 className="text-xl font-black">관리자 전용</h1>
                <p className="text-sm font-medium opacity-70">관리자 권한이 필요한 대시보드입니다.</p>
            </div>
        );
    }

    if (loading) return <LoadingSpinner text="관리자 대시보드를 불러오는 중입니다..." />;

    if (error) {
        return (
            <div className="rounded-[2rem] border border-rose-100 bg-rose-50/50 p-10 text-rose-800 text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                    <AlertTriangle className="h-8 w-8 text-rose-500" />
                </div>
                <h1 className="text-xl font-black">불러오기 실패</h1>
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
                    <p className="text-sm font-medium text-slate-400">운영, 보안, 신고, 제재 상태를 한 화면에서 확인합니다.</p>
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
                        disabled={reportDownloading}
                        className="btn-primary"
                    >
                        {reportDownloading ? <LoadingSpinner size="sm" text="" /> : <Download className="mr-2 h-4 w-4" />}
                        {reportDownloading ? "준비 중..." : "보고서 다운로드"}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
                <StatCard icon={Users} label="전체 회원" value={toNumber(summary?.total_members ?? summary?.totalMembers)} tone="blue" />
                <StatCard icon={MessageSquare} label="전체 게시글" value={toNumber(summary?.total_boards ?? summary?.totalBoards)} tone="emerald" />
                <StatCard icon={Eye} label="오늘 방문자" value={toNumber(summary?.today_visitors ?? summary?.todayVisitors)} tone="amber" />
                <StatCard icon={Activity} label="이상징후 이벤트" value={events.length} tone="slate" />
                <StatCard
                    icon={RefreshCw}
                    label="Realtime resync"
                    value={realtimeFullSyncEvents}
                    tone={realtimeOperationsUnavailable ? "rose" : realtimeFullSyncEvents > 0 ? "amber" : "slate"}
                    hint={realtimeOperationsHint}
                    title={realtimeOperationsTitle}
                />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="card p-8">
                    <h2 className="mb-6 flex items-center gap-2 text-lg font-black text-slate-900 tracking-tight">
                        <div className="p-2 rounded-xl bg-primary-50 text-primary-600">
                            <ClipboardList className="h-5 w-5" />
                        </div>
                        이상징후 KPI (7일)
                    </h2>
                    <div className="space-y-4 text-sm">
                        {[
                            { label: "전체 사건", val: toNumber(kpi?.totalIncidents) },
                            { label: "신규", val: toNumber(kpi?.newCount), color: "text-primary-600" },
                            { label: "검토 중", val: toNumber(kpi?.reviewingCount), color: "text-amber-600" },
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
                        실시간 이상징후 이벤트
                    </h2>
                    {!events.length ? (
                        <div className="flex flex-col items-center justify-center h-48 rounded-[2rem] bg-slate-50/50 text-slate-400 font-bold">
                            최근 이상징후 이벤트가 없습니다.
                        </div>
                    ) : (
                        <div className="max-h-72 overflow-auto rounded-2xl border border-slate-50">
                            <table className="min-w-full text-sm">
                                <thead className="bg-slate-50/50 text-slate-400 font-black uppercase text-[10px] tracking-widest">
                                    <tr>
                                        <th className="px-4 py-4 text-left">감지 시각</th>
                                        <th className="px-4 py-4 text-left">지표</th>
                                        <th className="px-4 py-4 text-left">대상</th>
                                        <th className="px-4 py-4 text-right">Z 점수</th>
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
                            회원 제재
                        </h2>
                        <div className="flex items-center gap-2">
                            <select
                                value={sanctionStatusFilter}
                                onChange={(e) => changeSanctionFilter(e.target.value)}
                                disabled={sanctionLoading || creatingSanction || releasingSanctionId !== null}
                                className="input-base py-1.5 px-3 w-auto rounded-xl text-xs font-bold border-0 bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                            >
                                {SANCTION_STATUS_OPTIONS.map((status) => (
                                    <option key={status} value={status}>{labelOf(SANCTION_STATUS_LABELS, status)}</option>
                                ))}
                            </select>
                            <button
                                className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-3 py-2 text-xs font-black text-white shadow-lg shadow-primary-100 disabled:opacity-60"
                                onClick={createSanction}
                                disabled={sanctionLoading || creatingSanction || (selectedSanctionMember && activeSanctionMemberIds.has(getMemberIdValue(selectedSanctionMember)))}
                            >
                                {creatingSanction ? <RefreshCw className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />} {creatingSanction ? "등록 중..." : "등록"}
                            </button>
                        </div>
                    </div>
                    {sanctionError ? (
                        <div role="alert" className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-600">
                            {sanctionError}
                        </div>
                    ) : null}
                    <div className="mb-6 space-y-3">
                        <input
                            value={sanctionKeyword}
                            onChange={(e) => setSanctionKeyword(e.target.value.slice(0, MEMBER_SEARCH_KEYWORD_MAX_LENGTH))}
                            maxLength={MEMBER_SEARCH_KEYWORD_MAX_LENGTH}
                            placeholder="회원 검색 (이름/이메일)"
                            className="input-base w-full"
                        />
                        <p className="-mt-2 text-right text-[11px] font-semibold text-slate-400">
                            검색어 {sanctionKeyword.length}/{MEMBER_SEARCH_KEYWORD_MAX_LENGTH}자
                        </p>
                        {sanctionMemberLoading ? (
                            <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-400">검색 중...</div>
                        ) : null}
                        {sanctionSearchError ? (
                            <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{sanctionSearchError}</div>
                        ) : null}
                        {sanctionMemberResults.length ? (
                            <div className="max-h-40 overflow-auto rounded-2xl border border-slate-100 bg-slate-50/40 p-2 space-y-2">
                                {sanctionMemberResults.map((member) => {
                                    const memberId = getMemberIdValue(member);
                                    const isSelected = selectedSanctionMember && getMemberIdValue(selectedSanctionMember) === memberId;
                                    return (
                                        <div
                                            key={memberId}
                                            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all ${isSelected ? "bg-primary-100 text-primary-700" : "bg-white text-slate-600 hover:bg-primary-50"}`}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => setSelectedSanctionMember(member)}
                                                className="min-w-0 flex-1 text-left"
                                            >
                                                <div className="truncate">{member?.name || "(이름 없음)"} ({member?.email || "-"})</div>
                                                <div className="text-[10px] opacity-70">#{memberId}</div>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => copyMemberId(member)}
                                                className="shrink-0 rounded-lg bg-white/80 p-2 text-slate-500 hover:text-primary-700"
                                                title="회원 ID 복사"
                                                aria-label={`회원 ID ${memberId} 복사`}
                                            >
                                                <ClipboardList className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : sanctionKeyword.trim() ? (
                            <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-400">검색 결과가 없습니다.</div>
                        ) : null}
                        <input
                            value={sanctionReasonInput}
                            onChange={(e) => setSanctionReasonInput(e.target.value.slice(0, ADMIN_ANOMALY_TEXT_LIMITS.sanctionReason))}
                            placeholder="제재 사유"
                            className="input-base w-full"
                            maxLength={ADMIN_ANOMALY_TEXT_LIMITS.sanctionReason}
                        />
                        <input
                            value={sanctionDaysInput}
                            onChange={(e) => setSanctionDaysInput(e.target.value)}
                            placeholder="제재 일수 (비우면 영구)"
                            className="input-base w-full"
                        />
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-500">
                            <span>
                                선택 회원: {selectedSanctionMember ? `${selectedSanctionMember?.name || selectedSanctionMember?.email || "회원"} (#${getMemberIdValue(selectedSanctionMember) || "-"})` : "없음"}
                            </span>
                            {selectedSanctionMember ? (
                                <button
                                    type="button"
                                    onClick={() => copyMemberId(selectedSanctionMember)}
                                    className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600 hover:bg-primary-50 hover:text-primary-700"
                                >
                                    ID 복사
                                </button>
                            ) : null}
                        </div>
                        {selectedSanctionMember && activeSanctionMemberIds.has(getMemberIdValue(selectedSanctionMember)) ? (
                            <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                                이미 제재 중인 회원입니다. 중복 제재는 차단됩니다.
                            </div>
                        ) : null}
                    </div>
                    <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                        <div className="mb-3 text-xs font-black uppercase tracking-widest text-amber-700">
                            제재 해제 요청 ({releaseRequests.items?.length || 0})
                        </div>
                        {releaseRequestError ? (
                            <div role="alert" className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600">
                                {releaseRequestError}
                            </div>
                        ) : null}
                        {releaseRequestLoading ? (
                            <div className="rounded-xl bg-white px-3 py-4 text-xs font-bold text-slate-400">해제 요청을 불러오는 중입니다...</div>
                        ) : !releaseRequests.items?.length ? (
                            <div className="rounded-xl bg-white px-3 py-4 text-xs font-bold text-slate-400">대기 중인 해제 요청이 없습니다.</div>
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
                                    const markingNotification = Number.isFinite(notificationId) && markingNotificationIds.has(notificationId);
                                    const releaseActionInProgress = Number.isFinite(sanctionId) && releasingSanctionId === sanctionId;
                                    return (
                                        <div key={Number.isFinite(notificationId) ? `release-request-${notificationId}` : fallbackKey("release-request", sanctionId, memberEmail, sanctionReason, requestReason, item?.createdAt ?? item?.created_at)} className="rounded-xl bg-white p-3 text-xs">
                                            <div className="font-bold text-slate-700">{memberEmail}</div>
                                            <div className="mt-1 text-[11px] font-semibold text-slate-500">제재 #{Number.isFinite(sanctionId) ? sanctionId : "-"}</div>
                                            <div className="mt-1 text-[11px] text-slate-500">제재 사유: {sanctionReason || "-"}</div>
                                            <div className="mt-1 text-[11px] text-slate-600">요청 메시지: {requestReason || "(비어 있음)"}</div>
                                            <div className="mt-1 text-[10px] font-semibold text-slate-400">{item?.createdAt ?? item?.created_at}</div>
                                            <div className="mt-2 flex gap-2">
                                                <button
                                                    type="button"
                                                    className="rounded-lg bg-primary-600 px-3 py-1.5 font-black text-white disabled:opacity-60"
                                                    disabled={!Number.isFinite(sanctionId) || sanctionId <= 0 || releaseRequestLoading || releasingSanctionId !== null}
                                                    onClick={() => {
                                                        if (!Number.isFinite(sanctionId) || sanctionId <= 0) {
                                                            notifyError("제재 해제 요청 데이터가 올바르지 않습니다.");
                                                            return;
                                                        }
                                                        openReleaseDialog({
                                                            sanctionId,
                                                            memberEmail,
                                                            notificationId,
                                                        });
                                                    }}
                                                >
                                                    {releaseActionInProgress ? "해제 중..." : "지금 해제"}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="rounded-lg bg-slate-100 px-3 py-1.5 font-black text-slate-600"
                                                    disabled={!Number.isFinite(notificationId) || notificationId <= 0 || markingNotification || markingAllNotifications}
                                                    onClick={() => {
                                                        if (!Number.isFinite(notificationId) || notificationId <= 0) {
                                                            notifyError("알림 ID가 올바르지 않습니다.");
                                                            return;
                                                        }
                                                        markNotificationRead(notificationId);
                                                    }}
                                                >
                                                    {markingNotification ? "처리 중..." : "읽음 처리"}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    {!sanctions.items?.length ? (
                        <div className="flex flex-col items-center justify-center h-48 rounded-[2rem] bg-slate-50/50 text-slate-400 font-bold text-sm">
                            {sanctionLoading ? "제재 내역을 불러오는 중입니다." : "제재 내역이 없습니다."}
                        </div>
                    ) : (
                        <div className="space-y-4 max-h-[400px] overflow-auto pr-2">
                            {sanctions.items.map((sanction, idx) => {
                                const sanctionId = Number(sanction?.sanctionId ?? sanction?.sanction_id);
                                const sanctionStatus = sanction?.sanctionStatus ?? sanction?.sanction_status;
                                const memberEmail = sanction?.memberEmail ?? sanction?.member_email ?? "-";
                                const reason = sanction?.reason ?? "-";
                                const createdAt = sanction?.createdAt ?? sanction?.created_at;
                                const sanctionReleaseInProgress = releasingSanctionId === sanctionId;
                                return (
                                <div key={Number.isFinite(sanctionId) ? sanctionId : `sanction-${idx}`} className="p-5 rounded-2xl bg-slate-50/50 border border-slate-100 hover:border-rose-100 transition-colors">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="font-black text-slate-900 text-sm">#{Number.isFinite(sanctionId) ? sanctionId : "-"}</div>
                                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${sanctionStatus === 'ACTIVE' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-600'}`}>
                                            {labelOf(SANCTION_STATUS_LABELS, sanctionStatus)}
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
                                                    disabled={sanctionLoading || releasingSanctionId !== null || !Number.isFinite(sanctionId)}
                                                    title="제재 해제"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    className="text-primary-600 hover:underline disabled:opacity-60"
                                                    onClick={() => openReleaseDialog({ sanctionId, memberEmail })}
                                                    disabled={sanctionLoading || releasingSanctionId !== null || !Number.isFinite(sanctionId)}
                                                >
                                                    {sanctionReleaseInProgress ? "해제 중..." : "해제"}
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
                            콘텐츠 검토
                        </h2>
                        <div className="flex items-center gap-3">
                            {moderationLoading ? (
                                <span role="status" className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-[10px] font-black text-primary-600">
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                    불러오는 중
                                </span>
                            ) : null}
                            <select
                                value={moderationHiddenFilter}
                                onChange={(e) => changeModerationFilter(e.target.value)}
                                disabled={moderationLoading || Boolean(moderationActionKey)}
                                className="input-base py-1.5 px-4 w-auto rounded-xl text-xs font-bold border-0 bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                            >
                                <option value="ALL">전체 보기</option>
                                <option value="HIDDEN">숨김만</option>
                                <option value="VISIBLE">공개만</option>
                            </select>
                        </div>
                    </div>
                    {moderationError ? (
                        <div role="alert" className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-600">
                            {moderationError}
                        </div>
                    ) : null}
                    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                        <div className="space-y-4">
                            <h3 className="px-2 text-xs font-black text-slate-400 tracking-widest">게시글</h3>
                            <div className="space-y-3">
                                {!(moderationBoards.items || []).length ? (
                                    <div className="flex h-40 items-center justify-center rounded-2xl bg-slate-50/50 text-sm font-bold text-slate-400">
                                        {moderationLoading ? "게시글 검토 목록을 불러오는 중입니다." : "게시글 검토 항목이 없습니다."}
                                    </div>
                                ) : (moderationBoards.items || []).map((board) => {
                                    const boardId = Number(getBoardIdValue(board));
                                    const boardActionLoading = moderationActionKey === `board:${boardId}`;
                                    const boardActionDisabled = moderationLoading || Boolean(moderationActionKey) || !Number.isFinite(boardId) || boardId <= 0;
                                    return (
                                    <div key={Number.isFinite(boardId) ? boardId : fallbackKey("board", getBoardCreatorValue(board), board?.title, board?.createdAt ?? board?.created_at)} className="group p-5 rounded-2xl border border-slate-50 bg-slate-50/30 hover:bg-white hover:shadow-xl transition-all duration-300">
                                        <div className="flex items-start justify-between gap-3 mb-2">
                                            <div className="font-bold text-slate-900 text-sm line-clamp-1 group-hover:text-primary-600 transition-colors">#{getBoardIdValue(board)} {board.title}</div>
                                            <span className={`flex-shrink-0 px-2 py-0.5 rounded-lg text-[9px] font-black tracking-wider ${getHiddenYnValue(board) ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {getHiddenYnValue(board) ? "숨김" : "공개"}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-bold text-slate-400">{getBoardCreatorValue(board)}</span>
                                            <button
                                                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-black transition-all disabled:cursor-not-allowed disabled:opacity-60 ${getHiddenYnValue(board) ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}
                                                disabled={boardActionDisabled}
                                                onClick={() => updateBoardHidden(boardId, !getHiddenYnValue(board))}
                                            >
                                                {boardActionLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : getHiddenYnValue(board) ? <RotateCcw className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                                                {boardActionLoading ? "처리 중..." : getHiddenYnValue(board) ? "복구" : "숨김"}
                                            </button>
                                        </div>
                                    </div>
                                )})}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h3 className="px-2 text-xs font-black text-slate-400 tracking-widest">댓글</h3>
                            <div className="space-y-3">
                                {!(moderationComments.items || []).length ? (
                                    <div className="flex h-40 items-center justify-center rounded-2xl bg-slate-50/50 text-sm font-bold text-slate-400">
                                        {moderationLoading ? "댓글 검토 목록을 불러오는 중입니다." : "댓글 검토 항목이 없습니다."}
                                    </div>
                                ) : (moderationComments.items || []).map((comment) => {
                                    const commentId = Number(getCommentIdValue(comment));
                                    const commentActionLoading = moderationActionKey === `comment:${commentId}`;
                                    const commentActionDisabled = moderationLoading || Boolean(moderationActionKey) || !Number.isFinite(commentId) || commentId <= 0;
                                    return (
                                    <div key={Number.isFinite(commentId) ? commentId : fallbackKey("comment", getBoardIdValue(comment), getWriterNameValue(comment), comment?.createdAt ?? comment?.created_at)} className="group p-5 rounded-2xl border border-slate-50 bg-slate-50/30 hover:bg-white hover:shadow-xl transition-all duration-300">
                                        <div className="flex items-start justify-between gap-3 mb-2">
                                            <div className="font-bold text-slate-900 text-sm line-clamp-1 group-hover:text-primary-600 transition-colors">#{getCommentIdValue(comment)} (게시글 #{getBoardIdValue(comment)})</div>
                                            <span className={`flex-shrink-0 px-2 py-0.5 rounded-lg text-[9px] font-black tracking-wider ${getHiddenYnValue(comment) ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {getHiddenYnValue(comment) ? "숨김" : "공개"}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-bold text-slate-400">{getWriterNameValue(comment)}</span>
                                            <button
                                                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-black transition-all disabled:cursor-not-allowed disabled:opacity-60 ${getHiddenYnValue(comment) ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}
                                                disabled={commentActionDisabled}
                                                onClick={() => updateCommentHidden(commentId, !getHiddenYnValue(comment))}
                                            >
                                                {commentActionLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : getHiddenYnValue(comment) ? <RotateCcw className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                                                {commentActionLoading ? "처리 중..." : getHiddenYnValue(comment) ? "복구" : "숨김"}
                                            </button>
                                        </div>
                                    </div>
                                )})}
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
                        통합 감사 로그
                    </h2>
                    <div className="flex items-center gap-3">
                        {auditLoading ? (
                            <span role="status" className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-[10px] font-black text-primary-600">
                                <RefreshCw className="h-3 w-3 animate-spin" />
                                불러오는 중
                            </span>
                        ) : null}
                        <select
                            value={auditTypeFilter}
                            onChange={(e) => changeAuditFilter(e.target.value)}
                            disabled={auditLoading}
                            className="input-base py-1.5 px-4 w-auto rounded-xl text-xs font-bold border-0 bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                        >
                            {AUDIT_TYPE_OPTIONS.map((type) => (
                                <option key={type} value={type}>{labelOf(AUDIT_TYPE_LABELS, type)}</option>
                            ))}
                        </select>
                    </div>
                </div>
                {auditError ? (
                    <div role="alert" className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-600">
                        {auditError}
                    </div>
                ) : null}
                {!auditItems.items?.length ? (
                    <div className="flex flex-col items-center justify-center h-48 rounded-[2rem] bg-slate-50/50 text-slate-400 font-bold text-sm">
                        {auditLoading ? "감사 이력을 불러오는 중입니다." : "감사 이력이 없습니다."}
                    </div>
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
                        <h2 className="text-lg font-black text-slate-900 tracking-tight">관리자 알림</h2>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-[10px] font-black text-rose-600 uppercase">
                                <BellRing className="h-3 w-3" /> {toNumber(notificationUnreadCount)}개 미확인
                            </div>
                            <button
                                type="button"
                                className="text-[11px] font-bold text-slate-400 hover:text-primary-600 disabled:cursor-not-allowed disabled:text-slate-300"
                                onClick={markAllNotificationsRead}
                                disabled={markingAllNotifications || (!notifications.length && toNumber(notificationUnreadCount) <= 0)}
                            >
                                {markingAllNotifications ? "처리 중..." : "모두 읽음"}
                            </button>
                        </div>
                    </div>

                    {!notifications.length ? (
                        <div className="flex flex-col items-center justify-center h-64 rounded-[2rem] bg-slate-50/50 text-slate-400 font-bold text-sm">읽지 않은 알림이 없습니다.</div>
                    ) : (
                        <div className="space-y-4 max-h-[500px] overflow-auto pr-2">
                            {notifications.map((notification, idx) => {
                                const notificationId = Number(notification?.notificationId ?? notification?.notification_id);
                                const markingNotification = Number.isFinite(notificationId) && markingNotificationIds.has(notificationId);
                                const notificationLink = normalizeNotificationLink(notification);
                                return (
                                <div key={Number.isFinite(notificationId) ? notificationId : `notif-${idx}`} className="group p-6 rounded-3xl bg-slate-50/50 border border-slate-100 hover:bg-white hover:shadow-xl transition-all">
                                    <div className="mb-3 flex items-center justify-between">
                                        <div className="text-sm font-black text-slate-900 line-clamp-1">{notification?.title}</div>
                                        <span className="px-2 py-0.5 rounded-lg bg-slate-200 text-[9px] font-black text-slate-600 uppercase tracking-tighter">{notification?.severity}</span>
                                    </div>
                                    <p className="mb-5 text-[13px] font-medium text-slate-500 leading-relaxed">{notification?.message}</p>
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="text-[10px] font-bold text-slate-300">{notification?.createdAt ?? notification?.created_at}</span>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {notificationLink ? (
                                                <button
                                                    type="button"
                                                    className="rounded-xl bg-white px-4 py-1.5 text-[11px] font-black text-primary-600 ring-1 ring-primary-100 hover:bg-primary-50"
                                                    onClick={() => navigate(notificationLink)}
                                                    title="알림 열기"
                                                >
                                                    열기
                                                </button>
                                            ) : null}
                                            <button
                                                className="btn-primary py-1.5 px-4 text-[11px]"
                                                disabled={!Number.isFinite(notificationId) || notificationId <= 0 || markingNotification}
                                                onClick={() => markNotificationRead(notificationId)}
                                            >
                                                {markingNotification ? "처리 중..." : "읽음 처리"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )})}
                        </div>
                    )}
                </div>
                <div className="card p-8">
                    <div className="mb-8 flex items-center justify-between">
                        <h2 className="text-lg font-black text-slate-900 tracking-tight">사용자 신고</h2>
                        <select
                            value={reportStatusFilter}
                            onChange={(e) => changeReportFilter(e.target.value)}
                            disabled={reportLoading || Boolean(updatingReportKey)}
                            className="input-base py-1.5 px-4 w-auto rounded-xl text-xs font-bold border-0 bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                        >
                            {REPORT_STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>{labelOf(REPORT_STATUS_LABELS, status)}</option>
                            ))}
                        </select>
                    </div>
                    {reportError ? (
                        <div role="alert" className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-600">
                            {reportError}
                        </div>
                    ) : null}

                    {!reportList.items?.length ? (
                        <div className="flex flex-col items-center justify-center h-64 rounded-[2rem] bg-slate-50/50 text-slate-400 font-bold text-sm">
                            {reportLoading ? "신고 내역을 불러오는 중입니다." : "신고 내역이 없습니다."}
                        </div>
                    ) : (
                        <div className="space-y-4 max-h-[500px] overflow-auto pr-2">
                            {reportList.items.map((report) => {
                                const reportId = Number(report.reportId ?? report.report_id);
                                const reportActionsDisabled = reportLoading || Boolean(updatingReportKey) || !Number.isFinite(reportId) || reportId <= 0;
                                const reportActionLoading = (status) => updatingReportKey === `${reportId}:${status}`;
                                return (
                                <div key={report.reportId} className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm">
                                    <div className="mb-4 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-slate-900 tracking-tighter">#{report.reportId}</span>
                                            <span className="px-2 py-0.5 rounded-lg bg-primary-50 text-[9px] font-black text-primary-600 tracking-widest">{labelOf(TARGET_TYPE_LABELS, report.targetType)}</span>
                                            <span className="text-[10px] font-bold text-slate-400">ID: {report.targetId}</span>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black tracking-tight ${report.reportStatus === 'OPEN' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                            {labelOf(REPORT_STATUS_LABELS, report.reportStatus)}
                                        </span>
                                    </div>
                                    <p className="mb-6 text-sm font-bold text-slate-700 leading-relaxed">{report.reason} <span className="text-slate-400 font-medium">{report.detail ? `- ${report.detail}` : ""}</span></p>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            className="flex-1 rounded-2xl bg-slate-50 py-2.5 text-[11px] font-black text-slate-600 hover:bg-primary-50 hover:text-primary-600 transition-all disabled:cursor-not-allowed disabled:opacity-60"
                                            disabled={reportActionsDisabled}
                                            onClick={() => updateReportStatus(reportId, "IN_REVIEW")}
                                        >
                                            {reportActionLoading("IN_REVIEW") ? "처리 중..." : "검토 중"}
                                        </button>
                                        <button
                                            className="flex-1 rounded-2xl bg-emerald-50 py-2.5 text-[11px] font-black text-emerald-600 hover:bg-emerald-100 transition-all disabled:cursor-not-allowed disabled:opacity-60"
                                            disabled={reportActionsDisabled}
                                            onClick={() => updateReportStatus(reportId, "RESOLVED")}
                                        >
                                            {reportActionLoading("RESOLVED") ? "처리 중..." : "해결"}
                                        </button>
                                        <button
                                            className="flex-1 rounded-2xl bg-rose-50 py-2.5 text-[11px] font-black text-rose-600 hover:bg-rose-100 transition-all disabled:cursor-not-allowed disabled:opacity-60"
                                            disabled={reportActionsDisabled}
                                            onClick={() => updateReportStatus(reportId, "REJECTED")}
                                        >
                                            {reportActionLoading("REJECTED") ? "처리 중..." : "반려"}
                                        </button>
                                    </div>
                                </div>
                            )})}
                        </div>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="card p-8">
                    <div className="mb-8 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-black text-slate-900 tracking-tight">권한 관리</h2>
                            <span className={`rounded-xl px-3 py-1 text-[10px] font-black tracking-widest uppercase ${isMaster ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                {isMaster ? ROLE_ACCESS_LABELS.MASTER : ROLE_ACCESS_LABELS.ADMIN}
                            </span>
                        </div>
                        <button
                            type="button"
                            className="text-slate-300 hover:text-primary-600 transition-colors disabled:cursor-not-allowed disabled:text-slate-300"
                            onClick={refreshRoleMembers}
                            disabled={!isMaster || roleMemberLoading}
                            aria-label="권한 관리 회원 목록 새로고침"
                            title="권한 관리 회원 목록 새로고침"
                        >
                            <RefreshCw className={`h-4 w-4 ${roleMemberLoading ? "animate-spin" : ""}`} />
                        </button>
                    </div>
                    {!isMaster && (
                        <div className="mb-6 rounded-2xl bg-amber-50 p-4 text-[11px] font-bold text-amber-700 leading-relaxed">
                            마스터 권한만 관리자 권한을 부여하거나 회수할 수 있습니다.
                        </div>
                    )}
                    <div className="mb-8 flex gap-3">
                        <div className="relative flex-1">
                            <input
                                value={roleKeyword}
                                onChange={(e) => setRoleKeyword(e.target.value.slice(0, MEMBER_SEARCH_KEYWORD_MAX_LENGTH))}
                                maxLength={MEMBER_SEARCH_KEYWORD_MAX_LENGTH}
                                placeholder="이름 또는 이메일 검색"
                                disabled={!isMaster || roleMemberLoading}
                                className="input-base w-full pl-4 pr-10 disabled:cursor-not-allowed disabled:text-slate-300"
                            />
                            <p className="mt-1 text-right text-[11px] font-semibold text-slate-400">
                                검색어 {roleKeyword.length}/{MEMBER_SEARCH_KEYWORD_MAX_LENGTH}자
                            </p>
                        </div>
                        <button
                            type="button"
                            className="btn-primary py-2.5 px-6 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={searchRoleMembers}
                            disabled={!isMaster || roleMemberLoading}
                        >
                            {roleMemberLoading ? "검색 중..." : "검색"}
                        </button>
                    </div>
                    {roleMemberError ? (
                        <div role="alert" className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-600">
                            {roleMemberError}
                        </div>
                    ) : null}

                    {!roleMembers.items?.length ? (
                        <div className="flex flex-col items-center justify-center h-64 rounded-[2rem] bg-slate-50/50 text-slate-400 font-bold text-sm">
                            {roleMemberLoading ? "회원을 불러오는 중입니다." : "회원이 없습니다."}
                        </div>
                    ) : (
                        <div className="space-y-4 max-h-[600px] overflow-auto pr-2">
                            {roleMembers.items.map((member) => (
                                <div key={getMemberIdValue(member) || member.email} className="group p-6 rounded-3xl border border-slate-100 bg-white hover:shadow-xl transition-all duration-300">
                                    <div className="mb-4 flex items-center justify-between">
                                        <div className="space-y-1">
                                            <div className="text-base font-black text-slate-900">{member.name || "(이름 없음)"}</div>
                                            <div className="text-xs font-bold text-slate-400">{member.email} <span className="ml-2">#{getMemberIdValue(member)}</span></div>
                                        </div>
                                        <span className={`px-2 py-1 rounded-lg text-[9px] font-black tracking-widest uppercase ${member.memberStatus === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                                            {labelOf(MEMBER_STATUS_LABELS, member.memberStatus)}
                                        </span>
                                    </div>
                                    <div className="mb-6 flex flex-wrap gap-1.5">
                                        {(member.roles || []).map((role) => (
                                            <span key={`${getMemberIdValue(member)}-${role}`} className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                                                {roleLabelOf(role)}
                                            </span>
                                        ))}
                                    </div>
                                    <button
                                        className={`w-full rounded-2xl py-3 text-xs font-black transition-all ${hasAdminRole(member.roles) ? "bg-rose-50 text-rose-600 hover:bg-rose-100" : "bg-primary-50 text-primary-600 hover:bg-primary-100"}`}
                                        onClick={() => updateMemberAdminRole(member)}
                                        disabled={!isMaster}
                                    >
                                        {hasAdminRole(member.roles) ? "관리자 권한 해제" : "관리자 권한 부여"}
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
                        <button
                            type="button"
                            className="text-slate-300 hover:text-primary-600 disabled:cursor-not-allowed disabled:text-slate-300"
                            onClick={fetchRoleAudits}
                            disabled={roleAuditLoading}
                            aria-label="권한 변경 이력 새로고침"
                            title="권한 변경 이력 새로고침"
                        >
                            <RefreshCw className={`h-4 w-4 ${roleAuditLoading ? "animate-spin" : ""}`} />
                        </button>
                    </div>
                    {roleAuditError ? (
                        <div role="alert" className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-600">
                            {roleAuditError}
                        </div>
                    ) : null}
                    {!roleAudits.items?.length ? (
                        <div className="flex flex-col items-center justify-center h-64 rounded-[2rem] bg-slate-50/50 text-slate-400 font-bold text-sm">
                            {roleAuditLoading ? "권한 변경 이력을 불러오는 중입니다." : "권한 변경 이력이 없습니다."}
                        </div>
                    ) : (
                        <div className="space-y-4 max-h-[700px] overflow-auto pr-2">
                            {roleAudits.items.map((audit) => (
                                <div key={audit.roleAuditId} className="p-6 rounded-3xl bg-slate-50/30 border border-slate-50">
                                    <div className="mb-4 flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-slate-400">
                                        <span>#{audit.roleAuditId}</span>
                                        <span>{audit.createdAt}</span>
                                    </div>
                                    <div className="mb-4 space-y-2">
                                        <div className="text-[13px] font-bold text-slate-900"><span className="text-slate-400">대상:</span> {audit.targetEmail} (#{audit.targetMemberId})</div>
                                        <div className="text-[13px] font-bold text-slate-900"><span className="text-slate-400">처리자:</span> {audit.changedByEmail}</div>
                                    </div>
                                    <div className="mb-4 flex items-center gap-3 py-3 px-4 rounded-2xl bg-white shadow-sm font-black text-xs">
                                        <ArrowRight className="h-3 w-3 text-primary-400" />
                                        <span className="text-primary-600">{roleListLabelOf(audit.afterRoles)}</span>
                                    </div>
                                    <div className="text-[12px] font-bold text-slate-500 italic"><span className="text-slate-300 font-medium">사유:</span> {audit.changeReason || "(없음)"}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="card p-8 overflow-hidden">
                <div className="mb-10 flex flex-wrap items-center justify-between gap-6">
                    <div className="space-y-1">
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">이상징후 사건함</h2>
                        <p className="text-sm font-medium text-slate-400">사건을 검토하고 담당자 배정, 상태 변경, 즉시 조치를 처리합니다.</p>
                    </div>
                    <div className="flex items-center gap-4 rounded-3xl bg-slate-50 p-2">
                        <span className="ml-4 text-[11px] font-black text-slate-400 tracking-widest">상태 필터</span>
                        <select
                            value={statusFilter}
                            onChange={(e) => changeFilter(e.target.value)}
                            className="input-base py-2 px-6 w-auto rounded-2xl border-0 bg-white shadow-sm text-sm font-black"
                        >
                            {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>{labelOf(INCIDENT_STATUS_LABELS, status)}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {!incidentList.items?.length ? (
                    <div className="flex flex-col items-center justify-center h-64 rounded-[2rem] bg-slate-50/50 text-slate-400 font-bold text-sm">사건이 없습니다.</div>
                ) : (
                    <div className="overflow-x-auto -mx-8">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-50/50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                <tr>
                                    <th className="px-8 py-5 text-left">ID</th>
                                    <th className="px-8 py-5 text-left">감지 지표</th>
                                    <th className="px-8 py-5 text-left">대상 정보</th>
                                    <th className="px-8 py-5 text-left">처리 상태</th>
                                    <th className="px-8 py-5 text-left">담당자 / 메모</th>
                                    <th className="px-8 py-5 text-right">즉시 조치</th>
                                </tr>
                            </thead>
                            <tbody className="font-bold text-slate-600">
                                {incidentList.items.map((item) => {
                                    const draft = incidentDrafts[item.incidentId] || {
                                        incidentStatus: item.incidentStatus,
                                        assignee: item.assignee || "",
                                        note: item.note || "",
                                    };
                                    const actionApplying = isIncidentActionApplying(item.incidentId);

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
                                                        <option key={status} value={status}>{labelOf(INCIDENT_STATUS_LABELS, status)}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-8 py-6 space-y-2">
                                                <input
                                                    className="input-base py-2 px-4 w-full rounded-xl border-0 bg-white shadow-sm text-[12px] font-bold"
                                                    value={draft.assignee}
                                                    placeholder="담당자"
                                                    maxLength={ADMIN_ANOMALY_TEXT_LIMITS.incidentAssignee}
                                                    onChange={(e) => setIncidentDrafts((prev) => ({
                                                        ...prev,
                                                        [item.incidentId]: { ...draft, assignee: e.target.value.slice(0, ADMIN_ANOMALY_TEXT_LIMITS.incidentAssignee) },
                                                    }))}
                                                />
                                                <textarea
                                                    className="input-base py-2 px-4 w-full rounded-xl border-0 bg-white shadow-sm text-[12px] font-medium"
                                                    rows={1}
                                                    value={draft.note}
                                                    placeholder="관리자 메모"
                                                    maxLength={ADMIN_ANOMALY_TEXT_LIMITS.incidentNote}
                                                    onChange={(e) => setIncidentDrafts((prev) => ({
                                                        ...prev,
                                                        [item.incidentId]: { ...draft, note: e.target.value.slice(0, ADMIN_ANOMALY_TEXT_LIMITS.incidentNote) },
                                                    }))}
                                                />
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-wrap justify-end gap-2">
                                                    <div className="flex gap-1.5 bg-white p-1 rounded-2xl shadow-sm">
                                                        <button className="p-2 rounded-xl hover:bg-primary-50 text-slate-300 hover:text-primary-600 transition-all" onClick={() => fetchDetail(item.incidentId)} title="상세 보기"><Activity className="h-4 w-4" /></button>
                                                        <button
                                                            className="p-2 rounded-xl hover:bg-rose-50 text-slate-300 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 transition-all"
                                                            onClick={() => applyAction(item.incidentId, "BLOCK_QUEUE_USER")}
                                                            title={actionApplying ? "조치 처리 중" : "대기열 차단"}
                                                            disabled={actionApplying}
                                                        >
                                                            {isIncidentActionApplying(item.incidentId, "BLOCK_QUEUE_USER") ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />}
                                                        </button>
                                                        <button
                                                            className="p-2 rounded-xl hover:bg-amber-50 text-slate-300 hover:text-amber-600 disabled:cursor-not-allowed disabled:opacity-40 transition-all"
                                                            onClick={() => applyAction(item.incidentId, "WARN_MEMBER")}
                                                            title={actionApplying ? "조치 처리 중" : "회원 경고"}
                                                            disabled={actionApplying}
                                                        >
                                                            {isIncidentActionApplying(item.incidentId, "WARN_MEMBER") ? <RefreshCw className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
                                                        </button>
                                                    </div>
                                                    <button
                                                        className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 text-[12px] font-black text-white hover:bg-primary-600 disabled:opacity-20 transition-all duration-300"
                                                        disabled={savingIncidentId === item.incidentId}
                                                        onClick={() => saveIncidentInline(item.incidentId)}
                                                    >
                                                        {savingIncidentId === item.incidentId ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Save className="h-3.5 w-3.5" />} 
                                                        저장
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
                    <span className="text-xs font-black text-slate-400 tracking-widest">총 {toNumber(incidentList.totalElements)}건</span>
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
                            <h2 className="text-3xl font-black tracking-tight">사건 상세 분석 <span className="text-primary-400">#{selectedDetail.incident.incidentId}</span></h2>
                            <p className="text-sm font-medium text-slate-400">사건 세부 정보, 조치 이력, 판단 근거를 확인합니다.</p>
                        </div>
                        <button className="text-slate-500 hover:text-white transition-colors" onClick={() => setSelectedDetail(null)}><X className="h-8 w-8" /></button>
                    </div>
                    
                    <div className="mb-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                        {[
                            { label: "감지 지표", val: selectedDetail.incident.metric, color: "text-primary-400" },
                            { label: "대상", val: selectedDetail.incident.actorId, color: "text-white" },
                            { label: "현재 상태", val: labelOf(INCIDENT_STATUS_LABELS, selectedDetail.incident.incidentStatus), color: "text-amber-400" },
                            { label: "Z-Score 분석", val: selectedDetail.incident.zScore, color: "text-rose-400" },
                        ].map(stat => (
                            <div key={stat.label} className="p-6 rounded-[2rem] bg-white/5 border border-white/10">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{stat.label}</p>
                                <p className={`text-xl font-black tracking-tight ${stat.color}`}>{stat.val}</p>
                            </div>
                        ))}
                    </div>

                    <div className="mb-12 space-y-4">
                        <h3 className="text-xs font-black text-slate-500 tracking-widest px-2">판단 조치</h3>
                        <div className="flex flex-wrap gap-4">
                            <button
                                className="flex-1 rounded-[2rem] bg-primary-600 py-6 text-sm font-black hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50 transition-all shadow-xl shadow-primary-900/40"
                                onClick={() => applyAction(selectedDetail.incident.incidentId, "BLOCK_QUEUE_USER")}
                                disabled={isIncidentActionApplying(selectedDetail.incident.incidentId)}
                            >
                                {isIncidentActionApplying(selectedDetail.incident.incidentId, "BLOCK_QUEUE_USER") ? "처리 중..." : "대기열 차단"}
                            </button>
                            <button
                                className="flex-1 rounded-[2rem] bg-white/5 border border-white/10 py-6 text-sm font-black hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                                onClick={() => applyAction(selectedDetail.incident.incidentId, "WARN_MEMBER")}
                                disabled={isIncidentActionApplying(selectedDetail.incident.incidentId)}
                            >
                                {isIncidentActionApplying(selectedDetail.incident.incidentId, "WARN_MEMBER") ? "처리 중..." : "회원 경고"}
                            </button>
                            <button
                                className="flex-1 rounded-[2rem] bg-white/5 border border-white/10 py-6 text-sm font-black hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                                onClick={() => applyAction(selectedDetail.incident.incidentId, "CLEAR_QUEUE_BLOCK")}
                                disabled={isIncidentActionApplying(selectedDetail.incident.incidentId)}
                            >
                                {isIncidentActionApplying(selectedDetail.incident.incidentId, "CLEAR_QUEUE_BLOCK") ? "처리 중..." : "접근 복구"}
                            </button>
                        </div>
                    </div>

                    <div className="rounded-[2.5rem] bg-black/30 p-10">
                        <h3 className="mb-8 flex items-center gap-3 text-lg font-black tracking-tight">
                            <History className="h-5 w-5 text-primary-400" />
                            조치 타임라인
                        </h3>
                        {!selectedDetail.actions?.length ? (
                            <div className="flex flex-col items-center justify-center h-48 text-slate-600 font-bold italic">이 사건의 조치 기록이 없습니다.</div>
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
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">탐지 규칙 관리</h2>
                        <p className="text-[12px] font-medium text-slate-400 tracking-widest">전역 임계값 설정</p>
                    </div>
                </div>

                <div className="mb-12 grid grid-cols-1 gap-4 rounded-[2.5rem] bg-slate-50/50 p-6 sm:grid-cols-5 sm:items-center border-2 border-dashed border-slate-200">
                    <div className="px-2">
                        <p className="text-[10px] font-black text-slate-400 tracking-[0.2em] mb-2 ml-1">지표 이름</p>
                        <input
                            className="input-base border-0 shadow-sm rounded-2xl font-bold"
                            placeholder="예: login.attempt"
                            value={newRule.metric}
                            onChange={(e) => setNewRule((prev) => ({ ...prev, metric: e.target.value.slice(0, ADMIN_ANOMALY_TEXT_LIMITS.ruleMetric) }))}
                            maxLength={ADMIN_ANOMALY_TEXT_LIMITS.ruleMetric}
                        />
                    </div>
                    <div className="px-2">
                        <p className="text-[10px] font-black text-slate-400 tracking-[0.2em] mb-2 ml-1">분당 상한</p>
                        <input
                            type="number"
                            min={1}
                            className="input-base border-0 shadow-sm rounded-2xl font-bold"
                            value={newRule.hardLimitPerMinute}
                            onChange={(e) => setNewRule((prev) => ({ ...prev, hardLimitPerMinute: e.target.value }))}
                        />
                    </div>
                    <div className="px-2">
                        <p className="text-[10px] font-black text-slate-400 tracking-[0.2em] mb-2 ml-1">Z 임계값</p>
                        <input
                            type="number"
                            min={0.1}
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
                            <span className="text-[11px] font-black tracking-widest text-slate-400 group-hover:text-primary-600 transition-colors">사용</span>
                        </label>
                    </div>
                    <div className="pt-4 sm:pt-6 px-2">
                        <button className="w-full btn-primary shadow-xl shadow-primary-200" onClick={createRule}>
                            <PlusCircle className="mr-2 h-4 w-4" /> 규칙 생성
                        </button>
                    </div>
                </div>
                
                {!rules.length ? (
                    <div className="flex flex-col items-center justify-center h-48 rounded-[2rem] bg-slate-50/50 text-slate-400 font-bold text-sm">탐지 규칙이 없습니다.</div>
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
                                        <p className="text-[9px] font-black text-slate-400 mb-2">분당 상한</p>
                                        <input
                                            type="number"
                                            min={1}
                                            className="input-base py-2.5 px-4 bg-slate-50/50 border-0 rounded-xl font-black text-sm"
                                            value={draft.hardLimitPerMinute}
                                            onChange={(e) => setRuleDrafts((prev) => ({
                                                ...prev,
                                                [rule.metric]: { ...draft, hardLimitPerMinute: e.target.value },
                                            }))}
                                        />
                                    </div>
                                    <div className="px-2">
                                        <p className="text-[9px] font-black text-slate-400 mb-2">Z 점수</p>
                                        <input
                                            type="number"
                                            min={0.1}
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
                                            수정
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {releaseDialog.open && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) closeReleaseDialog();
                    }}
                >
                    <div
                        ref={releaseDialogRef}
                        className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={releaseDialogTitleId}
                        aria-describedby={releaseDialogDescriptionId}
                    >
                        <span id={releaseDialogTitleId} className="sr-only">제재 해제</span>
                        <div className="mb-4 flex items-start justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-black text-slate-900">제재 해제</h3>
                                <p id={releaseDialogDescriptionId} className="mt-1 text-sm text-slate-500">
                                    대상: {releaseDialog.memberEmail || `#${releaseDialog.sanctionId}`}
                                </p>
                            </div>
                            <button
                                ref={releaseDialogCloseRef}
                                type="button"
                                autoFocus
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                                onClick={closeReleaseDialog}
                                disabled={releasingSanctionId !== null}
                                title="닫기"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <label htmlFor={releaseReasonInputId} className="sr-only">제재 해제 사유</label>
                        <textarea
                            id={releaseReasonInputId}
                            className="input-base min-h-[110px] w-full"
                            value={releaseReasonInput}
                            onChange={(e) => setReleaseReasonInput(e.target.value.slice(0, ADMIN_ANOMALY_TEXT_LIMITS.sanctionReason))}
                            placeholder="해제 사유를 입력하세요"
                            disabled={releasingSanctionId !== null}
                            maxLength={ADMIN_ANOMALY_TEXT_LIMITS.sanctionReason}
                        />
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={closeReleaseDialog}
                                disabled={releasingSanctionId !== null}
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={confirmReleaseDialog}
                                disabled={releasingSanctionId !== null}
                            >
                                {releasingSanctionId !== null ? "해제 중..." : "지금 해제"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};







