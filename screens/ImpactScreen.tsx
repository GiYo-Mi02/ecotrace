import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { ArrowLeft, Leaf, Wind, Truck, ChevronRight, Shield } from 'lucide-react-native';
import Animated, {
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import ScoreRing from '@/components/ScoreRing';
import StatusBadge from '@/components/StatusBadge';
import type { ProductScan } from '@/data/mockData';

interface ImpactScreenProps {
  product: ProductScan;
  onBack: () => void;
  onViewAudit: () => void;
}

export default function ImpactScreen({ product, onBack, onViewAudit }: ImpactScreenProps) {
  const auditButtonScale = useSharedValue(1);

  const auditButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: auditButtonScale.value }],
  }));

  const color = product.score >= 70 ? '#10b981' : product.score >= 40 ? '#f59e0b' : '#f43f5e';

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View
          entering={FadeInDown.duration(300)}
          style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}
        >
          <Pressable
            onPress={onBack}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}
          >
            <ArrowLeft size={18} color="rgba(255,255,255,0.6)" />
            <Text style={{ fontFamily: 'SpaceMono-Regular', fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: 2 }}>
              BACK TO SCANNER
            </Text>
          </Pressable>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontFamily: 'SpaceMono-Regular', fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 2 }}>
                {product.id}
              </Text>
              <Text style={{ fontSize: 20, color: '#ffffff', fontWeight: '700', marginTop: 4 }}>
                {product.name}
              </Text>
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                {product.brand} · {product.category}
              </Text>
            </View>
            <StatusBadge status={product.status} />
          </View>
        </Animated.View>

        {/* Score Ring */}
        <Animated.View
          entering={FadeInUp.delay(200).duration(500)}
          style={{ alignItems: 'center', paddingVertical: 30 }}
        >
          <ScoreRing score={product.score} size={180} strokeWidth={8} />
          <Text
            style={{
              fontFamily: 'SpaceMono-Regular',
              fontSize: 11,
              color: 'rgba(255,255,255,0.4)',
              marginTop: 12,
              letterSpacing: 2,
            }}
          >
            SUSTAINABILITY INDEX
          </Text>
        </Animated.View>

        {/* Metrics Row */}
        <Animated.View
          entering={FadeInUp.delay(400).duration(400)}
          style={{
            flexDirection: 'row',
            paddingHorizontal: 20,
            gap: 10,
            marginBottom: 24,
          }}
        >
          {[
            { icon: Leaf, label: 'RENEWABLE', value: `${product.renewablePercent}%`, color: '#10b981' },
            { icon: Wind, label: 'EMISSIONS', value: product.emissions, color: product.score >= 70 ? '#10b981' : '#f43f5e' },
            { icon: Truck, label: 'TRANSPORT', value: product.transportDistance, color: '#3b82f6' },
          ].map((metric, index) => (
            <View
              key={metric.label}
              style={{
                flex: 1,
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)',
                borderRadius: 12,
                padding: 12,
                alignItems: 'center',
                gap: 6,
              }}
            >
              <metric.icon size={18} color={metric.color} />
              <Text
                style={{
                  fontFamily: 'SpaceMono-Regular',
                  fontSize: 14,
                  color: '#ffffff',
                  fontWeight: '700',
                }}
              >
                {metric.value}
              </Text>
              <Text
                style={{
                  fontFamily: 'SpaceMono-Regular',
                  fontSize: 8,
                  color: 'rgba(255,255,255,0.4)',
                  letterSpacing: 1.5,
                }}
              >
                {metric.label}
              </Text>
            </View>
          ))}
        </Animated.View>

        {/* Material Breakdown Teaser */}
        <Animated.View
          entering={FadeInUp.delay(600).duration(400)}
          style={{ paddingHorizontal: 20, marginBottom: 16 }}
        >
          <Text
            style={{
              fontFamily: 'SpaceMono-Regular',
              fontSize: 11,
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: 2,
              marginBottom: 12,
            }}
          >
            MATERIAL BREAKDOWN
          </Text>
          {product.materials.map((material, index) => (
            <View
              key={index}
              style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.08)',
                borderRadius: 10,
                padding: 12,
                marginBottom: 8,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: '#ffffff', fontWeight: '600' }}>
                  {material.material}
                </Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                  {material.origin}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {material.certification && (
                  <View
                    style={{
                      backgroundColor: 'rgba(16,185,129,0.15)',
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 4,
                    }}
                  >
                    <Text style={{ fontFamily: 'SpaceMono-Regular', fontSize: 8, color: '#10b981', letterSpacing: 0.5 }}>
                      {material.certification}
                    </Text>
                  </View>
                )}
                {material.verified ? (
                  <Shield size={14} color="#10b981" />
                ) : (
                  <Shield size={14} color="#f43f5e" />
                )}
              </View>
            </View>
          ))}
        </Animated.View>

        {/* Deep Audit Button */}
        <Animated.View
          entering={FadeInUp.delay(800).duration(400)}
          style={{ paddingHorizontal: 20, marginBottom: 30 }}
        >
          <Pressable
            onPressIn={() => {
              auditButtonScale.value = withSpring(0.98);
            }}
            onPressOut={() => {
              auditButtonScale.value = withSpring(1);
              onViewAudit();
            }}
          >
            <Animated.View
              style={[
                auditButtonStyle,
                {
                  backgroundColor: `${color}15`,
                  borderWidth: 1,
                  borderColor: `${color}40`,
                  borderRadius: 12,
                  padding: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Shield size={20} color={color} />
                <View>
                  <Text style={{ fontSize: 14, color: '#ffffff', fontWeight: '700' }}>
                    Deep Supply Chain Audit
                  </Text>
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                    {product.auditSteps.length} verification steps · {product.auditProgress}% complete
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color={color} />
            </Animated.View>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
