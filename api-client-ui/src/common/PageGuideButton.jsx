import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { BookOpen, CircleHelp, X } from "lucide-react";
import { useBottomNavVisibility } from "../hooks/useBottomNavVisibility.js";

export const PageGuideButton = () => {
    const location = useLocation();
    const [open, setOpen] = useState(false);
    const [guide, setGuide] = useState(null);
    const [guideLoading, setGuideLoading] = useState(false);
    const [guideError, setGuideError] = useState("");
    const appRoute = location.pathname.startsWith("/app");
    const guideTitle = guide?.title || "페이지 설명";
    const bottomNav = useBottomNavVisibility();
    const syncWithBottomNav = appRoute && bottomNav.enabled;
    const hiddenWithBottomNav = syncWithBottomNav && !bottomNav.visible;

    useEffect(() => {
        setOpen(false);
        setGuide(null);
        setGuideError("");
    }, [location.pathname]);

    useEffect(() => {
        if (!open) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === "Escape") setOpen(false);
        };
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [open]);

    const loadGuide = async () => {
        const pathname = location.pathname;
        setGuideLoading(true);
        setGuideError("");
        try {
            const module = await import("./pageGuides.js");
            setGuide(module.getPageGuide(pathname));
        } catch {
            setGuideError("페이지 설명을 불러오지 못했습니다.");
        } finally {
            setGuideLoading(false);
        }
    };

    const handleOpen = () => {
        setOpen(true);
        if (!guide) {
            void loadGuide();
        }
    };

    return (
        <>
            <button
                type="button"
                className={`fixed z-40 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-white/95 text-slate-700 shadow-lg shadow-slate-900/10 transition-all duration-300 hover:scale-105 hover:bg-slate-900 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 sm:h-11 sm:w-11 sm:right-5 ${
                    appRoute ? "bottom-24 left-4 sm:bottom-auto sm:left-auto sm:top-24" : "right-3 top-4"
                } ${
                    hiddenWithBottomNav ? "pointer-events-none translate-y-8 opacity-0" : "translate-y-0 opacity-100"
                }`}
                onClick={handleOpen}
                aria-label={`${guideTitle} 열기`}
                title={guideTitle}
                data-page-guide-trigger="true"
            >
                <CircleHelp className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>

            {open && (
                <div
                    className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:items-center sm:p-6"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) setOpen(false);
                    }}
                >
                    <section
                        className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100vh-3rem)]"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="page-guide-title"
                    >
                        <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">
                                        <BookOpen className="h-3.5 w-3.5 text-primary-500" />
                                        페이지 설명
                                    </div>
                                    <h2 id="page-guide-title" className="mt-3 break-words text-2xl font-black text-slate-900 sm:text-3xl">
                                        {guideTitle}
                                    </h2>
                                    {guide ? (
                                        <p className="mt-2 text-sm font-bold leading-relaxed text-slate-500 sm:text-base">
                                            {guide.summary}
                                        </p>
                                    ) : null}
                                </div>
                                <button
                                    type="button"
                                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-900 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
                                    onClick={() => setOpen(false)}
                                    aria-label="페이지 설명 닫기"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        </header>
                        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
                            {guideLoading && !guide ? (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-500" role="status" aria-live="polite">
                                    페이지 설명을 불러오는 중입니다.
                                </div>
                            ) : guideError && !guide ? (
                                <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-700" role="alert">
                                    <p>{guideError}</p>
                                    <button
                                        type="button"
                                        className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-black text-rose-700 shadow-sm transition hover:text-rose-900"
                                        onClick={loadGuide}
                                    >
                                        다시 불러오기
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {(guide?.sections || []).map((section) => (
                                        <section key={section.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                            <h3 className="text-sm font-black text-slate-900">{section.title}</h3>
                                            <ol className="mt-3 space-y-2">
                                                {(section.items || []).map((item, index) => (
                                                    <li key={`${section.title}-${index}`} className="flex gap-2 text-sm font-medium leading-relaxed text-slate-600">
                                                        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-black text-slate-500 shadow-sm">
                                                            {index + 1}
                                                        </span>
                                                        <span className="min-w-0 break-words">{item}</span>
                                                    </li>
                                                ))}
                                            </ol>
                                        </section>
                                    ))}
                                </div>
                            )}
                        </div>
                        <footer className="border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
                            <p className="text-xs font-bold leading-relaxed text-slate-500">
                                실제 저장, 전송, 삭제 같은 동작은 버튼을 누른 뒤 표시되는 확인 메시지와 서버 응답을 기준으로 처리됩니다.
                            </p>
                        </footer>
                    </section>
                </div>
            )}
        </>
    );
};
