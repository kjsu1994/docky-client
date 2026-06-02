import { Link } from "react-router-dom";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowRight, BookOpen, CircleHelp, Dices, Sparkles, X } from "lucide-react";

const sharedRoomStartSteps = [
  "카드의 입장하기를 누른 뒤 방 만들기 또는 방 코드 입장을 선택합니다.",
  "방장은 방 제목과 규칙을 고르고, 참가자는 입장 후 준비하기를 누릅니다.",
  "인원 조건과 준비 상태가 맞으면 방장이 게임 시작을 눌러 본게임으로 들어갑니다.",
  "게임 화면에 들어간 뒤에도 방 코드, 참가자, 준비 상태, 다시 하기 흐름은 같은 방식으로 유지됩니다.",
];

const gameManuals = {
  plinko: {
    subtitle: "주사위 결과로 구슬을 얻고, 구슬이 떨어진 배율 칸으로 포인트를 노리는 1인 아케이드 게임입니다.",
    tags: ["1인", "즉시 플레이", "포인트 보상"],
    sections: [
      {
        title: "처음 시작 순서",
        items: [
          "입장하면 별도 방 생성 없이 바로 플레이 화면이 열립니다.",
          "첫 굴림 버튼으로 주사위를 굴리고, 남기고 싶은 주사위를 선택한 뒤 나머지를 다시 굴릴 수 있습니다.",
          "확정된 주사위 족보에 따라 구슬 수가 정해지고, 바로 시작 또는 구슬 투입 버튼으로 플링코 보드에 구슬을 떨어뜨립니다.",
        ],
      },
      {
        title: "목표",
        items: [
          "좋은 주사위 족보를 만들어 더 많은 구슬을 확보하는 것이 1차 목표입니다.",
          "구슬이 높은 배율 슬롯에 들어갈수록 획득 포인트가 커집니다.",
        ],
      },
      {
        title: "초보 팁",
        items: [
          "첫 굴림에서 같은 눈이 2개 이상이면 그 눈을 보존하고 나머지를 다시 굴리는 전략이 안정적입니다.",
          "구슬이 적어도 높은 배율에 들어가면 보상이 커질 수 있으므로, 결과 화면의 획득 포인트를 확인하고 새 게임을 시작하세요.",
        ],
      },
    ],
  },
  lasVegas: {
    subtitle: "주사위를 카지노에 배팅해 머니 카드를 가져오는 실시간 보드게임입니다. 동점이 가장 큰 변수입니다.",
    tags: ["2~6인", "주사위 배팅", "동점 탈락"],
    sections: [
      { title: "처음 시작 순서", items: sharedRoomStartSteps },
      {
        title: "목표",
        items: [
          "여러 라운드 동안 카지노에서 머니 카드를 모아 최종 보유금이 가장 많은 플레이어가 승리합니다.",
          "각 카지노에는 라운드마다 머니 카드가 깔리며, 높은 금액 카드일수록 경쟁이 치열합니다.",
        ],
      },
      {
        title: "차례 진행",
        items: [
          "내 차례에는 남은 주사위를 모두 굴립니다. 나온 눈 중 하나를 고르면 그 눈의 주사위를 전부 같은 번호 카지노에 배치합니다.",
          "한 번 카지노에 놓은 주사위는 그 라운드에 다시 굴릴 수 없습니다.",
          "현재 굴림과 직전 배팅 위치는 모든 참가자가 함께 볼 수 있어 상대의 선택을 보고 다음 배팅을 판단할 수 있습니다.",
        ],
      },
      {
        title: "정산과 승리",
        items: [
          "라운드가 끝나면 카지노별로 주사위 개수를 비교합니다.",
          "같은 카지노에서 같은 개수로 동점인 플레이어들은 해당 카지노 보상 경쟁에서 모두 빠집니다.",
          "남은 플레이어가 많은 주사위 순서대로 큰 금액 카드부터 가져가며, 한 명만 배팅한 카지노는 그 플레이어가 해당 카지노의 머니 카드를 모두 가져갑니다.",
        ],
      },
      {
        title: "초보 팁",
        items: [
          "큰돈 카지노에 주사위를 많이 놓는 것보다, 상대와 동점이 되지 않는 안전한 배팅이 더 좋을 때가 많습니다.",
          "상대가 이미 같은 개수로 놓은 카지노는 내가 들어가면 둘 다 탈락할 수 있으니 직전 배팅 표시와 카지노별 주사위 수를 먼저 확인하세요.",
        ],
      },
    ],
  },
  noThanks: {
    subtitle: "카드를 피할지, 칩을 받고 가져갈지 결정하는 낮은 점수 경쟁 카드게임입니다.",
    tags: ["3~6인", "카드 선택", "낮은 점수"],
    sections: [
      { title: "처음 시작 순서", items: sharedRoomStartSteps },
      {
        title: "목표",
        items: [
          "게임 종료 시 카드 점수에서 남은 칩을 뺀 최종 점수가 가장 낮은 플레이어가 승리합니다.",
          "높은 숫자 카드는 부담이지만, 칩이 많이 쌓였거나 내 연속 카드에 붙는 숫자라면 가져갈 가치가 있습니다.",
        ],
      },
      {
        title: "차례 진행",
        items: [
          "3부터 35까지의 카드 중 일부를 제거한 뒤 남은 카드가 한 장씩 공개됩니다.",
          "내 차례에는 칩 1개를 내고 카드를 넘기거나, 공개 카드와 그 위에 쌓인 칩을 모두 가져갑니다.",
          "칩이 없으면 더 이상 넘길 수 없으므로 공개 카드를 가져가야 합니다.",
        ],
      },
      {
        title: "점수 계산",
        items: [
          "가져간 카드 숫자는 기본적으로 점수가 됩니다.",
          "연속된 숫자 카드 묶음은 가장 작은 숫자 하나만 점수로 계산합니다. 예를 들어 8, 9, 10을 모두 가지고 있으면 8점만 더합니다.",
          "남은 칩은 최종 점수에서 1개당 1점씩 빼므로, 칩을 모아 두면 높은 카드를 상쇄할 수 있습니다.",
        ],
      },
      {
        title: "초보 팁",
        items: [
          "내가 이미 가진 숫자와 이어지는 카드는 생각보다 싸게 처리할 수 있습니다.",
          "초반부터 칩을 모두 쓰면 강제로 카드를 가져가게 되므로, 적어도 몇 개는 방어용으로 남겨두는 편이 안전합니다.",
        ],
      },
    ],
  },
  catan: {
    subtitle: "자원을 생산하고 도로, 마을, 도시를 확장해 목표 승점을 먼저 달성하는 전략 보드게임입니다.",
    tags: ["3~6인", "자원 생산", "건설 전략"],
    sections: [
      { title: "처음 시작 순서", items: sharedRoomStartSteps },
      {
        title: "목표",
        items: [
          "기본판은 보통 10승점을 먼저 달성하면 승리합니다. 선택한 확장이나 시나리오에 따라 목표 점수가 달라질 수 있습니다.",
          "마을, 도시, 최장 교역로, 최대 기사력, 개발 카드, 확장별 보너스가 승점의 주요 원천입니다.",
        ],
      },
      {
        title: "기본 흐름",
        items: [
          "초기 배치에서 마을과 도로를 놓아 첫 생산 기반을 만듭니다.",
          "차례가 되면 주사위를 굴리고, 나온 숫자 타일에 인접한 마을과 도시가 자원을 생산합니다.",
          "자원으로 도로, 마을, 도시, 개발 카드를 만들고 필요한 경우 은행, 항구, 다른 플레이어와 거래합니다.",
          "7이 나오면 손패가 많은 플레이어는 자원을 버리고, 도적을 옮겨 원하는 플레이어의 자원을 빼앗을 수 있습니다.",
        ],
      },
      {
        title: "확장과 선택 규칙",
        items: [
          "5~6인 방에서는 추가 인원과 보드 확장, 카타니안 보조 턴 흐름이 적용됩니다.",
          "방장이 항해사, 도시와 기사, 상인과 야만인 같은 구현된 선택 규칙을 고르면 해당 규칙의 배, 기사, 화물, 특수 보상 UI가 게임 중에 나타납니다.",
          "처음이라면 기본판 또는 5~6인 확장부터 시작하고, 익숙해진 뒤 복잡한 확장을 고르는 편이 좋습니다.",
        ],
      },
      {
        title: "초보 팁",
        items: [
          "숫자 6과 8은 자주 나오므로 중요하지만, 한 자원에만 몰리면 건설이 막힐 수 있습니다. 흙, 나무, 밀, 양, 철을 균형 있게 확보하세요.",
          "항구 근처에 자리 잡으면 부족한 자원을 교환하기 쉬워집니다.",
          "마을을 빨리 늘리면 생산 지점이 많아지고, 도시는 같은 타일에서 더 많은 자원을 줍니다.",
        ],
      },
    ],
  },
  blokus: {
    subtitle: "내 색 조각을 최대한 많이 놓되, 내 조각끼리는 모서리로만 이어야 하는 배치 퍼즐형 보드게임입니다.",
    tags: ["2~4인", "도형 배치", "코너 연결"],
    sections: [
      { title: "처음 시작 순서", items: sharedRoomStartSteps },
      {
        title: "목표",
        items: [
          "내 조각을 보드에 많이 놓아 남은 칸 수를 최소화하는 것이 목표입니다.",
          "게임 종료 후 남은 조각 칸은 감점이 되고, 모든 조각을 다 놓으면 보너스를 받을 수 있습니다.",
        ],
      },
      {
        title: "배치 규칙",
        items: [
          "첫 조각은 내 시작 모서리를 반드시 덮어야 합니다.",
          "이후 내 새 조각은 이미 놓인 내 조각과 꼭짓점으로는 닿아야 하지만, 변으로 맞닿으면 안 됩니다.",
          "상대 조각과는 변으로 닿아도 괜찮습니다. 막는 과정에서 상대 조각 옆을 적극적으로 활용하세요.",
          "조각은 회전과 뒤집기를 바꿔 볼 수 있고, 보드에서 미리보기 색상과 놓기 버튼 안내로 합법 위치를 확인할 수 있습니다.",
        ],
      },
      {
        title: "변형 규칙",
        items: [
          "듀오는 2인 전용 작은 보드에서 진행되어 초반부터 접촉이 빠릅니다.",
          "팀전이나 2색 플레이에서는 색상별 점수와 팀 합산을 확인하며 공간을 나눠 써야 합니다.",
          "놓을 수 있는 조각이 없을 때만 패스할 수 있으며, 서버가 최종 배치 가능 여부를 판정합니다.",
        ],
      },
      {
        title: "초보 팁",
        items: [
          "큰 조각은 후반에 놓기 어렵습니다. 초반에 넓게 뻗어 나가며 큰 조각을 먼저 처리하세요.",
          "내 조각의 새 모서리를 많이 남겨야 다음 선택지가 늘어납니다.",
          "상대가 들어오지 못하게 막는 것보다, 내 조각이 계속 뻗을 길을 확보하는 것이 보통 더 중요합니다.",
        ],
      },
    ],
  },
  mahe: {
    subtitle: "거북이를 움직여 섬을 돌고 알 카드를 모으는 주사위 경주 게임입니다.",
    tags: ["2~7인", "거북이 경주", "위험 선택"],
    sections: [
      { title: "처음 시작 순서", items: sharedRoomStartSteps },
      {
        title: "목표",
        items: [
          "트랙을 한 바퀴 넘어갈 때 공개된 알 카드를 얻고, 게임 종료 시 알 카드 점수 합계가 가장 높은 플레이어가 승리합니다.",
          "동점이면 더 많은 알 카드를 가진 플레이어가 앞섭니다.",
        ],
      },
      {
        title: "차례 진행",
        items: [
          "내 차례에는 주사위를 1개부터 최대 3개까지 굴릴 수 있습니다.",
          "멈추면 주사위 합계에 굴린 주사위 개수를 곱한 칸 수만큼 이동합니다.",
          "합계가 7을 넘으면 실패가 되어 이번 이동을 잃고, 움직이던 거북이 묶음이 시작점으로 돌아갑니다.",
        ],
      },
      {
        title: "업고 가기와 득점",
        items: [
          "거북이가 같은 칸에 서면 위로 올라탄 거북이까지 함께 이동합니다.",
          "업힌 상태에서는 위에 있는 거북이가 주사위 개수를 고르는 흐름이 생길 수 있습니다.",
          "한 바퀴를 넘어 득점하면 이동 묶음의 맨 위 거북이가 현재 알 카드를 가져갑니다.",
          "마지막 7점 알이 획득되면 게임이 끝납니다.",
        ],
      },
      {
        title: "초보 팁",
        items: [
          "합계 7을 넘지 않는 것이 핵심입니다. 이미 합이 5 이상이면 추가 굴림 위험이 큽니다.",
          "한 번 더 굴리면 더 멀리 가지만, 실패하면 시작점으로 돌아갑니다. 화면의 실패 확률 안내를 보고 결정하세요.",
          "남의 거북이 위에 타면 이동을 공짜로 얻을 수 있으니, 무조건 앞서가기보다 업히는 위치도 노려보세요.",
        ],
      },
    ],
  },
  dalmuti: {
    subtitle: "같은 숫자의 카드를 묶어 내며 손패를 먼저 비우고, 다음 손의 계급을 올리는 클라이밍 카드게임입니다.",
    tags: ["4~8인", "계급 카드", "세금과 혁명"],
    sections: [
      { title: "처음 시작 순서", items: sharedRoomStartSteps },
      {
        title: "목표",
        items: [
          "한 손에서 카드를 빨리 비울수록 다음 손의 계급이 높아지고 점수를 얻습니다.",
          "누적 점수가 높은 플레이어가 좋은 흐름을 가져가며, 대 달무티는 다음 손에서 가장 유리한 위치로 시작합니다.",
        ],
      },
      {
        title: "카드 내기 규칙",
        items: [
          "카드는 같은 숫자를 같은 장수로 묶어 냅니다. 예를 들어 8 두 장 위에는 더 강한 숫자 두 장만 낼 수 있습니다.",
          "숫자가 낮을수록 강합니다. 1은 대 달무티로 가장 강하고, 큰 숫자일수록 약합니다.",
          "광대는 와일드로 다른 숫자 묶음을 채울 수 있지만, 광대만 내면 가장 약한 묶음으로 취급됩니다.",
          "낼 수 없거나 전략적으로 쉬고 싶으면 패스할 수 있고, 모두가 패스하면 마지막으로 카드를 낸 사람이 새 묶음을 시작합니다.",
        ],
      },
      {
        title: "계급, 세금, 혁명",
        items: [
          "이전 손의 순위에 따라 대 달무티, 소 달무티, 상인, 농노 계급이 정해집니다.",
          "세금 단계에서는 농노 쪽의 좋은 카드가 달무티 쪽으로 넘어가고, 달무티 쪽은 정해진 장수만큼 돌려줄 카드를 선택합니다.",
          "광대 2장을 가진 플레이어는 혁명을 선언할 수 있습니다. 혁명이 선언되면 세금 흐름이 바뀌거나 계급 순서가 뒤집힐 수 있습니다.",
          "방장이 선택한 첫 손 혁명 규칙이나 덱 조정 규칙은 대기방의 규칙 선택에 따라 적용됩니다.",
        ],
      },
      {
        title: "초보 팁",
        items: [
          "처음 시작할 때는 같은 숫자가 많이 모인 묶음을 기준으로 손패를 정리하세요.",
          "강한 낮은 숫자는 중요한 순간에 남겨두면 주도권을 되찾기 좋습니다.",
          "카드를 빨리 털어야 다음 손 계급이 좋아지므로, 너무 아끼기보다 낼 수 있을 때 손패를 줄이는 판단이 중요합니다.",
        ],
      },
    ],
  },
};

const games = [
  {
    title: "Lucky Plinko",
    description: "(1인) 혼자 플레이하는 빠칭코",
    to: "/app/plinko",
    tone: "from-emerald-500 via-teal-500 to-cyan-500",
    players: "1인",
    minPlayers: 1,
    maxPlayers: 1,
    mode: "싱글",
    preview: "plinko",
    highlights: ["즉시 플레이", "혼자 진행"],
    manual: gameManuals.plinko,
    featured: false,
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
    highlights: ["실시간 방", "주사위 배팅"],
    manual: gameManuals.lasVegas,
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
    highlights: ["실시간 방", "카드 선택"],
    manual: gameManuals.noThanks,
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
    highlights: ["기본판", "5~6인", "공식 확장"],
    manual: gameManuals.catan,
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
    highlights: ["본게임", "듀오", "팀전"],
    manual: gameManuals.blokus,
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
    highlights: ["본게임", "업고 가기", "확률 안내"],
    manual: gameManuals.mahe,
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
    highlights: ["본게임", "세금", "혁명"],
    manual: gameManuals.dalmuti,
    featured: true,
  },
];

const gameRoutePreloads = {
  "/app/games/las-vegas": () => import("./LasVegasGame.jsx"),
  "/app/games/no-thanks": () => import("./NoThanksGame.jsx"),
  "/app/games/catan": () => import("./TabletopGame.jsx"),
  "/app/games/blokus": () => import("./TabletopGame.jsx"),
  "/app/games/mahe": () => import("./TabletopGame.jsx"),
  "/app/games/dalmuti": () => import("./TabletopGame.jsx"),
};

const preloadedRoutes = new Set();

const preloadGameRoute = (to) => {
  const preload = gameRoutePreloads[to];
  if (!preload || preloadedRoutes.has(to)) return;
  preloadedRoutes.add(to);
  preload().catch(() => preloadedRoutes.delete(to));
};

const gamesByPlayerCount = [...games].sort((left, right) => (
  left.minPlayers - right.minPlayers ||
  left.maxPlayers - right.maxPlayers
));

const gameSections = [
  {
    title: "게임 목록",
    description: "혼자부터 함께 즐길 수 있는 다양한 게임들이 있습니다.",
    games: gamesByPlayerCount,
  },
];

const GameCard = ({ game, onOpenManual }) => {
  const titleId = `game-card-${game.preview}-title`;
  const descId = `game-card-${game.preview}-desc`;
  const highlightText = (game.highlights || []).join(", ");

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
        <div className="flex h-full min-w-0 flex-col rounded-[calc(1rem-1px)] bg-white/95 p-4 backdrop-blur sm:p-5">
          <div className={`overflow-hidden rounded-2xl bg-gradient-to-br ${game.tone} p-3`} aria-hidden="true">
            <div className="flex min-h-36 min-w-0 items-center justify-center rounded-xl bg-white/20 p-3">
              <GamePreview type={game.preview} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 pr-12">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">
              <Dices className="h-3 w-3" />
              {game.players}
            </span>
            <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black text-white">{game.mode}</span>
          </div>
          <h2 id={titleId} className="mt-4 text-xl font-black text-slate-900 sm:text-2xl">{game.title}</h2>
          <p id={descId} className="mt-2 text-sm font-medium leading-relaxed text-slate-500">{game.description}</p>
          {!!game.highlights?.length && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {game.highlights.map((highlight) => (
                <span key={highlight} className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">
                  {highlight}
                </span>
              ))}
            </div>
          )}
          <div className="flex-1" />
          <div className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white transition-all group-hover:bg-primary-600 sm:w-auto">
            입장하기
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </Link>
      <button
        type="button"
        className="absolute right-4 top-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/80 bg-white/95 text-slate-700 shadow-lg shadow-slate-900/10 transition hover:scale-105 hover:bg-slate-900 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/80"
        aria-label={`${game.title} 설명서 열기`}
        title={`${game.title} 설명서`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onOpenManual(game);
        }}
      >
        <CircleHelp className="h-5 w-5" />
      </button>
    </article>
  );
};

const GamePreview = ({ type }) => {
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
  const [manualGame, setManualGame] = useState(null);
  const closeManual = useCallback(() => setManualGame(null), []);

  return (
    <div className="animate-fade-in space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/60 sm:p-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1 text-[11px] font-black text-slate-500">
            <Sparkles className="h-3.5 w-3.5 text-primary-500" />
            게임 허브
          </div>
          <h1 className="mt-4 text-2xl font-black text-slate-900 sm:text-4xl">게임을 선택하세요</h1>
          <p className="mt-3 text-sm font-medium text-slate-500 sm:text-base">
            방 만들기, 방 코드 입장, 준비하기 흐름은 게임마다 동일하게 유지됩니다.
          </p>
        </div>
      </section>

      {gameSections.map((section) => (
        <section key={section.title} className="space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900 sm:text-xl">{section.title}</h2>
              <p className="mt-1 text-xs font-bold leading-relaxed text-slate-500 sm:text-sm">{section.description}</p>
            </div>
            <div className="text-[11px] font-black text-slate-400">{section.games.length}개</div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {section.games.map((game) => (
              <GameCard key={game.to} game={game} onOpenManual={setManualGame} />
            ))}
          </div>
        </section>
      ))}
      <GameManualModal game={manualGame} onClose={closeManual} />
    </div>
  );
};

export default GamesHub;
