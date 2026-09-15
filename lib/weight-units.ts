const KG_TO_LB=2.2046226218;

export function explicitKilograms(messages:{content:string}[]):number[]{
 const values:number[]=[];
 for(const message of messages){
  const pattern=/(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilograms?)\b/gi;
  for(const match of message.content.matchAll(pattern))values.push(Number(match[1]));
 }
 return values.filter(Number.isFinite);
}

export function normalizePoundValue(value:number|null,kilograms:number[]):number|null{
 if(value===null)return null;
 const supplied=kilograms.find(kg=>Math.abs(kg-value)<.001);
 return supplied===undefined?value:Math.round(supplied*KG_TO_LB*2)/2;
}
