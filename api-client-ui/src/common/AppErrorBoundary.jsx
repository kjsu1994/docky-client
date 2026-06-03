import React from "react";
import { logClientError } from "../utils/clientDiagnostics.js";

const AppErrorFallback = React.lazy(() =>
    import("./AppErrorFallback.jsx").then((module) => ({ default: module.AppErrorFallback }))
);

const isDynamicImportError = (error) => {
    const text = `${error?.name || ""} ${error?.message || ""}`;
    return /ChunkLoadError|Loading chunk|dynamically imported module|module script/i.test(text);
};

export class AppErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error) {
        logClientError("app.render", error);
        if (isDynamicImportError(error) && typeof window !== "undefined") {
            const key = `ctfmon:chunk-reload:${window.location.pathname}`;
            if (window.sessionStorage?.getItem(key) !== "1") {
                window.sessionStorage?.setItem(key, "1");
                window.location.reload();
            }
        }
    }

    componentDidUpdate(prevProps) {
        if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
            this.setState({ hasError: false });
        }
    }

    handleRetry = () => {
        this.setState({ hasError: false });
    };

    handleReload = () => {
        window.location.reload();
    };

    handleHome = () => {
        window.location.assign("/app");
    };

    render() {
        if (!this.state.hasError) {
            return this.props.children;
        }

        return (
            <React.Suspense
                fallback={(
                    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
                        <section className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center text-center" role="status" aria-live="polite">
                            <h1 className="text-xl font-black tracking-normal text-slate-950">
                                복구 화면을 불러오는 중입니다
                            </h1>
                        </section>
                    </main>
                )}
            >
                <AppErrorFallback
                    onRetry={this.handleRetry}
                    onReload={this.handleReload}
                    onHome={this.handleHome}
                />
            </React.Suspense>
        );
    }
}
