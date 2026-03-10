import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { Dices, Home, LayoutGrid, Menu } from "lucide-react";

const NavItem = ({ to, icon: Icon, children }) => {
    return (
        <NavLink
            to={to}
            className={({ isActive }) =>
                `flex h-full w-full flex-col items-center justify-center gap-1.5 transition-all duration-300 ${
                    isActive
                        ? "scale-110 font-bold text-primary-600"
                        : "text-slate-400 hover:text-slate-500"
                }`
            }
        >
            <Icon className="h-6 w-6" />
            <span className="text-[11px] font-black uppercase tracking-widest">{children}</span>
        </NavLink>
    );
};

export const BottomNav = () => {
    const [visible, setVisible] = useState(true);
    const lastScrollYRef = useRef(0);
    const tickingRef = useRef(false);

    useEffect(() => {
        if (typeof window === "undefined") return undefined;

        const onScroll = () => {
            if (tickingRef.current) return;
            tickingRef.current = true;

            window.requestAnimationFrame(() => {
                const currentY = window.scrollY || 0;
                const lastY = lastScrollYRef.current;
                const delta = currentY - lastY;

                if (currentY <= 24) {
                    setVisible(true);
                } else if (Math.abs(delta) > 6) {
                    setVisible(delta < 0);
                }

                lastScrollYRef.current = currentY;
                tickingRef.current = false;
            });
        };

        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <nav
            className={`fixed bottom-0 left-0 right-0 z-50 h-20 border-t-white/20 px-4 pb-safe transition-transform duration-300 lg:hidden ${
                visible ? "translate-y-0" : "translate-y-full"
            } glass`}
        >
            <div className="mx-auto grid h-full max-w-lg grid-cols-4 items-center">
                <NavItem to="/app" icon={Home}>HOME</NavItem>
                <NavItem to="/app/boards/FREE_BOARD" icon={LayoutGrid}>BOARD</NavItem>
                <NavItem to="/app/games" icon={Dices}>GAME</NavItem>
                <NavItem to="/app/all-menu" icon={Menu}>MENU</NavItem>
            </div>
        </nav>
    );
};
