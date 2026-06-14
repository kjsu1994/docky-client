import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createPipeSession } from "./pipe-websocket-cdp.mjs";

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost";
const chromePath = process.env.CHROME_PATH || [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((candidate) => existsSync(candidate));

if (!chromePath) {
    throw new Error("Chrome or Edge executable was not found. Set CHROME_PATH to run this smoke test.");
}

const debug = process.env.SMOKE_DEBUG === "1";
const userDataDir = mkdtempSync(path.join(tmpdir(), "admin-anomalies-ui-smoke-"));
const viewports = [
    { name: "desktop", width: 1366, height: 900, mobile: false, interactive: true },
    { name: "mobile", width: 390, height: 844, mobile: true, interactive: false },
];
const requiredTexts = [
    "관리자 대시보드",
    "전체 회원",
    "이상징후 KPI",
    "실시간 이상징후 이벤트",
    "회원 제재",
    "통합 감사 로그",
    "관리자 알림",
    "사용자 신고",
    "권한 관리",
    "권한 변경 이력",
    "이상징후 사건함",
    "탐지 규칙 관리",
    "관리자",
    "회원",
    "REALTIME RESYNC",
    "NEEDS REVIEW",
];
const blockedTexts = ["Loading", "Error", "undefined", "NaN", "ROLE_USER", "ROLE_ADMIN", "ROLE_MASTER", "NEW", "REVIEWING", "ACTIVE", "OPEN"];

let nextMessageId = 1;
const pending = new Map();
let incidentDetailRequests = 0;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const encodeBody = (value) => Buffer.from(JSON.stringify(value), "utf8").toString("base64");
const encodeText = (value) => Buffer.from(value, "utf8").toString("base64");

function assertStaticMemberSearchBounds() {
    const adapterSource = readFileSync("src/adapters/adminAnomaliesAdapter.js", "utf8");
    const pageSource = readFileSync("src/pages/admin/AdminAnomalies.jsx", "utf8");
    if (!adapterSource.includes("normalizeMemberSearchKeyword(keyword)") || !adapterSource.includes("normalizeMemberSearchKeyword(roleKeyword)")) {
        throw new Error("admin-anomalies-ui-smoke: member and role searches must normalize keywords before requests.");
    }
    if (!pageSource.includes("MEMBER_SEARCH_KEYWORD_MAX_LENGTH") || !pageSource.includes("maxLength={MEMBER_SEARCH_KEYWORD_MAX_LENGTH}")) {
        throw new Error("admin-anomalies-ui-smoke: member search inputs must be bounded.");
    }
}

function assertStaticSanctionMemberFinder() {
    const adapterSource = readFileSync("src/adapters/adminAnomaliesAdapter.js", "utf8");
    const pageSource = readFileSync("src/pages/admin/AdminAnomalies.jsx", "utf8");
    if (!adapterSource.includes("normalizeMemberCandidate") || !adapterSource.includes("filter((member) => member.memberId)")) {
        throw new Error("admin-anomalies-ui-smoke: sanction member search results must keep only real member ids.");
    }
    if (pageSource.includes("sanction-member-${idx}") || pageSource.includes("key={memberId ||")) {
        throw new Error("admin-anomalies-ui-smoke: sanction member search results must not use index fallback keys.");
    }
    if (!pageSource.includes("key={memberId}") || !pageSource.includes("copyMemberId") || !pageSource.includes("navigator.clipboard.writeText")) {
        throw new Error("admin-anomalies-ui-smoke: sanction member finder must expose stable ids and copy action.");
    }
}

function assertStaticActionTextBounds() {
    const adapterSource = readFileSync("src/adapters/adminAnomaliesAdapter.js", "utf8");
    const pageSource = readFileSync("src/pages/admin/AdminAnomalies.jsx", "utf8");
    const fields = [
        "incidentAssignee",
        "incidentNote",
        "incidentActionDescription",
        "reportAdminNote",
        "sanctionReason",
        "moderationReason",
        "roleReason",
        "ruleMetric",
    ];
    if (!adapterSource.includes("ADMIN_ANOMALY_TEXT_LIMITS") || !adapterSource.includes("toLimitedText(reason, ADMIN_ANOMALY_TEXT_LIMITS.sanctionReason)")) {
        throw new Error("admin-anomalies-ui-smoke: action payload text must be bounded.");
    }
    for (const field of fields) {
        if (!adapterSource.includes(`ADMIN_ANOMALY_TEXT_LIMITS.${field}`) || !pageSource.includes(`ADMIN_ANOMALY_TEXT_LIMITS.${field}`)) {
            throw new Error(`admin-anomalies-ui-smoke: ${field} limit must be shared by adapter and page.`);
        }
    }
    if (!pageSource.includes("maxLength={ADMIN_ANOMALY_TEXT_LIMITS.sanctionReason}")) {
        throw new Error("admin-anomalies-ui-smoke: sanction reason inputs must be bounded.");
    }
    if (!adapterSource.includes("const toPositiveInteger") || !adapterSource.includes("const toPositiveNumber") || !adapterSource.includes("Number.isFinite(parsed)")) {
        throw new Error("admin-anomalies-ui-smoke: anomaly rule numeric fields must reject non-finite values.");
    }
    if (!adapterSource.includes("hard_limit_per_minute: toPositiveInteger(hardLimitPerMinute)") || !adapterSource.includes("z_score_threshold: toPositiveNumber(zScoreThreshold)")) {
        throw new Error("admin-anomalies-ui-smoke: anomaly rule payload must normalize numeric fields.");
    }
    if (!pageSource.includes("applyingIncidentActionKey") || !pageSource.includes("조치를 실행했습니다.") || !pageSource.includes("이상징후 조치를 실행하지 못했습니다.")) {
        throw new Error("admin-anomalies-ui-smoke: anomaly action buttons must expose loading, success, and failure states.");
    }
    if (!pageSource.includes("disabled={isIncidentActionApplying") || !pageSource.includes("조치 처리 중")) {
        throw new Error("admin-anomalies-ui-smoke: anomaly action buttons must block duplicate execution.");
    }
}

function assertStaticAuditRequestNormalization() {
    const adapterSource = readFileSync("src/adapters/adminAnomaliesAdapter.js", "utf8");
    const pageFallbackExpression = "page: normalizePageNumber(data.page " + "?" + "? 1)";
    if (!adapterSource.includes("ADMIN_AUDIT_PAGE_SIZE_MAX = 200") || !adapterSource.includes("const ADMIN_AUDIT_TYPES")) {
        throw new Error("admin-anomalies-ui-smoke: audit requests must define bounded type and size guards.");
    }
    if (!adapterSource.includes("normalizeAuditType(type)") || !adapterSource.includes("normalizePageNumber(page)") || !adapterSource.includes("normalizePageSize(size, 10, ADMIN_AUDIT_PAGE_SIZE_MAX)")) {
        throw new Error("admin-anomalies-ui-smoke: audit requests must normalize type, page, and size before calling the API.");
    }
    if (!adapterSource.includes(pageFallbackExpression) || !adapterSource.includes("totalPages: toNonNegativeInteger")) {
        throw new Error("admin-anomalies-ui-smoke: admin page metadata must reject non-finite page values.");
    }
}

function assertStaticAuditInteractionStates() {
    const pageSource = readFileSync("src/pages/admin/AdminAnomalies.jsx", "utf8");
    if (!pageSource.includes("auditLoading") || !pageSource.includes("auditError") || !pageSource.includes("disabled={auditLoading}")) {
        throw new Error("admin-anomalies-ui-smoke: audit filter must expose loading, error, and disabled states.");
    }
    if (!pageSource.includes("감사 이력을 불러오는 중입니다.") || !pageSource.includes("감사 로그를 불러오지 못했습니다.")) {
        throw new Error("admin-anomalies-ui-smoke: audit loading and failure copy must stay Korean.");
    }
    if (!pageSource.includes("roleAuditLoading") || !pageSource.includes("roleAuditError") || !pageSource.includes("disabled={roleAuditLoading}")) {
        throw new Error("admin-anomalies-ui-smoke: role audit refresh must block duplicate clicks and expose failures.");
    }
    if (!pageSource.includes("aria-label=\"권한 변경 이력 새로고침\"") || !pageSource.includes("권한 변경 이력을 불러오는 중입니다.")) {
        throw new Error("admin-anomalies-ui-smoke: role audit refresh must be accessible and show loading copy.");
    }
}

function assertStaticRoleMemberSearchStates() {
    const pageSource = readFileSync("src/pages/admin/AdminAnomalies.jsx", "utf8");
    if (!pageSource.includes("roleMemberLoading") || !pageSource.includes("roleMemberError") || !pageSource.includes("refreshRoleMembers")) {
        throw new Error("admin-anomalies-ui-smoke: role member search must expose loading, error, and refresh states.");
    }
    if (!pageSource.includes("disabled={!isMaster || roleMemberLoading}") || !pageSource.includes("검색 중...")) {
        throw new Error("admin-anomalies-ui-smoke: role member search controls must block duplicate clicks.");
    }
    if (!pageSource.includes("aria-label=\"권한 관리 회원 목록 새로고침\"") || !pageSource.includes("회원을 불러오는 중입니다.")) {
        throw new Error("admin-anomalies-ui-smoke: role member refresh must be accessible and show Korean loading copy.");
    }
}

function assertStaticReportHandlingStates() {
    const pageSource = readFileSync("src/pages/admin/AdminAnomalies.jsx", "utf8");
    if (!pageSource.includes("reportLoading") || !pageSource.includes("reportError") || !pageSource.includes("updatingReportKey")) {
        throw new Error("admin-anomalies-ui-smoke: report list and status actions must expose loading and error states.");
    }
    if (!pageSource.includes("disabled={reportLoading || Boolean(updatingReportKey)}") || !pageSource.includes("reportActionsDisabled")) {
        throw new Error("admin-anomalies-ui-smoke: report filters and action buttons must block duplicate requests.");
    }
    if (!pageSource.includes("신고 내역을 불러오는 중입니다.") || !pageSource.includes("신고 상태를 변경하지 못했습니다.")) {
        throw new Error("admin-anomalies-ui-smoke: report loading and failure copy must stay Korean.");
    }
}

function assertStaticModerationHandlingStates() {
    const pageSource = readFileSync("src/pages/admin/AdminAnomalies.jsx", "utf8");
    if (!pageSource.includes("moderationLoading") || !pageSource.includes("moderationError") || !pageSource.includes("moderationActionKey")) {
        throw new Error("admin-anomalies-ui-smoke: moderation filter and actions must expose loading and error states.");
    }
    if (!pageSource.includes("disabled={moderationLoading || Boolean(moderationActionKey)}") || !pageSource.includes("boardActionDisabled") || !pageSource.includes("commentActionDisabled")) {
        throw new Error("admin-anomalies-ui-smoke: moderation filter and action buttons must block duplicate requests.");
    }
    if (!pageSource.includes("게시글 검토 목록을 불러오는 중입니다.") || !pageSource.includes("댓글 검토 목록을 불러오는 중입니다.")) {
        throw new Error("admin-anomalies-ui-smoke: moderation loading copy must stay Korean.");
    }
}

function assertStaticSanctionListStates() {
    const pageSource = readFileSync("src/pages/admin/AdminAnomalies.jsx", "utf8");
    if (!pageSource.includes("sanctionLoading") || !pageSource.includes("sanctionError")) {
        throw new Error("admin-anomalies-ui-smoke: sanction list must expose loading and error states.");
    }
    if (!pageSource.includes("disabled={sanctionLoading || creatingSanction || releasingSanctionId !== null}")) {
        throw new Error("admin-anomalies-ui-smoke: sanction filter must block duplicate requests while sanctions change.");
    }
    if (!pageSource.includes("제재 내역을 불러오는 중입니다.") || !pageSource.includes("제재 내역을 불러오지 못했습니다.")) {
        throw new Error("admin-anomalies-ui-smoke: sanction loading and failure copy must stay Korean.");
    }
}

function assertStaticReleaseRequestStates() {
    const pageSource = readFileSync("src/pages/admin/AdminAnomalies.jsx", "utf8");
    const adapterSource = readFileSync("src/adapters/adminAnomaliesAdapter.js", "utf8");
    if (!pageSource.includes("releaseRequestLoading") || !pageSource.includes("releaseRequestError")) {
        throw new Error("admin-anomalies-ui-smoke: release requests must expose loading and error states.");
    }
    if (!pageSource.includes("제재 해제 요청을 불러오지 못했습니다.") || !pageSource.includes("해제 요청을 불러오는 중입니다...")) {
        throw new Error("admin-anomalies-ui-smoke: release request loading and failure copy must stay Korean.");
    }
    if (!pageSource.includes("releaseActionInProgress") || !pageSource.includes("disabled={!Number.isFinite(sanctionId) || sanctionId <= 0 || releaseRequestLoading || releasingSanctionId !== null}")) {
        throw new Error("admin-anomalies-ui-smoke: release request action buttons must block duplicate releases.");
    }
    if (!pageSource.includes("disabled={!Number.isFinite(notificationId) || notificationId <= 0 || markingNotification || markingAllNotifications}")) {
        throw new Error("admin-anomalies-ui-smoke: release request read buttons must respect mark-all processing.");
    }
    if (!pageSource.includes("notificationId: releaseDialog.notificationId")
        || !pageSource.includes("markNotificationRead(notificationId, { quietMissing: true })")) {
        throw new Error("admin-anomalies-ui-smoke: release requests must carry notification ids through release and stale-read cleanup.");
    }
    if (!adapterSource.includes("async releaseSanction(sanctionId, { reason, notificationId } = {})")
        || !adapterSource.includes("notification_id: Math.trunc(normalizedNotificationId)")) {
        throw new Error("admin-anomalies-ui-smoke: release sanction adapter must send notification_id when a release request notification is present.");
    }
    const dialogSnippets = [
        "import { trapFocus } from \"../../utils/focusTrap.js\"",
        "releaseDialogRef",
        "releaseDialogCloseRef",
        "releaseDialogTitleId",
        "releaseDialogDescriptionId",
        "releaseReasonInputId",
        "document.body.style.overflow = \"hidden\"",
        "trapFocus(event, releaseDialogRef.current)",
        "role=\"presentation\"",
        "role=\"dialog\"",
        "aria-modal=\"true\"",
        "aria-labelledby={releaseDialogTitleId}",
        "aria-describedby={releaseDialogDescriptionId}",
        "htmlFor={releaseReasonInputId}",
        "autoFocus",
    ];
    const missingDialogSnippets = dialogSnippets.filter((snippet) => !pageSource.includes(snippet));
    if (missingDialogSnippets.length) {
        throw new Error(`admin-anomalies-ui-smoke: release dialog accessibility guard missing ${missingDialogSnippets.join(", ")}`);
    }
}

function assertStaticNotificationReadHandling() {
    const pageSource = readFileSync("src/pages/admin/AdminAnomalies.jsx", "utf8");
    if (!pageSource.includes("markingNotificationIds") || !pageSource.includes("처리 중...")) {
        throw new Error("admin-anomalies-ui-smoke: notification read buttons must block duplicate clicks.");
    }
    if (!pageSource.includes("markingAllNotifications") || !pageSource.includes("모든 알림을 읽음 처리했습니다.") || !pageSource.includes("알림을 모두 읽음 처리하지 못했습니다.")) {
        throw new Error("admin-anomalies-ui-smoke: mark-all notification action must expose loading, success, and failure states.");
    }
    if (!pageSource.includes("ADMIN_NOTIFICATION_NOT_FOUND") || !pageSource.includes("이미 처리되었거나 삭제된 알림입니다.")) {
        throw new Error("admin-anomalies-ui-smoke: missing notification reads must be handled as stale local state.");
    }
    if (!pageSource.includes("normalizeNotificationLink") || !pageSource.includes("title=\"알림 열기\"") || !pageSource.includes("navigate(notificationLink)")) {
        throw new Error("admin-anomalies-ui-smoke: notification linkUrl must render as a safe internal navigation action.");
    }
}

function assertStaticToastRuntimeSplit() {
    const pageSource = readFileSync("src/pages/admin/AdminAnomalies.jsx", "utf8");
    if (pageSource.includes("react-hot-toast")
        || /\btoast\.(success|error|loading|custom|dismiss|remove)\b/.test(pageSource)
        || /\btoast\s*\(/.test(pageSource)) {
        throw new Error("admin-anomalies-ui-smoke: AdminAnomalies must use lazy toast helpers instead of static react-hot-toast imports.");
    }
    for (const helper of ["notify", "notifyError", "notifySuccess", "notifyLoading"]) {
        if (!pageSource.includes(helper)) {
            throw new Error(`admin-anomalies-ui-smoke: AdminAnomalies must keep ${helper} wired for user feedback.`);
        }
    }
}

function assertStaticSafeDiagnostics() {
    const pageSource = readFileSync("src/pages/admin/AdminAnomalies.jsx", "utf8");
    if (!pageSource.includes("logClientError(\"admin.anomalies.roleMembers.refresh\"")
        || !pageSource.includes("logClientError(\"admin.anomalies.memberRole.update\"")
        || /console\.error\s*\(/.test(pageSource)) {
        throw new Error("admin-anomalies-ui-smoke: admin role failures must use safe client diagnostics.");
    }
    if (pageSource.includes("Math.random()")) {
        throw new Error("admin-anomalies-ui-smoke: AdminAnomalies list keys must be deterministic.");
    }
}

function assertStaticRealtimeOperationsPanel() {
    const adapterSource = readFileSync("src/adapters/adminAnomaliesAdapter.js", "utf8");
    const pageSource = readFileSync("src/pages/admin/AdminAnomalies.jsx", "utf8");
    const smokeSource = readFileSync("scripts/admin-anomalies-ui-smoke.mjs", "utf8");
    if (!adapterSource.includes("key: \"realtimeOperations\"") || !adapterSource.includes("/admin/anomalies/operations/realtime")) {
        throw new Error("admin-anomalies-ui-smoke: dashboard fetch must include realtime operations.");
    }
    const requiredPageSnippets = [
        "const [realtimeOperations, setRealtimeOperations] = useState(null)",
        "dashboard.realtimeOperations || null",
        "setRealtimeOperations(nextRealtimeOperations)",
        "realtimeFullSyncFromCounters",
        "realtimeOperationsError",
        "realtimeOperationsUnavailable",
        "redis_available",
        "source unavailable",
        "Realtime operations Redis unavailable",
        "fullSyncRequiredEvents",
        "full_sync_required_events",
        "Realtime resync",
    ];
    for (const snippet of requiredPageSnippets) {
        if (!pageSource.includes(snippet)) {
            throw new Error(`admin-anomalies-ui-smoke: realtime operations panel is missing ${snippet}.`);
        }
    }
    if (!smokeSource.includes("/api/admin/anomalies/operations/realtime") || !smokeSource.includes("full_sync_required_events: 2")) {
        throw new Error("admin-anomalies-ui-smoke: realtime operations mock must cover full-sync recovery data.");
    }
}

function send(ws, method, params = {}) {
    const id = nextMessageId++;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject, method });
    });
}

const page = (items, size = 10, extra = {}) => ({
    data: {
        items,
        page: 1,
        size,
        totalElements: items.length,
        totalPages: 1,
        ...extra,
    },
});

const incident = {
    incidentId: 41,
    metric: "login.attempt",
    actorId: "member-77",
    incidentStatus: "NEW",
    assignee: "보안팀",
    note: "로그인 시도 급증 확인",
    zScore: 4.8,
    detectedAt: "2026-06-01 10:00",
};

function routeMock(url, method) {
    const parsed = new URL(url);
    const { hostname, pathname } = parsed;

    if (hostname === "oapi.map.naver.com") {
        return {
            status: 200,
            contentType: "application/javascript; charset=utf-8",
            bodyText: "window.naver = window.naver || { maps: {} };",
        };
    }
    if (method === "GET" && pathname === "/api/members") {
        return {
            status: 200,
            body: {
                data: {
                    member_id: 999,
                    memberId: 999,
                    name: "검증 마스터",
                    email: "master@example.com",
                    roles: ["ROLE_MASTER"],
                },
            },
        };
    }
    if (method === "GET" && pathname === "/api/members/admin-mfa/status") {
        return {
            status: 200,
            body: {
                data: {
                    required: true,
                    verified: true,
                    ttl_seconds: 600,
                },
            },
        };
    }
    if (method === "GET" && pathname === "/api/chat/rooms") {
        return { status: 200, body: { data: [] } };
    }
    if (method === "GET" && pathname === "/api/stats/summary") {
        return {
            status: 200,
            body: {
                data: {
                    total_members: 142,
                    total_boards: 58,
                    total_comments: 390,
                    today_visitors: 117,
                },
            },
        };
    }
    if (method === "GET" && pathname === "/api/stats/anomalies") {
        return {
            status: 200,
            body: {
                data: [
                    {
                        metric: "login.attempt",
                        actorId: "member-77",
                        detectedAt: "2026-06-01 10:00",
                        zScore: 4.8,
                    },
                ],
            },
        };
    }
    if (method === "GET" && pathname === "/api/admin/anomalies/operations/realtime") {
        return {
            status: 200,
            body: {
                data: {
                    minutes: 60,
                    redis_available: true,
                    total_events: 12,
                    non_success_events: 3,
                    full_sync_required_events: 2,
                    counters: [
                        {
                            operation: "replay_sync",
                            outcome: "full_sync_required",
                            destination: "chat.room.7",
                            count: 2,
                        },
                    ],
                },
            },
        };
    }
    if (method === "GET" && pathname === "/api/admin/anomalies/kpi") {
        return {
            status: 200,
            body: {
                data: {
                    totalIncidents: 3,
                    newCount: 1,
                    reviewingCount: 1,
                    resolvedCount: 1,
                    falsePositiveCount: 0,
                },
            },
        };
    }
    if (method === "GET" && pathname === "/api/admin/anomalies/rules") {
        return {
            status: 200,
            body: {
                data: [
                    {
                        metric: "login.attempt",
                        hardLimitPerMinute: 30,
                        zScoreThreshold: 3.2,
                        enabled: true,
                    },
                ],
            },
        };
    }
    if (method === "GET" && pathname === "/api/admin/anomalies/incidents") {
        return { status: 200, body: page([incident], 20) };
    }
    if (method === "GET" && pathname === "/api/admin/anomalies/incidents/41") {
        incidentDetailRequests += 1;
        return {
            status: 200,
            body: {
                data: {
                    incident,
                    actions: [
                        {
                            actionLogId: 8,
                            actionType: "회원 경고",
                            actor: "master@example.com",
                            description: "로그인 시도 급증 안내",
                            createdAt: "2026-06-01 10:05",
                        },
                    ],
                },
            },
        };
    }
    if (method === "POST" && pathname === "/api/admin/anomalies/incidents/41/actions") {
        return { status: 200, body: { data: true } };
    }
    if (method === "GET" && pathname === "/api/admin/notifications") {
        return {
            status: 200,
            body: page([
                {
                    notificationId: 7,
                    title: "이상징후 알림",
                    message: "로그인 시도 급증이 감지되었습니다.",
                    severity: "높음",
                    linkUrl: "/app/admin/anomalies",
                    createdAt: "2026-06-01 10:00",
                },
                {
                    notificationId: 8,
                    notification_id: 8,
                    notificationType: "REALTIME_OPERATIONS_SUMMARY_FAILURE",
                    notification_type: "REALTIME_OPERATIONS_SUMMARY_FAILURE",
                    title: "Realtime operations summary unavailable.",
                    message: "window=60, exception=IllegalStateException",
                    severity: "MEDIUM",
                    linkUrl: "/app/admin",
                    link_url: "/app/admin",
                    createdAt: "2026-06-01 10:01",
                    created_at: "2026-06-01 10:01",
                },
            ], 8, { unreadCount: 2 }),
        };
    }
    if (method === "PATCH" && pathname === "/api/admin/notifications/7/read") {
        return {
            status: 404,
            body: {
                status: 404,
                code: "ADMIN_NOTIFICATION_NOT_FOUND",
                message: "알림을 찾을 수 없습니다.",
            },
        };
    }
    if (method === "PATCH" && pathname === "/api/admin/notifications/8/read") {
        return { status: 200, body: { data: true } };
    }
    if (method === "POST" && pathname === "/api/admin/notifications/read-all") {
        return { status: 200, body: { data: true } };
    }
    if (method === "GET" && pathname === "/api/admin/reports") {
        return {
            status: 200,
            body: page([
                {
                    reportId: 12,
                    targetType: "BOARD",
                    targetId: 501,
                    reportStatus: "OPEN",
                    reason: "스팸 신고",
                    detail: "반복 홍보 게시글",
                },
            ], 10),
        };
    }
    if (method === "GET" && pathname === "/api/admin/sanctions") {
        return {
            status: 200,
            body: page([
                {
                    sanctionId: 21,
                    memberEmail: "blocked@example.com",
                    reason: "스팸 반복",
                    sanctionStatus: "ACTIVE",
                    createdAt: "2026-06-01 09:00",
                },
            ], 10),
        };
    }
    if (method === "GET" && pathname === "/api/admin/sanctions/release-requests") {
        return { status: 200, body: page([], 50) };
    }
    if (method === "GET" && pathname === "/api/admin/moderation/boards") {
        return {
            status: 200,
            body: page([
                {
                    boardId: 501,
                    board_id: 501,
                    title: "검토 게시글",
                    boardCreator: "작성자",
                    board_creator: "작성자",
                    hiddenYn: false,
                    hidden_yn: false,
                },
            ], 8),
        };
    }
    if (method === "GET" && pathname === "/api/admin/moderation/comments") {
        return {
            status: 200,
            body: page([
                {
                    commentId: 601,
                    comment_id: 601,
                    contents: "검토 댓글",
                    commentCreator: "댓글러",
                    comment_creator: "댓글러",
                    hiddenYn: false,
                    hidden_yn: false,
                },
            ], 8),
        };
    }
    if (method === "GET" && pathname === "/api/admin/audits") {
        return {
            status: 200,
            body: page([
                {
                    auditType: "SANCTION",
                    actionType: "제재 등록",
                    summary: "반복 스팸 계정 제재",
                    actor: "master@example.com",
                    createdAt: "2026-06-01 09:10",
                },
            ], 10),
        };
    }
    if (method === "GET" && pathname === "/api/admin/roles/members") {
        return {
            status: 200,
            body: page([
                {
                    memberId: 77,
                    member_id: 77,
                    name: "검증 회원",
                    email: "member@example.com",
                    roles: ["ROLE_USER", "ROLE_ADMIN"],
                    memberStatus: "ACTIVE",
                    member_status: "ACTIVE",
                },
            ], 10),
        };
    }
    if (method === "GET" && pathname === "/api/admin/roles/audits") {
        return {
            status: 200,
            body: page([
                {
                    roleAuditId: 31,
                    targetEmail: "member@example.com",
                    targetMemberId: 77,
                    changedByEmail: "master@example.com",
                    afterRoles: "ROLE_USER,ROLE_ADMIN",
                    changeReason: "운영 검증",
                    createdAt: "2026-06-01 09:30",
                },
            ], 10),
        };
    }

    return null;
}

async function handleFetchRequest(ws, event) {
    const { requestId, request } = event.params;
    const mock = routeMock(request.url, request.method);
    if (!mock) {
        await send(ws, "Fetch.continueRequest", { requestId });
        return;
    }
    await send(ws, "Fetch.fulfillRequest", {
        requestId,
        responseCode: mock.status,
        responseHeaders: [
            { name: "Content-Type", value: mock.contentType || "application/json; charset=utf-8" },
            { name: "Cache-Control", value: "no-store" },
        ],
        body: mock.bodyText == null ? encodeBody(mock.body) : encodeText(mock.bodyText),
    });
}

async function evaluate(ws, expression) {
    const response = await send(ws, "Runtime.evaluate", {
        awaitPromise: true,
        returnByValue: true,
        expression,
    });
    return response.result?.result?.value;
}

async function waitForText(ws, text, timeoutMs = 7000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (await evaluate(ws, `document.body?.innerText.includes(${JSON.stringify(text)})`)) return;
        await delay(120);
    }
    const bodyText = await evaluate(ws, `document.body?.innerText.slice(0, 1000) || ""`);
    throw new Error(`Timed out waiting for text: ${text}. Body: ${bodyText}`);
}

async function inspectQuality(ws, label) {
    const value = await evaluate(ws, `(() => {
        const root = document.documentElement;
        const body = document.body;
        const text = body ? body.innerText : "";
        const overflowNodes = Array.from(document.querySelectorAll("body *"))
            .map((node) => {
                const rect = node.getBoundingClientRect();
                return {
                    tag: node.tagName,
                    text: (node.innerText || node.getAttribute("aria-label") || node.getAttribute("title") || "").trim().slice(0, 80),
                    width: Math.round(rect.width),
                    right: Math.round(rect.right),
                };
            })
            .filter((node) => node.right > root.clientWidth + 2 && node.width > 0)
            .slice(0, 5);
        return {
            text,
            url: location.href,
            clientWidth: root.clientWidth,
            scrollWidth: root.scrollWidth,
            bodyWidth: body ? body.scrollWidth : 0,
            overflowNodes,
        };
    })()`);

    const missing = requiredTexts.filter((text) => !value.text.includes(text));
    if (missing.length) {
        throw new Error(`${label}: missing text ${missing.join(", ")}`);
    }

    const blocked = blockedTexts.filter((text) => value.text.includes(text));
    if (blocked.length) {
        const details = blocked.map((text) => {
            const index = value.text.indexOf(text);
            return `${text}: ${value.text.slice(Math.max(0, index - 80), index + text.length + 80)}`;
        });
        throw new Error(`${label}: blocked text ${blocked.join(", ")}\n${details.join("\n")}`);
    }

    const overflow = Math.max(value.scrollWidth, value.bodyWidth) - value.clientWidth;
    if (overflow > 3) {
        throw new Error(`${label}: horizontal overflow ${overflow}px ${JSON.stringify(value.overflowNodes)}`);
    }

    return `${label}: ok ${value.clientWidth}/${value.scrollWidth} ${value.url}`;
}

async function clickButtonByTitle(ws, title) {
    return evaluate(ws, `(() => {
        const button = Array.from(document.querySelectorAll("button")).find((node) => node.getAttribute("title") === ${JSON.stringify(title)});
        if (!button) return "missing";
        button.scrollIntoView({ block: "center", inline: "center" });
        button.click();
        return "clicked";
    })()`);
}

async function clickNotificationReadButton(ws) {
    const rect = await evaluate(ws, `(() => {
        const heading = Array.from(document.querySelectorAll("h2")).find((node) => (node.innerText || "").trim() === "관리자 알림");
        const card = heading?.closest(".card");
        const button = Array.from(card?.querySelectorAll("button") || []).find((node) => (node.innerText || "").trim() === "읽음 처리" && !node.disabled);
        if (!button) return null;
        button.scrollIntoView({ block: "center", inline: "center" });
        const rect = button.getBoundingClientRect();
        return {
            x: Math.round(rect.left + rect.width / 2),
            y: Math.round(rect.top + rect.height / 2),
        };
    })()`);
    if (!rect) return "missing";
    await send(ws, "Input.dispatchMouseEvent", { type: "mouseMoved", x: rect.x, y: rect.y, button: "none" });
    await send(ws, "Input.dispatchMouseEvent", { type: "mousePressed", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
    await send(ws, "Input.dispatchMouseEvent", { type: "mouseReleased", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
    return "clicked";
}

async function inspectAdminAnomalies(ws, viewport) {
    await send(ws, "Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.mobile ? 2 : 1,
        mobile: viewport.mobile,
    });
    await send(ws, "Page.navigate", { url: `${baseUrl}/app/admin/anomalies` });

    for (const text of requiredTexts) {
        await waitForText(ws, text);
    }

    if (viewport.interactive) {
        if (await clickButtonByTitle(ws, "상세 보기") !== "clicked") {
            throw new Error("admin anomalies desktop: incident detail button missing");
        }
        await waitForText(ws, "사건 상세 분석");
        await waitForText(ws, "대기열 차단");
        await waitForText(ws, "로그인 시도 급증 안내");
        if (incidentDetailRequests < 1) {
            throw new Error("admin anomalies desktop: incident detail API was not requested");
        }
        await waitForText(ws, "열기");
        if (await clickNotificationReadButton(ws) !== "clicked") {
            throw new Error("admin anomalies desktop: notification read button missing");
        }
        await waitForText(ws, "\uc774\ubbf8 \ucc98\ub9ac\ub418\uc5c8\uac70\ub098 \uc0ad\uc81c\ub41c \uc54c\ub9bc\uc785\ub2c8\ub2e4.");
        await waitForText(ws, "Realtime operations summary unavailable.");
        await waitForText(ws, "window=60, exception=IllegalStateException");
        if (await clickNotificationReadButton(ws) !== "clicked") {
            throw new Error("admin anomalies desktop: realtime operation notification read button missing");
        }
        await waitForText(ws, "이미 처리되었거나 삭제된 알림입니다.");
        await waitForText(ws, "읽지 않은 알림이 없습니다.");
    }

    await delay(250);
    return inspectQuality(ws, `admin anomalies ${viewport.name}`);
}

async function main() {
    assertStaticToastRuntimeSplit();
    assertStaticSafeDiagnostics();
    assertStaticRealtimeOperationsPanel();
    assertStaticMemberSearchBounds();
    assertStaticSanctionMemberFinder();
    assertStaticActionTextBounds();
    assertStaticAuditRequestNormalization();
    assertStaticAuditInteractionStates();
    assertStaticRoleMemberSearchStates();
    assertStaticReportHandlingStates();
    assertStaticModerationHandlingStates();
    assertStaticSanctionListStates();
    assertStaticReleaseRequestStates();
    assertStaticNotificationReadHandling();
    const chrome = spawn(chromePath, [
        "--headless=new",
        "--remote-debugging-pipe",
        `--user-data-dir=${userDataDir}`,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--no-first-run",
        "--no-default-browser-check",
        "about:blank",
    ], { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] });

    if (debug) {
        chrome.stderr.on("data", (chunk) => process.stderr.write(chunk));
    } else {
        chrome.stderr.on("data", () => {});
    }
    const waitForChromeExit = () => new Promise((resolve) => {
        if (chrome.exitCode !== null) {
            resolve();
            return;
        }
        chrome.once("exit", resolve);
    });

    try {
        const ws = await createPipeSession(chrome, { debug, testName: "admin-anomalies-ui-smoke" });
        const runtimeErrors = [];

        ws.addEventListener("message", (event) => {
            const message = JSON.parse(event.data);
            if (message.id && pending.has(message.id)) {
                const waiter = pending.get(message.id);
                pending.delete(message.id);
                if (message.error) {
                    waiter.reject(new Error(`${waiter.method}: ${message.error.message}`));
                } else {
                    waiter.resolve(message);
                }
                return;
            }
            if (message.method === "Fetch.requestPaused") {
                handleFetchRequest(ws, message).catch((error) => {
                    if (!String(error.message || "").includes("Invalid InterceptionId")) {
                        runtimeErrors.push(error.message);
                    }
                });
            } else if (message.method === "Runtime.exceptionThrown") {
                runtimeErrors.push(message.params?.exceptionDetails?.text || "Runtime exception");
            }
        });

        await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
        await send(ws, "Page.enable");
        await send(ws, "Runtime.enable");
        await send(ws, "Fetch.enable", {
            patterns: [
                { urlPattern: "*://localhost*/api/*", requestStage: "Request" },
                { urlPattern: "*://127.0.0.1*/api/*", requestStage: "Request" },
                { urlPattern: "https://oapi.map.naver.com/*", requestStage: "Request" },
            ],
        });
        await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
            source: `
                localStorage.setItem("accessToken", "smoke-master-access-token");
                localStorage.setItem("refreshToken", "smoke-master-refresh-token");
                localStorage.setItem("userRoles", JSON.stringify(["ROLE_MASTER"]));
            `,
        });

        const results = [];
        for (const viewport of viewports) {
            results.push(await inspectAdminAnomalies(ws, viewport));
        }
        if (runtimeErrors.length) {
            throw new Error(`Runtime errors: ${runtimeErrors.join(" | ")}`);
        }
        results.forEach((result) => console.log(result));
        console.log(`admin-anomalies-ui-smoke ok (${results.length} responsive checks)`);
    } finally {
        if (chrome.exitCode === null) {
            chrome.kill();
            await Promise.race([waitForChromeExit(), delay(1500)]);
        }
        for (let attempt = 1; attempt <= 5; attempt += 1) {
            try {
                rmSync(userDataDir, { recursive: true, force: true });
                break;
            } catch (error) {
                if (attempt === 5) {
                    console.warn(`Could not remove temporary Chrome profile ${userDataDir}: ${error.message}`);
                    break;
                }
                await delay(300);
            }
        }
    }
}

try {
    await main();
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
