// app/(tabs)/_layout.tsx — Tab Navigator
// MongoDB Design System: White nav bar with brand-green active tint

import { Tabs } from 'expo-router';
import { Scan, Clock, Settings } from 'lucide-react-native';
import { colors } from '@/components/ui/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.canvas,
          borderTopColor: colors.hairline,
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: 4,
          height: 60,
        },
        tabBarActiveTintColor: colors.brandGreenDark,
        tabBarInactiveTintColor: colors.steel,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="scanner"
        options={{
          title: 'Scanner',
          tabBarIcon: ({ color, size }) => <Scan size={size ?? 22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => <Clock size={size ?? 22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings size={size ?? 22} color={color} />,
        }}
      />
    </Tabs>
  );
}
