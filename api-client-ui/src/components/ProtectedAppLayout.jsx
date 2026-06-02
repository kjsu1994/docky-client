import { Header } from "./Header.jsx";
import { BottomNavEntry } from "./BottomNavEntry.jsx";
import { CustomCursorEntry } from "./CustomCursorEntry.jsx";
import { FloatingChatEntry } from "./FloatingChatEntry.jsx";
import { PageGuideButtonEntry } from "../common/PageGuideButtonEntry.jsx";

export const ProtectedAppLayout = ({ children }) => (
    <div className="min-h-screen relative overflow-hidden">
        <CustomCursorEntry />
        <div className="bg-vibe" />

        <Header />
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 pb-28 lg:pb-8 relative z-10">
            {children}
        </main>
        <PageGuideButtonEntry />
        <FloatingChatEntry />
        <BottomNavEntry />
    </div>
);

export default ProtectedAppLayout;
