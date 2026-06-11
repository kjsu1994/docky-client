import api, { getApiErrorMessage } from "../utils/api.js";
import { compareMessagesByChronology, normalizeMessage } from "./chatAdapter.js";

export const GAME_ROOM_CHAT_MESSAGE_MAX_LENGTH = 500;

const unwrapGameChatData = (response) => response?.data?.data ?? response?.data ?? response ?? null;

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.content)) return value.content;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  return [];
};

export const normalizeGameRoomChatMessage = (message = {}) => normalizeMessage(message);

export const normalizeGameRoomChatMessages = (response) => toArray(unwrapGameChatData(response))
  .map(normalizeGameRoomChatMessage)
  .filter(Boolean)
  .sort(compareMessagesByChronology);

export const buildGameRoomChatPayload = ({ message }) => ({
  message: String(message || "").trim(),
  type: "TALK",
});

export const gameRoomChatErrorMessage = (error, fallbackMessage) => getApiErrorMessage(error, fallbackMessage);

export const gameRoomChatAdapter = {
  async fetchMessages(gameCode, roomId) {
    const response = await api.get(`/game/${gameCode}/rooms/${roomId}/chat/messages`);
    return normalizeGameRoomChatMessages(response);
  },
};
