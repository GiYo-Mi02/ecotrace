const path = require('path');
const data = require(path.join(__dirname, '..', 'data', 'realTrainingData.json'));
const p = data.products;

const catScores = {};
for (const prod of p) {
  for (const cat of prod.categories_tags) {
    if (!catScores[cat]) catScores[cat] = [];
    catScores[cat].push(prod.ecoscore_score);
  }
}

const entries = Object.entries(catScores)
  .filter(([k,v])=>v.length>=20)
  .map(([cat,scores])=>{
    const avg = scores.reduce((s,v)=>s+v,0)/scores.length;
    return {cat, score: (avg/100).toFixed(3), n: scores.length};
  })
  .sort((a,b)=>parseFloat(a.score)-parseFloat(b.score));

console.log('// Data-driven CATEGORY_ENV_SCORES — ' + entries.length + ' categories with n>=20');
for (const e of entries) {
  console.log("  '" + e.cat + "': " + e.score + ", // n=" + e.n);
}
