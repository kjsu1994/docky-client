import { CheckCircle2, Crown, Trophy, UserRound } from "lucide-react";
import UserAvatar from "./UserAvatar.jsx";

const pick = (source, ...keys) => {
  if (!source) return undefined;
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key];
  }
  return undefined;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const defaultMemberId = (player) => toNumber(pick(player, "memberId", "member_id", "userId", "user_id", "id"), 0);
const defaultSeatNo = (player, index) => toNumber(pick(player, "seatNo", "seat_no", "seat"), index + 1);
const defaultNickname = (player, seatNo) => pick(player, "nickname", "name", "displayName", "display_name") || `좌석 ${seatNo}`;
const defaultProfileUrl = (player) => pick(player, "profileUrl", "profile_url", "profileImageUrl", "profile_image_url") || "";
const defaultLevel = (player) => pick(player, "level", "creatorLevel", "creator_level");
const defaultRewardTier = (player) => pick(player, "rewardTier", "reward_tier");
const defaultFrameCode = (player) => pick(player, "frameCode", "frame_code");
const defaultReady = (player) => Boolean(pick(player, "ready", "isReady", "is_ready"));

const readyBadgeClass = (ready) => ready ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600";

const badgeClass = {
  host: "bg-amber-100 text-amber-700",
  me: "bg-sky-100 text-sky-700",
  current: "bg-primary-100 text-primary-700",
  winner: "bg-emerald-600 text-white",
};

const statusLabel = (status) => {
  const normalized = String(status || "WAITING").toUpperCase();
  if (normalized === "PLAYING") return "진행 중";
  if (normalized === "FINISHED") return "종료";
  if (normalized === "CANCELLED") return "취소";
  return "대기 중";
};

const GameRoomPlayersPanel = ({
  players = [],
  selectedRoom = null,
  roomStatus = "WAITING",
  myMemberId = 0,
  hostMemberId,
  maxPlayers,
  title = "플레이어",
  getMemberId = defaultMemberId,
  getSeatNo = defaultSeatNo,
  getNickname = defaultNickname,
  getProfileUrl = defaultProfileUrl,
  getLevel = defaultLevel,
  getRewardTier = defaultRewardTier,
  getFrameCode = defaultFrameCode,
  getReady = defaultReady,
  getDetail,
  currentMemberId = 0,
  currentSeatNo = 0,
  winnerMemberId = 0,
  winnerSeatNos = [],
  dataSmoke = "game-room-players-panel",
  className = "",
}) => {
  const safePlayers = Array.isArray(players) ? players : [];
  const normalizedStatus = String(roomStatus || selectedRoom?.roomStatus || "WAITING").toUpperCase();
  const waiting = normalizedStatus === "WAITING";
  const resolvedHostMemberId = toNumber(hostMemberId ?? pick(selectedRoom, "hostMemberId", "host_member_id"), 0);
  const resolvedMaxPlayers = toNumber(maxPlayers ?? pick(selectedRoom, "maxPlayers", "max_players"), safePlayers.length || 0);
  const winnerSeatSet = new Set((Array.isArray(winnerSeatNos) ? winnerSeatNos : []).map((seatNo) => toNumber(seatNo, 0)).filter(Boolean));
  const rows = safePlayers
    .map((player, index) => {
      const memberId = toNumber(getMemberId(player), 0);
      const seatNo = toNumber(getSeatNo(player, index), index + 1);
      return {
        player,
        index,
        memberId,
        seatNo,
        nickname: getNickname(player, seatNo),
        profileUrl: getProfileUrl(player),
        level: getLevel(player),
        rewardTier: getRewardTier(player),
        frameCode: getFrameCode(player),
        ready: Boolean(getReady(player)),
      };
    })
    .sort((left, right) => left.seatNo - right.seatNo);
  const guests = rows.filter((row) => row.memberId !== resolvedHostMemberId);
  const readyGuestCount = guests.filter((row) => row.ready).length;
  const rosterSummary = waiting
    ? (guests.length ? `게스트 준비 ${readyGuestCount}/${guests.length}` : "방장 대기")
    : statusLabel(normalizedStatus);

  return (
    <section className={`rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg ${className}`} data-smoke={dataSmoke} data-room-status={normalizedStatus}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-black text-slate-900">
          <UserRound className="h-4 w-4 text-primary-600" />
          {title}
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px] font-black">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{rows.length}/{resolvedMaxPlayers || "-"}명</span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{rosterSummary}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {rows.map((row) => {
          const isHost = row.memberId > 0 && row.memberId === resolvedHostMemberId;
          const isMe = row.memberId > 0 && row.memberId === toNumber(myMemberId, 0);
          const isCurrent = (currentMemberId && row.memberId === toNumber(currentMemberId, 0)) || (currentSeatNo && row.seatNo === toNumber(currentSeatNo, 0));
          const isWinner = (winnerMemberId && row.memberId === toNumber(winnerMemberId, 0)) || winnerSeatSet.has(row.seatNo);
          const detail = getDetail
            ? getDetail(row.player, { seatNo: row.seatNo, waiting, isHost, isMe, isCurrent, isWinner })
            : `좌석 ${row.seatNo}${isHost ? " · 방장" : ""}`;
          const cardTone = isWinner
            ? "border-emerald-200 bg-emerald-50"
            : isCurrent && !waiting
              ? "border-amber-200 bg-amber-50"
              : isMe
                ? "border-sky-200 bg-sky-50"
                : row.ready && waiting && !isHost
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-slate-100 bg-slate-50";

          return (
            <div key={`${row.memberId || "seat"}-${row.seatNo}-${row.index}`} className={`rounded-xl border px-3 py-2 ${cardTone}`} data-smoke={`${dataSmoke}-item`} data-ready={row.ready ? "true" : "false"} data-host={isHost ? "true" : "false"}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <UserAvatar
                    name={row.nickname}
                    profileUrl={row.profileUrl}
                    level={row.level}
                    rewardTier={row.rewardTier}
                    frameCode={row.frameCode}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-slate-900">{row.nickname}</div>
                    <div className="mt-0.5 truncate text-[11px] font-bold text-slate-500">{detail}</div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  {isWinner && <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black ${badgeClass.winner}`}><Trophy className="h-3 w-3" />승자</span>}
                  {isHost && <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black ${badgeClass.host}`}><Crown className="h-3 w-3" />방장</span>}
                  {waiting && !isHost && <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black ${readyBadgeClass(row.ready)}`}><CheckCircle2 className="h-3 w-3" />{row.ready ? "준비 완료" : "준비 대기"}</span>}
                  {!waiting && isCurrent && !isWinner && <span className={`rounded-full px-2 py-1 text-[10px] font-black ${badgeClass.current}`}>현재 차례</span>}
                  {isMe && !isWinner && <span className={`rounded-full px-2 py-1 text-[10px] font-black ${badgeClass.me}`}>내 좌석</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!rows.length && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs font-bold text-slate-500">
          참가자 정보가 도착하면 프로필과 준비 상태가 표시됩니다.
        </div>
      )}
    </section>
  );
};

export default GameRoomPlayersPanel;
