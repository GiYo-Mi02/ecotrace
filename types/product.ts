// types/product.ts — Single source of truth for all product-related types
// Replaces the types previously scattered in data/mockData.ts

export interface MaterialOrigin {
  material: string;
  origin: string;
  verified: boolean;
  certification?: string;
  source?: string; // Where this data came from: 'openfoodfacts', 'manual', 'mock'
}

export interface AuditStep {
  id: string;
  title: string;
  description: string;
  status: 'verified' | 'flagged' | 'pending';
  facility?: string;
  energySource?: string;
  certification?: string;
  emissions?: string;
  dataSource?: string; // Attribution: where this audit data originated
}

export type ConfidenceLevel = 'high' | 'estimated' | 'insufficient';

export type ProductStatus = 'verified' | 'flagged' | 'pending';

export interface NutrientFact {
  key: string;
  label: string;
  amount: number;
  unit: string;
  per: '100g';
}

export interface HealthAnalysis {
  /** True if no allergen hits and no nutritional warnings */
  isMatchForUser: boolean;
  /** Allergens from user's list found in the product */
  flaggedIngredients: string[];
  /** Human-readable warning about processing level or nutriscore */
  nutritionalWarning?: string;
  /** Positive dietary matches (e.g. ['Vegan', 'Gluten-Free']) */
  matchedDiets?: string[];
  /** Short reasons for the banner (chips or bullets) */
  reasons?: string[];
  /** Brief, non-medical guidance for frequent intake */
  guidance?: string;
  /** Nutrient facts (per 100g) when available */
  nutrientFacts?: NutrientFact[];
  /** nova_group value (1–4), 0 if unknown */
  processingLevel: number;
  /** nutriscore_grade uppercased, undefined if unknown */
  nutriScore?: string;
}

export interface ProductScan {
  id: string;
  barcode?: string;
  name: string;
  brand: string;
  category: string;
  imageUrl?: string;
  scanDate: string;
  score: number;
  confidence: ConfidenceLevel;
  status: ProductStatus;
  renewablePercent: number;
  emissions: string;
  transportDistance: string;
  materials: MaterialOrigin[];
  auditSteps: AuditStep[];
  auditProgress: number;
  scoringBreakdown?: Record<string, number>;
  methodologyVersion: string;
  healthAnalysis?: HealthAnalysis;
  dataSource: 'openfoodfacts' | 'mock' | 'user_submitted';
}

// ─── ML Model Types ──────────────────────────────────────────────

/** Result of validating training-serving feature consistency */
export interface FeatureValidation {
  isValid: boolean;
  featureCount: number;
  expectedCount: number;
  mismatches: string[];
  timestamp: string;
}

/** Metadata about the trained model, saved alongside weights */
export interface ModelMetadata {
  trainedAt: string;
  architecture: string;
  numFeatures: number;
  totalParameters: number;
  trainingSamples: number;
  rSquared: number;
  mae: number;
  accuracyAt10: number;
  hasNormalization: boolean;
  hasBatchNorm: boolean;
  weightsVersion: string;
}
