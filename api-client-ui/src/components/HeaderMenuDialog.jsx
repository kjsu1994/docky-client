import { useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import {
    BarChart,
    CalendarDays,
    Car,
    ChevronRight,
    Dices,
    Film,
    HelpCircle,
    Home,
    LifeBuoy,
    MapPin,
    MessageSquare,
    Newspaper,
    Settings,
    ShieldAlert,
    Trophy,
    User,
    X,
} from "lucide-react";
import { trapFocus } from "../utils/focusTrap.js";

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

export const HeaderMenuDialog = ({ panelId, titleId, descriptionId, isAdmin, onClose, launcherRef }) => {
    const panelRef = useRef(null);
    const closeButtonRef = useRef(null);

    const panelSections = useMemo(() => {
        const sections = [
            {
                title: "핵심",
                items: [
                    { title: "게임 허브", to: "/app", icon: Dices },
                    { title: "홈 대시보드", to: "/app/home", icon: Home },
                    { title: "할 일", to: "/app/todos", icon: CalendarDays },
                    { title: "통계", to: "/app/statistics", icon: BarChart },
                    { title: "사용자게시판", to: "/app/boards/FREE_BOARD", icon: MessageSquare },
                    { title: "Q&A", to: "/app/boards/QUESTION_ANSWER", icon: HelpCircle },
                ],
            },
            {
                title: "도구",
                items: [
                    { title: "중간장소", to: "/app/optimizer", icon: MapPin },
                    { title: "주변 찾기", to: "/app/facility", icon: Car },
                    { title: "순위", to: "/app/ranks", icon: Trophy },
                    { title: "뉴스", to: "/app/news", icon: Newspaper },
                    { title: "스트리밍", to: "/app/streaming", icon: Film },
                ],
            },
            {
                title: "계정",
                items: [
                    { title: "내 정보", to: "/app/mypage", icon: User },
                    { title: "신고/문의 상태", to: "/app/support", icon: LifeBuoy },
                    { title: "정보 수정", to: "/app/mypage/edit", icon: Settings },
                ],
            },
        ];
        if (isAdmin) {
            sections.push({
                title: "관리",
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
        const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);

        return () => {
            window.clearTimeout(focusTimer);
            document.body.style.overflow = previousOverflow;
            if (previousFocus?.isConnected) {
                previousFocus.focus();
            } else {
                launcherRef.current?.focus();
            }
        };
    }, [launcherRef]);

    useEffect(() => {
        const onPointerDown = (event) => {
            if (panelRef.current?.contains(event.target)) return;
            onClose();
        };
        const onKeyDown = (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
                return;
            }
            trapFocus(event, panelRef.current);
        };
        window.addEventListener("mousedown", onPointerDown);
        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("mousedown", onPointerDown);
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [onClose]);

    return (
        <>
            <button
                type="button"
                onClick={onClose}
                className="hidden lg:block fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm transition-opacity duration-200"
                aria-label="메뉴 닫기"
            />
            <div
                id={panelId}
                ref={panelRef}
                className="hidden lg:block fixed inset-x-6 top-24 z-50 mx-auto w-full max-w-5xl max-h-[78vh] overflow-y-auto rounded-[2rem] border border-slate-200 bg-white/95 p-6 shadow-2xl backdrop-blur"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
            >
                <div className="mb-5 flex items-center justify-between">
                    <div>
                        <div id={titleId} className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">전체 메뉴</div>
                        <p id={descriptionId} className="mt-1 text-sm font-semibold text-slate-500">자주 쓰는 메뉴를 카테고리별로 모아봤어요.</p>
                    </div>
                    <button
                        ref={closeButtonRef}
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:border-primary-200 hover:text-primary-700"
                        aria-label="모달 닫기"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {panelSections.map((section) => (
                        <MenuSection key={section.title} title={section.title} items={section.items} onSelect={onClose} />
                    ))}
                </div>
            </div>
        </>
    );
};
