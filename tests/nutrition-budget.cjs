const assert=require('node:assert/strict'),ts=require('typescript'),fs=require('node:fs'),vm=require('node:vm');
const code=ts.transpileModule(fs.readFileSync('lib/nutrition.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,m={exports:{}};
vm.runInNewContext(code,{exports:m.exports,module:m,require,Date});
const base={entries:[],calorieTarget:2200,proteinTarget:165};
assert.deepEqual({...m.exports.calorieBudget(base,1000)},{percent:0,adjustment:0,budget:2200});
assert.deepEqual({...m.exports.calorieBudget({...base,activityCalorieAdjustment:50},1000)},{percent:50,adjustment:500,budget:2700});
assert.deepEqual({...m.exports.calorieBudget({...base,activityCalorieAdjustment:100},1000)},{percent:100,adjustment:1000,budget:3200});
assert.equal(m.exports.calorieBudget({...base,calorieTarget:null,activityCalorieAdjustment:50},1000).budget,null);
console.log('PASS: activity calories adjust today\'s budget only when the user enables a clear percentage.');
