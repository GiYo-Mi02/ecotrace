// services/openFoodFacts.ts — Open Food Facts API integration
// Phase 3: Real product data from the world's largest open food database
// API docs: https://openfoodfacts.github.io/openfoodfacts-server/api/

const BASE_URL = 'https://world.openfoodfacts.org/api/v2';

// User-Agent header is REQUIRED by Open Food Facts terms of use
const USER_AGENT = 'ECOTRACE/1.0 (ecotrace-app)';

export interface OFFProduct {
  code: string;
  product_name?: string;
  brands?: string;
  categories?: string;
  image_url?: string;
  image_front_url?: string;
  image_front_small_url?: string;
  ecoscore_grade?: string;        // a, b, c, d, e
  ecoscore_score?: number;        // 0-100
  nova_group?: number;            // 1-4 (NOVA food processing classification)
  nutriscore_grade?: string;      // a, b, c, d, e
  packaging_text?: string;
  packaging_tags?: string[];
  origins?: string;
  manufacturing_places?: string;
  labels?: string;
  labels_tags?: string[];         // e.g. ['en:organic', 'en:fair-trade']
  carbon_footprint_percent_of_known_ingredients?: number;
}

export interface OFFResponse {
  code: string;
  product: OFFProduct;
  status: number;          // 1 = found, 0 = not found
  status_verbose: string;
}

const REQUESTED_FIELDS = [
  'code',
  'product_name',
  'brands',
  'categories',
  'image_url',
  'image_front_url',
  'image_front_small_url',
  'ecoscore_grade',
  'ecoscore_score',
  'nova_group',
  'nutriscore_grade',
  'packaging_text',
  'packaging_tags',
  'origins',
  'manufacturing_places',
  'labels',
  'labels_tags',
  'carbon_footprint_percent_of_known_ingredients',
].join(',');

/**
 * Look up a product by barcode from Open Food Facts.
 * Returns null if the product is not found or if the request fails.
 */
export async function lookupBarcode(barcode: string): Promise<OFFProduct | null> {
  try {
    const url = `${BASE_URL}/product/${barcode}.json?fields=${REQUESTED_FIELDS}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!response.ok) {
      console.warn(`[OFF] HTTP ${response.status} for barcode: ${barcode}`);
      return null;
    }

    const data: OFFResponse = await response.json();

    if (data.status === 0 || !data.product) {
      return null; // Product not found
    }

    return data.product;
  } catch (error) {
    console.error('[OFF] API request failed:', error);
    return null;
  }
}
