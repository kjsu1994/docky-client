import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

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

    useEffect(() => {
        window.setTimeout(() => inputRef.current?.focus(), 0);
    }, []);

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
            aria-label={title}
        >
            <div className="text-sm font-black text-slate-900">{title}</div>
            {description ? <p className="mt-2 text-xs font-bold leading-relaxed text-slate-500">{description}</p> : null}
            <label className="mt-4 block text-[11px] font-black text-slate-500">{label}</label>
            <input
                ref={inputRef}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-100"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={placeholder}
                inputMode={inputMode}
                maxLength={maxLength}
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                    type="button"
                    className="min-h-10 rounded-xl bg-slate-100 px-3 text-sm font-black text-slate-700 transition hover:bg-slate-200"
                    onClick={() => settle(null, item.id)}
                >
                    {cancelText}
                </button>
                <button
                    type="submit"
                    className="min-h-10 rounded-xl bg-slate-900 px-3 text-sm font-black text-white transition hover:bg-primary-600 disabled:bg-slate-300"
                    disabled={!canSubmit}
                >
                    {confirmText}
                </button>
            </div>
        </form>
    );
};

export const promptAction = ({
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
} = {}) => new Promise((resolve) => {
    let settled = false;
    const settle = (value, toastId) => {
        if (settled) return;
        settled = true;
        if (toastId) toast.dismiss(toastId);
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
