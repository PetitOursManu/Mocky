# Muse — vue d'ensemble

## L'étoile polaire

Un modèle à qui l'on demande « une landing page moderne pour une application de
gestion de tâches » produit toujours la même page. Dégradé violet-vers-bleu sur
fond sombre, titre centré, sous-titre, deux boutons, trois cartes identiques avec
une icône générique, bandeau « Trusted by » en rectangles gris. Ce n'est pas un
défaut de rendu : c'est le centre de gravité de l'entraînement.

**Muse est la passe qui déplace ce centre de gravité.** Un interrupteur, à côté du
prompt, et Mocky construit d'abord une **direction artistique** — puis génère
l'écran à partir d'elle plutôt qu'à partir du prompt nu.

Ce qui change concrètement :

| Sans Muse | Avec Muse |
|---|---|
| Le modèle invente une palette | Une palette cohérente, tracée jusqu'à ses références |
| Copie générique, souvent en anglais | De la vraie copie, dans la langue de la demande |
| Aucune image, ou des aplats | Une image générée, servie depuis l'origine de Mocky |
| Aucune mémoire du « pourquoi » | Un `DESIGN-DOSSIER.md` citant ce qui a inspiré quoi |
| Rien n'interdit les clichés | Une liste noire versionnée, et une autocritique |

Muse a besoin du backend. En mode `localStorage` pur, l'interrupteur est masqué —
il ne doit jamais **paraître** fonctionner en ne faisant rien.

---

## Les quatre étapes

Muse est un pipeline **serveur**, exposé par `POST /api/muse/dossier`, orchestré
par `server/muse/inspire/engine.js`.

```
prompt ──► Discover ──► Distill ──► Dossier ──► (Affinage) ──► Markdown
             ▲            ▲           ▲             ▲
     registre + URL    1 LLM/page   1 LLM       1 LLM, ≤1 reprise
     via MCP fetch     zod, ≤6      zod         note + révision
```

### 1. Discover — rassembler l'inspiration

La demande est classée en étiquettes (`landing`, `saas`, `restaurant`,
`fintech`…) par simple correspondance de mots-clés — **sans LLM**, donc testable et
utilisable hors ligne. Ces étiquettes sélectionnent des galeries dans un registre
curaté (`sources.json`), auxquelles s'ajoutent les URL que l'utilisateur a collées.
**Les URL de l'utilisateur passent en premier** : ses références gagnent toujours
une place dans le quota.

Les pages sont récupérées par un **serveur MCP local et gratuit** — `fetcher-mcp`,
qui est du Playwright + Readability. Cette étape est **facultative** : elle ne
tourne que si l'utilisateur coche « Inspiration live ». Sinon, Muse va directement
au dossier avec sa bibliothèque de patterns hors ligne.

### 2. Distill — en faire du vocabulaire

Chaque page devient une *InspirationCard* structurée : palette (6 max), adjectifs
de style, sensation typographique, grammaire de mise en page, notes de mouvement,
ton du contenu, et clichés à éviter.

L'instruction est explicite : extraire du **vocabulaire et de la grammaire
structurelle**, jamais copier un design, un titre ou un asset précis. Si un champ
identifierait une seule source exacte, il doit être généralisé.

### 3. Dossier — écrire la direction artistique

Le **Design Dossier** est un **sur-ensemble strict de `DESIGN.md`**. Sa section
`## Tokens` est écrite dans le format `DESIGN.md` exact, si bien que
`src/lib/design.ts`, `designTokens.ts` et toute la chaîne d'export continuent de
fonctionner sans modification. Autour, Muse ajoute :

| Section | Contenu |
|---|---|
| `## Concept` | 2–3 phrases de direction artistique **spécifique** ; « moderne, propre, professionnel » est banni |
| `## References` | Quelle référence ou quel pattern a motivé quel choix |
| `## Tokens` | Palette (6–8 couleurs), typographie, rayon — **format `DESIGN.md`** |
| `## Layout Grammar` | La grammaire de composition |
| `## Motion Language` | Le langage de mouvement |
| `## Voice & Copy` | Titre, sous-titre, 3 arguments, libellés d'action, pied de page — **dans la langue de la demande** |
| `## Imagery Plan` | Les emplacements d'images, avec un prompt de génération prêt à l'emploi |
| `## Forbidden` | Les clichés à ne pas produire, pour **ce** projet |

La traçabilité n'est pas décorative : demander au modèle de **citer** ce qui a
motivé chaque choix est une pression vers l'originalité.

### 4. Affinage — l'autocritique de distinction

Une passe LLM bon marché note le dossier et le révise **au plus une fois**. Elle
est facultative, silencieuse en cas d'échec, et ne bloque jamais.

Le résultat est rendu en `DESIGN-DOSSIER.md`, injecté dans la génération comme
`extraSystem` — **exactement là où `DESIGN.md` allait déjà** (invariant M1).

Le détail complet de chaque étape est dans
[Moteur d'inspiration](muse/inspiration-engine.md).

---

## Comment le dossier pilote la génération

`buildMusePreamble()` (`src/lib/muse.ts`) transforme le dossier en préambule.
Trois ajouts au Markdown brut méritent d'être expliqués, parce qu'ils corrigent
chacun un échec observé.

### La palette, réénoncée en classes

Le dossier liste déjà ses couleurs — en hexadécimal, en prose, au milieu d'un long
bloc Markdown. Deux choses tournaient mal à chaque fois : les règles de base
nommaient des familles Tailwind concrètes (« slate/indigo/emerald/amber/rose »),
ce qui est une instruction bien plus actionnable qu'une liste d'hexadécimaux ; et
rien ne disait **comment** appliquer un hexadécimal avec Tailwind. Le modèle
retombait donc tranquillement sur indigo-et-slate, et les écrans ignoraient la
direction artistique.

D'où :

```
- Accent (primary): #cc4b2f → bg-[#cc4b2f] · text-[#cc4b2f] · border-[#cc4b2f]
```

Il n'y a plus rien à traduire, et l'instruction est devenue plus concrète que celle
qu'elle doit battre.

### Le rayon, énoncé sans échappatoire

> RADIUS — utilisez `rounded-none` comme traitement d'angle partout, **y compris
> quand cela signifie des angles droits**. Ne l'adoucissez pas.

Un modèle à qui l'on donne `rounded-none` arrondit quand même « pour faire plus
moderne » si la phrase laisse la moindre marge.

### La séquence au défilement, énoncée en premier

Elle est déclarée **avant** les images et en termes plus forts, parce qu'elle
décide de la **forme** de l'écran et non du remplissage d'un emplacement : le héros
cesse d'être un bloc contenant une image pour devenir une section épinglée que le
visiteur traverse. Un modèle informé en passant écrit un héros normal et pose
`<ScrollSequence>` quelque part sous la ligne de flottaison — le seul endroit où
l'effet ne peut pas fonctionner.

---

## Les trois modes d'image

L'image générée peut servir à trois choses différentes, et c'est un choix explicite
dans le panneau Muse.

| Mode | L'image est… | Vision requise ? | Profil de modèle |
|---|---|---|---|
| `content` | posée dans l'écran en `<img>` | non | `content` |
| `inspiration` | montrée au modèle, **jamais** posée | oui | `inspiration` |
| `both` | montrée **et** posée — une seule image | oui | `content` |

La préférence enregistrée n'est jamais modifiée en silence : si le modèle actif n'a
pas la vision, **ce run** dégrade en `content` et le réglage reste tel quel.

### Pourquoi `inspiration` ne génère pas la même image que `content`

C'était le cas au départ, et c'est pour cela que le mode « ne changeait souvent
rien » : une image d'inspiration était générée à partir du prompt du plan
d'imagerie — donc exactement le même sujet photographique que le héros, simplement
routé vers un autre modèle. Ce n'est pas une référence de direction artistique,
c'est une deuxième photo de héros. On tendait au modèle une image du produit en lui
demandant d'y lire sa palette et sa composition.

Une **planche de référence** est un objet différent : pas de sujet, pas de récit,
juste la palette, la matière et la lumière. `buildInspirationPrompt()` la construit
à partir des jetons du dossier lui-même :

> An abstract art-direction reference plate. […] Composition: large flat colour
> fields, generous negative space, one clear focal area, a subtle paper or fabric
> texture, soft directional light. It is a MOOD BOARD PLATE, not a picture of a
> product: no people, no objects, no scene, no story.

Le canevas enregistre `imageRole` sur l'écran (`content` / `inspiration` / `both`),
parce que le badge ne disait que « Image Muse » : il était impossible de vérifier
que le mode inspiration avait fait quoi que ce soit.

---

## Muse conçoit *à partir de* vos médias

Sélectionner une image ou une séquence dans la bibliothèque ne se contente pas de
remplir un emplacement : le média est lu **avant** l'écriture du dossier, et le
dossier est construit autour.

Deux canaux, parce qu'ils échouent différemment :

- **La palette est mesurée sur les pixels** (`src/lib/palette.ts`). Exacte, et ça
  marche sur **tous** les modèles. Demander à un modèle de vision de décrire les
  couleurs échoue deux fois : la moitié des modèles auto-hébergés n'ont pas de
  vision du tout, et ceux qui en ont renvoient des **noms** (« terracotta chaud »)
  qu'il faut ensuite retraduire en hexadécimal à l'aveugle.
- **L'image elle-même** n'est jointe que si le modèle voit. Elle porte ce qu'un
  histogramme ne peut pas dire : le sujet, la composition, la densité, la lumière.

Les hexadécimaux mesurés sont déclarés comme **écrasant** les palettes suggérées
par les patterns et les références :

> RULES — these override the palettes suggested by any pattern or reference above.
> […] Do NOT introduce a colour family that is absent from this list. A page whose
> palette disagrees with its own hero image is the failure this section exists to
> prevent.

Sans cette phrase, le modèle accuse poliment réception de l'image puis utilise
quand même l'indigo du pattern — précisément l'échec que la fonctionnalité existe
pour corriger.

Le bloc média est assaini avant d'atteindre un prompt ou un fournisseur
(`sanitizeUserMedia()`) : la palette doit être de l'hexadécimal `#rrggbb` — pas
seulement « une chaîne » —, au plus 8 échantillons, et l'image n'est acceptée que
comme data-URL base64 `jpeg|png|webp` d'au plus 1 500 000 caractères, c'est-à-dire
une référence réduite et pas un envoi de fichier.

---

## La vidéo au défilement

Muse peut générer un **clip pour le héros** et laisser le visiteur le parcourir à
la molette : le clip avance image par image, épinglé sur toute la hauteur, et
repart en arrière quand on remonte.

C'est **désactivé par défaut** et redemandé à chaque fois, parce que contrairement
à toutes les autres options de Muse, celle-ci a un prix à l'usage et ajoute des
minutes à une génération. Personne ne doit la découvrir en ayant laissé une case
cochée.

**Le clip n'est jamais lu comme une vidéo.** `ffmpeg` le découpe en séquence JPEG
(12 i/s, 960 px de large, plafonné à 150 images) et l'écran dessine ces images sur
un canvas. Deux raisons :

1. Faire avancer `video.currentTime` depuis un gestionnaire de défilement paraît
   juste en démo et saccade en pratique : le navigateur doit décoder depuis
   l'image-clé la plus proche à chaque saut, et un clip généré en a très peu.
2. Des images sont des **images** — donc l'aperçu en bac à sable n'a besoin
   d'**aucune** source média, et sa CSP ne bouge pas d'un pouce pour supporter la
   fonctionnalité.

Le taux d'échantillonnage est **fixe**, pas le nombre d'images : extraire
« exactement 60 images réparties sur le clip » demanderait de connaître sa durée,
donc une passe de sondage. À 12 i/s, un clip de 5 s donne 60 images, un clip de
3 s en donne 36, et les deux se parcourent identiquement parce que la séquence est
pilotée par la **progression**, pas par le temps. Le plafond de 150 est ce qui
empêche un clip surprise de 30 s d'écrire 400 fichiers.

L'affiche (`poster.jpg`) est la première image **copiée**, pas ré-encodée : c'est
ce que l'écran montre avant la fin du préchargement, et elle doit être identique à
l'octet près à l'image 1 pour qu'il n'y ait pas de saut visible.

Le composant `<ScrollSequence>` dessine l'image chargée **la plus proche** de celle
demandée plutôt que d'attendre que toutes soient là : soixante images sont soixante
requêtes, et bloquer la section jusqu'à la dernière laisserait un trou d'une
seconde ou deux sur un cache froid.

Les séquences vivent dans `data/video-library/`, adressées par le SHA-256 du clip :
une demande identique réutilise la séquence au lieu de la payer deux fois.

---

## Anti-slop

Cinq mécanismes, tous actifs :

1. **Une liste noire versionnée** — `server/muse/anti-slop.json`, 18 clichés
   nommés, injectés dans le prompt du dossier et fusionnés avec la liste `avoid` de
   chaque carte d'inspiration. Extraits :

   > dégradés violet-vers-bleu en diagonale sur fond sombre · trois cartes de
   > fonctionnalités identiques avec une icône générique, un titre et une phrase ·
   > bandeau de faux logos « Trusted by » en rectangles gris · l'emoji utilisé
   > comme icône d'interface · le même rayon de bordure sur absolument tout

2. **Le contenu d'abord** — la section *Voice & Copy* est demandée avant la mise en
   page. Une page écrite autour de sa copie ne ressemble pas à une page où l'on a
   versé de la copie.

3. **Un lint post-génération** — `lintSlop()` cherche `lorem ipsum`, « Sample
   text », « Your text/content here », « Content goes here », « Placeholder text ».
   Le prompt système l'interdisait déjà ; ceci le rend **constaté**. Une violation
   n'annule pas l'écran : elle est signalée pour qu'on régénère.

4. **L'autocritique de distinction** — une note, et au plus une révision.

5. **La bibliothèque de patterns hors ligne** — 18 directions artistiques écrites à
   la main, chacune avec ses semences de jetons compatibles `DESIGN.md`. Elle sert
   de repli quand l'inspiration live est indisponible, et se mélange aux cartes
   sinon.

---

## Éthique et conditions d'utilisation

Muse est construit pour respecter les sites dont il apprend.

- **Aucun moissonnage massif.** Uniquement les pages du registre curaté et les URL
  que vous collez, plafonnées à **6 récupérations par run**, en honorant
  `robots.txt`, avec un User-Agent honnête (`Mocky-Muse/…`) et un cache de 7 jours
  **exclusivement textuel**.
- **Aucune image tierce n'est jamais stockée, mise en cache, proxifiée ni
  affichée.** Seules les images générées par Mocky et les distillations textuelles
  persistent — et `MuseCache` **lève** si on lui passe autre chose que du texte.
- **L'inspiration, c'est du vocabulaire et de la grammaire structurelle**, jamais
  la copie d'un design précis.
- **Le contenu web récupéré est traité comme de la donnée non fiable**, jamais
  comme des instructions.
- Toutes les URL sortantes passent la garde SSRF, et le chemin par défaut ne
  demande **aucune clé, aucun compte**.

Ces cinq points sont les invariants M2, M4, M5 et M7 —
voir [Invariants](architecture/invariants.md).

---

## Le cas Higgsfield

Higgsfield.ai n'a pas d'API gratuite, donc il n'est pas intégré. Le contournement
est manuel et fonctionne : générez l'image sur Higgsfield, téléchargez-la, déposez
-la dans la bibliothèque média de Mocky et épinglez-la. Muse l'utilisera comme
n'importe quelle autre image — c'est-à-dire en mesurant sa palette et en écrivant
le dossier autour d'elle.

---

## Note sur les dépendances

Le SDK MCP tire quelques paquets transitifs signalés par `npm audit` (`hono`,
`body-parser`, `shell-quote`, `esbuild`). Tous sont dans le **transport HTTP** du
SDK, que Mocky **n'utilise pas** : Mocky est un client stdio. La CI exécute
`npm audit --omit=dev --audit-level=high`, c'est-à-dire sur les dépendances de
production uniquement — les avis du serveur de développement (Vite, esbuild) ne
concernent pas un déploiement, où Express sert le `dist/` construit.
