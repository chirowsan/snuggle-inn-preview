/* Inline at first paint: no imports, save writes, timers that delay entry, or audio. */
(() => {
  const root = document.documentElement;
  const game = document.getElementById('game');
  const loading = document.getElementById('loading');
  const bar = document.getElementById('load-progress');
  const track = bar.parentElement;
  const label = document.getElementById('load-stage');
  let done = false, failed = false, phase = '', lastCount = -1;
  const unblock = () => { for (const el of game.children) el.inert = false; };
  for (const el of game.children) el.inert = el !== loading;
  function stage(name, count, total) {
    if (done) return;
    if (name !== phase) { phase = name; label.textContent = name; }
    // Retry is for a real stall: any measured progress restarts the 20 s quiet-time check.
    if (Number.isFinite(count) && count !== lastCount) { lastCount = count; clearTimeout(slow); slow = setTimeout(stalled, 20000); }
    const measured = Number.isFinite(total) && total > 0;
    track.classList.toggle('indeterminate', !measured);
    track.setAttribute('aria-label', name);
    if (measured) {
      const value = Math.max(0, Math.min(total, count));
      track.setAttribute('aria-valuemax', total);
      track.setAttribute('aria-valuenow', value);
      track.setAttribute('aria-valuetext', `${value} of ${total} ${name.toLowerCase()}`);
      bar.style.width = `${value / total * 100}%`;
    } else {
      track.removeAttribute('aria-valuenow'); track.removeAttribute('aria-valuemax');
      track.removeAttribute('aria-valuetext'); bar.style.width = '';
    }
  }
  function finish() {
    if (done) return;
    done = true; clearTimeout(slow);
    loading.hidden = true;
    delete root.dataset.boot;
    game.removeAttribute('aria-busy');
  }
  function fail(error) {
    if (failed) return;
    failed = true; finish(); root.dataset.boot = 'error'; game.inert = true;
    const dialog = document.getElementById('load-error');
    dialog.hidden = false;
    for (const el of game.children) el.inert = true;
    document.getElementById('qa-state').textContent = JSON.stringify({ready:false,loadError:String(error?.message || error)});
    document.getElementById('reload').focus();
  }
  document.getElementById('reload').onclick = () => location.reload();
  document.getElementById('load-retry').onclick = () => location.reload();
  const stalled = () => { if (!done) document.getElementById('load-retry').hidden = false; };
  let slow = setTimeout(stalled, 20000);
  window.hotelBoot = Object.freeze({stage, unblock, finish, fail});
  stage('Opening hotel');
})();
