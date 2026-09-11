export function classifyAIError(status:number,failure:{error?:{code?:string;type?:string;message?:string}},retryAfter:string|null){
 const e=failure.error||{},detail=`${e.code||''} ${e.type||''} ${e.message||''}`.toLowerCase();
 const billing='https://platform.openai.com/settings/organization/billing',limits='https://platform.openai.com/settings/organization/limits';
 if(/insufficient_quota|billing|current quota|credits|balance|spend limit/.test(detail))return {error:'OpenAI reports that your API credits or spending allowance are exhausted. Check API billing and limits before trying again.',reason:'quota',actionUrl:billing,actionLabel:'Open API billing',retryAfter:0};
 if(status===401)return {error:'OpenAI did not accept this key. Use Manage AI to replace it.',reason:'invalid_key',retryAfter:0};
 if(status===403||e.code==='model_not_found')return {error:'This API key does not have access to the model. Check the project permissions and model limits.',reason:'access',actionUrl:limits,actionLabel:'Open API limits',retryAfter:0};
 if(status===429){
  if(/request too large|requested.*exceed|exceeds.*limit/.test(detail))return {error:'This plan request exceeds your OpenAI account’s rate limit. Check the model’s token limit in API settings; repeatedly retrying will not fix a request that is too large.',reason:'request_limit',actionUrl:limits,actionLabel:'Open API limits',retryAfter:0};
  const seconds=Number(retryAfter);const cooldown=Number.isFinite(seconds)&&seconds>0?Math.ceil(seconds):60;
  return {error:`OpenAI has reached a rate limit for this API account. Wait ${cooldown} seconds before trying again.`,reason:'rate_limit',actionUrl:limits,actionLabel:'Check API limits',retryAfter:cooldown};
 }
 return {error:'OpenAI could not complete the request. Please try again later.',reason:'provider_error',retryAfter:0};
}
