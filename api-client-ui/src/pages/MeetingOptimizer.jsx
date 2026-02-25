import { useEffect, useRef, useState } from "react";
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

export const MeetingOptimizer = () => {
    const [addresses, setAddresses] = useState(["", ""]);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [selectedCandidateIndex, setSelectedCandidateIndex] = useState(0);
    const [loadingPostcodeIndex, setLoadingPostcodeIndex] = useState(null);

    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markers = useRef([]);
    const markerEntries = useRef([]);

    const { isLoaded, error: mapsError } = useNaverMaps();

    const addAddress = () => setAddresses((prev) => [...prev, ""]);

    const removeAddress = (index) => {
        if (addresses.length <= 2) {
            toast.error("At least 2 addresses are required.");
            return;
        }
        setAddresses((prev) => prev.filter((_, i) => i !== index));
    };

    const updateAddress = (index, value) => {
        setAddresses((prev) => {
            const next = [...prev];
            next[index] = value;
            return next;
        });
    };

    const handleMyLocation = (index) => {
        if (!navigator.geolocation || !window.naver?.maps?.Service) {
            toast.error("Current location is not available.");
            return;
        }

        const toastId = toast.loading("Locating...");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                const coords = new window.naver.maps.LatLng(lat, lon);

                window.naver.maps.Service.reverseGeocode({ coords }, (status, response) => {
                    toast.dismiss(toastId);
                    if (status !== window.naver.maps.Service.Status.OK) {
                        toast.error("Failed to resolve your address.");
                        return;
                    }

                    const selectedAddress = response?.v2?.address?.roadAddress || response?.v2?.address?.jibunAddress || "";
                    updateAddress(index, selectedAddress);

                    if (mapInstance.current) {
                        mapInstance.current.setCenter(coords);
                        mapInstance.current.setZoom(15);
                    }

                    toast.success("Current address set.");
                });
            },
            () => {
                toast.dismiss(toastId);
                toast.error("Location permission is required.");
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
                        toast.error("No address selected.");
                        return;
                    }

                    updateAddress(index, selectedAddress);

                    if (!window.naver?.maps?.Service || !mapInstance.current) return;
                    window.naver.maps.Service.geocode({ query: selectedAddress }, (status, response) => {
                        if (status !== window.naver.maps.Service.Status.OK || !response?.v2?.addresses?.length) return;
                        const found = response.v2.addresses[0];
                        const latlng = new window.naver.maps.LatLng(Number(found.y), Number(found.x));
                        mapInstance.current.setCenter(latlng);
                        mapInstance.current.setZoom(15);
                    });
                },
            }).open();
        } catch (err) {
            toast.error("Failed to open postcode service.");
        } finally {
            setLoadingPostcodeIndex(null);
        }
    };

    useEffect(() => {
        if (!isLoaded || !mapRef.current || mapInstance.current || !window.naver?.maps) {
            return;
        }

        mapInstance.current = new window.naver.maps.Map(mapRef.current, {
            center: new window.naver.maps.LatLng(37.5665, 126.978),
            zoom: 12,
            zoomControl: true,
            mapTypeControl: true,
        });
    }, [isLoaded]);

    const focusCandidate = (index) => {
        const target = markerEntries.current[index];
        if (!target || !mapInstance.current) {
            return;
        }

        mapInstance.current.panTo(target.marker.getPosition());
        target.infoWindow.open(mapInstance.current, target.marker);
        setSelectedCandidateIndex(index);
    };

    const renderMarkers = (data) => {
        if (!window.naver?.maps || !mapInstance.current) {
            return;
        }

        markers.current.forEach((marker) => marker.setMap(null));
        markers.current = [];
        markerEntries.current = [];

        const bounds = new window.naver.maps.LatLngBounds();
        const candidates = data?.candidates || [];

        candidates.forEach((candidate, idx) => {
            const position = new window.naver.maps.LatLng(candidate.latitude, candidate.longitude);
            const marker = new window.naver.maps.Marker({
                position,
                map: mapInstance.current,
                title: candidate.name || `Candidate ${idx + 1}`,
            });

            const infoWindow = new window.naver.maps.InfoWindow({
                content: `
                    <div style="padding:10px;min-width:180px;">
                        <div style="font-weight:700;font-size:13px;">Candidate ${idx + 1}: ${candidate.name || "Midpoint"}</div>
                        <div style="font-size:11px;color:#64748b;margin-top:4px;">${candidate.address || "Address unavailable"}</div>
                    </div>
                `,
            });

            window.naver.maps.Event.addListener(marker, "click", () => {
                infoWindow.open(mapInstance.current, marker);
                setSelectedCandidateIndex(idx);
            });

            markers.current.push(marker);
            markerEntries.current.push({ marker, infoWindow });
            bounds.extend(position);
        });

        if (!bounds.isEmpty()) {
            mapInstance.current.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
            setSelectedCandidateIndex(0);
            setTimeout(() => focusCandidate(0), 120);
        }
    };

    const handleOptimize = async (e) => {
        e.preventDefault();
        const validAddresses = addresses.map((v) => v.trim()).filter(Boolean);

        if (validAddresses.length < 2) {
            toast.error("At least 2 addresses are required.");
            return;
        }

        setLoading(true);
        try {
            const response = await api.post("/api/optimizer/optimize", validAddresses);
            const data = response.data?.data || response.data;
            setResult(data);
            setSelectedCandidateIndex(0);
            setTimeout(() => renderMarkers(data), 100);
            toast.success("Optimization complete.");
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to optimize meeting point.");
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
                        <h1 className="text-3xl font-black tracking-tight">Meeting Optimizer</h1>
                        <p className="text-slate-400 text-sm">Top 3 candidates by real travel time</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-4 space-y-6">
                    <div className="card p-6 bg-white border-2 border-slate-100 shadow-xl rounded-[2rem]">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                <Users className="h-5 w-5 text-primary-600" />
                                Participant Origins
                            </h3>
                            <button type="button" onClick={addAddress} className="p-2 bg-primary-50 text-primary-600 rounded-xl hover:bg-primary-100">
                                <Plus className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleOptimize} className="space-y-3">
                            {addresses.map((addr, idx) => (
                                <div key={`addr-${idx}`} className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={addr}
                                        readOnly
                                        onClick={() => handleDaumPostcode(idx)}
                                        placeholder={`Participant ${idx + 1} address`}
                                        className="w-full cursor-pointer px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl"
                                    />
                                    <button type="button" onClick={() => handleMyLocation(idx)} className="p-2 text-slate-500 hover:text-primary-600" title="Use current location">
                                        <Navigation className="h-4 w-4" />
                                    </button>
                                    <button type="button" onClick={() => removeAddress(idx)} className="p-2 text-slate-400 hover:text-red-500" title="Remove">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}

                            <button
                                type="submit"
                                disabled={loading || loadingPostcodeIndex !== null}
                                className="w-full mt-4 py-3 bg-primary-600 text-white rounded-xl font-bold disabled:opacity-60"
                            >
                                {loading ? "Optimizing..." : "Find Midpoint"}
                            </button>
                        </form>
                    </div>
                </div>

                <div className="lg:col-span-8 space-y-6">
                    <div className="card bg-slate-900 rounded-[2rem] overflow-hidden relative h-[520px]">
                        {mapsError && (
                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/95 text-center p-8">
                                <AlertCircle className="h-9 w-9 text-red-400 mb-2" />
                                <div className="text-white font-bold">Map SDK load failed</div>
                            </div>
                        )}
                        {!isLoaded && !mapsError && (
                            <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/95">
                                <LoadingSpinner text="Loading map..." />
                            </div>
                        )}
                        <div ref={mapRef} className="w-full h-full" />
                    </div>

                    {result ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="card p-6 bg-white border-2 border-slate-100 rounded-[2rem] shadow-xl">
                                <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    Top 3 Candidates
                                </h3>
                                <div className="space-y-2 mb-4">
                                    {(result.candidates || []).slice(0, 3).map((candidate, idx) => (
                                        <button
                                            key={`${candidate.latitude}-${candidate.longitude}-${idx}`}
                                            type="button"
                                            onClick={() => focusCandidate(idx)}
                                            className={`w-full text-left p-3 rounded-xl border transition-all ${selectedCandidateIndex === idx ? "bg-primary-50 border-primary-500" : "bg-slate-50 border-slate-200 hover:bg-white"}`}
                                        >
                                            <div className="text-xs font-black text-primary-600">Candidate {idx + 1}</div>
                                            <div className="text-sm font-bold text-slate-900">{candidate.name || "Midpoint"}</div>
                                            <div className="text-xs text-slate-600 mt-1">{candidate.address || "Address unavailable"}</div>
                                        </button>
                                    ))}
                                </div>

                                <div className="p-4 bg-slate-50 rounded-xl text-sm text-slate-700 font-medium">
                                    {result.recommended_reason}
                                </div>

                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <div className="text-[11px] text-slate-500 font-bold">Avg travel</div>
                                        <div className="text-xl font-black text-slate-900 flex items-center gap-1">
                                            <Clock className="h-4 w-4" />
                                            {result.avg_travel_time} min
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-slate-500 font-bold">Std dev</div>
                                        <div className="text-xl font-black text-primary-600">±{result.travel_time_std_dev} min</div>
                                    </div>
                                </div>
                            </div>

                            <div className="card p-6 bg-white border-2 border-slate-100 rounded-[2rem] shadow-xl overflow-hidden">
                                <h3 className="text-lg font-black text-slate-900 mb-4">Per-user Travel Time</h3>
                                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
                                    {result.user_results?.map((user, idx) => (
                                        <div key={`user-${idx}`} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                                            <div className="flex items-center justify-between gap-2">
                                                <div>
                                                    <div className="font-bold text-slate-900">{user.name}</div>
                                                    <div className="text-xs text-slate-500">{user.summary}</div>
                                                </div>
                                                <div className="font-black text-slate-900">{user.travel_time} min</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="card p-12 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center text-center">
                            <div className="p-5 bg-white rounded-2xl shadow-sm mb-4">
                                <MapIcon className="h-10 w-10 text-slate-300" />
                            </div>
                            <h4 className="text-xl font-black text-slate-500">No optimization result yet</h4>
                            <p className="text-sm text-slate-400 mt-2">Click address input boxes, pick addresses, then run optimization.</p>
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