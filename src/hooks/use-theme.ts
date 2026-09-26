/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveColorScheme } from '@/lib/color-scheme';

export function useTheme() {
  // Never index Colors with the raw nullable hook value (see color-scheme.ts).
  return Colors[resolveColorScheme(useColorScheme())];
}
