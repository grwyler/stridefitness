import {z} from 'zod';
import {landingSessionPattern,recordLandingEvent} from '@/lib/landing-analytics';
const input=z.object({
 sessionId:z.string().regex(landingSessionPattern),
 eventType:z.enum(['page_view','click','scroll','engagement']),
 target:z.string().regex(/^[a-z0-9_-]{1,80}$/i).nullable().optional(),
 durationSeconds:z.number().int().min(0).max(14400).optional(),
 maxScrollPercent:z.number().int().min(0).max(100).optional(),
 referrer:z.string().max(2000).nullable().optional(),
 utmSource:z.string().max(120).nullable().optional(),utmMedium:z.string().max(120).nullable().optional(),
 utmCampaign:z.string().max(120).nullable().optional(),utmContent:z.string().max(120).nullable().optional(),
 utmTerm:z.string().max(120).nullable().optional(),googleAdsClick:z.boolean().optional(),
});
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Use Stride to continue.'},{status:403});
 try{
  const parsed=input.safeParse(await request.json());if(!parsed.success)return Response.json({error:'Invalid landing-page event.'},{status:400});
  const cf=(request as Request & {cf?:{country?:string;region?:string}}).cf;
  await recordLandingEvent({...parsed.data,country:cf?.country,region:cf?.region});
  return Response.json({ok:true},{headers:{'Cache-Control':'no-store','Set-Cookie':`stride_landing_session=${parsed.data.sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`}});
 }catch{return Response.json({error:'Analytics are temporarily unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
