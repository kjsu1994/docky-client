const section = (title, items) => ({ title, items });

const normalizeCode = (value) => String(value || "BASE").trim().toUpperCase() || "BASE";

const variantLabel = (variant, fallback = "기본 규칙") =>
  variant?.displayName || variant?.variantName || variant?.name || variant?.code || fallback;

const guide = ({ title, summary, sections }) => ({ title, summary, sections });

const withVariantSection = (sections, title, items) => (
  items?.length ? [...sections, section(title, items)] : sections
);

const catanGuide = (code, variant) => {
  const baseSections = [
    section("공식 룰 핵심", [
      "차례가 시작되면 주사위 2개를 굴리고, 나온 숫자 타일에 인접한 마을과 도시는 자원을 생산합니다.",
      "자원은 도로, 마을, 도시, 개발 카드에 사용합니다. 다른 플레이어, 은행, 항구와 교역할 수 있습니다.",
      "7이 나오면 도적을 옮기고, 자원이 많은 플레이어는 일부를 버립니다. 도적이 있는 타일은 생산하지 않습니다.",
      "기본 목표는 10승점입니다. 마을, 도시, 승점 카드, 최장 교역로, 최대 기사력이 주요 점수입니다.",
    ]),
  ];
  const variantItems = code === "FIVE_SIX"
    ? [
        "5~6인 확장은 더 넓은 보드와 추가 인원 흐름을 사용합니다.",
        "핵심 생산, 교역, 건설, 도적 규칙은 기본판과 같습니다.",
      ]
    : code.includes("SEAFARERS")
      ? [
          "해양 확장은 배를 도로처럼 연결해 바다를 건너고, 시나리오 목표에 따라 추가 승점을 얻습니다.",
          "해적은 바다에서 배와 생산을 방해하는 역할을 하며 도적과 비슷하게 관리합니다.",
        ]
      : code === "CITIES_KNIGHTS"
        ? [
            "도시와 기사는 상품, 도시 발전, 기사 활성화, 야만인 침공 방어가 핵심입니다.",
            "기사를 충분히 준비하지 못하면 야만인 침공 때 도시를 잃을 수 있습니다.",
          ]
        : code.includes("TRADERS_BARBARIANS")
          ? [
              "상인과 야만인은 선택 시나리오별 추가 목표와 토큰을 기본 카탄 위에 얹어 진행합니다.",
              "방 설정의 시나리오 이름과 목표 승점을 먼저 확인하면 됩니다.",
            ]
          : code === "EXPLORERS_PIRATES"
            ? [
                "탐험가와 해적은 배와 선원을 준비해 미지의 해역을 탐험하고 임무 점수를 얻습니다.",
                "도로 확장보다 해상 이동, 화물 운송, 임무 달성이 더 중요합니다.",
              ]
            : [];

  return guide({
    title: `카탄 · ${variantLabel(variant, code === "BASE" ? "기본판" : code)}`,
    summary: "자원을 생산하고 교역, 건설, 개발 카드로 승점을 먼저 채우는 전략 보드게임입니다.",
    sections: withVariantSection(baseSections, "선택 모드 차이", variantItems),
  });
};

const blokusGuide = (code, variant) => {
  const variantItems = code === "DUO"
    ? ["2인 전용 작은 보드에서 진행하며, 지정된 시작점에서 빠르게 중앙 싸움이 시작됩니다."]
    : code === "TWO_PLAYER"
      ? ["2인전은 각 플레이어가 두 색을 맡아 두 색의 남은 칸을 합산합니다."]
      : code === "THREE_PLAYER"
        ? ["3인전은 남는 한 색을 중립 또는 순환 색으로 처리하며, 방 설정의 점수 방식을 따릅니다."]
        : code === "TEAM"
          ? ["팀전은 마주 보는 색끼리 한 팀이 되며, 팀원의 남은 칸을 합산해 낮은 팀이 이깁니다."]
          : [];

  return guide({
    title: `블로커스 · ${variantLabel(variant, code === "BASE" ? "기본판" : code)}`,
    summary: "내 조각은 꼭짓점으로만 이어 붙이고, 가능한 많은 칸을 보드에 내려놓는 배치 게임입니다.",
    sections: withVariantSection([
      section("공식 룰 핵심", [
        "첫 조각은 자기 시작 위치를 반드시 덮어야 합니다.",
        "이후 내 조각은 이미 놓인 내 조각과 꼭짓점으로 닿아야 하고, 변으로 맞닿으면 안 됩니다.",
        "상대 조각과는 변으로 닿아도 됩니다. 막고 파고드는 공간 싸움이 핵심입니다.",
        "더 놓을 수 없으면 패스합니다. 모두가 패스하면 남은 조각 칸 수가 적은 쪽이 이깁니다.",
      ]),
    ], "선택 모드 차이", variantItems),
  });
};

const maheGuide = () => guide({
  title: "마헤 · 기본판",
  summary: "거북이를 움직여 섬을 돌고 알 카드를 모으는 주사위 경주 게임입니다.",
  sections: [
    section("공식 룰 핵심", [
      "차례에는 주사위를 1개 굴린 뒤 멈추거나, 위험을 감수하고 최대 3개까지 더 굴릴 수 있습니다.",
      "굴린 눈의 합이 7을 넘으면 실패하고 이동하지 못합니다.",
      "멈추면 눈의 합에 굴린 주사위 개수를 곱한 칸 수만큼 이동합니다.",
      "같은 칸에 있으면 위에 올라탄 거북이까지 함께 이동합니다. 한 바퀴를 넘으면 맨 위 거북이가 공개된 알 카드를 얻습니다.",
      "알 카드 점수 합이 가장 높은 플레이어가 이깁니다.",
    ]),
  ],
});

const dalmutiGuide = (code, variant) => {
  const variantItems = code === "STRIPPED_DECK"
    ? ["4~5인용 덱 조정은 일부 하위 카드를 빼서 손패가 지나치게 길어지지 않게 하는 선택 규칙입니다."]
    : code === "FIRST_DEAL_REVOLUTION"
      ? ["첫 손 혁명 규칙은 첫 라운드 세금 흐름을 완화해 모두가 같은 조건에서 계급을 정하게 합니다."]
      : [];

  return guide({
    title: `달무티 · ${variantLabel(variant, code === "BASE" ? "기본판" : code)}`,
    summary: "같은 숫자의 카드를 묶어 내고 손패를 먼저 비워 다음 손의 계급을 올리는 카드게임입니다.",
    sections: withVariantSection([
      section("공식 룰 핵심", [
        "숫자가 낮을수록 강합니다. 1은 대 달무티, 12는 가장 약한 계급 카드입니다.",
        "앞 사람이 낸 묶음과 같은 장수이면서 더 강한 숫자 묶음만 낼 수 있습니다.",
        "낼 수 없거나 아끼고 싶으면 패스합니다. 모두가 패스하면 마지막으로 낸 사람이 새 묶음을 시작합니다.",
        "손패를 비운 순서가 다음 손의 계급이 됩니다. 높은 계급은 세금 교환으로 더 유리하게 시작합니다.",
        "광대 2장은 혁명을 선언해 세금이나 계급 흐름을 뒤집는 데 사용할 수 있습니다.",
      ]),
    ], "선택 모드 차이", variantItems),
  });
};

const sixNimmtGuide = () => guide({
  title: "6 nimmt! · 기본판",
  summary: "숫자 카드를 동시에 내고 네 줄에 붙이며, 여섯 번째 카드 벌점을 피하는 카드게임입니다.",
  sections: [
    section("공식 룰 핵심", [
      "각 라운드에는 손패 10장을 받고, 테이블에는 4개 줄의 시작 카드가 놓입니다.",
      "모두 카드 1장을 동시에 고르면 낮은 숫자부터 처리합니다.",
      "카드는 자기보다 작은 끝 카드 중 가장 가까운 숫자의 줄에 붙습니다.",
      "붙일 곳이 없으면 한 줄을 직접 가져가고, 낸 카드가 새 줄의 시작이 됩니다.",
      "한 줄의 여섯 번째 카드가 되면 기존 5장을 가져가 벌점으로 계산합니다. 누군가 66벌점 이상이면 총 벌점이 가장 낮은 플레이어가 이깁니다.",
    ]),
  ],
});

const telestrationsGuide = () => guide({
  title: "텔레스트레이션 · 기본판",
  summary: "문장과 그림을 번갈아 넘기고, 마지막에 변화 과정을 함께 공개하는 파티 게임입니다.",
  sections: [
    section("공식 룰 핵심", [
      "각자 비밀 시작 문장을 적고, 다음 사람은 그 문장만 보고 그림을 그립니다.",
      "그다음 사람은 그림만 보고 문장을 추측합니다. 이 문장과 그림 릴레이를 책자가 돌아올 때까지 반복합니다.",
      "마지막에는 각 책자를 처음부터 공개해 시작 문장이 어떻게 바뀌었는지 함께 봅니다.",
      "정답을 맞히는 경쟁보다 변화 과정을 즐기는 게임입니다. 점수 규칙을 쓰는 방에서는 좋은 그림, 좋은 추측, 원문 일치 등을 점수로 줄 수 있습니다.",
    ]),
  ],
});

const mafiaGuide = (code, variant) => {
  const roleItems = code === "POLICE_ONLY"
    ? ["경찰은 밤마다 한 명을 조사해 마피아 여부를 확인합니다. 의사가 없으므로 밤 피해를 막을 수 없습니다."]
    : code === "DOCTOR_ONLY"
      ? ["의사는 밤마다 한 명을 보호합니다. 경찰이 없으므로 낮 토론과 투표 추리가 더 중요합니다."]
      : code === "NO_SPECIALS"
        ? ["특수직 없이 시민과 마피아만 사용합니다. 처음 하는 사람에게 가장 단순한 구성입니다."]
        : ["경찰은 조사하고 의사는 보호합니다. 두 특수직 모두 밤에만 비밀 행동을 합니다."];

  return guide({
    title: `마피아 · ${variantLabel(variant, code === "BASE" ? "경찰+의사" : code)}`,
    summary: "비밀 역할을 받고 밤 행동, 낮 토론, 투표를 반복해 시민팀과 마피아팀의 승부를 가르는 추리 게임입니다.",
    sections: [
      section("공식 룰 핵심", [
        "게임 시작 때 각자 시민팀 또는 마피아팀 역할을 비밀로 받습니다.",
        "밤에는 마피아가 제거 대상을 고르고, 선택 규칙에 따라 경찰 조사와 의사 보호가 진행됩니다.",
        "낮에는 밤 결과를 확인하고 토론한 뒤 투표로 한 명을 처형할 수 있습니다.",
        "마피아가 모두 제거되면 시민팀이 이깁니다. 마피아 수가 시민팀 수와 같거나 많아지면 마피아팀이 이깁니다.",
      ]),
      section("선택 역할 구성", roleItems),
    ],
  });
};

const pokerHoldemGuide = (code, variant) => {
  const stackItems = code === "SHORT"
    ? ["숏스택은 시작 칩과 블라인드 구조가 빠르게 압박을 주는 짧은 세션입니다."]
    : code === "DEEP"
      ? ["딥스택은 시작 칩이 많아 한두 번의 팟보다 장기 운영이 더 중요합니다."]
      : ["표준 세션은 기본 칩과 블라인드로 진행합니다. 정해진 핸드 수 뒤 칩이 가장 많은 플레이어가 유리합니다."];

  return guide({
    title: `포커 · 리밋 텍사스 홀덤 · ${variantLabel(variant, code === "BASE" ? "표준" : code)}`,
    summary: "개인 카드 2장과 공용 카드 5장 중 가장 강한 5장 족보로 팟을 겨루는 포커입니다.",
    sections: [
      section("공식 룰 핵심", [
        "각 플레이어는 비공개 홀카드 2장을 받고, 테이블에는 플랍 3장, 턴 1장, 리버 1장이 순서대로 공개됩니다.",
        "홀카드와 공용 카드 중 원하는 5장을 조합해 가장 강한 포커 족보를 만듭니다.",
        "각 베팅 라운드에는 체크, 콜, 베팅, 레이즈, 폴드 중 가능한 행동만 할 수 있습니다.",
        "리밋 방식은 베팅과 레이즈 금액이 정해진 단위로 제한됩니다.",
        "마지막까지 2명 이상 남으면 쇼다운으로 족보를 비교하고, 모두 폴드하면 마지막으로 남은 플레이어가 팟을 가져갑니다.",
      ]),
      section("선택 모드 차이", stackItems),
    ],
  });
};

const pokerDrawGuide = (variant) => guide({
  title: `포커 · 5장 드로우 · ${variantLabel(variant, "기본판")}`,
  summary: "비공개 카드 5장을 받고 한 번 교체한 뒤, 최종 5장 족보를 비교하는 포커입니다.",
  sections: [
    section("공식 룰 핵심", [
      "각 플레이어는 처음부터 비공개 카드 5장을 받습니다. 공용 카드는 없습니다.",
      "첫 베팅 뒤 원하는 카드를 버리고 같은 장수만큼 새 카드를 받습니다. 이 화면에서는 최대 3장까지 교체할 수 있습니다.",
      "교체하지 않고 그대로 진행할 수도 있습니다.",
      "마지막 베팅 뒤 2명 이상 남으면 5장 족보를 비교합니다. 모두 폴드하면 마지막으로 남은 플레이어가 팟을 가져갑니다.",
    ]),
  ],
});

const noThanksGuide = () => guide({
  title: "No Thanks · 기본판",
  summary: "카드를 피하거나 칩을 받고 가져가며 최종 점수를 낮추는 카드게임입니다.",
  sections: [
    section("공식 룰 핵심", [
      "3~35 숫자 카드 중 일부를 무작위로 빼고, 남은 카드를 한 장씩 공개합니다.",
      "차례에는 칩 1개를 내고 넘기거나, 공개 카드와 그 위의 칩을 모두 가져갑니다.",
      "칩이 없으면 넘길 수 없고 카드를 가져가야 합니다.",
      "카드 숫자는 점수지만, 연속된 숫자 묶음은 가장 낮은 숫자 하나만 계산합니다.",
      "남은 칩은 1개당 -1점입니다. 최종 점수가 가장 낮은 플레이어가 이깁니다.",
    ]),
  ],
});

const lasVegasGuide = () => guide({
  title: "Las Vegas · 기본판",
  summary: "주사위를 카지노에 배팅하고, 동점을 피하며 돈 카드를 모으는 주사위 게임입니다.",
  sections: [
    section("공식 룰 핵심", [
      "각 라운드 시작 때 1~6번 카지노마다 최소 금액 이상이 되도록 돈 카드가 놓입니다.",
      "차례에는 남은 주사위를 모두 굴리고, 나온 눈 하나를 골라 그 눈의 주사위를 전부 같은 번호 카지노에 놓습니다.",
      "한 번 놓은 주사위는 그 라운드에 다시 굴릴 수 없습니다.",
      "모두 주사위를 다 놓으면 카지노별로 주사위 개수를 비교합니다. 같은 개수로 동점인 플레이어는 그 카지노 보상 경쟁에서 빠집니다.",
      "남은 플레이어 중 주사위가 많은 순서대로 큰 돈 카드부터 가져갑니다. 여러 라운드 뒤 총 금액이 가장 높은 플레이어가 이깁니다.",
    ]),
  ],
});

const citadelsGuide = (code, variant) => guide({
  title: `시티델 · ${variantLabel(variant, code === "BASE" ? "기본판" : code)}`,
  summary: "비밀 캐릭터를 고르고 금화와 구역 카드를 관리해 가장 높은 점수의 도시를 만드는 카드게임입니다.",
  sections: [
    section("공식 룰 핵심", [
      "라운드마다 왕관을 가진 플레이어부터 캐릭터를 비밀리에 고릅니다.",
      "캐릭터 번호 순서대로 차례가 호출됩니다. 자기 캐릭터가 불리면 수입을 받고, 능력을 쓰고, 구역을 건설할 수 있습니다.",
      "수입은 금화 2개를 받거나 구역 카드 2장을 보고 1장을 보관하는 방식입니다.",
      "누군가 8번째 구역을 건설하면 그 라운드까지 진행하고 점수를 계산합니다.",
      "구역 비용, 완성 보너스, 첫 완성 보너스, 5색 구역 보너스 등이 점수에 들어갑니다.",
    ]),
  ],
});

export const getBoardGameRuleGuide = ({ game, variantCode, mode, variant } = {}) => {
  const code = normalizeCode(mode === "FIVE_CARD_DRAW" ? "FIVE_CARD_DRAW" : variantCode);

  if (game === "catan") return catanGuide(code, variant);
  if (game === "blokus") return blokusGuide(code, variant);
  if (game === "mahe") return maheGuide(code, variant);
  if (game === "dalmuti") return dalmutiGuide(code, variant);
  if (game === "six-nimmt") return sixNimmtGuide(code, variant);
  if (game === "telestrations") return telestrationsGuide(code, variant);
  if (game === "mafia") return mafiaGuide(code, variant);
  if (game === "poker") return code === "FIVE_CARD_DRAW" ? pokerDrawGuide(variant) : pokerHoldemGuide(code, variant);
  if (game === "no-thanks") return noThanksGuide(code, variant);
  if (game === "las-vegas") return lasVegasGuide(code, variant);
  if (game === "citadels") return citadelsGuide(code, variant);

  return guide({
    title: "게임 규칙",
    summary: "선택한 게임의 핵심 규칙을 확인합니다.",
    sections: [
      section("공식 룰 핵심", [
        "현재 게임의 목표와 가능한 행동을 확인한 뒤, 화면에서 활성화된 버튼을 따라 진행합니다.",
      ]),
    ],
  });
};

export default getBoardGameRuleGuide;
