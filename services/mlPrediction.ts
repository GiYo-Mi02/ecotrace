// services/mlPrediction.ts — On-device ML prediction for unknown products
//
// When a barcode isn't in Open Food Facts, we can still generate an estimated
// sustainability score using category-based heuristics and user-provided info.
//
// This is a pure TypeScript rules engine — no external ML packages needed.
// It uses category averages, packaging signals, and certification keywords
// to produce a ProductScan with confidence: 'estimated' or 'insufficient'.

import type { ProductScan, ConfidenceLevel, MaterialOrigin, AuditStep } from '@/types/product';

const METHODOLOGY_VERSION = 'v0.1-estimated';

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
function generatePredictionAuditSteps(input: PredictionInput, dataPointCount: number): AuditStep[] {
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
      ? `Classified as: ${input.category}. Score based on category sustainability averages.`
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

  steps.push({
    id: `pred-audit-${ts}-6`,
    title: 'Confidence Assessment',
    description: `${dataPointCount} of 5 data points available. ${
      dataPointCount >= 3
        ? 'Estimated score with moderate confidence.'
        : 'Limited data — score is a rough estimate based on category averages.'
    }`,
    status: dataPointCount >= 3 ? 'verified' : 'flagged',
    dataSource: 'ECOTRACE ML Engine',
  });

  return steps;
}

// ─── Main prediction function ────────────────────────────────────
export function predictSustainabilityScore(input: PredictionInput): ProductScan {
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
        ocrModifier += (CERT_BONUSES[sig] || 0) * 0.7; // Lower weight from OCR (less reliable)
        matchedCerts.push(sig);
      }
    }

    if (ocrSignals.originSignals.length > 0 && !input.originCountry) {
      input.originCountry = ocrSignals.originSignals[0];
    }
  }

  // Step 5: Transport estimate
  const transport = estimateTransport(input.originCountry);

  // Step 6: Compute final score with all modifiers
  const rawScore = baseScore + packagingModifier + certBonus + ocrModifier + (transport.score - 7);
  const finalScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  // Step 7: Determine confidence
  let dataPoints = 0;
  if (input.category) dataPoints++;
  if (input.packagingType) dataPoints++;
  if (input.certifications && input.certifications.length > 0) dataPoints++;
  if (input.originCountry) dataPoints++;
  if (input.ocrText && input.ocrText.length > 20) dataPoints++;

  const confidence: ConfidenceLevel = dataPoints >= 3 ? 'estimated' : 'insufficient';

  // Step 8: Build materials list
  const materials: MaterialOrigin[] = [];
  if (input.packagingType) {
    materials.push({
      material: input.packagingType,
      origin: input.originCountry || 'Not disclosed',
      verified: false,
      source: 'User Input (estimated)',
    });
  }
  if (packagingSignals.length > 0) {
    for (const sig of packagingSignals.slice(0, 3)) {
      materials.push({
        material: sig.charAt(0).toUpperCase() + sig.slice(1),
        origin: input.originCountry || 'Not disclosed',
        verified: false,
        source: 'ML Prediction',
      });
    }
  }
  if (materials.length === 0) {
    materials.push({
      material: 'Product materials',
      origin: 'Not disclosed',
      verified: false,
      source: 'Insufficient data',
    });
  }

  // Step 9: Audit trail
  const auditSteps = generatePredictionAuditSteps(input, dataPoints);
  const verifiedSteps = auditSteps.filter(s => s.status === 'verified').length;

  // Step 10: Scoring breakdown
  const breakdown: Record<string, number> = {
    category_baseline: Math.min(40, Math.round(baseScore * 0.4)),
    packaging_assessment: Math.max(0, Math.min(20, 10 + packagingModifier)),
    transport_estimate: Math.max(0, Math.min(15, transport.score)),
    certifications: Math.min(10, certBonus),
    ocr_signals: Math.round(Math.abs(ocrModifier)),
  };

  return {
    id: `PRED-${Date.now()}`,
    barcode: input.barcode,
    name: input.productName || 'Unknown Product',
    brand: input.brand || 'Unknown Brand',
    category: matchedCategory,
    scanDate: new Date().toISOString().split('T')[0],
    score: finalScore,
    confidence,
    status: finalScore >= 60 ? 'verified' : finalScore >= 30 ? 'pending' : 'flagged',
    renewablePercent: Math.max(5, Math.min(95, renewable + Math.round(packagingModifier * 1.5))),
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

// ─── Get available categories for UI picker ──────────────────────
export function getAvailableCategories(): { key: string; label: string }[] {
  return Object.keys(CATEGORY_BASELINES).map(key => ({
    key,
    label: key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
  }));
}
