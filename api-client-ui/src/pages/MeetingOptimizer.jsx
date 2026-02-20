import { useState, useEffect, useRef } from "react";
import { 
    MapPin, 
    Plus, 
    X, 
    Navigation, 
    Search, 
    Trophy, 
    Users, 
    Clock, 
    ChevronRight,
    Map as MapIcon,
    AlertCircle,
    Info,
    CheckCircle2
} from "lucide-react";
import api from "../utils/api";
import toast from "react-hot-toast";
import { LoadingSpinner } from "../components/LoadingSpinner";

// Naver Maps SDK 로드 체크 유틸리티 (프론트엔드에서 지도 렌더링을 위해 필요함)
const useNaverMaps = () => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        // 1. 이미 네이버 지도 객체가 윈도우에 존재하는지 확인 (SDK 로드 완료 시 생성됨)
        if (window.naver && window.naver.maps) {
            setIsLoaded(true);
            return;
        }

        // 2. index.html에 추가된 스크립트 엘리먼트를 찾아 상태 변화를 감지함
        const sdkScript = document.getElementById('naver-maps-sdk');
        if (sdkScript) {
            const handleLoad = () => setIsLoaded(true);
            const handleError = () => setError(true);

            sdkScript.addEventListener('load', handleLoad);
            sdkScript.addEventListener('error', handleError);

            // SDK가 이미 로드되었는데 이벤트 리스너 추가 전일 경우를 대비해 한 번 더 체크
            if (window.naver && window.naver.maps) setIsLoaded(true);

            return () => {
                sdkScript.removeEventListener('load', handleLoad);
                sdkScript.removeEventListener('error', handleError);
            };
        } else {
            // SDK 스크립트 자체가 누락된 경우 에러 발생
            console.error("Naver Maps SDK 스크립트 태그가 index.html에 존재하지 않습니다.");
            setError(true);
        }
    }, []);

    return { isLoaded, error };
};

export const MeetingOptimizer = () => {
    const [addresses, setAddresses] = useState(["", ""]);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markers = useRef([]);
    const { isLoaded, error: mapsError } = useNaverMaps();

    // ── 주사위 추가/삭제 ──────────────────────────────────────────
    const addAddress = () => setAddresses([...addresses, ""]);
    const removeAddress = (index) => {
        if (addresses.length <= 2) {
            toast.error("최소 2개의 지점이 필요합니다.");
            return;
        }
        setAddresses(addresses.filter((_, i) => i !== index));
    };
    const updateAddress = (index, value) => {
        const newAddrs = [...addresses];
        newAddrs[index] = value;
        setAddresses(newAddrs);
    };

    // ── 내 위치 가져오기 (Geolocation) ───────────────────────────
    const handleMyLocation = (index) => {
        if (!navigator.geolocation) {
            toast.error("이 브라우저에서는 위치 정보를 지원하지 않습니다.");
            return;
        }

        const toastId = toast.loading("현재 위치를 파악 중...");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const latlng = new window.naver.maps.LatLng(latitude, longitude);

                // 좌표를 주소로 변환 (Reverse Geocoding)
                window.naver.maps.Service.reverseGeocode({
                    coords: latlng,
                    orders: [
                        window.naver.maps.Service.OrderType.ADDR,
                        window.naver.maps.Service.OrderType.ROAD_ADDR
                    ].join(',')
                }, (status, response) => {
                    toast.dismiss(toastId);
                    if (status !== window.naver.maps.Service.Status.OK) {
                        toast.error("주소 변환에 실패했습니다.");
                        return;
                    }
                    const address = response.v2.address.jibunAddress || response.v2.address.roadAddress;
                    updateAddress(index, address);
                    toast.success("현재 위치가 설정되었습니다.");
                    
                    // 지도 중심 이동 및 임시 마커 표시
                    mapInstance.current.setCenter(latlng);
                    new window.naver.maps.Marker({ position: latlng, map: mapInstance.current, animation: 2 });
                });
            },
            () => {
                toast.dismiss(toastId);
                toast.error("위치 정보 접근 권한이 거부되었습니다.");
            }
        );
    };

    // ── 주소 검색 (Geocoding) ────────────────────────────────────
    const handleSearchAddress = (index) => {
        const query = addresses[index];
        if (!query || query.trim().length < 2) {
            toast.error("검색어를 2글자 이상 입력해주세요.");
            return;
        }

        window.naver.maps.Service.geocode({ query }, (status, response) => {
            if (status !== window.naver.maps.Service.Status.OK || response.v2.addresses.length === 0) {
                toast.error("검색 결과가 없습니다.");
                return;
            }

            const item = response.v2.addresses[0];
            const address = item.jibunAddress || item.roadAddress;
            const latlng = new window.naver.maps.LatLng(item.y, item.x);

            updateAddress(index, address);
            mapInstance.current.setCenter(latlng);
            mapInstance.current.setZoom(15);
            
            new window.naver.maps.Marker({ position: latlng, map: mapInstance.current, animation: 1 });
            toast.success(`검색 완료: ${address}`);
        });
    };

    // ── 지도 초기화 ──────────────────────────────────────────────
    useEffect(() => {
        if (isLoaded && mapRef.current && !mapInstance.current) {
            console.log("[Map] SDK 로드됨, 초기화 시작");
            try {
                mapInstance.current = new window.naver.maps.Map(mapRef.current, {
                    center: new window.naver.maps.LatLng(37.5665, 126.9780), // 서울 중심
                    zoom: 12,
                    zoomControl: true,
                    mapTypeControl: true,
                });

                // 지도 클릭 시 해당 위치 주소 가져오기
                window.naver.maps.Event.addListener(mapInstance.current, 'click', (e) => {
                    window.naver.maps.Service.reverseGeocode({
                        coords: e.coord,
                    }, (status, response) => {
                        if (status === window.naver.maps.Service.Status.OK) {
                            const address = response.v2.address.jibunAddress || response.v2.address.roadAddress;
                            // 비어있는 입력창을 찾아 주소 입력
                            setAddresses(prev => {
                                const newAddrs = [...prev];
                                const emptyIdx = newAddrs.findIndex(a => !a.trim());
                                if (emptyIdx !== -1) {
                                    newAddrs[emptyIdx] = address;
                                    toast.success("클릭한 위치가 입력되었습니다.");
                                } else {
                                    toast.error("모든 입력창이 채워져 있습니다.");
                                }
                                return newAddrs;
                            });
                        }
                    });
                });

                console.log("[Map] 지도 객체 생성 완료");
            } catch (err) {
                console.error("[Map] 초기화 중 에러:", err);
            }
        }
    }, [isLoaded]);

    // ── 마커 초기화 및 렌더링 ─────────────────────────────────────
    const renderMarkers = (data) => {
        if (!window.naver || !mapInstance.current) return;

        // 기존 마커 제거
        markers.current.forEach(m => m.setMap(null));
        markers.current = [];

        const bounds = new window.naver.maps.LatLngBounds();

        // 1. 추천 장소 (금색 핀)
        if (data.candidates && data.candidates.length > 0) {
            data.candidates.forEach((cand, idx) => {
                const position = new window.naver.maps.LatLng(cand.latitude, cand.longitude);
                const marker = new window.naver.maps.Marker({
                    position,
                    map: mapInstance.current,
                    title: cand.name,
                    icon: {
                        content: `
                            <div class="relative group">
                                <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-1 bg-black/20 rounded-full blur-[2px]"></div>
                                <div class="bg-amber-500 text-white p-2 rounded-xl shadow-lg border-2 border-white flex items-center gap-1 animate-bounce">
                                    <span class="text-xs font-black">추천 ${idx + 1}</span>
                                </div>
                            </div>
                        `,
                        anchor: new window.naver.maps.Point(15, 30)
                    }
                });
                markers.current.push(marker);
                bounds.extend(position);

                // 정보창
                const infoWindow = new window.naver.maps.InfoWindow({
                    content: `
                        <div class="p-3 min-w-[150px]">
                            <h4 class="font-bold text-slate-900">${cand.name}</h4>
                            <p class="text-[10px] text-slate-500 mt-0.5">${cand.address}</p>
                        </div>
                    `
                });
                window.naver.maps.Event.addListener(marker, "click", () => {
                    infoWindow.open(mapInstance.current, marker);
                });
            });
        }

        // 지도 영역 조정
        mapInstance.current.panToBounds(bounds);
    };

    // ── 최적지 계산 요청 ──────────────────────────────────────────
    const handleOptimize = async (e) => {
        e.preventDefault();
        const validAddresses = addresses.filter(a => a.trim().length > 0);
        if (validAddresses.length < 2) {
            toast.error("최소 2개 이상의 주소를 입력해주세요.");
            return;
        }

        setLoading(true);
        try {
            // API 호출: POST /api/optimizer/optimize
            const response = await api.post("/api/optimizer/optimize", validAddresses);
            const data = response.data?.data || response.data;
            
            setResult(data);
            toast.success("최적의 중간 장소를 찾았습니다!");
            
            // 지도 마커 렌더링 (비동기 처리 고려하여 약간의 지연)
            setTimeout(() => renderMarkers(data), 100);
        } catch (error) {
            console.error("Optimization failed:", error);
            toast.error(error.response?.data?.message || "장소 최적화 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* 상단 헤더 */}
            <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-8 text-white shadow-2xl border border-white/5">
                <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary-500/20 to-transparent pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-primary-600 rounded-3xl shadow-[0_0_30px_rgba(37,99,235,0.4)]">
                            <MapPin className="h-10 w-10 text-white" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black tracking-tighter italic uppercase">Middle Spot</h1>
                            <p className="text-slate-400 font-bold tracking-widest text-[10px] uppercase mt-1">Advanced Meeting Point Optimizer</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 bg-white/5 px-6 py-4 rounded-2xl backdrop-blur-sm border border-white/10">
                        <div className="text-right">
                            <span className="block text-[10px] text-slate-500 font-black uppercase tracking-wider mb-0.5">Engine Status</span>
                            <span className="flex items-center gap-1.5 text-green-400 font-bold text-sm">
                                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                                Operational
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* 왼쪽: 입력 폼 */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="card p-6 bg-white border-2 border-slate-100 shadow-xl rounded-[2rem]">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 italic tracking-tight">
                                <Users className="h-5 w-5 text-primary-600" />
                                참여자 위치 입력
                            </h3>
                            <button 
                                onClick={addAddress}
                                className="p-2 bg-primary-50 text-primary-600 rounded-xl hover:bg-primary-100 transition-all shadow-sm"
                            >
                                <Plus className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleOptimize} className="space-y-4">
                            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {addresses.map((addr, idx) => (
                                    <div key={idx} className="group animate-slide-up">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 relative">
                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 bg-slate-100 rounded-lg text-[10px] font-black text-slate-500 group-focus-within:bg-primary-600 group-focus-within:text-white transition-all">
                                                    {idx + 1}
                                                </div>
                                                <input 
                                                    type="text" 
                                                    value={addr}
                                                    onChange={(e) => updateAddress(idx, e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleSearchAddress(idx)}
                                                    placeholder="주소를 입력하거나 검색하세요"
                                                    className="w-full pl-12 pr-24 py-3.5 bg-slate-50 border-2 border-transparent focus:border-primary-500 focus:bg-white rounded-2xl text-sm font-medium transition-all"
                                                />
                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleMyLocation(idx)}
                                                        title="내 위치"
                                                        className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                                                    >
                                                        <Navigation className="h-4 w-4" />
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleSearchAddress(idx)}
                                                        title="검색"
                                                        className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                                                    >
                                                        <Search className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            <button 
                                                type="button"
                                                onClick={() => removeAddress(idx)}
                                                className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                            >
                                                <X className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button 
                                type="submit" 
                                disabled={loading}
                                className="w-full mt-6 py-4 bg-primary-600 text-white rounded-2xl font-black text-lg shadow-[0_8px_0_rgb(29,78,216)] active:translate-y-1 active:shadow-[0_4px_0_rgb(29,78,216)] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        최적지 계산 중...
                                    </>
                                ) : (
                                    <>
                                        <Navigation className="h-5 w-5" />
                                        중간 장소 찾기
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    {/* 도움말 카드 */}
                    <div className="card p-6 bg-amber-50 border-2 border-amber-100 rounded-[2rem]">
                        <div className="flex gap-4">
                            <div className="p-3 bg-white rounded-2xl shadow-sm h-fit">
                                <Info className="h-6 w-6 text-amber-500" />
                            </div>
                            <div className="space-y-2">
                                <h4 className="font-black text-amber-900 text-sm italic tracking-tight uppercase">How it works</h4>
                                <p className="text-xs text-amber-700 leading-relaxed font-medium">
                                    입력하신 모든 참여자의 출발지로부터 실제 대중교통 및 자동차 이동 시간을 분석합니다. 단순히 거리가 아닌 **'이동 시간의 편차'**를 최소화하여 모두가 공평하게 모일 수 있는 장소를 추천합니다.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 오른쪽: 지도 및 리포트 */}
                <div className="lg:col-span-8 space-y-6">
                    {/* 지도 영역 */}
                    <div className="card bg-slate-900 border-[8px] border-slate-800 rounded-[3rem] shadow-2xl relative overflow-hidden aspect-video lg:aspect-auto lg:h-[600px]">
                        {mapsError && (
                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/90 text-center p-8">
                                <div className="p-4 bg-red-500/20 rounded-full mb-4">
                                    <AlertCircle className="h-10 w-10 text-red-500" />
                                </div>
                                <h4 className="text-white font-black text-xl mb-2">지도 엔진 로드 실패</h4>
                                <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
                                    Naver Maps SDK를 불러올 수 없습니다. Client ID 설정을 확인하시거나 관리자에게 문의하세요.
                                </p>
                            </div>
                        )}
                        {!isLoaded && !mapsError && (
                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/90">
                                <LoadingSpinner text="지도 데이터를 불러오는 중..." />
                            </div>
                        )}
                        <div ref={mapRef} className="w-full h-full min-h-[450px] relative z-10 bg-slate-800" />
                        
                        {/* 지도 위 플로팅 레이어 (결과 있을 때) */}
                        {result && (
                            <div className="absolute top-6 left-6 z-30 animate-slide-in-left pointer-events-none hidden sm:block">
                                <div className="bg-white/95 backdrop-blur px-6 py-4 rounded-[1.5rem] shadow-2xl border border-white flex items-center gap-4">
                                    <div className="p-3 bg-primary-600 rounded-2xl shadow-lg">
                                        <Trophy className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                        <span className="block text-[9px] text-slate-500 font-black uppercase tracking-widest">Efficiency Score</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl font-black text-slate-900 italic tracking-tighter">
                                                {Math.round(100 - result.travel_time_std_dev)}%
                                            </span>
                                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[9px] font-black rounded-full uppercase tracking-tighter">Perfect!</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 리포트 대시보드 */}
                    {result && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up">
                            <div className="card p-8 bg-white border-2 border-slate-100 rounded-[2.5rem] shadow-xl">
                                <h3 className="text-xl font-black text-slate-900 italic mb-6 flex items-center gap-3">
                                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                                    추천 결과 리포트
                                </h3>
                                <div className="space-y-6">
                                    {/* ── 중간 지점 상세 주소 표시 섹션 ── */}
                                    {result.candidates && result.candidates[0] && (
                                        <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100">
                                            <span className="block text-[10px] text-amber-600 font-black uppercase tracking-widest mb-2">Final Destination</span>
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <h4 className="text-lg font-black text-slate-900 mb-1 leading-tight">
                                                        {result.candidates[0].name}
                                                    </h4>
                                                    <p className="text-sm text-slate-600 font-medium leading-relaxed">
                                                        {result.candidates[0].address}
                                                    </p>
                                                </div>
                                                <button 
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(result.candidates[0].address);
                                                        toast.success("주소가 복사되었습니다.");
                                                    }}
                                                    className="p-2 bg-white text-slate-400 hover:text-primary-600 rounded-xl shadow-sm transition-all shrink-0"
                                                    title="주소 복사"
                                                >
                                                    <Plus className="h-4 w-4 rotate-45" /> {/* 복사 아이콘 대용 (X/Plus 조합) */}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="p-5 bg-primary-50 rounded-2xl border border-primary-100">
                                        <p className="text-sm text-primary-900 font-bold leading-relaxed italic">
                                            "{result.recommended_reason}"
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">평균 이동시간</span>
                                            <div className="text-2xl font-black text-slate-900 tracking-tighter flex items-center gap-1.5 italic">
                                                <Clock className="h-5 w-5 text-slate-400" />
                                                {result.avg_travel_time}분
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">공정성 편차</span>
                                            <div className="text-2xl font-black text-primary-600 tracking-tighter italic">
                                                ±{result.travel_time_std_dev}분
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="card p-8 bg-white border-2 border-slate-100 rounded-[2.5rem] shadow-xl overflow-hidden">
                                <h3 className="text-xl font-black text-slate-900 italic mb-6">참여자별 이동 시간</h3>
                                <div className="space-y-4 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                                    {result.user_results?.map((user, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl group hover:bg-slate-100 transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center font-black text-slate-400 text-sm group-hover:bg-primary-600 group-hover:text-white transition-all">
                                                    {idx + 1}
                                                </div>
                                                <div>
                                                    <span className="block font-black text-slate-900 text-sm italic tracking-tight">{user.name}</span>
                                                    <span className="block text-[10px] text-slate-400 font-bold truncate max-w-[150px]">{user.summary}</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-lg font-black text-slate-900 italic tracking-tighter">{user.travel_time}분</span>
                                                <div className="h-1.5 w-20 bg-slate-200 rounded-full mt-1 overflow-hidden">
                                                    <div 
                                                        className="h-full bg-primary-500 rounded-full" 
                                                        style={{ width: `${Math.min(100, (user.travel_time / result.avg_travel_time) * 50)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {!result && (
                        <div className="card p-12 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[3.5rem] flex flex-col items-center justify-center text-center opacity-60">
                            <div className="p-6 bg-white rounded-3xl shadow-sm mb-6">
                                <MapIcon className="h-12 w-12 text-slate-300" />
                            </div>
                            <h4 className="text-xl font-black text-slate-400 italic mb-2 tracking-tight uppercase">No Data Analyzed</h4>
                            <p className="text-sm text-slate-400 max-w-xs font-medium">
                                왼쪽의 입력 폼에 주소를 입력하고 '찾기' 버튼을 눌러보세요. 최적의 중간 지점이 이곳에 나타납니다.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
            `}</style>
        </div>
    );
};
