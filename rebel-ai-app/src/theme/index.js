// Exact match with website CSS variables
export const Colors = {
  // Backgrounds — matches --dark-bg, --secondary-bg, --card-bg
  bg: '#121212',
  bgSecondary: '#1e1e1e',
  bgCard: '#252525',
  bgInput: '#2a2a2a',
  bgModal: 'rgba(0,0,0,0.85)',

  // Accents — matches --accent-purple, --accent-teal
  purple: '#8a2be2',
  teal: '#00ced1',
  purpleLight: '#a855f7',
  tealLight: '#22d3ee',
  purpleGlow: 'rgba(138,43,226,0.4)',
  tealGlow: 'rgba(0,206,209,0.35)',

  // Borders
  border: 'rgba(255,255,255,0.07)',
  borderPurple: 'rgba(138,43,226,0.4)',
  borderTeal: 'rgba(0,206,209,0.3)',

  // Text — matches --text-color, --text-secondary
  text: '#ffffff',
  textSecondary: '#b3b3b3',
  textMuted: '#666680',

  // Status
  error: '#ef4444',
  success: '#22c55e',

  white: '#ffffff',
};

// gradient matching --gradient-bg: linear-gradient(135deg, purple 0%, teal 100%)
export const Gradient = {
  start: '#8a2be2',
  end: '#00ced1',
  colors: ['#8a2be2', '#00ced1'],
  locations: [0, 1],
  angle: 135,
};

export const Fonts = {
  size: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 26,
    hero: 32,
  },
};

export const Radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  full: 999,
};

export const Shadow = {
  purple: {
    shadowColor: '#8a2be2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 12,
  },
  teal: {
    shadowColor: '#00ced1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
};
