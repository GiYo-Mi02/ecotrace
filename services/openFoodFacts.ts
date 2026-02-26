// services/openFoodFacts.ts — Open Food Facts API Service
//
// Free product database — no API key required.
// Docs: https://wiki.openfoodfacts.org/API
//
// This module handles:
//  - Barcode lookups (GET /api/v2/product/{barcode})
//  - Data quality assessment
//  - Product transformation for the scoring pipeline

const BASE_URL = 'https://world.openfoodfacts.org';
const USER_AGENT = 'ECOTRACE-App/1.0 (https://github.com/ecotrace)';
const TIMEOUT_MS = 10000;

// ─── Types ───────────────────────────────────────────────────────

/**
 * Open Food Facts product data — subset of fields used by ECOTRACE.
 * This is the canonical type used by scoring.ts and featureEncoder.ts.
 */
export interface OFFProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  categories?: string;
  categories_tags?: string[];
  ecoscore_grade?: string;
  ecoscore_score?: number;
  nova_group?: number;
  nutriscore_grade?: string;
  labels?: string;
  labels_tags?: string[];
  packaging_text?: string;
  packaging_tags?: string[];
  origins?: string;
  manufacturing_places?: string;
  image_url?: string;
  image_front_url?: string;
  image_front_small_url?: string;
  ingredients_text?: string;
  quantity?: string;
  stores?: string;
  countries_tags?: string[];
}

export interface DataQuality {
  score: number;          // 0-100: how much useful data this product has
  availableFields: number;
  totalFields: number;
  missingCritical: string[];
}

// ─── API Functions ───────────────────────────────────────────────

/**
 * Look up a product by barcode (EAN-13, UPC-A, etc.)
 * Returns null if not found or on network error.
 */
export async function lookupBarcode(barcode: string): Promise<OFFProduct | null> {
  if (!barcode || barcode.trim() === '') return null;

  const cleanBarcode = barcode.replace(/[^0-9]/g, '');
  if (cleanBarcode.length < 8) {
    console.warn(`[OFF] Invalid barcode length: ${cleanBarcode.length}`);
    return null;
  }

  const url = `${BASE_URL}/api/v2/product/${cleanBarcode}.json?fields=code,product_name,brands,categories,categories_tags,ecoscore_grade,ecoscore_score,nova_group,nutriscore_grade,labels,labels_tags,packaging_text,packaging_tags,origins,manufacturing_places,image_url,image_front_url,image_front_small_url,ingredients_text,quantity,stores,countries_tags`;

  try {
    console.log(`[OFF] Looking up barcode: ${cleanBarcode}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[OFF] HTTP ${response.status} for barcode ${cleanBarcode}`);
      return null;
    }

    const data = await response.json();

    if (!data || data.status === 0 || !data.product) {
      console.log(`[OFF] Product not found: ${cleanBarcode}`);
      return null;
    }

    const product: OFFProduct = {
      code: data.product.code || cleanBarcode,
      product_name: data.product.product_name,
      brands: data.product.brands,
      categories: data.product.categories,
      categories_tags: data.product.categories_tags,
      ecoscore_grade: data.product.ecoscore_grade,
      ecoscore_score: data.product.ecoscore_score,
      nova_group: data.product.nova_group,
      nutriscore_grade: data.product.nutriscore_grade,
      labels: data.product.labels,
      labels_tags: data.product.labels_tags,
      packaging_text: data.product.packaging_text,
      packaging_tags: data.product.packaging_tags,
      origins: data.product.origins,
      manufacturing_places: data.product.manufacturing_places,
      image_url: data.product.image_url,
      image_front_url: data.product.image_front_url,
      image_front_small_url: data.product.image_front_small_url,
      ingredients_text: data.product.ingredients_text,
      quantity: data.product.quantity,
      stores: data.product.stores,
      countries_tags: data.product.countries_tags,
    };

    const quality = calculateDataQuality(product);
    console.log(`[OFF] Found: "${product.product_name}" by ${product.brands} — Data quality: ${quality.score}%`);

    return product;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn(`[OFF] Request timed out for barcode ${cleanBarcode}`);
    } else {
      console.warn(`[OFF] Network error for barcode ${cleanBarcode}:`, error.message);
    }
    return null;
  }
}

// ─── Data Quality Assessment ─────────────────────────────────────

/**
 * Assess how much useful sustainability data a product has.
 * Higher score = more reliable eco-score calculation.
 */
export function calculateDataQuality(product: OFFProduct): DataQuality {
  const checks: { field: string; available: boolean; critical: boolean }[] = [
    { field: 'product_name', available: !!product.product_name, critical: true },
    { field: 'categories', available: !!(product.categories_tags && product.categories_tags.length > 0), critical: true },
    { field: 'ecoscore', available: product.ecoscore_grade !== undefined && product.ecoscore_grade !== null, critical: false },
    { field: 'nova_group', available: product.nova_group !== undefined && product.nova_group !== null, critical: false },
    { field: 'labels', available: !!(product.labels_tags && product.labels_tags.length > 0), critical: false },
    { field: 'packaging', available: !!product.packaging_text, critical: false },
    { field: 'origins', available: !!product.origins, critical: false },
    { field: 'manufacturing_places', available: !!product.manufacturing_places, critical: false },
    { field: 'brands', available: !!product.brands, critical: false },
    { field: 'image', available: !!(product.image_front_url || product.image_url), critical: false },
  ];

  const available = checks.filter(c => c.available).length;
  const total = checks.length;
  const missingCritical = checks.filter(c => c.critical && !c.available).map(c => c.field);

  return {
    score: Math.round((available / total) * 100),
    availableFields: available,
    totalFields: total,
    missingCritical,
  };
}

// ─── Transform to ProductScan ────────────────────────────────────
// (Lightweight transform — full scoring is in scoring.ts via mapOFFToProductScan)

export function getProductDisplayName(product: OFFProduct): string {
  if (product.product_name && product.brands) {
    return `${product.product_name} — ${product.brands}`;
  }
  return product.product_name || product.brands || 'Unknown Product';
}

export function getProductImageUrl(product: OFFProduct): string | undefined {
  return product.image_front_url || product.image_front_small_url || product.image_url;
}
