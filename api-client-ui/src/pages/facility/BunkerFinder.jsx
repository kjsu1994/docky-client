import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DatabaseZap, LocateFixed, RefreshCw, Search, Shield, Users, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../utils/api.js";
import { LoadingSpinner } from "../../components/LoadingSpinner.jsx";
import { AddressSearchBox } from "../../common/AddressSearchBox.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { isAdminUser } from "../../utils/authorization.js";

const INITIAL_CENTER = { latitude: 37.5665, longitude: 126.9780 };
const ACTIVE_STATUS = "\uC0AC\uC6A9\uC911";
const toNumber = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const getId = (item) => item?.bunker_lot_id ?? item?.bunkerLotId ?? item?.management_no ?? item?.managementNo;

const useNaverMaps = () => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (window.naver?.maps) {
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

        if (window.naver?.maps) setIsLoaded(true);

        return () => {
            sdkScript.removeEventListener("load", onLoad);
            sdkScript.removeEventListener("error", onError);
        };
    }, []);

    return { isLoaded, error };
};

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
        toast.success(`${modeLabel} \uC704\uCE58\uB97C \uAE30\uC900\uC810\uC73C\uB85C \uC124\uC815\uD588\uC2B5\uB2C8\uB2E4.`);
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
            const response = await api.get("/bunkers/lots", {
                params: {
                    latitude: center.latitude,
                    longitude: center.longitude,
                    radius_km: parseRadiusKm(),
                    limit: parseLimit(),
                },
            });
            const rows = response?.data?.data?.items ?? [];
            setFetchedItems(Array.isArray(rows) ? rows : []);
        } catch (err) {
            setFetchedItems([]);
            setItems([]);
            setSelectedId(null);
            toast.error(err?.response?.data?.message || "\uB300\uD53C\uC18C \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
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

    const handleLocate = () => {
        if (locatingCurrent) return;
        if (!navigator.geolocation) return toast.error("\uBE0C\uB77C\uC6B0\uC800 \uC704\uCE58 \uAE30\uB2A5\uC744 \uC0AC\uC6A9\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
        setLocatingCurrent(true);
        const tid = toast.loading("\uD604\uC7AC \uC704\uCE58 \uD655\uC778 \uC911...");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                toast.dismiss(tid);
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
                toast.success(Number.isFinite(accuracy)
                    ? `\uD604\uC7AC \uC704\uCE58\uB85C \uAE30\uC900\uC810\uC744 \uBCC0\uACBD\uD588\uC2B5\uB2C8\uB2E4. (\uC815\uD655\uB3C4 \u00B1${Math.round(accuracy)}m)`
                    : "\uD604\uC7AC \uC704\uCE58\uB85C \uAE30\uC900\uC810\uC744 \uBCC0\uACBD\uD588\uC2B5\uB2C8\uB2E4.");
                setLocatingCurrent(false);
            },
            () => {
                toast.dismiss(tid);
                toast.error("\uC704\uCE58 \uAD8C\uD55C\uC774 \uC5C6\uC5B4 \uAE30\uBCF8 \uC704\uCE58(\uC11C\uC6B8\uC2DC\uCCAD)\uB97C \uC0AC\uC6A9\uD569\uB2C8\uB2E4.");
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
        toast.success(`"${address}" \uAE30\uC900 \uC704\uCE58\uB85C \uC774\uB3D9\uD588\uC2B5\uB2C8\uB2E4.`);
    };

    const handleImport = async () => {
        setImporting(true);
        try {
            const response = await api.post("/admin/bunker/import", null, { params: { csvPath: csvPath?.trim() || undefined } });
            const count = response?.data?.data?.imported_count ?? response?.data?.data?.importedCount ?? 0;
            toast.success(`CSV \uC7AC\uC801\uC7AC \uC644\uB8CC (${count}\uAC74)`);
            await fetchLots();
        } catch (err) {
            toast.error(err?.response?.data?.message || "CSV \uC7AC\uC801\uC7AC\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
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
            const safeId = String(id ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
            const position = new window.naver.maps.LatLng(lat, lng);
            const marker = new window.naver.maps.Marker({
                position,
                map: mapRef.current,
                title: item?.facility_name ?? item?.facilityName ?? "\uB300\uD53C\uC18C",
                icon: {
                    content: '<div style="width:14px;height:14px;border-radius:9999px;background:#0f766e;border:2px solid #fff;box-shadow:0 2px 8px rgba(15,118,110,0.45)"></div>',
                    anchor: new window.naver.maps.Point(7, 7),
                },
            });
            const infoWindow = new window.naver.maps.InfoWindow({
                content: `
                    <button type="button" onclick="window.__bunkerFinderOpenLotDetail && window.__bunkerFinderOpenLotDetail('${safeId}')" ontouchend="window.__bunkerFinderOpenLotDetail && window.__bunkerFinderOpenLotDetail('${safeId}')" style="padding:10px;min-width:210px;border:0;background:#fff;text-align:left;cursor:pointer;font-family:Arial,sans-serif;">
                      <div style="font-weight:800;font-size:13px;color:#0f172a;">${item?.facility_name ?? item?.facilityName ?? "\uB300\uD53C\uC18C"}</div>
                      <div style="font-size:11px;color:#64748b;margin-top:4px;">${item?.road_address ?? item?.roadAddress ?? item?.full_address ?? item?.fullAddress ?? "\uC8FC\uC18C \uC5C6\uC74C"}</div>
                      <div style="font-size:10px;color:#0f766e;margin-top:6px;font-weight:700;">\uD130\uCE58\uD574\uC11C \uC0C1\uC138 \uBCF4\uAE30</div>
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
            applyPickedCenter(event?.coord || event?.overlay?.position, "\uC6B0\uD074\uB9AD");
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
                    pickCenterByClientPoint(touch.clientX, touch.clientY, "\uB871\uD504\uB808\uC2A4");
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
                        <h1 className="text-xl font-black text-slate-900">{"\uB300\uD53C\uC18C \uCC3E\uAE30"}</h1>
                        <p className="text-sm text-slate-500">{"\uC778\uADFC \uB300\uD53C\uC18C\uB97C \uC870\uD68C\uD569\uB2C8\uB2E4."}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <div className="space-y-4 lg:col-span-4">
                    <div className="space-y-3 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                        <AddressSearchBox
                            onResolved={handleAddressResolved}
                            placeholder={"\uC608: \uC11C\uC6B8\uC2DC\uCCAD, \uAC15\uB0A8\uC5ED, \uD310\uAD50\uC5ED"}
                            primaryButtonLabel={"\uC8FC\uC18C\uCC3E\uAE30"}
                            secondaryButtonLabel={"\uC870\uD68C"}
                            primaryAction="postcode"
                            secondaryAction="resolve"
                        />
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={handleLocate} disabled={locatingCurrent} className="flex items-center justify-center gap-1 rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-black text-slate-700 disabled:opacity-60"><LocateFixed className="h-3.5 w-3.5" />{"\uB0B4 \uC704\uCE58"}</button>
                            <button onClick={fetchLots} disabled={loading} className="flex items-center justify-center gap-1 rounded-xl bg-primary-600 px-3 py-2.5 text-xs font-black text-white disabled:opacity-60">{loading ? <LoadingSpinner size="sm" text="" /> : <Search className="h-3.5 w-3.5" />}{"\uAC80\uC0C9"}</button>
                        </div>
                        <input value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={handleSearchEnter} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" placeholder={"\uD0A4\uC6CC\uB4DC(\uC2DC\uC124\uBA85/\uC8FC\uC18C)"} />
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-400">{"\uBC18\uACBD(km)"}</label>
                                <input type="text" inputMode="decimal" value={radiusKmInput} onChange={handleRadiusInputChange} onBlur={() => setRadiusKmInput(String(parseRadiusKm()))} onKeyDown={handleSearchEnter} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-400">{"\uCD5C\uB300\uAC1C\uC218"}</label>
                                <input type="text" inputMode="numeric" value={limitInput} onChange={handleLimitInputChange} onBlur={() => setLimitInput(String(parseLimit()))} onKeyDown={handleSearchEnter} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-slate-400">{"\uC6B4\uC601\uC0C1\uD0DC"}</label>
                            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
                                {statusOptions.map((value) => <option key={value} value={value}>{value === "all" ? "\uC804\uCCB4" : value}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                        <div className="text-xs font-black uppercase tracking-wider text-slate-400">{"\uAC80\uC0C9 \uC694\uC57D"}</div>
                        <div className="mt-2 text-sm font-bold text-slate-800">{`\uCD1D ${items.length}\uAC74 / \uC218\uC6A9 \uC778\uC6D0 ${summary.totalCapacity.toLocaleString("ko-KR")}\uBA85 / \uC0AC\uC6A9\uC911 ${summary.activeCount}\uAC74`}</div>
                        <div className="mt-3 text-xs font-semibold text-slate-500">{`\uAE30\uC900 \uC88C\uD45C: ${center.latitude}, ${center.longitude}`}</div>
                    </div>

                    {adminMode && (
                        <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
                            <div className="mb-3 flex items-center gap-2 text-amber-800"><DatabaseZap className="h-4 w-4" /><span className="text-sm font-black">{"\uAD00\uB9AC\uC790 CSV \uC7AC\uC801\uC7AC"}</span></div>
                            <input value={csvPath} onChange={(e) => setCsvPath(e.target.value)} className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700" placeholder={"\u0043\u0053\u0056 \uACBD\uB85C"} />
                            <button onClick={handleImport} disabled={importing} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-2.5 text-xs font-black text-white disabled:opacity-60">{importing ? <LoadingSpinner size="sm" text="" /> : <RefreshCw className="h-3.5 w-3.5" />}{"CSV \uB2E4\uC2DC \uC801\uC7AC"}</button>
                        </div>
                    )}
                </div>

                <div className="space-y-4 lg:col-span-8">
                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-lg font-black text-slate-900">{"\uB124\uC774\uBC84 \uC9C0\uB3C4"}</h2>
                            <div className="flex items-center gap-2">
                                <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-teal-700">{`\uACB0\uACFC ${items.length}\uAC74`}</span>
                                <button type="button" onClick={fetchLots} disabled={loading} className="flex items-center gap-1 rounded-xl bg-primary-600 px-3 py-1.5 text-xs font-black text-white disabled:opacity-60">{loading ? <LoadingSpinner size="sm" text="" /> : <RefreshCw className="h-3.5 w-3.5" />}{"\uAC80\uC0C9\uD558\uAE30"}</button>
                            </div>
                        </div>
                        <div className="mb-3 text-xs font-semibold text-slate-500">{"PC\uB294 \uC6B0\uD074\uB9AD, \uBAA8\uBC14\uC77C\uC740 \uAE38\uAC8C \uB20C\uB7EC \uAE30\uC900 \uC704\uCE58\uB97C \uC9C1\uC811 \uC120\uD0DD\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4."}</div>
                        <div className="relative h-[360px] overflow-hidden rounded-2xl bg-slate-100">
                            <div ref={mapContainerRef} className="h-full w-full" onContextMenu={(event) => event.preventDefault()} />
                            {!mapLoaded && !mapError && <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 text-white"><LoadingSpinner text={"\uC9C0\uB3C4\uB97C \uC900\uBE44\uD558\uB294 \uC911..."} /></div>}
                            {mapError && <div className="absolute inset-0 flex items-center justify-center bg-slate-900/70 text-sm font-bold text-white">{"\uC9C0\uB3C4 SDK \uB85C\uB4DC \uC2E4\uD328"}</div>}
                        </div>
                    </div>

                    {selectedItem && (
                        <div className="hidden rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-50/50 to-white p-5 shadow-sm lg:block">
                            <div className="mb-3 flex items-center justify-between">
                                <h2 className="text-lg font-black text-slate-900">{"\uC120\uD0DD \uB300\uD53C\uC18C \uC0C1\uC138"}</h2>
                                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-teal-700">{`ID ${getId(selectedItem)}`}</span>
                            </div>
                            <div className="mb-3">
                                <div className="text-base font-black text-slate-900">{selectedItem?.facility_name ?? selectedItem?.facilityName ?? "-"}</div>
                                <div className="mt-1 text-sm text-slate-600">{selectedItem?.road_address ?? selectedItem?.roadAddress ?? selectedItem?.full_address ?? selectedItem?.fullAddress ?? "-"}</div>
                            </div>
                            <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                                <div className="rounded-xl bg-white p-3">
                                    <div className="text-xs font-black text-slate-400">{"\uC6B4\uC601 \uC815\uBCF4"}</div>
                                    <div className="mt-1 font-bold text-slate-800">{selectedItem?.operation_status ?? selectedItem?.operationStatus ?? "-"}</div>
                                    <div className="text-slate-800">{`\uC2DC\uC124\uAD6C\uBD84: ${selectedItem?.facility_category ?? selectedItem?.facilityCategory ?? "-"}`}</div>
                                    <div className="text-slate-800">{`\uC2DC\uC124\uC704\uCE58: ${selectedItem?.facility_location ?? selectedItem?.facilityLocation ?? "-"}`}</div>
                                </div>
                                <div className="rounded-xl bg-white p-3">
                                    <div className="text-xs font-black text-slate-400">{"\uC218\uC6A9 \uC815\uBCF4"}</div>
                                    <div className="mt-1 flex items-center gap-1 text-slate-800"><Users className="h-3.5 w-3.5" />{`\uCD5C\uB300 \uC218\uC6A9 \uC778\uC6D0 ${toNumber(selectedItem?.max_capacity ?? selectedItem?.maxCapacity).toLocaleString("ko-KR")}\uBA85`}</div>
                                    <div className="text-slate-800">{`\uBA74\uC801: ${toNumber(selectedItem?.facility_area_square_meter ?? selectedItem?.facilityAreaSquareMeter).toLocaleString("ko-KR")}\u33A1`}</div>
                                    <div className="text-slate-800">{`\uAC70\uB9AC: ${toNumber(selectedItem?.distance_km ?? selectedItem?.distanceKm).toFixed(2)}km`}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        {loading ? (
                            <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center"><LoadingSpinner text={"\uB300\uD53C\uC18C \uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uB294 \uC911..."} /></div>
                        ) : items.length === 0 ? (
                            <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center text-sm font-bold text-slate-400">{"\uAC80\uC0C9 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."}</div>
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
                                                <p className="mt-1 text-xs font-semibold text-slate-400">{item?.facility_location ?? item?.facilityLocation ?? "\uC704\uCE58 \uC815\uBCF4 \uC5C6\uC74C"}</p>
                                            </div>
                                            <div className="flex flex-wrap gap-2 text-xs font-black">
                                                <span className="rounded-xl bg-sky-50 px-2.5 py-1 text-sky-700">{`\uAC70\uB9AC ${toNumber(item?.distance_km ?? item?.distanceKm).toFixed(2)}km`}</span>
                                                <span className="rounded-xl bg-teal-50 px-2.5 py-1 text-teal-700">{item?.operation_status ?? item?.operationStatus ?? "\uC0C1\uD0DC\uC5C6\uC74C"}</span>
                                            </div>
                                        </div>
                                        <div className="mt-4 grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
                                            <div className="rounded-xl bg-slate-50 p-3">
                                                <div className="text-xs font-black text-slate-400">{"\uC2DC\uC124\uAD6C\uBD84"}</div>
                                                <div className="mt-1 text-base font-black text-slate-800">{item?.facility_category ?? item?.facilityCategory ?? "-"}</div>
                                            </div>
                                            <div className="rounded-xl bg-slate-50 p-3">
                                                <div className="flex items-center gap-1 text-xs font-black text-slate-400"><Users className="h-3.5 w-3.5" />{"\uC218\uC6A9 \uC778\uC6D0"}</div>
                                                <div className="mt-1 text-base font-black text-slate-800">{`${toNumber(item?.max_capacity ?? item?.maxCapacity).toLocaleString("ko-KR")}\uBA85`}</div>
                                            </div>
                                            <div className="rounded-xl bg-slate-50 p-3">
                                                <div className="text-xs font-black text-slate-400">{"\uBA74\uC801"}</div>
                                                <div className="mt-1 text-base font-black text-slate-800">{`${toNumber(item?.facility_area_square_meter ?? item?.facilityAreaSquareMeter).toLocaleString("ko-KR")}\u33A1`}</div>
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
                            <h2 className="text-lg font-black text-slate-900">{"\uB300\uD53C\uC18C \uC0C1\uC138"}</h2>
                            <button type="button" className="rounded-xl bg-slate-100 p-2 text-slate-600" onClick={() => setMobileDetailOpen(false)} aria-label={"\uC0C1\uC138 \uB2EB\uAE30"}><X className="h-4 w-4" /></button>
                        </div>
                        <div className="mb-3 text-base font-black text-slate-900">{selectedItem?.facility_name ?? selectedItem?.facilityName ?? "-"}</div>
                        <div className="mb-4 text-sm text-slate-600">{selectedItem?.road_address ?? selectedItem?.roadAddress ?? selectedItem?.full_address ?? selectedItem?.fullAddress ?? "-"}</div>
                        <div className="space-y-2 text-sm">
                            <div className="rounded-xl bg-slate-50 p-3">
                                <div className="text-xs font-black text-slate-400">{"\uC6B4\uC601 \uC815\uBCF4"}</div>
                                <div className="mt-1 text-slate-800">{`\uC6B4\uC601\uC0C1\uD0DC: ${selectedItem?.operation_status ?? selectedItem?.operationStatus ?? "-"}`}</div>
                                <div className="text-slate-800">{`\uC2DC\uC124\uAD6C\uBD84: ${selectedItem?.facility_category ?? selectedItem?.facilityCategory ?? "-"}`}</div>
                                <div className="text-slate-800">{`\uC2DC\uC124\uC704\uCE58: ${selectedItem?.facility_location ?? selectedItem?.facilityLocation ?? "-"}`}</div>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-3">
                                <div className="text-xs font-black text-slate-400">{"\uC218\uC6A9 \uC815\uBCF4"}</div>
                                <div className="mt-1 text-slate-800">{`\uCD5C\uB300 \uC218\uC6A9 \uC778\uC6D0: ${toNumber(selectedItem?.max_capacity ?? selectedItem?.maxCapacity).toLocaleString("ko-KR")}\uBA85`}</div>
                                <div className="text-slate-800">{`\uBA74\uC801: ${toNumber(selectedItem?.facility_area_square_meter ?? selectedItem?.facilityAreaSquareMeter).toLocaleString("ko-KR")}\u33A1`}</div>
                                <div className="text-slate-800">{`\uAC70\uB9AC: ${toNumber(selectedItem?.distance_km ?? selectedItem?.distanceKm).toFixed(2)}km`}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
