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
import UserAvatar from "../../common/UserAvatar.jsx";

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
        { title: "할 일", to: "/app/todos", icon: CalendarDays, color: "bg-emerald-50 text-emerald-700" },
        { title: "통계", to: "/app/statistics", icon: BarChart, color: "bg-indigo-50 text-indigo-600" },
        { title: "스트리밍", to: "/app/streaming", icon: Film, color: "bg-fuchsia-50 text-fuchsia-700" },
        { title: "사용자게시판", to: "/app/boards/FREE_BOARD", icon: MessageSquare, color: "bg-sky-50 text-sky-600" },
        { title: "Q&A", to: "/app/boards/QUESTION_ANSWER", icon: HelpCircle, color: "bg-emerald-50 text-emerald-600" },
        { title: "투자 도우미", to: "/app/invest", icon: Bot, color: "bg-sky-50 text-sky-700" },
    ];

    const tools = [
        { title: "중간장소 찾기", to: "/app/optimizer", icon: MapPin, color: "bg-rose-50 text-rose-600" },
        { title: "주변 찾기", to: "/app/facility", icon: Car, color: "bg-cyan-50 text-cyan-700" },
        { title: "순위", to: "/app/ranks", icon: Trophy, color: "bg-amber-50 text-amber-600" },
        { title: "뉴스", to: "/app/news", icon: Newspaper, color: "bg-slate-50 text-slate-600" },
    ];

    const games = [
        { title: "게임 허브", to: "/app/games", icon: Dices, color: "bg-amber-50 text-amber-700" },
        { title: "포커", to: "/app/poker", icon: Dices, color: "bg-emerald-50 text-emerald-700" },
        { title: "라스베거스", to: "/app/games/las-vegas", icon: BadgeDollarSign, color: "bg-orange-50 text-orange-600" },
        { title: "노땡스", to: "/app/games/no-thanks", icon: BadgeX, color: "bg-slate-50 text-orange-600" },
        { title: "카탄", to: "/app/games/catan", icon: Dices, color: "bg-lime-50 text-lime-700" },
        { title: "블로커스", to: "/app/games/blokus", icon: Dices, color: "bg-blue-50 text-blue-700" },
        { title: "마헤", to: "/app/games/mahe", icon: Dices, color: "bg-emerald-50 text-emerald-700" },
        { title: "달무티", to: "/app/games/dalmuti", icon: Dices, color: "bg-rose-50 text-rose-700" },
        { title: "6 nimmt!", to: "/app/games/six-nimmt", icon: Dices, color: "bg-rose-50 text-rose-700" },
        { title: "텔레스트레이션", to: "/app/games/telestrations", icon: Dices, color: "bg-sky-50 text-sky-700" },
        { title: "마피아", to: "/app/games/mafia", icon: Dices, color: "bg-zinc-100 text-zinc-800" },
        { title: "시티델", to: "/app/games/citadels", icon: Dices, color: "bg-amber-50 text-zinc-800" },
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
                    <UserAvatar name={user?.name || user?.email} profileUrl={user?.profileUrl || user?.profile_url} size="lg" className="h-16 w-16 rounded-[1.5rem] shadow-lg shadow-primary-200" />
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

            <MenuSection title="핵심 서비스" items={mainServices} />
            <MenuSection title="편의 도구" items={tools} />
            <MenuSection title="게임" items={games} />
            <MenuSection title="계정" items={account} />
            {isAdmin && <MenuSection title="관리자" items={admin} />}

            <div className="pt-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">
                    커뮤니티 플랫폼 v2.0
                </p>
            </div>
        </div>
    );
};


