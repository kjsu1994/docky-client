import { useEffect, useId, useRef, useState } from "react";
import { Flag, X } from "lucide-react";
import { formatNumber } from "../utils/helpers.js";
import { trapFocus } from "../utils/focusTrap.js";

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
    const dialogRef = useRef(null);
    const reasonRef = useRef(null);
    const titleId = useId();
    const descriptionId = useId();
    const reasonId = useId();
    const detailId = useId();

    useEffect(() => {
        if (!open) return;
        setReason(defaultReason);
        setDetail("");
    }, [open, defaultReason]);

    useEffect(() => {
        if (!open) return undefined;
        const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const focusTimer = window.setTimeout(() => reasonRef.current?.focus(), 0);

        return () => {
            window.clearTimeout(focusTimer);
            document.body.style.overflow = previousOverflow;
            if (previousFocus?.isConnected) previousFocus.focus();
        };
    }, [open]);

    useEffect(() => {
        if (!open) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === "Escape" && !submitting) {
                onClose?.();
                return;
            }
            trapFocus(event, dialogRef.current);
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open, onClose, submitting]);

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

    const handleBackdropMouseDown = (event) => {
        if (event.target === event.currentTarget && !submitting) {
            onClose?.();
        }
    };

    return (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onMouseDown={handleBackdropMouseDown}>
            <form
                ref={dialogRef}
                onSubmit={handleSubmit}
                className="modal-panel w-full max-w-md p-6"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
            >
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                        <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                            <Flag className="h-5 w-5" />
                        </div>
                        <h2 id={titleId} className="text-xl font-black text-ink">{targetLabel} 신고</h2>
                        <p id={descriptionId} className="mt-1 text-sm font-medium text-ink-muted">운영자가 검토할 내용을 입력해 주세요.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="icon-button"
                        aria-label="신고 닫기"
                        disabled={submitting}
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <label htmlFor={reasonId} className="mb-2 block text-xs font-black text-ink-muted">신고 사유</label>
                <input
                    id={reasonId}
                    ref={reasonRef}
                    className="input-base mb-4 w-full"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    maxLength={REPORT_REASON_MAX_LENGTH}
                    placeholder="신고 사유를 입력해 주세요"
                    disabled={submitting}
                    required
                />
                <div className="-mt-3 mb-4 text-right text-xs font-medium text-ink-subtle">
                    {formatNumber(reasonLength)} / {formatNumber(REPORT_REASON_MAX_LENGTH)}
                </div>

                <label htmlFor={detailId} className="mb-2 block text-xs font-black text-ink-muted">상세 내용 (선택)</label>
                <textarea
                    id={detailId}
                    className="input-base min-h-[120px] w-full resize-none"
                    value={detail}
                    onChange={(event) => setDetail(event.target.value)}
                    maxLength={REPORT_DETAIL_MAX_LENGTH}
                    placeholder="운영자가 확인할 수 있는 구체적인 내용을 입력해 주세요"
                    disabled={submitting}
                />
                <div className="mt-1 text-right text-xs font-medium text-ink-subtle">
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
