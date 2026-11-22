# Sites animés et interactifs en un prompt — inventaire et feuille de route

Suivi de travail, pas de la documentation (même statut que `motion-ultra.md`).
Source : cahier des charges « Mocky — Générer un site animé et interactif en un
seul prompt » (v03, 22/11/2026), cas Vasari, Stride, Zestwell.

Révision inventoriée : `eb7b45f` (branche `docs/readme-modele-decision`).
Rien n'a encore été mesuré : ce document est une lecture du code, pas un
résultat d'essai.

---

## Décisions prises (22/11/2026)

| Sujet | Décision |
|---|---|
| Activation | **À la lecture du brief**, pour tous les comptes et le MCP. Une page classique garde son coût |
| Surcoût | **Un appel de plan + au plus un passage de correction** si un contrôle échoue ; coût affiché avant le lancement |
| Média imposé inaccessible | **Diagnostic nommé + proposition d'import** en médiathèque, jamais de remplacement silencieux |
| HTML autonome | **Plus tard**, étape séparée. La v1 vise l'aperçu et l'export projet existant |
| Portée | Vasari, Stride et Zestwell sont **des exemples parmi d'autres** à venir. Aucun composant n'est taillé pour un cas : chaque brief nouveau doit se ramener au même catalogue fermé (formes de produit, dispositions de galerie, gestes). Les briefs sont gardés en corpus (`bench/briefs/`) et rejoués à chaque étape |

## 1. Le parcours réel d'un prompt (ce qui compte pour ces trois cas)

```
composeur (ProjectView.generate)
  → runNewScreen (pipeline/newScreen.ts)
      lecture de site? → Muse? → direction → shortlist de packs
      → Motion Ultra (storyboard + séries d'images)? → planner? (timeout 3 s)
      → images Muse/Ultra/stock → generateComponent (1 appel, 16 384 tokens max)
      → finishGeneratedCode = guardMotion(extractCode)
  → Preview : srcDoc = React + Tailwind 3 + prelude des packs + Babel, iframe
    sandbox="allow-scripts" (origine opaque)
  → boucle de réparation sur erreur de rendu (2 essais, puis retour arrière)
```

Le parcours MCP appelle le même `runNewScreen` (`src/runner/main.tsx:626`),
mais sans Motion Ultra, sans créations, et sans boucle de réparation en moteur
« mocky ».

## 2. Première cause d'échec de chaque cas (prévue, à confirmer par la mesure)

| Cas | Ce qui casse en premier | Nature |
|---|---|---|
| **Vasari** | La consigne de base interdit les images externes : « do not use `<img>` with external URLs. Use inline SVG, emoji, or solid-color placeholder divs » (`generate.ts:46`). Les quatre planches seront remplacées par des aplats. Avec Muse ou Ultra, ces derniers planifient en plus leurs propres images et ignorent les URL du prompt (aucune extraction d'URL du texte). | **Exposition** — le moteur sait afficher l'image (`img-src *`), la 3D CSS, la boucle rAF, le masque SVG : rien de tout cela n'est retiré du code. |
| **Stride** | three.js depuis un CDN est impossible : `script-src` = origine Mocky, l'`import` est retiré (`stripMotion.ts:52`). Le `THREE` embarqué n'exporte que 22 classes (`build-vendor-three.mjs:51`) : ni `CanvasTexture`, ni `Raycaster`, ni `MeshPhysicalMaterial`, ni `PMREMGenerator`. `<Scene3D>` est décoratif (10 préréglages, `pointer-events:none`, un seul par écran). Le clip d'intro est bloqué (`media-src` = origine Mocky). | **Moteur absent** |
| **Zestwell** | Même blocage three.js ; ni `CylinderGeometry`, ni `CircleGeometry`, ni textures, ni sélection par rayon, ni caméra pilotable. | **Moteur absent** |

Deux obstacles communs qui ne se voient qu'après :

- **Texture WebGL depuis la médiathèque : impossible aujourd'hui.** L'aperçu
  a une origine opaque ; `/api/images/<hash>` n'envoie pas
  `Access-Control-Allow-Origin` (seul `/fonts` le fait, `server/index.js:3372`).
  Une image importée en médiathèque s'affiche en CSS mais ne peut pas devenir
  une texture. Une URL externe avec `ACAO: *` (cas de images.higgs.ai, selon le
  brief) le peut.
- **Les miniatures, captures et exports perdent les images distantes**
  (`capture.ts:324`, `stillCopy.ts:185` : `img-src` = origine seulement). Un
  écran fidèle dans l'aperçu aura une vignette vide.

Polices : Newsreader, Inter Tight, Archivo Black, DM Mono et Oswald sont au
catalogue ; **Noto Sans JP et Noto Serif SC n'y sont pas** (Vasari).

## 3. Classement des capacités demandées

Légende : **U** déjà utilisable par le modèle · **E** présente dans le moteur
mais mal exposée · **X** à étendre · **C** à créer.

| Capacité | État | Ce qui existe | Ce qui manque |
|---|---|---|---|
| Médias identifiés, découpes nommées | **E + C** | `img-src *` ; `providedPictures.ts` (section « PICTURES » déjà écrite pour le MCP) ; épingles de médiathèque | Interdiction dans la consigne ; aucune extraction d'URL ni de découpe depuis le brief ; épingles ignorées quand Muse est éteint (`newScreen.ts:536-787`) ; aucun composant de découpe (CSS ni texture) ; pas de conversion taille source → taille servie (`naturalWidth`) ; vidéo externe bloquée |
| Transition entre emplacements réels (FLIP) | **C** | Rien (Parcours = échange de documents). `Motion.motion` est global mais `layoutId` non vérifié | Mesure départ/arrivée après polices et au redimensionnement, origine WebGL projetée, aller-retour, interruption |
| Progression commune, gestes continus | **C** | Bus de défilement interne `mockyBus` (scroll seul, non documenté) ; suivi amorti de `PointerSequence` | Glisser/molette/clavier → valeur continue, inertie, aimantation, boucle, seuil 5-6 px, clic supprimé après drag, `touch-action: pan-y` |
| Séquences, masques, effets | **X** | `<Animated>` : 11 révélations clip-path, `delay` ≤ 2 s, `stagger` ; tracé `Ornament draw` ; compteur `CountUp` | Pistes coordonnées sur temps ou progression, masque d'encre SVG, texte qui change par masque (entrant/sortant), vague de couleur, curseur personnalisé. Le modèle peut l'écrire à la main (rien n'est retiré), mais la consigne l'interdit sous Ultra et c'est là que la génération casse |
| Objet produit 3D paramétrable | **C** | Infrastructure GL : budget de contextes (`Canvas.tsx`, `mockySceneHub`), image figée hors budget | Faces recto/verso texturées depuis une découpe, silhouette (sachet, boîte, carte, canette), pose pilotée par l'état, ancrage sur un rectangle HTML mesuré, plusieurs objets dans **un** canvas |
| Scène navigable, caméra ciblable | **C** | Idem | Disposition d'œuvres identifiées (couloir en anneau, mur droit, grille), trajectoire pilotée par la progression, sélection par rayon, cadrage, projection vers le HTML |
| État partagé scène ↔ interface | **X** | État React ordinaire ; `useFlowState` entre écrans | Composants contrôlés (`value`/`onChange`, `selected`/`onSelect`) pour que le même identifiant pilote scène, textes et fiche |
| Contrôles déterministes avant présentation | **X** | Réparation sur erreur de rendu ; `measureOverflowIn` exécuté dans la frame (à la demande) | Média absent, découpe hors limites, cible inconnue, fiche orpheline (sur l'AST) ; parcours court joué dans la frame |
| Mesure par essai | **C** | Activité (par requête, 1 h, sans jetons) ; registre de dépenses (plié par jour, sans `purpose`) | Identifiant de génération porté par chaque appel et relu en une trace : appels, durée, jetons, coût ; images non comptées aujourd'hui |

**Révisé le 22/11 après les images de référence** (`Mocky_References_Images_20261122_v01.zip`,
images extraites des vidéos : Vasari, Stride, Zestwell) : **la 3D CSS d'abord, le WebGL
en dernier recours.** Ce que les images montrent :

- *Vasari* : des pavés réels (tranche et jaquette visibles en même temps pendant
  la rotation, une face assombrie par l'éclairage) — un pavé CSS à six faces.
- *Stride* : la barre est vue de face ou de dos, presque jamais de profil ; un
  recto en image détourée, un verso imprimé (tableau nutritionnel) dans la même
  silhouette, un reflet qui glisse — deux faces CSS, le verso découpé par un
  masque fait de la même découpe, un reflet piloté par l'angle.
- *Zestwell* : des cadres plats sur deux murs courbes, une caméra qui avance et
  pivote — un monde CSS (`perspective` + transformation inverse de la caméra),
  murs en anneau de panneaux, brouillard par l'opacité.

En CSS, la sélection est un clic du DOM (l'œuvre réellement touchée, des deux
côtés), la projection vers le HTML est `getBoundingClientRect` (la fiche part de
l'œuvre sans calcul), les images s'affichent par `img-src *` (pas de CORS de
texture), et aucun contexte WebGL n'est consommé. Limites connues : la capture
(`html2canvas`) ne rend pas les transformations 3D — les vignettes seront
approximatives —, et un volume vraiment courbe ou éclairé (un sachet gonflé vu de
profil, un globe) reste l'affaire du WebGL.

Choix d'architecture 3D (§3 du cahier) : **nouveaux composants, pas
d'extension de `<Scene3D>`**. `<Scene3D>` est décoratif par contrat
(`aria-hidden`, pas de clic, image figée hors budget) et ces trois contrats sont
exactement ce que Stride et Zestwell contredisent. Les nouveaux composants
réutilisent le budget de contextes et le hub. Vasari reste en CSS 3D + SVG,
comme cas de contrôle.

## 4. Proposition technique

### 4.1 Un nouveau pack, `interact`

Composants écrits à la main, testés, documentés par carte comme les autres. Le
modèle compose, le moteur calcule (même règle que les films).

- `useSheet(url, {w, h, crops})` + `<Crop sheet="covers" name="cover-noon">` :
  découpe CSS, rectangle SVG, et la même découpe pour une texture ; conversion
  via `naturalWidth`. Une découpe hors limites lève un diagnostic nommé.
- `useTrack({count, loop, snap, inertia, input: ['drag','wheel','keys']})` →
  `{pos, target, dragging, go(i), bind}` : la progression commune, avec seuil,
  suppression du clic après drag et `pan-y`.
- `<Morph id from to>` / `mockyMorph(fromEl|rect, toEl)` : la transition FLIP,
  réversible et interruptible, qui accepte un rectangle projeté depuis WebGL.
- `<MaskText value dir>` (texte qui change par masque), `<InkReveal>`
  (masque SVG à taches), `<ColorReveal>` (cercle adouci), `<Cursor states>`
  (curseur personnalisé, pointeurs fins seulement), `useTimeline` (pistes sur
  temps ou sur `pos`).
- `<ProductStage>` + `<Product3D shape="pouch" front back pose anchor="#id">` :
  un seul canvas fixe, N objets, ancrés sur des rectangles HTML.
- `<Gallery3D layout="ring" items selected onSelect onOpen>` : la scène
  navigable, avec caméra pilotée par `useTrack`.

Toutes respectent « Sans animation », le mouvement réduit, la capture figée et
fournissent un repli sans WebGL (liste HTML des mêmes éléments).

### 4.2 Côté génération

1. **Lecture des engagements du brief** : extraction déterministe des URL, des
   tailles et des tableaux de découpes (pas de modèle), puis une étape de plan
   (le planner existant, avec un délai réaliste au lieu de 3 s) qui associe
   chaque interaction à un composant. Produit un manifeste : médias, entités,
   vues, gestes.
2. **Médias imposés prioritaires** : section « PROVIDED MEDIA » (réemploi de
   `providedPictures.ts`), levée de l'interdiction des URL pour ces seules
   URL, Muse et Ultra n'ont plus le droit de les remplacer, épingles honorées
   même sans Muse.
3. **Activation à la lecture du brief** du pack `interact` (et de la 3D
   seulement si le manifeste la demande) : une page classique garde son coût.
4. **Contrôles** : sur l'AST (découpes, cibles, ids), puis un parcours court
   joué dans la frame (`__mockyCmd: 'probe'`) : glisser, sélectionner, ouvrir,
   fermer. Les exigences non vérifiées sont affichées.
5. **Retouches** : `EDIT_RULES` et un contrôle après coup gardent les ids, les
   découpes et les composants `interact` (même principe que `ultraLoss`).

### 4.3 Côté serveur

- `Access-Control-Allow-Origin: *` sur `GET /api/images/<hash>` (adressé par
  contenu, déjà lisible sans session dans l'aperçu) pour qu'une image de la
  médiathèque puisse devenir une texture. À valider contre les invariants.
- `x-mocky-run` sur chaque appel d'une génération, relevé dans l'activité et
  dans une trace par génération (appels, durée, jetons, coût, images).
- three.js embarqué étendu de ce qu'il faut (`CanvasTexture`, `Texture`,
  `Raycaster`, `CylinderGeometry`, `CircleGeometry`, `MeshPhysicalMaterial`,
  éventuellement `PMREMGenerator` + `RoomEnvironment`), re-hashé dans
  `VENDOR.md`, taille mesurée avant/après.

## 5. Ordre de réalisation

- [~] **0. Mesure initiale** — rejouer les trois prompts tels quels sur
      `eb7b45f`, un modèle, consigner la sortie brute et la première cause
      d'échec. Ajouter `x-mocky-run` d'abord pour que cette mesure ait un coût.
      Briefs copiés dans `bench/briefs/`. **Bloqué** (22/11) : l'instance en
      ligne répond 403 sur la clé du fournisseur texte ; `create_design` limite
      le brief à 4 000 caractères (les originaux font 26 à 38 Ko) — la mesure
      fidèle passe par le composeur. Détail : `bench/baseline-2026-11-22.md`.
- [~] **1. Socle (Vasari)**
  - [x] Pack `interact` (`snippets/Interact.ts`) : `SheetCrop`,
        `sheetCropSvg`, `useGlideTrack`, `MaskSwap`, `InkReveal`,
        `ColorReveal`, `PointerRing`, `MockyMorph.grow/fly` ; carte, mots
        déclencheurs, exclu des documents, inféré aussi d'un appel de hook
  - [x] Médias imposés (`lib/briefMedia.ts`) : URL du brief lues sans modèle,
        images autorisées par adresse exacte, vidéo / script / police nommés
        (consigne + message à l'utilisateur)
  - [x] Scène de test déterministe dans un aperçu (étagère de 12 en boucle) :
        glisser à mi-course = tous les éléments à mi-mouvement, relâcher →
        aimantation, clic avalé après un glisser, molette, flèches, `go` par le
        plus court, flèches ignorées fiche ouverte, fiche qui pousse de la
        jaquette, fermeture pendant l'entrée sans saut, encre complète,
        curseur OPEN qui retombe après le clic
  - [x] 3D CSS (`snippets/Interact3D.ts`, même pack) : `Box3D` (pavé à six
        faces, ombrage par l'orientation, reflet), `MaskRise`, `useTweened`
        (une courbe par clé), `useViewportSize`, `Space3D` / `Place3D` /
        `Ring3D` / `MockySpace` (monde à caméra, brouillard, élimination
        derrière l'œil) ; `SheetCrop mask flip` (verso dans la silhouette du
        recto)
  - [x] Scènes construites avec les vraies planches des briefs, comparées aux
        images de référence : étagère Vasari (tranche + jaquette visibles à
        mi-rotation, fiche qui pousse de la jaquette, encre, lignes qui
        montent) ; couloir Zestwell (anneau courbe, œuvres sur les deux murs,
        marche à la molette, clic = l'œuvre réellement touchée des deux côtés,
        cadrage, fiche de la bonne œuvre, copie volante puis retirée). Corrigé
        en chemin : `Space3D` perdait le `ref` du geste (molette sans effet)
  - [x] Stride en CSS : barre = `Box3D` à faible épaisseur + verso
        `SheetCrop mask flip` ; `sheetCropMask` / `overlayMask` pour que
        l'ombre et le reflet s'arrêtent à la silhouette ; `AnchorTravel` (un
        seul objet, mesuré à chaque image sur des emplacements HTML, relayé
        par le défilement) et `useScrollProgress`. Vérifié dans Chromium
        headless (le panneau masqué gèle les animations) sur la vraie planche :
        Mint Chip choisi, arrivée au pixel sur la boîte de la section 2, verso
        nutritionnel à l'étape 2, retour en arrière, atterrissage au pixel sur
        sa carte, carte plate masquée, une seule copie
  - [x] Contrôles après génération (`lib/briefCheck.ts`) : images imposées
        absentes du code (une adresse de proxy et sa source comptent pour
        une), pack `interact` offert mais inutilisé — messages, sans correction
  - [x] Découpes hors planche remontées de l'aperçu (`crop-problem` →
        Preview → Canvas → message dans ProjectView, une fois par découpe)
  - [x] Brief avec images imposées : Muse (images de page, planche
        d'ambiance), images de site remplacées et série Motion Ultra ne sont
        plus générées (`briefImposesPictures`)
  - [x] Trace par génération : `x-mocky-run` sur chaque appel d'un nouvel
        écran (`lib/proxy.ts`), `server/admin/runs.js` (appels, durées,
        jetons, coût ; en mémoire, 2 h, bornée), `GET /api/runs/:id` pour le
        compte qui l'a lancée ; `NewScreenOutcome.runId`,
        `window.__mockyLastRun` pour un banc d'essai. Limite : deux
        générations simultanées dans un même onglet partagent l'identifiant
  - [x] Retouches : consigne `EDIT_RULES` (ids, adresses d'images, découpes,
        interactions) et `interactLoss` signalé après chaque retouche
        (composeur et MCP)
  - [x] Appareils, dans Chromium headless : glisser au doigt, balayage
        vertical laissé à la page, pas de curseur personnalisé au tactile,
        aucun débordement horizontal à 390 px, tap = sélection (Zestwell
        paysage 844×390), barre Stride posée à 0 px de sa carte à 390 px,
        mouvement réduit = tout arrive d'un coup. Corrigé : un volume
        cliquable (`Box3D`, `Place3D` avec onClick) est un bouton au clavier
        (Tab, Entrée, Espace). Observé, pas un défaut du pack : après un
        balayage vertical, Chrome mange le tap suivant (arrêt du défilement)
  - [ ] Polices CJK (Noto Sans JP, Noto Serif SC) : le vendoring ne garde que
        `latin` / `latin-ext` par choix (`scripts/vendor-fonts.mjs`) ; les
        ajouter change ce choix (sous-ensembles CJK, nouveaux paquets) —
        décision à prendre. D'ici là, police japonaise du système
  - [x] Passage de correction borné : un au plus, motif `brief-fix`, seulement
        sur un brief qui impose des images et quand un contrôle échoue, gardé
        seulement s'il améliore sans rien aggraver (`briefFixInstruction`)
  - [x] Documentation : `docs/interactive-sites.md` + miroir FR, invariants
        S1–S5 (EN/FR), entrée de navigation, section dans `CLAUDE.md` (découpes hors planche, cibles,
        médias imposés absents du code)
  - [ ] Muse / Ultra : ne plus générer d'images de page quand le brief en impose
  - [ ] Polices manquantes : Noto Sans JP, Noto Serif SC
  - [ ] Génération réelle depuis le composeur, sur le brief Vasari
- [ ] **2. Produit 3D (Stride)** — vendor three étendu, CORS médiathèque,
      `ProductStage`/`Product3D`, ancrage sur cartes, trajet inverse, mobile.
- [ ] **3. Espace 3D (Zestwell)** — `Gallery3D`, sélection, cadrage, passage
      vers la fiche, retour sur la bonne œuvre, vue liste.
- [ ] **4. Comparaison** — mêmes cas + un brief inédit, plusieurs essais,
      réussites / essais publiés, coût additionnel, limites.

## 6. Écarts relevés en passant

- `CLAUDE.md` dit que la CSP de l'aperçu n'a pas de `media-src` et que
  `GET /api/video/:hash` est protégé par session ; le code a
  `media-src ${origin}` (`Preview.tsx:124`) et la route est publique.
- Le timeout du planner (3 s, `plan.ts:102`) est probablement trop court pour
  un modèle distant : échec silencieux, donc il contribue rarement.
- Une génération tronquée n'est pas poursuivie, et une retouche tronquée n'est
  pas signalée (`screenPasses.ts:70-76`).
- Les images générées ne sont pas comptées dans le registre des dépenses.
