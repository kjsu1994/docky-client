import { useEffect, useRef, useState } from "react";
import { Gavel, Skull, Sun, Timer, Users, Volume2 } from "lucide-react";
import UserAvatar from "../../common/UserAvatar.jsx";
import { notifyError } from "../../utils/toast.js";
import { GameFlowMeter, GameResultSpotlight } from "./GameUxAssets.jsx";

const get = (obj, snake, camel, fallback = undefined) => obj?.[camel] ?? obj?.[snake] ?? fallback;
const listOf = (value) => (Array.isArray(value) ? value : []);
const seatNoOf = (player) => Number(get(player, "seat_no", "seatNo", 0));

const mafiaPhaseLabels = {
  ROLE_REVEAL: "역할 확인",
  NIGHT_MAFIA: "밤 · 마피아",
  NIGHT_POLICE: "밤 · 경찰",
  NIGHT_DOCTOR: "밤 · 의사",
  DAWN: "아침 결과",
  DISCUSSION: "낮 토론",
  VOTING: "투표",
  TRIAL_RESULT: "투표 결과",
  FINISHED: "게임 종료",
};

const mafiaRoleLabels = {
  MAFIA: "마피아",
  POLICE: "경찰",
  DOCTOR: "의사",
  CITIZEN: "시민",
};

const mafiaRoleTone = {
  MAFIA: "from-rose-700 via-zinc-950 to-zinc-900 text-white",
  POLICE: "from-sky-600 via-indigo-900 to-zinc-950 text-white",
  DOCTOR: "from-emerald-500 via-teal-800 to-zinc-950 text-white",
  CITIZEN: "from-slate-500 via-slate-800 to-zinc-950 text-white",
};

const mafiaRoleSigilPalettes = {
  MAFIA: { field: "#450a0a", rim: "#fb7185", wash: "#991b1b", ink: "#fff1f2", accent: "#f97316" },
  POLICE: { field: "#0c4a6e", rim: "#7dd3fc", wash: "#1d4ed8", ink: "#eff6ff", accent: "#facc15" },
  DOCTOR: { field: "#064e3b", rim: "#86efac", wash: "#0f766e", ink: "#ecfdf5", accent: "#f9fafb" },
  CITIZEN: { field: "#334155", rim: "#cbd5e1", wash: "#475569", ink: "#f8fafc", accent: "#38bdf8" },
};

const MafiaRoleSigil = ({ role = "", className = "" }) => {
  const normalizedRole = role && mafiaRoleLabels[role] ? role : "CITIZEN";
  const palette = mafiaRoleSigilPalettes[normalizedRole] || mafiaRoleSigilPalettes.CITIZEN;
  const label = mafiaRoleLabels[normalizedRole] || "역할";
  const initials = label.slice(0, 2);

  return (
    <svg
      data-smoke="mafia-role-sigil"
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label={`${label} 역할 표식`}
      focusable="false"
    >
      <rect x="8" y="8" width="104" height="104" rx="24" fill={palette.field} stroke={palette.rim} strokeWidth="5" />
      <path d="M23 30c18 11 36 11 54 0 14-8 27-6 39 6v35c-18-10-34-9-49 3-22 18-48 12-64-12Z" fill={palette.wash} opacity="0.72" />
      {normalizedRole === "MAFIA" && (
        <g>
          <path d="M34 76c5-25 18-39 26-39s21 14 26 39c-8 12-16 18-26 18S42 88 34 76Z" fill="#111827" stroke={palette.rim} strokeWidth="4" />
          <path d="M38 47c11-15 37-15 48 0-6 7-14 11-24 11s-18-4-24-11Z" fill={palette.accent} />
          <circle cx="49" cy="70" r="4" fill={palette.ink} />
          <circle cx="71" cy="70" r="4" fill={palette.ink} />
        </g>
      )}
      {normalizedRole === "POLICE" && (
        <g>
          <path d="M60 30l36 13v23c0 22-13 35-36 43-23-8-36-21-36-43V43Z" fill="#0f172a" stroke={palette.rim} strokeWidth="4" />
          <path d="M35 66c15-16 35-16 50 0-15 16-35 16-50 0Z" fill={palette.ink} opacity="0.9" />
          <circle cx="60" cy="66" r="11" fill={palette.wash} stroke={palette.accent} strokeWidth="4" />
        </g>
      )}
      {normalizedRole === "DOCTOR" && (
        <g>
          <circle cx="60" cy="64" r="35" fill="#052e2b" stroke={palette.rim} strokeWidth="4" />
          <path d="M53 37h14v19h19v14H67v20H53V70H34V56h19Z" fill={palette.accent} />
          <path d="M33 89c12-9 26-12 42-9" fill="none" stroke={palette.rim} strokeWidth="5" strokeLinecap="round" />
        </g>
      )}
      {normalizedRole === "CITIZEN" && (
        <g>
          <circle cx="44" cy="55" r="13" fill={palette.ink} opacity="0.92" />
          <circle cx="76" cy="55" r="13" fill={palette.ink} opacity="0.92" />
          <path d="M25 91c4-18 17-27 35-27s31 9 35 27Z" fill={palette.ink} opacity="0.86" />
          <path d="M36 88c5-11 13-17 24-17s19 6 24 17" fill="none" stroke={palette.accent} strokeWidth="5" strokeLinecap="round" />
        </g>
      )}
      <rect x="31" y="13" width="58" height="20" rx="10" fill="#020617" opacity="0.5" />
      <text x="60" y="28" textAnchor="middle" fontSize="12" fontWeight="900" fill={palette.ink}>{initials}</text>
    </svg>
  );
};

const mafiaActionProfiles = {
  MAFIA_KILL: {
    label: "습격",
    shortLabel: "제거",
    tone: "rose",
    title: "시민팀 생존자를 줄입니다.",
    detail: "마피아는 같은 대상을 고를수록 밤 결과가 선명해집니다.",
    color: "#e11d48",
    wash: "#ffe4e6",
  },
  POLICE_CHECK: {
    label: "조사",
    shortLabel: "확인",
    tone: "sky",
    title: "의심 대상을 확인합니다.",
    detail: "경찰 결과는 다음 낮 토론의 가장 강한 근거가 됩니다.",
    color: "#0284c7",
    wash: "#e0f2fe",
  },
  DOCTOR_SAVE: {
    label: "보호",
    shortLabel: "보호",
    tone: "emerald",
    title: "밤 습격을 막을 후보를 고릅니다.",
    detail: "마피아가 노릴 법한 핵심 플레이어를 살리는 판단이 중요합니다.",
    color: "#059669",
    wash: "#d1fae5",
  },
  VOTE: {
    label: "투표",
    shortLabel: "처형",
    tone: "amber",
    title: "낮 토론의 결론을 냅니다.",
    detail: "투표는 생존 균형을 바꾸는 공개 선택입니다.",
    color: "#d97706",
    wash: "#fef3c7",
  },
};

const MafiaTargetIntelArt = ({ actionType = "", aliveMafia = 0, aliveTown = 0, targetCount = 0, submittedCount = 0, selected = false }) => {
  const profile = mafiaActionProfiles[actionType] || {
    label: "대기",
    shortLabel: "대기",
    color: "#64748b",
    wash: "#f1f5f9",
  };
  const mafiaDots = Math.max(0, Math.min(6, Number(aliveMafia) || 0));
  const townDots = Math.max(0, Math.min(8, Number(aliveTown) || 0));
  const targetDots = Math.max(0, Math.min(6, Number(targetCount) || 0));
  const submittedDots = Math.max(0, Math.min(6, Number(submittedCount) || 0));

  return (
    <svg
      data-smoke="mafia-target-intel-art"
      viewBox="0 0 320 160"
      className="h-auto w-full"
      role="img"
      aria-label={`마피아 행동 상황도 ${profile.label}`}
      focusable="false"
    >
      <rect x="8" y="8" width="304" height="144" rx="28" fill="#020617" />
      <path d="M30 108c39-41 78-46 117-16 42 33 85 32 128-9v46H30Z" fill={profile.color} opacity="0.22" />
      <circle cx="76" cy="66" r="38" fill={profile.wash} opacity="0.95" />
      <path d="M76 36c17 24 27 37 27 51 0 18-13 30-27 30S49 105 49 87c0-14 10-27 27-51Z" fill={profile.color} opacity="0.95" />
      <text x="76" y="87" textAnchor="middle" fontSize="15" fontWeight="900" fill="#ffffff">{profile.shortLabel}</text>
      <g transform="translate(132 34)">
        <text x="0" y="0" fontSize="11" fontWeight="900" fill="#fecdd3">마피아</text>
        {Array.from({ length: Math.max(1, mafiaDots) }).map((_, index) => (
          <circle key={`mafia-${index}`} cx={index * 13} cy="20" r="5.5" fill="#fb7185" opacity={index < mafiaDots ? 0.96 : 0.18} />
        ))}
        <text x="0" y="48" fontSize="11" fontWeight="900" fill="#bfdbfe">시민팀</text>
        {Array.from({ length: Math.max(1, townDots) }).map((_, index) => (
          <circle key={`town-${index}`} cx={index * 13} cy="68" r="5.5" fill="#60a5fa" opacity={index < townDots ? 0.96 : 0.18} />
        ))}
      </g>
      <g transform="translate(132 116)">
        <text x="0" y="0" fontSize="10" fontWeight="900" fill="#cbd5e1">후보</text>
        {Array.from({ length: Math.max(1, targetDots) }).map((_, index) => (
          <rect key={`target-${index}`} x={36 + index * 17} y="-11" width="12" height="12" rx="4" fill={profile.color} opacity={index < targetDots ? 0.95 : 0.2} />
        ))}
        <text x="154" y="0" fontSize="10" fontWeight="900" fill="#cbd5e1">제출</text>
        {Array.from({ length: Math.max(1, submittedDots) }).map((_, index) => (
          <circle key={`done-${index}`} cx={190 + index * 14} cy="-5" r="5" fill="#22c55e" opacity={index < submittedDots ? 0.95 : 0.18} />
        ))}
      </g>
      {selected && (
        <g>
          <path d="M258 47l18 18-18 18-18-18Z" fill="#ffffff" stroke={profile.color} strokeWidth="4" />
          <circle cx="258" cy="65" r="5" fill={profile.color} />
          <text x="258" y="103" textAnchor="middle" fontSize="10" fontWeight="900" fill="#ffffff">대상 선택</text>
        </g>
      )}
    </svg>
  );
};

const MafiaTargetEmptyBriefArt = ({
  reasonLabel = "대기",
  mySubmitted = false,
  myAlive = true,
  actionType = "",
  aliveMafia = 0,
  aliveTown = 0,
}) => {
  const tone = !myAlive ? "#94a3b8" : mySubmitted ? "#22c55e" : actionType ? "#f59e0b" : "#64748b";
  const nodeLabels = [
    { label: "이유", value: reasonLabel, x: 76, y: 110, active: true },
    { label: "단계", value: actionType ? "행동" : "대기", x: 172, y: 66, active: Boolean(actionType) },
    { label: "제출", value: mySubmitted ? "완료" : "확인", x: 258, y: 110, active: mySubmitted },
  ];

  return (
    <svg
      data-smoke="mafia-target-empty-art"
      viewBox="0 0 330 178"
      className="h-auto w-full"
      role="img"
      aria-label={`마피아 대상 후보 없음: ${reasonLabel}`}
      focusable="false"
    >
      <rect x="8" y="8" width="314" height="162" rx="24" fill="#020617" stroke="#475569" strokeWidth="3" />
      <path d="M42 122c43-45 83-48 121-9 35 36 74 31 116-16" fill="none" stroke="#334155" strokeWidth="16" strokeLinecap="round" />
      <path d="M42 122c43-45 83-48 121-9 35 36 74 31 116-16" fill="none" stroke={tone} strokeWidth="5" strokeLinecap="round" />
      <g transform="translate(34 32)">
        <text x="0" y="0" fontSize="11" fontWeight="900" fill="#cbd5e1">대상 후보 없음</text>
        <text x="0" y="21" fontSize="18" fontWeight="900" fill="#ffffff">{reasonLabel}</text>
      </g>
      <g transform="translate(230 31)">
        <text x="0" y="0" fontSize="10" fontWeight="900" fill="#fecdd3">마피아</text>
        <text x="0" y="20" fontSize="18" fontWeight="900" fill="#ffffff">{aliveMafia}</text>
        <text x="48" y="0" fontSize="10" fontWeight="900" fill="#bfdbfe">시민</text>
        <text x="48" y="20" fontSize="18" fontWeight="900" fill="#ffffff">{aliveTown}</text>
      </g>
      {nodeLabels.map((node, index) => (
        <g key={`${node.label}-${index}`} data-smoke="mafia-target-empty-node">
          <circle cx={node.x} cy={node.y} r="22" fill={node.active ? tone : "#1e293b"} stroke={node.active ? "#f8fafc" : "#64748b"} strokeWidth="3" />
          <text x={node.x} y={node.y - 4} textAnchor="middle" fontSize="9" fontWeight="900" fill={node.active ? "#ffffff" : "#cbd5e1"}>{node.label}</text>
          <text x={node.x} y={node.y + 11} textAnchor="middle" fontSize="10" fontWeight="900" fill="#ffffff">{node.value}</text>
        </g>
      ))}
    </svg>
  );
};

const MafiaTargetEmptyBrief = ({
  actionType = "",
  phaseLabel = "",
  mySubmitted = false,
  myAlive = true,
  aliveMafia = 0,
  aliveTown = 0,
  profile = null,
}) => {
  const emptyReason = !myAlive
    ? "탈락 관전"
    : mySubmitted
      ? "행동 제출 완료"
      : !actionType
        ? "현재 행동 없음"
        : "선택 후보 없음";
  const emptyDetail = !myAlive
    ? "탈락한 플레이어는 투표와 밤 행동을 제출하지 않고 진행 상황을 확인합니다."
    : mySubmitted
      ? "이미 제출한 행동은 서버 반영을 기다리는 상태라 새 후보를 표시하지 않습니다."
      : !actionType
        ? "현재 단계에서 내 차례 행동이 없어서 선택 가능한 대상이 없습니다."
        : "살아 있는 후보가 없거나 현재 규칙상 선택할 수 있는 대상이 없습니다.";
  const balanceTone = Number(aliveMafia) >= Number(aliveTown) ? "마피아가 시민팀을 압박 중입니다." : "시민팀이 수적 우위를 유지 중입니다.";
  const items = [
    {
      label: "비어 있는 이유",
      value: emptyReason,
      detail: emptyDetail,
    },
    {
      label: "현재 단계",
      value: phaseLabel || profile?.label || "대기",
      detail: profile?.detail || "사회자 진행과 다음 액션을 기다립니다.",
    },
    {
      label: "생존 균형",
      value: `마피아 ${aliveMafia} · 시민 ${aliveTown}`,
      detail: balanceTone,
    },
  ];

  return (
    <div data-smoke="mafia-target-empty-brief" className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 sm:grid-cols-[180px_minmax(0,1fr)]">
      <MafiaTargetEmptyBriefArt
        reasonLabel={emptyReason}
        actionType={actionType}
        mySubmitted={mySubmitted}
        myAlive={myAlive}
        aliveMafia={aliveMafia}
        aliveTown={aliveTown}
      />
      <div className="grid gap-2">
        {items.map((item) => (
          <div key={item.label} data-smoke="mafia-target-empty-item" className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            <div className="text-[10px] font-black text-slate-400">{item.label}</div>
            <div className="mt-0.5 text-sm font-black text-slate-950">{item.value}</div>
            <div className="mt-1 text-[11px] font-bold leading-snug text-slate-600">{item.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const MafiaTargetIntelPanel = ({
  actionType = "",
  phaseLabel = "",
  mySubmitted = false,
  myAlive = true,
  aliveMafia = 0,
  aliveTown = 0,
  targetPlayers = [],
  selectedTargetSeatNo = 0,
  completedSeatNos = new Set(),
  votedSeatNos = new Set(),
  playerNameBySeat = (seatNo) => `${seatNo}번`,
  onSelectTarget = () => {},
}) => {
  const profile = mafiaActionProfiles[actionType] || {
    label: "대기",
    title: myAlive ? "현재 단계에서는 내 행동이 없습니다." : "탈락 상태로 관전 중입니다.",
    detail: "사회자 진행과 생존 균형을 확인하세요.",
    color: "#64748b",
    wash: "#f1f5f9",
    tone: "slate",
  };
  const submittedSeats = new Set([...completedSeatNos, ...votedSeatNos].map(Number));
  const selectedName = selectedTargetSeatNo ? playerNameBySeat(selectedTargetSeatNo) : "";
  const actionLocked = !actionType || mySubmitted || !myAlive;
  const balanceTone = Number(aliveMafia) >= Number(aliveTown) ? "마피아 압박 우세" : "시민팀 수적 우세";
  const intelItems = [
    {
      label: "이번 목표",
      value: actionType ? profile.label : "대기",
      detail: profile.title,
    },
    {
      label: "선택 대상",
      value: selectedName || "미선택",
      detail: selectedName ? `${selectedName}님으로 제출 준비` : `${targetPlayers.length}명 후보 중 선택`,
    },
    {
      label: "제출 상태",
      value: mySubmitted ? "완료" : actionLocked ? "잠김" : "선택 필요",
      detail: `${submittedSeats.size}명 행동 반영`,
    },
    {
      label: "승리 압력",
      value: `마피아 ${aliveMafia} · 시민 ${aliveTown}`,
      detail: balanceTone,
    },
  ];

  return (
    <section data-smoke="mafia-target-intel-panel" className="mt-3 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-zinc-50 p-3 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
        <MafiaTargetIntelArt
          actionType={actionType}
          aliveMafia={aliveMafia}
          aliveTown={aliveTown}
          targetCount={targetPlayers.length}
          submittedCount={submittedSeats.size}
          selected={Boolean(selectedTargetSeatNo)}
        />
        <div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-xs font-black text-slate-500">{phaseLabel || "마피아 진행"}</div>
              <div className="mt-1 text-lg font-black text-slate-950">{profile.title}</div>
              <div className="mt-1 text-xs font-bold leading-relaxed text-slate-600">{profile.detail}</div>
            </div>
            <div className="rounded-full px-3 py-1 text-[11px] font-black" style={{ backgroundColor: profile.wash, color: profile.color }}>
              {profile.label}
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {intelItems.map((item) => (
              <div key={item.label} data-smoke="mafia-target-intel-item" className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                <div className="text-[10px] font-black text-slate-400">{item.label}</div>
                <div className="mt-0.5 text-sm font-black text-slate-900">{item.value}</div>
                <div className="mt-1 text-[11px] font-bold leading-snug text-slate-500">{item.detail}</div>
              </div>
            ))}
          </div>
          <div className="mt-3">
            {targetPlayers.length ? (
              <div className="flex flex-wrap gap-1.5">
                {targetPlayers.slice(0, 6).map((player) => {
                  const seatNo = Number(get(player, "seat_no", "seatNo", 0));
                  const selected = Number(selectedTargetSeatNo) === seatNo;
                  return (
                    <button
                      key={seatNo}
                      type="button"
                      data-smoke="mafia-target-candidate"
                      onClick={() => onSelectTarget(seatNo)}
                      disabled={actionLocked}
                      aria-pressed={selected}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${selected ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-700"}`}
                    >
                      {playerNameBySeat(seatNo)}
                    </button>
                  );
                })}
              </div>
            ) : (
              <MafiaTargetEmptyBrief
                actionType={actionType}
                phaseLabel={phaseLabel}
                mySubmitted={mySubmitted}
                myAlive={myAlive}
                aliveMafia={aliveMafia}
                aliveTown={aliveTown}
                profile={profile}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

const MafiaVotePressureArt = ({
  rows = [],
  aliveMafia = 0,
  aliveTown = 0,
  phase = "",
  selectedTargetSeatNo = 0,
}) => {
  const visibleRows = rows.slice(0, 8);
  const aliveTotal = Math.max(1, Number(aliveMafia || 0) + Number(aliveTown || 0));
  const mafiaRatio = Math.max(0, Math.min(1, Number(aliveMafia || 0) / aliveTotal));
  const townRatio = Math.max(0, Math.min(1, Number(aliveTown || 0) / aliveTotal));
  const submittedCount = rows.filter((row) => row.alive && row.submitted).length;
  const aliveCount = rows.filter((row) => row.alive).length;
  const selectedRow = rows.find((row) => Number(row.seatNo) === Number(selectedTargetSeatNo));
  const maxVotes = Math.max(0, ...rows.map((row) => Number(row.voteCount || 0)));
  const centerLabel = phase === "DAY_VOTE" || phase === "TRIAL_RESULT" || maxVotes > 0 ? "투표" : phase?.startsWith("NIGHT") ? "밤" : "토론";
  const nodeGap = visibleRows.length > 1 ? 470 / (visibleRows.length - 1) : 0;

  return (
    <svg
      data-smoke="mafia-vote-pressure-art"
      viewBox="0 0 640 230"
      className="h-auto w-full"
      role="img"
      aria-label={`마피아 추리 투표 압박 생존 ${aliveCount}명`}
      focusable="false"
    >
      <rect x="10" y="10" width="620" height="210" rx="28" fill="#020617" stroke="#475569" strokeWidth="3" />
      <path d="M36 70c68-33 130-34 187-2 60 35 125 32 196-9 56-32 104-19 143 39v90c-62-32-123-31-183 3-57 33-119 31-185-7-54-31-108-31-158 1Z" fill="#1e293b" opacity="0.78" />
      <g transform="translate(56 36)">
        <text x="0" y="0" fontSize="11" fontWeight="900" fill="#fecdd3">마피아</text>
        <rect x="0" y="11" width="220" height="16" rx="8" fill="#1f2937" />
        <rect x="0" y="11" width={220 * mafiaRatio} height="16" rx="8" fill="#fb7185" />
        <text x="234" y="24" fontSize="12" fontWeight="900" fill="#fecdd3">{aliveMafia}명</text>
      </g>
      <g transform="translate(360 36)">
        <text x="0" y="0" fontSize="11" fontWeight="900" fill="#bfdbfe">시민팀</text>
        <rect x="0" y="11" width="170" height="16" rx="8" fill="#1f2937" />
        <rect x="0" y="11" width={170 * townRatio} height="16" rx="8" fill="#60a5fa" />
        <text x="184" y="24" fontSize="12" fontWeight="900" fill="#bfdbfe">{aliveTown}명</text>
      </g>
      <circle cx="320" cy="118" r="42" fill={maxVotes > 0 ? "#92400e" : "#0f172a"} stroke={maxVotes > 0 ? "#fbbf24" : "#64748b"} strokeWidth="5" />
      <text x="320" y="112" textAnchor="middle" fontSize="13" fontWeight="900" fill="#ffffff">{centerLabel}</text>
      <text x="320" y="133" textAnchor="middle" fontSize="18" fontWeight="900" fill={maxVotes > 0 ? "#fef3c7" : "#cbd5e1"}>{maxVotes > 0 ? `${maxVotes}표` : `${submittedCount}/${aliveCount}`}</text>
      {visibleRows.map((row, index) => {
        const x = visibleRows.length > 1 ? 85 + index * nodeGap : 320;
        const y = 178;
        const danger = Number(row.voteCount || 0) === maxVotes && maxVotes > 0;
        const selected = Number(row.seatNo) === Number(selectedTargetSeatNo);
        const mine = Boolean(row.mine);
        const fill = !row.alive ? "#334155" : danger ? "#fef3c7" : row.submitted ? "#dcfce7" : selected ? "#ffe4e6" : "#f8fafc";
        const stroke = mine ? "#f8fafc" : danger ? "#f59e0b" : selected ? "#fb7185" : row.submitted ? "#22c55e" : "#94a3b8";
        return (
          <g key={`${row.seatNo}-${index}`} data-smoke="mafia-vote-pressure-node">
            <path d={`M${x} ${y - 31}Q${(x + 320) / 2} ${row.voteCount > 0 || selected ? 122 : 151} 320 118`} fill="none" stroke={danger ? "#fbbf24" : selected ? "#fb7185" : row.submitted ? "#22c55e" : "#64748b"} strokeWidth={danger ? 4 : 2.5} strokeLinecap="round" opacity={row.alive ? 0.82 : 0.28} />
            <circle cx={x} cy={y} r={mine ? 23 : 19} fill={fill} stroke={stroke} strokeWidth={mine ? 5 : 3} opacity={row.alive ? 1 : 0.58} />
            <text x={x} y={y - 2} textAnchor="middle" fontSize="11" fontWeight="900" fill={!row.alive ? "#cbd5e1" : danger ? "#92400e" : "#0f172a"}>{row.shortName}</text>
            <text x={x} y={y + 13} textAnchor="middle" fontSize="8" fontWeight="900" fill={!row.alive ? "#cbd5e1" : danger ? "#92400e" : "#475569"}>{row.voteCount > 0 ? `${row.voteCount}표` : row.submitted ? "완료" : row.alive ? "대기" : "탈락"}</text>
          </g>
        );
      })}
      {rows.length > visibleRows.length && (
        <text x="594" y="183" textAnchor="middle" fontSize="12" fontWeight="900" fill="#cbd5e1">+{rows.length - visibleRows.length}</text>
      )}
      {selectedRow && (
        <text x="320" y="202" textAnchor="middle" fontSize="11" fontWeight="900" fill="#fecdd3">선택 대상: {selectedRow.name}</text>
      )}
    </svg>
  );
};

const MafiaVotePressurePanel = ({
  phase = "",
  phaseLabel = "",
  rows = [],
  aliveMafia = 0,
  aliveTown = 0,
  selectedTargetSeatNo = 0,
}) => {
  if (!rows.length) return null;
  const aliveRows = rows.filter((row) => row.alive);
  const submittedRows = aliveRows.filter((row) => row.submitted);
  const voteRows = aliveRows.filter((row) => Number(row.voteCount || 0) > 0);
  const maxVoteCount = Math.max(0, ...aliveRows.map((row) => Number(row.voteCount || 0)));
  const dangerRows = maxVoteCount > 0 ? aliveRows.filter((row) => Number(row.voteCount || 0) === maxVoteCount) : [];
  const selectedRow = rows.find((row) => Number(row.seatNo) === Number(selectedTargetSeatNo));
  const mafiaParityPressure = Number(aliveMafia) >= Number(aliveTown);
  const pressureItems = [
    {
      label: "생존 균형",
      value: `마피아 ${aliveMafia} · 시민 ${aliveTown}`,
      detail: mafiaParityPressure ? "마피아 수가 시민팀을 따라잡으면 즉시 위험해집니다." : "시민팀은 생존 수 우위를 투표 근거로 바꿔야 합니다.",
      className: mafiaParityPressure ? "border-rose-100 bg-rose-50" : "border-sky-100 bg-sky-50",
    },
    {
      label: "제출 완료",
      value: `${submittedRows.length}/${aliveRows.length || "-"}명`,
      detail: "밤 행동 완료와 낮 투표 완료를 같은 흐름에서 읽습니다.",
      className: "border-emerald-100 bg-emerald-50",
    },
    {
      label: "투표 압박",
      value: voteRows.length ? `${dangerRows.map((row) => row.name).join(", ")} ${maxVoteCount}표` : "득표 대기",
      detail: voteRows.length ? "공개 득표가 있으면 최다 득표자가 처형 위험 후보입니다." : "투표 단계가 되면 좌석별 득표가 이 패널에 누적됩니다.",
      className: "border-amber-100 bg-amber-50",
    },
    {
      label: "처형 위험",
      value: selectedRow ? `${selectedRow.name} 선택 중` : dangerRows.length ? dangerRows.map((row) => row.name).join(", ") : "후보 없음",
      detail: selectedRow ? "현재 내가 고른 대상이 전체 압박 지도에 강조됩니다." : "선택 또는 득표 정보가 없으면 생존 균형을 먼저 확인합니다.",
      className: "border-slate-100 bg-slate-50",
    },
  ];

  return (
    <section data-smoke="mafia-vote-pressure-panel" className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black text-rose-700">추리 투표 압박</div>
          <div className="mt-1 text-lg font-black text-slate-950">누가 위험하고 어느 팀이 유리한가</div>
          <div className="mt-1 max-w-2xl text-xs font-bold leading-relaxed text-slate-600">
            생존 균형, 행동 완료, 공개 득표, 선택 대상을 한 장면에서 읽어 다음 토론과 투표 판단을 정리합니다.
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-2 text-right">
          <div className="text-[10px] font-black text-slate-500">현재 단계</div>
          <div className="mt-0.5 text-sm font-black text-slate-900">{phaseLabel || phase || "대기"}</div>
        </div>
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.78fr)]">
        <MafiaVotePressureArt
          rows={rows}
          aliveMafia={aliveMafia}
          aliveTown={aliveTown}
          phase={phase}
          selectedTargetSeatNo={selectedTargetSeatNo}
        />
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          {pressureItems.map((item) => (
            <div key={item.label} data-smoke="mafia-vote-pressure-item" className={`rounded-xl border px-3 py-2 ${item.className}`}>
              <div className="text-[10px] font-black text-slate-500">{item.label}</div>
              <div className="mt-0.5 text-sm font-black text-slate-950">{item.value}</div>
              <div className="mt-1 text-[11px] font-bold leading-relaxed text-slate-600">{item.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const mafiaActionRouteTone = (state) => ({
  ready: "border-emerald-100 bg-emerald-50 text-emerald-900",
  active: "border-rose-100 bg-rose-50 text-rose-900",
  waiting: "border-amber-100 bg-amber-50 text-amber-900",
  done: "border-slate-100 bg-slate-50 text-slate-800",
  host: "border-indigo-100 bg-indigo-50 text-indigo-900",
}[state] || "border-slate-100 bg-white text-slate-900");

const buildMafiaActionRouteItems = ({
  phase = "",
  phaseLabel = "",
  actionType = "",
  myAlive = true,
  mySubmitted = false,
  myTask = "",
  targetPlayers = [],
  selectedTargetSeatNo = 0,
  selectedTargetName = "",
  completedCount = 0,
  votedCount = 0,
  aliveCount = 0,
  aliveMafia = 0,
  aliveTown = 0,
  remainingSeconds = 0,
  isHost = false,
}) => {
  const profile = mafiaActionProfiles[actionType] || null;
  const normalizedPhase = String(phase || "").toUpperCase();
  const finished = normalizedPhase === "FINISHED";
  const hasAction = Boolean(actionType);
  const hasTargets = targetPlayers.length > 0;
  const hasSelection = Boolean(Number(selectedTargetSeatNo));
  const submittedCount = Math.max(Number(completedCount) || 0, Number(votedCount) || 0);
  const safeAliveCount = Math.max(0, Number(aliveCount) || 0);
  const actionLabel = profile?.label || (finished ? "결과" : "대기");
  const phaseText = phaseLabel || normalizedPhase || "대기";
  const submitReady = hasAction && hasTargets && hasSelection && myAlive && !mySubmitted;
  const submitLockedReason = !myAlive
    ? "탈락 상태라 행동을 제출하지 않습니다."
    : mySubmitted
      ? "이미 제출한 행동은 현재 단계에서 잠겼습니다."
      : !hasAction
        ? "현재 내 역할이 제출할 행동을 받지 않았습니다."
        : !hasTargets
          ? "선택 가능한 대상이 없습니다."
          : !hasSelection
            ? "대상을 먼저 선택해야 제출할 수 있습니다."
            : "실제 제출 버튼으로 확정할 수 있습니다.";

  return [
    {
      key: "state",
      label: "상황 파악",
      value: phaseText,
      detail: finished ? "게임 결과를 확인하는 단계입니다." : myTask || "사회자 진행과 남은 시간을 먼저 확인합니다.",
      state: finished ? "done" : hasAction ? "active" : "waiting",
    },
    {
      key: "target",
      label: "대상 선택",
      value: selectedTargetName || (hasTargets ? `${targetPlayers.length}명 후보` : "후보 없음"),
      detail: hasAction
        ? `${actionLabel} 행동은 후보 목록에서 한 명을 고른 뒤 제출됩니다.`
        : "행동 후보가 없으면 생존 균형과 진행 상태를 보는 단계입니다.",
      state: hasSelection ? "ready" : hasAction && hasTargets ? "active" : "waiting",
    },
    {
      key: "submit",
      label: "제출",
      value: mySubmitted ? "완료" : submitReady ? "가능" : "잠김",
      detail: submitLockedReason,
      state: mySubmitted ? "done" : submitReady ? "ready" : "waiting",
    },
    {
      key: "advance",
      label: "다음 진행",
      value: finished ? "결과" : isHost ? "방장 진행" : `${Math.max(0, Number(remainingSeconds) || 0)}초`,
      detail: finished
        ? `최종 생존 균형은 마피아 ${aliveMafia}명, 시민 ${aliveTown}명입니다.`
        : isHost
          ? "방장은 수동 진행 버튼이나 자동 타이머로 다음 단계를 넘깁니다."
          : `${submittedCount}/${safeAliveCount || "-"}명 제출 흐름을 보며 다음 밤/낮 전환을 기다립니다.`,
      state: finished ? "done" : isHost ? "host" : submittedCount >= safeAliveCount && safeAliveCount > 0 ? "ready" : "active",
    },
  ];
};

const MafiaActionRouteArt = ({ items = [], actionType = "", mySubmitted = false, selectedTargetSeatNo = 0 }) => {
  const profile = mafiaActionProfiles[actionType] || { label: "대기", color: "#64748b", wash: "#f1f5f9" };
  const paletteByState = {
    ready: { fill: "#dcfce7", stroke: "#16a34a", text: "#166534" },
    active: { fill: "#ffe4e6", stroke: "#e11d48", text: "#9f1239" },
    waiting: { fill: "#fef3c7", stroke: "#d97706", text: "#92400e" },
    done: { fill: "#f1f5f9", stroke: "#64748b", text: "#334155" },
    host: { fill: "#e0e7ff", stroke: "#4f46e5", text: "#3730a3" },
  };
  const nodes = items.slice(0, 4).map((item, index) => ({ ...item, x: 66 + index * 108, y: index % 2 ? 104 : 78 }));
  const statusLabel = mySubmitted ? "제출 완료" : selectedTargetSeatNo ? "대상 선택" : profile.label;

  return (
    <svg
      data-smoke="mafia-action-route-art"
      viewBox="0 0 430 192"
      className="h-auto w-full"
      role="img"
      aria-label={`마피아 액션 루트 ${statusLabel}`}
      focusable="false"
    >
      <rect x="10" y="10" width="410" height="172" rx="28" fill="#020617" stroke="#475569" strokeWidth="3" />
      <path d="M40 126c44-46 86-48 125-6 39 41 80 39 124-6 36-36 67-32 92 9v38H40Z" fill={profile.color} opacity="0.18" />
      <path d="M64 80c54-32 109-25 164 21 47 40 94 41 141 3" fill="none" stroke="#334155" strokeWidth="10" strokeLinecap="round" />
      {nodes.map((node, index) => {
        const palette = paletteByState[node.state] || paletteByState.waiting;
        const active = node.state === "ready" || node.state === "host";
        return (
          <g key={node.key} data-smoke="mafia-action-route-node">
            {index < nodes.length - 1 && (
              <path
                d={`M${node.x + 31} ${node.y}L${nodes[index + 1].x - 31} ${nodes[index + 1].y}`}
                stroke={node.state === "done" || node.state === "ready" ? "#f8fafc" : "#64748b"}
                strokeWidth="4"
                strokeLinecap="round"
              />
            )}
            <circle cx={node.x} cy={node.y} r={active ? 32 : 28} fill={palette.fill} stroke={active ? "#ffffff" : palette.stroke} strokeWidth={active ? 5 : 3} />
            {node.key === "state" && (
              <g>
                <circle cx={node.x} cy={node.y} r="12" fill="#ffffff" stroke={palette.stroke} strokeWidth="2" />
                <path d={`M${node.x - 13} ${node.y + 14}c4-12 10-18 13-18s9 6 13 18`} fill="none" stroke={palette.text} strokeWidth="4" strokeLinecap="round" />
              </g>
            )}
            {node.key === "target" && (
              <g>
                <path d={`M${node.x} ${node.y - 17}l16 16-16 16-16-16Z`} fill="#ffffff" stroke={palette.stroke} strokeWidth="2" />
                <circle cx={node.x} cy={node.y - 1} r="5" fill={palette.text} />
              </g>
            )}
            {node.key === "submit" && (
              <g>
                <rect x={node.x - 18} y={node.y - 13} width="36" height="26" rx="8" fill="#ffffff" stroke={palette.stroke} strokeWidth="2" />
                <path d={`M${node.x - 8} ${node.y}l6 7 14-15`} fill="none" stroke={palette.text} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            )}
            {node.key === "advance" && (
              <g>
                <path d={`M${node.x - 17} ${node.y - 10}h25l10 10-10 10h-25Z`} fill="#ffffff" stroke={palette.stroke} strokeWidth="2" />
                <path d={`M${node.x - 3} ${node.y - 6}l8 6-8 6`} fill="none" stroke={palette.text} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            )}
            <text x={node.x} y={node.y + 50} textAnchor="middle" fontSize="11" fontWeight="900" fill="#e2e8f0">{node.label}</text>
          </g>
        );
      })}
      <rect x="30" y="26" width="128" height="28" rx="14" fill={profile.wash} stroke={profile.color} />
      <text x="94" y="45" textAnchor="middle" fontSize="12" fontWeight="900" fill={profile.color}>{profile.label}</text>
      <rect x="276" y="26" width="96" height="28" rx="14" fill="#f8fafc" stroke="#cbd5e1" />
      <text x="324" y="45" textAnchor="middle" fontSize="12" fontWeight="900" fill="#334155">{statusLabel}</text>
    </svg>
  );
};

const MafiaActionRoutePanel = ({
  phase = "",
  phaseLabel = "",
  actionType = "",
  myAlive = true,
  mySubmitted = false,
  myTask = "",
  targetPlayers = [],
  selectedTargetSeatNo = 0,
  selectedTargetName = "",
  completedCount = 0,
  votedCount = 0,
  aliveCount = 0,
  aliveMafia = 0,
  aliveTown = 0,
  remainingSeconds = 0,
  isHost = false,
}) => {
  const routeItems = buildMafiaActionRouteItems({
    phase,
    phaseLabel,
    actionType,
    myAlive,
    mySubmitted,
    myTask,
    targetPlayers,
    selectedTargetSeatNo,
    selectedTargetName,
    completedCount,
    votedCount,
    aliveCount,
    aliveMafia,
    aliveTown,
    remainingSeconds,
    isHost,
  });
  const normalizedPhase = String(phase || "").toUpperCase();
  const selectedLabel = selectedTargetName || (selectedTargetSeatNo ? `${selectedTargetSeatNo}번` : "미선택");
  const statusLabel = mySubmitted ? "제출 완료" : selectedTargetSeatNo ? "제출 준비" : actionType ? "대상 필요" : "대기";

  return (
    <section
      data-smoke="mafia-action-route-panel"
      data-phase={normalizedPhase || "-"}
      data-action-type={actionType || "-"}
      data-submitted={mySubmitted ? "true" : "false"}
      data-alive={myAlive ? "true" : "false"}
      data-selected-target={selectedTargetSeatNo || ""}
      data-target-count={targetPlayers.length}
      data-progress={`${Math.max(Number(completedCount) || 0, Number(votedCount) || 0)}/${Math.max(Number(aliveCount) || 0, 0)}`}
      className="mt-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm"
    >
      <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
        <MafiaActionRouteArt
          items={routeItems}
          actionType={actionType}
          mySubmitted={mySubmitted}
          selectedTargetSeatNo={selectedTargetSeatNo}
        />
        <div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-xs font-black text-rose-700">마피아 액션 루트</div>
              <div className="mt-1 text-lg font-black text-slate-950">상황 파악, 대상 선택, 제출, 다음 진행</div>
              <div className="mt-1 text-xs font-bold leading-relaxed text-slate-600">밤 행동과 낮 투표가 실제 버튼으로 이어지는 이유를 한 번에 확인합니다.</div>
            </div>
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-black text-zinc-700">
              {statusLabel} · {selectedLabel}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {routeItems.map((item) => (
              <div
                key={item.key}
                data-smoke="mafia-action-route-item"
                data-route-key={item.key}
                className={`min-h-[96px] rounded-xl border px-3 py-2 ${mafiaActionRouteTone(item.state)}`}
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

const normalizeMafiaOutcomeTeam = (team = "") => String(team || "").trim().toUpperCase();

const mafiaOutcomeTeamLabel = (team = "") => {
  const normalizedTeam = normalizeMafiaOutcomeTeam(team);
  if (normalizedTeam.includes("MAFIA")) return "마피아팀";
  if (normalizedTeam.includes("TOWN") || normalizedTeam.includes("CITIZEN")) return "시민팀";
  return "승리팀 미정";
};

const mafiaOutcomeTone = (team = "") => {
  const normalizedTeam = normalizeMafiaOutcomeTeam(team);
  if (normalizedTeam.includes("MAFIA")) {
    return {
      accent: "#e11d48",
      deep: "#881337",
      soft: "#ffe4e6",
      pale: "#fff1f2",
      border: "border-rose-200",
      badge: "bg-rose-100 text-rose-800",
      item: "border-rose-100 bg-rose-50 text-rose-950",
    };
  }
  if (normalizedTeam.includes("TOWN") || normalizedTeam.includes("CITIZEN")) {
    return {
      accent: "#2563eb",
      deep: "#1e3a8a",
      soft: "#dbeafe",
      pale: "#eff6ff",
      border: "border-blue-200",
      badge: "bg-blue-100 text-blue-800",
      item: "border-blue-100 bg-blue-50 text-blue-950",
    };
  }
  return {
    accent: "#64748b",
    deep: "#334155",
    soft: "#e2e8f0",
    pale: "#f8fafc",
    border: "border-slate-200",
    badge: "bg-slate-100 text-slate-700",
    item: "border-slate-100 bg-slate-50 text-slate-900",
  };
};

const latestMafiaOutcomeEventText = (events = []) => {
  const latestEvent = [...listOf(events)].reverse().find((event) => {
    const message = get(event, "message", "message", "");
    return typeof message === "string" && message.trim();
  });
  return latestEvent ? String(get(latestEvent, "message", "message", "") || "").trim() : "";
};

const buildMafiaOutcomeLedgerItems = ({
  winnerTeam = "",
  outcomeMessage = "",
  aliveMafia = 0,
  aliveTown = 0,
  events = [],
  phaseLabel = "",
} = {}) => {
  const normalizedWinner = normalizeMafiaOutcomeTeam(winnerTeam);
  const teamLabel = mafiaOutcomeTeamLabel(normalizedWinner);
  const aliveSummary = `마피아 ${Number(aliveMafia) || 0}명 · 시민 ${Number(aliveTown) || 0}명`;
  const latestEventText = latestMafiaOutcomeEventText(events);
  const winnerFallback = normalizedWinner.includes("MAFIA")
    ? "마피아가 생존 균형을 장악해 서버가 마피아팀 승리로 정산했습니다."
    : normalizedWinner.includes("TOWN") || normalizedWinner.includes("CITIZEN")
      ? "시민이 마피아 위협을 제거해 서버가 시민팀 승리로 정산했습니다."
      : "서버가 내려준 최종 결과를 기준으로 승리 상태를 표시합니다.";
  const conditionValue = normalizedWinner.includes("MAFIA")
    ? "수 균형 장악"
    : normalizedWinner.includes("TOWN") || normalizedWinner.includes("CITIZEN")
      ? "마피아 전원 제거"
      : "결과 확인 필요";
  const conditionDetail = normalizedWinner.includes("MAFIA")
    ? `최종 생존 수가 ${aliveSummary}로 정산되어 마피아팀 승리 조건이 표시됩니다.`
    : normalizedWinner.includes("TOWN") || normalizedWinner.includes("CITIZEN")
      ? `최종 생존 수가 ${aliveSummary}로 정산되어 시민팀 승리 조건이 표시됩니다.`
      : `${aliveSummary} 상태에서 서버 결과 메시지를 기다립니다.`;

  return [
    {
      key: "winner",
      label: "승리 팀",
      value: `${teamLabel}${normalizedWinner ? " 승리" : ""}`,
      detail: outcomeMessage || winnerFallback,
    },
    {
      key: "condition",
      label: "승리 조건",
      value: conditionValue,
      detail: conditionDetail,
    },
    {
      key: "survival",
      label: "생존 균형",
      value: aliveSummary,
      detail: "최종 판정에 쓰인 생존자 수를 서버 상태 그대로 보여줍니다.",
    },
    {
      key: "trace",
      label: "결정 근거",
      value: latestEventText || phaseLabel || "최종 정산",
      detail: "마지막 공개 이벤트와 결과 메시지를 함께 읽어 누가 왜 이겼는지 확인합니다.",
    },
  ];
};

const MafiaOutcomeLedgerArt = ({ items = [], winnerTeam = "" }) => {
  const tone = mafiaOutcomeTone(winnerTeam);
  const teamLabel = mafiaOutcomeTeamLabel(winnerTeam);
  const nodePositions = [
    { x: 94, y: 154 },
    { x: 236, y: 86 },
    { x: 382, y: 154 },
    { x: 520, y: 86 },
  ];

  return (
    <svg
      data-smoke="mafia-outcome-ledger-art"
      viewBox="0 0 620 240"
      className="h-auto w-full"
      role="img"
      aria-label={`${teamLabel} 결과 해설`}
      focusable="false"
    >
      <rect x="12" y="12" width="596" height="216" rx="24" fill={tone.pale} stroke={tone.accent} strokeWidth="3" />
      <path d="M72 176C140 82 221 71 300 132c76 58 154 50 235-54" fill="none" stroke={tone.soft} strokeWidth="22" strokeLinecap="round" />
      <path d="M72 176C140 82 221 71 300 132c76 58 154 50 235-54" fill="none" stroke={tone.accent} strokeWidth="5" strokeLinecap="round" />
      <text x="42" y="52" fontSize="14" fontWeight="900" fill={tone.deep}>누가 왜 이겼는지</text>
      <text x="42" y="76" fontSize="24" fontWeight="900" fill={tone.accent}>{teamLabel}</text>
      {items.slice(0, 4).map((item, index) => {
        const node = nodePositions[index] || nodePositions[nodePositions.length - 1];
        return (
          <g key={item.key} data-smoke="mafia-outcome-ledger-node" data-outcome-key={item.key}>
            <circle cx={node.x} cy={node.y} r="29" fill="#ffffff" stroke={tone.accent} strokeWidth="5" />
            <circle cx={node.x} cy={node.y} r="17" fill={tone.soft} stroke={tone.deep} strokeWidth="2" />
            <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="14" fontWeight="900" fill={tone.deep}>{index + 1}</text>
            <text x={node.x} y={node.y + 48} textAnchor="middle" fontSize="11" fontWeight="900" fill={tone.deep}>{item.label}</text>
          </g>
        );
      })}
    </svg>
  );
};

const MafiaOutcomeLedgerPanel = ({
  winnerTeam = "",
  outcomeMessage = "",
  aliveMafia = 0,
  aliveTown = 0,
  events = [],
  phaseLabel = "",
}) => {
  const normalizedWinner = normalizeMafiaOutcomeTeam(winnerTeam);
  const tone = mafiaOutcomeTone(normalizedWinner);
  const items = buildMafiaOutcomeLedgerItems({
    winnerTeam: normalizedWinner,
    outcomeMessage,
    aliveMafia,
    aliveTown,
    events,
    phaseLabel,
  });

  return (
    <section
      data-smoke="mafia-outcome-ledger-panel"
      data-winner-team={normalizedWinner || ""}
      data-alive-mafia={Number(aliveMafia) || 0}
      data-alive-town={Number(aliveTown) || 0}
      className={`mt-4 rounded-2xl border ${tone.border} bg-white p-3 shadow-lg`}
    >
      <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
        <MafiaOutcomeLedgerArt items={items} winnerTeam={normalizedWinner} />
        <div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-xs font-black text-slate-500">마피아 결과 해설</div>
              <div className="mt-1 text-lg font-black text-slate-950">누가 왜 이겼는지</div>
              <div className="mt-1 text-xs font-bold leading-relaxed text-slate-600">
                서버가 내려준 최종 승리팀, 결과 문구, 생존 균형, 마지막 공개 이벤트를 한 화면에서 정리합니다.
              </div>
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-black ${tone.badge}`}>
              {mafiaOutcomeTeamLabel(normalizedWinner)}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <div
                key={item.key}
                data-smoke="mafia-outcome-ledger-item"
                data-outcome-key={item.key}
                className={`min-h-[96px] rounded-xl border px-3 py-2 ${tone.item}`}
              >
                <div className="text-[10px] font-black opacity-70">{item.label}</div>
                <div className="mt-0.5 line-clamp-2 text-sm font-black leading-snug">{item.value}</div>
                <div className="mt-1 line-clamp-3 text-[11px] font-bold leading-snug opacity-75">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const MAFIA_TTS_VOLUME = 1;

const MafiaBoard = ({ gameState, players: roomPlayers = [], mySeatNo, isHost = false, onAction }) => {
  const [now, setNow] = useState(() => Date.now());
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [selectedTargetSeatNo, setSelectedTargetSeatNo] = useState(0);
  const [submittingTarget, setSubmittingTarget] = useState(false);
  const spokenKeyRef = useRef("");
  const autoAdvanceKeyRef = useRef("");

  const phase = String(get(gameState, "phase", "phase", "") || "");
  const roundNo = Number(get(gameState, "round_no", "roundNo", 0)) || 0;
  const phaseLabel = mafiaPhaseLabels[phase] || phase || "-";
  const phaseEndsAt = Number(get(gameState, "phase_ends_at", "phaseEndsAt", 0));
  const phaseDuration = Number(get(gameState, "phase_duration_seconds", "phaseDurationSeconds", 0));
  const remainingSeconds = phaseEndsAt > 0 ? Math.max(0, Math.ceil((phaseEndsAt - now) / 1000)) : 0;
  const progressPercent = phaseDuration > 0 ? Math.max(0, Math.min(100, (remainingSeconds / phaseDuration) * 100)) : 0;
  const narratorLine = get(gameState, "narrator_line", "narratorLine", "") || "";
  const myRole = String(get(gameState, "my_role", "myRole", "") || "");
  const myTeam = String(get(gameState, "my_team", "myTeam", "") || "");
  const myTask = get(gameState, "my_task", "myTask", "") || narratorLine || "";
  const mySubmitted = Boolean(get(gameState, "my_submitted", "mySubmitted", false));
  const myAlive = Boolean(get(gameState, "my_alive", "myAlive", true));
  const winnerTeam = String(get(gameState, "winner_team", "winnerTeam", "") || "");
  const outcomeMessage = get(gameState, "outcome_message", "outcomeMessage", "") || "";
  const mafiaPlayers = listOf(get(gameState, "players", "players", []));
  const events = listOf(get(gameState, "events", "events", []));
  const availableActions = new Set(listOf(get(gameState, "available_actions", "availableActions", [])).map((action) => String(action || "").toUpperCase()));
  const completedSeatNos = new Set(listOf(get(gameState, "completed_seat_nos", "completedSeatNos", [])).map(Number));
  const votedSeatNos = new Set(listOf(get(gameState, "voted_seat_nos", "votedSeatNos", [])).map(Number));
  const mafiaSeatNos = new Set(listOf(get(gameState, "mafia_seat_nos", "mafiaSeatNos", [])).map(Number));
  const investigation = get(gameState, "my_investigation_result", "myInvestigationResult", null);
  const lastNightResult = get(gameState, "last_night_result", "lastNightResult", null);
  const lastTrialResult = get(gameState, "last_trial_result", "lastTrialResult", null);
  const voteCounts = get(gameState, "vote_counts", "voteCounts", {}) || {};

  const playerBySeat = (seatNo) => roomPlayers.find((player) => seatNoOf(player) === Number(seatNo)) || null;
  const playerNameBySeat = (seatNo) => playerBySeat(seatNo)?.nickname || `${seatNo}번`;
  const playerProfileBySeat = (seatNo) => playerBySeat(seatNo)?.profileUrl || "";
  const playerLevelMetaBySeat = (seatNo) => {
    const player = playerBySeat(seatNo);
    return {
      level: player?.level,
      rewardTier: player?.rewardTier,
      frameCode: player?.frameCode,
    };
  };
  const alivePlayers = mafiaPlayers.filter((player) => Boolean(get(player, "alive", "alive", true)));
  const actionType = availableActions.has("MAFIA_KILL") ? "MAFIA_KILL"
    : availableActions.has("POLICE_CHECK") ? "POLICE_CHECK"
      : availableActions.has("DOCTOR_SAVE") ? "DOCTOR_SAVE"
        : availableActions.has("VOTE") ? "VOTE"
          : "";
  const targetPlayers = alivePlayers.filter((player) => {
    const seatNo = Number(get(player, "seat_no", "seatNo", 0));
    const role = String(get(player, "role", "role", "") || "");
    if (!actionType) return false;
    if (actionType === "MAFIA_KILL") return role !== "MAFIA";
    if (actionType === "POLICE_CHECK" || actionType === "VOTE") return seatNo !== Number(mySeatNo);
    return true;
  });
  const selectedTarget = targetPlayers.find((player) => Number(get(player, "seat_no", "seatNo", 0)) === Number(selectedTargetSeatNo));
  const targetSeatNosKey = targetPlayers.map((player) => Number(get(player, "seat_no", "seatNo", 0))).join(",");
  const submitLabel = actionType === "MAFIA_KILL" ? "습격 대상 확정"
    : actionType === "POLICE_CHECK" ? "조사 대상 확정"
      : actionType === "DOCTOR_SAVE" ? "보호 대상 확정"
        : actionType === "VOTE" ? "투표 확정"
          : mySubmitted ? "선택 완료" : "대기 중";
  const selectedTargetName = selectedTarget ? playerNameBySeat(get(selectedTarget, "seat_no", "seatNo", selectedTargetSeatNo)) : "";
  const canResubmitVote = actionType === "VOTE";
  const canSubmitTarget = Boolean(actionType && selectedTarget && myAlive && !submittingTarget && (!mySubmitted || canResubmitVote));
  const actionProfile = mafiaActionProfiles[actionType] || null;
  const actionHeading = phase === "FINISHED" ? "최종 결과"
    : mySubmitted ? "이번 단계 행동 완료"
      : actionType === "VOTE" ? "투표할 플레이어를 선택하세요"
        : actionType ? `${actionProfile?.label || "행동"} 대상을 선택하세요`
          : "지금은 내가 할 행동이 없습니다";
  const actionHelp = phase === "FINISHED" ? outcomeMessage
    : mySubmitted ? "선택은 서버에 반영됐습니다. 다른 참가자의 행동을 기다리면 됩니다."
      : actionType === "VOTE" ? "후보 카드를 누르면 아래 확정 버튼이 열립니다. 내 좌석은 투표 후보에서 제외됩니다."
        : actionType ? "후보 카드를 먼저 고른 뒤 확정 버튼으로 현재 밤 행동을 제출합니다."
          : myAlive ? "토론 또는 대기 단계입니다. 필요한 행동이 열리면 이 영역에 바로 표시됩니다." : "탈락 상태라 행동은 제출하지 않고 진행만 관전합니다.";
  const submitDisabledReason = submittingTarget ? "제출 중입니다."
    : mySubmitted && !canResubmitVote ? "이미 제출했습니다."
    : !myAlive ? "탈락 상태에서는 제출할 수 없습니다."
      : !actionType ? "현재 단계에서 제출할 행동이 없습니다."
        : !selectedTarget ? `${actionType === "VOTE" ? "투표할 플레이어" : "대상"}를 먼저 선택하세요.`
          : "";
  const submitButtonLabel = submittingTarget ? "전송 중"
    : mySubmitted && actionType === "VOTE" && selectedTargetName ? `${selectedTargetName} 투표 변경`
      : mySubmitted ? "선택 완료"
    : selectedTargetName ? `${selectedTargetName} ${submitLabel}`
      : submitLabel;
  const visibleAliveMafia = mafiaPlayers.filter((player) => Boolean(get(player, "alive", "alive", true)) && String(get(player, "role", "role", "") || "") === "MAFIA").length;
  const visibleAliveTown = mafiaPlayers.filter((player) => Boolean(get(player, "alive", "alive", true)) && String(get(player, "role", "role", "") || "") !== "MAFIA").length;
  const serverAliveMafia = Number(get(gameState, "alive_mafia_count", "aliveMafiaCount", Number.NaN));
  const serverAliveTown = Number(get(gameState, "alive_town_count", "aliveTownCount", Number.NaN));
  const aliveMafia = Number.isFinite(serverAliveMafia) ? serverAliveMafia : visibleAliveMafia;
  const aliveTown = Number.isFinite(serverAliveTown) ? serverAliveTown : visibleAliveTown;
  const mafiaVotePressureRows = mafiaPlayers.map((player) => {
    const seatNo = Number(get(player, "seat_no", "seatNo", 0));
    const name = playerNameBySeat(seatNo);
    const voteCount = Number(voteCounts?.[seatNo] ?? voteCounts?.[String(seatNo)] ?? 0);
    return {
      seatNo,
      name,
      shortName: name.replace(/\s+/g, "").slice(0, 3) || `${seatNo}`,
      alive: Boolean(get(player, "alive", "alive", true)),
      knownRole: String(get(player, "role", "role", "") || get(player, "revealed_role", "revealedRole", "") || ""),
      mine: Number(seatNo) === Number(mySeatNo),
      mafiaKnown: mafiaSeatNos.has(seatNo),
      submitted: completedSeatNos.has(seatNo) || votedSeatNos.has(seatNo),
      completed: completedSeatNos.has(seatNo),
      voted: votedSeatNos.has(seatNo),
      voteCount,
    };
  });
  const mafiaFlowItems = [
    {
      label: "단계",
      value: phaseLabel,
      detail: narratorLine || "사회자 진행 대기",
      icon: phase === "FINISHED" ? "win" : "stage",
      tone: phase === "FINISHED" ? "done" : "neutral",
    },
    {
      label: "시간",
      value: phase === "FINISHED" ? "종료" : `${remainingSeconds}s`,
      detail: phaseDuration ? `총 ${phaseDuration}초 단계` : "수동 진행",
      icon: "turn",
      tone: remainingSeconds > 0 ? "waiting" : "danger",
    },
    {
      label: "내 역할",
      value: mafiaRoleLabels[myRole] || "미확인",
      detail: myAlive ? (mySubmitted ? "행동 완료" : myTask || "역할 행동 확인") : "탈락 관전",
      icon: "player",
      tone: mySubmitted ? "done" : actionType ? "active" : "neutral",
    },
    {
      label: "생존 균형",
      value: `마피아 ${aliveMafia} · 시민 ${aliveTown}`,
      detail: winnerTeam ? `${winnerTeam === "MAFIA" ? "마피아팀" : "시민팀"} 승리` : "승리 조건의 핵심 수치",
      icon: winnerTeam ? "win" : "score",
      tone: winnerTeam ? "done" : aliveMafia >= aliveTown ? "danger" : "neutral",
    },
  ];
  const mafiaResultTitle = winnerTeam
    ? `${winnerTeam === "MAFIA" ? "마피아팀" : "시민팀"} 승리`
    : "마피아 최종 결과";
  const mafiaResultDetail = winnerTeam === "MAFIA"
    ? `${outcomeMessage || "마피아 수가 시민팀 이상이 되어 밤과 낮의 균형을 장악했습니다."} 생존 조건: 마피아 ${aliveMafia}명, 시민팀 ${aliveTown}명.`
    : winnerTeam === "TOWN"
      ? `${outcomeMessage || "남은 마피아를 모두 찾아내 시민팀이 마을을 지켰습니다."} 생존 조건: 마피아 ${aliveMafia}명, 시민팀 ${aliveTown}명.`
      : outcomeMessage || "최종 생존 수와 투표/밤 행동 결과를 기준으로 승리팀을 확인합니다.";
  const mafiaResultMetric = `마피아 ${aliveMafia} · 시민 ${aliveTown}`;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setSelectedTargetSeatNo(0);
  }, [phase, roundNo, mySeatNo, actionType]);

  useEffect(() => {
    if (!selectedTargetSeatNo) return;
    if (!targetPlayers.some((player) => Number(get(player, "seat_no", "seatNo", 0)) === Number(selectedTargetSeatNo))) {
      setSelectedTargetSeatNo(0);
    }
  }, [selectedTargetSeatNo, targetSeatNosKey]);

  const speak = (text) => {
    if (!text || typeof window === "undefined" || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance === "undefined") return;
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = 0.96;
    utterance.pitch = 0.92;
    utterance.volume = MAFIA_TTS_VOLUME;
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (!soundEnabled) return;
    const key = `${phase}:${narratorLine}`;
    if (!narratorLine || spokenKeyRef.current === key) return;
    spokenKeyRef.current = key;
    speak(narratorLine);
  }, [soundEnabled, phase, narratorLine]);

  useEffect(() => {
    if (!isHost || phase === "FINISHED" || !phaseEndsAt || remainingSeconds > 0) return;
    const key = `${phase}:${phaseEndsAt}`;
    if (autoAdvanceKeyRef.current === key) return;
    autoAdvanceKeyRef.current = key;
    onAction({ actionType: "ADVANCE" }).catch(() => notifyError("마피아 단계 진행 실패"));
  }, [isHost, phase, phaseEndsAt, remainingSeconds, onAction]);

  const enableSound = () => {
    setSoundEnabled(true);
    speak(narratorLine || "마피아 사회자 음성을 시작합니다.");
  };

  const advance = () => onAction({ actionType: "ADVANCE" }).catch(() => notifyError("마피아 단계 진행 실패"));

  const submitTarget = async () => {
    if (submittingTarget) return;
    if (!myAlive) {
      notifyError("탈락 상태에서는 제출할 수 없습니다.");
      return;
    }
    if (!actionType) {
      notifyError("현재 단계에서 제출할 행동이 없습니다.");
      return;
    }
    if (!selectedTargetSeatNo || !selectedTarget) {
      notifyError("대상을 먼저 선택하세요.");
      return;
    }
    if (mySubmitted && actionType !== "VOTE") {
      notifyError("이미 제출했습니다. 다른 참가자를 기다려 주세요.");
      return;
    }
    if (actionType === "VOTE") {
      const confirmed = await confirmAction({
        title: mySubmitted ? `${playerNameBySeat(selectedTargetSeatNo)}님으로 투표를 변경할까요?` : `${playerNameBySeat(selectedTargetSeatNo)}님에게 투표할까요?`,
        description: "투표는 다시 누르면 바꿀 수 있지만, 단계가 넘어가면 결과에 반영됩니다.",
        confirmText: mySubmitted ? "투표 변경" : "투표",
      });
      if (!confirmed) return;
    }
    setSubmittingTarget(true);
    try {
      await onAction({ actionType, targetSeatNo: Number(selectedTargetSeatNo) });
    } catch {
      notifyError("선택을 반영하지 못했습니다.");
    } finally {
      setSubmittingTarget(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]" data-smoke="mafia-board">
      <main className="space-y-4">
        <section id="mafia-stage-panel" data-smoke="mafia-stage" className="scroll-mt-24 overflow-hidden rounded-[1.5rem] border border-zinc-800 bg-zinc-950 text-white shadow-2xl">
          <div className="bg-gradient-to-br from-zinc-950 via-indigo-950 to-rose-950 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-black tracking-[0.18em] text-indigo-200">마피아 사회자</div>
                <h2 className="mt-1 text-2xl font-black">{phaseLabel}</h2>
                <p className="mt-2 max-w-2xl text-sm font-bold leading-relaxed text-indigo-50/85">{narratorLine}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-right">
                <div className="rounded-2xl bg-white/10 px-3 py-2">
                  <div className="text-[10px] font-black text-white/60">남은 시간</div>
                  <div className="text-2xl font-black">{remainingSeconds}s</div>
                </div>
                <button type="button" onClick={enableSound} className={`rounded-2xl px-3 py-2 text-xs font-black ${soundEnabled ? "bg-emerald-400 text-zinc-950" : "bg-white/10 text-white"}`}>
                  <Volume2 className="mx-auto mb-1 h-4 w-4" />
                  {soundEnabled ? "음성 켜짐" : "소리 켜기"}
                </button>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-rose-400 via-amber-300 to-emerald-300 transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {mafiaFlowItems.map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2">
                  <div className="text-[10px] font-black text-white/55">{item.label}</div>
                  <div className="mt-0.5 truncate text-sm font-black text-white">{item.value}</div>
                  <div className="mt-0.5 line-clamp-1 text-[10px] font-bold text-white/60">{item.detail}</div>
                </div>
              ))}
            </div>
            <details className="mt-3 rounded-2xl border border-white/10 bg-white/10 px-3 py-2">
              <summary className="cursor-pointer text-xs font-black text-white/70">상세 진행 열기</summary>
              <GameFlowMeter
                title="마피아 진행 요약"
                detail="단계, 남은 시간, 내 역할 행동, 생존 균형을 한 번에 확인합니다."
                items={mafiaFlowItems}
                tone="dark"
                smoke="mafia-flow-meter"
                className="mt-3"
              />
            </details>
            {phase === "FINISHED" && (
              <>
                <GameResultSpotlight
                  title={mafiaResultTitle}
                  subtitle="승리 조건"
                  detail={mafiaResultDetail}
                  metric={mafiaResultMetric}
                  tone={winnerTeam === "MAFIA" ? "amber" : "emerald"}
                  className="mt-4"
                  smoke="mafia-result-spotlight"
                />
                <MafiaOutcomeLedgerPanel
                  winnerTeam={winnerTeam}
                  outcomeMessage={outcomeMessage}
                  aliveMafia={aliveMafia}
                  aliveTown={aliveTown}
                  events={events}
                  phaseLabel={phaseLabel}
                />
              </>
            )}
            <div className="mt-5 grid gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
              <div className={`rounded-2xl bg-gradient-to-br ${mafiaRoleTone[myRole] || mafiaRoleTone.CITIZEN} p-4 shadow-xl`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">내 역할</div>
                    <div className="mt-1 text-2xl font-black">{mafiaRoleLabels[myRole] || "미확인"}</div>
                    <div className="mt-1 text-xs font-bold text-white/70">{myTeam === "MAFIA" ? "마피아팀" : "시민팀"}</div>
                  </div>
                  <MafiaRoleSigil role={myRole} className="h-16 w-16 shrink-0" />
                </div>
                {mafiaSeatNos.size > 0 && (
                  <div className="mt-4 rounded-xl bg-white/10 px-3 py-2 text-xs font-black">
                    마피아 동료: {[...mafiaSeatNos].map(playerNameBySeat).join(" · ")}
                  </div>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/10 px-3 py-3">
                  <div className="flex items-center gap-2 text-[11px] font-black text-white/60"><Timer className="h-4 w-4" /> 라운드</div>
                  <div className="mt-2 text-xl font-black">{roundNo}</div>
                </div>
                <div className="rounded-2xl bg-white/10 px-3 py-3">
                  <div className="flex items-center gap-2 text-[11px] font-black text-white/60"><Skull className="h-4 w-4" /> 생존 마피아</div>
                  <div className="mt-2 text-xl font-black">{aliveMafia}</div>
                </div>
                <div className="rounded-2xl bg-white/10 px-3 py-3">
                  <div className="flex items-center gap-2 text-[11px] font-black text-white/60"><Sun className="h-4 w-4" /> 생존 시민팀</div>
                  <div className="mt-2 text-xl font-black">{aliveTown}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="mafia-action-panel" className="tabletop-mobile-action-strip sticky bottom-3 z-20 scroll-mt-24 rounded-[1.5rem] border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur xl:static xl:bg-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black text-slate-900">{phase === "FINISHED" ? "최종 결과" : mySubmitted ? "행동 완료" : actionType ? "지금 할 일" : "대기 중"}</div>
              <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">{phase === "FINISHED" ? outcomeMessage : myTask}</div>
            </div>
            {isHost && phase !== "FINISHED" && (
              <button type="button" onClick={advance} className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-black text-white">
                다음 진행
              </button>
            )}
          </div>

          {actionType ? (
            <div data-smoke="mafia-primary-action" className="mt-3 rounded-2xl border border-rose-100 bg-rose-50/70 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-rose-700">
                    {actionType === "VOTE" ? "투표" : "내 행동"}
                  </div>
                  <div className="mt-1 text-lg font-black text-slate-950">{actionHeading}</div>
                  <div className="mt-1 text-xs font-bold leading-relaxed text-slate-600">{actionHelp}</div>
                </div>
                <div className={`rounded-full px-3 py-1 text-[11px] font-black ${selectedTargetName ? "bg-slate-900 text-white" : "bg-white text-slate-500"}`}>
                  {selectedTargetName ? `${selectedTargetName} 선택됨` : "대상 미선택"}
                </div>
              </div>

              <div data-smoke="mafia-target-grid" className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {targetPlayers.map((player) => {
                  const seatNo = Number(get(player, "seat_no", "seatNo", 0));
                  const selected = selectedTargetSeatNo === seatNo;
                  const levelMeta = playerLevelMetaBySeat(seatNo);
                  return (
                    <button
                      key={seatNo}
                      type="button"
                      data-smoke="mafia-target-button"
                      data-seat-no={seatNo}
                      onClick={() => setSelectedTargetSeatNo(seatNo)}
                      aria-pressed={selected}
                      className={`min-h-16 rounded-xl border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${selected ? "border-slate-900 bg-slate-900 text-white shadow-lg" : "border-slate-200 bg-white text-slate-700 hover:border-rose-200 hover:bg-rose-50"}`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <UserAvatar
                          name={playerNameBySeat(seatNo)}
                          profileUrl={playerProfileBySeat(seatNo)}
                          level={levelMeta.level}
                          rewardTier={levelMeta.rewardTier}
                          frameCode={levelMeta.frameCode}
                          size="xs"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black">{playerNameBySeat(seatNo)}</div>
                          <div className="text-[11px] font-bold opacity-70">좌석 {seatNo}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
                <div className="rounded-xl border border-white bg-white/80 px-3 py-2">
                  <div className="text-[10px] font-black text-slate-400">확정 전 확인</div>
                  <div className="mt-0.5 text-sm font-black text-slate-900">
                    {selectedTargetName ? `${selectedTargetName}에게 ${actionType === "VOTE" ? "투표합니다" : "행동합니다"}` : submitDisabledReason}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!canSubmitTarget}
                  onClick={submitTarget}
                  data-smoke="mafia-submit-action"
                  aria-busy={submittingTarget ? "true" : "false"}
                  className="min-h-12 rounded-xl bg-rose-600 px-4 text-sm font-black text-white shadow-lg shadow-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {submitButtonLabel}
                </button>
              </div>
              {!canSubmitTarget && submitDisabledReason && (
                <div className="mt-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-500">
                  {submitDisabledReason}
                </div>
              )}
            </div>
          ) : (
            <div className={`mt-3 rounded-xl px-3 py-2 text-sm font-black ${myAlive ? "bg-slate-50 text-slate-600" : "bg-zinc-100 text-zinc-500"}`}>
              {phase === "FINISHED" ? `${winnerTeam === "MAFIA" ? "마피아팀" : "시민팀"} 승리` : myAlive ? "현재 단계에서 내가 제출할 행동은 없습니다." : "탈락 상태로 관전 중입니다."}
            </div>
          )}

          {investigation && (
            <div className={`mt-3 rounded-xl px-3 py-2 text-sm font-black ${get(investigation, "mafia", "mafia", false) ? "bg-rose-50 text-rose-700" : "bg-sky-50 text-sky-700"}`}>
              경찰 조사: {playerNameBySeat(get(investigation, "target_seat_no", "targetSeatNo", 0))}님은 {get(investigation, "mafia", "mafia", false) ? "마피아입니다." : "마피아가 아닙니다."}
            </div>
          )}

          {(lastNightResult || lastTrialResult) && phase !== "FINISHED" && (
            <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold leading-relaxed text-slate-600">
              {get(lastTrialResult, "message", "message", "") || get(lastNightResult, "message", "message", "")}
            </div>
          )}

        </section>
      </main>

      <aside id="mafia-players-panel" className="scroll-mt-24 space-y-4">
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
          <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
            <Users className="h-4 w-4 text-slate-600" />
            참가자
          </div>
          <div className="space-y-2">
            {mafiaPlayers.map((player) => {
              const seatNo = Number(get(player, "seat_no", "seatNo", 0));
              const alive = Boolean(get(player, "alive", "alive", true));
              const role = String(get(player, "role", "role", "") || get(player, "revealed_role", "revealedRole", "") || "");
              const levelMeta = playerLevelMetaBySeat(seatNo);
              return (
                <div key={seatNo} className={`rounded-xl border px-3 py-2 ${alive ? "border-slate-100 bg-slate-50" : "border-zinc-200 bg-zinc-100 opacity-75"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <UserAvatar
                        name={playerNameBySeat(seatNo)}
                        profileUrl={playerProfileBySeat(seatNo)}
                        level={levelMeta.level}
                        rewardTier={levelMeta.rewardTier}
                        frameCode={levelMeta.frameCode}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-slate-900">{playerNameBySeat(seatNo)}</div>
                        <div className="text-[11px] font-bold text-slate-500">좌석 {seatNo} · {alive ? "생존" : "탈락"}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(completedSeatNos.has(seatNo) || votedSeatNos.has(seatNo)) && <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700">완료</span>}
                      {role && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 py-1 pl-1 pr-2 text-[10px] font-black text-white">
                          <MafiaRoleSigil role={role} className="h-5 w-5 shrink-0" />
                          {mafiaRoleLabels[role] || role}
                        </span>
                      )}
                    </div>
                  </div>
                  {phase === "TRIAL_RESULT" && Object.prototype.hasOwnProperty.call(voteCounts, seatNo) && (
                    <div className="mt-2 rounded-lg bg-white px-2 py-1 text-[11px] font-black text-slate-600">득표 {voteCounts[seatNo]}표</div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg">
          <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
            <Gavel className="h-4 w-4 text-amber-600" />
            사회자 로그
          </div>
          <div className="max-h-80 space-y-2 overflow-auto pr-1">
            {[...events].slice(-8).reverse().map((event) => (
              <div key={get(event, "event_no", "eventNo", "")} className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold leading-relaxed text-slate-600">
                {get(event, "message", "message", get(event, "event_type", "eventType", ""))}
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
};

export { MafiaBoard };
export default MafiaBoard;
