/**
 * Translations for the "settings" area.
 *
 * One file per area so several people (or agents) can add strings at once
 * without ever touching the same file. `parts/index.ts` merges them all.
 *
 * Rules:
 *  - the key set of `fr` and `en` must match exactly — a test enforces it;
 *  - keys are `settings.something`, so an area can never collide with another;
 *  - placeholders are `{name}`.
 */
export const settings = {
  fr: {
    // ---- personal settings, chrome ----
    'settings.heading': 'Votre compte et votre modèle',
    'settings.saved': 'Enregistré',
    'settings.savedLower': 'enregistré',
    'settings.saving': 'Enregistrement…',
    'settings.instance': 'Instance',

    'settings.pwChangeRequested': 'Changement de mot de passe demandé',
    'settings.pwChangeRequestedHelp':
      'Votre administrateur a créé ou réinitialisé ce compte et demande que vous choisissiez votre propre mot de passe ci-dessous.',

    'settings.managedBlurb':
      'L’administrateur a choisi ce modèle pour tout le monde. Vous n’avez rien à renseigner ici : ni fournisseur, ni adresse, ni clé.',
    'settings.museDossierWith': 'Muse écrit son Design Dossier avec',

    // ---- provider form ----
    'settings.providerConnection': 'Connexion au fournisseur',
    'settings.baseUrlHint': 'Par défaut : {url}',
    'settings.apiKeyHint':
      'Envoyée en jeton Bearer. Conservée uniquement dans le stockage local de ce navigateur.',
    'settings.show': 'Afficher',
    'settings.hide': 'Masquer',
    'settings.modelHint': 'par ex. {model}',
    'settings.modelsLoading': 'Chargement des modèles…',
    'settings.modelsChoose': 'Choisissez un modèle…',
    'settings.modelsNone': 'Aucun modèle chargé — rechargez la liste',
    'settings.modelsReload': 'Recharger la liste des modèles du fournisseur',
    'settings.modelsLoadFailed': 'Impossible de charger la liste des modèles.',
    'settings.modelsNoListing':
      'Aucune liste de modèles à cette adresse : vérifiez l’URL de base, ou saisissez l’identifiant du modèle dans le champ ci-dessous.',
    'settings.apiKeyWhere': 'Créer une clé :',
    'settings.providerGroup.vendor': 'Éditeurs de modèles',
    'settings.providerGroup.host': 'Hébergeurs et passerelles',
    'settings.providerGroup.custom': 'Adresse personnalisée',
    'settings.modelsCount_one': 'modèle disponible chez ce fournisseur.',
    'settings.modelsCount_other': 'modèles disponibles chez ce fournisseur.',
    'settings.modelCustom': 'Modèle personnalisé',
    'settings.modelCustomPlaceholder': 'ou saisissez un modèle, par ex. {model}',

    'settings.generation': 'Génération',
    'settings.usePlanner': 'Utiliser le planificateur (plus lent, meilleure structure)',
    'settings.usePlannerHelp':
      'Une passe rapide qui planifie la mise en page, les sections et le contenu de l’écran avant l’écriture du code. Ajoute quelques secondes ; abandonnée automatiquement en cas d’échec ou de délai dépassé.',

    'settings.availableModels': 'Modèles disponibles',
    'settings.useThisModel': 'Utiliser ce modèle',

    'settings.langHelp': 'La langue de l’interface. Le choix est conservé dans ce navigateur.',
    'settings.footerNote':
      'Les réglages du modèle sont conservés dans ce navigateur. Rendez-vous dans un projet pour générer un écran.',

    // ---- your own password ----
    'settings.signInToChangePassword': 'Connectez-vous pour changer votre mot de passe.',
    'settings.accountIs': 'Compte',
    'settings.passwordChangeSignsOut':
      'Changer le mot de passe déconnecte vos autres appareils ; cette session reste ouverte.',
    'settings.currentPassword': 'Mot de passe actuel',
    'settings.newPassword': 'Nouveau mot de passe',
    'settings.confirmPassword': 'Confirmer le nouveau mot de passe',
    'settings.minChars': 'Au moins {n} caractères.',
    'settings.minCharsPlaceholder': 'au moins {n} caractères',
    'settings.passwordMismatch': 'Les deux saisies ne correspondent pas.',
    'settings.changePassword': 'Changer le mot de passe',
    'settings.changingPassword': 'Changement…',
    'settings.passwordNotChanged': 'Mot de passe non changé',
    'settings.passwordChanged': 'Mot de passe changé',
    'settings.otherDevicesSignedOut': 'Vos autres appareils ont été déconnectés.',

    // ---- admin: accounts ----
    'settings.adminBlurb': 'Gérez les comptes et les inscriptions de cette instance Mocky.',
    'settings.access': 'Accès',
    'settings.allowSignupsHelp':
      'Désactivé, vous seul créez les comptes (ci-dessous). Les visiteurs peuvent toujours se connecter.',
    'settings.role': 'Rôle',
    'settings.roleUser': 'utilisateur',
    'settings.roleAdmin': 'administrateur',
    'settings.roleAdminShort': 'admin',
    'settings.mustChangeFirstLogin': 'Demander un nouveau mot de passe à la première connexion',
    'settings.mustChangeFirstLoginHelp':
      'Le compte est signalé jusqu’à ce que la personne choisisse elle-même son mot de passe dans ses réglages.',
    'settings.creating': 'Création…',
    'settings.createAccount': 'Créer le compte',
    'settings.accountCreated': 'Compte « {name} » créé.',
    'settings.accountDeleted': 'Compte « {name} » supprimé.',
    'settings.deleteAccountConfirm':
      'Supprimer le compte « {name} » et tous ses projets ? C’est définitif.',
    'settings.deleteAccountOf': 'Supprimer le compte « {name} »',
    'settings.mustChangeBadge': 'mot de passe à changer',
    'settings.mustChangeBadgeTitle':
      'Un nouveau mot de passe sera demandé à la prochaine connexion',
    'settings.you': 'vous',

    // ---- admin: password reset ----
    'settings.resetPasswordOf': 'Réinitialiser le mot de passe de « {name} »',
    'settings.passwordResetNotice':
      'Mot de passe de « {name} » réinitialisé. Ses sessions ont été fermées.',
    'settings.resetPasswordTitle': 'Réinitialiser le mot de passe — {name}',
    'settings.resetting': 'Réinitialisation…',
    'settings.reset': 'Réinitialiser',
    'settings.resetSelfBlurb':
      'Vous réinitialisez votre propre mot de passe. Vos autres appareils seront déconnectés ; cette session reste ouverte.',
    'settings.resetOtherBlurb':
      'Toutes les sessions de « {name} » seront fermées. Transmettez-lui ce mot de passe par un canal sûr.',
    'settings.dashyAccount': 'Compte Dashy',
    'settings.dashyAccountHelp':
      'Ce compte se connecte via Dashy. Définir un mot de passe ici lui ajoute une connexion locale, en plus du SSO.',
    'settings.mustChangeShort': 'Demander le changement à la première connexion',
    'settings.mustChangeShortHelp':
      'Recommandé : vous connaissez ce mot de passe, la personne concernée devrait être la seule à connaître le suivant.',
    'settings.resetFailed': 'Réinitialisation impossible',

    // ---- admin: text providers ----
    'settings.textModelsTitle': 'Modèles de texte (LLM)',
    'settings.textModelsBlurb1': 'Trois modèles',
    'settings.textModelsBlurbStrong1': 'qui écrivent du texte',
    'settings.textModelsBlurb2': '. Défini ici, un modèle s’applique à',
    'settings.textModelsBlurbStrong2': 'toute l’instance',
    'settings.textModelsBlurb3': 'et les utilisateurs n’ont plus rien à configurer.',

    'settings.imageNotHereLead': 'Ce n’est pas ici que l’image d’inspiration est générée.',
    'settings.imageNotHereBody1': 'Le modèle qui',
    'settings.imageNotHereMakes': 'fabrique',
    'settings.imageNotHereBody2': 'l’image (Seedream, Flux, nano-banana…) se règle dans',
    'settings.imageFlow1':
      '. Muse enchaîne les deux : ② écrit le dossier et la description de l’image → le modèle d’images la fabrique → ② (ou ①) la',
    'settings.imageFlowLooks': 'regarde',
    'settings.imageFlow2': 'pour composer l’écran.',

    'settings.keyOnServer1': 'La clé est stockée',
    'settings.keyOnServerStrong': 'sur ce serveur',
    'settings.keyOnServer2':
      'et utilisable par tous les comptes de l’instance. Laissez « Aucun » pour conserver le mode historique où chaque clé reste dans le navigateur de son utilisateur.',

    'settings.textProfileGeneration': '① Génération des écrans',
    'settings.textProfileGenerationBlurb':
      'Le modèle qui écrit le code des écrans et fait tourner le planner. C’est le modèle principal.',
    'settings.textEmptyGeneration': 'Aucun — chaque utilisateur configure le sien',
    'settings.textProfileInspiration': '② Muse — texte du Design Dossier',
    'settings.textInsp1': 'Le modèle qui',
    'settings.textInspWrites': 'rédige',
    'settings.textInsp2': 'le Design Dossier (concept, palette, vrais textes) et qui',
    'settings.textInspLooks': 'regarde',
    'settings.textInsp3':
      'l’image d’inspiration une fois qu’elle existe. Il n’écrit pas de code : un modèle moins cher suffit — mais le mode',
    'settings.textInsp4': 'exige la',
    'settings.textInspVision': 'vision',
    'settings.textInspFaint':
      'Ce n’est pas lui qui fabrique l’image. Laissez « Aucun » pour réutiliser le modèle de génération.',
    'settings.textEmptyInspiration': 'Aucun — réutilise le modèle de génération',

    'settings.textHintNone':
      'Aucun fournisseur défini pour l’instance : chaque utilisateur configure le sien dans Réglages (la clé reste dans son navigateur).',
    'settings.textHintOllamaCloud':
      'Ollama Cloud (ou une instance Ollama locale — indiquez son URL). Dialecte natif.',
    'settings.textHintOpenai': 'API OpenAI officielle. Modèles : gpt-4o-mini, gpt-4o, o4-mini…',
    'settings.textHintAnthropic':
      'API Claude officielle, via sa couche compatible OpenAI. Modèles : claude-opus-5-5, claude-sonnet-5-5, claude-haiku-5-5, claude-sonnet-4-5… Utilisez « Lister les modèles » pour voir ce que votre clé ouvre. Depuis Claude 4.7, les modèles fixent leur température : Mocky ne leur en envoie pas.',
    'settings.textHintOpenrouter':
      'Une clé, des centaines de modèles. Le modèle s’écrit « éditeur/modèle », ex. openai/gpt-4o-mini.',
    'settings.textHintFal':
      'Votre clé fal.ai (la même que pour les images) donne aussi accès aux LLM. Ce champ n’est PAS pour un modèle d’images : fal expose ses LLM via OpenRouter, donc le modèle s’écrit « éditeur/modèle » — openai/gpt-4o-mini, google/gemini-2.5-flash, qwen/qwen3.5-flash-02-23… (un id du type fal-ai/…/text-to-image sera refusé). Pour le mode Inspiration, prenez un modèle qui voit les images.',
    'settings.textHintGemini':
      'API Gemini de Google, via sa couche compatible OpenAI (…/v1beta/openai). Clé sur aistudio.google.com/apikey. Modèles : gemini-3.8-flash, gemini-3.1-pro-preview…',
    'settings.textHintMistral':
      'API officielle de Mistral AI. Clé sur console.mistral.ai. Modèles : mistral-medium-latest, mistral-large-latest, codestral-latest…',
    'settings.textHintDeepseek':
      'API officielle de DeepSeek. Clé sur platform.deepseek.com. Modèles : deepseek-flash, deepseek-v4-pro. Pas de sortie structurée par schéma : Mocky passe en mode JSON simple.',
    'settings.textHintXai':
      'API de xAI (Grok), par son interface Chat Completions. Clé sur console.x.ai. Modèles : grok-4.7, grok-4.3…',
    'settings.textHintMoonshot':
      'API Kimi de Moonshot AI. Clé sur platform.kimi.ai. Modèles : kimi-k3, kimi-k2.7-code… La température est fixée par Kimi : Mocky ne l’envoie pas.',
    'settings.textHintGroq':
      'Inférence très rapide de modèles ouverts. Clé sur console.groq.com/keys. Modèles : openai/gpt-oss-120b, llama-3.3-70b-versatile…',
    'settings.textHintTogether':
      'Des centaines de modèles ouverts. Clé sur api.together.ai. Le modèle s’écrit « éditeur/modèle », ex. openai/gpt-oss-120b.',
    'settings.textHintFireworks':
      'Modèles ouverts hébergés par Fireworks. Clé sur fireworks.ai. Le modèle s’écrit en entier : accounts/fireworks/models/…',
    'settings.textHintCerebras':
      'Inférence très rapide sur puces Cerebras. Clé sur cloud.cerebras.ai. Modèles : gpt-oss-120b, qwen-3.8-27b…',
    'settings.textHintHuggingface':
      'Un jeton Hugging Face (droit « Inference Providers ») ouvre les modèles de plusieurs hébergeurs. Jeton sur huggingface.co/settings/tokens. Modèles : openai/gpt-oss-120b, avec « :cheapest » ou « :groq » en suffixe pour choisir l’hébergeur.',
    'settings.textHintOpenaiCompatible':
      'Tout autre endpoint au format OpenAI : Qwen (DashScope), Cohere, LM Studio, vLLM… Collez l’URL de base que donne sa documentation, version comprise (ex. …/compatible-mode/v1).',

    'settings.baseUrlRule':
      'Collez l’URL de base telle que la donne la documentation : Mocky ajoute /v1 seulement si elle ne se termine pas déjà par une version (…/v1, …/v1beta/openai).',
    // ---- vidéo au défilement ----
    'settings.videoTitle': 'Vidéo au défilement',
    'settings.videoBlurb':
      'Muse peut générer un plan vidéo pour le héro d’un écran. Le clip est découpé en images côté serveur, et l’écran les fait défiler à la vitesse de la molette. Deux conditions : un fournisseur ci-dessous, et ffmpeg dans le conteneur.',
    'settings.videoProvider': 'Fournisseur vidéo',
    'settings.videoProviderOff': 'Désactivé',
    'settings.videoModel': 'Modèle',
    'settings.videoModelHint': 'Identifiant fal, par exemple fal-ai/ltx-video. Les modèles lents rendent de plus beaux plans.',
    'settings.videoKey': 'Clé API',
    'settings.videoTimeout': 'Délai (secondes)',
    'settings.videoTimeoutHint': 'Une vidéo prend souvent 1 à 3 minutes. 600 s laisse de la marge.',
    'settings.framesTitle': 'Découpage des séquences',
    'settings.framesBlurb':
      'Une vidéo est stockée en images numérotées. Ces réglages valent aussi pour les clips que vous importez, et ne changent rien aux séquences déjà découpées — le bouton « Redécouper » du lecteur s’en charge, clip par clip.',
    'settings.framesFps': 'Images par seconde',
    'settings.framesFpsHint': 'De 4 à 30. Plus haut = plus fluide à la lecture, et plus de disque.',
    'settings.framesWidth': 'Largeur d’une image',
    'settings.framesWidthHint': 'De 320 à 1920 px sur le bord long.',
    'settings.framesMax': 'Images au maximum',
    'settings.framesMaxHint': 'De 10 à 600. C’est ce qui borne la durée, voir ci-dessous.',
    'settings.videosSectionTitle': 'Vidéos (Muse)',
    'settings.videoAccessTitle': 'Accès aux vidéos',
    'settings.videoAccessBlurb':
      'Qui peut utiliser une vidéo dans un écran, et laquelle. Une vidéo générée coûte à chaque clip ; une vidéo libre de droits est gratuite. Un compte qui n’a ni l’une ni l’autre ne voit aucune option vidéo.',
    'settings.videoAccessGenerated': 'Vidéos générées par IA',
    'settings.videoAccessGeneratedHelp': 'Payantes, créées par le fournisseur vidéo configuré ci-dessus.',
    'settings.videoAccessGeneratedList': 'Comptes autorisés à générer',
    'settings.videoAccessStock': 'Vidéos gratuites',
    'settings.videoAccessStockHelp': 'Pexels et Pixabay, plus les clips que le compte importe lui-même.',
    'settings.videoAccessStockList': 'Comptes autorisés aux vidéos gratuites',
    'settings.videoAccessEmpty': 'Aucun compte coché : personne n’y a accès.',
    'settings.videoAccessAllNote': 'Les {total} comptes de l’instance y ont accès.',
    'settings.videoAccessNote':
      'Un administrateur n’a pas accès d’office : cochez aussi votre propre compte si la liste est restreinte. Un compte qui a au moins un des deux accès peut importer ses propres clips.',
    'settings.stockTitle': 'Vidéos et photos libres de droits',
    'settings.stockBlurb':
      'Pexels et Pixabay offrent des vidéos et des photos gratuites, utilisables librement. Collez la clé API gratuite de l’une ou des deux : la recherche apparaît alors dans Média (onglets Vidéos et Images), et le composeur peut remplacer les images générées par de vraies photos. Sans clé, rien ne s’affiche.',
    'settings.stockImagesTitle': 'Photos libres de droits',
    'settings.stockImagesBlurb':
      'Au lieu de générer les images de Muse et de Motion Ultra, le composeur peut aller chercher de vraies photos chez Pexels et Pixabay (choix « Images : Libres »). Aucun coût, rien de généré ; le crédit du photographe est conservé.',
    'settings.stockImagesKeys': 'Actif avec les clés {names} enregistrées dans « Vidéos et photos libres de droits ».',
    'settings.stockImagesNoKey':
      'Aucune clé Pexels ou Pixabay n’est enregistrée : collez-en une dans « Vidéos et photos libres de droits », plus bas. Sans clé, cette option n’apparaît nulle part.',
    'settings.stockImagesAccess': 'Qui peut utiliser les photos libres',
    'settings.stockImagesAccessHelp': 'Dans le composeur et dans Média → Images.',
    'settings.stockImagesAccessList': 'Comptes autorisés aux photos libres',
    'settings.stockImagesNote':
      'Un administrateur n’a pas accès d’office : cochez aussi votre propre compte si la liste est restreinte. Liste restreinte sans aucun compte coché = option fermée à tous.',
    'settings.stockKey': 'Clé API {name}',
    'settings.stockKeyWhere': 'Gratuite : il suffit d’un compte.',
    'settings.stockGetKey': 'Obtenir une clé gratuite',
    'settings.stockTest': 'Tester',
    'settings.stockTesting': 'Test…',
    'settings.stockTestOk': 'La clé fonctionne ({count} vidéos trouvées pour « nature »).',
    'settings.stockRemove': 'Retirer la clé',
    'settings.framesBudget':
      '{frames} images à {fps} par seconde = {seconds} s de clip au maximum. Au-delà, la fin est coupée.',
    'settings.videoRecheck': 'Revérifier',
    'settings.videoStatusProviderOn': 'Fournisseur prêt — {model}',
    'settings.videoStatusProviderOff': 'Aucun fournisseur vidéo : la case reste grisée dans Muse.',
    'settings.videoStatusFfmpegOn': 'ffmpeg disponible',
    'settings.videoStatusFfmpegOff': 'ffmpeg indisponible : {reason}',

    'settings.keyStored': 'clé enregistrée',
    'settings.clearKey': 'effacer',
    'settings.clearKeyConfirm': 'Effacer la clé enregistrée ?',
    'settings.keyStoredPlaceholder': '•••••••• (enregistrée)',
    'settings.tokenStoredPlaceholder': '•••••••• (enregistré)',
    'settings.noKeyStored': 'aucune clé enregistrée',
    'settings.noKeyStoredLocal': 'aucune clé enregistrée (inutile pour un modèle local)',
    'settings.testShort': 'Tester',
    // Distinct from the settings.models* set above, which belongs to the
    // per-browser provider form. These are the instance provider's, in Admin.
    'settings.adminModelsList': 'Lister les modèles',
    'settings.adminModelsLoading': 'Chargement…',
    'settings.adminModelsPick': 'Choisir parmi {count} modèles…',
    'settings.adminModelsNone': 'Aucun modèle de texte renvoyé par ce fournisseur.',
    'settings.testReply': '{model} répond : « {reply} »',
    'settings.imageModelWarnLead':
      '« {model} » ressemble à un modèle d’images. Ce champ attend un',
    'settings.imageModelWarnLLM': 'LLM (texte)',
    'settings.imageModelWarnExamples': '— par ex.',
    'settings.imageModelWarnWhere': 'Les modèles d’images se règlent dans',

    // ---- admin: image providers ----
    'settings.imagesSectionTitle': 'Génération d’images (Muse)',
    'settings.imagesBlurb1': 'Muse génère',
    'settings.imagesBlurbStrong': 'trois sortes d’images',
    'settings.imagesBlurb2':
      ', et peu de modèles sont bons aux trois. Vous pouvez donc en choisir un pour chacune. Les clés sont stockées sur ce serveur et ne sont jamais renvoyées au navigateur ; si un service échoue, Muse retombe sur des placeholders.',

    'settings.imgLabelPollinations': 'Pollinations — gratuit, sans clé (défaut)',
    'settings.imgLabelFal': 'fal.ai — FLUX & co.',
    'settings.imgLabelOpenai': 'OpenAI / compatible — DALL·E, gpt-image',
    'settings.imgLabelCloudflare': 'Cloudflare Workers AI',
    'settings.imgLabelSdWebui': 'Automatic1111 / Forge — local (votre GPU)',
    'settings.imgLabelNone': 'Aucun — placeholders uniquement',

    'settings.imgHintInherit':
      'Le même modèle que pour les images de contenu. Choisissez-en un autre si vous voulez une maquette d’inspiration plus soignée sans ralentir les photos hero/produits.',
    'settings.imgHintPollinations':
      'Aucune configuration requise. Limité à ~1 image / 15 s (les requêtes sont mises en file). Un jeton gratuit augmente la limite.',
    'settings.imgHintFal':
      'Clé fal.ai + identifiant du modèle, copié tel quel depuis la page du modèle (tous ne sont pas sous « fal-ai/ »). Mocky passe par la file d’attente fal, donc les modèles lents fonctionnent.',
    'settings.imgHintOpenai':
      'Tout endpoint exposant POST {URL}/v1/images/generations (OpenAI, LiteLLM, passerelle compatible…).',
    'settings.imgHintCloudflare':
      'Offre gratuite généreuse. Nécessite l’ID de compte et un jeton API avec la permission Workers AI.',
    'settings.imgHintSdWebui':
      'Votre instance locale (API activée : --api). Aucune clé, aucune limite, rien ne sort de votre machine.',
    'settings.imgHintNone':
      'La génération d’images est désactivée : Muse fonctionne toujours, les emplacements reçoivent un placeholder issu de la palette.',

    'settings.tokenOptional': 'Jeton (optionnel)',
    'settings.pollinationsTokenPlaceholder': 'jeton Pollinations — optionnel',
    'settings.falModelHint1':
      'Copiez l’id exact depuis la page du modèle — tous ne sont pas sous',
    'settings.falModelHint2': '. Ex.',
    'settings.falModelHintFast': '(rapide) ou',
    'settings.falModelHintSlow': '(lent, ~2 min).',
    'settings.timeoutSeconds': 'Délai max (secondes)',
    'settings.timeoutHint': 'Augmentez-le pour un modèle lent (Seedream Pro ≈ 110 s).',
    'settings.falKeyPlaceholder': 'votre clé fal.ai',
    'settings.cfAccountId': 'Account ID',
    'settings.apiToken': 'Jeton API',
    'settings.cfTokenPlaceholder': 'jeton avec la permission Workers AI',
    'settings.instanceUrl': 'URL de l’instance',
    'settings.sdSteps': 'Steps',
    'settings.sdWebuiWarn':
      'Cette adresse est appelée par le serveur Mocky lui-même — utilisez uniquement une instance de confiance.',
    'settings.testImage': 'Tester (génère une image)',
    'settings.imgTestSkipped': 'fournisseur « aucun » — placeholders',
    'settings.imgTestOk': 'image générée ({kb} Ko)',

    'settings.imgProfileInspiration': 'Image d’inspiration',
    'settings.imgInsp1': 'La',
    'settings.imgInspRef': 'maquette de référence',
    'settings.imgInsp2':
      'montrée au LLM pour orienter la direction artistique (mode Inspiration). Une seule par écran : un modèle plus lent et plus cher se justifie, s’il rend bien une mise en page de site ou d’app.',
    'settings.imgInspFaint': 'Laissez « Aucun » pour réutiliser le modèle de contenu.',
    'settings.imgEmptyInspiration': 'Aucun — réutilise le modèle de contenu',
    'settings.imgProfileContent': 'Images de contenu',
    'settings.imgContent1': 'Les photos',
    'settings.imgContentEmbedded': 'intégrées dans l’écran',
    'settings.imgContent2':
      ' : hero, produits, arrière-plans (modes Contenu et Les deux). Il peut y en avoir plusieurs par écran — privilégiez un modèle',
    'settings.imgContentFastCheap': 'rapide et bon marché',

    'settings.imgProfileEdit': 'Édition d’image (image-to-image)',
    'settings.imgEdit1': 'Retoucher une image existante :',
    'settings.imgEditFromImage': 'une image entre, une dérivée sort',
    'settings.imgEdit2':
      '. Ce n’est pas un modèle de texte-vers-image plus puissant, c’est un autre point d’entrée, que la plupart des identifiants de modèles n’ont pas.',
    'settings.imgEditFaint':
      'Laissez « Aucun » et l’édition d’image reste désactivée : rien ne prend le relais, car un modèle de texte-vers-image ne dériverait rien de votre image.',
    'settings.imgEmptyEdit': 'Aucun — pas d’édition d’image sur cette instance',
    'settings.imgHintEditOff':
      'Désactivé. Contrairement à l’image d’inspiration, ce profil ne réutilise pas le modèle de contenu : un modèle de texte-vers-image ignorerait votre image et rendrait une création issue du seul texte, présentée comme une dérivée. Mocky préfère ne rien proposer.',
    'settings.imgEditRestriction':
      'Seuls les fournisseurs capables d’accepter une image en entrée sont proposés. Pollinations en est absent : son API ne prend qu’une URL publiquement joignable, or les images de Mocky ne sont servies que par ce serveur. Côté Cloudflare, indiquez un modèle « img2img » — celui du profil de contenu ne sait faire que du texte-vers-image.',
  } as Record<string, string>,

  en: {
    // ---- personal settings, chrome ----
    'settings.heading': 'Your account and your model',
    'settings.saved': 'Saved',
    'settings.savedLower': 'saved',
    'settings.saving': 'Saving…',
    'settings.instance': 'Instance',

    'settings.pwChangeRequested': 'Password change requested',
    'settings.pwChangeRequestedHelp':
      'Your administrator created or reset this account and is asking you to choose your own password below.',

    'settings.managedBlurb':
      'An administrator picked this model for everyone. There is nothing for you to fill in here: no provider, no address, no key.',
    'settings.museDossierWith': 'Muse writes its Design Dossier with',

    // ---- provider form ----
    'settings.providerConnection': 'Provider connection',
    'settings.baseUrlHint': 'Default: {url}',
    'settings.apiKeyHint':
      'Sent as a Bearer token. Kept only in this browser’s local storage.',
    'settings.show': 'Show',
    'settings.hide': 'Hide',
    'settings.modelHint': 'e.g. {model}',
    'settings.modelsLoading': 'Loading models…',
    'settings.modelsChoose': 'Pick a model…',
    'settings.modelsNone': 'No model loaded — reload the list',
    'settings.modelsReload': 'Reload the provider’s model list',
    'settings.modelsLoadFailed': 'Could not load the model list.',
    'settings.modelsNoListing': 'No model list at this address: check the base URL, or type the model id in the field below.',
    'settings.apiKeyWhere': 'Get a key:',
    'settings.providerGroup.vendor': 'Model makers',
    'settings.providerGroup.host': 'Hosts and routers',
    'settings.providerGroup.custom': 'Custom endpoint',
    'settings.modelsCount_one': 'model available from this provider.',
    'settings.modelsCount_other': 'models available from this provider.',
    'settings.modelCustom': 'Custom model',
    'settings.modelCustomPlaceholder': 'or type a model, e.g. {model}',

    'settings.generation': 'Generation',
    'settings.usePlanner': 'Use the planner (slower, better structure)',
    'settings.usePlannerHelp':
      'A quick pass that plans the screen’s layout, sections and content before the code is written. Adds a few seconds; dropped automatically if it fails or times out.',

    'settings.availableModels': 'Available models',
    'settings.useThisModel': 'Use this model',

    'settings.langHelp': 'The language of the interface. The choice is kept in this browser.',
    'settings.footerNote':
      'Model settings are kept in this browser. Open a project to generate a screen.',

    // ---- your own password ----
    'settings.signInToChangePassword': 'Sign in to change your password.',
    'settings.accountIs': 'Account',
    'settings.passwordChangeSignsOut':
      'Changing your password signs your other devices out; this session stays open.',
    'settings.currentPassword': 'Current password',
    'settings.newPassword': 'New password',
    'settings.confirmPassword': 'Confirm the new password',
    'settings.minChars': 'At least {n} characters.',
    'settings.minCharsPlaceholder': 'at least {n} characters',
    'settings.passwordMismatch': 'The two entries do not match.',
    'settings.changePassword': 'Change password',
    'settings.changingPassword': 'Changing…',
    'settings.passwordNotChanged': 'Password not changed',
    'settings.passwordChanged': 'Password changed',
    'settings.otherDevicesSignedOut': 'Your other devices have been signed out.',

    // ---- admin: accounts ----
    'settings.adminBlurb': 'Manage the accounts and sign-ups of this Mocky instance.',
    'settings.access': 'Access',
    'settings.allowSignupsHelp':
      'Turned off, you are the only one who creates accounts (below). Visitors can still sign in.',
    'settings.role': 'Role',
    'settings.roleUser': 'user',
    'settings.roleAdmin': 'administrator',
    'settings.roleAdminShort': 'admin',
    'settings.mustChangeFirstLogin': 'Ask for a new password on first sign-in',
    'settings.mustChangeFirstLoginHelp':
      'The account stays flagged until the person picks their own password in their settings.',
    'settings.creating': 'Creating…',
    'settings.createAccount': 'Create the account',
    'settings.accountCreated': 'Account “{name}” created.',
    'settings.accountDeleted': 'Account “{name}” deleted.',
    'settings.deleteAccountConfirm':
      'Delete the account “{name}” and all its projects? This cannot be undone.',
    'settings.deleteAccountOf': 'Delete the account “{name}”',
    'settings.mustChangeBadge': 'password to change',
    'settings.mustChangeBadgeTitle': 'A new password will be requested on the next sign-in',
    'settings.you': 'you',

    // ---- admin: password reset ----
    'settings.resetPasswordOf': 'Reset the password of “{name}”',
    'settings.passwordResetNotice':
      'Password of “{name}” reset. Their sessions have been closed.',
    'settings.resetPasswordTitle': 'Reset the password — {name}',
    'settings.resetting': 'Resetting…',
    'settings.reset': 'Reset',
    'settings.resetSelfBlurb':
      'You are resetting your own password. Your other devices will be signed out; this session stays open.',
    'settings.resetOtherBlurb':
      'Every session of “{name}” will be closed. Pass this password on through a safe channel.',
    'settings.dashyAccount': 'Dashy account',
    'settings.dashyAccountHelp':
      'This account signs in through Dashy. Setting a password here adds a local sign-in on top of SSO.',
    'settings.mustChangeShort': 'Ask for a change on first sign-in',
    'settings.mustChangeShortHelp':
      'Recommended: you know this password, and the person it belongs to should be the only one who knows the next one.',
    'settings.resetFailed': 'Reset failed',

    // ---- admin: text providers ----
    'settings.textModelsTitle': 'Text models (LLM)',
    'settings.textModelsBlurb1': 'Three models',
    'settings.textModelsBlurbStrong1': 'that write text',
    'settings.textModelsBlurb2': '. Set here, a model applies to',
    'settings.textModelsBlurbStrong2': 'the whole instance',
    'settings.textModelsBlurb3': 'and users have nothing left to configure.',

    'settings.imageNotHereLead': 'This is not where the inspiration image is generated.',
    'settings.imageNotHereBody1': 'The model that actually',
    'settings.imageNotHereMakes': 'makes',
    'settings.imageNotHereBody2': 'the image (Seedream, Flux, nano-banana…) is set under',
    'settings.imageFlow1':
      '. Muse chains the two: ② writes the dossier and the image description → the image model makes the picture → ② (or ①)',
    'settings.imageFlowLooks': 'looks at it',
    'settings.imageFlow2': 'to compose the screen.',

    'settings.keyOnServer1': 'The key is stored',
    'settings.keyOnServerStrong': 'on this server',
    'settings.keyOnServer2':
      'and can be used by every account on the instance. Leave “None” to keep the original behaviour, where each key stays in its own user’s browser.',

    'settings.textProfileGeneration': '① Screen generation',
    'settings.textProfileGenerationBlurb':
      'The model that writes the code of the screens and runs the planner. This is the main model.',
    'settings.textEmptyGeneration': 'None — each user configures their own',
    'settings.textProfileInspiration': '② Muse — Design Dossier copy',
    'settings.textInsp1': 'The model that',
    'settings.textInspWrites': 'writes',
    'settings.textInsp2': 'the Design Dossier (concept, palette, real copy) and that',
    'settings.textInspLooks': 'looks at',
    'settings.textInsp3':
      'the inspiration image once it exists. It writes no code, so a cheaper model is enough — but',
    'settings.textInsp4': 'mode needs',
    'settings.textInspVision': 'vision',
    'settings.textInspFaint':
      'It is not the one that makes the image. Leave “None” to reuse the generation model.',
    'settings.textEmptyInspiration': 'None — reuse the generation model',

    'settings.textHintNone':
      'No provider set for the instance: every user configures their own in Settings (their key stays in their browser).',
    'settings.textHintOllamaCloud':
      'Ollama Cloud (or a local Ollama instance — give its URL). Native dialect.',
    'settings.textHintOpenai': 'The official OpenAI API. Models: gpt-4o-mini, gpt-4o, o4-mini…',
    'settings.textHintAnthropic':
      'The official Claude API, through its OpenAI-compatible surface. Models: claude-opus-5-5, claude-sonnet-5-5, claude-haiku-5-5, claude-sonnet-4-5… Use “List models” to see what your key opens. Since Claude 4.7 the models fix their own temperature, so Mocky does not send them one.',
    'settings.textHintOpenrouter':
      'One key, hundreds of models. Model ids read “vendor/model”, e.g. openai/gpt-4o-mini.',
    'settings.textHintFal':
      'Your fal.ai key (the same one as for images) also gives access to LLMs. This field is NOT for an image model: fal serves its LLMs through OpenRouter, so the model reads “vendor/model” — openai/gpt-4o-mini, google/gemini-2.5-flash, qwen/qwen3.5-flash-02-23… (an id like fal-ai/…/text-to-image will be rejected). For Inspiration mode, pick a model that can see images.',
    'settings.textHintGemini':
      'Google’s Gemini API, through its OpenAI-compatible surface (…/v1beta/openai). Key at aistudio.google.com/apikey. Models: gemini-3.8-flash, gemini-3.1-pro-preview…',
    'settings.textHintMistral':
      'The official Mistral AI API. Key at console.mistral.ai. Models: mistral-medium-latest, mistral-large-latest, codestral-latest…',
    'settings.textHintDeepseek':
      'The official DeepSeek API. Key at platform.deepseek.com. Models: deepseek-flash, deepseek-v4-pro. No schema-based structured output: Mocky falls back to plain JSON mode.',
    'settings.textHintXai':
      'xAI’s API (Grok), through its Chat Completions surface. Key at console.x.ai. Models: grok-4.7, grok-4.3…',
    'settings.textHintMoonshot':
      'Moonshot AI’s Kimi API. Key at platform.kimi.ai. Models: kimi-k3, kimi-k2.7-code… Kimi fixes the temperature, so Mocky does not send one.',
    'settings.textHintGroq':
      'Very fast inference of open models. Key at console.groq.com/keys. Models: openai/gpt-oss-120b, llama-3.3-70b-versatile…',
    'settings.textHintTogether':
      'Hundreds of open models. Key at api.together.ai. Model ids read “vendor/model”, e.g. openai/gpt-oss-120b.',
    'settings.textHintFireworks':
      'Open models hosted by Fireworks. Key at fireworks.ai. Model ids are written in full: accounts/fireworks/models/…',
    'settings.textHintCerebras':
      'Very fast inference on Cerebras hardware. Key at cloud.cerebras.ai. Models: gpt-oss-120b, qwen-3.8-27b…',
    'settings.textHintHuggingface':
      'One Hugging Face token (with the “Inference Providers” permission) opens models from several hosts. Token at huggingface.co/settings/tokens. Models: openai/gpt-oss-120b, with “:cheapest” or “:groq” as a suffix to pick the host.',
    'settings.textHintOpenaiCompatible':
      'Any other OpenAI-style endpoint: Qwen (DashScope), Cohere, LM Studio, vLLM… Paste the base URL its documentation gives, version included (e.g. …/compatible-mode/v1).',

    'settings.baseUrlRule':
      'Paste the base URL as its documentation gives it: Mocky adds /v1 only when it does not already end in a version (…/v1, …/v1beta/openai).',
    // ---- scroll-driven video ----
    'settings.videoTitle': 'Scroll-driven video',
    'settings.videoBlurb':
      'Muse can generate a clip for a screen’s hero. The clip is cut into frames server-side, and the screen scrubs through them at the speed of the scroll wheel. Two prerequisites: a provider below, and ffmpeg in the container.',
    'settings.videoProvider': 'Video provider',
    'settings.videoProviderOff': 'Off',
    'settings.videoModel': 'Model',
    'settings.videoModelHint': 'A fal id, e.g. fal-ai/ltx-video. Slower models produce better shots.',
    'settings.videoKey': 'API key',
    'settings.videoTimeout': 'Timeout (seconds)',
    'settings.videoTimeoutHint': 'A video often takes 1–3 minutes. 600 s leaves room.',
    'settings.framesTitle': 'How clips are cut',
    'settings.framesBlurb':
      'A video is stored as numbered frames. These settings also apply to clips you import, and change nothing about sequences already cut — the player’s “Re-cut” button does that, one clip at a time.',
    'settings.framesFps': 'Frames per second',
    'settings.framesFpsHint': '4 to 30. Higher is smoother to watch, and more disk.',
    'settings.framesWidth': 'Frame width',
    'settings.framesWidthHint': '320 to 1920 px on the long edge.',
    'settings.framesMax': 'Most frames',
    'settings.framesMaxHint': '10 to 600. This is what bounds the duration — see below.',
    'settings.videosSectionTitle': 'Videos (Muse)',
    'settings.videoAccessTitle': 'Video access',
    'settings.videoAccessBlurb':
      'Who may use a video in a screen, and which kind. A generated video costs per clip; a free stock video costs nothing. An account with neither sees no video option at all.',
    'settings.videoAccessGenerated': 'AI-generated videos',
    'settings.videoAccessGeneratedHelp': 'Paid, made by the video provider configured above.',
    'settings.videoAccessGeneratedList': 'Accounts allowed to generate',
    'settings.videoAccessStock': 'Free videos',
    'settings.videoAccessStockHelp': 'Pexels and Pixabay, plus the clips the account imports itself.',
    'settings.videoAccessStockList': 'Accounts allowed free videos',
    'settings.videoAccessEmpty': 'No account ticked: nobody has access.',
    'settings.videoAccessAllNote': 'All {total} accounts on this instance have access.',
    'settings.videoAccessNote':
      'An administrator is not allowed by default: tick your own account too when the list is restricted. An account with at least one of the two may import its own clips.',
    'settings.stockTitle': 'Free stock videos and photos',
    'settings.stockBlurb':
      'Pexels and Pixabay offer free videos and photos anyone may reuse. Paste the free API key of one or both: search then appears in Media (Videos and Images tabs), and the composer can replace generated pictures with real photos. Without a key, nothing is shown.',
    'settings.stockImagesTitle': 'Free stock photos',
    'settings.stockImagesBlurb':
      'Instead of generating Muse’s and Motion Ultra’s pictures, the composer can fetch real photos from Pexels and Pixabay (the “Images: Free” choice). No cost, nothing generated; the photographer’s credit is kept.',
    'settings.stockImagesKeys': 'On, with the {names} keys stored under “Free stock videos and photos”.',
    'settings.stockImagesNoKey':
      'No Pexels or Pixabay key is stored: paste one under “Free stock videos and photos”, below. Without a key, this option appears nowhere.',
    'settings.stockImagesAccess': 'Who may use free photos',
    'settings.stockImagesAccessHelp': 'In the composer and in Media → Images.',
    'settings.stockImagesAccessList': 'Accounts allowed free photos',
    'settings.stockImagesNote':
      'An administrator has no access by right: tick your own account too if the list is restricted. A restricted list with no account ticked closes the option to everyone.',
    'settings.stockKey': '{name} API key',
    'settings.stockKeyWhere': 'Free: an account is all it takes.',
    'settings.stockGetKey': 'Get a free key',
    'settings.stockTest': 'Test',
    'settings.stockTesting': 'Testing…',
    'settings.stockTestOk': 'The key works ({count} videos found for “nature”).',
    'settings.stockRemove': 'Remove key',
    'settings.framesBudget':
      '{frames} frames at {fps} per second = {seconds} s of clip at most. Past that, the end is cut off.',
    'settings.videoRecheck': 'Re-check',
    'settings.videoStatusProviderOn': 'Provider ready — {model}',
    'settings.videoStatusProviderOff': 'No video provider: the box stays greyed out in Muse.',
    'settings.videoStatusFfmpegOn': 'ffmpeg available',
    'settings.videoStatusFfmpegOff': 'ffmpeg unavailable: {reason}',

    'settings.keyStored': 'key saved',
    'settings.clearKey': 'clear',
    'settings.clearKeyConfirm': 'Clear the saved key?',
    'settings.keyStoredPlaceholder': '•••••••• (saved)',
    'settings.tokenStoredPlaceholder': '•••••••• (saved)',
    'settings.noKeyStored': 'no key saved',
    'settings.noKeyStoredLocal': 'no key saved (not needed for a local model)',
    'settings.testShort': 'Test',
    'settings.adminModelsList': 'List models',
    'settings.adminModelsLoading': 'Loading…',
    'settings.adminModelsPick': 'Pick from {count} models…',
    'settings.adminModelsNone': 'This provider returned no text models.',
    'settings.testReply': '{model} answers: “{reply}”',
    'settings.imageModelWarnLead':
      '“{model}” looks like an image model. This field expects an',
    'settings.imageModelWarnLLM': 'LLM (text)',
    'settings.imageModelWarnExamples': '— e.g.',
    'settings.imageModelWarnWhere': 'Image models are set under',

    // ---- admin: image providers ----
    'settings.imagesSectionTitle': 'Image generation (Muse)',
    'settings.imagesBlurb1': 'Muse generates',
    'settings.imagesBlurbStrong': 'three kinds of image',
    'settings.imagesBlurb2':
      ', and few models are good at all three, so you can pick one for each. Keys are stored on this server and are never sent back to the browser; if a service fails, Muse falls back to placeholders.',

    'settings.imgLabelPollinations': 'Pollinations — free, no key (default)',
    'settings.imgLabelFal': 'fal.ai — FLUX & co.',
    'settings.imgLabelOpenai': 'OpenAI / compatible — DALL·E, gpt-image',
    'settings.imgLabelCloudflare': 'Cloudflare Workers AI',
    'settings.imgLabelSdWebui': 'Automatic1111 / Forge — local (your GPU)',
    'settings.imgLabelNone': 'None — placeholders only',

    'settings.imgHintInherit':
      'The same model as for content images. Pick a different one if you want a more polished inspiration mockup without slowing down hero and product shots.',
    'settings.imgHintPollinations':
      'Nothing to configure. Limited to ~1 image / 15 s (requests are queued). A free token raises the limit.',
    'settings.imgHintFal':
      'A fal.ai key plus the model id, copied exactly from the model’s page (not all of them live under “fal-ai/”). Mocky goes through fal’s queue, so slow models work.',
    'settings.imgHintOpenai':
      'Any endpoint exposing POST {URL}/v1/images/generations (OpenAI, LiteLLM, a compatible gateway…).',
    'settings.imgHintCloudflare':
      'A generous free tier. Needs the account ID and an API token with the Workers AI permission.',
    'settings.imgHintSdWebui':
      'Your local instance (API enabled: --api). No key, no quota, nothing leaves your machine.',
    'settings.imgHintNone':
      'Image generation is off: Muse still works, and every image slot gets a placeholder drawn from the palette.',

    'settings.tokenOptional': 'Token (optional)',
    'settings.pollinationsTokenPlaceholder': 'Pollinations token — optional',
    'settings.falModelHint1':
      'Copy the exact id from the model’s page — not all of them live under',
    'settings.falModelHint2': '. E.g.',
    'settings.falModelHintFast': '(fast) or',
    'settings.falModelHintSlow': '(slow, ~2 min).',
    'settings.timeoutSeconds': 'Max wait (seconds)',
    'settings.timeoutHint': 'Raise it for a slow model (Seedream Pro ≈ 110 s).',
    'settings.falKeyPlaceholder': 'your fal.ai key',
    'settings.cfAccountId': 'Account ID',
    'settings.apiToken': 'API token',
    'settings.cfTokenPlaceholder': 'token with the Workers AI permission',
    'settings.instanceUrl': 'Instance URL',
    'settings.sdSteps': 'Steps',
    'settings.sdWebuiWarn':
      'This address is called by the Mocky server itself — only point it at an instance you trust.',
    'settings.testImage': 'Test (generates an image)',
    'settings.imgTestSkipped': 'provider “none” — placeholders',
    'settings.imgTestOk': 'image generated ({kb} KB)',

    'settings.imgProfileInspiration': 'Inspiration image',
    'settings.imgInsp1': 'The',
    'settings.imgInspRef': 'reference mockup',
    'settings.imgInsp2':
      'shown to the LLM to steer the art direction (Inspiration mode). Only one per screen, so a slower and pricier model is worth it — as long as it renders a convincing site or app layout.',
    'settings.imgInspFaint': 'Leave “None” to reuse the content model.',
    'settings.imgEmptyInspiration': 'None — reuse the content model',
    'settings.imgProfileContent': 'Content images',
    'settings.imgContent1': 'The pictures',
    'settings.imgContentEmbedded': 'embedded in the screen',
    'settings.imgContent2':
      ': hero, products, backgrounds (Content and Both modes). There can be several per screen — favour a model that is',
    'settings.imgContentFastCheap': 'fast and cheap',

    'settings.imgProfileEdit': 'Image editing (image-to-image)',
    'settings.imgEdit1': 'Reworking an existing picture:',
    'settings.imgEditFromImage': 'an image goes in, a derivative comes out',
    'settings.imgEdit2':
      '. Not a stronger text-to-image model — a different endpoint, which most model ids do not have at all.',
    'settings.imgEditFaint':
      'Leave “None” and image editing stays off: nothing takes over, because a text-to-image model would derive nothing from your picture.',
    'settings.imgEmptyEdit': 'None — no image editing on this instance',
    'settings.imgHintEditOff':
      'Off. Unlike the inspiration image, this profile does not reuse the content model: a text-to-image model would ignore your picture and return one made from the prompt alone, presented as a derivative. Mocky would rather offer nothing.',
    'settings.imgEditRestriction':
      'Only providers that can accept an input image are listed. Pollinations is absent: its API takes a publicly reachable URL, and Mocky’s images are served by this server alone. On Cloudflare, name an “img2img” model — the one in the content profile only does text-to-image.',
  } as Record<string, string>,
}
