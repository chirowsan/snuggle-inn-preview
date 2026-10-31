import {ROOM_FINISHES} from './hotel-room-layout.mjs';
import {groundPoint,PROJECTION} from './exterior-projection.mjs';
import {FACADE_GEOMETRY as G,projectHotelBuilding} from './hotel-building.mjs';
const root='./assets/exterior/facade/';
const venueArt={restaurant:{path:'./assets/guests-v08/service-wing.webp',x:68,y:73,w:238,h:252},salon:{path:'./assets/guests-v08/service-wing.webp',x:379,y:73,w:239,h:252},spa:{path:'./assets/guests-v08/service-wing.webp',x:683,y:73,w:238,h:252},lounge:{path:'./assets/leisure/leisure-floor.webp',x:45,y:40,w:460,h:290},theater:{path:'./assets/leisure/leisure-floor.webp',x:550,y:40,w:430,h:290}};
export function mountBuildingFacade(view){
 const model=view.building||projectHotelBuilding();
 const layer=view.el('div','ex-built-facade');layer.setAttribute('role','img');layer.setAttribute('aria-label',`Hotel exterior: Lobby and ${model.topFloor} upper ${model.topFloor===1?'level':'levels'}. ${model.levels.filter(l=>l.structural&&l.floor>0).map(l=>`${l.label}, ${l.purpose}, ${l.status}`).join('. ')}`);
 for(const level of model.levels.filter(l=>l.floor>0&&l.structural)){
  const floor=view.el('div','ex-built-floor');floor.dataset.floor=String(level.floor);floor.dataset.status=level.status;floor.style.top=(G.lobbyTop-level.floor*G.floorHeight)+'px';floor.style.left=G.left+'px';floor.style.width=G.width+'px';floor.style.height=G.floorHeight+'px';
  floor.append(view.image(root+'floor-shell.webp','ex-floor-shell'));
  for(let bay=0;bay<3;bay++){
   const item=level.bays.find(b=>b.bay===bay),status=item?.status||'unbuilt';
   const pane=view.el('div','ex-building-pane');pane.dataset.status=status;pane.dataset.bay=String(bay);pane.dataset.kind=item?.type||item?.id||'closed';pane.setAttribute('aria-label',`${level.label}, ${['left','middle','right'][bay]} bay: ${item?.id||'space'}, ${status==='built'?(item?.name||'open'):status==='building'?'under construction':'closed, unfurnished'}`);
   const shell=item?.shell,width=shell?(shell.w-38)*.76:(bay===1?204:190),center=shell?G.left+shell.x+shell.w/2-70:G.bayCenters[bay];Object.assign(pane.style,{left:(center-G.left-width/2)+'px',top:'34px',width:width+'px',height:G.bayHeight+'px'});
   if(status==='built'){
    if(level.floor<3){if(!shell||shell.windows>0){pane.append(view.image(root+`window-${item.type}.webp`,'ex-window-interior'));if(shell){pane.style.width=(shell.windows===1?width*.65:width)+'px';pane.style.left=(center-G.left-(shell.windows===1?width*.65:width)/2)+'px';pane.dataset.finish=shell.finish;pane.style.border='4px solid '+ROOM_FINISHES[shell.finish].trim;if(shell.windows===2){const mullion=view.el('div');Object.assign(mullion.style,{position:'absolute',left:'49%',top:'0',width:'4px',height:'100%',background:ROOM_FINISHES[shell.finish].trim});pane.append(mullion);}pane.setAttribute('aria-label',pane.getAttribute('aria-label')+`, custom ${shell.w/10} by ${shell.h/10} tile room, ${shell.windows} windows`);}}else{const wall=view.el('div');Object.assign(wall.style,{width:'100%',height:'100%',background:ROOM_FINISHES[shell.finish].wall});pane.append(wall);pane.setAttribute('aria-label',pane.getAttribute('aria-label')+', custom room, no front windows');}}
    else {const art=venueArt[item.id];if(art){const window=view.el('div','ex-venue-interior');window.style.backgroundImage=`url("${art.path}")`;window.style.backgroundSize=`${1200/art.w*100}% ${700/art.h*100}%`;window.style.backgroundPosition=`${art.x/(1200-art.w)*100}% ${art.y/(700-art.h)*100}%`;pane.append(window);}}
   }else{
    pane.append(view.el('div','ex-closed-shutter'));
    if(status==='building'){pane.append(view.el('div','ex-building-cover'),view.el('div','ex-scaffold'));const progress=view.el('div','ex-building-progress');progress.style.setProperty('--build-progress',String(item.progress));pane.append(progress);}
   }
   floor.append(pane);
  }
  // Match the continuous bronze rail in the shell, above inset window content.
  floor.append(view.el('div','ex-building-rail'));layer.append(floor);
 }
 const frontFascia=view.el('div','ex-front-fascia');Object.assign(frontFascia.style,{left:G.left+'px',top:(model.roofY+4)+'px',width:G.width+'px',height:G.roofHeight+'px'});layer.append(frontFascia);
 const roof=view.image(root+'roof-cap.webp','ex-building-roof');Object.assign(roof.style,{left:G.left+'px',top:(model.roofY+2)+'px',width:G.width+'px',height:(G.roofHeight+2)+'px'});layer.append(roof);
 (view.frontLayer||view.scene).append(layer);view.facadeLayer=layer;
 if(view.frontLayer){
  const depth=PROJECTION.depth,right=groundPoint(1040,550),top=model.roofY+4;
  // Real depth surfaces: side wall rises vertically, roof lies in the same ground axes.
  const side=view.el('div','ex-building-side');Object.assign(side.style,{left:right.x+'px',top:(right.y-550)+'px',transform:'matrix(.5,-.65,0,1,0,0)'});
  for(const level of model.levels.filter(l=>l.structural)){
   const y=level.floor===0?G.lobbyTop:G.lobbyTop-level.floor*G.floorHeight,h=level.floor===0?G.lobbyBottom-G.lobbyTop:G.floorHeight;
   const wall=view.el('div','ex-side-floor');Object.assign(wall.style,{top:y+'px',width:depth+'px',height:h+'px'});wall.dataset.floor=String(level.floor);
   // Side glazing belongs to the same right-hand room; it never invents another completed room.
   const room=level.bays.find(b=>b.bay===2),status=level.floor===0?'built':room?.status||'unbuilt';wall.dataset.status=status;
   const glass=view.el('div','ex-side-glass');if(status==='built'&&level.floor>0&&level.floor<3&&(!room?.shell||room.shell.windows>0))glass.append(view.image(root+`window-${room.type}.webp`,'ex-side-window'));else if(status!=='built')glass.append(view.el('div',status==='building'?'ex-scaffold':'ex-closed-shutter'));
   if(!(level.floor===1&&room?.shell?.windows===0))wall.append(glass);side.append(wall);
  }
  const fascia=view.el('div','ex-side-fascia');Object.assign(fascia.style,{top:top+'px',width:depth+'px',height:(G.roofHeight-4)+'px'});side.append(fascia);view.scene.append(side);view.sideLayer=side;
  const roof=view.el('div','ex-roof-plane');const pos=groundPoint(160,550-depth,550-top);Object.assign(roof.style,{left:pos.x+'px',top:pos.y+'px',width:G.width+'px',height:depth+'px',transform:'matrix(.9,.18,-.5,.65,0,0)'});
  roof.append(view.el('div','ex-roof-sedum'),view.el('div','ex-roof-skylight'));view.scene.append(roof);view.roofLayer=roof;
  const shadow=view.el('div','ex-building-ground-shadow');view.groundLayer.append(shadow);
 }
 return layer;
}
