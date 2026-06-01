import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { LoadingPage } from "./components/LoadingSpinner";
import { Header } from "./components/Header";
import { Login } from "./pages/access/Login.jsx";
import { Register } from "./pages/access/Register.jsx";
import { Queue } from "./pages/access/Queue.jsx";
import { BottomNav } from "./components/BottomNav.jsx";
import { CustomCursor } from "./components/CustomCursor.jsx";
import { GlobalNetworkIndicator } from "./components/GlobalNetworkIndicator.jsx";
import { PageGuideButton } from "./common/PageGuideButton.jsx";
import { FloatingChatEntry } from "./components/FloatingChatEntry.jsx";

const Home = lazy(() => import("./pages/home/Home.jsx").then((module) => ({ default: module.Home })));
const BoardList = lazy(() => import("./pages/boards/BoardList.jsx").then((module) => ({ default: module.BoardList })));
const BoardDetail = lazy(() => import("./pages/boards/BoardDetail.jsx").then((module) => ({ default: module.BoardDetail })));
const BoardForm = lazy(() => import("./pages/boards/BoardForm.jsx").then((module) => ({ default: module.BoardForm })));
const Chat = lazy(() => import("./pages/chat/Chat.jsx").then((module) => ({ default: module.Chat })));
const TodoCalendar = lazy(() => import("./pages/facility/TodoCalendar.jsx").then((module) => ({ default: module.TodoCalendar })));
const StreamingHub = lazy(() => import("./pages/streaming/StreamingHub.jsx").then((module) => ({ default: module.StreamingHub })));
const InvestAssistant = lazy(() => import("./pages/facility/InvestAssistant.jsx").then((module) => ({ default: module.InvestAssistant })));
const AllMenu = lazy(() => import("./pages/home/AllMenu.jsx").then((module) => ({ default: module.AllMenu })));
const GamesHub = lazy(() => import("./pages/games/GamesHub.jsx").then((module) => ({ default: module.GamesHub })));
const Statistics = lazy(() => import("./pages/home/Statistics.jsx").then((module) => ({ default: module.Statistics })));
const Ranks = lazy(() => import("./pages/home/Ranks.jsx").then((module) => ({ default: module.Ranks })));
const News = lazy(() => import("./pages/facility/News.jsx").then((module) => ({ default: module.News })));
const Mypage = lazy(() => import("./pages/home/Mypage.jsx").then((module) => ({ default: module.Mypage })));
const MypageEdit = lazy(() => import("./pages/home/MypageEdit.jsx").then((module) => ({ default: module.MypageEdit })));
const LuckyPlinko = lazy(() => import("./pages/games/LuckyPlinko.jsx").then((module) => ({ default: module.LuckyPlinko })));
const LasVegasGame = lazy(() => import("./pages/games/LasVegasGame.jsx").then((module) => ({ default: module.LasVegasGame })));
const NoThanksGame = lazy(() => import("./pages/games/NoThanksGame.jsx").then((module) => ({ default: module.NoThanksGame })));
const CatanGame = lazy(() => import("./pages/games/TabletopGame.jsx").then((module) => ({ default: module.CatanGame })));
const BlokusGame = lazy(() => import("./pages/games/TabletopGame.jsx").then((module) => ({ default: module.BlokusGame })));
const MaheGame = lazy(() => import("./pages/games/TabletopGame.jsx").then((module) => ({ default: module.MaheGame })));
const DalmutiGame = lazy(() => import("./pages/games/TabletopGame.jsx").then((module) => ({ default: module.DalmutiGame })));
const MeetingOptimizer = lazy(() => import("./pages/facility/MeetingOptimizer.jsx").then((module) => ({ default: module.MeetingOptimizer })));
const FacilityFinder = lazy(() => import("./pages/facility/FacilityFinder.jsx").then((module) => ({ default: module.FacilityFinder })));
const AdminAnomalies = lazy(() => import("./pages/admin/AdminAnomalies.jsx").then((module) => ({ default: module.AdminAnomalies })));
const AdminOperations = lazy(() => import("./pages/admin/AdminOperations.jsx").then((module) => ({ default: module.AdminOperations })));
const AdminStreamingStudio = lazy(() => import("./pages/admin/AdminStreamingStudio.jsx").then((module) => ({ default: module.AdminStreamingStudio })));

const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) return <LoadingPage />;
    if (!isAuthenticated) return <Navigate to="/login" replace />;

    return children;
};

const AppLayout = ({ children }) => {
    return (
        <div className="min-h-screen relative overflow-hidden">
            <CustomCursor />
            <div className="bg-vibe" />
            
            <Header />
            <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 pb-28 lg:pb-8 relative z-10">
                {children}
            </main>
            <FloatingChatEntry />
            <BottomNav />
        </div>
    );
};

const AppRoute = ({ children }) => (
    <ProtectedRoute>
        <AppLayout>
            <Suspense fallback={<LoadingPage />}>
                {children}
            </Suspense>
        </AppLayout>
    </ProtectedRoute>
);

const GameRoute = AppRoute;

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <GlobalNetworkIndicator />
                <PageGuideButton />
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/queue" element={<Queue />} />

                    <Route path="/app" element={<AppRoute><Home /></AppRoute>} />
                    <Route path="/app/boards/:kind" element={<AppRoute><BoardList /></AppRoute>} />
                    <Route path="/app/boards/:kind/new" element={<AppRoute><BoardForm /></AppRoute>} />
                    <Route path="/app/boards/:kind/:boardId/edit" element={<AppRoute><BoardForm /></AppRoute>} />
                    <Route path="/app/boards/:kind/:boardId" element={<AppRoute><BoardDetail /></AppRoute>} />

                    <Route path="/app/chat" element={<AppRoute><Chat /></AppRoute>} />
                    <Route path="/app/todos" element={<AppRoute><TodoCalendar /></AppRoute>} />
                    <Route path="/app/streaming" element={<AppRoute><StreamingHub /></AppRoute>} />
                    <Route path="/app/invest" element={<AppRoute><InvestAssistant /></AppRoute>} />
                    <Route path="/app/all-menu" element={<AppRoute><AllMenu /></AppRoute>} />
                    <Route path="/app/games" element={<GameRoute><GamesHub /></GameRoute>} />

                    <Route path="/app/statistics" element={<AppRoute><Statistics /></AppRoute>} />
                    <Route path="/app/ranks" element={<AppRoute><Ranks /></AppRoute>} />
                    <Route path="/app/news" element={<AppRoute><News /></AppRoute>} />
                    <Route path="/app/mypage" element={<AppRoute><Mypage /></AppRoute>} />
                    <Route path="/app/mypage/edit" element={<AppRoute><MypageEdit /></AppRoute>} />
                    <Route path="/app/plinko" element={<AppRoute><LuckyPlinko /></AppRoute>} />
                    <Route path="/app/games/las-vegas" element={<GameRoute><LasVegasGame /></GameRoute>} />
                    <Route path="/app/games/no-thanks" element={<GameRoute><NoThanksGame /></GameRoute>} />
                    <Route path="/app/games/catan" element={<GameRoute><CatanGame /></GameRoute>} />
                    <Route path="/app/games/blokus" element={<GameRoute><BlokusGame /></GameRoute>} />
                    <Route path="/app/games/mahe" element={<GameRoute><MaheGame /></GameRoute>} />
                    <Route path="/app/games/dalmuti" element={<GameRoute><DalmutiGame /></GameRoute>} />
                    <Route path="/app/optimizer" element={<AppRoute><MeetingOptimizer /></AppRoute>} />
                    <Route path="/app/facility" element={<AppRoute><FacilityFinder /></AppRoute>} />
                    <Route path="/app/parking" element={<Navigate to="/app/facility" replace />} />
                    <Route path="/app/admin/anomalies" element={<AppRoute><AdminAnomalies /></AppRoute>} />
                    <Route path="/app/admin/operations" element={<AppRoute><AdminOperations /></AppRoute>} />
                    <Route path="/app/admin/streaming" element={<AppRoute><AdminStreamingStudio /></AppRoute>} />

                    <Route path="/" element={<Navigate to="/app" replace />} />
                    <Route path="*" element={<Navigate to="/app" replace />} />
                </Routes>

                <Toaster
                    position="bottom-left"
                    toastOptions={{
                        duration: 3000,
                        style: {
                            background: "#ffffff",
                            color: "#0f172a",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            borderRadius: "12px",
                            padding: "12px 16px",
                            border: "1px solid #e2e8f0",
                        },
                        success: { iconTheme: { primary: "#16a34a", secondary: "#ffffff" } },
                        error: { iconTheme: { primary: "#dc2626", secondary: "#ffffff" } },
                        loading: { iconTheme: { primary: "#0284c7", secondary: "#ffffff" } },
                    }}
                />
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;








