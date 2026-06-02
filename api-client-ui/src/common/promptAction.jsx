import { useEffect, useRef, useState } from "react";
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

const PromptToast = ({
    item,
    title,
    description,
    label,
    initialValue,
    placeholder,
    confirmText,
    cancelText,
    inputMode,
    required,
    maxLength,
    settle,
}) => {
    const [value, setValue] = useState(initialValue);
    const inputRef = useRef(null);
    const cancelRef = useRef(null);
    const submitRef = useRef(null);
    const titleId = `prompt-title-${item.id}`;
    const descriptionId = `prompt-description-${item.id}`;
    const inputId = `prompt-input-${item.id}`;
    const labelId = `prompt-label-${item.id}`;

    useEffect(() => {
        window.setTimeout(() => inputRef.current?.focus(), 0);

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                settle(null, item.id);
                return;
            }
            trapFocus(event, [inputRef.current, cancelRef.current, submitRef.current]);
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [item.id, settle]);

    const canSubmit = !required || value.trim().length > 0;

    const submit = (event) => {
        event.preventDefault();
        if (!canSubmit) return;
        settle(value, item.id);
    };

    return (
        <form
            onSubmit={submit}
            className={`pointer-events-auto w-[min(92vw,420px)] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl ${
                item.visible ? "animate-enter" : "animate-leave"
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
        >
            <div id={titleId} className="text-sm font-black text-slate-900">{title}</div>
            {description ? <p id={descriptionId} className="mt-2 text-xs font-bold leading-relaxed text-slate-500">{description}</p> : null}
            <label id={labelId} htmlFor={inputId} className="mt-4 block text-[11px] font-black text-slate-500">{label}</label>
            <input
                id={inputId}
                ref={inputRef}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-100"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={placeholder}
                inputMode={inputMode}
                maxLength={maxLength}
                required={required}
                aria-labelledby={labelId}
                aria-required={required}
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                    ref={cancelRef}
                    type="button"
                    className="min-h-10 rounded-xl bg-slate-100 px-3 text-sm font-black text-slate-700 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
                    onClick={() => settle(null, item.id)}
                >
                    {cancelText}
                </button>
                <button
                    ref={submitRef}
                    type="submit"
                    className="min-h-10 rounded-xl bg-slate-900 px-3 text-sm font-black text-white transition hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 disabled:bg-slate-300"
                    disabled={!canSubmit}
                >
                    {confirmText}
                </button>
            </div>
        </form>
    );
};

export const promptAction = async ({
    title = "입력",
    description = "",
    label = "내용",
    initialValue = "",
    placeholder = "",
    confirmText = "확인",
    cancelText = "취소",
    inputMode = "text",
    required = false,
    maxLength = 500,
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
        return null;
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
            <PromptToast
                item={item}
                title={title}
                description={description}
                label={label}
                initialValue={initialValue}
                placeholder={placeholder}
                confirmText={confirmText}
                cancelText={cancelText}
                inputMode={inputMode}
                required={required}
                maxLength={maxLength}
                settle={settle}
            />
        ), {
            duration: Infinity,
            position: "bottom-center",
            onClose: () => settle(null),
        });
    });
};
