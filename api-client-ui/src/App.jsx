import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { LoadingPage } from "./components/LoadingSpinner";
import { Header } from "./components/Header";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Home } from "./pages/Home";
import { BoardList } from "./pages/BoardList";
import { BoardDetail } from "./pages/BoardDetail";
import { BoardForm } from "./pages/BoardForm";
import { Mypage } from "./pages/Mypage.jsx";
import { MypageEdit } from "./pages/MypageEdit.jsx";
import { Ranks } from "./pages/Ranks.jsx";
import { News } from "./pages/News.jsx";
import { Calculators } from "./pages/Calculators.jsx";
import { GptQuestion } from "./pages/GptQuestion.jsx";
import { Statistics } from "./pages/Statistics.jsx";
import { LuckyPlinko } from "./pages/LuckyPlinko.jsx";
import { Queue } from "./pages/Queue.jsx";
import { MeetingOptimizer } from "./pages/MeetingOptimizer.jsx";
import { AdminAnomalies } from "./pages/AdminAnomalies.jsx";
import { Chat } from "./pages/Chat.jsx";
import { AllMenu } from "./pages/AllMenu.jsx";
import { FloatingChat } from "./components/FloatingChat.jsx";
import { BottomNav } from "./components/BottomNav.jsx";

const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) return <LoadingPage />;
    if (!isAuthenticated) return <Navigate to="/login" replace />;

    return children;
};

const AppLayout = ({ children }) => {
    return (
        <div className="min-h-screen bg-slate-50 relative">
            <Header />
            <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 pb-28 lg:pb-8">{children}</main>
            <FloatingChat />
            <BottomNav />
        </div>
    );
};

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
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
                    <Route path="/app/all-menu" element={<ProtectedRoute><AppLayout><AllMenu /></AppLayout></ProtectedRoute>} />

                    <Route path="/app/statistics" element={<ProtectedRoute><AppLayout><Statistics /></AppLayout></ProtectedRoute>} />
                    <Route path="/app/ranks" element={<ProtectedRoute><AppLayout><Ranks /></AppLayout></ProtectedRoute>} />
                    <Route path="/app/news" element={<ProtectedRoute><AppLayout><News /></AppLayout></ProtectedRoute>} />
                    <Route path="/app/calculators" element={<ProtectedRoute><AppLayout><Calculators /></AppLayout></ProtectedRoute>} />
                    <Route path="/app/mypage" element={<ProtectedRoute><AppLayout><Mypage /></AppLayout></ProtectedRoute>} />
                    <Route path="/app/mypage/edit" element={<ProtectedRoute><AppLayout><MypageEdit /></AppLayout></ProtectedRoute>} />
                    <Route path="/app/gpt" element={<ProtectedRoute><AppLayout><GptQuestion /></AppLayout></ProtectedRoute>} />
                    <Route path="/app/plinko" element={<ProtectedRoute><AppLayout><LuckyPlinko /></AppLayout></ProtectedRoute>} />
                    <Route path="/app/optimizer" element={<ProtectedRoute><AppLayout><MeetingOptimizer /></AppLayout></ProtectedRoute>} />
                    <Route path="/app/admin/anomalies" element={<ProtectedRoute><AppLayout><AdminAnomalies /></AppLayout></ProtectedRoute>} />

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
                        },
                        success: { iconTheme: { primary: "#16a34a", secondary: "#ffffff" } },
                        error: { iconTheme: { primary: "#dc2626", secondary: "#ffffff" } },
                    }}
                />
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
