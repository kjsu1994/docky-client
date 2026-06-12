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

const fallbackInitial = (name) => {
    const text = String(name || "").trim();
    return text ? text.charAt(0).toUpperCase() : "";
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
    const initial = fallbackInitial(name);
    const numericLevel = Number(level);
    const hasLevel = Number.isFinite(numericLevel) && numericLevel > 0;
    const frame = hasLevel || rewardTier || frameCode ? getLevelFrameMeta({ level: numericLevel, rewardTier, frameCode }) : null;
    const hasRoundedClass = /\brounded(?:-[^\s]+)?\b/.test(className);
    const roundedClass = hasRoundedClass ? "" : "rounded-full";

    useEffect(() => {
        setFailed(false);
    }, [imageUrl]);

    const outerClass = `${sizeClass} relative shrink-0 overflow-visible ${roundedClass} ${
        frame ? `p-[2px] shadow-lg ${frame.ringClass}` : "border border-white bg-slate-100 shadow-sm"
    } ${className}`.trim();
    const innerClass = `h-full w-full overflow-hidden rounded-[inherit] bg-slate-100 ${frame ? "ring-1 ring-white/70" : ""}`;
    const levelBadge = showLevelBadge && hasLevel && size !== "xs" ? (
        <span className={`absolute -bottom-1 left-1/2 z-10 -translate-x-1/2 rounded-full px-1.5 py-0.5 text-[9px] font-black leading-none ring-1 ${frame?.badgeClass || "bg-slate-800 text-white ring-white"}`}>
            Lv.{numericLevel}
        </span>
    ) : null;

    if (imageUrl && !failed) {
        return (
            <span className={outerClass} title={frame ? `${frame.label} 프레임` : undefined}>
                <span className={innerClass}>
                    <img
                        src={imageUrl}
                        alt=""
                        className={`h-full w-full object-cover ${imageClassName}`.trim()}
                        loading="lazy"
                        onError={() => setFailed(true)}
                    />
                </span>
                {levelBadge}
            </span>
        );
    }

    return (
        <span className={outerClass} title={frame ? `${frame.label} 프레임` : undefined}>
            <span className={`${innerClass} flex items-center justify-center font-black text-slate-500`}>
                {initial || <User className="h-1/2 w-1/2" />}
            </span>
            {levelBadge}
        </span>
    );
};

export default UserAvatar;
