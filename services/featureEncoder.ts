// services/featureEncoder.ts — Feature Engineering for ECOTRACE ML Model v4.0
//
// Converts raw Open Food Facts product data into a normalized 40-dimensional
// feature vector for neural network input.
//
// CRITICAL: This file MUST stay in EXACT sync with scripts/trainModel.js.
//   - Feature order must match encodeProduct() in trainModel.js
//   - CATEGORY_ENV_SCORES must match trainModel.js
//   - Food group tag arrays must match trainModel.js
//   - NUM_FEATURES must match NUM_FEATURES in trainModel.js
//
// Run `node scripts/validateSync.js` to verify sync before deployment.

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

/** The 40-feature vector output */
export interface FeatureVector {
  features: number[];         // length 40, all values in [0, 1]
  featureNames: string[];     // descriptive name for each feature
  nonDefaultCount: number;    // how many features differ from default (data richness)
  valid: boolean;             // false if critical data is missing
}

// ─── Constants ───────────────────────────────────────────────────

export const NUM_FEATURES = 40;

export const FEATURE_NAMES: string[] = [
  // Category Analysis (1)
  'categoryEnvScore_dataDriven',   // [0]
  // Processing Level (3)
  'novaGroupNormalized',           // [1]
  'isUltraProcessed',              // [2]
  'ingredientComplexity',          // [3]
  // Packaging Features (6)
  'hasPlasticPackaging',           // [4]
  'hasGlassPackaging',             // [5]
  'hasCardboardPackaging',         // [6]
  'hasMetalPackaging',             // [7]
  'hasCompostablePackaging',       // [8]
  'packagingMaterialCount',        // [9]
  // Certifications (6)
  'hasOrganicCert',                // [10]
  'hasFairTradeCert',              // [11]
  'hasRainforestAllianceCert',     // [12]
  'hasEUEcolabel',                 // [13]
  'hasMSCCert',                    // [14]
  'certificationTotalScore',       // [15]
  // Origin & Sustainability (4)
  'originSustainabilityScore',     // [16]
  'hasLocalOrigin',                // [17]
  'transportEstimateScore',        // [18]
  'manufacturingSustainability',   // [19]
  // Ingredient Analysis (3)
  'isVegan',                       // [20]
  'isVegetarian',                  // [21]
  'hasPalmOil',                    // [22]
  // Nutrient Levels (5)
  'hasHighSugar',                  // [23]
  'hasHighSaturatedFat',           // [24]
  'hasHighSodium',                 // [25]
  'hasHighFat',                    // [26]
  'hasLowFat',                     // [27]
  // Food Group Binaries (12)
  'isMeatProduct',                 // [28]
  'isFishSeafood',                 // [29]
  'isDairyProduct',                // [30]
  'isPlantBased',                  // [31]
  'isFruitVegetable',             // [32]
  'isCereal',                      // [33]
  'isBeverage',                    // [34]
  'isFatOil',                      // [35]
  'isSweetSnack',                  // [36]
  'isCanned',                      // [37]
  'isFrozen',                      // [38]
  'isReadyMeal',                   // [39]
];

// ─── Helper: tag matching ────────────────────────────────────────

function hasTag(tags: string[] | null | undefined, keyword: string): boolean {
  if (!tags || tags.length === 0) return false;
  const kw = keyword.toLowerCase();
  return tags.some(tag => tag.toLowerCase().includes(kw));
}

function hasExactTag(tags: string[] | null | undefined, exactTags: string[]): boolean {
  if (!tags || tags.length === 0) return false;
  const lower = tags.map(t => t.toLowerCase());
  return exactTags.some(t => lower.includes(t.toLowerCase()));
}

// ═══════════════════════════════════════════════════════════════════
// FEATURE ENCODERS — 40 features, all normalized 0-1
// ═══════════════════════════════════════════════════════════════════

// ─── DATA-DRIVEN CATEGORY SCORES (Feature 0) ────────────────────
// Derived from actual eco-score averages across 10,000+ products.
// Each entry = (average_ecoscore / 100) for that category.
// MUST match CATEGORY_ENV_SCORES in trainModel.js exactly.

const CATEGORY_ENV_SCORES: Record<string, number> = {
  'en:poultry-hams': 0.221, 'en:yogurt-drinks': 0.223,
  'en:pork-and-its-products': 0.238, 'en:prepared-meats': 0.252,
  'en:breaded-fish': 0.255, 'en:hams': 0.257, 'en:white-hams': 0.258,
  'en:tunas': 0.263, 'en:dairy-drinks': 0.264, 'en:meats': 0.275,
  'en:fish-preparations': 0.278, 'en:chickens': 0.280,
  'en:chicken-and-its-products': 0.284, 'en:poultries': 0.286,
  'en:sardines': 0.288, 'en:canned-sardines': 0.288,
  'en:canned-fishes': 0.291, 'en:almonds': 0.296,
  'en:fishes-and-their-products': 0.296, 'en:fishes': 0.299,
  'en:seafood': 0.300, 'en:fatty-fishes': 0.304,
  'en:breaded-products': 0.308, 'en:nuts': 0.314,
  'en:meats-and-their-products': 0.317, 'en:butters': 0.332,
  'en:dairy-spreads': 0.333, 'en:milkfat': 0.335,
  'en:animal-fats': 0.343, 'en:rices': 0.345,
  'en:milk-chocolates': 0.351, 'en:chocolates': 0.360,
  'en:dark-chocolates': 0.362, 'en:chocolate-cakes': 0.363,
  'en:cocoa-and-its-products': 0.381, 'en:chocolate-candies': 0.396,
  'en:microwave-meals': 0.402, 'en:extruded-flakes': 0.411,
  'en:hard-cheeses': 0.412, 'en:filled-cereals': 0.414,
  'en:meals-with-meat': 0.420, 'en:hazelnut-spreads': 0.421,
  'en:extruded-cereals': 0.423, 'en:fruit-juices': 0.424,
  'en:chocolate-spreads': 0.426, 'en:juices-and-nectars': 0.426,
  'en:peanut-butters': 0.427, 'en:fruit-based-beverages': 0.430,
  'en:olive-oils': 0.431, 'en:cheese-spreads': 0.432,
  'en:nut-butters': 0.433, 'en:french-cheeses': 0.436,
  'en:cow-cheeses': 0.439, 'en:pasteurized-cheeses': 0.439,
  'en:bars': 0.441, 'en:extra-virgin-olive-oils': 0.442,
  'en:nuts-and-their-products': 0.444, 'en:chocolate-biscuits': 0.446,
  'en:cereal-grains': 0.446, 'en:spreadable-fats': 0.452,
  'en:cheeses': 0.455, 'en:milks': 0.459, 'en:fats': 0.458,
  'en:mayonnaises': 0.458, 'en:vegetable-oils': 0.467,
  'en:wafers': 0.463, 'en:filled-biscuits': 0.471,
  'en:confectioneries': 0.476, 'en:pestos': 0.476,
  'en:cereal-bars': 0.481, 'en:cakes': 0.489,
  'en:breakfast-cereals-rich-in-fibre': 0.490,
  'en:sweet-snacks': 0.496, 'en:spreads': 0.509,
  'en:pasta-dishes': 0.515, 'en:uht-milks': 0.518,
  'en:biscuits-and-cakes': 0.521, 'en:biscuits': 0.521,
  'en:canned-foods': 0.525, 'en:vegetable-fats': 0.525,
  'en:dairies': 0.527, 'en:beverages': 0.532, 'en:snacks': 0.536,
  'en:biscuits-and-crackers': 0.546, 'en:fermented-milk-products': 0.551,
  'en:pasta-sauces': 0.555, 'en:chocolate-cereals': 0.557,
  'en:fermented-foods': 0.558, 'en:seeds': 0.565,
  'en:breakfast-cereals': 0.574, 'en:breakfasts': 0.575,
  'en:sweet-spreads': 0.579, 'en:plant-based-beverages': 0.583,
  'en:plant-based-spreads': 0.586, 'en:frozen-foods': 0.587,
  'en:brioches': 0.591, 'en:legumes-and-their-products': 0.594,
  'en:dried-products': 0.602, 'en:fruits': 0.603,
  'en:meals': 0.606, 'en:cereals-and-their-products': 0.610,
  'en:margarines': 0.610, 'en:groceries': 0.619,
  'en:sweet-pastries-and-pies': 0.620, 'en:viennoiseries': 0.620,
  'en:noodles': 0.624, 'en:plant-based-foods-and-beverages': 0.629,
  'en:sauces': 0.629, 'en:condiments': 0.633,
  'en:plant-based-foods': 0.639, 'en:shortbread-cookies': 0.639,
  'en:yogurts': 0.651, 'en:candies': 0.653,
  'en:unsweetened-beverages': 0.654, 'en:cereals-and-potatoes': 0.657,
  'en:eggs': 0.658, 'en:desserts': 0.672, 'en:dairy-desserts': 0.673,
  'en:legumes': 0.676, 'en:jams': 0.677, 'en:pastas': 0.677,
  'en:fermented-dairy-desserts': 0.680, 'en:creams': 0.683,
  'en:salty-snacks': 0.685, 'en:meat-analogues': 0.686,
  'en:cereal-based-drinks': 0.688, 'en:corn-chips': 0.689,
  'en:fruits-based-foods': 0.693, 'en:sweeteners': 0.694,
  'en:meat-alternatives': 0.701, 'en:crackers-appetizers': 0.702,
  'en:mustards': 0.702, 'en:milk-substitutes': 0.717,
  'en:plant-based-milk-alternatives': 0.717, 'en:appetizers': 0.719,
  'en:mueslis': 0.724, 'en:dairy-substitutes': 0.726,
  'en:fruits-and-vegetables-based-foods': 0.727,
  'en:chips-and-fries': 0.732, 'en:crisps': 0.735,
  'en:vegetables-based-foods': 0.738, 'en:ice-creams': 0.741,
  'en:rolled-flakes': 0.742, 'en:cereal-pastas': 0.745,
  'en:mueslis-with-fruits': 0.749, 'en:dry-pastas': 0.749,
  'en:plain-fermented-dairy-desserts': 0.757, 'en:plain-yogurts': 0.758,
  'en:potato-crisps': 0.759, 'en:breads': 0.760,
  'en:skyrs': 0.762, 'en:sliced-breads': 0.765,
  'en:tomato-sauces': 0.766, 'en:soups': 0.767,
  'en:wholemeal-breads': 0.770, 'en:ketchup': 0.770,
  'en:vegetables': 0.771, 'en:canned-plant-based-foods': 0.780,
  'en:honeys': 0.783, 'en:canned-vegetables': 0.784,
  'en:toasts': 0.785, 'en:pulses': 0.785,
  'en:prepared-vegetables': 0.786, 'en:teas': 0.790,
  'en:rusks': 0.795, 'en:vegetable-soups': 0.796,
  'en:canned-legumes': 0.797, 'en:lentils': 0.806,
  'en:non-dairy-desserts': 0.807, 'en:non-dairy-yogurts': 0.807,
  'en:compotes': 0.835, 'en:apple-compotes': 0.836,
};

/**
 * Encode category score using specificity-weighted average.
 * MUST match encodeCategoryScore() in trainModel.js exactly.
 */
function encodeCategoryScore(tags: string[] | undefined): number {
  if (!tags || tags.length === 0) return 0.5;

  let totalScore = 0;
  let totalWeight = 0;

  for (const tag of tags) {
    const lower = tag.toLowerCase();
    if (CATEGORY_ENV_SCORES[lower] !== undefined) {
      // Weight by specificity: more specific categories (longer names) get higher weight
      const specificity = lower.split('-').length;
      totalScore += CATEGORY_ENV_SCORES[lower] * specificity;
      totalWeight += specificity;
    }
  }

  if (totalWeight === 0) return 0.5;
  return totalScore / totalWeight;
}

// ─── Food Group Binary Features (Features 28-39) ────────────────
// MUST match tag arrays in trainModel.js exactly.

const MEAT_TAGS = ['en:meats', 'en:meats-and-their-products', 'en:prepared-meats',
  'en:pork', 'en:beef', 'en:poultry', 'en:poultries', 'en:chicken',
  'en:chickens', 'en:lamb', 'en:sausages', 'en:hams', 'en:white-hams',
  'en:pork-and-its-products', 'en:chicken-and-its-products',
  'en:cooked-poultries', 'en:meat-preparations'];

const FISH_TAGS = ['en:fishes', 'en:fishes-and-their-products', 'en:seafood',
  'en:canned-fishes', 'en:sardines', 'en:tunas', 'en:mackerels',
  'en:fatty-fishes', 'en:fish-fillets', 'en:fish-preparations',
  'en:smoked-fishes', 'en:breaded-fish'];

const DAIRY_TAGS = ['en:dairies', 'en:cheeses', 'en:milks', 'en:yogurts',
  'en:butters', 'en:creams', 'en:fermented-milk-products', 'en:dairy-desserts',
  'en:cow-cheeses', 'en:fresh-cheeses', 'en:hard-cheeses',
  'en:dairy-drinks', 'en:dairy-spreads', 'en:skyrs',
  'en:cheese-spreads', 'en:plain-yogurts', 'en:fruit-yogurts'];

const PLANT_BASED_TAGS = ['en:plant-based-foods', 'en:plant-based-foods-and-beverages',
  'en:plant-based-beverages', 'en:plant-based-spreads',
  'en:plant-based-milk-alternatives', 'en:milk-substitutes',
  'en:dairy-substitutes', 'en:meat-alternatives', 'en:meat-analogues',
  'en:non-dairy-desserts', 'en:non-dairy-yogurts', 'en:vegan-products'];

const FRUIT_VEG_TAGS = ['en:fruits', 'en:vegetables', 'en:vegetables-based-foods',
  'en:fruits-and-vegetables-based-foods', 'en:fruits-based-foods',
  'en:prepared-vegetables', 'en:canned-vegetables', 'en:frozen-vegetables',
  'en:compotes', 'en:vegetable-soups', 'en:tomatoes',
  'en:legumes', 'en:legumes-and-their-products', 'en:pulses', 'en:lentils',
  'en:chickpeas', 'en:canned-legumes', 'en:canned-plant-based-foods'];

const CEREAL_TAGS = ['en:cereals-and-potatoes', 'en:cereals-and-their-products',
  'en:breakfast-cereals', 'en:breads', 'en:pastas', 'en:rices',
  'en:cereal-flakes', 'en:mueslis', 'en:cereal-bars',
  'en:sliced-breads', 'en:wholemeal-breads', 'en:dry-pastas',
  'en:noodles', 'en:rolled-flakes', 'en:toasts', 'en:rusks',
  'en:extruded-cereals', 'en:brioches', 'en:cereal-grains'];

const BEVERAGE_TAGS = ['en:beverages', 'en:beverages-and-beverages-preparations',
  'en:fruit-juices', 'en:juices-and-nectars', 'en:fruit-based-beverages',
  'en:unsweetened-beverages', 'en:sweetened-beverages', 'en:teas',
  'en:hot-beverages', 'en:instant-beverages', 'en:alcoholic-beverages',
  'en:non-alcoholic-beverages', 'en:tea-based-beverages', 'en:iced-teas',
  'en:cereal-based-drinks', 'en:oat-based-drinks'];

const FAT_OIL_TAGS = ['en:fats', 'en:vegetable-oils', 'en:olive-oils',
  'en:vegetable-fats', 'en:spreadable-fats', 'en:animal-fats',
  'en:milkfat', 'en:extra-virgin-olive-oils', 'en:margarines',
  'en:light-margarines'];

const SWEET_TAGS = ['en:sweet-snacks', 'en:chocolates', 'en:chocolate-biscuits',
  'en:biscuits-and-cakes', 'en:biscuits', 'en:cakes', 'en:confectioneries',
  'en:chocolate-candies', 'en:candies', 'en:cocoa-and-its-products',
  'en:chocolate-spreads', 'en:hazelnut-spreads', 'en:dark-chocolates',
  'en:milk-chocolates', 'en:wafers', 'en:filled-biscuits'];

const CANNED_TAGS = ['en:canned-foods', 'en:canned-fishes', 'en:canned-vegetables',
  'en:canned-plant-based-foods', 'en:canned-legumes', 'en:canned-sardines',
  'en:canned-meals', 'en:canned-tunas'];

const FROZEN_TAGS = ['en:frozen-foods', 'en:frozen-ready-made-meals',
  'en:frozen-vegetables', 'en:frozen-desserts', 'en:frozen-plant-based-foods',
  'en:frozen-fried-potatoes', 'en:ice-creams', 'en:ice-creams-and-sorbets'];

const READY_MEAL_TAGS = ['en:meals', 'en:meals-with-meat', 'en:meals-with-chicken',
  'en:meals-with-fish', 'en:microwave-meals', 'en:pasta-dishes',
  'en:rice-dishes', 'en:sandwiches', 'en:pizzas', 'en:combination-meals',
  'en:fresh-meals', 'en:prepared-salads', 'en:poultry-meals'];

function hasFoodGroup(cats: string[] | undefined, groupTags: string[]): number {
  if (!cats || cats.length === 0) return 0;
  const lowerCats = cats.map(c => c.toLowerCase());
  return groupTags.some(t => lowerCats.includes(t.toLowerCase())) ? 1 : 0;
}

// ─── Certifications ──────────────────────────────────────────────

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

// ─── Origin & Sustainability ─────────────────────────────────────

const ORIGIN_SUSTAINABILITY: Record<string, number> = {
  'france': 0.82, 'germany': 0.85, 'italy': 0.78, 'spain': 0.76,
  'netherlands': 0.84, 'belgium': 0.82, 'austria': 0.86, 'switzerland': 0.88,
  'sweden': 0.90, 'denmark': 0.88, 'norway': 0.87, 'finland': 0.88,
  'portugal': 0.75, 'ireland': 0.78, 'luxembourg': 0.83,
  'uk': 0.80, 'united kingdom': 0.80,
  'usa': 0.70, 'united states': 0.70, 'canada': 0.72,
  'japan': 0.72, 'south korea': 0.68, 'australia': 0.70, 'new zealand': 0.75,
  'brazil': 0.45, 'india': 0.42, 'mexico': 0.50, 'argentina': 0.48,
  'thailand': 0.45, 'vietnam': 0.40, 'indonesia': 0.38,
  'china': 0.35, 'bangladesh': 0.30,
  'european union': 0.80, 'eu': 0.80, 'europe': 0.78,
  'local': 0.95, 'regional': 0.90, 'national': 0.85, 'imported': 0.40,
};

// ─── Packaging Helpers ───────────────────────────────────────────

function combinePackagingText(product: OFFRawProduct): string[] {
  const allTags: string[] = [];
  if (product.packaging_tags) allTags.push(...product.packaging_tags);
  if (product.packaging_materials_tags) allTags.push(...product.packaging_materials_tags);
  if (product.packaging_text) {
    const words = product.packaging_text.toLowerCase().split(/[\s,;/]+/);
    allTags.push(...words);
  }
  return allTags.map(t => t.toLowerCase());
}

// ─── Origin Helpers ──────────────────────────────────────────────

function encodeOriginFromTagsAndText(
  tags: string[] | undefined,
  text: string | undefined,
  map: Record<string, number>,
): number {
  if ((!tags || tags.length === 0) && !text) return 0.5;
  const allSources: string[] = [];
  if (tags) {
    for (const tag of tags) allSources.push(tag.replace('en:', '').replace(/-/g, ' ').toLowerCase());
  }
  if (text) allSources.push(text.toLowerCase());
  const combined = allSources.join(' ');
  for (const [kw, score] of Object.entries(map)) {
    if (combined.includes(kw)) return score;
  }
  return 0.5;
}

function encodeTransportEstimate(product: OFFRawProduct): number {
  const tags = product.origins_tags || [];
  const text = (product.origins || '').toLowerCase();
  const combined = [...tags.map(t => t.toLowerCase()), text].join(' ');
  if (!combined || combined.trim().length === 0) return 0.5;
  if (combined.includes('local') || combined.includes('regional')) return 0.95;
  if (combined.includes('national')) return 0.85;
  const euCountries = ['france', 'germany', 'italy', 'spain', 'netherlands', 'belgium',
    'austria', 'portugal', 'ireland', 'sweden', 'denmark', 'norway', 'finland',
    'switzerland', 'poland', 'czech', 'greece', 'hungary', 'romania'];
  if (euCountries.some(c => combined.includes(c))) return 0.75;
  const nearCountries = ['uk', 'united kingdom', 'morocco', 'tunisia', 'turkey', 'usa', 'canada'];
  if (nearCountries.some(c => combined.includes(c))) return 0.60;
  const farCountries = ['china', 'india', 'brazil', 'argentina', 'thailand', 'vietnam',
    'indonesia', 'australia', 'new zealand', 'japan', 'south korea'];
  if (farCountries.some(c => combined.includes(c))) return 0.30;
  return 0.5;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN ENCODING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

// Default values for each feature (used to measure data richness)
const FEATURE_DEFAULTS: number[] = [
  // Category (1)
  0.5,
  // Processing (3)
  0.5, 0, 0.5,
  // Packaging (6)
  0, 0, 0, 0, 0, 0.5,
  // Certifications (6)
  0, 0, 0, 0, 0, 0,
  // Origin (4)
  0.5, 0, 0.5, 0.5,
  // Ingredient Analysis (3)
  0, 0, 0,
  // Nutrient Levels (5)
  0, 0, 0, 0, 0,
  // Food Group Binaries (12)
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];

/**
 * Encode a raw Open Food Facts product into a 40-feature vector.
 * Feature order MUST match encodeProduct() in trainModel.js exactly.
 */
export function encodeFromOFFProduct(product: OFFRawProduct): FeatureVector {
  const packTags = combinePackagingText(product);
  const plasticKw = ['plastic', 'pet', 'hdpe', 'ldpe', 'pp', 'ps', 'pvc', 'polystyrene', 'polyethylene', 'polypropylene', 'film', 'wrap'];
  const glassKw = ['glass', 'verre', 'jar'];
  const cardboardKw = ['cardboard', 'paper', 'carton', 'tetra', 'kraft', 'papier'];
  const metalKw = ['metal', 'aluminum', 'aluminium', 'tin', 'steel', 'can'];
  const compostKw = ['compostable', 'biodegradable', 'bioplastic'];
  const allMatKw = ['plastic', 'glass', 'cardboard', 'paper', 'metal', 'aluminum', 'tin', 'wood', 'cork'];

  // Count packaging materials
  let matCount = 0;
  for (const mat of allMatKw) {
    if (packTags.some(t => t.includes(mat))) matCount++;
  }
  let packMaterialScore: number;
  if (packTags.length === 0) packMaterialScore = 0.5;
  else if (matCount === 0) packMaterialScore = 0.5;
  else if (matCount === 1) packMaterialScore = 0.8;
  else packMaterialScore = Math.max(0.2, 1 - (matCount / 5));

  // Certification count
  const labels = product.labels_tags || [];
  const labelsLower = labels.map(t => t.toLowerCase());
  let certCount = 0;
  for (const certTag of ALL_CERT_TAGS) {
    if (labelsLower.some(t => t.includes(certTag.replace('en:', '')))) certCount++;
  }

  // NOVA group
  const nova = product.nova_group;
  const novaScore = (nova !== null && nova !== undefined)
    ? Math.max(0, Math.min(1, 1 - ((nova - 1) / 3))) : 0.5;

  // Ingredients
  const ingredientsN = product.ingredients_n;
  const ingredientComplexity = (ingredientsN !== null && ingredientsN !== undefined && ingredientsN > 0)
    ? Math.max(0, Math.min(1, 1 - (ingredientsN / 50))) : 0.5;

  // Vegan/Vegetarian from ingredients_analysis_tags
  let isVegan = 0, isVegetarian = 0, hasPalmOil = 0;
  const ingAnalysis = product.ingredients_analysis_tags || [];
  if (hasExactTag(labels, ['en:vegan', 'en:certified-vegan', 'en:vegan-society'])) isVegan = 1;
  else if (hasTag(ingAnalysis, 'vegan') && !hasTag(ingAnalysis, 'non-vegan')) isVegan = 1;

  if (hasExactTag(labels, ['en:vegetarian', 'en:suitable-for-vegetarians'])) isVegetarian = 1;
  else if (hasTag(ingAnalysis, 'vegetarian') && !hasTag(ingAnalysis, 'non-vegetarian')) isVegetarian = 1;

  if (hasTag(ingAnalysis, 'palm-oil') && !hasTag(ingAnalysis, 'palm-oil-free')) hasPalmOil = 1;

  // Nutrient levels
  const nutrient = product.nutrient_levels_tags || [];
  const hasHighSugar = hasTag(nutrient, 'sugars-in-high-quantity') ? 1 : 0;
  const hasHighSatFat = hasTag(nutrient, 'saturated-fat-in-high-quantity') ? 1 : 0;
  const hasHighSodium = hasTag(nutrient, 'salt-in-high-quantity') ? 1 : 0;

  // Local origin
  const originTags = product.origins_tags || [];
  const originText = (product.origins || '').toLowerCase();
  const localKw = ['local', 'regional', 'national', 'domestic'];
  const hasLocal = localKw.some(kw =>
    originTags.some(t => t.toLowerCase().includes(kw)) || originText.includes(kw)
  ) ? 1 : 0;

  const cats = product.categories_tags;

  const features: number[] = [
    // === CATEGORY ANALYSIS (1 feature: data-driven score) ===
    encodeCategoryScore(cats),                                              // [0]

    // === PROCESSING LEVEL (3) ===
    novaScore,                                                              // [1]
    nova === 4 ? 1 : 0,                                                    // [2] isUltraProcessed
    ingredientComplexity,                                                   // [3]

    // === PACKAGING (6) ===
    plasticKw.some(kw => packTags.some(t => t.includes(kw))) ? 1 : 0,      // [4]
    glassKw.some(kw => packTags.some(t => t.includes(kw))) ? 1 : 0,        // [5]
    cardboardKw.some(kw => packTags.some(t => t.includes(kw))) ? 1 : 0,    // [6]
    metalKw.some(kw => packTags.some(t => t.includes(kw))) ? 1 : 0,        // [7]
    compostKw.some(kw => packTags.some(t => t.includes(kw))) ? 1 : 0,      // [8]
    packMaterialScore,                                                      // [9]

    // === CERTIFICATIONS (6) ===
    hasExactTag(labels, ORGANIC_TAGS) ? 1 : 0,                             // [10]
    hasExactTag(labels, FAIRTRADE_TAGS) ? 1 : 0,                           // [11]
    hasExactTag(labels, RAINFOREST_TAGS) ? 1 : 0,                          // [12]
    hasExactTag(labels, EU_ECOLABEL_TAGS) ? 1 : 0,                         // [13]
    hasExactTag(labels, MSC_TAGS) ? 1 : 0,                                 // [14]
    Math.min(certCount / 5, 1),                                             // [15]

    // === ORIGIN (4) ===
    encodeOriginFromTagsAndText(product.origins_tags, product.origins, ORIGIN_SUSTAINABILITY), // [16]
    hasLocal,                                                               // [17]
    encodeTransportEstimate(product),                                       // [18]
    encodeOriginFromTagsAndText(product.manufacturing_places_tags, product.manufacturing_places, ORIGIN_SUSTAINABILITY), // [19]

    // === INGREDIENT ANALYSIS (3) ===
    isVegan,                                                                // [20]
    isVegetarian,                                                           // [21]
    hasPalmOil,                                                             // [22]

    // === NUTRIENT LEVELS (5) ===
    hasHighSugar,                                                           // [23]
    hasHighSatFat,                                                          // [24]
    hasHighSodium,                                                          // [25]
    hasTag(nutrient, 'fat-in-high-quantity') ? 1 : 0,                       // [26]
    hasTag(nutrient, 'fat-in-low-quantity') ? 1 : 0,                        // [27]

    // === FOOD GROUP BINARY FEATURES (12) ===
    hasFoodGroup(cats, MEAT_TAGS),                                          // [28]
    hasFoodGroup(cats, FISH_TAGS),                                          // [29]
    hasFoodGroup(cats, DAIRY_TAGS),                                         // [30]
    hasFoodGroup(cats, PLANT_BASED_TAGS),                                   // [31]
    hasFoodGroup(cats, FRUIT_VEG_TAGS),                                     // [32]
    hasFoodGroup(cats, CEREAL_TAGS),                                        // [33]
    hasFoodGroup(cats, BEVERAGE_TAGS),                                      // [34]
    hasFoodGroup(cats, FAT_OIL_TAGS),                                       // [35]
    hasFoodGroup(cats, SWEET_TAGS),                                         // [36]
    hasFoodGroup(cats, CANNED_TAGS),                                        // [37]
    hasFoodGroup(cats, FROZEN_TAGS),                                        // [38]
    hasFoodGroup(cats, READY_MEAL_TAGS),                                    // [39]
  ];

  // Clamp all values to [0, 1]
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
 * Encode a locally-created product (user input) into a 40-feature vector.
 */
export function encodeLocalProduct(product: LocalProduct): FeatureVector {
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
