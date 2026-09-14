const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),vm=require('node:vm');
const cache={};function load(file){file=path.resolve(file);if(cache[file])return cache[file].exports;const m=cache[file]={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:m.exports,module:m,require:n=>n.startsWith('.')?load(path.resolve(path.dirname(file),n)+'.ts'):require(n),console,crypto:require('node:crypto').webcrypto});return m.exports}
const {applyTemplateEdit}=load('lib/template-coach.ts'),{initialData}=load('lib/training.ts');
const data=initialData(),id=data.exercises[0].id;
const before={id:'target',name:'Upper',description:'Original',entries:[{exerciseId:id,sets:3,reps:8,weight:35}]};
data.templates=[before,{...before,id:'other',name:'Lower'}];data.workouts=[{id:'history',entries:[]}];
const plan={message:'Proposed',saveUpdates:null,progress:null,workouts:[{...before,entries:[{exerciseId:id,sets:4,reps:10,weight:35}]}]};
const next=applyTemplateEdit(data,before,plan);
assert.equal(next.templates[0].id,'target');assert.equal(next.templates[0].entries[0].sets,4);assert.equal(next.templates[0].entries[0].weight,35);assert.strictEqual(next.templates[1],data.templates[1]);assert.strictEqual(next.workouts,data.workouts);assert.equal(data.templates[0].entries[0].sets,3);
assert.throws(()=>applyTemplateEdit({...data,templates:[]},before,plan),/changed/);
assert.throws(()=>applyTemplateEdit(next,before,plan),/changed/);
assert.throws(()=>applyTemplateEdit(data,before,{...plan,workouts:[]}),/one template/);
assert.throws(()=>applyTemplateEdit(data,before,{...plan,workouts:[...plan.workouts,...plan.workouts]}),/one template/);
assert.throws(()=>applyTemplateEdit(data,before,{...plan,workouts:[{...before,entries:[{exerciseId:'missing',sets:3,reps:8,weight:10}]}]}),/unavailable/);
console.log('PASS: targeted template updates preserve IDs, other templates, history, and reject stale, deleted, invalid or multi-template proposals.');

assert.equal(applyTemplateEdit(data,before,{...plan,workouts:[{...before,entries:[{exerciseId:id,sets:3,reps:10,weight:null}]}]}).templates[0].entries[0].weight,35);
