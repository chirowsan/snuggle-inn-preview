import {defaultRoomLayout,roomShells,ROOM_SHELL,ROOM_FINISHES,ROOM_FLOORS} from './hotel-room-layout.mjs';
import {validRoomDoorXs} from './hotel-room-doors.mjs';
export const ROOM_FURNISHINGS='assets/interior/furnishings-v1.png';
const FRAMES={bed:[30,4,687,616],desk:[826,112,321,502],window:[91,625,542,605],plant:[694,691,558,515]};
function shade(c,x,y,w,h,stops){const g=c.createLinearGradient(x,y,x+w,y+h);if(!g?.addColorStop)return stops[0][1];for(const [n,color]of stops)g.addColorStop(n,color);return g;}
function line(c,x,y,x2,y2,color,width=1){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();}
function sprite(c,im,kind,r,aspectY=1){if(!im)return false;const frame=FRAMES[kind],ratio=frame[2]/frame[3],w=Math.min(r.w,r.h*aspectY*ratio),h=w/ratio/aspectY;c.drawImage(im,...frame,r.x+(r.w-w)/2,r.y+r.h-h,w,h);return true;}
function planks(c,s,floor,images){
 c.fillStyle=floor.base;c.fillRect(s.x,s.y,s.w,s.h);
 const wood=images['assets/guests-v08/room-luxury.webp'];
 if(wood){c.save();c.globalAlpha=s.floor==='walnut'?.34:.2;c.drawImage(wood,31,390,185,23,s.x,s.y+84,s.w,s.h-84);c.restore();}
 const tile=s.floor==='tile';
 for(let y=s.y+84,row=0;y<250;y+=tile?32:23,row++){
  c.fillStyle=shade(c,s.x,y,0,tile?32:23,[[0,'#fff2ce20'],[.22,'#ffffff00'],[1,'#30170c23']]);c.fillRect(s.x,y,s.w,tile?32:23);
  line(c,s.x,y,s.x+s.w,y,floor.line,.8);
  for(let x=s.x+(row%2?37:0);x<s.x+s.w;x+=tile?48:92)line(c,x,y,x,y+(tile?32:23),'#51352032',.7);
 }
 c.fillStyle=shade(c,s.x,s.y+84,0,s.h-84,[[0,'#2c211f70'],[.45,'#271d0b08'],[1,'#efcb6c16']]);c.fillRect(s.x,s.y+84,s.w,s.h-84);
}
function plaster(c,s,palette,images){
 c.fillStyle=shade(c,s.x,s.y,s.w,85,[[0,palette.trim],[.12,palette.wall],[.62,palette.wall],[1,palette.trim]]);c.fillRect(s.x,s.y,s.w,85);
 const stone=images['assets/rush-wing.webp'];if(stone){c.save();c.globalAlpha=.2;c.drawImage(stone,280,37,35,150,s.x,s.y,s.w,85);c.restore();}
 // Soft mottled plaster, fine wainscot panels and brass picture rail, not flat stripes.
 for(let i=0;i<18;i++){const x=s.x+((i*47+13)%Math.max(1,s.w-15));c.fillStyle=i%2?'#fff0c208':'#17271c09';c.beginPath();c.ellipse(x,s.y+14+(i*17)%42,13+(i%3)*9,4+(i%4)*3,0,0,Math.PI*2);c.fill();}
 c.fillStyle='#314e3c';c.fillRect(s.x+5,s.y+68,s.w-10,16);
 for(let x=s.x+14;x<s.x+s.w-12;x+=46){c.strokeStyle='#8b9a623e';c.lineWidth=1;c.strokeRect(x,s.y+72,35,10);}
 line(c,s.x+4,s.y+68,s.x+s.w-4,s.y+68,'#d7b675',2);
 line(c,s.x+4,s.y+84,s.x+s.w-4,s.y+84,'#2c241c',3);
 line(c,s.x+4,s.y+5,s.x+s.w-4,s.y+5,'#ecd59b',3);
}
function walls(c,s,palette){
 // Thick shared walls: lit top edge, plaster face, inner ambient-occlusion edge.
 c.fillStyle='#876844';c.fillRect(s.x-4,s.y-4,s.w+8,8);
 c.fillStyle='#e6cc98';c.fillRect(s.x-4,s.y-4,s.w+8,3);
 for(const x of [s.x-4,s.x+s.w-4]){c.fillStyle=shade(c,x,s.y,8,0,[[0,'#69533b'],[.4,'#e3c88c'],[1,palette.trim]]);c.fillRect(x,s.y,8,250-s.y);line(c,x+8,s.y+7,x+8,250,'#34231538',3);}
 for(const [x,w]of [[s.x,s.door-30-s.x],[s.door+30,s.x+s.w-s.door-30]]){c.fillStyle='#7a603c';c.fillRect(x,246,w,10);c.fillStyle='#e9d2a1';c.fillRect(x,244,w,4);line(c,x,256,x+w,256,'#2b251e42',3);}
 c.fillStyle=shade(c,s.door-30,245,0,9,[[0,'#e9d5a0'],[1,'#aa8852']]);c.fillRect(s.door-30,246,60,8);
 for(const x of [s.door-31,s.door+27]){c.fillStyle='#b7955b';c.fillRect(x,240,4,16);c.fillStyle='#edd69a';c.fillRect(x,240,2,15);}
}
/** Saved shells/style are visual; gameplay thresholds come from the issued stay.
 * The editor intentionally previews proposed thresholds instead. Neither path
 * rewrites the saved plan or changes an actor/coin interaction coordinate. */
export function paintRoomLayout(c,layout,{rooms=[],selected=-1,plan=false,images={},aspectY=1,serviceDoorXs}={}){
 let shells=roomShells(layout);if(!shells)return false;
 if(!plan&&validRoomDoorXs(serviceDoorXs))shells=shells.map(s=>({...s,door:serviceDoorXs[s.bay]}));
 const art=images[ROOM_FURNISHINGS],wing=images['assets/rush-wing.webp'];
 c.save();c.fillStyle='#8e7957';c.fillRect(50,0,900,280);
 if(wing)c.drawImage(wing,0,290,1024,95,50,250,900,70);else{c.fillStyle='#d9c49b';c.fillRect(50,250,900,70);}
 // Quiet roof/wall backing conceals the old baked door painting without touching the service apron.
 c.fillStyle=shade(c,50,0,0,250,[[0,'#3d4b32'],[.15,'#9c865e'],[1,'#c9ac76']]);c.fillRect(50,0,900,250);
 if(wing){c.save();c.globalAlpha=.22;c.drawImage(wing,270,0,50,280,50,0,900,250);c.restore();}
 for(const s of shells){
  const live=rooms.find(r=>Math.abs(r.x-s.door)<1),built=live?live.status!=='locked':rooms.length===0,palette=ROOM_FINISHES[s.finish],floor=ROOM_FLOORS[s.floor];
  c.save();c.beginPath();c.rect(s.x,s.y,s.w,s.h);c.clip();planks(c,s,floor,images);plaster(c,s,palette,images);
  if(built){
   for(let i=0;i<s.windows;i++){const w=Math.min(55,(s.w-48)/s.windows),wx=s.x+s.w*(i+1)/(s.windows+1)-w/2;
    if(!sprite(c,art,'window',{x:wx,y:s.y+6,w,h:76},aspectY)){c.fillStyle='#e9d59e';c.fillRect(wx,s.y+7,w,45);c.fillStyle='#d4e2c8';c.fillRect(wx+4,s.y+11,w-8,37);}
    c.fillStyle=shade(c,wx,s.y+83,45,110,[[0,'#fff4bc30'],[1,'#fff4bc00']]);c.beginPath();c.moveTo(wx,s.y+84);c.lineTo(wx+w,s.y+84);c.lineTo(wx+w+28,218);c.lineTo(wx+9,218);c.closePath();c.fill();
   }
   // Woven bedside rug lies under movable furniture, never in the protected service apron.
   const bed=s.furniture[0],desk=s.furniture[1],plant=s.furniture[2];
   c.fillStyle='#9f7542';c.fillRect(bed.x-6,bed.y+bed.h-23,bed.w+12,27);c.strokeStyle='#dcc48b';c.lineWidth=2;c.strokeRect(bed.x-3,bed.y+bed.h-20,bed.w+6,21);c.fillStyle='#54755b';c.fillRect(bed.x+1,bed.y+bed.h-17,bed.w-2,15);
   for(let x=bed.x-3;x<bed.x+bed.w+4;x+=5)line(c,x,bed.y+bed.h+4,x+1,bed.y+bed.h+6,'#d5b783',.8);
   for(const f of [bed,desk,plant]){c.fillStyle='#20160c25';c.beginPath();c.ellipse(f.x+f.w/2,f.y+f.h-1,f.w*.48,4,0,0,Math.PI*2);c.fill();}
   if(!sprite(c,art,'bed',bed,aspectY)){c.fillStyle=palette.trim;c.fillRect(bed.x,bed.y,bed.w,bed.h);c.fillStyle='#f3e4c5';c.fillRect(bed.x+5,bed.y+10,bed.w-10,bed.h-14);}
   if(!sprite(c,art,'desk',desk,aspectY)){c.fillStyle='#aa7d48';c.fillRect(desk.x,desk.y,desk.w,desk.h);}
   if(!sprite(c,art,'plant',plant,aspectY)){c.fillStyle='#42674b';c.beginPath();c.ellipse(plant.x+plant.w/2,plant.y+plant.h/2,plant.w/2,plant.h/2,0,0,Math.PI*2);c.fill();}
   // Lamp bloom stays behind the sprite, gently warming the wall, not a screen-space glare.
  }else{
   c.fillStyle=shade(c,s.x,s.y,s.w,s.h,[[0,'#927044'],[.3,'#d7b982'],[.72,'#c3a170'],[1,'#85613c']]);c.fillRect(s.x,s.y,s.w,s.h);if(wing){const w=s.h*aspectY*190/268;c.drawImage(wing,106,22,190,268,s.door-w/2,s.y,w,s.h);}c.fillStyle='#193a2438';c.fillRect(s.x,s.y,s.w,s.h);if(plan){c.fillStyle='#f8e4a9';c.font='13px Georgia';c.textAlign='center';c.fillText('Unbuilt room',s.x+s.w/2,235);}
  }
  c.restore();walls(c,s,palette);
  if(plan){c.fillStyle='#315644';c.textAlign='center';c.font='bold 15px Arial';c.fillText(live?live.id.replace('room-','Room '):['Left bay','Middle bay','Right bay'][s.bay],s.x+s.w/2,288);c.font='12px Arial';c.fillText(`${s.w/10} × ${s.h/10} tiles`,s.x+s.w/2,307);}
  if(selected===s.bay){c.strokeStyle='#f4cb65';c.lineWidth=3;c.strokeRect(s.x+7,s.y+7,s.w-14,s.h-14);}
 }
 if(plan){c.fillStyle='#4b6554';c.font='14px Arial';c.textAlign='center';c.fillText('Doors apply next stay · keep the service corridor clear',510,343);}
 c.restore();return true;
}
export function drawEditableRoomFloor(renderer,state){
 if(renderer.floor!==1)return false;
 // Physical bay order is fixed by the issued config. Current profile room IDs
 // may have swapped slots for construction after this checkpoint settled.
 const issued=state?.config?.roomDoorXs,serviceDoorXs=validRoomDoorXs(issued)?issued:ROOM_SHELL.doors;
 // The classic service view already has its closed painted hallway facade.
 // Saved interior previews must not erase those walls or expose beds. Keep
 // dimensions/finishes in the editor and all save data; only skip this overlay.
 if(serviceDoorXs.every((x,bay)=>x===ROOM_SHELL.doors[bay]))return false;
 let layout=renderer.roomLayout;
 if(!roomShells(layout)){
  // Preserve the exact original painted floor for legacy/default thresholds.
  // A moved issued threshold still needs a coherent wall/door fallback even
  // when its optional saved layout is absent or from an unsupported version.
  // This default is drawing-only: never adopt it over the raw saved value.
  if(serviceDoorXs.every((x,bay)=>x===ROOM_SHELL.doors[bay]))return false;
  layout=defaultRoomLayout();
 }
 const c=renderer.ctx;c.save();c.translate(0,renderer.top);c.scale(renderer.sx,renderer.sy);
 paintRoomLayout(c,layout,{rooms:(state?.rooms||[]).filter(r=>r.floor===1),images:renderer.images,aspectY:renderer.sy/renderer.sx,serviceDoorXs});
 c.restore();return true;
}
