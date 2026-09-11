const encode=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes));
const decode=(value:string)=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
async function encryptionKey(secret:string){
 const bytes=decode(secret);
 if(bytes.length!==32)throw new Error('Invalid encryption configuration');
 return crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt']);
}
export async function encryptKey(value:string,userId:string,secret:string){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(userId)},await encryptionKey(secret),new TextEncoder().encode(value));
 return `v1.${encode(iv)}.${encode(new Uint8Array(cipher))}`;
}
export async function decryptKey(value:string,userId:string,secret:string){
 const [version,iv,cipher]=value.split('.');
 if(version!=='v1'||!iv||!cipher)throw new Error('Invalid encrypted key');
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv),additionalData:new TextEncoder().encode(userId)},await encryptionKey(secret),decode(cipher));
 return new TextDecoder().decode(plain);
}
