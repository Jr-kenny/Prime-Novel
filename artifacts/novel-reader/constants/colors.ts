/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: '#2a2621',
    tint: '#b65f47',
    background: '#f7f3ed',
    foreground: '#2a2621',
    card: '#fffdf9',
    cardForeground: '#2a2621',
    primary: '#b65f47',
    primaryForeground: '#fffaf4',
    secondary: '#ebe3d8',
    secondaryForeground: '#51483f',
    muted: '#eee8df',
    mutedForeground: '#83796f',
    accent: '#e9d4c5',
    accentForeground: '#6f3d2f',
    destructive: '#a8564b',
    destructiveForeground: '#fffaf4',
    border: '#ded5ca',
    input: '#d8cec2',
  },
  dark: {
    text: '#eee7dc',
    tint: '#d58a70',
    background: '#171614',
    foreground: '#eee7dc',
    card: '#24211e',
    cardForeground: '#eee7dc',
    primary: '#d58a70',
    primaryForeground: '#251b17',
    secondary: '#302b27',
    secondaryForeground: '#d7ccc0',
    muted: '#2a2724',
    mutedForeground: '#9a8f83',
    accent: '#49332c',
    accentForeground: '#f0b49b',
    destructive: '#d4776b',
    destructiveForeground: '#211412',
    border: '#3d3732',
    input: '#4a423b',
  },
  radius: 14,
};

export default colors;
