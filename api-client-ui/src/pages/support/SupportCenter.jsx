import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    AlertCircle,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock3,
    ExternalLink,
    Flag,
    LifeBuoy,
    RefreshCw,
    SearchCheck,
    XCircle,
} from "lucide-react";
import { supportAdapter, supportErrorMessage } from "../../adapters/supportAdapter.js";
import { EmptyState } from "../../components/EmptyState.jsx";
import { ErrorMessage } from "../../components/ErrorMessage.jsx";
import { LoadingSpinner } from "../../components/LoadingSpinner.jsx";
import { formatDate, formatRelativeTime } from "../../utils/helpers.js";
import { notifyError } from "../../utils/toast.js";

const REPORT_PAGE_SIZE = 10;

const STATUS_OPTIONS = [
    { value: "ALL", label: "전체" },
    { value: "OPEN", label: "접수" },
    { value: "IN_REVIEW", label: "검토 중" },
    { value: "RESOLVED", label: "처리 완료" },
    { value: "REJECTED", label: "반려" },
];

const STATUS_META = {
    OPEN: {
        label: "접수",
        icon: Clock3,
        className: "border-sky-100 bg-sky-50 text-sky-700",
    },
    IN_REVIEW: {
        label: "검토 중",
        icon: SearchCheck,
        className: "border-amber-100 bg-amber-50 text-amber-700",
    },
    RESOLVED: {
        label: "처리 완료",
        icon: CheckCircle2,
        className: "border-emerald-100 bg-emerald-50 text-emerald-700",
    },
    REJECTED: {
        label: "반려",
        icon: XCircle,
        className: "border-rose-100 bg-rose-50 text-rose-700",
    },
};

const TARGET_LABELS = {
    BOARD: "게시글",
    COMMENT: "댓글",
};

const pick = (item, ...keys) => {
    for (const key of keys) {
        if (item?.[key] !== undefined && item?.[key] !== null) {
            return item[key];
        }
    }
    return null;
};

const normalizeReport = (item) => ({
    id: Number(pick(item, "reportId", "report_id", "id")),
    targetType: pick(item, "targetType", "target_type") || "BOARD",
    targetId: pick(item, "targetId", "target_id"),
    reason: pick(item, "reason") || "",
    detail: pick(item, "detail") || "",
    status: pick(item, "reportStatus", "report_status") || "OPEN",
    adminNote: pick(item, "adminNote", "admin_note") || "",
    handledBy: pick(item, "handledBy", "handled_by") || "",
    handledAt: pick(item, "handledAt", "handled_at"),
    createdAt: pick(item, "createdAt", "created_at"),
});

const statusMeta = (status) => STATUS_META[status] || STATUS_META.OPEN;

const StatusBadge = ({ status }) => {
    const meta = statusMeta(status);
    const Icon = meta.icon;
    return (
        <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black ${meta.className}`}>
            <Icon className="h-3.5 w-3.5" />
            {meta.label}
        </span>
    );
};

const ReportCard = ({ report }) => {
    const targetLabel = TARGET_LABELS[report.targetType] || report.targetType;
    const handledText = report.handledAt ? formatDate(report.handledAt) : "";

    return (
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={report.status} />
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                            {targetLabel} #{report.targetId || "-"}
                        </span>
                    </div>
                    <h2 className="break-words text-base font-black leading-6 text-slate-900 sm:text-lg">
                        {report.reason || "신고 사유 없음"}
                    </h2>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-500">
                        <span>접수 {formatRelativeTime(report.createdAt) || "-"}</span>
                        {handledText ? <span>처리 {handledText}</span> : null}
                    </div>
                </div>
            </div>

            {report.detail ? (
                <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-600">
                    {report.detail}
                </div>
            ) : null}

            {report.adminNote ? (
                <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                    <div className="mb-1 flex items-center gap-2 text-xs font-black text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                        운영 답변
                    </div>
                    <p className="break-words text-sm font-semibold leading-6 text-emerald-900">
                        {report.adminNote}
                    </p>
                </div>
            ) : null}
        </article>
    );
};

export const SupportCenter = () => {
    const [status, setStatus] = useState("ALL");
    const [page, setPage] = useState(1);
    const [reports, setReports] = useState({
        items: [],
        page: 1,
        size: REPORT_PAGE_SIZE,
        totalElements: 0,
        totalPages: 0,
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");

    const normalizedReports = useMemo(
        () => (reports.items || []).map(normalizeReport).filter((report) => Number.isFinite(report.id)),
        [reports.items]
    );
    const totalPages = Math.max(1, Number(reports.totalPages || 0));

    const fetchReports = useCallback(async ({ silent = false } = {}) => {
        if (silent) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        setError("");
        try {
            setReports(await supportAdapter.fetchMyReports({ status, page, size: REPORT_PAGE_SIZE }));
        } catch (err) {
            const message = supportErrorMessage(err, "신고 상태를 불러오지 못했습니다.");
            setError(message);
            if (silent) notifyError(message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [page, status]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    const changeStatus = (nextStatus) => {
        if (nextStatus === status || loading || refreshing) return;
        setStatus(nextStatus);
        setPage(1);
    };

    const movePage = (nextPage) => {
        const safePage = Math.min(Math.max(1, nextPage), totalPages);
        if (safePage === page || loading || refreshing) return;
        setPage(safePage);
    };

    return (
        <div className="space-y-5 pb-20">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <div className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                            <LifeBuoy className="h-5 w-5" />
                        </div>
                        <h1 className="text-2xl font-black text-slate-900">신고/문의 상태</h1>
                        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                            접수한 신고의 처리 상태와 운영 답변을 확인할 수 있습니다.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => fetchReports({ silent: true })}
                            disabled={loading || refreshing}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                        >
                            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                            새로고침
                        </button>
                        <Link
                            to="/app/boards/QUESTION_ANSWER"
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white hover:bg-slate-800"
                        >
                            <ExternalLink className="h-4 w-4" />
                            Q&A
                        </Link>
                    </div>
                </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {STATUS_OPTIONS.map((option) => {
                        const active = option.value === status;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                aria-pressed={active}
                                onClick={() => changeStatus(option.value)}
                                disabled={loading || refreshing}
                                className={`min-h-11 rounded-xl px-3 py-2 text-sm font-black transition-colors disabled:opacity-60 ${
                                    active
                                        ? "bg-slate-900 text-white"
                                        : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                                }`}
                            >
                                {option.label}
                            </button>
                        );
                    })}
                </div>
            </section>

            {loading ? (
                <LoadingSpinner text="신고 상태를 불러오는 중입니다..." />
            ) : error ? (
                <ErrorMessage message={error} onRetry={fetchReports} />
            ) : !normalizedReports.length ? (
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <EmptyState
                        message="표시할 신고 내역이 없습니다."
                        subMessage="신고를 접수하면 이 화면에서 처리 상태를 확인할 수 있습니다."
                    />
                </section>
            ) : (
                <>
                    <section className="space-y-3">
                        {normalizedReports.map((report) => (
                            <ReportCard key={report.id} report={report} />
                        ))}
                    </section>

                    <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2 text-sm font-black text-slate-700">
                            <Flag className="h-4 w-4 text-slate-500" />
                            {reports.page} / {totalPages}
                            <span className="font-semibold text-slate-400">총 {reports.totalElements}건</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:flex">
                            <button
                                type="button"
                                onClick={() => movePage(page - 1)}
                                disabled={page <= 1 || loading || refreshing}
                                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                            >
                                <ChevronLeft className="h-4 w-4" />
                                이전
                            </button>
                            <button
                                type="button"
                                onClick={() => movePage(page + 1)}
                                disabled={page >= totalPages || loading || refreshing}
                                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                            >
                                다음
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </section>
                </>
            )}

            <section className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
                <div className="mb-1 flex items-center gap-2 font-black">
                    <AlertCircle className="h-4 w-4" />
                    접수 기록
                </div>
                관리자 확인이 필요한 신고만 이곳에 표시됩니다. 일반 문의 글은 Q&A 게시판에서 확인해 주세요.
            </section>
        </div>
    );
};

export default SupportCenter;
