import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { LoadingPage } from "./LoadingSpinner";

const ProtectedAppLayout = lazy(() =>
    import("./ProtectedAppLayout.jsx").then((module) => ({ default: module.ProtectedAppLayout }))
);
const Home = lazy(() => import("../pages/home/Home.jsx").then((module) => ({ default: module.Home })));
const BoardList = lazy(() => import("../pages/boards/BoardList.jsx").then((module) => ({ default: module.BoardList })));
const BoardDetail = lazy(() => import("../pages/boards/BoardDetail.jsx").then((module) => ({ default: module.BoardDetail })));
const BoardForm = lazy(() => import("../pages/boards/BoardForm.jsx").then((module) => ({ default: module.BoardForm })));
const Chat = lazy(() => import("../pages/chat/Chat.jsx").then((module) => ({ default: module.Chat })));
const TodoCalendar = lazy(() => import("../pages/facility/TodoCalendar.jsx").then((module) => ({ default: module.TodoCalendar })));
const StreamingHub = lazy(() => import("../pages/streaming/StreamingHub.jsx").then((module) => ({ default: module.StreamingHub })));
const InvestAssistant = lazy(() => import("../pages/facility/InvestAssistant.jsx").then((module) => ({ default: module.InvestAssistant })));
const AllMenu = lazy(() => import("../pages/home/AllMenu.jsx").then((module) => ({ default: module.AllMenu })));
const GamesHub = lazy(() => import("../pages/games/GamesHub.jsx").then((module) => ({ default: module.GamesHub })));
const Statistics = lazy(() => import("../pages/home/Statistics.jsx").then((module) => ({ default: module.Statistics })));
const Ranks = lazy(() => import("../pages/home/Ranks.jsx").then((module) => ({ default: module.Ranks })));
const News = lazy(() => import("../pages/facility/News.jsx").then((module) => ({ default: module.News })));
const Mypage = lazy(() => import("../pages/home/Mypage.jsx").then((module) => ({ default: module.Mypage })));
const MypageEdit = lazy(() => import("../pages/home/MypageEdit.jsx").then((module) => ({ default: module.MypageEdit })));
const LuckyPlinko = lazy(() => import("../pages/games/LuckyPlinko.jsx").then((module) => ({ default: module.LuckyPlinko })));
const LasVegasGame = lazy(() => import("../pages/games/LasVegasGame.jsx").then((module) => ({ default: module.LasVegasGame })));
const NoThanksGame = lazy(() => import("../pages/games/NoThanksGame.jsx").then((module) => ({ default: module.NoThanksGame })));
const CatanGame = lazy(() => import("../pages/games/TabletopGame.jsx").then((module) => ({ default: module.CatanGame })));
const BlokusGame = lazy(() => import("../pages/games/TabletopGame.jsx").then((module) => ({ default: module.BlokusGame })));
const MaheGame = lazy(() => import("../pages/games/TabletopGame.jsx").then((module) => ({ default: module.MaheGame })));
const DalmutiGame = lazy(() => import("../pages/games/TabletopGame.jsx").then((module) => ({ default: module.DalmutiGame })));
const MeetingOptimizer = lazy(() => import("../pages/facility/MeetingOptimizer.jsx").then((module) => ({ default: module.MeetingOptimizer })));
const FacilityFinder = lazy(() => import("../pages/facility/FacilityFinder.jsx").then((module) => ({ default: module.FacilityFinder })));
const AdminAnomalies = lazy(() => import("../pages/admin/AdminAnomalies.jsx").then((module) => ({ default: module.AdminAnomalies })));
const AdminOperations = lazy(() => import("../pages/admin/AdminOperations.jsx").then((module) => ({ default: module.AdminOperations })));
const AdminStreamingStudio = lazy(() => import("../pages/admin/AdminStreamingStudio.jsx").then((module) => ({ default: module.AdminStreamingStudio })));

const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) return <LoadingPage />;
    if (!isAuthenticated) return <Navigate to="/login" replace />;

    return children;
};

export const ProtectedRoutes = () => (
    <ProtectedRoute>
        <Suspense fallback={<LoadingPage />}>
            <ProtectedAppLayout>
                <Suspense fallback={<LoadingPage />}>
                    <Routes>
                        <Route index element={<Home />} />
                        <Route path="boards/:kind" element={<BoardList />} />
                        <Route path="boards/:kind/new" element={<BoardForm />} />
                        <Route path="boards/:kind/:boardId/edit" element={<BoardForm />} />
                        <Route path="boards/:kind/:boardId" element={<BoardDetail />} />

                        <Route path="chat" element={<Chat />} />
                        <Route path="todos" element={<TodoCalendar />} />
                        <Route path="streaming" element={<StreamingHub />} />
                        <Route path="invest" element={<InvestAssistant />} />
                        <Route path="all-menu" element={<AllMenu />} />
                        <Route path="games" element={<GamesHub />} />

                        <Route path="statistics" element={<Statistics />} />
                        <Route path="ranks" element={<Ranks />} />
                        <Route path="news" element={<News />} />
                        <Route path="mypage" element={<Mypage />} />
                        <Route path="mypage/edit" element={<MypageEdit />} />
                        <Route path="plinko" element={<LuckyPlinko />} />
                        <Route path="games/las-vegas" element={<LasVegasGame />} />
                        <Route path="games/no-thanks" element={<NoThanksGame />} />
                        <Route path="games/catan" element={<CatanGame />} />
                        <Route path="games/blokus" element={<BlokusGame />} />
                        <Route path="games/mahe" element={<MaheGame />} />
                        <Route path="games/dalmuti" element={<DalmutiGame />} />
                        <Route path="optimizer" element={<MeetingOptimizer />} />
                        <Route path="facility" element={<FacilityFinder />} />
                        <Route path="parking" element={<Navigate to="/app/facility" replace />} />
                        <Route path="admin/anomalies" element={<AdminAnomalies />} />
                        <Route path="admin/operations" element={<AdminOperations />} />
                        <Route path="admin/streaming" element={<AdminStreamingStudio />} />

                        <Route path="*" element={<Navigate to="/app" replace />} />
                    </Routes>
                </Suspense>
            </ProtectedAppLayout>
        </Suspense>
    </ProtectedRoute>
);

export default ProtectedRoutes;
