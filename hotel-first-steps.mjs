import {coinPiles} from './hotel-coin-pickups.mjs';
/** Opt-in small beginnings. Legacy hotels never acquire this policy implicitly.
 * Story chapter is derived from durable hotel/checkpoint facts, not an extra timer. */
export const FIRST_STEPS_VERSION=1;
const own=(o,k)=>o&&typeof o==='object'?Object.getOwnPropertyDescriptor(o,k)?.value:undefined;
export const validFirstSteps=v=>!!v&&own(v,'version')===1&&Object.keys(v).length===1;
export const copyFirstSteps=v=>validFirstSteps(v)?{version:1}:null;
export const hasFirstSteps=p=>validFirstSteps(p?.firstSteps);
export const firstStepsRule=p=>hasFirstSteps(p)&&p.openRooms<3?(p.openRooms===1?1:2):0;
export function firstStepsOptions(rule){
 if(![1,2].includes(rule))return {};
 return {firstStepsRules:rule,arrivalSchedule:rule===1?[0]:[0,30,60],goal:rule===1?1:2,thief:false};
}
export const firstStepsItinerary=(rule,index=0)=>rule===1?['towel']:rule===2?(index===1?['towel','meal']:['towel']):null;
/** Stable IDs for the single NPC objective and rewards UI. No reward or storage writes. */
export function firstStepsTask(profile,state,{selection=null,floor=0}={}){
 if(!hasFirstSteps(profile))return null;
 const g=state?.guests?.find(g=>!['pending','departed','abandoned'].includes(g.status))||state?.guests?.[0],first=profile.guestsCompleted===0;
 const pip=(id,line,target=null)=>({id,npc:'Pip',portrait:'assets/characters/courier-portrait.webp',line,target});
 const willow=(id,line,target=null)=>({id,npc:'Willow',portrait:'assets/characters/guest-portrait.webp',line,target});
 const pile=coinPiles(state)[0];if(pile){const room=state.rooms.find(r=>r.id===pile.roomId);return pip('collect-coins','🪙 Tap the coins at the door!',floor===room.floor?'coins-'+room.id:'floor-'+room.floor);}
 if(profile.construction?.project)return pip('building','🔨 Bramble is building. Keep welcoming!');
 if(!profile.activeShift&&profile.openRooms===1&&profile.guestsCompleted>0){const missions=profile.rewards?.missions;if(missions&&Object.values(missions).some(m=>m==='earned'))return pip('first-milestone','🎁 Grab your reward, then build a room!','first-stay-reopen');return pip('build-room','🛏️ Let’s build a room for a friend!','open-build');}
 if(!profile.activeShift&&profile.openRooms===2&&profile.staffCount<3)return pip('grow-by-hand','🌱 Two rooms! Keep welcoming guests and save for room 3.','open-build');
 if(g?.status==='waiting')return pip('check-in',first?'👋 I’m Pip! Tap Willow, then her room.':g.name==='Willow'?'👋 Willow is back! Tap her, then a room.':'👋 '+g.name+' is here! Tap them, then a room.',selection?.kind==='guest'?'room-1':floor===0?'guest-'+g.id:'floor-0');
 if(g?.status==='checking-in')return willow('check-in-travel','🛏️ A soft bed! Feels like home.');
 if(g?.request==='towel')return pip('towel','🧺 Tap the towel bubble!',floor===1?g.roomId:'floor-1');
 if(g?.request==='meal')return pip('breakfast','🍳 Tap the breakfast bubble!',floor===1?g.roomId:'floor-1');
 if(g?.request==='delivering')return pip('service-travel','🚶 On our way. No rush!');
 if(g?.paid||g?.served||g?.status==='leaving')return willow('payment',state?.config?.coinPickupRules===1?'💛 Thank you! Coins soon, at my room door.':'💛 Thank you! I’ll tell a friend.');
 if(state?.config?.firstStepsRules===2)return pip('settle-in','🌱 Two rooms! One thing at a time.');
 if(profile.openRooms>=3)return null;
 return pip('welcome','🏡 Let’s make a cozy inn!');
}
export function firstStepsUnlocks(profile,state){
 if(!hasFirstSteps(profile))return {simple:false,laundry:true,meals:true,repair:true,team:true,visits:true,reviews:true,tiers:true};
 const rule=state?.config?.firstStepsRules||firstStepsRule(profile);
 return {simple:profile.openRooms<3,laundry:rule!==1,meals:rule!==1,repair:!rule,team:profile.openRooms>=2,visits:profile.openRooms>=3&&profile.shiftsCompleted>=3,reviews:profile.guestsCompleted>0||state?.completed>0,tiers:profile.openRooms>=3};
}
