import { AlertCircle, RefreshCw } from "lucide-react";

export const ErrorMessage = ({ message, onRetry }) => {
    return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6" role="alert" aria-live="assertive">
            <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                    <h3 className="text-sm font-semibold text-red-900 mb-1">
                        오류가 발생했습니다
                    </h3>
                    <p className="break-words text-sm text-red-700">{message}</p>
                    {onRetry && (
                        <button
                            type="button"
                            onClick={onRetry}
                            className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-red-700 hover:text-red-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200"
                        >
                            <RefreshCw className="h-4 w-4" />
                            다시 시도
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
