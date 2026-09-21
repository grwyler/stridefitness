const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const source=fs.readFileSync('lib/day-completion.ts','utf8'),compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,moduleBox={exports:{}};
vm.runInNewContext(compiled,{module:moduleBox,exports:moduleBox.exports,Date});
const {isDayComplete,setDayComplete}=moduleBox.exports,day='2026-09-18',completed=setDayComplete([],day,true,'2026-09-18T23:00:00.000Z');
assert(isDayComplete(completed,day));assert(!isDayComplete(completed,'2026-09-19'));assert.equal(setDayComplete(completed,day,false).length,0);
console.log('PASS: day completion is explicit, date-specific, and reversible.');
