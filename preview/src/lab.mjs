// Owns the board-first play shell; all mutations still pass through the pure engine.
import {ITEMS,RECIPES,GENERATORS,GARDEN_DECOR,GENERATOR_SITES} from './content.mjs';
import {command,currentOrder,gardenStatus,orderOptions} from './engine.mjs';
import {KEY,load,save,parseImport,backupAvailable,restoreBackup} from './persistence.mjs';
import {nextStep,gardenStep} from './guide.mjs';
import {icon,village,garden as gardenArt,stationArt} from './art.mjs';
const RECIPE_INPUTS=new Set(Object.values(RECIPES).flatMap(r=>r.inputs));
const briefStep=step=>({merge:'Merge the glowing pair.',generator:'Grow a little more.',ship:'Send your harvest.',receive:'Your parcel is ready.',serve:'Ready to serve.',garden:'A gift for the garden.',station:step.command?'Your recipe is ready.':'Add the glowing ingredient in Cook.'}[step.cue?.kind]||step.text);
const briefAction=step=>step.site?`${step.site==='farm'?'Farm':'Kitchen'} →`:({ship:'Send →',receive:'Receive',serve:'Serve',station_collect:'Make →',garden_contribute:'Contribute'}[step.command?.type]||step.label);
const sheetTitle=name=>({cook:'In the kitchen',parcels:'Parcels',orders:'Choose an order'}[name]);
const stationName=id=>id==='loaf'?'Hearth oven':id==='sandwich'?'Prep counter':RECIPES[id].name;
const stationImage=(id,ready)=>stationArt(id==='loaf'?'loaf':'sandwich',ready);
export function producers(state,board,esc){
 const full=state.boards[board].every(Boolean),upgraded=state.level[board]>=4;
 return `<div class="producer-row" role="group" aria-label="Ingredient generators">${Object.entries(GENERATORS).filter(([id])=>GENERATOR_SITES[board].includes(id)).map(([id,g])=>{
  const base=upgraded&&RECIPE_INPUTS.has(g.output);
  return `<div class="producer-wrap"><button class="producer-tile" data-spawn="${id}" aria-label="${esc(g.name)}: produce ${esc(ITEMS[upgraded?ITEMS[g.output].next:g.output].name)}" ${full?'disabled':''}><span class="producer-art">${icon(upgraded?ITEMS[g.output].next:g.output)}</span><span><strong>${esc(g.name)}</strong><small>Tap to grow</small></span><span class="producer-plus" aria-hidden="true">+</span></button>${base?`<button class="producer-base" data-spawn-base="${id}" ${full?'disabled':''}>Get ${esc(ITEMS[g.output].name)}</button>`:''}</div>`;
 }).join('')}</div>`;
}
export function mount(root,{toast:announce,esc}){
 let loaded;try{loaded=load(localStorage);}catch(e){loaded={state:null,blocked:true,error:e.message};}
 let state=loaded.state,board='farm',selected=null,history=[],disposed=false,view='play',sheet=null,returnFocus=null,goal='orders';
 let outcome=null,outcomeTimer,outcomeAnchor=null;
 function clearOutcome(){clearTimeout(outcomeTimer);outcome=null;outcomeAnchor=null;}
 function toast(text,error=/^(Action was not saved|Import rejected|Restore stopped|Save file is too large)/.test(text)){
  clearTimeout(outcomeTimer);outcome={text,error};announce(text);renderOutcome(true);
  if(!error&&view==='play')outcomeTimer=setTimeout(()=>{outcome=null;renderOutcome();},4000);
 }
 function renderOutcome(reveal=false){
  let target=root.querySelector('.sheet-outcome');
  if(!target&&outcomeAnchor&&view==='garden'){
   const card=root.querySelector(outcomeAnchor)?.closest('.garden-need');
   if(card){target=card.querySelector('.inline-outcome');if(!target){target=document.createElement('p');target.className='inline-outcome';card.append(target);}}
  }
  if(!target&&view==='play')target=root.querySelector('.next-step p');
  if(!target){
   const destination=root.querySelector('.destination');
   if(destination){target=destination.querySelector('.activity-outcome');if(!target){target=document.createElement('p');target.className='activity-outcome';destination.querySelector('h1')?.after(target);}}
  }
  if(!target)return;
  const isHint=target.matches('.next-step p');
  target.hidden=!outcome&&!isHint;
  target.textContent=outcome?.text||(isHint?briefStep((goal==='garden'?gardenStep:nextStep)(state,board)):'');
  target.classList.toggle('showing-outcome',Boolean(outcome));target.classList.toggle('error-outcome',Boolean(outcome?.error));
  if(isHint&&outcome?.error&&/another tab/i.test(outcome.text)){
   let reload=target.parentElement.querySelector('button');
   if(!reload){reload=document.createElement('button');reload.className='primary';target.parentElement.append(reload);}
   reload.id='reload-world';reload.textContent='Reload';reload.setAttribute('aria-label','Reload the latest saved world');reload.onclick=()=>window.location.reload();
  }
  if(reveal&&outcome&&(outcome.error||view!=='play'))requestAnimationFrame(()=>{if(target.isConnected)target.scrollIntoView({block:outcomeAnchor&&!outcome.error?'nearest':'center',behavior:'instant'});});
 }
 const output=(name,raw)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([raw],{type:'application/json'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
 const focus=selector=>root.querySelector(selector)?.focus({preventScroll:true});
 function run(c,site=board){
  try{const r=command(state,{...c,board:site});if(r.changed){const arrivals=r.state.boards[board].flatMap((x,i)=>x&&x.id!==state.boards[board][i]?.id?[i]:[]);save(localStorage,r.state,state);history.push(state);history=history.slice(-80);state=r.state;selected=null;render();for(const i of arrivals){const cell=root.querySelector(`[data-cell="${i}"]`);cell?.classList.add('just-arrived');cell?.addEventListener('animationend',()=>cell.classList.remove('just-arrived'),{once:true});}}toast(r.message);return r.changed;}
  catch(e){toast('Action was not saved: '+e.message);return false;}
 }
 function undo(){if(!history.length)return;const previous=history.at(-1);try{save(localStorage,previous,state);state=previous;history.pop();selected=null;render();toast('Previous action undone.');}catch(e){toast(e.message,true);}}
 function importFile(file){
  if(!file)return;if(file.size>2000000){toast('Save file is too large.');return;}
  file.text().then(raw=>{if(disposed)return;const next=parseImport(raw),old=localStorage.getItem(KEY);if(old!==null)localStorage.setItem(KEY+'.before-import',old);localStorage.setItem(KEY,JSON.stringify(next));state=next;history=[];selected=null;loaded={state:next,blocked:false};render();toast('World imported. The previous file is kept as a backup.');}).catch(e=>toast('Import rejected: '+e.message));
 }
 function closeSheet(){sheet=null;render();if(returnFocus)focus(returnFocus);}
 function openSheet(name,source){clearOutcome();sheet=name;returnFocus=source;render();focus('#sheet-close');}
 function stations(){
  return `<p class="sheet-intro">Tap an ingredient space to add food from your kitchen board. Tap filled spaces to return it.</p><div class="station-grid">${Object.entries(RECIPES).map(([id,r])=>{
   const slots=state.stations?.[id]||r.inputs.map(()=>null),ready=slots.every(Boolean);
   return `<article class="cooking-station ${ready?'ready':''}"><div class="station-header"><span class="station-art">${stationImage(id,ready)}</span><div><h3>${esc(stationName(id))}</h3><span class="small">${slots.filter(Boolean).length}/${slots.length} ingredients</span></div></div><div class="ingredient-slots">${r.inputs.map((type,i)=>{
    const available=state.boards.kitchen.some(x=>x?.type===type);
    return `<button class="ingredient-slot ${slots[i]?'filled':available?'accepts':''}" data-station="${id}" data-station-slot="${i}" aria-label="${esc(stationName(id))}: ${slots[i]?'take back':'add'} ${esc(ITEMS[type].name)}"><span>${icon(type)}</span><small>${esc(ITEMS[type].name)}</small><em>${slots[i]?'Return':available?'Add':'Needed'}</em></button>`;
   }).join('')}</div><button class="station-finish ${ready?'primary':''}" data-station-collect="${id}" ${ready&&state.boards.kitchen.includes(null)?'':'disabled'}>${ready?(state.boards.kitchen.includes(null)?`Make ${esc(ITEMS[r.output].name)}`:'Make room on the board'):'Gather ingredients'}</button></article>`;
  }).join('')}</div>`;
 }
 function orders(){
  return `<p class="sheet-intro">A small bake or a bigger meal. Every order waits for you.</p>${orderOptions(state).map(option=>`<article class="parcel-card"><span class="parcel-icon">${icon(option.type)}</span><span><strong>${esc(option.name)}</strong><small>${option.reward} coins · no expiry</small></span><button data-order="${option.type}" ${!option.available||option.selected?'disabled':''}>${option.selected?'Current':'Choose'}</button></article>`).join('')}`;
 }
 function parcels(){
  const incoming=state.parcels.filter(p=>p.to===board&&p.status==='waiting'),outgoing=state.parcels.filter(p=>p.from===board&&p.status==='waiting');
  return `<h3>Arriving at the ${board}</h3>${incoming.map(p=>`<div class="parcel-card"><span class="parcel-icon">${icon(p.type)}</span><span><strong>${esc(ITEMS[p.type].name)}</strong><small>From your ${p.from}</small></span><button data-receive="${p.id}" ${state.boards[board].includes(null)?'':'disabled'}>Receive</button></div>`).join('')||'<p class="quiet-empty">No waiting parcels.</p>'}<h3>On the way</h3>${outgoing.map(p=>`<div class="parcel-card"><span class="parcel-icon">${icon(p.type)}</span><span><strong>${esc(ITEMS[p.type].name)}</strong><small>To your ${p.to}</small></span><button data-recall="${p.id}">Recall</button></div>`).join('')||'<p class="quiet-empty">Nothing in transit.</p>'}<p class="sheet-intro">Parcels wait safely. Both places belong to this device; two-player exchange is still to come.</p>`;
 }
 function garden(){
  const status=gardenStatus(state);
  return `<section class="destination garden-destination" aria-labelledby="destination-title"><span class="eyebrow">Second Paw · a rescue garden</span><h1 id="destination-title">Our garden</h1><div class="garden-scene">${gardenArt(status.stage,status.decor)}</div><div class="garden-caption"><span class="eyebrow">${status.complete?'A little place, made together':`Chapter ${status.stage+1} of 5`}</span><h2>${esc(status.complete?'The welcome lights are on':status.title)}</h2><p>${status.complete?'Your garden stays here, whenever you return.':'A harvest, a meal, a little care. Every contribution stays.'}</p><progress value="${status.stage}" max="5" aria-label="Garden project progress"></progress></div>${!status.complete?`<div class="garden-needs">${status.needs.map(n=>{const available=['farm','kitchen'].some(site=>state.boards[site].some(x=>x?.type===n.type));return `<div class="garden-need"><span class="need-icon">${icon(n.type)}</span><span><strong>${esc(ITEMS[n.type].name)}</strong><small>${n.donated}/${n.required} contributed</small></span><button data-contribute="${n.type}" ${n.remaining&&available?'':'disabled'}>${n.remaining?'Add':'Done'}</button></div>`;}).join('')}</div><div class="garden-caption"><button id="garden-build" class="primary" ${status.ready?'':'disabled'}>Build · ${status.cost} coins</button><button id="garden-find">Gather for the garden</button>${state.coins<status.cost?`<p class="small">${status.cost-state.coins} more coins · earn them by serving orders</p>`:''}</div>`:`<div class="garden-decor"><h3>Make it yours</h3>${Object.entries(GARDEN_DECOR).map(([id,d])=>`<button data-decor="${id}" aria-pressed="${status.decor===id}" ${status.decor===id||state.coins<d.cost?'disabled':''}>${esc(d.name)} · ${status.decor===id?'Planted':d.cost+' coins'}</button>`).join('')}</div>`}${legacyProject()}</section>`;
 }
 function legacyProject(){
  if(!state.project)return '';
  const cost=[20,35,50][state.project];
  return `<details class="menu-card legacy-project"><summary>Your original common table · ${state.project}/3</summary>${village(state.project)}${cost===undefined?'<p>Your common table is complete.</p>':`<button id="build" ${state.coins<cost?'disabled':''}>Continue · ${cost} coins</button>`}</details>`;
 }
 function book(){return `<section class="destination" aria-labelledby="destination-title"><span class="eyebrow">From harvest to table</span><h1 id="destination-title">Recipe book</h1><div class="recipe-list">${Object.entries(RECIPES).map(([id,r])=>`<article class="recipe-card"><div class="recipe-title"><span class="recipe-output">${icon(r.output)}</span><div><h2>${esc(ITEMS[r.output].name)}</h2><span class="small">${esc(stationName(id))}</span></div></div><div class="recipe-ingredients">${r.inputs.map(t=>`<span><i>${icon(t)}</i>${esc(ITEMS[t].name)}</span>`).join('')}</div><button data-cook="${id}">Make in kitchen</button></article>`).join('')}</div></section>`;}
 function menu(){return `<section class="destination" aria-labelledby="destination-title"><span class="eyebrow">Your little world</span><h1 id="destination-title">Menu</h1><details class="menu-card"><summary>How to play</summary><ol><li>Tap two matching pieces to merge them, or drag one onto the other.</li><li>Select food and send it to your other place. Open Parcels to receive it.</li><li>In the kitchen, open Cook and tap ingredient spaces to fill a recipe.</li><li>Serve a finished dish. Spend your coins in the garden.</li></ol><p>Keyboard: Tab between controls, Enter to select, then Tab to a destination and Enter. Undo restores the previous action.</p></details><section class="menu-card"><h2>Your save</h2><p>Saved automatically in this browser. Export a copy to move your world to another device.</p><div class="menu-actions"><button id="export-save">Export world</button><button id="export-backup">Export prior save</button><label class="import-label">Import world<input type="file" id="import" accept="application/json,.json"></label></div><p class="small">Import keeps the previous file as a backup.</p></section><details class="menu-card"><summary>Recent moments</summary><div class="log">${state.journal.map(x=>`<p>${esc(x)}</p>`).join('')||'<p>Your story starts with a harvest.</p>'}</div></details><p class="local-note">A solo prototype · both places save on this device.<br>Online cooperation is still in development.</p></section>`;}
 function cueCells(step,b){
  if(step.cue?.indices)return step.cue.indices;
  if(step.command?.type==='ship')return [step.command.index];
  if(!/merge/i.test(step.text))return [];
  for(const [type,item] of Object.entries(ITEMS))if(step.text.includes(item.name)){
   const indices=b.flatMap((x,i)=>x?.type===type?[i]:[]);if(indices.length>=2)return indices.slice(0,2);
  }
  return [];
 }
 function play(){
  const b=state.boards[board],order=currentOrder(state),step=(goal==='garden'?gardenStep:nextStep)(state,board),cues=cueCells(step,b),incoming=state.parcels.filter(p=>p.to===board&&p.status==='waiting'),ready=b.some(x=>x?.type===order.type);
  const selectedItem=selected===null?null:b[selected];
  return `<section class="play-surface ${board}" aria-label="${board} worksite"><div class="place-tabs" role="group" aria-label="Your places"><button data-site="farm" aria-pressed="${board==='farm'}">Farm</button><button data-site="kitchen" aria-pressed="${board==='kitchen'}">Kitchen</button><button id="parcels" class="parcel-trigger ${incoming.length?'has-parcels':''}" aria-label="Parcels${incoming.length?`: ${incoming.length} waiting`:''}">Parcels${incoming.length?` <span class="count">${incoming.length}</span>`:''}</button></div><div class="order-strip"><span class="order-icon">${icon(order.type)}</span><button id="orders" class="order-select" aria-label="${state.served?'Choose an order':'First order: Country loaf'}" ${state.served?'':'disabled'}><strong>${esc(ITEMS[order.type].name)}${state.served?' ▾':''}</strong><small>${order.reward} coins${state.served?' · choose an order':' · first order'}</small></button>${ready?'<button id="serve" class="primary">Serve</button>':`<button id="cook">${board==='kitchen'?'Cook':'Recipe'}</button>`}</div><div class="board-panel">${producers(state,board,esc)}<div class="board" role="group" aria-label="${board} merge board">${b.map((x,i)=>`<button class="cell ${selected===i?'selected':''} ${cues.includes(i)?'hint-cell':''}" data-cell="${i}" aria-pressed="${selected===i}" aria-label="Row ${Math.floor(i/6)+1}, column ${i%6+1}: ${x?esc(ITEMS[x.type].name):'empty'}" ${x?`title="${esc(ITEMS[x.type].name)}"`:''}>${x?icon(x.type):''}${cues.includes(i)?'<span class="cue-dot" aria-hidden="true"></span>':''}</button>`).join('')}</div></div><div class="board-tools">${selectedItem?`<span class="selection-name">${esc(ITEMS[selectedItem.type].name)}</span><button id="ship">Send →</button><button id="remove" aria-label="Remove selected ${esc(ITEMS[selectedItem.type].name)}">Remove</button>`:`<span class="board-caption">${board==='farm'?'A little harvest, one merge at a time.':'Good food starts with simple things.'}</span>`}<button id="undo" aria-label="Undo last action" ${history.length?'':'disabled'}>Undo</button></div>${goal==='garden'?'<button id="order-goal" class="goal-switch">Helping the garden · Back to orders</button>':''}<div class="next-step" aria-label="Next step"><span class="next-mark" aria-hidden="true">↗</span><p>${esc(briefStep(step))}</p>${step.label?`<button id="next-step" class="primary" aria-label="${esc(step.label)}">${esc(briefAction(step))}</button>`:step.cue?.kind==='station'?'<button id="next-cook" class="primary">Cook →</button>':''}</div></section>`;
 }
 function recovery(){
  root.innerHTML=`<section class="destination recovery"><h1>Let's keep your world safe</h1><p>${esc(loaded.error)}</p><p>Your original data has not been overwritten.</p><div class="menu-actions">${backupAvailable(localStorage)?'<button id="restore-backup" class="primary">Restore last automatic save</button>':''}<button id="export-raw">Export original data</button><label class="import-label">Import a valid save<input type="file" id="import" accept="application/json,.json"></label></div></section>`;
  root.querySelector('#export-raw').onclick=()=>output('common-table-recovery.json',loaded.raw||'');root.querySelector('#import').onchange=e=>importFile(e.target.files[0]);
  const restore=root.querySelector('#restore-backup');if(restore)restore.onclick=()=>{try{state=restoreBackup(localStorage);loaded={state,blocked:false};history=[];selected=null;render();toast('Restored the last automatic save. Damaged data is kept separately.');}catch(e){toast('Restore stopped: '+e.message);}};
 }
 function render(){
  if(disposed)return;if(loaded.blocked){recovery();renderOutcome();return;}
  const active=document.activeElement,focusId=active?.id||null,oldScroll=root.querySelector('.sheet-body')?.scrollTop||0;
  root.innerHTML=`<div class="game-shell"><header class="game-header"><a class="skip-play" href="#play-content">Skip to game</a><span class="wordmark">Common Table<span class="wordmark-leaf" aria-hidden="true">✦</span></span><span class="coin-counter" aria-label="${state.coins} coins"><i aria-hidden="true">◈</i> ${state.coins}</span></header><main id="play-content" tabindex="-1">${view==='play'?play():view==='garden'?garden():view==='book'?book():menu()}</main><nav class="game-nav" aria-label="Game destinations">${[['play','Play','▦'],['garden','Garden','❋'],['book','Recipes','☷'],['menu','Menu','☰']].map(([id,label,symbol])=>`<button data-view="${id}" ${view===id?'aria-current="page"':''}><span aria-hidden="true">${symbol}</span>${label}</button>`).join('')}</nav></div>${sheet?`<div class="sheet-backdrop" data-dismiss-sheet><section class="game-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><header><h2 id="sheet-title">${sheetTitle(sheet)}</h2><button id="sheet-close" aria-label="Close ${sheetTitle(sheet)}">Done</button></header><p class="sheet-outcome outcome-status" hidden></p><div class="sheet-body">${sheet==='cook'?stations():sheet==='orders'?orders():parcels()}</div></section></div>`:''}`;
  root.querySelectorAll('[data-view]').forEach(el=>el.onclick=()=>{view=el.dataset.view;selected=null;sheet=null;clearOutcome();render();focus('#play-content');window.scrollTo({top:0,behavior:'instant'});});
  root.querySelectorAll('[data-site]').forEach(el=>el.onclick=()=>{board=el.dataset.site;selected=null;render();focus(`[data-site="${board}"]`);});
  root.querySelectorAll('[data-spawn]').forEach(el=>el.onclick=()=>{run({type:'spawn',generator:el.dataset.spawn});focus(`[data-spawn="${el.dataset.spawn}"]`);});
  root.querySelectorAll('[data-spawn-base]').forEach(el=>el.onclick=()=>run({type:'spawn',generator:el.dataset.spawnBase,base:true}));
  bindActions();bindCells();
  if(view==='play'){const step=(goal==='garden'?gardenStep:nextStep)(state,board);if(step.cue?.generator)root.querySelector(`[data-spawn="${step.cue.generator}"]`)?.classList.add('hint-generator');if(step.cue?.kind==='station')root.querySelector('#cook')?.classList.add('hint-generator');}
  if(sheet){root.querySelector('#sheet-close').onclick=closeSheet;root.querySelector('[data-dismiss-sheet]').onclick=e=>{if(e.target===e.currentTarget)closeSheet();};root.querySelector('.sheet-body').scrollTop=oldScroll;}
  const shell=root.querySelector('.game-shell');if(sheet)shell.inert=true;document.body.classList.toggle('sheet-open',Boolean(sheet));
  if(focusId&&root.querySelector(`#${focusId}`))focus(`#${focusId}`);
  renderOutcome();
  if(!root.contains(document.activeElement))focus(sheet?'#sheet-close':root.querySelector('#next-step')?'#next-step':root.querySelector('#next-cook')?'#next-cook':'#play-content');
 }
 function bindActions(){
  const on=(id,fn)=>{const el=root.querySelector('#'+id);if(el)el.onclick=fn;};
  on('orders',()=>openSheet('orders','#orders'));
  root.querySelectorAll('[data-order]').forEach(el=>el.onclick=()=>{if(run({type:'choose_order',order:el.dataset.order}))closeSheet();});
  on('parcels',()=>openSheet('parcels','#parcels'));on('cook',()=>{if(board==='farm'){view='book';render();focus('#play-content');}else openSheet('cook','#cook');});
  root.querySelectorAll('[data-cook]').forEach(el=>el.onclick=()=>{board='kitchen';view='play';selected=null;openSheet('cook','#cook');});
  on('next-step',()=>{const step=(goal==='garden'?gardenStep:nextStep)(state,board);if(step.site){board=step.site;selected=null;render();}else if(step.command)run(step.command);focus('#next-step');});
  on('next-cook',()=>openSheet('cook','#next-cook'));on('order-goal',()=>{clearOutcome();goal='orders';render();});
  on('garden-find',()=>{clearOutcome();goal='garden';view='play';render();focus('#play-content');});
  on('garden-build',()=>{outcomeAnchor=null;run({type:'garden_build'});});
  root.querySelectorAll('[data-contribute]').forEach(el=>el.onclick=()=>{const type=el.dataset.contribute;let site=['farm','kitchen'].find(site=>state.boards[site].some(x=>x?.type===type));if(!site)return;outcomeAnchor=`[data-contribute="${type}"]`;run({type:'garden_contribute',index:state.boards[site].findIndex(x=>x?.type===type)},site);const same=root.querySelector(`[data-contribute="${type}"]:not(:disabled)`);focus(same?`[data-contribute="${type}"]`:root.querySelector('[data-contribute]:not(:disabled)')?'[data-contribute]:not(:disabled)':root.querySelector('#garden-build:not(:disabled)')?'#garden-build':'#garden-find');});
  root.querySelectorAll('[data-decor]').forEach(el=>el.onclick=()=>run({type:'garden_decor',style:el.dataset.decor}));
  on('ship',()=>run({type:'ship',index:selected}));on('remove',()=>run({type:'remove',index:selected}));on('undo',undo);on('serve',()=>run({type:'serve'}));on('build',()=>run({type:'build'}));
  on('export-save',()=>output('common-table-world.json',JSON.stringify(state,null,2)));on('export-backup',()=>{const raw=localStorage.getItem(KEY+'.before-import')||localStorage.getItem(KEY+'.backup');if(raw)output('common-table-backup.json',raw);else toast('No previous save yet.');});
  const importer=root.querySelector('#import');if(importer)importer.onchange=e=>importFile(e.target.files[0]);
  root.querySelectorAll('[data-station-slot]').forEach(el=>el.onclick=()=>{
   const station=el.dataset.station,slot=Number(el.dataset.stationSlot),type=RECIPES[station].inputs[slot],chosen=selected!==null&&state.boards.kitchen[selected]?.type===type?selected:state.boards.kitchen.findIndex(x=>x?.type===type);
   if(!state.stations?.[station]?.[slot]&&chosen<0){toast(`Find ${ITEMS[type].name} on your kitchen board first.`);return;}
   run({type:state.stations?.[station]?.[slot]?'station_return':'station_load',station,slot,index:chosen});focus(`[data-station="${station}"][data-station-slot="${slot}"]`);
  });
  root.querySelectorAll('[data-station-collect]').forEach(el=>el.onclick=()=>{if(run({type:'station_collect',station:el.dataset.stationCollect})){sheet=null;render();focus(root.querySelector('#serve')?'#serve':'#cook');}});
  root.querySelectorAll('[data-receive]').forEach(el=>el.onclick=()=>run({type:'receive',parcel:el.dataset.receive}));root.querySelectorAll('[data-recall]').forEach(el=>el.onclick=()=>run({type:'recall',parcel:el.dataset.recall}));
 }
 function bindCells(){
  const b=state.boards[board];let suppressClick=false;
  function select(i){const focusCell=()=>focus(`[data-cell="${i}"]`);if(selected===i){selected=null;render();focusCell();return;}if(selected===null){if(b[i]){selected=i;render();focusCell();}}else{const r=command(state,{type:'drop',board,from:selected,to:i});if(r.changed){run({type:'drop',from:selected,to:i});focusCell();}else if(b[i]){selected=i;render();focusCell();toast(r.message);}else toast(r.message);}}
  root.querySelectorAll('[data-cell]').forEach(el=>{const i=Number(el.dataset.cell);el.onclick=()=>{if(suppressClick){suppressClick=false;return;}select(i);};el.onpointerdown=e=>{
   if(!b[i]||e.button!==0)return;const start={x:e.clientX,y:e.clientY};let moved=false,ghost=null;el.setPointerCapture(e.pointerId);
   const clean=()=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',end);el.removeEventListener('pointercancel',clean);ghost?.remove();};
   const move=ev=>{if(Math.hypot(ev.clientX-start.x,ev.clientY-start.y)>7)moved=true;if(!moved)return;if(!ghost){ghost=document.createElement('div');ghost.className='drag-ghost';ghost.innerHTML=icon(b[i].type);document.body.append(ghost);}ghost.style.left=ev.clientX+'px';ghost.style.top=ev.clientY+'px';};
   const end=ev=>{clean();if(moved){suppressClick=true;const target=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('[data-cell],[data-station-slot]');if(target&&root.contains(target)){if(target.dataset.station)run({type:'station_load',index:i,station:target.dataset.station,slot:Number(target.dataset.stationSlot)});else run({type:'drop',from:i,to:Number(target.dataset.cell)});}setTimeout(()=>suppressClick=false,0);}};
   el.addEventListener('pointermove',move);el.addEventListener('pointerup',end);el.addEventListener('pointercancel',clean);
  };});
 }
 const keyboard=e=>{if(!sheet)return;if(e.key==='Escape'){e.preventDefault();closeSheet();return;}if(e.key==='Tab'){const controls=[...root.querySelectorAll('.game-sheet button:not(:disabled),.game-sheet input')],first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};
 root.addEventListener('keydown',keyboard);render();return ()=>{disposed=true;clearTimeout(outcomeTimer);root.removeEventListener('keydown',keyboard);document.body.classList.remove('sheet-open');document.querySelectorAll('.drag-ghost').forEach(el=>el.remove());};
}
