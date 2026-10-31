/** Door receipts are earned by guests, but cash is spendable only after a tap.
 * Pure bounded ledger: room status, cleaning and staff never own or consume it.
 * Historical receipts aggregate by room; current receipts retain guest identity.
 */
const own=(o,k)=>o&&typeof o==='object'?Object.getOwnPropertyDescriptor(o,k)?.value:undefined;
const record=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>record(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const roomId=id=>typeof id==='string'&&/^room-[1-6]$/.test(id);
const total=xs=>xs.reduce((n,x)=>n+BigInt(x),0n);
const MAX=BigInt(Number.MAX_SAFE_INTEGER);
export const hasCoinPickups=s=>s?.config?.coinPickupRules===1;
export const freshDoorCoins=()=>({version:1,rooms:[]});
export function validDoorCoins(v,openRooms=6){
 try{
  if(!exact(v,['version','rooms'])||own(v,'version')!==1||!Array.isArray(v.rooms)||v.rooms.length>6)return false;
  const ids=new Set();let amount=0n,stays=0n;
  for(const r of v.rooms){if(!exact(r,['roomId','amount','stays'])||!roomId(r.roomId)||+r.roomId.slice(5)>openRooms||ids.has(r.roomId)||!integer(r.amount)||!r.amount||!integer(r.stays)||!r.stays)return false;ids.add(r.roomId);amount+=BigInt(r.amount);stays+=BigInt(r.stays);}
  return amount<=MAX&&stays<=MAX;
 }catch{return false;}
}
export const copyDoorCoins=v=>validDoorCoins(v)?JSON.parse(JSON.stringify(v)):null;
export function coinCash(s){
 if(!hasCoinPickups(s))return {held:0,carried:0};
 const ledger=s.coinPickups;
 return {held:Number(total(s.guests.filter(g=>g.paid&&!ledger.collectedGuests.includes(g.id)).map(g=>g.payment))),
  carried:Number(total(s.config.pickupCarry.rooms.filter(r=>ledger.collectedCarry.includes(r.roomId)).map(r=>r.amount)))};
}
export const validCoinCash=v=>exact(v,['held','carried'])&&integer(v.held)&&integer(v.carried);
export const coinCashDelta=s=>{const c=coinCash(s);return BigInt(c.carried)-BigInt(c.held);};
export function coinPiles(s){
 if(!hasCoinPickups(s))return [];
 const piles=new Map(),add=(id,amount,count)=>{const p=piles.get(id)||{roomId:id,amount:0,count:0};p.amount+=amount;p.count+=count;piles.set(id,p);};
 for(const r of s.config.pickupCarry.rooms)if(!s.coinPickups.collectedCarry.includes(r.roomId))add(r.roomId,r.amount,r.stays);
 for(const g of s.guests)if(g.paid&&g.departed&&!s.coinPickups.collectedGuests.includes(g.id))add(g.roomId,g.payment,1);
 return [...piles.values()].sort((a,b)=>a.roomId.localeCompare(b.roomId));
}
export const pendingCoinTotal=s=>coinPiles(s).reduce((n,p)=>n+p.amount,0);
export const pendingDoorCoins=s=>({version:1,rooms:coinPiles(s).map(p=>({roomId:p.roomId,amount:p.amount,stays:p.count}))});
export function canBookDoorReceipt(s,amount=0,stays=0){
 if(!hasCoinPickups(s))return true;
 const carry=s.config.pickupCarry.rooms.filter(r=>!s.coinPickups.collectedCarry.includes(r.roomId));
 const guests=s.guests.filter(g=>g.paid&&!s.coinPickups.collectedGuests.includes(g.id));
 return total(carry.map(r=>r.amount))+total(guests.map(g=>g.payment))+BigInt(amount)<=MAX&&
  total(carry.map(r=>r.stays))+BigInt(guests.length)+BigInt(stays)<=MAX;
}
export function validCoinState(s){
 try{
  if(!hasCoinPickups(s))return !Object.hasOwn(s.config,'coinPickupRules')&&!Object.hasOwn(s.config,'pickupCarry')&&!Object.hasOwn(s,'coinPickups')&&!Object.hasOwn(s.result||{},'coinCash');
  if(s.version!==7||!validDoorCoins(s.config.pickupCarry,s.openRooms)||!exact(s.coinPickups,['version','collectedGuests','collectedCarry'])||s.coinPickups.version!==1)return false;
  const l=s.coinPickups;
  if(!Array.isArray(l.collectedGuests)||l.collectedGuests.length>s.guests.length||new Set(l.collectedGuests).size!==l.collectedGuests.length||l.collectedGuests.some(id=>!s.guests.some(g=>g.id===id&&g.paid&&g.departed)))return false;
  if(!Array.isArray(l.collectedCarry)||l.collectedCarry.length>6||new Set(l.collectedCarry).size!==l.collectedCarry.length||l.collectedCarry.some(id=>!s.config.pickupCarry.rooms.some(r=>r.roomId===id)))return false;
  const cash=coinCash(s);if(!validCoinCash(cash)||!validDoorCoins(pendingDoorCoins(s),s.openRooms)||!canBookDoorReceipt(s))return false;
  // Ending a shift cannot discard an earned guest still walking to the exit.
  if(['won','lost'].includes(s.status)&&s.guests.some(g=>g.paid&&!g.departed))return false;
  return !s.result||validCoinCash(s.result.coinCash)&&s.result.coinCash.held===cash.held&&s.result.coinCash.carried===cash.carried;
 }catch{return false;}
}
/** Mutates a previously validated candidate only; storage owner commits atomically. */
export function collectDoorCoins(s,id){
 if(!validCoinState(s)||!hasCoinPickups(s))return {ok:false,code:'no-coins'};
 const pile=coinPiles(s).find(p=>p.roomId===id);if(!pile)return {ok:false,code:'no-coins'};
 if(!Number.isSafeInteger(s.money+pile.amount))return {ok:false,code:'balance-limit'};
 if(s.config.pickupCarry.rooms.some(r=>r.roomId===id)&&!s.coinPickups.collectedCarry.includes(id))s.coinPickups.collectedCarry.push(id);
 for(const g of s.guests)if(g.roomId===id&&g.paid&&g.departed&&!s.coinPickups.collectedGuests.includes(g.id))s.coinPickups.collectedGuests.push(g.id);
 s.money+=pile.amount;
 if(s.result){s.result.money=s.money;s.result.coinCash=coinCash(s);}
 return {ok:true,amount:pile.amount,roomId:id,count:pile.count};
}
