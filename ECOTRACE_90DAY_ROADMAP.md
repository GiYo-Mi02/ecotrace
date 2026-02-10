# ECOTRACE — 90-Day Implementation Roadmap

**Created:** February 10, 2026
**Team:** Solo developer / 2-3 person team
**Budget:** Bootstrapped (free tiers, open-source first)
**Goal:** Transform UI prototype → functional, beta-testable MVP

---

## Table of Contents

1. [Technical Architecture Plan](#1-technical-architecture-plan)
2. [Week-by-Week Roadmap](#2-week-by-week-roadmap)
3. [Critical Code Refactoring Guide](#3-critical-code-refactoring-guide)
4. [Environmental Methodology Framework](#4-environmental-methodology-framework)
5. [Quick Wins Checklist](#5-quick-wins-checklist)
6. [Risk Mitigation Strategy](#6-risk-mitigation-strategy)
7. [Realistic Scope Reduction](#7-realistic-scope-reduction)

---

## 1. Technical Architecture Plan

### 1.1 Recommended Backend Stack [CRITICAL]

**Decision: Supabase (serverless PostgreSQL + Auth + Edge Functions)**

| Option Considered | Verdict | Why |
|---|---|---|
| **Supabase** ✅ | **Winner** | Free tier covers MVP (500MB DB, 50K monthly active users, 500MB storage). PostgreSQL is mature. Built-in auth, realtime, edge functions. Row-level security. React Native SDK exists. |
| Firebase | Runner-up | Firestore's NoSQL model is a poor fit for relational product data (materials → products → audits). Would require denormalization headaches. |
| Custom Node/Express + PostgreSQL | Too slow | Building auth, API, hosting, deployment from scratch is 4-6 weeks alone. You don't have time. |
| PlanetScale / Neon + Hono | Viable alternative | If you prefer a more custom API layer. But Supabase gives you more for free. |

**Why Supabase specifically:**
- Product data is inherently relational (a product has many materials, each material has certifications, each audit has steps). PostgreSQL handles this natively.
- Auth is critical for scan history persistence, and Supabase Auth drops in with `@supabase/supabase-js`.
- Edge Functions (Deno-based) let you run the scoring engine server-side without managing infrastructure.
- Free tier is generous enough for 6+ months of beta.

**Architecture Diagram:**

```
┌──────────────────────────────────┐
│  ECOTRACE Mobile App (Expo)      │
│  ├── expo-camera (barcode scan)  │
│  ├── Supabase JS Client         │
│  └── Local cache (MMKV/AsyncStorage)│
└──────────┬───────────────────────┘
           │ HTTPS
           ▼
┌──────────────────────────────────┐
│  Supabase                        │
│  ├── Auth (email, Google, Apple) │
│  ├── PostgreSQL                  │
│  │   ├── products                │
│  │   ├── materials               │
│  │   ├── certifications          │
│  │   ├── audit_steps             │
│  │   ├── user_scans              │
│  │   └── scoring_cache           │
│  ├── Edge Functions              │
│  │   ├── /score-product          │
│  │   ├── /lookup-barcode         │
│  │   └── /generate-audit         │
│  └── Storage (product images)    │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│  External APIs                   │
│  ├── Open Food Facts (food)      │
│  ├── Open Beauty Facts (cosm.)   │
│  ├── UPCitemdb.com (general UPC) │
│  └── EPA GHGRP (emissions data)  │
└──────────────────────────────────┘
```

### 1.2 Barcode Scanning Implementation [CRITICAL]

**Use `expo-camera` v16+ with its built-in barcode scanner.** Do NOT use the deprecated `expo-barcode-scanner`.

```bash
npx expo install expo-camera
```

**Scanning flow:**

```
User taps "Scan" →
  Camera opens (expo-camera with barcode detection) →
    Barcode detected (UPC-A, EAN-13, QR) →
      Call Supabase Edge Function: /lookup-barcode →
        ├── Check local DB first (scoring_cache) →
        ├── If miss: call Open Food Facts API →
        ├── If miss: call UPCitemdb API →
        ├── If miss: return "Product not found" flow →
        └── If hit: run scoring engine → return ProductScan
```

**Key decision: The camera replaces the current fake scanner viewport.** Keep the `CornerBrackets` visual overlay on top of the real camera feed — it's a good design element that works even better with a live viewfinder.

### 1.3 Environmental Data Pipeline [HIGH]

**Phase 1 (MVP — Weeks 7-10): Single-category, pre-computed scores**

Start with **packaged food/beverages only.** Here's why:
- Open Food Facts has 3M+ products with Eco-Score data already computed
- Barcodes on food are ubiquitous (users can test immediately)
- Emissions data for food supply chains is the most researched
- You can validate your methodology against existing Eco-Score data

```
Barcode → Open Food Facts API →
  ├── Product name, brand, categories, ingredients
  ├── Nutri-Score (already computed)
  ├── Eco-Score (already computed — use as validation)
  ├── Packaging data
  ├── Origins/manufacturing places
  └── Carbon footprint estimates (when available)

Your scoring engine takes this raw data and produces:
  ├── ECOTRACE Score (0-100)
  ├── Breakdown: packaging, transport, ingredients, certifications
  └── Confidence level: "high" / "estimated" / "insufficient data"
```

**Phase 2 (Post-MVP): Multi-category expansion**

| Category | Data Source | Readiness |
|---|---|---|
| Food/Beverage | Open Food Facts API | Ready now — free, open-source, 3M+ products |
| Cosmetics/Personal Care | Open Beauty Facts API | Ready now — same platform, smaller DB |
| Fashion/Apparel | Good On You API (paid) or manual | Expensive/slow — defer to Phase 2 |
| Electronics | No good open API exists | Defer — would require partnerships |
| Household goods | EPA Safer Choice database | Partial — limited to cleaning products |

### 1.4 Database Schema (PostgreSQL via Supabase) [HIGH]

```sql
-- Core product data (cached from external APIs + user contributions)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  image_url TEXT,
  source TEXT NOT NULL, -- 'openfoodfacts', 'upcitemdb', 'user_submitted'
  raw_data JSONB, -- full API response cached
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Computed scores (your scoring engine output)
CREATE TABLE product_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  overall_score INTEGER CHECK (overall_score BETWEEN 0 AND 100),
  packaging_score INTEGER,
  transport_score INTEGER,
  ingredients_score INTEGER,
  certification_score INTEGER,
  confidence_level TEXT CHECK (confidence_level IN ('high', 'estimated', 'insufficient')),
  methodology_version TEXT NOT NULL, -- 'v0.1', 'v0.2' etc.
  scoring_breakdown JSONB, -- detailed calculation log
  computed_at TIMESTAMPTZ DEFAULT now()
);

-- User scan history
CREATE TABLE user_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  product_id UUID REFERENCES products(id),
  score_id UUID REFERENCES product_scores(id),
  scanned_at TIMESTAMPTZ DEFAULT now(),
  location_lat DECIMAL,
  location_lng DECIMAL
);

-- Material data (for audit trail)
CREATE TABLE product_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  material_name TEXT NOT NULL,
  origin_country TEXT,
  origin_region TEXT,
  verified BOOLEAN DEFAULT false,
  certification TEXT,
  source TEXT -- where this data came from
);

-- Row Level Security
ALTER TABLE user_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own scans" ON user_scans
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own scans" ON user_scans
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### 1.5 API Design [HIGH]

Edge Functions (Supabase Deno runtime):

| Endpoint | Method | Purpose | Auth Required |
|---|---|---|---|
| `/lookup-barcode` | POST | Scan barcode → find or fetch product → return score | Yes |
| `/score-product` | POST | Force re-score a cached product | Yes |
| `/submit-product` | POST | User submits a product not in DB | Yes |
| `/methodology` | GET | Return current scoring methodology doc | No |

**Example: `/lookup-barcode` Edge Function:**

```typescript
// supabase/functions/lookup-barcode/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const { barcode } = await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Check local cache
  const { data: cached } = await supabase
    .from("products")
    .select("*, product_scores(*)")
    .eq("barcode", barcode)
    .single();

  if (cached?.product_scores?.length > 0) {
    return new Response(JSON.stringify(cached), { status: 200 });
  }

  // 2. Fetch from Open Food Facts
  const offRes = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`
  );
  const offData = await offRes.json();

  if (offData.status === 0) {
    return new Response(
      JSON.stringify({ error: "product_not_found", barcode }),
      { status: 404 }
    );
  }

  // 3. Store product + compute score
  const product = mapOpenFoodFactsToProduct(offData.product, barcode);
  const { data: inserted } = await supabase
    .from("products")
    .upsert(product)
    .select()
    .single();

  const score = computeEcotraceScore(offData.product);
  await supabase.from("product_scores").insert({
    product_id: inserted.id,
    ...score,
  });

  return new Response(JSON.stringify({ ...inserted, product_scores: [score] }), {
    status: 200,
  });
});
```

### 1.6 Cloud Services & APIs — First Integrations [HIGH]

| Service | Purpose | Cost | Priority |
|---|---|---|---|
| **Supabase** (free tier) | Database, auth, edge functions, storage | $0 (up to 500MB DB) | Week 7 |
| **Open Food Facts API** | Product data (food/beverage) | $0 (open-source, rate-limited) | Week 5 |
| **Open Beauty Facts API** | Product data (cosmetics) | $0 (open-source) | Defer to Phase 2 |
| **UPCitemdb.com** | General barcode lookups as fallback | $0 (100 req/day free) | Week 6 |
| **Expo EAS** (free tier) | Build service, OTA updates | $0 (30 builds/month) | Week 1 |
| **Sentry** (free tier) | Error tracking/crash reporting | $0 (5K events/month) | Week 3 |

**Do NOT pay for:**
- Any "AI" API (GPT, Claude) — you don't need LLMs for scoring. A deterministic algorithm is more credible.
- Any premium product database yet — validate the concept on free data first.
- Any cloud hosting beyond Supabase — it's enough for MVP.

---

## 2. Week-by-Week Roadmap

### Sprint 0: Week 1-2 — "Stop the Bleeding"

**Theme:** Brand the app, fix embarrassing issues, clean the codebase.

#### ✅ Deliverables
- App properly branded as ECOTRACE (config, splash, icons)
- Dead code removed, navigation refactored to Expo Router
- "Demo Mode" clearly indicated in UI
- Misleading "neural" language replaced
- Settings screen exists (even if minimal)
- Haptic feedback on scan

#### 🔧 Technical Tasks

**Day 1-2: Branding & Config [CRITICAL]**
- [ ] Update `app.json`: name → "ecotrace", slug → "ecotrace", scheme → "ecotrace"
- [ ] Update `app.json`: splash backgroundColor → `#0f172a`
- [ ] Update `app.json`: android adaptiveIcon backgroundColor → `#0f172a`
- [ ] Update `package.json`: name → "ecotrace"
- [ ] Create ECOTRACE logo/icon assets (even a simple text-based one):
  - `assets/images/icon.png` (1024×1024)
  - `assets/images/adaptive-icon.png` (1024×1024)
  - `assets/images/splash-icon.png` (200×200)
  - `assets/images/favicon.png` (48×48)
- [ ] Replace README.md with actual project description

**Day 2-3: Code Cleanup [CRITICAL]**
- [ ] Delete `context/AppContext.tsx` (dead code)
- [ ] Move `AppScreen` type definition into a shared types file: `types/navigation.ts`
- [ ] Remove NativeWind if not planning to use it (or commit to it — see Section 3)
- [ ] Fix double font loading (remove from `index.tsx`, keep in `_layout.tsx`)
- [ ] Update `_layout.tsx`: remove `tempobook` check in screenOptions, set StatusBar to `light`

**Day 3-5: Navigation Refactor [CRITICAL]**
- [ ] Create proper Expo Router file-based routes (see Section 3 for full guide):
  - `app/(tabs)/_layout.tsx` — Tab navigator
  - `app/(tabs)/scanner.tsx` — Scanner screen
  - `app/(tabs)/history.tsx` — History screen
  - `app/(tabs)/settings.tsx` — Settings screen
  - `app/impact/[id].tsx` — Impact detail (dynamic route)
  - `app/audit/[id].tsx` — Audit detail (dynamic route)
  - `app/parsing.tsx` — Parsing animation (modal)
- [ ] Delete the manual state-machine navigation from `index.tsx`
- [ ] Wire up `BottomNav` as a proper Expo Router tab bar (or replace with Expo Router's built-in tabs)

**Day 5-7: UI Honesty & Polish [CRITICAL]**
- [ ] Replace "NEURAL SCANNER v2.4" → "ECOTRACE SCANNER" in `ScannerScreen.tsx`
- [ ] Replace "NEURAL PARSING..." → "ANALYZING..." in `ParsingScreen.tsx`
- [ ] Add demo banner component: `components/DemoBanner.tsx`
- [ ] Add a basic `SettingsScreen.tsx` with: About, Methodology link, App Version, Demo mode indicator
- [ ] Add haptic feedback to scan button (`expo-haptics` is already installed)

**Day 7-10: Error Handling Foundation [HIGH]**
- [ ] Create `components/ErrorBoundary.tsx` (React error boundary)
- [ ] Wrap root layout with ErrorBoundary
- [ ] Create `components/EmptyState.tsx` (reusable empty state component)
- [ ] Add empty state to History screen (replace pre-loaded mock data)
- [ ] Create "Product Not Found" placeholder screen

#### ⚠️ Blockers
- Logo/icon design: If you can't design, use a simple text logo ("ET" in monospace on `#0f172a` background). Canva free tier can generate a 1024px icon in 10 minutes. Don't spend more than 2 hours on this.
- Navigation refactor is the largest task. It will temporarily break the app. Plan for a solid day of wiring.

#### 📊 Success Metrics
- `app.json` contains "ecotrace" everywhere — zero references to "test-tempo"
- Zero dead code files in the repo
- App launches with dark splash screen, ECOTRACE branding
- Every screen has a "DEMO" indicator visible
- Settings tab navigates to a real screen

---

### Sprint 1: Week 3-4 — "Real Camera, Real Barcodes"

**Theme:** Replace the fake scanner with a real camera barcode reader.

#### ✅ Deliverables
- Camera permission flow (request → explain → handle denial)
- Live camera viewfinder with barcode detection
- Barcode captured → displayed on screen (no API lookup yet)
- "Product not found" flow when barcode doesn't match mock data
- Local data persistence for scan history (survives app restart)

#### 🔧 Technical Tasks

**Camera Integration [CRITICAL]**
- [ ] Install `expo-camera`:
  ```bash
  npx expo install expo-camera
  ```
- [ ] Add camera permission to `app.json`:
  ```json
  "ios": { "infoPlist": { "NSCameraUsageDescription": "ECOTRACE needs camera access to scan product barcodes." } },
  "android": { "permissions": ["CAMERA"] }
  ```
- [ ] Rewrite `ScannerScreen.tsx`:
  - Replace the static crosshair viewport with `<CameraView>` component
  - Overlay `CornerBrackets` on top of the camera feed
  - Use `onBarcodeScanned` callback to detect UPC-A, EAN-13, QR codes
  - Add a "torch" toggle button for low-light scanning
  - Keep the visual design language (dark accents, green highlights)
- [ ] Create `hooks/useBarcodeLookup.ts` — takes a barcode string, returns product data
  - Phase 1: Look up against expanded local mock data
  - Phase 2: Will call Supabase Edge Function (wired in Week 7)
- [ ] Handle camera permission denied: show explanation screen with "Open Settings" button

**Local Persistence [HIGH]**
- [ ] Install MMKV (faster than AsyncStorage):
  ```bash
  npx expo install react-native-mmkv
  ```
- [ ] Create `services/storage.ts`:
  ```typescript
  import { MMKV } from 'react-native-mmkv';
  const storage = new MMKV();

  export const saveScanHistory = (scans: ProductScan[]) =>
    storage.set('scan_history', JSON.stringify(scans));

  export const loadScanHistory = (): ProductScan[] => {
    const raw = storage.getString('scan_history');
    return raw ? JSON.parse(raw) : [];
  };
  ```
- [ ] Replace initial `useState<ProductScan[]>(MOCK_PRODUCTS.slice(0, 4))` with loaded history
- [ ] Persist every new scan to storage

**Expanded Mock Data [MEDIUM]**
- [ ] Add 20+ products to `mockData.ts` with real UPC barcodes (for testing):
  - Look up real product barcodes on Open Food Facts
  - Create mock ECOTRACE scores for them
  - This lets you test the full scan → lookup → result flow before the API is live
- [ ] Map barcode strings to mock products in `hooks/useBarcodeLookup.ts`

#### ⚠️ Blockers
- Camera doesn't work in Expo Go for barcode scanning on Android. You'll need a dev build:
  ```bash
  npx expo run:android
  # or
  eas build --profile development --platform android
  ```
- If you don't have an Apple Developer account, iOS testing requires Expo Go (which supports camera) or a dev build via EAS.

#### 📊 Success Metrics
- Point phone at a barcode → barcode value appears on screen within 500ms
- Scan history persists after app kill and relaunch
- Camera permission denied → graceful fallback (not a crash)
- 20+ test barcodes return mock product data

---

### Sprint 2: Week 5-6 — "Real Product Data"

**Theme:** Connect to Open Food Facts and display real product information.

#### ✅ Deliverables
- Scan a real grocery product → see its actual name, brand, image from Open Food Facts
- Product data cached locally (don't re-fetch every time)
- "Product not found" screen with option to try again or submit manually
- Loading/error states for all API calls
- Onboarding flow (3 screens)

#### 🔧 Technical Tasks

**Open Food Facts Integration [CRITICAL]**
- [ ] Create `services/openFoodFacts.ts`:
  ```typescript
  const OFF_BASE = "https://world.openfoodfacts.org/api/v2";

  export interface OFFProduct {
    code: string;
    product_name: string;
    brands: string;
    categories: string;
    image_url: string;
    ecoscore_grade: string; // a, b, c, d, e
    ecoscore_score: number;
    nova_group: number;
    packaging_text: string;
    origins: string;
    manufacturing_places: string;
    carbon_footprint_percent_of_known_ingredients?: number;
  }

  export async function lookupBarcode(barcode: string): Promise<OFFProduct | null> {
    try {
      const res = await fetch(
        `${OFF_BASE}/product/${barcode}.json?fields=code,product_name,brands,categories,image_url,ecoscore_grade,ecoscore_score,nova_group,packaging_text,origins,manufacturing_places,carbon_footprint_percent_of_known_ingredients`,
        { headers: { "User-Agent": "ECOTRACE/1.0 (contact@ecotrace.app)" } }
      );
      const data = await res.json();
      if (data.status === 0) return null;
      return data.product as OFFProduct;
    } catch {
      return null;
    }
  }
  ```
  > **Important:** Open Food Facts requires a User-Agent header. Use your app name + contact.

- [ ] Create `services/productMapper.ts` — maps OFF data to your `ProductScan` interface:
  ```typescript
  export function mapOFFToProductScan(off: OFFProduct): ProductScan {
    return {
      id: `SCAN-${Date.now()}`,
      name: off.product_name || "Unknown Product",
      brand: off.brands || "Unknown Brand",
      category: mapOFFCategory(off.categories),
      scanDate: new Date().toISOString().split("T")[0],
      score: computePhase1Score(off), // Your scoring engine (see Section 4)
      status: off.ecoscore_grade ? "verified" : "pending",
      imageUrl: off.image_url,
      // ... map remaining fields
    };
  }
  ```
- [ ] Update `hooks/useBarcodeLookup.ts` to call OFF API when local cache misses

**Product Image Display [MEDIUM]**
- [ ] Install `expo-image` (already in deps — good):
- [ ] Add product image to `ImpactScreen.tsx` header (from OFF `image_url`)
- [ ] Add product image thumbnail to `HistoryScreen.tsx` list items
- [ ] Fallback: show category icon when no image available

**Onboarding Flow [HIGH]**
- [ ] Create `app/onboarding.tsx` — 3-slide onboarding:
  - Slide 1: "Scan any product barcode" (camera illustration)
  - Slide 2: "Get an environmental impact score" (score ring illustration)
  - Slide 3: "Make better choices" (comparison illustration)
- [ ] Store `has_seen_onboarding` in MMKV
- [ ] Show onboarding on first launch, skip on subsequent launches
- [ ] Include "This app is in beta — scores are estimates" disclosure on final slide

**Loading & Error States [HIGH]**
- [ ] Create `components/LoadingState.tsx` — reuse the `CornerBrackets` animation
- [ ] Create `components/ErrorState.tsx` — retry button + error message
- [ ] Create `screens/ProductNotFoundScreen.tsx`:
  - Show the barcode that was scanned
  - "This product isn't in our database yet"
  - "Try scanning another product" button
  - "Help us grow — submit this product" button (stubbed for now)

#### ⚠️ Blockers
- Open Food Facts API rate limit: be respectful, cache aggressively. No bulk scraping.
- OFF data quality varies wildly. Many products have missing fields. Your UI must handle `null`/`undefined` for every single field.
- OFF Eco-Score is only available for food products sold in the EU primarily. US-only products may lack this data.

#### 📊 Success Metrics
- Scan a Coca-Cola can → see "Coca-Cola", correct brand, product image, and a score
- Scan an unknown barcode → see "Product not found" screen (not a crash)
- Network offline → see cached results from previous scans
- First-launch onboarding completes without issues

---

### Sprint 3: Week 7-8 — "Scoring Engine & Backend"

**Theme:** Build the Supabase backend and the Phase 1 scoring engine.

#### ✅ Deliverables
- Supabase project live with schema deployed
- User auth working (email + Google sign-in minimum)
- Scoring engine v0.1 running as Edge Function
- Scan results persisted to cloud (not just local)
- Methodology page accessible in-app

#### 🔧 Technical Tasks

**Supabase Setup [CRITICAL]**
- [ ] Create Supabase project at [supabase.com](https://supabase.com)
- [ ] Deploy database schema (from Section 1.4)
- [ ] Enable Row-Level Security on all tables
- [ ] Install Supabase client:
  ```bash
  npx expo install @supabase/supabase-js
  ```
- [ ] Create `services/supabase.ts`:
  ```typescript
  import { createClient } from "@supabase/supabase-js";
  import { MMKV } from "react-native-mmkv";

  const storage = new MMKV();

  // Custom storage adapter for Supabase Auth (uses MMKV instead of AsyncStorage)
  const mmkvStorageAdapter = {
    getItem: (key: string) => storage.getString(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  };

  export const supabase = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL!,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { storage: mmkvStorageAdapter, autoRefreshToken: true } }
  );
  ```
- [ ] Create `.env` (and add to `.gitignore`):
  ```env
  EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
  ```

**Auth Implementation [HIGH]**
- [ ] Create `app/auth/sign-in.tsx` — email/password sign-in
- [ ] Create `app/auth/sign-up.tsx` — registration
- [ ] Add Google Sign-In via Supabase Auth (uses expo-auth-session under the hood)
- [ ] Create `hooks/useAuth.ts` — wraps Supabase auth state
- [ ] Gate scan history sync behind auth (anonymous users get local-only history)
- [ ] Add sign-in prompt to Settings screen

**Scoring Engine v0.1 [CRITICAL]**
- [ ] Create Supabase Edge Function: `supabase/functions/score-product/index.ts`
- [ ] Phase 1 scoring algorithm (see Section 4 for full breakdown):

  ```typescript
  // Simplified v0.1 scoring — transparent and defensible
  export function computeScore(product: OFFProduct): ScoringResult {
    let score = 50; // Start at neutral
    const breakdown: Record<string, number> = {};

    // 1. Eco-Score passthrough (if available) — 40% weight
    if (product.ecoscore_score) {
      const ecoComponent = (product.ecoscore_score / 100) * 40;
      score += ecoComponent - 20; // Center around 0
      breakdown.ecoscore = ecoComponent;
    }

    // 2. Packaging assessment — 20% weight
    const packagingScore = assessPackaging(product.packaging_text);
    score += packagingScore;
    breakdown.packaging = packagingScore;

    // 3. Origin/transport estimate — 20% weight
    const transportScore = assessTransport(product.origins, product.manufacturing_places);
    score += transportScore;
    breakdown.transport = transportScore;

    // 4. Processing level (NOVA) — 10% weight
    const novaScore = product.nova_group ? (5 - product.nova_group) * 2.5 : 0;
    score += novaScore;
    breakdown.processing = novaScore;

    // 5. Certification bonus — 10% weight
    const certScore = assessCertifications(product);
    score += certScore;
    breakdown.certifications = certScore;

    return {
      overall_score: Math.max(0, Math.min(100, Math.round(score))),
      confidence_level: determineConfidence(product),
      methodology_version: "v0.1",
      scoring_breakdown: breakdown,
    };
  }
  ```

- [ ] Log every scoring decision in `scoring_breakdown` JSONB field — full transparency

**Cloud Sync [HIGH]**
- [ ] On successful scan: save to `user_scans` table (if authenticated)
- [ ] On app launch: sync cloud history → local cache
- [ ] Conflict resolution: cloud wins (most recent `scanned_at` timestamp)

#### ⚠️ Blockers
- Supabase Edge Functions require the Supabase CLI installed locally:
  ```bash
  npm install -g supabase
  supabase init
  supabase functions new score-product
  supabase functions deploy score-product
  ```
- Google Sign-In on React Native requires OAuth client IDs from Google Cloud Console. Budget 2-3 hours for configuration headaches.
- Environment variables: Expo requires `EXPO_PUBLIC_` prefix for client-side env vars.

#### 📊 Success Metrics
- Can create an account, sign in, sign out
- Scans appear in Supabase `user_scans` table
- Score computed for any product with Eco-Score data
- Scoring breakdown visible in database (auditable)
- Methodology page loads in-app

---

### Sprint 4: Week 9-10 — "Audit Trail & Methodology"

**Theme:** Build the real audit trail from Open Food Facts data and document the methodology.

#### ✅ Deliverables
- Real audit steps generated from OFF data (not hardcoded)
- Methodology page fully written and accessible
- Confidence indicators on all scores ("high confidence" / "estimated" / "insufficient data")
- Share functionality (share score as image or link)
- Error tracking live (Sentry)

#### 🔧 Technical Tasks

**Audit Trail Generation [HIGH]**
- [ ] Create `services/auditGenerator.ts` — builds audit steps from real data:
  ```typescript
  export function generateAuditSteps(product: OFFProduct): AuditStep[] {
    const steps: AuditStep[] = [];

    // Step 1: Ingredients sourcing
    steps.push({
      id: `audit-${Date.now()}-1`,
      title: "Ingredients Sourcing",
      description: product.origins
        ? `Primary ingredients sourced from: ${product.origins}`
        : "Origin data not available for this product.",
      status: product.origins ? "verified" : "pending",
    });

    // Step 2: Manufacturing
    steps.push({
      id: `audit-${Date.now()}-2`,
      title: "Manufacturing",
      description: product.manufacturing_places
        ? `Manufactured in: ${product.manufacturing_places}`
        : "Manufacturing location not disclosed.",
      status: product.manufacturing_places ? "verified" : "pending",
    });

    // Step 3: Packaging
    steps.push({
      id: `audit-${Date.now()}-3`,
      title: "Packaging Assessment",
      description: product.packaging_text
        ? `Packaging: ${product.packaging_text}`
        : "Packaging information not available.",
      status: product.packaging_text ? "verified" : "pending",
    });

    // Step 4: Environmental certifications
    const certs = extractCertifications(product);
    steps.push({
      id: `audit-${Date.now()}-4`,
      title: "Certifications & Labels",
      description: certs.length > 0
        ? `Verified certifications: ${certs.join(", ")}`
        : "No recognized environmental certifications found.",
      status: certs.length > 0 ? "verified" : "flagged",
    });

    return steps;
  }
  ```
- [ ] Replace hardcoded `auditSteps` in `ProductScan` type with dynamically generated ones
- [ ] Update `AuditScreen.tsx` to handle variable numbers of steps and "pending" states

**Methodology Documentation [CRITICAL]**
- [ ] Create `app/methodology.tsx` — in-app methodology page:
  - What the score measures
  - Data sources used (with links)
  - Weighting breakdown (with visual chart)
  - What "confidence level" means
  - Known limitations
  - "Last updated" date
  - Link to full methodology document (hosted on a simple website or GitHub)
- [ ] Add "How is this scored?" link on `ImpactScreen.tsx` below the score ring
- [ ] Add methodology link to `SettingsScreen.tsx`

**Confidence Indicators [HIGH]**
- [ ] Add confidence badge to score display:
  - 🟢 "High Confidence" — product has Eco-Score + origins + packaging data
  - 🟡 "Estimated" — product has partial data, score is interpolated
  - 🔴 "Insufficient Data" — score is based on category average, not product-specific
- [ ] Update `ScoreRing.tsx` to accept optional `confidence` prop
- [ ] Display confidence explanation on tap (tooltip or bottom sheet)

**Share Functionality [MEDIUM]**
- [ ] Install: `npx expo install expo-sharing expo-view-shot`
- [ ] Create `utils/shareScore.ts`:
  - Capture score card as image (expo-view-shot)
  - Share via native share sheet (expo-sharing)
  - Include text: "I scanned [Product Name] with ECOTRACE — it scored [X]/100 for sustainability"
- [ ] Add "Share" button to `ImpactScreen.tsx`

**Error Tracking [MEDIUM]**
- [ ] Install Sentry: `npx expo install @sentry/react-native`
- [ ] Configure in `_layout.tsx`
- [ ] Wrap root component with `Sentry.ErrorBoundary`

#### ⚠️ Blockers
- Audit trail quality depends entirely on OFF data quality. Many products will have mostly "pending" steps. This is OK — it's honest. Don't fake it.
- Sharing requires a dev build (expo-view-shot + expo-sharing don't work in Expo Go).

#### 📊 Success Metrics
- Every score displays a confidence level
- Methodology page explains the score in plain language
- At least 2 of 4 audit steps populate with real data for a typical grocery product
- Share produces a clean image with score + product info
- Sentry captures errors in production builds

---

### Sprint 5: Week 11-12 — "Integration, Polish, & Testing"

**Theme:** Stitch everything together, test thoroughly, fix edge cases.

#### ✅ Deliverables
- Full flow works end-to-end: scan → lookup → score → audit → history (with real data)
- All screens handle loading, error, empty, and offline states
- Performance optimized (no jank, no unnecessary re-renders)
- 50+ real products tested and scored
- Accessibility basics implemented
- Beta build generated via EAS Build

#### 🔧 Technical Tasks

**End-to-End Integration [CRITICAL]**
- [ ] Test the complete flow with 50+ real products (grocery store testing trip):
  - Document which products return good data, partial data, no data
  - Fix any crashes or unexpected states
  - Verify scoring makes intuitive sense (a Coca-Cola should score differently than organic fair-trade coffee)
- [ ] Implement offline mode:
  - If network unavailable, scan against local cache only
  - Show "offline" indicator
  - Queue scans for sync when back online

**Performance [HIGH]**
- [ ] Profile with React DevTools (check for unnecessary re-renders)
- [ ] Add `React.memo` to `HistoryScreen` list items
- [ ] Ensure camera doesn't run in background when on other screens
- [ ] Image caching via `expo-image` (already handles this, but verify)

**Accessibility Basics [HIGH]**
- [ ] Add `accessibilityLabel` to all Pressable/interactive elements
- [ ] Add `accessibilityRole` (button, link, header, image)
- [ ] Test with VoiceOver (iOS) / TalkBack (Android) for critical flows
- [ ] Ensure color contrast meets WCAG AA (all the green-on-dark text — verify ratios)

**QA Pass [HIGH]**
- [ ] Test on Android (API 28+) and iOS (16+)
- [ ] Test cold start, background/foreground transitions
- [ ] Test with poor network (throttled connection)
- [ ] Test camera permission denial → re-granting
- [ ] Test very long product names, missing images, malformed API responses

**Beta Build [CRITICAL]**
- [ ] Configure EAS Build:
  ```bash
  npx eas-cli build:configure
  ```
  Create `eas.json`:
  ```json
  {
    "cli": { "version": ">= 3.0.0" },
    "build": {
      "development": {
        "distribution": "internal",
        "android": { "buildType": "apk" },
        "ios": { "simulator": true }
      },
      "preview": {
        "distribution": "internal"
      },
      "production": {}
    }
  }
  ```
- [ ] Build preview APK for Android testers
- [ ] Build for iOS TestFlight (requires Apple Developer account — $99/year)
- [ ] Set up EAS Update for OTA fixes during beta

#### ⚠️ Blockers
- iOS TestFlight requires Apple Developer Program enrollment ($99/year). If budget is tight, Android-first beta is fine.
- EAS Build free tier: 30 builds per month. Don't waste builds — test locally via `npx expo run:android` first.

#### 📊 Success Metrics
- Zero crashes in 50-product test suite
- Average scan-to-result time < 3 seconds (from barcode detection to score display)
- History loads in < 500ms with 100+ cached products
- VoiceOver can navigate all screens and read all scores
- Beta APK installs and runs on a non-developer device

---

### Sprint 6: Week 13 — "Beta Launch"

**Theme:** Ship to beta testers, collect feedback, prepare for iteration.

#### ✅ Deliverables
- 10-20 beta testers using the app
- Feedback collection mechanism in place
- Analytics tracking key user actions
- Known issues documented
- Post-beta iteration plan

#### 🔧 Technical Tasks

**Beta Distribution [CRITICAL]**
- [ ] Android: Distribute APK via EAS Build internal distribution or Google Play Internal Testing
- [ ] iOS: TestFlight internal testing (up to 25 testers without App Review)
- [ ] Create simple landing page (GitHub Pages or Vercel — free):
  - What ECOTRACE is
  - Download links for beta
  - Methodology overview
  - "This is a beta" disclaimers

**Feedback Collection [HIGH]**
- [ ] Add in-app feedback button (Settings → "Send Feedback"):
  - Opens email compose with pre-filled subject: "ECOTRACE Beta Feedback"
  - Or use a free Typeform/Google Form
- [ ] Track which products users scan most (anonymized, aggregated)
- [ ] Track methodology page views (are users reading it?)

**Analytics [MEDIUM]**
- [ ] Add basic event tracking (Supabase can log custom events, or use PostHog free tier):
  - `scan_started`, `scan_completed`, `scan_failed`
  - `product_found`, `product_not_found`
  - `audit_viewed`, `methodology_viewed`
  - `score_shared`

**Bug Triage [HIGH]**
- [ ] Monitor Sentry for crash reports daily
- [ ] Create a prioritized bug list from beta feedback
- [ ] Ship OTA fixes via EAS Update for non-native bugs

#### ⚠️ Blockers
- Finding beta testers: Start with friends/family who buy groceries regularly. Aim for 10 testers minimum who will actually use it for a week.
- TestFlight review can take 24-48 hours for first submission.

#### 📊 Success Metrics
- 10+ beta testers with the app installed
- 100+ real product scans logged across all testers
- Feedback survey completed by >50% of testers
- Zero P0 (app crash) bugs in production
- Methodology page viewed by >30% of users

---

## 3. Critical Code Refactoring Guide

### 3.1 Navigation Refactor — Expo Router [CRITICAL]

The current app stuffs everything into `index.tsx` with manual `useState` navigation. Here's the full migration plan.

**Target file structure:**
```
app/
├── _layout.tsx          (Root layout — fonts, error boundary, providers)
├── onboarding.tsx       (First-launch onboarding)
├── parsing.tsx          (Scanning animation — presented as modal)
├── methodology.tsx      (Scoring methodology page)
├── (tabs)/
│   ├── _layout.tsx      (Tab navigator layout)
│   ├── scanner.tsx      (Scanner/camera screen)
│   ├── history.tsx      (Scan history)
│   └── settings.tsx     (Settings & about)
├── impact/
│   └── [id].tsx         (Product impact detail)
├── audit/
│   └── [id].tsx         (Deep audit detail)
└── auth/
    ├── sign-in.tsx
    └── sign-up.tsx
```

**Step 1: Create the tab layout** — `app/(tabs)/_layout.tsx`:

```tsx
import { Tabs } from "expo-router";
import { Scan, Clock, Settings as SettingsIcon } from "lucide-react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0f172a",
          borderTopColor: "rgba(255,255,255,0.1)",
          borderTopWidth: 1,
          paddingBottom: 20,
          paddingTop: 12,
          height: 70,
        },
        tabBarActiveTintColor: "#10b981",
        tabBarInactiveTintColor: "rgba(255,255,255,0.4)",
        tabBarLabelStyle: {
          fontFamily: "SpaceMono-Regular",
          fontSize: 10,
          letterSpacing: 1,
          textTransform: "uppercase",
        },
      }}
    >
      <Tabs.Screen
        name="scanner"
        options={{
          title: "Scanner",
          tabBarIcon: ({ color }) => <Scan size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color }) => <Clock size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <SettingsIcon size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
```

**Step 2: Migrate screens to routes.**

Each screen becomes its own file. Navigation via `router.push()`:

```tsx
// app/(tabs)/scanner.tsx
import { router } from "expo-router";

export default function ScannerTab() {
  const handleScan = (barcode: string) => {
    // Navigate to parsing animation, passing the barcode
    router.push({ pathname: "/parsing", params: { barcode } });
  };

  return <ScannerScreen onScan={handleScan} />;
}
```

```tsx
// app/parsing.tsx (modal)
import { router, useLocalSearchParams } from "expo-router";

export default function ParsingModal() {
  const { barcode } = useLocalSearchParams<{ barcode: string }>();

  const handleComplete = (productId: string) => {
    router.replace({ pathname: "/impact/[id]", params: { id: productId } });
  };

  return <ParsingScreen barcode={barcode} onComplete={handleComplete} />;
}
```

```tsx
// app/impact/[id].tsx
import { router, useLocalSearchParams } from "expo-router";

export default function ImpactDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Fetch product by ID from cache/database

  const handleViewAudit = () => {
    router.push({ pathname: "/audit/[id]", params: { id } });
  };

  return <ImpactScreen product={product} onViewAudit={handleViewAudit} />;
}
```

**Step 3: Update root layout** — `app/_layout.tsx`:

```tsx
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "../global.css";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    "SpaceMono-Regular": require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="parsing"
          options={{ presentation: "modal", animation: "fade" }}
        />
        <Stack.Screen name="impact/[id]" />
        <Stack.Screen name="audit/[id]" />
        <Stack.Screen name="methodology" />
        <Stack.Screen name="onboarding" />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
```

**Step 4: Delete old files.**
- Delete `components/BottomNav.tsx` (replaced by Expo Router Tabs)
- Delete `context/AppContext.tsx` (dead code)
- Gut `app/index.tsx` — it should just redirect:
  ```tsx
  import { Redirect } from "expo-router";
  export default function Index() {
    return <Redirect href="/(tabs)/scanner" />;
  }
  ```

**Step 5: Create shared state.** Replace the old per-screen state with a lightweight store:
- [ ] Create `stores/scanStore.ts` using React context or Zustand (lightweight):
  ```bash
  npm install zustand
  ```
  ```typescript
  import { create } from "zustand";
  import type { ProductScan } from "@/types/product";

  interface ScanStore {
    currentProduct: ProductScan | null;
    scanHistory: ProductScan[];
    setCurrentProduct: (product: ProductScan) => void;
    addToHistory: (product: ProductScan) => void;
  }

  export const useScanStore = create<ScanStore>((set) => ({
    currentProduct: null,
    scanHistory: [],
    setCurrentProduct: (product) => set({ currentProduct: product }),
    addToHistory: (product) =>
      set((state) => ({ scanHistory: [product, ...state.scanHistory] })),
  }));
  ```

### 3.2 NativeWind: Remove It [MEDIUM]

**Recommendation: Remove NativeWind entirely.**

The codebase uses zero Tailwind classes. Every component uses inline React Native `style` objects. NativeWind adds complexity (PostCSS, babel plugin, nativewind-env.d.ts) for zero benefit.

**If you remove it:**

```bash
npm uninstall nativewind tailwindcss postcss autoprefixer
```

Then delete:
- `tailwind.config.js`
- `postcss.config.js`
- `nativewind-env.d.ts`
- `global.css` (or keep it empty)

Remove from `babel.config.js` any NativeWind preset (check if present).

**If you commit to it instead:**
You'd need to migrate all ~200+ inline style objects to className strings across every component. That's 2-3 days of tedious work with no user-facing benefit. Not worth it during the 90-day sprint.

**Verdict: Remove it. Save the bundle size. Revisit if/when you hire someone who prefers Tailwind.**

### 3.3 Error Boundaries [HIGH]

Create `components/ErrorBoundary.tsx`:

```tsx
import React, { Component, ErrorInfo, ReactNode } from "react";
import { View, Text, Pressable } from "react-native";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to Sentry when configured
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <View
            style={{
              flex: 1,
              backgroundColor: "#0f172a",
              alignItems: "center",
              justifyContent: "center",
              padding: 40,
            }}
          >
            <Text style={{ fontSize: 18, color: "#ffffff", fontWeight: "700", marginBottom: 8 }}>
              Something went wrong
            </Text>
            <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", textAlign: "center", marginBottom: 24 }}>
              {this.state.error?.message || "An unexpected error occurred."}
            </Text>
            <Pressable
              onPress={() => this.setState({ hasError: false, error: null })}
              style={{
                backgroundColor: "#10b981",
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: "#0f172a", fontWeight: "700" }}>Try Again</Text>
            </Pressable>
          </View>
        )
      );
    }

    return this.props.children;
  }
}
```

Wrap in `_layout.tsx`:
```tsx
<ErrorBoundary>
  <Stack screenOptions={{ headerShown: false }}>
    ...
  </Stack>
</ErrorBoundary>
```

### 3.4 Types Cleanup [MEDIUM]

Create `types/product.ts` — single source of truth for all product types:

```typescript
// types/product.ts
export interface MaterialOrigin {
  material: string;
  origin: string;
  verified: boolean;
  certification?: string;
  source?: string; // 'openfoodfacts', 'manual', 'estimated'
}

export interface AuditStep {
  id: string;
  title: string;
  description: string;
  status: "verified" | "flagged" | "pending";
  facility?: string;
  energySource?: string;
  certification?: string;
  emissions?: string;
  dataSource?: string; // where this info came from
}

export type ConfidenceLevel = "high" | "estimated" | "insufficient";

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
  status: "verified" | "flagged" | "pending";
  renewablePercent?: number;
  emissions?: string;
  transportDistance?: string;
  materials: MaterialOrigin[];
  auditSteps: AuditStep[];
  auditProgress: number;
  scoringBreakdown?: Record<string, number>;
  methodologyVersion: string;
}
```

Create `types/navigation.ts`:

```typescript
// types/navigation.ts
export type AppScreen = "scanner" | "parsing" | "impact" | "audit" | "history" | "settings";
```

Update all imports across the codebase to use `@/types/product` instead of `@/data/mockData`.

---

## 4. Environmental Methodology Framework

### 4.1 The Reality Check

You don't need a PhD. You need a **transparent, documented, defensible algorithm** that clearly states:
- What data it uses
- How it weighs each factor
- What it doesn't know
- How confident it is

The bar is not "perfect science." The bar is "more honest and useful than the greenwashing claims on the product packaging."

### 4.2 Phase 1 Methodology: "Honest & Simple" (Weeks 7-10)

**Name it: ECOTRACE Sustainability Index v0.1**

**Scope:** Food and beverage products available on Open Food Facts.

**Score range:** 0-100 (higher = more sustainable)

**Five factors, equally defensible:**

| Factor | Weight | Data Source | Scoring Logic |
|---|---|---|---|
| **Eco-Score** | 40% | Open Food Facts Eco-Score (A-E) | A=40, B=32, C=24, D=16, E=8, Unknown=20 (neutral) |
| **Packaging** | 20% | OFF `packaging_text` field | Recyclable=20, Partially=12, Non-recyclable=4, Unknown=10 |
| **Origin Distance** | 15% | OFF `origins` field + geocoding | Local (<500km)=15, Regional (<2000km)=10, International=5, Unknown=7 |
| **Processing Level** | 15% | NOVA group (1-4) | NOVA 1=15, 2=11, 3=7, 4=3 |
| **Certifications** | 10% | OFF labels (organic, fair trade, etc.) | +2 per recognized cert, max 10 |

**Total: 100 points maximum.**

**Confidence levels:**

| Level | Criteria |
|---|---|
| 🟢 **High** | Eco-Score exists + origin known + packaging known (3+ factors populated) |
| 🟡 **Estimated** | 2 factors populated, rest interpolated from category average |
| 🔴 **Insufficient** | Only 1 or 0 factors available — score is a category-level estimate, not product-specific |

**Why this methodology is credible:**
1. Eco-Score is developed by ADEME (French Environment Agency) — it's a real, peer-reviewed framework. You're not inventing your own LCA.
2. NOVA groups are from the University of São Paulo's Food Research Center.
3. Packaging is binary-ish and hard to get wrong.
4. You're transparent about weighting and confidence.
5. You're not claiming to know things you don't.

### 4.3 Phase 2 Methodology: "The Aspiration" (Post-MVP)

What to build toward over 6-12 months:

- **Full LCA integration:** Partner with an LCA database (Ecoinvent is the gold standard, but expensive). Or use the free GHG Protocol tools.
- **Brand-level scoring:** Overlay company-level sustainability ratings (CDP scores, Science Based Targets).
- **User corrections:** Let users flag inaccurate data and submit corrections (community-sourced quality).
- **Regional calibration:** The same product shipped to different countries has different transport footprints.
- **Water footprint:** Currently omitted. Add when credible data sources become available.

### 4.4 Methodology Communication Template

Put this in-app (the `methodology.tsx` screen):

```
ECOTRACE Sustainability Index v0.1

HOW WE SCORE

Your score is calculated from five publicly available data points:

1. Environmental Impact (40%)
   Based on the Eco-Score, developed by ADEME (French Environment
   Agency). This accounts for lifecycle environmental impacts
   including climate change, biodiversity, and resource use.
   Source: Open Food Facts / ADEME

2. Packaging (20%)
   Assessed from declared packaging materials. Products with
   recyclable or minimal packaging score higher.
   Source: Open Food Facts product data

3. Origin & Transport (15%)
   Estimated from declared production origin. Products sourced
   closer to your region score higher due to lower transport emissions.
   Source: Open Food Facts origin data

4. Processing Level (15%)
   Based on the NOVA food classification system (University of São
   Paulo). Less processed foods score higher.
   Source: Open Food Facts / NOVA

5. Certifications (10%)
   Bonus points for recognized environmental and ethical certifications
   (organic, fair trade, rainforest alliance, etc.).
   Source: Open Food Facts label data

WHAT WE DON'T KNOW

- Water footprint is not currently included
- Transport mode (air vs. sea vs. rail) is estimated, not verified
- Supply chain labor practices are not assessed
- Scores are based on product category data, not brand-specific audits

CONFIDENCE LEVELS

🟢 High Confidence — Most data points available for this specific product
🟡 Estimated — Some data interpolated from similar products
🔴 Insufficient Data — Score is a rough category estimate

Our methodology is open and evolving. We publish updates at
[methodology page URL]. Questions? Contact us.

Version: v0.1 | Last updated: [Date]
```

### 4.5 Existing Open Data Sources You Can Use Today

| Source | URL | What It Has | Cost | API? |
|---|---|---|---|---|
| Open Food Facts | openfoodfacts.org | 3M+ food products, Eco-Score, NOVA, ingredients, packaging | Free | Yes |
| Open Beauty Facts | openbeautyfacts.org | Cosmetics/personal care products | Free | Yes |
| Open Products Facts | openproductsfacts.org | General products (small DB) | Free | Yes |
| USDA FoodData Central | fdc.nal.usda.gov | Nutritional data (limited eco data) | Free | Yes |
| EPA GHGRP | ghgdata.epa.gov | US facility-level GHG emissions | Free | Bulk download |
| European Environment Agency | eea.europa.eu | EU environmental indicators | Free | Partial |
| World Bank Climate Data | climateknowledgeportal.worldbank.org | Country-level emissions data | Free | Yes |

**Start with Open Food Facts only.** It has the best API, the most products, and Eco-Score built in. Expand later.

---

## 5. Quick Wins Checklist

Exact changes, ready to execute. Ordered by file.

### 5.1 `app.json` [CRITICAL] — 5 minutes

Change these fields:

```json
{
  "expo": {
    "name": "ECOTRACE",
    "slug": "ecotrace",
    "scheme": "ecotrace",
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#0f172a"
      }
    },
    "plugins": [
      "expo-router",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#0f172a"
        }
      ],
      "expo-font",
      "expo-web-browser"
    ]
  }
}
```

### 5.2 `package.json` [CRITICAL] — 1 minute

```json
"name": "ecotrace",
```

### 5.3 `app/_layout.tsx` [HIGH] — 5 minutes

Remove the `tempobook` check and fix StatusBar:

```tsx
// BEFORE
<Stack
  screenOptions={({ route }) => ({
    headerShown: !route.name.startsWith("tempobook"),
  })}
>

// AFTER
<Stack screenOptions={{ headerShown: false }}>
```

Change StatusBar:
```tsx
// BEFORE
<StatusBar style="auto" />

// AFTER
<StatusBar style="light" />
```

Remove duplicate font loading from `app/index.tsx` (lines 22-24):
```tsx
// DELETE this from index.tsx — it's already loaded in _layout.tsx
const [fontsLoaded] = useFonts({
  'SpaceMono-Regular': require('@/assets/fonts/SpaceMono-Regular.ttf'),
});
```

### 5.4 `screens/ScannerScreen.tsx` [HIGH] — 2 minutes

Line ~79: Change header text:
```tsx
// BEFORE
NEURAL SCANNER v2.4

// AFTER
ECOTRACE SCANNER
```

### 5.5 `screens/ParsingScreen.tsx` [HIGH] — 2 minutes

Change ~line 130:
```tsx
// BEFORE
NEURAL PARSING...

// AFTER
ANALYZING...
```

Change ~line 117:
```tsx
// BEFORE
NEURAL SCANNER v2.4

// AFTER
ECOTRACE SCANNER
```

### 5.6 `components/BottomNav.tsx` [CRITICAL] — 5 minutes

Fix the broken Settings tab (line 14):

```tsx
// BEFORE
const NAV_ITEMS: { screen: AppScreen; label: string; Icon: any }[] = [
  { screen: 'scanner', label: 'Scanner', Icon: Scan },
  { screen: 'history', label: 'History', Icon: Clock },
  { screen: 'impact', label: 'Impact', Icon: BarChart3 },
  { screen: 'scanner', label: 'Settings', Icon: Settings },
];

// AFTER — replace 'impact' with 'settings', remove broken Settings entry
const NAV_ITEMS: { screen: AppScreen; label: string; Icon: any }[] = [
  { screen: 'scanner', label: 'Scanner', Icon: Scan },
  { screen: 'history', label: 'History', Icon: Clock },
  { screen: 'settings', label: 'Settings', Icon: Settings },
];
```

> Note: Remove the Impact tab from bottom nav — Impact is accessed by tapping a scan result, not via tab navigation. This eliminates the confusing "no product selected" redirect.

### 5.7 Add Haptic Feedback [LOW] — 5 minutes

In `screens/ScannerScreen.tsx`, add to the scan button:

```tsx
import * as Haptics from 'expo-haptics';

const handlePressOut = () => {
  buttonPressed.value = withSpring(1);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  onScan();
};
```

### 5.8 Add Demo Banner [CRITICAL] — 15 minutes

Create `components/DemoBanner.tsx`:

```tsx
import React from "react";
import { View, Text } from "react-native";
import { AlertTriangle } from "lucide-react-native";

export default function DemoBanner() {
  return (
    <View
      style={{
        backgroundColor: "rgba(245,158,11,0.15)",
        borderBottomWidth: 1,
        borderBottomColor: "rgba(245,158,11,0.3)",
        paddingHorizontal: 16,
        paddingVertical: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      <AlertTriangle size={14} color="#f59e0b" />
      <Text
        style={{
          fontFamily: "SpaceMono-Regular",
          fontSize: 10,
          color: "#f59e0b",
          letterSpacing: 1,
        }}
      >
        DEMO MODE — SAMPLE DATA ONLY
      </Text>
    </View>
  );
}
```

Add to top of `ScannerScreen`, `ImpactScreen`, and `HistoryScreen`.

### 5.9 Delete Dead Code [MEDIUM] — 5 minutes

- Delete `context/AppContext.tsx`
- Update `components/BottomNav.tsx` import to use local type:
  ```tsx
  // BEFORE
  import type { AppScreen } from '@/context/AppContext';
  // AFTER
  type AppScreen = 'scanner' | 'history' | 'settings';
  ```

---

## 6. Risk Mitigation Strategy

### 6.1 Disclaimer Language [CRITICAL]

Add to the Settings / About screen and to the onboarding final slide:

```
IMPORTANT DISCLAIMER

ECOTRACE scores are estimates based on publicly available product
data from Open Food Facts and other open databases. Scores are NOT
certified environmental assessments and should not be treated as
definitive environmental impact ratings.

Our methodology (v0.1) is transparent and evolving. We use the
Eco-Score framework developed by ADEME and other peer-reviewed
data sources. However:

• Data accuracy depends on open-source community contributions
• Not all products have complete environmental data
• Scores may change as our methodology improves
• ECOTRACE is not affiliated with any certification body

For certified environmental assessments, consult accredited
organizations like the Carbon Trust, FSC, or your regional
environmental agency.

By using ECOTRACE, you acknowledge that scores are informational
estimates, not verified environmental claims.
```

### 6.2 UI Patterns for Data Integrity [CRITICAL]

| Data State | UI Treatment |
|---|---|
| **Verified data** (from OFF with high completeness) | Green shield icon + "Verified" badge (as-is) |
| **Estimated data** (interpolated) | Yellow clock icon + "Estimated" badge + "?" tooltip |
| **Insufficient data** | Red info icon + "Limited Data" badge + explanation text |
| **Demo/Mock data** | Orange banner "DEMO MODE — SAMPLE DATA ONLY" |
| **User-submitted data** | Blue user icon + "Community Contributed" badge |
| **Stale data** (>6 months old) | Gray text: "Last updated [date] — may not reflect current product" |

**Every single data point should have provenance.** On the audit screen, each step should show where the data came from:

```
📦 Packaging Assessment
   Packaging: Plastic bottle (PET), Plastic cap (PP)
   ── Source: Open Food Facts (community-verified)
   ── Last updated: 2025-11-23
```

### 6.3 Compliance Considerations [HIGH]

**FTC Green Guides (USA):**
- You're safe as long as you don't make absolute claims ("this product IS sustainable")
- Use language like "estimated sustainability score" and "based on available data"
- Never imply certification you don't have
- The disclaimer in 6.1 covers your basic obligations

**EU Green Claims Directive (2025+):**
- More stringent — claims must be substantiated by recognized scientific evidence
- Since you're using ADEME's Eco-Score framework, your claims ARE based on recognized science
- Always cite your methodology and data sources
- The key requirement: "environmental claims must be specific, not generic"
  - ✅ "This product scored 72/100 based on Eco-Score, packaging, and transport data"
  - ❌ "This product is sustainable" / "This product is eco-friendly"

**App Store Guidelines:**
- Apple and Google both prohibit misleading claims about app functionality
- The "Demo Mode" banner satisfies this during prototype phase
- When you have real data, remove the banner but keep confidence indicators

**My recommendation:**
1. Never use the word "sustainable" as an absolute claim in the app
2. Always say "sustainability score" or "environmental impact estimate"
3. Always show the data source
4. Always show the confidence level
5. Link to the full methodology from every score

### 6.4 What Happens If Your Score Is Wrong?

This is the core risk. Mitigation:

1. **"Scores are estimates" language everywhere** — you're never claiming certainty
2. **User correction mechanism** — "Think this score is wrong? Tell us" button on every product
3. **Methodology versioning** — when you improve the algorithm, re-score and show "Score updated"
4. **No binary "good/bad" labels at beta** — only numerical scores. The color coding (green/amber/red) is OK as a visual aid, but avoid text labels like "SAFE" or "DANGEROUS"
5. **Regular methodology review** — schedule a quarterly review even if it's just you reading environmental science papers for a weekend

---

## 7. Realistic Scope Reduction

### 7.1 Absolute Minimum Viable Feature Set (The "Must Ship" List)

If you have to cut scope, this is the non-negotiable core:

| Feature | Why Non-Negotiable |
|---|---|
| Real barcode scanning (camera) | Without it, you don't have a product |
| Product lookup (Open Food Facts) | Without it, you're serving fake data |
| A score with documented methodology | Without it, you're greenwashing |
| Confidence indicators | Without it, you're overstating accuracy |
| Local scan history (persisted) | Without it, the app is useless after closing |
| "Product not found" flow | Without it, app crashes or confuses 30%+ of scans |
| "Demo" or "Beta" indicator | Without it, you're liable for misleading claims |
| Settings with methodology link | Without it, no transparency |

**What you CAN ship without:**
- User accounts / cloud sync (local-only is fine for beta)
- Share functionality (nice-to-have, not critical)
- Audit trail detail screen (show a simplified version)
- Onboarding (OK to skip if the UI is self-explanatory)
- Sentry/analytics (useful but not user-facing)
- Push notifications (definitely defer)
- Multi-category support (food-only is fine)

### 7.2 What to Defer Post-MVP

| Audit Finding | Defer? | Reasoning |
|---|---|---|
| Multi-category scanning (fashion, electronics) | ✅ Defer | No good open data for non-food. Don't fake it. |
| User accounts + cloud sync | ✅ Defer | Local storage covers beta needs. Auth adds 1-2 weeks. |
| Full accessibility audit | ⚠️ Partial defer | Add basic labels now, full audit post-beta |
| Product images | ⚠️ Partial defer | OFF has images — show them. Don't build a custom system. |
| Dark/light theme toggle | ✅ Defer | Dark-only is fine. Users expect it from "tech" apps. |
| Community contributions | ✅ Defer | Requires moderation system. Way too much for MVP. |
| Alternative product suggestions | ✅ Defer | Requires cross-product comparison engine. That's a product in itself. |
| Product comparison feature | ✅ Defer | Would require scanning two products — adds complexity. |
| Privacy policy / ToS | ⚠️ Partial defer | Need a basic version for beta. Full legal review for App Store. |

### 7.3 "Beta-Ready" vs. "App Store Ready"

| Requirement | Beta-Ready | App Store Ready |
|---|---|---|
| **Core functionality** | Works for food products via OFF API | Works for 2+ categories, graceful fallbacks for all |
| **Auth** | Optional (local-only OK) | Required (cloud sync, account management) |
| **Legal** | In-app disclaimer + beta banner | Full privacy policy, ToS, data handling disclosure |
| **Design** | Current quality is fine | Proper app icon, store screenshots, video preview |
| **Testing** | Manual testing on 2-3 devices | Automated test suite, tested on 10+ device profiles |
| **Performance** | No crashes, acceptable speed | Profiled, optimized, meets Apple/Google perf guidelines |
| **Accessibility** | Basic labels on interactive elements | Full WCAG AA compliance, screen reader tested |
| **Analytics** | Optional | Required for understanding user behavior |
| **Error handling** | Error boundary + basic retry | Comprehensive: network, server, permission, storage errors |
| **App Store metadata** | N/A | Description, keywords, screenshots, ratings setup |
| **Review compliance** | N/A | Apple: no misleading claims, proper permissions. Google: similar. |

**Bottom line:** Beta-ready in 90 days is realistic for a solo developer. App Store ready is another 4-6 weeks after beta feedback.

### 7.4 The 90-Day Calendar Summary

```
Week  1-2:  ████ Branding, cleanup, navigation refactor
Week  3-4:  ████ Real camera + barcode scanning + local persistence
Week  5-6:  ████ Open Food Facts integration + onboarding + error states
Week  7-8:  ████ Supabase backend + scoring engine v0.1 + auth
Week  9-10: ████ Audit trail + methodology page + confidence + sharing
Week 11-12: ████ Integration testing + polish + accessibility + beta build
Week    13: ██   Beta distribution + feedback collection

Total new files:      ~25-30
Total modified files:  ~15
New dependencies:      ~8 (expo-camera, supabase-js, mmkv, zustand, sentry, expo-sharing, expo-view-shot, eas-cli)
Lines of code added:   ~3,000-4,000
```

### 7.5 If You Fall Behind

**Week 6 checkpoint: "Can I scan a real product and see real data?"**
- If yes: You're on track. Proceed with backend work.
- If no: Skip auth/cloud sync entirely. Ship a local-only beta with OFF API calls directly from the client. This is less secure and less scalable, but it works for 10-20 beta testers.

**Week 10 checkpoint: "Does the scoring engine produce sensible results?"**
- If yes: Proceed with polish and beta prep.
- If no: Simplify the scoring to a direct passthrough of OFF's Eco-Score (A→90, B→70, C→50, D→30, E→10). Add your own factors in a post-beta update.

**The nuclear option (Week 11 emergency):**
Ship with: camera scanning + OFF data display + Eco-Score passthrough + local storage. No custom scoring, no backend, no auth. This is still infinitely better than a mock data demo.

---

*End of Roadmap — Now go build it.*
