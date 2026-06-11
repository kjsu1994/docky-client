import { lazy, Suspense, useEffect, useState } from "react";

const PageGuideButton = lazy(() =>
    import("./PageGuideButton.jsx").then((module) => ({ default: module.PageGuideButton }))
);

export const PageGuideButtonEntry = () => {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") {
            return undefined;
        }

        if ("requestIdleCallback" in window) {
            const idleId = window.requestIdleCallback(() => setReady(true), { timeout: 2000 });
            return () => window.cancelIdleCallback?.(idleId);
        }

        const timerId = window.setTimeout(() => setReady(true), 500);
        return () => window.clearTimeout(timerId);
    }, []);

    if (!ready) return null;

    return (
        <Suspense fallback={null}>
            <PageGuideButton />
        </Suspense>
    );
};

export default PageGuideButtonEntry;
