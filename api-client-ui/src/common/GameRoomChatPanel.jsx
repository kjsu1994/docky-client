import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import {
  buildGameRoomChatPayload,
  GAME_ROOM_CHAT_MESSAGE_MAX_LENGTH,
  gameRoomChatAdapter,
  gameRoomChatErrorMessage,
  normalizeGameRoomChatMessage,
} from "../adapters/gameRoomChatAdapter.js";
import { buildStompConnectHeaders, createStompClient, notifyRealtimeError } from "../adapters/realtimeAdapter.js";
import {
  getLatestPersistentMessageId,
  mergeIncomingMessage,
  normalizeReplayMessageEvent,
} from "../adapters/chatAdapter.js";
import { realtimeReplayAdapter } from "../adapters/realtimeReplayAdapter.js";
import { notifyError } from "../utils/toast.js";
import UserAvatar from "./UserAvatar.jsx";

export const GameRoomChatPanel = ({
  gameCode,
  roomId,
  resetKey = "",
  title = "방 채팅",
  className = "",
}) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const clientRef = useRef(null);
  const subRef = useRef(null);
  const scrollRef = useRef(null);
  const mountedRef = useRef(false);
  const messagesRef = useRef([]);

  const normalizedRoomId = Number(roomId || 0);
  const canUseChat = Boolean(gameCode && normalizedRoomId > 0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!canUseChat) {
      setMessages([]);
      return;
    }
    let active = true;
    setLoading(true);
    gameRoomChatAdapter.fetchMessages(gameCode, normalizedRoomId)
      .then((items) => {
        if (active && mountedRef.current) setMessages(items);
      })
      .catch((error) => {
        if (active && mountedRef.current) {
          setMessages([]);
          notifyError(gameRoomChatErrorMessage(error, "게임 채팅을 불러오지 못했습니다."));
        }
      })
      .finally(() => {
        if (active && mountedRef.current) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canUseChat, gameCode, normalizedRoomId, resetKey]);

  useEffect(() => {
    if (!canUseChat) return undefined;
    let active = true;

    const connect = async () => {
      const connectHeaders = buildStompConnectHeaders();
      if (!connectHeaders.Authorization) return;
      const client = await createStompClient({
        endpoint: "/ws/chat",
        connectHeaders,
        reconnectDelay: 3000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
      });
      if (!active || !mountedRef.current) {
        client.deactivate();
        return;
      }
      client.beforeConnect = () => {
        client.connectHeaders = buildStompConnectHeaders();
      };
      client.onConnect = () => {
        if (!active || !mountedRef.current) return;
        setConnected(true);
        if (subRef.current) subRef.current.unsubscribe();
        subRef.current = client.subscribe(`/sub/game/${gameCode}/room/${normalizedRoomId}/chat`, (message) => {
          let payload = null;
          try {
            payload = normalizeGameRoomChatMessage(JSON.parse(message.body || "{}"));
          } catch {
            gameRoomChatAdapter.fetchMessages(gameCode, normalizedRoomId)
              .then((items) => mountedRef.current && setMessages(items))
              .catch(() => {});
            return;
          }
          if (payload) {
            setMessages((prev) => mergeIncomingMessage(prev, payload));
          }
        });
        const afterMessageId = getLatestPersistentMessageId(messagesRef.current);
        if (afterMessageId) {
          realtimeReplayAdapter.fetchGameRoomChat(gameCode, normalizedRoomId, { afterMessageId, limit: 50 })
            .then((replay) => {
              if (!active || !mountedRef.current) return;
              if (replay.fullSyncRequired) {
                gameRoomChatAdapter.fetchMessages(gameCode, normalizedRoomId)
                  .then((items) => active && mountedRef.current && setMessages(items))
                  .catch(() => {});
                return;
              }
              const replayedMessages = replay.events.map(normalizeReplayMessageEvent).filter(Boolean);
              if (replayedMessages.length) {
                setMessages((prev) => replayedMessages.reduce(mergeIncomingMessage, prev));
              }
            })
            .catch(() => {
              gameRoomChatAdapter.fetchMessages(gameCode, normalizedRoomId)
                .then((items) => active && mountedRef.current && setMessages(items))
                .catch(() => {});
            });
        }
      };
      client.onDisconnect = () => {
        if (mountedRef.current) setConnected(false);
      };
      client.onStompError = (frame) => {
        void notifyRealtimeError({
          scope: `game-room-chat-${gameCode}`,
          error: frame,
          fallbackMessage: "게임 채팅 연결에 문제가 생겼습니다.",
        });
      };
      client.activate();
      clientRef.current = client;
    };

    connect().catch(() => {
      if (mountedRef.current) {
        setConnected(false);
        notifyError("게임 채팅 연결을 준비하지 못했습니다.");
      }
    });

    return () => {
      active = false;
      setConnected(false);
      if (subRef.current) {
        subRef.current.unsubscribe();
        subRef.current = null;
      }
      if (clientRef.current) {
        clientRef.current.deactivate();
        clientRef.current = null;
      }
    };
  }, [canUseChat, gameCode, normalizedRoomId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = () => {
    const message = input.trim();
    if (!message || !canUseChat) return;
    if (message.length > GAME_ROOM_CHAT_MESSAGE_MAX_LENGTH) {
      notifyError(`게임 채팅은 ${GAME_ROOM_CHAT_MESSAGE_MAX_LENGTH}자까지 보낼 수 있습니다.`);
      return;
    }
    const client = clientRef.current;
    if (!client?.connected) {
      notifyError("게임 채팅 연결이 아직 준비되지 않았습니다.");
      return;
    }
    client.publish({
      destination: `/pub/game/${gameCode}/room/${normalizedRoomId}/chat`,
      body: JSON.stringify(buildGameRoomChatPayload({ message })),
      headers: { "content-type": "application/json" },
    });
    setInput("");
  };

  return (
    <aside
      className={`rounded-[1.8rem] border border-line bg-surface p-4 shadow-lg ${className}`}
      data-smoke="game-room-chat-panel"
      data-chat-game={gameCode}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-black text-ink">
          <MessageSquare className="h-4 w-4" />
          {title}
        </div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-black ${connected ? "bg-emerald-500/10 text-emerald-700" : "bg-control text-ink-muted"}`}>
          {connected ? "연결됨" : "대기"}
        </span>
      </div>

      <div ref={scrollRef} className="mb-3 h-[min(34vh,260px)] space-y-2 overflow-auto overscroll-contain rounded-2xl bg-control p-3 text-xs sm:h-[320px] xl:h-[360px]">
        {loading && (
          <div className="rounded-xl border border-line bg-surface px-3 py-2 font-bold text-ink-muted">
            채팅을 불러오는 중입니다.
          </div>
        )}
        {!loading && !messages.length && (
          <div
            className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface px-4 py-6 text-center"
            data-smoke="game-chat-empty-state"
            data-chat-game={gameCode}
          >
            <MessageSquare className="h-7 w-7 text-ink-subtle" />
            <div className="mt-2 text-sm font-black text-ink-muted">아직 채팅 내역이 없습니다</div>
            <div className="mt-1 text-xs font-bold leading-relaxed text-ink-subtle">이 방 안에서만 보이고, 한 판이 끝나면 남지 않습니다.</div>
          </div>
        )}
        {messages.map((message) => (
          <div key={message.messageId || message.id || message.key} className="rounded-xl border border-line bg-surface px-3 py-2">
            <div className="flex items-center gap-2 font-black text-ink">
              <UserAvatar
                name={message.senderName || "SYSTEM"}
                profileUrl={message.senderProfileUrl}
                level={message.senderLevel}
                rewardTier={message.senderRewardTier}
                frameCode={message.senderFrameCode}
                size="xs"
              />
              <span className="min-w-0 truncate">{message.senderName || "SYSTEM"}</span>
            </div>
            <div className="mt-0.5 break-words text-ink-muted">{message.message || ""}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-xl border border-line bg-control px-3 py-2 text-sm text-ink placeholder:text-ink-subtle"
          placeholder="메시지를 입력하세요"
          value={input}
          maxLength={GAME_ROOM_CHAT_MESSAGE_MAX_LENGTH}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              sendMessage();
            }
          }}
        />
        <button
          type="button"
          className="inline-flex min-h-10 items-center justify-center rounded-xl bg-ink px-3 text-xs font-black text-ink-inverse disabled:opacity-40"
          disabled={!input.trim() || !canUseChat}
          onClick={sendMessage}
          aria-label="게임 채팅 전송"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
};

export default GameRoomChatPanel;
