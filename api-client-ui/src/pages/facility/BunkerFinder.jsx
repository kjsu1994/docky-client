import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed, RefreshCw, Search, Shield, Users, X } from "lucide-react";
import { LoadingSpinner } from "../../components/LoadingSpinner.jsx";
import { CsvImportPanel } from "./CsvImportPanel.jsx";
import { AddressSearchBox } from "../../common/AddressSearchBox.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { isAdminUser } from "../../utils/authorization.js";
import { useNaverMaps } from "../../utils/naverMapsLoader.js";
import { FACILITY_KEYWORD_MAX_LENGTH, extractFacilityErrorMessage, facilityAdapter } from "../../adapters/facilityAdapter.js";
import { encodeInlineHandlerArg, escapeHtml } from "../../utils/helpers.js";
import { notifyError, notifyLoading, notifySuccess } from "../../utils/toast.js";

const INITIAL_CENTER = { latitude: 37.5665, longitude: 126.9780 };
const ACTIVE_STATUS = "사용중";
const toNumber = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const getId = (item) => item?.bunker_lot_id ?? item?.bunkerLotId ?? item?.management_no ?? item?.managementNo;

export const BunkerFinder = () => {
    const { user } = useAuth();
    const adminMode = isAdminUser(user);

    const [center, setCenter] = useState(INITIAL_CENTER);
    const [keyword, setKeyword] = useState("");
    const [radiusKmInput, setRadiusKmInput] = useState("3");
    const [statusFilter, setStatusFilter] = useState("all");
    const [limitInput, setLimitInput] = useState("50");

    const [loading, setLoading] = useState(false);
    const [locatingCurrent, setLocatingCurrent] = useState(false);
    const [fetchedItems, setFetchedItems] = useState([]);
    const [items, setItems] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
    const [importing, setImporting] = useState(false);
    const [csvPath, setCsvPath] = useState("/data/csv_data/Bunker_Dataset.csv");

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
        window.__bunkerFinderOpenLotDetail = (lotId) => {
            setSelectedId(lotId);
            setMobileDetailOpen(true);
        };
        return () => {
            delete window.__bunkerFinderOpenLotDetail;
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
        if (!window.naver?.maps?.Event) return;
        interactionListenersRef.current.forEach((listener) => {
            if (listener && typeof listener.remove === "function") {
                listener.remove();
                return;
            }
            window.naver.maps.Event.removeListener(listener);
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
        notifySuccess(`${modeLabel} 위치를 기준점으로 설정했습니다.`);
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
        const coord = typeof projection.fromOffsetToCoord === "function"
            ? projection.fromOffsetToCoord(point)
            : projection.fromPointToCoord?.(point);
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
        return Math.max(1, Math.min(200, Math.trunc(numeric)));
    }, [limitInput]);

    const fetchLots = useCallback(async () => {
        setLoading(true);
        try {
            const result = await facilityAdapter.fetchBunkerLots({
                latitude: center.latitude,
                longitude: center.longitude,
                radiusKm: parseRadiusKm(),
                limit: parseLimit(),
            });
            setFetchedItems(result.items);
        } catch (err) {
            setFetchedItems([]);
            setItems([]);
            setSelectedId(null);
            notifyError(extractFacilityErrorMessage(err, "대피소 목록을 불러오지 못했습니다."));
        } finally {
            setLoading(false);
        }
    }, [center.latitude, center.longitude, parseLimit, parseRadiusKm]);

    const handleSearchEnter = (event) => {
        if (event.key !== "Enter" || event.nativeEvent?.isComposing) return;
        event.preventDefault();
        fetchLots();
    };

    const handleRadiusInputChange = (event) => {
        if (/^\d*\.?\d*$/.test(event.target.value)) setRadiusKmInput(event.target.value);
    };

    const handleLimitInputChange = (event) => {
        if (/^\d*$/.test(event.target.value)) setLimitInput(event.target.value);
    };

    const handleLocate = async () => {
        if (locatingCurrent) return;
        if (!navigator.geolocation) return notifyError("브라우저 위치 기능을 사용할 수 없습니다.");
        setLocatingCurrent(true);
        const loadingToast = await notifyLoading("현재 위치 확인 중...");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                loadingToast.dismiss();
                const nextCenter = {
                    latitude: Number(position.coords.latitude.toFixed(6)),
                    longitude: Number(position.coords.longitude.toFixed(6)),
                };
                const accuracy = Number(position?.coords?.accuracy);
                skipFitBoundsOnceRef.current = true;
                skipAutoPanOnceRef.current = true;
                setCenter(nextCenter);
                setPickedCenterMarker(nextCenter.latitude, nextCenter.longitude);
                if (mapRef.current && window.naver?.maps) {
                    mapRef.current.setCenter(new window.naver.maps.LatLng(nextCenter.latitude, nextCenter.longitude));
                    mapRef.current.setZoom(15);
                }
                notifySuccess(Number.isFinite(accuracy)
                    ? `현재 위치로 기준점을 변경했습니다. (정확도 ±${Math.round(accuracy)}m)`
                    : "현재 위치로 기준점을 변경했습니다.");
                setLocatingCurrent(false);
            },
            () => {
                loadingToast.dismiss();
                notifyError("위치 권한이 없어 기본 위치(서울시청)를 사용합니다.");
                setLocatingCurrent(false);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    };

    const handleAddressResolved = ({ address, latitude, longitude }) => {
        const nextCenter = { latitude: Number(latitude.toFixed(6)), longitude: Number(longitude.toFixed(6)) };
        skipFitBoundsOnceRef.current = true;
        skipAutoPanOnceRef.current = true;
        setCenter(nextCenter);
        setPickedCenterMarker(nextCenter.latitude, nextCenter.longitude);
        if (mapRef.current && window.naver?.maps) {
            mapRef.current.setCenter(new window.naver.maps.LatLng(nextCenter.latitude, nextCenter.longitude));
            mapRef.current.setZoom(14);
        }
        notifySuccess(`"${address}" 기준 위치로 이동했습니다.`);
    };

    const handleImport = async () => {
        setImporting(true);
        try {
            const data = await facilityAdapter.importBunkerLots(csvPath);
            const count = data.importedCount;
            notifySuccess(`CSV 재적재 완료 (${count}건)`);
            await fetchLots();
        } catch (err) {
            notifyError(extractFacilityErrorMessage(err, "CSV 재적재에 실패했습니다."));
        } finally {
            setImporting(false);
        }
    };

    const handleImportFile = async (file) => {
        setImporting(true);
        try {
            const data = await facilityAdapter.importBunkerLotsFile(file);
            const count = data.importedCount;
            if (data.csvPath) setCsvPath(data.csvPath);
            notifySuccess(`CSV 재적재 완료 (${count}건)`);
            await fetchLots();
        } catch (err) {
            notifyError(extractFacilityErrorMessage(err, "CSV 재적재에 실패했습니다."));
        } finally {
            setImporting(false);
        }
    };

    useEffect(() => {
        fetchLots();
    }, [fetchLots]);

    useEffect(() => {
        let next = [...fetchedItems];
        const lowered = keyword.trim().toLowerCase();
        if (statusFilter !== "all") {
            next = next.filter((item) => (item?.operation_status ?? item?.operationStatus ?? "") === statusFilter);
        }
        if (lowered) {
            next = next.filter((item) => {
                const name = (item?.facility_name ?? item?.facilityName ?? "").toLowerCase();
                const road = (item?.road_address ?? item?.roadAddress ?? "").toLowerCase();
                const full = (item?.full_address ?? item?.fullAddress ?? "").toLowerCase();
                return name.includes(lowered) || road.includes(lowered) || full.includes(lowered);
            });
        }
        next.sort((a, b) => toNumber(a?.distance_km ?? a?.distanceKm) - toNumber(b?.distance_km ?? b?.distanceKm));
        setItems(next);
        setSelectedId((prev) => {
            if (prev == null) return next.length ? getId(next[0]) : null;
            return next.some((item) => String(getId(item)) === String(prev)) ? prev : (next.length ? getId(next[0]) : null);
        });
    }, [fetchedItems, keyword, statusFilter]);

    const statusOptions = useMemo(() => {
        const values = [...new Set(fetchedItems.map((item) => item?.operation_status ?? item?.operationStatus).filter(Boolean))];
        return ["all", ...values];
    }, [fetchedItems]);

    const renderMarkers = useCallback(() => {
        if (!mapLoaded || !window.naver?.maps || !mapRef.current) return;
        clearMarkers();
        if (!items.length) return;

        const bounds = new window.naver.maps.LatLngBounds();
        let hasBoundsPoint = false;
        items.slice(0, 200).forEach((item) => {
            const id = getId(item);
            const lat = Number(item?.latitude);
            const lng = Number(item?.longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
            const safeId = encodeInlineHandlerArg(id);
            const name = item?.facility_name ?? item?.facilityName ?? "대피소";
            const address = item?.road_address ?? item?.roadAddress ?? item?.full_address ?? item?.fullAddress ?? "주소 없음";
            const safeName = escapeHtml(name);
            const safeAddress = escapeHtml(address);
            const position = new window.naver.maps.LatLng(lat, lng);
            const marker = new window.naver.maps.Marker({
                position,
                map: mapRef.current,
                title: name,
                icon: {
                    content: '<div style="width:14px;height:14px;border-radius:9999px;background:#0f766e;border:2px solid #fff;box-shadow:0 2px 8px rgba(15,118,110,0.45)"></div>',
                    anchor: new window.naver.maps.Point(7, 7),
                },
            });
            const infoWindow = new window.naver.maps.InfoWindow({
                content: `
                    <button type="button" onclick="window.__bunkerFinderOpenLotDetail && window.__bunkerFinderOpenLotDetail(${safeId})" ontouchend="window.__bunkerFinderOpenLotDetail && window.__bunkerFinderOpenLotDetail(${safeId})" style="padding:10px;min-width:210px;border:0;background:#fff;text-align:left;cursor:pointer;font-family:Arial,sans-serif;">
                      <div style="font-weight:800;font-size:13px;color:#0f172a;">${safeName}</div>
                      <div style="font-size:11px;color:#64748b;margin-top:4px;">${safeAddress}</div>
                      <div style="font-size:10px;color:#0f766e;margin-top:6px;font-weight:700;">터치해서 상세 보기</div>
                    </button>
                `,
            });
            window.naver.maps.Event.addListener(marker, "click", () => {
                setSelectedId(id);
                closeAllInfoWindows();
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
    }, [clearMarkers, closeAllInfoWindows, items, mapLoaded]);

    useEffect(() => {
        if (!mapLoaded || mapError || !mapContainerRef.current || !window.naver?.maps) return;
        if (mapRef.current) return;

        mapRef.current = new window.naver.maps.Map(mapContainerRef.current, {
            center: new window.naver.maps.LatLng(center.latitude, center.longitude),
            zoom: 14,
            mapTypeControl: true,
        });
        setPickedCenterMarker(center.latitude, center.longitude);

        const rightClickListener = window.naver.maps.Event.addListener(mapRef.current, "rightclick", (event) => {
            applyPickedCenter(event?.coord || event?.overlay?.position, "우클릭");
        });
        interactionListenersRef.current.push(rightClickListener);

        const container = mapContainerRef.current;
        const clearTimer = () => {
            if (longPressStateRef.current.timerId) {
                clearTimeout(longPressStateRef.current.timerId);
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
            longPressStateRef.current.timerId = setTimeout(() => {
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
    }, [applyPickedCenter, center.latitude, center.longitude, mapError, mapLoaded, pickCenterByClientPoint, setPickedCenterMarker]);

    useEffect(() => {
        renderMarkers();
    }, [renderMarkers]);

    useEffect(() => {
        if (!mapRef.current || !window.naver?.maps?.Event) return;
        const clickListener = window.naver.maps.Event.addListener(mapRef.current, "click", () => {
            closeAllInfoWindows();
        });
        const rightClickListener = window.naver.maps.Event.addListener(mapRef.current, "rightclick", () => {
            closeAllInfoWindows();
        });
        const container = mapContainerRef.current;
        const handlePointerDown = () => {
            closeAllInfoWindows();
        };
        if (container) {
            container.addEventListener("touchstart", handlePointerDown, { passive: true });
            container.addEventListener("mousedown", handlePointerDown);
        }
        return () => {
            window.naver.maps.Event.removeListener(clickListener);
            window.naver.maps.Event.removeListener(rightClickListener);
            if (container) {
                container.removeEventListener("touchstart", handlePointerDown);
                container.removeEventListener("mousedown", handlePointerDown);
            }
        };
    }, [closeAllInfoWindows, mapLoaded]);

    const selectedItem = useMemo(() => {
        if (!items.length) return null;
        return items.find((item) => String(getId(item)) === String(selectedId)) ?? items[0];
    }, [items, selectedId]);

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

    const summary = useMemo(() => ({
        totalCapacity: items.reduce((acc, item) => acc + toNumber(item?.max_capacity ?? item?.maxCapacity), 0),
        activeCount: items.filter((item) => (item?.operation_status ?? item?.operationStatus) === ACTIVE_STATUS).length,
    }), [items]);

    return (
        <div className="space-y-6">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-teal-50 p-3 text-teal-700"><Shield className="h-6 w-6" /></div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900">{"대피소 찾기"}</h1>
                        <p className="text-sm text-slate-500">{"인근 대피소를 조회합니다."}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <div className="space-y-4 lg:col-span-4">
                    <div className="space-y-3 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                        <AddressSearchBox
                            onResolved={handleAddressResolved}
                            placeholder={"예: 서울시청, 강남역, 판교역"}
                            primaryButtonLabel={"주소찾기"}
                            secondaryButtonLabel={"조회"}
                            primaryAction="postcode"
                            secondaryAction="resolve"
                        />
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={handleLocate} disabled={locatingCurrent} className="flex items-center justify-center gap-1 rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-black text-slate-700 disabled:opacity-60"><LocateFixed className="h-3.5 w-3.5" />{"내 위치"}</button>
                            <button onClick={fetchLots} disabled={loading} className="flex items-center justify-center gap-1 rounded-xl bg-primary-600 px-3 py-2.5 text-xs font-black text-white disabled:opacity-60">{loading ? <LoadingSpinner size="sm" text="" /> : <Search className="h-3.5 w-3.5" />}{"검색"}</button>
                        </div>
                        <input value={keyword} onChange={(e) => setKeyword(e.target.value.slice(0, FACILITY_KEYWORD_MAX_LENGTH))} onKeyDown={handleSearchEnter} maxLength={FACILITY_KEYWORD_MAX_LENGTH} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" placeholder={"키워드(시설명/주소)"} />
                        <p className="text-right text-[11px] font-semibold text-slate-400">검색어 {keyword.length}/{FACILITY_KEYWORD_MAX_LENGTH}자</p>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-400">{"반경(km)"}</label>
                                <input type="text" inputMode="decimal" value={radiusKmInput} onChange={handleRadiusInputChange} onBlur={() => setRadiusKmInput(String(parseRadiusKm()))} onKeyDown={handleSearchEnter} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-400">{"최대개수"}</label>
                                <input type="text" inputMode="numeric" value={limitInput} onChange={handleLimitInputChange} onBlur={() => setLimitInput(String(parseLimit()))} onKeyDown={handleSearchEnter} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-slate-400">{"운영상태"}</label>
                            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
                                {statusOptions.map((value) => <option key={value} value={value}>{value === "all" ? "전체" : value}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                        <div className="text-xs font-black uppercase tracking-wider text-slate-400">{"검색 요약"}</div>
                        <div className="mt-2 text-sm font-bold text-slate-800">{`총 ${items.length}건 / 수용 인원 ${summary.totalCapacity.toLocaleString("ko-KR")}명 / 사용중 ${summary.activeCount}건`}</div>
                        <div className="mt-3 text-xs font-semibold text-slate-500">{`기준 좌표: ${center.latitude}, ${center.longitude}`}</div>
                    </div>

                    {adminMode && (
                        <CsvImportPanel
                            csvPath={csvPath}
                            onCsvPathChange={setCsvPath}
                            onPathImport={handleImport}
                            onFileImport={handleImportFile}
                            importing={importing}
                        />
                    )}
                </div>

                <div className="space-y-4 lg:col-span-8">
                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-lg font-black text-slate-900">{"네이버 지도"}</h2>
                            <div className="flex items-center gap-2">
                                <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-teal-700">{`결과 ${items.length}건`}</span>
                                <button type="button" onClick={fetchLots} disabled={loading} className="flex items-center gap-1 rounded-xl bg-primary-600 px-3 py-1.5 text-xs font-black text-white disabled:opacity-60">{loading ? <LoadingSpinner size="sm" text="" /> : <RefreshCw className="h-3.5 w-3.5" />}{"검색하기"}</button>
                            </div>
                        </div>
                        <div className="mb-3 text-xs font-semibold text-slate-500">{"PC는 우클릭, 모바일은 길게 눌러 기준 위치를 직접 선택할 수 있습니다."}</div>
                        <div className="relative h-[360px] overflow-hidden rounded-2xl bg-slate-100">
                            <div ref={mapContainerRef} className="h-full w-full" onContextMenu={(event) => event.preventDefault()} />
                            {!mapLoaded && !mapError && <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 text-white"><LoadingSpinner text={"지도를 준비하는 중..."} /></div>}
                            {mapError && <div className="absolute inset-0 flex items-center justify-center bg-slate-900/70 text-sm font-bold text-white">{"지도 SDK 로드 실패"}</div>}
                        </div>
                    </div>

                    {selectedItem && (
                        <div className="hidden rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-50/50 to-white p-5 shadow-sm lg:block">
                            <div className="mb-3 flex items-center justify-between">
                                <h2 className="text-lg font-black text-slate-900">{"선택 대피소 상세"}</h2>
                                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-teal-700">{`ID ${getId(selectedItem)}`}</span>
                            </div>
                            <div className="mb-3">
                                <div className="text-base font-black text-slate-900">{selectedItem?.facility_name ?? selectedItem?.facilityName ?? "-"}</div>
                                <div className="mt-1 text-sm text-slate-600">{selectedItem?.road_address ?? selectedItem?.roadAddress ?? selectedItem?.full_address ?? selectedItem?.fullAddress ?? "-"}</div>
                            </div>
                            <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                                <div className="rounded-xl bg-white p-3">
                                    <div className="text-xs font-black text-slate-400">{"운영 정보"}</div>
                                    <div className="mt-1 font-bold text-slate-800">{selectedItem?.operation_status ?? selectedItem?.operationStatus ?? "-"}</div>
                                    <div className="text-slate-800">{`시설구분: ${selectedItem?.facility_category ?? selectedItem?.facilityCategory ?? "-"}`}</div>
                                    <div className="text-slate-800">{`시설위치: ${selectedItem?.facility_location ?? selectedItem?.facilityLocation ?? "-"}`}</div>
                                </div>
                                <div className="rounded-xl bg-white p-3">
                                    <div className="text-xs font-black text-slate-400">{"수용 정보"}</div>
                                    <div className="mt-1 flex items-center gap-1 text-slate-800"><Users className="h-3.5 w-3.5" />{`최대 수용 인원 ${toNumber(selectedItem?.max_capacity ?? selectedItem?.maxCapacity).toLocaleString("ko-KR")}명`}</div>
                                    <div className="text-slate-800">{`면적: ${toNumber(selectedItem?.facility_area_square_meter ?? selectedItem?.facilityAreaSquareMeter).toLocaleString("ko-KR")}㎡`}</div>
                                    <div className="text-slate-800">{`거리: ${toNumber(selectedItem?.distance_km ?? selectedItem?.distanceKm).toFixed(2)}km`}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        {loading ? (
                            <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center"><LoadingSpinner text={"대피소 데이터를 불러오는 중..."} /></div>
                        ) : items.length === 0 ? (
                            <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center text-sm font-bold text-slate-400">{"검색 결과가 없습니다."}</div>
                        ) : (
                            items.map((item) => {
                                const id = getId(item);
                                const selected = String(id) === String(selectedId);
                                const name = item?.facility_name ?? item?.facilityName;
                                const address = item?.road_address ?? item?.roadAddress ?? item?.full_address ?? item?.fullAddress;
                                return (
                                    <button key={id} onClick={() => { setSelectedId(id); setMobileDetailOpen(true); }} className={`w-full rounded-3xl border p-5 text-left shadow-sm transition-all ${selected ? "border-teal-300 bg-teal-50/30" : "border-slate-100 bg-white hover:border-teal-100"}`}>
                                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                            <div>
                                                <h3 className="text-base font-black text-slate-900">{name}</h3>
                                                <p className="mt-1 text-sm text-slate-500">{address || "-"}</p>
                                                <p className="mt-1 text-xs font-semibold text-slate-400">{item?.facility_location ?? item?.facilityLocation ?? "위치 정보 없음"}</p>
                                            </div>
                                            <div className="flex flex-wrap gap-2 text-xs font-black">
                                                <span className="rounded-xl bg-sky-50 px-2.5 py-1 text-sky-700">{`거리 ${toNumber(item?.distance_km ?? item?.distanceKm).toFixed(2)}km`}</span>
                                                <span className="rounded-xl bg-teal-50 px-2.5 py-1 text-teal-700">{item?.operation_status ?? item?.operationStatus ?? "상태없음"}</span>
                                            </div>
                                        </div>
                                        <div className="mt-4 grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
                                            <div className="rounded-xl bg-slate-50 p-3">
                                                <div className="text-xs font-black text-slate-400">{"시설구분"}</div>
                                                <div className="mt-1 text-base font-black text-slate-800">{item?.facility_category ?? item?.facilityCategory ?? "-"}</div>
                                            </div>
                                            <div className="rounded-xl bg-slate-50 p-3">
                                                <div className="flex items-center gap-1 text-xs font-black text-slate-400"><Users className="h-3.5 w-3.5" />{"수용 인원"}</div>
                                                <div className="mt-1 text-base font-black text-slate-800">{`${toNumber(item?.max_capacity ?? item?.maxCapacity).toLocaleString("ko-KR")}명`}</div>
                                            </div>
                                            <div className="rounded-xl bg-slate-50 p-3">
                                                <div className="text-xs font-black text-slate-400">{"면적"}</div>
                                                <div className="mt-1 text-base font-black text-slate-800">{`${toNumber(item?.facility_area_square_meter ?? item?.facilityAreaSquareMeter).toLocaleString("ko-KR")}㎡`}</div>
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
                            <h2 className="text-lg font-black text-slate-900">{"대피소 상세"}</h2>
                            <button type="button" className="rounded-xl bg-slate-100 p-2 text-slate-600" onClick={() => setMobileDetailOpen(false)} aria-label={"상세 닫기"}><X className="h-4 w-4" /></button>
                        </div>
                        <div className="mb-3 text-base font-black text-slate-900">{selectedItem?.facility_name ?? selectedItem?.facilityName ?? "-"}</div>
                        <div className="mb-4 text-sm text-slate-600">{selectedItem?.road_address ?? selectedItem?.roadAddress ?? selectedItem?.full_address ?? selectedItem?.fullAddress ?? "-"}</div>
                        <div className="space-y-2 text-sm">
                            <div className="rounded-xl bg-slate-50 p-3">
                                <div className="text-xs font-black text-slate-400">{"운영 정보"}</div>
                                <div className="mt-1 text-slate-800">{`운영상태: ${selectedItem?.operation_status ?? selectedItem?.operationStatus ?? "-"}`}</div>
                                <div className="text-slate-800">{`시설구분: ${selectedItem?.facility_category ?? selectedItem?.facilityCategory ?? "-"}`}</div>
                                <div className="text-slate-800">{`시설위치: ${selectedItem?.facility_location ?? selectedItem?.facilityLocation ?? "-"}`}</div>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-3">
                                <div className="text-xs font-black text-slate-400">{"수용 정보"}</div>
                                <div className="mt-1 text-slate-800">{`최대 수용 인원: ${toNumber(selectedItem?.max_capacity ?? selectedItem?.maxCapacity).toLocaleString("ko-KR")}명`}</div>
                                <div className="text-slate-800">{`면적: ${toNumber(selectedItem?.facility_area_square_meter ?? selectedItem?.facilityAreaSquareMeter).toLocaleString("ko-KR")}㎡`}</div>
                                <div className="text-slate-800">{`거리: ${toNumber(selectedItem?.distance_km ?? selectedItem?.distanceKm).toFixed(2)}km`}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
