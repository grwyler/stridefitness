const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const handlers={},writes=[],cache=new Map();let fail=false;
const ctx={self:{location:{origin:'https://stridefitness.org'},addEventListener:(n,f)=>handlers[n]=f},URL,Response,caches:{open:async()=>({put:async(k,r)=>{writes.push(typeof k==='string'?k:k.url);cache.set(typeof k==='string'?k:k.url,r)},keys:async()=>[],delete:async()=>true}),match:async k=>cache.get(typeof k==='string'?k:k.url),keys:async()=>[]},fetch:async req=>{if(fail)throw Error('offline');return {ok:true,redirected:false,type:'basic',headers:new Headers({'Content-Type':String(req.url||req).endsWith('.js')?'application/javascript':'text/html'}),clone(){return this}}}};
vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),ctx);
(async()=>{
 let install;handlers.install({waitUntil:p=>install=p});await install;assert.equal(writes.length,4);
 for(const [url,method,mode] of [['/api/training-data','GET','cors'],['/api/session-coach','POST','cors'],['/callback?code=secret','GET','cors'],['/?_rsc=123','GET','cors'],['/api/account','GET','cors'],['/icons/private.png','GET','cors']]){let intercepted=false;handlers.fetch({request:{url:'https://stridefitness.org'+url,method,mode},respondWith(){intercepted=true}});assert.equal(intercepted,false,url)}
 let response;handlers.fetch({request:{url:'https://stridefitness.org/admin',method:'GET',mode:'navigate'},respondWith:p=>response=p});await response;assert.equal(writes.length,4,'HTML must not be cached');
 fail=true;handlers.fetch({request:{url:'https://stridefitness.org/admin',method:'GET',mode:'navigate'},respondWith:p=>response=p});assert.equal((await response).status,503);fail=false;
 handlers.fetch({request:{url:'https://stridefitness.org/_next/static/chunks/framework-D_rUT4EX.js',method:'GET',mode:'cors'},respondWith:p=>response=p});await response;assert.equal(writes.length,5,'hashed public JS cached');
 console.log('PASS: public assets only; API/auth/RSC bypass; online HTML uncached; neutral offline fallback; hashed JS cache.');
})().catch(e=>{console.error(e);process.exitCode=1});
