// Bridge Design Tokens — single source of truth.
// Mirrors the prototype's BridgeTokens (prototype/theme.jsx).
// All raw values live here; consume via useTheme() (see ThemeProvider.tsx).

export const palette = {
  // Brand
  primary:        '#5B558E',
  primaryDeep:    '#454077',
  primarySoft:    '#736EA8',
  primaryHover:   '#8B85C1',
  primaryBgSoft:  '#E4DFFF',
  primaryBgWash:  '#F4F3FB',

  // Mint accent (positive / "calm")
  mint:           '#A8D8D0',
  mintDeep:       '#3D6B64',
  mintBgSoft:     '#B9E9E1',
  mintBgWash:     '#E8F3F0',

  // Background system
  bg:             '#FAF8FF',
  bgAlt:          '#F4F3FB',
  surface:        '#FFFFFF',
  surfaceAlt:     '#FAFBFC',

  // Text
  textHeading:    '#1A1B21',
  textBody:       '#47464F',
  textCaption:    '#787680',
  textMuted:      '#94A3B8',
  textInverse:    '#FFFFFF',

  // Borders
  border:         '#E2E1E9',
  borderSubtle:   '#EEEDF5',
  borderStrong:   '#C9C5D0',
  divider:        '#E6E4F2',

  // Status
  success:        '#3D6B64',
  danger:         '#C0524F',
  warning:        '#C8893F',
} as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 9999 } as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const fontFamily = {
  // Custom fonts — place in assets/fonts/ and uncomment useFonts in App.tsx
  // If fonts are not loaded, React Native falls back to system font gracefully.
  kr:      'System',
  krBold:  'System',
  en:      'System',
  enBold:  'System',
  display: 'System',
} as const;

export const typography = {
  // Marketing/display
  display:   { fontFamily: fontFamily.display, fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5, lineHeight: 36 },
  h1:        { fontFamily: fontFamily.krBold,  fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.5, lineHeight: 32 },
  h2:        { fontFamily: fontFamily.krBold,  fontSize: 20, fontWeight: '700' as const, lineHeight: 28 },
  h3:        { fontFamily: fontFamily.krBold,  fontSize: 17, fontWeight: '700' as const, lineHeight: 24 },
  body:      { fontFamily: fontFamily.kr,      fontSize: 14, fontWeight: '400' as const, lineHeight: 22 },
  bodyBold:  { fontFamily: fontFamily.krBold,  fontSize: 14, fontWeight: '600' as const, lineHeight: 22 },
  caption:   { fontFamily: fontFamily.kr,      fontSize: 12, fontWeight: '400' as const, lineHeight: 18 },
  captionBold:{fontFamily: fontFamily.krBold,  fontSize: 12, fontWeight: '600' as const, lineHeight: 18 },
  // EN/numeric
  enLabel:   { fontFamily: fontFamily.enBold,  fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.5 },
  numeric:   { fontFamily: fontFamily.enBold,  fontSize: 22, fontWeight: '800' as const },
} as const;

export const shadow = {
  card:   { shadowColor: '#5B558E', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardLg: { shadowColor: '#5B558E', shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  fab:    { shadowColor: '#5B558E', shadowOpacity: 0.32, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
} as const;

// Mood meta — 5단계 mood_score 척도 (도메인 정의)
// mood_score 1 (매우 나쁨) ~ 5 (매우 좋음). emotion_keywords 8개와는 독립 모델.
export const moodMeta = {
  verybad:  { id: 'verybad',  label: '매우 나쁨', color: palette.danger,      bg: '#FBE9E9',          emoji: '😭' },
  bad:      { id: 'bad',      label: '나쁨',     color: palette.warning,     bg: '#FBF1E4',          emoji: '😢' },
  normal:   { id: 'normal',   label: '보통',     color: palette.textCaption, bg: '#F0EFF5',          emoji: '😐' },
  good:     { id: 'good',     label: '좋음',     color: palette.success,     bg: palette.mintBgSoft, emoji: '🙂' },
  verygood: { id: 'verygood', label: '매우 좋음', color: palette.mintDeep,    bg: palette.mintBgWash, emoji: '😊' },
} as const;
export type MoodId = keyof typeof moodMeta;

export const theme = { palette, radius, spacing, fontFamily, typography, shadow, moodMeta } as const;
export type Theme = typeof theme;
