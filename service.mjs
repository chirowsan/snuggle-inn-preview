/**
 * Copperleaf's gentle, deterministic hotel-service shift.
 * All positions are feet-on-floor in the existing 1200 × 700 artwork.
 * Input never advances time. Each specialist has one physical task, not a queue.
 */
export const SERVICE_CONFIG = Object.freeze({
  width: 1200, height: 700, fixedStep: 1 / 60, timeLimit: 240,
  startingMoney: 120, roomPrice: 40, serviceTip: 10, washCost: 5,
  washDuration: 5, waitingPatience: 90, towelPatience: 90, tipAfter: 60,
  theftAmount: 20, thiefApproach: 8, thiefWarning: 10, goal: 3,
  hallwayY: 300,
  laundry: { x: 710, y: 490 },
  entry: { x: 600, y: 575 },
  till: { x: 290, y: 300 },
  thiefEntry: { x: 1185, y: 535 },
  starts: { courier: { x: 420, y: 480 }, mechanic: { x: 720, y: 535 } },
  rooms: [ { id: 'room-1', name: 'Rose Room', x: 480, y: 230 },
    { id: 'room-2', name: 'Fern Room', x: 480, y: 230 } ],
});
export const CONFIG = SERVICE_CONFIG;
const STEP = SERVICE_CONFIG.fixedStep;
const EPS = 1e-9;
const copy = value => JSON.parse(JSON.stringify(value));
const point = p => ({ x: p.x, y: p.y });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const terminal = s => s.status === 'won' || s.status === 'lost';
const positiveOption = (value, fallback) => Number.isFinite(value) && value > 0 ? Math.min(600, value) : fallback;
const createActor = (id, name, species, p, visible = true) => ({
  id, name, species, spriteKind: id, ...point(p), visible,
  path: [], target: null, moving: false, facing: 1, action: 'idle',
  progress: 0, walkTime: 0, intent: 'Ready to help', job: null, carrying: null, returningHome: false,
  speed: id === 'courier' ? 520 : 500,
});

export function createService(options = {}) {
  options = options && typeof options === 'object' ? options : {};
  const upgrade = ['linen-shelf', 'quick-wash'].includes(options.upgrade) ? options.upgrade : null;
  const config = {
    thief: options.thief !== false && options.noThief !== true,
    timeLimit: positiveOption(options.timeLimit, SERVICE_CONFIG.timeLimit),
    waitingPatience: positiveOption(options.waitingPatience, SERVICE_CONFIG.waitingPatience),
    towelPatience: positiveOption(options.towelPatience, SERVICE_CONFIG.towelPatience),
    washDuration: positiveOption(options.washDuration, upgrade === 'quick-wash' ? 3 : SERVICE_CONFIG.washDuration),
    tipAfter: positiveOption(options.tipAfter, SERVICE_CONFIG.tipAfter),
  };
  const guests = ['Willow', 'Juniper', 'Poppy'].map((name, i) => ({
    ...createActor(`guest-${i + 1}`, name, 'rabbit', i === 1 ? { x: 390, y: 455 } : { x: 315, y: 345 }, i === 0),
    spriteKind: 'guest', status: i === 0 ? 'waiting' : 'pending', phase: i === 0 ? 'waiting' : 'pending',
    request: i === 0 ? 'room' : null, roomId: null, served: false, departed: false,
    abandoned: false, resolved: false, escorted: false, payment: 0, paid: false,
    waitElapsed: 0, roomElapsed: 0, patience: config.waitingPatience,
    tipEligible: true, checkoutRemaining: 0, speed: 520,
    intent: i === 0 ? 'Tap me, then choose an available room' : 'Arrives later this shift',
  }));
  const s = {
    version: 1, mode: 'service', status: options.paused === true ? 'paused' : 'playing',
    paused: options.paused === true, time: 0, timeLimit: config.timeLimit, ticks: 0, accumulator: 0,
    config, upgrade, settings: copy(options.settings || {}),
    money: SERVICE_CONFIG.startingMoney, startingMoney: SERVICE_CONFIG.startingMoney,
    earnings: 0, costs: 0, stolen: 0, tips: 0,
    completed: 0, served: 0, goal: 3, abandoned: 0, result: null,
    rooms: SERVICE_CONFIG.rooms.map(r => ({ ...r, status: 'available', guestId: null,
      guestName: null, request: null, patience: 0, towelUsed: false, progress: 0 })),
    guests,
    laundry: { ...point(SERVICE_CONFIG.laundry), clean: upgrade === 'linen-shelf' ? 2 : 1, dirty: 2, batch: 0,
      status: 'idle', loading: false, progress: 0, remaining: 0, duration: config.washDuration },
    actors: {
      courier: createActor('courier', 'Pip', 'fox', SERVICE_CONFIG.starts.courier),
      mechanic: createActor('mechanic', 'Bramble', 'badger', SERVICE_CONFIG.starts.mechanic),
      thief: { ...createActor('thief', 'Rook', 'raccoon', SERVICE_CONFIG.thiefEntry, false),
        phase: 'dormant', status: 'dormant', timer: 0, remaining: 0, resolved: false,
        stopped: false, outcome: null, intercepted: false, intent: 'No trouble yet' },
    },
    objects: {
      cart: { x: 650, y: 440, bay: 'laundry', moving: false, armed: false,
        carrying: null, spent: false, carrier: null, progress: 0, hit: [] },
      bell: { x: 245, y: 300, active: false, remaining: 0, cooldown: 0, carrier: null },
      sprinkler: { x: 965, y: 515, active: false, wetness: 0,
        zone: { x: 850, y: 440, radius: 95 } },
    },
    events: [], eventId: 0, lastFeedback: 'Willow is here! Tap her, then an available room.',
  };
  for (const guest of guests) s.actors[guest.id] = guest;
  log(s, 'arrival', 'Willow is waiting. Tap her, then an available room.', guests[0]);
  return s;
}

function log(s, type, text, at = null, short = '') {
  s.events.push({ id: ++s.eventId, time: s.time, type, text, ...(at ? point(at) : {}), short });
  if (s.events.length > 80) s.events.shift();
}
function reply(s, ok, message) { s.lastFeedback = message; return { ok, message }; }
function roomById(s, id) { return s.rooms.find(r => r.id === id); }
function guestById(s, id) { return s.guests.find(g => g.id === id); }
function relinkGuests(s) { for (const guest of s.guests) s.actors[guest.id] = guest; }
function route(actor, points, intent) {
  actor.path = points.map(point).filter((p, i, all) => distance(p, i ? all[i - 1] : actor) > .01);
  actor.target = actor.path[0] || null;
  actor.intent = intent || actor.intent;
  actor.moving = false;
  actor.progress = 0;
}
function hallwayRoute(a, destination) {
  return [ { x: a.x, y: SERVICE_CONFIG.hallwayY },
    { x: destination.x, y: SERVICE_CONFIG.hallwayY }, destination ];
}
function walk(a, dt, speed = a.speed) {
  let budget = speed * dt, moved = 0;
  while (a.path.length && budget > EPS) {
    const p = a.path[0], d = distance(a, p);
    if (d < .001) { a.x = p.x; a.y = p.y; a.path.shift(); continue; }
    const amount = Math.min(d, budget), dx = p.x - a.x;
    if (Math.abs(dx) > .1) a.facing = dx < 0 ? -1 : 1;
    a.x += dx / d * amount; a.y += (p.y - a.y) / d * amount;
    moved += amount; budget -= amount;
    if (amount + EPS >= d) { a.x = p.x; a.y = p.y; a.path.shift(); }
  }
  a.target = a.path[0] || null;
  a.moving = moved > EPS;
  if (a.moving) { a.action = 'walking'; a.walkTime += moved / speed; }
  return a.path.length === 0;
}
function startTask(actor, job, points) {
  actor.returningHome = false;
  actor.job = { ...job, work: 0 };
  actor.action = 'walking';
  route(actor, points, job.label);
}
function release(actor) {
  actor.job = null; actor.path = []; actor.target = null; actor.moving = false;
  actor.action = 'idle'; actor.progress = 0; actor.carrying = null; actor.intent = 'Ready to help';
  const home = SERVICE_CONFIG.starts[actor.id];
  actor.returningHome = !!home && distance(actor, home) > .01;
  if (actor.returningHome) route(actor, hallwayRoute(actor, home), 'Walking back. Ready for another task!');
}
function work(actor, dt, duration, action = 'working') {
  actor.moving = false; actor.action = action; actor.job.work += dt;
  actor.progress = Math.min(1, actor.job.work / duration);
  return actor.job.work + EPS >= duration;
}
function arrive(s, index) {
  const g = s.guests[index];
  if (!g || g.status !== 'pending') return;
  g.visible = true; g.status = g.phase = 'waiting'; g.request = 'room';
  g.intent = 'Tap me, then choose an available room';
  log(s, 'arrival', `${g.name} has arrived. Choose an available room.`, g, `${g.name} arrives`);
}
function stateReason(s) {
  if (terminal(s)) return 'This shift is finished. Start a new shift to play again.';
  if (s.paused || s.status !== 'playing') return 'The shift is paused. Resume to help guests.';
  return '';
}
function busyReason(a) { return a.job ? `${a.name} is busy: ${a.job.label.toLowerCase()}. Try again when they finish.` : ''; }

/** Read-only validation, shared by command and UI action descriptors. */
function invalidReason(s, input) {
  const state = stateReason(s); if (state) return state;
  const r = roomById(s, input.roomId), g = guestById(s, input.guestId);
  const pip = s.actors.courier, bramble = s.actors.mechanic, l = s.laundry;
  switch (input.type) {
    case 'assignRoom':
      if (!g || !g.visible || g.status !== 'waiting') return 'Choose a guest who is still waiting for a room.';
      if (!r) return 'Choose a room at the hotel.';
      if (r.status !== 'available') return `${r.name} is not available yet.`;
      return busyReason(pip);
    case 'deliverTowel':
      if (!r || r.status !== 'occupied' || r.request !== 'towel') return 'That room is not waiting for a towel.';
      if (busyReason(pip)) return busyReason(pip);
      if (l.clean < 1) return 'No clean towels. Load dirty towels, then fold them when the wash is ready.';
      return '';
    case 'cleanRoom':
      if (!r || r.status !== 'dirty') return 'Choose a dirty room after its guest checks out.';
      return busyReason(bramble);
    case 'loadWash':
      if (l.status !== 'idle') return l.status === 'ready' ? 'The wash is ready. Fold these towels before loading another batch.' : 'This wash is already loading or running.';
      if (l.dirty < 1) return 'No dirty towels to wash. Tidy a checked-out room to collect more.';
      if (s.money < SERVICE_CONFIG.washCost) return `A wash costs ${SERVICE_CONFIG.washCost} coins.`;
      return busyReason(bramble);
    case 'finishFold':
      return l.status === 'ready' && l.batch > 0 ? '' : 'The wash is not ready to fold yet.';
    case 'callOutThief':
      if (!s.actors.thief.visible || s.actors.thief.resolved || !['approaching','stealing'].includes(s.actors.thief.phase)) return 'Rook is not causing trouble right now.';
      return '';
    case 'shooThief':
      if (!s.actors.thief.visible || s.actors.thief.resolved || !['approaching', 'stealing'].includes(s.actors.thief.phase)) return 'Rook is not causing trouble right now.';
      return busyReason(bramble);
    default: return 'Choose a guest, a room, laundry, or Rook to help at the hotel.';
  }
}

/** Mutates state atomically. Input is { type, guestId?, roomId? }. */
export function serviceCommand(s, input = {}) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.guests)) return { ok: false, message: 'No hotel shift is loaded.' };
  input = input && typeof input === 'object' ? input : {};
  if (input.type === 'retry' || input.type === 'reset') {
    const fresh = createService({ ...s.config, upgrade: s.upgrade, settings: s.settings });
    for (const key of Object.keys(s)) delete s[key]; Object.assign(s, fresh);
    return reply(s, true, 'Fresh shift. Willow is ready to check in.');
  }
  if (terminal(s)) return reply(s, false, stateReason(s));
  if (input.type === 'pause') {
    s.status = 'paused'; s.paused = true;
    return reply(s, true, 'Paused. Guests, laundry, and Rook all wait for you.');
  }
  if (input.type === 'resume' || input.type === 'play') {
    s.status = 'playing'; s.paused = false;
    return reply(s, true, 'Welcome back. The hotel is open.');
  }
  const reason = invalidReason(s, input);
  if (reason) return reply(s, false, reason);
  relinkGuests(s);
  const pip = s.actors.courier, bramble = s.actors.mechanic;
  const r = roomById(s, input.roomId), g = guestById(s, input.guestId), l = s.laundry;
  let message;
  switch (input.type) {
    case 'assignRoom': {
      r.status = 'checking-in'; r.guestId = g.id; r.guestName = g.name; r.request = null;
      g.status = g.phase = 'checking-in'; g.roomId = r.id; g.request = null;
      g.intent = `Following Pip to ${r.name}`; g.escorted = true;
      const meet = { x: g.x - 80, y: g.y + 20 };
      startTask(pip, { type: 'assignRoom', phase: 'meet', roomId: r.id, guestId: g.id,
        label: `Escorting ${g.name} to ${r.name}` }, hallwayRoute(pip, meet));
      message = `Pip is showing ${g.name} to ${r.name}.`;
      if (g.id === 'guest-1') arrive(s, 1);
      break;
    }
    case 'deliverTowel':
      l.clean -= 1; r.request = 'delivering';
      guestById(s, r.guestId).request = 'delivering';
      startTask(pip, { type: 'deliverTowel', phase: 'fetch', roomId: r.id, guestId: r.guestId,
        label: `Bringing a clean towel to ${r.guestName}`, reservedTowel: true }, hallwayRoute(pip, l));
      message = `One clean towel reserved. Pip is bringing it to ${r.guestName}.`;
      break;
    case 'cleanRoom':
      r.status = 'cleaning'; r.progress = 0;
      startTask(bramble, { type: 'cleanRoom', phase: 'room', roomId: r.id,
        label: `Tidying ${r.name}`, dirtyTowels: r.towelUsed ? 1 : 0 }, hallwayRoute(bramble, r));
      message = `Bramble is tidying ${r.name}, then taking its towels to the laundry.`;
      break;
    case 'loadWash':
      l.batch = Math.min(2, l.dirty); l.dirty -= l.batch;
      l.status = 'washing'; l.loading = true; l.progress = 0; l.remaining = l.duration;
      s.money -= SERVICE_CONFIG.washCost; s.costs += SERVICE_CONFIG.washCost;
      startTask(bramble, { type: 'loadWash', phase: 'load', label: 'Loading the washing machine' }, [point(l)]);
      message = `Bramble is loading ${l.batch} towels. Wash costs ${SERVICE_CONFIG.washCost} coins.`;
      break;
    case 'finishFold': {
      const count = l.batch; l.clean += count; l.batch = 0; l.status = 'idle';
      l.progress = 0; l.remaining = 0; l.loading = false;
      message = `${count} clean towels folded and ready for guests!`;
      log(s, 'folded', message, l, `+${count} clean`);
      break;
    }
    case 'callOutThief':
      sendThiefAway(s, true);
      message = 'You sent Rook on his way. The till is safe.';
      log(s, 'shooed', message, s.actors.thief, '✓');
      break;
    case 'shooThief':
      startTask(bramble, { type: 'shooThief', phase: 'intercept', label: 'Walking over to shoo Rook' }, [point(s.actors.thief)]);
      message = 'Bramble is walking over to ask Rook to leave.';
      break;
  }
  log(s, 'order', message);
  return reply(s, true, message);
}

function activateThief(s) {
  const t = s.actors.thief;
  if (!s.config.thief || t.phase !== 'dormant') return;
  t.visible = true; t.phase = t.status = 'approaching'; t.timer = 0;
  t.remaining = SERVICE_CONFIG.thiefApproach;
  route(t, [{ x: 950, y: 440 }, { x: 950, y: 300 }, SERVICE_CONFIG.till], 'Rook is approaching the till. Tap him, then Shoo.');
  let previous = t;
  t.speed = t.path.reduce((total, p) => { const next = total + distance(previous, p); previous = p; return next; }, 0) / SERVICE_CONFIG.thiefApproach;
  log(s, 'thief', 'Rook is sneaking toward the till. Tap him and choose Shoo when Bramble is free.', t, 'Rook arrives');
}
function sendThiefAway(s, stopped) {
  const t = s.actors.thief;
  t.stopped = stopped; t.resolved = true; t.outcome = stopped ? 'shooed' : 'stole';
  t.phase = t.status = 'fleeing'; t.intercepted = false; t.timer = 0; t.remaining = 0;
  route(t, [{ x: 950, y: 300 }, { x: 950, y: 440 }, SERVICE_CONFIG.thiefEntry],
    stopped ? 'Rook is leaving. Good work, Bramble!' : 'Rook took 20 coins, but the shift can still succeed.');
  t.speed = 420;
}
function finishTowel(s, a, room, guest) {
  room.request = null; room.towelUsed = true; room.patience = 0;
  guest.request = null; guest.served = true; guest.status = guest.phase = 'served';
  guest.checkoutRemaining = .6; guest.intent = 'Lovely service! Checking out in a moment.';
  s.served += 1;
  log(s, 'service', `${guest.name} has a fresh towel and is ready to check out.`, guest, 'Thank you!');
  release(a);
}

function updateStaff(s, a, dt) {
  const j = a.job;
  if (!j) {
    if (a.returningHome) {
      if (walk(a, dt)) { a.returningHome = false; a.moving = false; a.action = 'idle'; a.intent = 'Ready to help'; }
    } else a.moving = false;
    return;
  }
  const room = roomById(s, j.roomId), guest = guestById(s, j.guestId);
  if (j.type === 'assignRoom') {
    if (j.phase === 'meet') {
      if (!walk(a, dt)) return;
      j.phase = 'guide';
      const destination = { x: room.x + 90, y: room.y + 25 };
      route(a, hallwayRoute(a, destination), j.label);
      route(guest, hallwayRoute(guest, room), `Following Pip to ${room.name}`);
      return;
    }
    if (j.phase === 'guide') {
      const arrived = walk(a, dt), guestArrived = walk(guest, dt);
      if (!arrived || !guestArrived) return;
      j.phase = 'welcome'; j.work = 0; guest.moving = false; guest.action = 'idle';
    }
    if (work(a, dt, .25, 'guiding')) {
      room.status = 'occupied'; room.request = 'towel'; room.patience = s.config.towelPatience;
      guest.status = 'occupied'; guest.phase = 'settled'; guest.request = 'towel'; guest.visible = false;
      guest.patience = s.config.towelPatience; guest.intent = 'A clean towel, please!';
      log(s, 'request', `${guest.name} is settled in ${room.name} and would like a clean towel.`, room, 'Towel, please');
      release(a);
    }
  } else if (j.type === 'deliverTowel') {
    if (j.phase === 'fetch') {
      if (!walk(a, dt)) return;
      a.carrying = 'linen'; j.phase = 'deliver';
      route(a, hallwayRoute(a, { x: room.x + 25, y: room.y + 18 }), j.label); return;
    }
    if (j.phase === 'deliver') {
      if (!walk(a, dt)) return;
      j.phase = 'give'; j.work = 0;
    }
    if (work(a, dt, .3, 'placing')) finishTowel(s, a, room, guest);
  } else if (j.type === 'cleanRoom') {
    if (j.phase === 'room') {
      if (!walk(a, dt)) return;
      j.phase = 'tidy'; j.work = 0;
    }
    if (j.phase === 'tidy') {
      room.progress = Math.min(1, (j.work + dt) / .65);
      if (!work(a, dt, .65, 'working')) return;
      room.status = 'available'; room.request = null; room.guestId = null; room.guestName = null;
      room.towelUsed = false; room.progress = 0; room.patience = 0;
      a.carrying = j.dirtyTowels ? 'dirty-linen' : null;
      j.phase = 'return'; route(a, hallwayRoute(a, s.laundry), 'Taking used towels to the laundry');
      log(s, 'cleaned', `${room.name} is fresh and available again.`, room, 'Room ready'); return;
    }
    if (j.phase === 'return' && walk(a, dt)) {
      s.laundry.dirty += j.dirtyTowels;
      if (j.dirtyTowels) log(s, 'laundry', 'Bramble brought a used towel to the laundry.', s.laundry, '+1 dirty');
      release(a);
    }
  } else if (j.type === 'loadWash') {
    if (!walk(a, dt)) return;
    if (work(a, dt, .35, 'placing')) {
      s.laundry.loading = false;
      log(s, 'washing', 'The wash is running. You can help guests while it works.', s.laundry, 'Washing');
      release(a);
    }
  } else if (j.type === 'shooThief') {
    const t = s.actors.thief;
    if (t.resolved) { release(a); return; }
    if (j.phase === 'intercept') {
      if (distance(a, t) > 42) { route(a, [point(t)], j.label); walk(a, dt); return; }
      j.phase = 'shoo'; j.work = 0; t.intercepted = true; t.moving = false;
    }
    if (work(a, dt, .4, 'working')) {
      sendThiefAway(s, true); release(a);
      log(s, 'shooed', 'Bramble gently sent Rook on his way. The till is safe.', t, 'Off you go!');
    }
  }
}
function beginCheckout(s, g) {
  const room = roomById(s, g.roomId);
  room.status = 'dirty'; room.request = null; room.patience = 0;
  g.status = g.phase = 'leaving'; g.visible = true; g.intent = 'Happy guest checking out';
  route(g, [{ x: g.x, y: 300 }, { x: 600, y: 300 }, SERVICE_CONFIG.entry]);
  g.speed = 650;
  const tip = g.tipEligible ? SERVICE_CONFIG.serviceTip : 0;
  g.payment = SERVICE_CONFIG.roomPrice + tip; g.paid = true;
  s.money += g.payment; s.earnings += g.payment; s.tips += tip;
  log(s, 'checkout', `${g.name} checked out: +${g.payment} coins. ${room.name} needs tidying.`, room, `+${g.payment} coins`);
  if (g.id === 'guest-1') arrive(s, 2);
  activateThief(s);
}
function abandon(s, g) {
  g.abandoned = true; g.status = g.phase = 'abandoned'; g.request = null;
  g.intent = 'Could not wait any longer'; g.resolved = true;
  g.path = []; g.target = null; g.moving = false; g.visible = false;
  s.abandoned += 1;
  const room = roomById(s, g.roomId);
  if (room) { room.status = 'dirty'; room.request = null; room.patience = 0; }
  log(s, 'abandoned', `${g.name} could not wait any longer. Let's try a fresh shift.`, g, 'Guest left');
}
function updateGuests(s, dt) {
  for (const g of s.guests) {
    if (g.status === 'waiting') {
      g.waitElapsed += dt; g.patience = Math.max(0, s.config.waitingPatience - g.waitElapsed);
      if (g.waitElapsed >= s.config.tipAfter) g.tipEligible = false;
      if (g.patience <= EPS) abandon(s, g);
    } else if (g.status === 'occupied' && g.request === 'towel') {
      g.roomElapsed += dt; g.patience = Math.max(0, s.config.towelPatience - g.roomElapsed);
      const room = roomById(s, g.roomId); room.patience = g.patience;
      if (g.roomElapsed >= s.config.tipAfter) g.tipEligible = false;
      if (g.patience <= EPS) abandon(s, g);
    } else if (g.status === 'served') {
      g.checkoutRemaining = Math.max(0, g.checkoutRemaining - dt);
      if (g.checkoutRemaining <= EPS) beginCheckout(s, g);
    } else if (g.status === 'leaving' && walk(g, dt)) {
      g.visible = false; g.moving = false; g.status = g.phase = 'departed';
      g.departed = true; g.resolved = true; g.action = 'idle';
      s.completed += 1;
      log(s, 'departed', `${g.name} left happy. ${s.completed}/${s.goal} guests looked after.`, g, `${s.completed}/${s.goal} happy`);
    }
  }
}
function updateLaundry(s, dt) {
  const l = s.laundry;
  if (l.status !== 'washing' || l.loading) return;
  l.remaining = Math.max(0, l.remaining - dt); l.progress = Math.min(1, 1 - l.remaining / l.duration);
  if (l.remaining <= EPS) {
    l.remaining = 0; l.progress = 1; l.status = 'ready';
    log(s, 'wash-ready', 'The towels are washed! Open laundry and fold them when you are ready.', l, 'Ready to fold');
  }
}
function updateThief(s, dt) {
  const t = s.actors.thief;
  if (!t.visible || t.intercepted) return;
  if (t.phase === 'approaching') {
    t.timer += dt; t.remaining = Math.max(0, SERVICE_CONFIG.thiefApproach - t.timer);
    walk(t, dt);
    if (t.remaining <= EPS) {
      t.phase = t.status = 'stealing'; t.timer = 0; t.remaining = SERVICE_CONFIG.thiefWarning;
      t.path = []; t.target = null; t.moving = false; t.action = 'stealing';
      t.intent = 'Rook is reaching for the till! Tap Rook, then Shoo.';
      log(s, 'theft-warning', 'Rook is reaching for the till! Bramble has 10 seconds to shoo him.', t, 'Shoo Rook!');
    }
  } else if (t.phase === 'stealing') {
    t.timer += dt; t.remaining = Math.max(0, SERVICE_CONFIG.thiefWarning - t.timer);
    if (t.remaining <= EPS) {
      const amount = Math.min(SERVICE_CONFIG.theftAmount, s.money);
      s.money -= amount; s.stolen += amount;
      sendThiefAway(s, false);
      log(s, 'theft', `Rook took ${amount} coins. Your guests can still have a lovely stay.`, t, `−${amount} coins`);
    }
  } else if (t.phase === 'fleeing' && walk(t, dt)) {
    t.visible = false; t.moving = false; t.phase = t.status = 'gone'; t.action = 'idle';
  }
}
function finishShift(s, won, reason) {
  s.status = won ? 'won' : 'lost'; s.paused = false;
  for (const actor of Object.values(s.actors)) actor.moving = false;
  s.result = { won, success: won, title: won ? 'A lovely stay!' : 'A fresh start?', reason,
    completed: s.completed, served: s.served, goal: s.goal, abandoned: s.abandoned,
    money: s.money, earnings: s.earnings, costs: s.costs, stolen: s.stolen,
    stars: won ? (s.stolen ? 2 : 3) : 0 };
  log(s, won ? 'won' : 'lost', reason);
}
function tick(s) {
  s.ticks += 1; s.time = s.ticks * STEP;
  updateStaff(s, s.actors.courier, STEP);
  updateStaff(s, s.actors.mechanic, STEP);
  updateGuests(s, STEP); updateLaundry(s, STEP); updateThief(s, STEP);
  if (s.completed >= s.goal) finishShift(s, true, 'All three guests enjoyed their stay and checked out!');
  else if (s.abandoned >= 1) finishShift(s, false, 'A guest could not wait any longer. A fresh shift is ready whenever you are.');
  else if (s.time + EPS >= s.timeLimit) finishShift(s, false, 'The shift ended before all three guests were looked after.');
}

/** Advance active simulated seconds. Invalid dt and paused/terminal states are no-ops. */
export function stepService(s, dt) {
  if (!s || s.paused || s.status !== 'playing' || !Number.isFinite(dt) || dt <= 0) return s;
  relinkGuests(s);
  // Bound huge foreground gaps by the finite shift, not an arbitrary discarded delta.
  s.accumulator += Math.min(dt, Math.max(STEP, s.timeLimit - s.time + STEP));
  while (s.accumulator + EPS >= STEP && !terminal(s)) {
    s.accumulator -= STEP;
    if (Math.abs(s.accumulator) < EPS) s.accumulator = 0;
    tick(s);
  }
  if (terminal(s)) s.accumulator = 0;
  return s;
}

/** Plain JSON-safe snapshot, including all actors, timers, reservations, and events. */
export function serviceSnapshot(s) { return copy(s); }

/** UI-ready action descriptors. Inspection never changes the state or feedback. */
export function availableServiceActions(s, target = null) {
  const inputs = [];
  const id = typeof target === 'string' ? target : target?.id;
  for (const g of s.guests.filter(g => g.status === 'waiting')) {
    for (const r of s.rooms) if (!id || id === g.id || id === r.id)
      inputs.push({ type: 'assignRoom', guestId: g.id, roomId: r.id, label: `Show ${g.name} to ${r.name}` });
  }
  for (const r of s.rooms) if (!id || id === r.id) {
    inputs.push({ type: 'deliverTowel', roomId: r.id, label: `Bring ${r.guestName || 'guest'} a towel` });
    inputs.push({ type: 'cleanRoom', roomId: r.id, label: `Tidy ${r.name}` });
  }
  if (!id || id === 'laundry' || id === 'cart') {
    inputs.push({ type: 'loadWash', label: `Load wash · ${SERVICE_CONFIG.washCost} coins` });
    inputs.push({ type: 'finishFold', label: 'Finish folding' });
  }
  if (!id || id === 'thief') inputs.push({ type: 'shooThief', label: 'Shoo Rook' });
  return inputs.map(input => {
    const reason = invalidReason(s, input);
    return { id: input.type, ...input, enabled: !reason, reason };
  });
}
