// types/userPreferences.ts

export type HealthConsciousnessLevel = 'low' | 'medium' | 'high';

export type DietaryFlag =
  | 'is_vegan'
  | 'is_vegetarian'
  | 'is_gluten_free'
  | 'is_keto'
  | 'is_dairy_free'
  | 'is_halal'
  | 'is_kosher'
  | 'is_low_sugar';

export interface UserPreferences {
  hasCompletedHealthOnboarding: boolean;
  dietaryFlags: Record<DietaryFlag, boolean>;
  allergens: string[]; // lowercase, e.g. ['peanuts', 'dairy', 'shellfish']
  healthConsciousnessLevel: HealthConsciousnessLevel;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  hasCompletedHealthOnboarding: false,
  dietaryFlags: {
    is_vegan: false,
    is_vegetarian: false,
    is_gluten_free: false,
    is_keto: false,
    is_dairy_free: false,
    is_halal: false,
    is_kosher: false,
    is_low_sugar: false,
  },
  allergens: [],
  healthConsciousnessLevel: 'medium',
};

export const DIETARY_LABELS: Record<DietaryFlag, string> = {
  is_vegan: 'Vegan',
  is_vegetarian: 'Vegetarian',
  is_gluten_free: 'Gluten-Free',
  is_keto: 'Keto',
  is_dairy_free: 'Dairy-Free',
  is_halal: 'Halal',
  is_kosher: 'Kosher',
  is_low_sugar: 'Low Sugar',
};
