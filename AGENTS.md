# Contexte du projet — équipe 15, Hackathon Azuréen #3

Ce fichier donne le contexte du projet aux assistants de code (Codex, Claude Code, Cursor, Copilot…).
Il est **public**, comme tout le dépôt : n'y écrivez rien de confidentiel.

- Codex le lit automatiquement.
- Claude Code : créez à la racine un fichier `CLAUDE.md` contenant la seule ligne `@AGENTS.md`. Ce fichier est ignoré par git, vous pouvez y ajouter vos notes personnelles.

Quand une information manque ici, ne l'inventez pas : demandez à la personne avec qui vous travaillez. La section 10 liste ce qui n'est pas encore décidé.

## 1. Règles éliminatoires

Une seule de ces erreurs peut disqualifier l'équipe. Elles passent avant toute demande.

1. **Aucun Rapport des Possibles ni donnée fournie par le Centre dans le dépôt.** Ils restent dans `prive/`, dossier ignoré par git. Ne copiez jamais leur contenu, même partiel, dans un fichier versionné : code, test, exemple, commentaire, capture, message de commit.
2. **Les jeux de test sont inventés.** Un rapport fictif porte « Rdv FICTIF », jamais un vrai numéro de rendez-vous. Aucune donnée personnelle réelle.
3. **Aucune clé d'API, aucun mot de passe dans le dépôt.** Les secrets vont dans un fichier `.env` (ignoré par git) et se lisent par variable d'environnement. Versionnez un `.env.example` avec les noms des variables, sans valeur.
4. **Jamais de `git push --force` sur une branche partagée, jamais de `git add -f`, jamais de `--no-verify`.** Si un hook bloque un commit ou un push, arrêtez-vous et expliquez le blocage : ne le contournez pas.
5. **Aucun fichier de plus de 50 Mo.** Modèles d'IA, vidéos et jeux de données restent hors du dépôt.
6. **`projet.json` reste du JSON valide.** Un fichier invalide donne une fiche projet vide, sans message d'erreur.
7. **N'envoyez pas le contenu d'un rapport réel à un service en ligne** (API d'un modèle, outil web) sans l'accord de l'équipe : ce point n'est pas tranché avec l'organisation. En attendant, développez et testez sur des rapports fictifs.

Les trois règles du sujet s'appliquent à tout ce que le produit affiche ou génère :

- **L'humain décide.** L'outil éclaire le psychologue ou le conseiller, il ne le remplace pas.
- **Pas de verdict.** Aucun score, aucune note, aucun classement sur une personne. Aucune porte ne se ferme.
- **Pas de données personnelles réelles.**

## 2. Le hackathon

Hackathon Azuréen #3, organisé par Code4Sud à Nice du 18 au 20 novembre 2026. Thème : l'orientation et l'employabilité grâce à l'IA. Terrain : le Centre des Possibles (Métropole Nice Côte d'Azur).

| Échéance | Quoi |
| --- | --- |
| Vendredi 20/11, 11h30 | Code et fiche projet poussés dans `main`. C'est cette version que le jury regarde. |
| Vendredi 20/11, 12h30 | Vidéo de démo `equipe-15.mp4` remise sur clé USB : enregistrement d'écran de 1 à 3 minutes, sans voix, sous-titres incrustés si besoin. |
| Vendredi 20/11, 14h-16h | Jury : 5 minutes de pitch, 3 minutes de questions, démo en direct, sans diapositives. |

**Critères du jury :** l'utilité pour le jeune, une IA utile et fiable, la réalisation, l'innovation, la présentation. Il faut pouvoir montrer où est l'IA dans le projet, ce qu'elle rend possible et sur quoi elle s'appuie.

Un projet trop ambitieux peut être présenté en prototype partiel, tant que le problème est compris et la réponse pensée. Une fonction qui marche de bout en bout vaut mieux que trois fonctions à moitié finies.

Documentation de l'organisation : https://orientation.code4sud.fr/doc/ et https://orientation.code4sud.fr/sujets/

## 3. Le sujet : le Rapport des Possibles augmenté

**Le parcours au Centre.** Un jeune (dès 15 ans, souvent en décrochage ou sans idée de métier) passe une demi-journée au Centre : des jeux et questionnaires, puis un Rapport des Possibles généré par un algorithme, puis un entretien de 15 minutes avec un psychologue du travail, puis l'Agora des métiers.

**Le problème.** Le jeune repart avec des pages de graphiques et de noms de métiers, et le souvenir d'un entretien de 15 minutes. Une semaine plus tard, s'il lit peu ou n'a pas osé poser de questions, il n'en reste presque rien.

**Le défi.** Transformer un rapport en une restitution personnelle que le jeune garde et comprend : une vidéo, un audio, un récit, une version pour ses parents.

**Le plus dur, d'après le sujet :**

- générer sans rien inventer : chaque phrase se rattache à une donnée du rapport ;
- parler juste à un jeune de 16 ans fâché avec l'écrit.

**Ce qui préoccupe le plus les jeunes en entretien :** les salaires ; l'accessibilité des formations (éloignement, coût, sélection) ; une aide pour départager plusieurs options.

## 4. Les données

### Le Rapport des Possibles (PDF, 17 pages dans l'exemple étudié)

| Partie | Contenu | Extraction |
| --- | --- | --- |
| Intérêts professionnels | 6 profils RIASEC : Réaliste, Investigateur, Artistique, Social, Entreprenant, Conventionnel | Graphique radar, **sans valeur chiffrée** |
| Aptitudes cognitives | 9 aptitudes notées de 0 à 7 : originalité, raisonnement déductif, raisonnement inductif, flexibilité des catégories, facilité avec les nombres, mémorisation, visualisation, attention sélective, partage du temps | Histogramme, **valeurs absentes du texte** |
| Personnalité | 6 dimensions HEXACO : émotivité, extraversion, agréabilité, caractère consciencieux, humilité-honnêteté, ouverture à l'expérience | Graphique radar, **sans valeur chiffrée** |
| Champ des possibles | 5 zones de métiers, jusqu'à 5 métiers par zone, chacun avec un paragraphe de description. Une zone peut être vide. | Texte, extraction directe |
| Avertissement final | Résultats expérimentaux, pistes de réflexion, erreurs possibles | Texte |

- Les scores sont dans des images ou des tracés : l'extraction de texte ne les donne pas. Il faut lire le graphique (modèle de vision, analyse du tracé) ou les saisir.
- Sous chaque radar, les deux dimensions les plus hautes ont une étiquette rose, les quatre autres une étiquette bleue. Vérifié sur les 18 rapports.
- L'extraction de texte perd parfois les doubles « l » (« travaile », « instale ») : comparez sur un texte normalisé.
- La psychomotricité est mesurée au Centre mais n'entre pas encore dans le rapport.

**Les cinq zones** (temps de préparation au métier) : zone 1, 0 à 6 mois ; zone 2, 3 mois à 2 ans ; zone 3, 1 à 4 ans ; zone 4, 2 à 6 ans ; zone 5, 4 à 10 ans.

### La table des métiers O\*NET en français (tableur fourni par le Centre)

- 721 métiers de la base américaine O\*NET, traduits. Colonnes : `Zone réelle`, `O*NET-SOC Code`, `job_en`, `job_fr`, `description_fr`, `jobZone`, `justification_jobZone`. Une seconde feuille définit les Job Zones.
- Les métiers d'un rapport se retrouvent dans la table par leur intitulé français exact (`job_fr`), et leur description est celle de la table.
- **La zone affichée dans un rapport n'est pas toujours la `jobZone` de la table.** Pour restituer un rapport, la zone à citer est celle du rapport.
- La colonne `Zone réelle` contient des corrections et des notes internes du Centre sur 93 métiers. Ne l'affichez pas telle quelle.
- La table ne contient ni salaire, ni formation, ni code ROME.
- Le droit de publier cette table n'est pas confirmé : elle reste dans `prive/`.

### Sources ouvertes

- **ROME 4.0** (France Travail) : métiers, appellations, compétences. https://www.data.gouv.fr/datasets/repertoire-operationnel-des-metiers-et-des-emplois-rome
- **ONISEP** : métiers, formations, établissements. https://www.data.gouv.fr/organizations/office-national-d-information-sur-les-enseignements-et-les-professions/datasets
- **Carif-Oref** : offre de formation. https://www.data.gouv.fr/organizations/reseau-des-carif-oref/dataservices
- **orientation-regionsud.fr** : à consulter et à citer par des liens, **sans en extraire le contenu**.

Les métiers des rapports viennent d'O\*NET, pas de ROME : le lien vers ROME ou l'ONISEP est à construire.

## 5. Ce que le produit dit au jeune

Ces règles viennent du sujet et du guide du Centre. Elles valent pour les prompts, les gabarits et tout texte ou audio généré.

- **Tutoyer**, comme le rapport. Phrases courtes, mots simples, pas de jargon : le lecteur a 16 ans et lit peu.
- **Ne rien inventer.** Chaque affirmation se rattache à une donnée du rapport, et le produit peut montrer laquelle. Pas de salaire, de diplôme ou de débouché sans source citée.
- **Savoir dire « ce n'est pas dans ton rapport »** plutôt que de combler un manque.
- **Comparer la personne à elle-même, jamais aux autres.** Les scores se lisent les uns par rapport aux autres chez une même personne : ils font ressortir des points forts, pas un niveau. Pas de « faible », « mauvais », « en dessous de la moyenne ».
- **Aucun bon ou mauvais profil.** Chaque dimension est un continuum, plusieurs centres d'intérêt peuvent coexister.
- **Les résultats sont une image à un instant donné** : ils dépendent de la fatigue, du stress, de la motivation le jour du passage, et ils peuvent évoluer.
- **Les zones ne ferment aucune porte.** Elles indiquent un temps de préparation, pas une capacité ni une prédiction de réussite.
- **Les métiers proposés sont des pistes.** Un métier absent du rapport n'est pas exclu, un métier présent n'est pas une consigne.
- **Aucune déduction sur la santé, l'origine, la famille ou la religion.**
- **Le jeune reste l'expert de son vécu**, et le psychologue reste celui qui interprète : le produit prolonge l'entretien, il ne le remplace pas.

## 6. Le dépôt

- `Code4sud/2026-equipe-15`, public, licence MIT.
- Le site du hackathon ne lit que la branche `main`, et dans celle-ci `projet.json` et le dossier `captures/`.

| Chemin | Rôle |
| --- | --- |
| `projet.json` | Fiche du projet sur le site. `nom` (80 caractères max), `pitch` (300 max), `ecoles` sont obligatoires ; `description` (4 000 max, texte brut), `stack` (12 max), `demo`, `video`, `captures` (6 max). |
| `captures/` | Captures d'écran : PNG ou JPG, 1 600 px de large max, moins de 1 Mo chacune. |
| `index.html` | Page d'accueil de la démo. Elle doit garder la ligne du bandeau commun. |
| `.githooks/` | Garde-fous : `pre-commit` et `pre-push` appellent `verifier.sh`. |
| `.github/workflows/pages.yml` | Publication de la démo sur GitHub Pages à chaque push sur `main`. |
| `.github/workflows/verifier.yml` | Les mêmes garde-fous, côté GitHub, sur toutes les branches. |
| `contrat/` | Format des données échangées entre le backend et le frontend, avec un exemple inventé. |
| `docs/frontend-etapes.md` | Plan de travail du frontend. |
| `prive/` | Données confidentielles, local, ignoré par git. |

**À faire une fois par clone :**

```bash
git config core.hooksPath .githooks
```

**Bandeau commun.** La page d'accueil de la démo contient cette ligne, dans le `<head>` ou en fin de `<body>` :

```html
<script src="https://orientation.code4sud.fr/bandeau.js" data-equipe="15"></script>
```

**Démo en ligne (GitHub Pages), contraintes du workflow fourni :**

- Il ne publie que du statique, à l'adresse `https://code4sud.github.io/2026-equipe-15/`.
- S'il trouve un `package.json` **à la racine** avec un script `build`, il lance `npm ci` puis `npm run build` et publie `dist/`. Sinon il publie la racine du dépôt.
- `npm ci` exige un `package-lock.json` versionné.
- Avec Vite : `base: '/2026-equipe-15/'` dans `vite.config.js`.
- Un backend (Node.js, Ollama…) n'est pas hébergé par GitHub Pages.

**IA.** Les modèles open weight (Mistral, Llama, Gemma, Qwen…, en local avec Ollama ou LM Studio) sont recommandés par l'organisation. Les API payantes sont acceptées, aux frais de l'équipe.

## 7. Les branches

| Branche | Contenu |
| --- | --- |
| `main` | Uniquement ce qui fonctionne. Lue par le site, GitHub Pages et le jury. |
| `Backend` | Intégration du backend (attention à la majuscule). |
| `frontend` | Intégration du frontend. |
| sous-branches | Une par tâche, créée à partir de `Backend` ou de `frontend`. |

Le travail remonte dans un seul sens : sous-branche → `Backend` ou `frontend` → `main`.

- **Ne committez jamais directement sur `main`.** Ne fusionnez pas vers `main` sans l'accord de l'équipe.
- **Restez dans votre périmètre :** le code du backend vit dans `backend/`. Ne modifiez pas les fichiers de l'autre côté sans prévenir.
- **Avant de commencer, mettez votre branche à jour :**

  ```bash
  git fetch origin
  git merge origin/Backend      # ou origin/frontend, depuis votre sous-branche
  ```

- **Avant de pousser :** `git pull`, puis `git push`. En cas de conflit, réglez-le ou demandez de l'aide ; ne forcez jamais.
- **Pas de `git rebase` sur une branche déjà poussée :** il oblige à un push forcé.

## 8. Architecture

État au 19/11. Vérifiez l'état réel du dépôt avant de vous y fier.

**Backend (`backend/`, Node.js + Express).** Une API qui reçoit un rapport en PDF, en extrait les scores et les métiers en JSON avec leurs sources, puis sert les restitutions générées par un modèle d'IA. Le PDF est lu avec `pdfjs-dist` : le texte pour les métiers, les tracés vectoriels pour les scores des graphiques. Le code est sur la branche `jf/extraction-pdf-scores` tant qu'elle n'est pas fusionnée dans `Backend` ; son fichier `backend/Backend.txt` détaille chaque module et dit comment lancer l'API.

```text
backend/
├── server.js            point d'entrée Express
├── package.json
├── src/pdfReader.js     lecture du PDF : texte, lignes, tracés
├── src/report/          sections.js, scores.js, metiers.js, analyzer.js
├── src/routes/          report.js (dépôt et analyse du PDF) ; à venir : synthèses et questions à l'IA
├── tests/               sur un rapport inventé (« Rdv FICTIF »)
└── storage/             uploads/ (PDF déposés), outputs/ (analyses générées) : jamais versionnés
```

**IA.** Un modèle ouvert qui tourne en local avec Ollama. Son nom et l'adresse d'Ollama se lisent dans le `.env`, jamais en dur dans le code.

**Frontend.** Un site pensé d'abord pour le téléphone. Le plan de travail, écran par écran, est dans `docs/frontend-etapes.md`. Technologie proposée : Vite, React et Tailwind, à la racine du dépôt.

**Format des données.** Ce que le backend renvoie et ce que le frontend enregistre est décrit dans `contrat/`, avec un exemple entièrement inventé (`contrat/rapport-fictif.json`).

## 9. Façon de travailler

- **Vérifiez avant d'affirmer.** Lancez le code ou le test avant de dire qu'il fonctionne. Si vous ne l'avez pas lancé, dites-le.
- **Modifications petites et ciblées.** Ne réécrivez pas un fichier entier pour en changer dix lignes, ne touchez pas à ce qui n'est pas demandé.
- **Ne modifiez pas `.githooks/`, `.github/` ni `.gitignore`** sans l'accord de l'équipe : ce sont les garde-fous de tout le monde.
- **Pas de dépendance lourde sans raison :** le temps est court et la démo doit se lancer sur un ordinateur portable.
- **Gardez le `README.md` exact :** la section « Lancer le projet » doit tenir en cinq lignes et fonctionner.
- **Messages de commit courts, en français**, qui disent ce qui change.
- **Avant tout commit, contrôlez ce qui part :** `git status`, puis `bash .githooks/verifier.sh --staged`.

## 10. Décidé, et pas encore décidé

**Décidé le 19/11 :**

- Le projet s'appelle Possibles.AI.
- Le site est conçu d'abord pour le téléphone.
- Le backend est en Node.js + Express.
- Le modèle d'IA tourne en local avec Ollama.
- La première restitution est un résumé écrit, puis sa version audio.
- La démo devant le jury se fait en local.

**Pas encore décidé.** Ne tranchez pas ces points à la place de l'équipe.

- La technologie du frontend (proposition : Vite, React, Tailwind).
- Le modèle d'IA précis.
- Le nom des sous-branches et qui valide les fusions vers `main`.
- Le droit d'envoyer un rapport réel à une API en ligne, et celui de publier la table O\*NET : questions à poser à l'organisation.
