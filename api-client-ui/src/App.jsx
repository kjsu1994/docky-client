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
        <div className="min-h-screen bg-slate-50">
            <Header />
            <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
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

                    {/* 기타 페이지들 (플레이스홀더) */}
                    <Route
                        path="/app/ranks"
                        element={
                            <ProtectedRoute>
                                <AppLayout>
                                    <PlaceholderPage title="랭킹" />
                                </AppLayout>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/app/news"
                        element={
                            <ProtectedRoute>
                                <AppLayout>
                                    <PlaceholderPage title="뉴스" />
                                </AppLayout>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/app/calculators"
                        element={
                            <ProtectedRoute>
                                <AppLayout>
                                    <PlaceholderPage title="전기요금 계산기" />
                                </AppLayout>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/app/mypage"
                        element={
                            <ProtectedRoute>
                                <AppLayout>
                                    <PlaceholderPage title="마이페이지" />
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

// 플레이스홀더 페이지
const PlaceholderPage = ({ title }) => {
    return (
        <div className="card p-8 text-center">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">{title}</h1>
            <p className="text-slate-600">이 페이지는 개발 예정입니다.</p>
        </div>
    );
};

export default App;