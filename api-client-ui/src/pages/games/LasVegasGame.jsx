import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { notify, notifyError, notifySuccess } from "../../utils/toast.js";
import { CheckCircle2, Crown, Dices, MessageSquare, Play, TimerReset, Users } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { DiceCountBadge, DiceFace, MoneyCard } from "../../common/LasVegasVisuals.jsx";
import { confirmAction } from "../../common/confirmAction.jsx";
import UserAvatar from "../../common/UserAvatar.jsx";
import { buildTalkPayload, chatAdapter, compareMessagesByChronology, getMemberId, normalizeMessage } from "../../adapters/chatAdapter.js";
import { buildStompConnectHeaders, createStompClient, notifyRealtimeError } from "../../adapters/realtimeAdapter.js";
import {
    buildLasVegasActionPayload,
    getLasVegasChatRoomId,
    getLasVegasPlayerId,
    getLasVegasRoomId,
    isLasVegasReadyPlayer,
    lasVegasGameAdapter,
    normalizeLasVegasState,
} from "../../adapters/lasVegasGameAdapter.js";

const ROOM_STORAGE_KEY = "las_vegas_last_room_id";
const CHAT_ROOM_READ_EVENT = "chat-room-read";
const LAS_VEGAS_SOUND_VOLUME_MULTIPLIER = 4;

const normalizeRoomId = getLasVegasRoomId;
const normalizeChatRoomId = getLasVegasChatRoomId;
const isReadyPlayer = isLasVegasReadyPlayer;
const extractReadyMemberIds = (players) =>
    new Set(
        (Array.isArray(players) ? players : [])
            .filter((player) => isReadyPlayer(player))
            .map((player) => Number(getLasVegasPlayerId(player)))
            .filter((memberId) => Number.isFinite(memberId) && memberId > 0)
    );
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

const CasinoPanel = ({ casino, statePlayers, isHot, isLastPlaced }) => {
    const casinoNo = toPlainInt(casino.casinoNo, 0);
    const total = casino.totalMoney || 0;
    const moneyCards = casino.moneyCards || [];
    const diceByPlayer = casino.diceByPlayer || {};
    const diceEntries = Object.entries(diceByPlayer).sort((a, b) => Number(b[1]) - Number(a[1]));
    const playerMap = useMemo(() => {
        const map = new Map();
        (statePlayers || []).forEach((player) => {
            map.set(Number(player.memberId), player);
        });
        return map;
    }, [statePlayers]);

    return (
        <article className={`rounded-2xl border p-2.5 shadow-xl backdrop-blur-md transition-all duration-500 sm:rounded-[1.6rem] sm:p-4 ${
            isHot || isLastPlaced
                ? "border-amber-300 bg-gradient-to-br from-amber-500/35 via-orange-500/30 to-slate-900/85 shadow-amber-400/30 scale-[1.01] ring-2 ring-amber-300/70"
                : "border-white/20 bg-gradient-to-br from-slate-900/80 to-slate-800/85 shadow-slate-900/30"
        }`}>
            <header className="mb-3 flex items-center justify-between">
                <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-200">Casino {casinoNo}</div>
                    <div className="text-sm font-black text-white">{casinoName[casinoNo] || `Table ${casinoNo}`}</div>
                </div>
                <div className="rounded-full bg-emerald-400/20 px-2.5 py-1 text-[11px] font-black text-emerald-300 sm:text-xs">{formatWon(total)}</div>
            </header>
            {isLastPlaced && (
                <div className="mb-2 rounded-xl border border-amber-200/40 bg-amber-200/20 px-2 py-1 text-[10px] font-black text-amber-100">
                    직전 배팅 위치
                </div>
            )}

            <div className="mb-3 flex min-h-[2.5rem] flex-wrap gap-1.5 sm:mb-4 sm:min-h-[3.5rem] sm:gap-2">
                {!moneyCards.length && <div className="text-xs text-slate-400">머니 카드 없음</div>}
                {moneyCards.map((amount, idx) => (
                    <MoneyCard key={`${casinoNo}-money-${idx}-${amount}`} amount={amount} className="w-14 scale-90 sm:w-20" />
                ))}
            </div>

            <div className="space-y-1.5">
                {!diceEntries.length && <div className="text-xs text-slate-400">배팅 주사위 없음</div>}
                {diceEntries.map(([memberId, count]) => {
                    const player = playerMap.get(Number(memberId));
                    const name = player?.nickname || `P${toPlainInt(memberId, 0)}`;
                    return (
                    <div key={`${casinoNo}-dice-${memberId}`} className="flex items-center justify-between rounded-xl bg-white/10 px-2.5 py-1.5 text-xs font-bold text-slate-100">
                        <span className="flex min-w-0 items-center gap-1.5">
                            <UserAvatar name={name} profileUrl={player?.profileUrl} size="xs" className="border-white/20 bg-white/15 text-white" />
                            <span className="line-clamp-1">{name}</span>
                        </span>
                        <DiceCountBadge value={casinoNo} count={toPlainInt(count, 0)} />
                    </div>
                    );
                })}
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
    const [forceFinishing, setForceFinishing] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(null);
    const [createForm, setCreateForm] = useState({
        title: "",
        roundCount: "3",
        turnTimeSeconds: "50",
    });
    const [joinCode, setJoinCode] = useState("");
    const [settingsForm, setSettingsForm] = useState({
        roundCount: "3",
        turnTimeSeconds: "50",
    });
    const [hotCasinoNo, setHotCasinoNo] = useState(null);

    const stompRef = useRef(null);
    const stompInitRef = useRef(null);
    const gameSubRef = useRef(null);
    const chatSubRef = useRef(null);
    const realtimeRoomRef = useRef(null);
    const mountedRef = useRef(false);
    const chatScrollRef = useRef(null);
    const prevCasinoSignatureRef = useRef("");
    const lastReadMarkAtRef = useRef(0);
    const audioContextRef = useRef(null);
    const isBetSoundPlayingRef = useRef(false);

    const myMemberId = getMemberId(user) || user?.id || null;
    const chatRoomId = normalizeChatRoomId(state) || normalizeChatRoomId(selectedRoom) || null;
    const roomStatus = state?.roomStatus || selectedRoom?.roomStatus || null;
    const isFinished = roomStatus === "FINISHED";

    const isHost = selectedRoom && myMemberId &&
        Number(selectedRoom.hostMemberId) === Number(myMemberId);
    const myTurn = state && myMemberId &&
        Number(state.turnMemberId) === Number(myMemberId);
    const canRoll = !isFinished && myTurn && (!state?.currentRoll || state.currentRoll.length === 0);
    const canBet = !isFinished && myTurn && (state?.currentRoll?.length || 0) > 0;

    const currentRoll = state?.currentRoll || [];
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
    const readyMemberIds = useMemo(() => extractReadyMemberIds(players), [players]);
    const hostNickname = useMemo(() => {
        const hostId = Number(selectedRoom?.hostMemberId || 0);
        return roomPlayers.find((player) => Number(player.memberId) === hostId)?.nickname || "-";
    }, [roomPlayers, selectedRoom]);
    const sortedPlayers = [...players].sort((a, b) => {
        const aMoney = a.totalMoney || 0;
        const bMoney = b.totalMoney || 0;
        return bMoney - aMoney;
    });
    const winnerMemberId = state?.winnerMemberId || null;
    const winnerNickname = winnerMemberId
        ? players.find((player) => Number(player.memberId) === Number(winnerMemberId))?.nickname || `플레이어 ${winnerMemberId}`
        : null;
    const currentTurnMemberId = state?.turnMemberId || null;
    const currentRollPlayer = currentTurnMemberId
        ? players.find((player) => Number(player.memberId) === Number(currentTurnMemberId))
        : null;
    const currentRollPlayerName = currentRollPlayer?.nickname || (currentTurnMemberId ? `플레이어 ${currentTurnMemberId}` : "-");
    const lastPlacedMemberId = state?.lastPlacedMemberId || null;
    const lastPlacedCasinoNo = toPlainInt(state?.lastPlacedCasinoNo, 0);
    const lastPlacedDiceCount = toPlainInt(state?.lastPlacedDiceCount, 0);
    const lastPlacedPlayer = lastPlacedMemberId
        ? players.find((player) => Number(player.memberId) === Number(lastPlacedMemberId))
        : null;
    const lastPlacedText = lastPlacedCasinoNo
        ? `${lastPlacedPlayer?.nickname || `플레이어 ${lastPlacedMemberId}`}님이 ${casinoName[lastPlacedCasinoNo] || `${lastPlacedCasinoNo}번`}에 주사위 ${lastPlacedDiceCount}개를 배팅했습니다.`
        : "";

    const ensureSocket = async () => {
        if (stompRef.current) return stompRef.current;
        if (stompInitRef.current) return stompInitRef.current;
        const connectHeaders = buildStompConnectHeaders();
        if (!connectHeaders.Authorization) return null;
        stompInitRef.current = createStompClient({
            endpoint: "/ws/chat",
            connectHeaders,
            reconnectDelay: 3000,
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000,
        }).then((client) => {
            if (!mountedRef.current) return null;
            client.onStompError = (frame) => {
                void notifyRealtimeError({
                    scope: "las-vegas-game",
                    error: frame,
                    fallbackMessage: "게임 실시간 연결 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
                });
            };
            client.beforeConnect = () => {
                client.connectHeaders = buildStompConnectHeaders();
            };
            client.onConnect = () => {
                bindLatestRealtimeRoom(client);
            };
            client.activate();
            stompRef.current = client;
            return client;
        }).finally(() => {
            stompInitRef.current = null;
        });
        return stompInitRef.current;
    };

    const subscribeGameRoom = (client, roomId) => {
        if (gameSubRef.current) gameSubRef.current.unsubscribe();
        gameSubRef.current = client.subscribe(`/sub/game/las-vegas/room/${roomId}`, (msg) => {
            let payload;
            try {
                payload = normalizeLasVegasState(JSON.parse(msg.body || "{}"));
            } catch {
                fetchState(roomId).catch(() => {});
                return;
            }
            setState(payload);
            refreshSelectedRoom(roomId).catch(() => {});
            if (payload.message) notify(payload.message);
        });
    };

    const refreshSelectedRoom = async (roomId) => {
        const myRooms = await lasVegasGameAdapter.fetchMyActiveRooms();
        const matchedRoom = myRooms.find((room) => Number(normalizeRoomId(room)) === Number(roomId));
        if (matchedRoom) setSelectedRoom(matchedRoom);
        return matchedRoom || null;
    };

    const subscribeChatRoom = (client, roomId) => {
        if (chatSubRef.current) chatSubRef.current.unsubscribe();
        chatSubRef.current = client.subscribe(`/sub/chat/room/${roomId}`, (msg) => {
            let payload;
            try {
                payload = normalizeMessage(JSON.parse(msg.body || "{}"));
            } catch {
                fetchChatMessages(roomId).catch(() => {});
                return;
            }
            if (payload) setChatMessages((prev) => [...prev, payload].sort(compareMessagesByChronology));
            markChatRoomAsRead(roomId).catch(() => {});
        });
    };

    const fetchRooms = async () => {
        setRooms(await lasVegasGameAdapter.fetchRooms());
    };

    const fetchState = async (roomId) => {
        const snapshot = await lasVegasGameAdapter.fetchRoomState(roomId);
        setState(snapshot);
        return snapshot;
    };

    const fetchChatMessages = async (roomId) => {
        try {
            setChatMessages(await chatAdapter.fetchRoomMessages(roomId));
        } catch {
            setChatMessages([]);
        }
    };

    const markChatRoomAsRead = async (roomId) => {
        if (!roomId) return;
        const now = Date.now();
        if (now - lastReadMarkAtRef.current < 1000) return;
        lastReadMarkAtRef.current = now;
        await chatAdapter.markRoomRead(roomId);
        window.dispatchEvent(new CustomEvent(CHAT_ROOM_READ_EVENT, { detail: { roomId: String(roomId) } }));
    };

    const bindRealtimeRoom = (client, roomId, targetChatRoomId) => {
        if (!client?.connected || !roomId) return;
        subscribeGameRoom(client, roomId);
        if (targetChatRoomId) subscribeChatRoom(client, targetChatRoomId);
    };

    const bindLatestRealtimeRoom = (client) => {
        const target = realtimeRoomRef.current;
        if (!target) return;
        bindRealtimeRoom(client, target.roomId, target.chatRoomId);
    };

    const hydrateRoomContext = async (room) => {
        setSelectedRoom(room);
        const roomId = normalizeRoomId(room);
        if (!roomId) return;
        localStorage.setItem(ROOM_STORAGE_KEY, String(roomId));

        const loadSnapshot = async () => {
            const snapshot = await fetchState(roomId);
            const snapshotChatRoomId = normalizeChatRoomId(snapshot) || normalizeChatRoomId(room);
            if (snapshotChatRoomId) {
                await fetchChatMessages(snapshotChatRoomId);
                await markChatRoomAsRead(snapshotChatRoomId);
            } else {
                setChatMessages([]);
            }
            return snapshotChatRoomId;
        };
        const snapshotChatRoomId = await loadSnapshot();

        realtimeRoomRef.current = { roomId, chatRoomId: snapshotChatRoomId };
        const client = await ensureSocket();
        if (client?.connected) {
            bindRealtimeRoom(client, roomId, snapshotChatRoomId);
        }
    };

    useEffect(() => {
        fetchRooms().catch(() => notifyError("방 목록을 불러오지 못했습니다."));
    }, []);

    useEffect(() => {
        const restore = async () => {
            try {
                const myRooms = await lasVegasGameAdapter.fetchMyActiveRooms();
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
            roundCount: String(selectedRoom.roundCount || 4),
            turnTimeSeconds: String(selectedRoom.turnTimeSeconds || 25),
        });
    }, [selectedRoom]);

    useEffect(() => {
        if (!state?.turnDeadlineAt) {
            setSecondsLeft(null);
            return;
        }
        const tick = () => {
            const ms = new Date(state.turnDeadlineAt).getTime() - Date.now();
            setSecondsLeft(Math.max(0, Math.ceil(ms / 1000)));
        };
        tick();
        const timer = setInterval(tick, 500);
        return () => clearInterval(timer);
    }, [state?.turnDeadlineAt]);

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
            const casinoNo = casino.casinoNo;
            const diceByPlayer = casino.diceByPlayer || {};
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
                setTimeout(() => setHotCasinoNo(null), 6000);
            }
        }
    }, [state?.casinos]);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (gameSubRef.current) gameSubRef.current.unsubscribe();
            if (chatSubRef.current) chatSubRef.current.unsubscribe();
            if (stompRef.current) stompRef.current.deactivate();
            realtimeRoomRef.current = null;
            stompInitRef.current = null;
        };
    }, []);

    const createRoom = async (e) => {
        e.preventDefault();
        try {
            setCreating(true);
            const room = await lasVegasGameAdapter.createRoom({
                title: createForm.title,
                roundCount: toPlainInt(createForm.roundCount, 4),
                turnTimeSeconds: toPlainInt(createForm.turnTimeSeconds, 25),
            });
            await hydrateRoomContext(room);
            await fetchRooms();
            notifySuccess("방 생성 완료");
        } catch {
            notifyError("방 생성 실패");
        } finally {
            setCreating(false);
        }
    };

    const joinRoom = async (roomId) => {
        try {
            setLoading(true);
            const room = await lasVegasGameAdapter.joinRoom(roomId);
            await hydrateRoomContext(room);
            await fetchRooms();
            notifySuccess("입장 완료");
        } catch {
            notifyError("입장 실패");
        } finally {
            setLoading(false);
        }
    };

    const joinRoomByCode = async (e) => {
        e.preventDefault();
        const normalizedCode = joinCode.trim().toUpperCase();
        if (!normalizedCode) {
            notifyError("방코드를 입력해 주세요.");
            return;
        }
        try {
            setLoading(true);
            const room = await lasVegasGameAdapter.joinByCode(normalizedCode);
            setJoinCode("");
            await hydrateRoomContext(room);
            await fetchRooms();
            notifySuccess("방코드로 입장했습니다.");
        } catch {
            notifyError("방코드 입장에 실패했습니다.");
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
            master.gain.setValueAtTime(0.20 * LAS_VEGAS_SOUND_VOLUME_MULTIPLIER, now);
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
        master.gain.setValueAtTime(0.40 * LAS_VEGAS_SOUND_VOLUME_MULTIPLIER, now);
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

    const publishGameAction = async (actionType, casinoNo = null) => {
        if (!selectedRoom || !myMemberId) return;
        const roomId = normalizeRoomId(selectedRoom);
        if (!roomId) return;
        const client = await ensureSocket();
        if (!client?.connected) {
            notifyError("실시간 연결이 아직 준비되지 않았습니다.");
            return;
        }
        playActionSound(actionType);
        client.publish({
            destination: `/pub/game/las-vegas/${roomId}/action`,
            body: JSON.stringify(buildLasVegasActionPayload({ actionType, casinoNo })),
            headers: { "content-type": "application/json" },
        });
    };

    const sendChatMessage = async () => {
        if (!chatInput.trim() || !chatRoomId || !myMemberId) return;
        const client = await ensureSocket();
        if (!client?.connected) {
            notifyError("채팅 연결이 아직 준비되지 않았습니다.");
            return;
        }
        const message = chatInput.trim();
        client.publish({
            destination: "/pub/chat/message",
            body: JSON.stringify(buildTalkPayload({ roomId: chatRoomId, senderId: myMemberId, message })),
            headers: { "content-type": "application/json" },
        });
        setChatInput("");
    };

    const updateSettings = async () => {
        if (!selectedRoom) return;
        const roomId = normalizeRoomId(selectedRoom);
        try {
            const room = await lasVegasGameAdapter.updateSettings(roomId, {
                roundCount: toPlainInt(settingsForm.roundCount, 4),
                turnTimeSeconds: toPlainInt(settingsForm.turnTimeSeconds, 25),
            });
            setSelectedRoom(room);
            notifySuccess("설정 저장 완료");
        } catch {
            notifyError("설정 저장 실패");
        }
    };

    const toggleReady = async () => {
        if (!selectedRoom) return;
        if (roomStatus !== "WAITING") {
            notifyError("대기 상태에서만 준비를 변경할 수 있습니다.");
            return;
        }
        const roomId = normalizeRoomId(selectedRoom);
        try {
            await lasVegasGameAdapter.toggleReady(roomId);
            notifySuccess("준비 상태 반영");
        } catch {
            notifyError("준비 상태 변경 실패");
        }
    };

    const startGame = async () => {
        if (!selectedRoom) return;
        if (roomStatus !== "WAITING") {
            notifyError("한 판 더 하기로 대기 상태를 만든 뒤 시작할 수 있습니다.");
            return;
        }
        const roomId = normalizeRoomId(selectedRoom);
        try {
            await lasVegasGameAdapter.startGame(roomId);
            notifySuccess("게임 시작");
        } catch {
            notifyError("게임 시작 실패");
        }
    };

    const rematchGame = async () => {
        if (!selectedRoom) return;
        const roomId = normalizeRoomId(selectedRoom);
        try {
            setRematching(true);
            const room = await lasVegasGameAdapter.rematch(roomId);
            setSelectedRoom(room);
            await fetchState(roomId);
            await fetchRooms();
            notifySuccess("같은 방에서 새 판 준비를 시작했습니다.");
        } catch {
            notifyError("한 판 더 하기 준비에 실패했습니다.");
        } finally {
            setRematching(false);
        }
    };

    const forceFinishGame = async () => {
        if (!selectedRoom) return;
        const confirmed = await confirmAction({
            title: "진행 중인 판을 종료할까요?",
            description: "현재 판은 취소되고 같은 방의 대기 상태로 돌아갑니다.",
            confirmText: "종료",
        });
        if (!confirmed) return;
        const roomId = normalizeRoomId(selectedRoom);
        try {
            setForceFinishing(true);
            const room = await lasVegasGameAdapter.forceFinish(roomId);
            setSelectedRoom(room);
            await fetchState(roomId);
            await fetchRooms();
            notifySuccess("현재 게임을 종료하고 대기 상태로 돌아갔습니다.");
        } catch {
            notifyError("강제 종료에 실패했습니다.");
        } finally {
            setForceFinishing(false);
        }
    };

    const leaveRoom = async () => {
        if (!selectedRoom) return;
        const roomId = normalizeRoomId(selectedRoom);
        try {
            await lasVegasGameAdapter.leaveRoom(roomId);
            setSelectedRoom(null);
            setState(null);
            setChatMessages([]);
            localStorage.removeItem(ROOM_STORAGE_KEY);
            realtimeRoomRef.current = null;
            if (gameSubRef.current) gameSubRef.current.unsubscribe();
            if (chatSubRef.current) chatSubRef.current.unsubscribe();
            await fetchRooms();
            notifySuccess("방 퇴장");
        } catch {
            notifyError("퇴장 실패");
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
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-white/10 p-2.5"><Dices className="h-5 w-5" /></div>
                        <div>
                            <h1 className="text-xl font-black tracking-tight">라스베가스 라이브 테이블</h1>
                            <p className="text-xs text-slate-300">방장 설정 + 실시간 턴 + 자동 타임아웃 액션</p>
                        </div>
                    </div>
                    <Link to="/app/games" className="hidden min-h-10 items-center justify-center rounded-xl bg-white/10 px-4 text-sm font-black text-white transition hover:bg-white hover:text-slate-900 sm:inline-flex">
                        게임 목록
                    </Link>
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
                        value={createForm.roundCount}
                        onChange={(e) => setCreateForm((prev) => ({ ...prev, roundCount: normalizeNumericText(e.target.value, 1, 10) }))}
                    />
                    <input
                        className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white"
                        type="text"
                        inputMode="numeric"
                        value={createForm.turnTimeSeconds}
                        onChange={(e) => setCreateForm((prev) => ({ ...prev, turnTimeSeconds: normalizeNumericText(e.target.value, 5, 180) }))}
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
                        <button type="submit" className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white disabled:opacity-50" disabled={loading}>
                            코드 입장
                        </button>
                    </form>
                    <div className="space-y-2.5">
                        {!rooms.length && <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-400">대기 중인 방이 없습니다.</div>}
                        {rooms.map((room) => {
                            const roomId = normalizeRoomId(room);
                            const playersCount = room.memberCount || 0;
                            return (
                                <div key={roomId} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                                    <div>
                                        <div className="text-sm font-black text-slate-900">{room.title}</div>
                                        <div className="text-xs text-slate-500">
                                            코드 {room.roomCode} | {playersCount}/{room.maxPlayers}명 | 라운드 {room.roundCount}
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
                                <div className="text-xs text-slate-500">방 코드 {selectedRoom.roomCode}</div>
                                {isHost && roomStatus === "PLAYING" && (
                                    <button
                                        className="rounded-xl bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-700 disabled:opacity-50"
                                        onClick={forceFinishGame}
                                        disabled={forceFinishing}
                                    >
                                        {forceFinishing ? "종료 중..." : "강제 종료"}
                                    </button>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Link to="/app/games" className="hidden rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700 transition hover:bg-slate-900 hover:text-white sm:inline-flex">
                                    게임 목록
                                </Link>
                                <button className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700" onClick={toggleReady}>준비하기</button>
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
                                <div className="text-slate-500">{selectedRoom.roomCode}</div>
                            </div>
                            <div className="rounded-xl bg-slate-50 px-3 py-2">
                                <div className="font-black text-slate-700">라운드 수</div>
                                <div className="text-slate-500">{toPlainInt(selectedRoom.roundCount, 0)} 라운드</div>
                            </div>
                            <div className="rounded-xl bg-slate-50 px-3 py-2">
                                <div className="font-black text-slate-700">턴 시간</div>
                                <div className="text-slate-500">{toPlainInt(selectedRoom.turnTimeSeconds, 0)}초</div>
                            </div>
                        </div>

                        {isHost && roomStatus === "WAITING" && (
                            <div className="mt-4 grid grid-cols-1 gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 md:grid-cols-4">
                                <input type="text" inputMode="numeric" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={settingsForm.roundCount} onChange={(e) => setSettingsForm((prev) => ({ ...prev, roundCount: normalizeNumericText(e.target.value, 1, 10) }))} />
                                <input type="text" inputMode="numeric" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={settingsForm.turnTimeSeconds} onChange={(e) => setSettingsForm((prev) => ({ ...prev, turnTimeSeconds: normalizeNumericText(e.target.value, 5, 180) }))} />
                                <button className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-black text-white md:col-span-2" onClick={updateSettings}>방 설정 저장</button>
                            </div>
                        )}
                    </div>

                    <div className={`grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] ${myTurn ? "rounded-[1.8rem] bg-sky-100/70 p-3 ring-2 ring-sky-300/70" : ""}`}>
                        <div className="space-y-4">
                            <div className={`rounded-[1.8rem] border p-4 shadow-2xl transition-all ${
                                myTurn
                                    ? "border-sky-200 bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-600"
                                    : "border-white/20 bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-800"
                            }`}>
                                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-black text-emerald-50">
                                    <span className="rounded-full bg-white/20 px-2.5 py-1">라운드 {state?.roundNo || 0} / {state?.roundCount || 0}</span>
                                    <span className="rounded-full bg-white/20 px-2.5 py-1">
                                        차례 {state?.players?.find((p) => Number(p.memberId) === Number(state.turnMemberId))?.nickname || "-"}
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

                                {!!currentRoll.length && (
                                    <div className="mb-3 rounded-2xl border border-white/20 bg-white/15 p-3 shadow-inner">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div>
                                                <div className="text-[11px] font-black text-cyan-100">공개 굴림</div>
                                                <div className="text-sm font-black text-white">{currentRollPlayerName}님의 주사위</div>
                                            </div>
                                            <div className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-black text-white">
                                                배팅할 숫자 선택 대기
                                            </div>
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                            {currentRoll.map((value, idx) => <DiceFace key={`public-roll-${idx}`} value={toPlainInt(value, 1)} size={32} />)}
                                        </div>
                                        <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                                            {[1, 2, 3, 4, 5, 6].map((face) => (
                                                <div key={`public-roll-count-${face}`} className="rounded-xl bg-white/10 px-2 py-1.5 text-center text-[11px] font-black text-white">
                                                    {face}번 {toPlainInt(currentRollCountByFace[face], 0)}개
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {lastPlacedText && (
                                    <div className="mb-3 rounded-2xl border border-amber-200/50 bg-amber-300/20 px-3 py-2 text-xs font-black leading-relaxed text-amber-50">
                                        {lastPlacedText}
                                    </div>
                                )}

                                {!isFinished && myTurn && (
                                    <div className="mb-3 rounded-2xl bg-white/10 p-3">
                                        <div className="mb-2 text-xs font-black text-emerald-100">내 행동</div>
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
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-2 md:gap-3 xl:grid-cols-3">
                                    {(state?.casinos || []).map((casino) => (
                                        <CasinoPanel
                                            key={casino.casinoNo}
                                            casino={casino}
                                            statePlayers={state?.players}
                                            isHot={Number(casino.casinoNo) === Number(hotCasinoNo)}
                                            isLastPlaced={Number(casino.casinoNo) === Number(lastPlacedCasinoNo)}
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
                                        const memberId = player.memberId;
                                        const isCurrent = Number(memberId) === Number(state?.turnMemberId);
                                        const isReady = readyMemberIds.has(Number(memberId));
                                        return (
                                            <div key={`player-${memberId}`} className={`rounded-xl border p-3 ${isCurrent ? "border-primary-400 bg-primary-50" : "border-slate-100 bg-slate-50"}`}>
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        <UserAvatar name={player.nickname} profileUrl={player.profileUrl} size="sm" />
                                                        <div className="min-w-0 truncate text-sm font-black text-slate-900">{player.nickname}</div>
                                                    </div>
                                                    {roomStatus === "WAITING" && (
                                                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black ${isReady ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                                            {isReady ? "준비" : "대기"}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mt-1 text-xs font-bold text-slate-600">
                                                    보유금 {formatWon(player.totalMoney || 0)} | 남은 주사위 {player.remainingDice || 8}
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
                            <div ref={chatScrollRef} className="mb-3 h-[min(34vh,260px)] space-y-2 overflow-auto overscroll-contain rounded-2xl bg-slate-50 p-3 text-xs sm:h-[320px] xl:h-[420px]">
                                {!chatMessages.length && <div className="text-slate-400">채팅 내역이 없습니다.</div>}
                                {chatMessages.map((msg) => {
                                    const normalized = normalizeMessage(msg);
                                    return (
                                    <div key={normalized.key || normalized.id} className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                                        <div className="flex items-center gap-2 font-black text-slate-800">
                                            <UserAvatar name={normalized.senderName || "SYSTEM"} profileUrl={normalized.senderProfileUrl} size="xs" />
                                            <span className="min-w-0 truncate">{normalized.senderName || "SYSTEM"}</span>
                                        </div>
                                        <div className="mt-0.5 text-slate-700">{normalized.message || ""}</div>
                                    </div>
                                    );
                                })}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
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
                    게임규칙
                </div>
                <div>각 라운드마다 1번부터 6번 카지노에 머니 카드가 배치되고, 모든 카지노는 최소 7만원 이상이되도록 카드가 깔립니다.</div>
                <div>내 차례에는 주사위를 굴린 뒤 같은 숫자 주사위를 한 카지노에 모두 배치해야 하며, 시간 초과시에는 자동으로 굴림 또는 배치가 진행됩니다.</div>
                <div>라운드 종료 후 같은 카지노에서 주사위 수가 동점인 플레이어는 모두 탈락하고, 남은 플레이어가 많은 주사위 순서대로 큰 금액 카드부터 가져갑니다.</div>
                <div>한 카지노에 배팅한 플레이어가 정확히 1명뿐이면 그 플레이어가 해당 카지노의 머니 카드를 모두 가져가며, 모든 라운드 수익 합계가 가장 큰 플레이어가 최종 우승합니다.</div>
            </section>
        </div>
    );
};

export default LasVegasGame;
