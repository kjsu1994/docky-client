import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DatabaseZap, LocateFixed, RefreshCw, Search, Stethoscope, Activity, Building2, X } from "lucide-react";
import { LoadingSpinner } from "../../components/LoadingSpinner.jsx";
import { AddressSearchBox } from "../../common/AddressSearchBox.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { isAdminUser } from "../../utils/authorization.js";
import { useNaverMaps } from "../../utils/naverMapsLoader.js";
import { FACILITY_KEYWORD_MAX_LENGTH, extractFacilityErrorMessage, facilityAdapter } from "../../adapters/facilityAdapter.js";
import { encodeInlineHandlerArg, escapeHtml } from "../../utils/helpers.js";
import { notifyError, notifyLoading, notifySuccess } from "../../utils/toast.js";

const INITIAL_CENTER = { latitude: 37.5665, longitude: 126.9780 };
const toNumber = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const getId = (item) => item?.medical_lot_id ?? item?.medicalLotId ?? item?.institution_code ?? item?.institutionCode;
const getDisplayAddress = (item) => item?.road_address ?? item?.roadAddress ?? item?.region_address ?? item?.regionAddress ?? null;

export const MedicalFinder = () => {
    const { user } = useAuth();
    const adminMode = isAdminUser(user);

    const [center, setCenter] = useState(INITIAL_CENTER);
    const [keyword, setKeyword] = useState("");
    const [radiusKmInput, setRadiusKmInput] = useState("3");
    const [institutionType, setInstitutionType] = useState("all");
    const [limitInput, setLimitInput] = useState("50");

    const [loading, setLoading] = useState(false);
    const [locatingCurrent, setLocatingCurrent] = useState(false);
    const [fetchedItems, setFetchedItems] = useState([]);
    const [items, setItems] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [lotDetail, setLotDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importJobStatus, setImportJobStatus] = useState("IDLE");
    const [importJobInfo, setImportJobInfo] = useState(null);
    const [csvPath, setCsvPath] = useState("/data/csv_data/Medical_Dataset.csv");

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
        window.__medicalFinderOpenLotDetail = (lotId) => {
            setSelectedId(lotId);
            setMobileDetailOpen(true);
        };
        return () => {
            delete window.__medicalFinderOpenLotDetail;
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
            const result = await facilityAdapter.fetchMedicalLots({
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
            notifyError(extractFacilityErrorMessage(err, "의료기관 목록을 불러오지 못했습니다."));
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
            const job = await facilityAdapter.importMedicalLots(csvPath);
            const status = job?.status ?? "IDLE";
            setImportJobStatus(status);
            setImportJobInfo(job);
            if (status === "RUNNING") {
                notifySuccess("의료 CSV 재적재 작업을 시작했습니다.");
                return;
            }
            setImporting(false);
            if (status === "FAILED") {
                notifyError(job?.message || "CSV 재적재에 실패했습니다.");
                return;
            }
            if (job?.phase === "WAITING_LOCK") {
                notifyError(job?.message || "의료 CSV 재적재 시작 잠금을 확인하는 중입니다. 잠시 후 다시 시도해 주세요.");
                return;
            }
            notifyError(job?.message || "의료 CSV 재적재 작업을 시작하지 못했습니다.");
        } catch (err) {
            setImporting(false);
            notifyError(extractFacilityErrorMessage(err, "CSV 재적재에 실패했습니다."));
        }
    };

    const fetchImportStatus = useCallback(async () => {
        try {
            const data = await facilityAdapter.fetchMedicalImportStatus();
            const status = data?.status ?? "IDLE";
            setImportJobStatus(status);
            setImportJobInfo(data);
            if (status === "RUNNING") {
                setImporting(true);
            }
        } catch (err) {
            // keep silent to avoid noisy toast on first load
        }
    }, []);

    useEffect(() => {
        if (!importing) return undefined;
        let timerId = null;
        let cancelled = false;

        const poll = async () => {
            try {
                const data = await facilityAdapter.fetchMedicalImportStatus();
                const status = data?.status ?? "IDLE";
                if (cancelled) return;
                setImportJobStatus(status);
                setImportJobInfo(data);

                if (status === "SUCCEEDED") {
                    setImporting(false);
                    const importedCount = data?.imported_count ?? data?.importedCount ?? 0;
                    notifySuccess(`CSV 재적재 완료 (${importedCount}건)`);
                    await fetchLots();
                    return;
                }

                if (status === "FAILED") {
                    setImporting(false);
                    notifyError(data?.message || "CSV 재적재에 실패했습니다.");
                    return;
                }

                timerId = window.setTimeout(poll, 10000);
            } catch (err) {
                setImporting(false);
                notifyError(extractFacilityErrorMessage(err, "CSV 재적재 상태 확인에 실패했습니다."));
            }
        };

        timerId = window.setTimeout(poll, 1500);
        return () => {
            cancelled = true;
            if (timerId) window.clearTimeout(timerId);
        };
    }, [fetchLots, importing]);

    useEffect(() => {
        fetchLots();
    }, [fetchLots]);

    useEffect(() => {
        if (!adminMode) return;
        fetchImportStatus();
    }, [adminMode, fetchImportStatus]);

    useEffect(() => {
        let next = [...fetchedItems];
        const lowered = keyword.trim().toLowerCase();
        if (institutionType !== "all") {
            next = next.filter((item) => (item?.institution_type ?? item?.institutionType ?? "") === institutionType);
        }
        if (lowered) {
            next = next.filter((item) => {
                const name = (item?.institution_name ?? item?.institutionName ?? "").toLowerCase();
                const region = (item?.region_address ?? item?.regionAddress ?? "").toLowerCase();
                const road = (item?.road_address ?? item?.roadAddress ?? "").toLowerCase();
                const category = (item?.primary_equipment_category ?? item?.primaryEquipmentCategory ?? "").toLowerCase();
                return name.includes(lowered) || region.includes(lowered) || road.includes(lowered) || category.includes(lowered);
            });
        }
        next.sort((a, b) => toNumber(a?.distance_km ?? a?.distanceKm) - toNumber(b?.distance_km ?? b?.distanceKm));
        setItems(next);
        setSelectedId((prev) => {
            if (prev == null) return next.length ? getId(next[0]) : null;
            return next.some((item) => String(getId(item)) === String(prev)) ? prev : (next.length ? getId(next[0]) : null);
        });
    }, [fetchedItems, keyword, institutionType]);

    const typeOptions = useMemo(() => {
        const values = [...new Set(fetchedItems.map((item) => item?.institution_type ?? item?.institutionType).filter(Boolean))];
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
            const name = item?.institution_name ?? item?.institutionName ?? "의료시설";
            const address = getDisplayAddress(item) ?? "주소 정보 없음";
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
                    <button type="button" onclick="window.__medicalFinderOpenLotDetail && window.__medicalFinderOpenLotDetail(${safeId})" ontouchend="window.__medicalFinderOpenLotDetail && window.__medicalFinderOpenLotDetail(${safeId})" style="padding:10px;min-width:210px;border:0;background:#fff;text-align:left;cursor:pointer;font-family:Arial,sans-serif;">
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

    }, [center.latitude, center.longitude, mapError, mapLoaded, setPickedCenterMarker]);

    useEffect(() => {
        renderMarkers();
    }, [renderMarkers]);

    useEffect(() => {
        if (!mapLoaded || !mapRef.current || !window.naver?.maps?.Event) return;

        clearInteractionListeners();

        const applyCoordFromEvent = (event, label) => {
            const coord = event?.coord || event?.overlay?.position;
            if (coord) {
                applyPickedCenter(coord, label);
                return;
            }
            const pointerX = event?.pointerEvent?.clientX;
            const pointerY = event?.pointerEvent?.clientY;
            if (Number.isFinite(pointerX) && Number.isFinite(pointerY)) {
                pickCenterByClientPoint(pointerX, pointerY, label);
            }
        };

        const rightClickPickListener = window.naver.maps.Event.addListener(mapRef.current, "rightclick", (event) => {
            applyCoordFromEvent(event, "우클릭");
        });
        interactionListenersRef.current.push(rightClickPickListener);

        const clickListener = window.naver.maps.Event.addListener(mapRef.current, "click", () => {
            closeAllInfoWindows();
        });
        interactionListenersRef.current.push(clickListener);

        const rightClickCloseListener = window.naver.maps.Event.addListener(mapRef.current, "rightclick", () => {
            closeAllInfoWindows();
        });
        interactionListenersRef.current.push(rightClickCloseListener);

        const longTapListener = window.naver.maps.Event.addListener(mapRef.current, "longtap", (event) => {
            applyCoordFromEvent(event, "길게 누르기");
        });
        interactionListenersRef.current.push(longTapListener);

        return () => {
            clearInteractionListeners();
        };
    }, [applyPickedCenter, clearInteractionListeners, closeAllInfoWindows, mapLoaded, pickCenterByClientPoint]);

    const selectedItem = useMemo(() => {
        if (!items.length) return null;
        return items.find((item) => String(getId(item)) === String(selectedId)) ?? items[0];
    }, [items, selectedId]);

    const selectedLotId = useMemo(() => {
        const raw = selectedItem?.medical_lot_id ?? selectedItem?.medicalLotId;
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
    }, [selectedItem]);

    useEffect(() => {
        if (!selectedLotId) {
            setLotDetail(null);
            return;
        }

        let cancelled = false;
        setDetailLoading(true);
        facilityAdapter.fetchMedicalLotDetail(selectedLotId)
            .then((detail) => {
                if (cancelled) return;
                setLotDetail(detail || null);
            })
            .catch(() => {
                if (cancelled) return;
                setLotDetail(null);
            })
            .finally(() => {
                if (!cancelled) setDetailLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [selectedLotId]);

    const equipmentItems = useMemo(() => {
        if (!lotDetail) return [];
        return lotDetail?.equipment_items ?? lotDetail?.equipmentItems ?? [];
    }, [lotDetail]);
    const detailEquipmentTotalCount = toNumber(lotDetail?.equipment_total_count ?? lotDetail?.equipmentTotalCount ?? equipmentItems.length);
    const equipmentDetailIsTruncated = detailEquipmentTotalCount > equipmentItems.length;

    const groupedEquipments = useMemo(() => {
        const map = new Map();
        equipmentItems.forEach((row) => {
            const categoryName = row?.equipment_category_name ?? row?.equipmentCategoryName ?? "-";
            const categoryCode = row?.equipment_category_code ?? row?.equipmentCategoryCode ?? "-";
            const modelName = row?.model_name ?? row?.modelName ?? "-";
            const equipmentCount = Math.max(0, toNumber(row?.equipment_count ?? row?.equipmentCount));
            const key = `${categoryName}||${categoryCode}`;
            if (!map.has(key)) {
                map.set(key, { categoryName, categoryCode, rows: [], modelCountMap: new Map() });
            }
            const group = map.get(key);
            group.rows.push(row);
            group.modelCountMap.set(modelName, (group.modelCountMap.get(modelName) ?? 0) + equipmentCount);
        });
        return Array.from(map.values()).map((group) => ({
            categoryName: group.categoryName,
            categoryCode: group.categoryCode,
            rows: group.rows,
            modelCounts: Array.from(group.modelCountMap.entries())
                .map(([modelName, count]) => ({ modelName, count }))
                .sort((a, b) => b.count - a.count || a.modelName.localeCompare(b.modelName, "ko-KR")),
        }));
    }, [equipmentItems]);

    const selectedDisplayAddress = useMemo(() => {
        const detailLot = lotDetail?.lot ?? null;
        return getDisplayAddress(detailLot) ?? getDisplayAddress(selectedItem) ?? "-";
    }, [lotDetail, selectedItem]);

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
        totalEquipmentCount: items.reduce((acc, item) => acc + toNumber(item?.total_equipment_count ?? item?.totalEquipmentCount), 0),
        totalModelCount: items.reduce((acc, item) => acc + toNumber(item?.model_count ?? item?.modelCount), 0),
    }), [items]);

    return (
        <div className="space-y-6">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-rose-50 p-3 text-rose-700"><Stethoscope className="h-6 w-6" /></div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900">{"의료시설 찾기"}</h1>
                        <p className="text-sm text-slate-500">{"검색한 장소의 의료시설과 의료설비들을 확인하세요."}</p>
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
                            <select value={institutionType} onChange={(e) => setInstitutionType(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
                                {typeOptions.map((value) => <option key={value} value={value}>{value === "all" ? "전체" : value}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                        <div className="text-xs font-black uppercase tracking-wider text-slate-400">{"검색 요약"}</div>
                        <div className="mt-2 text-sm font-bold text-slate-800">{`총 ${items.length}건 / 장비수 합계 ${summary.totalEquipmentCount.toLocaleString("ko-KR")} / 모델수 합계 ${summary.totalModelCount}건`}</div>
                        <div className="mt-3 text-xs font-semibold text-slate-500">{`기준 좌표: ${center.latitude}, ${center.longitude}`}</div>
                    </div>

                    {adminMode && (
                        <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
                            <div className="mb-3 flex items-center gap-2 text-amber-800"><DatabaseZap className="h-4 w-4" /><span className="text-sm font-black">{"관리자 CSV 재적재"}</span></div>
                            <div className="mb-2 flex items-center gap-2">
                                <span className={`rounded-lg px-2 py-1 text-[10px] font-black ${importJobStatus === "RUNNING"
                                    ? "bg-sky-100 text-sky-700"
                                    : importJobStatus === "SUCCEEDED"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : importJobStatus === "FAILED"
                                            ? "bg-rose-100 text-rose-700"
                                            : "bg-slate-100 text-slate-500"}`}>
                                    {importJobStatus}
                                </span>
                                <span className="text-[11px] font-semibold text-slate-600">
                                    {importJobInfo?.message || (importJobStatus === "RUNNING" ? "재적재 진행 중" : "대기 상태")}
                                </span>
                            </div>
                            <input value={csvPath} onChange={(e) => setCsvPath(e.target.value)} className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700" placeholder={"CSV 경로"} />
                            <button onClick={handleImport} disabled={importing || importJobStatus === "RUNNING"} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-2.5 text-xs font-black text-white disabled:opacity-60">{importing ? <LoadingSpinner size="sm" text="" /> : <RefreshCw className="h-3.5 w-3.5" />}{importJobStatus === "RUNNING" ? "작업 진행중..." : "CSV 다시 적재"}</button>
                        </div>
                    )}
                </div>

                <div className="space-y-4 lg:col-span-8">
                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-lg font-black text-slate-900">{"네이버 지도"}</h2>
                            <div className="flex items-center gap-2">
                                <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-black text-rose-700">{`결과 ${items.length}건`}</span>
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
                        <div className="hidden rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50/50 to-white p-5 shadow-sm lg:block">
                            <div className="mb-3 flex items-center justify-between">
                                <h2 className="text-lg font-black text-slate-900">{"선택 의료기관 상세"}</h2>
                                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-rose-700">{`ID ${getId(selectedItem)}`}</span>
                            </div>
                            <div className="mb-3">
                                <div className="text-base font-black text-slate-900">{selectedItem?.institution_name ?? selectedItem?.institutionName ?? "-"}</div>
                                <div className="mt-1 text-sm text-slate-600">{selectedDisplayAddress}</div>
                            </div>
                            <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                                <div className="rounded-xl bg-white p-3">
                                    <div className="text-xs font-black text-slate-400">{"운영 정보"}</div>
                                    <div className="mt-1 font-bold text-slate-800">{selectedItem?.institution_type ?? selectedItem?.institutionType ?? "-"}</div>
                                    <div className="text-slate-800">{`장비대분류명: ${selectedItem?.primary_equipment_category ?? selectedItem?.primaryEquipmentCategory ?? "-"}`}</div>
                                    <div className="text-slate-800">{`시설위치: ${selectedDisplayAddress}`}</div>
                                </div>
                                <div className="rounded-xl bg-white p-3">
                                    <div className="text-xs font-black text-slate-400">{"장비 요약"}</div>
                                    <div className="mt-1 flex items-center gap-1 text-slate-800"><Activity className="h-3.5 w-3.5" />{`최대 장비수 합계 ${toNumber(selectedItem?.total_equipment_count ?? selectedItem?.totalEquipmentCount).toLocaleString("ko-KR")}`}</div>
                                    <div className="text-slate-800">{`장비종류 수: ${toNumber(selectedItem?.equipment_type_count ?? selectedItem?.equipmentTypeCount).toLocaleString("ko-KR")}`}</div>
                                    <div className="text-slate-800">{`거리: ${toNumber(selectedItem?.distance_km ?? selectedItem?.distanceKm).toFixed(2)}km`}</div>
                                </div>
                            </div>
                            <div className="mt-4 rounded-2xl bg-white p-4">
                                <div className="mb-3 text-sm font-black text-slate-900">{"보유 장비 상세"}</div>
                                {detailLoading ? (
                                    <div className="py-6 text-center"><LoadingSpinner size="sm" text={"장비 상세 불러오는 중..."} /></div>
                                ) : groupedEquipments.length === 0 ? (
                                    <div className="py-4 text-xs font-semibold text-slate-500">{"장비 상세 데이터가 없습니다."}</div>
                                ) : (
                                    <div className="space-y-3">
                                        {equipmentDetailIsTruncated && (
                                            <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                                                {`전체 ${detailEquipmentTotalCount.toLocaleString("ko-KR")}개 중 ${equipmentItems.length.toLocaleString("ko-KR")}개를 우선 표시합니다.`}
                                            </div>
                                        )}
                                        {groupedEquipments.map((group) => (
                                            <div key={`${group.categoryName}-${group.categoryCode}`} className="rounded-xl border border-slate-100 p-3">
                                                <div className="mb-2 text-xs font-black text-slate-700">{`장비대분류명: ${group.categoryName} / 장비대분류코드: ${group.categoryCode}`}</div>
                                                <div className="mb-2 rounded-lg bg-emerald-50 p-2 text-[11px] text-emerald-800">
                                                    <div className="font-black">{"모델별 수량"}</div>
                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                        {group.modelCounts.map((model) => (
                                                            <span key={`${group.categoryCode}-${model.modelName}`} className="rounded-full bg-white px-2 py-0.5 font-bold text-emerald-700">
                                                                {`${model.modelName}: ${model.count}개`}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    {group.rows.map((row, idx) => (
                                                        <div key={`${group.categoryCode}-${idx}`} className="rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
                                                            <div>{`장비세분류명: ${row?.equipment_type_name ?? row?.equipmentTypeName ?? "-"}`}</div>
                                                            <div>{`장비세분류코드: ${row?.equipment_type_code ?? row?.equipmentTypeCode ?? "-"}`}</div>
                                                            <div>{`모델명: ${row?.model_name ?? row?.modelName ?? "-"}`}</div>
                                                            <div>{`장비허가번호: ${row?.permit_no ?? row?.permitNo ?? "-"}`}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        {loading ? (
                            <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center"><LoadingSpinner text={"의료기관 데이터를 불러오는 중..."} /></div>
                        ) : items.length === 0 ? (
                            <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center text-sm font-bold text-slate-400">{"검색 결과가 없습니다."}</div>
                        ) : (
                            items.map((item) => {
                                const id = getId(item);
                                const selected = String(id) === String(selectedId);
                                const name = item?.institution_name ?? item?.institutionName;
                                const address = getDisplayAddress(item);
                                const openedAt = item?.opened_at ?? item?.openedAt;
                                return (
                                    <button key={id} onClick={() => { setSelectedId(id); setMobileDetailOpen(true); }} className={`w-full rounded-3xl border p-5 text-left shadow-sm transition-all ${selected ? "border-teal-300 bg-rose-50/30" : "border-slate-100 bg-white hover:border-rose-100"}`}>
                                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                            <div>
                                                <h3 className="text-base font-black text-slate-900">{name}</h3>
                                                <p className="mt-1 text-sm text-slate-500">{address || "-"}</p>
                                            </div>
                                            <div className="flex flex-wrap gap-2 text-xs font-black">
                                                <span className="rounded-xl bg-sky-50 px-2.5 py-1 text-sky-700">{`거리 ${toNumber(item?.distance_km ?? item?.distanceKm).toFixed(2)}km`}</span>
                                                <span className="rounded-xl bg-rose-50 px-2.5 py-1 text-rose-700">{item?.institution_type ?? item?.institutionType ?? "상태없음"}</span>
                                            </div>
                                        </div>
                                        <div className="mt-4 grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
                                            <div className="rounded-xl bg-slate-50 p-3">
                                                <div className="text-xs font-black text-slate-400">{"개원일"}</div>
                                                <div className="mt-1 text-base font-black text-slate-800">{openedAt || "-"}</div>
                                            </div>
                                            <div className="rounded-xl bg-slate-50 p-3">
                                                <div className="flex items-center gap-1 text-xs font-black text-slate-400"><Activity className="h-3.5 w-3.5" />{"장비수 합계"}</div>
                                                <div className="mt-1 text-base font-black text-slate-800">{`${toNumber(item?.total_equipment_count ?? item?.totalEquipmentCount).toLocaleString("ko-KR")}`}</div>
                                            </div>
                                            <div className="rounded-xl bg-slate-50 p-3">
                                                <div className="text-xs font-black text-slate-400">{"장비종류 수"}</div>
                                                <div className="mt-1 text-base font-black text-slate-800">{`${toNumber(item?.equipment_type_count ?? item?.equipmentTypeCount).toLocaleString("ko-KR")}`}</div>
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
                            <h2 className="text-lg font-black text-slate-900">{"의료기관 상세"}</h2>
                            <button type="button" className="rounded-xl bg-slate-100 p-2 text-slate-600" onClick={() => setMobileDetailOpen(false)} aria-label={"상세 닫기"}><X className="h-4 w-4" /></button>
                        </div>
                        <div className="mb-3 text-base font-black text-slate-900">{selectedItem?.institution_name ?? selectedItem?.institutionName ?? "-"}</div>
                        <div className="mb-4 text-sm text-slate-600">{selectedDisplayAddress}</div>
                        <div className="space-y-2 text-sm">
                            <div className="rounded-xl bg-slate-50 p-3">
                                <div className="text-xs font-black text-slate-400">{"운영 정보"}</div>
                                <div className="mt-1 text-slate-800">{`운영상태: ${selectedItem?.institution_type ?? selectedItem?.institutionType ?? "-"}`}</div>
                                <div className="text-slate-800">{`장비대분류명: ${selectedItem?.primary_equipment_category ?? selectedItem?.primaryEquipmentCategory ?? "-"}`}</div>
                                <div className="text-slate-800">{`시설위치: ${selectedDisplayAddress}`}</div>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-3">
                                <div className="text-xs font-black text-slate-400">{"장비 요약"}</div>
                                <div className="mt-1 text-slate-800">{`최대 장비수 합계: ${toNumber(selectedItem?.total_equipment_count ?? selectedItem?.totalEquipmentCount).toLocaleString("ko-KR")}`}</div>
                                <div className="text-slate-800">{`장비종류 수: ${toNumber(selectedItem?.equipment_type_count ?? selectedItem?.equipmentTypeCount).toLocaleString("ko-KR")}`}</div>
                                <div className="text-slate-800">{`거리: ${toNumber(selectedItem?.distance_km ?? selectedItem?.distanceKm).toFixed(2)}km`}</div>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-3">
                                <div className="mb-2 text-xs font-black text-slate-400">{"보유 장비 상세"}</div>
                                {detailLoading ? (
                                    <div className="py-3"><LoadingSpinner size="sm" text={"장비 상세 불러오는 중..."} /></div>
                                ) : groupedEquipments.length === 0 ? (
                                    <div className="text-xs font-semibold text-slate-500">{"장비 상세 데이터가 없습니다."}</div>
                                ) : (
                                    <div className="space-y-2">
                                        {equipmentDetailIsTruncated && (
                                            <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                                                {`전체 ${detailEquipmentTotalCount.toLocaleString("ko-KR")}개 중 ${equipmentItems.length.toLocaleString("ko-KR")}개를 우선 표시합니다.`}
                                            </div>
                                        )}
                                        {groupedEquipments.map((group) => (
                                            <div key={`m-${group.categoryName}-${group.categoryCode}`} className="rounded-lg bg-white p-2 text-xs text-slate-700">
                                                <div className="font-black">{`장비대분류명: ${group.categoryName}`}</div>
                                                <div className="mb-1">{`장비대분류코드: ${group.categoryCode}`}</div>
                                                <div className="mb-2 rounded-md bg-emerald-50 p-2 text-[11px] text-emerald-800">
                                                    <div className="font-black">{"모델별 수량"}</div>
                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                        {group.modelCounts.map((model) => (
                                                            <span key={`mobile-${group.categoryCode}-${model.modelName}`} className="rounded-full bg-white px-2 py-0.5 font-bold text-emerald-700">
                                                                {`${model.modelName}: ${model.count}개`}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                {group.rows.map((row, idx) => (
                                                    <div key={`m-${group.categoryCode}-${idx}`} className="mb-1 rounded-md bg-slate-50 p-2">
                                                        <div>{`장비세분류명: ${row?.equipment_type_name ?? row?.equipmentTypeName ?? "-"}`}</div>
                                                        <div>{`장비세분류코드: ${row?.equipment_type_code ?? row?.equipmentTypeCode ?? "-"}`}</div>
                                                        <div>{`모델명: ${row?.model_name ?? row?.modelName ?? "-"}`}</div>
                                                        <div>{`장비허가번호: ${row?.permit_no ?? row?.permitNo ?? "-"}`}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};






