export const LoadingSpinner = ({ size = "md", text = "" }) => {
    const sizeClasses = {
        sm: "h-4 w-4 border-2",
        md: "h-8 w-8 border-[3px]",
        lg: "h-12 w-12 border-4",
    };

    return (
        <div className="flex flex-col items-center justify-center gap-3 p-8" role={text ? "status" : undefined} aria-live={text ? "polite" : undefined}>
            <span
                className={`${sizeClasses[size] || sizeClasses.md} animate-spin rounded-full border-primary-100 border-t-primary-600`}
                aria-hidden="true"
            />
            {text && <p className="text-sm text-slate-600">{text}</p>}
        </div>
    );
};

export const LoadingPage = () => {
    return (
        <div className="min-h-screen flex items-center justify-center">
            <LoadingSpinner size="lg" text="불러오는 중..." />
        </div>
    );
};
