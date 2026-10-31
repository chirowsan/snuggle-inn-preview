import {validRoomDoorXs,copyRoomDoorXs} from './hotel-room-doors.mjs';
import {hasCoinPickups,coinCash,pendingDoorCoins} from './hotel-coin-pickups.mjs';
/** UI-independent lifecycle seam. Callers persist the returned state/profile
 * together; this module never reads storage or silently replaces bad evidence.
 */
import { createRush, restoreRush, rushSnapshot } from './rush.mjs';
import { createProfile, beginShift, settleShift, profileSnapshot, validProfile } from './rush-economy.mjs';
import { hasMotionRules, MOTION_RULES_VERSION, validMotionRule } from './hotel-motion-rules.mjs';
import { classifyCheckpointMode } from './hotel-modes.mjs';
const freshSessions = new WeakSet();
const clone = value => JSON.parse(JSON.stringify(value));
const terminal = state => ['won', 'lost'].includes(state.status);
const fail = code => ({ ok: false, code, recoveryRequired: true });
const replace = (target, source) => { for (const key of Object.keys(target)) delete target[key]; Object.assign(target, source); };
const bindingMatches = (active, state, shiftId) => JSON.stringify(active?.roomDoorXs)===JSON.stringify(state.config?.roomDoorXs) && active?.coinPickupRules===state.config?.coinPickupRules && JSON.stringify(active?.pickupCarry)===JSON.stringify(state.config?.pickupCarry) && active?.firstStepsRules===state.config?.firstStepsRules && JSON.stringify(active?.staffPlan)===JSON.stringify(state.config?.staffPlan) && JSON.stringify(active?.reputationPlan)===JSON.stringify(state.config?.reputationPlan) && active?.id === shiftId && active.startingBank === state.startingMoney &&
  (hasMotionRules(state) ? state.shiftId === shiftId && active.engineVersion === 7 && active.motionRules === state.config.motionRules &&
    active.motionMode === state.config.motionMode : !['engineVersion','motionRules','motionMode'].some(key => Object.hasOwn(active, key)));
function settledMatches(profile, state, shiftId) {
  const result = profile.lastResult;
  return (hasCoinPickups(state)?JSON.stringify(result?.coinCash)===JSON.stringify(coinCash(state))&&JSON.stringify(profile.doorCoins)===JSON.stringify(pendingDoorCoins(state)):!Object.hasOwn(result||{},'coinCash')&&!Object.hasOwn(profile,'doorCoins')) && (!state.reputation || profile.reputation?.lastAppliedShift===profile.lastSettledShift && (!state.reputation.article || JSON.stringify(profile.reputation.articles.at(-1))===JSON.stringify(state.reputation.article))) && terminal(state) && result?.shiftId === shiftId && !profile.activeShift && result.status === state.status &&
    result.startingBank === state.startingMoney && result.bank === state.money &&
    ['earnings','costs','stolen','tips','completed','missed'].every(key => result[key] === state[key]) &&
    (!hasMotionRules(state) || state.shiftId === shiftId);
}

/** Commit issuance only after the exact engine constructor has succeeded. */
export function beginMotionSession(profile, mode = 'rush', options = {}) {
  const descriptor = options && Object.getOwnPropertyDescriptor(options, 'motionRules');
  const revision = descriptor ? descriptor.value : MOTION_RULES_VERSION;
  if (!['rush', 'relaxed'].includes(mode) || !validProfile(profile) || !validMotionRule(revision)) return fail('invalid-session-options');
  const doors=Object.getOwnPropertyDescriptor(options,'roomDoorXs');
  if(doors&&(!Object.hasOwn(doors,'value')||!validRoomDoorXs(doors.value)))return fail('invalid-room-doors');
  const next = clone(profile), issued = beginShift(next, { motionRules: revision, motionMode: mode, ...(doors?{roomDoorXs:copyRoomDoorXs(doors.value)}:{}), ...(options.reputationRules===1?{reputationRules:1}:{}),...(Object.hasOwn(options,'coinPickupRules')?{coinPickupRules:options.coinPickupRules}:{}) });
  if (!issued.ok) return issued;
  try {
    const state = createRush({ ...issued.options,
      ...(options.visitSeed === undefined ? {} : { visitSeed: options.visitSeed }),
      settings: options.settings || {}, paused: options.paused === true });
    replace(profile, next);
    const session = { shiftId: issued.shiftId, state, mode }; freshSessions.add(session);
    return { ok: true, session };
  } catch { return fail('invalid-session-options'); }
}

/** Capture at modal/activity creation, not when its eventual callback runs. */
export function captureMotionSession(session) { return Object.freeze({ session, state: session.state, shiftId: session.shiftId }); }
export function currentMotionCapture(session, capture) {
  return capture?.session === session && capture.state === session.state && capture.shiftId === session.shiftId;
}

/** A successful identical settled reload is idempotent; unrelated failures are
 * blockers and must not enable Next shift. Raw engine retry retains the ID.
 */
export function settleMotionSession(profile, session, capture) {
  if (!currentMotionCapture(session, capture)) return fail('stale-session');
  const state = restoreRush(rushSnapshot(session.state));
  if (!state || !terminal(state) || !validProfile(profile)) return fail('invalid-session');
  if (settledMatches(profile, state, session.shiftId)) return { ok: true, alreadySettled: true, result: clone(profile.lastResult) };
  if (!bindingMatches(profile.activeShift, state, session.shiftId)) return fail('shift-binding');
  return settleShift(profile, session.shiftId, state);
}

/** No writes on failure. The caller retains the original envelope for recovery.
 * This also restores old active shifts without upgrading them to motion rules.
 */
export function restoreMotionSession(envelope) {
  try {
    if (!envelope || typeof envelope !== 'object' || !Object.hasOwn(envelope, 'checkpoint')) return fail('missing-checkpoint');
    const profileVersion = envelope.profile?.version;
    if (![1, 2, 3, 4].includes(profileVersion) || profileVersion === 4 && !validProfile(envelope.profile)) return fail('invalid-profile');
    const state = restoreRush(envelope.checkpoint), profile = createProfile(envelope.profile), shiftId = envelope.shiftId;
    if (hasMotionRules(state) && profileVersion !== 4) return fail('invalid-profile');
    if (!state || !validProfile(profile)) return fail('invalid-checkpoint');
    if (profile.activeShift && (profile.construction || state.config.roomSlots) && (!profile.construction || JSON.stringify(profile.construction.slots)!==JSON.stringify(state.config.roomSlots) || profile.openRooms!==state.openRooms || JSON.stringify(profile.roomTiers)!==JSON.stringify(state.config.roomTiers))) return fail('construction-binding');
    if (!bindingMatches(profile.activeShift, state, shiftId) && !settledMatches(profile, state, shiftId)) return fail('shift-binding');
    return { ok: true, profile, session: { shiftId, state, mode: classifyCheckpointMode(state, envelope.activeMode) },
      alreadySettled: settledMatches(profile, state, shiftId) };
  } catch { return fail('invalid-checkpoint'); }
}

/** Only an untouched, freshly constructed v7 session can change its active mode.
 * The owner must not use this for a restored legacy checkpoint. */
export function changeUnstartedMotionMode(profile, session, mode) {
  if (!freshSessions.has(session) || !['rush','relaxed'].includes(mode) || !hasMotionRules(session.state) || !validProfile(profile) ||
    !bindingMatches(profile.activeShift, session.state, session.shiftId)) return fail('invalid-session');
  const old = session.state;
  if (old.time !== 0 || old.ticks !== 0 || old.accumulator !== 0 || old.status !== 'playing' ||
    old.guests.some(g => !['waiting','pending'].includes(g.status)) || old.costs !== 0 || old.earnings !== 0 ||
    Object.values(old.actors).some(a => a.job || a.path.length)) return fail('already-started');
  const base = createRush({ ...old.config, shiftId: old.shiftId, settings: old.settings });
  if (JSON.stringify(rushSnapshot(base)) !== JSON.stringify(rushSnapshot(old))) return fail('already-started');
  const next = clone(profile);
  next.activeShift.motionMode = mode;
  // Rebuild from the same owned hotel and identity without issuing another ID.
  const freshProfile = clone(next); freshProfile.activeShift = null; freshProfile.nextShift = profile.activeShift.ordinal;
  const issued = beginShift(freshProfile, { motionRules: old.config.motionRules, motionMode: mode, ...(old.config.roomDoorXs?{roomDoorXs:copyRoomDoorXs(old.config.roomDoorXs)}:{}), ...(old.config.reputationPlan?{reputationRules:1}:{}) });
  if (!issued.ok || issued.shiftId !== session.shiftId) return fail('invalid-session');
  const state = createRush({ ...issued.options, visitSeed: old.config.visitSeed, settings: old.settings });
  // The reissued policy is authoritative: mode changes may add/remove a
  // first-stay rule as well as retaining door/coin/staff bindings.
  next.activeShift=clone(freshProfile.activeShift);
  replace(profile, next); session.state = state; session.mode = mode;
  return { ok: true, session };
}

export function motionSessionEnvelope(profile, session, extra = {}) {
  return { ...extra, profile: profileSnapshot(profile), shiftId: session.shiftId,
    checkpoint: rushSnapshot(session.state), activeMode: session.mode };
}
