// screens/ParsingScreen.tsx — MongoDB Design System
// Deep teal hero band with brand-green progress accents

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat,
  withDelay, withSpring, Easing, FadeIn,
} from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import CornerBrackets from '@/components/CornerBrackets';
import { useScan } from '@/stores/ScanContext';
import { predictFromBarcode, ProductNotFoundError } from '@/services/mlPrediction';
import { getRandomProduct } from '@/data/mockData';
import { colors } from '@/components/ui/theme';

const DOT_COUNT = 12;

function ScanDot({ delay: d, x, y }: { delay: number; x: number; y: number }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  useEffect(() => {
    scale.value = withDelay(d, withSpring(1, { damping: 8, stiffness: 100 }));
    opacity.value = withDelay(d, withTiming(1, { duration: 300 }));
  }, []);
  const ds = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));
  return (
    <Animated.View style={[ds, {
      position: 'absolute', left: '50%', top: '50%', marginLeft: x, marginTop: y,
      width: 6, height: 6, borderRadius: 3,
      backgroundColor: colors.brandGreen,
      shadowColor: colors.brandGreen, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 6,
    }]} />
  );
}

const DOT_POS = Array.from({ length: DOT_COUNT }, () => ({
  x: Math.random() * 200 - 100, y: Math.random() * 200 - 100,
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
    progressWidth.value = withTiming(95, { duration: 4000, easing: Easing.out(Easing.cubic) });
    labelOpacity.value = withRepeat(withTiming(1, { duration: 500 }), -1, true);
    const tts: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < DOT_COUNT; i++) {
      tts.push(setTimeout(() => { if (mountedRef.current) setDots(p => [...p, i]); }, i * 200));
    }
    performLookup();
    return () => { mountedRef.current = false; tts.forEach(clearTimeout); };
  }, []);

  const performLookup = async () => {
    const bv = barcode || 'demo';
    if (bv === 'demo') {
      setStatusText('Loading demo data...');
      await delay(2000);
      if (!mountedRef.current) return;
      const product = getRandomProduct();
      progressWidth.value = withTiming(100, { duration: 300 });
      setStatusText('Complete!');
      await delay(500);
      if (!mountedRef.current) return;
      setCurrentProduct(product); addToHistory(product);
      router.replace('/impact');
      return;
    }
    try {
      setStatusText('Querying Open Food Facts...');
      await delay(800);
      setStatusText('Fetching product data...');
      const result = await predictFromBarcode(bv);
      if (!mountedRef.current) return;
      setStatusText(`Running ML prediction (${result.mlPrediction.method.replace('_', ' ')})...`);
      await delay(600);
      if (!mountedRef.current) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      progressWidth.value = withTiming(100, { duration: 300 });
      setStatusText(`Analysis complete! Score: ${result.product.score}/100`);
      await delay(500);
      if (!mountedRef.current) return;
      setCurrentProduct(result.product); addToHistory(result.product);
      router.replace('/impact');
    } catch (e) {
      if (!mountedRef.current) return;
      if (e instanceof ProductNotFoundError) {
        progressWidth.value = withTiming(100, { duration: 300 });
        setStatusText('Product not found');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        await delay(600);
        if (!mountedRef.current) return;
        router.replace(`/productNotFound?barcode=${bv}`);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setError(e instanceof Error ? e.message : 'Failed to analyze product');
        setStatusText('Error');
      }
    }
  };

  const progressStyle = useAnimatedStyle(() => ({ width: `${progressWidth.value}%` }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: labelOpacity.value }));

  if (error) {
    return (
      <View style={s.errorContainer}>
        <Text style={s.errorTitle}>{error.includes('not found') ? 'Product Not Found' : 'Scan Failed'}</Text>
        <Text style={s.errorDesc}>{error}</Text>
        <Pressable onPress={() => router.back()} style={s.retryBtn}>
          <Text style={s.retryBtnText}>Try Another Scan</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.headerPos}>
        <Text style={s.headerLabel}>ECOTRACE SCANNER</Text>
      </View>
      <View style={s.viewport}>
        <CornerBrackets size={30} color={colors.brandGreen} pulseSpeed={800} />
        {dots.map(i => <ScanDot key={i} delay={0} x={DOT_POS[i].x} y={DOT_POS[i].y} />)}
      </View>
      <Animated.Text style={[labelStyle, s.analyzeLabel]}>ANALYZING...</Animated.Text>
      <Text style={s.statusText}>{statusText.toUpperCase()}</Text>
      <View style={s.progressTrack}>
        <Animated.View style={[progressStyle, s.progressFill]} />
      </View>
      <View style={s.checklist}>
        {['Product Identification', 'Environmental Data', 'Sustainability Score'].map((item, i) => (
          <Animated.View key={item} entering={FadeIn.delay(i * 800).duration(400)} style={s.checkItem}>
            <View style={[s.checkDot, {
              backgroundColor: i === 0 ? colors.brandGreen : i === 1 ? colors.accentBlue : colors.stone,
            }]} />
            <Text style={[s.checkText, {
              color: i === 0 ? colors.brandGreen : i === 1 ? colors.accentBlue : colors.stone,
            }]}>
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.brandTealDeep, alignItems: 'center', justifyContent: 'center' },
  headerPos: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 16 },
  headerLabel: { fontSize: 11, fontWeight: '600', color: colors.brandGreen, letterSpacing: 3 },
  viewport: { width: 280, height: 280, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  analyzeLabel: { fontSize: 14, fontWeight: '600', color: colors.brandGreen, letterSpacing: 4, marginTop: 30 },
  statusText: { fontSize: 11, color: colors.onDarkMuted, letterSpacing: 2, marginTop: 8 },
  progressTrack: { width: 280, height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 9999, marginTop: 24, overflow: 'hidden' },
  progressFill: {
    height: '100%', backgroundColor: colors.brandGreen, borderRadius: 9999,
    shadowColor: colors.brandGreen, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 8,
  },
  checklist: { marginTop: 40, alignItems: 'center', gap: 8 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkDot: { width: 4, height: 4, borderRadius: 2 },
  checkText: { fontFamily: 'SourceCodePro-Regular', fontSize: 12, letterSpacing: 1 },
  // Error
  errorContainer: { flex: 1, backgroundColor: colors.brandTealDeep, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorTitle: { fontSize: 22, color: colors.onDark, fontWeight: '500', marginBottom: 8, letterSpacing: -0.5 },
  errorDesc: { fontSize: 14, color: colors.onDarkMuted, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  retryBtn: { backgroundColor: colors.brandGreen, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 9999 },
  retryBtnText: { color: colors.onPrimary, fontWeight: '600', fontSize: 14 },
});
