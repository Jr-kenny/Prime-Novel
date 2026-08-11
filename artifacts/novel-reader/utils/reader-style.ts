import type { ReaderFont, ReaderTheme } from '@/context/ReaderContext';

export type ReaderPalette = {
  background: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  track: string;
  statusBarStyle: 'light' | 'dark';
};

type ReaderAccentColors = {
  primary: string;
  tint: string;
};

export function getReaderPalette(theme: ReaderTheme, colors: ReaderAccentColors): ReaderPalette {
  if (theme === 'paper') {
    return {
      background: '#f2eadf',
      surface: '#ebe0d4',
      border: '#d8cabb',
      text: '#322b25',
      muted: '#84776a',
      accent: colors.primary,
      track: '#d8cabb',
      statusBarStyle: 'dark',
    };
  }

  if (theme === 'black') {
    return {
      background: '#050505',
      surface: '#111111',
      border: '#2b2b2b',
      text: '#eee8de',
      muted: '#99938a',
      accent: colors.tint,
      track: '#2b2b2b',
      statusBarStyle: 'light',
    };
  }

  if (theme === 'white') {
    return {
      background: '#ffffff',
      surface: '#f6f6f6',
      border: '#e2e2e2',
      text: '#1d1d1d',
      muted: '#777777',
      accent: colors.primary,
      track: '#e2e2e2',
      statusBarStyle: 'dark',
    };
  }

  return {
    background: '#242422',
    surface: '#2e2e2b',
    border: '#494742',
    text: '#eee8de',
    muted: '#aaa398',
    accent: colors.tint,
    track: '#494742',
    statusBarStyle: 'light',
  };
}

export function getReaderFont(font: ReaderFont) {
  if (font === 'merriweather') {
    return { body: 'Merriweather_400Regular', heading: 'Merriweather_700Bold' };
  }

  if (font === 'atkinson') {
    return { body: 'AtkinsonHyperlegible_400Regular', heading: 'AtkinsonHyperlegible_700Bold' };
  }

  if (font === 'sans') {
    return { body: 'Inter_400Regular', heading: 'Inter_600SemiBold' };
  }

  return { body: 'Georgia', heading: 'Georgia' };
}
