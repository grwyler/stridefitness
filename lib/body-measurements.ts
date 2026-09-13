export type BodyCheckIn={id:string;date:string;weight:number|null;bodyFat:number|null};
export function measurementTrend(entries:BodyCheckIn[],metric:'weight'|'bodyFat'){
 return entries.filter(e=>e[metric]!==null).sort((a,b)=>a.date.localeCompare(b.date)).map(e=>({date:e.date,value:e[metric] as number,time:new Date(e.date+'T12:00:00').getTime()}));
}
export function validMeasurement(date:string,weight:number|null,bodyFat:number|null,today:string){
 const parsed=new Date(date+'T12:00:00Z');
 return Number.isFinite(parsed.getTime())&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&date<=today&&parsed.toISOString().slice(0,10)===date&&(weight!==null||bodyFat!==null)&&(weight===null||Number.isFinite(weight)&&weight>0)&&(bodyFat===null||Number.isFinite(bodyFat)&&bodyFat>0&&bodyFat<100);
}
