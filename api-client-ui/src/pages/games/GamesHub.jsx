import { Link } from "react-router-dom";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowRight, BookOpen, CircleHelp, Dices, Sparkles, X } from "lucide-react";
import { GameUxGlyph, PlayingCardArt } from "./GameUxAssets.jsx";
import { TabletopGameArtwork, tabletopGameArtProfiles } from "./TabletopGameArtwork.jsx";
import { VideoGameArtwork, videoGameArtProfiles } from "./VideoGameArtwork.jsx";
import { getBoardGameRuleGuide } from "../../common/boardGameRules.js";
import { BannerTypeBadge } from "../../common/BannerTypeBadge.jsx";
import { BusinessPrivacyFooter } from "../../components/BusinessPrivacyFooter.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { homeAdapter } from "../../adapters/homeAdapter.js";

const videoGameManuals = {
  arena: {
    subtitle: "Good_ETC의 LAN Arena를 홈페이지 방 입장 흐름으로 옮기는 실시간 액션 게임입니다.",
    tags: ["1~8인", "실시간 액션", "모바일 조작"],
    sections: [
      {
        title: "게임 핵심",
        items: [
          "실시간 아레나에서 이동, 회피, 발사를 반복하며 끝까지 살아남거나 더 많은 점수를 얻는 액션 게임입니다.",
          "키보드와 모바일 터치 조작을 모두 지원하며, 방 단위로 참가자 입력과 프레임 상태를 동기화합니다.",
        ],
      },
      {
        title: "조작",
        items: [
          "이동 패드와 액션 버튼으로 이동, 조준, 공격을 실행합니다.",
          "모바일에서는 조작 패널을 게임 화면 위쪽 바깥에 두어 캔버스를 가리지 않도록 했습니다.",
        ],
      },
    ],
  },
  fortress: {
    subtitle: "각도와 파워를 조절해 상대를 맞히는 Good_ETC 포트리스 게임입니다.",
    tags: ["1~2인", "턴제 포격", "모바일 조준"],
    sections: [
      {
        title: "게임 핵심",
        items: [
          "차례마다 위치와 지형을 보고 각도, 파워를 조절해 상대를 맞히는 턴제 포격 게임입니다.",
          "바람과 거리 감각이 핵심이므로 첫 발은 보정용으로 쓰고 이후 탄도를 조정하면 됩니다.",
        ],
      },
      {
        title: "조작",
        items: [
          "이동, 각도 조절, 파워 충전, 발사를 큰 터치 컨트롤로 제공합니다.",
          "발사 전에는 내 위치와 상대 위치가 모두 보이는 상태에서 조준값을 정합니다.",
        ],
      },
    ],
  },
  defense: {
    subtitle: "웨이브를 막고 타워를 배치하는 Good_ETC 협동 디펜스 게임입니다.",
    tags: ["1~4인", "타워 디펜스", "협동"],
    sections: [
      {
        title: "게임 핵심",
        items: [
          "웨이브로 몰려오는 적을 타워 배치, 업그레이드, 스킬 사용으로 막는 협동 디펜스 게임입니다.",
          "초반에는 길목을 막는 기본 타워를 우선 만들고, 이후 적 속성에 맞춰 화력을 보강합니다.",
        ],
      },
      {
        title: "조작",
        items: [
          "타일 선택, 건설, 업그레이드, 스킬 버튼을 모바일에서도 바로 누를 수 있게 제공합니다.",
          "웨이브 상태와 자원 수치를 보고 다음 건설 위치를 결정합니다.",
        ],
      },
    ],
  },
  party: {
    subtitle: "Good_ETC의 카트, 폭탄, 스네이크, 코인 파티 게임을 같은 방 흐름으로 실행합니다.",
    tags: ["1~8인", "파티 액션", "터치 조작"],
    sections: [
      {
        title: "게임 핵심",
        items: [
          "카트는 주행과 아이템, 폭탄은 설치와 회피, 스네이크는 성장과 충돌 회피, 코인은 제한 시간 수집이 핵심입니다.",
          "각 게임은 짧은 라운드 안에서 점수, 생존, 수집량처럼 화면에 표시되는 조건으로 결과가 갈립니다.",
        ],
      },
      {
        title: "조작",
        items: [
          "방향 패드와 게임별 액션 버튼을 사용합니다.",
          "모바일에서는 게임 화면을 가리지 않도록 조작과 정보 패널을 화면 바깥쪽에 분리했습니다.",
        ],
      },
    ],
  },
  rpg: {
    subtitle: "Good_ETC의 솔로 RPG입니다. 진행 저장은 브라우저 localStorage를 우선 사용합니다.",
    tags: ["1인", "솔로 RPG", "localStorage"],
    sections: [
      {
        title: "게임 핵심",
        items: [
          "탐험, 전투, 상호작용을 혼자 진행하는 Good_ETC 솔로 RPG입니다.",
          "진행 저장은 브라우저 localStorage를 우선 사용하므로 같은 브라우저에서 이어 할 수 있습니다.",
        ],
      },
      {
        title: "조작",
        items: [
          "이동 방향, 상호작용, 메뉴 열기를 터치 버튼으로 제공합니다.",
          "화면 크기에 맞춰 조작대와 로그 패널이 겹치지 않도록 분리합니다.",
        ],
      },
    ],
  },
};

const boardGameManual = (game, tags = [], options = {}) => {
  const ruleGuide = getBoardGameRuleGuide({ game, ...options });
  return {
    subtitle: ruleGuide.summary,
    tags,
    sections: ruleGuide.sections,
  };
};

const boardGames = [
  {
    title: "포커",
    description: "(1~8인) 텍사스 홀덤과 5장 드로우 / 족보 보조와 AI 봇을 지원합니다.",
    to: "/app/poker",
    tone: "from-emerald-800 via-slate-900 to-rose-900",
    players: "1~8인",
    minPlayers: 1,
    maxPlayers: 8,
    mode: "홀덤 · 드로우",
    preview: "poker",
    resumeStorageKey: "poker_last_room_id",
    highlights: ["AI 봇", "족보 보조", "5장 드로우"],
    manual: boardGameManual("poker", ["1~8인", "홀덤", "5장 드로우"]),
    featured: true,
  },
  {
    title: "Las Vegas",
    description: "(2~6인) 실시간 방 입장형 보드게임 / 주사위를 배팅하여 더 많은 금액을 쟁취하세요.",
    to: "/app/games/las-vegas",
    tone: "from-amber-500 via-orange-500 to-rose-500",
    players: "2~6인",
    minPlayers: 2,
    maxPlayers: 6,
    mode: "방 입장",
    preview: "dice",
    resumeStorageKey: "las_vegas_last_room_id",
    highlights: ["실시간 방", "주사위 배팅"],
    manual: boardGameManual("las-vegas", ["2~6인", "주사위 배팅", "동점 탈락"]),
    featured: false,
  },
  {
    title: "No Thanks",
    description: "(3~6인) 실시간 방 입장형 보드게임 / 카드와 토큰을 적절히 교환하여 더 낮은 점수를 획득하세요",
    to: "/app/games/no-thanks",
    tone: "from-slate-700 via-slate-900 to-emerald-700",
    players: "3~6인",
    minPlayers: 3,
    maxPlayers: 6,
    mode: "카드",
    preview: "cards",
    resumeStorageKey: "no_thanks_last_room_id",
    highlights: ["실시간 방", "카드 선택"],
    manual: boardGameManual("no-thanks", ["3~6인", "낮은 점수", "칩 관리"]),
    featured: false,
  },
  {
    title: "카탄",
    description: "(3~6인) 방 입장형 전략 보드게임 / 기본판과 구현된 공식 확장·시나리오를 선택할 수 있습니다.",
    to: "/app/games/catan",
    tone: "from-amber-500 via-lime-500 to-sky-500",
    players: "3~6인",
    minPlayers: 3,
    maxPlayers: 6,
    mode: "전략",
    preview: "catan",
    resumeStorageKey: "catan_last_room_id",
    highlights: ["기본판", "5~6인", "공식 확장"],
    manual: boardGameManual("catan", ["3~6인", "자원 생산", "건설 전략"]),
    featured: true,
  },
  {
    title: "블로커스",
    description: "(2~4인) 코너 접촉 배치 게임 / 본게임과 공식 인원 변형을 지원합니다.",
    to: "/app/games/blokus",
    tone: "from-cyan-500 via-blue-500 to-fuchsia-500",
    players: "2~4인",
    minPlayers: 2,
    maxPlayers: 4,
    mode: "배치",
    preview: "blokus",
    resumeStorageKey: "blokus_last_room_id",
    highlights: ["본게임", "듀오", "팀전"],
    manual: boardGameManual("blokus", ["2~4인", "도형 배치", "코너 연결"]),
    featured: true,
  },
  {
    title: "마헤",
    description: "(2~7인) 거북이 경주 게임 / 주사위 선택과 업고 가기 흐름을 지원합니다.",
    to: "/app/games/mahe",
    tone: "from-emerald-500 via-teal-500 to-yellow-400",
    players: "2~7인",
    minPlayers: 2,
    maxPlayers: 7,
    mode: "경주",
    preview: "mahe",
    resumeStorageKey: "mahe_last_room_id",
    highlights: ["본게임", "업고 가기", "확률 안내"],
    manual: boardGameManual("mahe", ["2~7인", "거북이 경주", "위험 선택"]),
    featured: true,
  },
  {
    title: "달무티",
    description: "(4~8인) 계급형 클라이밍 카드게임 / 세금과 혁명 규칙을 서버 판정으로 지원합니다.",
    to: "/app/games/dalmuti",
    tone: "from-violet-500 via-rose-500 to-amber-500",
    players: "4~8인",
    minPlayers: 4,
    maxPlayers: 8,
    mode: "계급 카드",
    preview: "dalmuti",
    resumeStorageKey: "dalmuti_last_room_id",
    highlights: ["본게임", "세금", "혁명"],
    manual: boardGameManual("dalmuti", ["4~8인", "계급 카드", "세금과 혁명"]),
    featured: true,
  },
  {
    title: "6 nimmt!",
    description: "(2~10인) 동시 카드 선택과 4개 행 벌점 관리를 서버 판정으로 지원합니다.",
    to: "/app/games/six-nimmt",
    tone: "from-rose-500 via-amber-500 to-lime-500",
    players: "2~10인",
    minPlayers: 2,
    maxPlayers: 10,
    mode: "벌점 카드",
    preview: "six-nimmt",
    resumeStorageKey: "six_nimmt_last_room_id",
    highlights: ["동시 선택", "벌점 예측", "66벌점 종료"],
    manual: boardGameManual("six-nimmt", ["2~10인", "동시 선택", "벌점 관리"]),
    featured: true,
  },
  {
    title: "텔레스트레이션",
    description: "(3~8인) 문장과 그림을 번갈아 넘기고 마지막 공개 리플레이로 함께 확인합니다.",
    to: "/app/games/telestrations",
    tone: "from-sky-500 via-fuchsia-500 to-amber-400",
    players: "3~8인",
    minPlayers: 3,
    maxPlayers: 8,
    mode: "그림 릴레이",
    preview: "telestrations",
    resumeStorageKey: "telestrations_last_room_id",
    highlights: ["동시 제출", "캔버스", "리플레이"],
    manual: boardGameManual("telestrations", ["3~8인", "그림 릴레이", "리플레이"]),
    featured: true,
  },
  {
    title: "마피아",
    description: "(5~12인) 사회자 TTS가 밤·낮·투표를 진행하고 경찰/의사 조합을 선택할 수 있습니다.",
    to: "/app/games/mafia",
    tone: "from-zinc-950 via-indigo-950 to-rose-900",
    players: "5~12인",
    minPlayers: 5,
    maxPlayers: 12,
    mode: "비밀 역할",
    preview: "mafia",
    resumeStorageKey: "mafia_last_room_id",
    highlights: ["사회자 TTS", "경찰/의사 선택", "투표"],
    manual: boardGameManual("mafia", ["5~12인", "비밀 역할", "팀 추리"]),
    featured: true,
  },
  {
    title: "시티델",
    description: "(2~7인) 비밀 캐릭터 선택과 도시 건설을 서버 판정으로 진행합니다.",
    to: "/app/games/citadels",
    tone: "from-zinc-900 via-red-900 to-amber-600",
    players: "2~7인",
    minPlayers: 2,
    maxPlayers: 7,
    mode: "비밀 역할",
    preview: "citadels",
    resumeStorageKey: "citadels_last_room_id",
    highlights: ["공식 기본판", "비밀 캐릭터", "8구역 종료"],
    manual: boardGameManual("citadels", ["2~7인", "비밀 캐릭터", "도시 건설"]),
    featured: true,
  },
];

const videoGames = [
  {
    title: "LAN Arena",
    description: "(1~8인) Good_ETC 실시간 아레나 슈터 / 이동, 회피, 발사를 방 단위로 동기화합니다.",
    to: "/app/games/video/arena",
    tone: "from-cyan-500 via-slate-900 to-emerald-500",
    players: "1~8인",
    minPlayers: 1,
    maxPlayers: 8,
    mode: "액션",
    preview: "arena",
    highlights: ["실시간 방", "터치 조작", "STOMP"],
    manual: videoGameManuals.arena,
    featured: true,
  },
  {
    title: "Fortress",
    description: "(1~2인) Good_ETC 포트리스 / 각도와 파워를 조절하는 턴제 포격 게임입니다.",
    to: "/app/games/video/fortress",
    tone: "from-amber-500 via-sky-600 to-slate-900",
    players: "1~2인",
    minPlayers: 1,
    maxPlayers: 2,
    mode: "포격",
    preview: "fortress",
    highlights: ["턴제", "조준", "방 입장"],
    manual: videoGameManuals.fortress,
    featured: true,
  },
  {
    title: "Defense",
    description: "(1~4인) Good_ETC 디펜스 / 타워 건설과 스킬로 웨이브를 막는 협동 게임입니다.",
    to: "/app/games/video/defense",
    tone: "from-lime-500 via-emerald-700 to-slate-950",
    players: "1~4인",
    minPlayers: 1,
    maxPlayers: 4,
    mode: "협동",
    preview: "defense",
    highlights: ["타워", "웨이브", "스킬"],
    manual: videoGameManuals.defense,
    featured: true,
  },
  {
    title: "Kart Dash",
    description: "(1~8인) Good_ETC 파티 카트 / 트랙 주행과 아이템 경쟁을 지원합니다.",
    to: "/app/games/video/kart",
    tone: "from-orange-500 via-rose-500 to-indigo-700",
    players: "1~8인",
    minPlayers: 1,
    maxPlayers: 8,
    mode: "파티",
    preview: "kart",
    highlights: ["레이스", "아이템", "터치"],
    manual: videoGameManuals.party,
    featured: false,
  },
  {
    title: "Bomb Battle",
    description: "(1~8인) Good_ETC 폭탄 배틀 / 폭탄 설치와 회피로 살아남는 파티 게임입니다.",
    to: "/app/games/video/bomb",
    tone: "from-rose-600 via-zinc-950 to-amber-500",
    players: "1~8인",
    minPlayers: 1,
    maxPlayers: 8,
    mode: "파티",
    preview: "bomb",
    highlights: ["폭탄", "회피", "아레나"],
    manual: videoGameManuals.party,
    featured: false,
  },
  {
    title: "Snake Rush",
    description: "(1~8인) Good_ETC 스네이크 / 성장과 충돌 회피가 핵심인 파티 게임입니다.",
    to: "/app/games/video/snake",
    tone: "from-emerald-500 via-lime-500 to-slate-900",
    players: "1~8인",
    minPlayers: 1,
    maxPlayers: 8,
    mode: "파티",
    preview: "snake",
    highlights: ["성장", "회피", "점수"],
    manual: videoGameManuals.party,
    featured: false,
  },
  {
    title: "Coin Collector",
    description: "(1~8인) Good_ETC 코인 수집 / 제한 시간 동안 코인을 모아 경쟁합니다.",
    to: "/app/games/video/coin",
    tone: "from-yellow-400 via-orange-500 to-sky-700",
    players: "1~8인",
    minPlayers: 1,
    maxPlayers: 8,
    mode: "파티",
    preview: "coin",
    highlights: ["수집", "경쟁", "점수"],
    manual: videoGameManuals.party,
    featured: false,
  },
  {
    title: "Good_ETC RPG",
    description: "(1인) Good_ETC 솔로 RPG / 진행 저장은 localStorage를 우선 사용합니다.",
    to: "/app/games/video/rpg",
    tone: "from-violet-700 via-slate-950 to-emerald-700",
    players: "1인",
    minPlayers: 1,
    maxPlayers: 1,
    mode: "RPG",
    preview: "rpg",
    highlights: ["솔로", "저장", "탐험"],
    manual: videoGameManuals.rpg,
    featured: true,
    resumeStorageKey: "good_etc_rpg_save_v1",
    resumeType: "progress",
  },
];

const gameHubResumeStorageKeys = Object.freeze(
  [...boardGames, ...videoGames].reduce((keys, game) => {
    if (game.resumeStorageKey) {
      keys[game.preview] = game.resumeStorageKey;
    }
    return keys;
  }, {})
);

const normalizeGameHubResumeRoomId = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return "";
  return trimmed;
};

const gameHubResumeTitleStorageKey = (storageKey) => {
  const key = String(storageKey || "").trim();
  if (!key.endsWith("_id")) return "";
  return key.replace(/_id$/, "_title");
};

const normalizeGameHubResumeTitle = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return "";
  return trimmed;
};

const summarizeGameHubProgressSave = (value) => {
  try {
    const save = JSON.parse(value);
    const state = save?.state && typeof save.state === "object" ? save.state : save;
    const player = state?.player && typeof state.player === "object" ? state.player : {};
    const level = Number(player.level || state?.level || save?.level || 0);
    const zone = state?.zoneName || state?.zone || state?.map?.zone || save?.zone || "";
    const quest = state?.activeQuest?.title || state?.quest?.title || state?.questTitle || save?.questTitle || "";
    const parts = [];
    if (Number.isFinite(level) && level > 0) parts.push(`Lv.${level}`);
    if (zone) parts.push(String(zone));
    if (quest) parts.push(String(quest));
    return parts.slice(0, 3).join(" · ") || "진행 저장 있음";
  } catch {
    return "진행 저장 있음";
  }
};

const createGameHubResumeEntry = (game, storageKey, value, titleValue = "") => {
  const normalizedValue = normalizeGameHubResumeRoomId(value);
  if (!normalizedValue) return null;
  if (game.resumeType === "progress") {
    return {
      ...game,
      roomId: "",
      resumeStorageKey: storageKey,
      resumeTitle: "",
      resumeValue: summarizeGameHubProgressSave(normalizedValue),
      resumeKind: "progress",
    };
  }
  const resumeTitle = normalizeGameHubResumeTitle(titleValue);
  return {
    ...game,
    roomId: normalizedValue,
    resumeStorageKey: storageKey,
    resumeTitle,
    resumeValue: resumeTitle || "최근 방",
    resumeKind: "room",
  };
};

const readGameHubResumeEntries = (games = boardGames) => {
  if (typeof window === "undefined" || !window.localStorage) return [];
  return games.flatMap((game) => {
    const storageKey = gameHubResumeStorageKeys[game.preview] || game.resumeStorageKey;
    if (!storageKey) return [];
    try {
      const titleKey = gameHubResumeTitleStorageKey(storageKey);
      const entry = createGameHubResumeEntry(
        game,
        storageKey,
        window.localStorage.getItem(storageKey),
        titleKey ? window.localStorage.getItem(titleKey) : ""
      );
      return entry ? [entry] : [];
    } catch {
      return [];
    }
  });
};

const gameRoutePreloads = {
  "/app/poker": () => import("./TabletopGame.jsx"),
  "/app/games/las-vegas": () => import("./LasVegasGame.jsx"),
  "/app/games/no-thanks": () => import("./NoThanksGame.jsx"),
  "/app/games/catan": () => import("./TabletopGame.jsx"),
  "/app/games/blokus": () => import("./TabletopGame.jsx"),
  "/app/games/mahe": () => import("./TabletopGame.jsx"),
  "/app/games/dalmuti": () => import("./TabletopGame.jsx"),
  "/app/games/six-nimmt": () => import("./TabletopGame.jsx"),
  "/app/games/telestrations": () => import("./TabletopGame.jsx"),
  "/app/games/mafia": () => import("./TabletopGame.jsx"),
  "/app/games/citadels": () => import("./CitadelsGame.jsx"),
  "/app/games/video/arena": () => import("./GoodEtcVideoGame.jsx"),
  "/app/games/video/fortress": () => import("./GoodEtcVideoGame.jsx"),
  "/app/games/video/defense": () => import("./GoodEtcVideoGame.jsx"),
  "/app/games/video/kart": () => import("./GoodEtcVideoGame.jsx"),
  "/app/games/video/bomb": () => import("./GoodEtcVideoGame.jsx"),
  "/app/games/video/snake": () => import("./GoodEtcVideoGame.jsx"),
  "/app/games/video/coin": () => import("./GoodEtcVideoGame.jsx"),
  "/app/games/video/rpg": () => import("./GoodEtcVideoGame.jsx"),
};

const preloadedRoutes = new Set();

const preloadGameRoute = (to) => {
  const preload = gameRoutePreloads[to];
  if (!preload || preloadedRoutes.has(to)) return;
  preloadedRoutes.add(to);
  preload().catch(() => preloadedRoutes.delete(to));
};

const boardGamesByPlayerCount = [...boardGames].sort((left, right) => (
  left.minPlayers - right.minPlayers ||
  left.maxPlayers - right.maxPlayers
));

const videoGamesByPlayerCount = [...videoGames].sort((left, right) => (
  left.minPlayers - right.minPlayers ||
  left.maxPlayers - right.maxPlayers
));

const gameExperienceProfiles = {
  poker: { genre: "카드 심리전", focus: "족보와 베팅 비용을 비교", pace: "중간", feel: "팟을 읽는 긴장감" },
  dice: { genre: "주사위 배팅", focus: "동점 위험과 보상 위치 확인", pace: "빠름", feel: "한 번의 배팅으로 판세 역전" },
  cards: { genre: "카드 판단", focus: "카드 점수와 칩 가치를 비교", pace: "짧음", feel: "가져갈지 버틸지의 압박" },
  catan: { genre: "자원 전략", focus: "자원 생산과 확장 경로 계획", pace: "긴 호흡", feel: "섬을 넓히는 누적 성장" },
  blokus: { genre: "추상 배치", focus: "남은 조각과 모서리 진입로 확인", pace: "중간", feel: "공간을 잠그는 퍼즐감" },
  mahe: { genre: "확률 경주", focus: "주사위 위험과 업힌 순서 판단", pace: "빠름", feel: "욕심과 안전 사이 선택" },
  dalmuti: { genre: "계급 카드", focus: "현재 트릭보다 높은 같은 장수 선택", pace: "빠름", feel: "계급이 뒤집히는 파티감" },
  "six-nimmt": { genre: "벌점 예측", focus: "행 끝 카드와 여섯 번째 위험 확인", pace: "동시", feel: "작은 숫자 차이의 긴장감" },
  telestrations: { genre: "그림 릴레이", focus: "이전 문장/그림을 빠르게 해석", pace: "동시", feel: "결과 공개의 웃음" },
  mafia: { genre: "사회 추리", focus: "밤 결과와 투표 흐름 파악", pace: "단계형", feel: "숨은 역할을 읽는 압박" },
  citadels: { genre: "비밀 역할", focus: "캐릭터 순서와 도시 가치 판단", pace: "턴제", feel: "정체를 숨기는 심리전" },
  arena: { genre: "아레나 액션", focus: "위치, 회피, 발사 타이밍", pace: "실시간", feel: "즉각 반응하는 전투감" },
  fortress: { genre: "포격 대전", focus: "각도와 파워를 차례마다 조정", pace: "턴제", feel: "한 발을 맞히는 손맛" },
  defense: { genre: "협동 디펜스", focus: "웨이브, 타워, 스킬 타이밍", pace: "웨이브", feel: "라인을 지켜내는 압박" },
  kart: { genre: "파티 레이스", focus: "트랙, 드리프트, 아이템 타이밍", pace: "실시간", feel: "짧고 선명한 추월감" },
  bomb: { genre: "폭탄 파티", focus: "설치 위치와 탈출 경로 판단", pace: "실시간", feel: "마지막 칸까지 도망치는 긴장감" },
  snake: { genre: "성장 아케이드", focus: "충돌 회피와 먹이 경로 선택", pace: "실시간", feel: "점점 좁아지는 압박" },
  coin: { genre: "수집 경쟁", focus: "코인 경로와 상대 위치 확인", pace: "실시간", feel: "짧은 시간 안의 점수 러시" },
  rpg: { genre: "솔로 RPG", focus: "탐험, 전투, 진행 저장 확인", pace: "개인 진행", feel: "나만의 성장 루프" },
};

const gameHubAdvisorProfiles = {
  board: {
    title: "보드게임 추천 선택",
    description: "인원과 분위기에 맞는 첫 게임을 빠르게 고르면 방 입장 후 설명서 확인 부담이 줄어듭니다.",
    picks: [
      { preview: "mahe", label: "가볍게 시작", reason: "주사위 위험만 읽으면 바로 참여할 수 있어 첫 판 진입 장벽이 낮습니다." },
      { preview: "catan", label: "전략 깊게", reason: "자원 생산과 확장 계획이 길게 이어져 테이블 전략감을 가장 크게 줍니다." },
      { preview: "telestrations", label: "파티 분위기", reason: "정답보다 결과 공개가 핵심이라 처음 만난 플레이어도 같이 웃기 좋습니다." },
      { preview: "poker", label: "심리전 집중", reason: "족보와 베팅 비용을 비교하는 긴장감이 짧은 세션에서도 선명합니다." },
    ],
  },
  video: {
    title: "비디오게임 추천 선택",
    description: "Good_ETC 게임은 장르별 입력 리듬이 다르므로 원하는 반응 속도와 플레이 감각으로 고르는 편이 좋습니다.",
    picks: [
      { preview: "rpg", label: "혼자 몰입", reason: "로컬 저장 흐름과 탐험 루프가 있어 혼자 플레이 감각을 확인하기 좋습니다." },
      { preview: "fortress", label: "차분한 대전", reason: "각도와 파워를 보정하는 턴제 구조라 조작 부담이 낮고 결과가 명확합니다." },
      { preview: "defense", label: "협동 방어", reason: "웨이브와 스킬 타이밍을 같이 맞추는 팀 플레이 감각이 강합니다." },
      { preview: "arena", label: "즉시 반응", reason: "이동, 회피, 발사가 빠르게 이어져 실시간 전투감을 바로 확인할 수 있습니다." },
    ],
  },
};

const gameSectionsByTab = {
  board: [
    {
      title: "보드게임 목록",
      description: "기존 보드게임은 같은 방 만들기, 코드 입장, 준비하기 흐름으로 플레이합니다.",
      games: boardGamesByPlayerCount,
    },
  ],
  video: [
    {
      title: "비디오게임 목록",
      description: "Good_ETC 게임을 홈페이지 방 입장 흐름으로 이식합니다.",
      games: videoGamesByPlayerCount,
    },
  ],
};

const gamesByPreview = new Map([...boardGames, ...videoGames].map((game) => [game.preview, game]));

const GameHubJourneyPanel = ({ activeTab }) => {
  const isVideo = activeTab === "video";
  const gameCount = isVideo ? videoGames.length : boardGames.length;
  const featuredCount = (isVideo ? videoGames : boardGames).filter((game) => game.featured).length;
  const steps = [
    {
      key: "select",
      icon: "decision",
      label: "게임 선택",
      value: `${gameCount}개`,
      detail: isVideo
        ? "장르, 입력 리듬, 플레이 감각을 보고 Good_ETC 게임을 고릅니다."
        : "인원, 첫 판단 포인트, 플레이 감각을 보고 보드게임을 고릅니다.",
    },
    {
      key: "room",
      icon: "stage",
      label: "방 만들기 / 입장",
      value: "방 코드",
      detail: "공개 방에 들어가거나 새 방을 만들고, 친구가 있으면 방 코드로 바로 합류합니다.",
    },
    {
      key: "ready",
      icon: "player",
      label: "준비 확인",
      value: isVideo ? "입력 브리지" : "준비 상태",
      detail: isVideo
        ? "참가자 준비와 Good_ETC iframe 입력 브리지 상태를 본게임 전에 확인합니다."
        : "방장, 참가자 준비, 선택 규칙, 최소 인원 조건을 본게임 전에 확인합니다.",
    },
    {
      key: "play",
      icon: isVideo ? "input" : "signal",
      label: "플레이 피드백",
      value: isVideo ? "입력·상태" : "판세·행동",
      detail: isVideo
        ? "플레이 중에는 입력 피드백, 세션 흐름, 결과 패널이 화면 안에 남습니다."
        : "플레이 중에는 현재 차례, 가능한 행동, 최근 행동, 승패 근거가 화면 안에 남습니다.",
    },
  ];

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-3 shadow-lg"
      data-smoke="game-hub-journey-panel"
      data-active-tab={activeTab}
    >
      <div className="flex flex-col gap-2 px-1 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-500">
            <GameUxGlyph type="turn" className="h-3.5 w-3.5 text-primary-600" />
            공통 시작 루트
          </div>
          <h2 className="mt-2 text-lg font-black text-slate-900 sm:text-xl">
            {isVideo ? "비디오게임 시작 흐름" : "보드게임 시작 흐름"}
          </h2>
          <p className="mt-1 max-w-3xl text-xs font-bold leading-relaxed text-slate-500 sm:text-sm">
            목록에서 바로 입장해도 같은 방 흐름을 따라가므로, 처음 보는 게임도 어느 단계인지 잃지 않게 설계했습니다.
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-right">
          <div className="text-[10px] font-black text-slate-400">대표 경험</div>
          <div className="mt-0.5 text-sm font-black text-slate-900">{featuredCount}/{gameCount}개</div>
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-4">
        {steps.map((step, index) => (
          <div key={step.key} className="min-h-[116px] rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" data-smoke="game-hub-journey-step">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white">
                <GameUxGlyph type={step.icon} className="h-4 w-4" />
              </div>
              <div className="text-[10px] font-black text-slate-400">{index + 1}/4</div>
            </div>
            <div className="mt-2 text-[11px] font-black text-slate-500">{step.label}</div>
            <div className="mt-1 text-sm font-black text-slate-950">{step.value}</div>
            <div className="mt-1 line-clamp-3 text-xs font-bold leading-relaxed text-slate-600">{step.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
};

const resumePanelProfiles = {
  board: {
    badge: "저장된 방 복귀",
    title: "마지막으로 들어간 방을 바로 찾기",
    description: "이전에 들어간 방이 남아 있으면 게임 화면으로 돌아가 이어서 확인할 수 있습니다.",
    itemLabel: "최근 방",
    itemCta: "복귀 화면 열기",
    emptyTitle: "저장된 방이 없습니다",
    emptyDetail: "새 방을 만들거나 방 코드로 입장하면 다음 방문 때 이 영역에서 찾을 수 있습니다.",
    emptyTo: "/app/poker",
    emptyCta: "첫 방 만들기",
  },
  video: {
    badge: "저장된 비디오게임 흐름",
    title: "최근 비디오게임 흐름으로 돌아가기",
    description: "Good_ETC 방이나 RPG 진행 흔적이 남아 있으면 바로 이어갈 후보를 보여줍니다.",
    itemLabel: "최근 흐름",
    itemCta: "이어가기 화면 열기",
    emptyTitle: "저장된 비디오게임 흐름이 없습니다",
    emptyDetail: "비디오게임을 열어 방을 만들거나 RPG 진행을 시작하면 다음 방문 때 이어가기 맥락을 확인할 수 있습니다.",
    emptyTo: "/app/games/video/arena",
    emptyCta: "첫 비디오게임 방 열기",
  },
};

const GameHubResumeEmptyState = ({ profile, activeTab = "board" }) => {
  return (
    <div
      className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3"
      data-smoke="game-hub-resume-empty"
      data-empty-tab={activeTab}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-emerald-700 shadow-sm">
            <GameUxGlyph type="input" className="h-3.5 w-3.5" />
            최근 방 없음
          </div>
          <h3 className="mt-2 text-base font-black text-slate-950">{profile.emptyTitle}</h3>
          <p className="mt-1 max-w-2xl text-xs font-bold leading-relaxed text-slate-500 sm:text-sm">{profile.emptyDetail}</p>
        </div>
        <Link
          to={profile.emptyTo}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-black text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
          data-smoke="game-hub-resume-empty-entry"
          onMouseEnter={() => preloadGameRoute(profile.emptyTo)}
          onFocus={() => preloadGameRoute(profile.emptyTo)}
        >
          {profile.emptyCta}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
};

const GameHubResumePanel = ({ entries, activeTab = "board" }) => {
  const profile = resumePanelProfiles[activeTab] || resumePanelProfiles.board;
  const visibleEntries = entries.slice(0, 4);
  const hasEntries = entries.length > 0;
  if (!hasEntries) return null;

  return (
    <section
      className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3"
      data-smoke="game-hub-resume-panel"
      data-active-tab={activeTab}
      data-resume-count={entries.length}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-sm font-black text-emerald-900">
            <GameUxGlyph type="stage" className="h-3.5 w-3.5" />
            {profile.badge}
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-emerald-700">{entries.length}개</span>
      </div>

      <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {visibleEntries.map((entry) => {
            const displayTitle = entry.resumeKind === "room" ? entry.resumeTitle : entry.resumeValue;
            const compactLabel = displayTitle || profile.itemLabel;
            const detailText = entry.resumeKind === "room"
              ? `${entry.title} 최근 방`
              : entry.title;
            return (
              <Link
                key={entry.resumeStorageKey}
                to={entry.to}
                aria-label={`${entry.title} ${compactLabel} ${profile.itemCta}`}
                className="group flex min-h-[108px] flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
                data-smoke="game-hub-resume-item"
                data-game-title={entry.title}
                data-resume-kind={entry.resumeKind}
                data-room-title={entry.resumeTitle || ""}
                data-storage-key={entry.resumeStorageKey}
                title={profile.description}
                onMouseEnter={() => preloadGameRoute(entry.to)}
                onFocus={() => preloadGameRoute(entry.to)}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block text-[10px] font-black text-emerald-600">{entry.title}</span>
                    <span className="mt-1 block truncate text-base font-black text-slate-950">{compactLabel}</span>
                  </span>
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
                    <GameUxGlyph type="stage" className="h-4 w-4" />
                  </span>
                </span>
                <span className="mt-3 flex items-center justify-between gap-2 text-xs font-black text-slate-500">
                  <span className="min-w-0 truncate">{detailText}</span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-emerald-700">
                    {profile.itemCta}
                    <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </span>
                </span>
              </Link>
            );
          })}
      </div>
    </section>
  );
};

const choiceMapProfiles = {
  board: {
    title: "보드게임 선택 지도",
    subtitle: "인원, 템포, 첫 판단 기준을 한 번에 비교해 방 만들기 전에 맞는 테이블을 고릅니다.",
    xLabel: "인원 부담",
    yLabel: "전략 압력",
    lanes: [
      { key: "quick", label: "가볍게 시작", detail: "주사위·짧은 카드 판단", picks: ["mahe", "cards", "dice"], tone: "emerald" },
      { key: "strategy", label: "깊은 전략", detail: "자원·배치·도시 성장", picks: ["catan", "blokus", "citadels"], tone: "amber" },
      { key: "party", label: "파티 흐름", detail: "웃음·토론·동시 진행", picks: ["telestrations", "mafia", "six-nimmt"], tone: "sky" },
      { key: "cards", label: "카드 심리전", detail: "베팅·트릭·순점수", picks: ["poker", "dalmuti", "cards"], tone: "rose" },
    ],
  },
  video: {
    title: "비디오게임 선택 지도",
    subtitle: "입력 속도, 협동 여부, 저장 흐름을 비교해 Good_ETC 게임의 첫 플레이 부담을 줄입니다.",
    xLabel: "입력 속도",
    yLabel: "협동 압력",
    lanes: [
      { key: "solo", label: "혼자 몰입", detail: "저장·탐험·성장 루프", picks: ["rpg", "coin"], tone: "emerald" },
      { key: "turn", label: "차분한 대전", detail: "각도·파워·턴 결과", picks: ["fortress"], tone: "amber" },
      { key: "coop", label: "같이 버티기", detail: "웨이브·라인·스킬", picks: ["defense"], tone: "sky" },
      { key: "reflex", label: "즉시 반응", detail: "이동·회피·충돌 판단", picks: ["arena", "kart", "bomb", "snake"], tone: "rose" },
    ],
  },
};

const choiceMapTone = {
  emerald: { fill: "#10b981", soft: "#d1fae5", dark: "#065f46", text: "text-emerald-800", shell: "border-emerald-200 bg-emerald-50" },
  amber: { fill: "#f59e0b", soft: "#fef3c7", dark: "#92400e", text: "text-amber-800", shell: "border-amber-200 bg-amber-50" },
  sky: { fill: "#0ea5e9", soft: "#e0f2fe", dark: "#075985", text: "text-sky-800", shell: "border-sky-200 bg-sky-50" },
  rose: { fill: "#f43f5e", soft: "#ffe4e6", dark: "#9f1239", text: "text-rose-800", shell: "border-rose-200 bg-rose-50" },
};

const gameHubFilterOptions = [
  {
    key: "all",
    label: "전체",
    value: "모든 후보",
    detail: "탭의 모든 게임을 기존 정렬 그대로 봅니다.",
    predicate: () => true,
  },
  {
    key: "solo",
    label: "혼자 가능",
    value: "1인 시작",
    detail: "혼자 방을 만들거나 AI/솔로 흐름으로 시작할 수 있습니다.",
    predicate: (game) => Number(game.minPlayers || 0) <= 1,
  },
  {
    key: "small",
    label: "2~4인",
    value: "소규모 방",
    detail: "두세 명부터 네 명 안팎에서 바로 돌릴 후보입니다.",
    predicate: (game) => Number(game.minPlayers || 0) <= 4 && Number(game.maxPlayers || 0) >= 2,
  },
  {
    key: "party",
    label: "5인 이상",
    value: "큰 방",
    detail: "다인 파티, 토론, 대규모 경쟁에 맞는 후보입니다.",
    predicate: (game) => Number(game.maxPlayers || 0) >= 5,
  },
];

const gameChoiceMapPosition = (game, index, activeTab) => {
  const maxPlayers = Number(game.maxPlayers || 1);
  const minPlayers = Number(game.minPlayers || 1);
  const xBase = activeTab === "video"
    ? Math.min(300, 74 + index * 38)
    : Math.min(300, 56 + (maxPlayers - 1) * 35);
  const paceText = gameExperienceProfiles[game.preview]?.pace || "";
  const yBase = paceText.includes("긴")
    ? 58
    : paceText.includes("중")
      ? 84
      : paceText.includes("동시")
        ? 112
        : paceText.includes("실시간")
          ? 72
          : 126;
  return {
    x: xBase + (minPlayers > 1 ? 8 : 0),
    y: yBase + (index % 2 ? 7 : -5),
  };
};

const GameHubChoiceMapArt = ({ activeTab, lanes }) => {
  const games = activeTab === "video" ? videoGames : boardGames;
  const visibleGames = games.slice(0, activeTab === "video" ? 8 : 11);
  return (
    <svg
      viewBox="0 0 360 210"
      role="img"
      aria-label="게임 선택 지도"
      className="h-full min-h-[210px] w-full"
      data-smoke="game-hub-choice-map-art"
    >
      <rect x="10" y="10" width="340" height="190" rx="22" fill="#0f172a" />
      <rect x="34" y="34" width="292" height="132" rx="16" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="3" />
      <path d="M58 147h260M58 57v108" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
      <path d="M58 147c54-60 110-24 160-70 38-35 70-18 100-44" fill="none" stroke="#0f172a" strokeWidth="3" opacity=".22" />
      {lanes.map((lane, index) => {
        const tone = choiceMapTone[lane.tone] || choiceMapTone.emerald;
        const y = 46 + index * 33;
        return (
          <g key={lane.key}>
            <rect x="226" y={y - 10} width="86" height="21" rx="10" fill={tone.soft} stroke={tone.fill} strokeWidth="2" />
            <circle cx="238" cy={y} r="5" fill={tone.fill} />
            <text x="248" y={y + 4} fontSize="8.5" fontWeight="900" fill={tone.dark}>{lane.label}</text>
          </g>
        );
      })}
      {visibleGames.map((game, index) => {
        const lane = lanes.find((item) => item.picks.includes(game.preview)) || lanes[index % lanes.length];
        const tone = choiceMapTone[lane?.tone] || choiceMapTone.emerald;
        const position = gameChoiceMapPosition(game, index, activeTab);
        return (
          <g key={game.preview} transform={`translate(${position.x} ${position.y})`} data-smoke="game-hub-choice-map-dot">
            <circle r="10" fill={tone.fill} stroke="#ffffff" strokeWidth="3" />
            <text y="4" textAnchor="middle" fontSize="8" fontWeight="900" fill="#ffffff">{index + 1}</text>
          </g>
        );
      })}
      <text x="36" y="26" fontSize="10" fontWeight="900" fill="#bfdbfe">선택 지도</text>
      <text x="180" y="188" textAnchor="middle" fontSize="10" fontWeight="900" fill="#e2e8f0">{activeTab === "video" ? "느긋한 입력  ->  빠른 반응" : "적은 인원  ->  많은 인원"}</text>
      <text x="24" y="108" textAnchor="middle" fontSize="10" fontWeight="900" fill="#e2e8f0" transform="rotate(-90 24 108)">
        {activeTab === "video" ? "혼자  ->  협동/대전" : "가벼움  ->  깊은 전략"}
      </text>
    </svg>
  );
};

const GameHubChoiceMapPanel = ({ activeTab }) => {
  const profile = choiceMapProfiles[activeTab] || choiceMapProfiles.board;
  const games = activeTab === "video" ? videoGames : boardGames;
  const soloCount = games.filter((game) => Number(game.minPlayers || 0) <= 1).length;
  const groupCount = games.filter((game) => Number(game.maxPlayers || 0) >= 4).length;
  const highlightedGames = profile.lanes
    .flatMap((lane) => lane.picks)
    .map((preview) => gamesByPreview.get(preview))
    .filter(Boolean);
  const uniqueHighlighted = [...new Map(highlightedGames.map((game) => [game.preview, game])).values()];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-lg" data-smoke="game-hub-choice-map-panel" data-active-tab={activeTab}>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,360px)_1fr]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
          <GameHubChoiceMapArt activeTab={activeTab} lanes={profile.lanes} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                <GameUxGlyph type="signal" className="h-4 w-4 text-primary-600" />
                {profile.title}
              </div>
              <p className="mt-1 text-sm font-bold leading-relaxed text-slate-600">{profile.subtitle}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-right">
              <div className="rounded-xl bg-slate-100 px-3 py-2">
                <div className="text-[10px] font-black text-slate-400">혼자 가능</div>
                <div className="text-sm font-black text-slate-950">{soloCount}개</div>
              </div>
              <div className="rounded-xl bg-slate-100 px-3 py-2">
                <div className="text-[10px] font-black text-slate-400">4인 이상</div>
                <div className="text-sm font-black text-slate-950">{groupCount}개</div>
              </div>
            </div>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {profile.lanes.map((lane) => {
              const tone = choiceMapTone[lane.tone] || choiceMapTone.emerald;
              const laneGames = lane.picks.map((preview) => gamesByPreview.get(preview)).filter(Boolean);
              return (
                <div key={lane.key} className={`min-h-[116px] rounded-xl border px-3 py-2 ${tone.shell}`} data-smoke="game-hub-choice-map-lane">
                  <div className={`flex items-center gap-2 text-[11px] font-black ${tone.text}`}>
                    <GameUxGlyph type="decision" className="h-3.5 w-3.5" />
                    {lane.label}
                  </div>
                  <div className="mt-2 text-sm font-black text-slate-950">{lane.detail}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {laneGames.slice(0, 4).map((game) => (
                      <span key={game.preview} className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-600 ring-1 ring-slate-100">
                        {game.title}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-bold leading-relaxed text-slate-600">
            추천 후보 {uniqueHighlighted.length}개를 지도 위에 배치했습니다. 세부 규칙은 각 카드의 설명서와 입장 후 준비 패널에서 다시 확인합니다.
          </div>
        </div>
      </div>
    </section>
  );
};

const GameHubFilterLensArt = ({ activeFilter, counts, activeTab }) => {
  const activeIndex = Math.max(0, gameHubFilterOptions.findIndex((option) => option.key === activeFilter));
  const maxCount = Math.max(1, ...gameHubFilterOptions.map((option) => counts[option.key] || 0));
  return (
    <svg
      viewBox="0 0 320 128"
      role="img"
      aria-label="게임 조건 필터 요약"
      className="h-full min-h-[128px] w-full"
      data-smoke="game-hub-filter-lens-art"
    >
      <rect x="8" y="8" width="304" height="112" rx="18" fill="#0f172a" />
      <path d="M42 92h238M42 30v62" stroke="#64748b" strokeWidth="3" strokeLinecap="round" />
      {gameHubFilterOptions.map((option, index) => {
        const count = counts[option.key] || 0;
        const height = Math.max(10, Math.round((count / maxCount) * 54));
        const x = 58 + index * 56;
        const selected = index === activeIndex;
        const fill = selected ? "#38bdf8" : "#334155";
        return (
          <g key={option.key} data-smoke="game-hub-filter-lens-bar">
            <rect x={x} y={88 - height} width="28" height={height} rx="7" fill={fill} stroke={selected ? "#bae6fd" : "#475569"} strokeWidth="2" />
            <circle cx={x + 14} cy={selected ? 28 : 34} r={selected ? 9 : 6} fill={selected ? "#fbbf24" : "#94a3b8"} />
            <text x={x + 14} y="107" textAnchor="middle" fontSize="8" fontWeight="900" fill="#e2e8f0">{count}</text>
          </g>
        );
      })}
      <text x="24" y="24" fontSize="9" fontWeight="900" fill="#bfdbfe">조건 필터</text>
      <text x="296" y="24" textAnchor="end" fontSize="9" fontWeight="900" fill="#e2e8f0">{activeTab === "video" ? "비디오" : "보드"}</text>
      <text x="160" y="116" textAnchor="middle" fontSize="9" fontWeight="900" fill="#cbd5e1">전체 · 혼자 가능 · 2~4인 · 5인 이상</text>
    </svg>
  );
};

const GameHubQuickFilterPanel = ({ activeTab, activeFilter, onFilterChange }) => {
  const games = activeTab === "video" ? videoGames : boardGames;
  const counts = Object.fromEntries(gameHubFilterOptions.map((option) => [option.key, games.filter(option.predicate).length]));
  const selectedOption = gameHubFilterOptions.find((option) => option.key === activeFilter) || gameHubFilterOptions[0];
  const selectedCount = counts[selectedOption.key] || 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3" data-smoke="game-hub-filter-panel" data-active-filter={activeFilter}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-sm font-black text-slate-950">
          <GameUxGlyph type="decision" className="h-4 w-4 text-primary-600" />
          조건 필터
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">{selectedCount}개</span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {gameHubFilterOptions.map((option) => {
          const selected = option.key === activeFilter;
          return (
            <button
              key={option.key}
              type="button"
              className={`min-h-11 rounded-xl border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 ${
                selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
              }`}
              onClick={() => onFilterChange(option.key)}
              aria-label={`${option.label} 필터: ${option.detail}`}
              title={option.detail}
              data-smoke="game-hub-filter-option"
              data-selected={selected ? "true" : "false"}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-black">{option.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${selected ? "bg-white/15 text-white" : "bg-white text-slate-500"}`}>
                  {counts[option.key] || 0}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

const GameHubFilterResultArt = ({ activeTab, activeFilter, visibleCount }) => {
  const selectedIndex = Math.max(0, gameHubFilterOptions.findIndex((option) => option.key === activeFilter));
  const nodes = [
    { key: "filter", x: 44, y: 72, label: "조건", fill: "#0ea5e9" },
    { key: "count", x: 114, y: 44, label: `${visibleCount}개`, fill: visibleCount ? "#22c55e" : "#f43f5e" },
    { key: "entry", x: 190, y: 76, label: visibleCount ? "입장" : "대기", fill: "#f59e0b" },
    { key: "reset", x: 268, y: 48, label: "전체", fill: "#7c3aed" },
  ];
  return (
    <svg
      viewBox="0 0 320 140"
      role="img"
      aria-label="게임 필터 결과 브리핑"
      className="h-full min-h-[140px] w-full"
      data-smoke="game-hub-filter-result-art"
    >
      <rect x="10" y="10" width="300" height="120" rx="22" fill="#0f172a" />
      <path d="M44 72C82 36 128 42 160 68s70 36 108-20" fill="none" stroke="#e2e8f0" strokeWidth="5" strokeLinecap="round" opacity=".82" />
      <path d="M52 104h226" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
      {nodes.map((node, index) => (
        <g key={node.key} data-smoke="game-hub-filter-result-node" data-node-key={node.key}>
          <circle cx={node.x} cy={node.y} r={index === selectedIndex ? 20 : 17} fill={node.fill} stroke="#ffffff" strokeWidth="4" />
          <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#ffffff">{node.label}</text>
        </g>
      ))}
      <text x="28" y="28" fontSize="9" fontWeight="900" fill="#bfdbfe">필터 결과</text>
      <text x="292" y="28" textAnchor="end" fontSize="9" fontWeight="900" fill="#e2e8f0">{activeTab === "video" ? "비디오" : "보드"}</text>
      <text x="160" y="122" textAnchor="middle" fontSize="9" fontWeight="900" fill="#cbd5e1">{"조건 확인 -> 후보 입장 -> 전체 보기"}</text>
    </svg>
  );
};

const GameHubFilterResultPanel = ({ activeTab, activeFilter, visibleGames, onResetFilter }) => {
  if (activeFilter === "all") return null;
  const selectedOption = gameHubFilterOptions.find((option) => option.key === activeFilter) || gameHubFilterOptions[0];
  const firstGame = visibleGames[0];
  const isVideo = activeTab === "video";
  const items = [
    {
      key: "condition",
      label: "현재 조건",
      value: selectedOption.label,
      detail: `${selectedOption.value} 기준으로 후보를 좁혔습니다.`,
    },
    {
      key: "candidate",
      label: "후보 수",
      value: `${visibleGames.length}개`,
      detail: firstGame ? `${firstGame.title}부터 바로 열 수 있습니다.` : "현재 조건에는 바로 열 후보가 없습니다.",
    },
    {
      key: "recover",
      label: "복구 경로",
      value: "전체 보기",
      detail: "조건이 너무 좁으면 전체 필터로 돌아가 숨겨진 후보를 다시 봅니다.",
    },
  ];

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-3 shadow-lg"
      data-smoke="game-hub-filter-result-panel"
      data-active-tab={activeTab}
      data-active-filter={activeFilter}
      data-visible-count={visibleGames.length}
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,320px)_1fr]">
        <div className="overflow-hidden rounded-xl bg-slate-950">
          <GameHubFilterResultArt activeTab={activeTab} activeFilter={activeFilter} visibleCount={visibleGames.length} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                <GameUxGlyph type="signal" className="h-4 w-4 text-primary-600" />
                {isVideo ? "비디오게임 필터 결과" : "보드게임 필터 결과"}
              </div>
              <p className="mt-1 text-sm font-bold leading-relaxed text-slate-600">
                현재 조건으로 보이는 후보와 다음 행동을 따로 분리해, 줄어든 목록에서도 방 입장 흐름을 잃지 않게 합니다.
              </p>
            </div>
            <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">
              {selectedOption.value}
            </span>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {items.map((item) => (
              <div key={item.key} className="min-h-[94px] rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" data-smoke="game-hub-filter-result-item" data-result-key={item.key}>
                <div className="text-[10px] font-black text-slate-400">{item.label}</div>
                <div className="mt-1 text-sm font-black text-slate-950">{item.value}</div>
                <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">{item.detail}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {firstGame && (
              <Link
                to={firstGame.to}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
                onMouseEnter={() => preloadGameRoute(firstGame.to)}
                onFocus={() => preloadGameRoute(firstGame.to)}
                data-smoke="game-hub-filter-result-entry"
              >
                첫 후보 입장
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            <button
              type="button"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
              onClick={() => onResetFilter("all")}
              aria-label="전체 필터로 결과 다시 보기"
              data-smoke="game-hub-filter-result-reset"
            >
              전체 보기
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

const GameHubSectionEmptyArt = ({ activeTab, activeFilter, sectionTitle }) => {
  const selectedOption = gameHubFilterOptions.find((option) => option.key === activeFilter) || gameHubFilterOptions[0];
  const nodes = [
    { key: "section", x: 46, y: 76, label: "섹션", fill: "#0ea5e9" },
    { key: "filter", x: 122, y: 46, label: selectedOption.label, fill: "#f59e0b" },
    { key: "empty", x: 196, y: 82, label: "0개", fill: "#f43f5e" },
    { key: "reset", x: 274, y: 50, label: "전체", fill: "#10b981" },
  ];

  return (
    <svg
      viewBox="0 0 320 150"
      role="img"
      aria-label={`${sectionTitle} 필터 빈 결과 안내`}
      className="h-full min-h-[150px] w-full"
      data-smoke="game-hub-section-empty-art"
      focusable="false"
    >
      <rect x="10" y="10" width="300" height="128" rx="22" fill="#0f172a" />
      <path d="M46 76C82 36 120 36 154 66s74 44 120-16" fill="none" stroke="#e2e8f0" strokeWidth="5" strokeLinecap="round" opacity=".78" />
      <path d="M44 112h232" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
      <rect x="38" y="106" width="60" height="16" rx="8" fill="#1e293b" />
      <rect x="114" y="106" width="60" height="16" rx="8" fill="#1e293b" />
      <rect x="190" y="106" width="60" height="16" rx="8" fill="#334155" />
      {nodes.map((node, index) => (
        <g key={node.key} data-smoke="game-hub-section-empty-node" data-node-key={node.key}>
          <circle cx={node.x} cy={node.y} r={index === 2 ? 20 : 17} fill={node.fill} stroke="#ffffff" strokeWidth="4" />
          <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#ffffff">{node.label}</text>
        </g>
      ))}
      <text x="28" y="30" fontSize="9" fontWeight="900" fill="#bfdbfe">섹션 결과</text>
      <text x="292" y="30" textAnchor="end" fontSize="9" fontWeight="900" fill="#e2e8f0">{activeTab === "video" ? "비디오" : "보드"}</text>
      <text x="160" y="134" textAnchor="middle" fontSize="9" fontWeight="900" fill="#cbd5e1">조건을 넓히면 숨겨진 후보를 다시 볼 수 있습니다</text>
    </svg>
  );
};

const GameHubSectionEmptyState = ({ section, activeTab, activeFilter, onResetFilter }) => {
  const selectedOption = gameHubFilterOptions.find((option) => option.key === activeFilter) || gameHubFilterOptions[0];
  const isFiltered = activeFilter !== "all";
  const items = [
    {
      key: "condition",
      label: "현재 조건",
      value: selectedOption.label,
      detail: `${selectedOption.value} 기준으로 이 섹션을 다시 걸렀습니다.`,
      icon: "decision",
    },
    {
      key: "scope",
      label: "비어 있는 범위",
      value: section.title,
      detail: "다른 섹션에 후보가 남아도 이 묶음에는 조건에 맞는 카드가 없습니다.",
      icon: "stage",
    },
    {
      key: "recover",
      label: "복구 행동",
      value: isFiltered ? "전체 보기" : "조건 유지",
      detail: isFiltered ? "전체 필터로 돌아가 숨겨진 게임을 다시 펼칩니다." : "현재 탭에는 이 섹션 후보가 준비되지 않았습니다.",
      icon: "turn",
    },
  ];

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
      data-smoke="game-hub-section-empty-state"
      data-active-tab={activeTab}
      data-active-filter={activeFilter}
      data-section-title={section.title}
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,280px)_1fr]">
        <div className="overflow-hidden rounded-xl bg-slate-950">
          <GameHubSectionEmptyArt activeTab={activeTab} activeFilter={activeFilter} sectionTitle={section.title} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                <GameUxGlyph type="signal" className="h-4 w-4 text-primary-600" />
                {section.title} 후보 없음
              </div>
              <p className="mt-1 text-sm font-bold leading-relaxed text-slate-600">
                이 섹션에는 현재 필터에 맞는 게임 카드가 없습니다. 조건을 넓히거나 다른 섹션의 후보를 먼저 확인하세요.
              </p>
            </div>
            <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">
              {selectedOption.value}
            </span>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {items.map((item) => (
              <div key={item.key} className="min-h-[94px] rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" data-smoke="game-hub-section-empty-item" data-empty-key={item.key}>
                <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400">
                  <GameUxGlyph type={item.icon} className="h-3.5 w-3.5" />
                  {item.label}
                </div>
                <div className="mt-1 truncate text-sm font-black text-slate-950">{item.value}</div>
                <div className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-slate-500">{item.detail}</div>
              </div>
            ))}
          </div>
          {isFiltered && (
            <button
              type="button"
              className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
              onClick={() => onResetFilter("all")}
              aria-label={`${section.title} 섹션 전체 필터로 다시 보기`}
              data-smoke="game-hub-section-empty-reset"
            >
              전체 보기
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const GameHubSectionFilterBriefArt = ({ activeTab, activeFilter, visibleCount, hiddenCount }) => {
  const selectedOption = gameHubFilterOptions.find((option) => option.key === activeFilter) || gameHubFilterOptions[0];
  const nodes = [
    { key: "filter", x: 48, y: 70, label: selectedOption.label, fill: "#0ea5e9" },
    { key: "visible", x: 122, y: 48, label: `${visibleCount}개`, fill: "#22c55e" },
    { key: "hidden", x: 196, y: 82, label: `${hiddenCount}숨김`, fill: "#f59e0b" },
    { key: "reset", x: 276, y: 50, label: "전체", fill: "#7c3aed" },
  ];

  return (
    <svg
      viewBox="0 0 320 140"
      role="img"
      aria-label="섹션 필터 결과 브리핑"
      className="h-full min-h-[140px] w-full"
      data-smoke="game-hub-section-filter-art"
      focusable="false"
    >
      <rect x="10" y="10" width="300" height="120" rx="22" fill="#0f172a" />
      <path d="M48 70C84 38 120 40 156 68s76 38 120-18" fill="none" stroke="#e2e8f0" strokeWidth="5" strokeLinecap="round" opacity=".8" />
      <path d="M46 108h230" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
      {nodes.map((node) => (
        <g key={node.key} data-smoke="game-hub-section-filter-node" data-node-key={node.key}>
          <circle cx={node.x} cy={node.y} r="18" fill={node.fill} stroke="#ffffff" strokeWidth="4" />
          <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#ffffff">{node.label}</text>
        </g>
      ))}
      <text x="28" y="28" fontSize="9" fontWeight="900" fill="#bfdbfe">섹션 필터</text>
      <text x="292" y="28" textAnchor="end" fontSize="9" fontWeight="900" fill="#e2e8f0">{activeTab === "video" ? "비디오" : "보드"}</text>
      <text x="160" y="124" textAnchor="middle" fontSize="9" fontWeight="900" fill="#cbd5e1">보이는 후보와 숨겨진 후보를 분리해 읽습니다</text>
    </svg>
  );
};

const GameHubSectionFilterBrief = ({ section, activeTab, activeFilter, totalCount = 0, onResetFilter }) => {
  if (activeFilter === "all") return null;
  const selectedOption = gameHubFilterOptions.find((option) => option.key === activeFilter) || gameHubFilterOptions[0];
  const visibleCount = section.games.length;
  const hiddenCount = Math.max(0, Number(totalCount || 0) - visibleCount);
  const items = [
    {
      key: "visible",
      label: "보이는 후보",
      value: `${visibleCount}개`,
      detail: `${selectedOption.label} 조건으로 바로 열 수 있는 카드입니다.`,
      icon: "stage",
    },
    {
      key: "hidden",
      label: "숨겨진 후보",
      value: `${hiddenCount}개`,
      detail: "조건을 넓히면 같은 섹션 안의 다른 게임도 다시 보입니다.",
      icon: "recent",
    },
    {
      key: "recover",
      label: "복구 행동",
      value: "전체 보기",
      detail: "목록이 너무 좁으면 전체 필터로 되돌아가 비교 범위를 회복합니다.",
      icon: "turn",
    },
  ];

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
      data-smoke="game-hub-section-filter-brief"
      data-active-tab={activeTab}
      data-active-filter={activeFilter}
      data-section-title={section.title}
      data-visible-count={visibleCount}
      data-hidden-count={hiddenCount}
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,280px)_1fr]">
        <div className="overflow-hidden rounded-xl bg-slate-950">
          <GameHubSectionFilterBriefArt activeTab={activeTab} activeFilter={activeFilter} visibleCount={visibleCount} hiddenCount={hiddenCount} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                <GameUxGlyph type="decision" className="h-4 w-4 text-primary-600" />
                {section.title} 필터 브리핑
              </div>
              <p className="mt-1 text-sm font-bold leading-relaxed text-slate-600">
                현재 조건으로 남은 후보와 숨겨진 후보를 분리해, 좁아진 목록에서도 다음 선택과 복구 경로를 놓치지 않게 합니다.
              </p>
            </div>
            <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">
              {selectedOption.value}
            </span>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {items.map((item) => (
              <div key={item.key} className="min-h-[94px] rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" data-smoke="game-hub-section-filter-item" data-filter-key={item.key}>
                <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400">
                  <GameUxGlyph type={item.icon} className="h-3.5 w-3.5" />
                  {item.label}
                </div>
                <div className="mt-1 truncate text-sm font-black text-slate-950">{item.value}</div>
                <div className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-slate-500">{item.detail}</div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
            onClick={() => onResetFilter("all")}
            aria-label={`${section.title} 섹션 전체 필터로 다시 보기`}
            data-smoke="game-hub-section-filter-reset"
          >
            전체 보기
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const GameHubVideoBridgeArt = ({ visibleCount = 0, soloCount = 0, groupCount = 0, fastCount = 0 }) => {
  const nodes = [
    { key: "list", x: 50, y: 92, label: "목록", value: `${visibleCount}개`, fill: "#38bdf8" },
    { key: "room", x: 128, y: 48, label: "방", value: `${groupCount}개`, fill: "#10b981" },
    { key: "input", x: 216, y: 90, label: "입력", value: `${fastCount}개`, fill: "#f59e0b" },
    { key: "frame", x: 294, y: 50, label: "화면", value: `${soloCount}개`, fill: "#8b5cf6" },
  ];
  return (
    <svg
      viewBox="0 0 340 190"
      role="img"
      aria-label="Good ETC 비디오게임 입력 브리지 흐름"
      className="h-full min-h-[190px] w-full"
      data-smoke="game-hub-video-bridge-art"
    >
      <rect x="12" y="12" width="316" height="166" rx="24" fill="#0f172a" />
      <path d="M50 92C86 28 126 58 162 88s78 42 132-38" fill="none" stroke="#e2e8f0" strokeWidth="5" strokeLinecap="round" opacity=".82" />
      <path d="M44 144h250" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
      <rect x="38" y="122" width="80" height="34" rx="12" fill="#ffffff" opacity=".95" />
      <circle cx="57" cy="139" r="6" fill="#0f172a" />
      <circle cx="75" cy="139" r="6" fill="#0f172a" opacity=".64" />
      <rect x="90" y="134" width="19" height="8" rx="4" fill="#38bdf8" />
      <rect x="184" y="120" width="94" height="50" rx="14" fill="#ffffff" opacity=".95" />
      <rect x="196" y="132" width="42" height="10" rx="5" fill="#bae6fd" />
      <rect x="196" y="150" width="64" height="8" rx="4" fill="#bbf7d0" />
      <circle cx="268" cy="136" r="6" fill="#f59e0b" />
      <circle cx="268" cy="154" r="6" fill="#10b981" />
      {nodes.map((node) => (
        <g key={node.key} data-smoke="game-hub-video-bridge-node" data-bridge-key={node.key}>
          <circle cx={node.x} cy={node.y} r="18" fill={node.fill} stroke="#ffffff" strokeWidth="4" />
          <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#ffffff">{node.label}</text>
          <text x={node.x} y={node.y + 31} textAnchor="middle" fontSize="9" fontWeight="900" fill="#cbd5e1">{node.value}</text>
        </g>
      ))}
      <text x="26" y="30" fontSize="9" fontWeight="900" fill="#bfdbfe">Good_ETC 브리지</text>
      <text x="314" y="30" textAnchor="end" fontSize="9" fontWeight="900" fill="#e2e8f0">입장 전 점검</text>
      <text x="170" y="172" textAnchor="middle" fontSize="9" fontWeight="900" fill="#cbd5e1">목록 - 방 - 모바일 입력 - iframe 결과</text>
    </svg>
  );
};

const buildGameHubVideoBridgeItems = (visibleGames = []) => {
  const games = visibleGames.length ? visibleGames : videoGames;
  const firstGame = games[0] || videoGames[0];
  const soloCount = games.filter((game) => Number(game.minPlayers || 0) <= 1).length;
  const groupCount = games.filter((game) => Number(game.maxPlayers || 0) >= 4).length;
  const fastCount = games.filter((game) => {
    const experience = gameExperienceProfiles[game.preview];
    return /즉시|빠른|고속|실시간|러시|반응/.test(`${experience?.pace || ""} ${game.description || ""} ${game.mode || ""}`);
  }).length;
  const bridgeCount = games.filter((game) => Boolean(videoGameArtProfiles[game.preview])).length;
  return {
    firstGame,
    soloCount,
    groupCount,
    fastCount,
    bridgeCount,
    items: [
      {
        key: "candidate",
        icon: "stage",
        label: "진입 후보",
        value: `${games.length}개`,
        detail: firstGame ? `${firstGame.title}부터 방 만들기, 방 코드 입장, 설명서 확인을 바로 이어갈 수 있습니다.` : "현재 필터에서는 후보가 없습니다.",
      },
      {
        key: "bridge",
        icon: "input",
        label: "입력 브리지",
        value: `${bridgeCount}개 연결`,
        detail: "방향/액션 입력은 Good_ETC iframe과 부모 화면의 상태 패널에서 같은 흐름으로 확인합니다.",
      },
      {
        key: "rhythm",
        icon: "signal",
        label: "반응 리듬",
        value: `${fastCount}개 빠른 입력`,
        detail: "실시간 난전, 레이스, 수집형 게임은 시작 전 조작 감각을 먼저 보고 들어가는 편이 안전합니다.",
      },
      {
        key: "review",
        icon: "win",
        label: "결과 이해",
        value: "승자·근거",
        detail: "플레이 후에는 결과 패널이 승자, 기준 점수, 격차, 다음 행동을 한 화면에서 정리합니다.",
      },
    ],
  };
};

const GameHubVideoBridgePanel = ({ activeFilter, visibleGames, onOpenManual }) => {
  const bridge = buildGameHubVideoBridgeItems(visibleGames);
  const firstGame = bridge.firstGame;
  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg"
      data-smoke="game-hub-video-bridge-panel"
      data-active-filter={activeFilter}
      data-visible-count={visibleGames.length}
      data-bridge-count={bridge.bridgeCount}
    >
      <div className="grid gap-0 lg:grid-cols-[minmax(260px,340px)_1fr]">
        <div className="bg-slate-950 p-3">
          <GameHubVideoBridgeArt
            visibleCount={visibleGames.length}
            soloCount={bridge.soloCount}
            groupCount={bridge.groupCount}
            fastCount={bridge.fastCount}
          />
        </div>
        <div className="min-w-0 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-[11px] font-black text-cyan-700">
                <GameUxGlyph type="input" className="h-3.5 w-3.5" />
                Good_ETC 입력 브리지
              </div>
              <h2 className="mt-2 text-lg font-black text-slate-900 sm:text-xl">비디오게임 입장 전 브리지 점검</h2>
              <p className="mt-1 max-w-3xl text-sm font-bold leading-relaxed text-slate-600">
                목록에서 방으로 들어가기 전에 모바일 조작, iframe 화면, 결과 피드백이 어떻게 이어지는지 먼저 보여줍니다.
              </p>
            </div>
            <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">
              후보 {visibleGames.length}개
            </span>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-4">
            {bridge.items.map((item) => (
              <div key={item.key} className="min-h-[112px] rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" data-smoke="game-hub-video-bridge-item" data-bridge-key={item.key}>
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white text-primary-600 shadow-sm">
                    <GameUxGlyph type={item.icon} className="h-4 w-4" />
                  </div>
                  <div className="text-[10px] font-black text-slate-400">{item.label}</div>
                </div>
                <div className="mt-2 text-sm font-black text-slate-950">{item.value}</div>
                <div className="mt-1 line-clamp-3 text-xs font-bold leading-relaxed text-slate-500">{item.detail}</div>
              </div>
            ))}
          </div>
          {firstGame && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to={firstGame.to}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
                onMouseEnter={() => preloadGameRoute(firstGame.to)}
                onFocus={() => preloadGameRoute(firstGame.to)}
                data-smoke="game-hub-video-bridge-entry"
              >
                첫 후보 입장
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                type="button"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
                onClick={() => onOpenManual(firstGame)}
                aria-label={`${firstGame.title} 비디오게임 설명서 열기`}
                data-smoke="game-hub-video-bridge-manual"
              >
                설명서 확인
                <BookOpen className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

const readinessToneClasses = {
  emerald: { fill: "#10b981", ring: "#a7f3d0", soft: "border-emerald-200 bg-emerald-50", text: "text-emerald-800" },
  sky: { fill: "#0ea5e9", ring: "#bae6fd", soft: "border-sky-200 bg-sky-50", text: "text-sky-800" },
  amber: { fill: "#f59e0b", ring: "#fde68a", soft: "border-amber-200 bg-amber-50", text: "text-amber-800" },
  rose: { fill: "#f43f5e", ring: "#fecdd3", soft: "border-rose-200 bg-rose-50", text: "text-rose-800" },
};

const gameHubReadinessProfiles = {
  board: {
    badge: "목록 준비도",
    title: "현재 목록 준비 매트릭스",
    description: "카드 그리드로 내려가기 전에 바로 시작할 후보와 먼저 설명서를 열어야 할 후보를 분리합니다.",
    artLabel: "보드게임 목록 준비 매트릭스",
    pickLabel: "테이블 추천",
  },
  video: {
    badge: "입력 준비도",
    title: "현재 목록 준비 매트릭스",
    description: "Good_ETC 게임은 입력 리듬 차이가 크므로, 바로 열 후보와 조작 확인이 먼저 필요한 후보를 분리합니다.",
    artLabel: "비디오게임 목록 준비 매트릭스",
    pickLabel: "입력 추천",
  },
};

const isGameHubManualPriority = (game, experience) => {
  const pace = experience?.pace || "";
  return (
    pace.includes("긴") ||
    pace.includes("단계") ||
    pace.includes("턴제") ||
    ["catan", "citadels", "mafia", "rpg", "dalmuti"].includes(game.preview)
  );
};

const buildGameHubReadinessPlan = ({ activeTab, activeFilter, visibleGames }) => {
  const profile = gameHubReadinessProfiles[activeTab] || gameHubReadinessProfiles.board;
  const selectedFilter = gameHubFilterOptions.find((option) => option.key === activeFilter) || gameHubFilterOptions[0];
  const games = Array.isArray(visibleGames) ? visibleGames : [];
  const isVideo = activeTab === "video";
  const enriched = games.map((game) => ({
    game,
    experience: gameExperienceProfiles[game.preview] || {
      genre: game.mode,
      focus: "현재 상태와 가능한 행동 확인",
      pace: game.players,
      feel: "방 흐름을 유지하는 플레이",
    },
  }));
  const immediate = enriched.filter(({ game }) => Number(game.minPlayers || 0) <= 1);
  const quick = enriched.filter(({ experience }) => {
    const pace = experience.pace || "";
    return pace.includes("실시간") || pace.includes("빠름") || pace.includes("동시") || pace.includes("짧");
  });
  const manualFirst = enriched.filter(({ game, experience }) => isGameHubManualPriority(game, experience));
  const groupReady = enriched.filter(({ game }) => Number(game.maxPlayers || 0) >= 5);
  const items = [
    {
      key: "instant",
      icon: isVideo ? "input" : "stage",
      label: "바로 열기",
      value: `${immediate.length}개`,
      detail: immediate[0] ? `${immediate[0].game.title}부터 혼자 또는 AI/솔로 흐름으로 진입할 수 있습니다.` : "현재 조건에서는 혼자 바로 열 후보가 없습니다.",
      tone: "emerald",
      games: immediate.map(({ game }) => game),
    },
    {
      key: "quick",
      icon: isVideo ? "signal" : "turn",
      label: isVideo ? "빠른 입력" : "빠른 판",
      value: `${quick.length}개`,
      detail: quick[0] ? `${quick[0].experience.pace} 리듬의 후보를 먼저 보면 첫 반응 부담이 낮습니다.` : "현재 조건에서는 빠른 리듬 후보가 없습니다.",
      tone: "sky",
      games: quick.map(({ game }) => game),
    },
    {
      key: "manual",
      icon: "decision",
      label: "설명서 우선",
      value: `${manualFirst.length}개`,
      detail: manualFirst[0] ? `${manualFirst[0].game.title}처럼 첫 판단 규칙을 읽고 들어가면 방 안에서 멈칫하는 시간이 줄어듭니다.` : "현재 조건에서는 설명서 우선 후보가 적습니다.",
      tone: "amber",
      games: manualFirst.map(({ game }) => game),
    },
    {
      key: "group",
      icon: "player",
      label: "큰 방 후보",
      value: `${groupReady.length}개`,
      detail: groupReady[0] ? `${groupReady[0].game.title}처럼 인원이 늘수록 장점이 커지는 후보입니다.` : "현재 조건에서는 큰 방 후보가 없습니다.",
      tone: "rose",
      games: groupReady.map(({ game }) => game),
    },
  ];
  const picks = [
    immediate[0]?.game,
    quick.find(({ game }) => game.preview !== immediate[0]?.game.preview)?.game,
    manualFirst.find(({ game }) => ![immediate[0]?.game.preview, quick[0]?.game.preview].includes(game.preview))?.game,
    games[0],
  ].filter(Boolean);
  const uniquePicks = [...new Map(picks.map((game) => [game.preview, game])).values()].slice(0, 3);
  return {
    profile,
    selectedFilter,
    items,
    picks: uniquePicks,
    visibleCount: games.length,
  };
};

const GameHubReadinessMatrixArt = ({ plan, activeTab }) => {
  const maxCount = Math.max(1, ...plan.items.map((item) => item.games.length));
  const isVideo = activeTab === "video";
  return (
    <svg
      viewBox="0 0 360 206"
      role="img"
      aria-label={plan.profile.artLabel}
      className="h-full min-h-[206px] w-full"
      data-smoke="game-hub-readiness-art"
    >
      <rect x="10" y="10" width="340" height="186" rx="24" fill="#0f172a" />
      <rect x="30" y="32" width="300" height="132" rx="18" fill={isVideo ? "#ecfeff" : "#fff7ed"} />
      <path d="M58 138h244M58 58v80" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
      {plan.items.map((item, index) => {
        const tone = readinessToneClasses[item.tone] || readinessToneClasses.emerald;
        const count = item.games.length;
        const barHeight = Math.max(16, Math.round((count / maxCount) * 68));
        const x = 74 + index * 62;
        const y = 138 - barHeight;
        return (
          <g key={item.key} data-smoke="game-hub-readiness-node">
            <rect x={x} y={y} width="38" height={barHeight} rx="12" fill={tone.fill} stroke="#ffffff" strokeWidth="4" />
            <circle cx={x + 19} cy={y - 14} r="12" fill={tone.ring} stroke={tone.fill} strokeWidth="3" />
            <text x={x + 19} y={y - 10} textAnchor="middle" fontSize="10" fontWeight="900" fill="#0f172a">{count}</text>
            <text x={x + 19} y="158" textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#0f172a">{item.label}</text>
          </g>
        );
      })}
      <text x="36" y="26" fontSize="10" fontWeight="900" fill="#bfdbfe">준비 매트릭스</text>
      <text x="320" y="26" textAnchor="end" fontSize="10" fontWeight="900" fill="#e2e8f0">{plan.selectedFilter.label}</text>
      <rect x="62" y="174" width="236" height="16" rx="8" fill="#f8fafc" opacity=".96" />
      <text x="180" y="186" textAnchor="middle" fontSize="9" fontWeight="900" fill="#0f172a">바로 열기 · 빠른 리듬 · 설명서 우선 · 큰 방 후보</text>
    </svg>
  );
};

const GameHubReadinessPanel = ({ activeTab, activeFilter, visibleGames, onOpenManual }) => {
  const plan = buildGameHubReadinessPlan({ activeTab, activeFilter, visibleGames });

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-3 shadow-lg"
      data-smoke="game-hub-readiness-panel"
      data-active-tab={activeTab}
      data-active-filter={activeFilter}
      data-visible-count={plan.visibleCount}
    >
      <div className="grid gap-3 xl:grid-cols-[minmax(0,360px)_1fr]">
        <div className="overflow-hidden rounded-xl bg-slate-950">
          <GameHubReadinessMatrixArt plan={plan} activeTab={activeTab} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-500">
                <GameUxGlyph type="signal" className="h-3.5 w-3.5 text-primary-600" />
                {plan.profile.badge}
              </div>
              <h2 className="mt-2 text-lg font-black text-slate-950 sm:text-xl">{plan.profile.title}</h2>
              <p className="mt-1 max-w-3xl text-sm font-bold leading-relaxed text-slate-600">{plan.profile.description}</p>
            </div>
            <span className="inline-flex shrink-0 rounded-full bg-slate-950 px-3 py-1 text-[11px] font-black text-white">
              {plan.selectedFilter.label} {plan.visibleCount}개
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {plan.items.map((item) => {
              const tone = readinessToneClasses[item.tone] || readinessToneClasses.emerald;
              return (
                <div key={item.key} className={`min-h-[124px] rounded-xl border px-3 py-2 ${tone.soft}`} data-smoke="game-hub-readiness-item" data-readiness-key={item.key}>
                  <div className={`flex items-center gap-1.5 text-[11px] font-black ${tone.text}`}>
                    <GameUxGlyph type={item.icon} className="h-3.5 w-3.5" />
                    {item.label}
                  </div>
                  <div className="mt-1 text-lg font-black text-slate-950">{item.value}</div>
                  <div className="mt-1 line-clamp-3 text-xs font-bold leading-relaxed text-slate-600">{item.detail}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.games.slice(0, 2).map((game) => (
                      <span key={game.preview} className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-600 ring-1 ring-slate-100">
                        {game.title}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {plan.picks.map((game) => {
              const experience = gameExperienceProfiles[game.preview] || {};
              return (
                <article key={game.preview} className="min-h-[104px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" data-smoke="game-hub-readiness-pick" data-game-title={game.title}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black text-primary-600">{plan.profile.pickLabel}</div>
                      <div className="mt-1 truncate text-sm font-black text-slate-950">{game.title}</div>
                      <div className="mt-0.5 line-clamp-1 text-[11px] font-bold text-slate-500">{experience.genre || game.mode} · {experience.pace || game.players}</div>
                    </div>
                    <GameUxGlyph type={activeTab === "video" ? "input" : "decision"} className="h-5 w-5 shrink-0 text-primary-600" />
                  </div>
                  <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <Link
                      to={game.to}
                      className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-black text-white transition hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
                      onPointerEnter={() => preloadGameRoute(game.to)}
                      onFocus={() => preloadGameRoute(game.to)}
                      data-smoke="game-hub-readiness-entry"
                    >
                      입장
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-900 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
                      aria-label={`${game.title} 준비 매트릭스 설명서`}
                      title={`${game.title} 설명서`}
                      onClick={() => onOpenManual(game)}
                      data-smoke="game-hub-readiness-manual"
                    >
                      <CircleHelp className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

const buildGameHubLaunchPlan = ({ activeTab, activeFilter, visibleGames }) => {
  const selectedFilter = gameHubFilterOptions.find((option) => option.key === activeFilter) || gameHubFilterOptions[0];
  const safeGames = visibleGames.length ? visibleGames : (activeTab === "video" ? videoGames : boardGames);
  const topGames = [...safeGames]
    .sort((left, right) => {
      if (Number(right.featured) !== Number(left.featured)) return Number(right.featured) - Number(left.featured);
      if (left.minPlayers !== right.minPlayers) return left.minPlayers - right.minPlayers;
      return left.maxPlayers - right.maxPlayers;
    })
    .slice(0, 3);
  const isVideo = activeTab === "video";
  const routeItems = [
    { key: "choose", icon: "decision", label: "선택", value: `${safeGames.length}개 후보`, detail: `${selectedFilter.label} 조건으로 좁힌 목록` },
    { key: "enter", icon: "stage", label: "입장", value: "방 만들기 / 코드", detail: isVideo ? "Good_ETC 방으로 진입" : "같은 테이블 흐름으로 진입" },
    { key: "ready", icon: "player", label: "준비", value: isVideo ? "입력 브리지" : "준비 상태", detail: isVideo ? "iframe과 컨트롤 상태 확인" : "인원, 방장, 규칙 확인" },
    { key: "first", icon: isVideo ? "input" : "turn", label: isVideo ? "첫 입력" : "첫 행동", value: topGames[0] ? gameExperienceProfiles[topGames[0].preview]?.focus || "첫 행동 확인" : "후보 없음", detail: "첫 10초 안에 볼 핵심 신호" },
  ];
  return {
    selectedFilter,
    topGames,
    routeItems,
    title: isVideo ? "비디오게임 시작 디렉터" : "보드게임 시작 디렉터",
    subtitle: isVideo
      ? "필터 결과에서 입력 리듬과 방 진입 부담이 낮은 후보를 먼저 보여줍니다."
      : "필터 결과에서 인원 조건과 첫 판단 부담이 낮은 후보를 먼저 보여줍니다.",
  };
};

const GameHubLaunchDirectorArt = ({ activeTab, plan }) => {
  const nodes = plan.routeItems;
  const isVideo = activeTab === "video";
  return (
    <svg
      viewBox="0 0 380 210"
      role="img"
      aria-label={`${plan.title} 선택 경로`}
      className="h-full min-h-[210px] w-full"
      data-smoke="game-hub-launch-director-art"
    >
      <rect x="10" y="12" width="360" height="186" rx="24" fill="#0f172a" />
      <rect x="24" y="26" width="332" height="158" rx="20" fill={isVideo ? "#ecfeff" : "#fffbeb"} />
      <path d="M56 134 C104 48 162 156 210 84 S282 72 324 132" fill="none" stroke={isVideo ? "#bae6fd" : "#fde68a"} strokeWidth="14" strokeLinecap="round" />
      <path d="M56 134 C104 48 162 156 210 84 S282 72 324 132" fill="none" stroke={isVideo ? "#0e7490" : "#92400e"} strokeWidth="3" strokeLinecap="round" />
      <text x="38" y="52" fontSize="11" fontWeight="900" fill={isVideo ? "#0e7490" : "#92400e"}>시작 경로</text>
      <text x="342" y="52" textAnchor="end" fontSize="11" fontWeight="900" fill="#0f172a">{plan.selectedFilter.label}</text>
      {nodes.map((node, index) => {
        const x = 58 + index * 96;
        const y = index % 2 === 0 ? 132 : 88;
        const fill = ["#10b981", "#0ea5e9", "#f59e0b", "#f43f5e"][index] || "#64748b";
        return (
          <g key={node.key} data-smoke="game-hub-launch-route-node">
            <circle cx={x} cy={y} r="24" fill={fill} stroke="#ffffff" strokeWidth="5" />
            <text x={x} y={y + 5} textAnchor="middle" fontSize="10" fontWeight="900" fill="#ffffff">{index + 1}</text>
            <text x={x} y={y + 41} textAnchor="middle" fontSize="9" fontWeight="900" fill="#0f172a">{node.label}</text>
          </g>
        );
      })}
      <rect x="42" y="164" width="296" height="22" rx="11" fill="#0f172a" />
      <text x="190" y="179" textAnchor="middle" fontSize="10" fontWeight="900" fill="#f8fafc">필터 결과 → 후보 확정 → 방 입장 → 첫 행동 확인</text>
    </svg>
  );
};

const GameHubLaunchDirectorEmptyArt = ({ activeTab, selectedOption }) => {
  const isVideo = activeTab === "video";
  const nodes = [
    { key: "filter", x: 60, y: 104, label: selectedOption.label, fill: "#0ea5e9" },
    { key: "empty", x: 142, y: 62, label: "0개", fill: "#f43f5e" },
    { key: "reset", x: 226, y: 104, label: "전체", fill: "#10b981" },
    { key: "start", x: 304, y: 62, label: isVideo ? "입력" : "입장", fill: "#f59e0b" },
  ];

  return (
    <svg
      viewBox="0 0 360 172"
      role="img"
      aria-label={`${activeTab === "video" ? "비디오게임" : "보드게임"} 시작 디렉터 빈 후보 안내`}
      className="h-full min-h-[172px] w-full"
      data-smoke="game-hub-launch-empty-art"
      focusable="false"
    >
      <rect x="10" y="10" width="340" height="152" rx="22" fill="#0f172a" />
      <rect x="30" y="30" width="300" height="108" rx="18" fill={isVideo ? "#ecfeff" : "#fffbeb"} />
      <path d="M60 104C90 44 126 40 154 66s66 56 110 12 58-26 78-4" fill="none" stroke={isVideo ? "#bae6fd" : "#fde68a"} strokeWidth="12" strokeLinecap="round" />
      <path d="M60 104C90 44 126 40 154 66s66 56 110 12 58-26 78-4" fill="none" stroke={isVideo ? "#0e7490" : "#92400e"} strokeWidth="3" strokeLinecap="round" />
      <path d="M48 132h264" stroke="#334155" strokeWidth="4" strokeLinecap="round" />
      {nodes.map((node) => (
        <g key={node.key} data-smoke="game-hub-launch-empty-node" data-node-key={node.key}>
          <circle cx={node.x} cy={node.y} r="19" fill={node.fill} stroke="#ffffff" strokeWidth="4" />
          <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#ffffff">{node.label}</text>
        </g>
      ))}
      <text x="30" y="26" fontSize="9" fontWeight="900" fill="#bfdbfe">빈 후보 경로</text>
      <text x="330" y="26" textAnchor="end" fontSize="9" fontWeight="900" fill="#e2e8f0">{activeTab === "video" ? "비디오" : "보드"}</text>
      <text x="180" y="154" textAnchor="middle" fontSize="9" fontWeight="900" fill="#cbd5e1">{"조건 확인 -> 전체 보기 -> 후보 재선택"}</text>
    </svg>
  );
};

const GameHubLaunchDirectorEmptyChoice = ({ activeTab, activeFilter, onResetFilter }) => {
  const selectedOption = gameHubFilterOptions.find((option) => option.key === activeFilter) || gameHubFilterOptions[0];
  const isVideo = activeTab === "video";
  const items = [
    {
      key: "condition",
      label: "현재 조건",
      value: selectedOption.label,
      detail: `${selectedOption.value} 기준으로 시작 후보를 찾지 못했습니다.`,
      icon: "decision",
    },
    {
      key: "recover",
      label: "복구 행동",
      value: "전체 보기",
      detail: "전체 필터로 돌아가 숨겨진 후보를 다시 펼칩니다.",
      icon: "turn",
    },
    {
      key: "next",
      label: "다음 판단",
      value: isVideo ? "입력 리듬" : "인원 조건",
      detail: isVideo ? "후보가 돌아오면 입력 부담이 낮은 게임부터 비교합니다." : "후보가 돌아오면 적은 인원으로 열 수 있는 테이블부터 비교합니다.",
      icon: isVideo ? "input" : "player",
    },
  ];

  return (
    <div
      className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
      data-smoke="game-hub-launch-empty-choice"
      data-active-tab={activeTab}
      data-active-filter={activeFilter}
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,300px)_1fr]">
        <div className="overflow-hidden rounded-xl bg-slate-950">
          <GameHubLaunchDirectorEmptyArt activeTab={activeTab} selectedOption={selectedOption} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                <GameUxGlyph type="signal" className="h-4 w-4 text-primary-600" />
                추천할 게임 후보가 없습니다
              </div>
              <p className="mt-1 text-sm font-bold leading-relaxed text-slate-600">
                현재 필터가 시작 후보를 모두 숨겼습니다. 전체 보기로 비교 범위를 회복한 뒤 입장 후보를 다시 고르세요.
              </p>
            </div>
            <span className="inline-flex shrink-0 rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-600 ring-1 ring-slate-200">
              필터 결과 0개
            </span>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {items.map((item) => (
              <div key={item.key} className="min-h-[96px] rounded-xl border border-slate-100 bg-white px-3 py-2" data-smoke="game-hub-launch-empty-item" data-empty-key={item.key}>
                <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400">
                  <GameUxGlyph type={item.icon} className="h-3.5 w-3.5" />
                  {item.label}
                </div>
                <div className="mt-1 truncate text-sm font-black text-slate-950">{item.value}</div>
                <div className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-slate-500">{item.detail}</div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
            onClick={() => onResetFilter("all")}
            aria-label="시작 디렉터 전체 필터로 다시 보기"
            data-smoke="game-hub-launch-empty-reset"
          >
            전체 보기
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const GameHubLaunchDirectorPanel = ({ activeTab, activeFilter, visibleGames, onOpenManual, onResetFilter = () => {} }) => {
  const plan = buildGameHubLaunchPlan({ activeTab, activeFilter, visibleGames });
  const primaryGame = plan.topGames[0];

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-3 shadow-lg"
      data-smoke="game-hub-launch-director-panel"
      data-active-tab={activeTab}
      data-active-filter={activeFilter}
      data-visible-count={visibleGames.length}
    >
      <div className="grid gap-3 xl:grid-cols-[minmax(0,360px)_1fr]">
        <div className="overflow-hidden rounded-xl bg-slate-950">
          <GameHubLaunchDirectorArt activeTab={activeTab} plan={plan} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-500">
                <GameUxGlyph type="signal" className="h-3.5 w-3.5 text-primary-600" />
                지금 시작 판단
              </div>
              <h2 className="mt-2 text-lg font-black text-slate-950 sm:text-xl">{plan.title}</h2>
              <p className="mt-1 max-w-3xl text-sm font-bold leading-relaxed text-slate-600">
                {plan.subtitle} 첫 10초 안에 선택, 방 입장, 준비, 첫 행동 신호가 이어지도록 후보를 압축합니다.
              </p>
            </div>
            <span className="inline-flex shrink-0 rounded-full bg-slate-950 px-3 py-1 text-[11px] font-black text-white">
              필터 결과 {visibleGames.length}개
            </span>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {plan.routeItems.map((item) => (
              <div key={item.key} className="min-h-[102px] rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" data-smoke="game-hub-launch-route-item">
                <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500">
                  <GameUxGlyph type={item.icon} className="h-3.5 w-3.5 text-primary-600" />
                  {item.label}
                </div>
                <div className="mt-1 line-clamp-2 text-sm font-black leading-snug text-slate-950">{item.value}</div>
                <div className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-slate-600">{item.detail}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {plan.topGames.map((game, index) => {
              const experience = gameExperienceProfiles[game.preview] || {};
              return (
                <article key={game.preview} className="min-h-[132px] rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm" data-smoke="game-hub-launch-choice" data-game-title={game.title}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black text-primary-600">후보 {index + 1}</div>
                      <div className="mt-1 truncate text-sm font-black text-slate-950">{game.title}</div>
                      <div className="mt-0.5 text-[11px] font-bold text-slate-500">{game.players} · {experience.genre || game.mode}</div>
                    </div>
                    <GameUxGlyph type={activeTab === "video" ? "input" : "decision"} className="h-5 w-5 shrink-0 text-primary-600" />
                  </div>
                  <div className="mt-2 line-clamp-2 text-xs font-bold leading-relaxed text-slate-600">{experience.focus || "첫 행동 확인"}</div>
                  <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <Link
                      to={game.to}
                      className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-black text-white transition hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
                      onPointerEnter={() => preloadGameRoute(game.to)}
                      onFocus={() => preloadGameRoute(game.to)}
                      data-smoke="game-hub-launch-entry"
                    >
                      입장
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-900 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
                      aria-label={`${game.title} 시작 디렉터 설명서`}
                      title={`${game.title} 설명서`}
                      onClick={() => onOpenManual(game)}
                      data-smoke="game-hub-launch-manual"
                    >
                      <CircleHelp className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          {!primaryGame && (
            <GameHubLaunchDirectorEmptyChoice activeTab={activeTab} activeFilter={activeFilter} onResetFilter={onResetFilter} />
          )}
        </div>
      </div>
    </section>
  );
};

const GameHubAdvisorCompassArt = ({ activeTab, picks }) => {
  const isVideo = activeTab === "video";
  const nodes = picks.slice(0, 4).map((pick, index) => ({
    key: pick.game.preview,
    label: pick.label,
    title: pick.game.title,
    x: [58, 128, 210, 286][index] || 58 + index * 70,
    y: [112, 58, 104, 54][index] || 92,
    fill: ["#22c55e", "#0ea5e9", "#f59e0b", "#f43f5e"][index] || "#94a3b8",
  }));
  return (
    <svg
      viewBox="0 0 340 160"
      role="img"
      aria-label={isVideo ? "비디오게임 추천 선택 경로" : "보드게임 추천 선택 경로"}
      className="h-full min-h-[160px] w-full"
      data-smoke="game-fit-advisor-art"
    >
      <rect x="10" y="10" width="320" height="140" rx="24" fill="#020617" />
      <rect x="24" y="24" width="292" height="112" rx="18" fill={isVideo ? "#082f49" : "#172554"} />
      <path d="M58 112C92 48 138 38 172 82s76 62 114-28" fill="none" stroke={isVideo ? "#67e8f9" : "#bfdbfe"} strokeWidth="9" strokeLinecap="round" opacity=".78" />
      <path d="M58 112C92 48 138 38 172 82s76 62 114-28" fill="none" stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" opacity=".84" />
      {nodes.map((node, index) => (
        <g key={node.key} data-smoke="game-fit-advisor-node" data-game-title={node.title}>
          <circle cx={node.x} cy={node.y} r="20" fill={node.fill} stroke="#ffffff" strokeWidth="4" />
          <text x={node.x} y={node.y + 5} textAnchor="middle" fontSize="10" fontWeight="900" fill="#ffffff">{index + 1}</text>
          <text x={node.x} y={node.y + 34} textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#e2e8f0">{node.label}</text>
        </g>
      ))}
      <text x="34" y="42" fontSize="10" fontWeight="900" fill="#cffafe">추천 경로</text>
      <text x="304" y="42" textAnchor="end" fontSize="10" fontWeight="900" fill="#f8fafc">{isVideo ? "입력 감각" : "테이블 감각"}</text>
      <text x="170" y="144" textAnchor="middle" fontSize="9" fontWeight="900" fill="#cbd5e1">{"후보 비교 -> 설명서 확인 -> 방 입장"}</text>
    </svg>
  );
};

const GameHubAdvisor = ({ activeTab, onOpenManual }) => {
  const profile = gameHubAdvisorProfiles[activeTab] || gameHubAdvisorProfiles.board;
  const picks = profile.picks
    .map((pick) => ({ ...pick, game: gamesByPreview.get(pick.preview) }))
    .filter((pick) => Boolean(pick.game));

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-950 p-3 text-white shadow-lg" data-smoke="game-fit-advisor">
      <div className="flex flex-col gap-2 px-1 pb-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-black text-cyan-100 ring-1 ring-white/10">
            <GameUxGlyph type="decision" className="h-3.5 w-3.5" />
            추천 선택
          </div>
          <h2 className="mt-2 text-lg font-black text-white sm:text-xl">{profile.title}</h2>
          <p className="mt-1 max-w-3xl text-xs font-bold leading-relaxed text-slate-300 sm:text-sm">{profile.description}</p>
        </div>
        <div className="text-[11px] font-black text-slate-400">{picks.length}개 추천</div>
      </div>
      <div className="mb-3 grid gap-3 lg:grid-cols-[minmax(0,340px)_1fr]">
        <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900">
          <GameHubAdvisorCompassArt activeTab={activeTab} picks={picks} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {picks.map(({ game, label, reason }) => {
            const experience = gameExperienceProfiles[game.preview] || {};
            return (
              <div key={`signal-${game.preview}`} className="min-h-[104px] rounded-xl border border-white/10 bg-white/5 px-3 py-2" data-smoke="game-fit-advisor-signal" data-game-title={game.title}>
                <div className="flex items-center gap-1.5 text-[10px] font-black text-cyan-100">
                  <GameUxGlyph type={activeTab === "video" ? "input" : "decision"} className="h-3.5 w-3.5" />
                  {label}
                </div>
                <div className="mt-1 text-sm font-black text-white">{experience.genre || game.mode}</div>
                <div className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-slate-300">{reason}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {picks.map(({ game, label, reason }) => {
          const experience = gameExperienceProfiles[game.preview] || {};
          return (
            <article key={game.preview} className="rounded-xl border border-white/10 bg-white/10 p-3" data-smoke="game-fit-pick" data-game-title={game.title}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-black text-cyan-100">{label}</div>
                  <div className="mt-1 truncate text-base font-black text-white">{game.title}</div>
                  <div className="mt-1 text-[11px] font-bold text-slate-300">{game.players} · {experience.genre || game.mode}</div>
                </div>
                <GameUxGlyph type="stage" className="h-5 w-5 shrink-0 text-cyan-200" />
              </div>
              <div className="mt-3 min-h-[56px] text-xs font-bold leading-relaxed text-slate-300">{reason}</div>
              <div className="mt-3 rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
                <div className="text-[10px] font-black text-slate-400">첫 판단</div>
                <div className="mt-1 line-clamp-2 text-xs font-black leading-snug text-white">{experience.focus || "현재 상태와 가능한 행동 확인"}</div>
              </div>
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <Link
                  to={game.to}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-white px-3 text-xs font-black text-slate-950 transition hover:bg-cyan-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200"
                  onPointerEnter={() => preloadGameRoute(game.to)}
                  onFocus={() => preloadGameRoute(game.to)}
                >
                  입장
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white ring-1 ring-white/10 transition hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200"
                  aria-label={`${game.title} 설명서 열기`}
                  title={`${game.title} 설명서`}
                  onClick={() => onOpenManual(game)}
                >
                  <CircleHelp className="h-4 w-4" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

const buildGameCardBriefItems = (game, experience) => {
  const isVideo = Boolean(videoGameArtProfiles[game.preview]);
  return [
    {
      key: "first",
      icon: isVideo ? "input" : "decision",
      label: "첫 판단 포인트",
      value: experience.focus,
      detail: experience.pace,
    },
    {
      key: "result",
      icon: "win",
      label: "결과 이해",
      value: isVideo ? "점수·피드백" : "승패 근거",
      detail: experience.feel,
    },
  ];
};

const GameCardBriefPanel = ({ game, experience }) => {
  const isVideo = Boolean(videoGameArtProfiles[game.preview]);
  const items = buildGameCardBriefItems(game, experience);

  return (
    <div
      className="mt-3 grid grid-cols-2 gap-1.5"
      data-smoke="game-card-brief-panel"
      data-brief-type={isVideo ? "video" : "board"}
      data-game-title={game.title}
    >
      {items.map((item) => (
        <div key={item.key} className="min-h-[68px] rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" data-smoke="game-card-brief-item">
          <div className="flex items-center justify-between gap-2 text-[10px] font-black text-slate-400">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <GameUxGlyph type={item.icon} className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </span>
          </div>
          <div className="mt-1 line-clamp-2 text-[11px] font-black leading-snug text-slate-900 sm:text-xs">{item.value}</div>
        </div>
      ))}
    </div>
  );
};

const GameCard = ({ game, onOpenManual }) => {
  const titleId = `game-card-${game.preview}-title`;
  const descId = `game-card-${game.preview}-desc`;
  const highlightText = (game.highlights || []).join(", ");
  const experience = gameExperienceProfiles[game.preview] || {
    genre: game.mode,
    focus: "현재 상태와 가능한 행동 확인",
    pace: game.players,
    feel: "방 흐름을 유지하는 플레이",
  };

  return (
    <article
      className={`group relative min-w-0 overflow-hidden rounded-2xl bg-gradient-to-br ${game.tone} p-[1px] shadow-lg transition-transform duration-300 hover:-translate-y-0.5`}
      onPointerEnter={() => preloadGameRoute(game.to)}
      data-smoke="game-card"
      data-game-title={game.title}
      data-min-players={game.minPlayers}
      data-max-players={game.maxPlayers}
    >
      <Link
        to={game.to}
        aria-labelledby={titleId}
        aria-describedby={descId}
        aria-label={`${game.title} 입장하기 · ${game.players} · ${game.mode}${highlightText ? ` · ${highlightText}` : ""}`}
        className="block h-full min-w-0 rounded-[calc(1rem-1px)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200/70"
        onFocus={() => preloadGameRoute(game.to)}
      >
        <div className="flex h-full min-w-0 flex-col rounded-[calc(1rem-1px)] bg-white/95 p-2.5 backdrop-blur sm:p-5">
          <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${game.tone} p-2 sm:rounded-2xl sm:p-3`} aria-hidden="true">
            <div className="absolute left-3 top-3 z-10 rounded-full bg-white/90 px-2 py-1 text-[10px] font-black text-slate-800 shadow-sm">
              {game.featured ? "대표 경험" : experience.genre}
            </div>
            <div className="flex h-24 min-w-0 items-center justify-center overflow-hidden rounded-lg bg-white/20 p-1 sm:h-auto sm:min-h-36 sm:rounded-xl sm:p-3">
              <div className="scale-75 sm:scale-100">
                <GamePreview type={game.preview} />
              </div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1 pr-9 sm:mt-4 sm:gap-2 sm:pr-12">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-600 sm:px-3 sm:py-1 sm:text-[11px]">
              <Dices className="h-3 w-3" />
              {game.players}
            </span>
            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-black text-white sm:px-3 sm:py-1 sm:text-[11px]">{game.mode}</span>
            <span className="hidden rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-slate-500 ring-1 ring-slate-200 sm:inline-flex sm:px-3 sm:py-1 sm:text-[11px]">
              {experience.pace}
            </span>
          </div>
          <h2 id={titleId} className="mt-2 text-sm font-black leading-tight text-slate-900 sm:mt-4 sm:text-2xl">{game.title}</h2>
          <p id={descId} className="sr-only">{game.description}</p>
          <GameCardBriefPanel game={game} experience={experience} />
          <div className="flex-1" />
          <div className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white transition-all group-hover:bg-primary-600 sm:mt-6 sm:min-h-11 sm:w-auto sm:gap-2 sm:rounded-xl sm:px-4 sm:text-sm">
            입장하기
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </Link>
      <button
        type="button"
        className="absolute right-2 top-2 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/80 bg-white/95 text-slate-700 shadow-lg shadow-slate-900/10 transition hover:scale-105 hover:bg-slate-900 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/80 sm:right-4 sm:top-4 sm:h-11 sm:w-11"
        aria-label={`${game.title} 설명서 열기`}
        title={`${game.title} 설명서`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onOpenManual(game);
        }}
      >
        <CircleHelp className="h-4 w-4 sm:h-5 sm:w-5" />
      </button>
    </article>
  );
};

const GamePreview = ({ type }) => {
  if (videoGameArtProfiles[type]) {
    return <VideoGameArtwork type={type} />;
  }
  if (tabletopGameArtProfiles[type]) {
    return <TabletopGameArtwork type={type} />;
  }

  if (type === "catan") {
    const tiles = [
      { x: 76, y: 24, fill: "#2f8f5b", token: "8", mark: "tree" },
      { x: 108, y: 24, fill: "#f2c94c", token: "5", mark: "field" },
      { x: 140, y: 24, fill: "#7f8792", token: "10", mark: "mountain" },
      { x: 60, y: 52, fill: "#c96f3d", token: "6", mark: "hill" },
      { x: 92, y: 52, fill: "#8ccf5f", token: "9", mark: "grass" },
      { x: 124, y: 52, fill: "#d8b46f", token: "", mark: "desert" },
      { x: 156, y: 52, fill: "#38bdf8", token: "", mark: "sea" },
      { x: 76, y: 80, fill: "#f59e0b", token: "3", mark: "gold" },
      { x: 108, y: 80, fill: "#2f8f5b", token: "11", mark: "tree" },
      { x: 140, y: 80, fill: "#f2c94c", token: "4", mark: "field" },
      { x: 92, y: 108, fill: "#8ccf5f", token: "2", mark: "grass" },
      { x: 124, y: 108, fill: "#c96f3d", token: "12", mark: "hill" },
    ];
    return (
      <svg viewBox="0 0 216 140" className="h-36 w-full max-w-[240px] drop-shadow-sm">
        <rect x="0" y="0" width="216" height="140" rx="24" fill="rgba(255,255,255,.18)" />
        <path d="M8 92C38 70 50 110 82 88S130 78 160 94s40 4 50-8" fill="none" stroke="#075985" strokeWidth="6" strokeLinecap="round" opacity=".22" />
        {tiles.map((tile, index) => (
          <g key={`${tile.x}-${tile.y}-${index}`} transform={`translate(${tile.x} ${tile.y})`}>
            <polygon points="0,-18 15.6,-9 15.6,9 0,18 -15.6,9 -15.6,-9" fill={tile.fill} stroke="rgba(255,255,255,.82)" strokeWidth="2" />
            {tile.mark === "tree" && <path d="M-7 7-2-8 3 7M1 7 6-5 10 7" fill="none" stroke="#14532d" strokeWidth="2" opacity=".48" />}
            {tile.mark === "field" && <path d="M-8-8v16M0-9v18M8-8v16" stroke="#a16207" strokeWidth="1.5" opacity=".42" />}
            {tile.mark === "mountain" && <path d="M-10 9-3-10 3 1l3-6 8 14Z" fill="#475569" opacity=".5" />}
            {tile.mark === "hill" && <path d="M-13 7C-6-4 0 12 7 0c4-7 9-3 12 2" fill="none" stroke="#7c2d12" strokeWidth="2" opacity=".38" />}
            {tile.mark === "grass" && <path d="M-11 6C-6 1-2 10 3 4s8-5 12 1" fill="none" stroke="#166534" strokeWidth="2" opacity=".35" />}
            {tile.mark === "gold" && <path d="M0-9 6 0 0 9-6 0Z" fill="#fef3c7" opacity=".6" />}
            {!!tile.token && (
              <g>
                <circle r="7" fill="rgba(255,255,255,.9)" />
                <text y="3.2" textAnchor="middle" className="fill-slate-800 text-[8px] font-black">{tile.token}</text>
              </g>
            )}
          </g>
        ))}
        <path d="M62 65 92 51 124 65M92 105 124 106 140 80" fill="none" stroke="#78350f" strokeWidth="4" strokeLinecap="round" opacity=".7" />
        <circle cx="92" cy="51" r="5" fill="#dc2626" stroke="#fff" strokeWidth="2" />
        <circle cx="124" cy="106" r="5" fill="#2563eb" stroke="#fff" strokeWidth="2" />
      </svg>
    );
  }

  if (type === "blokus") {
    const pieces = [
      { color: "bg-blue-500", cells: [[0, 0], [1, 0], [2, 0], [2, 1], [3, 1]] },
      { color: "bg-rose-500", cells: [[7, 0], [7, 1], [7, 2], [6, 2], [5, 2]] },
      { color: "bg-emerald-500", cells: [[1, 7], [2, 7], [2, 8], [3, 8], [4, 8]] },
      { color: "bg-yellow-300", cells: [[8, 6], [8, 7], [7, 7], [8, 8], [9, 8]] },
      { color: "bg-fuchsia-500", cells: [[4, 3], [4, 4], [5, 4], [6, 4]] },
    ];
    const cellColors = new Map();
    pieces.forEach((piece) => piece.cells.forEach(([x, y]) => cellColors.set(`${x}:${y}`, piece.color)));
    return (
      <div className="relative max-w-full rounded-2xl bg-slate-950 p-2 shadow-inner">
        <div className="grid h-36 w-36 grid-cols-10 gap-1">
          {Array.from({ length: 100 }, (_, index) => {
            const x = index % 10;
            const y = Math.floor(index / 10);
            const color = cellColors.get(`${x}:${y}`);
            return (
              <span
                key={`${x}-${y}`}
                className={`rounded-[3px] ${color || "bg-white/10"} ${color ? "shadow-sm ring-1 ring-white/25" : ""}`}
              />
            );
          })}
        </div>
        <span className="absolute left-2 top-2 h-3 w-3 rounded-full bg-blue-400 ring-2 ring-white/70" />
        <span className="absolute right-2 top-2 h-3 w-3 rounded-full bg-rose-400 ring-2 ring-white/70" />
        <span className="absolute bottom-2 left-2 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-white/70" />
        <span className="absolute bottom-2 right-2 h-3 w-3 rounded-full bg-yellow-300 ring-2 ring-white/70" />
      </div>
    );
  }

  if (type === "mahe") {
    return (
      <svg viewBox="0 0 160 160" className="h-36 w-36 drop-shadow-sm">
        <circle cx="80" cy="80" r="78" fill="#ccfbf1" />
        <circle cx="80" cy="80" r="50" fill="#fde68a" opacity=".92" />
        <circle cx="80" cy="80" r="34" fill="#facc15" opacity=".56" />
        {Array.from({ length: 18 }, (_, index) => {
          const angle = (index / 18) * Math.PI * 2 - Math.PI / 2;
          const x = 50 + Math.cos(angle) * 41;
          const y = 50 + Math.sin(angle) * 41;
          const active = index === 4;
          const stack = index === 9;
          return (
            <g key={index} transform={`translate(${(x / 100) * 160} ${(y / 100) * 160})`}>
              <circle r={active ? 8 : 6.5} fill={active ? "#10b981" : "#ffffff"} stroke={active ? "#047857" : "#99f6e4"} strokeWidth="2" />
              {stack && (
                <g transform="translate(0 -12)">
                  <circle r="5" fill="#2563eb" stroke="#fff" strokeWidth="1.5" />
                  <circle cy="-7" r="5" fill="#f97316" stroke="#fff" strokeWidth="1.5" />
                </g>
              )}
            </g>
          );
        })}
        <g transform="translate(80 80)">
          <ellipse rx="22" ry="16" fill="#fff7ed" stroke="#f59e0b" strokeWidth="2" />
          <text y="5" textAnchor="middle" className="fill-amber-700 text-[16px] font-black">7</text>
        </g>
        <g transform="translate(112 118)">
          {[0, 1, 2].map((index) => (
            <rect key={index} x={index * 13} y={index % 2 ? -3 : 0} width="12" height="12" rx="3" fill="#ffffff" stroke="#0f766e" strokeWidth="1.2" />
          ))}
        </g>
      </svg>
    );
  }

  if (type === "citadels") {
    return (
      <div className="relative h-36 w-56 max-w-full">
        <div className="absolute inset-x-4 bottom-2 grid grid-cols-5 gap-1 rounded-2xl bg-slate-950/80 p-2 shadow-xl">
          {["#f59e0b", "#0ea5e9", "#10b981", "#ef4444", "#8b5cf6"].map((fill, index) => (
            <span key={fill} className="h-12 rounded-lg border border-white/30" style={{ background: fill, transform: `translateY(${index % 2 ? 6 : 0}px)` }} />
          ))}
        </div>
        {[
          { rank: "1", label: "A", tone: "from-slate-900 to-red-800", x: -46, rotate: -10 },
          { rank: "4", label: "K", tone: "from-amber-400 to-yellow-100", x: 0, rotate: 0 },
          { rank: "8", label: "W", tone: "from-rose-700 to-zinc-900", x: 46, rotate: 10 },
        ].map((card) => (
          <div
            key={card.rank}
            className={`absolute left-1/2 top-1 flex h-28 w-20 -translate-x-1/2 flex-col justify-between rounded-2xl border border-white/70 bg-gradient-to-br ${card.tone} p-2 text-white shadow-xl`}
            style={{ transform: `translateX(calc(-50% + ${card.x}px)) rotate(${card.rotate}deg)` }}
          >
            <span className="text-xs font-black">{card.rank}</span>
            <span className="text-center text-4xl font-black">{card.label}</span>
            <span className="rotate-180 text-xs font-black">{card.rank}</span>
          </div>
        ))}
      </div>
    );
  }

  if (type === "six-nimmt") {
    const rows = [
      [12, 23, 39, 48, 60],
      [7, 31, 44],
      [18, 26, 55, 71],
      [3, 16],
    ];
    return (
      <div className="grid h-36 w-56 max-w-full gap-2 rounded-2xl bg-slate-950/75 p-3 shadow-inner">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-5 gap-1">
            {row.map((value) => (
              <span key={`${rowIndex}-${value}`} className={`flex items-center justify-center rounded-lg border border-white/70 bg-white text-xs font-black ${value === 55 ? "text-rose-700" : "text-slate-800"}`}>
                {value}
              </span>
            ))}
            {Array.from({ length: 5 - row.length }).map((_, index) => (
              <span key={`empty-${rowIndex}-${index}`} className="rounded-lg border border-dashed border-white/20 bg-white/5" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (type === "telestrations") {
    return (
      <div className="relative h-36 w-60 max-w-full rounded-lg bg-slate-950 p-3 shadow-inner">
        <div className="grid h-full grid-cols-3 gap-2">
          {[
            { title: "문장", body: "달 위의 요리사", tone: "bg-sky-50 text-sky-800" },
            { title: "그림", body: "", icon: "input", tone: "bg-white text-slate-900" },
            { title: "추측", body: "우주 식당", tone: "bg-amber-50 text-amber-800" },
          ].map((page, index) => (
            <div key={page.title} className={`flex flex-col justify-between rounded-lg border border-white/30 p-2 shadow-lg ${page.tone}`} style={{ transform: `translateY(${index % 2 ? 8 : 0}px)` }}>
              <span className="text-[10px] font-black opacity-60">{page.title}</span>
              {page.icon ? (
                <span className="flex justify-center">
                  <GameUxGlyph type={page.icon} className="h-8 w-8" />
                </span>
              ) : (
                <span className="text-center text-sm font-black leading-tight">{page.body}</span>
              )}
              <span className="h-1 rounded-full bg-current opacity-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "mafia") {
    return (
      <div className="relative h-36 w-60 max-w-full overflow-hidden rounded-lg bg-gradient-to-br from-zinc-950 via-indigo-950 to-rose-950 p-3 text-white shadow-inner">
        <div className="absolute left-4 top-4 h-12 w-12 rounded-full bg-amber-200/80 shadow-[0_0_28px_rgba(251,191,36,0.45)]" />
        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.16em] text-indigo-100/80">
            <span>Night</span>
            <span>TTS</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { code: "M", label: "마피아", tone: "bg-rose-600" },
              { code: "P", label: "경찰", tone: "bg-sky-500" },
              { code: "D", label: "의사", tone: "bg-emerald-500" },
              { code: "C", label: "시민", tone: "bg-slate-500" },
            ].map((card) => (
              <div key={card.code} className={`${card.tone} flex h-20 flex-col justify-between rounded-lg border border-white/20 p-1.5 shadow-lg`}>
                <span className="text-[10px] font-black text-white/70">{card.code}</span>
                <span className="text-center text-[10px] font-black">{card.label}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-black">
            <span className="rounded-full bg-white/10 py-1">밤</span>
            <span className="rounded-full bg-white/10 py-1">토론</span>
            <span className="rounded-full bg-white/10 py-1">투표</span>
          </div>
        </div>
      </div>
    );
  }

  if (type === "poker") {
    const cards = [
      { rank: "A", suit: "SPADES", x: -64, rotate: -10 },
      { rank: "A", suit: "HEARTS", x: -32, rotate: -5 },
      { rank: "K", suit: "CLUBS", x: 0, rotate: 0 },
      { rank: "Q", suit: "DIAMONDS", x: 32, rotate: 5 },
      { rank: "J", suit: "SPADES", x: 64, rotate: 10 },
    ];
    return (
      <div className="relative h-36 w-60 max-w-full rounded-lg bg-emerald-950 p-3 shadow-inner">
        <div className="absolute inset-x-4 top-3 h-5 rounded-full bg-amber-300/80" />
        {cards.map((card) => (
          <div
            key={`${card.rank}-${card.suit}`}
            className="absolute left-1/2 top-8 -translate-x-1/2"
            style={{ transform: `translateX(calc(-50% + ${card.x}px)) rotate(${card.rotate}deg)` }}
          >
            <PlayingCardArt rank={card.rank} suit={card.suit} smoke="game-hub-poker-card-art" />
          </div>
        ))}
        <div className="absolute bottom-3 left-3 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black text-emerald-100">
          HOLD 확률
        </div>
      </div>
    );
  }

  if (type === "dalmuti" || type === "cards") {
    const ranks = type === "dalmuti"
      ? [
          { rank: "1", name: "달무티", tone: "from-amber-200 via-white to-rose-100", textClass: "text-slate-900" },
          { rank: "2", name: "대주교", tone: "from-violet-100 via-white to-sky-100", textClass: "text-slate-900" },
          { rank: "광", name: "광대", tone: "from-violet-700 via-fuchsia-600 to-amber-400", textClass: "text-white" },
        ]
      : [
          { rank: "3", name: "카드", tone: "from-white to-slate-100", textClass: "text-slate-900" },
          { rank: "9", name: "카드", tone: "from-white to-slate-100", textClass: "text-slate-900" },
          { rank: "24", name: "카드", tone: "from-white to-slate-100", textClass: "text-slate-900" },
        ];
    return (
      <div className="relative h-36 w-52 max-w-full">
        {ranks.map((card, index) => (
          <div
            key={`${card.rank}-${index}`}
            className={`absolute bottom-1 left-1/2 flex aspect-[2/3] h-32 origin-bottom -translate-x-1/2 flex-col justify-between rounded-2xl border border-white/70 bg-gradient-to-br ${card.tone} ${card.textClass} p-2 shadow-xl ring-1 ring-slate-900/5`}
            style={{ transform: `translateX(calc(-50% + ${(index - 1) * 42}px)) rotate(${(index - 1) * 7}deg)` }}
          >
            <span className="text-xs font-black opacity-70">{card.rank}</span>
            <div className="flex flex-1 flex-col items-center justify-center">
              <span className="text-3xl font-black">{card.rank}</span>
              <span className="mt-1 rounded-full bg-white/65 px-2 py-0.5 text-[10px] font-black text-slate-700">{card.name}</span>
            </div>
            <span className="rotate-180 text-xs font-black opacity-70">{card.rank}</span>
          </div>
        ))}
      </div>
    );
  }

  if (type === "dice") {
    const dotMap = {
      1: [4],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8],
    };
    return (
      <div className="flex items-center justify-center gap-3">
        {[1, 5, 6].map((value) => (
          <div key={value} className="grid h-16 w-16 grid-cols-3 grid-rows-3 gap-1 rounded-2xl bg-white p-3 shadow-lg">
            {Array.from({ length: 9 }, (_, index) => (
              <span key={index} className={dotMap[value].includes(index) ? "rounded-full bg-slate-900" : ""} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="relative mx-auto h-32 max-w-52 rounded-b-[2rem] border-x border-b border-emerald-100 bg-emerald-50">
      {Array.from({ length: 18 }, (_, index) => (
        <span key={index} className="absolute h-2 w-2 rounded-full bg-teal-500" style={{ left: `${12 + (index % 6) * 15}%`, top: `${12 + Math.floor(index / 6) * 20}%` }} />
      ))}
      <span className="absolute bottom-4 left-1/2 h-8 w-8 -translate-x-1/2 rounded-full bg-cyan-500 shadow-lg" />
    </div>
  );
};

const GameManualExperiencePanel = ({ game }) => {
  const experience = gameExperienceProfiles[game.preview] || {
    genre: game.mode,
    focus: "현재 상태와 가능한 행동 확인",
    pace: game.players,
    feel: "방 흐름을 유지하는 플레이",
  };
  const isVideo = Boolean(videoGameArtProfiles[game.preview]);
  const items = [
    { key: "genre", icon: "stage", label: "경험 유형", value: experience.genre, detail: `${game.players} · ${experience.pace}` },
    { key: "focus", icon: "decision", label: "첫 판단", value: experience.focus, detail: "입장 직후 먼저 봐야 할 정보" },
    { key: "feel", icon: "signal", label: "플레이 감각", value: experience.feel, detail: isVideo ? "입력 반응과 결과 피드백" : "차례, 판세, 최근 근거 피드백" },
    {
      key: "flow",
      icon: isVideo ? "input" : "turn",
      label: "진행 상태",
      value: isVideo ? "방 코드 · 준비 · 입력 브리지" : "방 코드 · 준비 · 차례 확인",
      detail: isVideo ? "본게임 iframe이 열리기 전 입력 상태를 확인합니다." : "본게임 전 준비 상태와 첫 행동 가능 여부를 확인합니다.",
    },
  ];

  return (
    <section
      className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-inner"
      data-smoke="game-manual-experience-panel"
    >
      <div className={`bg-gradient-to-br ${game.tone} p-[1px]`}>
        <div className="grid gap-3 rounded-[calc(1rem-1px)] bg-slate-950/90 p-3 md:grid-cols-[220px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-xl bg-white/10 p-2 ring-1 ring-white/10" aria-hidden="true">
            <div className="flex min-h-36 items-center justify-center">
              <GamePreview type={game.preview} />
            </div>
          </div>
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-black text-cyan-100 ring-1 ring-white/10">
              <GameUxGlyph type="signal" className="h-3.5 w-3.5" />
              요약
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {items.map((item) => (
                <div key={item.key} className="min-h-[94px] rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/10" data-smoke="game-manual-experience-item">
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-white/55">
                    <GameUxGlyph type={item.icon} className="h-3.5 w-3.5" />
                    {item.label}
                  </div>
                  <div className="mt-1 line-clamp-2 text-sm font-black leading-snug text-white">{item.value}</div>
                  <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-relaxed text-white/60">{item.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const buildGameManualReadinessItems = (game) => {
  const experience = gameExperienceProfiles[game.preview] || {
    genre: game.mode,
    focus: "현재 상태와 가능한 행동 확인",
    pace: game.players,
    feel: "방 흐름을 유지하는 플레이",
  };
  const isVideo = Boolean(videoGameArtProfiles[game.preview]);
  const minPlayers = Number(game.minPlayers || 1);
  const maxPlayers = Number(game.maxPlayers || minPlayers);
  const firstSection = game.manual?.sections?.[0]?.title || "공식 룰 핵심";
  const goalSection = game.manual?.sections?.find((section) => /목표|승리|정산|점수/.test(section.title))?.title || "목표 확인";

  return [
    {
      key: "players",
      icon: "player",
      label: "인원 조건",
      value: game.players,
      detail: minPlayers <= 1 ? `혼자 열 수 있고 최대 ${maxPlayers}명까지 확장됩니다.` : `${minPlayers}명 이상 모이면 방 준비를 시작할 수 있습니다.`,
    },
    {
      key: "first",
      icon: isVideo ? "input" : "decision",
      label: "첫 판단",
      value: experience.focus,
      detail: isVideo ? "입력 리듬을 먼저 보고 iframe 화면으로 들어갑니다." : "차례, 선택 가능 대상, 판세 신호를 먼저 확인합니다.",
    },
    {
      key: "setup",
      icon: "stage",
      label: "입장 전 확인",
      value: firstSection,
      detail: isVideo ? "방 코드, 준비 상태, 입력 브리지가 실제 플레이 전에 이어집니다." : "방 코드, 방장, 준비 상태, 선택 규칙을 본게임 전에 확인합니다.",
    },
    {
      key: "result",
      icon: "signal",
      label: "결과 이해",
      value: goalSection,
      detail: isVideo ? "결과 패널에서 승자와 근거를 다시 확인합니다." : "종료 화면에서 누가 왜 이겼는지와 다음 행동을 확인합니다.",
    },
  ];
};

const GameManualReadinessArt = ({ game, items }) => {
  const isVideo = Boolean(videoGameArtProfiles[game.preview]);
  const nodes = items.map((item, index) => ({
    ...item,
    x: 56 + index * 88,
    y: index % 2 === 0 ? 118 : 72,
    fill: ["#10b981", "#0ea5e9", "#f59e0b", "#f43f5e"][index] || "#64748b",
  }));

  return (
    <svg
      viewBox="0 0 360 176"
      role="img"
      aria-label={`${game.title} 입장 준비 체크 경로`}
      className="h-full min-h-[176px] w-full"
      data-smoke="game-manual-readiness-art"
    >
      <rect x="10" y="10" width="340" height="156" rx="22" fill="#0f172a" />
      <rect x="24" y="26" width="312" height="122" rx="18" fill={isVideo ? "#ecfeff" : "#fff7ed"} />
      <path d="M56 118 C94 52 150 126 190 76 S278 76 320 118" fill="none" stroke={isVideo ? "#bae6fd" : "#fde68a"} strokeWidth="13" strokeLinecap="round" />
      <path d="M56 118 C94 52 150 126 190 76 S278 76 320 118" fill="none" stroke={isVideo ? "#0e7490" : "#92400e"} strokeWidth="3" strokeLinecap="round" />
      <text x="34" y="48" fontSize="10" fontWeight="900" fill={isVideo ? "#0e7490" : "#92400e"}>준비 체크</text>
      <text x="326" y="48" textAnchor="end" fontSize="10" fontWeight="900" fill="#0f172a">{game.players}</text>
      {nodes.map((node, index) => (
        <g key={node.key} data-smoke="game-manual-readiness-node">
          <circle cx={node.x} cy={node.y} r="23" fill={node.fill} stroke="#ffffff" strokeWidth="5" />
          <text x={node.x} y={node.y + 5} textAnchor="middle" fontSize="10" fontWeight="900" fill="#ffffff">{index + 1}</text>
          <text x={node.x} y={node.y + 38} textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#0f172a">{node.label}</text>
        </g>
      ))}
      <rect x="70" y="150" width="220" height="12" rx="6" fill="#f8fafc" opacity=".95" />
      <text x="180" y="159" textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#0f172a">인원 → 첫 판단 → 입장 확인 → 결과 이해</text>
    </svg>
  );
};

const GameManualReadinessPanel = ({ game }) => {
  const items = buildGameManualReadinessItems(game);

  return (
    <section
      className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      data-smoke="game-manual-readiness-panel"
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,340px)_1fr]">
        <div className="bg-slate-950 p-3">
          <GameManualReadinessArt game={game} items={items} />
        </div>
        <div className="p-3 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-500">
                <GameUxGlyph type="signal" className="h-3.5 w-3.5 text-primary-600" />
                입장 준비 체크
              </div>
              <h3 className="mt-2 text-base font-black text-slate-950 sm:text-lg">설명서를 닫기 전에 볼 4가지</h3>
            </div>
            <span className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-black text-white">{game.mode}</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <div key={item.key} className="min-h-[96px] rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" data-smoke="game-manual-readiness-item">
                <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400">
                  <GameUxGlyph type={item.icon} className="h-3.5 w-3.5 text-primary-600" />
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

const findManualSection = (game, patterns) => {
  const sections = game?.manual?.sections || [];
  return sections.find((section) => patterns.some((pattern) => pattern.test(section.title))) || sections[0] || null;
};

const buildGameManualActionPrimerItems = (game) => {
  const experience = gameExperienceProfiles[game.preview] || {
    genre: game.mode,
    focus: "현재 상태와 가능한 행동 확인",
    pace: game.players,
    feel: "방 흐름을 유지하는 플레이",
  };
  const isVideo = Boolean(videoGameArtProfiles[game.preview]);
  const flowSection = findManualSection(game, [/차례/, /진행/, /기본 흐름/, /조작/, /입력/, /행동/, /선택/, /배치/, /카드/, /역할/]);
  const supportSection = findManualSection(game, [/초보/, /팁/, /보조/, /데이터/, /확장/, /전략/]);
  const flowItems = flowSection?.items || [];
  const supportItems = supportSection?.items || [];

  return [
    {
      key: "entry",
      icon: isVideo ? "input" : "turn",
      label: "첫 행동 위치",
      value: isVideo ? "입력 브리지와 본게임 화면" : (flowSection?.title || "진행 흐름"),
      detail: flowItems[0] || experience.focus,
    },
    {
      key: "signal",
      icon: "signal",
      label: "행동 가능 신호",
      value: flowItems[1] || supportItems[0] || (isVideo ? "프레임 준비와 입력 상태를 먼저 봅니다." : "내 차례와 선택 가능 대상을 먼저 봅니다."),
      detail: isVideo ? "입력 덱, 모바일 패드, stage HUD가 같은 상태를 보여줍니다." : "차례 레일, 액션 준비, 보드 강조가 같은 결정을 가리킵니다.",
    },
    {
      key: "lock",
      icon: "decision",
      label: "막히는 이유",
      value: flowItems[2] || (isVideo ? "준비 전, 프레임 대기, 종료 상태에서는 입력이 제한됩니다." : "내 차례가 아니거나 선택 대상이 없으면 행동이 잠깁니다."),
      detail: "비활성 버튼과 안내 타일에서 다음 조건을 확인합니다.",
    },
    {
      key: "feedback",
      icon: "stage",
      label: "반영 확인",
      value: supportItems[1] || (isVideo ? "입력 피드백과 결과 패널에서 반영 여부를 확인합니다." : "최근 진행, 피드백 티커, 결과 패널에서 반영 여부를 확인합니다."),
      detail: "행동 후에는 같은 화면 안에서 성공, 대기, 실패 근거를 다시 봅니다.",
    },
  ];
};

const GameManualActionPrimerArt = ({ game, items }) => {
  const isVideo = Boolean(videoGameArtProfiles[game.preview]);
  const nodeColors = ["#14b8a6", "#2563eb", "#f59e0b", "#e11d48"];
  const nodes = items.map((item, index) => ({
    ...item,
    x: 52 + index * 94,
    y: index % 2 === 0 ? 114 : 70,
    fill: nodeColors[index] || "#64748b",
  }));

  return (
    <svg
      viewBox="0 0 360 188"
      role="img"
      aria-label={`${game.title} 첫 액션 판단 경로`}
      className="h-full min-h-[188px] w-full"
      data-smoke="game-manual-action-art"
    >
      <rect x="10" y="10" width="340" height="168" rx="22" fill="#0f172a" />
      <rect x="25" y="28" width="310" height="132" rx="18" fill={isVideo ? "#f0fdfa" : "#eff6ff"} />
      <path d="M52 114 C82 46 126 54 146 70 S210 126 240 114 S304 50 334 70" fill="none" stroke={isVideo ? "#99f6e4" : "#bfdbfe"} strokeWidth="13" strokeLinecap="round" />
      <path d="M52 114 C82 46 126 54 146 70 S210 126 240 114 S304 50 334 70" fill="none" stroke={isVideo ? "#0f766e" : "#1d4ed8"} strokeWidth="3" strokeLinecap="round" />
      <text x="34" y="24" fontSize="10" fontWeight="900" fill="#bfdbfe">첫 액션</text>
      <text x="326" y="24" textAnchor="end" fontSize="10" fontWeight="900" fill="#e2e8f0">{isVideo ? "입력" : "차례"}</text>
      {nodes.map((node, index) => (
        <g key={node.key} data-smoke="game-manual-action-node">
          <circle cx={node.x} cy={node.y} r="22" fill={node.fill} stroke="#ffffff" strokeWidth="5" />
          <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="10" fontWeight="900" fill="#ffffff">{index + 1}</text>
          <text x={node.x} y={node.y + (index % 2 === 0 ? 38 : -31)} textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#0f172a">{node.label}</text>
        </g>
      ))}
      <rect x="52" y="145" width="256" height="13" rx="7" fill="#f8fafc" opacity=".95" />
      <text x="180" y="155" textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#0f172a">위치 → 가능 신호 → 잠김 이유 → 반영 확인</text>
    </svg>
  );
};

const GameManualActionPrimerPanel = ({ game }) => {
  const items = buildGameManualActionPrimerItems(game);

  return (
    <section
      className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      data-smoke="game-manual-action-panel"
      data-action-game={game.preview}
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,340px)_1fr]">
        <div className="bg-slate-950 p-3">
          <GameManualActionPrimerArt game={game} items={items} />
        </div>
        <div className="p-3 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-500">
                <GameUxGlyph type="turn" className="h-3.5 w-3.5 text-primary-600" />
                첫 액션 요약
              </div>
              <h3 className="mt-2 text-base font-black text-slate-950 sm:text-lg">방에 들어가면 무엇을 먼저 누르는가</h3>
            </div>
            <span className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-black text-white">{Boolean(videoGameArtProfiles[game.preview]) ? "입력 판단" : "차례 판단"}</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <div key={item.key} className="min-h-[108px] rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" data-smoke="game-manual-action-item" data-action-key={item.key}>
                <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400">
                  <GameUxGlyph type={item.icon} className="h-3.5 w-3.5 text-primary-600" />
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

const isGameHubBannerRequestCanceled = (error) => {
  return error?.code === "ERR_CANCELED" || error?.name === "CanceledError" || error?.name === "AbortError";
};

const GameHubHeroBanner = ({
  banners = [],
  activeIndex = 0,
  loading,
  unavailable,
  onNext,
  onPrev,
  onSelect,
  onBannerEvent,
}) => {
  const touchStartRef = useRef({ x: 0, y: 0 });
  const bannerCount = banners.length;
  const normalizedIndex = bannerCount ? ((activeIndex % bannerCount) + bannerCount) % bannerCount : 0;

  if (loading && !bannerCount) {
    return (
      <div
        className="min-h-[132px] overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-primary-700 p-4 text-white sm:min-h-[160px] sm:p-5"
        role="status"
        aria-live="polite"
        data-gamehub-banner-loading="true"
      >
        <div className="h-4 w-24 rounded-full bg-white/20" />
        <div className="mt-5 h-7 w-3/4 rounded-2xl bg-white/20" />
        <div className="mt-3 h-4 w-full max-w-xl rounded-full bg-white/15" />
        <div className="mt-2 h-4 w-2/3 rounded-full bg-white/15" />
      </div>
    );
  }

  if (unavailable && !bannerCount) {
    return (
      <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800" role="status">
        운영 배너 연결이 지연되고 있습니다. 게임 목록은 바로 이용할 수 있습니다.
      </div>
    );
  }

  if (!bannerCount) return null;

  const renderBannerContent = (banner) => {
    const imageUrl = String(banner.imageUrl || "").trim();
    const hasImageBackground = Boolean(imageUrl);
    const bannerStyle = hasImageBackground
      ? {
          backgroundImage: `url("${imageUrl}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : undefined;
    const content = (
      <div
        className={`relative flex h-[172px] overflow-hidden p-4 text-white sm:h-[188px] sm:p-5 ${
          hasImageBackground ? "" : "bg-gradient-to-br from-primary-600 to-primary-400"
        }`}
        style={bannerStyle}
      >
        <div className={`relative z-10 flex h-full max-w-3xl flex-col ${hasImageBackground ? "[text-shadow:0_2px_12px_rgba(15,23,42,0.72)]" : ""}`}>
          <BannerTypeBadge
            type={banner.type}
            label={banner.typeLabel}
            tone={hasImageBackground ? "image" : "glass"}
          />
          <h2 className="mt-3 line-clamp-2 text-xl font-black tracking-tight sm:text-3xl">
            {banner.title || "Docky 게임 소식"}
          </h2>
          {banner.description ? (
            <p className="mt-2 line-clamp-2 text-sm font-medium leading-relaxed text-white/90 sm:text-base">
              {banner.description}
            </p>
          ) : null}
          {banner.linkUrl ? (
            <span className={`mt-auto inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-black ${hasImageBackground ? "text-slate-950" : "text-primary-700"}`}>
              {banner.ctaText || "자세히 보기"}
              <ArrowRight className="h-4 w-4" />
            </span>
          ) : null}
        </div>
      </div>
    );

    if (banner.linkUrl && banner.linkTarget === "EXTERNAL") {
      return (
        <a
          href={banner.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
          onClick={() => onBannerEvent(banner, "CLICK")}
        >
          {content}
        </a>
      );
    }

    if (banner.linkUrl && banner.linkTarget === "INTERNAL") {
      return (
        <Link
          to={banner.linkUrl}
          className="block focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
          onClick={() => onBannerEvent(banner, "CLICK")}
        >
          {content}
        </Link>
      );
    }

    return content;
  };

  return (
    <section
      className="relative overflow-hidden rounded-2xl"
      aria-label="게임 허브 배너"
      aria-roledescription="carousel"
      data-gamehub-banner="true"
      onTouchStart={(event) => {
        const touch = event.touches?.[0];
        if (!touch) return;
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      }}
      onTouchEnd={(event) => {
        const touch = event.changedTouches?.[0];
        if (!touch || bannerCount <= 1) return;
        const deltaX = touch.clientX - touchStartRef.current.x;
        const deltaY = touch.clientY - touchStartRef.current.y;
        const isHorizontalSwipe = Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY);
        if (!isHorizontalSwipe) return;
        if (deltaX < 0) onNext();
        if (deltaX > 0) onPrev();
      }}
    >
      <div
        className="flex flex-nowrap transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${normalizedIndex * 100}%)` }}
      >
        {banners.map((banner, idx) => (
          <div
            key={`${banner.id}-${idx}`}
            className="w-full flex-shrink-0"
            aria-hidden={idx !== normalizedIndex}
            aria-roledescription="slide"
            aria-label={`${idx + 1} / ${bannerCount}`}
          >
            {renderBannerContent(banner)}
          </div>
        ))}
      </div>

      {bannerCount > 1 ? (
        <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-full bg-slate-950/45 px-2 py-1.5 backdrop-blur">
          {banners.map((banner, idx) => (
            <button
              key={`${banner.id}-dot-${idx}`}
              type="button"
              className={`h-2 rounded-full transition-all ${idx === normalizedIndex ? "w-6 bg-white" : "w-2 bg-white/50"}`}
              onClick={() => onSelect(idx)}
              aria-label={`배너 ${idx + 1}번 보기`}
              aria-current={idx === normalizedIndex ? "true" : undefined}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
};

const GameManualModal = ({ game, onClose }) => {
  const titleId = useId();
  const descriptionId = useId();
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!game) return undefined;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [game, onClose]);

  if (!game?.manual) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100vh-3rem)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        data-smoke="game-manual-modal"
      >
        <header className={`bg-gradient-to-br ${game.tone} p-[1px]`}>
          <div className="rounded-t-2xl bg-white/95 px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">
                  <BookOpen className="h-3.5 w-3.5 text-primary-500" />
                  게임 설명서
                </div>
                <h2 id={titleId} className="mt-3 break-words text-2xl font-black text-slate-900 sm:text-3xl">
                  {game.title}
                </h2>
                <p id={descriptionId} className="mt-2 text-sm font-bold leading-relaxed text-slate-500 sm:text-base">
                  {game.manual.subtitle}
                </p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-900 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
                onClick={onClose}
                aria-label="설명서 닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {!!game.manual.tags?.length && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {game.manual.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-black text-white">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {game.manual.sections.map((section, sectionIndex) => (
              <section
                key={`${game.preview}-${section.title}`}
                className={`rounded-2xl border border-slate-200 bg-slate-50 p-4 ${sectionIndex === 0 ? "sm:col-span-2" : ""}`}
              >
                <h3 className="text-sm font-black text-slate-900">{section.title}</h3>
                <ol className="mt-3 space-y-2">
                  {section.items.map((item, index) => (
                    <li key={`${section.title}-${index}`} className="flex gap-2 text-sm font-medium leading-relaxed text-slate-600">
                      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-black text-slate-500 shadow-sm">
                        {index + 1}
                      </span>
                      <span className="min-w-0 break-words">{item}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </div>
        <footer className="border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-bold leading-relaxed text-slate-500">
              설명서는 입문 안내입니다. 실제 가능한 행동과 판정은 게임 화면의 버튼 상태와 서버 규칙을 따릅니다.
            </p>
            <Link
              to={game.to}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white transition hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
              onClick={onClose}
            >
              입장하기
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </footer>
      </section>
    </div>
  );
};

export const GamesHub = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("board");
  const [activeFilter, setActiveFilter] = useState("all");
  const [manualGame, setManualGame] = useState(null);
  const [resumeEntries, setResumeEntries] = useState([]);
  const [hubBanners, setHubBanners] = useState([]);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [bannerLoading, setBannerLoading] = useState(true);
  const [bannerUnavailable, setBannerUnavailable] = useState(false);
  const bannerImpressionRef = useRef(new Set());
  const closeManual = useCallback(() => setManualGame(null), []);
  const bannerCount = hubBanners.length;
  const normalizedBannerIndex = bannerCount ? ((bannerIndex % bannerCount) + bannerCount) % bannerCount : 0;
  const activeBanner = bannerCount ? hubBanners[normalizedBannerIndex] : null;
  const resumeGames = activeTab === "video" ? videoGames : boardGames;
  const refreshResumeEntries = useCallback(() => {
    setResumeEntries(readGameHubResumeEntries(resumeGames));
  }, [resumeGames]);
  const gameSections = gameSectionsByTab[activeTab] || gameSectionsByTab.board;
  const selectedFilter = gameHubFilterOptions.find((option) => option.key === activeFilter) || gameHubFilterOptions[0];
  const filteredSections = gameSections.map((section) => ({
    ...section,
    totalGames: section.games.length,
    games: section.games.filter(selectedFilter.predicate),
  }));
  const visibleGames = filteredSections.flatMap((section) => section.games);

  const sendGameHubBannerEvent = useCallback(async (banner, eventType) => {
    try {
      await homeAdapter.trackBannerEvent(banner, eventType);
    } catch {
      // Banner analytics must not block game hub interactions.
    }
  }, []);

  const showNextBanner = useCallback(() => {
    setBannerIndex((prev) => (bannerCount ? (prev + 1) % bannerCount : 0));
  }, [bannerCount]);

  const showPrevBanner = useCallback(() => {
    setBannerIndex((prev) => (bannerCount ? (prev - 1 + bannerCount) % bannerCount : 0));
  }, [bannerCount]);

  useEffect(() => {
    refreshResumeEntries();
    if (typeof window === "undefined") return undefined;
    const resumeKeys = new Set(
      Object.values(gameHubResumeStorageKeys).flatMap((key) => [key, gameHubResumeTitleStorageKey(key)].filter(Boolean))
    );
    const handleStorage = (event) => {
      if (!event.key || resumeKeys.has(event.key)) {
        refreshResumeEntries();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [refreshResumeEntries]);

  useEffect(() => {
    const controller = new AbortController();
    setBannerLoading(true);
    setBannerUnavailable(false);

    homeAdapter.fetchBanners({ user, signal: controller.signal, limit: 5 })
      .then((banners) => {
        if (controller.signal.aborted) return;
        setHubBanners(banners);
        setBannerIndex(0);
        bannerImpressionRef.current = new Set();
        setBannerUnavailable(false);
      })
      .catch((error) => {
        if (controller.signal.aborted || isGameHubBannerRequestCanceled(error)) return;
        setHubBanners([]);
        setBannerIndex(0);
        setBannerUnavailable(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setBannerLoading(false);
        }
      });

    return () => controller.abort();
  }, [user]);

  useEffect(() => {
    if (!bannerCount || bannerIndex < bannerCount) return;
    setBannerIndex(0);
  }, [bannerCount, bannerIndex]);

  useEffect(() => {
    if (bannerCount <= 1) return undefined;
    const timer = window.setInterval(showNextBanner, 4500);
    return () => window.clearInterval(timer);
  }, [bannerCount, showNextBanner]);

  useEffect(() => {
    if (!activeBanner?.id) return;
    const key = String(activeBanner.id);
    if (bannerImpressionRef.current.has(key)) return;
    bannerImpressionRef.current.add(key);
    sendGameHubBannerEvent(activeBanner, "IMPRESSION");
  }, [activeBanner, sendGameHubBannerEvent]);

  useEffect(() => {
    setActiveFilter("all");
  }, [activeTab]);

  return (
    <div className="animate-fade-in space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/60 sm:p-6">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1 text-[11px] font-black text-slate-500">
            <Sparkles className="h-3.5 w-3.5 text-primary-500" />
            게임 허브
          </div>
          <GameHubHeroBanner
            banners={hubBanners}
            activeIndex={normalizedBannerIndex}
            loading={bannerLoading}
            unavailable={bannerUnavailable}
            onNext={showNextBanner}
            onPrev={showPrevBanner}
            onSelect={setBannerIndex}
            onBannerEvent={sendGameHubBannerEvent}
          />
          <div className="grid max-w-md grid-cols-2 rounded-2xl bg-slate-100 p-1" role="tablist" aria-label="게임 종류">
            {[
              { key: "board", label: "보드게임", count: boardGames.length },
              { key: "video", label: "비디오게임", count: videoGames.length },
            ].map((tab) => {
              const selected = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={`min-h-11 rounded-xl px-4 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 ${
                    selected ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"
                  }`}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setActiveFilter("all");
                  }}
                >
                  {tab.label}
                  <span className="ml-1 text-[11px] text-slate-400">{tab.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <GameHubResumePanel entries={resumeEntries} activeTab={activeTab} />

      <GameHubQuickFilterPanel activeTab={activeTab} activeFilter={activeFilter} onFilterChange={setActiveFilter} />

      {filteredSections.map((section) => (
        <section key={section.title} className="space-y-3">
          <div className="flex flex-row items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="text-lg font-black text-slate-900 sm:text-xl">{section.title}</h2>
            </div>
            <div className="text-[11px] font-black text-slate-400">{section.games.length}개</div>
          </div>
          {section.games.length ? (
            <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
              {section.games.map((game) => (
                <GameCard key={game.to} game={game} onOpenManual={setManualGame} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-500">
              이 조건에 맞는 게임이 없습니다.
              <button type="button" className="ml-2 font-black text-slate-900 underline" onClick={() => setActiveFilter("all")}>
                전체 보기
              </button>
            </div>
          )}
        </section>
      ))}
      <BusinessPrivacyFooter headingId="gamehub-footer-info-heading" />
      <GameManualModal game={manualGame} onClose={closeManual} />
    </div>
  );
};

export default GamesHub;
