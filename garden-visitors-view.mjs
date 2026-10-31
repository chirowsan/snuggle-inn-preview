import {GardenVisitors} from './garden-visitors.mjs';
import {GardenVisitorPainter,GARDEN_DRAW} from './garden-visitors-paint.mjs';
import {groundPoint} from './exterior-projection.mjs';

/** Optional exterior-only presentation. The owner supplies the already loaded
 * indoor art bundle; missing rigs simply mean no visitors, never gliding art. */
export class GardenVisitorsView{
 constructor(view,bundle){
  this.view=view;this.nodes=new Map();this.bundle=bundle;this.focused=true;this.paused=false;this.last=null;this.elapsed=0;this.destroyed=false;this.failures=[];
  const species=['rabbit','cat'].filter(k=>bundle?.rigs?.[k]);this.model=new GardenVisitors(view.store.design,{species});
  if(!species.length||!view.win.requestAnimationFrame)return;
  this.button=view.button('Pause cosmetic garden visitors. They have no requests or earnings.',null,()=>{this.paused=!this.paused;this.refreshButton();},'ex-visitors-toggle');
  this.button.textContent='Visitors';this.button.title='Garden visitors · just enjoying the grounds. No requests or earnings.';view.root.append(this.button);this.refreshButton();
  view.listen(view.win,'blur',()=>{this.focused=false;this.last=null;});view.listen(view.win,'focus',()=>{this.focused=true;this.last=null;});
  this.loop=now=>{if(this.destroyed)return;this.frame(now);this.raf=view.win.requestAnimationFrame(this.loop);};this.raf=view.win.requestAnimationFrame(this.loop);
 }
 refreshButton(){if(!this.button)return;const reduced=this.view.reducedMotion();this.button.disabled=reduced;this.button.textContent=reduced?'Visitors off':this.paused?'Visits paused':'Visitors';this.button.setAttribute('aria-pressed',String(!this.paused&&!reduced));this.button.setAttribute('aria-label',reduced?'Garden visitors are off with reduced motion':this.paused?'Resume cosmetic garden visitors. No requests or earnings.':'Pause cosmetic garden visitors. No requests or earnings.');}
 sync(){if(this.destroyed)return;if(!this.view.drag&&!this.view.landscape?.active)this.model.updateDesign(this.view.store.design);this.refreshButton();if(this.button)this.button.hidden=!!this.view.panel||!!this.view.selected||!!this.view.landscape?.active||!!this.view.transition;}
 frame(now){
  const v=this.view;if(this.last===null)this.last=now;const dt=Math.min(.1,Math.max(0,(now-this.last)/1000));this.last=now;
  const stopped=this.paused||v.reducedMotion()||v.doc.hidden||!this.focused||v.container.inert||v.resetOpen||!!v.landscape?.active||!!v.drag||!!v.transition;
  if(stopped){this.elapsed=0;return;}this.elapsed+=dt;if(this.elapsed<1/30)return;
  const elapsed=this.elapsed;this.elapsed=0;this.model.step(elapsed);this.draw();
 }
 draw(){
  const v=this.view,active=new Set(this.model.actors.map(a=>a.id));for(const [id,node]of this.nodes)if(!active.has(id)){node.canvas.remove();this.nodes.delete(id);}
  for(const a of this.model.actors){let node=this.nodes.get(a.id);if(!node){
    const canvas=v.el('canvas','ex-garden-visitor');canvas.width=GARDEN_DRAW.width;canvas.height=GARDEN_DRAW.height;canvas.setAttribute('aria-hidden','true');const ctx=canvas.getContext?.('2d');if(!ctx)continue;
    try{node={canvas,painter:new GardenVisitorPainter(ctx,this.bundle.rigs[a.kind],a.kind)};}catch(error){if(this.failures.length<3)this.failures.push(String(error));this.model.fade(a);continue;}
    v.scene.append(canvas);this.nodes.set(a.id,node);
   }
   const p=groundPoint(a.x,a.y),seat=a.seatProgress&&a.seat?groundPoint(a.seat.seat.x,a.seat.seat.y):null;
   // Upright actors share the exact prop/fence depth ordering; a sitter is just
   // in front of its own backrest rather than in front of every garden object.
   Object.assign(node.canvas.style,{left:p.x-GARDEN_DRAW.feetX+'px',top:p.y-GARDEN_DRAW.feetY+'px',zIndex:String(1000+Math.round(seat?seat.y+1:p.y)),width:GARDEN_DRAW.width+'px',height:GARDEN_DRAW.height+'px'});
   try{node.painter.draw(a,this.model.time);}catch(error){if(this.failures.length<3)this.failures.push(String(error));this.model.fade(a);}
  }
 }
 destroy(){this.destroyed=true;this.view.win.cancelAnimationFrame?.(this.raf);this.model.destroy();for(const n of this.nodes.values())n.canvas.remove();this.nodes.clear();this.button?.remove();}
}
