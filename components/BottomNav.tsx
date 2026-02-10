import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Scan, Clock, BarChart3, Settings } from 'lucide-react-native';
import type { AppScreen } from '@/context/AppContext';

interface BottomNavProps {
  currentScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
}

const NAV_ITEMS: { screen: AppScreen; label: string; Icon: any }[] = [
  { screen: 'scanner', label: 'Scanner', Icon: Scan },
  { screen: 'history', label: 'History', Icon: Clock },
  { screen: 'impact', label: 'Impact', Icon: BarChart3 },
  { screen: 'scanner', label: 'Settings', Icon: Settings },
];

export default function BottomNav({ currentScreen, onNavigate }: BottomNavProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: '#0f172a',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        paddingBottom: 20,
        paddingTop: 12,
        paddingHorizontal: 16,
      }}
    >
      {NAV_ITEMS.map((item, index) => {
        const isActive =
          item.screen === currentScreen ||
          (item.screen === 'scanner' && (currentScreen === 'parsing' || currentScreen === 'scanner'));
        return (
          <Pressable
            key={index}
            onPress={() => onNavigate(item.screen)}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}
          >
            <item.Icon
              size={22}
              color={isActive ? '#10b981' : 'rgba(255,255,255,0.4)'}
            />
            <Text
              style={{
                fontSize: 10,
                fontFamily: 'SpaceMono-Regular',
                color: isActive ? '#10b981' : 'rgba(255,255,255,0.4)',
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
