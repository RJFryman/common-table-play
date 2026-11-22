// Keeps the new town in its own namespace, with validated backups and optimistic writes.
import {newTown,validateTown} from './engine.mjs';
export const TOWN_KEY='common-table.town.save.v1';
const parse=raw=>{try{return JSON.parse(raw);}catch{throw Error('This town save is not readable JSON. Your original data is preserved.');}};
export function parseTownImport(raw){
 if(typeof raw!=='string'||raw.length>2000000)throw Error('This save is too large.');
 const value=parse(raw);
 if(value?.kind!=='town')throw Error('This is not a town save. Open Earlier farm to import an earlier-world save.');
 return structuredClone(validateTown(value));
}
export function loadTown(storage){
 const raw=storage.getItem(TOWN_KEY);
 if(raw===null)return {state:newTown(),raw:null,blocked:false};
 try{return {state:validateTown(parse(raw)),raw,blocked:false};}
 catch(error){return {state:null,raw,blocked:true,error:error.message};}
}
function unchanged(storage,expectedRaw){
 if(storage.getItem(TOWN_KEY)!==expectedRaw)throw Error('This town changed in another tab. Export your current town, then reload before editing.');
}
export function saveTown(storage,state,expectedRaw){
 validateTown(state);unchanged(storage,expectedRaw);
 if(expectedRaw!==null){validateTown(parse(expectedRaw));storage.setItem(TOWN_KEY+'.backup',expectedRaw);}
 const raw=JSON.stringify(state);storage.setItem(TOWN_KEY,raw);return raw;
}
export function importTown(storage,raw,expectedRaw){
 const state=parseTownImport(raw);unchanged(storage,expectedRaw);
 if(expectedRaw!==null)storage.setItem(TOWN_KEY+'.before-import',expectedRaw);
 const written=JSON.stringify(state);storage.setItem(TOWN_KEY,written);return {state,raw:written};
}
export function townBackupAvailable(storage){
 try{const raw=storage.getItem(TOWN_KEY+'.backup');return raw!==null&&Boolean(validateTown(parse(raw)));}catch{return false;}
}
export function restoreTownBackup(storage,expectedRaw){
 unchanged(storage,expectedRaw);
 const raw=storage.getItem(TOWN_KEY+'.backup');if(raw===null)throw Error('No automatic town backup is available.');
 const state=validateTown(parse(raw));
 if(expectedRaw!==null){
  let valid=false;try{validateTown(parse(expectedRaw));valid=true;}catch{}
  if(valid)throw Error('A valid town is now saved. Reload before restoring an older backup.');
  const damaged=storage.getItem(TOWN_KEY+'.damaged');
  if(damaged!==null&&damaged!==expectedRaw)throw Error('A different damaged save is already kept. Export your original before importing a valid town.');
  storage.setItem(TOWN_KEY+'.damaged',expectedRaw);
 }
 storage.setItem(TOWN_KEY,raw);return {state:structuredClone(state),raw};
}
