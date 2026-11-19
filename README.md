# Équipe 15 — Hackathon Azuréen #3

Projet réalisé à Nice les 18, 19 et 20 novembre 2026, sur le thème **« L'orientation et l'employabilité grâce à l'IA »**, organisé par [Code4Sud](https://code4sud.fr).

## À faire une fois, juste après avoir cloné

```bash
git config core.hooksPath .githooks
```

Cette commande active les garde-fous du dépôt sur votre ordinateur. Sans elle, rien ne vous empêche de publier par erreur un fichier interdit.

## Règles du dépôt

Le dépôt est **public**. Ce qui y entre est visible de tous et reste dans l'historique, même supprimé ensuite.

| Règle | Ce que font les garde-fous |
| --- | --- |
| Aucun Rapport des Possibles, aucune donnée du Centre | PDF, tableurs et dossier `prive/` refusés au commit |
| Aucune clé d'API ni mot de passe | Fichiers `.env` et clés reconnues refusés au commit |
| Aucun fichier de plus de 100 Mo | Refus dès 50 Mo |
| `projet.json` toujours valide | JSON invalide refusé au commit |
| Jamais de `git push --force` sur `main` | Push refusé s'il écrase des commits de `main` |

- **Données confidentielles :** rangez les rapports et les fichiers du Centre dans `prive/`. Ce dossier est ignoré par git.
- **Jeux de test :** ils sont inventés. Un rapport fictif porte « Rdv FICTIF », jamais un vrai numéro de rendez-vous.
- **Clés d'API :** dans un fichier `.env` (ignoré par git). Committez un `.env.example` avec les noms des variables, sans valeur.
- **Avant de pousser :** `git pull`, puis `git push`.
- **Rendu :** tout doit être dans `main` vendredi 20 novembre à 11h30.

Un commit ou un push bloqué affiche le fichier en cause et la raison. Ne contournez pas avec `--no-verify` : demandez à l'équipe.

Le même contrôle tourne sur GitHub à chaque push (onglet « Actions », « Vérifier le dépôt ») : une croix rouge signale un fichier interdit déjà publié.

## Le projet

_Deux ou trois phrases : le problème, la solution, pour qui._

## Lancer le projet

```bash
# Node.js 22 ou plus récent
npm ci
npm run dev
# Ouvrir http://127.0.0.1:5173/2026-equipe-15/
```

## Publier sur le site du hackathon

1. Complétez `projet.json` (nom, pitch, description, écoles, technologies, liens).
2. Ajoutez vos captures dans `captures/` et listez-les dans `projet.json`.
3. Poussez sur `main` : votre fiche apparaît sur https://orientation.code4sud.fr/projets/equipe-15 en moins d'une minute.

Toute la doc : https://orientation.code4sud.fr/doc/

## Démo en ligne

Si votre projet est un site sans serveur, il est publié automatiquement sur GitHub Pages à chaque push :
`https://code4sud.github.io/2026-equipe-15/`. Reportez cette adresse dans le champ `demo` de `projet.json`.

## Licence

MIT — voir `LICENSE`.
