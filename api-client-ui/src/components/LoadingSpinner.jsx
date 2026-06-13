import { useEffect, useState } from "react";
import { BrandMark } from "../common/BrandLogo.jsx";

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
            {text && <p className="text-sm text-ink-muted">{text}</p>}
        </div>
    );
};

export const LoadingPage = () => {
    return (
        <div className="flex min-h-screen items-center justify-center bg-surface px-6" role="status" aria-live="polite" aria-label="로딩 중">
            <BrandMark
                className="h-36 max-w-[min(88vw,34rem)]"
                ratioClassName="aspect-[3/1]"
                imageClassName="object-[center_49%]"
            />
        </div>
    );
};

export const DelayedLoadingPage = ({ delay = 260 }) => {
    const [visible, setVisible] = useState(delay <= 0);

    useEffect(() => {
        if (delay <= 0) {
            setVisible(true);
            return undefined;
        }
        const timerId = window.setTimeout(() => setVisible(true), delay);
        return () => window.clearTimeout(timerId);
    }, [delay]);

    return visible ? <LoadingPage /> : null;
};

export const DelayedRouteFallback = ({ delay = 220, text = "화면을 준비하는 중입니다..." }) => {
    const [visible, setVisible] = useState(delay <= 0);

    useEffect(() => {
        if (delay <= 0) {
            setVisible(true);
            return undefined;
        }
        const timerId = window.setTimeout(() => setVisible(true), delay);
        return () => window.clearTimeout(timerId);
    }, [delay]);

    return visible ? (
        <div className="flex min-h-[45vh] items-center justify-center px-6">
            <LoadingSpinner text={text} />
        </div>
    ) : null;
};
