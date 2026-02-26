# ECOTRACE Technical Assessment: Rules vs. Machine Learning

## Current Implementation Status

### ❌ NOT Machine Learning
The current system uses:
- **Hardcoded heuristics** (pre-defined rules)
- **Pattern matching** (regex, string includes)
- **Fixed scoring tables** (CATEGORY_BASELINES)
- **Zero training or learning from data**

**Files affected:**
- `services/mlPrediction.ts` → Should be `services/heuristicScoring.ts`
- `services/ocrService.ts` → Already honest (it's just regex)
- `services/scoring.ts` → Rules-based scoring (not ML)

### ✅ What It Actually Is
A **Rules-Based Expert System** / **Heuristic Scoring Engine**

This is legitimate software engineering, but it's NOT machine learning.

---

## If You Need ACTUAL Machine Learning

### Option A: On-Device ML with TensorFlow.js

**Install required packages:**
```bash
npm install @tensorflow/tfjs @tensorflow/tfjs-react-native
expo install expo-gl
```

**Train a model** (in Python/Colab):
```python
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
import tensorflowjs as tfjs

# Load Open Food Facts data
df = pd.read_csv('openfoodfacts.csv')

# Features: category, has_organic, packaging_type, origin_distance
X = df[['category_encoded', 'organic', 'recyclable', 'transport_km']]
y = df['ecoscore_score']

# Train model
model = RandomForestRegressor(n_estimators=100)
model.fit(X, y)

# Export to TensorFlow.js format
tfjs.converters.save_keras_model(model, 'model')
```

**Use in app:**
```typescript
import * as tf from '@tensorflow/tfjs';
import { bundleResourceIO } from '@tensorflow/tfjs-react-native';

const model = await tf.loadLayersModel(
  bundleResourceIO(modelJSON, modelWeights)
);

const prediction = model.predict(
  tf.tensor2d([[category, organic, recyclable, distance]])
);

const score = await prediction.data();
```

### Option B: Cloud ML API (Genuine ML)

**Use Hugging Face Inference API** (free tier):
```typescript
async function predictWithML(text: string) {
  const response = await fetch(
    'https://api-inference.huggingface.co/models/distilbert-base-uncased',
    {
      headers: { Authorization: 'Bearer YOUR_HF_TOKEN' },
      method: 'POST',
      body: JSON.stringify({ inputs: text }),
    }
  );
  return await response.json();
}
```

### Option C: Train Custom Model (Most Legitimate)

**Step 1: Collect Training Data**
```python
# Download Open Food Facts dataset
import requests
url = 'https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv'
df = pd.read_csv(url, sep='\t', low_memory=False)

# Select 10,000 products with eco-scores
training_data = df[df['ecoscore_score'].notna()].sample(10000)
```

**Step 2: Feature Engineering**
```python
features = {
    'category': training_data['categories_tags'],
    'has_organic': training_data['labels_tags'].str.contains('organic'),
    'recyclable_packaging': training_data['packaging_tags'].str.contains('recyclable'),
    'nova_group': training_data['nova_group'],
    'origin_distance': estimate_distance(training_data['origins']),
}

X = pd.DataFrame(features)
y = training_data['ecoscore_score']
```

**Step 3: Train Model**
```python
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

model = GradientBoostingRegressor(
    n_estimators=100,
    learning_rate=0.1,
    max_depth=5
)

model.fit(X_train, y_train)
print(f"R² Score: {model.score(X_test, y_test)}")
```

**Step 4: Export for Mobile**
```python
import coremltools as ct

# Convert to Core ML (iOS)
coreml_model = ct.converters.sklearn.convert(
    model, 
    input_features=['category', 'organic', 'recyclable', 'nova', 'distance'],
    output_feature_names=['ecoscore_prediction']
)
coreml_model.save('SustainabilityModel.mlmodel')

# Or TensorFlow.js (cross-platform)
import tensorflowjs as tfjs
tfjs.converters.save_sklearn_model(model, 'tfjs_model')
```

---

## Honest Documentation Changes

### Rename Files:
- `services/mlPrediction.ts` → `services/heuristicScoring.ts`
- Update all imports

### Update Comments:
```typescript
// services/heuristicScoring.ts — Rules-based sustainability scoring
//
// NOTE: This is NOT machine learning. It uses predefined category baselines
// and hardcoded heuristics to estimate scores when product data is unavailable.
//
// For true ML implementation, see: documentation/ML_IMPLEMENTATION_ROADMAP.md
```

### Update README:
```markdown
## Technology Stack

- ✅ **Barcode Scanning** - expo-camera with on-device detection
- ✅ **Product Database** - Open Food Facts API
- ✅ **Heuristic Scoring** - Rules-based expert system
- ⏳ **Machine Learning** - Planned for Phase 2 (TensorFlow.js)
```

---

## Timeline Comparison

### Current (Rules-Based) - Already Working
- ✅ 0 hours implementation
- ✅ Works offline
- ✅ Fast inference
- ❌ NOT machine learning
- ❌ Can't improve from data

### Real ML Implementation - Requires Work
- ⏱️ 8-16 hours implementation
- ⏱️ Model training required
- ⏱️ Data collection needed
- ✅ Genuine machine learning
- ✅ Improves with more data
- ✅ Can be cited in academic work

---

## Recommendation

**If this is for academic evaluation:**
1. Either implement real ML (Options A/B/C above)
2. Or clearly label as "Expert System" not "ML"

**If this is for production:**
- Rules-based is fine for MVP
- Add ML in Phase 2 when you have user data to train on

**If your professor checks:**
- They WILL see no ML libraries in package.json
- They WILL read the code and see hardcoded rules
- Be honest: "Phase 1 uses heuristics, Phase 2 will add ML"

---

## Academic Integrity Note

**Don't claim this is ML if it's not.** Call it:
- ✅ "Rules-based expert system"
- ✅ "Heuristic scoring engine"
- ✅ "Category-based estimation"
- ❌ "Machine Learning" (unless you implement actual ML)

The documentation file `ECOTRACE_FREE_AI_IMPLEMENTATION_GUIDE.md` describes HOW to add ML, but none of it is actually implemented yet.
