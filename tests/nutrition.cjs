const assert=require('node:assert/strict'),ts=require('typescript'),fs=require('node:fs'),vm=require('node:vm');
const code=ts.transpileModule(fs.readFileSync('lib/nutrition.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,m={exports:{}};
vm.runInNewContext(code,{exports:m.exports,module:m,require,Date,Math,Number,Set});
const {nutritionTotals,recentFoods}=m.exports;
const entry=(id,date,name,calories,protein)=>({id,date,name,calories,protein});
const rows=[
 entry('1','2026-09-11','Protein shake',250,35),
 entry('2','2026-09-12','Chicken bowl',610,48),
 entry('3','2026-09-13','protein shake',250,35),
 entry('4','2026-09-13','Protein shake',300,42),
 entry('5','2026-09-14','Daily total',1900,160),
 entry('6','2026-09-14','',100,null),
];
const recent=recentFoods(rows);
assert.deepEqual(Array.from(recent,x=>x.id),['4','3','2']);
assert.equal(recentFoods(rows,2).length,2);
assert.equal(JSON.stringify(nutritionTotals(rows,'2026-09-14')),JSON.stringify({count:2,calories:2000,protein:160,missingCalories:false,missingProtein:true}));
assert.equal(rows.length,6);
console.log('PASS: recent foods are one-tap-ready, latest-first, de-duplicated, and exclude unnamed or daily-total entries.');
