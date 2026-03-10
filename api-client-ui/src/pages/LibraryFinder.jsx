import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Library, LocateFixed, RefreshCw, Search, DatabaseZap, X, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import api from "../utils/api";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { AddressSearchBox } from "../common/AddressSearchBox";
import { useAuth } from "../contexts/AuthContext";
import { isAdminUser } from "../utils/authorization";

const INITIAL_CENTER = { latitude: 37.5665, longitude: 126.9780 };
const toNumber = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const getLotId = (item) => item?.library_lot_id ?? item?.libraryLotId ?? item?.library_name ?? item?.libraryName;

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

export const LibraryFinder = () => {
    const { user } = useAuth();
    const adminMode = isAdminUser(user);
    const { isLoaded: mapLoaded, error: mapError } = useNaverMaps();

    const [center, setCenter] = useState(INITIAL_CENTER);
    const [keyword, setKeyword] = useState("");
    const [radiusKmInput, setRadiusKmInput] = useState("3");
    const [limitInput, setLimitInput] = useState("50");
    const [libraryType, setLibraryType] = useState("all");
    const [sort, setSort] = useState("distance");

    const [loading, setLoading] = useState(false);
    const [locatingCurrent, setLocatingCurrent] = useState(false);
    const [fetchedItems, setFetchedItems] = useState([]);
    const [items, setItems] = useState([]);
    const [selectedLotId, setSelectedLotId] = useState(null);
    const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

    const [csvPath, setCsvPath] = useState("/data/csv_data/Library_Dataset.csv");
    const [importing, setImporting] = useState(false);

    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markersRef = useRef([]);
    const selectedMarkerRef = useRef(null);
    const pickedCenterMarkerRef = useRef(null);

    useEffect(() => {
        window.__libraryFinderOpenLotDetail = (lotId) => {
            setSelectedLotId(lotId);
            if (window.matchMedia("(max-width: 1023px)").matches) {
                setMobileDetailOpen(true);
            }
        };
        return () => {
            delete window.__libraryFinderOpenLotDetail;
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
            const res = await api.get("/libraries/lots", {
                params: {
                    latitude: center.latitude,
                    longitude: center.longitude,
                    radius_km: parseRadius(),
                    limit: parseLimit(),
                },
            });
            const rows = res?.data?.data?.items ?? [];
            setFetchedItems(Array.isArray(rows) ? rows : []);
        } catch (err) {
            toast.error(err?.response?.data?.message || "도서관 목록을 불러오지 못했습니다.");
            setFetchedItems([]);
        } finally {
            setLoading(false);
        }
    }, [center.latitude, center.longitude, parseLimit, parseRadius]);

    useEffect(() => {
        fetchLots();
    }, [fetchLots]);

    useEffect(() => {
        const kw = keyword.trim().toLowerCase();
        let next = [...fetchedItems];
        if (libraryType !== "all") {
            next = next.filter((i) => (i?.library_type ?? i?.libraryType ?? "") === libraryType);
        }
        if (kw) {
            next = next.filter((i) => (i?.library_name ?? i?.libraryName ?? "").toLowerCase().includes(kw));
        }
        if (sort === "book_count") {
            next.sort((a, b) => toNumber(b?.book_count ?? b?.bookCount) - toNumber(a?.book_count ?? a?.bookCount));
        } else {
            next.sort((a, b) => toNumber(a?.distance_km ?? a?.distanceKm) - toNumber(b?.distance_km ?? b?.distanceKm));
        }
        setItems(next);
        setSelectedLotId((prev) => {
            if (prev == null) return next.length ? getLotId(next[0]) : null;
            return next.some((i) => String(getLotId(i)) === String(prev)) ? prev : (next.length ? getLotId(next[0]) : null);
        });
    }, [fetchedItems, keyword, libraryType, sort]);

    useEffect(() => {
        if (!mapLoaded || mapError || !mapContainerRef.current || !window.naver?.maps) return;
        if (mapRef.current) return;

        mapRef.current = new window.naver.maps.Map(mapContainerRef.current, {
            center: new window.naver.maps.LatLng(center.latitude, center.longitude),
            zoom: 14,
            mapTypeControl: true,
        });

        pickedCenterMarkerRef.current = new window.naver.maps.Marker({
            position: new window.naver.maps.LatLng(center.latitude, center.longitude),
            map: mapRef.current,
            icon: {
                content: '<div style="width:16px;height:16px;border-radius:9999px;background:#10b981;border:3px solid #fff;box-shadow:0 2px 10px rgba(16,185,129,0.5)"></div>',
                anchor: new window.naver.maps.Point(8, 8),
            },
            zIndex: 210,
        });
    }, [center.latitude, center.longitude, mapError, mapLoaded]);

    useEffect(() => {
        if (!mapRef.current || !window.naver?.maps) return;
        clearMarkers();

        items.slice(0, 200).forEach((item) => {
            const id = getLotId(item);
            const lat = Number(item?.latitude);
            const lng = Number(item?.longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
            const safeId = String(id ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");

            const position = new window.naver.maps.LatLng(lat, lng);
            const marker = new window.naver.maps.Marker({
                position,
                map: mapRef.current,
                title: item?.library_name ?? item?.libraryName ?? "도서관",
                icon: {
                    content: '<div style="width:14px;height:14px;border-radius:9999px;background:#059669;border:2px solid #fff;box-shadow:0 2px 8px rgba(5,150,105,0.45)"></div>',
                    anchor: new window.naver.maps.Point(7, 7),
                },
            });

            const infoWindow = new window.naver.maps.InfoWindow({
                content: `
                    <button type="button"
                      onclick="window.__libraryFinderOpenLotDetail && window.__libraryFinderOpenLotDetail('${safeId}')"
                      ontouchend="window.__libraryFinderOpenLotDetail && window.__libraryFinderOpenLotDetail('${safeId}')"
                      style="padding:10px;min-width:210px;border:0;background:#fff;text-align:left;cursor:pointer;font-family:Arial,sans-serif;">
                      <div style="font-weight:800;font-size:13px;color:#0f172a;">${item?.library_name ?? item?.libraryName ?? "도서관"}</div>
                      <div style="font-size:11px;color:#64748b;margin-top:4px;">${item?.road_address ?? item?.roadAddress ?? "주소 없음"}</div>
                      <div style="font-size:10px;color:#059669;margin-top:6px;font-weight:700;">터치해서 상세 보기</div>
                    </button>
                `,
            });

            window.naver.maps.Event.addListener(marker, "click", () => {
                setSelectedLotId(id);
                closeAllInfoWindows();
                infoWindow.open(mapRef.current, marker);
            });

            markersRef.current.push({ marker, infoWindow });
        });
    }, [items, clearMarkers, closeAllInfoWindows]);

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
        mapRef.current.panTo(new window.naver.maps.LatLng(lat, lng));
    }, [selectedItem]);

    const handleLocate = () => {
        if (locatingCurrent) return;
        if (!navigator.geolocation) return toast.error("브라우저 위치 기능을 사용할 수 없습니다.");
        setLocatingCurrent(true);
        const tid = toast.loading("현재 위치 확인 중...");
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                toast.dismiss(tid);
                const next = { latitude: Number(pos.coords.latitude.toFixed(6)), longitude: Number(pos.coords.longitude.toFixed(6)) };
                setCenter(next);
                if (pickedCenterMarkerRef.current) pickedCenterMarkerRef.current.setMap(null);
                pickedCenterMarkerRef.current = new window.naver.maps.Marker({
                    position: new window.naver.maps.LatLng(next.latitude, next.longitude),
                    map: mapRef.current,
                });
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
        setCenter(next);
        if (pickedCenterMarkerRef.current) pickedCenterMarkerRef.current.setMap(null);
        pickedCenterMarkerRef.current = new window.naver.maps.Marker({
            position: new window.naver.maps.LatLng(next.latitude, next.longitude),
            map: mapRef.current,
        });
        if (mapRef.current && window.naver?.maps) {
            mapRef.current.setCenter(new window.naver.maps.LatLng(next.latitude, next.longitude));
            mapRef.current.setZoom(14);
        }
        toast.success(`"${address}" 기준 위치로 이동했습니다.`);
    };

    const handleImport = async () => {
        setImporting(true);
        try {
            const res = await api.post("/admin/library/import", null, { params: { csvPath: csvPath?.trim() || undefined } });
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
        const seatTotal = items.reduce((acc, i) => acc + toNumber(i?.reading_seat_count ?? i?.readingSeatCount), 0);
        const bookTotal = items.reduce((acc, i) => acc + toNumber(i?.book_count ?? i?.bookCount), 0);
        return { seatTotal, bookTotal };
    }, [items]);

    return (
        <div className="space-y-6">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700"><Library className="h-6 w-6" /></div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900">도서관 찾기</h1>
                        <p className="text-sm text-slate-500">내주변 도서관을 찾아보세요.</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <div className="lg:col-span-4 space-y-4">
                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm space-y-3">
                        <AddressSearchBox
                            onResolved={handleAddressResolved}
                            placeholder="예: 서울시청, 강남역, 판교역"
                            primaryButtonLabel="주소찾기"
                            secondaryButtonLabel="조회"
                            primaryAction="postcode"
                            secondaryAction="resolve"
                        />
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={handleLocate} disabled={locatingCurrent} className="flex items-center justify-center gap-1 rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-black text-slate-700 disabled:opacity-60"><LocateFixed className="h-3.5 w-3.5" />내 위치</button>
                            <button onClick={fetchLots} disabled={loading} className="flex items-center justify-center gap-1 rounded-xl bg-primary-600 px-3 py-2.5 text-xs font-black text-white disabled:opacity-60">{loading ? <LoadingSpinner size="sm" text="" /> : <Search className="h-3.5 w-3.5" />}검색</button>
                        </div>
                        <input value={keyword} onChange={(e) => setKeyword(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" placeholder="키워드(도서관명)" />
                        <div className="grid grid-cols-2 gap-2">
                            <input value={radiusKmInput} onChange={(e) => setRadiusKmInput(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" placeholder="반경(km)" />
                            <input value={limitInput} onChange={(e) => setLimitInput(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" placeholder="최대개수" />
                        </div>
                        <select value={libraryType} onChange={(e) => setLibraryType(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
                            <option value="all">도서관유형: 전체</option>
                            <option value="공공도서관">도서관유형: 공공도서관</option>
                            <option value="작은도서관">도서관유형: 작은도서관</option>
                            <option value="대학도서관">도서관유형: 대학도서관</option>
                            <option value="전문도서관">도서관유형: 전문도서관</option>
                        </select>
                        <select value={sort} onChange={(e) => setSort(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
                            <option value="distance">거리순</option>
                            <option value="book_count">도서수순</option>
                        </select>
                    </div>

                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm text-sm font-bold text-slate-800">총 {items.length}건 / 좌석 합계 {summary.seatTotal.toLocaleString("ko-KR")} / 도서 합계 {summary.bookTotal.toLocaleString("ko-KR")}</div>

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
                        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-black text-slate-900">네이버 지도</h2><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">결과 {items.length}건</span></div>
                        <div className="relative h-[360px] overflow-hidden rounded-2xl bg-slate-100">
                            <div ref={mapContainerRef} className="h-full w-full" onContextMenu={(e) => e.preventDefault()} />
                            {!mapLoaded && !mapError && <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 text-white"><LoadingSpinner text="지도를 준비하는 중..." /></div>}
                            {mapError && <div className="absolute inset-0 flex items-center justify-center bg-slate-900/70 text-sm font-bold text-white">지도 SDK 로드 실패</div>}
                        </div>
                    </div>

                    {selectedItem && (
                        <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-white p-5 shadow-sm">
                            <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-black text-slate-900">선택 도서관 상세</h2><span className="rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-700">ID {getLotId(selectedItem)}</span></div>
                            <div className="text-base font-black text-slate-900">{selectedItem?.library_name ?? selectedItem?.libraryName ?? "-"}</div>
                            <div className="mt-1 text-sm text-slate-600">{selectedItem?.road_address ?? selectedItem?.roadAddress ?? "-"}</div>
                            <div className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                                <div className="rounded-xl bg-white p-3">
                                    <div className="text-xs font-black text-slate-400">운영 정보</div>
                                    <div className="mt-1 text-slate-800">유형: {selectedItem?.library_type ?? selectedItem?.libraryType ?? "-"}</div>
                                    <div className="text-slate-800">휴관: {selectedItem?.closed_day ?? selectedItem?.closedDay ?? "-"}</div>
                                    <div className="text-slate-800">평일 {selectedItem?.weekday_start ?? selectedItem?.weekdayStart ?? "-"} ~ {selectedItem?.weekday_end ?? selectedItem?.weekdayEnd ?? "-"}</div>
                                </div>
                                <div className="rounded-xl bg-white p-3">
                                    <div className="text-xs font-black text-slate-400">자료/대출</div>
                                    <div className="mt-1 text-slate-800">열람좌석: {toNumber(selectedItem?.reading_seat_count ?? selectedItem?.readingSeatCount).toLocaleString("ko-KR")}</div>
                                    <div className="text-slate-800">도서수: {toNumber(selectedItem?.book_count ?? selectedItem?.bookCount).toLocaleString("ko-KR")}</div>
                                    <div className="text-slate-800">대출권수: {toNumber(selectedItem?.lendable_count ?? selectedItem?.lendableCount)}권 / {toNumber(selectedItem?.lendable_days ?? selectedItem?.lendableDays)}일</div>
                                </div>
                                <div className="rounded-xl bg-white p-3">
                                    <div className="text-xs font-black text-slate-400">연락/운영기관</div>
                                    <div className="mt-1 text-slate-800">전화: {selectedItem?.phone_number ?? selectedItem?.phoneNumber ?? "-"}</div>
                                    <div className="text-slate-800">운영기관: {selectedItem?.operator_name ?? selectedItem?.operatorName ?? "-"}</div>
                                </div>
                                <div className="rounded-xl bg-white p-3">
                                    <div className="text-xs font-black text-slate-400">홈페이지</div>
                                    <a className="mt-1 inline-flex items-center gap-1 text-emerald-700 hover:underline" href={selectedItem?.homepage_url ?? selectedItem?.homepageUrl ?? "#"} target="_blank" rel="noreferrer">
                                        바로가기<ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        {loading ? (
                            <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center"><LoadingSpinner text="도서관 데이터를 불러오는 중..." /></div>
                        ) : items.length === 0 ? (
                            <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center text-sm font-bold text-slate-400">검색 결과가 없습니다.</div>
                        ) : (
                            items.map((item) => {
                                const id = getLotId(item);
                                const selected = String(id) === String(selectedLotId);
                                return (
                                    <button key={id} onClick={() => { setSelectedLotId(id); setMobileDetailOpen(true); }} className={`w-full rounded-3xl border p-5 text-left shadow-sm transition-all ${selected ? "border-emerald-300 bg-emerald-50/30" : "border-slate-100 bg-white hover:border-emerald-100"}`}>
                                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                            <div>
                                                <h3 className="text-base font-black text-slate-900">{item?.library_name ?? item?.libraryName}</h3>
                                                <p className="mt-1 text-sm text-slate-500">{item?.road_address ?? item?.roadAddress ?? "-"}</p>
                                            </div>
                                            <div className="flex flex-wrap gap-2 text-xs font-black">
                                                <span className="rounded-xl bg-sky-50 px-2.5 py-1 text-sky-700">거리 {toNumber(item?.distance_km ?? item?.distanceKm).toFixed(2)}km</span>
                                                <span className="rounded-xl bg-emerald-50 px-2.5 py-1 text-emerald-700">{item?.library_type ?? item?.libraryType ?? "구분없음"}</span>
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
                            <h2 className="text-lg font-black text-slate-900">도서관 상세</h2>
                            <button type="button" className="rounded-xl bg-slate-100 p-2 text-slate-600" onClick={() => setMobileDetailOpen(false)} aria-label="상세 닫기"><X className="h-4 w-4" /></button>
                        </div>
                        <div className="mb-3 text-base font-black text-slate-900">{selectedItem?.library_name ?? selectedItem?.libraryName ?? "-"}</div>
                        <div className="mb-4 text-sm text-slate-600">{selectedItem?.road_address ?? selectedItem?.roadAddress ?? "-"}</div>
                        <div className="space-y-2 text-sm">
                            <div className="rounded-xl bg-slate-50 p-3">
                                <div className="text-xs font-black text-slate-400">운영/연락</div>
                                <div className="mt-1 text-slate-800">유형: {selectedItem?.library_type ?? selectedItem?.libraryType ?? "-"}</div>
                                <div className="text-slate-800">휴관: {selectedItem?.closed_day ?? selectedItem?.closedDay ?? "-"}</div>
                                <div className="text-slate-800">전화: {selectedItem?.phone_number ?? selectedItem?.phoneNumber ?? "-"}</div>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-3">
                                <div className="text-xs font-black text-slate-400">자료</div>
                                <div className="mt-1 text-slate-800">열람좌석: {toNumber(selectedItem?.reading_seat_count ?? selectedItem?.readingSeatCount)}</div>
                                <div className="text-slate-800">도서수: {toNumber(selectedItem?.book_count ?? selectedItem?.bookCount)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
