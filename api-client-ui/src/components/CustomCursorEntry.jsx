import { lazy, Suspense, useEffect, useState } from "react";

const CustomCursor = lazy(() => import("./CustomCursor.jsx").then((module) => ({ default: module.CustomCursor })));

const canUseCustomCursor = () => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

export const CustomCursorEntry = () => {
    const [eligible, setEligible] = useState(canUseCustomCursor);
    const [activated, setActivated] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return undefined;
        const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
        const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
        const syncEligible = () => setEligible(finePointerQuery.matches && !reducedMotionQuery.matches);

        syncEligible();
        finePointerQuery.addEventListener?.("change", syncEligible);
        reducedMotionQuery.addEventListener?.("change", syncEligible);
        return () => {
            finePointerQuery.removeEventListener?.("change", syncEligible);
            reducedMotionQuery.removeEventListener?.("change", syncEligible);
        };
    }, []);

    useEffect(() => {
        if (!eligible || activated || typeof window === "undefined") return undefined;
        const activate = () => setActivated(true);

        window.addEventListener("pointermove", activate, { passive: true, once: true });
        return () => window.removeEventListener("pointermove", activate);
    }, [activated, eligible]);

    if (!eligible || !activated) return null;

    return (
        <Suspense fallback={null}>
            <CustomCursor />
        </Suspense>
    );
};

export default CustomCursorEntry;
