import { lazy, Suspense, useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
    CalendarDays,
    User,
    LogOut,
    Menu,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { isAdminUser } from "../utils/authorization";

const HeaderMenuDialog = lazy(() =>
    import("./HeaderMenuDialog.jsx").then((module) => ({ default: module.HeaderMenuDialog }))
);

export const Header = () => {
    const { user, logout } = useAuth();
    const isAdmin = isAdminUser(user);
    const [menuOpen, setMenuOpen] = useState(false);
    const menuButtonRef = useRef(null);
    const menuPanelId = useId();
    const menuTitleId = useId();
    const menuDescriptionId = useId();
    const location = useLocation();

    const closeMenu = useCallback(() => setMenuOpen(false), []);

    useEffect(() => {
        closeMenu();
    }, [closeMenu, location.pathname]);

    return (
        <header className="sticky top-0 z-50 border-b-white/20 glass transition-all duration-300">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex h-20 items-center justify-between">
                    <div className="relative flex items-center gap-2">
                        <button
                            ref={menuButtonRef}
                            type="button"
                            onClick={() => setMenuOpen((prev) => !prev)}
                            className={`hidden lg:inline-flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm transition-all ${
                                menuOpen
                                    ? "border-primary-300 bg-primary-50 text-primary-600"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-primary-200 hover:bg-primary-50 hover:text-primary-600"
                            }`}
                            title="전체 메뉴 펼치기"
                            aria-label="전체 메뉴 펼치기"
                            aria-haspopup="dialog"
                            aria-controls={menuOpen ? menuPanelId : undefined}
                            aria-expanded={menuOpen}
                        >
                            <Menu className={`h-5 w-5 transition-transform duration-300 ${menuOpen ? "rotate-90 scale-110" : ""}`} />
                        </button>

                        <Link to="/app" className="group flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-[1.25rem] bg-gradient-to-tr from-primary-600 to-primary-400 text-xl font-black text-white shadow-xl shadow-primary-200 transition-transform duration-500 group-hover:scale-110">
                                C
                            </div>
                            <div className="leading-tight">
                                <div className="text-lg font-black tracking-tight text-slate-900 transition-colors group-hover:text-primary-600">커뮤니티</div>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-primary-400">ctfmon shop</div>
                            </div>
                        </Link>

                        <Suspense fallback={null}>
                            {menuOpen && (
                                <HeaderMenuDialog
                                    panelId={menuPanelId}
                                    titleId={menuTitleId}
                                    descriptionId={menuDescriptionId}
                                    isAdmin={isAdmin}
                                    onClose={closeMenu}
                                    launcherRef={menuButtonRef}
                                />
                            )}
                        </Suspense>
                    </div>

                    <div className="flex items-center gap-2">
                        <NavLink
                            to="/app/todos"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700 sm:hidden"
                            title="투두"
                            aria-label="투두로 이동"
                        >
                            <CalendarDays className="h-5 w-5" />
                        </NavLink>
                        <div className="hidden items-center gap-2 sm:flex">
                            <NavLink
                                to="/app/todos"
                                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700"
                                title="투두"
                                aria-label="투두로 이동"
                            >
                                <CalendarDays className="h-5 w-5" />
                            </NavLink>
                            <NavLink
                                to="/app/mypage"
                                className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[13px] font-bold text-slate-600 transition-all hover:bg-slate-50"
                            >
                                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-slate-100 shadow-sm">
                                    <User className="h-4 w-4 text-slate-400" />
                                </div>
                                <span className="hidden md:inline">{user?.name || user?.email || "내 정보"}</span>
                                {isAdmin && (
                                    <span className="hidden rounded-lg bg-primary-100 px-2 py-0.5 text-[9px] font-black text-primary-700 md:inline-block">
                                        관리자
                                    </span>
                                )}
                            </NavLink>
                            <button
                                onClick={logout}
                                className="rounded-2xl p-2.5 text-slate-400 transition-all hover:bg-rose-50 hover:text-rose-500"
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




