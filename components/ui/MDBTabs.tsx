// components/ui/MDBTabs.tsx — MongoDB Design System Tabs
// Pill tabs + Segmented (underline) tabs
import React from 'react';
import { View, Pressable, Text, StyleSheet, type ViewStyle } from 'react-native';

const C = {
  steel: '#889397', ink: '#001E2B', onDark: '#FFFFFF',
  hairline: '#E8EDEB', greenDark: '#00684A',
} as const;

// ─── Pill Tabs ────────────────────────────────────────────────────

interface TabItem { key: string; label: string; }

interface MDBPillTabsProps {
  tabs: TabItem[];
  activeKey: string;
  onTabPress: (key: string) => void;
  style?: ViewStyle;
}

export function MDBPillTabs({ tabs, activeKey, onTabPress, style }: MDBPillTabsProps) {
  return (
    <View style={[st.pillRow, style]}>
      {tabs.map((t) => {
        const active = t.key === activeKey;
        return (
          <Pressable key={t.key} onPress={() => onTabPress(t.key)}
            style={[st.pillTab, active && st.pillTabActive]}>
            <Text style={[st.pillLabel, active && st.pillLabelActive]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Segmented (Underline) Tabs ───────────────────────────────────

interface MDBSegmentedTabsProps {
  tabs: TabItem[];
  activeKey: string;
  onTabPress: (key: string) => void;
  style?: ViewStyle;
}

export function MDBSegmentedTabs({ tabs, activeKey, onTabPress, style }: MDBSegmentedTabsProps) {
  return (
    <View style={[st.segRow, style]}>
      {tabs.map((t) => {
        const active = t.key === activeKey;
        return (
          <Pressable key={t.key} onPress={() => onTabPress(t.key)}
            style={[st.segTab, active && st.segTabActive]}>
            <Text style={[st.segLabel, active && st.segLabelActive]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  // Pill tabs
  pillRow: { flexDirection: 'row', gap: 8 },
  pillTab: {
    borderWidth: 1, borderColor: C.hairline, borderRadius: 9999,
    paddingVertical: 8, paddingHorizontal: 16,
  },
  pillTabActive: { backgroundColor: C.ink, borderColor: C.ink },
  pillLabel: { fontSize: 14, fontWeight: '500', color: C.steel },
  pillLabelActive: { color: C.onDark },
  // Segmented tabs
  segRow: { flexDirection: 'row', gap: 24, borderBottomWidth: 1, borderBottomColor: C.hairline },
  segTab: { paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  segTabActive: { borderBottomColor: C.greenDark },
  segLabel: { fontSize: 14, fontWeight: '500', color: C.steel },
  segLabelActive: { color: C.greenDark },
});
