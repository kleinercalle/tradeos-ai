import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Component, type ReactNode, useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';

// The native splash must never trap the user: prevent auto-hide, but also arm
// a last-resort timer at bundle-eval time. If the first render ever throws
// before the overlay mounts, this timer still releases the splash.
SplashScreen.preventAutoHideAsync().catch(() => {});
setTimeout(() => {
  SplashScreen.hideAsync().catch(() => {});
}, 8000);

function releaseSplash() {
  SplashScreen.hideAsync().catch(() => {});
}

/**
 * If anything in the tree throws before first layout, release the native
 * splash instead of leaving the app frozen on it forever.
 */
class SplashErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    releaseSplash();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function RootLayout() {
  const colorScheme = useColorScheme() ?? 'light';

  // Extra safety: hide the splash a moment after mount even if the overlay
  // above somehow never runs its own hide (belt and suspenders).
  useEffect(() => {
    const t = setTimeout(releaseSplash, 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SplashErrorBoundary>
        <AnimatedSplashOverlay />
        <AppTabs />
      </SplashErrorBoundary>
    </ThemeProvider>
  );
}
