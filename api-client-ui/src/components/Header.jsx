import { Link, NavLink } from "react-router-dom";
import {
    Home,
    BarChart,
    MessageSquare,
    Trophy,
    Newspaper,
    Calculator,
    Bot,
    Dices,
    MapPin,
    User,
    LogOut,
    Menu,
    X,
    HelpCircle,
    ShieldAlert,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useState } from "react";
import { isAdminUser } from "../utils/authorization";

const NavItem = ({ to, icon: Icon, children, mobile = false, onClick }) => {
    return (
        <NavLink
            to={to}
            onClick={onClick}
            className={({ isActive }) =>
                `flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[13px] font-bold transition-all duration-300 ${
                    isActive
                        ? "bg-primary-500 text-white shadow-lg shadow-primary-200 scale-105"
                        : "text-slate-500 hover:bg-primary-50 hover:text-primary-600"
                } ${mobile ? "w-full justify-start text-sm" : ""}`
            }
        >
            <Icon className="h-4 w-4" />
            <span>{children}</span>
        </NavLink>
    );
};

export const Header = () => {
    const { user, logout } = useAuth();
    const isAdmin = isAdminUser(user);

    return (
        <header className="sticky top-0 z-50 glass border-b-white/20 transition-all duration-300">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex h-20 items-center justify-between">
                    <Link to="/app" className="flex items-center gap-3 group">
                        <div className="flex h-12 w-12 items-center justify-center rounded-[1.25rem] bg-gradient-to-tr from-primary-600 to-primary-400 text-white font-black text-xl shadow-xl shadow-primary-200 group-hover:scale-110 transition-transform duration-500">
                            C
                        </div>
                        <div className="leading-tight">
                            <div className="text-lg font-black tracking-tight text-slate-900 group-hover:text-primary-600 transition-colors">커뮤니티</div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-primary-400">Next Gen Platform</div>
                        </div>
                    </Link>

                    <nav className="hidden xl:flex items-center gap-1.5">
                        <NavItem to="/app" icon={Home}>홈</NavItem>
                        <NavItem to="/app/statistics" icon={BarChart}>통계</NavItem>
                        <NavItem to="/app/boards/FREE_BOARD" icon={MessageSquare}>자유게시판</NavItem>
                        <NavItem to="/app/boards/QUESTION_ANSWER" icon={HelpCircle}>Q&A</NavItem>
                        <NavItem to="/app/optimizer" icon={MapPin}>중간장소</NavItem>
                        <NavItem to="/app/ranks" icon={Trophy}>랭킹</NavItem>
                        <NavItem to="/app/plinko" icon={Dices}>플링코</NavItem>
                        <NavItem to="/app/news" icon={Newspaper}>뉴스</NavItem>
                        <NavItem to="/app/calculators" icon={Calculator}>전기요금</NavItem>
                        <NavItem to="/app/gpt" icon={Bot}>GPT</NavItem>
                        {isAdmin && <NavItem to="/app/admin/anomalies" icon={ShieldAlert}>관리자 콘솔</NavItem>}
                        {isAdmin && <NavItem to="/app/admin/operations" icon={ShieldAlert}>운영 툴</NavItem>}
                    </nav>

                    <div className="flex items-center gap-2">
                        <div className="hidden sm:flex items-center gap-2">
                            <NavLink
                                to="/app/mypage"
                                className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[13px] font-bold text-slate-600 hover:bg-slate-50 transition-all"
                            >
                                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center border-2 border-white shadow-sm overflow-hidden">
                                    <User className="h-4 w-4 text-slate-400" />
                                </div>
                                <span className="hidden md:inline">{user?.name || user?.email || "내 정보"}</span>
                                {isAdmin && (
                                    <span className="hidden md:inline-block text-[9px] px-2 py-0.5 rounded-lg bg-primary-100 text-primary-700 font-black uppercase">
                                        ADMIN
                                    </span>
                                )}
                            </NavLink>
                            <button
                                onClick={logout}
                                className="p-2.5 rounded-2xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all"
                                title="로그아웃"
                            >
                                <LogOut className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};


