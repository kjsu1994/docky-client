import { useEffect, useMemo, useRef, useState } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import toast from "react-hot-toast";
import { CheckCircle2, Crown, MessageSquare, Play, TimerReset } from "lucide-react";
import api from "../../utils/api.js";
import { useAuth } from "../../contexts/AuthContext.jsx";

const ROOM_STORAGE_KEY = "no_thanks_last_room_id";

const roomIdOf = (room) => room?.room_id || room?.roomId || null;
const chatRoomIdOf = (room) => room?.chat_room_id || room?.chatRoomId || room?.room_id || room?.roomId || room?.id || null;
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
const isReadyPlayer = (player) => Boolean(player?.ready ?? player?.is_ready ?? player?.isReady);
const playerIdOf = (player) => Number(player?.member_id || player?.memberId || 0);
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
  const [createForm, setCreateForm] = useState({ title: "", start_chip_count: "11", turn_time_seconds: "15" });
  const [settingsForm, setSettingsForm] = useState({ start_chip_count: "11", turn_time_seconds: "15" });

  const stompRef = useRef(null);
  const gameSubRef = useRef(null);
  const chatSubRef = useRef(null);
  const chatScrollRef = useRef(null);
  const audioContextRef = useRef(null);
  const isActionSoundPlayingRef = useRef(false);

  const myMemberId = Number(user?.member_id || user?.memberId || user?.id || 0);
  const roomStatus = gameState?.room_status || gameState?.roomStatus || selectedRoom?.room_status || selectedRoom?.roomStatus || null;
  const statePlayers = Array.isArray(gameState?.players) ? gameState.players : [];
  const roomPlayers = Array.isArray(selectedRoom?.players) ? selectedRoom.players : [];
  const players = statePlayers.length ? statePlayers : roomPlayers;
  const hostMemberId = Number(selectedRoom?.host_member_id || selectedRoom?.hostMemberId || 0);
  const isHost = Boolean(selectedRoom && hostMemberId === myMemberId);
  const turnMemberId = Number(gameState?.turn_member_id || gameState?.turnMemberId || 0);
  const isMyTurn = Boolean(myMemberId && turnMemberId === myMemberId);
  const currentCard = gameState?.current_card || gameState?.currentCard || null;
  const potChips = parseIntSafe(gameState?.pot_chips || gameState?.potChips, 0);
  const deckRemaining = parseIntSafe(gameState?.deck_remaining_count || gameState?.deckRemainingCount, 0);
  const winnerMemberId = Number(gameState?.winner_member_id || gameState?.winnerMemberId || 0);
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
        master.gain.setValueAtTime(0.20, now);
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
        master.gain.setValueAtTime(0.14, now);
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

  const fetchRooms = async () => {
    const response = await api.get("/game/no-thanks/rooms");
    setRooms(response.data || []);
  };

  const fetchState = async (roomId) => {
    const response = await api.get(`/game/no-thanks/rooms/${roomId}/state`);
    setGameState(response.data || null);
    return response.data || null;
  };

  const fetchMyRooms = async () => {
    const response = await api.get("/game/no-thanks/rooms/me");
    return response.data || [];
  };

  const refreshSelectedRoom = async (roomId) => {
    const myRooms = await fetchMyRooms();
    const matched = myRooms.find((room) => Number(roomIdOf(room)) === Number(roomId)) || null;
    if (matched) setSelectedRoom(matched);
    return matched;
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

  const subscribeGameRoom = (client, roomId) => {
    if (gameSubRef.current) gameSubRef.current.unsubscribe();
    gameSubRef.current = client.subscribe(`/sub/game/no-thanks/room/${roomId}`, (message) => {
      const payload = JSON.parse(message.body || "{}");
      setGameState(payload);
      refreshSelectedRoom(roomId).catch(() => {});
    });
  };

  const subscribeChatRoom = (client, roomId) => {
    if (chatSubRef.current) chatSubRef.current.unsubscribe();
    chatSubRef.current = client.subscribe(`/sub/chat/room/${roomId}`, (message) => {
      const payload = JSON.parse(message.body || "{}");
      setChatMessages((prev) => [...prev, payload]);
    });
  };

  const openRoom = async (room) => {
    setSelectedRoom(room);
    const roomId = roomIdOf(room);
    if (!roomId) return;
    localStorage.setItem(ROOM_STORAGE_KEY, String(roomId));

    const client = ensureSocket();
    const bind = async () => {
      subscribeGameRoom(client, roomId);
      const snapshot = await fetchState(roomId);
      const snapshotChatRoomId = chatRoomIdOf(snapshot) || chatRoomIdOf(room);
      if (snapshotChatRoomId) {
        subscribeChatRoom(client, snapshotChatRoomId);
        await fetchChatMessages(snapshotChatRoomId);
      } else {
        setChatMessages([]);
      }
    };

    if (client.connected) await bind();
    else client.onConnect = () => {
      bind().catch(() => toast.error("방 정보를 불러오지 못했습니다."));
    };
  };

  useEffect(() => {
    fetchRooms().catch(() => toast.error("방 목록을 불러오지 못했습니다."));
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
      start_chip_count: String(selectedRoom.start_chip_count || selectedRoom.startChipCount || 11),
      turn_time_seconds: String(selectedRoom.turn_time_seconds || selectedRoom.turnTimeSeconds || 15),
    });
  }, [selectedRoom]);

  useEffect(() => {
    if (!gameState?.turn_deadline_at) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => {
      const ms = new Date(gameState.turn_deadline_at).getTime() - Date.now();
      setSecondsLeft(Math.max(0, Math.ceil(ms / 1000)));
    };
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [gameState?.turn_deadline_at]);

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatMessages]);

  useEffect(() => () => {
    if (gameSubRef.current) gameSubRef.current.unsubscribe();
    if (chatSubRef.current) chatSubRef.current.unsubscribe();
    if (stompRef.current) stompRef.current.deactivate();
  }, []);

  const createRoom = async (event) => {
    event.preventDefault();
    try {
      const response = await api.post("/game/no-thanks/rooms", {
        title: createForm.title,
        start_chip_count: parseIntSafe(createForm.start_chip_count, 11),
        turn_time_seconds: parseIntSafe(createForm.turn_time_seconds, 15),
      });
      await openRoom(response.data);
      await fetchRooms();
      toast.success("방 생성 완료");
    } catch {
      toast.error("방 생성 실패");
    }
  };

  const joinRoom = async (roomId) => {
    try {
      const response = await api.post(`/game/no-thanks/rooms/${roomId}/join`);
      await openRoom(response.data);
      await fetchRooms();
      toast.success("방 입장 완료");
    } catch {
      toast.error("방 입장 실패");
    }
  };

  const joinByCode = async (event) => {
    event.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      toast.error("방 코드를 입력해주세요.");
      return;
    }
    try {
      const response = await api.post("/game/no-thanks/rooms/join-by-code", { room_code: code });
      setJoinCode("");
      await openRoom(response.data);
      await fetchRooms();
      toast.success("방 코드로 입장했습니다.");
    } catch {
      toast.error("방 코드 입장 실패");
    }
  };

  const saveSettings = async () => {
    if (!selectedRoom) return;
    try {
      const response = await api.patch(`/game/no-thanks/rooms/${roomIdOf(selectedRoom)}/settings`, {
        start_chip_count: parseIntSafe(settingsForm.start_chip_count, 11),
        turn_time_seconds: parseIntSafe(settingsForm.turn_time_seconds, 15),
      });
      setSelectedRoom(response.data);
      await fetchRooms();
      toast.success("방 설정 저장 완료");
    } catch {
      toast.error("방 설정 저장 실패");
    }
  };

  const toggleReady = async () => {
    if (!selectedRoom) return;
    try {
      await api.post(`/game/no-thanks/rooms/${roomIdOf(selectedRoom)}/ready`);
    } catch {
      toast.error("준비 상태 변경 실패");
    }
  };

  const startGame = async () => {
    if (!selectedRoom) return;
    try {
      await api.post(`/game/no-thanks/rooms/${roomIdOf(selectedRoom)}/start`);
    } catch {
      toast.error("게임 시작 실패");
    }
  };

  const rematchGame = async () => {
    if (!selectedRoom) return;
    try {
      const response = await api.post(`/game/no-thanks/rooms/${roomIdOf(selectedRoom)}/rematch`);
      setSelectedRoom(response.data);
      await fetchRooms();
      toast.success("방이 다시 열렸습니다.");
    } catch {
      toast.error("방 다시 열기 실패");
    }
  };

  const forceFinishGame = async () => {
    if (!selectedRoom) return;
    if (!window.confirm("게임이 아직 진행 중입니다. 종료하고 대기방으로 돌아가시겠습니까?")) return;
    try {
      const response = await api.post(`/game/no-thanks/rooms/${roomIdOf(selectedRoom)}/force-finish`);
      setSelectedRoom(response.data);
      await fetchRooms();
      toast.success("게임 종료 완료");
    } catch {
      toast.error("게임 종료 실패");
    }
  };

  const leaveRoom = async () => {
    if (!selectedRoom) return;
    try {
      await api.post(`/game/no-thanks/rooms/${roomIdOf(selectedRoom)}/leave`);
      setSelectedRoom(null);
      setGameState(null);
      setChatMessages([]);
      localStorage.removeItem(ROOM_STORAGE_KEY);
      if (gameSubRef.current) gameSubRef.current.unsubscribe();
      if (chatSubRef.current) chatSubRef.current.unsubscribe();
      await fetchRooms();
      toast.success("방 퇴장 완료");
    } catch {
      toast.error("방 퇴장 실패");
    }
  };

  const publishAction = (actionType) => {
    if (!selectedRoom) return;
    const client = ensureSocket();
    if (!client.connected) {
      toast.error("실시간 연결이 아직 준비되지 않았습니다.");
      return;
    }
    playActionSound(actionType);
    client.publish({
      destination: `/pub/game/no-thanks/${roomIdOf(selectedRoom)}/action`,
      body: JSON.stringify({ action_type: actionType, member_id: myMemberId }),
    });
  };

  const sendChat = () => {
    if (!chatInput.trim() || !chatRoomId || !myMemberId) return;
    const client = ensureSocket();
    if (!client.connected) {
      toast.error("채팅 연결이 아직 준비되지 않았습니다.");
      return;
    }
    const message = chatInput.trim();
    client.publish({
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

  return (
    <div className="animate-fade-in space-y-6">
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
                <input type="text" inputMode="numeric" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="토큰 개수" value={createForm.start_chip_count} onChange={(e) => setCreateForm((prev) => ({ ...prev, start_chip_count: normalizeNumberDraft(e.target.value) }))} onBlur={() => normalizeCreateField("start_chip_count", 5, 20, 11)} />
                <input type="text" inputMode="numeric" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="제한 시간(초)" value={createForm.turn_time_seconds} onChange={(e) => setCreateForm((prev) => ({ ...prev, turn_time_seconds: normalizeNumberDraft(e.target.value) }))} onBlur={() => normalizeCreateField("turn_time_seconds", 5, 60, 15)} />
              </div>
              <button className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white">노땡스 방 만들기</button>
            </div>
          </form>

          <section className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="text-lg font-black text-slate-900">대기 중인 방</div>
              <button className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700" onClick={() => fetchRooms().catch(() => {})}>새로고침</button>
            </div>
            <form onSubmit={joinByCode} className="mt-4 flex gap-2">
              <input className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase" placeholder="방 코드로 입장" value={joinCode} maxLength={8} onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
              <button className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white">입장</button>
            </form>
            <div className="mt-4 space-y-2.5">
              {!rooms.length && <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-400">대기 중인 방이 없습니다.</div>}
              {rooms.map((room) => (
                <div key={roomIdOf(room)} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div>
                    <div className="text-sm font-black text-slate-900">{room.title}</div>
                    <div className="text-xs text-slate-500">코드 {room.room_code || room.roomCode} | {(room.players || []).length}/6명 | 시작 칩 {room.start_chip_count || room.startChipCount}</div>
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
                <div className="text-xs text-slate-500">방 코드 {selectedRoom.room_code || selectedRoom.roomCode}</div>
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
              <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="font-black text-slate-700">방 코드</div><div className="text-slate-500">{selectedRoom.room_code || selectedRoom.roomCode}</div></div>
              <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="font-black text-slate-700">시작 칩</div><div className="text-slate-500">{parseIntSafe(selectedRoom.start_chip_count || selectedRoom.startChipCount, 11)}</div></div>
              <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="font-black text-slate-700">턴 시간</div><div className="text-slate-500">{parseIntSafe(selectedRoom.turn_time_seconds || selectedRoom.turnTimeSeconds, 15)}초</div></div>
              <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="font-black text-slate-700">상태</div><div className="text-slate-500">{roomStatus || "-"}</div></div>
            </div>

            {isHost && roomStatus === "WAITING" && (
              <div className="mt-4 grid grid-cols-1 gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 md:grid-cols-4">
                <input type="text" inputMode="numeric" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={settingsForm.start_chip_count} onChange={(e) => setSettingsForm((prev) => ({ ...prev, start_chip_count: normalizeNumberDraft(e.target.value) }))} onBlur={() => normalizeSettingsField("start_chip_count", 5, 20, 11)} />
                <input type="text" inputMode="numeric" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={settingsForm.turn_time_seconds} onChange={(e) => setSettingsForm((prev) => ({ ...prev, turn_time_seconds: normalizeNumberDraft(e.target.value) }))} onBlur={() => normalizeSettingsField("turn_time_seconds", 5, 60, 15)} />
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
                  <div className="rounded-[1.5rem] border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-700 p-6 text-white">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-300">현재 카드</div>
                    <div className="mt-3 text-6xl font-black tracking-tight">{currentCard ?? "-"}</div>
                    <div className="mt-3 text-sm text-slate-300">카드와 칩을 가져가거나 칩 1개를 내고 다음 플레이어에게 넘길 수 있습니다.</div>
                  </div>
                  <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">행동</div>
                    <div className="mt-3 space-y-2">
                      <button className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white disabled:opacity-50" disabled={!(roomStatus === "PLAYING" && isMyTurn)} onClick={() => publishAction("TAKE")}>카드 가져가기</button>
                      <button className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-black text-white disabled:opacity-50" disabled={!(roomStatus === "PLAYING" && isMyTurn && myChips > 0)} onClick={() => publishAction("PASS")}>칩 1개 내고 넘기기</button>
                    </div>
                    <div className="mt-3 text-xs text-slate-500">시간이 초과되면 칩이 남아 있을 때는 자동으로 넘기고, 칩이 없으면 자동으로 카드를 가져갑니다.</div>
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
                              {readyMemberIds.has(id) ? "READY" : "대기"}
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
                {chatMessages.map((message, index) => (
                  <div key={`${message.created_at || message.createdAt || index}-${index}`} className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                    <div className="font-black text-slate-800">{message.sender_name || message.senderName || "SYSTEM"}</div>
                    <div className="mt-0.5 text-slate-700">{message.message || ""}</div>
                  </div>
                ))}
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

