import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Dices,
  Gamepad2,
  Play,
  RadioTower,
  RefreshCw,
  Shield,
  Sparkles,
  Timer,
  Users,
  Zap,
  XCircle,
} from "lucide-react";
import {
  getVideoGameMemberId,
  getVideoGameRoomCode,
  getVideoGameRoomId,
  getVideoGameRoomStatus,
  getVideoGameSeatNo,
  isVideoGameReadyPlayer,
  normalizeVideoGameStatePayload,
  videoGameAdapter,
  videoGameErrorMessage,
} from "../../adapters/videoGameAdapter.js";
import { buildStompConnectHeaders, createStompClient, notifyRealtimeError } from "../../adapters/realtimeAdapter.js";
import UserAvatar from "../../common/UserAvatar.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { notify, notifyError, notifySuccess } from "../../utils/toast.js";
import { VideoGameArtwork, videoGameArtProfiles } from "./VideoGameArtwork.jsx";

const videoGameProfiles = {
  arena: {
    title: "LAN Arena",
    maxPlayers: 8,
    tone: "from-cyan-500 via-slate-950 to-emerald-500",
    storage: "DB 방 메타데이터 + STOMP 실시간 상태 + Redis 확장 준비",
    controls: [
      { label: "▲", control: "up" },
      { label: "◀", control: "left" },
      { label: "▶", control: "right" },
      { label: "▼", control: "down" },
      { label: "발사", control: "fire" },
      { label: "대시", control: "dash" },
    ],
  },
  fortress: {
    title: "Fortress",
    maxPlayers: 2,
    tone: "from-amber-500 via-sky-600 to-slate-950",
    storage: "DB 방 메타데이터 + 턴 상태 JSON + STOMP 턴 알림",
    controls: [
      { label: "이동 ◀", control: "fortress_left" },
      { label: "이동 ▶", control: "fortress_right" },
      { label: "포각 ▲", control: "fortress_angle_up" },
      { label: "포각 ▼", control: "fortress_angle_down" },
      { label: "파워 -", control: "fortress_power_down" },
      { label: "파워 +", control: "fortress_power_up" },
      { label: "발사", control: "fortress_fire" },
    ],
  },
  defense: {
    title: "Defense",
    maxPlayers: 4,
    tone: "from-lime-500 via-emerald-700 to-slate-950",
    storage: "DB 방 메타데이터 + STOMP 웨이브 상태 + Redis 확장 준비",
    controls: [
      { label: "웨이브", control: "defense_wave" },
      { label: "업그레이드", control: "defense_upgrade" },
      { label: "판매", control: "defense_sell" },
      { label: "스킬", control: "defense_skill" },
    ],
  },
  kart: {
    title: "Kart Dash",
    maxPlayers: 8,
    tone: "from-orange-500 via-rose-500 to-indigo-700",
    storage: "DB 방 메타데이터 + STOMP 위치/아이템 상태",
    controls: [
      { label: "▲", control: "up" },
      { label: "◀", control: "left" },
      { label: "▶", control: "right" },
      { label: "▼", control: "down" },
      { label: "드리프트", control: "action" },
    ],
  },
  bomb: {
    title: "Bomb Battle",
    maxPlayers: 8,
    tone: "from-rose-600 via-zinc-950 to-amber-500",
    storage: "DB 방 메타데이터 + STOMP 폭탄/충돌 상태",
    controls: [
      { label: "▲", control: "up" },
      { label: "◀", control: "left" },
      { label: "▶", control: "right" },
      { label: "▼", control: "down" },
      { label: "폭탄", control: "action" },
    ],
  },
  snake: {
    title: "Snake Rush",
    maxPlayers: 8,
    tone: "from-emerald-500 via-lime-500 to-slate-950",
    storage: "DB 방 메타데이터 + STOMP 방향/성장 상태",
    controls: [
      { label: "▲", control: "up" },
      { label: "◀", control: "left" },
      { label: "▶", control: "right" },
      { label: "▼", control: "down" },
      { label: "질주", control: "action" },
    ],
  },
  coin: {
    title: "Coin Collector",
    maxPlayers: 8,
    tone: "from-yellow-400 via-orange-500 to-sky-700",
    storage: "DB 방 메타데이터 + STOMP 수집/점수 상태",
    controls: [
      { label: "▲", control: "up" },
      { label: "◀", control: "left" },
      { label: "▶", control: "right" },
      { label: "▼", control: "down" },
      { label: "대시", control: "action" },
    ],
  },
  rpg: {
    title: "Good_ETC RPG",
    maxPlayers: 1,
    tone: "from-violet-700 via-slate-950 to-emerald-700",
    storage: "localStorage 진행 저장 + DB 방 메타데이터",
    controls: [
      { label: "▲", control: "up" },
      { label: "◀", control: "left" },
      { label: "▶", control: "right" },
      { label: "▼", control: "down" },
      { label: "공격", control: "attack" },
      { label: "상호작용", control: "interact" },
    ],
  },
};

const statusLabel = {
  WAITING: "대기 중",
  PLAYING: "진행 중",
  FINISHED: "종료",
  CANCELLED: "취소",
};

const roomPlayers = (room) => (Array.isArray(room?.players) ? room.players : []);

export const GoodEtcVideoGame = () => {
  const { videoGameCode = "" } = useParams();
  const profile = videoGameProfiles[videoGameCode];
  const artProfile = profile ? videoGameArtProfiles[videoGameCode] : null;
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [myRooms, setMyRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [createForm, setCreateForm] = useState({ title: "", maxPlayers: "1", turnTimeSeconds: "30" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [pressedControl, setPressedControl] = useState("");
  const stompRef = useRef(null);
  const gameSubRef = useRef(null);
  const signalSubRef = useRef(null);
  const iframeRef = useRef(null);
  const roomSeqRef = useRef(0);

  const myMemberId = Number(user?.member_id || user?.memberId || user?.id || 0);
  const players = roomPlayers(selectedRoom);
  const status = getVideoGameRoomStatus(selectedRoom);
  const roomId = getVideoGameRoomId(selectedRoom);
  const roomCode = getVideoGameRoomCode(selectedRoom);
  const isHost = selectedRoom && Number(selectedRoom.hostMemberId) === myMemberId;
  const guestPlayers = players.filter((player) => getVideoGameMemberId(player) !== selectedRoom?.hostMemberId);
  const readyGuestCount = guestPlayers.filter(isVideoGameReadyPlayer).length;
  const readyGuests = guestPlayers.every(isVideoGameReadyPlayer);
  const canStart = Boolean(isHost && status === "WAITING" && players.length >= Number(selectedRoom?.minPlayers || 1) && readyGuests);
  const directionControls = profile?.controls?.filter((control) => ["up", "left", "right", "down"].includes(control.control)) || [];
  const actionControls = profile?.controls?.filter((control) => !["up", "left", "right", "down"].includes(control.control)) || [];
  const transportLabel = gameState?.transport || (status === "PLAYING" ? "stomp" : "대기");
  const mySeatNo = useMemo(() => {
    const me = players.find((player) => getVideoGameMemberId(player) === myMemberId);
    return getVideoGameSeatNo(me);
  }, [myMemberId, players]);

  useEffect(() => {
    if (profile) {
      setCreateForm({ title: "", maxPlayers: String(profile.maxPlayers), turnTimeSeconds: "30" });
    }
  }, [profile, videoGameCode]);

  const loadLobby = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setLoadError("");
    try {
      const [nextRooms, nextMyRooms] = await Promise.all([
        videoGameAdapter.fetchRooms(videoGameCode),
        videoGameAdapter.fetchMyRooms(videoGameCode),
      ]);
      setRooms(nextRooms);
      setMyRooms(nextMyRooms);
    } catch (error) {
      setLoadError(videoGameErrorMessage(error, "비디오게임 방 목록을 불러오지 못했습니다."));
    } finally {
      setLoading(false);
    }
  }, [profile, videoGameCode]);

  const openRoom = useCallback(async (room) => {
    const nextRoomId = getVideoGameRoomId(room);
    if (!nextRoomId) return;
    const seq = roomSeqRef.current + 1;
    roomSeqRef.current = seq;
    setSelectedRoom(room);
    setGameState(null);
    try {
      const payload = await videoGameAdapter.fetchState(videoGameCode, nextRoomId);
      if (roomSeqRef.current !== seq) return;
      if (payload.room) setSelectedRoom(payload.room);
      setGameState(payload.gameState || null);
    } catch (error) {
      if (roomSeqRef.current !== seq) return;
      notifyError(videoGameErrorMessage(error, "방 정보를 불러오지 못했습니다."));
    }
  }, [videoGameCode]);

  useEffect(() => {
    loadLobby();
  }, [loadLobby]);

  useEffect(() => {
    if (!profile || !roomId) return undefined;
    let cancelled = false;
    const connect = async () => {
      const connectHeaders = buildStompConnectHeaders();
      if (!connectHeaders.Authorization) return;
      try {
        const client = await createStompClient({
          reconnectDelay: 3000,
          connectHeaders,
          onConnect: () => {
            if (cancelled) return;
            gameSubRef.current?.unsubscribe?.();
            signalSubRef.current?.unsubscribe?.();
            gameSubRef.current = client.subscribe(`/sub/game/video/${videoGameCode}/room/${roomId}`, (message) => {
              const payload = normalizeVideoGameStatePayload(JSON.parse(message.body || "{}"));
              if (payload.room) setSelectedRoom(payload.room);
              setGameState(payload.gameState || null);
              if (payload.message) notify(payload.message);
            });
            signalSubRef.current = client.subscribe(`/sub/game/video/${videoGameCode}/room/${roomId}/signal`, (message) => {
              const signal = JSON.parse(message.body || "{}");
              iframeRef.current?.contentWindow?.postMessage({
                source: "ctfmon-video-game",
                type: "signal",
                signal,
              }, window.location.origin);
            });
          },
          onStompError: (frame) => {
            void notifyRealtimeError({ scope: `video-game:${videoGameCode}:${roomId}`, error: frame });
          },
          onWebSocketError: (error) => {
            void notifyRealtimeError({ scope: `video-game:${videoGameCode}:${roomId}`, error });
          },
        });
        if (cancelled) {
          client.deactivate();
          return;
        }
        stompRef.current = client;
        client.activate();
      } catch (error) {
        void notifyRealtimeError({ scope: `video-game:${videoGameCode}:${roomId}`, error });
      }
    };
    connect();
    return () => {
      cancelled = true;
      gameSubRef.current?.unsubscribe?.();
      gameSubRef.current = null;
      signalSubRef.current?.unsubscribe?.();
      signalSubRef.current = null;
      stompRef.current?.deactivate?.();
      stompRef.current = null;
    };
  }, [profile, roomId, videoGameCode]);

  const publishGameSignal = useCallback((signalType, payload, clientSeq = null) => {
    const client = stompRef.current;
    if (!client?.connected || !roomId) return false;
    client.publish({
      destination: `/pub/game/video/${videoGameCode}/room/${roomId}/signal`,
      body: JSON.stringify({ signal_type: signalType, client_seq: clientSeq, payload }),
    });
    return true;
  }, [roomId, videoGameCode]);

  useEffect(() => {
    const handleFrameMessage = (event) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || data.source !== "good-etc-game") return;
      if (data.type === "signal") {
        publishGameSignal(data.signalType || "game", data.payload || {}, data.clientSeq ?? null);
      }
      if (data.type === "ready") {
        publishGameSignal("peer_ready", {
          game: videoGameCode,
          memberId: myMemberId,
          seatNo: mySeatNo,
          host: Boolean(isHost),
        });
      }
    };
    window.addEventListener("message", handleFrameMessage);
    return () => window.removeEventListener("message", handleFrameMessage);
  }, [isHost, myMemberId, mySeatNo, publishGameSignal, videoGameCode]);

  const runBusy = async (task, fallbackMessage) => {
    if (busy) return;
    setBusy(true);
    try {
      await task();
    } catch (error) {
      notifyError(videoGameErrorMessage(error, fallbackMessage));
    } finally {
      setBusy(false);
    }
  };

  const createRoom = () => runBusy(async () => {
    const room = await videoGameAdapter.createRoom(videoGameCode, createForm);
    notifySuccess("방 생성 완료");
    await loadLobby();
    await openRoom(room);
  }, "방 생성에 실패했습니다.");

  const joinRoom = (room) => runBusy(async () => {
    const joined = await videoGameAdapter.joinRoom(videoGameCode, getVideoGameRoomId(room));
    notifySuccess("방 입장 완료");
    await loadLobby();
    await openRoom(joined);
  }, "방 입장에 실패했습니다.");

  const joinByCode = () => runBusy(async () => {
    if (!joinCode.trim()) {
      notifyError("방 코드를 입력해주세요.");
      return;
    }
    const joined = await videoGameAdapter.joinByCode(videoGameCode, joinCode);
    notifySuccess("방 코드로 입장했습니다.");
    setJoinCode("");
    await loadLobby();
    await openRoom(joined);
  }, "방 코드 입장에 실패했습니다.");

  const toggleReady = () => runBusy(async () => {
    await videoGameAdapter.toggleReady(videoGameCode, roomId);
    const payload = await videoGameAdapter.fetchState(videoGameCode, roomId);
    if (payload.room) setSelectedRoom(payload.room);
    notifySuccess("준비 상태를 변경했습니다.");
  }, "준비 상태 변경에 실패했습니다.");

  const startGame = () => runBusy(async () => {
    await videoGameAdapter.startGame(videoGameCode, roomId);
    const payload = await videoGameAdapter.fetchState(videoGameCode, roomId);
    if (payload.room) setSelectedRoom(payload.room);
    setGameState(payload.gameState || null);
    notifySuccess("게임이 시작되었습니다.");
  }, "인원과 준비 상태를 확인해주세요.");

  const leaveRoom = () => runBusy(async () => {
    await videoGameAdapter.leaveRoom(videoGameCode, roomId);
    setSelectedRoom(null);
    setGameState(null);
    notifySuccess("방 퇴장 완료");
    await loadLobby();
  }, "방 퇴장에 실패했습니다.");

  const forceFinish = () => runBusy(async () => {
    const room = await videoGameAdapter.forceFinish(videoGameCode, roomId);
    setSelectedRoom(room);
    setGameState(null);
    notifySuccess("대기방으로 돌아왔습니다.");
    await loadLobby();
  }, "게임 종료에 실패했습니다.");

  const copyRoomCode = () => {
    const roomCode = getVideoGameRoomCode(selectedRoom);
    if (!roomCode || !navigator.clipboard) {
      notifyError("방 코드를 복사할 수 없습니다.");
      return;
    }
    navigator.clipboard.writeText(roomCode)
      .then(() => notifySuccess("방 코드 복사 완료"))
      .catch(() => notifyError("방 코드를 복사할 수 없습니다."));
  };

  const gameFrameSrc = useMemo(() => {
    if (!selectedRoom || status !== "PLAYING") return "";
    const framePlayers = players.map((player) => ({
      memberId: getVideoGameMemberId(player),
      seatNo: getVideoGameSeatNo(player),
      nickname: player.nickname,
      ready: Boolean(player.ready),
    }));
    const params = new URLSearchParams({
      game: videoGameCode,
      mode: videoGameCode === "rpg" || isHost ? "local" : "multi",
      room: roomCode || String(roomId || ""),
      site: "1",
      siteHost: isHost ? "1" : "0",
      memberId: String(myMemberId || ""),
      seatNo: String(mySeatNo || ""),
      hostMemberId: String(selectedRoom.hostMemberId || ""),
      players: JSON.stringify(framePlayers),
    });
    return `/good-etc-game/index.html?${params.toString()}`;
  }, [isHost, myMemberId, mySeatNo, players, roomCode, roomId, selectedRoom, status, videoGameCode]);

  const sendTouchControl = (controlItem, pressed) => {
    const control = typeof controlItem === "string" ? controlItem : controlItem?.control;
    if (!control) return;
    setPressedControl(pressed ? control : "");
    iframeRef.current?.contentWindow?.postMessage({
      source: "ctfmon-video-parent",
      type: "touch_control",
      control,
      pressed,
    }, window.location.origin);
  };

  if (!profile) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
        <div className="text-lg font-black text-slate-900">지원하지 않는 비디오게임입니다.</div>
        <Link to="/app/games" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-white">
          <ArrowLeft className="h-4 w-4" />
          게임 허브로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-5">
      <section className={`overflow-hidden rounded-2xl bg-gradient-to-br ${profile.tone} p-[1px] shadow-xl`}>
        <div className="relative overflow-hidden rounded-[calc(1rem-1px)] bg-slate-950 p-5 text-white sm:p-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.16),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(56,189,248,0.22),transparent_28%)]" />
          <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
            <div className="min-w-0">
              <Link to="/app/games" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/10 px-3 text-sm font-black text-white ring-1 ring-white/15 transition hover:bg-white hover:text-slate-950">
                <ArrowLeft className="h-4 w-4" />
                게임 허브
              </Link>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-black text-white/80 ring-1 ring-white/15">
                <Gamepad2 className="h-3.5 w-3.5 text-cyan-200" />
                Good_ETC 비디오게임
              </div>
              <h1 className="mt-3 break-words text-2xl font-black leading-tight sm:text-4xl">{profile.title}</h1>
              <p className="mt-2 max-w-3xl text-sm font-bold leading-relaxed text-white/75">{artProfile?.tagline || profile.storage}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-black text-white ring-1 ring-white/15">
                  <Users className="h-3.5 w-3.5" />
                  최대 {profile.maxPlayers}명
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-black text-white ring-1 ring-white/15">
                  <RadioTower className="h-3.5 w-3.5" />
                  {profile.storage}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-stretch gap-3">
              <VideoGameArtwork type={videoGameCode} className="h-44 w-full" />
              <button type="button" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-slate-950 transition hover:bg-cyan-100" onClick={loadLobby}>
                <RefreshCw className="h-4 w-4" />
                새로고침
              </button>
            </div>
          </div>
        </div>
      </section>

      {!selectedRoom ? (
        <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
              <div className={`bg-gradient-to-br ${profile.tone} p-3`}>
                <VideoGameArtwork type={videoGameCode} compact className="h-28 w-full" />
              </div>
              <div className="p-4">
              <div className="flex items-center gap-2 text-base font-black text-slate-900">
                <Sparkles className="h-4 w-4 text-primary-600" />
                방 만들기
              </div>
              <div className="mt-3 space-y-3">
                <input
                  aria-label="방 제목"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
                  value={createForm.title}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder={`${profile.title} 방 제목`}
                  maxLength={120}
                />
                <label className="block text-xs font-black text-slate-500">
                  최대 인원
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
                    type="number"
                    min="1"
                    max={profile.maxPlayers}
                    value={createForm.maxPlayers}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, maxPlayers: event.target.value }))}
                  />
                </label>
                <button type="button" disabled={busy} className="min-h-11 w-full rounded-xl bg-slate-900 px-4 text-sm font-black text-white disabled:opacity-40" onClick={createRoom}>
                  방 만들기
                </button>
              </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
              <div className="flex items-center gap-2 text-base font-black text-slate-900">
                <Zap className="h-4 w-4 text-amber-500" />
                코드 입장
              </div>
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <input
                  aria-label="방 코드"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold uppercase outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  placeholder="ROOMCODE"
                  maxLength={32}
                />
                <button type="button" disabled={busy} className="min-h-11 rounded-xl bg-primary-600 px-4 text-sm font-black text-white disabled:opacity-40" onClick={joinByCode}>
                  입장
                </button>
              </div>
            </section>
          </aside>

          <main className="space-y-4">
            {loadError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{loadError}</div>
            )}
            <RoomList title="내 참여 방" rooms={myRooms} emptyText="참여 중인 방이 없습니다." gameCode={videoGameCode} onOpen={openRoom} onJoin={joinRoom} busy={busy} />
            <RoomList title="대기 중인 방" rooms={rooms} emptyText={loading ? "방 목록을 불러오는 중입니다." : "대기 중인 방이 없습니다."} gameCode={videoGameCode} onOpen={openRoom} onJoin={joinRoom} busy={busy} />
          </main>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="space-y-4">
            <section className={`overflow-hidden rounded-2xl bg-gradient-to-br ${profile.tone} p-[1px] shadow-lg`}>
              <div className="rounded-[calc(1rem-1px)] bg-white p-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-500">
                      <Dices className="h-3.5 w-3.5 text-primary-500" />
                      {statusLabel[status] || status}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black text-white">
                      <Timer className="h-3.5 w-3.5" />
                      {transportLabel}
                    </span>
                  </div>
                  <h2 className="mt-2 break-words text-xl font-black text-slate-900">{selectedRoom.title}</h2>
                  <div className="mt-1 text-sm font-bold text-slate-500">방 코드 {roomCode} · 내 좌석 {mySeatNo || "-"}</div>
                  <p className="mt-3 text-xs font-bold leading-relaxed text-slate-500">{artProfile?.roomNote || profile.storage}</p>
                </div>
                <div className="space-y-2">
                  <VideoGameArtwork type={videoGameCode} compact className="h-32 w-full" />
                  <button type="button" className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-3 text-sm font-black text-slate-700 hover:bg-slate-900 hover:text-white" onClick={copyRoomCode}>
                    <Copy className="h-4 w-4" />
                    코드 복사
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {players.map((player) => {
                  const memberId = getVideoGameMemberId(player);
                  const host = Number(selectedRoom.hostMemberId) === memberId;
                  return (
                    <div key={memberId || getVideoGameSeatNo(player)} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-center gap-2">
                        <UserAvatar name={player.nickname} profileUrl={player.profileUrl} size="xs" />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black text-slate-900">{player.nickname}</div>
                          <div className="text-[11px] font-bold text-slate-500">좌석 {getVideoGameSeatNo(player)}{host ? " · 방장" : ""}</div>
                        </div>
                      </div>
                      <div className={`mt-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black ${host || isVideoGameReadyPlayer(player) ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                        {host || isVideoGameReadyPlayer(player) ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                        {host ? "방장" : isVideoGameReadyPlayer(player) ? "준비 완료" : "준비 대기"}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {status === "WAITING" && !isHost && (
                  <button type="button" disabled={busy} className="min-h-11 rounded-xl bg-primary-600 px-4 text-sm font-black text-white disabled:opacity-40" onClick={toggleReady}>
                    준비 상태 변경
                  </button>
                )}
                {status === "WAITING" && isHost && (
                  <button type="button" disabled={busy || !canStart} className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-black text-white disabled:opacity-40" onClick={startGame}>
                    <Play className="mr-2 inline h-4 w-4" />
                    게임 시작
                  </button>
                )}
                {status === "PLAYING" && isHost && (
                  <button type="button" disabled={busy} className="min-h-11 rounded-xl bg-amber-500 px-4 text-sm font-black text-white disabled:opacity-40" onClick={forceFinish}>
                    대기방으로 종료
                  </button>
                )}
                {status !== "PLAYING" && (
                  <button type="button" disabled={busy} className="min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-black text-slate-700 disabled:opacity-40" onClick={leaveRoom}>
                    방 나가기
                  </button>
                )}
                <button type="button" className="min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-black text-slate-700" onClick={() => openRoom(selectedRoom)}>
                  상태 동기화
                </button>
              </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                  <Shield className="h-4 w-4 text-emerald-600" />
                  본게임
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-500">
                  <RadioTower className="h-3.5 w-3.5 text-cyan-600" />
                  {transportLabel}
                </div>
              </div>
              {gameFrameSrc ? (
                <div className="overflow-hidden bg-slate-950">
                  <iframe
                    ref={iframeRef}
                    title={`${profile.title} game`}
                    src={gameFrameSrc}
                    className="h-[72vh] min-h-[520px] w-full bg-slate-950"
                    allow="fullscreen; gamepad"
                  />
                </div>
              ) : (
                <div className="grid gap-4 bg-slate-950 p-4 text-white sm:grid-cols-[220px_minmax(0,1fr)] sm:items-center">
                  <VideoGameArtwork type={videoGameCode} compact className="h-32 w-full" />
                  <div>
                    <div className="text-sm font-black">방 대기 상태입니다.</div>
                    <div className="mt-2 text-xs font-bold leading-relaxed text-slate-300">
                      게임을 시작하면 Good_ETC 원본 게임 화면이 이 영역에 로드됩니다.
                    </div>
                  </div>
                </div>
              )}
              {gameState?.transport && (
                <div className="m-4 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
                  방 전송 상태: {gameState.transport} · 저장 정책: {gameState.storagePolicy || profile.storage}
                </div>
              )}
            </section>
          </main>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
              <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                <Users className="h-4 w-4 text-primary-600" />
                시작 조건
              </div>
              <div className="mt-3 space-y-2">
                <Condition done={players.length >= Number(selectedRoom.minPlayers || 1)} label={`인원 ${players.length}/${selectedRoom.maxPlayers}`} />
                <Condition done={readyGuests} label={`게스트 준비 ${readyGuestCount}/${guestPlayers.length}`} />
                <Condition done={Boolean(isHost)} label={isHost ? "방장 권한" : "방장이 시작합니다"} />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
              <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                <Gamepad2 className="h-4 w-4 text-primary-600" />
                모바일 조작
              </div>
              {!!directionControls.length && (
                <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-slate-950 p-3">
                  {["", "up", "", "left", "", "right", "", "down", ""].map((slot, index) => {
                    const control = directionControls.find((item) => item.control === slot);
                    if (!control) return <div key={`empty-${index}`} className="min-h-12" />;
                    return (
                      <button
                        key={control.control}
                        type="button"
                        title={control.label}
                        className={`min-h-12 rounded-xl px-3 text-lg font-black transition ${pressedControl === control.control ? "bg-cyan-300 text-slate-950" : "bg-white/10 text-white ring-1 ring-white/15"}`}
                        onPointerDown={() => sendTouchControl(control, true)}
                        onPointerUp={() => sendTouchControl(control, false)}
                        onPointerCancel={() => sendTouchControl(control, false)}
                        onPointerLeave={() => sendTouchControl(control, false)}
                      >
                        {control.label}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(actionControls.length ? actionControls : profile.controls).map((control) => {
                  const controlKey = typeof control === "string" ? control : control.control;
                  const controlLabel = typeof control === "string" ? control : control.label;
                  return (
                  <button
                    key={controlKey}
                    type="button"
                    className={`min-h-12 rounded-xl px-3 text-sm font-black transition ${pressedControl === controlKey ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-700"}`}
                    onPointerDown={() => sendTouchControl(control, true)}
                    onPointerUp={() => sendTouchControl(control, false)}
                    onPointerCancel={() => sendTouchControl(control, false)}
                    onPointerLeave={() => sendTouchControl(control, false)}
                  >
                    {controlLabel}
                  </button>
                  );
                })}
              </div>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
};

const Condition = ({ done, label }) => (
  <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black ${done ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
    {done ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
    {label}
  </div>
);

const RoomList = ({ title, rooms, emptyText, gameCode, onOpen, onJoin, busy }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-base font-black text-slate-900">{title}</h2>
      <div className="text-xs font-black text-slate-400">{rooms.length}개</div>
    </div>
    <div className="mt-3 space-y-2">
      {rooms.length ? rooms.map((room) => (
        <div key={getVideoGameRoomId(room)} className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
          <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="hidden w-28 shrink-0 sm:block">
              <VideoGameArtwork type={gameCode} compact className="h-20 w-full" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-black text-slate-900">{room.title}</div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                코드 {getVideoGameRoomCode(room)} · {room.memberCount}/{room.maxPlayers}명 · {statusLabel[getVideoGameRoomStatus(room)] || getVideoGameRoomStatus(room)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:w-44">
              <button type="button" className="min-h-10 rounded-xl bg-white px-3 text-xs font-black text-slate-700 shadow-sm" onClick={() => onOpen(room)}>
                열기
              </button>
              <button type="button" disabled={busy || getVideoGameRoomStatus(room) !== "WAITING"} className="min-h-10 rounded-xl bg-slate-900 px-3 text-xs font-black text-white disabled:opacity-40" onClick={() => onJoin(room)}>
                입장
              </button>
            </div>
          </div>
        </div>
      )) : (
        <div className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm font-bold text-slate-400">{emptyText}</div>
      )}
    </div>
  </section>
);

export default GoodEtcVideoGame;
