import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

const TABS = [
  { name: 'index', label: 'Home', icon: require('@/assets/images/tabIcons/home.png') },
  { name: 'analyze', label: 'Analyze', icon: require('@/assets/images/tabIcons/analyze.png') },
  { name: 'risk', label: 'Risk', icon: require('@/assets/images/tabIcons/risk.png') },
  { name: 'journal', label: 'Journal', icon: require('@/assets/images/tabIcons/journal.png') },
  { name: 'pro', label: 'Pro', icon: require('@/assets/images/tabIcons/pro.png') },
] as const;

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      {TABS.map((t) => (
        <NativeTabs.Trigger key={t.name} name={t.name}>
          <NativeTabs.Trigger.Label>{t.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon src={t.icon} renderingMode="template" />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
