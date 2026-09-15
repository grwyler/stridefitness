const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const source=fs.readFileSync('lib/weight-units.ts','utf8'),compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,moduleBox={exports:{}};
vm.runInNewContext(compiled,{module:moduleBox,exports:moduleBox.exports});
const {explicitKilograms,normalizePoundValue}=moduleBox.exports,kg=explicitKilograms([{content:'Use 100 kg for the next set and 22.5 kilograms for curls.'}]);
assert.deepEqual([...kg],[100,22.5]);assert.equal(normalizePoundValue(100,kg),220.5);assert.equal(normalizePoundValue(22.5,kg),49.5);assert.equal(normalizePoundValue(225,kg),225);assert.equal(normalizePoundValue(null,kg),null);
console.log('PASS: explicit kilogram inputs are converted to pound values before becoming coach targets.');
