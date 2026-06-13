import { ChevronsLeft, ChevronsRight } from "lucide-react";

export const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    const pages = [];
    const pageGroupSize = 5;

    const startPage = Math.floor((currentPage - 1) / pageGroupSize) * pageGroupSize + 1;
    const endPage = Math.min(totalPages, startPage + pageGroupSize - 1);

    for (let i = startPage; i <= endPage; i += 1) {
        pages.push(i);
    }

    if (totalPages <= 1) return null;

    const canMovePrevGroup = startPage > 1;
    const canMoveNextGroup = endPage < totalPages;
    const prevGroupPage = Math.max(1, startPage - pageGroupSize);
    const nextGroupPage = Math.min(totalPages, startPage + pageGroupSize);

    return (
        <nav className="flex flex-wrap items-center justify-center gap-2 mt-8" aria-label="페이지 이동">
            <button
                type="button"
                onClick={() => onPageChange(1)}
                disabled={currentPage === 1}
                aria-label="첫 페이지로 이동"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-line bg-surface px-3 text-sm text-ink-muted transition-all hover:bg-control disabled:cursor-not-allowed disabled:opacity-50"
            >
                <ChevronsLeft className="h-4 w-4 mr-1" />
                처음
            </button>

            <button
                type="button"
                onClick={() => onPageChange(prevGroupPage)}
                disabled={!canMovePrevGroup}
                aria-label={`이전 ${pageGroupSize}개 페이지로 이동`}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-line bg-surface px-3 text-sm text-ink-muted transition-all hover:bg-control disabled:cursor-not-allowed disabled:opacity-50"
            >
                이전5
            </button>

            {pages.map((page) => (
                <button
                    type="button"
                    key={page}
                    onClick={() => onPageChange(page)}
                    aria-label={`${page}페이지로 이동`}
                    aria-current={page === currentPage ? "page" : undefined}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-all ${
                        page === currentPage
                            ? "border-primary-600 bg-primary-600 font-semibold text-white"
                            : "border-line bg-surface text-ink-muted hover:bg-control"
                    }`}
                >
                    {page}
                </button>
            ))}

            <button
                type="button"
                onClick={() => onPageChange(nextGroupPage)}
                disabled={!canMoveNextGroup}
                aria-label={`다음 ${pageGroupSize}개 페이지로 이동`}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-line bg-surface px-3 text-sm text-ink-muted transition-all hover:bg-control disabled:cursor-not-allowed disabled:opacity-50"
            >
                다음5
            </button>

            <button
                type="button"
                onClick={() => onPageChange(totalPages)}
                disabled={currentPage === totalPages}
                aria-label="마지막 페이지로 이동"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-line bg-surface px-3 text-sm text-ink-muted transition-all hover:bg-control disabled:cursor-not-allowed disabled:opacity-50"
            >
                마지막
                <ChevronsRight className="h-4 w-4 ml-1" />
            </button>
        </nav>
    );
};
