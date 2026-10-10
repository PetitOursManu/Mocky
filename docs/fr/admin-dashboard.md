---
source_hash: 388d791b80a1
---

# Le tableau de bord d’administration

L’administration tient sur une seule page, avec un menu à gauche. Dix sections,
un seul flux en direct : tout ce qui bouge — qui est connecté, ce qui tourne, le
processeur, la mémoire, la carte graphique — se met à jour toutes les deux
secondes sans recharger, et passer d’une section à l’autre ne coûte aucune requête.

| Section | Ce qu’elle dit |
|---|---|
| **Vue d’ensemble** | Qui est là, ce qui tourne, si la machine et les fournisseurs vont bien — et, en phrases, les quelques points qui demandent une décision. |
| **Activité en direct** | Chaque compte, connecté ou non : état, où il se trouve, ce qu’il fait maintenant, ce qu’il a fait dans l’heure. Un graphique par type et un fil des travaux terminés. |
| **Utilisateurs** | Inscriptions publiques, création de compte, réinitialisation de mot de passe, suppression, rapport d’utilisation — comme avant — plus la présence de chaque compte et **Déconnecter** (tous les appareils, mot de passe inchangé), et le [forfait gratuit](free-plan.md) : le forfait des nouveaux comptes, le plafond quotidien, et **Passer en gratuit / standard** sur chaque compte. |
| **Sessions** | Chaque navigateur connecté : compte, appareil, adresse, ouverture, dernière utilisation. Chacun peut être fermé. |
| **Système** | Processeur, mémoire, retard de la boucle d’événements, carte graphique, disque, worker de rendu des films. |
| **Fournisseurs** | Comment les fournisseurs de texte, d’images et de vidéo ont répondu sur la dernière heure, puis leurs réglages (les trois blocs de l’ancienne page). |
| **Journal d’audit** | Qui a fait quoi : connexions et échecs, comptes, sessions, réglages, maintenance, annonces, migrations. |
| **Annonce** | Un message affiché à tout le monde sous l’en-tête, tout de suite ou à partir d’une date programmée, avec une fin facultative — et des dates dans le texte affichées dans le fuseau de chaque lecteur. |
| **Assistants (MCP)** | Si Claude, ChatGPT ou un autre client MCP peut agir dans Mocky au nom d’un compte : les prérequis HTTPS, l’interrupteur, qui peut se connecter, et chaque connexion active avec de quoi la couper — voir [Connecter un assistant](mcp.md). |
| **Maintenance et migration** | Inchangée — voir [Maintenance et migration](migration.md). |

Le code est dans `server/admin/` (un fichier par magasin, chacun s’explique en
tête) et `src/components/admin/`.

## La présence

« Connecté » demande un signal du navigateur. La génération tourne dans le
navigateur et le serveur ne fait que relayer l’appel au modèle : quelqu’un qui lit
son canevas n’envoie rien pendant des minutes. Chaque onglet connecté envoie donc
un battement toutes les 30 secondes : un identifiant aléatoire propre à l’onglet,
le nom de l’écran où il se trouve (projets, un projet, design, médias, réglages,
admin), et s’il est au premier plan. Rien d’autre — jamais un projet, un écran ni
quoi que ce soit de saisi.

| État | Signification |
|---|---|
| **Actif** | Un onglet est au premier plan, ou le compte a fait une requête dans la dernière minute. |
| **En arrière-plan** | Un onglet est ouvert mais caché. |
| **Hors ligne** | Aucun battement depuis 150 secondes, ou le dernier onglet a été fermé. |

150 secondes et non 30, parce que tous les grands navigateurs ralentissent les
minuteries d’un onglet caché à une par minute. Fermer un onglet envoie un au revoir
(`sendBeacon`) : le compte passe hors ligne tout de suite plutôt que deux minutes
plus tard.

Le battement ne compte pas comme une activité, et il reste permis pendant la
maintenance : il n’écrit rien, et le refuser afficherait tout le monde hors ligne
précisément quand l’administrateur veut voir qui est encore là.

## L’activité

Le serveur observe les requêtes qui sont du travail et note qui, quel type, quel
fournisseur, combien de temps et comment cela s’est terminé :

| Type | Requêtes |
|---|---|
| Mocky | `/__provider/api/chat` — génération, modification, réparation, polissage, correction d’accessibilité, planificateur, lecture de site, DESIGN.md, storyboard, choix de photos |
| Muse | dossier, contrôle qualité, audit SEO/accessibilité |
| Images | `/api/images/generate` |
| Photos libres | recherche, choix, import |
| Clips vidéo | `/api/videos/generate` |
| Films Motion Ultra | composition, variantes, mise en file — et le rendu lui-même, pour les minutes passées dans le worker |

**Le type d’action seulement.** Aucun prompt, brief, nom de projet ni texte
d’erreur de fournisseur n’est jamais enregistré — un message d’erreur peut citer le
prompt qu’il refuse, alors la fin est réduite à un mot (`réussi`, `annulé`,
`limité`, `refusé`, `délai dépassé`, `indisponible`, `invalide`, `échec`) et un
statut HTTP. Ce à quoi sert un appel au modèle voyage dans `x-mocky-purpose`, lu
dans une liste fermée : l’en-tête vient d’un navigateur, et une chaîne libre
mettrait les mots d’un appelant sur l’écran de l’administrateur.

En mémoire, une heure. Un redémarrage l’oublie.

Sous `npm run dev`, c’est Vite qui relaie les appels au modèle : les générations
n’atteignent pas le processus Express et n’apparaissent pas ; l’écran Activité le
dit. En production, tout est suivi.

## La machine

Mesurée toutes les 5 secondes, gardée une heure en mémoire. Trois périmètres,
chacun sur son propre graphique :

- **le processus** — le Node de Mocky ;
- **le conteneur**, s’il y en a un — Mocky et tout ce qu’il lance (le Chromium de
  Muse, les serveurs MCP, ffmpeg) ; c’est sur ce chiffre que s’applique une limite
  Docker ;
- **la machine** — quand Mocky ne tourne pas dans un conteneur.

Dans un conteneur, les pourcentages sont calculés sur les limites du cgroup, pas
sur le matériel : sur un hôte de 32 cœurs limité à deux, un processus bloqué à son
plafond afficherait sinon 6 %. La mémoire du conteneur est la mémoire de travail
(usage moins le cache disque inactif) — le chiffre de `docker stats`, celui que
pèse le noyau.

Le retard de la boucle d’événements (99e centile) est la réactivité du serveur :
sous 50 ms c’est du bruit, au-delà de 200 ms chaque requête attend et la vue
d’ensemble le signale.

## La carte graphique

Mocky ne dessine rien sur un GPU. La carte est affichée parce qu’une instance
partage souvent sa machine avec quelque chose qui s’en sert — un Stable Diffusion
WebUI ou un ComfyUI local, un LLM local. C’est **toute la carte**, pas la part de
Mocky.

Ce qui est interrogé, dans l’ordre, sans rien installer :

| Source | Où | Ce qu’elle donne |
|---|---|---|
| `nvidia-smi` | Linux, Windows ; Docker avec le NVIDIA Container Toolkit | utilisation, VRAM, température, consommation |
| sysfs | Linux, AMD (`amdgpu`) | utilisation, VRAM |
| `ioreg` | macOS, GPU Apple | utilisation |
| registre + `typeperf` | Windows, tout fabricant | utilisation (le chiffre du Gestionnaire des tâches), VRAM |

Trois réponses sont possibles. **Un chiffre**, quand une source sait mesurer la
carte. **Non mesurable**, quand une carte est là et que rien ne dit à quel point
elle travaille — une carte NVIDIA sans `nvidia-smi`, un iGPU Intel sous Linux ;
l’écran dit laquelle et pourquoi, car « pas de GPU » sur une machine qui en a un
envoie chercher le mauvais problème. **GPU non présent**, quand il n’y en a pas —
les puces d’affichage des serveurs (ASPEED, Matrox) et des machines virtuelles ne
comptent pas.

La carte est lue toutes les 5 secondes quand quelqu’un a le tableau de bord ouvert,
une fois par minute sinon ; `typeperf` prend environ trois secondes par lecture et
presque aucun processeur.

Dans Docker, une carte NVIDIA n’est visible qu’avec le NVIDIA Container Toolkit sur
l’hôte et `docker-compose.gpu.yml` par-dessus le fichier habituel — voir
[Déploiement](deployment.md#la-carte-graphique-dans-docker).

## La santé des fournisseurs

Mesurée sur les vrais appels des utilisateurs — aucune requête de test. Par type
et fournisseur, sur la dernière heure : appels, échecs et taux d’échec, temps
jusqu’au premier octet, durée médiane et au 95e centile, dernier événement.

- **Les annulations ne comptent pas.** Un utilisateur qui appuie sur Stop n’est pas
  une panne.
- **Les requêtes invalides ne comptent pas** (un 4xx, souvent la validation de
  Mocky elle-même — un prompt vide refusé en 2 ms). Elles sont affichées à côté des
  échecs.
- **Les durées ne portent que sur les appels réussis.** Un refus renvoyé en 40 ms
  ferait paraître rapide un fournisseur en panne.
- **La clé du navigateur** d’un utilisateur est nommée par l’hôte visé et signalée
  comme telle : cela distingue « notre compte OpenRouter échoue » de « l’Ollama
  d’Alice est tombé ».

Un fournisseur qui échoue sur au moins 20 % de ses appels, au moins deux fois, met
son entrée du menu en rouge et obtient une ligne dans la vue d’ensemble.

## Les sessions

Un jeton de session est l’identifiant lui-même : il n’atteint donc jamais le
tableau de bord, où une session est affichée et fermée par une empreinte de son
jeton. Ce qu’une session retient de l’appareil est un résumé de l’agent utilisateur
(« Firefox 131 · Windows »), jamais l’en-tête, plus l’adresse et l’heure
d’ouverture. Les sessions ouvertes avant cette version n’ont ni l’un ni l’autre.

Votre propre session ne se ferme pas d’ici — déconnectez-vous, ce qui efface aussi
le cookie. **Déconnecter**, dans Utilisateurs, ferme toutes les sessions d’un
compte (le vôtre : toutes sauf celle-ci) ; le mot de passe ne change pas.

## Le journal d’audit

Conservé sur le disque, contrairement à tout le reste ici, parce qu’il répond à des
questions posées après coup. `audit.jsonl` dans le dossier de données, un objet
JSON par ligne, les 2 000 dernières entrées ; il voyage avec une migration comme
tous les autres fichiers.

Une entrée ne contient jamais un mot de passe, une clé, un jeton, un prompt ni la
VALEUR d’un réglage : un réglage modifié note quels champs ont changé, si bien que
« la clé du fournisseur d’images a été remplacée » se voit et que la clé ne se voit
pas. Tout détail dont le nom évoque un secret est écarté, quel que soit l’appelant.
Une connexion échouée note le nom de compte essayé, jamais le mot de passe essayé.

## L’annonce

Rangée dans `config.json` à côté de l’état de maintenance et publiée par
`GET /api/config`, que chaque onglet interroge déjà toutes les minutes et qu’un
visiteur déconnecté lit aussi. Texte brut, 500 caractères au plus, un ton
information ou avertissement, et une date de fin facultative — une annonce sur le
redémarrage de ce soir encore affichée la semaine prochaine apprend aux gens à ne
plus lire le bandeau.

Elle peut commencer tout de suite ou à la date choisie, jusqu’à un an à l’avance.
Avant son début, personne ne la voit sauf le tableau de bord, où elle apparaît
comme *programmée* ; la durée se compte à partir du début, si bien que « 4 heures à
partir de vendredi 20 h » se termine à minuit. Il y a une annonce à la fois :
publier ou programmer remplace l’annonce actuelle.

**Les dates du texte s’affichent dans le fuseau de chaque lecteur.** *Insérer une
date* place un instant dans le message — `{{datetime:2026-09-29T01:22:00.000Z}}`,
ou `date:` / `time:` pour une moitié — et chaque navigateur l’écrit sur sa propre
horloge et dans la langue de l’interface : « Mise à jour prévue le 29/09/2026 à
03h22 » à Paris, « …le 28/09/2026 à 21h22 » à Montréal. Le survol nomme le fuseau.
Écrire l’heure de l’administrateur dans le texte ne serait juste que pour ceux qui
partagent son fuseau. Le serveur refuse une date illisible plutôt que d’afficher
`{{date:demain}}` à tout le monde (`server/admin/announcement.js`,
`src/lib/announcementText.ts`).

Chacun peut la masquer. Un nouveau texte reçoit un nouvel identifiant et revient
chez tous ; changer seulement le début ou la fin garde l’identifiant, pour qu’une
coquille corrigée dans une date ne fasse pas revenir un bandeau que tout le monde a
fermé.

## Ce que cela coûte

- **Une réponse ouverte par tableau de bord ouvert**, un envoi toutes les
  2 secondes (Server-Sent Events : aucune dépendance, reconnexion automatique,
  passe un proxy inverse ; Nginx reçoit `X-Accel-Buffering: no`).
- **Un battement par onglet toutes les 30 secondes.**
- **Une mesure toutes les 5 secondes**, une poignée d’appels système. Le GPU lance
  un processus seulement quand le tableau de bord est ouvert, une fois par minute
  sinon, et jamais au démarrage.
- **Mémoire** : une heure de mesures (720) et 5 000 événements d’activité au plus.
- **Disque** : le journal d’audit seulement.
