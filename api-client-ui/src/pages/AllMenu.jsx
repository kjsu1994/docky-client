import { Link } from "react-router-dom";
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
    ShieldAlert, 
    Settings,
    LogOut,
    ChevronRight,
    HelpCircle
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { isAdminUser } from "../utils/authorization";

const MenuSection = ({ title, items }) => (
    <div className="space-y-3">
        <h3 className="px-2 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{title}</h3>
        <div className="grid grid-cols-1 gap-2">
            {items.map((item) => (
                <Link
                    key={item.to}
                    to={item.to}
                    className="flex items-center justify-between p-4 rounded-3xl bg-white border border-slate-50 shadow-sm active:scale-[0.98] transition-all"
                >
                    <div className="flex items-center gap-4">
                        <div className={`p-2.5 rounded-2xl ${item.color || "bg-slate-50 text-slate-600"}`}>
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
        { title: "통계", to: "/app/statistics", icon: BarChart, color: "bg-indigo-50 text-indigo-600" },
        { title: "자유게시판", to: "/app/boards/FREE_BOARD", icon: MessageSquare, color: "bg-sky-50 text-sky-600" },
        { title: "Q&A", to: "/app/boards/QUESTION_ANSWER", icon: HelpCircle, color: "bg-emerald-50 text-emerald-600" },
    ];

    const tools = [
        { title: "중간장소 찾기", to: "/app/optimizer", icon: MapPin, color: "bg-rose-50 text-rose-600" },
        { title: "랭킹 시스템", to: "/app/ranks", icon: Trophy, color: "bg-amber-50 text-amber-600" },
        { title: "럭키 플링코", to: "/app/plinko", icon: Dices, color: "bg-violet-50 text-violet-600" },
        { title: "최신 뉴스", to: "/app/news", icon: Newspaper, color: "bg-slate-50 text-slate-600" },
        { title: "전기요금 계산기", to: "/app/calculators", icon: Calculator, color: "bg-orange-50 text-orange-600" },
        { title: "GPT 인공지능", to: "/app/gpt", icon: Bot, color: "bg-cyan-50 text-cyan-600" },
    ];

    const account = [
        { title: "마이페이지", to: "/app/mypage", icon: User, color: "bg-slate-100 text-slate-700" },
        { title: "설정", to: "/app/mypage/edit", icon: Settings, color: "bg-slate-100 text-slate-700" },
    ];

    const admin = [
        { title: "관리자 콘솔", to: "/app/admin/anomalies", icon: ShieldAlert, color: "bg-rose-100 text-rose-700" },
    ];

    return (
        <div className="space-y-8 pb-20 animate-fade-in">
            {/* 상단 프로필 요약 */}
            <div className="p-8 rounded-[2.5rem] bg-white border border-slate-100 shadow-xl shadow-slate-200/50 flex items-center justify-between">
                <div className="flex items-center gap-5">
                    <div className="h-16 w-16 rounded-[1.5rem] bg-gradient-to-tr from-primary-600 to-primary-400 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-primary-200">
                        {user?.name?.charAt(0) || "U"}
                    </div>
                    <div>
                        <div className="text-xl font-black text-slate-900 leading-tight">{user?.name || "사용자"}</div>
                        <div className="text-sm font-medium text-slate-400">{user?.email}</div>
                    </div>
                </div>
                <button 
                    onClick={logout}
                    className="p-4 rounded-3xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                >
                    <LogOut className="h-5 w-5" />
                </button>
            </div>

            <MenuSection title="Core Services" items={mainServices} />
            <MenuSection title="Useful Tools" items={tools} />
            <MenuSection title="Account" items={account} />
            {isAdmin && <MenuSection title="Administrator" items={admin} />}

            <div className="pt-4 text-center">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
                    Next Gen Community Platform v2.0
                </p>
            </div>
        </div>
    );
};
