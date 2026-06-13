import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { DelayedLoadingPage } from "./components/LoadingSpinner";
import { GlobalNetworkIndicatorEntry } from "./components/GlobalNetworkIndicatorEntry.jsx";
import { AppErrorBoundary } from "./common/AppErrorBoundary.jsx";
import { ToastViewportEntry } from "./common/ToastViewportEntry.jsx";
import { ThemeProvider } from "./contexts/ThemeContext.jsx";

const ProtectedRoutes = lazy(() =>
    import("./components/ProtectedRoutes.jsx").then((module) => ({ default: module.ProtectedRoutes }))
);
const Login = lazy(() => import("./pages/access/Login.jsx").then((module) => ({ default: module.Login })));
const Register = lazy(() => import("./pages/access/Register.jsx").then((module) => ({ default: module.Register })));
const Queue = lazy(() => import("./pages/access/Queue.jsx").then((module) => ({ default: module.Queue })));
const AccountRecovery = lazy(() => import("./pages/access/AccountRecovery.jsx").then((module) => ({ default: module.AccountRecovery })));
const ForcePasswordChange = lazy(() => import("./pages/access/ForcePasswordChange.jsx").then((module) => ({ default: module.ForcePasswordChange })));

const PublicRoute = ({ children }) => (
    <Suspense fallback={<DelayedLoadingPage />}>
        {children}
    </Suspense>
);

const GuestRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) return <DelayedLoadingPage />;
    if (isAuthenticated) return <Navigate to="/app" replace />;

    return <PublicRoute>{children}</PublicRoute>;
};

const PasswordChangeRequiredRoute = ({ children }) => {
    const { isAuthenticated, loading, passwordResetRequired } = useAuth();

    if (loading) return <DelayedLoadingPage />;
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (!passwordResetRequired) return <Navigate to="/app" replace />;

    return <PublicRoute>{children}</PublicRoute>;
};

const ProtectedRoutesBoundary = () => (
    <Suspense fallback={<DelayedLoadingPage />}>
        <ProtectedRoutes />
    </Suspense>
);

const AppShell = () => {
    const location = useLocation();

    return (
        <AppErrorBoundary resetKey={location.pathname}>
            <AuthProvider>
                <GlobalNetworkIndicatorEntry />
                <Routes>
                    <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
                    <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
                    <Route path="/account-recovery/find-id" element={<GuestRoute><AccountRecovery initialMode="find-id" /></GuestRoute>} />
                    <Route path="/account-recovery/password-reset" element={<GuestRoute><AccountRecovery initialMode="password-reset" /></GuestRoute>} />
                    <Route path="/password/change-required" element={<PasswordChangeRequiredRoute><ForcePasswordChange /></PasswordChangeRequiredRoute>} />
                    <Route path="/queue" element={<PublicRoute><Queue /></PublicRoute>} />

                    <Route path="/app/*" element={<ProtectedRoutesBoundary />} />

                    <Route path="/" element={<Navigate to="/app" replace />} />
                    <Route path="*" element={<Navigate to="/app" replace />} />
                </Routes>

                <ToastViewportEntry />
            </AuthProvider>
        </AppErrorBoundary>
    );
};

function App() {
    return (
        <BrowserRouter>
            <ThemeProvider>
                <AppShell />
            </ThemeProvider>
        </BrowserRouter>
    );
}

export default App;
