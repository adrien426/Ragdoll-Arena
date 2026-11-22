# Ragdoll Arena 3D

Jeu sandbox / combat ragdoll ultra réaliste dans le navigateur (Three.js r128, aucun build).

- 206 os, ~65 muscles et ligaments, organes, vaisseaux, nerfs
- Balistique des plaies, hémorragies (litres, ml/s), SpO₂, température, douleur, Glasgow
- Brûlures (règle des 9), hypothermie, noyade (eau dans les poumons), gaz toxique, foudre
- Chances de survie calculées avec les vrais scores médicaux (ISS, RTS, TRISS, Baux)
- Catastrophes : météorite, accident de voiture, foudre, tornade, inondation, séisme, gaz, incendie, briques…
- Carte inspirée de Luxembourg-Ville + « Quartier Noir »

## Fichiers

- `index.html` : page du jeu
- `js/data.js` : données anatomiques (os, muscles, organes), armes, soins
- `js/engine.js` : maths, audio, rendu, particules
- `js/maps.js` : cartes et collisions
- `js/body.js` : ragdoll Verlet et rendu des personnages
- `js/medical.js` : blessures, physiologie, diagnostic, survie
- `js/combat.js` : armes, IA, vagues
- `js/events.js` : catastrophes et outils
- `js/models.js` : personnages réalistes (squelettes Mixamo) pilotés os par os par le ragdoll physique
- `assets/models/` : personnages du dossier 3D (GLB compressés meshopt + WebP)
- `lib/` : GLTFLoader, décodeur meshopt et SkeletonUtils de three.js r128
- `js/ui.js` : interface, caméra, boucle de jeu

## Publication (GitHub Pages)

Workflow `.github/workflows/pages-preview.yml` :
- `main` → https://adrien426.github.io/Ragdoll-Arena/
- toute autre branche → https://adrien426.github.io/Ragdoll-Arena/preview/<branche>/

Réglage requis une fois : Settings → Pages → « Deploy from a branch » → `gh-pages` / `(root)`.
