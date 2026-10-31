/** Upper venue floors as cards on the Manager's desk. Venues live inside the hotel
 * (3F services, 4F entertainment); the painted wing art is reused as card pictures.
 * Read-only: never changes the profile. */
import {FACILITIES,LEISURE_VENUES} from './hotel-content.mjs';
import {ECONOMY_CONFIG as C} from './rush-economy.mjs';
const ART='./assets/exterior/painted/';
const PICTURE={restaurant:ART+'wing-restaurant.webp',spa:ART+'wing-spa.webp',lounge:ART+'wing-concert.webp',theater:ART+'wing-theater.webp'};
const EMOJI={restaurant:'🍜',salon:'💇',spa:'💆',lounge:'🎻',theater:'🎭'};
const LABEL={restaurant:'Restaurant',lounge:'Concert hall · Music lounge',spa:'Massage spa'};
export function upperFloorCards(profile={}){
 const f=profile.facilities||{},l=profile.leisure||{};
 const svc=FACILITIES.map(v=>({id:v.id,floor:v.floor,name:LABEL[v.id]||v.name,open:f[v.id]===1,price:C.facilityPrices[v.id],fromShift:C.facilityShifts[v.id]}));
 const fun=LEISURE_VENUES.map(v=>({id:v.id,floor:v.floor,name:LABEL[v.id]||v.name,open:l[v.id]===1,price:v.price,fromShift:v.requiredShifts}));
 return [...svc,...fun].map(c=>({...c,picture:PICTURE[c.id]||null,emoji:EMOJI[c.id],
  note:c.open?(c.floor===3?'Open on 3F · guests take the stairs up':'Open on 4F · the top floor'):`🔒 ${c.price} coins in the Shop · from shift ${c.fromShift}`}));
}
export function renderUpperFloors(body,profile){
 const doc=body.ownerDocument,el=(t,c,txt)=>{const e=doc.createElement(t);if(c)e.className=c;if(txt!=null)e.textContent=txt;return e;};
 const cards=upperFloorCards(profile),open=cards.filter(c=>c.open).length;
 body.append(el('h3','desk-h','Upper floors'));
 body.append(el('p','desk-floor-intro',open?`${open} of ${cards.length} venues open inside the inn. Each new floor makes the hotel taller outside.`:'Restaurants, the spa, the concert hall and the theater open on the floors above the guest rooms.'));
 const list=el('ul','desk-floors');list.id='desk-floors';
 for(const c of cards){const li=el('li','desk-floor'+(c.open?' open':' locked'));li.dataset.venue=c.id;
  const pic=el('div','desk-floor-pic');if(c.picture){const im=doc.createElement('img');im.src=c.picture;im.alt='';im.loading='lazy';pic.append(im);}else pic.textContent=c.emoji;
  li.append(pic,el('b',null,`${c.floor}F · ${c.name}`),el('small',null,c.note));list.append(li);}
 body.append(list);
}
