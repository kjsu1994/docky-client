import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, Map as MapIcon, MapPin, Navigation, Plus, Users, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "../utils/api";
import { LoadingSpinner } from "../components/LoadingSpinner";

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
        return () => {
            sdkScript.removeEventListener("load", onLoad);
            sdkScript.removeEventListener("error", onError);
        };
    }, []);

    return { isLoaded, error };
};

const normalizeAddress = (value) => (value || "").trim().replace(/\s+/g, " ");

export const MeetingOptimizer = () => {
    const [addresses, setAddresses] = useState(["", ""]);
    const [loading, setLoading] = useState(false);
    const [loadingStep, setLoadingStep] = useState("후보지를 계산하는 중...");
    const [result, setResult] = useState(null);
    const [selectedCandidateIndex, setSelectedCandidateIndex] = useState(0);
    const [loadingPostcodeIndex, setLoadingPostcodeIndex] = useState(null);
    const [mapTargetIndex, setMapTargetIndex] = useState(0);

    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markerEntriesRef = useRef([]);
    const mapTargetIndexRef = useRef(0);
    const interactionListenersRef = useRef([]);
    const longPressStateRef = useRef({ timerId: null, startX: 0, startY: 0, moved: false });

    const { isLoaded, error: mapsError } = useNaverMaps();

    const addressMeta = useMemo(() => {
        const normalized = addresses.map((value) => normalizeAddress(value));
        const counts = normalized.reduce((acc, value) => {
            if (!value) return acc;
            const key = value.toLowerCase();
            acc.set(key, (acc.get(key) || 0) + 1);
            return acc;
        }, new Map());
        return normalized.map((value) => {
            if (!value) return { valid: false, reason: "주소를 입력해 주세요." };
            if (value.length < 2) return { valid: false, reason: "주소가 너무 짧습니다." };
            if ((counts.get(value.toLowerCase()) || 0) > 1) return { valid: false, reason: "중복된 주소입니다." };
            return { valid: true, reason: "" };
        });
    }, [addresses]);

    const canSubmit = useMemo(() => {
        if (loading || loadingPostcodeIndex !== null) return false;
        if (addresses.length < 2) return false;
        return addressMeta.every((entry) => entry.valid);
    }, [addressMeta, addresses.length, loading, loadingPostcodeIndex]);

    const maxTravelMinutes = useMemo(() => {
        if (!Array.isArray(result?.user_results)) return null;
        const values = result.user_results.map((v) => Number(v?.travel_time)).filter((v) => Number.isFinite(v));
        return values.length ? Math.max(...values) : null;
    }, [result]);

    const roundMinutes = (value) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return value;
        return Math.round(numeric);
    };

    useEffect(() => {
        mapTargetIndexRef.current = mapTargetIndex;
    }, [mapTargetIndex]);

    useEffect(() => {
        if (mapTargetIndex > addresses.length - 1) {
            setMapTargetIndex(Math.max(0, addresses.length - 1));
        }
    }, [addresses.length, mapTargetIndex]);

    useEffect(() => {
        if (!loading) {
            setLoadingStep("후보지를 계산하는 중...");
            return;
        }
        const steps = ["후보지를 계산하는 중...", "이동시간을 비교하는 중...", "최적 후보를 정렬하는 중..."];
        let index = 0;
        const timer = setInterval(() => {
            index = (index + 1) % steps.length;
            setLoadingStep(steps[index]);
        }, 900);
        return () => clearInterval(timer);
    }, [loading]);

    const updateAddress = (index, value) => {
        setAddresses((prev) => {
            const next = [...prev];
            next[index] = value;
            return next;
        });
    };

    const handleMyLocation = (index) => {
        if (!navigator.geolocation || !window.naver?.maps?.Service) {
            toast.error("현재 위치 기능을 사용할 수 없습니다.");
            return;
        }
        const toastId = toast.loading("현재 위치를 확인하는 중...");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const coords = new window.naver.maps.LatLng(position.coords.latitude, position.coords.longitude);
                window.naver.maps.Service.reverseGeocode({ coords }, (status, response) => {
                    toast.dismiss(toastId);
                    if (status !== window.naver.maps.Service.Status.OK) {
                        toast.error("현재 위치 주소 변환에 실패했습니다.");
                        return;
                    }
                    const selectedAddress = response?.v2?.address?.roadAddress || response?.v2?.address?.jibunAddress || "";
                    updateAddress(index, selectedAddress);
                    if (mapRef.current) {
                        mapRef.current.setCenter(coords);
                        mapRef.current.setZoom(15);
                    }
                });
            },
            () => {
                toast.dismiss(toastId);
                toast.error("위치 권한이 필요합니다.");
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    };

    const handleDaumPostcode = async (index) => {
        if (loadingPostcodeIndex !== null) return;
        setLoadingPostcodeIndex(index);
        try {
            await loadDaumPostcodeScript();
            new window.daum.Postcode({
                oncomplete: (data) => {
                    const selectedAddress = data?.roadAddress || data?.jibunAddress || data?.address || "";
                    if (!selectedAddress) {
                        toast.error("주소가 선택되지 않았습니다.");
                        return;
                    }
                    updateAddress(index, selectedAddress);
                },
            }).open();
        } catch (err) {
            toast.error("우편번호 서비스를 열지 못했습니다.");
        } finally {
            setLoadingPostcodeIndex(null);
        }
    };

    const applyPickedAddress = (coord, label) => {
        if (!coord || !window.naver?.maps?.Service) return;
        const coords = new window.naver.maps.LatLng(Number(coord.lat()), Number(coord.lng()));
        const targetIndex = mapTargetIndexRef.current;
        window.naver.maps.Service.reverseGeocode({ coords }, (status, response) => {
            if (status !== window.naver.maps.Service.Status.OK) {
                toast.error("선택한 위치의 주소 변환에 실패했습니다.");
                return;
            }
            const selectedAddress = response?.v2?.address?.roadAddress || response?.v2?.address?.jibunAddress || "";
            if (!selectedAddress) {
                toast.error("이 위치의 주소를 찾을 수 없습니다.");
                return;
            }
            updateAddress(targetIndex, selectedAddress);
            toast.success(`${label}: 참여자 ${targetIndex + 1} 주소를 반영했습니다.`);
        });
    };

    const pickByClientPoint = (clientX, clientY) => {
        if (!mapRef.current || !mapContainerRef.current || !window.naver?.maps) return;
        const rect = mapContainerRef.current.getBoundingClientRect();
        const projection = mapRef.current.getProjection?.();
        if (!projection) return;
        const point = new window.naver.maps.Point(clientX - rect.left, clientY - rect.top);
        const coord = typeof projection.fromOffsetToCoord === "function"
            ? projection.fromOffsetToCoord(point)
            : projection.fromPointToCoord(point);
        if (!coord) return;
        applyPickedAddress(coord, "길게 누르기");
    };

    const focusCandidate = (index) => {
        const target = markerEntriesRef.current[index];
        if (!target || !mapRef.current) return;
        mapRef.current.panTo(target.marker.getPosition());
        target.infoWindow.open(mapRef.current, target.marker);
        setSelectedCandidateIndex(index);
    };

    const renderMarkers = (data) => {
        if (!window.naver?.maps || !mapRef.current) return;
        markerEntriesRef.current.forEach((entry) => entry.marker.setMap(null));
        markerEntriesRef.current = [];

        const bounds = new window.naver.maps.LatLngBounds();
        const candidates = data?.candidates || [];
        candidates.forEach((candidate, idx) => {
            const position = new window.naver.maps.LatLng(candidate.latitude, candidate.longitude);
            const marker = new window.naver.maps.Marker({
                position,
                map: mapRef.current,
                title: candidate.name || `후보 ${idx + 1}`,
            });
            const infoWindow = new window.naver.maps.InfoWindow({
                content: `
                    <div style="padding:10px;min-width:180px;">
                        <div style="font-weight:700;font-size:13px;">후보 ${idx + 1}: ${candidate.name || "중간지점"}</div>
                        <div style="font-size:11px;color:#64748b;margin-top:4px;">${candidate.address || "주소 정보 없음"}</div>
                    </div>
                `,
            });
            window.naver.maps.Event.addListener(marker, "click", () => {
                infoWindow.open(mapRef.current, marker);
                setSelectedCandidateIndex(idx);
            });
            markerEntriesRef.current.push({ marker, infoWindow });
            bounds.extend(position);
        });

        if (!bounds.isEmpty()) {
            mapRef.current.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
            setSelectedCandidateIndex(0);
            setTimeout(() => focusCandidate(0), 120);
        }
    };

    useEffect(() => {
        if (!isLoaded || !mapContainerRef.current || mapRef.current || !window.naver?.maps) return;
        mapRef.current = new window.naver.maps.Map(mapContainerRef.current, {
            center: new window.naver.maps.LatLng(37.5665, 126.978),
            zoom: 12,
            zoomControl: true,
            mapTypeControl: true,
        });
    }, [isLoaded]);

    useEffect(() => {
        if (!isLoaded || !mapRef.current || !window.naver?.maps?.Event) return;
        interactionListenersRef.current.forEach((listener) => window.naver.maps.Event.removeListener(listener));
        interactionListenersRef.current = [];

        const rightClickListener = window.naver.maps.Event.addListener(mapRef.current, "rightclick", (event) => {
            applyPickedAddress(event?.coord, "우클릭");
        });
        const longTapListener = window.naver.maps.Event.addListener(mapRef.current, "longtap", (event) => {
            applyPickedAddress(event?.coord, "길게 누르기");
        });
        interactionListenersRef.current.push(rightClickListener);
        interactionListenersRef.current.push(longTapListener);

        return () => {
            interactionListenersRef.current.forEach((listener) => window.naver.maps.Event.removeListener(listener));
            interactionListenersRef.current = [];
        };
    }, [isLoaded]);

    useEffect(() => {
        if (!isLoaded || !mapRef.current || !mapContainerRef.current) return;
        const container = mapContainerRef.current;
        const clearLongPressTimer = () => {
            if (longPressStateRef.current.timerId) clearTimeout(longPressStateRef.current.timerId);
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
                if (!longPressStateRef.current.moved) pickByClientPoint(touch.clientX, touch.clientY);
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
    }, [isLoaded]);

    const addAddress = () => setAddresses((prev) => [...prev, ""]);

    const removeAddress = (index) => {
        if (addresses.length <= 2) {
            toast.error("주소는 최소 2개가 필요합니다.");
            return;
        }
        setAddresses((prev) => prev.filter((_, i) => i !== index));
    };

    const handleOptimize = async (event) => {
        event.preventDefault();
        const normalizedAddresses = addresses.map((value) => normalizeAddress(value));
        const invalidIndexes = addressMeta.map((entry, index) => (!entry.valid ? index + 1 : null)).filter(Boolean);
        if (invalidIndexes.length > 0) {
            toast.error(`입력값을 확인해 주세요: ${invalidIndexes.join(", ")}번 주소`);
            return;
        }
        if (normalizedAddresses.length < 2) {
            toast.error("주소는 최소 2개가 필요합니다.");
            return;
        }

        setLoading(true);
        try {
            const response = await api.post("/api/optimizer/optimize", normalizedAddresses);
            const data = response?.data?.data || response?.data || {};
            const roundedData = {
                ...data,
                avg_travel_time: roundMinutes(data?.avg_travel_time),
                travel_time_std_dev: roundMinutes(data?.travel_time_std_dev),
                user_results: Array.isArray(data?.user_results)
                    ? data.user_results.map((user) => ({ ...user, travel_time: roundMinutes(user?.travel_time) }))
                    : [],
            };
            setResult(roundedData);
            setSelectedCandidateIndex(0);
            setTimeout(() => renderMarkers(roundedData), 100);
            toast.success("중간장소 계산이 완료되었습니다.");
        } catch (error) {
            const message = error?.response?.data?.message || "중간장소 계산에 실패했습니다.";
            toast.error(`계산 실패: ${message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-8 text-white shadow-2xl border border-white/5">
                <div className="relative z-10 flex items-center gap-4">
                    <div className="p-3 bg-primary-600 rounded-2xl">
                        <MapPin className="h-8 w-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight">중간장소 최적화</h1>
                        <p className="text-slate-400 text-sm">실제 이동시간 기준 추천 후보 3곳</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-4 space-y-6">
                    <div className="card p-6 bg-white border-2 border-slate-100 shadow-xl rounded-[2rem]">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                <Users className="h-5 w-5 text-primary-600" />
                                참여자 출발지
                            </h3>
                            <button type="button" onClick={addAddress} className="p-2 bg-primary-50 text-primary-600 rounded-xl hover:bg-primary-100">
                                <Plus className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1">지도 입력 대상</label>
                            <select value={mapTargetIndex} onChange={(e) => setMapTargetIndex(Number(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold">
                                {addresses.map((_, idx) => (
                                    <option key={`target-${idx}`} value={idx}>
                                        참여자 {idx + 1}
                                    </option>
                                ))}
                            </select>
                            <div className="mt-1 text-[11px] font-semibold text-slate-500">지도 우클릭(모바일 길게 누르기)으로 선택한 참여자 주소를 입력합니다.</div>
                        </div>

                        <form onSubmit={handleOptimize} className="space-y-3">
                            {addresses.map((address, idx) => (
                                <div key={`addr-${idx}`} className={`rounded-xl border ${idx === mapTargetIndex ? "border-primary-300 bg-primary-50/40" : "border-transparent"}`}>
                                    <div className="flex items-center gap-2 p-1">
                                        <input type="text" value={address} readOnly onClick={() => handleDaumPostcode(idx)} placeholder={`참여자 ${idx + 1} 주소`} className="w-full cursor-pointer px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" />
                                        <button type="button" onClick={() => handleMyLocation(idx)} className="p-2 text-slate-500 hover:text-primary-600" title="현재 위치 사용"><Navigation className="h-4 w-4" /></button>
                                        <button type="button" onClick={() => removeAddress(idx)} className="p-2 text-slate-400 hover:text-red-500" title="삭제"><X className="h-4 w-4" /></button>
                                    </div>
                                    {!addressMeta[idx]?.valid && <div className="px-3 pb-2 text-[11px] font-semibold text-red-500">{addressMeta[idx]?.reason}</div>}
                                </div>
                            ))}

                            <button type="submit" disabled={!canSubmit} className="w-full mt-4 py-3 bg-primary-600 text-white rounded-xl font-bold disabled:opacity-60">
                                {loading ? loadingStep : "중간장소 찾기"}
                            </button>
                        </form>
                    </div>
                </div>

                <div className="lg:col-span-8 space-y-6">
                    <div className="card bg-slate-900 rounded-[2rem] overflow-hidden relative h-[520px]">
                        <div className="absolute top-3 left-3 z-10 rounded-lg bg-white/90 px-3 py-1.5 text-[11px] font-bold text-slate-700 shadow">대상: 참여자 {mapTargetIndex + 1}</div>
                        <div className="absolute top-3 right-3 z-10 rounded-lg bg-white/90 px-3 py-1.5 text-[11px] font-bold text-slate-700 shadow">우클릭 / 길게 누르기로 주소 입력</div>
                        {mapsError && (
                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/95 text-center p-8">
                                <AlertCircle className="h-9 w-9 text-red-400 mb-2" />
                                <div className="text-white font-bold">지도 SDK 로드 실패</div>
                            </div>
                        )}
                        {!isLoaded && !mapsError && (
                            <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/95">
                                <LoadingSpinner text="지도를 불러오는 중..." />
                            </div>
                        )}
                        <div ref={mapContainerRef} className="w-full h-full" onContextMenu={(event) => event.preventDefault()} />
                    </div>

                    {result ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="card p-6 bg-white border-2 border-slate-100 rounded-[2rem] shadow-xl">
                                <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-500" />추천 후보 3곳</h3>
                                <div className="space-y-2 mb-4">
                                    {(result.candidates || []).slice(0, 3).map((candidate, idx) => (
                                        <button key={`${candidate.latitude}-${candidate.longitude}-${idx}`} type="button" onClick={() => focusCandidate(idx)} className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ${selectedCandidateIndex === idx ? "bg-primary-50 border-primary-500 shadow-md scale-[1.01]" : "bg-slate-50 border-slate-200 hover:bg-white hover:shadow-sm"}`}>
                                            <div className="flex items-center justify-between">
                                                <div className="text-xs font-black text-primary-600">후보 {idx + 1}</div>
                                                {selectedCandidateIndex === idx && <span className="rounded-full bg-primary-600 px-2 py-0.5 text-[10px] font-black text-white">선택됨</span>}
                                            </div>
                                            <div className="text-sm font-bold text-slate-900">{candidate.name || "중간지점"}</div>
                                            <div className="text-xs text-slate-600 mt-1">{candidate.address || "주소 정보 없음"}</div>
                                        </button>
                                    ))}
                                </div>

                                <div className="p-4 bg-slate-50 rounded-xl text-sm text-slate-700 font-medium">
                                    <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">추천 이유</div>
                                    {result.recommended_reason}
                                </div>

                                <div className="grid grid-cols-3 gap-2 mt-4">
                                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2"><div className="text-[10px] font-black uppercase tracking-wider text-slate-400">최대</div><div className="text-sm font-black text-slate-900">{maxTravelMinutes ?? "-"}분</div></div>
                                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2"><div className="text-[10px] font-black uppercase tracking-wider text-slate-400">평균</div><div className="text-sm font-black text-slate-900">{result.avg_travel_time}분</div></div>
                                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2"><div className="text-[10px] font-black uppercase tracking-wider text-slate-400">편차</div><div className="text-sm font-black text-primary-600">{result.travel_time_std_dev}분</div></div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <div className="text-[11px] text-slate-500 font-bold">평균 이동시간</div>
                                        <div className="text-xl font-black text-slate-900 flex items-center gap-1"><Clock className="h-4 w-4" />{result.avg_travel_time}분</div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-slate-500 font-bold">시간 편차</div>
                                        <div className="text-xl font-black text-primary-600">±{result.travel_time_std_dev}분</div>
                                    </div>
                                </div>
                            </div>

                            <div className="card p-6 bg-white border-2 border-slate-100 rounded-[2rem] shadow-xl overflow-hidden">
                                <h3 className="text-lg font-black text-slate-900 mb-4">참여자별 이동시간</h3>
                                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
                                    {result.user_results?.map((user, idx) => (
                                        <div key={`user-${idx}`} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                                            <div className="flex items-center justify-between gap-2">
                                                <div><div className="font-bold text-slate-900">{user.name}</div><div className="text-xs text-slate-500">{user.summary}</div></div>
                                                <div className="font-black text-slate-900">{user.travel_time}분</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="card p-12 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center text-center">
                            <div className="p-5 bg-white rounded-2xl shadow-sm mb-4"><MapIcon className="h-10 w-10 text-slate-300" /></div>
                            <h4 className="text-xl font-black text-slate-500">아직 계산 결과가 없습니다</h4>
                            <p className="text-sm text-slate-400 mt-2">주소 입력칸을 눌러 주소를 선택한 뒤 중간장소 찾기를 실행해 주세요.</p>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
            `}</style>
        </div>
    );
};
