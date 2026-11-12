import { TextStyle } from 'react-native';

export const typography = {
  hero: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 1.2,
    lineHeight: 42,
  } as TextStyle,
  h1: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0.5,
    lineHeight: 34,
  } as TextStyle,
  h2: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0.2,
    lineHeight: 28,
  } as TextStyle,
  h3: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  } as TextStyle,
  body: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
  } as TextStyle,
  bodySmall: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  } as TextStyle,
  caption: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  } as TextStyle,
  button: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  } as TextStyle,
} as const;
