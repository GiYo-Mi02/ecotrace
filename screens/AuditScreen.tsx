// screens/AuditScreen.tsx — REWRITTEN to use context + router
// Changes from audit: Props-based → context-based, added data source attribution

import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import {
  ArrowLeft, CheckCircle, AlertTriangle, Clock,
  Factory, Zap, Award, Wind, ChevronDown, ChevronUp, Shield,
} from 'lucide-react-native';
import Animated, {
  FadeInUp, FadeInDown,
  useSharedValue, useAnimatedStyle, withRepeat, withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import StatusBadge from '@/components/StatusBadge';
import DemoBanner from '@/components/DemoBanner';
import { useScan } from '@/stores/ScanContext';
import type { AuditStep } from '@/types/product';

function AuditStepCard({ step, index }: { step: AuditStep; index: number }) {
  const [expanded, setExpanded] = React.useState(false);

  const accentColor =
    step.status === 'verified' ? '#10b981' :
    step.status === 'flagged' ? '#f43f5e' : '#3b82f6';
  const bgColor =
    step.status === 'verified' ? 'rgba(16,185,129,0.08)' :
    step.status === 'flagged' ? 'rgba(244,63,94,0.08)' : 'rgba(59,130,246,0.08)';
  const borderColor =
    step.status === 'verified' ? 'rgba(16,185,129,0.2)' :
    step.status === 'flagged' ? 'rgba(244,63,94,0.2)' : 'rgba(59,130,246,0.2)';

  const StatusIcon =
    step.status === 'verified' ? CheckCircle :
    step.status === 'flagged' ? AlertTriangle : Clock;

  return (
    <Animated.View entering={FadeInUp.delay(index * 100 + 300).duration(300).springify()}>
      <Pressable onPress={() => setExpanded(!expanded)}>
        <View style={[styles.stepCard, { backgroundColor: bgColor, borderColor }]}>
          <View style={styles.stepHeader}>
            <View style={styles.stepHeaderLeft}>
              <View style={[styles.stepIcon, { backgroundColor: `${accentColor}20` }]}>
                <StatusIcon size={16} color={accentColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepLabel}>STEP {index + 1} · {step.id}</Text>
                <Text style={styles.stepTitle}>{step.title}</Text>
              </View>
            </View>
            {expanded
              ? <ChevronUp size={16} color="rgba(255,255,255,0.4)" />
              : <ChevronDown size={16} color="rgba(255,255,255,0.4)" />
            }
          </View>

          {expanded && (
            <View style={styles.stepExpanded}>
              <Text style={styles.stepDescription}>{step.description}</Text>
              <View style={{ gap: 8 }}>
                {step.facility && (
                  <View style={styles.detailRow}>
                    <Factory size={12} color={accentColor} />
                    <Text style={styles.detailText}>{step.facility}</Text>
                  </View>
                )}
                {step.energySource && (
                  <View style={styles.detailRow}>
                    <Zap size={12} color={accentColor} />
                    <Text style={styles.detailText}>{step.energySource}</Text>
                  </View>
                )}
                {step.certification && (
                  <View style={styles.detailRow}>
                    <Award size={12} color={accentColor} />
                    <Text style={[styles.detailText, { color: accentColor }]}>{step.certification}</Text>
                  </View>
                )}
                {step.emissions && (
                  <View style={styles.detailRow}>
                    <Wind size={12} color={accentColor} />
                    <Text style={styles.detailText}>{step.emissions}</Text>
                  </View>
                )}
                {step.dataSource && (
                  <Text style={styles.dataSource}>Source: {step.dataSource}</Text>
                )}
              </View>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function AuditScreen() {
  const router = useRouter();
  const { currentProduct } = useScan();
  const badgePulse = useSharedValue(1);

  // Guard: no product
  if (!currentProduct) {
    return (
      <View style={styles.container}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16 }}>No product selected</Text>
          <Pressable onPress={() => router.back()} style={{ marginTop: 16, backgroundColor: '#10b981', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}>
            <Text style={{ color: '#0f172a', fontWeight: '700' }}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const product = currentProduct;
  const isPositive = product.score >= 70;
  const accentColor = isPositive ? '#10b981' : '#f43f5e';

  React.useEffect(() => {
    if (!isPositive) {
      badgePulse.value = withRepeat(withTiming(0.6, { duration: 1000 }), -1, true);
    }
  }, []);

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: badgePulse.value,
  }));

  const verified = product.auditSteps.filter(s => s.status === 'verified').length;
  const flagged = product.auditSteps.filter(s => s.status === 'flagged').length;
  const pending = product.auditSteps.filter(s => s.status === 'pending').length;

  return (
    <View style={styles.container}>
      <DemoBanner message={product.dataSource === 'mock' ? 'DEMO — SAMPLE DATA ONLY' : undefined} />
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.headerSection}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={18} color="rgba(255,255,255,0.6)" />
            <Text style={styles.backText}>BACK TO IMPACT</Text>
          </Pressable>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.auditLabel}>SUPPLY CHAIN AUDIT</Text>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productMeta}>{product.brand} · {product.id}</Text>
            </View>
            <StatusBadge status={product.status} size="lg" pulse={!isPositive} />
          </View>
        </Animated.View>

        {/* Progress bar */}
        <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>AUDIT PROGRESS</Text>
            <Text style={[styles.progressPercent, { color: accentColor }]}>{product.auditProgress}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${product.auditProgress}%`, backgroundColor: accentColor }]} />
          </View>
        </Animated.View>

        {/* Summary card */}
        <Animated.View entering={FadeInUp.delay(300).duration(400)} style={[styles.summaryCard, { borderColor: `${accentColor}30`, backgroundColor: `${accentColor}10` }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Shield size={18} color={accentColor} />
            <Text style={styles.summaryTitle}>
              {isPositive ? 'Verified Supply Chain' : 'Supply Chain Concerns'}
            </Text>
          </View>
          <Text style={styles.summaryText}>
            {isPositive
              ? `This product has passed ${verified} of ${product.auditSteps.length} verification checkpoints. Supply chain transparency is above average.`
              : `This product has ${flagged} of ${product.auditSteps.length} checkpoints flagged for concerns. Supply chain transparency is below acceptable thresholds.`}
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{verified}</Text>
              <Text style={[styles.statLabel, { color: '#10b981' }]}>VERIFIED</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{flagged}</Text>
              <Text style={[styles.statLabel, { color: '#f43f5e' }]}>FLAGGED</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{pending}</Text>
              <Text style={[styles.statLabel, { color: '#3b82f6' }]}>PENDING</Text>
            </View>
          </View>
        </Animated.View>

        {/* Audit steps */}
        <View style={styles.stepsSection}>
          <Text style={styles.stepsTitle}>VERIFICATION STEPS</Text>
          {product.auditSteps.map((step, index) => (
            <AuditStepCard key={step.id} step={step} index={index} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  headerSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  backText: { fontFamily: 'SpaceMono-Regular', fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  auditLabel: { fontFamily: 'SpaceMono-Regular', fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, marginBottom: 4 },
  productName: { fontSize: 18, color: '#ffffff', fontWeight: '700' },
  productMeta: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  progressSection: { paddingHorizontal: 20, marginBottom: 20 },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontFamily: 'SpaceMono-Regular', fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 },
  progressPercent: { fontFamily: 'SpaceMono-Regular', fontSize: 14, fontWeight: '700' },
  progressTrack: { width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  summaryCard: { marginHorizontal: 20, marginBottom: 20, borderWidth: 1, borderRadius: 12, padding: 16 },
  summaryTitle: { fontSize: 14, color: '#ffffff', fontWeight: '700' },
  summaryText: { fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 18 },
  statsRow: { flexDirection: 'row', marginTop: 12, gap: 12 },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8 },
  statNumber: { fontFamily: 'SpaceMono-Regular', fontSize: 16, color: '#ffffff', fontWeight: '700' },
  statLabel: { fontFamily: 'SpaceMono-Regular', fontSize: 8, letterSpacing: 1, marginTop: 2 },
  stepsSection: { paddingHorizontal: 20, marginBottom: 30 },
  stepsTitle: { fontFamily: 'SpaceMono-Regular', fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, marginBottom: 12 },
  stepCard: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
  stepHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  stepIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontFamily: 'SpaceMono-Regular', fontSize: 8, color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5, marginBottom: 2 },
  stepTitle: { fontSize: 13, color: '#ffffff', fontWeight: '600' },
  stepExpanded: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  stepDescription: { fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 18, marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { fontFamily: 'SpaceMono-Regular', fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5 },
  dataSource: { fontFamily: 'SpaceMono-Regular', fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 8, fontStyle: 'italic' },
});
