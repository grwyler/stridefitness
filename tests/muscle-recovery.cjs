const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const source=fs.readFileSync('lib/muscle-recovery.ts','utf8'),compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,moduleBox={exports:{}};
const now=new Date('2026-09-15T12:00:00Z');vm.runInNewContext(compiled,{module:moduleBox,exports:moduleBox.exports,require:id=>id.includes('fitness-clock')?{fitnessNow:()=>now}:{},Date,Math,Set});
const {muscleGroups,muscleRecovery,exerciseMuscles}=moduleBox.exports,exercise={id:'bench',name:'Bench press',category:'Chest'},set={id:'s1',weight:185,reps:8,targetWeight:185,targetReps:8,status:'completed',difficulty:'Moderate',notes:''};
const librarySource=fs.readFileSync('lib/exercise-library.ts','utf8'),libraryCompiled=ts.transpileModule(librarySource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,libraryBox={exports:{}};vm.runInNewContext(libraryCompiled,{module:libraryBox,exports:libraryBox.exports,require:()=>({})});
for(const item of libraryBox.exports.exerciseLibrary){assert(exerciseMuscles(item).primary.length>0,`${item.name} must have a primary recovery mapping`)}
assert.deepEqual([...exerciseMuscles(exercise).primary],['Mid Chest']);assert.deepEqual([...exerciseMuscles(exercise).secondary],['Triceps','Front Delts']);
const data={exercises:[exercise],workouts:[{id:'w1',name:'Push',date:'2026-09-14T12:00:00Z',completed:true,difficulty:'Hard',notes:'',entries:[{exerciseId:'bench',sets:[set,set,set]}]}]};
const recovery=muscleRecovery(data);assert.equal(recovery.find(x=>x.group==='Mid Chest').state,'Recovering');assert.equal(recovery.find(x=>x.group==='Triceps').secondarySets,3);assert.equal(recovery.find(x=>x.group==='Triceps').state,'Nearly recovered','Secondary involvement receives a smaller recovery estimate');assert.equal(recovery.find(x=>x.group==='Front Delts').state,'Nearly recovered');
const squat=exerciseMuscles({name:'Back squat',category:'Legs'});assert.deepEqual([...squat.primary],['Quadriceps','Glutes']);assert.deepEqual([...squat.secondary],['Hamstrings','Core','Lower Back']);
for(const group of muscleGroups){const muscles=exerciseMuscles({name:`${group} isolation test`,category:group});assert.deepEqual([...muscles.primary],[group],`${group} fixture should isolate one direct region`);assert.deepEqual([...muscles.secondary],[])}
const cases=[
 ['Incline barbell bench press',['Upper Chest'],['Front Delts','Triceps']],
 ['Decline dumbbell bench press',['Lower Chest'],['Triceps','Front Delts']],
 ['Dumbbell lateral raise',['Side Delts'],['Traps']],
 ['Dumbbell front raise',['Front Delts'],['Upper Chest','Triceps']],
 ['Bent-over reverse fly',['Rear Delts'],['Upper Back','Traps']],
 ['Overhead press',['Front Delts','Side Delts'],['Triceps','Traps']],
 ['Barbell row',['Upper Back'],['Biceps','Rear Delts','Forearms']],
 ['Romanian deadlift',['Lower Back','Hamstrings','Glutes'],['Core','Traps','Forearms']],
 ['Reverse curl',['Biceps','Forearms'],[]],
 ['Neutral-grip pull-up',['Upper Back'],['Biceps','Forearms','Mid Chest']],
 ['Chest-supported dumbbell row',['Upper Back'],['Biceps','Rear Delts','Forearms']],
 ['Nordic curl',['Hamstrings'],['Glutes','Calves']],
 ['Lateral lunge',['Quadriceps','Glutes'],['Hamstrings','Core','Lower Back']],
 ['Leg press calf raise',['Calves'],[]],
 ['Cable glute kickback',['Glutes'],['Hamstrings']],
];
for(const [name,primary,secondary] of cases){const mapped=exerciseMuscles({name,category:''});assert.deepEqual([...mapped.primary],primary,`${name} primary regions`);assert.deepEqual([...mapped.secondary],secondary,`${name} secondary regions`)}
const timedExercises=['Upper Chest','Side Delts','Traps'].map((group,index)=>({id:`timed-${index}`,name:`${group} isolation test`,category:group}));
const timedData={exercises:timedExercises,workouts:[12,30,72].map((hours,index)=>({id:`tw-${index}`,name:'Timed recovery',date:new Date(now.getTime()-hours*36e5).toISOString(),completed:true,difficulty:'Moderate',notes:'',entries:[{exerciseId:`timed-${index}`,sets:[set]}]}))};
const timed=muscleRecovery(timedData);assert.equal(timed.find(x=>x.group==='Upper Chest').state,'Recovering');assert.equal(timed.find(x=>x.group==='Side Delts').state,'Nearly recovered');assert.equal(timed.find(x=>x.group==='Traps').state,'Likely ready');
console.log('PASS: detailed chest, delt, back, arm, and lower-body regions map independently and recover over time.');
