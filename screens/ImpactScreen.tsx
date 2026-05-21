// screens/ImpactScreen.tsx — MongoDB Design System
// Dark teal hero header → white card surface for metrics

import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { ArrowLeft, Leaf, Wind, Truck, ChevronRight, Shield, Info, HelpCircle } from 'lucide-react-native';
import Animated, { FadeInUp, FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import ScoreRing from '@/components/ScoreRing';
import StatusBadge from '@/components/StatusBadge';
import DemoBanner from '@/components/DemoBanner';
import { useScan } from '@/stores/ScanContext';
import { colors } from '@/components/ui/theme';

const CONFIDENCE_LABELS = {
  high: { label: 'HIGH CONFIDENCE', color: colors.brandGreenDark, bg: colors.brandGreenSoft },
  estimated: { label: 'ESTIMATED', color: colors.accentOrange, bg: '#FEF3C7' },
  insufficient: { label: 'LIMITED DATA', color: '#DC2626', bg: '#FEE2E2' },
} as const;

export default function ImpactScreen() {
  const router = useRouter();
  const { currentProduct } = useScan();
  const auditButtonScale = useSharedValue(1);
  const auditButtonStyle = useAnimatedStyle(() => ({ transform: [{ scale: auditButtonScale.value }] }));

  if (!currentProduct) {
    return (
      <View style={s.containerDark}>
        <View style={s.emptyCenter}>
          <Text style={s.emptyText}>No product selected</Text>
          <Pressable onPress={() => router.back()} style={s.emptyButton}>
            <Text style={s.emptyButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const product = currentProduct;
  const scoreColor = product.score >= 70 ? colors.brandGreenDark : product.score >= 40 ? colors.accentOrange : '#DC2626';
  const confidence = CONFIDENCE_LABELS[product.confidence || 'estimated'];

  return (
    <View style={s.container}>
      <DemoBanner message={product.dataSource === 'mock' ? 'DEMO — SAMPLE DATA ONLY' : undefined} />
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Dark teal hero header */}
        <View style={s.heroBand}>
          <Animated.View entering={FadeInDown.duration(300)}>
            <Pressable onPress={() => router.back()} style={s.backButton}>
              <ArrowLeft size={18} color={colors.onDarkMuted} />
              <Text style={s.backText}>BACK</Text>
            </Pressable>
            <View style={s.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.productId}>{product.id}</Text>
                <Text style={s.productName}>{product.name}</Text>
                <Text style={s.productMeta}>{product.brand} · {product.category}</Text>
              </View>
              <StatusBadge status={product.status} />
            </View>
          </Animated.View>

          {/* Score ring on dark hero */}
          <Animated.View entering={FadeInUp.delay(200).duration(500)} style={s.scoreSection}>
            <ScoreRing score={product.score} size={180} strokeWidth={8} />
            <Text style={s.scoreLabel}>SUSTAINABILITY INDEX</Text>
            <View style={[s.confidenceBadge, { backgroundColor: confidence.bg }]}>
              <Info size={10} color={confidence.color} />
              <Text style={[s.confidenceText, { color: confidence.color }]}>{confidence.label}</Text>
            </View>
            <Pressable onPress={() => router.push('/methodology')} style={s.methodologyLink}>
              <HelpCircle size={12} color={colors.onDarkMuted} />
              <Text style={s.methodologyText}>How is this scored?</Text>
            </Pressable>
          </Animated.View>
        </View>

        {/* White content surface */}
        <View style={s.whiteSurface}>
          {/* Metrics row */}
          <Animated.View entering={FadeInUp.delay(400).duration(400)} style={s.metricsRow}>
            {[
              { icon: Leaf, label: 'RENEWABLE', value: `${product.renewablePercent}%`, color: colors.brandGreenDark },
              { icon: Wind, label: 'EMISSIONS', value: product.emissions, color: product.score >= 70 ? colors.brandGreenDark : '#DC2626' },
              { icon: Truck, label: 'TRANSPORT', value: product.transportDistance, color: colors.accentBlue },
            ].map((metric) => (
              <View key={metric.label} style={s.metricCard}>
                <metric.icon size={18} color={metric.color} />
                <Text style={s.metricValue}>{metric.value}</Text>
                <Text style={s.metricLabel}>{metric.label}</Text>
              </View>
            ))}
          </Animated.View>

          {/* Material breakdown */}
          <Animated.View entering={FadeInUp.delay(600).duration(400)} style={s.section}>
            <Text style={s.sectionTitle}>MATERIAL BREAKDOWN</Text>
            {product.materials.map((material, index) => (
              <View key={index} style={s.materialCard}>
                <View style={{ flex: 1 }}>
                  <Text style={s.materialName}>{material.material}</Text>
                  <Text style={s.materialOrigin}>{material.origin}</Text>
                  {material.source && <Text style={s.dataSourceTag}>Source: {material.source}</Text>}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {material.certification && (
                    <View style={s.certBadge}>
                      <Text style={s.certText}>{material.certification}</Text>
                    </View>
                  )}
                  <Shield size={14} color={material.verified ? colors.brandGreenDark : '#DC2626'} />
                </View>
              </View>
            ))}
          </Animated.View>

          {/* Audit CTA */}
          <Animated.View entering={FadeInUp.delay(800).duration(400)} style={s.section}>
            <Pressable
              onPressIn={() => { auditButtonScale.value = withSpring(0.98); }}
              onPressOut={() => { auditButtonScale.value = withSpring(1); router.push('/audit'); }}
            >
              <Animated.View style={[auditButtonStyle, s.auditButton]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Shield size={20} color={colors.brandGreenDark} />
                  <View>
                    <Text style={s.auditTitle}>Supply Chain Audit</Text>
                    <Text style={s.auditSubtitle}>
                      {product.auditSteps.length} verification steps · {product.auditProgress}% complete
                    </Text>
                  </View>
                </View>
                <ChevronRight size={18} color={colors.brandGreenDark} />
              </Animated.View>
            </Pressable>
          </Animated.View>
          <View style={{ height: 30 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  containerDark: { flex: 1, backgroundColor: colors.brandTealDeep },
  emptyCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyText: { fontSize: 16, color: colors.onDarkMuted },
  emptyButton: { backgroundColor: colors.brandGreen, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 9999 },
  emptyButtonText: { color: colors.onPrimary, fontWeight: '600' },

  // Hero band
  heroBand: { backgroundColor: colors.brandTealDeep, paddingBottom: 32 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 16, marginBottom: 12 },
  backText: { fontSize: 11, fontWeight: '600', color: colors.onDarkMuted, letterSpacing: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  productId: { fontSize: 11, color: colors.onDarkMuted, letterSpacing: 2 },
  productName: { fontSize: 22, color: colors.onDark, fontWeight: '500', marginTop: 4, letterSpacing: -0.5 },
  productMeta: { fontSize: 14, color: colors.onDarkMuted, marginTop: 2 },
  scoreSection: { alignItems: 'center', paddingTop: 24 },
  scoreLabel: { fontSize: 11, fontWeight: '600', color: colors.brandGreen, marginTop: 12, letterSpacing: 2 },
  confidenceBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 10,
  },
  confidenceText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  methodologyLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  methodologyText: { fontSize: 12, color: colors.onDarkMuted, textDecorationLine: 'underline' },

  // White surface
  whiteSurface: { backgroundColor: colors.canvas, paddingTop: 24 },
  metricsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 24 },
  metricCard: {
    flex: 1, backgroundColor: colors.surface, borderWidth: 1,
    borderColor: colors.hairline, borderRadius: 12, padding: 12, alignItems: 'center', gap: 6,
  },
  metricValue: { fontFamily: 'SourceCodePro-Bold', fontSize: 14, color: colors.ink },
  metricLabel: { fontSize: 9, fontWeight: '600', color: colors.steel, letterSpacing: 1.5 },
  section: { paddingHorizontal: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '600', color: colors.steel, letterSpacing: 2, marginBottom: 12 },
  materialCard: {
    backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.hairline,
    borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  materialName: { fontSize: 14, color: colors.ink, fontWeight: '600' },
  materialOrigin: { fontSize: 12, color: colors.slate, marginTop: 2 },
  dataSourceTag: { fontSize: 11, color: colors.stone, marginTop: 4, fontStyle: 'italic' },
  certBadge: { backgroundColor: colors.brandGreenSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 },
  certText: { fontSize: 11, fontWeight: '600', color: colors.brandGreenDark },
  auditButton: {
    borderWidth: 1, borderColor: colors.hairline, borderRadius: 12, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surfaceFeature,
  },
  auditTitle: { fontSize: 14, color: colors.ink, fontWeight: '600' },
  auditSubtitle: { fontSize: 12, color: colors.slate, marginTop: 2 },
});
