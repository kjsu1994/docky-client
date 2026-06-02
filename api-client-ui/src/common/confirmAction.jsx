import { useEffect, useRef } from "react";
import { trapFocus } from "../utils/focusTrap.js";
import { loadToast } from "../utils/toast.js";

const restoreFocus = (previousFocus) => {
    if (typeof window === "undefined") return;
    window.setTimeout(() => {
        if (previousFocus?.isConnected && typeof previousFocus.focus === "function") {
            previousFocus.focus();
        }
    }, 0);
};

const ConfirmToast = ({
    item,
    title,
    description,
    confirmText,
    cancelText,
    tone,
    settle,
}) => {
    const cancelRef = useRef(null);
    const confirmRef = useRef(null);
    const titleId = `confirm-title-${item.id}`;
    const descriptionId = `confirm-description-${item.id}`;

    useEffect(() => {
        window.setTimeout(() => cancelRef.current?.focus(), 0);

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                settle(false, item.id);
                return;
            }
            trapFocus(event, [cancelRef.current, confirmRef.current]);
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [item.id, settle]);

    return (
        <div
            className={`pointer-events-auto w-[min(92vw,380px)] rounded-2xl border bg-white p-4 shadow-2xl ${
                item.visible ? "animate-enter" : "animate-leave"
            } ${tone === "danger" ? "border-rose-100" : "border-slate-200"}`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
        >
            <div id={titleId} className="text-sm font-black text-slate-900">{title}</div>
            <p id={descriptionId} className="mt-2 text-xs font-bold leading-relaxed text-slate-500">{description}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                    ref={cancelRef}
                    type="button"
                    className="min-h-10 rounded-xl bg-slate-100 px-3 text-sm font-black text-slate-700 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
                    onClick={() => settle(false, item.id)}
                >
                    {cancelText}
                </button>
                <button
                    ref={confirmRef}
                    type="button"
                    className={`min-h-10 rounded-xl px-3 text-sm font-black text-white transition focus-visible:outline-none focus-visible:ring-4 ${
                        tone === "danger"
                            ? "bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-200"
                            : "bg-slate-900 hover:bg-primary-600 focus-visible:ring-sky-200"
                    }`}
                    onClick={() => settle(true, item.id)}
                >
                    {confirmText}
                </button>
            </div>
        </div>
    );
};

export const confirmAction = async ({
    title = "작업을 계속할까요?",
    description = "이 작업은 바로 적용됩니다.",
    confirmText = "확인",
    cancelText = "취소",
    tone = "danger",
} = {}) => {
    const previousFocus = typeof document !== "undefined"
        && typeof HTMLElement !== "undefined"
        && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    let toast;
    try {
        toast = await loadToast();
    } catch {
        restoreFocus(previousFocus);
        return false;
    }

    return new Promise((resolve) => {
        let settled = false;
        const settle = (value, toastId) => {
            if (settled) return;
            settled = true;
            if (toastId) toast.dismiss(toastId);
            restoreFocus(previousFocus);
            resolve(value);
        };

        toast.custom((item) => (
            <ConfirmToast
                item={item}
                title={title}
                description={description}
                confirmText={confirmText}
                cancelText={cancelText}
                tone={tone}
                settle={settle}
            />
        ), {
            duration: Infinity,
            position: "bottom-center",
            onClose: () => settle(false),
        });
    });
};
