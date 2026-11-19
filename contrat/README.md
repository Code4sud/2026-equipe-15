# Format des données échangées entre le backend et le frontend

Proposition à valider. `rapport-fictif.json` est l'exemple de référence : le frontend peut l'afficher tel quel
sans backend. Tout y est inventé (« Rdv FICTIF »).

## Les blocs

| Bloc | Qui l'écrit | Contenu |
| --- | --- | --- |
| `rapport` | Le backend, à partir du PDF | La forme exacte de `ReportAnalysis` dans `backend/models/schemas.py` |
| `resume` | Le backend, avec le modèle | 4 phrases, chacune avec la page du rapport d'où elle vient, et un texte court |
| `onboarding` | Le jeune, depuis le frontend | Son avis sur chaque métier, son préféré par zone, les métiers ajoutés avec le psychologue |
| `todo` | Le backend, à partir de `onboarding` | Les premiers pas proposés, cochables |
| `rapport_pdf_url` | Le backend | L'adresse du PDF, affiché par la visionneuse du site (« Ton rapport complet » et les phrases du résumé) |

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
