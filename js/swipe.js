// Lignes à glisser façon Mail / Messages d'iOS.
// Gauche : révèle « Supprimer » (rouge), un glissement long supprime directement.
// Droite (optionnel) : révèle l'action bleue « Visité ✓ ».

const ACTION_W = 96;      // largeur du bouton révélé
const LOCK_PX = 8;        // seuil avant de décider horizontal / vertical
const FULL_RATIO = 0.6;   // au-delà de 60 % de la largeur : action directe

let openRow = null;       // une seule ligne ouverte à la fois

export function closeOpenRow(animate = true) {
  if (openRow) openRow.close(animate);
}

// Toucher ailleurs referme la ligne ouverte (et ce toucher ne déclenche rien d'autre)
let swallowClick = false;
document.addEventListener('pointerdown', (e) => {
  if (!openRow) return;
  const inside = openRow.el.contains(e.target);
  const onButton = e.target.closest('.srow-act');
  if (inside && onButton) return;
  if (inside) return; // la ligne elle-même gère le geste (glisser ou toucher pour refermer)
  openRow.close(true);
  swallowClick = true;
}, true);
document.addEventListener('click', (e) => {
  if (swallowClick) { e.stopPropagation(); e.preventDefault(); swallowClick = false; }
}, true);
document.addEventListener('pointerup', () => setTimeout(() => { swallowClick = false; }, 400), true);

export function attachSwipe(li, { onLeft, onRight }) {
  const main = li.querySelector('.srow-main');
  const del = li.querySelector('.srow-act--del');
  const ok = li.querySelector('.srow-act--ok');
  if (!onRight) ok.remove();

  let x = 0;              // décalage courant
  let startX = 0, startY = 0, base = 0;
  let mode = null;        // null | 'h' | 'v'
  let pointerId = null;
  let moved = false;
  let busy = false;

  const width = () => li.getBoundingClientRect().width;

  function paint(nx, anim) {
    x = nx;
    main.classList.toggle('is-anim', !!anim);
    main.style.transform = x ? `translate3d(${x}px,0,0)` : '';
    del.style.width = `${Math.max(0, -x)}px`;
    del.style.transition = anim ? 'width .42s cubic-bezier(.3,1.45,.55,1)' : 'none';
    // le libellé reste collé au bord de l'écran tant que le bouton n'est pas entier, puis suit la ligne
    del.style.justifyContent = -x < ACTION_W ? 'flex-end' : 'flex-start';
    if (onRight) {
      ok.style.width = `${Math.max(0, x)}px`;
      ok.style.transition = del.style.transition;
      ok.style.justifyContent = x < ACTION_W ? 'flex-start' : 'flex-end';
    }
    const full = width() * FULL_RATIO;
    li.classList.toggle('armed-left', x < -full);
    li.classList.toggle('armed-right', x > full);
  }

  const api = {
    el: li,
    close(anim = true) {
      paint(0, anim);
      if (openRow === api) openRow = null;
    },
  };

  function open(dir) {
    if (openRow && openRow !== api) openRow.close(true);
    paint(dir * ACTION_W, true);
    openRow = api;
  }

  function commit(dir) {
    if (busy) return;
    busy = true;
    if (openRow === api) openRow = null;
    const w = width();
    // la ligne file hors de l'écran, puis se replie
    main.classList.add('is-anim');
    main.style.transition = 'transform .26s cubic-bezier(.4,0,.2,1)';
    main.style.transform = `translate3d(${dir * w}px,0,0)`;
    (dir < 0 ? del : ok).style.transition = 'width .26s cubic-bezier(.4,0,.2,1)';
    (dir < 0 ? del : ok).style.width = `${w}px`;
    setTimeout(() => {
      li.style.maxHeight = `${li.offsetHeight}px`;
      void li.offsetHeight;
      li.classList.add('is-gone'); // renderList laisse la ligne se replier avant de la retirer
      (dir < 0 ? onLeft : onRight)();
    }, 220);
  }

  // Résistance élastique au-delà des limites
  const rubber = (v, limit) => (v <= limit ? v : limit + (v - limit) * 0.25);

  main.addEventListener('pointerdown', (e) => {
    if (busy || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (openRow && openRow !== api) openRow.close(true);
    pointerId = e.pointerId;
    startX = e.clientX; startY = e.clientY;
    base = x; mode = null; moved = false;
  });

  main.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!mode) {
      if (Math.abs(dx) < LOCK_PX && Math.abs(dy) < LOCK_PX) return;
      mode = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      if (mode === 'v') return;
      main.setPointerCapture(pointerId);
    }
    if (mode !== 'h') return;
    moved = true;
    e.preventDefault();
    let nx = base + (e.clientX - startX);
    if (nx > 0) nx = onRight ? rubber(nx, width() * 0.9) : nx * 0.18; // pas d'action à droite : petite résistance
    else nx = -rubber(-nx, width() * 0.9);
    paint(nx, false);
  });

  function end(e) {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    if (mode !== 'h') {
      // simple toucher sur une ligne ouverte : on la referme
      if (!moved && x !== 0 && mode === null) api.close(true);
      mode = null;
      return;
    }
    mode = null;
    const full = width() * FULL_RATIO;
    if (x < -full) return commit(-1);
    if (onRight && x > full) return commit(1);
    if (x < -ACTION_W / 2) return open(-1);
    if (onRight && x > ACTION_W / 2) return open(1);
    api.close(true);
  }
  main.addEventListener('pointerup', end);
  main.addEventListener('pointercancel', (e) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null; mode = null;
    if (x !== 0 && Math.abs(x) < ACTION_W / 2) api.close(true);
  });

  del.addEventListener('click', () => commit(-1));
  if (onRight) ok.addEventListener('click', () => commit(1));
}
