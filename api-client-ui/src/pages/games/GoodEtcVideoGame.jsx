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
  Sparkles,
  Timer,
  Users,
  Zap,
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
import { GameActionCueBar, GameFlowMeter, GameResultSpotlight, GameUxGlyph } from "./GameUxAssets.jsx";
import { VideoControlGlyph, VideoGameArtwork, videoGameArtProfiles } from "./VideoGameArtwork.jsx";

const videoGameProfiles = {
  arena: {
    title: "LAN Arena",
    maxPlayers: 8,
    tone: "from-cyan-500 via-slate-950 to-emerald-500",
    storage: "DB 방 메타데이터 + STOMP 실시간 상태 + Redis 확장 준비",
    controls: [
      { label: "위", control: "up" },
      { label: "왼쪽", control: "left" },
      { label: "오른쪽", control: "right" },
      { label: "아래", control: "down" },
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
      { label: "이동 왼쪽", control: "fortress_left" },
      { label: "이동 오른쪽", control: "fortress_right" },
      { label: "포각 올림", control: "fortress_angle_up" },
      { label: "포각 내림", control: "fortress_angle_down" },
      { label: "파워 낮춤", control: "fortress_power_down" },
      { label: "파워 높임", control: "fortress_power_up" },
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
      { label: "위", control: "up" },
      { label: "왼쪽", control: "left" },
      { label: "오른쪽", control: "right" },
      { label: "아래", control: "down" },
      { label: "드리프트", control: "action" },
    ],
  },
  bomb: {
    title: "Bomb Battle",
    maxPlayers: 8,
    tone: "from-rose-600 via-zinc-950 to-amber-500",
    storage: "DB 방 메타데이터 + STOMP 폭탄/충돌 상태",
    controls: [
      { label: "위", control: "up" },
      { label: "왼쪽", control: "left" },
      { label: "오른쪽", control: "right" },
      { label: "아래", control: "down" },
      { label: "폭탄", control: "action" },
    ],
  },
  snake: {
    title: "Snake Rush",
    maxPlayers: 8,
    tone: "from-emerald-500 via-lime-500 to-slate-950",
    storage: "DB 방 메타데이터 + STOMP 방향/성장 상태",
    controls: [
      { label: "위", control: "up" },
      { label: "왼쪽", control: "left" },
      { label: "오른쪽", control: "right" },
      { label: "아래", control: "down" },
      { label: "질주", control: "action" },
    ],
  },
  coin: {
    title: "Coin Collector",
    maxPlayers: 8,
    tone: "from-yellow-400 via-orange-500 to-sky-700",
    storage: "DB 방 메타데이터 + STOMP 수집/점수 상태",
    controls: [
      { label: "위", control: "up" },
      { label: "왼쪽", control: "left" },
      { label: "오른쪽", control: "right" },
      { label: "아래", control: "down" },
      { label: "대시", control: "action" },
    ],
  },
  rpg: {
    title: "Good_ETC RPG",
    maxPlayers: 1,
    tone: "from-violet-700 via-slate-950 to-emerald-700",
    storage: "localStorage 진행 저장 + DB 방 메타데이터",
    controls: [
      { label: "위", control: "up" },
      { label: "왼쪽", control: "left" },
      { label: "오른쪽", control: "right" },
      { label: "아래", control: "down" },
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

const initialVideoInputFeedback = () => ({
  status: "idle",
  label: "입력 대기",
  message: "아직 전달한 입력이 없습니다.",
  detail: "게임이 시작되면 모바일 버튼과 Good_ETC 입력 브리지 상태가 여기에 남습니다.",
});

const videoInputFeedbackStatusLabel = (status) => {
  if (status === "pending") return "입력 유지";
  if (status === "done") return "전달 완료";
  if (status === "error") return "전달 불가";
  return "대기";
};

const videoInputControlLabel = (controlKey, controls = []) => {
  const found = controls.find((control) => (typeof control === "string" ? control : control?.control) === controlKey);
  return (typeof found === "string" ? found : found?.label) || controlKey || "입력";
};

const videoDirectionLabels = {
  up: "위",
  left: "왼쪽",
  right: "오른쪽",
  down: "아래",
};

const videoControlKey = (control) => (typeof control === "string" ? control : control?.control) || "";
const videoControlLabel = (control) => (typeof control === "string" ? control : control?.label) || videoControlKey(control) || "입력";
const videoControlAccessibleLabel = (control) => videoDirectionLabels[videoControlKey(control)] || videoControlLabel(control);

const roomPlayers = (room) => (Array.isArray(room?.players) ? room.players : []);

const videoGamePlayBriefs = {
  arena: {
    objective: "짧은 교전에서 시야를 넓게 잡고 이동, 사격, 대시 타이밍을 빠르게 연결하세요.",
    rhythm: "실시간 난전",
    input: "방향키로 위치를 바꾸고 사격/대시 입력을 짧게 눌러 빈틈을 만듭니다.",
  },
  fortress: {
    objective: "이동보다 각도와 파워 조절이 핵심입니다. 한 발씩 탄도를 확인하며 다음 사격을 보정하세요.",
    rhythm: "턴 감각 포격",
    input: "좌우 이동 후 각도와 파워를 조정하고 발사 입력으로 한 번에 결과를 확인합니다.",
  },
  defense: {
    objective: "웨이브 흐름을 읽고 타워 배치, 업그레이드, 스킬 사용 순서를 안정적으로 맞추세요.",
    rhythm: "협동 방어",
    input: "웨이브/업그레이드/판매/스킬 버튼을 상황에 맞춰 눌러 방어선을 유지합니다.",
  },
  kart: {
    objective: "코너 진입 전 속도를 정리하고 드리프트와 아이템 타이밍으로 순위를 뒤집으세요.",
    rhythm: "고속 레이스",
    input: "방향 입력으로 라인을 잡고 액션 입력으로 드리프트나 아이템 사용 타이밍을 만듭니다.",
  },
  bomb: {
    objective: "폭탄 설치 뒤 탈출 경로를 먼저 확보하세요. 폭발 범위와 벽 배치를 함께 읽어야 합니다.",
    rhythm: "그리드 심리전",
    input: "방향키로 안전 칸을 확보하고 액션 입력으로 폭탄을 설치합니다.",
  },
  snake: {
    objective: "성장보다 충돌 회피가 우선입니다. 다음 회전 공간을 남겨두며 길이를 늘리세요.",
    rhythm: "반응형 성장",
    input: "방향 전환을 짧게 누르고 액션 입력은 질주가 필요한 구간에서만 사용합니다.",
  },
  coin: {
    objective: "가까운 코인보다 다음 묶음까지 이어지는 수집 루트를 먼저 보고 움직이세요.",
    rhythm: "점수 러시",
    input: "방향 입력으로 동선을 유지하고 액션 입력으로 속도를 끌어올립니다.",
  },
  rpg: {
    objective: "전투와 상호작용을 번갈아 진행하며 같은 기기에서 이어지는 저장 흐름을 확인하세요.",
    rhythm: "솔로 탐험",
    input: "이동, 공격, 상호작용 입력으로 퀘스트와 전투를 차례로 진행합니다.",
  },
};

const videoGameStageHudBriefs = {
  arena: {
    mission: "엄폐 없는 난전에서는 중앙을 오래 점유하지 말고 짧은 이동으로 사격 각을 바꾸세요.",
    danger: "정지 시간이 길어지거나 대시 이후 빈틈이 생기면 바로 피격 위험이 커집니다.",
    reward: "연속 생존과 정확한 타격이 점수와 교전 우위를 만듭니다.",
  },
  fortress: {
    mission: "이전 탄착점을 기준으로 각도와 파워를 한 단계씩 보정하세요.",
    danger: "무리한 이동보다 잘못된 포각이 턴 손실을 만듭니다.",
    reward: "한 발의 명중이 라운드 흐름을 크게 뒤집습니다.",
  },
  defense: {
    mission: "웨이브가 밀리기 전에 업그레이드와 스킬 타이밍을 먼저 정리하세요.",
    danger: "판매나 업그레이드가 늦으면 방어선 공백이 생깁니다.",
    reward: "안정적인 웨이브 클리어가 다음 선택지를 넓혀줍니다.",
  },
  kart: {
    mission: "코너 전 라인을 정리하고 드리프트 이후 가속 구간을 확보하세요.",
    danger: "벽 접촉과 늦은 드리프트가 순위를 빠르게 떨어뜨립니다.",
    reward: "깨끗한 코너 탈출과 아이템 타이밍이 추월 기회를 만듭니다.",
  },
  bomb: {
    mission: "폭탄을 놓기 전에 퇴로와 상대 이동 방향을 먼저 확인하세요.",
    danger: "막힌 골목과 연쇄 폭발 범위가 가장 큰 위협입니다.",
    reward: "상대를 몰아넣는 배치가 직접 처치보다 강한 압박을 만듭니다.",
  },
  snake: {
    mission: "몸통이 길어질수록 다음 회전 공간을 남기는 경로가 우선입니다.",
    danger: "짧은 이득을 위해 막다른 경로로 들어가면 회복이 어렵습니다.",
    reward: "충돌 없이 성장 루트를 유지하면 후반 공간 장악력이 커집니다.",
  },
  coin: {
    mission: "가까운 코인 하나보다 다음 묶음까지 이어지는 루트를 잡으세요.",
    danger: "무리한 방향 전환은 수집 리듬과 속도를 동시에 잃게 합니다.",
    reward: "연속 수집과 대시 타이밍이 점수 상승 체감을 만듭니다.",
  },
  rpg: {
    mission: "전투, 상호작용, 저장 흐름을 차례로 확인하며 탐험 루틴을 만드세요.",
    danger: "상호작용 지점을 놓치면 진행 단서와 보상이 늦어집니다.",
    reward: "전투 승리와 탐험 저장이 다음 플레이의 지속감을 만듭니다.",
  },
};

const readableVideoGameProfiles = {
  arena: {
    title: "LAN Arena",
    maxPlayers: 8,
    tone: "from-cyan-500 via-slate-950 to-emerald-500",
    storage: "DB 메타데이터 + STOMP 실시간 상태 + Redis 확장 준비",
    controls: [
      { label: "위", control: "up" },
      { label: "왼쪽", control: "left" },
      { label: "오른쪽", control: "right" },
      { label: "아래", control: "down" },
      { label: "발사", control: "fire" },
      { label: "대시", control: "dash" },
    ],
  },
  fortress: {
    title: "Fortress",
    maxPlayers: 2,
    tone: "from-amber-500 via-sky-600 to-slate-950",
    storage: "DB 메타데이터 + 턴 상태 JSON + STOMP 턴 알림",
    controls: [
      { label: "이동 왼쪽", control: "fortress_left" },
      { label: "이동 오른쪽", control: "fortress_right" },
      { label: "각도 올림", control: "fortress_angle_up" },
      { label: "각도 내림", control: "fortress_angle_down" },
      { label: "파워 낮춤", control: "fortress_power_down" },
      { label: "파워 높임", control: "fortress_power_up" },
      { label: "발사", control: "fortress_fire" },
    ],
  },
  defense: {
    title: "Defense",
    maxPlayers: 4,
    tone: "from-lime-500 via-emerald-700 to-slate-950",
    storage: "DB 메타데이터 + STOMP 웨이브 상태 + Redis 확장 준비",
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
    storage: "DB 메타데이터 + STOMP 위치/아이템 상태",
    controls: [
      { label: "위", control: "up" },
      { label: "왼쪽", control: "left" },
      { label: "오른쪽", control: "right" },
      { label: "아래", control: "down" },
      { label: "드리프트", control: "action" },
    ],
  },
  bomb: {
    title: "Bomb Battle",
    maxPlayers: 8,
    tone: "from-rose-600 via-zinc-950 to-amber-500",
    storage: "DB 메타데이터 + STOMP 폭탄/충돌 상태",
    controls: [
      { label: "위", control: "up" },
      { label: "왼쪽", control: "left" },
      { label: "오른쪽", control: "right" },
      { label: "아래", control: "down" },
      { label: "폭탄", control: "action" },
    ],
  },
  snake: {
    title: "Snake Rush",
    maxPlayers: 8,
    tone: "from-emerald-500 via-lime-500 to-slate-950",
    storage: "DB 메타데이터 + STOMP 방향/성장 상태",
    controls: [
      { label: "위", control: "up" },
      { label: "왼쪽", control: "left" },
      { label: "오른쪽", control: "right" },
      { label: "아래", control: "down" },
      { label: "질주", control: "action" },
    ],
  },
  coin: {
    title: "Coin Collector",
    maxPlayers: 8,
    tone: "from-yellow-400 via-orange-500 to-sky-700",
    storage: "DB 메타데이터 + STOMP 수집/점수 상태",
    controls: [
      { label: "위", control: "up" },
      { label: "왼쪽", control: "left" },
      { label: "오른쪽", control: "right" },
      { label: "아래", control: "down" },
      { label: "대시", control: "action" },
    ],
  },
  rpg: {
    title: "Good_ETC RPG",
    maxPlayers: 1,
    tone: "from-violet-700 via-slate-950 to-emerald-700",
    storage: "localStorage 진행 저장 + DB 메타데이터",
    controls: [
      { label: "위", control: "up" },
      { label: "왼쪽", control: "left" },
      { label: "오른쪽", control: "right" },
      { label: "아래", control: "down" },
      { label: "공격", control: "attack" },
      { label: "상호작용", control: "interact" },
    ],
  },
};

const readableVideoGamePlayBriefs = {
  arena: {
    objective: "좁은 교전 공간에서 시야를 넓게 읽고 이동, 발사, 대시 타이밍을 빠르게 연결하세요.",
    rhythm: "실시간 교전",
    input: "방향키로 위치를 바꾸고 발사/대시 입력을 짧게 눌러 빈틈을 만듭니다.",
  },
  fortress: {
    objective: "이동보다 각도와 파워 조절이 핵심입니다. 이전 탄착 지점을 보고 다음 포격을 보정하세요.",
    rhythm: "턴 감각 포격",
    input: "좌우 이동 후 각도와 파워를 조정하고 발사 입력으로 한 번에 결과를 확인합니다.",
  },
  defense: {
    objective: "웨이브 흐름을 읽고 타워 배치, 업그레이드, 스킬 사용 순서를 안정적으로 맞추세요.",
    rhythm: "협동 방어",
    input: "웨이브, 업그레이드, 판매, 스킬 버튼을 상황에 맞춰 눌러 방어선을 유지합니다.",
  },
  kart: {
    objective: "코너 진입 전 속도를 정리하고 드리프트와 아이템 타이밍으로 순위를 뒤집으세요.",
    rhythm: "고속 레이스",
    input: "방향 입력으로 라인을 잡고 액션 입력으로 드리프트나 아이템 사용 타이밍을 만듭니다.",
  },
  bomb: {
    objective: "폭탄 설치 전 탈출 경로를 먼저 확보하세요. 폭발 범위와 벽 배치를 함께 읽어야 합니다.",
    rhythm: "그리드 심리전",
    input: "방향키로 안전 칸을 확보하고 액션 입력으로 폭탄을 설치합니다.",
  },
  snake: {
    objective: "성장보다 충돌 회피가 우선입니다. 다음 회전 공간을 남기며 길이를 늘리세요.",
    rhythm: "반응형 성장",
    input: "방향 전환은 짧게 누르고 액션 입력은 질주가 필요한 구간에서만 사용합니다.",
  },
  coin: {
    objective: "가까운 코인보다 다음 묶음까지 이어지는 수집 루트를 먼저 보고 움직이세요.",
    rhythm: "점수 쇄도",
    input: "방향 입력으로 동선을 유지하고 액션 입력으로 속도를 끌어올립니다.",
  },
  rpg: {
    objective: "전투와 상호작용을 번갈아 진행하며 같은 기기에서 이어지는 저장 흐름을 확인하세요.",
    rhythm: "솔로 탐험",
    input: "이동, 공격, 상호작용 입력으로 퀘스트와 전투를 차례로 진행합니다.",
  },
};

const readableVideoGameStageHudBriefs = {
  arena: {
    mission: "엄폐 없는 교전에서는 중앙에 오래 머물지 말고 짧은 이동으로 발사 각을 바꾸세요.",
    danger: "정지 시간이 길어지거나 대시 뒤 빈틈이 생기면 바로 반격 위험이 커집니다.",
    reward: "연속 생존과 정확한 타격이 점수와 교전 우위를 만듭니다.",
  },
  fortress: {
    mission: "이전 탄착점을 기준으로 각도와 파워를 한 단계씩 보정하세요.",
    danger: "무리한 이동보다 잘못된 포격 각도가 턴 손실을 만듭니다.",
    reward: "한 발의 명중이 라운드 흐름을 크게 뒤집습니다.",
  },
  defense: {
    mission: "웨이브가 몰리기 전에 업그레이드와 스킬 타이밍을 먼저 정리하세요.",
    danger: "판매와 업그레이드가 늦으면 방어선 공백이 생깁니다.",
    reward: "안정적인 웨이브 클리어가 다음 선택지를 넓혀 줍니다.",
  },
  kart: {
    mission: "코너 전 라인을 정리하고 드리프트 이후 가속 구간을 확보하세요.",
    danger: "벽 접촉과 늦은 드리프트가 순위를 빠르게 떨어뜨립니다.",
    reward: "깔끔한 코너 탈출과 아이템 타이밍이 추월 기회를 만듭니다.",
  },
  bomb: {
    mission: "폭탄을 놓기 전에 퇴로와 상대 이동 방향을 먼저 확인하세요.",
    danger: "막다른 골목과 연쇄 폭발 범위가 가장 큰 위험입니다.",
    reward: "상대를 몰아넣는 배치가 직접 처치보다 강한 압박을 만듭니다.",
  },
  snake: {
    mission: "몸통이 길어질수록 다음 회전 공간을 남기는 경로가 우선입니다.",
    danger: "지금 먹기 위해 막다른 경로로 들어가면 탈출이 어려워집니다.",
    reward: "충돌 없이 성장 루트를 유지하면 후반 공간 압박이 커집니다.",
  },
  coin: {
    mission: "가까운 코인 하나보다 다음 묶음까지 이어지는 루트를 잡으세요.",
    danger: "무리한 방향 전환은 수집 리듬과 속도를 동시에 꺾습니다.",
    reward: "연속 수집과 대시 타이밍이 점수 상승 체감을 만듭니다.",
  },
  rpg: {
    mission: "전투, 상호작용, 저장 흐름을 차례로 확인하며 탐험 루틴을 만드세요.",
    danger: "상호작용 지점을 놓치면 진행 단서와 보상이 늦어집니다.",
    reward: "전투 승리와 탐험 저장이 다음 플레이의 지속감을 만듭니다.",
  },
};

const readableVideoStatusLabel = {
  WAITING: "대기 중",
  PLAYING: "진행 중",
  FINISHED: "종료",
  CANCELLED: "취소",
};

const readableVideoDirectionLabels = {
  up: "위",
  left: "왼쪽",
  right: "오른쪽",
  down: "아래",
};

Object.assign(videoGameProfiles, readableVideoGameProfiles);
Object.assign(videoGamePlayBriefs, readableVideoGamePlayBriefs);
Object.assign(videoGameStageHudBriefs, readableVideoGameStageHudBriefs);
Object.assign(statusLabel, readableVideoStatusLabel);
Object.assign(videoDirectionLabels, readableVideoDirectionLabels);

const initialReadableVideoInputFeedback = () => ({
  status: "idle",
  label: "입력 대기",
  message: "아직 전달된 입력이 없습니다.",
  detail: "게임이 시작되면 모바일 버튼과 Good_ETC 입력 브리지 상태가 여기에 표시됩니다.",
});

const readableVideoInputFeedbackStatusLabel = (status) => {
  if (status === "pending") return "입력 전송 중";
  if (status === "done") return "전달 완료";
  if (status === "error") return "전달 불가";
  return "대기";
};

const readableVideoInputControlLabel = (controlKey, controls = []) => {
  const found = controls.find((control) => (typeof control === "string" ? control : control?.control) === controlKey);
  return (typeof found === "string" ? found : found?.label) || controlKey || "입력";
};

const videoResultText = (value, fallback = "") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const videoResultNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const videoResultPick = (source, keys, fallback = undefined) => {
  if (!source || typeof source !== "object") return fallback;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined && source[key] !== null && source[key] !== "") {
      return source[key];
    }
  }
  return fallback;
};

const videoResultScoreKeys = ["score", "points", "totalScore", "total", "value", "kills", "coins", "survivalTime", "time"];

const findVideoResultPlayer = (players, { seatNo, memberId, name } = {}) => {
  if (memberId !== null && memberId !== undefined) {
    const byMember = players.find((player) => Number(getVideoGameMemberId(player)) === Number(memberId));
    if (byMember) return byMember;
  }
  if (seatNo !== null && seatNo !== undefined) {
    const bySeat = players.find((player) => Number(getVideoGameSeatNo(player)) === Number(seatNo));
    if (bySeat) return bySeat;
  }
  if (name) {
    const byName = players.find((player) => videoResultText(player?.nickname) === name);
    if (byName) return byName;
  }
  return null;
};

const normalizeVideoResultEntry = (rawEntry, index, players, sourceKey = "") => {
  const source = rawEntry && typeof rawEntry === "object" ? rawEntry : { score: rawEntry };
  const seatNo = videoResultNumber(videoResultPick(source, ["seatNo", "seat_no", "seat", "playerSeatNo", "player_seat_no"]));
  const memberId = videoResultNumber(videoResultPick(source, ["memberId", "member_id", "playerId", "player_id", "id"]));
  const rawName = videoResultText(videoResultPick(source, ["nickname", "name", "playerName", "player_name", "displayName", "display_name"]));
  const matchedPlayer = findVideoResultPlayer(players, { seatNo, memberId, name: rawName });
  const rank = videoResultNumber(videoResultPick(source, ["rank", "place", "position"]));
  const scoreKey = videoResultScoreKeys.find((key) => videoResultNumber(source[key]) !== null);
  const score = scoreKey ? videoResultNumber(source[scoreKey]) : null;
  const metricLabel = scoreKey
    ? ({ survivalTime: "생존 시간", kills: "처치", coins: "코인", time: "기록" }[scoreKey] || "점수")
    : videoResultText(videoResultPick(source, ["metric", "basis", "resultMetric", "result_metric"]), sourceKey === "ranking" ? "순위" : "결과");
  const name = rawName || matchedPlayer?.nickname || (seatNo ? `좌석 ${seatNo}` : memberId ? `플레이어 ${memberId}` : `플레이어 ${index + 1}`);
  const reason = videoResultText(videoResultPick(source, ["reason", "detail", "description", "resultReason", "result_reason"]));
  return {
    key: `${memberId || "m"}-${seatNo || "s"}-${name}-${index}`,
    order: index,
    rank,
    seatNo,
    memberId,
    name,
    score,
    metricLabel,
    reason,
    sourceKey,
  };
};

const normalizeVideoResultEntries = (gameState, players) => {
  if (!gameState || typeof gameState !== "object") return [];
  const arraySourceKeys = ["ranking", "rankings", "leaderboard", "scoreboard", "results", "resultPlayers", "result_players"];
  for (const key of arraySourceKeys) {
    const value = gameState[key];
    if (Array.isArray(value) && value.length) {
      const sourceKey = key.includes("rank") ? "ranking" : key;
      const entries = value.map((entry, index) => normalizeVideoResultEntry(entry, index, players, sourceKey));
      return orderVideoResultEntries(entries, sourceKey);
    }
  }
  const scores = gameState.scores || gameState.scoreBySeat || gameState.score_by_seat || gameState.scoreByPlayer || gameState.score_by_player;
  if (Array.isArray(scores) && scores.length) {
    return orderVideoResultEntries(scores.map((entry, index) => normalizeVideoResultEntry(entry, index, players, "scores")), "scores");
  }
  if (scores && typeof scores === "object") {
    const entries = Object.entries(scores).map(([key, value], index) => {
      const numericKey = videoResultNumber(key);
      const source = value && typeof value === "object"
        ? { ...value }
        : { score: value };
      if (numericKey !== null && source.seatNo === undefined && source.memberId === undefined) {
        source.seatNo = numericKey;
      }
      return normalizeVideoResultEntry(source, index, players, "scores");
    });
    return orderVideoResultEntries(entries, "scores");
  }
  return [];
};

const orderVideoResultEntries = (entries, sourceKey = "") => {
  const uniqueEntries = [...new Map(entries.filter(Boolean).map((entry) => [entry.memberId || entry.seatNo || entry.name, entry])).values()];
  if (uniqueEntries.some((entry) => entry.rank !== null)) {
    return [...uniqueEntries].sort((left, right) => (left.rank ?? 999) - (right.rank ?? 999));
  }
  if (sourceKey === "scores" && uniqueEntries.some((entry) => entry.score !== null)) {
    return [...uniqueEntries].sort((left, right) => (right.score ?? -Infinity) - (left.score ?? -Infinity));
  }
  return uniqueEntries;
};

const findExplicitVideoWinner = (gameState, players, entries) => {
  if (!gameState || typeof gameState !== "object") return null;
  const winnerObject = videoResultPick(gameState, ["winner", "winnerPlayer", "winner_player"]);
  if (winnerObject && typeof winnerObject === "object") {
    return normalizeVideoResultEntry(winnerObject, 0, players, "winner");
  }
  const winnerSeatNo = videoResultNumber(videoResultPick(gameState, ["winnerSeatNo", "winner_seat_no", "winningSeatNo", "winning_seat_no"]));
  const winnerMemberId = videoResultNumber(videoResultPick(gameState, ["winnerMemberId", "winner_member_id", "winningMemberId", "winning_member_id"]));
  const winnerName = videoResultText(videoResultPick(gameState, ["winnerName", "winner_name", "winnerNickname", "winner_nickname"]));
  if (winnerSeatNo !== null || winnerMemberId !== null || winnerName) {
    return entries.find((entry) => (
      (winnerSeatNo !== null && Number(entry.seatNo) === winnerSeatNo) ||
      (winnerMemberId !== null && Number(entry.memberId) === winnerMemberId) ||
      (winnerName && entry.name === winnerName)
    )) || normalizeVideoResultEntry({ seatNo: winnerSeatNo, memberId: winnerMemberId, nickname: winnerName }, 0, players, "winner");
  }
  return null;
};

const buildVideoGameResultBreakdown = ({
  gameState,
  players,
  selectedRoom,
  profile,
  videoGameCode,
  transportLabel,
  videoPlayBrief,
  videoHudBrief,
}) => {
  const entries = normalizeVideoResultEntries(gameState, players);
  const winner = findExplicitVideoWinner(gameState, players, entries) || entries[0] || null;
  const runnerUp = winner ? entries.find((entry) => entry.key !== winner.key) : entries[1] || null;
  const winnerReason = videoResultText(videoResultPick(gameState, [
    "winnerReason",
    "winner_reason",
    "resultReason",
    "result_reason",
    "outcomeMessage",
    "outcome_message",
    "summary",
    "message",
  ]));
  const fallbackReason = videoHudBrief.reward || videoPlayBrief.objective || "방 상태가 종료되어 결과가 확정되었습니다.";
  const basis = winnerReason || winner?.reason || fallbackReason;
  const scoreText = winner?.score !== null && winner?.score !== undefined ? `${winner.metricLabel} ${winner.score}` : "";
  const gap = winner?.score !== null && winner?.score !== undefined && runnerUp?.score !== null && runnerUp?.score !== undefined
    ? `${Math.abs(winner.score - runnerUp.score)} 차이`
    : runnerUp
      ? `${runnerUp.name}보다 앞선 결과`
      : "단독 결과";
  const title = winner ? `${winner.name} 승리` : `${profile.title} 결과 확인`;
  const detail = winner
    ? `${winner.name}님이 ${scoreText || winner.metricLabel || "서버 결과"} 기준으로 앞섰습니다. ${basis}`
    : `${profile.title} 세션이 종료되었습니다. ${basis}`;
  const metric = winner
    ? `${scoreText || "승자 확정"} · 참가 ${players.length}/${selectedRoom?.maxPlayers || profile.maxPlayers}명 · ${transportLabel}`
    : `참가 ${players.length}/${selectedRoom?.maxPlayers || profile.maxPlayers}명 · ${transportLabel}`;
  const safeEntries = entries.length ? entries : players.slice(0, 4).map((player, index) => normalizeVideoResultEntry({
    seatNo: getVideoGameSeatNo(player),
    memberId: getVideoGameMemberId(player),
    nickname: player.nickname,
  }, index, players, "participants"));
  return {
    title,
    subtitle: "비디오게임 결과",
    detail,
    metric,
    winnerName: winner?.name || "",
    basis,
    entries: safeEntries.slice(0, 4),
    items: [
      {
        key: "winner",
        icon: "win",
        label: "승자",
        value: winner?.name || "승자 정보 대기",
        detail: scoreText || "서버 결과 신호를 기다립니다.",
      },
      {
        key: "basis",
        icon: "decision",
        label: "승리 근거",
        value: winner?.metricLabel || "결과 기준",
        detail: basis,
      },
      {
        key: "gap",
        icon: "score",
        label: "격차",
        value: gap,
        detail: runnerUp ? `다음 순위: ${runnerUp.name}` : `${videoGameCode} 세션의 종료 상태입니다.`,
      },
      {
        key: "next",
        icon: "stage",
        label: "다음 행동",
        value: "새 방 또는 재입장",
        detail: "결과를 확인한 뒤 같은 방 상태를 새로고침하거나 허브에서 다음 세션을 선택하세요.",
      },
    ],
  };
};

const VideoGameResultTraceArt = ({ entries = [], winnerName = "" }) => {
  const visibleEntries = entries.length ? entries.slice(0, 4) : [{ name: "결과", score: 1, metricLabel: "완료" }];
  const scores = visibleEntries.map((entry) => Number(entry.score || 0));
  const maxScore = Math.max(1, ...scores);
  return (
    <svg
      viewBox="0 0 320 190"
      role="img"
      aria-label="비디오게임 결과 흐름"
      className="h-full min-h-[180px] w-full"
      data-smoke="video-game-result-trace-art"
    >
      <rect x="12" y="12" width="296" height="166" rx="22" fill="#0f172a" />
      <path d="M40 142C78 62 122 152 158 94c32-52 70-34 118-66" fill="none" stroke="#38bdf8" strokeWidth="6" strokeLinecap="round" opacity=".2" />
      <path d="M40 142C78 62 122 152 158 94c32-52 70-34 118-66" fill="none" stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="8 9" opacity=".82" />
      <rect x="34" y="34" width="112" height="78" rx="16" fill="#ffffff" opacity=".96" />
      <rect x="48" y="48" width="72" height="11" rx="5" fill="#cbd5e1" />
      <rect x="48" y="70" width="88" height="8" rx="4" fill="#bae6fd" />
      <rect x="48" y="88" width="54" height="8" rx="4" fill="#bbf7d0" />
      <circle cx="238" cy="72" r="34" fill="#f59e0b" opacity=".94" />
      <circle cx="238" cy="72" r="22" fill="#0f172a" opacity=".9" />
      <text x="238" y="78" textAnchor="middle" fontSize="20" fontWeight="900" fill="#fef3c7">1</text>
      {visibleEntries.map((entry, index) => {
        const height = Math.max(18, Math.round(((Number(entry.score || 0) || (visibleEntries.length - index)) / maxScore) * 70));
        const x = 62 + index * 48;
        const y = 154 - height;
        const active = winnerName && entry.name === winnerName;
        return (
          <g key={`${entry.name}-${index}`} data-smoke="video-game-result-trace-node">
            <rect x={x} y={y} width="28" height={height} rx="9" fill={active || index === 0 ? "#10b981" : "#64748b"} />
            <circle cx={x + 14} cy={y - 12} r="12" fill={active || index === 0 ? "#f59e0b" : "#94a3b8"} stroke="#ffffff" strokeWidth="3" />
            <text x={x + 14} y={y - 8} textAnchor="middle" fontSize="9" fontWeight="900" fill="#ffffff">{entry.rank || index + 1}</text>
          </g>
        );
      })}
      <text x="160" y="170" textAnchor="middle" fontSize="10" fontWeight="900" fill="#e2e8f0">결과 신호 · 순위 · 다음 세션</text>
    </svg>
  );
};

const VideoGameResultBreakdownPanel = ({ breakdown }) => {
  if (!breakdown) return null;
  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg"
      data-smoke="video-game-result-breakdown-panel"
      data-winner-name={breakdown.winnerName || ""}
    >
      <div className="grid gap-0 lg:grid-cols-[minmax(250px,320px)_1fr]">
        <div className="bg-slate-950 p-3 sm:p-4">
          <VideoGameResultTraceArt entries={breakdown.entries} winnerName={breakdown.winnerName} />
        </div>
        <div className="p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700">
                <GameUxGlyph type="win" className="h-3.5 w-3.5" />
                결과 해석
              </div>
              <h2 className="mt-2 text-lg font-black text-slate-900 sm:text-xl">{breakdown.title}</h2>
              <p className="mt-1 max-w-2xl text-xs font-bold leading-relaxed text-slate-500 sm:text-sm">{breakdown.detail}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-left sm:text-right">
              <div className="text-[10px] font-black text-slate-400">결과 기준</div>
              <div className="mt-0.5 text-sm font-black text-slate-900">{breakdown.metric}</div>
            </div>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-4">
            {breakdown.items.map((item) => (
              <div key={item.key} className="min-h-[112px] rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" data-smoke="video-game-result-breakdown-item">
                <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500">
                  <GameUxGlyph type={item.icon} className="h-3.5 w-3.5" />
                  {item.label}
                </div>
                <div className="mt-2 line-clamp-2 text-sm font-black leading-snug text-slate-950">{item.value}</div>
                <div className="mt-1 line-clamp-3 text-xs font-bold leading-relaxed text-slate-600">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const VideoGameSessionActionArt = ({ status, isHost, roomCode, playerCount }) => {
  const settled = status === "FINISHED";
  const nodes = [
    { x: 58, y: 94, label: "결과", fill: "#10b981" },
    { x: 138, y: 58, label: "동기화", fill: "#38bdf8" },
    { x: 218, y: 104, label: "허브", fill: "#f59e0b" },
    { x: 286, y: 68, label: "퇴장", fill: "#f43f5e" },
  ];
  return (
    <svg
      viewBox="0 0 340 180"
      role="img"
      aria-label="비디오게임 세션 정리 흐름"
      className="h-full min-h-[170px] w-full"
      data-smoke="video-game-session-action-art"
    >
      <rect x="12" y="12" width="316" height="156" rx="24" fill="#0f172a" />
      <path d="M48 122C84 54 132 84 160 62c46-36 70 76 116 30" fill="none" stroke="#94a3b8" strokeWidth="7" strokeLinecap="round" opacity=".18" />
      <path d="M48 122C84 54 132 84 160 62c46-36 70 76 116 30" fill="none" stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="8 9" opacity=".78" />
      <rect x="34" y="30" width="102" height="52" rx="16" fill="#ffffff" opacity=".96" />
      <rect x="48" y="44" width="72" height="10" rx="5" fill="#cbd5e1" />
      <rect x="48" y="62" width="46" height="8" rx="4" fill="#bae6fd" />
      <rect x="218" y="114" width="80" height="38" rx="14" fill="#ffffff" opacity=".94" />
      <text x="258" y="137" textAnchor="middle" fontSize="12" fontWeight="900" fill="#0f172a">{roomCode || "방 코드"}</text>
      {nodes.map((node, index) => (
        <g key={node.label} transform={`translate(${node.x} ${node.y})`} data-smoke="video-game-session-action-node">
          <circle r={index === 0 && settled ? 22 : 18} fill={node.fill} stroke="#ffffff" strokeWidth="4" opacity={index === 0 || settled ? 1 : .72} />
          <text y="4" textAnchor="middle" fontSize="9" fontWeight="900" fill="#ffffff">{node.label}</text>
        </g>
      ))}
      <text x="170" y="158" textAnchor="middle" fontSize="10" fontWeight="900" fill="#e2e8f0">
        {isHost ? "방장 세션" : "참가 세션"} · {playerCount}
      </text>
    </svg>
  );
};

const VideoGameSessionActionPanel = ({
  status,
  isHost,
  busy,
  selectedRoom,
  players,
  profile,
  roomCode,
  transportLabel,
  breakdown,
  onRefresh,
  onLeave,
}) => {
  if (status !== "FINISHED") return null;
  const playerCount = `${players.length}/${selectedRoom?.maxPlayers || profile.maxPlayers}명`;
  const winnerName = breakdown?.winnerName || "결과";
  const items = [
    {
      key: "read",
      icon: "win",
      label: "결과 확인",
      value: winnerName,
      detail: "승리 근거와 순위 타일을 먼저 읽고 다음 행동을 고릅니다.",
    },
    {
      key: "sync",
      icon: "signal",
      label: "상태 동기화",
      value: "최신 방 상태",
      detail: `${transportLabel} 기준으로 방 상태를 다시 확인할 수 있습니다.`,
    },
    {
      key: "hub",
      icon: "stage",
      label: "다음 게임 선택",
      value: "게임 허브",
      detail: "같은 Good_ETC 묶음이나 보드게임 목록으로 돌아갑니다.",
    },
    {
      key: "leave",
      icon: "player",
      label: "세션 정리",
      value: "방 나가기",
      detail: "현재 방 연결을 정리하고 로비 목록으로 돌아갑니다.",
    },
  ];

  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg"
      data-smoke="video-game-session-action-panel"
      data-session-status={status}
    >
      <div className="grid gap-0 lg:grid-cols-[minmax(250px,320px)_1fr]">
        <div className="bg-slate-950 p-3 sm:p-4">
          <VideoGameSessionActionArt status={status} isHost={isHost} roomCode={roomCode} playerCount={playerCount} />
        </div>
        <div className="p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">
                <GameUxGlyph type="stage" className="h-3.5 w-3.5" />
                세션 정리
              </div>
              <h2 className="mt-2 text-lg font-black text-slate-900 sm:text-xl">결과 이후 다음 행동</h2>
              <p className="mt-1 max-w-2xl text-xs font-bold leading-relaxed text-slate-500 sm:text-sm">
                결과를 읽은 뒤 방 상태를 갱신하거나, 게임 허브로 돌아가거나, 현재 방 연결을 정리합니다.
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-left sm:text-right">
              <div className="text-[10px] font-black text-slate-400">현재 세션</div>
              <div className="mt-0.5 text-sm font-black text-slate-900">{playerCount}</div>
            </div>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-4">
            {items.map((item) => (
              <div key={item.key} className="min-h-[112px] rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" data-smoke="video-game-session-action-item">
                <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500">
                  <GameUxGlyph type={item.icon} className="h-3.5 w-3.5" />
                  {item.label}
                </div>
                <div className="mt-2 line-clamp-2 text-sm font-black leading-snug text-slate-950">{item.value}</div>
                <div className="mt-1 line-clamp-3 text-xs font-bold leading-relaxed text-slate-600">{item.detail}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              disabled={busy}
              className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-black text-white disabled:opacity-40"
              onClick={onRefresh}
              data-smoke="video-game-session-action-refresh"
            >
              상태 새로고침
            </button>
            <Link
              to="/app/games"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-100 px-4 text-sm font-black text-slate-700 transition hover:bg-slate-900 hover:text-white"
              data-smoke="video-game-session-action-hub"
            >
              게임 허브
            </Link>
            <button
              type="button"
              disabled={busy}
              className="min-h-11 rounded-xl bg-rose-50 px-4 text-sm font-black text-rose-600 disabled:opacity-40"
              onClick={onLeave}
              data-smoke="video-game-session-action-leave"
            >
              방 나가기
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

const VideoGameExperiencePanel = ({
  videoGameCode,
  profile,
  status,
  transportLabel,
  players,
  selectedRoom,
  readyGuestCount,
  guestPlayers,
  pressedControlLabel,
  frameStatusText,
}) => {
  const brief = videoGamePlayBriefs[videoGameCode] || {};
  const playerSummary = `${players.length}/${selectedRoom?.maxPlayers || profile.maxPlayers}명`;
  const readySummary = guestPlayers.length ? `게스트 준비 ${readyGuestCount}/${guestPlayers.length}` : "혼자 시작 가능";
  const inputSummary = pressedControlLabel ? `입력 중 · ${pressedControlLabel}` : "입력 대기";
  const tiles = [
    {
      key: "objective",
      icon: "stage",
      label: "플레이 목표",
      value: brief.rhythm || profile.title,
      detail: brief.objective || frameStatusText,
    },
    {
      key: "sync",
      icon: "state",
      label: "동기화",
      value: statusLabel[status] || status || "대기",
      detail: `${transportLabel} · ${frameStatusText}`,
    },
    {
      key: "players",
      icon: "player",
      label: "참여 상태",
      value: playerSummary,
      detail: readySummary,
    },
    {
      key: "input",
      icon: "input",
      label: "조작 피드백",
      value: inputSummary,
      detail: brief.input || "모바일 버튼 입력은 Good_ETC 게임 화면으로 전달됩니다.",
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-950 p-3 text-white shadow-inner" data-smoke="video-game-experience-panel">
      <div className="grid gap-2 md:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.key} className="min-h-[96px] rounded-xl border border-white/10 bg-white/10 p-3" data-smoke="video-game-flow-tile">
            <div className="flex items-center gap-2 text-[11px] font-black text-cyan-100">
              <GameUxGlyph type={tile.icon} className="h-3.5 w-3.5" />
              {tile.label}
            </div>
            <div className="mt-2 truncate text-sm font-black text-white">{tile.value}</div>
            <div className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-slate-300">{tile.detail}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-start gap-3 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-3 py-2">
        <GameUxGlyph type="decision" className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />
        <div className="min-w-0">
          <div className="text-[11px] font-black text-cyan-100">플레이 전 체크</div>
          <div className="mt-0.5 text-sm font-black leading-relaxed text-white">{brief.objective || frameStatusText}</div>
        </div>
      </div>
    </section>
  );
};

const videoGameStageHudPalettes = {
  arena: { bg: "#0f172a", lane: "#06b6d4", accent: "#22c55e", warm: "#f59e0b" },
  fortress: { bg: "#111827", lane: "#f59e0b", accent: "#38bdf8", warm: "#ef4444" },
  defense: { bg: "#052e16", lane: "#22c55e", accent: "#84cc16", warm: "#f59e0b" },
  kart: { bg: "#1e1b4b", lane: "#fb923c", accent: "#38bdf8", warm: "#f43f5e" },
  bomb: { bg: "#18181b", lane: "#f43f5e", accent: "#f59e0b", warm: "#eab308" },
  snake: { bg: "#052e16", lane: "#84cc16", accent: "#22c55e", warm: "#f59e0b" },
  coin: { bg: "#172554", lane: "#eab308", accent: "#38bdf8", warm: "#fb923c" },
  rpg: { bg: "#2e1065", lane: "#a78bfa", accent: "#22c55e", warm: "#f59e0b" },
};

const VideoGameStageHudMapArt = ({
  videoGameCode,
  status,
  pressedControlLabel,
  transportLabel,
  gameFrameSrc,
}) => {
  const palette = videoGameStageHudPalettes[videoGameCode] || videoGameStageHudPalettes.arena;
  const playing = status === "PLAYING";
  const finished = status === "FINISHED";
  const frameReady = Boolean(gameFrameSrc);
  const inputActive = Boolean(pressedControlLabel);
  const nodes = [
    { key: "mission", label: "목표", value: playing ? "진행" : "준비", x: 50, y: 108, fill: palette.accent, active: true },
    { key: "danger", label: "위험", value: playing ? "판단" : "대기", x: 142, y: 64, fill: palette.warm, active: playing },
    { key: "input", label: "입력", value: inputActive ? "전달" : frameReady ? "대기" : "잠김", x: 236, y: 108, fill: palette.lane, active: inputActive || frameReady },
    { key: "reward", label: finished ? "결과" : "보상", value: finished ? "확인" : transportLabel || "동기", x: 330, y: 64, fill: "#f43f5e", active: playing || finished },
  ];

  return (
    <svg
      viewBox="0 0 380 176"
      role="img"
      aria-label="비디오게임 스테이지 HUD 지도"
      className="h-full min-h-[176px] w-full"
      data-smoke="video-game-stage-hud-art"
      data-hud-game={videoGameCode}
      data-hud-status={status || ""}
    >
      <rect width="380" height="176" rx="24" fill={palette.bg} />
      <rect x="18" y="22" width="344" height="126" rx="20" fill="#f8fafc" opacity=".95" />
      <path d="M50 108 C86 42 118 38 142 64 S204 132 236 108 S294 42 330 64" fill="none" stroke="#e2e8f0" strokeWidth="16" strokeLinecap="round" />
      <path
        d="M50 108 C86 42 118 38 142 64 S204 132 236 108 S294 42 330 64"
        fill="none"
        stroke={playing || finished ? palette.lane : "#94a3b8"}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={frameReady || finished ? "0" : "10 9"}
      />
      <text x="30" y="45" fontSize="10" fontWeight="900" fill="#0f172a">HUD 지도</text>
      <text x="350" y="45" textAnchor="end" fontSize="10" fontWeight="900" fill="#0f172a">{playing ? "플레이 중" : finished ? "결과 확인" : "시작 대기"}</text>
      {nodes.map((node, index) => (
        <g key={node.key} data-smoke="video-game-stage-hud-node" data-hud-key={node.key}>
          <circle cx={node.x} cy={node.y} r={node.active ? 23 : 19} fill={node.active ? node.fill : "#cbd5e1"} stroke="#ffffff" strokeWidth="5" />
          <text x={node.x} y={node.y - 1} textAnchor="middle" fontSize="10" fontWeight="900" fill={node.active ? "#ffffff" : "#334155"}>{node.label}</text>
          <text x={node.x} y={node.y + 13} textAnchor="middle" fontSize="8" fontWeight="900" fill={node.active ? "#ffffff" : "#334155"}>{index + 1}</text>
          <text x={node.x} y={node.y + (index % 2 === 0 ? 38 : -31)} textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#0f172a">{String(node.value).slice(0, 8)}</text>
        </g>
      ))}
      <rect x="70" y="148" width="240" height="13" rx="7" fill="#ffffff" opacity=".9" />
      <text x="190" y="158" textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#0f172a">목표 → 위험 → 입력 → 보상</text>
    </svg>
  );
};

const VideoGameStageHud = ({
  videoGameCode,
  profile,
  status,
  transportLabel,
  pressedControlLabel,
  frameStatusText,
  gameFrameSrc,
}) => {
  const playBrief = videoGamePlayBriefs[videoGameCode] || {};
  const hudBrief = videoGameStageHudBriefs[videoGameCode] || {};
  const liveText = status === "PLAYING"
    ? (pressedControlLabel ? `${pressedControlLabel} 입력 전달 중` : "게임 화면 실행 중")
    : (gameFrameSrc ? "프레임 준비 중" : "시작 대기");
  const tiles = [
    {
      key: "mission",
      icon: "stage",
      label: "현재 미션",
      value: playBrief.rhythm || profile.title,
      detail: hudBrief.mission || playBrief.objective || frameStatusText,
    },
    {
      key: "danger",
      icon: "decision",
      label: "위험 신호",
      value: status === "PLAYING" ? "판단 유지" : "준비 확인",
      detail: hudBrief.danger || "게임이 시작되면 화면 상태와 입력 피드백을 함께 확인하세요.",
    },
    {
      key: "input",
      icon: "input",
      label: "입력 상태",
      value: liveText,
      detail: pressedControlLabel ? "모바일 조작이 iframe 게임 화면으로 전달되고 있습니다." : (playBrief.input || frameStatusText),
    },
    {
      key: "reward",
      icon: "recent",
      label: "보상 기준",
      value: transportLabel,
      detail: hudBrief.reward || "좋은 입력 리듬과 안정적인 생존이 결과를 만듭니다.",
    },
  ];

  return (
    <section
      className="border-b border-slate-100 bg-slate-50/80 px-4 py-3"
      data-smoke="video-game-stage-brief"
      data-hud-game={videoGameCode}
      data-stage-status={status || ""}
      data-frame-ready={gameFrameSrc ? "true" : "false"}
      data-active-input={pressedControlLabel || ""}
    >
      <div className="grid gap-3 xl:grid-cols-[minmax(260px,380px)_minmax(0,1fr)] xl:items-stretch">
        <div className="overflow-hidden rounded-2xl bg-slate-950 p-2 shadow-sm">
          <VideoGameStageHudMapArt
            videoGameCode={videoGameCode}
            status={status}
            pressedControlLabel={pressedControlLabel}
            transportLabel={transportLabel}
            gameFrameSrc={gameFrameSrc}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {tiles.map((tile) => (
            <div key={tile.key} className="min-h-[112px] rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm" data-smoke="video-game-hud-tile" data-hud-key={tile.key}>
              <div className="flex items-center gap-2 text-[11px] font-black text-slate-500">
                <GameUxGlyph type={tile.icon} className="h-3.5 w-3.5" />
                {tile.label}
              </div>
              <div className="mt-2 line-clamp-2 text-sm font-black leading-snug text-slate-950">{tile.value}</div>
              <div className="mt-1 line-clamp-3 text-xs font-bold leading-relaxed text-slate-600">{tile.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const videoGameStageGateToneClasses = {
  ready: {
    shell: "border-cyan-100 bg-cyan-50 text-cyan-950",
    badge: "bg-cyan-600 text-white",
    detail: "text-cyan-800",
  },
  live: {
    shell: "border-emerald-100 bg-emerald-50 text-emerald-950",
    badge: "bg-emerald-600 text-white",
    detail: "text-emerald-800",
  },
  wait: {
    shell: "border-amber-100 bg-amber-50 text-amber-950",
    badge: "bg-amber-500 text-slate-950",
    detail: "text-amber-800",
  },
  done: {
    shell: "border-slate-200 bg-slate-50 text-slate-950",
    badge: "bg-slate-900 text-white",
    detail: "text-slate-600",
  },
};

const buildVideoGameStageGateItems = ({
  videoGameCode,
  profile,
  status,
  transportLabel,
  pressedControlLabel,
  frameStatusText,
  gameFrameSrc,
  players,
  selectedRoom,
}) => {
  const playBrief = videoGamePlayBriefs[videoGameCode] || {};
  const hudBrief = videoGameStageHudBriefs[videoGameCode] || {};
  const maxPlayers = Math.max(1, Number(selectedRoom?.maxPlayers || profile.maxPlayers || players.length || 1));
  const playerSummary = `${players.length}/${maxPlayers}명`;
  const bridgeReady = status === "PLAYING" && Boolean(gameFrameSrc);
  const sessionFinished = status === "FINISHED";
  const stageValue = bridgeReady
    ? "게임 화면 연결"
    : sessionFinished
      ? "결과 화면 유지"
      : status === "PLAYING"
        ? "프레임 연결 대기"
        : "시작 전 점검";
  const inputValue = pressedControlLabel
    ? `${pressedControlLabel} 입력 중`
    : bridgeReady
      ? "입력 대기"
      : "시작 후 활성";

  return [
    {
      key: "stage",
      icon: "stage",
      label: "화면 상태",
      value: stageValue,
      detail: bridgeReady
        ? "Good_ETC iframe이 열려 있어 현재 플레이 화면과 부모 HUD를 함께 확인할 수 있습니다."
        : sessionFinished
          ? "세션은 끝났지만 결과와 다음 행동이 같은 화면에 남아 다시 확인할 수 있습니다."
          : frameStatusText,
      tone: bridgeReady ? "live" : sessionFinished ? "done" : "wait",
    },
    {
      key: "input",
      icon: "input",
      label: "입력 초점",
      value: inputValue,
      detail: pressedControlLabel
        ? "누른 조작이 부모 화면의 입력 브리지에서 Good_ETC 화면으로 전달되는 중입니다."
        : playBrief.input || "게임이 진행 중일 때 모바일 조작과 키보드 입력 상태가 이곳에 반영됩니다.",
      tone: pressedControlLabel || bridgeReady ? "live" : "ready",
    },
    {
      key: "sync",
      icon: "signal",
      label: "동기화",
      value: transportLabel || "대기",
      detail: `${playerSummary} 참가 상태와 방 전송 상태를 기준으로 현재 화면의 신뢰도를 보여줍니다.`,
      tone: status === "PLAYING" ? "live" : sessionFinished ? "done" : "ready",
    },
    {
      key: "mission",
      icon: "decision",
      label: "먼저 볼 것",
      value: hudBrief.mission ? "미션 신호" : (playBrief.rhythm || profile.title),
      detail: hudBrief.mission || playBrief.objective || "화면이 열리면 목표, 위험 신호, 보상 기준 순서로 확인하세요.",
      tone: sessionFinished ? "done" : "ready",
    },
  ];
};

const VideoGameStageGateArt = ({ items, status, gameFrameSrc, title }) => {
  const activeIndex = status === "FINISHED" ? 3 : status === "PLAYING" && gameFrameSrc ? 2 : status === "PLAYING" ? 1 : 0;
  return (
    <svg
      viewBox="0 0 420 220"
      role="img"
      aria-label={`${title} 스테이지 게이트`}
      className="h-full min-h-[220px] w-full rounded-2xl bg-slate-950"
      data-smoke="video-game-stage-gate-art"
    >
      <rect x="0" y="0" width="420" height="220" rx="24" fill="#020617" />
      <rect x="18" y="18" width="384" height="184" rx="20" fill="#0f172a" stroke="#1e293b" strokeWidth="2" />
      <path d="M54 154 C96 86, 152 82, 198 132 S306 184, 368 92" fill="none" stroke="#38bdf8" strokeWidth="10" strokeLinecap="round" opacity="0.18" />
      <path d="M54 154 C96 86, 152 82, 198 132 S306 184, 368 92" fill="none" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
      <text x="34" y="48" fill="#e2e8f0" fontSize="18" fontWeight="900">스테이지 게이트</text>
      <text x="34" y="70" fill="#94a3b8" fontSize="11" fontWeight="800">화면, 입력, 동기화, 목표를 한 번에 점검</text>
      {items.map((item, index) => {
        const x = 70 + index * 92;
        const y = index % 2 === 0 ? 138 : 102;
        const active = index <= activeIndex;
        return (
          <g key={item.key} transform={`translate(${x} ${y})`} data-smoke="video-game-stage-gate-node">
            <circle cx="0" cy="0" r="24" fill={active ? "#22c55e" : "#334155"} stroke={active ? "#bbf7d0" : "#64748b"} strokeWidth="3" />
            <circle cx="0" cy="0" r="12" fill={active ? "#052e16" : "#0f172a"} />
            <text x="0" y="5" textAnchor="middle" fill="#f8fafc" fontSize="13" fontWeight="900">{index + 1}</text>
            <text x="0" y="40" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="900">{item.label}</text>
          </g>
        );
      })}
      <rect x="270" y="30" width="104" height="28" rx="14" fill={status === "PLAYING" && gameFrameSrc ? "#16a34a" : status === "FINISHED" ? "#475569" : "#f59e0b"} />
      <text x="322" y="49" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="900">
        {status === "PLAYING" && gameFrameSrc ? "진행" : status === "FINISHED" ? "결과" : "점검"}
      </text>
    </svg>
  );
};

const VideoGameStageGatePanel = ({
  videoGameCode,
  profile,
  status,
  transportLabel,
  pressedControlLabel,
  frameStatusText,
  gameFrameSrc,
  players,
  selectedRoom,
}) => {
  const items = buildVideoGameStageGateItems({
    videoGameCode,
    profile,
    status,
    transportLabel,
    pressedControlLabel,
    frameStatusText,
    gameFrameSrc,
    players,
    selectedRoom,
  });
  const statusText = statusLabel[status] || status || "대기";
  const frameText = gameFrameSrc ? "iframe 연결됨" : status === "FINISHED" ? "결과 검토" : "프레임 대기";

  return (
    <section
      className="border-b border-slate-100 bg-white px-4 py-4"
      data-smoke="video-game-stage-gate-panel"
      data-stage-status={status || "WAITING"}
      data-frame-ready={gameFrameSrc ? "true" : "false"}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(260px,360px)_minmax(0,1fr)] lg:items-stretch">
        <VideoGameStageGateArt items={items} status={status} gameFrameSrc={gameFrameSrc} title={profile.title} />
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                <GameUxGlyph type="stage" className="h-4 w-4 text-cyan-600" />
                플레이 화면 게이트
              </div>
              <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
                실제 게임 프레임에 집중하기 전에 화면 상태와 입력 초점, 동기화 신호를 먼저 정렬합니다.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black text-white">{statusText}</span>
              <span className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-600 ring-1 ring-slate-200">{frameText}</span>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.map((item) => {
              const tone = videoGameStageGateToneClasses[item.tone] || videoGameStageGateToneClasses.done;
              return (
                <div key={item.key} className={`min-h-[116px] rounded-xl border px-3 py-2 ${tone.shell}`} data-smoke="video-game-stage-gate-item">
                  <div className="flex items-center gap-2 text-[11px] font-black">
                    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${tone.badge}`}>
                      <GameUxGlyph type={item.icon} className="h-4 w-4" />
                    </span>
                    {item.label}
                  </div>
                  <div className="mt-2 truncate text-sm font-black">{item.value}</div>
                  <div className={`mt-1 line-clamp-3 text-xs font-bold leading-relaxed ${tone.detail}`}>{item.detail}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

const VideoGameFrameStandbyArt = ({
  status,
  canStart = false,
  isHost = false,
  roomCode = "",
  playerCount = 0,
  maxPlayers = 1,
  transportLabel = "",
}) => {
  const finished = status === "FINISHED";
  const playable = status === "PLAYING";
  const stageLabel = finished ? "결과" : playable ? "연결" : canStart ? "시작" : "대기";
  const nodes = [
    { key: "room", label: roomCode || "방", x: 64, active: Boolean(roomCode), fill: "#38bdf8" },
    { key: "ready", label: `${playerCount}/${maxPlayers}`, x: 148, active: canStart || playable || finished, fill: "#22c55e" },
    { key: "frame", label: stageLabel, x: 232, active: playable, fill: "#f59e0b" },
    { key: "next", label: finished ? "다음" : isHost && canStart ? "시작" : "준비", x: 316, active: finished || canStart, fill: "#a78bfa" },
  ];

  return (
    <svg
      viewBox="0 0 380 180"
      role="img"
      aria-label="Good ETC 게임 화면이 아직 표시되지 않는 이유와 다음 행동을 요약한 무대 안내"
      className="h-full min-h-[180px] w-full"
      data-smoke="video-game-frame-standby-art"
    >
      <rect x="0" y="0" width="380" height="180" rx="24" fill="#020617" />
      <rect x="22" y="24" width="336" height="116" rx="18" fill="#0f172a" stroke="#1e293b" strokeWidth="3" />
      <rect x="46" y="48" width="188" height="80" rx="14" fill="#111827" stroke="#38bdf8" strokeWidth="3" />
      <path d="M64 102h152M64 76h76M64 92h110" fill="none" stroke="#334155" strokeWidth="5" strokeLinecap="round" />
      <circle cx="287" cy="88" r="37" fill="#172554" stroke="#38bdf8" strokeWidth="4" />
      <path d="m277 74 31 14-31 14Z" fill="#e0f2fe" />
      <path d="M64 152h252" fill="none" stroke="#334155" strokeWidth="5" strokeLinecap="round" />
      {nodes.map((node, index) => (
        <g key={node.key} data-smoke="video-game-frame-standby-node" data-standby-key={node.key}>
          {index > 0 && <path d={`M${nodes[index - 1].x + 18} 152H${node.x - 18}`} stroke={node.active ? node.fill : "#475569"} strokeWidth="4" strokeLinecap="round" />}
          <circle cx={node.x} cy="152" r="18" fill={node.active ? node.fill : "#1e293b"} stroke={node.fill} strokeWidth="3" />
          <circle cx={node.x} cy="152" r="6" fill={node.active ? "#ffffff" : node.fill} />
          <text x={node.x} y="173" textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="900">{node.label}</text>
        </g>
      ))}
      <rect x="244" y="34" width="82" height="24" rx="12" fill={finished ? "#475569" : canStart ? "#16a34a" : "#f59e0b"} />
      <text x="285" y="51" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="900">{stageLabel}</text>
      <text x="34" y="36" fill="#e2e8f0" fontSize="13" fontWeight="900">화면 게이트</text>
      <text x="34" y="156" fill="#94a3b8" fontSize="10" fontWeight="800">{String(transportLabel || "대기").slice(0, 14)}</text>
    </svg>
  );
};

const VideoGameFrameStandbyPanel = ({
  videoGameCode,
  profile,
  status,
  canStart,
  isHost,
  players,
  selectedRoom,
  roomCode,
  transportLabel,
  frameStatusText,
  videoResultDetail,
}) => {
  const maxPlayers = Math.max(1, Number(selectedRoom?.maxPlayers || profile.maxPlayers || players.length || 1));
  const playerCount = players.length;
  const finished = status === "FINISHED";
  const playing = status === "PLAYING";
  const statusText = statusLabel[status] || status || "대기";
  const reasonValue = finished ? "결과 검토" : playing ? "iframe 연결 대기" : "시작 전";
  const nextValue = finished
    ? "결과 확인 후 다시 하기 또는 나가기"
    : canStart && isHost
      ? "시작 버튼으로 iframe 열기"
      : canStart
        ? "방장 시작 대기"
        : "참가자 준비 확인";
  const headline = finished
    ? "게임 화면 대신 결과와 다음 행동을 확인하세요."
    : playing
      ? "게임은 진행 중이지만 화면 연결이 아직 열리지 않았습니다."
      : canStart
        ? "조건이 충족됐습니다. 시작하면 Good_ETC 화면이 열립니다."
        : "시작 조건이 채워지면 Good_ETC 화면이 이 자리에 열립니다.";
  const items = [
    {
      key: "status",
      icon: finished ? "win" : "state",
      label: "화면 상태",
      value: statusText,
      detail: frameStatusText,
      tone: finished ? "done" : playing ? "active" : "neutral",
    },
    {
      key: "reason",
      icon: "stage",
      label: "왜 안 보이나요",
      value: reasonValue,
      detail: finished ? videoResultDetail : "iframe URL은 시작된 플레이 화면이 있을 때만 렌더링됩니다.",
      tone: finished ? "done" : "waiting",
    },
    {
      key: "next",
      icon: "decision",
      label: "다음 행동",
      value: nextValue,
      detail: canStart ? "준비 조건은 충족됐고 방장 시작 또는 세션 정리 선택만 남았습니다." : "인원, 준비 상태, 방장 권한을 확인하면 화면 대기로 이어집니다.",
      tone: canStart || finished ? "active" : "neutral",
    },
    {
      key: "sync",
      icon: "signal",
      label: "동기화",
      value: transportLabel || "대기",
      detail: `${playerCount}/${maxPlayers}명 · 방 코드 ${roomCode || "-"} · 화면 연결 전에도 방 상태는 계속 확인됩니다.`,
      tone: playing ? "active" : "neutral",
    },
  ];
  const toneClass = {
    active: "border-emerald-300/40 bg-emerald-400/10 text-emerald-50",
    done: "border-amber-300/40 bg-amber-400/10 text-amber-50",
    waiting: "border-cyan-300/40 bg-cyan-400/10 text-cyan-50",
    neutral: "border-white/10 bg-white/10 text-slate-100",
  };

  return (
    <section
      className="bg-slate-950 p-4 text-white"
      data-smoke="video-game-frame-standby-panel"
      data-stage-status={status || "WAITING"}
      data-frame-reason={reasonValue}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(260px,380px)_minmax(0,1fr)] lg:items-stretch">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
          <VideoGameFrameStandbyArt
            status={status}
            canStart={canStart}
            isHost={isHost}
            roomCode={roomCode}
            playerCount={playerCount}
            maxPlayers={maxPlayers}
            transportLabel={transportLabel}
          />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-black text-cyan-100">
                <GameUxGlyph type="stage" className="h-3.5 w-3.5" />
                {profile.title} · 화면 대기
              </div>
              <h3 className="mt-3 text-xl font-black text-white">왜 화면이 안 보이나요</h3>
              <p className="mt-2 text-sm font-bold leading-relaxed text-slate-300">{headline}</p>
            </div>
            <span className="shrink-0 rounded-full bg-cyan-400 px-3 py-1 text-[11px] font-black text-slate-950">
              {videoGameCode}
            </span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <div key={item.key} className={`min-h-[108px] rounded-xl border px-3 py-2 ${toneClass[item.tone] || toneClass.neutral}`} data-smoke="video-game-frame-standby-item" data-standby-key={item.key}>
                <div className="flex items-center gap-2 text-[11px] font-black">
                  <GameUxGlyph type={item.icon} className="h-3.5 w-3.5" />
                  {item.label}
                </div>
                <div className="mt-1 truncate text-sm font-black">{item.value}</div>
                <div className="mt-1 line-clamp-3 text-xs font-bold leading-relaxed opacity-80">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const controlText = (control) => (typeof control === "string" ? control : control?.label || control?.control || "");
const compactControlList = (controls) => controls.map(controlText).filter(Boolean).join(" · ");

const videoRoomNumber = (...values) => {
  const found = values.find((value) => value !== undefined && value !== null && value !== "");
  const parsed = Number(found);
  return Number.isFinite(parsed) ? parsed : 0;
};

const videoRoomTitleOf = (room) => String(room?.title || getVideoGameRoomCode(room) || "대기방");

const videoRoomIdentityOf = (room) => String(getVideoGameRoomId(room) || getVideoGameRoomCode(room) || videoRoomTitleOf(room));

const buildVideoGameMatchmakingCandidates = ({ rooms = [], myRooms = [], profile = {} }) => {
  const merged = new Map();
  const addRoom = (room, mode) => {
    const key = videoRoomIdentityOf(room);
    if (!key) return;
    const current = merged.get(key);
    merged.set(key, {
      room: current?.room || room,
      mine: Boolean(current?.mine || mode === "mine"),
    });
  };
  (Array.isArray(myRooms) ? myRooms : []).forEach((room) => addRoom(room, "mine"));
  (Array.isArray(rooms) ? rooms : []).forEach((room) => addRoom(room, "public"));

  return Array.from(merged.values()).map(({ room, mine }) => {
    const players = roomPlayers(room);
    const status = getVideoGameRoomStatus(room) || "WAITING";
    const maxPlayers = Math.max(1, videoRoomNumber(room?.maxPlayers, room?.max_players, profile?.maxPlayers, players.length, 1));
    const minPlayers = Math.max(1, Math.min(maxPlayers, videoRoomNumber(room?.minPlayers, room?.min_players, maxPlayers > 1 ? 2 : 1)));
    const memberCount = Math.max(players.length, videoRoomNumber(room?.memberCount, room?.member_count, players.length));
    const hostMemberId = videoRoomNumber(room?.hostMemberId, room?.host_member_id, 0);
    const guests = players.filter((player) => getVideoGameMemberId(player) !== hostMemberId);
    const readyGuests = guests.filter(isVideoGameReadyPlayer).length;
    const readyRatio = guests.length ? readyGuests / guests.length : 1;
    const openSeats = Math.max(0, maxPlayers - memberCount);
    const waiting = status === "WAITING";
    const playing = status === "PLAYING";
    const finished = status === "FINISHED";
    const joinable = waiting && openSeats > 0 && !mine;
    const startFloor = memberCount >= minPlayers;
    const readinessText = guests.length ? `게스트 준비 ${readyGuests}/${guests.length}` : "혼자 시작 가능";
    const statusText = playing ? "진행 중" : finished ? "종료됨" : waiting ? "대기 중" : "상태 확인";
    const actionLabel = mine ? (playing ? "재입장" : "내 방 열기") : joinable ? "입장" : "상태 보기";
    const actionDetail = mine
      ? "이미 참여 중인 방이라 현재 상태를 바로 열 수 있습니다."
      : joinable
        ? "빈 좌석이 있어 바로 합류할 수 있습니다."
        : playing
          ? "진행 중인 방은 상태 확인으로 접근합니다."
          : "좌석과 상태를 먼저 확인합니다.";
    const score = (
      (mine ? 42 : 0) +
      (joinable ? 34 : 0) +
      (playing ? 22 : 0) +
      (startFloor ? 16 : 0) +
      Math.round(readyRatio * 18) +
      Math.min(memberCount, maxPlayers) * 2 -
      (finished ? 28 : 0)
    );

    return {
      key: videoRoomIdentityOf(room),
      room,
      mine,
      title: videoRoomTitleOf(room),
      status,
      statusText,
      memberCount,
      maxPlayers,
      minPlayers,
      openSeats,
      readyGuests,
      guestCount: guests.length,
      readyRatio,
      readinessText,
      joinable,
      playing,
      startFloor,
      score,
      actionLabel,
      actionDetail,
    };
  }).sort((a, b) => b.score - a.score || b.memberCount - a.memberCount || a.title.localeCompare(b.title));
};

const buildVideoGameMatchmakingPlan = ({ rooms = [], myRooms = [], profile = {}, videoGameCode = "", loading = false }) => {
  const candidates = buildVideoGameMatchmakingCandidates({ rooms, myRooms, profile });
  const recommended = candidates[0] || null;
  const playBrief = videoGamePlayBriefs[videoGameCode] || {};
  const totalPublicRooms = Array.isArray(rooms) ? rooms.length : 0;
  const totalMyRooms = Array.isArray(myRooms) ? myRooms.length : 0;
  const firstAction = recommended
    ? recommended.actionLabel
    : loading
      ? "동기화 중"
      : "새 방 만들기";
  const firstDetail = recommended
    ? recommended.actionDetail
    : loading
      ? "방 목록을 불러오는 동안 새 후보를 계산합니다."
      : `${profile?.title || "비디오게임"} 방을 새로 만들면 바로 준비 흐름에 진입합니다.`;
  const items = [
    {
      key: "pick",
      icon: "decision",
      label: "바로 시작 후보",
      value: recommended ? recommended.title : "대기 후보 없음",
      detail: firstDetail,
    },
    {
      key: "seat",
      icon: "player",
      label: "좌석 여유",
      value: recommended ? `${recommended.memberCount}/${recommended.maxPlayers}명` : `${totalPublicRooms}개 공개 방`,
      detail: recommended ? `빈 좌석 ${recommended.openSeats}개 · 최소 ${recommended.minPlayers}명` : `${totalMyRooms}개 내 참여 방을 같이 확인합니다.`,
    },
    {
      key: "ready",
      icon: "state",
      label: "준비 신호",
      value: recommended ? recommended.readinessText : "준비 대기",
      detail: recommended ? `${recommended.statusText} · ${firstAction}` : "입장 가능한 방이 생기면 이 영역에 우선 후보가 표시됩니다.",
    },
    {
      key: "input",
      icon: "input",
      label: "입력 리듬",
      value: playBrief.rhythm || profile?.title || "Good_ETC",
      detail: playBrief.input || "입장 후 Good_ETC 입력 브리지로 조작이 전달됩니다.",
    },
  ];

  return {
    candidates,
    recommended,
    items,
    choices: candidates.slice(0, 3),
  };
};

const VideoGameMatchmakingArt = ({ items = [], recommended, loading, className = "" }) => {
  const lanes = items.slice(0, 4);
  const titleText = recommended ? recommended.title.slice(0, 12) : loading ? "동기화" : "새 방";
  const nodeTone = recommended?.joinable ? "#34d399" : recommended?.mine ? "#38bdf8" : "#facc15";

  return (
    <svg
      viewBox="0 0 420 168"
      role="img"
      aria-label="비디오게임 매치메이킹 브리프"
      className={className}
      data-smoke="video-game-matchmaking-art"
    >
      <rect width="420" height="168" rx="24" fill="#020617" />
      <rect x="18" y="18" width="126" height="112" rx="18" fill="#0f172a" stroke="#334155" />
      <rect x="34" y="34" width="94" height="20" rx="10" fill="#164e63" />
      <text x="81" y="48" textAnchor="middle" fill="#cffafe" fontSize="11" fontWeight="900">추천 방</text>
      <text x="81" y="78" textAnchor="middle" fill="#f8fafc" fontSize="15" fontWeight="900">{titleText}</text>
      <text x="81" y="100" textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="800">
        {recommended ? `${recommended.memberCount}/${recommended.maxPlayers}명` : "대기"}
      </text>
      <circle cx="81" cy="128" r="16" fill={nodeTone} />
      <path d="M75 128 l5 5 l10 -12" fill="none" stroke="#020617" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

      <path d="M164 84 H384" fill="none" stroke="#334155" strokeWidth="10" strokeLinecap="round" />
      <path d="M164 84 H384" fill="none" stroke={nodeTone} strokeWidth="4" strokeLinecap="round" />
      {lanes.map((item, index) => {
        const x = 168 + index * 72;
        const active = Boolean(recommended) || index === 0;
        return (
          <g key={item.key} data-smoke="video-game-matchmaking-node">
            <circle cx={x} cy="84" r="23" fill={active ? "#0f766e" : "#1e293b"} stroke={active ? "#99f6e4" : "#64748b"} strokeWidth="2" />
            <text x={x} y="89" textAnchor="middle" fill={active ? "#ecfeff" : "#cbd5e1"} fontSize="13" fontWeight="900">{index + 1}</text>
            <text x={x} y="125" textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="900">{item.label}</text>
          </g>
        );
      })}
      <rect x="168" y="22" width="182" height="28" rx="14" fill="#111827" stroke="#334155" />
      <text x="259" y="40" textAnchor="middle" fill="#bae6fd" fontSize="11" fontWeight="900">
        {recommended?.joinable ? "입장 가능" : recommended?.mine ? "내 방 우선" : "상태 판단"}
      </text>
      <circle cx="372" cy="36" r="10" fill={loading ? "#facc15" : "#22c55e"} />
      <path d="M368 36 h8" stroke="#020617" strokeWidth="2" strokeLinecap="round" />
      {!loading && <path d="M372 32 v8" stroke="#020617" strokeWidth="2" strokeLinecap="round" />}
    </svg>
  );
};

const VideoGameMatchmakingEmptyArt = ({ title = "Good_ETC", loading = false, className = "" }) => {
  const safeTitle = String(title || "Good_ETC").slice(0, 12);
  const nodes = [
    { key: "create", x: 92, y: 104, label: "생성", fill: "#22d3ee" },
    { key: "code", x: 190, y: 62, label: "코드", fill: "#a78bfa" },
    { key: "scan", x: 288, y: 104, label: "탐색", fill: "#34d399" },
  ];

  return (
    <svg
      viewBox="0 0 380 146"
      role="img"
      aria-label={`${title} 대기방 후보가 없을 때 다음 행동을 안내합니다.`}
      className={className}
      data-smoke="video-game-matchmaking-empty-art"
    >
      <rect width="380" height="146" rx="22" fill="#020617" />
      <rect x="20" y="20" width="340" height="106" rx="18" fill="#0f172a" stroke="#334155" />
      <path d="M96 104 C132 46, 234 46, 284 104" fill="none" stroke="#334155" strokeWidth="10" strokeLinecap="round" />
      <path d="M96 104 C132 46, 234 46, 284 104" fill="none" stroke={loading ? "#facc15" : "#22d3ee"} strokeWidth="4" strokeLinecap="round" />
      <rect x="123" y="18" width="134" height="28" rx="14" fill="#111827" stroke="#334155" />
      <text x="190" y="37" textAnchor="middle" fill="#cffafe" fontSize="11" fontWeight="900">{loading ? "후보 확인 중" : "추천 없음"}</text>
      <rect x="132" y="92" width="116" height="24" rx="12" fill="#164e63" />
      <text x="190" y="108" textAnchor="middle" fill="#ecfeff" fontSize="12" fontWeight="900">{safeTitle}</text>
      {nodes.map((node) => (
        <g key={node.key} data-smoke="video-game-matchmaking-empty-node" data-empty-key={node.key}>
          <circle cx={node.x} cy={node.y} r="23" fill={node.fill} />
          <circle cx={node.x} cy={node.y} r="11" fill="#020617" opacity="0.74" />
          <text x={node.x} y={node.y + 39} textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="900">{node.label}</text>
        </g>
      ))}
      <circle cx="326" cy="34" r="9" fill={loading ? "#facc15" : "#22c55e"} />
      <path d="M322 34 h8" stroke="#020617" strokeWidth="2" strokeLinecap="round" />
      {!loading && <path d="M326 30 v8" stroke="#020617" strokeWidth="2" strokeLinecap="round" />}
    </svg>
  );
};

const VideoGameMatchmakingEmptyChoice = ({ profile, videoGameCode = "", loading = false }) => {
  const title = profile?.title || "Good_ETC";
  const items = [
    {
      key: "create",
      icon: "decision",
      label: "새 방 만들기",
      value: "직접 호스트",
      detail: `${title} 방을 만들면 플레이어 모집과 입력 브리지 준비를 바로 시작합니다.`,
    },
    {
      key: "code",
      icon: "input",
      label: "초대 코드",
      value: "비공개 합류",
      detail: "친구가 보낸 방 코드는 위 코드 입장 영역에서 기존 합류 흐름 그대로 사용할 수 있습니다.",
    },
    {
      key: "scan",
      icon: "state",
      label: "목록 확인",
      value: loading ? "동기화 중" : "후보 대기",
      detail: loading ? "방 목록이 도착하면 추천 후보가 같은 위치에 표시됩니다." : "공개 방이 생기면 매치메이킹 후보와 방 카드가 함께 갱신됩니다.",
    },
  ];

  return (
    <div
      className="rounded-xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-slate-50 p-3"
      data-smoke="video-game-matchmaking-choice"
      data-empty-game={videoGameCode}
    >
      <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center" data-smoke="video-game-matchmaking-empty-choice">
        <VideoGameMatchmakingEmptyArt title={title} loading={loading} className="h-32 w-full" />
        <div className="min-w-0">
          <div className="text-sm font-black text-slate-950">{loading ? "대기방 후보를 확인하는 중입니다" : "추천할 대기방이 없습니다"}</div>
          <p className="mt-1 text-xs font-bold leading-relaxed text-slate-600">
            공개 후보가 비어 있어도 첫 행동은 멈추지 않습니다. 새 방 생성, 초대 코드 합류, 목록 확인 흐름을 같은 로비에서 이어가세요.
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {items.map((item) => (
              <div key={item.key} className="rounded-lg border border-white/80 bg-white px-3 py-2" data-smoke="video-game-matchmaking-empty-item" data-empty-key={item.key}>
                <div className="flex items-center gap-1.5 text-[10px] font-black text-cyan-700">
                  <GameUxGlyph type={item.icon} className="h-3.5 w-3.5" />
                  {item.label}
                </div>
                <div className="mt-1 text-xs font-black text-slate-950">{item.value}</div>
                <div className="mt-1 text-[10px] font-bold leading-relaxed text-slate-500">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const VideoGameMatchmakingPanel = ({
  rooms,
  myRooms,
  profile,
  videoGameCode,
  loading,
  busy,
  onOpen,
  onJoin,
}) => {
  const plan = buildVideoGameMatchmakingPlan({ rooms, myRooms, profile, videoGameCode, loading });
  const recommendedId = plan.recommended?.key || "";

  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg"
      data-smoke="video-game-matchmaking-panel"
      data-room-count={plan.candidates.length}
      data-recommended-room={recommendedId}
    >
      <div className={`bg-gradient-to-br ${profile.tone} p-3`}>
        <VideoGameMatchmakingArt items={plan.items} recommended={plan.recommended} loading={loading} className="h-40 w-full" />
      </div>
      <div className="space-y-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-base font-black text-slate-900">
              <RadioTower className="h-4 w-4 text-cyan-600" />
              매치메이킹 브리프
            </div>
            <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
              바로 시작 후보, 좌석, 준비 신호, 입력 리듬을 한 번에 비교합니다.
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">
            <Users className="h-3.5 w-3.5" />
            {plan.candidates.length}개 후보
          </span>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {plan.items.map((item) => (
            <div key={item.key} className="min-h-[94px] rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" data-smoke="video-game-matchmaking-item">
              <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500">
                <GameUxGlyph type={item.icon} className="h-3.5 w-3.5 text-cyan-600" />
                {item.label}
              </div>
              <div className="mt-1 line-clamp-2 text-sm font-black leading-snug text-slate-950">{item.value}</div>
              <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-relaxed text-slate-600">{item.detail}</div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {plan.choices.length ? plan.choices.map((choice, index) => {
            const disabled = busy || loading || (!choice.mine && !choice.joinable && !choice.playing);
            const handleClick = () => {
              if (choice.mine || !choice.joinable) {
                onOpen(choice.room);
                return;
              }
              onJoin(choice.room);
            };
            return (
              <div key={choice.key} className="grid gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2 sm:grid-cols-[minmax(0,1fr)_116px] sm:items-center" data-smoke="video-game-matchmaking-choice">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-slate-900 text-[11px] font-black text-white">{index + 1}</span>
                    <div className="truncate text-sm font-black text-slate-900">{choice.title}</div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">{choice.statusText}</span>
                  </div>
                  <div className="mt-1 text-[11px] font-bold leading-relaxed text-slate-500">
                    {choice.memberCount}/{choice.maxPlayers}명 · {choice.readinessText} · {choice.actionDetail}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={handleClick}
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-black text-white transition hover:bg-cyan-700 disabled:opacity-40"
                  data-smoke={choice.mine || !choice.joinable ? "video-game-matchmaking-open" : "video-game-matchmaking-join"}
                >
                  <Play className="h-3.5 w-3.5" />
                  {choice.actionLabel}
                </button>
              </div>
            );
          }) : (
            <VideoGameMatchmakingEmptyChoice profile={profile} videoGameCode={videoGameCode} loading={loading} />
          )}
        </div>
      </div>
    </section>
  );
};

const VideoGameLobbyBriefPanel = ({
  videoGameCode,
  profile,
  rooms,
  myRooms,
  loading,
  createForm,
  directionControls,
  actionControls,
}) => {
  const playBrief = videoGamePlayBriefs[videoGameCode] || {};
  const hudBrief = videoGameStageHudBriefs[videoGameCode] || {};
  const safeRooms = Array.isArray(rooms) ? rooms : [];
  const safeMyRooms = Array.isArray(myRooms) ? myRooms : [];
  const joinableRooms = safeRooms.filter((room) => {
    const memberCount = Number(room?.memberCount || roomPlayers(room).length || 0);
    const maxPlayers = Number(room?.maxPlayers || profile.maxPlayers || 1);
    return getVideoGameRoomStatus(room) === "WAITING" && memberCount < maxPlayers;
  });
  const requestedMaxPlayers = Math.max(1, Math.min(Number(createForm?.maxPlayers || profile.maxPlayers || 1), profile.maxPlayers || 1));
  const titleReady = String(createForm?.title || "").trim() ? "제목 입력됨" : "제목 없이도 생성 가능";
  const directionText = directionControls.length ? compactControlList(directionControls) : "액션 버튼 중심";
  const actionText = compactControlList(actionControls.length ? actionControls : profile.controls) || "게임 화면 내부 조작";
  const roomSignal = loading
    ? "방 목록 확인 중"
    : joinableRooms.length
      ? `${joinableRooms.length}/${safeRooms.length}개 입장 가능`
      : "새 방 만들기 추천";
  const myRoomSignal = safeMyRooms.length ? `${safeMyRooms.length}개 참여 중` : "참여 중인 방 없음";
  const tiles = [
    {
      key: "experience",
      icon: "stage",
      label: "플레이 감각",
      value: playBrief.rhythm || profile.title,
      detail: playBrief.objective || hudBrief.mission || profile.storage,
    },
    {
      key: "rooms",
      icon: "player",
      label: "입장 흐름",
      value: roomSignal,
      detail: `${myRoomSignal} · 열린 방이 있으면 입장하고, 없으면 새 방을 만드세요.`,
    },
    {
      key: "host",
      icon: "state",
      label: "방 설정",
      value: `최대 ${requestedMaxPlayers}명`,
      detail: `${titleReady} · 생성 후 참가자 준비가 맞으면 방장이 시작합니다.`,
    },
    {
      key: "input",
      icon: "input",
      label: "조작 준비",
      value: actionText,
      detail: `${directionText} · 게임 시작 후 입력이 Good_ETC 프레임으로 전달됩니다.`,
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-lg" data-smoke="video-game-lobby-brief-panel">
      <div className="grid gap-2 md:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.key} className="min-h-[104px] rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" data-smoke="video-game-lobby-brief-tile">
            <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500">
              <GameUxGlyph type={tile.icon} className="h-3.5 w-3.5" />
              {tile.label}
            </div>
            <div className="mt-1 line-clamp-2 text-sm font-black leading-snug text-slate-950">{tile.value}</div>
            <div className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-slate-600">{tile.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
};

const VideoGameRoomSetupArt = ({
  profile,
  createForm,
  joinCode,
  rooms,
  myRooms,
  loading,
  directionControls,
  actionControls,
  className = "",
}) => {
  const maxAllowedPlayers = Math.max(1, Number(profile?.maxPlayers || 1));
  const requestedMaxPlayers = Math.max(1, Math.min(Number(createForm?.maxPlayers || maxAllowedPlayers), maxAllowedPlayers));
  const title = String(createForm?.title || "").trim();
  const code = String(joinCode || "").trim().toUpperCase();
  const roomTotal = (Array.isArray(rooms) ? rooms.length : 0) + (Array.isArray(myRooms) ? myRooms.length : 0);
  const controlCount = [...(directionControls || []), ...((actionControls || []).length ? actionControls : profile?.controls || [])]
    .map(videoControlKey)
    .filter(Boolean).length;
  const setupTitle = title ? title.slice(0, 12) : "자동 방제";
  const roomSignal = loading ? "목록 확인" : roomTotal ? `${roomTotal}방 감지` : "새 방 준비";
  const nodes = [
    { key: "title", label: "방제", value: title ? "입력됨" : "자동", active: Boolean(title), x: 72 },
    { key: "players", label: "정원", value: `${requestedMaxPlayers}명`, active: requestedMaxPlayers > 1, x: 174 },
    { key: "invite", label: "초대", value: code ? "코드" : roomSignal, active: Boolean(code) || roomTotal > 0, x: 276 },
    { key: "input", label: "입력", value: controlCount ? `${controlCount}키` : "기본", active: controlCount > 0, x: 366 },
  ];

  return (
    <svg
      viewBox="0 0 420 172"
      role="img"
      aria-label={`${profile?.title || "비디오게임"} 방 만들기 설정 프리뷰`}
      className={className}
      data-smoke="video-game-room-setup-art"
    >
      <rect width="420" height="172" rx="24" fill="#020617" />
      <rect x="18" y="18" width="384" height="58" rx="18" fill="#0f172a" stroke="#334155" />
      <text x="34" y="40" fill="#67e8f9" fontSize="12" fontWeight="900">방 생성 경로</text>
      <text x="34" y="62" fill="#f8fafc" fontSize="18" fontWeight="900">{setupTitle}</text>
      <text x="302" y="40" textAnchor="middle" fill="#cbd5e1" fontSize="11" fontWeight="900">최대 정원</text>
      <text x="302" y="62" textAnchor="middle" fill="#facc15" fontSize="18" fontWeight="900">{requestedMaxPlayers}명</text>
      <rect x="342" y="30" width="42" height="34" rx="12" fill={code ? "#14532d" : "#1e293b"} stroke={code ? "#86efac" : "#475569"} />
      <text x="363" y="52" textAnchor="middle" fill={code ? "#dcfce7" : "#cbd5e1"} fontSize="11" fontWeight="900">{code ? "코드" : "대기"}</text>

      <path d="M72 118 H366" fill="none" stroke="#334155" strokeWidth="10" strokeLinecap="round" />
      <path d="M72 118 H366" fill="none" stroke="#22d3ee" strokeWidth="4" strokeLinecap="round" />
      {nodes.map((node, index) => (
        <g key={node.key} data-smoke="video-game-room-setup-node" data-setup-key={node.key}>
          <circle cx={node.x} cy="118" r="22" fill={node.active ? "#0f766e" : "#1e293b"} stroke={node.active ? "#99f6e4" : "#64748b"} strokeWidth="2" />
          <text x={node.x} y="123" textAnchor="middle" fill={node.active ? "#ecfeff" : "#cbd5e1"} fontSize="13" fontWeight="900">{index + 1}</text>
          <text x={node.x} y="151" textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="900">{node.label}</text>
          <text x={node.x} y="164" textAnchor="middle" fill="#94a3b8" fontSize="9" fontWeight="800">{node.value}</text>
        </g>
      ))}
      <circle cx="36" cy="118" r="13" fill="#38bdf8" />
      <path d="M32 118 h8 M36 114 v8" stroke="#082f49" strokeWidth="2" strokeLinecap="round" />
      <circle cx="402" cy="118" r="13" fill="#facc15" />
      <path d="M397 118 h10" stroke="#422006" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

const VideoGameInputProfileBriefArt = ({
  profileTitle = "비디오게임",
  directionCount = 0,
  actionCount = 0,
  totalCount = 0,
  bridgeReady = false,
}) => {
  const actionFocused = directionCount === 0 && actionCount > 0;
  const nodes = [
    { key: "direction", label: "방향", value: directionCount ? `${directionCount}` : "없음", active: directionCount > 0, x: 62, fill: "#06b6d4" },
    { key: "action", label: "액션", value: `${actionCount}`, active: actionCount > 0, x: 150, fill: "#f59e0b" },
    { key: "bridge", label: "브릿지", value: bridgeReady ? "준비" : "대기", active: bridgeReady, x: 238, fill: "#10b981" },
    { key: "profile", label: "구조", value: actionFocused ? "버튼" : `${totalCount}`, active: true, x: 318, fill: "#8b5cf6" },
  ];

  return (
    <svg
      viewBox="0 0 380 150"
      role="img"
      aria-label={`${profileTitle} 입력 프로필 브리핑`}
      className="h-auto w-full"
      data-smoke="video-game-input-profile-art"
      focusable="false"
    >
      <rect x="8" y="8" width="364" height="134" rx="22" fill="#020617" stroke="#334155" strokeWidth="3" />
      <path d="M40 102C79 42 125 118 171 72c45-45 89-3 130-33" fill="none" stroke="#334155" strokeWidth="14" strokeLinecap="round" />
      <path d="M40 102C79 42 125 118 171 72c45-45 89-3 130-33" fill="none" stroke={actionFocused ? "#f59e0b" : "#22d3ee"} strokeWidth="5" strokeLinecap="round" />
      <text x="28" y="34" fill="#67e8f9" fontSize="11" fontWeight="900">입력 프로필</text>
      <text x="28" y="54" fill="#f8fafc" fontSize="18" fontWeight="900">{profileTitle}</text>
      {nodes.map((node) => (
        <g key={node.key} data-smoke="video-game-input-profile-node" data-input-profile-node={node.key}>
          <circle cx={node.x} cy="102" r="20" fill={node.active ? node.fill : "#1e293b"} stroke={node.active ? "#f8fafc" : "#64748b"} strokeWidth="3" />
          <text x={node.x} y="98" textAnchor="middle" fill={node.active ? "#ffffff" : "#cbd5e1"} fontSize="9" fontWeight="900">{node.label}</text>
          <text x={node.x} y="113" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="900">{node.value}</text>
        </g>
      ))}
      <rect x="264" y="28" width="82" height="32" rx="12" fill={actionFocused ? "#78350f" : "#164e63"} stroke={actionFocused ? "#fbbf24" : "#67e8f9"} />
      <text x="305" y="49" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="900">{actionFocused ? "액션 중심" : "방향+액션"}</text>
    </svg>
  );
};

const VideoGameInputProfileBrief = ({
  profile,
  directionControls = [],
  actionControls = [],
  status = "WAITING",
}) => {
  const allActions = actionControls.length ? actionControls : profile?.controls || [];
  const directionText = compactControlList(directionControls) || "고정 방향키 없음";
  const actionText = compactControlList(allActions) || "게임 화면 내부 입력";
  const bridgeReady = status === "PLAYING";
  const actionFocused = !directionControls.length && allActions.length > 0;
  const items = [
    {
      key: "structure",
      label: "입력 구조",
      value: actionFocused ? "액션 버튼 중심" : `${directionControls.length}방향 입력`,
      detail: actionFocused ? "이 게임은 고정 방향키보다 웨이브, 업그레이드, 발사 같은 액션 버튼으로 판단합니다." : `${directionText} 방향 축과 액션 버튼을 함께 씁니다.`,
    },
    {
      key: "primary",
      label: "주 입력",
      value: actionText,
      detail: "방 생성 뒤 모바일 버튼과 키 입력은 같은 컨트롤 키로 Good_ETC 프레임에 전달됩니다.",
    },
    {
      key: "bridge",
      label: "전달 상태",
      value: bridgeReady ? "게임화면 연결" : "대기방 점검",
      detail: bridgeReady ? "프레임이 열리면 입력 브릿지와 STOMP 신호가 같은 방 상태를 봅니다." : "시작 전에는 조작 구성을 먼저 확인하고 방장이 시작합니다.",
    },
  ];

  return (
    <div data-smoke="video-game-input-profile-brief" className="mt-3 grid gap-2 rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-amber-50 p-2.5 lg:grid-cols-[240px_minmax(0,1fr)]">
      <VideoGameInputProfileBriefArt
        profileTitle={profile?.title || "비디오게임"}
        directionCount={directionControls.length}
        actionCount={allActions.length}
        totalCount={(profile?.controls || []).length}
        bridgeReady={bridgeReady}
      />
      <div className="grid gap-2 md:grid-cols-3">
        {items.map((item) => (
          <div key={item.key} data-smoke="video-game-input-profile-item" data-input-profile-key={item.key} className="rounded-xl border border-white/80 bg-white/85 px-3 py-2">
            <div className="text-[10px] font-black text-cyan-700">{item.label}</div>
            <div className="mt-1 text-sm font-black text-slate-950">{item.value}</div>
            <div className="mt-1 text-[11px] font-bold leading-snug text-slate-600">{item.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const VideoGameRoomSetupPanel = ({
  profile,
  createForm,
  joinCode,
  rooms,
  myRooms,
  loading,
  directionControls,
  actionControls,
}) => {
  const maxAllowedPlayers = Math.max(1, Number(profile?.maxPlayers || 1));
  const requestedMaxPlayers = Math.max(1, Math.min(Number(createForm?.maxPlayers || maxAllowedPlayers), maxAllowedPlayers));
  const title = String(createForm?.title || "").trim();
  const code = String(joinCode || "").trim().toUpperCase();
  const roomCount = Array.isArray(rooms) ? rooms.length : 0;
  const myRoomCount = Array.isArray(myRooms) ? myRooms.length : 0;
  const directionText = compactControlList(directionControls) || "액션 버튼 중심";
  const actionText = compactControlList(actionControls.length ? actionControls : profile.controls) || "게임 화면 입력";
  const titleProgress = title ? Math.min(100, Math.max(18, (title.length / 24) * 100)) : 8;
  const playerProgress = maxAllowedPlayers > 0 ? (requestedMaxPlayers / maxAllowedPlayers) * 100 : 100;
  const codeProgress = code ? Math.min(100, Math.max(24, (code.length / 8) * 100)) : 8;
  const items = [
    {
      key: "title",
      icon: "state",
      label: "방 제목",
      value: title ? "제목 입력됨" : "자동 제목 가능",
      detail: title ? title : `${profile.title} 기본 제목으로도 방을 만들 수 있습니다.`,
      tone: title ? "done" : "waiting",
      progress: titleProgress,
    },
    {
      key: "players",
      icon: "player",
      label: "정원",
      value: `${requestedMaxPlayers}/${maxAllowedPlayers}명`,
      detail: requestedMaxPlayers > 1 ? "멀티플레이 입력 동기화를 준비합니다." : "1인 테스트 또는 단독 플레이에 맞춘 방입니다.",
      tone: requestedMaxPlayers > 1 ? "active" : "neutral",
      progress: playerProgress,
    },
    {
      key: "code",
      icon: "signal",
      label: "코드 입장",
      value: code ? "코드 입력됨" : "코드 대기",
      detail: code ? `${code} 코드로 바로 합류합니다.` : `${loading ? "방 목록 확인 중" : `${roomCount}개 공개 방 · ${myRoomCount}개 참여 중`}`,
      tone: code ? "done" : roomCount ? "active" : "waiting",
      progress: codeProgress,
    },
    {
      key: "input",
      icon: "input",
      label: "입력 브릿지",
      value: actionText,
      detail: `${directionText} · 시작 후 Good_ETC iframe으로 입력을 전달합니다.`,
      tone: "active",
      progress: 100,
    },
  ];

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-3 shadow-lg"
      data-smoke="video-game-room-setup-panel"
      data-requested-max={requestedMaxPlayers}
      data-code-ready={code ? "true" : "false"}
      data-room-count={roomCount + myRoomCount}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-950 text-white">
              <GameUxGlyph type="build" className="h-4 w-4" />
            </span>
            방 만들기 셋업
          </div>
          <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
            방을 만들기 전 제목, 정원, 코드 입장, 입력 브릿지 상태를 확인합니다.
          </div>
        </div>
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">
          <GameUxGlyph type="stage" className="h-3.5 w-3.5" />
          {profile.title}
        </div>
      </div>
      <VideoGameRoomSetupArt
        profile={profile}
        createForm={createForm}
        joinCode={joinCode}
        rooms={rooms}
        myRooms={myRooms}
        loading={loading}
        directionControls={directionControls}
        actionControls={actionControls}
        className="mt-3 h-40 w-full"
      />
      <VideoGameInputProfileBrief
        profile={profile}
        directionControls={directionControls}
        actionControls={actionControls}
      />
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {items.map((item) => {
          const tone = item.tone === "done"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : item.tone === "active"
              ? "border-sky-200 bg-sky-50 text-sky-800"
              : item.tone === "waiting"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-slate-100 bg-slate-50 text-slate-700";
          return (
            <div key={item.key} className={`min-h-[104px] rounded-xl border px-3 py-2 ${tone}`} data-smoke="video-game-room-setup-item">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-black opacity-75">
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-white/80">
                    <GameUxGlyph type={item.icon} className="h-3 w-3" />
                  </span>
                  <span className="truncate">{item.label}</span>
                </div>
              </div>
              <div className="mt-1 truncate text-sm font-black leading-tight">{item.value}</div>
              <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-relaxed opacity-70">{item.detail}</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/70">
                <div className="h-full rounded-full bg-current transition-all" style={{ width: `${Math.max(0, Math.min(100, item.progress))}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

const VideoGameJoinCodeArt = ({ joinCode, loading, className = "" }) => {
  const codeText = String(joinCode || "").trim().toUpperCase();
  const visibleCode = codeText ? codeText.slice(0, 10) : "방코드";
  const nodes = [
    { key: "input", label: "입력", x: 58, active: Boolean(codeText) },
    { key: "scan", label: loading ? "조회" : "확인", x: 180, active: Boolean(codeText) },
    { key: "enter", label: "입장", x: 302, active: Boolean(codeText) },
  ];

  return (
    <svg
      viewBox="0 0 360 128"
      role="img"
      aria-label="비디오게임 코드 입장 흐름"
      className={className}
      data-smoke="video-game-join-code-art"
    >
      <rect width="360" height="128" rx="20" fill="#020617" />
      <path d="M22 88 C80 28 126 116 178 54 C224 0 278 24 338 72" fill="none" stroke="#22d3ee" strokeWidth="2" opacity="0.35" />
      <rect x="28" y="20" width="304" height="48" rx="16" fill="#0f172a" stroke="#334155" />
      <text x="42" y="38" fill="#67e8f9" fontSize="11" fontWeight="800">초대 코드</text>
      <text x="42" y="57" fill="#f8fafc" fontSize="18" fontWeight="900">{visibleCode}</text>
      <path d="M72 94 H286" fill="none" stroke="#475569" strokeWidth="8" strokeLinecap="round" />
      <path d="M72 94 H286" fill="none" stroke={codeText ? "#34d399" : "#94a3b8"} strokeWidth="3" strokeLinecap="round" />
      {nodes.map((node, index) => (
        <g key={node.key} data-smoke="video-game-join-code-node">
          <circle cx={node.x} cy="94" r="18" fill={node.active ? "#14b8a6" : "#1e293b"} stroke={node.active ? "#99f6e4" : "#64748b"} strokeWidth="2" />
          <text x={node.x} y="98" textAnchor="middle" fill={node.active ? "#ecfeff" : "#cbd5e1"} fontSize="11" fontWeight="900">{index + 1}</text>
          <text x={node.x} y="122" textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="800">{node.label}</text>
        </g>
      ))}
      <circle cx="318" cy="32" r="10" fill={codeText ? "#facc15" : "#334155"} />
      <path d="M315 32 l3 3 l6 -7" fill="none" stroke={codeText ? "#422006" : "#94a3b8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const VideoGameJoinCodePanel = ({ joinCode, setJoinCode, busy, loading, joinByCode }) => {
  const hasCode = String(joinCode || "").trim().length > 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg" data-smoke="video-game-join-code-panel">
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2 text-base font-black text-slate-900">
          <Zap className="h-4 w-4 text-amber-500" />
          코드 입장
        </div>
        <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
          초대 코드를 입력하면 대기 방을 찾고 바로 입장 흐름으로 연결합니다.
        </div>
      </div>
      <div className="space-y-3 p-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <input
            aria-label="방 코드"
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold uppercase outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
            placeholder="방코드"
            maxLength={32}
            data-smoke="video-game-join-code-input"
          />
          <button
            type="button"
            disabled={busy}
            className="min-h-11 rounded-xl bg-primary-600 px-4 text-sm font-black text-white disabled:opacity-40"
            onClick={joinByCode}
            data-smoke="video-game-join-code-submit"
          >
            입장
          </button>
        </div>
        <div className={`rounded-xl px-3 py-2 text-[11px] font-bold leading-relaxed ${hasCode ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-500"}`} data-smoke="video-game-join-code-status">
          {hasCode ? "입력한 코드로 방을 조회할 준비가 됐습니다." : "방장이 공유한 코드를 입력하세요."}
        </div>
      </div>
    </section>
  );
};

const VideoControlStrip = ({ controls, pressedControl = "" }) => (
  <div className="mt-3 rounded-2xl border border-white/10 bg-white/10 p-2" data-smoke="video-game-control-strip">
    <div className="mb-2 flex items-center justify-between gap-2 px-1 text-[10px] font-black text-cyan-100/80">
      <span>컨트롤 애셋</span>
      <span>{controls.length}개</span>
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {controls.map((control) => {
        const controlKey = videoControlKey(control);
        const active = pressedControl === controlKey;
        return (
          <div
            key={controlKey}
            className={`flex min-h-10 items-center gap-2 rounded-xl px-2 py-1.5 ${
              active ? "bg-cyan-300 text-slate-950" : "bg-slate-950/60 text-white ring-1 ring-white/10"
            }`}
            data-smoke="video-game-control-chip"
          >
            <VideoControlGlyph control={controlKey} active={active} className="h-7 w-7 shrink-0" />
            <span className="min-w-0 truncate text-[11px] font-black">{videoControlAccessibleLabel(control)}</span>
          </div>
        );
      })}
    </div>
  </div>
);

const videoControlIntentFor = (control, videoGameCode) => {
  const key = videoControlKey(control);
  const label = videoControlAccessibleLabel(control);
  if (["up", "left", "right", "down"].includes(key)) {
    const detail = videoGameCode === "snake"
      ? "충돌을 피하기 위해 다음 회전 공간을 먼저 확보합니다."
      : videoGameCode === "kart"
        ? "코너 진입 라인을 바꾸고 드리프트 타이밍을 준비합니다."
        : "위치를 바꾸고 조준 각도나 회피 경로를 만듭니다.";
    return { key, label: "이동 판단", value: label, detail, icon: "input", tone: "cyan" };
  }
  if (key.includes("angle")) {
    return { key, label: "각도 보정", value: label, detail: "이전 탄착을 기준으로 포탄 궤적을 위아래로 보정합니다.", icon: "decision", tone: "amber" };
  }
  if (key.includes("power")) {
    return { key, label: "화력 조절", value: label, detail: "거리와 바람을 읽고 발사 세기를 한 단계씩 맞춥니다.", icon: "signal", tone: "orange" };
  }
  if (key.includes("fire") || key === "attack") {
    return { key, label: "공격 실행", value: label, detail: "조준이 맞았을 때 짧게 눌러 공격 신호를 보냅니다.", icon: "stage", tone: "rose" };
  }
  if (key.includes("dash")) {
    return { key, label: "회피 전환", value: label, detail: "빈틈을 만들거나 위험 구간을 빠르게 빠져나갈 때 사용합니다.", icon: "recent", tone: "emerald" };
  }
  if (key.includes("wave")) {
    return { key, label: "웨이브 진행", value: label, detail: "방어 라인이 준비됐는지 확인한 뒤 다음 공세를 부릅니다.", icon: "stage", tone: "sky" };
  }
  if (key.includes("upgrade")) {
    return { key, label: "성장 선택", value: label, detail: "현재 라인의 약점을 보완하도록 방어 성능을 올립니다.", icon: "score", tone: "emerald" };
  }
  if (key.includes("sell")) {
    return { key, label: "배치 정리", value: label, detail: "효율이 낮은 방어 자원을 회수해 다음 선택지를 엽니다.", icon: "decision", tone: "slate" };
  }
  if (key.includes("skill")) {
    return { key, label: "스킬 사용", value: label, detail: "위험이 몰리는 순간에 즉시 효과를 발동합니다.", icon: "signal", tone: "violet" };
  }
  if (key === "interact") {
    return { key, label: "상호작용", value: label, detail: "대화, 조사, 진행 오브젝트를 확인할 때 사용합니다.", icon: "stage", tone: "violet" };
  }
  return { key, label: "즉시 액션", value: label, detail: "게임별 핵심 행동을 한 번에 실행하는 버튼입니다.", icon: "decision", tone: "amber" };
};

const buildVideoGameControlIntents = ({ videoGameCode, profile, directionControls, actionControls }) => {
  const actions = actionControls.length ? actionControls : profile.controls;
  return [...directionControls, ...actions]
    .filter((control, index, list) => {
      const key = videoControlKey(control);
      return key && list.findIndex((item) => videoControlKey(item) === key) === index;
    })
    .map((control) => videoControlIntentFor(control, videoGameCode))
    .slice(0, 6);
};

const videoControlIntentTone = {
  cyan: { fill: "#22d3ee", soft: "border-cyan-100 bg-cyan-50 text-cyan-900" },
  amber: { fill: "#f59e0b", soft: "border-amber-100 bg-amber-50 text-amber-900" },
  orange: { fill: "#fb923c", soft: "border-orange-100 bg-orange-50 text-orange-900" },
  rose: { fill: "#fb7185", soft: "border-rose-100 bg-rose-50 text-rose-900" },
  emerald: { fill: "#10b981", soft: "border-emerald-100 bg-emerald-50 text-emerald-900" },
  sky: { fill: "#38bdf8", soft: "border-sky-100 bg-sky-50 text-sky-900" },
  violet: { fill: "#a78bfa", soft: "border-violet-100 bg-violet-50 text-violet-900" },
  slate: { fill: "#94a3b8", soft: "border-slate-100 bg-slate-50 text-slate-900" },
};

const VideoGameControlIntentArt = ({ intents, activeControlKey, bridgeReady }) => {
  const nodes = intents.slice(0, 6);
  const centerLabel = bridgeReady ? "프레임 연결" : "시작 대기";
  return (
    <svg
      viewBox="0 0 360 220"
      className="h-full min-h-[190px] w-full"
      role="img"
      aria-label="비디오게임 조작 의도 렌즈"
      data-smoke="video-game-control-intent-art"
    >
      <rect x="8" y="8" width="344" height="204" rx="26" fill="#0f172a" />
      <path d="M36 168C84 92 122 174 176 104s96-48 140-18" fill="none" stroke="#f8fafc" strokeWidth="2" strokeDasharray="7 9" opacity=".22" />
      <g transform="translate(180 106)">
        <circle r="34" fill={bridgeReady ? "rgba(16,185,129,.18)" : "rgba(245,158,11,.18)"} stroke={bridgeReady ? "#10b981" : "#f59e0b"} strokeWidth="4" />
        <path d="M-14 2 0-12 14 2M0-12v27" stroke={bridgeReady ? "#6ee7b7" : "#fde68a"} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <text y="52" textAnchor="middle" fontSize="10" fontWeight="900" fill="#e2e8f0">{centerLabel}</text>
      </g>
      {nodes.map((intent, index) => {
        const angle = (-110 + index * (220 / Math.max(1, nodes.length - 1))) * (Math.PI / 180);
        const x = 180 + Math.cos(angle) * 128;
        const y = 106 + Math.sin(angle) * 72;
        const tone = videoControlIntentTone[intent.tone] || videoControlIntentTone.slate;
        const active = intent.key === activeControlKey;
        return (
          <g key={intent.key} transform={`translate(${x} ${y})`} data-smoke="video-game-control-intent-node">
            <path d={`M${180 - x} ${106 - y} 0 0`} stroke={active ? tone.fill : "#64748b"} strokeWidth={active ? "4" : "2"} strokeLinecap="round" opacity={active ? ".9" : ".34"} />
            <rect x="-42" y="-18" width="84" height="36" rx="16" fill={active ? tone.fill : "#1e293b"} stroke={tone.fill} strokeWidth="3" />
            <text y="-1" textAnchor="middle" fontSize="10" fontWeight="900" fill={active ? "#0f172a" : "#f8fafc"}>{intent.value}</text>
            <text y="12" textAnchor="middle" fontSize="8" fontWeight="900" fill={active ? "#0f172a" : "#cbd5e1"}>{intent.label}</text>
          </g>
        );
      })}
      <text x="28" y="32" fontSize="11" fontWeight="900" fill="#bae6fd">조작 의도 렌즈</text>
      <text x="332" y="32" textAnchor="end" fontSize="10" fontWeight="900" fill="#cbd5e1">{nodes.length}개 입력</text>
    </svg>
  );
};

const VideoGameControlIntentPanel = ({
  videoGameCode,
  profile,
  directionControls,
  actionControls,
  pressedControl,
  status,
  gameFrameSrc,
}) => {
  const intents = buildVideoGameControlIntents({ videoGameCode, profile, directionControls, actionControls });
  if (!intents.length) return null;
  const bridgeReady = status === "PLAYING" && Boolean(gameFrameSrc);

  return (
    <section className="mt-3 overflow-hidden rounded-2xl border border-cyan-300/20 bg-white/95 text-slate-900 shadow-sm" data-smoke="video-game-control-intent-panel">
      <div className="grid gap-0 xl:grid-cols-[minmax(220px,.95fr)_minmax(0,1fr)]">
        <div className="bg-slate-950 p-2">
          <VideoGameControlIntentArt intents={intents} activeControlKey={pressedControl} bridgeReady={bridgeReady} />
        </div>
        <div className="p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-[11px] font-black text-cyan-700">Good_ETC 입력 해석</div>
              <h3 className="text-sm font-black text-slate-950">버튼이 어떤 플레이 판단으로 이어지는지 확인합니다</h3>
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-black ${bridgeReady ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
              {bridgeReady ? "전달 가능" : "시작 후 전달"}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {intents.slice(0, 4).map((intent) => {
              const tone = videoControlIntentTone[intent.tone] || videoControlIntentTone.slate;
              const active = intent.key === pressedControl;
              return (
                <div key={intent.key} className={`min-h-[96px] rounded-xl border px-3 py-2 ${tone.soft} ${active ? "ring-2 ring-cyan-300" : ""}`} data-smoke="video-game-control-intent-item">
                  <div className="flex items-center gap-1.5 text-[10px] font-black opacity-70">
                    <GameUxGlyph type={intent.icon} className="h-3.5 w-3.5" />
                    {intent.label}
                  </div>
                  <div className="mt-1 text-sm font-black leading-snug">{intent.value}</div>
                  <div className="mt-1 text-[11px] font-bold leading-relaxed opacity-80">{intent.detail}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

const videoGameInputRouteTone = {
  active: { node: "#22d3ee", fill: "#ecfeff", text: "#0e7490", card: "border-cyan-100 bg-cyan-50 text-cyan-900" },
  done: { node: "#10b981", fill: "#dcfce7", text: "#047857", card: "border-emerald-100 bg-emerald-50 text-emerald-900" },
  waiting: { node: "#f59e0b", fill: "#fef3c7", text: "#92400e", card: "border-amber-100 bg-amber-50 text-amber-900" },
  locked: { node: "#94a3b8", fill: "#f8fafc", text: "#475569", card: "border-slate-100 bg-slate-50 text-slate-700" },
};

const buildVideoGameInputRouteItems = ({
  profile,
  directionControls,
  actionControls,
  pressedControl,
  pressedControlLabel,
  status,
  transportLabel,
  gameFrameSrc,
}) => {
  const bridgeReady = status === "PLAYING" && Boolean(gameFrameSrc);
  const fallbackActions = actionControls.length ? actionControls : profile.controls;
  const hasDirections = directionControls.length > 0;
  const actionText = compactControlList(fallbackActions) || "게임 액션";
  const directionText = compactControlList(directionControls) || "액션 버튼 중심";
  const liveInput = pressedControlLabel || (pressedControl ? readableVideoInputControlLabel(pressedControl, profile.controls) : "");

  return [
    {
      key: "state",
      icon: "signal",
      label: "상태 확인",
      value: bridgeReady ? "입력 가능" : status === "FINISHED" ? "결과 상태" : "시작 대기",
      detail: `${transportLabel || "대기"} · ${bridgeReady ? "iframe이 입력을 받을 수 있습니다." : "방 상태와 화면 준비를 먼저 확인합니다."}`,
      state: bridgeReady ? "done" : status === "FINISHED" ? "waiting" : "locked",
    },
    {
      key: "move",
      icon: "input",
      label: "이동 입력",
      value: hasDirections ? `${directionControls.length}방향` : "방향 없음",
      detail: hasDirections ? `${directionText}으로 위치, 회피, 조준 각도를 먼저 잡습니다.` : "이 게임은 별도 방향키보다 액션 버튼 판단이 중심입니다.",
      state: bridgeReady && hasDirections ? "active" : hasDirections ? "waiting" : "locked",
    },
    {
      key: "action",
      icon: "decision",
      label: "액션 입력",
      value: actionText,
      detail: bridgeReady ? "이동 판단 뒤 공격, 상호작용, 스킬 같은 핵심 액션을 짧게 실행합니다." : "시작 전에는 버튼 의미만 확인하고 실제 전달은 대기합니다.",
      state: bridgeReady ? "active" : "waiting",
    },
    {
      key: "release",
      icon: "recent",
      label: "해제/피드백",
      value: liveInput || "입력 대기",
      detail: liveInput ? `${liveInput} 입력 후 버튼을 놓으면 해제 신호와 피드백이 이어집니다.` : "입력 후 피드백 티커와 추적 패널에서 전달 상태를 확인합니다.",
      state: liveInput ? "done" : bridgeReady ? "waiting" : "locked",
    },
  ];
};

const VideoGameInputRouteArt = ({ items, status, bridgeReady }) => {
  const nodes = items.map((item, index) => ({
    ...item,
    x: 50 + index * 98,
    y: index % 2 ? 58 : 92,
    tone: videoGameInputRouteTone[item.state] || videoGameInputRouteTone.waiting,
  }));
  const path = nodes.map((node, index) => `${index ? "L" : "M"}${node.x} ${node.y}`).join(" ");

  return (
    <svg
      viewBox="0 0 360 156"
      role="img"
      aria-label="Good ETC 입력 루트를 상태 확인, 이동 입력, 액션 입력, 해제와 피드백 순서로 보여주는 그림"
      className="h-auto w-full"
      data-smoke="video-game-input-route-art"
      data-stage-status={status || ""}
      data-bridge-ready={bridgeReady ? "true" : "false"}
      focusable="false"
    >
      <rect x="8" y="8" width="344" height="140" rx="22" fill="#020617" stroke="#1e293b" strokeWidth="3" />
      <rect x="20" y="22" width="320" height="104" rx="18" fill="#0f172a" />
      <text x="28" y="42" fontSize="11" fontWeight="900" fill="#67e8f9">입력 루트</text>
      <text x="332" y="42" textAnchor="end" fontSize="10" fontWeight="900" fill={bridgeReady ? "#6ee7b7" : "#fde68a"}>{bridgeReady ? "전달 가능" : status || "대기"}</text>
      {nodes.length > 1 && (
        <>
          <path d={path} fill="none" stroke="#334155" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
          <path d={path} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {nodes.map((node, index) => (
        <g key={node.key} data-smoke="video-game-input-route-node" data-route-key={node.key} data-route-state={node.state}>
          <circle cx={node.x} cy={node.y} r="25" fill={node.tone.fill} stroke={node.tone.node} strokeWidth="4" />
          <text x={node.x} y={node.y - 4} textAnchor="middle" fontSize="13" fontWeight="900" fill={node.tone.text}>{index + 1}</text>
          <text x={node.x} y={node.y + 12} textAnchor="middle" fontSize="8" fontWeight="900" fill={node.tone.text}>{node.label.replace(" 입력", "")}</text>
        </g>
      ))}
      <rect x="36" y="132" width="288" height="10" rx="5" fill="#1e293b" />
      <text x="180" y="140" textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#cbd5e1">상태 확인 → 이동 → 액션 → 해제/피드백</text>
    </svg>
  );
};

const VideoGameInputRoutePanel = ({
  profile,
  directionControls,
  actionControls,
  pressedControl,
  pressedControlLabel,
  status,
  transportLabel,
  gameFrameSrc,
}) => {
  const bridgeReady = status === "PLAYING" && Boolean(gameFrameSrc);
  const items = buildVideoGameInputRouteItems({
    profile,
    directionControls,
    actionControls,
    pressedControl,
    pressedControlLabel,
    status,
    transportLabel,
    gameFrameSrc,
  });

  return (
    <section
      className="mt-3 overflow-hidden rounded-2xl border border-cyan-300/20 bg-white/95 text-slate-900"
      data-smoke="video-game-input-route-panel"
      data-stage-status={status || ""}
      data-bridge-ready={bridgeReady ? "true" : "false"}
      data-direction-count={directionControls.length}
      data-action-count={(actionControls.length ? actionControls : profile.controls).length}
      data-pressed-control={pressedControl || ""}
    >
      <div className="grid gap-0 xl:grid-cols-[minmax(220px,.95fr)_minmax(0,1fr)]">
        <div className="bg-slate-950 p-2">
          <VideoGameInputRouteArt items={items} status={status} bridgeReady={bridgeReady} />
        </div>
        <div className="p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-[11px] font-black text-cyan-700">Good_ETC 입력 흐름</div>
              <h3 className="text-sm font-black text-slate-950">버튼을 누르기 전 순서를 먼저 잡습니다</h3>
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-black ${bridgeReady ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
              {bridgeReady ? "iframe 전달 가능" : "입력 대기"}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.map((item) => {
              const tone = videoGameInputRouteTone[item.state] || videoGameInputRouteTone.waiting;
              return (
                <div key={item.key} className={`min-h-[96px] rounded-xl border px-3 py-2 ${tone.card}`} data-smoke="video-game-input-route-item" data-route-key={item.key} data-route-state={item.state}>
                  <div className="flex items-center gap-1.5 text-[10px] font-black opacity-70">
                    <GameUxGlyph type={item.icon} className="h-3.5 w-3.5" />
                    {item.label}
                  </div>
                  <div className="mt-1 text-sm font-black leading-snug">{item.value}</div>
                  <div className="mt-1 text-[11px] font-bold leading-relaxed opacity-80">{item.detail}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

const VideoGameInputDeck = ({
  videoGameCode,
  profile,
  directionControls,
  actionControls,
  pressedControl,
  pressedControlLabel,
  status,
  transportLabel,
  gameFrameSrc,
}) => {
  const hasDirections = directionControls.length > 0;
  const fallbackActions = actionControls.length ? actionControls : profile.controls;
  const controlStripItems = [...directionControls, ...fallbackActions].filter((control, index, list) => {
    const key = videoControlKey(control);
    return key && list.findIndex((item) => videoControlKey(item) === key) === index;
  });
  const directionDetail = hasDirections ? compactControlList(directionControls) : "고정 방향키 대신 액션 버튼으로 조작합니다.";
  const actionDetail = compactControlList(fallbackActions) || "게임 화면 내부 입력을 사용합니다.";
  const bridgeReady = status === "PLAYING" && Boolean(gameFrameSrc);
  const tiles = [
    {
      key: "direction",
      icon: "input",
      label: "방향 입력",
      value: hasDirections ? `${directionControls.length}방향 패드` : "액션 중심",
      detail: directionDetail,
    },
    {
      key: "action",
      icon: "decision",
      label: "액션 입력",
      value: `${fallbackActions.length}개 버튼`,
      detail: actionDetail,
    },
    {
      key: "bridge",
      icon: "signal",
      label: "전달 상태",
      value: bridgeReady ? "프레임 연결" : "시작 대기",
      detail: `${transportLabel} · ${bridgeReady ? "버튼 입력이 Good_ETC 화면으로 전달됩니다." : "게임 시작 후 입력 브리지가 활성화됩니다."}`,
    },
    {
      key: "live",
      icon: "stage",
      label: "현재 입력",
      value: pressedControlLabel || "입력 대기",
      detail: pressedControlLabel ? "누른 버튼을 놓으면 입력 해제가 함께 전달됩니다." : "짧게 누르면 이동/액션 리듬이 더 안정적입니다.",
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-950 p-3 text-white shadow-inner" data-smoke="video-game-input-deck">
      <div className="flex items-center gap-2 text-sm font-black text-white">
        <GameUxGlyph type="signal" className="h-4 w-4 text-cyan-200" />
        입력 덱
      </div>
      <VideoGameInputRoutePanel
        profile={profile}
        directionControls={directionControls}
        actionControls={actionControls}
        pressedControl={pressedControl}
        pressedControlLabel={pressedControlLabel}
        status={status}
        transportLabel={transportLabel}
        gameFrameSrc={gameFrameSrc}
      />
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {tiles.map((tile) => (
          <div key={tile.key} className="min-h-[92px] rounded-xl border border-white/10 bg-white/10 px-3 py-2" data-smoke="video-game-input-tile">
            <div className="flex items-center gap-1.5 text-[10px] font-black text-cyan-100">
              <GameUxGlyph type={tile.icon} className="h-3.5 w-3.5" />
              {tile.label}
            </div>
            <div className="mt-1 truncate text-sm font-black text-white">{tile.value}</div>
            <div className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-slate-300">{tile.detail}</div>
          </div>
        ))}
      </div>
      <VideoControlStrip controls={controlStripItems} pressedControl={pressedControl} />
      <VideoGameControlIntentPanel
        videoGameCode={videoGameCode}
        profile={profile}
        directionControls={directionControls}
        actionControls={actionControls}
        pressedControl={pressedControl}
        status={status}
        gameFrameSrc={gameFrameSrc}
      />
    </section>
  );
};

const VideoGameMobileControlMapArt = ({
  directionControls = [],
  actionList = [],
  pressedControl = "",
  pressedControlLabel = "",
  bridgeReady = false,
  status = "",
  className = "",
}) => {
  const directionCount = directionControls.length;
  const actionCount = actionList.length;
  const activeAction = actionList.find((control) => videoControlKey(control) === pressedControl);
  const activeDirection = directionControls.find((control) => videoControlKey(control) === pressedControl);
  const activeLabel = pressedControlLabel || videoControlLabel(activeAction || activeDirection) || "대기";
  const bridgeLabel = bridgeReady ? "연결" : status === "FINISHED" ? "결과" : "대기";
  const directionLabel = directionCount ? `${directionCount}방향` : "액션형";
  const actionLabel = `${actionCount}개`;
  const nodes = [
    { key: "direction", label: "방향", value: directionLabel, x: 58, y: 104, fill: directionCount ? "#06b6d4" : "#94a3b8", active: Boolean(directionCount && activeDirection) },
    { key: "action", label: "액션", value: actionLabel, x: 156, y: 70, fill: "#8b5cf6", active: Boolean(activeAction) },
    { key: "hold", label: "유지", value: activeLabel, x: 252, y: 104, fill: pressedControl ? "#f97316" : "#64748b", active: Boolean(pressedControl) },
    { key: "bridge", label: "브리지", value: bridgeLabel, x: 342, y: 70, fill: bridgeReady ? "#10b981" : status === "FINISHED" ? "#f59e0b" : "#94a3b8", active: bridgeReady || status === "FINISHED" },
  ];

  return (
    <svg
      viewBox="0 0 390 164"
      role="img"
      aria-label="Good ETC 모바일 조작 지도"
      className={className}
      data-smoke="video-game-mobile-control-map-art"
      data-stage-status={status || ""}
      data-bridge-ready={bridgeReady ? "true" : "false"}
      data-active-control={pressedControl || ""}
    >
      <rect width="390" height="164" rx="24" fill="#0f172a" />
      <rect x="18" y="18" width="354" height="128" rx="22" fill="#111827" stroke="#334155" strokeWidth="2" />
      <text x="34" y="42" fill="#e0f2fe" fontSize="12" fontWeight="900">모바일 조작 지도</text>
      <text x="34" y="60" fill="#94a3b8" fontSize="10" fontWeight="800">패드, 액션, 입력 유지, iframe 브리지 순서로 확인합니다</text>
      <path d="M82 104 C110 76 126 70 156 70 S222 74 252 104 S314 96 342 70" fill="none" stroke={bridgeReady ? "#22c55e" : "#475569"} strokeWidth="7" strokeLinecap="round" />
      <path d="M82 104 C110 76 126 70 156 70 S222 74 252 104 S314 96 342 70" fill="none" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      {nodes.map((node, index) => (
        <g key={node.key} data-smoke="video-game-mobile-control-map-node" data-control-map-key={node.key}>
          <circle cx={node.x} cy={node.y} r={node.active ? 25 : 22} fill={node.fill} stroke={node.active ? "#fef3c7" : "#cbd5e1"} strokeWidth={node.active ? "4" : "2"} />
          <text x={node.x} y={node.y - 4} textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="900">{node.label}</text>
          <text x={node.x} y={node.y + 11} textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="900">{String(node.value).slice(0, 7)}</text>
          <text x={node.x} y={node.y + 38} textAnchor="middle" fill="#cbd5e1" fontSize="9" fontWeight="900">{index + 1}</text>
        </g>
      ))}
      <rect x="256" y="30" width="94" height="24" rx="12" fill={bridgeReady ? "#dcfce7" : status === "FINISHED" ? "#fef3c7" : "#1e293b"} />
      <text x="303" y="46" textAnchor="middle" fill={bridgeReady ? "#14532d" : status === "FINISHED" ? "#92400e" : "#cbd5e1"} fontSize="10" fontWeight="900">
        {bridgeReady ? "전달 가능" : status === "FINISHED" ? "결과 상태" : "시작 후 전달"}
      </text>
    </svg>
  );
};

const VideoGameMobileControlPanel = ({
  profile,
  directionControls,
  actionControls,
  pressedControl,
  pressedControlLabel,
  status,
  gameFrameSrc,
  onControl,
}) => {
  const actionList = actionControls.length ? actionControls : profile.controls;
  const bridgeReady = status === "PLAYING" && Boolean(gameFrameSrc);
  const directionSlots = ["", "up", "", "left", "", "right", "", "down", ""];
  const handleKeyDown = (event, control) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (event.repeat) return;
    onControl(control, true);
  };
  const handleKeyUp = (event, control) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onControl(control, false);
  };
  const controlHandlers = (control) => ({
    onPointerDown: () => onControl(control, true),
    onPointerUp: () => onControl(control, false),
    onPointerCancel: () => onControl(control, false),
    onPointerLeave: () => onControl(control, false),
    onKeyDown: (event) => handleKeyDown(event, control),
    onKeyUp: (event) => handleKeyUp(event, control),
  });

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg" data-smoke="video-game-mobile-control-panel">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <GameUxGlyph type="input" className="h-4 w-4 text-primary-600" />
            모바일 조작
          </div>
          <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
            {bridgeReady ? "버튼을 누르는 동안 Good_ETC 화면에 입력 유지 신호가 전달됩니다." : "게임 시작 전에는 입력 브리지 대기 피드백으로 상태를 확인합니다."}
          </div>
        </div>
        <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black ${bridgeReady ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
          {bridgeReady ? "프레임 연결" : "시작 대기"}
        </span>
      </div>

      <VideoGameMobileControlMapArt
        directionControls={directionControls}
        actionList={actionList}
        pressedControl={pressedControl}
        pressedControlLabel={pressedControlLabel}
        bridgeReady={bridgeReady}
        status={status}
        className="mt-4 h-auto w-full"
      />

      {!!directionControls.length && (
        <div className="mt-3 rounded-2xl bg-slate-950 p-3" data-smoke="video-game-mobile-direction-pad">
          <div className="mb-2 flex items-center justify-between gap-2 text-[10px] font-black text-white/55">
            <span>방향 패드</span>
            <span>{directionControls.length}방향</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {directionSlots.map((slot, index) => {
              const control = directionControls.find((item) => item.control === slot);
              if (!control) return <div key={`empty-${index}`} className="min-h-14 rounded-xl bg-white/5" aria-hidden="true" />;
              const active = pressedControl === control.control;
              const label = videoControlAccessibleLabel(control);
              return (
                <button
                  key={control.control}
                  type="button"
                  title={`${label} 입력`}
                  aria-label={`${label} 입력`}
                  aria-pressed={active}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl px-3 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200 ${
                    active ? "bg-cyan-300 text-slate-950" : "bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/20"
                  }`}
                  data-smoke="video-game-mobile-control-button"
                  data-control={control.control}
                  {...controlHandlers(control)}
                >
                  <VideoControlGlyph control={control.control} active={active} className="h-6 w-6" />
                  <span className="text-[10px]">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-2" data-smoke="video-game-mobile-action-pad">
        <div className="mb-2 flex items-center justify-between gap-2 px-1 text-[10px] font-black text-slate-400">
          <span>액션 버튼</span>
          <span>{actionList.length}개</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {actionList.map((control) => {
            const controlKey = videoControlKey(control);
            const controlLabel = videoControlLabel(control);
            const active = pressedControl === controlKey;
            return (
              <button
                key={controlKey}
                type="button"
                className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 ${
                  active ? "bg-primary-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
                }`}
                aria-label={`${controlLabel} 입력`}
                aria-pressed={active}
                data-smoke="video-game-mobile-action-button"
                data-control={controlKey}
                {...controlHandlers(control)}
              >
                <VideoControlGlyph control={controlKey} active={active} className="h-5 w-5 shrink-0" />
                <span className="min-w-0 truncate">{controlLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={`mt-3 rounded-xl px-3 py-2 text-xs font-black ${
          pressedControl ? "bg-primary-50 text-primary-700" : bridgeReady ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-500"
        }`}
        role="status"
        aria-live="polite"
        data-smoke="video-game-mobile-control-status"
      >
        {pressedControl ? `입력 유지 · ${pressedControlLabel}` : bridgeReady ? "입력 대기 · 모바일 버튼을 누르면 게임 화면으로 전달됩니다." : "입력 대기 · 게임 시작 후 브리지가 연결됩니다."}
      </div>
    </section>
  );
};

const videoRoomReadinessToneClasses = {
  done: {
    shell: "border-emerald-100 bg-emerald-50 text-emerald-950",
    icon: "bg-emerald-600 text-white",
    detail: "text-emerald-800",
    bar: "bg-emerald-500",
  },
  active: {
    shell: "border-primary-100 bg-primary-50 text-primary-950",
    icon: "bg-primary-600 text-white",
    detail: "text-primary-800",
    bar: "bg-primary-500",
  },
  waiting: {
    shell: "border-amber-100 bg-amber-50 text-amber-950",
    icon: "bg-amber-500 text-slate-950",
    detail: "text-amber-800",
    bar: "bg-amber-500",
  },
  neutral: {
    shell: "border-slate-100 bg-slate-50 text-slate-950",
    icon: "bg-slate-900 text-white",
    detail: "text-slate-600",
    bar: "bg-slate-400",
  },
};

const videoRoomReadinessSvgTone = {
  done: { fill: "#dcfce7", stroke: "#16a34a", text: "#14532d" },
  active: { fill: "#dbeafe", stroke: "#2563eb", text: "#1e3a8a" },
  waiting: { fill: "#fef3c7", stroke: "#d97706", text: "#78350f" },
  neutral: { fill: "#f1f5f9", stroke: "#64748b", text: "#334155" },
};

const VideoGameRoomReadinessArt = ({ items = [], status = "", startTone = "waiting", bridgeReady = false }) => {
  const nodes = items.slice(0, 4);
  const nodePositions = [
    { x: 54, y: 78 },
    { x: 142, y: 78 },
    { x: 230, y: 78 },
    { x: 318, y: 78 },
  ];
  const statusTone = videoRoomReadinessSvgTone[startTone] || videoRoomReadinessSvgTone.waiting;
  const statusText = statusLabel[status] || status || "대기";

  return (
    <svg
      data-smoke="video-game-room-readiness-art"
      viewBox="0 0 372 172"
      className="h-auto w-full"
      role="img"
      aria-label={`비디오게임 시작 준비 흐름 ${statusText}`}
      focusable="false"
    >
      <rect x="8" y="8" width="356" height="156" rx="28" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
      <path d="M28 126c43-26 82-29 118-10 43 23 89 19 136-19 24-19 44-21 62-8v48H28Z" fill={bridgeReady ? "#dcfce7" : "#e0f2fe"} opacity="0.86" />
      <rect x="28" y="26" width="128" height="28" rx="14" fill="#ffffff" stroke={statusTone.stroke} strokeWidth="2" />
      <text x="92" y="45" textAnchor="middle" fontSize="12" fontWeight="900" fill={statusTone.text}>{statusText}</text>
      <rect x="238" y="26" width="106" height="28" rx="14" fill={bridgeReady ? "#dcfce7" : "#f1f5f9"} stroke={bridgeReady ? "#16a34a" : "#64748b"} strokeWidth="2" />
      <text x="291" y="45" textAnchor="middle" fontSize="11" fontWeight="900" fill={bridgeReady ? "#14532d" : "#334155"}>
        {bridgeReady ? "브리지 연결" : "브리지 대기"}
      </text>
      <path d="M54 78H318" stroke="#cbd5e1" strokeWidth="10" strokeLinecap="round" />
      {nodes.map((item, index) => {
        const position = nodePositions[index] || nodePositions[0];
        const tone = videoRoomReadinessSvgTone[item.tone] || videoRoomReadinessSvgTone.neutral;
        const progress = Math.max(0, Math.min(1, Number(item.progress || 0) / 100));
        return (
          <g key={item.key || index} data-smoke="video-game-room-readiness-node" data-readiness-key={item.key || ""}>
            {index > 0 && (
              <path
                d={`M${nodePositions[index - 1].x + 22} ${position.y}H${position.x - 22}`}
                stroke={progress >= 1 ? tone.stroke : "#94a3b8"}
                strokeWidth="5"
                strokeLinecap="round"
                opacity={progress >= 1 ? 0.86 : 0.42}
              />
            )}
            <circle cx={position.x} cy={position.y} r="25" fill={tone.fill} stroke={tone.stroke} strokeWidth="4" />
            <path
              d={`M${position.x - 13} ${position.y + 18}A18 18 0 ${progress > 0.5 ? 1 : 0} 1 ${position.x - 13 + 26 * progress} ${position.y + 18 - 18 * progress}`}
              fill="none"
              stroke={tone.stroke}
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.9"
            />
            <text x={position.x} y={position.y + 4} textAnchor="middle" fontSize="12" fontWeight="900" fill={tone.text}>{index + 1}</text>
            <text x={position.x} y="126" textAnchor="middle" fontSize="10" fontWeight="900" fill={tone.text}>{item.label}</text>
            <text x={position.x} y="142" textAnchor="middle" fontSize="9" fontWeight="800" fill="#64748b">{item.value}</text>
          </g>
        );
      })}
    </svg>
  );
};

const VideoGameRoomReadinessPanel = ({
  selectedRoom,
  status,
  players,
  guestPlayers,
  readyGuestCount,
  readyGuests,
  canStart,
  isHost,
  gameFrameSrc,
  transportLabel,
  frameStatusText,
}) => {
  const minPlayers = Math.max(1, Number(selectedRoom?.minPlayers || 1));
  const maxPlayers = Math.max(minPlayers, Number(selectedRoom?.maxPlayers || minPlayers));
  const playerProgress = Math.min(100, Math.max(8, (players.length / minPlayers) * 100));
  const guestProgress = guestPlayers.length ? Math.min(100, Math.max(8, (readyGuestCount / guestPlayers.length) * 100)) : 100;
  const enoughPlayers = players.length >= minPlayers;
  const bridgeReady = status === "PLAYING" && Boolean(gameFrameSrc);
  const startLabel = status === "PLAYING"
    ? "플레이 중"
    : status === "FINISHED"
      ? "세션 종료"
      : canStart
        ? "방장 시작 가능"
        : enoughPlayers && readyGuests
          ? "방장 대기"
          : "준비 필요";
  const startTone = status === "PLAYING" || status === "FINISHED" ? "done" : canStart ? "active" : "waiting";
  const bridgeValue = bridgeReady ? "iframe 연결" : status === "PLAYING" ? "연결 대기" : "시작 후 활성";

  const items = [
    {
      key: "players",
      icon: "player",
      label: "인원 조건",
      value: `${players.length}/${maxPlayers}명`,
      detail: enoughPlayers ? `최소 ${minPlayers}명 조건을 충족했습니다.` : `최소 ${minPlayers}명이 모이면 시작 조건이 열립니다.`,
      progress: playerProgress,
      tone: enoughPlayers ? "done" : "waiting",
    },
    {
      key: "guests",
      icon: "state",
      label: "게스트 준비",
      value: guestPlayers.length ? `${readyGuestCount}/${guestPlayers.length}명` : "게스트 없음",
      detail: guestPlayers.length
        ? readyGuests
          ? "모든 게스트가 준비되어 방장이 바로 판단할 수 있습니다."
          : "아직 준비하지 않은 게스트가 있어 시작 버튼이 잠깁니다."
        : "1인 세션은 추가 준비 확인 없이 바로 시작할 수 있습니다.",
      progress: guestProgress,
      tone: readyGuests ? "done" : "waiting",
    },
    {
      key: "authority",
      icon: "decision",
      label: "시작 권한",
      value: isHost ? (canStart ? "시작 가능" : "방장") : "방장 대기",
      detail: status === "WAITING"
        ? isHost
          ? canStart
            ? "조건이 맞아서 실제 시작 버튼이 활성화됩니다."
            : "인원과 준비 조건이 맞을 때까지 시작 버튼은 잠깁니다."
          : "방장이 준비 조건을 확인한 뒤 세션을 시작합니다."
        : status === "PLAYING"
          ? "세션이 이미 진행 중이므로 입력 브리지가 핵심입니다."
          : "종료된 세션은 결과 확인과 재입장이 다음 행동입니다.",
      progress: canStart || status !== "WAITING" ? 100 : isHost ? 62 : 38,
      tone: canStart ? "active" : status !== "WAITING" ? "done" : "waiting",
    },
    {
      key: "bridge",
      icon: bridgeReady ? "signal" : "input",
      label: "입력 브리지",
      value: bridgeValue,
      detail: `${transportLabel || "대기"} · ${frameStatusText || "Good_ETC 화면이 준비되면 입력 상태가 연결됩니다."}`,
      progress: bridgeReady ? 100 : status === "PLAYING" ? 62 : 28,
      tone: bridgeReady ? "done" : status === "PLAYING" ? "waiting" : "neutral",
    },
  ];

  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg"
      data-smoke="video-game-room-readiness-panel"
      data-room-status={status || ""}
      data-can-start={canStart ? "true" : "false"}
      data-ready-guests={readyGuests ? "true" : "false"}
      data-bridge-ready={bridgeReady ? "true" : "false"}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <GameUxGlyph type="decision" className="h-4 w-4 text-primary-600" />
            시작 준비
          </div>
          <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
            방장이 무엇을 기다리는지와 Good_ETC 입력 연결 상태를 한 번에 확인합니다.
          </div>
        </div>
        <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black ${startTone === "active" ? "bg-primary-100 text-primary-700" : startTone === "done" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
          {startLabel}
        </span>
      </div>
      <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,330px)_minmax(0,1fr)]">
        <VideoGameRoomReadinessArt items={items} status={status} startTone={startTone} bridgeReady={bridgeReady} />
        <div className="space-y-2">
          {items.map((item) => {
            const tone = videoRoomReadinessToneClasses[item.tone] || videoRoomReadinessToneClasses.neutral;
            return (
              <div key={item.key} className={`rounded-xl border px-3 py-2 ${tone.shell}`} data-smoke="video-game-room-readiness-item">
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tone.icon}`}>
                    <GameUxGlyph type={item.icon} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-black opacity-70">{item.label}</div>
                      <div className="shrink-0 text-xs font-black">{item.value}</div>
                    </div>
                    <div className={`mt-1 line-clamp-2 text-[11px] font-bold leading-relaxed ${tone.detail}`}>{item.detail}</div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/80">
                      <span className={`block h-full rounded-full ${tone.bar}`} style={{ width: `${item.progress}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

const videoGameTacticalPalettes = {
  arena: { bg: "#020617", primary: "#22d3ee", secondary: "#34d399", accent: "#f97316", text: "#ecfeff" },
  fortress: { bg: "#0f172a", primary: "#f59e0b", secondary: "#38bdf8", accent: "#ef4444", text: "#fffbeb" },
  defense: { bg: "#052e16", primary: "#22c55e", secondary: "#84cc16", accent: "#f97316", text: "#f0fdf4" },
  kart: { bg: "#111827", primary: "#f97316", secondary: "#38bdf8", accent: "#fde047", text: "#fff7ed" },
  bomb: { bg: "#18181b", primary: "#fb7185", secondary: "#f97316", accent: "#facc15", text: "#fff1f2" },
  snake: { bg: "#052e16", primary: "#bef264", secondary: "#22c55e", accent: "#fb7185", text: "#f7fee7" },
  coin: { bg: "#0c4a6e", primary: "#fde047", secondary: "#fb923c", accent: "#38bdf8", text: "#fffbeb" },
  rpg: { bg: "#1e1b4b", primary: "#c084fc", secondary: "#22c55e", accent: "#facc15", text: "#faf5ff" },
};

const VideoGameTacticalScene = ({ videoGameCode, pressedControlLabel }) => {
  const palette = videoGameTacticalPalettes[videoGameCode] || videoGameTacticalPalettes.arena;
  const signalLabel = pressedControlLabel ? "입력 중" : "준비";

  return (
    <svg
      viewBox="0 0 360 180"
      className="h-full min-h-[180px] w-full"
      data-smoke="video-game-tactical-scene"
      role="img"
      aria-label={`비디오게임 전술 장면, ${signalLabel}`}
    >
      <rect width="360" height="180" rx="22" fill={palette.bg} />
      <path d="M20 146h320M38 118h284M58 90h244M82 62h196" stroke={palette.text} strokeWidth="1.8" opacity=".12" />
      <path d="M52 144C82 72 120 124 150 82s70-28 106-48 54 4 78 42" fill="none" stroke={palette.primary} strokeWidth="3" strokeDasharray="7 8" opacity=".55" />
      <g transform="translate(44 126)">
        <rect x="-20" y="-20" width="40" height="40" rx="12" fill="rgba(255,255,255,.08)" stroke={palette.secondary} strokeWidth="3" />
        <path d="M0-13v26M-13 0h26" stroke={palette.text} strokeWidth="4" strokeLinecap="round" opacity=".9" />
      </g>
      <g transform="translate(306 36)">
        <rect x="-32" y="-14" width="64" height="28" rx="14" fill="rgba(255,255,255,.1)" stroke={palette.primary} strokeWidth="2" />
        <text y="5" textAnchor="middle" fill={palette.text} fontSize="11" fontWeight="900">{signalLabel}</text>
      </g>

      {videoGameCode === "fortress" ? (
        <g>
          <g transform="translate(92 132)">
            <rect x="-28" y="-12" width="56" height="22" rx="9" fill={palette.primary} stroke={palette.text} strokeWidth="3" />
            <path d="M8-13 54-42" stroke={palette.primary} strokeWidth="9" strokeLinecap="round" />
            <circle cx="-16" cy="14" r="8" fill="#020617" />
            <circle cx="16" cy="14" r="8" fill="#020617" />
          </g>
          <path d="M142 90C182 18 238 24 282 102" fill="none" stroke={palette.text} strokeWidth="4" strokeDasharray="7 7" opacity=".75" />
          <circle cx="282" cy="102" r="11" fill={palette.accent} stroke={palette.text} strokeWidth="3" />
        </g>
      ) : videoGameCode === "defense" ? (
        <g>
          <path d="M50 54c54 4 56 74 116 70s72-68 122-42" fill="none" stroke={palette.secondary} strokeWidth="18" strokeLinecap="round" opacity=".22" />
          {[108, 182, 248].map((x, index) => (
            <g key={x} transform={`translate(${x} ${index === 1 ? 86 : 116})`}>
              <path d="M-18 18h36L12-16h-24Z" fill={palette.primary} stroke={palette.text} strokeWidth="3" />
              <circle cy="-20" r="11" fill={palette.bg} stroke={palette.secondary} strokeWidth="4" />
              <path d="M0-20 24-34" stroke={palette.secondary} strokeWidth="5" strokeLinecap="round" />
            </g>
          ))}
          {[66, 144, 224, 292].map((x, index) => <circle key={x} cx={x} cy={62 + (index % 2) * 48} r="9" fill={palette.accent} />)}
        </g>
      ) : videoGameCode === "kart" ? (
        <g>
          <path d="M56 130C92 52 154 164 212 82s88-12 104 18" fill="none" stroke="#020617" strokeWidth="34" strokeLinecap="round" />
          <path d="M56 130C92 52 154 164 212 82s88-12 104 18" fill="none" stroke={palette.text} strokeWidth="4" strokeDasharray="10 10" strokeLinecap="round" />
          <g transform="translate(154 112) rotate(16)">
            <rect x="-28" y="-15" width="56" height="30" rx="10" fill={palette.primary} stroke={palette.text} strokeWidth="3" />
            <circle cx="-18" cy="17" r="7" fill="#020617" />
            <circle cx="18" cy="17" r="7" fill="#020617" />
          </g>
          <path d="m252 42 9 16 18 2-13 12 4 18-18-9-16 9 3-18-13-12 18-2Z" fill={palette.accent} stroke={palette.text} strokeWidth="2" />
        </g>
      ) : videoGameCode === "bomb" ? (
        <g>
          {Array.from({ length: 6 }, (_, x) => Array.from({ length: 4 }, (_, y) => (
            <rect key={`${x}-${y}`} x={92 + x * 33} y={44 + y * 24} width="22" height="17" rx="5" fill={x % 2 === y % 2 ? "#27272a" : "#3f3f46"} stroke="#71717a" />
          )))}
          <path d="M202 40 211 78 250 64 224 92 252 116 214 108 202 148 190 108 152 116 180 92 154 64 193 78Z" fill={palette.secondary} opacity=".9" />
          <circle cx="202" cy="94" r="21" fill={palette.accent} />
          <circle cx="112" cy="80" r="15" fill="#020617" stroke={palette.text} strokeWidth="3" />
        </g>
      ) : videoGameCode === "snake" ? (
        <g>
          {[[88, 128], [112, 126], [136, 112], [160, 112], [184, 92], [208, 92], [232, 74], [256, 74]].map(([x, y], index, arr) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={index === arr.length - 1 ? 17 : 14} fill={index === arr.length - 1 ? palette.primary : palette.secondary} stroke={palette.text} strokeWidth="3" />
          ))}
          <circle cx="262" cy="70" r="3" fill={palette.bg} />
          <circle cx="256" cy="66" r="3" fill={palette.bg} />
          <circle cx="112" cy="50" r="12" fill={palette.accent} stroke={palette.text} strokeWidth="3" />
        </g>
      ) : videoGameCode === "coin" ? (
        <g>
          <path d="M72 132h244M108 98h74M210 70h78" stroke="#7c2d12" strokeWidth="13" strokeLinecap="round" opacity=".7" />
          {[112, 146, 218, 252, 286].map((x, index) => (
            <g key={x} transform={`translate(${x} ${index < 2 ? 80 : 52})`}>
              <circle r="14" fill={palette.primary} stroke={palette.text} strokeWidth="3" />
              <path d="M-4-6h9M-5 0h10M0 8V-8" stroke="#a16207" strokeWidth="2.4" strokeLinecap="round" />
            </g>
          ))}
          <rect x="156" y="110" width="34" height="38" rx="13" fill="#020617" stroke={palette.text} strokeWidth="3" />
        </g>
      ) : videoGameCode === "rpg" ? (
        <g>
          <path d="M80 136 124 80l34 18 44-52 36 36 34-22 36 76Z" fill="#064e3b" stroke={palette.secondary} strokeWidth="4" />
          <g transform="translate(150 116)">
            <circle cy="-32" r="13" fill="#fef3c7" />
            <path d="M-14-16h28l8 42h-44Z" fill={palette.primary} stroke={palette.text} strokeWidth="3" />
            <path d="M16-4 40-24" stroke={palette.accent} strokeWidth="5" strokeLinecap="round" />
          </g>
          <path d="m250 40 10 18 20 3-15 14 4 20-19-9-18 9 3-20-15-14 20-3Z" fill={palette.accent} stroke={palette.text} strokeWidth="2" />
        </g>
      ) : (
        <g>
          <circle cx="182" cy="90" r="58" fill={palette.primary} opacity=".12" />
          <g transform="translate(138 110) rotate(-18)">
            <path d="M0-18 42 0 0 18 8 0Z" fill={palette.primary} stroke={palette.text} strokeWidth="3" />
            <circle cx="11" cy="0" r="6" fill={palette.bg} />
          </g>
          <g transform="translate(238 60) rotate(152)">
            <path d="M0-16 36 0 0 16 8 0Z" fill={palette.secondary} stroke={palette.text} strokeWidth="3" />
            <circle cx="10" cy="0" r="5" fill={palette.bg} />
          </g>
          <path d="M162 96 218 70" stroke={palette.accent} strokeWidth="6" strokeLinecap="round" />
          <circle cx="224" cy="67" r="9" fill={palette.accent} stroke={palette.text} strokeWidth="3" />
        </g>
      )}
    </svg>
  );
};

const VideoGameTacticalBrief = ({
  videoGameCode,
  profile,
  status,
  players,
  selectedRoom,
  pressedControlLabel,
  transportLabel,
  frameStatusText,
  directionControls,
  actionControls,
}) => {
  const playBrief = videoGamePlayBriefs[videoGameCode] || {};
  const hudBrief = videoGameStageHudBriefs[videoGameCode] || {};
  const actionText = compactControlList(actionControls.length ? actionControls : profile.controls) || "게임 입력";
  const directionText = compactControlList(directionControls) || "액션 중심";
  const playerCount = `${players.length}/${selectedRoom?.maxPlayers || profile.maxPlayers}명`;
  const lanes = [
    {
      key: "read",
      icon: "decision",
      label: "첫 판단",
      value: playBrief.rhythm || profile.title,
      detail: hudBrief.mission || playBrief.objective || frameStatusText,
    },
    {
      key: "input",
      icon: "input",
      label: "입력 리듬",
      value: pressedControlLabel || actionText,
      detail: `${directionText} · ${pressedControlLabel ? "현재 입력이 전술 장면에 반영됩니다." : playBrief.input || "시작 후 입력 브리지가 활성화됩니다."}`,
    },
    {
      key: "danger",
      icon: "stage",
      label: "위험 신호",
      value: status === "PLAYING" ? "실시간 확인" : "시작 전 확인",
      detail: hudBrief.danger || "상태와 입력을 함께 확인하세요.",
    },
    {
      key: "reward",
      icon: "win",
      label: "보상 기준",
      value: playerCount,
      detail: `${hudBrief.reward || "좋은 입력 리듬이 결과를 만듭니다."} · ${transportLabel}`,
    },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg" data-smoke="video-game-tactical-brief">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="bg-slate-950 p-3">
          <VideoGameTacticalScene videoGameCode={videoGameCode} pressedControlLabel={pressedControlLabel} />
        </div>
        <div className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                <GameUxGlyph type="stage" className="h-4 w-4 text-primary-600" />
                전술 브리프
              </div>
              <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
                본게임 화면에 들어가기 전 목표, 입력, 위험, 보상 기준을 한 장면으로 확인합니다.
              </div>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">
              {statusLabel[status] || status || "대기"}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {lanes.map((lane) => (
              <div key={lane.key} className="min-h-[100px] rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" data-smoke="video-game-tactical-lane">
                <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500">
                  <GameUxGlyph type={lane.icon} className="h-3.5 w-3.5" />
                  {lane.label}
                </div>
                <div className="mt-1 line-clamp-2 text-sm font-black leading-snug text-slate-950">{lane.value}</div>
                <div className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-slate-600">{lane.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const VideoGameSignalBridgeArt = ({ status, isHost, bridgeReady, pressedControlLabel, transportLabel }) => {
  const active = status === "PLAYING";
  const accent = bridgeReady ? "#10b981" : active ? "#f59e0b" : "#64748b";
  const roleLabel = isHost ? "방장" : "참가";
  const inputLabel = pressedControlLabel ? "입력" : active ? "준비" : "대기";
  const transport = String(transportLabel || "실시간").replace(/STOMP/gi, "실시간").slice(0, 10);

  return (
    <svg
      viewBox="0 0 420 190"
      className="h-full min-h-[190px] w-full"
      role="img"
      aria-label="Good ETC 입력 브리지 흐름"
      data-smoke="video-game-signal-bridge-art"
    >
      <rect width="420" height="190" rx="24" fill="#0f172a" />
      <path d="M32 144h356M48 106h324M66 68h288" stroke="#e2e8f0" strokeWidth="2" opacity=".08" />
      <path d="M78 96C126 48 180 48 220 96s92 44 142-4" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" opacity=".55" />
      <path d="M116 96h64M252 96h64" stroke="#f8fafc" strokeWidth="4" strokeLinecap="round" strokeDasharray="9 8" opacity={active ? ".72" : ".34"} />
      <g transform="translate(78 96)">
        <rect x="-48" y="-34" width="96" height="68" rx="20" fill="#111827" stroke={accent} strokeWidth="3" />
        <circle cx="-22" cy="0" r="14" fill={accent} opacity=".95" />
        <path d="M-28 0h12M-22-6v12" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
        <text x="14" y="-2" fill="#f8fafc" fontSize="13" fontWeight="900">{roleLabel}</text>
        <text x="14" y="16" fill="#cbd5e1" fontSize="10" fontWeight="800">좌석</text>
      </g>
      <g transform="translate(210 96)">
        <rect x="-52" y="-40" width="104" height="80" rx="22" fill="#f8fafc" stroke={accent} strokeWidth="3" />
        <rect x="-30" y="-22" width="60" height="44" rx="12" fill="#0f172a" />
        <path d="M-14 2 0-12 14 2M0-12v28" stroke={accent} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <text y="54" textAnchor="middle" fill="#f8fafc" fontSize="11" fontWeight="900">{inputLabel}</text>
      </g>
      <g transform="translate(342 96)">
        <rect x="-48" y="-34" width="96" height="68" rx="20" fill="#111827" stroke="#38bdf8" strokeWidth="3" />
        <path d="M-20 12c14-28 26-28 40 0M-31 20c20-44 42-44 62 0" fill="none" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
        <circle cy="16" r="6" fill={accent} />
        <text y="-12" textAnchor="middle" fill="#f8fafc" fontSize="11" fontWeight="900">{transport}</text>
      </g>
      <g transform="translate(210 28)">
        <rect x="-86" y="-14" width="172" height="28" rx="14" fill={active ? "rgba(16,185,129,.18)" : "rgba(148,163,184,.16)"} stroke={accent} strokeWidth="2" />
        <text y="5" textAnchor="middle" fill="#f8fafc" fontSize="11" fontWeight="900">{bridgeReady ? "게임화면 연결" : active ? "연결 대기" : "대기방"}</text>
      </g>
    </svg>
  );
};

const VideoGameSignalBridgePanel = ({
  status,
  isHost,
  mySeatNo,
  roomCode,
  players,
  selectedRoom,
  pressedControlLabel,
  transportLabel,
  frameStatusText,
  gameFrameSrc,
}) => {
  const maxPlayers = Number(selectedRoom?.maxPlayers || 1);
  const bridgeReady = status === "PLAYING" && Boolean(gameFrameSrc);
  const playerValue = `${players.length}/${maxPlayers}명`;
  const roleValue = isHost ? "방장 프레임" : "참가자 입력";
  const inputValue = pressedControlLabel || (status === "PLAYING" ? "입력 대기" : "시작 후 활성");
  const bridgeValue = bridgeReady ? "iframe 연결" : status === "PLAYING" ? "연결 대기" : "시작 대기";
  const items = [
    {
      key: "role",
      icon: "player",
      label: "내 역할",
      value: roleValue,
      detail: isHost ? "원본 Good_ETC 화면 상태를 방으로 중계하는 기준 좌석입니다." : "내 터치 입력을 방장 화면과 방 상태 흐름으로 전달합니다.",
      tone: isHost ? "border-cyan-200 bg-cyan-50 text-cyan-900" : "border-violet-200 bg-violet-50 text-violet-900",
    },
    {
      key: "room",
      icon: "state",
      label: "방 신호",
      value: roomCode ? `코드 ${roomCode}` : playerValue,
      detail: `좌석 ${mySeatNo || "-"} · 참가 ${playerValue} · 상태 ${statusLabel[status] || status || "대기"}`,
      tone: "border-slate-200 bg-slate-50 text-slate-900",
    },
    {
      key: "input",
      icon: "input",
      label: "입력 상태",
      value: inputValue,
      detail: pressedControlLabel ? "누른 조작이 Good_ETC 화면으로 전달되는 중입니다." : "입력은 실제 게임 시작 뒤 iframe 준비 상태에 맞춰 전달됩니다.",
      tone: pressedControlLabel ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900",
    },
    {
      key: "bridge",
      icon: "signal",
      label: "브리지",
      value: bridgeValue,
      detail: `${transportLabel || "대기"} · ${frameStatusText}`,
      tone: bridgeReady ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-900",
    },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg" data-smoke="video-game-signal-bridge-panel">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,.95fr)_minmax(0,1.05fr)]">
        <div className="bg-slate-950 p-3">
          <VideoGameSignalBridgeArt
            status={status}
            isHost={isHost}
            bridgeReady={bridgeReady}
            pressedControlLabel={pressedControlLabel}
            transportLabel={transportLabel}
          />
        </div>
        <div className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                <GameUxGlyph type="signal" className="h-4 w-4 text-emerald-600" />
                입력 브리지 흐름
              </div>
              <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
                내 조작, iframe 준비, STOMP 동기화가 어느 단계에 있는지 실제 게임 화면 바로 전에 확인합니다.
              </div>
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-black ${bridgeReady ? "bg-emerald-100 text-emerald-700" : status === "PLAYING" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
              {bridgeValue}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <div key={item.key} className={`min-h-[98px] rounded-xl border px-3 py-2 ${item.tone}`} data-smoke="video-game-signal-bridge-item">
                <div className="flex items-center gap-1.5 text-[10px] font-black opacity-70">
                  <GameUxGlyph type={item.icon} className="h-3.5 w-3.5" />
                  {item.label}
                </div>
                <div className="mt-1 line-clamp-2 text-sm font-black leading-snug">{item.value}</div>
                <div className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed opacity-70">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const videoInputTraceToneClasses = {
  done: "border-emerald-200 bg-emerald-50 text-emerald-950",
  pending: "border-cyan-200 bg-cyan-50 text-cyan-950",
  error: "border-rose-200 bg-rose-50 text-rose-950",
  waiting: "border-amber-200 bg-amber-50 text-amber-950",
  idle: "border-slate-200 bg-slate-50 text-slate-950",
};

const VideoGameInputTraceArt = ({ status, feedbackStatus, pressedControlLabel, bridgeReady, transportLabel }) => {
  const stageActive = status === "PLAYING";
  const failed = feedbackStatus === "error";
  const pending = feedbackStatus === "pending";
  const done = feedbackStatus === "done";
  const accent = failed ? "#f43f5e" : pending ? "#06b6d4" : done || bridgeReady ? "#10b981" : stageActive ? "#f59e0b" : "#64748b";
  const nodes = [
    { key: "touch", label: pressedControlLabel ? "누름" : "대기", x: 56, active: Boolean(pressedControlLabel) || pending || done, tone: "#38bdf8" },
    { key: "parent", label: failed ? "차단" : "전달", x: 152, active: pending || done || failed, tone: accent },
    { key: "frame", label: bridgeReady ? "화면" : "준비", x: 248, active: bridgeReady, tone: "#22c55e" },
    { key: "sync", label: transportLabel ? "동기" : "대기", x: 344, active: stageActive || done, tone: "#a78bfa" },
  ];

  return (
    <svg
      viewBox="0 0 400 172"
      className="h-full min-h-[172px] w-full"
      role="img"
      aria-label="비디오게임 입력 추적 경로"
      data-smoke="video-game-input-trace-art"
    >
      <rect width="400" height="172" rx="24" fill="#0f172a" />
      <path d="M24 132h352M36 96h328M48 60h304" stroke="#e2e8f0" strokeWidth="2" opacity=".08" />
      <path d="M58 86H342" stroke="#334155" strokeWidth="14" strokeLinecap="round" />
      <path
        d="M58 86H342"
        stroke={accent}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={bridgeReady || done ? "0" : "10 10"}
        opacity={failed ? ".72" : ".88"}
      />
      {nodes.map((node, index) => (
        <g key={node.key} transform={`translate(${node.x} 86)`} data-smoke="video-game-input-trace-node" data-trace-key={node.key}>
          <circle r={node.active ? 25 : 21} fill={node.active ? node.tone : "#1e293b"} stroke={node.active ? "#f8fafc" : "#64748b"} strokeWidth="4" />
          <text y="-2" textAnchor="middle" fontSize="11" fontWeight="900" fill={node.active ? "#0f172a" : "#cbd5e1"}>{node.label}</text>
          <text y="13" textAnchor="middle" fontSize="8" fontWeight="900" fill={node.active ? "#0f172a" : "#94a3b8"}>{index + 1}</text>
        </g>
      ))}
      <g transform="translate(200 28)">
        <rect x="-104" y="-14" width="208" height="28" rx="14" fill={failed ? "rgba(244,63,94,.18)" : bridgeReady ? "rgba(16,185,129,.18)" : "rgba(148,163,184,.16)"} stroke={accent} strokeWidth="2" />
        <text y="5" textAnchor="middle" fill="#f8fafc" fontSize="11" fontWeight="900">
          {failed ? "입력 전달 확인 필요" : bridgeReady ? "입력 경로 연결" : stageActive ? "프레임 연결 대기" : "시작 전 입력 대기"}
        </text>
      </g>
      <text x="24" y="152" fontSize="10" fontWeight="900" fill="#cbd5e1">터치 입력</text>
      <text x="376" y="152" textAnchor="end" fontSize="10" fontWeight="900" fill="#cbd5e1">{String(transportLabel || "대기").slice(0, 12)}</text>
    </svg>
  );
};

const VideoGameInputTracePanel = ({
  status,
  inputFeedback,
  pressedControlLabel,
  transportLabel,
  frameStatusText,
  gameFrameSrc,
}) => {
  const feedbackStatus = inputFeedback?.status || "idle";
  const bridgeReady = status === "PLAYING" && Boolean(gameFrameSrc);
  const deliveryLabel = readableVideoInputFeedbackStatusLabel(feedbackStatus);
  const latestInput = pressedControlLabel || inputFeedback?.message || "입력 대기";
  const traceItems = [
    {
      key: "control",
      icon: "input",
      label: "최근 조작",
      value: latestInput,
      detail: pressedControlLabel ? "누르고 있는 조작을 즉시 확인합니다." : inputFeedback?.detail || "아직 전달된 입력이 없습니다.",
      tone: pressedControlLabel ? "pending" : feedbackStatus === "done" ? "done" : "idle",
    },
    {
      key: "delivery",
      icon: feedbackStatus === "error" ? "recent" : "signal",
      label: "전달 판정",
      value: deliveryLabel,
      detail: inputFeedback?.label || "입력 브리지가 다음 신호를 기다립니다.",
      tone: feedbackStatus === "error" ? "error" : feedbackStatus === "pending" ? "pending" : feedbackStatus === "done" ? "done" : "idle",
    },
    {
      key: "frame",
      icon: "stage",
      label: "화면 수신",
      value: bridgeReady ? "수신 가능" : status === "PLAYING" ? "연결 확인" : "시작 후 활성",
      detail: frameStatusText,
      tone: bridgeReady ? "done" : status === "PLAYING" ? "waiting" : "idle",
    },
    {
      key: "sync",
      icon: "signal",
      label: "동기화",
      value: transportLabel || "대기",
      detail: bridgeReady ? "iframe과 방 신호가 같은 세션을 보고 있습니다." : "방 상태가 시작되면 동기화 경로가 열립니다.",
      tone: bridgeReady ? "done" : "idle",
    },
  ];

  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg"
      data-smoke="video-game-input-trace-panel"
      data-input-status={feedbackStatus}
      data-stage-status={status || ""}
      data-frame-ready={bridgeReady ? "true" : "false"}
    >
      <div className="grid gap-0 lg:grid-cols-[minmax(0,.95fr)_minmax(0,1.05fr)]">
        <div className="bg-slate-950 p-3">
          <VideoGameInputTraceArt
            status={status}
            feedbackStatus={feedbackStatus}
            pressedControlLabel={pressedControlLabel}
            bridgeReady={bridgeReady}
            transportLabel={transportLabel}
          />
        </div>
        <div className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                <GameUxGlyph type="input" className="h-4 w-4 text-cyan-600" />
                입력 추적
              </div>
              <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
                버튼 입력이 부모 브리지, Good_ETC 화면, 방 동기화까지 어디에 있는지 바로 확인합니다.
              </div>
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-black ${feedbackStatus === "error" ? "bg-rose-100 text-rose-700" : bridgeReady || feedbackStatus === "done" ? "bg-emerald-100 text-emerald-700" : feedbackStatus === "pending" ? "bg-cyan-100 text-cyan-700" : "bg-slate-100 text-slate-600"}`}>
              {deliveryLabel}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {traceItems.map((item) => (
              <div key={item.key} className={`min-h-[100px] rounded-xl border px-3 py-2 ${videoInputTraceToneClasses[item.tone] || videoInputTraceToneClasses.idle}`} data-smoke="video-game-input-trace-item" data-trace-key={item.key}>
                <div className="flex items-center gap-1.5 text-[10px] font-black opacity-70">
                  <GameUxGlyph type={item.icon} className="h-3.5 w-3.5" />
                  {item.label}
                </div>
                <div className="mt-1 line-clamp-2 text-sm font-black leading-snug">{item.value}</div>
                <div className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed opacity-70">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const videoSyncRailTone = ({ host, ready, mine, playing, finished }) => {
  if (finished) return { fill: "#f59e0b", stroke: "#92400e", text: "#fffbeb", label: "결과" };
  if (playing && mine) return { fill: "#10b981", stroke: "#047857", text: "#ecfdf5", label: "내 입력" };
  if (host) return { fill: "#38bdf8", stroke: "#0369a1", text: "#f0f9ff", label: "방장" };
  if (ready) return { fill: "#22c55e", stroke: "#15803d", text: "#f0fdf4", label: "준비" };
  if (mine) return { fill: "#e0f2fe", stroke: "#0284c7", text: "#0f172a", label: "내 좌석" };
  return { fill: "#f8fafc", stroke: "#94a3b8", text: "#0f172a", label: "대기" };
};

const VideoGameSyncRailArt = ({ players, selectedRoom, status, mySeatNo, bridgeReady }) => {
  const maxPlayers = Math.max(1, Math.min(Number(selectedRoom?.maxPlayers || players.length || 1), 8));
  const slots = Array.from({ length: maxPlayers });
  const pathPoints = slots.map((_, index) => {
    const x = 34 + (maxPlayers === 1 ? 150 : (index * 300) / (maxPlayers - 1));
    const y = 68 + (index % 2 === 0 ? -12 : 12);
    return `${x},${y}`;
  });
  const routePath = `M ${pathPoints.join(" L ")}`;
  const finished = status === "FINISHED";
  const playing = status === "PLAYING";

  return (
    <svg
      viewBox="0 0 360 136"
      className="h-full w-full"
      role="img"
      aria-label="비디오게임 참가자 동기화 레일"
      data-smoke="video-game-sync-rail-art"
    >
      <rect x="8" y="8" width="344" height="120" rx="24" fill="#0f172a" />
      <path d="M22 104 C78 44 130 112 180 66 S276 40 338 82" fill="none" stroke="#1e293b" strokeWidth="18" strokeLinecap="round" />
      <path d={routePath} fill="none" stroke={bridgeReady ? "#22c55e" : playing ? "#38bdf8" : "#64748b"} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      {slots.map((_, index) => {
        const player = players[index];
        const memberId = getVideoGameMemberId(player);
        const seatNo = getVideoGameSeatNo(player) || index + 1;
        const host = Boolean(player && Number(selectedRoom?.hostMemberId) === memberId);
        const ready = Boolean(player && (host || isVideoGameReadyPlayer(player)));
        const mine = Boolean(player && Number(mySeatNo) === seatNo);
        const tone = player ? videoSyncRailTone({ host, ready, mine, playing, finished }) : { fill: "#1e293b", stroke: "#475569", text: "#cbd5e1", label: "빈 좌석" };
        const x = 34 + (maxPlayers === 1 ? 150 : (index * 300) / (maxPlayers - 1));
        const y = 68 + (index % 2 === 0 ? -12 : 12);
        return (
          <g key={`${seatNo}-${index}`} transform={`translate(${x} ${y})`} data-smoke="video-game-sync-rail-node">
            <circle r={player && (mine || host || playing) ? 18 : 15} fill={tone.fill} stroke={tone.stroke} strokeWidth="4" />
            <rect x="-8" y="-7" width="16" height="14" rx="5" fill={tone.text} opacity={player ? ".95" : ".45"} />
            <text x="0" y="34" textAnchor="middle" fontSize="9" fontWeight="900" fill="#e2e8f0">{player ? seatNo : index + 1}</text>
          </g>
        );
      })}
      <text x="24" y="30" fontSize="10" fontWeight="900" fill="#cbd5e1">동기화 레일</text>
      <text x="336" y="30" textAnchor="end" fontSize="10" fontWeight="900" fill="#cbd5e1">{bridgeReady ? "게임화면 준비" : statusLabel[status] || status || "대기"}</text>
    </svg>
  );
};

const VideoGameSyncRailPanel = ({
  profile,
  selectedRoom,
  players,
  status,
  mySeatNo,
  guestPlayers,
  readyGuestCount,
  canStart,
  transportLabel,
  pressedControlLabel,
  gameFrameSrc,
}) => {
  const maxPlayers = Number(selectedRoom?.maxPlayers || profile?.maxPlayers || 1);
  const bridgeReady = status === "PLAYING" && Boolean(gameFrameSrc);
  const readySummary = guestPlayers.length ? `${readyGuestCount}/${guestPlayers.length}명 준비` : "솔로 시작 가능";
  const syncSummary = status === "PLAYING"
    ? (bridgeReady ? "입력 브리지 연결" : "프레임 준비 중")
    : status === "FINISHED"
      ? "세션 종료"
      : canStart
        ? "시작 가능"
        : readySummary;
  const detailText = status === "PLAYING"
    ? "참가자 좌석, 내 입력 주체, Good_ETC 프레임 연결 상태를 같은 레일에서 확인합니다."
    : "방장이 누구인지, 누가 준비됐는지, 빈 좌석이 남았는지 시작 전에 확인합니다.";
  const tiles = [
    {
      key: "players",
      icon: "player",
      label: "참가자",
      value: `${players.length}/${maxPlayers || "-"}명`,
      detail: `내 좌석 ${mySeatNo || "-"} · ${readySummary}`,
    },
    {
      key: "ready",
      icon: "state",
      label: "준비",
      value: canStart ? "시작 가능" : readySummary,
      detail: status === "WAITING" ? "게스트 준비가 맞으면 방장이 시작할 수 있습니다." : statusLabel[status] || status || "대기",
    },
    {
      key: "input",
      icon: "input",
      label: "입력 주체",
      value: pressedControlLabel || (status === "PLAYING" ? "프레임 조작" : "입력 대기"),
      detail: bridgeReady ? "모바일 조작과 iframe 입력이 연결됩니다." : "시작 후 Good_ETC 화면이 입력을 받습니다.",
    },
    {
      key: "sync",
      icon: "signal",
      label: "동기화",
      value: transportLabel,
      detail: syncSummary,
    },
  ];

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg" data-smoke="video-game-sync-rail-panel">
      <div className="grid gap-3 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="min-h-[136px] overflow-hidden rounded-2xl bg-slate-950" data-smoke="video-game-sync-rail-art-wrap">
          <VideoGameSyncRailArt
            players={players}
            selectedRoom={selectedRoom}
            status={status}
            mySeatNo={mySeatNo}
            bridgeReady={bridgeReady}
          />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                <GameUxGlyph type="signal" className="h-4 w-4 text-cyan-600" />
                참가자 동기화
              </div>
              <p className="mt-1 text-xs font-bold leading-relaxed text-slate-600">{detailText}</p>
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600" data-smoke="video-game-sync-rail-summary">
              {syncSummary}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {tiles.map((tile) => (
              <div key={tile.key} className="min-h-[92px] rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" data-smoke="video-game-sync-rail-tile">
                <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500">
                  <GameUxGlyph type={tile.icon} className="h-3.5 w-3.5" />
                  {tile.label}
                </div>
                <div className="mt-1 line-clamp-2 text-sm font-black leading-snug text-slate-950">{tile.value}</div>
                <div className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-slate-600">{tile.detail}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {players.map((player, index) => {
              const memberId = getVideoGameMemberId(player);
              const seatNo = getVideoGameSeatNo(player);
              const host = Number(selectedRoom?.hostMemberId) === memberId;
              const ready = host || isVideoGameReadyPlayer(player);
              const mine = Number(mySeatNo) === seatNo;
              const tone = videoSyncRailTone({ host, ready, mine, playing: status === "PLAYING", finished: status === "FINISHED" });
              return (
                <div key={memberId || seatNo || index} className="rounded-xl border border-slate-100 bg-white px-3 py-2" data-smoke="video-game-sync-rail-player">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <UserAvatar name={player.nickname} profileUrl={player.profileUrl} size="xs" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-slate-900">{player.nickname}</div>
                        <div className="text-[11px] font-bold text-slate-500">좌석 {seatNo || "-"}{host ? " · 방장" : ""}</div>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full px-2 py-1 text-[10px] font-black" style={{ backgroundColor: tone.fill, color: tone.text }}>
                      {tone.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

const videoSessionRoutePalette = {
  state: { fill: "#eff6ff", stroke: "#2563eb", accent: "#38bdf8", text: "#1e3a8a" },
  ready: { fill: "#ecfdf5", stroke: "#059669", accent: "#34d399", text: "#065f46" },
  primary: { fill: "#fffbeb", stroke: "#d97706", accent: "#f59e0b", text: "#92400e" },
  sync: { fill: "#f8fafc", stroke: "#475569", accent: "#94a3b8", text: "#334155" },
};

const buildVideoGameSessionRouteItems = ({
  status,
  isHost,
  canStart,
  busy,
  players,
  guestPlayers,
  readyGuestCount,
  gameFrameSrc,
  transportLabel,
}) => {
  const normalizedStatus = status || "WAITING";
  const frameReady = Boolean(gameFrameSrc);
  const totalGuests = guestPlayers.length;
  const readyText = totalGuests ? `게스트 준비 ${readyGuestCount}/${totalGuests}` : "1인 시작 가능";
  const primaryValue = busy
    ? "요청 처리 중"
    : normalizedStatus === "WAITING" && isHost
      ? (canStart ? "게임 시작 가능" : "게임 시작 잠김")
      : normalizedStatus === "WAITING"
        ? "준비 상태 변경"
        : normalizedStatus === "PLAYING" && isHost
          ? "대기방으로 종료"
          : normalizedStatus === "PLAYING"
            ? "플레이 진행 중"
            : normalizedStatus === "FINISHED"
              ? "결과 확인"
              : "상태 확인";
  const primaryDetail = busy
    ? "요청 처리 중에는 버튼이 잠시 잠기므로 중복 실행을 막습니다."
    : normalizedStatus === "WAITING" && isHost && canStart
      ? "방장은 게임 시작 버튼으로 Good_ETC 화면을 열 수 있습니다."
      : normalizedStatus === "WAITING" && isHost
        ? "인원과 게스트 준비가 맞아야 게임 시작 버튼이 열립니다."
        : normalizedStatus === "WAITING"
          ? "게스트는 준비 상태 변경으로 시작 조건을 맞춥니다."
          : normalizedStatus === "PLAYING" && isHost
            ? "방장은 대기방으로 종료 버튼으로 세션을 정리할 수 있습니다."
            : normalizedStatus === "PLAYING"
              ? "플레이 중에는 방 나가기를 숨기고 입력 화면에 집중합니다."
              : normalizedStatus === "FINISHED"
                ? "결과와 세션 정리 패널에서 다음 행동을 고릅니다."
                : "상태 동기화로 최신 버튼 상태를 다시 확인합니다.";

  return [
    {
      key: "state",
      icon: normalizedStatus === "FINISHED" ? "win" : "state",
      label: "현재 상태",
      short: statusLabel[normalizedStatus] || normalizedStatus || "대기",
      value: statusLabel[normalizedStatus] || normalizedStatus || "대기",
      detail: normalizedStatus === "PLAYING"
        ? "게임 화면과 입력 브리지가 활성 상태입니다."
        : normalizedStatus === "FINISHED"
          ? "결과 검토와 방 정리를 진행할 수 있습니다."
          : "대기방에서 인원과 준비 상태를 맞추는 단계입니다.",
    },
    {
      key: "ready",
      icon: "player",
      label: "준비 조건",
      short: canStart ? "충족" : "확인",
      value: canStart ? "시작 조건 충족" : readyText,
      detail: canStart
        ? `${players.length}명이 입장했고 시작 버튼을 누를 수 있습니다.`
        : totalGuests
          ? `${readyText}입니다. 모든 게스트가 준비되면 방장 시작 조건이 맞습니다.`
          : "혼자 플레이 가능한 설정이면 방장이 바로 시작할 수 있습니다.",
    },
    {
      key: "primary",
      icon: "decision",
      label: "실제 버튼",
      short: isHost ? "방장" : "참가",
      value: primaryValue,
      detail: primaryDetail,
    },
    {
      key: "sync",
      icon: "signal",
      label: "동기화",
      short: frameReady ? "화면" : "대기",
      value: transportLabel || "대기",
      detail: frameReady
        ? "상태 동기화 버튼은 최신 방 정보와 플레이 화면 상태를 다시 읽습니다."
        : "상태 동기화와 방 나가기는 플레이 화면 없이도 현재 방 상태를 정리합니다.",
    },
  ];
};

const VideoGameSessionRouteArt = ({ items, status, canStart, isHost, frameReady }) => {
  const statusText = statusLabel[status] || status || "대기";
  return (
    <svg
      viewBox="0 0 360 156"
      role="img"
      aria-label="Good_ETC 세션 버튼 루트"
      className="h-full min-h-[150px] w-full"
      data-smoke="video-game-session-route-art"
    >
      <rect x="0" y="0" width="360" height="156" rx="20" fill="#0f172a" />
      <rect x="18" y="18" width="324" height="120" rx="18" fill="#f8fafc" />
      <path d="M48 78 C88 34 122 34 160 78 S232 122 292 78" fill="none" stroke="#cbd5e1" strokeWidth="8" strokeLinecap="round" />
      <path
        d={canStart || status === "PLAYING" ? "M48 78 C88 34 122 34 160 78 S232 122 292 78" : "M48 78 C88 34 122 34 160 78"}
        fill="none"
        stroke={status === "FINISHED" ? "#f59e0b" : canStart || status === "PLAYING" ? "#10b981" : "#38bdf8"}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <text x="28" y="38" fill="#334155" fontSize="14" fontWeight="900">세션 버튼 루트</text>
      <text x="292" y="38" fill="#64748b" fontSize="11" fontWeight="800" textAnchor="end">{isHost ? "방장" : "참가자"}</text>
      <text x="334" y="38" fill="#64748b" fontSize="11" fontWeight="800" textAnchor="end">{frameReady ? "화면 연결" : statusText}</text>
      {items.map((item, index) => {
        const point = [
          { x: 48, y: 78 },
          { x: 132, y: 54 },
          { x: 216, y: 102 },
          { x: 300, y: 78 },
        ][index] || { x: 48 + index * 84, y: 78 };
        const palette = videoSessionRoutePalette[item.key] || videoSessionRoutePalette.sync;
        return (
          <g key={item.key} data-smoke="video-game-session-route-node" data-route-key={item.key}>
            <circle cx={point.x} cy={point.y} r="22" fill={palette.fill} stroke={palette.stroke} strokeWidth="3" />
            <circle cx={point.x} cy={point.y} r="8" fill={palette.accent} />
            <text x={point.x} y={point.y + 38} fill={palette.text} fontSize="11" fontWeight="900" textAnchor="middle">{item.label}</text>
            <text x={point.x} y={point.y + 52} fill="#475569" fontSize="9" fontWeight="800" textAnchor="middle">{item.short}</text>
          </g>
        );
      })}
    </svg>
  );
};

const VideoGameSessionRoutePanel = ({
  status,
  isHost,
  canStart,
  busy,
  players,
  guestPlayers,
  readyGuestCount,
  gameFrameSrc,
  transportLabel,
}) => {
  const routeItems = buildVideoGameSessionRouteItems({
    status,
    isHost,
    canStart,
    busy,
    players,
    guestPlayers,
    readyGuestCount,
    gameFrameSrc,
    transportLabel,
  });
  const frameReady = Boolean(gameFrameSrc);
  const readySummary = canStart
    ? "시작 조건 충족"
    : guestPlayers.length
      ? `게스트 준비 ${readyGuestCount}/${guestPlayers.length}`
      : "준비 상태 확인";

  return (
    <section
      className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3"
      data-smoke="video-game-session-route-panel"
      data-session-status={status || ""}
      data-can-start={canStart ? "true" : "false"}
      data-host={isHost ? "true" : "false"}
      data-busy={busy ? "true" : "false"}
      data-frame-ready={frameReady ? "true" : "false"}
    >
      <div className="grid gap-3 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="min-h-[150px] overflow-hidden rounded-2xl bg-slate-950">
          <VideoGameSessionRouteArt
            items={routeItems}
            status={status}
            canStart={canStart}
            isHost={isHost}
            frameReady={frameReady}
          />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                <GameUxGlyph type="decision" className="h-4 w-4 text-amber-600" />
                세션 버튼 루트
              </div>
              <p className="mt-1 text-xs font-bold leading-relaxed text-slate-600">
                현재 방 상태에서 어떤 하단 버튼을 눌러야 하는지, 그리고 버튼이 잠기는 이유를 실제 버튼 바로 위에서 보여줍니다.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-600 ring-1 ring-slate-200">
              {readySummary}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {routeItems.map((item) => (
              <div
                key={item.key}
                className="min-h-[98px] rounded-xl border border-slate-200 bg-white px-3 py-2"
                data-smoke="video-game-session-route-item"
                data-route-key={item.key}
              >
                <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500">
                  <GameUxGlyph type={item.icon} className="h-3.5 w-3.5" />
                  {item.label}
                </div>
                <div className="mt-1 line-clamp-2 text-sm font-black leading-snug text-slate-950">{item.value}</div>
                <div className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-slate-600">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

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
  const [inputFeedback, setInputFeedback] = useState(initialReadableVideoInputFeedback);
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
  const allControls = profile?.controls || [];
  const pressedControlLabel = pressedControl
    ? (allControls.find((control) => (typeof control === "string" ? control : control.control) === pressedControl)?.label || pressedControl)
    : "";
  const frameStatusText = status === "PLAYING"
    ? "게임 화면이 실행 중입니다."
    : status === "FINISHED"
      ? "게임 세션이 종료되었습니다. 결과를 확인하고 새 방이나 재입장 흐름을 선택하세요."
      : canStart
        ? "조건이 충족되었습니다. 방장이 시작하면 게임 화면이 열립니다."
        : "대기방 상태입니다. 인원과 준비 상태를 맞추면 시작할 수 있습니다.";
  const videoCueTone = status === "FINISHED" ? "done" : status === "PLAYING" || canStart ? "active" : "waiting";
  const videoCueTitle = status === "FINISHED"
    ? "세션 결과 확인"
    : status === "PLAYING"
      ? "Good_ETC 입력 활성"
      : canStart
        ? "시작 준비 완료"
        : "대기방 준비 확인";
  const videoCueAction = status === "FINISHED"
    ? "결과 확인"
    : status === "PLAYING"
      ? (pressedControlLabel ? `${pressedControlLabel} 입력 중` : "게임 화면 집중")
      : canStart
        ? "방장 시작 가능"
        : readyGuests
          ? "방장 시작 대기"
          : "준비 필요";
  const videoCueItems = [
    { label: "상태", value: statusLabel[status] || status || "대기", icon: status === "FINISHED" ? "win" : "state", tone: status === "FINISHED" ? "done" : videoCueTone },
    { label: "행동", value: videoCueAction, icon: "decision", tone: status === "PLAYING" || canStart ? "active" : "neutral" },
    { label: "입력", value: pressedControlLabel || (status === "PLAYING" ? "프레임 조작" : "입력 대기"), icon: "input", tone: pressedControlLabel ? "active" : "neutral" },
    { label: "동기화", value: transportLabel, icon: "signal" },
  ];
  const videoPlayBrief = videoGamePlayBriefs[videoGameCode] || {};
  const videoHudBrief = videoGameStageHudBriefs[videoGameCode] || {};
  const videoResultBreakdown = useMemo(() => buildVideoGameResultBreakdown({
    gameState,
    players,
    selectedRoom,
    profile,
    videoGameCode,
    transportLabel,
    videoPlayBrief,
    videoHudBrief,
  }), [gameState, players, profile, selectedRoom, transportLabel, videoGameCode, videoHudBrief, videoPlayBrief]);
  const videoResultDetail = videoResultBreakdown.detail;
  const videoResultMetric = videoResultBreakdown.metric;
  const playerCapacityText = `${players.length}/${selectedRoom?.maxPlayers || profile.maxPlayers}명`;
  const readinessText = guestPlayers.length ? `게스트 준비 ${readyGuestCount}/${guestPlayers.length}` : "혼자 시작 가능";
  const videoFlowTone = status === "FINISHED" ? "amber" : status === "PLAYING" ? "emerald" : "slate";
  const videoFlowItems = [
    {
      label: "세션",
      value: statusLabel[status] || status || "대기",
      detail: frameStatusText,
      icon: status === "FINISHED" ? "win" : "state",
      tone: status === "FINISHED" ? "done" : status === "PLAYING" ? "active" : canStart ? "waiting" : "neutral",
    },
    {
      label: "미션",
      value: videoPlayBrief.rhythm || profile.title,
      detail: videoHudBrief.mission || videoPlayBrief.objective || profile.storage,
      icon: "stage",
      tone: status === "PLAYING" ? "active" : "neutral",
    },
    {
      label: "입력 브리지",
      value: pressedControlLabel || (status === "PLAYING" ? "입력 대기" : "대기"),
      detail: status === "PLAYING"
        ? (pressedControlLabel ? `${pressedControlLabel} 입력이 Good_ETC 화면으로 전달 중입니다.` : "모바일 버튼 또는 iframe 내부 조작을 준비하세요.")
        : "게임 시작 후 입력 브리지가 활성화됩니다.",
      icon: "input",
      tone: pressedControlLabel ? "active" : status === "PLAYING" ? "waiting" : "neutral",
    },
    {
      label: status === "FINISHED" ? "결과" : "동기화",
      value: status === "FINISHED" ? "세션 종료" : transportLabel,
      detail: status === "FINISHED" ? videoResultDetail : `${playerCapacityText} · ${readinessText} · ${transportLabel}`,
      icon: status === "FINISHED" ? "win" : "signal",
      tone: status === "FINISHED" ? "done" : "neutral",
    },
  ];
  const inputFeedbackTone = inputFeedback.status === "error"
    ? "error"
    : inputFeedback.status === "pending"
      ? "pending"
      : inputFeedback.status === "done"
        ? "done"
        : "idle";
  const videoInputFeedbackItems = useMemo(() => [
    {
      label: "전달 상태",
      value: readableVideoInputFeedbackStatusLabel(inputFeedback.status),
      detail: inputFeedback.label,
      icon: inputFeedback.status === "error" ? "recent" : "signal",
      tone: inputFeedbackTone,
    },
    {
      label: "최근 입력",
      value: inputFeedback.message,
      detail: inputFeedback.detail,
      icon: "input",
      tone: inputFeedback.status === "error" ? "error" : inputFeedback.status === "done" ? "done" : "neutral",
    },
    {
      label: "화면 상태",
      value: statusLabel[status] || status || "대기",
      detail: frameStatusText,
      icon: status === "PLAYING" ? "stage" : "state",
      tone: status === "PLAYING" ? "done" : "neutral",
    },
    {
      label: "브리지",
      value: status === "PLAYING" && selectedRoom ? "iframe 준비" : "시작 대기",
      detail: `${transportLabel} · ${pressedControlLabel || "입력 없음"}`,
      icon: "signal",
      tone: status === "PLAYING" && selectedRoom ? "done" : "neutral",
    },
  ], [frameStatusText, inputFeedback, inputFeedbackTone, pressedControlLabel, selectedRoom, status, transportLabel]);
  const mySeatNo = useMemo(() => {
    const me = players.find((player) => getVideoGameMemberId(player) === myMemberId);
    return getVideoGameSeatNo(me);
  }, [myMemberId, players]);

  useEffect(() => {
    if (profile) {
      setCreateForm({ title: "", maxPlayers: String(profile.maxPlayers), turnTimeSeconds: "30" });
    }
  }, [profile, videoGameCode]);

  useEffect(() => {
    setInputFeedback(initialReadableVideoInputFeedback());
    setPressedControl("");
  }, [roomId, videoGameCode]);

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
        setInputFeedback({
          status: "done",
          label: "iframe 준비 신호",
          message: "게임 화면 준비됨",
          detail: "Good_ETC 화면이 부모 입력 브리지를 받을 준비 신호를 보냈습니다.",
        });
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
    const controlLabel = readableVideoInputControlLabel(control, allControls);
    const bridgeReady = status === "PLAYING" && Boolean(gameFrameSrc) && Boolean(iframeRef.current?.contentWindow);
    setPressedControl(pressed ? control : "");
    if (!bridgeReady) {
      setInputFeedback({
        status: "error",
        label: "입력 브리지 대기",
        message: `${controlLabel} 전달 불가`,
        detail: "게임 화면이 아직 입력을 받을 상태가 아닙니다. 방 상태와 iframe 로딩을 확인하세요.",
      });
    } else {
      setInputFeedback({
        status: pressed ? "pending" : "done",
        label: pressed ? "버튼 입력 유지" : "버튼 입력 해제",
        message: pressed ? `${controlLabel} 입력 중` : `${controlLabel} 입력 해제`,
        detail: pressed
          ? "버튼을 누르고 있는 동안 Good_ETC 화면에 입력 유지 신호를 전달합니다."
          : "버튼을 놓아 입력 해제 신호를 Good_ETC 화면에 전달했습니다.",
      });
    }
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
        <section className="space-y-4" aria-busy={loading ? "true" : "false"}>
          <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
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
            </section>

            <VideoGameJoinCodePanel
              joinCode={joinCode}
              setJoinCode={setJoinCode}
              busy={busy}
              loading={loading}
              joinByCode={joinByCode}
            />
          </aside>

          <main className="space-y-4">
            {loadError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{loadError}</div>
            )}
            <RoomList title="내 참여 방" rooms={myRooms} emptyText="참여 중인 방이 없습니다." gameCode={videoGameCode} onOpen={openRoom} onJoin={joinRoom} busy={busy} mode="mine" />
            <RoomList title="대기 중인 방" rooms={rooms} emptyText={loading ? "방 목록을 불러오는 중입니다." : "대기 중인 방이 없습니다."} gameCode={videoGameCode} onOpen={openRoom} onJoin={joinRoom} busy={busy} />
          </main>
          </div>
        </section>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="space-y-4">
            <section className={`overflow-hidden rounded-2xl bg-gradient-to-br ${profile.tone} p-[1px] shadow-lg`}>
              <div className="rounded-[calc(1rem-1px)] bg-white p-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-center">
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
                </div>
                <div>
                  <button type="button" className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-3 text-sm font-black text-slate-700 hover:bg-slate-900 hover:text-white" onClick={copyRoomCode}>
                    <Copy className="h-4 w-4" />
                    코드 복사
                  </button>
                </div>
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

            {status === "FINISHED" && (
              <>
                <GameResultSpotlight
                  title={videoResultBreakdown.title}
                  subtitle={videoResultBreakdown.subtitle}
                  detail={videoResultDetail}
                  metric={videoResultMetric}
                  tone="slate"
                  smoke="video-game-result-spotlight"
                />
                <VideoGameResultBreakdownPanel breakdown={videoResultBreakdown} />
              </>
            )}

            <GameActionCueBar
              title={videoCueTitle}
              detail={frameStatusText}
              items={videoCueItems}
              tone={videoCueTone}
              smoke="video-game-action-cue-bar"
            />

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg" data-smoke="video-game-stage-shell">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                  <GameUxGlyph type="stage" className="h-4 w-4 text-emerald-600" />
                  본게임
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-500">
                    <RadioTower className="h-3.5 w-3.5 text-cyan-600" />
                    {transportLabel}
                  </div>
                  <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black ${status === "PLAYING" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    <Timer className="h-3.5 w-3.5" />
                    {statusLabel[status] || status}
                  </div>
                </div>
              </div>
              <VideoGameStageHud
                videoGameCode={videoGameCode}
                profile={profile}
                status={status}
                transportLabel={transportLabel}
                pressedControlLabel={pressedControlLabel}
                frameStatusText={frameStatusText}
                gameFrameSrc={gameFrameSrc}
              />
              <VideoGameStageGatePanel
                videoGameCode={videoGameCode}
                profile={profile}
                status={status}
                transportLabel={transportLabel}
                pressedControlLabel={pressedControlLabel}
                frameStatusText={frameStatusText}
                gameFrameSrc={gameFrameSrc}
                players={players}
                selectedRoom={selectedRoom}
              />
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-bold leading-relaxed text-slate-600">
                {frameStatusText}
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
                <VideoGameFrameStandbyPanel
                  videoGameCode={videoGameCode}
                  profile={profile}
                  status={status}
                  canStart={canStart}
                  isHost={isHost}
                  players={players}
                  selectedRoom={selectedRoom}
                  roomCode={roomCode}
                  transportLabel={transportLabel}
                  frameStatusText={frameStatusText}
                  videoResultDetail={videoResultDetail}
                />
              )}
              {gameState?.transport && (
                <div className="m-4 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
                  방 전송 상태: {gameState.transport} · 저장 정책: {gameState.storagePolicy || profile.storage}
                </div>
              )}
            </section>
          </main>

          <aside className="space-y-4">
            <VideoGameInputDeck
              videoGameCode={videoGameCode}
              profile={profile}
              directionControls={directionControls}
              actionControls={actionControls}
              pressedControl={pressedControl}
              pressedControlLabel={pressedControlLabel}
              status={status}
              transportLabel={transportLabel}
              gameFrameSrc={gameFrameSrc}
            />

            <VideoGameMobileControlPanel
              profile={profile}
              directionControls={directionControls}
              actionControls={actionControls}
              pressedControl={pressedControl}
              pressedControlLabel={pressedControlLabel}
              status={status}
              gameFrameSrc={gameFrameSrc}
              onControl={sendTouchControl}
            />
          </aside>
        </div>
      )}
    </div>
  );
};

const getVideoRoomMemberCount = (room) => Number(room?.memberCount || roomPlayers(room).length || 0);

const getVideoRoomReadySignal = (room) => {
  const players = roomPlayers(room);
  const hostMemberId = Number(room?.hostMemberId || 0);
  const guests = players.filter((player) => getVideoGameMemberId(player) !== hostMemberId);
  const readyGuests = guests.filter(isVideoGameReadyPlayer).length;
  if (!guests.length) {
    return {
      done: true,
      label: "혼자 시작 가능",
      detail: "추가 인원 없이 바로 준비할 수 있습니다.",
    };
  }
  return {
    done: readyGuests === guests.length,
    label: `게스트 준비 ${readyGuests}/${guests.length}`,
    detail: readyGuests === guests.length ? "시작 조건을 만족했습니다." : "아직 준비하지 않은 게스트가 있습니다.",
  };
};

const getVideoRoomActionSignal = (room, mode = "joinable") => {
  const status = getVideoGameRoomStatus(room);
  const memberCount = getVideoRoomMemberCount(room);
  const maxPlayers = Number(room?.maxPlayers || 1);
  if (mode === "mine") {
    return {
      label: status === "PLAYING" ? "플레이 재입장" : "방 상태 확인",
      detail: status === "PLAYING" ? "진행 중인 화면으로 돌아갈 수 있습니다." : "멤버와 준비 상태를 먼저 확인하세요.",
    };
  }
  if (status === "PLAYING") {
    return { label: "진행 중", detail: "이미 시작된 방입니다. 상태 보기만 가능합니다." };
  }
  if (memberCount >= maxPlayers) {
    return { label: "정원 마감", detail: "빈 좌석이 생기면 입장할 수 있습니다." };
  }
  if (memberCount <= 1) {
    return { label: "첫 합류 추천", detail: "입장하면 바로 매칭 흐름을 만들 수 있습니다." };
  }
  return { label: "입장 가능", detail: "준비 상태를 맞추면 빠르게 시작할 수 있습니다." };
};

const videoRoomDecisionToneClasses = {
  access: "border-emerald-100 bg-emerald-50 text-emerald-800",
  seat: "border-sky-100 bg-sky-50 text-sky-800",
  ready: "border-amber-100 bg-amber-50 text-amber-800",
  rhythm: "border-violet-100 bg-violet-50 text-violet-800",
  neutral: "border-slate-100 bg-slate-50 text-slate-700",
};

const buildVideoRoomDecisionItems = ({
  room,
  gameCode,
  mode = "joinable",
  status,
  memberCount,
  maxPlayers,
  roomFull,
  canJoin,
  readySignal,
  actionSignal,
}) => {
  const openSeats = Math.max(0, Number(maxPlayers || 0) - Number(memberCount || 0));
  const playBrief = videoGamePlayBriefs[gameCode] || {};
  const stageBrief = videoGameStageHudBriefs[gameCode] || {};
  const statusText = statusLabel[status] || status || "대기";
  const roomCode = getVideoGameRoomCode(room) || "-";
  const accessValue = mode === "mine"
    ? "내 참여 방"
    : canJoin
      ? "바로 입장"
      : status === "PLAYING"
        ? "진행 관찰"
        : roomFull
          ? "정원 마감"
          : status === "FINISHED"
            ? "결과 확인"
            : "상태 확인";
  const accessDetail = mode === "mine"
    ? `${statusText} · 방 코드 ${roomCode}`
    : actionSignal?.detail || `${statusText} 상태를 먼저 확인하세요.`;

  return [
    {
      key: "access",
      icon: canJoin || mode === "mine" ? "turn" : "decision",
      label: "입장 판단",
      value: accessValue,
      detail: accessDetail,
      tone: canJoin || mode === "mine" ? "access" : "neutral",
    },
    {
      key: "seat",
      icon: "player",
      label: "좌석",
      value: `${memberCount}/${maxPlayers}명`,
      detail: openSeats > 0 ? `빈 좌석 ${openSeats}개 · 최대 ${maxPlayers}명` : "빈 좌석이 없습니다.",
      tone: openSeats > 0 ? "seat" : "neutral",
    },
    {
      key: "ready",
      icon: readySignal?.done ? "win" : "state",
      label: "준비",
      value: readySignal?.label || "준비 확인",
      detail: readySignal?.detail || "참가자의 준비 상태를 확인합니다.",
      tone: readySignal?.done ? "access" : "ready",
    },
    {
      key: "rhythm",
      icon: "input",
      label: "플레이 리듬",
      value: playBrief.rhythm || "실시간 입력",
      detail: stageBrief.mission || playBrief.input || "입장 후 조작과 상태 동기화를 같은 흐름에서 확인합니다.",
      tone: "rhythm",
    },
  ];
};

const VideoGameRoomDecisionRail = ({ items = [] }) => {
  const visibleItems = Array.isArray(items) ? items.filter(Boolean).slice(0, 4) : [];
  if (!visibleItems.length) return null;

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4" data-smoke="video-game-room-decision-rail">
      {visibleItems.map((item) => {
        const tone = videoRoomDecisionToneClasses[item.tone] || videoRoomDecisionToneClasses.neutral;
        return (
          <div key={item.key} className={`min-h-[94px] rounded-xl border px-3 py-2 ${tone}`} data-smoke="video-game-room-decision-item" data-decision-key={item.key}>
            <div className="flex items-center gap-1.5 text-[10px] font-black opacity-75">
              <GameUxGlyph type={item.icon || "state"} className="h-3.5 w-3.5" />
              {item.label}
            </div>
            <div className="mt-1 truncate text-sm font-black leading-tight">{item.value}</div>
            {item.detail && <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-relaxed opacity-70">{item.detail}</div>}
          </div>
        );
      })}
    </div>
  );
};

const getVideoRoomTacticalSignals = (gameCode) => {
  const playBrief = videoGamePlayBriefs[gameCode] || {};
  const stageBrief = videoGameStageHudBriefs[gameCode] || {};
  return [
    {
      key: "mission",
      icon: "stage",
      label: playBrief.rhythm || "플레이 리듬",
      detail: stageBrief.mission || playBrief.objective || "게임 화면에 진입하면 현재 목표를 먼저 확인하세요.",
    },
    {
      key: "danger",
      icon: "signal",
      label: "위험 신호",
      detail: stageBrief.danger || "무리한 입력보다 다음 행동을 읽는 것이 중요합니다.",
    },
    {
      key: "reward",
      icon: "score",
      label: "보상 신호",
      detail: stageBrief.reward || "좋은 판단이 점수와 진행 우위로 이어집니다.",
    },
  ];
};

const videoRoomCardStateTone = {
  WAITING: { bg: "#fff7ed", rail: "#f59e0b", fill: "#fef3c7", text: "#78350f" },
  PLAYING: { bg: "#ecfdf5", rail: "#10b981", fill: "#dcfce7", text: "#14532d" },
  FINISHED: { bg: "#f1f5f9", rail: "#64748b", fill: "#e2e8f0", text: "#334155" },
};

const VideoGameRoomCardArt = ({
  gameCode,
  status,
  memberCount,
  maxPlayers,
  canJoin,
  mode,
  readySignal,
  tacticalSignals = [],
  className = "",
}) => {
  const palette = videoGameTacticalPalettes[gameCode] || videoGameTacticalPalettes.arena;
  const tone = videoRoomCardStateTone[status] || videoRoomCardStateTone.WAITING;
  const safeMaxPlayers = Math.max(1, Number(maxPlayers || 1));
  const safeMemberCount = Math.max(0, Math.min(safeMaxPlayers, Number(memberCount || 0)));
  const slotCount = Math.max(1, Math.min(safeMaxPlayers, 8));
  const filledSlots = Math.max(0, Math.min(slotCount, Math.round((safeMemberCount / safeMaxPlayers) * slotCount)));
  const statusText = statusLabel[status] || status || "대기";
  const actionText = canJoin ? "입장 가능" : mode === "mine" ? "내 방" : status === "PLAYING" ? "진행 중" : status === "FINISHED" ? "결과" : "대기";
  const nodes = [
    {
      key: "ready",
      label: readySignal?.done ? "준비" : "대기",
      active: Boolean(readySignal?.done),
      fill: readySignal?.done ? "#dcfce7" : "#fef3c7",
      stroke: readySignal?.done ? "#16a34a" : "#d97706",
      text: readySignal?.done ? "#14532d" : "#78350f",
    },
    {
      key: "seat",
      label: `${safeMemberCount}/${safeMaxPlayers}`,
      active: safeMemberCount >= safeMaxPlayers,
      fill: safeMemberCount >= safeMaxPlayers ? "#e0f2fe" : "#eef2ff",
      stroke: safeMemberCount >= safeMaxPlayers ? "#0284c7" : "#4f46e5",
      text: safeMemberCount >= safeMaxPlayers ? "#0c4a6e" : "#312e81",
    },
    {
      key: "action",
      label: canJoin ? "입장" : mode === "mine" ? "복귀" : "확인",
      active: canJoin || mode === "mine",
      fill: canJoin || mode === "mine" ? "#dbeafe" : "#f1f5f9",
      stroke: canJoin || mode === "mine" ? "#2563eb" : "#64748b",
      text: canJoin || mode === "mine" ? "#1e3a8a" : "#334155",
    },
    {
      key: tacticalSignals[0]?.key || "signal",
      label: tacticalSignals[0]?.label ? String(tacticalSignals[0].label).slice(0, 4) : "전술",
      active: status !== "FINISHED",
      fill: "#ecfeff",
      stroke: "#0891b2",
      text: "#164e63",
    },
  ];

  return (
    <svg
      viewBox="0 0 212 132"
      className={className}
      role="img"
      aria-label={`비디오게임 방 상태 ${statusText}, ${safeMemberCount}/${safeMaxPlayers}명`}
      focusable="false"
      data-smoke="video-game-room-card-art"
      data-room-status={status || ""}
      data-can-join={canJoin ? "true" : "false"}
    >
      <rect x="4" y="4" width="204" height="124" rx="20" fill={tone.bg} stroke="#cbd5e1" strokeWidth="2" />
      <path d="M18 96c26-20 52-23 78-8 30 18 57 10 82-22 12-15 20-18 32-12v40c-55 20-112 23-192 2Z" fill={palette.secondary} opacity="0.18" />
      <path d="M24 88H188" stroke={palette.primary} strokeWidth="4" strokeLinecap="round" opacity="0.52" />
      <rect x="16" y="16" width="76" height="24" rx="12" fill="#ffffff" stroke={tone.rail} strokeWidth="2" />
      <text x="54" y="32" textAnchor="middle" fontSize="11" fontWeight="900" fill={tone.text}>{statusText}</text>
      <rect x="110" y="16" width="86" height="24" rx="12" fill={canJoin ? "#dcfce7" : tone.fill} stroke={canJoin ? "#16a34a" : tone.rail} strokeWidth="2" />
      <text x="153" y="32" textAnchor="middle" fontSize="11" fontWeight="900" fill={canJoin ? "#14532d" : tone.text}>{actionText}</text>
      <g transform="translate(22 54)">
        {nodes.map((node, index) => {
          const x = index * 52;
          return (
            <g key={node.key} transform={`translate(${x} 0)`} data-smoke="video-game-room-card-node" data-room-card-key={node.key}>
              {index > 0 && <path d="M-34 15H-18" stroke={node.active ? node.stroke : "#94a3b8"} strokeWidth="4" strokeLinecap="round" opacity={node.active ? 0.9 : 0.36} />}
              <circle cx="15" cy="15" r="15" fill={node.fill} stroke={node.stroke} strokeWidth="3" />
              <text x="15" y="19" textAnchor="middle" fontSize="9" fontWeight="900" fill={node.text}>{index + 1}</text>
              <text x="15" y="43" textAnchor="middle" fontSize="9" fontWeight="900" fill={node.text}>{node.label}</text>
            </g>
          );
        })}
      </g>
      <g transform="translate(16 112)" aria-hidden="true">
        {Array.from({ length: slotCount }).map((_, index) => (
          <rect
            key={index}
            x={index * 23}
            y="0"
            width="17"
            height="8"
            rx="4"
            fill={index < filledSlots ? palette.accent : "#cbd5e1"}
            opacity={index < filledSlots ? 0.95 : 0.72}
            data-smoke="video-game-room-card-seat"
          />
        ))}
      </g>
    </svg>
  );
};

const VideoGameLobbyEmptyArt = ({ gameCode, mode = "joinable", className = "" }) => {
  const palette = videoGameTacticalPalettes[gameCode] || videoGameTacticalPalettes.arena;
  const mineMode = mode === "mine";
  const nodes = [
    { key: "scan", label: mineMode ? "내 방" : "목록", x: 44, y: 58, active: false },
    { key: "create", label: "생성", x: 106, y: 38, active: true },
    { key: "invite", label: "코드", x: 168, y: 58, active: true },
  ];

  return (
    <svg
      viewBox="0 0 212 116"
      className={className}
      role="img"
      aria-label={mineMode ? "참여 중인 비디오게임 방이 없을 때 새 방과 초대 코드를 안내합니다." : "대기 중인 비디오게임 방이 없을 때 새 방과 초대 코드를 안내합니다."}
      focusable="false"
      data-smoke="video-game-lobby-empty-art"
      data-empty-mode={mode}
    >
      <rect x="4" y="4" width="204" height="108" rx="20" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
      <path d="M20 82C52 58 78 65 106 82C137 101 162 87 194 48V97H20Z" fill={palette.secondary} opacity="0.16" />
      <path d="M28 78C61 54 86 58 110 75C139 96 166 78 190 46" fill="none" stroke={palette.primary} strokeWidth="4" strokeLinecap="round" opacity="0.58" />
      {nodes.map((node, index) => (
        <g key={node.key} data-smoke="video-game-lobby-empty-node" data-empty-key={node.key}>
          {index > 0 && (
            <path
              d={`M${nodes[index - 1].x + 18} ${nodes[index - 1].y}C${nodes[index - 1].x + 36} ${nodes[index - 1].y - 24} ${node.x - 36} ${node.y - 24} ${node.x - 18} ${node.y}`}
              fill="none"
              stroke={node.active ? palette.accent : "#94a3b8"}
              strokeWidth="3"
              strokeLinecap="round"
              opacity={node.active ? 0.72 : 0.36}
            />
          )}
          <circle cx={node.x} cy={node.y} r="18" fill={node.active ? "#ecfeff" : "#ffffff"} stroke={node.active ? palette.accent : "#94a3b8"} strokeWidth="3" />
          <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="10" fontWeight="900" fill={node.active ? "#164e63" : "#475569"}>{index + 1}</text>
          <text x={node.x} y={node.y + 31} textAnchor="middle" fontSize="10" fontWeight="900" fill="#334155">{node.label}</text>
        </g>
      ))}
      <rect x="28" y="14" width="68" height="20" rx="10" fill="#ffffff" stroke="#e2e8f0" />
      <text x="62" y="28" textAnchor="middle" fontSize="10" fontWeight="900" fill="#475569">{mineMode ? "복귀 대기" : "방 없음"}</text>
      <rect x="120" y="14" width="64" height="20" rx="10" fill={palette.primary} opacity="0.16" />
      <text x="152" y="28" textAnchor="middle" fontSize="10" fontWeight="900" fill="#0f172a">새 흐름</text>
    </svg>
  );
};

const VideoGameLobbyEmptyState = ({ title, emptyText, gameCode, mode = "joinable" }) => {
  const mineMode = mode === "mine";
  const guideItems = mineMode
    ? [
      { key: "return", label: "복귀 대상", value: "참여 방 없음", detail: "현재 이어갈 방이 없으니 공개 대기방이나 새 방 생성을 확인하세요." },
      { key: "create", label: "다음 행동", value: "새 방 만들기", detail: "왼쪽 설정에서 인원과 제목을 확인한 뒤 바로 방을 만들 수 있습니다." },
      { key: "invite", label: "초대 경로", value: "초대 코드", detail: "친구가 공유한 코드가 있으면 코드 입장 패널이 더 빠릅니다." },
    ]
    : [
      { key: "scan", label: "공개 목록", value: "대기방 없음", detail: "지금 입장할 공개 방이 없으니 직접 방을 만들면 첫 선택지가 됩니다." },
      { key: "create", label: "다음 행동", value: "새 방 만들기", detail: "새 방을 만들면 다른 플레이어가 바로 합류할 수 있는 기준점이 생깁니다." },
      { key: "invite", label: "초대 경로", value: "초대 코드", detail: "이미 받은 방 코드가 있다면 목록을 기다리지 말고 코드로 합류하세요." },
    ];

  return (
    <div
      className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-3"
      data-smoke="video-game-lobby-empty-state"
      data-empty-mode={mode}
      data-game-code={gameCode || ""}
    >
      <div className="grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)] lg:items-center">
        <VideoGameLobbyEmptyArt gameCode={gameCode} mode={mode} className="h-28 w-full" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-600">{title}</span>
            <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-black text-cyan-700">{mineMode ? "복귀 없음" : "입장 대기 없음"}</span>
          </div>
          <div className="mt-2 text-sm font-black text-slate-900">{emptyText}</div>
          <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
            빈 목록도 멈춘 화면이 아니라 새 방 만들기, 초대 코드 입장, 새로고침 중 어느 경로를 선택할지 알려야 합니다.
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {guideItems.map((item) => (
              <div key={item.key} className="rounded-xl border border-slate-200 bg-white px-3 py-2" data-smoke="video-game-lobby-empty-item" data-empty-key={item.key}>
                <div className="text-[10px] font-black text-slate-400">{item.label}</div>
                <div className="mt-0.5 text-xs font-black text-slate-900">{item.value}</div>
                <div className="mt-1 text-[11px] font-bold leading-relaxed text-slate-500">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const RoomList = ({ title, rooms, emptyText, gameCode, onOpen, onJoin, busy, mode = "joinable" }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-base font-black text-slate-900">{title}</h2>
      <div className="text-xs font-black text-slate-400">{rooms.length}개</div>
    </div>
    <div className="mt-3 space-y-2">
      {rooms.length ? rooms.map((room) => {
        const status = getVideoGameRoomStatus(room);
        const memberCount = getVideoRoomMemberCount(room);
        const maxPlayers = Number(room?.maxPlayers || 1);
        const visibleSlots = Math.max(1, Math.min(maxPlayers, 8));
        const roomFull = memberCount >= maxPlayers;
        const canJoin = status === "WAITING" && !roomFull;
        const readySignal = getVideoRoomReadySignal(room);
        const actionSignal = getVideoRoomActionSignal(room, mode);
        const tacticalSignals = getVideoRoomTacticalSignals(gameCode);
        const decisionItems = buildVideoRoomDecisionItems({
          room,
          gameCode,
          mode,
          status,
          memberCount,
          maxPlayers,
          roomFull,
          canJoin,
          readySignal,
          actionSignal,
        });
        const statusTone = status === "PLAYING"
          ? "bg-emerald-100 text-emerald-700"
          : status === "WAITING"
            ? "bg-amber-100 text-amber-700"
            : "bg-slate-200 text-slate-600";
        return (
        <div
          key={getVideoGameRoomId(room)}
          className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50"
          data-smoke="video-game-room-card"
          data-room-status={status || ""}
          data-can-join={canJoin ? "true" : "false"}
          data-member-count={memberCount}
          data-max-players={maxPlayers}
        >
          <div className="grid gap-3 p-3 md:grid-cols-[132px_minmax(0,1fr)_160px] md:items-center">
            <div className="w-full shrink-0 md:w-32">
              <div className="hidden md:block">
                <VideoGameArtwork type={gameCode} compact className="h-20 w-full" />
              </div>
              <VideoGameRoomCardArt
                gameCode={gameCode}
                status={status}
                memberCount={memberCount}
                maxPlayers={maxPlayers}
                canJoin={canJoin}
                mode={mode}
                readySignal={readySignal}
                tacticalSignals={tacticalSignals}
                className="h-24 w-full md:mt-2 md:h-20"
              />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="truncate text-sm font-black text-slate-900">{room.title}</div>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black ${statusTone}`}>
                  {statusLabel[status] || status}
                </span>
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                코드 {getVideoGameRoomCode(room)} · {memberCount}/{maxPlayers}명
              </div>
              <VideoGameRoomDecisionRail items={decisionItems} />
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2" data-smoke="video-game-room-readiness">
                  <div className="flex items-center gap-2 text-[11px] font-black text-slate-700">
                    {readySignal.done ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Timer className="h-3.5 w-3.5 text-amber-600" />}
                    {readySignal.label}
                  </div>
                  <div className="mt-1 text-[11px] font-bold leading-relaxed text-slate-500">{readySignal.detail}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2" data-smoke="video-game-room-action-signal">
                  <div className="flex items-center gap-2 text-[11px] font-black text-slate-700">
                    <GameUxGlyph type="decision" className="h-3.5 w-3.5 text-primary-600" />
                    {actionSignal.label}
                  </div>
                  <div className="mt-1 text-[11px] font-bold leading-relaxed text-slate-500">{actionSignal.detail}</div>
                </div>
              </div>
              <div className="mt-3 grid gap-2 lg:grid-cols-3">
                {tacticalSignals.map((signal) => (
                  <div key={signal.key} className="rounded-xl border border-slate-200 bg-white px-3 py-2" data-smoke="video-game-room-tactical-signal">
                    <div className="flex items-center gap-2 text-[11px] font-black text-slate-700">
                      <GameUxGlyph type={signal.icon} className="h-3.5 w-3.5 text-cyan-600" />
                      {signal.label}
                    </div>
                    <div className="mt-1 text-[11px] font-bold leading-relaxed text-slate-500">{signal.detail}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-1.5" aria-label={`좌석 ${memberCount}/${maxPlayers}`}>
                {Array.from({ length: visibleSlots }).map((_, index) => (
                  <span
                    key={index}
                    className={`h-2 flex-1 rounded-full ${index < memberCount ? "bg-primary-500" : "bg-slate-200"}`}
                    data-smoke="video-game-room-slot"
                  />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
              <button type="button" className="min-h-10 rounded-xl bg-white px-3 text-xs font-black text-slate-700 shadow-sm" onClick={() => onOpen(room)} data-smoke="video-game-room-open">
                {mode === "mine" ? "방 열기" : "상태 보기"}
              </button>
              {mode === "mine" ? (
                <button type="button" className="min-h-10 rounded-xl bg-slate-900 px-3 text-xs font-black text-white" onClick={() => onOpen(room)} data-smoke="video-game-room-primary">
                  {status === "PLAYING" ? "재입장" : "확인"}
                </button>
              ) : (
                <button type="button" disabled={busy || !canJoin} className="min-h-10 rounded-xl bg-slate-900 px-3 text-xs font-black text-white disabled:opacity-40" onClick={() => onJoin(room)} data-smoke="video-game-room-primary">
                  {roomFull ? "정원 마감" : status === "WAITING" ? "입장" : "진행 중"}
                </button>
              )}
            </div>
          </div>
        </div>
        );
      }) : (
        <VideoGameLobbyEmptyState title={title} emptyText={emptyText} gameCode={gameCode} mode={mode} />
      )}
    </div>
  </section>
);

export default GoodEtcVideoGame;
