import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Search } from "lucide-react";
import toast from "react-hot-toast";
import api from "../utils/api";

export const AddressSearchBox = ({
    onResolved,
    placeholder = "주소/지역명 입력",
    className = "",
}) => {
    const [query, setQuery] = useState("");
    const [loadingSuggest, setLoadingSuggest] = useState(false);
    const [loadingResolve, setLoadingResolve] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);

    useEffect(() => {
        const onClickOutside = (event) => {
            if (!rootRef.current?.contains(event.target)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, []);

    useEffect(() => {
        const keyword = query.trim();
        if (keyword.length < 2) {
            setSuggestions([]);
            return;
        }

        let cancelled = false;
        const tid = setTimeout(async () => {
            setLoadingSuggest(true);
            try {
                const response = await api.get("/addresses/suggest", {
                    params: { query: keyword, limit: 8 },
                });
                if (cancelled) return;
                const payload = response?.data?.data ?? response?.data ?? {};
                const items = Array.isArray(payload?.items) ? payload.items : [];
                setSuggestions(items);
                setOpen(true);
            } catch (err) {
                if (!cancelled) {
                    setSuggestions([]);
                }
            } finally {
                if (!cancelled) setLoadingSuggest(false);
            }
        }, 250);

        return () => {
            cancelled = true;
            clearTimeout(tid);
        };
    }, [query]);

    const canSearch = useMemo(() => query.trim().length >= 2, [query]);

    const resolveAddress = async (address) => {
        if (!address || loadingResolve) return;
        setLoadingResolve(true);
        try {
            const response = await api.get("/addresses/geocode", {
                params: { address },
            });
            const payload = response?.data?.data ?? response?.data ?? {};
            const latitude = Number(payload?.latitude);
            const longitude = Number(payload?.longitude);
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                throw new Error("Invalid coordinates");
            }
            setQuery(payload?.address || address);
            setOpen(false);
            onResolved?.({
                address: payload?.address || address,
                roadAddress: payload?.road_address ?? payload?.roadAddress ?? null,
                jibunAddress: payload?.jibun_address ?? payload?.jibunAddress ?? null,
                latitude,
                longitude,
            });
        } catch (err) {
            toast.error(err?.response?.data?.message || "주소 좌표를 찾지 못했습니다.");
        } finally {
            setLoadingResolve(false);
        }
    };

    return (
        <div ref={rootRef} className={`relative ${className}`}>
            <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">주소 검색</label>
            <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => {
                        if (suggestions.length) setOpen(true);
                    }}
                    placeholder={placeholder}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-24 text-sm"
                />
                <button
                    type="button"
                    onClick={() => resolveAddress(query.trim())}
                    disabled={!canSearch || loadingResolve}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-black text-white disabled:opacity-60"
                >
                    {loadingResolve ? "검색중..." : "주소찾기"}
                </button>
            </div>

            {open && (
                <div className="absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                    {loadingSuggest ? (
                        <div className="px-3 py-2 text-xs font-semibold text-slate-400">검색 중...</div>
                    ) : suggestions.length === 0 ? (
                        <div className="px-3 py-2 text-xs font-semibold text-slate-400">일치하는 주소가 없습니다.</div>
                    ) : (
                        suggestions.map((item, index) => {
                            const address = item?.address ?? item?.road_address ?? item?.roadAddress ?? item?.jibun_address ?? item?.jibunAddress;
                            const road = item?.road_address ?? item?.roadAddress;
                            const jibun = item?.jibun_address ?? item?.jibunAddress;
                            return (
                                <button
                                    key={`${address}-${index}`}
                                    type="button"
                                    onClick={() => resolveAddress(address)}
                                    className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                                >
                                    <div className="text-sm font-bold text-slate-800">{address}</div>
                                    <div className="mt-0.5 text-xs text-slate-500">
                                        {road && `도로명: ${road}`}
                                        {road && jibun && " | "}
                                        {jibun && `지번: ${jibun}`}
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            )}

            <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                <Search className="h-3 w-3" />
                2글자 이상 입력하면 추천 주소를 제공합니다.
            </div>
        </div>
    );
};
