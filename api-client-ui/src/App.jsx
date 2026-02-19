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
import {Mypage} from "./pages/Mypage.jsx";
import { MypageEdit } from "./pages/MypageEdit.jsx";
import {Ranks} from "./pages/Ranks.jsx";
import {News} from "./pages/News.jsx";
import {Calculators} from "./pages/Calculators.jsx";
import { GptQuestion } from "./pages/GptQuestion.jsx";
import { Statistics } from "./pages/Statistics.jsx";
import { LuckyPlinko } from "./pages/LuckyPlinko.jsx";
import { FloatingChat } from "./components/FloatingChat.jsx";

// 보호된 라우트 컴포넌트
const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return <LoadingPage />;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return children;
};

// 앱 레이아웃
const AppLayout = ({ children }) => {
    return (
        <div className="min-h-screen bg-slate-50 relative">
            <Header />
            <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
            <FloatingChat />
        </div>
    );
};

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    {/* 공개 라우트 */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />

                    {/* 보호된 라우트 */}
                    <Route
                        path="/app"
                        element={
                            <ProtectedRoute>
                                <AppLayout>
                                    <Home />
                                </AppLayout>
                            </ProtectedRoute>
                        }
                    />

                    {/* 게시판 목록 */}
                    <Route
                        path="/app/boards/:kind"
                        element={
                            <ProtectedRoute>
                                <AppLayout>
                                    <BoardList />
                                </AppLayout>
                            </ProtectedRoute>
                        }
                    />

                    {/* 게시글 작성 */}
                    <Route
                        path="/app/boards/:kind/new"
                        element={
                            <ProtectedRoute>
                                <AppLayout>
                                    <BoardForm />
                                </AppLayout>
                            </ProtectedRoute>
                        }
                    />

                    {/* 게시글 수정 */}
                    <Route
                        path="/app/boards/:kind/:boardId/edit"
                        element={
                            <ProtectedRoute>
                                <AppLayout>
                                    <BoardForm />
                                </AppLayout>
                            </ProtectedRoute>
                        }
                    />

                    {/* 게시글 상세 */}
                    <Route
                        path="/app/boards/:kind/:boardId"
                        element={
                            <ProtectedRoute>
                                <AppLayout>
                                    <BoardDetail />
                                </AppLayout>
                            </ProtectedRoute>
                        }
                    />

                    {/* 기능 페이지 */}
                    <Route
                        path="/app/statistics"
                        element={
                            <ProtectedRoute>
                                <AppLayout>
                                    <Statistics />
                                </AppLayout>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/app/ranks"
                        element={
                            <ProtectedRoute>
                                <AppLayout>
                                    <Ranks />
                                </AppLayout>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/app/news"
                        element={
                            <ProtectedRoute>
                                <AppLayout>
                                    <News />
                                </AppLayout>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/app/calculators"
                        element={
                            <ProtectedRoute>
                                <AppLayout>
                                    <Calculators />
                                </AppLayout>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/app/mypage"
                        element={
                            <ProtectedRoute>
                                <AppLayout>
                                    <Mypage />
                                </AppLayout>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/app/mypage/edit"
                        element={
                            <ProtectedRoute>
                                <AppLayout>
                                    <MypageEdit />
                                </AppLayout>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/app/gpt"
                        element={
                            <ProtectedRoute>
                                <AppLayout>
                                    <GptQuestion />
                                </AppLayout>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/app/plinko"
                        element={
                            <ProtectedRoute>
                                <AppLayout>
                                    <LuckyPlinko />
                                </AppLayout>
                            </ProtectedRoute>
                        }
                    />
                    {/* 기본 리다이렉트 */}
                    <Route path="/" element={<Navigate to="/app" replace />} />
                    <Route path="*" element={<Navigate to="/app" replace />} />
                </Routes>

                {/* Toast 알림 */}
                <Toaster
                    position="top-right"
                    toastOptions={{
                        duration: 3000,
                        style: {
                            background: "#ffffff",
                            color: "#0f172a",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            borderRadius: "12px",
                            padding: "12px 16px",
                        },
                        success: {
                            iconTheme: {
                                primary: "#16a34a",
                                secondary: "#ffffff",
                            },
                        },
                        error: {
                            iconTheme: {
                                primary: "#dc2626",
                                secondary: "#ffffff",
                            },
                        },
                    }}
                />
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
