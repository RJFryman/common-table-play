import {validate,newGame} from './engine.mjs';
export const KEY='common-table.lab.save.v1';
export function load(storage){const raw=storage.getItem(KEY);if(raw===null)return {state:newGame(),blocked:false};try{return {state:validate(JSON.parse(raw)),blocked:false};}catch(e){return {state:null,blocked:true,raw,error:e.message};}}
export function save(storage,state,expected){validate(state);const old=storage.getItem(KEY);if(expected&&old!==null&&JSON.stringify(JSON.parse(old))!==JSON.stringify(expected))throw Error("This world changed in another tab. Export your current world, then reload before editing.");if(old!==null){validate(JSON.parse(old));storage.setItem(KEY+'.backup',old);}storage.setItem(KEY,JSON.stringify(state));}
export function parseImport(raw){if(raw.length>2000000)throw Error('Save is too large.');return structuredClone(validate(JSON.parse(raw)));}
