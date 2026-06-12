import { useEffect, useState } from "react";
import api from "../utils/api.js";

const toApiEndpoint = (url) => {
    const raw = String(url || "").trim();
    if (!raw) return "";

    try {
        const parsed = new URL(raw, window.location.origin);
        if (parsed.origin !== window.location.origin || !parsed.pathname.startsWith("/api/chat/file/")) return "";
        return `${parsed.pathname.slice("/api".length)}${parsed.search}`;
    } catch {
        return "";
    }
};

const AuthenticatedAttachmentImage = ({ src, alt, className = "", fallbackClassName = "" }) => {
    const [objectUrl, setObjectUrl] = useState("");
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!src) {
            setObjectUrl("");
            setFailed(false);
            return undefined;
        }

        let active = true;
        let nextObjectUrl = "";
        const endpoint = toApiEndpoint(src);
        setObjectUrl("");
        setFailed(false);
        if (!endpoint) {
            setFailed(true);
            return undefined;
        }

        api.get(endpoint, {
            responseType: "blob",
            meta: { trackNetwork: false },
        }).then((response) => {
            nextObjectUrl = URL.createObjectURL(response.data);
            if (active) {
                setObjectUrl(nextObjectUrl);
            } else {
                URL.revokeObjectURL(nextObjectUrl);
            }
        }).catch(() => {
            if (active) {
                setFailed(true);
            }
        });

        return () => {
            active = false;
            if (nextObjectUrl) {
                URL.revokeObjectURL(nextObjectUrl);
            }
        };
    }, [src]);

    if (failed) {
        return (
            <div className={`flex min-h-[120px] items-center justify-center rounded-xl bg-slate-100 px-4 text-xs font-bold text-slate-400 ${fallbackClassName}`}>
                이미지를 불러올 수 없습니다.
            </div>
        );
    }

    if (!objectUrl) {
        return (
            <div className={`min-h-[120px] animate-pulse rounded-xl bg-slate-100 ${fallbackClassName}`} aria-label="이미지 로딩 중" />
        );
    }

    return (
        <img
            src={objectUrl}
            alt={alt}
            className={className}
            loading="lazy"
            decoding="async"
            onClick={() => window.open(objectUrl, "_blank", "noopener,noreferrer")}
        />
    );
};

export default AuthenticatedAttachmentImage;
