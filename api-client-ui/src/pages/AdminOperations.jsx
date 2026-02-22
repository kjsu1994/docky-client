import { useMemo, useState } from "react";
import { ShieldAlert, UserSearch, EyeOff, RotateCcw, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import api from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import { isAdminUser } from "../utils/authorization";

const unwrapData = (payload) => payload?.data?.data ?? payload?.data ?? payload ?? null;

const parseIds = (raw) => {
    const values = String(raw || "")
        .split(/[\s,]+/)
        .map((token) => Number(token.trim()))
        .filter((value) => Number.isFinite(value) && value > 0);
    return [...new Set(values)];
};

const pick = (obj, camel, snake, fallback = null) => {
    if (!obj || typeof obj !== "object") return fallback;
    if (Object.prototype.hasOwnProperty.call(obj, camel) && obj[camel] !== undefined) return obj[camel];
    if (Object.prototype.hasOwnProperty.call(obj, snake) && obj[snake] !== undefined) return obj[snake];
    return fallback;
};

export const AdminOperations = () => {
    const { user } = useAuth();
    const isAdmin = useMemo(() => isAdminUser(user), [user]);

    const [targetType, setTargetType] = useState("BOARD");
    const [idsInput, setIdsInput] = useState("");
    const [hiddenAction, setHiddenAction] = useState("HIDE");
    const [reason, setReason] = useState("");
    const [batchLoading, setBatchLoading] = useState(false);
    const [batchError, setBatchError] = useState("");
    const [batchResult, setBatchResult] = useState(null);

    const [memberIdInput, setMemberIdInput] = useState("");
    const [memberLoading, setMemberLoading] = useState(false);
    const [memberError, setMemberError] = useState("");
    const [memberDetail, setMemberDetail] = useState(null);

    const submitBatchModeration = async () => {
        const ids = parseIds(idsInput);
        if (!ids.length) {
            toast.error("???ID瑜?1媛??댁긽 ?낅젰?섏꽭??");
            return;
        }

        const endpoint = targetType === "BOARD" ? "/admin/moderation/boards/batch" : "/admin/moderation/comments/batch";
        const payload = {
            ids,
            hidden_yn: hiddenAction === "HIDE",
            reason: reason.trim() || null,
        };

        setBatchLoading(true);
        setBatchError("");
        try {
            const response = await api.patch(endpoint, payload);
            const data = unwrapData(response.data) || {};
            setBatchResult(data);
            toast.success("?쇨큵 紐⑤뜑?덉씠???묒뾽???꾨즺?섏뿀?듬땲??");
        } catch (err) {
            const message = err?.response?.data?.message || "?쇨큵 紐⑤뜑?덉씠???묒뾽???ㅽ뙣?덉뒿?덈떎.";
            setBatchError(message);
            toast.error(message);
        } finally {
            setBatchLoading(false);
        }
    };

    const fetchMemberDetail = async () => {
        const memberId = Number(memberIdInput);
        if (!Number.isFinite(memberId) || memberId <= 0) {
            toast.error("?좏슚???뚯썝 ID瑜??낅젰?섏꽭??");
            return;
        }

        setMemberLoading(true);
        setMemberError("");
        try {
            const response = await api.get(`/admin/members/${memberId}`);
            const data = unwrapData(response.data);
            setMemberDetail(data);
        } catch (err) {
            const message = err?.response?.data?.message || "?뚯썝 ?곸꽭 議고쉶???ㅽ뙣?덉뒿?덈떎.";
            setMemberError(message);
            setMemberDetail(null);
            toast.error(message);
        } finally {
            setMemberLoading(false);
        }
    };

    if (!isAdmin) {
        return (
            <section className="rounded-[2rem] border border-rose-100 bg-rose-50/50 p-10 text-rose-800 text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                    <ShieldAlert className="h-8 w-8 text-rose-500" />
                </div>
                <h1 className="text-xl font-black">愿由ъ옄 ?꾩슜 ?붾㈃</h1>
                <p className="text-sm font-medium opacity-70">ROLE_ADMIN ?먮뒗 ROLE_MASTER 沅뚰븳???꾩슂?⑸땲??</p>
            </section>
        );
    }

    const memberInfo = pick(memberDetail, "memberInfo", "member_info", {});
    const recentBoards = pick(memberDetail, "recentBoards", "recent_boards", []);
    const recentComments = pick(memberDetail, "recentComments", "recent_comments", []);
    const sanctions = pick(memberDetail, "sanctions", "sanctions", []);
    const receivedReports = pick(memberDetail, "receivedReports", "received_reports", []);
    const madeReports = pick(memberDetail, "madeReports", "made_reports", []);

    return (
        <section className="space-y-8 animate-fade-in pb-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900">愿由ъ옄 ?댁쁺 ?붾㈃</h1>
                    <p className="text-sm font-medium text-slate-400">?쇨큵 紐⑤뜑?덉씠?섍낵 ?뚯썝 360 ?곸꽭 議고쉶瑜??쒓났?⑸땲??</p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="card p-8 space-y-5">
                    <h2 className="text-lg font-black text-slate-900">Bulk Moderation</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <select className="input-base" value={targetType} onChange={(e) => setTargetType(e.target.value)}>
                            <option value="BOARD">BOARD</option>
                            <option value="COMMENT">COMMENT</option>
                        </select>
                        <select className="input-base" value={hiddenAction} onChange={(e) => setHiddenAction(e.target.value)}>
                            <option value="HIDE">?④?(HIDE)</option>
                            <option value="RECOVER">蹂듦뎄(RECOVER)</option>
                        </select>
                        <button className="btn-primary" disabled={batchLoading} onClick={submitBatchModeration}>
                            {batchLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : hiddenAction === "HIDE" ? <EyeOff className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                            <span className="ml-2">?ㅽ뻾</span>
                        </button>
                    </div>
                    <textarea
                        className="input-base min-h-[110px]"
                        value={idsInput}
                        onChange={(e) => setIdsInput(e.target.value)}
                        placeholder="???ID瑜?肄ㅻ쭏 ?먮뒗 怨듬갚?쇰줈 ?낅젰?섏꽭?? ?? 10,11,12"
                    />
                    <input
                        className="input-base"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="?ъ쑀(?좏깮, 理쒕? 500??"
                        maxLength={500}
                    />

                    {batchError ? (
                        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                            {batchError}
                        </div>
                    ) : null}

                    {batchResult ? (
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-sm space-y-1">
                            <div><b>?붿껌 嫄댁닔:</b> {pick(batchResult, "totalRequested", "total_requested", 0)}</div>
                            <div><b>泥섎━ 嫄댁닔:</b> {pick(batchResult, "processedCount", "processed_count", 0)}</div>
                            <div><b>?ㅽ뙣 ID:</b> {(pick(batchResult, "failedIds", "failed_ids", []) || []).join(", ") || "?놁쓬"}</div>
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 text-sm text-slate-500">
                            ?ㅽ뻾 寃곌낵媛 ?ш린???쒖떆?⑸땲??
                        </div>
                    )}
                </div>

                <div className="card p-8 space-y-5">
                    <h2 className="text-lg font-black text-slate-900">?뚯썝 360 ?곸꽭 議고쉶</h2>
                    <div className="flex gap-3">
                        <input
                            className="input-base flex-1"
                            value={memberIdInput}
                            onChange={(e) => setMemberIdInput(e.target.value)}
                            placeholder="?뚯썝 ID ?낅젰"
                        />
                        <button className="btn-primary" disabled={memberLoading} onClick={fetchMemberDetail}>
                            {memberLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UserSearch className="h-4 w-4" />}
                            <span className="ml-2">議고쉶</span>
                        </button>
                    </div>

                    {memberError ? (
                        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                            {memberError}
                        </div>
                    ) : null}

                    {!memberLoading && !memberError && !memberDetail ? (
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 text-sm text-slate-500">
                            ?뚯썝 ID瑜??낅젰?섍퀬 議고쉶?섏꽭??
                        </div>
                    ) : null}
                </div>
            </div>

            {memberDetail ? (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="card p-6 xl:col-span-1 space-y-3">
                        <h3 className="text-base font-black text-slate-900">湲곕낯 ?뺣낫</h3>
                        <div className="text-sm"><b>ID:</b> {pick(memberInfo, "memberId", "member_id", "-")}</div>
                        <div className="text-sm"><b>?대찓??</b> {pick(memberInfo, "email", "email", "-")}</div>
                        <div className="text-sm"><b>?대쫫:</b> {pick(memberInfo, "name", "name", "-")}</div>
                        <div className="text-sm"><b>?곹깭:</b> {pick(memberInfo, "memberStatus", "member_status", "-")}</div>
                        <div className="text-sm"><b>沅뚰븳:</b> {(pick(memberInfo, "roles", "roles", []) || []).join(", ") || "-"}</div>
                        <div className="text-sm"><b>?ъ씤??</b> {pick(memberInfo, "point", "point", 0)}</div>
                        <div className="text-sm"><b>?섎Т:</b> {pick(memberInfo, "treeCount", "tree_count", 0)}</div>
                        <div className="text-sm"><b>寃뚯떆湲:</b> {pick(memberInfo, "boardCount", "board_count", 0)}</div>
                        <div className="text-sm"><b>?볤?:</b> {pick(memberInfo, "commentCount", "comment_count", 0)}</div>
                    </div>

                    <div className="card p-6 xl:col-span-2">
                        <h3 className="mb-3 text-base font-black text-slate-900">理쒓렐 寃뚯떆湲 / ?볤?</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="rounded-2xl bg-slate-50/50 p-4">
                                <div className="mb-2 text-xs font-black text-slate-500 uppercase">Recent Boards</div>
                                {!recentBoards.length ? <div className="text-xs text-slate-400">?곗씠???놁쓬</div> : (
                                    <ul className="space-y-2 text-sm">
                                        {recentBoards.map((board, idx) => (
                                            <li key={`${pick(board, "boardId", "board_id", idx)}-${idx}`} className="flex items-center justify-between gap-2">
                                                <span className="truncate">#{pick(board, "boardId", "board_id", "-")} {pick(board, "title", "title", "-")}</span>
                                                <span className={`text-[10px] font-black ${pick(board, "hiddenYn", "hidden_yn", false) ? "text-rose-600" : "text-emerald-600"}`}>
                                                    {pick(board, "hiddenYn", "hidden_yn", false) ? "HIDDEN" : "VISIBLE"}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <div className="rounded-2xl bg-slate-50/50 p-4">
                                <div className="mb-2 text-xs font-black text-slate-500 uppercase">Recent Comments</div>
                                {!recentComments.length ? <div className="text-xs text-slate-400">?곗씠???놁쓬</div> : (
                                    <ul className="space-y-2 text-sm">
                                        {recentComments.map((comment, idx) => (
                                            <li key={`${pick(comment, "commentId", "comment_id", idx)}-${idx}`} className="flex items-center justify-between gap-2">
                                                <span className="truncate">#{pick(comment, "commentId", "comment_id", "-")} {pick(comment, "contents", "contents", "-")}</span>
                                                <span className={`text-[10px] font-black ${pick(comment, "hiddenYn", "hidden_yn", false) ? "text-rose-600" : "text-emerald-600"}`}>
                                                    {pick(comment, "hiddenYn", "hidden_yn", false) ? "HIDDEN" : "VISIBLE"}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="card p-6 xl:col-span-3 grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="rounded-2xl bg-slate-50/50 p-4">
                            <div className="mb-2 text-xs font-black text-slate-500 uppercase">Sanctions</div>
                            {!sanctions.length ? <div className="text-xs text-slate-400">?곗씠???놁쓬</div> : (
                                <ul className="space-y-2 text-sm">
                                    {sanctions.map((item, idx) => (
                                        <li key={`${pick(item, "sanctionId", "sanction_id", idx)}-${idx}`}>
                                            #{pick(item, "sanctionId", "sanction_id", "-")} {pick(item, "sanctionStatus", "sanction_status", "-")}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div className="rounded-2xl bg-slate-50/50 p-4">
                            <div className="mb-2 text-xs font-black text-slate-500 uppercase">Received Reports</div>
                            {!receivedReports.length ? <div className="text-xs text-slate-400">?곗씠???놁쓬</div> : (
                                <ul className="space-y-2 text-sm">
                                    {receivedReports.map((item, idx) => (
                                        <li key={`${pick(item, "reportId", "report_id", idx)}-${idx}`}>
                                            #{pick(item, "reportId", "report_id", "-")} {pick(item, "reportStatus", "report_status", "-")}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div className="rounded-2xl bg-slate-50/50 p-4">
                            <div className="mb-2 text-xs font-black text-slate-500 uppercase">Made Reports</div>
                            {!madeReports.length ? <div className="text-xs text-slate-400">?곗씠???놁쓬</div> : (
                                <ul className="space-y-2 text-sm">
                                    {madeReports.map((item, idx) => (
                                        <li key={`${pick(item, "reportId", "report_id", idx)}-${idx}`}>
                                            #{pick(item, "reportId", "report_id", "-")} {pick(item, "reportStatus", "report_status", "-")}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
        </section>
    );
};

