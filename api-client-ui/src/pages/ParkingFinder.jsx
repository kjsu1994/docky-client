import { useEffect, useMemo, useRef, useState } from "react";
import { Car, LocateFixed, RefreshCw, Search, MapPin, CreditCard, Clock3, DatabaseZap } from "lucide-react";
import api from "../utils/api";
import toast from "react-hot-toast";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useAuth } from "../contexts/AuthContext";
import { isAdminUser } from "../utils/authorization";

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

export const ParkingFinder = () => {
    const { user } = useAuth();
    const adminMode = isAdminUser(user);

    const [center, setCenter] = useState(INITIAL_CENTER);
    const [keyword, setKeyword] = useState("");
    const [radiusKm, setRadiusKm] = useState(3);
    const [paidOnly, setPaidOnly] = useState(false);
    const [sort, setSort] = useState("distance");
    const [limit, setLimit] = useState(50);

    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [selectedLotId, setSelectedLotId] = useState(null);

    const [importing, setImporting] = useState(false);
    const [csvPath, setCsvPath] = useState("/data/csv_data/Parking_Dataset.csv");

    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markersRef = useRef([]);
    const selectedMarkerRef = useRef(null);

    const { isLoaded: mapLoaded, error: mapError } = useNaverMaps();

    const clearMarkers = () => {
        markersRef.current.forEach((entry) => {
            if (entry?.marker) entry.marker.setMap(null);
        });
        markersRef.current = [];
        selectedMarkerRef.current = null;
    };

    const fetchLots = async () => {
        setLoading(true);
        try {
            const response = await api.get("/parking/lots", {
                params: {
                    latitude: center.latitude,
                    longitude: center.longitude,
                    radius_km: radiusKm,
                    paid_only: paidOnly,
                    keyword: keyword.trim() || undefined,
                    sort,
                    limit,
                },
            });
            const payload = response?.data?.data ?? response?.data ?? {};
            const nextItems = payload?.items ?? [];
            const normalized = Array.isArray(nextItems) ? nextItems : [];
            setItems(normalized);
            setTotalCount(Number(payload?.total_count ?? payload?.totalCount ?? normalized.length));
            setSelectedLotId(normalized.length ? getLotId(normalized[0]) : null);
        } catch (err) {
            setItems([]);
            setTotalCount(0);
            setSelectedLotId(null);
            toast.error(err?.response?.data?.message || "주차장 목록을 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleLocate = () => {
        if (!navigator.geolocation) {
            toast.error("브라우저 위치 기능을 사용할 수 없습니다.");
            return;
        }
        const tid = toast.loading("현재 위치 확인 중...");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                toast.dismiss(tid);
                setCenter({
                    latitude: Number(position.coords.latitude.toFixed(6)),
                    longitude: Number(position.coords.longitude.toFixed(6)),
                });
                toast.success("현재 위치로 기준점을 변경했습니다.");
            },
            () => {
                toast.dismiss(tid);
                toast.error("위치 권한이 없어 기본 위치(서울시청)를 사용합니다.");
            },
            { enableHighAccuracy: true, timeout: 7000 }
        );
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
                    <div style="padding:10px;min-width:200px;font-family:Arial,sans-serif;">
                      <div style="font-weight:800;font-size:13px;color:#0f172a;">${item?.parking_name ?? item?.parkingName ?? "주차장"}</div>
                      <div style="font-size:11px;color:#64748b;margin-top:4px;">${item?.road_address ?? item?.roadAddress ?? item?.lot_address ?? item?.lotAddress ?? "주소 없음"}</div>
                    </div>
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
            mapRef.current.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
        }
    };

    useEffect(() => {
        fetchLots();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [center.latitude, center.longitude]);

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
        renderMarkers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items, mapLoaded]);

    useEffect(() => {
        if (!selectedLotId || !mapRef.current || !window.naver?.maps) return;

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

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            <div className="rounded-[2rem] bg-gradient-to-br from-slate-900 via-slate-800 to-primary-700 p-7 text-white shadow-2xl">
                <div className="flex items-center gap-4">
                    <div className="rounded-2xl bg-white/15 p-3">
                        <Car className="h-7 w-7" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight">주차장 찾기 + 요금비교</h1>
                        <p className="text-sm font-semibold text-slate-200">
                            현재 위치 반경 검색, 요금비교, 지도 마커 연동을 제공합니다.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="lg:col-span-4 space-y-4">
                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-black text-slate-900">검색 조건</h2>
                            <button onClick={handleLocate} className="rounded-xl bg-primary-50 p-2 text-primary-600 hover:bg-primary-100" title="현재 위치">
                                <LocateFixed className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <label className="block text-xs font-black uppercase tracking-wider text-slate-400">키워드</label>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                                <input
                                    value={keyword}
                                    onChange={(e) => setKeyword(e.target.value)}
                                    placeholder="주차장명/주소"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-400">반경(km)</label>
                                    <input type="number" min={0} max={30} value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-400">최대개수</label>
                                    <input type="number" min={1} max={200} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-400">정렬</label>
                                <select value={sort} onChange={(e) => setSort(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
                                    <option value="distance">거리순</option>
                                    <option value="base_fee">기본요금순</option>
                                </select>
                            </div>

                            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700">
                                <input type="checkbox" checked={paidOnly} onChange={(e) => setPaidOnly(e.target.checked)} />
                                유료 주차장만 보기
                            </label>

                            <button onClick={fetchLots} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-primary-200 disabled:opacity-60">
                                {loading ? <LoadingSpinner size="sm" text="" /> : <RefreshCw className="h-4 w-4" />}
                                검색하기
                            </button>
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
                            <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-black text-primary-700">결과 {totalCount}건</span>
                        </div>
                        <div className="relative h-[360px] overflow-hidden rounded-2xl bg-slate-100">
                            <div ref={mapContainerRef} className="h-full w-full" />
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
                                        onClick={() => setSelectedLotId(id)}
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
        </div>
    );
};


