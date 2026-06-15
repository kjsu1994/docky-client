import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    Activity,
    AlertTriangle,
    Ban,
    Bell,
    CheckCircle2,
    ChevronRight,
    ClipboardCheck,
    Clock,
    EyeOff,
    FileText,
    Film,
    Flag,
    Gavel,
    Inbox,
    Megaphone,
    RefreshCw,
    RotateCcw,
    Search,
    ShieldCheck,
    SlidersHorizontal,
    UserRound,
    Users,
    XCircle,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { hasRole, isAdminUser } from "../../utils/authorization.js";
import { adminAnomaliesAdapter, adminAnomaliesErrorMessage, ADMIN_ANOMALY_TEXT_LIMITS } from "../../adapters/adminAnomaliesAdapter.js";
import { adminOperationsAdapter, adminOperationsErrorMessage, MEMBER_SEARCH_KEYWORD_MAX_LENGTH } from "../../adapters/adminOperationsAdapter.js";
import { streamingAdapter, streamingErrorMessage } from "../../adapters/streamingAdapter.js";
import { confirmAction } from "../../common/confirmAction.jsx";
import { promptAction } from "../../common/promptAction.jsx";
import { notifyError, notifyLoading, notifySuccess } from "../../utils/toast.js";

const REPORT_STATUS_LABELS = {
    OPEN: "접수",
    IN_REVIEW: "검토 중",
    RESOLVED: "해결",
    REJECTED: "반려",
};

const INCIDENT_STATUS_LABELS = {
    NEW: "신규",
    REVIEWING: "검토 중",
    RESOLVED: "해결",
    FALSE_POSITIVE: "오탐",
};

const SANCTION_STATUS_LABELS = {
    ACTIVE: "진행 중",
    EXPIRED: "만료",
    RELEASED: "해제",
    CANCELLED: "취소",
};

const ROLE_LABELS = {
    ROLE_USER: "회원",
    ROLE_ADMIN: "관리자",
    ROLE_MASTER: "마스터",
};

const SOURCE_LABELS = {
    realtimeOperations: "Realtime",
    summary: "통계",
    events: "이벤트",
    kpi: "KPI",
    rules: "규칙",
    incidents: "사건",
    notifications: "알림",
    reports: "신고",
    sanctions: "제재",
    releaseRequests: "해제 요청",
    moderationBoards: "게시글",
    moderationComments: "댓글",
    audits: "감사",
    roleMembers: "권한 회원",
    roleAudits: "권한 감사",
    banners: "배너",
    videos: "영상",
    inboxFiles: "인박스",
};

const EMPTY_PAGE = Object.freeze({ items: [], totalElements: 0, unreadCount: 0 });

const DEFAULT_DASHBOARD = Object.freeze({
    realtimeOperations: null,
    summary: null,
    events: [],
    kpi: null,
    rules: [],
    incidents: EMPTY_PAGE,
    notifications: EMPTY_PAGE,
    reports: EMPTY_PAGE,
    sanctions: EMPTY_PAGE,
    releaseRequests: EMPTY_PAGE,
    moderationBoards: EMPTY_PAGE,
    moderationComments: EMPTY_PAGE,
    audits: EMPTY_PAGE,
    roleMembers: EMPTY_PAGE,
    roleAudits: EMPTY_PAGE,
    sources: {},
});

const pick = (obj, ...keys) => {
    if (!obj || typeof obj !== "object") return undefined;
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined && obj[key] !== null) {
            return obj[key];
        }
    }
    return undefined;
};

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const toPositiveId = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const itemsOf = (page) => Array.isArray(page?.items) ? page.items : [];

const totalOf = (page) => Math.max(itemsOf(page).length, toNumber(page?.totalElements ?? page?.total_elements));

const formatNumber = (value) => toNumber(value).toLocaleString("ko-KR");

const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("ko-KR", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
};

const formatFileSize = (bytes) => {
    const size = toNumber(bytes);
    if (size <= 0) return "-";
    if (size >= 1024 * 1024 * 1024) return `${(size / 1024 / 1024 / 1024).toFixed(1)}GB`;
    if (size >= 1024 * 1024) return `${Math.round(size / 1024 / 1024)}MB`;
    return `${Math.max(1, Math.round(size / 1024))}KB`;
};

const relativeTime = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.max(0, Math.floor(diffMs / 60_000));
    if (minutes < 1) return "방금";
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
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

const parseReleaseRequest = (item) => {
    const payload = parseJsonSafe(pick(item, "payload", "payloadJson", "payload_json", "metadata", "data"));
    const message = String(pick(item, "message", "contents", "content", "description", "body") || "");
    const sanctionMatch = message.match(/sanctionId\s*=\s*(\d+)/i);
    const memberMatch = message.match(/member\s*=\s*([^,]+)/i);
    const requestReasonMatch = message.match(/requestReason\s*=\s*(.+)$/i);
    const sanctionReasonMatch = message.match(/sanctionReason\s*=\s*([^,]+)/i);

    return {
        sanctionId: toPositiveId(
            pick(item, "sanctionId", "sanction_id") ||
            pick(payload, "sanctionId", "sanction_id") ||
            (sanctionMatch ? sanctionMatch[1] : null),
        ),
        notificationId: toPositiveId(pick(item, "notificationId", "notification_id")),
        memberEmail: String(
            pick(item, "memberEmail", "member_email", "email") ||
            pick(payload, "memberEmail", "member_email", "email") ||
            (memberMatch ? memberMatch[1] : ""),
        ).trim(),
        requestReason: String(
            pick(item, "requestReason", "request_reason") ||
            pick(payload, "requestReason", "request_reason") ||
            (requestReasonMatch ? requestReasonMatch[1] : ""),
        ).trim(),
        sanctionReason: String(
            pick(item, "sanctionReason", "sanction_reason") ||
            pick(payload, "sanctionReason", "sanction_reason") ||
            (sanctionReasonMatch ? sanctionReasonMatch[1] : ""),
        ).trim(),
    };
};

const safeInternalLink = (value) => {
    const link = String(value || "").trim();
    if (!link || link.length > 300 || link.startsWith("//")) return "";
    if (/[\\\r\n"'<>]/.test(link)) return "";
    return link === "/app" || link.startsWith("/app/") ? link : "";
};

const getIncidentId = (incident) => toPositiveId(pick(incident, "incidentId", "incident_id", "id"));
const getReportId = (report) => toPositiveId(pick(report, "reportId", "report_id", "id"));
const getBoardId = (board) => toPositiveId(pick(board, "boardId", "board_id", "id"));
const getCommentId = (comment) => toPositiveId(pick(comment, "commentId", "comment_id", "id"));
const getNotificationId = (notification) => toPositiveId(pick(notification, "notificationId", "notification_id", "id"));
const getMemberId = (member) => toPositiveId(pick(member, "memberId", "member_id", "id", "memberNo", "member_no"));
const getSanctionId = (sanction) => toPositiveId(pick(sanction, "sanctionId", "sanction_id", "id"));

const isHidden = (target) => {
    const value = pick(target, "hiddenYn", "hidden_yn");
    return value === true || value === "Y";
};

const roleLabels = (roles) => {
    if (!Array.isArray(roles) || !roles.length) return ["회원"];
    return roles.map((role) => ROLE_LABELS[role] || role).filter(Boolean);
};

const queueTone = {
    critical: "border-rose-200 bg-rose-50 text-rose-800",
    high: "border-amber-200 bg-amber-50 text-amber-800",
    medium: "border-sky-200 bg-sky-50 text-sky-800",
    low: "border-slate-200 bg-slate-50 text-slate-700",
};

const sourceStatusClass = (source) => {
    if (source?.skipped) return "border-slate-200 bg-slate-50 text-slate-500";
    if (source?.ok) return "border-emerald-200 bg-emerald-50 text-emerald-700";
    return "border-rose-200 bg-rose-50 text-rose-700";
};

const iconButtonClass = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-control border border-line bg-surface/85 px-3 text-xs font-black text-ink shadow-card backdrop-blur-md transition hover:border-primary-200 hover:bg-control hover:text-primary-700 disabled:opacity-50";
const primaryButtonClass = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-control bg-primary-600 px-3 text-xs font-black text-white shadow-card transition hover:bg-primary-700 disabled:opacity-50";
const dangerButtonClass = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-control bg-rose-600 px-3 text-xs font-black text-white shadow-card transition hover:bg-rose-700 disabled:opacity-50";

const SectionHeader = ({ icon: Icon, title, count, action }) => (
    <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
                <h2 className="truncate text-base font-black text-slate-950">{title}</h2>
                {count !== undefined ? <p className="text-xs font-bold text-slate-500">{formatNumber(count)}건</p> : null}
            </div>
        </div>
        {action}
    </div>
);

const MetricTile = ({ icon: Icon, label, value, tone = "slate", title, hint = "" }) => {
    const tones = {
        slate: "border-slate-200 bg-white text-slate-900",
        sky: "border-sky-200 bg-sky-50 text-sky-900",
        emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
        amber: "border-amber-200 bg-amber-50 text-amber-900",
        rose: "border-rose-200 bg-rose-50 text-rose-900",
        violet: "border-violet-200 bg-violet-50 text-violet-900",
    };

    return (
        <div className={`rounded-card border p-4 shadow-card ${tones[tone] || tones.slate}`} title={title || label}>
            <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black uppercase text-slate-500">{label}</span>
                <Icon className="h-4 w-4 opacity-70" />
            </div>
            <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
            {hint ? <div className="mt-1 text-[10px] font-black uppercase tracking-wide opacity-70">{hint}</div> : null}
        </div>
    );
};

const EmptyState = ({ icon: Icon = CheckCircle2, title, text }) => (
    <div className="flex min-h-28 flex-col items-center justify-center rounded-card border border-dashed border-line bg-control/70 p-5 text-center">
        <Icon className="h-6 w-6 text-slate-400" />
        <div className="mt-2 text-sm font-black text-slate-700">{title}</div>
        {text ? <div className="mt-1 text-xs font-bold text-slate-500">{text}</div> : null}
    </div>
);

const SourceHealth = ({ sources }) => {
    const entries = Object.entries(SOURCE_LABELS).map(([key, fallbackLabel]) => ({
        key,
        label: sources?.[key]?.label || fallbackLabel,
        source: sources?.[key],
    }));

    return (
        <div className="surface-panel p-4">
            <SectionHeader icon={Activity} title="데이터 상태" />
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {entries.map(({ key, label, source }) => (
                    <span
                        key={key}
                        className={`inline-flex min-h-9 items-center justify-center rounded-lg border px-2 text-center text-[11px] font-black ${sourceStatusClass(source)}`}
                        title={source?.message || (source?.ok ? "정상 조회" : "아직 조회되지 않음")}
                    >
                        {source?.skipped ? "권한 밖 " : source?.ok ? "정상 " : "실패 "}
                        {label}
                    </span>
                ))}
            </div>
        </div>
    );
};

export const AdminCommandCenter = () => {
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

    const [dashboard, setDashboard] = useState(DEFAULT_DASHBOARD);
    const [banners, setBanners] = useState([]);
    const [videos, setVideos] = useState([]);
    const [inboxFiles, setInboxFiles] = useState([]);
    const [sources, setSources] = useState({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [lastRefreshAt, setLastRefreshAt] = useState(null);
    const [actionKey, setActionKey] = useState("");

    const [memberKeyword, setMemberKeyword] = useState("");
    const [memberCandidates, setMemberCandidates] = useState([]);
    const [memberSearchLoading, setMemberSearchLoading] = useState(false);
    const [memberSearchError, setMemberSearchError] = useState("");
    const [memberDetail, setMemberDetail] = useState(null);
    const [memberLoading, setMemberLoading] = useState(false);
    const [memberError, setMemberError] = useState("");

    const loadCommandCenter = async ({ silent = false } = {}) => {
        if (!isAdmin) return;
        if (silent) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        setError("");

        const contentSource = (key, ok, message = "") => ({
            key,
            label: SOURCE_LABELS[key],
            ok,
            skipped: false,
            message,
        });

        const [dashboardResult, bannersResult, videosResult, inboxResult] = await Promise.allSettled([
            adminAnomaliesAdapter.fetchCommandCenter({ isMaster }),
            adminOperationsAdapter.fetchBanners(),
            streamingAdapter.fetchAdminVideos({ silent: true, page: 1, size: 20 }),
            streamingAdapter.fetchAdminInboxFiles({ silent: true }),
        ]);

        const nextSources = {};
        const failures = [];

        if (dashboardResult.status === "fulfilled") {
            setDashboard({ ...DEFAULT_DASHBOARD, ...dashboardResult.value });
            Object.assign(nextSources, dashboardResult.value.sources || {});
        } else {
            failures.push(adminAnomaliesErrorMessage(dashboardResult.reason, "관리자 핵심 데이터를 불러오지 못했습니다."));
            setDashboard(DEFAULT_DASHBOARD);
        }

        if (bannersResult.status === "fulfilled") {
            setBanners(bannersResult.value);
            nextSources.banners = contentSource("banners", true);
        } else {
            setBanners([]);
            nextSources.banners = contentSource("banners", false, adminOperationsErrorMessage(bannersResult.reason, "배너 데이터를 불러오지 못했습니다."));
        }

        if (videosResult.status === "fulfilled") {
            setVideos(videosResult.value.items || []);
            nextSources.videos = contentSource("videos", true);
        } else {
            setVideos([]);
            nextSources.videos = contentSource("videos", false, streamingErrorMessage(videosResult.reason, "영상 데이터를 불러오지 못했습니다."));
        }

        if (inboxResult.status === "fulfilled") {
            setInboxFiles(inboxResult.value);
            nextSources.inboxFiles = contentSource("inboxFiles", true);
        } else {
            setInboxFiles([]);
            nextSources.inboxFiles = contentSource("inboxFiles", false, streamingErrorMessage(inboxResult.reason, "인박스 데이터를 불러오지 못했습니다."));
        }

        setSources(nextSources);
        setLastRefreshAt(new Date());
        if (failures.length) {
            setError(failures[0]);
        }
        setLoading(false);
        setRefreshing(false);
    };

    useEffect(() => {
        if (isAdmin) {
            loadCommandCenter();
        } else {
            setLoading(false);
        }
    }, [isAdmin, isMaster]);

    useEffect(() => {
        const keyword = memberKeyword.trim();
        if (!keyword) {
            setMemberCandidates([]);
            setMemberSearchError("");
            setMemberSearchLoading(false);
            return undefined;
        }
        const timer = window.setTimeout(async () => {
            setMemberSearchLoading(true);
            setMemberSearchError("");
            try {
                const results = await adminOperationsAdapter.fetchMemberCandidates(keyword);
                setMemberCandidates(results);
            } catch (err) {
                setMemberCandidates([]);
                setMemberSearchError(adminOperationsErrorMessage(err, "회원 후보를 찾지 못했습니다."));
            } finally {
                setMemberSearchLoading(false);
            }
        }, 250);
        return () => window.clearTimeout(timer);
    }, [memberKeyword]);

    const reloadMemberDetail = async (memberId) => {
        const normalizedMemberId = toPositiveId(memberId);
        if (!normalizedMemberId) {
            notifyError("회원 ID가 올바르지 않습니다.");
            return;
        }
        setMemberLoading(true);
        setMemberError("");
        try {
            const detail = await adminOperationsAdapter.fetchMemberDetail(normalizedMemberId);
            setMemberDetail(detail);
        } catch (err) {
            setMemberDetail(null);
            setMemberError(adminOperationsErrorMessage(err, "회원 상세를 불러오지 못했습니다."));
        } finally {
            setMemberLoading(false);
        }
    };

    const runAction = async (key, callback) => {
        if (actionKey) return;
        setActionKey(key);
        try {
            await callback();
        } finally {
            setActionKey("");
        }
    };

    const refreshAfterAction = async () => {
        await loadCommandCenter({ silent: true });
        const memberId = memberDetail?.memberInfo?.memberId;
        if (memberId) {
            await reloadMemberDetail(memberId);
        }
    };

    const handleIncidentStatus = async (incident, incidentStatus) => {
        const incidentId = getIncidentId(incident);
        if (!incidentId) {
            notifyError("사건 ID가 올바르지 않습니다.");
            return;
        }
        const note = await promptAction({
            title: incidentStatus === "RESOLVED" ? "사건 해결 메모" : "사건 검토 메모",
            description: "담당자가 다음에 이어서 볼 수 있게 판단 근거를 남깁니다.",
            label: "처리 메모",
            placeholder: "조치 근거와 확인한 내용을 입력하세요.",
            maxLength: ADMIN_ANOMALY_TEXT_LIMITS.incidentNote,
        });
        if (note === null) return;

        await runAction(`incident:${incidentId}:${incidentStatus}`, async () => {
            try {
                await adminAnomaliesAdapter.updateIncident(incidentId, {
                    incidentStatus,
                    assignee: user?.email || user?.name || "admin",
                    note,
                });
                notifySuccess("사건 상태를 변경했습니다.");
                await refreshAfterAction();
            } catch (err) {
                notifyError(adminAnomaliesErrorMessage(err, "사건 상태를 변경하지 못했습니다."));
            }
        });
    };

    const handleIncidentAction = async (incident, actionType) => {
        const incidentId = getIncidentId(incident);
        if (!incidentId) {
            notifyError("사건 ID가 올바르지 않습니다.");
            return;
        }
        const description = await promptAction({
            title: actionType === "BLOCK_QUEUE_USER" ? "대기열 차단 사유" : "운영 조치 설명",
            description: "조치 이력과 감사 로그에 남을 내용을 입력합니다.",
            label: "조치 설명",
            placeholder: "왜 이 조치가 필요한지 입력하세요.",
            required: true,
            maxLength: ADMIN_ANOMALY_TEXT_LIMITS.incidentActionDescription,
        });
        if (description === null) return;

        const payload = { actionType, description };
        if (actionType === "BLOCK_QUEUE_USER") {
            const blockMinutesInput = await promptAction({
                title: "차단 시간",
                label: "분",
                initialValue: "30",
                placeholder: "1-1440",
                inputMode: "numeric",
                required: true,
                maxLength: 4,
            });
            if (blockMinutesInput === null) return;
            payload.blockMinutes = Math.max(1, Math.min(1440, Number(blockMinutesInput) || 30));
        }

        await runAction(`incident-action:${incidentId}:${actionType}`, async () => {
            try {
                await adminAnomaliesAdapter.applyIncidentAction(incidentId, payload);
                notifySuccess("사건 조치를 실행했습니다.");
                await refreshAfterAction();
            } catch (err) {
                notifyError(adminAnomaliesErrorMessage(err, "사건 조치를 실행하지 못했습니다."));
            }
        });
    };

    const handleReportStatus = async (report, reportStatus) => {
        const reportId = getReportId(report);
        if (!reportId) {
            notifyError("신고 ID가 올바르지 않습니다.");
            return;
        }
        const adminNote = await promptAction({
            title: "신고 처리 메모",
            description: `${REPORT_STATUS_LABELS[reportStatus] || reportStatus} 상태로 변경합니다.`,
            label: "관리자 메모",
            placeholder: "판단 근거를 남겨 재문의와 감사에 대비하세요.",
            maxLength: ADMIN_ANOMALY_TEXT_LIMITS.reportAdminNote,
        });
        if (adminNote === null) return;

        await runAction(`report:${reportId}:${reportStatus}`, async () => {
            try {
                await adminAnomaliesAdapter.updateReportStatus(reportId, { reportStatus, adminNote });
                notifySuccess("신고 상태를 변경했습니다.");
                await refreshAfterAction();
            } catch (err) {
                notifyError(adminAnomaliesErrorMessage(err, "신고 상태를 변경하지 못했습니다."));
            }
        });
    };

    const handleNotificationRead = async (notification) => {
        const notificationId = getNotificationId(notification);
        if (!notificationId) {
            notifyError("알림 ID가 올바르지 않습니다.");
            return;
        }

        await runAction(`notification:${notificationId}`, async () => {
            try {
                await adminAnomaliesAdapter.markNotificationRead(notificationId);
                notifySuccess("알림을 읽음 처리했습니다.");
                await refreshAfterAction();
            } catch (err) {
                const missing = err?.response?.status === 404 || err?.response?.data?.code === "ADMIN_NOTIFICATION_NOT_FOUND";
                if (missing) {
                    notifySuccess("이미 처리된 알림을 목록에서 정리했습니다.");
                    await refreshAfterAction();
                    return;
                }
                notifyError(adminAnomaliesErrorMessage(err, "알림을 읽음 처리하지 못했습니다."));
            }
        });
    };

    const handleReleaseRequest = async (request) => {
        const parsed = parseReleaseRequest(request);
        if (!parsed.sanctionId) {
            notifyError("제재 해제 요청에서 제재 ID를 찾지 못했습니다.");
            return;
        }
        const reason = await promptAction({
            title: "제재 해제 사유",
            description: parsed.memberEmail ? `${parsed.memberEmail} 회원의 제재를 해제합니다.` : "제재 해제 기록에 남을 사유를 입력합니다.",
            label: "해제 사유",
            placeholder: "해제 승인 근거를 입력하세요.",
            required: true,
            maxLength: ADMIN_ANOMALY_TEXT_LIMITS.sanctionReason,
        });
        if (reason === null) return;

        await runAction(`release:${parsed.sanctionId}`, async () => {
            const loadingToast = await notifyLoading("제재를 해제하는 중입니다...");
            try {
                await adminAnomaliesAdapter.releaseSanction(parsed.sanctionId, {
                    reason,
                    notificationId: parsed.notificationId,
                });
                if (parsed.notificationId) {
                    await adminAnomaliesAdapter.markNotificationRead(parsed.notificationId).catch(() => {});
                }
                loadingToast.success("제재를 해제했습니다.");
                await refreshAfterAction();
            } catch (err) {
                loadingToast.error(adminAnomaliesErrorMessage(err, "제재 해제에 실패했습니다."));
            }
        });
    };

    const handleModeration = async ({ targetType, item, hiddenYn }) => {
        const id = targetType === "BOARD" ? getBoardId(item) : getCommentId(item);
        if (!id) {
            notifyError(targetType === "BOARD" ? "게시글 ID가 올바르지 않습니다." : "댓글 ID가 올바르지 않습니다.");
            return;
        }
        const reason = await promptAction({
            title: hiddenYn ? "숨김 처리 사유" : "복구 처리 사유",
            description: targetType === "BOARD" ? "게시글 표시 상태를 변경합니다." : "댓글 표시 상태를 변경합니다.",
            label: "처리 사유",
            placeholder: hiddenYn ? "숨김이 필요한 이유를 입력하세요." : "복구가 가능한 이유를 입력하세요.",
            maxLength: ADMIN_ANOMALY_TEXT_LIMITS.moderationReason,
        });
        if (reason === null) return;

        await runAction(`moderation:${targetType}:${id}`, async () => {
            try {
                if (targetType === "BOARD") {
                    await adminAnomaliesAdapter.updateBoardHidden(id, { hiddenYn, reason });
                } else {
                    await adminAnomaliesAdapter.updateCommentHidden(id, { hiddenYn, reason });
                }
                notifySuccess(hiddenYn ? "숨김 처리했습니다." : "공개 상태로 복구했습니다.");
                await refreshAfterAction();
            } catch (err) {
                notifyError(adminAnomaliesErrorMessage(err, "표시 상태를 변경하지 못했습니다."));
            }
        });
    };

    const handleBannerActive = async (banner) => {
        const bannerId = toPositiveId(banner?.bannerId);
        if (!bannerId) {
            notifyError("배너 ID가 올바르지 않습니다.");
            return;
        }
        const nextActive = !Boolean(banner.activeYn);
        await runAction(`banner:${bannerId}`, async () => {
            const loadingToast = await notifyLoading(nextActive ? "배너를 활성화하는 중입니다..." : "배너를 비활성화하는 중입니다...");
            try {
                await adminOperationsAdapter.updateBannerActive({ bannerId, activeYn: nextActive });
                loadingToast.success(nextActive ? "배너를 활성화했습니다." : "배너를 비활성화했습니다.");
                await refreshAfterAction();
            } catch (err) {
                loadingToast.error(adminOperationsErrorMessage(err, "배너 상태를 변경하지 못했습니다."));
            }
        });
    };

    const handleInboxImport = async (file) => {
        if (!file?.fileName || !file.ready) {
            notifyError("반입할 수 있는 준비 완료 파일만 선택할 수 있습니다.");
            return;
        }
        const confirmed = await confirmAction({
            title: "인박스 파일을 반입할까요?",
            description: `${file.fileName} 파일을 스트리밍 변환 큐에 등록합니다.`,
            confirmText: "반입",
            tone: "default",
        });
        if (!confirmed) return;

        await runAction(`inbox:${file.fileName}`, async () => {
            const loadingToast = await notifyLoading("인박스 파일을 반입하는 중입니다...");
            try {
                await streamingAdapter.importAdminInboxFiles({ fileNames: [file.fileName], description: "" });
                loadingToast.success("변환 큐에 등록했습니다.");
                await refreshAfterAction();
            } catch (err) {
                loadingToast.error(streamingErrorMessage(err, "인박스 파일을 반입하지 못했습니다."));
            }
        });
    };

    const handleCreateMemberSanction = async () => {
        const memberId = memberDetail?.memberInfo?.memberId;
        if (!memberId) {
            notifyError("제재할 회원을 먼저 선택하세요.");
            return;
        }
        const activeExists = memberDetail.sanctions?.some((sanction) => String(sanction.sanctionStatus).toUpperCase() === "ACTIVE");
        if (activeExists) {
            notifyError("이미 진행 중인 제재가 있는 회원입니다.");
            return;
        }
        const reason = await promptAction({
            title: "회원 제재 사유",
            description: `${memberDetail.memberInfo.email} 회원에게 제재를 등록합니다.`,
            label: "제재 사유",
            placeholder: "정책 위반 내용과 근거를 입력하세요.",
            required: true,
            maxLength: ADMIN_ANOMALY_TEXT_LIMITS.sanctionReason,
        });
        if (reason === null) return;
        const daysInput = await promptAction({
            title: "제재 기간",
            label: "일수",
            initialValue: "7",
            placeholder: "비워두면 서버 기본값",
            inputMode: "numeric",
            maxLength: 4,
        });
        if (daysInput === null) return;
        const days = Number(daysInput);

        await runAction(`member-sanction:${memberId}`, async () => {
            const loadingToast = await notifyLoading("회원 제재를 등록하는 중입니다...");
            try {
                await adminAnomaliesAdapter.createSanction({ memberId, reason, days });
                loadingToast.success("회원 제재를 등록했습니다.");
                await refreshAfterAction();
            } catch (err) {
                loadingToast.error(adminAnomaliesErrorMessage(err, "회원 제재 등록에 실패했습니다."));
            }
        });
    };

    const handleReleaseMemberSanction = async (sanction) => {
        const sanctionId = getSanctionId(sanction);
        if (!sanctionId) {
            notifyError("제재 ID가 올바르지 않습니다.");
            return;
        }
        const reason = await promptAction({
            title: "회원 제재 해제",
            label: "해제 사유",
            placeholder: "해제 승인 근거를 입력하세요.",
            required: true,
            maxLength: ADMIN_ANOMALY_TEXT_LIMITS.sanctionReason,
        });
        if (reason === null) return;

        await runAction(`member-release:${sanctionId}`, async () => {
            const loadingToast = await notifyLoading("제재를 해제하는 중입니다...");
            try {
                await adminAnomaliesAdapter.releaseSanction(sanctionId, { reason });
                loadingToast.success("제재를 해제했습니다.");
                await refreshAfterAction();
            } catch (err) {
                loadingToast.error(adminAnomaliesErrorMessage(err, "제재 해제에 실패했습니다."));
            }
        });
    };

    const handleMemberRoleToggle = async () => {
        if (!isMaster) {
            notifyError("마스터 권한에서만 관리자 권한을 변경할 수 있습니다.");
            return;
        }
        const member = memberDetail?.memberInfo;
        const memberId = member?.memberId;
        if (!memberId) {
            notifyError("권한을 변경할 회원을 먼저 선택하세요.");
            return;
        }
        const currentRoles = Array.isArray(member.roles) ? member.roles : [];
        const hasAdmin = currentRoles.includes("ROLE_ADMIN");
        const nextRoles = hasAdmin
            ? currentRoles.filter((role) => role !== "ROLE_ADMIN")
            : Array.from(new Set([...currentRoles, "ROLE_ADMIN"]));
        const reason = await promptAction({
            title: hasAdmin ? "관리자 권한 해제" : "관리자 권한 부여",
            description: `${member.email} 회원의 권한을 변경합니다.`,
            label: "변경 사유",
            placeholder: "권한 변경 근거를 입력하세요.",
            required: true,
            maxLength: ADMIN_ANOMALY_TEXT_LIMITS.roleReason,
        });
        if (reason === null) return;

        await runAction(`member-role:${memberId}`, async () => {
            try {
                await adminAnomaliesAdapter.updateMemberAdminRole(memberId, { roles: nextRoles, reason });
                notifySuccess(hasAdmin ? "관리자 권한을 해제했습니다." : "관리자 권한을 부여했습니다.");
                await refreshAfterAction();
            } catch (err) {
                notifyError(adminAnomaliesErrorMessage(err, "권한을 변경하지 못했습니다."));
            }
        });
    };

    const activeSanctions = useMemo(
        () => itemsOf(dashboard.sanctions).filter((sanction) => String(pick(sanction, "sanctionStatus", "sanction_status")).toUpperCase() === "ACTIVE"),
        [dashboard.sanctions]
    );

    const readyInboxFiles = useMemo(() => inboxFiles.filter((file) => file.ready), [inboxFiles]);
    const processingVideos = useMemo(
        () => videos.filter((video) => ["UPLOADING", "PROCESSING"].includes(String(video.status).toUpperCase())),
        [videos]
    );

    const queueItems = useMemo(() => {
        const items = [];

        itemsOf(dashboard.releaseRequests).forEach((request) => {
            const parsed = parseReleaseRequest(request);
            items.push({
                key: `release:${parsed.sanctionId || getNotificationId(request) || items.length}`,
                type: "release",
                priority: 1,
                urgency: "즉시",
                tone: "critical",
                icon: RotateCcw,
                title: parsed.memberEmail ? `${parsed.memberEmail} 제재 해제 요청` : "제재 해제 요청",
                subtitle: parsed.requestReason || parsed.sanctionReason || "해제 요청 사유 확인 필요",
                meta: formatDateTime(pick(request, "createdAt", "created_at")),
                raw: request,
            });
        });

        itemsOf(dashboard.incidents).forEach((incident) => {
            const status = String(pick(incident, "incidentStatus", "incident_status") || "NEW").toUpperCase();
            const metric = pick(incident, "metric", "metricName", "metric_name") || "이상징후";
            items.push({
                key: `incident:${getIncidentId(incident) || items.length}`,
                type: "incident",
                priority: status === "NEW" ? 2 : 4,
                urgency: status === "NEW" ? "즉시" : "오늘",
                tone: status === "NEW" ? "critical" : "high",
                icon: AlertTriangle,
                title: `${metric} 사건`,
                subtitle: pick(incident, "summary", "message", "description", "note") || INCIDENT_STATUS_LABELS[status] || status,
                meta: relativeTime(pick(incident, "createdAt", "created_at", "detectedAt", "detected_at")) || formatDateTime(pick(incident, "createdAt", "created_at")),
                raw: incident,
            });
        });

        itemsOf(dashboard.reports).forEach((report) => {
            const reason = pick(report, "reason", "reportReason", "report_reason") || "신고 사유 확인";
            const targetType = pick(report, "targetType", "target_type") || "대상";
            items.push({
                key: `report:${getReportId(report) || items.length}`,
                type: "report",
                priority: 3,
                urgency: "오늘",
                tone: "high",
                icon: Flag,
                title: `${targetType} 신고`,
                subtitle: reason,
                meta: formatDateTime(pick(report, "createdAt", "created_at")),
                raw: report,
            });
        });

        itemsOf(dashboard.moderationBoards).slice(0, 5).forEach((board) => {
            items.push({
                key: `board:${getBoardId(board) || items.length}`,
                type: "board",
                priority: isHidden(board) ? 7 : 5,
                urgency: isHidden(board) ? "복구 검토" : "표시 검토",
                tone: isHidden(board) ? "low" : "medium",
                icon: FileText,
                title: pick(board, "title", "primaryText") || "제목 없는 게시글",
                subtitle: pick(board, "boardCreator", "board_creator", "writerName", "writer_name") || "작성자 확인 필요",
                meta: formatDateTime(pick(board, "createdAt", "created_at")),
                raw: board,
            });
        });

        itemsOf(dashboard.moderationComments).slice(0, 5).forEach((comment) => {
            items.push({
                key: `comment:${getCommentId(comment) || items.length}`,
                type: "comment",
                priority: isHidden(comment) ? 8 : 6,
                urgency: isHidden(comment) ? "복구 검토" : "표시 검토",
                tone: isHidden(comment) ? "low" : "medium",
                icon: ClipboardCheck,
                title: pick(comment, "contents", "primaryText") || "내용 없는 댓글",
                subtitle: pick(comment, "writerName", "writer_name") || "작성자 확인 필요",
                meta: formatDateTime(pick(comment, "createdAt", "created_at")),
                raw: comment,
            });
        });

        itemsOf(dashboard.notifications).forEach((notification) => {
            items.push({
                key: `notification:${getNotificationId(notification) || items.length}`,
                type: "notification",
                priority: 9,
                urgency: "확인",
                tone: "low",
                icon: Bell,
                title: pick(notification, "title", "subject") || "관리자 알림",
                subtitle: pick(notification, "message", "contents", "content") || "알림 내용 확인",
                meta: formatDateTime(pick(notification, "createdAt", "created_at")),
                raw: notification,
            });
        });

        return items
            .sort((a, b) => a.priority - b.priority)
            .slice(0, 18);
    }, [dashboard]);

    const metricTiles = useMemo(() => {
        const summary = dashboard.summary || {};
        const kpi = dashboard.kpi || {};
        const realtimeHasData = Boolean(dashboard.realtimeOperations);
        const realtime = dashboard.realtimeOperations || {};
        const realtimeCounters = Array.isArray(realtime.counters) ? realtime.counters : [];
        const realtimeNonSuccessFromCounters = realtimeCounters
            .filter((counter) => String(pick(counter, "outcome") || "").toLowerCase() !== "success")
            .reduce((sum, counter) => sum + toNumber(pick(counter, "count")), 0);
        const realtimeFullSyncFromCounters = realtimeCounters
            .filter((counter) => String(pick(counter, "operation") || "") === "replay_sync"
                && String(pick(counter, "outcome") || "") === "full_sync_required")
            .reduce((sum, counter) => sum + toNumber(pick(counter, "count")), 0);
        const realtimeNonSuccessValue = pick(realtime, "nonSuccessEvents", "non_success_events");
        const realtimeFailures = realtimeNonSuccessValue === undefined
            ? realtimeNonSuccessFromCounters
            : toNumber(realtimeNonSuccessValue, realtimeNonSuccessFromCounters);
        const realtimeFullSyncValue = pick(realtime, "fullSyncRequiredEvents", "full_sync_required_events");
        const realtimeFullSyncEvents = realtimeFullSyncValue === undefined
            ? realtimeFullSyncFromCounters
            : toNumber(realtimeFullSyncValue, realtimeFullSyncFromCounters);
        const realtimeRedisAvailable = realtimeHasData && pick(realtime, "redisAvailable", "redis_available") !== false;
        const realtimeSource = sources?.realtimeOperations;
        const realtimeSourceUnavailable = !realtimeSource?.ok || !realtimeRedisAvailable;
        const realtimeUnavailableHint = realtimeSourceUnavailable ? "source unavailable" : "";
        const realtimeRecoveryHint = realtimeFullSyncEvents > 0 ? "needs review" : realtimeUnavailableHint;
        const realtimeSourceTitle = realtimeSource?.message
            || (!realtimeRedisAvailable ? "Realtime operations Redis unavailable" : "Realtime operations source is unavailable");
        return [
            { icon: Activity, label: "Realtime", value: formatNumber(realtimeFailures), tone: realtimeSourceUnavailable || realtimeFailures > 0 ? "rose" : "emerald", title: realtimeSourceUnavailable ? realtimeSourceTitle : "Realtime operations non-success events in the last 60 minutes", hint: realtimeUnavailableHint },
            { icon: RefreshCw, label: "Resync", value: formatNumber(realtimeFullSyncEvents), tone: realtimeSourceUnavailable ? "rose" : realtimeFullSyncEvents > 0 ? "amber" : "slate", title: realtimeSourceUnavailable ? realtimeSourceTitle : "Realtime replay full-sync recoveries in the last 60 minutes", hint: realtimeRecoveryHint },
            { icon: Users, label: "회원", value: formatNumber(pick(summary, "totalMembers", "total_members") || 0), tone: "sky", title: "전체 회원 수" },
            { icon: Activity, label: "오늘 방문", value: formatNumber(pick(summary, "todayVisitors", "today_visitors") || 0), tone: "emerald", title: "오늘 방문자 수" },
            { icon: AlertTriangle, label: "처리 큐", value: formatNumber(queueItems.length), tone: queueItems.length ? "rose" : "slate", title: "현재 커맨드 센터에 표시된 처리 항목" },
            { icon: Flag, label: "접수 신고", value: formatNumber(totalOf(dashboard.reports)), tone: totalOf(dashboard.reports) ? "amber" : "slate", title: "OPEN 상태 신고" },
            { icon: Ban, label: "진행 제재", value: formatNumber(activeSanctions.length || totalOf(dashboard.sanctions)), tone: activeSanctions.length ? "rose" : "slate", title: "ACTIVE 상태 제재" },
            { icon: SlidersHorizontal, label: "활성 규칙", value: formatNumber((dashboard.rules || []).filter((rule) => Boolean(pick(rule, "enabled"))).length), tone: "violet", title: "활성화된 이상징후 규칙" },
            { icon: Activity, label: "KPI", value: formatNumber(pick(kpi, "incidentCount", "incident_count", "totalIncidents", "total_incidents") || totalOf(dashboard.incidents)), tone: "sky", title: "최근 7일 이상징후 사건" },
            { icon: Film, label: "변환 중", value: formatNumber(processingVideos.length), tone: processingVideos.length ? "amber" : "slate", title: "업로드 또는 변환 중인 영상" },
        ];
    }, [activeSanctions.length, dashboard, processingVideos.length, queueItems.length, sources]);

    const renderQueueActions = (item) => {
        const busy = actionKey.startsWith(`${item.type}:`) || actionKey.includes(item.key);
        if (item.type === "incident") {
            const incidentId = getIncidentId(item.raw);
            return (
                <div className="flex flex-wrap gap-2">
                    <button className={iconButtonClass} disabled={busy} onClick={() => handleIncidentStatus(item.raw, "REVIEWING")} title="담당자로 지정하고 검토 중 상태로 변경">
                        <Clock className="h-3.5 w-3.5" /> 검토
                    </button>
                    <button className={primaryButtonClass} disabled={busy} onClick={() => handleIncidentStatus(item.raw, "RESOLVED")} title="확인이 끝난 사건을 해결 상태로 변경">
                        <CheckCircle2 className="h-3.5 w-3.5" /> 해결
                    </button>
                    <button className={dangerButtonClass} disabled={busy || !incidentId} onClick={() => handleIncidentAction(item.raw, "BLOCK_QUEUE_USER")} title="대기열 악성 사용자를 일정 시간 차단">
                        <Ban className="h-3.5 w-3.5" /> 차단
                    </button>
                </div>
            );
        }
        if (item.type === "report") {
            return (
                <div className="flex flex-wrap gap-2">
                    <button className={iconButtonClass} disabled={busy} onClick={() => handleReportStatus(item.raw, "IN_REVIEW")} title="신고를 검토 중으로 전환">
                        <Clock className="h-3.5 w-3.5" /> 검토
                    </button>
                    <button className={primaryButtonClass} disabled={busy} onClick={() => handleReportStatus(item.raw, "RESOLVED")} title="신고를 해결로 처리">
                        <CheckCircle2 className="h-3.5 w-3.5" /> 해결
                    </button>
                    <button className={iconButtonClass} disabled={busy} onClick={() => handleReportStatus(item.raw, "REJECTED")} title="근거 부족 또는 미대상 신고를 반려">
                        <XCircle className="h-3.5 w-3.5" /> 반려
                    </button>
                </div>
            );
        }
        if (item.type === "release") {
            return (
                <button className={primaryButtonClass} disabled={busy} onClick={() => handleReleaseRequest(item.raw)} title="해제 요청을 승인하고 제재를 해제">
                    <RotateCcw className="h-3.5 w-3.5" /> 해제 승인
                </button>
            );
        }
        if (item.type === "board" || item.type === "comment") {
            const targetType = item.type === "board" ? "BOARD" : "COMMENT";
            const hidden = isHidden(item.raw);
            return (
                <button className={hidden ? primaryButtonClass : dangerButtonClass} disabled={busy} onClick={() => handleModeration({ targetType, item: item.raw, hiddenYn: !hidden })} title={hidden ? "숨김 항목을 다시 공개" : "정책 위반 항목을 숨김 처리"}>
                    {hidden ? <RotateCcw className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    {hidden ? "복구" : "숨김"}
                </button>
            );
        }
        const link = safeInternalLink(pick(item.raw, "linkUrl", "link_url"));
        return (
            <div className="flex flex-wrap gap-2">
                {link ? (
                    <Link className={iconButtonClass} to={link} title="알림과 연결된 내부 화면으로 이동">
                        <ChevronRight className="h-3.5 w-3.5" /> 열기
                    </Link>
                ) : null}
                <button className={iconButtonClass} disabled={busy} onClick={() => handleNotificationRead(item.raw)} title="처리한 알림을 읽음으로 정리">
                    <CheckCircle2 className="h-3.5 w-3.5" /> 읽음
                </button>
            </div>
        );
    };

    if (!isAdmin) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center px-4">
                <div className="surface-panel w-full max-w-md p-6 text-center sm:p-8">
                    <ShieldCheck className="mx-auto h-10 w-10 text-rose-500" />
                    <h1 className="mt-4 text-xl font-black text-slate-950">관리자 권한이 필요합니다</h1>
                    <p className="mt-2 text-sm font-bold leading-relaxed text-slate-500">운영 커맨드 센터는 관리자 또는 마스터 권한에서만 열립니다.</p>
                    <Link className="btn-primary mt-5 inline-flex px-4 py-2 text-sm" to="/app">
                        홈으로 이동
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen px-3 pb-24 pt-5 text-ink sm:px-6 lg:px-8">
            <div className="mx-auto max-w-[1600px] space-y-5">
                <header className="surface-panel p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700" title="관리자 권한 확인 완료">
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                    {isMaster ? "마스터" : "관리자"}
                                </span>
                                {lastRefreshAt ? (
                                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600" title="마지막으로 모든 섹션을 조회한 시각">
                                        {formatDateTime(lastRefreshAt)}
                                    </span>
                                ) : null}
                                {refreshing ? <span className="rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-black text-sky-700">갱신 중</span> : null}
                            </div>
                            <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">운영 커맨드 센터</h1>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs font-black text-slate-500">
                                <span className="rounded-lg bg-rose-50 px-2.5 py-1 text-rose-700">즉시: 제재/사건</span>
                                <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-amber-700">오늘: 신고/검토</span>
                                <span className="rounded-lg bg-sky-50 px-2.5 py-1 text-sky-700">상시: 콘텐츠/시스템</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                            <button
                                className={primaryButtonClass}
                                onClick={() => loadCommandCenter({ silent: true })}
                                disabled={loading || refreshing}
                                title="모든 관리자 섹션을 다시 조회"
                            >
                                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                                새로고침
                            </button>
                            <Link className={iconButtonClass} to="/app/admin/anomalies" title="이상징후, 신고, 제재, 권한 상세 관리">
                                <AlertTriangle className="h-4 w-4" /> 대시보드
                            </Link>
                            <Link className={iconButtonClass} to="/app/admin/operations" title="일괄 검토, 회원 상세, 배너 편집">
                                <Gavel className="h-4 w-4" /> 운영 도구
                            </Link>
                            <Link className={iconButtonClass} to="/app/admin/streaming" title="영상 업로드와 변환 큐 관리">
                                <Film className="h-4 w-4" /> 스트리밍
                            </Link>
                        </div>
                    </div>
                    {error ? (
                        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                            {error}
                        </div>
                    ) : null}
                </header>

                {loading ? (
                    <div className="grid gap-3 md:grid-cols-4">
                        {Array.from({ length: 8 }).map((_, index) => (
                            <div key={index} className="h-28 animate-pulse rounded-card border border-line bg-surface/80" />
                        ))}
                    </div>
                ) : (
                    <>
                        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            {metricTiles.map((tile) => <MetricTile key={tile.label} {...tile} />)}
                        </section>

                        <main className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.9fr)]">
                            <section className="space-y-5">
                                <div className="surface-panel p-4">
                                    <SectionHeader
                                        icon={ClipboardCheck}
                                        title="통합 처리 큐"
                                        count={queueItems.length}
                                        action={<Link className={iconButtonClass} to="/app/admin/anomalies">전체 보기</Link>}
                                    />
                                    <div className="mt-4 space-y-3">
                                        {queueItems.length ? queueItems.map((item) => {
                                            const Icon = item.icon;
                                            return (
                                                <article key={item.key} className="surface-card p-4">
                                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-black ${queueTone[item.tone] || queueTone.low}`} title="운영 우선순위">
                                                                    <Icon className="h-3.5 w-3.5" />
                                                                    {item.urgency}
                                                                </span>
                                                                {item.meta ? <span className="text-xs font-bold text-slate-400">{item.meta}</span> : null}
                                                            </div>
                                                            <h3 className="mt-2 truncate text-sm font-black text-slate-950">{item.title}</h3>
                                                            <p className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-slate-500">{item.subtitle}</p>
                                                        </div>
                                                        <div className="shrink-0">{renderQueueActions(item)}</div>
                                                    </div>
                                                </article>
                                            );
                                        }) : (
                                            <EmptyState title="현재 즉시 처리할 항목이 없습니다" text="신규 신고나 사건이 들어오면 이 큐에 먼저 표시됩니다." />
                                        )}
                                    </div>
                                </div>

                                <div className="grid gap-5 lg:grid-cols-2">
                                    <div className="surface-panel p-4">
                                        <SectionHeader icon={Megaphone} title="배너 노출" count={banners.length} action={<Link className={iconButtonClass} to="/app/admin/operations">편집</Link>} />
                                        <div className="mt-4 space-y-2">
                                            {banners.length ? banners.slice(0, 6).map((banner) => (
                                                <div key={banner.bannerId} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`h-2 w-2 shrink-0 rounded-full ${banner.activeYn ? "bg-emerald-500" : "bg-slate-300"}`} />
                                                            <p className="truncate text-sm font-black text-slate-900">{banner.title}</p>
                                                        </div>
                                                        <p className="mt-1 truncate text-xs font-bold text-slate-500">{banner.placement} · 우선순위 {banner.priority}</p>
                                                    </div>
                                                    <button className={banner.activeYn ? iconButtonClass : primaryButtonClass} disabled={actionKey === `banner:${banner.bannerId}`} onClick={() => handleBannerActive(banner)} title={banner.activeYn ? "배너 노출을 중지" : "배너 노출을 시작"}>
                                                        {banner.activeYn ? "끄기" : "켜기"}
                                                    </button>
                                                </div>
                                            )) : (
                                                <EmptyState icon={Megaphone} title="등록된 배너가 없습니다" text="운영 도구에서 첫 배너를 등록하세요." />
                                            )}
                                        </div>
                                    </div>

                                    <div className="surface-panel p-4">
                                        <SectionHeader icon={Film} title="스트리밍 큐" count={videos.length} action={<Link className={iconButtonClass} to="/app/admin/streaming">스튜디오</Link>} />
                                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                                            <MetricTile icon={Clock} label="변환 중" value={formatNumber(processingVideos.length)} tone={processingVideos.length ? "amber" : "slate"} />
                                            <MetricTile icon={Inbox} label="반입 가능" value={formatNumber(readyInboxFiles.length)} tone={readyInboxFiles.length ? "sky" : "slate"} />
                                        </div>
                                        <div className="mt-4 space-y-2">
                                            {readyInboxFiles.slice(0, 4).map((file) => (
                                                <div key={file.fileName} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-black text-slate-900">{file.title || file.fileName}</p>
                                                        <p className="mt-1 text-xs font-bold text-slate-500">{formatFileSize(file.fileSize)} · {formatDateTime(file.modifiedAt)}</p>
                                                    </div>
                                                    <button className={primaryButtonClass} disabled={actionKey === `inbox:${file.fileName}`} onClick={() => handleInboxImport(file)} title="선택한 인박스 파일을 변환 큐로 반입">
                                                        반입
                                                    </button>
                                                </div>
                                            ))}
                                            {!readyInboxFiles.length ? <EmptyState icon={Inbox} title="반입 가능한 파일이 없습니다" text="인박스에 준비 완료 파일이 생기면 표시됩니다." /> : null}
                                        </div>
                                    </div>
                                </div>

                                <SourceHealth sources={sources} />
                            </section>

                            <aside className="space-y-5">
                                <div className="surface-panel p-4">
                                    <SectionHeader icon={UserRound} title="회원 360" />
                                    <div className="mt-4 flex gap-2">
                                        <label className="relative flex-1">
                                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                            <input
                                                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm font-bold text-slate-900 outline-none focus:border-primary-400 focus:bg-white focus:ring-4 focus:ring-primary-100"
                                                value={memberKeyword}
                                                maxLength={MEMBER_SEARCH_KEYWORD_MAX_LENGTH}
                                                onChange={(event) => setMemberKeyword(event.target.value)}
                                                placeholder="이름, 이메일, ID"
                                            />
                                        </label>
                                        <button className={iconButtonClass} disabled={!memberDetail?.memberInfo?.memberId || memberLoading} onClick={() => reloadMemberDetail(memberDetail.memberInfo.memberId)} title="선택한 회원 상세 새로고침">
                                            <RefreshCw className={`h-4 w-4 ${memberLoading ? "animate-spin" : ""}`} />
                                        </button>
                                    </div>
                                    {memberSearchLoading ? <p className="mt-2 text-xs font-bold text-slate-500">회원 후보를 찾는 중입니다.</p> : null}
                                    {memberSearchError ? <p className="mt-2 text-xs font-bold text-rose-600">{memberSearchError}</p> : null}
                                    {memberCandidates.length ? (
                                        <div className="mt-3 max-h-48 space-y-2 overflow-auto pr-1">
                                            {memberCandidates.map((member) => (
                                                <button
                                                    key={member.memberId}
                                                    className="w-full rounded-card border border-line bg-surface/80 p-3 text-left hover:border-primary-200 hover:bg-control"
                                                    onClick={() => reloadMemberDetail(member.memberId)}
                                                >
                                                    <div className="text-sm font-black text-slate-900">{member.name || "이름 없음"}</div>
                                                    <div className="mt-1 text-xs font-bold text-slate-500">{member.email}</div>
                                                </button>
                                            ))}
                                        </div>
                                    ) : null}

                                    <div className="mt-4">
                                        {memberLoading ? (
                                            <div className="h-48 animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
                                        ) : memberDetail ? (
                                            <div className="space-y-4">
                                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <h3 className="truncate text-lg font-black text-slate-950">{memberDetail.memberInfo.name}</h3>
                                                            <p className="truncate text-sm font-bold text-slate-500">{memberDetail.memberInfo.email}</p>
                                                        </div>
                                                        <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-black text-slate-700">ID {memberDetail.memberInfo.memberId}</span>
                                                    </div>
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        {roleLabels(memberDetail.memberInfo.roles).map((role) => (
                                                            <span key={role} className="rounded-control border border-line bg-surface/80 px-2.5 py-1 text-xs font-black text-ink">{role}</span>
                                                        ))}
                                                        <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">{memberDetail.memberInfo.memberStatusLabel}</span>
                                                    </div>
                                                    <div className="mt-4 grid grid-cols-3 gap-2">
                                                        <MetricTile icon={FileText} label="게시글" value={formatNumber(memberDetail.memberInfo.boardCount)} />
                                                        <MetricTile icon={ClipboardCheck} label="댓글" value={formatNumber(memberDetail.memberInfo.commentCount)} />
                                                        <MetricTile icon={Activity} label="레벨" value={formatNumber(memberDetail.memberInfo.level)} />
                                                    </div>
                                                    <div className="mt-4 flex flex-wrap gap-2">
                                                        <button className={dangerButtonClass} disabled={Boolean(actionKey)} onClick={handleCreateMemberSanction} title="선택 회원에게 제재 등록">
                                                            <Ban className="h-3.5 w-3.5" /> 제재
                                                        </button>
                                                        <button className={iconButtonClass} disabled={!isMaster || Boolean(actionKey)} onClick={handleMemberRoleToggle} title={isMaster ? "관리자 권한 토글" : "마스터 전용 작업"}>
                                                            <ShieldCheck className="h-3.5 w-3.5" /> 권한
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="rounded-lg border border-slate-200 p-3">
                                                    <div className="mb-2 text-xs font-black uppercase text-slate-500">제재 이력</div>
                                                    {memberDetail.sanctions?.length ? memberDetail.sanctions.slice(0, 4).map((sanction) => (
                                                        <div key={sanction.sanctionId} className="flex items-center justify-between gap-2 border-t border-slate-100 py-2 first:border-t-0">
                                                            <div className="min-w-0">
                                                                <p className="truncate text-xs font-black text-slate-800">{sanction.reason || "사유 없음"}</p>
                                                                <p className="text-[11px] font-bold text-slate-500">{SANCTION_STATUS_LABELS[sanction.sanctionStatus] || sanction.sanctionStatus} · {formatDateTime(sanction.createdAt)}</p>
                                                            </div>
                                                            {String(sanction.sanctionStatus).toUpperCase() === "ACTIVE" ? (
                                                                <button className={iconButtonClass} disabled={Boolean(actionKey)} onClick={() => handleReleaseMemberSanction(sanction)}>해제</button>
                                                            ) : null}
                                                        </div>
                                                    )) : <EmptyState icon={CheckCircle2} title="제재 이력이 없습니다" />}
                                                </div>

                                                <div className="rounded-lg border border-slate-200 p-3">
                                                    <div className="mb-2 text-xs font-black uppercase text-slate-500">최근 활동</div>
                                                    {[...(memberDetail.recentBoards || []).slice(0, 2).map((item) => ({ ...item, kind: "BOARD" })), ...(memberDetail.recentComments || []).slice(0, 2).map((item) => ({ ...item, kind: "COMMENT" }))].map((item) => (
                                                        <div key={`${item.kind}:${item.boardId || item.commentId}`} className="flex items-center justify-between gap-2 border-t border-slate-100 py-2 first:border-t-0">
                                                            <div className="min-w-0">
                                                                <p className="truncate text-xs font-black text-slate-800">{item.title || item.contents}</p>
                                                                <p className="text-[11px] font-bold text-slate-500">{item.kind === "BOARD" ? "게시글" : "댓글"} · {formatDateTime(item.createdAt)}</p>
                                                            </div>
                                                            <button className={item.hiddenYn ? iconButtonClass : dangerButtonClass} disabled={Boolean(actionKey)} onClick={() => handleModeration({ targetType: item.kind, item, hiddenYn: !item.hiddenYn })}>
                                                                {item.hiddenYn ? "복구" : "숨김"}
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <EmptyState icon={UserRound} title="회원을 선택하세요" text="신고·제재 판단 전 회원 활동을 한 번에 확인합니다." />
                                        )}
                                        {memberError ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{memberError}</p> : null}
                                    </div>
                                </div>

                                <div className="surface-panel p-4">
                                    <SectionHeader icon={Clock} title="최근 감사 이력" count={totalOf(dashboard.audits)} action={<Link className={iconButtonClass} to="/app/admin/anomalies">감사</Link>} />
                                    <div className="mt-4 space-y-2">
                                        {itemsOf(dashboard.audits).slice(0, 8).map((audit, index) => (
                                            <div key={pick(audit, "auditId", "audit_id", "id") || `${pick(audit, "createdAt", "created_at")}:${index}`} className="rounded-lg border border-slate-200 p-3">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-700">{pick(audit, "auditType", "audit_type", "type") || "감사"}</span>
                                                    <span className="text-[11px] font-bold text-slate-400">{formatDateTime(pick(audit, "createdAt", "created_at"))}</span>
                                                </div>
                                                <p className="mt-2 line-clamp-2 text-xs font-bold leading-relaxed text-slate-600">{pick(audit, "message", "description", "reason", "action") || "감사 내용 확인"}</p>
                                            </div>
                                        ))}
                                        {!itemsOf(dashboard.audits).length ? <EmptyState icon={Clock} title="표시할 감사 이력이 없습니다" /> : null}
                                    </div>
                                </div>
                            </aside>
                        </main>
                    </>
                )}
            </div>
        </div>
    );
};

export default AdminCommandCenter;
