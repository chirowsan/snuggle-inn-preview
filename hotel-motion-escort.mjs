/** Authoritative v7 shared-spine escorts. No renderer positions or animation clocks.
 * Both actors traverse the same polyline; one shared progress survives saves.
 * The leading or following animal briefly waits at departure to establish the
 * exact endpoint gap, then keeps it on the whole shared spine. No docking snap.
 */
import { conservativeFloorRoute, previousMotionFloorRoute } from './hotel-motion-route.mjs';
import { stairAt } from './rush-floors.mjs';
import { MOTION_SPEED } from './hotel-motion-rules.mjs';
const EPS = 1e-9;
const point = p => ({ x: p.x, y: p.y });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const same = (a, b) => distance(a, b) < 1e-7;
export const ESCORT_PATH_LIMIT = 96;

export function escortPlan(leader, guest, guestEnd, leaderEnd, routeRevision=1) {
  return planFor(leader,guest,guestEnd,leaderEnd,(a,b)=>conservativeFloorRoute(a,b,routeRevision));
}
function planFor(leader, guest, guestEnd, leaderEnd, route) {
  const points = [point(guest)];
  const push = p => { if (distance(points.at(-1), p) > EPS) points.push(point(p)); };
  push(leader);
  const leaderStartDistance = distance(guest, leader);
  for (const p of route(leader, guestEnd)) push(p);
  const guestEndDistance = points.slice(1).reduce((n, p, i) => n + distance(points[i], p), 0);
  push(leaderEnd);
  const totalDistance = guestEndDistance + distance(guestEnd, leaderEnd);
  if (points.length > ESCORT_PATH_LIMIT || totalDistance <= leaderStartDistance) throw new Error('Invalid escort route');
  return { version: 1, origin: point(guest), leaderOrigin: point(leader), guestEnd: point(guestEnd),
    leaderEnd: point(leaderEnd), points, leaderStartDistance, guestEndDistance, totalDistance, progress: 0 };
}

function sample(points, distanceAlong, speeds=MOTION_SPEED) {
  let start = points[0], left = Math.max(0, distanceAlong);
  for (let i = 1; i < points.length; i++) {
    const end = points[i], length = distance(start, end);
    if (left < length - EPS) {
      const p = { x: start.x + (end.x - start.x) * left / length,
        y: start.y + (end.y - start.y) * left / length };
      return { point: p, remaining: length - left, path: points.slice(i).map(point),
        speed: stairAt({ x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }) ? speeds.stairs : speeds.floor };
    }
    left -= length; start = end;
  }
  return { point: point(points.at(-1)), remaining: 0, path: [], speed: speeds.floor };
}
export function escortPositions(plan, speeds=MOTION_SPEED) {
  const leaderLength = plan.totalDistance - plan.leaderStartDistance;
  const span = Math.max(leaderLength, plan.guestEndDistance), travel = plan.progress * span;
  const leaderArc = plan.leaderStartDistance + Math.max(0, travel - (span - leaderLength));
  const guestArc = Math.max(0, travel - (span - plan.guestEndDistance));
  const leader = sample(plan.points, leaderArc, speeds);
  const guest = sample(plan.points, guestArc, speeds);
  // The guest stops at its own endpoint, before the leader's docking extension.
  if (plan.progress >= 1 - EPS) { guest.point = point(plan.guestEnd); guest.path = []; }
  else {
    const endpoint = guest.path.findIndex(p => same(p, plan.guestEnd));
    if (endpoint >= 0) guest.path = guest.path.slice(0, endpoint + 1);
  }
  return { leader, guest, gap: leaderArc - guestArc };
}
function project(actor, sample, elapsed = 0) {
  const dx = sample.point.x - actor.x, moved = distance(sample.point, actor);
  if (Math.abs(dx) > .1) actor.facing = dx < 0 ? -1 : 1;
  Object.assign(actor, sample.point); actor.path = sample.path; actor.target = actor.path[0] || null;
  actor.moving = moved > EPS;
  if (actor.moving) { actor.action = 'walking'; actor.walkTime += elapsed; }
}
export function beginEscort(leader, guest, guestEnd, leaderEnd, routeRevision=1) {
  leader.job.escort = escortPlan(leader, guest, guestEnd, leaderEnd, routeRevision);
  const pose = escortPositions(leader.job.escort);
  project(leader, pose.leader); project(guest, pose.guest);
  leader.progress = guest.progress = 0;
  guest.intent = `Following ${leader.name}`;
}
export function stepEscort(leader, guest, dt, speeds=MOTION_SPEED) {
  const plan = leader.job.escort;
  const leaderLength = plan.totalDistance - plan.leaderStartDistance, guestLength = plan.guestEndDistance;
  const span = Math.max(leaderLength, guestLength), leaderDelay = span - leaderLength, guestDelay = span - guestLength;
  let remaining = dt, leaderTime = 0, guestTime = 0, guard = 0;
  while (plan.progress < 1 - EPS && remaining > EPS && guard++ < ESCORT_PATH_LIMIT * 2) {
    const travel = plan.progress * span, pose = escortPositions(plan, speeds);
    const leaderActive = travel + EPS >= leaderDelay, guestActive = travel + EPS >= guestDelay;
    const speed = Math.min(leaderActive ? pose.leader.speed : Infinity, guestActive ? pose.guest.speed : Infinity);
    const boundary = Math.min(span - travel, leaderActive ? pose.leader.remaining : leaderDelay - travel,
      guestActive ? pose.guest.remaining : guestDelay - travel);
    const advance = Math.min(remaining * speed, boundary);
    if (advance <= EPS) break;
    const used = advance / speed;
    plan.progress = Math.min(1, (travel + advance) / span); remaining -= used;
    if (leaderActive) leaderTime += used;
    if (guestActive) guestTime += used;
  }
  if (plan.progress >= 1 - EPS) plan.progress = 1;
  const pose = escortPositions(plan, speeds); project(leader, pose.leader, leaderTime); project(guest, pose.guest, guestTime);
  return plan.progress === 1;
}

/** Strict enough to reject inconsistent saved roots, path, gap, and endpoints. */
export function validEscort(plan, leader, guest, guestEnd, leaderEnd, routeRevision=1) {
  try {
    const keys = ['version','origin','leaderOrigin','guestEnd','leaderEnd','points','leaderStartDistance','guestEndDistance','totalDistance','progress'];
    if (!plan || Object.keys(plan).length !== keys.length || !keys.every(k => Object.hasOwn(plan, k)) || plan.version !== 1 ||
      !Number.isFinite(plan.progress) || plan.progress < 0 || plan.progress >= 1 || !same(plan.guestEnd, guestEnd) || !same(plan.leaderEnd, leaderEnd)) return false;
    // The persisted shared spine is the initial heading authority. Current
    // actors may be past its first landing, so never reconstruct from them.
    const leaderOrigin = { ...plan.leaderOrigin, path: plan.points.slice(distance(plan.origin, plan.leaderOrigin) > EPS ? 2 : 1) };
    const matches=canonical=>keys.filter(k=>k!=='progress').every(key=>JSON.stringify(plan[key])===JSON.stringify(canonical[key]));
    if(!matches(escortPlan(leaderOrigin, plan.origin, guestEnd, leaderEnd,routeRevision))&&
      !(routeRevision===1&&matches(planFor(leaderOrigin,plan.origin,guestEnd,leaderEnd,previousMotionFloorRoute))))return false;
    const pose = escortPositions(plan);
    return [[leader, pose.leader], [guest, pose.guest]].every(([actor, expected]) => same(actor, expected.point) &&
      JSON.stringify(actor.path) === JSON.stringify(expected.path) && JSON.stringify(actor.target) === JSON.stringify(expected.path[0] || null));
  } catch { return false; }
}
