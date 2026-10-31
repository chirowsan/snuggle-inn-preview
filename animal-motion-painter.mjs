// Runtime painter; parts and socket landmarks retain the bounded proof design.
export function createPaintedRigPainter({ctx,manifest,variants,images,config,kind='pip',loadPainter=null}){
let debug=false;
function segment(name,a,b){
  const part=manifest.parts[name],im=images[name];
  const sourceLength=Math.hypot(part.distal[0]-part.proximal[0],part.distal[1]-part.proximal[1]);
  const desiredLength=Math.hypot(b.x-a.x,b.y-a.y);
  const rotation=Math.atan2(b.y-a.y,b.x-a.x)-Math.atan2(part.distal[1]-part.proximal[1],part.distal[0]-part.proximal[0]);
  ctx.save();ctx.translate(a.x,a.y);ctx.rotate(rotation);ctx.scale(desiredLength/sourceLength,desiredLength/sourceLength);
  ctx.drawImage(im,-part.proximal[0],-part.proximal[1]);ctx.restore();
}
function shoe(side,leg,projection=1){
  const part=manifest.parts[`${side}_shoe`],im=images[`${side}_shoe`];
  // The original orange ankle insertion cap is buried under the brown cuff.
  // Only the redundant hidden top of the shoe is clipped, not a replacement shape.
  const trim=kind==='rabbit'?0:Math.max(0,part.proximal[1]-2);
  ctx.save();ctx.translate(leg.sole.x,leg.sole.y);ctx.scale(config.scale*projection,config.scale);
  ctx.drawImage(im,0,trim,im.width,im.height-trim,-part.sole_anchor[0],trim-part.sole_anchor[1],im.width,im.height-trim);ctx.restore();
}
function kneeOverlap(side,point){
  // Joint underfill uses the SAME painted trouser texture, never a flat primitive.
  // It masks the generated orange insertion caps at articulated clothing joints.
  const im=images[`${side}_thigh`],radius=2.45;
  ctx.save();ctx.beginPath();ctx.arc(point.x,point.y,radius,0,Math.PI*2);ctx.clip();
  ctx.drawImage(im,Math.round(im.width*.38),Math.round(im.height*.4),Math.round(im.width*.3),Math.round(im.height*.27),point.x-radius,point.y-radius,radius*2,radius*2);ctx.restore();
}
function leg(side,p,projection){segment(`${side}_thigh`,p.root,p.joint);segment(`${side}_shin`,p.joint,p.end);kneeOverlap(side,p.joint);shoe(side,p,projection);}
function arm(side,p){segment(`${side}_upper_arm`,p.root,p.joint);segment(`${side}_forearm`,p.joint,p.end);}
function loadArt(type,p,prop=null){
  if(loadPainter?.(type,p,prop))return;
  ctx.save();ctx.translate(p.x,p.y);
  if(type==='suitcase'){
    const p=manifest.parts.suitcase;ctx.drawImage(images.suitcase,-p.handle_grip[0]*config.scale,-p.handle_grip[1]*config.scale,p.size[0]*config.scale,p.size[1]*config.scale);
  }else if(type==='towel'){
    // Exact towel-stack crop used by the existing renderer, now parented to the paw.
    ctx.drawImage(images.cart,51,191,214,130,-9.3,-11.2,18.6,11.3);
  }else if(type==='meal'){
    // Same gold cloche motif as the existing game's meal overlay.
    const g=ctx.createLinearGradient(-8,-9,8,0);g.addColorStop(0,'#aa793d');g.addColorStop(.45,'#ffe8aa');g.addColorStop(1,'#b98a49');
    ctx.fillStyle='#af8346';ctx.beginPath();ctx.ellipse(0,-.7,10.3,2.4,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(0,-2,8.2,7,0,Math.PI,0);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#825f32';ctx.lineWidth=.6;ctx.stroke();
    ctx.fillStyle='#e8c474';ctx.beginPath();ctx.ellipse(0,-9.2,1.4,1,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#fff0bd';ctx.lineWidth=.5;ctx.beginPath();ctx.ellipse(0,-.9,9.3,1.6,0,0,Math.PI);ctx.stroke();
  }
  ctx.restore();
}
function body(pose,state){
  const p=manifest.parts.body;
  const blink=!state.reducedMotion&&!state.moving&&!state.turn&&((state.time+1.8)%4.6)<.13;
  const frontPose=state.turn&&state.turn.progress>=.22&&state.turn.progress<=.72;
  if(frontPose){
    const front=variants.variants.front;
    ctx.save();ctx.scale(pose.face,1);ctx.rotate(pose.bodyAngle*pose.face);
    ctx.drawImage(images.bodyFront,-config.frontOrigin[0]*config.scale,-config.frontOrigin[1]*config.scale,front.size[0]*config.scale,front.size[1]*config.scale);ctx.restore();
  }else{
    ctx.save();ctx.rotate(pose.bodyAngle);
    ctx.drawImage(blink?images.bodyBlink:images.body,-config.origin[0]*config.scale,-config.origin[1]*config.scale,p.size[0]*config.scale,p.size[1]*config.scale);
    ctx.restore();
  }
}
function character(state,pose){
  ctx.save();ctx.translate(pose.root.x,pose.root.y);ctx.scale(pose.face,1);
  const tail=manifest.parts.tail;
  ctx.save();ctx.translate(pose.sockets.tail.x,pose.sockets.tail.y);ctx.rotate(pose.bodyAngle+pose.tailAngle);ctx.scale(config.scale*pose.tailForeshorten,config.scale);ctx.drawImage(images.tail,-tail.proximal[0],-tail.proximal[1]);ctx.restore();
  arm('far',pose.arms.far);leg('far',pose.legs.far,pose.shoeProjection);leg('near',pose.legs.near,pose.shoeProjection);body(pose,state);
  if(state.load)loadArt(state.load,pose.arms.near.paw,pose.heldTool);
  arm('near',pose.arms.near);
  if(debug){
    ctx.lineWidth=.8;
    for(const[side,l]of Object.entries(pose.legs)){
      ctx.strokeStyle=side==='near'?'#74ffcc':'#ffe48b';ctx.beginPath();ctx.moveTo(l.root.x,l.root.y);ctx.lineTo(l.joint.x,l.joint.y);ctx.lineTo(l.end.x,l.end.y);ctx.stroke();
      for(const p of[l.root,l.joint,l.end]){ctx.fillStyle='#142e2a';ctx.beginPath();ctx.arc(p.x,p.y,1,0,Math.PI*2);ctx.fill();}
    }
    for(const l of Object.values(pose.arms)){ctx.strokeStyle='#8cdefa';ctx.beginPath();ctx.moveTo(l.root.x,l.root.y);ctx.lineTo(l.joint.x,l.joint.y);ctx.lineTo(l.end.x,l.end.y);ctx.stroke();}
    const paw=pose.arms.near.paw;ctx.strokeStyle='#f7a5ee';ctx.strokeRect(paw.x-1,paw.y-1,2,2);
  }
  ctx.restore();
}

return {draw(state,pose,showJoints=false){debug=showJoints;character(state,pose);},drawLoad:loadArt};
}
