/** Round 2 end-of-shift layout: stars, then three big choices (Next shift · Decorate · Shop).
 * Pure presentation: it only re-parents existing result nodes (all IDs kept) and adds a
 * star row, a Shop tile and a Shop page. No storage, economy or save access. */
export function starsFor({ completed = 0, goal = 1, won = false, missed = 0 } = {}) {
  if (won) return missed > 0 ? 2 : 3;
  return goal > 0 && completed / goal >= .5 ? 1 : 0;
}
export function installResultScreen({ document, root, celebrate = null, reducedMotion = () => false, sound = () => {}, bank = () => 0 }) {
  const card = root.querySelector('.result-card'), $ = id => document.getElementById(id);
  const make = (tag, cls, html = '') => { const el = document.createElement(tag); if (cls) el.className = cls; if (html) el.innerHTML = html; return el; };
  const actions = card.querySelector('.result-actions');
  const stars = make('div', 'result-stars'); stars.id = 'result-stars'; stars.setAttribute('role', 'img');
  stars.innerHTML = '<span>★</span><span>★</span><span>★</span>';
  const row = make('div', 'result-summary-row');
  const big = make('div', 'result-big');
  const tile = (button, icon, cls) => { const t = make('div', 'result-tile ' + cls); t.append(make('span', 'tile-icon', icon), button, make('small', 'tile-note')); return t; };
  const shop = make('button', 'secondary result-shop'); shop.id = 'result-shop'; shop.type = 'button'; shop.textContent = 'Shop';
  const page = make('div', 'result-shop-page'); page.id = 'result-shop-page';
  const head = make('div', 'result-shop-head');
  const back = make('button', 'secondary result-shop-back', '<span aria-hidden="true">←</span> Back'); back.id = 'result-shop-back'; back.type = 'button';
  const retryTile = tile($('retry'), '☀️', 'tile-next'), decorTile = tile($('inside-result'), '🛋️', 'tile-decor'), shopTile = tile(shop, '🛍️', 'tile-shop');
  // Order: title, note, stars, hearts+money, door coins, reward panels, big choices, small actions; shop page last.
  const title = $('result-title'), note = $('first-stay-note');
  (note || title).after(stars);
  stars.after(row); const mini = make('strong', 'result-bank-mini'); row.append($('result-hearts'), $('result-money'), mini);
  const collect = $('collect-door-coins'); if (collect) row.after(collect);
  // Anything else that sits between money and the shop (reward panels) stays on the summary page.
  head.append(back, $('hotel-bank'));
  page.append(head, $('shop-tabs'), $('upgrade'));
  const modes = card.querySelector('[data-mode-group=result]'); if (modes) page.append(modes);
  actions.before(big); big.append(retryTile, decorTile, shopTile);
  actions.classList.add('result-small');
  card.append(page);
  for (const extra of [...card.children]) if (extra.tagName === 'BUTTON' && extra.parentElement === card) actions.append(extra); // Main menu
  const setPage = (open, focus = true) => { root.classList.toggle('shop-open', open); page.hidden = !open; if (focus) (open ? back : shop).focus?.({ preventScroll: true }); if (card.scrollTop) card.scrollTop = 0; };
  shop.onclick = () => { sound('tap'); setPage(true); };
  back.onclick = () => { sound('tap'); setPage(false); };
  page.hidden = true;
  let shown = 0, timers = [];
  const animate = () => {
    timers.forEach(clearTimeout); timers = [];
    [...stars.children].forEach((s, i) => {
      s.classList.remove('lit', 'pop');
      if (i >= shown) return;
      const light = () => { s.classList.add('lit'); if (!reducedMotion()) { s.classList.add('pop'); const r = s.getBoundingClientRect(); celebrate?.sparkle?.(r.left + r.width / 2, r.top + r.height / 2, 6); } };
      if (reducedMotion()) light(); else timers.push(setTimeout(light, 260 + i * 260));
    });
  };
  new (document.defaultView.MutationObserver)(() => { if (!root.hidden) animate(); }).observe(root, { attributes: true, attributeFilter: ['hidden'] });
  function sync({ hint = null } = {}) {
    const hintShop = hint === 'open-build' || hint === 'upgrade';
    const inside = $('inside-result'), decorNote = decorTile.querySelector('.tile-note');
    decorTile.classList.toggle('locked', !!inside.disabled);
    decorNote.textContent = inside.disabled ? (/^(🔨|⚠)/u.test(inside.title) ? inside.title : '🔒 Not now') : '';
    shopTile.querySelector('.tile-note').textContent = hintShop ? (hint === 'upgrade' ? '🛍️ Shop here!' : '🔨 Build here!') : shopSubtitle([...($('shop-tabs')?.querySelectorAll('[data-shop]') || [])].map(b => b.dataset.shop));
    shopTile.classList.toggle('hint', hintShop); mini.textContent = '🪙 ' + bank(); mini.setAttribute('aria-label', bank() + ' coins saved');
    decorTile.hidden = inside.hidden;
  }
  function show(result) {
    shown = starsFor(result); stars.dataset.stars = String(shown);
    stars.setAttribute('aria-label', shown + ' of 3 stars');
    setPage(false, false); if (!root.hidden) animate();
  }
  return { show, sync, setPage, starsFor };
}

// Shop tile subtitle names only the shop tabs that are actually open right now.
const SHOP_WORDS = { rooms: 'Rooms', team: 'helpers', visits: 'visits', cuisines: 'menu' };
export function shopSubtitle(tabs = []) {
  const words = tabs.map(t => SHOP_WORDS[t]).filter(Boolean);
  if (!words.length) return 'Rooms';
  if (words.length === 1) return words[0];
  const text = words.slice(0, -1).join(', ') + ' & ' + words.at(-1);
  return text[0].toUpperCase() + text.slice(1);
}
