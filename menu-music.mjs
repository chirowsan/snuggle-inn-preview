/** Main-menu music. Silent until the player has interacted with the page (mobile autoplay rules),
 * only while the menu is open, follows the hotel's music on/off + volume, and pauses in hidden tabs.
 * Uses one small looping <audio> element so the in-hotel Web Audio engine stays untouched. */
export function createMenuMusic({ document, src, prefs, AudioElement = (document.defaultView || globalThis).Audio }) {
  const win = document.defaultView || globalThis;
  let el = null, open = false, primed = !!win.navigator?.userActivation?.hasBeenActive;
  const level = () => { const p = prefs() || {}; return p.enabled === false ? 0 : Math.max(0, Math.min(1, Number(p.volume) || 0)) * .6; };
  function element() { if (!el && typeof AudioElement === 'function') { el = new AudioElement(); el.loop = true; el.preload = 'none'; el.src = src(); } return el; }
  function sync() {
    const v = level();
    if (!open || !primed || v <= 0 || document.hidden) { if (el && !el.paused) el.pause(); return false; }
    const a = element(); if (!a) return false;
    a.volume = v;
    if (a.paused) { try { const p = a.play(); p?.catch?.(() => {}); } catch {} }
    return true;
  }
  const gesture = () => { primed = true; sync(); };
  document.addEventListener?.('visibilitychange', sync);
  return {
    open() { open = true; return sync(); },
    close() { open = false; if (el) { el.pause(); } },
    gesture, sync,
    get playing() { return !!el && !el.paused; },
    get primed() { return primed; }
  };
}
