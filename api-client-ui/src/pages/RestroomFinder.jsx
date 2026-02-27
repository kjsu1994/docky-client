import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bath, LocateFixed, RefreshCw, Search, DatabaseZap, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "../utils/api";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { AddressSearchBox } from "../common/AddressSearchBox";
import { useAuth } from "../contexts/AuthContext";
import { isAdminUser } from "../utils/authorization";

const INITIAL_CENTER = { latitude: 37.5665, longitude: 126.9780 };
const toNumber = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const getLotId = (item) => item?.restroom_lot_id ?? item?.restroomLotId ?? item?.management_no ?? item?.managementNo;
const ynLabel = (v) => {
    const normalized = String(v ?? "").toUpperCase();
    if (normalized === "Y") return "있음";
    if (normalized === "N") return "없음";
    return "-";
};

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

export const RestroomFinder = () => {
    const { user } = useAuth();
    const adminMode = isAdminUser(user);
    const { isLoaded: mapLoaded, error: mapError } = useNaverMaps();

    const [center, setCenter] = useState(INITIAL_CENTER);
    const [keyword, setKeyword] = useState("");
    const [radiusKmInput, setRadiusKmInput] = useState("3");
    const [limitInput, setLimitInput] = useState("50");
    const [openType, setOpenType] = useState("all");
    const [sort, setSort] = useState("distance");

    const [loading, setLoading] = useState(false);
    const [locatingCurrent, setLocatingCurrent] = useState(false);
    const [fetchedItems, setFetchedItems] = useState([]);
    const [items, setItems] = useState([]);
    const [selectedLotId, setSelectedLotId] = useState(null);
    const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

    const [csvPath, setCsvPath] = useState("/data/csv_data/Restroom_Dataset.csv");
    const [importing, setImporting] = useState(false);

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

    useEffect(() => {
        window.__restroomFinderOpenLotDetail = (lotId) => {
            setSelectedLotId(lotId);
            setMobileDetailOpen(true);
        };
        return () => {
            delete window.__restroomFinderOpenLotDetail;
        };
    }, []);

    const clearMarkers = useCallback(() => {
        markersRef.current.forEach((entry) => {
            if (entry?.infoWindow) entry.infoWindow.close();
            if (entry?.marker) entry.marker.setMap(null);
        });
        markersRef.current = [];
        if (selectedMarkerRef.current) {
            selectedMarkerRef.current.setMap(null);
            selectedMarkerRef.current = null;
        }
    }, []);

    const closeAllInfoWindows = useCallback(() => {
        markersRef.current.forEach((entry) => {
            if (entry?.infoWindow) entry.infoWindow.close();
        });
    }, []);

    const clearInteractionListeners = useCallback(() => {
        interactionListenersRef.current.forEach((listener) => {
            // 지도 이벤트 핸들러 + 커스텀 remove 핸들러를 함께 안전하게 해제한다.
            // Mixed listener cleanup for naver Event handles and custom DOM handlers.
            if (listener && typeof listener.remove === "function") {
                listener.remove();
                return;
            }
            if (window.naver?.maps?.Event) {
                window.naver.maps.Event.removeListener(listener);
            }
        });
        interactionListenersRef.current = [];
    }, []);

    const normalizeCoord = useCallback((coord) => {
        if (!coord) return null;
        if (typeof coord.lat === "function" && typeof coord.lng === "function") {
            return { latitude: Number(coord.lat().toFixed(6)), longitude: Number(coord.lng().toFixed(6)) };
        }
        if (Number.isFinite(coord?.y) && Number.isFinite(coord?.x)) {
            return { latitude: Number(coord.y.toFixed(6)), longitude: Number(coord.x.toFixed(6)) };
        }
        if (Number.isFinite(coord?.lat) && Number.isFinite(coord?.lng)) {
            return { latitude: Number(coord.lat.toFixed(6)), longitude: Number(coord.lng.toFixed(6)) };
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
        if (now - recent.ts < 700 && recent.latitude === point.latitude && recent.longitude === point.longitude) {
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

    const parseRadius = useCallback(() => {
        const n = Number(radiusKmInput);
        if (!Number.isFinite(n)) return 3;
        return Math.max(0, Math.min(30, n));
    }, [radiusKmInput]);

    const parseLimit = useCallback(() => {
        const n = Number(limitInput);
        if (!Number.isFinite(n)) return 50;
        return Math.max(1, Math.min(200, Math.trunc(n)));
    }, [limitInput]);

    const fetchLots = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get("/restrooms/lots", {
                params: {
                    latitude: center.latitude,
                    longitude: center.longitude,
                    radius_km: parseRadius(),
                    open_type: openType,
                    sort,
                    limit: parseLimit(),
                },
            });
            const rows = res?.data?.data?.items ?? [];
            setFetchedItems(Array.isArray(rows) ? rows : []);
        } catch (err) {
            toast.error(err?.response?.data?.message || "화장실 목록을 불러오지 못했습니다.");
            setFetchedItems([]);
        } finally {
            setLoading(false);
        }
    }, [center.latitude, center.longitude, openType, parseLimit, parseRadius, sort]);

    useEffect(() => {
        fetchLots();
    }, [fetchLots]);

    useEffect(() => {
        const kw = keyword.trim().toLowerCase();
        let next = [...fetchedItems];
        if (kw) {
            next = next.filter((i) => (i?.restroom_name ?? i?.restroomName ?? "").toLowerCase().includes(kw));
        }
        if (sort === "toilet_count") {
            next.sort((a, b) => {
                const aTotal = toNumber(a?.male_toilet_count ?? a?.maleToiletCount) + toNumber(a?.female_toilet_count ?? a?.femaleToiletCount);
                const bTotal = toNumber(b?.male_toilet_count ?? b?.maleToiletCount) + toNumber(b?.female_toilet_count ?? b?.femaleToiletCount);
                return bTotal - aTotal;
            });
        } else {
            next.sort((a, b) => toNumber(a?.distance_km ?? a?.distanceKm) - toNumber(b?.distance_km ?? b?.distanceKm));
        }
        setItems(next);
        setSelectedLotId((prev) => {
            if (prev == null) return next.length ? getLotId(next[0]) : null;
            return next.some((i) => String(getLotId(i)) === String(prev)) ? prev : (next.length ? getLotId(next[0]) : null);
        });
    }, [fetchedItems, keyword, sort]);

    useEffect(() => {
        if (!mapLoaded || mapError || !mapContainerRef.current || !window.naver?.maps) return;
        if (mapRef.current) return;

        mapRef.current = new window.naver.maps.Map(mapContainerRef.current, {
            center: new window.naver.maps.LatLng(center.latitude, center.longitude),
            zoom: 14,
        });
        setPickedCenterMarker(center.latitude, center.longitude);

        clearInteractionListeners();
        const eventApi = window.naver.maps.Event;

        const rightClickListener = eventApi.addListener(mapRef.current, "rightclick", (event) => {
            applyPickedCenter(event?.coord || event?.overlay?.position, "우클릭");
        });
        interactionListenersRef.current.push(rightClickListener);

        const container = mapContainerRef.current;
        if (container) {
            const clearTimer = () => {
                if (longPressStateRef.current.timerId) {
                    window.clearTimeout(longPressStateRef.current.timerId);
                    longPressStateRef.current.timerId = null;
                }
            };

            const onTouchStart = (event) => {
                const touch = event.touches?.[0];
                if (!touch) return;
                clearTimer();
                longPressStateRef.current.startX = touch.clientX;
                longPressStateRef.current.startY = touch.clientY;
                longPressStateRef.current.moved = false;
                longPressStateRef.current.timerId = window.setTimeout(() => {
                    if (!longPressStateRef.current.moved) {
                        pickCenterByClientPoint(touch.clientX, touch.clientY, "롱프레스");
                    }
                    clearTimer();
                }, 650);
            };

            const onTouchMove = (event) => {
                const touch = event.touches?.[0];
                if (!touch) return;
                const dx = Math.abs(touch.clientX - longPressStateRef.current.startX);
                const dy = Math.abs(touch.clientY - longPressStateRef.current.startY);
                if (dx > 10 || dy > 10) {
                    longPressStateRef.current.moved = true;
                    clearTimer();
                }
            };

            const onTouchEnd = () => clearTimer();
            const onTouchCancel = () => clearTimer();

            container.addEventListener("touchstart", onTouchStart, { passive: true });
            container.addEventListener("touchmove", onTouchMove, { passive: true });
            container.addEventListener("touchend", onTouchEnd);
            container.addEventListener("touchcancel", onTouchCancel);

            interactionListenersRef.current.push({
                remove: () => {
                    container.removeEventListener("touchstart", onTouchStart);
                    container.removeEventListener("touchmove", onTouchMove);
                    container.removeEventListener("touchend", onTouchEnd);
                    container.removeEventListener("touchcancel", onTouchCancel);
                },
            });
        }
    }, [applyPickedCenter, center.latitude, center.longitude, clearInteractionListeners, mapError, mapLoaded, pickCenterByClientPoint, setPickedCenterMarker]);

    useEffect(() => {
        if (!mapRef.current || !window.naver?.maps) return;
        clearMarkers();
        closeAllInfoWindows();

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
                title: item?.restroom_name ?? item?.restroomName ?? "화장실",
                icon: {
                    content: '<div style="width:14px;height:14px;border-radius:9999px;background:#0891b2;border:2px solid #fff;box-shadow:0 2px 8px rgba(8,145,178,0.45)"></div>',
                    anchor: new window.naver.maps.Point(7, 7),
                },
            });

            const infoWindow = new window.naver.maps.InfoWindow({
                content: `
                    <button type="button" onclick="window.__restroomFinderOpenLotDetail && window.__restroomFinderOpenLotDetail('${id}')" style="padding:10px;min-width:210px;border:0;background:#fff;text-align:left;cursor:pointer;font-family:Arial,sans-serif;">
                      <div style="font-weight:800;font-size:13px;color:#0f172a;">${item?.restroom_name ?? item?.restroomName ?? "화장실"}</div>
                      <div style="font-size:11px;color:#64748b;margin-top:4px;">${item?.road_address ?? item?.roadAddress ?? item?.lot_address ?? item?.lotAddress ?? "주소 없음"}</div>
                      <div style="font-size:10px;color:#0891b2;margin-top:6px;font-weight:700;">터치해서 상세 보기</div>
                    </button>
                `,
            });

            window.naver.maps.Event.addListener(marker, "click", () => {
                setSelectedLotId(id);
                infoWindow.open(mapRef.current, marker);
            });

            markersRef.current.push({ marker, infoWindow });
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
    }, [items, clearMarkers, closeAllInfoWindows]);

    const selectedItem = useMemo(() => {
        if (!items.length) return null;
        return items.find((i) => String(getLotId(i)) === String(selectedLotId)) ?? items[0];
    }, [items, selectedLotId]);

    useEffect(() => {
        if (!selectedItem || !mapRef.current || !window.naver?.maps) return;
        const lat = Number(selectedItem?.latitude);
        const lng = Number(selectedItem?.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        if (selectedMarkerRef.current) selectedMarkerRef.current.setMap(null);
        selectedMarkerRef.current = new window.naver.maps.Marker({
            position: new window.naver.maps.LatLng(lat, lng),
            map: mapRef.current,
            icon: {
                content: '<div style="width:20px;height:20px;border-radius:9999px;background:#f97316;border:3px solid #fff;box-shadow:0 2px 12px rgba(249,115,22,0.55)"></div>',
                anchor: new window.naver.maps.Point(10, 10),
            },
            zIndex: 220,
        });

        if (skipAutoPanOnceRef.current) {
            skipAutoPanOnceRef.current = false;
            return;
        }
        mapRef.current.panTo(new window.naver.maps.LatLng(lat, lng));
    }, [selectedItem]);

    useEffect(() => {
        return () => {
            clearMarkers();
            clearInteractionListeners();
            if (pickedCenterMarkerRef.current) pickedCenterMarkerRef.current.setMap(null);
        };
    }, [clearInteractionListeners, clearMarkers]);

    const handleLocate = () => {
        if (locatingCurrent) return;
        if (!navigator.geolocation) return toast.error("브라우저 위치 기능을 사용할 수 없습니다.");
        setLocatingCurrent(true);
        const tid = toast.loading("현재 위치 확인 중...");
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                toast.dismiss(tid);
                const next = { latitude: Number(pos.coords.latitude.toFixed(6)), longitude: Number(pos.coords.longitude.toFixed(6)) };
                skipFitBoundsOnceRef.current = true;
                skipAutoPanOnceRef.current = true;
                setCenter(next);
                setPickedCenterMarker(next.latitude, next.longitude);
                if (mapRef.current && window.naver?.maps) {
                    mapRef.current.setCenter(new window.naver.maps.LatLng(next.latitude, next.longitude));
                    mapRef.current.setZoom(15);
                }
                toast.success("현재 위치로 기준점을 변경했습니다.");
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
        const next = { latitude: Number(latitude.toFixed(6)), longitude: Number(longitude.toFixed(6)) };
        skipFitBoundsOnceRef.current = true;
        skipAutoPanOnceRef.current = true;
        setCenter(next);
        setPickedCenterMarker(next.latitude, next.longitude);
        if (mapRef.current && window.naver?.maps) {
            mapRef.current.setCenter(new window.naver.maps.LatLng(next.latitude, next.longitude));
            mapRef.current.setZoom(14);
        }
        toast.success(`"${address}" 기준 위치로 이동했습니다.`);
    };

    const handleImport = async () => {
        setImporting(true);
        try {
            const res = await api.post("/admin/restroom/import", null, { params: { csvPath: csvPath?.trim() || undefined } });
            const count = res?.data?.data?.imported_count ?? res?.data?.data?.importedCount ?? 0;
            toast.success(`CSV 재적재 완료 (${count}건)`);
            await fetchLots();
        } catch (err) {
            toast.error(err?.response?.data?.message || "CSV 재적재에 실패했습니다.");
        } finally {
            setImporting(false);
        }
    };

    const summary = useMemo(() => {
        const publicCount = items.filter((i) => (i?.restroom_type ?? i?.restroomType) === "공중화장실").length;
        const openCount = items.filter((i) => (i?.restroom_type ?? i?.restroomType) === "개방화장실").length;
        return { publicCount, openCount };
    }, [items]);

    return (
        <div className="space-y-6">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-700"><Bath className="h-6 w-6" /></div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900">화장실 찾기</h1>
                        <p className="text-sm text-slate-500">지도 기능을 주차장 찾기와 동일하게 제공합니다.</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <div className="lg:col-span-4 space-y-4">
                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm space-y-3">
                        <AddressSearchBox onResolved={handleAddressResolved} placeholder="주소를 검색해 기준 위치 설정" compact />
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={handleLocate} disabled={locatingCurrent} className="flex items-center justify-center gap-1 rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-black text-slate-700 disabled:opacity-60"><LocateFixed className="h-3.5 w-3.5" />내 위치</button>
                            <button onClick={fetchLots} disabled={loading} className="flex items-center justify-center gap-1 rounded-xl bg-primary-600 px-3 py-2.5 text-xs font-black text-white disabled:opacity-60">{loading ? <LoadingSpinner size="sm" text="" /> : <Search className="h-3.5 w-3.5" />}검색</button>
                        </div>
                        <input value={keyword} onChange={(e) => setKeyword(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" placeholder="키워드(화장실명)" />
                        <div className="grid grid-cols-2 gap-2">
                            <input value={radiusKmInput} onChange={(e) => setRadiusKmInput(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" placeholder="반경(km)" />
                            <input value={limitInput} onChange={(e) => setLimitInput(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" placeholder="최대개수" />
                        </div>
                        <select value={openType} onChange={(e) => setOpenType(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
                            <option value="all">개방구분: 전체</option>
                            <option value="public">개방구분: 공중화장실</option>
                            <option value="open">개방구분: 개방화장실</option>
                        </select>
                        <select value={sort} onChange={(e) => setSort(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
                            <option value="distance">거리순</option>
                            <option value="toilet_count">변기수(남+여)순</option>
                        </select>
                    </div>

                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm text-sm font-bold text-slate-800">총 {items.length}건 / 공중 {summary.publicCount}건 / 개방 {summary.openCount}건</div>

                    {adminMode && (
                        <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
                            <div className="mb-3 flex items-center gap-2 text-amber-800"><DatabaseZap className="h-4 w-4" /><span className="text-sm font-black">관리자 CSV 재적재</span></div>
                            <input value={csvPath} onChange={(e) => setCsvPath(e.target.value)} className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700" placeholder="CSV 경로" />
                            <button onClick={handleImport} disabled={importing} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-2.5 text-xs font-black text-white disabled:opacity-60">{importing ? <LoadingSpinner size="sm" text="" /> : <RefreshCw className="h-3.5 w-3.5" />}CSV 다시 적재</button>
                        </div>
                    )}
                </div>

                <div className="lg:col-span-8 space-y-4">
                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-black text-slate-900">네이버 지도</h2><span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700">결과 {items.length}건</span></div>
                        <div className="mb-3 text-xs font-semibold text-slate-500">PC는 우클릭, 모바일은 길게 눌러 기준 위치를 직접 선택할 수 있습니다.</div>
                        <div className="relative h-[360px] overflow-hidden rounded-2xl bg-slate-100">
                            <div ref={mapContainerRef} className="h-full w-full" onContextMenu={(e) => e.preventDefault()} />
                            {!mapLoaded && !mapError && <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 text-white"><LoadingSpinner text="지도를 준비하는 중..." /></div>}
                            {mapError && <div className="absolute inset-0 flex items-center justify-center bg-slate-900/70 text-sm font-bold text-white">지도 SDK 로드 실패</div>}
                        </div>
                    </div>

                    {selectedItem && (
                        <div className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50/50 to-white p-5 shadow-sm">
                            <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-black text-slate-900">선택 화장실 상세</h2><span className="rounded-full bg-white px-3 py-1 text-xs font-black text-cyan-700">ID {getLotId(selectedItem)}</span></div>
                            <div className="text-base font-black text-slate-900">{selectedItem?.restroom_name ?? selectedItem?.restroomName ?? "-"}</div>
                            <div className="mt-1 text-sm text-slate-600">{selectedItem?.road_address ?? selectedItem?.roadAddress ?? selectedItem?.lot_address ?? selectedItem?.lotAddress ?? "-"}</div>
                            <div className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                                <div className="rounded-xl bg-white p-3">
                                    <div className="text-xs font-black text-slate-400">개방 정보</div>
                                    <div className="mt-1 font-bold text-slate-800">{selectedItem?.restroom_type ?? selectedItem?.restroomType ?? "-"}</div>
                                    <div className="text-slate-700">개방시간: {selectedItem?.opening_time ?? selectedItem?.openingTime ?? "-"}</div>
                                    <div className="text-slate-600 text-xs">{selectedItem?.opening_time_detail ?? selectedItem?.openingTimeDetail ?? "상세 없음"}</div>
                                </div>
                                <div className="rounded-xl bg-white p-3">
                                    <div className="text-xs font-black text-slate-400">변기 수</div>
                                    <div className="mt-1 text-slate-800">남/여: {toNumber(selectedItem?.male_toilet_count ?? selectedItem?.maleToiletCount)} / {toNumber(selectedItem?.female_toilet_count ?? selectedItem?.femaleToiletCount)}</div>
                                    <div className="text-slate-800">남 소변기: {toNumber(selectedItem?.male_urinal_count ?? selectedItem?.maleUrinalCount)}</div>
                                    <div className="text-slate-800">장애인 남/여: {toNumber(selectedItem?.male_disabled_toilet_count ?? selectedItem?.maleDisabledToiletCount)} / {toNumber(selectedItem?.female_disabled_toilet_count ?? selectedItem?.femaleDisabledToiletCount)}</div>
                                </div>
                                <div className="rounded-xl bg-white p-3">
                                    <div className="text-xs font-black text-slate-400">안전/편의 시설</div>
                                    <div className="mt-1 text-slate-800">비상벨: {ynLabel(selectedItem?.emergency_bell_yn ?? selectedItem?.emergencyBellYn)}</div>
                                    <div className="text-slate-800">입구 CCTV: {ynLabel(selectedItem?.entrance_cctv_yn ?? selectedItem?.entranceCctvYn)}</div>
                                    <div className="text-slate-800">기저귀교환대: {ynLabel(selectedItem?.diaper_change_yn ?? selectedItem?.diaperChangeYn)}</div>
                                </div>
                                <div className="rounded-xl bg-white p-3">
                                    <div className="text-xs font-black text-slate-400">연락/관리</div>
                                    <div className="mt-1 text-slate-800">전화: {selectedItem?.phone_number ?? selectedItem?.phoneNumber ?? "-"}</div>
                                    <div className="text-slate-800">관리기관: {selectedItem?.manager_name ?? selectedItem?.managerName ?? "-"}</div>
                                    <div className="text-slate-800">소유구분: {selectedItem?.ownership_type ?? selectedItem?.ownershipType ?? "-"}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        {loading ? (
                            <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center"><LoadingSpinner text="화장실 데이터를 불러오는 중..." /></div>
                        ) : items.length === 0 ? (
                            <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center text-sm font-bold text-slate-400">검색 결과가 없습니다.</div>
                        ) : (
                            items.map((item) => {
                                const id = getLotId(item);
                                const selected = String(id) === String(selectedLotId);
                                return (
                                    <button key={id} onClick={() => { setSelectedLotId(id); setMobileDetailOpen(true); }} className={`w-full rounded-3xl border p-5 text-left shadow-sm transition-all ${selected ? "border-cyan-300 bg-cyan-50/30" : "border-slate-100 bg-white hover:border-cyan-100"}`}>
                                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                            <div>
                                                <h3 className="text-base font-black text-slate-900">{item?.restroom_name ?? item?.restroomName}</h3>
                                                <p className="mt-1 text-sm text-slate-500">{item?.road_address ?? item?.roadAddress ?? item?.lot_address ?? item?.lotAddress ?? "-"}</p>
                                            </div>
                                            <div className="flex flex-wrap gap-2 text-xs font-black">
                                                <span className="rounded-xl bg-sky-50 px-2.5 py-1 text-sky-700">거리 {toNumber(item?.distance_km ?? item?.distanceKm).toFixed(2)}km</span>
                                                <span className="rounded-xl bg-cyan-50 px-2.5 py-1 text-cyan-700">{item?.restroom_type ?? item?.restroomType ?? "구분없음"}</span>
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
                            <h2 className="text-lg font-black text-slate-900">화장실 상세</h2>
                            <button type="button" className="rounded-xl bg-slate-100 p-2 text-slate-600" onClick={() => setMobileDetailOpen(false)} aria-label="상세 닫기"><X className="h-4 w-4" /></button>
                        </div>
                        <div className="mb-3 text-base font-black text-slate-900">{selectedItem?.restroom_name ?? selectedItem?.restroomName ?? "-"}</div>
                        <div className="mb-4 text-sm text-slate-600">{selectedItem?.road_address ?? selectedItem?.roadAddress ?? selectedItem?.lot_address ?? selectedItem?.lotAddress ?? "-"}</div>
                        <div className="space-y-2 text-sm">
                            <div className="rounded-xl bg-slate-50 p-3">
                                <div className="text-xs font-black text-slate-400">개방 정보</div>
                                <div className="mt-1 text-slate-800">구분: {selectedItem?.restroom_type ?? selectedItem?.restroomType ?? "-"}</div>
                                <div className="text-slate-800">개방시간: {selectedItem?.opening_time ?? selectedItem?.openingTime ?? "-"}</div>
                                <div className="text-slate-600 text-xs">{selectedItem?.opening_time_detail ?? selectedItem?.openingTimeDetail ?? "상세 없음"}</div>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-3">
                                <div className="text-xs font-black text-slate-400">변기/안전 시설</div>
                                <div className="mt-1 text-slate-800">남/여 변기: {toNumber(selectedItem?.male_toilet_count ?? selectedItem?.maleToiletCount)} / {toNumber(selectedItem?.female_toilet_count ?? selectedItem?.femaleToiletCount)}</div>
                                <div className="text-slate-800">비상벨: {ynLabel(selectedItem?.emergency_bell_yn ?? selectedItem?.emergencyBellYn)}</div>
                                <div className="text-slate-800">입구 CCTV: {ynLabel(selectedItem?.entrance_cctv_yn ?? selectedItem?.entranceCctvYn)}</div>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-3">
                                <div className="text-xs font-black text-slate-400">연락/관리</div>
                                <div className="mt-1 text-slate-800">전화: {selectedItem?.phone_number ?? selectedItem?.phoneNumber ?? "-"}</div>
                                <div className="text-slate-800">관리기관: {selectedItem?.manager_name ?? selectedItem?.managerName ?? "-"}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
