// Run: node tests/ai-funding.cjs. Exercises production policy/key routes against SQLite.
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {readFileSync,readdirSync}=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const root=path.resolve(__dirname,'..'),sqlite=new DatabaseSync(':memory:');
for(const file of readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort()){
 if(file.startsWith('0007'))sqlite.exec("INSERT INTO site_users VALUES ('existing','Existing','old@example.test','2026-01-01','2026-01-01',0,NULL)");
 sqlite.exec(readFileSync(path.join(root,'drizzle',file),'utf8'));
}
sqlite.exec('CREATE TABLE user_training_data (user_id TEXT PRIMARY KEY, data TEXT, updated_at TEXT)');
sqlite.exec("INSERT INTO user_training_data VALUES ('legacy','{}','2026-01-01')");
function prepare(sql){
 let args=[];const statement=sqlite.prepare(sql);
 return {bind(...values){args=values;return this},async first(){return statement.get(...args)||null},async run(){statement.run(...args)},async all(){return {results:statement.all(...args)}}};
}
const env={DB:{prepare,async batch(statements){sqlite.exec('BEGIN');try{for(const s of statements)await s.run();sqlite.exec('COMMIT')}catch(e){sqlite.exec('ROLLBACK');throw e}}},AI_KEY_ENCRYPTION_SECRET:'test-only',SITE_OWNER_USER_ID:'owner',OPENAI_API_KEY:'environment-funding'};
let signedIn={userId:'owner',email:'owner@example.test',displayName:'Owner',fullName:'Owner'};
const cache=new Map();
function load(file){
 file=path.resolve(root,file);if(cache.has(file))return cache.get(file);
 const exports={};cache.set(file,exports);
 const source=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const localRequire=id=>{
  if(id==='cloudflare:workers')return {env};
  if(id==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>signedIn,chatGPTSignInPath:()=>'/signin-with-chatgpt'};
  if(id==='./key-crypto')return {encryptKey:async key=>key,decryptKey:async key=>key};
  if(id.startsWith('@/'))return load(id.slice(2)+'.ts');
  if(id.startsWith('.'))return load(path.resolve(path.dirname(file),id)+'.ts');
  return require(id);
 };
 vm.runInNewContext(source,{exports,require:localRequire,crypto:require('node:crypto').webcrypto,TextEncoder,Uint8Array,Response,Request,URL,Date,console,AbortSignal,fetch:()=>{throw new Error('No external calls allowed in funding tests')}},{filename:file});
 return exports;
}
const account=load('lib/admin-activity.ts'),connection=load('lib/ai-connection.ts'),api=load('app/api/ai-connection/route.ts'),policy=load('app/api/admin/ai-policy/route.ts');
const request=(body,origin='https://stride.test')=>new Request('https://stride.test/api',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
(async()=>{
 const user={userId:'test-user',email:'user@example.test',fullName:'User',displayName:'User'};
 assert.equal(await account.hasAiAccess(user),true);
 assert.equal((await connection.resolveAIConnection(user)).apiKey,'environment-funding');
 // Changing signup policy preserves existing and legacy users.
 assert.equal((await policy.POST(request({included:false}))).status,200);
 assert.equal(sqlite.prepare("SELECT included FROM ai_account_funding WHERE user_id='existing'").get().included,1);
 assert.equal(sqlite.prepare("SELECT included FROM ai_account_funding WHERE user_id='legacy'").get().included,1);
 assert.equal(await account.hasAiAccess(user),true);
 const later={...user,userId:'later',email:'later@example.test'};
 assert.equal(await account.hasAiAccess(later),false);
 assert.equal((await connection.resolveAIConnection(later)).apiKey,null);
 const id=await account.accountDataId(user);
 sqlite.prepare('INSERT INTO ai_access_blocks VALUES (?,?)').run(id,new Date().toISOString());
 assert.equal((await connection.resolveAIConnection(user)).apiKey,null,'Revoked account cannot fall back to environment key');
 signedIn=user;
 assert.equal((await policy.POST(request({included:true}))).status,403);
 const key='sk-'+ 'x'.repeat(30);
 assert.equal((await api.POST(request({apiKey:key}))).status,200,'Revoked user can save personal key');
 assert.equal((await connection.resolveAIConnection(user)).apiKey,key);
 assert.equal((await connection.resolveAIConnection(user)).shared,false);
 const status=await (await api.GET(new Request('https://stride.test/api'))).json();
 assert.equal(status.personal,true);assert.equal(status.included,false);assert.equal(status.connected,true);
 assert.equal((await api.POST(request({apiKey:key},'https://other.test'))).status,403);
 assert.equal((await api.DELETE(request({}))).status,200);
 assert.equal((await connection.resolveAIConnection(user)).apiKey,null);
 await connection.saveConnection('shared:site','shared-test-key');
 assert.equal((await connection.resolveAIConnection(later)).apiKey,null,'Non-funded user cannot use shared key');
 await connection.saveUserConnection(later,key);
 assert.equal((await connection.resolveAIConnection(later)).apiKey,key,'Personal key also works for non-funded new user');
 // All four coach routes enforce login and the same funding decision before any OpenAI call.
 for(const route of ['plan','progress-coach','exercise-coach','session-coach']){
  const coach=load('app/api/'+route+'/route.ts');
  signedIn=null;assert.equal((await coach.POST(request({}))).status,401,route+' requires sign-in');
  signedIn=user;assert.equal((await coach.POST(request({}))).status,403,route+' denies owner-funded use');
  await connection.saveUserConnection(user,key);
  assert.equal((await coach.POST(request({}))).status,400,route+' accepts personal funding before validating payload');
  await connection.removeUserConnection(user);
 }
 signedIn={userId:'owner',email:'owner@example.test'};
 assert.equal((await policy.POST(request({included:true}))).status,200);
 assert.equal(await account.hasAiAccess(later),false,'Re-enabling default does not silently change existing users');
 assert.equal(await account.hasAiAccess({...user,userId:'newest',email:'newest@example.test'}),true);
 console.log('PASS: migrations, grandfathering, signup defaults, personal-key save/remove, all four coach gates, and owner/origin protections');
})().catch(e=>{console.error(e);process.exitCode=1});
