/**
 * INDO CHESS DESIGN SYSTEM v2.0
 * Premium Visual Language
 * 
 * Design Philosophy:
 * - Dark, sophisticated, focused
 * - Board is the hero - everything else recedes
 * - Depth through subtle shadows and layers
 * - Color is used sparingly and meaningfully
 * - Every pixel is intentional
 */

export const colors = {
  // Core dark palette - NOT brown, but rich charcoal with blue undertones
  bg: {
    void: '#0a0a0b',        // Deepest black
    base: '#121214',        // Primary background
    raised: '#1a1a1e',      // Cards, panels
    elevated: '#222226',    // Hover states, elevated cards
    overlay: '#2a2a2f',     // Dropdowns, popovers
  },
  
  // Borders - subtle, not harsh
  border: {
    subtle: 'rgba(255,255,255,0.06)',
    default: 'rgba(255,255,255,0.1)',
    strong: 'rgba(255,255,255,0.15)',
    focus: 'rgba(129,182,76,0.5)',
  },
  
  // Text - proper contrast hierarchy
  text: {
    primary: '#ffffff',
    secondary: 'rgba(255,255,255,0.7)',
    tertiary: 'rgba(255,255,255,0.5)',
    muted: 'rgba(255,255,255,0.35)',
    inverse: '#000000',
  },
  
  // Brand - vibrant green, used sparingly
  brand: {
    primary: '#7cb342',      // Main green - brighter, more alive
    light: '#9ccc65',        // Hover
    dark: '#689f38',         // Active
    glow: 'rgba(124,179,66,0.4)',
    subtle: 'rgba(124,179,66,0.12)',
  },
  
  // Board colors - the hero element
  board: {
    light: '#eae9d2',        // Cream white
    dark: '#4a7c59',         // Forest green (richer than Chess.com)
    lightHl: '#f7f77d',      // Selection/last move light
    darkHl: '#bbcb44',       // Selection/last move dark
  },
  
  // Semantic
  status: {
    success: '#7cb342',
    warning: '#ffb300',
    error: '#ef5350',
    info: '#42a5f5',
  },
  
  // Special
  white: '#ffffff',
  black: '#000000',
  
  // Gradients
  gradient: {
    brand: 'linear-gradient(135deg, #7cb342 0%, #558b2f 100%)',
    dark: 'linear-gradient(180deg, #1a1a1e 0%, #121214 100%)',
    glow: 'radial-gradient(ellipse at center, rgba(124,179,66,0.15) 0%, transparent 70%)',
  },
} as const;

export const spacing = {
  0: '0',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
} as const;

export const typography = {
  // Font family - clean, modern
  fontFamily: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'SF Mono', Monaco, monospace",
  },
  
  // Size scale
  size: {
    xs: '11px',
    sm: '13px',
    base: '14px',
    md: '15px',
    lg: '17px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '32px',
    '4xl': '40px',
  },
  
  // Weight
  weight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  
  // Line height
  leading: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.6,
  },
  
  // Letter spacing
  tracking: {
    tight: '-0.02em',
    normal: '0',
    wide: '0.05em',
    wider: '0.1em',
  },
} as const;

export const radius = {
  none: '0',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '20px',
  full: '9999px',
} as const;

export const shadows = {
  // Subtle, layered shadows for depth
  sm: '0 1px 2px rgba(0,0,0,0.3)',
  md: '0 4px 8px rgba(0,0,0,0.25), 0 1px 2px rgba(0,0,0,0.2)',
  lg: '0 8px 24px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2)',
  xl: '0 16px 48px rgba(0,0,0,0.4), 0 4px 8px rgba(0,0,0,0.2)',
  
  // Glow effects
  glow: {
    brand: '0 0 20px rgba(124,179,66,0.3)',
    white: '0 0 20px rgba(255,255,255,0.1)',
  },
  
  // Inset
  inset: 'inset 0 1px 0 rgba(255,255,255,0.05)',
  
  // Board
  board: '0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
} as const;

export const animation = {
  // Timing
  duration: {
    instant: '50ms',
    fast: '150ms',
    normal: '250ms',
    slow: '400ms',
  },
  
  // Easing
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const;

export const layout = {
  // Fixed dimensions
  sidebar: {
    width: '72px',
    collapsedWidth: '0px',
  },
  header: {
    height: '56px',
  },
  mobileNav: {
    height: '64px',
  },
  
  // Board constraints
  board: {
    minSize: '300px',
    maxSize: '680px',
  },
  
  // Panel
  panel: {
    width: '320px',
    minWidth: '280px',
  },
  
  // Breakpoints
  breakpoint: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
} as const;
