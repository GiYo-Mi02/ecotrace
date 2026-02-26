// services/mlPrediction.ts — ECOTRACE ML Prediction Service v2.0
//
// Prediction pipeline with a 3-tier fallback chain:
//   1. Neural Network (pure-TS, on-device) — best quality
//   2. Rule-Based heuristic — when NN is untrained or features are sparse
//   3. Category Average — last resort fallback
//
// Exports initializeMLModel() for app startup and predictEcoScore() for scoring.

import { initModel, predict, getModelStatus, loadWeightsFromJSON, train } from './tensorflowModel';
import { encodeFromOFFProduct, encodeLocalProduct, NUM_FEATURES } from './featureEncoder';
import type { OFFRawProduct, LocalProduct } from './featureEncoder';

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
  // Weighted sum of 28 encoded features
  const weights = [
    // Category Analysis (3)
    0.12,  // categoryEnvironmentScore
    0.05,  // categoryProcessingLevel
    0.05,  // categoryHealthScore
    // Processing Level (3)
    0.08,  // novaGroupNormalized
    -0.03, // isUltraProcessed (negative = penalty)
    0.04,  // ingredientComplexity
    // Packaging Features (6)
    -0.04, // hasPlasticPackaging (negative = penalty)
    0.03,  // hasGlassPackaging
    0.03,  // hasCardboardPackaging
    0.02,  // hasMetalPackaging
    0.03,  // hasCompostablePackaging
    0.02,  // packagingMaterialCount
    // Certifications (6)
    0.08,  // hasOrganicCert
    0.05,  // hasFairTradeCert
    0.04,  // hasRainforestAllianceCert
    0.03,  // hasEUEcolabel
    0.03,  // hasMSCCert
    0.05,  // certificationTotalScore
    // Origin & Sustainability (4)
    0.06,  // originSustainabilityScore
    0.03,  // hasLocalOrigin
    0.04,  // transportEstimateScore
    0.03,  // manufacturingSustainability
    // Ingredient Analysis (6)
    0.04,  // isVegan
    0.03,  // isVegetarian
    -0.03, // hasPalmOil (negative = penalty)
    -0.02, // hasHighSugar
    -0.02, // hasHighSaturatedFat
    -0.02, // hasHighSodium
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
    console.log('[ML] Initializing ECOTRACE ML prediction service v2.0...');

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

/**
 * Train the on-device model with the embedded training dataset.
 */
export async function trainOnEmbeddedData(): Promise<void> {
  try {
    const { getTrainingExamples } = require('../data/trainingDataset');
    const examples = getTrainingExamples();

    if (!examples || examples.length === 0) {
      console.log('[ML] No embedded training data available');
      return;
    }

    const features: number[][] = [];
    const labels: number[] = [];

    for (const ex of examples) {
      if (ex.features && ex.label !== undefined) {
        features.push(ex.features);
        labels.push(ex.label);
      }
    }

    if (features.length < 10) {
      console.log(`[ML] Insufficient embedded training data (${features.length} examples)`);
      return;
    }

    console.log(`[ML] Training on ${features.length} embedded examples...`);
    const result = await train(features, labels, {
      epochs: 30,
      learningRate: 0.001,
      batchSize: 16,
    });

    console.log(`[ML] On-device training complete. Final loss: ${result.finalLoss.toFixed(6)}`);
  } catch (e) {
    console.warn('[ML] On-device training failed:', e);
  }
}

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

// Re-export model status for UI
export { getModelStatus } from './tensorflowModel';
