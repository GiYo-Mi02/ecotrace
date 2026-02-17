# ECOTRACE AI Testing Guide

## ✅ How to Verify AI is Working

### Test 1: Category-Based Prediction (Simplest)
**Steps:**
1. Open app → Scanner tab
2. Enter fake barcode: `999999999999`
3. Tap "Scan" or "Search"
4. On "Product Not Found" screen, select category: **"Snacks"**
5. Tap "Get Estimated Score"

**Expected AI Output:**
- Score: ~35 (snacks baseline)
- Confidence: **"ESTIMATED"** (amber badge)
- Renewable: ~30%
- Emissions: ~1.5kg CO₂
- Audit shows: "Category baseline applied"

---

### Test 2: Full AI Analysis with Text Input
**Steps:**
1. From "Product Not Found", tap **"Add Product Details"**
2. Fill in form:
   - **Product Name:** Organic Almond Milk
   - **Category:** Beverages
   - **Label Text:** Paste this:
     ```
     USDA Organic Certified
     Non-GMO Project Verified
     100% recyclable carton
     Made in California
     No artificial flavors
     Vegan
     ```
3. Tap **"Analyze Text"** button
4. Observe the NLP analysis results
5. Tap **"Generate Score"**

**Expected AI Output:**
✅ **Certifications Detected:**
- USDA Organic
- Non-GMO
- Vegan

✅ **Packaging Analysis:**
- Recyclable carton (+6 points)

✅ **Origin:**
- California (local/USA → higher score)

✅ **Final Score:** 62-72 range (beverages baseline 52 + bonuses)

✅ **Confidence:** "ESTIMATED" (partial data)

---

### Test 3: Greenwashing Detection
**Steps:**
1. Add product with label text:
   ```
   100% Natural
   Eco-friendly
   Green product
   Sustainably made
   Good for the planet
   ```
2. Tap "Analyze Text"

**Expected AI Output:**
⚠️ **Greenwashing Flags:**
- "Natural" - vague claim without certification
- "Eco-friendly" - unverified environmental claim
- "Green" - misleading without third-party proof
- "Sustainable" - vague, not specific

✅ **Certifications Detected:** None (0)

✅ **Warning Count:** 4-5 flags

---

### Test 4: High-Quality Product (Best Score)
**Test Input:**
```
EU Organic Certification
Fair Trade Certified
Rainforest Alliance
FSC Certified Packaging
100% Recycled Glass Bottle
Carbon Neutral Product
Locally Sourced - France
Vegan Certified
```

**Expected AI Output:**
- Score: **75-85** (very high)
- Certifications: 6-8 detected
- Packaging bonus: +13 points (glass + recycled + recyclable)
- Transport: +12-15 (local)
- Confidence: "ESTIMATED" (good data coverage)

---

### Test 5: Low-Quality Product (Worst Score)
**Test Input:**
```
Imported from Asia
Mixed plastic packaging
Non-recyclable
Contains palm oil
Ultra-processed
No certifications
```

**Expected AI Output:**
- Score: **15-25** (very low)
- Packaging penalty: -8 (plastic + non-recyclable)
- Transport penalty: -6 (long distance)
- No certification bonuses: 0
- Confidence: "LIMITED DATA"

---

## 🔍 Console Log Checks

If you can access logs, look for:

```
[ML] Predicting score for: <product name>
[ML] Category matched: <category>
[ML] Packaging signals: [glass, recyclable, ...]
[ML] Cert signals: [organic, fair-trade, ...]
[ML] Final score: XX/100
[ML] Confidence: estimated
[ML] Data points used: X
```

---

## 📱 In-App Indicators

### ✅ AI IS WORKING:
- Confidence badges appear (HIGH/ESTIMATED/LIMITED)
- Scores change based on input text
- Certifications auto-detected from text
- Greenwashing warnings show up
- Audit trail shows calculation steps
- Different categories give different baseline scores

### ❌ AI IS BROKEN:
- All scores are exactly the same (e.g., always 50)
- No certifications detected even with keywords
- Confidence is always "HIGH" or always missing
- No audit trail/breakdown
- Greenwashing flags never appear
- Text analysis doesn't extract anything

---

## 🧪 Advanced: Compare Two Products

**Product A (Good):**
- Category: Organic
- Text: "EU Organic, Fair Trade, Glass jar, France"
- Expected: 68-78 score

**Product B (Bad):**
- Category: Snacks
- Text: "Plastic wrap, Imported from Asia, Ultra-processed"
- Expected: 18-28 score

**Difference should be 40+ points** — proves AI is scoring correctly.

---

## 📊 Audit Trail Check

Tap "View Audit Trail" button on Impact screen.

**You should see steps like:**

1. ✓ Product Identification
   - Category: Beverages → Baseline 52/100
   
2. ✓ Packaging Assessment
   - Glass: +8
   - Recyclable: +5
   - Subtotal: +13
   
3. ✓ Certification Verification
   - Organic: +6
   - Fair Trade: +5
   - Subtotal: +11
   
4. ✓ Transport Estimation
   - Origin: France → ~1,500km
   - Score: +12
   
5. ✓ Final Calculation
   - Base: 52
   - Adjustments: +36
   - **Final: 88/100**

---

## 🎯 Success Criteria

Your AI is **fully functional** if:

- [x] Category baselines apply (different scores for different categories)
- [x] Text analysis extracts 3+ certification types
- [x] Packaging keywords affect score (+/- 5-8 points)
- [x] Greenwashing detection flags 2+ vague claims
- [x] Confidence levels vary (HIGH/ESTIMATED/LIMITED)
- [x] Audit trail shows 5+ steps with actual data
- [x] Scores range from 15-85 across different product types

---

## 🐛 If AI Doesn't Work

Check:
1. `services/mlPrediction.ts` is imported correctly
2. `services/ocrService.ts` functions are called
3. No TypeScript errors in services folder
4. Console shows ML prediction logs
5. Product object has `confidence` and `auditSteps` fields
