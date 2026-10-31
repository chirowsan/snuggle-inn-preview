import {validateLandscape,landscapeAccess} from './landscape-model.mjs';
import {DEFAULT_HOTEL_SIGN} from './hotel-brand.mjs';
/** Pure, local-only exterior design model. No hotel state, clock, DOM or storage. */
export const SCENE = Object.freeze({ width: 1200, height: 700 });
export const WORLD = Object.freeze({ x: -300, y: -400, width: 1800, height: 1650 });
export const GROUND = Object.freeze({ x: -280, y: 574, width: 1760, height: 656 });
export const LIMITS = Object.freeze({ letters: 30, props: 60, undo: 20, minSize: 12, maxSize: 48 });
export const DESIGN_VERSION = 3;
// Measured opaque canopy face. Even a 48px sign stays physically on this surface.
export const SIGN_AREA = Object.freeze([214, 304, 772, 56]);
export const LEGACY_SIGN_AREA = Object.freeze([160, 112, 880, 323]);
export const PLAQUE = Object.freeze({ x: 598, y: 332, size: 30, width: 360, height: 38 });
export const DOOR = Object.freeze({ x: 535, y: 392, width: 123, height: 122, centerX: 596.5, centerY: 453 });
export const PALETTE = Object.freeze({ gold: '#ffe3a0', mint: '#a7ffdc', rose: '#ffb4d5', ice: '#b5e8ff', cream: '#fff5dc' });
export const FONTS = Object.freeze({ classic: 'Georgia, serif', round: 'Arial, sans-serif', mono: 'monospace' });
export { PROP_TYPES } from './exterior-catalog.mjs';
import { PROP_TYPES } from './exterior-catalog.mjs';
const DEFAULT = Object.freeze({ version: DESIGN_VERSION, sign: Object.freeze({ text: DEFAULT_HOTEL_SIGN, color: 'gold', glow: true, font: 'classic', size: PLAQUE.size, x: PLAQUE.x, y: PLAQUE.y, docked: true }), props: Object.freeze([]) });
const clone = value => JSON.parse(JSON.stringify(value));
const array = value => { try { return Array.isArray(value); } catch { return false; } };
const object = value => value && typeof value === 'object' && !array(value) ? value : {};
// Read only own data descriptors. Accessors and inherited fields are not save data.
const own = (value, key, fallback) => {
  if (!value || typeof value !== 'object') return fallback;
  try { const descriptor = Object.getOwnPropertyDescriptor(value, key); return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : fallback; }
  catch { return fallback; }
};
const patchData = raw => {
  const patch = {};
  for (const key of ['text','color','glow','font','size','x','y','docked']) {
    const missing = Symbol(); const value = own(raw, key, missing);
    if (value !== missing) patch[key] = value;
  }
  return patch;
};
const number = (value, fallback) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const rounded = value => Math.round(value * 100) / 100;
const keyIn = (source, key) => typeof key === 'string' && Object.hasOwn(source, key);
const segmenter = typeof Intl?.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

/** NFC, one line, 30 graphemes. Limits both total input and pathological clusters. */
export function sanitizeText(value) {
  if (typeof value !== 'string') return DEFAULT.sign.text;
  const text = value.slice(0, 4096).normalize('NFC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/gu, ' ')
    .replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/gu, '');
  const parts = segmenter ? Array.from(segmenter.segment(text), p => p.segment) : Array.from(text);
  return parts.slice(0, LIMITS.letters).map(p => p.length <= 96 ? p : Array.from(p).slice(0, 32).join('')).join('');
}
export function letterCount(text) {
  return segmenter ? Array.from(segmenter.segment(text)).length : Array.from(text).length;
}
/** A conservative text box. The view additionally fits actual glyphs inside it. */
export function signSize(sign) {
  const clusters = segmenter ? Array.from(segmenter.segment(sign.text), p => p.segment) : Array.from(sign.text);
  const units = clusters.reduce((sum, part) => sum + (/^[ilI.,' :!|]$/u.test(part) ? .4 : /^[A-Z0-9]$/u.test(part) ? .78 : /^\p{ASCII}$/u.test(part) ? .68 : 1.15), 0);
  return { width: Math.min(sign.docked ? PLAQUE.width : 760, Math.max(14, units * sign.size + 8)), height: sign.docked ? PLAQUE.height : sign.size * 1.12 };
}
export function constrainSign(sign) {
  if (sign.docked) return { ...sign, x: PLAQUE.x, y: PLAQUE.y, size: Math.min(PLAQUE.size, sign.size) };
  const size = signSize(sign), [x, y, width, height] = SIGN_AREA;
  return { ...sign, x: rounded(clamp(number(sign.x, PLAQUE.x), x + size.width / 2, x + width - size.width / 2)), y: rounded(clamp(number(sign.y, PLAQUE.y), y + size.height / 2, y + height - size.height / 2)) };
}
/** Preserve relative legal-center placement once when loading historical facade saves.
 * The persisted v2 marker prevents repeat mapping on sanitization, edits and reload.
 * Size/style/text and the unchanged forecourt anchors remain intact. */
function migrateSign(sign, sourceVersion, input) {
  if (typeof sourceVersion === 'number' && Number.isFinite(sourceVersion) && sourceVersion >= 2 || sign.docked) return sign;
  const box = signSize(sign);
  const map = (value, axis, extent) => {
    const oldStart = LEGACY_SIGN_AREA[axis] + extent / 2;
    const oldSpan = LEGACY_SIGN_AREA[axis + 2] - extent;
    const nextStart = SIGN_AREA[axis] + extent / 2;
    const nextSpan = SIGN_AREA[axis + 2] - extent;
    return nextStart + clamp((value - oldStart) / oldSpan, 0, 1) * nextSpan;
  };
  // Missing/invalid coordinates are defaults, not a location from an older canvas.
  const x = own(input, 'x'), y = own(input, 'y');
  return { ...sign,
    x: typeof x === 'number' && Number.isFinite(x) ? map(x, 0, box.width) : sign.x,
    y: typeof y === 'number' && Number.isFinite(y) ? map(y, 1, box.height) : sign.y,
  };
}
function propDimensions(kind, rotation=0) {
  const item=PROP_TYPES[kind];
  return item.ground && Math.abs(rotation%180)===90 ? {...item,width:item.height,height:item.width} : item;
}
export function propRect(prop) {
  const item = propDimensions(prop.kind,prop.rotation||0);
  return { x: prop.x - item.width * item.anchor[0], y: prop.y - item.height * item.anchor[1], width: item.width, height: item.height };
}
/** Full sprites stay on the expanded ground and clear of the central entrance walk. */
export function constrainProp(kind, x, y, rotation=0) {
  if (!keyIn(PROP_TYPES, kind)) return null;
  const item = propDimensions(kind,rotation);
  const ax = item.width * item.anchor[0], ay = item.height * item.anchor[1];
  const rawX = number(x, item.home[0]);
  const left = clamp(rawX, GROUND.x + ax, 520 - (item.width - ax));
  const right = clamp(rawX, 680 + ax, GROUND.x + GROUND.width - (item.width - ax));
  const minY = Math.ceil((GROUND.y + ay) * 100) / 100;
  const maxY = Math.floor((GROUND.y + GROUND.height - (item.height - ay)) * 100) / 100;
  return { x: rounded(Math.abs(rawX - left) <= Math.abs(rawX - right) ? left : right), y: rounded(clamp(number(y, item.home[1]), minY, maxY)) };
}
export function sanitizeDesign(raw) {
  if (typeof raw === 'string') {
    try { raw = raw.length <= 65536 ? JSON.parse(raw) : null; } catch { raw = null; }
  }
  const source = object(raw), input = object(own(source, 'sign'));
  const color = own(input, 'color'), font = own(input, 'font'), glow = own(input, 'glow'), docked = own(input, 'docked');
  const sign = constrainSign(migrateSign({
    text: sanitizeText(own(input, 'text')), color: keyIn(PALETTE, color) ? color : DEFAULT.sign.color,
    glow: typeof glow === 'boolean' ? glow : DEFAULT.sign.glow,
    font: keyIn(FONTS, font) ? font : DEFAULT.sign.font,
    size: rounded(clamp(number(own(input, 'size'), DEFAULT.sign.size), LIMITS.minSize, LIMITS.maxSize)),
    x: number(own(input, 'x'), PLAQUE.x), y: number(own(input, 'y'), PLAQUE.y), docked: typeof docked === 'boolean' ? docked : true,
  }, own(source, 'version'), input));
  const props = [], used = new Set(), entries = own(source, 'props');
  const length = array(entries) ? clamp(number(own(entries, 'length'), 0), 0, 64) : 0;
  for (let index = 0; index < length; index++) {
    const item = object(own(entries, String(index))), kind = own(item, 'kind'), inputId = own(item, 'id');
    if (!keyIn(PROP_TYPES, kind)) continue;
    let id = typeof inputId === 'string' && /^p[1-9]\d{0,5}$/u.test(inputId) ? inputId : `p${props.length + 1}`;
    if (used.has(id)) { let next = 1; while (used.has(`p${next}`)) next++; id = `p${next}`; }
    used.add(id);
    const rawAngle=PROP_TYPES[kind].ground?number(own(item,'rotation'),0):0,angle=((Math.round(rawAngle/90)*90)%360+360)%360;
    props.push({ id, kind, ...constrainProp(kind, own(item, 'x'), own(item, 'y'),angle), ...(angle ? {rotation:angle} : {}) });
    if (props.length === LIMITS.props) break;
  }
  const result={ version: DESIGN_VERSION, sign, props };
  let hasLandscape=false;try{hasLandscape=Object.hasOwn(source,'landscape');}catch{}
  if(hasLandscape){const layout=own(source,'landscape'),check=validateLandscape(layout);if(!check.ok)throw new TypeError(check.reason);result.landscape=clone(layout);}
  return result;
}
export const defaultDesign = () => clone(DEFAULT);
export const serializeDesign = design => JSON.stringify(sanitizeDesign(design));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function reduceDesign(raw, action) {
  const current = sanitizeDesign(raw);
  if (!action || typeof action !== 'object') return current;
  switch (own(action, 'type')) {
    case 'landscape': {const layout=own(action,'layout');if(!validateLandscape(layout).ok||!landscapeAccess(layout).ok)return current;return sanitizeDesign({...current,landscape:layout});}
    case 'sign': {
      const patch = patchData(own(action, 'patch'));
      const moves = Object.hasOwn(patch, 'x') || Object.hasOwn(patch, 'y');
      return sanitizeDesign({ ...current, sign: { ...current.sign, ...(moves ? { docked: false } : {}), ...patch } });
    }
    case 'snap-sign': {
      return sanitizeDesign({ ...current, sign: { ...current.sign, x: PLAQUE.x, y: PLAQUE.y, size: PLAQUE.size, docked: true } });
    }
    case 'add': {
      const kind = own(action, 'kind');
      if (!keyIn(PROP_TYPES, kind) || current.props.length >= LIMITS.props) return current;
      let nextId = 1; while (current.props.some(p => p.id === `p${nextId}`)) nextId++;
      const home = PROP_TYPES[kind].home;
      const offsets = [0, 140, -130, 580, 450, 680];
      const x = number(own(action, 'x'), home[0] + offsets[current.props.length % offsets.length]);
      const y = number(own(action, 'y'), home[1]);
      return sanitizeDesign({ ...current, props: [...current.props, { id: `p${nextId}`, kind, x, y }] });
    }
    case 'move': return sanitizeDesign({ ...current, props: current.props.map(p => p.id === own(action, 'id') ? { ...p, x: own(action, 'x'), y: own(action, 'y') } : p) });
    case 'rotate': return sanitizeDesign({...current,props:current.props.map(p=>p.id===own(action,'id')?{...p,rotation:((p.rotation||0)+90)%360}:p)});
    case 'duplicate': {
      const source=current.props.find(p=>p.id===own(action,'id'));
      if(!source||current.props.length>=LIMITS.props)return current;
      let nextId=1;while(current.props.some(p=>p.id===`p${nextId}`))nextId++;
      return sanitizeDesign({...current,props:[...current.props,{...source,id:`p${nextId}`,x:source.x+70,y:source.y+32}]});
    }
    case 'delete': return sanitizeDesign({ ...current, props: current.props.filter(p => p.id !== own(action, 'id')) });
    case 'reset': return own(action, 'confirmed') === true ? defaultDesign() : current;
    default: return current;
  }
}

/** One commit per drag/text edit, at most 20 undo snapshots. Preview is never saved. */
export function createExteriorStore(raw, onChange = () => {}) {
  let design = sanitizeDesign(raw), before = null;
  const undo = [];
  const emit = () => onChange(clone(design), serializeDesign(design));
  const remember = old => { undo.push(old); if (undo.length > LIMITS.undo) undo.shift(); };
  const api = {
    get design() { return clone(design); },
    get canUndo() { return undo.length > 0; },
    get undoDepth() { return undo.length; },
    get inTransaction() { return before !== null; },
    begin() { if (!before) before = clone(design); },
    preview(action) { if (!before) api.begin(); design = reduceDesign(design, action); return api.design; },
    commit() {
      if (!before) return false;
      const previous = before; before = null;
      if (same(previous, design)) return false;
      remember(previous); emit(); return true;
    },
    cancel() { if (!before) return false; design = before; before = null; return true; },
    dispatch(action) {
      api.commit(); const next = reduceDesign(design, action);
      if (same(next, design)) return false;
      remember(design); design = next; emit(); return true;
    },
    undo() {
      api.cancel(); if (!undo.length) return false;
      design = undo.pop(); emit(); return true;
    },
    snapshot() { return serializeDesign(design); },
  };
  return api;
}
