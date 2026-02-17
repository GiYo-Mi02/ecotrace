// screens/ProductNotFoundScreen.tsx — Shown when barcode isn't in Open Food Facts
//
// Gives the user 3 paths forward:
//  1. Get a quick ML-estimated score by selecting a category
//  2. Add product details via photo / manual entry (deeper data → better score)
//  3. Go back and try a different barcode

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useScan } from '@/stores/ScanContext';
import { quickPredict, getAvailableCategories } from '@/services/mlPrediction';

const COLORS = {
  bg: '#0f172a',
  card: '#1e293b',
  cardBorder: 'rgba(255,255,255,0.08)',
  accent: '#10b981',
  accentDim: 'rgba(16,185,129,0.15)',
  warning: '#f59e0b',
  warningDim: 'rgba(245,158,11,0.15)',
  blue: '#3b82f6',
  blueDim: 'rgba(59,130,246,0.15)',
  white: '#ffffff',
  muted: 'rgba(255,255,255,0.5)',
  dimText: 'rgba(255,255,255,0.35)',
};

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

    // Brief delay so the user sees the loading state
    await new Promise(resolve => setTimeout(resolve, 800));

    const product = quickPredict(barcode, selectedCategory);
    setCurrentProduct(product);
    addToHistory(product);
    router.replace('/impact');
  }, [selectedCategory, barcode, setCurrentProduct, addToHistory, router]);

  const handleAddProduct = useCallback(() => {
    router.push(`/photoUpload?barcode=${barcode || ''}`);
  }, [barcode, router]);

  const handleGoBack = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
          <Text style={styles.headerLabel}>ECOTRACE</Text>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>?</Text>
          </View>
          <Text style={styles.title}>Product Not Found</Text>
          <Text style={styles.subtitle}>
            Barcode {barcode || 'unknown'} isn't in our database yet.
            {'\n'}You can still get a sustainability estimate.
          </Text>
        </Animated.View>

        {/* Option 1: Quick Estimate */}
        <Animated.View entering={FadeInDown.delay(150).duration(400)}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.badge, { backgroundColor: COLORS.accentDim }]}>
                <Text style={[styles.badgeText, { color: COLORS.accent }]}>QUICK</Text>
              </View>
              <Text style={styles.cardTitle}>Category Estimate</Text>
            </View>
            <Text style={styles.cardDescription}>
              Select a product category to get an estimated sustainability score
              based on category averages. Takes ~2 seconds.
            </Text>

            {/* Category selector */}
            <View style={styles.categoryGrid}>
              {categories.map(cat => (
                <Pressable
                  key={cat.key}
                  onPress={() => setSelectedCategory(cat.key)}
                  style={[
                    styles.categoryChip,
                    selectedCategory === cat.key && styles.categoryChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      selectedCategory === cat.key && styles.categoryChipTextSelected,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={handleQuickEstimate}
              disabled={!selectedCategory || isEstimating}
              style={[
                styles.primaryButton,
                (!selectedCategory || isEstimating) && styles.primaryButtonDisabled,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {isEstimating ? 'Estimating...' : 'Get Estimated Score'}
              </Text>
            </Pressable>

            {selectedCategory && (
              <Text style={styles.disclaimerText}>
                Confidence: Estimated — based on category averages, not product-specific data.
              </Text>
            )}
          </View>
        </Animated.View>

        {/* Option 2: Add Product */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <Pressable onPress={handleAddProduct} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.badge, { backgroundColor: COLORS.blueDim }]}>
                <Text style={[styles.badgeText, { color: COLORS.blue }]}>DETAILED</Text>
              </View>
              <Text style={styles.cardTitle}>Add Product Info</Text>
            </View>
            <Text style={styles.cardDescription}>
              Type label text or product details for a more accurate score.
              Our NLP engine will extract certifications, packaging info,
              and environmental claims automatically.
            </Text>
            <View style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Enter Product Details →</Text>
            </View>
          </Pressable>
        </Animated.View>

        {/* Option 3: Try again */}
        <Animated.View entering={FadeInDown.delay(450).duration(400)}>
          <Pressable onPress={handleGoBack} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.badge, { backgroundColor: COLORS.warningDim }]}>
                <Text style={[styles.badgeText, { color: COLORS.warning }]}>RESCAN</Text>
              </View>
              <Text style={styles.cardTitle}>Try Different Barcode</Text>
            </View>
            <Text style={styles.cardDescription}>
              Go back to the scanner and try a different barcode. Make sure
              the barcode is well-lit and fully visible in the frame.
            </Text>
          </Pressable>
        </Animated.View>

        {/* Info footer */}
        <Animated.View entering={FadeInDown.delay(600).duration(400)} style={styles.infoFooter}>
          <Text style={styles.infoText}>
            Open Food Facts has 3M+ products. If yours isn't listed,
            your contribution helps everyone. Scores from added products
            will be marked as "estimated" until verified.
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  headerLabel: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 11,
    color: COLORS.dimText,
    letterSpacing: 3,
    marginBottom: 20,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.warningDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.warning,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
  cardDescription: {
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 20,
    marginBottom: 16,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  categoryChipSelected: {
    backgroundColor: COLORS.accentDim,
    borderColor: COLORS.accent,
  },
  categoryChipText: {
    fontSize: 12,
    color: COLORS.muted,
    fontWeight: '500',
  },
  categoryChipTextSelected: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: COLORS.bg,
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: COLORS.blue,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: COLORS.blue,
    fontWeight: '600',
    fontSize: 14,
  },
  disclaimerText: {
    fontSize: 11,
    color: COLORS.dimText,
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
  infoFooter: {
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  infoText: {
    fontSize: 11,
    color: COLORS.dimText,
    textAlign: 'center',
    lineHeight: 18,
  },
});
