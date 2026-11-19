# Format des données échangées entre le backend et le frontend

Proposition à valider. `rapport-fictif.json` est l'exemple de référence : le frontend peut l'afficher tel quel
sans backend. Tout y est inventé (« Rdv FICTIF »).

## Les blocs

| Bloc | Qui l'écrit | Contenu |
| --- | --- | --- |
| `rapport` | Le backend, à partir du PDF | Ce que renvoie `GET /report/{jeton}` |
| `resume` | Le backend, avec le modèle | 4 phrases, chacune avec la page du rapport d'où elle vient, et un texte court |
| `onboarding` | Le jeune, depuis le frontend | Son avis sur chaque métier, son préféré par zone, les métiers ajoutés avec le psychologue |
| `todo` | Le site, à partir de `onboarding` | Les premiers pas proposés, cochables |
| `rapport_pdf_url` | Le backend | L'adresse du PDF, affiché par la visionneuse du site. Avec l'API : un chemin relatif à l'API, `/report/{jeton}/pdf` |

## Le lien du jeune et les appels du site

Le jeune ouvre `…/#/?r=<jeton>`. Le jeton (32 caractères) est créé côté backend par `npm run lien -- <fichier.pdf>`.
L'adresse de l'API se lit dans `VITE_API_URL` (fichier `.env` à la racine, voir `.env.example`). Sans cette
variable ou sans jeton, le site montre `rapport-fictif.json`. Avec un jeton inconnu ou une API arrêtée, il le dit :
il ne montre pas l'exemple à la place du rapport. `…/#/?r=exemple` revient à l'exemple.

| Appel | Réponse |
| --- | --- |
| `GET {API}/report/{jeton}` | Le bloc `rapport` |
| `POST {API}/report/{jeton}/resume`, corps `{ "onboarding": … }` | Le bloc `resume`, plus `phrases`, `faits`, `genere_par` et `controle` |
| `GET {API}/report/{jeton}/pdf` | Le PDF, pour la visionneuse |

L'onboarding reste dans le navigateur du jeune, et les premiers pas (`todo`) sont calculés par le site.

## Deux ajouts demandés au schéma du backend

Le bloc `rapport` suit le schéma actuel, avec deux champs en plus :

- `id` sur chaque métier (ici `z2-m3` : zone 2, troisième métier). L'onboarding en a besoin pour désigner un
  métier sans dépendre de son intitulé.
- `point_fort` sur les scores des deux radars : vrai pour les deux dimensions que le rapport met en avant.

## Règles de lecture

- `value` sert à comparer les dimensions d'une même personne entre elles. Ne l'affichez pas comme une note.
- Une zone peut n'avoir aucun métier. `zone_label` est un temps de préparation, pas un niveau.
- `interets_metiers` prend trois valeurs : `interesse`, `plus_tard`, `non`. Un métier absent n'a pas encore été vu.
  Le jeune peut changer d'avis à tout moment.
- `favoris` donne un identifiant de métier par zone, ou `null`.
- `resume.points[].page` est un numéro de page du PDF, à partir de 1.
