import { useEffect, useMemo, useRef, useState } from "react";
import { notifyError, notifySuccess } from "../../utils/toast.js";
import { CheckCircle2, Crown, MessageSquare, Play, TimerReset } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { confirmAction } from "../../common/confirmAction.jsx";
import { buildTalkPayload, chatAdapter, compareMessagesByChronology, getMemberId, normalizeMessage } from "../../adapters/chatAdapter.js";
import { buildStompConnectHeaders, createStompClient, notifyRealtimeError } from "../../adapters/realtimeAdapter.js";
import {
  buildNoThanksActionPayload,
  getNoThanksChatRoomId,
  getNoThanksPlayerId,
  getNoThanksRoomId,
  isNoThanksReadyPlayer,
  noThanksGameAdapter,
  noThanksGameErrorMessage,
  noThanksRoomStatusLabel,
  normalizeNoThanksState,
} from "../../adapters/noThanksGameAdapter.js";
import { useGameSound } from "../../hooks/useGameSound.js";

const ROOM_STORAGE_KEY = "no_thanks_last_room_id";
const CHAT_ROOM_READ_EVENT = "chat-room-read";
const NO_THANKS_SOUND_VOLUME_MULTIPLIER = 4;

const roomIdOf = getNoThanksRoomId;
const chatRoomIdOf = getNoThanksChatRoomId;
const parseIntSafe = (value, fallback = 0) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const normalizeNumberDraft = (raw) => {
  const digits = String(raw ?? "").replace(/[^\d]/g, "");
  if (!digits) return "";
  return digits.replace(/^0+(\d)/, "$1");
};
const clampNumberText = (raw, min, max, fallback) => {
  const normalized = normalizeNumberDraft(raw);
  if (!normalized) return String(fallback);
  const clamped = Math.min(max, Math.max(min, parseIntSafe(normalized, fallback)));
  return String(clamped);
};
const isReadyPlayer = isNoThanksReadyPlayer;
const playerIdOf = (player) => Number(getNoThanksPlayerId(player) || 0);
const cardsLabel = (cards) => (Array.isArray(cards) && cards.length ? cards.join(", ") : "-");

export const NoThanksGame = () => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [chipAnimations, setChipAnimations] = useState([]);
  const [createForm, setCreateForm] = useState({ title: "", startChipCount: "11", turnTimeSeconds: "15" });
  const [settingsForm, setSettingsForm] = useState({ startChipCount: "11", turnTimeSeconds: "15" });

  const stompRef = useRef(null);
  const stompInitRef = useRef(null);
  const gameSubRef = useRef(null);
  const chatSubRef = useRef(null);
  const realtimeRoomRef = useRef(null);
  const mountedRef = useRef(false);
  const chatScrollRef = useRef(null);
  const audioContextRef = useRef(null);
  const isActionSoundPlayingRef = useRef(false);
  const previousPotChipsRef = useRef(0);
  const chipAnimationIdRef = useRef(0);
  const lastReadMarkAtRef = useRef(0);

  const myMemberId = Number(getMemberId(user) || user?.id || 0);
  const roomStatus = gameState?.roomStatus || selectedRoom?.roomStatus || null;
  const statePlayers = Array.isArray(gameState?.players) ? gameState.players : [];
  const roomPlayers = Array.isArray(selectedRoom?.players) ? selectedRoom.players : [];
  const players = statePlayers.length ? statePlayers : roomPlayers;
  const hostMemberId = Number(selectedRoom?.hostMemberId || 0);
  const isHost = Boolean(selectedRoom && hostMemberId === myMemberId);
  const turnMemberId = Number(gameState?.turnMemberId || 0);
  const isMyTurn = Boolean(myMemberId && turnMemberId === myMemberId);
  const currentCard = gameState?.currentCard ?? null;
  const potChips = parseIntSafe(gameState?.potChips, 0);
  const deckRemaining = parseIntSafe(gameState?.deckRemainingCount, 0);
  const winnerMemberId = Number(gameState?.winnerMemberId || 0);
  const chatRoomId = chatRoomIdOf(gameState) || chatRoomIdOf(selectedRoom);
  const myPlayer = players.find((player) => playerIdOf(player) === myMemberId) || null;
  const myChips = parseIntSafe(myPlayer?.chips, 0);
  const readyMemberIds = useMemo(() => new Set(players.filter(isReadyPlayer).map(playerIdOf)), [players]);
  const hostNickname = players.find((player) => playerIdOf(player) === hostMemberId)?.nickname || "-";
  const winnerNickname = winnerMemberId ? players.find((player) => playerIdOf(player) === winnerMemberId)?.nickname || `플레이어 ${winnerMemberId}` : null;
  const sortedPlayers = [...players].sort((a, b) => {
    const aScore = a?.score ?? Number.MAX_SAFE_INTEGER;
    const bScore = b?.score ?? Number.MAX_SAFE_INTEGER;
    if (aScore !== bScore) return aScore - bScore;
    return parseIntSafe(b?.chips, 0) - parseIntSafe(a?.chips, 0);
  });
  const visiblePotChipCount = Math.min(potChips, 30);
  const potChipStack = Array.from({ length: visiblePotChipCount }, (_, index) => ({
    id: `stack-${index}`,
    offsetX: (index % 6) * 36,
    offsetY: Math.floor(index / 6) * 36,
    rotate: 0,
  }));

  useGameSound({ myTurn: roomStatus === "PLAYING" && isMyTurn });

  const normalizeCreateField = (field, min, max, fallback) => {
    setCreateForm((prev) => ({ ...prev, [field]: clampNumberText(prev[field], min, max, fallback) }));
  };

  const normalizeSettingsField = (field, min, max, fallback) => {
    setSettingsForm((prev) => ({ ...prev, [field]: clampNumberText(prev[field], min, max, fallback) }));
  };

  const getAudioContext = () => {
    if (typeof window === "undefined") return null;
    if (audioContextRef.current) return audioContextRef.current;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return null;
    audioContextRef.current = new AudioContextCtor();
    return audioContextRef.current;
  };

  const playActionSound = (actionType) => {
    const context = getAudioContext();
    if (!context || isActionSoundPlayingRef.current) return;
    if (context.state === "suspended") {
      context.resume().catch(() => {});
    }

    const now = context.currentTime;
    const master = context.createGain();
    const primary = context.createOscillator();
    const accent = context.createOscillator();
    const gain = context.createGain();

    try {
      isActionSoundPlayingRef.current = true;
      if (actionType === "TAKE") {
        master.gain.setValueAtTime(0.20 * NO_THANKS_SOUND_VOLUME_MULTIPLIER, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.36, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

        primary.type = "triangle";
        primary.frequency.setValueAtTime(880, now);
        primary.frequency.exponentialRampToValueAtTime(660, now + 0.12);

        accent.type = "sine";
        accent.frequency.setValueAtTime(1320, now);
        accent.frequency.exponentialRampToValueAtTime(990, now + 0.08);
      } else {
        master.gain.setValueAtTime(0.14 * NO_THANKS_SOUND_VOLUME_MULTIPLIER, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.24, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

        primary.type = "square";
        primary.frequency.setValueAtTime(620, now);
        primary.frequency.exponentialRampToValueAtTime(420, now + 0.09);

        accent.type = "triangle";
        accent.frequency.setValueAtTime(930, now);
        accent.frequency.exponentialRampToValueAtTime(700, now + 0.06);
      }

      primary.connect(gain);
      accent.connect(gain);
      gain.connect(master);
      master.connect(context.destination);

      primary.start(now);
      accent.start(now);
      primary.stop(now + (actionType === "TAKE" ? 0.12 : 0.09));
      accent.stop(now + (actionType === "TAKE" ? 0.08 : 0.06));

      window.setTimeout(() => {
        isActionSoundPlayingRef.current = false;
      }, actionType === "TAKE" ? 140 : 110);
    } catch {
      isActionSoundPlayingRef.current = false;
    }
  };

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
          scope: "no-thanks-game",
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

  const fetchRooms = async () => {
    setRooms(await noThanksGameAdapter.fetchRooms());
  };

  const fetchState = async (roomId) => {
    const snapshot = await noThanksGameAdapter.fetchRoomState(roomId);
    setGameState(snapshot);
    return snapshot;
  };

  const fetchMyRooms = async () => {
    return noThanksGameAdapter.fetchMyActiveRooms();
  };

  const refreshSelectedRoom = async (roomId) => {
    const myRooms = await fetchMyRooms();
    const matched = myRooms.find((room) => Number(roomIdOf(room)) === Number(roomId)) || null;
    if (matched) setSelectedRoom(matched);
    return matched;
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

  const subscribeGameRoom = (client, roomId) => {
    if (gameSubRef.current) gameSubRef.current.unsubscribe();
    gameSubRef.current = client.subscribe(`/sub/game/no-thanks/room/${roomId}`, (message) => {
      let payload;
      try {
        payload = JSON.parse(message.body || "{}");
      } catch {
        fetchState(roomId).catch(() => {});
        return;
      }
      setGameState(normalizeNoThanksState(payload));
      refreshSelectedRoom(roomId).catch(() => {});
    });
  };

  const subscribeChatRoom = (client, roomId) => {
    if (chatSubRef.current) chatSubRef.current.unsubscribe();
    chatSubRef.current = client.subscribe(`/sub/chat/room/${roomId}`, (message) => {
      let payload;
      try {
        payload = JSON.parse(message.body || "{}");
      } catch {
        fetchChatMessages(roomId).catch(() => {});
        return;
      }
      const normalized = normalizeMessage(payload);
      if (normalized) setChatMessages((prev) => [...prev, normalized].sort(compareMessagesByChronology));
      markChatRoomAsRead(roomId).catch(() => {});
    });
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

  const openRoom = async (room) => {
    setSelectedRoom(room);
    const roomId = roomIdOf(room);
    if (!roomId) return;
    localStorage.setItem(ROOM_STORAGE_KEY, String(roomId));

    const snapshot = await fetchState(roomId);
    const snapshotChatRoomId = chatRoomIdOf(snapshot) || chatRoomIdOf(room);
    if (snapshotChatRoomId) {
      await fetchChatMessages(snapshotChatRoomId);
      await markChatRoomAsRead(snapshotChatRoomId);
    } else {
      setChatMessages([]);
    }
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
    (async () => {
      try {
        const myRooms = await fetchMyRooms();
        const storedId = Number(localStorage.getItem(ROOM_STORAGE_KEY) || 0);
        const room = myRooms.find((item) => Number(roomIdOf(item)) === storedId) || myRooms[0];
        if (room) await openRoom(room);
      } catch {
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedRoom) return;
    setSettingsForm({
      startChipCount: String(selectedRoom.startChipCount || 11),
      turnTimeSeconds: String(selectedRoom.turnTimeSeconds || 15),
    });
  }, [selectedRoom]);

  useEffect(() => {
    if (!gameState?.turnDeadlineAt) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => {
      const ms = new Date(gameState.turnDeadlineAt).getTime() - Date.now();
      setSecondsLeft(Math.max(0, Math.ceil(ms / 1000)));
    };
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [gameState?.turnDeadlineAt]);

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
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
    const previous = previousPotChipsRef.current;
    if (potChips > previous) {
      const additions = Math.min(potChips - previous, 3);
      const nextAnimations = Array.from({ length: additions }, (_, index) => {
        chipAnimationIdRef.current += 1;
        const targetIndex = Math.min(previous + index, 29);
        return {
          id: chipAnimationIdRef.current,
          delay: index * 90,
          rotate: 0,
          targetX: (targetIndex % 6) * 36,
          targetY: Math.floor(targetIndex / 6) * 36,
        };
      });
      setChipAnimations(nextAnimations);
      const timer = window.setTimeout(() => setChipAnimations([]), 720);
      previousPotChipsRef.current = potChips;
      return () => window.clearTimeout(timer);
    }
    if (potChips === 0 && previous !== 0) {
      setChipAnimations([]);
    }
    previousPotChipsRef.current = potChips;
  }, [potChips]);

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

  const createRoom = async (event) => {
    event.preventDefault();
    try {
      const room = await noThanksGameAdapter.createRoom({
        title: createForm.title,
        startChipCount: parseIntSafe(createForm.startChipCount, 11),
        turnTimeSeconds: parseIntSafe(createForm.turnTimeSeconds, 15),
      });
      await openRoom(room);
      await fetchRooms();
      notifySuccess("방 생성 완료");
    } catch (error) {
      notifyError(noThanksGameErrorMessage(error, "방 생성 실패"));
    }
  };

  const joinRoom = async (roomId) => {
    try {
      const room = await noThanksGameAdapter.joinRoom(roomId);
      await openRoom(room);
      await fetchRooms();
      notifySuccess("방 입장 완료");
    } catch (error) {
      notifyError(noThanksGameErrorMessage(error, "방 입장 실패"));
    }
  };

  const joinByCode = async (event) => {
    event.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      notifyError("방 코드를 입력해주세요.");
      return;
    }
    try {
      const room = await noThanksGameAdapter.joinByCode(code);
      setJoinCode("");
      await openRoom(room);
      await fetchRooms();
      notifySuccess("방 코드로 입장했습니다.");
    } catch (error) {
      notifyError(noThanksGameErrorMessage(error, "방 코드 입장 실패"));
    }
  };

  const saveSettings = async () => {
    if (!selectedRoom) return;
    try {
      const room = await noThanksGameAdapter.updateSettings(roomIdOf(selectedRoom), {
        startChipCount: parseIntSafe(settingsForm.startChipCount, 11),
        turnTimeSeconds: parseIntSafe(settingsForm.turnTimeSeconds, 15),
      });
      setSelectedRoom(room);
      await fetchRooms();
      notifySuccess("방 설정 저장 완료");
    } catch (error) {
      notifyError(noThanksGameErrorMessage(error, "방 설정 저장 실패"));
    }
  };

  const toggleReady = async () => {
    if (!selectedRoom) return;
    try {
      await noThanksGameAdapter.toggleReady(roomIdOf(selectedRoom));
    } catch (error) {
      notifyError(noThanksGameErrorMessage(error, "준비 상태 변경 실패"));
    }
  };

  const startGame = async () => {
    if (!selectedRoom) return;
    try {
      await noThanksGameAdapter.startGame(roomIdOf(selectedRoom));
    } catch (error) {
      notifyError(noThanksGameErrorMessage(error, "게임 시작 실패"));
    }
  };

  const rematchGame = async () => {
    if (!selectedRoom) return;
    try {
      const room = await noThanksGameAdapter.rematch(roomIdOf(selectedRoom));
      setSelectedRoom(room);
      await fetchRooms();
      notifySuccess("방이 다시 열렸습니다.");
    } catch (error) {
      notifyError(noThanksGameErrorMessage(error, "방 다시 열기 실패"));
    }
  };

  const forceFinishGame = async () => {
    if (!selectedRoom) return;
    const confirmed = await confirmAction({
      title: "진행 중인 게임을 종료할까요?",
      description: "현재 판을 종료하고 대기방으로 돌아갑니다.",
      confirmText: "종료",
    });
    if (!confirmed) return;
    try {
      const room = await noThanksGameAdapter.forceFinish(roomIdOf(selectedRoom));
      setSelectedRoom(room);
      await fetchRooms();
      notifySuccess("게임 종료 완료");
    } catch (error) {
      notifyError(noThanksGameErrorMessage(error, "게임 종료 실패"));
    }
  };

  const leaveRoom = async () => {
    if (!selectedRoom) return;
    try {
      await noThanksGameAdapter.leaveRoom(roomIdOf(selectedRoom));
      setSelectedRoom(null);
      setGameState(null);
      setChatMessages([]);
      localStorage.removeItem(ROOM_STORAGE_KEY);
      realtimeRoomRef.current = null;
      if (gameSubRef.current) gameSubRef.current.unsubscribe();
      if (chatSubRef.current) chatSubRef.current.unsubscribe();
      await fetchRooms();
      notifySuccess("방 퇴장 완료");
    } catch (error) {
      notifyError(noThanksGameErrorMessage(error, "방 퇴장 실패"));
    }
  };

  const publishAction = async (actionType) => {
    if (!selectedRoom) return;
    const client = await ensureSocket();
    if (!client?.connected) {
      notifyError("실시간 연결이 아직 준비되지 않았습니다.");
      return;
    }
    playActionSound(actionType);
    client.publish({
      destination: `/pub/game/no-thanks/${roomIdOf(selectedRoom)}/action`,
      body: JSON.stringify(buildNoThanksActionPayload({ actionType })),
    });
  };

  const sendChat = async () => {
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

  return (
    <div className="animate-fade-in space-y-6">
      <style>{`
        @keyframes no-thanks-chip-drop {
          0% { transform: translate(68px, -70px) scale(0.7) rotate(0deg); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translate(var(--chip-x), var(--chip-y)) scale(1) rotate(var(--chip-rotate)); opacity: 1; }
        }
      `}</style>
      {!selectedRoom && (
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
            <Play className="h-3.5 w-3.5 text-emerald-500" />
            노땡스
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">노땡스</h1>
          <p className="mt-3 text-sm font-medium text-slate-500 sm:text-base">
            더 많은 칩 그리고 더 적은 숫자의 카드를 보유하여 승리하세요.
          </p>
        </section>
      )}

      {!selectedRoom && (
        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <form onSubmit={createRoom} className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-lg">
            <div className="text-lg font-black text-slate-900">방 만들기</div>
            <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-slate-500 md:grid-cols-2">
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <div className="font-black text-slate-700">토큰 개수</div>
                <div>시작 시 각 플레이어에게 지급되는 칩 수입니다. 5~20 범위로 설정할 수 있습니다.</div>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <div className="font-black text-slate-700">제한 시간</div>
                <div>한 턴 동안 행동할 수 있는 시간입니다. 5~60초 범위로 설정할 수 있습니다.</div>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="방 제목" value={createForm.title} onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" inputMode="numeric" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="토큰 개수" value={createForm.startChipCount} onChange={(e) => setCreateForm((prev) => ({ ...prev, startChipCount: normalizeNumberDraft(e.target.value) }))} onBlur={() => normalizeCreateField("startChipCount", 5, 20, 11)} />
                <input type="text" inputMode="numeric" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="제한 시간(초)" value={createForm.turnTimeSeconds} onChange={(e) => setCreateForm((prev) => ({ ...prev, turnTimeSeconds: normalizeNumberDraft(e.target.value) }))} onBlur={() => normalizeCreateField("turnTimeSeconds", 5, 60, 15)} />
              </div>
              <button type="submit" className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white">노땡스 방 만들기</button>
            </div>
          </form>

          <section className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="text-lg font-black text-slate-900">대기 중인 방</div>
              <button className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700" onClick={() => fetchRooms().catch(() => {})}>새로고침</button>
            </div>
            <form onSubmit={joinByCode} className="mt-4 flex gap-2">
              <input className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase" placeholder="방 코드로 입장" value={joinCode} maxLength={8} onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
              <button type="submit" className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white">입장</button>
            </form>
            <div className="mt-4 space-y-2.5">
              {!rooms.length && <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-400">대기 중인 방이 없습니다.</div>}
              {rooms.map((room) => (
                <div key={roomIdOf(room)} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div>
                    <div className="text-sm font-black text-slate-900">{room.title}</div>
                    <div className="text-xs text-slate-500">코드 {room.roomCode} | {room.memberCount}/{room.maxPlayers}명 | 시작 칩 {room.startChipCount}</div>
                  </div>
                  <button className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-black text-white" onClick={() => joinRoom(roomIdOf(room))}>입장</button>
                </div>
              ))}
            </div>
          </section>
        </section>
      )}

      {selectedRoom && (
        <section className="space-y-4">
          <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-lg font-black text-slate-900">{selectedRoom.title}</div>
                <div className="text-xs text-slate-500">방 코드 {selectedRoom.roomCode}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {isHost && roomStatus === "PLAYING" && <button className="rounded-xl bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-700" onClick={forceFinishGame}>강제 종료</button>}
                <button className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700" onClick={toggleReady}>준비 토글</button>
                {isHost && roomStatus === "WAITING" && <button className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-black text-white" onClick={startGame}>시작</button>}
                <button className="rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-600" onClick={leaveRoom}>퇴장</button>
              </div>
            </div>

            {isHost && roomStatus === "FINISHED" && (
              <div className="mt-3 flex justify-end">
                <button className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-black text-white" onClick={rematchGame}>한 판 더 하기</button>
              </div>
            )}

            <div className="mt-3 grid grid-cols-1 gap-2 text-xs md:grid-cols-5">
              <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="font-black text-slate-700">방장</div><div className="text-slate-500">{hostNickname}</div></div>
              <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="font-black text-slate-700">방 코드</div><div className="text-slate-500">{selectedRoom.roomCode}</div></div>
              <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="font-black text-slate-700">시작 칩</div><div className="text-slate-500">{parseIntSafe(selectedRoom.startChipCount, 11)}</div></div>
              <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="font-black text-slate-700">턴 시간</div><div className="text-slate-500">{parseIntSafe(selectedRoom.turnTimeSeconds, 15)}초</div></div>
              <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="font-black text-slate-700">상태</div><div className="text-slate-500">{noThanksRoomStatusLabel(roomStatus)}</div></div>
            </div>

            {isHost && roomStatus === "WAITING" && (
              <div className="mt-4 grid grid-cols-1 gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 md:grid-cols-4">
                <input type="text" inputMode="numeric" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={settingsForm.startChipCount} onChange={(e) => setSettingsForm((prev) => ({ ...prev, startChipCount: normalizeNumberDraft(e.target.value) }))} onBlur={() => normalizeSettingsField("startChipCount", 5, 20, 11)} />
                <input type="text" inputMode="numeric" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={settingsForm.turnTimeSeconds} onChange={(e) => setSettingsForm((prev) => ({ ...prev, turnTimeSeconds: normalizeNumberDraft(e.target.value) }))} onBlur={() => normalizeSettingsField("turnTimeSeconds", 5, 60, 15)} />
                <button className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-black text-white md:col-span-2" onClick={saveSettings}>설정 저장</button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
            <div className="space-y-4">
              <div className={`rounded-[1.8rem] border p-5 shadow-xl ${isMyTurn ? "border-sky-200 bg-sky-50" : "border-slate-200 bg-white"}`}>
                <div className="flex flex-wrap items-center gap-2 text-xs font-black text-slate-700">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1">카드 {currentCard ?? "-"}</span>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">칩 더미 {potChips}</span>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">남은 덱 {deckRemaining}</span>
                  {isMyTurn && <span className="rounded-full bg-sky-100 px-2.5 py-1 text-sky-700">내 차례</span>}
                  {secondsLeft !== null && <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${secondsLeft <= 5 ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-700"}`}><TimerReset className="h-3.5 w-3.5" />{secondsLeft}초</span>}
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                  <div className="relative overflow-hidden rounded-[1.5rem] border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-700 p-6 text-white">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-300">현재 카드</div>
                    <div className="mt-3 text-6xl font-black tracking-tight">{currentCard ?? "-"}</div>
                    <div className="relative mt-1 flex h-[196px] justify-center">
                      <div className="relative h-full w-[228px]">
                      {potChipStack.map((chip) => (
                        <div
                          key={chip.id}
                          className="absolute top-0 left-0 h-[48px] w-[48px] rounded-full border-2 border-amber-200 bg-gradient-to-br from-amber-200 via-amber-400 to-orange-500 shadow-[0_8px_18px_rgba(251,191,36,0.32)]"
                          style={{
                            transform: `translate(${chip.offsetX}px, ${chip.offsetY}px) rotate(${chip.rotate}deg)`,
                            zIndex: chip.offsetY + 1,
                          }}
                        >
                          <div className="absolute inset-[5px] rounded-full border border-amber-100/80" />
                          <div className="absolute inset-[14px] rounded-full bg-amber-100/70" />
                        </div>
                      ))}
                      {chipAnimations.map((chip) => (
                        <div
                          key={chip.id}
                          className="absolute top-0 left-0 h-[48px] w-[48px] rounded-full border-2 border-amber-200 bg-gradient-to-br from-amber-200 via-amber-400 to-orange-500 shadow-[0_8px_18px_rgba(251,191,36,0.32)]"
                          style={{
                            "--chip-x": `${chip.targetX}px`,
                            "--chip-y": `${chip.targetY}px`,
                            "--chip-rotate": `${chip.rotate}deg`,
                            animation: `no-thanks-chip-drop 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) ${chip.delay}ms forwards`,
                          }}
                        >
                          <div className="absolute inset-[5px] rounded-full border border-amber-100/80" />
                          <div className="absolute inset-[14px] rounded-full bg-amber-100/70" />
                        </div>
                      ))}
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-slate-300">카드와 칩을 가져가거나 칩 1개를 내고 다음 플레이어에게 넘길 수 있습니다.</div>
                  </div>
                  <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">행동</div>
                    <div className="mt-3 space-y-2">
                      <button className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white disabled:opacity-50" disabled={!(roomStatus === "PLAYING" && isMyTurn)} onClick={() => publishAction("TAKE")}>카드 가져가기</button>
                      <button className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-black text-white disabled:opacity-50" disabled={!(roomStatus === "PLAYING" && isMyTurn && myChips > 0)} onClick={() => publishAction("PASS")}>칩 1개 내고 넘기기</button>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-600">
                        <div>내 칩 {myChips}</div>
                        <div className="mt-1">내 카드 {cardsLabel(myPlayer?.cards)}</div>
                      </div>
                      <div className="text-xs text-slate-500">시간이 초과되면 칩이 남아 있을 때는 자동으로 넘기고, 칩이 없으면 자동으로 카드를 가져갑니다.</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-slate-200 bg-white p-4 shadow-lg">
                <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900"><Crown className="h-4 w-4 text-amber-500" />플레이어</div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {sortedPlayers.map((player) => {
                    const id = playerIdOf(player);
                    const isCurrent = id === turnMemberId;
                    return (
                      <div key={id} className={`rounded-xl border p-3 ${isCurrent ? "border-primary-400 bg-primary-50" : "border-slate-100 bg-slate-50"}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-black text-slate-900">{player.nickname}</div>
                          {roomStatus === "WAITING" && (
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black ${readyMemberIds.has(id) ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {readyMemberIds.has(id) ? "준비" : "대기"}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-xs font-bold text-slate-600">칩 {parseIntSafe(player.chips, 0)} | 카드 {cardsLabel(player.cards)}</div>
                        <div className="mt-1 text-xs text-slate-500">점수 {player.score ?? "-"}</div>
                      </div>
                    );
                  })}
                </div>
                {winnerMemberId > 0 && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-black text-emerald-700">우승자: {winnerNickname}</div>}
              </div>
            </div>

            <aside className="rounded-[1.8rem] border border-slate-200 bg-white p-4 shadow-lg">
              <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900"><MessageSquare className="h-4 w-4" />방 채팅</div>
              <div ref={chatScrollRef} className="mb-3 h-[420px] space-y-2 overflow-auto rounded-2xl bg-slate-50 p-3 text-xs">
                {!chatMessages.length && <div className="text-slate-400">채팅 내역이 없습니다.</div>}
                {chatMessages.map((message) => {
                  const normalized = normalizeMessage(message);
                  return (
                  <div key={normalized.key || normalized.id} className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                    <div className="font-black text-slate-800">{normalized.senderName || "SYSTEM"}</div>
                    <div className="mt-0.5 text-slate-700">{normalized.message || ""}</div>
                  </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <input className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="메시지를 입력하세요" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendChat(); } }} />
                <button className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white" onClick={sendChat}>전송</button>
              </div>
            </aside>
          </div>
        </section>
      )}

      <section className="rounded-[1.6rem] border border-slate-200 bg-white p-4 text-xs text-slate-500">
        <div className="mb-1.5 flex items-center gap-1.5 font-black text-slate-700"><Play className="h-3.5 w-3.5" />규칙 요약</div>
        <div>3부터 35까지의 카드를 사용하고, 게임 시작 전에 무작위 카드 9장을 제거한 뒤 남은카드로 진행합니다.</div>
        <div>내 차례에는 현재 공개된 카드를 가져가거나, 칩 1개를 내고 다음 플레이어에게 넘길 수 있습니다.</div>
        <div>시간이 초과되면 칩이 남아 있을 때는 자동으로 넘기고, 칩이 없으면 자동으로 카드를 가져갑니다.</div>
        <div>연속된 숫자는 가장 작은 카드만 점수로 계산하며, 남은 칩은 최종 점수에서 차감되고 가장 점수가 낮은 플레이어가 우승합니다.</div>
      </section>
    </div>
  );
};

export default NoThanksGame;

