// Fitness dates only. Save revisions, request timeouts and receipts use real time.
export const TEST_DAY_COOKIE='stride_test_day_offset';
export function dayOffset(cookies:string){const raw=cookies.split(';').map(x=>x.trim()).find(x=>x.startsWith(TEST_DAY_COOKIE+'='))?.split('=')[1];const value=Number(raw||0);return Number.isInteger(value)&&value>=0&&value<=3650?value:0}
let testClockEnabled=false;
export function enableTestClock(enabled:boolean){testClockEnabled=enabled}
export function fitnessNow(){return new Date(Date.now()+(typeof document==='undefined'||!testClockEnabled?0:dayOffset(document.cookie))*86400000)}
