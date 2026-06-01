import { useEffect, useRef, useState } from "react";

const shouldEnableCustomCursor = () => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

export const CustomCursor = () => {
    const [enabled, setEnabled] = useState(shouldEnableCustomCursor);
    const dotRef = useRef(null);
    const outlineRef = useRef(null);
    const frameRef = useRef(0);
    const positionRef = useRef({ x: -9999, y: -9999 });
    const hoveringRef = useRef(false);
    const clickedRef = useRef(false);

    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return undefined;
        const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
        const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
        const syncEnabled = () => setEnabled(finePointerQuery.matches && !reducedMotionQuery.matches);

        syncEnabled();
        finePointerQuery.addEventListener?.("change", syncEnabled);
        reducedMotionQuery.addEventListener?.("change", syncEnabled);
        return () => {
            finePointerQuery.removeEventListener?.("change", syncEnabled);
            reducedMotionQuery.removeEventListener?.("change", syncEnabled);
        };
    }, []);

    useEffect(() => {
        if (!enabled) return undefined;

        const renderCursor = () => {
            frameRef.current = 0;
            const { x, y } = positionRef.current;
            const dotScale = clickedRef.current ? 0.8 : 1;
            const outlineScale = (hoveringRef.current ? 1.5 : 1) * (clickedRef.current ? 1.1 : 1);

            if (dotRef.current) {
                dotRef.current.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${dotScale})`;
            }
            if (outlineRef.current) {
                outlineRef.current.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${outlineScale})`;
                outlineRef.current.classList.toggle("cursor-hover", hoveringRef.current);
            }
        };

        const scheduleRender = () => {
            if (frameRef.current) return;
            frameRef.current = window.requestAnimationFrame(renderCursor);
        };

        const moveCursor = (e) => {
            positionRef.current = { x: e.clientX, y: e.clientY };
            scheduleRender();
        };

        const handleMouseOver = (e) => {
            // React state를 거치지 않고 DOM transform만 갱신해 pointermove 렌더 비용을 줄인다.
            hoveringRef.current = e.target instanceof Element &&
                Boolean(e.target.closest("button, a, input, select, textarea, .spotlight-card"));
            scheduleRender();
        };

        const handleMouseDown = () => {
            clickedRef.current = true;
            scheduleRender();
        };
        const handleMouseUp = () => {
            clickedRef.current = false;
            scheduleRender();
        };

        window.addEventListener("pointermove", moveCursor, { passive: true });
        window.addEventListener("pointerover", handleMouseOver, { passive: true });
        window.addEventListener("pointerdown", handleMouseDown, { passive: true });
        window.addEventListener("pointerup", handleMouseUp, { passive: true });

        return () => {
            window.removeEventListener("pointermove", moveCursor);
            window.removeEventListener("pointerover", handleMouseOver);
            window.removeEventListener("pointerdown", handleMouseDown);
            window.removeEventListener("pointerup", handleMouseUp);
            if (frameRef.current) {
                window.cancelAnimationFrame(frameRef.current);
                frameRef.current = 0;
            }
        };
    }, [enabled]);

    if (!enabled) return null;

    return (
        <>
            {/* 중앙 점 */}
            <div
                ref={dotRef}
                className="cursor-dot hidden lg:block"
                style={{ transform: "translate(-9999px, -9999px)" }}
            />
            {/* 외곽 원 */}
            <div
                ref={outlineRef}
                className="cursor-outline hidden lg:block"
                style={{ transform: "translate(-9999px, -9999px)" }}
            />
        </>
    );
};
