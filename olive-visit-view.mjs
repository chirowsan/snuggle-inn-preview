/** Result-screen card for Olive's tea visit: a gentle letter plus three get-ready
 * tasks, each with its own action (tap ×3, rub, press-and-hold). DOM only; the
 * caller owns saving through onTask(id). No timers shown, nothing can fail. */
import {OLIVE_TASKS,olivePrepCount,oliveDue,oliveVisitWords} from './hotel-manage.mjs';
const HOLD_MS=1200,RUB_PX=220,TAPS=3;
export function renderOliveCard(el,{manage,visit=null,onTask=()=>{},sound=()=>{}}={}){
 const doc=el.ownerDocument;el.replaceChildren();
 const due=oliveDue(manage);
 if(visit){
  const v=doc.createElement('div');v.className='olive-card olive-visited';v.id='olive-visit-result';
  v.innerHTML='<span class="olive-owl" aria-hidden="true">🦉</span><div><b>Olive came for tea</b><p></p><small></small></div>';
  v.querySelector('p').textContent=oliveVisitWords(visit.done);
  v.querySelector('small').textContent=(visit.done===3?'🏅 Cozy Seal · ':'')+visit.done+'/3 ready · 🪙 +'+visit.reward;
  el.append(v);
 }
 if(!due){el.hidden=!visit;return;}
 el.hidden=false;
 const card=doc.createElement('div');card.className='olive-card olive-letter';card.id='olive-letter';
 card.innerHTML='<span class="olive-owl" aria-hidden="true">✉️</span><div><b>Olive drops by for tea next shift</b><p class="olive-count"></p></div><div class="olive-tasks" role="group" aria-label="Get ready for Olive"></div>';
 const count=card.querySelector('.olive-count'),list=card.querySelector('.olive-tasks');
 const refresh=()=>{const n=olivePrepCount(manage);count.textContent=n===3?'All ready! She will love it.':'Get ready if you like: '+n+'/3';};
 for(const t of OLIVE_TASKS){
  const b=doc.createElement('button');b.type='button';b.className='olive-task task-'+t.id;b.id='olive-'+t.id;
  b.innerHTML='<span class="task-icon" aria-hidden="true">'+t.icon+'</span><span class="task-name"></span><small class="task-hint"></small><i class="task-meter" aria-hidden="true"></i>';
  b.querySelector('.task-name').textContent=t.name;b.querySelector('.task-hint').textContent=t.hint;
  const meter=b.querySelector('.task-meter');let progress=0;
  const done=()=>(manage.olive.prep&t.bit)!==0;
  const paint=()=>{b.classList.toggle('done',done());b.style.setProperty('--p',done()?1:Math.min(1,progress));b.setAttribute('aria-pressed',String(done()));b.setAttribute('aria-label',t.name+(done()?', done':', '+t.hint));if(done())b.querySelector('.task-hint').textContent='✓ Done';};
  const finish=()=>{if(done())return;progress=1;onTask(t.id);sound('happy');paint();refresh();};
  const bump=()=>{b.classList.remove('bump');void b.offsetWidth;b.classList.add('bump');};
  if(t.id==='pillows')b.addEventListener('click',()=>{if(done())return;progress+=1/TAPS;bump();sound('tap');if(progress>=.999)finish();else paint();});
  if(t.id==='bell'){
   let down=null,dist=0;
   b.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};b.setPointerCapture?.(e.pointerId);});
   b.addEventListener('pointermove',e=>{if(!down||done())return;dist+=Math.abs(e.clientX-down.x)+Math.abs(e.clientY-down.y);down={x:e.clientX,y:e.clientY};progress=dist/RUB_PX;b.classList.add('rubbing');if(progress>=1)finish();else paint();});
   const up=()=>{down=null;b.classList.remove('rubbing');};b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);
   b.addEventListener('click',()=>{if(done())return;dist+=RUB_PX/4;progress=dist/RUB_PX;bump();sound('tap');if(progress>=.999)finish();else paint();}); // tap fallback: 4 taps
  }
  if(t.id==='plants'){
   let timer=0,start=0,raf=0;const win=doc.defaultView;
   const stop=()=>{win.clearTimeout(timer);win.cancelAnimationFrame?.(raf);timer=0;b.classList.remove('holding');if(!done()){progress=0;paint();}};
   const step=()=>{if(!timer)return;progress=(win.performance.now()-start)/HOLD_MS;paint();raf=win.requestAnimationFrame?.(step);};
   b.addEventListener('pointerdown',e=>{if(done())return;e.preventDefault?.();start=win.performance.now();b.classList.add('holding');timer=win.setTimeout(()=>{timer=0;b.classList.remove('holding');finish();},HOLD_MS);step();});
   for(const k of ['pointerup','pointerleave','pointercancel'])b.addEventListener(k,()=>{if(timer)stop();});
   b.addEventListener('click',e=>{if(e.detail===0)finish();}); // keyboard: Enter/Space waters at once
   b.addEventListener('contextmenu',e=>e.preventDefault());
  }
  paint();list.append(b);
 }
 refresh();el.append(card);
}
