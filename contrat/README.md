# Format des données échangées entre le backend et le site

`rapport-fictif.json` est l'exemple de référence : le site l'affiche tel quel quand il n'a pas d'API.
Tout y est inventé (« Rdv FICTIF »), comme tous les exemples de cette page.

## Les blocs

| Bloc | Qui l'écrit | Contenu |
| --- | --- | --- |
| `rapport` | Le backend, à partir du PDF | Ce que renvoie `GET /report/{jeton}` |
| `resume` | Le backend, avec le modèle | 4 phrases, chacune avec sa page du rapport, et un texte court |
| `onboarding` | Le jeune, depuis le site | Son avis sur chaque métier, son préféré par zone, les métiers ajoutés avec le psychologue |
| `todo` | Le site, à partir de `onboarding` | Les premiers pas proposés, cochables |
| `rapport_pdf_url` | Le backend | L'adresse du PDF. Avec l'API : `/report/{jeton}/pdf`, relative à l'API. Dans l'exemple : un fichier du site. |

L'onboarding reste dans le navigateur du jeune : le site l'envoie dans le corps des appels qui en ont besoin.

## Le lien du jeune

- Le jeune ouvre `<site>#/?r=<jeton>`. Le jeton fait 32 caractères hexadécimaux. Il est créé par
  `npm run lien -- <fichier.pdf>` (dans `backend/`), qui donne aussi l'adresse complète (`SITE_URL`).
- Un lien expire 1 an après sa création (`LIEN_DUREE_JOURS`, en jours). Il peut être coupé avant :
  `npm run revoquer -- <jeton>`. `npm run purger -- --confirmer` supprime les données des liens expirés.
- Jeton mal formé, inconnu, expiré, révoqué ou supprimé : toutes les routes répondent le même
  `404 { "detail": "Rapport introuvable" }`.
- Côté site : l'adresse de l'API se lit dans `VITE_API_URL` (`.env` à la racine). Sans cette variable ou sans jeton,
  le site montre `rapport-fictif.json`. Avec un jeton refusé ou une API arrêtée, il affiche une erreur, pas l'exemple.
  `<site>#/?r=exemple` revient à l'exemple.
- `&recommencer=1` ajouté au lien (`<site>#/?r=<jeton>&recommencer=1`) oublie les choix et la discussion gardés dans
  le navigateur, puis disparaît de l'adresse : il sert à préparer une démonstration.

## Les routes

| Appel | Réponse |
| --- | --- |
| `GET /report/{jeton}` | Le bloc `rapport`, complété (voir ci-dessous) |
| `GET /report/{jeton}/scores` | Seulement `interets_riasec`, `aptitudes`, `personnalite_hexaco` |
| `GET /report/{jeton}/metiers?q=&limite=` | Recherche dans la table des métiers |
| `POST /report/{jeton}/resume` | Le bloc `resume`, avec ses sources et l'adresse de l'audio |
| `GET /report/{jeton}/audio/{empreinte}` | Le résumé lu à voix haute (`audio/wav`) |
| `GET /report/{jeton}/pdf` | Le PDF (`application/pdf`), pour la visionneuse |
| `POST /chat/{jeton}` | Une réponse de l'assistant, avec ses sources |

Toutes les réponses portent `Cache-Control: no-store` et `Referrer-Policy: no-referrer`. Une erreur a la forme
`{ "detail": "…" }`.

### `GET /report/{jeton}`

Même forme que le bloc `rapport` de `rapport-fictif.json`, avec en plus :

| Champ | Où | Contenu |
| --- | --- | --- |
| `liens` | chaque métier | `[{ site, titre, url }]` : trois adresses de recherche sur l'intitulé du métier. `site` vaut `onisep`, `orientation-regionsud` ou `france-travail`. À ouvrir dans un nouvel onglet. |
| `onet` | chaque métier | Le métier retrouvé dans la table des métiers : `{ code, job_en }`. Intitulé présent sous plusieurs codes : `{ code: null, codes: […] }`. Introuvable : `null`. |
| `region` | chaque métier | Ce que le site d'orientation de la Région dit du métier (voir « Le champ `region` »). Absent, `null` ou un objet. |
| `controle_onet` | racine | `{ table, retrouves, introuvables }`. `table` : la table a été lue. `retrouves` : nombre de métiers retrouvés. `introuvables` : leurs intitulés. |
| `rapport_pdf_url` | racine | `/report/{jeton}/pdf`, à préfixer par l'adresse de l'API. |
| `notes` | racine | Liste de textes : les doutes de l'extraction, plus une ligne par métier introuvable dans la table. |
| `avertissement_page`, `version_extraction` | racine | Page de l'avertissement final (ou `null`) ; version de l'extraction. |

```json
{
  "id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "rdv": "Rdv FICTIF",
  "metiers": [
    {
      "id": "z1-m1",
      "nom": "Métier fictif A",
      "zone": 1,
      "zone_label": "Métiers accessibles en 0 à 6 mois",
      "description": "Description inventée.",
      "source": { "page": 8, "section": "Champ des possibles", "type": "texte", "detail": "donnée inventée" },
      "onet": { "code": "00-0000.00", "job_en": "Fictional job A" },
      "liens": [
        { "site": "onisep", "titre": "Le métier, les études et les formations (ONISEP)", "url": "https://www.onisep.fr/recherche?context=metier&text=M%C3%A9tier%20fictif%20A" },
        { "site": "orientation-regionsud", "titre": "Chercher ce métier en Région Sud", "url": "https://www.orientation-regionsud.fr/metiers?Quoi=M%C3%A9tier%20fictif%20A" },
        { "site": "france-travail", "titre": "Les offres d'emploi (France Travail)", "url": "https://candidat.francetravail.fr/offres/recherche?motsCles=M%C3%A9tier%20fictif%20A" }
      ]
    }
  ],
  "notes": [],
  "controle_onet": { "table": true, "retrouves": 1, "introuvables": [] },
  "rapport_pdf_url": "/report/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/pdf"
}
```

Sans table des métiers sur la machine : `onet` est absent et `controle_onet.table` vaut `false`. Les `liens` restent.

#### Le champ `region`

Trois cas, à ne pas confondre :

- **absent** : le métier n'a pas été cherché sur le site de la Région (pas de dossier `prive/regionsud/`, ou rapport
  non préparé : son intitulé n'est pas dans `correspondances.json`). Rien n'a été lu : le site affiche des liens de
  recherche (`liens`), sans rien affirmer sur le site de la Région.
- **`null`** : le métier a été cherché, le site de la Région n'a pas de fiche pour lui. Le site le dit et donne des
  pistes ailleurs (ONISEP, France Travail).
- **un objet** : la fiche lue dans `prive/regionsud/fiches/`, renvoyée telle quelle, plus `formations`.

| Champ | Contenu |
| --- | --- |
| `titre`, `url`, `slug` | L'intitulé de la fiche, son adresse (toujours sous `https://www.orientation-regionsud.fr/`) et son nom de fichier. `titre` peut différer du `nom` du métier : c'est « la fiche la plus proche », et le site le dit. |
| `lu_le`, `source` | Date de lecture (`AAAA-MM-JJ`) et texte de source, les organismes entre parenthèses. |
| `salaire_median_net_mensuel`, `salaire_source` | Entier, en euros net par mois, et la phrase qui dit d'où il vient. À présenter comme un repère (« la moitié des personnes gagnent plus de… »). |
| `missions` | Liste de textes. Le premier est une phrase d'introduction. |
| `acces`, `formations_url` | Comment on accède au métier (texte) ; adresse des formations sur le site de la Région. |
| `horaires`, `conditions`, `structures`, `diplomes` | Listes de textes. Seules les lignes d'`horaires` qui commencent par « Travail » sont utilisées. `diplomes` n'est pas affiché. |
| `recrute` | Booléen : le site classe le métier parmi ceux qui recrutent. |
| `indicateurs` | `{ demandeurs_emploi, difficultes_recrutement, emplois_saisonniers, evolution_emploi_5_ans, sans_diplome, diplomes_du_superieur }` : des textes, ou `null`. Ils décrivent la région, pas le jeune. |
| `code_rome` | Une lettre et 4 chiffres. Sert à retrouver les formations. |
| `formations` | `[{ titre, url, organisme, ville, dates, type }]`, avec parfois `departement`, `alternance`, `cpf`, `financeur`. Dans l'ordre du site de la Région, sans classement. Liste vide si rien n'a été lu pour ce code. |

Un métier avec sa fiche (les autres champs du métier ne changent pas) :

```json
{
  "id": "z1-m1",
  "nom": "Métier fictif A",
  "region": {
    "slug": "metier-fictif-a",
    "titre": "Métier fictif A",
    "url": "https://www.orientation-regionsud.fr/metiers/metier-fictif-a",
    "lu_le": "2026-01-01",
    "source": "orientation-regionsud.fr (Organisme fictif)",
    "recrute": false,
    "salaire_median_net_mensuel": 1000,
    "salaire_source": "Source inventée.",
    "indicateurs": { "demandeurs_emploi": "100", "difficultes_recrutement": null, "emplois_saisonniers": "10 %", "evolution_emploi_5_ans": null, "sans_diplome": "10 %", "diplomes_du_superieur": "10 %" },
    "missions": ["Phrase d'introduction inventée.", "Mission inventée."],
    "acces": "Accès inventé.",
    "formations_url": "https://www.orientation-regionsud.fr/formations?Rome=Z9999",
    "code_rome": "Z9999",
    "diplomes": [],
    "conditions": ["Condition inventée."],
    "horaires": ["Travail à des horaires inventés."],
    "structures": ["Lieu inventé"],
    "formations": [
      { "titre": "Formation fictive A", "url": "https://www.orientation-regionsud.fr/formations/formation-fictive-a", "organisme": "Organisme fictif", "ville": "Ville fictive", "departement": "00", "dates": "01/01/26 - 31/01/26", "type": "Type inventé", "alternance": true }
    ]
  }
}
```

### `GET /report/{jeton}/metiers?q=&limite=`

Pour l'écran « Le psychologue t'a parlé d'autres métiers ? ».

- `q` : début de l'intitulé, ou début d'un de ses mots. Accents et majuscules ignorés. Moins de 2 lettres : liste vide.
- `limite` : 10 par défaut, 20 au plus.
- `dans_rapport` : l'`id` du métier s'il est déjà dans le rapport, sinon `null`.
- `503` si la table des métiers est absente.

```json
{
  "resultats": [
    { "nom": "Métier fictif A", "code": "00-0000.00", "dans_rapport": "z1-m1" },
    { "nom": "Métier fictif B", "code": "00-0000.01", "dans_rapport": null }
  ]
}
```

Le site range un métier choisi dans `onboarding.ajouts_psy` sous la forme `{ "id": "onet-<code>", "nom": "…" }`
(`psy-1` dans l'exemple, qui n'a pas de table).

### `POST /report/{jeton}/resume`

Corps facultatif : `{ "onboarding": { termine, interets_metiers, favoris, ajouts_psy } }` (bloc `onboarding`).
Le backend n'en retient que les préférés et les métiers « interesse » qui existent dans le rapport.

| Champ | Contenu |
| --- | --- |
| `points` | 4 phrases au plus : `{ texte, page, fait, origine }`. `page` : page du PDF, à partir de 1. `origine` : `ia` ou `repli`. |
| `texte` | Le texte complet (les `phrases` mises bout à bout). C'est lui qui est lu à voix haute. |
| `phrases` | `[{ texte, faits, origine }]` : chaque phrase du texte et les faits qu'elle cite. Toutes du modèle (`ia`), ou toutes de repli s'il en a écrit moins de 4 valides. |
| `faits` | `[{ id, page, texte }]` : tout ce que le modèle avait le droit de dire. |
| `genere_par` | `{ mode, modele, raison }`. `mode` : `ia` (tout vient du modèle), `mixte` (des phrases refusées ont été remplacées par des phrases toutes faites) ou `repli` (aucune phrase du modèle : `modele` vaut `null`). `raison` est absent en mode `ia`. |
| `controle` | `{ phrases_refusees, raisons }` : ce que le contrôle a refusé au modèle. |
| `choix_pris_en_compte` | `{ favoris, interesses }` : les identifiants de métiers retenus de l'onboarding. |
| `audio_url` | `/report/{jeton}/audio/{empreinte}`, à préfixer par l'adresse de l'API. `null` si aucune voix n'est réglée (`PIPER_MODELE`). |

```json
{
  "points": [
    { "texte": "Phrase inventée sur tes intérêts.", "page": 4, "fait": "f1", "origine": "ia" },
    { "texte": "Phrase toute faite inventée.", "page": 5, "fait": "f2", "origine": "repli" }
  ],
  "texte": "Phrase inventée sur tes intérêts. Autre phrase inventée.",
  "phrases": [
    { "texte": "Phrase inventée sur tes intérêts.", "faits": ["f1"], "origine": "ia" },
    { "texte": "Autre phrase inventée.", "faits": ["f2"], "origine": "ia" }
  ],
  "faits": [
    { "id": "f1", "page": 4, "texte": "Fait inventé numéro 1." },
    { "id": "f2", "page": 5, "texte": "Fait inventé numéro 2." }
  ],
  "genere_par": { "mode": "mixte", "modele": "modele-fictif", "raison": "phrases du modèle refusées par le contrôle" },
  "controle": { "phrases_refusees": 1, "raisons": ["aucun fait cité"] },
  "choix_pris_en_compte": { "favoris": ["z1-m1"], "interesses": ["z1-m1"] },
  "audio_url": "/report/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/audio/aaaaaaaaaaaaaaaa"
}
```

Le résumé est gardé en cache par jeton, choix et modèle, sauf en mode `repli` : le modèle est réessayé à l'appel suivant.

#### Version détaillée : `"version": "longue"`

Ajouter `"version": "longue"` au corps donne un texte d'une à deux minutes, pour la page « Écouter » : les phrases du
résumé court, puis un passage sur chaque métier préféré (3 au plus ; à défaut les métiers « interesse »).

- Par métier : son temps de préparation (écrit par le backend), trois phrases du modèle sur ce qu'on y fait et ce que
  ça rejoint dans le profil (chacune cite le fait du métier, contrôlée comme le résumé, « ça explique » refusé ; à
  défaut, le début de la description du rapport), puis, si la fiche du site de la Région a été préparée, un repère de
  salaire et l'accès au métier. Une conclusion fixe rappelle que ce sont des pistes.
- Réponse : `version: "longue"`, `texte`, `phrases` (`{ texte, faits, origine }` avec `origine` valant `ia`, `repli`
  ou `code` ; une phrase tirée du site de la Région porte en plus `url` et `titre`), `faits` (ceux qui sont cités),
  `metiers` (identifiants présentés), `genere_par`, `controle`, `audio_url`. Pas de `points`.
- Gardée en cache comme le résumé court, sous une clé distincte.

### `GET /report/{jeton}/audio/{empreinte}`

Le `texte` du résumé lu par Piper, en `audio/wav`. Créé au premier appel, puis relu. L'adresse vient toujours du
`audio_url` d'un résumé : `empreinte` fait 16 caractères hexadécimaux.

- `404` : jeton refusé, empreinte mal formée, ou résumé jamais demandé (« Audio introuvable : redemande le résumé »).
- `503` : aucune voix réglée, ou Piper a échoué. Le site garde alors le texte.

### `GET /report/{jeton}/pdf`

Le PDF du rapport, sous le nom neutre `rapport.pdf`. La lecture par morceaux (`Range`, réponse `206`) est acceptée.

### `POST /chat/{jeton}`

Corps :

| Champ | Contenu |
| --- | --- |
| `question` | Obligatoire. Texte du jeune, 500 caractères au plus. |
| `historique` | Facultatif. `[{ de, texte }]`, `de` valant `moi` ou `ia`. Les 6 derniers messages sont gardés. |
| `onboarding` | Facultatif. Le même bloc que pour le résumé. |

```json
{
  "question": "Pourquoi ces métiers ?",
  "historique": [
    { "de": "moi", "texte": "Bonjour" },
    { "de": "ia", "texte": "Bonjour ! Pose-moi une question sur ton rapport." }
  ],
  "onboarding": { "termine": true, "interets_metiers": { "z1-m1": "interesse" }, "favoris": { "1": "z1-m1" }, "ajouts_psy": [] }
}
```

Réponse :

| Champ | Contenu |
| --- | --- |
| `reponse` | Le texte entier (les `phrases` mises bout à bout, ou une phrase fixe du backend). |
| `phrases` | `[{ texte, faits }]` : chaque phrase acceptée et les faits qu'elle cite. Peut être vide. |
| `sources` | `[{ fait, page, texte }]` : les faits cités, sans doublon. `page` : page du PDF. `fait` : `f1`, `f2`… (faits du résumé), `zones` (ce qu'est une zone) ou l'`id` d'un métier (`z1-m1`). Fait du site de la Région (`rs-…`) : `page` vaut `null`, avec `url` et `titre` en plus (voir plus bas). |
| `dans_rapport` | `true` : réponse tirée du rapport. `false` : la réponse n'y est pas. `null` : repli. |
| `pistes` | Seulement quand le site de la Région n'a pas l'information : `[{ metier, site, titre, url }]`, où chercher ailleurs. Absent sinon. |
| `genere_par` | `{ mode, modele, raison }`. `mode` : `ia` ou `repli`. En repli, `modele` vaut `null` et `raison` dit pourquoi. |
| `controle` | `{ phrases_refusees, raisons }`, comme pour le résumé. |

```json
{
  "reponse": "Phrase inventée sur tes intérêts. « Métier fictif A » fait partie de tes pistes.",
  "phrases": [
    { "texte": "Phrase inventée sur tes intérêts.", "faits": ["f1"] },
    { "texte": "« Métier fictif A » fait partie de tes pistes.", "faits": ["z1-m1"] }
  ],
  "sources": [
    { "fait": "f1", "page": 4, "texte": "Fait inventé numéro 1." },
    { "fait": "z1-m1", "page": 8, "texte": "Piste de métier « Métier fictif A », zone 1 (Métiers accessibles en 0 à 6 mois) : Description inventée." }
  ],
  "dans_rapport": true,
  "genere_par": { "mode": "ia", "modele": "modele-fictif" },
  "controle": { "phrases_refusees": 0, "raisons": [] }
}
```

Codes :

- `400 { "detail": "Question vide" }` ou `"Question trop longue"` (plus de 500 caractères).
- `404 { "detail": "Rapport introuvable" }` : jeton refusé. Le jeton est contrôlé avant la question.

Replis :

- **Pas dans le rapport** (`dans_rapport: false`, mode `ia`) : le backend écrit lui-même « Ce n'est pas dans ton
  rapport… ». `phrases` et `sources` sont vides.
- **Question sur les formations ou les études** (`dans_rapport: false`, mode `ia`) : le backend répond lui-même avec
  le temps de préparation de 3 métiers au plus (les préférés, sinon les « interesse », sinon un par zone).
  `sources` cite ces métiers.
- **Modèle absent, ou toutes les phrases refusées deux fois** (`dans_rapport: null`, mode `repli`) : `reponse` est un
  message d'attente, `phrases` et `sources` sont vides. Le site répond alors lui-même à partir du rapport.

Pas de cache, pas de streaming : la réponse arrive en une fois, parfois après plusieurs secondes.

#### Avec les informations du site de la Région

Seulement si le site de la Région a été lu pour ce rapport (au moins un de ses métiers dans
`prive/regionsud/correspondances.json`). Sinon, rien de ce qui suit n'arrive : pas de fait `rs-…`, pas de `pistes`.
Dans tous les cas, un métier nommé dans la question passe avant les préférés dans les réponses écrites par le backend.

- **Faits `rs-…`.** Le modèle reçoit 6 faits de la Région au plus : `rs-<id du métier>` (`rs-z1-m1`), pour les métiers
  nommés dans la question ou la discussion, puis les préférés, puis les « interesse ». Une phrase qui en cite un a le
  droit de parler de salaire ou de diplôme ; ses nombres doivent toujours figurer dans le fait.
- **Sources.** Un fait `rs-…` cité donne `{ fait, page: null, texte, url, titre }` : `url` est l'adresse de la fiche,
  `titre` vaut `orientation-regionsud.fr : <titre de la fiche>`. Le site n'affiche une `url` que sous
  `https://www.orientation-regionsud.fr/`.
- **Réponses fixes** (`dans_rapport: false`, mode `ia`), écrites par le backend quand le modèle dit que ce n'est pas
  dans le rapport, ou quand ses phrases sur un métier sont refusées deux fois (`genere_par.raison` le dit alors) :
  - *salaire, la fiche en donne un* : « Ton rapport ne parle pas de salaire. », puis une ligne par métier, qui cite
    son fait `rs-…` ;
  - *formations, la fiche dit comment accéder au métier* : la réponse sur les temps de préparation, plus une ligne
    par métier, « D'après le site de la Région, pour « … » (fiche « … ») : … », qui cite son fait `rs-…` ;
  - *aucune fiche pour les métiers concernés* (salaire, formations, horaires, débouchés…), *ou fiche sans salaire ou
    sans accès* pour une question de salaire ou de formations : « Je n'ai pas trouvé […] sur le site d'orientation
    de la Région. », puis où chercher. Pour une question de formations, les temps de
    préparation du rapport sont donnés avant. `pistes` porte deux adresses de recherche (ONISEP et France Travail, pas le site de la Région) par
    métier nommé dans la question, 3 métiers au plus ; liste vide si aucun n'est nommé. Rien n'est inventé à la place.

Deux exemples : une phrase du modèle qui cite un fait `rs-…`, puis la réponse fixe pour un métier sans fiche (une
seule des trois `pistes` est montrée).

```json
{
  "reponse": "D'après le site de la Région, pour « Métier fictif A », la moitié des personnes à temps plein gagnent plus de 1000 euros net par mois.",
  "phrases": [
    { "texte": "D'après le site de la Région, pour « Métier fictif A », la moitié des personnes à temps plein gagnent plus de 1000 euros net par mois.", "faits": ["rs-z1-m1"] }
  ],
  "sources": [
    {
      "fait": "rs-z1-m1",
      "page": null,
      "texte": "Ce que dit le site orientation-regionsud.fr pour « Métier fictif A » (fiche la plus proche sur ce site : « Métier fictif A »). Salaire : la moitié des personnes qui exercent ce métier à temps plein gagnent plus de 1000 euros net par mois (Insee, salariés 2022). C'est un repère, pas une promesse.",
      "url": "https://www.orientation-regionsud.fr/metiers/metier-fictif-a",
      "titre": "orientation-regionsud.fr : Métier fictif A"
    }
  ],
  "dans_rapport": true,
  "genere_par": { "mode": "ia", "modele": "modele-fictif" },
  "controle": { "phrases_refusees": 0, "raisons": [] }
}
```

```json
{
  "reponse": "Je n'ai pas trouvé d'information sur « Métier fictif B » sur le site d'orientation de la Région. Tu peux chercher sur le site de l'ONISEP ou sur France Travail, ou en parler au psychologue.",
  "phrases": [
    { "texte": "Je n'ai pas trouvé d'information sur « Métier fictif B » sur le site d'orientation de la Région.", "faits": [] },
    { "texte": "Tu peux chercher sur le site de l'ONISEP ou sur France Travail, ou en parler au psychologue.", "faits": [] }
  ],
  "sources": [],
  "dans_rapport": false,
  "pistes": [
    { "metier": "Métier fictif B", "site": "onisep", "titre": "Le métier, les études et les formations (ONISEP)", "url": "https://www.onisep.fr/recherche?context=metier&text=M%C3%A9tier%20fictif%20B" }
  ],
  "genere_par": { "mode": "ia", "modele": "modele-fictif" },
  "controle": { "phrases_refusees": 0, "raisons": [] }
}
```

## Données locales lues par l'API

Les informations du site de la Région sont préparées **avant** la démonstration, hors du dépôt, et rangées dans
`prive/regionsud/` (jamais versionné ; `regionsud/` dans `RAPPORTS_DIR` si cette variable est réglée). Pendant
l'utilisation, l'API ne lit que ces fichiers : rien n'est lu sur le site de la Région, ni par l'API ni par le
navigateur du jeune. Un fichier absent ou illisible vaut « pas d'information ».

| Fichier | Forme | Ce que l'API en lit |
| --- | --- | --- |
| `correspondances.json` | `{ "<nom exact du métier dans le rapport>": { slug, … } }` | `slug` : le nom de la fiche retenue (minuscules, chiffres, tirets), ou `null` s'il n'y en a pas. Les autres champs servent à la préparation. |
| `fiches/<slug>.json` | L'objet `region` décrit plus haut, sans `formations` | Tout. La fiche est ignorée si son `url` ne commence pas par `https://www.orientation-regionsud.fr/`. |
| `formations/<ROME>.json` | `{ "formations": [ … ], … }`, `<ROME>` étant le `code_rome` de la fiche | La liste `formations`, renvoyée dans `region.formations`. |

```json
{
  "correspondances.json": {
    "Métier fictif A": { "slug": "metier-fictif-a", "titre": "Métier fictif A" },
    "Métier fictif B": { "slug": null, "titre": null }
  },
  "formations/Z9999.json": {
    "rome": "Z9999",
    "lu_le": "2026-01-01",
    "formations": [
      { "titre": "Formation fictive A", "url": "https://www.orientation-regionsud.fr/formations/formation-fictive-a", "organisme": "Organisme fictif", "ville": "Ville fictive", "dates": "01/01/26 - 31/01/26", "type": "Type inventé" }
    ]
  }
}
```

## Règles de lecture

- `value` sert à comparer les dimensions d'une même personne entre elles. Ne l'affichez pas comme une note.
- `point_fort` (deux radars) : vrai pour les dimensions que le rapport met en avant.
- Une zone peut n'avoir aucun métier. `zone_label` est un temps de préparation, pas un niveau.
- L'`id` d'un métier (`z2-m3` : zone 2, troisième métier) le désigne partout : onboarding, sources, recherche.
- `interets_metiers` prend trois valeurs : `interesse`, `plus_tard`, `non`. Un métier absent n'a pas encore été vu.
- `favoris` donne un identifiant de métier par zone, ou `null`.
- `onet.code` et `controle_onet` servent au contrôle : ils ne sont pas à montrer au jeune.
- `region` vient d'un autre site que le rapport : toujours le dire au jeune, avec le lien vers la fiche (`region.url`).
