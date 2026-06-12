import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { DelayedLoadingPage, DelayedRouteFallback } from "./LoadingSpinner";
import { ProtectedAppLayout } from "./ProtectedAppLayout.jsx";
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
const LasVegasGame = lazy(() => import("../pages/games/LasVegasGame.jsx").then((module) => ({ default: module.LasVegasGame })));
const NoThanksGame = lazy(() => import("../pages/games/NoThanksGame.jsx").then((module) => ({ default: module.NoThanksGame })));
const CatanGame = lazy(() => import("../pages/games/TabletopGame.jsx").then((module) => ({ default: module.CatanGame })));
const BlokusGame = lazy(() => import("../pages/games/TabletopGame.jsx").then((module) => ({ default: module.BlokusGame })));
const MaheGame = lazy(() => import("../pages/games/TabletopGame.jsx").then((module) => ({ default: module.MaheGame })));
const DalmutiGame = lazy(() => import("../pages/games/TabletopGame.jsx").then((module) => ({ default: module.DalmutiGame })));
const SixNimmtGame = lazy(() => import("../pages/games/TabletopGame.jsx").then((module) => ({ default: module.SixNimmtGame })));
const TelestrationsGame = lazy(() => import("../pages/games/TabletopGame.jsx").then((module) => ({ default: module.TelestrationsGame })));
const MafiaGame = lazy(() => import("../pages/games/TabletopGame.jsx").then((module) => ({ default: module.MafiaGame })));
const PokerGame = lazy(() => import("../pages/games/TabletopGame.jsx").then((module) => ({ default: module.PokerGame })));
const CitadelsGame = lazy(() => import("../pages/games/CitadelsGame.jsx").then((module) => ({ default: module.CitadelsGame })));
const GoodEtcVideoGame = lazy(() => import("../pages/games/GoodEtcVideoGame.jsx").then((module) => ({ default: module.GoodEtcVideoGame })));
const MeetingOptimizer = lazy(() => import("../pages/facility/MeetingOptimizer.jsx").then((module) => ({ default: module.MeetingOptimizer })));
const FacilityFinder = lazy(() => import("../pages/facility/FacilityFinder.jsx").then((module) => ({ default: module.FacilityFinder })));
const AdminCommandCenter = lazy(() => import("../pages/admin/AdminCommandCenter.jsx").then((module) => ({ default: module.AdminCommandCenter })));
const AdminAnomalies = lazy(() => import("../pages/admin/AdminAnomalies.jsx").then((module) => ({ default: module.AdminAnomalies })));
const AdminOperations = lazy(() => import("../pages/admin/AdminOperations.jsx").then((module) => ({ default: module.AdminOperations })));
const AdminStreamingStudio = lazy(() => import("../pages/admin/AdminStreamingStudio.jsx").then((module) => ({ default: module.AdminStreamingStudio })));

const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, loading, passwordResetRequired } = useAuth();

    if (loading) return <DelayedLoadingPage />;
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (passwordResetRequired) return <Navigate to="/password/change-required" replace />;

    return children;
};

export const ProtectedRoutes = () => (
    <ProtectedRoute>
        <ProtectedAppLayout>
            <Suspense fallback={<DelayedRouteFallback />}>
                <Routes>
                    <Route index element={<GamesHub />} />
                    <Route path="home" element={<Home />} />
                    <Route path="boards/:kind" element={<BoardList />} />
                    <Route path="boards/:kind/new" element={<BoardForm />} />
                    <Route path="boards/:kind/:boardId/edit" element={<BoardForm />} />
                    <Route path="boards/:kind/:boardId" element={<BoardDetail />} />

                    <Route path="chat" element={<Chat />} />
                    <Route path="todos" element={<TodoCalendar />} />
                    <Route path="streaming" element={<StreamingHub />} />
                    <Route path="invest" element={<InvestAssistant />} />
                    <Route path="all-menu" element={<AllMenu />} />
                    <Route path="games" element={<Navigate to="/app" replace />} />

                    <Route path="statistics" element={<Statistics />} />
                    <Route path="ranks" element={<Ranks />} />
                    <Route path="news" element={<News />} />
                    <Route path="mypage" element={<Mypage />} />
                    <Route path="mypage/edit" element={<MypageEdit />} />
                    <Route path="poker" element={<PokerGame />} />
                    <Route path="plinko" element={<Navigate to="/app/poker" replace />} />
                    <Route path="games/las-vegas" element={<LasVegasGame />} />
                    <Route path="games/no-thanks" element={<NoThanksGame />} />
                    <Route path="games/catan" element={<CatanGame />} />
                    <Route path="games/blokus" element={<BlokusGame />} />
                    <Route path="games/mahe" element={<MaheGame />} />
                    <Route path="games/dalmuti" element={<DalmutiGame />} />
                    <Route path="games/six-nimmt" element={<SixNimmtGame />} />
                    <Route path="games/telestrations" element={<TelestrationsGame />} />
                    <Route path="games/mafia" element={<MafiaGame />} />
                    <Route path="games/citadels" element={<CitadelsGame />} />
                    <Route path="games/video/:videoGameCode" element={<GoodEtcVideoGame />} />
                    <Route path="optimizer" element={<MeetingOptimizer />} />
                    <Route path="facility" element={<FacilityFinder />} />
                    <Route path="parking" element={<Navigate to="/app/facility" replace />} />
                    <Route path="admin" element={<AdminCommandCenter />} />
                    <Route path="admin/anomalies" element={<AdminAnomalies />} />
                    <Route path="admin/operations" element={<AdminOperations />} />
                    <Route path="admin/streaming" element={<AdminStreamingStudio />} />

                    <Route path="*" element={<Navigate to="/app" replace />} />
                </Routes>
            </Suspense>
        </ProtectedAppLayout>
    </ProtectedRoute>
);

export default ProtectedRoutes;
