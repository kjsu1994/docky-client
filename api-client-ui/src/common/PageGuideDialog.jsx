import { useEffect, useId, useRef, useState } from "react";
import { BookOpen, X } from "lucide-react";
import { trapFocus } from "../utils/focusTrap.js";
import { getPageGuideContext } from "./pageGuideContext.js";

export const PageGuideDialog = ({ dialogId, pathname, onClose, triggerRef }) => {
    const [guide, setGuide] = useState(null);
    const [guideLoading, setGuideLoading] = useState(false);
    const [guideError, setGuideError] = useState("");
    const titleId = useId();
    const descriptionId = useId();
    const dialogRef = useRef(null);
    const closeButtonRef = useRef(null);
    const guideTitle = guide?.title || "페이지 설명";

    const loadGuide = async () => {
        setGuideLoading(true);
        setGuideError("");
        try {
            const module = await import("./pageGuides.js");
            setGuide(module.getPageGuide(pathname, getPageGuideContext()));
        } catch {
            setGuideError("페이지 설명을 불러오지 못했습니다.");
        } finally {
            setGuideLoading(false);
        }
    };

    useEffect(() => {
        void loadGuide();
    }, [pathname]);

    useEffect(() => {
        const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                onClose();
                return;
            }
            trapFocus(event, dialogRef.current);
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.clearTimeout(focusTimer);
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKeyDown);
            if (previousFocus?.isConnected) {
                previousFocus.focus();
            } else {
                triggerRef.current?.focus();
            }
        };
    }, [onClose, triggerRef]);

    return (
        <div
            className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:items-center sm:p-6"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <section
                id={dialogId}
                ref={dialogRef}
                className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100vh-3rem)]"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
            >
                <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">
                                <BookOpen className="h-3.5 w-3.5 text-primary-500" />
                                페이지 설명
                            </div>
                            <h2 id={titleId} className="mt-3 break-words text-2xl font-black text-slate-900 sm:text-3xl">
                                {guideTitle}
                            </h2>
                            <p id={descriptionId} className={guide ? "mt-2 text-sm font-bold leading-relaxed text-slate-500 sm:text-base" : "sr-only"}>
                                {guide?.summary || "페이지 설명을 불러오는 중입니다."}
                            </p>
                        </div>
                        <button
                            ref={closeButtonRef}
                            type="button"
                            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-900 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
                            onClick={onClose}
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
                        실제 저장, 전송, 삭제 같은 동작은 버튼을 누른 뒤 표시되는 확인 메시지와 서버 응답을 기준으로 처리합니다.
                    </p>
                </footer>
            </section>
        </div>
    );
};
