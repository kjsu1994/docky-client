import { Header } from "./Header.jsx";
import { BottomNavEntry } from "./BottomNavEntry.jsx";
import { CustomCursorEntry } from "./CustomCursorEntry.jsx";
import { FloatingChatEntry } from "./FloatingChatEntry.jsx";
import { PageGuideButtonEntry } from "../common/PageGuideButtonEntry.jsx";

export const ProtectedAppLayout = ({ children }) => (
    <div className="min-h-screen relative overflow-hidden">
        <a
            href="#app-main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-slate-900 focus:px-4 focus:py-3 focus:text-sm focus:font-black focus:text-white focus:outline-none focus:ring-4 focus:ring-sky-200"
        >
            본문으로 건너뛰기
        </a>
        <CustomCursorEntry />
        <div className="bg-vibe" />

        <Header />
        <main id="app-main" tabIndex={-1} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 pb-28 lg:pb-8 relative z-10 focus:outline-none">
            {children}
        </main>
        <PageGuideButtonEntry />
        <FloatingChatEntry />
        <BottomNavEntry />
    </div>
);

export default ProtectedAppLayout;
