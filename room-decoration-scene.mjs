/** Decoration-only two-wall room. Never replaces the classic service hallway. */
import {fitRoomCamera,projectRoomPoint,unprojectRoomPoint,roomGroundPolygon} from './room-isometric-projection.mjs';
import {furnishingArt} from './room-isometric-scene.mjs';
const poly=(c,points,fill,stroke)=>{c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}};
function plane(c,points,camera,fill,stroke){poly(c,points.map(p=>projectRoomPoint(p,camera)),fill,stroke);}
function line(c,a,b,camera,color,width=1){const p=projectRoomPoint(a,camera),q=projectRoomPoint(b,camera);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
export function drawDecorationRoom(c,{width,height,shell,items=[],catalog={},images={},art={},selectedId,preview=null}){
 const s=shell||{x:0,y:0,w:320,h:320},x=s.x,y=s.y,w=s.w,h=s.h,H=160;
 const camera=fitRoomCamera({x,y,w,h,wallHeight:H},width,height,Math.max(14,Math.min(width,height)*.045));
 c.clearRect(0,0,width,height);const bg=c.createLinearGradient(0,0,0,height);bg.addColorStop(0,'#5b3b26');bg.addColorStop(.55,'#8a5a36');bg.addColorStop(1,'#3e2718');c.fillStyle=bg;c.fillRect(0,0,width,height);const glow=c.createLinearGradient(0,0,width,0);glow.addColorStop(0,'#ffd99a00');glow.addColorStop(.5,'#ffd99a59');glow.addColorStop(1,'#ffd99a00');c.fillStyle=glow;c.fillRect(0,0,width,height);
 c.save();c.shadowColor='#77594038';c.shadowBlur=26*camera.scale;c.shadowOffsetY=12*camera.scale;poly(c,roomGroundPolygon(s,camera,-9),'#b98c53');c.restore();
 plane(c,[{x,y:y+h},{x:x+w,y:y+h},{x:x+w,y:y+h,z:-9},{x,y:y+h,z:-9}],camera,'#ad7d43');
 plane(c,[{x:x+w,y},{x:x+w,y:y+h},{x:x+w,y:y+h,z:-9},{x:x+w,y,z:-9}],camera,'#c4965a');
 poly(c,roomGroundPolygon(s,camera),'#e2be83');
 const oak=images['assets/interior/decor-catalogue-v1/light-oak-floor.webp'];
 if(oak){c.save();c.transform(.8660254038*camera.scale,.5*camera.scale,-.8660254038*camera.scale,.5*camera.scale,camera.x,camera.y);c.beginPath();c.rect(x,y,w,h);c.clip();c.drawImage(oak,0,0,oak.width,oak.height,x,y,w,h);c.restore();}
 else{c.save();poly(c,roomGroundPolygon(s,camera));c.clip();for(let yy=y;yy<y+h;yy+=18){plane(c,[{x,y:yy},{x:x+w,y:yy},{x:x+w,y:yy+18},{x,y:yy+18}],camera,Math.round((yy-y)/18)%2?'#ddbf8d':'#e2c795');line(c,{x,y:yy},{x:x+w,y:yy},camera,'#aa835141',.7);for(let xx=x+((Math.round((yy-y)/18)%2)*44);xx<x+w;xx+=88)line(c,{x:xx,y:yy},{x:xx,y:yy+18},camera,'#aa835130',.6);}c.restore();}

 c.save();c.globalAlpha=.16;plane(c,[{x:x+4,y:y+h*.22},{x:x+4,y:y+h*.80},{x:x+w*.62,y:y+h*.95},{x:x+w*.62,y:y+h*.40}],camera,'#fff3c4');c.restore();
 // Exactly two enclosing rear walls; the two camera-facing edges remain open.
 plane(c,[{x,y},{x:x+w,y},{x:x+w,y,z:H},{x,y,z:H}],camera,'#eee2c7','#d9c7a2');
 plane(c,[{x,y},{x,y:y+h},{x,y:y+h,z:H},{x,y,z:H}],camera,'#e5d5b5','#c8b58c');
 for(const [a,b]of [[{x,y,z:H},{x:x+w,y,z:H}],[{x,y,z:H},{x,y:y+h,z:H}]])line(c,a,b,camera,'#fff4d7',5*camera.scale);
 for(const [a,b]of [[{x,y,z:6},{x:x+w,y,z:6}],[{x,y,z:6},{x,y:y+h,z:6}]])line(c,a,b,camera,'#c6ad7d',5*camera.scale);
 // Large left-wall window is code-native wall art, not a placeholder card.
 const a=y+h*.20,b=y+h*.82,lo=25,hi=145;
 plane(c,[{x:x+.4,y:a,z:lo},{x:x+.4,y:b,z:lo},{x:x+.4,y:b,z:hi},{x:x+.4,y:a,z:hi}],camera,'#c8d8cd','#f8efd5');
 for(let i=0;i<=3;i++){const yy=a+(b-a)*i/3;line(c,{x:x+1,y:yy,z:lo},{x:x+1,y:yy,z:hi},camera,'#655c48',2*camera.scale);}for(let i=0;i<=2;i++){const z=lo+(hi-lo)*i/2;line(c,{x:x+1,y:a,z},{x:x+1,y:b,z},camera,'#655c48',2*camera.scale);}
 // Small framed print on the right wall complements the calm furniture palette.
 const artLeft=x+w*.42,artRight=x+w*.77;
 plane(c,[{x:artLeft,y:y+.5,z:65},{x:artRight,y:y+.5,z:65},{x:artRight,y:y+.5,z:137},{x:artLeft,y:y+.5,z:137}],camera,'#f9f0d9','#aa8754');
 plane(c,[{x:artLeft+8,y:y+1,z:73},{x:artRight-8,y:y+1,z:73},{x:artRight-8,y:y+1,z:129},{x:artLeft+8,y:y+1,z:129}],camera,'#ead6ae');
 plane(c,[{x:artLeft+15,y:y+1.5,z:78},{x:artLeft+46,y:y+1.5,z:84},{x:artLeft+36,y:y+1.5,z:124},{x:artLeft+12,y:y+1.5,z:110}],camera,'#b9783f');
 const hitItems=[];
 const draw=items.map(item=>preview?.id===item.id?{...item,...preview}:item).sort((a,b)=>{const ar=a.catalogId==='woven-rug'||a.legacy?.kind==='rug',br=b.catalogId==='woven-rug'||b.legacy?.kind==='rug';return ar!==br?(ar?-1:1):(a.x+a.y)-(b.x+b.y);});
 for(const item of draw){const def=catalog[item.catalogId||item.kind]||{},quarter=(item.rotation||0)%180!==0,ww=quarter?(def.h||40):(def.w||40),hh=quarter?(def.w||40):(def.h||40),rect={x:item.x,y:item.y,w:ww,h:hh};
  const frameArt=art[item.catalogId]?.rotations?.[String(item.rotation||0)]||art[item.catalogId]?.rotations?.['0']||art[item.catalogId]||(item.legacy?furnishingArt({...item,...item.legacy,rotation:item.rotation}):!item.catalogId?furnishingArt(item):null);const image=frameArt&&images[frameArt.path],frame=frameArt?.frame;
  c.save();c.globalAlpha=.16;poly(c,roomGroundPolygon(rect,camera),'#5e472e');c.restore();if(preview?.id===item.id){c.save();c.lineWidth=2.5;poly(c,roomGroundPolygon(rect,camera),preview.valid===false?'#e0484866':'#4cc4705c',preview.valid===false?'#c0392b':'#2e8b4a');c.restore();}else if(selectedId===item.id){const g=roomGroundPolygon({x:rect.x-6,y:rect.y-6,w:rect.w+12,h:rect.h+12},camera);c.save();c.lineJoin='round';c.lineWidth=7;poly(c,g,'#ffe27a40',null);c.strokeStyle='#fff8dccc';c.stroke();c.lineWidth=3;c.strokeStyle='#e0a526';c.stroke();c.restore();}
  const p=projectRoomPoint({x:item.x+ww/2,y:item.y+hh/2},camera),span=(ww+hh)*.8660254038*camera.scale,sw=span*(frameArt?.scale||1.1),sh=frame?sw*frame[3]/frame[2]:sw;
  const box={x:p.x-sw/2,y:p.y-sh+(ww+hh)*.5*camera.scale*.30,w:sw,h:sh};
  if(image&&frame)c.drawImage(image,...frame,box.x,box.y,box.w,box.h);
  else if(item.kind==='rug'||item.legacy?.kind==='rug'||item.catalogId==='woven-rug')poly(c,roomGroundPolygon(rect,camera),'#caba9a','#eadfc4');
  hitItems.push({item,rect,box,rendered:!!(image&&frame)});
 }
 return {camera,hitItems,ground(point){return unprojectRoomPoint(point,camera);},hit(point){return [...hitItems].reverse().find(o=>point.x>=o.box.x&&point.x<=o.box.x+o.box.w&&point.y>=o.box.y&&point.y<=o.box.y+o.box.h);}};
}
