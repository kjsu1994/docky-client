import { AlertTriangle, Home, RefreshCw, RotateCcw } from "lucide-react";

export const AppErrorFallback = ({ onRetry, onReload, onHome }) => {
    return (
        <main className="min-h-screen bg-[var(--app-bg)] px-4 py-10 text-ink">
            <section className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center text-center">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                    <AlertTriangle className="h-7 w-7" aria-hidden="true" />
                </div>
                <h1 className="text-2xl font-black tracking-normal text-ink">
                    화면을 다시 불러와야 합니다
                </h1>
                <p className="mt-3 max-w-md text-sm font-semibold leading-6 text-ink-muted">
                    일시적인 화면 오류가 발생했습니다. 작성 중인 내용이 있다면 새로고침 전에 잠시 기다린 뒤 다시 시도해 주세요.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <button
                        type="button"
                        onClick={onRetry}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-primary-600/20 transition hover:bg-primary-700"
                    >
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        다시 시도
                    </button>
                    <button
                        type="button"
                        onClick={onReload}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-5 py-3 text-sm font-black text-ink-muted transition hover:border-primary-200 hover:text-primary-700"
                    >
                        <RefreshCw className="h-4 w-4" aria-hidden="true" />
                        새로고침
                    </button>
                    <button
                        type="button"
                        onClick={onHome}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-5 py-3 text-sm font-black text-ink-muted transition hover:border-primary-200 hover:text-primary-700"
                    >
                        <Home className="h-4 w-4" aria-hidden="true" />
                        홈으로 이동
                    </button>
                </div>
            </section>
        </main>
    );
};
