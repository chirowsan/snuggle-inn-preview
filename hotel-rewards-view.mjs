import {rewardSummary} from './hotel-rewards.mjs';
/** A quiet optional control within existing pause/thank-you cards, not a tutorial. */
export function mountRewardPanel(parent,{getProfile,onClaim,now=()=>new Date(),compact=false}={}){
 const doc=parent.ownerDocument,root=doc.createElement('section');root.className='hotel-rewards'+(compact?' compact':'');root.setAttribute('aria-label','Little thank-yous');
 root.innerHTML='<div class="reward-mission" hidden><span>First welcome + first cared-for stay</span><button type="button" data-reward="missions"></button></div><div class="reward-daily"><button type="button" data-reward="daily">🎁 Daily gift · +25 🪙</button><small></small></div><p class="reward-local">💾 Saved on this phone.</p><p class="reward-message" role="status" aria-live="polite"></p>';
 parent.append(root);let busy=false,signature='';
 const mission=root.querySelector('.reward-mission'),missionButton=root.querySelector('[data-reward="missions"]'),dailyButton=root.querySelector('[data-reward="daily"]'),dailyNote=root.querySelector('.reward-daily small'),message=root.querySelector('.reward-message');
 function sync(){const s=rewardSummary(getProfile(),now()),next=JSON.stringify([s,busy]);if(next===signature)return;signature=next;mission.hidden=!s.missionCoins;mission.querySelector('span').textContent=s.pending.length===2?'Two little missions complete':s.pending[0]==='welcome'?'First guest welcomed':'First cared-for stay complete';missionButton.textContent=`Collect mission thank-you · +${s.missionCoins}`;missionButton.disabled=busy||!s.missionCoins;dailyButton.disabled=busy||!s.dailyAvailable;dailyButton.textContent=s.dailyAvailable?'🎁 Daily gift · +25 🪙':'🎁 Come back tomorrow';dailyNote.textContent=s.dailyNote;}
 for(const button of [missionButton,dailyButton])button.onclick=async()=>{if(busy)return;busy=true;sync();const kind=button.dataset.reward;
  try{const r=await onClaim(kind);if(r?.ok&&r.adopted!==false){message.textContent=`+${r.coins} 🪙 Saved!`;root.classList.remove('reward-glow');void root.offsetWidth;root.classList.add('reward-glow');}
   else if(!r?.ok)message.textContent=r?.code==='already-collected'?'Already collected.':r?.code==='clock-rollback'?'The next gift waits until your device reaches a new day.':'Could not confirm saving. Reload this hotel before trying again.';
  }finally{busy=false;sync();}};
 sync();return {root,sync,clear(){message.textContent='';signature='';sync();},destroy(){root.remove();}};
}
