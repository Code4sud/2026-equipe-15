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
| `sources` | `[{ fait, page, texte }]` : les faits cités, sans doublon. `page` : page du PDF. `fait` : `f1`, `f2`… (faits du résumé), `zones` (ce qu'est une zone) ou l'`id` d'un métier (`z1-m1`). |
| `dans_rapport` | `true` : réponse tirée du rapport. `false` : la réponse n'y est pas. `null` : repli. |
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

## Règles de lecture

- `value` sert à comparer les dimensions d'une même personne entre elles. Ne l'affichez pas comme une note.
- `point_fort` (deux radars) : vrai pour les dimensions que le rapport met en avant.
- Une zone peut n'avoir aucun métier. `zone_label` est un temps de préparation, pas un niveau.
- L'`id` d'un métier (`z2-m3` : zone 2, troisième métier) le désigne partout : onboarding, sources, recherche.
- `interets_metiers` prend trois valeurs : `interesse`, `plus_tard`, `non`. Un métier absent n'a pas encore été vu.
- `favoris` donne un identifiant de métier par zone, ou `null`.
- `onet.code` et `controle_onet` servent au contrôle : ils ne sont pas à montrer au jeune.
