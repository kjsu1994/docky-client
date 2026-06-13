import { useEffect, useRef, useState } from "react";
import UserAvatar from "../../common/UserAvatar.jsx";
import { GameFlowMeter } from "./GameUxAssets.jsx";

const get = (obj, snake, camel, fallback = undefined) => obj?.[camel] ?? obj?.[snake] ?? fallback;
const listOf = (value) => (Array.isArray(value) ? value : []);
const seatNoOf = (player) => Number(get(player, "seat_no", "seatNo", 0));

const telestrationsPhaseLabels = {
  PROMPT: "시작 문장",
  DRAW: "그림 그리기",
  GUESS: "문장 추측",
  REVEAL: "공개 리플레이",
  FINISHED: "종료",
};

const telestrationsChainNodes = [
  { phase: "PROMPT", label: "문장", caption: "시작 단서", color: "#0ea5e9" },
  { phase: "DRAW", label: "그림", caption: "시각 해석", color: "#f97316" },
  { phase: "GUESS", label: "추측", caption: "다시 문장", color: "#8b5cf6" },
  { phase: "REVEAL", label: "공개", caption: "변화 확인", color: "#16a34a" },
];

const TelestrationsChainArt = ({ phase, currentStep, totalSteps, completedCount, playerCount, previousType }) => {
  const phaseIndex = Math.max(0, telestrationsChainNodes.findIndex((node) => node.phase === phase));
  const safePhaseIndex = phaseIndex >= 0 ? phaseIndex : 0;
  const progressRatio = Math.max(0, Math.min(1, Number(totalSteps) ? (Number(currentStep) + 1) / Number(totalSteps) : 0));
  const completedRatio = Math.max(0, Math.min(1, Number(playerCount) ? Number(completedCount) / Number(playerCount) : 0));
  const previousLabel = previousType === "DRAW" ? "이전 그림" : previousType ? "이전 문장" : "첫 단서";

  return (
    <svg
      data-smoke="telestrations-chain-art"
      viewBox="0 0 640 220"
      className="h-auto w-full"
      role="img"
      aria-label={`텔레스트레이션 릴레이 체인 ${telestrationsPhaseLabels[phase] || phase || "대기"}`}
      focusable="false"
    >
      <rect x="10" y="10" width="620" height="200" rx="28" fill="#f8fafc" stroke="#dbeafe" strokeWidth="3" />
      <path d="M42 64c67-26 128-27 183-2 58 27 119 25 184-4 56-25 105-18 148 21v86c-64-30-126-28-185 7-53 32-112 29-177-9-50-29-105-30-153-3Z" fill="#e0f2fe" opacity="0.72" />
      <path d="M78 114h484" fill="none" stroke="#cbd5e1" strokeWidth="10" strokeLinecap="round" />
      <path d={`M78 114h${484 * progressRatio}`} fill="none" stroke="#0f172a" strokeWidth="10" strokeLinecap="round" />
      {telestrationsChainNodes.map((node, index) => {
        const x = 78 + index * 161.3;
        const active = index === safePhaseIndex;
        const done = index < safePhaseIndex || phase === "REVEAL" || phase === "FINISHED";
        return (
          <g key={node.phase}>
            <circle cx={x} cy="114" r={active ? 38 : 30} fill={done || active ? node.color : "#ffffff"} stroke={active ? "#0f172a" : "#94a3b8"} strokeWidth={active ? 5 : 3} />
            {node.phase === "PROMPT" && (
              <g>
                <rect x={x - 15} y="99" width="30" height="30" rx="6" fill={done || active ? "#ffffff" : "#e2e8f0"} />
                <path d={`M${x - 8} 108h16M${x - 8} 116h12M${x - 8} 124h14`} stroke={done || active ? node.color : "#64748b"} strokeWidth="3" strokeLinecap="round" />
              </g>
            )}
            {node.phase === "DRAW" && (
              <g>
                <path d={`M${x - 17} 126c13-27 27-37 44-32-6 20-19 31-39 34Z`} fill={done || active ? "#ffffff" : "#e2e8f0"} stroke={done || active ? "#ffffff" : "#64748b"} strokeWidth="2" />
                <path d={`M${x - 13} 122l24-24`} stroke={done || active ? node.color : "#64748b"} strokeWidth="5" strokeLinecap="round" />
              </g>
            )}
            {node.phase === "GUESS" && (
              <g>
                <path d={`M${x - 18} 103h36v24h-19l-10 9v-9h-7Z`} fill={done || active ? "#ffffff" : "#e2e8f0"} />
                <path d={`M${x - 9} 113h18M${x - 9} 121h12`} stroke={done || active ? node.color : "#64748b"} strokeWidth="3" strokeLinecap="round" />
              </g>
            )}
            {node.phase === "REVEAL" && (
              <g>
                <path d={`M${x} 93l9 19 20 2-15 13 5 20-19-10-18 10 4-20-15-13 21-2Z`} fill={done || active ? "#ffffff" : "#e2e8f0"} stroke={done || active ? "#ffffff" : "#64748b"} strokeWidth="2" />
              </g>
            )}
            <text x={x} y="58" textAnchor="middle" fontSize="15" fontWeight="900" fill={active ? "#0f172a" : "#475569"}>{node.label}</text>
            <text x={x} y="172" textAnchor="middle" fontSize="11" fontWeight="800" fill="#64748b">{node.caption}</text>
          </g>
        );
      })}
      <g>
        <rect x="40" y="24" width="158" height="28" rx="14" fill="#ffffff" stroke="#dbeafe" />
        <text x="119" y="43" textAnchor="middle" fontSize="12" fontWeight="900" fill="#0369a1">책 진행 {Math.min(Number(currentStep) + 1, Number(totalSteps) || 1)}/{Number(totalSteps) || 1}</text>
        <rect x="460" y="24" width="116" height="28" rx="14" fill="#ffffff" stroke="#dcfce7" />
        <rect x="466" y="30" width={Math.max(0, Math.min(100, 100 * completedRatio))} height="16" rx="8" fill="#22c55e" opacity="0.85" />
        <text x="518" y="43" textAnchor="middle" fontSize="11" fontWeight="900" fill="#14532d">제출 {Number(completedCount) || 0}/{Number(playerCount) || 0}</text>
        <rect x="246" y="184" width="148" height="24" rx="12" fill="#ffffff" stroke="#ede9fe" />
        <text x="320" y="200" textAnchor="middle" fontSize="11" fontWeight="900" fill="#6d28d9">{previousLabel}</text>
      </g>
    </svg>
  );
};

const TelestrationsEntryEmptyArt = ({ phase = "", compact = false, stepLabel = "", bookLabel = "" }) => {
  const profile = telestrationsGuidanceProfiles[phase] || telestrationsGuidanceProfiles.REVEAL;
  const phaseText = telestrationsPhaseLabels[phase] || phase || "대기";
  const nodes = [
    { key: "book", x: 58, y: 88, label: "책", color: "#0ea5e9" },
    { key: "entry", x: 135, y: 116, label: "항목", color: "#f97316" },
    { key: "submit", x: 214, y: 88, label: "제출", color: "#8b5cf6" },
    { key: "replay", x: 292, y: 116, label: "공개", color: "#16a34a" },
  ];

  return (
    <svg
      data-smoke="telestrations-entry-empty-art"
      viewBox="0 0 360 190"
      className={compact ? "mx-auto h-auto w-full max-w-[280px]" : "h-auto w-full"}
      role="img"
      aria-label={`텔레스트레이션 공개 대기 ${phaseText}`}
      focusable="false"
    >
      <rect x="8" y="8" width="344" height="174" rx="26" fill="#f8fafc" stroke={profile.accent} strokeWidth="3" opacity="0.96" />
      <path d="M28 142c42-28 83-34 123-18 49 20 89 16 123-16 20-19 38-23 54-12v50H28Z" fill={profile.wash} opacity="0.86" />
      <path d="M58 108c54-36 99-36 136 0s78 36 136 0" fill="none" stroke="#cbd5e1" strokeWidth="8" strokeLinecap="round" />
      {nodes.map((node, index) => (
        <g key={node.key} data-smoke="telestrations-entry-empty-node" data-entry-node={node.key}>
          <circle cx={node.x} cy={node.y} r={index === 0 ? 24 : 20} fill="#ffffff" stroke={node.color} strokeWidth={index === 0 ? 4 : 3} />
          {node.key === "book" && (
            <g>
              <rect x={node.x - 12} y={node.y - 12} width="24" height="25" rx="5" fill={profile.wash} />
              <path d={`M${node.x - 3} ${node.y - 10}v22M${node.x - 8} ${node.y - 2}h15M${node.x - 8} ${node.y + 6}h12`} stroke={node.color} strokeWidth="2.5" strokeLinecap="round" />
            </g>
          )}
          {node.key === "entry" && (
            <g>
              <path d={`M${node.x - 13} ${node.y - 8}h26v19h-13l-8 7v-7h-5Z`} fill="#ffedd5" stroke={node.color} strokeWidth="2.5" />
              <path d={`M${node.x - 6} ${node.y - 1}h13M${node.x - 6} ${node.y + 6}h9`} stroke="#9a3412" strokeWidth="2.5" strokeLinecap="round" />
            </g>
          )}
          {node.key === "submit" && (
            <g>
              <path d={`M${node.x - 13} ${node.y + 2}l8 8 19-22`} fill="none" stroke={node.color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={node.x} cy={node.y} r="6" fill="#ede9fe" />
            </g>
          )}
          {node.key === "replay" && (
            <g>
              <path d={`M${node.x} ${node.y - 16}l5 11 12 2-9 8 3 12-11-6-11 6 3-12-9-8 12-2Z`} fill="#dcfce7" stroke={node.color} strokeWidth="2.5" />
            </g>
          )}
          <text x={node.x} y={node.y + 38} textAnchor="middle" fontSize="10" fontWeight="900" fill="#475569">{node.label}</text>
        </g>
      ))}
      <rect x="30" y="24" width="136" height="28" rx="14" fill="#ffffff" stroke="#e2e8f0" />
      <text x="98" y="43" textAnchor="middle" fontSize="12" fontWeight="900" fill={profile.accent}>{phaseText}</text>
      <rect x="190" y="24" width="128" height="28" rx="14" fill="#ffffff" stroke="#e2e8f0" />
      <text x="254" y="43" textAnchor="middle" fontSize="11" fontWeight="900" fill="#334155">{stepLabel || "항목 대기"}</text>
      <text x="180" y="170" textAnchor="middle" fontSize="11" fontWeight="900" fill="#0f172a">{bookLabel || "공개 대기 책"}</text>
    </svg>
  );
};

const TelestrationsEntryEmptyState = ({
  phase = "",
  compact = false,
  stepLabel = "",
  bookLabel = "",
  completedCount = 0,
  playerCount = 0,
}) => {
  const phaseText = telestrationsPhaseLabels[phase] || phase || "대기";
  const progressText = Number(playerCount) ? `${completedCount}/${playerCount}명 제출` : "제출 대기";
  const emptyItems = [
    {
      key: "book",
      label: "릴레이 위치",
      value: bookLabel || "공개 대기 책",
      detail: phase === "REVEAL" ? "책 데이터가 도착하면 문장과 그림 흐름이 이 영역에 표시됩니다." : "이전 단서가 도착하면 바로 같은 위치에 표시됩니다.",
    },
    {
      key: "step",
      label: "현재 항목",
      value: stepLabel || "항목 대기",
      detail: "비어 있는 상태도 게임 오류가 아니라 아직 공개할 항목을 기다리는 상태입니다.",
    },
    {
      key: "submit",
      label: "진행 근거",
      value: progressText,
      detail: "참가자 제출이 쌓이면 공개 리플레이의 원문, 그림, 추측 순서가 채워집니다.",
    },
    {
      key: "replay",
      label: "다음 표시",
      value: phase === "REVEAL" ? "공개 리플레이" : phaseText,
      detail: "첫 항목이 생기면 작성자와 내용, 이미지 프레임까지 같은 카드에서 확인합니다.",
    },
  ];

  return (
    <div
      data-smoke="telestrations-entry-empty-state"
      data-entry-phase={phase || "UNKNOWN"}
      data-entry-compact={compact ? "true" : "false"}
      data-step-label={stepLabel || ""}
      className={`overflow-hidden rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-violet-50 shadow-sm ${compact ? "p-3" : "p-4"}`}
    >
      <div className={`grid gap-3 ${compact ? "" : "lg:grid-cols-[260px_minmax(0,1fr)]"}`}>
        <TelestrationsEntryEmptyArt phase={phase} compact={compact} stepLabel={stepLabel} bookLabel={bookLabel} />
        <div>
          <div className="inline-flex rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-black text-sky-700">공개 내용 대기</div>
          <div className="mt-2 text-sm font-black text-slate-950">아직 공개된 내용이 없습니다</div>
          <div className="mt-1 text-xs font-bold leading-relaxed text-slate-600">
            {phase === "REVEAL" ? "공개 단계지만 아직 선택한 책에 표시할 항목이 없습니다. 책과 항목이 도착하면 원문, 그림, 추측 흐름이 이 자리에서 이어집니다." : "이전 플레이어의 단서가 아직 도착하지 않았습니다. 제출 흐름이 갱신되면 같은 위치에서 바로 확인합니다."}
          </div>
          <div className={`mt-3 grid gap-2 ${compact ? "" : "sm:grid-cols-2"}`}>
            {emptyItems.map((item) => (
              <div key={item.key} data-smoke="telestrations-entry-empty-item" data-entry-key={item.key} className="rounded-lg border border-white/80 bg-white/85 px-3 py-2">
                <div className="text-[10px] font-black text-slate-400">{item.label}</div>
                <div className="mt-0.5 text-xs font-black leading-snug text-slate-900">{item.value}</div>
                <div className="mt-1 text-[11px] font-bold leading-snug text-slate-500">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const TelestrationsEntry = ({
  entry,
  playerNameBySeat,
  compact = false,
  phase = "",
  stepLabel = "",
  bookLabel = "",
  completedCount = 0,
  playerCount = 0,
}) => {
  const imageData = entry ? get(entry, "image_data", "imageData", "") : "";
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [imageData]);

  if (!entry) {
    return (
      <TelestrationsEntryEmptyState
        phase={phase}
        compact={compact}
        stepLabel={stepLabel}
        bookLabel={bookLabel}
        completedCount={completedCount}
        playerCount={playerCount}
      />
    );
  }
  const type = get(entry, "type", "type", "");
  const text = get(entry, "text", "text", "");
  const authorSeatNo = Number(get(entry, "author_seat_no", "authorSeatNo", 0));
  const imageFrameClass = compact
    ? "h-40 max-h-48 min-h-32"
    : "h-[52vh] max-h-[520px] min-h-[240px]";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">
          {type === "DRAW" ? "그림" : "문장"}
        </span>
        <span className="text-[11px] font-black text-slate-400">{playerNameBySeat(authorSeatNo)}</span>
      </div>
      {imageData && !imageFailed ? (
        <div className={`${imageFrameClass} w-full overflow-hidden rounded-lg border border-slate-100 bg-white`} data-smoke="telestrations-entry-image-frame">
          <img
            src={imageData}
            alt={`${playerNameBySeat(authorSeatNo)} 그림`}
            className="block h-full w-full object-contain"
            loading="lazy"
            decoding="async"
            data-smoke="telestrations-entry-image"
            onError={() => setImageFailed(true)}
          />
        </div>
      ) : (
        <div className={`flex items-center justify-center rounded-lg bg-slate-50 px-4 text-center font-black leading-relaxed text-slate-900 ${compact ? "min-h-24 text-base" : "min-h-52 text-2xl"}`}>
          {imageData ? "그림을 불러오지 못했습니다." : (text || "비공개")}
        </div>
      )}
    </div>
  );
};

const telestrationsGuidanceProfiles = {
  PROMPT: {
    label: "문장 설계",
    accent: "#0ea5e9",
    wash: "#e0f2fe",
    focus: "그릴 수 있는 장면",
    quality: "명사, 행동, 장소가 함께 보이면 다음 사람이 바로 그릴 수 있습니다.",
  },
  DRAW: {
    label: "그림 해석",
    accent: "#f97316",
    wash: "#ffedd5",
    focus: "큰 형태 우선",
    quality: "세부 묘사보다 핵심 물체와 행동을 크게 그리면 추측이 살아납니다.",
  },
  GUESS: {
    label: "추측 작성",
    accent: "#8b5cf6",
    wash: "#ede9fe",
    focus: "그림의 주인공",
    quality: "가장 크게 보이는 대상, 행동, 장소를 짧은 문장으로 묶습니다.",
  },
  REVEAL: {
    label: "변화 감상",
    accent: "#16a34a",
    wash: "#dcfce7",
    focus: "변한 지점",
    quality: "원문, 그림, 추측이 어디서 갈라졌는지 비교합니다.",
  },
  FINISHED: {
    label: "종료",
    accent: "#64748b",
    wash: "#f1f5f9",
    focus: "결과 확인",
    quality: "책자 흐름과 참가자별 변화를 정리합니다.",
  },
};

const TelestrationsClueLensArt = ({ phase = "", previousType = "", hasPrevious = false, progress = 0, submitted = false }) => {
  const profile = telestrationsGuidanceProfiles[phase] || telestrationsGuidanceProfiles.PROMPT;
  const progressWidth = Math.max(0, Math.min(1, Number(progress) || 0)) * 188;
  const isDrawing = phase === "DRAW";
  const isGuess = phase === "GUESS";
  const isReveal = phase === "REVEAL";

  return (
    <svg
      data-smoke="telestrations-clue-lens-art"
      viewBox="0 0 320 180"
      className="h-auto w-full"
      role="img"
      aria-label={`텔레스트레이션 입력 판단 ${profile.label}`}
      focusable="false"
    >
      <rect x="8" y="8" width="304" height="164" rx="28" fill="#f8fafc" stroke={profile.accent} strokeWidth="3" opacity="0.96" />
      <path d="M32 126c40-28 82-32 126-12 48 22 91 16 128-20v48H32Z" fill={profile.wash} opacity="0.9" />
      <g transform="translate(42 35)">
        <circle cx="48" cy="48" r="38" fill="#ffffff" stroke={profile.accent} strokeWidth="5" />
        <path d="M76 76l33 33" fill="none" stroke="#0f172a" strokeWidth="12" strokeLinecap="round" opacity="0.9" />
        <path d="M23 48c11-14 23-21 36-21s25 7 36 21c-11 14-23 21-36 21S34 62 23 48Z" fill={profile.wash} stroke={profile.accent} strokeWidth="3" />
        <circle cx="59" cy="48" r="12" fill={profile.accent} />
      </g>
      <g transform="translate(154 34)">
        <rect x="0" y="0" width="132" height="36" rx="18" fill="#ffffff" stroke={profile.accent} strokeWidth="2" />
        <text x="66" y="23" textAnchor="middle" fontSize="13" fontWeight="900" fill={profile.accent}>{profile.label}</text>
        <rect x="0" y="51" width="132" height="56" rx="16" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
        {isDrawing ? (
          <g>
            <path d="M24 88c14-30 32-40 54-30-8 22-25 33-50 36Z" fill={profile.wash} stroke={profile.accent} strokeWidth="3" />
            <path d="M30 89l36-36" stroke="#0f172a" strokeWidth="6" strokeLinecap="round" />
          </g>
        ) : isGuess ? (
          <g>
            <path d="M23 66h82v31H62l-17 14V97H23Z" fill={profile.wash} stroke={profile.accent} strokeWidth="3" />
            <path d="M36 78h51M36 90h34" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
          </g>
        ) : isReveal ? (
          <g>
            <path d="M67 61l10 23 25 3-18 16 5 24-22-12-22 12 5-24-18-16 25-3Z" fill={profile.wash} stroke={profile.accent} strokeWidth="3" />
          </g>
        ) : (
          <g>
            <rect x="24" y="64" width="82" height="34" rx="8" fill={profile.wash} stroke={profile.accent} strokeWidth="3" />
            <path d="M37 75h52M37 87h35" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
          </g>
        )}
      </g>
      <g transform="translate(48 146)">
        <rect x="0" y="0" width="188" height="12" rx="6" fill="#e2e8f0" />
        <rect x="0" y="0" width={progressWidth} height="12" rx="6" fill={profile.accent} />
        <text x="211" y="10" fontSize="10" fontWeight="900" fill={submitted ? "#16a34a" : "#475569"}>{submitted ? "제출됨" : hasPrevious ? "단서 확인" : previousType ? "단서 대기" : "시작"}</text>
      </g>
    </svg>
  );
};

const TelestrationsInputGuidePanel = ({
  phase = "",
  phaseLabel = "",
  currentTask = "",
  previousEntry = null,
  previousEntryLabel = "",
  awaitingPreviousEntry = false,
  mySubmitted = false,
  textLength = 0,
  hasInk = false,
  completedCount = 0,
  playerCount = 0,
}) => {
  const profile = telestrationsGuidanceProfiles[phase] || telestrationsGuidanceProfiles.PROMPT;
  const previousType = previousEntry ? get(previousEntry, "type", "type", "") : "";
  const previousText = previousEntry ? String(get(previousEntry, "text", "text", "") || "") : "";
  const hasPrevious = Boolean(previousEntry);
  const progress = Number(playerCount) ? Number(completedCount) / Number(playerCount) : 0;
  const inputState = phase === "DRAW"
    ? hasInk ? "그림 있음" : "빈 캔버스"
    : phase === "REVEAL"
      ? "리플레이"
      : textLength ? `${textLength}/120자` : "입력 전";
  const clueDetail = phase === "PROMPT"
    ? "아직 이전 단서가 없습니다. 다음 사람이 바로 떠올릴 수 있는 장면을 시작하세요."
    : awaitingPreviousEntry
      ? "이전 플레이어의 입력을 불러오는 중입니다."
      : previousType === "DRAW"
        ? "이전 그림의 가장 큰 형태와 관계를 먼저 읽습니다."
        : previousText
          ? previousText.slice(0, 54)
          : previousEntryLabel || "이전 단서를 확인합니다.";
  const inputDetail = phase === "DRAW"
    ? "두꺼운 선으로 주인공, 장소, 행동을 먼저 잡으세요."
    : phase === "GUESS"
      ? "그림을 설명하는 한 문장으로 줄이면 다음 변형이 자연스럽습니다."
      : phase === "REVEAL"
        ? "각 책의 변화 포인트를 순서대로 비교합니다."
        : "너무 추상적인 단어보다 장면, 행동, 장소가 있는 문장이 좋습니다.";
  const guideItems = [
    {
      label: "보고 있는 단서",
      value: phase === "PROMPT" ? "새 책 시작" : awaitingPreviousEntry ? "단서 대기" : previousEntryLabel || "단서 확인",
      detail: clueDetail,
    },
    {
      label: "내 입력",
      value: inputState,
      detail: inputDetail,
    },
    {
      label: "품질 목표",
      value: profile.focus,
      detail: profile.quality,
    },
    {
      label: "진행 상태",
      value: mySubmitted ? "제출 완료" : `${completedCount}/${playerCount || "-"}명`,
      detail: mySubmitted ? "다른 참가자의 입력을 기다립니다." : currentTask || "현재 단계 입력을 완료하세요.",
    },
  ];

  return (
    <section data-smoke="telestrations-input-guide-panel" className="mt-4 rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-violet-50 p-3 shadow-sm sm:rounded-[1.5rem] sm:p-4">
      <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
        <TelestrationsClueLensArt
          phase={phase}
          previousType={previousType}
          hasPrevious={hasPrevious}
          progress={progress}
          submitted={mySubmitted}
        />
        <div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-xs font-black text-sky-600">입력 판단</div>
              <div className="mt-1 text-lg font-black text-slate-950">{phaseLabel || profile.label}</div>
              <div className="mt-1 text-xs font-bold leading-relaxed text-slate-600">{profile.quality}</div>
            </div>
            <span className="rounded-full px-3 py-1 text-[11px] font-black" style={{ backgroundColor: profile.wash, color: profile.accent }}>
              {profile.label}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {guideItems.map((item) => (
              <div key={item.label} data-smoke="telestrations-input-guide-item" className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                <div className="text-[10px] font-black text-slate-400">{item.label}</div>
                <div className="mt-0.5 text-sm font-black text-slate-900">{item.value}</div>
                <div className="mt-1 text-[11px] font-bold leading-snug text-slate-500">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const telestrationsBrushLabel = (brushSize) => {
  const size = Number(brushSize) || 0;
  if (size <= 3) return "얇게";
  if (size >= 9) return "굵게";
  return "보통";
};

const telestrationsBrushColorLabel = (brushColor) => ({
  "#111827": "먹색",
  "#dc2626": "빨강",
  "#2563eb": "파랑",
  "#16a34a": "초록",
}[String(brushColor || "").toLowerCase()] || "선택 색상");

const TelestrationsDrawingToolArt = ({
  brushColor = "#111827",
  brushSize = 5,
  hasInk = false,
  mySubmitted = false,
  awaitingPreviousEntry = false,
}) => {
  const brushLabel = telestrationsBrushLabel(brushSize);
  const ready = hasInk && !mySubmitted && !awaitingPreviousEntry;
  const statusLabel = mySubmitted ? "제출됨" : awaitingPreviousEntry ? "단서 대기" : hasInk ? "제출 가능" : "잉크 없음";
  const swatches = ["#111827", "#dc2626", "#2563eb", "#16a34a"];

  return (
    <svg
      data-smoke="telestrations-drawing-tool-art"
      viewBox="0 0 360 176"
      className="h-auto w-full"
      role="img"
      aria-label={`텔레스트레이션 그림 도구 상태 ${statusLabel}`}
      focusable="false"
    >
      <rect x="8" y="8" width="344" height="160" rx="26" fill="#0f172a" />
      <rect x="24" y="24" width="312" height="128" rx="20" fill="#f8fafc" />
      <path d="M42 128c42-32 84-38 124-18 44 23 90 18 150-26v44H42Z" fill="#ffedd5" opacity="0.8" />
      <rect x="40" y="42" width="116" height="76" rx="16" fill="#ffffff" stroke="#fed7aa" strokeWidth="3" />
      <path d="M58 94c18-33 42-45 70-34-10 26-29 39-58 44Z" fill="#fff7ed" stroke={brushColor} strokeWidth="4" />
      <path d="M64 96l54-54" stroke="#0f172a" strokeWidth={Math.max(4, Number(brushSize) || 5)} strokeLinecap="round" />
      <text x="98" y="133" textAnchor="middle" fontSize="11" fontWeight="900" fill="#9a3412">{brushLabel} 브러시</text>
      <g transform="translate(186 48)">
        {swatches.map((color, index) => {
          const selected = color.toLowerCase() === String(brushColor || "").toLowerCase();
          return (
            <g key={color} transform={`translate(${index * 36} 0)`} data-smoke="telestrations-drawing-tool-node">
              <circle cx="0" cy="0" r={selected ? 16 : 12} fill={color} stroke={selected ? "#0f172a" : "#cbd5e1"} strokeWidth={selected ? 4 : 2} />
              <circle cx="0" cy="0" r="5" fill="#ffffff" opacity={selected ? 0.92 : 0.35} />
            </g>
          );
        })}
      </g>
      <g transform="translate(184 90)">
        <rect x="0" y="0" width="132" height="28" rx="14" fill={ready ? "#dcfce7" : mySubmitted ? "#e0f2fe" : "#f1f5f9"} stroke={ready ? "#22c55e" : mySubmitted ? "#38bdf8" : "#cbd5e1"} strokeWidth="2" />
        <text x="66" y="19" textAnchor="middle" fontSize="12" fontWeight="900" fill={ready ? "#166534" : mySubmitted ? "#0369a1" : "#475569"}>{statusLabel}</text>
      </g>
      <g transform="translate(184 128)">
        <rect x="0" y="0" width="132" height="12" rx="6" fill="#e2e8f0" />
        <rect x="0" y="0" width={Math.max(12, Math.min(132, (Number(brushSize) || 5) * 14))} height="12" rx="6" fill={brushColor} opacity="0.88" />
      </g>
      <text x="40" y="38" fontSize="11" fontWeight="900" fill="#475569">도구 상태</text>
      <text x="318" y="38" textAnchor="end" fontSize="11" fontWeight="900" fill="#475569">{hasInk ? "캔버스 잉크 있음" : "빈 캔버스"}</text>
    </svg>
  );
};

const TelestrationsDrawingToolPanel = ({
  brushColor,
  brushSize,
  hasInk,
  mySubmitted,
  awaitingPreviousEntry,
  completedCount,
  playerCount,
}) => {
  const brushLabel = telestrationsBrushLabel(brushSize);
  const submitReady = hasInk && !mySubmitted && !awaitingPreviousEntry;
  const toolItems = [
    {
      key: "brush",
      label: "브러시 굵기",
      value: brushLabel,
      detail: `현재 선 굵기 ${brushSize}px로 주인공과 행동을 먼저 크게 잡습니다.`,
      tone: "border-orange-100 bg-orange-50 text-orange-900",
    },
    {
      key: "color",
      label: "선 색상",
      value: telestrationsBrushColorLabel(brushColor),
      detail: "선택한 색상은 캔버스 획에만 적용되며 제출 데이터 형식은 그대로 유지됩니다.",
      tone: "border-slate-100 bg-slate-50 text-slate-900",
    },
    {
      key: "ink",
      label: "캔버스 잉크",
      value: hasInk ? "그림 있음" : "빈 캔버스",
      detail: hasInk ? "제출 버튼을 누르기 전 핵심 형태가 읽히는지 확인하세요." : "한 획 이상 그려야 그림 제출이 열립니다.",
      tone: hasInk ? "border-emerald-100 bg-emerald-50 text-emerald-900" : "border-amber-100 bg-amber-50 text-amber-900",
    },
    {
      key: "submit",
      label: "제출 준비",
      value: mySubmitted ? "제출 완료" : submitReady ? "제출 가능" : awaitingPreviousEntry ? "단서 대기" : "그림 필요",
      detail: mySubmitted ? "다른 참가자의 입력을 기다립니다." : `${completedCount}/${playerCount || "-"}명 완료 · 도구 상태만 표시하고 제출 payload는 바꾸지 않습니다.`,
      tone: mySubmitted || submitReady ? "border-sky-100 bg-sky-50 text-sky-900" : "border-slate-100 bg-white text-slate-900",
    },
  ];

  return (
    <section
      data-smoke="telestrations-drawing-tool-panel"
      data-brush-size={brushSize}
      data-has-ink={hasInk ? "true" : "false"}
      data-submitted={mySubmitted ? "true" : "false"}
      className="mt-4 overflow-hidden rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-sky-50 p-3 shadow-sm sm:rounded-[1.5rem] sm:p-4"
    >
      <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
        <TelestrationsDrawingToolArt
          brushColor={brushColor}
          brushSize={brushSize}
          hasInk={hasInk}
          mySubmitted={mySubmitted}
          awaitingPreviousEntry={awaitingPreviousEntry}
        />
        <div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-xs font-black text-orange-600">그림 도구 상태</div>
              <div className="mt-1 text-lg font-black text-slate-950">제출 전 캔버스 점검</div>
              <div className="mt-1 text-xs font-bold leading-relaxed text-slate-600">색상, 굵기, 잉크 유무, 제출 준비를 같은 위치에서 확인합니다.</div>
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-black ${submitReady ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
              {submitReady ? "제출 가능" : mySubmitted ? "제출 완료" : "점검 중"}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {toolItems.map((item) => (
              <div key={item.key} data-smoke="telestrations-drawing-tool-item" data-tool-key={item.key} className={`min-h-[96px] rounded-xl border px-3 py-2 ${item.tone}`}>
                <div className="text-[10px] font-black opacity-70">{item.label}</div>
                <div className="mt-0.5 line-clamp-2 text-sm font-black leading-snug">{item.value}</div>
                <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-snug opacity-75">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const telestrationsActionRouteTone = (state) => ({
  ready: "border-emerald-100 bg-emerald-50 text-emerald-900",
  active: "border-sky-100 bg-sky-50 text-sky-900",
  waiting: "border-amber-100 bg-amber-50 text-amber-900",
  done: "border-slate-100 bg-slate-50 text-slate-800",
  reveal: "border-fuchsia-100 bg-fuchsia-50 text-fuchsia-900",
}[state] || "border-slate-100 bg-white text-slate-900");

const buildTelestrationsActionRouteItems = ({
  phase = "",
  phaseLabel = "",
  currentTask = "",
  previousEntry = null,
  previousEntryLabel = "",
  awaitingPreviousEntry = false,
  mySubmitted = false,
  textLength = 0,
  hasInk = false,
  completedCount = 0,
  playerCount = 0,
  isHost = false,
  revealInsight = null,
}) => {
  const normalizedPhase = String(phase || "").toUpperCase();
  const isTextPhase = normalizedPhase === "PROMPT" || normalizedPhase === "GUESS";
  const isDrawPhase = normalizedPhase === "DRAW";
  const isRevealPhase = normalizedPhase === "REVEAL" || normalizedPhase === "FINISHED";
  const safeTextLength = Math.max(0, Number(textLength) || 0);
  const safeCompletedCount = Math.max(0, Number(completedCount) || 0);
  const safePlayerCount = Math.max(0, Number(playerCount) || 0);
  const previousType = previousEntry ? String(get(previousEntry, "type", "type", "") || "").toUpperCase() : "";
  const previousText = previousEntry ? telestrationsEntryText(previousEntry) : "";
  const textReady = isTextPhase && safeTextLength > 0 && !mySubmitted && !awaitingPreviousEntry;
  const drawingReady = isDrawPhase && Boolean(hasInk) && !mySubmitted && !awaitingPreviousEntry;
  const submitReady = textReady || drawingReady;
  const phaseName = phaseLabel || normalizedPhase || "대기";
  const progressLabel = safePlayerCount ? `${safeCompletedCount}/${safePlayerCount}명` : `${safeCompletedCount}명`;
  const clueValue = normalizedPhase === "PROMPT"
    ? "새 문장"
    : awaitingPreviousEntry
      ? "단서 대기"
      : previousType === "DRAW"
        ? "그림 단서"
        : previousEntryLabel || "문장 단서";
  const clueDetail = normalizedPhase === "PROMPT"
    ? "앞사람 단서 없이 책의 첫 장면을 시작합니다."
    : awaitingPreviousEntry
      ? "이전 참가자의 항목이 도착해야 현재 입력을 확정할 수 있습니다."
      : previousType === "DRAW"
        ? "그림에서 보이는 대상, 동작, 관계를 먼저 읽습니다."
        : previousText
          ? previousText.slice(0, 64)
          : "이전 문장을 기준으로 다음 항목을 만듭니다.";
  const inputValue = isDrawPhase
    ? hasInk ? "그림 있음" : "그림 필요"
    : isTextPhase
      ? safeTextLength ? `${safeTextLength}/120자` : "문장 필요"
      : isRevealPhase
        ? `${Math.max(0, Number(revealInsight?.entryCount) || 0)}개 공개`
        : phaseName;
  const inputDetail = isDrawPhase
    ? "캔버스에 한 획 이상 남아 있어야 그림 제출이 열립니다."
    : normalizedPhase === "GUESS"
      ? "이전 그림을 짧은 문장으로 다시 번역하는 단계입니다."
      : normalizedPhase === "PROMPT"
        ? currentTask || "다음 사람이 바로 떠올릴 수 있는 구체적인 장면을 적습니다."
        : "공개 단계에서는 입력 대신 책의 변화를 순서대로 확인합니다.";
  const nextValue = isRevealPhase
    ? isHost ? "종료 가능" : "리플레이"
    : mySubmitted
      ? "다음 사람 대기"
      : progressLabel;
  const nextDetail = isRevealPhase
    ? isHost
      ? "모든 책을 확인한 뒤 방장이 게임 종료를 확정할 수 있습니다."
      : "각 책의 처음과 마지막이 어떻게 달라졌는지 차례로 봅니다."
    : mySubmitted
      ? "내 항목은 잠겼고 다른 참가자의 제출을 기다립니다."
      : `${progressLabel} 완료 상태를 보며 현재 단계의 마감을 기다립니다.`;

  return [
    {
      key: "clue",
      label: "단서 확인",
      value: clueValue,
      detail: clueDetail,
      state: awaitingPreviousEntry ? "waiting" : normalizedPhase === "PROMPT" ? "active" : "done",
    },
    {
      key: "input",
      label: "입력 준비",
      value: inputValue,
      detail: inputDetail,
      state: submitReady ? "ready" : isRevealPhase ? "reveal" : awaitingPreviousEntry ? "waiting" : "active",
    },
    {
      key: "submit",
      label: "제출",
      value: mySubmitted ? "완료" : submitReady ? "가능" : awaitingPreviousEntry ? "대기" : isRevealPhase ? "없음" : "준비 중",
      detail: mySubmitted
        ? "제출한 항목은 다음 릴레이 순서로 넘어갔습니다."
        : submitReady
          ? "아래 실제 제출 버튼으로 현재 항목을 확정할 수 있습니다."
          : isRevealPhase
            ? "공개 단계는 더 이상 새 항목을 제출하지 않습니다."
            : isDrawPhase
              ? "캔버스에 그림이 있어야 제출할 수 있습니다."
              : "문장을 입력해야 제출할 수 있습니다.",
      state: mySubmitted ? "done" : submitReady ? "ready" : isRevealPhase ? "reveal" : "waiting",
    },
    {
      key: "next",
      label: "다음 흐름",
      value: nextValue,
      detail: nextDetail,
      state: isRevealPhase ? "reveal" : mySubmitted ? "done" : "active",
    },
  ];
};

const TelestrationsActionRouteArt = ({ items = [], phase = "", mySubmitted = false, awaitingPreviousEntry = false }) => {
  const paletteByState = {
    ready: { fill: "#dcfce7", stroke: "#16a34a", text: "#166534" },
    active: { fill: "#e0f2fe", stroke: "#0ea5e9", text: "#075985" },
    waiting: { fill: "#fef3c7", stroke: "#f59e0b", text: "#92400e" },
    done: { fill: "#f1f5f9", stroke: "#64748b", text: "#334155" },
    reveal: { fill: "#fae8ff", stroke: "#d946ef", text: "#86198f" },
  };
  const nodes = items.slice(0, 4).map((item, index) => ({
    ...item,
    x: 62 + index * 108,
    y: index % 2 ? 106 : 82,
  }));
  const statusLabel = mySubmitted ? "제출 완료" : awaitingPreviousEntry ? "단서 대기" : "입력 확인";

  return (
    <svg
      data-smoke="telestrations-action-route-art"
      viewBox="0 0 420 190"
      className="h-auto w-full"
      role="img"
      aria-label={`텔레스트레이션 액션 루트 ${statusLabel}`}
      focusable="false"
    >
      <rect x="10" y="10" width="400" height="170" rx="28" fill="#f8fafc" stroke="#bae6fd" strokeWidth="3" />
      <path d="M62 82C116 45 168 45 224 82s108 37 170 0" fill="none" stroke="#cbd5e1" strokeWidth="9" strokeLinecap="round" />
      <path d="M62 106c58 33 112 33 166 0s110-33 178 0" fill="none" stroke="#e2e8f0" strokeWidth="6" strokeLinecap="round" />
      {nodes.map((node, index) => {
        const palette = paletteByState[node.state] || paletteByState.active;
        const active = node.state === "ready" || (!mySubmitted && !awaitingPreviousEntry && index === 1);
        return (
          <g key={node.key} data-smoke="telestrations-action-route-node">
            {index < nodes.length - 1 && (
              <path
                d={`M${node.x + 34} ${node.y}L${nodes[index + 1].x - 34} ${nodes[index + 1].y}`}
                stroke={node.state === "done" || node.state === "ready" ? "#0f172a" : "#94a3b8"}
                strokeWidth="5"
                strokeLinecap="round"
              />
            )}
            <circle cx={node.x} cy={node.y} r={active ? 34 : 30} fill={palette.fill} stroke={active ? "#0f172a" : palette.stroke} strokeWidth={active ? 5 : 3} />
            {node.key === "clue" && (
              <g>
                <rect x={node.x - 13} y={node.y - 15} width="26" height="30" rx="6" fill="#ffffff" stroke={palette.stroke} strokeWidth="2" />
                <path d={`M${node.x - 7} ${node.y - 6}h14M${node.x - 7} ${node.y + 2}h12M${node.x - 7} ${node.y + 10}h9`} stroke={palette.text} strokeWidth="3" strokeLinecap="round" />
              </g>
            )}
            {node.key === "input" && (
              <g>
                <path d={`M${node.x - 16} ${node.y + 12}c9-25 27-33 44-20-8 17-21 25-42 26Z`} fill="#ffffff" stroke={palette.stroke} strokeWidth="2" />
                <path d={`M${node.x - 10} ${node.y + 10}l25-25`} stroke={palette.text} strokeWidth="5" strokeLinecap="round" />
              </g>
            )}
            {node.key === "submit" && (
              <g>
                <rect x={node.x - 18} y={node.y - 12} width="36" height="24" rx="7" fill="#ffffff" stroke={palette.stroke} strokeWidth="2" />
                <path d={`M${node.x - 8} ${node.y}l6 6 13-15`} fill="none" stroke={palette.text} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            )}
            {node.key === "next" && (
              <g>
                <path d={`M${node.x - 15} ${node.y - 8}h25l8 8-8 8h-25Z`} fill="#ffffff" stroke={palette.stroke} strokeWidth="2" />
                <path d={`M${node.x - 4} ${node.y - 6}l8 6-8 6`} fill="none" stroke={palette.text} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            )}
            <text x={node.x} y={node.y + 52} textAnchor="middle" fontSize="11" fontWeight="900" fill={palette.text}>{node.label}</text>
          </g>
        );
      })}
      <rect x="28" y="24" width="138" height="28" rx="14" fill="#ffffff" stroke="#bae6fd" />
      <text x="97" y="43" textAnchor="middle" fontSize="12" fontWeight="900" fill="#075985">{String(phase || "").toUpperCase() || "READY"}</text>
      <rect x="258" y="24" width="126" height="28" rx="14" fill="#ffffff" stroke="#cbd5e1" />
      <text x="321" y="43" textAnchor="middle" fontSize="12" fontWeight="900" fill="#334155">{statusLabel}</text>
    </svg>
  );
};

const TelestrationsActionRoutePanel = ({
  phase = "",
  phaseLabel = "",
  currentTask = "",
  previousEntry = null,
  previousEntryLabel = "",
  awaitingPreviousEntry = false,
  mySubmitted = false,
  textLength = 0,
  hasInk = false,
  completedCount = 0,
  playerCount = 0,
  isHost = false,
  revealInsight = null,
}) => {
  const routeItems = buildTelestrationsActionRouteItems({
    phase,
    phaseLabel,
    currentTask,
    previousEntry,
    previousEntryLabel,
    awaitingPreviousEntry,
    mySubmitted,
    textLength,
    hasInk,
    completedCount,
    playerCount,
    isHost,
    revealInsight,
  });
  const normalizedPhase = String(phase || "").toUpperCase();
  const safeTextLength = Math.max(0, Number(textLength) || 0);
  const safeCompletedCount = Math.max(0, Number(completedCount) || 0);
  const safePlayerCount = Math.max(0, Number(playerCount) || 0);
  const statusLabel = mySubmitted
    ? "내 항목 제출 완료"
    : awaitingPreviousEntry
      ? "이전 단서 대기"
      : routeItems.some((item) => item.state === "ready")
        ? "제출 가능"
        : phaseLabel || normalizedPhase || "상태 확인";

  return (
    <section
      data-smoke="telestrations-action-route-panel"
      data-phase={normalizedPhase || "-"}
      data-submitted={mySubmitted ? "true" : "false"}
      data-awaiting-previous={awaitingPreviousEntry ? "true" : "false"}
      data-text-length={safeTextLength}
      data-has-ink={hasInk ? "true" : "false"}
      data-progress={`${safeCompletedCount}/${safePlayerCount}`}
      className="mt-4 overflow-hidden rounded-2xl border border-sky-100 bg-white p-3 shadow-sm sm:rounded-[1.5rem] sm:p-4"
    >
      <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
        <TelestrationsActionRouteArt
          items={routeItems}
          phase={phase}
          mySubmitted={mySubmitted}
          awaitingPreviousEntry={awaitingPreviousEntry}
        />
        <div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-xs font-black text-sky-600">텔레스트레이션 액션 루트</div>
              <div className="mt-1 text-lg font-black text-slate-950">단서 확인, 입력 준비, 제출, 다음 흐름</div>
              <div className="mt-1 text-xs font-bold leading-relaxed text-slate-600">현재 단계에서 막히는 지점을 먼저 보여주고 실제 입력 컨트롤은 그대로 유지합니다.</div>
            </div>
            <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-black text-sky-700">
              {statusLabel}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {routeItems.map((item) => (
              <div
                key={item.key}
                data-smoke="telestrations-action-route-item"
                data-route-key={item.key}
                className={`min-h-[96px] rounded-xl border px-3 py-2 ${telestrationsActionRouteTone(item.state)}`}
              >
                <div className="text-[10px] font-black opacity-70">{item.label}</div>
                <div className="mt-0.5 line-clamp-2 text-sm font-black leading-snug">{item.value}</div>
                <div className="mt-1 line-clamp-2 text-[11px] font-bold leading-snug opacity-75">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const safeObject = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : null);
const telestrationsBooksOf = (value) => listOf(value).filter((book) => safeObject(book));
const telestrationsEntriesOf = (book) => listOf(get(safeObject(book), "entries", "entries", [])).filter((entry) => safeObject(entry));
const telestrationsEntryTypeLabel = (type) => {
  const normalized = String(type || "").toUpperCase();
  if (normalized === "PROMPT") return "원문";
  if (normalized === "DRAW") return "그림";
  if (normalized === "GUESS") return "추측";
  return normalized || "입력";
};
const telestrationsEntryText = (entry) => {
  if (!entry) return "";
  const type = String(get(entry, "type", "type", "") || "").toUpperCase();
  const text = String(get(entry, "text", "text", "") || "").replace(/\s+/g, " ").trim();
  if (text) return text;
  return type === "DRAW" && get(entry, "image_data", "imageData", "") ? "그림 단서" : "";
};
const telestrationsRevealExcerpt = (value, fallback = "대기") => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.length > 42 ? `${text.slice(0, 41)}...` : text;
};
const buildTelestrationsRevealInsight = ({ books, revealBook, revealEntries, replayEntryIndex, playerNameBySeat, playerCount, totalSteps }) => {
  const safeBooks = telestrationsBooksOf(books);
  const entries = listOf(revealEntries).filter((entry) => safeObject(entry));
  const entryCount = entries.length;
  const selectedIndex = entryCount ? Math.max(0, Math.min(entryCount - 1, Number(replayEntryIndex) || 0)) : 0;
  const selectedEntry = entries[selectedIndex] || null;
  const ownerSeatNo = Number(get(revealBook, "owner_seat_no", "ownerSeatNo", 0)) || 0;
  const ownerName = ownerSeatNo ? playerNameBySeat(ownerSeatNo) : "공개 대기";
  const ownerTitle = ownerSeatNo ? `${ownerName}님의 책 변화` : "공개 대기 책 변화";
  const drawingCount = entries.filter((entry) => String(get(entry, "type", "type", "") || "").toUpperCase() === "DRAW").length;
  const textEntries = entries.filter((entry) => String(get(entry, "type", "type", "") || "").toUpperCase() !== "DRAW" && telestrationsEntryText(entry));
  const promptEntry = entries.find((entry) => String(get(entry, "type", "type", "") || "").toUpperCase() === "PROMPT") || textEntries[0] || null;
  const finalEntry = [...textEntries].reverse()[0] || entries[entryCount - 1] || null;
  const promptText = telestrationsEntryText(promptEntry);
  const finalText = telestrationsEntryText(finalEntry);
  const selectedText = telestrationsEntryText(selectedEntry);
  const changed = Boolean(promptText && finalText && promptText.toLowerCase() !== finalText.toLowerCase());
  const comparisonLabel = !promptText || !finalText ? "비교 대기" : changed ? "문구 변화" : "원문 유지";
  const comparisonDetail = !promptText || !finalText
    ? "원문과 마지막 추측이 모두 공개되면 변화 폭을 비교합니다."
    : changed
      ? "첫 문장과 마지막 추측이 달라진 지점을 중심으로 리플레이를 보면 됩니다."
      : "첫 문장과 마지막 추측이 거의 같은 흐름으로 이어졌습니다.";
  const targetEntryCount = Math.max(1, Number(totalSteps) || Number(playerCount) || entryCount || 1);
  const completeBookCount = safeBooks.filter((book) => telestrationsEntriesOf(book).length >= targetEntryCount).length;
  const selectedAuthorSeatNo = Number(get(selectedEntry, "author_seat_no", "authorSeatNo", 0)) || 0;
  const selectedType = String(get(selectedEntry, "type", "type", "") || "").toUpperCase();

  return {
    ownerName,
    ownerTitle,
    bookCount: safeBooks.length,
    completeBookCount,
    entryCount,
    selectedIndex,
    selectedType,
    selectedTypeLabel: telestrationsEntryTypeLabel(selectedType),
    selectedAuthorName: selectedAuthorSeatNo ? playerNameBySeat(selectedAuthorSeatNo) : "공개 대기",
    selectedText: telestrationsRevealExcerpt(selectedText, selectedType === "DRAW" ? "그림 단서" : "내용 대기"),
    comparisonLabel,
    comparisonDetail,
    changed,
    items: [
      {
        label: "시작 문장",
        value: telestrationsRevealExcerpt(promptText, "원문 대기"),
        detail: promptEntry ? `${playerNameBySeat(get(promptEntry, "author_seat_no", "authorSeatNo", 0))}의 첫 단서` : "첫 문장이 아직 공개되지 않았습니다.",
      },
      {
        label: "그림 전환",
        value: `${drawingCount}회`,
        detail: drawingCount ? "문장이 시각 단서로 바뀐 구간입니다." : "그림 항목이 아직 없습니다.",
      },
      {
        label: "최종 추측",
        value: telestrationsRevealExcerpt(finalText, "추측 대기"),
        detail: finalEntry ? `${playerNameBySeat(get(finalEntry, "author_seat_no", "authorSeatNo", 0))}의 마지막 문장` : "마지막 문장이 아직 공개되지 않았습니다.",
      },
      {
        label: "공개 진행",
        value: `${selectedIndex + 1}/${Math.max(1, entryCount)}`,
        detail: `${completeBookCount}/${safeBooks.length || 0}권이 전체 단계를 채웠습니다.`,
      },
    ],
  };
};

const TelestrationsRevealArcArt = ({ insight }) => {
  const activeKey = insight?.selectedType === "DRAW" ? "DRAW" : insight?.selectedType === "GUESS" ? "GUESS" : "PROMPT";
  const progressRatio = Math.max(0, Math.min(1, Number(insight?.entryCount) ? (Number(insight?.selectedIndex || 0) + 1) / Number(insight.entryCount) : 0));
  const nodes = [
    { key: "PROMPT", x: 76, label: "원문", color: "#0ea5e9" },
    { key: "DRAW", x: 210, label: "그림", color: "#f97316" },
    { key: "GUESS", x: 344, label: "추측", color: "#8b5cf6" },
  ];

  return (
    <svg
      data-smoke="telestrations-reveal-arc-art"
      viewBox="0 0 420 220"
      className="h-auto w-full"
      role="img"
      aria-label={`텔레스트레이션 공개 해석 ${insight?.comparisonLabel || "비교 대기"}`}
      focusable="false"
    >
      <rect x="10" y="10" width="400" height="200" rx="28" fill="#f8fafc" stroke="#e9d5ff" strokeWidth="3" />
      <path d="M40 150c48-35 87-44 117-28 45 24 82 25 127 3 40-20 70-12 97 25v40H40Z" fill="#f5d0fe" opacity="0.48" />
      <path d="M76 112c52-52 101-52 148 0s96 52 148 0" fill="none" stroke="#cbd5e1" strokeWidth="10" strokeLinecap="round" />
      <path d={`M76 112c${52 * progressRatio}-52 ${101 * progressRatio}-52 ${148 * progressRatio} 0s${96 * progressRatio} 52 ${148 * progressRatio} 0`} fill="none" stroke="#0f172a" strokeWidth="10" strokeLinecap="round" opacity="0.9" />
      {nodes.map((node) => {
        const active = node.key === activeKey;
        return (
          <g key={node.key} data-smoke="telestrations-reveal-arc-node">
            <circle cx={node.x} cy="112" r={active ? 34 : 27} fill={active ? node.color : "#ffffff"} stroke={active ? "#0f172a" : "#cbd5e1"} strokeWidth={active ? 5 : 3} />
            {node.key === "PROMPT" && (
              <g>
                <rect x={node.x - 13} y="99" width="26" height="26" rx="6" fill={active ? "#ffffff" : "#e0f2fe"} />
                <path d={`M${node.x - 7} 107h14M${node.x - 7} 115h10M${node.x - 7} 123h13`} stroke={active ? node.color : "#0369a1"} strokeWidth="3" strokeLinecap="round" />
              </g>
            )}
            {node.key === "DRAW" && (
              <g>
                <path d={`M${node.x - 17} 123c12-26 28-35 45-26-8 18-22 27-42 29Z`} fill={active ? "#ffffff" : "#ffedd5"} stroke={active ? "#ffffff" : "#f97316"} strokeWidth="2" />
                <path d={`M${node.x - 12} 121l28-28`} stroke={active ? node.color : "#9a3412"} strokeWidth="5" strokeLinecap="round" />
              </g>
            )}
            {node.key === "GUESS" && (
              <g>
                <path d={`M${node.x - 18} 100h36v25h-17l-10 9v-9h-9Z`} fill={active ? "#ffffff" : "#ede9fe"} />
                <path d={`M${node.x - 9} 110h18M${node.x - 9} 119h12`} stroke={active ? node.color : "#6d28d9"} strokeWidth="3" strokeLinecap="round" />
              </g>
            )}
            <text x={node.x} y="68" textAnchor="middle" fontSize="13" fontWeight="900" fill={active ? "#0f172a" : "#64748b"}>{node.label}</text>
          </g>
        );
      })}
      <rect x="44" y="24" width="144" height="28" rx="14" fill="#ffffff" stroke="#e9d5ff" />
      <text x="116" y="43" textAnchor="middle" fontSize="12" fontWeight="900" fill="#86198f">{insight?.comparisonLabel || "비교 대기"}</text>
      <rect x="234" y="24" width="142" height="28" rx="14" fill="#ffffff" stroke="#dbeafe" />
      <text x="305" y="43" textAnchor="middle" fontSize="12" fontWeight="900" fill="#1e3a8a">{insight?.selectedIndex + 1 || 1}/{Math.max(1, insight?.entryCount || 0)} 공개</text>
      <rect x="72" y="170" width="276" height="26" rx="13" fill="#ffffff" stroke={insight?.changed ? "#f0abfc" : "#bbf7d0"} />
      <text x="210" y="188" textAnchor="middle" fontSize="12" fontWeight="900" fill={insight?.changed ? "#a21caf" : "#15803d"}>{insight?.changed ? "마지막 문장이 달라졌습니다" : "흐름이 이어졌습니다"}</text>
    </svg>
  );
};

const TelestrationsRevealInsightPanel = ({ insight }) => (
  <section data-smoke="telestrations-reveal-insight-panel" className="mt-4 overflow-hidden rounded-2xl border border-fuchsia-100 bg-gradient-to-br from-fuchsia-50 via-white to-sky-50 p-3 shadow-sm sm:rounded-[1.5rem] sm:p-4">
    <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
      <TelestrationsRevealArcArt insight={insight} />
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-xs font-black text-fuchsia-600">공개 해석</div>
            <div className="mt-1 text-lg font-black text-slate-950">{insight.ownerTitle || `${insight.ownerName}님의 책 변화`}</div>
            <div className="mt-1 text-xs font-bold leading-relaxed text-slate-600">{insight.comparisonDetail}</div>
          </div>
          <span data-smoke="telestrations-reveal-drift" className={`rounded-full border px-3 py-1 text-[11px] font-black ${insight.changed ? "border-fuchsia-100 bg-fuchsia-50 text-fuchsia-700" : "border-emerald-100 bg-emerald-50 text-emerald-700"}`}>
            {insight.comparisonLabel}
          </span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {insight.items.map((item) => (
            <div key={item.label} data-smoke="telestrations-reveal-insight-item" className="rounded-xl border border-slate-100 bg-white px-3 py-2">
              <div className="text-[10px] font-black text-slate-400">{item.label}</div>
              <div className="mt-0.5 text-sm font-black leading-snug text-slate-900">{item.value}</div>
              <div className="mt-1 text-[11px] font-bold leading-snug text-slate-500">{item.detail}</div>
            </div>
          ))}
        </div>
        <div data-smoke="telestrations-reveal-current" className="mt-3 rounded-xl border border-fuchsia-100 bg-white px-3 py-2">
          <div className="text-[10px] font-black text-fuchsia-500">현재 보고 있는 항목</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-black text-slate-900">
            <span>{insight.selectedTypeLabel}</span>
            <span className="text-slate-300">/</span>
            <span>{insight.selectedAuthorName}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{insight.selectedIndex + 1}/{Math.max(1, insight.entryCount)}</span>
          </div>
          <div className="mt-1 text-xs font-bold leading-relaxed text-slate-600">{insight.selectedText}</div>
        </div>
      </div>
    </div>
  </section>
);

const TelestrationsBoard = ({ gameState, players: roomPlayers = [], mySeatNo, isHost = false, onAction }) => {
  const safeGameState = safeObject(gameState) || {};
  const safeRoomPlayers = Array.isArray(roomPlayers) ? roomPlayers : [];
  const phase = get(safeGameState, "phase", "phase", "");
  const currentStep = Math.max(0, Number(get(safeGameState, "current_step", "currentStep", 0)) || 0);
  const totalSteps = Math.max(1, Number(get(safeGameState, "total_steps", "totalSteps", safeRoomPlayers.length || 1)) || 1);
  const playerCount = Math.max(1, Number(get(safeGameState, "player_count", "playerCount", safeRoomPlayers.length || 1)) || 1);
  const completedSeatNos = new Set(listOf(get(safeGameState, "completed_seat_nos", "completedSeatNos", [])).map(Number));
  const activeBook = safeObject(get(safeGameState, "active_book", "activeBook", null));
  const activeEntries = telestrationsEntriesOf(activeBook);
  const previousEntry = activeEntries.find((entry) => Number(get(entry, "step_no", "stepNo", -1)) === currentStep - 1)
    || [...activeEntries].reverse().find((entry) => Number(get(entry, "step_no", "stepNo", -1)) < currentStep)
    || activeEntries[activeEntries.length - 1]
    || null;
  const mySubmitted = Boolean(get(safeGameState, "my_submitted", "mySubmitted", false)) || completedSeatNos.has(Number(mySeatNo));
  const books = telestrationsBooksOf(get(safeGameState, "books", "books", []));
  const events = listOf(get(safeGameState, "events", "events", [])).filter((event) => safeObject(event));
  const currentTask = get(safeGameState, "current_task", "currentTask", "");
  const [text, setText] = useState("");
  const [replayBookIndex, setReplayBookIndex] = useState(0);
  const [replayEntryIndex, setReplayEntryIndex] = useState(0);
  const [brushColor, setBrushColor] = useState("#111827");
  const [brushSize, setBrushSize] = useState(5);
  const [hasInk, setHasInk] = useState(false);
  const canvasRef = useRef(null);
  const drawingRef = useRef({ active: false, x: 0, y: 0 });
  const playerNameBySeat = (seatNo) => safeRoomPlayers.find((player) => seatNoOf(player) === Number(seatNo))?.nickname || `${seatNo}번`;
  const phaseLabel = telestrationsPhaseLabels[phase] || phase || "-";
  const revealBook = books[replayBookIndex] || books[0] || null;
  const revealEntries = telestrationsEntriesOf(revealBook);
  const revealEntry = revealEntries[replayEntryIndex] || revealEntries[0] || null;
  const revealOwnerSeatNo = Number(get(revealBook, "owner_seat_no", "ownerSeatNo", 0)) || 0;
  const revealBookLabel = revealOwnerSeatNo ? `${playerNameBySeat(revealOwnerSeatNo)}님의 책` : "공개 대기 책";
  const awaitingPreviousEntry = (phase === "DRAW" || phase === "GUESS") && !previousEntry;
  const currentStepLabel = `${Math.min(currentStep + 1, totalSteps)}/${totalSteps}`;
  const previousEntryLabel = phase === "PROMPT"
    ? "새 책 시작"
    : previousEntry
      ? get(previousEntry, "type", "type", "") === "DRAW" ? "그림 단서" : "문장 단서"
      : "단서 대기";
  const inputLabel = phase === "PROMPT" ? "문장 입력"
    : phase === "DRAW" ? "그림 제출"
      : phase === "GUESS" ? "문장 추측"
        : phase === "REVEAL" ? "리플레이"
          : "상태 확인";
  const telestrationsFlowItems = [
    {
      label: "단계",
      value: phaseLabel,
      detail: phase === "REVEAL" ? "책자별 변화를 넘겨 봅니다." : currentTask || "현재 입력을 완료합니다.",
      icon: "stage",
      tone: phase === "REVEAL" ? "done" : "neutral",
    },
    {
      label: "책 흐름",
      value: currentStepLabel,
      detail: `${playerCount}명 릴레이`,
      icon: "turn",
      tone: "neutral",
    },
    {
      label: "이전 단서",
      value: previousEntryLabel,
      detail: awaitingPreviousEntry ? "이전 입력을 불러오는 중" : "현재 판단의 근거",
      icon: "recent",
      tone: awaitingPreviousEntry ? "waiting" : "neutral",
    },
    {
      label: "내 제출",
      value: mySubmitted ? "완료" : inputLabel,
      detail: phase === "REVEAL" ? `${books.length || 0}권 공개` : `${completedSeatNos.size}/${playerCount}명 완료`,
      icon: "decision",
      tone: mySubmitted || phase === "REVEAL" ? "done" : "active",
    },
  ];
  const revealInsight = buildTelestrationsRevealInsight({
    books,
    revealBook,
    revealEntries,
    replayEntryIndex,
    playerNameBySeat,
    playerCount,
    totalSteps,
  });

  useEffect(() => {
    setText("");
  }, [phase, currentStep]);

  useEffect(() => {
    if (replayBookIndex >= books.length) setReplayBookIndex(0);
  }, [books.length, replayBookIndex]);

  useEffect(() => {
    if (replayEntryIndex >= revealEntries.length) setReplayEntryIndex(0);
  }, [revealEntries.length, replayEntryIndex]);

  useEffect(() => {
    if (phase !== "DRAW") return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }, [phase, currentStep]);

  const pointOf = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width,
      y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height,
    };
  };

  const paintDot = (point) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.fillStyle = brushColor;
    context.beginPath();
    context.arc(point.x, point.y, Math.max(1.5, brushSize / 2), 0, Math.PI * 2);
    context.fill();
    setHasInk(true);
  };

  const beginDraw = (event) => {
    if (phase !== "DRAW" || mySubmitted || awaitingPreviousEntry) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const point = pointOf(event);
    drawingRef.current = { active: true, x: point.x, y: point.y };
    paintDot(point);
  };

  const moveDraw = (event) => {
    if (!drawingRef.current.active || phase !== "DRAW" || mySubmitted || awaitingPreviousEntry) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const point = pointOf(event);
    context.strokeStyle = brushColor;
    context.lineWidth = brushSize;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(drawingRef.current.x, drawingRef.current.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    drawingRef.current = { active: true, x: point.x, y: point.y };
    setHasInk(true);
  };

  const endDraw = () => {
    drawingRef.current.active = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  };

  const imageFromCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return "";
    let imageData = canvas.toDataURL("image/jpeg", 0.72);
    if (imageData.length <= 150000) return imageData;
    const scaled = document.createElement("canvas");
    scaled.width = 480;
    scaled.height = 315;
    const context = scaled.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, scaled.width, scaled.height);
    context.drawImage(canvas, 0, 0, scaled.width, scaled.height);
    imageData = scaled.toDataURL("image/jpeg", 0.62);
    return imageData;
  };

  const submitPrompt = async () => {
    const value = text.trim();
    if (!value || mySubmitted) return;
    await onAction({ actionType: "SUBMIT_PROMPT", text: value });
  };

  const submitGuess = async () => {
    const value = text.trim();
    if (!value || mySubmitted || awaitingPreviousEntry) return;
    await onAction({ actionType: "SUBMIT_GUESS", text: value });
  };

  const submitDrawing = async () => {
    if (!hasInk || mySubmitted || awaitingPreviousEntry) return;
    await onAction({ actionType: "SUBMIT_DRAWING", imageData: imageFromCanvas() });
  };

  const endGame = async () => {
    const confirmed = await confirmAction({
      title: "텔레스트레이션 종료",
      message: "공개 리플레이의 문장과 그림 데이터를 삭제하고 게임을 종료할까요?",
      confirmText: "삭제하고 종료",
      cancelText: "계속 보기",
      danger: true,
    });
    if (confirmed) await onAction({ actionType: "END_GAME" });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <main className="space-y-4">
        <section id="telestrations-task-panel" className="scroll-mt-24 rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-sky-500">Step {Math.min(currentStep + 1, totalSteps)}/{totalSteps}</div>
              <h2 className="mt-1 text-2xl font-black text-slate-900">{phaseLabel}</h2>
              <p className="mt-2 max-w-2xl text-sm font-bold leading-relaxed text-slate-500">
                {phase === "REVEAL" ? "책자별로 문장과 그림이 어떻게 바뀌었는지 순서대로 넘겨 볼 수 있습니다." : currentTask || "현재 단계의 입력을 제출하세요."}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-right">
              <div className="text-[10px] font-black text-slate-400">제출 완료</div>
              <div className="text-xl font-black text-slate-900">{completedSeatNos.size}/{playerCount}</div>
            </div>
          </div>

          {awaitingPreviousEntry && (
            <div className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm font-black text-amber-700">
              이전 플레이어의 입력을 불러오는 중입니다. 잠시 후 자동으로 갱신됩니다.
            </div>
          )}

          {phase === "PROMPT" && (
            <div className="mt-4 grid gap-3">
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value.slice(0, 120))}
                disabled={mySubmitted}
                className="min-h-28 resize-none rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-base font-bold text-slate-900 outline-none focus:border-sky-400 focus:bg-white"
                placeholder="예: 달 위에서 라면을 먹는 탐험가"
              />
              <button type="button" onClick={submitPrompt} disabled={mySubmitted || !text.trim()} className="min-h-12 rounded-lg bg-slate-900 px-4 text-sm font-black text-white disabled:opacity-40">
                {mySubmitted ? "제출 완료" : "문장 제출"}
              </button>
            </div>
          )}

          {phase === "DRAW" && (
            <>
              <div className="mt-4 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                <div>
                  <div className="mb-2 text-sm font-black text-slate-900">보고 그릴 문장</div>
                  <TelestrationsEntry
                    entry={previousEntry}
                    playerNameBySeat={playerNameBySeat}
                    compact
                    phase={phase}
                    stepLabel={currentStepLabel}
                    bookLabel={previousEntryLabel}
                    completedCount={completedSeatNos.size}
                    playerCount={playerCount}
                  />
                </div>
                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-black text-slate-900">내 그림</div>
                    <div className="flex items-center gap-1.5">
                      {["#111827", "#dc2626", "#2563eb", "#16a34a"].map((color) => (
                        <button key={color} type="button" className={`h-8 w-8 rounded-full border-2 ${brushColor === color ? "border-slate-900" : "border-white"}`} style={{ backgroundColor: color }} onClick={() => setBrushColor(color)} aria-label={`색상 ${color}`} />
                      ))}
                      <select value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-black">
                        <option value={3}>얇게</option>
                        <option value={5}>보통</option>
                        <option value={9}>굵게</option>
                      </select>
                      <button type="button" onClick={clearCanvas} disabled={mySubmitted} className="h-8 rounded-lg bg-slate-100 px-3 text-xs font-black text-slate-600 disabled:opacity-40">지우기</button>
                    </div>
                  </div>
                  <canvas
                    ref={canvasRef}
                    width={640}
                    height={420}
                    className={`h-auto w-full touch-none rounded-lg border border-slate-200 bg-white shadow-inner ${awaitingPreviousEntry ? "pointer-events-none opacity-60" : ""}`}
                    aria-disabled={awaitingPreviousEntry ? "true" : undefined}
                    onPointerDown={beginDraw}
                    onPointerMove={moveDraw}
                    onPointerUp={endDraw}
                    onPointerLeave={endDraw}
                    onPointerCancel={endDraw}
                  />
                  <button type="button" onClick={submitDrawing} disabled={mySubmitted || !hasInk || awaitingPreviousEntry} className="mt-3 min-h-12 w-full rounded-lg bg-slate-900 px-4 text-sm font-black text-white disabled:opacity-40">
                    {mySubmitted ? "제출 완료" : "그림 제출"}
                  </button>
                </div>
              </div>
            </>
          )}

          {phase === "GUESS" && (
            <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(360px,1fr)_minmax(280px,360px)]">
              <div className="min-w-0">
                <div className="mb-2 text-sm font-black text-slate-900">보고 추측할 그림</div>
                <TelestrationsEntry
                  entry={previousEntry}
                  playerNameBySeat={playerNameBySeat}
                  phase={phase}
                  stepLabel={currentStepLabel}
                  bookLabel={previousEntryLabel}
                  completedCount={completedSeatNos.size}
                  playerCount={playerCount}
                />
              </div>
              <div className="space-y-3">
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value.slice(0, 120))}
                  disabled={mySubmitted || awaitingPreviousEntry}
                  className="min-h-40 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-base font-bold text-slate-900 outline-none focus:border-sky-400 focus:bg-white"
                  placeholder="그림만 보고 떠오르는 문장을 적으세요"
                />
                <button type="button" onClick={submitGuess} disabled={mySubmitted || !text.trim() || awaitingPreviousEntry} className="min-h-12 w-full rounded-lg bg-slate-900 px-4 text-sm font-black text-white disabled:opacity-40">
                  {mySubmitted ? "제출 완료" : "추측 제출"}
                </button>
              </div>
            </div>
          )}

          {mySubmitted && phase !== "REVEAL" && (
            <div className="mt-4 rounded-lg bg-sky-50 px-4 py-3 text-sm font-black text-sky-700">
              내 제출은 완료됐습니다. 다른 참가자의 입력을 기다리는 중입니다.
            </div>
          )}

          <div data-smoke="telestrations-support-panel" className="mt-4 border-t border-slate-100 pt-4">
            {phase === "DRAW" && (
              <TelestrationsDrawingToolPanel
                brushColor={brushColor}
                brushSize={brushSize}
                hasInk={hasInk}
                mySubmitted={mySubmitted}
                awaitingPreviousEntry={awaitingPreviousEntry}
                completedCount={completedSeatNos.size}
                playerCount={playerCount}
              />
            )}

            <TelestrationsInputGuidePanel
              phase={phase}
              phaseLabel={phaseLabel}
              currentTask={currentTask}
              previousEntry={previousEntry}
              previousEntryLabel={previousEntryLabel}
              awaitingPreviousEntry={awaitingPreviousEntry}
              mySubmitted={mySubmitted}
              textLength={text.trim().length}
              hasInk={hasInk}
              completedCount={completedSeatNos.size}
              playerCount={playerCount}
            />

            <TelestrationsActionRoutePanel
              phase={phase}
              phaseLabel={phaseLabel}
              currentTask={currentTask}
              previousEntry={previousEntry}
              previousEntryLabel={previousEntryLabel}
              awaitingPreviousEntry={awaitingPreviousEntry}
              mySubmitted={mySubmitted}
              textLength={text.trim().length}
              hasInk={hasInk}
              completedCount={completedSeatNos.size}
              playerCount={playerCount}
              isHost={isHost}
              revealInsight={revealInsight}
            />

            <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50/60 p-2">
              <TelestrationsChainArt
                phase={phase}
                currentStep={currentStep}
                totalSteps={totalSteps}
                completedCount={completedSeatNos.size}
                playerCount={playerCount}
                previousType={previousEntry ? get(previousEntry, "type", "type", "") : ""}
              />
            </div>

            <GameFlowMeter
              title="텔레스트레이션 체인"
              detail="현재 단계, 이전 단서, 제출 진행률을 한 줄로 확인합니다."
              items={telestrationsFlowItems}
              tone="slate"
              smoke="telestrations-flow-meter"
              className="mt-4"
            />
          </div>
        </section>

        {phase === "REVEAL" && (
          <section id="telestrations-replay-panel" className="scroll-mt-24 rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-fuchsia-500">Replay</div>
                <h2 className="mt-1 text-2xl font-black text-slate-900">{revealBookLabel}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <select value={replayBookIndex} onChange={(event) => { setReplayBookIndex(Number(event.target.value)); setReplayEntryIndex(0); }} className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black">
                  {books.map((book, index) => (
                    <option key={get(book, "owner_seat_no", "ownerSeatNo", index)} value={index}>{playerNameBySeat(get(book, "owner_seat_no", "ownerSeatNo", 0))}의 책</option>
                  ))}
                </select>
                {isHost && <button type="button" onClick={endGame} className="min-h-10 rounded-lg bg-rose-600 px-4 text-sm font-black text-white">데이터 삭제 후 종료</button>}
              </div>
            </div>
            <TelestrationsRevealInsightPanel insight={revealInsight} />
            <div className="mt-4">
              <TelestrationsEntry
                entry={revealEntry}
                playerNameBySeat={playerNameBySeat}
                phase={phase}
                stepLabel={`${Math.min(replayEntryIndex + 1, Math.max(1, revealEntries.length))}/${Math.max(1, revealEntries.length)}`}
                bookLabel={revealBookLabel}
                completedCount={revealEntries.length}
                playerCount={totalSteps}
              />
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button type="button" onClick={() => setReplayEntryIndex((value) => Math.max(0, value - 1))} disabled={replayEntryIndex <= 0} className="min-h-10 rounded-lg bg-slate-100 px-3 text-xs font-black text-slate-700 disabled:opacity-40">이전</button>
                <div className="flex items-center justify-center rounded-lg bg-slate-50 text-xs font-black text-slate-500">{replayEntryIndex + 1}/{Math.max(1, revealEntries.length)}</div>
                <button type="button" onClick={() => setReplayEntryIndex((value) => Math.min(revealEntries.length - 1, value + 1))} disabled={replayEntryIndex >= revealEntries.length - 1} className="min-h-10 rounded-lg bg-slate-900 px-3 text-xs font-black text-white disabled:opacity-40">다음</button>
              </div>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              {revealEntries.map((entry, index) => (
                <button key={`${get(entry, "step_no", "stepNo", index)}-${index}`} type="button" onClick={() => setReplayEntryIndex(index)} className={`rounded-lg border p-2 text-left ${index === replayEntryIndex ? "border-fuchsia-300 bg-fuchsia-50" : "border-slate-200 bg-slate-50"}`}>
                  <div className="text-[10px] font-black text-slate-400">#{index + 1} · {get(entry, "type", "type", "") === "DRAW" ? "그림" : "문장"}</div>
                  <div className="mt-1 truncate text-xs font-black text-slate-700">{playerNameBySeat(get(entry, "author_seat_no", "authorSeatNo", 0))}</div>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      <aside className="space-y-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
          <div className="mb-3 text-sm font-black text-slate-900">진행 현황</div>
          <div className="grid grid-cols-2 gap-2">
            {safeRoomPlayers.map((player) => {
              const seatNo = seatNoOf(player);
              const done = completedSeatNos.has(seatNo);
              return (
                <div key={seatNo} className={`rounded-lg px-3 py-2 ${done ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-500"}`}>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <UserAvatar
                      name={player.nickname}
                      profileUrl={player.profileUrl}
                      level={player.level}
                      rewardTier={player.rewardTier}
                      frameCode={player.frameCode}
                      size="xs"
                    />
                    <div className="truncate text-sm font-black">{player.nickname}</div>
                  </div>
                  <div className="text-[10px] font-black">{done ? "제출 완료" : "대기 중"}</div>
                </div>
              );
            })}
          </div>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
          <div className="mb-3 text-sm font-black text-slate-900">최근 기록</div>
          <div className="max-h-72 space-y-2 overflow-auto pr-1">
            {[...events].slice(-10).reverse().map((event) => (
              <div key={get(event, "event_no", "eventNo", "")} className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                <div className="font-black text-slate-800">{get(event, "event_type", "eventType", "")}</div>
                <div className="mt-1">{Number(get(event, "seat_no", "seatNo", 0)) ? playerNameBySeat(get(event, "seat_no", "seatNo", 0)) : "시스템"}</div>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
};

export { TelestrationsBoard };
export default TelestrationsBoard;
