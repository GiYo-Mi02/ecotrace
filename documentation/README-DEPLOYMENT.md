# ECOTRACE Deployment Checklist

## Pre-Deployment Validation

### 1. Run Sync Validator
```bash
node scripts/validateSync.js
```
All checks must pass before deployment. This validates:
- Feature count consistency (NUM_FEATURES / INPUT_DIM = 40)
- Architecture match (40→256→128→64→1)
- Weight file dimensions and completeness
- Z-score normalization stats present
- BatchNorm parameters present
- Category score dictionary parity
- No training code in mobile inference

### 2. Retrain Model (if any feature changes)
```bash
node scripts/trainModel.js --epochs 300 --lr 0.001
```
After training, re-run sync validator.

### 3. Evaluate Model Quality
```bash
node scripts/evaluateModel.js
```
Minimum acceptable metrics:
- R² > 0.70
- MAE < 0.10 (10 points on 100-point scale)
- ±10pts accuracy > 70%

### 4. Check TypeScript Compilation
```bash
npx tsc --noEmit
```
No type errors allowed.

## File Sync Matrix

| File | Role | Must Match |
|------|------|------------|
| `scripts/trainModel.js` | Training pipeline (SOURCE OF TRUTH) | — |
| `services/featureEncoder.ts` | Mobile feature encoding | trainModel.js encodeProduct() |
| `services/tensorflowModel.ts` | Mobile NN inference | trainModel.js buildModel() |
| `services/mlPrediction.ts` | 3-tier prediction pipeline | featureEncoder.ts exports |
| `assets/ml/eco-score-model/weights.json` | Trained weights | trainModel.js output |

## Architecture Reference

```
Input (40 features, [0,1] range)
  ↓
Z-score normalization (featureMeans, featureStds)
  ↓
Dense(256) → BatchNorm → ReLU → Dropout(0.25)
  ↓
Dense(128) → BatchNorm → ReLU → Dropout(0.15)
  ↓
Dense(64)  → BatchNorm → ReLU
  ↓
Dense(1)   → Sigmoid → [0,1] output
  ↓
× 100 → Eco-Score (0-100)
```

## Feature Order (40 features)

| Index | Feature | Type |
|-------|---------|------|
| 0 | categoryEnvScore (data-driven) | continuous |
| 1 | novaGroupNormalized | continuous |
| 2 | isUltraProcessed | binary |
| 3 | ingredientComplexity | continuous |
| 4-8 | packaging (plastic/glass/cardboard/metal/compostable) | binary |
| 9 | packMaterialScore | continuous |
| 10-14 | certifications (organic/fairtrade/rainforest/ecolabel/msc) | binary |
| 15 | certCount normalized | continuous |
| 16 | originSustainability | continuous |
| 17 | hasLocal | binary |
| 18 | transportEstimate | continuous |
| 19 | manufacturingSustainability | continuous |
| 20 | isVegan | binary |
| 21 | isVegetarian | binary |
| 22 | hasPalmOil | binary |
| 23 | hasHighSugar | binary |
| 24 | hasHighSatFat | binary |
| 25 | hasHighSodium | binary |
| 26 | hasHighFat | binary |
| 27 | hasLowFat | binary |
| 28-39 | food groups (meat/fish/dairy/plant/fruitVeg/cereal/beverage/fatOil/sweet/canned/frozen/readyMeal) | binary |

## Common Issues

### "Input dimension mismatch: expected 40, got 28"
Old weights cached in AsyncStorage. Fix:
- Clear app data, or
- The model auto-rejects invalid cached weights on startup

### NaN predictions
Missing featureMeans/featureStds in weights.json. Re-run training.

### Low accuracy after re-training
- Check data/realTrainingData.json is complete (10K+ products)
- Verify ecoscore_score is present and in 0-100 range
- Run `node scripts/evaluateModel.js` for detailed diagnostics
