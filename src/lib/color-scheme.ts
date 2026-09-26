/**
 * Safe normalization of React Native's useColorScheme() value.
 *
 * useColorScheme() is typed as nullable ('light' | 'dark' | null) and can also
 * return 'unspecified'. Indexing Colors with a raw nullable value throws a
 * TypeError during the first render (Colors[null] is undefined), which used
 * to freeze the app on the splash screen forever. Always resolve through
 * this helper instead.
 */
export function resolveColorScheme(scheme: string | null | undefined): 'light' | 'dark' {
  const s = scheme ?? 'light';
  return s === 'dark' ? 'dark' : 'light';
}
