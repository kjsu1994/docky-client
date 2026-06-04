(() => {
  const params = new URLSearchParams(window.location.search);
  const enabled = params.get("site") === "1";
  if (!enabled) return;

  const parseNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const parsePlayers = () => {
    try {
      const parsed = JSON.parse(params.get("players") || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const clone = (value) => {
    if (value == null) return value;
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  };

  const memberId = parseNumber(params.get("memberId"));
  const seatNo = parseNumber(params.get("seatNo"));
  const hostMemberId = parseNumber(params.get("hostMemberId"));
  const roomId = params.get("room") || "SITE";
  const game = params.get("game") || "arena";
  const isHost = params.get("siteHost") === "1";
  const players = parsePlayers();
  const listeners = new Set();
  const sockets = new Set();
  let clientSeq = 1;

  const clientIdForMember = (id) => `m${parseNumber(id) || 0}`;
  const myClientId = clientIdForMember(memberId);
  const hostClientId = clientIdForMember(hostMemberId);
  const colors = ["#53e2a8", "#48a5ff", "#ffbc54", "#b987ff", "#ff6b8a", "#69dcff", "#8be66f", "#d08cff"];

  const decorateWsMessage = (message) => {
    const next = clone(message);
    if (!next || typeof next !== "object") return next;
    if (next.type === "party_state" || next.type === "defense_state") {
      next.clientId = myClientId;
      next.isHost = isHost;
    }
    if (next.type === "fortress_state") {
      next.slot = Math.max(0, Math.min(1, seatNo - 1));
    }
    return next;
  };

  const normalizeSignal = (signal) => ({
    ...signal,
    signalType: signal.signalType ?? signal.signal_type ?? "",
    clientSeq: signal.clientSeq ?? signal.client_seq ?? null,
    gameCode: signal.gameCode ?? signal.game_code ?? "",
    roomId: signal.roomId ?? signal.room_id ?? null,
    roomCode: signal.roomCode ?? signal.room_code ?? "",
    senderMemberId: signal.senderMemberId ?? signal.sender_member_id ?? null,
    senderSeatNo: signal.senderSeatNo ?? signal.sender_seat_no ?? null,
    senderNickname: signal.senderNickname ?? signal.sender_nickname ?? "",
    host: signal.host ?? false,
    payload: signal.payload || {},
  });

  const postToParent = (type, payload = {}) => {
    window.parent?.postMessage({ source: "good-etc-game", type, ...payload }, window.location.origin);
  };

  const bridge = {
    enabled,
    game,
    roomId,
    isHost,
    memberId,
    seatNo,
    hostMemberId,
    myClientId,
    hostClientId,
    players,
    colors,
    clientIdForMember,
    send(signalType, payload) {
      postToParent("signal", { signalType, clientSeq: clientSeq++, payload });
    },
    broadcastWs(wsMessage, signalType = "ws_message") {
      bridge.send(signalType, { wsMessage });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    playerRecords() {
      return players.map((player, index) => ({
        ...player,
        id: clientIdForMember(player.memberId),
        name: player.nickname || `플레이어 ${index + 1}`,
        color: colors[index % colors.length],
        isHost: parseNumber(player.memberId) === hostMemberId,
        isMe: parseNumber(player.memberId) === memberId,
      }));
    },
  };

  class SiteWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    constructor(url) {
      this.url = String(url || "");
      this.readyState = SiteWebSocket.CONNECTING;
      this.listeners = { open: new Set(), message: new Set(), close: new Set(), error: new Set() };
      sockets.add(this);
      window.setTimeout(() => {
        if (this.readyState !== SiteWebSocket.CONNECTING) return;
        this.readyState = SiteWebSocket.OPEN;
        this.emit("open", {});
        this.deliver(this.welcomeMessage());
      }, 0);
    }

    addEventListener(type, listener) {
      this.listeners[type]?.add(listener);
    }

    removeEventListener(type, listener) {
      this.listeners[type]?.delete(listener);
    }

    send(data) {
      if (this.readyState !== SiteWebSocket.OPEN) return;
      let message = data;
      try {
        message = JSON.parse(data);
      } catch {}
      bridge.send(String(message?.type || "ws_send"), { wsClientMessage: message });
    }

    close() {
      if (this.readyState === SiteWebSocket.CLOSED) return;
      this.readyState = SiteWebSocket.CLOSED;
      sockets.delete(this);
      this.emit("close", {});
    }

    emit(type, event) {
      const handler = this[`on${type}`];
      if (typeof handler === "function") handler.call(this, event);
      this.listeners[type]?.forEach((listener) => listener.call(this, event));
    }

    deliver(message) {
      if (this.readyState !== SiteWebSocket.OPEN) return;
      this.emit("message", { data: JSON.stringify(decorateWsMessage(message)) });
    }

    welcomeMessage() {
      if (game === "fortress") {
        return { type: "fortress_welcome", id: myClientId, slot: Math.max(0, Math.min(1, seatNo - 1)), roomId, role: "client" };
      }
      if (game === "defense") {
        return { type: "defense_welcome", id: myClientId, roomId, isHost };
      }
      if (["kart", "bomb", "snake", "coin"].includes(game)) {
        return { type: "party_welcome", id: myClientId, roomId, game, isHost };
      }
      return { type: "welcome", id: myClientId, roomId };
    }
  }

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || data.source !== "ctfmon-video-game") {
      if (data?.source === "ctfmon-video-parent" && data.type === "touch_control") {
        window.dispatchEvent(new CustomEvent("good-etc-touch-control", { detail: data }));
        applyTouchControl(data.control, Boolean(data.pressed));
      }
      return;
    }
    if (data.type !== "signal" || !data.signal) return;
    const signal = normalizeSignal(data.signal);
    listeners.forEach((listener) => listener(signal));
    const wsMessage = signal.payload?.wsMessage ?? signal.payload?.ws_message;
    if (wsMessage) {
      sockets.forEach((socket) => socket.deliver(wsMessage));
    }
  });

  const keyByControl = {
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
    fire: " ",
    action: " ",
    dash: "Shift",
    attack: "j",
    interact: "e",
  };

  const clickByControl = {
    fortress_left: "moveLeftButton",
    fortress_right: "moveRightButton",
    fortress_angle_up: "angleUp",
    fortress_angle_down: "angleDown",
    fortress_power_down: "powerDown",
    fortress_power_up: "powerUp",
    fortress_fire: "fireButton",
    defense_wave: "defenseStartWave",
    defense_upgrade: "defenseUpgrade",
    defense_sell: "defenseSell",
  };

  function applyTouchControl(control, pressed) {
    if (!control) return;
    if (control === "defense_skill" && pressed) {
      document.querySelector("#defenseSkillButtons button:not([disabled])")?.click();
      return;
    }
    const buttonId = clickByControl[control];
    if (buttonId && pressed) {
      document.getElementById(buttonId)?.click();
      return;
    }
    const key = keyByControl[control];
    if (!key) return;
    const event = new KeyboardEvent(pressed ? "keydown" : "keyup", {
      key,
      code: key === " " ? "Space" : key,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
  }

  window.goodEtcSiteBridge = bridge;
  window.WebSocket = SiteWebSocket;
  postToParent("ready", {});
})();
