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
        <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
            <button
                onClick={() => onPageChange(1)}
                disabled={currentPage === 1}
                className="inline-flex items-center justify-center h-9 px-3 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
                <ChevronsLeft className="h-4 w-4 mr-1" />
                처음
            </button>

            <button
                onClick={() => onPageChange(prevGroupPage)}
                disabled={!canMovePrevGroup}
                className="inline-flex items-center justify-center h-9 px-3 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
                이전5
            </button>

            {pages.map((page) => (
                <button
                    key={page}
                    onClick={() => onPageChange(page)}
                    className={`inline-flex items-center justify-center h-9 w-9 rounded-lg border transition-all ${
                        page === currentPage
                            ? "bg-primary-600 border-primary-600 text-white font-semibold"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                >
                    {page}
                </button>
            ))}

            <button
                onClick={() => onPageChange(nextGroupPage)}
                disabled={!canMoveNextGroup}
                className="inline-flex items-center justify-center h-9 px-3 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
                다음5
            </button>

            <button
                onClick={() => onPageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="inline-flex items-center justify-center h-9 px-3 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
                마지막
                <ChevronsRight className="h-4 w-4 ml-1" />
            </button>
        </div>
    );
};
