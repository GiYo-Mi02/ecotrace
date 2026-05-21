// screens/SettingsScreen.tsx — MongoDB Design System
// White canvas surface with card-base items, hairline borders

import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Alert, Linking } from 'react-native';
import { Info, BookOpen, Trash2, Shield, ChevronRight, ExternalLink, Mail } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import DemoBanner from '@/components/DemoBanner';
import { useScan } from '@/stores/ScanContext';
import { colors } from '@/components/ui/theme';

function SettingsItem({ icon: Icon, label, description, onPress, danger = false }: {
  icon: any; label: string; description?: string; onPress: () => void; danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={s.settingsItem}>
      <Icon size={18} color={danger ? '#DC2626' : colors.slate} />
      <View style={{ flex: 1 }}>
        <Text style={[s.itemLabel, danger && { color: '#DC2626' }]}>{label}</Text>
        {description && <Text style={s.itemDescription}>{description}</Text>}
      </View>
      <ChevronRight size={16} color={colors.hairlineStrong} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { scanHistory, clearHistory } = useScan();

  const handleClearHistory = () => {
    if (scanHistory.length === 0) {
      Alert.alert('No History', 'Your scan history is already empty.');
      return;
    }
    Alert.alert(
      'Clear Scan History',
      `This will permanently delete ${scanHistory.length} scan${scanHistory.length > 1 ? 's' : ''}. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear All', style: 'destructive', onPress: clearHistory },
      ]
    );
  };

  return (
    <View style={s.container}>
      <DemoBanner />
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Header — hero-band-dark style */}
        <View style={s.headerBand}>
          <Animated.View entering={FadeInDown.duration(300)}>
            <Text style={s.headerEyebrow}>PREFERENCES</Text>
            <Text style={s.headerTitle}>Settings</Text>
          </Animated.View>
        </View>

        {/* Content on white surface */}
        <View style={s.contentSurface}>
          {/* About section */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>ABOUT</Text>
            <SettingsItem icon={Info} label="About ECOTRACE" description="Environmental product scanner — beta version"
              onPress={() => Alert.alert('ECOTRACE', 'ECOTRACE helps you understand the environmental impact of consumer products by analyzing publicly available data from Open Food Facts and other open databases.\n\nScores are estimates, not certified assessments. See our methodology for details.', [{ text: 'OK' }])} />
            <SettingsItem icon={BookOpen} label="How We Score" description="Transparent scoring methodology"
              onPress={() => router.push('/methodology')} />
            <SettingsItem icon={Shield} label="Privacy & Data" description="How your data is handled"
              onPress={() => Alert.alert('Privacy', 'ECOTRACE stores your scan history locally on your device. No personal data is sent to any server. Product data is fetched from the Open Food Facts public API.\n\nFull privacy policy coming soon.', [{ text: 'OK' }])} />
          </View>

          {/* Data */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>DATA</Text>
            <SettingsItem icon={Trash2} label="Clear Scan History"
              description={`${scanHistory.length} scan${scanHistory.length !== 1 ? 's' : ''} stored locally`}
              onPress={handleClearHistory} danger />
          </View>

          {/* Feedback */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>FEEDBACK</Text>
            <SettingsItem icon={Mail} label="Send Feedback" description="Help us improve ECOTRACE"
              onPress={() => Linking.openURL('mailto:feedback@ecotrace.app?subject=ECOTRACE%20Beta%20Feedback')} />
            <SettingsItem icon={ExternalLink} label="Open Food Facts" description="Our primary data source — open & community-driven"
              onPress={() => Linking.openURL('https://world.openfoodfacts.org')} />
          </View>

          {/* Version */}
          <View style={s.versionSection}>
            <Text style={s.versionText}>ECOTRACE v1.0.0-beta</Text>
            <Text style={s.versionSub}>Scoring Methodology v0.1</Text>
            <Text style={s.versionSub}>Data: Open Food Facts</Text>
          </View>

          {/* Disclaimer */}
          <View style={s.disclaimer}>
            <Text style={s.disclaimerText}>
              ECOTRACE scores are estimates based on publicly available product data.
              Scores are NOT certified environmental assessments. See our methodology
              for details on how scores are calculated and their limitations.
            </Text>
          </View>
          <View style={{ height: 30 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  // Dark hero band header
  headerBand: {
    backgroundColor: colors.brandTealDeep,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24,
  },
  headerEyebrow: { fontSize: 11, fontWeight: '600', color: colors.brandGreen, letterSpacing: 3 },
  headerTitle: { fontSize: 28, color: colors.onDark, fontWeight: '500', marginTop: 4, letterSpacing: -0.5 },
  // White content surface
  contentSurface: { backgroundColor: colors.canvas, paddingTop: 24 },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 11, fontWeight: '600', color: colors.steel, letterSpacing: 2, marginBottom: 12 },
  settingsItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.hairline,
    borderRadius: 12, padding: 14, marginBottom: 8,
  },
  itemLabel: { fontSize: 14, color: colors.ink, fontWeight: '600' },
  itemDescription: { fontSize: 12, color: colors.steel, marginTop: 2 },
  versionSection: { alignItems: 'center', paddingVertical: 24, gap: 4 },
  versionText: { fontSize: 13, fontWeight: '600', color: colors.steel },
  versionSub: { fontSize: 11, color: colors.stone },
  disclaimer: {
    marginHorizontal: 20, padding: 14,
    backgroundColor: colors.surfaceSoft, borderRadius: 12,
  },
  disclaimerText: { fontSize: 12, color: colors.steel, lineHeight: 18 },
});
