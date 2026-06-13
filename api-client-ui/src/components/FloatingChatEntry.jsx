import { lazy, Suspense, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useBottomNavVisibility } from "../hooks/useBottomNavVisibility.js";

const FloatingChat = lazy(() => import("./FloatingChat.jsx").then((module) => ({ default: module.FloatingChat })));

export const FloatingChatEntry = () => {
    const { isAuthenticated } = useAuth();
    const [activated, setActivated] = useState(false);
    const bottomNav = useBottomNavVisibility();
    const hiddenWithBottomNav = bottomNav.enabled && !bottomNav.visible;

    if (!isAuthenticated) return null;

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
            className={`fixed bottom-24 right-4 z-[100] flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-xl shadow-primary-200 transition-all duration-300 hover:scale-105 active:scale-95 lg:bottom-6 lg:right-6 lg:h-16 lg:w-16 lg:rounded-[2rem] lg:shadow-2xl ${
                hiddenWithBottomNav ? "pointer-events-none translate-y-8 opacity-0" : "pointer-events-auto translate-y-0 opacity-100"
            }`}
            aria-label="채팅창 열기"
            data-floating-chat-launcher="true"
        >
            <MessageCircle className="h-5 w-5 lg:h-7 lg:w-7" />
        </button>
    );
};

export default FloatingChatEntry;
