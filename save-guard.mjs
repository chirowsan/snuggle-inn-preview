/** One committed local save. Web Locks arbitrate; IndexedDB transactions fence every write. */
export const SAVE_KEY = 'neighborhood-mischief-save-v2';
export const SAVE_LOCK = 'neighborhood-mischief-save-writer-v2';
export const SIGNAL_KEY = 'neighborhood-mischief-save-handoff-v2';
export const LEGACY_KEYS = ['neighborhood-mischief-v1', 'neighborhood-mischief-rush-v1'];
const object = x => !!x && typeof x === 'object' && !Array.isArray(x);
const empty = () => ({saved: {}, envelope: {}});
const copy = x => JSON.parse(JSON.stringify(x));

/** The callback and localStorage write run inside one serialized readwrite transaction. */
export function indexedFence(indexedDB, timeoutMs = 6000) {
  let connection;
  const open = () => {
    if (connection) return connection;
    const attempt = new Promise((resolve, reject) => {
      if (!indexedDB?.open) { reject(Error('unavailable')); return; }
      let request, settled = false;
      const fail = () => { if (!settled) { settled = true; clearTimeout(timer); reject(Error('unavailable')); } };
      const timer = setTimeout(fail, timeoutMs);
      try { request = indexedDB.open(SAVE_LOCK, 1); } catch { fail(); return; }
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('owner')) request.result.createObjectStore('owner'); };
      request.onerror = request.onblocked = fail;
      request.onsuccess = () => {
        if (settled) { request.result.close(); return; }
        settled = true; clearTimeout(timer);
        const db = request.result;
        db.onversionchange = () => { db.close(); connection = null; };
        db.onclose = () => { connection = null; };
        resolve(db);
      };
    });
    connection = attempt.catch(error => { connection = null; throw error; });
    return connection;
  };
  return async callback => {
    const db = await open();
    return new Promise((resolve, reject) => {
      let result, failure, tx;
      try { tx = db.transaction('owner', 'readwrite'); } catch { connection = null; reject(Error('unavailable')); return; }
      const timer = setTimeout(() => { failure = Error('unavailable'); try { tx.abort(); } catch { reject(failure); } }, timeoutMs);
      const store = tx.objectStore('owner'), request = store.get('writer');
      request.onsuccess = () => {
        try { result = callback(request.result ?? null, next => next === null ? store.delete('writer') : store.put(next, 'writer')); }
        catch (error) { failure = error; tx.abort(); }
      };
      tx.oncomplete = () => { clearTimeout(timer); resolve(result); };
      tx.onabort = tx.onerror = () => { clearTimeout(timer); reject(failure ?? Error('unavailable')); };
    });
  };
}

export function createSaveGuard(options = {}) {
  const win = options.window ?? globalThis.window;
  const locks = options.locks ?? globalThis.navigator?.locks;
  const now = options.now ?? Date.now;
  const later = options.setTimeout ?? globalThis.setTimeout;
  const cancel = options.clearTimeout ?? globalThis.clearTimeout;
  const id = options.id ?? globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  const waitMs = options.waitMs ?? 6000, graceMs = options.graceMs ?? 500;
  const fence = options.fence ?? indexedFence(options.indexedDB ?? globalThis.indexedDB);
  let storage;
  try { storage = Object.hasOwn(options, 'storage') ? options.storage : globalThis.localStorage; } catch {}
  let active = false, reason = 'starting', releaseLock, pending = false, disposed = false, generation = 0;
  let revision = 0, lastRaw = null, snapshot = empty(), hooks = {}, channel, ownerToken, queue = Promise.resolve(), releaseTask;
  const native = !!locks?.request, rejectedTokens = new Set();
  const status = () => ({active, reason, pending: !!pending, revision, backend: native ? 'web-locks' : 'indexeddb'});
  const notify = () => hooks.onStatus?.(status());
  try {
    const Channel = Object.hasOwn(options, 'BroadcastChannel') ? options.BroadcastChannel : globalThis.BroadcastChannel;
    if (Channel) { channel = new Channel(SIGNAL_KEY); channel.onmessage = e => receive(e.data); }
  } catch { /* Storage events are a second signaling path, not ownership authority. */ }
  const storageListener = e => {
    if (e.key === SIGNAL_KEY && e.newValue) { try { receive(JSON.parse(e.newValue)); } catch {} }
    if (e.key === SAVE_KEY && active && e.newValue !== lastRaw) {
      // A queued own write can finish after another tab's earlier storage event.
      // Verify the authoritative fence, rather than treating event order as ownership.
      void verify();
    }
  };
  win?.addEventListener('storage', storageListener);
  function read() {
    if (!storage) throw Error('storage');
    let raw;
    try { raw = storage.getItem(SAVE_KEY); } catch { throw Error('storage'); }
    if (raw !== null) {
      let parsed;
      try { parsed = JSON.parse(raw); } catch { throw Error('corrupt'); }
      if (!object(parsed) || ![1,2].includes(parsed.version) || (parsed.version === 2 && !object(parsed.data?.slotBank)) || !Number.isSafeInteger(parsed.revision) || parsed.revision < 1 || !object(parsed.data) || !object(parsed.data.saved) || !object(parsed.data.envelope)) throw Error('corrupt');
      return {raw, revision: parsed.revision, data: parsed.data};
    }
    const values = LEGACY_KEYS.map(key => {
      let value;
      try { value = storage.getItem(key); } catch { throw Error('storage'); }
      if (value === null) return {};
      try { value = JSON.parse(value); } catch { throw Error('corrupt'); }
      if (!object(value)) throw Error('corrupt');
      return value;
    });
    return {raw: null, revision: 0, data: {saved: values[0], envelope: values[1]}};
  }
  function adopt(record) { lastRaw = record.raw; revision = record.revision; snapshot = copy(record.data); }
  function stop(why) {
    active = false; reason = why; notify();
  }
  function fail(error) {
    if (ownerToken) rejectedTokens.add(ownerToken);
    stop(['storage', 'corrupt', 'changed'].includes(error?.message) ? error.message : 'unavailable');
    releaseLock?.(); releaseLock = null;
  }
  function write(data) {
    if (!active || disposed) return Promise.resolve(false);
    const token = ownerToken, payload = copy(data);
    const task = queue.then(() => fence(owner => {
      if (rejectedTokens.has(token) || owner?.token !== token) throw Error('changed');
      if (storage.getItem(SAVE_KEY) !== lastRaw) throw Error('changed');
      if (!object(payload.saved) || !object(payload.envelope)) throw Error('storage');
      const raw = JSON.stringify({version: payload.slotBank ? 2 : 1, revision: revision + 1, data: payload});
      storage.setItem(SAVE_KEY, raw); // Single atomic value: profile and checkpoint cannot split.
      lastRaw = raw; revision++; snapshot = payload;
      return true;
    })).catch(error => { if (ownerToken === token) fail(error); return false; });
    queue = task;
    return task;
  }
  async function verify() {
    if (!active) return false;
    const token = ownerToken;
    try {
      const valid = await fence(owner => owner?.token === token);
      if (!valid && ownerToken === token) { stop('other-tab'); releaseLock?.(); releaseLock = null; }
      return valid;
    } catch (error) { fail(error); return false; }
  }
  function pause(why = 'paused') {
    if (pending) { pending.controller?.abort(); pending.cancelled = true; }
    if (!active) return releaseTask ?? Promise.resolve();
    // Capture the final UI/input state synchronously, before disabling all new work.
    try { hooks.beforeRelease?.(); } catch (error) { fail(error); }
    const token = ownerToken, release = releaseLock; releaseLock = null;
    stop(why);
    releaseTask = queue.then(() => fence((owner, put) => { if (owner?.token === token) put(null); }))
      .catch(error => { if (reason === why) fail(error); })
      .finally(() => { release?.(); releaseTask = null; });
    return releaseTask;
  }
  function receive(message) {
    if (!active || !object(message) || message.version !== 1 || message.from === id || typeof message.from !== 'string' || typeof message.request !== 'string') return;
    if (!Number.isFinite(message.until) || message.until <= now() || message.until > now() + waitMs + 1000) return;
    void pause('other-tab');
  }
  function signal() {
    const message = {version: 1, from: id, request: id + ':' + now(), until: now() + waitMs};
    try { channel?.postMessage(message); } catch {}
    try { storage?.setItem(SIGNAL_KEY, JSON.stringify(message)); } catch {}
  }
  async function claim(explicit, token) {
    const ticket = id + ':' + (++generation);
    const result = await fence((owner, put) => {
      if (disposed || token.cancelled) return null;
      // Native exclusivity proves a previous native owner has gone. Fallback owners
      // are never expired or stolen automatically, including after background throttle.
      if (owner && !explicit && !(native && owner.backend === 'web-locks')) return null;
      const record = read();
      put({token: ticket, backend: native ? 'web-locks' : 'indexeddb'});
      // Protected format migration never changes/deletes the old keys. Old builds
      // cannot overwrite this bundle; their later legacy-only progress is not merged.
      if (record.raw === null) {
        record.revision = 1;
        record.raw = JSON.stringify({version: 1, revision: 1, data: record.data});
        storage.setItem(SAVE_KEY, record.raw);
      }
      return record;
    });
    if (!result) { reason = 'other-tab'; try { adopt(read()); } catch (error) { fail(error); } return false; }
    adopt(result); ownerToken = ticket;
    if (disposed || token.cancelled) {
      await fence((owner, put) => { if (owner?.token === ticket) put(null); }); return false;
    }
    active = true; reason = 'active';
    if (explicit) hooks.onAcquire?.(copy(snapshot));
    return true;
  }
  async function acquire(explicit = false) {
    if (disposed || active || pending) return copy(snapshot);
    const token = {cancelled: false, controller: native ? new AbortController() : null};
    pending = token; reason = explicit ? 'waiting' : 'starting'; notify();
    let finish;
    const attempt = new Promise(resolve => { finish = () => { if (pending === token) pending = false; notify(); resolve(copy(snapshot)); }; });
    if (!native) {
      try {
        if (explicit) {
          signal();
          await new Promise(resolve => later(resolve, graceMs));
        }
        // After a cooperative grace period, a deliberate takeover fences a crashed
        // or frozen old owner out atomically. No timer can seize ownership by itself.
        await claim(explicit, token);
      } catch (error) { fail(error); }
      finish(); return attempt;
    }
    const timer = later(() => { token.cancelled = true; token.controller.abort(); stop('unresponsive'); finish(); }, waitMs);
    try {
      const operation = locks.request(SAVE_LOCK, explicit ? {signal: token.controller.signal} : {ifAvailable: true}, async lock => {
        if (!lock) {
          reason = 'other-tab'; try { adopt(read()); } catch (error) { fail(error); }
          cancel(timer); finish(); return;
        }
        const held = new Promise(resolve => { releaseLock = resolve; });
        try {
          if (!await claim(explicit, token)) { releaseLock?.(); releaseLock = null; }
          cancel(timer); finish();
          if (active) await held;
        } catch (error) { fail(error); cancel(timer); finish(); }
      });
      Promise.resolve(operation).catch(error => {
        if (error?.name === 'AbortError') stop('unresponsive'); else fail(error);
        cancel(timer); finish();
      });
    } catch (error) { fail(error); cancel(timer); finish(); }
    if (explicit) signal();
    return attempt;
  }
  return {
    start: () => acquire(false), playHere: () => acquire(true), write, pause, verify, status,
    setHooks(value) { hooks = value || {}; notify(); },
    dispose() { const done = pause('closed'); disposed = true; channel?.close(); win?.removeEventListener('storage', storageListener); return done; },
    get active() { return active; },
  };
}
