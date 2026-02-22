import { NavLink } from "react-router-dom";
import { Home, Menu, LayoutGrid } from "lucide-react";

const NavItem = ({ to, icon: Icon, children }) => {
    return (
        <NavLink
            to={to}
            className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1.5 w-full h-full transition-all duration-300 ${
                    isActive 
                        ? "text-primary-600 scale-110 font-bold" 
                        : "text-slate-400 hover:text-slate-500"
                }`
            }
        >
            <div className="relative">
                <Icon className="h-6 w-6" />
            </div>
            <span className="text-[11px] font-black uppercase tracking-widest">{children}</span>
        </NavLink>
    );
};

export const BottomNav = () => {
    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden glass border-t-white/20 h-20 px-4 pb-safe">
            <div className="flex h-full items-center justify-between max-w-lg mx-auto">
                <NavItem to="/app" icon={Home}>홈</NavItem>
                <NavItem to="/app/boards/FREE_BOARD" icon={LayoutGrid}>게시판</NavItem>
                <NavItem to="/app/all-menu" icon={Menu}>메뉴</NavItem>
            </div>
        </nav>
    );
};
