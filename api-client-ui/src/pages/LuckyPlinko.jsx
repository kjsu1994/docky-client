import { useState, useEffect, useRef, useCallback } from "react";
if (typeof global === 'undefined') { window.global = window; }
import { 
    Dices, Trophy, Play, RefreshCcw, Coins, Info, Award, Lock, Unlock, AlertCircle, TrendingUp
} from "lucide-react";
import api from "../utils/api";
import toast from "react-hot-toast";
import { formatNumber } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";

// ── 주사위 눈 컴포넌트 ──────────────────────────────────────────
const DiceFace = ({ value }) => {
    const dots = {
        1: [4],
        2: [0, 8],
        3: [0, 4, 8],
        4: [0, 2, 6, 8],
        5: [0, 2, 4, 6, 8],
        6: [0, 2, 3, 5, 6, 8]
    };
    return (
        <div className="relative w-full h-full bg-white rounded-xl shadow-inner grid grid-cols-3 grid-rows-3 p-2 gap-1 border-2 border-slate-200">
            {[...Array(9)].map((_, i) => (
                <div key={i} className="flex items-center justify-center">
                    {dots[value]?.includes(i) && (
                        <div className="w-full h-full max-w-[12px] max-h-[12px] bg-slate-800 rounded-full shadow-sm" />
                    )}
                </div>
            ))}
        </div>
    );
};

// ── 3D 주사위 ──────────────────────────────────────────
const ThreeDDice = ({ value, rolling, isHeld, onClick, index }) => {
    const [rotation, setRotation] = useState({ x: 0, y: 0 });
    useEffect(() => {
        if (rolling) {
            const interval = setInterval(() => {
                setRotation({ x: Math.floor(Math.random() * 360), y: Math.floor(Math.random() * 360) });
            }, 100);
            return () => clearInterval(interval);
        } else {
            const angles = { 1: { x: 0, y: 0 }, 2: { x: 0, y: 180 }, 3: { x: 0, y: -90 }, 4: { x: 0, y: 90 }, 5: { x: -90, y: 0 }, 6: { x: 90, y: 0 } };
            setRotation(angles[value] || { x: 0, y: 0 });
        }
    }, [rolling, value]);

    return (
        <div onClick={() => onClick(index)} className={`dice-scene w-20 h-20 sm:w-24 sm:h-24 perspective-1000 transition-all duration-500 ${!rolling && !isHeld ? 'hover:-translate-y-2' : ''} ${isHeld ? 'scale-110' : ''}`}>
            <div className="dice-cube relative w-full h-full preserve-3d transition-transform duration-500" style={{ transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)` }}>
                <div className="dice-side front absolute w-full h-full translate-z-12"><DiceFace value={1} /></div>
                <div className="dice-side back absolute w-full h-full rotate-y-180 translate-z-12"><DiceFace value={2} /></div>
                <div className="dice-side left absolute w-full h-full rotate-y--90 translate-z-12"><DiceFace value={3} /></div>
                <div className="dice-side right absolute w-full h-full rotate-y-90 translate-z-12"><DiceFace value={4} /></div>
                <div className="dice-side top absolute w-full h-full rotate-x-90 translate-z-12"><DiceFace value={5} /></div>
                <div className="dice-side bottom absolute w-full h-full rotate-x--90 translate-z-12"><DiceFace value={6} /></div>
            </div>
            {isHeld && <div className="absolute -top-3 -right-3 z-50 bg-amber-500 text-white p-1.5 rounded-full shadow-lg border-2 border-white animate-bounce"><Lock className="h-4 w-4" /></div>}
        </div>
    );
};

// ── 플링코 구슬 단품 컴포넌트 ────────────────────────────────────────
const PlinkoMarble = ({ targetSlot, onFinish }) => {
    const path = useRef([...Array(9)].map((_, i) => {
        if (i === 0) return 0;
        if (i === 8) return (targetSlot - 3.5) * 60;
        const progress = i / 8;
        const targetX = (targetSlot - 3.5) * 60;
        return (targetX * progress) + (Math.random() * 40 - 20);
    })).current;

    return (
        <div className="marble-container absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none">
            <div className="marble-ball" style={{ '--path-0': `${path[0]}px`, '--path-1': `${path[1]}px`, '--path-2': `${path[2]}px`, '--path-3': `${path[3]}px`, '--path-4': `${path[4]}px`, '--path-5': `${path[5]}px`, '--path-6': `${path[6]}px`, '--path-7': `${path[7]}px`, '--path-8': `${path[8]}px` }} onAnimationEnd={onFinish} />
        </div>
    );
};

// ── 메인 게임 페이지 ────────────────────────────────────────────
const ROLL_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2004/2004-preview.mp3";

export const LuckyPlinko = () => {
    const { user } = useAuth();
    const [step, setStep] = useState(1);
    const [dice, setDice] = useState([1, 2, 3, 4, 5]);
    const [heldIndices, setHeldIndices] = useState([]);
    const [rolling, setRolling] = useState(false);
    const [gameResult, setGameResult] = useState(null);
    const [plinkoResult, setPlinkoResult] = useState(null);
    const [marbles, setMarbles] = useState(0);
    const [animatingMarbles, setAnimatingMarbles] = useState([]);
    const [activeSlot, setActiveSlot] = useState(null);
    
    const audioRef = useRef(new Audio(ROLL_SOUND_URL));

    const rollDice = async () => {
        if (rolling) return;
        setRolling(true);
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
        try {
            const response = await api.post("/game/dice/roll");
            const data = response.data?.data || response.data;
            
            // snake_case 지원 정규화
            const normalized = {
                ...data,
                rankName: data.rank_name || data.rankName || "NONE"
            };

            setTimeout(() => {
                setDice(data.dice); setGameResult(normalized); setMarbles(data.marbles); setRolling(false); setStep(2);
                if (data.marbles > 0) toast.success(`${normalized.rankName}! 행운의 구슬을 획득했습니다!`);
            }, 1500);
        } catch (error) { setRolling(false); toast.error("주사위를 굴릴 수 없습니다."); }
    };

    const rerollDice = async () => {
        if (rolling || heldIndices.length < 1 || heldIndices.length > 4) return;
        setRolling(true);
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
        try {
            const response = await api.post("/game/dice/reroll", heldIndices);
            const data = response.data?.data || response.data;
            
            // snake_case 지원 정규화
            const normalized = {
                ...data,
                rankName: data.rank_name || data.rankName || "NONE"
            };

            setTimeout(() => {
                setDice(data.dice); setGameResult(normalized); setMarbles(data.marbles); setRolling(false); setStep(3);
                toast.success(`최종 결과: ${normalized.rankName}! 구슬 ${data.marbles}개 확정!`);
            }, 1500);
        } catch (error) { setRolling(false); toast.error("재굴림 실패"); }
    };

    const playPlinko = async () => {
        if (marbles <= 0) return;
        try {
            const response = await api.post("/game/plinko/play");
            const data = response.data?.data || response.data;
            
            // snake_case 지원 정규화
            const normalizedData = {
                ...data,
                landingSlots: data.landing_slots || data.landingSlots || [],
                earnedPoint: data.earned_point !== undefined ? data.earned_point : data.earnedPoint,
                totalPoint: data.total_point !== undefined ? data.total_point : data.totalPoint
            };

            setPlinkoResult(normalizedData);
            setStep(4);
            
            const slots = normalizedData.landingSlots;
            const earnedPoint = normalizedData.earnedPoint || 0;
            
            slots.forEach((slot, i) => {
                setTimeout(() => {
                    const newMarble = { id: `m-${Date.now()}-${i}`, slot };
                    setAnimatingMarbles(prev => [...prev, newMarble]);
                }, i * 600);
            });

            setTimeout(() => {
                toast.success(`🎉 축하합니다! ${formatNumber(earnedPoint)} 포인트를 획득했습니다!`);
            }, (slots.length * 600) + 3500);
        } catch (error) { toast.error("플링코 실행 실패"); }
    };

    const toggleHold = (idx) => {
        if (step !== 2 || rolling) return;
        setHeldIndices(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
    };

    const resetGame = () => {
        setStep(1); setDice([1, 2, 3, 4, 5]); setHeldIndices([]); setGameResult(null); setPlinkoResult(null); setMarbles(0); setAnimatingMarbles([]); setActiveSlot(null);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20 select-none text-slate-900">
            {/* 상단 헤더 */}
            <div className="card bg-slate-900 p-8 border-4 border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.3)] rounded-[3rem] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30" />
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8 text-center md:text-left">
                    <div>
                        <div className="flex items-center justify-center md:justify-start gap-4 mb-2">
                            <div className="p-3 bg-amber-500 rounded-2xl shadow-lg">
                                <TrendingUp className="h-8 w-8 text-slate-900" />
                            </div>
                            <h1 className="text-5xl font-black text-amber-500 tracking-tighter italic uppercase">Lucky Plinko</h1>
                        </div>
                        <p className="text-slate-400 font-bold tracking-widest text-sm uppercase">Spin the Dice, Drop the Marbles</p>
                    </div>
                    <div className="flex flex-col items-center gap-2 bg-slate-800 p-6 rounded-3xl border-2 border-slate-700 shadow-inner min-w-[220px]">
                        <span className="text-[10px] text-amber-500 font-black tracking-widest uppercase">My Points</span>
                        <div className="text-4xl font-black text-white flex items-center gap-3">
                            <Coins className="h-8 w-8 text-amber-400" />
                            {formatNumber(plinkoResult?.totalPoint || user?.point || 0)}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* 주사위 트레이 영역 */}
                <div className="lg:col-span-5">
                    <div className="card bg-indigo-950 p-10 h-full flex flex-col rounded-[3rem] border-4 border-indigo-800 shadow-2xl relative">
                        <h3 className="text-2xl font-black text-white italic tracking-tighter mb-8">DICE TRAY</h3>
                        <div className="flex-1 flex flex-col justify-center items-center gap-12 bg-indigo-900/30 rounded-[2rem] p-8 shadow-inner border border-white/5 relative z-10">
                            <div className="flex flex-wrap justify-center gap-6 perspective-1000">
                                {dice.map((val, idx) => (
                                    <ThreeDDice 
                                        key={idx} index={idx} value={val} 
                                        rolling={rolling && !heldIndices.includes(idx)} 
                                        isHeld={heldIndices.includes(idx)} 
                                        onClick={toggleHold} 
                                    />
                                ))}
                            </div>

                            {gameResult && (
                                <div className="text-center animate-slide-up bg-white/5 w-full py-6 rounded-3xl border border-white/10 shadow-lg">
                                    <div className="text-4xl font-black text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)] mb-1 uppercase italic tracking-tighter">
                                        {gameResult.rankName}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mb-2">Acquired Marbles</div>
                                    <div className="text-6xl font-black text-white tabular-nums">{marbles}</div>
                                </div>
                            )}
                        </div>

                        <div className="mt-8 space-y-4 relative z-10">
                            {step === 1 && (
                                <button onClick={rollDice} disabled={rolling}
                                    className="w-full py-6 rounded-2xl bg-amber-500 text-slate-900 font-black text-2xl shadow-[0_8px_0_rgb(180,120,0)] hover:translate-y-1 hover:shadow-[0_4px_0_rgb(180,120,0)] transition-all">
                                    {rolling ? 'ROLLING...' : 'ROLL DICE (100P)'}
                                </button>
                            )}
                            {step === 2 && (
                                <div className="flex flex-col gap-4">
                                    <button onClick={rerollDice} disabled={rolling || heldIndices.length < 1 || heldIndices.length > 4}
                                        className="w-full py-5 rounded-2xl bg-amber-500 text-slate-900 font-black text-xl shadow-[0_6px_0_rgb(180,120,0)] disabled:opacity-50">
                                        {rolling ? 'REROLLING...' : 'REROLL SELECTED'}
                                    </button>
                                    <div className="flex gap-2">
                                        <button onClick={() => setStep(3)} className="flex-1 py-3 rounded-xl bg-indigo-800 text-white text-xs font-bold border border-indigo-600">KEEP RESULTS</button>
                                        {marbles > 0 && (
                                            <button onClick={playPlinko} className="flex-1 py-3 rounded-xl bg-orange-500 text-white text-xs font-bold shadow-lg animate-pulse">GO PLINKO!</button>
                                        )}
                                    </div>
                                </div>
                            )}
                            {(step === 3 || step === 4) && (
                                <button onClick={resetGame} disabled={animatingMarbles.length > 0}
                                    className="w-full py-6 rounded-2xl bg-slate-800 text-white font-black text-xl border border-white/10 shadow-lg">
                                    {animatingMarbles.length > 0 ? 'PLAYING...' : 'NEW GAME'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* 플링코 아케이드 영역 */}
                <div className="lg:col-span-7">
                    <div className="card bg-slate-900 p-10 rounded-[4rem] border-4 border-slate-800 shadow-2xl flex flex-col items-center relative overflow-hidden">
                        <div className="w-full flex justify-between items-center mb-10 relative z-10">
                            <h3 className="text-3xl font-black text-white italic tracking-tighter flex items-center gap-3">PLINKO BOARD</h3>
                            {step === 3 && marbles > 0 && (
                                <button onClick={playPlinko} className="bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 px-12 py-4 rounded-2xl font-black text-xl animate-bounce">
                                    PUSH START
                                </button>
                            )}
                        </div>

                        {/* 플링코 시뮬레이션 영역 */}
                        <div className="relative w-full aspect-[4/6.5] bg-slate-800/50 rounded-[3rem] border-4 border-slate-700 shadow-inner overflow-hidden">
                            {/* 상단 배출구 */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-14 bg-slate-700 rounded-b-3xl border-x-4 border-b-4 border-slate-600 z-40 flex items-center justify-center">
                                <div className="w-20 h-4 bg-black rounded-full shadow-[inset_0_2px_10px_rgba(255,255,255,0.1)]" />
                            </div>

                            {/* 핀 레이아웃 */}
                            <div className="absolute inset-0 flex flex-col justify-between py-32 px-12">
                                {[...Array(8)].map((_, row) => (
                                    <div key={row} className="flex justify-center gap-[12%]">
                                        {[...Array(row + 3)].map((_, col) => (
                                            <div key={col} className="w-2 h-2 bg-slate-500 rounded-full shadow-[0_0_5px_white]" />
                                        ))}
                                    </div>
                                ))}
                            </div>

                            {/* 구슬 애니메이션 */}
                            {animatingMarbles.map((marble) => (
                                <PlinkoMarble key={marble.id} targetSlot={marble.slot} onFinish={() => {
                                    setActiveSlot(marble.slot);
                                    setTimeout(() => setActiveSlot(null), 500);
                                    setAnimatingMarbles(prev => prev.filter(m => m.id !== marble.id));
                                }} />
                            ))}

                            {/* 하단 슬롯 */}
                            <div className="absolute bottom-8 left-8 right-8 h-24 flex gap-2">
                                {[30.0, 10.0, 5.0, 1.0, 1.0, 5.0, 10.0, 30.0].map((mult, idx) => (
                                    <div key={idx} className={`flex-1 rounded-2xl flex flex-col items-center justify-center border-t-4 transition-all duration-300 shadow-lg
                                        ${activeSlot === idx ? 'scale-110 -translate-y-2 brightness-150' : ''}
                                        ${mult >= 30 ? 'bg-amber-500/20 text-amber-400 border-amber-500 shadow-amber-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                                        <span className="text-[8px] font-black opacity-50 uppercase">Mult</span>
                                        <span className="text-xl font-black italic tracking-tighter">x{mult}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .perspective-1000 { perspective: 1000px; }
                .preserve-3d { transform-style: preserve-3d; }
                .translate-z-12 { transform: translateZ(48px); }
                .rotate-y-180 { transform: rotateY(180deg) translateZ(48px); }
                .rotate-y--90 { transform: rotateY(-90deg) translateZ(48px); }
                .rotate-y-90 { transform: rotateY(90deg) translateZ(48px); }
                .rotate-x-90 { transform: rotateX(90deg) translateZ(48px); }
                .rotate-x--90 { transform: rotateX(-90deg) translateZ(48px); }
                
                @keyframes plinko-fall {
                    0% { top: 30px; left: 50%; opacity: 0; }
                    5% { opacity: 1; }
                    12.5% { top: 80px; left: calc(50% + var(--path-1)); }
                    25% { top: 130px; left: calc(50% + var(--path-2)); }
                    37.5% { top: 180px; left: calc(50% + var(--path-3)); }
                    50% { top: 230px; left: calc(50% + var(--path-4)); }
                    62.5% { top: 280px; left: calc(50% + var(--path-5)); }
                    75% { top: 330px; left: calc(50% + var(--path-6)); }
                    87.5% { top: 380px; left: calc(50% + var(--path-7)); }
                    100% { top: 460px; left: calc(50% + var(--path-8)); opacity: 1; }
                }
                .marble-ball {
                    position: absolute;
                    width: 24px;
                    height: 24px;
                    background: radial-gradient(circle at 30% 30%, #fcd34d, #d97706);
                    border-radius: 50%;
                    box-shadow: 0 0 20px #fbbf24, inset -2px -2px 5px rgba(0,0,0,0.5);
                    z-index: 50;
                    animation: plinko-fall 3s cubic-bezier(0.4, 0, 0.6, 1) forwards;
                }
            `}</style>
        </div>
    );
};
