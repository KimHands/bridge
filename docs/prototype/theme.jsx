// Bridge Design Tokens — single source of truth for the prototype
// Mirrors what should land in tokens.ts in the React Native handoff
const BridgeTokens = {
  color: {
    // Brand
    primary:        "#5B558E",
    primaryDeep:    "#454077",
    primarySoft:    "#736EA8",
    primaryHover:   "#8B85C1",
    primaryBgSoft:  "#E4DFFF",
    primaryBgWash:  "#F4F3FB",

    // Mint accent (positive / "calm")
    mint:           "#A8D8D0",
    mintDeep:       "#3D6B64",
    mintBgSoft:     "#B9E9E1",
    mintBgWash:     "#E8F3F0",

    // Background system
    bg:             "#FAF8FF",
    bgAlt:          "#F4F3FB",
    surface:        "#FFFFFF",
    surfaceAlt:     "#FAFBFC",

    // Text
    textHeading:    "#1A1B21",
    textBody:       "#47464F",
    textCaption:    "#787680",
    textMuted:      "#94A3B8",
    textInverse:    "#FFFFFF",

    // Borders
    border:         "#E2E1E9",
    borderSubtle:   "#EEEDF5",
    borderStrong:   "#C9C5D0",
    divider:        "#E6E4F2",

    // Status
    success:        "#3D6B64",
    danger:         "#C0524F",
    warning:        "#C8893F",

    // Shadow
    shadowCard:     "0 4px 12px rgba(91,85,142,0.08)",
    shadowCardLg:   "0 8px 24px rgba(91,85,142,0.12)",
    shadowFab:      "0 8px 20px rgba(91,85,142,0.32)",
  },
  radius: {
    sm: 8, md: 12, lg: 16, xl: 24, pill: 9999,
  },
  spacing: {
    xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48,
  },
  type: {
    // We use system stack as Pretendard fallback (loaded from Google Fonts in HTML)
    fontKr: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, "Apple SD Gothic Neo", sans-serif',
    fontEn: '"Manrope", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
    fontDisplay: '"Plus Jakarta Sans", "Pretendard Variable", system-ui, sans-serif',
  },
  // Mood meta — used by diary keyword screen, also drives light bg color
  mood: {
    1: { label: "화남",  color: "#C0524F", bg: "#FBE9E9" },
    2: { label: "우울",  color: "#5B558E", bg: "#E4DFFF" },
    3: { label: "불안",  color: "#8B85C1", bg: "#EEEAFC" },
    4: { label: "평범",  color: "#787680", bg: "#F0EFF5" },
    5: { label: "좋음",  color: "#3D6B64", bg: "#B9E9E1" },
  },
};

window.BridgeTokens = BridgeTokens;

// ─────────────────────────────────────────────────────────────────
// Atomic primitives — every screen composes from these
// ─────────────────────────────────────────────────────────────────
const T = BridgeTokens;

function Screen({ children, scroll = true, bg, style }) {
  return (
    <div style={{
      width: 390, height: 844,
      background: bg || T.color.bg,
      fontFamily: T.type.fontKr,
      color: T.color.textBody,
      overflow: scroll ? "auto" : "hidden",
      position: "relative",
      ...style,
    }}>
      {children}
    </div>
  );
}

function TopBar({ title, leading, trailing, transparent }) {
  return (
    <div style={{
      height: 56, paddingLeft: 16, paddingRight: 16,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: transparent ? "transparent" : T.color.bg,
      position: "sticky", top: 0, zIndex: 10,
    }}>
      <div style={{ width: 40, display: "flex", alignItems: "center" }}>{leading}</div>
      <div style={{
        flex: 1, textAlign: "center",
        fontFamily: T.type.fontDisplay, fontWeight: 700,
        fontSize: 18, color: T.color.primary, letterSpacing: -0.2,
      }}>{title}</div>
      <div style={{ width: 40, display: "flex", justifyContent: "flex-end", alignItems: "center" }}>{trailing}</div>
    </div>
  );
}

function BackBtn({ onClick }) {
  return (
    <button onClick={onClick} style={{
      width: 32, height: 32, border: "none", background: "transparent",
      color: T.color.primary, cursor: "pointer", padding: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M14 5L8 11L14 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}

function PrimaryButton({ children, onClick, disabled, full = true, variant = "primary", size = "lg", style }) {
  const variants = {
    primary: { bg: T.color.primary, color: "#fff" },
    soft:    { bg: T.color.primaryBgSoft, color: T.color.primary },
    ghost:   { bg: "transparent", color: T.color.primary },
    mint:    { bg: T.color.mintDeep, color: "#fff" },
    outline: { bg: "transparent", color: T.color.primary, border: `1px solid ${T.color.primary}` },
  }[variant];
  const sizes = { sm: { h: 36, fs: 13 }, md: { h: 44, fs: 14 }, lg: { h: 56, fs: 16 } }[size];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: full ? "100%" : "auto",
      height: sizes.h,
      borderRadius: T.radius.xl,
      border: variants.border || "none",
      background: disabled ? T.color.borderStrong : variants.bg,
      color: variants.color,
      fontSize: sizes.fs, fontWeight: 600,
      fontFamily: T.type.fontKr,
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "all 120ms ease",
      padding: "0 24px",
      ...style,
    }}>{children}</button>
  );
}

function Card({ children, style, padding = 20 }) {
  return (
    <div style={{
      background: T.color.surface,
      borderRadius: T.radius.lg,
      padding,
      boxShadow: T.color.shadowCard,
      ...style,
    }}>{children}</div>
  );
}

function TextField({ label, placeholder, type = "text", value, onChange, icon, rightSlot }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {label && (
        <div style={{
          fontSize: 13, fontWeight: 600, color: T.color.primary,
          fontFamily: T.type.fontEn,
        }}>{label}</div>
      )}
      <div style={{
        height: 52,
        background: T.color.primaryBgWash,
        borderRadius: T.radius.md,
        display: "flex", alignItems: "center",
        padding: "0 16px",
        gap: 10,
      }}>
        {icon && <div style={{ color: T.color.textMuted, display: "flex" }}>{icon}</div>}
        <input
          type={type} placeholder={placeholder}
          value={value || ""} onChange={(e) => onChange?.(e.target.value)}
          style={{
            flex: 1, border: "none", outline: "none", background: "transparent",
            fontSize: 14, fontFamily: T.type.fontKr, color: T.color.textHeading,
          }}
        />
        {rightSlot}
      </div>
    </div>
  );
}

function Divider({ vertical, style }) {
  return (
    <div style={{
      background: T.color.divider,
      height: vertical ? "100%" : 1,
      width: vertical ? 1 : "100%",
      ...style,
    }} />
  );
}

function Pill({ children, color, bg, style }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      height: 22, padding: "0 10px",
      borderRadius: T.radius.pill,
      fontSize: 11, fontWeight: 600,
      background: bg || T.color.primaryBgSoft,
      color: color || T.color.primary,
      fontFamily: T.type.fontKr,
      ...style,
    }}>{children}</span>
  );
}

// Bottom tab navigation — 5 tabs as in mypage screen
function BottomTabBar({ active, onChange }) {
  const tabs = [
    { key: "home",     label: "홈" },
    { key: "routine",  label: "루틴" },
    { key: "diary",    label: "기록" },
    { key: "report",   label: "리포트" },
    { key: "my",       label: "마이" },
  ];
  return (
    <div style={{
      position: "absolute", bottom: 0, left: 0, right: 0,
      height: 76,
      background: "rgba(255,255,255,0.96)",
      backdropFilter: "blur(8px)",
      borderTop: `1px solid ${T.color.borderSubtle}`,
      display: "flex",
      paddingBottom: 12,
      zIndex: 5,
    }}>
      {tabs.map(t => {
        const isActive = active === t.key;
        return (
          <button key={t.key} onClick={() => onChange?.(t.key)} style={{
            flex: 1, border: "none", background: "transparent",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 4, cursor: "pointer", padding: 0,
            color: isActive ? T.color.primary : T.color.textMuted,
          }}>
            <TabIcon kind={t.key} active={isActive} />
            <div style={{
              fontSize: 11, fontWeight: isActive ? 700 : 500,
              fontFamily: T.type.fontKr,
            }}>{t.label}</div>
          </button>
        );
      })}
    </div>
  );
}

function TabIcon({ kind, active }) {
  const stroke = active ? T.color.primary : T.color.textMuted;
  const fill = active ? T.color.primaryBgSoft : "none";
  const props = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (kind) {
    case "home":
      return <svg {...props}><path d="M3 12L12 4L21 12V20a1 1 0 0 1-1 1h-5v-7h-4v7H4a1 1 0 0 1-1-1V12Z" fill={fill}/></svg>;
    case "routine":
      return <svg {...props}><rect x="4" y="4" width="16" height="16" rx="3" fill={fill}/><path d="M9 10h6M9 14h6M9 18h4"/></svg>;
    case "diary":
      return <svg {...props}><path d="M6 4h10a2 2 0 0 1 2 2v14l-4-2-4 2-4-2V6a2 2 0 0 1 2-2Z" fill={fill}/></svg>;
    case "report":
      return <svg {...props}><path d="M5 19V10M10 19V5M15 19V13M20 19V8" /></svg>;
    case "my":
      return <svg {...props}><circle cx="12" cy="8" r="4" fill={fill}/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>;
    default: return null;
  }
}

// Standard "blob" decorative bg used in onboarding/auth screens
function DecorativeBlobs() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div style={{
        position: "absolute", left: -60, top: -120, width: 240, height: 320,
        borderRadius: 9999, background: "rgba(228,223,255,0.55)", filter: "blur(20px)",
      }}/>
      <div style={{
        position: "absolute", right: -80, top: 60, width: 280, height: 280,
        borderRadius: 9999, background: "rgba(228,223,255,0.45)", filter: "blur(20px)",
      }}/>
      <div style={{
        position: "absolute", left: -40, bottom: 80, width: 220, height: 280,
        borderRadius: 9999, background: "rgba(168,216,208,0.30)", filter: "blur(20px)",
      }}/>
    </div>
  );
}

Object.assign(window, { Screen, TopBar, BackBtn, PrimaryButton, Card, TextField, Divider, Pill, BottomTabBar, TabIcon, DecorativeBlobs });
