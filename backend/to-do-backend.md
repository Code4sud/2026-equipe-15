# Backend — ce qui reste à faire

État au 19/11 au soir. Le code est dans `Backend` (fusion de `jf/extraction-pdf-scores`).
Rendu : code dans `main` vendredi 20/11 à 11h30, vidéo à 12h30, jury à 14h.

Fichier public, comme tout le dépôt : n'y écrivez aucun numéro, aucune valeur et aucun intitulé tirés des rapports.

## Ce qui marche déjà

- **Extraction du PDF**, vérifiée sur les 18 rapports de `prive/` :
  - les 3 graphiques, avec leurs sources ;
  - les métiers par zone, avec `id` ;
  - `point_fort` sur les deux radars ;
  - le numéro de rendez-vous et l'avertissement.
- **Accès par lien, sans authentification** :
  - `npm run lien -- <fichier.pdf>` crée le jeton ;
  - `GET /report/{jeton}` renvoie l'analyse ;
  - `GET /report/{jeton}/scores` renvoie seulement les scores.
- **Tests** : `npm test` lance 22 tests, dont un par rapport de `prive/`.

Ce qui manque, c'est tout ce qui vient **après** l'extraction : l'IA, les restitutions, et le branchement avec le front.

## Priorité 1 — pour la démo de demain

Une chaîne complète vaut mieux que trois fonctions à moitié finies. Le minimum pour le jury : le jeune ouvre son lien,
voit son analyse et lit un résumé dont chaque phrase renvoie à une page du rapport.

### 1. Le résumé écrit (bloc `resume` du contrat)

C'est la première restitution décidée le 19/11, et c'est là que le jury cherchera l'IA. **Codé** sur la branche
`jf/resume-ecrit`, détails dans `Backend.txt`.

- [x] `src/ai/ollama.js` : client Ollama. Le modèle, l'adresse, le délai et le mode réflexion se lisent dans le
      `.env`, voir `.env.example`.
- [x] `src/resume/faits.js` : les faits numérotés, chacun avec sa page :
  - les points forts des deux radars, avec l'explication écrite sous leur encadré dans le rapport (sauf
    « Émotivité », dont l'explication parle d'humeur et de stress) ;
  - l'aptitude la plus haute chez le jeune, sauf si les libellés lus sous les barres sont douteux ;
  - les métiers préférés et intéressants de l'onboarding, ou à défaut les pistes du rapport ;
  - le rappel « image à un moment donné », avec la page de l'avertissement.
- [x] Le prompt applique les règles de la section 5 d'AGENTS.md. Le modèle répond en JSON contraint par un schéma :
      chaque phrase cite le fait sur lequel elle s'appuie.
- [x] `src/resume/controle.js` : refus de toute phrase qui cite un fait inexistant, contient un nombre absent des faits,
      emploie un mot interdit (verdict, comparaison, santé, famille, salaire…), vouvoie, ou est trop longue. Un second
      essai si trop de phrases sont refusées.
- [x] **Repli sans IA** : ce qui manque est complété par les phrases toutes faites des faits, avec les mêmes pages.
      Sans Ollama, ou sans `OLLAMA_MODEL`, le résumé est entièrement en repli et la démo ne tombe pas.
- [x] `POST /report/{jeton}/resume`, avec `{ onboarding }` dans le corps (facultatif). Renvoie `points`, `texte`, et
      en plus les `faits` (pour montrer sur quoi l'IA s'appuie), `genere_par` (IA, mixte ou repli) et `controle`.
      Mis en cache par jeton, choix et modèle, sauf en repli complet.
- [x] Tests : 8 tests avec un modèle factice et une analyse inventée (ils tournent aussi sur GitHub), plus des
      invariants sur les 18 rapports et sur la route. Les tests n'appellent jamais Ollama.
- [ ] **Essai avec le vrai modèle, sur le PC de démo** (Qwen3.6, 2,35 B). Rien n'a encore été généré par un modèle.
  1. Dans `backend/.env` : `OLLAMA_MODEL=<nom affiché par ollama list>` et `OLLAMA_THINK=false`.
  2. `npm run resume -- <un rapport de prive/>` affiche les faits, les phrases, leur origine et les refus.
  3. Lire les phrases :
     - sont-elles justes, simples, en français correct ?
     - combien sont refusées, et pourquoi ?
     - combien de temps prend la génération ?
  4. Ajuster le prompt (`SYSTEME` et `message()` dans `generer.js`) ou la liste des mots interdits si besoin.
- [ ] À caler avec le front : le corps de la requête (le bloc `onboarding` du contrat tel quel), et l'affichage de
      l'origine d'une phrase (IA ou repli) si on veut le montrer au jury.

### 2. Le PDF pour la visionneuse (`rapport_pdf_url`)

- [x] `GET /report/{jeton}/pdf` : sert le PDF du jeton, avec les mêmes contrôles et le même 404 que les autres
      routes.
  - Le nom de fichier est neutre (`rapport.pdf`) : le nom rangé dans `prive/` ne sort pas.
  - La lecture par morceaux de PDF.js est servie (`Range`, 206), et ses en-têtes sont exposés en CORS.
  - Testé : PDF.js ouvre le rapport par l'API, jusqu'à la dernière page.
- [x] `rapport_pdf_url` est ajouté à la réponse de `GET /report/{jeton}` : `/report/{jeton}/pdf`, relatif à la racine
      de l'API.
- [ ] **À dire au front** :
  - avec l'API, l'adresse du PDF est `<adresse de l'API>` + `rapport_pdf_url`, et non plus `BASE_URL` + le nom du
    fichier (`src/lib/donnees.js`) ;
  - le PDF inventé reste le repli quand le backend ne tourne pas.

### 3. Le branchement avec le front

- [ ] Fixer avec le front l'adresse du lien envoyé par mail (par exemple `…/#/?r=<jeton>`) : le front lit le jeton et
      appelle l'API. `docs/frontend-etapes.md` (étape 6) prévoit encore une connexion par mail et numéro de rapport.
- [ ] Ce que le front affiche si le jeton est inconnu (404) ou si le backend est arrêté (repli sur le fichier inventé).
- [ ] Vérifier le CORS avec l'adresse locale du front (Vite : `http://localhost:5173`).

### 4. La démo locale

- [ ] Choisir le rapport de la démo. Les deux gabarits d'aptitudes sont maintenant reconnus : n'importe lequel des
      18 convient.
- [ ] **À trancher avec l'équipe avant d'enregistrer la vidéo** : peut-on montrer un vrai rapport, même anonymisé, dans
      la vidéo et devant le jury ? La règle du sujet dit « pas de données personnelles réelles ». Si la réponse est
      non, il faut un rapport inventé pour la démo, alors que le générateur de PDF fictif a été supprimé.
- [ ] Une procédure de démo en quelques lignes :
  - lancer Ollama et vérifier que le modèle est téléchargé ;
  - `npm run lien` sur le rapport de démo ;
  - `npm start` ;
  - lancer le front ;
  - ouvrir le lien.
  À répéter une fois de bout en bout avant 11h30.
- [ ] Mettre la section « Lancer le projet » du README à jour : 5 lignes au plus, et elles doivent marcher.

## Priorité 2 — si le temps le permet

### 5. La synthèse audio (deuxième restitution décidée)

- [x] **Décidé : moteur local côté backend (Piper).** Codé dans `src/audio/synthese.js` :
  - `POST /report/{jeton}/resume` renvoie `audio_url` quand une voix est réglée (`PIPER_MODELE`), `null` sinon ;
  - `GET` sur cette adresse lit `resume.texte` avec Piper. Le fichier est créé au premier appel, puis gardé en
    cache. La lecture par morceaux est acceptée, comme pour le PDF ;
  - 503 si aucune voix n'est réglée ou si Piper échoue : le front garde alors le texte seul.
- [x] Le texte lu est `resume.texte`, à la ponctuation près (guillemets retirés, « / » lu « ou ») : rien n'est
      ajouté à l'oral.
- [x] Tests avec un faux Piper (`tests/outils/fauxPiper.js`) : création du fichier, cache, deux demandes simultanées,
      panne, moteur absent, routes.
- [ ] **Installer Piper et une voix française sur le PC de démo** (marche à suivre dans `Backend.txt`). Rien n'a encore
      été lu par le vrai Piper : sur ce PC, aucun moteur n'est installé.
  - Écouter le résultat sur un résumé, et vérifier la licence de la voix choisie.
  - Mesurer le temps de la première synthèse, pour savoir si le front doit afficher « Ta synthèse arrive… ».
- [ ] **À dire au front** : la carte « Écouter la synthèse » met `<adresse de l'API>` + `audio_url` dans une balise
      `<audio>`. Si `audio_url` vaut `null`, ou si la lecture échoue (503), elle affiche le texte seul.

### 6. La liste des métiers de l'onboarding (écran 4)

- [x] `GET /report/{jeton}/metiers?q=<texte>` : d'abord les intitulés qui commencent par le texte, puis ceux dont un
      mot commence par le texte, dès la deuxième lettre (10 par défaut, 20 au plus). Chaque résultat donne `nom`,
      `code` O\*NET, et `dans_rapport` : l'id du métier s'il est déjà dans le rapport.
  - La recherche passe par le jeton : la table reste dans `prive/` (droit de publication non confirmé), et elle ne
    doit pas pouvoir être parcourue par n'importe qui.
  - Lecture du `.xlsx` sans dépendance (`src/onet/xlsx.js`). La colonne « Zone réelle » (notes internes) n'est
    jamais lue.
- [ ] **À dire au front** :
  - l'écran 4 appelle cette route au lieu de sa liste inventée ;
  - un résultat avec `dans_rapport` est déjà dans le rapport : le front peut le signaler plutôt que de l'ajouter
    une seconde fois ;
  - `ajouts_psy` peut garder le `code` O\*NET en plus du `nom`.

### 7. Le contrôle des métiers contre O\*NET

- [x] Chaque métier de `GET /report/{jeton}` reçoit `onet` (code O\*NET et intitulé anglais), comparé sur un texte
      normalisé (sans accents ni ponctuation, lettres doublées écrasées). Le nom n'est jamais corrigé.
  - Un intitulé présent plusieurs fois dans la table (3 cas) donne tous ses codes, sans en choisir un.
  - Un métier introuvable ajoute une note d'extraction.
  - Bilan dans `controle_onet`.
- [x] Vérifié sur les 18 rapports : les 379 métiers se retrouvent tous dans la table. C'est aussi un test sur
      `prive/`, sauté si la table est absente.
- [ ] Le code O\*NET ouvre la voie au lien vers ROME ou l'ONISEP (priorité 3, pages métier).

### 8. L'assistant (`/chat`) — Julien, d'après `Backend.txt`

- [ ] `POST /chat/{jeton}` : une question, et une réponse appuyée sur les faits de l'analyse (même mécanisme que le
      résumé), avec ses sources.
- [ ] Savoir répondre « ce n'est pas dans ton rapport ». Ne jamais donner de salaire, de diplôme ou de débouché sans
      source citée.
- [ ] Les trois suggestions du front : « Pourquoi ces métiers ? », « Quelles formations ? », « Comment choisir entre
      deux métiers ? ».

## Priorité 3 — après la démo, ou à décider

- [x] **Libellés des aptitudes** : il existe deux gabarits de rapport, avec deux jeux de 9 aptitudes
      (`SECTIONS.aptitudes.gabarits`). Le gabarit est reconnu aux libellés lus sous les barres, et confirmé par les
      encadrés de la page. Si les libellés ne correspondent à aucun gabarit, les valeurs ne sont pas données et une
      note le signale (ce cas n'arrive sur aucun des 18 rapports, il n'est donc pas testé).
- [ ] **À dire au front** : les noms des 9 aptitudes ne sont pas fixes. Les afficher tels que l'API les renvoie,
      sans liste en dur.
- [ ] **AGENTS.md, section 4** : elle ne cite que le premier jeu de 9 aptitudes. À compléter, c'est le fichier de toute
      l'équipe.
- [ ] **Premiers pas (bloc `todo`)** : `docs/frontend-etapes.md` les déduit des choix de l'onboarding, sans IA. Ils
      peuvent donc rester dans le front. À caler, car `contrat/README.md` dit que c'est le backend qui les écrit.
- [ ] **Pages métier** (salaire, durée des études, formations) : rien de tout ça n'est dans le rapport ni dans la
      table O\*NET. Le lien vers ROME ou l'ONISEP est à construire. Pour la démo, se limiter à des liens vers
      orientation-regionsud.fr, sans en extraire le contenu.
- [ ] **Mails** : l'envoi du lien après le passage au Centre, et la suppression des données au bout d'un an
      (maquettes prévues côté front). Hors démo.
- [ ] **Une vraie base** à la place de `prive/` et de `liens.json`. Prévoir aussi :
  - une date d'expiration des liens ;
  - la révocation d'un jeton ;
  - la suppression de l'analyse en cache avec le rapport.

## Ménage dans le dépôt (avec l'accord de l'équipe)

- [ ] **AGENTS.md, section 8** : elle parle encore d'upload, de `storage/uploads/` et de tests « sur un rapport
      inventé ». À mettre à jour, c'est le fichier de toute l'équipe.
- [ ] **AGENTS.md, règle 2 et README ligne 26** : « Les jeux de test sont inventés ». Les tests tournent maintenant sur
      les rapports de `prive/`, et rien de réel n'est versionné. La règle est à reformuler.
- [ ] **`storage/uploads/`** ne sert plus. Le retirer touche `.gitignore` et `.githooks/` : à faire seulement avec
      l'accord de l'équipe.
- [ ] **Tests sur GitHub** : sans `prive/`, seuls les tests du 404 et de l'absence des routes de liste et d'upload
      tournent. C'est acceptable pour le hackathon, mais à savoir.
