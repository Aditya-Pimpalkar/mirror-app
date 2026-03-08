export const PERSONAS = {
  recruiter: { id: "recruiter", name: "Rachel", role: "Senior Recruiter", domain: "Career", emoji: "💼", color: "#D4A853", bg: "rgba(212,168,83,0.08)", border: "rgba(212,168,83,0.2)" },
  date:      { id: "date",      name: "Alex",   role: "First Date",       domain: "Relationships", emoji: "🥂", color: "#E87070", bg: "rgba(232,112,112,0.08)", border: "rgba(232,112,112,0.2)" },
  competitor:{ id: "competitor",name: "Chris",  role: "Direct Competitor",domain: "Industry", emoji: "⚔️", color: "#6BA3D6", bg: "rgba(107,163,214,0.08)", border: "rgba(107,163,214,0.2)" },
  journalist:{ id: "journalist",name: "Jordan", role: "Journalist",       domain: "Public Image", emoji: "🗞️", color: "#7DC98F", bg: "rgba(125,201,143,0.08)", border: "rgba(125,201,143,0.2)" },
};

export function BeliefBar({ value, color, showLabels = true }) {
  return (
    <div>
      {showLabels && (
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.25em", color: "rgba(255,255,255,0.18)", textTransform: "uppercase" }}>SKEPTICAL</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.25em", color: "rgba(255,255,255,0.18)", textTransform: "uppercase" }}>CONVINCED</span>
        </div>
      )}
      <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value}%`, background: `linear-gradient(90deg, ${color}55, ${color})`, borderRadius: 2, transition: "width 1s cubic-bezier(0.4,0,0.2,1)", boxShadow: `0 0 8px ${color}44` }} />
      </div>
    </div>
  );
}

export function GapRing({ score, size = 140 }) {
  const r = (size / 2) - 10;
  const circumference = 2 * Math.PI * r;
  const filled = circumference * ((100 - score) / 100);
  const color = score < 30 ? "#7DC98F" : score < 60 ? "#D4A853" : "#E87070";
  return (
    <div style={{ position: "relative", width: size, height: size, margin: "0 auto" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${filled} ${circumference}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1.5s cubic-bezier(0.4,0,0.2,1)", filter: `drop-shadow(0 0 8px ${color}66)` }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: size * 0.22, fontWeight: 800, color, fontFamily: "var(--font-display)", lineHeight: 1 }}>{score}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.25em", color: "rgba(255,255,255,0.18)", marginTop: 4, textTransform: "uppercase" }}>GAP</div>
      </div>
    </div>
  );
}

export function PersonaAvatar({ persona, size = 44, pulse = false }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: persona.bg, border: `1px solid ${pulse ? persona.color : persona.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.4, flexShrink: 0, boxShadow: pulse ? `0 0 12px ${persona.color}44` : "none", transition: "all 0.3s" }}>
      {persona.emoji}
    </div>
  );
}

export function PrimaryButton({ children, onClick, disabled, style = {}, variant = "gold" }) {
  const variants = {
    gold:  { background: "#D4A853", color: "#070707", border: "none" },
    ghost: { background: "transparent", color: "#D4A853", border: "1px solid rgba(212,168,83,0.35)" },
    dark:  { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ width: "100%", padding: "14px 24px", borderRadius: 100, fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 12, letterSpacing: "0.15em", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1, transition: "opacity 0.2s", ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

export function LoadingDots({ color = "var(--gold)" }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: color, animation: `pulse 1.4s ${i * 0.15}s infinite` }} />
      ))}
    </div>
  );
}

export function ScreenHeader({ title, subtitle, onBack, action }) {
  return (
    <div style={{ padding: "16px 24px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {onBack && <button onClick={onBack} style={{ color: "var(--text-muted)", fontSize: 20, lineHeight: 1 }}>←</button>}
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{title}</div>
          {subtitle && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.25em", color: "rgba(255,255,255,0.18)", textTransform: "uppercase", marginTop: 2 }}>{subtitle}</div>}
        </div>
      </div>
      {action}
    </div>
  );
}
