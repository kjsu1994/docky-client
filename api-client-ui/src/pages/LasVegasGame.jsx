import { useEffect, useMemo, useRef, useState } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import toast from "react-hot-toast";
import { Crown, Dices, MessageSquare, Play, TimerReset, Users } from "lucide-react";
import api from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import { DiceCountBadge, DiceFace, MoneyCard } from "../common/LasVegasVisuals";

const ROOM_STORAGE_KEY = "las_vegas_last_room_id";
const CHAT_ROOM_READ_EVENT = "chat-room-read";

const normalizeRoomId = (room) => room?.room_id || room?.roomId;
const normalizeChatRoomId = (roomOrState) =>
    roomOrState?.chat_room_id || roomOrState?.chatRoomId || roomOrState?.room_id || roomOrState?.roomId || roomOrState?.id;
const formatWon = (value) => `${Number(value || 0).toLocaleString("ko-KR")}원`;
const toPlainInt = (value, fallback = 0) => {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const normalizeNumericText = (raw, min, max) => {
    const digitsOnly = String(raw ?? "").replace(/[^\d]/g, "");
    if (!digitsOnly) return "";
    const normalized = digitsOnly.replace(/^0+(\d)/, "$1");
    const numeric = toPlainInt(normalized, min);
    const clamped = Math.min(max, Math.max(min, numeric));
    return String(clamped);
};

const casinoName = {
    1: "Bellagio",
    2: "MGM",
    3: "Caesars",
    4: "Wynn",
    5: "Venetian",
    6: "Cosmo",
};

const CasinoPanel = ({ casino, statePlayers, isHot }) => {
    const casinoNo = toPlainInt(casino.casino_no || casino.casinoNo, 0);
    const total = casino.total_money || casino.totalMoney || 0;
    const moneyCards = casino.money_cards || casino.moneyCards || [];
    const diceByPlayer = casino.dice_by_player || casino.diceByPlayer || {};
    const diceEntries = Object.entries(diceByPlayer).sort((a, b) => Number(b[1]) - Number(a[1]));
    const playerMap = useMemo(() => {
        const map = new Map();
        (statePlayers || []).forEach((player) => {
            map.set(Number(player.member_id || player.memberId), player.nickname);
        });
        return map;
    }, [statePlayers]);

    return (
        <article className={`rounded-[1.6rem] border p-4 shadow-xl backdrop-blur-md transition-all duration-500 ${
            isHot
                ? "border-amber-300 bg-gradient-to-br from-amber-500/30 via-orange-500/25 to-slate-900/80 shadow-amber-400/30 scale-[1.01]"
                : "border-white/20 bg-gradient-to-br from-slate-900/80 to-slate-800/85 shadow-slate-900/30"
        }`}>
            <header className="mb-3 flex items-center justify-between">
                <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-200">Casino {casinoNo}</div>
                    <div className="text-sm font-black text-white">{casinoName[casinoNo] || `Table ${casinoNo}`}</div>
                </div>
                <div className="rounded-full bg-emerald-400/20 px-2.5 py-1 text-xs font-black text-emerald-300">{formatWon(total)}</div>
            </header>

            <div className="mb-4 flex min-h-[3.5rem] flex-wrap gap-2">
                {!moneyCards.length && <div className="text-xs text-slate-400">머니 카드 없음</div>}
                {moneyCards.map((amount, idx) => (
                    <MoneyCard key={`${casinoNo}-money-${idx}-${amount}`} amount={amount} className="w-20 scale-90" />
                ))}
            </div>

            <div className="space-y-1.5">
                {!diceEntries.length && <div className="text-xs text-slate-400">배팅 주사위 없음</div>}
                {diceEntries.map(([memberId, count]) => (
                    <div key={`${casinoNo}-dice-${memberId}`} className="flex items-center justify-between rounded-xl bg-white/10 px-2.5 py-1.5 text-xs font-bold text-slate-100">
                        <span className="line-clamp-1">{playerMap.get(Number(memberId)) || `P${toPlainInt(memberId, 0)}`}</span>
                        <DiceCountBadge value={casinoNo} count={toPlainInt(count, 0)} />
                    </div>
                ))}
            </div>
        </article>
    );
};

export const LasVegasGame = () => {
    const { user } = useAuth();
    const [rooms, setRooms] = useState([]);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [state, setState] = useState(null);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [rematching, setRematching] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(null);
    const [createForm, setCreateForm] = useState({
        title: "",
        round_count: "4",
        turn_time_seconds: "25",
    });
    const [joinCode, setJoinCode] = useState("");
    const [settingsForm, setSettingsForm] = useState({
        round_count: "4",
        turn_time_seconds: "25",
    });
    const [hotCasinoNo, setHotCasinoNo] = useState(null);

    const stompRef = useRef(null);
    const gameSubRef = useRef(null);
    const chatSubRef = useRef(null);
    const chatScrollRef = useRef(null);
    const prevCasinoSignatureRef = useRef("");
    const lastReadMarkAtRef = useRef(0);
    const audioContextRef = useRef(null);
    const isBetSoundPlayingRef = useRef(false);

    const myMemberId = user?.member_id || user?.memberId || user?.id || null;
    const chatRoomId = normalizeChatRoomId(state) || normalizeChatRoomId(selectedRoom) || null;
    const roomStatus = state?.room_status || state?.roomStatus || selectedRoom?.room_status || selectedRoom?.roomStatus || null;
    const isFinished = roomStatus === "FINISHED";

    const isHost = selectedRoom && myMemberId &&
        Number(selectedRoom.host_member_id || selectedRoom.hostMemberId) === Number(myMemberId);
    const myTurn = state && myMemberId &&
        Number(state.turn_member_id || state.turnMemberId) === Number(myMemberId);
    const canRoll = !isFinished && myTurn && (!state?.current_roll || state.current_roll.length === 0);
    const canBet = !isFinished && myTurn && (state?.current_roll?.length || 0) > 0;

    const currentRoll = state?.current_roll || [];
    const currentRollCountByFace = useMemo(() => {
        const count = {};
        currentRoll.forEach((value) => {
            count[value] = (count[value] || 0) + 1;
        });
        return count;
    }, [currentRoll]);

    const livePlayers = Array.isArray(state?.players) ? state.players : [];
    const roomPlayers = Array.isArray(selectedRoom?.players) ? selectedRoom.players : [];
    const players = livePlayers.length > 0 ? livePlayers : roomPlayers;
    const hostNickname = useMemo(() => {
        const hostId = Number(selectedRoom?.host_member_id || selectedRoom?.hostMemberId || 0);
        return roomPlayers.find((player) => Number(player.member_id || player.memberId) === hostId)?.nickname || "-";
    }, [roomPlayers, selectedRoom]);
    const sortedPlayers = [...players].sort((a, b) => {
        const aMoney = a.total_money || a.totalMoney || 0;
        const bMoney = b.total_money || b.totalMoney || 0;
        return bMoney - aMoney;
    });
    const winnerMemberId = state?.winner_member_id || state?.winnerMemberId || null;
    const winnerNickname = winnerMemberId
        ? players.find((player) => Number(player.member_id || player.memberId) === Number(winnerMemberId))?.nickname || `플레이어 ${winnerMemberId}`
        : null;

    const ensureSocket = () => {
        if (stompRef.current) return stompRef.current;
        const client = new Client({
            webSocketFactory: () => new SockJS("/ws/chat"),
            connectHeaders: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
            reconnectDelay: 3000,
            onStompError: () => toast.error("실시간 연결 오류"),
        });
        client.activate();
        stompRef.current = client;
        return client;
    };

    const subscribeGameRoom = (client, roomId) => {
        if (gameSubRef.current) gameSubRef.current.unsubscribe();
        gameSubRef.current = client.subscribe(`/sub/game/las-vegas/room/${roomId}`, (msg) => {
            const payload = JSON.parse(msg.body || "{}");
            setState(payload);
            refreshSelectedRoom(roomId).catch(() => {});
            if (payload.message) toast(payload.message);
        });
    };

    const refreshSelectedRoom = async (roomId) => {
        const response = await api.get("/game/las-vegas/rooms/me");
        const matchedRoom = (response.data || []).find((room) => Number(normalizeRoomId(room)) === Number(roomId));
        if (matchedRoom) setSelectedRoom(matchedRoom);
        return matchedRoom || null;
    };

    const subscribeChatRoom = (client, roomId) => {
        if (chatSubRef.current) chatSubRef.current.unsubscribe();
        chatSubRef.current = client.subscribe(`/sub/chat/room/${roomId}`, (msg) => {
            const payload = JSON.parse(msg.body || "{}");
            setChatMessages((prev) => [...prev, payload]);
            markChatRoomAsRead(roomId).catch(() => {});
        });
    };

    const fetchRooms = async () => {
        const response = await api.get("/game/las-vegas/rooms");
        setRooms(response.data || []);
    };

    const fetchState = async (roomId) => {
        const response = await api.get(`/game/las-vegas/rooms/${roomId}/state`);
        setState(response.data);
        return response.data;
    };

    const fetchChatMessages = async (roomId) => {
        try {
            const response = await api.get(`/chat/room/${roomId}/messages`);
            const rows = response?.data?.data || response?.data?.content || response?.data || [];
            setChatMessages(Array.isArray(rows) ? [...rows].reverse() : []);
        } catch {
            setChatMessages([]);
        }
    };

    const markChatRoomAsRead = async (roomId) => {
        if (!roomId) return;
        const now = Date.now();
        if (now - lastReadMarkAtRef.current < 1000) return;
        lastReadMarkAtRef.current = now;
        await api.patch(`/chat/room/${roomId}/read`);
        window.dispatchEvent(new CustomEvent(CHAT_ROOM_READ_EVENT, { detail: { roomId: String(roomId) } }));
    };

    const hydrateRoomContext = async (room) => {
        setSelectedRoom(room);
        const roomId = normalizeRoomId(room);
        if (!roomId) return;
        localStorage.setItem(ROOM_STORAGE_KEY, String(roomId));

        const client = ensureSocket();
        const subscribeAll = async () => {
            subscribeGameRoom(client, roomId);
            const snapshot = await fetchState(roomId);
            const snapshotChatRoomId = normalizeChatRoomId(snapshot) || normalizeChatRoomId(room);
            if (snapshotChatRoomId) {
                subscribeChatRoom(client, snapshotChatRoomId);
                await fetchChatMessages(snapshotChatRoomId);
                await markChatRoomAsRead(snapshotChatRoomId);
            } else {
                setChatMessages([]);
            }
        };

        if (client.connected) {
            await subscribeAll();
        } else {
            client.onConnect = () => {
                subscribeAll().catch(() => toast.error("방 상태 초기화 실패"));
            };
        }
    };

    useEffect(() => {
        fetchRooms().catch(() => toast.error("방 목록을 불러오지 못했습니다."));
    }, []);

    useEffect(() => {
        const restore = async () => {
            try {
                const response = await api.get("/game/las-vegas/rooms/me");
                const myRooms = response.data || [];
                const storedId = Number(localStorage.getItem(ROOM_STORAGE_KEY) || 0);
                const preferred = myRooms.find((room) => Number(normalizeRoomId(room)) === storedId) || myRooms[0];
                if (preferred) {
                    await hydrateRoomContext(preferred);
                }
            } catch {
                // keep lobby mode
            }
        };
        restore();
    }, []);

    useEffect(() => {
        if (!selectedRoom) return;
        setSettingsForm({
            round_count: String(selectedRoom.round_count || selectedRoom.roundCount || 4),
            turn_time_seconds: String(selectedRoom.turn_time_seconds || selectedRoom.turnTimeSeconds || 25),
        });
    }, [selectedRoom]);

    useEffect(() => {
        if (!state?.turn_deadline_at) {
            setSecondsLeft(null);
            return;
        }
        const tick = () => {
            const ms = new Date(state.turn_deadline_at).getTime() - Date.now();
            setSecondsLeft(Math.max(0, Math.ceil(ms / 1000)));
        };
        tick();
        const timer = setInterval(tick, 500);
        return () => clearInterval(timer);
    }, [state?.turn_deadline_at]);

    useEffect(() => {
        if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
    }, [chatMessages]);

    useEffect(() => {
        if (!chatRoomId || !selectedRoom) return;
        markChatRoomAsRead(chatRoomId).catch(() => {});

        const onVisible = () => {
            if (document.visibilityState === "visible") {
                markChatRoomAsRead(chatRoomId).catch(() => {});
            }
        };
        const onFocus = () => markChatRoomAsRead(chatRoomId).catch(() => {});

        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            window.removeEventListener("focus", onFocus);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [chatRoomId, selectedRoom]);

    useEffect(() => {
        const casinos = state?.casinos || [];
        if (!casinos.length) return;
        const signatureParts = casinos.map((casino) => {
            const casinoNo = casino.casino_no || casino.casinoNo;
            const diceByPlayer = casino.dice_by_player || casino.diceByPlayer || {};
            const totalDice = Object.values(diceByPlayer).reduce((sum, value) => sum + Number(value || 0), 0);
            return `${casinoNo}:${totalDice}`;
        });
        const signature = signatureParts.join("|");
        if (!prevCasinoSignatureRef.current) {
            prevCasinoSignatureRef.current = signature;
            return;
        }
        if (prevCasinoSignatureRef.current !== signature) {
            let changedCasino = null;
            const prevMap = new Map(prevCasinoSignatureRef.current.split("|").map((row) => row.split(":")));
            for (const part of signatureParts) {
                const [casinoNo, totalDice] = part.split(":");
                if ((prevMap.get(casinoNo) || "0") !== totalDice) {
                    changedCasino = Number(casinoNo);
                    break;
                }
            }
            prevCasinoSignatureRef.current = signature;
            if (changedCasino) {
                setHotCasinoNo(changedCasino);
                setTimeout(() => setHotCasinoNo(null), 900);
            }
        }
    }, [state?.casinos]);

    useEffect(() => {
        return () => {
            if (gameSubRef.current) gameSubRef.current.unsubscribe();
            if (chatSubRef.current) chatSubRef.current.unsubscribe();
            if (stompRef.current) stompRef.current.deactivate();
        };
    }, []);

    const createRoom = async (e) => {
        e.preventDefault();
        try {
            setCreating(true);
            const payload = {
                title: createForm.title,
                round_count: toPlainInt(createForm.round_count, 4),
                turn_time_seconds: toPlainInt(createForm.turn_time_seconds, 25),
            };
            const response = await api.post("/game/las-vegas/rooms", payload);
            await hydrateRoomContext(response.data);
            await fetchRooms();
            toast.success("방 생성 완료");
        } catch {
            toast.error("방 생성 실패");
        } finally {
            setCreating(false);
        }
    };

    const joinRoom = async (roomId) => {
        try {
            setLoading(true);
            const response = await api.post(`/game/las-vegas/rooms/${roomId}/join`);
            await hydrateRoomContext(response.data);
            await fetchRooms();
            toast.success("입장 완료");
        } catch {
            toast.error("입장 실패");
        } finally {
            setLoading(false);
        }
    };

    const joinRoomByCode = async (e) => {
        e.preventDefault();
        const normalizedCode = joinCode.trim().toUpperCase();
        if (!normalizedCode) {
            toast.error("방코드를 입력해 주세요.");
            return;
        }
        try {
            setLoading(true);
            const response = await api.post("/game/las-vegas/rooms/join-by-code", {
                room_code: normalizedCode,
            });
            setJoinCode("");
            await hydrateRoomContext(response.data);
            await fetchRooms();
            toast.success("방코드로 입장했습니다.");
        } catch {
            toast.error("방코드 입장에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const playActionSound = (type) => {
        if (type === "ROLL_DICE") {
            playDiceRollSound();
            return;
        }
        const context = getAudioContext();
        if (!context || isBetSoundPlayingRef.current) return;
        if (context.state === "suspended") {
            context.resume().catch(() => {});
        }

        const now = context.currentTime;
        const master = context.createGain();
        const oscillator = context.createOscillator();
        const accent = context.createOscillator();
        const gain = context.createGain();

        try {
            isBetSoundPlayingRef.current = true;
            master.gain.setValueAtTime(0.20, now);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.36, now + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

            oscillator.type = "triangle";
            oscillator.frequency.setValueAtTime(880, now);
            oscillator.frequency.exponentialRampToValueAtTime(660, now + 0.12);

            accent.type = "sine";
            accent.frequency.setValueAtTime(1320, now);
            accent.frequency.exponentialRampToValueAtTime(990, now + 0.08);

            oscillator.connect(gain);
            accent.connect(gain);
            gain.connect(master);
            master.connect(context.destination);

            oscillator.start(now);
            accent.start(now);
            oscillator.stop(now + 0.12);
            accent.stop(now + 0.08);

            window.setTimeout(() => {
                isBetSoundPlayingRef.current = false;
            }, 140);
        } catch {
            isBetSoundPlayingRef.current = false;
            // Ignore browser autoplay or decode failures for optional SFX.
        }
    };

    const getAudioContext = () => {
        if (typeof window === "undefined") return null;
        if (audioContextRef.current) return audioContextRef.current;
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) return null;
        audioContextRef.current = new AudioContextCtor();
        return audioContextRef.current;
    };

    const playDiceRollSound = () => {
        const context = getAudioContext();
        if (!context) return;
        if (context.state === "suspended") {
            context.resume().catch(() => {});
        }

        const now = context.currentTime;
        const master = context.createGain();
        master.gain.setValueAtTime(0.40, now);
        master.connect(context.destination);

        // Layer short filtered-noise bursts to mimic dice clatter across a hard table.
        // 딱딱한 테이블 위를 구르는 주사위 느낌을 내기 위해 짧은 노이즈 버스트를 겹친다.
        for (let i = 0; i < 8; i += 1) {
            const start = now + (i * 0.045);
            const duration = 0.028 + (Math.random() * 0.03);
            const frameCount = Math.max(1, Math.floor(context.sampleRate * duration));
            const buffer = context.createBuffer(1, frameCount, context.sampleRate);
            const channel = buffer.getChannelData(0);
            for (let j = 0; j < channel.length; j += 1) {
                channel[j] = (Math.random() * 2 - 1) * (1 - (j / channel.length));
            }

            const source = context.createBufferSource();
            source.buffer = buffer;

            const filter = context.createBiquadFilter();
            filter.type = "bandpass";
            filter.frequency.setValueAtTime(1500 + Math.random() * 1800, start);
            filter.Q.setValueAtTime(1.2 + Math.random() * 2, start);

            const burstGain = context.createGain();
            burstGain.gain.setValueAtTime(0.0001, start);
            burstGain.gain.exponentialRampToValueAtTime(0.44 + Math.random() * 0.36, start + 0.006);
            burstGain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

            source.connect(filter);
            filter.connect(burstGain);
            burstGain.connect(master);
            source.start(start);
            source.stop(start + duration);
        }

        const tail = context.createOscillator();
        const tailGain = context.createGain();
        tail.type = "triangle";
        tail.frequency.setValueAtTime(190, now);
        tail.frequency.exponentialRampToValueAtTime(90, now + 0.35);
        tailGain.gain.setValueAtTime(0.0001, now);
        tailGain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
        tailGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
        tail.connect(tailGain);
        tailGain.connect(master);
        tail.start(now);
        tail.stop(now + 0.36);
    };

    const publishGameAction = (actionType, casinoNo = null) => {
        if (!stompRef.current?.connected || !selectedRoom || !myMemberId) return;
        const roomId = normalizeRoomId(selectedRoom);
        if (!roomId) return;
        playActionSound(actionType);
        stompRef.current.publish({
            destination: `/pub/game/las-vegas/${roomId}/action`,
            body: JSON.stringify({
                action_type: actionType,
                member_id: Number(myMemberId),
                casino_no: casinoNo,
            }),
            headers: { "content-type": "application/json" },
        });
    };

    const sendChatMessage = () => {
        if (!chatInput.trim() || !stompRef.current?.connected || !chatRoomId || !myMemberId) return;
        const message = chatInput.trim();
        stompRef.current.publish({
            destination: "/pub/chat/message",
            body: JSON.stringify({
                roomId: Number(chatRoomId),
                chatRoomId: Number(chatRoomId),
                senderId: Number(myMemberId),
                type: "TALK",
                message,
            }),
            headers: { "content-type": "application/json" },
        });
        setChatInput("");
    };

    const updateSettings = async () => {
        if (!selectedRoom) return;
        const roomId = normalizeRoomId(selectedRoom);
        try {
            const response = await api.patch(`/game/las-vegas/rooms/${roomId}/settings`, {
                round_count: toPlainInt(settingsForm.round_count, 4),
                turn_time_seconds: toPlainInt(settingsForm.turn_time_seconds, 25),
            });
            setSelectedRoom(response.data);
            toast.success("설정 저장 완료");
        } catch {
            toast.error("설정 저장 실패");
        }
    };

    const toggleReady = async () => {
        if (!selectedRoom) return;
        if (roomStatus !== "WAITING") {
            toast.error("대기 상태에서만 준비를 변경할 수 있습니다.");
            return;
        }
        const roomId = normalizeRoomId(selectedRoom);
        try {
            await api.post(`/game/las-vegas/rooms/${roomId}/ready`);
            toast.success("준비 상태 반영");
        } catch {
            toast.error("준비 상태 변경 실패");
        }
    };

    const startGame = async () => {
        if (!selectedRoom) return;
        if (roomStatus !== "WAITING") {
            toast.error("한 판 더 하기로 대기 상태를 만든 뒤 시작할 수 있습니다.");
            return;
        }
        const roomId = normalizeRoomId(selectedRoom);
        try {
            await api.post(`/game/las-vegas/rooms/${roomId}/start`);
            toast.success("게임 시작");
        } catch {
            toast.error("게임 시작 실패");
        }
    };

    const rematchGame = async () => {
        if (!selectedRoom) return;
        const roomId = normalizeRoomId(selectedRoom);
        try {
            setRematching(true);
            const response = await api.post(`/game/las-vegas/rooms/${roomId}/rematch`);
            setSelectedRoom(response.data);
            await fetchState(roomId);
            await fetchRooms();
            toast.success("같은 방에서 새 판 준비를 시작했습니다.");
        } catch {
            toast.error("한 판 더 하기 준비에 실패했습니다.");
        } finally {
            setRematching(false);
        }
    };

    const leaveRoom = async () => {
        if (!selectedRoom) return;
        const roomId = normalizeRoomId(selectedRoom);
        try {
            await api.post(`/game/las-vegas/rooms/${roomId}/leave`);
            setSelectedRoom(null);
            setState(null);
            setChatMessages([]);
            localStorage.removeItem(ROOM_STORAGE_KEY);
            if (gameSubRef.current) gameSubRef.current.unsubscribe();
            if (chatSubRef.current) chatSubRef.current.unsubscribe();
            await fetchRooms();
            toast.success("방 퇴장");
        } catch {
            toast.error("퇴장 실패");
        }
    };

    return (
        <div className="space-y-6">
            <style>{`
                @keyframes chip-float {
                    0% { transform: translateY(0) rotate(0deg); opacity: 0; }
                    10% { opacity: 1; }
                    100% { transform: translateY(-160px) rotate(220deg); opacity: 0; }
                }
                .chip-burst { position: absolute; width: 14px; height: 14px; border-radius: 9999px; animation: chip-float 1.8s ease-out forwards; }
            `}</style>
            {!selectedRoom && (
                <section className="rounded-[2rem] border border-white/20 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-6 text-slate-100 shadow-2xl">
                <div className="mb-4 flex items-center gap-3">
                    <div className="rounded-2xl bg-white/10 p-2.5"><Dices className="h-5 w-5" /></div>
                    <div>
                        <h1 className="text-xl font-black tracking-tight">LAS VEGAS LIVE TABLE</h1>
                        <p className="text-xs text-slate-300">방장 설정 + 실시간 턴 + 자동 타임아웃 액션</p>
                    </div>
                </div>
                <div className="mb-3 grid grid-cols-1 gap-2 text-xs text-slate-300 md:grid-cols-3">
                    <div className="rounded-xl bg-white/10 px-3 py-2">
                        <div className="font-black text-slate-100">방 제목</div>
                        <div>플레이어 목록에서 구분되는 방 이름</div>
                    </div>
                    <div className="rounded-xl bg-white/10 px-3 py-2">
                        <div className="font-black text-slate-100">라운드 수</div>
                        <div>게임 시작 후 총 진행 라운드(1~10)</div>
                    </div>
                    <div className="rounded-xl bg-white/10 px-3 py-2">
                        <div className="font-black text-slate-100">턴 시간(초)</div>
                        <div>각 턴 제한 시간, 만료 시 자동행동(5~180초)</div>
                    </div>
                </div>
                <form className="grid grid-cols-1 gap-3 md:grid-cols-4" onSubmit={createRoom}>
                    <input
                        className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-300"
                        placeholder="새 방 제목"
                        value={createForm.title}
                        onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))}
                    />
                    <input
                        className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white"
                        type="text"
                        inputMode="numeric"
                        value={createForm.round_count}
                        onChange={(e) => setCreateForm((prev) => ({ ...prev, round_count: normalizeNumericText(e.target.value, 1, 10) }))}
                    />
                    <input
                        className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white"
                        type="text"
                        inputMode="numeric"
                        value={createForm.turn_time_seconds}
                        onChange={(e) => setCreateForm((prev) => ({ ...prev, turn_time_seconds: normalizeNumericText(e.target.value, 5, 180) }))}
                    />
                    <button type="submit" className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-white disabled:opacity-50" disabled={creating}>
                        {creating ? "생성 중..." : "방 만들기"}
                    </button>
                </form>
                </section>
            )}

            {!selectedRoom && (
                <section className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-lg">
                    <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900">
                        <Users className="h-5 w-5" />
                        대기 중인 방
                    </h2>
                    <form className="mb-4 flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 md:flex-row" onSubmit={joinRoomByCode}>
                        <input
                            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase"
                            placeholder="방코드로 입장"
                            value={joinCode}
                            maxLength={8}
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                        />
                        <button className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white disabled:opacity-50" disabled={loading}>
                            코드 입장
                        </button>
                    </form>
                    <div className="space-y-2.5">
                        {!rooms.length && <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-400">대기 중인 방이 없습니다.</div>}
                        {rooms.map((room) => {
                            const roomId = normalizeRoomId(room);
                            const playersCount = (room.players || []).length;
                            return (
                                <div key={roomId} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                                    <div>
                                        <div className="text-sm font-black text-slate-900">{room.title}</div>
                                        <div className="text-xs text-slate-500">
                                            코드 {room.room_code || room.roomCode} | {playersCount}/6명 | 라운드 {room.round_count || room.roundCount}
                                        </div>
                                    </div>
                                    <button className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-black text-white disabled:opacity-50" disabled={loading} onClick={() => joinRoom(roomId)}>
                                        입장
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {selectedRoom && (
                <section className="space-y-4">
                    <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-lg">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <div className="text-lg font-black text-slate-900">{selectedRoom.title}</div>
                                <div className="text-xs text-slate-500">방 코드 {selectedRoom.room_code || selectedRoom.roomCode}</div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700" onClick={toggleReady}>준비 토글</button>
                                {isHost && <button className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-black text-white" onClick={startGame}>시작</button>}
                                <button className="rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-600" onClick={leaveRoom}>퇴장</button>
                            </div>
                        </div>
                        {isHost && isFinished && (
                            <div className="mt-3 flex justify-end">
                                <button
                                    className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-black text-white disabled:opacity-50"
                                    onClick={rematchGame}
                                    disabled={rematching}
                                >
                                    {rematching ? "준비 중..." : "한 판 더 하기"}
                                </button>
                            </div>
                        )}
                        <div className="mt-3 grid grid-cols-1 gap-2 text-xs md:grid-cols-4">
                            <div className="rounded-xl bg-slate-50 px-3 py-2">
                                <div className="font-black text-slate-700">방 제목</div>
                                <div className="text-slate-500">{selectedRoom.title}</div>
                            </div>
                            <div className="rounded-xl bg-slate-50 px-3 py-2">
                                <div className="font-black text-slate-700">방장</div>
                                <div className="text-slate-500">{hostNickname}</div>
                            </div>
                            <div className="rounded-xl bg-slate-50 px-3 py-2">
                                <div className="font-black text-slate-700">방코드</div>
                                <div className="text-slate-500">{selectedRoom.room_code || selectedRoom.roomCode}</div>
                            </div>
                            <div className="rounded-xl bg-slate-50 px-3 py-2">
                                <div className="font-black text-slate-700">라운드 수</div>
                                <div className="text-slate-500">{toPlainInt(selectedRoom.round_count || selectedRoom.roundCount, 0)} 라운드</div>
                            </div>
                            <div className="rounded-xl bg-slate-50 px-3 py-2">
                                <div className="font-black text-slate-700">턴 시간</div>
                                <div className="text-slate-500">{toPlainInt(selectedRoom.turn_time_seconds || selectedRoom.turnTimeSeconds, 0)}초</div>
                            </div>
                        </div>

                        {isHost && roomStatus === "WAITING" && (
                            <div className="mt-4 grid grid-cols-1 gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 md:grid-cols-4">
                                <input type="text" inputMode="numeric" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={settingsForm.round_count} onChange={(e) => setSettingsForm((prev) => ({ ...prev, round_count: normalizeNumericText(e.target.value, 1, 10) }))} />
                                <input type="text" inputMode="numeric" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={settingsForm.turn_time_seconds} onChange={(e) => setSettingsForm((prev) => ({ ...prev, turn_time_seconds: normalizeNumericText(e.target.value, 5, 180) }))} />
                                <button className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-black text-white md:col-span-2" onClick={updateSettings}>방 설정 저장</button>
                            </div>
                        )}
                    </div>

                    <div className={`grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px] ${myTurn ? "rounded-[1.8rem] bg-sky-100/70 p-3 ring-2 ring-sky-300/70" : ""}`}>
                        <div className="space-y-4">
                            <div className={`rounded-[1.8rem] border p-4 shadow-2xl transition-all ${
                                myTurn
                                    ? "border-sky-200 bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-600"
                                    : "border-white/20 bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-800"
                            }`}>
                                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-black text-emerald-50">
                                    <span className="rounded-full bg-white/20 px-2.5 py-1">ROUND {state?.round_no || state?.roundNo || 0} / {state?.round_count || state?.roundCount || 0}</span>
                                    <span className="rounded-full bg-white/20 px-2.5 py-1">
                                        TURN {state?.players?.find((p) => Number(p.member_id || p.memberId) === Number(state.turn_member_id || state.turnMemberId))?.nickname || "-"}
                                    </span>
                                    {myTurn && (
                                        <span className="animate-pulse rounded-full bg-sky-100 px-2.5 py-1 text-sky-700 ring-2 ring-sky-200">
                                            내 차례
                                        </span>
                                    )}
                                    {secondsLeft !== null && (
                                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${
                                            secondsLeft <= 5
                                                ? "animate-pulse bg-rose-500/30 text-rose-100 ring-2 ring-rose-300/50"
                                                : "bg-amber-300/20 text-amber-100"
                                        }`}>
                                            <TimerReset className="h-3.5 w-3.5" />
                                            {secondsLeft}s
                                        </span>
                                    )}
                                </div>

                                {!isFinished && myTurn && (
                                    <div className="mb-3 rounded-2xl bg-white/10 p-3">
                                        <div className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-100">My Action</div>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                                                disabled={!canRoll}
                                                onClick={() => publishGameAction("ROLL_DICE")}
                                            >
                                                <Dices className="h-4 w-4" />
                                                주사위 굴리기
                                            </button>
                                            {canBet && Object.keys(currentRollCountByFace).map((face) => (
                                                <button key={face} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white" onClick={() => publishGameAction("PLACE_DICE", toPlainInt(face, 0))}>
                                                    {toPlainInt(face, 0)}번 배팅 ({toPlainInt(currentRollCountByFace[face], 0)}개)
                                                </button>
                                            ))}
                                        </div>
                                        {!!currentRoll.length && (
                                            <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-xl bg-white/10 p-2">
                                                {currentRoll.map((value, idx) => <DiceFace key={`roll-${idx}`} value={toPlainInt(value, 1)} size={30} />)}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                                    {(state?.casinos || []).map((casino) => (
                                        <CasinoPanel
                                            key={casino.casino_no || casino.casinoNo}
                                            casino={casino}
                                            statePlayers={state?.players}
                                            isHot={Number(casino.casino_no || casino.casinoNo) === Number(hotCasinoNo)}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-[1.8rem] border border-slate-200 bg-white p-4 shadow-lg">
                                <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
                                    <Crown className="h-4 w-4 text-amber-500" />
                                    플레이어 자산 현황
                                </div>
                                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                    {sortedPlayers.map((player) => {
                                        const memberId = player.member_id || player.memberId;
                                        const isCurrent = Number(memberId) === Number(state?.turn_member_id || state?.turnMemberId);
                                        return (
                                            <div key={`player-${memberId}`} className={`rounded-xl border p-3 ${isCurrent ? "border-primary-400 bg-primary-50" : "border-slate-100 bg-slate-50"}`}>
                                                <div className="text-sm font-black text-slate-900">{player.nickname}</div>
                                                <div className="mt-1 text-xs font-bold text-slate-600">
                                                    보유금 {formatWon(player.total_money || player.totalMoney || 0)} | 남은 주사위 {player.remaining_dice || player.remainingDice || 8}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {winnerMemberId && (
                                    <div className="relative mt-3 overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-black text-emerald-700">
                                        <div>우승자: {winnerNickname}</div>
                                        <div className="pointer-events-none absolute inset-0">
                                            <span className="chip-burst left-[10%] bottom-2 bg-yellow-400" style={{ animationDelay: "0ms" }} />
                                            <span className="chip-burst left-[22%] bottom-1 bg-emerald-400" style={{ animationDelay: "120ms" }} />
                                            <span className="chip-burst left-[34%] bottom-2 bg-cyan-400" style={{ animationDelay: "210ms" }} />
                                            <span className="chip-burst left-[48%] bottom-1 bg-rose-400" style={{ animationDelay: "300ms" }} />
                                            <span className="chip-burst left-[60%] bottom-2 bg-fuchsia-400" style={{ animationDelay: "420ms" }} />
                                            <span className="chip-burst left-[74%] bottom-1 bg-amber-400" style={{ animationDelay: "520ms" }} />
                                            <span className="chip-burst left-[86%] bottom-2 bg-indigo-400" style={{ animationDelay: "640ms" }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <aside className="rounded-[1.8rem] border border-slate-200 bg-white p-4 shadow-lg">
                            <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
                                <MessageSquare className="h-4 w-4" />
                                방 채팅
                            </div>
                            <div ref={chatScrollRef} className="mb-3 h-[420px] space-y-2 overflow-auto rounded-2xl bg-slate-50 p-3 text-xs">
                                {!chatMessages.length && <div className="text-slate-400">채팅 내역이 없습니다.</div>}
                                {chatMessages.map((msg, idx) => (
                                    <div key={`${msg.created_at || msg.createdAt || idx}-${idx}`} className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                                        <div className="font-black text-slate-800">{msg.sender_name || msg.senderName || "SYSTEM"}</div>
                                        <div className="mt-0.5 text-slate-700">{msg.message || ""}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                    placeholder="메시지를 입력하세요"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            sendChatMessage();
                                        }
                                    }}
                                />
                                <button className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white" onClick={sendChatMessage}>전송</button>
                            </div>
                        </aside>
                    </div>
                </section>
            )}

            <section className="rounded-[1.6rem] border border-slate-200 bg-white p-4 text-xs text-slate-500">
                <div className="mb-1.5 flex items-center gap-1.5 font-black text-slate-700">
                    <Play className="h-3.5 w-3.5" />
                    안내
                </div>
                <div>페이지 새로고침 후에도 마지막 참여 방을 자동 복구합니다.</div>
                <div>실시간 채팅은 기존 채팅 서버를 그대로 재사용합니다.</div>
            </section>
        </div>
    );
};

export default LasVegasGame;
