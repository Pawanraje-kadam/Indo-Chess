/**
 * Indo Chess Design System
 * A comprehensive token system for consistent UI
 */

// Spacing scale (4px base unit)
export const spacing = {
  0: '0',
  px: '1px',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
} as const;

// Typography scale
export const fontSize = {
  xs: '11px',
  sm: '13px',
  base: '15px',
  lg: '17px',
  xl: '20px',
  '2xl': '24px',
  '3xl': '30px',
  '4xl': '36px',
} as const;

export const fontWeight = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  black: 900,
} as const;

// Color palette
export const colors = {
  // Background layers (darkest to lightest)
  bg: {
    primary: '#262421',    // Deepest background
    secondary: '#302e2b',   // Cards, panels
    tertiary: '#3d3a37',    // Elevated elements
    hover: '#4a4744',       // Hover states
    active: '#575350',      // Active/pressed
  },
  
  // Borders
  border: {
    subtle: '#3a3a3a',
    default: '#4a4a4a',
    strong: '#5a5a5a',
  },
  
  // Text
  text: {
    primary: '#ffffff',
    secondary: '#b0aeab',
    tertiary: '#7a7876',
    muted: '#5a5856',
  },
  
  // Brand
  brand: {
    primary: '#81b64c',
    hover: '#8fc455',
    active: '#6fa33e',
    muted: 'rgba(129, 182, 76, 0.15)',
  },
  
  // Chess board
  board: {
    light: '#ebecd0',
    dark: '#769656',
    lightHighlight: '#f6f669',
    darkHighlight: '#baca2b',
  },
  
  // Semantic
  semantic: {
    error: '#e74c3c',
    warning: '#f39c12',
    success: '#81b64c',
    info: '#3498db',
  },
} as const;

// Breakpoints
export const breakpoints = {
  sm: '640px',   // Mobile landscape
  md: '768px',   // Tablet
  lg: '1024px',  // Desktop
  xl: '1280px',  // Large desktop
  '2xl': '1536px', // Ultrawide
} as const;

// Component sizing
export const sizing = {
  // Sidebar
  sidebarWidth: '64px',
  sidebarWidthExpanded: '200px',
  
  // Header
  headerHeight: '48px',
  
  // Mobile nav
  mobileNavHeight: '56px',
  
  // Board constraints
  boardMinSize: '280px',
  boardMaxSize: '640px',
  
  // Panels
  panelMinWidth: '260px',
  panelMaxWidth: '320px',
  
  // Touch targets
  touchTarget: '44px',
  touchTargetLarge: '48px',
} as const;

// Border radius
export const radius = {
  none: '0',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
} as const;

// Shadows
export const shadows = {
  sm: '0 1px 2px rgba(0,0,0,0.2)',
  md: '0 4px 12px rgba(0,0,0,0.25)',
  lg: '0 8px 24px rgba(0,0,0,0.3)',
  xl: '0 12px 40px rgba(0,0,0,0.4)',
  glow: '0 0 20px rgba(129, 182, 76, 0.3)',
} as const;

// Transitions
export const transitions = {
  fast: '150ms ease',
  normal: '200ms ease',
  slow: '300ms ease',
  spring: '300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

// Z-index layers
export const zIndex = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  modal: 300,
  popover: 400,
  tooltip: 500,
  toast: 600,
} as const;
