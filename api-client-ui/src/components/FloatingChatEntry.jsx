import { lazy, Suspense, useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const FloatingChat = lazy(() => import("./FloatingChat.jsx").then((module) => ({ default: module.FloatingChat })));

const isMobileViewport = () => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(max-width: 1023px)").matches;
};

export const FloatingChatEntry = () => {
    const { isAuthenticated } = useAuth();
    const [activated, setActivated] = useState(false);
    const [mobileViewport, setMobileViewport] = useState(isMobileViewport);

    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return undefined;
        const query = window.matchMedia("(max-width: 1023px)");
        const syncViewport = () => setMobileViewport(query.matches);

        syncViewport();
        query.addEventListener?.("change", syncViewport);
        return () => query.removeEventListener?.("change", syncViewport);
    }, []);

    if (!isAuthenticated || mobileViewport) return null;

    if (activated) {
        return (
            <Suspense fallback={null}>
                <FloatingChat initialOpen />
            </Suspense>
        );
    }

    return (
        <button
            type="button"
            onClick={() => setActivated(true)}
            className="fixed bottom-24 right-4 z-[100] flex h-12 w-12 translate-y-0 items-center justify-center rounded-2xl bg-primary-600 text-white opacity-100 shadow-xl shadow-primary-200 transition-all duration-300 hover:scale-105 active:scale-95 lg:bottom-6 lg:right-6 lg:h-16 lg:w-16 lg:rounded-[2rem] lg:shadow-2xl"
            aria-label="채팅창 열기"
            data-floating-chat-launcher="true"
        >
            <MessageCircle className="h-5 w-5 lg:h-7 lg:w-7" />
        </button>
    );
};

export default FloatingChatEntry;
