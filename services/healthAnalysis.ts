// services/healthAnalysis.ts

import type { OFFProduct } from './openFoodFacts';
import type { UserPreferences, DietaryFlag } from '@/types/userPreferences';
import type { HealthAnalysis, NutrientFact } from '@/types/product';

// Maps dietary flags to the allergen/ingredient tags that indicate the product
// violates that preference (i.e. NOT suitable for that diet).
const DIET_VIOLATION_KEYWORDS: Record<DietaryFlag, string[]> = {
  is_vegan: ['en:non-vegan', 'meat', 'dairy', 'egg', 'honey', 'gelatin', 'whey', 'casein', 'lactose'],
  is_vegetarian: ['en:non-vegetarian', 'meat', 'beef', 'pork', 'chicken', 'gelatin', 'lard'],
  is_gluten_free: ['en:contains-gluten', 'wheat', 'barley', 'rye', 'spelt', 'gluten'],
  is_keto: ['sugar', 'corn syrup', 'maltodextrin', 'dextrose', 'rice', 'flour'],
  is_dairy_free: ['en:contains-milk', 'milk', 'dairy', 'lactose', 'whey', 'casein', 'cheese', 'cream', 'butter'],
  is_halal: ['en:non-halal', 'pork', 'lard', 'gelatin', 'alcohol', 'wine'],
  is_kosher: ['en:non-kosher', 'pork', 'shellfish', 'non-kosher'],
  is_low_sugar: ['sugar', 'high fructose corn syrup', 'corn syrup', 'sucrose', 'glucose'],
};

// Maps dietary flags to the OFacts tags that confirm the product IS suitable.
const DIET_MATCH_TAGS: Record<DietaryFlag, string[]> = {
  is_vegan: ['en:vegan'],
  is_vegetarian: ['en:vegetarian'],
  is_gluten_free: ['en:gluten-free'],
  is_keto: [],
  is_dairy_free: ['en:dairy-free'],
  is_halal: ['en:halal'],
  is_kosher: ['en:kosher'],
  is_low_sugar: ['en:no-added-sugar', 'en:low-sugar'],
};

const DIET_DISPLAY_NAMES: Record<DietaryFlag, string> = {
  is_vegan: 'Vegan',
  is_vegetarian: 'Vegetarian',
  is_gluten_free: 'Gluten-Free',
  is_keto: 'Keto',
  is_dairy_free: 'Dairy-Free',
  is_halal: 'Halal',
  is_kosher: 'Kosher',
  is_low_sugar: 'Low Sugar',
};

const ALLERGEN_SYNONYMS: Record<string, string[]> = {
  milk: ['dairy', 'lactose', 'whey', 'casein', 'cheese', 'cream', 'butter'],
  egg: ['eggs', 'albumen', 'ovalbumin'],
  peanuts: ['peanut', 'groundnut'],
  'tree nuts': ['almond', 'walnut', 'cashew', 'hazelnut', 'pistachio', 'pecan', 'macadamia', 'brazil nut'],
  soy: ['soya', 'soybean', 'lecithin'],
  wheat: ['gluten', 'barley', 'rye', 'spelt', 'malt'],
  fish: ['salmon', 'tuna', 'cod', 'anchovy'],
  shellfish: ['shrimp', 'prawn', 'crab', 'lobster', 'mollusc', 'mussel', 'clam', 'oyster', 'scallop'],
  sesame: ['tahini'],
  mustard: ['mustard'],
  celery: ['celery'],
  lupin: ['lupin'],
  sulphites: ['sulfite', 'sulphite', 'sulfur dioxide', 'sodium metabisulfite'],
  alcohol: ['ethanol', 'wine', 'beer', 'rum', 'vodka', 'whiskey', 'liqueur', 'brandy'],
};

const NUTRIENT_FACTS_CONFIG: Array<{
  key: string;
  label: string;
  valueKeys: string[];
  unitKey?: string;
  defaultUnit: string;
}> = [
  { key: 'energy', label: 'Calories', valueKeys: ['energy-kcal_100g', 'energy-kcal'], unitKey: 'energy-kcal_unit', defaultUnit: 'kcal' },
  { key: 'fat', label: 'Total Fat', valueKeys: ['fat_100g', 'fat'], unitKey: 'fat_unit', defaultUnit: 'g' },
  { key: 'saturated-fat', label: 'Saturated Fat', valueKeys: ['saturated-fat_100g', 'saturated-fat'], unitKey: 'saturated-fat_unit', defaultUnit: 'g' },
  { key: 'carbohydrates', label: 'Carbs', valueKeys: ['carbohydrates_100g', 'carbohydrates'], unitKey: 'carbohydrates_unit', defaultUnit: 'g' },
  { key: 'sugars', label: 'Sugars', valueKeys: ['sugars_100g', 'sugars'], unitKey: 'sugars_unit', defaultUnit: 'g' },
  { key: 'fiber', label: 'Fiber', valueKeys: ['fiber_100g', 'fiber'], unitKey: 'fiber_unit', defaultUnit: 'g' },
  { key: 'proteins', label: 'Protein', valueKeys: ['proteins_100g', 'proteins'], unitKey: 'proteins_unit', defaultUnit: 'g' },
  { key: 'salt', label: 'Salt', valueKeys: ['salt_100g', 'salt'], unitKey: 'salt_unit', defaultUnit: 'g' },
  { key: 'sodium', label: 'Sodium', valueKeys: ['sodium_100g', 'sodium'], unitKey: 'sodium_unit', defaultUnit: 'g' },
  { key: 'cholesterol', label: 'Cholesterol', valueKeys: ['cholesterol_100g', 'cholesterol'], unitKey: 'cholesterol_unit', defaultUnit: 'mg' },
  { key: 'vitamin-a', label: 'Vitamin A', valueKeys: ['vitamin-a_100g', 'vitamin-a'], unitKey: 'vitamin-a_unit', defaultUnit: 'ug' },
  { key: 'vitamin-c', label: 'Vitamin C', valueKeys: ['vitamin-c_100g', 'vitamin-c'], unitKey: 'vitamin-c_unit', defaultUnit: 'mg' },
  { key: 'vitamin-d', label: 'Vitamin D', valueKeys: ['vitamin-d_100g', 'vitamin-d'], unitKey: 'vitamin-d_unit', defaultUnit: 'ug' },
  { key: 'calcium', label: 'Calcium', valueKeys: ['calcium_100g', 'calcium'], unitKey: 'calcium_unit', defaultUnit: 'mg' },
  { key: 'iron', label: 'Iron', valueKeys: ['iron_100g', 'iron'], unitKey: 'iron_unit', defaultUnit: 'mg' },
  { key: 'potassium', label: 'Potassium', valueKeys: ['potassium_100g', 'potassium'], unitKey: 'potassium_unit', defaultUnit: 'mg' },
];

function normalizeAllergen(allergen: string): string {
  return allergen.trim().toLowerCase();
}

function getAllergenKeywords(allergen: string): string[] {
  const key = normalizeAllergen(allergen);
  const synonyms = ALLERGEN_SYNONYMS[key] ?? [];
  return Array.from(new Set([key, ...synonyms]));
}

function getNutrimentNumber(
  nutriments: Record<string, number | string | null | undefined> | undefined,
  key: string
): number | undefined {
  if (!nutriments) return undefined;
  const raw = nutriments[key];
  if (raw === undefined || raw === null || raw === '') return undefined;
  const value = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function buildNutrientFacts(
  nutriments: Record<string, number | string | null | undefined> | undefined
): NutrientFact[] {
  const facts: NutrientFact[] = [];
  for (const config of NUTRIENT_FACTS_CONFIG) {
    let amount: number | undefined;
    for (const key of config.valueKeys) {
      amount = getNutrimentNumber(nutriments, key);
      if (amount !== undefined) break;
    }
    if (amount === undefined) continue;
    const unit = (config.unitKey && typeof nutriments?.[config.unitKey] === 'string')
      ? String(nutriments?.[config.unitKey])
      : config.defaultUnit;
    const rounded = Math.round(amount * 10) / 10;
    facts.push({
      key: config.key,
      label: config.label,
      amount: rounded,
      unit,
      per: '100g',
    });
  }
  return facts;
}

export function analyseProductHealth(
  product: OFFProduct,
  prefs: UserPreferences
): HealthAnalysis {
  const ingredientsLower = (product.ingredients_text ?? '').toLowerCase();
  const allTags = [
    ...(product.allergens_tags ?? []),
    ...(product.ingredients_analysis_tags ?? []),
  ].map(t => t.toLowerCase());

  // ── 1. Allergen check (always runs regardless of health_consciousness_level) ──
  const flaggedIngredients: string[] = [];
  for (const allergen of prefs.allergens) {
    const keywords = getAllergenKeywords(allergen);
    const inIngredients = keywords.some(keyword => ingredientsLower.includes(keyword));
    const inTags = keywords.some(keyword => allTags.some(tag => tag.includes(keyword)));
    if (inIngredients || inTags) {
      flaggedIngredients.push(allergen);
    }
  }

  // ── 2. Nutritional warning (medium / high only) ──
  let nutritionalWarning: string | undefined;
  const nova = product.nova_group ?? 0;
  const nutri = (product.nutriscore_grade ?? '').toLowerCase();
  const isUltraProcessed = nova === 4;
  const isHighlyProcessed = nova === 3 && prefs.healthConsciousnessLevel === 'high';
  const isPoorNutriScore = ['d', 'e'].includes(nutri);
  const isVeryPoorNutriScore = nutri === 'e' && prefs.healthConsciousnessLevel === 'high';
  const nutrientTags = (product.nutrient_levels_tags ?? []).map(t => t.toLowerCase());
  const hasHighSalt = nutrientTags.some(t => t.includes('high-salt') || t.includes('high-sodium'));
  const hasHighSugar = nutrientTags.some(t => t.includes('high-sugar'));
  const hasHighFat = nutrientTags.some(t => t.includes('high-fat'));
  const hasHighSatFat = nutrientTags.some(t => t.includes('high-saturated-fat'));

  if (prefs.healthConsciousnessLevel !== 'low') {
    if (isUltraProcessed && isPoorNutriScore) {
      nutritionalWarning = `Ultra-Processed (NOVA ${nova}) · Nutri-Score ${nutri.toUpperCase()}`;
    } else if (isUltraProcessed) {
      nutritionalWarning = `Ultra-Processed Food (NOVA ${nova})`;
    } else if (isHighlyProcessed) {
      nutritionalWarning = `Highly Processed (NOVA ${nova})`;
    } else if (isVeryPoorNutriScore) {
      nutritionalWarning = `Poor Nutritional Score (${nutri.toUpperCase()})`;
    } else if (isPoorNutriScore) {
      nutritionalWarning = `Low Nutri-Score (${nutri.toUpperCase()})`;
    }
  }

  // ── 3. Positive dietary match ──
  const matchedDiets: string[] = [];
  const activeFlags = (Object.entries(prefs.dietaryFlags) as [DietaryFlag, boolean][])
    .filter(([, v]) => v)
    .map(([k]) => k);

  for (const flag of activeFlags) {
    const matchTags = DIET_MATCH_TAGS[flag];
    const violationKeywords = DIET_VIOLATION_KEYWORDS[flag];

    const hasPositiveTag = matchTags.length > 0 && matchTags.some(tag => allTags.includes(tag));
    const hasViolation = violationKeywords.some(kw => ingredientsLower.includes(kw) || allTags.some(t => t.includes(kw)));

    if (hasPositiveTag && !hasViolation) {
      matchedDiets.push(DIET_DISPLAY_NAMES[flag]);
    }
  }

  // ── 4. Determine overall match for user ──
  const hasAllergenHit = flaggedIngredients.length > 0;
  const hasWarning = !!nutritionalWarning;
  const shouldHideMatches = prefs.healthConsciousnessLevel === 'low' && !hasAllergenHit;
  const visibleMatches = shouldHideMatches ? [] : matchedDiets;
  const isMatchForUser = !hasAllergenHit && !hasWarning;
  const nutrientFacts = buildNutrientFacts(product.nutriments);

  const reasons: string[] = [];
  if (hasAllergenHit) {
    reasons.push(`Allergen: ${flaggedIngredients.join(', ')}`);
  }
  if (hasWarning) {
    if (isUltraProcessed) reasons.push(`NOVA ${nova}: ultra-processed`);
    if (isHighlyProcessed) reasons.push(`NOVA ${nova}: processed`);
    if (isPoorNutriScore) reasons.push(`Nutri-Score ${nutri.toUpperCase()}`);
    if (hasHighSalt) reasons.push('High sodium');
    if (hasHighSugar) reasons.push('High sugar');
    if (hasHighSatFat) reasons.push('High saturated fat');
    if (hasHighFat) reasons.push('High fat');
    const ingredientCount = (product.ingredients_text ?? '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean).length;
    if (ingredientCount >= 10) reasons.push(`Long ingredient list (${ingredientCount})`);
  }
  if (!hasAllergenHit && !hasWarning && visibleMatches.length > 0) {
    reasons.push(...visibleMatches.map(match => `Matches ${match}`));
  }

  let guidance: string | undefined;
  if (hasAllergenHit) {
    guidance = 'If you are sensitive to these ingredients, consider avoiding this product.';
  } else if (hasWarning) {
    const guidanceParts: string[] = [];
    if (isUltraProcessed || isHighlyProcessed) {
      guidanceParts.push('Frequent intake of highly processed foods can reduce overall diet quality.');
    }
    if (isPoorNutriScore) {
      guidanceParts.push('Low Nutri-Score items are often higher in sugar, salt, or saturated fat.');
    }
    if (hasHighSalt) {
      guidanceParts.push('High sodium can make it harder to stay within daily sodium targets.');
    }
    if (hasHighSugar) {
      guidanceParts.push('High sugar can make it harder to stay within daily added sugar targets.');
    }
    if (hasHighSatFat || hasHighFat) {
      guidanceParts.push('High fat items are best balanced with whole, minimally processed foods.');
    }
    guidanceParts.push('Consider moderating intake or balancing with minimally processed foods.');
    guidance = guidanceParts.join(' ');
  } else if (visibleMatches.length > 0) {
    guidance = 'Based on available tags. Always double-check the label for confirmation.';
  }

  return {
    isMatchForUser,
    flaggedIngredients,
    nutritionalWarning,
    matchedDiets: visibleMatches,
    reasons: reasons.length > 0 ? reasons : undefined,
    guidance,
    nutrientFacts: nutrientFacts.length > 0 ? nutrientFacts : undefined,
    processingLevel: product.nova_group ?? 0,
    nutriScore: (product.nutriscore_grade ?? '').toUpperCase() || undefined,
  };
}
