import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Search } from "lucide-react";
import toast from "react-hot-toast";
import api from "../utils/api";

const loadDaumPostcodeScript = () =>
    new Promise((resolve, reject) => {
        if (window?.daum?.Postcode) {
            resolve();
            return;
        }

        const existing = document.querySelector('script[data-daum-postcode="true"]');
        if (existing) {
            existing.addEventListener("load", () => resolve(), { once: true });
            existing.addEventListener("error", () => reject(new Error("Daum postcode load failed")), { once: true });
            return;
        }

        const script = document.createElement("script");
        script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
        script.async = true;
        script.dataset.daumPostcode = "true";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Daum postcode load failed"));
        document.body.appendChild(script);
    });

export const AddressSearchBox = ({
    onResolved,
    placeholder = "주소/지명 입력",
    className = "",
    primaryButtonLabel = "주소찾기",
    secondaryButtonLabel = "우편번호 검색",
    primaryAction = "resolve",
    secondaryAction = "postcode",
}) => {
    const [query, setQuery] = useState("");
    const [loadingSuggest, setLoadingSuggest] = useState(false);
    const [loadingResolve, setLoadingResolve] = useState(false);
    const [loadingPostcode, setLoadingPostcode] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [open, setOpen] = useState(false);
    const [isComposing, setIsComposing] = useState(false);

    const rootRef = useRef(null);
    const lastSuggestedKeywordRef = useRef("");

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
            lastSuggestedKeywordRef.current = "";
            return;
        }

        if (lastSuggestedKeywordRef.current === keyword) {
            return;
        }

        let cancelled = false;
        const tid = setTimeout(async () => {
            setLoadingSuggest(true);
            lastSuggestedKeywordRef.current = keyword;

            try {
                const response = await api.get("/addresses/suggest", {
                    params: { query: keyword, limit: 5 },
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
                if (!cancelled) {
                    setLoadingSuggest(false);
                }
            }
        }, 350);

        return () => {
            cancelled = true;
            clearTimeout(tid);
        };
    }, [query, isComposing]);

    const canSearch = useMemo(() => query.trim().length >= 2, [query]);
    const primaryIsResolve = primaryAction === "resolve";
    const secondaryIsResolve = secondaryAction === "resolve";

    const resolveAddress = async (address, additional = {}) => {
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

            const normalizedAddress = payload?.address || address;
            setQuery(normalizedAddress);
            setSuggestions([]);
            setOpen(false);
            lastSuggestedKeywordRef.current = normalizedAddress;

            onResolved?.({
                address: normalizedAddress,
                roadAddress: payload?.road_address ?? payload?.roadAddress ?? additional.roadAddress ?? null,
                jibunAddress: payload?.jibun_address ?? payload?.jibunAddress ?? additional.jibunAddress ?? null,
                zonecode: additional.zonecode ?? null,
                latitude,
                longitude,
            });
        } catch (err) {
            toast.error(err?.response?.data?.message || "주소 좌표를 찾지 못했습니다.");
        } finally {
            setLoadingResolve(false);
        }
    };

    const openDaumPostcode = async () => {
        if (loadingPostcode || loadingResolve) return;

        setLoadingPostcode(true);
        try {
            await loadDaumPostcodeScript();
            new window.daum.Postcode({
                oncomplete: (data) => {
                    const selectedAddress = data?.roadAddress || data?.jibunAddress || data?.address || "";
                    if (!selectedAddress) {
                        toast.error("주소를 선택하지 못했습니다.");
                        return;
                    }

                    setQuery(selectedAddress);
                    setOpen(false);
                    resolveAddress(selectedAddress, {
                        roadAddress: data?.roadAddress || null,
                        jibunAddress: data?.jibunAddress || null,
                        zonecode: data?.zonecode || null,
                    });
                },
            }).open();
        } catch (err) {
            toast.error("우편번호 서비스를 불러오지 못했습니다.");
        } finally {
            setLoadingPostcode(false);
        }
    };

    const runPrimaryAction = () => {
        if (primaryIsResolve) {
            resolveAddress(query.trim());
            return;
        }
        openDaumPostcode();
    };

    const runSecondaryAction = () => {
        if (secondaryIsResolve) {
            resolveAddress(query.trim());
            return;
        }
        openDaumPostcode();
    };

    const primaryDisabled = primaryIsResolve
        ? (!canSearch || loadingResolve)
        : (loadingPostcode || loadingResolve);

    const secondaryDisabled = secondaryIsResolve
        ? (!canSearch || loadingResolve)
        : (loadingPostcode || loadingResolve);

    const primaryLoadingText = primaryIsResolve ? "검색 중..." : "주소창 여는 중...";
    const secondaryLoadingText = secondaryIsResolve ? "조회 중..." : "주소창 여는 중...";
    const primaryLoading = primaryIsResolve ? loadingResolve : loadingPostcode;
    const secondaryLoading = secondaryIsResolve ? loadingResolve : loadingPostcode;

    return (
        <div ref={rootRef} className={`relative ${className}`}>
            <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">주소 검색</label>

            <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onCompositionStart={() => setIsComposing(true)}
                    onCompositionEnd={(e) => {
                        setIsComposing(false);
                        setQuery(e.currentTarget.value);
                    }}
                    onFocus={() => {
                        if (suggestions.length) setOpen(true);
                    }}
                    placeholder={placeholder}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-24 text-sm"
                />
                <button
                    type="button"
                    onClick={runPrimaryAction}
                    disabled={primaryDisabled}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-black text-white disabled:opacity-60"
                >
                    {primaryLoading ? primaryLoadingText : primaryButtonLabel}
                </button>
            </div>

            <div className="mt-2 flex justify-end">
                <button
                    type="button"
                    onClick={runSecondaryAction}
                    disabled={secondaryDisabled}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                    {secondaryLoading ? secondaryLoadingText : secondaryButtonLabel}
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
                                        {road && `도로명 ${road}`}
                                        {road && jibun && " | "}
                                        {jibun && `지번 ${jibun}`}
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            )}

            <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                <Search className="h-3 w-3" />
                검색 옵션
            </div>
        </div>
    );
};
