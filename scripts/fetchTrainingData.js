// scripts/fetchTrainingData.js — Fetch real products from Open Food Facts API
//
// Run with: node scripts/fetchTrainingData.js
// Or:       npm run fetch-training-data
//
// Downloads real product data from Open Food Facts (free, no API key)
// and converts it to training format for the ML model.
//
// Output: data/off_training_data.json

const https = require('https');
const fs = require('fs');

const CONFIG = {
  productsPerCategory: 25,
  outputPath: './data/off_training_data.json',
  apiBase: 'https://world.openfoodfacts.org',
  delay: 1000, // ms between requests (be nice to the API)
};

const CATEGORIES = [
  'beverages', 'dairies', 'snacks', 'cereals-and-potatoes',
  'fruits-and-vegetables-based-foods', 'meats', 'fishes-meat-eggs',
  'frozen-foods', 'breads', 'sauces',
  'canned-foods', 'organic-products', 'plant-based-foods-and-beverages',
  'baby-foods', 'pet-foods', 'hygiene', 'cleaning-products',
  'chocolates', 'coffees', 'pasta',
];

const CATEGORY_INDEX_MAP = {
  'beverages': 0, 'dairies': 1, 'snacks': 2, 'cereals-and-potatoes': 3,
  'fruits-and-vegetables-based-foods': 4, 'meats': 5, 'fishes-meat-eggs': 6,
  'frozen-foods': 7, 'breads': 8, 'sauces': 9,
  'canned-foods': 10, 'organic-products': 11, 'plant-based-foods-and-beverages': 12,
  'baby-foods': 13, 'pet-foods': 14, 'hygiene': 15, 'cleaning-products': 16,
  'chocolates': 17, 'coffees': 18, 'pasta': 19,
};

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'ECOTRACE-ML-Training/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractFeatures(product, catIdx) {
  const labels = (product.labels_tags || []).join(' ').toLowerCase();
  const packaging = (product.packaging_text || '').toLowerCase() +
    ' ' + (product.packaging_tags || []).join(' ').toLowerCase();

  const hasOrganic = labels.includes('organic') || labels.includes('bio') ? 1 : 0;
  const hasFairtrade = labels.includes('fair-trade') || labels.includes('fairtrade') ? 1 : 0;
  const hasEcoCert = ['rainforest', 'utz', 'msc', 'asc', 'fsc', 'ecocert', 'carbon-neutral']
    .some(k => labels.includes(k)) ? 1 : 0;
  const recyclable = packaging.includes('recyclable') || packaging.includes('recycled') ? 1 : 0;
  const glass = packaging.includes('glass') ? 1 : 0;
  const plastic = packaging.includes('plastic') ? 1 : 0;

  const origins = `${product.origins || ''} ${product.manufacturing_places || ''}`.toLowerCase();
  const local = ['local', 'national', 'france', 'germany', 'usa', 'united states']
    .some(k => origins.includes(k)) ? 1 : 0;
  const far = ['china', 'asia', 'india', 'south america', 'imported']
    .some(k => origins.includes(k)) ? 1 : 0;

  const certCount = [hasOrganic, hasFairtrade, hasEcoCert,
    labels.includes('vegan') ? 1 : 0,
    labels.includes('non-gmo') ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const nova = product.nova_group || 2;
  const processing = (nova - 1) / 3;

  // Target: eco-score (0-100)
  let score = product.ecoscore_score;
  if (score === undefined || score === null) {
    // Estimate from eco-score grade
    const gradeScores = { a: 85, b: 65, c: 45, d: 25, e: 10 };
    score = gradeScores[product.ecoscore_grade?.toLowerCase()] || null;
  }

  if (score === null) return null;

  return [catIdx, nova, hasOrganic, hasFairtrade, hasEcoCert,
    recyclable, glass, plastic, local, far, certCount, processing,
    Math.max(0, Math.min(100, Math.round(score)))];
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   ECOTRACE — Open Food Facts Data Fetcher          ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');

  const allData = [];

  for (let i = 0; i < CATEGORIES.length; i++) {
    const category = CATEGORIES[i];
    const catIdx = CATEGORY_INDEX_MAP[category];
    const url = `${CONFIG.apiBase}/cgi/search.pl?action=process&tagtype_0=categories&tag_contains_0=contains&tag_0=${category}&fields=product_name,ecoscore_score,ecoscore_grade,nova_group,labels_tags,packaging_text,packaging_tags,origins,manufacturing_places&page_size=${CONFIG.productsPerCategory}&json=1`;

    console.log(`📦 Fetching ${category} (${i + 1}/${CATEGORIES.length})...`);

    try {
      const response = await fetchJSON(url);
      const products = response.products || [];
      let count = 0;

      for (const product of products) {
        const features = extractFeatures(product, catIdx);
        if (features) {
          allData.push(features);
          count++;
        }
      }

      console.log(`   ✅ ${count} products with eco-scores found`);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    await sleep(CONFIG.delay);
  }

  console.log('');
  console.log(`📊 Total training examples: ${allData.length}`);

  // Save
  fs.writeFileSync(CONFIG.outputPath, JSON.stringify({
    fetchedAt: new Date().toISOString(),
    source: 'Open Food Facts API',
    totalExamples: allData.length,
    data: allData,
  }, null, 2));

  console.log(`💾 Saved to ${CONFIG.outputPath}`);
  console.log('');
  console.log('Next: Run "node scripts/trainModel.js" to train with this data');
}

main().catch(console.error);
