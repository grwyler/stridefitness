const assert=require('node:assert/strict'),ts=require('typescript'),fs=require('node:fs'),vm=require('node:vm');
const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/daily-logging.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:m.exports,Date,Set});
const {onLocalDay,recentActivities}=m.exports;
const now=new Date(2026,8,14,12);assert(onLocalDay({date:new Date(2026,8,14,8).toISOString()},now));assert(onLocalDay({date:'2026-09-14'},now));assert(!onLocalDay({date:'2026-09-13'},now));assert(!onLocalDay({date:new Date(2026,8,13,23).toISOString()},now));
const logs=[{id:'old',name:'Jiu-Jitsu',date:'2026-09-10',durationMinutes:60},{id:'new',name:'jiu-jitsu',date:'2026-09-14',durationMinutes:90}];assert.equal(recentActivities(logs).length,1);assert.equal(recentActivities(logs)[0].durationMinutes,90);
console.log('PASS local-day completion acknowledgement, date-only history, prior-day exclusion, latest activity reuse and case-insensitive deduplication.');
