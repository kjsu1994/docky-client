export const NoThanksCardFace = ({ value = null, compact = false, className = "" }) => {
  const numeric = Number(value);
  const hasValue = Number.isFinite(numeric) && numeric > 0;
  const safeValue = hasValue ? Math.max(3, Math.min(35, numeric)) : null;
  const heat = hasValue ? Math.min(1, Math.max(0, (safeValue - 3) / 32)) : 0;
  const accent = heat > 0.66 ? "#f97316" : heat > 0.34 ? "#f59e0b" : "#22c55e";
  const cardLabel = hasValue ? `${safeValue}번 노땡스 카드` : "대기 중인 노땡스 카드";

  return (
    <svg viewBox="0 0 180 240" className={className} data-smoke="no-thanks-current-card-art" role="img" aria-label={cardLabel}>
      <defs>
        <linearGradient id={`no-thanks-card-${safeValue || "wait"}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={hasValue ? "#fff7ed" : "#f8fafc"} />
          <stop offset="100%" stopColor={hasValue ? "#fed7aa" : "#cbd5e1"} />
        </linearGradient>
      </defs>
      <rect x="24" y="26" width="132" height="198" rx="22" fill="#0f172a" opacity="0.14" />
      <rect x="20" y="18" width="140" height="210" rx="22" fill="#0f172a" opacity="0.08" />
      <rect x="16" y="10" width="148" height="220" rx="22" fill={`url(#no-thanks-card-${safeValue || "wait"})`} />
      <rect x="28" y="22" width="124" height="196" rx="16" fill="rgba(255,255,255,0.72)" stroke={accent} strokeWidth="4" />
      <path d="M42 56c22-16 76-16 98 0" fill="none" stroke={accent} strokeWidth="8" strokeLinecap="round" opacity="0.72" />
      <circle cx="45" cy="45" r="8" fill={accent} opacity="0.85" />
      <circle cx="135" cy="45" r="8" fill={accent} opacity="0.85" />
      <text x="90" y={compact ? 132 : 138} textAnchor="middle" fontSize={hasValue ? "72" : "58"} fontWeight="900" fill="#0f172a">
        {hasValue ? safeValue : "?"}
      </text>
      {!compact && (
        <>
          <text x="90" y="178" textAnchor="middle" fontSize="13" fontWeight="900" fill="#475569">노땡스</text>
          <text x="90" y="197" textAnchor="middle" fontSize="10" fontWeight="800" fill="#64748b">
            {hasValue ? "가져가거나 칩을 내고 넘기기" : "공개 카드 대기"}
          </text>
        </>
      )}
    </svg>
  );
};

export const NoThanksChipToken = ({ className = "", style, label = "노땡스 칩" }) => (
  <svg viewBox="0 0 64 64" className={className} style={style} data-smoke="no-thanks-chip-token" role="img" aria-label={label}>
    <defs>
      <radialGradient id="no-thanks-chip-gold" cx="35%" cy="28%" r="72%">
        <stop offset="0%" stopColor="#fef3c7" />
        <stop offset="55%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#b45309" />
      </radialGradient>
    </defs>
    <circle cx="32" cy="32" r="28" fill="url(#no-thanks-chip-gold)" stroke="#fde68a" strokeWidth="4" />
    <circle cx="32" cy="32" r="18" fill="rgba(255,255,255,0.38)" stroke="#fef3c7" strokeWidth="3" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
      <rect key={angle} x="30" y="4" width="4" height="10" rx="2" fill="#fff7ed" transform={`rotate(${angle} 32 32)`} opacity="0.82" />
    ))}
    <text x="32" y="37" textAnchor="middle" fontSize="12" fontWeight="900" fill="#7c2d12">칩</text>
  </svg>
);

export default NoThanksCardFace;
