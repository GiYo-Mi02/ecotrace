// services/tensorflowModel.ts — Pure TypeScript Neural Network v2.0 (NO native deps)
//
// Architecture: 28 → 64 (ReLU) → 32 (ReLU) → 16 (ReLU) → 1 (Sigmoid)
// Total parameters: 28×64+64 + 64×32+32 + 32×16+16 + 16×1+1 = 2,897
//
// This module implements forward propagation, backpropagation, and Adam
// optimizer entirely in TypeScript — no @tensorflow/tfjs import — so it
// works inside React Native's Hermes engine without crashing.

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Configuration ───────────────────────────────────────────────

const INPUT_DIM = 28;
const HIDDEN1_DIM = 64;
const HIDDEN2_DIM = 32;
const HIDDEN3_DIM = 16;
const OUTPUT_DIM = 1;
const TOTAL_PARAMS =
  (INPUT_DIM * HIDDEN1_DIM + HIDDEN1_DIM) +     // 28×64 + 64 = 1856
  (HIDDEN1_DIM * HIDDEN2_DIM + HIDDEN2_DIM) +   // 64×32 + 32 = 2080
  (HIDDEN2_DIM * HIDDEN3_DIM + HIDDEN3_DIM) +   // 32×16 + 16 = 528
  (HIDDEN3_DIM * OUTPUT_DIM + OUTPUT_DIM);       // 16×1 + 1   = 17
  // Total: 4481

const STORAGE_KEY = '@ecotrace_nn_weights_v3';
const METADATA_KEY = '@ecotrace_nn_metadata_v3';

// ─── Types ───────────────────────────────────────────────────────

interface NNWeights {
  W1: number[][];  // 28 × 64
  b1: number[];    // 64
  W2: number[][];  // 64 × 32
  b2: number[];    // 32
  W3: number[][];  // 32 × 16
  b3: number[];    // 16
  W4: number[][];  // 16 × 1
  b4: number[];    // 1
}

interface AdamState {
  mW1: number[][]; vW1: number[][];
  mb1: number[];   vb1: number[];
  mW2: number[][]; vW2: number[][];
  mb2: number[];   vb2: number[];
  mW3: number[][]; vW3: number[][];
  mb3: number[];   vb3: number[];
  mW4: number[][]; vW4: number[][];
  mb4: number[];   vb4: number[];
  t: number;
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

interface TrainingMetadata {
  trainedAt: string;
  epochs: number;
  finalLoss: number;
  sampleCount: number;
  architecture: string;
  accuracy?: ModelAccuracyMetrics;
}

// ─── Math Utilities ──────────────────────────────────────────────

function glorotInit(fanIn: number, fanOut: number): number[][] {
  const limit = Math.sqrt(6.0 / (fanIn + fanOut));
  const matrix: number[][] = [];
  for (let i = 0; i < fanIn; i++) {
    const row: number[] = [];
    for (let j = 0; j < fanOut; j++) {
      row.push((Math.random() * 2 - 1) * limit);
    }
    matrix.push(row);
  }
  return matrix;
}

function zerosVector(n: number): number[] {
  return new Array(n).fill(0);
}

function zerosMatrix(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => new Array(cols).fill(0));
}

function relu(x: number): number {
  return x > 0 ? x : 0;
}

function reluDeriv(x: number): number {
  return x > 0 ? 1 : 0;
}

function sigmoid(x: number): number {
  if (x > 500) return 1;
  if (x < -500) return 0;
  return 1 / (1 + Math.exp(-x));
}

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

// ─── Neural Network Model ────────────────────────────────────────

let weights: NNWeights | null = null;
let adamState: AdamState | null = null;
let metadata: TrainingMetadata | null = null;
let isInitialized = false;

/** Initialize model — tries loading cached weights, else random init */
export async function initModel(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const storedMeta = await AsyncStorage.getItem(METADATA_KEY);

    if (stored) {
      weights = JSON.parse(stored);
      metadata = storedMeta ? JSON.parse(storedMeta) : null;
      isInitialized = true;
      console.log(`[NN] Loaded cached weights. Architecture: ${INPUT_DIM}→${HIDDEN1_DIM}→${HIDDEN2_DIM}→${HIDDEN3_DIM}→${OUTPUT_DIM}`);
      if (metadata) {
        console.log(`[NN] Trained: ${metadata.trainedAt}, Loss: ${metadata.finalLoss.toFixed(6)}, Samples: ${metadata.sampleCount}`);
      }
      return true;
    }
  } catch (e) {
    console.warn('[NN] Cache load failed, initializing fresh weights');
  }

  initRandomWeights();
  isInitialized = true;
  console.log(`[NN] Initialized fresh weights (untrained). Architecture: ${INPUT_DIM}→${HIDDEN1_DIM}→${HIDDEN2_DIM}→${HIDDEN3_DIM}→${OUTPUT_DIM}`);
  return false;
}

function initRandomWeights() {
  weights = {
    W1: glorotInit(INPUT_DIM, HIDDEN1_DIM),
    b1: zerosVector(HIDDEN1_DIM),
    W2: glorotInit(HIDDEN1_DIM, HIDDEN2_DIM),
    b2: zerosVector(HIDDEN2_DIM),
    W3: glorotInit(HIDDEN2_DIM, HIDDEN3_DIM),
    b3: zerosVector(HIDDEN3_DIM),
    W4: glorotInit(HIDDEN3_DIM, OUTPUT_DIM),
    b4: zerosVector(OUTPUT_DIM),
  };
}

function initAdamState() {
  adamState = {
    mW1: zerosMatrix(INPUT_DIM, HIDDEN1_DIM),
    vW1: zerosMatrix(INPUT_DIM, HIDDEN1_DIM),
    mb1: zerosVector(HIDDEN1_DIM),
    vb1: zerosVector(HIDDEN1_DIM),
    mW2: zerosMatrix(HIDDEN1_DIM, HIDDEN2_DIM),
    vW2: zerosMatrix(HIDDEN1_DIM, HIDDEN2_DIM),
    mb2: zerosVector(HIDDEN2_DIM),
    vb2: zerosVector(HIDDEN2_DIM),
    mW3: zerosMatrix(HIDDEN2_DIM, HIDDEN3_DIM),
    vW3: zerosMatrix(HIDDEN2_DIM, HIDDEN3_DIM),
    mb3: zerosVector(HIDDEN3_DIM),
    vb3: zerosVector(HIDDEN3_DIM),
    mW4: zerosMatrix(HIDDEN3_DIM, OUTPUT_DIM),
    vW4: zerosMatrix(HIDDEN3_DIM, OUTPUT_DIM),
    mb4: zerosVector(OUTPUT_DIM),
    vb4: zerosVector(OUTPUT_DIM),
    t: 0,
  };
}

// ─── Forward Pass ────────────────────────────────────────────────

interface ForwardResult {
  z1: number[]; a1: number[];
  z2: number[]; a2: number[];
  z3: number[]; a3: number[];
  z4: number[];
  output: number;
}

function forward(input: number[]): ForwardResult {
  if (!weights) throw new Error('Model not initialized');
  if (input.length !== INPUT_DIM) throw new Error(`Expected ${INPUT_DIM} features, got ${input.length}`);

  // Layer 1: input (28) → hidden1 (64), ReLU
  const z1 = addVec(matMulVec(weights.W1, input), weights.b1);
  const a1 = z1.map(relu);

  // Layer 2: hidden1 (64) → hidden2 (32), ReLU
  const z2 = addVec(matMulVec(weights.W2, a1), weights.b2);
  const a2 = z2.map(relu);

  // Layer 3: hidden2 (32) → hidden3 (16), ReLU
  const z3 = addVec(matMulVec(weights.W3, a2), weights.b3);
  const a3 = z3.map(relu);

  // Layer 4: hidden3 (16) → output (1), Sigmoid
  const z4 = addVec(matMulVec(weights.W4, a3), weights.b4);
  const output = sigmoid(z4[0]);

  return { z1, a1, z2, a2, z3, a3, z4, output };
}

/** Public prediction function — returns score in [0, 1] */
export function predict(features: number[]): number {
  if (!isInitialized || !weights) {
    console.warn('[NN] Model not initialized, returning 0.5');
    return 0.5;
  }
  const result = forward(features);
  return result.output;
}

// ─── Backpropagation ─────────────────────────────────────────────

interface Gradients {
  dW1: number[][]; db1: number[];
  dW2: number[][]; db2: number[];
  dW3: number[][]; db3: number[];
  dW4: number[][]; db4: number[];
}

function backward(input: number[], target: number, fwd: ForwardResult): Gradients {
  if (!weights) throw new Error('Model not initialized');

  // Output layer gradient (MSE + sigmoid derivative)
  const dOutput = 2 * (fwd.output - target);
  const dsigmoid = fwd.output * (1 - fwd.output);

  // Layer 4 gradients
  const dz4 = [dOutput * dsigmoid];
  const dW4: number[][] = zerosMatrix(HIDDEN3_DIM, OUTPUT_DIM);
  for (let i = 0; i < HIDDEN3_DIM; i++) {
    dW4[i][0] = fwd.a3[i] * dz4[0];
  }
  const db4 = [...dz4];

  // Layer 3 gradients
  const da3: number[] = zerosVector(HIDDEN3_DIM);
  for (let i = 0; i < HIDDEN3_DIM; i++) {
    da3[i] = weights.W4[i][0] * dz4[0];
  }
  const dz3 = da3.map((v, i) => v * reluDeriv(fwd.z3[i]));

  const dW3: number[][] = zerosMatrix(HIDDEN2_DIM, HIDDEN3_DIM);
  for (let i = 0; i < HIDDEN2_DIM; i++) {
    for (let j = 0; j < HIDDEN3_DIM; j++) {
      dW3[i][j] = fwd.a2[i] * dz3[j];
    }
  }
  const db3 = [...dz3];

  // Layer 2 gradients
  const da2: number[] = zerosVector(HIDDEN2_DIM);
  for (let i = 0; i < HIDDEN2_DIM; i++) {
    for (let j = 0; j < HIDDEN3_DIM; j++) {
      da2[i] += weights.W3[i][j] * dz3[j];
    }
  }
  const dz2 = da2.map((v, i) => v * reluDeriv(fwd.z2[i]));

  const dW2: number[][] = zerosMatrix(HIDDEN1_DIM, HIDDEN2_DIM);
  for (let i = 0; i < HIDDEN1_DIM; i++) {
    for (let j = 0; j < HIDDEN2_DIM; j++) {
      dW2[i][j] = fwd.a1[i] * dz2[j];
    }
  }
  const db2 = [...dz2];

  // Layer 1 gradients
  const da1: number[] = zerosVector(HIDDEN1_DIM);
  for (let i = 0; i < HIDDEN1_DIM; i++) {
    for (let j = 0; j < HIDDEN2_DIM; j++) {
      da1[i] += weights.W2[i][j] * dz2[j];
    }
  }
  const dz1 = da1.map((v, i) => v * reluDeriv(fwd.z1[i]));

  const dW1: number[][] = zerosMatrix(INPUT_DIM, HIDDEN1_DIM);
  for (let i = 0; i < INPUT_DIM; i++) {
    for (let j = 0; j < HIDDEN1_DIM; j++) {
      dW1[i][j] = input[i] * dz1[j];
    }
  }
  const db1 = [...dz1];

  return { dW1, db1, dW2, db2, dW3, db3, dW4, db4 };
}

// ─── Adam Optimizer ──────────────────────────────────────────────

function adamUpdate(
  lr: number = 0.001,
  beta1: number = 0.9,
  beta2: number = 0.999,
  epsilon: number = 1e-8,
  grads: Gradients,
): void {
  if (!weights || !adamState) return;

  adamState.t++;
  const t = adamState.t;

  function updateMatrix(W: number[][], dW: number[][], mW: number[][], vW: number[][]) {
    for (let i = 0; i < W.length; i++) {
      for (let j = 0; j < W[0].length; j++) {
        mW[i][j] = beta1 * mW[i][j] + (1 - beta1) * dW[i][j];
        vW[i][j] = beta2 * vW[i][j] + (1 - beta2) * dW[i][j] * dW[i][j];
        const mHat = mW[i][j] / (1 - Math.pow(beta1, t));
        const vHat = vW[i][j] / (1 - Math.pow(beta2, t));
        W[i][j] -= lr * mHat / (Math.sqrt(vHat) + epsilon);
      }
    }
  }

  function updateVector(b: number[], db: number[], mb: number[], vb: number[]) {
    for (let i = 0; i < b.length; i++) {
      mb[i] = beta1 * mb[i] + (1 - beta1) * db[i];
      vb[i] = beta2 * vb[i] + (1 - beta2) * db[i] * db[i];
      const mHat = mb[i] / (1 - Math.pow(beta1, t));
      const vHat = vb[i] / (1 - Math.pow(beta2, t));
      b[i] -= lr * mHat / (Math.sqrt(vHat) + epsilon);
    }
  }

  updateMatrix(weights.W1, grads.dW1, adamState.mW1, adamState.vW1);
  updateVector(weights.b1, grads.db1, adamState.mb1, adamState.vb1);
  updateMatrix(weights.W2, grads.dW2, adamState.mW2, adamState.vW2);
  updateVector(weights.b2, grads.db2, adamState.mb2, adamState.vb2);
  updateMatrix(weights.W3, grads.dW3, adamState.mW3, adamState.vW3);
  updateVector(weights.b3, grads.db3, adamState.mb3, adamState.vb3);
  updateMatrix(weights.W4, grads.dW4, adamState.mW4, adamState.vW4);
  updateVector(weights.b4, grads.db4, adamState.mb4, adamState.vb4);
}

// ─── Training ────────────────────────────────────────────────────

export interface TrainingConfig {
  epochs: number;
  learningRate: number;
  batchSize: number;
  validationSplit: number;
  logInterval: number;
}

const DEFAULT_CONFIG: TrainingConfig = {
  epochs: 50,
  learningRate: 0.001,
  batchSize: 32,
  validationSplit: 0.2,
  logInterval: 10,
};

/**
 * Train the model on provided feature vectors and labels.
 * @param features 2D array: [numSamples][28]
 * @param labels 1D array: [numSamples] values in [0, 1]
 */
export async function train(
  features: number[][],
  labels: number[],
  config: Partial<TrainingConfig> = {},
): Promise<{ finalLoss: number; accuracy: ModelAccuracyMetrics }> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (!isInitialized) {
    initRandomWeights();
    isInitialized = true;
  }
  initAdamState();

  const splitIdx = Math.floor(features.length * (1 - cfg.validationSplit));
  const indices = Array.from({ length: features.length }, (_, i) => i);
  shuffleArray(indices);

  const trainX = indices.slice(0, splitIdx).map(i => features[i]);
  const trainY = indices.slice(0, splitIdx).map(i => labels[i]);
  const valX = indices.slice(splitIdx).map(i => features[i]);
  const valY = indices.slice(splitIdx).map(i => labels[i]);

  console.log(`[NN] Training: ${trainX.length} samples, Validation: ${valX.length} samples`);
  console.log(`[NN] Architecture: ${INPUT_DIM}→${HIDDEN1_DIM}→${HIDDEN2_DIM}→${HIDDEN3_DIM}→${OUTPUT_DIM} (${TOTAL_PARAMS} params)`);
  console.log(`[NN] Config: epochs=${cfg.epochs}, lr=${cfg.learningRate}, batch=${cfg.batchSize}`);

  let finalTrainLoss = 0;

  for (let epoch = 0; epoch < cfg.epochs; epoch++) {
    const epochIndices = Array.from({ length: trainX.length }, (_, i) => i);
    shuffleArray(epochIndices);

    let epochLoss = 0;

    for (let batchStart = 0; batchStart < trainX.length; batchStart += cfg.batchSize) {
      const batchEnd = Math.min(batchStart + cfg.batchSize, trainX.length);
      const batchGrads: Gradients = {
        dW1: zerosMatrix(INPUT_DIM, HIDDEN1_DIM), db1: zerosVector(HIDDEN1_DIM),
        dW2: zerosMatrix(HIDDEN1_DIM, HIDDEN2_DIM), db2: zerosVector(HIDDEN2_DIM),
        dW3: zerosMatrix(HIDDEN2_DIM, HIDDEN3_DIM), db3: zerosVector(HIDDEN3_DIM),
        dW4: zerosMatrix(HIDDEN3_DIM, OUTPUT_DIM), db4: zerosVector(OUTPUT_DIM),
      };

      let batchLoss = 0;
      const batchSize = batchEnd - batchStart;

      for (let b = batchStart; b < batchEnd; b++) {
        const idx = epochIndices[b];
        const fwd = forward(trainX[idx]);
        const grads = backward(trainX[idx], trainY[idx], fwd);

        for (let i = 0; i < INPUT_DIM; i++)
          for (let j = 0; j < HIDDEN1_DIM; j++)
            batchGrads.dW1[i][j] += grads.dW1[i][j] / batchSize;
        for (let j = 0; j < HIDDEN1_DIM; j++)
          batchGrads.db1[j] += grads.db1[j] / batchSize;

        for (let i = 0; i < HIDDEN1_DIM; i++)
          for (let j = 0; j < HIDDEN2_DIM; j++)
            batchGrads.dW2[i][j] += grads.dW2[i][j] / batchSize;
        for (let j = 0; j < HIDDEN2_DIM; j++)
          batchGrads.db2[j] += grads.db2[j] / batchSize;

        for (let i = 0; i < HIDDEN2_DIM; i++)
          for (let j = 0; j < HIDDEN3_DIM; j++)
            batchGrads.dW3[i][j] += grads.dW3[i][j] / batchSize;
        for (let j = 0; j < HIDDEN3_DIM; j++)
          batchGrads.db3[j] += grads.db3[j] / batchSize;

        for (let i = 0; i < HIDDEN3_DIM; i++)
          for (let j = 0; j < OUTPUT_DIM; j++)
            batchGrads.dW4[i][j] += grads.dW4[i][j] / batchSize;
        for (let j = 0; j < OUTPUT_DIM; j++)
          batchGrads.db4[j] += grads.db4[j] / batchSize;

        batchLoss += (fwd.output - trainY[idx]) ** 2;
      }

      adamUpdate(cfg.learningRate, 0.9, 0.999, 1e-8, batchGrads);
      epochLoss += batchLoss;
    }

    finalTrainLoss = epochLoss / trainX.length;

    if ((epoch + 1) % cfg.logInterval === 0 || epoch === 0) {
      const valLoss = computeMSE(valX, valY);
      console.log(`[NN] Epoch ${epoch + 1}/${cfg.epochs}  trainLoss: ${finalTrainLoss.toFixed(6)}  valLoss: ${valLoss.toFixed(6)}`);
    }
  }

  const accuracy = evaluateAccuracy(valX, valY);
  logAccuracyMetrics(accuracy);

  metadata = {
    trainedAt: new Date().toISOString(),
    epochs: cfg.epochs,
    finalLoss: finalTrainLoss,
    sampleCount: features.length,
    architecture: `${INPUT_DIM}→${HIDDEN1_DIM}→${HIDDEN2_DIM}→${HIDDEN3_DIM}→${OUTPUT_DIM}`,
    accuracy,
  };

  await saveWeights();

  return { finalLoss: finalTrainLoss, accuracy };
}

function computeMSE(X: number[][], Y: number[]): number {
  let totalLoss = 0;
  for (let i = 0; i < X.length; i++) {
    const pred = forward(X[i]).output;
    totalLoss += (pred - Y[i]) ** 2;
  }
  return totalLoss / X.length;
}

/** Load pre-trained weights from a JSON object (e.g., bundled asset) */
export function loadWeightsFromJSON(weightsJSON: NNWeights): void {
  weights = weightsJSON;
  isInitialized = true;
  console.log(`[NN] Loaded pre-trained weights from JSON bundle`);
}

// ─── Accuracy Evaluation ─────────────────────────────────────────

export function evaluateAccuracy(X: number[][], Y: number[]): ModelAccuracyMetrics {
  if (X.length === 0) {
    return {
      mse: 0, rmse: 0, mae: 0, rSquared: 0,
      accuracyAtTolerance5: 0, accuracyAtTolerance10: 0,
      accuracyAtTolerance15: 0, accuracyAtTolerance20: 0,
      sampleCount: 0,
    };
  }

  let sumSqError = 0;
  let sumAbsError = 0;
  const yMean = Y.reduce((s, v) => s + v, 0) / Y.length;
  let ssTot = 0;
  let within5 = 0, within10 = 0, within15 = 0, within20 = 0;

  for (let i = 0; i < X.length; i++) {
    const pred = forward(X[i]).output;
    const predScore = pred * 100;
    const actualScore = Y[i] * 100;
    const diff = Math.abs(predScore - actualScore);

    sumSqError += (pred - Y[i]) ** 2;
    sumAbsError += Math.abs(pred - Y[i]);
    ssTot += (Y[i] - yMean) ** 2;

    if (diff <= 5) within5++;
    if (diff <= 10) within10++;
    if (diff <= 15) within15++;
    if (diff <= 20) within20++;
  }

  const n = X.length;
  const mse = sumSqError / n;
  const rmse = Math.sqrt(mse);
  const mae = sumAbsError / n;
  const rSquared = ssTot > 0 ? 1 - (sumSqError / ssTot) : 0;

  return {
    mse, rmse, mae, rSquared,
    accuracyAtTolerance5: (within5 / n) * 100,
    accuracyAtTolerance10: (within10 / n) * 100,
    accuracyAtTolerance15: (within15 / n) * 100,
    accuracyAtTolerance20: (within20 / n) * 100,
    sampleCount: n,
  };
}

export function logAccuracyMetrics(metrics: ModelAccuracyMetrics): void {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║    ECOTRACE Neural Network Accuracy      ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  MSE:              ${metrics.mse.toFixed(6).padStart(18)}  ║`);
  console.log(`║  RMSE:             ${metrics.rmse.toFixed(6).padStart(18)}  ║`);
  console.log(`║  MAE:              ${metrics.mae.toFixed(6).padStart(18)}  ║`);
  console.log(`║  R²:               ${metrics.rSquared.toFixed(6).padStart(18)}  ║`);
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Within ±5 pts:    ${(metrics.accuracyAtTolerance5.toFixed(1) + '%').padStart(18)}  ║`);
  console.log(`║  Within ±10 pts:   ${(metrics.accuracyAtTolerance10.toFixed(1) + '%').padStart(18)}  ║`);
  console.log(`║  Within ±15 pts:   ${(metrics.accuracyAtTolerance15.toFixed(1) + '%').padStart(18)}  ║`);
  console.log(`║  Within ±20 pts:   ${(metrics.accuracyAtTolerance20.toFixed(1) + '%').padStart(18)}  ║`);
  console.log(`║  Validation N:     ${String(metrics.sampleCount).padStart(18)}  ║`);
  console.log('╚══════════════════════════════════════════╝\n');
}

// ─── Persistence ─────────────────────────────────────────────────

async function saveWeights(): Promise<void> {
  if (!weights) return;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(weights));
    if (metadata) {
      await AsyncStorage.setItem(METADATA_KEY, JSON.stringify(metadata));
    }
    console.log('[NN] Weights saved to AsyncStorage');
  } catch (e) {
    console.error('[NN] Failed to save weights:', e);
  }
}

export async function clearCachedWeights(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
  await AsyncStorage.removeItem(METADATA_KEY);
  isInitialized = false;
  weights = null;
  metadata = null;
  console.log('[NN] Cleared cached weights');
}

// ─── Status ──────────────────────────────────────────────────────

export function getModelStatus() {
  return {
    isInitialized,
    hasTrained: metadata !== null,
    totalParameters: TOTAL_PARAMS,
    architecture: `${INPUT_DIM}→${HIDDEN1_DIM}→${HIDDEN2_DIM}→${HIDDEN3_DIM}→${OUTPUT_DIM}`,
    trainingMetadata: metadata,
    learningType: 'Supervised Learning (Regression)',
    algorithm: 'Feedforward Neural Network (Multi-Layer Perceptron)',
    optimizer: 'Adam (Adaptive Moment Estimation)',
    lossFunction: 'Mean Squared Error (MSE)',
    activations: 'ReLU (hidden), Sigmoid (output)',
    independentVariables: [
      'categoryEnvironmentScore', 'categoryProcessingLevel', 'categoryHealthScore',
      'novaGroupNormalized', 'isUltraProcessed', 'ingredientComplexity',
      'hasPlasticPackaging', 'hasGlassPackaging', 'hasCardboardPackaging',
      'hasMetalPackaging', 'hasCompostablePackaging', 'packagingMaterialCount',
      'hasOrganicCert', 'hasFairTradeCert', 'hasRainforestAllianceCert',
      'hasEUEcolabel', 'hasMSCCert', 'certificationTotalScore',
      'originSustainabilityScore', 'hasLocalOrigin', 'transportEstimateScore',
      'manufacturingSustainability',
      'isVegan', 'isVegetarian', 'hasPalmOil',
      'hasHighSugar', 'hasHighSaturatedFat', 'hasHighSodium',
    ],
    dependentVariable: 'ecoscore (0-1 normalized sustainability score)',
    implementation: 'Pure TypeScript — zero native dependencies (Hermes-safe)',
  };
}

// ─── Helpers ─────────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
