import { useEffect, useId, useMemo, useRef, useState } from "react";
import { MapPin, Search } from "lucide-react";
import {
    ADDRESS_QUERY_MAX_LENGTH,
    addressSearchAdapter,
    extractAddressSearchErrorMessage,
    normalizeAddressQuery,
} from "../adapters/addressSearchAdapter.js";
import { openDaumPostcodeLayer } from "../utils/daumPostcodeLoader.js";
import { notifyError } from "../utils/toast.js";

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
    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

    const rootRef = useRef(null);
    const postcodeLayerCloseRef = useRef(null);
    const lastSuggestedKeywordRef = useRef("");
    const generatedId = useId();
    const addressSearchId = useMemo(() => generatedId.replace(/:/g, ""), [generatedId]);
    const inputId = `${addressSearchId}-input`;
    const listboxId = `${addressSearchId}-listbox`;
    const activeOptionId = activeSuggestionIndex >= 0 && suggestions[activeSuggestionIndex]
        ? `${listboxId}-option-${activeSuggestionIndex}`
        : undefined;

    useEffect(() => {
        const onClickOutside = (event) => {
            if (!rootRef.current?.contains(event.target)) {
                setOpen(false);
                setActiveSuggestionIndex(-1);
            }
        };
        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, []);

    useEffect(() => () => {
        postcodeLayerCloseRef.current?.();
        postcodeLayerCloseRef.current = null;
    }, []);

    useEffect(() => {
        const keyword = normalizeAddressQuery(query);

        if (keyword.length < 2) {
            setSuggestions([]);
            setOpen(false);
            setActiveSuggestionIndex(-1);
            lastSuggestedKeywordRef.current = "";
            return;
        }

        if (isComposing) {
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
                const result = await addressSearchAdapter.suggestAddresses({ query: keyword, limit: 5 });
                if (cancelled) return;

                setSuggestions(result.items);
                setOpen(true);
                setActiveSuggestionIndex(-1);
            } catch (err) {
                if (!cancelled) {
                    setSuggestions([]);
                    setOpen(false);
                    setActiveSuggestionIndex(-1);
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
            const payload = await addressSearchAdapter.geocodeAddress(normalizeAddressQuery(address));
            const { latitude, longitude } = payload;

            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                throw new Error("Invalid coordinates");
            }

            const normalizedAddress = payload?.address || address;
            setQuery(normalizedAddress);
            setSuggestions([]);
            setOpen(false);
            setActiveSuggestionIndex(-1);
            lastSuggestedKeywordRef.current = normalizedAddress;

            onResolved?.({
                address: normalizedAddress,
                roadAddress: payload?.roadAddress ?? additional.roadAddress ?? null,
                jibunAddress: payload?.jibunAddress ?? additional.jibunAddress ?? null,
                zonecode: additional.zonecode ?? null,
                latitude,
                longitude,
            });
        } catch (err) {
            notifyError(extractAddressSearchErrorMessage(err, "주소 좌표를 찾지 못했습니다."));
        } finally {
            setLoadingResolve(false);
        }
    };

    const openDaumPostcode = async () => {
        if (loadingPostcode || loadingResolve) return;

        setLoadingPostcode(true);
        try {
            postcodeLayerCloseRef.current?.();
            postcodeLayerCloseRef.current = await openDaumPostcodeLayer({
                oncomplete: (data) => {
                    const selectedAddress = data?.roadAddress || data?.jibunAddress || data?.address || "";
                    if (!selectedAddress) {
                        notifyError("주소를 선택하지 못했습니다.");
                        return;
                    }

                    setQuery(selectedAddress);
                    setOpen(false);
                    setActiveSuggestionIndex(-1);
                    resolveAddress(selectedAddress, {
                        roadAddress: data?.roadAddress || null,
                        jibunAddress: data?.jibunAddress || null,
                        zonecode: data?.zonecode || null,
                    });
                },
                onclose: () => {
                    postcodeLayerCloseRef.current = null;
                },
            });
        } catch (err) {
            notifyError("우편번호 서비스를 불러오지 못했습니다.");
        } finally {
            setLoadingPostcode(false);
        }
    };

    const runPrimaryAction = () => {
        if (primaryIsResolve) {
            resolveAddress(normalizeAddressQuery(query));
            return;
        }
        openDaumPostcode();
    };

    const runSecondaryAction = () => {
        if (secondaryIsResolve) {
            resolveAddress(normalizeAddressQuery(query));
            return;
        }
        openDaumPostcode();
    };

    const selectSuggestion = (item) => {
        const address = item?.address || item?.roadAddress || item?.jibunAddress;
        if (!address) return;
        setActiveSuggestionIndex(-1);
        resolveAddress(address);
    };

    const handleInputKeyDown = (event) => {
        if (event.nativeEvent?.isComposing || isComposing) return;

        if (event.key === "Escape") {
            setOpen(false);
            setActiveSuggestionIndex(-1);
            return;
        }

        if (!suggestions.length) return;

        if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActiveSuggestionIndex((current) => (
                current < suggestions.length - 1 ? current + 1 : 0
            ));
            return;
        }

        if (event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActiveSuggestionIndex((current) => (
                current > 0 ? current - 1 : suggestions.length - 1
            ));
            return;
        }

        if (event.key === "Enter" && open && activeSuggestionIndex >= 0) {
            event.preventDefault();
            selectSuggestion(suggestions[activeSuggestionIndex]);
        }
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
            <label htmlFor={inputId} className="mb-2 block text-xs font-black uppercase tracking-wider text-ink-subtle">주소 검색</label>

            <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                <input
                    id={inputId}
                    role="combobox"
                    value={query}
                    onChange={(e) => setQuery(e.target.value.slice(0, ADDRESS_QUERY_MAX_LENGTH))}
                    onKeyDown={handleInputKeyDown}
                    onCompositionStart={() => setIsComposing(true)}
                    onCompositionEnd={(e) => {
                        setIsComposing(false);
                        setQuery(e.currentTarget.value.slice(0, ADDRESS_QUERY_MAX_LENGTH));
                    }}
                    onFocus={() => {
                        if (suggestions.length) setOpen(true);
                    }}
                    placeholder={placeholder}
                    className="w-full rounded-xl border border-line bg-control py-2.5 pl-9 pr-24 text-sm text-ink placeholder:text-ink-subtle"
                    maxLength={ADDRESS_QUERY_MAX_LENGTH}
                    aria-autocomplete="list"
                    aria-expanded={open}
                    aria-controls={listboxId}
                    aria-activedescendant={activeOptionId}
                    aria-busy={loadingSuggest}
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
                    className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[11px] font-black text-ink-muted hover:bg-control-hover disabled:opacity-60"
                >
                    {secondaryLoading ? secondaryLoadingText : secondaryButtonLabel}
                </button>
            </div>

            {open && (
                <div
                    id={listboxId}
                    role="listbox"
                    aria-label="주소 검색 제안"
                    aria-live="polite"
                    className="absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-line bg-surface p-1 shadow-xl"
                >
                    {loadingSuggest ? (
                        <div className="px-3 py-2 text-xs font-semibold text-ink-subtle">검색 중...</div>
                    ) : suggestions.length === 0 ? (
                        <div className="px-3 py-2 text-xs font-semibold text-ink-subtle">일치하는 주소가 없습니다.</div>
                    ) : (
                        suggestions.map((item, index) => {
                            const road = item?.roadAddress;
                            const jibun = item?.jibunAddress;
                            const address = item?.address || road || jibun;
                            const active = index === activeSuggestionIndex;

                            return (
                                <button
                                    key={`${address}-${index}`}
                                    id={`${listboxId}-option-${index}`}
                                    role="option"
                                    aria-selected={index === activeSuggestionIndex}
                                    type="button"
                                    onMouseEnter={() => setActiveSuggestionIndex(index)}
                                    onClick={() => selectSuggestion(item)}
                                    className={`block w-full rounded-lg px-3 py-2 text-left ${
                                        active ? "bg-control-hover" : "hover:bg-control"
                                    }`}
                                >
                                    <div className="text-sm font-bold text-ink">{address}</div>
                                    <div className="mt-0.5 text-xs text-ink-muted">
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

            <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-ink-subtle">
                <Search className="h-3 w-3" />
                주소 검색어 {query.length}/{ADDRESS_QUERY_MAX_LENGTH}자
            </div>
        </div>
    );
};
