// screens/SettingsScreen.tsx — NEW
// Audit fix: "Settings tab navigates to Scanner — there is no settings screen"

import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Alert, Linking } from 'react-native';
import { Info, BookOpen, Trash2, Shield, ChevronRight, ExternalLink, Mail } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import DemoBanner from '@/components/DemoBanner';
import { useScan } from '@/stores/ScanContext';

function SettingsItem({
  icon: Icon,
  label,
  description,
  onPress,
  color = 'rgba(255,255,255,0.6)',
  danger = false,
}: {
  icon: any;
  label: string;
  description?: string;
  onPress: () => void;
  color?: string;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={styles.settingsItem}>
      <Icon size={18} color={danger ? '#f43f5e' : color} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.itemLabel, danger && { color: '#f43f5e' }]}>{label}</Text>
        {description && <Text style={styles.itemDescription}>{description}</Text>}
      </View>
      <ChevronRight size={16} color="rgba(255,255,255,0.2)" />
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
    <View style={styles.container}>
      <DemoBanner />
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
          <Text style={styles.headerSubtitle}>PREFERENCES</Text>
          <Text style={styles.headerTitle}>Settings</Text>
        </Animated.View>

        {/* About section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ABOUT</Text>

          <SettingsItem
            icon={Info}
            label="About ECOTRACE"
            description="Environmental product scanner — beta version"
            onPress={() => {
              Alert.alert(
                'ECOTRACE',
                'ECOTRACE helps you understand the environmental impact of consumer products by analyzing publicly available data from Open Food Facts and other open databases.\n\nScores are estimates, not certified assessments. See our methodology for details.',
                [{ text: 'OK' }]
              );
            }}
          />

          <SettingsItem
            icon={BookOpen}
            label="How We Score"
            description="Transparent scoring methodology"
            onPress={() => router.push('/methodology')}
          />

          <SettingsItem
            icon={Shield}
            label="Privacy & Data"
            description="How your data is handled"
            onPress={() => {
              Alert.alert(
                'Privacy',
                'ECOTRACE stores your scan history locally on your device. No personal data is sent to any server. Product data is fetched from the Open Food Facts public API.\n\nFull privacy policy coming soon.',
                [{ text: 'OK' }]
              );
            }}
          />
        </View>

        {/* Data section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DATA</Text>

          <SettingsItem
            icon={Trash2}
            label="Clear Scan History"
            description={`${scanHistory.length} scan${scanHistory.length !== 1 ? 's' : ''} stored locally`}
            onPress={handleClearHistory}
            danger
          />
        </View>

        {/* Feedback section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FEEDBACK</Text>

          <SettingsItem
            icon={Mail}
            label="Send Feedback"
            description="Help us improve ECOTRACE"
            onPress={() => {
              Linking.openURL('mailto:feedback@ecotrace.app?subject=ECOTRACE%20Beta%20Feedback');
            }}
          />

          <SettingsItem
            icon={ExternalLink}
            label="Open Food Facts"
            description="Our primary data source — open & community-driven"
            onPress={() => {
              Linking.openURL('https://world.openfoodfacts.org');
            }}
          />
        </View>

        {/* Version info */}
        <View style={styles.versionSection}>
          <Text style={styles.versionText}>ECOTRACE v1.0.0-beta</Text>
          <Text style={styles.versionSubtext}>Scoring Methodology v0.1</Text>
          <Text style={styles.versionSubtext}>Data: Open Food Facts</Text>
        </View>

        {/* Legal disclaimer */}
        <View style={styles.disclaimerSection}>
          <Text style={styles.disclaimerText}>
            ECOTRACE scores are estimates based on publicly available product data.
            Scores are NOT certified environmental assessments. See our methodology
            for details on how scores are calculated and their limitations.
          </Text>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerSubtitle: { fontFamily: 'SpaceMono-Regular', fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 3 },
  headerTitle: { fontSize: 22, color: '#ffffff', fontWeight: '700', marginTop: 4 },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: {
    fontFamily: 'SpaceMono-Regular', fontSize: 10, color: 'rgba(255,255,255,0.3)',
    letterSpacing: 2, marginBottom: 12,
  },
  settingsItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12, padding: 14, marginBottom: 8,
  },
  itemLabel: { fontSize: 14, color: '#ffffff', fontWeight: '600' },
  itemDescription: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  versionSection: { alignItems: 'center', paddingVertical: 24, gap: 4 },
  versionText: { fontFamily: 'SpaceMono-Regular', fontSize: 12, color: 'rgba(255,255,255,0.3)', letterSpacing: 1 },
  versionSubtext: { fontFamily: 'SpaceMono-Regular', fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: 0.5 },
  disclaimerSection: {
    marginHorizontal: 20, padding: 14, backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 10,
  },
  disclaimerText: {
    fontFamily: 'SpaceMono-Regular', fontSize: 9, color: 'rgba(255,255,255,0.25)',
    lineHeight: 16, letterSpacing: 0.3,
  },
});
