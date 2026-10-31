/** DOM-only garden-friend visit: little bugs wander in the lobby; one gentle tap
 * scoops each onto a leaf and it floats home. Ignored friends wander off by
 * themselves later. No failure state, no timer pressure shown to the player. */
import {FRIENDS} from './hotel-manage.mjs';
const ART={
 ladybug:'<ellipse cx="24" cy="40" rx="15" ry="3" fill="#000" opacity=".16"/><circle cx="24" cy="13" r="6" fill="#2b2626"/><ellipse cx="24" cy="26" rx="13" ry="12" fill="#e2463c"/><path d="M24 14v24" stroke="#2b2626" stroke-width="2"/><circle cx="18" cy="23" r="2.6" fill="#2b2626"/><circle cx="30" cy="23" r="2.6" fill="#2b2626"/><circle cx="19" cy="31" r="2.2" fill="#2b2626"/><circle cx="29" cy="31" r="2.2" fill="#2b2626"/><circle cx="21.5" cy="11.5" r="1.2" fill="#fff"/><circle cx="26.5" cy="11.5" r="1.2" fill="#fff"/>',
 bee:'<ellipse cx="24" cy="40" rx="14" ry="3" fill="#000" opacity=".16"/><ellipse cx="17" cy="14" rx="7" ry="9" fill="#e8f4ff" opacity=".85" stroke="#9cb9d6"/><ellipse cx="31" cy="14" rx="7" ry="9" fill="#e8f4ff" opacity=".85" stroke="#9cb9d6"/><ellipse cx="24" cy="26" rx="13" ry="10" fill="#f6c443"/><path d="M19 17v18M27 17v18" stroke="#3a2f2a" stroke-width="3.4"/><circle cx="12.5" cy="25" r="5.5" fill="#3a2f2a"/><circle cx="11" cy="23.5" r="1.2" fill="#fff"/>',
 snail:'<ellipse cx="24" cy="40" rx="17" ry="3" fill="#000" opacity=".16"/><path d="M6 37q2-6 10-6h20q6 0 6 6Z" fill="#c9b18c"/><circle cx="27" cy="23" r="11" fill="#d98b5f"/><path d="M27 23m-6 0a6 6 0 1 0 6-6a3.5 3.5 0 1 0 3 3" fill="none" stroke="#8f4f33" stroke-width="2"/><path d="M10 31l-3-9M13 31l0-9" stroke="#c9b18c" stroke-width="2.4" stroke-linecap="round"/><circle cx="7" cy="21" r="2" fill="#3a2f2a"/><circle cx="13" cy="21" r="2" fill="#3a2f2a"/>',
 butterfly:'<ellipse cx="24" cy="41" rx="12" ry="2.6" fill="#000" opacity=".14"/><path d="M24 24C12 4 2 14 10 24C2 34 14 40 24 28C34 40 46 34 38 24C46 14 36 4 24 24Z" fill="#c9a7ff" stroke="#6b4a8b" stroke-width="1.2"/><circle cx="14" cy="17" r="3" fill="#fff6c9"/><circle cx="34" cy="17" r="3" fill="#fff6c9"/><path d="M24 14v20" stroke="#3a2f2a" stroke-width="2.6" stroke-linecap="round"/>',
 firefly:'<ellipse cx="24" cy="41" rx="12" ry="2.6" fill="#000" opacity=".14"/><circle cx="24" cy="30" r="11" fill="#fff3a0" opacity=".55"/><ellipse cx="24" cy="30" rx="6" ry="7" fill="#ffe55c"/><ellipse cx="24" cy="19" rx="6" ry="7" fill="#5b4a3a"/><ellipse cx="18" cy="17" rx="5" ry="7" fill="#e8f4ff" opacity=".8"/><ellipse cx="30" cy="17" rx="5" ry="7" fill="#e8f4ff" opacity=".8"/><circle cx="24" cy="12" r="3.5" fill="#3a2f2a"/>'};
export const friendArt=id=>'<svg viewBox="0 0 48 44" width="48" height="44" aria-hidden="true">'+(ART[id]||ART.ladybug)+'</svg>';
export function mountGardenFriends({root,document:doc=globalThis.document,onHelp=()=>{},reducedMotion=()=>false,now=()=>performance.now()}){
 const layer=doc.createElement('div');layer.id='garden-friends';layer.className='garden-friends';layer.hidden=true;root.append(layer);
 const note=doc.createElement('p');note.className='garden-friends-note';note.setAttribute('role','status');layer.append(note);
 let bugs=[],paused=false,pausedAt=0,noteTimer=0;
 const say=text=>{note.textContent=text;note.classList.add('show');clearTimeout(noteTimer);noteTimer=setTimeout(()=>note.classList.remove('show'),2600);};
 function spawn(species,{stay=32000}={}){
  layer.hidden=false;const t=now();
  species.forEach((id,i)=>{
   const f=FRIENDS.find(f=>f.id===id)||FRIENDS[0],b=doc.createElement('button');b.type='button';b.className='garden-friend friend-'+f.id+' wander-'+(i%3);b.dataset.friend=f.id;
   b.setAttribute('aria-label','Help the '+f.name.toLowerCase()+' outside');b.innerHTML=friendArt(f.id)+'<i class="friend-leaf" aria-hidden="true"></i>';
   b.style.left=(14+((i*29+7)%70))+'%';b.style.top=(50+((i*17)%30))+'%';b.style.animationDelay=(-i*1.7)+'s';
   const bug={el:b,id:f.id,leaveAt:t+stay+i*1500,done:false};
   b.onclick=()=>{if(bug.done||paused)return;bug.done=true;b.classList.add('helped');b.disabled=true;const r=onHelp(f.id)||{};
    const pop=doc.createElement('span');pop.className='friend-pop';pop.textContent='+1 🪙';b.append(pop);
    say(r.first?'New garden friend: '+f.emoji+' '+f.name+'!':f.emoji+' Back to the garden. Thank you!');
    setTimeout(()=>{b.remove();bugs=bugs.filter(x=>x!==bug);tidy();},reducedMotion()?300:1500);};
   layer.append(b);bugs.push(bug);});
  say('🌼 Little garden friends wandered in. Tap them to help them home.');
 }
 function tidy(){if(!bugs.length&&!note.classList.contains('show'))layer.hidden=true;}
 function tick(){if(paused)return;const t=now();for(const bug of bugs)if(!bug.done&&t>=bug.leaveAt){bug.done=true;bug.el.classList.add('wandered');bug.el.disabled=true;setTimeout(()=>{bug.el.remove();bugs=bugs.filter(x=>x!==bug);tidy();},1200);}}
 function setPaused(value){value=!!value;if(value===paused)return;const t=now();if(value)pausedAt=t;else for(const bug of bugs)bug.leaveAt+=t-pausedAt;paused=value;layer.classList.toggle('paused',value);}
 function clear(){for(const bug of bugs)bug.el.remove();bugs=[];layer.hidden=true;}
 return {spawn,tick,setPaused,clear,layer,say:text=>{layer.hidden=false;say(text);},get count(){return bugs.filter(b=>!b.done).length;}};
}
