import { lazy, Suspense, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useBottomNavVisibility } from "../hooks/useBottomNavVisibility.js";

const FloatingChat = lazy(() => import("./FloatingChat.jsx").then((module) => ({ default: module.FloatingChat })));

export const FloatingChatEntry = () => {
    const { isAuthenticated } = useAuth();
    const [activated, setActivated] = useState(false);
    const bottomNav = useBottomNavVisibility();

    if (!isAuthenticated || bottomNav.enabled) return null;

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
            className="fixed bottom-6 right-6 z-[100] flex h-16 w-16 items-center justify-center rounded-[2rem] bg-primary-600 text-white shadow-2xl shadow-primary-200 transition-all duration-300 hover:scale-105 active:scale-95"
            aria-label="채팅창 열기"
            data-floating-chat-launcher="true"
        >
            <MessageCircle className="h-7 w-7" />
        </button>
    );
};

export default FloatingChatEntry;
