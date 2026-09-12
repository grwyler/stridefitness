const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),crypto=require('node:crypto').webcrypto;
const cache=new Map(),encrypted=new Map();
let user={userId:'owner'},pages=[],calls=0,cryptoModule;
const secret=Buffer.alloc(32,9).toString('base64');
const storage={
 isSiteOwner:async u=>u.userId==='owner',
 async saveConnection(id,value){encrypted.set(id,await cryptoModule.encryptKey(value,id,secret))},
 async getConnectionKey(id){return encrypted.has(id)?cryptoModule.decryptKey(encrypted.get(id),id,secret):null},
 async removeConnection(id){encrypted.delete(id)},
};
function load(relative){
 const file=path.resolve(root,relative);if(cache.has(file))return cache.get(file);
 const exports={};cache.set(file,exports);
 const req=id=>{
  if(id==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>user};
  if(id==='./ai-connection'||id==='@/lib/ai-connection')return storage;
  if(id.startsWith('@/'))return load(id.slice(2)+'.ts');
  return require(id);
 };
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require:req,crypto,TextEncoder,TextDecoder,Uint8Array,btoa,atob,AbortSignal,URL,Request,Response,console,fetch:async(url,options)=>{
  calls++;assert.equal(url,'https://api.metronome.com/v1/listConfiguredBillingProviders');
  assert.equal(options.redirect,'error');assert.ok(options.headers.Authorization.startsWith('Bearer '));
  const p=pages.shift();assert.ok(p,'Unexpected network request');
  return Response.json(p.body||p,{status:p.status||200});
 }},{filename:file});return exports;
}
cryptoModule=load('lib/key-crypto.ts');
const lib=load('lib/metronome-connection.ts'),api=load('app/api/admin/metronome/route.ts');
const key='test-token-placeholder-1234567890',other='acct_other',match=lib.BILLING_SANDBOX_ACCOUNT;
const provider=(id,account)=>({billing_provider:'stripe',delivery_method_id:id,delivery_method:'direct_to_billing_provider',delivery_method_configuration:{stripe_account_id:account}});
const id1='00000000-0000-4000-8000-000000000001',id2='00000000-0000-4000-8000-000000000002';
const req=(body,origin='https://stride.test')=>new Request('https://stride.test/api/admin/metronome',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
(async()=>{
 assert.equal((await api.GET(req({}))).status,200);
 user=null;assert.equal((await api.GET(req({}))).status,403);
 user={userId:'visitor'};assert.equal((await api.POST(req({token:key}))).status,403);
 user={userId:'owner'};assert.equal((await api.POST(req({token:key},'https://other.test'))).status,403);
 assert.equal(calls,0);
 pages=[{data:[provider(id1,other)],next_page:id1},{data:[provider(id2,match)],next_page:null}];
 let result=await api.POST(req({token:key}));assert.equal(result.status,200);
 let body=await result.json();assert.equal(body.connected,true);assert.equal(body.billingEnabled,false);
 assert.equal(JSON.stringify(body).includes(key),false);
 assert.equal((await lib.getMetronomeConnection()).deliveryMethodId,id2,'Select correct provider, including pagination');
 assert.ok([...encrypted.values()].every(v=>v.startsWith('v1.')&&!v.includes(key)),'Token encrypted at rest');
 const original=[...encrypted.values()][0];
 pages=[{status:401,body:{message:'Must not echo '+key}}];
 result=await api.POST(req({token:key}));assert.equal(result.status,400);
 assert.equal((await result.text()).includes(key),false);assert.equal([...encrypted.values()][0],original);
 pages=[{data:[provider(id1,other)],next_page:null}];
 assert.equal((await api.POST(req({token:key}))).status,400);assert.equal([...encrypted.values()][0],original);
 pages=[{data:[provider(id1,match),provider(id2,match)]}];
 assert.equal((await api.POST(req({token:key}))).status,400);
 pages=[{data:[provider(id2,match)]}];
 assert.equal((await api.POST(req({action:'check'}))).status,200);
 assert.equal((await api.DELETE(req({}))).status,200);assert.equal(encrypted.size,0);
 console.log('PASS: encrypted storage, owner/origin gates, token redaction, pagination, exact account matching, safe replacement, recheck and removal');
})().catch(e=>{console.error(e);process.exitCode=1});
