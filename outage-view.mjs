/** R3 item 8: gentle outage overlay (blackout or leak). DOM only; the shift
 * simulation keeps running underneath and nothing is lost. Each kind has its own
 * hands-on action: swipe the breaker lever up, or turn the valve around once.
 * Timing follows the sim clock passed to tick(), so pausing pauses it too. */
import {OUTAGE_KINDS,OUTAGE_SELF_CLEAR,ENGINEER} from './hotel-manage.mjs';
export const LEVER_TRAVEL=56,VALVE_TURN=330;
/** 0..1 lever progress from an upward drag (dy is negative when moving up). */
export const leverProgress=dy=>Math.max(0,Math.min(1,-dy/LEVER_TRAVEL));
/** Smallest signed angle step between two pointer angles, in degrees. */
export function valveStep(prev,next){let d=next-prev;while(d>180)d-=360;while(d<-180)d+=360;return d;}
export function mountOutage({root,document:doc=globalThis.document,reducedMotion=()=>false,onFixed=()=>{},engineer=()=>false}){
 const layer=doc.createElement('div');layer.id='outage-layer';layer.className='outage-layer';layer.hidden=true;root.append(layer);
 let ev=null;
 const el=(t,c,txt)=>{const e=doc.createElement(t);if(c)e.className=c;if(txt!=null)e.textContent=txt;return e;};
 function finish(by){
  if(!ev||ev.done)return;ev.done=true;const k=OUTAGE_KINDS[ev.kind];
  layer.classList.add('fixed');ev.note.textContent=by==='tink'?ENGINEER.emoji+' Tink fixed it. '+k.done:by==='you'?k.done+' 🪙 +6 thank-you':k.done;
  onFixed(by,ev.kind);const e=ev;setTimeout(()=>{if(ev===e){layer.hidden=true;layer.replaceChildren();layer.className='outage-layer';ev=null;}},reducedMotion()?600:1800);
 }
 function lever(){
  const box=el('div','outage-breaker'),slot=el('div','breaker-slot'),knob=el('button','breaker-knob');knob.type='button';knob.id='outage-action';
  knob.setAttribute('aria-label','Breaker lever. Swipe up to turn the lights back on');knob.innerHTML='<i aria-hidden="true"></i>';
  box.append(el('b','breaker-label','MAIN'),slot);slot.append(knob);
  let start=null,keys=0;const set=p=>{knob.style.setProperty('--lever',String(p));box.classList.toggle('near',p>.6);};
  knob.onpointerdown=e=>{if(ev?.done)return;start=e.clientY;knob.setPointerCapture?.(e.pointerId);e.preventDefault?.();};
  knob.onpointermove=e=>{if(start===null)return;const p=leverProgress(e.clientY-start);set(p);if(p>=1){start=null;finish('you');}};
  knob.onpointerup=knob.onpointercancel=()=>{if(start===null)return;start=null;if(!ev?.done)set(0);};
  knob.onkeydown=e=>{if(!['ArrowUp','Enter',' '].includes(e.key))return;e.preventDefault?.();keys++;set(Math.min(1,keys/3));if(keys>=3)finish('you');};
  set(0);return box;
 }
 function valve(){
  const box=el('div','outage-pipe'),wheel=el('button','valve-wheel');wheel.type='button';wheel.id='outage-action';
  wheel.setAttribute('aria-label','Valve wheel. Turn it around once to stop the drip');
  wheel.innerHTML='<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26"/><path d="M32 6v52M6 32h52M13.6 13.6l36.8 36.8M50.4 13.6L13.6 50.4"/><circle class="hub" cx="32" cy="32" r="7"/></svg>';
  const drip=el('i','leak-drip'),puddle=el('i','leak-puddle');box.append(el('i','pipe-run'),wheel,drip,puddle);
  let last=null,total=0;const ang=e=>{const r=wheel.getBoundingClientRect();return Math.atan2(e.clientY-(r.top+r.height/2),e.clientX-(r.left+r.width/2))*180/Math.PI;};
  const set=()=>{wheel.style.setProperty('--turn',total+'deg');box.style.setProperty('--valve',String(Math.min(1,Math.abs(total)/VALVE_TURN)));};
  wheel.onpointerdown=e=>{if(ev?.done)return;last=ang(e);wheel.setPointerCapture?.(e.pointerId);e.preventDefault?.();};
  wheel.onpointermove=e=>{if(last===null)return;const a=ang(e);total+=valveStep(last,a);last=a;set();if(Math.abs(total)>=VALVE_TURN){last=null;finish('you');}};
  wheel.onpointerup=wheel.onpointercancel=()=>{last=null;};
  wheel.onkeydown=e=>{if(!['ArrowRight','ArrowLeft','Enter',' '].includes(e.key))return;e.preventDefault?.();total+=90;set();if(total>=VALVE_TURN)finish('you');};
  set();return box;
 }
 function start(kind,simTime){
  if(ev||!OUTAGE_KINDS[kind])return false;const k=OUTAGE_KINDS[kind];
  layer.replaceChildren();layer.className='outage-layer outage-'+kind+(reducedMotion()?' calm':'');layer.hidden=false;
  const veil=el('div','outage-veil'),card=el('div','outage-card'),note=el('p','outage-note',k.icon+' '+k.name+'! '+k.hint+'.');note.setAttribute('role','status');
  card.append(note,kind==='blackout'?lever():valve());
  if(engineer())card.append(el('small','outage-tink',ENGINEER.emoji+' Tink is on his way…'));
  else card.append(el('small','outage-calm','No rush. It clears up by itself too.'));
  layer.append(veil,card);ev={kind,at:simTime,done:false,note};return true;
 }
 function tick(simTime){if(!ev||ev.done)return;const t=simTime-ev.at;if(engineer()&&t>=4)finish('tink');else if(t>=OUTAGE_SELF_CLEAR)finish('self');}
 function setPaused(v){layer.classList.toggle('paused',!!v);}
 function clear(){ev=null;layer.hidden=true;layer.replaceChildren();layer.className='outage-layer';}
 return {start,tick,setPaused,clear,layer,get active(){return !!ev&&!ev.done;},get kind(){return ev?.kind||null;}};
}
