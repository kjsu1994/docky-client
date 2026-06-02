import { lazy, Suspense, useEffect, useState } from "react";

const ToastViewport = lazy(() =>
    import("./ToastViewport.jsx").then((module) => ({ default: module.ToastViewport }))
);

export const ToastViewportEntry = () => {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") {
            return undefined;
        }

        if ("requestIdleCallback" in window) {
            const idleId = window.requestIdleCallback(() => setReady(true), { timeout: 1500 });
            return () => window.cancelIdleCallback?.(idleId);
        }

        const timerId = window.setTimeout(() => setReady(true), 250);
        return () => window.clearTimeout(timerId);
    }, []);

    if (!ready) return null;

    return (
        <Suspense fallback={null}>
            <ToastViewport />
        </Suspense>
    );
};

export default ToastViewportEntry;
