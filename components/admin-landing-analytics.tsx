type Report={
 summary:{visits:number;engaged:number;trial_starts:number;signups:number;avg_seconds:number;avg_scroll:number};
 events:Array<{event_type:string;target:string|null;count:number}>;
 sources:Array<{source:string;visits:number;trials:number;signups:number}>;
 daily:Array<{day:string;visits:number;trials:number;signups:number}>;
};
const eventName=(value:string,target:string|null)=>value==='page_view'?'Landing page views':value==='try_guest'?'Guest trials started':value==='account_created'?'Accounts created':value==='click'?`Button or link · ${target||'other'}`:value==='scroll'?`Scroll depth · ${target||''}%`:'Other interaction';
export function AdminLandingAnalytics({report}:{report:Report}){
 const {summary}=report;
 return <>
  <section className="admin-section-heading"><h2>Landing page activity · last 30 days</h2><p>Anonymous visits, time on page, and the path from an ad click to trying Stride or creating an account.</p></section>
  <div className="landing-analytics-metrics"><article><strong>{summary.visits}</strong><span>Visits</span></article><article><strong>{summary.engaged}</strong><span>Engaged visits</span></article><article><strong>{summary.avg_seconds}s</strong><span>Average active time</span></article><article><strong>{summary.avg_scroll}%</strong><span>Average scroll depth</span></article><article><strong>{summary.trial_starts}</strong><span>Guest trials started</span></article><article><strong>{summary.signups}</strong><span>Accounts created</span></article></div>
  {!summary.visits&&<p className="notice">No visits have been recorded yet. This report will fill in as visitors use the updated landing page.</p>}
  <section className="landing-analytics-grid">
   <article className="panel"><h3>Where visitors came from</h3>{report.sources.length?<div className="landing-report-table"><div className="landing-report-row landing-report-head"><span>Campaign or source</span><b>Visits</b><b>Trials</b><b>Accounts</b></div>{report.sources.map(row=><div className="landing-report-row" key={row.source}><span>{row.source}</span><b>{row.visits}</b><b>{row.trials}</b><b>{row.signups}</b></div>)}</div>:<p>No source data yet.</p>}</article>
   <article className="panel"><h3>What people clicked</h3>{report.events.filter(row=>row.event_type==='click'||row.event_type==='scroll').length?<div className="landing-report-table">{report.events.filter(row=>row.event_type==='click'||row.event_type==='scroll').map(row=><div className="landing-report-row" key={row.event_type+'-'+row.target}><span>{eventName(row.event_type,row.target)}</span><b>{row.count}</b></div>)}</div>:<p>No button clicks or scroll activity recorded yet.</p>}</article>
   <article className="panel"><h3>Visits by day</h3>{report.daily.length?<div className="landing-report-table">{report.daily.map(row=><div className="landing-report-row" key={row.day}><span>{new Date(row.day+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'})}</span><b>{row.visits} visits</b><b>{row.trials} trials</b><b>{row.signups} accounts</b></div>)}</div>:<p>No daily data yet.</p>}</article>
   <article className="panel"><h3>Most common events</h3>{report.events.length?<div className="landing-report-table">{report.events.filter(row=>!['click','scroll'].includes(row.event_type)).map(row=><div className="landing-report-row" key={row.event_type+'-'+row.target}><span>{eventName(row.event_type,row.target)}</span><b>{row.count}</b></div>)}</div>:<p>No tracked events yet.</p>}</article>
  </section>
  <p className="form-help">Visits use a random first-party session ID. No IP address, email, workout content, or page text is stored in this report. A guest trial is linked to its guest account ID so you can label it in Users. UTM campaign names and a yes/no Google Ads click-tag indicator help group visits by source; raw ad click IDs are not stored. Data older than 180 days is cleared when new visits arrive.</p>
 </>;
}
