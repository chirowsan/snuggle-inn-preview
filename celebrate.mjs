/** Lightweight celebrations: a few short-lived DOM nodes animated with transform/opacity only.
 * No game state, no save writes. Haptics preference lives in its own device key, outside saves. */
export const HAPTICS_KEY = 'snuggle-inn-haptics';
export function hapticsEnabled(storage) { try { return storage?.getItem(HAPTICS_KEY) !== 'off'; } catch { return true; } }
export function setHapticsEnabled(storage, on) { try { storage?.setItem(HAPTICS_KEY, on ? 'on' : 'off'); } catch {} }
export function hapticsSupported(nav) { return typeof nav?.vibrate === 'function'; }
export function createCelebrations({ document, reducedMotion = () => false, haptics = () => true, sound = () => {} }) {
  const win = document.defaultView || globalThis; let layer = null, live = 0;
  const host = () => { if (!layer || !layer.isConnected) { layer = document.createElement('div'); layer.className = 'fx-layer'; layer.setAttribute('aria-hidden', 'true'); document.body.append(layer); } return layer; };
  const buzz = pattern => { if (!haptics()) return false; try { return !!win.navigator?.vibrate?.(pattern); } catch { return false; } };
  const mid = r => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  function piece(cls, x, y) { const el = document.createElement('i'); el.className = cls; el.style.left = x + 'px'; el.style.top = y + 'px'; host().append(el); live++; return el; }
  function run(el, frames, options) {
    const done = () => { if (el.isConnected) { el.remove(); live--; } };
    if (typeof el.animate !== 'function') { win.setTimeout(done, 300); return null; }
    const a = el.animate(frames, { fill: 'forwards', ...options }); a.onfinish = done; a.oncancel = done; return a;
  }
  function sparkle(x, y, count = 7) {
    if (live > 60) return;
    if (reducedMotion()) { run(piece('fx-glow', x, y), [{ opacity: 0 }, { opacity: .9, offset: .3 }, { opacity: 0 }], { duration: 500 }); return; }
    for (let i = 0; i < count; i++) {
      const a = i / count * Math.PI * 2 + Math.random() * .4, d = 18 + Math.random() * 18;
      run(piece('fx-spark', x, y), [{ transform: 'translate(0,0) scale(.3) rotate(0)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) scale(1) rotate(90deg)`, opacity: 0 }], { duration: 520 + Math.random() * 160, easing: 'cubic-bezier(.2,.7,.3,1)' });
    }
  }
  /** Coins fly from a door to the coin counter, then the counter sparkles. */
  function coins(fromRect, target, amount = 0) {
    const toRect = target?.getBoundingClientRect?.();
    buzz(20);
    if (!toRect || !toRect.width) return;
    const to = mid(toRect);
    if (!fromRect || !fromRect.width || reducedMotion()) { sparkle(to.x, to.y, 5); return; }
    const from = mid(fromRect), n = Math.min(9, 3 + Math.round(amount / 25)), dx = to.x - from.x, dy = to.y - from.y;
    let landed = 0;
    for (let i = 0; i < n && live < 60; i++) {
      const jx = (Math.random() - .5) * 46, jy = -30 - Math.random() * 50;
      const anim = run(piece('fx-coin', from.x, from.y), [
        { transform: 'translate(0,0) scale(.4)', opacity: 0 },
        { transform: `translate(${jx}px,${jy}px) scale(1.05)`, opacity: 1, offset: .25 },
        { transform: `translate(${dx * .55 + jx * .5}px,${dy * .55 - 40}px) scale(.95)`, opacity: 1, offset: .6 },
        { transform: `translate(${dx}px,${dy}px) scale(.55)`, opacity: .85 }
      ], { duration: 720, delay: i * 55, easing: 'cubic-bezier(.45,.05,.55,.95)' });
      const land = () => { if (++landed === 1 || landed === n) { sparkle(to.x, to.y, landed === n ? 8 : 4); } };
      if (anim) anim.finished?.then(land, () => {}); else land();
    }
  }
  /** Shift end / level up: a short fanfare, a celebratory buzz and (motion allowing) confetti. */
  function fanfare() {
    sound('fanfare'); buzz([40, 60, 40, 60, 90]);
    if (reducedMotion()) return;
    const w = win.innerWidth || 400, colors = ['#f6c85f', '#ff8fa8', '#8fd1b5', '#a7a3ec', '#fff1c4'];
    for (let i = 0; i < 26 && live < 70; i++) {
      const el = piece('fx-confetti', w * (.1 + .8 * Math.random()), -12); el.style.background = colors[i % colors.length];
      const drift = (Math.random() - .5) * 120, fall = (win.innerHeight || 800) * (.55 + Math.random() * .35);
      run(el, [{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: `translate(${drift}px,${fall}px) rotate(${360 + Math.random() * 540}deg)`, opacity: 0 }], { duration: 1500 + Math.random() * 700, delay: Math.random() * 250, easing: 'cubic-bezier(.25,.6,.5,1)' });
    }
  }
  return { coins, sparkle, fanfare, buzz, get live() { return live; } };
}
