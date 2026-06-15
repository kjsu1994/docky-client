import { Toaster } from "react-hot-toast";

export const ToastViewport = () => (
    <Toaster
        position="bottom-left"
        toastOptions={{
            duration: 3000,
            style: {
                background: "rgb(var(--color-surface-overlay) / 0.94)",
                color: "rgb(var(--color-text))",
                boxShadow: "var(--shadow-modal)",
                borderRadius: "var(--radius-panel)",
                padding: "12px 16px",
                border: "1px solid rgb(var(--color-border) / 0.72)",
                backdropFilter: "blur(14px)",
            },
            success: { iconTheme: { primary: "#16a34a", secondary: "#ffffff" } },
            error: { iconTheme: { primary: "#dc2626", secondary: "#ffffff" } },
            loading: { iconTheme: { primary: "#0284c7", secondary: "#ffffff" } },
        }}
    />
);

export default ToastViewport;
