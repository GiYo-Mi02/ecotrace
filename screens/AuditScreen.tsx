import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import {
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Clock,
  Factory,
  Zap,
  Award,
  Wind,
  ChevronDown,
  ChevronUp,
  Shield,
} from 'lucide-react-native';
import Animated, {
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import StatusBadge from '@/components/StatusBadge';
import type { ProductScan, AuditStep } from '@/data/mockData';

interface AuditScreenProps {
  product: ProductScan;
  onBack: () => void;
}

function AuditStepCard({ step, index, isPositive }: { step: AuditStep; index: number; isPositive: boolean }) {
  const [expanded, setExpanded] = React.useState(false);

  const accentColor = step.status === 'verified' ? '#10b981' : step.status === 'flagged' ? '#f43f5e' : '#3b82f6';
  const bgColor = step.status === 'verified' ? 'rgba(16,185,129,0.08)' : step.status === 'flagged' ? 'rgba(244,63,94,0.08)' : 'rgba(59,130,246,0.08)';
  const borderColor = step.status === 'verified' ? 'rgba(16,185,129,0.2)' : step.status === 'flagged' ? 'rgba(244,63,94,0.2)' : 'rgba(59,130,246,0.2)';

  const StatusIcon = step.status === 'verified' ? CheckCircle : step.status === 'flagged' ? AlertTriangle : Clock;

  return (
    <Animated.View entering={FadeInUp.delay(index * 100 + 300).duration(300).springify()}>
      <Pressable onPress={() => setExpanded(!expanded)}>
        <View
          style={{
            backgroundColor: bgColor,
            borderWidth: 1,
            borderColor: borderColor,
            borderRadius: 12,
            padding: 14,
            marginBottom: 10,
          }}
        >
          {/* Step header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: `${accentColor}20`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <StatusIcon size={16} color={accentColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: 'SpaceMono-Regular',
                    fontSize: 8,
                    color: 'rgba(255,255,255,0.4)',
                    letterSpacing: 1.5,
                    marginBottom: 2,
                  }}
                >
                  STEP {index + 1} · {step.id}
                </Text>
                <Text style={{ fontSize: 13, color: '#ffffff', fontWeight: '600' }}>
                  {step.title}
                </Text>
              </View>
            </View>
            {expanded ? (
              <ChevronUp size={16} color="rgba(255,255,255,0.4)" />
            ) : (
              <ChevronDown size={16} color="rgba(255,255,255,0.4)" />
            )}
          </View>

          {/* Expanded content */}
          {expanded && (
            <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 18, marginBottom: 12 }}>
                {step.description}
              </Text>

              {/* Details grid */}
              <View style={{ gap: 8 }}>
                {step.facility && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Factory size={12} color={accentColor} />
                    <Text style={{ fontFamily: 'SpaceMono-Regular', fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5 }}>
                      {step.facility}
                    </Text>
                  </View>
                )}
                {step.energySource && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Zap size={12} color={accentColor} />
                    <Text style={{ fontFamily: 'SpaceMono-Regular', fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5 }}>
                      {step.energySource}
                    </Text>
                  </View>
                )}
                {step.certification && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Award size={12} color={accentColor} />
                    <Text style={{ fontFamily: 'SpaceMono-Regular', fontSize: 10, color: accentColor, letterSpacing: 0.5 }}>
                      {step.certification}
                    </Text>
                  </View>
                )}
                {step.emissions && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Wind size={12} color={accentColor} />
                    <Text style={{ fontFamily: 'SpaceMono-Regular', fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5 }}>
                      {step.emissions}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function AuditScreen({ product, onBack }: AuditScreenProps) {
  const isPositive = product.score >= 70;
  const accentColor = isPositive ? '#10b981' : '#f43f5e';
  const badgePulse = useSharedValue(1);

  React.useEffect(() => {
    if (!isPositive) {
      badgePulse.value = withRepeat(withTiming(0.6, { duration: 1000 }), -1, true);
    }
  }, []);

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: badgePulse.value,
  }));

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View
          entering={FadeInDown.duration(300)}
          style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}
        >
          <Pressable
            onPress={onBack}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}
          >
            <ArrowLeft size={18} color="rgba(255,255,255,0.6)" />
            <Text style={{ fontFamily: 'SpaceMono-Regular', fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: 2 }}>
              BACK TO IMPACT
            </Text>
          </Pressable>

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: 'SpaceMono-Regular',
                  fontSize: 9,
                  color: 'rgba(255,255,255,0.4)',
                  letterSpacing: 2,
                  marginBottom: 4,
                }}
              >
                DEEP SUPPLY CHAIN AUDIT
              </Text>
              <Text style={{ fontSize: 18, color: '#ffffff', fontWeight: '700' }}>
                {product.name}
              </Text>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                {product.brand} · {product.id}
              </Text>
            </View>
            <StatusBadge status={product.status} size="lg" pulse={!isPositive} />
          </View>
        </Animated.View>

        {/* Progress bar */}
        <Animated.View
          entering={FadeInUp.delay(200).duration(400)}
          style={{ paddingHorizontal: 20, marginBottom: 20 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontFamily: 'SpaceMono-Regular', fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 }}>
              AUDIT PROGRESS
            </Text>
            <Text style={{ fontFamily: 'SpaceMono-Regular', fontSize: 14, color: accentColor, fontWeight: '700' }}>
              {product.auditProgress}%
            </Text>
          </View>
          <View
            style={{
              width: '100%',
              height: 6,
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${product.auditProgress}%`,
                height: '100%',
                backgroundColor: accentColor,
                borderRadius: 3,
                shadowColor: accentColor,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.6,
                shadowRadius: 8,
              }}
            />
          </View>
        </Animated.View>

        {/* Summary card */}
        <Animated.View
          entering={FadeInUp.delay(300).duration(400)}
          style={{
            marginHorizontal: 20,
            marginBottom: 20,
            backgroundColor: `${accentColor}10`,
            borderWidth: 1,
            borderColor: `${accentColor}30`,
            borderRadius: 12,
            padding: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Shield size={18} color={accentColor} />
            <Text style={{ fontSize: 14, color: '#ffffff', fontWeight: '700' }}>
              {isPositive ? 'Verified Supply Chain' : 'Supply Chain Concerns'}
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 18 }}>
            {isPositive
              ? `This product has passed ${product.auditSteps.filter(s => s.status === 'verified').length} of ${product.auditSteps.length} verification checkpoints. Supply chain transparency is above average.`
              : `This product has ${product.auditSteps.filter(s => s.status === 'flagged').length} of ${product.auditSteps.length} checkpoints flagged for concerns. Supply chain transparency is below acceptable thresholds.`}
          </Text>

          {/* Quick stats */}
          <View style={{ flexDirection: 'row', marginTop: 12, gap: 12 }}>
            <View style={{ flex: 1, alignItems: 'center', paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
              <Text style={{ fontFamily: 'SpaceMono-Regular', fontSize: 16, color: '#ffffff', fontWeight: '700' }}>
                {product.auditSteps.filter(s => s.status === 'verified').length}
              </Text>
              <Text style={{ fontFamily: 'SpaceMono-Regular', fontSize: 8, color: '#10b981', letterSpacing: 1, marginTop: 2 }}>
                VERIFIED
              </Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center', paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
              <Text style={{ fontFamily: 'SpaceMono-Regular', fontSize: 16, color: '#ffffff', fontWeight: '700' }}>
                {product.auditSteps.filter(s => s.status === 'flagged').length}
              </Text>
              <Text style={{ fontFamily: 'SpaceMono-Regular', fontSize: 8, color: '#f43f5e', letterSpacing: 1, marginTop: 2 }}>
                FLAGGED
              </Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center', paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
              <Text style={{ fontFamily: 'SpaceMono-Regular', fontSize: 16, color: '#ffffff', fontWeight: '700' }}>
                {product.auditSteps.filter(s => s.status === 'pending').length}
              </Text>
              <Text style={{ fontFamily: 'SpaceMono-Regular', fontSize: 8, color: '#3b82f6', letterSpacing: 1, marginTop: 2 }}>
                PENDING
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Audit Steps */}
        <View style={{ paddingHorizontal: 20, marginBottom: 30 }}>
          <Text
            style={{
              fontFamily: 'SpaceMono-Regular',
              fontSize: 11,
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: 2,
              marginBottom: 12,
            }}
          >
            VERIFICATION STEPS
          </Text>
          {product.auditSteps.map((step, index) => (
            <AuditStepCard
              key={step.id}
              step={step}
              index={index}
              isPositive={isPositive}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
