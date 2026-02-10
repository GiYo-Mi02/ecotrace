// screens/ImpactScreen.tsx — REWRITTEN to use context + router + confidence indicator
// Changes from audit:
//  - Props-based → reads from ScanContext
//  - Added confidence level badge below score
//  - Added "How is this scored?" link to methodology
//  - Added data source attribution

import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { ArrowLeft, Leaf, Wind, Truck, ChevronRight, Shield, Info, HelpCircle } from 'lucide-react-native';
import Animated, {
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import ScoreRing from '@/components/ScoreRing';
import StatusBadge from '@/components/StatusBadge';
import DemoBanner from '@/components/DemoBanner';
import { useScan } from '@/stores/ScanContext';

const CONFIDENCE_LABELS = {
  high: { label: 'HIGH CONFIDENCE', color: '#10b981', desc: 'Most data points verified' },
  estimated: { label: 'ESTIMATED', color: '#f59e0b', desc: 'Some data interpolated' },
  insufficient: { label: 'LIMITED DATA', color: '#f43f5e', desc: 'Category-level estimate' },
} as const;

export default function ImpactScreen() {
  const router = useRouter();
  const { currentProduct } = useScan();
  const auditButtonScale = useSharedValue(1);

  const auditButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: auditButtonScale.value }],
  }));

  // Guard: no product selected
  if (!currentProduct) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyCenter}>
          <Text style={styles.emptyText}>No product selected</Text>
          <Pressable onPress={() => router.back()} style={styles.emptyButton}>
            <Text style={styles.emptyButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const product = currentProduct;
  const color = product.score >= 70 ? '#10b981' : product.score >= 40 ? '#f59e0b' : '#f43f5e';
  const confidence = CONFIDENCE_LABELS[product.confidence || 'estimated'];

  return (
    <View style={styles.container}>
      <DemoBanner message={product.dataSource === 'mock' ? 'DEMO — SAMPLE DATA ONLY' : undefined} />
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <ArrowLeft size={18} color="rgba(255,255,255,0.6)" />
            <Text style={styles.backText}>BACK</Text>
          </Pressable>

          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.productId}>{product.id}</Text>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productMeta}>{product.brand} · {product.category}</Text>
            </View>
            <StatusBadge status={product.status} />
          </View>
        </Animated.View>

        {/* Score ring */}
        <Animated.View entering={FadeInUp.delay(200).duration(500)} style={styles.scoreSection}>
          <ScoreRing score={product.score} size={180} strokeWidth={8} />
          <Text style={styles.scoreLabel}>SUSTAINABILITY INDEX</Text>

          {/* Confidence indicator — NEW from audit recommendation */}
          <View style={[styles.confidenceBadge, { borderColor: `${confidence.color}40` }]}>
            <Info size={10} color={confidence.color} />
            <Text style={[styles.confidenceText, { color: confidence.color }]}>
              {confidence.label}
            </Text>
          </View>

          {/* Methodology link */}
          <Pressable onPress={() => router.push('/methodology')} style={styles.methodologyLink}>
            <HelpCircle size={12} color="rgba(255,255,255,0.4)" />
            <Text style={styles.methodologyText}>How is this scored?</Text>
          </Pressable>
        </Animated.View>

        {/* Metrics row */}
        <Animated.View entering={FadeInUp.delay(400).duration(400)} style={styles.metricsRow}>
          {[
            { icon: Leaf, label: 'RENEWABLE', value: `${product.renewablePercent}%`, color: '#10b981' },
            { icon: Wind, label: 'EMISSIONS', value: product.emissions, color: product.score >= 70 ? '#10b981' : '#f43f5e' },
            { icon: Truck, label: 'TRANSPORT', value: product.transportDistance, color: '#3b82f6' },
          ].map((metric) => (
            <View key={metric.label} style={styles.metricCard}>
              <metric.icon size={18} color={metric.color} />
              <Text style={styles.metricValue}>{metric.value}</Text>
              <Text style={styles.metricLabel}>{metric.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Material breakdown */}
        <Animated.View entering={FadeInUp.delay(600).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>MATERIAL BREAKDOWN</Text>
          {product.materials.map((material, index) => (
            <View key={index} style={styles.materialCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.materialName}>{material.material}</Text>
                <Text style={styles.materialOrigin}>{material.origin}</Text>
                {material.source && (
                  <Text style={styles.dataSourceTag}>Source: {material.source}</Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {material.certification && (
                  <View style={styles.certBadge}>
                    <Text style={styles.certText}>{material.certification}</Text>
                  </View>
                )}
                <Shield size={14} color={material.verified ? '#10b981' : '#f43f5e'} />
              </View>
            </View>
          ))}
        </Animated.View>

        {/* Deep audit button */}
        <Animated.View entering={FadeInUp.delay(800).duration(400)} style={styles.section}>
          <Pressable
            onPressIn={() => { auditButtonScale.value = withSpring(0.98); }}
            onPressOut={() => {
              auditButtonScale.value = withSpring(1);
              router.push('/audit');
            }}
          >
            <Animated.View style={[auditButtonStyle, styles.auditButton, { borderColor: `${color}40`, backgroundColor: `${color}15` }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Shield size={20} color={color} />
                <View>
                  <Text style={styles.auditTitle}>Supply Chain Audit</Text>
                  <Text style={styles.auditSubtitle}>
                    {product.auditSteps.length} verification steps · {product.auditProgress}% complete
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color={color} />
            </Animated.View>
          </Pressable>
        </Animated.View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  backText: { fontFamily: 'SpaceMono-Regular', fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  productId: { fontFamily: 'SpaceMono-Regular', fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 2 },
  productName: { fontSize: 20, color: '#ffffff', fontWeight: '700', marginTop: 4 },
  productMeta: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  scoreSection: { alignItems: 'center', paddingVertical: 30 },
  scoreLabel: { fontFamily: 'SpaceMono-Regular', fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 12, letterSpacing: 2 },
  confidenceBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginTop: 10,
  },
  confidenceText: { fontFamily: 'SpaceMono-Regular', fontSize: 9, letterSpacing: 1 },
  methodologyLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  methodologyText: { fontFamily: 'SpaceMono-Regular', fontSize: 10, color: 'rgba(255,255,255,0.4)', textDecorationLine: 'underline' },
  metricsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 24 },
  metricCard: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, alignItems: 'center', gap: 6,
  },
  metricValue: { fontFamily: 'SpaceMono-Regular', fontSize: 14, color: '#ffffff', fontWeight: '700' },
  metricLabel: { fontFamily: 'SpaceMono-Regular', fontSize: 8, color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5 },
  section: { paddingHorizontal: 20, marginBottom: 16 },
  sectionTitle: { fontFamily: 'SpaceMono-Regular', fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, marginBottom: 12 },
  materialCard: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  materialName: { fontSize: 13, color: '#ffffff', fontWeight: '600' },
  materialOrigin: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  dataSourceTag: { fontFamily: 'SpaceMono-Regular', fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 4, fontStyle: 'italic' },
  certBadge: { backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  certText: { fontFamily: 'SpaceMono-Regular', fontSize: 8, color: '#10b981', letterSpacing: 0.5 },
  auditButton: {
    borderWidth: 1, borderRadius: 12, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  auditTitle: { fontSize: 14, color: '#ffffff', fontWeight: '700' },
  auditSubtitle: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  emptyCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyText: { fontSize: 16, color: 'rgba(255,255,255,0.5)' },
  emptyButton: { backgroundColor: '#10b981', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  emptyButtonText: { color: '#0f172a', fontWeight: '700' },
});
