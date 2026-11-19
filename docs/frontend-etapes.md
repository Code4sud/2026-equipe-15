# Frontend — les étapes

Ce document donne l'ordre de travail du frontend. Les étapes 1 et 2 sont détaillées : ce sont elles qu'on montre
au jury. Les suivantes sont décrites en quelques lignes et seront précisées quand on y arrive.

À lire avant : `AGENTS.md`, sections 1 (règles éliminatoires) et 5 (ce que le produit dit au jeune).

## Règles valables pour toutes les étapes

**Téléphone d'abord.** Le jeune ouvre le site depuis un lien reçu par mail, sur son téléphone.

- Concevoir et tester chaque écran à 390 px de large, puis vérifier à 360 px. L'ordinateur vient après, en
  élargissant.
- Une seule colonne sur téléphone. Aucun défilement horizontal de la page.
- Zones tactiles d'au moins 44 px de haut. Rien ne dépend du survol de la souris.
- Texte courant à 16 px minimum.
- Les boutons d'action principaux sont en bas de l'écran, à portée de pouce, au-dessus de la zone de sécurité
  du téléphone (`env(safe-area-inset-bottom)`).

**Le ton.** Tutoiement, phrases courtes, mots simples. Aucune note, aucun classement, aucun « faible » ni « à
améliorer ». Une zone indique un temps de préparation, pas un niveau. Un métier est une piste.

**Les données.** Le frontend ne lit jamais un vrai rapport dans le dépôt. Il part d'un fichier de données
inventées (« Rdv FICTIF ») et garde les choix du jeune dans le navigateur (`localStorage`). Il doit fonctionner
sans backend ; l'API se branche à l'étape 7.

**Le style.** Reprendre celui de la maquette : fond sombre, cartes aux bords arrondis, violet en couleur
principale. La maquette donne l'agencement, pas les textes.

## Étape 0 — Mise en place

- Projet à la racine du dépôt (le backend reste dans `backend/`) : Vite, React, Tailwind. Proposition à
  confirmer avant de commencer.
- `vite.config.js` : `base: '/2026-equipe-15/'`. `package-lock.json` versionné. La publication sur GitHub Pages
  est automatique dès qu'un `package.json` avec un script `build` est à la racine.
- `index.html` garde la ligne du bandeau commun :
  `<script src="https://orientation.code4sud.fr/bandeau.js" data-equipe="15"></script>`.
- Navigation par ancre (`HashRouter`) : `#/onboarding`, `#/`, `#/rapport/:page`, `#/metier/:id`. GitHub Pages ne
  sait pas servir les autres formes d'adresse.
- Un fichier de données inventées, importé au démarrage, et un petit module qui lit et écrit les choix du jeune
  dans `localStorage`.

**Terminé quand** : la page s'ouvre sur téléphone à l'adresse GitHub Pages, avec le bandeau.

## Étape 1 — L'onboarding

### À quoi il sert

Pendant l'entretien, le psychologue et le jeune annotent le rapport imprimé : tel métier l'intéresse, tel autre
pas du tout, tel métier absent du rapport vaudrait le coup. Le rapport reçu par mail, lui, n'est pas annoté.
L'onboarding sert à remettre ces annotations dans le site, en deux minutes, à la première connexion. Tout le
reste du site s'appuie ensuite sur ces choix.

Le rapport propose jusqu'à 25 métiers, rangés en 5 zones de 5 métiers au plus. Une zone peut être vide.

### Quand il s'affiche

- À la première visite, à la place de la page d'accueil.
- Il se reprend là où le jeune s'est arrêté s'il ferme le site en cours de route.
- Une fois terminé, il ne revient plus tout seul. Un lien « Modifier mes choix » sur la page d'accueil le rouvre,
  avec les réponses déjà données.

### Les écrans

**Écran 1 — Bienvenue.** Un seul écran, peu de texte.

- Titre : « On reprend ton rapport ensemble ».
- Deux phrases : « Ton rapport te propose des métiers. Dis-nous ceux qui te parlent, comme tu l'as fait avec le
  psychologue. » et « Ça prend deux minutes, et tu peux changer d'avis quand tu veux. »
- Un bouton : « C'est parti ».

**Écran 2 — Ton avis sur chaque métier.** Une carte par métier, une seule à la fois.

- En haut : la progression (« Métier 4 sur 22 ») et une barre qui avance. Le total est le nombre réel de métiers
  du rapport, pas 25.
- Sur la carte : l'intitulé du métier, une étiquette avec le temps de préparation de sa zone (« 3 mois à 2
  ans »), et le début de sa description. Un lien « Lire la suite » déplie le texte complet.
- En bas, trois boutons, toujours dans le même ordre :
  - « Ça m'intéresse »
  - « Pas pour l'instant »
  - « Pas intéressé »
- Un appui passe au métier suivant. Une flèche « Retour » revient au précédent et permet de changer la réponse.
- Les métiers défilent zone après zone, de la zone 1 à la zone 5. Au changement de zone, une ligne discrète
  l'annonce : « Métiers accessibles en 1 à 4 ans ».
- Un intitulé long tient sur trois lignes sans casser la carte.

« Pas intéressé » existe parce que le rapport se trompe parfois complètement : le jeune doit pouvoir le dire.
Ce choix reste modifiable et ne supprime rien : le métier reste visible dans « Découvrir les métiers ».

**Écran 3 — Ton préféré dans chaque zone.** Un écran par zone, cinq au plus.

- Titre : « Ton préféré parmi ceux-là ? », suivi du temps de préparation de la zone.
- La liste des métiers de la zone marqués « Ça m'intéresse ». Un appui en choisit un seul.
- Si un seul métier est marqué « Ça m'intéresse » dans la zone, il est déjà choisi : le jeune confirme.
- Si aucun ne l'est, proposer ceux marqués « Pas pour l'instant », avec un bouton « Aucun pour l'instant » qui
  laisse la zone sans préféré.
- Une zone sans métier dans le rapport est sautée.

**Écran 4 — Les métiers vus avec le psychologue.** Facultatif.

- Titre : « Le psychologue t'a parlé d'autres métiers ? »
- Un champ de recherche qui propose des métiers d'une liste préparée, dès la deuxième lettre tapée.
- Chaque métier ajouté apparaît en dessous, avec une croix pour le retirer.
- Deux boutons : « Ajouter » (désactivé tant que rien n'est choisi) et « Passer cette étape ».
- La liste préparée vient du backend. En attendant, une dizaine d'intitulés inventés dans le fichier de données.

**Écran 5 — Récapitulatif.**

- Titre : « Voilà ce qu'on retient ».
- Le métier préféré de chaque zone, les métiers ajoutés avec le psychologue, et le nombre de métiers marqués
  « Ça m'intéresse ».
- Un bouton : « Voir ma page ». Il marque l'onboarding comme terminé et ouvre la page d'accueil.

### Ce que l'onboarding enregistre

| Donnée | Forme |
| --- | --- |
| L'avis sur chaque métier | pour chaque identifiant de métier : `interesse`, `plus_tard` ou `non` |
| Le préféré de chaque zone | pour chaque zone de 1 à 5 : un identifiant de métier, ou rien |
| Les métiers ajoutés avec le psychologue | une liste d'intitulés |
| L'avancement | l'écran en cours, et si l'onboarding est terminé |

Tout est écrit dans `localStorage` à chaque réponse, pas seulement à la fin.

### Terminé quand

- [ ] Sur téléphone, on va du premier au dernier écran d'une seule main, sans défilement horizontal.
- [ ] Fermer l'onglet au milieu puis revenir reprend au bon métier, avec les réponses gardées.
- [ ] « Retour » permet de changer une réponse déjà donnée.
- [ ] Un rapport avec une zone vide et une zone à un seul métier se déroule sans écran cassé.
- [ ] Les trois réponses sont enregistrées et relues par la page d'accueil.
- [ ] Aucun texte ne contient de note, de classement ni de jugement.

## Étape 2 — La page d'accueil

### Ce qui change par rapport à la maquette

| Dans la maquette | Dans le site |
| --- | --- |
| Bouton « Documents » | Bouton « Ton rapport complet », qui ouvre le rapport dans la visionneuse du site |
| « Liens utiles », en grand | Gardé, mais en plus petit |
| Barre de recherche | Retirée sur téléphone |
| Résumé avec 4 phrases | Gardé |
| 3 colonnes de durée avec 2 métiers chacune | 5 zones, avec un seul métier par zone : le préféré du jeune, cliquable |
| Durées « 0 à 6 mois », « 6 mois à 2 ans », « 1 an à 4 ans » | Les 5 vraies zones : « 0 à 6 mois », « 3 mois à 2 ans », « 1 à 4 ans », « 2 à 6 ans », « 4 à 10 ans » |
| Carte « Prochain rendez-vous » | Carte « Tes premiers pas » : une liste d'actions à cocher |
| « Nos recommandations pour toi », 4 cartes | Gardé tel quel |
| « Mon assistant IA » | Gardé. Sur téléphone : un bouton flottant qui ouvre la discussion en plein écran |
| Suggestion « Comment améliorer mon profil ? » | Remplacée par « Comment choisir entre deux métiers ? » |

### L'ordre des blocs sur téléphone

De haut en bas, en une colonne :

1. L'en-tête
2. Résumé de ton rapport
3. Tes métiers préférés, par zone
4. Tes premiers pas
5. Nos recommandations pour toi
6. Liens utiles
7. Le bouton flottant de l'assistant, toujours visible en bas à droite

Sur ordinateur, on retrouve l'agencement de la maquette : les blocs 2, 3 et 5 à gauche ; « Tes premiers pas » et
l'assistant dans la colonne de droite.

### Bloc par bloc

**1. L'en-tête.** Le logo et le nom du projet à gauche (le nom n'est pas encore choisi : prévoir un texte facile
à remplacer). À droite, le bouton « Ton rapport complet » avec une icône de document, et l'icône de compte. Sur
téléphone, le bouton peut se réduire à son icône, avec le libellé pour les lecteurs d'écran.

« Ton rapport complet » ouvre la visionneuse du site à la première page (`#/rapport/1`), décrite plus bas.

**2. Résumé de ton rapport.** Une carte avec l'étiquette « Mon rapport d'orientation », le titre « Résumé de ton
rapport » et 4 phrases courtes, chacune précédée d'une coche.

- Les 4 phrases viennent du backend (elles sont générées à partir du rapport et des choix de l'onboarding). Pour
  l'instant, elles sont dans le fichier de données.
- Chaque phrase est cliquable : elle ouvre le rapport à la page d'où vient l'information, dans la visionneuse
  du site (`#/rapport/5` pour la page 5). Le backend donne le numéro de page avec chaque phrase. Une petite
  icône de document et « page 5 » au bout de la ligne montrent qu'on peut appuyer.
- Chaque phrase parle d'un point fort ou d'une piste. Aucune ne parle d'un manque.
- L'illustration de la maquette est facultative sur téléphone : la retirer si elle pousse le texte hors de
  l'écran.
- Sous les phrases, un lien discret : « Modifier mes choix », qui rouvre l'onboarding.

**3. Tes métiers préférés, par zone.** Cinq cartes, une par zone, dans l'ordre de la zone 1 à la zone 5.

- Sur téléphone : une liste verticale de 5 lignes. Sur ordinateur : 5 colonnes dans la carte du résumé, comme
  les 3 colonnes de la maquette.
- Chaque carte montre le temps de préparation de la zone (« 3 mois à 2 ans ») et l'intitulé du métier préféré du
  jeune dans cette zone.
- Toute la carte est cliquable et ouvre la page du métier (`#/metier/:id`, étape 3).
- Zone sans préféré choisi : la carte affiche « Pas encore de préféré » et un lien « Choisir », qui ouvre
  l'onboarding à cette zone.
- Zone vide dans le rapport : la carte affiche « Ton rapport ne propose pas de métier ici ». Elle n'est pas
  cliquable et ne disparaît pas : les 5 zones restent toujours visibles.
- Ne jamais présenter une zone comme meilleure qu'une autre : même taille, même couleur pour les cinq.

**4. Tes premiers pas.** Une carte avec une liste d'actions à cocher. Elle remplace « Prochain rendez-vous ».

- Les actions se déduisent des choix de l'onboarding, sans IA. Trois à cinq actions, par exemple :
  - « Lis la fiche de » suivi du métier préféré, pour chacun des 3 premiers préférés, avec un lien vers sa page ;
  - « Regarde les formations près de chez toi », avec un lien vers orientation-regionsud.fr ;
  - « Écoute la synthèse de ton rapport », avec un lien vers la carte correspondante.
- Un appui sur la case coche l'action. L'état est gardé dans `localStorage`.
- Une action cochée reste visible, barrée, en bas de la liste.
- Un compteur discret : « 1 sur 4 ». Pas de message de félicitations ni de score.
- Si l'onboarding n'a donné aucun préféré, une seule action : « Choisis tes métiers préférés ».

**5. Nos recommandations pour toi.** Les 4 cartes de la maquette, avec leurs couleurs :

| Carte | Sous-titre | Ouvre |
| --- | --- | --- |
| Écouter la synthèse | Un résumé audio de 2 min de ton rapport. | étape 4 |
| Explorer ton profil | Tes résultats et tes points forts. | étape 4 |
| Découvrir les métiers | Tous les métiers de ton rapport. | étape 4 |
| Voir les formations | Les parcours pour y arriver. | étape 4 |

- Sur téléphone : une grille de 2 cartes par ligne. Sur ordinateur : 4 cartes sur une ligne.
- Tant que la page d'une carte n'existe pas, la carte ouvre un écran « Bientôt disponible » avec un retour. Elle
  ne doit jamais mener à une page blanche.
- Le sous-titre de « Explorer ton profil » dans la maquette parle de « pistes d'amélioration » : le remplacer
  par le texte du tableau.

**6. Liens utiles.** Une ligne discrète en bas de page, pas une carte : deux ou trois liens, dont
orientation-regionsud.fr. Ouverture dans un nouvel onglet.

**7. L'assistant.** Sur téléphone, un bouton rond flottant en bas à droite. Un appui ouvre la discussion en plein
écran, avec une croix pour revenir.

- Message d'accueil : « Pose-moi tes questions sur ton rapport, les métiers ou les formations ! »
- Trois suggestions cliquables : « Pourquoi ces métiers ? », « Quelles formations ? », « Comment choisir entre
  deux métiers ? »
- Un champ « Écrire un message… » et un bouton d'envoi.
- À cette étape, la discussion n'est pas branchée : l'envoi affiche une réponse d'exemple. Le vrai branchement
  est à l'étape 5.
- Le bouton flottant ne doit pas recouvrir les cases à cocher de « Tes premiers pas » : prévoir une marge en bas
  de page.

### La visionneuse du rapport

Une page du site, `#/rapport/:page`, qui affiche le PDF du rapport sans passer par le lecteur du téléphone. Le
lecteur d'un téléphone ne sait pas ouvrir un PDF à une page donnée : c'est pour cela que le site affiche le
rapport lui-même.

- Le PDF est dessiné dans la page avec PDF.js (par exemple la bibliothèque `react-pdf`). Avec Vite, le fichier
  « worker » de PDF.js doit être déclaré explicitement, sinon rien ne s'affiche.
- Les pages sont affichées l'une sous l'autre, à la largeur de l'écran. On fait défiler avec le doigt.
- À l'ouverture, la page demandée dans l'adresse est amenée en haut de l'écran.
- En haut, une barre fixe : une flèche « Retour » vers la page d'accueil, et « Page 5 sur 17 ».
- Ne dessiner que les pages proches de l'écran : 17 pages dessinées d'un coup ralentissent un téléphone.
- Le zoom par pincement du navigateur suffit. Pas d'outil de zoom à coder.
- Pendant le chargement : « Ton rapport arrive… ». Si le PDF n'est pas disponible : « Ton rapport n'est pas
  disponible pour l'instant », avec le retour.
- Avec les données inventées, la visionneuse affiche un PDF d'exemple inventé, jamais un vrai rapport.

### Les données lues par la page d'accueil

| Bloc | Ce qu'il lit |
| --- | --- |
| Résumé | les 4 phrases, chacune avec son numéro de page dans le rapport |
| Métiers par zone | les 5 zones avec leur temps de préparation, les métiers de chaque zone, le préféré de chaque zone |
| Premiers pas | les préférés, et l'état coché ou non de chaque action |
| Rapport complet | l'adresse du PDF |

### Terminé quand

- [ ] À 390 px, tous les blocs sont lisibles dans l'ordre indiqué, sans défilement horizontal.
- [ ] Les 5 zones sont toujours affichées, y compris une zone vide et une zone sans préféré.
- [ ] Un appui sur un métier préféré ouvre sa page.
- [ ] Sur téléphone, un appui sur une phrase du résumé ouvre le rapport à la bonne page, et « Retour » ramène à
      l'accueil.
- [ ] Changer un préféré dans l'onboarding change la carte de la zone et la liste des premiers pas.
- [ ] Une action cochée le reste après rechargement de la page.
- [ ] Aucune carte ne mène à une page blanche.
- [ ] Une capture de cet écran, avec les données inventées, est enregistrée dans `captures/`.

## Étape 3 — La page d'un métier

Maquette pour le jury : une ou deux pages faites à la main pour les métiers préférés des données inventées.
L'intitulé, la description du rapport, le temps de préparation, puis des informations régionales (salaire, durée
des études, formations). En bas de la page, un bloc « D'où viennent ces informations » avec les liens vers les
pages d'orientation-regionsud.fr utilisées. La même règle vaut pour toute page qui affiche une information venue
d'ailleurs que du rapport : ses sources sont en bas de page. À détailler.

## Étape 4 — Les pages des recommandations

Écouter la synthèse (lecteur audio et texte lu), Explorer ton profil (les trois graphiques réexpliqués, points
forts en avant), Découvrir les métiers (tous les métiers du rapport avec l'avis donné, modifiable), Voir les
formations. À détailler une par une.

## Étape 5 — L'assistant

Brancher la discussion sur la route `/chat` du backend, afficher les sources de chaque réponse. À détailler.

## Étape 6 — La connexion et les mails

Maquettes : l'écran de connexion (adresse mail et numéro de rapport), le mail d'invitation envoyé après le
passage au Centre, et le mail envoyé la veille de la suppression des données, un an plus tard, avec la synthèse
de tout ce que le jeune a fait sur le site. À détailler.

## Étape 7 — Branchement sur l'API et captures

Remplacer le fichier de données inventées par les appels au backend quand il tourne, en gardant le fichier comme
repli pour la démo en ligne. Refaire les captures d'écran pour `captures/` avec les données inventées.
