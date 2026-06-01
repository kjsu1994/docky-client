import { useEffect, useRef, useState } from "react";
import { Flag, X } from "lucide-react";
import { formatNumber } from "../utils/helpers.js";

const REPORT_REASON_MAX_LENGTH = 120;
const REPORT_DETAIL_MAX_LENGTH = 2000;

export const ReportDialog = ({
    open,
    targetLabel = "콘텐츠",
    defaultReason = "",
    submitting = false,
    onClose,
    onSubmit,
}) => {
    const [reason, setReason] = useState(defaultReason);
    const [detail, setDetail] = useState("");
    const reasonRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        setReason(defaultReason);
        setDetail("");
        window.setTimeout(() => reasonRef.current?.focus(), 0);
    }, [open, defaultReason]);

    if (!open) return null;

    const trimmedReason = reason.trim();
    const reasonLength = reason.length;
    const detailLength = detail.length;

    const handleSubmit = (event) => {
        event.preventDefault();
        if (!trimmedReason || submitting) return;
        onSubmit?.({
            reason: trimmedReason,
            detail: detail.trim(),
        });
    };

    return (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/50 p-4">
            <form onSubmit={handleSubmit} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                        <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                            <Flag className="h-5 w-5" />
                        </div>
                        <h2 className="text-xl font-black text-slate-900">{targetLabel} 신고</h2>
                        <p className="mt-1 text-sm font-medium text-slate-500">운영자가 검토할 내용을 입력해 주세요.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"
                        aria-label="신고 닫기"
                        disabled={submitting}
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <label className="mb-2 block text-xs font-black text-slate-500">신고 사유</label>
                <input
                    ref={reasonRef}
                    className="input-base mb-4 w-full"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    maxLength={REPORT_REASON_MAX_LENGTH}
                    placeholder="신고 사유를 입력해 주세요"
                    disabled={submitting}
                    required
                />
                <div className="-mt-3 mb-4 text-right text-xs font-medium text-slate-400">
                    {formatNumber(reasonLength)} / {formatNumber(REPORT_REASON_MAX_LENGTH)}
                </div>

                <label className="mb-2 block text-xs font-black text-slate-500">상세 내용 (선택)</label>
                <textarea
                    className="input-base min-h-[120px] w-full resize-none"
                    value={detail}
                    onChange={(event) => setDetail(event.target.value)}
                    maxLength={REPORT_DETAIL_MAX_LENGTH}
                    placeholder="운영자가 확인할 수 있는 구체적인 내용을 입력해 주세요"
                    disabled={submitting}
                />
                <div className="mt-1 text-right text-xs font-medium text-slate-400">
                    {formatNumber(detailLength)} / {formatNumber(REPORT_DETAIL_MAX_LENGTH)}
                </div>

                <div className="mt-5 flex gap-2">
                    <button type="button" className="btn-secondary flex-1" onClick={onClose} disabled={submitting}>
                        취소
                    </button>
                    <button
                        type="submit"
                        className="btn-primary flex-1"
                        disabled={!trimmedReason || submitting}
                        aria-busy={submitting}
                        data-busy-indicator="true"
                    >
                        {submitting ? "접수 중..." : "신고 접수"}
                    </button>
                </div>
            </form>
        </div>
    );
};
