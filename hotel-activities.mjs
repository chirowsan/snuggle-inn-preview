/** Ephemeral immutable activity views. Only commitActivity changes the hotel.
 * A deserialized/cloned view is never a valid transaction. */
import { canRushCommand, rushCommand } from './rush.mjs';

const transactions = new WeakMap();
const ITEMS = Object.freeze(['pastry', 'cup', 'fruit']);
const BED = Object.freeze(['left', 'right', 'pillow']);
const PIPES = Object.freeze(['pipe-elbow', 'pipe-straight', 'pipe-valve']);
const RAMEN = Object.freeze(['noodles', 'broth', 'toppings']);
// The restaurant command stays generic. These are ephemeral cooking gestures,
// not extra inventory, costs, timers, or saved gameplay state.
export const CUISINE_ACTIVITIES = Object.freeze(Object.fromEntries([
  ['sushi', 'Sushi rolls', [
    ['spread-rice', 'Spread rice', 'rice-paddle', 'spread', 'seaweed'],
    ['add-filling', 'Add filling', 'salmon-cucumber', 'drop', 'rice'],
    ['roll-sushi', 'Roll the mat', 'bamboo-mat', 'roll', 'sushi mat'],
  ]],
  ['stirfry', 'Vegetable stir-fry', [
    ['add-vegetables', 'Add vegetables', 'vegetables', 'drop', 'wok'],
    ['stir-wok', 'Stir the wok', 'wok-spatula', 'stir', 'wok'],
    ['plate-stirfry', 'Slide onto plate', 'filled-wok', 'plate', 'plate'],
  ]],
  ['crepe', 'Strawberry crêpe', [
    ['pour-batter', 'Pour batter', 'batter-jug', 'pour', 'griddle'],
    ['flip-crepe', 'Flip the crêpe', 'crepe-spatula', 'flip', 'crêpe'],
    ['fold-crepe', 'Fold over fruit', 'fruit-crepe', 'fold', 'crêpe'],
  ]],
  ['pasta', 'Tomato pasta', [
    ['add-pasta', 'Add pasta', 'pasta-nest', 'drop', 'pan'],
    ['stir-sauce', 'Stir in sauce', 'sauce-spoon', 'stir', 'pasta'],
    ['toss-pasta', 'Toss the pan', 'pan-handle', 'toss', 'pan'],
  ]],
  ['pizza', 'Garden pizza', [
    ['stretch-dough', 'Stretch dough', 'dough-hands', 'stretch', 'dough'],
    ['spread-sauce', 'Spread sauce', 'sauce-spoon', 'swirl', 'pizza'],
    ['add-toppings', 'Add toppings', 'pizza-toppings', 'drop', 'pizza'],
  ]],
].map(([id,name,steps]) => [id,Object.freeze({id,name,steps:Object.freeze(steps.map(([id,label,tool,gesture,target]) => Object.freeze({id,label,tool,gesture,target})))})])));
export const getCookingStage = activity => CUISINE_ACTIVITIES[activity?.kind]?.steps[activity.steps.length] || null;
// Performance preparation is a three-action transaction, not a timer or reward.
export const LEISURE_ACTIVITIES = Object.freeze(Object.fromEntries([
  ['lounge', 'Live music', [
    ['tune-strings', 'Pluck the strings', 'pick', 'pluck', 'strings'],
    ['aim-spotlight', 'Aim the light', 'spotlight', 'aim', 'performer'],
    ['conduct-song', 'Lead the song', 'baton', 'conduct', 'music'],
  ]],
  ['theater', 'Curtain call', [
    ['place-tree', 'Place the tree', 'tree', 'place', 'tree silhouette'],
    ['place-moon', 'Place the moon', 'moon', 'place', 'moon silhouette'],
    ['open-curtain', 'Open the curtain', 'curtain-ring', 'curtain', 'curtain'],
  ]],
].map(([id,name,steps]) => [id,Object.freeze({id,name,steps:Object.freeze(steps.map(([id,label,tool,gesture,target]) => Object.freeze({id,label,tool,gesture,target})))})])));
export const getLeisureStage = activity => LEISURE_ACTIVITIES[activity?.kind]?.steps[activity.steps.length] || null;

export const RECIPE_ACTIVITIES = Object.freeze(Object.fromEntries([
  ['garden', 'Garden breakfast', ['toast', 'egg', 'apple']],
  ['tea', 'Tea tray', ['croissant', 'tea', 'jam']],
  ['pancake', 'Pancake breakfast', ['pancakes', 'banana', 'milk']],
].map(([id,name,items]) => [id,Object.freeze({id,name,items:Object.freeze(items)})])));
const sessionIsValid = value => (Number.isSafeInteger(value) && value >= 0)
  || (typeof value === 'string' && value.length > 0 && value.length <= 128);
const gestureIsValid = value => (Number.isSafeInteger(value) && value >= 0)
  || (typeof value === 'string' && value.length > 0 && value.length <= 64);
const indexIsValid = value => Number.isInteger(value) && value >= 0 && value < 3;
const fail = message => ({ ok: false, message });
const fingerprint = state => JSON.stringify(state);
const targetFor = (state, command) => ['cleanRoom', 'repairRoom'].includes(command.type)
  ? state.rooms?.find(room => room.id === command.roomId)
  : command.type === 'serveFacility' ? state.facilities?.[command.facilityId] : state.kitchen;

function makeView(transaction, fields) {
  const steps = Object.freeze([...fields.steps]);
  const scrub = Object.freeze(fields.scrub.map(sectors => Object.freeze([...sectors])));
  const taps = Object.freeze([...fields.taps]);
  const progress = fields.kind === 'scrub'
    ? scrub.reduce((sum, sectors) => sum + sectors.length, 0) / 9 : steps.length / 3;
  const status = fields.status === 'cancelled' ? 'cancelled' : progress === 1 ? 'complete' : 'active';
  const activity = Object.freeze({ kind: fields.kind, status, command: transaction.command,
    items: transaction.items, ...(transaction.guestKind?{guestKind:transaction.guestKind}:{}), ...(transaction.performer?{performer:transaction.performer}:{}), steps, scrub, taps, progress });
  transactions.set(activity, transaction);
  return activity;
}

/** Legacy prepFood keeps the original tray. Explicit recipes select new art.
 * Repair alternates by room and visiting guest; variant can select pipe/fixture.
 * Facilities become playable only after the escorted guest is waiting. */
export function createActivity(state, command, session, variant) {
  if (!sessionIsValid(session) || !['cleanRoom', 'prepFood', 'repairRoom', 'serveFacility'].includes(command?.type)) return null;
  if (command.type === 'prepFood' && command.recipe !== undefined && !Object.hasOwn(RECIPE_ACTIVITIES,command.recipe)) return null;
  const input = Object.freeze(['cleanRoom', 'repairRoom'].includes(command.type)
    ? { type: command.type, roomId: command.roomId }
    : command.type === 'serveFacility' ? {type: command.type, facilityId: command.facilityId}
    : {type: command.type, ...(command.recipe !== undefined ? {recipe:command.recipe} : {})});
  try {
    if (!canRushCommand(state, input).ok) return null;
    const target = targetFor(state,input);
    const roomNumber = state.rooms.indexOf(target);
    let kind;
    if (input.type === 'prepFood') kind = 'tray';
    else if (input.type === 'serveFacility') {
      const cuisine = [5,6,7].includes(state.version) && Object.hasOwn(CUISINE_ACTIVITIES,state.config?.restaurantCuisine)
        ? state.config.restaurantCuisine : 'ramen';
      kind = {restaurant:cuisine,salon:'salon',spa:'spa'}[input.facilityId];
      if ([6,7].includes(state.version) && state.config?.leisureRules === 1 && Object.hasOwn(LEISURE_ACTIVITIES,input.facilityId)) kind = input.facilityId;
    }
    else if (input.type === 'repairRoom') {
      const guestIndex = Math.max(0,state.guests.findIndex(guest => guest.id === target.guestId));
      kind = ['pipe','fixture'].includes(variant) ? variant : (roomNumber + guestIndex + state.completed) % 2 === 0 ? 'pipe' : 'fixture';
    } else kind = ['bed','scrub'].includes(variant) ? variant : (roomNumber + state.completed) % 2 === 0 ? 'bed' : 'scrub';
    if (!kind || !target) return null;
    const transaction = {
      state, session, command: input, fingerprint: fingerprint(state), target,
      performer: Object.hasOwn(LEISURE_ACTIVITIES,kind) ? (target.performer === 'deer' ? 'deer' : 'hedgehog') : null,
      guestKind: input.type === 'serveFacility' ? state.guests.find(g=>g.id===target.guestId)?.spriteKind||'guest' : null,
      items: kind === 'tray' ? RECIPE_ACTIVITIES[input.recipe]?.items || ITEMS : kind === 'pipe' ? PIPES : kind === 'ramen' ? RAMEN : Object.freeze([]),
      rooms: state.rooms, guests: state.guests, actors: state.actors, facilities: state.facilities,
      kitchen: state.kitchen, laundry: state.laundry, config: state.config,
      settled: false, cancelled: false,
    };
    return makeView(transaction, { kind, steps: [], scrub: [[], [], []], taps: [] });
  } catch { return null; }
}

/** Actions never mutate the hotel. Matching placements are idempotent.
 * fixture: turn {index,gestureId}; salon: brush {index,gestureId};
 * spa: soothe {index,gestureId}. One gesture can credit only one target.
 * New activities have three intentional steps, never a rapid-tap meter. */
export function applyActivity(activity, action) {
  const transaction = activity && transactions.get(activity);
  if (!transaction || transaction.settled || transaction.cancelled || !action) return activity;
  if (action.type === 'cancel') return cancelActivity(activity);
  if (activity.status !== 'active') return activity;
  const fields = { ...activity, steps: [...activity.steps],
    scrub: activity.scrub.map(sectors => [...sectors]), taps: [...activity.taps] };
  if (activity.kind === 'bed') {
    const step = action.type === 'tuck' && ['left', 'right'].includes(action.side)
      ? action.side : action.type === 'pillow' ? 'pillow' : null;
    if (!step || step !== BED[activity.steps.length]) return activity;
    fields.steps.push(step);
  } else if (['tray','pipe','ramen'].includes(activity.kind)) {
    if (action.type !== 'place' || !activity.items.includes(action.item)
      || action.item !== action.slot || activity.steps.includes(action.item)) return activity;
    if (activity.kind === 'ramen' && action.item !== activity.items[activity.steps.length]) return activity;
    fields.steps.push(action.item);
  } else if (Object.hasOwn(CUISINE_ACTIVITIES,activity.kind)) {
    const expected = getCookingStage(activity);
    if (action.type !== 'cook' || !expected || action.step !== expected.id
      || !gestureIsValid(action.gestureId) || fields.taps.includes(action.gestureId)) return activity;
    fields.taps.push(action.gestureId); fields.steps.push(expected.id);
  } else if (Object.hasOwn(LEISURE_ACTIVITIES,activity.kind)) {
    const expected = getLeisureStage(activity);
    if (action.type !== 'perform' || !expected || action.step !== expected.id
      || !gestureIsValid(action.gestureId) || fields.taps.includes(action.gestureId)) return activity;
    fields.taps.push(action.gestureId); fields.steps.push(expected.id);
  } else if (['fixture','salon','spa'].includes(activity.kind)) {
    const expected = {fixture:'turn',salon:'brush',spa:'soothe'}[activity.kind];
    if (action.type !== expected || !indexIsValid(action.index)
      || !gestureIsValid(action.gestureId) || fields.taps.includes(action.gestureId)) return activity;
    const step = `${expected}-${action.index}`;
    if (fields.steps.includes(step)) return activity;
    fields.taps.push(action.gestureId); fields.steps.push(step);
  } else if (activity.kind === 'scrub') {
    if (!['scrub', 'scrubTap'].includes(action.type) || !indexIsValid(action.stain)) return activity;
    const sectors = fields.scrub[action.stain];
    if (sectors.length === 3) return activity;
    if (action.type === 'scrub') {
      if (!indexIsValid(action.sector) || sectors.includes(action.sector)) return activity;
      sectors.push(action.sector);
    } else {
      if (!gestureIsValid(action.gestureId) || fields.taps.includes(action.gestureId)) return activity;
      fields.taps.push(action.gestureId);
      sectors.push([0, 1, 2].find(sector => !sectors.includes(sector)));
    }
    sectors.sort();
    if (sectors.length === 3) fields.steps.push(`stain-${action.stain}`);
  } else return activity;
  return makeView(transaction, fields);
}

/** Closing the modal also revokes older delayed completion views. */
export function cancelActivity(activity) {
  const transaction = activity && transactions.get(activity);
  if (!transaction || transaction.settled || transaction.cancelled) return activity;
  transaction.cancelled = true;
  return makeView(transaction, { ...activity, status: 'cancelled' });
}

/** Exactly one engine command, after completion and fresh live validation. */
export function commitActivity(state, activity, session) {
  const transaction = activity && transactions.get(activity);
  if (!transaction || transaction.cancelled || activity.status === 'cancelled') return fail('Activity cancelled.');
  if (transaction.settled) return fail('Activity already finished.');
  if (activity.status !== 'complete') return fail('Finish the activity first.');
  if (session !== transaction.session || state !== transaction.state) return fail('Activity expired.');
  const target = targetFor(state,transaction.command);
  if (target !== transaction.target || state.rooms !== transaction.rooms
    || state.guests !== transaction.guests || state.actors !== transaction.actors
    || state.kitchen !== transaction.kitchen || state.laundry !== transaction.laundry
    || state.facilities !== transaction.facilities || state.config !== transaction.config
    || fingerprint(state) !== transaction.fingerprint) return fail('Hotel changed. Try again.');
  const validation = canRushCommand(state, transaction.command);
  if (!validation.ok) return validation;
  transaction.settled = true;
  return rushCommand(state, transaction.command);
}
