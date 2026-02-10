// screens/ParsingScreen.tsx — REWRITTEN with real API integration
// Changes from audit:
//  - "NEURAL PARSING..." → "ANALYZING..."
//  - "NEURAL SCANNER v2.4" → "ECOTRACE SCANNER"
//  - Fake setTimeout → real Open Food Facts API call
//  - Demo fallback when barcode === 'demo'

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withDelay,
  withSpring,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import CornerBrackets from '@/components/CornerBrackets';
import { useScan } from '@/stores/ScanContext';
import { lookupBarcode } from '@/services/openFoodFacts';
import { mapOFFToProductScan } from '@/services/scoring';
import { getRandomProduct } from '@/data/mockData';

// Animated dots for the scanning effect
const DOT_COUNT = 12;

function ScanDot({ delay, x, y }: { delay: number; x: number; y: number }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(delay, withSpring(1, { damping: 8, stiffness: 100 }));
    opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
  }, []);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        dotStyle,
        {
          position: 'absolute',
          left: '50%',
          top: '50%',
          marginLeft: x,
          marginTop: y,
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: '#10b981',
          shadowColor: '#10b981',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 6,
        },
      ]}
    />
  );
}

// Pre-generate dot positions to avoid Math.random() in render
const DOT_POSITIONS = Array.from({ length: DOT_COUNT }, () => ({
  x: Math.random() * 200 - 100,
  y: Math.random() * 200 - 100,
}));

export default function ParsingScreen() {
  const router = useRouter();
  const { barcode } = useLocalSearchParams<{ barcode: string }>();
  const { setCurrentProduct, addToHistory } = useScan();

  const progressWidth = useSharedValue(0);
  const labelOpacity = useSharedValue(0.6);
  const [dots, setDots] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('Connecting to database...');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Animate progress bar
    progressWidth.value = withTiming(95, { duration: 4000, easing: Easing.out(Easing.cubic) });

    // Pulse the label
    labelOpacity.value = withRepeat(withTiming(1, { duration: 500 }), -1, true);

    // Add dots staggered
    const dotTimeouts: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < DOT_COUNT; i++) {
      dotTimeouts.push(setTimeout(() => {
        if (mountedRef.current) setDots(prev => [...prev, i]);
      }, i * 200));
    }

    // Perform the actual lookup
    performLookup();

    return () => {
      mountedRef.current = false;
      dotTimeouts.forEach(clearTimeout);
    };
  }, []);

  const performLookup = async () => {
    const barcodeValue = barcode || 'demo';

    // If demo mode, use mock data after a brief delay
    if (barcodeValue === 'demo') {
      setStatusText('Loading demo data...');
      await delay(2000);
      if (!mountedRef.current) return;

      const product = getRandomProduct();
      progressWidth.value = withTiming(100, { duration: 300 });
      setStatusText('Complete!');

      await delay(500);
      if (!mountedRef.current) return;

      setCurrentProduct(product);
      addToHistory(product);
      router.replace('/impact');
      return;
    }

    // Real barcode lookup via Open Food Facts
    try {
      setStatusText('Querying Open Food Facts...');
      await delay(800); // Let animation build up

      const offProduct = await lookupBarcode(barcodeValue);

      if (!mountedRef.current) return;

      if (!offProduct) {
        setError(`Product not found for barcode: ${barcodeValue}`);
        progressWidth.value = withTiming(100, { duration: 300 });
        setStatusText('Product not found');
        return;
      }

      setStatusText('Computing sustainability score...');
      await delay(600);
      if (!mountedRef.current) return;

      const product = mapOFFToProductScan(offProduct, barcodeValue);

      progressWidth.value = withTiming(100, { duration: 300 });
      setStatusText('Analysis complete!');

      await delay(500);
      if (!mountedRef.current) return;

      setCurrentProduct(product);
      addToHistory(product);
      router.replace('/impact');
    } catch (e) {
      if (!mountedRef.current) return;
      setError('Failed to analyze product. Please try again.');
      setStatusText('Error');
    }
  };

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
  }));

  const handleRetry = () => {
    router.back();
  };

  // ─── Error state ──────────────────────────────────────────────
  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <Text style={{ fontSize: 18, color: '#ffffff', fontWeight: '700', marginBottom: 8 }}>
          {error.includes('not found') ? 'Product Not Found' : 'Scan Failed'}
        </Text>
        <Text style={{
          fontFamily: 'SpaceMono-Regular', fontSize: 12, color: 'rgba(255,255,255,0.5)',
          textAlign: 'center', lineHeight: 20, marginBottom: 24,
        }}>
          {error}
        </Text>
        <Pressable
          onPress={handleRetry}
          style={{
            backgroundColor: '#10b981', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8,
          }}
        >
          <Text style={{ color: '#0f172a', fontWeight: '700' }}>Try Another Scan</Text>
        </Pressable>
      </View>
    );
  }

  // ─── Loading / parsing animation ──────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' }}>
      {/* Header — AUDIT FIX: Replaced "NEURAL SCANNER v2.4" */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 16 }}>
        <Text style={{
          fontFamily: 'SpaceMono-Regular', fontSize: 11,
          color: 'rgba(255,255,255,0.4)', letterSpacing: 3,
        }}>
          ECOTRACE SCANNER
        </Text>
      </View>

      {/* Scanner viewport with dots */}
      <View style={{ width: 280, height: 280, position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
        <CornerBrackets size={30} color="#10b981" pulseSpeed={800} />
        {dots.map(i => (
          <ScanDot key={i} delay={0} x={DOT_POSITIONS[i].x} y={DOT_POSITIONS[i].y} />
        ))}
      </View>

      {/* Status text — AUDIT FIX: Replaced "NEURAL PARSING..." */}
      <Animated.Text style={[labelStyle, {
        fontFamily: 'SpaceMono-Regular', fontSize: 14,
        color: '#10b981', letterSpacing: 4, marginTop: 30,
      }]}>
        ANALYZING...
      </Animated.Text>

      {/* Dynamic status */}
      <Text style={{
        fontFamily: 'SpaceMono-Regular', fontSize: 10,
        color: 'rgba(255,255,255,0.3)', letterSpacing: 2, marginTop: 8,
      }}>
        {statusText.toUpperCase()}
      </Text>

      {/* Progress bar */}
      <View style={{
        width: 280, height: 4, backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 2, marginTop: 24, overflow: 'hidden',
      }}>
        <Animated.View style={[progressStyle, {
          height: '100%', backgroundColor: '#10b981', borderRadius: 2,
          shadowColor: '#10b981', shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6, shadowRadius: 8,
        }]} />
      </View>

      {/* Scanning checklist */}
      <View style={{ marginTop: 40, alignItems: 'center', gap: 8 }}>
        {['Product Identification', 'Environmental Data', 'Sustainability Score'].map((item, i) => (
          <Animated.View
            key={item}
            entering={FadeIn.delay(i * 800).duration(400)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <View style={{
              width: 4, height: 4, borderRadius: 2,
              backgroundColor: i === 0 ? '#10b981' : i === 1 ? '#3b82f6' : 'rgba(255,255,255,0.3)',
            }} />
            <Text style={{
              fontFamily: 'SpaceMono-Regular', fontSize: 11,
              color: i === 0 ? '#10b981' : i === 1 ? '#3b82f6' : 'rgba(255,255,255,0.3)',
              letterSpacing: 1,
            }}>
              {i === 0 ? '✓ ' : i === 1 ? '◎ ' : '○ '}{item}
            </Text>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
