---
description: Auditer toutes les pages d’un projet selon une même grille tirée de son objectif. Un modèle de décision note les pages ; Muse explique ce que disent les notes.
badge: Nouveau
source_hash: 9185ba75ffba
---

# Audit de projet et modèle de décision

Le panneau **Audit** a deux onglets. **Un écran** est le
[rapport SEO et accessibilité](seo-accessibility.md). **Le projet** examine
toutes les pages du projet selon une même grille : ce qui fonctionne, ce qui est
faible, ce qu’il faut corriger d’abord, et ce que vos modifications ont changé
depuis le dernier audit.

## Lancer un audit

1. Ouvrez **Audit** dans la barre d’outils du projet, puis l’onglet **Le projet**.
2. La première fois, écrivez l’**objectif** du projet en une phrase (« remplir la
   salle du festival le 14 juin, auprès des familles du quartier ») et les
   **éléments attendus**, un par ligne : une date, un lieu, un prix, des
   coordonnées, une mention légale. Les faits d’une campagne sont déjà repris.
3. **Lancez l’audit.** Muse écrit la grille de ce projet, chaque page est
   examinée selon cette grille, et Muse rassemble les résultats.
4. Après vos modifications, choisissez **Refaire l’audit avec la même grille**.
   Le rapport indique ce qui a changé depuis l’audit précédent, critère par
   critère. **Nouvelle grille** repart de zéro, et cet audit n’est pas comparé
   aux précédents.

Chaque constat renvoie aux pages qu’il concerne : un clic affiche la page sur le
canevas. Le projet garde sa grille et ses huit derniers audits.

## La grille

Six critères. Leurs noms restent les mêmes d’un projet à l’autre, pour que deux
audits puissent être comparés. Muse réécrit la question et ses cinq niveaux dans
les termes de ce projet.

| Critère | Examiné sur |
|---|---|
| Clarté de l’offre et des messages | chaque page |
| Organisation des informations et du parcours | chaque page |
| Respect du brief et de la charte | chaque page |
| Cohérence visuelle et éditoriale | l’ensemble des pages |
| Répétitions, contradictions et manques | l’ensemble des pages |
| Éléments attendus | l’ensemble des pages : quelle page montre chacun d’eux |

Une note va de 0 (le niveau le plus faible) à 4 (le meilleur). Chaque niveau est
une phrase, à lire dans **La grille**, sous les résultats.

## Ce que contient le rapport

- **Problèmes observés** : ce que les notes montrent de faible, de manquant ou
  d’incohérent, avec une priorité (P1 d’abord).
- **Améliorations prioritaires** : ce qu’il faut faire. Les constats et les
  recommandations forment deux listes séparées.
- **Points forts** : ce qui fonctionne.
- **Critères**, **éléments attendus** et **par page** : les notes qui
  fondent ces trois listes.

## Ce qu’un résultat ne dit pas

- **L’audit lit les textes et la structure des pages, pas leur rendu.** Les
  contrastes, les performances et les liens cassés demandent des outils dédiés.
  L’onglet **Un écran** couvre l’accessibilité.
- **Un élément non trouvé n’est pas forcément absent.** Le rapport écrit « non
  trouvé », jamais « manquant ».
- **Une note ne garantit pas l’efficacité d’une page.** Aucune note ne prédit
  les clics ni les ventes.
- **Un doute est affiché à côté de la note.** Quand la confiance du modèle est
  faible, le résultat indique « résultat incertain ». Quand personne n’a pu la
  mesurer, il indique « confiance non mesurée ».

## Le modèle de décision (administrateurs)

Un modèle de décision n’écrit pas. Il répond à des questions courtes et typées :
un oui ou un non, une note sur une échelle décrite en mots, une option parmi une
liste. Il répond vite, à bas coût, et indique son niveau de confiance. Mocky en
prend un en charge aujourd’hui : **Jev**, de [TypeSafe](https://docs.typesafe.ai).

Configurez-le dans **Admin → Fournisseurs → Modèle de décision**. Choisissez le
fournisseur, collez une clé d’API créée sur console.typesafe.ai, enregistrez, puis
**Testez**. La clé ne quitte jamais le serveur et n’est plus jamais affichée.

Quand un modèle de décision est configuré, il répond à toutes les évaluations de
l’audit. Le modèle de texte de Muse écrit toujours la grille et la synthèse.
Quand aucun n’est configuré, ou quand le modèle de décision échoue deux fois de
suite, le modèle de texte de Muse répond aux mêmes questions. L’audit fonctionne
dans les deux cas. La différence est la confiance : un modèle de texte ne sait
pas mesurer la sienne, et le rapport indique « confiance non mesurée ».

| | Avec un modèle de décision | Sans |
|---|---|---|
| Qui note les pages | le modèle de décision | le modèle de texte de Muse |
| Confiance | mesurée, affichée quand elle est faible | non mesurée |
| Qui écrit la grille et la synthèse | le modèle de texte de Muse | le modèle de texte de Muse |

Deux passes qui tranchaient déjà des questions oui/non s’en servent aussi :

- **[Polish](quality.md)** : les règles qu’une expression régulière ne peut pas
  trancher (trois cartes interchangeables, un en-tête sans idée propre…).
- **Le passage approfondi du [rapport SEO et accessibilité](seo-accessibility.md)** :
  un texte alternatif décrit-il son image, un titre décrit-il sa section.

Le modèle de décision tranche quelles questions échouent. Le modèle de texte de
Muse écrit ensuite une phrase pour chaque question en échec seulement, en nommant
l’élément qui montre le problème. Un écran qui passe tout ne coûte aucun appel au
modèle de texte. Le rapport indique quel modèle a tranché. Si le modèle de
décision ne répond pas, la passe se déroule comme avant, avec le modèle de texte
seul.

Qui y a accès :

- **Pas les comptes du plan gratuit**, ni ceux qui utilisent leur propre clé. Le
  modèle de décision est facturé à l’instance ([le plan gratuit](free-plan.md)).
  Leur modèle de texte répond à sa place.
- **Ses appels sont comptés** dans **Dépenses**, sous le fournisseur
  `typesafe`, au prix des jetons d’entrée (42 $ le milliard ; la sortie est
  gratuite).
- **Les images sont désactivées.** TypeSafe présente encore la lecture d’images
  comme non prête pour la production, et l’audit n’en envoie pas.

## Depuis un assistant

Un assistant connecté par [MCP](mcp.md) appelle `audit_project`. Il utilise le
même moteur et la grille que garde le projet : son rapport se compare donc à
votre dernier audit. Il ne modifie rien : l’historique reste celui du panneau.
