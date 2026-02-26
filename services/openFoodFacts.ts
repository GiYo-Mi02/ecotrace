// services/openFoodFacts.ts — Open Food Facts API Service v2.0
//
// Free product database — no API key required.
// Docs: https://wiki.openfoodfacts.org/API
//
// This module handles:
//  - Barcode lookups (GET /api/v2/product/{barcode})
//  - Retry logic with exponential backoff
//  - AsyncStorage caching (7-day TTL)
//  - Data quality assessment
//  - Product transformation for the scoring pipeline

import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'https://world.openfoodfacts.org';
const USER_AGENT = 'ECOTRACE-App/1.0 (https://github.com/ecotrace)';
const TIMEOUT_MS = 10000;
const MAX_RETRIES = 3;
const CACHE_PREFIX = 'off_product_';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

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

export type FetchSource = 'cache' | 'api' | 'none';

export interface FetchResult {
  success: boolean;
  product: OFFProduct | null;
  error?: string;
  source: FetchSource;
  quality?: DataQuality;
}

// ─── Cache Layer ─────────────────────────────────────────────────

async function getCachedProduct(barcode: string): Promise<OFFProduct | null> {
  try {
    const key = `${CACHE_PREFIX}${barcode}`;
    const cached = await AsyncStorage.getItem(key);
    if (!cached) return null;

    const { product, timestamp } = JSON.parse(cached);

    // Check if cache is still valid
    if (Date.now() - timestamp > CACHE_DURATION) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    return product;
  } catch (error) {
    console.error('[OFF] Cache read error:', error);
    return null;
  }
}

async function cacheProduct(barcode: string, product: OFFProduct): Promise<void> {
  try {
    const key = `${CACHE_PREFIX}${barcode}`;
    const data = { product, timestamp: Date.now() };
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('[OFF] Cache write error:', error);
  }
}

// ─── Fetch with Retry ────────────────────────────────────────────

async function fetchWithRetry(barcode: string): Promise<OFFProduct | null> {
  const url = `${BASE_URL}/api/v2/product/${barcode}.json?fields=code,product_name,brands,categories,categories_tags,ecoscore_grade,ecoscore_score,nova_group,nutriscore_grade,labels,labels_tags,packaging_text,packaging_tags,origins,manufacturing_places,image_url,image_front_url,image_front_small_url,ingredients_text,quantity,stores,countries_tags`;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data || data.status === 0 || !data.product) {
        return null; // Product not found — valid response, not a retry-able error
      }

      return {
        code: data.product.code || barcode,
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
      } as OFFProduct;
    } catch (error: any) {
      lastError = error;
      const isAbort = error.name === 'AbortError';
      console.warn(`[OFF] Attempt ${attempt}/${MAX_RETRIES} failed for ${barcode}: ${isAbort ? 'timeout' : error.message}`);

      if (attempt < MAX_RETRIES) {
        // Exponential backoff: 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }

  throw lastError || new Error('Fetch failed after retries');
}

// ─── API Functions ───────────────────────────────────────────────

/**
 * Look up a product by barcode (EAN-13, UPC-A, etc.)
 * Returns null if not found or on network error.
 * Uses cache-first strategy with 7-day TTL and retry with exponential backoff.
 */
export async function lookupBarcode(barcode: string): Promise<OFFProduct | null> {
  const result = await fetchProductByBarcode(barcode);
  return result.success ? result.product : null;
}

/**
 * Full lookup with metadata about source, quality, and errors.
 * Used by predictFromBarcode() for richer error handling.
 */
export async function fetchProductByBarcode(barcode: string): Promise<FetchResult> {
  if (!barcode || barcode.trim() === '') {
    return { success: false, product: null, error: 'Empty barcode', source: 'none' };
  }

  const cleanBarcode = barcode.replace(/[^0-9]/g, '');
  if (cleanBarcode.length < 8) {
    return { success: false, product: null, error: `Invalid barcode length: ${cleanBarcode.length}`, source: 'none' };
  }

  // 1. Check cache first
  try {
    const cached = await getCachedProduct(cleanBarcode);
    if (cached) {
      console.log(`[OFF] ✅ Cache hit: ${cleanBarcode} — "${cached.product_name}"`);
      const quality = calculateDataQuality(cached);
      return { success: true, product: cached, source: 'cache', quality };
    }
  } catch (e) {
    // Cache miss or error — continue to API
  }

  // 2. Fetch from API with retry
  try {
    console.log(`[OFF] Fetching barcode: ${cleanBarcode}`);
    const product = await fetchWithRetry(cleanBarcode);

    if (!product) {
      console.log(`[OFF] Product not found: ${cleanBarcode}`);
      return { success: false, product: null, error: 'Product not found in database', source: 'none' };
    }

    // Cache successful result
    await cacheProduct(cleanBarcode, product);

    const quality = calculateDataQuality(product);
    console.log(`[OFF] ✅ Found: "${product.product_name}" by ${product.brands} — Data quality: ${quality.score}%`);

    return { success: true, product, source: 'api', quality };
  } catch (error: any) {
    const isTimeout = error.name === 'AbortError' || error.message?.includes('timeout');
    const errorMsg = isTimeout
      ? 'Request timed out. Check your internet connection.'
      : (error.message || 'Network error');

    console.error(`[OFF] API error for ${cleanBarcode}:`, errorMsg);
    return { success: false, product: null, error: errorMsg, source: 'none' };
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
