import {z} from 'zod';
import {getConnectionKey,saveConnection,removeConnection} from './ai-connection';

// Confirmed Stripe sandbox. Never select the first provider when multiple are linked.
export const BILLING_SANDBOX_ACCOUNT='acct_1UErpVHqavrCPeLj';
const connectionId='billing:metronome:sandbox';
const savedSchema=z.object({token:z.string(),stripeAccountId:z.literal(BILLING_SANDBOX_ACCOUNT),deliveryMethodId:z.string().uuid(),verifiedAt:z.string()});
const providersSchema=z.object({data:z.array(z.object({billing_provider:z.string(),delivery_method_id:z.string(),delivery_method:z.string(),delivery_method_configuration:z.object({stripe_account_id:z.string().optional()}).passthrough()})),next_page:z.string().nullable().optional()});
export class MetronomeConnectionError extends Error {}

export async function getMetronomeConnection(){
 const saved=await getConnectionKey(connectionId);
 return saved?savedSchema.parse(JSON.parse(saved)):null;
}
export async function metronomeConnectionStatus(){
 const saved=await getMetronomeConnection();
 return {connected:!!saved,stripeAccountId:BILLING_SANDBOX_ACCOUNT,verifiedAt:saved?.verifiedAt||null,billingEnabled:true};
}
export async function connectMetronome(token:string){
 let nextPage:string|undefined;
 const visited=new Set<string>();
 const matches=new Set<string>();
 for(let page=0;page<20;page++){
  let response:Response;
  try{response=await fetch('https://api.metronome.com/v1/listConfiguredBillingProviders',{
   method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
   body:JSON.stringify(nextPage?{next_page:nextPage}:{}),
  })}catch(error){
   const message=error instanceof Error?error.message.toLowerCase():'';
   console.error('stride_metronome_request_failed',{name:error instanceof Error?error.name:'Unknown',reason:message.includes('tunnel')?'network_binding':message.includes('connect')?'connection':'request'});
   if(message.includes('tunnel')||message.includes('connect'))throw new MetronomeConnectionError('Stride cannot reach Metronome from the server yet. The token was not saved.');
   throw new MetronomeConnectionError('Stride could not contact Metronome to verify the token. The token was not saved. Please try again.');
  }
  if(response.status===401||response.status===403)throw new MetronomeConnectionError('Metronome did not accept this token, or it lacks permission to read integrations. Create a sandbox token with integration access and try again.');
  if(!response.ok)throw new MetronomeConnectionError('Metronome could not check the connection right now. Please try again.');
  const parsed=providersSchema.safeParse(await response.json());
  if(!parsed.success)throw new MetronomeConnectionError('Metronome returned an unexpected connection response. Your saved connection has not changed.');
  for(const provider of parsed.data.data){
   if(provider.billing_provider==='stripe'&&provider.delivery_method==='direct_to_billing_provider'&&provider.delivery_method_configuration.stripe_account_id===BILLING_SANDBOX_ACCOUNT){
    if(!z.string().uuid().safeParse(provider.delivery_method_id).success)throw new MetronomeConnectionError('The Stripe integration is missing its delivery ID. Recheck it in Metronome.');
    matches.add(provider.delivery_method_id);
   }
  }
  nextPage=parsed.data.next_page||undefined;
  if(!nextPage)break;
  if(visited.has(nextPage)||page===19)throw new MetronomeConnectionError('Could not finish checking all integrations. Your saved connection has not changed.');
  visited.add(nextPage);
 }
 if(matches.size!==1)throw new MetronomeConnectionError(matches.size?'More than one integration points to Stride sandbox. Check the duplicate Stripe integrations in Metronome.':'This token cannot see Stride sandbox. In Metronome’s Sandbox environment, connect Stride sandbox under Developer → Integrations, then create a token in that same environment.');
 const saved={token,stripeAccountId:BILLING_SANDBOX_ACCOUNT,deliveryMethodId:[...matches][0],verifiedAt:new Date().toISOString()};
 await saveConnection(connectionId,JSON.stringify(saved));
 return metronomeConnectionStatus();
}
export async function disconnectMetronome(){await removeConnection(connectionId)}
