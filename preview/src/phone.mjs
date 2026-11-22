// The mount owns visible feedback state; this region announces each new outcome once.
import {mount} from './lab.mjs';
import {mountTown} from './town/ui.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast=message=>{const region=document.querySelector('#toast');region.textContent=message;region.style.display='block';};
const classic=new URLSearchParams(location.search).get('classic')==='1';
document.body.className=classic?'playing phone-play':'town-play';
(classic?mount:mountTown)(document.querySelector('#lab'),{toast,esc});
