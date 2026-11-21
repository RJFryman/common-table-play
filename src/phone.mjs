import {mount} from './lab.mjs';
let timer;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast=message=>{const el=document.querySelector('#toast');el.textContent=message;el.style.display='block';clearTimeout(timer);timer=setTimeout(()=>el.style.display='none',5000);};
mount(document.querySelector('#lab'),{toast,esc});
