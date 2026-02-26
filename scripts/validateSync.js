#!/usr/bin/env node
// scripts/validateSync.js — Validate training-serving consistency
//
// Checks that the mobile inference code (tensorflowModel.ts + featureEncoder.ts)
// matches the training pipeline (trainModel.js) in:
//   1. Feature count (NUM_FEATURES)
//   2. Architecture dimensions
//   3. Weight file dimensions
//   4. Z-score normalization presence
//   5. BatchNorm parameter shapes
//   6. Category score dictionary size
//
// Usage: node scripts/validateSync.js

const fs = require('fs');
const path = require('path');

const WEIGHTS_PATH = path.join(__dirname, '..', 'assets', 'ml', 'eco-score-model', 'weights.json');
const TRAIN_SCRIPT = path.join(__dirname, 'trainModel.js');
const ENCODER_TS = path.join(__dirname, '..', 'services', 'featureEncoder.ts');
const MODEL_TS = path.join(__dirname, '..', 'services', 'tensorflowModel.ts');

let passed = 0;
let failed = 0;
const errors = [];

function check(label, condition, detail) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label} — ${detail}`);
    errors.push(`${label}: ${detail}`);
    failed++;
  }
}

function extractNumber(src, pattern) {
  const m = src.match(pattern);
  return m ? parseInt(m[1]) : null;
}

console.log('\n══════════════════════════════════════════════');
console.log('  ECOTRACE Training-Serving Sync Validator');
console.log('══════════════════════════════════════════════\n');

// ─── 1. Read source files ────────────────────────────────────────

console.log('[1] Reading source files...');

const trainSrc = fs.existsSync(TRAIN_SCRIPT) ? fs.readFileSync(TRAIN_SCRIPT, 'utf8') : null;
const encoderSrc = fs.existsSync(ENCODER_TS) ? fs.readFileSync(ENCODER_TS, 'utf8') : null;
const modelSrc = fs.existsSync(MODEL_TS) ? fs.readFileSync(MODEL_TS, 'utf8') : null;

check('trainModel.js exists', !!trainSrc, 'File not found');
check('featureEncoder.ts exists', !!encoderSrc, 'File not found');
check('tensorflowModel.ts exists', !!modelSrc, 'File not found');

if (!trainSrc || !encoderSrc || !modelSrc) {
  console.log('\n⛔ Missing critical files. Cannot continue validation.\n');
  process.exit(1);
}

// ─── 2. Feature count sync ───────────────────────────────────────

console.log('\n[2] Feature count consistency...');

const trainFeatures = extractNumber(trainSrc, /NUM_FEATURES\s*=\s*(\d+)/);
const encoderFeatures = extractNumber(encoderSrc, /NUM_FEATURES\s*=\s*(\d+)/);
const modelInputDim = extractNumber(modelSrc, /INPUT_DIM\s*=\s*(\d+)/);

check('trainModel.js NUM_FEATURES', trainFeatures !== null, 'Could not parse NUM_FEATURES');
check('featureEncoder.ts NUM_FEATURES', encoderFeatures !== null, 'Could not parse NUM_FEATURES');
check('tensorflowModel.ts INPUT_DIM', modelInputDim !== null, 'Could not parse INPUT_DIM');

if (trainFeatures && encoderFeatures && modelInputDim) {
  check('NUM_FEATURES == INPUT_DIM',
    trainFeatures === encoderFeatures && encoderFeatures === modelInputDim,
    `train=${trainFeatures}, encoder=${encoderFeatures}, model=${modelInputDim}`);
}

// ─── 3. Architecture dimensions ──────────────────────────────────

console.log('\n[3] Architecture dimensions...');

const trainH1 = trainSrc.match(/units:\s*256/);
const trainH2 = trainSrc.match(/units:\s*128/);
const trainH3 = trainSrc.match(/units:\s*64[^×0-9]/);

const modelH1 = extractNumber(modelSrc, /HIDDEN1_DIM\s*=\s*(\d+)/);
const modelH2 = extractNumber(modelSrc, /HIDDEN2_DIM\s*=\s*(\d+)/);
const modelH3 = extractNumber(modelSrc, /HIDDEN3_DIM\s*=\s*(\d+)/);

check('Hidden1 = 256', modelH1 === 256 && !!trainH1, `model=${modelH1}`);
check('Hidden2 = 128', modelH2 === 128 && !!trainH2, `model=${modelH2}`);
check('Hidden3 = 64', modelH3 === 64 && !!trainH3, `model=${modelH3}`);

// ─── 4. Weight file validation ───────────────────────────────────

console.log('\n[4] Weight file validation...');

let weights = null;
if (fs.existsSync(WEIGHTS_PATH)) {
  try {
    weights = JSON.parse(fs.readFileSync(WEIGHTS_PATH, 'utf8'));
    check('weights.json exists and parses', true, '');
  } catch (e) {
    check('weights.json parses', false, e.message);
  }
} else {
  check('weights.json exists', false, `Not found at ${WEIGHTS_PATH}`);
}

if (weights) {
  // Dense layer dimensions
  check('W1 shape [40][256]',
    weights.W1 && weights.W1.length === 40 && weights.W1[0]?.length === 256,
    `Got [${weights.W1?.length}][${weights.W1?.[0]?.length}]`);
  check('W2 shape [256][128]',
    weights.W2 && weights.W2.length === 256 && weights.W2[0]?.length === 128,
    `Got [${weights.W2?.length}][${weights.W2?.[0]?.length}]`);
  check('W3 shape [128][64]',
    weights.W3 && weights.W3.length === 128 && weights.W3[0]?.length === 64,
    `Got [${weights.W3?.length}][${weights.W3?.[0]?.length}]`);
  check('W4 shape [64][1]',
    weights.W4 && weights.W4.length === 64 && weights.W4[0]?.length === 1,
    `Got [${weights.W4?.length}][${weights.W4?.[0]?.length}]`);

  // Z-score normalization
  check('featureMeans present',
    weights.featureMeans && weights.featureMeans.length === 40,
    `length=${weights.featureMeans?.length}`);
  check('featureStds present',
    weights.featureStds && weights.featureStds.length === 40,
    `length=${weights.featureStds?.length}`);

  // BatchNorm
  check('bn1 present', !!weights.bn1, 'Missing bn1 (BatchNorm layer 1)');
  check('bn2 present', !!weights.bn2, 'Missing bn2 (BatchNorm layer 2)');
  check('bn3 present', !!weights.bn3, 'Missing bn3 (BatchNorm layer 3)');

  if (weights.bn1) {
    check('bn1.gamma[256]', weights.bn1.gamma?.length === 256, `length=${weights.bn1.gamma?.length}`);
    check('bn1.movingMean[256]', weights.bn1.movingMean?.length === 256, `length=${weights.bn1.movingMean?.length}`);
  }
}

// ─── 5. Category score dictionary ────────────────────────────────

console.log('\n[5] Category score dictionary...');

// Count entries in CATEGORY_ENV_SCORES in both files
const trainCatMatches = trainSrc.match(/'en:[^']+'\s*:\s*[\d.]+/g);
const encoderCatMatches = encoderSrc.match(/'en:[^']+'\s*:\s*[\d.]+/g);

const trainCatCount = trainCatMatches ? trainCatMatches.length : 0;
const encoderCatCount = encoderCatMatches ? encoderCatMatches.length : 0;

check('Category scores in trainModel.js', trainCatCount > 100, `Found ${trainCatCount}`);
check('Category scores in featureEncoder.ts', encoderCatCount > 100, `Found ${encoderCatCount}`);
check('Category count matches',
  Math.abs(trainCatCount - encoderCatCount) <= 5,
  `train=${trainCatCount}, encoder=${encoderCatCount}`);

// ─── 6. BatchNorm in inference code ──────────────────────────────

console.log('\n[6] BatchNorm inference support...');

check('batchNormInference function exists',
  modelSrc.includes('batchNormInference'),
  'Missing batchNormInference function in tensorflowModel.ts');
check('BatchNorm applied in forward pass',
  modelSrc.includes('weights.bn1') && modelSrc.includes('weights.bn2') && modelSrc.includes('weights.bn3'),
  'Missing bn1/bn2/bn3 references in forward pass');

// ─── 7. Z-score normalization in inference ───────────────────────

console.log('\n[7] Z-score normalization in inference...');

check('featureMeans referenced in predict()',
  modelSrc.includes('featureMeans'),
  'Missing featureMeans in tensorflowModel.ts');
check('featureStds referenced in predict()',
  modelSrc.includes('featureStds'),
  'Missing featureStds in tensorflowModel.ts');

// ─── 8. Food group binary features ──────────────────────────────

console.log('\n[8] Food group binary features...');

const foodGroups = ['MEAT_TAGS', 'FISH_TAGS', 'DAIRY_TAGS', 'PLANT_BASED_TAGS',
  'FRUIT_VEG_TAGS', 'CEREAL_TAGS', 'BEVERAGE_TAGS', 'FAT_OIL_TAGS',
  'SWEET_TAGS', 'CANNED_TAGS', 'FROZEN_TAGS', 'READY_MEAL_TAGS'];

for (const group of foodGroups) {
  const inTrain = trainSrc.includes(group);
  const inEncoder = encoderSrc.includes(group);
  check(`${group} in both files`, inTrain && inEncoder,
    `train=${inTrain}, encoder=${inEncoder}`);
}

// ─── 9. No training code in mobile ───────────────────────────────

console.log('\n[9] No training code in mobile inference...');

check('No backward() in tensorflowModel.ts',
  !modelSrc.includes('function backward'),
  'Found backward() — remove training code from inference module');
check('No adamUpdate() in tensorflowModel.ts',
  !modelSrc.includes('function adamUpdate'),
  'Found adamUpdate() — remove training code');
check('No train() export in tensorflowModel.ts',
  !modelSrc.includes('export async function train') && !modelSrc.includes('export function train'),
  'Found exported train() — mobile should be inference-only');

// ─── Summary ─────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════');
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('══════════════════════════════════════════════');

if (failed > 0) {
  console.log('\n⛔ VALIDATION FAILED — Fix the following issues:\n');
  for (const err of errors) {
    console.log(`  • ${err}`);
  }
  console.log('');
  process.exit(1);
} else {
  console.log('\n✅ All checks passed — training and serving code are in sync.\n');
  process.exit(0);
}
