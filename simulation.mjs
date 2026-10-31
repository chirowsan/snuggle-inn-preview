/**
 * Mischief at Copperleaf: deterministic, dependency-free simulation.
 * All coordinates are feet-on-floor positions in a 1200 x 700 scene.
 * Commands never advance the clock. Jobs can be planned while paused.
 */
export const CONFIG = Object.freeze({
  width: 1200, height: 700, timeLimit: 75, fixedStep: 1 / 60,
  startingMoney: 120, roomPrice: 60, serviceTip: 15, theftAmount: 80,
  bellDuration: 24, bellCooldown: 8, cartCost: 8, sprinklerCost: 12,
  guestArrival: 3, thiefArrival: 14,
  speeds: { courier: 78, mechanic: 68, guest: 65, thief: 70, cart: 175 },
  reception: { x: 245, y: 270 }, guestRoom: { x: 480, y: 230 },
  guestEntry: { x: 600, y: 575 }, thiefEntry: { x: 1185, y: 535 },
  thiefLookout: { x: 950, y: 440 }, till: { x: 290, y: 300 },
  cartExit: { x: 1070, y: 440 }, fountain: { x: 1010, y: 280 },
  sprinklerValve: { x: 965, y: 515 }, wetZone: { x: 850, y: 440, radius: 95 },
  bays: {
    west: { x: 450, y: 440, label: 'Lobby' },
    middle: { x: 650, y: 440, label: 'Courtyard' },
    terrace: { x: 850, y: 440, label: 'Sprinkler' },
  },
  starts: { courier: { x: 535, y: 565 }, mechanic: { x: 720, y: 535 } },
  guestRoute: [{ x: 600, y: 510 }, { x: 420, y: 510 }, { x: 420, y: 300 }, { x: 245, y: 270 }],
  thiefRoute: [{ x: 950, y: 440 }, { x: 950, y: 300 }, { x: 290, y: 300 }],
});

const copy = value => JSON.parse(JSON.stringify(value));
const point = p => ({ x: p.x, y: p.y });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const terminal = s => s.status === 'won' || s.status === 'lost';
const actor = (id, name, species, p, visible = true) => ({
  id, name, species, ...point(p), visible, action: 'idle', intent: 'Ready for a job',
  target: null, path: [], progress: 0, facing: 1, moving: false, walkTime: 0,
  speed: CONFIG.speeds[id], job: null, queue: [], carrying: null, returningHome: false,
  slipRemaining: 0, wetContact: false, wetFloorImmune: false, collisions: 0, heardBell: 0,
});

export function createGame(options = {}) {
  const s = {
    version: 1, status: 'planning', paused: true, time: 0, timeLimit: CONFIG.timeLimit,
    ticks: 0, accumulator: 0, money: CONFIG.startingMoney, earnings: 0, costs: 0,
    stolen: 0, happiness: 85, reputation: 3, result: null,
    settings: copy(options.settings || {}), upgrade: options.upgrade || null,
    actors: {
      courier: actor('courier', 'Pip', 'fox', CONFIG.starts.courier),
      mechanic: actor('mechanic', 'Bramble', 'badger', CONFIG.starts.mechanic),
      guest: { ...actor('guest', 'Mrs. Willow', 'rabbit', CONFIG.guestEntry, false),
        phase: 'arriving', intent: 'Arrives at 0:03 · check in, then room', routeIndex: 0,
        escorted: false, welcomed: false, welcomeTip: 0, injured: false, paid: false, payment: 0, timer: 0, resolved: false },
      thief: { ...actor('thief', 'Rook', 'raccoon', CONFIG.thiefEntry, false),
        phase: 'arriving', intent: 'Arrives at 0:14 · case the lobby, then steal', routeIndex: 0,
        timer: 0, resolved: false, stopped: false, outcome: null, cased: false },
    },
    objects: {
      bell: { ...point(CONFIG.bays.west), bay: 'west', active: false, remaining: 0,
        cooldown: 0, serial: 0, carrier: null },
      sprinkler: { ...point(CONFIG.sprinklerValve), active: false, charged: false, wetness: 0,
        zone: copy(CONFIG.wetZone) },
      cart: { ...point(CONFIG.bays.middle), bay: 'middle', moving: false, armed: false,
        carrying: null, spent: false, carrier: null, progress: 0, startX: CONFIG.bays.middle.x,
        hit: [] },
    },
    events: [], eventId: 0, lastFeedback: 'Plan first. The clock starts only when you press Play.',
  };
  // Purchases and persistence belong to the UI. Only a recognized selection
  // changes this shift; recreating a shift cannot stack a speed multiplier.
  if (s.upgrade === 'swift-service') s.actors.courier.speed = CONFIG.speeds.courier * 1.2;
  if (s.upgrade === 'crew-boots') {
    s.actors.courier.wetFloorImmune = true;
    s.actors.mechanic.wetFloorImmune = true;
  }
  log(s, 'system', 'The till holds $120. Welcome the guest and send the thief packing.');
  return s;
}

function log(s, type, text) {
  s.events.push({ id: ++s.eventId, time: s.time, type, text });
  if (s.events.length > 50) s.events.shift();
}

function reply(s, ok, message, extra = {}) {
  s.lastFeedback = message;
  return { ok, message, ...extra };
}

function sameJob(a, b) {
  return a.type === b.type && a.bay === b.bay && a.enabled === b.enabled && a.immediate === b.immediate;
}

function enqueue(s, who, job) {
  const a = s.actors[who];
  if ([a.job, ...a.queue].filter(Boolean).some(j => sameJob(j, job))) {
    return reply(s, true, `${a.name} already has that job.`, { duplicate: true });
  }
  if (a.queue.length >= 5) return reply(s, false, `${a.name}'s plan is full. Cancel a job first.`);
  a.queue.push({ ...job, stage: 0, work: 0, totalWork: 0 });
  if (!a.job) prepareJob(s, a);
  log(s, 'order', `${a.name}: ${job.label}.`);
  return reply(s, true, `${a.name}: ${job.label}.`, { queued: true, actor: who });
}

/** Mutates state and returns {ok, message, queued?, duplicate?}. */
export function command(s, input = {}) {
  input = input || {};
  const type = input.type;
  if (type === 'reset' || type === 'retry') {
    const fresh = createGame({ settings: s.settings, upgrade: s.upgrade });
    for (const key of Object.keys(s)) delete s[key];
    Object.assign(s, fresh);
    return reply(s, true, 'Fresh shift. Your settings are unchanged.');
  }
  if (terminal(s)) return reply(s, false, 'This shift is over. Retry to make a new plan.');
  if (type === 'play' || type === 'resume') {
    s.status = 'playing'; s.paused = false;
    return reply(s, true, 'Shift running. Pause at any time to change the plan.');
  }
  if (type === 'pause') {
    if (s.status !== 'planning') s.status = 'paused';
    s.paused = true;
    return reply(s, true, 'Paused. Orders are safe to change; nobody moves.');
  }
  if (type === 'cancelJob' || type === 'cancel') {
    const a = s.actors[input.actor];
    if (!a || !['courier', 'mechanic'].includes(a.id)) return reply(s, false, 'Choose Pip or Bramble to cancel a job.');
    const hadJob = a.job || a.queue.length || a.returningHome;
    if (s.objects.bell.carrier === a.id) {
      s.objects.bell.carrier = null; s.objects.bell.bay = nearestBay(s.objects.bell);
    }
    if (s.objects.cart.carrier === a.id) s.objects.cart.carrier = null;
    if (a.job?.type === 'pushCart') s.objects.cart.armed = false;
    if (a.job?.type === 'escortGuest') s.actors.guest.beingServed = false;
    a.job = null; a.queue.length = 0; a.path = []; a.target = null; a.returningHome = false;
    a.carrying = null; a.action = 'idle'; a.moving = false; a.intent = 'Ready for a new plan'; a.progress = 0;
    return reply(s, true, hadJob ? `${a.name}'s plan cleared.` : `${a.name} is already free.`, { duplicate: !hadJob });
  }
  if (type === 'escortGuest' || type === 'luggageService') {
    const g = s.actors.guest;
    if (g.escorted) return reply(s, true, 'The guest already has luggage service and will ignore the bell.', { duplicate: true });
    if (g.injured || g.resolved) return reply(s, false, 'Luggage service is no longer useful for this guest.');
    return enqueue(s, 'courier', { type: 'escortGuest', label: 'Fetch cart linen, then welcome the guest' });
  }
  if (type === 'placeBell') {
    if (!CONFIG.bays[input.bay]) return reply(s, false, 'Choose the lobby, courtyard, or sprinkler bay.');
    if (distance(s.objects.bell, CONFIG.bays[input.bay]) < 1 && !s.objects.bell.carrier && ![s.actors.courier.job, ...s.actors.courier.queue].some(j => j?.type === 'placeBell')) {
      return reply(s, true, 'The bell is already in that bay.', { duplicate: true });
    }
    return enqueue(s, 'courier', { type, bay: input.bay, label: `Move the bell to ${CONFIG.bays[input.bay].label.toLowerCase()}` });
  }
  if (type === 'ringBell') {
    if (s.objects.bell.active) return reply(s, true, 'The bell is already ringing.', { duplicate: true });
    if (s.objects.bell.cooldown > 0) return reply(s, false, 'The bell needs a moment before ringing again.');
    return enqueue(s, 'courier', { type, label: 'Ring the bell · visitors investigate the sound' });
  }
  if (type === 'toggleSprinkler' || type === 'setSprinkler') {
    const enabled = typeof input.enabled === 'boolean' ? input.enabled : !s.objects.sprinkler.active;
    const pending = [s.actors.mechanic.job, ...s.actors.mechanic.queue].filter(Boolean).filter(j => j.type === 'toggleSprinkler');
    if (!pending.length && s.objects.sprinkler.active === enabled) return reply(s, true, `The sprinkler is already ${enabled ? 'on' : 'off'}.`, { duplicate: true });
    return enqueue(s, 'mechanic', { type: 'toggleSprinkler', enabled,
      label: `${enabled ? 'Turn on' : 'Turn off'} the sprinkler${enabled ? (s.objects.sprinkler.charged ? ' · water already paid' : ' · $12 shift water charge') : ' · floor dries gradually'}` });
  }
  if (type === 'positionCart') {
    const c = s.objects.cart;
    if (!CONFIG.bays[input.bay]) return reply(s, false, 'Choose a cart bay first.');
    if (c.moving || c.spent) return reply(s, false, 'That cart has already been sent down the lane.');
    if (distance(c, CONFIG.bays[input.bay]) < 1 && !c.carrier && ![s.actors.mechanic.job, ...s.actors.mechanic.queue].some(j => j?.type === 'positionCart')) return reply(s, true, 'The cart is already in that bay.', { duplicate: true });
    return enqueue(s, 'mechanic', { type, bay: input.bay, label: `Wheel the cart to ${CONFIG.bays[input.bay].label.toLowerCase()}` });
  }
  if (type === 'pushCart') {
    if (s.objects.cart.moving || s.objects.cart.spent) return reply(s, true, 'The cart is already rolling or used.', { duplicate: true });
    return enqueue(s, 'mechanic', { type, immediate: input.immediate === true,
      label: input.immediate ? 'Shove the cart now · watch for guests' : 'Set a cart ambush · wait for the thief in its lane' });
  }
  return reply(s, false, `Unknown order: ${String(type || '(none)')}.`);
}

function nearestBay(p) {
  return Object.keys(CONFIG.bays).sort((a, b) => distance(p, CONFIG.bays[a]) - distance(p, CONFIG.bays[b]))[0];
}

function setTarget(a, p, intent, rest = []) {
  a.target = point(p); a.path = [point(p), ...rest.map(point)];
  a.intent = intent;
}

function move(a, p, dt, speed = a.speed, stop = 0) {
  const d = distance(a, p);
  if (d <= stop + 0.01) { a.moving = false; return true; }
  const amount = Math.min(d - stop, speed * dt);
  const dx = (p.x - a.x) / d;
  a.x += dx * amount; a.y += (p.y - a.y) / d * amount;
  if (Math.abs(dx) > 0.02) a.facing = dx < 0 ? -1 : 1;
  a.moving = amount > 0; a.walkTime += dt;
  if (a.moving) a.action = 'walking';
  return d - amount <= stop + 0.01;
}

function prepareJob(s, a) {
  if (!a.job && a.queue.length) a.job = a.queue.shift();
  if (!a.job) return;
  a.returningHome = false;
  a.intent = a.job.label;
  const j = a.job;
  const target = j.type === 'escortGuest' ? s.objects.cart
    : j.type === 'toggleSprinkler' ? s.objects.sprinkler
    : j.type === 'placeBell' || j.type === 'ringBell' ? s.objects.bell : s.objects.cart;
  setTarget(a, target, j.label);
  a.action = 'planned';
}

function completeJob(s, a) {
  a.job = null; a.progress = 0; a.action = 'idle'; a.target = null; a.path = [];
  a.intent = 'Ready for a job'; a.carrying = null;
  prepareJob(s, a);
  if (!a.job) {
    a.returningHome = true;
    setTarget(a, CONFIG.starts[a.id], 'Walk back to the staff waiting spot');
  }
}

function interact(a, j, duration, dt, action = 'working') {
  a.moving = false; a.action = action;
  j.totalWork = duration; j.work += dt;
  a.progress = clamp(j.work / duration, 0, 1);
  if (j.work + 1e-9 >= duration) { j.work = 0; a.progress = 0; return true; }
  return false;
}

function spend(s, amount, reason) {
  if (s.money < amount) { log(s, 'risk', `Not enough cash for ${reason}.`); return false; }
  s.money -= amount; s.costs += amount; return true;
}

function updateSpecialist(s, a, dt) {
  if (a.slipRemaining > 0) return;
  if (!a.job) prepareJob(s, a);
  const j = a.job;
  if (!j) {
    if (a.returningHome) {
      const home = CONFIG.starts[a.id];
      setTarget(a, home, 'Walk back to the staff waiting spot');
      if (!move(a, home, dt)) return;
      a.returningHome = false; a.target = null; a.path = []; a.intent = 'Ready for a job';
    }
    a.action = 'idle'; a.moving = false; return;
  }
  const b = s.objects.bell, c = s.objects.cart, g = s.actors.guest;
  if (j.type === 'escortGuest') {
    if (g.escorted || g.injured || g.resolved) { completeJob(s, a); return; }
    if (j.stage === 0) {
      if (c.moving || c.spent) {
        const message = 'Laundry cart unavailable; the guest can still check in.';
        log(s, 'risk', message); s.lastFeedback = message;
        completeJob(s, a);
        return;
      }
      setTarget(a, c, c.carrier ? 'Wait for the laundry cart to be parked' : 'Collect fresh linen from the laundry cart');
      if (!move(a, c, dt, a.speed, 22)) return;
      if (c.carrier) { a.action = 'waiting'; a.moving = false; return; }
      if (interact(a, j, 0.65, dt, 'collecting')) {
        j.stage = 1; a.carrying = 'linen';
        log(s, 'action', 'Pip collected guest linen. The cart is now free to use for an ambush.');
      }
      return;
    }
    setTarget(a, g, g.visible ? 'Catch the guest and tag luggage' : 'Wait at the entrance for the guest');
    if (!move(a, g, dt, a.speed, 22)) return;
    if (!g.visible) { a.action = 'waiting'; return; }
    // The guest briefly stops while the porter explains the way to their room.
    g.beingServed = true;
    if (interact(a, j, 0.85, dt, 'guiding')) {
      g.escorted = true; g.welcomeTip = 0; g.beingServed = false; s.happiness = Math.min(100, s.happiness + 10);
      log(s, 'reward', 'Luggage tagged. The guest now ignores bells, but not carts or wet floors.');
      completeJob(s, a);
    }
    return;
  }
  if (j.type === 'placeBell') {
    const target = j.stage === 0 ? b : CONFIG.bays[j.bay];
    setTarget(a, target, j.stage === 0 ? 'Collect the bell' : `Carry the bell to ${CONFIG.bays[j.bay].label.toLowerCase()}`);
    if (!move(a, target, dt, a.speed, j.stage === 0 ? 12 : 0)) return;
    if (!interact(a, j, 0.5, dt, j.stage === 0 ? 'lifting' : 'placing')) return;
    if (j.stage === 0) {
      j.stage = 1; b.carrier = a.id; b.active = false; b.remaining = 0; a.carrying = 'bell';
    } else {
      Object.assign(b, point(CONFIG.bays[j.bay]), { bay: j.bay, carrier: null });
      log(s, 'action', `Bell placed in the ${CONFIG.bays[j.bay].label.toLowerCase()} bay.`);
      completeJob(s, a);
    }
    return;
  }
  if (j.type === 'ringBell') {
    if (b.active || b.cooldown > 0) { completeJob(s, a); return; }
    setTarget(a, b, 'Ring the bell to draw curious visitors');
    if (!move(a, b, dt, a.speed, 20)) return;
    if (interact(a, j, 0.75, dt, 'ringing')) {
      b.active = true; b.remaining = CONFIG.bellDuration; b.cooldown = CONFIG.bellCooldown; b.serial++;
      log(s, 'action', 'Ding! The thief and any unescorted guest will investigate the bell.');
      completeJob(s, a);
    }
    return;
  }
  if (j.type === 'toggleSprinkler') {
    setTarget(a, s.objects.sprinkler, j.enabled ? 'Open the sprinkler valve' : 'Close the sprinkler valve');
    if (!move(a, s.objects.sprinkler, dt, a.speed, 18)) return;
    if (interact(a, j, 1, dt, 'turning')) {
      const sprinkler = s.objects.sprinkler;
      if (sprinkler.active !== j.enabled && (!j.enabled || sprinkler.charged || spend(s, CONFIG.sprinklerCost, 'the sprinkler'))) {
        sprinkler.active = j.enabled;
        if (j.enabled) sprinkler.charged = true;
        log(s, 'action', j.enabled ? 'Sprinkler on. This puddle makes anyone entering it slip.' : 'Sprinkler off. The puddle needs six seconds to dry.');
      }
      completeJob(s, a);
    }
    return;
  }
  if (j.type === 'positionCart') {
    if (c.spent || c.moving) { completeJob(s, a); return; }
    const target = j.stage === 0 ? { x: c.x - 34, y: c.y } : { x: CONFIG.bays[j.bay].x - 34, y: CONFIG.bays[j.bay].y };
    setTarget(a, target, j.stage === 0 ? 'Take the cart handles' : `Wheel the cart to ${CONFIG.bays[j.bay].label.toLowerCase()}`);
    if (!move(a, target, dt, j.stage ? 52 : a.speed, 0)) return;
    if (!interact(a, j, 0.5, dt, j.stage ? 'parking' : 'lifting')) return;
    if (j.stage === 0) { j.stage = 1; c.carrier = a.id; a.carrying = 'cart'; }
    else {
      Object.assign(c, point(CONFIG.bays[j.bay]), { bay: j.bay, carrier: null });
      log(s, 'action', `Laundry cart parked in the ${CONFIG.bays[j.bay].label.toLowerCase()} bay.`);
      completeJob(s, a);
    }
    return;
  }
  if (j.type === 'pushCart') {
    if (c.spent || c.moving) { completeJob(s, a); return; }
    const handles = { x: c.x - 38, y: c.y };
    setTarget(a, handles, 'Take the handles, then watch the cart lane');
    if (!move(a, handles, dt)) return;
    a.facing = 1; // The cart is east of its handles, regardless of approach direction.
    const t = s.actors.thief;
    c.armed = true;
    a.action = 'watching'; a.intent = 'Waiting for the thief to enter the cart lane';
    // Let the thief approach the inner lookout before shoving. This gives the
    // resulting cart ride time to read, instead of catching him at the fence.
    const inLane = t.visible && !t.resolved && t.x > c.x + 45 && t.x <= 1010 && Math.abs(t.y - c.y) < 42;
    if (!j.immediate && !inLane) return;
    if (interact(a, j, 0.45, dt, 'pushing')) {
      if (spend(s, CONFIG.cartCost, 'a cart shove')) {
        c.moving = true; c.armed = false; c.spent = true; c.startX = c.x; c.carrier = null;
        log(s, 'action', 'Laundry express! The cart rolls east and carries anyone in its way.');
      } else c.armed = false;
      completeJob(s, a);
    }
  }
}

function routeMovement(a, route, dt, intent) {
  if (a.routeIndex >= route.length) return true;
  const p = route[a.routeIndex];
  setTarget(a, p, intent, route.slice(a.routeIndex + 1));
  if (move(a, p, dt)) a.routeIndex++;
  return a.routeIndex >= route.length;
}

function bellDiversion(s, a, dt) {
  const b = s.objects.bell;
  if (!b.active || b.carrier || a.heardBell === b.serial || (a.id === 'guest' && a.escorted)) {
    if (a.listening) { a.listening = false; a.diversionTimer = 0; }
    return false;
  }
  setTarget(a, b, a.id === 'guest' ? 'Curious about the bell · luggage service prevents this' : 'Investigate the ringing bell');
  if (!move(a, b, dt, a.speed, 16)) return true;
  a.action = 'listening'; a.moving = false; a.listening = true;
  a.diversionTimer = (a.diversionTimer || 0) + dt; a.progress = a.diversionTimer / (a.id === 'guest' ? 4 : 2);
  if (a.diversionTimer >= (a.id === 'guest' ? 4 : 2)) {
    a.heardBell = b.serial; a.diversionTimer = 0; a.progress = 0; a.listening = false;
    if (a.id === 'guest' && !a.welcomed && !a.injured) {
      a.welcomed = true; a.welcomeTip = 5;
      s.happiness = Math.min(100, s.happiness + 5);
      // A safe bell is also a useful welcome point, not only a distraction.
      // Visitors who have already paid leave their small tip immediately.
      if (a.paid) { a.payment += 5; s.earnings += 5; s.money += 5; }
      if (a.phase === 'toReception') a.routeIndex = CONFIG.guestRoute.length - 1;
      log(s, 'reward', 'A warm bell welcome! The guest knows the way to reception and adds a $5 tip.');
    }
  }
  return true;
}

function updateGuest(s, dt) {
  const g = s.actors.guest;
  if (g.resolved) return;
  if (!g.visible) {
    if (s.time < CONFIG.guestArrival) return;
    g.visible = true; g.phase = 'toReception';
    log(s, 'system', 'Mrs. Willow has arrived. A quiet room is worth $60.');
  }
  if (g.slipRemaining > 0 || g.beingServed) { if (g.beingServed) { g.action = 'greeting'; g.moving = false; } return; }
  if (g.phase === 'leaving') {
    setTarget(g, CONFIG.guestEntry, 'Leaving after an unsafe welcome');
    if (move(g, CONFIG.guestEntry, dt)) {
      g.resolved = true; g.visible = false;
      log(s, 'failure', 'The guest left without paying. Safety is part of hospitality.');
    }
    return;
  }
  if (g.phase !== 'checkingIn' && bellDiversion(s, g, dt)) return;
  if (g.phase === 'toReception') {
    if (routeMovement(g, CONFIG.guestRoute, dt, 'Walk to reception')) {
      g.phase = 'checkingIn'; g.timer = 0; g.path = []; g.target = null;
    }
  } else if (g.phase === 'checkingIn') {
    g.action = 'checkingIn'; g.intent = 'Check in and pay for the room'; g.moving = false;
    g.timer += dt; g.progress = clamp(g.timer / 1.5, 0, 1);
    if (g.timer >= 1.5 && !g.paid) {
      g.payment = CONFIG.roomPrice + (g.escorted ? CONFIG.serviceTip : g.welcomeTip);
      g.paid = true; s.earnings += g.payment; s.money += g.payment;
      log(s, 'reward', `Room paid: +$${g.payment}${g.escorted ? ', including a luggage-service tip' : g.welcomeTip ? ', including a bell-welcome tip' : ''}.`);
      g.phase = 'toRoom'; g.timer = 0; g.progress = 0;
    }
  } else if (g.phase === 'toRoom') {
    setTarget(g, CONFIG.guestRoom, 'Find the room and settle in');
    if (move(g, CONFIG.guestRoom, dt)) {
      g.phase = 'settled'; g.resolved = true; g.action = 'relaxing'; g.intent = 'Safely checked in';
      g.target = null; g.path = []; g.moving = false;
      log(s, 'success', 'Mrs. Willow is happily settled in her room.');
    }
  }
}

function updateThief(s, dt) {
  const t = s.actors.thief;
  if (t.resolved || t.phase === 'inCart') return;
  if (!t.visible) {
    if (s.time < CONFIG.thiefArrival) return;
    t.visible = true; t.phase = 'toTill';
    log(s, 'risk', 'Rook is at the side gate, eyeing the till.');
  }
  if (t.slipRemaining > 0) return;
  if (t.phase === 'fleeing') {
    setTarget(t, CONFIG.thiefEntry, t.stopped ? 'Flee in embarrassment' : 'Escape with the till money');
    if (move(t, CONFIG.thiefEntry, dt, 86)) {
      t.resolved = true; t.visible = false; t.action = 'gone';
      if (!t.stopped) t.outcome = 'escaped';
      log(s, t.stopped ? 'success' : 'failure', t.stopped ? 'Rook fled. The till is safe.' : `Rook escaped with $${s.stolen}.`);
    }
    return;
  }
  if (bellDiversion(s, t, dt)) return;
  if (t.phase === 'casing') {
    t.action = 'casing'; t.intent = 'Watch the lobby for five seconds'; t.moving = false;
    t.timer += dt; t.progress = clamp(t.timer / 5, 0, 1);
    if (t.timer >= 5) { t.cased = true; t.phase = 'toTill'; t.timer = 0; t.progress = 0; }
  } else if (t.phase === 'toTill') {
    const done = routeMovement(t, CONFIG.thiefRoute, dt, 'Sneak to the till');
    if (t.routeIndex === 1 && !t.cased) { t.phase = 'casing'; t.timer = 0; }
    if (done) { t.phase = 'stealing'; t.timer = 0; }
  } else if (t.phase === 'stealing') {
    t.action = 'stealing'; t.intent = 'Empty the till'; t.moving = false;
    t.timer += dt; t.progress = clamp(t.timer / 3, 0, 1);
    if (t.timer >= 3) {
      const amount = Math.min(CONFIG.theftAmount, s.money);
      s.stolen = amount; s.money -= amount; t.carrying = 'coins';
      t.phase = 'fleeing'; t.progress = 0;
      log(s, 'failure', `Rook grabbed $${amount}. Stop him before he reaches the gate!`);
    }
  }
}

function recoverMoney(s) {
  if (s.stolen > 0) {
    log(s, 'reward', `$${s.stolen} recovered from Rook.`);
    s.money += s.stolen; s.stolen = 0;
  }
}

function hurtGuest(s, cause) {
  const g = s.actors.guest;
  if (g.injured || g.resolved) return;
  g.injured = true; g.phase = 'leaving'; g.beingServed = false;
  g.timer = 0; g.progress = 0; g.slipRemaining = 1.6;
  s.happiness = Math.max(0, s.happiness - 60); s.reputation = Math.max(0, s.reputation - 1);
  if (g.paid) { s.money -= g.payment; s.earnings -= g.payment; g.payment = 0; }
  log(s, 'failure', cause === 'cart' ? 'The cart hit the guest! Booking lost, reputation down.' : 'The guest slipped in the puddle! Booking lost, reputation down.');
}

function updateWater(s, dt) {
  const sp = s.objects.sprinkler;
  sp.wetness = clamp(sp.wetness + (sp.active ? dt / 1.5 : -dt / 6), 0, 1);
  for (const a of Object.values(s.actors)) {
    if (!a.visible || a.resolved || a.phase === 'inCart') continue;
    const touching = sp.wetness >= 0.35 && distance(a, sp.zone) < sp.zone.radius;
    if (touching && !a.wetContact && !a.wetFloorImmune) {
      a.slipRemaining = 1.2; a.action = 'slipping'; a.moving = false; a.collisions++;
      if (a.id === 'guest') hurtGuest(s, 'water');
      else if (a.id === 'thief') {
        recoverMoney(s); a.carrying = null; a.stopped = true; a.outcome = 'slipped'; a.phase = 'fleeing';
        a.timer = 0; a.progress = 0;
        log(s, 'success', 'Splash! Rook slipped and lost his nerve. He is fleeing the hotel.');
      } else log(s, 'risk', `${a.name} slipped too. Wet floors do not pick sides.`);
    }
    a.wetContact = touching;
  }
}

function updateCart(s, dt) {
  const c = s.objects.cart;
  if (!c.moving) return;
  c.x = Math.min(CONFIG.cartExit.x, c.x + CONFIG.speeds.cart * dt);
  c.progress = clamp((c.x - c.startX) / (CONFIG.cartExit.x - c.startX), 0, 1);
  for (const a of Object.values(s.actors)) {
    if (!a.visible || a.resolved || c.hit.includes(a.id) || a.phase === 'inCart') continue;
    // The handle zone behind the cart is safe for the person who shoves it.
    if (Math.abs(a.y - c.y) < 34 && a.x >= c.x - 24 && a.x < c.x + 45) {
      c.hit.push(a.id); a.collisions++;
      if (a.id === 'thief') {
        recoverMoney(s); c.carrying = 'thief'; a.phase = 'inCart'; a.stopped = true;
        a.outcome = 'cart'; a.carrying = null; a.action = 'riding'; a.intent = 'Unexpected laundry delivery';
        a.path = [point(CONFIG.cartExit)]; a.target = point(CONFIG.cartExit);
        log(s, 'success', 'Caught in the laundry! The moving cart is carrying Rook out.');
      } else if (a.id === 'guest') hurtGuest(s, 'cart');
      else { a.slipRemaining = 1; a.action = 'stumbling'; log(s, 'risk', `${a.name} was clipped by the cart.`); }
    }
  }
  if (c.carrying) { s.actors.thief.x = c.x; s.actors.thief.y = c.y - 5; }
  if (c.x >= CONFIG.cartExit.x) {
    c.moving = false;
    if (c.carrying) {
      // The courtyard fence is solid. Stop before it; the passenger climbs out
      // where the cart actually is, then uses the visible side gate on foot.
      const t = s.actors.thief;
      t.phase = 'fleeing'; t.action = 'fleeing'; t.intent = 'Climb out and flee through the side gate';
      t.target = point(CONFIG.thiefEntry); t.path = [point(CONFIG.thiefEntry)];
      c.carrying = null;
      log(s, 'success', 'The cart stops short of the fence. Rook scrambles out and flees toward the side gate.');
    } else log(s, 'risk', 'The cart stopped empty at the courtyard fence. That shove is spent.');
  }
}

function finish(s, won, reason) {
  s.status = won ? 'won' : 'lost'; s.paused = true;
  const net = s.earnings - s.costs - s.stolen;
  s.result = { title: won ? 'A splendid little shift!' : 'A lesson in mischief', reason,
    stars: won ? (s.happiness >= 95 ? 3 : 2) : 0,
    net, earned: s.earnings, spent: s.costs, stolen: s.stolen,
    solution: s.actors.thief.outcome, happiness: s.happiness };
  log(s, won ? 'success' : 'failure', reason);
}

function checkOutcome(s) {
  const g = s.actors.guest, t = s.actors.thief;
  if (t.resolved && t.outcome === 'escaped') {
    finish(s, false, 'The thief escaped with the till money. Try a cart ambush or a wet-floor lure.');
  } else if (g.resolved && g.injured && t.resolved) {
    finish(s, false, 'The thief was stopped, but the guest was hurt. Keep their route out of the mischief.');
  } else if (g.phase === 'settled' && t.resolved && t.stopped) {
    finish(s, true, `Guest settled, till protected. ${t.outcome === 'cart' ? 'A beautifully timed cart ambush.' : 'A slippery lesson for a would-be thief.'}`);
  } else if (s.time >= s.timeLimit) {
    finish(s, false, g.phase !== 'settled' ? 'Shift over. The guest never reached a safe, paid room.' : 'Shift over. The thief is still a problem.');
  }
}

function tick(s, dt) {
  s.ticks++; s.time = s.ticks * CONFIG.fixedStep;
  const b = s.objects.bell;
  b.cooldown = Math.max(0, b.cooldown - dt);
  if (b.active) { b.remaining = Math.max(0, b.remaining - dt); if (b.remaining <= 1e-9) b.active = false; }
  for (const a of Object.values(s.actors)) {
    a.moving = false;
    if (a.slipRemaining > 0) {
      a.slipRemaining = Math.max(0, a.slipRemaining - dt);
      a.action = 'slipping';
    }
  }
  updateSpecialist(s, s.actors.courier, dt);
  updateSpecialist(s, s.actors.mechanic, dt);
  updateGuest(s, dt);
  updateThief(s, dt);
  if (b.carrier) Object.assign(b, point(s.actors[b.carrier]));
  const c = s.objects.cart;
  if (c.carrier) { c.x = s.actors[c.carrier].x + 34; c.y = s.actors[c.carrier].y; }
  updateWater(s, dt); updateCart(s, dt); checkOutcome(s);
}

/** Advance a running game by dt seconds. Fixed 60 Hz ticks make outcomes repeatable. */
export function step(s, dt) {
  if (s.status !== 'playing' || !Number.isFinite(dt) || dt <= 0) return s;
  s.accumulator += Math.min(dt, CONFIG.timeLimit + 1);
  while (s.accumulator + 1e-10 >= CONFIG.fixedStep && s.status === 'playing') {
    s.accumulator = Math.max(0, s.accumulator - CONFIG.fixedStep);
    tick(s, CONFIG.fixedStep);
  }
  if (terminal(s)) s.accumulator = 0;
  return s;
}

export function getSnapshot(s) { return copy(s); }

export function describe(s) {
  const t = s.actors.thief, g = s.actors.guest;
  const jobs = ['courier', 'mechanic'].map(id => `${s.actors[id].name}: ${s.actors[id].intent}`).join('. ');
  return `${s.status}. ${s.time.toFixed(1)} of ${s.timeLimit} seconds. Cash $${s.money}. Happiness ${s.happiness}. Guest: ${g.intent}. Thief: ${t.intent}. ${jobs}.${s.result ? ` ${s.result.reason}` : ''}`;
}
