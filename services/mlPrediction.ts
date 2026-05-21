// services/mlPrediction.ts — ECOTRACE ML Prediction Service v4.0
//
// Prediction pipeline with a 3-tier fallback chain:
//   1. Neural Network (pure-TS, on-device, 40→256→128→64→1) — best quality
//   2. Rule-Based heuristic — when NN is untrained or features are sparse
//   3. Category Average — last resort fallback
//
// Exports:
//   - initializeMLModel()    — call once at app startup
//   - predictFromBarcode()   — MAIN ENTRY: barcode → API → ML → result
//   - predictFromOFF()       — predict from raw OFF product data
//   - predictFromLocal()     — predict from user-entered product

import { initModel, predict, getModelStatus, loadWeightsFromJSON } from './tensorflowModel';
import { encodeFromOFFProduct, encodeLocalProduct, NUM_FEATURES } from './featureEncoder';
import { fetchProductByBarcode, calculateDataQuality } from './openFoodFacts';
import { mapOFFToProductScan } from './scoring';
import type { OFFRawProduct, LocalProduct } from './featureEncoder';
import type { FetchSource } from './openFoodFacts';
import type { ProductScan } from '@/types/product';

// ─── Types ───────────────────────────────────────────────────────

export type PredictionMethod = 'neural_network' | 'rule_based' | 'category_average';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface PredictionResult {
  score: number;              // 0-100 eco-sustainability score
  confidence: ConfidenceLevel;
  method: PredictionMethod;
  explanation: string;
  featureCount: number;       // How many non-default features were available
  rawOutput?: number;         // Raw NN sigmoid output [0,1] (only for NN method)
}

// ─── Category Averages (fallback tier 3) ─────────────────────────

const CATEGORY_AVERAGES: Record<string, number> = {
  'organic': 78,
  'plant-based': 72,
  'fruits': 75,
  'vegetables': 80,
  'fresh': 68,
  'cereals': 55,
  'breads': 52,
  'beverages': 48,
  'dairy': 42,
  'cheese': 40,
  'fish': 45,
  'seafood': 45,
  'snacks': 35,
  'chocolate': 32,
  'frozen': 38,
  'canned': 40,
  'meals': 42,
  'sauces': 45,
  'meat': 25,
  'beef': 18,
  'pork': 22,
  'poultry': 28,
  'processed-meat': 20,
  'default': 45,
};

function getCategoryAverage(categoryTags?: string[]): number {
  if (!categoryTags || categoryTags.length === 0) return CATEGORY_AVERAGES.default;

  for (const tag of categoryTags) {
    const clean = tag.replace('en:', '').toLowerCase();
    for (const [key, value] of Object.entries(CATEGORY_AVERAGES)) {
      if (clean.includes(key) || key.includes(clean)) return value;
    }
  }

  return CATEGORY_AVERAGES.default;
}

// ─── Rule-Based Scoring (fallback tier 2) ────────────────────────

function ruleBasedScore(features: number[]): number {
  // Weighted sum of 40 encoded features (MUST match featureEncoder.ts order)
  const weights = [
    // Category Analysis (1)
    0.15,  // [0]  categoryEnvScore_dataDriven
    // Processing Level (3)
    0.08,  // [1]  novaGroupNormalized
    -0.03, // [2]  isUltraProcessed (negative = penalty)
    0.04,  // [3]  ingredientComplexity
    // Packaging Features (6)
    -0.04, // [4]  hasPlasticPackaging (negative = penalty)
    0.03,  // [5]  hasGlassPackaging
    0.03,  // [6]  hasCardboardPackaging
    0.02,  // [7]  hasMetalPackaging
    0.03,  // [8]  hasCompostablePackaging
    0.02,  // [9]  packagingMaterialCount
    // Certifications (6)
    0.08,  // [10] hasOrganicCert
    0.05,  // [11] hasFairTradeCert
    0.04,  // [12] hasRainforestAllianceCert
    0.03,  // [13] hasEUEcolabel
    0.03,  // [14] hasMSCCert
    0.05,  // [15] certificationTotalScore
    // Origin & Sustainability (4)
    0.06,  // [16] originSustainabilityScore
    0.03,  // [17] hasLocalOrigin
    0.04,  // [18] transportEstimateScore
    0.03,  // [19] manufacturingSustainability
    // Ingredient Analysis (3)
    0.04,  // [20] isVegan
    0.03,  // [21] isVegetarian
    -0.03, // [22] hasPalmOil (negative = penalty)
    // Nutrient Levels (5)
    -0.02, // [23] hasHighSugar
    -0.02, // [24] hasHighSaturatedFat
    -0.02, // [25] hasHighSodium
    -0.02, // [26] hasHighFat
    0.02,  // [27] hasLowFat
    // Food Group Binaries (12)
    -0.06, // [28] isMeatProduct
    -0.03, // [29] isFishSeafood
    -0.02, // [30] isDairyProduct
    0.05,  // [31] isPlantBased
    0.05,  // [32] isFruitVegetable
    0.02,  // [33] isCereal
    0.00,  // [34] isBeverage
    -0.01, // [35] isFatOil
    -0.02, // [36] isSweetSnack
    -0.01, // [37] isCanned
    -0.01, // [38] isFrozen
    -0.02, // [39] isReadyMeal
  ];

  let score = 0;
  for (let i = 0; i < Math.min(features.length, weights.length); i++) {
    score += features[i] * weights[i];
  }

  // Normalize to 0-100 scale
  // The max possible positive score is ~0.97, min is ~-0.14
  // Shift and scale to [0, 100]
  return Math.max(0, Math.min(100, Math.round((score + 0.14) * 90)));
}

// ─── Confidence Determination ────────────────────────────────────

function determineConfidence(
  rawOutput: number,
  nonDefaultFeatures: number,
  method: PredictionMethod,
): ConfidenceLevel {
  if (method === 'category_average') return 'low';

  if (method === 'neural_network') {
    const decisiveness = Math.abs(rawOutput - 0.5) * 2;
    if (decisiveness > 0.4 && nonDefaultFeatures >= 8) return 'high';
    if (decisiveness > 0.2 && nonDefaultFeatures >= 5) return 'medium';
    return 'low';
  }

  // Rule-based
  if (nonDefaultFeatures >= 10) return 'medium';
  if (nonDefaultFeatures >= 5) return 'low';
  return 'low';
}

// ─── Main Prediction Functions ───────────────────────────────────

/**
 * Predict eco-score for an Open Food Facts product
 */
export function predictFromOFF(product: OFFRawProduct): PredictionResult {
  const { features, nonDefaultCount } = encodeFromOFFProduct(product);
  return runPrediction(features, nonDefaultCount, product.categories_tags);
}

/**
 * Predict eco-score for a locally-created product
 */
export function predictFromLocal(product: LocalProduct): PredictionResult {
  const { features, nonDefaultCount } = encodeLocalProduct(product);
  return runPrediction(features, nonDefaultCount);
}

/**
 * Core prediction pipeline with 3-tier fallback
 */
function runPrediction(
  features: number[],
  nonDefaultCount: number,
  categoryTags?: string[],
): PredictionResult {
  const status = getModelStatus();

  // Tier 1: Neural Network
  if (status.isInitialized && status.hasTrained) {
    try {
      const rawOutput = predict(features);
      const score = Math.round(rawOutput * 100);

      return {
        score: Math.max(0, Math.min(100, score)),
        confidence: determineConfidence(rawOutput, nonDefaultCount, 'neural_network'),
        method: 'neural_network',
        explanation: `Neural network prediction (${status.architecture}, ${status.totalParameters} params). Data richness: ${nonDefaultCount}/${NUM_FEATURES} features.`,
        featureCount: nonDefaultCount,
        rawOutput,
      };
    } catch (e) {
      console.warn('[ML] Neural network prediction failed, falling back to rules:', e);
    }
  }

  // Tier 2: Rule-based heuristic
  if (nonDefaultCount >= 3) {
    const score = ruleBasedScore(features);

    return {
      score: Math.max(0, Math.min(100, score)),
      confidence: determineConfidence(score / 100, nonDefaultCount, 'rule_based'),
      method: 'rule_based',
      explanation: `Rule-based heuristic (weighted feature sum). Data richness: ${nonDefaultCount}/${NUM_FEATURES} features. ML model not yet trained.`,
      featureCount: nonDefaultCount,
    };
  }

  // Tier 3: Category average
  const score = getCategoryAverage(categoryTags);

  return {
    score,
    confidence: 'low',
    method: 'category_average',
    explanation: `Category average fallback — insufficient product data (${nonDefaultCount}/${NUM_FEATURES} features available).`,
    featureCount: nonDefaultCount,
  };
}

// ─── Initialization ──────────────────────────────────────────────

let _initPromise: Promise<void> | null = null;

/**
 * Initialize the ML model on app startup. Call once from _layout.tsx.
 */
export async function initializeMLModel(): Promise<void> {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    console.log('[ML] Initializing ECOTRACE ML prediction service v4.0...');

    const hadCachedWeights = await initModel();

    if (hadCachedWeights) {
      console.log('[ML] ✅ Loaded cached neural network weights');
    } else {
      try {
        const weightsModule = require('../assets/ml/eco-score-model/weights.json');
        if (weightsModule && weightsModule.W1) {
          loadWeightsFromJSON(weightsModule);
          console.log('[ML] ✅ Loaded bundled pre-trained weights');
        }
      } catch (e) {
        console.log('[ML] No bundled weights found — will use rule-based fallback until model is trained');
      }
    }

    const status = getModelStatus();
    console.log(`[ML] Model status: ${status.isInitialized ? 'initialized' : 'not initialized'}, trained: ${status.hasTrained}`);
    console.log(`[ML] Architecture: ${status.architecture} (${status.totalParameters} params)`);
    console.log(`[ML] Implementation: ${status.implementation}`);
  })();

  return _initPromise;
}

// ─── MAIN ENTRY POINT: Barcode → API → ML → ProductScan ─────────

export interface BarcodePredictionResult {
  product: ProductScan;
  mlPrediction: PredictionResult;
  source: FetchSource;
  dataQualityScore: number;
}

/**
 * FINAL HANDOFF: Barcode → Open Food Facts → ML Prediction → ProductScan
 *
 * This is the main entry point for real-time scanning. It:
 *   1. Fetches product data from OFF (cache-first, with retry)
 *   2. Runs the 3-tier ML prediction (NN → rules → category avg)
 *   3. Builds a complete ProductScan with scoring breakdown
 *   4. Returns both the ProductScan and raw ML prediction
 *
 * Throws if the product is not found (caller should handle navigation
 * to ProductNotFoundScreen).
 */
export async function predictFromBarcode(barcode: string): Promise<BarcodePredictionResult> {
  // Step 1: Fetch from Open Food Facts (cached or live)
  const fetchResult = await fetchProductByBarcode(barcode);

  if (!fetchResult.success || !fetchResult.product) {
    // Product not found — throw so the caller can route to ProductNotFound
    throw new ProductNotFoundError(
      fetchResult.error || 'Product not found in database',
      barcode
    );
  }

  const offProduct = fetchResult.product;

  // Step 2: Run ML prediction on the raw OFF product
  const mlResult = predictFromOFF({
    code: offProduct.code,
    product_name: offProduct.product_name,
    categories_tags: offProduct.categories_tags,
    nova_group: offProduct.nova_group ?? undefined,
    labels_tags: offProduct.labels_tags,
    packaging_tags: offProduct.packaging_tags,
    packaging_text: offProduct.packaging_text,
    origins_tags: offProduct.origins?.split(',').map(s => s.trim()),
    origins: offProduct.origins,
    manufacturing_places_tags: offProduct.manufacturing_places?.split(',').map(s => s.trim()),
    manufacturing_places: offProduct.manufacturing_places,
    ecoscore_score: offProduct.ecoscore_score ?? undefined,
    ecoscore_grade: offProduct.ecoscore_grade,
    nutrient_levels_tags: [],
    ingredients_analysis_tags: [],
  });

  // Step 3: Build ProductScan using scoring.ts (5-factor scoring for UI)
  const productScan = mapOFFToProductScan(offProduct, barcode);

  // Step 4: Enhance ProductScan with ML prediction data
  // Use the ML score if no verified ecoscore exists
  if (offProduct.ecoscore_score === undefined || offProduct.ecoscore_score === null) {
    productScan.score = mlResult.score;
    productScan.status = mlResult.score >= 60 ? 'verified' : mlResult.score >= 30 ? 'pending' : 'flagged';
  }

  // Add ML method info to scoring breakdown
  productScan.scoringBreakdown = {
    ...productScan.scoringBreakdown,
    ml_score: mlResult.score,
    ml_method: mlResult.method === 'neural_network' ? 1 : mlResult.method === 'rule_based' ? 2 : 3,
    ml_features_used: mlResult.featureCount,
  };

  const dataQuality = fetchResult.quality || calculateDataQuality(offProduct);

  console.log(`[ML] ✅ predictFromBarcode complete: "${offProduct.product_name}" → score ${productScan.score} (${mlResult.method}, ${mlResult.confidence} confidence, ${fetchResult.source})`);

  return {
    product: productScan,
    mlPrediction: mlResult,
    source: fetchResult.source,
    dataQualityScore: dataQuality.score,
  };
}

/**
 * Custom error for product-not-found, so callers can distinguish
 * network errors from missing products.
 */
export class ProductNotFoundError extends Error {
  barcode: string;
  constructor(message: string, barcode: string) {
    super(message);
    this.name = 'ProductNotFoundError';
    this.barcode = barcode;
  }
}

// On-device training removed — training is done offline via
// `node scripts/trainModel.js` and weights are bundled as JSON.
// The mobile app is inference-only.

// ─── Quick Prediction for ProductNotFoundScreen ──────────────────

export interface CategoryOption {
  key: string;
  label: string;
  avgScore: number;
}

export function getAvailableCategories(): CategoryOption[] {
  return [
    { key: 'organic', label: '🌱 Organic', avgScore: CATEGORY_AVERAGES.organic },
    { key: 'plant-based', label: '🥬 Plant-Based', avgScore: CATEGORY_AVERAGES['plant-based'] },
    { key: 'fruits', label: '🍎 Fruits', avgScore: CATEGORY_AVERAGES.fruits },
    { key: 'vegetables', label: '🥕 Vegetables', avgScore: CATEGORY_AVERAGES.vegetables },
    { key: 'dairy', label: '🥛 Dairy', avgScore: CATEGORY_AVERAGES.dairy },
    { key: 'fish', label: '🐟 Fish', avgScore: CATEGORY_AVERAGES.fish },
    { key: 'snacks', label: '🍿 Snacks', avgScore: CATEGORY_AVERAGES.snacks },
    { key: 'beverages', label: '🥤 Beverages', avgScore: CATEGORY_AVERAGES.beverages },
    { key: 'meat', label: '🥩 Meat', avgScore: CATEGORY_AVERAGES.meat },
    { key: 'default', label: '📦 Other', avgScore: CATEGORY_AVERAGES.default },
  ];
}

export function quickPredict(barcode: string, categoryKey: string): any {
  const category = getAvailableCategories().find(c => c.key === categoryKey);
  const score = category?.avgScore || CATEGORY_AVERAGES.default;

  return {
    id: `SCAN-${Date.now()}`,
    barcode,
    name: 'Unknown Product',
    brand: 'Not in Database',
    category: category?.label.replace(/[^\w\s-]/g, '').trim() || 'Unknown',
    scanDate: new Date().toISOString().split('T')[0],
    score,
    confidence: 'estimated' as const,
    status: score >= 60 ? 'pending' : score >= 30 ? 'flagged' : 'flagged',
    renewablePercent: score >= 60 ? 50 : 30,
    emissions: 'Data unavailable',
    transportDistance: 'Unknown',
    materials: [{
      material: 'Unknown materials',
      origin: 'Not disclosed',
      verified: false,
      source: 'Insufficient data',
    }],
    auditSteps: [
      {
        id: `audit-${Date.now()}-1`,
        title: 'Product Information',
        description: 'This product is not in Open Food Facts database. Score is based on category average.',
        status: 'pending' as const,
        dataSource: undefined,
      },
      {
        id: `audit-${Date.now()}-2`,
        title: 'Category Estimate',
        description: `Estimated based on ${category?.label || 'product'} category average: ${score}/100`,
        status: 'flagged' as const,
        dataSource: 'ECOTRACE ML',
      },
    ],
    auditProgress: 0,
    scoringBreakdown: {
      category_average: score,
    },
    methodologyVersion: 'v0.1-estimated',
    dataSource: 'user_submitted' as const,
  };
}

// ─── Full Prediction for PhotoUploadScreen (manual entry) ────────

export interface ManualProductInput {
  barcode: string;
  productName?: string;
  brand?: string;
  category?: string;
  packagingType?: string;
  certifications?: string[];
  originCountry?: string;
  ocrText?: string;
}

/**
 * Predict sustainability score from manually-entered product details.
 * Runs the ML pipeline (predictFromLocal) and wraps into a full ProductScan.
 */
export function predictSustainabilityScore(input: ManualProductInput): ProductScan {
  const mlResult = predictFromLocal({
    category: input.category,
    certifications: input.certifications,
    packagingType: input.packagingType,
    originCountry: input.originCountry,
    ocrText: input.ocrText,
  });

  const score = mlResult.score;
  const categoryLabel = input.category
    ? getAvailableCategories().find(c => c.key === input.category)?.label?.replace(/[^\w\s-]/g, '').trim() || input.category
    : 'Unknown';

  return {
    id: `SCAN-${Date.now()}`,
    barcode: input.barcode,
    name: input.productName || 'Unknown Product',
    brand: input.brand || 'User Submitted',
    category: categoryLabel,
    scanDate: new Date().toISOString().split('T')[0],
    score,
    confidence: mlResult.confidence === 'high' ? 'high' : 'estimated',
    status: score >= 60 ? 'verified' : score >= 30 ? 'pending' : 'flagged',
    renewablePercent: score >= 60 ? 50 : 30,
    emissions: 'Data unavailable',
    transportDistance: input.originCountry || 'Unknown',
    materials: [{
      material: input.packagingType || 'Unknown materials',
      origin: input.originCountry || 'Not disclosed',
      verified: false,
      source: 'user_submitted',
    }],
    auditSteps: [
      {
        id: `audit-${Date.now()}-1`,
        title: 'Manual Entry',
        description: 'Product details entered manually by user.',
        status: 'pending' as const,
      },
      {
        id: `audit-${Date.now()}-2`,
        title: 'ML Prediction',
        description: `Score predicted via ${mlResult.method} (${mlResult.confidence} confidence, ${mlResult.featureCount} features used).`,
        status: mlResult.confidence === 'high' ? 'verified' as const : 'pending' as const,
        dataSource: 'ECOTRACE ML',
      },
    ],
    auditProgress: 0,
    scoringBreakdown: {
      ml_score: mlResult.score,
      ml_method: mlResult.method === 'neural_network' ? 1 : mlResult.method === 'rule_based' ? 2 : 3,
      ml_features_used: mlResult.featureCount,
    },
    methodologyVersion: 'v4.0-manual',
    dataSource: 'user_submitted' as const,
  };
}

// Re-export model status for UI
export { getModelStatus } from './tensorflowModel';
