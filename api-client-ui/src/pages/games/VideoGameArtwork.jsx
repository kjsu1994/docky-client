export const videoGameArtProfiles = {
  arena: {
    eyebrow: "네온 아레나",
    tagline: "원형 경기장에서 이동, 대시, 발사를 즉시 주고받는 실시간 슈터입니다.",
    roomNote: "시야와 탄막이 빠르게 바뀌므로 시작 전 참가자 준비 상태를 먼저 맞추세요.",
    hud: ["조준", "대시", "동기"],
  },
  fortress: {
    eyebrow: "포격전",
    tagline: "포각과 파워를 읽고 지형 너머 상대를 맞히는 턴제 포격 게임입니다.",
    roomNote: "방장은 포격 순서를 시작하고, 참가자는 각도와 파워 입력을 차분히 맞춥니다.",
    hud: ["각도", "화력", "바람"],
  },
  defense: {
    eyebrow: "웨이브 방어",
    tagline: "웨이브 경로를 읽고 타워와 스킬로 기지를 지키는 협동 디펜스입니다.",
    roomNote: "타워 설치, 업그레이드, 스킬 사용 타이밍을 역할별로 나누면 안정적입니다.",
    hud: ["공세", "타워", "스킬"],
  },
  kart: {
    eyebrow: "카트 대시",
    tagline: "코너, 부스터, 아이템 타이밍으로 순위를 뒤집는 파티 레이스입니다.",
    roomNote: "트랙이 좁은 구간에서는 드리프트와 아이템 사용을 짧게 눌러 조작하세요.",
    hud: ["랩", "아이템", "드리프트"],
  },
  bomb: {
    eyebrow: "폭탄 격자",
    tagline: "폭탄을 깔고 폭발 범위를 피해 살아남는 격자형 파티 배틀입니다.",
    roomNote: "폭탄 설치 뒤 이동 경로가 막히지 않도록 빈 칸을 먼저 확보하세요.",
    hud: ["폭탄", "회피", "연쇄"],
  },
  snake: {
    eyebrow: "스네이크 러시",
    tagline: "몸을 키우면서 충돌을 피하고 상대의 길을 압박하는 성장 경쟁입니다.",
    roomNote: "방향 전환은 짧고 명확하게, 질주는 빈 공간이 충분할 때 쓰는 편이 좋습니다.",
    hud: ["성장", "회전", "점수"],
  },
  coin: {
    eyebrow: "코인 런",
    tagline: "제한 시간 동안 코인 라인을 읽고 빠르게 수집하는 점수 경쟁입니다.",
    roomNote: "큰 코인 묶음보다 다음 동선까지 이어지는 수집 루트를 먼저 보세요.",
    hud: ["시간", "콤보", "부스트"],
  },
  rpg: {
    eyebrow: "솔로 퀘스트",
    tagline: "혼자 탐험하고 전투하며 진행을 저장하는 Good_ETC 솔로 RPG입니다.",
    roomNote: "진행 저장은 브라우저 localStorage를 우선 사용하므로 같은 기기에서 이어가세요.",
    hud: ["퀘스트", "전투", "저장"],
  },
};

const artShellClass = (compact, className) => [
  "relative overflow-hidden rounded-2xl border border-white/25 text-white shadow-inner",
  compact ? "h-28 w-44" : "h-36 w-60 max-w-full",
  className,
].filter(Boolean).join(" ");

const Hud = ({ items }) => (
  <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2 text-[8px] font-black text-white/80">
    {items.map((item) => (
      <span key={item} className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5">
        {item}
      </span>
    ))}
  </div>
);

const DirectionGlyph = ({ direction }) => {
  const rotations = {
    up: 0,
    right: 90,
    down: 180,
    left: -90,
  };
  const rotation = rotations[direction] ?? 0;
  return (
    <g transform={`rotate(${rotation} 24 24)`}>
      <path d="M24 6 10 22h8v18h12V22h8Z" fill="currentColor" />
      <path d="M24 6 10 22h8v18h12V22h8Z" fill="none" stroke="rgba(255,255,255,.72)" strokeWidth="2" strokeLinejoin="round" />
    </g>
  );
};

const VideoControlGlyphContent = ({ control }) => {
  const key = String(control || "").toLowerCase();
  if (key === "up" || key.includes("angle_up")) return <DirectionGlyph direction="up" />;
  if (key === "right" || key.endsWith("_right")) return <DirectionGlyph direction="right" />;
  if (key === "down" || key.includes("angle_down")) return <DirectionGlyph direction="down" />;
  if (key === "left" || key.endsWith("_left")) return <DirectionGlyph direction="left" />;

  if (key.includes("power")) {
    const high = key.includes("up");
    return (
      <>
        <path d="M10 35c2-12 10-22 24-25" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <path d="M13 35h20" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <circle cx="34" cy="12" r="6" fill="currentColor" opacity=".9" />
        <path d={high ? "M34 8v8M30 12h8" : "M30 12h8"} stroke="rgba(255,255,255,.9)" strokeWidth="2.5" strokeLinecap="round" />
      </>
    );
  }

  if (key.includes("fire") || key === "attack") {
    return (
      <>
        <circle cx="26" cy="22" r="12" fill="none" stroke="currentColor" strokeWidth="4" />
        <circle cx="26" cy="22" r="4" fill="currentColor" />
        <path d="M8 38 19 27M34 14l8-8M26 6v8M42 22h-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </>
    );
  }

  if (key.includes("wave")) {
    return (
      <>
        <path d="M8 16c8-10 16 10 24 0s12-2 16 4" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <path d="M8 29c8-10 16 10 24 0s12-2 16 4" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity=".72" />
        <path d="M8 41h32" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity=".45" />
      </>
    );
  }

  if (key.includes("upgrade")) {
    return (
      <>
        <path d="M12 38h24" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <path d="M24 7 12 21h7v17h10V21h7Z" fill="currentColor" />
        <path d="m34 10 3 5 6 1-4 4 1 6-6-3-5 3 1-6-4-4 6-1Z" fill="currentColor" opacity=".68" />
      </>
    );
  }

  if (key.includes("sell")) {
    return (
      <>
        <circle cx="24" cy="24" r="15" fill="none" stroke="currentColor" strokeWidth="5" />
        <path d="M18 20h11M16 25h13M23 33V16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M36 36 43 43" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      </>
    );
  }

  if (key.includes("skill") || key === "interact") {
    return (
      <>
        <path d="m24 6 5.5 11 12 1.8-8.7 8.5 2 12-10.8-5.7-10.8 5.7 2-12-8.7-8.5 12-1.8Z" fill="currentColor" />
        <circle cx="24" cy="24" r="5" fill="rgba(255,255,255,.85)" />
      </>
    );
  }

  return (
    <>
      <path d="M9 31c5-14 15-20 30-20" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M31 8h10v10" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 36h11M28 36h10" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity=".72" />
      <circle cx="24" cy="28" r="5" fill="currentColor" />
    </>
  );
};

export const VideoControlGlyph = ({ control = "", active = false, className = "h-5 w-5" }) => (
  <svg
    viewBox="0 0 48 48"
    className={className}
    aria-hidden="true"
    focusable="false"
    data-smoke="video-game-control-glyph"
  >
    <rect x="4" y="4" width="40" height="40" rx="13" fill={active ? "rgba(255,255,255,.28)" : "rgba(255,255,255,.12)"} />
    <VideoControlGlyphContent control={control} />
  </svg>
);

export const VideoGameArtwork = ({ type, compact = false, className = "" }) => {
  const profile = videoGameArtProfiles[type];
  if (!profile) return null;
  const artworkLabel = `${profile.eyebrow} 게임 아트워크`;

  if (type === "arena") {
    return (
      <div className={`${artShellClass(compact, className)} bg-slate-950`} data-smoke="video-game-artwork" role="img" aria-label={artworkLabel}>
        <Hud items={profile.hud} />
        <svg viewBox="0 0 240 144" className="h-full w-full" aria-hidden="true" focusable="false">
          <rect width="240" height="144" fill="#020617" />
          <circle cx="120" cy="72" r="92" fill="#67e8f9" opacity=".16" />
          <path d="M18 112C62 80 98 92 122 64s70-16 100-44" fill="none" stroke="#22d3ee" strokeWidth="2" strokeDasharray="4 7" opacity=".45" />
          <path d="M24 116h192M36 94h168M52 72h136M70 50h100" stroke="#164e63" strokeWidth="2" opacity=".72" />
          <path d="M34 118 96 34M70 120 122 28M110 122 154 32M150 122 184 42M190 120 210 72" stroke="#115e59" strokeWidth="1.5" opacity=".55" />
          <g transform="translate(78 88) rotate(-18)">
            <path d="M0-16 36 0 0 16 7 0Z" fill="#22d3ee" stroke="#ecfeff" strokeWidth="2" />
            <circle cx="8" cy="0" r="5" fill="#020617" />
          </g>
          <g transform="translate(166 52) rotate(154)">
            <path d="M0-14 32 0 0 14 7 0Z" fill="#34d399" stroke="#ecfdf5" strokeWidth="2" />
            <circle cx="8" cy="0" r="4" fill="#020617" />
          </g>
          <path d="M104 82 142 62" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" />
          <circle cx="147" cy="59" r="7" fill="#f97316" stroke="#ffedd5" strokeWidth="2" />
        </svg>
      </div>
    );
  }

  if (type === "fortress") {
    return (
      <div className={`${artShellClass(compact, className)} bg-gradient-to-br from-sky-600 via-sky-300 to-amber-200`} data-smoke="video-game-artwork" role="img" aria-label={artworkLabel}>
        <Hud items={profile.hud} />
        <svg viewBox="0 0 240 144" className="h-full w-full" aria-hidden="true" focusable="false">
          <path d="M0 104C34 76 60 78 82 106s54 30 82-2 54-22 76-2v42H0Z" fill="#365314" opacity=".9" />
          <path d="M0 120C38 92 68 94 92 122s56 22 82-4 52-16 66 0v26H0Z" fill="#1f2937" opacity=".72" />
          <path d="M64 92C90 38 128 22 176 70" fill="none" stroke="#fef3c7" strokeWidth="3" strokeDasharray="7 7" />
          <g transform="translate(48 95)">
            <rect x="-24" y="-10" width="48" height="18" rx="8" fill="#78350f" stroke="#fffbeb" strokeWidth="2" />
            <path d="M4-10 34-24" stroke="#78350f" strokeWidth="8" strokeLinecap="round" />
            <circle cx="-13" cy="9" r="7" fill="#0f172a" />
            <circle cx="13" cy="9" r="7" fill="#0f172a" />
          </g>
          <g transform="translate(188 96) scale(-1 1)">
            <rect x="-24" y="-10" width="48" height="18" rx="8" fill="#0f766e" stroke="#ecfeff" strokeWidth="2" />
            <path d="M4-10 32-24" stroke="#0f766e" strokeWidth="8" strokeLinecap="round" />
            <circle cx="-13" cy="9" r="7" fill="#0f172a" />
            <circle cx="13" cy="9" r="7" fill="#0f172a" />
          </g>
          <circle cx="176" cy="70" r="8" fill="#ef4444" stroke="#fff7ed" strokeWidth="3" />
        </svg>
      </div>
    );
  }

  if (type === "defense") {
    const towers = [
      { x: 58, y: 92, color: "#84cc16" },
      { x: 118, y: 62, color: "#22c55e" },
      { x: 174, y: 96, color: "#06b6d4" },
    ];
    return (
      <div className={`${artShellClass(compact, className)} bg-slate-950`} data-smoke="video-game-artwork" role="img" aria-label={artworkLabel}>
        <Hud items={profile.hud} />
        <svg viewBox="0 0 240 144" className="h-full w-full" aria-hidden="true" focusable="false">
          <rect width="240" height="144" fill="#052e16" />
          <path d="M0 36C48 22 66 80 112 70s58-54 128-28" fill="none" stroke="#bbf7d0" strokeWidth="16" strokeLinecap="round" opacity=".28" />
          <path d="M0 36C48 22 66 80 112 70s58-54 128-28" fill="none" stroke="#16a34a" strokeWidth="4" strokeDasharray="7 8" opacity=".9" />
          {towers.map((tower) => (
            <g key={`${tower.x}-${tower.y}`} transform={`translate(${tower.x} ${tower.y})`}>
              <path d="M-16 18h32L12-12H-12Z" fill={tower.color} stroke="#f0fdf4" strokeWidth="2" />
              <circle cy="-16" r="11" fill="#022c22" stroke={tower.color} strokeWidth="4" />
              <path d="M0-16 22-28" stroke={tower.color} strokeWidth="5" strokeLinecap="round" />
            </g>
          ))}
          {[36, 90, 146, 204].map((x, index) => (
            <g key={x} transform={`translate(${x} ${36 + (index % 2) * 28})`}>
              <circle r="9" fill="#f97316" />
              <path d="M-4-4h8v8h-8Z" fill="#7c2d12" />
            </g>
          ))}
        </svg>
      </div>
    );
  }

  if (type === "kart") {
    return (
      <div className={`${artShellClass(compact, className)} bg-gradient-to-br from-indigo-950 via-rose-700 to-orange-400`} data-smoke="video-game-artwork" role="img" aria-label={artworkLabel}>
        <Hud items={profile.hud} />
        <svg viewBox="0 0 240 144" className="h-full w-full" aria-hidden="true" focusable="false">
          <path d="M-8 112C42 46 92 148 144 76s88-18 106 8" fill="none" stroke="#111827" strokeWidth="42" strokeLinecap="round" />
          <path d="M-8 112C42 46 92 148 144 76s88-18 106 8" fill="none" stroke="#f8fafc" strokeWidth="4" strokeDasharray="10 10" strokeLinecap="round" />
          <g transform="translate(92 94) rotate(18)">
            <rect x="-24" y="-14" width="48" height="28" rx="10" fill="#f97316" stroke="#fff7ed" strokeWidth="3" />
            <rect x="-6" y="-22" width="20" height="16" rx="6" fill="#38bdf8" />
            <circle cx="-16" cy="16" r="7" fill="#0f172a" />
            <circle cx="16" cy="16" r="7" fill="#0f172a" />
          </g>
          <g transform="translate(172 64) rotate(-14)">
            <rect x="-20" y="-12" width="40" height="24" rx="9" fill="#22c55e" stroke="#ecfdf5" strokeWidth="3" />
            <circle cx="-13" cy="14" r="6" fill="#0f172a" />
            <circle cx="13" cy="14" r="6" fill="#0f172a" />
          </g>
          <path d="m42 40 9 16 18 2-13 12 4 18-18-9-16 9 3-18-13-12 18-2Z" fill="#fde047" stroke="#fefce8" strokeWidth="2" />
        </svg>
      </div>
    );
  }

  if (type === "bomb") {
    return (
      <div className={`${artShellClass(compact, className)} bg-zinc-950`} data-smoke="video-game-artwork" role="img" aria-label={artworkLabel}>
        <Hud items={profile.hud} />
        <svg viewBox="0 0 240 144" className="h-full w-full" aria-hidden="true" focusable="false">
          {Array.from({ length: 8 }, (_, x) => Array.from({ length: 5 }, (_, y) => (
            <rect key={`${x}-${y}`} x={18 + x * 27} y={32 + y * 20} width="18" height="14" rx="4" fill={x % 2 === y % 2 ? "#27272a" : "#3f3f46"} stroke="#52525b" />
          )))}
          <g transform="translate(122 76)">
            <path d="M0-38 8-10 36-20 16 2 38 18 8 14 0 40-8 14-38 18-16 2-36-20-8-10Z" fill="#f97316" opacity=".92" />
            <circle r="18" fill="#facc15" />
          </g>
          <g transform="translate(62 58)">
            <circle r="14" fill="#111827" stroke="#f8fafc" strokeWidth="3" />
            <path d="M4-12C8-24 20-24 22-12" fill="none" stroke="#fb7185" strokeWidth="4" strokeLinecap="round" />
          </g>
          <g transform="translate(184 100)">
            <rect x="-14" y="-14" width="28" height="28" rx="8" fill="#38bdf8" stroke="#ecfeff" strokeWidth="3" />
            <circle cx="0" cy="0" r="5" fill="#0f172a" />
          </g>
        </svg>
      </div>
    );
  }

  if (type === "snake") {
    const points = [[36, 98], [60, 98], [84, 84], [108, 84], [132, 66], [156, 66], [180, 52], [204, 52]];
    return (
      <div className={`${artShellClass(compact, className)} bg-gradient-to-br from-emerald-950 via-lime-800 to-slate-950`} data-smoke="video-game-artwork" role="img" aria-label={artworkLabel}>
        <Hud items={profile.hud} />
        <svg viewBox="0 0 240 144" className="h-full w-full" aria-hidden="true" focusable="false">
          <path d="M20 124H220M28 42h184M36 70h172M48 98h148" stroke="#bbf7d0" strokeWidth="1.5" opacity=".22" />
          {points.map(([x, y], index) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={index === points.length - 1 ? 15 : 13} fill={index === points.length - 1 ? "#bef264" : "#22c55e"} stroke="#ecfccb" strokeWidth="3" />
          ))}
          <circle cx="210" cy="48" r="3" fill="#052e16" />
          <circle cx="202" cy="45" r="3" fill="#052e16" />
          <circle cx="54" cy="46" r="12" fill="#f43f5e" stroke="#ffe4e6" strokeWidth="3" />
          <path d="M50 34c8-10 16-4 16 3" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (type === "coin") {
    return (
      <div className={`${artShellClass(compact, className)} bg-gradient-to-br from-sky-700 via-orange-500 to-yellow-300`} data-smoke="video-game-artwork" role="img" aria-label={artworkLabel}>
        <Hud items={profile.hud} />
        <svg viewBox="0 0 240 144" className="h-full w-full" aria-hidden="true" focusable="false">
          <path d="M12 116h216" stroke="#7c2d12" strokeWidth="16" strokeLinecap="round" />
          <path d="M42 96h68M138 78h74M28 56h54" stroke="#78350f" strokeWidth="10" strokeLinecap="round" />
          {[54, 86, 150, 182, 206].map((x, index) => (
            <g key={x} transform={`translate(${x} ${index < 2 ? 72 : 54})`}>
              <circle r="13" fill="#fde047" stroke="#fff7ed" strokeWidth="3" />
              <path d="M-3-6h8M-5 0h9M-1 7V-8" stroke="#b45309" strokeWidth="2" strokeLinecap="round" />
            </g>
          ))}
          <g transform="translate(116 100)">
            <rect x="-17" y="-22" width="34" height="36" rx="12" fill="#0f172a" stroke="#e0f2fe" strokeWidth="3" />
            <circle cy="-3" r="6" fill="#38bdf8" />
            <path d="M-14 18h28" stroke="#e0f2fe" strokeWidth="4" strokeLinecap="round" />
          </g>
        </svg>
      </div>
    );
  }

  return (
    <div className={`${artShellClass(compact, className)} bg-gradient-to-br from-violet-950 via-slate-950 to-emerald-900`} data-smoke="video-game-artwork" role="img" aria-label={artworkLabel}>
      <Hud items={profile.hud} />
      <svg viewBox="0 0 240 144" className="h-full w-full" aria-hidden="true" focusable="false">
        <path d="M22 116 56 72l34 18 42-48 34 34 30-20 22 60Z" fill="#064e3b" stroke="#a7f3d0" strokeWidth="3" />
        <path d="m166 34 10 18 20 3-15 14 4 20-19-9-18 9 3-20-15-14 20-3Z" fill="#c084fc" stroke="#faf5ff" strokeWidth="2" />
        <g transform="translate(92 90)">
          <circle cy="-26" r="12" fill="#fef3c7" />
          <path d="M-12-12h24l7 38h-38Z" fill="#2563eb" stroke="#dbeafe" strokeWidth="3" />
          <path d="M16-4 34-20" stroke="#facc15" strokeWidth="5" strokeLinecap="round" />
          <path d="M34-20 44-28" stroke="#e5e7eb" strokeWidth="3" strokeLinecap="round" />
        </g>
        <g transform="translate(176 96)">
          <rect x="-18" y="-22" width="36" height="44" rx="12" fill="#111827" stroke="#fb7185" strokeWidth="3" />
          <circle cy="-4" r="6" fill="#fb7185" />
        </g>
        <path d="M36 120h178" stroke="#f8fafc" strokeWidth="3" strokeDasharray="5 7" opacity=".35" />
      </svg>
    </div>
  );
};

export default VideoGameArtwork;
