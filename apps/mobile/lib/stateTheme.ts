export type ColorMode = 'light' | 'dark';
export type Intensity = 'low' | 'normal' | 'high';

export type GlowTheme = {
  glow: string;
  glowMid: string;
  glowSoft: string;
  glowOuter: string;
  badge: string;
  badgeBorder: string;
  shadowOpacity: number;
  shadowRadius: number;
  borderWidth: number;
  tintBg: string;
  highlightColor: string;
  highlightOpacity: number;
  cardBg: string;
};

const OPACITY_RECIPES: Record<ColorMode, {
  glow: number;
  glowMid: number;
  glowSoft: number;
  glowOuter: number;
  badge: number;
  badgeBorder: number;
  shadow: number;
  tintBg: number;
  highlightOpacity: number;
}> = {
  dark: {
    glow: 0.12,
    glowMid: 0.10,
    glowSoft: 0.04,
    glowOuter: 0.08,
    badge: 0.08,
    badgeBorder: 0.22,
    shadow: 0.18,
    tintBg: 0.04,
    highlightOpacity: 0.4,
  },
  light: {
    glow: 0.08,
    glowMid: 0.06,
    glowSoft: 0.02,
    glowOuter: 0.04,
    badge: 0.06,
    badgeBorder: 0.12,
    shadow: 0.08,
    tintBg: 0.03,
    highlightOpacity: 0.5,
  },
};

const INTENSITY_MULTIPLIERS: Record<Intensity, number> = {
  low: 0.5,
  normal: 1,
  high: 1.6,
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleanedHex = hex.replace('#', '');
  return {
    r: parseInt(cleanedHex.substring(0, 2), 16),
    g: parseInt(cleanedHex.substring(2, 4), 16),
    b: parseInt(cleanedHex.substring(4, 6), 16),
  };
}

function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha)).toFixed(3)})`;
}

export function buildGlowTheme(
  primaryHex: string,
  mode: ColorMode,
  intensity: Intensity,
): GlowTheme {
  const recipe = OPACITY_RECIPES[mode];
  const mult = INTENSITY_MULTIPLIERS[intensity];

  const shadowBase = { low: 10, normal: 14, high: 20 };
  const borderBase = { low: 1, normal: 1.5, high: 2 };

  return {
    glow: rgba(primaryHex, recipe.glow * mult),
    glowMid: rgba(primaryHex, recipe.glowMid * mult),
    glowSoft: rgba(primaryHex, recipe.glowSoft * mult),
    glowOuter: rgba(primaryHex, recipe.glowOuter * mult),
    badge: rgba(primaryHex, recipe.badge * mult),
    badgeBorder: rgba(primaryHex, recipe.badgeBorder * mult),
    shadowOpacity: intensity === 'low' ? 0 : recipe.shadow * mult,
    shadowRadius: shadowBase[intensity],
    borderWidth: borderBase[intensity],
    tintBg: rgba(primaryHex, recipe.tintBg * mult),
    highlightColor: mode === 'light' ? 'rgba(255, 255, 255, 0.7)' : rgba(primaryHex, recipe.glow * mult),
    highlightOpacity: recipe.highlightOpacity * (intensity === 'high' ? 1.4 : 1),
    cardBg: mode === 'dark' ? '#1a2540' : '#ffffff',
  };
}

