import { Link, NavLink } from "react-router-dom";
import {
    Home,
    MessageSquare,
    Leaf,
    Sprout,
    Trophy,
    Newspaper,
    Calculator,
    Bot,
    User,
    LogOut,
    Menu,
    X
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useState } from "react";
import { isAdminUser } from "../utils/authorization";

const NavItem = ({ to, icon: Icon, children, mobile = false }) => {
    return (
        <NavLink
            to={to}
            className={({ isActive }) =>
                `flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                    isActive
                        ? "bg-primary-600 text-white shadow-sm"
                        : "text-slate-700 hover:bg-slate-100"
                } ${mobile ? "w-full" : ""}`
            }
        >
            <Icon className="h-4 w-4" />
            <span>{children}</span>
        </NavLink>
    );
};

export const Header = () => {
    const { user, logout } = useAuth();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const isAdmin = isAdminUser(user);

    return (
        <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur-sm shadow-sm">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between">
                    {/* 로고 */}
                    <Link to="/app" className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white font-bold text-lg shadow-md">
                            C
                        </div>
                        <div>
                            <div className="text-base font-bold text-slate-900">
                                벌꿀오소리 커뮤니티
                            </div>
                            <div className="text-xs text-slate-500 hidden sm:block">
                                Community Platform
                            </div>
                        </div>
                    </Link>

                    {/* 데스크톱 네비게이션 */}
                    <nav className="hidden lg:flex items-center gap-2">
                        <NavItem to="/app" icon={Home}>
                            홈
                        </NavItem>
                        <NavItem to="/app/boards/FREE_BOARD" icon={MessageSquare}>
                            자유게시판
                        </NavItem>
                        <NavItem to="/app/boards/ECO_REVIEW" icon={Leaf}>
                            Q&A 게시판
                        </NavItem>
                        <NavItem to="/app/boards/GREEN_ACTIVE" icon={Sprout}>
                            녹색활동
                        </NavItem>
                        <NavItem to="/app/ranks" icon={Trophy}>
                            랭킹
                        </NavItem>
                        <NavItem to="/app/news" icon={Newspaper}>
                            뉴스
                        </NavItem>
                        <NavItem to="/app/calculators" icon={Calculator}>
                            전기요금
                        </NavItem>
                        <NavItem to="/app/gpt" icon={Bot}>
                            GPT 질문
                        </NavItem>
                    </nav>

                    {/* 우측 액션 */}
                    <div className="flex items-center gap-3">
                        {/* 사용자 정보 */}
                        <div className="hidden sm:flex items-center gap-3">
                            <NavLink
                                to="/app/mypage"
                                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-all"
                            >
                                <User className="h-4 w-4" />
                                <span className="hidden md:inline">
                  {user?.name || user?.email || "내정보"}
                </span>
                                {isAdmin && (
                                    <span className="hidden md:inline-block text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">
                                        ADMIN
                                    </span>
                                )}
                            </NavLink>
                            <button
                                onClick={logout}
                                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-all"
                            >
                                <LogOut className="h-4 w-4" />
                                <span className="hidden md:inline">로그아웃</span>
                            </button>
                        </div>

                        {/* 모바일 메뉴 버튼 */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="lg:hidden p-2 rounded-xl hover:bg-slate-100"
                        >
                            {mobileMenuOpen ? (
                                <X className="h-6 w-6" />
                            ) : (
                                <Menu className="h-6 w-6" />
                            )}
                        </button>
                    </div>
                </div>

                {/* 모바일 메뉴 */}
                {mobileMenuOpen && (
                    <div className="lg:hidden border-t py-4 space-y-2 animate-slide-up">
                        <NavItem to="/app" icon={Home} mobile>
                            홈
                        </NavItem>
                        <NavItem to="/app/boards/FREE_BOARD" icon={MessageSquare} mobile>
                            자유게시판
                        </NavItem>
                        <NavItem to="/app/boards/ECO_REVIEW" icon={Leaf} mobile>
                            Q&A 게시판
                        </NavItem>
                        <NavItem to="/app/boards/GREEN_ACTIVE" icon={Sprout} mobile>
                            녹색활동
                        </NavItem>
                        <NavItem to="/app/ranks" icon={Trophy} mobile>
                            랭킹
                        </NavItem>
                        <NavItem to="/app/news" icon={Newspaper} mobile>
                            뉴스
                        </NavItem>
                        <NavItem to="/app/calculators" icon={Calculator} mobile>
                            전기요금
                        </NavItem>
                        <NavItem to="/app/gpt" icon={Bot} mobile>
                            GPT 질문
                        </NavItem>
                        <NavItem to="/app/mypage" icon={User} mobile>
                            내정보
                        </NavItem>
                        <button
                            onClick={logout}
                            className="flex w-full items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition-all"
                        >
                            <LogOut className="h-4 w-4" />
                            로그아웃
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
};
