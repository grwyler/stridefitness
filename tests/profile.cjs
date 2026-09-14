const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),{DatabaseSync}=require('node:sqlite');
const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/profile.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:m.exports,module:m,require});
const {profileSchema}=m.exports,p={name:'Sam',goal:'Get stronger',experience:'Some experience',days:3,minutes:45,equipment:'Dumbbells to 35 lb',limitations:'None',ageRange:'Prefer not to say'};
assert(profileSchema.safeParse(p).success);for(const key of Object.keys(p)){const x={...p};delete x[key];assert(profileSchema.safeParse(x).success,key);assert.equal(profileSchema.parse(x)[key],null)}assert(!profileSchema.safeParse({...p,days:0}).success);assert(profileSchema.safeParse({}).success);assert(!profileSchema.safeParse(null).success);assert.equal(profileSchema.parse({}).limitations,null);
// Exercise the current profile route rather than extracting obsolete SQL text.
const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE user_training_data(user_id TEXT PRIMARY KEY,data TEXT,updated_at TEXT)');
const adapter={prepare(sql){let args=[];return {bind(...values){args=values;return this},async first(){return db.prepare(sql).get(...args)||null},async run(){const result=db.prepare(sql).run(...args);return {meta:{changes:result.changes}}}}}};
const routeModule={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/profile/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:routeModule.exports,module:routeModule,Response,Request,URL,Date,require:name=>name==='@/app/chatgpt-auth'?{getChatGPTUser:async()=>({email:'sam@test'})}:name==='@/lib/server-profile'?{getCoachingProfile:async()=>null}:name==='@/lib/profile'?{profileSchema}:name==='@/lib/admin-activity'?{adminDatabase:()=>adapter,accountDataId:async()=>'sam'}:name==='@/lib/training'?{initialData:()=>({workouts:[],goals:[]})}:require(name)});
const put=(profile,baseUpdatedAt)=>routeModule.exports.PUT(new Request('https://stride.test/api/profile',{method:'PUT',headers:{origin:'https://stride.test'},body:JSON.stringify({profile,baseUpdatedAt})}));
(async()=>{
 assert.equal((await put(p,null)).status,200,'First profile initializes account');
 let row=db.prepare('SELECT * FROM user_training_data').get();db.prepare('UPDATE user_training_data SET data=?').run(JSON.stringify({...JSON.parse(row.data),workouts:[{id:'keep'}],goals:[{id:'goal'}]}));
 assert.equal((await put({...p,name:'Updated'},row.updated_at)).status,200);
 let saved=JSON.parse(db.prepare('SELECT data FROM user_training_data').get().data);assert.equal(saved.workouts[0].id,'keep');assert.equal(saved.goals[0].id,'goal');assert.equal(saved.profile.name,'Updated');
 assert.equal((await put({...p,name:'Stale'},row.updated_at)).status,409,'Stale profile cannot overwrite account');
 row=db.prepare('SELECT * FROM user_training_data').get();assert.equal((await put({...p,days:0},row.updated_at)).status,400);assert.equal(db.prepare('SELECT data FROM user_training_data').get().data,row.data,'Invalid profile leaves stored data intact');
 console.log('PASS: profile schemas, initialization, acknowledged edits, training preservation, stale and invalid profile rejection.');
})().catch(e=>{console.error(e);process.exit(1)});
