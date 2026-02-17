// services/featureEncoder.ts — Feature engineering for ECOTRACE ML model
//
// Converts raw product data (text fields, booleans) into a normalized
// numeric feature vector suitable for TensorFlow.js model input.
//
// This is a critical ML component: the quality of feature encoding
// directly determines model accuracy.

import { CATEGORY_NAMES, NUM_CATEGORIES, NUM_FEATURES } from '@/data/trainingDataset';

// ─── Category lookup map ─────────────────────────────────────────
const CATEGORY_INDEX_MAP: Record<string, number> = {};
CATEGORY_NAMES.forEach((name, idx) => {
  CATEGORY_INDEX_MAP[name] = idx;
});

// Category synonym map for fuzzy matching
const CATEGORY_SYNONYMS: Record<string, string> = {
  'drink': 'beverages', 'juice': 'beverages', 'soda': 'beverages', 'water': 'beverages',
  'milk': 'dairy', 'cheese': 'dairy', 'yogurt': 'dairy', 'butter': 'dairy',
  'chips': 'snacks', 'crackers': 'snacks', 'cookies': 'snacks', 'biscuits': 'snacks',
  'bread': 'bakery', 'pastry': 'bakery', 'cake': 'bakery',
  'fruit': 'fruits-vegetables', 'vegetable': 'fruits-vegetables', 'salad': 'fruits-vegetables',
  'chicken': 'meat', 'beef': 'meat', 'pork': 'meat', 'lamb': 'meat', 'turkey': 'meat',
  'fish': 'seafood', 'shrimp': 'seafood', 'salmon': 'seafood', 'tuna': 'seafood',
  'ice cream': 'frozen', 'pizza': 'frozen',
  'sauce': 'condiments', 'ketchup': 'condiments', 'mustard': 'condiments',
  'coffee': 'coffee-tea', 'tea': 'coffee-tea',
  'rice': 'pasta-rice', 'pasta': 'pasta-rice', 'noodles': 'pasta-rice',
  'candy': 'chocolate', 'cocoa': 'chocolate',
  'soap': 'personal-care', 'shampoo': 'personal-care', 'lotion': 'personal-care',
  'detergent': 'cleaning', 'bleach': 'cleaning',
  'cereal': 'cereals', 'oats': 'cereals', 'granola': 'cereals',
};

// Certification keywords
const ORGANIC_KEYWORDS = ['organic', 'bio', 'usda organic', 'eu organic', 'demeter'];
const FAIRTRADE_KEYWORDS = ['fair trade', 'fairtrade', 'fair-trade'];
const ECO_CERT_KEYWORDS = [
  'rainforest alliance', 'utz', 'msc', 'asc', 'fsc', 'ecocert',
  'carbon neutral', 'cradle to cradle', 'energy star', 'b corp',
];

// Packaging keywords
const RECYCLABLE_KEYWORDS = ['recyclable', 'recycled', 'compostable', 'biodegradable'];
const GLASS_KEYWORDS = ['glass', 'jar'];
const PLASTIC_KEYWORDS = ['plastic', 'polystyrene', 'styrofoam', 'pet', 'hdpe'];

// Origin keywords
const LOCAL_KEYWORDS = ['local', 'national', 'usa', 'united states', 'domestic'];
const FAR_KEYWORDS = ['china', 'india', 'asia', 'south america', 'africa', 'indonesia', 'imported'];

// ─── Input interface for encoding ────────────────────────────────
export interface ProductFeatureInput {
  category?: string;
  novaGroup?: number;           // 1-4
  certifications?: string[];
  packagingType?: string;
  originCountry?: string;
  ocrText?: string;             // Additional text for signal extraction
}

// ─── Main encoding function ──────────────────────────────────────
// Returns a normalized feature vector of length NUM_FEATURES (12)
export function encodeProductFeatures(input: ProductFeatureInput): number[] {
  const features = new Array(NUM_FEATURES).fill(0);

  // [0] Category index (normalized 0-1)
  features[0] = encodeCategoryIndex(input.category) / (NUM_CATEGORIES - 1);

  // [1] NOVA group (normalized 0-1)
  features[1] = (input.novaGroup || 2) / 4;

  // Aggregate all text for keyword matching
  const allText = [
    input.category || '',
    input.packagingType || '',
    input.originCountry || '',
    input.ocrText || '',
    ...(input.certifications || []),
  ].join(' ').toLowerCase();

  // [2] Has organic certification
  features[2] = ORGANIC_KEYWORDS.some(kw => allText.includes(kw)) ? 1 : 0;

  // [3] Has fairtrade certification
  features[3] = FAIRTRADE_KEYWORDS.some(kw => allText.includes(kw)) ? 1 : 0;

  // [4] Has eco-certification
  features[4] = ECO_CERT_KEYWORDS.some(kw => allText.includes(kw)) ? 1 : 0;

  // [5] Packaging is recyclable
  features[5] = RECYCLABLE_KEYWORDS.some(kw => allText.includes(kw)) ? 1 : 0;

  // [6] Packaging is glass
  features[6] = GLASS_KEYWORDS.some(kw => allText.includes(kw)) ? 1 : 0;

  // [7] Packaging is plastic
  features[7] = PLASTIC_KEYWORDS.some(kw => allText.includes(kw)) ? 1 : 0;

  // [8] Origin is local
  features[8] = LOCAL_KEYWORDS.some(kw => allText.includes(kw)) ? 1 : 0;

  // [9] Origin is far/imported
  features[9] = FAR_KEYWORDS.some(kw => allText.includes(kw)) ? 1 : 0;

  // [10] Number of certifications (normalized 0-1)
  const certCount = countCertifications(allText);
  features[10] = Math.min(certCount, 5) / 5;

  // [11] Processing level (estimated from NOVA + keywords)
  features[11] = estimateProcessingLevel(input.novaGroup, allText);

  return features;
}

// ─── Helper: resolve category to index ───────────────────────────
function encodeCategoryIndex(category?: string): number {
  if (!category) return 10; // Default to middle index

  const lower = category.toLowerCase();

  // Direct match
  if (CATEGORY_INDEX_MAP[lower] !== undefined) return CATEGORY_INDEX_MAP[lower];

  // Check if category contains a known name
  for (const [name, idx] of Object.entries(CATEGORY_INDEX_MAP)) {
    if (lower.includes(name) || name.includes(lower)) return idx;
  }

  // Check synonyms
  for (const [synonym, catName] of Object.entries(CATEGORY_SYNONYMS)) {
    if (lower.includes(synonym)) {
      return CATEGORY_INDEX_MAP[catName] ?? 10;
    }
  }

  return 10; // Default
}

// ─── Helper: count total certifications found ────────────────────
function countCertifications(text: string): number {
  let count = 0;
  const allCerts = [...ORGANIC_KEYWORDS, ...FAIRTRADE_KEYWORDS, ...ECO_CERT_KEYWORDS];
  for (const kw of allCerts) {
    if (text.includes(kw)) count++;
  }
  return count;
}

// ─── Helper: estimate processing level from NOVA + text ──────────
function estimateProcessingLevel(novaGroup?: number, text?: string): number {
  let level = 0.5; // Default mid-range

  if (novaGroup) {
    level = (novaGroup - 1) / 3; // NOVA 1=0.0, NOVA 4=1.0
  }

  if (text) {
    if (text.includes('ultra-processed') || text.includes('artificial')) level = Math.max(level, 0.9);
    if (text.includes('minimally processed') || text.includes('raw') || text.includes('fresh'))
      level = Math.min(level, 0.1);
  }

  return Math.max(0, Math.min(1, level));
}

// ─── Encode from Open Food Facts API response ────────────────────
export function encodeFromOFFProduct(product: {
  categories?: string;
  nova_group?: number;
  labels_tags?: string[];
  packaging_text?: string;
  origins?: string;
  manufacturing_places?: string;
}): number[] {
  return encodeProductFeatures({
    category: product.categories?.split(',')[0]?.trim()?.replace('en:', '') || undefined,
    novaGroup: product.nova_group,
    certifications: product.labels_tags?.map(t => t.replace('en:', '')) || [],
    packagingType: product.packaging_text,
    originCountry: product.origins || product.manufacturing_places,
  });
}
