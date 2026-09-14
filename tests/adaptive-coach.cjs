const assert=require('node:assert/strict'),ts=require('typescript'),fs=require('node:fs'),vm=require('node:vm');
const code=ts.transpileModule(fs.readFileSync('lib/adaptive-coach.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,m={exports:{}};vm.runInNewContext(code,{exports:m.exports,module:m,require,Date,Math,Number});const {adaptiveTarget,nextSetAdvice}=m.exports;
const ex={id:'bench',name:'Bench press',increment:5,mode:'weight',baseWeight:0,baseReps:8,baseSets:3};
let seq=0;const set=(p={})=>({id:'s'+seq++,weight:100,reps:8,targetWeight:100,targetReps:8,status:'completed',difficulty:'Moderate',notes:'',...p});
const workout=(sets,p={})=>({id:'w'+seq++,date:new Date().toISOString(),completed:true,difficulty:'Moderate',entries:[{exerciseId:'bench',sets}],...p});
const data=(workouts)=>({exercises:[ex],workouts,overrides:{}});
// Unseen barbell movements calibrate with the empty bar rather than prescribing 0 lb.
let target=adaptiveTarget(data([]),ex);assert.equal(target.weight,45);assert.equal(target.calibrating,true);assert.match(target.why,/calibration/i);
// The reported failure: easy 135x6 should add weight; a manually stronger 185x6 Moderate must become the baseline, not trigger a reduction.
let pending=set({id:'next',status:'pending',weight:135,reps:7,targetWeight:135,targetReps:7});
let active=workout([set({weight:135,reps:6,targetWeight:45,targetReps:8,difficulty:'Easy'}),pending],{completed:false});
let advice=nextSetAdvice(data([]),active,ex);assert.equal(advice.weight,140);assert.equal(advice.reps,6);assert.match(advice.reason,/calibration/i);
active=workout([set({weight:135,reps:6,targetWeight:45,targetReps:8,difficulty:'Easy'}),set({weight:185,reps:6,targetWeight:135,targetReps:7,difficulty:'Moderate'}),set({id:'third',status:'pending',weight:135,reps:7,targetWeight:135,targetReps:7})],{completed:false});
advice=nextSetAdvice(data([]),active,ex);assert.equal(advice.weight,185);assert.equal(advice.reps,6);assert.match(advice.reason,/stronger completed set/i);
const calibrated=adaptiveTarget(data([{...active,completed:true}]),ex);assert.equal(calibrated.weight,185);assert.equal(calibrated.reps,6);assert.equal(calibrated.kind,'Repeat');
// Hard completion holds. Very-hard underperformance backs off slightly. Failure backs off more.
pending=set({id:'p1',status:'pending'});assert.equal(nextSetAdvice(data([]),workout([set({weight:185,reps:6,targetWeight:185,targetReps:6,difficulty:'Hard'}),pending],{completed:false}),ex).weight,185);
assert.equal(nextSetAdvice(data([]),workout([set({weight:185,reps:3,targetWeight:185,targetReps:6,difficulty:'Very Hard'}),pending],{completed:false}),ex).weight,175);
assert.equal(nextSetAdvice(data([]),workout([set({weight:185,reps:3,targetWeight:185,targetReps:6,difficulty:'Failed',status:'failed'}),pending],{completed:false}),ex).weight,165);
// Repeated failures reduce future targets; one difficult completed session does not.
assert.equal(adaptiveTarget(data([workout([set({weight:185,difficulty:'Hard'})])]),ex).weight,185);
assert.equal(adaptiveTarget(data([workout([set({weight:185,status:'failed',difficulty:'Failed'})]),workout([set({weight:185,status:'failed',difficulty:'Failed'})])]),ex).kind,'Reduce');
// Confirmed controlled performance progresses, actual loads drive targets, skips do not punish, overrides remain authoritative.
assert.equal(adaptiveTarget(data([workout([set(),set()]),workout([set(),set()])]),ex).weight,105);
assert.equal(adaptiveTarget(data([workout([set({weight:80,targetWeight:100})])]),ex).weight,80);
assert.equal(adaptiveTarget(data([workout([set(),set({status:'skipped'})])]),ex).kind,'Repeat');
assert.equal(adaptiveTarget({...data([]),overrides:{bench:{weight:75,reps:10,sets:2}}},ex).weight,75);
const immutable=workout([set({status:'failed',reps:4}),pending],{completed:false}),before=JSON.stringify(immutable);nextSetAdvice(data([]),immutable,ex);assert.equal(JSON.stringify(immutable),before);assert.equal(nextSetAdvice(data([]),{...immutable,completed:true},ex),null);
console.log('PASS: calibration, the 135→185 scenario, effort-aware set advice, progressive overload, reductions, skips, immutability and overrides.');
