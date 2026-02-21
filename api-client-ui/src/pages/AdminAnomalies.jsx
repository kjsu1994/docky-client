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
} from "lucide-react";
import api from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import { isAdminUser } from "../utils/authorization";

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

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [savingIncidentId, setSavingIncidentId] = useState(null);

    const [summary, setSummary] = useState(null);
    const [events, setEvents] = useState([]);
    const [kpi, setKpi] = useState(null);
    const [rules, setRules] = useState([]);

    const [statusFilter, setStatusFilter] = useState("ALL");
    const [page, setPage] = useState(1);
    const [incidentList, setIncidentList] = useState({ items: [], page: 1, size: 20, totalElements: 0, totalPages: 0 });
    const [selectedDetail, setSelectedDetail] = useState(null);
    const [ruleDrafts, setRuleDrafts] = useState({});
    const [incidentDrafts, setIncidentDrafts] = useState({});
    const [newRule, setNewRule] = useState({ metric: "", hardLimitPerMinute: 60, zScoreThreshold: 3.0, enabled: true });

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

    const fetchDashboard = async (nextStatus = statusFilter, nextPage = page) => {
        setLoading(true);
        setError("");
        try {
            // 관리자 운영 대시보드 핵심 데이터(통계/KPI/규칙/사건함/실시간 이벤트)를 일괄 조회한다.
            const [summaryRes, eventsRes, kpiRes, rulesRes, incidentsRes] = await Promise.all([
                api.get("/stats/summary"),
                api.get("/stats/anomalies", { params: { limit: 50 } }),
                api.get("/admin/anomalies/kpi", { params: { days: 7 } }),
                api.get("/admin/anomalies/rules"),
                api.get("/admin/anomalies/incidents", { params: { status: nextStatus, page: nextPage, size: 20 } }),
            ]);

            const nextRules = unwrapData(rulesRes.data) || [];
            const nextIncidents = unwrapData(incidentsRes.data) || { items: [], page: 1, size: 20, totalElements: 0, totalPages: 0 };
            setSummary(unwrapData(summaryRes.data));
            setEvents(toEventList(eventsRes.data));
            setKpi(unwrapData(kpiRes.data));
            setRules(nextRules);
            setIncidentList(nextIncidents);
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
