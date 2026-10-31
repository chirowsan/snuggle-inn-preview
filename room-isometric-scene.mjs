import {roomFurnitureFootprint} from './hotel-room-furnishings.mjs';
import {FURNITURE_TURN_ART} from './room-furniture-art.mjs';
import {roomShells,defaultRoomLayout,ROOM_FINISHES,ROOM_FLOORS} from './hotel-room-layout.mjs';
import {projectRoomPoint,fitRoomCamera,roomGroundPolygon,hitRoomGround} from './room-isometric-projection.mjs';
export const ISO_FURNITURE_ASSET='assets/interior/isometric/furniture-atlas-v1.png';
export const ISO_FRAMES=Object.freeze({bed:[55,0,575,525],armchair:[642,55,390,455],dresser:[1110,0,365,530],plant:[25,540,480,430],'lamp-cabinet':[640,510,345,480],window:[1080,495,430,529]});
function polygon(c,points,fill,stroke,lineWidth=1){c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=lineWidth;c.stroke();}}
function line(c,a,b,color,w=1){c.strokeStyle=color;c.lineWidth=w;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();}
function ground(c,rect,camera,fill,stroke){polygon(c,roomGroundPolygon(rect,camera),fill,stroke);}
function surface(c,rect,camera,paint){c.save();c.transform(.8660254038*camera.scale,.5*camera.scale,-.8660254038*camera.scale,.5*camera.scale,camera.x,camera.y);c.beginPath();c.rect(rect.x,rect.y,rect.w,rect.h);c.clip();paint(c);c.restore();}
function wall(c,a,b,height,camera,{base='#d3bf95',trim='#345b4d',cap='#f1ddb1',low=false}={}){
 const points=[{...a,z:0},{...b,z:0},{...b,z:height},{...a,z:height}].map(p=>projectRoomPoint(p,camera));
 const g=c.createLinearGradient(points[3].x,points[3].y,points[0].x,points[0].y);g.addColorStop(0,base);g.addColorStop(.65,base);g.addColorStop(1,trim);polygon(c,points,g,'#725738',.6);
 const band=low?height*.45:24,dp=[{...a,z:0},{...b,z:0},{...b,z:band},{...a,z:band}].map(p=>projectRoomPoint(p,camera));polygon(c,dp,trim);
 const len=Math.hypot(b.x-a.x,b.y-a.y),count=Math.floor(len/32);for(let i=1;i<count;i++){const t=i/count,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};line(c,projectRoomPoint({...p,z:4},camera),projectRoomPoint({...p,z:band-3},camera),'#c4b47744',.65);}
 line(c,projectRoomPoint({...a,z:band},camera),projectRoomPoint({...b,z:band},camera),'#d2ad68',1.6*camera.scale);
 const offset={x:3,y:-3};polygon(c,[{...a,z:height},{...b,z:height},{x:b.x+offset.x,y:b.y+offset.y,z:height},{x:a.x+offset.x,y:a.y+offset.y,z:height}].map(p=>projectRoomPoint(p,camera)),cap,'#96794c',.5);
 line(c,points[0],points[1],'#302a2055',3*camera.scale);
}
function floor(c,s,camera,images){const f=ROOM_FLOORS[s.floor];surface(c,s,camera,ctx=>{
 ctx.fillStyle=f.base;ctx.fillRect(s.x,s.y,s.w,s.h);const wood=images['assets/guests-v08/room-luxury.webp'];if(wood){ctx.globalAlpha=s.floor==='walnut'?.44:.25;ctx.drawImage(wood,30,390,185,23,s.x,s.y,s.w,s.h);ctx.globalAlpha=1;}
 const tile=s.floor==='tile',rowHeight=tile?25:15;for(let y=s.y,row=0;y<s.y+s.h;y+=rowHeight,row++){ctx.fillStyle=row%2?'#ffeac112':'#3219080c';ctx.fillRect(s.x,y,s.w,rowHeight);ctx.strokeStyle=tile?'#b3a37d':'#76502b50';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(s.x,y);ctx.lineTo(s.x+s.w,y);ctx.stroke();for(let x=s.x+(row%2?30:0);x<s.x+s.w;x+=tile?25:65){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+rowHeight);ctx.stroke();}if(!tile){ctx.strokeStyle='#fff5cb20';ctx.beginPath();ctx.moveTo(s.x+8,y+5);ctx.bezierCurveTo(s.x+45,y+2,s.x+s.w-45,y+9,s.x+s.w-8,y+6);ctx.stroke();}}
 const g=ctx.createLinearGradient(s.x,s.y,s.x+s.w,s.y+s.h);g.addColorStop(0,'#19342525');g.addColorStop(.4,'#ffe6a518');g.addColorStop(1,'#241c0a16');ctx.fillStyle=g;ctx.fillRect(s.x,s.y,s.w,s.h);
 });}
function rug(c,item,size,camera){surface(c,{x:item.x,y:item.y,w:size.w,h:size.h},camera,ctx=>{ctx.fillStyle='#c9a467';ctx.fillRect(item.x,item.y,size.w,size.h);ctx.fillStyle=['#476c64','#3d6851','#8d263d'][item.tier||0];ctx.fillRect(item.x+3,item.y+3,size.w-6,size.h-6);ctx.strokeStyle='#d8ba7f';ctx.lineWidth=1;ctx.strokeRect(item.x+7,item.y+7,size.w-14,size.h-14);ctx.fillStyle='#bda26b';for(let y=item.y+14;y<item.y+size.h-8;y+=12)for(let x=item.x+14;x<item.x+size.w-8;x+=12){ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.fillRect(-2,-2,4,4);ctx.restore();}});}
export function furnishingArt(item){
 const turn=(item.rotation||0)/90,tier=item.tier||0;let file,index;
 if(tier&&item.kind==='armchair'){file=turn>=2?'premium-chair-backs-v2.png':'premium-chair-fronts-v2.png';index=(tier-1)*2+turn%2;}
 else if(tier&&item.kind==='bed'){file='premium-beds-v2.png';index=(tier-1)*4+turn;}
 // Promoting ownership/rotation metadata must not silently restyle every
 // other classic piece. Its zero-turn appearance remains the v25 original.
 else if(turn&&['bed','armchair','dresser'].includes(item.kind)){file='furniture-turns-v2.png';index=['bed','armchair','dresser'].indexOf(item.kind)*4+turn;}
 else if(turn&&item.kind==='lamp-cabinet'){file='lamp-turns-v2.png';index=turn;}
 return file?{path:'assets/interior/isometric/'+file,frame:FURNITURE_TURN_ART[file].frames[index]}:{path:ISO_FURNITURE_ASSET,frame:ISO_FRAMES[item.kind]};
}
function sprite(c,item,size,camera,images){const art=furnishingArt(item),frame=art.frame,image=images[art.path];if(!frame||!image)return null;const p=projectRoomPoint({x:item.x+size.w/2,y:item.y+size.h/2},camera),span=(size.w+size.h)*.8660254038*camera.scale;
 // Leaf canopies can rise in front of another piece, but must not masquerade
 // as a chair-sized solid object on the plant's small, validated footprint.
 const multiplier={bed:1.06,armchair:1.05,dresser:1.12,plant:1.15,'lamp-cabinet':1.25}[item.kind]||1,w=span*multiplier,h=w*frame[3]/frame[2],bottom=p.y+(size.w+size.h)*.5*camera.scale*.34;
 c.drawImage(image,...frame,p.x-w/2,bottom-h,w,h);return {x:p.x-w/2,y:bottom-h,w,h};}
/** Pure display scene. Canonical room IDs/ownership and saved furniture remain authoritative.
 * No actors are invented: this is paused decoration/inspection, not a gameplay simulation. */
export function drawIsometricRoomScene(c,{width,height,layout,rooms=[],furnishings,catalog,images={},selectedRoomId,selectedItemId,overview=false,preview=null,service=false,serviceDoorXs=null,camera:customCamera=null}){
 const shells=roomShells(layout||defaultRoomLayout()).map(s=>({...s,door:serviceDoorXs?.[s.bay]??s.door})),rear=Math.min(10,...shells.map(s=>s.y-10)),selected=rooms.find(r=>r.id===selectedRoomId)||rooms.find(r=>r.status==='built'||r.status==='available')||rooms[0],focus=shells[selected?.bay||0];
 const bounds=overview?{x:55,y:rear,w:1055,h:345-rear,wallHeight:112}:{x:focus.x-12,y:focus.y-10,w:focus.w+24,h:335-focus.y,wallHeight:112};const camera=customCamera||fitRoomCamera(bounds,width,height,overview?22:12);
 c.clearRect(0,0,width,height);const bg=c.createLinearGradient(0,0,width,height);bg.addColorStop(0,'#eadfc5');bg.addColorStop(.5,'#d7cfb6');bg.addColorStop(1,'#bac5ad');c.fillStyle=bg;c.fillRect(0,0,width,height);
 const stage=service&&overview?{x:55,y:rear,w:1115,h:650-rear}:overview?{x:55,y:rear,w:1055,h:345-rear}:{x:focus.x,y:focus.y,w:focus.w,h:330-focus.y},hall={x:service?55:stage.x,y:250,w:service?1115:stage.w,h:service?400:stage.y+stage.h-250};
 c.save();c.shadowColor='#304b3e40';c.shadowBlur=20;c.shadowOffsetY=10;ground(c,stage,camera,'#a38862');c.restore();
 floor(c,{...hall,floor:'walnut'},camera,images);ground(c,hall,camera,null,'#76522e');surface(c,hall,camera,ctx=>{ctx.fillStyle='#d5b985';ctx.fillRect(55,260,1055,3);ctx.fillRect(55,335,1055,3);ctx.fillStyle='#ba9566';ctx.fillRect(55,280,1055,35);ctx.strokeStyle='#dec28e';ctx.lineWidth=1;ctx.strokeRect(58,283,1049,29);for(let x=60;x<1110;x+=45){ctx.fillStyle='#392a1614';ctx.fillRect(x,250,1,95);}});
 const hitItems=[],drawItems=[];
 for(const s of shells){const live=rooms.find(r=>r.bay===s.bay),built=live&&['built','available','occupied','dirty','checking-in','cleaning'].includes(live.status),dim=!overview&&live?.id!==selected?.id;if(dim)continue;c.save();if(dim)c.globalAlpha=.22;floor(c,s,camera,images);const palette=ROOM_FINISHES[s.finish];wall(c,{x:s.x,y:s.y},{x:s.x+s.w,y:s.y},105,camera,{base:palette.wall,trim:palette.trim});
 if(built){for(let i=0;i<s.windows;i++){const im=images['assets/interior/furnishings-v1.png'],wx=s.x+s.w*(i+1)/(s.windows+1)-32.5,p=projectRoomPoint({x:wx,y:s.y,z:105},camera);if(im){c.save();c.transform(.8660254038*camera.scale,.5*camera.scale,0,camera.scale,p.x,p.y);c.drawImage(im,91,625,542,605,0,0,65,75);c.restore();}}
 const items=furnishings?.rooms?.[live.id]?.items||[];for(const item of items){const value=preview?.roomId===live.id&&preview.item.id===item.id?preview.item:item,size=roomFurnitureFootprint(value);if(!size)continue;if(value.kind==='rug'){rug(c,value,size,camera);if(!dim)hitItems.push({item:value,size,roomId:live.id,groundOnly:true,rect:{x:value.x,y:value.y,w:size.w,h:size.h}});}else drawItems.push({item:value,size,roomId:live.id,dim,depth:value.x+value.y+size.w/2+size.h/2});}}
 else{ground(c,{x:s.x+10,y:s.y+10,w:s.w-20,h:s.h-20},camera,'#40574b99');const p=projectRoomPoint({x:s.x+s.w/2,y:s.y+s.h/2,z:2},camera);c.fillStyle='#f9e8bd';c.font=`600 ${Math.max(10,13*camera.scale)}px system-ui`;c.textAlign='center';c.fillText(live?.status==='building'?`Building · ${Math.round((live.progress||0)*100)}%`:'Unbuilt',p.x,p.y);}
 if(!service&&live?.id===selected?.id)polygon(c,roomGroundPolygon({x:s.x+4,y:s.y+4,w:s.w-8,h:s.h-8},camera),null,'#f5cf78',2.5);
 c.restore();
 }
 // Restore the enclosing side wall behind furniture, matching the rear wall.
 // The front corridor remains cut away so doors, requests and coins stay visible.
 for(const s of shells){const live=rooms.find(r=>r.bay===s.bay),p=ROOM_FINISHES[s.finish];if(!overview&&live?.id!==selected?.id)continue;wall(c,{x:s.x,y:s.y},{x:s.x,y:250},105,camera,{base:p.wall,trim:p.trim});}
 drawItems.sort((a,b)=>a.depth-b.depth);for(const o of drawItems){c.save();if(o.dim)c.globalAlpha=.22;const r={x:o.item.x,y:o.item.y,w:o.size.w,h:o.size.h};ground(c,r,camera,'#33291717');if(o.item.id===selectedItemId&&o.roomId===selected?.id)ground(c,r,camera,preview?.valid===false?'#b3443855':'#f8d16e66',preview?.valid===false?'#b34438':'#ac792b');const box=sprite(c,o.item,o.size,camera,images);if(box&&!o.dim)hitItems.push({...o,box,rect:r});c.restore();}
 // Corridor wall and threshold stay in front, with a real open doorway.
 for(const s of shells){const live=rooms.find(r=>r.bay===s.bay),p=ROOM_FINISHES[s.finish];if(!overview&&live?.id!==selected?.id)continue;c.save();for(const [x,w]of [[s.x,s.door-28-s.x],[s.door+28,s.x+s.w-s.door-28]])wall(c,{x,y:250},{x:x+w,y:250},17,camera,{base:p.wall,trim:p.trim,low:true});ground(c,{x:s.door-28,y:246,w:56,h:12},camera,'#e5c995','#a48752');const label=projectRoomPoint({x:s.door,y:278,z:0},camera);c.fillStyle='#f6e3b5';c.textAlign='center';c.font=`600 ${Math.max(10,13*camera.scale)}px system-ui`;c.fillText(live?`ROOM ${live.id.split('-')[1].padStart(2,'0')}`:'UNBUILT',label.x,label.y);c.restore();}
 if(overview&&!service){wall(c,{x:970,y:250},{x:970,y:345},35,camera,{base:'#a37a46',trim:'#345b4d'});for(let i=0;i<5;i++)ground(c,{x:985+i*17,y:275,w:17,h:55},camera,i%2?'#cbb281':'#ad8d5e','#9a7b4d');const p=projectRoomPoint({x:1040,y:263},camera);c.fillStyle='#315342';c.font='12px system-ui';c.textAlign='center';c.fillText('STAIR LANDING',p.x,p.y);}
 return {camera,selectedRoomId:selected?.id,hitItems,hit(point){return [...hitItems].reverse().find(o=>!o.groundOnly&&point.x>=o.box.x&&point.x<=o.box.x+o.box.w&&point.y>=o.box.y&&point.y<=o.box.y+o.box.h)||[...hitItems].reverse().find(o=>hitRoomGround(point,o.rect,camera));}};
}
