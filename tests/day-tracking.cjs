const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const source=fs.readFileSync('lib/day-tracking.ts','utf8'),compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,moduleBox={exports:{}};
vm.runInNewContext(compiled,{module:moduleBox,exports:moduleBox.exports});
const {tracked,trackedItems}=moduleBox.exports;
assert.equal(tracked(undefined,'nutrition'),true,'legacy accounts retain their existing nutrition completion workflow');
assert.equal(tracked(undefined,'weight'),false,'legacy accounts are not prompted to weigh in');
assert.deepEqual([...trackedItems({nutrition:true,activity:true})],['nutrition','activity']);
assert.equal(tracked({nutrition:true,weight:false},'weight'),false,'an explicit opt-out remains off');
console.log('PASS: daily tracking is opt-in per item and preserves legacy nutrition confirmation.');
