// services/tensorflowModel.ts — Pure TypeScript Neural Network for sustainability scoring
//
// GENUINE MACHINE LEARNING implementation — NO native dependencies.
//
// Why pure TypeScript instead of @tensorflow/tfjs?
//   TF.js relies on Node.js `util.isTypedArray` which doesn't exist in
//   React Native's Hermes engine, causing a runtime crash. This file
//   implements the same neural network math from scratch — matrix multiply,
//   ReLU, sigmoid, backpropagation, and Adam optimizer — in pure TS.
//
// Architecture:
//   Input (12 features) → Dense(16, ReLU) → Dense(8, ReLU) → Dense(1, sigmoid)
//   Total learnable parameters: 353
//     - W1: 12×16=192, b1: 16  (hidden layer 1)
//     - W2: 16×8=128,  b2: 8   (hidden layer 2)
//     - W3: 8×1=8,     b3: 1   (output layer)
//
// Training:
//   - On first app launch, trains on embedded dataset (~2-4 seconds)
//   - Uses Adam optimizer with backpropagation (real gradient descent)
//   - Caches learned weights in AsyncStorage for instant future loads
//   - Can also be trained offline with scripts/trainModel.js (uses TF.js in Node)

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NUM_FEATURES } from '@/data/trainingDataset';

// ─── Constants ───────────────────────────────────────────────────
const MODEL_CACHE_KEY = '@ecotrace_ml_model_weights';
const MODEL_VERSION_KEY = '@ecotrace_ml_model_version';
const CURRENT_MODEL_VERSION = '1.1.0'; // Bumped: pure-TS engine

const TRAINING_CONFIG = {
  epochs: 80,
  batchSize: 16,
  learningRate: 0.005,
  validationSplit: 0.15,
  // Adam optimizer hyperparameters
  beta1: 0.9,
  beta2: 0.999,
  epsilon: 1e-8,
};

// ─── Weight types ────────────────────────────────────────────────
interface DenseLayerWeights {
  W: number[][]; // [inputDim][outputDim]
  b: number[];   // [outputDim]
}

interface ModelWeights {
  layer1: DenseLayerWeights; // 12 → 16
  layer2: DenseLayerWeights; // 16 → 8
  layer3: DenseLayerWeights; // 8  → 1
}

// Adam optimizer state per parameter matrix
interface AdamState {
  mW: number[][]; vW: number[][];
  mb: number[];   vb: number[];
}

// ─── Accuracy metrics ────────────────────────────────────────────
// Computed after training on the validation set
export interface ModelAccuracyMetrics {
  // ── Loss Metrics ──
  mse: number;            // Mean Squared Error (lower = better)
  rmse: number;           // Root Mean Squared Error (in score units 0-100)
  mae: number;            // Mean Absolute Error (avg point distance)

  // ── Regression Fit ──
  rSquared: number;       // R² Coefficient of Determination (1.0 = perfect)

  // ── Tolerance-Based Accuracy ──
  accuracyWithin5: number;  // % of predictions within ±5 points
  accuracyWithin10: number; // % of predictions within ±10 points
  accuracyWithin15: number; // % of predictions within ±15 points
  accuracyWithin20: number; // % of predictions within ±20 points

  // ── Dataset Info ──
  trainSamples: number;
  validationSamples: number;
  epochsTrained: number;
}

// ─── Model state ─────────────────────────────────────────────────
let weights: ModelWeights | null = null;
let isModelReady = false;
let isTraining = false;
let trainingLogs: { epoch: number; loss: number; valLoss?: number }[] = [];
let accuracyMetrics: ModelAccuracyMetrics | null = null;

// ═══════════════════════════════════════════════════════════════════
// MATH PRIMITIVES — pure TypeScript matrix operations
// ═══════════════════════════════════════════════════════════════════

/** Glorot (Xavier) uniform initialization */
function glorotUniform(fanIn: number, fanOut: number): number[][] {
  const limit = Math.sqrt(6 / (fanIn + fanOut));
  const W: number[][] = [];
  for (let i = 0; i < fanIn; i++) {
    const row: number[] = [];
    for (let j = 0; j < fanOut; j++) {
      row.push(Math.random() * 2 * limit - limit);
    }
    W.push(row);
  }
  return W;
}

/** Create zero-initialized matrix */
function zeros2D(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => new Array(cols).fill(0));
}

/** Create zero-initialized vector */
function zeros1D(n: number): number[] {
  return new Array(n).fill(0);
}

/** Matrix multiply: A[m×k] @ B[k×n] → C[m×n] */
function matMul(A: number[][], B: number[][]): number[][] {
  const m = A.length;
  const k = A[0].length;
  const n = B[0].length;
  const C: number[][] = [];
  for (let i = 0; i < m; i++) {
    const row = new Array(n).fill(0);
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let p = 0; p < k; p++) {
        sum += A[i][p] * B[p][j];
      }
      row[j] = sum;
    }
    C.push(row);
  }
  return C;
}

/** Transpose matrix: A[m×n] → A^T[n×m] */
function transpose(A: number[][]): number[][] {
  const m = A.length;
  const n = A[0].length;
  const T: number[][] = [];
  for (let j = 0; j < n; j++) {
    const row: number[] = [];
    for (let i = 0; i < m; i++) {
      row.push(A[i][j]);
    }
    T.push(row);
  }
  return T;
}

/** Add bias to each row of matrix: X[m×n] + b[n] → Y[m×n] */
function addBias(X: number[][], b: number[]): number[][] {
  return X.map(row => row.map((val, j) => val + b[j]));
}

/** ReLU activation: max(0, x) */
function relu(X: number[][]): number[][] {
  return X.map(row => row.map(val => Math.max(0, val)));
}

/** ReLU derivative: 1 if x > 0, else 0 */
function reluDerivative(X: number[][]): number[][] {
  return X.map(row => row.map(val => val > 0 ? 1 : 0));
}

/** Sigmoid activation: 1 / (1 + exp(-x)) */
function sigmoidFn(X: number[][]): number[][] {
  return X.map(row => row.map(val => {
    const clipped = Math.max(-500, Math.min(500, val)); // Prevent overflow
    return 1 / (1 + Math.exp(-clipped));
  }));
}

/** Element-wise multiply: A ⊙ B */
function elementMul(A: number[][], B: number[][]): number[][] {
  return A.map((row, i) => row.map((val, j) => val * B[i][j]));
}

/** Element-wise subtract: A - B */
function elementSub(A: number[][], B: number[][]): number[][] {
  return A.map((row, i) => row.map((val, j) => val - B[i][j]));
}

/** Sum columns: X[m×n] → sums[n] (sum over all rows) */
function sumColumns(X: number[][]): number[] {
  const n = X[0].length;
  const sums = new Array(n).fill(0);
  for (const row of X) {
    for (let j = 0; j < n; j++) {
      sums[j] += row[j];
    }
  }
  return sums;
}

// ═══════════════════════════════════════════════════════════════════
// NEURAL NETWORK — forward pass, backprop, Adam optimizer
// ═══════════════════════════════════════════════════════════════════

/** Initialize model weights with Glorot uniform */
function initializeWeights(): ModelWeights {
  return {
    layer1: { W: glorotUniform(NUM_FEATURES, 16), b: zeros1D(16) },
    layer2: { W: glorotUniform(16, 8),            b: zeros1D(8) },
    layer3: { W: glorotUniform(8, 1),             b: zeros1D(1) },
  };
}

/** Forward pass — returns all intermediate values for backprop */
interface ForwardCache {
  z1: number[][]; h1: number[][]; // Layer 1 pre/post activation
  z2: number[][]; h2: number[][]; // Layer 2 pre/post activation
  z3: number[][]; out: number[][]; // Output layer
}

function forward(X: number[][], w: ModelWeights): ForwardCache {
  // Layer 1: X @ W1 + b1 → ReLU
  const z1 = addBias(matMul(X, w.layer1.W), w.layer1.b);
  const h1 = relu(z1);

  // Layer 2: h1 @ W2 + b2 → ReLU
  const z2 = addBias(matMul(h1, w.layer2.W), w.layer2.b);
  const h2 = relu(z2);

  // Layer 3: h2 @ W3 + b3 → Sigmoid
  const z3 = addBias(matMul(h2, w.layer3.W), w.layer3.b);
  const out = sigmoidFn(z3);

  return { z1, h1, z2, h2, z3, out };
}

/** Backpropagation — computes gradients for all parameters */
interface Gradients {
  dW1: number[][]; db1: number[];
  dW2: number[][]; db2: number[];
  dW3: number[][]; db3: number[];
}

function backward(
  X: number[][],
  Y: number[][],
  w: ModelWeights,
  cache: ForwardCache,
): Gradients {
  const m = X.length; // Batch size

  // Output layer gradient
  // dL/dout = 2 * (out - Y) / m  (MSE derivative)
  // dout/dz3 = out * (1 - out)   (sigmoid derivative)
  const outMinusY = elementSub(cache.out, Y);
  const sigmoidDeriv = cache.out.map(row =>
    row.map(val => val * (1 - val))
  );
  const dz3 = elementMul(
    outMinusY.map(row => row.map(val => (2 * val) / m)),
    sigmoidDeriv,
  );

  const dW3 = matMul(transpose(cache.h2), dz3);
  const db3 = sumColumns(dz3);

  // Layer 2 gradient
  const dh2 = matMul(dz3, transpose(w.layer3.W));
  const dz2 = elementMul(dh2, reluDerivative(cache.z2));

  const dW2 = matMul(transpose(cache.h1), dz2);
  const db2 = sumColumns(dz2);

  // Layer 1 gradient
  const dh1 = matMul(dz2, transpose(w.layer2.W));
  const dz1 = elementMul(dh1, reluDerivative(cache.z1));

  const dW1 = matMul(transpose(X), dz1);
  const db1 = sumColumns(dz1);

  return { dW1, db1, dW2, db2, dW3, db3 };
}

/** Initialize Adam optimizer state */
function createAdamState(w: ModelWeights): { s1: AdamState; s2: AdamState; s3: AdamState } {
  return {
    s1: {
      mW: zeros2D(w.layer1.W.length, w.layer1.W[0].length),
      vW: zeros2D(w.layer1.W.length, w.layer1.W[0].length),
      mb: zeros1D(w.layer1.b.length),
      vb: zeros1D(w.layer1.b.length),
    },
    s2: {
      mW: zeros2D(w.layer2.W.length, w.layer2.W[0].length),
      vW: zeros2D(w.layer2.W.length, w.layer2.W[0].length),
      mb: zeros1D(w.layer2.b.length),
      vb: zeros1D(w.layer2.b.length),
    },
    s3: {
      mW: zeros2D(w.layer3.W.length, w.layer3.W[0].length),
      vW: zeros2D(w.layer3.W.length, w.layer3.W[0].length),
      mb: zeros1D(w.layer3.b.length),
      vb: zeros1D(w.layer3.b.length),
    },
  };
}

/** Adam update for a weight matrix */
function adamUpdateMatrix(
  W: number[][], dW: number[][], m: number[][], v: number[][],
  t: number, lr: number, beta1: number, beta2: number, eps: number,
): void {
  const bc1 = 1 - Math.pow(beta1, t);
  const bc2 = 1 - Math.pow(beta2, t);
  for (let i = 0; i < W.length; i++) {
    for (let j = 0; j < W[i].length; j++) {
      m[i][j] = beta1 * m[i][j] + (1 - beta1) * dW[i][j];
      v[i][j] = beta2 * v[i][j] + (1 - beta2) * dW[i][j] * dW[i][j];
      const mHat = m[i][j] / bc1;
      const vHat = v[i][j] / bc2;
      W[i][j] -= lr * mHat / (Math.sqrt(vHat) + eps);
    }
  }
}

/** Adam update for a bias vector */
function adamUpdateVector(
  b: number[], db: number[], m: number[], v: number[],
  t: number, lr: number, beta1: number, beta2: number, eps: number,
): void {
  const bc1 = 1 - Math.pow(beta1, t);
  const bc2 = 1 - Math.pow(beta2, t);
  for (let i = 0; i < b.length; i++) {
    m[i] = beta1 * m[i] + (1 - beta1) * db[i];
    v[i] = beta2 * v[i] + (1 - beta2) * db[i] * db[i];
    const mHat = m[i] / bc1;
    const vHat = v[i] / bc2;
    b[i] -= lr * mHat / (Math.sqrt(vHat) + eps);
  }
}

// ═══════════════════════════════════════════════════════════════════
// TRAINING
// ═══════════════════════════════════════════════════════════════════

/** Compute MSE loss for a batch */
function computeLoss(predictions: number[][], targets: number[][]): number {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < predictions.length; i++) {
    for (let j = 0; j < predictions[i].length; j++) {
      const diff = predictions[i][j] - targets[i][j];
      sum += diff * diff;
      count++;
    }
  }
  return sum / count;
}

/** Fisher-Yates shuffle for arrays */
function shuffleIndices(n: number): number[] {
  const indices = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

/** Train the model on embedded dataset */
async function trainOnEmbeddedData(): Promise<void> {
  const { getTrainingExamples, augmentTrainingData, examplesToArrays, shuffleData } =
    await import('@/data/trainingDataset');

  console.log('[ML] Loading training data...');
  const rawExamples = getTrainingExamples();
  console.log(`[ML] Base training examples: ${rawExamples.length}`);

  const augmented = augmentTrainingData(rawExamples, 5);
  console.log(`[ML] Augmented training examples: ${augmented.length}`);

  const { features, targets } = examplesToArrays(augmented);
  const shuffled = shuffleData(features, targets);

  // Split into train / validation
  const valSize = Math.floor(shuffled.features.length * TRAINING_CONFIG.validationSplit);
  const trainSize = shuffled.features.length - valSize;

  const trainX = shuffled.features.slice(0, trainSize);
  const trainY = shuffled.targets.slice(0, trainSize).map(t => [t]); // shape [N, 1]
  const valX = shuffled.features.slice(trainSize);
  const valY = shuffled.targets.slice(trainSize).map(t => [t]);

  console.log(`[ML] Train: ${trainSize}, Validation: ${valSize}`);
  console.log('[ML] Starting gradient descent training...');

  const { lr, beta1, beta2, epsilon, epochs, batchSize } = {
    lr: TRAINING_CONFIG.learningRate,
    beta1: TRAINING_CONFIG.beta1,
    beta2: TRAINING_CONFIG.beta2,
    epsilon: TRAINING_CONFIG.epsilon,
    epochs: TRAINING_CONFIG.epochs,
    batchSize: TRAINING_CONFIG.batchSize,
  };

  const adam = createAdamState(weights!);
  trainingLogs = [];
  let t = 0; // Adam timestep

  for (let epoch = 0; epoch < epochs; epoch++) {
    // Shuffle training data each epoch
    const order = shuffleIndices(trainSize);
    let epochLoss = 0;
    let batchCount = 0;

    // Mini-batch gradient descent
    for (let start = 0; start < trainSize; start += batchSize) {
      const end = Math.min(start + batchSize, trainSize);
      const batchX: number[][] = [];
      const batchY: number[][] = [];
      for (let i = start; i < end; i++) {
        batchX.push(trainX[order[i]]);
        batchY.push(trainY[order[i]]);
      }

      t++;

      // Forward pass
      const cache = forward(batchX, weights!);

      // Compute loss
      epochLoss += computeLoss(cache.out, batchY);
      batchCount++;

      // Backward pass (backpropagation)
      const grads = backward(batchX, batchY, weights!, cache);

      // Adam optimizer updates
      adamUpdateMatrix(weights!.layer1.W, grads.dW1, adam.s1.mW, adam.s1.vW, t, lr, beta1, beta2, epsilon);
      adamUpdateVector(weights!.layer1.b, grads.db1, adam.s1.mb, adam.s1.vb, t, lr, beta1, beta2, epsilon);
      adamUpdateMatrix(weights!.layer2.W, grads.dW2, adam.s2.mW, adam.s2.vW, t, lr, beta1, beta2, epsilon);
      adamUpdateVector(weights!.layer2.b, grads.db2, adam.s2.mb, adam.s2.vb, t, lr, beta1, beta2, epsilon);
      adamUpdateMatrix(weights!.layer3.W, grads.dW3, adam.s3.mW, adam.s3.vW, t, lr, beta1, beta2, epsilon);
      adamUpdateVector(weights!.layer3.b, grads.db3, adam.s3.mb, adam.s3.vb, t, lr, beta1, beta2, epsilon);
    }

    const avgTrainLoss = epochLoss / batchCount;

    // Validation loss
    const valCache = forward(valX, weights!);
    const valLoss = computeLoss(valCache.out, valY);

    trainingLogs.push({ epoch, loss: avgTrainLoss, valLoss });

    if (epoch % 10 === 0 || epoch === epochs - 1) {
      console.log(
        `[ML] Epoch ${epoch + 1}/${epochs} — ` +
        `Loss: ${avgTrainLoss.toFixed(6)}, Val Loss: ${valLoss.toFixed(6)}`
      );
    }
  }

  const final = trainingLogs[trainingLogs.length - 1];
  console.log(
    `[ML] Training complete! Final Loss: ${final.loss.toFixed(6)}, ` +
    `Val Loss: ${(final.valLoss || 0).toFixed(6)}`
  );

  // ── Evaluate accuracy on validation set ─────────────────────
  accuracyMetrics = evaluateAccuracy(valX, valY, trainSize, valSize, epochs);
  logAccuracyMetrics(accuracyMetrics);
}

// ═══════════════════════════════════════════════════════════════════
// ACCURACY EVALUATION — computed on validation set after training
// ═══════════════════════════════════════════════════════════════════

/** Evaluate all accuracy metrics on a dataset */
function evaluateAccuracy(
  X: number[][], Y: number[][], // Y is [[score01], ...]
  trainSamples: number,
  validationSamples: number,
  epochsTrained: number,
): ModelAccuracyMetrics {
  const predictions = forward(X, weights!);
  const n = X.length;

  // Convert predictions & targets to 0-100 scale
  const predScores: number[] = [];
  const trueScores: number[] = [];
  for (let i = 0; i < n; i++) {
    predScores.push(predictions.out[i][0] * 100);
    trueScores.push(Y[i][0] * 100);
  }

  // ── MSE ──
  let sumSqErr = 0;
  for (let i = 0; i < n; i++) {
    const err = predScores[i] - trueScores[i];
    sumSqErr += err * err;
  }
  const mse = sumSqErr / n;

  // ── RMSE ──
  const rmse = Math.sqrt(mse);

  // ── MAE ──
  let sumAbsErr = 0;
  for (let i = 0; i < n; i++) {
    sumAbsErr += Math.abs(predScores[i] - trueScores[i]);
  }
  const mae = sumAbsErr / n;

  // ── R² (Coefficient of Determination) ──
  const meanTrue = trueScores.reduce((a, b) => a + b, 0) / n;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    ssTot += (trueScores[i] - meanTrue) ** 2;
    ssRes += (trueScores[i] - predScores[i]) ** 2;
  }
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  // ── Tolerance-based accuracy ──
  let within5 = 0, within10 = 0, within15 = 0, within20 = 0;
  for (let i = 0; i < n; i++) {
    const diff = Math.abs(predScores[i] - trueScores[i]);
    if (diff <= 5)  within5++;
    if (diff <= 10) within10++;
    if (diff <= 15) within15++;
    if (diff <= 20) within20++;
  }

  return {
    mse: Math.round(mse * 100) / 100,
    rmse: Math.round(rmse * 100) / 100,
    mae: Math.round(mae * 100) / 100,
    rSquared: Math.round(rSquared * 10000) / 10000,
    accuracyWithin5: Math.round((within5 / n) * 10000) / 100,
    accuracyWithin10: Math.round((within10 / n) * 10000) / 100,
    accuracyWithin15: Math.round((within15 / n) * 10000) / 100,
    accuracyWithin20: Math.round((within20 / n) * 10000) / 100,
    trainSamples,
    validationSamples,
    epochsTrained,
  };
}

/** Log accuracy metrics to console */
function logAccuracyMetrics(m: ModelAccuracyMetrics): void {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║       ECOTRACE ML — Model Accuracy Report           ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  MSE  (Mean Squared Error):      ${String(m.mse).padStart(10)}     ║`);
  console.log(`║  RMSE (Root Mean Squared Error):  ${String(m.rmse).padStart(10)}     ║`);
  console.log(`║  MAE  (Mean Absolute Error):      ${String(m.mae).padStart(10)}     ║`);
  console.log(`║  R²   (Coefficient of Determ.):   ${String(m.rSquared).padStart(10)}     ║`);
  console.log('╠──────────────────────────────────────────────────────╣');
  console.log(`║  Accuracy within ±5 pts:       ${String(m.accuracyWithin5 + '%').padStart(10)}     ║`);
  console.log(`║  Accuracy within ±10 pts:      ${String(m.accuracyWithin10 + '%').padStart(10)}     ║`);
  console.log(`║  Accuracy within ±15 pts:      ${String(m.accuracyWithin15 + '%').padStart(10)}     ║`);
  console.log(`║  Accuracy within ±20 pts:      ${String(m.accuracyWithin20 + '%').padStart(10)}     ║`);
  console.log('╠──────────────────────────────────────────────────────╣');
  console.log(`║  Train samples: ${m.trainSamples}  |  Val samples: ${m.validationSamples}  |  Epochs: ${m.epochsTrained}  ║`);
  console.log('╚══════════════════════════════════════════════════════╝');
}

/** Evaluate accuracy from embedded data (used when loading cached weights) */
async function evaluateFromEmbeddedData(): Promise<void> {
  try {
    const { getTrainingExamples, augmentTrainingData, examplesToArrays, shuffleData } =
      await import('@/data/trainingDataset');

    const rawExamples = getTrainingExamples();
    const augmented = augmentTrainingData(rawExamples, 5);
    const { features, targets } = examplesToArrays(augmented);
    const shuffled = shuffleData(features, targets);

    const valSize = Math.floor(shuffled.features.length * TRAINING_CONFIG.validationSplit);
    const trainSize = shuffled.features.length - valSize;

    const valX = shuffled.features.slice(trainSize);
    const valY = shuffled.targets.slice(trainSize).map(t => [t]);

    accuracyMetrics = evaluateAccuracy(valX, valY, trainSize, valSize, TRAINING_CONFIG.epochs);
    logAccuracyMetrics(accuracyMetrics);
  } catch (e) {
    console.warn('[ML] Could not evaluate cached model accuracy:', e);
  }
}

// ═══════════════════════════════════════════════════════════════════
// PERSISTENCE — AsyncStorage cache
// ═══════════════════════════════════════════════════════════════════

/** Serialize weights to JSON-safe format */
function serializeWeights(w: ModelWeights): string {
  return JSON.stringify({
    layer1: { W: w.layer1.W, b: w.layer1.b },
    layer2: { W: w.layer2.W, b: w.layer2.b },
    layer3: { W: w.layer3.W, b: w.layer3.b },
  });
}

/** Deserialize weights from JSON */
function deserializeWeights(json: string): ModelWeights {
  const data = JSON.parse(json);
  return {
    layer1: { W: data.layer1.W, b: data.layer1.b },
    layer2: { W: data.layer2.W, b: data.layer2.b },
    layer3: { W: data.layer3.W, b: data.layer3.b },
  };
}

async function saveModelWeights(): Promise<void> {
  if (!weights) return;
  try {
    await AsyncStorage.setItem(MODEL_CACHE_KEY, serializeWeights(weights));
    await AsyncStorage.setItem(MODEL_VERSION_KEY, CURRENT_MODEL_VERSION);
    console.log('[ML] Model weights saved to cache');
  } catch (e) {
    console.error('[ML] Failed to save model weights:', e);
  }
}

async function loadModelWeights(): Promise<boolean> {
  try {
    const version = await AsyncStorage.getItem(MODEL_VERSION_KEY);
    if (version !== CURRENT_MODEL_VERSION) {
      console.log('[ML] Model version mismatch, need retraining');
      return false;
    }

    const raw = await AsyncStorage.getItem(MODEL_CACHE_KEY);
    if (!raw) return false;

    weights = deserializeWeights(raw);
    console.log('[ML] Model weights loaded from cache');
    return true;
  } catch (e) {
    console.error('[ML] Failed to load cached weights:', e);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════
// PUBLIC API — same interface as the old TF.js version
// ═══════════════════════════════════════════════════════════════════

/** Initialize the ML model (call on app startup) */
export async function initializeModel(): Promise<boolean> {
  if (isModelReady) return true;
  if (isTraining) return false;

  isTraining = true;

  try {
    console.log('[ML] Initializing pure-TS neural network...');

    // Step 1: Create weight matrices
    weights = initializeWeights();
    console.log('[ML] Model architecture: Input(12) → Dense(16,ReLU) → Dense(8,ReLU) → Dense(1,sigmoid)');
    console.log('[ML] Total parameters: 353');

    // Step 2: Try to load cached weights
    const loaded = await loadModelWeights();

    if (!loaded) {
      // Step 3: Train on embedded dataset (first launch only)
      console.log('[ML] No cached model found. Training on embedded dataset...');
      await trainOnEmbeddedData();

      // Step 4: Cache the trained weights
      await saveModelWeights();
    }

    // Step 5: Evaluate accuracy if we just trained (not loaded from cache)
    if (!loaded) {
      console.log('[ML] Accuracy metrics computed — see report above');
    } else {
      // Run quick evaluation on embedded data even when loading from cache
      await evaluateFromEmbeddedData();
    }

    isModelReady = true;
    isTraining = false;
    console.log('[ML] Model ready for predictions!');
    return true;
  } catch (error) {
    console.error('[ML] Model initialization failed:', error);
    isTraining = false;
    return false;
  }
}

/** Run ML prediction — returns sustainability score 0-100 */
export function predictScore(features: number[]): number | null {
  if (!isModelReady || !weights) {
    console.warn('[ML] Model not ready, cannot predict');
    return null;
  }

  try {
    const cache = forward([features], weights);
    const rawScore = cache.out[0][0]; // sigmoid output 0-1
    const score = Math.round(rawScore * 100);
    return Math.max(0, Math.min(100, score));
  } catch (error) {
    console.error('[ML] Prediction failed:', error);
    return null;
  }
}

/** Batch prediction — multiple feature vectors at once */
export function predictBatch(featureBatch: number[][]): number[] | null {
  if (!isModelReady || !weights) return null;

  try {
    const cache = forward(featureBatch, weights);
    return cache.out.map(row => Math.max(0, Math.min(100, Math.round(row[0] * 100))));
  } catch (error) {
    console.error('[ML] Batch prediction failed:', error);
    return null;
  }
}

/** Get model status including accuracy metrics */
export function getModelStatus(): {
  ready: boolean;
  training: boolean;
  version: string;
  architecture: string;
  totalParameters: number;
  trainingLogs: { epoch: number; loss: number; valLoss?: number }[];
  accuracy: ModelAccuracyMetrics | null;
  // ML metadata
  learningType: string;
  algorithm: string;
  optimizer: string;
  lossFunction: string;
  independentVariables: string[];
  dependentVariable: string;
} {
  return {
    ready: isModelReady,
    training: isTraining,
    version: CURRENT_MODEL_VERSION,
    architecture: 'Dense(12→16,ReLU) → Dense(16→8,ReLU) → Dense(8→1,sigmoid)',
    totalParameters: 353,
    trainingLogs,
    accuracy: accuracyMetrics,

    // ── ML Classification Metadata ──────────────────────────
    learningType: 'Supervised Learning',
    algorithm: 'Feedforward Neural Network (Multi-Layer Perceptron / MLP) — Regression',
    optimizer: 'Adam (Adaptive Moment Estimation)',
    lossFunction: 'MSE (Mean Squared Error)',
    independentVariables: [
      'Category Index (normalized 0-1)',
      'NOVA Group (food processing level, 1-4)',
      'Has Organic Certification (binary)',
      'Has Fairtrade Certification (binary)',
      'Has Eco-Certification (binary)',
      'Packaging is Recyclable (binary)',
      'Packaging is Glass (binary)',
      'Packaging is Plastic (binary)',
      'Origin is Local (binary)',
      'Origin is Imported/Far (binary)',
      'Number of Certifications (normalized 0-1)',
      'Processing Level (continuous 0-1)',
    ],
    dependentVariable: 'Sustainability Score (continuous, 0-100)',
  };
}

/** Force retrain (clears cached weights) */
export async function retrainModel(): Promise<boolean> {
  isModelReady = false;
  isTraining = false;

  try {
    await AsyncStorage.removeItem(MODEL_CACHE_KEY);
    await AsyncStorage.removeItem(MODEL_VERSION_KEY);
    console.log('[ML] Cache cleared, retraining...');
    return await initializeModel();
  } catch (error) {
    console.error('[ML] Retrain failed:', error);
    return false;
  }
}

/** Get weight summary for debugging */
export function getWeightSummary(): { layer: string; shape: number[]; min: number; max: number; mean: number }[] {
  if (!weights) return [];

  const summarize = (name: string, W: number[][]) => {
    const flat = W.flat();
    return {
      layer: name,
      shape: [W.length, W[0].length],
      min: Math.min(...flat),
      max: Math.max(...flat),
      mean: flat.reduce((a, b) => a + b, 0) / flat.length,
    };
  };

  return [
    summarize('hidden1_kernel', weights.layer1.W),
    { layer: 'hidden1_bias', shape: [weights.layer1.b.length], min: Math.min(...weights.layer1.b), max: Math.max(...weights.layer1.b), mean: weights.layer1.b.reduce((a, b) => a + b, 0) / weights.layer1.b.length },
    summarize('hidden2_kernel', weights.layer2.W),
    { layer: 'hidden2_bias', shape: [weights.layer2.b.length], min: Math.min(...weights.layer2.b), max: Math.max(...weights.layer2.b), mean: weights.layer2.b.reduce((a, b) => a + b, 0) / weights.layer2.b.length },
    summarize('output_kernel', weights.layer3.W),
    { layer: 'output_bias', shape: [weights.layer3.b.length], min: Math.min(...weights.layer3.b), max: Math.max(...weights.layer3.b), mean: weights.layer3.b.reduce((a, b) => a + b, 0) / weights.layer3.b.length },
  ];
}

/** Cleanup */
export function disposeModel(): void {
  weights = null;
  isModelReady = false;
  console.log('[ML] Model disposed');
}
