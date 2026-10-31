import {mountExteriorGrounds} from './exterior-grounds.mjs';
import {LandscapeView} from './landscape-view.mjs';
import {GardenVisitorsView} from './garden-visitors-view.mjs';
import {groundPoint,groundInverse,frontPoint,frontInverse,GROUND_MATRIX,FRONT_MATRIX,projectRect,homeBounds,PROJECTED_WORLD} from './exterior-projection.mjs';
import {locationScene} from './location-scene.mjs';
import {projectHotelBuilding} from './hotel-building.mjs';
import {mountBuildingFacade} from './facade-view.mjs';
import { SCENE, WORLD, GROUND, LIMITS, SIGN_AREA, PALETTE, FONTS, PROP_TYPES, PLAQUE, DOOR, createExteriorStore, signSize, propRect, letterCount } from './exterior-model.mjs';

import { CATEGORIES, propAsset } from './exterior-catalog.mjs';

// Bundled vector strokes, not platform-dependent Unicode icon glyphs.
const icon = Object.fromEntries(['sign','garden','undo','move','remove','next','snap','reset','close','enter','check','glow','pan','plus','minus','rotate','copy','left','right','up','down'].map(k => [k,k]));
const iconPaths = {
  pan:['M8 12V6a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-4a2 2 0 0 1 4 0v9c0 4-3 6-6 6h-3c-2 0-3-1-4-3l-4-5a2 2 0 0 1 3-2l2 2'],
  plus:['M12 5v14M5 12h14'],minus:['M5 12h14'],rotate:['M20 8a8 8 0 1 0 0 9M20 3v6h-6'],copy:['M8 8h13v13H8ZM3 16V3h13'],left:['m15 5-7 7 7 7'],right:['m9 5 7 7-7 7'],up:['m5 15 7-7 7 7'],down:['m5 9 7 7 7-7'],
  sign: ['M3 19 8 5l5 14M5 14h6M20 19v-7c-6-3-8 6-3 7 2 0 3-2 3-4M20 15h-3'],
  garden: ['M5 13h14l-2 8H7ZM12 13V6M12 9C5 10 4 4 4 4c7-1 8 5 8 5ZM12 6c0-5 7-4 7-4s0 6-7 6'],
  undo: ['M8 4 3 9l5 5M4 9h10a7 7 0 0 1 0 14'],
  move: ['M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4'],
  remove: ['M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7'],
  next: ['m9 5 7 7-7 7'], snap: ['M4 4h16v16H4ZM12 8v8M8 12h8M12 2v2M12 20v2M2 12h2M20 12h2'],
  reset: ['M4 9a9 9 0 1 1 0 8M4 3v7h7'], close: ['m6 6 12 12M18 6 6 18'],
  enter: ['M3 21h18M6 21V3h12v18M3 12h11M10 8l4 4-4 4'],
  check: ['m4 12 5 6L21 5'], glow: ['M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10M12 1v2M12 21v2M1 12h2M21 12h2M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2'],
};
const fallbackAssets = { background: './assets/exterior/hotel-modern.webp', doorClosed: './assets/exterior/door-modern-closed.webp', doorOpen: './assets/exterior/door-modern-open.webp', props: Object.fromEntries(Object.keys(PROP_TYPES).map(k => [k, propAsset(k)])) };
const mounted = new WeakMap();
const mountTickets = new WeakMap();
const sameRect = (a, b) => ['left', 'top', 'width', 'height'].every(k => Math.abs(a[k] - b[k]) < 0.5);

/** Mount a self-contained editor. The owner MUST pause the hotel synchronously in onPause. */
export function mountExterior(container, options = {}) {
  if (!container?.ownerDocument || typeof container.append !== 'function') throw new TypeError('Exterior needs a DOM container.');
  if (typeof options.onPause !== 'function') throw new TypeError('Provide onPause(paused) to freeze the underlying hotel.');
  const ticket = {}; mountTickets.set(container, ticket);
  mounted.get(container)?.destroy('replaced');
  // A new mount from an owner close callback is newer and wins this container.
  if (mountTickets.get(container) !== ticket) return mounted.get(container);
  const view = new ExteriorView(container, options);
  mounted.set(container, view);
  view.start();
  return mounted.get(container) || view;
}

class ExteriorView {
  constructor(container, options) {
    this.container = container; this.options = options; this.doc = container.ownerDocument; this.win = this.doc.defaultView;
    this.previousFocus = this.doc.activeElement; this.destroyed = false; this.selected = null; this.panel = null; this.drag = null;
    this.listeners = []; this.nodes = new Map(); this.buttons = {}; this.scale = 1; this.suppressClick = 0; this.lastAction = new Map(); this.transition = null;
    this.store = createExteriorStore(options.design, (design, json) => {
      if (this.tearingDown) this.finalChange = { design, json };
      else this.callback('onChange', design, json);
    });
    this.media = this.win.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.assets = this.cleanAssets(options.assets || fallbackAssets);
    this.building=options.building||projectHotelBuilding();
    this.pauseAcquired = false; this.camera=null; this.panMode=false; this.pendingDelete=null;
  }
  start() {
    // Registered before the first owner callback, so reentrant mounts can retire us.
    try {
      this.pauseAcquired = true; this.options.onPause(true);
      if (this.destroyed) return;
      this.build(); this.render(); this.resize();
      this.listen(this.win, 'resize', () => { this.cancelGesture(); this.resize(); });
      this.listen(this.win, 'blur', () => this.interrupt());
      this.listen(this.doc, 'visibilitychange', () => { if (this.doc.hidden) { this.interrupt(); this.skipAnimation(); } });
      this.listen(this.media, 'change', () => { if (this.reducedMotion()) this.skipAnimation(); this.visitors?.sync(); });
      if (typeof this.win.ResizeObserver === 'function') {
        this.observer = new this.win.ResizeObserver(() => {
          if (this.drag && !sameRect(this.drag.rect, this.viewport.getBoundingClientRect())) this.cancelGesture();
          this.resize();
        }); this.observer.observe(this.viewport);
      }
      this.buttons.sign.focus({ preventScroll: true });
      if (this.options.animate !== false) this.animate('arrive');
    } catch (error) { this.destroy('error'); throw error; }
  }
  callback(name, ...args) {
    try { this.options[name]?.(...args); }
    catch (error) {
      this.lastError = error;
      if (name !== 'onError') { try { this.options.onError?.(error); } catch (reportingError) { this.lastError = reportingError; } }
    }
  }
  canEdit() { return !this.destroyed && !this.resetOpen && this.transition?.kind !== 'enter'; }
  listen(target, event, fn, options) {
    if (!target?.addEventListener) return;
    target.addEventListener(event, fn, options); this.listeners.push(() => target.removeEventListener(event, fn, options));
  }
  el(tag, className, text) {
    const node = this.doc.createElement(tag); if (className) node.className = className;
    if (text !== undefined) node.textContent = text; return node;
  }
  button(label, symbol, handler, className = '') {
    const b = this.el('button', `ex-button ${className}`); b.type = 'button'; b.setAttribute('aria-label', label); b.title = label;
    if (symbol) {
      const glyph = this.el('span', 'ex-glyph'); glyph.setAttribute('aria-hidden', 'true');
      const svg = this.doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
      for (const [key,value] of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.8','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'})) svg.setAttribute(key,value);
      for (const d of iconPaths[symbol] || iconPaths.check) { const path=this.doc.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',d);svg.append(path); }
      glyph.append(svg); b.append(glyph);
    }
    if (handler) this.listen(b, 'click', e => { if (this.allowAction(label, e)) handler(e); });
    return b;
  }
  allowAction(key, event) {
    if (this.destroyed || this.transition?.kind === 'enter' && key !== 'Skip animation' || this.resetOpen && !key.startsWith('Reset') && key !== 'Cancel reset') return false;
    if (event?.detail > 1 || event?.repeat) return false;
    const now = Number(event?.timeStamp) || this.win.performance.now(), previous = this.lastAction.get(key);
    if (previous !== undefined && now - previous >= 0 && now - previous < 220) return false;
    this.lastAction.set(key, now); return true;
  }
  cleanAssets(raw) {
    const safe = value => {
      if (typeof value !== 'string' || value.length > 2048) return '';
      try {
        const url = new URL(value, this.doc.baseURI);
        return ['http:', 'https:', 'file:'].includes(url.protocol) && url.origin === this.doc.location.origin ? url.href : '';
      } catch { return ''; }
    };
    return { background: safe(raw.background), doorClosed: safe(raw.doorClosed), doorOpen: safe(raw.doorOpen), props: Object.fromEntries(Object.keys(PROP_TYPES).map(k => [k, safe(raw.props?.[k] || propAsset(k))])) };
  }
  image(src, className) {
    const image = this.el('img', className); image.alt = ''; image.draggable = false;
    if (src) image.src = src;
    return image;
  }
  build() {
    this.root = this.el('section', 'ex-editor'); this.root.setAttribute('role', 'dialog'); this.root.setAttribute('aria-modal', 'true'); this.root.setAttribute('aria-label', 'Hotel exterior');
    // Capture image errors once. Removed props retain no per-image listener closures.
    this.listen(this.root, 'error', event => { if (event.target.tagName === 'IMG') { event.target.classList.add('ex-image-failed'); this.announce('Some artwork could not load. Your design is safe.'); } }, true);
    this.viewport = this.el('div', 'ex-viewport'); this.scene = this.el('div', 'ex-scene');
    this.scene.append(this.image('./assets/exterior/facade/environment.webp','ex-facade-environment'));
    this.groundLayer=this.el('div','ex-ground-plane');this.groundLayer.style.transform=GROUND_MATRIX;
    this.groundLayer.append(this.image('./assets/exterior/courtyard-ground.webp','ex-ground'),this.el('div','ex-walkway'));
    this.frontLayer=this.el('div','ex-front-plane');this.frontLayer.style.transform=FRONT_MATRIX;
    this.frontLayer.append(this.image(this.assets.background,'ex-background'));
    this.scene.append(this.groundLayer,this.frontLayer);
    for(const plane of ['ground','backdrop']){const setting=locationScene(this.options.location,plane);if(setting){const backdrop=this.image('data:image/svg+xml,'+encodeURIComponent(setting),'ex-location-setting ex-location-'+plane);if(plane==='ground')this.groundLayer.insertBefore(backdrop,this.groundLayer.querySelector('.ex-walkway'));else this.scene.append(backdrop);}}
    this.scene.style.width=WORLD.width+'px';this.scene.style.height=WORLD.height+'px';
    mountBuildingFacade(this);
    const door = this.el('div', 'ex-door'); Object.assign(door.style, {left: `${DOOR.x}px`, top: `${DOOR.y}px`, width: `${DOOR.width}px`, height: `${DOOR.height}px`}); door.append(this.image(this.assets.doorClosed, 'ex-door-closed'), this.image(this.assets.doorOpen, 'ex-door-open'));
    this.frontLayer.append(door, this.el('div', 'ex-door-light'));
    this.sign = this.el('div', 'ex-lettering'); this.signText = this.el('span', 'ex-neon-text'); this.sign.append(this.signText); this.frontLayer.append(this.sign);
    this.hitLayer = this.el('div', 'ex-hit-layer'); this.signHit = this.button('Select sign, then tap a place on the canopy. Dragging is optional.', null, null, 'ex-object-hit ex-sign-hit'); this.signHit.dataset.object = 'sign'; this.hitLayer.append(this.signHit);
    this.viewport.append(this.scene, this.hitLayer); this.root.append(this.viewport);
    try{this.grounds=mountExteriorGrounds(this,{hour:Number.isInteger(globalThis.__snuggleHour)?globalThis.__snuggleHour:new Date().getHours(),reducedMotion:!!(typeof this.options.reducedMotion==='function'?this.options.reducedMotion():this.options.reducedMotion)});}catch{this.grounds=null;}
    const toolbar = this.el('nav', 'ex-toolbar'); toolbar.setAttribute('aria-label', 'Exterior tools');
    this.buttons.sign = this.button('Edit sign', icon.sign, () => { this.cancelGesture();this.camera=null;this.resize();this.select('sign'); this.showPanel('sign'); });
    this.buttons.garden = this.button('Add garden decoration', icon.garden, () => this.openGarden());
    this.buttons.build = this.button('Build outdoor grounds', null, () => this.landscape.open());this.buttons.build.textContent='Build';
    this.buttons.undo = this.button('Undo design change', icon.undo, () => this.undo());
    this.buttons.enter = this.button('Enter hotel', icon.enter, () => this.enter(), 'ex-enter'); this.buttons.enter.append(this.el('span', '', 'Enter'));
    toolbar.append(this.buttons.sign, this.buttons.garden, this.buttons.build, this.buttons.undo); this.root.append(toolbar, this.buttons.enter);
    this.context = this.el('div', 'ex-context'); this.context.setAttribute('aria-label', 'Selected decoration');
    this.buttons.move = this.button('Move selected decoration: tap a destination', icon.move, () => { this.showPanel(null); this.announce('Tap a spot, drag, or use arrow keys.'); this.objectHit(this.selected)?.focus({ preventScroll: true }); });
    this.buttons.next = this.button('Select next decoration', icon.next, () => {
      const ids = ['sign', ...this.store.design.props.map(p => p.id)]; this.select(ids[(ids.indexOf(this.selected) + 1) % ids.length]);this.revealSelection(); this.showPanel(null);
    });
    this.buttons.remove = this.button('Delete selected decoration', icon.remove, () => this.deleteSelected(), 'ex-delete');
    this.buttons.copy=this.button('Duplicate selected decoration',icon.copy,()=>{if(this.change({type:'duplicate',id:this.selected})){this.select(this.store.design.props.at(-1).id);this.announce('Copy placed. Tap a new spot.');}});
    this.buttons.rotate=this.button('Rotate selected ground tile',icon.rotate,()=>this.change({type:'rotate',id:this.selected}));
    this.buttons.deselect=this.button('Finish moving decoration',icon.check,()=>{this.selected=null;this.pendingDelete=null;this.render();});
    this.context.append(this.buttons.move, this.buttons.next,this.buttons.copy,this.buttons.rotate, this.buttons.remove,this.buttons.deselect); this.root.append(this.context);
    this.buildSignPanel(); this.buildGardenPanel(); this.buildReset(); this.buildCamera();
    this.skip = this.button('Skip animation', null, () => this.skipAnimation(), 'ex-skip'); this.skip.textContent = 'Skip'; this.skip.hidden = true; this.root.append(this.skip);
    this.status = this.el('div', 'ex-status'); this.status.setAttribute('role', 'status'); this.status.setAttribute('aria-live', 'polite'); this.root.append(this.status);
    this.tapHint=this.el('div','ex-tap-hint','Tap a decoration to move it');this.tapHint.setAttribute('aria-hidden','true');this.root.append(this.tapHint);
    this.placeZone=this.el('div','ex-tap-zone');this.placeZone.setAttribute('aria-hidden','true');this.scene.append(this.placeZone);
    this.listen(this.root, 'keydown', event => this.keydown(event));
    this.listen(this.hitLayer, 'pointerdown', event => this.pointerDown(event));
    this.listen(this.viewport, 'pointermove', event => this.pointerMove(event));
    this.listen(this.viewport, 'pointerup', event => this.pointerUp(event));
    this.listen(this.viewport, 'pointercancel', () => this.cancelGesture());
    this.listen(this.viewport, 'lostpointercapture', () => this.cancelGesture());
    this.listen(this.viewport, 'click', event => this.sceneClick(event));
    this.landscape=new LandscapeView(this);
    this.container.append(this.root);
    if(this.options.motionBundle)this.visitors=new GardenVisitorsView(this,this.options.motionBundle);
  }
  buildSignPanel() {
    this.signPanel = this.el('section', 'ex-panel ex-sign-panel'); this.signPanel.setAttribute('aria-label', 'Sign design'); this.signPanel.hidden = true;
    const heading = this.el('div', 'ex-panel-heading'); heading.append(this.el('strong', '', 'Your sign'));
    const close = this.button('Done editing sign', icon.check, () => this.showPanel(null), 'ex-small'); heading.append(close);
    this.preview = this.el('div', 'ex-sign-preview'); this.previewText = this.el('span', 'ex-neon-text'); this.preview.append(this.previewText); this.preview.setAttribute('aria-hidden', 'true');
    const inputLine = this.el('label', 'ex-input-line'); this.input = this.el('input', 'ex-sign-input'); this.input.type = 'text'; this.input.maxLength = 4096; this.input.autocomplete = 'off'; this.input.spellcheck = false; this.input.setAttribute('aria-label', 'Sign lettering, up to 30 characters'); this.count = this.el('span', 'ex-letter-count'); this.count.setAttribute('aria-hidden', 'true'); inputLine.append(this.input, this.count);
    this.listen(this.input, 'focus', () => { if (this.canEdit() && !this.transition) this.store.begin(); });
    this.listen(this.input, 'compositionstart', () => { if (this.canEdit()) this.composing = true; });
    this.listen(this.input, 'compositionend', () => { this.composing = false; this.updateText(); });
    this.listen(this.input, 'input', () => { if (!this.composing) this.updateText(); });
    this.listen(this.input, 'blur', () => this.finishInput());
    const swatches = this.el('div', 'ex-swatches'); swatches.setAttribute('role', 'group'); swatches.setAttribute('aria-label', 'Neon color'); this.colorButtons = new Map();
    for (const [name, color] of Object.entries(PALETTE)) {
      const b = this.button(`${name} lettering`, null, () => this.change({ type: 'sign', patch: { color: name } }), 'ex-swatch'); b.style.setProperty('--swatch', color); this.colorButtons.set(name, b); swatches.append(b);
    }
    this.glow = this.button('Neon glow', icon.glow, () => this.change({ type: 'sign', patch: { glow: !this.store.design.sign.glow } })); swatches.append(this.glow);
    const controls = this.el('div', 'ex-sign-controls'); this.font = this.el('select', 'ex-font'); this.font.setAttribute('aria-label', 'Letter style');
    for (const [key, label] of [['classic', 'Classic'], ['round', 'Round'], ['mono', 'Mono']]) { const option = this.el('option', '', label); option.value = key; this.font.append(option); }
    this.listen(this.font, 'change', () => this.change({ type: 'sign', patch: { font: this.font.value } }));
    this.size = this.el('input', 'ex-size'); this.size.type = 'range'; this.size.min = LIMITS.minSize; this.size.max = LIMITS.maxSize; this.size.step = 1; this.size.setAttribute('aria-label', 'Letter size');
    this.listen(this.size, 'focus', () => { if (!this.canEdit()) return; this.finishInput(); if (this.canEdit()) this.store.begin(); });
    this.listen(this.size, 'input', () => { if (!this.canEdit()) return; this.store.preview({ type: 'sign', patch: { size: Number(this.size.value), docked: false } }); this.render(); });
    this.listen(this.size, 'change', () => { if (!this.canEdit()) return; this.store.commit(); this.render(); }); this.listen(this.size, 'blur', () => { if (this.canEdit()) this.store.commit(); });
    const snap = this.button('Fit sign to the canopy', icon.snap, () => this.change({ type: 'snap-sign' }));
    const move = this.button('Place sign on canopy', icon.move, () => { this.select('sign'); this.showPanel(null); this.announce('Tap the canopy to place your sign.'); this.signHit.focus({ preventScroll: true }); });
    controls.append(this.font, this.size, snap, move); this.signPanel.append(heading, this.preview, inputLine, swatches, controls); this.root.append(this.signPanel);
  }
  buildGardenPanel() {
    this.gardenPanel = this.el('section', 'ex-panel ex-garden-panel'); this.gardenPanel.setAttribute('aria-label', 'Garden decorations'); this.gardenPanel.hidden = true;
    const heading=this.el('div','ex-panel-heading');heading.append(this.el('strong','','Garden collection'),this.button('Close garden collection',icon.close,()=>this.showPanel(null),'ex-small'));
    const categories=this.el('div','ex-categories');this.categoryButtons=new Map();
    for(const category of CATEGORIES){const b=this.button(`Show ${category.toLowerCase()} decorations`,null,()=>{this.category=category;this.render();});b.textContent=category;categories.append(b);this.categoryButtons.set(category,b);}
    this.category='All';
    const choices = this.el('div', 'ex-prop-choices'); this.addButtons = new Map();
    for (const [kind, item] of Object.entries(PROP_TYPES)) {
      const b = this.button(`Add ${item.label.toLowerCase()}`, null, () => {
        const center=this.camera?groundInverse(this.camera.x,this.camera.y):{x:350,y:850};
        if (this.change({ type: 'add', kind,x:center.x<600?center.x-80:center.x+150,y:Math.max(760,center.y+50) })) { this.panMode=false;this.select(this.store.design.props.at(-1).id); this.showPanel(null); this.announce(`${item.label} placed. Tap a spot or drag.`); }
      }, 'ex-prop-choice'); b.append(this.image(this.assets.props[kind], ''), this.el('span', '', item.label)); this.addButtons.set(kind, b); choices.append(b);
    }
    const foot = this.el('div', 'ex-garden-foot'); this.propCount = this.el('span');
    const reset = this.button('Reset design only', icon.reset, () => this.openReset(), 'ex-small'); const done = this.button('Done adding decorations', icon.check, () => this.showPanel(null), 'ex-small');
    foot.append(this.propCount, reset, done); this.gardenPanel.append(heading,categories,choices, foot); this.root.append(this.gardenPanel);
  }
  openGarden(){
    if(this.panel==='garden'){this.showPanel(null);return;}
    if(!this.camera)this.camera={...groundPoint(900,890),scale:.75};
    this.resize();this.showPanel('garden');
  }
  buildCamera(){
    const nav=this.el('nav','ex-camera');nav.setAttribute('aria-label','Courtyard view controls');
    this.buttons.pan=this.button('Pan view without moving decorations',icon.pan,()=>{this.cancelGesture();this.panMode=!this.panMode;this.pendingDelete=null;this.showPanel(null);this.render();});
    this.buttons.pan.append(this.el('span','','Pan'));
    nav.append(this.buttons.pan);
    for(const [name,dx,dy] of [['left',-220,0],['right',220,0],['up',0,-180],['down',0,180]])nav.append(this.button(`Look ${name}`,icon[name],()=>this.shiftCamera(dx,dy),'ex-camera-arrow'));
    nav.append(this.button('Zoom out',icon.minus,()=>this.zoomCamera(.8)),this.button('Zoom in',icon.plus,()=>this.zoomCamera(1.25)),this.button('Reset view to hotel',icon.snap,()=>{this.cancelGesture();this.camera=null;this.panMode=false;this.resize();this.render();}));
    this.root.append(nav);
  }
  shiftCamera(dx,dy){
    this.cancelGesture();this.pendingDelete=null;const c=this.camera||this.homeCamera();this.camera={...c,x:c.x+dx,y:c.y+dy};this.resize();this.render();
  }
  zoomCamera(factor){
    this.cancelGesture();this.pendingDelete=null;const c=this.camera||this.homeCamera();this.camera={...c,scale:Math.max(.45,Math.min(1.6,c.scale*factor))};this.resize();this.render();
  }
  buildReset() {
    this.reset = this.el('div', 'ex-reset-backdrop'); this.reset.hidden = true;
    const card = this.el('section', 'ex-reset-card'); card.setAttribute('role', 'alertdialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-label', 'Reset exterior design?');
    card.append(this.el('strong', '', 'Reset this design?'), this.el('p', '', 'Only the sign and garden change.'));
    const actions = this.el('div', 'ex-reset-actions'); this.cancelReset = this.button('Cancel reset', null, () => this.closeReset()); this.cancelReset.textContent = 'Cancel';
    this.confirmReset = this.button('Reset design only, confirm', null, () => { this.closeReset(); this.change({ type: 'reset', confirmed: true }); this.selected = null; this.showPanel(null); this.render(); this.announce('Design reset. Undo is available.'); }); this.confirmReset.textContent = 'Reset design';
    actions.append(this.cancelReset, this.confirmReset); card.append(actions); this.reset.append(card); this.root.append(this.reset);
  }
  updateText(allowTerminal = false) {
    if ((this.destroyed && !allowTerminal) || this.transition || this.resetOpen) return;
    this.store.preview({ type: 'sign', patch: { text: this.input.value } });
    const cleaned = this.store.design.sign.text;
    if (this.input.value !== cleaned) { const cursor = this.input.selectionStart; this.input.value = cleaned; this.input.setSelectionRange(Math.min(cursor ?? cleaned.length, cleaned.length), Math.min(cursor ?? cleaned.length, cleaned.length)); }
    this.render();
  }
  finishInput(allowTerminal = false) {
    if (this.destroyed && !allowTerminal) return;
    if (this.composing) { this.composing = false; this.updateText(allowTerminal); }
    if (!this.drag) this.store.commit();
  }
  change(action) {
    if (!this.canEdit()) return false;
    this.cancelGesture(); this.finishInput(); if (!this.canEdit()) return false;
    this.pendingDelete=null;const changed = this.store.dispatch(action); this.render(); return changed;
  }
  undo() {
    if (!this.canEdit()) return;
    this.cancelGesture(); this.finishInput(); if (!this.canEdit()) return;
    this.pendingDelete=null;const changed=this.store.undo(); this.render(); if(changed)this.announce('Change undone');
  }
  showPanel(panel) {
    if (this.transition?.kind === 'arrive') this.skipAnimation();
    if (!this.canEdit()) return;
    const oldPanel = this.panel, shouldRestoreFocus = !panel && (this.signPanel.contains(this.doc.activeElement) || this.gardenPanel.contains(this.doc.activeElement));
    this.finishInput(); if (!this.canEdit()) return;
    if(panel)this.pendingDelete=null;this.panel = panel; this.signPanel.hidden = panel !== 'sign'; this.gardenPanel.hidden = panel !== 'garden';
    this.buttons.sign.setAttribute('aria-expanded', String(panel === 'sign')); this.buttons.garden.setAttribute('aria-expanded', String(panel === 'garden'));
    this.render();
    if (shouldRestoreFocus) this.buttons[oldPanel === 'garden' ? 'garden' : 'sign'].focus({ preventScroll: true });
  }
  select(id) {
    if (!this.canEdit()) return;
    this.selected = id; this.pendingDelete=null;this.panMode=false; this.render();
    this.announce(id === 'sign' ? 'Sign selected.' : `${PROP_TYPES[this.store.design.props.find(p => p.id === id)?.kind]?.label || 'Decoration'} selected.`);
  }
  revealSelection(){
    if(this.selected==='sign')this.camera=null;
    else{const p=this.store.design.props.find(p=>p.id===this.selected);if(p)this.camera={...groundPoint(p.x,p.y),scale:Math.max(.65,this.camera?.scale||.75)};if(this.camera)this.camera.y-=40;}
    this.resize();
  }
  deleteSelected() {
    if(this.selected&&this.selected!=='sign'&&this.pendingDelete!==this.selected){this.pendingDelete=this.selected;this.render();this.announce('Tap delete again to remove this decoration. Undo remains available.');return;}
    if (this.selected && this.selected !== 'sign') { const id = this.selected;this.pendingDelete=null; this.selected = null; this.change({ type: 'delete', id }); this.buttons.garden.focus({ preventScroll: true }); this.announce('Decoration removed.'); }
  }
  objectHit(id) { return id === 'sign' ? this.signHit : this.nodes.get(id)?.hit; }
  render() {
    if (this.destroyed || !this.root) return;
    const design = this.store.design, sign = design.sign, box = signSize(sign);
    if (this.selected !== 'sign' && !design.props.some(p => p.id === this.selected)) this.selected = null;
    Object.assign(this.sign.style, { left: `${sign.x - box.width / 2}px`, top: `${sign.y - box.height / 2}px`, width: `${box.width}px`, height: `${box.height}px` });
    this.applyLettering(this.signText, sign, box.width - 4, box.height - 2);
    this.applyLettering(this.previewText, { ...sign, size: 32 }, 264, 44);
    this.sign.classList.toggle('ex-selected', this.selected === 'sign');
    if (this.doc.activeElement !== this.input && !this.composing) this.input.value = sign.text;
    this.count.textContent = `${letterCount(sign.text)}/30`; this.font.value = sign.font; this.size.value = sign.size;
    this.glow.setAttribute('aria-pressed', String(sign.glow));
    for (const [key, button] of this.colorButtons) button.setAttribute('aria-pressed', String(key === sign.color));
    for (const [id, nodes] of this.nodes) if (!design.props.some(p => p.id === id)) { nodes.image.remove(); nodes.shadow?.remove(); nodes.hit.remove(); this.nodes.delete(id); }
    for (const prop of design.props) {
      let nodes = this.nodes.get(prop.id);
      if (!nodes) {
        const image = this.image(this.assets.props[prop.kind], 'ex-prop'); const hit = this.button(`Select ${PROP_TYPES[prop.kind].label.toLowerCase()}. Then tap a garden spot. Dragging is optional.`, null, null, 'ex-object-hit');
        hit.dataset.object = prop.id; const shadow=this.el('div','ex-prop-ground-shadow');this.groundLayer.append(shadow);(PROP_TYPES[prop.kind].ground?this.groundLayer:this.scene).append(image); this.hitLayer.append(hit); nodes = { image, hit, shadow }; this.nodes.set(prop.id, nodes);
      }
      const rect = propRect(prop),art=PROP_TYPES[prop.kind]; Object.assign(nodes.image.style, { left: `${rect.x+(rect.width-art.width)/2}px`, top: `${rect.y+(rect.height-art.height)/2}px`, width: `${art.width}px`, height: `${art.height}px`, zIndex: String(PROP_TYPES[prop.kind].ground?2:Math.round(prop.y)), transform:PROP_TYPES[prop.kind].ground?`rotate(${prop.rotation||0}deg)`:'none' });
      if(art.ground){
        // Unproject the 2:1 ground artwork, rotate in its plane, then reproject.
        // Keep saved bounds/hit rectangles conservative and unchanged for v3 imports.
        const quarter=Math.abs((prop.rotation||0)%180)===90;
        const projectedWidth=quarter?art.height*2:art.width,projectedHeight=quarter?art.width/2:art.height;
        const fit=Math.min(1,rect.width/projectedWidth,rect.height/projectedHeight);
        Object.assign(nodes.image.style,{left:`${prop.x-art.width/2}px`,top:`${prop.y-projectedHeight*fit/2-art.height/2}px`,transform:`scale(${fit}) scaleY(.5) rotate(${prop.rotation||0}deg) scaleY(2)`});
      }
      if(!art.ground){const anchor=groundPoint(prop.x,prop.y);Object.assign(nodes.image.style,{left:`${anchor.x-art.width*art.anchor[0]}px`,top:`${anchor.y-art.height*art.anchor[1]}px`,transform:'none',zIndex:String(1000+Math.round(anchor.y))});}
      nodes.shadow.hidden=!!art.ground;Object.assign(nodes.shadow.style,{left:`${prop.x-art.width*.36}px`,top:`${prop.y-8}px`,width:`${art.width*.72}px`,height:`${Math.max(13,art.height*.12)}px`});
      nodes.image.classList.toggle('ex-selected', this.selected === prop.id); nodes.hit.setAttribute('aria-pressed', String(this.selected === prop.id));
    }
    this.signHit.setAttribute('aria-pressed', String(this.selected === 'sign')); this.buttons.undo.disabled = !this.store.canUndo;
    this.context.hidden = !this.selected || Boolean(this.panel)||this.panMode; this.buttons.remove.hidden = this.selected === 'sign';
    this.buttons.remove.setAttribute('aria-label',this.pendingDelete===this.selected?'Confirm delete selected decoration':'Delete selected decoration');this.buttons.remove.classList.toggle('ex-delete-confirm',!!this.pendingDelete);
    this.buttons.copy.hidden=this.selected==='sign';this.buttons.copy.disabled=design.props.length>=LIMITS.props;
    this.buttons.rotate.hidden=!PROP_TYPES[design.props.find(p=>p.id===this.selected)?.kind]?.ground;
    this.buttons.pan?.setAttribute('aria-pressed',String(this.panMode));this.root.classList.toggle('ex-panning',this.panMode);
    this.propCount.textContent = design.props.length>=LIMITS.props?`${LIMITS.props} / ${LIMITS.props} · Garden full`:`${design.props.length} / ${LIMITS.props} · Free`; for (const [kind,b] of this.addButtons){b.disabled=design.props.length>=LIMITS.props;b.hidden=this.category!=='All'&&PROP_TYPES[kind].category!==this.category;}
    for(const [category,b] of this.categoryButtons)b.setAttribute('aria-pressed',String(category===this.category));
    if(this.tapHint){this.tapHint.hidden=!!this.panel||!!this.transition;this.tapHint.textContent=this.panMode?'Pan view · drag or use arrows':this.pendingDelete?'Tap delete again to confirm':this.selected?(this.selected==='sign'?'Tap the glowing canopy':'Tap a garden spot · center walk stays clear'):'Tap a decoration to move it';}
    if(this.placeZone){this.placeZone.hidden=!this.selected||!!this.panel||!!this.transition||this.panMode;const [x,y,w,h]=this.selected==='sign'?SIGN_AREA:[GROUND.x,GROUND.y,GROUND.width,GROUND.height];Object.assign(this.placeZone.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px'});this.placeZone.remove();(this.selected==='sign'?this.frontLayer:this.groundLayer).append(this.placeZone);}
    this.positionHits();this.landscape?.paint();if(this.landscape?.active)this.landscape.refresh();this.visitors?.sync();
  }
  applyLettering(node, sign, width, height) {
    // Never parse user input. It is always a plain text node, including HTML-like strings.
    node.textContent = sign.text || ' '; node.style.fontFamily = FONTS[sign.font]; node.style.fontSize = `${sign.size}px`; node.style.color = PALETTE[sign.color];
    node.style.textShadow = sign.glow ? `0 0 2px ${PALETTE[sign.color]}, 0 0 5px ${PALETTE[sign.color]}` : 'none';
    node.style.transform = 'none';
    const naturalWidth = node.scrollWidth || signSize(sign).width, naturalHeight = node.scrollHeight || sign.size;
    const ratio = Math.min(1, width / Math.max(1, naturalWidth), height / Math.max(1, naturalHeight)); node.style.transform = `scale(${ratio})`;
  }
  homeCamera(){const b=homeBounds(this.building);return {x:b.x+b.width/2,y:b.y+b.height/2,scale:this.scale};}
  resize() {
    if (this.destroyed || !this.viewport) return;
    const rect = this.viewport.getBoundingClientRect();
    const home=homeBounds(this.building);this.scale = this.camera?.scale || Math.max(.01,Math.min((rect.width-32)/(home.width+100),(rect.height-126)/(home.height+45)));
    if(this.camera){
      const halfW=rect.width/this.scale/2,halfH=rect.height/this.scale/2;
      // Camera-only breathing room keeps edge decorations above phone controls.
      const cameraWorld={x:PROJECTED_WORLD.x-180,y:PROJECTED_WORLD.y-180,width:PROJECTED_WORLD.width+360,height:PROJECTED_WORLD.height+360};
      this.camera.x=Math.max(cameraWorld.x+Math.min(halfW,cameraWorld.width/2),Math.min(cameraWorld.x+cameraWorld.width-Math.min(halfW,cameraWorld.width/2),this.camera.x));
      this.camera.y=Math.max(cameraWorld.y+Math.min(halfH,cameraWorld.height/2),Math.min(cameraWorld.y+cameraWorld.height-Math.min(halfH,cameraWorld.height/2),this.camera.y));
    }
    const c=this.camera||this.homeCamera();
    this.offset = { x: rect.width/2-c.x*this.scale, y: rect.height/2-c.y*this.scale };
    this.scene.style.left = `${this.offset.x}px`; this.scene.style.top = `${this.offset.y}px`; this.scene.style.setProperty('--ex-scale', this.scale);
    // Zoom around the real glass entrance, not the scene's top-left corner.
    this.scene.style.setProperty('--ex-door-pan-x', `${-frontPoint(DOOR.centerX,DOOR.centerY).x * .025 * this.scale}px`);
    this.scene.style.setProperty('--ex-door-pan-y', `${-frontPoint(DOOR.centerX,DOOR.centerY).y * .025 * this.scale}px`);
    this.positionHits();this.landscape?.positionHandles();
  }
  positionHits() {
    if (!this.offset) return;
    const design = this.store.design, box = signSize(design.sign);
    const place = (hit, x, y, width, height, z = 1) => {
      const w = Math.max(44, width * this.scale), h = Math.max(44, height * this.scale);
      Object.assign(hit.style, { left: `${this.offset.x + x * this.scale - w / 2}px`, top: `${this.offset.y + y * this.scale - h / 2}px`, width: `${w}px`, height: `${h}px`, zIndex: String(z) });
    };
    const signRect=projectRect({x:design.sign.x-box.width/2,y:design.sign.y-box.height/2,width:box.width,height:box.height},frontPoint);place(this.signHit,signRect.x+signRect.width/2,signRect.y+signRect.height/2,signRect.width+10,signRect.height+10,1);
    for (const prop of design.props) {
      const art=PROP_TYPES[prop.kind],p=groundPoint(prop.x,prop.y),rect=art.ground?projectRect(propRect(prop)):{x:p.x-art.width*art.anchor[0],y:p.y-art.height*art.anchor[1],width:art.width,height:art.height};place(this.nodes.get(prop.id).hit,rect.x+rect.width/2,rect.y+rect.height/2,rect.width+6,rect.height+6,art.ground?2:1000+Math.round(p.y));
    }
  }
  logical(event,id=this.drag?.id||this.selected) {
    const rect = this.viewport.getBoundingClientRect();
    const x=(event.clientX-rect.left-this.offset.x)/this.scale,y=(event.clientY-rect.top-this.offset.y)/this.scale;return id==='sign'?frontInverse(x,y):groundInverse(x,y);
  }
  pointerDown(event) {
    if(this.landscape?.active&&!this.panMode)return;
    if (event.button !== 0 || event.isPrimary === false || this.drag || this.resetOpen || this.transition?.kind === 'enter') return;
    this.suppressClick = 0;
    if(this.panMode){this.finishInput();this.drag={pan:true,previousCamera:this.camera?{...this.camera}:null,pointer:event.pointerId,start:{x:event.clientX,y:event.clientY},original:{...(this.camera||this.homeCamera())},rect:this.viewport.getBoundingClientRect(),moved:false};try{this.viewport.setPointerCapture(event.pointerId);}catch{}event.preventDefault();return;}
    const target = event.target.closest?.('[data-object]'); if (!target) return;
    if (this.transition?.kind === 'arrive') this.skipAnimation();
    this.finishInput(); if (!this.canEdit()) return;
    target.focus({ preventScroll: true }); if (!this.canEdit()) return;
    const id = target.dataset.object; const p = this.logical(event,id), source = id === 'sign' ? this.store.design.sign : this.store.design.props.find(item => item.id === id);
    if (!source) return; this.select(id); this.store.begin();
    this.drag = { id, pointer: event.pointerId, start: p, clientStart:{x:event.clientX,y:event.clientY}, original: { x: source.x, y: source.y }, rect: this.viewport.getBoundingClientRect(), moved: false };
    try { this.viewport.setPointerCapture(event.pointerId); } catch { /* A synthetic pointer has no capture. */ }
    event.preventDefault();
  }
  pointerMove(event) {
    const d = this.drag; if (!d || d.pointer !== event.pointerId) return;
    if (!sameRect(d.rect, this.viewport.getBoundingClientRect())) { this.cancelGesture(); return; }
    if(d.pan){const dx=event.clientX-d.start.x,dy=event.clientY-d.start.y;if(Math.hypot(dx,dy)>5)d.moved=true;this.camera={...d.original,x:d.original.x-dx/this.scale,y:d.original.y-dy/this.scale};this.resize();event.preventDefault();return;}
    const p = this.logical(event), dx = p.x - d.start.x, dy = p.y - d.start.y;
    if (!d.moved && Math.hypot(event.clientX-d.clientStart.x,event.clientY-d.clientStart.y) < 5) return;
    if (!d.moved) { d.moved = true; this.panel = null; this.signPanel.hidden = this.gardenPanel.hidden = true; }
    this.store.preview(d.id === 'sign' ? { type: 'sign', patch: { x: d.original.x + dx, y: d.original.y + dy, docked: false } } : { type: 'move', id: d.id, x: d.original.x + dx, y: d.original.y + dy }); this.render(); event.preventDefault();
  }
  pointerUp(event) {
    const d = this.drag; if (!d || d.pointer !== event.pointerId) return;
    if (!sameRect(d.rect, this.viewport.getBoundingClientRect())) { this.cancelGesture(); return; }
    this.drag = null; this.suppressClick = event.timeStamp + 300; if (d.moved) this.store.commit(); else this.store.cancel();
    try { if (this.viewport.hasPointerCapture(event.pointerId)) this.viewport.releasePointerCapture(event.pointerId); } catch { /* Already released. */ }
    this.render(); if (!d.pan && !d.moved && d.id === 'sign') this.showPanel('sign');
  }
  cancelGesture() {
    const d = this.drag; if (!d) return;
    this.drag = null;if(d.pan){this.camera=d.previousCamera;this.resize();} this.store.cancel(); this.suppressClick = this.win.performance.now() + 300;
    try { if (this.viewport.hasPointerCapture(d.pointer)) this.viewport.releasePointerCapture(d.pointer); } catch { /* Already released. */ }
    this.render();
  }
  sceneClick(event) {
    if(this.landscape?.active){if(this.canEdit())this.landscape.tap(event);return;}
    if (this.destroyed || this.resetOpen || this.transition?.kind === 'enter'||this.panMode) return;
    if (event.timeStamp < this.suppressClick) { this.suppressClick = 0; return; }
    const hit = event.target.closest?.('[data-object]');
    if (hit) { this.select(hit.dataset.object); if (hit.dataset.object === 'sign') this.showPanel('sign'); return; }
    if (!this.selected) { this.showPanel(null); return; }
    const p = this.logical(event);
    if (this.selected === 'sign') {
      const [x, y, w, h] = SIGN_AREA; if (p.x < x || p.x > x + w || p.y < y || p.y > y + h) return;
      this.change({ type: 'sign', patch: { x: p.x, y: p.y, docked: false } });
    } else if (p.y >= 574 && p.y <= GROUND.y+GROUND.height && p.x >= GROUND.x && p.x <= GROUND.x+GROUND.width) this.change({ type: 'move', id: this.selected, x: p.x, y: p.y });
    this.showPanel(null);
  }
  keydown(event) {
    // The paused hotel may retain its own key handlers. Do not let editor keys escape.
    event.stopPropagation?.();
    if (event.isComposing || event.keyCode === 229 || this.composing) return;
    if(this.landscape?.keydown(event))return;
    if (event.key === 'Tab') { this.trapFocus(event); return; }
    if (event.key === 'Escape') {
      event.preventDefault(); if (this.resetOpen) this.closeReset(); else if (this.drag) this.cancelGesture(); else if(this.pendingDelete){this.pendingDelete=null;this.render();}else if(this.panel)this.showPanel(null);else if(this.panMode){this.panMode=false;this.render();}else if(this.selected){this.selected=null;this.render();} else if (this.transition) this.skipAnimation(); else this.enter(); return;
    }
    if (this.resetOpen || this.transition?.kind === 'enter' || /^(INPUT|SELECT|TEXTAREA)$/u.test(event.target.tagName)) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); this.undo(); return; }
    if(this.panMode){const directions={ArrowLeft:[-180,0],ArrowRight:[180,0],ArrowUp:[0,-140],ArrowDown:[0,140]};if(directions[event.key]){event.preventDefault();this.shiftCamera(...directions[event.key]);}return;}
    if ((event.key === 'Delete' || event.key === 'Backspace') && this.selected !== 'sign') { event.preventDefault(); if(!event.repeat)this.deleteSelected(); return; }
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!this.selected || !arrows[event.key] || this.transition?.kind === 'enter') return;
    const item = this.selected === 'sign' ? this.store.design.sign : this.store.design.props.find(p => p.id === this.selected); if (!item) return;
    event.preventDefault(); const [sx, sy] = arrows[event.key], step = event.shiftKey ? 20 : 6;
    const inverse=this.selected==='sign'?frontInverse:groundInverse,origin=inverse(600,550),next=inverse(600+sx*step,550+sy*step),dx=(next.x-origin.x)/step,dy=(next.y-origin.y)/step;
    this.change(this.selected === 'sign' ? { type: 'sign', patch: { x: item.x + dx * step, y: item.y + dy * step, docked: false } } : { type: 'move', id: item.id, x: item.x + dx * step, y: item.y + dy * step });
  }
  trapFocus(event) {
    const scope = this.resetOpen ? this.reset : this.root;
    const items = [...scope.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter(n => !n.closest('[hidden]') && n.getClientRects().length);
    if (!items.length) { event.preventDefault(); return; }
    const first = items[0], last = items.at(-1), active = this.doc.activeElement;
    if (event.shiftKey && (active === first || !scope.contains(active))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (active === last || !scope.contains(active))) { event.preventDefault(); first.focus(); }
  }
  openReset() {
    if (!this.canEdit()) return;
    this.cancelGesture(); this.finishInput(); if (!this.canEdit()) return;
    this.resetFocus = this.doc.activeElement; this.resetOpen = true; this.reset.hidden = false;
    this.cancelReset.focus({ preventScroll: true });
  }
  closeReset() {
    if (this.destroyed) return;
    this.resetOpen = false; this.reset.hidden = true; if (this.resetFocus?.isConnected) this.resetFocus.focus({ preventScroll: true });
  }
  announce(text) { if (this.status) this.status.textContent = text; }
  reducedMotion() { return Boolean(typeof this.options.reducedMotion === 'function' ? this.options.reducedMotion() : this.options.reducedMotion) || Boolean(this.media?.matches); }
  animate(kind) {
    this.skipAnimation(); if (this.destroyed) return;
    if (this.reducedMotion() || this.options.animate === false) { if (kind === 'enter') this.finishEnter(); return; }
    this.transition = { kind, timer: this.win.setTimeout(() => this.skipAnimation(), 600) };
    this.root.classList.add(`ex-${kind}`); this.skip.hidden = false;
    this.visitors?.sync();
    if (kind === 'enter') { this.buttons.enter.disabled = true; this.root.setAttribute('aria-busy', 'true'); }
  }
  skipAnimation() {
    const transition = this.transition; if (!transition) return;
    this.win.clearTimeout(transition.timer); this.transition = null; this.root.classList.remove(`ex-${transition.kind}`); this.skip.hidden = true; this.root.removeAttribute('aria-busy');
    this.visitors?.sync();
    if (transition.kind === 'enter') this.finishEnter();
  }
  enter() {
    if(this.landscape?.active){this.landscape.cancel();return;}
    if (this.destroyed || this.transition?.kind === 'enter' || this.resetOpen) return;
    this.cancelGesture(); this.finishInput(); if (!this.canEdit()) return;
    this.showPanel(null); if (!this.canEdit()) return;
    // Enter through the original doorway even when the garden camera was elsewhere.
    this.camera=null;this.panMode=false;this.resize();this.animate('enter');
  }
  finishEnter() {
    if (this.destroyed || this.entered) return;
    this.entered = true; const design = this.store.design, ticket = mountTickets.get(this.container);
    // Tear down and release the pause before owner navigation. No stale delayed callback survives.
    this.destroy('enter');
    if (mountTickets.get(this.container) === ticket) this.callback('onEnter', design);
  }
  interrupt() { this.cancelGesture(); this.finishInput(); }
  getDesign() { return this.store.design; }
  destroy(reason = 'destroy') {
    if (this.destroyed) return;
    // Mark terminal before a final save can invoke arbitrary owner callbacks.
    this.destroyed = true; this.tearingDown = true; this.cancelGesture(); this.finishInput(true);
    this.visitors?.destroy();
    if (this.transition) this.win.clearTimeout(this.transition.timer); this.transition = null;
    this.observer?.disconnect(); for (const remove of this.listeners) remove(); this.listeners = [];
    this.root?.remove(); if (mounted.get(this.container) === this) mounted.delete(this.container);
    if (this.pauseAcquired) { this.pauseAcquired = false; this.callback('onPause', false); }
    if (!mounted.get(this.container) && this.previousFocus?.isConnected) this.previousFocus.focus?.({ preventScroll: true });
    // A final save may synchronously mount a successor. Release this instance's
    // pause first, so an old false callback can never unpause the new instance.
    const finalChange = this.finalChange; this.finalChange = null; this.tearingDown = false;
    if (finalChange) this.callback('onChange', finalChange.design, finalChange.json);
    this.callback('onClose', { reason, design: this.store.design });
  }
}
