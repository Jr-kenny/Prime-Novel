import colors from '@/constants/colors';
import { useApp } from '@/context/AppContext';

/**
 * Returns the design tokens for the selected app theme.
 *
 * The returned object contains all color tokens for the active palette
 * plus scheme-independent values like `radius`.
 *
 * The default cream palette preserves the original Prime Novel appearance.
 */
export function useColors() {
  const { settings } = useApp();
  const palette = settings.appTheme === 'dark'
    ? colors.dark
    : settings.appTheme === 'white'
      ? colors.white
      : colors.light;
  return { ...palette, radius: colors.radius };
}
