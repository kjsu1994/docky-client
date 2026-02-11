import { Routes, Route, Navigate, Outlet } from "react-router-dom";

//페이지들(실제 파일이 저장된 경로)
import Login from "./pages/Login";
import MemberCreate from "./pages/MemberCreate";
import TopNav from "./components/TopNav";

import BoardsList from "./pages/BoardsList";
import BoardDetail from "./pages/BoardDetail";  // ⭐ 추가!
import Ranks from "./pages/Ranks";
import News from "./pages/News";
import Calculators from "./pages/Calculators";
import Mypage from "./pages/Mypage";
import ApiConsole from "./pages/ApiConsole";

function RequireAuth({ children }) {
    const token = localStorage.getItem("accessToken");
    return token ? children : <Navigate to="/login" replace />;
}

function AppLayout() {
    return (
        <div className="min-h-screen bg-slate-50">
            <TopNav />
            <main className="mx-auto max-w-6xl px-4 py-8">
                <Outlet />
            </main>
        </div>
    );
}


// 각각의 라우팅 주소를 정의하는 공간인듯?
export default function App() {
    return (
        <Routes>
            {/* 첫 진입은 로그인 */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* 로그인/회원가입은 공개 */}
            <Route path="/login" element={<Login />} />
            <Route path="/members/create" element={<MemberCreate />} />

            {/* 로그인 후 영역: /app/* */}
            <Route
                path="/app"
                element={
                    <RequireAuth>
                        <AppLayout />
                    </RequireAuth>
                }
            >
                {/* /app 진입 시 기본 페이지 */}
                <Route index element={<Navigate to="boards/main" replace />} />

                {/* ⭐ 게시글 상세 - 목록보다 먼저 와야 함! */}
                <Route path="boards/:kind/:boardId" element={<BoardDetail />} />

                {/* 게시판(목록/검색) */}
                <Route path="boards/:kind" element={<BoardsList />} />

                {/* 랭킹: boards 랭킹 + members 랭킹 묶기 */}
                <Route path="ranks" element={<Ranks />} />

                {/* 뉴스: GET /news */}
                <Route path="news" element={<News />} />

                {/* 전기요금: POST /calculators */}
                <Route path="calculators" element={<Calculators />} />

                {/* 내정보: GET /members/{id}, PATCH /members/{id}, 프로필 업로드 등 */}
                <Route path="mypage" element={<Mypage />} />

                {/* api 콘솔로 이동 */}
                <Route path="console" element={<ApiConsole />} />

            </Route>
            {/* 기타 모든동작 라우팅 페이지는 로그인화면으로 이동 */}
            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
}
