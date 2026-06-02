import { lazy, Suspense, useEffect, useState } from "react";

const BottomNav = lazy(() => import("./BottomNav.jsx").then((module) => ({ default: module.BottomNav })));

const shouldLoadBottomNav = () => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(max-width: 1023px)").matches;
};

export const BottomNavEntry = () => {
    const [enabled, setEnabled] = useState(shouldLoadBottomNav);

    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return undefined;
        const query = window.matchMedia("(max-width: 1023px)");
        const syncEnabled = () => setEnabled(query.matches);

        syncEnabled();
        query.addEventListener?.("change", syncEnabled);
        return () => query.removeEventListener?.("change", syncEnabled);
    }, []);

    if (!enabled) return null;

    return (
        <Suspense fallback={null}>
            <BottomNav />
        </Suspense>
    );
};

export default BottomNavEntry;
