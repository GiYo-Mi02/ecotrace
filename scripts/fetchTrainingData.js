// scripts/fetchTrainingData.js — ECOTRACE Data Mining Pipeline v2.1
//
// Fetches products from Open Food Facts v2 API sorted by popularity,
// filters for valid eco-score data client-side, and balances by grade.
//
// Run: node scripts/fetchTrainingData.js
// Output: data/realTrainingData.json
//
// Targets 10,000+ valid products with expanded fields for 28-feature encoding.

const https = require('https');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  // Use v2 API — reliable and supports field selection
  baseUrl: 'https://world.openfoodfacts.org/api/v2/search',
  pageSize: 100,         // 100 per page = fast, reliable responses
  maxPages: 250,         // Up to 250 pages (25,000 products scanned)
  targetProducts: 10000,
  delayMs: 1200,         // Polite delay between requests
  maxRetries: 3,
  outputPath: path.join(__dirname, '..', 'data', 'realTrainingData.json'),
  fields: [
    'code',
    'product_name',
    'categories_tags',
    'nova_group',
    'labels_tags',
    'packaging_tags',
    'packaging_materials_tags',
    'packaging_text',
    'origins_tags',
    'origins',
    'manufacturing_places_tags',
    'manufacturing_places',
    'ecoscore_score',
    'ecoscore_grade',
    'nutrient_levels_tags',
    'ingredients_analysis_tags',
    'ingredients_n',
    'nutriscore_score',
    'nutriscore_grade',
    'nutriments',
    'pnns_groups_1',
    'pnns_groups_2',
  ].join(','),
};

// ─── HTTP Fetch ──────────────────────────────────────────────────

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'ECOTRACE-ML-Training/2.1 (educational-project; ecotrace@app.com)',
      },
      timeout: 60000,
    };

    const req = https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
  });
}

async function fetchWithRetry(url, retries = CONFIG.maxRetries) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fetchPage(url);
    } catch (error) {
      if (attempt === retries) throw error;
      const wait = attempt * 3000;
      console.log(`   ⚠️  Attempt ${attempt}/${retries} failed: ${error.message}. Retrying in ${wait / 1000}s...`);
      await sleep(wait);
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Validation ──────────────────────────────────────────────────

function isValidProduct(product) {
  return (
    product &&
    typeof product.ecoscore_score === 'number' &&
    product.ecoscore_score >= 0 &&
    product.ecoscore_score <= 100 &&
    product.ecoscore_grade &&
    ['a', 'b', 'c', 'd', 'e'].includes(product.ecoscore_grade.toLowerCase()) &&
    Array.isArray(product.categories_tags) &&
    product.categories_tags.length > 0 &&
    product.product_name &&
    product.product_name.trim().length > 0
  );
}

function extractProduct(product) {
  return {
    code: product.code || '',
    product_name: product.product_name || '',
    categories_tags: product.categories_tags || [],
    nova_group: product.nova_group || null,
    labels_tags: product.labels_tags || [],
    packaging_tags: product.packaging_tags || [],
    packaging_materials_tags: product.packaging_materials_tags || [],
    packaging_text: product.packaging_text || '',
    origins_tags: product.origins_tags || [],
    origins: product.origins || '',
    manufacturing_places_tags: product.manufacturing_places_tags || [],
    manufacturing_places: product.manufacturing_places || '',
    ecoscore_score: product.ecoscore_score,
    ecoscore_grade: product.ecoscore_grade || '',
    nutrient_levels_tags: product.nutrient_levels_tags || [],
    ingredients_analysis_tags: product.ingredients_analysis_tags || [],
    ingredients_n: product.ingredients_n || null,
  };
}

// ─── URL Building ────────────────────────────────────────────────

function buildUrl(page) {
  const params = new URLSearchParams({
    sort_by: 'unique_scans_n',
    page_size: String(CONFIG.pageSize),
    page: String(page),
    fields: CONFIG.fields,
  });
  return `${CONFIG.baseUrl}?${params.toString()}`;
}

// ─── Main Pipeline ───────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   ECOTRACE v2.1 — Data Mining Pipeline                      ║');
  console.log('║   Targeting 10,000+ products with eco-score data            ║');
  console.log('║   Fetching popular products, filtering client-side          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  const seenCodes = new Set();
  const allProducts = [];
  const gradeCounts = { a: 0, b: 0, c: 0, d: 0, e: 0 };

  let totalScanned = 0;
  let consecutiveEmpty = 0;

  for (let page = 1; page <= CONFIG.maxPages; page++) {
    if (allProducts.length >= CONFIG.targetProducts) break;

    const url = buildUrl(page);
    console.log(`📦 Page ${page}/${CONFIG.maxPages} | Fetching ${CONFIG.pageSize} products...`);

    try {
      const response = await fetchWithRetry(url);
      const products = response.products || [];

      if (products.length === 0) {
        consecutiveEmpty++;
        if (consecutiveEmpty >= 3) {
          console.log('   ⚠️  3 consecutive empty pages — stopping');
          break;
        }
        console.log('   ⚠️  Empty page');
        await sleep(CONFIG.delayMs);
        continue;
      }
      consecutiveEmpty = 0;
      totalScanned += products.length;

      let validCount = 0;
      for (const product of products) {
        if (isValidProduct(product) && !seenCodes.has(product.code)) {
          seenCodes.add(product.code);
          const extracted = extractProduct(product);
          allProducts.push(extracted);
          validCount++;
          const g = extracted.ecoscore_grade.toLowerCase();
          if (gradeCounts.hasOwnProperty(g)) gradeCounts[g]++;
        }
      }

      const yieldPct = products.length > 0 ? ((validCount / products.length) * 100).toFixed(0) : '0';
      console.log(
        `   ✅ ${validCount}/${products.length} valid (${yieldPct}% yield)` +
        ` | Total: ${allProducts.length}/${CONFIG.targetProducts}` +
        ` | A:${gradeCounts.a} B:${gradeCounts.b} C:${gradeCounts.c} D:${gradeCounts.d} E:${gradeCounts.e}`
      );

      // Progress bar
      const pct = Math.min(100, Math.round((allProducts.length / CONFIG.targetProducts) * 100));
      const filled = Math.floor(pct / 2);
      const bar = '█'.repeat(filled) + '░'.repeat(50 - filled);
      console.log(`   [${bar}] ${pct}%`);

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    if (page < CONFIG.maxPages && allProducts.length < CONFIG.targetProducts) {
      await sleep(CONFIG.delayMs);
    }
  }

  // Score distribution
  const scoreBuckets = { '0-19': 0, '20-39': 0, '40-59': 0, '60-79': 0, '80-100': 0 };
  for (const p of allProducts) {
    const s = p.ecoscore_score;
    if (s < 20) scoreBuckets['0-19']++;
    else if (s < 40) scoreBuckets['20-39']++;
    else if (s < 60) scoreBuckets['40-59']++;
    else if (s < 80) scoreBuckets['60-79']++;
    else scoreBuckets['80-100']++;
  }

  // Ensure output directory exists
  const outputDir = path.dirname(CONFIG.outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const output = {
    fetchedAt: new Date().toISOString(),
    source: 'Open Food Facts API v2 (https://world.openfoodfacts.org)',
    totalProducts: allProducts.length,
    totalScanned: totalScanned,
    pipeline: 'ECOTRACE ETL v2.1 (popularity-based + client-side filtering)',
    gradeDistribution: gradeCounts,
    scoreDistribution: scoreBuckets,
    products: allProducts,
  };

  fs.writeFileSync(CONFIG.outputPath, JSON.stringify(output, null, 2));

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log(`║   ✅ COMPLETE: ${String(allProducts.length).padEnd(6)} products saved                       ║`);
  console.log(`║   📁 Output: data/realTrainingData.json                      ║`);
  console.log(`║   📊 Scanned: ${String(totalScanned).padEnd(6)} total products                      ║`);
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║   Grade Distribution:                                        ║');
  console.log(`║     A: ${String(gradeCounts.a).padEnd(6)} B: ${String(gradeCounts.b).padEnd(6)} C: ${String(gradeCounts.c).padEnd(6)} D: ${String(gradeCounts.d).padEnd(6)} E: ${String(gradeCounts.e).padEnd(6)}  ║`);
  console.log('║   Score Distribution:                                        ║');
  console.log(`║     0-19: ${String(scoreBuckets['0-19']).padEnd(5)} 20-39: ${String(scoreBuckets['20-39']).padEnd(5)} 40-59: ${String(scoreBuckets['40-59']).padEnd(5)}           ║`);
  console.log(`║     60-79: ${String(scoreBuckets['60-79']).padEnd(5)} 80-100: ${String(scoreBuckets['80-100']).padEnd(5)}                          ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Next step: node scripts/trainModel.js');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
