// Informations régionales des métiers préférés des données inventées (étape 3, maquette pour le jury).
//
// TOUT EST INVENTÉ, comme les métiers eux-mêmes (« Métier fictif A »). Chaque bloc porte sa source :
// - source 'exemple' : donnée d'exemple, affichée avec l'étiquette « Exemple inventé » ;
// - dans la vraie version, ces informations viendront d'orientation-regionsud.fr ou de l'ONISEP,
//   citées par un lien, jamais recopiées.

export const SOURCE_EXEMPLE = {
  id: 'exemple',
  titre: "Données d'exemple, inventées pour la démo",
  detail: "Dans la vraie version, ces informations viendront d'orientation-regionsud.fr, avec un lien vers chaque page utilisée.",
  url: 'https://www.orientation-regionsud.fr/',
  lien: 'orientation-regionsud.fr',
}

export const INFOS_METIERS = {
  'z1-m1': {
    secteur: 'Commerce et accueil',
    icone: 'store',
    accroche: 'Un métier de terrain, au contact des gens, où tu peux commencer vite.',
    salaire: { valeur: '1 400 à 1 600 €', precision: 'net par mois, en début de carrière' },
    etudes: { valeur: 'CAP ou formation courte', precision: 'possible aussi en apprentissage' },
    lieu: { valeur: 'Magasins, accueil', precision: 'dans toute la Métropole' },
    environnement: ['En équipe', 'Debout et en mouvement', 'Contact avec le public', 'Horaires parfois le week-end'],
    journee: [
      { moment: 'Le matin', texte: 'Tu prépares ton espace et tu fais le point avec l’équipe.' },
      { moment: 'La journée', texte: 'Tu accueilles, tu conseilles, tu règles les petits problèmes.' },
      { moment: 'Le soir', texte: 'Tu ranges et tu prépares le lendemain.' },
    ],
    formations: [
      { nom: 'CAP fictif Accueil et vente', ville: 'Nice', duree: '2 ans', cout: 'Gratuit', acces: 'Sur dossier', alternance: true },
      { nom: 'Formation courte fictive Conseil client', ville: 'Cagnes-sur-Mer', duree: '6 mois', cout: 'Financement possible', acces: 'Entretien', alternance: false },
    ],
  },
  'z2-m3': {
    secteur: 'Technique et fabrication',
    icone: 'wrench',
    accroche: 'Un métier concret, où tu vois le résultat de ton travail à la fin de la journée.',
    salaire: { valeur: '1 500 à 1 800 €', precision: 'net par mois, en début de carrière' },
    etudes: { valeur: 'Bac pro ou CAP', precision: 'en lycée ou en apprentissage' },
    lieu: { valeur: 'Ateliers, chantiers', precision: 'Nice, Grasse, Carros' },
    environnement: ['Travail manuel', 'En atelier ou dehors', 'En petite équipe', 'Outils et machines'],
    journee: [
      { moment: 'Le matin', texte: 'Tu découvres le chantier ou la commande du jour.' },
      { moment: 'La journée', texte: 'Tu fabriques, tu montes, tu vérifies que tout tient.' },
      { moment: 'Le soir', texte: 'Tu nettoies tes outils et tu notes ce qui reste à faire.' },
    ],
    formations: [
      { nom: 'Bac pro fictif Techniques d’atelier', ville: 'Nice', duree: '3 ans', cout: 'Gratuit', acces: 'Sur dossier', alternance: true },
      { nom: 'CAP fictif Fabrication', ville: 'Carros', duree: '2 ans', cout: 'Gratuit', acces: 'Ouvert à tous', alternance: true },
      { nom: 'Titre pro fictif Monteur', ville: 'Antibes', duree: '9 mois', cout: 'Financement possible', acces: 'Entretien', alternance: false },
    ],
  },
  'z3-m1': {
    secteur: 'Social et accompagnement',
    icone: 'heart',
    accroche: 'Un métier où tu aides les autres à avancer, au quotidien.',
    salaire: { valeur: '1 600 à 1 900 €', precision: 'net par mois, en début de carrière' },
    etudes: { valeur: 'Diplôme en 2 à 3 ans', precision: 'après le bac, en école ou en alternance' },
    lieu: { valeur: 'Associations, structures', precision: 'Nice et alentours' },
    environnement: ['Contact humain', 'Écoute', 'Travail en équipe', 'Déplacements'],
    journee: [
      { moment: 'Le matin', texte: 'Tu fais le point avec l’équipe sur les personnes suivies.' },
      { moment: 'La journée', texte: 'Tu reçois, tu écoutes, tu proposes des solutions.' },
      { moment: 'Le soir', texte: 'Tu écris un compte rendu pour garder le fil.' },
    ],
    formations: [
      { nom: 'Diplôme fictif Accompagnement social', ville: 'Nice', duree: '3 ans', cout: 'Gratuit', acces: 'Sur dossier', alternance: true },
      { nom: 'Formation fictive Animation', ville: 'Saint-Laurent-du-Var', duree: '1 an', cout: 'Financement possible', acces: 'Entretien', alternance: false },
    ],
  },
}
