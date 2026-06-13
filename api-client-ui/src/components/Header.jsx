import { lazy, Suspense, useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
    CalendarDays,
    LogOut,
    Menu,
    Settings,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { isAdminUser } from "../utils/authorization";
import { BrandLogo } from "../common/BrandLogo.jsx";
import UserAvatar from "../common/UserAvatar.jsx";
import { NotificationCenterEntry } from "./NotificationCenterEntry.jsx";

const HeaderMenuDialog = lazy(() =>
    import("./HeaderMenuDialog.jsx").then((module) => ({ default: module.HeaderMenuDialog }))
);

export const Header = () => {
    const { user, logout } = useAuth();
    const isAdmin = isAdminUser(user);
    const userLevel = user?.levelDto || user?.level_dto || user?.level || {};
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
        <header className="sticky top-0 z-50 border-b border-line/60 glass transition-all duration-300">
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
                                    : "border-line bg-surface text-ink-muted hover:border-primary-200 hover:bg-control hover:text-primary-600"
                            }`}
                            title="전체 메뉴 펼치기"
                            aria-label="전체 메뉴 펼치기"
                            aria-haspopup="dialog"
                            aria-controls={menuOpen ? menuPanelId : undefined}
                            aria-expanded={menuOpen}
                        >
                            <Menu className={`h-5 w-5 transition-transform duration-300 ${menuOpen ? "rotate-90 scale-110" : ""}`} />
                        </button>

                        <Link to="/app" className="group flex items-center gap-3" aria-label="홈 대시보드로 이동">
                            <BrandLogo
                                className="transition-transform duration-500 group-hover:scale-[1.03]"
                                markClassName="h-12 max-w-[10rem]"
                            />
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
                            to="/app/mypage?tab=settings"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-line bg-surface text-ink-subtle shadow-sm transition-all hover:border-primary-200 hover:bg-control hover:text-primary-700"
                            title="설정"
                            aria-label="설정으로 이동"
                        >
                            <Settings className="h-5 w-5" />
                        </NavLink>
                        <NotificationCenterEntry />
                        <Link
                            to="/app/todos"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-line bg-surface text-ink-subtle shadow-sm transition-all hover:border-primary-200 hover:bg-control hover:text-primary-700 sm:hidden"
                            title="할 일"
                            aria-label="할 일로 이동"
                            data-smoke="header-todos-link"
                        >
                            <CalendarDays className="h-5 w-5" />
                        </Link>
                        <div className="hidden items-center gap-2 sm:flex">
                            <Link
                                to="/app/todos"
                                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-line bg-surface text-ink-subtle shadow-sm transition-all hover:border-primary-200 hover:bg-control hover:text-primary-700"
                                title="할 일"
                                aria-label="할 일로 이동"
                                data-smoke="header-todos-link"
                            >
                                <CalendarDays className="h-5 w-5" />
                            </Link>
                            <NavLink
                                to="/app/mypage"
                                className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[13px] font-bold text-ink-muted transition-all hover:bg-control"
                                aria-label="마이페이지로 이동"
                            >
                                <UserAvatar
                                    name={user?.name || user?.email}
                                    profileUrl={user?.profileUrl || user?.profile_url}
                                    level={userLevel.level}
                                    rewardTier={userLevel.rewardTier || userLevel.reward_tier}
                                    frameCode={userLevel.frameCode || userLevel.frame_code}
                                    size="sm"
                                />
                                <span className="hidden md:inline">{user?.name || user?.email || "내 정보"}</span>
                                {isAdmin && (
                                    <span className="hidden rounded-lg bg-primary-100 px-2 py-0.5 text-[9px] font-black text-primary-700 md:inline-block">
                                        관리자
                                    </span>
                                )}
                            </NavLink>
                            <button
                                type="button"
                                onClick={logout}
                                className="rounded-2xl p-2.5 text-ink-subtle transition-all hover:bg-rose-50 hover:text-rose-500"
                                title="로그아웃"
                                aria-label="로그아웃"
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




