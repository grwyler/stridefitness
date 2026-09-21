export type DayCompletion={date:string;completedAt:string};
export function isDayComplete(rows:DayCompletion[]|undefined,date:string){return !!rows?.some(row=>row.date===date)}
export function setDayComplete(rows:DayCompletion[]|undefined,date:string,complete:boolean,completedAt=new Date().toISOString()){
 const without=(rows||[]).filter(row=>row.date!==date);
 return complete?[...without,{date,completedAt}]:without;
}
