import { COUNTRIES } from './countries.js';
import { attachSwipe, closeOpenRow } from './swipe.js';

const TOTAL = 195;
const STORE_KEY = 'carnet-voyages-v1';
const CONTINENTS = {
  AF: 'Afrique', NA: 'Amérique du Nord', SA: 'Amérique du Sud', AS: 'Asie', EU: 'Europe', OC: 'Océanie',
};
// Formes de world-atlas rattachées à un pays de la liste
const GEO_ALIAS = { Somaliland: '706', 'N. Cyprus': '196' };
// Pays absents de la carte 50m : point placé à la main [lon, lat]
const EXTRA_POINTS = { TV: [179.2, -8.5] };
const ALIASES = {
  US: 'usa etats unis amerique', GB: 'angleterre uk ecosse pays de galles grande bretagne', NL: 'hollande',
  CZ: 'republique tcheque', MM: 'birmanie', CD: 'congo kinshasa zaire rdc', CG: 'congo brazzaville',
  KR: 'coree', KP: 'coree', AE: 'dubai emirats abu dhabi', VA: 'saint siege', TL: 'timor leste',
  SZ: 'swaziland', MK: 'macedoine', BY: 'bielorussie', CI: 'ivory coast', DO: 'republique dominicaine',
  CF: 'centrafrique', BA: 'bosnie', PS: 'gaza cisjordanie',
};

/* ---------- Données ---------- */
const enNames = new Intl.DisplayNames(['en'], { type: 'region' });
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[’'\-.,()]+/g, ' ').replace(/\s+/g, ' ').trim();
const flagOf = (iso) => String.fromCodePoint(...[...iso].map((c) => 0x1f1a5 + c.charCodeAt(0)));

const byIso = new Map();
const byNum = new Map();
for (const [iso, num, cont, name] of COUNTRIES) {
  const c = { iso, num, cont, name, flag: flagOf(iso), key: norm(name) };
  c.alt = norm(`${enNames.of(iso)} ${ALIASES[iso] || ''}`);
  byIso.set(iso, c);
  byNum.set(num, c);
}
const sorted = [...byIso.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    const ok = (a) => (Array.isArray(a) ? a.filter((i) => byIso.has(i)) : []);
    const visited = ok(s?.visited);
    return { visited, wish: ok(s?.wish).filter((i) => !visited.includes(i)) };
  } catch { return { visited: [], wish: [] }; }
}
let state = load();
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {}
}
const statusOf = (iso) => (state.visited.includes(iso) ? 'visited' : state.wish.includes(iso) ? 'wish' : null);

/** Change le statut d'un pays (visited | wish | null). Un pays n'est jamais dans les deux listes. */
function setStatus(iso, status, { bounce = true } = {}) {
  const prev = statusOf(iso);
  if (prev === status) return;
  state = {
    visited: state.visited.filter((i) => i !== iso),
    wish: state.wish.filter((i) => i !== iso),
  };
  if (status) state[status].push(iso);
  save();
  render();
  if (status && bounce) bounceCountry(iso);
  if (status === 'visited' || prev === 'visited') popStats();
}

/* ---------- Éléments ---------- */
const $ = (id) => document.getElementById(id);
const el = {
  pct: $('statPct'), bar: $('statBar'), count: $('statCount'), cont: $('statCont'), contList: $('contList'),
  burger: $('burger'), menu: $('menu'), search: $('search'), searchClear: $('searchClear'),
  results: $('results'), resultList: $('resultList'), resultEmpty: $('resultEmpty'), tabsWrap: $('tabsWrap'),
  listVisited: $('listVisited'), listWish: $('listWish'),
  tabCountVisited: $('tabCountVisited'), tabCountWish: $('tabCountWish'),
};
$('year').textContent = new Date().getFullYear();

/* ---------- Stats ---------- */
const shown = { pct: 0, count: 0, cont: 0 };
function tween(key, to, node, fmt) {
  const from = shown[key];
  shown[key] = to;
  if (from === to) { node.textContent = fmt(to); return; }
  const t0 = performance.now();
  const dur = 650;
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    node.textContent = fmt(from + (to - from) * e);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
const fmtPct = (v) => (v === 0 ? 0 : v >= 10 ? Math.round(v) : v.toFixed(1)).toString().replace('.', ',');

function renderStats() {
  const n = state.visited.length;
  const pct = (n / TOTAL) * 100;
  const conts = new Set(state.visited.map((i) => byIso.get(i).cont));
  tween('pct', pct, el.pct, fmtPct);
  tween('count', n, el.count, (v) => Math.round(v));
  tween('cont', conts.size, el.cont, (v) => Math.round(v));
  el.bar.style.width = `${pct}%`;

  el.contList.innerHTML = Object.entries(CONTINENTS).map(([code, label]) => {
    const total = sorted.filter((c) => c.cont === code).length;
    const done = state.visited.filter((i) => byIso.get(i).cont === code).length;
    return `<li><span>${label}</span><span>${done} / ${total}</span><div class="bar"><i style="width:${(done / total) * 100}%"></i></div></li>`;
  }).join('');
}
function popStats() {
  for (const n of [el.pct.parentElement, el.count, el.cont.parentElement]) {
    n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop');
  }
}

/* ---------- Carte ---------- */
// Deux cartes : un aperçu fixe sur l'écran principal, et une vue plein écran (paysage) interactive.
let world = null;           // { features }
const maps = [];            // { shapes: Map(iso -> [nœuds]) }

async function loadWorld() {
  const topo = await fetch('vendor/countries-50m.json').then((r) => r.json());
  const fc = topojson.feature(topo, topo.objects.countries);
  world = { type: 'FeatureCollection', features: fc.features.filter((f) => f.id !== '010') }; // sans l'Antarctique
}

/** Dessine les pays dans `g`, projetés dans un cadre largeur × hauteur. */
function drawCountries(g, width, height) {
  const projection = d3.geoNaturalEarth1().fitExtent([[10, 10], [width - 10, height - 10]], world);
  const path = d3.geoPath(projection);
  const shapes = new Map();
  const add = (iso, node) => { if (!shapes.has(iso)) shapes.set(iso, []); shapes.get(iso).push(node); };
  const gCountries = g.append('g');
  const gMarkers = g.append('g');
  const marker = (iso, x, y) => {
    add(iso, gMarkers.append('circle').attr('class', 'marker').attr('cx', x).attr('cy', y).attr('r', 2.6).attr('data-iso', iso).node());
  };
  for (const f of world.features) {
    const num = GEO_ALIAS[f.properties.name] || f.id;
    const c = byNum.get(num);
    const p = gCountries.append('path').attr('d', path(f)).attr('class', c ? 'country' : 'country is-other');
    if (!c) continue;
    p.attr('data-iso', c.iso);
    add(c.iso, p.node());
    // Micro-États : un point en plus pour qu'ils restent visibles et touchables
    if (path.area(f) < 6 * (width / 960) ** 2 && !GEO_ALIAS[f.properties.name]) marker(c.iso, ...path.centroid(f));
  }
  for (const [iso, lonlat] of Object.entries(EXTRA_POINTS)) marker(iso, ...projection(lonlat));
  const m = { shapes, gMarkers };
  maps.push(m);
  return m;
}

// Aperçu : pas de zoom, pas de geste — un toucher ouvre la carte en grand
function initPreview() {
  const host = $('map');
  host.innerHTML = '';
  const svg = d3.select(host).append('svg').attr('viewBox', '0 0 960 600').attr('aria-hidden', 'true');
  drawCountries(svg.append('g'), 960, 600);
  renderMap();
}

/* ----- Plein écran ----- */
const full = { el: $('mapFull'), host: $('mapFullMap'), svg: null, zoom: null, model: null, size: '' };

function buildFull() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const rotated = vh > vw; // téléphone tenu droit : on tourne la carte de 90° pour l'afficher en paysage
  const size = `${vw}x${vh}`;
  if (full.size === size && full.svg) return;
  full.size = size;
  if (full.model) maps.splice(maps.indexOf(full.model), 1);

  // cadre « paysage » : long côté × petit côté
  const L = Math.max(vw, vh), S = Math.min(vw, vh);
  full.el.classList.toggle('is-rotated', rotated);
  full.el.style.setProperty('--fw', `${rotated ? vh : vw}px`);
  full.el.style.setProperty('--fh', `${rotated ? vw : vh}px`);

  full.host.innerHTML = '';
  const svg = d3.select(full.host).append('svg').attr('viewBox', `0 0 ${vw} ${vh}`);
  // le zoom s'applique en coordonnées écran (le doigt suit la carte), la rotation est à l'intérieur
  const gZoom = svg.append('g');
  const gRot = gZoom.append('g').attr('transform', rotated ? `matrix(0,1,-1,0,${vw},0)` : null);
  full.model = drawCountries(gRot, L, S);
  full.svg = svg;

  full.zoom = d3.zoom()
    .scaleExtent([1, 24])
    .translateExtent([[0, 0], [vw, vh]])
    .on('zoom', ({ transform }) => {
      gZoom.attr('transform', transform);
      full.host.style.setProperty('--k', transform.k);
      full.model.gMarkers.selectAll('circle.marker').attr('r', 2.6 / Math.sqrt(transform.k));
    });
  svg.call(full.zoom).on('dblclick.zoom', null);
  // Double-tap au doigt : zoom sur le point touché
  let lastTap = 0;
  svg.on('touchend.dbl', (ev) => {
    if (ev.touches.length || ev.changedTouches.length !== 1) return;
    const now = Date.now();
    if (now - lastTap < 300) {
      svg.transition().duration(350).call(full.zoom.scaleBy, 2, d3.pointer(ev.changedTouches[0], svg.node()));
      lastTap = 0;
    } else lastTap = now;
  });
  renderMap();
}

function openFull() {
  if (!world) return;
  buildFull();
  full.svg.call(full.zoom.transform, d3.zoomIdentity);
  full.el.hidden = false;
  full.el.inert = false;
  document.body.classList.add('map-open');
  requestAnimationFrame(() => full.el.classList.add('is-open'));
}
function closeFull() {
  full.el.classList.remove('is-open');
  full.el.inert = true;
  document.body.classList.remove('map-open');
  setTimeout(() => { if (!full.el.classList.contains('is-open')) full.el.hidden = true; }, 350);
}
$('mapCard').addEventListener('click', openFull);
$('mapCard').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFull(); } });
$('mapFullClose').onclick = closeFull;
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (full.svg && !full.el.hidden) { buildFull(); } else full.size = ''; }, 150);
});

function renderMap() {
  for (const { shapes } of maps) {
    for (const [iso, nodes] of shapes) {
      const st = statusOf(iso);
      for (const n of nodes) {
        n.classList.toggle('is-visited', st === 'visited');
        n.classList.toggle('is-wish', st === 'wish');
        // les pays colorés passent au-dessus pour que leurs contours restent entiers
        if (st && n.parentNode.lastChild !== n && n.tagName === 'path') n.parentNode.appendChild(n);
      }
    }
  }
}

const pendingBounce = new Set();
function bounceCountry(iso) {
  if (document.body.classList.contains('menu-open')) { pendingBounce.add(iso); return; }
  for (const { shapes } of maps) {
    for (const n of shapes.get(iso) || []) {
      n.classList.remove('bounce'); void n.getBoundingClientRect(); n.classList.add('bounce');
      n.addEventListener('animationend', () => n.classList.remove('bounce'), { once: true });
    }
  }
}

function pop(node) { node.classList.remove('popped'); void node.offsetWidth; node.classList.add('popped'); }

/* ---------- Menu ---------- */
function setMenu(open) {
  document.body.classList.toggle('menu-open', open);
  el.burger.setAttribute('aria-expanded', open);
  el.burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
  el.menu.setAttribute('aria-hidden', !open);
  el.menu.inert = !open;
  closeOpenRow(false);
  if (!open) {
    el.search.blur();
    // les pays ajoutés depuis le menu rebondissent une fois la carte visible
    setTimeout(() => { for (const iso of pendingBounce) bounceCountry(iso); pendingBounce.clear(); }, 380);
  }
}
el.burger.onclick = () => setMenu(!document.body.classList.contains('menu-open'));

// Onglets
const tabs = document.querySelector('.tabs');
const panes = $('panes');
function setTab(name) {
  tabs.dataset.active = name;
  panes.dataset.active = name;
  for (const t of tabs.querySelectorAll('.tab')) {
    const on = t.dataset.tab === name;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', on);
  }
  closeOpenRow(false);
}
tabs.addEventListener('click', (e) => { const t = e.target.closest('.tab'); if (t) setTab(t.dataset.tab); });
setTab('visited');

/* ---------- Recherche ---------- */
function search(q) {
  const nq = norm(q);
  if (!nq) return [];
  const out = [];
  for (const c of sorted) {
    let score = -1;
    if (c.key.startsWith(nq)) score = 0;
    else if (c.key.split(' ').some((w) => w.startsWith(nq))) score = 1;
    else if (c.alt.split(' ').some((w) => w.startsWith(nq)) || c.alt.startsWith(nq)) score = 2;
    else if (nq.length > 2 && c.key.includes(nq)) score = 3;
    if (score >= 0) out.push([score, c]);
  }
  return out.sort((a, b) => a[0] - b[0]).slice(0, 15).map((x) => x[1]);
}
const esc = (s) => s.replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
function highlight(name, q) {
  // repère la position du terme dans le nom normalisé (même longueur que l'original, lettre par lettre)
  const plain = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’'\-.,()]/g, ' ');
  const i = plain.indexOf(norm(q));
  if (i < 0 || !q.trim()) return esc(name);
  const n = norm(q).length;
  return esc(name.slice(0, i)) + '<mark>' + esc(name.slice(i, i + n)) + '</mark>' + esc(name.slice(i + n));
}
function renderResults() {
  const q = el.search.value;
  const has = q.trim().length > 0;
  el.results.hidden = !has;
  el.tabsWrap.hidden = has;
  el.searchClear.hidden = !q;
  if (!has) return;
  const list = search(q);
  el.resultEmpty.hidden = list.length > 0;
  el.resultList.innerHTML = list.map((c, i) => {
    const st = statusOf(c.iso);
    return `<li class="result" style="animation-delay:${Math.min(i, 8) * 25}ms" data-iso="${c.iso}">
      <div class="result-head"><span class="flag">${c.flag}</span><div>
        <div class="result-name">${highlight(c.name, q)}</div>
        <div class="result-cont">${CONTINENTS[c.cont]}</div></div></div>
      <div class="result-actions">
        <button class="btn btn--blue${st === 'visited' ? ' is-on' : ''}" data-act="visited">${st === 'visited' ? 'Visité ✓' : 'Ajouter aux visités'}</button>
        <button class="btn btn--line${st === 'wish' ? ' is-on' : ''}" data-act="wish">${st === 'wish' ? 'Dans mes envies ✓' : 'Ajouter à mes envies'}</button>
      </div></li>`;
  }).join('');
}
el.search.addEventListener('input', renderResults);
el.search.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.search.blur(); });
el.searchClear.onclick = () => { el.search.value = ''; renderResults(); el.search.focus(); };
el.resultList.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const iso = b.closest('.result').dataset.iso;
  const act = b.dataset.act;
  const on = statusOf(iso) === act;
  setStatus(iso, on ? null : act);
  // render() a reconstruit la liste : on anime le nouveau bouton
  const nb = el.resultList.querySelector(`.result[data-iso="${iso}"] button[data-act="${act}"]`);
  if (nb) { nb.closest('.result').style.animation = 'none'; if (!on) pop(nb); }
});

/* ---------- Listes swipables ---------- */
function rowHTML(c) {
  return `<div class="srow-act srow-act--ok" aria-hidden="true"><span>Visité ✓</span></div>
    <div class="srow-act srow-act--del" aria-hidden="true"><span>Supprimer</span></div>
    <div class="srow-main"><span class="flag">${c.flag}</span><div>
      <div class="srow-name">${esc(c.name)}</div><div class="srow-cont">${CONTINENTS[c.cont]}</div></div></div>`;
}
function renderList(ul, isos, kind) {
  const items = isos.map((i) => byIso.get(i)).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const existing = new Map([...ul.children].filter((li) => !li.classList.contains('is-gone')).map((li) => [li.dataset.iso, li]));
  // lignes en train de se replier après un swipe : gardées à leur place le temps de l'animation
  const gone = [...ul.children].map((li, i) => [li, i]).filter(([li]) => li.classList.contains('is-gone'));
  ul.textContent = '';
  for (const c of items) {
    let li = existing.get(c.iso);
    if (!li) {
      li = document.createElement('li');
      li.className = 'srow';
      li.dataset.iso = c.iso;
      li.innerHTML = rowHTML(c);
      attachSwipe(li, {
        onLeft: () => removeCountry(c.iso),
        onRight: kind === 'wish' ? () => moveToVisited(c.iso) : null,
      });
    } else li.style.animation = 'none';
    ul.appendChild(li);
  }
  for (const [li, i] of gone) {
    if (items.some((c) => c.iso === li.dataset.iso)) continue;
    ul.insertBefore(li, ul.children[i] || null);
    setTimeout(() => li.remove(), 340);
  }
}

/* ---------- Actions des lignes ---------- */
const removeCountry = (iso) => setStatus(iso, null);
const moveToVisited = (iso) => setStatus(iso, 'visited');

/* ---------- Rendu global ---------- */
function render() {
  renderStats();
  renderMap();
  renderList(el.listVisited, state.visited, 'visited');
  renderList(el.listWish, state.wish, 'wish');
  el.tabCountVisited.textContent = state.visited.length;
  el.tabCountWish.textContent = state.wish.length;
  if (!el.results.hidden) renderResults();
}

// iOS : bloque le zoom de page par pincement (la carte gère son propre zoom)
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('gesturechange', (e) => e.preventDefault());

render();
loadWorld().then(initPreview).catch((err) => {
  console.error(err);
  $('map').innerHTML = '<div class="map-loading">Carte indisponible hors ligne.</div>';
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !full.el.hidden) closeFull(); });

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
