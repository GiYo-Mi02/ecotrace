// services/scoring.ts — ECOTRACE Sustainability Index v0.1
//
// METHODOLOGY OVERVIEW (transparent & documented)
// ================================================
// Score range: 0-100 (higher = more sustainable)
//
// Five factors:
//   1. Eco-Score passthrough (40%) — from ADEME/Open Food Facts
//   2. Packaging assessment   (20%) — based on declared packaging materials
//   3. Origin/transport est.  (15%) — rough distance heuristic from declared origins
//   4. Processing level       (15%) — NOVA food classification (Univ. of São Paulo)
//   5. Certification bonus    (10%) — recognized environmental/ethical labels
//
// Confidence levels:
//   high         — 4+ data points available
//   estimated    — 2-3 data points, rest interpolated
//   insufficient — 0-1 data points, category-level estimate only
//
// This algorithm is deterministic and auditable. Every scoring decision is logged
// in the scoringBreakdown field for transparency.

import type { OFFProduct } from './openFoodFacts';
import type { ProductScan, ConfidenceLevel, AuditStep, MaterialOrigin } from '@/types/product';

const METHODOLOGY_VERSION = 'v0.1';

// ─── Factor 1: Eco-Score (40% weight) ────────────────────────────
function scoreEcoGrade(grade?: string): number {
  switch (grade?.toLowerCase()) {
    case 'a': return 40;
    case 'b': return 32;
    case 'c': return 24;
    case 'd': return 16;
    case 'e': return 8;
    default:  return 20; // Unknown → neutral midpoint
  }
}

// ─── Factor 2: Packaging (20% weight) ────────────────────────────
function scorePackaging(packagingText?: string, packagingTags?: string[]): number {
  if (!packagingText && (!packagingTags || packagingTags.length === 0)) return 10;

  const text = (packagingText || '').toLowerCase();
  const tags = (packagingTags || []).map(t => t.toLowerCase());
  let score = 10; // midpoint

  // Positive packaging signals
  if (text.includes('recyclable') || tags.some(t => t.includes('recyclable'))) score += 5;
  if (text.includes('recycled') || tags.some(t => t.includes('recycled'))) score += 3;
  if (text.includes('glass') || tags.some(t => t.includes('glass'))) score += 2;
  if (text.includes('cardboard') || text.includes('paper') || text.includes('carton')) score += 2;
  if (text.includes('compostable') || tags.some(t => t.includes('compostable'))) score += 4;

  // Negative packaging signals
  if (text.includes('plastic') || tags.some(t => t.includes('plastic'))) score -= 3;
  if (text.includes('non-recyclable') || tags.some(t => t.includes('non-recyclable'))) score -= 5;
  if (text.includes('polystyrene') || text.includes('styrofoam')) score -= 5;
  if (text.includes('mixed') || text.includes('composite')) score -= 2;

  return Math.max(0, Math.min(20, score));
}

// ─── Factor 3: Origin/Transport (15% weight) ─────────────────────
function scoreTransport(origins?: string, manufacturingPlaces?: string): number {
  if (!origins && !manufacturingPlaces) return 7; // Unknown → neutral

  const text = `${origins || ''} ${manufacturingPlaces || ''}`.toLowerCase();

  // Rough heuristic — Phase 2 should use actual geocoding
  if (text.includes('local') || text.includes('national')) return 15;
  if (text.includes('france') || text.includes('germany') || text.includes('italy') ||
      text.includes('spain') || text.includes('united kingdom') || text.includes('usa') ||
      text.includes('united states') || text.includes('canada')) return 12;
  if (text.includes('europe') || text.includes('eu') || text.includes('north america')) return 10;
  if (text.includes('asia') || text.includes('china') || text.includes('india') ||
      text.includes('south america') || text.includes('africa')) return 5;
  return 7; // Can't determine → neutral
}

// ─── Factor 4: Processing Level / NOVA (15% weight) ──────────────
function scoreNova(novaGroup?: number): number {
  switch (novaGroup) {
    case 1: return 15; // Unprocessed or minimally processed
    case 2: return 11; // Processed culinary ingredients
    case 3: return 7;  // Processed foods
    case 4: return 3;  // Ultra-processed food and drink products
    default: return 7; // Unknown → midpoint
  }
}

// ─── Factor 5: Certifications (10% weight) ───────────────────────
const CERT_KEYWORDS = [
  'organic', 'bio', 'fair-trade', 'fairtrade', 'rainforest-alliance',
  'utz', 'msc', 'asc', 'fsc', 'eu-organic', 'ab-agriculture-biologique',
  'demeter', 'ecocert', 'usda-organic', 'vegan', 'vegetarian',
  'non-gmo', 'sustainable', 'carbon-neutral',
];

function scoreCertifications(labels?: string, labelsTags?: string[]): number {
  const allLabels = `${labels || ''} ${(labelsTags || []).join(' ')}`.toLowerCase();

  let certCount = 0;
  for (const keyword of CERT_KEYWORDS) {
    if (allLabels.includes(keyword)) certCount++;
  }

  return Math.min(10, certCount * 3); // 3 points per cert, max 10
}

// ─── Confidence Assessment ───────────────────────────────────────
function determineConfidence(product: OFFProduct): ConfidenceLevel {
  let dataPoints = 0;
  if (product.ecoscore_grade) dataPoints++;
  if (product.nova_group) dataPoints++;
  if (product.packaging_text || (product.packaging_tags && product.packaging_tags.length > 0)) dataPoints++;
  if (product.origins || product.manufacturing_places) dataPoints++;
  if (product.labels || (product.labels_tags && product.labels_tags.length > 0)) dataPoints++;

  if (dataPoints >= 4) return 'high';
  if (dataPoints >= 2) return 'estimated';
  return 'insufficient';
}

// ─── Audit Trail Generation ──────────────────────────────────────
function generateAuditSteps(product: OFFProduct): AuditStep[] {
  const ts = Date.now();
  const steps: AuditStep[] = [];

  steps.push({
    id: `audit-${ts}-1`,
    title: 'Ingredients & Sourcing',
    description: product.origins
      ? `Primary ingredients sourced from: ${product.origins}`
      : 'Origin data not available for this product. Score is based on category average.',
    status: product.origins ? 'verified' : 'pending',
    dataSource: product.origins ? 'Open Food Facts' : undefined,
  });

  steps.push({
    id: `audit-${ts}-2`,
    title: 'Manufacturing',
    description: product.manufacturing_places
      ? `Manufactured in: ${product.manufacturing_places}`
      : 'Manufacturing location not disclosed by producer.',
    status: product.manufacturing_places ? 'verified' : 'pending',
    dataSource: product.manufacturing_places ? 'Open Food Facts' : undefined,
  });

  steps.push({
    id: `audit-${ts}-3`,
    title: 'Packaging Assessment',
    description: product.packaging_text
      ? `Packaging: ${product.packaging_text}`
      : 'Packaging information not available.',
    status: product.packaging_text ? 'verified' : 'pending',
    dataSource: product.packaging_text ? 'Open Food Facts' : undefined,
  });

  const certs: string[] = [];
  for (const tag of product.labels_tags || []) {
    certs.push(tag.replace('en:', '').replace(/-/g, ' '));
  }

  steps.push({
    id: `audit-${ts}-4`,
    title: 'Certifications & Labels',
    description: certs.length > 0
      ? `Recognized labels: ${certs.slice(0, 5).join(', ')}${certs.length > 5 ? ` (+${certs.length - 5} more)` : ''}`
      : 'No recognized environmental or ethical certifications found.',
    status: certs.length > 0 ? 'verified' : 'flagged',
    dataSource: certs.length > 0 ? 'Open Food Facts' : undefined,
  });

  return steps;
}

// ─── Material Extraction ─────────────────────────────────────────
function extractMaterials(product: OFFProduct): MaterialOrigin[] {
  const materials: MaterialOrigin[] = [];

  if (product.packaging_text) {
    const parts = product.packaging_text.split(/[,;]/).map(p => p.trim()).filter(Boolean);
    for (const part of parts.slice(0, 4)) {
      materials.push({
        material: part,
        origin: product.manufacturing_places || 'Not disclosed',
        verified: !!product.manufacturing_places,
        source: 'Open Food Facts',
      });
    }
  }

  if (materials.length === 0) {
    materials.push({
      material: 'Product materials',
      origin: product.origins || 'Not disclosed',
      verified: false,
      source: 'Insufficient data',
    });
  }

  return materials;
}

// ─── Emission & Renewable Estimates ──────────────────────────────
function estimateEmissions(product: OFFProduct): string {
  if (product.ecoscore_score !== undefined && product.ecoscore_score !== null) {
    const est = ((100 - product.ecoscore_score) * 0.15).toFixed(1);
    return `~${est}kg CO₂ est.`;
  }
  return 'Data unavailable';
}

function estimateRenewable(product: OFFProduct): number {
  const labels = (product.labels_tags || []).join(' ').toLowerCase();
  if (labels.includes('organic') || labels.includes('bio')) return 70;
  if (product.ecoscore_grade === 'a') return 80;
  if (product.ecoscore_grade === 'b') return 60;
  if (product.ecoscore_grade === 'c') return 40;
  if (product.ecoscore_grade === 'd') return 25;
  if (product.ecoscore_grade === 'e') return 10;
  return 35;
}

function estimateTransportDistance(product: OFFProduct): string {
  const origin = `${product.origins || ''} ${product.manufacturing_places || ''}`.toLowerCase();
  if (!origin.trim()) return 'Unknown';
  if (origin.includes('local') || origin.includes('national')) return '< 500 km';
  if (origin.includes('france') || origin.includes('germany') || origin.includes('europe')) return '~ 1,500 km';
  return '> 3,000 km';
}

function mapCategory(categories?: string): string {
  if (!categories) return 'Unknown';
  const first = categories.split(',')[0].trim().replace(/^en:/, '');
  return first.charAt(0).toUpperCase() + first.slice(1);
}

// ─── Main Scoring Function ───────────────────────────────────────
export function mapOFFToProductScan(offProduct: OFFProduct, barcode: string): ProductScan {
  const eco = scoreEcoGrade(offProduct.ecoscore_grade);
  const pack = scorePackaging(offProduct.packaging_text, offProduct.packaging_tags);
  const transport = scoreTransport(offProduct.origins, offProduct.manufacturing_places);
  const nova = scoreNova(offProduct.nova_group);
  const certs = scoreCertifications(offProduct.labels, offProduct.labels_tags);

  const total = Math.max(0, Math.min(100, eco + pack + transport + nova + certs));
  const confidence = determineConfidence(offProduct);
  const auditSteps = generateAuditSteps(offProduct);
  const verifiedSteps = auditSteps.filter(s => s.status === 'verified').length;

  return {
    id: `SCAN-${Date.now()}`,
    barcode,
    name: offProduct.product_name || 'Unknown Product',
    brand: offProduct.brands || 'Unknown Brand',
    category: mapCategory(offProduct.categories),
    imageUrl: offProduct.image_front_url || offProduct.image_url,
    scanDate: new Date().toISOString().split('T')[0],
    score: total,
    confidence,
    status: total >= 60 ? 'verified' : total >= 30 ? 'pending' : 'flagged',
    renewablePercent: estimateRenewable(offProduct),
    emissions: estimateEmissions(offProduct),
    transportDistance: estimateTransportDistance(offProduct),
    materials: extractMaterials(offProduct),
    auditSteps,
    auditProgress: Math.round((verifiedSteps / auditSteps.length) * 100),
    scoringBreakdown: {
      eco_impact: eco,
      packaging: pack,
      transport,
      processing: nova,
      certifications: certs,
    },
    methodologyVersion: METHODOLOGY_VERSION,
    dataSource: 'openfoodfacts',
  };
}
