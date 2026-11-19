// Extraction sémantique du Rapport des Possibles. // JF — portage Node
//
// Transforme les pages brutes produites par `pdfService` en objet
// ReportAnalysis (voir models/schemas.py côté Python, même forme JSON) :
// - les sections du rapport : chaque graphique a son titre en première
//   ligne de page (« MESURE D'INTÉRÊTS PROFESSIONNELS »…), ce qui permet
//   d'éviter le sommaire ;
// - les scores des graphiques, lus sur les tracés vectoriels du PDF :
//   radars = anneaux concentriques + polygone de données, histogramme =
//   barres sur une même ligne de base. Chaque score porte sa source
//   (page, section, type de lecture) ;
// - les métiers du champ des possibles (« 1ère ZONE DE MÉTIERS »…), avec
//   leur zone et sa description (« Métiers accessibles en 0 à 6 mois ») ;
// - l'avertissement final (page « travaux expérimentaux »).
//
// Si un graphique est une image (pas de tracé vectoriel), on ne devine
// rien : les scores sont retournés avec value=null et source.type="absent".

import crypto from 'node:crypto';
import { extrairePages, normaliser } from './pdfService.js';

// ─── Structure connue du rapport (AGENTS.md, section 4, et les vrais PDF) ────

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
    labels: [
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
const CHAMPS_SCORES = {
  interets: 'interets_riasec',
  aptitudes: 'aptitudes',
  personnalite: 'personnalite_hexaco',
};

// « 1ère ZONE DE MÉTIERS », « 2ème ZONE DE MÉTIERS »… (texte normalisé)
const ZONE_RE = /(\d+)\s*[a-z]*\s*zone de m/;

// ─── Point d'entrée public ────────────────────────────────────────────────────

export async function analyserRapport(chemin, nomFichier, idAnalyse = null) {
  const pages = await extrairePages(chemin);
  const sections = detecterSections(pages);
  const notes = [];

  const analyse = {
    id: idAnalyse || crypto.randomUUID().replace(/-/g, ''),
    fichier: nomFichier,
    nb_pages: pages.length,
    rdv: extraireRdv(pages),
    sections_detectees: Object.keys(SECTIONS).filter((cle) => sections[cle]).map((cle) => SECTIONS[cle].titre),
  };

  for (const [cle, champ] of Object.entries(CHAMPS_SCORES)) {
    const cfg = SECTIONS[cle];
    let numeros = sections[cle] || [];
    if (cfg.titreEnPremiereLigne) {
      // Pages dont la première ligne est le titre de la section
      // graphique (évite le sommaire).
      const pagesTitre = pagesAvecTitreEnPremiereLigne(pages, cfg);
      numeros = pagesTitre.length ? pagesTitre : numeros;
    }
    const { scores, note } = lireScores(pages, numeros, cfg);
    if (note) notes.push(`${cfg.titre} — ${note}`);
    analyse[champ] = scores;
  }

  analyse.metiers = extraireMetiers(pages, sections.champ || [], notes);
  analyse.avertissement = extraireAvertissement(pages, sections.avertissement || []);
  analyse.notes = notes;
  return analyse;
}

// ─── Sections et divers ───────────────────────────────────────────────────────

export function detecterSections(pages) {
  // Pour chaque section connue, les numéros de pages où elle apparaît
  // (mots-clés cherchés dans le texte normalisé de toute la page).
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

function pagesAvecTitreEnPremiereLigne(pages, cfg) {
  const resultat = [];
  for (const page of pages) {
    if (page.lignes.length && cfg.motsCles.some((m) => normaliser(page.lignes[0].texte).includes(m))) {
      resultat.push(page.numero);
    }
  }
  return resultat;
}

export function extraireRdv(pages) {
  // Retourne la mention « Rdv … » du rapport (ex. « Rdv FICTIF » en test).
  for (const page of pages) {
    const m = page.texte.match(/Rdv\s*n?°?\s*[A-Za-z0-9-]+/);
    if (m) return m[0].trim();
  }
  return null;
}

function extraireAvertissement(pages, numeros) {
  if (!numeros.length) return null;
  return numeros.map((n) => (pages[n - 1].texte || '').trim()).join('\n').trim() || null;
}

// ─── Scores des graphiques ────────────────────────────────────────────────────

function lireScores(pages, numerosPages, cfg) {
  // Lit les scores sur la première page de la section qui contient un
  // graphique. Repli honnête : labels connus, value=null, type « absent ».
  for (const numero of numerosPages) {
    const page = pages[numero - 1];
    const { scores, note } =
      cfg.graphique === 'radar' ? lireRadar(page, cfg) : lireHistogramme(page, cfg);
    if (scores.length) return { scores, note };
  }

  // Aucun tracé vectoriel trouvé : on ne devine pas les valeurs.
  const pageRef = numerosPages.length ? numerosPages[0] : 1;
  const source = {
    page: pageRef,
    section: cfg.titre,
    type: 'absent',
    detail:
      "Scores présents sous forme d'image dans le PDF, non lisibles en vectoriel : à lire avec un modèle de vision (ai_service).",
  };
  const scores = cfg.labels.map((label) => ({ label, value: null, echelle_max: cfg.echelleMax, source }));
  return { scores, note: 'aucun tracé vectoriel trouvé, valeurs non extraites automatiquement' };
}

function lireRadar(page, cfg) {
  // Radar vectoriel : anneaux concentriques (ils partagent le centre du
  // radar), polygone de données (excentré), étiquettes horizontales aux
  // extrémités des axes.
  const candidats = page.courbes.filter((c) => c.points.length >= 5 && estPolygoneRadar(c, page));
  if (candidats.length < 2) return { scores: [], note: null };

  // Le centre du radar = le centre partagé par le plus de polygones.
  const centre = centreLePlusPartage(candidats);
  const anneaux = candidats.filter((c) => distance(c.centre, centre) <= 5);
  let excentres = candidats.filter((c) => distance(c.centre, centre) > 5);
  if (!excentres.length) {
    // polygone de données symétrique : repli sur le remplissage
    excentres = candidats.filter((c) => c.remplie && !anneaux.includes(c));
  }
  if (!excentres.length) return { scores: [], note: null };

  const donnees = excentres.reduce((a, b) => (b.plusLoinDuCentre > a.plusLoinDuCentre ? b : a));
  const anneau = anneaux.reduce((a, b) => (b.plusLoinDuCentre > a.plusLoinDuCentre ? b : a));
  const rMax = distanceMoyenne(anneau, centre);
  if (rMax < 20) return { scores: [], note: null }; // anneau dégénéré, illisible

  const echelle = cfg.echelleMax;
  const note = `lu sur le tracé vectoriel : distance au centre / rayon de l'anneau extérieur × ${echelle} (anneau = ${echelle})`;
  const axes = labelsDesAxes(anneau.points, page.lignes, centre, rMax);

  const scores = axes.map(([angle, labelBrut], i) => {
    const label = labelCanonique(labelBrut, cfg.labels);
    const point = pointLePlusProche(donnees.points, angle, centre);
    const valeur = Math.round((distance(point, centre) / rMax) * echelle * 10) / 10;
    return {
      label,
      value: valeur,
      echelle_max: echelle,
      source: { page: page.numero, section: cfg.titre, type: 'trace_vectoriel', detail: note },
    };
  });
  return { scores: ordonnerScores(scores, cfg.labels), note };
}

function lireHistogramme(page, cfg) {
  // Histogramme vectoriel : barres posées sur une même ligne de base. La
  // barre la plus haute vaut l'échelle max. Les étiquettes sont pivotées
  // (verticales) dans le PDF : on associe les libellés connus de gauche à
  // droite.
  let barres = page.barres.filter((b) => b.hauteur >= 5 && b.largeur <= 120 && b.bas < 0.9 * page.hauteur);
  if (!barres.length) return { scores: [], note: null };
  const basMax = Math.max(...barres.map((b) => b.bas));
  barres = barres.filter((b) => basMax - b.bas <= 3); // même ligne de base
  barres.sort((a, b) => a.xCentre - b.xCentre);
  const hMax = Math.max(...barres.map((b) => b.hauteur));

  const echelle = cfg.echelleMax;
  const labels = cfg.labels;
  const note = `lu sur le tracé vectoriel : hauteur de la barre / barre la plus haute × ${echelle} (la plus haute = ${echelle}) ; étiquettes pivotées dans le PDF, associées par position de gauche à droite`;
  const scores = barres.map((barre, i) => {
    const label = i < labels.length ? labels[i] : `aptitude ${i + 1}`;
    const valeur = Math.round((barre.hauteur / hMax) * echelle * 10) / 10;
    return {
      label,
      value: valeur,
      echelle_max: echelle,
      source: { page: page.numero, section: cfg.titre, type: 'trace_vectoriel', detail: note },
    };
  });
  return { scores, note };
}

// ─── Géométrie des graphiques ─────────────────────────────────────────────────

function distance(p, centre) {
  return Math.hypot(p[0] - centre[0], p[1] - centre[1]);
}

function distanceMoyenne(courbe, centre) {
  return courbe.points.reduce((s, p) => s + distance(p, centre), 0) / courbe.points.length;
}

function angle(p, centre) {
  return Math.atan2(p[1] - centre[1], p[0] - centre[0]);
}

function ecartAngle(a, b) {
  const d = Math.abs(a - b) % (2 * Math.PI);
  return Math.min(d, 2 * Math.PI - d);
}

function estPolygoneRadar(c, page) {
  // Filtre les faux positifs : un polygone de radar fait au moins 25 pt de
  // côté, a un rapport largeur/hauteur raisonnable, et n'est pas dans le
  // bandeau de pied de page.
  const xs = c.points.map((p) => p[0]);
  const ys = c.points.map((p) => p[1]);
  const largeur = Math.max(...xs) - Math.min(...xs);
  const hauteur = Math.max(...ys) - Math.min(...ys);
  const [cx, cy] = c.centre;
  return largeur >= 25 && hauteur >= 25 && largeur / hauteur >= 0.4 && largeur / hauteur <= 2.5 && cy < 0.85 * page.hauteur;
}

function centreLePlusPartage(courbes, tol = 5) {
  // Centre partagé par le plus de polygones (les anneaux du radar).
  const clusters = [];
  for (const c of courbes) {
    let trouve = false;
    for (const cluster of clusters) {
      if (distance(cluster[0], c.centre) <= tol) {
        cluster.push(c.centre);
        trouve = true;
        break;
      }
    }
    if (!trouve) clusters.push([c.centre]);
  }
  const plusGros = clusters.reduce((a, b) => (b.length > a.length ? b : a));
  return [
    plusGros.reduce((s, p) => s + p[0], 0) / plusGros.length,
    plusGros.reduce((s, p) => s + p[1], 0) / plusGros.length,
  ];
}

function labelsDesAxes(points, lignes, centre, rMax) {
  // Pour chaque sommet de l'anneau extérieur (un axe), l'étiquette est la
  // ligne courte (1 à 4 mots) située dans le cône de l'axe, entre 0,7 et 1,8
  // fois le rayon. Retourne [[angle, label], ...].
  const angles = [];
  for (const p of points) {
    const a = Math.round(angle(p, centre) * 1000) / 1000;
    if (!angles.length || ecartAngle(angles[angles.length - 1], a) > 1e-3) angles.push(a);
  }
  const seuil = (Math.PI / Math.max(angles.length, 3)) * 1.5; // cône de recherche autour de l'axe

  const candidats = [];
  for (const ligne of lignes) {
    const nbMots = ligne.texte.split(/\s+/).length;
    if (nbMots < 1 || nbMots > 4) continue;
    const pos = [ligne.xCentre, ligne.haut];
    const d = distance(pos, centre);
    if (d >= 0.7 * rMax && d <= 1.8 * rMax) candidats.push([angle(pos, centre), ligne.texte]);
  }

  // Une étiquette peut être coupée sur deux lignes : on regroupe les lignes
  // dont l'angle est quasi identique.
  candidats.sort((a, b) => a[0] - b[0]);
  const groupes = [];
  for (const [a, texte] of candidats) {
    if (groupes.length && ecartAngle(groupes[groupes.length - 1][groupes[groupes.length - 1].length - 1][0], a) <= 0.12) {
      groupes[groupes.length - 1].push([a, texte]);
    } else {
      groupes.push([[a, texte]]);
    }
  }
  const etiquettes = groupes.map((g) => [
    g.reduce((s, x) => s + x[0], 0) / g.length,
    g.map((x) => x[1]).join(' '),
  ]);

  return angles.map((a, i) => {
    let meilleure = null;
    for (const [angleE, texte] of etiquettes) {
      const d = ecartAngle(angleE, a);
      if (d <= seuil && (meilleure === null || d < meilleure[0])) meilleure = [d, texte];
    }
    return [a, meilleure ? meilleure[1] : `axe ${i + 1}`];
  });
}

function pointLePlusProche(points, a, centre) {
  return points.reduce((best, p) => (ecartAngle(angle(p, centre), a) < ecartAngle(angle(best, centre), a) ? p : best));
}

function labelCanonique(texteBrut, labels) {
  // Rattache une étiquette lue à son libellé connu (RIASEC, HEXACO…) par
  // chevauchement de mots.
  const mots = new Set(normaliser(texteBrut).split(' '));
  let meilleur = texteBrut;
  let meilleurScore = 0;
  for (const label of labels) {
    const score = normaliser(label).split(' ').filter((m) => mots.has(m)).length;
    if (score > meilleurScore) {
      meilleur = label;
      meilleurScore = score;
    }
  }
  return meilleur;
}

function ordonnerScores(scores, labelsConnus) {
  // Remet les scores dans l'ordre connu des dimensions du rapport.
  const ordre = {};
  labelsConnus.forEach((l, i) => (ordre[normaliser(l)] = i));
  return scores.slice().sort((a, b) => (ordre[normaliser(a.label)] ?? 999) - (ordre[normaliser(b.label)] ?? 999));
}

// ─── Champ des possibles (métiers et zones) ───────────────────────────────────

function extraireMetiers(pages, numerosPages, notes) {
  // Dans le champ des possibles : une ligne « Nème ZONE DE MÉTIERS » ouvre
  // une zone (la ligne suivante donne son libellé « Métiers accessibles en
  // … »), une ligne en gras de taille titre (≥ 13 pt) est un nom de métier,
  // les lignes suivantes forment sa description.
  const metiers = [];
  let zone = null;
  let zoneLabel = '';
  let courant = null;

  for (const numero of numerosPages) {
    const page = pages[numero - 1];
    const lignes = page.lignes;
    for (let i = 0; i < lignes.length; i++) {
      const ligne = lignes[i];
      const texteNorm = normaliser(ligne.texte);
      if (!texteNorm) continue;
      // Vestige de « Nème ZONE DE MÉTIERS » découpé en plusieurs items :
      // un suffixe ordinal seul n'est jamais un titre de zone ni un métier.
      if (/^[eè]me$/.test(texteNorm) || /^[eè]re$/.test(texteNorm)) continue;
      const m = texteNorm.match(ZONE_RE);
      if (m) {
        zone = parseInt(m[1], 10);
        zoneLabel = '';
        courant = null;
        if (i + 1 < lignes.length && normaliser(lignes[i + 1].texte).includes('metiers accessibles en')) {
          zoneLabel = lignes[i + 1].texte.trim();
        }
        continue;
      }
      if (texteNorm.includes('champ des possibles')) continue;
      if (ligne.gras && zone !== null && ligne.taille >= 13 && ligne.texte.length <= 90) {
        courant = {
          nom: ligne.texte,
          zone,
          zone_label: zoneLabel,
          description: '',
          source: { page: numero, section: 'Champ des possibles', type: 'texte', detail: 'ligne en gras du rapport' },
        };
        metiers.push(courant);
      } else if (courant) {
        courant.description = (courant.description + ' ' + ligne.texte).trim();
      } else if (zone !== null && (texteNorm.includes('aucune proposition') || texteNorm.includes('zone vide'))) {
        notes.push(`Zone ${zone} (page ${numero}) : ${ligne.texte}`);
      }
    }
  }
  return metiers;
}
