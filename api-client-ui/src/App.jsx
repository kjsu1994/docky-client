import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { LoadingPage } from "./components/LoadingSpinner";
import { Header } from "./components/Header";
import { Login } from "./pages/access/Login.jsx";
import { Register } from "./pages/access/Register.jsx";
import { Home } from "./pages/home/Home.jsx";
import { BoardList } from "./pages/boards/BoardList.jsx";
import { BoardDetail } from "./pages/boards/BoardDetail.jsx";
import { BoardForm } from "./pages/boards/BoardForm.jsx";
import { Mypage } from "./pages/home/Mypage.jsx";
import { MypageEdit } from "./pages/home/MypageEdit.jsx";
import { Ranks } from "./pages/home/Ranks.jsx";
import { News } from "./pages/facility/News.jsx";
import { Statistics } from "./pages/home/Statistics.jsx";
import { LuckyPlinko } from "./pages/games/LuckyPlinko.jsx";
import { Queue } from "./pages/access/Queue.jsx";
import { MeetingOptimizer } from "./pages/facility/MeetingOptimizer.jsx";
import { FacilityFinder } from "./pages/facility/FacilityFinder.jsx";
import { AdminAnomalies } from "./pages/admin/AdminAnomalies.jsx";
import { AdminOperations } from "./pages/admin/AdminOperations.jsx";
import { Chat } from "./pages/chat/Chat.jsx";
import { AllMenu } from "./pages/home/AllMenu.jsx";
import { TodoCalendar } from "./pages/facility/TodoCalendar.jsx";
import { StreamingHub } from "./pages/streaming/StreamingHub.jsx";
import { AdminStreamingStudio } from "./pages/admin/AdminStreamingStudio.jsx";
import { InvestAssistant } from "./pages/facility/InvestAssistant.jsx";
import { LasVegasGame } from "./pages/games/LasVegasGame.jsx";
import { GamesHub } from "./pages/games/GamesHub.jsx";
import { NoThanksGame } from "./pages/games/NoThanksGame.jsx";
import { FloatingChat } from "./components/FloatingChat.jsx";
import { BottomNav } from "./components/BottomNav.jsx";
import { CustomCursor } from "./components/CustomCursor.jsx";
import { GlobalNetworkIndicator } from "./components/GlobalNetworkIndicator.jsx";

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
            {/* Dynamic Background Blobs */}
            <div className="bg-vibe">
                <div className="bg-vibe-blob" />
                <div className="bg-vibe-blob" />
                <div className="bg-vibe-blob" />
            </div>
            
            <Header />
            <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 pb-28 lg:pb-8 relative z-10">
                {children}
            </main>
            <FloatingChat />
            <BottomNav />
        </div>
    );
};

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <GlobalNetworkIndicator />
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/queue" element={<Queue />} />

                    <Route path="/app" element={<ProtectedRoute><AppLayout><Home /></AppLayout></ProtectedRoute>} />
                    <Route path="/app/boards/:kind" element={<ProtectedRoute><AppLayout><BoardList /></AppLayout></ProtectedRoute>} />
                    <Route path="/app/boards/:kind/new" element={<ProtectedRoute><AppLayout><BoardForm /></AppLayout></ProtectedRoute>} />
                    <Route path="/app/boards/:kind/:boardId/edit" element={<ProtectedRoute><AppLayout><BoardForm /></AppLayout></ProtectedRoute>} />
                    <Route path="/app/boards/:kind/:boardId" element={<ProtectedRoute><AppLayout><BoardDetail /></AppLayout></ProtectedRoute>} />

                    <Route path="/app/chat" element={<ProtectedRoute><AppLayout><Chat /></AppLayout></ProtectedRoute>} />
                    <Route path="/app/todos" element={<ProtectedRoute><AppLayout><TodoCalendar /></AppLayout></ProtectedRoute>} />
                    <Route path="/app/streaming" element={<ProtectedRoute><AppLayout><StreamingHub /></AppLayout></ProtectedRoute>} />
                    <Route path="/app/invest" element={<ProtectedRoute><AppLayout><InvestAssistant /></AppLayout></ProtectedRoute>} />
                    <Route path="/app/all-menu" element={<ProtectedRoute><AppLayout><AllMenu /></AppLayout></ProtectedRoute>} />
                    <Route path="/app/games" element={<ProtectedRoute><AppLayout><GamesHub /></AppLayout></ProtectedRoute>} />

                    <Route path="/app/statistics" element={<ProtectedRoute><AppLayout><Statistics /></AppLayout></ProtectedRoute>} />
                    <Route path="/app/ranks" element={<ProtectedRoute><AppLayout><Ranks /></AppLayout></ProtectedRoute>} />
                    <Route path="/app/news" element={<ProtectedRoute><AppLayout><News /></AppLayout></ProtectedRoute>} />
                    <Route path="/app/mypage" element={<ProtectedRoute><AppLayout><Mypage /></AppLayout></ProtectedRoute>} />
                    <Route path="/app/mypage/edit" element={<ProtectedRoute><AppLayout><MypageEdit /></AppLayout></ProtectedRoute>} />
                    <Route path="/app/plinko" element={<ProtectedRoute><AppLayout><LuckyPlinko /></AppLayout></ProtectedRoute>} />
                    <Route path="/app/games/las-vegas" element={<ProtectedRoute><AppLayout><LasVegasGame /></AppLayout></ProtectedRoute>} />
                    <Route path="/app/games/no-thanks" element={<ProtectedRoute><AppLayout><NoThanksGame /></AppLayout></ProtectedRoute>} />
                    <Route path="/app/optimizer" element={<ProtectedRoute><AppLayout><MeetingOptimizer /></AppLayout></ProtectedRoute>} />
                    <Route path="/app/facility" element={<ProtectedRoute><AppLayout><FacilityFinder /></AppLayout></ProtectedRoute>} />
                    <Route path="/app/parking" element={<Navigate to="/app/facility" replace />} />
                    <Route path="/app/admin/anomalies" element={<ProtectedRoute><AppLayout><AdminAnomalies /></AppLayout></ProtectedRoute>} />
                    <Route path="/app/admin/operations" element={<ProtectedRoute><AppLayout><AdminOperations /></AppLayout></ProtectedRoute>} />
                    <Route path="/app/admin/streaming" element={<ProtectedRoute><AppLayout><AdminStreamingStudio /></AppLayout></ProtectedRoute>} />

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








