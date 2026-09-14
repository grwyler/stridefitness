export function recoveryKeys(storage:Storage,prefix:string){return Object.keys(storage).filter(key=>key===prefix||key.startsWith(prefix+':'))}
export function clearAcknowledgedRecovery(storage:Storage,key:string,prefix:string){storage.removeItem(key);return recoveryKeys(storage,prefix).length>0}
