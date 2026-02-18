/**
 * Adaptive Theme System
 * Derives a complete UI theme from a small set of base colors.
 */

export interface ThemePreset {
  name: string;
  bg: string;
  fg: string;
  accent: string;
}

export interface Theme {
  isDark: boolean;
  isCyberpunk: boolean;
  bg: {
    primary: string;
    secondary: string;
    tertiary: string;
    input: string;
    hover: string;
    selection: string;
    elevated: string;
  };
  accent: {
    pink: string;
    cyan: string;
    yellow: string;
    blue: string;
    primary: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
  };
  border: {
    default: string;
    subtle: string;
    input: string;
  };
  status: {
    error: string;
    warning: string;
    success: string;
  };
  scrollbar: {
    thumb: string;
    thumbHover: string;
  };
}

// Curated theme presets
export const THEME_PRESETS: ThemePreset[] = [
  // Cyberpunk / Neon - 2077 uses exact original colors
  { name: 'Cyberpunk 2077', bg: '#030d22', fg: '#fdfeff', accent: '#0ef3ff' },
  { name: 'Synthwave 84', bg: '#262335', fg: '#e0def4', accent: '#ff7edb' },
  { name: 'Laserwave', bg: '#27212e', fg: '#ffffff', accent: '#40b4c4' },

  // Dark favorites
  { name: 'Dracula', bg: '#282A36', fg: '#F8F8F2', accent: '#BD93F9' },
  { name: 'Tokyo Night', bg: '#1a1b26', fg: '#a9b1d6', accent: '#7aa2f7' },
  { name: 'Nord', bg: '#2e3440', fg: '#d8dee9', accent: '#81a1c1' },
  { name: 'One Dark Pro', bg: '#282c34', fg: '#abb2bf', accent: '#4aa5f0' },
  { name: 'Night Owl', bg: '#011627', fg: '#d6deeb', accent: '#82AAFF' },
  { name: 'Monokai', bg: '#272822', fg: '#f8f8f2', accent: '#66d9ef' },

  // Catppuccin family
  { name: 'Catppuccin Mocha', bg: '#1e1e2e', fg: '#cdd6f4', accent: '#89b4fa' },
  { name: 'Catppuccin Macchiato', bg: '#24273a', fg: '#cad3f5', accent: '#8aadf4' },
  { name: 'Catppuccin Frappé', bg: '#303446', fg: '#c6d0f5', accent: '#8caaee' },

  // Rose Pine family
  { name: 'Rosé Pine', bg: '#191724', fg: '#e0def4', accent: '#9ccfd8' },
  { name: 'Rosé Pine Moon', bg: '#232136', fg: '#e0def4', accent: '#9ccfd8' },

  // GitHub
  { name: 'GitHub Dark', bg: '#0d1117', fg: '#e6edf3', accent: '#58a6ff' },
  { name: 'GitHub Dark Dimmed', bg: '#22272e', fg: '#adbac7', accent: '#539bf5' },

  // Material
  { name: 'Material Ocean', bg: '#0F111A', fg: '#babed8', accent: '#82AAFF' },
  { name: 'Material Palenight', bg: '#292D3E', fg: '#babed8', accent: '#82AAFF' },

  // Gruvbox
  { name: 'Gruvbox Dark', bg: '#282828', fg: '#ebdbb2', accent: '#83a598' },

  // Minimalist
  { name: 'Poimandres', bg: '#1b1e28', fg: '#a6accd', accent: '#89ddff' },
  { name: 'Vesper', bg: '#101010', fg: '#ffffff', accent: '#ffc799' },
  { name: 'Houston', bg: '#17191e', fg: '#eef0f9', accent: '#2b7eca' },

  // Light themes
  { name: 'GitHub Light', bg: '#ffffff', fg: '#1f2328', accent: '#0969da' },
  { name: 'Catppuccin Latte', bg: '#eff1f5', fg: '#4c4f69', accent: '#1e66f5' },
  { name: 'Rosé Pine Dawn', bg: '#faf4ed', fg: '#575279', accent: '#56949f' },
  { name: 'One Light', bg: '#FAFAFA', fg: '#383A42', accent: '#4078f2' },
  { name: 'Solarized Light', bg: '#FDF6E3', fg: '#657B83', accent: '#268bd2' },
];

// Color utilities
interface RGB {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1] ?? '80', 16),
        g: parseInt(result[2] ?? '80', 16),
        b: parseInt(result[3] ?? '80', 16),
      }
    : { r: 128, g: 128, b: 128 };
}

function rgbToHex({ r, g, b }: RGB): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[r, g, b].map((c) => clamp(c).toString(16).padStart(2, '0')).join('')}`;
}

function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const mapped = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const rs = mapped[0] ?? 0;
  const gs = mapped[1] ?? 0;
  const bs = mapped[2] ?? 0;
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function mix(hex1: string, hex2: string, factor: number): string {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  return rgbToHex({
    r: c1.r + (c2.r - c1.r) * factor,
    g: c1.g + (c2.g - c1.g) * factor,
    b: c1.b + (c2.b - c1.b) * factor,
  });
}

function adjust(hex: string, amount: number): string {
  const target = amount > 0 ? '#ffffff' : '#000000';
  return mix(hex, target, Math.abs(amount));
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = luminance(hex1);
  const l2 = luminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function ensureContrast(bg: string, fg: string, startFactor: number, minRatio: number): string {
  let factor = startFactor;
  while (factor <= 1.0) {
    const color = mix(bg, fg, factor);
    if (contrastRatio(color, bg) >= minRatio) return color;
    factor += 0.05;
  }
  return fg;
}

function overlay(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Derive accent colors from a single accent
function deriveAccents(accent: string, isDark: boolean) {
  const hsl = hexToHsl(accent);

  return {
    primary: accent,
    cyan: hslToHex({ h: 185, s: Math.min(hsl.s + 10, 100), l: isDark ? 55 : 45 }),
    pink: hslToHex({ h: 330, s: Math.min(hsl.s + 10, 100), l: isDark ? 55 : 45 }),
    yellow: hslToHex({ h: 50, s: Math.min(hsl.s + 10, 100), l: isDark ? 55 : 45 }),
    blue: hslToHex({ h: 210, s: Math.min(hsl.s + 10, 100), l: isDark ? 55 : 45 }),
  };
}

interface HSL {
  h: number;
  s: number;
  l: number;
}

function hexToHsl(hex: string): HSL {
  const { r, g, b } = hexToRgb(hex);
  const rNorm = r / 255,
    gNorm = g / 255,
    bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm),
    min = Math.min(rNorm, gNorm, bNorm);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l: l * 100 };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  if (max === rNorm) h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6;
  else if (max === gNorm) h = ((bNorm - rNorm) / d + 2) / 6;
  else h = ((rNorm - gNorm) / d + 4) / 6;

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex({ h, s, l }: HSL): string {
  const sNorm = s / 100,
    lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  return rgbToHex({
    r: (r + m) * 255,
    g: (g + m) * 255,
    b: (b + m) * 255,
  });
}

/**
 * Create a complete theme from base colors
 */
function createTheme(bg: string, fg: string, accent: string): Theme {
  const isDark = luminance(bg) < 0.5;
  const dir = isDark ? 1 : -1;

  const accents = deriveAccents(accent, isDark);

  const elevate = (amount: number) => adjust(bg, dir * amount);
  const mutedText = ensureContrast(bg, fg, isDark ? 0.55 : 0.5, 4.5);
  const secondaryText = mix(bg, fg, isDark ? 0.7 : 0.6);

  return {
    isDark,
    isCyberpunk: false,
    bg: {
      primary: bg,
      secondary: elevate(0.03),
      tertiary: elevate(0.06),
      input: elevate(0.08),
      hover: elevate(0.1),
      selection: mix(bg, accent, 0.2),
      elevated: elevate(0.05),
    },
    accent: accents,
    text: {
      primary: fg,
      secondary: secondaryText,
      muted: mutedText,
    },
    border: {
      default: mix(bg, fg, isDark ? 0.12 : 0.15),
      subtle: mix(bg, fg, isDark ? 0.06 : 0.08),
      input: mix(bg, fg, isDark ? 0.15 : 0.18),
    },
    status: {
      error: isDark ? '#f87171' : '#dc2626',
      warning: isDark ? '#fad46d' : '#ca8a04',
      success: isDark ? '#4ade80' : '#16a34a',
    },
    scrollbar: {
      thumb: overlay(accent, 0.35),
      thumbHover: overlay(accent, 0.6),
    },
  };
}

/**
 * Apply theme to CSS custom properties
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;

  root.style.setProperty('--bg-primary', theme.bg.primary);
  root.style.setProperty('--bg-secondary', theme.bg.secondary);
  root.style.setProperty('--bg-tertiary', theme.bg.tertiary);
  root.style.setProperty('--bg-input', theme.bg.input);
  root.style.setProperty('--bg-hover', theme.bg.hover);
  root.style.setProperty('--bg-selection', theme.bg.selection);
  root.style.setProperty('--bg-elevated', theme.bg.elevated);
  root.style.setProperty('--bg-active', theme.bg.tertiary);

  root.style.setProperty('--accent-pink', theme.accent.pink);
  root.style.setProperty('--accent-cyan', theme.accent.cyan);
  root.style.setProperty('--accent-yellow', theme.accent.yellow);
  root.style.setProperty('--accent-blue', theme.accent.blue);
  root.style.setProperty('--accent-green', theme.status.success);
  root.style.setProperty('--accent-primary', theme.accent.primary);
  root.style.setProperty('--accent-magenta', theme.accent.pink);

  root.style.setProperty('--text-primary', theme.text.primary);
  root.style.setProperty('--text-secondary', theme.text.secondary);
  root.style.setProperty('--text-muted', theme.text.muted);

  root.style.setProperty('--border', theme.border.default);
  root.style.setProperty('--border-subtle', theme.border.subtle);
  root.style.setProperty('--border-input', theme.border.input);
  root.style.setProperty('--border-accent', `${theme.accent.primary}33`);

  root.style.setProperty('--error', theme.status.error);
  root.style.setProperty('--warning', theme.status.warning);
  root.style.setProperty('--success', theme.status.success);

  root.style.setProperty('--scrollbar', theme.scrollbar.thumb);
  root.style.setProperty('--scrollbar-hover', theme.scrollbar.thumbHover);

  root.classList.toggle('dark', theme.isDark);
  root.classList.toggle('light', !theme.isDark);
  root.classList.toggle('theme-cyberpunk', theme.isCyberpunk);
}

const STORAGE_KEY = 'amp-theme';
const DEFAULT_THEME = 'Cyberpunk 2077';

export function saveTheme(themeName: string): void {
  localStorage.setItem(STORAGE_KEY, themeName);
}

export function loadSavedTheme(): string {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
}

export function getPresetByName(name: string): ThemePreset | undefined {
  return THEME_PRESETS.find((p) => p.name === name);
}

/**
 * Get the original hardcoded Cyberpunk 2077 theme
 * This preserves the exact colors from the original variables.css
 */
function getCyberpunk2077Theme(): Theme {
  return {
    isDark: true,
    isCyberpunk: true,
    bg: {
      primary: '#030d22',
      secondary: '#04112c',
      tertiary: '#0d0931',
      input: '#150f53',
      hover: '#0a2f66',
      selection: '#073170',
      elevated: '#081a3a',
    },
    accent: {
      pink: '#ff2592',
      cyan: '#0ef3ff',
      yellow: '#ffd400',
      blue: '#47a1fa',
      primary: '#0ef3ff',
    },
    text: {
      primary: '#fdfeff',
      secondary: '#6b9eff',
      muted: '#6b9eff',
    },
    border: {
      default: '#1a1845',
      subtle: '#0f0d2a',
      input: '#1f1a5a',
    },
    status: {
      error: '#f87171',
      warning: '#fad46d',
      success: '#4ade80',
    },
    scrollbar: {
      thumb: '#fc309654',
      thumbHover: '#ee0077',
    },
  };
}

/**
 * Get theme - uses hardcoded values for Cyberpunk 2077, generates for others
 */
export function getThemeForPreset(preset: ThemePreset): Theme {
  if (preset.name === 'Cyberpunk 2077') {
    return getCyberpunk2077Theme();
  }
  return createTheme(preset.bg, preset.fg, preset.accent);
}
