
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Car, LocateFixed, RefreshCw, Search, CreditCard, Clock3, DatabaseZap, X } from "lucide-react";
import api from "../../utils/api.js";
import toast from "react-hot-toast";
import { LoadingSpinner } from "../../components/LoadingSpinner.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { isAdminUser } from "../../utils/authorization.js";
import { AddressSearchBox } from "../../common/AddressSearchBox.jsx";

const INITIAL_CENTER = { latitude: 37.5665, longitude: 126.9780 };

const useNaverMaps = () => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (window.naver && window.naver.maps) {
            setIsLoaded(true);
            return;
        }

        const sdkScript = document.getElementById("naver-maps-sdk");
        if (!sdkScript) {
            setError(true);
            return;
        }

        const onLoad = () => setIsLoaded(true);
        const onError = () => setError(true);
        sdkScript.addEventListener("load", onLoad);
        sdkScript.addEventListener("error", onError);

        if (window.naver && window.naver.maps) setIsLoaded(true);

        return () => {
            sdkScript.removeEventListener("load", onLoad);
            sdkScript.removeEventListener("error", onError);
        };
    }, []);

    return { isLoaded, error };
};

const getEstimate60mFee = (item) => {
    const feeInfo = item?.fee_info ?? item?.feeInfo;
    const baseFee = Number(item?.base_fee ?? item?.baseFee);
    const baseTime = Number(item?.base_time_minutes ?? item?.baseTimeMinutes);
    const extraTime = Number(item?.extra_time_minutes ?? item?.extraTimeMinutes);
    const extraFee = Number(item?.extra_fee ?? item?.extraFee);

    if (feeInfo !== "유료") return 0;
    if (!Number.isFinite(baseFee)) return null;
    if (!Number.isFinite(baseTime) || !Number.isFinite(extraTime) || !Number.isFinite(extraFee) || extraTime <= 0) {
        return baseFee;
    }
    if (baseTime >= 60) return baseFee;
    const extraUnits = Math.ceil((60 - baseTime) / extraTime);
    return baseFee + (extraUnits * extraFee);
};

const getLotId = (item) => item?.parking_lot_id ?? item?.parkingLotId ?? item?.management_no ?? item?.managementNo;
const getFeeInfo = (item) => item?.fee_info ?? item?.feeInfo ?? "";

export const ParkingFinder = () => {
    const { user } = useAuth();
    const adminMode = isAdminUser(user);

    const [center, setCenter] = useState(INITIAL_CENTER);
    const [keyword, setKeyword] = useState("");
    const [radiusKmInput, setRadiusKmInput] = useState("3");
    const [feeFilter, setFeeFilter] = useState("all");
    const [sort, setSort] = useState("distance");
    const [limitInput, setLimitInput] = useState("50");

    const [loading, setLoading] = useState(false);
    const [locatingCurrent, setLocatingCurrent] = useState(false);
    const [fetchedItems, setFetchedItems] = useState([]);
    const [items, setItems] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [selectedLotId, setSelectedLotId] = useState(null);
    const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

    const [importing, setImporting] = useState(false);
    const [csvPath, setCsvPath] = useState("/data/csv_data/Parking_Dataset.csv");

    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markersRef = useRef([]);
    const selectedMarkerRef = useRef(null);
    const pickedCenterMarkerRef = useRef(null);
    const interactionListenersRef = useRef([]);
    const longPressStateRef = useRef({ timerId: null, startX: 0, startY: 0, moved: false });
    const recentPickRef = useRef({ ts: 0, latitude: null, longitude: null });
    const skipFitBoundsOnceRef = useRef(false);
    const skipAutoPanOnceRef = useRef(false);

    const { isLoaded: mapLoaded, error: mapError } = useNaverMaps();

    useEffect(() => {
        window.__parkingFinderOpenLotDetail = (lotId) => {
            setSelectedLotId(lotId);
            setMobileDetailOpen(true);
        };
        return () => {
            delete window.__parkingFinderOpenLotDetail;
        };
    }, []);

    const clearMarkers = () => {
        markersRef.current.forEach((entry) => {
            if (entry?.infoWindow) entry.infoWindow.close();
            if (entry?.marker) entry.marker.setMap(null);
        });
        markersRef.current = [];
        if (selectedMarkerRef.current) {
            selectedMarkerRef.current.setMap(null);
            selectedMarkerRef.current = null;
        }
    };

    const closeAllInfoWindows = useCallback(() => {
        markersRef.current.forEach((entry) => {
            if (entry?.infoWindow) entry.infoWindow.close();
        });
    }, []);

    const handleSelectLotFromList = (id) => {
        setSelectedLotId(id);
        setMobileDetailOpen(true);
    };

    const clearInteractionListeners = useCallback(() => {
        if (!window.naver?.maps?.Event) return;
        interactionListenersRef.current.forEach((listener) => {
            window.naver.maps.Event.removeListener(listener);
        });
        interactionListenersRef.current = [];
    }, []);

    const normalizeCoord = useCallback((coord) => {
        if (!coord) return null;
        if (typeof coord.lat === "function" && typeof coord.lng === "function") {
            return {
                latitude: Number(coord.lat().toFixed(6)),
                longitude: Number(coord.lng().toFixed(6)),
            };
        }
        if (Number.isFinite(coord?.y) && Number.isFinite(coord?.x)) {
            return {
                latitude: Number(coord.y.toFixed(6)),
                longitude: Number(coord.x.toFixed(6)),
            };
        }
        if (Number.isFinite(coord?.lat) && Number.isFinite(coord?.lng)) {
            return {
                latitude: Number(coord.lat.toFixed(6)),
                longitude: Number(coord.lng.toFixed(6)),
            };
        }
        return null;
    }, []);

    const setPickedCenterMarker = useCallback((latitude, longitude) => {
        if (!mapRef.current || !window.naver?.maps) return;

        const pos = new window.naver.maps.LatLng(latitude, longitude);
        if (pickedCenterMarkerRef.current) {
            pickedCenterMarkerRef.current.setMap(null);
        }
        pickedCenterMarkerRef.current = new window.naver.maps.Marker({
            position: pos,
            map: mapRef.current,
            icon: {
                content: '<div style="width:16px;height:16px;border-radius:9999px;background:#10b981;border:3px solid #fff;box-shadow:0 2px 10px rgba(16,185,129,0.5)"></div>',
                anchor: new window.naver.maps.Point(8, 8),
            },
            zIndex: 210,
        });
    }, []);

    const applyPickedCenter = useCallback((coord, modeLabel) => {
        const point = normalizeCoord(coord);
        if (!point) return;
        const now = Date.now();
        const recent = recentPickRef.current;
        if (
            now - recent.ts < 700 &&
            recent.latitude === point.latitude &&
            recent.longitude === point.longitude
        ) {
            return;
        }
        recentPickRef.current = { ts: now, latitude: point.latitude, longitude: point.longitude };
        setPickedCenterMarker(point.latitude, point.longitude);
        setCenter(point);
        toast.success(`${modeLabel} 위치를 기준점으로 설정했습니다.`);
    }, [normalizeCoord, setPickedCenterMarker]);

    const pickCenterByClientPoint = useCallback((clientX, clientY, modeLabel) => {
        if (!mapRef.current || !window.naver?.maps || !mapContainerRef.current) return;
        const rect = mapContainerRef.current.getBoundingClientRect();
        const offsetX = clientX - rect.left;
        const offsetY = clientY - rect.top;
        if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY)) return;
        if (offsetX < 0 || offsetY < 0 || offsetX > rect.width || offsetY > rect.height) return;

        const projection = mapRef.current.getProjection?.();
        if (!projection) return;

        const point = new window.naver.maps.Point(offsetX, offsetY);
        let coord = null;
        if (typeof projection.fromOffsetToCoord === "function") {
            coord = projection.fromOffsetToCoord(point);
        } else if (typeof projection.fromPointToCoord === "function") {
            coord = projection.fromPointToCoord(point);
        }
        if (!coord) return;
        applyPickedCenter(coord, modeLabel);
    }, [applyPickedCenter]);

    const parseRadiusKm = useCallback(() => {
        const numeric = Number(radiusKmInput);
        if (!Number.isFinite(numeric)) return 3;
        return Math.max(0, Math.min(30, numeric));
    }, [radiusKmInput]);

    const parseLimit = useCallback(() => {
        const numeric = Number(limitInput);
        if (!Number.isFinite(numeric)) return 50;
        const integer = Math.trunc(numeric);
        return Math.max(1, Math.min(200, integer));
    }, [limitInput]);

    const applyKeywordFilter = useCallback((sourceItems) => {
        const keywordValue = keyword.trim().toLowerCase();
        if (!keywordValue) return sourceItems;
        return sourceItems.filter((item) => {
            const parkingName = (item?.parking_name ?? item?.parkingName ?? "").toLowerCase();
            return parkingName.includes(keywordValue);
        });
    }, [keyword]);

    const applyFeeFilter = useCallback((sourceItems) => {
        if (feeFilter === "all") return sourceItems;
        if (feeFilter === "free") {
            return sourceItems.filter((item) => getFeeInfo(item) === "무료");
        }
        if (feeFilter === "paid") {
            return sourceItems.filter((item) => getFeeInfo(item) === "유료");
        }
        return sourceItems;
    }, [feeFilter]);

    const applySort = useCallback((sourceItems) => {
        const sorted = [...sourceItems];
        if (sort === "base_fee") {
            sorted.sort((a, b) => {
                const aFee = Number(a?.base_fee ?? a?.baseFee);
                const bFee = Number(b?.base_fee ?? b?.baseFee);
                const aValue = Number.isFinite(aFee) ? aFee : Number.MAX_SAFE_INTEGER;
                const bValue = Number.isFinite(bFee) ? bFee : Number.MAX_SAFE_INTEGER;
                return aValue - bValue;
            });
            return sorted;
        }
        sorted.sort((a, b) => {
            const aDistance = Number(a?.distance_km ?? a?.distanceKm);
            const bDistance = Number(b?.distance_km ?? b?.distanceKm);
            const aValue = Number.isFinite(aDistance) ? aDistance : Number.MAX_SAFE_INTEGER;
            const bValue = Number.isFinite(bDistance) ? bDistance : Number.MAX_SAFE_INTEGER;
            return aValue - bValue;
        });
        return sorted;
    }, [sort]);

    const fetchLots = async () => {
        setLoading(true);
        try {
            const radiusKm = parseRadiusKm();
            const limit = parseLimit();
            const response = await api.get("/parking/lots", {
                params: {
                    latitude: center.latitude,
                    longitude: center.longitude,
                    radius_km: radiusKm,
                    limit,
                },
            });
            const payload = response?.data?.data ?? response?.data ?? {};
            const nextItems = payload?.items ?? [];
            const normalized = Array.isArray(nextItems) ? nextItems : [];
            setFetchedItems(normalized);
        } catch (err) {
            setFetchedItems([]);
            setItems([]);
            setTotalCount(0);
            setSelectedLotId(null);
            toast.error(err?.response?.data?.message || "주차장 목록을 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleSearchEnter = (event) => {
        if (event.key !== "Enter" || event.nativeEvent?.isComposing) return;
        event.preventDefault();
        fetchLots();
    };

    const handleRadiusInputChange = (event) => {
        const nextValue = event.target.value;
        if (/^\d*\.?\d*$/.test(nextValue)) {
            setRadiusKmInput(nextValue);
        }
    };

    const handleRadiusInputBlur = () => {
        if (!radiusKmInput.trim()) {
            setRadiusKmInput("3");
            return;
        }
        setRadiusKmInput(String(parseRadiusKm()));
    };

    const handleLimitInputChange = (event) => {
        const nextValue = event.target.value;
        if (/^\d*$/.test(nextValue)) {
            setLimitInput(nextValue);
        }
    };

    const handleLimitInputBlur = () => {
        if (!limitInput.trim()) {
            setLimitInput("50");
            return;
        }
        setLimitInput(String(parseLimit()));
    };

    const handleLocate = () => {
        if (locatingCurrent) return;
        if (!navigator.geolocation) {
            toast.error("브라우저 위치 기능을 사용할 수 없습니다.");
            return;
        }
        setLocatingCurrent(true);
        const tid = toast.loading("현재 위치 확인 중...");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                toast.dismiss(tid);
                const nextCenter = {
                    latitude: Number(position.coords.latitude.toFixed(6)),
                    longitude: Number(position.coords.longitude.toFixed(6)),
                };
                const accuracy = Number(position?.coords?.accuracy);

                // 현재 위치 기반 검색 직후 자동 지도 이동(fitBounds/first pan)을 1회 차단.
                // Prevent one-time auto map move right after current-location update.
                skipFitBoundsOnceRef.current = true;
                skipAutoPanOnceRef.current = true;

                setCenter(nextCenter);
                setPickedCenterMarker(nextCenter.latitude, nextCenter.longitude);
                if (mapRef.current && window.naver?.maps) {
                    mapRef.current.setCenter(new window.naver.maps.LatLng(nextCenter.latitude, nextCenter.longitude));
                    mapRef.current.setZoom(15);
                }

                if (Number.isFinite(accuracy)) {
                    toast.success(`현재 위치로 기준점을 변경했습니다. (정확도 ±${Math.round(accuracy)}m)`);
                } else {
                    toast.success("현재 위치로 기준점을 변경했습니다.");
                }
                setLocatingCurrent(false);
            },
            () => {
                toast.dismiss(tid);
                toast.error("위치 권한이 없어 기본 위치(서울시청)를 사용합니다.");
                setLocatingCurrent(false);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    };

    const handleAddressResolved = ({ address, latitude, longitude }) => {
        const nextCenter = {
            latitude: Number(latitude.toFixed(6)),
            longitude: Number(longitude.toFixed(6)),
        };
        // 주소 기준 검색 직후 자동 지도 이동(fitBounds/first pan)을 1회 차단.
        // Prevent one-time auto move after address-based center update.
        skipFitBoundsOnceRef.current = true;
        skipAutoPanOnceRef.current = true;
        setCenter(nextCenter);
        setPickedCenterMarker(nextCenter.latitude, nextCenter.longitude);
        if (mapRef.current && window.naver?.maps) {
            mapRef.current.setCenter(new window.naver.maps.LatLng(nextCenter.latitude, nextCenter.longitude));
            mapRef.current.setZoom(14);
        }
        toast.success(`"${address}" 기준 위치로 이동했습니다.`);
    };

    const handleImport = async () => {
        setImporting(true);
        try {
            const response = await api.post("/admin/parking/import", null, {
                params: {
                    csvPath: csvPath?.trim() || undefined,
                },
            });
            const data = response?.data?.data ?? {};
            const count = data?.imported_count ?? data?.importedCount ?? 0;
            toast.success(`CSV 재적재 완료 (${count}건)`);
            await fetchLots();
        } catch (err) {
            toast.error(err?.response?.data?.message || "CSV 재적재에 실패했습니다.");
        } finally {
            setImporting(false);
        }
    };

    const renderMarkers = () => {
        if (!mapLoaded || !window.naver?.maps || !mapRef.current) return;

        clearMarkers();
        if (!items.length) return;

        const bounds = new window.naver.maps.LatLngBounds();
        let hasBoundsPoint = false;

        items.slice(0, 200).forEach((item) => {
            const id = getLotId(item);
            const lat = Number(item?.latitude);
            const lng = Number(item?.longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

            const position = new window.naver.maps.LatLng(lat, lng);
            const marker = new window.naver.maps.Marker({
                position,
                map: mapRef.current,
                title: item?.parking_name ?? item?.parkingName ?? "주차장",
                icon: {
                    content: '<div style="width:14px;height:14px;border-radius:9999px;background:#2563eb;border:2px solid #fff;box-shadow:0 2px 8px rgba(37,99,235,0.45)"></div>',
                    anchor: new window.naver.maps.Point(7, 7),
                },
            });

            const infoWindow = new window.naver.maps.InfoWindow({
                content: `
                    <button type="button" onclick="window.__parkingFinderOpenLotDetail && window.__parkingFinderOpenLotDetail('${id}')" style="padding:10px;min-width:200px;border:0;background:#fff;text-align:left;cursor:pointer;font-family:Arial,sans-serif;">
                      <div style="font-weight:800;font-size:13px;color:#0f172a;">${item?.parking_name ?? item?.parkingName ?? "주차장"}</div>
                      <div style="font-size:11px;color:#64748b;margin-top:4px;">${item?.road_address ?? item?.roadAddress ?? item?.lot_address ?? item?.lotAddress ?? "주소 없음"}</div>
                      <div style="font-size:10px;color:#2563eb;margin-top:6px;font-weight:700;">터치해서 상세 보기</div>
                    </button>
                `,
            });

            window.naver.maps.Event.addListener(marker, "click", () => {
                setSelectedLotId(id);
                infoWindow.open(mapRef.current, marker);
            });

            markersRef.current.push({ id, marker, infoWindow, item });
            bounds.extend(position);
            hasBoundsPoint = true;
        });

        if (hasBoundsPoint) {
            if (skipFitBoundsOnceRef.current) {
                skipFitBoundsOnceRef.current = false;
                return;
            }
            mapRef.current.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
        }
    };

    useEffect(() => {
        fetchLots();
        // 위치 변경 시에만 원본 데이터를 재조회한다.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [center.latitude, center.longitude]);

    useEffect(() => {
        const feeFiltered = applyFeeFilter(fetchedItems);
        const sorted = applySort(feeFiltered);
        const keywordFiltered = applyKeywordFilter(sorted);
        setItems(keywordFiltered);
        setTotalCount(keywordFiltered.length);
        setSelectedLotId((prevSelectedLotId) => {
            if (prevSelectedLotId == null) {
                return keywordFiltered.length ? getLotId(keywordFiltered[0]) : null;
            }
            const exists = keywordFiltered.some((item) => String(getLotId(item)) === String(prevSelectedLotId));
            if (exists) return prevSelectedLotId;
            return keywordFiltered.length ? getLotId(keywordFiltered[0]) : null;
        });
    }, [applyFeeFilter, applyKeywordFilter, applySort, fetchedItems]);

    useEffect(() => {
        if (!mapLoaded || mapRef.current || !mapContainerRef.current || !window.naver?.maps) return;
        mapRef.current = new window.naver.maps.Map(mapContainerRef.current, {
            center: new window.naver.maps.LatLng(center.latitude, center.longitude),
            zoom: 13,
            zoomControl: true,
            mapTypeControl: true,
        });
    }, [mapLoaded, center.latitude, center.longitude]);

    useEffect(() => {
        if (!mapLoaded || !mapRef.current || !window.naver?.maps?.Event) return;

        clearInteractionListeners();

        const rightClickListener = window.naver.maps.Event.addListener(mapRef.current, "rightclick", (event) => {
            applyPickedCenter(event?.coord, "우클릭");
        });
        interactionListenersRef.current.push(rightClickListener);

        const clickListener = window.naver.maps.Event.addListener(mapRef.current, "click", () => {
            closeAllInfoWindows();
        });
        interactionListenersRef.current.push(clickListener);

        const longTapListener = window.naver.maps.Event.addListener(mapRef.current, "longtap", (event) => {
            applyPickedCenter(event?.coord, "길게 누르기");
        });
        interactionListenersRef.current.push(longTapListener);

        return () => {
            clearInteractionListeners();
        };
    }, [applyPickedCenter, closeAllInfoWindows, clearInteractionListeners, mapLoaded]);

    useEffect(() => {
        if (!mapLoaded || !mapRef.current || !mapContainerRef.current) return;
        const container = mapContainerRef.current;

        const clearLongPressTimer = () => {
            if (longPressStateRef.current.timerId) {
                clearTimeout(longPressStateRef.current.timerId);
            }
            longPressStateRef.current.timerId = null;
        };

        const onTouchStart = (event) => {
            if (!event.touches || event.touches.length !== 1) {
                clearLongPressTimer();
                return;
            }
            const touch = event.touches[0];
            longPressStateRef.current.startX = touch.clientX;
            longPressStateRef.current.startY = touch.clientY;
            longPressStateRef.current.moved = false;
            clearLongPressTimer();
            longPressStateRef.current.timerId = setTimeout(() => {
                if (!longPressStateRef.current.moved) {
                    pickCenterByClientPoint(touch.clientX, touch.clientY, "길게 누르기");
                }
                longPressStateRef.current.timerId = null;
            }, 650);
        };

        const onTouchMove = (event) => {
            if (!longPressStateRef.current.timerId || !event.touches || event.touches.length !== 1) return;
            const touch = event.touches[0];
            const dx = touch.clientX - longPressStateRef.current.startX;
            const dy = touch.clientY - longPressStateRef.current.startY;
            if (Math.hypot(dx, dy) > 12) {
                longPressStateRef.current.moved = true;
                clearLongPressTimer();
            }
        };

        const onTouchEnd = () => clearLongPressTimer();
        const onTouchCancel = () => clearLongPressTimer();

        container.addEventListener("touchstart", onTouchStart, { passive: true });
        container.addEventListener("touchmove", onTouchMove, { passive: true });
        container.addEventListener("touchend", onTouchEnd, { passive: true });
        container.addEventListener("touchcancel", onTouchCancel, { passive: true });

        return () => {
            clearLongPressTimer();
            container.removeEventListener("touchstart", onTouchStart);
            container.removeEventListener("touchmove", onTouchMove);
            container.removeEventListener("touchend", onTouchEnd);
            container.removeEventListener("touchcancel", onTouchCancel);
        };
    }, [mapLoaded, pickCenterByClientPoint]);

    useEffect(() => {
        renderMarkers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items, mapLoaded]);

    useEffect(() => {
        if (!selectedLotId || !mapRef.current || !window.naver?.maps) return;

        if (skipAutoPanOnceRef.current) {
            skipAutoPanOnceRef.current = false;
            return;
        }

        const selected = markersRef.current.find((entry) => String(entry.id) === String(selectedLotId));
        if (!selected) return;

        const lat = Number(selected.item?.latitude);
        const lng = Number(selected.item?.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const pos = new window.naver.maps.LatLng(lat, lng);
        mapRef.current.panTo(pos);

        if (selectedMarkerRef.current) {
            selectedMarkerRef.current.setMap(null);
        }

        selectedMarkerRef.current = new window.naver.maps.Marker({
            position: pos,
            map: mapRef.current,
            icon: {
                content: '<div style="width:18px;height:18px;border-radius:9999px;background:#f97316;border:3px solid #fff;box-shadow:0 2px 10px rgba(249,115,22,0.55)"></div>',
                anchor: new window.naver.maps.Point(9, 9),
            },
            zIndex: 200,
        });
    }, [selectedLotId]);

    const summary = useMemo(() => {
        const paidCount = items.filter((it) => (it?.fee_info ?? it?.feeInfo) === "유료").length;
        return { paidCount, freeCount: Math.max(0, items.length - paidCount) };
    }, [items]);
    const selectedItem = useMemo(
        () => items.find((item) => String(getLotId(item)) === String(selectedLotId)) ?? null,
        [items, selectedLotId]
    );

    useEffect(() => {
        if (!selectedItem && mobileDetailOpen) {
            setMobileDetailOpen(false);
        }
    }, [mobileDetailOpen, selectedItem]);

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            <div className="rounded-[2rem] bg-gradient-to-br from-slate-900 via-slate-800 to-primary-700 p-7 text-white shadow-2xl">
                <div className="flex items-center gap-4">
                    <div className="rounded-2xl bg-white/15 p-3">
                        <Car className="h-7 w-7" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight">주차장 요금비교</h1>
                        <p className="text-sm font-semibold text-slate-200">
                            현재 위치 반경 검색, 요금비교, 지도 마커 연동을 제공합니다. [우클릭 또는 길게 터치하여 위치를 선택하세요]
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="lg:col-span-4 space-y-4">
                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-black text-slate-900">검색 조건</h2>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleLocate}
                                    disabled={locatingCurrent}
                                    className="rounded-xl bg-primary-50 p-2 text-primary-600 hover:bg-primary-100 disabled:opacity-60"
                                    title="현재 위치"
                                >
                                    <LocateFixed className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleLocate}
                                    disabled={locatingCurrent}
                                    className="rounded-xl border border-primary-200 bg-white px-2.5 py-1.5 text-xs font-black text-primary-700 hover:bg-primary-50 disabled:opacity-60"
                                >
                                    {locatingCurrent ? "재시도 중..." : "현재 위치 재시도"}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <AddressSearchBox
                                onResolved={handleAddressResolved}
                                placeholder="예: 서울시청, 강남역, 판교역"
                                primaryButtonLabel="주소찾기"
                                secondaryButtonLabel="조회"
                                primaryAction="postcode"
                                secondaryAction="resolve"
                            />
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                                <input
                                    value={keyword}
                                    onChange={(e) => setKeyword(e.target.value)}
                                    onKeyDown={handleSearchEnter}
                                    placeholder="주차장명"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-400">반경(km)</label>
                                    <input type="text" inputMode="decimal" value={radiusKmInput} onChange={handleRadiusInputChange} onBlur={handleRadiusInputBlur} onKeyDown={handleSearchEnter} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-400">최대개수</label>
                                    <input type="text" inputMode="numeric" value={limitInput} onChange={handleLimitInputChange} onBlur={handleLimitInputBlur} onKeyDown={handleSearchEnter} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-400">정렬</label>
                                <select value={sort} onChange={(e) => setSort(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
                                    <option value="distance">거리순</option>
                                    <option value="base_fee">기본요금순</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-400">요금구분</label>
                                <select value={feeFilter} onChange={(e) => setFeeFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
                                    <option value="all">모두</option>
                                    <option value="free">무료</option>
                                    <option value="paid">유료</option>
                                </select>
                            </div>

                        </div>
                    </div>

                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                        <div className="text-xs font-black uppercase tracking-wider text-slate-400">검색 요약</div>
                        <div className="mt-2 text-sm font-bold text-slate-800">총 {totalCount}건 / 유료 {summary.paidCount}건 / 무료 {summary.freeCount}건</div>
                        <div className="mt-3 text-xs font-semibold text-slate-500">기준 좌표: {center.latitude}, {center.longitude}</div>
                    </div>

                    {adminMode && (
                        <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
                            <div className="mb-3 flex items-center gap-2 text-amber-800">
                                <DatabaseZap className="h-4 w-4" />
                                <span className="text-sm font-black">관리자 CSV 재적재</span>
                            </div>
                            <input
                                value={csvPath}
                                onChange={(e) => setCsvPath(e.target.value)}
                                className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                                placeholder="CSV 경로"
                            />
                            <button
                                onClick={handleImport}
                                disabled={importing}
                                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-2.5 text-xs font-black text-white disabled:opacity-60"
                            >
                                {importing ? <LoadingSpinner size="sm" text="" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                CSV 다시 적재
                            </button>
                        </div>
                    )}
                </div>

                <div className="lg:col-span-8 space-y-4">
                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-lg font-black text-slate-900">네이버 지도</h2>
                            <div className="flex items-center gap-2">
                                <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-black text-primary-700">결과 {totalCount}건</span>
                                <button
                                    type="button"
                                    onClick={fetchLots}
                                    disabled={loading}
                                    className="flex items-center gap-1 rounded-xl bg-primary-600 px-3 py-1.5 text-xs font-black text-white disabled:opacity-60"
                                >
                                    {loading ? <LoadingSpinner size="sm" text="" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                    검색하기
                                </button>
                            </div>
                        </div>
                        <div className="mb-3 text-xs font-semibold text-slate-500">
                            PC는 우클릭, 모바일은 길게 눌러 기준 위치를 직접 선택할 수 있습니다.
                        </div>
                        <div className="relative h-[360px] overflow-hidden rounded-2xl bg-slate-100">
                            <div ref={mapContainerRef} className="h-full w-full" onContextMenu={(event) => event.preventDefault()} />
                            {!mapLoaded && !mapError && (
                                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 text-white">
                                    <LoadingSpinner text="지도를 준비하는 중..." />
                                </div>
                            )}
                            {mapError && (
                                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/70 text-sm font-bold text-white">
                                    지도 SDK 로드 실패
                                </div>
                            )}
                        </div>
                    </div>

                    {selectedItem && (
                        <div className="hidden rounded-3xl border border-primary-100 bg-gradient-to-br from-primary-50/50 to-white p-5 shadow-sm lg:block">
                            <div className="mb-3 flex items-center justify-between">
                                <h2 className="text-lg font-black text-slate-900">선택 주차장 상세</h2>
                                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-primary-700">ID {getLotId(selectedItem)}</span>
                            </div>
                            <div className="mb-3">
                                <div className="text-base font-black text-slate-900">{selectedItem?.parking_name ?? selectedItem?.parkingName ?? "-"}</div>
                                <div className="mt-1 text-sm text-slate-600">
                                    {selectedItem?.road_address ?? selectedItem?.roadAddress ?? selectedItem?.lot_address ?? selectedItem?.lotAddress ?? "-"}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                                <div className="rounded-xl bg-white p-3">
                                    <div className="text-xs font-black text-slate-400">요금정책</div>
                                    <div className="mt-1 font-bold text-slate-800">
                                        {(selectedItem?.fee_info ?? selectedItem?.feeInfo ?? "-")} / 기본 {(selectedItem?.base_fee ?? selectedItem?.baseFee ?? 0).toLocaleString("ko-KR")}원
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        기본 {selectedItem?.base_time_minutes ?? selectedItem?.baseTimeMinutes ?? 0}분, 추가 {(selectedItem?.extra_time_minutes ?? selectedItem?.extraTimeMinutes ?? 0)}분/{(selectedItem?.extra_fee ?? selectedItem?.extraFee ?? 0).toLocaleString("ko-KR")}원
                                    </div>
                                </div>
                                <div className="rounded-xl bg-white p-3">
                                    <div className="text-xs font-black text-slate-400">운영시간</div>
                                    <div className="mt-1 text-slate-800">평일 {selectedItem?.weekday_start ?? selectedItem?.weekdayStart ?? "-"} ~ {selectedItem?.weekday_end ?? selectedItem?.weekdayEnd ?? "-"}</div>
                                    <div className="text-slate-800">토요일 {selectedItem?.saturday_start ?? selectedItem?.saturdayStart ?? "-"} ~ {selectedItem?.saturday_end ?? selectedItem?.saturdayEnd ?? "-"}</div>
                                    <div className="text-slate-800">공휴일 {selectedItem?.holiday_start ?? selectedItem?.holidayStart ?? "-"} ~ {selectedItem?.holiday_end ?? selectedItem?.holidayEnd ?? "-"}</div>
                                </div>
                                <div className="rounded-xl bg-white p-3">
                                    <div className="text-xs font-black text-slate-400">결제/연락</div>
                                    <div className="mt-1 text-slate-800">결제: {selectedItem?.payment_method ?? selectedItem?.paymentMethod ?? "-"}</div>
                                    <div className="text-slate-800">전화: {selectedItem?.phone_number ?? selectedItem?.phoneNumber ?? "-"}</div>
                                </div>
                                <div className="rounded-xl bg-white p-3">
                                    <div className="text-xs font-black text-slate-400">부가 정보</div>
                                    <div className="mt-1 text-slate-800">주차면수: {(selectedItem?.parking_spaces ?? selectedItem?.parkingSpaces ?? "-")}</div>
                                    <div className="text-slate-800">장애인구역: {selectedItem?.accessible_yn ?? selectedItem?.accessibleYn ?? "-"}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        {loading ? (
                            <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center">
                                <LoadingSpinner text="주차장 데이터를 불러오는 중..." />
                            </div>
                        ) : items.length === 0 ? (
                            <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center text-sm font-bold text-slate-400">
                                검색 결과가 없습니다.
                            </div>
                        ) : (
                            items.map((item) => {
                                const id = getLotId(item);
                                const selected = String(id) === String(selectedLotId);
                                const name = item?.parking_name ?? item?.parkingName;
                                const roadAddress = item?.road_address ?? item?.roadAddress;
                                const lotAddress = item?.lot_address ?? item?.lotAddress;
                                const feeInfo = item?.fee_info ?? item?.feeInfo;
                                const distanceKm = Number(item?.distance_km ?? item?.distanceKm ?? 0);
                                const estimate60m = getEstimate60mFee(item);
                                const weekdayStart = item?.weekday_start ?? item?.weekdayStart;
                                const weekdayEnd = item?.weekday_end ?? item?.weekdayEnd;
                                const phone = item?.phone_number ?? item?.phoneNumber;

                                return (
                                    <button
                                        key={id}
                                        onClick={() => handleSelectLotFromList(id)}
                                        className={`w-full rounded-3xl border p-5 text-left shadow-sm transition-all ${selected ? "border-primary-300 bg-primary-50/30" : "border-slate-100 bg-white hover:border-primary-100"}`}
                                    >
                                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                            <div>
                                                <h3 className="text-base font-black text-slate-900">{name}</h3>
                                                <p className="mt-1 text-sm text-slate-500">{roadAddress || lotAddress || "-"}</p>
                                                <p className="mt-1 text-xs font-semibold text-slate-400">{phone || "전화번호 없음"}</p>
                                            </div>
                                            <div className="flex flex-wrap gap-2 text-xs font-black">
                                                <span className="rounded-xl bg-sky-50 px-2.5 py-1 text-sky-700">거리 {distanceKm.toFixed(2)}km</span>
                                                <span className={`rounded-xl px-2.5 py-1 ${feeInfo === "유료" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{feeInfo || "요금정보없음"}</span>
                                            </div>
                                        </div>

                                        <div className="mt-4 grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
                                            <div className="rounded-xl bg-slate-50 p-3">
                                                <div className="flex items-center gap-1 text-xs font-black text-slate-400"><CreditCard className="h-3.5 w-3.5" /> 1시간 예상요금</div>
                                                <div className="mt-1 text-base font-black text-slate-800">{estimate60m === null ? "계산불가" : `${estimate60m.toLocaleString("ko-KR")}원`}</div>
                                            </div>
                                            <div className="rounded-xl bg-slate-50 p-3">
                                                <div className="flex items-center gap-1 text-xs font-black text-slate-400"><Clock3 className="h-3.5 w-3.5" /> 평일 운영시간</div>
                                                <div className="mt-1 text-base font-black text-slate-800">{weekdayStart && weekdayEnd ? `${weekdayStart} ~ ${weekdayEnd}` : "-"}</div>
                                            </div>
                                            <div className="rounded-xl bg-slate-50 p-3">
                                                <div className="text-xs font-black text-slate-400">기본요금 / 기본시간</div>
                                                <div className="mt-1 text-base font-black text-slate-800">{(item?.base_fee ?? item?.baseFee ?? 0).toLocaleString("ko-KR")}원 / {item?.base_time_minutes ?? item?.baseTimeMinutes ?? 0}분</div>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {mobileDetailOpen && selectedItem && (
                <div className="fixed inset-0 z-[9999] bg-slate-900/55 p-3 lg:hidden">
                    <div className="h-full w-full overflow-auto rounded-3xl bg-white p-5 shadow-2xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-black text-slate-900">주차장 상세</h2>
                            <button
                                type="button"
                                className="rounded-xl bg-slate-100 p-2 text-slate-600"
                                onClick={() => setMobileDetailOpen(false)}
                                aria-label="상세 닫기"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="mb-3 text-base font-black text-slate-900">{selectedItem?.parking_name ?? selectedItem?.parkingName ?? "-"}</div>
                        <div className="mb-4 text-sm text-slate-600">
                            {selectedItem?.road_address ?? selectedItem?.roadAddress ?? selectedItem?.lot_address ?? selectedItem?.lotAddress ?? "-"}
                        </div>
                        <div className="space-y-2 text-sm">
                            <div className="rounded-xl bg-slate-50 p-3">
                                <div className="text-xs font-black text-slate-400">요금</div>
                                <div className="mt-1 font-bold text-slate-800">
                                    {(selectedItem?.fee_info ?? selectedItem?.feeInfo ?? "-")} / 기본 {(selectedItem?.base_fee ?? selectedItem?.baseFee ?? 0).toLocaleString("ko-KR")}원
                                </div>
                                <div className="text-slate-600">
                                    기본 {selectedItem?.base_time_minutes ?? selectedItem?.baseTimeMinutes ?? 0}분, 추가 {selectedItem?.extra_time_minutes ?? selectedItem?.extraTimeMinutes ?? 0}분/{(selectedItem?.extra_fee ?? selectedItem?.extraFee ?? 0).toLocaleString("ko-KR")}원
                                </div>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-3">
                                <div className="text-xs font-black text-slate-400">운영시간</div>
                                <div className="text-slate-700">평일 {selectedItem?.weekday_start ?? selectedItem?.weekdayStart ?? "-"} ~ {selectedItem?.weekday_end ?? selectedItem?.weekdayEnd ?? "-"}</div>
                                <div className="text-slate-700">토요일 {selectedItem?.saturday_start ?? selectedItem?.saturdayStart ?? "-"} ~ {selectedItem?.saturday_end ?? selectedItem?.saturdayEnd ?? "-"}</div>
                                <div className="text-slate-700">공휴일 {selectedItem?.holiday_start ?? selectedItem?.holidayStart ?? "-"} ~ {selectedItem?.holiday_end ?? selectedItem?.holidayEnd ?? "-"}</div>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-3">
                                <div className="text-xs font-black text-slate-400">결제/연락</div>
                                <div className="text-slate-700">결제: {selectedItem?.payment_method ?? selectedItem?.paymentMethod ?? "-"}</div>
                                <div className="text-slate-700">전화: {selectedItem?.phone_number ?? selectedItem?.phoneNumber ?? "-"}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
