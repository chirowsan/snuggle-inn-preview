import {contentIcon} from './variety-view.mjs';
import {BUILD_TYPES,ORIGINAL_SLOTS,slotName,constructionOffer} from './hotel-construction.mjs';
/** Same painted wing and same room coordinates as the live guest floor, not room-photo tiles. */
export function paintBuildFloor(canvas,wing){
 canvas.width=1200;canvas.height=700;const c=canvas.getContext('2d');
 c.fillStyle='#315a46';c.fillRect(0,0,1200,700);if(!wing)return;
 c.drawImage(wing,0,wing.height*.44,wing.width,wing.height*.56,0,0,1200,700);
 c.drawImage(wing,0,0,wing.width*.5,wing.height,50,0,900,700);
 c.drawImage(wing,0,0,wing.width*.0278,wing.height,0,0,50,700);
}
export function plannerMarkup(profile,choice){
 const slots=profile.construction?.slots||ORIGINAL_SLOTS,occupied=slots.slice(0,profile.openRooms),offer=constructionOffer(profile,choice.slot,choice.tier),floor=profile.openRooms<3?1:2,bays=floor===1?[0,1,2]:[3,4,5],simple=profile.firstSteps&&profile.openRooms<3;
 return `<header><h2 id="build-title">${floor===1?'A room for a new friend':profile.openRooms===3?'Open guest floor 2':'Build a room'}</h2><small>${floor===1?'🛏️ Pick a spot and a room':'🏨 2 floors · up to 6 rooms'}</small></header>
 <nav class="build-floors" aria-label="Guest floor availability"><button ${floor===1?'aria-current="true"':'disabled'}>1F · ${floor===1?3-profile.openRooms+' free spots':'Full'}</button><button ${floor===2?'aria-current="true"':'disabled'}>2F · ${floor===1?'Finish 1F first':6-profile.openRooms+' free spots'}</button></nav>
 <div class="build-floor"><canvas aria-hidden="true"></canvas>${bays.map(slot=>{const index=slots.indexOf(slot),built=occupied.includes(slot);return `<button class="build-bay ${choice.slot===slot?'chosen':''}" style="left:${[20,44.1667,68.3333][slot%3]}%" data-build-slot="${slot}" ${built?'disabled':''} aria-pressed="${choice.slot===slot}" aria-label="Floor ${floor} ${slotName(slot)} bay${built?', Room '+(index+1)+' already built':', available'}"><b>${built?'Room '+(index+1):choice.slot===slot?'✓':'+'}</b><span>${slotName(slot)}</span></button>`;}).join('')}</div>
 <div class="build-types" aria-label="Room type">${(simple?BUILD_TYPES.slice(0,1):BUILD_TYPES).map(t=>`<button data-build-tier="${t.tier}" aria-pressed="${choice.tier===t.tier}"><strong>${contentIcon(['bed','luxury','family'][t.tier])}${t.name}</strong><small>${t.tier===2?'👪 2 guests':t.tier===1?'🐱 Cat favorite':'🛏️ 1 guest'}</small></button>`).join('')}</div>
 <div class="build-quote"><strong>${slotName(choice.slot)} · ${BUILD_TYPES[choice.tier].name}</strong><span>🪙 ${offer.price} · ⏱ ${offer.duration}s</span><small>🔨 Builds while you play</small></div>
 <p class="build-error" role="status">${offer.reason||''}</p>
 <footer><button class="secondary" data-build-cancel>Back</button><button class="primary" data-build-confirm ${offer.ok?'':'disabled'}>Build · ${offer.price}</button></footer>`;
}
/** Draw only cosmetics; room remains engine-locked until the persisted project finishes. */
export function drawConstruction(renderer,project,state){
 if(!project)return;const room=state.rooms[project.roomIndex];if(!room||renderer.floor!==room.floor)return;
 const c=renderer.ctx,p=renderer.point(room.x,room.y),sx=renderer.sx,sy=renderer.sy;
 c.save();c.translate(p.x,p.y);c.scale(sx,sy);
 c.fillStyle='#2a4b40d9';c.fillRect(-104,-205,208,240);
 c.strokeStyle='#c3bca0';c.lineWidth=7;
 for(const x of [-105,105]){c.beginPath();c.moveTo(x,-220);c.lineTo(x,75);c.stroke();}
 for(const y of [-200,-90,35]){c.beginPath();c.moveTo(-114,y);c.lineTo(114,y);c.stroke();}
 c.lineWidth=3;c.beginPath();c.moveTo(-105,-200);c.lineTo(105,35);c.moveTo(105,-200);c.lineTo(-105,35);c.stroke();
 c.fillStyle='#b68b54';c.fillRect(-118,-96,236,12);c.fillRect(-118,30,236,12);
 c.fillStyle='#e4bb67';c.fillRect(-100,70,200,33);c.fillStyle='#355342';c.font='bold 19px Arial';c.textAlign='center';c.fillText('BUILDING',0,94);
 c.fillStyle='#294737';c.fillRect(-100,110,200,9);c.fillStyle='#e5ce8b';c.fillRect(-100,110,200*(1-project.remaining/project.duration),9);
 c.restore();
 const frame=renderer.characters.actions['mechanic-work'];
 if(frame)renderer.spriteAt(frame.file,room.x+65,room.y+65,150,150,(frame.foot_anchor||[256,356]).map(v=>v/384));
}
