import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { Dices, LayoutGrid, Menu, MessageCircle } from "lucide-react";
import { publishBottomNavVisibility } from "../hooks/useBottomNavVisibility.js";

const shouldRenderBottomNav = () => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(max-width: 1023px)").matches;
};

const NavItem = ({ to, icon: Icon, end = false, hiddenFromA11y = false, children }) => {
    return (
        <NavLink
            to={to}
            end={end}
            tabIndex={hiddenFromA11y ? -1 : undefined}
            className={({ isActive }) =>
                `flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 ${
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
    const [enabled, setEnabled] = useState(shouldRenderBottomNav);
    const [visible, setVisible] = useState(true);
    const lastScrollYRef = useRef(0);
    const frameRef = useRef(0);

    useEffect(() => {
        if (typeof window === "undefined") return undefined;
        const query = window.matchMedia("(max-width: 1023px)");
        const syncEnabled = () => {
            setEnabled(query.matches);
            if (!query.matches) setVisible(true);
        };

        syncEnabled();
        query.addEventListener?.("change", syncEnabled);
        return () => query.removeEventListener?.("change", syncEnabled);
    }, []);

    useEffect(() => {
        if (!enabled || typeof window === "undefined") return undefined;
        lastScrollYRef.current = window.scrollY || 0;

        const onScroll = () => {
            if (frameRef.current) return;

            frameRef.current = window.requestAnimationFrame(() => {
                frameRef.current = 0;
                const currentY = window.scrollY || 0;
                const lastY = lastScrollYRef.current;
                const delta = currentY - lastY;

                if (currentY <= 24) {
                    setVisible(true);
                } else if (Math.abs(delta) > 6) {
                    setVisible(delta < 0);
                }

                lastScrollYRef.current = currentY;
            });
        };

        window.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            window.removeEventListener("scroll", onScroll);
            if (frameRef.current) {
                window.cancelAnimationFrame(frameRef.current);
                frameRef.current = 0;
            }
        };
    }, [enabled]);

    useEffect(() => {
        publishBottomNavVisibility({ enabled, visible: enabled ? visible : true });
    }, [enabled, visible]);

    useEffect(() => {
        return () => publishBottomNavVisibility({ enabled: false, visible: true });
    }, []);

    if (!enabled) return null;

    return (
        <nav
            aria-label="하단 주요 내비게이션"
            aria-hidden={!visible}
            data-bottom-nav="true"
            data-bottom-nav-visible={visible ? "true" : "false"}
            className={`fixed bottom-0 left-0 right-0 z-50 h-20 border-t-white/20 px-4 pb-safe transition-transform duration-300 lg:hidden ${
                visible ? "translate-y-0" : "translate-y-full"
            } glass`}
        >
            <div className="mx-auto grid h-full max-w-lg grid-cols-4 items-center">
                <NavItem to="/app" icon={Dices} end hiddenFromA11y={!visible}>게임</NavItem>
                <NavItem to="/app/boards/FREE_BOARD" icon={LayoutGrid} hiddenFromA11y={!visible}>게시판</NavItem>
                <NavItem to="/app/chat" icon={MessageCircle} hiddenFromA11y={!visible}>채팅</NavItem>
                <NavItem to="/app/all-menu" icon={Menu} hiddenFromA11y={!visible}>메뉴</NavItem>
            </div>
        </nav>
    );
};
