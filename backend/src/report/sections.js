// Structure connue du Rapport des Possibles (AGENTS.md, section 4, et les vrais
// PDF) : sections, mots-clés, et repérage des pages de chaque section.

import { normaliser } from '../text.js';

// `titreEnPremiereLigne` : la section graphique commence par son titre en
// première ligne de page (« MESURE D'INTÉRÊTS PROFESSIONNELS »…), ce qui
// permet d'éviter le sommaire (les titres y apparaissent au milieu de page).
export const SECTIONS = {
  interets: {
    titre: 'Intérêts professionnels',
    motsCles: ["mesure d'interets professionnels", 'riasec'],
    titreEnPremiereLigne: true,
    graphique: 'radar',
    echelleMax: 100.0, // pas d'échelle chiffrée : on lit un relatif, l'anneau extérieur vaut 100
    labels: ['Réaliste', 'Investigateur', 'Artistique', 'Social', 'Entreprenant', 'Conventionnel'],
  },
  aptitudes: {
    titre: 'Aptitudes cognitives',
    motsCles: ["mesure d'aptitudes cognitives"],
    titreEnPremiereLigne: true,
    graphique: 'histogramme',
    echelleMax: 7.0, // notées de 0 à 7 dans le rapport
    // Deux gabarits de rapport existent, avec deux jeux de 9 aptitudes (dans
    // l'ordre des barres, de gauche à droite). Le gabarit est reconnu aux
    // libellés écrits sous les barres ; aucun ne correspond -> pas de valeur.
    gabarits: [
      [
        'Originalité',
        'Raisonnement déductif',
        'Raisonnement inductif',
        'Flexibilité des catégories',
        'Facilité avec les nombres',
        'Mémorisation',
        'Visualisation',
        'Attention sélective',
        'Partage du temps',
      ],
      [
        'Compréhension orale',
        'Compréhension écrite',
        'Expression orale',
        'Expression écrite',
        'Fluidité des idées',
        'Originalité',
        'Sensibilité aux problèmes',
        'Raisonnement déductif',
        'Raisonnement inductif',
      ],
    ],
    get labels() {
      return this.gabarits[0]; // libellés de repli quand le graphique est illisible
    },
  },
  personnalite: {
    titre: 'Personnalité',
    motsCles: ['mesure de personnalite', 'hexaco'],
    titreEnPremiereLigne: true,
    graphique: 'radar',
    echelleMax: 100.0,
    labels: [
      'Émotivité',
      'Extraversion',
      'Agréabilité',
      'Caractère consciencieux',
      'Humilité-honnêteté',
      'Ouverture à l’expérience',
    ],
  },
  champ: {
    titre: 'Champ des possibles',
    motsCles: ['champ des possibles', 'zone de metiers'],
    titreEnPremiereLigne: false,
  },
  avertissement: {
    titre: 'Avertissement',
    motsCles: ['avertissement', 'travaux experimentaux', 'resultats presentes dans ce bilan'],
    titreEnPremiereLigne: false,
  },
};

// Section -> champ de l'analyse qui recevra les scores
export const CHAMPS_SCORES = {
  interets: 'interets_riasec',
  aptitudes: 'aptitudes',
  personnalite: 'personnalite_hexaco',
};

// Pour chaque section connue, les numéros de pages où elle apparaît
// (mots-clés cherchés dans le texte normalisé de toute la page).
export function detecterSections(pages) {
  const trouvees = {};
  for (const page of pages) {
    const texteNorm = normaliser(page.texte);
    for (const [cle, cfg] of Object.entries(SECTIONS)) {
      if (cfg.motsCles.some((m) => texteNorm.includes(m))) {
        (trouvees[cle] = trouvees[cle] || []).push(page.numero);
      }
    }
  }
  return trouvees;
}

// Pages dont la première ligne contient un mot-clé de la section.
export function pagesAvecTitreEnPremiereLigne(pages, cfg) {
  const resultat = [];
  for (const page of pages) {
    if (page.lignes.length && cfg.motsCles.some((m) => normaliser(page.lignes[0].texte).includes(m))) {
      resultat.push(page.numero);
    }
  }
  return resultat;
}

// Retourne la mention « Rdv … » du rapport.
export function extraireRdv(pages) {
  for (const page of pages) {
    const m = page.texte.match(/Rdv\s*n?°?\s*[A-Za-z0-9-]+/);
    if (m) return m[0].trim();
  }
  return null;
}

export function extraireAvertissement(pages, numeros) {
  if (!numeros.length) return null;
  return numeros.map((n) => (pages[n - 1].texte || '').trim()).join('\n').trim() || null;
}
