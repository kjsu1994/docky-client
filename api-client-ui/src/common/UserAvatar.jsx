import { useEffect, useMemo, useState } from "react";
import { User } from "lucide-react";
import { getLevelFrameMeta } from "../utils/levelFrame.js";
import { normalizeProfileImageUrl } from "../utils/profileImage.js";

const SIZE_CLASSES = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
    xl: "h-16 w-16 text-xl",
    "2xl": "h-24 w-24 text-3xl",
    "3xl": "h-28 w-28 text-4xl",
};

const FRAME_PADDING_CLASSES = {
    xs: "p-[2px]",
    sm: "p-[2px]",
    md: "p-[3px]",
    lg: "p-[3px]",
    xl: "p-[4px]",
    "2xl": "p-[5px]",
    "3xl": "p-[5px]",
};

const fallbackInitial = (name) => {
    const text = String(name || "").trim();
    return text ? text.charAt(0).toUpperCase() : "";
};

const stripRoundedUtilities = (className) => {
    return String(className || "").replace(/\brounded(?:-[^\s]+)?\b/g, "").trim();
};

export const UserAvatar = ({
    name = "",
    profileUrl = "",
    size = "sm",
    className = "",
    imageClassName = "",
    level = null,
    rewardTier = "",
    frameCode = "",
    showLevelBadge = false,
}) => {
    const imageUrl = useMemo(() => normalizeProfileImageUrl(profileUrl), [profileUrl]);
    const [failed, setFailed] = useState(false);
    const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.sm;
    const framePaddingClass = FRAME_PADDING_CLASSES[size] || FRAME_PADDING_CLASSES.sm;
    const initial = fallbackInitial(name);
    const numericLevel = Number(level);
    const hasLevel = Number.isFinite(numericLevel) && numericLevel > 0;
    const frame = hasLevel || rewardTier || frameCode ? getLevelFrameMeta({ level: numericLevel, rewardTier, frameCode }) : null;
    const safeClassName = stripRoundedUtilities(className);

    useEffect(() => {
        setFailed(false);
    }, [imageUrl]);

    const outerClass = `${sizeClass} relative inline-flex shrink-0 items-center justify-center overflow-visible rounded-full ${
        frame ? `${framePaddingClass} ${frame.frameClass || ""} shadow-lg` : "border border-white bg-slate-100 shadow-sm"
    } ${safeClassName}`.trim();
    const innerClass = `relative z-10 h-full w-full overflow-hidden rounded-full bg-slate-100 ${
        frame ? "ring-2 ring-white/85 shadow-[0_1px_2px_rgba(15,23,42,0.28)]" : ""
    }`;
    const frameGlow = frame ? (
        <span className={`pointer-events-none absolute -inset-1 z-0 rounded-full opacity-70 blur-[3px] ${frame.glowClass || ""}`} />
    ) : null;
    const frameCap = frame ? (
        <span
            className={`pointer-events-none absolute inset-0 z-20 rounded-full ring-1 ${frame.innerRingClass || "ring-white/80"} shadow-[inset_0_1px_2px_rgba(255,255,255,0.85),inset_0_-2px_4px_rgba(15,23,42,0.32)]`}
        />
    ) : null;
    const levelBadge = showLevelBadge && hasLevel && size !== "xs" ? (
        <span className={`absolute -bottom-1 left-1/2 z-30 -translate-x-1/2 rounded-full px-1.5 py-0.5 text-[9px] font-black leading-none ring-1 ${frame?.badgeClass || "bg-slate-800 text-white ring-white"}`}>
            Lv.{numericLevel}
        </span>
    ) : null;

    const content = imageUrl && !failed ? (
        <span className={innerClass}>
            <img
                src={imageUrl}
                alt=""
                className={`h-full w-full object-cover ${imageClassName}`.trim()}
                loading="lazy"
                onError={() => setFailed(true)}
            />
        </span>
    ) : (
        <span className={`${innerClass} flex items-center justify-center font-black text-slate-500`}>
            {initial || <User className="h-1/2 w-1/2" />}
        </span>
    );

    return (
        <span className={outerClass} title={frame ? `${frame.label} frame` : undefined}>
            {frameGlow}
            {content}
            {frameCap}
            {levelBadge}
        </span>
    );
};

export default UserAvatar;
