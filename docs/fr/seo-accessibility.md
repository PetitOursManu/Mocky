# SEO et accessibilité

La passe qualité, à côté, demande si un écran ressemble à du remplissage écrit
par une machine. Celle-ci pose une autre question, plus difficile à trancher
honnêtement : le **balisage** de l'écran est-il correct — un moteur de recherche
peut-il le lire, et une personne au lecteur d'écran peut-elle s'en servir.

C'est un rapport séparé, une note séparée et une boucle de correction séparée.
Le reste de cette page explique surtout pourquoi.

---

## Où ça se trouve

Ouvrez un projet, puis le bouton **Audit** de la barre d'outils. Le panneau
s'ouvre à droite avec chaque écran du projet en vignette. Choisissez-en un,
cliquez sur **Évaluer**.

Rien ne se déclenche automatiquement. Rien ne tourne à la génération. Ouvrir le
panneau coûte une lecture de localStorage.

---

## Les deux moitiés

### Déterministe, dans le navigateur

Toutes les questions de structure sont tranchées localement, à partir d'un AST,
sans le moindre appel réseau : `src/lib/audit/inspect.ts` parcourt l'écran une
fois et remet à `src/lib/audit/rules.ts` un résumé à tester.

C'est l'arrangement inverse de la passe qualité, qui détecte côté serveur — et
c'est délibéré. Celle-ci enveloppe `impeccable`, un module Node qui lit
`node:fs` à l'import et ne peut pas être empaqueté pour un navigateur. Ces
règles-ci sont celles de Mocky, et les exécuter ici rend l'évaluation
instantanée, gratuite, et opérante backend éteint. C'est ce qui permet de
l'offrir par défaut et de mettre le modèle derrière un second bouton.

Les règles s'appliquent à un AST et jamais au texte du source (invariant I1).
`<img` se trouve dans une chaîne, dans un bloc que le modèle a laissé en
commentaire, et dans un exemple de code que l'écran affiche lui-même. Un rapport
affirmant que trois images n'ont pas de `alt` alors que ces trois images
n'existent pas est pire que pas de rapport : il envoie quelqu'un chercher pour
rien, et il décrédibilise les points qui sont réels.

### Jugée, sur le serveur

`POST /api/muse/audit` pose à un modèle les questions qu'une règle ne peut pas
trancher : le texte alternatif décrit-il ce que l'image *montre*, un titre
décrit-il la section qui le suit, ce libellé de lien voudrait-il encore dire
quelque chose lu hors contexte. Le catalogue est
`server/muse/quality/audit-questions.js`.

C'est derrière la case **Analyse approfondie** parce que cela consomme des
jetons. L'écran voyage comme une donnée, dans le tour `user`, sous un en-tête
qui le dit (invariant Q5), et un verdict citant une question jamais posée est
écarté plutôt qu'affiché.

Si la passe ne peut pas tourner — pas de modèle, un délai dépassé, une réponse
illisible — le rapport déterministe est renvoyé avec une notice. Perdre un
rapport complet et gratuit parce qu'un appel réseau a échoué serait absurde
(invariant Q1).

---

## Ce que la note ne veut pas dire

Chaque dimension est notée sur 100 et chacune déclare `confidence: 'partial'`.
Ce n'est pas de la modestie, c'est de l'arithmétique.

Une analyse du source seul connaît le balisage et rien du rendu. Elle ne peut
pas mesurer :

- le contraste des couleurs tel qu'il est peint,
- la visibilité du focus,
- la taille des cibles tactiles,
- l'ordre de tabulation réel,
- le comportement à d'autres largeurs.

C'est la moitié de WCAG. Donc **rien ici ne revendique un niveau de
conformité**, et le panneau imprime la réserve à côté du nombre plutôt que dans
une infobulle — un nombre dont personne ne lit la réserve est un nombre qui sera
cité sans elle.

Deux de ces points ont depuis reçu une réponse partielle, et le rapport prend
soin de dire à quel point elle l'est. Le contraste est calculé là où un élément
pose **lui-même** sa couleur de texte et son fond, et la hauteur d'une cible
tactile est déduite des classes qui la déclarent. Ni l'un ni l'autre n'est une
mesure sur une page rendue : c'est pourquoi la famille « Couleur » annonce une
confiance moyenne et la famille « Cibles tactiles » une confiance basse, et
pourquoi aucune des deux ne dit quoi que ce soit des éléments qu'elle n'a pas pu
lire.

Une note de 100 signifie « rien à signaler dans ce que ceci peut voir ». Elle ne
signifie pas accessible.

La notation compte des **règles distinctes**, jamais des éléments. Vingt images
sans `alt`, c'est une seule chose à corriger ; la compter vingt fois noierait
tous les autres points et rendrait le nombre inutile. Le panneau liste tout de
même chaque élément fautif.

---

## Le détail par famille

Sous les deux notes, le panneau liste huit familles — titres, images, liens et
contrôles, formulaires, couleur, typographie, cibles tactiles, structure — avec
chacune sa note. Ce sont les mêmes points, découpés une seconde fois : `seo` et
`a11y` répondent à *comment se comporte cet écran*, les familles répondent à *où
aller corriger*. Les deux ne se recouvrent pas. Un bouton sans nom et une image
sans `alt` sont deux erreurs d'accessibilité qui n'ont rien à voir l'une avec
l'autre, tandis que `img-alt` et `img-alt-redundant` sont un après-midi dans un
seul fichier.

L'ordre est figé dans `RULE_FAMILIES` et volontairement pas dérivé du rapport.
Une liste triée par note se réorganise à chaque réévaluation, et la ligne qu'on
était en train de lire se déplace sous le curseur entre deux clics sur
**Évaluer**.

Chaque ligne porte une confiance, et celle-ci décrit la **méthode**, pas le
passage :

| Familles | Confiance | Pourquoi |
|---|---|---|
| titres, images, liens, formulaires, structure | élevée | du balisage — un `alt`, un niveau de titre, une paire `for`/`id` sont dans le source ou n'y sont pas |
| couleur | moyenne | seuls les éléments qui posent eux-mêmes leurs deux couleurs ont pu être comparés |
| typographie, cibles tactiles | basse | `py-2` plus une interligne est une affirmation sur une boîte que personne n'a rendue |

**Une ligne peut ne porter aucun nombre**, et c'est la raison d'être de la
section. Une famille qui n'a rien à examiner affiche *sans objet* ; une famille
dont le source ne décrit pas assez les sujets affiche *non mesuré*. Aucune des
deux n'affiche 100. Un écran sans formulaire et un écran dont les formulaires
sont irréprochables produisent la même liste vide, et un seul des deux a mérité
la note pleine — invariant Q4, appliqué un cran sous la réserve du panneau
lui-même. Les deux mots restent distincts parce qu'ils énoncent deux faits
différents : « il n'y avait rien à vérifier ici », et « il y avait quelque
chose, et le code n'en dit pas assez pour trancher ».

Les points jugés par le modèle sont rangés eux aussi. Leurs identifiants
n'existent que dans `server/muse/quality/audit-questions.js` : chaque question y
déclare donc sa famille, et le navigateur écarte tout nom qu'il ne sait pas
placer — la même discipline que celle qui écarte un verdict citant une question
jamais posée. Sans cela, un constat du modèle sur les titres retirerait des
points au SEO pendant que la ligne « Titres » afficherait encore 100, et le
détail contredirait le nombre juste au-dessus de lui.

---

## Le document exporté

Un écran Mocky est un composant React autonome. Il n'a ni `<head>`, ni
`<title>`, ni URL, ni routage — le prompt de génération l'interdit. La moitié
« document » du SEO ne peut donc pas être notée sur un écran, puisqu'elle n'y
existe pas. Elle existe dans ce que l'export écrit, et elle est vérifiée à part,
en bas du panneau, une fois pour le projet au lieu d'être répétée sur chaque
écran.

Écrire cette vérification a mis au jour trois vrais défauts dans `indexHtml`,
tous invisibles parce que personne ne lit le `<head>` de son propre export :

| Avant | Maintenant |
|---|---|
| `<title>` valait le **nom de paquet slugifié** (`my-shop`) | le vrai nom du projet |
| `lang="en"` en dur, y compris sur les projets français | suit la langue de l'interface |
| aucune `<meta name="description">` | écrite quand le projet nomme un produit |

`lang` n'était pas un défaut cosmétique. C'est ce qui indique au lecteur d'écran
quelle langue prononcer : tous les exports français étaient lus à voix haute en
anglais.

---

## Corriger

Chaque point exigible porte un bouton **Corriger**, et il y a un **Tout
corriger**. Les deux passent par `runPolishLoop` — les mêmes quatre conditions
d'arrêt que la passe qualité, parce que « cette passe a-t-elle vraiment abouti »
mérite d'être résolu une seule fois — avec `AUDIT_FIX_PROMPT` et l'audit comme
vérification.

Ce prompt est un troisième frère de `FIX_PROMPT` et `POLISH_PROMPT`, et fusionner
deux d'entre eux casse les deux. L'instruction centrale de chacun est fausse pour
les autres :

| | Dit | Parce que |
|---|---|---|
| Réparation | corrige seulement l'erreur, ne restyle pas | un plantage n'est pas un problème de design |
| Peaufinage | corrige ces points, un changement visuel est attendu | un point de « slop » **est** un problème de style |
| Correction d'audit | corrige le balisage, l'écran doit rester identique | une passe de sémantique qui redessine a échoué même si tous les points ont disparu |

Les points indicatifs ne sont jamais corrigés automatiquement. Certaines règles
contredisent légitimement un parti pris : une page d'accueil peut vraiment être
une seule `<section>` sans `<nav>`, et y forcer des repères serait du balisage
ajouté pour faire plaisir au rapport. Même raisonnement que `policy.js` dans la
passe qualité (invariant Q2).

Après une correction, le rapport de l'écran est jeté plutôt que conservé. Il
décrit un source qui n'existe plus, et une note périmée affichée à côté d'un code
modifié est pire que pas de note du tout.

`Screen.quality` n'est **pas** écrit par cette passe. Ce champ enregistre l'audit
de design sur 20, et y mettre une note d'accessibilité ferait partager un seul
nombre à deux mesures différentes.

---

## Fichiers

| Chemin | Rôle |
|---|---|
| `src/lib/audit/inspect.ts` | parcours AST → faits sur le balisage |
| `src/lib/audit/rules.ts` | le catalogue de règles et la notation |
| `src/lib/audit/index.ts` | `auditScreen`, `auditExport`, le client de la passe approfondie |
| `src/components/AuditPanel.tsx` | le panneau, le choix par vignettes, les boutons de correction |
| `server/muse/quality/audit-questions.js` | les questions jugées |
| `server/muse/quality/audit-judge.js` | un appel modèle, verdicts filtrés |
| `src/i18n/parts/audit.ts` | tous les noms et descriptions de règles, dans les deux langues |
