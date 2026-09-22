import {env} from 'cloudflare:workers';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
import {accountDataId} from './admin-activity';
import {getConnectionKey} from './ai-connection';

const STRIPE_CONNECTION='billing:stripe:sandbox';
export const TOP_UP_CENTS=500;
export const TOP_UP_MICROS=5_000_000;

function db(){const value=(env as unknown as {DB?:D1Database}).DB;if(!value)throw new Error('Billing storage is unavailable.');return value}
export async function billingStatus(user:ChatGPTUser){
 const id=await accountDataId(user),row=await db().prepare('SELECT stripe_customer_id,balance_micros,updated_at FROM billing_accounts WHERE user_id = ?').bind(id).first<{stripe_customer_id:string|null;balance_micros:number;updated_at:string}>();
 return {enabled:true,sandbox:true,ready:!!row?.stripe_customer_id,balanceMicros:Math.max(0,row?.balance_micros||0),updatedAt:row?.updated_at||null};
}
export async function hasPaidBalance(user:ChatGPTUser){return (await billingStatus(user)).balanceMicros>0}
function stripeBody(values:Record<string,string>){const body=new URLSearchParams();for(const [key,value] of Object.entries(values))body.set(key,value);return body}
async function stripe(path:string,init:RequestInit={}){
 const key=await getConnectionKey(STRIPE_CONNECTION);if(!key)throw new Error('Stripe sandbox is not connected.');
 const response=await fetch(`https://api.stripe.com${path}`,{...init,headers:{Authorization:`Bearer ${key}`,'Stripe-Version':'2026-07-29.dahlia',...(init.body?{'Content-Type':'application/x-www-form-urlencoded'}:{})}});
 const result=await response.json().catch(()=>({})) as Record<string,unknown>;if(!response.ok)throw new Error(typeof (result.error as {message?:unknown})?.message==='string'?(result.error as {message:string}).message:'Stripe could not complete billing setup.');return result;
}
async function metronome(path:string,body:unknown){
 const saved=await getConnectionKey('billing:metronome:sandbox');if(!saved)return null;const token=(JSON.parse(saved) as {token?:string}).token;if(!token)return null;return fetch(`https://api.metronome.com${path}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
}
export async function createTopUpCheckout(user:ChatGPTUser,origin:string){
 const id=await accountDataId(user);const row=await db().prepare('SELECT stripe_customer_id FROM billing_accounts WHERE user_id = ?').bind(id).first<{stripe_customer_id:string|null}>();let customer=row?.stripe_customer_id||null;
 if(!customer){const created=await stripe('/v1/customers',{method:'POST',body:stripeBody({email:user.email,name:user.fullName||user.displayName||'Stride member','metadata[stride_user_id]':id})});customer=String(created.id||'');if(!customer.startsWith('cus_'))throw new Error('Stripe did not create a customer.');await db().prepare('INSERT INTO billing_accounts (user_id,stripe_customer_id,balance_micros,updated_at) VALUES (?,?,0,?) ON CONFLICT(user_id) DO UPDATE SET stripe_customer_id=excluded.stripe_customer_id,updated_at=excluded.updated_at').bind(id,customer,new Date().toISOString()).run()}
 const suffix=crypto.randomUUID().replace(/-/g,'').slice(0,8),created=await stripe('/v1/checkout/sessions',{method:'POST',body:stripeBody({mode:'payment',customer,client_reference_id:id,'line_items[0][price_data][currency]':'usd','line_items[0][price_data][unit_amount]':String(TOP_UP_CENTS),'line_items[0][price_data][product_data][name]':'Stride AI balance','line_items[0][quantity]':'1',success_url:`${origin}/api/billing/complete?session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${origin}/?billing=cancelled`,integration_identifier:`stride_ai_${suffix}`})});
 const url=String(created.url||'');if(!url.startsWith('https://checkout.stripe.com/'))throw new Error('Stripe did not return a secure checkout link.');return url;
}
export async function completeTopUp(user:ChatGPTUser,sessionId:string){
 if(!/^cs_test_[A-Za-z0-9_]+$/.test(sessionId))throw new Error('Invalid checkout session.');const id=await accountDataId(user),session=await stripe(`/v1/checkout/sessions/${encodeURIComponent(sessionId)}`),paid=session.payment_status==='paid',owner=session.client_reference_id===id,amount=session.amount_total===TOP_UP_CENTS;
 if(!paid||!owner||!amount||session.livemode!==false)throw new Error('This test payment could not be verified.');const now=new Date().toISOString(),insert=await db().prepare('INSERT OR IGNORE INTO billing_topups (checkout_session_id,user_id,amount_micros,applied_at) VALUES (?,?,?,?)').bind(sessionId,id,TOP_UP_MICROS,now).run();if((insert.meta.changes||0)>0){await db().prepare('UPDATE billing_accounts SET balance_micros=balance_micros+?,updated_at=? WHERE user_id=?').bind(TOP_UP_MICROS,now,id).run();try{await metronome('/v1/customers',{name:(user.fullName||user.displayName||'Stride member').slice(0,160),ingest_aliases:[id],customer_billing_provider_configurations:[{billing_provider:'stripe',delivery_method:'direct_to_billing_provider',configuration:{stripe_customer_id:String(session.customer),stripe_collection_method:'charge_automatically'}}]})}catch{console.error('stride_metronome_customer_sync_failed')}}
}
type Usage={input_tokens?:number;output_tokens?:number;input_tokens_details?:{cached_tokens?:number}};
export async function chargeAIUsage(user:ChatGPTUser,model:string,usage?:Usage){
 if(!usage)return;const id=await accountDataId(user),input=Math.max(0,usage.input_tokens||0),cached=Math.min(input,Math.max(0,usage.input_tokens_details?.cached_tokens||0)),output=Math.max(0,usage.output_tokens||0);if(!input&&!output)return;
 // GPT-4.1 mini: $0.40/M uncached input, $0.10/M cached input, $1.60/M output.
 const cost=Math.max(1,Math.ceil((input-cached)*0.4+cached*0.1+output*1.6)),now=new Date().toISOString(),chargeId=crypto.randomUUID();
 await db().batch([db().prepare('INSERT INTO ai_usage_charges (id,user_id,model,input_tokens,cached_input_tokens,output_tokens,cost_micros,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(chargeId,id,model,input,cached,output,cost,now),db().prepare('UPDATE billing_accounts SET balance_micros=MAX(0,balance_micros-?),updated_at=? WHERE user_id=?').bind(cost,now,id)]);
 try{await metronome('/v1/ingest',[{transaction_id:chargeId,customer_id:id,event_type:'stride_ai_tokens',timestamp:now,properties:{model,input_tokens:input,cached_input_tokens:cached,output_tokens:output,cost_micros:cost}}])}catch{console.error('stride_metronome_usage_sync_failed')}
}
