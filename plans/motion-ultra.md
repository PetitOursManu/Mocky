# Motion Ultra — feuille de route

Suivi de travail, pas de la documentation : ce fichier vit hors de `docs/` pour
ne pas tomber sous la règle des jumeaux FR/EN (`tests/docs-parity.test.js`).
Quand la fonctionnalité sera livrée, sa vraie doc ira dans `docs/` + `docs/fr/`
et ce fichier pourra être supprimé.

Cocher `[x]` au fur et à mesure, `[~]` pour une tâche commencée. Une tâche = une
chose livrable et vérifiable.

---

## Objectif

Produire des écrans du niveau de https://motionsites.ai/ : fond vivant, objet
héros, typographie géante, verre dépoli, apparitions au défilement, grain.
Moyen : **plusieurs images générées ensemble** (une série cohérente) + **une
couche CSS ambitieuse mais encadrée**, puis, en v2, des **fonds vidéo**.

## Décisions prises

| Sujet | Décision |
|---|---|
| Nom | **Motion Ultra** (garde « Motion », déjà connu des utilisateurs) |
| Nombre d'images | Deux boutons : **×3** et **×6**. Pas de surprise sur le coût ni l'attente |
| Fonds animés | v1 : images + CSS. v2 : vidéo. Les deux disponibles dans la version finale |
| Types d'écran | **Tous** (landing, app, tableau de bord, formulaire…) |
| Modifiable après génération | **Oui** — voir « Conditions » ci-dessous |
| Activation | Réglage **au niveau du projet**, désactivable **dans le composer** pour une génération |

### Conditions pour que « modifiable » ne dégrade pas la qualité

Rester modifiable ne coûte rien en qualité **à deux conditions**, sans lesquelles
la qualité baisse à chaque retouche :

1. **La passe Polish ne doit pas « corriger » le style Ultra.** Le détecteur
   signale aujourd'hui `glassmorphism-everywhere` et `gradient-text` comme des
   défauts de page générée (`server/muse/quality/policy.js`). Sur un écran Ultra,
   Polish retirerait le verre et les dégradés — exactement ce qu'on a demandé.
   → Politique propre aux écrans Ultra.
2. **Les retouches par chat, les réparations et l'audit doivent savoir que
   l'écran est Ultra** (recettes utilisées, images de la série). Sinon une
   retouche anodine (« change le titre ») peut rendre une page « aplatie ».
   → Contexte Ultra transmis aux cinq chemins de génération + contrôle après coup.

---

## Étape 0 — Corpus et catalogue de recettes (~½ j)

- [~] Analyser ~10 pages de motionsites.ai (landing, app, portfolio, e-commerce)
      — fait sur la page d'accueil et le genre ; une lecture page par page reste à faire
- [x] En tirer un catalogue **fermé** de ~12 recettes nommées (fond aurora, objet
      héros détouré, texte géant masqué, cartes en verre, bandeau défilant,
      parallaxe, pile collante au scroll, grain, halo, grille en perspective…)
- [x] Pour chaque recette : à quoi elle sert, sur quels types d'écran, comment
      elle échoue (même format que les cartes de blocs Motion)
- [x] Déclinaison « écran d'application » : quelles recettes restent sobres sur
      un tableau de bord ou un formulaire (tous types d'écran sont visés)

## Étape 1 — Storyboard (~1–2 j)

- [x] Un appel modèle produit un plan validé : sections, recette par section,
      images à générer avec leur **rôle** (fond, objet héros, texture, illustration)
- [x] Le nombre d'images est **imposé** par le bouton choisi (3 ou 6), jamais
      décidé par le modèle
- [x] Un **style commun** partagé par toutes les images (lumière, palette,
      matière, cadrage) pour qu'elles forment une série
- [x] Si Muse est actif, son dossier nourrit le storyboard ; sinon le storyboard
      remplace le planner
- [x] Recette inconnue : la section est ignorée, le reste du storyboard est gardé
      (la sortie structurée limite déjà le modèle à la liste)

## Étape 2 — Génération des images en lot (~2 j)

- [x] Générer ×3 / ×6 via la file d'images existante (`server/images/`),
      parallélisme limité
- [x] Toutes les images rattachées au projet et à l'écran (bibliothèque)
- [x] Échec ou fournisseur absent → dégradé de remplacement, la page sort quand
      même, avec un avis visible
- [~] Estimation temps + coût affichée **avant** de lancer — dans l'infobulle des
      boutons ×3 / ×6 ; pas encore de chiffre visible sans survol
- [ ] Régénérer **une seule** image de la série sans refaire la page

## Étape 3 — La couche « gros CSS » (~3 j)

- [x] Feuille `u-*` écrite à la main (verre, grain, aurora, révélation par
      masque, texte en dégradé animé, bandeau défilant, animations liées au
      défilement, parallaxe)
- [x] **Décidé : non** — Bloc `<style>` libre autorisé pour le modèle. Un effet qui
      manque s'ajoute au kit, une fois et testé, **borné** (taille max, aucune
      ressource externe, pas d'`@import`) et nettoyé
- [x] Respect de « mouvement réduit », du mode « Sans animation » et des captures
      figées (même exigence que la 3D)
- [~] Budget de performance — règle dans le prompt (2 `<Backdrop>` max) ;
      aucun contrôle après génération

## Étape 4 — Assemblage et contrôles (~2 j)

- [x] Prompt « Ultra » : reçoit recettes + images, génère l'écran
- [x] Contrôle : chaque image prévue est utilisée (signalé, pas corrigé)
- [ ] Contrôle : texte posé sur image lisible (réutiliser l'audit de contraste)
- [ ] Contrôle : budget CSS/animation respecté
- [ ] Une passe de correction si un contrôle échoue (sur le modèle de Polish)

## Étape 5 — Rester modifiable sans perte (~1–2 j)

- [x] Politique qualité spécifique aux écrans Ultra (condition 1)
- [x] Contexte Ultra transmis aux 5 chemins (le vocabulaire du kit suit l'écran
      via ses capacités) : génération, retouche, réparation,
      Polish, correction d'audit (condition 2)
- [x] Après une retouche : vérifier que les images et le kit sont toujours
      là, sinon avertir et proposer « Revenir »

## Étape 6 — Interface (~1–2 j)

- [x] Réglage projet « Motion Ultra » (activé / désactivé) — depuis le composer
- [x] Dans le composer : boutons **×3** / **×6** + interrupteur pour désactiver
      Motion Ultra sur cette génération
- [x] Progression par étape : storyboard → images 2/6 → page
- [x] Badge « Motion Ultra » sur les écrans concernés du canevas
- [x] Textes d'interface FR + EN (`src/i18n/parts/`)

## Étape 7 — Finition v1 (~1–2 j)

- [~] Garantie : Motion Ultra éteint = génération identique à aujourd'hui —
      assurée par le code, pas encore par un test
- [~] Tests — catalogue, storyboard, kit CSS, export : faits ; contrôles et
      politique qualité : à écrire avec leurs étapes
- [ ] Nouvelle série d'invariants « U » dans `docs/architecture/invariants.md` + FR
- [ ] Documentation `docs/` + `docs/fr/`, mention dans les deux README
- [x] `npx tsc --noEmit && npm test && npm run build`

---

## v2 — Fonds vidéo

- [ ] Réutiliser le film Motion de type `background` comme fond d'une section
      Ultra (placement via `<MotionFilm>`, déjà prévu)
- [ ] Choix par section : fond image + CSS **ou** fond vidéo
- [ ] Coût et temps de rendu annoncés avant, comme pour les images
- [ ] Repli automatique sur image + CSS si le rendu vidéo échoue ou n'est pas
      configuré sur le serveur

---

## Risques à surveiller

- **Attente** : ×6 images ≈ 1 à 3 minutes avant de voir la page
- **Coût** proportionnel au bouton choisi
- **Cohérence** visuelle entre les images d'une série
- **Aperçus lourds** sur le canevas quand plusieurs écrans Ultra sont visibles
- **Écrans d'application** : le style « vitrine » peut nuire à la lisibilité
  d'un tableau de bord → recettes sobres dédiées (étape 0)

## Estimation

v1 : **~2,5 à 3 semaines**. v2 (vidéo) : à chiffrer après la v1.

---

## Journal

### 2026-09-25 — première tranche

Livré, de bout en bout : réglage projet + pause dans les deux composers, ×3 / ×6,
storyboard (catalogue de 16 recettes), série d'images, kit CSS `u-*` +
`<Backdrop>` (5 fonds animés en CSS), section de prompt Ultra, trace sur l'écran
(`Screen.ultra`), export du kit dans un projet exporté.

Fichiers : `src/lib/ultra/` (recettes, storyboard, images, préambule),
`src/lib/capabilities/snippets/Ultra.ts`, `src/components/UltraControl.tsx`.

Vérifié : typage, 3 813 tests, build ; rendu du kit dans un banc d'essai du
navigateur (aurora, verre, faisceau de bordure, grille, contour, halo).
**Pas vérifié** : le parcours complet dans l'application — il demande une
connexion et une vraie génération (modèle + images).

À décider :
- Bloc `<style>` libre : pour l'instant le modèle doit s'en tenir au kit et à
  Tailwind (valeurs arbitraires). L'ouvrir coûte un nettoyeur et un budget.

Prochaines étapes, dans l'ordre : politique qualité Ultra (sinon Polish retire
le verre et les dégradés), badge sur le canevas, contrôles après génération,
documentation + invariants « U ».

### 2026-09-25 — premier test réel (projet « Aurel », 3 écrans, 12 images)

Landing ×3, tableau de bord ×3, page produit ×6. Storyboards réels du modèle
(pas le plan de secours), 12 images sur 12, kit utilisé partout.

Corrigé après le test :
- **Réparation automatique sur une erreur d'environnement** (défaut de Mocky, pas
  de Motion Ultra) : quand React/Babel ne se chargent pas dans l'aperçu, l'erreur
  partait au modèle pour « réparation » — appels payés pour rien, et un écran sain
  réécrit. Désormais ignorée (`src/lib/previewErrors.ts`).
- **Objet héros dans un rectangle** : nouvelle classe `u-cutout`, exigée par les
  recettes `object-hero` et `illustrated-state`.
- **« 3 · 1 · 1 » en chiffres clés** : `glow-metrics` réservé aux vrais chiffres.
- **Tableau de bord devenu page vitrine** (données affichées deux fois, titre
  géant) : sur un écran d'application, seules les recettes d'application sont
  acceptées, et les sections deviennent des panneaux du cadre.
- **Type d'écran mal deviné** (page produit prise pour une application) : c'est
  maintenant le storyboard qui décide du type, la devinette par mots-clés n'est
  qu'un indice.
- Avertissement CSS au build, venu d'un commentaire dans `audit/rules.ts`.

Limite de l'environnement de test : le navigateur intégré de Claude bloque les
scripts dans les iframes isolées, donc l'aperçu de Mocky n'y rend rien. Rendus
vérifiés dans un banc d'essai non isolé. Dans un navigateur normal, pas de souci.

Non re-testé en réel après correction : `u-cutout` sur un vrai objet héros, et le
choix du type d'écran par le storyboard (couverts par les tests unitaires).

### 2026-09-25 — deuxième tranche (branche `feat/motion-ultra`)

- **Héros vide signalé par l'utilisateur** : cause trouvée. Avec Muse et les
  animations auto, un film Motion « héros » était placé dans le héros Motion Ultra,
  supprimait la photo et le `<h1>`, et restait letterboxé sur un fond sombre. Un
  film ne prend plus jamais l'ouverture construite par Motion Ultra : il devient
  un autre type, ailleurs, ou n'est pas fait (`openingTaken`, filmDecision.ts).
- **Polish** : sur un écran Motion Ultra, verre, dégradés, halos, projecteur,
  typographie serrée et fond rogné passent en conseil (`ULTRA_TREATMENTS`).
- **Contrôles** : images de la série absentes après génération, et images ou
  kit perdus après une retouche → message, avec « Revenir à la version précédente ».
- **Badge** « Motion Ultra · N images » sur la carte d'image du canevas.
- Voile de la recette `cinematic-hero` : doit couvrir chaque ligne de texte (un
  surtitre sur un mur clair était illisible au test).

Test réel n° 4 (Muse + animations auto + ×3) : héros intact avec son `<h1>`,
3 images sur 3, recettes de page vitrine (le type d'écran est bien reconnu).
Muse n'a pas demandé de film cette fois : la règle du film n'est vérifiée que
par les tests unitaires.

Reste : documentation + invariants « U », régénérer une seule image, fonds
vidéo (v2), test du chemin « film demandé » en réel.
