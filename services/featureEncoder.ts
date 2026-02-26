// services/featureEncoder.ts — Feature Engineering for ECOTRACE ML Model v2.0
//
// Converts raw Open Food Facts product data into a normalized 28-dimensional
// feature vector for neural network input.
//
// Every feature is normalized to [0, 1] range.
// Missing data defaults to 0.5 (neutral midpoint) for continuous features
// and 0 for binary features.

// ─── Types ───────────────────────────────────────────────────────

/** Raw Open Food Facts product from the API (v2 expanded fields) */
export interface OFFRawProduct {
  code?: string;
  product_name?: string;
  categories_tags?: string[];
  nova_group?: number | null;
  labels_tags?: string[];
  packaging_tags?: string[];
  packaging_materials_tags?: string[];
  packaging_text?: string;
  origins_tags?: string[];
  origins?: string;
  manufacturing_places_tags?: string[];
  manufacturing_places?: string;
  ecoscore_score?: number | null;
  ecoscore_grade?: string;
  nutrient_levels_tags?: string[];
  ingredients_analysis_tags?: string[];
  ingredients_n?: number | null;
}

/** Local product created by the user in-app */
export interface LocalProduct {
  category?: string;
  novaGroup?: number;
  certifications?: string[];
  packagingType?: string;
  originCountry?: string;
  manufacturingPlace?: string;
  ocrText?: string;
}

/** The 28-feature vector output */
export interface FeatureVector {
  features: number[];         // length 28, all values in [0, 1]
  featureNames: string[];     // descriptive name for each feature
  nonDefaultCount: number;    // how many features differ from default (data richness)
  valid: boolean;             // false if critical data is missing
}

// ─── Constants ───────────────────────────────────────────────────

export const NUM_FEATURES = 28;

export const FEATURE_NAMES: string[] = [
  // Category Analysis (3)
  'categoryEnvironmentScore',    // [0]
  'categoryProcessingLevel',     // [1]
  'categoryHealthScore',         // [2]
  // Processing Level (3)
  'novaGroupNormalized',         // [3]
  'isUltraProcessed',            // [4]
  'ingredientComplexity',        // [5]
  // Packaging Features (6)
  'hasPlasticPackaging',         // [6]
  'hasGlassPackaging',           // [7]
  'hasCardboardPackaging',       // [8]
  'hasMetalPackaging',           // [9]
  'hasCompostablePackaging',     // [10]
  'packagingMaterialCount',      // [11]
  // Certifications (6)
  'hasOrganicCert',              // [12]
  'hasFairTradeCert',            // [13]
  'hasRainforestAllianceCert',   // [14]
  'hasEUEcolabel',               // [15]
  'hasMSCCert',                  // [16]
  'certificationTotalScore',     // [17]
  // Origin & Sustainability (4)
  'originSustainabilityScore',   // [18]
  'hasLocalOrigin',              // [19]
  'transportEstimateScore',      // [20]
  'manufacturingSustainability', // [21]
  // Ingredient Analysis (6)
  'isVegan',                     // [22]
  'isVegetarian',                // [23]
  'hasPalmOil',                  // [24]
  'hasHighSugar',                // [25]
  'hasHighSaturatedFat',         // [26]
  'hasHighSodium',               // [27]
];

// ─── Helper: tag matching ────────────────────────────────────────

function hasTag(tags: string[] | null | undefined, keyword: string): boolean {
  if (!tags || tags.length === 0) return false;
  const kw = keyword.toLowerCase();
  return tags.some(tag => tag.toLowerCase().includes(kw));
}

function hasAnyTag(tags: string[] | null | undefined, keywords: string[]): boolean {
  if (!tags || tags.length === 0) return false;
  const lower = tags.map(t => t.toLowerCase());
  return keywords.some(kw => lower.some(t => t.includes(kw.toLowerCase())));
}

function hasExactTag(tags: string[] | null | undefined, exactTags: string[]): boolean {
  if (!tags || tags.length === 0) return false;
  const lower = tags.map(t => t.toLowerCase());
  return exactTags.some(t => lower.includes(t.toLowerCase()));
}

// ═══════════════════════════════════════════════════════════════════
// FEATURE ENCODERS — 28 features, all normalized 0-1
// ═══════════════════════════════════════════════════════════════════

// ─── Category Analysis (Features 0-2) ────────────────────────────

const CATEGORY_ENV_SCORES: Record<string, number> = {
  'en:organic-foods': 0.92, 'en:organic': 0.92,
  'en:plant-based-foods': 0.88, 'en:plant-based-foods-and-beverages': 0.88,
  'en:fruits': 0.88, 'en:vegetables-based-foods': 0.92, 'en:vegetables': 0.92,
  'en:legumes': 0.85, 'en:nuts': 0.80,
  'en:fresh-foods': 0.82, 'en:cereals-and-potatoes': 0.62, 'en:cereals': 0.62,
  'en:breads': 0.58, 'en:beverages': 0.50, 'en:waters': 0.65,
  'en:fruit-juices': 0.55, 'en:sodas': 0.30,
  'en:fish': 0.48, 'en:fishes': 0.48, 'en:seafood': 0.48,
  'en:dairies': 0.42, 'en:dairy': 0.42, 'en:cheeses': 0.40, 'en:milks': 0.50,
  'en:plant-based-milks': 0.75, 'en:tofu': 0.82,
  'en:snacks': 0.38, 'en:sweet-snacks': 0.32, 'en:salty-snacks': 0.32,
  'en:chocolates': 0.35, 'en:sugary-snacks': 0.28,
  'en:frozen-foods': 0.38, 'en:canned-foods': 0.42,
  'en:meals': 0.45, 'en:prepared-meals': 0.35, 'en:ready-meals': 0.32,
  'en:sauces': 0.45, 'en:condiments': 0.45,
  'en:meats': 0.18, 'en:pork': 0.20, 'en:beef': 0.10, 'en:lamb': 0.12,
  'en:poultry': 0.28, 'en:chicken': 0.28,
  'en:processed-meats': 0.12, 'en:sausages': 0.15,
  'en:eggs': 0.55, 'en:honey': 0.60,
};

const CATEGORY_PROCESSING: Record<string, number> = {
  'en:fresh-foods': 0.90, 'en:fruits': 0.95, 'en:vegetables': 0.95,
  'en:organic-foods': 0.80, 'en:plant-based-foods': 0.75,
  'en:cereals': 0.60, 'en:breads': 0.55,
  'en:dairies': 0.55, 'en:milks': 0.65, 'en:cheeses': 0.50,
  'en:meals': 0.40, 'en:prepared-meals': 0.25, 'en:ready-meals': 0.20,
  'en:snacks': 0.30, 'en:sweet-snacks': 0.20, 'en:salty-snacks': 0.25,
  'en:frozen-foods': 0.35, 'en:canned-foods': 0.40,
  'en:beverages': 0.50, 'en:sodas': 0.15, 'en:waters': 0.90,
  'en:processed-meats': 0.15, 'en:sausages': 0.20,
};

const CATEGORY_HEALTH: Record<string, number> = {
  'en:fruits': 0.90, 'en:vegetables': 0.92, 'en:legumes': 0.88,
  'en:nuts': 0.75, 'en:cereals': 0.65, 'en:breads': 0.55,
  'en:fish': 0.70, 'en:seafood': 0.68,
  'en:dairies': 0.55, 'en:milks': 0.60, 'en:cheeses': 0.45,
  'en:meats': 0.40, 'en:poultry': 0.50, 'en:beef': 0.35,
  'en:snacks': 0.25, 'en:sweet-snacks': 0.15, 'en:salty-snacks': 0.20,
  'en:chocolates': 0.25, 'en:sodas': 0.10, 'en:waters': 0.85,
  'en:beverages': 0.45, 'en:processed-meats': 0.15,
  'en:prepared-meals': 0.30, 'en:frozen-foods': 0.35,
};

function encodeCategoryMap(tags: string[] | undefined, map: Record<string, number>): number {
  if (!tags || tags.length === 0) return 0.5;
  let best = 0.5;
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    if (map[lower] !== undefined) {
      best = Math.max(best, map[lower]);
    }
    // Partial match fallback
    for (const [key, score] of Object.entries(map)) {
      const cleanKey = key.replace('en:', '');
      const cleanTag = lower.replace('en:', '');
      if (cleanTag.includes(cleanKey) || cleanKey.includes(cleanTag)) {
        best = Math.max(best, score);
      }
    }
  }
  return best;
}

function encodeCategoryEnvironment(tags?: string[]): number {
  return encodeCategoryMap(tags, CATEGORY_ENV_SCORES);
}

function encodeCategoryProcessing(tags?: string[]): number {
  return encodeCategoryMap(tags, CATEGORY_PROCESSING);
}

function encodeCategoryHealth(tags?: string[]): number {
  return encodeCategoryMap(tags, CATEGORY_HEALTH);
}

// ─── Processing Level (Features 3-5) ─────────────────────────────

function encodeNovaGroup(nova: number | null | undefined): number {
  if (nova === null || nova === undefined) return 0.5;
  // NOVA 1 = best (1.0), NOVA 4 = worst (0.0)
  return Math.max(0, Math.min(1, 1 - ((nova - 1) / 3)));
}

function encodeIsUltraProcessed(nova: number | null | undefined): number {
  return nova === 4 ? 1 : 0;
}

function encodeIngredientComplexity(ingredientsN: number | null | undefined): number {
  if (ingredientsN === null || ingredientsN === undefined) return 0.5;
  if (ingredientsN <= 0) return 0.5;
  // Fewer ingredients = better (more natural). Cap at 50.
  return Math.max(0, Math.min(1, 1 - (ingredientsN / 50)));
}

// ─── Packaging Features (Features 6-11) ──────────────────────────

function combinePackagingText(product: OFFRawProduct): string[] {
  const allTags: string[] = [];
  if (product.packaging_tags) allTags.push(...product.packaging_tags);
  if (product.packaging_materials_tags) allTags.push(...product.packaging_materials_tags);
  if (product.packaging_text) {
    // Split text into pseudo-tags
    const words = product.packaging_text.toLowerCase().split(/[\s,;/]+/);
    allTags.push(...words);
  }
  return allTags.map(t => t.toLowerCase());
}

function encodeHasPlasticPackaging(product: OFFRawProduct): number {
  const tags = combinePackagingText(product);
  const plasticKw = ['plastic', 'pet', 'hdpe', 'ldpe', 'pp', 'ps', 'pvc', 'polystyrene', 'polyethylene', 'polypropylene', 'film', 'wrap'];
  return plasticKw.some(kw => tags.some(t => t.includes(kw))) ? 1 : 0;
}

function encodeHasGlassPackaging(product: OFFRawProduct): number {
  const tags = combinePackagingText(product);
  return tags.some(t => t.includes('glass') || t.includes('verre') || t.includes('jar')) ? 1 : 0;
}

function encodeHasCardboardPackaging(product: OFFRawProduct): number {
  const tags = combinePackagingText(product);
  const kw = ['cardboard', 'paper', 'carton', 'tetra', 'kraft', 'papier'];
  return kw.some(k => tags.some(t => t.includes(k))) ? 1 : 0;
}

function encodeHasMetalPackaging(product: OFFRawProduct): number {
  const tags = combinePackagingText(product);
  const kw = ['metal', 'aluminum', 'aluminium', 'tin', 'steel', 'can'];
  return kw.some(k => tags.some(t => t.includes(k))) ? 1 : 0;
}

function encodeHasCompostablePackaging(product: OFFRawProduct): number {
  const tags = combinePackagingText(product);
  const kw = ['compostable', 'biodegradable', 'bioplastic'];
  return kw.some(k => tags.some(t => t.includes(k))) ? 1 : 0;
}

function encodePackagingMaterialCount(product: OFFRawProduct): number {
  // Count distinct material types found
  let count = 0;
  const tags = combinePackagingText(product);
  if (tags.length === 0) return 0.5; // Unknown
  const materials = ['plastic', 'glass', 'cardboard', 'paper', 'metal', 'aluminum', 'tin', 'wood', 'cork'];
  for (const mat of materials) {
    if (tags.some(t => t.includes(mat))) count++;
  }
  // Fewer distinct materials = simpler = better? Not necessarily.
  // Normalize: 0 materials unknown = 0.5, 1 = good (0.8), 2+ = complex (lower)
  if (count === 0) return 0.5;
  if (count === 1) return 0.8;
  return Math.max(0.2, 1 - (count / 5));
}

// ─── Certifications (Features 12-17) ─────────────────────────────

const ORGANIC_TAGS = [
  'en:organic', 'en:usda-organic', 'en:eu-organic',
  'en:ab-agriculture-biologique', 'en:bio', 'en:demeter', 'en:ecocert',
  'en:bioland', 'en:naturland',
];

const FAIRTRADE_TAGS = [
  'en:fair-trade', 'en:fairtrade', 'en:fairtrade-certified',
  'en:max-havelaar', 'en:fairtrade-international',
];

const RAINFOREST_TAGS = [
  'en:rainforest-alliance', 'en:rainforest-alliance-certified',
];

const EU_ECOLABEL_TAGS = [
  'en:eu-ecolabel', 'en:european-ecolabel', 'en:eu-organic',
  'en:ecolabel', 'en:blue-angel',
];

const MSC_TAGS = [
  'en:msc', 'en:msc-certified', 'en:marine-stewardship-council',
  'en:asc', 'en:asc-certified',
];

const ALL_CERT_TAGS = [
  ...ORGANIC_TAGS, ...FAIRTRADE_TAGS, ...RAINFOREST_TAGS,
  ...EU_ECOLABEL_TAGS, ...MSC_TAGS,
  'en:fsc', 'en:fsc-certified', 'en:utz-certified', 'en:utz',
  'en:carbon-neutral', 'en:carbon-trust', 'en:b-corp',
  'en:cradle-to-cradle', 'en:non-gmo', 'en:non-gmo-project',
];

function encodeHasOrganic(tags?: string[]): number {
  return hasExactTag(tags, ORGANIC_TAGS) ? 1 : 0;
}

function encodeHasFairTrade(tags?: string[]): number {
  return hasExactTag(tags, FAIRTRADE_TAGS) ? 1 : 0;
}

function encodeHasRainforest(tags?: string[]): number {
  return hasExactTag(tags, RAINFOREST_TAGS) ? 1 : 0;
}

function encodeHasEUEcolabel(tags?: string[]): number {
  return hasExactTag(tags, EU_ECOLABEL_TAGS) ? 1 : 0;
}

function encodeHasMSC(tags?: string[]): number {
  return hasExactTag(tags, MSC_TAGS) ? 1 : 0;
}

function encodeCertificationTotal(tags?: string[]): number {
  if (!tags || tags.length === 0) return 0;
  const lower = tags.map(t => t.toLowerCase());
  let count = 0;
  for (const certTag of ALL_CERT_TAGS) {
    if (lower.some(t => t.includes(certTag.replace('en:', '')))) count++;
  }
  // Normalize: 5+ certifications = max score
  return Math.min(count / 5, 1);
}

// ─── Origin & Sustainability (Features 18-21) ────────────────────

const ORIGIN_SUSTAINABILITY: Record<string, number> = {
  // EU countries with strong environmental regulation
  'france': 0.82, 'germany': 0.85, 'italy': 0.78, 'spain': 0.76,
  'netherlands': 0.84, 'belgium': 0.82, 'austria': 0.86, 'switzerland': 0.88,
  'sweden': 0.90, 'denmark': 0.88, 'norway': 0.87, 'finland': 0.88,
  'portugal': 0.75, 'ireland': 0.78, 'luxembourg': 0.83,
  'uk': 0.80, 'united kingdom': 0.80,
  // North America
  'usa': 0.70, 'united states': 0.70, 'canada': 0.72,
  // Asia-Pacific
  'japan': 0.72, 'south korea': 0.68, 'australia': 0.70, 'new zealand': 0.75,
  // Developing
  'brazil': 0.45, 'india': 0.42, 'mexico': 0.50, 'argentina': 0.48,
  'thailand': 0.45, 'vietnam': 0.40, 'indonesia': 0.38,
  'china': 0.35, 'bangladesh': 0.30,
  // Generic
  'european union': 0.80, 'eu': 0.80, 'europe': 0.78,
  'local': 0.95, 'regional': 0.90, 'national': 0.85,
  'imported': 0.40,
};

function encodeOriginSustainability(product: OFFRawProduct): number {
  // Check origins_tags first (structured), then origins text
  const tags = product.origins_tags || [];
  const text = product.origins || '';

  if (tags.length === 0 && !text) return 0.5;

  // Check tags
  for (const tag of tags) {
    const clean = tag.replace('en:', '').replace(/-/g, ' ').toLowerCase();
    for (const [kw, score] of Object.entries(ORIGIN_SUSTAINABILITY)) {
      if (clean.includes(kw)) return score;
    }
  }

  // Check text
  const lower = text.toLowerCase();
  for (const [kw, score] of Object.entries(ORIGIN_SUSTAINABILITY)) {
    if (lower.includes(kw)) return score;
  }

  return 0.5;
}

function encodeHasLocalOrigin(product: OFFRawProduct): number {
  const tags = product.origins_tags || [];
  const text = (product.origins || '').toLowerCase();
  const localKw = ['local', 'regional', 'national', 'domestic'];

  for (const kw of localKw) {
    if (tags.some(t => t.toLowerCase().includes(kw))) return 1;
    if (text.includes(kw)) return 1;
  }
  return 0;
}

function encodeTransportEstimate(product: OFFRawProduct): number {
  // Rough distance proxy based on origin
  const tags = product.origins_tags || [];
  const text = (product.origins || '').toLowerCase();
  const combined = [...tags.map(t => t.toLowerCase()), text].join(' ');

  if (!combined || combined.trim().length === 0) return 0.5;

  // Local = minimal transport = high score
  if (combined.includes('local') || combined.includes('regional')) return 0.95;
  if (combined.includes('national')) return 0.85;

  // Same continent (EU for EU consumers)
  const euCountries = ['france', 'germany', 'italy', 'spain', 'netherlands', 'belgium',
    'austria', 'portugal', 'ireland', 'sweden', 'denmark', 'norway', 'finland',
    'switzerland', 'poland', 'czech', 'greece', 'hungary', 'romania'];
  if (euCountries.some(c => combined.includes(c))) return 0.75;

  // Same hemisphere
  const nearCountries = ['uk', 'united kingdom', 'morocco', 'tunisia', 'turkey', 'usa', 'canada'];
  if (nearCountries.some(c => combined.includes(c))) return 0.60;

  // Far away
  const farCountries = ['china', 'india', 'brazil', 'argentina', 'thailand', 'vietnam',
    'indonesia', 'australia', 'new zealand', 'japan', 'south korea'];
  if (farCountries.some(c => combined.includes(c))) return 0.30;

  return 0.5;
}

function encodeManufacturingSustainability(product: OFFRawProduct): number {
  const tags = product.manufacturing_places_tags || [];
  const text = product.manufacturing_places || '';

  if (tags.length === 0 && !text) return 0.5;

  // Check tags
  for (const tag of tags) {
    const clean = tag.replace('en:', '').replace(/-/g, ' ').toLowerCase();
    for (const [kw, score] of Object.entries(ORIGIN_SUSTAINABILITY)) {
      if (clean.includes(kw)) return score;
    }
  }

  // Check text
  const lower = text.toLowerCase();
  for (const [kw, score] of Object.entries(ORIGIN_SUSTAINABILITY)) {
    if (lower.includes(kw)) return score;
  }

  return 0.5;
}

// ─── Ingredient Analysis (Features 22-27) ────────────────────────

function encodeIsVegan(product: OFFRawProduct): number {
  // Check labels_tags for vegan certification
  if (hasExactTag(product.labels_tags, ['en:vegan', 'en:certified-vegan', 'en:vegan-society'])) return 1;
  // Check ingredients_analysis_tags
  if (hasTag(product.ingredients_analysis_tags, 'vegan')) {
    // "en:vegan" = yes, "en:non-vegan" = no
    if (hasTag(product.ingredients_analysis_tags, 'non-vegan')) return 0;
    return 1;
  }
  return 0;
}

function encodeIsVegetarian(product: OFFRawProduct): number {
  if (hasExactTag(product.labels_tags, ['en:vegetarian', 'en:suitable-for-vegetarians'])) return 1;
  if (hasTag(product.ingredients_analysis_tags, 'vegetarian')) {
    if (hasTag(product.ingredients_analysis_tags, 'non-vegetarian')) return 0;
    return 1;
  }
  return 0;
}

function encodeHasPalmOil(product: OFFRawProduct): number {
  // ingredients_analysis_tags contains "en:palm-oil" or "en:palm-oil-free"
  if (hasTag(product.ingredients_analysis_tags, 'palm-oil-free')) return 0;
  if (hasTag(product.ingredients_analysis_tags, 'palm-oil')) return 1;
  return 0;
}

function encodeHasHighSugar(product: OFFRawProduct): number {
  // nutrient_levels_tags: "en:sugars-in-high-quantity"
  return hasTag(product.nutrient_levels_tags, 'sugars-in-high-quantity') ? 1 : 0;
}

function encodeHasHighSaturatedFat(product: OFFRawProduct): number {
  return hasTag(product.nutrient_levels_tags, 'saturated-fat-in-high-quantity') ? 1 : 0;
}

function encodeHasHighSodium(product: OFFRawProduct): number {
  return hasTag(product.nutrient_levels_tags, 'salt-in-high-quantity') ? 1 : 0;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN ENCODING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

// Default values for each feature (used to measure data richness)
const FEATURE_DEFAULTS: number[] = [
  // Category (3)
  0.5, 0.5, 0.5,
  // Processing (3)
  0.5, 0, 0.5,
  // Packaging (6)
  0, 0, 0, 0, 0, 0.5,
  // Certifications (6)
  0, 0, 0, 0, 0, 0,
  // Origin (4)
  0.5, 0, 0.5, 0.5,
  // Ingredients (6)
  0, 0, 0, 0, 0, 0,
];

/**
 * Encode a raw Open Food Facts product into a 28-feature vector.
 * This is the main function used by the training pipeline.
 */
export function encodeFromOFFProduct(product: OFFRawProduct): FeatureVector {
  const features: number[] = [
    // Category Analysis (3)
    encodeCategoryEnvironment(product.categories_tags),         // [0]
    encodeCategoryProcessing(product.categories_tags),          // [1]
    encodeCategoryHealth(product.categories_tags),              // [2]

    // Processing Level (3)
    encodeNovaGroup(product.nova_group),                        // [3]
    encodeIsUltraProcessed(product.nova_group),                 // [4]
    encodeIngredientComplexity(product.ingredients_n),          // [5]

    // Packaging Features (6)
    encodeHasPlasticPackaging(product),                         // [6]
    encodeHasGlassPackaging(product),                           // [7]
    encodeHasCardboardPackaging(product),                       // [8]
    encodeHasMetalPackaging(product),                           // [9]
    encodeHasCompostablePackaging(product),                     // [10]
    encodePackagingMaterialCount(product),                      // [11]

    // Certifications (6)
    encodeHasOrganic(product.labels_tags),                      // [12]
    encodeHasFairTrade(product.labels_tags),                    // [13]
    encodeHasRainforest(product.labels_tags),                   // [14]
    encodeHasEUEcolabel(product.labels_tags),                   // [15]
    encodeHasMSC(product.labels_tags),                          // [16]
    encodeCertificationTotal(product.labels_tags),              // [17]

    // Origin & Sustainability (4)
    encodeOriginSustainability(product),                        // [18]
    encodeHasLocalOrigin(product),                              // [19]
    encodeTransportEstimate(product),                           // [20]
    encodeManufacturingSustainability(product),                 // [21]

    // Ingredient Analysis (6)
    encodeIsVegan(product),                                     // [22]
    encodeIsVegetarian(product),                                // [23]
    encodeHasPalmOil(product),                                  // [24]
    encodeHasHighSugar(product),                                // [25]
    encodeHasHighSaturatedFat(product),                         // [26]
    encodeHasHighSodium(product),                               // [27]
  ];

  // Clamp all features to [0, 1]
  for (let i = 0; i < features.length; i++) {
    if (isNaN(features[i])) features[i] = FEATURE_DEFAULTS[i];
    features[i] = Math.max(0, Math.min(1, features[i]));
  }

  // Count non-default features (data richness metric)
  let nonDefaultCount = 0;
  for (let i = 0; i < features.length; i++) {
    if (Math.abs(features[i] - FEATURE_DEFAULTS[i]) > 0.001) nonDefaultCount++;
  }

  return {
    features,
    featureNames: FEATURE_NAMES,
    nonDefaultCount,
    valid: nonDefaultCount >= 2, // At least 2 non-default features
  };
}

/**
 * Encode a locally-created product (user input) into a 28-feature vector.
 */
export function encodeLocalProduct(product: LocalProduct): FeatureVector {
  // Build a pseudo-OFF product from local fields
  const labelsTags: string[] = [];
  if (product.certifications) {
    for (const cert of product.certifications) {
      const lower = cert.toLowerCase();
      if (lower.includes('organic') || lower.includes('bio')) labelsTags.push('en:organic');
      if (lower.includes('fair') || lower.includes('trade')) labelsTags.push('en:fair-trade');
      if (lower.includes('rainforest')) labelsTags.push('en:rainforest-alliance');
      if (lower.includes('fsc')) labelsTags.push('en:fsc');
      if (lower.includes('msc')) labelsTags.push('en:msc');
      if (lower.includes('utz')) labelsTags.push('en:utz-certified');
      if (lower.includes('vegan')) labelsTags.push('en:vegan');
      if (lower.includes('vegetarian')) labelsTags.push('en:vegetarian');
      if (lower.includes('ecolabel')) labelsTags.push('en:eu-ecolabel');
    }
  }

  const categoryTags: string[] = [];
  if (product.category) {
    categoryTags.push(`en:${product.category.toLowerCase().replace(/\s+/g, '-')}`);
  }

  let packagingText = product.packagingType || '';
  if (product.ocrText) {
    packagingText += ' ' + product.ocrText;
  }

  return encodeFromOFFProduct({
    categories_tags: categoryTags.length > 0 ? categoryTags : undefined,
    nova_group: product.novaGroup,
    labels_tags: labelsTags.length > 0 ? labelsTags : undefined,
    packaging_text: packagingText || undefined,
    origins: product.originCountry,
    manufacturing_places: product.manufacturingPlace,
  });
}

/**
 * Encode features from plain text fields (used for OCR results)
 */
export function encodeFromText(text: string, category?: string): FeatureVector {
  const lower = text.toLowerCase();

  const labelsTags: string[] = [];
  if (lower.includes('organic') || lower.includes('bio')) labelsTags.push('en:organic');
  if (lower.includes('fair trade') || lower.includes('fairtrade')) labelsTags.push('en:fair-trade');
  if (lower.includes('rainforest')) labelsTags.push('en:rainforest-alliance');
  if (lower.includes('vegan')) labelsTags.push('en:vegan');
  if (lower.includes('vegetarian')) labelsTags.push('en:vegetarian');
  if (lower.includes('msc')) labelsTags.push('en:msc');

  const categoryTags: string[] = [];
  if (category) {
    categoryTags.push(`en:${category.toLowerCase().replace(/\s+/g, '-')}`);
  }

  return encodeFromOFFProduct({
    categories_tags: categoryTags.length > 0 ? categoryTags : undefined,
    labels_tags: labelsTags.length > 0 ? labelsTags : undefined,
    packaging_text: text,
    origins: text,
  });
}

/**
 * Validate a feature vector
 */
export function validateFeatures(features: number[]): boolean {
  if (features.length !== NUM_FEATURES) return false;
  return features.every(f => typeof f === 'number' && !isNaN(f) && f >= 0 && f <= 1);
}

/**
 * Get feature names for debugging/display
 */
export function getFeatureNames(): string[] {
  return [...FEATURE_NAMES];
}
