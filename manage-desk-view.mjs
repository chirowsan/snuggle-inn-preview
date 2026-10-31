/** Manager's desk: one calm place to see the team, the month's money and the
 * inn's little collections. DOM only; the caller saves through the callbacks. */
import {FRIENDS,monthBill,monthProgress,OLIVE_FROM_SHIFT,MONTH_SHIFTS,BILL_SHARE,ENGINEER,engineerGate,OUTAGE_KINDS} from './hotel-manage.mjs';
import {friendArt} from './garden-friends-view.mjs';
import {renderOliveCard} from './olive-visit-view.mjs';
import {renderPressArchive} from './press-card-view.mjs';
import {renderUpperFloors} from './upper-floors-view.mjs';
const ICON={pip:'🦊',bramble:'🦡',rue:'🦊',tink:'🦫'};
export const DESK_TABS=Object.freeze([{id:'team',label:'Team'},{id:'money',label:'Money'},{id:'inn',label:'Inn'}]);
export function renderManageDesk(section,{profile,manage,tab='team',onTab=()=>{},onClose=()=>{},renderStaff=null,onTask=()=>{},onHire=()=>{},sound=()=>{}}){
 const doc=section.ownerDocument,el=(t,c,txt)=>{const e=doc.createElement(t);if(c)e.className=c;if(txt!=null)e.textContent=txt;return e;};
 section.replaceChildren();
 const close=el('button','close');close.id='close-manage';close.type='button';close.setAttribute('aria-label','Close manager’s desk');close.textContent='×';close.onclick=onClose;
 const title=el('h2','desk-title','📋 Manager’s desk');title.id='manage-title';
 const nav=el('nav','desk-tabs');nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Manager’s desk');
 for(const t of DESK_TABS){const b=el('button','desk-tab'+(t.id===tab?' active':''),t.label);b.type='button';b.id='desk-tab-'+t.id;b.setAttribute('role','tab');b.setAttribute('aria-selected',String(t.id===tab));b.onclick=()=>{sound('tap');onTab(t.id);};nav.append(b);}
 const body=el('div','desk-body');body.id='desk-'+tab;body.setAttribute('role','tabpanel');
 section.append(close,title,nav,body);
 const bill=monthBill(profile,manage),mp=monthProgress(profile,manage);
 if(tab==='team'){
  const list=el('ul','desk-team');
  for(const t of bill.team){const li=el('li','desk-row');li.dataset.id=t.id;li.append(el('span','desk-ico',ICON[t.id]),el('b',null,t.name),el('span','desk-job',t.job),el('span','desk-wage','🪙 '+t.wage+'/month'));list.append(li);}
  if(!bill.team.some(t=>t.id==='rue')){const li=el('li','desk-row locked');li.append(el('span','desk-ico','🔒'),el('b',null,'Rue'),el('span','desk-job','routine chores, joins when the inn grows'),el('span','desk-wage','Shop → Team'));list.append(li);}
  const g=engineerGate(profile,manage);
  if(g.state==='hired'){const li=[...list.children].find(x=>x.dataset?.id==='tink');const fixes=manage.crew.fixes|0;if(li)li.append(el('small','desk-note','🔧 '+fixes+' fix'+(fixes===1?'':'es')+' so far'));}
  else{const li=el('li','desk-row'+(g.state==='locked'?' locked':''));li.id='desk-engineer';li.append(el('span','desk-ico',g.state==='locked'?'🔒':ENGINEER.emoji),el('b',null,'Tink'),el('span','desk-job','engineer: spots breakages, fixes outages · 🪙 15/month'));
   if(g.state==='ready'){const b=el('button','primary desk-hire',g.text);b.type='button';b.id='hire-engineer';b.onclick=()=>{sound('tap');onHire();};li.append(b);}else li.append(el('span','desk-wage',g.text));list.append(li);}
  body.append(list);
  const last=manage.outage?.last;if(last){const k=OUTAGE_KINDS[last.kind],c=el('div','olive-card desk-card');c.append(el('span','olive-owl',k.icon));const d=el('div');d.append(el('b',null,'Last '+k.name.toLowerCase()+' (shift '+last.shift+')'),el('p',null,last.by==='you'?'You fixed it · 🪙 +'+last.reward:last.by==='tink'?'Tink fixed it':'It cleared up by itself'));c.append(d);body.append(c);}
  if(renderStaff){const box=el('section','desk-staff');body.append(box);renderStaff(box);}
 }
 if(tab==='money'){
  const now=el('div','olive-card desk-card');
  now.append(el('span','olive-owl','📒'));const d=el('div');d.append(el('b',null,'Month '+mp.month+' · '+mp.shift+' of '+mp.of+' shifts done'),el('p',null,'Earned so far 🪙 '+mp.income));now.append(d);body.append(now);
  const next=el('div','olive-card desk-card');next.append(el('span','olive-owl','🧾'));const n=el('div');
  n.append(el('b',null,'Month-end bill: 🪙 '+bill.bill),el('p',null,'Helpers 🪙 '+bill.wages+' · Upkeep 🪙 '+bill.upkeep+' ('+bill.rooms+' room'+(bill.rooms===1?'':'s')+(bill.venues?', '+bill.venues+' venue'+(bill.venues===1?'':'s'):'')+')'),
   el('small',null,mp.month===1?'🎁 Your first month is on the house.':'Never more than '+Math.round(BILL_SHARE*100)+'% of the month’s takings. No debt, ever.'));next.append(n);body.append(next);
  const last=manage.month.last,l=el('div','olive-card desk-card');l.append(el('span','olive-owl','🗂️'));const ld=el('div');
  if(last)ld.append(el('b',null,'Last month ('+last.month+')'),el('p',null,'Earned 🪙 '+last.income+' · Paid 🪙 '+last.paid+(last.waived?' · waived 🪙 '+last.waived:'')));else ld.append(el('b',null,'Last month'),el('p',null,'Your first month is still going.'));
  l.append(ld);body.append(l);
 }
 if(tab==='inn'){
  renderUpperFloors(body,profile);
  body.append(el('h3','desk-h','Garden friends'));
  const album=el('ul','desk-album');
  for(const f of FRIENDS){const c=manage.friends[f.id]|0,li=el('li','desk-friend'+(c?'':' unmet'));li.innerHTML=friendArt(f.id);li.append(el('b',null,c?f.name:'?'),el('small',null,c?'helped ×'+c:'not met yet'));li.setAttribute('aria-label',c?f.name+', helped '+c+' times':'Not met yet');album.append(li);}
  body.append(album);
  const o=manage.olive,seal=el('div','olive-card desk-card');seal.append(el('span','olive-owl','🏅'));const sd=el('div');
  sd.append(el('b',null,'Cozy Seals: '+o.seals),el('p',null,'Olive’s tea visits: '+o.visits));seal.append(sd);body.append(seal);
  const prep=el('div','desk-olive');body.append(prep);
  if(o.due)renderOliveCard(prep,{manage,onTask,sound});
  else{prep.hidden=false;const w=el('div','olive-card desk-card');w.append(el('span','olive-owl','🦉'));const wd=el('div');const c=profile.shiftsCompleted|0;
   wd.append(el('b',null,'Olive’s next letter'),el('p',null,c<OLIVE_FROM_SHIFT-1?'She starts visiting once the inn has a few shifts behind it.':'Comes after the 2nd shift of a month ('+MONTH_SHIFTS+' shifts each).'));w.append(wd);prep.append(w);}
  renderPressArchive(body,manage.press);
 }
}
