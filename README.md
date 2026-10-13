# Carnet de voyages

Web app mobile (PWA) : pays visités, envies de voyage, % du monde, carte interactive.
HTML/CSS/JS sans build ni dépendance à installer — tout est dans le dossier.

## Lancer en local

```bash
node tools/serve.js 5180
```

Puis http://localhost:5180 (ou `http://<IP-du-Mac>:5180` depuis l'iPhone sur le même Wi-Fi —
mais le service worker et l'installation complète demandent du **HTTPS**).

## Installer sur l'iPhone

Héberger le dossier en HTTPS (GitHub Pages, Netlify, ou derrière Tailscale Serve comme Jarvis),
l'ouvrir dans Safari → Partager → « Sur l'écran d'accueil ».

## Structure

- `index.html`, `css/app.css` — interface (tokens couleurs/polices en haut du CSS)
- `js/app.js` — état, stats, carte (d3-geo + zoom), recherche, menu, toast
- `js/swipe.js` — lignes à glisser façon Mail iOS
- `js/countries.js` — 195 pays (généré par `node tools/build-countries.js`)
- `vendor/` — d3 7.9, topojson-client 3.1, world-atlas 2.0 (countries-50m)
- `sw.js` — cache hors ligne : **incrémenter `VERSION`** après chaque modification

Données : `localStorage`, clé `carnet-voyages-v1` (propres à chaque appareil/navigateur).
