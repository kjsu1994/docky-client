import { useState, useEffect, useRef } from "react";
if (typeof global === 'undefined') { window.global = window; }
import { 
    Dices, Trophy, Play, RefreshCcw, Coins, Info, Award, Lock, Unlock, AlertCircle, TrendingUp
} from "lucide-react";
import api from "../../utils/api.js";
import toast from "react-hot-toast";
import { formatNumber } from "../../utils/helpers.js";
import { useAuth } from "../../contexts/AuthContext.jsx";

// Audio assets
const ROLL_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2004/2004-preview.mp3";
const SOFT_TAP_URL = "https://assets.mixkit.co/active_storage/sfx/1084/1084-preview.mp3"; // short tap sound
const DICE_FACE_ANGLES = {
    1: { x: 0, y: 0, z: 0 },
    2: { x: 0, y: 180, z: 0 },
    3: { x: 0, y: -90, z: 0 },
    4: { x: 0, y: 90, z: 0 },
    5: { x: -90, y: 0, z: 0 },
    6: { x: 90, y: 0, z: 0 }
};
const SHOW_LAYOUT_GUIDES = false;
const BOARD_CROP_BOTTOM_PX = 34;

// Dice face renderer
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

// 3D dice component
const ThreeDDice = ({ value, rolling, isHeld, onClick, index }) => {
    const [rotation, setRotation] = useState(DICE_FACE_ANGLES[value] || { x: 0, y: 0, z: 0 });
    const velocityRef = useRef({ x: 0, y: 0, z: 0 });
    const rafRef = useRef(null);

    useEffect(() => {
        const target = DICE_FACE_ANGLES[value] || DICE_FACE_ANGLES[1];

        if (rolling) {
            velocityRef.current = {
                x: 900 + Math.random() * 760,
                y: 720 + Math.random() * 640,
                z: (Math.random() - 0.5) * 420
            };

            let lastTime = performance.now();
            const animate = (time) => {
                const dt = Math.min(0.05, (time - lastTime) / 1000);
                lastTime = time;

                const damping = Math.pow(0.992, dt * 60);
                const minSpin = 540;
                velocityRef.current.x *= damping;
                velocityRef.current.y *= damping;
                velocityRef.current.z *= Math.pow(0.975, dt * 60);

                if (Math.abs(velocityRef.current.x) < minSpin) {
                    velocityRef.current.x = Math.sign(velocityRef.current.x || 1) * minSpin;
                }
                if (Math.abs(velocityRef.current.y) < minSpin) {
                    velocityRef.current.y = Math.sign(velocityRef.current.y || 1) * minSpin;
                }

                setRotation((prev) => ({
                    x: prev.x + velocityRef.current.x * dt,
                    y: prev.y + velocityRef.current.y * dt,
                    z: prev.z + velocityRef.current.z * dt
                }));

                rafRef.current = requestAnimationFrame(animate);
            };

            rafRef.current = requestAnimationFrame(animate);
            return () => {
                if (rafRef.current) cancelAnimationFrame(rafRef.current);
            };
        }

        if (rafRef.current) cancelAnimationFrame(rafRef.current);

        setRotation((current) => {
            const settle = (cur, face, extraTurns) => {
                const delta = ((face - cur) % 360 + 360) % 360;
                return cur + delta + extraTurns * 360;
            };

            return {
                x: settle(current.x, target.x, 1),
                y: settle(current.y, target.y, 1),
                z: settle(current.z, target.z, 0)
            };
        });
    }, [rolling, value, index]);

    return (
        <div onClick={() => onClick(index)} 
             className={`dice-scene w-24 h-24 sm:w-28 sm:h-28 perspective-1000 transition-all duration-700 ${!rolling && !isHeld ? 'hover:scale-110 cursor-pointer' : ''} ${isHeld ? 'scale-105 brightness-75' : ''}`}>
            <div className={`dice-cube relative w-full h-full preserve-3d will-change-transform ${rolling ? 'dice-rolling-active' : 'dice-stopping-smooth'}`}
                 style={{ transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) rotateZ(${rotation.z}deg)` }}>
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
    const [pendingPlinkoResult, setPendingPlinkoResult] = useState(null);
    const [landedCount, setLandedCount] = useState(0);
    const [totalToLand, setTotalToLand] = useState(0);
    const [playInProgress, setPlayInProgress] = useState(false);
    const [marbles, setMarbles] = useState(0);
    const [activeSlot, setActiveSlot] = useState(null);
    const [slotTopPercent, setSlotTopPercent] = useState(72);
    
    const canvasRef = useRef(null);
    const boardRef = useRef(null);
    const slotRefs = useRef([]);
    const slotCentersRef = useRef(Array.from({ length: 8 }, (_, i) => (i + 0.5) / 8));
    const boardSizeRef = useRef({ width: 500, height: 800 });
    const particlesRef = useRef([]);
    const animationFrameRef = useRef();
    const rollAudio = useRef(new Audio(ROLL_SOUND_URL));
    const tapAudio = useRef(new Audio(SOFT_TAP_URL));
    const lastTapAtRef = useRef(0);

    useEffect(() => {
        // 모든 구슬 착지가 끝난 뒤 API 최종 점수를 호출한다.
        if (!playInProgress || !pendingPlinkoResult || totalToLand === 0) return;
        if (landedCount < totalToLand) return;

        setPlinkoResult(pendingPlinkoResult);
        setPendingPlinkoResult(null);
        setPlayInProgress(false);
        toast.success(`${formatNumber(pendingPlinkoResult.earnedPoint)} points earned!`);
    }, [landedCount, totalToLand, pendingPlinkoResult, playInProgress]);

    useEffect(() => {
        const updateSlotCenters = () => {
            const boardEl = boardRef.current;
            const canvasEl = canvasRef.current;
            if (!boardEl || !canvasEl) return;

            const canvasRect = canvasEl.getBoundingClientRect();
            if (!canvasRect.width) return;

            slotCentersRef.current = slotCentersRef.current.map((oldCenter, idx) => {
                const el = slotRefs.current[idx];
                if (!el) return oldCenter;
                const rect = el.getBoundingClientRect();
                const centerPx = rect.left + rect.width / 2 - canvasRect.left;
                return Math.max(0, Math.min(1, centerPx / canvasRect.width));
            });
        };

        updateSlotCenters();
        window.addEventListener("resize", updateSlotCenters);

        let observer;
        if (typeof ResizeObserver !== "undefined" && boardRef.current) {
            observer = new ResizeObserver(updateSlotCenters);
            observer.observe(boardRef.current);
        }

        return () => {
            window.removeEventListener("resize", updateSlotCenters);
            if (observer) observer.disconnect();
        };
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const slotCount = 8;
        let width = 500;
        let height = 800;
        const lineBelowOffsetPx = 45;
        const landingLineOffsetPx = 12;
        let slotHeightPx = 64;
        let slotWidth = width / slotCount;
        let lastPinY = 150 + 6 * (height / 12);
        let slotTopY = lastPinY + landingLineOffsetPx + lineBelowOffsetPx;
        let floorY = slotTopY + (slotHeightPx / 2);

        const buildPins = (w, h) => {
            const rows = 7; // 2..8 columns only (9th removed)
            const nextPins = [];
            for (let r = 0; r < rows; r++) {
                const dotsInRow = Math.min(8, r + 2);
                const startX = (w - (dotsInRow - 1) * (w / 10)) / 2;
                for (let c = 0; c < dotsInRow; c++) {
                    nextPins.push({ x: startX + c * (w / 10), y: 150 + r * (h / 12), radius: 4 });
                }
            }
            return nextPins;
        };

        let pins = buildPins(width, height);

        const syncSlotGeometry = (canvasRect) => {
            let hasAllSlotElements = true;
            const centers = Array.from({ length: slotCount }, (_, idx) => {
                const el = slotRefs.current[idx];
                if (!el) {
                    hasAllSlotElements = false;
                    return (idx + 0.5) / slotCount;
                }
                const rect = el.getBoundingClientRect();
                const centerPx = rect.left + rect.width / 2 - canvasRect.left;
                return Math.max(0, Math.min(1, centerPx / Math.max(1, canvasRect.width)));
            });
            slotCentersRef.current = centers;

            const firstSlot = slotRefs.current[0]?.getBoundingClientRect();
            if (firstSlot) {
                slotTopY = Math.max(0, firstSlot.top - canvasRect.top);
                slotHeightPx = firstSlot.height;
                floorY = slotTopY + (slotHeightPx / 2);
                setSlotTopPercent((slotTopY / Math.max(1, height)) * 100);
            } else if (!hasAllSlotElements) {
                slotTopY = lastPinY + landingLineOffsetPx + lineBelowOffsetPx;
                floorY = slotTopY + (slotHeightPx / 2);
                setSlotTopPercent((slotTopY / Math.max(1, height)) * 100);
            }
        };

        const syncCanvasSize = () => {
            const rect = canvas.getBoundingClientRect();
            if (!rect.width || !rect.height) return;

            const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
            width = rect.width;
            height = rect.height;
            boardSizeRef.current = { width, height };
            slotWidth = width / slotCount;
            lastPinY = 150 + 6 * (height / 12);
            slotTopY = lastPinY + landingLineOffsetPx + lineBelowOffsetPx;
            floorY = slotTopY + (slotHeightPx / 2);
            setSlotTopPercent((slotTopY / height) * 100);

            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            pins = buildPins(width, height);
            syncSlotGeometry(rect);
        };

        syncCanvasSize();

        window.addEventListener("resize", syncCanvasSize);
        let canvasObserver;
        if (typeof ResizeObserver !== "undefined") {
            canvasObserver = new ResizeObserver(syncCanvasSize);
            canvasObserver.observe(canvas);
        }

        const getTargetX = (slotIndex) => {
            const normalized = slotCentersRef.current[slotIndex];
            if (typeof normalized === "number" && Number.isFinite(normalized)) {
                return normalized * width;
            }
            return (slotIndex + 0.5) * slotWidth;
        };
        const physics = {
            gravity: 1480,
            airDrag: 0.993,
            wallRestitution: 0.58,
            pinRestitution: 0.66,
            pinFriction: 0.08,
            maxHorizontalSpeed: 245
        };
        const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
        const finishParticle = (p, now) => {
            if (p.finished) return;
            const targetX = getTargetX(p.targetSlot);
            p.x = targetX;
            p.y = floorY - p.radius;
            p.vx = 0;
            p.vy = 0;
            p.finished = true;
            p.finishedAt = now;
            p.removeAt = now + 260;
            setLandedCount((prev) => prev + 1);
            setActiveSlot(p.targetSlot);
            setTimeout(() => setActiveSlot(null), 260);
        };
        const stepParticle = (p, dt, now) => {
            if (p.finished) return;

            p.vy += physics.gravity * dt;
            p.vx *= Math.pow(physics.airDrag, dt * 60);
            p.vy *= Math.pow(0.997, dt * 60);
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.spin += p.angularVelocity * dt;
            p.angularVelocity *= Math.pow(0.985, dt * 60);
            let collidedWithPin = false;
            if (p.x - p.radius < 25) {
                p.x = 25 + p.radius;
                p.vx = Math.abs(p.vx) * physics.wallRestitution;
            } else if (p.x + p.radius > width - 25) {
                p.x = width - 25 - p.radius;
                p.vx = -Math.abs(p.vx) * physics.wallRestitution;
            }
            const targetX = getTargetX(p.targetSlot);
            for (let i = 0; i < pins.length; i++) {
                const pin = pins[i];
                const dx = p.x - pin.x;
                const dy = p.y - pin.y;
                const minDist = p.radius + pin.radius;
                const distSq = dx * dx + dy * dy;
                if (distSq >= minDist * minDist) continue;
                collidedWithPin = true;
                const dist = Math.sqrt(distSq) || 0.0001;
                const nx = dx / dist;
                const ny = dy / dist;
                const overlap = minDist - dist;
                p.x += nx * overlap;
                p.y += ny * overlap;
                const normalVel = p.vx * nx + p.vy * ny;
                if (normalVel < 0) {
                    const impulse = -(1 + physics.pinRestitution) * normalVel;
                    p.vx += impulse * nx;
                    p.vy += impulse * ny;
                    const tx = -ny;
                    const ty = nx;
                    const tangentSpeed = p.vx * tx + p.vy * ty;
                    p.vx -= tangentSpeed * physics.pinFriction * tx;
                    p.vy -= tangentSpeed * physics.pinFriction * ty;
                    p.vx += (Math.random() - 0.5) * 22;

                    // Path correction happens only on pin collisions, not in free-fall.
                    const targetDx = targetX - p.x;
                    const depth = clamp(p.y / floorY, 0, 1);
                    const correction = targetDx * (0.0018 + depth * 0.0028);
                    p.vx += clamp(correction, -20, 20);
                    p.angularVelocity += tangentSpeed * 0.025;
                    if (now - p.lastTapAt > 80 && now - lastTapAtRef.current > 35) {
                        const s = tapAudio.current.cloneNode();
                        const speed = Math.hypot(p.vx, p.vy);
                        s.volume = Math.min(0.035, speed / 18000);
                        s.playbackRate = 1.15 + Math.random() * 0.45;
                        s.play().catch(() => {});
                        p.lastTapAt = now;
                        lastTapAtRef.current = now;
                    }
                }
            }

            // Prevent "stuck-on-pin" states: only apply escape impulse when actually colliding a pin.
            const speed = Math.hypot(p.vx, p.vy);
            if (collidedWithPin && speed < 22) {
                const targetDx = getTargetX(p.targetSlot) - p.x;
                p.vy += 90;
                p.vx += clamp(targetDx * 0.004, -22, 22);
            }

            p.vx = clamp(p.vx, -physics.maxHorizontalSpeed, physics.maxHorizontalSpeed);
            // 자유낙하 구간에서는 약한 유도력만 적용해 자연스러운 궤적을 유지한다.
            const targetDx = targetX - p.x;
            const descentRatio = clamp((p.y - lastPinY) / Math.max(1, floorY - lastPinY), 0, 1);
            p.vx += clamp(targetDx * (0.00035 + descentRatio * 0.0016), -12, 12);
            if (p.y + p.radius >= floorY) {
                p.y = floorY - p.radius;
                finishParticle(p, now);
                return;
            }
            p.life += dt;
            if (p.life > 20 || p.y > height + 30) {
                p.y = floorY - p.radius;
                finishParticle(p, now);
            }
        };
        const render = () => {
            ctx.clearRect(0, 0, width, height);

            if (SHOW_LAYOUT_GUIDES) {
                // Slot center guide (where particles are considered landed)
                ctx.strokeStyle = 'rgba(34, 197, 94, 0.9)';
                ctx.lineWidth = 2;
                ctx.setLineDash([8, 6]);
                ctx.beginPath();
                ctx.moveTo(0, floorY);
                ctx.lineTo(width, floorY);
                ctx.stroke();

                // Last pin row guide (expected visual end of pin field)
                ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
                ctx.beginPath();
                ctx.moveTo(0, lastPinY);
                ctx.lineTo(width, lastPinY);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            pins.forEach((pin) => {
                ctx.beginPath();
                const grad = ctx.createRadialGradient(pin.x - 1, pin.y - 1, 0, pin.x, pin.y, 5);
                grad.addColorStop(0, '#e2e8f0');
                grad.addColorStop(1, '#475569');
                ctx.fillStyle = grad;
                ctx.arc(pin.x, pin.y, 5, 0, Math.PI * 2);
                ctx.fill();
            });
            const now = performance.now();
            particlesRef.current.forEach((p) => {
                if (p.finished && now > (p.removeAt || p.finishedAt || now)) return;
                ctx.save();
                const grad = ctx.createRadialGradient(p.x - 4, p.y - 4, 2, p.x, p.y, 12);
                grad.addColorStop(0, '#fde68a');
                grad.addColorStop(0.4, '#f59e0b');
                grad.addColorStop(1, '#b45309');
                if (p.finished) {
                    const remain = Math.max(0, (p.removeAt || now) - now);
                    ctx.globalAlpha = Math.max(0.35, remain / 260);
                }
                ctx.shadowBlur = 16;
                ctx.shadowColor = 'rgba(245, 158, 11, 0.45)';
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });
        };
        let lastTime = performance.now();
        let accumulator = 0;
        const fixedStep = 1 / 120;
        const frame = (time) => {
            const delta = Math.min(0.05, (time - lastTime) / 1000);
            lastTime = time;
            accumulator += delta;
            while (accumulator >= fixedStep) {
                const stepNow = performance.now();
                particlesRef.current.forEach((p) => stepParticle(p, fixedStep, stepNow));
                accumulator -= fixedStep;
            }
            const filterNow = performance.now();
            particlesRef.current = particlesRef.current.filter((p) => !(p.finished && filterNow > (p.removeAt || p.finishedAt || filterNow)));
            render();
            animationFrameRef.current = requestAnimationFrame(frame);
        };
        animationFrameRef.current = requestAnimationFrame(frame);
        return () => {
            cancelAnimationFrame(animationFrameRef.current);
            window.removeEventListener("resize", syncCanvasSize);
            if (canvasObserver) canvasObserver.disconnect();
        };
    }, []);
    const MIN_ROLL_MS = 1800;
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const rollDice = async () => {
        if (rolling) return;
        setRolling(true);
        const rollStartedAt = performance.now();
        rollAudio.current.currentTime = 0;
        rollAudio.current.play().catch(() => {});
        try {
            const response = await api.post('/game/dice/roll');
            const data = response.data?.data || response.data;
            const normalized = { ...data, rankName: data.rank_name || data.rankName || 'NONE' };
            const elapsed = performance.now() - rollStartedAt;
            if (elapsed < MIN_ROLL_MS) await wait(MIN_ROLL_MS - elapsed);
            setDice(data.dice);
            setGameResult(normalized);
            setMarbles(data.marbles);
            setRolling(false);
            setStep(2);
        } catch (error) {
            setRolling(false);
            toast.error('Error occurred');
        }
    };
    const rerollDice = async () => {
        if (rolling || heldIndices.length < 1 || heldIndices.length > 4) return;
        setRolling(true);
        const rollStartedAt = performance.now();
        rollAudio.current.currentTime = 0;
        rollAudio.current.play().catch(() => {});
        try {
            const response = await api.post('/game/dice/reroll', heldIndices);
            const data = response.data?.data || response.data;
            const normalized = { ...data, rankName: data.rank_name || data.rankName || 'NONE' };
            const elapsed = performance.now() - rollStartedAt;
            if (elapsed < MIN_ROLL_MS) await wait(MIN_ROLL_MS - elapsed);
            setDice(data.dice);
            setGameResult(normalized);
            setMarbles(data.marbles);
            setRolling(false);
            setStep(3);
        } catch (error) {
            setRolling(false);
            toast.error('Reroll failed');
        }
    };
    const playPlinko = async () => {
        if (marbles <= 0 || playInProgress) return;
        try {
            setPlayInProgress(true);
            const response = await api.post("/game/plinko/play");
            const data = response.data?.data || response.data;
            const normalized = { 
                ...data, 
                landingSlots: data.landing_slots || data.landingSlots || [], 
                earnedPoint: data.earned_point !== undefined ? data.earned_point : data.earnedPoint,
                totalPoint: data.total_point !== undefined ? data.total_point : data.totalPoint
            };
            setStep(4);
            if (normalized.landingSlots.length === 0) {
                setPlinkoResult(normalized);
                setPendingPlinkoResult(null);
                setPlayInProgress(false);
                toast.success(`${formatNumber(normalized.earnedPoint)} points earned!`);
                return;
            }
            setPlinkoResult(null);
            setPendingPlinkoResult(normalized);
            setLandedCount(0);
            setTotalToLand(normalized.landingSlots.length);
            particlesRef.current = [];
            setActiveSlot(null);
            const spawnX = boardSizeRef.current.width / 2;
            const newParticles = normalized.landingSlots.map((slot, i) => ({
                x: spawnX,
                y: 48 + i * 2,
                vx: 0,
                vy: Math.random() * 25,
                targetSlot: slot,
                radius: 10 + Math.random() * 1.5,
                spin: 0,
                angularVelocity: (Math.random() - 0.5) * 20,
                finished: false,
                finishedAt: 0,
                life: 0,
                lastTapAt: 0
            }));
            newParticles.forEach((p, i) => setTimeout(() => particlesRef.current.push(p), i * 180));
        } catch (error) {
            setPlayInProgress(false);
            toast.error("Plinko error");
        }
    };

    const toggleHold = (idx) => {
        if (step !== 2 || rolling) return;
        setHeldIndices(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
    };

    const resetGame = () => {
        setStep(1);
        setDice([1, 2, 3, 4, 5]);
        setHeldIndices([]);
        setGameResult(null);
        setPlinkoResult(null);
        setPendingPlinkoResult(null);
        setLandedCount(0);
        setTotalToLand(0);
        setPlayInProgress(false);
        setMarbles(0);
        particlesRef.current = [];
        setActiveSlot(null);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20 select-none text-slate-900">
            {/* Premium Header */}
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
                            {playInProgress && (
                                <div className="mt-2 text-center text-amber-200 text-xs font-black tracking-wide">
                                    LANDING {landedCount}/{totalToLand}
                                </div>
                            )}
                            {plinkoResult?.earnedPoint !== undefined && (
                                <div className="mt-2 text-center text-emerald-300 text-sm font-black tracking-wide">
                                    +{formatNumber(plinkoResult.earnedPoint)} EARNED
                                </div>
                            )}
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
                                        {marbles > 0 && <button onClick={playPlinko} disabled={playInProgress} className="flex-1 py-4 rounded-2xl bg-amber-500 text-black font-black shadow-lg animate-pulse disabled:opacity-40 disabled:animate-none">PLAY NOW!</button>}
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
                                <button onClick={playPlinko} disabled={playInProgress} className="bg-amber-500 text-black px-12 py-4 rounded-2xl font-black text-2xl shadow-[0_0_30px_rgba(245,158,11,0.4)] animate-bounce disabled:opacity-40 disabled:animate-none">PUSH START</button>
                            )}
                        </div>

                        <div ref={boardRef} style={{ clipPath: `inset(0 0 ${BOARD_CROP_BOTTOM_PX}px 0)` }} className="relative w-full aspect-[4/4.8] bg-gradient-to-b from-purple-700 via-indigo-700 to-indigo-900 rounded-[3.2rem] border-4 border-indigo-300/35 shadow-[inset_0_0_80px_rgba(0,0,0,0.35)] overflow-hidden">
                            <div className="absolute inset-0 z-[5] bg-[radial-gradient(circle_at_50%_5%,rgba(255,255,255,0.2),transparent_35%)]" />
                            <div className="absolute top-0 left-[14%] z-[8] h-[68%] w-[4px] bg-gradient-to-b from-pink-300 to-cyan-300 opacity-80 blur-[0.3px]" />
                            <div className="absolute top-0 right-[14%] z-[8] h-[68%] w-[4px] bg-gradient-to-b from-pink-300 to-cyan-300 opacity-80 blur-[0.3px]" />

                            <div className="absolute top-8 left-1/2 -translate-x-1/2 w-56 h-16 bg-gradient-to-b from-amber-300 to-amber-500 rounded-[1.5rem] border-4 border-amber-700 z-[25] flex items-center justify-center shadow-[0_8px_0_rgba(120,53,15,0.65)]">
                                <div className="w-[90%] h-[68%] rounded-xl bg-slate-900/80 border border-slate-200/20 flex items-center justify-center">
                                    <span className="text-white font-black tracking-tight text-xl">Lucky Plinko</span>
                                </div>
                            </div>

                            <canvas ref={canvasRef} width={500} height={800} className="absolute inset-0 z-[20] w-full h-full pointer-events-none" />

                            <div style={{ top: `${slotTopPercent}%` }} className="absolute left-6 right-6 h-16 flex gap-2 z-[30]">
                                {[30.0, 10.0, 5.0, 1.0, 1.0, 5.0, 10.0, 30.0].map((mult, idx) => (
                                    <div ref={(el) => { slotRefs.current[idx] = el; }} key={idx} className={`flex-1 rounded-xl flex items-center justify-center border-2 transition-all duration-100
                                        ${activeSlot === idx ? 'animate-slot-hit brightness-125 shadow-[0_0_28px_rgba(245,158,11,0.8)] ring-2 ring-amber-200/80' : 'brightness-95 shadow-md'}
                                        ${mult >= 30 ? 'bg-red-500/95 text-white border-red-900' : mult >= 10 ? 'bg-amber-300/95 text-slate-900 border-amber-700' : mult >= 5 ? 'bg-yellow-200/95 text-slate-900 border-yellow-600' : 'bg-stone-100/95 text-slate-900 border-stone-400'}`}>
                                        <span className="text-2xl font-black italic tracking-tight">x{Math.floor(mult)}</span>
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
                .dice-rolling-active { transition: none; }
                .dice-stopping-smooth { transition: transform 1.5s cubic-bezier(0.16, 1, 0.3, 1); }
                @keyframes slot-hit {
                    0% { transform: scale(1.12) translateY(-4px); }
                    100% { transform: scale(1.0) translateY(0); }
                }
                .animate-slot-hit { animation: slot-hit 180ms cubic-bezier(0.2, 0.8, 0.2, 1); }
            `}</style>
        </div>
    );
};

