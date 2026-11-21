import {ITEMS,RECIPES,GENERATORS,ORDER_ITEMS,WIDTH,HEIGHT} from './content.mjs';
const copy=v=>structuredClone(v);const validBoard=b=>b==='farm'||b==='kitchen';
function item(s,type,origins){return {id:`item-${s.next++}`,type,origins:[...new Set(origins)]};}
export function newGame(){const s={schema:1,next:1,boards:{farm:Array(WIDTH*HEIGHT).fill(null),kitchen:Array(WIDTH*HEIGHT).fill(null)},stations:{loaf:[null,null],sandwich:[null,null,null]},parcels:[],coins:0,served:0,project:0,level:{farm:0,kitchen:0},journal:[],revision:0};
 for(const [b,types] of [['farm',['sheaf','sheaf','tomato','tomato']],['kitchen',['milk','milk','loaf','cheese']]])types.forEach((type,i)=>s.boards[b][i]=item(s,type,[b]));return s;}
export function validate(s){if(!s||s.schema!==1)throw Error('Unsupported save version. Original data is preserved.');
 for(const k of ['next','coins','served','project','revision'])if(!Number.isSafeInteger(s[k])||s[k]<0)throw Error('Invalid save counter.');
 if(s.next<1||s.project>3||!s.boards||!s.level||!Array.isArray(s.parcels)||s.parcels.length>2000||!Array.isArray(s.journal)||s.journal.length>60)throw Error('Invalid world state.');
 const ids=new Set();let max=0;
 const checkItem=x=>{if(!x||!/^item-[1-9]\d*$/.test(x.id)||!Object.hasOwn(ITEMS,x.type)||ids.has(x.id)||!Array.isArray(x.origins)||!x.origins.length||x.origins.length>2||x.origins.some(o=>!validBoard(o)))throw Error('Invalid or duplicate item.');ids.add(x.id);max=Math.max(max,Number(x.id.slice(5)));};
 for(const b of ['farm','kitchen']){if(!Array.isArray(s.boards[b])||s.boards[b].length!==WIDTH*HEIGHT||!Number.isSafeInteger(s.level[b])||s.level[b]<0)throw Error('Invalid board.');for(const x of s.boards[b])if(x!==null)checkItem(x);}
 if(s.stations!==undefined){
  if(!s.stations||typeof s.stations!=='object'||Array.isArray(s.stations)||Object.keys(s.stations).length!==Object.keys(RECIPES).length)throw Error('Invalid kitchen stations.');
  for(const [id,recipe] of Object.entries(RECIPES)){const slots=s.stations[id];if(!Array.isArray(slots)||slots.length!==recipe.inputs.length)throw Error('Invalid kitchen station slots.');for(let i=0;i<slots.length;i++){if(slots[i]!==null){checkItem(slots[i]);if(slots[i].type!==recipe.inputs[i])throw Error('Wrong ingredient in kitchen station.');}}}
 }
 const parcelIds=new Set();for(const p of s.parcels){if(!p||!/^parcel-[1-9]\d*$/.test(p.id)||parcelIds.has(p.id)||!validBoard(p.from)||!validBoard(p.to)||p.from===p.to||!['waiting','received','recalled'].includes(p.status)||typeof p.type!=='string'||!Object.hasOwn(ITEMS,p.type))throw Error('Invalid parcel.');parcelIds.add(p.id);max=Math.max(max,Number(p.id.slice(7)));if(p.status==='waiting'){checkItem(p.item);if(p.item.type!==p.type)throw Error('Parcel contents mismatch.');}else if(p.item!==null)throw Error('Settled parcel holds an item.');}
 if(s.next<=max||s.journal.some(x=>typeof x!=='string'||x.length>300))throw Error('Invalid save sequence or journal.');return s;}
export function currentOrder(s){const type=ORDER_ITEMS[s.served%ORDER_ITEMS.length];return {type,reward:type==='loaf'?12:28};}
export function recipeSlots(s,board,id){const recipe=RECIPES[id];if(!recipe||!validBoard(board))return null;const used=[];for(const type of recipe.inputs){const index=s.boards[board].findIndex((x,i)=>x?.type===type&&!used.includes(i));if(index<0)return null;used.push(index);}return used;}
export function command(state,c){validate(state);const s=copy(state);let message='';let b=s.boards[c.board];const slot=i=>Number.isInteger(i)&&i>=0&&i<WIDTH*HEIGHT;const fail=message=>({state,message,changed:false});
 if(!validBoard(c.board))return fail('Choose a worksite.');
 switch(c.type){
 case 'spawn':{const gen=GENERATORS[c.generator];if(!gen)return fail('Unknown generator.');const i=b.indexOf(null);if(i<0)return fail('The board is full. Merge, move or remove an item first.');const base=gen.output;const type=s.level[c.board]>=4?ITEMS[base].next:base;b[i]=item(s,type,[c.board]);message=`${gen.name} produced ${ITEMS[type].name}.`;break;}
 case 'drop':{if(!slot(c.from)||!slot(c.to)||c.from===c.to||!b[c.from])return fail('Choose an item and another square.');const a=b[c.from],target=b[c.to];if(!target){b[c.to]=a;b[c.from]=null;message=`Moved ${ITEMS[a.type].name}.`;}else if(a.type===target.type&&ITEMS[a.type].next){b[c.to]=item(s,ITEMS[a.type].next,[...a.origins,...target.origins]);b[c.from]=null;message=`Merged into ${ITEMS[b[c.to].type].name}.`;}else return fail('Those items do not merge. Choose an empty square or an identical tier.');break;}
 case 'remove':{if(!slot(c.index)||!b[c.index])return fail('Choose an item to remove.');message=`Removed ${ITEMS[b[c.index].type].name}. Undo can restore it.`;b[c.index]=null;break;}
 case 'station_load':case 'station_return':case 'station_collect':{
  if(c.board!=='kitchen')return fail('Use cooking stations in the kitchen.');
  if(!Object.hasOwn(RECIPES,c.station))return fail('Choose a kitchen station.');
  const recipe=RECIPES[c.station];
  s.stations??=Object.fromEntries(Object.entries(RECIPES).map(([id,r])=>[id,r.inputs.map(()=>null)]));
  const slots=s.stations[c.station];
  if(c.type==='station_collect'){
   if(!slots.every(Boolean))return fail('Put every ingredient into the station first.');
   const dest=b.indexOf(null);if(dest<0)return fail('Make room on the board. Your ingredients stay safely in the station.');
   b[dest]=item(s,recipe.output,slots.flatMap(x=>x.origins));s.stations[c.station]=slots.map(()=>null);message=`Made ${ITEMS[recipe.output].name} and placed it on the board.`;
  }else{
   if(!Number.isInteger(c.slot)||c.slot<0||c.slot>=slots.length)return fail('Choose an ingredient slot.');
   if(c.type==='station_load'){
    if(!slot(c.index)||!b[c.index])return fail('Select an ingredient on the board first.');
    if(slots[c.slot])return fail('That station slot already has its ingredient.');
    if(b[c.index].type!==recipe.inputs[c.slot])return fail(`This slot needs ${ITEMS[recipe.inputs[c.slot]].name}.`);
    slots[c.slot]=b[c.index];b[c.index]=null;message=`Placed ${ITEMS[slots[c.slot].type].name} in the ${c.station==='loaf'?'oven':'prep counter'}.`;
   }else{
    if(!slots[c.slot])return fail('That slot is empty.');const dest=b.indexOf(null);if(dest<0)return fail('Make room on the board to take this ingredient back.');
    b[dest]=slots[c.slot];slots[c.slot]=null;message=`Returned ${ITEMS[b[dest].type].name} to the board.`;
   }
  }break;
 }
 case 'craft':{if(c.board!=='kitchen')return fail('Recipes are made in the kitchen.');const indices=recipeSlots(s,c.board,c.recipe);if(!indices)return fail('Gather all recipe ingredients first.');const origins=indices.flatMap(i=>b[i].origins);indices.forEach(i=>b[i]=null);const recipe=RECIPES[c.recipe];b[indices[0]]=item(s,recipe.output,origins);message=`Made ${ITEMS[recipe.output].name}.`;break;}
 case 'ship':{if(!slot(c.index)||!b[c.index])return fail('Choose an item to ship.');if(s.parcels.length>=2000)return fail('Parcel ledger is full. Export this world before starting another experiment.');const other=c.board==='farm'?'kitchen':'farm';const x=b[c.index];b[c.index]=null;s.parcels.push({id:`parcel-${s.next++}`,from:c.board,to:other,type:x.type,item:x,status:'waiting'});message=`Sent ${ITEMS[x.type].name} to the ${other} receiving shelf.`;break;}
 case 'receive':case 'recall':{const p=s.parcels.find(p=>p.id===c.parcel);if(!p||p.status!=='waiting')return fail('That parcel has already been settled.');if((c.type==='receive'?p.to:p.from)!==c.board)return fail('This parcel belongs at the other worksite.');const i=b.indexOf(null);if(i<0)return fail('The board is full. The parcel stays safely on its shelf.');b[i]=p.item;p.item=null;p.status=c.type==='receive'?'received':'recalled';message=`${c.type==='receive'?'Received':'Recalled'} ${ITEMS[p.type].name}.`;break;}
 case 'serve':{const order=currentOrder(s);const index=b.findIndex(x=>x?.type===order.type);if(index<0)return fail(`This order needs ${ITEMS[order.type].name}.`);b[index]=null;s.coins+=order.reward;s.served++;s.level[c.board]++;message=`Served ${ITEMS[order.type].name}. Earned ${order.reward} coins.`;break;}
 case 'build':{const cost=[20,35,50][s.project];if(cost===undefined)return fail('The common table is complete. Keep cooking or explore another trade next.');if(s.coins<cost)return fail(`This upgrade needs ${cost} coins.`);s.coins-=cost;s.project++;message=['','Laid the village garden path.','Built the common table.','Lit the lanterns. A place for a shared meal.'][s.project];break;}
 default:return fail('Unknown action.');
 }
 s.revision++;s.journal=[message,...s.journal].slice(0,60);validate(s);return {state:s,message,changed:true};}
