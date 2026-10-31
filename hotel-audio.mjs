/** Locally bundled original/CC0 music + tactile hotel foley. No audio starts before unlock() from a user gesture. */
import { floorOf, stairAt } from './rush-floors.mjs';
export const HOTEL_DEFAULT_MUSIC_TRACK = 'lobby-bossa';
export const HOTEL_MUSIC_TRACKS = Object.freeze([
  Object.freeze({id:'jrpg-piano',title:'Quiet piano',artist:'Joth',license:'CC0 1.0',source:'https://opengameart.org/content/jrpg-piano',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',loopEndSeconds:1094897/44100,url:new URL('./assets/audio/jrpg-piano.ogg',import.meta.url).href,fallbackUrl:new URL('./assets/audio/jrpg-piano.m4a',import.meta.url).href,mixGain:1}),
  Object.freeze({id:'lobby-bossa',title:'A Little Room for Sunshine',artist:'Original hotel score',license:'Original',loopEndSeconds:798792/22050,url:new URL('./assets/audio/lobby-bossa.ogg',import.meta.url).href,fallbackUrl:new URL('./assets/audio/lobby-bossa.m4a',import.meta.url).href,mixGain:1}),
  Object.freeze({id:'banana-track',title:'Banana Track',artist:'skrjablin',license:'CC0 1.0',source:'https://opengameart.org/content/banana-track',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',url:new URL('./assets/audio/banana-track.ogg',import.meta.url).href,mixGain:.65}),
]);
// Backwards-compatible default export: the original cue remains the default.
export const HOTEL_MUSIC_URL = HOTEL_MUSIC_TRACKS.find(t=>t.id===HOTEL_DEFAULT_MUSIC_TRACK).url;
const musicTrackById = id => HOTEL_MUSIC_TRACKS.find(track => track.id === id);
export const HOTEL_AUDIO_EVENTS = Object.freeze(['tap','reception','step','stair','door','cloth','laundry','scrub','bed','tray','happy','coin','error','repair','success','strum','applause','fanfare']);
const clamp = (v, fallback = 0) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
const durations = {tap:.09,reception:1.35,step:.13,stair:.16,door:.48,cloth:.42,laundry:.8,scrub:.55,bed:.62,tray:.54,happy:.74,coin:.55,error:.28,repair:.4,success:1.1,strum:.9,applause:.65,fanfare:1.6};
const eventMap = { arrival:'reception', checkout:'coin', service:'happy', towel:'cloth', meal:'tray', repaired:'repair', cleaned:'bed', laundry:'cloth', washing:'laundry', 'wash-ready':'reception', 'food-ready':'tray', folded:'cloth', missed:'error', thief:'reception', 'theft-warning':'error', theft:'error', shooed:'happy' };
const cooldowns = { step:.14, stair:.16, reception:.5, happy:.25, coin:.22, cloth:.12, laundry:.7, scrub:.4, bed:.3, tray:.15, error:.3 };

/** Deterministic original foley, rendered once per kind/variation into short cached buffers. */
export function synthHotelEffect(kind, sampleRate = 22050, variation = 0) {
  const duration = durations[kind];
  if (!duration) return null;
  const data = new Float32Array(Math.ceil(duration * sampleRate));
  let seed = 19331 + variation * 911, low = 0, smooth = 0;
  const tau = Math.PI * 2, pitch = 1 + (variation - 1) * .018;
  const ring = (t, hz, decay = 12) => t < 0 ? 0 : Math.sin(tau * hz * pitch * t) * Math.exp(-t * decay) * Math.min(1, t * 900);
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 4294967296 * 2 - 1;
    low = low * .77 + noise * .23; smooth = smooth * .96 + noise * .04;
    const air = low - smooth;
    const swell = Math.sin(Math.PI * t / duration) ** 2;
    let x = 0;
    switch (kind) {
      case 'tap': x = .18 * ring(t, 480, 64) + air * .15 * Math.exp(-t * 90); break;
      case 'step': x = .15 * ring(t, 77, 39) + low * .3 * Math.exp(-t * 40); break;
      case 'stair': x = .15 * ring(t, 126, 32) + .05 * ring(t, 247, 54) + low * .23 * Math.exp(-t * 42); break;
      case 'reception': x = .18 * ring(t, 1046.5, 4.1) + .048 * ring(t, 1678, 6.2) + .02 * ring(t, 2520, 10); break;
      case 'door': x = .075 * ring(t, 530, 60) + .18 * ring(t - .15, 86, 26) + low * .19 * Math.exp(-Math.abs(t - .15) * 28); break;
      case 'cloth': x = .31 * low * swell * (.75 + .25 * Math.sin(tau * 8 * t)); break;
      case 'laundry': x = .2 * low * swell * (.6 + .4 * Math.sin(tau * 7 * t)) + .025 * Math.sin(tau * 157 * t) * swell; break;
      case 'scrub': x = .36 * air * swell * (.5 + .5 * Math.sin(tau * 6 * t)); break;
      case 'bed': x = .35 * low * swell + .035 * ring(t - .28, 130, 18); break;
      case 'strum': x = [261.63,329.63,392,523.25].reduce((v,f,j)=>v+.075*ring(t-j*.025,f,6)+.018*ring(t-j*.025,f*2,13)+.007*ring(t-j*.025,f*3,20),0); break;
      case 'applause': x = air*.24*swell*(.6+.4*Math.sin(tau*17*t)**2)+low*.12*swell*(.5+.5*Math.sin(tau*29*t)**2); break;
      case 'tray': x = .1 * ring(t, 810, 20) + .045 * ring(t, 1385, 28) + .08 * ring(t - .15, 1100, 21); break;
      case 'happy':
      case 'success': {
        const notes = kind === 'success' ? [523.25,659.25,783.99,1046.5] : [659.25,783.99,1046.5];
        x = notes.reduce((v, f, j) => v + .11 * ring(t - j * .105, f, 8) + .018 * ring(t - j * .105, f * 2.002, 17), 0); break;
      }
      case 'fanfare': {
        // Short trumpet-ish rise (G C E G) into a warm held chord for shift-end and level-up moments.
        const steps = [[0,392],[.11,523.25],[.22,659.25],[.33,783.99]], chord = [523.25,659.25,783.99,1046.5];
        x = steps.reduce((v,[at,f]) => v + .085*ring(t-at,f,11) + .03*ring(t-at,f*2.003,16) + .015*ring(t-at,f*3.01,22), 0);
        if (t > .46) x += chord.reduce((v,f) => v + .045*ring(t-.46,f,3.2) + .012*ring(t-.46,f*2.002,6), 0);
        break;
      }
      case 'coin': x = .11 * ring(t, 1318.5, 15) + .06 * ring(t, 2110, 25) + .09 * ring(t - .12, 1568, 15); break;
      case 'error': x = .12 * ring(t, 293.7, 22) + .1 * ring(t - .1, 261.6, 24); break;
      case 'repair': x = .13 * ring(t, 410, 48) + .09 * ring(t - .16, 610, 29) + low * .1 * Math.exp(-t * 80); break;
    }
    data[i] = x * Math.max(0, Math.min(1, t / .002, (duration - t) / .025));
  }
  return data;
}

/**
 * Options musicVolume/effectsVolume are 0..1. Persistence belongs to the caller.
 * Optional musicTrack is a HOTEL_MUSIC_TRACKS id; the original score is the default.
 * Test injection: contextFactory, fetch, document. Production needs no options other than volumes.
 */
export function createHotelAudio(options = {}) {
  const doc = options.document ?? globalThis.document;
  const getContext = options.contextFactory ?? (() => { const C = globalThis.AudioContext || globalThis.webkitAudioContext; return C ? new C() : null; });
  const fetchFile = options.fetch ?? globalThis.fetch?.bind(globalThis);
  let musicVolume = clamp(options.musicVolume ?? .55), effectsVolume = clamp(options.effectsVolume ?? .65);
  let weatherVolume = clamp(options.weatherVolume ?? 0), rainIntensity = 0;
  let weatherGain = null, weatherSource = null;
  let ctx = null, master = null, musicGain = null, effectsGain = null, ambienceGain = null;
  let musicSource = null, ambienceSource = null, musicBuffer = null, loadPromise = null, abort = null;
  let musicTrack = musicTrackById(options.musicTrack)?.id ?? HOTEL_DEFAULT_MUSIC_TRACK, playingMusicTrack = null, loadVersion = 0;
  const musicBuffers = new Map();
  let unlocked = false, destroyed = false, paused = false, active = true, hidden = !!doc?.hidden;
  let priorState = null, lastEvent = 0, lastTime = -1, lastMusicError = null, variation = 0;
  let transition = Promise.resolve(), lastDesired = null;
  const buffers = new Map(), sources = new Set(), throttle = new Map(), actors = new Map();
  const playable = () => unlocked && !destroyed && !paused && active && !hidden;
  function gain(node, value, seconds = .06) {
    if (!node || !ctx || destroyed) return;
    const p = node.gain, now = ctx.currentTime;
    p.cancelScheduledValues(now);
    p.setTargetAtTime(value, now, seconds);
  }
  function levels() {
    gain(master, playable() ? 1 : 0, .02);
    gain(musicGain, musicVolume * .58 * (musicTrackById(playingMusicTrack)?.mixGain ?? 1));
    gain(effectsGain, effectsVolume * .84, .018);
    gain(weatherGain, weatherVolume * rainIntensity * .16, .8);
    gain(ambienceGain, effectsVolume ? .035 : 0, .15);
  }
  function track(source) {
    sources.add(source);
    source.onended = () => { sources.delete(source); try { source.disconnect(); } catch {} };
    return source;
  }
  function stopEffects() {
    for (const source of [...sources]) { try { source.stop(); } catch {} try { source.disconnect(); } catch {} }
    sources.clear();
  }
  function stopMusic() {
    if (musicSource) { try { musicSource.stop(); } catch {} try { musicSource.disconnect(); } catch {} }
    musicSource = null;
  }
  function startMusic() {
    if (!ctx || !musicBuffer || musicSource || destroyed) return;
    musicSource = ctx.createBufferSource(); musicSource.buffer = musicBuffer;
    musicSource.loop = true; musicSource.loopStart = 0;
    // AAC decoders can expose encoder tail padding; preserve the original musical phrase length.
    musicSource.loopEnd = Math.min(musicBuffer.duration, musicTrackById(playingMusicTrack)?.loopEndSeconds ?? musicBuffer.duration);
    musicSource.connect(musicGain); musicSource.start();
  }
  function makeAmbience() {
    if (!ctx || ambienceSource) return;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), data = buffer.getChannelData(0);
    let seed = 193, low = 0;
    for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed,1664525)+1013904223)>>>0; low = .975 * low + .025 * (seed / 4294967296 * 2 - 1); data[i] = low; }
    // Short equal-power wrap prevents a room-tone click at the loop seam.
    const fade = Math.min(800, data.length / 4);
    for (let i = 0; i < fade; i++) { const f = i / fade; data[i] *= f; data[data.length - 1 - i] *= f; }
    ambienceSource = ctx.createBufferSource(); ambienceSource.buffer = buffer; ambienceSource.loop = true;
    ambienceSource.connect(ambienceGain); ambienceSource.start();
  }
  function makeWeather() {
    if (!ctx || weatherSource || !weatherVolume || !rainIntensity) return;
    const length=ctx.sampleRate*6, buffer=ctx.createBuffer(1,length,ctx.sampleRate),data=buffer.getChannelData(0);
    let seed=721,low=0;
    for(let i=0;i<length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;low=low*.87+(seed/4294967296*2-1)*.13;data[i]=low;}
    // Crossfade the short noise seam; no tonal oscillator or thunder transients.
    const fade=Math.floor(ctx.sampleRate*.05);for(let i=0;i<fade;i++){const a=i/fade;data[i]=data[i]*a+data[length-fade+i]*(1-a);}
    weatherSource=ctx.createBufferSource();weatherSource.buffer=buffer;weatherSource.loop=true;weatherSource.connect(weatherGain);weatherSource.start();
  }
  function syncTransport() {
    if (!ctx || destroyed) return;
    levels();
    const desired = playable();
    if (!desired) stopEffects();
    // Serialize asynchronous suspend/resume calls. Rapid toggles never leave a hidden tab running.
    if (desired === lastDesired) return;
    lastDesired = desired;
    transition = transition.catch(() => {}).then(async () => {
      if (!ctx || destroyed) return;
      const shouldPlay = playable();
      if (shouldPlay && !['running','closed'].includes(ctx.state)) await ctx.resume();
      else if (!shouldPlay && ctx.state === 'running') await ctx.suspend();
      if (!destroyed) levels();
    }).catch(() => {});
  }
  async function loadMusic() {
    if (destroyed || !ctx) return false;
    if (musicBuffer && playingMusicTrack === musicTrack) return true;
    if (loadPromise) return loadPromise;
    const context = ctx, requestedTrack = musicTrack, version = ++loadVersion;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    abort = controller;
    const current = () => !destroyed && version === loadVersion && requestedTrack === musicTrack;
    async function decodeTrack(id) {
      if (musicBuffers.has(id)) return musicBuffers.get(id);
      if (!fetchFile) throw Error('Audio fetch is unavailable');
      const spec = musicTrackById(id);
      let lastError;
      for (const url of [spec.url, spec.fallbackUrl].filter(Boolean)) {
        try {
          const response = await fetchFile(url, controller ? {signal:controller.signal} : {});
          if (!response.ok) throw Error(`Music file could not load (${response.status})`);
          const data = await response.arrayBuffer();
          if (!current()) return null;
          const decoded = await context.decodeAudioData(data);
          if (!current()) return null;
          musicBuffers.set(id, decoded); return decoded;
        } catch (error) { if (!current()) return null; lastError = error; }
      }
      throw lastError;
    }
    function useBuffer(buffer, id) {
      if (!buffer || !current()) return false;
      // Always stop/disconnect the old loop before starting its replacement.
      stopMusic(); musicBuffer = buffer; playingMusicTrack = id;
      startMusic(); levels(); return true;
    }
    // Begin in a microtask so synchronous fetch failures cannot leave a stale loadPromise.
    const request = Promise.resolve().then(async () => {
      try {
        const decoded = await decodeTrack(requestedTrack);
        if (!current()) return false;
        lastMusicError = null; return useBuffer(decoded, requestedTrack);
      } catch (error) {
        if (!current()) return false;
        lastMusicError = String(error?.message || error);
        // A missing or unsupported optional recording must not silence all music.
        if (requestedTrack !== HOTEL_DEFAULT_MUSIC_TRACK) {
          try { return useBuffer(await decodeTrack(HOTEL_DEFAULT_MUSIC_TRACK), HOTEL_DEFAULT_MUSIC_TRACK); }
          catch (fallbackError) { if (current()) lastMusicError += `; original fallback: ${fallbackError?.message || fallbackError}`; }
        }
        return false;
      }
    }).finally(() => { if (version === loadVersion) { loadPromise = null; abort = null; } });
    loadPromise = request;
    return request;
  }
  function setup() {
    if (ctx || destroyed) return !!ctx;
    try {
      ctx = getContext(); if (!ctx) return false;
      master = ctx.createGain(); musicGain = ctx.createGain(); effectsGain = ctx.createGain(); ambienceGain = ctx.createGain(); weatherGain = ctx.createGain();
      master.gain.value = 0; musicGain.gain.value = 0; effectsGain.gain.value = 0; ambienceGain.gain.value = 0; weatherGain.gain.value = 0;
      weatherGain.connect(master); musicGain.connect(master); effectsGain.connect(master); ambienceGain.connect(effectsGain); if(ctx.createDynamicsCompressor){const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-4;limiter.knee.value=6;limiter.ratio.value=8;limiter.attack.value=.003;limiter.release.value=.12;master.connect(limiter);limiter.connect(ctx.destination);}else master.connect(ctx.destination);
      makeAmbience(); makeWeather(); return true;
    } catch { ctx = null; return false; }
  }
  function event(kind = 'tap', detail = {}) {
    if (!playable() || !ctx || ctx.state !== 'running' || effectsVolume <= 0 || !durations[kind]) return false;
    const now = ctx.currentTime, gap = cooldowns[kind] ?? .06;
    if (now - (throttle.get(kind) ?? -Infinity) < gap || sources.size >= 18) return false;
    throttle.set(kind, now);
    const variant = (variation++ % 3), key = kind + ':' + variant;
    if (!buffers.has(key)) {
      const data = synthHotelEffect(kind, ctx.sampleRate, variant), buffer = ctx.createBuffer(1, data.length, ctx.sampleRate);
      buffer.getChannelData(0).set(data); buffers.set(key, buffer);
    }
    const source = track(ctx.createBufferSource()), level = ctx.createGain(); source.buffer = buffers.get(key);
    level.gain.value = clamp(detail.volume ?? 1); source.connect(level);
    let pan = null;
    if (ctx.createStereoPanner) { pan = ctx.createStereoPanner(); pan.pan.value = Math.max(-.7,Math.min(.7,detail.pan ?? 0)); level.connect(pan); pan.connect(effectsGain); }
    else level.connect(effectsGain);
    source.onended = () => { sources.delete(source); try {source.disconnect();level.disconnect();pan?.disconnect();} catch {} };
    source.start(); return true;
  }
  function visibility() { hidden = !!doc?.hidden; syncTransport(); }
  doc?.addEventListener?.('visibilitychange', visibility);
  const controller = {
    /** Call directly within pointerdown/keydown/click. Resolves false if Web Audio is unsupported. */
    async unlock() {
      if (destroyed || !setup()) return false;
      unlocked = true;
      // Direct resume within the gesture, before any awaited work, for iOS/WebKit autoplay policy.
      let resumed;
      try { resumed = playable() && !['running','closed'].includes(ctx.state) ? ctx.resume() : Promise.resolve(); }
      catch { return false; }
      syncTransport();
      if (musicVolume > 0 && playingMusicTrack !== musicTrack) void loadMusic();
      try { await resumed; if (!destroyed && !playable() && ctx.state === 'running') await ctx.suspend(); return !destroyed; }
      catch { return false; }
    },
    setMusicVolume(value) { if (destroyed) return; musicVolume = clamp(value); levels(); if (unlocked && musicVolume > 0 && playingMusicTrack !== musicTrack) void loadMusic(); },
    /** Select a bundled track without unlocking audio. Invalid IDs leave the selection unchanged. */
    setMusicTrack(id) {
      if (destroyed || !musicTrackById(id)) return false;
      if (id !== musicTrack) {
        ++loadVersion; abort?.abort(); abort = null; loadPromise = null;
        stopMusic(); musicBuffer = null; playingMusicTrack = null; lastMusicError = null; musicTrack = id;
      }
      if (unlocked && musicVolume > 0) void loadMusic();
      return true;
    },
    setEffectsVolume(value) { if (destroyed) return; effectsVolume = clamp(value); if (!effectsVolume) stopEffects(); levels(); },
    setWeatherVolume(value) { if(destroyed)return;weatherVolume=clamp(value);makeWeather();levels(); },
    setWeather(value) { if(destroyed)return;const next=clamp(value);if(next===rainIntensity)return;rainIntensity=next;makeWeather();levels(); },
    setPaused(value) { if (destroyed) return; paused = !!value; syncTransport(); },
    event,
    /** Incremental engine events + actor foley; first/resumed snapshots never replay historical events. */
    update(state, { active: enabled = true, floor = 0 } = {}) {
      if (destroyed) return;
      active = !!enabled; syncTransport();
      if (!state) return;
      const fresh = priorState !== state || (state.time ?? 0) < lastTime || (state.eventId ?? 0) < lastEvent;
      if (fresh) { lastEvent = state.eventId ?? Math.max(0,...(state.events || []).map(e=>e.id || 0)); actors.clear(); throttle.clear(); }
      priorState = state; lastTime = state.time ?? 0;
      for (const e of state.events || []) {
        if ((e.id ?? 0) <= lastEvent) continue;
        lastEvent = e.id;
        if (!fresh && playable() && eventMap[e.type]) event(eventMap[e.type], {pan:((e.x ?? 600)-600)/1000,volume:Number.isFinite(e.y) && floorOf(e)!==floor ? .45 : 1});
      }
      for (const a of Object.values(state.actors || {})) {
        if (!a || !a.id) continue;
        const old = actors.get(a.id), phase = a.job?.phase, job = a.job?.type;
        const inView = a.visible !== false && (floorOf(a) === floor || !!stairAt(a));
        if (!fresh && playable() && old && inView) {
          const pan = ((a.x ?? 600)-600)/1000;
          if (a.moving && Math.floor((a.walkTime || 0)/.22) !== Math.floor(old.walkTime/.22)) event(stairAt(a) ? 'stair' : 'step', {pan,volume:a.id.startsWith('guest')?.48:.68});
          if (phase !== old.phase) {
            if (phase === 'register') event('reception',{pan});
            else if (phase === 'welcome') event('door',{pan});
            else if (phase === 'tidy') event('scrub',{pan});
            else if (phase === 'fix') event('repair',{pan});
            else if (phase === 'pickup') event(job === 'deliverMeal' ? 'tray' : 'cloth',{pan});
          }
        }
        actors.set(a.id,{phase,walkTime:a.walkTime || 0});
      }
    },
    /** Read-only diagnostics for QA; no persistent settings and no network telemetry. */
    getStatus() { return {unlocked,paused,active,hidden,destroyed,musicVolume,effectsVolume,weatherVolume,rainIntensity,weatherSources:weatherSource?1:0,musicTrack,playingMusicTrack,musicFallback:!!playingMusicTrack&&playingMusicTrack!==musicTrack,musicLoading:!!loadPromise,musicReady:!!musicBuffer,musicError:lastMusicError,contextState:ctx?.state ?? 'locked',musicSources:musicSource?1:0,effectSources:sources.size}; },
    destroy() {
      if (destroyed) return;
      destroyed = true; ++loadVersion; abort?.abort(); loadPromise = null; doc?.removeEventListener?.('visibilitychange',visibility); stopEffects();
      for (const source of [musicSource,ambienceSource,weatherSource]) {try {source?.stop();source?.disconnect();} catch {}}
      musicSource = ambienceSource = weatherSource = null; musicBuffer = null; playingMusicTrack = null; musicBuffers.clear(); buffers.clear(); actors.clear(); throttle.clear();
      try { const closing = ctx?.close(); closing?.catch?.(()=>{}); } catch {}
    },
  };
  return controller;
}
