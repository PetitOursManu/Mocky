# Visuels à partir d'un texte — feuille de route

Suivi de travail, pas de la documentation (même statut que `motion-ultra.md`
et `sites-interactifs.md`). Référence étudiée : Napkin AI (napkin.ai, Napkin
Visuals et Napkin Slides), le 25/11/2026.

Révision inventoriée : `b1e07c0` (branche `feat/sites-interactifs`). Rien n'a
été mesuré ni prototypé : ce document est une lecture du code et du produit
de référence, pas un résultat d'essai.

---

## État au 25/11/2026 — phase 1 livrée (non commitée)

Ce qui a été fait, et en quoi cela s'écarte du plan ci-dessous :

| Plan | Réalisé | Pourquoi l'écart |
|---|---|---|
| Un appel `visual` dédié qui rend un JSON (§5) | **Pas d'appel dédié** : le type d'écran `visual` force le kit, et la génération ordinaire écrit `<Visual family doc alternatives>` dans une `<Page>` | C'est le modèle de `<Scene3D preset>` et `<Ornament shape>` : on hérite gratuitement des versions, de la revue, des exports, des retouches, des verrous et du MCP (`create_design` avec le type `visual`). Le contenu reste une donnée lue par le parseur (G1, G2) |
| `layout.ts` pur côté TS + miroir dans le snippet (§4) | **La mise en page vit dans le snippet seul** (`snippets/Visual.ts`), testée en exécutant la chaîne même que l'aperçu reçoit | Une seule source au lieu de deux à tenir ensemble |
| `server/visuals/schema.js` (§4) | **Absent** | Le serveur n'a rien à valider tant qu'il n'y a pas d'outil `create_visual` (phase 3) |
| Couleurs jamais écrites par le modèle (G4 du §11) | Le modèle passe `colors`/`ink`/`ground` **de sa palette**, comme pour `<Ornament color>` ; chaque texte est ensuite mesuré et corrigé | Sans appel dédié, le thème n'a pas d'endroit où être attaché après coup ; la garantie tenue est la lisibilité, pas l'origine |
| 12 familles + `chart-*` | **14 familles** : les 12 + `bars` et `donut`, dessinés par le kit (pas d'appel aux `Charts`) | Barres en HTML → formes éditables dans le .pptx |
| Icônes Lucide | **Reporté** : les 76 icônes de `Icons.ts` | Dépendance + vendoring + épinglage : à décider avec la phase 2 |
| Corpus de 20 textes `bench/visuals/` | **Remplacé** par `Visual.test.ts` (14 familles × 3 formats × min/max × mots longs : 166 cas) | Aucune génération réelle n'a été lancée : **le choix de famille par un vrai modèle n'est pas mesuré** |

Fichiers : `lib/visuals/{families,read,numbers,check}.ts`,
`capabilities/snippets/Visual.ts`, `components/ScreenVisualDialog.tsx`,
`i18n/parts/visuals.ts`, `docs/visuals.md` (+ FR), invariants G1–G4.

Essais du 25/11/2026, dans l'application réelle (build de production, serveur
isolé, Edge piloté par Playwright), sur trois écrans écrits à la main comme un
modèle les écrirait :

- rendu dans l'aperçu sandboxé : 16:9 clair, carré sombre en cases pleines,
  portrait avec un `doc` tenu dans une `const` — sans erreur ;
- clic droit → « Visuel… » : propositions en tête, familles refusées grisées avec
  leur raison, passage étapes → cycle → frise écrit dans le code et rendu ;
- export « Tout en éléments séparés » de la frise : 19 formes, 18 zones de texte
  modifiables, 3 images (les liaisons) ;
- corrigé en route : comparaison suspendue au titre (centrée), chiffres clés en
  piliers pleine hauteur (cartes plafonnées et centrées).

**Phase 1 close.** Dernier essai : la requête EXACTE d'un écran « Visuel »
(`buildGenerationMessages`, celle que le moteur MCP « client » transmet) servie à
un agent Claude neuf, ignorant du test, sur quatre textes français (méthode,
bilan chiffré, pour/contre, histoire datée). Résultat : étapes, chiffres clés,
pour/contre, frise — aucun SVG maison, toutes les `alternatives` acceptées par
leur famille, aucun chiffre inventé (« 1 200 » reconnu), « barres » écarté à
raison sur des unités différentes ; rendu propre des quatre dans l'aperçu.
Ce n'est pas le fournisseur du compte : un autre modèle peut choisir moins bien.

Corrigé à la clôture : Muse ne tourne plus pour un visuel (avis affiché) ; la
famille quittée reste dans `alternatives` ; les nombres suivent la langue du
lecteur quand la page n'en déclare pas (« 92 % »).

Non vérifié : le .pptx ouvert dans PowerPoint et Canva (compté dans le fichier :
formes et zones de texte, images pour les seules liaisons).

## 0. Décisions à prendre avant la phase 1

| Sujet | Proposition | Pourquoi |
|---|---|---|
| Nom dans l'interface | **« Visuel »** (EN « Visual ») | Le mot de Napkin, et celui qu'on emploie déjà pour un post |
| Où ça vit | **Un type d'écran** d'abord, le mode « Illustrer un texte » en phase 2 | Le type d'écran réutilise tout le canevas, les versions, la revue et les exports ; le mode document est une vue nouvelle |
| Ce que le modèle écrit | **Un document JSON validé**, jamais le dessin | C'est la règle fondatrice des films (`timeline.ts`), et ce qui rend le changement de famille gratuit |
| Familles en v1 | **12**, puis 30 | Douze suffisent à couvrir ~80 % des textes d'affaires (liste au §3) ; chaque famille est un composant écrit et testé à la main |
| Icônes | **Lucide (ISC)**, sous-ensemble vendu et épinglé | 76 icônes aujourd'hui dans `Icons.ts`, il en faut plusieurs centaines ; ISC est compatible AGPL et un `.svg` par icône se découpe bien |
| « Effects » de Napkin (visuel → image aquarelle, origami…) | **Hors périmètre** | C'est une génération d'image qui détruit l'édition ; à rouvrir seulement sur demande |

## 1. Ce que fait Napkin, en bref

- **Parcours** : texte collé ou importé (PDF, DOCX, PPT, MD) → l'éditeur est un
  DOCUMENT → sur un bloc ou une sélection, « Générer un visuel » → une liste de
  propositions → on en choisit une, puis un style → le visuel s'insère sous le
  texte. Aucune consigne à écrire ; ≈ 1 crédit par mot sélectionné.
- **Moteur** (déduit, non publié) : un catalogue fermé de mises en page
  nommées (« plus de 30 catégories »), qu'un modèle remplit après avoir extrait
  la structure du texte ; 25 styles et une « marque » appliqués comme une couche
  séparée. Indices dans l'API : un `visual_id` réutilisable, `visual_query` qui
  « guide sans garantir », des avertissements `not_enough_visuals`.
- **Édition** : vectorielle, élément par élément (texte, icône, couleurs hex,
  formes, connecteurs), gratuite. Brand Studio : couleurs (extraites d'un logo),
  fond, trois polices.
- **Exports** : PNG, SVG, PDF, PPT (texte et formes éditables, images figées),
  Google Slides. API asynchrone (`POST /v1/visual`, 1–4 visuels, `style_id`,
  `orientation`, `color_mode`) et **serveur MCP officiel** (`create_visual`,
  `get_visual`, `list_styles`).
- **Faiblesses rapportées** : rendu générique et répétitif ; une prose dense
  donne un visuel vague ; **chiffres altérés** (leur aide demande de les
  relire) ; pas de changement de type à contenu constant documenté (on
  régénère) ; peu d'intégrations.

Ce sont ces faiblesses que la conception ci-dessous vise d'abord.

## 2. Le principe : un catalogue fermé, un schéma commun

```
texte ──► appel 'visual' (1 seul) ──► VisualDoc (zod, .strict())
                                     │  contenu : titre, items[], relations
                                     │  propositions : 3–4 familles classées
                                     ▼
          <Visual family="cycle" doc={…} />   ← composant écrit à la main
                                     │  couleurs : direction / marque du projet
                                     │  mesures : débordement, contraste
                                     ▼
          écran Mocky ordinaire ──► versions, revue, exports, MCP
```

Trois règles, empruntées à ce qui a déjà marché ailleurs dans Mocky :

1. **Le modèle choisit et remplit, il ne dessine jamais** (comme les films,
   `CLAUDE.md` « Video export », règle 7). Un nom pris dans une énumération
   fermée ne coûte rien en sécurité ni en qualité ; un `<svg>` libre est la
   source du rendu « générique » reproché à tout le monde.
2. **Un seul schéma de CONTENU pour toutes les familles.** Une famille est une
   façon de dessiner le même contenu. Passer de « cycle » à « timeline » est
   donc un changement de prop, sans appel au modèle — ce que Napkin ne fait pas.
   Une famille qui exige une forme de contenu (une matrice 2×2 veut deux axes)
   le dit par un prédicat `accepts(doc)`, et le sélecteur grise ce qu'elle
   refuse en nommant la raison.
3. **Les couleurs ne viennent jamais du modèle.** Elles sont lues dans la
   direction du projet et sa marque (`DesignConfig.brands`), comme `theme` est
   attaché par le serveur à un film après validation (règle 9). Le modèle ne
   voit ni hex ni police.

## 3. Le schéma et les familles

### Schéma (`src/lib/visuals/schema.ts`)

```ts
VisualDoc = {
  title?: line(80)
  subtitle?: line(140)
  items: Item[1..12]           // borné : au-delà, aucune famille ne reste lisible
  relations?: { from, to, label?: line(30) }[]   // pour flux, carte, réseau
  axes?: { x: line(30), y: line(30) }            // pour matrice, positionnement
  source?: line(120)           // « Source : … » sous un graphique
}
Item = {
  id: string
  label: line(40)
  detail?: line(160)
  icon?: IconName              // énumération fermée (Lucide vendu)
  value?: { n: number, unit?: line(8) }   // un nombre DU TEXTE, vérifié (§6)
  children?: Item[0..6]        // pour arbre, carte mentale, pyramide détaillée
  emphasis?: boolean           // un seul par document
}
Proposals = { family: Family, why: line(80) }[1..4]
```

Les bornes sont lues dans le schéma par le prompt, comme `signature()` le fait
pour `compose.js` : jamais de nombre recopié à la main dans une consigne.

### Familles v1 (12)

| Famille | Pour | Accepte |
|---|---|---|
| `steps` | Un processus linéaire | 2–8 items |
| `cycle` | Un processus qui boucle | 3–8 items |
| `timeline` | Des dates ou des étapes datées | 2–10 items |
| `funnel` | Une réduction successive | 3–6 items, valeurs décroissantes si présentes |
| `pyramid` | Une hiérarchie, une fondation | 3–6 items |
| `comparison` | Deux ou trois options côte à côte | 2–3 items avec `children` |
| `pros-cons` | Avantages / inconvénients | exactement 2 items avec `children` |
| `matrix` | Une grille 2×2 | 4 items + `axes` |
| `hub` | Un centre et ses satellites | 1 `emphasis` + 3–8 items |
| `mindmap` | Une idée et ses branches | items avec `children` |
| `flow` | Des décisions et des chemins | `relations` |
| `stats` | Des chiffres clés | 2–6 items, tous avec `value` |

Les graphiques de données (`bar`, `line`, `donut`) existent déjà dans
`snippets/Charts.ts` (5 composants) : en v1 ils deviennent des familles
`chart-*` qui les enveloppent, et réclament `value` sur chaque item.

V2 (vers 30) : `venn`, `quadrant-icons`, `roadmap` (couloirs), `org`, `tree`,
`table`, `before-after`, `iceberg`, `onion` (cercles concentriques), `gauge`,
`progress`, `quote-card`, `checklist`, `swot`, `kanban-mini`, `map-pins`
(sans carte réelle), `layers`, `bridge`.

Chaque famille a des **variantes de forme** (cartes, pastilles, ligne,
contour) — c'est la réponse au « tout se ressemble » : la variété vient de
famille × variante × direction du projet, pas d'un modèle qui improvise.

## 4. Fichiers proposés

```
src/lib/visuals/schema.ts        VisualDoc, Family, bornes, accepts() par famille
src/lib/visuals/families.ts      le catalogue : id, variantes, prédicats, phrase pour la carte du modèle
src/lib/visuals/layout.ts        la géométrie PURE de chaque famille (boîtes, ancres, connecteurs) — testable sans DOM
src/lib/visuals/theme.ts         direction/marque → rôles de couleur (fond, encre, accent, surfaces), contraste mesuré
src/lib/visuals/numbers.ts       vérification des chiffres contre le texte source (§6)
src/lib/visuals/generate.ts      l'appel 'visual' : prompt, extraction JSON, validation, un nouvel essai sur refus
src/lib/capabilities/snippets/Visual.ts   le composant <Visual> pour l'iframe (lit layout.ts sérialisé, comme Ornament)
src/lib/capabilities/snippets/IconsLucide.ts  ou extension de Icons.ts — décision au §0
src/components/VisualPicker.tsx  les 3–4 propositions, le sélecteur de famille et de variante
server/visuals/schema.js         miroir Node du schéma (pour le MCP), tenu par un corpus commun
```

Le partage entre `layout.ts` (TS) et le snippet (chaîne injectée) suit le
modèle d'`Ornament`/`ShapeFrame` : le catalogue est la seule source, le snippet
le reçoit en JSON. Un **troisième** miroir à la main (`server/visuals/schema.js`)
n'est acceptable que tenu par un test de corpus, comme `timeline.test.js`.

## 5. La génération

- **Un appel**, purpose `visual` — à ajouter dans `PURPOSES`
  (`server/admin/activity.js`), `COUNTED_PURPOSES` (`server/plan.js`) et
  `dashboard.action.*`.
- Entrée : le texte de la personne, en DONNÉE dans le tour utilisateur (Q5),
  plus l'orientation voulue (`square`, `landscape`, `portrait`, `auto`) et le
  niveau de détail (`summary`, `detailed`).
- Sortie : un `VisualDoc` + 1 à 4 `Proposals`. Les propositions sont toutes
  rendues immédiatement : ce ne sont que des props sur le même document.
- Refus du schéma → **un** nouvel essai avec l'erreur nommée, puis
  dégradation : la famille la plus permissive (`steps`) sur ce qui a validé,
  avec une notice (Q1). Jamais de boucle.
- Muse éteint : rien ne change ailleurs (M1). Muse allumé : la direction du
  dossier fournit le thème ; le dossier n'est pas lancé pour un visuel seul
  (coût disproportionné), à rediscuter.
- Le planner et Motion Ultra ne tournent pas pour un écran « Visuel ».

## 6. Ce qui est vérifié sans modèle

1. **Les chiffres.** Tout `value.n` doit apparaître dans le texte source, aux
   formats près (`1 200`, `1,2 k`, `12 %` / `0,12`). Un chiffre introuvable est
   signalé sur l'élément et **jamais affiché comme une donnée** : l'item reste,
   sa valeur est retirée, la notice le dit. C'est la faiblesse de Napkin
   transformée en garantie.
2. **Le débordement.** `layout.ts` calcule les boîtes ; le texte est mesuré
   dans la frame (même mécanique que `measureOverflowIn`) et la taille de type
   est descendue par famille jusqu'à un plancher, puis l'item est tronqué au
   `detail` (jamais au `label`). Les règles des films valent ici aussi : un mot
   n'est jamais coupé en deux (`wordCeiling`), un rôle inférieur n'est jamais
   aussi grand qu'un rôle supérieur.
3. **Le contraste.** Chaque rôle de texte est mesuré contre la surface où il
   est peint (4,5 / 3), avec réparation par les couleurs du thème avant le noir
   ou le blanc — le principe de `legibleOn`.
4. **L'invention.** Un `pros-cons` dont aucun item n'a d'appui dans le texte
   (TechCrunch a vu Napkin inventer des pour/contre) : avertissement, pas de
   refus. Mesure par recouvrement lexical, à calibrer sur un corpus.

## 7. L'édition sans modèle

- **Changer de famille / de variante / d'orientation** : un changement de
  props, écrit aux offsets du parseur (I1), `previousCode` pour Revenir.
- **Modifier un texte** : `sourceText.ts` et le mécanisme de `fillFields`
  s'appliquent tels quels, puisque le contenu est un littéral dans le code.
- **Réordonner, ajouter, supprimer un item** : réécriture du littéral `doc`,
  pas de `planMove` (les items ne sont pas des éléments JSX distincts).
- **Changer une icône** : sélecteur avec recherche dans l'énumération.
- **Verrous** : `data-mocky-lock` sur `<Visual>` empêche toute passe de le
  réécrire, comme ailleurs.
- **Modifier par une phrase** (« ajoute une étape ») : passe `edit` ordinaire,
  à laquelle on demande de rendre un `VisualDoc`, pas du code. À trancher : un
  sixième passage de correction séparé, ou une branche de `editComponent`.

## 8. Les points d'entrée

1. **Phase 1 — type d'écran `visual`** dans `SCREEN_THEMES`, avec
   `document: { page: … }` sur les formats existants (`social-square`,
   `social-landscape`, `social-portrait`, `slides`) plus un fond transparent à
   l'export. Le composeur reçoit le texte ; la réponse est l'écran plus le
   sélecteur de propositions.
2. **Phase 2 — « Illustrer un texte »** : une vue document (texte à gauche ou
   en colonne, un bouton par paragraphe ou sélection), dont chaque visuel est
   un écran du projet. Import par `pdfImport.ts` (existe), MD et DOCX à
   ajouter. C'est la reprise directe de l'interface de Napkin.
3. **Phase 2 — dans les autres écrans** : `<Visual>` devient un pack proposé
   à la génération des types `report`, `documentation`, `article`, `slides`,
   `instagram`, `linkedin`. Le modèle écrit alors `<Visual family doc>` dans
   sa page ; la vérification des chiffres s'applique sur le prompt.
4. **Phase 3 — campagne et film** : un visuel décliné aux formats d'une
   campagne (même `VisualDoc`, orientation par format) ; un visuel transformé
   en film `composed` (mapping famille → blocs existants, `stats` → `counter`,
   `timeline` → séquence de scènes).

## 9. Les exports

| Format | État | À faire |
|---|---|---|
| PNG, PDF | Existe | Fond transparent en option |
| SVG | Existe en calques (`docExport/layers.ts`) | Un SVG « propre » d'un seul visuel, texte en `<text>` |
| .pptx « image sous les mots » | Existe | Rien |
| .pptx « tout en éléments séparés » | Existe (`decompose.ts`) | **Un `<svg>` y devient une image.** Soit les familles dessinent boîtes et pastilles en HTML (déjà décomposées en formes) et gardent le SVG pour les seuls connecteurs ; soit `decompose.ts` apprend les chemins SVG simples → `custGeom`. Première option en v1 |
| .pptx natif par famille | — | Phase 3 : écrire chaque famille directement en formes DrawingML depuis `layout.ts` (connecteurs reliés, groupes), sans passer par la page. C'est ce qui battrait Napkin sur PowerPoint |
| Google Slides | — | Pas prévu : le .pptx s'importe |

## 10. MCP

Un outil `create_visual` (écrivain, pas dans `READ_TOOLS`, X9) : `text`,
`project?`, `families?` (1–4), `orientation?`, `detail?`, `brand?`. Il passe
par le runner comme `create_design`, avec un job `visual`. Un outil
`list_visual_families` en lecture. Le guide (`server/mcp/guide.js`) et les
prompts reçoivent un paragraphe. Pas de `style_id` : le style d'un visuel
Mocky est celui du projet, c'est la différence assumée avec Napkin.

## 11. Invariants proposés (série G)

À écrire dans `docs/architecture/invariants.md` (+ `docs/fr/`) quand la phase 1
est livrée, chacun avec le bug qu'il évite :

- **G1 — Le modèle ne dessine pas un visuel.** Il rend un `VisualDoc` validé
  `.strict()` ; tout `<svg>` libre dans un écran `visual` est retiré.
- **G2 — Le contenu ne dépend pas de la famille.** Changer de famille ne
  déclenche aucun appel et ne perd aucun champ ; une famille qui ne peut pas
  afficher un champ le dit.
- **G3 — Un chiffre affiché est un chiffre du texte.** Sinon il n'est pas
  affiché comme donnée.
- **G4 — Les couleurs d'un visuel sont celles du projet**, mesurées ; le
  modèle n'en écrit aucune.
- **G5 — Un visuel s'exporte éditable** : en .pptx « éléments séparés », chaque
  boîte et chaque texte d'un visuel est une forme, pas une image.

## 12. Phases

| Phase | Contenu | Fini quand |
|---|---|---|
| **1** | Schéma + miroir Node ; 12 familles + `chart-*` ; `<Visual>` ; type d'écran `visual` ; appel `visual` ; sélecteur (propositions, famille, variante, orientation) ; vérification des chiffres ; contraste ; icônes Lucide ; exports existants avec familles en HTML | Un corpus de 20 textes (`bench/visuals/`) donne pour chacun ≥ 2 propositions lisibles, zéro chiffre inventé affiché, zéro débordement mesuré, .pptx décomposé sans image sauf connecteurs |
| **2** | Vue « Illustrer un texte » ; import MD/DOCX ; `<Visual>` dans les autres types ; édition par phrase ; 30 familles | Un article de 1 500 mots illustré paragraphe par paragraphe, sans consigne |
| **3** | `create_visual` MCP ; .pptx natif par famille ; déclinaison campagne ; visuel → film | Un visuel créé depuis Claude par MCP s'ouvre dans PowerPoint avec ses connecteurs reliés |

## 13. Tests

- `schema.test.ts` + `server/visuals/schema.test.js` : un corpus, deux
  implémentations, réponses identiques (défauts compris).
- `layout.test.ts` : pour chaque famille, sur des documents extrêmes (1 item,
  12 items, libellés longs, un mot de 30 lettres), aucune boîte ne sort du
  cadre, aucune ne se chevauche, et le contenu remplit au moins une part
  donnée du cadre (le « petit objet dans un grand vide » des films).
- `numbers.test.ts` : formats FR/EN, pourcentages, milliers, unités, chiffres
  en toutes lettres (non reconnus en v1, documenté).
- `families.test.ts` : chaque famille a sa phrase FR et EN dans
  `src/i18n/parts/`, chaque prédicat `accepts` refuse au moins un document.
- Contraste : balayage de toutes les familles × variantes sur une douzaine de
  directions réelles, comme `composition.test.js`.
- Exports : `decompose` sur un écran par famille, nombre d'images résiduelles
  borné.

## 14. Documentation

`docs/visuals.md` + `docs/fr/visuals.md` (avec `source_hash` tamponné),
entrée dans `docs/documents.md` (« Les types »), `docs/mcp.md` en phase 3,
`CHANGELOG.md`, section dans `CLAUDE.md` une fois les pièges connus — pas
avant.

## 15. Risques et questions ouvertes

- **Rendu générique.** Le catalogue fermé produit, par construction, des
  formes connues. Contrepoids : la direction du projet, les variantes, et des
  familles dessinées avec soin. À juger sur le corpus, pas sur un exemple.
- **Textes denses.** Napkin rate la prose dense ; nous aussi a priori. Piste :
  demander au modèle un résumé en items AVANT la famille (même appel), et
  afficher ce résumé pour correction.
- **Coût des icônes.** Quelques centaines de SVG dans le prelude de chaque
  écran `visual` : ne charger que les icônes nommées par le document, comme
  `fontFaceCssFor` ne déclare que les polices nommées.
- **Édition par phrase** : sixième passage ou branche d'`editComponent` (§7).
- **Muse** : lancer ou non le dossier pour un visuel seul (§5).
- **Nom de la série d'invariants** : G est libre à ce jour, à confirmer.
