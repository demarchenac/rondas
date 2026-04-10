type TabPalette = {
  active: string;
  inactive: string;
  background: string;
  border: string;
};

const _TAB_COLORS: { light: TabPalette; dark: TabPalette } = {
  light: {
    active: '#0a7ea4',
    inactive: '#94a3b8',
    background: '#fafbfc',
    border: '#e2e8f0',
  },
  dark: {
    active: '#38bdf8',
    inactive: '#8b9cc0',
    background: '#121a2e',
    border: '#263354',
  },
};

/** Static color values for non-NativeWind contexts (tab bar, icon tints) */
export const TAB_COLORS: Record<string, TabPalette> = new Proxy(_TAB_COLORS, {
  get(target, key: string | symbol) {
    if (key === 'dark') return target.dark;
    return target.light;
  },
});

type IconPalette = {
  primary: string;
  primaryForeground: string;
  foreground: string;
  muted: string;
  mutedLight: string;
  destructive: string;
  pro: string;
  success: string;
  accent: string;
};

const _ICON_COLORS: { light: IconPalette; dark: IconPalette } = {
  light: {
    primary: '#0a7ea4',
    primaryForeground: '#ffffff',
    foreground: '#0f172a',
    muted: '#64748b',
    mutedLight: '#94a3b8',
    destructive: '#ef4444',
    pro: '#d97706',
    success: '#10b981',
    accent: '#6366f1',
  },
  dark: {
    primary: '#38bdf8',
    primaryForeground: '#0c1a2a',
    foreground: '#e8ecf4',
    muted: '#8b9cc0',
    mutedLight: '#7088aa',
    destructive: '#f87171',
    pro: '#f59e0b',
    success: '#34d399',
    accent: '#818cf8',
  },
};

/**
 * Accessible by any ColorSchemeName (incl. null/undefined/'unspecified').
 * Any scheme that isn't 'dark' falls back to light colors.
 */
export const ICON_COLORS: Record<string, IconPalette> = new Proxy(_ICON_COLORS, {
  get(target, key: string | symbol) {
    if (key === 'dark') return target.dark;
    return target.light;
  },
});
