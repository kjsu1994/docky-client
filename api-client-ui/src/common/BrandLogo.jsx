export const CTFMON_LOGO_SRC = "/CTFMON_Logo.png";

export const BrandMark = ({ className = "h-12", imageClassName = "" }) => (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden aspect-[4/1] ${className}`}>
        <img
            src={CTFMON_LOGO_SRC}
            alt="CTFMON"
            loading="eager"
            decoding="async"
            fetchPriority="high"
            className={`block h-full w-full object-cover object-[center_47%] ${imageClassName}`}
        />
    </span>
);

export const BrandLogo = ({ className = "", markClassName = "h-12", showText = false }) => (
    <span className={`inline-flex min-w-0 items-center gap-3 ${className}`}>
        <BrandMark className={markClassName} />
        {showText && (
            <span className="min-w-0 leading-tight">
                <span className="block text-lg font-black tracking-tight text-slate-900">CTFMON</span>
                <span className="block text-[10px] font-bold uppercase tracking-widest text-primary-500">
                    ctfmon shop
                </span>
            </span>
        )}
    </span>
);
