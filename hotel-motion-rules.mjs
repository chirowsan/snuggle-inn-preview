/** Versioned pacing: old active shifts retain their exact motion and rules.
 * Revision 3 adds demand-gated, untimed Relaxed; Rush keeps revision-2 pacing. */
import {firstStepsOptions} from './hotel-first-steps.mjs';
import {validReputationPlan} from './hotel-reputation.mjs';
export const MOTION_RULES_VERSION = 3;
export const MOTION_SPEED = Object.freeze({ floor: 350, stairs: 245 });
const legacyPresets = Object.freeze({
  rush: Object.freeze({ timeLimit: 135, arrivals: Object.freeze([0, 12, 24, 36, 48, 60]),
    waitingPatience: 75, requestPatience: 40, goal: 3, maxMissed: 3, receiptNumerator: 37, receiptDenominator: 10 }),
  relaxed: Object.freeze({ timeLimit: 150, arrivals: Object.freeze([0, 16, 32, 48, 64, 80]),
    waitingPatience: 75, requestPatience: 65, goal: 3, maxMissed: 5, receiptNumerator: 51, receiptDenominator: 20 }),
});
const originalPresets = Object.freeze({
  rush: Object.freeze({timeLimit:120,arrivals:Object.freeze([0,6,15,24,33,42,50,58,66,74,82,90]),waitingPatience:50,requestPatience:40,goal:8,maxMissed:3,receiptNumerator:1,receiptDenominator:1}),
  relaxed:Object.freeze({timeLimit:150,arrivals:Object.freeze([0,8,18,28,40,52,64,76,88,100,112,124]),waitingPatience:75,requestPatience:65,goal:6,maxMissed:5,receiptNumerator:1,receiptDenominator:1}),
});
const calmPresets = Object.freeze({rush:originalPresets.rush, relaxed:Object.freeze({timeLimit:300,arrivals:Object.freeze([0,30,60,90,120,150]),waitingPatience:180,requestPatience:180,goal:3,maxMissed:5,receiptNumerator:1,receiptDenominator:1})});
export const isCalmShift = state => state?.version === 7 && state.config?.motionRules === 3 && state.config?.motionMode === 'relaxed';
export const ORIGINAL_MOTION_SPEED = Object.freeze({floor:850,stairs:595});
export const validMotionRule = value => value === 1 || value === 2 || value === 3;
const presetsFor = revision => { if(!validMotionRule(revision)) throw new TypeError('Unknown motion policy'); return revision === 1 ? legacyPresets : revision === 2 ? originalPresets : calmPresets; };
export const motionSpeed = state => state?.config?.motionRules >= 2 ? ORIGINAL_MOTION_SPEED : MOTION_SPEED;
export function motionMode(value) { return value === 'relaxed' ? 'relaxed' : 'rush'; }
export function motionOptions(mode, revision = MOTION_RULES_VERSION) {
  const presets = presetsFor(revision);
  const id = motionMode(mode), p = presets[id];
  return { motionRules: revision, motionMode: id, timeLimit: p.timeLimit,
    arrivalSchedule: [...p.arrivals], waitingPatience: p.waitingPatience,
    requestPatience: p.requestPatience, goal: p.goal, maxMissed: p.maxMissed };
}
/** Round once per physically paid guest, never scale settlement or inspector bonuses. */
export function motionReceipt(base, mode, revision = MOTION_RULES_VERSION) {
  const presets = presetsFor(revision);
  if (!Number.isSafeInteger(base) || base < 0) throw new TypeError('Invalid guest payment');
  const p = presets[motionMode(mode)];
  const scaled = base * p.receiptNumerator;
  if (!Number.isSafeInteger(scaled)) throw new RangeError('Guest payment exceeds safe bounds');
  return Math.floor(scaled / p.receiptDenominator)
    + (2 * (scaled % p.receiptDenominator) >= p.receiptDenominator ? 1 : 0);
}
export const hasMotionRules = state => state?.version === 7 && validMotionRule(state.config?.motionRules);
export function validShiftIdentity(value) { return typeof value === 'string' && /^shift-[1-9]\d*$/.test(value)
  && Number.isSafeInteger(Number(value.slice(6))); }
/** Restore accepts only an exact recognized saved preset, never fallback normalization. */
const own = (value, key) => value && typeof value === 'object' ? Object.getOwnPropertyDescriptor(value, key)?.value : undefined;
export function validMotionPreset(config) {
  try {
    const mode = own(config, 'motionMode');
    if (!validMotionRule(own(config, 'motionRules'))) return false;
    const presets = presetsFor(own(config, 'motionRules'));
    if (!Object.hasOwn(presets, mode)) return false;
    const rule=own(config,'firstStepsRules');
    if(rule!==undefined&&(![1,2].includes(rule)||own(config,'motionRules')!==3||mode!=='relaxed'||own(config,'thief')!==false||own(config,'reputationPlan')!==undefined))return false;
    const p = {...presets[mode],...firstStepsOptions(rule)};
    for (const key of ['timeLimit','waitingPatience','requestPatience','goal','maxMissed']) if (own(config, key) !== p[key]) return false;
    const schedule = own(config, 'arrivalSchedule'), plan=own(config,'reputationPlan');
    if(plan!==undefined && (own(config,'motionRules')!==3 || !validReputationPlan(plan) || plan.booking&&mode!=='relaxed'))return false;
    const base=p.arrivalSchedule||p.arrivals;
    const arrivals=plan?.booking?[...base,base.at(-1)+30]:base;
    return Array.isArray(schedule) && own(schedule, 'length') === arrivals.length
      && arrivals.every((time, i) => own(schedule, String(i)) === time);
  } catch { return false; }
}
