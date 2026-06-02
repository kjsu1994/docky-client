import { Toaster } from "react-hot-toast";

export const ToastViewport = () => (
    <Toaster
        position="bottom-left"
        toastOptions={{
            duration: 3000,
            style: {
                background: "#ffffff",
                color: "#0f172a",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                borderRadius: "12px",
                padding: "12px 16px",
                border: "1px solid #e2e8f0",
            },
            success: { iconTheme: { primary: "#16a34a", secondary: "#ffffff" } },
            error: { iconTheme: { primary: "#dc2626", secondary: "#ffffff" } },
            loading: { iconTheme: { primary: "#0284c7", secondary: "#ffffff" } },
        }}
    />
);

export default ToastViewport;
