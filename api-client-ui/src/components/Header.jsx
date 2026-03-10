import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
    Home,
    BarChart,
    CalendarDays,
    MessageSquare,
    Trophy,
    Newspaper,
    Dices,
    MapPin,
    Car,
    User,
    LogOut,
    HelpCircle,
    ShieldAlert,
    Menu,
    ChevronRight,
    Settings,
    X,
    Film,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { isAdminUser } from "../utils/authorization";

const MenuSection = ({ title, items, onSelect }) => (
    <section className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
        <h3 className="px-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{title}</h3>
        <div className="mt-3 space-y-1.5">
            {items.map((item) => (
                <Link
                    key={item.to}
                    to={item.to}
                    onClick={onSelect}
                    className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 transition-all hover:border-primary-100 hover:bg-primary-50/50 hover:text-primary-700"
                >
                    <span className="flex items-center gap-2.5">
                        <item.icon className="h-4 w-4" />
                        {item.title}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                </Link>
            ))}
        </div>
    </section>
);

export const Header = () => {
    const { user, logout } = useAuth();
    const isAdmin = isAdminUser(user);
    const [menuOpen, setMenuOpen] = useState(false);
    const menuWrapRef = useRef(null);
    const menuPanelRef = useRef(null);
    const location = useLocation();

    const panelSections = useMemo(() => {
        const sections = [
            {
                title: "Core",
                items: [
                    { title: "홈", to: "/app", icon: Home },
                    { title: "Todo", to: "/app/todos", icon: CalendarDays },
                    { title: "통계", to: "/app/statistics", icon: BarChart },
                    { title: "사용자게시판", to: "/app/boards/FREE_BOARD", icon: MessageSquare },
                    { title: "Q&A", to: "/app/boards/QUESTION_ANSWER", icon: HelpCircle },
                ],
            },
            {
                title: "Tools",
                items: [
                    { title: "중간장소", to: "/app/optimizer", icon: MapPin },
                    { title: "주변 찾기", to: "/app/facility", icon: Car },
                    { title: "순위", to: "/app/ranks", icon: Trophy },
                    { title: "플린코", to: "/app/plinko", icon: Dices },
                    { title: "라스베거스", to: "/app/games/las-vegas", icon: Dices },
                    { title: "뉴스", to: "/app/news", icon: Newspaper },
                    { title: "스트리밍", to: "/app/streaming", icon: Film },
                ],
            },
            {
                title: "Account",
                items: [
                    { title: "내 정보", to: "/app/mypage", icon: User },
                    { title: "정보 수정", to: "/app/mypage/edit", icon: Settings },
                ],
            },
        ];
        if (isAdmin) {
            sections.push({
                title: "Admin",
                items: [
                    { title: "관리자 콘솔", to: "/app/admin/anomalies", icon: ShieldAlert },
                    { title: "운영 관리", to: "/app/admin/operations", icon: ShieldAlert },
                    { title: "스트리밍 스튜디오", to: "/app/admin/streaming", icon: ShieldAlert },
                ],
            });
        }
        return sections;
    }, [isAdmin]);

    useEffect(() => {
        setMenuOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        if (!menuOpen) return;
        const onPointerDown = (e) => {
            if (menuWrapRef.current?.contains(e.target)) return;
            if (menuPanelRef.current?.contains(e.target)) return;
            setMenuOpen(false);
        };
        const onKeyDown = (e) => {
            if (e.key === "Escape") setMenuOpen(false);
        };
        window.addEventListener("mousedown", onPointerDown);
        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("mousedown", onPointerDown);
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [menuOpen]);

    return (
        <header className="sticky top-0 z-50 border-b-white/20 glass transition-all duration-300">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex h-20 items-center justify-between">
                    <div ref={menuWrapRef} className="relative flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setMenuOpen((prev) => !prev)}
                            className={`hidden lg:inline-flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm transition-all ${
                                menuOpen
                                    ? "border-primary-300 bg-primary-50 text-primary-600"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-primary-200 hover:bg-primary-50 hover:text-primary-600"
                            }`}
                            title="전체 메뉴 펼치기"
                            aria-label="전체 메뉴 펼치기"
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

                        {menuOpen && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setMenuOpen(false)}
                                    className="hidden lg:block fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm transition-opacity duration-200"
                                    aria-label="메뉴 닫기"
                                />
                                <div
                                    ref={menuPanelRef}
                                    className="hidden lg:block fixed inset-x-6 top-24 z-50 mx-auto w-full max-w-5xl max-h-[78vh] overflow-y-auto rounded-[2rem] border border-slate-200 bg-white/95 p-6 shadow-2xl backdrop-blur"
                                >
                                    <div className="mb-5 flex items-center justify-between">
                                        <div>
                                            <div className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">All Menu</div>
                                            <p className="mt-1 text-sm font-semibold text-slate-500">자주 쓰는 메뉴를 카테고리별로 모아봤어요.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setMenuOpen(false)}
                                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:border-primary-200 hover:text-primary-700"
                                            aria-label="모달 닫기"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        {panelSections.map((section) => (
                                            <MenuSection key={section.title} title={section.title} items={section.items} onSelect={() => setMenuOpen(false)} />
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
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
                                    <span className="hidden rounded-lg bg-primary-100 px-2 py-0.5 text-[9px] font-black uppercase text-primary-700 md:inline-block">
                                        ADMIN
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




