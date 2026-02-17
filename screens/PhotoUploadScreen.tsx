// screens/PhotoUploadScreen.tsx — Manual product entry with NLP analysis
//
// User types/pastes label text → our NLP engine extracts certifications,
// packaging info, environmental claims, and greenwashing flags → feeds
// into ML prediction for a sustainability score.
//
// No external OCR library needed — users type the text they see on the label.
// This approach is more reliable than OCR on mobile and zero-dependency.

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useScan } from '@/stores/ScanContext';
import { predictSustainabilityScore, getAvailableCategories } from '@/services/mlPrediction';
import {
  analyzeLabelText,
  extractCertificationNames,
  summarizePackaging,
} from '@/services/ocrService';
import type { LabelAnalysisResult } from '@/services/ocrService';

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
  red: '#ef4444',
  redDim: 'rgba(239,68,68,0.15)',
  white: '#ffffff',
  muted: 'rgba(255,255,255,0.5)',
  dimText: 'rgba(255,255,255,0.35)',
  inputBg: 'rgba(255,255,255,0.06)',
  inputBorder: 'rgba(255,255,255,0.12)',
};

export default function PhotoUploadScreen() {
  const router = useRouter();
  const { barcode } = useLocalSearchParams<{ barcode: string }>();
  const { setCurrentProduct, addToHistory } = useScan();
  const scrollRef = useRef<ScrollView>(null);

  // Form state
  const [productName, setProductName] = useState('');
  const [brand, setBrand] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [labelText, setLabelText] = useState('');
  const [originCountry, setOriginCountry] = useState('');
  const [packagingType, setPackagingType] = useState('');

  // Analysis state
  const [analysis, setAnalysis] = useState<LabelAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCategories, setShowCategories] = useState(false);

  const categories = getAvailableCategories();

  // Run NLP analysis on the label text
  const handleAnalyzeText = useCallback(() => {
    if (labelText.trim().length < 3) return;

    setIsAnalyzing(true);

    // Brief delay for UX
    setTimeout(() => {
      const result = analyzeLabelText(labelText);
      setAnalysis(result);
      setIsAnalyzing(false);

      // Auto-suggest category if detected
      if (result.suggestedCategory && !selectedCategory) {
        setSelectedCategory(result.suggestedCategory);
      }

      // Scroll to analysis results
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    }, 500);
  }, [labelText, selectedCategory]);

  // Submit everything for ML scoring
  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);

    await new Promise(resolve => setTimeout(resolve, 600));

    const certNames = analysis ? extractCertificationNames(analysis) : [];
    const packagingSummary = analysis ? summarizePackaging(analysis) : undefined;

    const product = predictSustainabilityScore({
      barcode: barcode || `MANUAL-${Date.now()}`,
      productName: productName.trim() || undefined,
      brand: brand.trim() || undefined,
      category: selectedCategory || undefined,
      packagingType: packagingType.trim() || packagingSummary || undefined,
      certifications: certNames.length > 0 ? certNames : undefined,
      originCountry: originCountry.trim() || undefined,
      ocrText: labelText.trim() || undefined,
    });

    setCurrentProduct(product);
    addToHistory(product);
    router.replace('/impact');
  }, [
    barcode, productName, brand, selectedCategory, labelText,
    originCountry, packagingType, analysis,
    setCurrentProduct, addToHistory, router,
  ]);

  const hasMinimumData = selectedCategory || labelText.trim().length > 10 || productName.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
          <Text style={styles.headerLabel}>ECOTRACE</Text>
          <Text style={styles.title}>Add Product Details</Text>
          <Text style={styles.subtitle}>
            Enter what you see on the product label. Our AI will analyze the
            text automatically and generate a sustainability score.
          </Text>
        </Animated.View>

        {/* Product Name */}
        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <Text style={styles.fieldLabel}>Product Name (optional)</Text>
          <TextInput
            value={productName}
            onChangeText={setProductName}
            placeholder="e.g. Organic Almond Milk"
            placeholderTextColor={COLORS.dimText}
            style={styles.input}
            returnKeyType="next"
          />
        </Animated.View>

        {/* Brand */}
        <Animated.View entering={FadeInDown.delay(150).duration(300)}>
          <Text style={styles.fieldLabel}>Brand (optional)</Text>
          <TextInput
            value={brand}
            onChangeText={setBrand}
            placeholder="e.g. Nature's Best"
            placeholderTextColor={COLORS.dimText}
            style={styles.input}
            returnKeyType="next"
          />
        </Animated.View>

        {/* Category selector */}
        <Animated.View entering={FadeInDown.delay(200).duration(300)}>
          <Text style={styles.fieldLabel}>Category</Text>
          <Pressable
            onPress={() => setShowCategories(!showCategories)}
            style={[styles.input, styles.selectorInput]}
          >
            <Text style={selectedCategory ? styles.selectorText : styles.selectorPlaceholder}>
              {selectedCategory
                ? categories.find(c => c.key === selectedCategory)?.label || selectedCategory
                : 'Select a category...'}
            </Text>
            <Text style={styles.selectorArrow}>{showCategories ? '▲' : '▼'}</Text>
          </Pressable>

          {showCategories && (
            <View style={styles.categoryDropdown}>
              {categories.map(cat => (
                <Pressable
                  key={cat.key}
                  onPress={() => {
                    setSelectedCategory(cat.key);
                    setShowCategories(false);
                  }}
                  style={[
                    styles.categoryOption,
                    selectedCategory === cat.key && styles.categoryOptionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryOptionText,
                      selectedCategory === cat.key && styles.categoryOptionTextSelected,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </Animated.View>

        {/* Origin */}
        <Animated.View entering={FadeInDown.delay(250).duration(300)}>
          <Text style={styles.fieldLabel}>Country of Origin (optional)</Text>
          <TextInput
            value={originCountry}
            onChangeText={setOriginCountry}
            placeholder="e.g. France, USA, Local"
            placeholderTextColor={COLORS.dimText}
            style={styles.input}
            returnKeyType="next"
          />
        </Animated.View>

        {/* Packaging */}
        <Animated.View entering={FadeInDown.delay(300).duration(300)}>
          <Text style={styles.fieldLabel}>Packaging Type (optional)</Text>
          <TextInput
            value={packagingType}
            onChangeText={setPackagingType}
            placeholder="e.g. Glass jar, Plastic bottle, Cardboard box"
            placeholderTextColor={COLORS.dimText}
            style={styles.input}
            returnKeyType="next"
          />
        </Animated.View>

        {/* Label Text Area */}
        <Animated.View entering={FadeInDown.delay(350).duration(300)}>
          <Text style={styles.fieldLabel}>Label Text (type what you see)</Text>
          <Text style={styles.fieldHint}>
            Copy text from the product label — ingredients, certifications,
            environmental claims, recycling symbols, etc.
          </Text>
          <TextInput
            value={labelText}
            onChangeText={text => {
              setLabelText(text);
              // Clear previous analysis when text changes significantly
              if (analysis && Math.abs(text.length - analysis.rawTextLength) > 20) {
                setAnalysis(null);
              }
            }}
            placeholder="Paste or type label text here..."
            placeholderTextColor={COLORS.dimText}
            style={[styles.input, styles.textArea]}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            returnKeyType="default"
          />

          {labelText.trim().length >= 3 && (
            <Pressable
              onPress={handleAnalyzeText}
              disabled={isAnalyzing}
              style={[styles.analyzeButton, isAnalyzing && styles.buttonDisabled]}
            >
              <Text style={styles.analyzeButtonText}>
                {isAnalyzing ? 'Analyzing...' : '🔍 Analyze Label Text'}
              </Text>
            </Pressable>
          )}
        </Animated.View>

        {/* Analysis Results */}
        {analysis && (
          <Animated.View entering={FadeInUp.duration(400)} style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>NLP Analysis Results</Text>

            {/* Certifications */}
            {analysis.certifications.length > 0 && (
              <View style={styles.resultSection}>
                <Text style={styles.resultSectionTitle}>
                  ✓ Certifications Found ({analysis.certifications.length})
                </Text>
                <View style={styles.chipRow}>
                  {analysis.certifications.map((cert, i) => (
                    <View key={i} style={[styles.chip, { backgroundColor: COLORS.accentDim }]}>
                      <Text style={[styles.chipText, { color: COLORS.accent }]}>{cert.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Packaging */}
            {analysis.packaging.length > 0 && (
              <View style={styles.resultSection}>
                <Text style={styles.resultSectionTitle}>
                  📦 Packaging Detected ({analysis.packaging.length})
                </Text>
                {analysis.packaging.map((pack, i) => (
                  <View key={i} style={styles.packagingRow}>
                    <Text style={styles.packagingMaterial}>{pack.material}</Text>
                    <Text style={[
                      styles.packagingRecyclability,
                      { color: pack.recyclability.includes('Not') ? COLORS.red : COLORS.accent },
                    ]}>
                      {pack.recyclability}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Environmental Claims */}
            {analysis.environmentalClaims.length > 0 && (
              <View style={styles.resultSection}>
                <Text style={styles.resultSectionTitle}>
                  🌱 Environmental Claims ({analysis.environmentalClaims.length})
                </Text>
                {analysis.environmentalClaims.map((claim, i) => (
                  <View key={i} style={styles.claimRow}>
                    <Text style={styles.claimText}>{claim.claim}</Text>
                    <Text style={styles.claimRaw}>"{claim.rawMatch}"</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Greenwashing Warnings */}
            {analysis.greenwashingFlags.length > 0 && (
              <View style={styles.resultSection}>
                <Text style={[styles.resultSectionTitle, { color: COLORS.warning }]}>
                  ⚠️ Greenwashing Alerts ({analysis.greenwashingFlags.length})
                </Text>
                {analysis.greenwashingFlags.map((flag, i) => (
                  <View key={i} style={[styles.warningCard, {
                    borderColor: flag.severity === 'high' ? COLORS.red
                      : flag.severity === 'medium' ? COLORS.warning
                      : COLORS.dimText,
                  }]}>
                    <View style={styles.warningHeader}>
                      <View style={[styles.severityBadge, {
                        backgroundColor: flag.severity === 'high' ? COLORS.redDim
                          : flag.severity === 'medium' ? COLORS.warningDim
                          : 'rgba(255,255,255,0.06)',
                      }]}>
                        <Text style={[styles.severityText, {
                          color: flag.severity === 'high' ? COLORS.red
                            : flag.severity === 'medium' ? COLORS.warning
                            : COLORS.muted,
                        }]}>
                          {flag.severity.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.warningText}>{flag.warning}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* No findings */}
            {analysis.certifications.length === 0 &&
              analysis.packaging.length === 0 &&
              analysis.environmentalClaims.length === 0 &&
              analysis.greenwashingFlags.length === 0 && (
              <Text style={styles.noResults}>
                No certifications, packaging info, or environmental claims detected.
                Try adding more text from the product label.
              </Text>
            )}

            {/* Suggested category */}
            {analysis.suggestedCategory && !selectedCategory && (
              <Pressable
                onPress={() => setSelectedCategory(analysis.suggestedCategory!)}
                style={styles.suggestionBanner}
              >
                <Text style={styles.suggestionText}>
                  💡 Detected category: {analysis.suggestedCategory} — tap to use
                </Text>
              </Pressable>
            )}
          </Animated.View>
        )}

        {/* Submit Button */}
        <Animated.View entering={FadeInDown.delay(400).duration(300)} style={styles.submitSection}>
          <Pressable
            onPress={handleSubmit}
            disabled={!hasMinimumData || isSubmitting}
            style={[
              styles.submitButton,
              (!hasMinimumData || isSubmitting) && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? 'Computing Score...' : 'Get Sustainability Score'}
            </Text>
          </Pressable>

          {!hasMinimumData && (
            <Text style={styles.submitHint}>
              Enter at least a category, product name, or label text to continue.
            </Text>
          )}

          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Go Back</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    marginBottom: 28,
  },
  headerLabel: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 11,
    color: COLORS.dimText,
    letterSpacing: 3,
    marginBottom: 12,
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
    lineHeight: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.white,
    marginBottom: 6,
    marginTop: 16,
  },
  fieldHint: {
    fontSize: 11,
    color: COLORS.dimText,
    marginBottom: 8,
    lineHeight: 16,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 10,
    padding: 14,
    fontSize: 14,
    color: COLORS.white,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 14,
  },
  selectorInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorText: {
    fontSize: 14,
    color: COLORS.white,
  },
  selectorPlaceholder: {
    fontSize: 14,
    color: COLORS.dimText,
  },
  selectorArrow: {
    fontSize: 12,
    color: COLORS.muted,
  },
  categoryDropdown: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginTop: 4,
    maxHeight: 260,
    overflow: 'hidden',
  },
  categoryOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  categoryOptionSelected: {
    backgroundColor: COLORS.accentDim,
  },
  categoryOptionText: {
    fontSize: 14,
    color: COLORS.muted,
  },
  categoryOptionTextSelected: {
    color: COLORS.accent,
    fontWeight: '600',
  },
  analyzeButton: {
    backgroundColor: COLORS.blueDim,
    borderWidth: 1,
    borderColor: COLORS.blue,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  analyzeButtonText: {
    color: COLORS.blue,
    fontWeight: '600',
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  resultsContainer: {
    marginTop: 24,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 16,
    fontFamily: 'SpaceMono-Regular',
    letterSpacing: 1,
  },
  resultSection: {
    marginBottom: 16,
  },
  resultSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.accent,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  packagingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 6,
    marginBottom: 4,
  },
  packagingMaterial: {
    fontSize: 13,
    color: COLORS.white,
    fontWeight: '500',
  },
  packagingRecyclability: {
    fontSize: 11,
    fontWeight: '600',
  },
  claimRow: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 6,
    marginBottom: 4,
  },
  claimText: {
    fontSize: 13,
    color: COLORS.white,
    fontWeight: '500',
  },
  claimRaw: {
    fontSize: 11,
    color: COLORS.dimText,
    fontStyle: 'italic',
    marginTop: 2,
  },
  warningCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
    marginBottom: 8,
  },
  warningHeader: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  severityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  severityText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  warningText: {
    fontSize: 12,
    color: COLORS.muted,
    lineHeight: 18,
  },
  noResults: {
    fontSize: 13,
    color: COLORS.dimText,
    textAlign: 'center',
    paddingVertical: 16,
    lineHeight: 20,
  },
  suggestionBanner: {
    backgroundColor: COLORS.blueDim,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  suggestionText: {
    fontSize: 13,
    color: COLORS.blue,
    textAlign: 'center',
    fontWeight: '500',
  },
  submitSection: {
    marginTop: 32,
    gap: 12,
  },
  submitButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: COLORS.bg,
    fontWeight: '700',
    fontSize: 16,
  },
  submitHint: {
    fontSize: 11,
    color: COLORS.dimText,
    textAlign: 'center',
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  backButtonText: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: '500',
  },
});
