import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { CircleHelp } from "lucide-react";
import { useBottomNavVisibility } from "../hooks/useBottomNavVisibility.js";

const PageGuideDialog = lazy(() =>
    import("./PageGuideDialog.jsx").then((module) => ({ default: module.PageGuideDialog }))
);

export const PageGuideButton = () => {
    const location = useLocation();
    const [open, setOpen] = useState(false);
    const dialogId = useId();
    const triggerRef = useRef(null);
    const appRoute = location.pathname.startsWith("/app");
    const bottomNav = useBottomNavVisibility();
    const syncWithBottomNav = appRoute && bottomNav.enabled;
    const hiddenWithBottomNav = syncWithBottomNav && !bottomNav.visible;
    const closeGuide = () => setOpen(false);

    useEffect(() => {
        setOpen(false);
    }, [location.pathname]);

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                className={`fixed z-40 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-white/95 text-slate-700 shadow-lg shadow-slate-900/10 transition-all duration-300 hover:scale-105 hover:bg-slate-900 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 sm:h-11 sm:w-11 sm:right-5 ${
                    appRoute ? "bottom-24 left-4 sm:bottom-auto sm:left-auto sm:top-24" : "right-3 top-4"
                } ${
                    hiddenWithBottomNav ? "pointer-events-none translate-y-8 opacity-0" : "translate-y-0 opacity-100"
                }`}
                onClick={() => setOpen(true)}
                aria-label="페이지 설명 열기"
                aria-haspopup="dialog"
                aria-controls={open ? dialogId : undefined}
                aria-expanded={open}
                title="페이지 설명"
                data-page-guide-trigger="true"
            >
                <CircleHelp className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>

            <Suspense fallback={null}>
                {open && (
                    <PageGuideDialog
                        dialogId={dialogId}
                        pathname={location.pathname}
                        onClose={closeGuide}
                        triggerRef={triggerRef}
                    />
                )}
            </Suspense>
        </>
    );
};
