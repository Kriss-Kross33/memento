/**
 * Theme tokens. `lightColors` and `darkColors` share the same shape
 * (ThemeColors). The default export is the static light palette, kept for
 * surfaces that are intentionally theme-independent (camera chrome, the
 * full-screen image viewer) — those never flip with the app theme.
 */
export interface ThemeColors {
  primary: string;
  primaryLight: string;
  primaryMuted: string;

  background: string;
  surface: string;
  surfaceSecondary: string;

  text: string;
  textSecondary: string;
  textTertiary: string;

  border: string;
  borderLight: string;

  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  error: string;
  errorLight: string;

  expense: string;
  expenseLight: string;
  income: string;
  incomeLight: string;

  slate: { 50: string; 100: string; 200: string; 300: string; 400: string; 500: string; 600: string; 700: string; 800: string; 900: string };
  zinc: { 50: string; 100: string; 200: string; 300: string; 400: string; 500: string; 600: string; 700: string; 800: string; 900: string };
}

export const lightColors: ThemeColors = {
  primary: '#0D9488',
  primaryLight: '#14B8A6',
  primaryMuted: '#99F6E4',

  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceSecondary: '#F4F4F5',

  text: '#18181B',
  textSecondary: '#71717A',
  textTertiary: '#A1A1AA',

  border: '#E4E4E7',
  borderLight: '#F4F4F5',

  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  errorLight: '#FEE2E2',

  expense: '#DC2626',
  expenseLight: '#FEE2E2',
  income: '#059669',
  incomeLight: '#D1FAE5',

  slate: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },

  zinc: {
    50: '#FAFAFA',
    100: '#F4F4F5',
    200: '#E4E4E7',
    300: '#D4D4D8',
    400: '#A1A1AA',
    500: '#71717A',
    600: '#52525B',
    700: '#3F3F46',
    800: '#27272A',
    900: '#18181B',
  },
};

/** Deep, warm-dark palette with a subtle green cast — keeps the teal brand readable. */
export const darkColors: ThemeColors = {
  primary: '#2DD4BF',
  primaryLight: '#5EEAD4',
  primaryMuted: '#134E4A',

  background: '#0C0E0D',
  surface: '#151817',
  surfaceSecondary: '#1E2221',

  text: '#F2F4F3',
  textSecondary: '#9BA3A0',
  textTertiary: '#66706B',

  border: '#2A2F2D',
  borderLight: '#1F2322',

  success: '#34D399',
  successLight: '#064E3B',
  warning: '#FBBF24',
  warningLight: '#451A03',
  error: '#F87171',
  errorLight: '#7F1D1D',

  expense: '#F87171',
  expenseLight: '#7F1D1D',
  income: '#34D399',
  incomeLight: '#064E3B',

  slate: lightColors.slate,
  zinc: lightColors.zinc,
};

export default lightColors;
