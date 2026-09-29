const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
function load(file,mocks={}){const mod={exports:{}},compiled=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(compiled,{exports:mod.exports,module:mod,Math,Number,Set,Date,require:id=>mocks[id]||require(id)});return mod.exports}
const {recommendProgression,nextValidLoad,previousValidLoad}=load('lib/progression.ts');
const exercise={id:'bench',name:'Bench press',category:'Chest',increment:2.5,mode:'weight',baseWeight:100,baseReps:8,baseSets:2};
const policy={kind:'rep_range',scope:'group',advanceBy:'auto',successSessions:2,failureAction:'hold'};
const row=(overrides={})=>({role:'working',countsTowardProgression:true,targetWeight:100,minReps:8,maxReps:10,group:'working',...overrides});
let serial=0;
function workout(id,date,rows,reps,options={}){const sets=rows.map((prescription,index)=>({id:`${id}-set-${index}`,weight:options.weights?.[index]??prescription.targetWeight,reps:reps[index]??0,targetWeight:options.targetWeights?.[index]??prescription.targetWeight,targetReps:prescription.minReps,status:options.statuses?.[index]??'completed',difficulty:options.difficulties?.[index]??'Moderate',notes:'',prescription:{...prescription},...(options.sessionAdjusted?.includes(index)?{sessionPrescription:{...prescription,targetWeight:options.weights?.[index]??prescription.targetWeight}}:{}),...(options.rir?.[index]!==undefined?{actualRir:options.rir[index]}:{})}));return{id:id||`w${serial++}`,name:id,date,completed:true,difficulty:'Moderate',notes:'',entries:[{exerciseId:options.exerciseId||exercise.id,progressionPolicy:options.policy||policy,...(options.context!==undefined?{prescriptionContext:options.context}:{}),sets}]}}
function decide(sessions,ex=exercise,p=policy,rows=[row()],context){return recommendProgression({workouts:sessions,overrides:{}},ex,p,rows,context)}
function sessionDay(day,rows,reps,options={}){return workout(`d${day}`,`2026-09-${String(day).padStart(2,'0')}T12:00:00Z`,rows,reps,options)}

const noHistory=decide([]);assert.equal(noHistory.kind,'Baseline');assert.equal(noHistory.reasonCode,'baseline');assert(noHistory.evidence.some(x=>x.kind==='insufficient'));

// Multi-session improvement stays at the same load until two comparable sessions reach the top.
const baseRows=[row()],gradual=[sessionDay(1,baseRows,[8]),sessionDay(3,baseRows,[9])];
let result=decide(gradual);assert.equal(result.target.weight,100);assert.equal(result.kind,'Repeat');assert.equal(result.reasonCode,'mixed_performance');
gradual.push(sessionDay(5,baseRows,[10]));result=decide(gradual);assert.equal(result.target.weight,100);assert.equal(result.reasonCode,'insufficient_history');assert(result.evidence.some(x=>x.kind==='insufficient'));
gradual.push(sessionDay(7,baseRows,[10]));result=decide(gradual);assert.equal(result.target.weight,102.5);assert.equal(result.reasonCode,'confirmed_progress');assert(result.why.includes('next available load'));assert(result.evidence.some(x=>x.kind==='load'&&x.detail.includes('102.5')));

// Grouped sets wait for every working set; independent sets can advance separately.
const mixedRows=[row(),row({targetWeight:80,minReps:8,maxReps:10})],mixedGroup=[sessionDay(1,mixedRows,[10,8]),sessionDay(3,mixedRows,[10,9])];
result=decide(mixedGroup,exercise,policy,mixedRows);assert.equal(result.kind,'Repeat');assert.equal(result.prescription[0].targetWeight,100);
const independentPolicy={...policy,scope:'independent'},mixedIndependent=[sessionDay(1,mixedRows,[10,8],{policy:independentPolicy}),sessionDay(3,mixedRows,[10,9],{policy:independentPolicy})];
result=decide(mixedIndependent,exercise,independentPolicy,mixedRows);assert.equal(result.kind,'Increase');assert.equal(result.prescription[0].targetWeight,102.5);assert.equal(result.prescription[1].targetWeight,80);assert.equal(result.reasonCode,'confirmed_progress');

// Warm-ups are retained in order but excluded when explicitly marked out of progression.
const warmup={role:'warmup',countsTowardProgression:false,targetWeight:50,minReps:10,maxReps:10},warmRows=[warmup,row()];
result=decide([sessionDay(1,warmRows,[15,10]),sessionDay(3,warmRows,[15,10])],exercise,policy,warmRows);
assert.equal(result.prescription.length,2);assert.equal(result.prescription[0].targetWeight,50);assert.equal(result.prescription[1].targetWeight,102.5);

// A top-set/back-off prescription keeps distinct targets and roles when a group advances.
const topBackoff=[row({role:'top',targetWeight:120,minReps:6,maxReps:8,group:'main'}),row({role:'backoff',targetWeight:100,minReps:10,maxReps:12,group:'main'})];
result=decide([sessionDay(1,topBackoff,[8,12]),sessionDay(3,topBackoff,[8,12])],exercise,policy,topBackoff);
assert.deepEqual(result.prescription.map(x=>[x.role,x.targetWeight]),[['top',122.5],['backoff',102.5]]);

// One poor session holds; repeated comparable misses follow the selected failure policy.
const reducing={...policy,failureAction:'reduce_load'},available={...exercise,loadAvailability:{kind:'discrete',values:[80,90,100,110]}};
const bad1=sessionDay(5,[row()],[6],{policy:reducing}),good=sessionDay(3,[row()],[10],{policy:reducing});
result=decide([bad1,good],available,reducing,[row()]);assert.equal(result.kind,'Hold');assert.equal(result.target.weight,100);assert.equal(result.reasonCode,'missed_minimum');
const bad2=sessionDay(7,[row()],[5],{policy:reducing});result=decide([bad2,bad1,good],available,reducing,[row()]);assert.equal(result.kind,'Reduce');assert.equal(result.target.weight,90);assert.equal(result.reasonCode,'repeated_underperformance');assert(result.evidence.some(x=>x.kind==='load'&&x.detail.includes('90 lb')));
const failures=[sessionDay(1,[row()],[4],{policy:reducing,statuses:['failed'],difficulties:['Failed']}),sessionDay(3,[row()],[3],{policy:reducing,statuses:['failed'],difficulties:['Failed']})];
result=decide(failures,available,reducing,[row()]);assert.equal(result.kind,'Reduce');assert(result.evidence.some(x=>x.kind==='miss'));assert.equal(result.target.weight,90);

// Optional RIR qualifies the effort target; missing effort data remains usable through the simple difficulty field.
const rirRow=row({targetRir:2}),rirPolicy={...policy,advanceBy:'load'},tooHard=[sessionDay(1,[rirRow],[10],{policy:rirPolicy,rir:[0]}),sessionDay(3,[rirRow],[10],{policy:rirPolicy,rir:[0]})];
result=decide(tooHard,exercise,rirPolicy,[rirRow]);assert.equal(result.target.weight,100);assert.equal(result.reasonCode,'mixed_performance');
const controlled=[sessionDay(1,[rirRow],[10],{policy:rirPolicy,rir:[2]}),sessionDay(3,[rirRow],[10],{policy:rirPolicy,rir:[2]})];
result=decide(controlled,exercise,rirPolicy,[rirRow]);assert.equal(result.target.weight,102.5);

// A session-only target change keeps the original plan and cannot count as a long-term success.
const applyModule=load('lib/apply-session-changes.ts',{'./training':{setOf:(weight,reps)=>({id:'new',weight,reps,targetWeight:weight,targetReps:reps,status:'pending',difficulty:'Moderate',notes:''})}});
const active={id:'active',name:'Session',date:'2026-09-09T12:00:00Z',entries:[{exerciseId:'bench',progressionPolicy:policy,sets:[{id:'planned',weight:100,reps:8,targetWeight:100,targetReps:8,status:'pending',difficulty:'Moderate',notes:'',prescription:row()}]}],completed:false,difficulty:'Moderate',notes:''};
const adapted=applyModule.applySessionChanges(active,[{type:'adjust_exercise',exerciseId:'bench',weight:90,reps:8,sets:null}],['bench']).workout.entries[0].sets[0];
assert.equal(adapted.prescription.targetWeight,100);assert.equal(adapted.sessionPrescription.targetWeight,90);assert.equal(adapted.targetWeight,90);
const adjustedHistory=[sessionDay(7,[row()],[10],{sessionAdjusted:[0],weights:[90]}),sessionDay(5,[row()],[10]),sessionDay(3,[row()],[10])];
result=decide(adjustedHistory,exercise,policy,[row()]);assert.equal(result.reasonCode,'session_adjustment');assert.equal(result.prescription[0].targetWeight,100);assert(result.evidence.some(x=>x.kind==='modified'));

// Explicit load options honor irregular sequences, jump limits, bodyweight, and safe legacy fallbacks.
const irregular={...exercise,loadAvailability:{kind:'discrete',values:[15,5,10,10,7.5]}};
assert.equal(nextValidLoad(irregular,10).load,15);assert.equal(previousValidLoad(irregular,10).load,7.5);
assert.equal(nextValidLoad({...irregular,loadAvailability:{kind:'discrete',values:[5,10],maxJump:2}},5).reason,'jump_too_large');
assert.equal(nextValidLoad({...irregular,loadAvailability:{kind:'discrete',values:[5,10]}},10).reason,'no_higher_load');
assert.equal(previousValidLoad({...irregular,loadAvailability:{kind:'discrete',values:[10,15]}},10).reason,'no_lower_load');
assert.equal(nextValidLoad({...exercise,loadAvailability:{kind:'increment',step:2.5}},100).load,102.5);
assert.equal(previousValidLoad({...exercise,loadAvailability:{kind:'increment',step:2.5}},100).load,97.5);
assert.equal(nextValidLoad({...exercise,increment:0},100).load,105);
assert.equal(nextValidLoad({...exercise,mode:'reps',loadAvailability:{kind:'bodyweight'}},0).reason,'bodyweight');
const loadPolicy={...policy,advanceBy:'load'},constrained={...exercise,loadAvailability:{kind:'discrete',values:[5,10],maxJump:2}},constrainedRows=[row({targetWeight:5})];
result=decide([sessionDay(1,constrainedRows,[10],{policy:loadPolicy}),sessionDay(3,constrainedRows,[10],{policy:loadPolicy})],constrained,loadPolicy,constrainedRows);
assert.equal(result.reasonCode,'equipment_limited');assert.equal(result.prescription[0].targetWeight,5);assert.equal(result.prescription[0].maxReps,11);assert(result.evidence.some(x=>x.kind==='equipment'&&x.detail.includes('exceeds')));
const capped={...exercise,loadAvailability:{kind:'discrete',values:[5,10]}},cappedRows=[row({targetWeight:10})];
result=decide([sessionDay(1,cappedRows,[10],{policy:loadPolicy}),sessionDay(3,cappedRows,[10],{policy:loadPolicy})],capped,loadPolicy,cappedRows);
assert.equal(result.reasonCode,'equipment_limited');assert.equal(result.target.weight,10);assert.equal(result.prescription[0].maxReps,11);assert(result.evidence.some(x=>x.kind==='equipment'&&x.detail.includes('no higher')));

// Bodyweight and externally loaded movements differ; bodyweight auto advances through reps.
const bodyweight={...exercise,id:'pullup',mode:'weight',loadAvailability:{kind:'bodyweight'},baseWeight:0},bodyRows=[row({targetWeight:0})];
result=decide([sessionDay(1,bodyRows,[10],{exerciseId:'pullup'}),sessionDay(3,bodyRows,[10],{exerciseId:'pullup'})],bodyweight,policy,bodyRows);
assert.equal(result.reasonCode,'rep_progress');assert.equal(result.target.weight,0);assert.equal(result.prescription[0].maxReps,11);
const externallyLoaded={...bodyweight,loadAvailability:{kind:'discrete',values:[0,2.5,5]}};
assert.equal(nextValidLoad(externallyLoaded,0).load,2.5);

// Long gaps and mismatched contexts/prescriptions cannot supply false confirmation.
const longGap=[workout('recent','2026-09-01T12:00:00Z',baseRows,[10]),workout('old','2026-05-01T12:00:00Z',baseRows,[10])];
result=decide(longGap);assert.equal(result.reasonCode,'long_gap');assert(result.evidence.some(x=>x.kind==='history'&&x.detail.includes('123-day')));
const contexts=[workout('new','2026-09-03T12:00:00Z',baseRows,[10],{context:'template-new'}),workout('old','2026-09-01T12:00:00Z',baseRows,[2],{context:'template-old',statuses:['failed']})];
result=decide(contexts,exercise,policy,baseRows,'template-new');assert.equal(result.kind,'Repeat');assert.equal(result.reasonCode,'insufficient_history');assert.equal(result.target.weight,100);
const incompatible=[workout('new','2026-09-03T12:00:00Z',baseRows,[10]),workout('old','2026-09-01T12:00:00Z',[row({minReps:2,maxReps:4})],[4])];
result=decide(incompatible);assert.equal(result.reasonCode,'insufficient_history');assert.equal(result.kind,'Repeat');assert.equal(result.target.weight,100);
const legacy=workout('legacy','2026-09-03T12:00:00Z',baseRows,[10]);delete legacy.entries[0].progressionPolicy;
result=decide([legacy]);assert.equal(result.kind,'Baseline');assert.equal(result.reasonCode,'insufficient_history');

// Fixed policies and manual overrides remain explicit; old Weekly Review payloads are not inputs.
result=decide([sessionDay(1,baseRows,[10]),sessionDay(3,baseRows,[10])],exercise,{kind:'fixed'},baseRows);
assert.equal(result.reasonCode,'fixed_prescription');assert.equal(result.target.weight,100);
result=recommendProgression({workouts:[],overrides:{bench:{weight:90,reps:6,sets:1}}},exercise,policy,baseRows);
assert.equal(result.reasonCode,'manual_override');assert.equal(result.target.weight,90);assert.equal(result.overridden,true);
const oldReviewData={workouts:[sessionDay(1,baseRows,[10]),sessionDay(3,baseRows,[10])],overrides:{},weeklyReviews:[{recommendation:{target:{weight:999}}}]};
assert.equal(recommendProgression(oldReviewData,exercise,policy,baseRows).target.weight,102.5);
const savedHistory=JSON.stringify(gradual);recommendProgression({workouts:gradual,overrides:{}},exercise,policy,baseRows);assert.equal(JSON.stringify(gradual),savedHistory,'recommendations never mutate historical workout snapshots');
assert.equal(fs.existsSync('app/api/weekly-review/route.ts'),false);assert.equal(fs.existsSync('components/weekly-review.tsx'),false);
console.log('PASS: multi-session behavior, set roles, independent/grouped policy, failure handling, session-only edits, comparability, explanations, equipment-constrained loads, legacy defaults, and retired Weekly Review.');
