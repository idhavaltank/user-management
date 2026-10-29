import { alpha } from '@mui/material/styles';

/**
 * FlowSync's warm CRM palette. The raw brand values stay centralized here so
 * components can use MUI semantic roles instead of hard-coded hex values.
 */
export const FLOWSYNC_COLORS = {
  espresso: '#6D3B07',
  mocha: '#6F4E37',
  spice: '#D47E30',
  cream: '#F5F5DC',
  ink: '#24170F',
  surface: '#FFFDF7',
  line: '#E4D8C8',
} as const;

const GREY = {
  0: '#FFFFFF',
  100: '#FBF8F1',
  200: '#F2EDE3',
  300: '#E4D8C8',
  400: '#C9B9A7',
  500: '#9B8A7B',
  600: '#806F61',
  700: '#5E4D40',
  800: FLOWSYNC_COLORS.ink,
  900: '#1B1009',
};

const PRIMARY = {
  lighter: '#F2D4B3',
  light: '#9B6332',
  main: FLOWSYNC_COLORS.espresso,
  dark: '#4C2504',
  darker: '#2F1500',
};

const SECONDARY = {
  lighter: '#EADFD5',
  light: '#997A62',
  main: FLOWSYNC_COLORS.mocha,
  dark: '#523525',
  darker: '#321D12',
};

const INFO = {
  lighter: '#DCECEF',
  light: '#74AAB3',
  main: '#397A84',
  dark: '#245862',
  darker: '#12383F',
};

const SUCCESS = {
  lighter: '#E6EEDC',
  light: '#82A66A',
  main: '#4A6B3A',
  dark: '#315027',
  darker: '#1C3317',
};

const WARNING = {
  lighter: '#FFF1DF',
  light: '#E9A15D',
  main: FLOWSYNC_COLORS.spice,
  dark: '#9A4E0E',
  darker: '#612B05',
};

const ERROR = {
  lighter: '#F8E1DC',
  light: '#D47A6D',
  main: '#A3382B',
  dark: '#76271F',
  darker: '#4B1712',
};

const palette = {
  common: { black: '#000000', white: '#FFFFFF' },
  primary: PRIMARY,
  secondary: SECONDARY,
  info: INFO,
  success: SUCCESS,
  warning: WARNING,
  error: ERROR,
  grey: GREY,
  divider: FLOWSYNC_COLORS.line,
  text: {
    primary: FLOWSYNC_COLORS.ink,
    secondary: FLOWSYNC_COLORS.mocha,
    disabled: GREY[500],
  },
  background: {
    paper: FLOWSYNC_COLORS.surface,
    default: FLOWSYNC_COLORS.cream,
    neutral: '#EFE9D9',
  },
  action: {
    active: GREY[700],
    hover: alpha(FLOWSYNC_COLORS.mocha, 0.08),
    selected: alpha(FLOWSYNC_COLORS.spice, 0.14),
    disabled: alpha(GREY[500], 0.8),
    disabledBackground: alpha(GREY[500], 0.24),
    focus: alpha(FLOWSYNC_COLORS.espresso, 0.22),
    hoverOpacity: 0.08,
    disabledOpacity: 0.48,
  },
} as const;

export default palette;
