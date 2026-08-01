# Vue d'ensemble de Muse

## Le problème que Muse résout

Demandez à un modèle « une landing page moderne pour un gestionnaire de tâches »
et vous obtenez toujours la même page. Un dégradé violet vers bleu sur fond
sombre, un titre centré, un sous-titre, deux boutons, trois cartes identiques
avec des icônes génériques, et un bandeau de logos gris marqué « Trusted by ».

Ce n'est pas un défaut d'affichage. C'est le centre de gravité des données
d'entraînement.

**Muse déplace ce centre de gravité.** Un interrupteur à côté du prompt, et Mocky
construit d'abord une **direction artistique**, puis génère l'écran à partir
d'elle plutôt qu'à partir du prompt nu.

| Sans Muse | Avec Muse |
|---|---|
| Le modèle invente une palette | Une palette cohérente, dont on sait d'où elle vient |
| De la copie générique, souvent en anglais | De la vraie copie, dans la langue de la demande |
| Aucune image, ou des aplats de couleur | Une image générée, servie depuis l'origine de Mocky |
| Aucune trace du raisonnement | Un `DESIGN-DOSSIER.md` qui cite ce qui a inspiré quoi |
| Rien n'empêche les clichés | Une liste noire versionnée et une passe d'autocritique |

Muse a besoin du back-end. En mode `localStorage` pur, l'interrupteur est masqué :
il ne doit jamais *sembler* fonctionner tout en ne faisant rien.

---

## Les quatre étapes

Muse est un pipeline **côté serveur**, exposé par `POST /api/muse/dossier` et
orchestré par `server/muse/inspire/engine.js`.

| # | Étape | Appels au modèle | Facultative ? |
|---|---|---|---|
| 1 | **Discover** — rassembler l'inspiration | Aucun | Oui, seulement si « inspiration live » est coché |
| 2 | **Distill** — transformer les pages en vocabulaire | Un par page, 6 au maximum | Ne tourne que si Discover a trouvé quelque chose |
| 3 | **Dossier** — écrire la direction artistique | Un, avec une seconde tentative | Non, mais dégrade vers un dossier déterministe |
| 4 | **Refine** — autocritique | Une note, au plus une révision | Oui |

### 1. Discover

La demande est classée en étiquettes — `landing`, `saas`, `restaurant`,
`fintech`, etc. — par simple correspondance de mots-clés. **Aucun appel au
modèle**, donc c'est testable et ça marche hors ligne.

Ces étiquettes sélectionnent des galeries dans un registre choisi à la main
(`sources.json`), et les URL collées par l'utilisateur s'y ajoutent. **Les URL de
l'utilisateur passent en premier** : ses propres références obtiennent toujours
une place dans le quota.

Les pages sont récupérées par un **serveur MCP local et gratuit** :
`fetcher-mcp`, qui est du Playwright plus Readability.

Cette étape est **facultative**. Elle ne tourne que si l'utilisateur coche
« inspiration live ». Sinon, Muse passe directement au dossier en utilisant sa
bibliothèque de patterns hors ligne.

### 2. Distill

Chaque page devient une *InspirationCard* structurée : une palette de six
couleurs au maximum, des adjectifs de style, une sensation typographique, une
grammaire de mise en page, des notes de mouvement, un ton de contenu, et des
clichés à éviter.

L'instruction est explicite : extraire du **vocabulaire et de la grammaire
structurelle**, jamais copier un design, un titre ou un visuel précis. Si un
champ permettait d'identifier une source exacte, il doit être généralisé.

### 3. Dossier

Le **dossier de design** est un **sur-ensemble strict de `DESIGN.md`**. Sa
section `## Tokens` utilise exactement le format de `DESIGN.md`, ce qui laisse
`src/lib/design.ts`, `designTokens.ts` et toute la chaîne d'export fonctionner
sans modification.

Autour, Muse ajoute :

| Section | Contenu |
|---|---|
| `## Concept` | Deux ou trois phrases de direction artistique **précise**. « Moderne, propre, professionnel » est banni |
| `## References` | Quelle référence ou quel pattern a motivé quel choix |
| `## Tokens` | Une palette de 6 à 8 couleurs, la typographie, le rayon des angles — au format `DESIGN.md` |
| `## Layout Grammar` | Les règles de composition |
| `## Motion Language` | Le vocabulaire de mouvement |
| `## Voice & Copy` | Titre, sous-titre, trois arguments, libellés de boutons, pied de page — **dans la langue de la demande** |
| `## Imagery Plan` | Les emplacements d'images, chacun avec un prompt de génération prêt à l'emploi |
| `## Forbidden` | Les clichés à éviter, pour **ce** projet |

Demander au modèle de **citer** ce qui a motivé chaque choix n'est pas
décoratif : la traçabilité est une pression vers l'originalité.

### 4. Refine

Un appel de modèle bon marché note le dossier et le révise **au plus une fois**.
C'est facultatif, silencieux en cas d'échec, et ça ne bloque jamais.

Le résultat est rendu en `DESIGN-DOSSIER.md` puis injecté dans la génération
comme `extraSystem` — **exactement là où `DESIGN.md` allait déjà** (invariant
M1).

Le détail complet est dans la page
[moteur d'inspiration](fr/muse/inspiration-engine.md).

---

## Comment le dossier pilote la génération

`buildMusePreamble()`, dans `src/lib/muse.ts`, transforme le dossier en
préambule. Trois ajouts au Markdown brut méritent d'être expliqués, parce que
chacun corrige un échec observé.

### La palette, réécrite en classes

Le dossier liste déjà ses couleurs, en hexadécimal, en prose, au milieu d'un long
bloc Markdown. Deux choses tournaient mal à chaque fois.

Les règles de base nommaient des familles Tailwind concrètes — « slate, indigo,
emerald, amber, rose » — ce qui est une instruction bien plus applicable qu'une
liste de valeurs hexadécimales. Et rien ne disait **comment** appliquer une
valeur hexadécimale avec Tailwind.

Le modèle retombait donc tranquillement sur indigo-et-slate, et les écrans
ignoraient la direction artistique.

Le correctif réécrit chaque couleur sous forme de classes à copier :

```
- Accent (primary): #cc4b2f → bg-[#cc4b2f] · text-[#cc4b2f] · border-[#cc4b2f]
```

Il n'y a plus rien à traduire, et l'instruction est maintenant plus concrète que
celle qu'elle doit remplacer.

### Le rayon, énoncé sans échappatoire

> RADIUS — utilisez `rounded-none` comme traitement d'angle partout, **y compris
> quand cela veut dire des angles droits**. Ne l'adoucissez pas.

Avec `rounded-none`, un modèle arrondira quand même les angles « pour faire plus
moderne » si la phrase lui laisse la moindre marge.

### La séquence au défilement, énoncée en premier

Elle vient **avant** les images et en termes plus forts, parce qu'elle décide de
la **forme** de l'écran au lieu de remplir un emplacement. Le visuel principal
cesse d'être un bloc contenant une image pour devenir une section fixée que le
visiteur traverse en défilant.

Un modèle informé en passant écrit un visuel principal normal et pose
`<ScrollSequence>` quelque part plus bas dans la page — le seul endroit où
l'effet ne peut pas fonctionner.

---

## Les trois modes d'image

L'image générée peut servir à trois choses différentes, et c'est un choix
explicite dans le panneau Muse.

| Mode | L'image est… | Vision requise ? | Profil d'image |
|---|---|---|---|
| `content` | posée dans l'écran dans une `<img>` | Non | `content` |
| `inspiration` | montrée au modèle, **jamais** posée | Oui | `inspiration` |
| `both` | montrée **et** posée — une seule image, un seul coût | Oui | `content` |

La préférence enregistrée n'est jamais modifiée en silence. Si le modèle actif
n'a pas la vision, **ce passage-là** dégrade en `content`, et le réglage reste
tel quel.

### Pourquoi `inspiration` ne génère pas la même image que `content`

C'était le cas au départ, et c'est pour cela que le mode « ne changeait souvent
rien ».

Une image d'inspiration était générée à partir du prompt du plan d'imagerie,
c'est-à-dire le même sujet photographique que le visuel principal, simplement
envoyé à un autre modèle. Ce n'est pas une référence de direction artistique,
c'est une deuxième photo de visuel principal. On tendait au modèle une image du
produit en lui demandant d'y lire sa palette et sa composition.

Une **planche de référence** est un autre objet : pas de sujet, pas de récit,
juste la palette, la matière et la lumière. `buildInspirationPrompt()` la
construit à partir des jetons du dossier lui-même :

> An abstract art-direction reference plate. […] Composition: large flat colour
> fields, generous negative space, one clear focal area, a subtle paper or fabric
> texture, soft directional light. It is a MOOD BOARD PLATE, not a picture of a
> product: no people, no objects, no scene, no story.

Le canevas enregistre `imageRole` sur l'écran : `content`, `inspiration` ou
`both`. Le badge n'affichait auparavant que « image Muse », ce qui rendait
impossible de vérifier que le mode inspiration avait fait quoi que ce soit.

---

## Concevoir à partir de vos propres médias

Choisir une image ou une séquence dans la bibliothèque ne se contente pas de
remplir un emplacement. Le média est lu **avant** l'écriture du dossier, et le
dossier est construit autour de lui.

Il y a deux canaux, parce qu'ils échouent différemment.

**La palette est mesurée sur les pixels** (`src/lib/palette.ts`). Elle est
exacte, et elle fonctionne avec **tous** les modèles.

Demander à un modèle de vision de décrire les couleurs échoue deux fois : la
moitié des modèles que les gens hébergent eux-mêmes n'ont pas de vision du tout,
et ceux qui en ont renvoient des **noms** (« terracotta chaud ») qu'il faut
ensuite retraduire en hexadécimal à l'aveugle.

**L'image elle-même** n'est jointe que si le modèle peut la voir. Elle porte ce
qu'un histogramme ne peut pas dire : le sujet, la composition, la densité, la
lumière.

Les valeurs hexadécimales mesurées sont déclarées comme **prioritaires** sur les
palettes proposées par les patterns et les références :

> RULES — these override the palettes suggested by any pattern or reference
> above. […] Do NOT introduce a colour family that is absent from this list. A
> page whose palette disagrees with its own hero image is the failure this
> section exists to prevent.

Sans cette phrase, le modèle accuse poliment réception de l'image puis utilise
quand même l'indigo du pattern — exactement l'échec que la fonctionnalité existe
pour corriger.

Le bloc média est nettoyé avant d'atteindre le moindre prompt ou fournisseur.
Voir `sanitizeUserMedia()` dans la page
[moteur d'inspiration](fr/muse/inspiration-engine.md).

---

## La vidéo au défilement

Muse peut générer un **clip pour le visuel principal** et laisser le visiteur le
parcourir à la molette. Le clip avance image par image, fixé sur toute la
hauteur, et repart en arrière quand on remonte.

C'est **désactivé par défaut** et redemandé à chaque fois. Contrairement à toutes
les autres options de Muse, celle-ci a un prix à l'usage et ajoute des minutes à
une génération. Personne ne doit le découvrir en ayant laissé une case cochée.

### Le clip n'est jamais lu comme une vidéo

`ffmpeg` le découpe en séquence JPEG — 12 images par seconde, 960 px de large,
plafonné à 150 images — et l'écran dessine ces images sur un canvas. Deux
raisons :

1. Faire avancer `video.currentTime` depuis un gestionnaire de défilement a l'air
   juste en démonstration et saccade en pratique. Le navigateur doit décoder
   depuis l'image-clé la plus proche à chaque saut, et un clip généré en a très
   peu.
2. Des images sont des **images**, donc l'aperçu isolé n'a besoin d'aucune source
   vidéo, et sa politique de sécurité ne bouge pas d'un pouce pour supporter la
   fonctionnalité.

### Une cadence fixe, pas un nombre d'images fixe

Extraire « exactement 60 images réparties sur le clip » demanderait de connaître
sa durée, donc une passe de sondage. Une cadence fixe ne demande rien.

À 12 images par seconde, un clip de 5 secondes donne 60 images et un clip de
3 secondes en donne 36. Les deux se parcourent identiquement, parce que la
séquence est pilotée par la **progression**, pas par le temps. Le plafond de 150
images empêche un clip surprise de 30 secondes d'écrire 400 fichiers.

### Deux détails qui comptent

L'affiche est la première image **copiée**, pas ré-encodée. C'est ce que l'écran
montre avant la fin du préchargement, et elle doit être identique à l'octet près
à l'image 1 pour qu'il n'y ait pas de saut visible.

`<ScrollSequence>` dessine **l'image déjà chargée la plus proche** au lieu
d'attendre qu'elles soient toutes là. Soixante images sont soixante requêtes, et
bloquer la section jusqu'à la dernière laisserait un trou d'une ou deux secondes
sur un cache froid.

Les séquences vivent dans `data/video-library/`, adressées par l'empreinte
SHA-256 du clip. Une demande identique réutilise la séquence au lieu de la payer
deux fois.

---

## L'anti-slop

Cinq mécanismes, tous actifs.

**1. Une liste noire versionnée.** `server/muse/anti-slop.json` nomme 18 clichés,
injectés dans le prompt du dossier et fusionnés avec la liste `avoid` de chaque
fiche d'inspiration. Un échantillon :

> les dégradés violet vers bleu en diagonale sur fond sombre · trois cartes de
> fonctionnalités identiques avec une icône générique, un titre et une phrase ·
> un faux bandeau de logos « Trusted by » en rectangles gris · les emoji utilisés
> comme icônes d'interface · le même rayon d'angle sur absolument tout

**2. Le contenu d'abord.** La section *Voice & Copy* est demandée avant la mise
en page. Une page écrite autour de son texte ne ressemble pas à une page dans
laquelle on a versé du texte.

**3. Une vérification après génération.** `lintSlop()` cherche `lorem ipsum`,
« Sample text », « Your text/content here », « Content goes here » et
« Placeholder text ». Le prompt système les interdisait déjà ; ceci rend
l'interdiction **constatée**. Une violation ne supprime pas l'écran : elle est
signalée pour que vous régénériez.

**4. L'autocritique de distinction.** Une note, au plus une révision.

**5. La bibliothèque de patterns hors ligne.** 18 directions artistiques écrites
à la main, chacune avec des semences de jetons compatibles `DESIGN.md`. C'est le
repli quand l'inspiration live est indisponible, et elle se mélange aux fiches
sinon.

---

## Éthique et conditions d'utilisation

Muse est construit pour respecter les sites dont il apprend.

- **Aucun moissonnage massif.** Uniquement les pages du registre choisi à la main
  et les URL que vous collez, plafonnées à **6 récupérations par passage**, en
  respectant `robots.txt`, avec un User-Agent honnête (`Mocky-Muse/…`) et un
  cache de 7 jours **exclusivement textuel**.
- **Aucune image tierce n'est jamais conservée, mise en cache, relayée ni
  affichée.** Seules les images produites par Mocky et les distillations
  textuelles persistent — et `MuseCache` **lève** si on lui passe autre chose que
  du texte.
- **L'inspiration, c'est du vocabulaire et de la grammaire structurelle**, jamais
  la copie d'un design précis.
- **Le contenu web récupéré est traité comme de la donnée non fiable**, jamais
  comme des instructions.
- Toutes les URL sortantes passent la protection SSRF, et le chemin par défaut ne
  demande **aucune clé d'API ni aucun compte**.

Ce sont les invariants M2, M4, M5 et M7. Voir
[Invariants](fr/architecture/invariants.md).

---

## Higgsfield

Higgsfield.ai n'a pas d'API gratuite, donc il n'est pas intégré. Le contournement
manuel fonctionne : générez l'image sur Higgsfield, téléchargez-la, déposez-la
dans la bibliothèque média de Mocky et épinglez-la.

Muse l'utilisera comme n'importe quelle autre image, c'est-à-dire en mesurant sa
palette et en écrivant le dossier autour d'elle.

---

## Une note sur les dépendances

Le SDK MCP entraîne quelques paquets transitifs signalés par `npm audit` :
`hono`, `body-parser`, `shell-quote` et `esbuild`. Tous sont dans le **transport
HTTP** du SDK, que Mocky **n'utilise pas** : Mocky est un client stdio.

L'intégration continue exécute `npm audit --omit=dev --audit-level=high`, donc
sur les dépendances de production uniquement. Les alertes du serveur de
développement, comme Vite et esbuild, ne concernent pas un déploiement, où
Express sert le `dist/` compilé.
