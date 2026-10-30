// The trial meta layer around the saga map: a bottom tab bar and four side
// screens (shop, pachinko, dragons, events). It lives outside #game because the
// game is inert while the map is open, and it never touches the map itself.
import { META_KEY, normalizeMeta, welcome, levelReward, applyLevelReward, SHOP, buy, canBuy, startDrop, slotPrize, applyPrize, recoverDrop,
  hatch, DRAGONS, RARITIES, collected, giftReady, claimGift, giftDay, GIFT_LADDER, PITY_DROPS, isLuckyDrop, changePachinkoLayout, PACHINKO_LAYOUT_PRICE } from './meta-rules.js';
import { createPachinko } from './meta-pachinko.js';

const TABS = [
  { id: 'shop', label: 'Shop' },
  { id: 'pachinko', label: 'Pachinkat' },
  { id: 'map', label: 'Map' },
  { id: 'dragons', label: 'Album' },
  { id: 'events', label: 'Rewards' },
];
const ORDER = TABS.map(tab => tab.id);
const ONE_TIME_WALLET_GRANT_KEY = 'meow-munchies-wallet-grant-exact-1000-v2';
const ONE_TIME_WALLET_GRANT = 1000;

export function createMetaLayer({ reduced, sound, buzz, speak, pauseMap, resumeMap, openSettings, grantLife, livesFull, getLives, grantHint, grantUndo, onWalletChange }) {
  let meta = load(), enabled = false, mapVisible = false, current = 'map', hatching = false;
  const root = document.createElement('div');
  root.id = 'meta-shell'; root.className = 'meta-shell'; root.hidden = true;
  root.innerHTML = `
    <div class="meta-resource-bar" aria-label="Resources"></div>
    <div class="meta-stage">
      ${ORDER.filter(id => id !== 'map').map(id => `<section class="meta-screen" data-screen="${id}" aria-label="${TABS.find(t => t.id === id).label}"></section>`).join('')}
    </div>
    <nav class="meta-tabs" aria-label="Meow Munchies navigation">${TABS.map(tab => `<button type="button" class="meta-tab${tab.id === 'map' ? ' is-home' : ''}" data-tab="${tab.id}" aria-label="${tab.label}"><span class="meta-tab-icon" aria-hidden="true"></span><span class="meta-tab-label">${tab.label}</span><span class="meta-badge" hidden></span></button>`).join('')}</nav>
    <div class="meta-hatch" hidden role="dialog" aria-modal="true" aria-labelledby="meta-hatch-title">
      <div class="meta-hatch-card"><div class="meta-hatch-rays" aria-hidden="true"></div><div class="meta-egg" aria-hidden="true"><span class="meta-box-ear left"></span><span class="meta-box-ear right"></span><span class="meta-box-face"><i></i><i></i><b></b></span><span class="meta-box-ribbon"></span><span class="meta-box-paw">♥</span></div><img class="meta-hatch-dragon" alt="" decoding="async" width="170" height="190" hidden>
        <span class="meta-hatch-rarity"></span><h2 id="meta-hatch-title">A Surprise Box!</h2><p class="meta-hatch-copy">A new café cat is waiting inside.</p>
        <button type="button" class="meta-primary meta-hatch-open">Open Box</button></div>
    </div>`;
  document.body.append(root);
  const screen = id => root.querySelector(`[data-screen="${id}"]`);
  const tabButton = id => root.querySelector(`[data-tab="${id}"]`);

  function load() {
    try {
      let saved = recoverDrop(normalizeMeta(JSON.parse(localStorage.getItem(META_KEY) || 'null')));
      if (localStorage.getItem(ONE_TIME_WALLET_GRANT_KEY) !== 'claimed') {
        saved = { ...saved, balls: ONE_TIME_WALLET_GRANT, golden: ONE_TIME_WALLET_GRANT };
        // Persist the balance before the marker so an interrupted write can never
        // consume the one-time grant without actually crediting the wallet.
        localStorage.setItem(META_KEY, JSON.stringify(saved));
        localStorage.setItem(ONE_TIME_WALLET_GRANT_KEY, 'claimed');
      }
      return saved;
    } catch { return normalizeMeta(null); }
  }
  function save() { try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch {} }
  function commit(next) { meta = next; save(); refresh(); }

  const wallet = () => `<div class="meta-wallet"><span class="meta-coin lives" aria-label="${getLives()} Lives"><i aria-hidden="true"></i><b>${getLives()}</b></span><span class="meta-coin balls" aria-label="${meta.balls} Coins"><i aria-hidden="true"></i><b>${meta.balls}</b></span><span class="meta-coin golden" aria-label="${meta.golden} Diamonds"><i aria-hidden="true"></i><b>${meta.golden}</b></span></div><button type="button" class="meta-settings" aria-label="Open settings"><span aria-hidden="true">⚙</span></button>`;

  // Pachinko ---------------------------------------------------------------
  screen('pachinko').innerHTML = `<header class="meta-head"><h2>Pachinkat</h2></header>
    <p class="meta-sub meta-pachinkat-copy" id="meta-pachinko-hint"></p>
    <div class="meta-board"><canvas class="meta-pachinko" aria-label="Pachinkat. Drag to aim and release to drop."></canvas><div class="meta-prize" hidden></div></div>
    <div class="meta-actions"><button type="button" class="meta-primary meta-layout-button" data-action="layout"><i aria-hidden="true"></i><b>${PACHINKO_LAYOUT_PRICE}</b><span>Shuffle</span></button><button type="button" class="meta-primary meta-play-button" data-action="drop"><i aria-hidden="true"></i><span>Play</span></button></div>`;
  const prize = screen('pachinko').querySelector('.meta-prize');
  const pachinko = createPachinko(screen('pachinko').querySelector('canvas'), {
    reduced,
    onHit: hits => { sound('hit', hits - 1); if (hits % 4 === 0) buzz(4); },
    onLand: (slot, lucky, at, quiet) => {
      // Exactly one prize per spent golden ball; a progress reset mid-fall pays nothing.
      if (!meta.dropping) { armPachinko(); return; }
      const won = slotPrize(slot, lucky), before = meta.balls;
      commit(applyPrize(meta, won));
      armPachinko();
      // A ball finished off screen (tab changed, app hidden) is paid without the show.
      if (quiet) return;
      showPrize(won); sound(won.kind === 'egg' ? 'egg' : 'jackpot'); buzz(won.kind === 'egg' ? [12, 40, 18, 40, 24] : [8, 30, 8]);
      if (won.kind === 'balls') flyToWallet(at, won.amount, before);
      if (won.kind === 'egg') setTimeout(() => { if (current === 'pachinko') openHatch(); }, reduced() ? 300 : 900);
    },
  });
  pachinko.setLayout(meta.pachinkoLayout);
  // Prize balls fly from the slot to the wallet and the counter ticks up as they land.
  function flyToWallet(at, amount, from) {
    const canvas = screen('pachinko').querySelector('canvas'), chip = root.querySelector('.meta-resource-bar .meta-coin.balls'), count = chip?.querySelector('b');
    if (!chip || !count || reduced() || !canvas.animate) return;
    const origin = canvas.getBoundingClientRect(), target = chip.getBoundingClientRect(), dots = Math.min(amount, 12);
    let shown = from; count.textContent = String(from);
    for (let i = 0; i < dots; i++) {
      const dot = document.createElement('span'); dot.className = 'meta-fly'; root.append(dot);
      const x0 = origin.left + at.x + (Math.random() - .5) * 30, y0 = origin.top + at.y, x1 = target.left + 14, y1 = target.top + target.height / 2;
      const animation = dot.animate([
        { transform: `translate(${x0}px,${y0}px) scale(.6)`, opacity: 0 },
        { transform: `translate(${(x0 + x1) / 2 + (Math.random() - .5) * 120}px,${Math.min(y0, y1) - 60 - Math.random() * 80}px) scale(1.15)`, opacity: 1, offset: .45 },
        { transform: `translate(${x1}px,${y1}px) scale(.7)`, opacity: 1 },
      ], { duration: 620 + i * 45, delay: i * 55, easing: 'cubic-bezier(.3,.1,.3,1)' });
      animation.onfinish = () => {
        dot.remove();
        shown = i === dots - 1 ? meta.balls : Math.min(meta.balls, from + Math.round(amount * (i + 1) / dots));
        count.textContent = String(shown); chip.classList.remove('bump'); void chip.offsetWidth; chip.classList.add('bump');
        sound('tick', i);
      };
    }
  }
  function showPrize(won) {
    prize.textContent = won.kind === 'egg' ? 'Surprise Box!' : `+${won.amount} coins`;
    prize.className = 'meta-prize' + (won.kind === 'egg' ? ' is-egg' : '');
    prize.hidden = false; void prize.offsetWidth; prize.classList.add('play');
    speak(prize.textContent);
    clearTimeout(showPrize.timer); showPrize.timer = setTimeout(() => { prize.hidden = true; }, 1400);
  }
  function armPachinko() {
    if (meta.golden > 0 && !pachinko.isBusy()) pachinko.arm(isLuckyDrop(meta), () => {
      const started = startDrop(meta); if (!started) return false;
      commit(started.meta); sound('jump'); buzz(5); return true;
    });
    else pachinko.disarm();
    refresh();
  }
  screen('pachinko').querySelector('[data-action="drop"]').onclick = () => {
    if (meta.golden < 1) { go('shop'); return; }
    if (pachinko.isBusy()) return;
    if (!pachinko.isArmed()) armPachinko();
    pachinko.drop();
  };
  screen('pachinko').querySelector('[data-action="layout"]').onclick = () => {
    if (pachinko.isBusy()) return;
    const next = changePachinkoLayout(meta);
    if (!next) { sound('stoneBump'); buzz(4); speak(`You need ${PACHINKO_LAYOUT_PRICE} coins to change the board.`); return; }
    commit(next); pachinko.setLayout(meta.pachinkoLayout); sound('coin'); buzz([6,18,6]);
    speak(`Pachinkat board shuffled. ${PACHINKO_LAYOUT_PRICE} coins spent.`);
  };

  // Dragons ----------------------------------------------------------------
  function renderDragons() {
    const el = screen('dragons');
    el.innerHTML = `<header class="meta-head"><h2>Album</h2><span class="meta-count">${collected(meta)} of ${DRAGONS.length}</span></header>
      <div class="meta-eggs">${meta.eggs ? `<span>You have ${meta.eggs} unopened surprise ${meta.eggs === 1 ? 'box' : 'boxes'}.</span><button type="button" class="meta-primary" data-action="hatch">Open Box</button>` : '<span>Win surprise boxes in Pachinkat with Diamonds.</span>'}</div>
      <ul class="meta-album">${DRAGONS.map(dragon => {
        const owned = meta.dragons[dragon.id] || 0, fresh = meta.fresh.includes(dragon.id);
        return `<li class="meta-dragon r-${dragon.rarity}${owned ? '' : ' is-locked'}" data-cat="${dragon.id}"><div class="meta-dragon-art"><img src="${dragon.art}" alt="" loading="lazy" decoding="async" width="128" height="128"></div>
          <strong>${owned ? dragon.name : '???'}</strong><small>${RARITIES[dragon.rarity].label}${owned > 1 ? ` · x${owned}` : ''}</small>${fresh ? '<em>New!</em>' : ''}</li>`;
      }).join('')}</ul>
      <p class="meta-note">Open surprise boxes to meet new café cats and complete your Album.</p>`;
    el.querySelector('[data-action="hatch"]')?.addEventListener('click', openHatch);
  }

  // Shop -------------------------------------------------------------------
  function renderShop() {
    const el = screen('shop');
    el.innerHTML = `<header class="meta-head"><h2>Shop</h2></header>
      <p class="meta-sub">Earn coins and diamonds by playing levels.</p>
      <ul class="meta-shop">${SHOP.map(item => {
        const full = item.id === 'life' && livesFull();
        const icon = item.id === 'undo' ? '<svg viewBox="0 0 48 48"><path class="shop-undo-arrow" d="M13 20a14 14 0 1 1 3 16"/><path class="shop-undo-arrow" d="m13 11-1 10 10-1"/></svg>' : '';
        return `<li><span class="meta-item-icon i-${item.id}" aria-hidden="true">${icon}</span><div><strong>${item.title}</strong><small>${full ? 'Your lives are already full' : item.detail}</small></div>
          <button type="button" class="meta-price" data-buy="${item.id}" aria-label="Buy ${item.title} for ${item.price} coins" ${!canBuy(meta, item) || full ? 'disabled' : ''}><i aria-hidden="true"></i>${item.price}</button></li>`;
      }).join('')}</ul>`;
    for (const button of el.querySelectorAll('[data-buy]')) button.onclick = () => {
      const result = buy(meta, button.dataset.buy);
      if (!result.item) return;
      commit(result.meta);
      if (result.item.gives.life) grantLife();
      if (result.item.gives.hint) grantHint(result.item.gives.hint);
      if (result.item.gives.undo) grantUndo(result.item.gives.undo);
      sound('coin'); buzz(8); speak(`Purchased: ${result.item.title}.`);
      button.closest('li').classList.add('bought'); setTimeout(renderShop, 450);
    };
    refresh();
  }

  // Events -----------------------------------------------------------------
  function renderEvents() {
    const el = screen('events'), ready = giftReady(meta), today = giftDay(meta);
    el.classList.toggle('meta-events-reduced', reduced());
    const tile = (gift, index) => {
      const day = index + 1, done = day < today || (day === today && !ready), now = day === today && ready;
      return `<li class="meta-day${done ? ' is-done' : ''}${now ? ' is-today' : ''}${gift.golden ? ' is-big' : ''}" aria-label="Day ${day}: ${gift.balls} coins${gift.golden ? ` and ${gift.golden} Diamonds` : ''}"><small>Day ${day}</small>
        <span class="meta-day-prize" aria-hidden="true">${gift.golden ? '<i class="g"></i>' : '<i></i>'}</span><b>${gift.golden ? `${gift.balls} + ${gift.golden}` : gift.balls}</b>${done ? '<em aria-hidden="true">✓</em>' : ''}</li>`;
    };
    const gift = GIFT_LADDER[today - 1];
    el.innerHTML = `<header class="meta-events-hero"><img src="assets/meow-munchies/miso-delighted-v2.png" alt="" class="meta-hero-dragon">
        <img src="assets/world/region-01/fiesta/guirnalda-banderines.webp" alt="" class="meta-hero-flags"><div><span class="meta-tag">SEVEN-DAY CYCLE</span><h2>Daily Rewards</h2><p>Come back every day to collect a new reward!</p></div></header>
      <article class="meta-event meta-gift-card"><div class="meta-event-top"><span class="meta-tag">Today · Day ${today} of 7</span>
        <button type="button" class="meta-gift-box${ready ? ' is-ready' : ''}" data-action="gift" ${ready ? '' : 'disabled'} aria-label="${ready ? 'Claim today’s reward' : 'Today’s reward claimed'}"><span aria-hidden="true"></span></button></div>
        <ol class="meta-days">${GIFT_LADDER.map(tile).join('')}</ol>
        <p>${ready ? `Today: ${gift.balls} coins${gift.golden ? ` and ${gift.golden} Diamonds` : ''}. Tap the gift to claim it.` : today === GIFT_LADDER.length ? 'Claimed! A new seven-day cycle starts tomorrow.' : 'Claimed. Your next reward will be available tomorrow.'}</p></article>`;
    el.querySelector('[data-action="gift"]').onclick = event => {
      if (!giftReady(meta)) return;
      const box = event.currentTarget, day = giftDay(meta), prize = GIFT_LADDER[day - 1];
      commit(claimGift(meta));
      box.classList.add('is-opening'); sound('jackpot'); buzz([10, 30, 14]);
      speak(`Day ${day}: you claimed ${prize.balls} coins${prize.golden ? ` and ${prize.golden} Diamonds` : ''}.`);
      setTimeout(renderEvents, reduced() ? 0 : 700);
    };
    refresh();
  }

  // Hatching ---------------------------------------------------------------
  const hatchEl = root.querySelector('.meta-hatch'), openButton = hatchEl.querySelector('.meta-hatch-open');
  function openHatch() {
    if (!meta.eggs || hatching) return;
    hatching = true; hatchEl.hidden = false; hatchEl.className = 'meta-hatch';
    hatchEl.querySelector('.meta-hatch-dragon').hidden = true;
    hatchEl.querySelector('.meta-hatch-rarity').textContent = '';
    hatchEl.querySelector('h2').textContent = 'A Surprise Box!';
    hatchEl.querySelector('.meta-hatch-copy').textContent = 'A new café cat is waiting inside.';
    openButton.textContent = 'Open Box'; openButton.onclick = crack;
    hatchEl.querySelector('.meta-egg').onclick = crack;
    openButton.focus({ preventScroll: true });
  }
  function crack() {
    const result = hatch(meta, Math.random(), Math.random());
    if (!result) { closeHatch(); return; }
    // Settle the egg and dragon atomically before the reveal. A pachinko ball
    // already falling may pay another prize while this animation is running.
    commit(result.meta);
    hatchEl.querySelector('.meta-egg').onclick = null; openButton.onclick = null;
    hatchEl.classList.add('is-cracking'); sound('crack'); buzz([8, 30, 8]);
    setTimeout(() => {
      const { dragon } = result, img = hatchEl.querySelector('.meta-hatch-dragon');
      img.src = dragon.art; img.hidden = false;
      hatchEl.classList.remove('is-cracking'); hatchEl.classList.add('is-open', `r-${dragon.rarity}`);
      hatchEl.querySelector('.meta-hatch-rarity').textContent = RARITIES[dragon.rarity].label;
      hatchEl.querySelector('h2').textContent = dragon.name;
      const copy = result.duplicate ? `A familiar friend! You receive ${result.refund} coins.` : 'New café cat added to your Album!';
      hatchEl.querySelector('.meta-hatch-copy').textContent = copy;
      sound(dragon.rarity === 'comun' ? 'coin' : 'win'); buzz(dragon.rarity === 'comun' ? 10 : [10, 35, 15]);
      speak(`${dragon.name}, ${RARITIES[dragon.rarity].label}. ${copy}`);
      openButton.textContent = meta.eggs ? 'Open Another Box' : 'Adorable!';
      openButton.onclick = () => { hatching = false; if (meta.eggs) openHatch(); else closeHatch(); };
    }, reduced() ? 150 : 900);
  }
  function closeHatch() { hatching = false; hatchEl.hidden = true; if (current === 'dragons') renderDragons(); refresh(); }

  // Navigation -------------------------------------------------------------
  function go(id, { silent = false } = {}) {
    if (!ORDER.includes(id) || hatching) return;
    const previous = current; current = id;
    const index = ORDER.indexOf(id);
    for (const section of root.querySelectorAll('.meta-screen')) {
      const offset = ORDER.indexOf(section.dataset.screen) - index;
      section.style.setProperty('--offset', offset);
      section.classList.toggle('is-active', offset === 0);
      section.inert = offset !== 0;
    }
    root.classList.toggle('on-map', id === 'map');
    for (const button of root.querySelectorAll('.meta-tab')) button.setAttribute('aria-current', button.dataset.tab === id ? 'page' : 'false');
    if (id === 'map' && previous !== 'map') resumeMap(); else if (id !== 'map' && previous === 'map') pauseMap();
    if (id === 'pachinko') { pachinko.show(); armPachinko(); } else pachinko.hide();
    if (previous === 'dragons' && id !== 'dragons' && meta.fresh.length) commit({ ...meta, fresh: [] });
    if (id === 'dragons') renderDragons();
    if (id === 'shop') renderShop();
    if (id === 'events') renderEvents();
    refresh();
    if (!silent) { sound('pick'); buzz(4); }
  }
  for (const button of root.querySelectorAll('.meta-tab')) button.onclick = () => go(button.dataset.tab);
  // Horizontal swipes on the side screens and the tab bar move between neighbours.
  let swipe = null;
  root.addEventListener('pointerdown', event => {
    if (event.target.closest('canvas, button, .meta-hatch')) return;
    swipe = { x: event.clientX, y: event.clientY, id: event.pointerId };
  });
  root.addEventListener('pointerup', event => {
    if (!swipe || swipe.id !== event.pointerId) return;
    const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y; swipe = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    const next = ORDER[ORDER.indexOf(current) + (dx < 0 ? 1 : -1)];
    if (next) go(next);
  });

  function refresh() {
    root.querySelector('.meta-resource-bar').innerHTML = wallet();
    root.querySelector('.meta-settings').onclick = openSettings;
    onWalletChange(meta);
    const hint = root.querySelector('#meta-pachinko-hint');
    if (hint) hint.textContent = meta.golden < 1 ? 'You have no Diamonds. Find one in a level or visit the Shop.'
      : isLuckyDrop(meta) ? 'Lucky drop! Every slot awards a surprise box this time.'
      : `Drop a Diamond in the café cabinet. Surprise boxes reveal cats for your Album within ${PITY_DROPS + 1} drops.`;
    const dropButton = root.querySelector('[data-action="drop"]');
    if (dropButton) { dropButton.disabled = pachinko.isBusy(); dropButton.setAttribute('aria-label',meta.golden<1?'Get Diamonds':`Play Pachinkat using one Diamond. ${meta.golden} available`); dropButton.querySelector('span').textContent=meta.golden<1?'Get Diamonds':'Play'; }
    const layoutButton=root.querySelector('[data-action="layout"]');
    if(layoutButton){layoutButton.disabled=meta.balls<PACHINKO_LAYOUT_PRICE||pachinko.isBusy();layoutButton.setAttribute('aria-label',`Shuffle Pachinkat board for ${PACHINKO_LAYOUT_PRICE} coins`);}
    badge('pachinko', meta.golden || '');
    badge('dragons', meta.eggs ? meta.eggs : meta.fresh.length ? '¡!' : '');
    badge('events', giftReady(meta) ? '1' : '');
  }
  function badge(id, value) { const el = tabButton(id).querySelector('.meta-badge'); el.hidden = !value; el.textContent = String(value); }

  function syncVisibility() {
    root.hidden = !(enabled && mapVisible);
    document.body.classList.toggle('meta-map-open', enabled && mapVisible);
    document.documentElement.classList.toggle('meta-map-open', enabled && mapVisible);
  }
  // Keep recharging lives current without replacing the animated currency wallet.
  window.setInterval(() => {
    if (!enabled || !mapVisible) return;
    const count = root.querySelector('.meta-resource-bar .meta-coin.lives b');
    if (count) count.textContent = String(getLives());
  }, 1000);
  go('map', { silent: true });
  return {
    setEnabled(on) {
      enabled = on;
      if (on && !meta.welcomed) commit(welcome(meta));
      if (!on && current !== 'map') go('map', { silent: true });
      syncVisibility(); refresh();
    },
    mapShown() { mapVisible = true; syncVisibility(); if (enabled && current !== 'map') { current = 'map'; go('map', { silent: true }); } },
    mapHidden() { mapVisible = false; pachinko.hide(); syncVisibility(); },
    // Called once when an order is complete. Returns what was paid, or null.
    levelWon({ levelId, eaten, goldenEaten }) {
      if (!enabled) return null;
      const reward = levelReward(meta, { levelId, eaten, goldenEaten });
      commit(applyLevelReward(meta, levelId, reward));
      return reward;
    },
    reset() { try { localStorage.removeItem(META_KEY); } catch {} meta = normalizeMeta(null); refresh(); },
    refreshResources() { refresh(); },
  };
}
