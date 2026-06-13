export const Skeleton = ({ className, ...props }) => {
    return (
        <div
            className={`animate-pulse rounded-2xl bg-control ${className}`}
            {...props}
        />
    );
};

export const CardSkeleton = () => (
    <div className="card p-6 space-y-4">
        <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
            </div>
        </div>
        <Skeleton className="h-6 w-3/4" />
        <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
        </div>
        <div className="pt-4 flex justify-between items-center">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-8 w-8 rounded-full" />
        </div>
    </div>
);

export const ListSkeleton = ({ count = 5 }) => (
    <div className="space-y-4">
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 rounded-3xl border border-line bg-surface p-4">
                <Skeleton className="h-12 w-12 rounded-2xl" />
                <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                </div>
            </div>
        ))}
    </div>
);
