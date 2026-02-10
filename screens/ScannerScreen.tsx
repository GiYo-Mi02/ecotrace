import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Crosshair, Zap, Radio } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import CornerBrackets from '@/components/CornerBrackets';
import StatusBadge from '@/components/StatusBadge';
import ScoreRing from '@/components/ScoreRing';
import { SCAN_PROTOCOLS } from '@/data/mockData';
import type { ProductScan } from '@/data/mockData';

interface ScannerScreenProps {
  onScan: () => void;
  lastScan: ProductScan | null;
  onViewLastScan: () => void;
}

export default function ScannerScreen({ onScan, lastScan, onViewLastScan }: ScannerScreenProps) {
  const pulseScale = useSharedValue(1);
  const crosshairOpacity = useSharedValue(0.4);
  const buttonPressed = useSharedValue(1);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withTiming(1.05, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    crosshairOpacity.value = withRepeat(
      withTiming(0.8, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const crosshairStyle = useAnimatedStyle(() => ({
    opacity: crosshairOpacity.value,
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonPressed.value }],
  }));

  const handlePressIn = () => {
    buttonPressed.value = withSpring(0.96);
  };

  const handlePressOut = () => {
    buttonPressed.value = withSpring(1);
    onScan();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
        <Text
          style={{
            fontFamily: 'SpaceMono-Regular',
            fontSize: 11,
            color: 'rgba(255,255,255,0.4)',
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}
        >
          NEURAL SCANNER v2.4
        </Text>
        <Text
          style={{
            fontFamily: 'SpaceMono-Regular',
            fontSize: 22,
            color: '#ffffff',
            fontWeight: '700',
            marginTop: 4,
          }}
        >
          Product Scanner
        </Text>
      </View>

      {/* Protocol Pills */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 20 }}>
        {SCAN_PROTOCOLS.slice(0, 3).map((protocol, index) => (
          <View
            key={protocol}
            style={{
              backgroundColor: index === 0 ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
              borderWidth: 1,
              borderColor: index === 0 ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)',
              borderRadius: 20,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <Text
              style={{
                fontFamily: 'SpaceMono-Regular',
                fontSize: 9,
                color: index === 0 ? '#10b981' : 'rgba(255,255,255,0.5)',
                letterSpacing: 1.5,
              }}
            >
              {protocol}
            </Text>
          </View>
        ))}
      </View>

      {/* Scanner Viewport */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 }}>
        <View
          style={{
            width: '100%',
            aspectRatio: 1,
            maxWidth: 300,
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <CornerBrackets size={30} color="#10b981" />

          {/* Grid pattern */}
          <View
            style={{
              position: 'absolute',
              width: '80%',
              height: '80%',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.03)',
              borderRadius: 4,
            }}
          />
          <View
            style={{
              position: 'absolute',
              width: '60%',
              height: '60%',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.03)',
              borderRadius: 4,
            }}
          />

          {/* Crosshair */}
          <Animated.View style={[crosshairStyle, { alignItems: 'center', justifyContent: 'center' }]}>
            <Crosshair size={60} color="rgba(16,185,129,0.5)" strokeWidth={1} />
          </Animated.View>

          {/* Status text */}
          <View style={{ position: 'absolute', bottom: 20, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Radio size={10} color="#10b981" />
              <Text
                style={{
                  fontFamily: 'SpaceMono-Regular',
                  fontSize: 10,
                  color: '#10b981',
                  letterSpacing: 2,
                }}
              >
                READY TO SCAN
              </Text>
            </View>
          </View>
        </View>

        {/* Scan Button */}
        <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
          <Animated.View
            style={[
              pulseStyle,
              buttonStyle,
              {
                marginTop: 30,
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: '#10b981',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#10b981',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5,
                shadowRadius: 20,
                elevation: 10,
              },
            ]}
          >
            <Zap size={32} color="#0f172a" fill="#0f172a" />
          </Animated.View>
        </Pressable>
        <Text
          style={{
            fontFamily: 'SpaceMono-Regular',
            fontSize: 10,
            color: 'rgba(255,255,255,0.4)',
            marginTop: 12,
            letterSpacing: 2,
          }}
        >
          TAP TO SCAN
        </Text>
      </View>

      {/* Last Scan Preview */}
      {lastScan && (
        <Pressable onPress={onViewLastScan}>
          <View
            style={{
              marginHorizontal: 20,
              marginBottom: 12,
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
              borderRadius: 12,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <ScoreRing score={lastScan.score} size={44} strokeWidth={3} showLabel={false} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: 'SpaceMono-Regular',
                  fontSize: 9,
                  color: 'rgba(255,255,255,0.4)',
                  letterSpacing: 1,
                  marginBottom: 2,
                }}
              >
                LAST SCAN
              </Text>
              <Text style={{ fontSize: 14, color: '#ffffff', fontWeight: '600' }}>
                {lastScan.name}
              </Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                {lastScan.brand} · {lastScan.scanDate}
              </Text>
            </View>
            <StatusBadge status={lastScan.status} size="sm" />
          </View>
        </Pressable>
      )}
    </View>
  );
}
