import { lazy, Suspense, useEffect, useState } from "react";
import { Bell } from "lucide-react";

const NotificationCenter = lazy(() =>
    import("./NotificationCenter.jsx").then((module) => ({ default: module.NotificationCenter }))
);

const launcherClass =
    "relative inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700";

const PlaceholderButton = ({ onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={launcherClass}
        title="알림"
        aria-label="알림"
    >
        <Bell className="h-5 w-5" />
    </button>
);

export const NotificationCenterEntry = () => {
    const [active, setActive] = useState(false);
    const [initialOpen, setInitialOpen] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined" || active) return undefined;

        if ("requestIdleCallback" in window) {
            const idleId = window.requestIdleCallback(() => setActive(true), { timeout: 2500 });
            return () => window.cancelIdleCallback?.(idleId);
        }

        const timerId = window.setTimeout(() => setActive(true), 1200);
        return () => window.clearTimeout(timerId);
    }, [active]);

    if (!active) {
        return <PlaceholderButton onClick={() => {
            setInitialOpen(true);
            setActive(true);
        }} />;
    }

    return (
        <Suspense fallback={<PlaceholderButton />}>
            <NotificationCenter initialOpen={initialOpen} />
        </Suspense>
    );
};

export default NotificationCenterEntry;
