import {validRoomDoorXs,copyRoomDoorXs,roomDoorPosition} from './hotel-room-doors.mjs';
import {hasCoinPickups,validDoorCoins,copyDoorCoins,coinCash,coinCashDelta,validCoinState,canBookDoorReceipt} from './hotel-coin-pickups.mjs';
import {validStaffPlan,copyStaffPlan,initializeStaffState,learnStaffRoutine,validateStaffState,dispatchStaff} from './hotel-staff.mjs';
import {validRoomSlots} from './hotel-construction.mjs';
/** Deterministic multilevel hotel rush. Input reserves work; only stepRush advances time. */
import {initializeReputationState,recordCleanAdmission,updateReputation,validateReputationState,pestBlocksRoom,handlePest} from './hotel-reputation.mjs';
import { ROOM_LAYOUT, floorRoute, stairAt } from './rush-floors.mjs';
import { hasMotionRules, validMotionPreset, validShiftIdentity, motionSpeed, validMotionRule, motionReceipt, isCalmShift } from './hotel-motion-rules.mjs';
import { conservativeFloorRoute } from './hotel-motion-route.mjs';
import { beginEscort, stepEscort, validEscort, ESCORT_PATH_LIMIT } from './hotel-motion-escort.mjs';
import { normalizeVisitSeed, visitItinerary } from './hotel-visits.mjs';
import { FACILITIES, FACILITY_IDS, RECIPES, RECIPE_IDS, normalizeRoomTiers, normalizeFacilities, roomCapacity,
  guestContent, contentItinerary, roomMatchesGuest, contentPayment, deriveGuestReview, isFacility, isRecipe,
  cuisineById, isCuisine, LEISURE_VENUES, LEISURE_IDS, isLeisure, normalizeLeisure, leisureItinerary,
  performerForVenue } from './hotel-content.mjs';
export { guestItinerary } from './hotel-visits.mjs';
export const RUSH_CONFIG = Object.freeze({
  // Longer real stair routes use a brisk walking pace; job/station timers and the 120s economy are unchanged.
  walkSpeed: 1400, stairSpeed: 1000,
  width: 1200, height: 700, fixedStep: 1 / 60, timeLimit: 120,
  startingMoney: 120, openRooms: 3, staffCount: 2, serviceLevel: 0, roomPrice: 40, serviceTip: 10, goal: 8, maxMissed: 3,
  waitingPatience: 50, requestPatience: 40, restDuration: 2,
  washCost: 5, washDuration: 5, washBatch: 3,
  foodCost: 6, foodDuration: 5, foodBatch: 3, foodCapacity: 6,
  thiefAt: 55, thiefApproach: 8, thiefWarning: 6, theftAmount: 20,
  hallwayY: 300, laundry: { x: 360, y: 490 }, kitchen: { x: 860, y: 490 },
  entry: { x: 600, y: 640 }, till: { x: 290, y: 300 },
  thiefEntry: { x: 1185, y: 535 },
  starts: { courier: { x: 420, y: 480 }, mechanic: { x: 720, y: 535 }, helper: { x: 930, y: 570 } },
  arrivalSchedule: [0, 6, 15, 24, 33, 42, 50, 58, 66, 74, 82, 90],
  queue: [ { x: 100, y: 580 }, { x: 270, y: 580 }, { x: 440, y: 580 },
    { x: 610, y: 580 }, { x: 780, y: 580 } ],
  rooms: ROOM_LAYOUT,
});
export const CONFIG = RUSH_CONFIG;
const C = RUSH_CONFIG, STEP = C.fixedStep, EPS = 1e-9;
const REVIEW_BOX = Object.freeze({ x: 430, y: 285 }), REVIEW_STOP = Object.freeze({ x: 420, y: 300 });
const copy = value => JSON.parse(JSON.stringify(value));
const point = p => ({ x: p.x, y: p.y });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const terminal = s => s.status === 'won' || s.status === 'lost';
const sessionRules = s => [3, 4, 5, 6, 7].includes(s.version) && s.config.sessionRules === 1;
const contentRules = s => [4, 5, 6, 7].includes(s.version) && s.config.contentRules === 1;
const cuisineRules = s => [5, 6, 7].includes(s.version) && s.config.cuisineRules === 1;
const leisureRules = s => [6, 7].includes(s.version) && s.config.leisureRules === 1;
const venueIds = s => leisureRules(s) ? [...FACILITY_IDS, ...LEISURE_IDS] : FACILITY_IDS;
const isVenue = (s, id) => isFacility(id) || leisureRules(s) && isLeisure(id);
const venueLevel = (s, id) => isLeisure(id) && leisureRules(s) ? s.config.leisure[id] : s.config.facilities[id];
const itineraryFor = (s, i) => leisureRules(s) ? leisureItinerary(s.config, i) : contentItinerary(s.config, i);
const leisureSpec = (spec, config) => {
  const performer = performerForVenue(spec.id, config.performerLevel);
  return { ...spec, performer: performer.id, performerName: performer.name, performanceDuration: performer.duration };
};
export const INSPECTION_CONFIG = Object.freeze({ startAt: 25, assessmentDuration: .8, recheckDelay: 20, bonus: 10 });
const inspectionChecklist = () => ['clean', 'repair', 'service'].map(id => ({ id, ok: null, count: 0, ids: [] }));
const facilitySpec = (spec, config) => {
  if (spec.id !== 'restaurant' || config.cuisineRules !== 1) return spec;
  const cuisine = cuisineById(config.restaurantCuisine);
  return { ...spec, ...(cuisine ? { name: cuisine.name, activity: cuisine.activity, icon: cuisine.icon } : {}),
    cuisine: cuisine?.id ?? null };
};
const guestsFinished = s => s.guests.every(g => g.status === 'departed' || g.status === 'abandoned' && (!contentRules(s) || g.phase === 'abandoned')
  || s.receptionClosed && g.status === 'pending');
const positive = (value, fallback) => Number.isFinite(value) && value > 0 ? Math.min(value, 3600) : fallback;
const staff = s => [s.actors.courier, s.actors.mechanic, s.actors.helper].filter(Boolean);
const roomById = (s, id) => s.rooms.find(r => r.id === id);
const guestById = (s, id) => s.guests.find(g => g.id === id);
// Runtime associations are deliberately outside snapshots, including legacy actors.
const actorStates = new WeakMap();
const MOTION_HELPER_HOME = Object.freeze({ x: 850, y: 570 });
const homeFor = a => a.id === 'helper' && hasMotionRules(actorStates.get(a)) && actorStates.get(a).config.motionHomeRevision === 1
  ? MOTION_HELPER_HOME : C.starts[a.id];
const routeRevision = s => [2,3].includes(s.config.motionRouteRevision) ? s.config.motionRouteRevision : 1;
const relink = s => { for (const guest of s.guests) s.actors[guest.id] = guest;
  for (const a of Object.values(s.actors)) actorStates.set(a, s); };
const floorSpeed = s => hasMotionRules(s) ? motionSpeed(s).floor : C.walkSpeed;
const actor = (id, name, species, p, visible = true) => ({
  id, name, species, spriteKind: id, ...point(p), visible, path: [], target: null,
  moving: false, facing: 1, action: 'idle', progress: 0, walkTime: 0,
  intent: 'Ready', job: null, carrying: null, returningHome: false, speed: C.walkSpeed,
});

export function createRush(options = {}) {
  return createRushForHome(options, true, options && typeof options === 'object' && Object.getOwnPropertyDescriptor(options,'motionRules')?.value >= 2 ? 3 : 2);
}
// Retry reuses a saved shift's layout policy; only genuinely new v7 shifts opt in.
function createRushForHome(options = {}, newMotionHome = false, motionRouteRevision = 1) {
  options = options && typeof options === 'object' ? options : {};
  const descriptor = Object.getOwnPropertyDescriptor(options, 'motionRules');
  if (descriptor && (descriptor.get || descriptor.set || descriptor.value !== undefined && !validMotionRule(descriptor.value))) throw new TypeError('Unknown motion policy');
  const motion = validMotionRule(descriptor?.value);
  const doors=Object.getOwnPropertyDescriptor(options,'roomDoorXs');
  if(doors&&(!Object.hasOwn(doors,'value')||!motion||!validRoomDoorXs(doors.value)))throw new TypeError('Invalid first-floor door policy');
  if(Object.hasOwn(options,'firstStepsRules')&&(!motion||options.motionRules!==3||options.motionMode!=='relaxed'||![1,2].includes(options.firstStepsRules)))throw new TypeError('Unknown first-stay policy');
  if(Object.hasOwn(options,'coinPickupRules')&&(options.coinPickupRules!==1||!motion||!validDoorCoins(options.pickupCarry)))throw new TypeError('Invalid door-coin policy');
  if(!Object.hasOwn(options,'coinPickupRules')&&Object.hasOwn(options,'pickupCarry'))throw new TypeError('Unbound door coins');
  if(options.staffPlan!==undefined&&!validStaffPlan(options.staffPlan))throw new TypeError('Invalid staff plan');
  if(options.reputationPlan&&(!motion||options.motionRules!==3))throw new TypeError('Unknown newspaper policy');
  const home = Object.getOwnPropertyDescriptor(options,'motionHomeRevision'), routing = Object.getOwnPropertyDescriptor(options,'motionRouteRevision');
  if (motion && (home && (home.get || home.set || home.value !== 1) || routing && (routing.get || routing.set || !(routing.value === 2 || descriptor.value >= 2 && routing.value === 3)))) throw new TypeError('Unknown motion layout policy');
  if (motion && (!validMotionPreset(options) || !validShiftIdentity(options.shiftId) ||
    !['sessionRules', 'contentRules', 'cuisineRules', 'leisureRules'].every(k => options[k] === 1)))
    throw new TypeError('Motion shifts require the exact v7 preset, content gates, and issued shift ID');
  const upgrade = ['linen-shelf', 'quick-wash'].includes(options.upgrade) ? options.upgrade : null;
  const suppliedSchedule = options.arrivalSchedule ?? options.arrivals;
  const boundedInteger = (value, fallback, min, max) => Number.isFinite(value)
    ? Math.max(min, Math.min(max, Math.floor(value))) : fallback;
  const openRooms = boundedInteger(options.openRooms, C.openRooms, 1, 6);
  const staffCount = boundedInteger(options.staffCount, C.staffCount, 2, 3);
  const serviceLevel = boundedInteger(options.serviceLevel, C.serviceLevel, 0, 1);
  const startingMoney = boundedInteger(options.startingMoney, C.startingMoney, 0, Number.MAX_SAFE_INTEGER);
  const arrivalSchedule = Array.isArray(suppliedSchedule)
    ? suppliedSchedule.filter(t => Number.isFinite(t) && t >= 0).slice(0, 100).sort((a, b) => a - b)
    : [...C.arrivalSchedule];
  const config = {
    timeLimit: positive(options.timeLimit, C.timeLimit), arrivalSchedule,
    ...(doors?{roomDoorXs:copyRoomDoorXs(doors.value)}:{}),
    ...(options.coinPickupRules===1?{coinPickupRules:1,pickupCarry:copyDoorCoins(options.pickupCarry)}:{}),
    ...(Object.hasOwn(options,'firstStepsRules')?{firstStepsRules:options.firstStepsRules}:{}),
    ...(options.staffPlan ? {staffPlan:copyStaffPlan(options.staffPlan)} : {}),
    ...(options.reputationPlan ? {reputationPlan:copy(options.reputationPlan)} : {}),
    openRooms, staffCount, serviceLevel, startingMoney, workScale: serviceLevel ? .8 : 1,
    goal: Math.max(1, Math.floor(positive(options.goal, C.goal))),
    maxMissed: Number.isInteger(options.maxMissed) && options.maxMissed >= 0 ? options.maxMissed : C.maxMissed,
    waitingPatience: positive(options.waitingPatience ?? options.patience, C.waitingPatience),
    requestPatience: positive(options.requestPatience ?? options.towelPatience ?? options.patience, C.requestPatience),
    restDuration: positive(options.restDuration, C.restDuration),
    washDuration: positive(options.washDuration, upgrade === 'quick-wash' ? 3 : serviceLevel ? 4 : C.washDuration),
    foodDuration: positive(options.foodDuration, serviceLevel ? 4 : C.foodDuration),
    thief: options.thief !== false && options.noThief !== true,
    thiefAt: Number.isFinite(options.thiefAt) && options.thiefAt >= 0 ? options.thiefAt : C.thiefAt,
  };
  if (motion) Object.assign(config, { motionRules: options.motionRules, motionMode: options.motionMode, ...(newMotionHome ? { motionHomeRevision: 1 } : {}), ...([2,3].includes(motionRouteRevision) ? {motionRouteRevision} : {}) });
  const varied = options.sessionRules === 1, content = varied && options.contentRules === 1;
  const cuisines = content && options.cuisineRules === 1;
  const leisure = cuisines && options.leisureRules === 1;
  if (Object.hasOwn(options,'roomSlots') || Object.hasOwn(options,'constructionRules')) {
    if (!content || options.constructionRules!==1 || !validRoomSlots(options.roomSlots)) throw new TypeError('Invalid room placement');
    config.constructionRules=1;config.roomSlots=[...options.roomSlots];
    config.roomSupplyAtStart=options.roomSupplyAtStart ? copy(options.roomSupplyAtStart) : {openRooms,roomTiers:normalizeRoomTiers(options.roomTiers)};
  }
  if (content) {
    Object.assign(config, { contentRules: 1, roomTiers: normalizeRoomTiers(options.roomTiers), facilities: normalizeFacilities(options.facilities) });
    config.chefLevel = options.chefLevel === 1 && config.facilities.restaurant === 1 ? 1 : 0;
    config.chefBaseFoodDuration = positive(options.chefBaseFoodDuration, config.foodDuration);
    config.foodDuration = config.chefBaseFoodDuration * (config.chefLevel ? .8 : 1);
    if (cuisines) Object.assign(config, { cuisineRules: 1,
      restaurantCuisine: config.facilities.restaurant === 1
        ? (isCuisine(options.restaurantCuisine) ? options.restaurantCuisine : 'ramen') : null });
    if (leisure) {
      const owned = normalizeLeisure(options.leisure);
      // A lounge can only belong to a hotel with an actual restaurant. Cuisine
      // ownership/gates are the profile's job, not the selected menu's job.
      config.leisureRules = 1;
      config.leisure = config.facilities.restaurant ? owned : normalizeLeisure(null);
      config.performerLevel = config.leisure.theater && options.performerLevel === 1 ? 1 : 0;
      config.completedShifts = boundedInteger(options.completedShifts, 0, 0, Number.MAX_SAFE_INTEGER);
    }
  }
  if (varied) Object.assign(config, { sessionRules: 1, visitSeed: normalizeVisitSeed(options.visitSeed) });
  const names = ['Willow', 'Juniper', 'Poppy', 'Clover', 'Hazel', 'Maple', 'Fern', 'Robin', 'Sage', 'Ivy', 'Aspen', 'Wren'];
  const guests = arrivalSchedule.map((arrivalAt, i) => ({
    ...actor(`guest-${i + 1}`, names[i % names.length], 'rabbit', C.entry, false),
    spriteKind: 'guest', arrivalAt, ...(motion && options.motionRules === 3 && options.motionMode === 'relaxed' ? {admittedAt:null} : {}), queueSlot: null, status: 'pending', phase: 'pending',
    request: null, roomId: null,
    ...(varied ? { itinerary: [...(leisure ? leisureItinerary(config, i) : content ? contentItinerary(config, i) : visitItinerary(config.visitSeed, i))] } : {}),
    ...(content ? { ...guestContent(config, i), roomProof: null, serviceProof: [], deliveredRecipes: [], facilityVisits: [], review: null, reviewDropped: false } : {}),
    requiresRepair: varied ? (leisure ? leisureItinerary(config, i) : content ? contentItinerary(config, i) : visitItinerary(config.visitSeed, i)).includes('repair') : (i + 1) % 3 === 0,
    needsRepair: varied ? (leisure ? leisureItinerary(config, i) : content ? contentItinerary(config, i) : visitItinerary(config.visitSeed, i)).includes('repair') : (i + 1) % 3 === 0, requestIndex: 0,
    served: false, departed: false, abandoned: false, resolved: false, escorted: false,
    paid: false, payment: 0, waitElapsed: 0, roomElapsed: 0,
    patience: config.waitingPatience, maxPatience: config.waitingPatience,
    restRemaining: 0, nextRequest: null, checkoutRemaining: 0,
    towelsReceived: 0, mealsReceived: 0, repairsReceived: 0, tipEligible: true,
    intent: 'Arriving later', speed: C.walkSpeed,
  }));
  const s = {
    version: motion ? 7 : leisure ? 6 : cuisines ? 5 : content ? 4 : varied ? 3 : 2, layoutVersion: 2, mode: 'rush', status: options.paused === true ? 'paused' : 'playing',
    ...(motion ? { shiftId: options.shiftId } : {}),
    ...(options.coinPickupRules===1?{coinPickups:{version:1,collectedGuests:[],collectedCarry:[]}}:{}),
    ...(varied ? { receptionClosed: false, receptionClosedAt: null } : {}),
    paused: options.paused === true, time: 0, timeLimit: config.timeLimit,
    remaining: config.timeLimit, ticks: 0, accumulator: 0, config, upgrade,
    settings: copy(options.settings || {}), openRooms, staffCount, serviceLevel,
    money: startingMoney, startingMoney, earnings: 0, costs: 0, stolen: 0, tips: 0,
    arrived: 0, completed: 0, missed: 0, abandoned: 0, served: 0,
    goal: config.goal, maxMissed: config.maxMissed, totalGuests: guests.length, result: null,
    rooms: C.rooms.map((r, i) => ({ ...r, ...(config.roomSlots ? {x:C.rooms[config.roomSlots[i]].x,y:C.rooms[config.roomSlots[i]].y,floor:C.rooms[config.roomSlots[i]].floor} : {}), ...(config.roomDoorXs&&C.rooms[config.roomSlots?.[i]??i].floor===1?{x:config.roomDoorXs[(config.roomSlots?.[i]??i)%3]}:{}), ...(content ? { tier: config.roomTiers[i], capacity: roomCapacity(config.roomTiers[i]) } : {}), status: i < openRooms ? 'available' : 'locked', guestId: null, guestName: null,
      request: null, activeRequest: null, patience: 0, maxPatience: config.requestPatience,
      towelUsed: false, progress: 0, restRemaining: 0, workerId: null })),
    guests,
    laundry: { ...point(C.laundry), clean: upgrade === 'linen-shelf' ? 4 : 3, dirty: 3, batch: 0,
      status: 'idle', loading: false, progress: 0, remaining: 0, duration: config.washDuration,
      cost: C.washCost, batchSize: C.washBatch, workerId: null },
    kitchen: { ...point(C.kitchen), meals: 1, batch: 0, capacity: C.foodCapacity,
      status: 'idle', progress: 0, remaining: 0, duration: config.foodDuration,
      cost: C.foodCost, batchSize: C.foodBatch, prepared: 1, served: 0,
      ...(content ? { recipes: ['garden'], batchRecipe: null, recipePrepared: { garden: 1, tea: 0, pancake: 0 } } : {}) },
    ...(content ? { facilities: Object.fromEntries([...FACILITIES, ...(leisure ? LEISURE_VENUES : [])].map(f => {
      const level = isLeisure(f.id) ? config.leisure[f.id] : config.facilities[f.id];
      return [f.id, { ...(isLeisure(f.id) ? leisureSpec(f, config) : facilitySpec(f, config)), level,
        status: level ? 'idle' : 'locked', guestId: null, roomId: null, workerId: null, timer: 0 }];
    })) } : {}),
    ...(leisure ? { inspection: { eligible: !config.firstStepsRules && !config.reputationPlan?.critic && config.completedShifts >= 2 && config.completedShifts % 3 === 2,
      phase: 'dormant', roomId: null, startedAt: null, assessments: [], checklist: inspectionChecklist(),
      recheckAt: null, outcome: null, bonus: 0, timer: 0 } } : {}),
    actors: {
      courier: actor('courier', 'Pip', 'fox', C.starts.courier),
      mechanic: actor('mechanic', 'Bramble', 'badger', C.starts.mechanic),
      thief: { ...actor('thief', 'Rook', 'raccoon', C.thiefEntry, false),
        phase: 'dormant', status: 'dormant', timer: 0, remaining: 0,
        resolved: false, stopped: false, outcome: null, intercepted: false, intent: 'No trouble' },
      ...(leisure ? { inspector: { ...actor('inspector', 'Olive', 'owl', C.entry, false),
        phase: 'dormant', status: 'dormant', intent: 'A friendly visit later' } } : {}),
    },
    objects: {
      cart: { x: 650, y: 440, bay: 'laundry', moving: false,
        armed: false, carrying: null, spent: false, carrier: null, progress: 0, hit: [] },
      bell: { x: 245, y: 300, active: false, remaining: 0, cooldown: 0, carrier: null },
      sprinkler: { x: 965, y: 515, active: false, wetness: 0, zone: { x: 850, y: 440, radius: 95 } },
    },
    events: [], eventId: 0, lastFeedback: 'Choose a guest, then a room.',
  };
  if (staffCount === 3) s.actors.helper = { ...actor('helper', 'Rue', 'fox', motion && newMotionHome ? MOTION_HELPER_HOME : C.starts.helper), spriteKind: 'courier' };
  for (const a of staff(s)) a.workScale = config.workScale;
  if (motion) for (const a of [...Object.values(s.actors), ...s.guests]) a.speed = motionSpeed(s).floor;
  if(config.staffPlan)initializeStaffState(s,config.staffPlan);
  if(config.reputationPlan)initializeReputationState(s,config.reputationPlan);
  relink(s); updateArrivals(s);
  return s;
}

function log(s, type, text, at, short = text) {
  s.events.push({ id: ++s.eventId, time: s.time, type, text, ...(at ? point(at) : {}), short });
  if (s.events.length > 120) s.events.shift();
}
function reply(s, ok, message, workerId = null) {
  s.lastFeedback = message; return { ok, message, ...(workerId ? { workerId } : {}) };
}
function route(a, points, intent) {
  a.path = points.map(point).filter((p, i, all) => distance(p, i ? all[i - 1] : a) > .01);
  a.target = a.path[0] || null; a.progress = 0; a.moving = false;
  if (intent) a.intent = intent;
}
const hallway = (a, destination) => hasMotionRules(actorStates.get(a)) ? conservativeFloorRoute(a, destination,routeRevision(actorStates.get(a))) : floorRoute(a, destination);
function walk(a, dt) {
  let budget = dt, moved = 0, walkingTime = 0;
  while (a.path.length && budget > EPS) {
    const p = a.path[0], d = distance(a, p);
    if (d <= EPS) { a.x = p.x; a.y = p.y; a.path.shift(); continue; }
    const onStairs = stairAt({ x: (a.x + p.x) / 2, y: (a.y + p.y) / 2 });
    const speed = onStairs ? Math.min(a.speed, hasMotionRules(actorStates.get(a)) ? motionSpeed(actorStates.get(a)).stairs : C.stairSpeed) : a.speed;
    const amount = Math.min(d, budget * speed), dx = p.x - a.x;
    if (Math.abs(dx) > .1) a.facing = dx < 0 ? -1 : 1;
    a.x += dx / d * amount; a.y += (p.y - a.y) / d * amount;
    budget -= amount / speed; walkingTime += amount / speed; moved += amount;
    if (amount + EPS >= d) { a.x = p.x; a.y = p.y; a.path.shift(); }
  }
  a.target = a.path[0] || null; a.moving = moved > EPS;
  if (a.moving) { a.action = 'walking'; a.walkTime += walkingTime; }
  return a.path.length === 0;
}
function release(a) {
  a.job = null; a.carrying = null; a.progress = 0; a.action = 'idle'; a.moving = false;
  a.path = []; a.target = null; a.intent = 'Ready';
  const home = homeFor(a);
  a.returningHome = distance(a, home) > .01;
  if (a.returningHome) route(a, hallway(a, home), 'Ready for another task');
}
function start(a, job, points) {
  a.returningHome = false; a.job = { ...job, work: 0 }; a.action = 'walking';
  route(a, points, job.label);
}
function work(a, dt, duration, action = 'working') {
  duration *= a.workScale || 1;
  a.moving = false; a.action = action; a.job.work += dt;
  a.progress = Math.min(1, a.job.work / duration);
  return a.job.work + EPS >= duration;
}
function chooseWorker(s, type, workerId) {
  if(workerId!==undefined)return staff(s).find(a=>a.id===workerId&&!a.job)||null;
  const preference = ['cleanRoom', 'repairRoom', 'loadWash', 'finishFold'].includes(type)
    ? ['mechanic', 'courier', 'helper'] : ['courier', 'mechanic', 'helper'];
  return preference.map(id => s.actors[id]).find(a => a && !a.job) || null;
}
function stateReason(s) {
  if (terminal(s)) return 'Shift finished. Try again.';
  if (s.paused || s.status !== 'playing') return 'Paused. Resume first.';
  if(hasCoinPickups(s)&&(s.missed>s.maxMissed||!isCalmShift(s)&&s.remaining<=EPS))return 'Finishing guest departures. Collect their coins at the room doors.';
  return '';
}
function invalidReason(s, input) {
  const guard = stateReason(s); if (guard) return guard;
  const r = roomById(s, input.roomId), g = guestById(s, input.guestId), l = s.laundry, k = s.kitchen;
  const busy = () => chooseWorker(s, input.type, input.workerId) ? '' : 'All staff are busy.';
  switch (input.type) {
    case 'closeReception':
      if (!sessionRules(s)) return 'This saved shift keeps its original reception rules.';
      if (s.receptionClosed) return 'Reception is already closed.';
      if (s.completed < s.goal) return `Welcome ${s.goal - s.completed} more happy guests before closing reception.`;
      return '';
    case 'assignRoom':
      if (!g || g.status !== 'waiting') return 'Choose a waiting guest.';
      if (!r || r.status !== 'available') return 'Choose a clean, empty room.';
      if(pestBlocksRoom(s,r.id))return 'Help the little visitor first; this room will reopen.';
      if (contentRules(s) && !roomMatchesGuest(g, r)) return 'This family needs a family room.';
      return busy();
    case 'deliverTowel':
      if (!r || r.status !== 'occupied' || r.request !== 'towel') return 'No towel request here.';
      if (l.clean < 1) return 'No towels. Wash, then fold.';
      return busy();
    case 'deliverMeal':
      if (!r || r.status !== 'occupied' || r.request !== 'meal') return 'No meal request here.';
      if (k.meals < 1) return 'No meals. Start the kitchen.';
      return busy();
    case 'repairRoom':
      if (!r || r.status !== 'occupied' || r.request !== 'repair') return 'No repair needed here.';
      return busy();
    case 'cleanRoom':
      if (!r || r.status !== 'dirty') return 'Choose a dirty room.';
      return busy();
    case 'loadWash':
      if (l.status !== 'idle') return l.status === 'ready' ? 'Fold this batch first.' : 'Laundry is busy.';
      if (l.dirty < 1) return 'No dirty towels. Clean a used room.';
      if (s.money < C.washCost) return 'Need 5 coins for laundry.';
      return busy();
    case 'finishFold':
      if (l.status !== 'ready' || l.batch < 1) return 'Wash is not ready to fold.';
      return '';
    case 'visitFacility': {
      if (!contentRules(s) || !isVenue(s, input.facilityId) || venueLevel(s, input.facilityId) !== 1) return 'Unlock this facility first.';
      const facility = s.facilities[input.facilityId];
      if (!r || r.status !== 'occupied' || r.request !== input.facilityId) return 'No matching facility request here.';
      if (facility.status !== 'idle') return 'This facility is busy.';
      return busy();
    }
    case 'serveFacility': {
      if (!contentRules(s) || !isVenue(s, input.facilityId) || venueLevel(s, input.facilityId) !== 1) return 'Unlock this facility first.';
      return s.facilities[input.facilityId].status === 'waiting' ? '' : 'Escort a guest here first.';
    }
    case 'prepFood':
      if (contentRules(s) && input.recipe !== undefined && !isRecipe(input.recipe)) return 'Choose a known recipe.';
      if (k.status !== 'idle') return 'Kitchen is already cooking.';
      if (k.meals + C.foodBatch > k.capacity) return 'Kitchen is full. Deliver meals first.';
      if (s.money < C.foodCost) return 'Need 6 coins for meals.';
      return '';
    case 'callOutThief':
      return s.actors.thief.visible && !s.actors.thief.resolved && ['approaching', 'stealing'].includes(s.actors.thief.phase)
        ? '' : 'No thief to stop.';
    default: return 'Choose a guest, room, or station.';
  }
}
/** Read-only validation, including the worker the action would use. */
export function canRushCommand(s, input = {}) {
  if (!s || !Array.isArray(s.guests) || !s.actors) return { ok: false, message: 'No shift loaded.' };
  input = input && typeof input === 'object' ? input : {};
  if (['retry', 'reset'].includes(input.type)) return hasCoinPickups(s)?{ok:false,message:'Keep guest coins safe: finish this stay, then start the next shift.'}:s.reputation&&s.ticks>0?{ok:false,message:'Finish this shift first. Posted press reports cannot be erased by retrying.'}:{ ok: true, message: '' };
  if(input.type==='pestCare')return {ok:!stateReason(s)&&['noticed','prepared'].includes(s.reputation?.pest?.phase),message:stateReason(s)||'No room needs pest care.'};
  if (terminal(s)) return { ok: false, message: stateReason(s) };
  if (['pause', 'resume', 'play', 'start'].includes(input.type)) return { ok: true, message: '' };
  const message = invalidReason(s, input);
  const workerId = !message && !['prepFood', 'finishFold', 'callOutThief', 'closeReception', 'serveFacility'].includes(input.type) ? chooseWorker(s, input.type, input.workerId)?.id : null;
  return { ok: !message, message, ...(workerId ? { workerId } : {}) };
}

/** Commands mutate state atomically and never advance time. */
export function rushCommand(s, input = {}) {
  const validation = canRushCommand(s, input);
  if (!s || !Array.isArray(s.guests)) return validation;
  input = input && typeof input === 'object' ? input : {};
  // Closing is idempotent even in its feedback: a rejected/repeated click must
  // not change a checkpoint, a reservation, a receipt or the current message.
  if (!validation.ok) return input.type === 'closeReception'||hasCoinPickups(s)&&['retry','reset'].includes(input.type) ? validation : reply(s, false, validation.message);
  if(input.type==='pestCare'){const result=handlePest(s);return reply(s,result.ok,result.message);}
  if (input.type === 'retry' || input.type === 'reset') {
    const fresh = createRushForHome({ ...s.config, motionRules: hasMotionRules(s) ? s.config.motionRules : undefined, ...(hasMotionRules(s) ? { shiftId: s.shiftId } : {}), cuisineRules: cuisineRules(s) ? 1 : undefined, leisureRules: leisureRules(s) ? 1 : undefined, upgrade: s.upgrade, settings: s.settings }, s.config.motionHomeRevision === 1,routeRevision(s));
    for (const key of Object.keys(s)) delete s[key]; Object.assign(s, fresh);
    return reply(s, true, 'Fresh shift. Choose a guest, then a room.');
  }
  if (input.type === 'pause') { s.paused = true; s.status = 'paused'; return reply(s, true, 'Paused.'); }
  if (['resume', 'play', 'start'].includes(input.type)) { s.paused = false; s.status = 'playing'; return reply(s, true, 'Hotel open!'); }
  relink(s);
  const a = validation.workerId ? s.actors[validation.workerId] : null;
  const r = roomById(s, input.roomId), g = guestById(s, input.guestId), l = s.laundry, k = s.kitchen;
  let message, at = r || l;
  switch (input.type) {
    case 'closeReception':
      s.receptionClosed = true; s.receptionClosedAt = s.time;
      message = 'Reception closed. Finish the guests already here.'; at = C.till; break;
    case 'assignRoom':
      r.status = 'checking-in'; r.guestId = g.id; r.guestName = g.name; r.workerId = a.id;
      g.status = g.phase = 'checking-in'; g.roomId = r.id; g.request = null; g.queueSlot = null;
      g.escorted = true; g.intent = `Following ${a.name}`;
      start(a, { type: input.type, phase: 'meet', roomId: r.id, guestId: g.id, label: `Check in ${g.name}` },
        hallway(a, { x: g.x - 60, y: g.y + 20 }));
      message = `${a.name}: check-in`; break;
    case 'deliverTowel':
    case 'deliverMeal': {
      const towel = input.type === 'deliverTowel', station = towel ? l : k;
      let reservedRecipe;
      if (towel) l.clean -= 1; else {
        k.meals -= 1;
        if (contentRules(s)) {
          const favorite = guestById(s, r.guestId).preferredRecipe, preferred = k.recipes.indexOf(favorite);
          reservedRecipe = k.recipes.splice(preferred < 0 ? 0 : preferred, 1)[0];
        }
      }
      r.activeRequest = r.request; r.request = 'delivering'; r.workerId = a.id;
      guestById(s, r.guestId).request = 'delivering';
      start(a, { type: input.type, phase: 'fetch', roomId: r.id, guestId: r.guestId,
        label: towel ? 'Bring towel' : 'Bring meal', reservedTowel: towel, reservedMeal: !towel,
        ...(contentRules(s) && !towel ? { reservedRecipe } : {}) }, hallway(a, station));
      message = `${a.name}: ${towel ? 'towel' : 'meal'} reserved`; break;
    }
    case 'repairRoom':
      r.activeRequest = 'repair'; r.request = 'repairing'; r.workerId = a.id;
      guestById(s, r.guestId).request = 'repairing';
      start(a, { type: input.type, phase: 'room', roomId: r.id, guestId: r.guestId, label: 'Repair room' }, hallway(a, r));
      a.carrying = 'wrench'; message = `${a.name}: repair`; break;
    case 'cleanRoom':
      r.status = 'cleaning'; r.progress = 0; r.workerId = a.id;
      start(a, { type: input.type, phase: 'room', roomId: r.id, label: 'Clean room',
        dirtyTowels: r.towelUsed ? 1 : 0 }, hallway(a, r));
      a.carrying = 'broom'; message = `${a.name}: cleaning`; break;
    case 'loadWash':
      l.batch = Math.min(C.washBatch, l.dirty); l.dirty -= l.batch;
      l.status = 'washing'; l.loading = true; l.progress = 0; l.remaining = l.duration; l.workerId = a.id;
      s.money -= C.washCost; s.costs += C.washCost;
      start(a, { type: input.type, phase: 'load', label: 'Load laundry' }, hallway(a, l));
      message = `${a.name}: wash ${l.batch} towels`; break;
    case 'finishFold': {
      const count = l.batch; l.clean += count; l.batch = 0;
      l.status = 'idle'; l.loading = false; l.remaining = 0; l.progress = 0; l.workerId = null;
      message = `${count} clean towels ready`;
      learnStaffRoutine(s,'fold');
      log(s, 'folded', message, l, `+${count} towels`); break;
    }
    case 'visitFacility': {
      const facility = s.facilities[input.facilityId], guest = guestById(s, r.guestId);
      facility.status = 'escorting'; facility.guestId = guest.id; facility.roomId = r.id; facility.workerId = a.id; facility.timer = guest.roomElapsed;
      r.activeRequest = input.facilityId; r.request = guest.request = 'visiting'; r.workerId = a.id;
      start(a, { type: 'visitFacility', phase: 'meet', roomId: r.id, guestId: guest.id, facilityId: input.facilityId, label: `Visit ${facility.name}` }, hallway(a, r));
      message = `${a.name}: escort to ${facility.name}`; at = facility; break;
    }
    case 'serveFacility': {
      const facility = s.facilities[input.facilityId], worker = s.actors[facility.workerId];
      facility.status = 'servicing'; worker.job.phase = 'service'; worker.job.work = 0;
      message = `${facility.name}: service started`; at = facility; break;
    }
    case 'prepFood':
      if (contentRules(s)) k.batchRecipe = input.recipe ?? 'garden';
      k.status = 'cooking'; k.batch = C.foodBatch; k.progress = 0; k.remaining = k.duration;
      s.money -= C.foodCost; s.costs += C.foodCost;
      message = 'Cooking 3 meals'; at = k; break;
    case 'callOutThief':
      sendThiefAway(s, true); message = 'Till saved!'; at = s.actors.thief; break;
  }
  log(s, input.type === 'callOutThief' ? 'shooed' : 'order', message, at,
    input.type === 'callOutThief' ? 'Till saved!' : '');
  return reply(s, true, message, a?.id);
}

function updateArrivals(s) {
  if (sessionRules(s) && s.receptionClosed) return;
  for (const g of s.guests) {
    if (g.status !== 'pending' || !isCalmShift(s) && g.arrivalAt > s.time + EPS) continue;
    if (isCalmShift(s)) {
      const active=s.guests.filter(other=>!['pending','departed','abandoned'].includes(other.status));
      const last=Math.max(-30,...s.guests.filter(other=>other.admittedAt!==null).map(other=>other.admittedAt));
      const waitingTask=s.rooms.some(r=>r.status==='occupied' && !['rest','delivering','repairing'].includes(r.request));
      const incident=['approaching','stealing'].includes(s.actors.thief.phase);
      if(active.length>=2 || active.some(other=>other.status==='waiting') || waitingTask || incident || s.time-last<(active.length?30:8)-EPS) break;
      g.admittedAt=s.time;
    }
    s.arrived += 1;
    const occupied = new Set(s.guests.filter(other => other.status === 'waiting').map(other => other.queueSlot));
    const slot = C.queue.findIndex((_, i) => !occupied.has(i));
    if (slot < 0) { abandon(s, g, 'Lobby full'); continue; }
    g.queueSlot = slot; Object.assign(g, point(C.queue[slot]));
    g.visible = true; g.status = g.phase = 'waiting'; g.request = 'room'; g.intent = 'Choose an empty room';
    log(s, 'arrival', `${g.name} needs a room`, g, '+ guest');
  }
}
function request(s, room, guest, kind) {
  room.request = guest.request = kind; room.activeRequest = null; room.workerId = null; room.progress = 0;
  room.patience = guest.patience = s.config.requestPatience;
  room.maxPatience = guest.maxPatience = s.config.requestPatience;
  room.restRemaining = guest.restRemaining = 0; guest.roomElapsed = 0; guest.nextRequest = null;
  guest.status = 'occupied'; guest.phase = 'settled'; guest.intent = `${kind} please`;
  guest.requestIndex = sessionRules(s) ? guest.itinerary.indexOf(kind) : { towel: 0, meal: 1, repair: 2 }[kind];
  log(s, 'request', `${guest.name}: ${kind}`, room, kind === 'repair' ? 'Repair!' : `${kind} please`);
}
function rest(s, room, guest, next) {
  room.request = guest.request = 'rest'; room.activeRequest = null; room.workerId = null; room.progress = 0;
  room.patience = guest.patience = 0;
  room.restRemaining = guest.restRemaining = s.config.restDuration; guest.nextRequest = next;
  guest.requestIndex = sessionRules(s) ? guest.itinerary.indexOf(next) : next === 'meal' ? 1 : 2;
}
function serve(s, room, guest) {
  room.request = guest.request = null; room.activeRequest = null; room.workerId = null; room.progress = 0;
  room.patience = guest.patience = 0; guest.served = true; s.served += 1;
  guest.requestIndex = sessionRules(s) ? guest.itinerary.length : guest.requiresRepair ? 3 : 2;
  guest.status = guest.phase = 'served'; guest.checkoutRemaining = .4; guest.intent = 'Happy stay!';
  log(s, 'service', `${guest.name} is happy`, room, '♥');
}
function finishService(s, room, guest, kind) {
  learnStaffRoutine(s,kind);
  if (contentRules(s)) guest.serviceProof.push({ kind, completedAt: s.time,
    ...(kind === 'meal' ? { recipe: guest.deliveredRecipes.at(-1) } : {}),
    ...(cuisineRules(s) && kind === 'restaurant' ? { cuisine: s.config.restaurantCuisine } : {}),
    ...(leisureRules(s) && isLeisure(kind) ? { performer: performerForVenue(kind, s.config.performerLevel).id } : {}) });
  // Even permissively accepted old checkpoints retain their original behavior:
  // legacy service transitions did not consult the saved requestIndex.
  if (!sessionRules(s)) {
    if (kind === 'towel') rest(s, room, guest, 'meal');
    else if (kind === 'meal' && guest.requiresRepair) rest(s, room, guest, 'repair');
    else serve(s, room, guest);
    return;
  }
  const next = guest.itinerary[guest.requestIndex + 1];
  if (next) rest(s, room, guest, next); else serve(s, room, guest);
}
function updateStaff(s, a, dt) {
  const j = a.job;
  if (!j) {
    if (a.returningHome && walk(a, dt)) { a.returningHome = false; a.moving = false; a.action = 'idle'; a.intent = 'Ready'; }
    else if (!a.returningHome) a.moving = false;
    return;
  }
  const r = roomById(s, j.roomId), g = guestById(s, j.guestId);
  if (j.type === 'assignRoom') {
    if (j.phase === 'meet') {
      if (!walk(a, dt)) return;
      j.phase = 'reception';
      if (hasMotionRules(s)) beginEscort(a, g, C.till, { x: C.till.x + 40, y: C.till.y + 20 },routeRevision(s));
      else { route(a, hallway(a, { x: C.till.x + 40, y: C.till.y + 20 }), 'Welcome at reception');
        route(g, hallway(g, C.till), 'Checking in at reception'); } return;
    }
    if (j.phase === 'reception') {
      if (hasMotionRules(s)) { if (!stepEscort(a, g, dt, motionSpeed(s))) return; delete j.escort; }
      else { const staffArrived = walk(a, dt), guestArrived = walk(g, dt);
        if (!staffArrived || !guestArrived) return; }
      j.phase = 'register'; j.work = 0; g.moving = false; g.action = 'idle';
    }
    if (j.phase === 'register') {
      if (!work(a, dt, .2, 'guiding')) return;
      j.phase = 'guide'; j.work = 0;
      if (hasMotionRules(s)) beginEscort(a, g, r, { x: r.x + 90, y: r.y + 25 },routeRevision(s));
      else { route(a, hallway(a, { x: r.x + 90, y: r.y + 25 }), j.label);
        route(g, hallway(g, r), `Following ${a.name}`); } return;
    }
    if (j.phase === 'guide') {
      if (hasMotionRules(s)) { if (!stepEscort(a, g, dt, motionSpeed(s))) return; delete j.escort; }
      else { const staffArrived = walk(a, dt), guestArrived = walk(g, dt);
        if (!staffArrived || !guestArrived) return; }
      j.phase = 'welcome'; j.work = 0; g.moving = false; g.action = 'idle';
    }
    if (work(a, dt, .35, 'guiding')) {
      recordCleanAdmission(s,g,r);learnStaffRoutine(s,'welcome');
      r.status = 'occupied'; g.visible = false;
      if (contentRules(s)) g.roomProof = { roomId: r.id, tier: r.tier, capacity: r.capacity, checkedInAt: s.time };
      request(s, r, g, sessionRules(s) ? g.itinerary[0] : 'towel'); release(a);
    }
  } else if (j.type === 'deliverTowel' || j.type === 'deliverMeal') {
    const towel = j.type === 'deliverTowel';
    if (j.phase === 'fetch') {
      if (!walk(a, dt)) return;
      j.phase = 'pickup'; j.work = 0;
    }
    if (j.phase === 'pickup') {
      if (!work(a, dt, .2, 'collecting')) return;
      a.carrying = towel ? 'linen' : 'meal'; j.phase = 'deliver'; j.work = 0;
      route(a, hallway(a, { x: r.x + 25, y: r.y + 18 }), j.label); return;
    }
    if (j.phase === 'deliver') {
      if (!walk(a, dt)) return;
      j.phase = 'give'; j.work = 0;
    }
    if (work(a, dt, .45, 'placing')) {
      if (towel) {
        j.reservedTowel = false; r.towelUsed = true; g.towelsReceived += 1;
        log(s, 'towel', `${g.name} got a towel`, r, 'Towel delivered'); finishService(s, r, g, 'towel');
      } else {
        j.reservedMeal = false; g.mealsReceived += 1; s.kitchen.served += 1;
        if (contentRules(s)) { g.deliveredRecipes.push(j.reservedRecipe); j.reservedRecipe = null; }
        log(s, 'meal', `${g.name} got a meal`, r, 'Meal delivered');
        finishService(s, r, g, 'meal');
      }
      release(a);
    }
  } else if (j.type === 'visitFacility') {
    const facility = s.facilities[j.facilityId];
    if (j.phase === 'meet') {
      if (!walk(a, dt)) return;
      g.visible = true; j.phase = 'escort';
      if (hasMotionRules(s)) beginEscort(a, g, facility, { x: facility.x + 55, y: facility.y + 20 },routeRevision(s));
      else { route(a, hallway(a, { x: facility.x + 55, y: facility.y + 20 }), j.label);
        route(g, hallway(g, facility), `Following ${a.name}`); } return;
    }
    if (j.phase === 'escort') {
      if (hasMotionRules(s)) { if (!stepEscort(a, g, dt, motionSpeed(s))) return; delete j.escort; }
      else { const staffArrived = walk(a, dt), guestArrived = walk(g, dt);
        if (!staffArrived || !guestArrived) return; }
      j.phase = 'waiting'; facility.status = 'waiting';
      a.moving = g.moving = false; a.action = g.action = 'idle';
      a.intent = g.intent = `Ready for ${facility.name}`;
      log(s, 'facility-ready', `${g.name} is ready at ${facility.name}`, facility, 'Ready!'); return;
    }
    if (j.phase === 'waiting') return;
    if (j.phase === 'service') {
      if (leisureRules(s) && isLeisure(j.facilityId)) { g.action = 'watching'; g.intent = `${facility.performerName} is performing`; }
      if (!work(a, dt, leisureRules(s) && isLeisure(j.facilityId) ? facility.performanceDuration : .6,
        leisureRules(s) && isLeisure(j.facilityId) ? 'performing' : 'serving')) return;
      j.phase = 'return'; facility.status = 'returning';
      if (hasMotionRules(s)) beginEscort(a, g, r, { x: r.x + 55, y: r.y + 20 },routeRevision(s));
      else { route(a, hallway(a, { x: r.x + 55, y: r.y + 20 }), 'Escort back to room');
        route(g, hallway(g, r), `Following ${a.name}`); } return;
    }
    if (j.phase === 'return') {
      if (hasMotionRules(s)) { if (!stepEscort(a, g, dt, motionSpeed(s))) return; delete j.escort; }
      else { const staffArrived = walk(a, dt), guestArrived = walk(g, dt);
        if (!staffArrived || !guestArrived) return; }
      g.visible = false; g.moving = false; g.action = 'idle';
      g.facilityVisits.push(j.facilityId);
      log(s, 'facility-service', `${g.name} enjoyed ${facility.name}`, facility, 'Enjoyed!');
      clearFacility(facility); finishService(s, r, g, j.facilityId); release(a);
    }
  } else if (j.type === 'repairRoom') {
    if (j.phase === 'room') { if (!walk(a, dt)) return; j.phase = 'fix'; j.work = 0; }
    r.progress = Math.min(1, (j.work + dt) / (1.2 * s.config.workScale));
    if (work(a, dt, 1.2)) {
      g.repairsReceived += 1; log(s, 'repaired', `${r.name} repaired`, r, 'Fixed!'); finishService(s, r, g, 'repair'); release(a);
    }
  } else if (j.type === 'cleanRoom') {
    if (j.phase === 'room') { if (!walk(a, dt)) return; j.phase = 'tidy'; j.work = 0; }
    if (j.phase === 'tidy') {
      r.progress = Math.min(1, (j.work + dt) / (.9 * s.config.workScale));
      if (!work(a, dt, .9)) return;
      r.status = 'available'; r.guestId = null; r.guestName = null; r.request = null; r.activeRequest = null;
      r.towelUsed = false; r.progress = 0; r.workerId = null; r.patience = 0; r.restRemaining = 0;
      a.carrying = j.dirtyTowels ? 'dirty-linen' : null; j.phase = 'return'; j.work = 0;
      route(a, hallway(a, s.laundry), 'Return used towels');
      learnStaffRoutine(s,'clean');
      log(s, 'cleaned', `${r.name} ready`, r, 'Room ready'); return;
    }
    if (j.phase === 'return') {
      if (!walk(a, dt)) return; j.phase = 'unload'; j.work = 0;
    }
    if (j.phase === 'unload' && work(a, dt, .2, 'placing')) {
      const returned = j.dirtyTowels; s.laundry.dirty += returned; j.dirtyTowels = 0;
      if (!sessionRules(s) || returned) log(s, 'laundry', 'Used towel returned', s.laundry, '+ dirty');
      release(a);
    }
  } else if (j.type === 'loadWash') {
    if (j.phase === 'load') { if (!walk(a, dt)) return; j.phase = 'place'; j.work = 0; }
    if (work(a, dt, .4, 'placing')) {
      s.laundry.loading = false; s.laundry.workerId = null;
      log(s, 'washing', 'Wash running', s.laundry, 'Washing'); release(a);
    }

  }
}
function beginCheckout(s, g) {
  const r = roomById(s, g.roomId);
  r.status = 'dirty'; r.request = null; r.activeRequest = null; r.patience = 0; r.progress = 0;
  g.status = 'leaving'; g.phase = 'checkout'; g.visible = true; g.request = null; g.intent = 'Pay at reception';
  g.resolved = true; g.speed = floorSpeed(s);
  route(g, hallway(g, C.till));
}
export function guestPayment(s, g) {
  const base = contentRules(s) ? contentPayment(g) : C.roomPrice + (g.tipEligible ? C.serviceTip : 0);
  return hasMotionRules(s) ? motionReceipt(base, s.config.motionMode, s.config.motionRules) : base;
}
const safeAdd = (...values) => values.every(Number.isSafeInteger) && Number.isSafeInteger(values.reduce((a, b) => a + b, 0));
function payAtReception(s, g) {
  // Legacy checkpoints may already contain paid guests on their exit route.
  if (g.paid) return true;
  const tip = g.tipEligible ? C.serviceTip : 0;
  const payment = guestPayment(s, g);
  if (hasMotionRules(s) && (!canBookDoorReceipt(s,payment,1) || !safeAdd(s.money, payment) || !safeAdd(s.earnings, payment) ||
    !safeAdd(s.tips, tip) || !safeAdd(s.completed, 1))) {
    s.lastFeedback = 'The hotel bank is full. This guest has not been charged.'; return false;
  }
  g.payment = payment; g.paid = true;
  if(!hasCoinPickups(s))s.money += g.payment; s.earnings += g.payment; s.tips += tip; s.completed += 1;
  log(s, 'checkout', hasCoinPickups(s)?`${g.name} checked out; ${g.payment} coins will wait at the room door.`:`${g.name} happy: +${g.payment}`, C.till, hasCoinPickups(s)?'Thank you!':`+${g.payment} · ♥`);
  return true;
}
function dropReview(s, g) {
  g.reviewDropped = true; g.review = deriveGuestReview(g);
  log(s, 'review', `${g.name}: ${g.review.stars} stars. ${g.review.phrase}`, REVIEW_BOX, `${g.review.stars} stars`);
}
function clearFacility(facility) {
  facility.status = facility.level ? 'idle' : 'locked';
  facility.guestId = facility.roomId = facility.workerId = null; facility.timer = 0;
}
function abandon(s, g, why = 'Wait too long') {
  if (g.resolved) return;
  const r = roomById(s, g.roomId);
  if (contentRules(s)) for (const facility of Object.values(s.facilities)) if (facility.guestId === g.id) {
    const worker = s.actors[facility.workerId];
    if (worker?.job?.type === 'visitFacility') release(worker);
    clearFacility(facility);
  }
  g.abandoned = true; g.status = g.phase = 'abandoned'; g.request = null;
  g.resolved = true; g.visible = false; g.moving = false; g.path = []; g.target = null;
  g.patience = 0; g.queueSlot = null; g.intent = why;
  if (contentRules(s)) {
    g.nextRequest = null; g.restRemaining = 0; g.review = null;
    // A complaint is evidence only after the same physical box gesture as a
    // happy review. The normal shift deadline/miss limit can end this trip
    // first; an unposted complaint then stays null, never an invented review.
    if (g.roomProof && g.serviceProof.length) {
      g.visible = true; g.phase = 'complaint-walk'; g.speed = floorSpeed(s);
      route(g, hallway(g, REVIEW_STOP), 'Walk to the review box');
    }
  }
  s.missed += 1; s.abandoned = s.missed;
  if (r) { r.status = 'dirty'; r.request = null; r.activeRequest = null; r.workerId = null; r.patience = 0; r.progress = 0; }
  log(s, 'missed', `${g.name} left: ${why.toLowerCase()}`, r || g, 'Guest left');
}
function updateGuests(s, dt, departuresOnly=false) {
  for (const g of s.guests) {
    if(departuresOnly&&!(g.paid&&g.status==='leaving'))continue;
    if (g.status === 'waiting') {
      if(s.config.firstStepsRules!==1)g.waitElapsed += dt; g.patience = Math.max(0, s.config.waitingPatience - g.waitElapsed);
      if (g.patience < g.maxPatience * .4) g.tipEligible = false;
      if (g.patience <= EPS) abandon(s, g);
    } else if (g.status === 'occupied') {
      const r = roomById(s, g.roomId);
      if (g.request === 'rest') {
        g.restRemaining = Math.max(0, g.restRemaining - dt); r.restRemaining = g.restRemaining;
        if (g.restRemaining <= EPS) request(s, r, g, g.nextRequest);
      } else if (['towel', 'meal', 'repair'].includes(g.request) || contentRules(s) && (isVenue(s, g.request) || g.request === 'visiting')) {
        // Accepted travel/work is protected; awaiting the player's venue action is not.
        const visitJob = hasMotionRules(s) && g.request === 'visiting' ? s.actors[r.workerId]?.job : null;
        const protectedVisit = visitJob?.type === 'visitFacility' && ['meet', 'escort', 'service', 'return'].includes(visitJob.phase);
        if (!protectedVisit&&s.config.firstStepsRules!==1) g.roomElapsed += dt; g.patience = Math.max(0, s.config.requestPatience - g.roomElapsed); r.patience = g.patience;
        if (contentRules(s) && g.request === 'visiting') s.facilities[r.activeRequest].timer = g.roomElapsed;
        if (g.patience < g.maxPatience * .4) g.tipEligible = false;
        if (g.patience <= EPS) abandon(s, g);
      }
    } else if (g.status === 'served') {
      g.checkoutRemaining = Math.max(0, g.checkoutRemaining - dt);
      if (g.checkoutRemaining <= EPS) beginCheckout(s, g);
    } else if (g.status === 'leaving') {
      if (contentRules(s) && g.phase === 'reviewing') {
        g.checkoutRemaining = Math.max(0, g.checkoutRemaining - dt);
        if (g.checkoutRemaining > EPS) continue;
        dropReview(s, g);
        g.phase = 'leaving'; g.intent = 'Happy guest heading home';
        route(g, hallway(g, C.entry)); continue;
      }
      if (!walk(g, dt)) continue;
      if (contentRules(s) && g.phase === 'review-walk') {
        g.phase = 'reviewing'; g.checkoutRemaining = .35; g.action = 'reviewing'; g.moving = false; g.intent = 'Leaving a review'; continue;
      }
      if (g.phase === 'checkout') {
        if (!payAtReception(s, g)) continue;
        if (contentRules(s)) { g.phase = 'review-walk'; route(g, hallway(g, REVIEW_STOP), 'Walk to the review box'); continue; }
        g.phase = 'leaving'; g.intent = 'Happy guest heading home';
        route(g, hallway(g, C.entry)); continue;
      }
      g.visible = false; g.moving = false; g.status = g.phase = 'departed'; g.departed = true; g.action = 'idle';
      if(hasCoinPickups(s))log(s,'door-coins',`${g.name} left ${g.payment} coins at the room door. Tap to collect.`,roomById(s,g.roomId),'Coins to collect');
    } else if (contentRules(s) && g.status === 'abandoned' && g.phase !== 'abandoned') {
      if (g.phase === 'complaint-reviewing') {
        g.checkoutRemaining = Math.max(0, g.checkoutRemaining - dt);
        if (g.checkoutRemaining > EPS) continue;
        dropReview(s, g); g.phase = 'complaint-exit';
        route(g, hallway(g, C.entry), 'Heading home'); continue;
      }
      if (!walk(g, dt)) continue;
      if (g.phase === 'complaint-walk') {
        g.phase = 'complaint-reviewing'; g.checkoutRemaining = .35; g.action = 'reviewing'; g.moving = false; g.intent = 'Leaving feedback'; continue;
      }
      g.visible = false; g.moving = false; g.phase = 'abandoned'; g.action = 'idle';
    }
  }
}
function updateStations(s, dt) {
  const l = s.laundry, k = s.kitchen;
  if (l.status === 'washing' && !l.loading) {
    l.remaining = Math.max(0, l.remaining - dt); l.progress = Math.min(1, 1 - l.remaining / l.duration);
    if (l.remaining <= EPS) { l.status = 'ready'; learnStaffRoutine(s,'wash'); l.remaining = 0; l.progress = 1; log(s, 'wash-ready', 'Wash ready: fold towels', l, 'Fold me!'); }
  }
  if (k.status === 'cooking') {
    k.remaining = Math.max(0, k.remaining - dt); k.progress = Math.min(1, 1 - k.remaining / k.duration);
    if (k.remaining <= EPS) {
      learnStaffRoutine(s,'cook:'+(k.batchRecipe||'garden'));
      const count = k.batch; k.meals += count; k.prepared += count; k.batch = 0;
      if (contentRules(s)) { k.recipes.push(...Array(count).fill(k.batchRecipe)); k.recipePrepared[k.batchRecipe] += count; k.batchRecipe = null; }
      k.status = 'idle'; k.remaining = 0; k.progress = 0;
      log(s, 'food-ready', `${count} meals ready`, k, `+${count} meals`);
    }
  }
}
function activateThief(s) {
  const t = s.actors.thief;
  t.visible = true; t.phase = t.status = 'approaching'; t.timer = 0; t.remaining = C.thiefApproach + C.thiefWarning;
  route(t, [{ x: 950, y: 440 }, { x: 950, y: C.hallwayY }, C.till], 'Tap Rook to save the till');
  let previous = t;
  t.speed = t.path.reduce((total, p) => { const next = total + distance(previous, p); previous = p; return next; }, 0) / C.thiefApproach;
  log(s, 'thief', 'Rook! Tap him before he steals', t, 'Stop Rook!');
}
function sendThiefAway(s, stopped) {
  const t = s.actors.thief;
  t.stopped = stopped; t.resolved = true; t.outcome = stopped ? 'shooed' : 'stole';
  t.phase = t.status = 'fleeing'; t.remaining = 0; t.speed = hasMotionRules(s) ? motionSpeed(s).floor : 480;
  route(t, [{ x: 950, y: C.hallwayY }, { x: 950, y: 440 }, C.thiefEntry], stopped ? 'Till saved' : 'Leaving with coins');
}
function updateThief(s, dt) {
  const t = s.actors.thief;
  if (s.config.thief && !['noticed','prepared'].includes(s.reputation?.pest?.phase) && (!isCalmShift(s) || s.config.completedShifts>=2 && s.completed>=1 && !s.guests.some(g=>!['pending','departed','abandoned'].includes(g.status))) && t.phase === 'dormant' && s.time + EPS >= s.config.thiefAt) { activateThief(s); return; }
  if (!t.visible) return;
  if (t.phase === 'approaching' || t.phase === 'stealing') {
    t.timer += dt; t.remaining = Math.max(0, C.thiefApproach + C.thiefWarning - t.timer);
    if (t.phase === 'approaching') {
      walk(t, dt);
      if (t.timer + EPS >= C.thiefApproach) {
        t.phase = t.status = 'stealing'; t.path = []; t.target = null; t.moving = false; t.action = 'stealing';
        log(s, 'theft-warning', 'Rook is at the till!', t, 'Tap Rook!');
      }
    }
    if (t.remaining <= EPS) {
      const amount = Math.min(C.theftAmount, s.money); s.money -= amount; s.stolen += amount;
      sendThiefAway(s, false); log(s, 'theft', `Rook took ${amount} coins`, t, `−${amount}`);
    }
  } else if (t.phase === 'fleeing' && walk(t, dt)) {
    t.visible = false; t.moving = false; t.phase = t.status = 'gone'; t.action = 'idle';
  }
}
/** Observations are derived from live work, not generated inspection chores. */
export function inspectHotel(s) {
  const dirty = s.rooms.filter(room => ['dirty', 'cleaning'].includes(room.status)).map(room => room.id);
  const repairs = s.rooms.filter(room => room.status === 'occupied' &&
    (room.request === 'repair' || room.activeRequest === 'repair')).map(room => room.id);
  const waits = s.guests.filter(guest => guest.status === 'waiting'
    ? guest.waitElapsed >= s.config.waitingPatience / 2
    : guest.status === 'occupied' && guest.request !== 'rest' && guest.roomElapsed >= s.config.requestPatience / 2).map(guest => guest.id);
  return [dirty, repairs, waits].map((ids, index) => ({ id: ['clean', 'repair', 'service'][index],
    ok: ids.length === 0, count: ids.length, ids }));
}
function inspectionPhase(s, phase) {
  s.inspection.phase = s.actors.inspector.phase = s.actors.inspector.status = phase;
  s.inspection.timer = 0;
}
function assessInspection(s) {
  const inspection = s.inspection, owl = s.actors.inspector, checklist = inspectHotel(s);
  const guestSeen = s.guests.some(guest => guest.roomProof && guest.roomProof.checkedInAt <= s.time);
  inspection.checklist = checklist;
  inspection.assessments.push({ at: s.time, checklist: copy(checklist), guestSeen });
  const clear = checklist.every(item => item.ok);
  if (!clear && inspection.assessments.length === 1) {
    inspectionPhase(s, 'recheck'); inspection.recheckAt = s.time + INSPECTION_CONFIG.recheckDelay;
    owl.action = 'checking'; owl.intent = 'Time to finish the existing work';
    log(s, 'inspection-recheck', 'Olive will check again shortly', owl, 'Recheck'); return;
  }
  inspection.outcome = clear ? 'clear' : 'noted';
  inspectionPhase(s, 'returning');
  route(owl, hallway(owl, C.till), clear ? 'All clear' : 'Thanks for the visit');
  log(s, 'inspection-complete', clear ? 'Olive found everything in order' : 'Olive left a friendly note', owl,
    clear ? 'All clear' : 'No penalty');
}
function updateInspector(s, dt) {
  if (!leisureRules(s)) return;
  const inspection = s.inspection, owl = s.actors.inspector;
  if (inspection.phase === 'dormant') {
    if (!inspection.eligible || s.time + EPS < INSPECTION_CONFIG.startAt) return;
    const open = s.rooms.slice(0, s.openRooms);
    const target = open.find(room => ['dirty', 'cleaning'].includes(room.status) || room.request === 'repair')
      ?? open.find(room => room.status === 'occupied') ?? open[s.config.completedShifts % open.length];
    inspection.roomId = target.id; inspection.startedAt = s.time; owl.visible = true;
    inspectionPhase(s, 'reception'); route(owl, hallway(owl, C.till), 'A friendly hotel inspection');
    log(s, 'inspection', 'Olive is visiting the hotel', owl, 'Inspector'); return;
  }
  if (inspection.phase === 'reception') {
    if (!walk(owl, dt)) return;
    inspectionPhase(s, 'walking');
    const room = roomById(s, inspection.roomId);
    route(owl, hallway(owl, { x: room.x + 100, y: room.y + 40 }), 'Checking the hotel'); return;
  }
  if (inspection.phase === 'walking') {
    if (!walk(owl, dt)) return;
    inspectionPhase(s, 'assessing'); owl.moving = false; owl.action = 'checking';
  }
  if (inspection.phase === 'assessing') {
    inspection.timer += dt;
    if (inspection.timer + EPS >= INSPECTION_CONFIG.assessmentDuration) assessInspection(s);
  } else if (inspection.phase === 'recheck' && s.time + EPS >= inspection.recheckAt) assessInspection(s);
  else if (inspection.phase === 'returning') {
    if (!walk(owl, dt)) return;
    inspectionPhase(s, 'exiting'); route(owl, hallway(owl, C.entry), 'Heading home');
  } else if (inspection.phase === 'exiting' && walk(owl, dt)) {
    inspectionPhase(s, 'gone'); owl.visible = false; owl.moving = false; owl.action = 'idle';
  }
}
function finish(s, won, reason) {
  s.status = won ? 'won' : 'lost'; s.paused = false;
  // A positive inspection is provisional until the shift actually finishes.
  // Replaying or abandoning an active shift can never cash the same visit.
  if (leisureRules(s) && s.inspection.outcome === 'clear' && s.inspection.assessments.at(-1)?.guestSeen && s.inspection.bonus === 0) {
    if (!hasMotionRules(s) || safeAdd(s.money, INSPECTION_CONFIG.bonus) && safeAdd(s.earnings, INSPECTION_CONFIG.bonus)) {
      s.inspection.bonus = INSPECTION_CONFIG.bonus;
      s.money += s.inspection.bonus; s.earnings += s.inspection.bonus;
    }
  }
  for (const a of Object.values(s.actors)) a.moving = false;
  s.result = { ...(hasMotionRules(s) ? { version: 7, shiftId: s.shiftId, motionRules: s.config.motionRules, motionMode: s.config.motionMode, startingMoney: s.startingMoney, tips: s.tips } : {}), won, success: won, title: won ? 'Rush complete!' : 'Try another shift', reason,
    completed: s.completed, served: s.served, arrived: s.arrived, missed: s.missed,
    abandoned: s.missed, goal: s.goal, totalGuests: s.totalGuests,
    money: s.money, earnings: s.earnings, costs: s.costs, stolen: s.stolen,
    ...(hasCoinPickups(s)?{coinCash:coinCash(s)}:{}),
    stars: won ? (s.missed > 0 || s.stolen > 0 ? 2 : 3) : 0,
    ...(contentRules(s) ? { reviews: s.guests.filter(g => g.review).map(g => ({ guestId: g.id, guestName: g.name, customerType: g.customerType, ...copy(g.review) })) } : {}),
    ...(leisureRules(s) ? { inspectionBonus: s.inspection.bonus } : {}) };
  log(s, won ? 'won' : 'lost', reason, C.till, won ? 'Shift complete!' : 'Try again');
}
function tick(s) {
  s.ticks += 1; s.time = isCalmShift(s) ? s.ticks * STEP : Math.min(s.ticks * STEP, s.timeLimit); s.remaining = Math.max(0, s.timeLimit - s.time);
  // At a hard ending, finish only already-paid exit walks. No extra service,
  // arrivals, theft or guest receipts are earned beyond the shift boundary.
  // Existing inspection/review bookkeeping follows its own exact clock.
  const draining=hasCoinPickups(s)&&(s.missed>s.maxMissed||!isCalmShift(s)&&s.remaining<=EPS);
  if(draining)updateGuests(s,STEP,true);
  else {
  updateArrivals(s);
  dispatchStaff(s,canRushCommand,rushCommand);
  for (const a of staff(s)) updateStaff(s, a, STEP);
  updateGuests(s, STEP); updateStations(s, STEP); updateThief(s, STEP);
  }
  updateInspector(s, STEP); updateReputation(s);
  if(hasCoinPickups(s)&&s.guests.some(g=>g.paid&&!g.departed))return;
  if (s.missed > s.maxMissed) finish(s, false, `${s.missed} guests left unhappy.`);
  else if (!isCalmShift(s) && s.remaining <= EPS) finish(s, s.completed >= s.goal,
    s.completed >= s.goal ? `${s.completed} happy guests!` : `${s.completed}/${s.goal} happy guests. Try again!`);
  else if (sessionRules(s) && guestsFinished(s)) finish(s, s.completed >= s.goal,
    s.completed >= s.goal ? `${s.completed} happy guests!` : `${s.completed}/${s.goal} happy guests. Try again!`);
}
/** Fixed-step simulation; paused, finished, negative and non-finite advances are no-ops. */
export function stepRush(s, dt) {
  if (!s || s.paused || s.status !== 'playing' || !Number.isFinite(dt) || dt <= 0) return s;
  relink(s);
  s.accumulator += isCalmShift(s) ? dt : Math.min(dt, Math.max(STEP, s.timeLimit - s.time + STEP));
  while (s.accumulator + EPS >= STEP && !terminal(s)) {
    s.accumulator -= STEP; if (Math.abs(s.accumulator) < EPS) s.accumulator = 0; tick(s);
  }
  if (terminal(s)) s.accumulator = 0;
  return s;
}
export function rushSnapshot(s) { return copy(s); }
/** Version 1 had one flat room row. Preserve the ledger, stocks, reservations,
 * job phase/work and clock, relocating stationary room work to its new floor.
 * Existing transit is rerouted from its corresponding room/lobby location; the
 * first actual simulation step then follows normal continuous stairs. */
function migrateLegacyRush(s) {
  const oldRooms = s.rooms.map(point);
  const moveRoomPoint = (a, r) => {
    const old = oldRooms[s.rooms.indexOf(r)];
    a.x = Math.max(0, Math.min(C.width, r.x + a.x - old.x)); a.y = r.y + a.y - old.y;
  };
  const placeRoom = (a, r, offset = { x: 0, y: 0 }) => Object.assign(a, { x: r.x + offset.x, y: r.y + offset.y });
  for (const [i, r] of s.rooms.entries()) Object.assign(r, C.rooms[i]);
  for (const g of s.guests) {
    const r = roomById(s, g.roomId);
    if (r && ['occupied', 'served'].includes(g.status)) { placeRoom(g, r); g.path = []; g.target = null; }
    if (g.status === 'leaving') {
      // Version 1 booked this receipt before walking out. Do not book it again.
      g.phase = 'leaving'; route(g, hallway(g, C.entry), 'Happy guest heading home');
    }
  }
  for (const a of staff(s)) {
    const j = a.job, r = roomById(s, j?.roomId), g = guestById(s, j?.guestId);
    if (!j) {
      if (a.returningHome) {
        if (a.y <= 325) {
          const i = oldRooms.reduce((best, p, n) => distance(a, p) < distance(a, oldRooms[best]) ? n : best, 0);
          moveRoomPoint(a, s.rooms[i]);
        }
        route(a, hallway(a, C.starts[a.id]), 'Ready for another task');
      }
      continue;
    }
    if (j.type === 'assignRoom') {
      if (j.phase === 'meet') route(a, hallway(a, { x: g.x - 60, y: g.y + 20 }), j.label);
      else if (j.phase === 'guide') {
        route(a, hallway(a, { x: r.x + 90, y: r.y + 25 }), j.label);
        route(g, hallway(g, r), `Following ${a.name}`);
      } else if (j.phase === 'welcome') {
        placeRoom(a, r, { x: 90, y: 25 }); placeRoom(g, r);
        a.path = []; a.target = null; g.path = []; g.target = null;
      }
    } else if (j.type === 'deliverTowel' || j.type === 'deliverMeal') {
      const station = j.type === 'deliverTowel' ? s.laundry : s.kitchen;
      if (j.phase === 'fetch') {
        if (a.y <= 325) moveRoomPoint(a, r);
        route(a, hallway(a, station), j.label);
      } else if (j.phase === 'pickup') {
        Object.assign(a, point(station)); a.path = []; a.target = null;
      } else if (j.phase === 'deliver') route(a, hallway(a, { x: r.x + 25, y: r.y + 18 }), j.label);
      else if (j.phase === 'give') {
        placeRoom(a, r, { x: 25, y: 18 }); a.path = []; a.target = null;
      }
    } else if (j.type === 'repairRoom' || j.type === 'cleanRoom') {
      if (j.phase === 'room') route(a, hallway(a, r), j.label);
      else if (['fix', 'tidy'].includes(j.phase)) { placeRoom(a, r); a.path = []; a.target = null; }
      else if (j.phase === 'return') {
        if (a.y <= 325) moveRoomPoint(a, r);
        route(a, hallway(a, s.laundry), 'Return used towels');
      } else if (j.phase === 'unload') { Object.assign(a, point(s.laundry)); a.path = []; a.target = null; }
    } else if (j.type === 'loadWash') {
      if (j.phase === 'load') route(a, hallway(a, s.laundry), j.label);
      else { Object.assign(a, point(s.laundry)); a.path = []; a.target = null; }
    }
  }
  for (const a of [...staff(s), ...s.guests]) a.speed = C.walkSpeed;
  s.version = s.layoutVersion = 2; relink(s); return s;
}
/**
 * Restore a detached save without restarting its shift. This rejects ordinary
 * truncated/corrupt storage, not a hostile client: all simulation state is local.
 */
export function restoreRush(saved) {
  try {
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return null;
    const rawConfig = Object.getOwnPropertyDescriptor(saved, 'config')?.value;
    const homeRevision = rawConfig && Object.getOwnPropertyDescriptor(rawConfig, 'motionHomeRevision');
    const routingRevision = rawConfig && Object.getOwnPropertyDescriptor(rawConfig, 'motionRouteRevision');
    if (Object.getOwnPropertyDescriptor(saved, 'version')?.value === 7 &&
      (!validMotionPreset(rawConfig) || homeRevision && homeRevision.value !== 1 || routingRevision && !(routingRevision.value === 2 || Object.getOwnPropertyDescriptor(rawConfig, 'motionRules')?.value >= 2 && routingRevision.value === 3) ||
       !validShiftIdentity(Object.getOwnPropertyDescriptor(saved, 'shiftId')?.value))) return null;
    const doorPolicy=rawConfig&&Object.getOwnPropertyDescriptor(rawConfig,'roomDoorXs');
    if(doorPolicy&&(!Object.hasOwn(doorPolicy,'value')||saved.version!==7||!validRoomDoorXs(doorPolicy.value)))return null;
    const s = copy(saved), c = s.config;
    const isObject = v => !!v && typeof v === 'object' && !Array.isArray(v);
    const number = v => Number.isFinite(v);
    const integer = v => Number.isSafeInteger(v) && v >= 0;
    const equal = (a, b) => number(a) && number(b) && Math.abs(a - b) <= 1e-7;
    const position = v => isObject(v) && number(v.x) && number(v.y);
    const between = (v, lo, hi) => number(v) && v >= lo - EPS && v <= hi + EPS;
    const oneOf = (v, choices) => choices.includes(v);
    const reject = condition => { if (!condition) throw new Error('Invalid rush save'); };
    reject(oneOf(s.version, [1, 2, 3, 4, 5, 6, 7]) && (s.version === 1 || s.layoutVersion === 2) && s.mode === 'rush' && isObject(c) && isObject(s.settings));
    reject(validateStaffState(s));
    reject(validCoinState(s));
    const varied = s.version >= 3, content = s.version >= 4, leisure = s.version >= 6, motion = s.version === 7;
    if(Object.hasOwn(c,'firstStepsRules'))reject(motion&&c.motionRules===3&&c.motionMode==='relaxed'&&[1,2].includes(c.firstStepsRules));
    if (motion) {
      reject(validMotionPreset(c) && validShiftIdentity(s.shiftId));
      for (const key of ['motionRules', 'motionMode']) if (Object.hasOwn(s, key)) reject(s[key] === c[key]);
      for (const key of ['walkSpeed', 'floorSpeed', 'stairSpeed', 'receiptNumerator', 'receiptDenominator']) reject(!Object.hasOwn(c, key));
    }
    if (Object.hasOwn(c,'roomSlots') || Object.hasOwn(c,'constructionRules')) {
      reject(content && c.constructionRules===1 && validRoomSlots(c.roomSlots));
      const supply=c.roomSupplyAtStart;reject(isObject(supply) && integer(supply.openRooms) && supply.openRooms>=1 && supply.openRooms<=c.openRooms && c.openRooms-supply.openRooms<=1 && Array.isArray(supply.roomTiers) && supply.roomTiers.length===6 && supply.roomTiers.every((t,i)=>oneOf(t,[0,1,2]) && (i<supply.openRooms?t===c.roomTiers[i]:t===0)));
    } else reject(!Object.hasOwn(c,'roomSupplyAtStart'));
    if (content) {
      reject(c.contentRules === 1 && Array.isArray(c.roomTiers) && c.roomTiers.length === 6 && c.roomTiers.every(t => oneOf(t, [0, 1, 2])));
      reject(isObject(c.facilities) && Object.keys(c.facilities).length === 3 && FACILITY_IDS.every(id => oneOf(c.facilities[id], [0, 1])));
      reject(oneOf(c.chefLevel, [0, 1]) && (!c.chefLevel || c.facilities.restaurant === 1));
      reject(number(c.chefBaseFoodDuration) && c.chefBaseFoodDuration > 0 && equal(c.foodDuration, c.chefBaseFoodDuration * (c.chefLevel ? .8 : 1)));
      if (s.version >= 5) {
        reject(c.cuisineRules === 1);
        reject(c.facilities.restaurant === 1 ? isCuisine(c.restaurantCuisine) : c.restaurantCuisine === null);
      }
      if (leisure) {
        reject(c.leisureRules === 1 && isObject(c.leisure) && Object.keys(c.leisure).length === 2
          && LEISURE_IDS.every(id => oneOf(c.leisure[id], [0, 1])));
        reject(c.leisure.theater <= c.leisure.lounge && c.leisure.lounge <= c.facilities.restaurant);
        reject(oneOf(c.performerLevel, [0, 1]) && c.performerLevel <= c.leisure.theater && integer(c.completedShifts));
      }
    }
    if (varied) {
      reject(c.sessionRules === 1 && Number.isSafeInteger(c.visitSeed) && c.visitSeed > 0);
      reject(typeof s.receptionClosed === 'boolean');
      reject(s.receptionClosed ? between(s.receptionClosedAt, 0, s.time) && s.completed >= s.goal : s.receptionClosedAt === null);
    }
    reject(oneOf(s.status, ['playing', 'paused', 'won', 'lost']) && typeof s.paused === 'boolean');
    reject(s.paused === (s.status === 'paused'));
    reject(integer(s.openRooms) && between(s.openRooms, 1, 6) && s.openRooms === c.openRooms);
    reject(integer(s.staffCount) && between(s.staffCount, 2, 3) && s.staffCount === c.staffCount);
    reject(oneOf(s.serviceLevel, [0, 1]) && s.serviceLevel === c.serviceLevel);
    reject(equal(c.workScale, s.serviceLevel ? .8 : 1));
    reject(oneOf(s.upgrade, [null, 'linen-shelf', 'quick-wash']));
    for (const key of ['timeLimit', 'waitingPatience', 'requestPatience', 'restDuration', 'washDuration', 'foodDuration'])
      reject(number(c[key]) && c[key] > 0);
    reject(typeof c.thief === 'boolean' && number(c.thiefAt) && c.thiefAt >= 0);
    reject(Array.isArray(c.arrivalSchedule) && c.arrivalSchedule.length <= 100);
    reject(c.arrivalSchedule.every((t, i, all) => number(t) && t >= 0 && (!i || t >= all[i - 1])));
    reject(equal(s.timeLimit, c.timeLimit) && integer(s.ticks));
    reject(isCalmShift(s) ? equal(s.time,s.ticks*STEP) : between(s.time, 0, s.timeLimit) && equal(s.time, Math.min(s.ticks * STEP, s.timeLimit)));
    reject(equal(s.remaining, Math.max(0,s.timeLimit - s.time)) && between(s.accumulator, 0, STEP));
    if (terminal(s)) reject(equal(s.accumulator, 0) && isObject(s.result));
    else reject(s.result === null);
    for (const key of ['money', 'startingMoney', 'earnings', 'costs', 'stolen', 'tips', 'arrived', 'completed', 'missed', 'abandoned', 'served', 'goal', 'maxMissed', 'totalGuests']) reject(integer(s[key]));
    reject(s.startingMoney === c.startingMoney && s.goal === c.goal && s.goal > 0 && s.maxMissed === c.maxMissed);
    reject((motion ? BigInt(s.money) === BigInt(s.startingMoney) + BigInt(s.earnings) - BigInt(s.costs) - BigInt(s.stolen) + coinCashDelta(s)
      : s.money === s.startingMoney + s.earnings - s.costs - s.stolen) && s.tips <= s.earnings);
    reject(Array.isArray(s.guests) && s.guests.length === s.totalGuests && s.totalGuests === c.arrivalSchedule.length);
    reject(Array.isArray(s.rooms) && s.rooms.length === 6 && isObject(s.actors));
    const expectedActors = ['courier', 'mechanic', 'thief', ...(leisure ? ['inspector'] : []), ...(s.staffCount === 3 ? ['helper'] : []), ...s.guests.map((_, i) => `guest-${i + 1}`)];
    reject(Object.keys(s.actors).length === expectedActors.length && expectedActors.every(id => isObject(s.actors[id])));
    for (const [id, a] of Object.entries(s.actors)) {
      reject(a.id === id && typeof a.name === 'string' && position(a) && typeof a.visible === 'boolean');
      if (s.version >= 2) reject(between(a.x, 0, C.width) && between(a.y, leisure ? -2800 : content ? -2100 : -1400, C.height)
        && a.path?.every(p => between(p.x, 0, C.width) && between(p.y, leisure ? -2800 : content ? -2100 : -1400, C.height)));
      reject(typeof a.moving === 'boolean' && typeof a.returningHome === 'boolean');
      reject(number(a.speed) && a.speed > 0 && number(a.facing) && between(a.progress, 0, 1) && number(a.walkTime) && a.walkTime >= 0);
      reject(typeof a.action === 'string' && typeof a.intent === 'string');
      reject(Array.isArray(a.path) && a.path.length <= (motion ? ESCORT_PATH_LIMIT : 20) && a.path.every(position));
      reject(a.target === null || position(a.target));
      reject(a.path.length ? position(a.target) && equal(a.target.x, a.path[0].x) && equal(a.target.y, a.path[0].y) : a.target === null);
      reject(a.job === null || isObject(a.job));
      if (motion && id !== 'thief') reject(a.speed === motionSpeed(s).floor);
      const kind = id.startsWith('guest-') ? 'guest' : id === 'helper' ? 'courier' : id;
      reject(content && id.startsWith('guest-') ? ['guest', 'cat', 'family'].includes(a.spriteKind) : a.spriteKind === kind);
    }
    const roomStatuses = ['available', 'locked', 'checking-in', 'occupied', 'dirty', 'cleaning'];
    const requests = [null, 'towel', 'meal', 'repair', 'rest', 'delivering', 'repairing', ...(content ? [...venueIds(s), 'visiting'] : [])];
    for (const [i, r] of s.rooms.entries()) {
      reject(r.id === `room-${i + 1}` && typeof r.name === 'string' && position(r));
      if (content) reject(r.tier === c.roomTiers[i] && r.capacity === roomCapacity(r.tier));
      if (s.version >= 2) {const slot=c.roomSlots?.[i]??i,plot=roomDoorPosition(C.rooms[slot],slot,c.roomDoorXs);reject(r.floor === plot.floor && equal(r.x, plot.x) && equal(r.y, plot.y));}
      reject(oneOf(r.status, roomStatuses) && (r.status === 'locked') === (i >= s.openRooms));
      reject(oneOf(r.request, requests) && oneOf(r.activeRequest, [null, 'towel', 'meal', 'repair', ...(content ? venueIds(s) : [])]));
      reject(between(r.patience, 0, r.maxPatience) && equal(r.maxPatience, c.requestPatience));
      reject(number(r.restRemaining) && r.restRemaining >= 0 && between(r.progress, 0, 1) && typeof r.towelUsed === 'boolean');
      reject(r.workerId === null || staff(s).some(a => a.id === r.workerId));
      if (oneOf(r.status, ['available', 'locked'])) reject(r.guestId === null && r.guestName === null && !r.towelUsed && r.request === null && r.workerId === null);
      else {
        const g = guestById(s, r.guestId);
        reject(!!g && g.roomId === r.id && r.guestName === g.name);
        if (r.status === 'checking-in') reject(g.status === 'checking-in');
        if (r.status === 'occupied') reject(oneOf(g.status, ['occupied', 'served']) && r.request === g.request);
        if (oneOf(r.status, ['dirty', 'cleaning'])) reject(g.resolved);
      }
    }
    for (const [i, g] of s.guests.entries()) {
      reject(g.id === `guest-${i + 1}` && g.arrivalAt === c.arrivalSchedule[i]);
      reject(JSON.stringify(s.actors[g.id]) === JSON.stringify(g));
      reject(oneOf(g.status, ['pending', 'waiting', 'checking-in', 'occupied', 'served', 'leaving', 'departed', 'abandoned']));
      reject(g.roomId === null || s.rooms.some(r => r.id === g.roomId));
      reject(oneOf(g.request, [...requests, 'room']) && typeof g.phase === 'string');
      for (const key of ['payment', 'towelsReceived', 'mealsReceived', 'repairsReceived', 'requestIndex']) reject(integer(g[key]));
      for (const key of ['waitElapsed', 'roomElapsed', 'patience', 'maxPatience', 'restRemaining', 'checkoutRemaining']) reject(number(g[key]) && g[key] >= 0);
      for (const key of ['served', 'departed', 'abandoned', 'resolved', 'escorted', 'paid', 'tipEligible']) reject(typeof g[key] === 'boolean');
      const itinerary = varied ? (content ? itineraryFor(s, i) : visitItinerary(c.visitSeed, i)) : ['towel', 'meal', ...(g.requiresRepair ? ['repair'] : [])];
      if (varied) reject(Array.isArray(g.itinerary) && JSON.stringify(g.itinerary) === JSON.stringify(itinerary));
      reject(g.requiresRepair === (varied ? itinerary.includes('repair') : (i + 1) % 3 === 0) && g.needsRepair === g.requiresRepair);
      reject(g.towelsReceived <= 1 && g.mealsReceived <= 1 && g.repairsReceived <= 1 && g.requestIndex <= itinerary.length);
      reject(g.job === null && g.payment === (g.paid ? guestPayment(s, g) : 0));
      if (g.status === 'waiting') reject(g.visible && integer(g.queueSlot) && g.queueSlot < C.queue.length && g.roomId === null && g.request === 'room');
      if (g.paid) reject(g.served && g.resolved && (varied
        ? g.requestIndex === itinerary.length
        : g.towelsReceived === 1 && g.mealsReceived === 1 && (!g.requiresRepair || g.repairsReceived === 1)));
      if (g.abandoned) reject(g.status === 'abandoned' && g.resolved && !g.paid);
      if (varied) {
        // Counters are the exact completed prefix, not simply bounded totals.
        // This rejects skipped/reordered service, a forged receipt and a rest
        // pointing at a service that does not belong to this guest's stay.
        const prefix = itinerary.slice(0, g.requestIndex);
        for (const [kind, key] of [['towel', 'towelsReceived'], ['meal', 'mealsReceived'], ['repair', 'repairsReceived']])
          reject(g[key] === Number(prefix.includes(kind)));
        const beforeRoom = oneOf(g.status, ['pending', 'waiting', 'checking-in']);
        const happy = oneOf(g.status, ['served', 'leaving', 'departed']);
        reject(g.served === happy && g.departed === (g.status === 'departed') && g.abandoned === (g.status === 'abandoned'));
        reject(g.resolved === oneOf(g.status, ['leaving', 'departed', 'abandoned']));
        const facilityVisible = content && g.status === 'occupied' && g.request === 'visiting'
          && staff(s).some(a => a.job?.guestId === g.id && a.job?.type === 'visitFacility' && a.job.phase !== 'meet');
        const complaintVisible = content && g.status === 'abandoned' && ['complaint-walk', 'complaint-reviewing', 'complaint-exit'].includes(g.phase);
        reject(g.visible === (oneOf(g.status, ['waiting', 'checking-in', 'leaving']) || facilityVisible || complaintVisible));
        reject(g.escorted === (g.roomId !== null));
        reject(g.paid === (g.status === 'departed' || g.status === 'leaving' && oneOf(g.phase, content ? ['review-walk', 'reviewing', 'leaving'] : ['leaving'])));
        reject(isCalmShift(s) ? (g.status==='pending' ? g.admittedAt===null : between(g.admittedAt,0,s.receptionClosed?s.receptionClosedAt:s.time)) : g.status === 'pending' ? g.arrivalAt > (s.receptionClosed ? s.receptionClosedAt : s.time) + EPS
          : g.arrivalAt <= (s.receptionClosed ? s.receptionClosedAt : s.time) + EPS);
        if (beforeRoom) reject(g.requestIndex === 0 && !g.paid && !g.served);
        if (happy) reject(g.requestIndex === itinerary.length && g.request === null && g.nextRequest === null);
        if (g.status === 'abandoned') reject(g.requestIndex < itinerary.length && g.request === null);
        if (g.status !== 'waiting') reject(g.queueSlot === null);
        if (oneOf(g.status, ['pending', 'waiting'])) reject(g.roomId === null && g.phase === g.status);
        if (g.status === 'pending') reject(g.request === null && g.nextRequest === null);
        if (g.status === 'checking-in') reject(g.request === null && g.nextRequest === null && g.phase === 'checking-in');
        if (g.status === 'occupied') {
          const r = roomById(s, g.roomId), kind = itinerary[g.requestIndex];
          reject(!!r && r.guestId === g.id && r.status === 'occupied' && g.phase === 'settled' && !!kind);
          reject(g.request === kind || g.request === 'rest' || (content && isVenue(s, kind) ? g.request === 'visiting' : kind === 'repair' ? g.request === 'repairing' : g.request === 'delivering'));
          reject(g.request === 'rest' ? g.nextRequest === kind && g.requestIndex > 0 && between(g.restRemaining, EPS, c.restDuration)
            : g.nextRequest === null && g.restRemaining === 0);
          reject(r.towelUsed === (g.towelsReceived === 1));
          reject(oneOf(g.request, ['delivering', 'repairing', ...(content ? ['visiting'] : [])]) ? r.activeRequest === kind && r.workerId !== null
            : r.activeRequest === null && r.workerId === null);
        }
        if (g.status === 'served') reject(g.phase === 'served');
        if (g.status === 'leaving') reject(oneOf(g.phase, content ? ['checkout', 'review-walk', 'reviewing', 'leaving'] : ['checkout', 'leaving']));
        if (content && g.status === 'abandoned') {
          reject(oneOf(g.phase, ['abandoned', 'complaint-walk', 'complaint-reviewing', 'complaint-exit']));
          if (g.phase === 'abandoned') reject(g.path.length === 0);
        } else if (oneOf(g.status, ['departed', 'abandoned'])) reject(g.phase === g.status && g.path.length === 0);
      }
    }
    const waiting = s.guests.filter(g => g.status === 'waiting');
    reject(waiting.length <= 5 && new Set(waiting.map(g => g.queueSlot)).size === waiting.length);
    if(isCalmShift(s)) {
      let last=-8,pending=false;
      for(const g of s.guests) {
        if(g.status==='pending'){pending=true;continue;}
        reject(!pending && g.admittedAt>=last+8-EPS); last=g.admittedAt;
      }
      reject(s.guests.filter(g=>!['pending','departed','abandoned'].includes(g.status)).length<=2);
    }
    reject(s.arrived === s.guests.filter(g => g.status !== 'pending').length);
    reject(s.completed === s.guests.filter(g => g.paid).length && s.served === s.guests.filter(g => g.served).length);
    reject(s.missed === s.guests.filter(g => g.abandoned).length && s.abandoned === s.missed);
    reject(s.earnings === s.guests.reduce((n, g) => n + g.payment, 0) + (leisure ? s.inspection?.bonus : 0));
    if (varied) reject(s.tips === s.guests.reduce((n, g) => n + (g.paid && g.tipEligible ? C.serviceTip : 0), 0));
    if (terminal(s)) {
      if (motion) reject(s.result.version === 7 && s.result.shiftId === s.shiftId && s.result.motionRules === c.motionRules
        && s.result.motionMode === c.motionMode && s.result.startingMoney === s.startingMoney && s.result.tips === s.tips);
      const won = s.status === 'won';
      reject(s.result.won === won && s.result.success === won && typeof s.result.title === 'string' && typeof s.result.reason === 'string');
      for (const key of ['completed', 'served', 'arrived', 'missed', 'abandoned', 'goal', 'totalGuests', 'money', 'earnings', 'costs', 'stolen']) reject(s.result[key] === s[key]);
      reject(integer(s.result.stars) && s.result.stars <= 3);
      const concluded = !isCalmShift(s) && s.remaining === 0 || varied && guestsFinished(s);
      reject(won ? concluded && s.completed >= s.goal && s.missed <= s.maxMissed
        : s.missed > s.maxMissed || concluded && s.completed < s.goal);
    }
    const l = s.laundry, k = s.kitchen;
    reject(position(l) && position(k));
    for (const key of ['clean', 'dirty', 'batch']) reject(integer(l[key]));
    reject(l.batch <= C.washBatch && oneOf(l.status, ['idle', 'washing', 'ready']) && typeof l.loading === 'boolean');
    reject(equal(l.duration, c.washDuration) && between(l.remaining, 0, l.duration) && between(l.progress, 0, 1));
    reject(l.status === 'idle' ? l.batch === 0 && l.remaining === 0 && l.progress === 0 && !l.loading : l.batch > 0);
    if (l.status === 'ready') reject(l.remaining === 0 && l.progress === 1 && !l.loading);
    reject(l.loading ? l.status === 'washing' && staff(s).some(a => a.id === l.workerId && a.job?.type === 'loadWash') : l.workerId === null);
    for (const key of ['meals', 'batch', 'capacity', 'prepared', 'served']) reject(integer(k[key]));
    reject(k.capacity === C.foodCapacity && k.meals + k.batch <= k.capacity && oneOf(k.status, ['idle', 'cooking']));
    reject(equal(k.duration, c.foodDuration) && between(k.remaining, 0, k.duration) && between(k.progress, 0, 1));
    reject(k.status === 'cooking' ? k.batch === C.foodBatch && k.remaining > 0 : k.batch === 0 && k.remaining === 0 && k.progress === 0);
    const phases = { assignRoom: ['meet', 'reception', 'register', 'guide', 'welcome'], deliverTowel: ['fetch', 'pickup', 'deliver', 'give'],
      deliverMeal: ['fetch', 'pickup', 'deliver', 'give'], ...(content ? { visitFacility: ['meet', 'escort', 'waiting', 'service', 'return'] } : {}), repairRoom: ['room', 'fix'], cleanRoom: ['room', 'tidy', 'return', 'unload'], loadWash: ['load', 'place'] };
    for (const a of staff(s)) {
      reject(equal(a.workScale, c.workScale));
      const j = a.job; if (!j) continue;
      reject(Object.hasOwn(phases, j.type) && phases[j.type].includes(j.phase) && number(j.work) && j.work >= 0 && typeof j.label === 'string');
      if (j.type === 'loadWash') { reject(l.loading && l.workerId === a.id); continue; }
      const r = roomById(s, j.roomId); reject(!!r && r.status !== 'locked');
      if (j.type === 'cleanRoom') {
        reject(oneOf(j.dirtyTowels, [0, 1]));
        if (oneOf(j.phase, ['room', 'tidy'])) reject(r.status === 'cleaning' && r.workerId === a.id);
      } else {
        const g = guestById(s, j.guestId);
        reject(!!g && r.guestId === g.id && r.workerId === a.id);
        if (j.type === 'assignRoom') reject(r.status === 'checking-in');
        else if (j.type === 'visitFacility') {
          reject(isVenue(s, j.facilityId) && r.request === 'visiting' && r.activeRequest === j.facilityId);
          const facility = s.facilities?.[j.facilityId];
          reject(!!facility && facility.guestId === g.id && facility.roomId === r.id && facility.workerId === a.id);
        }
        else if (j.type === 'repairRoom') reject(r.request === 'repairing' && r.activeRequest === 'repair');
        else reject(r.request === 'delivering' && r.activeRequest === (j.type === 'deliverTowel' ? 'towel' : 'meal')
          && j.reservedTowel === (j.type === 'deliverTowel') && j.reservedMeal === (j.type === 'deliverMeal'));
      }
    }
    const heldTowels = staff(s).filter(a => a.job?.reservedTowel).length;
    const returningTowels = staff(s).reduce((n, a) => n + (a.job?.type === 'cleanRoom' && oneOf(a.job.phase, ['return', 'unload']) ? a.job.dirtyTowels : 0), 0);
    reject(l.clean + l.dirty + l.batch + heldTowels + returningTowels + s.rooms.filter(r => r.towelUsed).length === (s.upgrade === 'linen-shelf' ? 7 : 6));
    reject(k.prepared === k.meals + k.served + staff(s).filter(a => a.job?.reservedMeal).length);
    reject(k.served === s.guests.reduce((n, g) => n + g.mealsReceived, 0));
    if (varied) {
      reject(k.prepared >= 1 && (k.prepared - 1) % C.foodBatch === 0);
      const foodCosts = ((k.prepared - 1 + k.batch) / C.foodBatch) * C.foodCost;
      reject(s.costs >= foodCosts && (s.costs - foodCosts) % C.washCost === 0);
      for (const r of s.rooms) {
        if (oneOf(r.status, ['checking-in', 'occupied', 'dirty', 'cleaning'])) {
          const g = guestById(s, r.guestId);
          reject(r.towelUsed === (g.towelsReceived === 1));
        }
        if (r.workerId !== null) {
          const j = s.actors[r.workerId].job;
          reject(!!j && j.roomId === r.id);
          if (r.status === 'checking-in') reject(j.type === 'assignRoom');
          else if (r.status === 'cleaning') reject(j.type === 'cleanRoom' && j.dirtyTowels === Number(r.towelUsed));
          else reject(r.status === 'occupied' && ['deliverTowel', 'deliverMeal', 'repairRoom', ...(content ? ['visitFacility'] : [])].includes(j.type));
        } else reject(!oneOf(r.status, ['checking-in', 'cleaning']));
      }
    }
    if (motion) validateMotionSave(s, { reject, equal, between });
    if (content) validateContentSave(s, { reject, equal, between, isObject, integer, oneOf });
    if (leisure) validateInspectionSave(s, { reject, equal, between, isObject, integer, oneOf });
    const t = s.actors.thief;
    reject(oneOf(t.phase, ['dormant', 'approaching', 'stealing', 'fleeing', 'gone']) && t.status === t.phase && t.job === null);
    reject(number(t.timer) && t.timer >= 0 && between(t.remaining, 0, C.thiefApproach + C.thiefWarning));
    reject(typeof t.resolved === 'boolean' && typeof t.stopped === 'boolean' && oneOf(t.outcome, [null, 'shooed', 'stole']));
    reject(isObject(s.objects) && position(s.objects.cart) && position(s.objects.bell) && position(s.objects.sprinkler) && position(s.objects.sprinkler.zone));
    reject(number(s.objects.sprinkler.zone.radius) && number(s.objects.sprinkler.wetness));
    reject(Array.isArray(s.events) && s.events.length <= 120 && integer(s.eventId));
    reject(s.events.every((e, i, all) => isObject(e) && integer(e.id) && e.id <= s.eventId && (!i || e.id > all[i - 1].id)
      && between(e.time, 0, s.time) && typeof e.type === 'string' && typeof e.text === 'string'
      && (e.x === undefined && e.y === undefined || position(e))));
    relink(s);
    if (s.version === 1) return restoreRush(migrateLegacyRush(s));
    reject(validateReputationState(s));
    return s;
  } catch { return null; }
}


/** Version-7-only invariants; no restrictions are retrofitted to old saves. */
function validateMotionSave(s, { reject, equal, between }) {
  reject(BigInt(s.money) === BigInt(s.startingMoney) + BigInt(s.earnings) - BigInt(s.costs) - BigInt(s.stolen) + coinCashDelta(s));
  reject(BigInt(s.earnings) === s.guests.reduce((n, g) => n + BigInt(g.payment), 0n) + BigInt(s.inspection.bonus));
  for (const a of staff(s)) {
    const j = a.job;
    const escorting = j && (j.type === 'assignRoom' && ['reception', 'guide'].includes(j.phase)
      || j.type === 'visitFacility' && ['escort', 'return'].includes(j.phase));
    if (!escorting) { reject(!j || !Object.hasOwn(j, 'escort')); continue; }
    const g = guestById(s, j.guestId), room = roomById(s, j.roomId);
    const guestEnd = j.type === 'assignRoom' ? j.phase === 'reception' ? C.till : room
      : j.phase === 'escort' ? s.facilities[j.facilityId] : room;
    const offset = j.type === 'assignRoom' ? j.phase === 'reception' ? { x: 40, y: 20 } : { x: 90, y: 25 } : { x: 55, y: 20 };
    reject(validEscort(j.escort, a, g, guestEnd, { x: guestEnd.x + offset.x, y: guestEnd.y + offset.y },routeRevision(s)));
    reject(j.escort.points.every(p => between(p.x, 0, C.width) && between(p.y, -2800, C.height)));
  }
  const thief = s.actors.thief;
  const approachSpeed = (distance(C.thiefEntry, { x: 950, y: 440 }) + 140 + distance({ x: 950, y: C.hallwayY }, C.till)) / C.thiefApproach;
  reject(equal(thief.speed, ['approaching', 'stealing'].includes(thief.phase) ? approachSpeed : motionSpeed(s).floor));
}

function validateInspectionSave(s, { reject, equal, between, isObject, integer, oneOf }) {
  const inspection = s.inspection, owl = s.actors.inspector;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const exactKeys = (value, keys) => isObject(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
  reject(exactKeys(inspection, ['eligible', 'phase', 'roomId', 'startedAt', 'assessments', 'checklist', 'recheckAt', 'outcome', 'bonus', 'timer']));
  const phases = ['dormant', 'reception', 'walking', 'assessing', 'recheck', 'returning', 'exiting', 'gone'];
  reject(oneOf(inspection.phase, phases) && owl.phase === inspection.phase && owl.status === inspection.phase);
  reject(inspection.eligible === (!s.config.firstStepsRules && !s.config.reputationPlan?.critic && s.config.completedShifts >= 2 && s.config.completedShifts % 3 === 2));
  reject(owl.name === 'Olive' && owl.species === 'owl' && owl.spriteKind === 'inspector'
    && owl.job === null && owl.carrying === null && owl.returningHome === false && owl.speed === floorSpeed(s));
  reject(owl.visible === !['dormant', 'gone'].includes(inspection.phase));
  reject(oneOf(inspection.bonus, [0, INSPECTION_CONFIG.bonus]) && oneOf(inspection.outcome, [null, 'clear', 'noted']));
  reject(Array.isArray(inspection.assessments) && inspection.assessments.length <= 2);
  reject(between(inspection.timer, 0, INSPECTION_CONFIG.assessmentDuration));
  if (inspection.phase !== 'assessing') reject(inspection.timer === 0);
  if (inspection.phase === 'dormant') {
    reject(inspection.roomId === null && inspection.startedAt === null && inspection.assessments.length === 0);
    reject(!inspection.eligible || s.time < INSPECTION_CONFIG.startAt);
    reject(equal(owl.x, C.entry.x) && equal(owl.y, C.entry.y) && owl.path.length === 0);
  } else {
    reject(inspection.eligible && equal(inspection.startedAt, INSPECTION_CONFIG.startAt));
    reject(s.rooms.slice(0, s.openRooms).some(room => room.id === inspection.roomId));
  }
  const validateChecklist = checklist => {
    reject(Array.isArray(checklist) && checklist.length === 3);
    for (const [index, item] of checklist.entries()) {
      reject(exactKeys(item, ['id', 'ok', 'count', 'ids']) && item.id === ['clean', 'repair', 'service'][index]);
      reject(typeof item.ok === 'boolean' && integer(item.count) && Array.isArray(item.ids) && item.ids.length === item.count);
      reject(item.ok === (item.count === 0) && new Set(item.ids).size === item.ids.length);
      const validIds = index < 2 ? s.rooms.slice(0, s.openRooms).map(room => room.id) : s.guests.map(guest => guest.id);
      reject(item.ids.every((id, i, ids) => validIds.includes(id) && (!i || validIds.indexOf(id) > validIds.indexOf(ids[i - 1]))));
    }
  };
  for (const [index, assessment] of inspection.assessments.entries()) {
    reject(exactKeys(assessment, ['at', 'checklist', 'guestSeen']) && between(assessment.at, inspection.startedAt, s.time));
    validateChecklist(assessment.checklist);
    reject(assessment.guestSeen === s.guests.some(guest => guest.roomProof && guest.roomProof.checkedInAt <= assessment.at));
    if (index) reject(equal(assessment.at, inspection.recheckAt));
  }
  const first = inspection.assessments[0], last = inspection.assessments.at(-1);
  const needsRecheck = !!first && first.checklist.some(item => !item.ok);
  reject(needsRecheck ? equal(inspection.recheckAt, first.at + INSPECTION_CONFIG.recheckDelay) : inspection.recheckAt === null);
  reject(same(inspection.checklist, last ? last.checklist : inspectionChecklist()));
  if (inspection.assessments.length === 2) reject(needsRecheck);
  const finished = ['returning', 'exiting', 'gone'].includes(inspection.phase);
  if (finished) {
    reject(!!last && (needsRecheck ? inspection.assessments.length === 2 : inspection.assessments.length === 1));
    const clear = last.checklist.every(item => item.ok);
    reject(inspection.outcome === (clear ? 'clear' : 'noted'));
    reject(inspection.bonus === (terminal(s) && clear && last.guestSeen && (!hasMotionRules(s) ||
      safeAdd(s.money - inspection.bonus, INSPECTION_CONFIG.bonus) && safeAdd(s.earnings - inspection.bonus, INSPECTION_CONFIG.bonus)) ? INSPECTION_CONFIG.bonus : 0));
  } else {
    reject(inspection.outcome === null && inspection.bonus === 0);
    reject(inspection.phase === 'recheck' ? needsRecheck && inspection.assessments.length === 1 && s.time < inspection.recheckAt
      : inspection.assessments.length === 0);
  }
  if (['assessing', 'recheck'].includes(inspection.phase)) {
    const room = roomById(s, inspection.roomId);
    reject(equal(owl.x, room.x + 100) && equal(owl.y, room.y + 40) && owl.path.length === 0 && owl.action === 'checking');
  }
  if (inspection.phase === 'gone') reject(equal(owl.x, C.entry.x) && equal(owl.y, C.entry.y) && owl.path.length === 0);
  if (terminal(s)) reject(s.result.inspectionBonus === inspection.bonus);
}

/** Validate content ledgers independently, preserving v1–v4 behavior. */
function validateContentSave(s, { reject, equal, between, isObject, integer, oneOf }) {
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b), c = s.config, k = s.kitchen;
  const exactKeys = (value, keys) => isObject(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
  reject(Array.isArray(k.recipes) && k.recipes.length === k.meals && k.recipes.every(isRecipe));
  reject(k.status === 'cooking' ? isRecipe(k.batchRecipe) : k.batchRecipe === null);
  reject(exactKeys(k.recipePrepared, RECIPE_IDS) && RECIPE_IDS.every(id => integer(k.recipePrepared[id])));
  reject(RECIPE_IDS.reduce((sum, id) => sum + k.recipePrepared[id], 0) === k.prepared);
  for (const recipe of RECIPE_IDS) {
    const initial = recipe === 'garden' ? 1 : 0;
    reject(k.recipePrepared[recipe] >= initial && (k.recipePrepared[recipe] - initial) % C.foodBatch === 0);
    const held = staff(s).filter(a => a.job?.type === 'deliverMeal' && a.job.reservedRecipe === recipe).length;
    const served = s.guests.reduce((sum, g) => sum + (Array.isArray(g.deliveredRecipes) ? g.deliveredRecipes.filter(id => id === recipe).length : 0), 0);
    reject(k.recipePrepared[recipe] === k.recipes.filter(id => id === recipe).length + held + served);
  }
  for (const a of staff(s)) {
    if (a.job?.type === 'deliverMeal') reject(isRecipe(a.job.reservedRecipe) && a.job.reservedMeal === true);
    else if (a.job) reject(!Object.hasOwn(a.job, 'reservedRecipe'));
  }
  for (const [i, g] of s.guests.entries()) {
    const expected = guestContent(c, i);
    reject(Object.entries(expected).every(([key, value]) => g[key] === value));
    reject(typeof g.reviewDropped === 'boolean');
    reject(g.reviewDropped === (g.status === 'departed' || g.status === 'leaving' && g.phase === 'leaving'
      || g.status === 'abandoned' && ['complaint-exit', 'abandoned'].includes(g.phase) && g.serviceProof?.length > 0));
    reject(Array.isArray(g.deliveredRecipes) && g.deliveredRecipes.length === g.mealsReceived && g.deliveredRecipes.every(isRecipe));
    reject(Array.isArray(g.facilityVisits) && g.facilityVisits.every(id => isVenue(s, id)));
    reject(Array.isArray(g.serviceProof) && g.serviceProof.length === g.requestIndex);
    reject(same(g.facilityVisits, g.serviceProof.filter(entry => isVenue(s, entry.kind)).map(entry => entry.kind)));
    reject(same(g.deliveredRecipes, g.serviceProof.filter(entry => entry.kind === 'meal').map(entry => entry.recipe)));
    for (const [index, proof] of g.serviceProof.entries()) {
      reject(exactKeys(proof, ['kind', 'completedAt', ...(proof.kind === 'meal' ? ['recipe']
        : cuisineRules(s) && proof.kind === 'restaurant' ? ['cuisine']
        : leisureRules(s) && isLeisure(proof.kind) ? ['performer'] : [])]));
      reject(proof.kind === g.itinerary[index] && between(proof.completedAt, isCalmShift(s)?g.admittedAt:g.arrivalAt, s.time));
      reject(!index || proof.completedAt >= g.serviceProof[index - 1].completedAt);
      if (proof.kind === 'meal') reject(isRecipe(proof.recipe));
      if (cuisineRules(s) && proof.kind === 'restaurant') reject(isCuisine(proof.cuisine) && proof.cuisine === c.restaurantCuisine);
      if (leisureRules(s) && isLeisure(proof.kind)) reject(proof.performer === performerForVenue(proof.kind, c.performerLevel).id);
      if (isVenue(s, proof.kind)) reject(venueLevel(s, proof.kind) === 1);
    }
    const beforeRoom = ['pending', 'waiting', 'checking-in'].includes(g.status);
    if (beforeRoom || g.abandoned && g.roomId === null) reject(g.roomProof === null);
    else {
      reject(exactKeys(g.roomProof, ['roomId', 'tier', 'capacity', 'checkedInAt']));
      const r = roomById(s, g.roomId);
      reject(!!r && g.roomProof.roomId === g.roomId && g.roomProof.tier === r.tier && g.roomProof.capacity === r.capacity);
      reject(roomMatchesGuest(g, r) && between(g.roomProof.checkedInAt, isCalmShift(s)?g.admittedAt:g.arrivalAt, s.time));
      reject(!g.serviceProof.length || g.roomProof.checkedInAt <= g.serviceProof[0].completedAt);
    }
    if (g.status === 'checking-in') reject(roomMatchesGuest(g, roomById(s, g.roomId)));
    const expectedReview = g.reviewDropped ? deriveGuestReview(g) : null;
    reject(same(g.review, expectedReview));
    if (g.phase.startsWith('complaint-')) reject(g.abandoned && !g.paid && g.roomProof !== null && g.serviceProof.length > 0);
    if (['reviewing', 'complaint-reviewing'].includes(g.phase)) reject((g.paid || g.abandoned) && g.visible && g.path.length === 0 && g.action === 'reviewing'
      && between(g.checkoutRemaining, EPS, .35) && equal(g.x, REVIEW_STOP.x) && equal(g.y, REVIEW_STOP.y));
  }
  reject(exactKeys(s.facilities, venueIds(s)));
  for (const originalSpec of [...FACILITIES, ...(leisureRules(s) ? LEISURE_VENUES : [])]) {
    // v4 ignores future config fields, so old snapshots cannot opt into new
    // restaurant visuals or service rules simply by acquiring a stray key.
    const spec = leisureRules(s) && isLeisure(originalSpec.id) ? leisureSpec(originalSpec, c)
      : cuisineRules(s) ? facilitySpec(originalSpec, c) : originalSpec;
    const f = s.facilities[spec.id];
    reject(isObject(f) && Object.entries(spec).every(([key, value]) => f[key] === value));
    reject(f.level === venueLevel(s, spec.id) && oneOf(f.status, ['locked', 'idle', 'escorting', 'waiting', 'servicing', 'returning']));
    reject((f.status === 'locked') === (f.level === 0));
    reject(between(f.timer, 0, c.requestPatience));
    if (['idle', 'locked'].includes(f.status)) reject(f.guestId === null && f.roomId === null && f.workerId === null && f.timer === 0);
    else {
      const g = guestById(s, f.guestId), r = roomById(s, f.roomId), a = s.actors[f.workerId], job = a?.job;
      reject(!!g && !!r && staff(s).includes(a) && !!job);
      reject(g.status === 'occupied' && g.request === 'visiting' && g.roomId === r.id && r.guestId === g.id);
      reject(r.status === 'occupied' && r.activeRequest === f.id && r.workerId === a.id);
      reject(job.type === 'visitFacility' && job.facilityId === f.id && job.guestId === g.id && job.roomId === r.id);
      reject(f.status === ({ meet: 'escorting', escort: 'escorting', waiting: 'waiting', service: 'servicing', return: 'returning' })[job.phase]);
      reject(equal(f.timer, g.roomElapsed));
      if (leisureRules(s) && isLeisure(f.id)) {
        const completedWork = Math.ceil((f.performanceDuration * c.workScale - EPS) / STEP) * STEP;
        reject(['meet', 'escort', 'waiting'].includes(job.phase) ? job.work === 0
          : job.phase === 'return' ? equal(job.work, completedWork)
            : between(job.work, 0, completedWork - STEP));
      }
      if (['waiting', 'service'].includes(job.phase)) reject(g.visible && g.path.length === 0 && a.path.length === 0
        && equal(g.x, f.x) && equal(g.y, f.y) && equal(a.x, f.x + 55) && equal(a.y, f.y + 20));
    }
  }
  if (terminal(s)) reject(same(s.result.reviews, s.guests.filter(g => g.review).map(g => ({
    guestId: g.id, guestName: g.name, customerType: g.customerType, ...copy(g.review),
  }))));
}

/** UI descriptors are read-only. Disabled actions include the exact command blocker. */
export function rushActions(s, target = null) {
  const id = typeof target === 'string' ? target : target?.id, inputs = [];
  for (const g of s.guests.filter(g => g.status === 'waiting')) for (const r of s.rooms)
    if (!id || id === g.id || id === r.id) inputs.push({ type: 'assignRoom', guestId: g.id, roomId: r.id, label: 'Check in' });
  for (const r of s.rooms) if (!id || id === r.id) for (const [type, label] of [
    ['deliverTowel', 'Towel'], ['deliverMeal', 'Meal'], ['repairRoom', 'Repair'], ['cleanRoom', 'Clean'],
  ]) inputs.push({ type, roomId: r.id, label });
  if (!id || id === 'laundry' || id === 'cart') inputs.push({ type: 'loadWash', label: 'Wash · 5' }, { type: 'finishFold', label: 'Fold' });
  if (contentRules(s)) {
    for (const r of s.rooms) if ((!id || id === r.id) && isVenue(s, r.request))
      inputs.push({ type: 'visitFacility', roomId: r.id, facilityId: r.request, label: `Visit ${s.facilities[r.request].name}` });
    for (const f of Object.values(s.facilities)) if (!id || id === f.id)
      inputs.push({ type: 'serveFacility', facilityId: f.id, label: `Serve ${f.name}` });
  }
  if (!id || id === 'kitchen') {
    if (contentRules(s)) for (const recipe of RECIPES) inputs.push({ type: 'prepFood', recipe: recipe.id, label: `${recipe.name} ×3 · 6` });
    else inputs.push({ type: 'prepFood', label: 'Cook 3 · 6' });
  }
  if (!id || id === 'thief') inputs.push({ type: 'callOutThief', label: 'Stop thief' });
  return inputs.map(input => { const result = canRushCommand(s, input); return {
    id: input.type, ...input, enabled: result.ok, reason: result.message, workerId: result.workerId || null,
  }; });
}
