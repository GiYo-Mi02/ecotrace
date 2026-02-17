// services/mlPrediction.ts — On-device ML prediction for unknown products
//
// HYBRID APPROACH:
//   1. TensorFlow.js neural network (primary) — genuine learned predictions
//   2. Heuristic rules engine (fallback)     — used when ML model is unavailable
//
// The ML model is trained on 200+ Open Food Facts product examples and uses
// a 12-feature neural network (353 parameters) to predict sustainability scores.
// If the ML model hasn't been initialized yet, the system falls back to the
// rules-based heuristic engine automatically.

import type { ProductScan, ConfidenceLevel, MaterialOrigin, AuditStep } from '@/types/product';
import { initializeModel, predictScore, getModelStatus } from '@/services/tensorflowModel';
import { encodeProductFeatures, type ProductFeatureInput } from '@/services/featureEncoder';

const METHODOLOGY_VERSION = 'v1.0-ml-hybrid';

// ─── Category sustainability baselines ───────────────────────────
// Based on aggregated Open Food Facts eco-score distributions per category.
// Score = out of 100 (higher = more sustainable). These are midpoints.
const CATEGORY_BASELINES: Record<string, { score: number; renewable: number; emissions: string }> = {
  'beverages':           { score: 52, renewable: 35, emissions: '~0.8kg CO₂ est.' },
  'dairy':               { score: 38, renewable: 25, emissions: '~3.2kg CO₂ est.' },
  'snacks':              { score: 35, renewable: 30, emissions: '~1.5kg CO₂ est.' },
  'cereals':             { score: 58, renewable: 45, emissions: '~0.9kg CO₂ est.' },
  'fruits-vegetables':   { score: 75, renewable: 70, emissions: '~0.3kg CO₂ est.' },
  'meat':                { score: 22, renewable: 15, emissions: '~7.0kg CO₂ est.' },
  'seafood':             { score: 30, renewable: 20, emissions: '~4.5kg CO₂ est.' },
  'frozen':              { score: 33, renewable: 25, emissions: '~2.8kg CO₂ est.' },
  'bakery':              { score: 48, renewable: 40, emissions: '~1.2kg CO₂ est.' },
  'condiments':          { score: 45, renewable: 35, emissions: '~1.0kg CO₂ est.' },
  'canned':              { score: 42, renewable: 30, emissions: '~1.8kg CO₂ est.' },
  'organic':             { score: 72, renewable: 65, emissions: '~0.5kg CO₂ est.' },
  'plant-based':         { score: 68, renewable: 60, emissions: '~0.6kg CO₂ est.' },
  'baby-food':           { score: 55, renewable: 40, emissions: '~1.0kg CO₂ est.' },
  'pet-food':            { score: 30, renewable: 20, emissions: '~3.5kg CO₂ est.' },
  'personal-care':       { score: 40, renewable: 30, emissions: '~1.5kg CO₂ est.' },
  'cleaning':            { score: 35, renewable: 25, emissions: '~2.0kg CO₂ est.' },
  'chocolate':           { score: 32, renewable: 25, emissions: '~2.5kg CO₂ est.' },
  'coffee-tea':          { score: 45, renewable: 35, emissions: '~1.2kg CO₂ est.' },
  'pasta-rice':          { score: 60, renewable: 50, emissions: '~0.7kg CO₂ est.' },
};

const DEFAULT_BASELINE = { score: 45, renewable: 30, emissions: '~1.5kg CO₂ est.' };

// ─── Packaging modifiers ─────────────────────────────────────────
const PACKAGING_MODIFIERS: Record<string, number> = {
  'glass':           +8,
  'cardboard':       +6,
  'paper':           +6,
  'recyclable':      +5,
  'recycled':        +4,
  'compostable':     +7,
  'aluminum':        +3,
  'tin':             +3,
  'plastic':         -5,
  'polystyrene':     -8,
  'styrofoam':       -8,
  'non-recyclable':  -6,
  'mixed':           -3,
  'composite':       -3,
  'bioplastic':      +4,
  'bamboo':          +6,
};

// ─── Certification keywords and their score bonus ────────────────
const CERT_BONUSES: Record<string, number> = {
  'organic':              +6,
  'bio':                  +6,
  'fair trade':           +5,
  'fairtrade':            +5,
  'fair-trade':           +5,
  'rainforest alliance':  +5,
  'utz':                  +4,
  'msc':                  +5,
  'asc':                  +5,
  'fsc':                  +4,
  'eu organic':           +6,
  'usda organic':         +6,
  'demeter':              +7,
  'ecocert':              +5,
  'vegan':                +4,
  'non-gmo':              +3,
  'carbon neutral':       +8,
  'b corp':               +6,
  'cradle to cradle':     +7,
  'energy star':          +5,
};

// ─── Input type for ML prediction ────────────────────────────────
export interface PredictionInput {
  barcode: string;
  productName?: string;
  brand?: string;
  category?: string;        // User-selected or OCR-extracted category
  packagingType?: string;    // e.g. 'plastic bottle', 'glass jar', 'cardboard box'
  certifications?: string[]; // User-identified or OCR-extracted certs
  originCountry?: string;    // Where the product is from
  ocrText?: string;          // Raw OCR text for additional signal extraction
}

// ─── Find best matching category ─────────────────────────────────
function matchCategory(input: string): string | null {
  const lower = input.toLowerCase();

  // Direct match
  if (CATEGORY_BASELINES[lower]) return lower;

  // Fuzzy matching — check if any category keyword appears in the input
  for (const [category] of Object.entries(CATEGORY_BASELINES)) {
    const keywords = category.split('-');
    if (keywords.some(kw => lower.includes(kw))) return category;
  }

  // Check common synonyms
  const SYNONYMS: Record<string, string> = {
    'drink': 'beverages', 'juice': 'beverages', 'soda': 'beverages', 'water': 'beverages',
    'milk': 'dairy', 'cheese': 'dairy', 'yogurt': 'dairy', 'butter': 'dairy',
    'chips': 'snacks', 'crackers': 'snacks', 'cookies': 'snacks', 'biscuits': 'snacks',
    'bread': 'bakery', 'pastry': 'bakery', 'cake': 'bakery',
    'fruit': 'fruits-vegetables', 'vegetable': 'fruits-vegetables', 'salad': 'fruits-vegetables',
    'chicken': 'meat', 'beef': 'meat', 'pork': 'meat', 'lamb': 'meat', 'turkey': 'meat',
    'fish': 'seafood', 'shrimp': 'seafood', 'salmon': 'seafood', 'tuna': 'seafood',
    'ice cream': 'frozen', 'pizza': 'frozen',
    'sauce': 'condiments', 'ketchup': 'condiments', 'mustard': 'condiments', 'dressing': 'condiments',
    'coffee': 'coffee-tea', 'tea': 'coffee-tea', 'espresso': 'coffee-tea',
    'rice': 'pasta-rice', 'pasta': 'pasta-rice', 'noodles': 'pasta-rice', 'spaghetti': 'pasta-rice',
    'candy': 'chocolate', 'cocoa': 'chocolate',
    'soap': 'personal-care', 'shampoo': 'personal-care', 'lotion': 'personal-care',
    'detergent': 'cleaning', 'bleach': 'cleaning',
    'cereal': 'cereals', 'oats': 'cereals', 'granola': 'cereals',
  };

  for (const [keyword, cat] of Object.entries(SYNONYMS)) {
    if (lower.includes(keyword)) return cat;
  }

  return null;
}

// ─── Extract signals from OCR text ───────────────────────────────
function extractSignalsFromOCR(ocrText: string): {
  packagingSignals: string[];
  certSignals: string[];
  originSignals: string[];
} {
  const lower = ocrText.toLowerCase();
  const packagingSignals: string[] = [];
  const certSignals: string[] = [];
  const originSignals: string[] = [];

  // Packaging mentions
  for (const key of Object.keys(PACKAGING_MODIFIERS)) {
    if (lower.includes(key)) packagingSignals.push(key);
  }

  // Certification mentions
  for (const key of Object.keys(CERT_BONUSES)) {
    if (lower.includes(key)) certSignals.push(key);
  }

  // Origin clues
  const countries = [
    'usa', 'united states', 'canada', 'france', 'germany', 'italy', 'spain',
    'united kingdom', 'uk', 'china', 'india', 'brazil', 'japan', 'australia',
    'mexico', 'indonesia', 'local', 'imported',
  ];
  for (const country of countries) {
    if (lower.includes(country)) originSignals.push(country);
  }

  return { packagingSignals, certSignals, originSignals };
}

// ─── Estimate transport from origin ──────────────────────────────
function estimateTransport(origin?: string): { score: number; distance: string } {
  if (!origin) return { score: 7, distance: 'Unknown' };

  const lower = origin.toLowerCase();

  if (lower.includes('local') || lower.includes('national')) {
    return { score: 14, distance: '< 500 km' };
  }
  if (['usa', 'united states', 'canada', 'france', 'germany', 'italy', 'spain', 'uk', 'united kingdom'].some(c => lower.includes(c))) {
    return { score: 11, distance: '~ 1,500 km' };
  }
  if (['europe', 'eu', 'north america'].some(c => lower.includes(c))) {
    return { score: 9, distance: '~ 2,500 km' };
  }
  if (['china', 'india', 'asia', 'south america', 'africa', 'indonesia', 'brazil'].some(c => lower.includes(c))) {
    return { score: 4, distance: '> 5,000 km' };
  }

  return { score: 7, distance: '~ 3,000 km' };
}

// ─── Generate audit steps for predicted product ──────────────────
function generatePredictionAuditSteps(
  input: PredictionInput,
  dataPointCount: number,
  method: 'ml' | 'heuristic' = 'heuristic',
): AuditStep[] {
  const ts = Date.now();
  const steps: AuditStep[] = [];

  steps.push({
    id: `pred-audit-${ts}-1`,
    title: 'Product Identification',
    description: input.productName
      ? `Product identified as: ${input.productName}${input.brand ? ` by ${input.brand}` : ''}`
      : 'Product not found in Open Food Facts database. Score is ML-estimated.',
    status: input.productName ? 'verified' : 'pending',
    dataSource: 'User Input',
  });

  steps.push({
    id: `pred-audit-${ts}-2`,
    title: 'Category Classification',
    description: input.category
      ? `Classified as: ${input.category}. Score based on ${method === 'ml' ? 'TensorFlow.js neural network' : 'category sustainability averages'}.`
      : 'No category specified. Using global average baseline.',
    status: input.category ? 'verified' : 'flagged',
    dataSource: input.category ? 'User Input + Category Database' : 'Default Estimate',
  });

  steps.push({
    id: `pred-audit-${ts}-3`,
    title: 'Packaging Assessment',
    description: input.packagingType
      ? `Packaging identified as: ${input.packagingType}`
      : 'Packaging information not provided. Using category average.',
    status: input.packagingType ? 'verified' : 'pending',
    dataSource: input.packagingType ? 'User Input' : undefined,
  });

  steps.push({
    id: `pred-audit-${ts}-4`,
    title: 'Origin & Transport',
    description: input.originCountry
      ? `Product origin: ${input.originCountry}`
      : 'Origin unknown. Transport score based on global average.',
    status: input.originCountry ? 'verified' : 'pending',
    dataSource: input.originCountry ? 'User Input' : undefined,
  });

  steps.push({
    id: `pred-audit-${ts}-5`,
    title: 'Certifications',
    description: input.certifications && input.certifications.length > 0
      ? `Identified certifications: ${input.certifications.join(', ')}`
      : 'No certifications identified.',
    status: input.certifications && input.certifications.length > 0 ? 'verified' : 'flagged',
    dataSource: input.certifications && input.certifications.length > 0 ? 'User Input / OCR' : undefined,
  });

  // ML-specific audit step
  if (method === 'ml') {
    const status = getModelStatus();
    steps.push({
      id: `pred-audit-${ts}-6`,
      title: 'ML Model Prediction',
      description: `Score predicted by TensorFlow.js neural network ` +
        `(${status.totalParameters} trained parameters, ` +
        `architecture: ${status.architecture}). ` +
        `Model trained on 200+ Open Food Facts product examples via gradient descent.`,
      status: 'verified',
      dataSource: 'TensorFlow.js Neural Network',
    });
  } else {
    steps.push({
      id: `pred-audit-${ts}-6`,
      title: 'Confidence Assessment',
      description: `${dataPointCount} of 5 data points available. ${
        dataPointCount >= 3
          ? 'Estimated score with moderate confidence (heuristic fallback).'
          : 'Limited data — score is a rough estimate based on category averages.'
      }`,
      status: dataPointCount >= 3 ? 'verified' : 'flagged',
      dataSource: 'ECOTRACE Heuristic Engine',
    });
  }

  return steps;
}

// ─── Main prediction function ────────────────────────────────────
export function predictSustainabilityScore(input: PredictionInput): ProductScan {
  // ── Try ML prediction first ──────────────────────────────────
  const mlResult = tryMLPrediction(input);
  if (mlResult !== null) {
    return buildProductScan(input, mlResult.score, 'ml');
  }

  // ── Fallback to heuristic engine ─────────────────────────────
  const heuristicScore = computeHeuristicScore(input);
  return buildProductScan(input, heuristicScore.finalScore, 'heuristic', heuristicScore);
}

// ─── ML Prediction Path ─────────────────────────────────────────
// Uses TensorFlow.js neural network for genuine learned predictions
function tryMLPrediction(input: PredictionInput): { score: number } | null {
  const status = getModelStatus();
  if (!status.ready) return null;

  try {
    // Encode product features into the 12-dimensional feature vector
    const featureInput: ProductFeatureInput = {
      category: input.category,
      novaGroup: undefined, // Not available from user input
      certifications: input.certifications,
      packagingType: input.packagingType,
      originCountry: input.originCountry,
      ocrText: input.ocrText,
    };

    const features = encodeProductFeatures(featureInput);

    // Run forward pass through the neural network
    const mlScore = predictScore(features);
    if (mlScore === null) return null;

    console.log(`[ML] Neural network prediction: ${mlScore}/100 for ${input.productName || input.barcode}`);
    return { score: mlScore };
  } catch (error) {
    console.warn('[ML] ML prediction failed, falling back to heuristic:', error);
    return null;
  }
}

// ─── Heuristic scoring (fallback engine) ─────────────────────────
interface HeuristicResult {
  finalScore: number;
  baseScore: number;
  packagingModifier: number;
  certBonus: number;
  ocrModifier: number;
  transport: { score: number; distance: string };
  packagingSignals: string[];
  matchedCerts: string[];
  matchedCategory: string;
  renewable: number;
  emissions: string;
}

function computeHeuristicScore(input: PredictionInput): HeuristicResult {
  let baseScore: number;
  let renewable: number;
  let emissions: string;
  let matchedCategory = 'Unknown';

  // Step 1: Determine base score from category
  if (input.category) {
    const catMatch = matchCategory(input.category);
    if (catMatch) {
      const baseline = CATEGORY_BASELINES[catMatch];
      baseScore = baseline.score;
      renewable = baseline.renewable;
      emissions = baseline.emissions;
      matchedCategory = catMatch.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    } else {
      baseScore = DEFAULT_BASELINE.score;
      renewable = DEFAULT_BASELINE.renewable;
      emissions = DEFAULT_BASELINE.emissions;
      matchedCategory = input.category;
    }
  } else {
    baseScore = DEFAULT_BASELINE.score;
    renewable = DEFAULT_BASELINE.renewable;
    emissions = DEFAULT_BASELINE.emissions;
  }

  // Step 2: Apply packaging modifiers
  let packagingModifier = 0;
  const packagingSignals: string[] = [];
  if (input.packagingType) {
    const lower = input.packagingType.toLowerCase();
    for (const [keyword, mod] of Object.entries(PACKAGING_MODIFIERS)) {
      if (lower.includes(keyword)) {
        packagingModifier += mod;
        packagingSignals.push(keyword);
      }
    }
  }

  // Step 3: Apply certification bonuses
  let certBonus = 0;
  const matchedCerts: string[] = [];
  if (input.certifications) {
    for (const cert of input.certifications) {
      const lower = cert.toLowerCase();
      for (const [keyword, bonus] of Object.entries(CERT_BONUSES)) {
        if (lower.includes(keyword)) {
          certBonus += bonus;
          matchedCerts.push(keyword);
          break;
        }
      }
    }
  }

  // Step 4: Extract additional signals from OCR text
  let ocrModifier = 0;
  if (input.ocrText) {
    const ocrSignals = extractSignalsFromOCR(input.ocrText);

    for (const sig of ocrSignals.packagingSignals) {
      if (!packagingSignals.includes(sig)) {
        ocrModifier += PACKAGING_MODIFIERS[sig] || 0;
      }
    }

    for (const sig of ocrSignals.certSignals) {
      if (!matchedCerts.includes(sig)) {
        ocrModifier += (CERT_BONUSES[sig] || 0) * 0.7;
        matchedCerts.push(sig);
      }
    }

    if (ocrSignals.originSignals.length > 0 && !input.originCountry) {
      input.originCountry = ocrSignals.originSignals[0];
    }
  }

  // Step 5: Transport estimate
  const transport = estimateTransport(input.originCountry);

  // Step 6: Compute final score
  const rawScore = baseScore + packagingModifier + certBonus + ocrModifier + (transport.score - 7);
  const finalScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  return {
    finalScore, baseScore, packagingModifier, certBonus, ocrModifier,
    transport, packagingSignals, matchedCerts, matchedCategory, renewable, emissions,
  };
}

// ─── Build the ProductScan result ────────────────────────────────
function buildProductScan(
  input: PredictionInput,
  score: number,
  method: 'ml' | 'heuristic',
  heuristic?: HeuristicResult,
): ProductScan {
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  // Determine category label
  let matchedCategory = 'Unknown';
  if (heuristic) {
    matchedCategory = heuristic.matchedCategory;
  } else if (input.category) {
    const catMatch = matchCategory(input.category);
    matchedCategory = catMatch
      ? catMatch.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      : input.category;
  }

  // Renewable + emissions (from heuristic data or category baseline)
  let renewable = DEFAULT_BASELINE.renewable;
  let emissions = DEFAULT_BASELINE.emissions;
  if (heuristic) {
    renewable = heuristic.renewable;
    emissions = heuristic.emissions;
  } else if (input.category) {
    const catMatch = matchCategory(input.category);
    if (catMatch) {
      renewable = CATEGORY_BASELINES[catMatch].renewable;
      emissions = CATEGORY_BASELINES[catMatch].emissions;
    }
  }

  // Data points for confidence
  let dataPoints = 0;
  if (input.category) dataPoints++;
  if (input.packagingType) dataPoints++;
  if (input.certifications && input.certifications.length > 0) dataPoints++;
  if (input.originCountry) dataPoints++;
  if (input.ocrText && input.ocrText.length > 20) dataPoints++;

  const confidence: ConfidenceLevel = dataPoints >= 3 ? 'estimated' : 'insufficient';

  // Transport
  const transport = heuristic?.transport || estimateTransport(input.originCountry);

  // Materials list
  const materials: MaterialOrigin[] = [];
  if (input.packagingType) {
    materials.push({
      material: input.packagingType,
      origin: input.originCountry || 'Not disclosed',
      verified: false,
      source: 'User Input (estimated)',
    });
  }
  const packagingSignals = heuristic?.packagingSignals || [];
  for (const sig of packagingSignals.slice(0, 3)) {
    materials.push({
      material: sig.charAt(0).toUpperCase() + sig.slice(1),
      origin: input.originCountry || 'Not disclosed',
      verified: false,
      source: method === 'ml' ? 'TensorFlow.js Neural Network' : 'Heuristic Engine',
    });
  }
  if (materials.length === 0) {
    materials.push({
      material: 'Product materials',
      origin: 'Not disclosed',
      verified: false,
      source: 'Insufficient data',
    });
  }

  // Audit trail
  const auditSteps = generatePredictionAuditSteps(input, dataPoints, method);
  const verifiedSteps = auditSteps.filter(s => s.status === 'verified').length;

  // Scoring breakdown
  const breakdown: Record<string, number> = method === 'ml'
    ? {
        ml_neural_network: finalScore,
        model_architecture: 0, // metadata: Dense(12→16→8→1)
        training_examples: 0,  // metadata: 200+ augmented
      }
    : {
        category_baseline: Math.min(40, Math.round((heuristic?.baseScore || 45) * 0.4)),
        packaging_assessment: Math.max(0, Math.min(20, 10 + (heuristic?.packagingModifier || 0))),
        transport_estimate: Math.max(0, Math.min(15, transport.score)),
        certifications: Math.min(10, heuristic?.certBonus || 0),
        ocr_signals: Math.round(Math.abs(heuristic?.ocrModifier || 0)),
      };

  return {
    id: `${method === 'ml' ? 'ML' : 'HEUR'}-${Date.now()}`,
    barcode: input.barcode,
    name: input.productName || 'Unknown Product',
    brand: input.brand || 'Unknown Brand',
    category: matchedCategory,
    scanDate: new Date().toISOString().split('T')[0],
    score: finalScore,
    confidence,
    status: finalScore >= 60 ? 'verified' : finalScore >= 30 ? 'pending' : 'flagged',
    renewablePercent: Math.max(5, Math.min(95, renewable + Math.round((heuristic?.packagingModifier || 0) * 1.5))),
    emissions,
    transportDistance: transport.distance,
    materials,
    auditSteps,
    auditProgress: Math.round((verifiedSteps / auditSteps.length) * 100),
    scoringBreakdown: breakdown,
    methodologyVersion: METHODOLOGY_VERSION,
    dataSource: 'user_submitted',
  };
}

// ─── Quick predict (minimal input — just category) ───────────────
export function quickPredict(barcode: string, category: string): ProductScan {
  return predictSustainabilityScore({ barcode, category });
}

// ─── Initialize the ML model (call on app startup) ──────────────
export async function initializeMLModel(): Promise<boolean> {
  try {
    console.log('[ECOTRACE] Initializing ML model...');
    const success = await initializeModel();
    if (success) {
      const status = getModelStatus();
      console.log(`[ECOTRACE] ML model ready — ${status.totalParameters} parameters trained`);
    } else {
      console.log('[ECOTRACE] ML model not available, using heuristic fallback');
    }
    return success;
  } catch (error) {
    console.warn('[ECOTRACE] ML initialization failed, heuristic fallback active:', error);
    return false;
  }
}

// ─── Get prediction engine status ────────────────────────────────
export function getPredictionEngineStatus(): {
  mlReady: boolean;
  mlTraining: boolean;
  totalParameters: number;
  engine: 'tensorflow' | 'heuristic';
} {
  const status = getModelStatus();
  return {
    mlReady: status.ready,
    mlTraining: status.training,
    totalParameters: status.totalParameters,
    engine: status.ready ? 'tensorflow' : 'heuristic',
  };
}

// ─── Get available categories for UI picker ──────────────────────
export function getAvailableCategories(): { key: string; label: string }[] {
  return Object.keys(CATEGORY_BASELINES).map(key => ({
    key,
    label: key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
  }));
}
