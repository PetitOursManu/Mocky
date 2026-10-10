---
source_hash: 5a409b094cc0
---

# Le forfait gratuit

Chaque compte est sur l'un de deux forfaits. **Standard**, c'est ce qu'étaient
tous les comptes avant le forfait gratuit : le modèle de texte de l'instance, ses
générateurs d'images et de vidéos, payés par celui qui détient les clés.
**Gratuit** ne coûte à l'instance que son propre matériel : son texte passe par un
modèle qui ne coûte rien, ses images et vidéos viennent des banques libres, et les
générateurs payants lui sont fermés.

Il existe pour qu'une instance puisse ouvrir ses inscriptions à des inconnus sans
leur ouvrir son portefeuille. Les nouveaux comptes démarrent au forfait gratuit
par défaut ; un administrateur passe un compte en standard d'un clic.

## Ce que peut faire un compte gratuit

| | Forfait gratuit | Forfait standard |
|---|---|---|
| Écrire des écrans, les modifier, les polir, corriger leur accessibilité, ajuster un document | Oui, avec le **modèle gratuit** | Oui, avec le modèle de l'instance |
| Muse (direction artistique, dossier, inspiration en direct) | Oui, avec le modèle gratuit | Oui |
| Les images d'un écran | **Photos libres** (Pexels, Pixabay) et vos propres images | Générées ou libres, au choix |
| Les vidéos d'une séquence au défilement | **Vidéos libres** et vos propres vidéos | Générées ou libres |
| Images et vidéos générées par IA, variantes de film | **Non** — refusées par le serveur | Oui |
| Films Motion Ultra (le moteur de rendu local) | Selon sa propre liste d'accès (Admin → Motion Ultra) | Pareil |
| Un plafond quotidien | Oui, fixé par l'administrateur | Non |

Tout ce que garde le forfait gratuit coûte du temps au serveur et rien d'autre : un
film est rendu par le moteur sur la même machine, une inspiration en direct fait
tourner le Chromium local. Ces fonctionnalités gardent leurs propres listes
d'accès.

## Mise en place

### 1. Un modèle qui ne coûte rien

**Admin → Fournisseurs → Modèles de texte → ③ Forfait gratuit.** C'est un
troisième profil à côté de la génération et de Muse, avec les mêmes fournisseurs.
Choisissez l'un de ceux-ci :

- un modèle **OpenRouter** dont l'identifiant finit par `:free`, avec une clé d'un
  compte qui n'a **aucun crédit** — une clé qui n'a rien à dépenser ne peut pas
  être facturée. Les modèles gratuits partagent une petite allocation quotidienne
  par clé : vérifiez les chiffres actuels sur la page d'OpenRouter ;
- une clé **Groq**, **Google Gemini** ou **Cerebras** d'un compte **sans moyen de
  paiement** — leurs offres gratuites sont limitées en débit plutôt que facturées ;
- un modèle qui tourne **sur le serveur lui-même**, via Ollama ou LM Studio
  (« Compatible OpenAI » avec une adresse `http://127.0.0.1:…`) : pas de clé, pas
  de facture, mais chaque génération occupe le processeur, et un serveur sans carte
  graphique écrit lentement.

Mocky garantit qu'un appel d'un compte gratuit n'atteint jamais le profil
**payant**. Que la clé mise dans le profil gratuit puisse être facturée, c'est
l'affaire du fournisseur — d'où le conseil ci-dessus, toujours « un compte qui n'a
rien à dépenser ».

**Laissé vide, le profil gratuit n'emprunte rien.** Les comptes gratuits utilisent
alors le fournisseur que chacun renseigne dans **Réglages**, avec sa propre clé —
ce qui ne coûte rien à l'instance non plus. Ils ne se rabattent jamais sur le
modèle payant.

### 2. Qui démarre en gratuit

**Admin → Utilisateurs → Forfait gratuit → Forfait des nouveaux comptes.** Gratuit
par défaut. Il s'applique aux inscriptions publiques, aux comptes créés par
« Se connecter avec Dashy », et aux comptes qu'un administrateur crée (le
formulaire de création a un champ **Forfait** qui démarre sur cette valeur).

Le changer ne déplace jamais un compte qui existe déjà, et chaque compte créé
avant le forfait gratuit est standard. **Un administrateur est toujours au forfait
standard** : c'est lui qui configure et teste les modèles payants.

Pour déplacer un compte, utilisez **Passer en gratuit** / **Passer en standard**
sur sa ligne dans la liste des comptes. Cela prend effet à sa requête suivante.

### 3. Le plafond quotidien

**Admin → Utilisateurs → Forfait gratuit → Générations par jour.** Vingt par
défaut ; `0` veut dire illimité.

Ce qui compte pour **une génération** : un nouvel écran, une modification, un
polissage, une correction d'accessibilité, un ajustement à la page — chaque chose
qu'une personne a demandée et qui réécrit un écran. Les appels qui la servent (le
planificateur, une réparation, la lecture d'une capture, le choix d'une photo, le
dossier de Muse) ne comptent pas : un nouvel écran coûte une génération, pas
quatre.

Trois détails :

- **Ces autres appels ont quand même un plafond** — douze fois la limite — pour
  qu'un navigateur qui étiquetterait chaque appel comme un appel au planificateur
  rencontre quand même un mur. Un compte honnête ne le rencontre jamais.
- **Une fois les générations épuisées, tous les appels sont refusés**, comptés ou
  non : sinon le planificateur d'un nouvel écran tournerait sur la clé partagée
  juste avant que sa génération soit refusée.
- **Le compteur repart à minuit, heure du serveur**, et il est gardé sur disque
  (`free-quota.json`), pour qu'un redémarrage n'offre pas une nouvelle journée à
  tout le monde.

Le plafond ne s'applique qu'aux appels qui atteignent le modèle gratuit de
l'instance. Un compte gratuit qui utilise sa propre clé (aucun modèle gratuit
configuré) ne dépense le quota de personne d'autre que le sien.

## Ce que voit un compte gratuit

- **Réglages** s'ouvre sur une carte **Forfait gratuit** : ce que le forfait
  comprend, quel modèle répond, et combien de générations il reste aujourd'hui —
  ou, sans modèle gratuit sur l'instance, une note qui demande son propre
  fournisseur plus bas.
- L'interface ne propose pas le choix **Images · IA / Libres** : les images
  viennent des banques libres, et la porte IA de l'image d'un document est fermée.
- Quand la journée est épuisée, une génération échoue avec : *« Limite du jour
  atteinte : le forfait gratuit permet N générations par jour. Le compteur repart
  à minuit. »*
- Un générateur payant atteint malgré tout (le sélecteur d'images, les variantes
  d'un film) répond par une phrase qui dit qu'il n'est pas disponible avec le
  forfait gratuit.

## Comment c'est garanti

Tout est décidé **sur le serveur, à partir du compte**, jamais à partir de ce que
dit le navigateur. Les règles sont écrites sous forme d'invariants
[F1 à F3](architecture/invariants.md#serie-f-le-forfait-gratuit) ; en bref :

- chaque route qui choisit un modèle de texte pour quelqu'un passe par une seule
  fonction, `textTargetFor`, qui répond, au forfait gratuit, le profil gratuit ou
  rien ;
- les générateurs payants (`/api/images/generate`, `/api/videos/generate`,
  `/api/video/variants`) refusent un compte gratuit dès l'entrée, avec
  `code: "free-plan"` ;
- le plafond répond `429` avec `code: "free-quota"`.

`server/plan-routes.test.js` le prouve sur un vrai serveur : deux faux
fournisseurs en boucle locale, l'un pour le modèle payant et l'autre pour le
modèle gratuit, et le compte de ce que chacun a reçu.

## Limites

- **Avec `npm run dev`, Vite sert lui-même le proxy vers le modèle**, sans
  comptes : le forfait ne s'applique pas aux générations dans ce mode. Vérifiez le
  forfait gratuit sur un build de production — la même réserve que pour
  [le tableau de bord d'administration](admin-dashboard.md).
- Le forfait ne rend pas une clé gratuite. Voir
  [l'étape 1](#1-un-modele-qui-ne-coute-rien).
- Des inscriptions ouvertes invitent à créer plusieurs comptes pour avoir plusieurs
  journées. Le plafond est une règle d'équité entre comptes honnêtes, pas un mur
  contre un compte déterminé ; fermer les inscriptions, si.
