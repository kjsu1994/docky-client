import { Sparkles } from "lucide-react";

const DEFAULT_TYPE_LABELS = {
    AD: "광고",
    NOTICE: "공지",
};

const sizeClasses = {
    xs: "gap-[0.32em] px-[0.58em] py-[0.22em] text-[11px]",
    sm: "gap-[0.35em] px-[0.65em] py-[0.28em] text-xs",
    md: "gap-[0.35em] px-[0.65em] py-[0.28em] text-sm",
};

const toneClasses = {
    glass: "bg-white/20 text-white backdrop-blur-md",
    image: "bg-slate-950/40 text-white shadow-sm backdrop-blur-[2px]",
    surface: "bg-slate-100 text-slate-600",
    admin: "border border-slate-200 bg-white text-slate-600",
};

const iconToneClasses = {
    glass: "text-amber-300",
    image: "text-amber-300",
    surface: "text-primary-500",
    admin: "text-primary-500",
};

const iconSizeClasses = {
    xs: "h-[1em] w-[1em]",
    sm: "h-[1em] w-[1em]",
    md: "h-[1em] w-[1em]",
};

export const getBannerTypeLabel = (type, label) => {
    const trimmedLabel = String(label || "").trim();
    if (trimmedLabel) return trimmedLabel;

    const normalizedType = String(type || "NOTICE").trim().toUpperCase();
    return DEFAULT_TYPE_LABELS[normalizedType] || normalizedType || DEFAULT_TYPE_LABELS.NOTICE;
};

export const BannerTypeBadge = ({
    type,
    label,
    tone = "glass",
    size = "sm",
    className = "",
}) => {
    const resolvedTone = toneClasses[tone] ? tone : "glass";
    const resolvedSize = sizeClasses[size] ? size : "sm";
    const text = getBannerTypeLabel(type, label);

    return (
        <span
            className={[
                "inline-flex w-fit max-w-full items-center whitespace-nowrap rounded-full font-bold leading-none",
                sizeClasses[resolvedSize],
                toneClasses[resolvedTone],
                className,
            ].filter(Boolean).join(" ")}
            title={text}
        >
            <Sparkles className={`${iconSizeClasses[resolvedSize]} ${iconToneClasses[resolvedTone]}`} />
            {text}
        </span>
    );
};
