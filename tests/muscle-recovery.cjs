const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const source=fs.readFileSync('lib/muscle-recovery.ts','utf8'),compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,moduleBox={exports:{}};
const now=new Date('2026-09-15T12:00:00Z');vm.runInNewContext(compiled,{module:moduleBox,exports:moduleBox.exports,require:id=>id.includes('fitness-clock')?{fitnessNow:()=>now}:{},Date,Math,Set});
const {muscleRecovery,exerciseMuscles}=moduleBox.exports,exercise={id:'bench',name:'Bench press',category:'Chest'},set={id:'s1',weight:185,reps:8,targetWeight:185,targetReps:8,status:'completed',difficulty:'Moderate',notes:''};
assert.deepEqual([...exerciseMuscles(exercise).primary],['Chest']);assert.deepEqual([...exerciseMuscles(exercise).secondary],['Triceps','Shoulders']);
const data={exercises:[exercise],workouts:[{id:'w1',name:'Push',date:'2026-09-14T12:00:00Z',completed:true,difficulty:'Hard',notes:'',entries:[{exerciseId:'bench',sets:[set,set,set]}]}]};
const result=muscleRecovery(data);assert.equal(result.find(x=>x.group==='Chest').state,'Recovering');assert.equal(result.find(x=>x.group==='Triceps').secondarySets,3);assert.equal(result.find(x=>x.group==='Triceps').state,'Unknown','Secondary involvement does not light the recovery map');assert.equal(result.find(x=>x.group==='Shoulders').state,'Unknown','Bench press only lights its direct chest target');assert.equal(result.find(x=>x.group==='Calves').state,'Unknown');
for(const group of ['Chest','Shoulders','Traps','Triceps','Forearms','Back','Biceps','Core','Glutes','Quadriceps','Hamstrings','Calves']){
 const muscles=exerciseMuscles({name:`${group} isolation test`,category:group});
 assert.deepEqual([...muscles.primary],[group],`${group} test fixture should isolate one direct muscle group`);
 assert.deepEqual([...muscles.secondary],[]);
}
assert.deepEqual([...exerciseMuscles({name:'Dumbbell shrug',category:'Back'}).primary],['Traps']);
assert.deepEqual([...exerciseMuscles({name:'Wrist curl',category:'Arms'}).primary],['Forearms']);
const timedExercises=['Chest','Shoulders','Traps'].map((group,index)=>({id:`timed-${index}`,name:`${group} isolation test`,category:group}));
const timedData={exercises:timedExercises,workouts:[12,30,72].map((hours,index)=>({id:`tw-${index}`,name:'Timed recovery',date:new Date(now.getTime()-hours*36e5).toISOString(),completed:true,difficulty:'Moderate',notes:'',entries:[{exerciseId:`timed-${index}`,sets:[set]}]}))};
const timed=muscleRecovery(timedData);assert.equal(timed.find(x=>x.group==='Chest').state,'Recovering');assert.equal(timed.find(x=>x.group==='Shoulders').state,'Nearly recovered');assert.equal(timed.find(x=>x.group==='Traps').state,'Likely ready');
console.log('PASS: muscle recovery isolates every supported group for male and female map fixtures.');
