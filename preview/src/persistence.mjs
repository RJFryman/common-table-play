import {validate,newGame} from './engine.mjs';
export const KEY='common-table.lab.save.v1';
const parse=raw=>{try{return JSON.parse(raw);}catch{throw Error('Saved data is not readable JSON. Original data is preserved.');}};
export function load(storage){const raw=storage.getItem(KEY);if(raw===null)return {state:newGame(),blocked:false};try{return {state:validate(parse(raw)),blocked:false};}catch(e){return {state:null,blocked:true,raw,error:e.message};}}
export function save(storage,state,expected){validate(state);const old=storage.getItem(KEY);if(expected&&old!==null&&JSON.stringify(JSON.parse(old))!==JSON.stringify(expected))throw Error("This world changed in another tab. Export your current world, then reload before editing.");if(old!==null){validate(JSON.parse(old));storage.setItem(KEY+'.backup',old);}storage.setItem(KEY,JSON.stringify(state));}
export function parseImport(raw){if(raw.length>2000000)throw Error('Save is too large.');return structuredClone(validate(JSON.parse(raw)));}
// Recovery for a blocked world: the automatic backup is the save from before the latest action.
// The damaged primary is kept under KEY.damaged (never silently replaced) before the backup takes its place.
export function backupAvailable(storage){try{const raw=storage.getItem(KEY+'.backup');return raw!==null&&!!validate(parse(raw));}catch{return false;}}
export function restoreBackup(storage){const raw=storage.getItem(KEY+'.backup');if(raw===null)throw Error('No automatic backup is stored.');const state=validate(parse(raw));const current=storage.getItem(KEY);
 if(current!==null&&current!==raw){let valid=false;try{validate(parse(current));valid=true;}catch{}if(valid)throw Error('A valid world is now saved. Reload before restoring an older automatic save.');}
 if(current!==null&&current!==raw){const kept=storage.getItem(KEY+'.damaged');if(kept!==null&&kept!==current)throw Error('An earlier damaged copy is already kept. Export the original data first, then import a valid save.');storage.setItem(KEY+'.damaged',current);}
 storage.setItem(KEY,raw);return structuredClone(state);}
