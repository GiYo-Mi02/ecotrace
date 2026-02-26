// scripts/trainModel.js — ECOTRACE Model Training Pipeline v3.0
//
// Reads scraped Open Food Facts data from data/realTrainingData.json,
// encodes 40 features (data-driven category scores + food group binaries),
// trains a neural network with dropout + L2 regularization,
// and saves weights to assets/ml/eco-score-model/.
//
// Uses @tensorflow/tfjs with WASM backend (NOT tfjs-node).
//
// Architecture: 40 → 128(ReLU,L2,Dropout) → 64(ReLU,L2,Dropout) → 32(ReLU) → 1(Sigmoid)
// Optimizer:    Adam (lr=0.001)
// Loss:         Mean Squared Error
// Epochs:       300 (with early stopping, patience=25)
// Batch Size:   64
// Train/Val/Test: 70/15/15
//
// Usage: npm run train-model
//        node scripts/trainModel.js
//        node scripts/trainModel.js --epochs 500 --lr 0.0005

const tf = require('@tensorflow/tfjs');
require('@tensorflow/tfjs-backend-wasm');
const fs = require('fs');
const path = require('path');

// ─── Configuration ───────────────────────────────────────────────

const NUM_FEATURES = 40;

const DEFAULTS = {
  epochs: 300,
  batchSize: 64,
  learningRate: 0.001,
  validationSplit: 0.15,
  testSplit: 0.15,
  patience: 25,
  minDelta: 0.0005,
  l2Reg: 0.0005,
  dropoutRate1: 0.25,
  dropoutRate2: 0.15,
  dataPath: path.join(__dirname, '..', 'data', 'realTrainingData.json'),
  outputDir: path.join(__dirname, '..', 'assets', 'ml', 'eco-score-model'),
  metadataPath: path.join(__dirname, '..', 'assets', 'ml', 'modelMetadata.json'),
};

function parseArgs() {
  const args = process.argv.slice(2);
  const config = { ...DEFAULTS };
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const val = args[i + 1];
    if (key === 'epochs') config.epochs = parseInt(val);
    if (key === 'lr') config.learningRate = parseFloat(val);
    if (key === 'batch') config.batchSize = parseInt(val);
    if (key === 'data') config.dataPath = val;
    if (key === 'patience') config.patience = parseInt(val);
    if (key === 'l2') config.l2Reg = parseFloat(val);
  }
  return config;
}

// ─── Feature Encoding (40 features) ─────────────────────────────

// Helper: tag matching
function hasTag(tags, keyword) {
  if (!tags || tags.length === 0) return false;
  const kw = keyword.toLowerCase();
  return tags.some(tag => tag.toLowerCase().includes(kw));
}

function hasExactTag(tags, exactTags) {
  if (!tags || tags.length === 0) return false;
  const lower = tags.map(t => t.toLowerCase());
  return exactTags.some(t => lower.includes(t.toLowerCase()));
}

function hasAnyTag(tags, keywords) {
  if (!tags || tags.length === 0) return false;
  const lower = tags.map(t => t.toLowerCase());
  return keywords.some(kw => lower.some(t => t.includes(kw.toLowerCase())));
}

// ─── DATA-DRIVEN CATEGORY SCORES ────────────────────────────────
// Derived from actual eco-score averages across 10,000+ products.
// Each entry = (average_ecoscore / 100) for that category.
// Only categories with n >= 20 observations are included.

const CATEGORY_ENV_SCORES = {
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

// IMPROVED: Use AVERAGE of matching category scores (not MAX)
// Prefer more specific (longer) tag names via weighting
function encodeCategoryScore(tags) {
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

function hasFoodGroup(cats, groupTags) {
  if (!cats || cats.length === 0) return 0;
  const lowerCats = cats.map(c => c.toLowerCase());
  return groupTags.some(t => lowerCats.includes(t.toLowerCase())) ? 1 : 0;
}

// ─── Other Feature Helpers ───────────────────────────────────────

const ORIGIN_SUSTAINABILITY = {
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

const ORGANIC_TAGS = ['en:organic', 'en:usda-organic', 'en:eu-organic', 'en:ab-agriculture-biologique', 'en:bio', 'en:demeter', 'en:ecocert', 'en:bioland', 'en:naturland'];
const FAIRTRADE_TAGS = ['en:fair-trade', 'en:fairtrade', 'en:fairtrade-certified', 'en:max-havelaar', 'en:fairtrade-international'];
const RAINFOREST_TAGS = ['en:rainforest-alliance', 'en:rainforest-alliance-certified'];
const EU_ECOLABEL_TAGS = ['en:eu-ecolabel', 'en:european-ecolabel', 'en:eu-organic', 'en:ecolabel', 'en:blue-angel'];
const MSC_TAGS = ['en:msc', 'en:msc-certified', 'en:marine-stewardship-council', 'en:asc', 'en:asc-certified'];
const ALL_CERT_TAGS = [...ORGANIC_TAGS, ...FAIRTRADE_TAGS, ...RAINFOREST_TAGS, ...EU_ECOLABEL_TAGS, ...MSC_TAGS,
  'en:fsc', 'en:fsc-certified', 'en:utz-certified', 'en:utz', 'en:carbon-neutral', 'en:carbon-trust', 'en:b-corp', 'en:cradle-to-cradle', 'en:non-gmo', 'en:non-gmo-project'];

function combinePackagingText(product) {
  const allTags = [];
  if (product.packaging_tags) allTags.push(...product.packaging_tags);
  if (product.packaging_materials_tags) allTags.push(...product.packaging_materials_tags);
  if (product.packaging_text) allTags.push(...product.packaging_text.toLowerCase().split(/[\s,;/]+/));
  return allTags.map(t => t.toLowerCase());
}

function encodeOriginFromTagsAndText(tags, text, map) {
  if ((!tags || tags.length === 0) && !text) return 0.5;
  const allSources = [];
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

function encodeTransportEstimate(product) {
  const tags = product.origins_tags || [];
  const text = (product.origins || '').toLowerCase();
  const combined = [...tags.map(t => t.toLowerCase()), text].join(' ');
  if (!combined || combined.trim().length === 0) return 0.5;
  if (combined.includes('local') || combined.includes('regional')) return 0.95;
  if (combined.includes('national')) return 0.85;
  const euCountries = ['france', 'germany', 'italy', 'spain', 'netherlands', 'belgium',
    'austria', 'portugal', 'ireland', 'sweden', 'denmark', 'norway', 'finland', 'switzerland', 'poland', 'czech', 'greece', 'hungary', 'romania'];
  if (euCountries.some(c => combined.includes(c))) return 0.75;
  const nearCountries = ['uk', 'united kingdom', 'morocco', 'tunisia', 'turkey', 'usa', 'canada'];
  if (nearCountries.some(c => combined.includes(c))) return 0.60;
  const farCountries = ['china', 'india', 'brazil', 'argentina', 'thailand', 'vietnam', 'indonesia', 'australia', 'new zealand', 'japan', 'south korea'];
  if (farCountries.some(c => combined.includes(c))) return 0.30;
  return 0.5;
}

// ─── Encode Product → 40d Feature Vector ─────────────────────────

function encodeProduct(product) {
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
  let packMaterialScore;
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
  const novaScore = (nova !== null && nova !== undefined) ? Math.max(0, Math.min(1, 1 - ((nova - 1) / 3))) : 0.5;

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
  const hasLocal = localKw.some(kw => originTags.some(t => t.toLowerCase().includes(kw)) || originText.includes(kw)) ? 1 : 0;

  const cats = product.categories_tags;

  const features = [
    // === CATEGORY ANALYSIS (1 feature: data-driven score) ===
    encodeCategoryScore(cats),                                    // [0]

    // === PROCESSING LEVEL (3) ===
    novaScore,                                                    // [1]
    nova === 4 ? 1 : 0,                                         // [2] isUltraProcessed
    ingredientComplexity,                                         // [3]

    // === PACKAGING (6) ===
    plasticKw.some(kw => packTags.some(t => t.includes(kw))) ? 1 : 0,  // [4]
    glassKw.some(kw => packTags.some(t => t.includes(kw))) ? 1 : 0,    // [5]
    cardboardKw.some(kw => packTags.some(t => t.includes(kw))) ? 1 : 0, // [6]
    metalKw.some(kw => packTags.some(t => t.includes(kw))) ? 1 : 0,    // [7]
    compostKw.some(kw => packTags.some(t => t.includes(kw))) ? 1 : 0,  // [8]
    packMaterialScore,                                            // [9]

    // === CERTIFICATIONS (6) ===
    hasExactTag(labels, ORGANIC_TAGS) ? 1 : 0,                   // [10]
    hasExactTag(labels, FAIRTRADE_TAGS) ? 1 : 0,                 // [11]
    hasExactTag(labels, RAINFOREST_TAGS) ? 1 : 0,                // [12]
    hasExactTag(labels, EU_ECOLABEL_TAGS) ? 1 : 0,               // [13]
    hasExactTag(labels, MSC_TAGS) ? 1 : 0,                       // [14]
    Math.min(certCount / 5, 1),                                   // [15]

    // === ORIGIN (4) ===
    encodeOriginFromTagsAndText(product.origins_tags, product.origins, ORIGIN_SUSTAINABILITY), // [16]
    hasLocal,                                                     // [17]
    encodeTransportEstimate(product),                             // [18]
    encodeOriginFromTagsAndText(product.manufacturing_places_tags, product.manufacturing_places, ORIGIN_SUSTAINABILITY), // [19]

    // === INGREDIENT ANALYSIS (6) ===
    isVegan,                                                      // [20]
    isVegetarian,                                                 // [21]
    hasPalmOil,                                                   // [22]
    hasHighSugar,                                                 // [23]
    hasHighSatFat,                                                // [24]
    hasHighSodium,                                                // [25]

    // === NUTRIENT LEVELS (2, new) ===
    hasTag(nutrient, 'fat-in-high-quantity') ? 1 : 0,            // [26]
    hasTag(nutrient, 'fat-in-low-quantity') ? 1 : 0,             // [27]

    // === FOOD GROUP BINARY FEATURES (12, new) ===
    hasFoodGroup(cats, MEAT_TAGS),                                // [28]
    hasFoodGroup(cats, FISH_TAGS),                                // [29]
    hasFoodGroup(cats, DAIRY_TAGS),                               // [30]
    hasFoodGroup(cats, PLANT_BASED_TAGS),                         // [31]
    hasFoodGroup(cats, FRUIT_VEG_TAGS),                           // [32]
    hasFoodGroup(cats, CEREAL_TAGS),                              // [33]
    hasFoodGroup(cats, BEVERAGE_TAGS),                            // [34]
    hasFoodGroup(cats, FAT_OIL_TAGS),                             // [35]
    hasFoodGroup(cats, SWEET_TAGS),                               // [36]
    hasFoodGroup(cats, CANNED_TAGS),                              // [37]
    hasFoodGroup(cats, FROZEN_TAGS),                              // [38]
    hasFoodGroup(cats, READY_MEAL_TAGS),                          // [39]
  ];

  // Clamp all values
  for (let i = 0; i < features.length; i++) {
    if (isNaN(features[i])) features[i] = 0.5;
    features[i] = Math.max(0, Math.min(1, features[i]));
  }

  return features;
}

// ─── Model Architecture ─────────────────────────────────────────

function buildModel(config) {
  const model = tf.sequential();

  // Layer 1: 40 → 256 with BatchNorm + L2
  model.add(tf.layers.dense({
    inputShape: [NUM_FEATURES],
    units: 256,
    activation: 'linear',
    kernelInitializer: 'heNormal',
    kernelRegularizer: tf.regularizers.l2({ l2: config.l2Reg }),
    name: 'hidden1',
  }));
  model.add(tf.layers.batchNormalization({ name: 'bn1' }));
  model.add(tf.layers.activation({ activation: 'relu', name: 'relu1' }));
  model.add(tf.layers.dropout({ rate: config.dropoutRate1, name: 'dropout1' }));

  // Layer 2: 256 → 128 with BatchNorm + L2
  model.add(tf.layers.dense({
    units: 128,
    activation: 'linear',
    kernelInitializer: 'heNormal',
    kernelRegularizer: tf.regularizers.l2({ l2: config.l2Reg }),
    name: 'hidden2',
  }));
  model.add(tf.layers.batchNormalization({ name: 'bn2' }));
  model.add(tf.layers.activation({ activation: 'relu', name: 'relu2' }));
  model.add(tf.layers.dropout({ rate: config.dropoutRate2, name: 'dropout2' }));

  // Layer 3: 128 → 64 with BatchNorm
  model.add(tf.layers.dense({
    units: 64,
    activation: 'linear',
    kernelInitializer: 'heNormal',
    name: 'hidden3',
  }));
  model.add(tf.layers.batchNormalization({ name: 'bn3' }));
  model.add(tf.layers.activation({ activation: 'relu', name: 'relu3' }));

  // Output: 64 → 1
  model.add(tf.layers.dense({
    units: 1,
    activation: 'sigmoid',
    kernelInitializer: 'glorotUniform',
    name: 'output',
  }));

  model.compile({
    optimizer: tf.train.adam(config.learningRate),
    loss: 'meanSquaredError',
    metrics: ['mae'],
  });

  return model;
}

// ─── Convert TF.js weights to pure-TS format (4 layers) ─────────

function extractWeightsForPureTS(model) {
  const layerWeights = {};
  for (const layer of model.layers) {
    const ws = layer.getWeights();
    if (ws.length === 2 && layer.name.startsWith('hidden') || layer.name === 'output') {
      // Dense layer: kernel + bias
      layerWeights[layer.name] = {
        kernel: ws[0].arraySync(),
        bias: ws[1].arraySync(),
      };
    } else if (ws.length === 4 && layer.name.startsWith('bn')) {
      // BatchNorm: gamma, beta, moving_mean, moving_variance
      layerWeights[layer.name] = {
        gamma: ws[0].arraySync(),
        beta: ws[1].arraySync(),
        movingMean: ws[2].arraySync(),
        movingVariance: ws[3].arraySync(),
      };
    }
  }

  return {
    W1: layerWeights['hidden1'].kernel,  // [40][256]
    b1: layerWeights['hidden1'].bias,    // [256]
    bn1: layerWeights['bn1'],            // gamma, beta, movingMean, movingVariance [256]
    W2: layerWeights['hidden2'].kernel,  // [256][128]
    b2: layerWeights['hidden2'].bias,    // [128]
    bn2: layerWeights['bn2'],            // [128]
    W3: layerWeights['hidden3'].kernel,  // [128][64]
    b3: layerWeights['hidden3'].bias,    // [64]
    bn3: layerWeights['bn3'],            // [64]
    W4: layerWeights['output'].kernel,   // [64][1]
    b4: layerWeights['output'].bias,     // [1]
  };
}

// ─── Accuracy Metrics ────────────────────────────────────────────

function computeAccuracyMetrics(model, valXTensor, valY) {
  const predictions = model.predict(valXTensor).arraySync().flat();
  const n = valY.length;
  const yMean = valY.reduce((s, v) => s + v, 0) / n;

  let sumSqErr = 0, sumAbsErr = 0, ssTot = 0;
  let within5 = 0, within10 = 0, within15 = 0, within20 = 0;

  for (let i = 0; i < n; i++) {
    const pred = predictions[i];
    const actual = valY[i];
    const diff100 = Math.abs(pred * 100 - actual * 100);

    sumSqErr += (pred - actual) ** 2;
    sumAbsErr += Math.abs(pred - actual);
    ssTot += (actual - yMean) ** 2;

    if (diff100 <= 5) within5++;
    if (diff100 <= 10) within10++;
    if (diff100 <= 15) within15++;
    if (diff100 <= 20) within20++;
  }

  return {
    mse: sumSqErr / n,
    rmse: Math.sqrt(sumSqErr / n),
    mae: sumAbsErr / n,
    rSquared: ssTot > 0 ? 1 - (sumSqErr / ssTot) : 0,
    accuracyAtTolerance5: (within5 / n) * 100,
    accuracyAtTolerance10: (within10 / n) * 100,
    accuracyAtTolerance15: (within15 / n) * 100,
    accuracyAtTolerance20: (within20 / n) * 100,
    sampleCount: n,
  };
}

// ─── Early Stopping ─────────────────────────────────────────────

class EarlyStoppingCallback {
  constructor(patience = 25, minDelta = 0.0005) {
    this.patience = patience;
    this.minDelta = minDelta;
    this.bestLoss = Infinity;
    this.wait = 0;
    this.stopped = false;
    this.bestEpoch = 0;
  }

  check(epoch, valLoss) {
    if (valLoss < this.bestLoss - this.minDelta) {
      this.bestLoss = valLoss;
      this.wait = 0;
      this.bestEpoch = epoch;
    } else {
      this.wait++;
    }
    return this.wait >= this.patience;
  }
}

// ─── Main Training Pipeline ─────────────────────────────────────

async function main() {
  await tf.setBackend('wasm');
  await tf.ready();
  console.log(`🚀 Backend: ${tf.getBackend().toUpperCase()}`);

  const config = parseArgs();

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║        ECOTRACE Model Training v3.0              ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Architecture: ${NUM_FEATURES} → 128(+D) → 64(+D) → 32 → 1  ║`);
  console.log(`║  Optimizer:    Adam (lr=${config.learningRate})              ║`);
  console.log(`║  Loss:         MSE + L2 (${config.l2Reg})             ║`);
  console.log(`║  Epochs:       ${String(config.epochs).padEnd(5)} (early stop: patience=${config.patience})  ║`);
  console.log(`║  Batch:        ${String(config.batchSize).padEnd(5)} | Dropout: ${config.dropoutRate1}/${config.dropoutRate2}      ║`);
  console.log(`║  Features:     ${NUM_FEATURES} (data-driven cats + groups)   ║`);
  console.log('╚══════════════════════════════════════════════════╝\n');

  // 1. Load data
  if (!fs.existsSync(config.dataPath)) {
    console.error(`❌ Training data not found at: ${config.dataPath}`);
    console.error('   Run "npm run fetch-training-data" first.');
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(config.dataPath, 'utf-8'));
  const products = rawData.products || rawData;
  console.log(`📦 Loaded ${products.length} products from ${config.dataPath}`);

  // 2. Filter valid products
  const validProducts = products.filter(p =>
    p.ecoscore_score !== undefined &&
    p.ecoscore_score !== null &&
    typeof p.ecoscore_score === 'number' &&
    p.ecoscore_score >= 0 &&
    p.ecoscore_score <= 100 &&
    p.categories_tags &&
    p.categories_tags.length > 0
  );
  console.log(`✅ ${validProducts.length} products have valid ecoscore + categories`);

  if (validProducts.length < 50) {
    console.error('❌ Insufficient valid products.');
    process.exit(1);
  }

  // 3. Encode features and labels
  const features = [];
  const labelsArr = [];
  let skipped = 0;

  for (const product of validProducts) {
    try {
      const encoded = encodeProduct(product);
      const label = Math.max(0, Math.min(1, product.ecoscore_score / 100));

      if (encoded.length !== NUM_FEATURES) { skipped++; continue; }
      if (encoded.some(f => isNaN(f)) || isNaN(label)) { skipped++; continue; }

      features.push(encoded);
      labelsArr.push(label);
    } catch (e) {
      skipped++;
    }
  }

  console.log(`🔢 Encoded ${features.length} feature vectors (${NUM_FEATURES}D) (skipped ${skipped})`);

  // 4. Shuffle data
  const indices = Array.from({ length: features.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const shuffledFeatures = indices.map(i => features[i]);
  const shuffledLabels = indices.map(i => labelsArr[i]);

  // 5. Three-way split: train / validation / test
  const testIdx = Math.floor(shuffledFeatures.length * (1 - config.testSplit));
  const valIdx = Math.floor(testIdx * (1 - config.validationSplit / (1 - config.testSplit)));

  const trainX = shuffledFeatures.slice(0, valIdx);
  const trainY = shuffledLabels.slice(0, valIdx);
  const valX = shuffledFeatures.slice(valIdx, testIdx);
  const valY = shuffledLabels.slice(valIdx, testIdx);
  const testX = shuffledFeatures.slice(testIdx);
  const testY = shuffledLabels.slice(testIdx);

  console.log(`📊 Train: ${trainX.length} | Validation: ${valX.length} | Test: ${testX.length}`);

  // 5b. Z-score normalization: compute mean & std from training set only
  const featureMeans = new Array(NUM_FEATURES).fill(0);
  const featureStds = new Array(NUM_FEATURES).fill(0);

  for (let f = 0; f < NUM_FEATURES; f++) {
    let sum = 0;
    for (let i = 0; i < trainX.length; i++) sum += trainX[i][f];
    featureMeans[f] = sum / trainX.length;
  }
  for (let f = 0; f < NUM_FEATURES; f++) {
    let sumSq = 0;
    for (let i = 0; i < trainX.length; i++) {
      const diff = trainX[i][f] - featureMeans[f];
      sumSq += diff * diff;
    }
    featureStds[f] = Math.sqrt(sumSq / trainX.length);
    if (featureStds[f] < 1e-8) featureStds[f] = 1; // avoid division by zero for constant features
  }

  // Apply normalization to all splits
  function normalizeFeatures(data) {
    return data.map(row => row.map((v, f) => (v - featureMeans[f]) / featureStds[f]));
  }

  const normTrainX = normalizeFeatures(trainX);
  const normValX = normalizeFeatures(valX);
  const normTestX = normalizeFeatures(testX);

  console.log(`📐 Z-score normalization applied (mean/std from training set)\n`);

  // 6. Create tensors
  const trainXTensor = tf.tensor2d(normTrainX);
  const trainYTensor = tf.tensor2d(trainY, [trainY.length, 1]);
  const valXTensor = tf.tensor2d(normValX);
  const valYTensor = tf.tensor2d(valY, [valY.length, 1]);

  // 7. Build model
  const model = buildModel(config);
  model.summary();
  console.log('');

  // 8. Train with early stopping
  const startTime = Date.now();
  const earlyStopping = new EarlyStoppingCallback(config.patience, config.minDelta);
  let stoppedEarly = false;
  let finalEpoch = config.epochs;

  await model.fit(trainXTensor, trainYTensor, {
    epochs: config.epochs,
    batchSize: config.batchSize,
    validationData: [valXTensor, valYTensor],
    shuffle: true,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        if ((epoch + 1) % 10 === 0 || epoch === 0) {
          const loss = logs.loss.toFixed(6);
          const valLoss = logs.val_loss.toFixed(6);
          const mae = logs.mae.toFixed(6);
          console.log(`  Epoch ${String(epoch + 1).padStart(3)}/${config.epochs}  loss: ${loss}  val_loss: ${valLoss}  mae: ${mae}`);
        }

        if (earlyStopping.check(epoch, logs.val_loss)) {
          model.stopTraining = true;
          stoppedEarly = true;
          finalEpoch = epoch + 1;
          console.log(`\n  ⏹️  Early stopping at epoch ${epoch + 1} (best: epoch ${earlyStopping.bestEpoch + 1}, val_loss: ${earlyStopping.bestLoss.toFixed(6)})`);
        }
      },
    },
  });

  const trainingTime = ((Date.now() - startTime) / 1000).toFixed(1);
  if (!stoppedEarly) {
    console.log(`\n⏱️  Training completed in ${trainingTime}s (all ${config.epochs} epochs)`);
  } else {
    console.log(`⏱️  Training completed in ${trainingTime}s (stopped at epoch ${finalEpoch})`);
  }

  // 9. Evaluate on VALIDATION set
  const valMetrics = computeAccuracyMetrics(model, valXTensor, valY);

  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║    Validation Set Accuracy               ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  MSE:              ${valMetrics.mse.toFixed(6).padStart(18)}  ║`);
  console.log(`║  RMSE:             ${valMetrics.rmse.toFixed(6).padStart(18)}  ║`);
  console.log(`║  MAE:              ${valMetrics.mae.toFixed(6).padStart(18)}  ║`);
  console.log(`║  R²:               ${valMetrics.rSquared.toFixed(6).padStart(18)}  ║`);
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Within ±5 pts:    ${(valMetrics.accuracyAtTolerance5.toFixed(1) + '%').padStart(18)}  ║`);
  console.log(`║  Within ±10 pts:   ${(valMetrics.accuracyAtTolerance10.toFixed(1) + '%').padStart(18)}  ║`);
  console.log(`║  Within ±15 pts:   ${(valMetrics.accuracyAtTolerance15.toFixed(1) + '%').padStart(18)}  ║`);
  console.log(`║  Within ±20 pts:   ${(valMetrics.accuracyAtTolerance20.toFixed(1) + '%').padStart(18)}  ║`);
  console.log('╚══════════════════════════════════════════╝');

  // 10. Evaluate on TEST set
  const testXTensor = tf.tensor2d(normTestX);
  const testMetrics = computeAccuracyMetrics(model, testXTensor, testY);

  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║    Test Set Accuracy (holdout)           ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  MSE:              ${testMetrics.mse.toFixed(6).padStart(18)}  ║`);
  console.log(`║  RMSE:             ${testMetrics.rmse.toFixed(6).padStart(18)}  ║`);
  console.log(`║  MAE:              ${testMetrics.mae.toFixed(6).padStart(18)}  ║`);
  console.log(`║  R²:               ${testMetrics.rSquared.toFixed(6).padStart(18)}  ║`);
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Within ±5 pts:    ${(testMetrics.accuracyAtTolerance5.toFixed(1) + '%').padStart(18)}  ║`);
  console.log(`║  Within ±10 pts:   ${(testMetrics.accuracyAtTolerance10.toFixed(1) + '%').padStart(18)}  ║`);
  console.log(`║  Within ±15 pts:   ${(testMetrics.accuracyAtTolerance15.toFixed(1) + '%').padStart(18)}  ║`);
  console.log(`║  Within ±20 pts:   ${(testMetrics.accuracyAtTolerance20.toFixed(1) + '%').padStart(18)}  ║`);
  console.log('╚══════════════════════════════════════════╝');

  // 11. Sample predictions
  console.log('\n📋 Sample Predictions (Test Set):');
  console.log('─'.repeat(65));
  console.log('  Product                         Actual  Predicted  Error');
  console.log('─'.repeat(65));

  const testPreds = model.predict(testXTensor).arraySync().flat();
  const sampleIndices = [];
  for (let i = 0; i < Math.min(10, testX.length); i++) {
    sampleIndices.push(Math.floor(i * testX.length / 10));
  }

  const testProductIndices = indices.slice(testIdx);
  for (const idx of sampleIndices) {
    const origIdx = testProductIndices[idx];
    const product = validProducts[origIdx];
    const name = (product?.product_name || 'Unknown').substring(0, 30).padEnd(30);
    const actual = Math.round(testY[idx] * 100);
    const predicted = Math.round(testPreds[idx] * 100);
    const error = predicted - actual;
    const errorStr = (error >= 0 ? '+' : '') + error;
    console.log(`  ${name}  ${String(actual).padStart(5)}   ${String(predicted).padStart(5)}     ${errorStr.padStart(4)}`);
  }
  console.log('─'.repeat(65));

  // 12. Extract weights
  const pureTSWeights = extractWeightsForPureTS(model);
  // Include normalization stats for inference
  pureTSWeights.featureMeans = featureMeans;
  pureTSWeights.featureStds = featureStds;

  // 13. Save outputs
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  }

  const weightsPath = path.join(config.outputDir, 'weights.json');
  fs.writeFileSync(weightsPath, JSON.stringify(pureTSWeights, null, 2));
  console.log(`\n💾 Weights saved to:   ${weightsPath}`);

  const totalParams = pureTSWeights.W1.length * pureTSWeights.W1[0].length + pureTSWeights.b1.length +
    pureTSWeights.W2.length * pureTSWeights.W2[0].length + pureTSWeights.b2.length +
    pureTSWeights.W3.length * pureTSWeights.W3[0].length + pureTSWeights.b3.length +
    pureTSWeights.W4.length * pureTSWeights.W4[0].length + pureTSWeights.b4.length;

  const FEATURE_NAMES = [
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
  ];

  const metadataObj = {
    version: '4.0',
    architecture: `${NUM_FEATURES}→256→128→64→1`,
    totalParameters: totalParams,
    optimizer: 'Adam',
    learningRate: config.learningRate,
    lossFunction: 'MSE + L2',
    l2Regularization: config.l2Reg,
    dropout: [config.dropoutRate1, config.dropoutRate2],
    activations: ['ReLU', 'ReLU', 'ReLU', 'Sigmoid'],
    trainedAt: new Date().toISOString(),
    trainingTimeSeconds: parseFloat(trainingTime),
    epochs: stoppedEarly ? finalEpoch : config.epochs,
    maxEpochs: config.epochs,
    earlyStopping: stoppedEarly,
    batchSize: config.batchSize,
    trainingSamples: trainX.length,
    validationSamples: valX.length,
    testSamples: testX.length,
    totalProducts: features.length,
    validationAccuracy: valMetrics,
    testAccuracy: testMetrics,
    features: FEATURE_NAMES,
    target: 'ecoscore_score (normalized 0-1)',
    implementation: 'TF.js training (WASM) → pure TypeScript inference (Hermes-safe)',
  };

  fs.writeFileSync(config.metadataPath, JSON.stringify(metadataObj, null, 2));
  console.log(`📋 Metadata saved to: ${config.metadataPath}`);

  // Save test set for evaluation (normalized features)
  const testSetPath = path.join(config.outputDir, 'testSet.json');
  fs.writeFileSync(testSetPath, JSON.stringify({
    features: normTestX,
    labels: testY,
    productNames: testProductIndices.map(i => validProducts[i]?.product_name || 'Unknown'),
    ecoscore_grades: testProductIndices.map(i => validProducts[i]?.ecoscore_grade || ''),
  }));
  console.log(`🧪 Test set saved to: ${testSetPath}`);

  try {
    const tfjsModelPath = `file://${config.outputDir.replace(/\\/g, '/')}`;
    await model.save(tfjsModelPath);
    console.log(`🤖 TF.js model saved to: ${config.outputDir}/`);
  } catch (err) {
    console.log(`⚠️  TF.js model save skipped (requires @tensorflow/tfjs-node)`);
  }

  console.log('\n✅ Training pipeline complete!');
  console.log(`   ${features.length} products → ${NUM_FEATURES} features → ${totalParams} parameters`);
  console.log('   The pure-TS weights (weights.json) will be used for on-device inference.\n');

  trainXTensor.dispose();
  trainYTensor.dispose();
  valXTensor.dispose();
  valYTensor.dispose();
  testXTensor.dispose();
}

main().catch(err => {
  console.error('❌ Training failed:', err);
  process.exit(1);
});
