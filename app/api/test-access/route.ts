import {env} from 'cloudflare:workers';
import {createStrideSessionCookie} from '@/app/chatgpt-auth';
import {legacyAccountId} from '@/lib/auth-identities';
const TEST_EMAIL='test-operator@stride.local';
async function hash(value:string){return new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))}
async function matches(left:string,right:string){const [a,b]=await Promise.all([hash(left),hash(right)]);let difference=0;for(let index=0;index<a.length;index+=1)difference|=a[index]^b[index];return difference===0}
export async function POST(request:Request){if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Open test access from Stride.'},{status:403});const code=String((await request.json().catch(()=>({}))).code||''),secret=(env as unknown as {TEST_ACCESS_SECRET?:string}).TEST_ACCESS_SECRET;if(!secret||secret.length<24)return Response.json({error:'Test access is not configured.'},{status:503});if(!await matches(code,secret))return Response.json({error:'That test access code is not valid.'},{status:401});const accountId=await legacyAccountId(TEST_EMAIL),cookie=await createStrideSessionCookie({userId:'test:automation',accountId,accountType:'test',email:TEST_EMAIL,displayName:'Test operator',fullName:null});return Response.json({ok:true},{headers:{'Set-Cookie':cookie,'Cache-Control':'no-store'}})}
