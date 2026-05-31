import toast from "react-hot-toast";

export const confirmAction = ({
    title = "작업을 계속할까요?",
    description = "이 작업은 바로 적용됩니다.",
    confirmText = "확인",
    cancelText = "취소",
    tone = "danger",
} = {}) => new Promise((resolve) => {
    let settled = false;
    const settle = (value, toastId) => {
        if (settled) return;
        settled = true;
        if (toastId) toast.dismiss(toastId);
        resolve(value);
    };

    toast.custom((item) => (
        <div
            className={`pointer-events-auto w-[min(92vw,380px)] rounded-2xl border bg-white p-4 shadow-2xl ${
                item.visible ? "animate-enter" : "animate-leave"
            } ${tone === "danger" ? "border-rose-100" : "border-slate-200"}`}
            role="alertdialog"
            aria-modal="true"
            aria-label={title}
        >
            <div className="text-sm font-black text-slate-900">{title}</div>
            <p className="mt-2 text-xs font-bold leading-relaxed text-slate-500">{description}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                    type="button"
                    className="min-h-10 rounded-xl bg-slate-100 px-3 text-sm font-black text-slate-700 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
                    onClick={() => settle(false, item.id)}
                >
                    {cancelText}
                </button>
                <button
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
    ), {
        duration: Infinity,
        position: "bottom-center",
        onClose: () => settle(false),
    });
});
