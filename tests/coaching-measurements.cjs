const assert=require('node:assert/strict'),ts=require('typescript'),fs=require('node:fs'),vm=require('node:vm');
const code=ts.transpileModule(fs.readFileSync('lib/coaching-updates.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,m={exports:{}};
vm.runInNewContext(code,{exports:m.exports,module:m,require});
const update=m.exports.coachingUpdatesSchema.parse({profile:[],goal:null,nutrition:null,measurement:{date:null,weight:187,bodyFat:null}});
assert.equal(update.measurement.weight,187);
const height=m.exports.coachingUpdatesSchema.parse({profile:[],goal:null,nutrition:null,measurement:{date:null,weight:null,bodyFat:null,heightInches:73}});assert.equal(height.measurement.heightInches,73);
assert.throws(()=>m.exports.coachingUpdatesSchema.parse({profile:[],goal:null,nutrition:null,measurement:{date:null,weight:-1,bodyFat:null}}));
assert.match(m.exports.savingInstructions,/body weight/);
console.log('PASS: explicit body measurements can be offered for confirmation and invalid values are rejected.');
