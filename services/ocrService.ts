// services/ocrService.ts — OCR & NLP text analysis for product labels
//
// Uses regex-based NLP for label text analysis (no external OCR library needed).
// The actual OCR capture happens via expo-camera snapshot → the user
// manually corrects the text in PhotoUploadScreen. This service analyzes
// whatever text is provided (typed or pasted) to extract sustainability signals.
//
// In future phases, Tesseract.js or Google Cloud Vision (free tier) can be
// plugged in to auto-extract text from images. For now, the manual entry
// approach is more reliable on mobile and requires zero additional packages.

// ─── Certification patterns ─────────────────────────────────────
const CERTIFICATION_PATTERNS: { keyword: string; label: string; category: string }[] = [
  { keyword: 'organic', label: 'Organic', category: 'environmental' },
  { keyword: 'bio', label: 'Bio / Organic', category: 'environmental' },
  { keyword: 'fair trade', label: 'Fair Trade', category: 'social' },
  { keyword: 'fairtrade', label: 'Fairtrade', category: 'social' },
  { keyword: 'fair-trade', label: 'Fair Trade', category: 'social' },
  { keyword: 'rainforest alliance', label: 'Rainforest Alliance', category: 'environmental' },
  { keyword: 'utz', label: 'UTZ Certified', category: 'environmental' },
  { keyword: 'msc', label: 'MSC (Marine Stewardship)', category: 'environmental' },
  { keyword: 'asc', label: 'ASC (Aquaculture)', category: 'environmental' },
  { keyword: 'fsc', label: 'FSC (Forest Stewardship)', category: 'environmental' },
  { keyword: 'eu organic', label: 'EU Organic', category: 'environmental' },
  { keyword: 'usda organic', label: 'USDA Organic', category: 'environmental' },
  { keyword: 'demeter', label: 'Demeter Biodynamic', category: 'environmental' },
  { keyword: 'ecocert', label: 'Ecocert', category: 'environmental' },
  { keyword: 'vegan', label: 'Vegan', category: 'dietary' },
  { keyword: 'vegetarian', label: 'Vegetarian', category: 'dietary' },
  { keyword: 'non-gmo', label: 'Non-GMO', category: 'environmental' },
  { keyword: 'non gmo', label: 'Non-GMO', category: 'environmental' },
  { keyword: 'carbon neutral', label: 'Carbon Neutral', category: 'environmental' },
  { keyword: 'carbon-neutral', label: 'Carbon Neutral', category: 'environmental' },
  { keyword: 'b corp', label: 'B Corporation', category: 'social' },
  { keyword: 'cradle to cradle', label: 'Cradle to Cradle', category: 'environmental' },
  { keyword: 'energy star', label: 'Energy Star', category: 'environmental' },
  { keyword: 'recyclable', label: 'Recyclable', category: 'packaging' },
  { keyword: 'recycled', label: 'Made from Recycled Materials', category: 'packaging' },
  { keyword: 'compostable', label: 'Compostable', category: 'packaging' },
  { keyword: 'biodegradable', label: 'Biodegradable', category: 'packaging' },
  { keyword: 'sustainably sourced', label: 'Sustainably Sourced', category: 'environmental' },
  { keyword: 'locally sourced', label: 'Locally Sourced', category: 'environmental' },
  { keyword: 'gluten free', label: 'Gluten Free', category: 'dietary' },
  { keyword: 'gluten-free', label: 'Gluten Free', category: 'dietary' },
  { keyword: 'palm oil free', label: 'Palm Oil Free', category: 'environmental' },
  { keyword: 'no palm oil', label: 'Palm Oil Free', category: 'environmental' },
];

// ─── Packaging material patterns ─────────────────────────────────
const PACKAGING_PATTERNS: { keyword: string; material: string; recyclability: string }[] = [
  { keyword: 'glass', material: 'Glass', recyclability: 'Highly Recyclable' },
  { keyword: 'aluminum', material: 'Aluminum', recyclability: 'Highly Recyclable' },
  { keyword: 'aluminium', material: 'Aluminium', recyclability: 'Highly Recyclable' },
  { keyword: 'tin', material: 'Tin', recyclability: 'Recyclable' },
  { keyword: 'steel', material: 'Steel', recyclability: 'Recyclable' },
  { keyword: 'cardboard', material: 'Cardboard', recyclability: 'Recyclable' },
  { keyword: 'paper', material: 'Paper', recyclability: 'Recyclable' },
  { keyword: 'carton', material: 'Carton', recyclability: 'Recyclable' },
  { keyword: 'tetra pak', material: 'Tetra Pak', recyclability: 'Partially Recyclable' },
  { keyword: 'plastic', material: 'Plastic', recyclability: 'Check Local Rules' },
  { keyword: 'pet', material: 'PET Plastic', recyclability: 'Widely Recyclable' },
  { keyword: 'hdpe', material: 'HDPE Plastic', recyclability: 'Widely Recyclable' },
  { keyword: 'ldpe', material: 'LDPE Plastic', recyclability: 'Limited Recyclability' },
  { keyword: 'polypropylene', material: 'Polypropylene (PP)', recyclability: 'Check Local Rules' },
  { keyword: 'polystyrene', material: 'Polystyrene', recyclability: 'Not Recyclable' },
  { keyword: 'styrofoam', material: 'Styrofoam', recyclability: 'Not Recyclable' },
  { keyword: 'bioplastic', material: 'Bioplastic', recyclability: 'Compostable' },
  { keyword: 'bamboo', material: 'Bamboo', recyclability: 'Compostable' },
  { keyword: 'wood', material: 'Wood', recyclability: 'Compostable' },
  { keyword: 'cellulose', material: 'Cellulose', recyclability: 'Compostable' },
];

// ─── Greenwashing detection patterns ─────────────────────────────
const GREENWASHING_FLAGS: { pattern: RegExp; warning: string; severity: 'low' | 'medium' | 'high' }[] = [
  {
    pattern: /100%\s*natural/i,
    warning: '"100% natural" is an unregulated marketing term with no standard definition.',
    severity: 'medium',
  },
  {
    pattern: /eco[\s-]?friendly/i,
    warning: '"Eco-friendly" is vague and not backed by a specific certification.',
    severity: 'low',
  },
  {
    pattern: /green\s*(product|choice|option)/i,
    warning: '"Green" claims without certification may be misleading.',
    severity: 'low',
  },
  {
    pattern: /chemical[\s-]?free/i,
    warning: '"Chemical-free" is scientifically inaccurate — everything is made of chemicals.',
    severity: 'medium',
  },
  {
    pattern: /all[\s-]?natural/i,
    warning: '"All natural" has no legal definition in most countries.',
    severity: 'medium',
  },
  {
    pattern: /plant[\s-]?based(?!.*certified)/i,
    warning: '"Plant-based" without certification may contain non-plant ingredients.',
    severity: 'low',
  },
  {
    pattern: /zero\s*emissions?(?!.*certified|offset)/i,
    warning: '"Zero emissions" claim should be backed by third-party verification.',
    severity: 'high',
  },
  {
    pattern: /sustainabl[ey](?!.*certified|sourced|harvest)/i,
    warning: 'Vague "sustainable" claim without specifying what aspect is sustainable.',
    severity: 'low',
  },
  {
    pattern: /earth[\s-]?friendly/i,
    warning: '"Earth-friendly" is an unregulated marketing term.',
    severity: 'low',
  },
  {
    pattern: /carbon[\s-]?negative/i,
    warning: '"Carbon negative" claims require third-party lifecycle assessment verification.',
    severity: 'high',
  },
];

// ─── Environmental claims extraction ─────────────────────────────
const ENVIRONMENTAL_CLAIMS: { pattern: RegExp; claim: string }[] = [
  { pattern: /(\d+)%\s*recycled/i, claim: 'Contains recycled content' },
  { pattern: /(\d+)%\s*less\s*(plastic|packaging|waste)/i, claim: 'Reduced packaging' },
  { pattern: /(\d+)%\s*renewable/i, claim: 'Uses renewable materials' },
  { pattern: /(\d+)%\s*organic/i, claim: 'Contains organic ingredients' },
  { pattern: /locally\s*(grown|made|sourced|produced)/i, claim: 'Locally produced' },
  { pattern: /responsibly\s*sourced/i, claim: 'Responsibly sourced' },
  { pattern: /ethically\s*(sourced|produced|made)/i, claim: 'Ethically produced' },
  { pattern: /free[\s-]?range/i, claim: 'Free range' },
  { pattern: /grass[\s-]?fed/i, claim: 'Grass fed' },
  { pattern: /cage[\s-]?free/i, claim: 'Cage free' },
  { pattern: /wild[\s-]?caught/i, claim: 'Wild caught' },
  { pattern: /no\s*artificial\s*(colors?|flavou?rs?|preservatives?)/i, claim: 'No artificial additives' },
];

// ─── Result types ────────────────────────────────────────────────
export interface CertificationMatch {
  label: string;
  category: string;
  confidence: number; // 0-1
}

export interface PackagingMatch {
  material: string;
  recyclability: string;
}

export interface GreenwashingFlag {
  warning: string;
  severity: 'low' | 'medium' | 'high';
}

export interface EnvironmentalClaim {
  claim: string;
  rawMatch: string;
}

export interface LabelAnalysisResult {
  certifications: CertificationMatch[];
  packaging: PackagingMatch[];
  greenwashingFlags: GreenwashingFlag[];
  environmentalClaims: EnvironmentalClaim[];
  suggestedCategory: string | null;
  rawTextLength: number;
  analysisTimestamp: string;
}

// ─── Category detection from text ────────────────────────────────
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'beverages': ['water', 'juice', 'soda', 'drink', 'beverage', 'cola', 'lemonade', 'tea', 'coffee'],
  'dairy': ['milk', 'cheese', 'yogurt', 'yoghurt', 'butter', 'cream', 'dairy'],
  'snacks': ['chips', 'crackers', 'cookies', 'biscuits', 'snack', 'pretzels', 'popcorn'],
  'cereals': ['cereal', 'granola', 'oats', 'oatmeal', 'muesli', 'cornflakes'],
  'fruits-vegetables': ['fruit', 'vegetable', 'apple', 'banana', 'tomato', 'carrot', 'salad', 'lettuce'],
  'meat': ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'meat', 'sausage', 'ham', 'bacon'],
  'seafood': ['fish', 'salmon', 'tuna', 'shrimp', 'seafood', 'cod', 'sardine'],
  'bakery': ['bread', 'pastry', 'cake', 'muffin', 'croissant', 'bagel', 'bun'],
  'condiments': ['sauce', 'ketchup', 'mustard', 'mayo', 'dressing', 'vinegar', 'oil'],
  'chocolate': ['chocolate', 'cocoa', 'candy', 'confectionery'],
  'pasta-rice': ['pasta', 'rice', 'noodles', 'spaghetti', 'macaroni', 'penne'],
  'frozen': ['frozen', 'ice cream', 'pizza'],
  'canned': ['canned', 'tinned', 'preserved'],
  'cleaning': ['detergent', 'soap', 'cleaner', 'bleach', 'dishwasher'],
  'personal-care': ['shampoo', 'conditioner', 'lotion', 'cream', 'deodorant', 'toothpaste'],
};

function detectCategory(text: string): string | null {
  const lower = text.toLowerCase();
  let bestCategory: string | null = null;
  let bestCount = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const matchCount = keywords.filter(kw => lower.includes(kw)).length;
    if (matchCount > bestCount) {
      bestCount = matchCount;
      bestCategory = category;
    }
  }

  return bestCount > 0 ? bestCategory : null;
}

// ─── Main analysis function ──────────────────────────────────────
export function analyzeLabelText(text: string): LabelAnalysisResult {
  if (!text || text.trim().length === 0) {
    return {
      certifications: [],
      packaging: [],
      greenwashingFlags: [],
      environmentalClaims: [],
      suggestedCategory: null,
      rawTextLength: 0,
      analysisTimestamp: new Date().toISOString(),
    };
  }

  const lower = text.toLowerCase();

  // Find certifications
  const certifications: CertificationMatch[] = [];
  const seenCerts = new Set<string>();
  for (const cert of CERTIFICATION_PATTERNS) {
    if (lower.includes(cert.keyword) && !seenCerts.has(cert.label)) {
      seenCerts.add(cert.label);
      certifications.push({
        label: cert.label,
        category: cert.category,
        confidence: 0.85, // Text match confidence
      });
    }
  }

  // Find packaging materials
  const packaging: PackagingMatch[] = [];
  const seenPackaging = new Set<string>();
  for (const pack of PACKAGING_PATTERNS) {
    if (lower.includes(pack.keyword) && !seenPackaging.has(pack.material)) {
      seenPackaging.add(pack.material);
      packaging.push({
        material: pack.material,
        recyclability: pack.recyclability,
      });
    }
  }

  // Detect greenwashing
  const greenwashingFlags: GreenwashingFlag[] = [];
  for (const flag of GREENWASHING_FLAGS) {
    if (flag.pattern.test(text)) {
      greenwashingFlags.push({
        warning: flag.warning,
        severity: flag.severity,
      });
    }
  }

  // Extract environmental claims
  const environmentalClaims: EnvironmentalClaim[] = [];
  for (const ec of ENVIRONMENTAL_CLAIMS) {
    const match = text.match(ec.pattern);
    if (match) {
      environmentalClaims.push({
        claim: ec.claim,
        rawMatch: match[0],
      });
    }
  }

  // Auto-detect category
  const suggestedCategory = detectCategory(text);

  return {
    certifications,
    packaging,
    greenwashingFlags,
    environmentalClaims,
    suggestedCategory,
    rawTextLength: text.length,
    analysisTimestamp: new Date().toISOString(),
  };
}

// ─── Utility: Extract certification names for ML prediction input ─
export function extractCertificationNames(result: LabelAnalysisResult): string[] {
  return result.certifications.map(c => c.label);
}

// ─── Utility: Summarize packaging for ML prediction input ────────
export function summarizePackaging(result: LabelAnalysisResult): string | undefined {
  if (result.packaging.length === 0) return undefined;
  return result.packaging.map(p => p.material).join(', ');
}
