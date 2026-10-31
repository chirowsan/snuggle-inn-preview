import {STAFF_ROUTINES,staffPlanForProfile,setStaffEnabled} from './hotel-staff.mjs';
/** Small DOM-only panel. The normal shop still owns the once-only Rue purchase. */
export function renderStaffControls(root,profile,onChange){
 root.replaceChildren();root.className='staff-controls';
 const plan=staffPlanForProfile(profile),hired=profile.staffCount===3;
 const title=document.createElement('strong');title.textContent=hired?'Rue · routine helper':'Rue learns alongside you';root.append(title);
 const note=document.createElement('p');note.textContent=hired?'🧺 Rue helps with chores she knows. You can help too!':'🧺 Rue does check-ins and towels. Show her new jobs once.';root.append(note);
 if(plan?.learned.length){const duties=document.createElement('p');duties.className='staff-duties';duties.textContent='Learned: '+plan.learned.map(k=>STAFF_ROUTINES[k]).join(' · ');root.append(duties);}
 if(hired){const b=document.createElement('button');b.type='button';b.className='staff-toggle';b.setAttribute('aria-pressed',String(plan?.enabled!==false));b.textContent=plan?.enabled===false?'Automatic duties off · turn on':'Automatic duties on · turn off';b.onclick=()=>{if(setStaffEnabled(profile,plan?.enabled===false))onChange();};b.disabled=!!profile.activeShift;root.append(b);}
 const cost=document.createElement('small');cost.textContent='🪙 No pay. Soap 5 · food 6, only when needed.';root.append(cost);
}
