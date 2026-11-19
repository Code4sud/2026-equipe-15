// Lecture des scores sur les tracés vectoriels des graphiques du rapport :
// - radar = anneaux concentriques + polygone de données excentré ;
// - histogramme = barres sur une même ligne de base, la plus haute vaut le max.
// Chaque score porte sa source (page, section, type de lecture).
// Si un graphique est une image (pas de tracé), on ne devine rien :
// value=null et source.type="absent".

import { normaliser } from '../text.js';

export function lireScores(pages, numerosPages, cfg) {
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

export function distance(p, centre) {
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
  const [, cy] = c.centre;
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
