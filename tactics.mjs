/**
 * Hands-on Copperleaf tactics. No schedules, jobs, waiting timer, or idle threat.
 * A committed player action animates, then Rook takes exactly one visible turn.
 * All gameplay state is plain JSON and all animation uses deterministic ticks.
 */
export const TACTICS_CONFIG = Object.freeze({
  width: 1200, height: 700, fixedStep: 1 / 60, proximity: 100, minMove: 20,
  startingMoney: 120, serviceReward: 75, cartCost: 8, sprinklerCost: 12,
  speeds: { courier: 340, mechanic: 310, guest: 380, thief: 440, cart: 600 },
  starts: { courier: { x: 430, y: 610 }, mechanic: { x: 720, y: 535 } },
  guest: { x: 600, y: 575 }, thief: { x: 1140, y: 535 },
  bell: { x: 450, y: 440 }, cart: { x: 650, y: 440 },
  sprinkler: { x: 965, y: 515 }, wetZone: { x: 850, y: 440, radius: 95 },
  cartExitX: 1090, till: { x: 290, y: 300 },
  rookRoute: [
    { x: 1080, y: 440 }, { x: 1010, y: 440 }, { x: 940, y: 440 },
    { x: 880, y: 440 }, { x: 810, y: 440 }, { x: 740, y: 440 },
    { x: 650, y: 440 }, { x: 560, y: 440 }, { x: 450, y: 440 },
    { x: 350, y: 350 }, { x: 290, y: 300 },
  ],
});
export const CONFIG = TACTICS_CONFIG;
const copy = value => JSON.parse(JSON.stringify(value));
const point = value => ({ x: value.x, y: value.y });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const terminal = state => state.status === 'won' || state.status === 'lost';
const workerIds = ['courier', 'mechanic'];
const aliases = { pip: 'courier', bramble: 'mechanic', rook: 'thief', willow: 'guest' };
const actorId = id => aliases[id] || id;
const actor = (id, name, species, position) => ({
  id, name, species, ...point(position), visible: true, facing: 1,
  action: 'idle', intent: 'Choose a destination or a nearby object.',
  target: null, path: [], moving: false, progress: 0, walkTime: 0,
  speed: CONFIG.speeds[id], carrying: null, job: null, queue: [],
  slipRemaining: 0, collisions: 0, wetContact: false,
});

export function createTactics(options = {}) {
  const state = {
    version: 2, mode: 'tactics', status: 'playing', paused: false,
    turn: 0, time: 0, ticks: 0, accumulator: 0, busy: false, action: null,
    selectedActor: 'courier', money: CONFIG.startingMoney, earnings: 0, costs: 0,
    stolen: 0, happiness: 85, reputation: 3, result: null,
    settings: copy(options.settings || {}), objectives: { guest: false, thief: false },
    actors: {
      courier: actor('courier', 'Pip', 'fox', CONFIG.starts.courier),
      mechanic: actor('mechanic', 'Bramble', 'badger', CONFIG.starts.mechanic),
      guest: { ...actor('guest', 'Mrs. Willow', 'rabbit', CONFIG.guest),
        phase: 'waiting', served: false, escorted: false, welcomed: false,
        injured: false, paid: false, payment: 0, resolved: false,
        intent: 'Waiting for fresh linen. Pip can fetch some from the cart.' },
      thief: { ...actor('thief', 'Rook', 'raccoon', CONFIG.thief),
        phase: 'toTill', routeIndex: 0, resolved: false, stopped: false,
        outcome: null, intent: 'Moves one marked step after each completed action.' },
    },
    objects: {
      bell: { ...point(CONFIG.bell), bay: 'west', active: false, remaining: 0,
        cooldown: 0, carrier: null, serial: 0, lastRingSpot: null },
      cart: { ...point(CONFIG.cart), bay: 'middle', moving: false, armed: false,
        carrying: null, carrier: null, spent: false, charged: false,
        linenAvailable: true, progress: 0, startX: CONFIG.cart.x, hit: [] },
      sprinkler: { ...point(CONFIG.sprinkler), active: false, charged: false,
        wetness: 0, zone: copy(CONFIG.wetZone) },
    },
    events: [], eventId: 0, undoStack: [], pendingUndo: null,
    canUndo: false, undoCount: 0,
    lastFeedback: 'Your turn. Walk Pip to the cart for linen, or try a defense first.',
  };
  refreshRoute(state);
  log(state, 'system', 'Rook is already at the gate. He only moves after you act.');
  return state;
}

function log(state, type, text, position, short) {
  state.events.push({ id: ++state.eventId, time: state.time, turn: state.turn,
    type, text, ...(position ? point(position) : {}), ...(short ? { short } : {}) });
  if (state.events.length > 80) state.events.shift();
}
function reply(state, ok, message, extra = {}) {
  state.lastFeedback = message;
  return { ok, message, ...extra };
}
function refreshRoute(state) {
  const thief = state.actors.thief;
  state.route = thief.stopped ? [] : copy(CONFIG.rookRoute.slice(thief.routeIndex));
  state.rookRoute = copy(state.route);
  state.nextRookPosition = state.route.length ? point(state.route[0]) : null;
  state.turnsRemaining = thief.stopped ? null : state.route.length;
  state.canUndo = state.undoStack.length > 0 && !state.busy;
  state.undoCount = state.undoStack.length;
}
function stableSnapshot(state) {
  const { undoStack, pendingUndo, ...rest } = state;
  return copy({ ...rest, busy: false, action: null, accumulator: 0 });
}
export function tacticsSnapshot(state) { return copy(state); }
function replaceState(state, replacement) {
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, replacement);
}
function nearby(state, who, targetId) {
  const target = state.objects[targetId] || state.actors[targetId];
  return target && distance(state.actors[who], target) <= CONFIG.proximity + 1e-8;
}
function interactionReason(state, who, targetId, operation) {
  const a = state.actors[who], b = state.objects.bell, c = state.objects.cart;
  const g = state.actors.guest;
  if (!a || !workerIds.includes(who)) return 'Choose Pip or Bramble first.';
  if (terminal(state)) return 'Undo or retry to try another move.';
  if (state.busy) return 'Let this action finish first.';
  if (state.paused) return 'Resume before taking an action.';
  if (!nearby(state, who, targetId)) return `Walk closer first (within ${CONFIG.proximity} floor units).`;
  switch (operation) {
    case 'takeLinen':
      if (who !== 'courier') return 'Pip handles the guest linen.';
      if (g.served) return 'Mrs. Willow already has fresh linen.';
      if (a.carrying) return `Put down the ${a.carrying} first.`;
      if (!c.linenAvailable) return 'The linen has already been collected.';
      return '';
    case 'serveGuest':
      if (who !== 'courier') return 'Pip welcomes the guest.';
      if (g.served) return 'Mrs. Willow has already been served.';
      if (g.injured) return 'Undo the accident or retry to help Mrs. Willow.';
      if (a.carrying !== 'linen') return 'Collect fresh linen from the cart first.';
      return '';
    case 'takeBell':
      if (who !== 'courier') return 'Pip carries and rings the bell.';
      if (a.carrying) return `Put down the ${a.carrying} first.`;
      if (b.carrier) return 'Pip is already holding the bell.';
      return '';
    case 'placeBell':
      if (who !== 'courier' || b.carrier !== who) return 'Pick up the bell first.';
      return '';
    case 'ringBell':
      if (who !== 'courier') return 'Pip rings the bell.';
      if (a.carrying === 'linen') return 'Serve the guest before ringing the bell.';
      if (b.lastRingSpot && distance(b, b.lastRingSpot) < CONFIG.minMove)
        return 'Move the bell to a new spot before ringing again.';
      if (state.actors.thief.stopped && g.served) return 'Both objectives are complete.';
      return '';
    case 'takeCart':
      if (who !== 'mechanic') return 'Bramble handles the heavy cart.';
      if (a.carrying) return `Put down the ${a.carrying} first.`;
      if (c.spent) return 'This cart has already been pushed. Undo to try again.';
      if (c.carrier) return 'Bramble is already holding the cart.';
      return '';
    case 'placeCart':
      if (who !== 'mechanic' || c.carrier !== who) return 'Take the cart handle first.';
      return '';
    case 'pushCart':
      if (who !== 'mechanic') return 'Bramble handles the heavy cart.';
      if (c.spent) return 'This cart has already been pushed. Undo to try again.';
      if (c.x >= CONFIG.cartExitX - 20) return 'Move the cart left to give it room to roll.';
      if (!c.charged && state.money < CONFIG.cartCost) return 'The cart needs $8 for repairs.';
      return '';
    case 'toggleSprinkler':
      if (who !== 'mechanic') return 'Bramble turns the garden valve.';
      if (a.carrying) return 'Release the cart handle before turning the valve.';
      if (!state.objects.sprinkler.active && !state.objects.sprinkler.charged && state.money < CONFIG.sprinklerCost)
        return 'The water supply costs $12.';
      return '';
    default: return 'That action is not available here.';
  }
}

/** Descriptors are safe to display: inspecting them never spends a turn. */
export function availableActions(state, who = state.selectedActor, targetId) {
  who = actorId(who);
  if (!targetId) return [];
  const b = state.objects.bell, c = state.objects.cart, sp = state.objects.sprinkler;
  const definitions = {
    cart: [
      ['takeLinen', 'Take fresh linen', 0],
      [c.carrier === who ? 'placeCart' : 'takeCart', c.carrier === who ? 'Release cart handle' : 'Take cart handle', 0],
      ['pushCart', `Push cart right${c.charged ? '' : ' · $8'}`, c.charged ? 0 : CONFIG.cartCost],
    ],
    bell: [
      [b.carrier === who ? 'placeBell' : 'takeBell', b.carrier === who ? 'Place bell here' : 'Pick up bell', 0],
      ['ringBell', 'Ring bell · lure Rook here', 0],
    ],
    sprinkler: [[ 'toggleSprinkler', sp.active ? 'Turn water off' : `Turn water on${sp.charged ? '' : ' · $12'}`, !sp.active && !sp.charged ? CONFIG.sprinklerCost : 0 ]],
    guest: [['serveGuest', 'Serve fresh linen · earn $75', 0]],
  };
  return (definitions[targetId] || []).map(([id, label, cost]) => {
    const reason = interactionReason(state, who, targetId, id);
    return { id, action: id, label, enabled: !reason, reason, cost, turnCost: 1,
      actorId: who, targetId };
  });
}

/** The UI may preview and confirm without committing or mutating any state. */
export function previewMove(state, x, y, who = state.selectedActor) {
  who = actorId(who);
  const a = state.actors[who];
  let reason = '';
  if (!a || !workerIds.includes(who)) reason = 'Choose Pip or Bramble first.';
  else if (!Number.isFinite(x) || !Number.isFinite(y)) reason = 'Choose a floor destination.';
  else if (terminal(state)) reason = 'Undo or retry to try another move.';
  else if (state.busy) reason = 'Let this action finish first.';
  else if (state.paused) reason = 'Resume before moving.';
  const destination = { x: clamp(Number.isFinite(x) ? x : 0, 140, 1140), y: clamp(Number.isFinite(y) ? y : 0, 280, 610) };
  const d = a ? distance(a, destination) : 0;
  if (!reason && d < CONFIG.minMove) reason = 'Choose a spot at least 20 floor units away.';
  return { ...destination, destination, actorId: who, ok: !reason, valid: !reason,
    reason, message: reason || `Walk ${a.name} here. Rook then takes one step.`,
    distance: d, turnCost: 1, cost: 1, path: [destination],
    nextRookPosition: state.nextRookPosition ? point(state.nextRookPosition) : null };
}

function startAction(state, action) {
  state.pendingUndo = stableSnapshot(state);
  state.busy = true; state.canUndo = false;
  state.action = { ...action, phase: 'player', elapsed: 0, progress: 0 };
  state.objects.bell.active = false;
  const a = state.actors[action.actorId];
  a.progress = 0; a.intent = action.label;
  if (action.kind === 'move') {
    a.target = point(action.target); a.path = [point(action.target)];
    a.action = 'walking'; a.moving = true;
    state.action.distance = distance(a, action.target);
    state.action.moveSpeed = Math.max(a.speed, state.action.distance / 1.3);
  } else {
    const poses = { takeLinen: 'collecting', serveGuest: 'guiding', takeBell: 'lifting',
      placeBell: 'placing', ringBell: 'ringing', takeCart: 'lifting',
      placeCart: 'placing', pushCart: 'pushing', toggleSprinkler: 'turning' };
    a.action = poses[action.operation] || 'working'; a.moving = false;
    a.target = point(state.objects[action.targetId] || state.actors[action.targetId]);
    a.path = []; a.job = { type: action.operation };
  }
  log(state, 'order', action.label, a);
}

/** Mutates state. Rejected and duplicate commands never advance or charge. */
export function tacticsCommand(state, input = {}) {
  input ||= {};
  const type = input.type;
  if (type === 'retry' || type === 'reset') {
    replaceState(state, createTactics({ settings: state.settings }));
    return reply(state, true, 'Fresh start. Rook waits for your next action.');
  }
  if (type === 'undo') {
    if (state.busy) return reply(state, false, 'Let this action finish, then undo the whole turn.');
    if (!state.undoStack.length) return reply(state, false, 'No completed action to undo yet.');
    const stack = state.undoStack;
    const previous = stack.pop();
    replaceState(state, { ...copy(previous), undoStack: stack, pendingUndo: null });
    refreshRoute(state);
    return reply(state, true, 'Last turn undone, including movement, money, and consequences.');
  }
  if (type === 'pause' || type === 'resume' || type === 'play') {
    if (terminal(state)) return reply(state, false, 'This round is complete. Undo or retry.');
    state.paused = type === 'pause' ? (typeof input.paused === 'boolean' ? input.paused : true) : false;
    state.status = state.paused ? 'paused' : 'playing';
    return reply(state, true, state.paused ? 'Paused. Every character and action is frozen.' : 'Your turn. Rook only moves after you act.');
  }
  if (terminal(state)) return reply(state, false, 'This round is complete. Undo or retry.');
  if (state.busy) return reply(state, false, 'Let this action finish first. There is no action queue.');
  const who = actorId(input.actorId || input.actor || state.selectedActor);
  if (type === 'select') {
    if (!workerIds.includes(who)) return reply(state, false, 'Select Pip or Bramble.');
    state.selectedActor = who;
    return reply(state, true, `${state.actors[who].name} selected. Choosing a character is free.`, { turnCost: 0 });
  }
  if (type === 'move') {
    const preview = previewMove(state, input.x ?? input.target?.x, input.y ?? input.target?.y, who);
    if (!preview.ok) return reply(state, false, preview.reason);
    startAction(state, { kind: 'move', actorId: who, target: preview.destination,
      label: `${state.actors[who].name}: walk to the marked spot.` });
    return reply(state, true, state.action.label, { turnCost: 1 });
  }
  const operation = input.action || input.operation || (type !== 'interact' ? type : null);
  const targetForOperation = { takeLinen: 'cart', serveGuest: 'guest', takeBell: 'bell',
    placeBell: 'bell', ringBell: 'bell', takeCart: 'cart', placeCart: 'cart',
    pushCart: 'cart', toggleSprinkler: 'sprinkler' };
  const targetId = input.targetId || input.target || targetForOperation[operation];
  if (!operation || !targetForOperation[operation] || targetId !== targetForOperation[operation])
    return reply(state, false, 'Choose a nearby object action or a floor destination.');
  const reason = interactionReason(state, who, targetId, operation);
  if (reason) return reply(state, false, reason);
  const descriptor = availableActions(state, who, targetId).find(item => item.id === operation);
  startAction(state, { kind: 'interact', operation, actorId: who, targetId,
    duration: operation === 'serveGuest' ? 0.48 : 0.32,
    label: `${state.actors[who].name}: ${descriptor?.label || operation}.` });
  return reply(state, true, state.action.label, { turnCost: 1 });
}

function rest(a, intent) {
  a.moving = false; a.target = null; a.path = []; a.progress = 0; a.job = null;
  if (a.action !== 'slipping' && a.phase !== 'inCart') a.action = 'idle';
  if (intent) a.intent = intent;
}
function walk(a, target, dt, speed = a.speed) {
  const d = distance(a, target);
  if (d < 1e-7) { Object.assign(a, point(target)); a.moving = false; return true; }
  const amount = Math.min(d, speed * dt), dx = target.x - a.x;
  a.x += dx / d * amount; a.y += (target.y - a.y) / d * amount;
  if (Math.abs(dx) > 0.01) a.facing = dx < 0 ? -1 : 1;
  a.moving = true; a.action = 'walking'; a.walkTime += dt;
  const arrived = amount >= d - 1e-7;
  if (arrived) Object.assign(a, point(target));
  return arrived;
}
function syncCarriedObjects(state) {
  for (const id of ['bell', 'cart']) {
    const o = state.objects[id];
    if (!o.carrier) continue;
    const a = state.actors[o.carrier];
    o.x = a.x + (id === 'cart' ? 34 : 16); o.y = a.y;
    o.bay = 'custom';
  }
}
function charge(state, object, amount) {
  if (object.charged) return;
  object.charged = true; state.money -= amount; state.costs += amount;
}
function stopRook(state, outcome) {
  const t = state.actors.thief;
  t.stopped = true; t.resolved = true; t.outcome = outcome;
  state.objectives.thief = true;
  if (outcome === 'slipped') {
    rest(t); t.action = 'slipping'; t.phase = 'stopped'; t.slipRemaining = 1;
    t.intent = 'Distracted by the bell, caught by the wet floor.';
    log(state, 'success', 'Splash! The bell distracted Rook and the wet floor stopped him.', t, 'SPLASH!');
  } else {
    t.phase = 'inCart'; t.action = 'riding'; t.moving = false;
    t.intent = 'Caught in the laundry cart. The till is safe.';
    log(state, 'hit-thief', 'Caught! Bramble rolled the cart straight into Rook.', t, 'CAUGHT!');
  }
}
function hurtGuest(state, cause) {
  const g = state.actors.guest;
  if (g.injured) return;
  g.injured = true; g.resolved = true; g.phase = 'injured'; g.action = 'slipping';
  g.moving = false; g.path = []; g.target = null; g.slipRemaining = 1;
  g.intent = cause === 'cart' ? 'The cart struck Mrs. Willow.' : 'Mrs. Willow followed the bell into the wet floor.';
  state.happiness = Math.max(0, state.happiness - 60);
  state.reputation = Math.max(0, state.reputation - 1);
  if (g.paid) { state.money -= g.payment; state.earnings -= g.payment; g.payment = 0; g.paid = false; }
  log(state, 'hit-guest', `${g.intent} Undo this turn to try another approach.`, g, 'GUEST HURT');
}
function beginRookStep(state) {
  const t = state.actors.thief;
  if (t.stopped) { finishTurn(state); return; }
  const next = CONFIG.rookRoute[t.routeIndex];
  if (!next) { finishTurn(state); return; }
  state.action.phase = 'rook'; state.action.progress = 0;
  t.target = point(next); t.path = [point(next)];
  t.intent = 'Taking one step toward the till.'; t.action = 'walking'; t.moving = true;
  state.action.rookDistance = distance(t, next);
  state.action.rookSpeed = Math.max(t.speed, state.action.rookDistance / 0.55);
}
function beginLure(state) {
  const b = state.objects.bell, t = state.actors.thief, g = state.actors.guest;
  b.active = true; b.serial++; b.lastRingSpot = point(b);
  state.action.phase = 'lure'; state.action.lureTarget = point(b);
  state.action.lureActors = [];
  state.action.lureSpeeds = {};
  if (!t.stopped) state.action.lureActors.push('thief');
  if (!g.served && !g.injured) state.action.lureActors.push('guest');
  for (const id of state.action.lureActors) {
    const a = state.actors[id]; a.target = point(b); a.path = [point(b)];
    a.intent = 'Following the sound of the bell.'; a.moving = true; a.phase = 'investigating';
    state.action.lureSpeeds[id] = Math.max(a.speed, distance(a, b) / (id === 'thief' ? 0.55 : 0.9));
  }
  log(state, 'bell', g.served ? 'Ding! Rook investigates. Mrs. Willow is settled and ignores it.' : 'Ding! Rook AND the unserved guest investigate.', b, 'DING!');
}
function completePlayerAction(state) {
  const action = state.action, a = state.actors[action.actorId];
  const c = state.objects.cart, b = state.objects.bell, sp = state.objects.sprinkler;
  state.turn++;
  rest(a, a.carrying ? `Carrying ${a.carrying}. Choose where to walk.` : 'Your move. Choose a destination or nearby action.');
  if (action.kind === 'interact') switch (action.operation) {
    case 'takeLinen':
      c.linenAvailable = false; a.carrying = 'linen';
      a.intent = 'Fresh linen collected. Walk to Mrs. Willow, then serve her.';
      log(state, 'linen', 'Pip has fresh linen. Walk to Mrs. Willow next.', a, 'LINEN READY');
      break;
    case 'serveGuest': {
      const g = state.actors.guest;
      a.carrying = null; g.served = true; g.escorted = true; g.welcomed = true;
      g.paid = true; g.payment = CONFIG.serviceReward; g.resolved = true;
      g.phase = 'settled'; g.intent = 'Fresh linen delivered. Happily settled and ignoring the bell.';
      state.money += CONFIG.serviceReward; state.earnings += CONFIG.serviceReward;
      state.happiness = Math.min(100, state.happiness + 15); state.objectives.guest = true;
      log(state, 'reward', 'Fresh linen delivered! Mrs. Willow paid $75 and now ignores the bell.', g, '+$75');
      break;
    }
    case 'takeBell': b.carrier = a.id; a.carrying = 'bell'; syncCarriedObjects(state); break;
    case 'placeBell': b.carrier = null; a.carrying = null; b.bay = 'custom'; break;
    case 'takeCart': c.carrier = a.id; a.carrying = 'cart'; syncCarriedObjects(state); break;
    case 'placeCart': c.carrier = null; a.carrying = null; c.bay = 'custom'; break;
    case 'toggleSprinkler':
      sp.active = !sp.active; sp.wetness = sp.active ? 1 : 0;
      if (sp.active) charge(state, sp, CONFIG.sprinklerCost);
      log(state, 'water', sp.active ? 'Water on. Rook notices wet floors unless the bell distracts him.' : 'Water off. The garden lane is safe again.', sp, sp.active ? 'WATER ON' : 'WATER OFF');
      break;
    case 'ringBell': beginLure(state); return;
    case 'pushCart':
      charge(state, c, CONFIG.cartCost); c.carrier = null; a.carrying = null;
      c.spent = true; c.moving = true; c.startX = c.x; c.progress = 0;
      action.phase = 'cart';
      log(state, 'cart', 'Bramble pushes right. The cart only hits people in its lane.', c, 'SHOVE!');
      return;
  }
  beginRookStep(state);
}

function finishResult(state, won, reason) {
  state.status = won ? 'won' : 'lost';
  state.result = { title: won ? 'A hands-on hotel hero!' : 'Try a different move', reason,
    stars: won ? 3 : 0, net: state.earnings - state.costs - state.stolen,
    earned: state.earnings, spent: state.costs, stolen: state.stolen,
    solution: state.actors.thief.outcome, happiness: state.happiness, turn: state.turn };
  log(state, won ? 'success' : 'failure', reason);
  state.lastFeedback = reason;
}
function finishTurn(state) {
  const t = state.actors.thief, g = state.actors.guest;
  if (state.pendingUndo) state.undoStack.push(state.pendingUndo);
  state.pendingUndo = null; state.busy = false; state.action = null; state.accumulator = 0;
  for (const a of Object.values(state.actors)) {
    if (a.id === 'thief' && a.phase === 'inCart') { a.target = null; a.path = []; a.moving = false; }
    else if (!a.injured && a.action !== 'slipping') rest(a);
  }
  if (g.injured) finishResult(state, false, 'Mrs. Willow was hurt. Undo the last turn, or retry with a safer lane.');
  else if (!t.stopped && t.routeIndex >= CONFIG.rookRoute.length) {
    state.stolen = Math.min(80, state.money); state.money -= state.stolen;
    t.phase = 'stealing'; t.action = 'stealing'; t.carrying = 'coins'; t.outcome = 'escaped';
    finishResult(state, false, `Rook reached the till and took $${state.stolen}. Undo to try another move.`);
  } else if (g.served && t.stopped) {
    finishResult(state, true, `Guest served, till protected. ${t.outcome === 'cart' ? 'A well-aimed laundry-cart shove!' : 'A bell, a puddle, and one surprised raccoon!'}`);
  } else {
    state.lastFeedback = t.stopped ? 'Rook is stopped. Take your time delivering fresh linen to Mrs. Willow.' : 'Your turn. Rook waits until you finish your next action.';
  }
  refreshRoute(state);
}
function insideWater(state, a) {
  const sp = state.objects.sprinkler;
  return sp.active && distance(a, sp.zone) <= sp.zone.radius;
}
function updateCart(state, dt) {
  const c = state.objects.cart, previousX = c.x;
  c.x = Math.min(CONFIG.cartExitX, c.x + CONFIG.speeds.cart * dt);
  c.progress = (c.x - c.startX) / Math.max(1, CONFIG.cartExitX - c.startX);
  // Swept collision avoids tunnelling at any supported frame duration.
  for (const id of ['guest', 'thief']) {
    const a = state.actors[id];
    if (c.hit.includes(id) || a.injured || a.stopped) continue;
    if (Math.abs(a.y - c.y) <= 34 && a.x >= previousX - 20 && a.x <= c.x + 38) {
      c.hit.push(id); a.collisions++;
      if (id === 'thief') { c.carrying = 'thief'; stopRook(state, 'cart'); }
      else hurtGuest(state, 'cart');
    }
  }
  if (c.carrying === 'thief') Object.assign(state.actors.thief, { x: c.x, y: c.y - 5 });
  if (c.x >= CONFIG.cartExitX) {
    c.moving = false;
    if (!c.carrying) log(state, 'risk', 'The cart rolled past without catching Rook. Undo to change the timing or lane.', c, 'MISSED');
    if (state.actors.guest.injured) finishTurn(state); else beginRookStep(state);
  }
}
function updateLure(state, dt) {
  const action = state.action;
  let remaining = 0;
  for (const id of action.lureActors) {
    const a = state.actors[id];
    if (a.stopped || a.injured || a.lureArrived) continue;
    const arrived = walk(a, action.lureTarget, dt, action.lureSpeeds[id]);
    if (insideWater(state, a)) {
      if (id === 'thief') stopRook(state, 'slipped'); else hurtGuest(state, 'water');
    } else if (arrived) {
      a.lureArrived = true; rest(a);
      a.intent = id === 'thief' ? 'A harmless bell. Rook is still a threat.' : 'Curious about the bell. Still waiting for linen.';
    } else remaining++;
  }
  if (remaining === 0) {
    for (const a of Object.values(state.actors)) delete a.lureArrived;
    const t = state.actors.thief;
    if (!t.stopped) t.routeIndex++;
    if (!t.stopped) log(state, 'risk', 'Rook reached the bell safely. Put the bell in the wet garden for a slippery surprise.', t, 'DRY FLOOR');
    finishTurn(state);
  }
}
function tick(state, dt) {
  state.ticks++; state.time = state.ticks * CONFIG.fixedStep;
  const action = state.action;
  action.elapsed += dt;
  if (action.phase === 'player') {
    const a = state.actors[action.actorId];
    let done;
    if (action.kind === 'move') {
      done = walk(a, action.target, dt, action.moveSpeed);
      action.progress = 1 - distance(a, action.target) / Math.max(1, action.distance);
    } else {
      action.progress = clamp(action.elapsed / action.duration, 0, 1);
      a.progress = action.progress;
      done = action.progress >= 1 - 1e-9;
    }
    syncCarriedObjects(state);
    if (done) completePlayerAction(state);
  } else if (action.phase === 'rook') {
    const t = state.actors.thief;
    const done = walk(t, t.target, dt, action.rookSpeed);
    action.progress = 1 - distance(t, t.target) / Math.max(1, action.rookDistance);
    if (done) { t.routeIndex++; rest(t, 'Waiting for your next completed action.'); finishTurn(state); }
  } else if (action.phase === 'cart') updateCart(state, dt);
  else if (action.phase === 'lure') updateLure(state, dt);
}

/** Idle and paused calls are exact no-ops. A large dt cannot create extra turns. */
export function stepTactics(state, dt) {
  if (!state.busy || state.paused || terminal(state) || !Number.isFinite(dt) || dt <= 0) return state;
  state.accumulator += Math.min(dt, 60);
  while (state.busy && !state.paused && !terminal(state) && state.accumulator + 1e-10 >= CONFIG.fixedStep) {
    state.accumulator = Math.max(0, state.accumulator - CONFIG.fixedStep);
    tick(state, CONFIG.fixedStep);
  }
  return state;
}
