const glyphPaths = {
  state: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 9h7M7 13h10M7 17h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="18" cy="7" r="2" fill="currentColor" />
    </>
  ),
  turn: (
    <>
      <path d="M6 8a7 7 0 0 1 11-2l1.8 1.8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 4v4.8h-4.8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 16a7 7 0 0 1-11 2l-1.8-1.8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 20v-4.8h4.8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  player: (
    <>
      <circle cx="12" cy="7" r="3" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path d="M6.5 20c.6-3.7 2.8-6 5.5-6s4.9 2.3 5.5 6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M8 20h8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </>
  ),
  recent: (
    <>
      <path d="M5 6h9a5 5 0 0 1 0 10H8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M8 12 5 16l3 4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="17" cy="11" r="2" fill="currentColor" />
    </>
  ),
  decision: (
    <>
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path d="M12 2.8v3.4M12 17.8v3.4M2.8 12h3.4M17.8 12h3.4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </>
  ),
  build: (
    <>
      <path d="M4.5 18.5h15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M6.5 18.5V9.2l5.5-3.5 5.5 3.5v9.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9.2 18.5v-5.2h5.6v5.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8.2 10.2h7.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </>
  ),
  coin: (
    <>
      <ellipse cx="12" cy="6.8" rx="6.2" ry="3.1" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.8 6.8v4.2c0 1.7 2.8 3.1 6.2 3.1s6.2-1.4 6.2-3.1V6.8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.8 11v4.2c0 1.7 2.8 3.1 6.2 3.1s6.2-1.4 6.2-3.1V11" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9.5 6.8h5M10 14h4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  stage: (
    <>
      <rect x="3.5" y="5" width="17" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path d="M8 21h8M10 17v4M14 17v4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M7 9h6l-2 4h6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  input: (
    <>
      <rect x="3.5" y="7" width="17" height="11" rx="4" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path d="M8 10v5M5.5 12.5h5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="15.5" cy="11.5" r="1.3" fill="currentColor" />
      <circle cx="18" cy="14.5" r="1.3" fill="currentColor" />
    </>
  ),
  score: (
    <>
      <path d="M5 18h14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <rect x="6" y="11" width="3.6" height="7" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="10.2" y="7" width="3.6" height="11" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="14.4" y="4" width="3.6" height="14" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 8.2 10.2 5l3.1 2.4L18 3.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  win: (
    <>
      <path d="M7 5h10v3.5a5 5 0 0 1-10 0z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M7 7H4.5a2 2 0 0 0 2 3.4M17 7h2.5a2 2 0 0 1-2 3.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 13.5V17M9 21h6M10 17h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m12 7.2.6 1.2 1.3.2-1 .9.3 1.3-1.2-.7-1.2.7.3-1.3-1-.9 1.3-.2z" fill="currentColor" />
    </>
  ),
  signal: (
    <>
      <circle cx="12" cy="12" r="2.4" fill="currentColor" />
      <path d="M8.6 15.4a4.8 4.8 0 0 1 0-6.8M15.4 8.6a4.8 4.8 0 0 1 0 6.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5.8 18.2a8.8 8.8 0 0 1 0-12.4M18.2 5.8a8.8 8.8 0 0 1 0 12.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
};

export const GameUxGlyph = ({ type = "state", className = "h-4 w-4" }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
    {glyphPaths[type] || glyphPaths.state}
  </svg>
);

const chatEmptyTones = {
  amber: {
    shell: "border-amber-100 bg-amber-50/80 text-amber-950",
    artShell: "bg-white/80 text-amber-700",
    badge: "bg-amber-500 text-slate-950",
    detail: "text-amber-900/75",
    chip: "border-amber-100 bg-white text-amber-800",
    line: "#f59e0b",
    accent: "#0284c7",
    surface: "#fffbeb",
  },
  rose: {
    shell: "border-rose-100 bg-rose-50/80 text-rose-950",
    artShell: "bg-white/80 text-rose-700",
    badge: "bg-rose-600 text-white",
    detail: "text-rose-900/75",
    chip: "border-rose-100 bg-white text-rose-800",
    line: "#e11d48",
    accent: "#0d9488",
    surface: "#fff1f2",
  },
  slate: {
    shell: "border-slate-200 bg-white text-slate-950",
    artShell: "bg-slate-50 text-slate-700",
    badge: "bg-slate-900 text-white",
    detail: "text-slate-600",
    chip: "border-slate-100 bg-slate-50 text-slate-700",
    line: "#475569",
    accent: "#2563eb",
    surface: "#f8fafc",
  },
};

const chatEmptyArtLabels = {
  "las-vegas": ["인사", "배팅", "준비"],
  "no-thanks": ["인사", "칩", "선택"],
  board: ["인사", "전략", "준비"],
};

const GameChatEmptyArt = ({
  game = "board",
  tone = "slate",
}) => {
  const colors = chatEmptyTones[tone] || chatEmptyTones.slate;
  const labels = chatEmptyArtLabels[game] || chatEmptyArtLabels.board;

  return (
    <svg
      viewBox="0 0 260 132"
      className="h-full min-h-[126px] w-full"
      role="img"
      aria-label="채팅 시작 안내 아트"
      data-smoke="game-chat-empty-art"
      data-chat-game={game}
      focusable="false"
    >
      <rect x="10" y="12" width="240" height="108" rx="22" fill={colors.surface} />
      <path d="M44 87c26-30 51-34 75-12 20 18 44 17 70-4" fill="none" stroke="#cbd5e1" strokeWidth="10" strokeLinecap="round" />
      <path d="M44 87c26-30 51-34 75-12 20 18 44 17 70-4" fill="none" stroke={colors.line} strokeWidth="3" strokeLinecap="round" />
      <g data-smoke="game-chat-empty-node">
        <rect x="32" y="34" width="68" height="34" rx="14" fill="#ffffff" stroke={colors.line} strokeWidth="3" />
        <path d="M51 68 44 81l18-12" fill="#ffffff" stroke={colors.line} strokeWidth="3" strokeLinejoin="round" />
        <circle cx="53" cy="51" r="3" fill={colors.line} />
        <circle cx="66" cy="51" r="3" fill={colors.line} />
        <circle cx="79" cy="51" r="3" fill={colors.line} />
      </g>
      <g data-smoke="game-chat-empty-node">
        <rect x="135" y="28" width="82" height="42" rx="16" fill="#ffffff" stroke="#0f172a" strokeWidth="3" />
        <path d="M190 70 204 84l-3-18" fill="#ffffff" stroke="#0f172a" strokeWidth="3" strokeLinejoin="round" />
        <text x="176" y="53" textAnchor="middle" fontSize="12" fontWeight="900" fill="#0f172a">{labels[0]}</text>
      </g>
      {labels.slice(1).map((label, index) => {
        const x = index === 0 ? 72 : 155;
        const y = index === 0 ? 101 : 96;
        return (
          <g key={`${game}-${label}`} data-smoke="game-chat-empty-node">
            <circle cx={x} cy={y} r="17" fill={index === 0 ? colors.accent : colors.line} />
            <circle cx={x} cy={y} r="22" fill="none" stroke="#ffffff" strokeWidth="5" />
            <text x={x} y={y + 4} textAnchor="middle" fontSize="10" fontWeight="900" fill="#ffffff">{label}</text>
          </g>
        );
      })}
      <g data-smoke="game-chat-empty-node">
        <path d="M218 95c9-8 18-8 26 0" fill="none" stroke={colors.accent} strokeWidth="4" strokeLinecap="round" />
        <circle cx="222" cy="86" r="4" fill={colors.accent} />
        <circle cx="240" cy="86" r="4" fill={colors.accent} />
      </g>
    </svg>
  );
};

export const GameChatEmptyState = ({
  game = "board",
  title = "아직 채팅 내역이 없습니다",
  detail = "첫 메시지를 남기면 같은 방의 판단과 준비 흐름이 채팅에 쌓입니다.",
  prompts = ["첫 인사", "전략 공유", "준비 확인"],
  tone = "slate",
  className = "",
}) => {
  const colors = chatEmptyTones[tone] || chatEmptyTones.slate;
  const visiblePrompts = Array.isArray(prompts) ? prompts.filter(Boolean).slice(0, 3) : [];

  return (
    <div
      className={`flex min-h-[220px] flex-col justify-between gap-3 rounded-2xl border p-3 shadow-sm ${colors.shell} ${className}`}
      data-smoke="game-chat-empty-state"
      data-chat-game={game}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className={`overflow-hidden rounded-xl ${colors.artShell}`}>
        <GameChatEmptyArt game={game} tone={tone} />
      </div>
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black bg-white/80">
          <GameUxGlyph type="signal" className="h-3.5 w-3.5" />
          방 채팅 준비
        </div>
        <div className="text-sm font-black leading-tight">{title}</div>
        {detail && <div className={`text-xs font-bold leading-relaxed ${colors.detail}`}>{detail}</div>}
      </div>
      {!!visiblePrompts.length && (
        <div className="grid gap-1.5 sm:grid-cols-3">
          {visiblePrompts.map((prompt, index) => (
            <div
              key={`${prompt}-${index}`}
              className={`flex min-h-10 items-center gap-1.5 rounded-xl border px-2 py-1.5 text-[11px] font-black ${colors.chip}`}
              data-smoke="game-chat-empty-item"
            >
              <GameUxGlyph type={index === 0 ? "player" : index === 1 ? "decision" : "state"} className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{prompt}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const playingCardSuitProfiles = {
  SPADES: {
    label: "스페이드",
    colorClass: "text-slate-950",
    glyph: (
      <>
        <path d="M16 3.5C10.4 9.3 6.5 13 6.5 17.2c0 3.5 2.5 6.1 5.8 6.1 1.7 0 2.9-.6 3.7-1.5.8.9 2 1.5 3.7 1.5 3.3 0 5.8-2.6 5.8-6.1 0-4.2-3.9-7.9-9.5-13.7Z" fill="currentColor" />
        <path d="M14.1 21.7c-.3 2.6-1.4 4.7-3.7 6.2h11.2c-2.3-1.5-3.4-3.6-3.7-6.2Z" fill="currentColor" />
      </>
    ),
  },
  HEARTS: {
    label: "하트",
    colorClass: "text-rose-600",
    glyph: (
      <path d="M16 27.5C9.2 22.2 5.1 18.2 5.1 12.8c0-3.5 2.6-6.2 6-6.2 2.3 0 4.1 1.2 4.9 2.9.8-1.7 2.6-2.9 4.9-2.9 3.4 0 6 2.7 6 6.2 0 5.4-4.1 9.4-10.9 14.7Z" fill="currentColor" />
    ),
  },
  DIAMONDS: {
    label: "다이아몬드",
    colorClass: "text-rose-600",
    glyph: (
      <path d="M16 3.3 27.3 16 16 28.7 4.7 16Z" fill="currentColor" />
    ),
  },
  CLUBS: {
    label: "클럽",
    colorClass: "text-slate-950",
    glyph: (
      <>
        <circle cx="16" cy="9.8" r="6.1" fill="currentColor" />
        <circle cx="10.1" cy="18.1" r="6.1" fill="currentColor" />
        <circle cx="21.9" cy="18.1" r="6.1" fill="currentColor" />
        <path d="M14.2 20.6c-.2 3-1.4 5.4-3.8 7h11.2c-2.4-1.6-3.6-4-3.8-7Z" fill="currentColor" />
      </>
    ),
  },
};

const normalizePlayingCardSuit = (suit) => {
  const value = String(suit || "").trim().toUpperCase();
  if (["SPADE", "SPADES", "S"].includes(value)) return "SPADES";
  if (["HEART", "HEARTS", "H"].includes(value)) return "HEARTS";
  if (["DIAMOND", "DIAMONDS", "D"].includes(value)) return "DIAMONDS";
  if (["CLUB", "CLUBS", "C"].includes(value)) return "CLUBS";
  return value;
};

export const playingCardSuitLabel = (suit) => {
  const normalized = normalizePlayingCardSuit(suit);
  return playingCardSuitProfiles[normalized]?.label || String(suit || "");
};

export const PlayingCardSuitIcon = ({ suit, className = "h-5 w-5" }) => {
  const normalized = normalizePlayingCardSuit(suit);
  const profile = playingCardSuitProfiles[normalized] || playingCardSuitProfiles.SPADES;
  return (
    <svg viewBox="0 0 32 32" className={`${profile.colorClass} ${className}`} aria-hidden="true" focusable="false">
      {profile.glyph}
    </svg>
  );
};

const playingCardSizeClasses = {
  sm: {
    shell: "h-16 w-11 rounded-lg p-1.5",
    corner: "text-[11px]",
    cornerIcon: "h-2.5 w-2.5",
    centerIcon: "h-5 w-5",
  },
  md: {
    shell: "h-24 w-16 rounded-xl p-2",
    corner: "text-sm",
    cornerIcon: "h-3.5 w-3.5",
    centerIcon: "h-8 w-8",
  },
  lg: {
    shell: "h-28 w-20 rounded-2xl p-2.5",
    corner: "text-base",
    cornerIcon: "h-4 w-4",
    centerIcon: "h-10 w-10",
  },
};

export const PlayingCardArt = ({
  rank = "",
  suit = "",
  hidden = false,
  compact = false,
  size,
  selected = false,
  suggested = false,
  className = "",
  smoke = "playing-card-art",
}) => {
  const normalizedSuit = normalizePlayingCardSuit(suit);
  const profile = playingCardSuitProfiles[normalizedSuit] || playingCardSuitProfiles.SPADES;
  const sizeProfile = playingCardSizeClasses[size || (compact ? "sm" : "md")] || playingCardSizeClasses.md;
  const ringClass = selected ? "ring-4 ring-sky-300" : suggested ? "ring-2 ring-amber-300" : "";
  const cardLabel = hidden ? "뒷면 카드" : `${rank || "-"} ${profile.label}`;

  if (hidden) {
    return (
      <div
        className={`relative flex shrink-0 items-center justify-center overflow-hidden border border-emerald-200/30 bg-gradient-to-br from-zinc-950 via-emerald-950 to-zinc-800 shadow-lg ${sizeProfile.shell} ${ringClass} ${className}`}
        data-smoke={smoke}
        role="img"
        aria-label={cardLabel}
      >
        <svg viewBox="0 0 80 112" className="h-full w-full text-emerald-100/80" aria-hidden="true" focusable="false">
          <rect x="6" y="6" width="68" height="100" rx="10" fill="none" stroke="currentColor" strokeWidth="3" opacity=".65" />
          <path d="M18 26h44M18 86h44" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".45" />
          <path d="M40 21c10 12 18 21 18 31S50 70 40 82C30 70 22 62 22 52s8-19 18-31Z" fill="currentColor" opacity=".16" />
          <path d="M40 32c7 8 11 13 11 20s-4 12-11 20c-7-8-11-13-11-20s4-12 11-20Z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" opacity=".9" />
          <circle cx="40" cy="52" r="4" fill="currentColor" opacity=".9" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={`relative flex shrink-0 flex-col justify-between overflow-hidden border border-slate-200 bg-white font-black shadow-lg ${profile.colorClass} ${sizeProfile.shell} ${ringClass} ${className}`}
      data-smoke={smoke}
      role="img"
      aria-label={cardLabel}
    >
      <div className="pointer-events-none absolute inset-1 rounded-[inherit] border border-slate-100" aria-hidden="true" />
      <div className={`relative flex items-start justify-between gap-1 leading-none ${sizeProfile.corner}`}>
        <span>{rank || "-"}</span>
        <PlayingCardSuitIcon suit={normalizedSuit} className={sizeProfile.cornerIcon} />
      </div>
      <div className="relative flex flex-1 items-center justify-center">
        <PlayingCardSuitIcon suit={normalizedSuit} className={sizeProfile.centerIcon} />
      </div>
      <div className={`relative flex rotate-180 items-start justify-between gap-1 leading-none ${sizeProfile.corner}`}>
        <span>{rank || "-"}</span>
        <PlayingCardSuitIcon suit={normalizedSuit} className={sizeProfile.cornerIcon} />
      </div>
    </div>
  );
};

const actionCueTones = {
  active: {
    shell: "border-emerald-200 bg-emerald-50 text-emerald-950",
    icon: "bg-emerald-600 text-white",
    chip: "border-emerald-100 bg-white text-emerald-800",
    text: "text-emerald-800",
  },
  waiting: {
    shell: "border-amber-200 bg-amber-50 text-amber-950",
    icon: "bg-amber-500 text-slate-950",
    chip: "border-amber-100 bg-white text-amber-800",
    text: "text-amber-800",
  },
  done: {
    shell: "border-slate-200 bg-slate-50 text-slate-950",
    icon: "bg-slate-900 text-white",
    chip: "border-slate-100 bg-white text-slate-700",
    text: "text-slate-700",
  },
  neutral: {
    shell: "border-sky-100 bg-sky-50 text-slate-950",
    icon: "bg-sky-600 text-white",
    chip: "border-sky-100 bg-white text-sky-800",
    text: "text-sky-800",
  },
};

const actionCueChipTones = {
  active: "border-emerald-100 bg-emerald-50 text-emerald-800",
  waiting: "border-amber-100 bg-amber-50 text-amber-800",
  danger: "border-rose-100 bg-rose-50 text-rose-800",
  done: "border-slate-100 bg-slate-50 text-slate-700",
  neutral: "",
};

export const GameActionCueBar = ({
  title = "지금 할 일",
  detail = "",
  items = [],
  tone = "neutral",
  className = "",
  smoke = "game-action-cue-bar",
}) => {
  const visibleItems = Array.isArray(items) ? items.filter((item) => item && (item.value || item.label)).slice(0, 4) : [];
  if (!title && !detail && !visibleItems.length) return null;
  const colors = actionCueTones[tone] || actionCueTones.neutral;

  return (
    <div className={`rounded-2xl border px-3 py-2 shadow-sm ${colors.shell} ${className}`} data-smoke={smoke}>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${colors.icon}`}>
            <GameUxGlyph type={tone === "done" ? "win" : "decision"} className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-black leading-tight">{title}</div>
            {detail && <div className={`mt-0.5 line-clamp-2 text-xs font-bold leading-relaxed ${colors.text}`}>{detail}</div>}
          </div>
        </div>
        {!!visibleItems.length && (
          <div className="grid gap-1.5 sm:grid-cols-2 lg:min-w-[420px] lg:grid-cols-4">
            {visibleItems.map((item) => {
              const chipTone = actionCueChipTones[item.tone] || colors.chip;
              return (
                <div key={`${item.label}-${item.value}`} className={`min-h-12 rounded-xl border px-2.5 py-1.5 ${chipTone}`} data-smoke="game-action-cue-item">
                  <div className="flex items-center gap-1.5 text-[10px] font-black opacity-70">
                    <GameUxGlyph type={item.icon || "state"} className="h-3 w-3" />
                    {item.label}
                  </div>
                  <div className="mt-0.5 truncate text-xs font-black">{item.value}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const feedbackTickerTones = {
  idle: {
    shell: "border-slate-200 bg-white text-slate-950",
    icon: "bg-slate-900 text-white",
    rail: "text-slate-200",
    detail: "text-slate-600",
    chip: "border-slate-100 bg-slate-50 text-slate-700",
  },
  pending: {
    shell: "border-sky-200 bg-sky-50 text-sky-950",
    icon: "bg-sky-600 text-white",
    rail: "text-sky-200",
    detail: "text-sky-800",
    chip: "border-sky-100 bg-white text-sky-800",
  },
  done: {
    shell: "border-emerald-200 bg-emerald-50 text-emerald-950",
    icon: "bg-emerald-600 text-white",
    rail: "text-emerald-200",
    detail: "text-emerald-800",
    chip: "border-emerald-100 bg-white text-emerald-800",
  },
  error: {
    shell: "border-rose-200 bg-rose-50 text-rose-950",
    icon: "bg-rose-600 text-white",
    rail: "text-rose-200",
    detail: "text-rose-800",
    chip: "border-rose-100 bg-white text-rose-800",
  },
};

const feedbackItemToneClasses = {
  idle: "border-slate-100 bg-white text-slate-700",
  pending: "border-sky-100 bg-white text-sky-800",
  done: "border-emerald-100 bg-white text-emerald-800",
  error: "border-rose-100 bg-white text-rose-800",
  neutral: "border-slate-100 bg-white text-slate-700",
};

export const GameFeedbackTicker = ({
  title = "행동 피드백",
  detail = "",
  items = [],
  tone = "idle",
  className = "",
  smoke = "game-feedback-ticker",
}) => {
  const visibleItems = Array.isArray(items) ? items.filter((item) => item && (item.value || item.label)).slice(0, 4) : [];
  if (!title && !detail && !visibleItems.length) return null;
  const colors = feedbackTickerTones[tone] || feedbackTickerTones.idle;

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border px-3 py-3 shadow-sm ${colors.shell} ${className}`}
      data-smoke={smoke}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className={`pointer-events-none absolute inset-y-0 right-0 w-36 ${colors.rail}`} aria-hidden="true">
        <svg viewBox="0 0 144 104" className="h-full w-full" focusable="false">
          <path d="M18 68c24-42 48-42 72 0 12 21 24 21 36 0" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" opacity=".22" />
          <circle cx="38" cy="40" r="16" fill="currentColor" opacity=".14" />
          <circle cx="92" cy="42" r="24" fill="currentColor" opacity=".11" />
          <path d="M30 70h78" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity=".32" />
        </svg>
      </div>
      <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${colors.icon}`}>
            <GameUxGlyph type={tone === "done" ? "win" : tone === "error" ? "recent" : "signal"} className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-black leading-tight">{title}</div>
            {detail && <div className={`mt-0.5 line-clamp-2 text-xs font-bold leading-relaxed ${colors.detail}`}>{detail}</div>}
          </div>
        </div>
        {!!visibleItems.length && (
          <div className="grid gap-1.5 sm:grid-cols-2 lg:min-w-[460px] lg:grid-cols-4">
            {visibleItems.map((item, index) => {
              const chipTone = feedbackItemToneClasses[item.tone] || colors.chip;
              return (
                <div key={`${item.label}-${item.value}-${index}`} className={`min-h-14 rounded-xl border px-2.5 py-1.5 ${chipTone}`} data-smoke="game-feedback-item">
                  <div className="flex items-center gap-1.5 text-[10px] font-black opacity-70">
                    <GameUxGlyph type={item.icon || "state"} className="h-3 w-3" />
                    {item.label}
                  </div>
                  <div className="mt-0.5 truncate text-xs font-black">{item.value}</div>
                  {item.detail && <div className="mt-0.5 line-clamp-2 text-[10px] font-bold leading-relaxed opacity-70">{item.detail}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

const flowMeterTones = {
  slate: {
    shell: "border-slate-200 bg-white text-slate-950",
    rail: "text-slate-200",
    node: "bg-slate-900 text-white",
    text: "text-slate-600",
  },
  emerald: {
    shell: "border-emerald-200 bg-emerald-50 text-emerald-950",
    rail: "text-emerald-200",
    node: "bg-emerald-600 text-white",
    text: "text-emerald-800",
  },
  amber: {
    shell: "border-amber-200 bg-amber-50 text-amber-950",
    rail: "text-amber-200",
    node: "bg-amber-500 text-slate-950",
    text: "text-amber-800",
  },
  dark: {
    shell: "border-white/10 bg-white/10 text-white",
    rail: "text-white/20",
    node: "bg-white text-slate-950",
    text: "text-white/70",
  },
};

const flowMeterItemTones = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-800",
  waiting: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-rose-200 bg-rose-50 text-rose-800",
  done: "border-slate-200 bg-slate-50 text-slate-700",
  neutral: "border-slate-100 bg-white text-slate-700",
  dark: "border-white/10 bg-white/10 text-white",
};

export const GameFlowMeter = ({
  title = "판 흐름",
  detail = "",
  items = [],
  tone = "slate",
  className = "",
  smoke = "game-flow-meter",
}) => {
  const visibleItems = Array.isArray(items) ? items.filter((item) => item && (item.value || item.label)).slice(0, 5) : [];
  if (!title && !detail && !visibleItems.length) return null;
  const colors = flowMeterTones[tone] || flowMeterTones.slate;

  return (
    <section className={`relative overflow-hidden rounded-xl border px-2.5 py-2 shadow-sm sm:rounded-2xl sm:px-3 sm:py-2.5 ${colors.shell} ${className}`} data-smoke={smoke}>
      <div className="relative flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-black sm:text-sm">
            <GameUxGlyph type="signal" className="h-4 w-4" />
            {title}
          </div>
          {detail && <div className={`mt-0.5 hidden text-xs font-bold leading-relaxed sm:line-clamp-1 sm:block ${colors.text}`}>{detail}</div>}
        </div>
      </div>
      {!!visibleItems.length && (
        <div className="relative mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {visibleItems.map((item, index) => {
            const chipTone = flowMeterItemTones[item.tone] || (tone === "dark" ? flowMeterItemTones.dark : flowMeterItemTones.neutral);
            return (
              <div key={`${item.label}-${item.value}-${index}`} className={`min-h-[54px] rounded-xl border px-2.5 py-1.5 sm:min-h-[68px] sm:px-3 sm:py-2 ${chipTone}`} data-smoke="game-flow-meter-item">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-black opacity-75">
                    <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-lg ${colors.node}`}>
                      <GameUxGlyph type={item.icon || "state"} className="h-3 w-3" />
                    </span>
                    <span className="truncate">{item.label}</span>
                  </div>
                  <span className="text-[10px] font-black opacity-55">{index + 1}</span>
                </div>
                <div className="mt-0.5 truncate text-xs font-black leading-tight sm:mt-1 sm:text-sm">{item.value}</div>
                {item.detail && <div className="mt-0.5 hidden text-[10px] font-bold leading-relaxed opacity-70 sm:line-clamp-1 sm:block">{item.detail}</div>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

const startReadinessItemTones = {
  done: "border-emerald-200 bg-emerald-50 text-emerald-800",
  active: "border-sky-200 bg-sky-50 text-sky-800",
  waiting: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-rose-200 bg-rose-50 text-rose-800",
  neutral: "border-slate-100 bg-slate-50 text-slate-700",
};

const startReadinessArtTones = {
  done: { fill: "#10b981", stroke: "#047857", text: "#ecfdf5" },
  active: { fill: "#0ea5e9", stroke: "#0369a1", text: "#f0f9ff" },
  waiting: { fill: "#f59e0b", stroke: "#92400e", text: "#fffbeb" },
  danger: { fill: "#f43f5e", stroke: "#be123c", text: "#fff1f2" },
  neutral: { fill: "#64748b", stroke: "#334155", text: "#f8fafc" },
};

const GameStartReadinessArt = ({
  items = [],
  canStart = false,
  statusText = "",
  artSmoke = "game-start-readiness-art",
  nodeSmoke = "game-start-readiness-node",
}) => {
  const visibleItems = Array.isArray(items) ? items.filter(Boolean).slice(0, 4) : [];
  const nodes = visibleItems.map((item, index) => {
    const tone = startReadinessArtTones[item.tone] || startReadinessArtTones.neutral;
    return {
      ...item,
      tone,
      x: 50 + index * 92,
      y: index % 2 === 0 ? 116 : 72,
      progress: Number.isFinite(Number(item.progress)) ? Math.max(0, Math.min(100, Number(item.progress))) : null,
    };
  });

  return (
    <svg
      viewBox="0 0 360 180"
      role="img"
      aria-label="게임 시작 준비 흐름"
      className="h-full min-h-[180px] w-full"
      data-smoke={artSmoke}
    >
      <rect x="10" y="10" width="340" height="160" rx="22" fill="#0f172a" />
      <rect x="26" y="30" width="308" height="118" rx="18" fill={canStart ? "#ecfdf5" : "#f8fafc"} />
      <path d="M50 116 C86 54 120 58 142 72 S204 126 234 116 S292 58 326 72" fill="none" stroke={canStart ? "#bbf7d0" : "#e2e8f0"} strokeWidth="14" strokeLinecap="round" />
      <path d="M50 116 C86 54 120 58 142 72 S204 126 234 116 S292 58 326 72" fill="none" stroke={canStart ? "#059669" : "#475569"} strokeWidth="3" strokeLinecap="round" />
      <text x="34" y="24" fontSize="10" fontWeight="900" fill="#bfdbfe">시작 준비</text>
      <text x="326" y="24" textAnchor="end" fontSize="10" fontWeight="900" fill="#e2e8f0">{statusText || (canStart ? "시작 가능" : "대기")}</text>
      {nodes.map((node, index) => (
        <g key={node.key || `${node.label}-${index}`} data-smoke={nodeSmoke} data-readiness-key={node.key || ""}>
          <circle cx={node.x} cy={node.y} r="23" fill={node.tone.fill} stroke="#ffffff" strokeWidth="5" />
          <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="10" fontWeight="900" fill={node.tone.text}>{index + 1}</text>
          <text x={node.x} y={node.y + (index % 2 === 0 ? 38 : -31)} textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#0f172a">{node.label}</text>
          {node.progress !== null && (
            <>
              <rect x={node.x - 22} y={node.y + (index % 2 === 0 ? -35 : 29)} width="44" height="6" rx="3" fill="#e2e8f0" />
              <rect x={node.x - 22} y={node.y + (index % 2 === 0 ? -35 : 29)} width={44 * (node.progress / 100)} height="6" rx="3" fill={node.tone.stroke} />
            </>
          )}
        </g>
      ))}
      <rect x="62" y="150" width="236" height="12" rx="6" fill="#ffffff" opacity=".95" />
      <text x="180" y="159" textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#0f172a">인원 → 준비 → 권한 → 시작</text>
    </svg>
  );
};

export const GameStartReadinessPanel = ({
  title = "시작 준비",
  detail = "방장이 무엇을 기다리는지 확인합니다.",
  statusText = "준비 확인 중",
  items = [],
  ruleHint = "",
  canStart = false,
  className = "",
  smoke = "game-start-readiness-panel",
  itemSmoke = "game-start-readiness-item",
  artSmoke = `${smoke}-art`,
  nodeSmoke = `${smoke}-node`,
}) => {
  const visibleItems = Array.isArray(items) ? items.filter(Boolean).slice(0, 6) : [];
  if (!title && !detail && !visibleItems.length && !ruleHint) return null;
  const shellTone = canStart
    ? "border-emerald-200 bg-emerald-50/80 text-emerald-950"
    : "border-slate-200 bg-white text-slate-950";
  const badgeTone = canStart
    ? "bg-emerald-600 text-white"
    : "bg-slate-900 text-white";

  return (
    <section className={`relative overflow-hidden rounded-2xl border p-3 shadow-sm sm:p-4 ${shellTone} ${className}`} data-smoke={smoke} data-can-start={canStart ? "true" : "false"}>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,310px)_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-xl bg-slate-950 p-2">
          <GameStartReadinessArt items={visibleItems} canStart={canStart} statusText={statusText} artSmoke={artSmoke} nodeSmoke={nodeSmoke} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-black">
                <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${canStart ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"}`}>
                  <GameUxGlyph type={canStart ? "win" : "signal"} className="h-4 w-4" />
                </span>
                <span>{title}</span>
              </div>
              {detail && <div className="mt-1 max-w-3xl text-xs font-bold leading-relaxed text-slate-600">{detail}</div>}
            </div>
            <div className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${badgeTone}`}>
              <GameUxGlyph type={canStart ? "turn" : "state"} className="h-3.5 w-3.5" />
              {statusText}
            </div>
          </div>
          {!!visibleItems.length && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {visibleItems.map((item, index) => {
                const tone = startReadinessItemTones[item.tone] || startReadinessItemTones.neutral;
                const progress = Number.isFinite(Number(item.progress)) ? Math.max(0, Math.min(100, Number(item.progress))) : null;
                return (
                  <div key={`${item.label}-${item.value}-${index}`} className={`min-h-[104px] rounded-xl border px-3 py-2.5 ${tone}`} data-smoke={itemSmoke}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-black opacity-75">
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-white/80">
                          <GameUxGlyph type={item.icon || "state"} className="h-3 w-3" />
                        </span>
                        <span className="truncate">{item.label}</span>
                      </div>
                      <span className="text-[10px] font-black opacity-55">{index + 1}</span>
                    </div>
                    <div className="mt-1 truncate text-sm font-black leading-tight">{item.value}</div>
                    {item.detail && <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-relaxed opacity-70">{item.detail}</div>}
                    {progress !== null && (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/70">
                        <div className="h-full rounded-full bg-current transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {ruleHint && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-slate-100 bg-white/80 px-3 py-2 text-xs font-bold leading-relaxed text-slate-600">
              <GameUxGlyph type="decision" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
              <span>{ruleHint}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

const resultSpotlightTones = {
  emerald: {
    shell: "border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 text-emerald-950",
    badge: "bg-emerald-600 text-white",
    icon: "text-emerald-600",
    detail: "text-emerald-800",
    metric: "bg-white/80 text-emerald-700 ring-1 ring-emerald-100",
  },
  amber: {
    shell: "border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 text-amber-950",
    badge: "bg-amber-500 text-slate-950",
    icon: "text-amber-500",
    detail: "text-amber-800",
    metric: "bg-white/80 text-amber-700 ring-1 ring-amber-100",
  },
  slate: {
    shell: "border-slate-200 bg-gradient-to-br from-slate-50 via-white to-sky-50 text-slate-950",
    badge: "bg-slate-900 text-white",
    icon: "text-slate-700",
    detail: "text-slate-700",
    metric: "bg-white/80 text-slate-600 ring-1 ring-slate-100",
  },
};

export const GameResultSpotlight = ({
  title,
  subtitle = "결과",
  detail,
  metric,
  tone = "emerald",
  className = "",
  smoke = "game-result-spotlight",
}) => {
  if (!title && !detail) return null;
  const colors = resultSpotlightTones[tone] || resultSpotlightTones.emerald;

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-4 shadow-lg ${colors.shell} ${className}`} data-smoke={smoke}>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-40 opacity-20">
        <svg viewBox="0 0 160 140" className="h-full w-full" aria-hidden="true" focusable="false">
          <circle cx="104" cy="66" r="46" fill="currentColor" opacity=".18" />
          <path d="M74 33h52v18c0 22-11 36-26 36S74 73 74 51Z" fill="none" stroke="currentColor" strokeWidth="8" strokeLinejoin="round" />
          <path d="M76 42H56c0 16 8 26 22 29M124 42h20c0 16-8 26-22 29" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
          <path d="M100 87v21M82 118h36M90 108h20" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
          <path d="m100 47 5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2Z" fill="currentColor" />
        </svg>
      </div>
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black ${colors.badge}`}>
            <GameUxGlyph type="win" className="h-3.5 w-3.5" />
            {subtitle}
          </div>
          {title && <div className="mt-3 break-words text-xl font-black leading-tight sm:text-2xl">{title}</div>}
          {detail && <div className={`mt-2 text-sm font-bold leading-relaxed ${colors.detail}`}>{detail}</div>}
        </div>
        {metric && (
          <div className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black leading-relaxed ${colors.metric}`}>
            {metric}
          </div>
        )}
      </div>
    </div>
  );
};

export default GameUxGlyph;
