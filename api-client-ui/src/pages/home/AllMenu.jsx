import { Link } from "react-router-dom";
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
    ShieldAlert,
    Settings,
    LogOut,
    ChevronRight,
    HelpCircle,
    Film,
    Bot, BadgeX, BadgeDollarSign,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { isAdminUser } from "../../utils/authorization.js";

const MenuSection = ({ title, items }) => (
    <div className="space-y-3">
        <h3 className="px-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{title}</h3>
        <div className="grid grid-cols-1 gap-2">
            {items.map((item) => (
                <Link
                    key={item.to}
                    to={item.to}
                    className="flex items-center justify-between rounded-3xl border border-slate-50 bg-white p-4 shadow-sm transition-all active:scale-[0.98]"
                >
                    <div className="flex items-center gap-4">
                        <div className={`rounded-2xl p-2.5 ${item.color || "bg-slate-50 text-slate-600"}`}>
                            <item.icon className="h-5 w-5" />
                        </div>
                        <span className="font-bold text-slate-700">{item.title}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                </Link>
            ))}
        </div>
    </div>
);

export const AllMenu = () => {
    const { user, logout } = useAuth();
    const isAdmin = isAdminUser(user);

    const mainServices = [
        { title: "홈", to: "/app", icon: Home, color: "bg-blue-50 text-blue-600" },
        { title: "Todo", to: "/app/todos", icon: CalendarDays, color: "bg-emerald-50 text-emerald-700" },
        { title: "통계", to: "/app/statistics", icon: BarChart, color: "bg-indigo-50 text-indigo-600" },
        { title: "스트리밍", to: "/app/streaming", icon: Film, color: "bg-fuchsia-50 text-fuchsia-700" },
        { title: "사용자게시판", to: "/app/boards/FREE_BOARD", icon: MessageSquare, color: "bg-sky-50 text-sky-600" },
        { title: "Q&A", to: "/app/boards/QUESTION_ANSWER", icon: HelpCircle, color: "bg-emerald-50 text-emerald-600" },
        { title: "Invest", to: "/app/invest", icon: Bot, color: "bg-sky-50 text-sky-700" },
    ];

    const tools = [
        { title: "중간장소 찾기", to: "/app/optimizer", icon: MapPin, color: "bg-rose-50 text-rose-600" },
        { title: "주변 찾기", to: "/app/facility", icon: Car, color: "bg-cyan-50 text-cyan-700" },
        { title: "순위", to: "/app/ranks", icon: Trophy, color: "bg-amber-50 text-amber-600" },
        { title: "뉴스", to: "/app/news", icon: Newspaper, color: "bg-slate-50 text-slate-600" },
    ];

    const games = [
        { title: "플린코", to: "/app/plinko", icon: Dices, color: "bg-violet-50 text-violet-600" },
        { title: "라스베거스", to: "/app/games/las-vegas", icon: BadgeDollarSign, color: "bg-orange-50 text-orange-600" },
        { title: "노땡스", to: "/app/games/no-thanks", icon: BadgeX, color: "bg-slate-50 text-orange-600" },
    ];

    const account = [
        { title: "마이페이지", to: "/app/mypage", icon: User, color: "bg-slate-100 text-slate-700" },
        { title: "설정", to: "/app/mypage/edit", icon: Settings, color: "bg-slate-100 text-slate-700" },
    ];

    const admin = [
        { title: "관리자 콘솔", to: "/app/admin/anomalies", icon: ShieldAlert, color: "bg-rose-100 text-rose-700" },
        { title: "운영 관리", to: "/app/admin/operations", icon: ShieldAlert, color: "bg-rose-100 text-rose-700" },
        { title: "스트리밍 스튜디오", to: "/app/admin/streaming", icon: ShieldAlert, color: "bg-rose-100 text-rose-700" },
    ];

    return (
        <div className="animate-fade-in space-y-8 pb-20">
            <div className="flex items-center justify-between rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/50">
                <div className="flex items-center gap-5">
                    <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-gradient-to-tr from-primary-600 to-primary-400 text-2xl font-black text-white shadow-lg shadow-primary-200">
                        {user?.name?.charAt(0) || "U"}
                    </div>
                    <div>
                        <div className="leading-tight text-xl font-black text-slate-900">{user?.name || "사용자"}</div>
                        <div className="text-sm font-medium text-slate-400">{user?.email}</div>
                    </div>
                </div>
                <button
                    onClick={logout}
                    className="rounded-3xl bg-rose-50 p-4 text-rose-600 transition-colors hover:bg-rose-100"
                >
                    <LogOut className="h-5 w-5" />
                </button>
            </div>

            <MenuSection title="Core Services" items={mainServices} />
            <MenuSection title="Useful Tools" items={tools} />
            <MenuSection title="Games" items={games} />
            <MenuSection title="Account" items={account} />
            {isAdmin && <MenuSection title="Administrator" items={admin} />}

            <div className="pt-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">
                    Next Gen Community Platform v2.0
                </p>
            </div>
        </div>
    );
};


