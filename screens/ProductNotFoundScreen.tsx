// screens/ProductNotFoundScreen.tsx — MongoDB Design System
// Dark teal hero → white card surface for recovery options

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useScan } from '@/stores/ScanContext';
import { quickPredict, getAvailableCategories } from '@/services/mlPrediction';
import { colors } from '@/components/ui/theme';

export default function ProductNotFoundScreen() {
  const router = useRouter();
  const { barcode } = useLocalSearchParams<{ barcode: string }>();
  const { setCurrentProduct, addToHistory } = useScan();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const categories = getAvailableCategories();

  const handleQuickEstimate = useCallback(async () => {
    if (!selectedCategory || !barcode) return;
    setIsEstimating(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    const product = quickPredict(barcode, selectedCategory);
    setCurrentProduct(product); addToHistory(product);
    router.replace('/impact');
  }, [selectedCategory, barcode, setCurrentProduct, addToHistory, router]);

  const handleAddProduct = useCallback(() => {
    router.push(`/photoUpload?barcode=${barcode || ''}`);
  }, [barcode, router]);

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Dark teal hero header */}
        <View style={s.heroBand}>
          <Animated.View entering={FadeIn.duration(400)} style={s.header}>
            <Text style={s.headerLabel}>ECOTRACE</Text>
            <View style={s.iconCircle}>
              <Text style={s.iconText}>?</Text>
            </View>
            <Text style={s.title}>Product Not Found</Text>
            <Text style={s.subtitle}>
              Barcode {barcode || 'unknown'} isn't in our database yet.
              {'\n'}You can still get a sustainability estimate.
            </Text>
          </Animated.View>
        </View>

        {/* White surface with cards */}
        <View style={s.whiteSurface}>
          {/* Option 1: Quick Estimate */}
          <Animated.View entering={FadeInDown.delay(150).duration(400)}>
            <View style={s.card}>
              <View style={s.cardHeader}>
                <View style={[s.badge, { backgroundColor: colors.brandGreenSoft }]}>
                  <Text style={[s.badgeText, { color: colors.brandGreenDark }]}>QUICK</Text>
                </View>
                <Text style={s.cardTitle}>Category Estimate</Text>
              </View>
              <Text style={s.cardDescription}>
                Select a product category to get an estimated sustainability score
                based on category averages. Takes ~2 seconds.
              </Text>
              <View style={s.categoryGrid}>
                {categories.map(cat => (
                  <Pressable key={cat.key} onPress={() => setSelectedCategory(cat.key)}
                    style={[s.categoryChip, selectedCategory === cat.key && s.categoryChipSelected]}>
                    <Text style={[s.categoryChipText, selectedCategory === cat.key && s.categoryChipTextSelected]}>
                      {cat.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable onPress={handleQuickEstimate} disabled={!selectedCategory || isEstimating}
                style={[s.primaryButton, (!selectedCategory || isEstimating) && s.primaryButtonDisabled]}>
                <Text style={s.primaryButtonText}>
                  {isEstimating ? 'Estimating...' : 'Get Estimated Score'}
                </Text>
              </Pressable>
              {selectedCategory && (
                <Text style={s.disclaimerText}>
                  Confidence: Estimated — based on category averages, not product-specific data.
                </Text>
              )}
            </View>
          </Animated.View>

          {/* Option 2: Add Product */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <Pressable onPress={handleAddProduct} style={s.card}>
              <View style={s.cardHeader}>
                <View style={[s.badge, { backgroundColor: '#EBF5FF' }]}>
                  <Text style={[s.badgeText, { color: colors.accentBlue }]}>DETAILED</Text>
                </View>
                <Text style={s.cardTitle}>Add Product Info</Text>
              </View>
              <Text style={s.cardDescription}>
                Type label text or product details for a more accurate score.
                Our NLP engine will extract certifications, packaging info,
                and environmental claims automatically.
              </Text>
              <View style={s.secondaryButton}>
                <Text style={s.secondaryButtonText}>Enter Product Details →</Text>
              </View>
            </Pressable>
          </Animated.View>

          {/* Option 3: Try again */}
          <Animated.View entering={FadeInDown.delay(450).duration(400)}>
            <Pressable onPress={() => router.back()} style={s.card}>
              <View style={s.cardHeader}>
                <View style={[s.badge, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[s.badgeText, { color: colors.accentOrange }]}>RESCAN</Text>
                </View>
                <Text style={s.cardTitle}>Try Different Barcode</Text>
              </View>
              <Text style={s.cardDescription}>
                Go back to the scanner and try a different barcode. Make sure
                the barcode is well-lit and fully visible in the frame.
              </Text>
            </Pressable>
          </Animated.View>

          {/* Info footer */}
          <Animated.View entering={FadeInDown.delay(600).duration(400)} style={s.infoFooter}>
            <Text style={s.infoText}>
              Open Food Facts has 3M+ products. If yours isn't listed,
              your contribution helps everyone. Scores from added products
              will be marked as "estimated" until verified.
            </Text>
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: { flexGrow: 1 },
  // Dark hero
  heroBand: { backgroundColor: colors.brandTealDeep, paddingTop: 60, paddingBottom: 32 },
  header: { alignItems: 'center', paddingHorizontal: 20 },
  headerLabel: { fontSize: 11, fontWeight: '600', color: colors.brandGreen, letterSpacing: 3, marginBottom: 20 },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(249,115,22,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  iconText: { fontSize: 28, fontWeight: '700', color: colors.accentOrange },
  title: { fontSize: 22, fontWeight: '500', color: colors.onDark, marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: colors.onDarkMuted, textAlign: 'center', lineHeight: 21, maxWidth: 300 },
  // White surface
  whiteSurface: { backgroundColor: colors.canvas, padding: 20, paddingTop: 24 },
  card: {
    backgroundColor: colors.canvas, borderRadius: 12, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: colors.hairline,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.ink },
  cardDescription: { fontSize: 14, color: colors.slate, lineHeight: 21, marginBottom: 16 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  categoryChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline,
  },
  categoryChipSelected: { backgroundColor: colors.brandGreenSoft, borderColor: colors.brandGreen },
  categoryChipText: { fontSize: 13, color: colors.slate, fontWeight: '500' },
  categoryChipTextSelected: { color: colors.brandGreenDark, fontWeight: '600' },
  primaryButton: {
    backgroundColor: colors.brandGreen, paddingVertical: 14,
    borderRadius: 9999, alignItems: 'center',
  },
  primaryButtonDisabled: { opacity: 0.4 },
  primaryButtonText: { color: colors.onPrimary, fontWeight: '600', fontSize: 14 },
  secondaryButton: {
    borderWidth: 1, borderColor: colors.hairlineStrong, paddingVertical: 12,
    borderRadius: 9999, alignItems: 'center',
  },
  secondaryButtonText: { color: colors.ink, fontWeight: '600', fontSize: 14 },
  disclaimerText: { fontSize: 12, color: colors.steel, textAlign: 'center', marginTop: 10, fontStyle: 'italic' },
  infoFooter: { marginTop: 8, padding: 16, borderRadius: 12, backgroundColor: colors.surfaceSoft },
  infoText: { fontSize: 12, color: colors.steel, textAlign: 'center', lineHeight: 18 },
});
