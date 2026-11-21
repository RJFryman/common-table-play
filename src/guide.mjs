// Pure next-step guidance for the first-play loop: shipment → recipe → order.
// Reads a validated world and returns one suggestion; never mutates or issues commands itself.
// A step is {text, label?, command?} (an existing engine command for this board) or {text, label, site} (switch worksite).
import {ITEMS,RECIPES,GENERATORS} from './content.mjs';
import {currentOrder} from './engine.mjs';
const STATION={loaf:'Hearth oven',sandwich:'Prep counter'};
const COLLECT={loaf:'Bake & collect loaf',sandwich:'Assemble & collect sandwich'};
const name=t=>ITEMS[t].name;
const list=ts=>{const n=ts.map(name);return n.length<2?n.join(''):`${n.slice(0,-1).join(', ')} and ${n.at(-1)}`;};
const go=(site,text)=>({text,label:`Go to the ${site}`,site});

export function nextStep(s,board){
 const other=board==='farm'?'kitchen':'farm',here=s.boards[board],order=currentOrder(s);
 const incoming=s.parcels.find(p=>p.to===board&&p.status==='waiting');
 if(incoming&&here.includes(null))return {text:`${name(incoming.type)} arrived from the ${incoming.from}.`,label:`Receive ${name(incoming.type)}`,command:{type:'receive',parcel:incoming.id}};
 if(here.some(x=>x?.type===order.type))return {text:`The order wants ${name(order.type)}.`,label:`Serve ${name(order.type)} · ${order.reward} coins`,command:{type:'serve'}};
 if(incoming)return {text:`${name(incoming.type)} is waiting on the receiving shelf. The board is full: merge, send or remove an item first.`};
 if(s.parcels.some(p=>p.to===other&&p.status==='waiting'))return go(other,`Your parcel is waiting on the ${other} receiving shelf.`);
 // The first order teaches shipping, so the starter loaf waiting in the kitchen does not short-circuit the farm.
 if(s.served>0&&s.boards[other].some(x=>x?.type===order.type))return go(other,`${name(order.type)} for this order is ready in the ${other}.`);
 return need(s,board,order.type,0)||{text:`The order wants ${name(order.type)}.`};
}

function need(s,board,type,depth){
 if(depth>3)return null;
 const recipe=RECIPES[type];if(!recipe)return null;
 const kitchen=s.boards.kitchen,slots=s.stations?.[type]||recipe.inputs.map(()=>null);
 if(slots.every(Boolean)){
  if(board!=='kitchen')return go('kitchen',`The ${STATION[type]} is ready to make ${name(type)}.`);
  return kitchen.includes(null)?{text:`Every ingredient is in the ${STATION[type]}.`,label:COLLECT[type],command:{type:'station_collect',station:type}}:{text:`Make room on the kitchen board to collect ${name(type)}. The ingredients stay safely in the ${STATION[type]}.`};
 }
 const open=recipe.inputs.filter((t,i)=>!slots[i]);
 const missing=open.filter(t=>!kitchen.some(x=>x?.type===t));
 if(!missing.length)return board==='kitchen'?{text:`Place ${list(open)} in the ${STATION[type]}: tap each ingredient, then its matching space.`}:go('kitchen',`${list(open)} for the ${STATION[type]} are in the kitchen.`);
 const want=missing[0];
 if(RECIPES[want])return need(s,board,want,depth+1);
 const farmIndex=s.boards.farm.findIndex(x=>x?.type===want);
 if(farmIndex>=0)return board==='farm'?{text:`The ${STATION[type]} needs this ${name(want)}.`,label:`Send ${name(want)} to the kitchen`,command:{type:'ship',index:farmIndex}}:go('farm',`${name(want)} for the ${STATION[type]} is on the farm.`);
 return make(s,board,want,`The ${STATION[type]} needs ${name(want)}.`);
}

function make(s,board,type,why){
 const other=board==='farm'?'kitchen':'farm',count=(b,t)=>s.boards[b].filter(x=>x?.type===t).length;
 for(let t=type;;){
  const prev=Object.keys(ITEMS).find(k=>ITEMS[k].next===t);
  if(!prev){
   const [id,gen]=Object.entries(GENERATORS).find(([,g])=>g.output===t);
   if(!s.boards[board].includes(null))return {text:`${why} The board is full: merge, send or remove an item first.`};
   // After four orders a worksite's generator taps skip the first tier; offer the explicit base-tier request beside it.
   if(s.level[board]>=4)return {text:`${why} The ${gen.name} here now grows ${name(ITEMS[t].next)}, but it can still give you ${name(t)}.`,label:`Get ${name(t)}`,command:{type:'spawn',generator:id,base:true}};
   return {text:`${why} Tap the ${gen.name} on the board to grow more.`};
  }
  if(count(board,prev)>=2)return {text:`${why} Merge two ${name(prev)} pieces here to make ${name(t)}.`};
  if(count(other,prev)>=2)return go(other,`${why} The ${other} has two ${name(prev)} pieces to merge.`);
  const gen=Object.values(GENERATORS).find(g=>s.level[board]>=4&&ITEMS[g.output].next===prev);
  if(gen)return s.boards[board].includes(null)?{text:`${why} Tap the ${gen.name} on the board to grow more.`}:{text:`${why} The board is full: merge, send or remove an item first.`};
  t=prev;
 }
}
