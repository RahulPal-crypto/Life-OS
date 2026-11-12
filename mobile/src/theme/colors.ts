export const colors = {
  // Brand colors from the reference UI
  primary: '#6D28D9', // Deep Royal Violet
  primaryLight: '#8B5CF6',
  primaryPurple: '#7C3AED',
  accent: '#10B981', // Emerald green
  cyan: '#0EA5E9',
  amber: '#F59E0B',
  rose: '#F43F5E',

  // Soft Lavender / Lilac Theme Palette
  background: '#F4F0FA', // Light lilac/lavender canvas
  surface: '#FFFFFF',
  surfaceBorder: '#EDE9FE',
  surfaceHover: '#F8F6FF',

  // Typography
  textPrimary: '#1E1B4B', // Midnight indigo
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',

  // Modules specific colors
  myDay: '#6D28D9',
  myMemories: '#EA580C',
  myInterview: '#E11D48',
  myAi: '#7C3AED',
  myFinance: '#16A34A',
  myLearning: '#0284C7',
  myKnowledge: '#9333EA',
  myPlaces: '#059669',
  myConnect: '#2563EB',
  myVault: '#D97706',

  // Personal Space accents
  personal: {
    accent: '#6D28D9',
    accentSecondary: '#8B5CF6',
    lightBg: 'rgba(109, 40, 217, 0.08)',
    border: 'rgba(109, 40, 217, 0.18)',
    glow: 'rgba(124, 58, 237, 0.15)',
  },
  family: {
    accent: '#EA580C',
    accentSecondary: '#F59E0B',
    lightBg: 'rgba(234, 88, 12, 0.08)',
    border: 'rgba(234, 88, 12, 0.18)',
    glow: 'rgba(245, 158, 11, 0.15)',
  },

  creditText: '#6B7280',
  creditHighlight: '#1E1B4B',
} as const;

export type Colors = typeof colors;
