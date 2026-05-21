// screens/AuditScreen.tsx — MongoDB Design System
// Dark teal hero → white surface for audit steps

import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import {
  ArrowLeft, CheckCircle, AlertTriangle, Clock,
  Factory, Zap, Award, Wind, ChevronDown, ChevronUp, Shield,
} from 'lucide-react-native';
import Animated, { FadeInUp, FadeInDown, useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import StatusBadge from '@/components/StatusBadge';
import DemoBanner from '@/components/DemoBanner';
import { useScan } from '@/stores/ScanContext';
import { colors } from '@/components/ui/theme';
import type { AuditStep } from '@/types/product';

const STATUS_COLORS = {
  verified: { accent: colors.brandGreenDark, bg: colors.brandGreenSoft, border: '#B8E8D5' },
  flagged: { accent: '#DC2626', bg: '#FEE2E2', border: '#FECACA' },
  pending: { accent: colors.accentBlue, bg: '#EBF5FF', border: '#BFDBFE' },
};

function AuditStepCard({ step, index }: { step: AuditStep; index: number }) {
  const [expanded, setExpanded] = React.useState(false);
  const sc = STATUS_COLORS[step.status];
  const StatusIcon = step.status === 'verified' ? CheckCircle : step.status === 'flagged' ? AlertTriangle : Clock;

  return (
    <Animated.View entering={FadeInUp.delay(index * 100 + 300).duration(300).springify()}>
      <Pressable onPress={() => setExpanded(!expanded)}>
        <View style={[s.stepCard, { backgroundColor: sc.bg, borderColor: sc.border }]}>
          <View style={s.stepHeader}>
            <View style={s.stepHeaderLeft}>
              <View style={[s.stepIcon, { backgroundColor: `${sc.accent}18` }]}>
                <StatusIcon size={16} color={sc.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.stepLabel}>STEP {index + 1} · {step.id}</Text>
                <Text style={s.stepTitle}>{step.title}</Text>
              </View>
            </View>
            {expanded ? <ChevronUp size={16} color={colors.steel} /> : <ChevronDown size={16} color={colors.steel} />}
          </View>
          {expanded && (
            <View style={s.stepExpanded}>
              <Text style={s.stepDescription}>{step.description}</Text>
              <View style={{ gap: 8 }}>
                {step.facility && <View style={s.detailRow}><Factory size={12} color={sc.accent} /><Text style={s.detailText}>{step.facility}</Text></View>}
                {step.energySource && <View style={s.detailRow}><Zap size={12} color={sc.accent} /><Text style={s.detailText}>{step.energySource}</Text></View>}
                {step.certification && <View style={s.detailRow}><Award size={12} color={sc.accent} /><Text style={[s.detailText, { color: sc.accent }]}>{step.certification}</Text></View>}
                {step.emissions && <View style={s.detailRow}><Wind size={12} color={sc.accent} /><Text style={s.detailText}>{step.emissions}</Text></View>}
                {step.dataSource && <Text style={s.dataSource}>Source: {step.dataSource}</Text>}
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

  if (!currentProduct) {
    return (
      <View style={s.containerDark}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.onDarkMuted, fontSize: 16 }}>No product selected</Text>
          <Pressable onPress={() => router.back()} style={s.goBackBtn}>
            <Text style={s.goBackBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const product = currentProduct;
  const isPositive = product.score >= 70;
  const accentColor = isPositive ? colors.brandGreenDark : '#DC2626';
  const verified = product.auditSteps.filter(st => st.status === 'verified').length;
  const flagged = product.auditSteps.filter(st => st.status === 'flagged').length;
  const pending = product.auditSteps.filter(st => st.status === 'pending').length;

  return (
    <View style={s.container}>
      <DemoBanner message={product.dataSource === 'mock' ? 'DEMO — SAMPLE DATA ONLY' : undefined} />
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Dark hero header */}
        <View style={s.heroBand}>
          <Animated.View entering={FadeInDown.duration(300)}>
            <Pressable onPress={() => router.back()} style={s.backButton}>
              <ArrowLeft size={18} color={colors.onDarkMuted} />
              <Text style={s.backText}>BACK TO IMPACT</Text>
            </Pressable>
            <View style={s.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.auditLabel}>SUPPLY CHAIN AUDIT</Text>
                <Text style={s.productName}>{product.name}</Text>
                <Text style={s.productMeta}>{product.brand} · {product.id}</Text>
              </View>
              <StatusBadge status={product.status} size="lg" pulse={!isPositive} />
            </View>
          </Animated.View>

          {/* Progress bar on dark */}
          <Animated.View entering={FadeInUp.delay(200).duration(400)} style={s.progressSection}>
            <View style={s.progressHeader}>
              <Text style={s.progressLabel}>AUDIT PROGRESS</Text>
              <Text style={[s.progressPercent, { color: colors.brandGreen }]}>{product.auditProgress}%</Text>
            </View>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${product.auditProgress}%`, backgroundColor: colors.brandGreen }]} />
            </View>
          </Animated.View>
        </View>

        {/* White content surface */}
        <View style={s.whiteSurface}>
          {/* Summary card */}
          <Animated.View entering={FadeInUp.delay(300).duration(400)}
            style={[s.summaryCard, { backgroundColor: isPositive ? colors.brandGreenSoft : '#FEE2E2', borderColor: isPositive ? '#B8E8D5' : '#FECACA' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Shield size={18} color={accentColor} />
              <Text style={[s.summaryTitle, { color: accentColor }]}>
                {isPositive ? 'Verified Supply Chain' : 'Supply Chain Concerns'}
              </Text>
            </View>
            <Text style={s.summaryText}>
              {isPositive
                ? `This product has passed ${verified} of ${product.auditSteps.length} verification checkpoints. Supply chain transparency is above average.`
                : `This product has ${flagged} of ${product.auditSteps.length} checkpoints flagged for concerns. Supply chain transparency is below acceptable thresholds.`}
            </Text>
            <View style={s.statsRow}>
              <View style={s.statBox}><Text style={s.statNumber}>{verified}</Text><Text style={[s.statLabel, { color: colors.brandGreenDark }]}>VERIFIED</Text></View>
              <View style={s.statBox}><Text style={s.statNumber}>{flagged}</Text><Text style={[s.statLabel, { color: '#DC2626' }]}>FLAGGED</Text></View>
              <View style={s.statBox}><Text style={s.statNumber}>{pending}</Text><Text style={[s.statLabel, { color: colors.accentBlue }]}>PENDING</Text></View>
            </View>
          </Animated.View>

          {/* Steps */}
          <View style={s.stepsSection}>
            <Text style={s.stepsTitle}>VERIFICATION STEPS</Text>
            {product.auditSteps.map((step, index) => (
              <AuditStepCard key={step.id} step={step} index={index} />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  containerDark: { flex: 1, backgroundColor: colors.brandTealDeep },
  goBackBtn: { marginTop: 16, backgroundColor: colors.brandGreen, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 9999 },
  goBackBtnText: { color: colors.onPrimary, fontWeight: '600' },

  // Hero band
  heroBand: { backgroundColor: colors.brandTealDeep, paddingBottom: 24 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 16, marginBottom: 12 },
  backText: { fontSize: 11, fontWeight: '600', color: colors.onDarkMuted, letterSpacing: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20 },
  auditLabel: { fontSize: 11, fontWeight: '600', color: colors.brandGreen, letterSpacing: 2, marginBottom: 4 },
  productName: { fontSize: 22, color: colors.onDark, fontWeight: '500', letterSpacing: -0.5 },
  productMeta: { fontSize: 14, color: colors.onDarkMuted, marginTop: 2 },
  progressSection: { paddingHorizontal: 20, marginTop: 20 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontSize: 11, fontWeight: '600', color: colors.onDarkMuted, letterSpacing: 1 },
  progressPercent: { fontFamily: 'SourceCodePro-Bold', fontSize: 14 },
  progressTrack: { width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 9999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 9999 },

  // White surface
  whiteSurface: { backgroundColor: colors.canvas, paddingTop: 24 },
  summaryCard: { marginHorizontal: 20, marginBottom: 24, borderWidth: 1, borderRadius: 12, padding: 20 },
  summaryTitle: { fontSize: 16, fontWeight: '600' },
  summaryText: { fontSize: 14, color: colors.charcoal, lineHeight: 21 },
  statsRow: { flexDirection: 'row', marginTop: 16, gap: 12 },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 10, backgroundColor: colors.canvas, borderRadius: 8, borderWidth: 1, borderColor: colors.hairline },
  statNumber: { fontFamily: 'SourceCodePro-Bold', fontSize: 18, color: colors.ink },
  statLabel: { fontSize: 9, fontWeight: '600', letterSpacing: 1, marginTop: 2 },
  stepsSection: { paddingHorizontal: 20, marginBottom: 30 },
  stepsTitle: { fontSize: 11, fontWeight: '600', color: colors.steel, letterSpacing: 2, marginBottom: 12 },

  // Step cards
  stepCard: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
  stepHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  stepIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontSize: 10, fontWeight: '600', color: colors.steel, letterSpacing: 1.5, marginBottom: 2 },
  stepTitle: { fontSize: 14, color: colors.ink, fontWeight: '600' },
  stepExpanded: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.hairlineSoft },
  stepDescription: { fontSize: 14, color: colors.slate, lineHeight: 21, marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { fontSize: 12, color: colors.slate },
  dataSource: { fontSize: 11, color: colors.stone, marginTop: 8, fontStyle: 'italic' },
});
