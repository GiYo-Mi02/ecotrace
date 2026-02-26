// scripts/evaluateModel.js — ECOTRACE Model Evaluation v2.0
//
// Loads the trained model weights + holdout test set,
// runs forward-pass predictions, and prints detailed metrics.
//
// Metrics:
//   - R² (coefficient of determination)
//   - MAE (mean absolute error, on 0-100 scale)
//   - RMSE (root mean squared error, on 0-100 scale)
//   - Within ±5pts / ±10pts accuracy
//   - Per-grade breakdown (A/B/C/D/E)
//   - Sample predictions with product names
//
// Quality Targets:
//   R² > 0.75   MAE < 10   ±10pts > 80%
//
// Usage: npm run evaluate-model
//        node scripts/evaluateModel.js

const fs = require('fs');
const path = require('path');

// ─── Paths ───────────────────────────────────────────────────────

const MODEL_DIR = path.join(__dirname, '..', 'assets', 'ml', 'eco-score-model');
const WEIGHTS_PATH = path.join(MODEL_DIR, 'weights.json');
const TEST_SET_PATH = path.join(MODEL_DIR, 'testSet.json');
const METADATA_PATH = path.join(__dirname, '..', 'assets', 'ml', 'modelMetadata.json');

// ─── Pure TypeScript Forward Pass ────────────────────────────────

function relu(x) {
  return x > 0 ? x : 0;
}

function sigmoid(x) {
  if (x > 500) return 1;
  if (x < -500) return 0;
  return 1 / (1 + Math.exp(-x));
}

function forwardPass(input, weights) {
  const { W1, b1, W2, b2, W3, b3, W4, b4 } = weights;

  // Layer 1: input → hidden1 (28 → 64)
  const h1 = new Array(b1.length);
  for (let j = 0; j < b1.length; j++) {
    let sum = b1[j];
    for (let i = 0; i < input.length; i++) {
      sum += input[i] * W1[i][j];
    }
    h1[j] = relu(sum);
  }

  // Layer 2: hidden1 → hidden2 (64 → 32)
  const h2 = new Array(b2.length);
  for (let j = 0; j < b2.length; j++) {
    let sum = b2[j];
    for (let i = 0; i < h1.length; i++) {
      sum += h1[i] * W2[i][j];
    }
    h2[j] = relu(sum);
  }

  // Layer 3: hidden2 → hidden3 (32 → 16)
  const h3 = new Array(b3.length);
  for (let j = 0; j < b3.length; j++) {
    let sum = b3[j];
    for (let i = 0; i < h2.length; i++) {
      sum += h2[i] * W3[i][j];
    }
    h3[j] = relu(sum);
  }

  // Layer 4: hidden3 → output (16 → 1)
  let out = b4[0];
  for (let i = 0; i < h3.length; i++) {
    out += h3[i] * W4[i][0];
  }

  return sigmoid(out);
}

// ─── Metrics ─────────────────────────────────────────────────────

function computeMetrics(actuals, predictions) {
  const n = actuals.length;

  // Convert from 0-1 to 0-100 scale for interpretable metrics
  const act100 = actuals.map(v => v * 100);
  const pred100 = predictions.map(v => v * 100);

  // MAE
  let sumAbsErr = 0;
  for (let i = 0; i < n; i++) {
    sumAbsErr += Math.abs(act100[i] - pred100[i]);
  }
  const mae = sumAbsErr / n;

  // RMSE
  let sumSqErr = 0;
  for (let i = 0; i < n; i++) {
    const err = act100[i] - pred100[i];
    sumSqErr += err * err;
  }
  const rmse = Math.sqrt(sumSqErr / n);

  // R²
  const meanActual = act100.reduce((s, v) => s + v, 0) / n;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    ssTot += (act100[i] - meanActual) ** 2;
    ssRes += (act100[i] - pred100[i]) ** 2;
  }
  const r2 = 1 - ssRes / ssTot;

  // Within ±N pts
  let within5 = 0;
  let within10 = 0;
  let within15 = 0;
  for (let i = 0; i < n; i++) {
    const diff = Math.abs(act100[i] - pred100[i]);
    if (diff <= 5) within5++;
    if (diff <= 10) within10++;
    if (diff <= 15) within15++;
  }

  // Pearson correlation
  const meanPred = pred100.reduce((s, v) => s + v, 0) / n;
  let covXY = 0, varX = 0, varY = 0;
  for (let i = 0; i < n; i++) {
    const dx = act100[i] - meanActual;
    const dy = pred100[i] - meanPred;
    covXY += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }
  const pearson = covXY / (Math.sqrt(varX) * Math.sqrt(varY) || 1);

  return {
    n,
    mae,
    rmse,
    r2,
    pearson,
    within5: within5 / n,
    within10: within10 / n,
    within15: within15 / n,
  };
}

// ─── Grade Mapping ───────────────────────────────────────────────

function scoreToGrade(score01) {
  const s = score01 * 100;
  if (s >= 80) return 'A';
  if (s >= 60) return 'B';
  if (s >= 40) return 'C';
  if (s >= 20) return 'D';
  return 'E';
}

// ─── Main ────────────────────────────────────────────────────────

function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  ECOTRACE Model Evaluation Report');
  console.log('═══════════════════════════════════════════════════\n');

  // Load weights
  if (!fs.existsSync(WEIGHTS_PATH)) {
    console.error('❌ No weights found. Run training first: npm run train-model');
    process.exit(1);
  }
  const weights = JSON.parse(fs.readFileSync(WEIGHTS_PATH, 'utf-8'));
  console.log(`📦 Loaded weights from: weights.json`);
  console.log(`   Architecture: ${weights.W1.length}→${weights.W1[0].length}→${weights.W2[0].length}→${weights.W3[0].length}→${weights.W4[0].length}`);

  // Load test set
  if (!fs.existsSync(TEST_SET_PATH)) {
    console.error('❌ No test set found. Run training first: npm run train-model');
    process.exit(1);
  }
  const testSet = JSON.parse(fs.readFileSync(TEST_SET_PATH, 'utf-8'));
  const { features, labels, productNames, ecoscore_grades } = testSet;
  console.log(`🧪 Loaded test set: ${features.length} samples\n`);

  // Load metadata if available
  let metadata = null;
  if (fs.existsSync(METADATA_PATH)) {
    metadata = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf-8'));
  }

  // Run predictions
  const predictions = features.map(f => forwardPass(f, weights));

  // ─── Overall Metrics ─────────────────────────────────────────
  const metrics = computeMetrics(labels, predictions);

  console.log('──── Overall Performance ────────────────────────');
  console.log(`  Samples:       ${metrics.n}`);
  console.log(`  R²:            ${metrics.r2.toFixed(4)}`);
  console.log(`  Pearson r:     ${metrics.pearson.toFixed(4)}`);
  console.log(`  MAE:           ${metrics.mae.toFixed(2)} pts (0-100 scale)`);
  console.log(`  RMSE:          ${metrics.rmse.toFixed(2)} pts`);
  console.log(`  Within ±5pts:  ${(metrics.within5 * 100).toFixed(1)}%`);
  console.log(`  Within ±10pts: ${(metrics.within10 * 100).toFixed(1)}%`);
  console.log(`  Within ±15pts: ${(metrics.within15 * 100).toFixed(1)}%`);
  console.log();

  // ─── Quality Targets Check ───────────────────────────────────
  console.log('──── Quality Targets ────────────────────────────');
  const targets = [
    { name: 'R² > 0.75', pass: metrics.r2 > 0.75, actual: metrics.r2.toFixed(4) },
    { name: 'MAE < 10', pass: metrics.mae < 10, actual: metrics.mae.toFixed(2) },
    { name: '±10pts > 80%', pass: metrics.within10 > 0.80, actual: `${(metrics.within10 * 100).toFixed(1)}%` },
  ];
  let allPass = true;
  for (const t of targets) {
    const icon = t.pass ? '✅' : '❌';
    console.log(`  ${icon} ${t.name.padEnd(16)} → ${t.actual}`);
    if (!t.pass) allPass = false;
  }
  console.log(`\n  ${allPass ? '🎯 ALL TARGETS MET!' : '⚠️  Some targets not met yet.'}\n`);

  // ─── Per-Grade Breakdown ─────────────────────────────────────
  console.log('──── Per-Grade Breakdown ────────────────────────');

  const gradeGroups = {};
  for (let i = 0; i < labels.length; i++) {
    const grade = (ecoscore_grades[i] || scoreToGrade(labels[i])).toUpperCase();
    if (!gradeGroups[grade]) gradeGroups[grade] = { actuals: [], predictions: [] };
    gradeGroups[grade].actuals.push(labels[i]);
    gradeGroups[grade].predictions.push(predictions[i]);
  }

  console.log('  Grade  Count   MAE     RMSE    R²      ±10pts');
  console.log('  ────── ─────── ─────── ─────── ─────── ───────');
  for (const grade of ['A', 'B', 'C', 'D', 'E']) {
    const g = gradeGroups[grade];
    if (!g || g.actuals.length === 0) {
      console.log(`  ${grade}      0       -       -       -       -`);
      continue;
    }
    const gm = computeMetrics(g.actuals, g.predictions);
    console.log(
      `  ${grade}      ${String(gm.n).padEnd(7)} ${gm.mae.toFixed(2).padStart(5)}   ${gm.rmse.toFixed(2).padStart(5)}   ${gm.r2.toFixed(3).padStart(6)}  ${(gm.within10 * 100).toFixed(1).padStart(5)}%`
    );
  }
  console.log();

  // ─── Grade Confusion Matrix ─────────────────────────────────
  console.log('──── Grade Accuracy (Predicted vs Actual) ───────');
  const grades = ['A', 'B', 'C', 'D', 'E'];
  let gradeCorrect = 0;
  let gradeOff1 = 0;
  for (let i = 0; i < labels.length; i++) {
    const actualGrade = (ecoscore_grades[i] || scoreToGrade(labels[i])).toUpperCase();
    const predGrade = scoreToGrade(predictions[i]);
    const actualIdx = grades.indexOf(actualGrade);
    const predIdx = grades.indexOf(predGrade);
    if (actualIdx === predIdx) gradeCorrect++;
    else if (Math.abs(actualIdx - predIdx) <= 1) gradeOff1++;
  }
  console.log(`  Exact grade match:   ${(gradeCorrect / labels.length * 100).toFixed(1)}%`);
  console.log(`  Within ±1 grade:     ${((gradeCorrect + gradeOff1) / labels.length * 100).toFixed(1)}%`);
  console.log();

  // ─── Error Distribution ──────────────────────────────────────
  console.log('──── Error Distribution (100-pt scale) ──────────');
  const errors = labels.map((a, i) => (predictions[i] - a) * 100);
  const sortedErrors = [...errors].sort((a, b) => a - b);
  const p5 = sortedErrors[Math.floor(0.05 * sortedErrors.length)];
  const p25 = sortedErrors[Math.floor(0.25 * sortedErrors.length)];
  const p50 = sortedErrors[Math.floor(0.50 * sortedErrors.length)];
  const p75 = sortedErrors[Math.floor(0.75 * sortedErrors.length)];
  const p95 = sortedErrors[Math.floor(0.95 * sortedErrors.length)];
  const meanErr = errors.reduce((s, v) => s + v, 0) / errors.length;

  console.log(`  Mean error (bias):   ${meanErr >= 0 ? '+' : ''}${meanErr.toFixed(2)}`);
  console.log(`  Percentiles:  P5=${p5.toFixed(1)}  P25=${p25.toFixed(1)}  P50=${p50.toFixed(1)}  P75=${p75.toFixed(1)}  P95=${p95.toFixed(1)}`);
  console.log();

  // ─── Sample Predictions ──────────────────────────────────────
  console.log('──── Sample Predictions (first 20) ──────────────');
  console.log('  Product                               Actual  Pred    Err    Grade(A/P)');
  console.log('  ────────────────────────────────────── ─────── ─────── ────── ──────────');

  const sampleCount = Math.min(20, labels.length);
  // Pick samples across different grades for diversity
  const sampleIndices = pickDiverseSamples(labels, ecoscore_grades, sampleCount);

  for (const i of sampleIndices) {
    const name = (productNames[i] || 'Unknown').substring(0, 38).padEnd(38);
    const actual = (labels[i] * 100).toFixed(1).padStart(5);
    const pred = (predictions[i] * 100).toFixed(1).padStart(5);
    const err = ((predictions[i] - labels[i]) * 100);
    const errStr = `${err >= 0 ? '+' : ''}${err.toFixed(1)}`.padStart(6);
    const actualGrade = (ecoscore_grades[i] || scoreToGrade(labels[i])).toUpperCase();
    const predGrade = scoreToGrade(predictions[i]);
    const gradeMatch = actualGrade === predGrade ? '✓' : '✗';
    console.log(`  ${name} ${actual}   ${pred}  ${errStr}  ${actualGrade}/${predGrade} ${gradeMatch}`);
  }
  console.log();

  // ─── Worst Predictions ──────────────────────────────────────
  console.log('──── Worst 10 Predictions ───────────────────────');
  console.log('  Product                               Actual  Pred    Err');
  console.log('  ────────────────────────────────────── ─────── ─────── ───────');

  const indexed = errors.map((e, i) => ({ i, absErr: Math.abs(e) }));
  indexed.sort((a, b) => b.absErr - a.absErr);
  for (let k = 0; k < Math.min(10, indexed.length); k++) {
    const i = indexed[k].i;
    const name = (productNames[i] || 'Unknown').substring(0, 38).padEnd(38);
    const actual = (labels[i] * 100).toFixed(1).padStart(5);
    const pred = (predictions[i] * 100).toFixed(1).padStart(5);
    const errVal = errors[i];
    const errStr = `${errVal >= 0 ? '+' : ''}${errVal.toFixed(1)}`.padStart(7);
    console.log(`  ${name} ${actual}   ${pred}  ${errStr}`);
  }
  console.log();

  // ─── Metadata Summary ───────────────────────────────────────
  if (metadata) {
    console.log('──── Training Metadata ──────────────────────────');
    console.log(`  Training samples: ${metadata.trainingSamples || 'N/A'}`);
    console.log(`  Total products:   ${metadata.totalProducts || 'N/A'}`);
    console.log(`  Epochs trained:   ${metadata.epochsTrained || 'N/A'} / ${metadata.maxEpochs || 'N/A'}`);
    console.log(`  Final val loss:   ${metadata.finalValLoss || 'N/A'}`);
    console.log(`  Trained at:       ${metadata.trainedAt || 'N/A'}`);
    console.log();
  }

  console.log('═══════════════════════════════════════════════════');
  console.log(`  Evaluation complete — ${metrics.n} samples analyzed`);
  console.log('═══════════════════════════════════════════════════\n');
}

// Pick diverse samples across grades
function pickDiverseSamples(labels, grades, count) {
  const gradeMap = {};
  for (let i = 0; i < labels.length; i++) {
    const g = (grades[i] || scoreToGrade(labels[i])).toUpperCase();
    if (!gradeMap[g]) gradeMap[g] = [];
    gradeMap[g].push(i);
  }

  const result = [];
  const gradeOrder = ['A', 'B', 'C', 'D', 'E'];
  let round = 0;
  while (result.length < count) {
    let added = false;
    for (const grade of gradeOrder) {
      if (result.length >= count) break;
      const pool = gradeMap[grade];
      if (pool && pool.length > round) {
        result.push(pool[round]);
        added = true;
      }
    }
    if (!added) break;
    round++;
  }

  return result;
}

main();
