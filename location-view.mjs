import {LOCATIONS,locationOffer,locationOf} from './hotel-locations.mjs';
import {locationScene} from './location-scene.mjs';
export function renderLocations(host,{profile,slot,name,onConfirm,onCancel}){
 const doc=host.ownerDocument,el=(tag,text,cls)=>{const n=doc.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 host.replaceChildren();host.append(el('h2','Sell this location and move your hotel'),el('p',`Hotel ${slot+1} · ${name}`));
 const current=LOCATIONS.find(l=>l.id===locationOf(profile)?.id);host.append(el('p',`Current location: ${current?.name||'Needs attention'} · ${profile.bank} coins`));
 const list=el('div',null,'location-list'),detail=el('div',null,'location-detail');host.append(list,detail);
 const note=el('p','', 'location-status');note.setAttribute('role','status');host.append(note);
 for(const place of LOCATIONS){const button=el('button',null,'location-choice');button.type='button';button.disabled=current?.id===place.id;
  const preview=el('span',null,'location-preview');const scenery=locationScene(place.id);if(scenery){const picture=el('img',null,'location-setting-preview');picture.src='data:image/svg+xml,'+encodeURIComponent(scenery);picture.alt='';preview.append(picture);}else preview.append(el('span',null,'location-garden'));
  const facade=el('img',null,'location-facade-preview');facade.src='./assets/exterior/hotel-modern.webp';facade.alt='';preview.append(facade);
  button.append(preview,el('strong',place.name),el('span',`${place.price} coins`),el('small',place.description));list.append(button);
  button.onclick=()=>{const quote={...locationOffer(profile,place.id),slot};detail.replaceChildren(el('h3',`Move to ${place.name}?`),el('p',`${profile.bank} coins + ${quote.proceeds} land-sale proceeds − ${quote.cost} location price = ${quote.finalBalance} coins remaining.`),el('p','Sale proceeds cover the location only: 75% of its paid price. The original garden grant has no resale value.'),el('p','You keep every room, room layout and upgrade, staff, facilities, cuisines, rank, reviews, hotel sign and decoration. All decoration positions stay exactly the same. Only the landscape changes. Other hotel slots are untouched.'),el('p','This move is final. To return later, buy that location again. No faster arrivals or higher room prices.'));
   const confirm=el('button','Confirm sale & move','primary');confirm.type='button';confirm.disabled=!quote.ok;detail.append(confirm);if(!quote.ok)detail.append(el('p',quote.reason));
   confirm.onclick=async()=>{host.querySelectorAll('button').forEach(b=>b.disabled=true);note.textContent='Saving this hotel’s move…';const result=await onConfirm(quote);if(!result.ok){note.textContent=result.reason;if(result.recoveryRequired){const reload=el('button','Reload to verify');reload.onclick=()=>location.reload();note.append(reload);}else{host.querySelectorAll('button').forEach(b=>b.disabled=false);confirm.disabled=!quote.ok;}}};confirm.focus();
  };
 }
 const cancel=el('button','Cancel — keep this location','secondary');cancel.type='button';cancel.onclick=onCancel;host.append(cancel);cancel.focus();
}
