/** Independent door targets: no nested room buttons and no simulation commands.
 * The owner supplies a durable collector; celebration happens only after its ack. */
export function mountDoorCoins(parent,{onCollect,onInput=()=>{},canCollect=()=>true,onCollected=()=>{},reducedMotion=()=>false}={}){
 const doc=parent.ownerDocument,root=doc.createElement('section');root.id='door-coins';root.setAttribute('aria-label','Guest thank-you coins');
 const live=doc.createElement('span');live.className='coin-announcement';live.setAttribute('role','status');live.setAttribute('aria-live','polite');root.append(live);parent.append(root);
 const buttons=new Map(),timers=new Set(),win=doc.defaultView||globalThis;let busy=false,epoch=0;
 const stop=e=>{e.stopPropagation?.();};
 function ensure(roomId){
  if(buttons.has(roomId))return buttons.get(roomId);
  const button=doc.createElement('button');button.type='button';button.id='coins-'+roomId;button.className='door-coin';button.dataset.coinRoom=roomId;
  const coin=doc.createElement('span');coin.className='coin-stack';coin.setAttribute('aria-hidden','true');coin.textContent='✦';
  const amount=doc.createElement('b');amount.className='door-coin-amount';amount.setAttribute('aria-hidden','true');button.append(coin,amount);root.append(button);
  button.onpointerdown=e=>{stop(e);if(e.button!==undefined&&e.button!==0)return;onInput();};
  button.onpointerup=stop;button.onpointercancel=stop;
  button.onclick=async e=>{
   stop(e);e.preventDefault?.();if(busy||button.hidden||button.disabled||!canCollect())return;
   onInput();busy=true;for(const entry of buttons.values())entry.button.disabled=true;
   const token=epoch,origin={left:button.style.left,top:button.style.top},rect=button.getBoundingClientRect?.();
   try{
    const result=await onCollect(roomId);
    if(token!==epoch)return;
    if(result?.ok&&result.adopted!==false){
     live.textContent=`${result.amount} ${result.amount===1?'coin':'coins'} collected.`;
     const pop=doc.createElement('span');pop.className='coin-pop'+(reducedMotion()?' gentle':'');pop.textContent='+'+result.amount;pop.setAttribute('aria-hidden','true');Object.assign(pop.style,origin);root.append(pop);
     const timer=win.setTimeout(()=>{pop.remove();timers.delete(timer);},reducedMotion()?900:1000);timers.add(timer);
     onCollected(result,rect);
    }else if(!result?.ok)live.textContent='Could not confirm the collection save. Reload this hotel to check your coins before trying again.';
   }catch{if(token===epoch)live.textContent='Could not confirm the collection save. Reload this hotel to check your coins before trying again.';}
   finally{busy=false;}
  };
  const entry={button,amount};buttons.set(roomId,entry);return entry;
 }
 function sync(piles,{rooms,floor,point,visible=true,writable=true}={}){
  root.hidden=!visible;const shown=new Set();
  for(const pile of piles){const room=rooms.find(r=>r.id===pile.roomId);if(!room)continue;const entry=ensure(pile.roomId),p=point(room.x,room.y);shown.add(pile.roomId);
   entry.button.hidden=room.floor!==floor;entry.button.disabled=busy||!writable;entry.amount.textContent=String(pile.amount);
   entry.button.setAttribute('aria-label',`Collect ${pile.amount} coins at room ${pile.roomId.replace('room-','')}${pile.count>1?`, from ${pile.count} stays`:''}`);
   entry.button.style.left=p.x+'px';entry.button.style.top=(p.y+5)+'px';
  }
  for(const [id,entry]of buttons)if(!shown.has(id))entry.button.hidden=true;
 }
 function clear(){epoch++;live.textContent='';for(const timer of timers)win.clearTimeout(timer);timers.clear();for(const entry of buttons.values())entry.button.hidden=true;for(const child of [...root.children])if(child.className?.includes('coin-pop'))child.remove();}
 return {root,sync,clear,get busy(){return busy;},destroy(){clear();root.remove();}};
}
