import { ChevronLeft, ChevronRight } from "lucide-react";

export const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    const pages = [];
    const maxVisible = 5;

    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
    }

    if (totalPages <= 1) return null;

    return (
        <div className="flex items-center justify-center gap-2 mt-8">
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
                <ChevronLeft className="h-4 w-4" />
            </button>

            {startPage > 1 && (
                <>
                    <button
                        onClick={() => onPageChange(1)}
                        className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
                    >
                        1
                    </button>
                    {startPage > 2 && (
                        <span className="text-slate-400 px-2">...</span>
                    )}
                </>
            )}

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

            {endPage < totalPages && (
                <>
                    {endPage < totalPages - 1 && (
                        <span className="text-slate-400 px-2">...</span>
                    )}
                    <button
                        onClick={() => onPageChange(totalPages)}
                        className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
                    >
                        {totalPages}
                    </button>
                </>
            )}

            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
                <ChevronRight className="h-4 w-4" />
            </button>
        </div>
    );
};