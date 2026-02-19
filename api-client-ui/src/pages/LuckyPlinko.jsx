import { useState, useEffect, useRef, useCallback } from "react";
if (typeof global === 'undefined') { window.global = window; }
import { 
    Dices, Trophy, Play, RefreshCcw, Coins, Info, Award, Lock, Unlock, AlertCircle, TrendingUp
} from "lucide-react";
import api from "../utils/api";
import toast from "react-hot-toast";
import { formatNumber } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";

// ── 사운드 효과 (차분한 '톡토로록' 소리로 교체) ───────────────────────────────────
const ROLL_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2004/2004-preview.mp3";
const SOFT_TAP_URL = "https://assets.mixkit.co/active_storage/sfx/1084/1084-preview.mp3"; // 짧고 가벼운 타격음

// ── 주사위 눈 ──────────────────────────────────────────
const DiceFace = ({ value }) => {
    const dots = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
    return (
        <div className="relative w-full h-full bg-white rounded-xl shadow-[inset_0_0_15px_rgba(0,0,0,0.1)] grid grid-cols-3 grid-rows-3 p-3 gap-1 border-2 border-slate-200">
            {[...Array(9)].map((_, i) => (
                <div key={i} className="flex items-center justify-center">
                    {dots[value]?.includes(i) && (
                        <div className="w-full h-full max-w-[14px] max-h-[14px] bg-slate-900 rounded-full shadow-inner" />
                    )}
                </div>
            ))}
        </div>
    );
};

// ── 3D 주사위 ──────────────────────────
const ThreeDDice = ({ value, rolling, isHeld, onClick, index }) => {
    const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 });
    const animConfig = useRef({ duration: "3.00s", delay: (index * 0.15).toFixed(2) + "s" }).current;

    useEffect(() => {
        if (rolling) {
            const interval = setInterval(() => {
                setRotation({ x: Math.random() * 1440 - 720, y: Math.random() * 1440 - 720, z: Math.random() * 360 });
            }, 500); 
            return () => clearInterval(interval);
        } else {
            const angles = { 1: { x: 0, y: 0, z: 0 }, 2: { x: 0, y: 180, z: 0 }, 3: { x: 0, y: -90, z: 0 }, 4: { x: 0, y: 90, z: 0 }, 5: { x: -90, y: 0, z: 0 }, 6: { x: 90, y: 0, z: 0 } };
            setRotation(angles[value] || { x: 0, y: 0, z: 0 });
        }
    }, [rolling, value]);

    return (
        <div onClick={() => onClick(index)} 
             className={`dice-scene w-24 h-24 sm:w-28 sm:h-28 perspective-1000 transition-all duration-700 ${!rolling && !isHeld ? 'hover:scale-110 cursor-pointer' : ''} ${isHeld ? 'scale-105 brightness-75' : ''}`}>
            <div className={`dice-cube relative w-full h-full preserve-3d will-change-transform ${rolling ? 'dice-rolling-slow' : 'dice-stopping-smooth'}`}
                 style={{ transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) rotateZ(${rotation.z}deg)`, animationDuration: rolling ? animConfig.duration : undefined, animationDelay: rolling ? animConfig.delay : undefined }}>
                <div className="dice-side front absolute w-full h-full translate-z-14"><DiceFace value={1} /></div>
                <div className="dice-side back absolute w-full h-full rotate-y-180 translate-z-14"><DiceFace value={2} /></div>
                <div className="dice-side left absolute w-full h-full rotate-y--90 translate-z-14"><DiceFace value={3} /></div>
                <div className="dice-side right absolute w-full h-full rotate-y-90 translate-z-14"><DiceFace value={4} /></div>
                <div className="dice-side top absolute w-full h-full rotate-x-90 translate-z-14"><DiceFace value={5} /></div>
                <div className="dice-side bottom absolute w-full h-full rotate-x--90 translate-z-14"><DiceFace value={6} /></div>
            </div>
            {isHeld && <div className="absolute -top-4 -right-4 z-50 bg-amber-500 text-white p-2 rounded-full shadow-2xl border-2 border-white animate-bounce"><Lock className="h-5 w-5" /></div>}
        </div>
    );
};

export const LuckyPlinko = () => {
    const { user } = useAuth();
    const [step, setStep] = useState(1);
    const [dice, setDice] = useState([1, 2, 3, 4, 5]);
    const [heldIndices, setHeldIndices] = useState([]);
    const [rolling, setRolling] = useState(false);
    const [gameResult, setGameResult] = useState(null);
    const [plinkoResult, setPlinkoResult] = useState(null);
    const [marbles, setMarbles] = useState(0);
    const [activeSlot, setActiveSlot] = useState(null);
    
    const canvasRef = useRef(null);
    const particlesRef = useRef([]);
    const animationFrameRef = useRef();
    const rollAudio = useRef(new Audio(ROLL_SOUND_URL));
    const tapAudio = useRef(new Audio(SOFT_TAP_URL));

    // ── 리얼 물리 엔진 (X좌표 일치 및 톡토로록 사운드) ──
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        const rows = 9;
        const pins = [];
        for (let r = 0; r < rows; r++) {
            const dotsInRow = r + 3;
            const startX = (width - (dotsInRow - 1) * (width / 10)) / 2;
            for (let c = 0; c < dotsInRow; c++) {
                pins.push({ x: startX + c * (width / 10), y: 150 + r * (height / 12) });
            }
        }

        const update = () => {
            const gravity = 0.35;
            const friction = 0.995;
            const bounciness = 0.7;

            particlesRef.current.forEach(p => {
                if (p.finished) return;

                p.vy += gravity; p.vx *= friction; p.x += p.vx; p.y += p.vy;

                if (p.x < 25 || p.x > width - 25) {
                    p.vx *= -bounciness; p.x = p.x < 25 ? 25 : width - 25;
                }

                pins.forEach(pin => {
                    const dx = p.x - pin.x; const dy = p.y - pin.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 16) { 
                        const angle = Math.atan2(dy, dx);
                        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy) * bounciness;
                        p.vx = Math.cos(angle) * speed;
                        p.vy = Math.sin(angle) * speed;
                        p.x = pin.x + Math.cos(angle) * 16;
                        p.y = pin.y + Math.sin(angle) * 16;

                        // 톡토로로록 느낌의 조용한 소리 연출
                        const s = tapAudio.current.cloneNode();
                        s.volume = Math.min(0.02, speed * 0.005);
                        s.playbackRate = 1.5 + Math.random() * 0.5;
                        s.play().catch(() => {});
                    }
                });

                // 정밀 유도 로직 (X좌표 일치)
                const targetX = (p.targetSlot + 0.5) * (width / 8);
                const progress = p.y / height;
                if (progress > 0.3) {
                    const attraction = (progress - 0.3) * 0.5;
                    p.vx += (targetX - p.x) * attraction * 0.15;
                }

                if (p.y > height - 70) {
                    p.finished = true;
                    setActiveSlot(p.targetSlot);
                    setTimeout(() => setActiveSlot(null), 600);
                }
            });

            ctx.clearRect(0, 0, width, height);
            pins.forEach(pin => {
                ctx.beginPath();
                const grad = ctx.createRadialGradient(pin.x - 1, pin.y - 1, 0, pin.x, pin.y, 4);
                grad.addColorStop(0, '#94a3b8'); grad.addColorStop(1, '#1e293b');
                ctx.fillStyle = grad;
                ctx.arc(pin.x, pin.y, 4, 0, Math.PI * 2); ctx.fill();
            });

            particlesRef.current.forEach(p => {
                if (p.finished) return;
                ctx.save();
                const grad = ctx.createRadialGradient(p.x - 4, p.y - 4, 2, p.x, p.y, 12);
                grad.addColorStop(0, '#fde68a'); grad.addColorStop(0.4, '#f59e0b'); grad.addColorStop(1, '#b45309');
                ctx.shadowBlur = 20; ctx.shadowColor = 'rgba(245, 158, 11, 0.5)';
                ctx.fillStyle = grad;
                ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            });

            animationFrameRef.current = requestAnimationFrame(update);
        };
        update();
        return () => cancelAnimationFrame(animationFrameRef.current);
    }, []);

    const rollDice = async () => {
        if (rolling) return;
        setRolling(true);
        rollAudio.current.currentTime = 0; rollAudio.current.play().catch(() => {});
        try {
            const response = await api.post("/game/dice/roll");
            const data = response.data?.data || response.data;
            const normalized = { ...data, rankName: data.rank_name || data.rankName || "NONE" };
            setTimeout(() => { setDice(data.dice); setGameResult(normalized); setMarbles(data.marbles); setRolling(false); setStep(2); }, 3000);
        } catch (error) { setRolling(false); toast.error("오류 발생"); }
    };

    const rerollDice = async () => {
        if (rolling || heldIndices.length < 1 || heldIndices.length > 4) return;
        setRolling(true);
        rollAudio.current.currentTime = 0; rollAudio.current.play().catch(() => {});
        try {
            const response = await api.post("/game/dice/reroll", heldIndices);
            const data = response.data?.data || response.data;
            const normalized = { ...data, rankName: data.rank_name || data.rankName || "NONE" };
            setTimeout(() => { setDice(data.dice); setGameResult(normalized); setMarbles(data.marbles); setRolling(false); setStep(3); }, 3000); 
        } catch (error) { setRolling(false); toast.error("재굴림 실패"); }
    };

    const playPlinko = async () => {
        if (marbles <= 0) return;
        try {
            const response = await api.post("/game/plinko/play");
            const data = response.data?.data || response.data;
            const normalized = { 
                ...data, 
                landingSlots: data.landing_slots || data.landingSlots || [], 
                earnedPoint: data.earned_point !== undefined ? data.earned_point : data.earnedPoint,
                totalPoint: data.total_point !== undefined ? data.total_point : data.totalPoint
            };
            setPlinkoResult(normalized); setStep(4);
            const newParticles = normalized.landingSlots.map((slot, i) => ({
                x: (500 / 2) + (Math.random() * 60 - 30), y: 50, vx: Math.random() * 6 - 3, vy: Math.random() * 2, targetSlot: slot, finished: false
            }));
            newParticles.forEach((p, i) => setTimeout(() => particlesRef.current.push(p), i * 180));
            setTimeout(() => { toast.success(`🎉 ${formatNumber(normalized.earnedPoint)} 포인트 획득!`); }, 5500);
        } catch (error) { toast.error("플링코 오류"); }
    };

    const toggleHold = (idx) => {
        if (step !== 2 || rolling) return;
        setHeldIndices(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
    };

    const resetGame = () => {
        setStep(1); setDice([1, 2, 3, 4, 5]); setHeldIndices([]); setGameResult(null); setPlinkoResult(null); setMarbles(0); particlesRef.current = []; setActiveSlot(null);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20 select-none text-slate-900">
            {/* 프리미엄 헤더 */}
            <div className="relative overflow-hidden rounded-[3rem] p-[3px] bg-gradient-to-r from-amber-300 via-orange-500 to-amber-600 shadow-2xl">
                <div className="card bg-slate-950 p-8 rounded-[2.8rem] relative overflow-hidden border border-white/5">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(245,158,11,0.25),transparent)]" />
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                        <div className="flex items-center gap-5">
                            <div className="p-4 bg-amber-500 rounded-3xl shadow-[0_0_25px_rgba(245,158,11,0.4)] rotate-3">
                                <Dices className="h-10 w-10 text-slate-900" />
                            </div>
                            <div>
                                <h1 className="text-5xl font-black text-white tracking-tighter italic uppercase drop-shadow-lg">Lucky Plinko</h1>
                                <p className="text-amber-500/70 font-black tracking-widest text-[10px] uppercase">Real Physics Arcade</p>
                            </div>
                        </div>
                        <div className="bg-slate-900/80 px-10 py-6 rounded-[2rem] border border-white/10 shadow-[inset_0_2px_15px_rgba(0,0,0,0.5)]">
                            <span className="text-[10px] text-amber-500 font-black tracking-widest uppercase mb-1 block opacity-50 text-center">Wallet Balance</span>
                            <div className="text-4xl font-black text-white flex items-center gap-3">
                                <Coins className="h-8 w-8 text-amber-400" />
                                {formatNumber(plinkoResult?.totalPoint || user?.point || 0)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-5">
                    <div className="card bg-indigo-950 p-10 h-full flex flex-col rounded-[4rem] border-[6px] border-indigo-900 shadow-2xl relative overflow-hidden">
                        <h3 className="text-2xl font-black text-indigo-300 italic tracking-tighter mb-8 uppercase">Dice Station</h3>
                        <div className="flex-1 flex flex-col justify-center items-center gap-14 bg-black/40 rounded-[3rem] p-10 shadow-inner">
                            <div className="flex flex-wrap justify-center gap-8 perspective-1000">
                                {dice.map((val, idx) => (
                                    <ThreeDDice key={idx} index={idx} value={val} rolling={rolling && !heldIndices.includes(idx)} isHeld={heldIndices.includes(idx)} onClick={toggleHold} />
                                ))}
                            </div>
                            {gameResult && (
                                <div className="text-center animate-slide-up bg-white/5 w-full py-8 rounded-[2.5rem] border border-white/10 shadow-lg">
                                    <div className="text-4xl font-black text-amber-400 italic mb-1 uppercase drop-shadow-md">{gameResult.rankName}</div>
                                    <div className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-2">Marbles Awarded</div>
                                    <div className="text-7xl font-black text-white tabular-nums tracking-tighter">{marbles}</div>
                                </div>
                            )}
                        </div>
                        <div className="mt-10 space-y-4">
                            {step === 1 && (
                                <button onClick={rollDice} disabled={rolling} className="w-full py-6 rounded-3xl bg-indigo-600 text-white font-black text-2xl shadow-[0_8px_0_rgb(49,46,129)] active:translate-y-2 transition-all">START ROLL (100P)</button>
                            )}
                            {step === 2 && (
                                <div className="flex flex-col gap-4">
                                    <button onClick={rerollDice} disabled={rolling || heldIndices.length < 1 || heldIndices.length > 4} className="w-full py-6 rounded-3xl bg-indigo-600 text-white font-black text-2xl shadow-[0_8px_0_rgb(49,46,129)] disabled:opacity-50">REROLL OTHERS</button>
                                    <div className="flex gap-3">
                                        <button onClick={() => setStep(3)} className="flex-1 py-4 rounded-2xl bg-slate-800 text-indigo-300 font-bold border border-indigo-900">KEEP</button>
                                        {marbles > 0 && <button onClick={playPlinko} className="flex-1 py-4 rounded-2xl bg-amber-500 text-black font-black shadow-lg animate-pulse">PLAY NOW!</button>}
                                    </div>
                                </div>
                            )}
                            {(step === 3 || step === 4) && (
                                <button onClick={resetGame} disabled={rolling} className="w-full py-6 rounded-3xl bg-slate-800 text-white font-black text-xl">NEW GAME</button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-7">
                    <div className="card bg-slate-900 p-10 rounded-[5rem] border-[10px] border-slate-800 shadow-2xl flex flex-col items-center relative overflow-hidden">
                        <div className="w-full flex justify-between items-center mb-10 z-10">
                            <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase">Cabinet Board</h3>
                            {step === 3 && marbles > 0 && (
                                <button onClick={playPlinko} className="bg-amber-500 text-black px-12 py-4 rounded-2xl font-black text-2xl shadow-[0_0_30px_rgba(245,158,11,0.4)] animate-bounce">PUSH START</button>
                            )}
                        </div>

                        <div className="relative w-full aspect-[4/6.5] bg-black/80 rounded-[4rem] border-4 border-slate-700 shadow-[inset_0_0_100px_black] overflow-hidden">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-44 h-24 bg-slate-800 rounded-b-full border-x-4 border-b-4 border-slate-700 z-[60] flex items-center justify-center shadow-2xl">
                                <div className="w-28 h-8 bg-black rounded-full shadow-[inset_0_2px_20px_rgba(255,255,255,0.1)]" />
                            </div>

                            <canvas ref={canvasRef} width={500} height={800} className="w-full h-full relative z-50 pointer-events-none" />

                            <div className="absolute bottom-8 left-8 right-8 h-28 flex gap-3 z-20">
                                {[30.0, 10.0, 5.0, 1.0, 1.0, 5.0, 10.0, 30.0].map((mult, idx) => (
                                    <div key={idx} className={`flex-1 rounded-3xl flex flex-col items-center justify-center border-t-8 transition-all duration-300
                                        ${activeSlot === idx ? 'scale-110 -translate-y-4 brightness-150 shadow-[0_0_50px_rgba(245,158,11,0.7)] border-amber-400' : 'brightness-75 shadow-lg'}
                                        ${mult >= 30 ? 'bg-amber-500/20 text-amber-400 border-amber-500' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                                        <span className="text-[8px] font-black opacity-40 uppercase mb-1">X-Factor</span>
                                        <span className="text-2xl font-black italic tracking-tighter">x{Math.floor(mult)}</span>
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
                .translate-z-14 { transform: translateZ(56px); }
                .rotate-y-180 { transform: rotateY(180deg) translateZ(56px); }
                .rotate-y--90 { transform: rotateY(-90deg) translateZ(56px); }
                .rotate-y-90 { transform: rotateY(90deg) translateZ(56px); }
                .rotate-x-90 { transform: rotateX(90deg) translateZ(56px); }
                .rotate-x--90 { transform: rotateX(-90deg) translateZ(56px); }
                .dice-stopping-smooth { transition: transform 1.5s cubic-bezier(0.16, 1, 0.3, 1); }
                @keyframes dice-roll-natural {
                    0% { transform: translateY(0) rotateX(0deg) rotateY(0deg) rotateZ(0deg); }
                    25% { transform: translateY(-60px) rotateX(360deg) rotateY(180deg) rotateZ(45deg); }
                    50% { transform: translateY(0) rotateX(720deg) rotateY(360deg) rotateZ(90deg); }
                    75% { transform: translateY(-30px) rotateX(1080deg) rotateY(540deg) rotateZ(135deg); }
                    100% { transform: translateY(0) rotateX(1440deg) rotateY(720deg) rotateZ(180deg); }
                }
                .dice-rolling-slow { animation: dice-roll-natural 3.0s infinite ease-in-out; }
            `}</style>
        </div>
    );
};
