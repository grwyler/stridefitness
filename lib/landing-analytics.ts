import {env} from 'cloudflare:workers';

function db(){const value=(env as unknown as {DB?:D1Database}).DB;if(!value)throw new Error('Database unavailable');return value}
export const landingSessionPattern=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export async function ensureLandingAnalyticsTables(){
 const database=db();
 await database.batch([
  database.prepare(`CREATE TABLE IF NOT EXISTS landing_sessions (
   session_id TEXT PRIMARY KEY, started_at TEXT NOT NULL, last_seen_at TEXT NOT NULL,
   duration_seconds INTEGER NOT NULL DEFAULT 0, max_scroll_percent INTEGER NOT NULL DEFAULT 0,
   referrer_host TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_content TEXT, utm_term TEXT, google_ads_click INTEGER NOT NULL DEFAULT 0,
   guest_account_id TEXT, account_created_at TEXT, country TEXT, region TEXT
  )`),
  database.prepare(`CREATE TABLE IF NOT EXISTS landing_events (
   id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, event_type TEXT NOT NULL,
   target TEXT, occurred_at TEXT NOT NULL, active_seconds INTEGER NOT NULL DEFAULT 0, FOREIGN KEY(session_id) REFERENCES landing_sessions(session_id)
  )`),
  database.prepare('CREATE INDEX IF NOT EXISTS idx_landing_sessions_started ON landing_sessions(started_at)'),
  database.prepare('CREATE INDEX IF NOT EXISTS idx_landing_events_session ON landing_events(session_id,occurred_at)'),
  database.prepare(`CREATE TABLE IF NOT EXISTS guest_account_labels (
   account_id TEXT PRIMARY KEY, label TEXT NOT NULL CHECK(label IN ('unclassified','owner_test','likely_visitor')), updated_at TEXT NOT NULL
  )`),
 ]);
 const columns=await database.prepare('PRAGMA table_info(landing_sessions)').all<{name:string}>();
 const existing=new Set(columns.results.map(column=>column.name));
 for(const column of ['country','region'])if(!existing.has(column))try{await database.prepare(`ALTER TABLE landing_sessions ADD COLUMN ${column} TEXT`).run()}catch{}
 const eventColumns=await database.prepare('PRAGMA table_info(landing_events)').all<{name:string}>();
 if(!eventColumns.results.some(column=>column.name==='active_seconds'))try{await database.prepare('ALTER TABLE landing_events ADD COLUMN active_seconds INTEGER NOT NULL DEFAULT 0').run()}catch{}
 return database;
}
function sessionFromCookie(cookie:string|null){const value=cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('stride_landing_session='))?.slice('stride_landing_session='.length);return value&&landingSessionPattern.test(value)?value:null}
function clean(value:string|null|undefined,max=120){return value?.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max)||null}
export async function recordLandingEvent(input:{sessionId:string;eventType:'page_view'|'click'|'scroll'|'engagement'|'page_time'|'try_guest';target?:string|null;durationSeconds?:number;activeSeconds?:number;accountId?:string|null;maxScrollPercent?:number;referrer?:string|null;utmSource?:string|null;utmMedium?:string|null;utmCampaign?:string|null;utmContent?:string|null;utmTerm?:string|null;googleAdsClick?:boolean;country?:string;region?:string}){
 const database=await ensureLandingAnalyticsTables(),now=new Date().toISOString(),referrerHost=(()=>{try{return input.referrer?new URL(input.referrer).hostname.slice(0,160):null}catch{return null}})();
 const duration=Math.max(0,Math.min(14400,Math.floor(input.durationSeconds||0))),scroll=Math.max(0,Math.min(100,Math.floor(input.maxScrollPercent||0)));
 const writes=[
  database.prepare(`INSERT INTO landing_sessions (session_id,started_at,last_seen_at,duration_seconds,max_scroll_percent,referrer_host,utm_source,utm_medium,utm_campaign,utm_content,utm_term,google_ads_click,country,region,guest_account_id)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(session_id) DO UPDATE SET last_seen_at=excluded.last_seen_at,duration_seconds=MAX(landing_sessions.duration_seconds,excluded.duration_seconds),max_scroll_percent=MAX(landing_sessions.max_scroll_percent,excluded.max_scroll_percent),referrer_host=COALESCE(landing_sessions.referrer_host,excluded.referrer_host),utm_source=COALESCE(landing_sessions.utm_source,excluded.utm_source),utm_medium=COALESCE(landing_sessions.utm_medium,excluded.utm_medium),utm_campaign=COALESCE(landing_sessions.utm_campaign,excluded.utm_campaign),utm_content=COALESCE(landing_sessions.utm_content,excluded.utm_content),utm_term=COALESCE(landing_sessions.utm_term,excluded.utm_term),google_ads_click=MAX(landing_sessions.google_ads_click,excluded.google_ads_click),country=COALESCE(landing_sessions.country,excluded.country),region=COALESCE(landing_sessions.region,excluded.region),guest_account_id=COALESCE(landing_sessions.guest_account_id,excluded.guest_account_id)`)
   .bind(input.sessionId,now,now,duration,scroll,referrerHost,clean(input.utmSource),clean(input.utmMedium),clean(input.utmCampaign),clean(input.utmContent),clean(input.utmTerm),input.googleAdsClick?1:0,clean(input.country,2),clean(input.region,100),clean(input.accountId,200)),
  ...(input.eventType==='engagement'?[]:[database.prepare(`INSERT INTO landing_events (session_id,event_type,target,occurred_at,active_seconds) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM landing_events WHERE session_id=?)<100`).bind(input.sessionId,input.eventType,clean(input.target,80),now,Math.max(0,Math.min(14400,Math.floor(input.activeSeconds||0))),input.sessionId)])
 ];
 if(input.eventType==='page_view'){const cutoff=new Date(Date.now()-180*24*60*60_000).toISOString();writes.unshift(database.prepare('DELETE FROM landing_events WHERE occurred_at<?').bind(cutoff),database.prepare('DELETE FROM landing_sessions WHERE started_at<?').bind(cutoff))}
 await database.batch(writes);
}
export async function recordLandingTrial(request:Request,accountId:string){
 const sessionId=sessionFromCookie(request.headers.get('cookie'));if(!sessionId)return;
 try{const database=await ensureLandingAnalyticsTables(),now=new Date().toISOString();await database.batch([
  database.prepare('UPDATE landing_sessions SET guest_account_id=COALESCE(guest_account_id,?),last_seen_at=? WHERE session_id=?').bind(accountId,now,sessionId),
  database.prepare('INSERT INTO landing_events (session_id,event_type,target,occurred_at) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM landing_events WHERE session_id=?)<100 AND EXISTS(SELECT 1 FROM landing_sessions WHERE session_id=?)').bind(sessionId,'try_guest','try_stride_free',now,sessionId,sessionId),
 ])}catch{console.error('stride_landing_trial_record_failed')}
}
export async function recordLandingAccount(request:Request,isNewAccount:boolean){
 const sessionId=sessionFromCookie(request.headers.get('cookie'));if(!sessionId)return;
 try{if(!isNewAccount)return;const database=await ensureLandingAnalyticsTables(),now=new Date().toISOString();await database.batch([
  database.prepare('UPDATE landing_sessions SET account_created_at=COALESCE(account_created_at,?),last_seen_at=? WHERE session_id=?').bind(now,now,sessionId),
  database.prepare('INSERT INTO landing_events (session_id,event_type,target,occurred_at) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM landing_events WHERE session_id=?)<100 AND EXISTS(SELECT 1 FROM landing_sessions WHERE session_id=?)').bind(sessionId,'account_created','email_or_google',now,sessionId,sessionId),
 ])}catch{console.error('stride_landing_signup_record_failed')}
}
export async function landingAnalyticsReport(){
 const database=await ensureLandingAnalyticsTables(),since=new Date(Date.now()-30*24*60*60_000).toISOString(),today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const nextDate=new Date(`${today}T12:00:00Z`);nextDate.setUTCDate(nextDate.getUTCDate()+1);
 const localDayStart=(day:string)=>{const utcMidnight=new Date(`${day}T00:00:00Z`),match=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',timeZoneName:'longOffset'}).format(utcMidnight).match(/GMT([+-]\d{2}):(\d{2})/),offset=match?`${match[1]}:${match[2]}`:'-05:00';return new Date(`${day}T00:00:00${offset}`).toISOString()};
 const todayStart=localDayStart(today),tomorrowStart=localDayStart(nextDate.toISOString().slice(0,10));
 const [summary,events,sources,daily,geography,hourlyEvents]=await Promise.all([
  database.prepare(`SELECT COUNT(*) AS visits,COALESCE(SUM(EXISTS(SELECT 1 FROM landing_events e WHERE e.session_id=s.session_id AND e.event_type='page_view' AND e.target='guest')),0) AS guest_entry_views,COALESCE(SUM(duration_seconds>=10 OR EXISTS(SELECT 1 FROM landing_events e WHERE e.session_id=s.session_id AND e.event_type IN ('click','try_guest'))),0) AS engaged,COALESCE(SUM(guest_account_id IS NOT NULL),0) AS trial_starts,COALESCE(SUM(account_created_at IS NOT NULL),0) AS signups,COALESCE(ROUND(AVG(duration_seconds)),0) AS avg_seconds,COALESCE(ROUND(AVG(max_scroll_percent)),0) AS avg_scroll FROM landing_sessions s WHERE started_at>=?`).bind(since).first<any>(),
  database.prepare('SELECT event_type,target,COUNT(*) AS count FROM landing_events e JOIN landing_sessions s ON s.session_id=e.session_id WHERE s.started_at>=? GROUP BY event_type,target ORDER BY count DESC LIMIT 30').bind(since).all<any>(),
  database.prepare(`SELECT COALESCE(NULLIF(utm_campaign,''),NULLIF(utm_source,'')||COALESCE(' / '||NULLIF(utm_medium,''),''),CASE WHEN google_ads_click=1 THEN 'Google Ads' END,NULLIF(referrer_host,''),'Direct / untagged') AS source,COUNT(*) AS visits,COALESCE(SUM(guest_account_id IS NOT NULL),0) AS trials,COALESCE(SUM(account_created_at IS NOT NULL),0) AS signups FROM landing_sessions WHERE started_at>=? GROUP BY source ORDER BY visits DESC LIMIT 20`).bind(since).all<any>(),
  database.prepare(`SELECT substr(started_at,1,10) AS day,COUNT(*) AS visits,COALESCE(SUM(guest_account_id IS NOT NULL),0) AS trials,COALESCE(SUM(account_created_at IS NOT NULL),0) AS signups FROM landing_sessions WHERE started_at>=? GROUP BY day ORDER BY day DESC LIMIT 14`).bind(since).all<any>(),
  database.prepare(`SELECT COALESCE(country,'Unknown') AS country,region,COUNT(*) AS visits,COALESCE(SUM(guest_account_id IS NOT NULL),0) AS trials,COALESCE(SUM(account_created_at IS NOT NULL),0) AS signups FROM landing_sessions WHERE started_at>=? GROUP BY country,region ORDER BY visits DESC LIMIT 30`).bind(since).all<any>(),
  database.prepare(`SELECT DISTINCT session_id,occurred_at FROM landing_events WHERE occurred_at>=? AND occurred_at<? AND event_type IN ('page_view','click','scroll','engagement','try_guest','account_created')`).bind(todayStart,tomorrowStart).all<{session_id:string;occurred_at:string}>(),
 ]);
 const hourSessions=Array.from({length:24},()=>new Set<string>()),hourFormatter=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',hourCycle:'h23'});
 for(const event of hourlyEvents.results){const hour=Number(hourFormatter.format(new Date(event.occurred_at)));hourSessions[hour]?.add(event.session_id)}
 return {summary:summary||{visits:0,guest_entry_views:0,engaged:0,trial_starts:0,signups:0,avg_seconds:0,avg_scroll:0},events:events.results,sources:sources.results,daily:daily.results,geography:geography.results,hourly:Array.from({length:24},(_,hour)=>({hour,active_users:hourSessions[hour].size}))};
}
export async function landingAccountActivity(accountIds:string[]){
 if(!accountIds.length)return [];
 const database=await ensureLandingAnalyticsTables(),placeholders=accountIds.map(()=>'?').join(',');
 const result=await database.prepare(`WITH ranked AS (SELECT s.guest_account_id AS account_id,e.event_type,e.target,e.occurred_at,e.active_seconds,ROW_NUMBER() OVER(PARTITION BY s.guest_account_id ORDER BY e.occurred_at DESC,e.id DESC) AS position FROM landing_events e JOIN landing_sessions s ON s.session_id=e.session_id WHERE s.guest_account_id IN (${placeholders}) AND e.event_type IN ('page_view','click','page_time','try_guest','account_created','scroll')) SELECT account_id,event_type,target,occurred_at,active_seconds FROM ranked WHERE position<=20 ORDER BY account_id,occurred_at DESC`).bind(...accountIds).all<any>();
 return result.results;
}
