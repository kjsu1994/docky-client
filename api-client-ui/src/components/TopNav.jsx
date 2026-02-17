import { NavLink, useNavigate } from "react-router-dom";

const linkBase =
    "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold border transition";
const active = "bg-slate-900 text-white border-slate-900";
const inactive =
    "bg-white text-slate-700 border-slate-200 hover:bg-slate-50";

function Item({ to, children }) {
    return (
        <NavLink
            to={to}
            className={({ isActive }) =>
                `${linkBase} ${isActive ? active : inactive}`
            }
        >
            {children}
        </NavLink>
    );
}

export default function TopNav() {
    const navigate = useNavigate();

    const onLogout = () => {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        navigate("/login", { replace: true });
    };

    return (
        <header className="border-b bg-white">
            <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
                {/* Brand */}
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-slate-900 text-white grid place-items-center font-bold">
                        CS
                    </div>
                    <div className="leading-tight">
                        <div className="text-sm font-semibold text-slate-900">
                            Community API Client
                        </div>
                        <div className="text-xs text-slate-500">
                            로그인 후 기능별 API 화면 이동
                        </div>
                    </div>
                </div>

                {/* Menu */}
                <nav className="ml-2 flex flex-wrap items-center gap-2">
                    <Item to="/app">홈</Item>
                    {/* 게시판 (kind 명시) */}
                    <Item to="/app/boards/FREE_BOARD">자유</Item>
                    <Item to="/app/boards/ECO_REVIEW">Q&A</Item>
                    <Item to="/app/boards/GREEN_ACTIVE">녹색활동</Item>

                    <Item to="/app/ranks">랭킹</Item>
                    <Item to="/app/news">뉴스</Item>
                    <Item to="/app/calculators">전기요금</Item>
                    <Item to="/app/mypage">내정보</Item>
                    <Item to="/app/console">API 콘솔</Item>
                </nav>

                {/* Right actions */}
                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={onLogout}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        로그아웃
                    </button>
                </div>
            </div>
        </header>
    );
}
