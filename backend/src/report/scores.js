// Lecture des scores sur les tracés vectoriels des graphiques du rapport :
// - radar = anneaux gris concentriques + polygone de données au trait rose ;
// - histogramme = barres mesurées avec les graduations écrites de l'axe.
// Chaque score porte sa source (page, section, type de lecture).
// Si un graphique est une image (pas de tracé), on ne devine rien :
// value=null et source.type="absent".

import { normaliser } from '../text.js';

// Styles observés sur les vrais rapports (identiques sur tous ceux étudiés).
const ROSE = '#e0349b'; // polygone des données, encadrés « point fort », barres
const BLEU = '#5d62ea'; // encadrés des autres dimensions
const GRIS_GRILLE = '#d8d8d8'; // anneaux des radars, lignes de l'histogramme

// Pour comparer des libellés : sans accents, et lettres doublées écrasées
// (l'extraction perd parfois un « l » sur deux).
const comparable = (t) => normaliser(t).replace(/(.)\1+/g, '$1');

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
  // radar), polygone de données, étiquettes horizontales aux extrémités des
  // axes. Le polygone de données est reconnu par son trait (rose, épais) :
  // la reconnaissance par la forme échoue quand des valeurs valent 0 (sommets
  // confondus au centre). Repli sur la forme si le style n'est pas trouvé.
  const candidats = page.courbes.filter((c) => c.points.length >= 5 && estPolygoneRadar(c, page));
  const anneauxGris = candidats.filter((c) => !c.remplie && c.couleurTrait === GRIS_GRILLE);
  let centre;
  let anneaux;
  let donnees = null;
  let parStyle = false;

  if (anneauxGris.length >= 2) {
    centre = centreLePlusPartage(anneauxGris);
    anneaux = anneauxGris.filter((c) => distance(c.centre, centre) <= 5);
    const rExt = Math.max(...anneaux.map((c) => distanceMoyenne(c, centre)));
    const roses = page.courbes.filter(
      (c) =>
        !c.remplie &&
        c.couleurTrait === ROSE &&
        c.epaisseur >= 1.5 &&
        c.points.every((p) => distance(p, centre) <= rExt * 1.05)
    );
    if (roses.length) {
      donnees = roses.reduce((a, b) => (b.points.length > a.points.length ? b : a));
      parStyle = true;
    }
  }
  if (!donnees) {
    if (candidats.length < 2) return { scores: [], note: null };
    // Le centre du radar = le centre partagé par le plus de polygones.
    centre = centreLePlusPartage(candidats);
    anneaux = candidats.filter((c) => distance(c.centre, centre) <= 5);
    let excentres = candidats.filter((c) => distance(c.centre, centre) > 5);
    if (!excentres.length) {
      // polygone de données symétrique : repli sur le remplissage
      excentres = candidats.filter((c) => c.remplie && !anneaux.includes(c));
    }
    if (!excentres.length) return { scores: [], note: null };
    donnees = excentres.reduce((a, b) => (b.plusLoinDuCentre > a.plusLoinDuCentre ? b : a));
  }

  const anneau = anneaux.reduce((a, b) => (b.plusLoinDuCentre > a.plusLoinDuCentre ? b : a));
  const rMax = distanceMoyenne(anneau, centre);
  if (rMax < 20) return { scores: [], note: null }; // anneau dégénéré, illisible

  const echelle = cfg.echelleMax;
  const note =
    `lu sur le tracé vectoriel : distance au centre / rayon de l'anneau extérieur × ${echelle} ` +
    `(anneau extérieur = ${echelle}, ${anneaux.length} anneaux)` +
    (parStyle ? '' : ' ; polygone des données reconnu par sa forme (trait rose non trouvé)');
  const axes = labelsDesAxes(anneau.points, page.lignes, centre, rMax);

  const scores = axes.map(([angleAxe, labelBrut]) => {
    const label = labelCanonique(labelBrut, cfg.labels);
    // Sommet du polygone sur cet axe (par l'angle, pas par l'ordre des
    // points) ; un axe sans sommet hors du centre vaut 0.
    const surAxe = donnees.points.filter((p) => distance(p, centre) > 0.5 && ecartAngle(angle(p, centre), angleAxe) <= 0.05);
    const d = surAxe.length ? Math.max(...surAxe.map((p) => distance(p, centre))) : 0;
    const valeur = Math.round((d / rMax) * echelle * 10) / 10;
    return {
      label,
      value: valeur,
      echelle_max: echelle,
      point_fort: null,
      source: { page: page.numero, section: cfg.titre, type: 'trace_vectoriel', detail: note },
    };
  });
  const noteForts = marquerPointsForts(page, scores, cfg.labels);
  return { scores: ordonnerScores(scores, cfg.labels), note: noteForts ? `${note} ; ${noteForts}` : note };
}

// Sous chaque radar, chaque dimension a un encadré de description : fond
// rose pour celles que le rapport met en avant, bleu pour les autres. On lit
// la couleur de l'encadré qui contient le libellé : rien n'est recalculé.
function marquerPointsForts(page, scores, labelsConnus) {
  const formes = [
    ...page.courbes.filter((c) => c.remplie).map((c) => ({ couleur: c.couleurFond, ...boite(c.points) })),
    ...page.barres.map((b) => ({ couleur: b.couleurFond, x0: b.x0, x1: b.x1, haut: b.haut, bas: b.bas })),
  ].filter((f) => f.couleur === ROSE || f.couleur === BLEU);

  const couleurParLabel = {};
  const formeParLabel = {};
  for (const f of formes) {
    for (const ligne of page.lignes) {
      if (ligne.xCentre < f.x0 || ligne.xCentre > f.x1 || ligne.baseline < f.haut || ligne.haut > f.bas) continue;
      const label = labelCanonique(ligne.texte, labelsConnus);
      if (labelsConnus.includes(label)) {
        couleurParLabel[label] = f.couleur;
        formeParLabel[label] = f;
      }
    }
  }
  if (!Object.keys(couleurParLabel).length) return 'encadrés de couleur non trouvés : point_fort non renseigné';
  const encadres = Object.values(formeParLabel);
  for (const s of scores) {
    if (couleurParLabel[s.label]) s.point_fort = couleurParLabel[s.label] === ROSE;
    if (formeParLabel[s.label]) s.description = texteSousEncadre(page, formeParLabel[s.label], encadres);
  }
  return null;
}

// Texte du rapport écrit sous un encadré (l'explication de la dimension), lu
// morceau par morceau dans sa colonne : les lignes de deux colonnes voisines
// sont parfois fusionnées par le regroupement en lignes. S'arrête à
// l'encadré suivant de la colonne ou au premier grand blanc.
function texteSousEncadre(page, f, encadres) {
  const aDroite = encadres.map((e) => e.x0).filter((x) => x > f.x0 + 50);
  const xMax = aDroite.length ? Math.min(...aDroite) - 5 : page.largeur;
  const dessous = encadres.filter((e) => Math.abs(e.x0 - f.x0) < 20 && e.haut > f.bas).map((e) => e.haut);
  const yMax = Math.min(dessous.length ? Math.min(...dessous) : Infinity, f.bas + 150, page.hauteur * 0.92);
  const morceaux = page.mots
    .filter((m) => m.texte.trim() && m.x0 >= f.x0 - 10 && m.x0 < xMax && m.yCentre > f.bas && m.yCentre < yMax)
    .sort((a, b) => Math.round(a.yCentre / 3) - Math.round(b.yCentre / 3) || a.x0 - b.x0);
  const lignes = [];
  for (const m of morceaux) {
    const derniere = lignes[lignes.length - 1];
    if (derniere && Math.abs(m.yCentre - derniere.y) <= 3) {
      derniere.texte += (m.x0 - derniere.x1 > 1 ? ' ' : '') + m.texte;
      derniere.x1 = m.x1;
    } else {
      if (derniere && m.yCentre - derniere.y > 25) break; // grand blanc : fin du paragraphe
      lignes.push({ texte: m.texte, y: m.yCentre, x1: m.x1 });
    }
  }
  return lignes.map((l) => l.texte.trim()).join(' ').replace(/\s+/g, ' ').trim() || null;
}

function lireHistogramme(page, cfg) {
  // Histogramme vectoriel : barres posées sur la ligne « 0 ». La hauteur
  // d'une barre est convertie en points avec les graduations écrites à
  // gauche de l'axe (« 0 », « 1 »… ou « 0 », « 0.5 »… : le pas change d'un
  // rapport à l'autre), recalées sur les lignes de la grille. Sans
  // graduations lisibles, on ne devine pas : pas de valeur.
  const grille = lignesDeGrille(page);
  const graduations = lireGraduations(page, grille);
  if (graduations.length < 2) return { scores: [], note: null };

  // Droite y = y0 + k × valeur, par moindres carrés sur les graduations.
  const n = graduations.length;
  const mv = graduations.reduce((s, g) => s + g.valeur, 0) / n;
  const my = graduations.reduce((s, g) => s + g.y, 0) / n;
  const k =
    graduations.reduce((s, g) => s + (g.valeur - mv) * (g.y - my), 0) /
    graduations.reduce((s, g) => s + (g.valeur - mv) ** 2, 0);
  const y0 = my - k * mv;
  if (!(k < 0)) return { scores: [], note: null }; // axe incohérent (les valeurs montent vers le haut)
  const parUnite = -k;
  const axeMax = Math.max(...graduations.map((g) => g.valeur));
  const xMin = grille.length ? Math.min(...grille.map((t) => t.x0)) - 2 : 0;
  const xMax = grille.length ? Math.max(...grille.map((t) => t.x1)) + 2 : page.largeur;

  const barres = page.barres
    .filter((b) => b.couleurFond !== '#ffffff' && b.largeur <= 60 && Math.abs(b.bas - y0) <= 2 && b.x0 >= xMin && b.x1 <= xMax)
    .sort((a, b) => a.xCentre - b.xCentre);
  if (!barres.length) return { scores: [], note: null };

  const gabarits = cfg.gabarits || [cfg.labels];
  const detail =
    `lu sur le tracé vectoriel : hauteur de la barre mesurée avec les graduations de l'axe (0 à ${axeMax}) ; ` +
    `libellé lu sous la barre et reconnu dans un gabarit connu du rapport`;
  const notes = [];
  const pivotes = page.textesPivotes.slice().sort((a, b) => a.xFin - b.xFin);
  const source = { page: page.numero, section: cfg.titre, type: 'trace_vectoriel', detail };
  const absent = { page: page.numero, section: cfg.titre, type: 'absent', detail: 'libellés des aptitudes non reconnus : valeur non donnée' };
  const valeurDe = (barre) => Math.round(((barre.bas - barre.haut) / parUnite) * 10) / 10;

  // Le gabarit dont les 9 libellés sont exactement ceux lus sous les barres,
  // dans l'ordre. On ne devine pas : sans gabarit reconnu, une barre ne peut
  // pas être nommée, donc aucune valeur n'est donnée.
  const lus = pivotes.map((t) => t.texte);
  const gabarit = gabarits.find((g) => g.length === lus.length && g.every((l, i) => comparable(l) === comparable(lus[i])));

  let scores;
  if (gabarit) {
    // Chaque barre est rattachée à l'étiquette qui se termine sous elle.
    // Pas de barre = valeur 0.
    scores = gabarit.map((label, i) => {
      const barre = barres.find((b) => pivotes[i].xFin >= b.x0 - 8 && pivotes[i].xFin <= b.x1 + 8);
      if (!barre) notes.push(`aucune barre au-dessus de « ${label} » : lue comme 0`);
      return { label, value: barre ? valeurDe(barre) : 0, echelle_max: cfg.echelleMax, source };
    });
  } else {
    notes.push(
      lus.length
        ? `les libellés écrits sous les barres ne correspondent à aucun gabarit connu (${lus.join(', ')}) : valeurs non données`
        : 'les libellés écrits sous les barres ne sont pas lisibles : valeurs non données'
    );
    const labels = lus.length === gabarits[0].length ? lus : gabarits[0];
    scores = labels.map((label) => ({ label, value: null, echelle_max: cfg.echelleMax, source: absent }));
  }
  const nonEntieres = scores
    .filter((s) => s.value !== null && Math.abs(s.value - Math.round(s.value)) > 0.05)
    .map((s) => s.label);
  if (nonEntieres.length) notes.push(`valeurs non entières, lecture à vérifier : ${nonEntieres.join(', ')}`);
  return { scores, note: [detail, ...notes].join(' ; ') };
}

// Lignes horizontales longues de la grille, une par ordonnée.
function lignesDeGrille(page) {
  const lignes = page.traits
    .filter((t) => t.y1 - t.y0 < 0.5 && t.x1 - t.x0 >= 200 && t.couleur === GRIS_GRILLE)
    .sort((a, b) => a.y0 - b.y0);
  return lignes.filter((t, i) => i === 0 || t.y0 - lignes[i - 1].y0 > 0.5);
}

// Nombres écrits à gauche de la grille (« 0 », « 1 »… ou « 0.5 »…), avec
// l'ordonnée de la ligne de grille la plus proche (plus précise que le texte).
function lireGraduations(page, grille) {
  const xGrille = grille.length ? Math.min(...grille.map((t) => t.x0)) : null;
  const graduations = [];
  for (const ligne of page.lignes) {
    if (!/^\d+([.,]\d+)?$/.test(ligne.texte)) continue;
    if (xGrille === null || ligne.x1 > xGrille + 5 || ligne.x1 < xGrille - 40) continue;
    const yTexte = (ligne.haut + ligne.baseline) / 2;
    const proche = grille.reduce((a, t) => (!a || Math.abs(t.y0 - yTexte) < Math.abs(a.y0 - yTexte) ? t : a), null);
    if (!proche || Math.abs(proche.y0 - yTexte) > 3) continue;
    graduations.push({ valeur: parseFloat(ligne.texte.replace(',', '.')), y: proche.y0 });
  }
  return graduations;
}

function boite(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), haut: Math.min(...ys), bas: Math.max(...ys) };
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
