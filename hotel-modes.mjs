import { validMotionPreset } from './hotel-motion-rules.mjs';
/** Optional pacing presets. Difficulty is metadata, not the engine's `mode` tag.
 * Apply modeOptions only when constructing a new shift. Never patch a live shift.
 */
const relaxedOptions = Object.freeze({
  timeLimit: 150,
  arrivalSchedule: Object.freeze([0, 8, 18, 28, 40, 52, 64, 76, 88, 100, 112, 124]),
  waitingPatience: 75,
  requestPatience: 65,
  goal: 6,
  maxMissed: 5,
});

export const MODES = Object.freeze({
  rush: Object.freeze({ id: 'rush', label: 'Rush', options: Object.freeze({}) }),
  relaxed: Object.freeze({ id: 'relaxed', label: 'Relaxed', options: relaxedOptions }),
});

const isMode = value => value === 'rush' || value === 'relaxed';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
// Saved data may be malformed. Do not invoke getters or accept inherited fields.
function own(value, key) {
  try { return object(value) ? Object.getOwnPropertyDescriptor(value, key)?.value : undefined; }
  catch { return undefined; }
}
function hasOwn(value, key) {
  try { return object(value) && Object.hasOwn(value, key); }
  catch { return false; }
}

/** Accept exact mode IDs only; an invalid fallback itself safely becomes Rush. */
export function normalizeMode(value, fallback = 'rush') {
  return isMode(value) ? value : isMode(fallback) ? fallback : 'rush';
}

/** Independent engine overrides, with deliberately no Rush overrides at all. */
export function modeOptions(mode) {
  if (normalizeMode(mode) === 'rush') return {};
  return { ...relaxedOptions, arrivalSchedule: [...relaxedOptions.arrivalSchedule] };
}

function exactRelaxedConfig(checkpoint) {
  const config = own(checkpoint, 'config');
  for (const key of ['timeLimit', 'waitingPatience', 'requestPatience', 'goal', 'maxMissed']) {
    if (own(config, key) !== relaxedOptions[key]) return false;
  }
  const schedule = own(config, 'arrivalSchedule');
  try {
    if (!Array.isArray(schedule) || Object.getOwnPropertyDescriptor(schedule, 'length')?.value !== relaxedOptions.arrivalSchedule.length) return false;
    for (let i = 0; i < relaxedOptions.arrivalSchedule.length; i++) {
      if (Object.getOwnPropertyDescriptor(schedule, String(i))?.value !== relaxedOptions.arrivalSchedule[i]) return false;
    }
  } catch { return false; }
  // These fields are duplicated by real engine checkpoints. Contradictory saved
  // values are corruption, not evidence to relabel an existing Rush shift.
  for (const key of ['timeLimit', 'goal', 'maxMissed']) {
    if (hasOwn(checkpoint, key) && own(checkpoint, key) !== relaxedOptions[key]) return false;
  }
  return true;
}

/** Classify the existing shift without modifying it or validating its ledger.
 * restoreRush remains responsible for accepting or rejecting the checkpoint.
 * Saved explicitMode is advisory: stale labels cannot override actual pacing.
 * Legacy/custom/partial checkpoints stay Rush unless ALL Relaxed fields match.
 * checkpoint.mode === 'rush' is the engine format discriminator, not difficulty.
 */
export function classifyCheckpointMode(checkpoint, explicitMode) {
  const config = own(checkpoint, 'config');
  const motion = own(checkpoint, 'version') === 7 && validMotionPreset(config)
    && ['timeLimit', 'goal', 'maxMissed'].every(key => own(checkpoint, key) === own(config, key))
    && ['motionMode', 'motionRules'].every(key => !hasOwn(checkpoint, key) || own(checkpoint, key) === own(config, key));
  const inferred = motion ? own(config, 'motionMode') : exactRelaxedConfig(checkpoint) ? 'relaxed' : 'rush';
  return isMode(explicitMode) && explicitMode === inferred ? explicitMode : inferred;
}

/** Next-shift default is now calm, including historical ambiguous preferences.
 * Older builds persisted preferredMode for both defaults and clicks, so those
 * cannot be distinguished. Active checkpoint identity/timing never changes.
 * New explicit choices have modeChosenByPlayer:true and survive future reloads.
 */
export function resolveMode(envelope) {
  const checkpointPresent = hasOwn(envelope, 'checkpoint');
  const checkpointMode = classifyCheckpointMode(own(envelope, 'checkpoint'), own(envelope, 'activeMode'));
  const fallback = 'relaxed';
  const preferredMode = normalizeMode(own(envelope, 'modeChosenByPlayer') === true ? own(envelope, 'preferredMode') : undefined, fallback);
  return { preferredMode, activeMode: checkpointPresent ? checkpointMode : preferredMode };
}
