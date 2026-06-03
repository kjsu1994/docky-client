import { useEffect, useMemo, useState } from "react";
import { User } from "lucide-react";
import { normalizeProfileImageUrl } from "../utils/profileImage.js";

const SIZE_CLASSES = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
};

const fallbackInitial = (name) => {
    const text = String(name || "").trim();
    return text ? text.charAt(0).toUpperCase() : "";
};

export const UserAvatar = ({ name = "", profileUrl = "", size = "sm", className = "", imageClassName = "" }) => {
    const imageUrl = useMemo(() => normalizeProfileImageUrl(profileUrl), [profileUrl]);
    const [failed, setFailed] = useState(false);
    const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.sm;
    const initial = fallbackInitial(name);

    useEffect(() => {
        setFailed(false);
    }, [imageUrl]);

    const baseClass = `${sizeClass} shrink-0 overflow-hidden rounded-full border border-white bg-slate-100 shadow-sm ${className}`.trim();

    if (imageUrl && !failed) {
        return (
            <img
                src={imageUrl}
                alt=""
                className={`${baseClass} object-cover ${imageClassName}`.trim()}
                loading="lazy"
                onError={() => setFailed(true)}
            />
        );
    }

    return (
        <div className={`${baseClass} flex items-center justify-center font-black text-slate-500`}>
            {initial || <User className="h-1/2 w-1/2" />}
        </div>
    );
};

export default UserAvatar;
