// services/tensorflowModel.ts — Pure TypeScript Neural Network v4.0 (NO native deps)
//
// Architecture: 40 → 256 (BN+ReLU) → 128 (BN+ReLU) → 64 (BN+ReLU) → 1 (Sigmoid)
//
// This module implements INFERENCE-ONLY forward propagation entirely in
// TypeScript — no @tensorflow/tfjs import — so it runs inside React
// Native's Hermes engine without crashing.
//
// CRITICAL: This file MUST stay in sync with scripts/trainModel.js.
//   - INPUT_DIM must match NUM_FEATURES in trainModel.js
//   - Architecture constants must match buildModel() in trainModel.js
//   - Z-score normalization MUST be applied using featureMeans/featureStds
//     saved by trainModel.js in weights.json
//
// Run `node scripts/validateSync.js` to verify sync before deployment.

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Architecture Constants (MUST match trainModel.js) ───────────

const INPUT_DIM = 40;
const HIDDEN1_DIM = 256;
const HIDDEN2_DIM = 128;
const HIDDEN3_DIM = 64;
const OUTPUT_DIM = 1;

const STORAGE_KEY = '@ecotrace_nn_weights_v4';

// ─── Types ───────────────────────────────────────────────────────

/** BatchNorm parameters for a single layer */
interface BatchNormParams {
  gamma: number[];
  beta: number[];
  movingMean: number[];
  movingVariance: number[];
}

/**
 * Weight structure output by trainModel.js extractWeightsForPureTS().
 * Includes dense weights, batch norm params, and z-score normalization stats.
 */
interface NNWeights {
  // Dense layer weights
  W1: number[][];  // [40][256]
  b1: number[];    // [256]
  W2: number[][];  // [256][128]
  b2: number[];    // [128]
  W3: number[][];  // [128][64]
  b3: number[];    // [64]
  W4: number[][];  // [64][1]
  b4: number[];    // [1]

  // BatchNorm parameters (from trainModel.js BN layers)
  bn1?: BatchNormParams;  // [256]
  bn2?: BatchNormParams;  // [128]
  bn3?: BatchNormParams;  // [64]

  // Z-score normalization stats (computed from training set)
  featureMeans: number[];  // [40]
  featureStds: number[];   // [40]
}

export interface ModelAccuracyMetrics {
  mse: number;
  rmse: number;
  mae: number;
  rSquared: number;
  accuracyAtTolerance5: number;
  accuracyAtTolerance10: number;
  accuracyAtTolerance15: number;
  accuracyAtTolerance20: number;
  sampleCount: number;
}

// ─── Math Utilities ──────────────────────────────────────────────

function relu(x: number): number {
  return x > 0 ? x : 0;
}

function sigmoid(x: number): number {
  if (x > 500) return 1;
  if (x < -500) return 0;
  return 1 / (1 + Math.exp(-x));
}

/**
 * Matrix-vector multiplication: W[rows][cols] × x[rows] → out[cols]
 * W is [inputDim][outputDim], x is [inputDim], output is [outputDim]
 */
function matMulVec(W: number[][], x: number[]): number[] {
  const out: number[] = new Array(W[0].length).fill(0);
  for (let j = 0; j < W[0].length; j++) {
    let sum = 0;
    for (let i = 0; i < W.length; i++) {
      sum += W[i][j] * x[i];
    }
    out[j] = sum;
  }
  return out;
}

function addVec(a: number[], b: number[]): number[] {
  return a.map((v, i) => v + b[i]);
}

/**
 * Apply batch normalization (inference mode):
 *   y = gamma * (x - movingMean) / sqrt(movingVariance + epsilon) + beta
 */
function batchNormInference(
  x: number[],
  bn: BatchNormParams,
  epsilon: number = 1e-3,
): number[] {
  return x.map((val, i) => {
    const normalized = (val - bn.movingMean[i]) / Math.sqrt(bn.movingVariance[i] + epsilon);
    return bn.gamma[i] * normalized + bn.beta[i];
  });
}

// ─── Model State ─────────────────────────────────────────────────

let weights: NNWeights | null = null;
let isInitialized = false;

// ─── Initialization ──────────────────────────────────────────────

/** Initialize model — tries loading cached weights first */
export async function initModel(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (validateWeights(parsed)) {
        weights = parsed;
        isInitialized = true;
        console.log(`[NN] Loaded cached weights. Architecture: ${INPUT_DIM}→${HIDDEN1_DIM}→${HIDDEN2_DIM}→${HIDDEN3_DIM}→${OUTPUT_DIM}`);
        return true;
      }
      console.warn('[NN] Cached weights failed validation, ignoring');
    }
  } catch (e) {
    console.warn('[NN] Cache load failed');
  }

  isInitialized = false;
  weights = null;
  return false;
}

/** Load pre-trained weights from a JSON object (e.g., bundled asset) */
export function loadWeightsFromJSON(weightsJSON: any): void {
  if (!validateWeights(weightsJSON)) {
    console.error('[NN] Weight validation failed — dimensions do not match architecture');
    return;
  }
  weights = weightsJSON as NNWeights;
  isInitialized = true;

  // Cache for next launch
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(weights)).catch(() => {});

  console.log(`[NN] Loaded pre-trained weights. Architecture: ${INPUT_DIM}→${HIDDEN1_DIM}→${HIDDEN2_DIM}→${HIDDEN3_DIM}→${OUTPUT_DIM}`);
  console.log(`[NN] Z-score normalization: ${weights.featureMeans ? 'enabled' : 'MISSING (will produce garbage!)'}`);
}

/** Validate that weights match expected architecture */
function validateWeights(w: any): boolean {
  if (!w || !w.W1 || !w.b1 || !w.W2 || !w.b2 || !w.W3 || !w.b3 || !w.W4 || !w.b4) return false;

  // Check dense layer dimensions
  if (w.W1.length !== INPUT_DIM || w.W1[0]?.length !== HIDDEN1_DIM) return false;
  if (w.b1.length !== HIDDEN1_DIM) return false;
  if (w.W2.length !== HIDDEN1_DIM || w.W2[0]?.length !== HIDDEN2_DIM) return false;
  if (w.b2.length !== HIDDEN2_DIM) return false;
  if (w.W3.length !== HIDDEN2_DIM || w.W3[0]?.length !== HIDDEN3_DIM) return false;
  if (w.b3.length !== HIDDEN3_DIM) return false;
  if (w.W4.length !== HIDDEN3_DIM || w.W4[0]?.length !== OUTPUT_DIM) return false;
  if (w.b4.length !== OUTPUT_DIM) return false;

  // Check normalization stats
  if (!w.featureMeans || !w.featureStds) {
    console.warn('[NN] Weights missing featureMeans/featureStds — z-score normalization disabled');
  }

  return true;
}

// ─── Forward Pass (Inference Only) ───────────────────────────────

/**
 * Run forward pass through the neural network.
 *
 * CRITICAL: Input features are in [0,1] range from featureEncoder.ts.
 * Z-score normalization is applied here using featureMeans/featureStds
 * saved during training. This MUST happen or predictions will be garbage.
 *
 * @param features Raw feature vector from featureEncoder.ts (40 features, [0,1] range)
 * @returns Score in [0,1] range (multiply by 100 for eco-score)
 */
export function predict(features: number[]): number {
  if (!isInitialized || !weights) {
    console.warn('[NN] Model not initialized, returning 0.5');
    return 0.5;
  }

  if (features.length !== INPUT_DIM) {
    console.error(`[NN] Input dimension mismatch: expected ${INPUT_DIM}, got ${features.length}`);
    return 0.5;
  }

  // ─── STEP 1: Z-score normalization ───
  // Transform [0,1] features to same distribution the model was trained on
  let input: number[];
  if (weights.featureMeans && weights.featureStds) {
    input = features.map((val, i) => {
      const std = weights!.featureStds[i];
      if (std === 0 || std < 1e-8) return 0; // Constant feature
      return (val - weights!.featureMeans[i]) / std;
    });
  } else {
    // Fallback: no normalization (will produce worse predictions)
    console.warn('[NN] No normalization stats — using raw features');
    input = features;
  }

  // ─── STEP 2: Forward pass through layers ───

  // Layer 1: input (40) → hidden1 (256), Dense → BatchNorm → ReLU
  let h1 = addVec(matMulVec(weights.W1, input), weights.b1);
  if (weights.bn1) h1 = batchNormInference(h1, weights.bn1);
  h1 = h1.map(relu);

  // Layer 2: hidden1 (256) → hidden2 (128), Dense → BatchNorm → ReLU
  let h2 = addVec(matMulVec(weights.W2, h1), weights.b2);
  if (weights.bn2) h2 = batchNormInference(h2, weights.bn2);
  h2 = h2.map(relu);

  // Layer 3: hidden2 (128) → hidden3 (64), Dense → BatchNorm → ReLU
  let h3 = addVec(matMulVec(weights.W3, h2), weights.b3);
  if (weights.bn3) h3 = batchNormInference(h3, weights.bn3);
  h3 = h3.map(relu);

  // Output: hidden3 (64) → output (1), Sigmoid
  const z4 = addVec(matMulVec(weights.W4, h3), weights.b4);
  const output = sigmoid(z4[0]);

  // Sanity check
  if (isNaN(output)) {
    console.error('[NN] NaN output detected — returning 0.5');
    return 0.5;
  }

  return output; // 0-1 range, multiply by 100 for eco-score
}

// ─── Persistence ─────────────────────────────────────────────────

export async function clearCachedWeights(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
  isInitialized = false;
  weights = null;
  console.log('[NN] Cleared cached weights');
}

// ─── Status ──────────────────────────────────────────────────────

export function getModelStatus() {
  const totalParams = weights
    ? (weights.W1.length * weights.W1[0].length + weights.b1.length +
       weights.W2.length * weights.W2[0].length + weights.b2.length +
       weights.W3.length * weights.W3[0].length + weights.b3.length +
       weights.W4.length * weights.W4[0].length + weights.b4.length)
    : 0;

  return {
    isInitialized,
    hasTrained: isInitialized && weights !== null,
    totalParameters: totalParams,
    architecture: `${INPUT_DIM}→${HIDDEN1_DIM}→${HIDDEN2_DIM}→${HIDDEN3_DIM}→${OUTPUT_DIM}`,
    hasNormalization: !!(weights?.featureMeans && weights?.featureStds),
    hasBatchNorm: !!(weights?.bn1),
    learningType: 'Supervised Learning (Regression)',
    algorithm: 'Feedforward Neural Network (Multi-Layer Perceptron)',
    lossFunction: 'Mean Squared Error (MSE) + L2 Regularization',
    activations: 'BatchNorm+ReLU (hidden), Sigmoid (output)',
    features: [
      'categoryEnvScore_dataDriven',
      'novaGroupNormalized', 'isUltraProcessed', 'ingredientComplexity',
      'hasPlasticPackaging', 'hasGlassPackaging', 'hasCardboardPackaging',
      'hasMetalPackaging', 'hasCompostablePackaging', 'packagingMaterialCount',
      'hasOrganicCert', 'hasFairTradeCert', 'hasRainforestAllianceCert',
      'hasEUEcolabel', 'hasMSCCert', 'certificationTotalScore',
      'originSustainabilityScore', 'hasLocalOrigin', 'transportEstimateScore',
      'manufacturingSustainability',
      'isVegan', 'isVegetarian', 'hasPalmOil',
      'hasHighSugar', 'hasHighSaturatedFat', 'hasHighSodium',
      'hasHighFat', 'hasLowFat',
      'isMeatProduct', 'isFishSeafood', 'isDairyProduct', 'isPlantBased',
      'isFruitVegetable', 'isCereal', 'isBeverage', 'isFatOil',
      'isSweetSnack', 'isCanned', 'isFrozen', 'isReadyMeal',
    ],
    dependentVariable: 'ecoscore (0-1 normalized sustainability score)',
    implementation: 'Pure TypeScript — zero native dependencies (Hermes-safe)',
  };
}
