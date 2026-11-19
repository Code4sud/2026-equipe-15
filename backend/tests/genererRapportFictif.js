// Génère un Rapport des Possibles FICTIF pour les tests — PDF écrit à la
// main (content stream natif : m/l/h/S, re/f, BT/Tf/Td/Tj), sans dépendance,
// comme les vrais rapports produits par l'outil du Centre.
//
// Toutes les données sont inventées (règle du dépôt : « Rdv FICTIF », jamais
// de vrai numéro de rendez-vous, aucune donnée personnelle réelle).
//
// Le PDF imite la structure des vrais rapports : page de couverture, pages
// graphiques titrées en première ligne (« MESURE DE… »), radars en anneaux
// concentriques + polygone de données, histogramme à étiquettes pivotées,
// champ des possibles en « Nème ZONE DE MÉTIERS », page finale de
// « travaux expérimentaux ».

// Valeurs fictives du radar RIASEC (pourcentage de l'anneau extérieur = 100)
const VALEURS_RIASEC = {
  Réaliste: 80,
  Investigateur: 65,
  Artistique: 90,
  Social: 55,
  Entreprenant: 40,
  Conventionnel: 70,
};

// Valeurs fictives du radar HEXACO
const VALEURS_HEXACO = {
  Émotivité: 40,
  Extraversion: 75,
  Agréabilité: 55,
  'Caractère consciencieux': 85,
  'Humilité-honnêteté': 60,
  'Ouverture à l’expérience': 70,
};

// Aptitudes fictives, notées de 0 à 7, dans l'ordre des barres (gauche → droite)
const APTITUDES = [
  ['Originalité', 6],
  ['Raisonnement déductif', 5],
  ['Raisonnement inductif', 5],
  ['Flexibilité des catégories', 4],
  ['Facilité avec les nombres', 3],
  ['Mémorisation', 6],
  ['Visualisation', 7],
  ['Attention sélective', 4],
  ['Partage du temps', 5],
];

const ZONES = { 1: '0 à 6 mois', 2: '3 mois à 2 ans', 3: '1 à 4 ans', 4: '2 à 6 ans', 5: '4 à 10 ans' };

const METIERS = [
  [1, 'Coiffeur / coiffeuse', "Tu coupes, coiffes et conseilles les clients d'un salon. La formation est courte."],
  [1, 'Vendeur / vendeuse en magasin', 'Tu accueilles les clients, encaisses et mets en rayon dans un magasin.'],
  [2, 'Boulanger / boulangère', 'Tu fabriques le pain et les viennoiseries, souvent en commençant tôt le matin.'],
  [3, 'Infirmier / infirmière', "Tu soignes les patients à l'hôpital, après plusieurs années d'études."],
];

const AVERTISSEMENT =
  '« Les résultats présentés dans ce bilan proviennent de travaux expérimentaux. Ce sont des pistes ' +
  'de réflexion, pas des vérités : ils dépendent de la fatigue et de la motivation du jour du passage, ' +
  'et ils peuvent évoluer. »';

const A4_W = 595.28;
const A4_H = 841.89;

function echapperPdf(texte) {
  return texte.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function decouper(texte, largeur) {
  const mots = texte.split(/\s+/);
  const lignes = [];
  let courante = '';
  for (const mot of mots) {
    if (courante.length + mot.length + 1 > largeur) {
      lignes.push(courante);
      courante = mot;
    } else {
      courante = (courante + ' ' + mot).trim();
    }
  }
  if (courante) lignes.push(courante);
  return lignes;
}

// Largeur approximative d'un texte Helvetica (pour centrer) : 0,5 × taille
// par caractère en moyenne.
function largeurApprox(texte, taille) {
  return texte.length * taille * 0.5;
}

class PagePdf {
  constructor() {
    this.ops = [];
  }
  texte(x, y, contenu, { taille = 11, gras = false, centre = null } = {}) {
    const font = gras ? '/F2' : '/F1';
    const xx = centre !== null ? centre - largeurApprox(contenu, taille) / 2 : x;
    this.ops.push(`BT ${font} ${taille} Tf 1 0 0 1 ${xx.toFixed(2)} ${y.toFixed(2)} Tm (${echapperPdf(contenu)}) Tj ET`);
  }
  textePivote(x, y, contenu, taille) {
    // rotation -90° autour de (x, y)
    this.ops.push(
      `BT /F1 ${taille} Tf 0 1 -1 0 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${echapperPdf(contenu)}) Tj ET`
    );
  }
  polygone(points, { rempli = null, contour = null, epaisseur = 1 } = {}) {
    const [a, b, c, d] = contour || [0, 0, 0];
    this.ops.push(`${a} ${b} ${c} RG ${epaisseur} w`);
    const cmd = points.map((p, i) => `${i === 0 ? 'm' : 'l'} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ');
    this.ops.push(`${cmd} h ${rempli ? 'B' : 'S'}`);
    if (rempli) {
      const [r, g, bl] = rempli;
      this.ops.push(`${r} ${g} ${bl} rg`);
    }
  }
  rect(x, y, largeur, hauteur, rgb) {
    const [r, g, b] = rgb;
    this.ops.push(`${r} ${g} ${b} rg ${x.toFixed(2)} ${y.toFixed(2)} ${largeur.toFixed(2)} ${hauteur.toFixed(2)} re f`);
  }
}

function dessinerRadar(page, cx, cy, rayon, valeurs) {
  // Radar vectoriel façon vrai rapport : anneaux concentriques (grille) +
  // polygone de données (contour) + étiquettes horizontales aux axes.
  const labels = Object.keys(valeurs);
  const n = labels.length;
  const angles = labels.map((_, i) => Math.PI / 2 - (i * 2 * Math.PI) / n);
  const point = (a, r) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];

  for (const k of [0.25, 0.5, 0.75, 1.0]) {
    page.polygone(angles.map((a) => point(a, rayon * k)), { contour: [0.75, 0.75, 0.75], epaisseur: 1 });
  }
  page.polygone(angles.map((a, i) => point(a, (rayon * valeurs[labels[i]]) / 100)), {
    contour: [0.2, 0.4, 0.8],
    epaisseur: 2,
  });
  for (let i = 0; i < n; i++) {
    const [x, y] = point(angles[i], rayon + 28);
    page.texte(x, y, labels[i], { taille: 9, centre: x });
  }
}

function dessinerHistogramme(page, aptitudes) {
  // Histogramme vectoriel : 9 barres + étiquettes pivotées (verticales)
  // dessous, comme dans le vrai rapport.
  const x0 = 45;
  const yBase = 220;
  const largeur = 30;
  const ecart = 27;
  const hMax = 220;
  aptitudes.forEach(([label, valeur], i) => {
    const x = x0 + i * (largeur + ecart);
    page.rect(x, yBase, largeur, (hMax * valeur) / 7, [0.2, 0.4, 0.8]);
    page.textePivote(x + largeur / 2, yBase - 8, label, 6.5);
  });
}

function dessinerZone(page, y, zone) {
  // Dessine une zone du champ des possibles, retourne la verticale courante.
  const suffixe = zone === 1 ? 'ère' : 'ème';
  page.texte(71, y, `${zone}${suffixe} ZONE DE MÉTIERS`, { taille: 22, gras: true });
  y -= 29;
  page.texte(78, y, `Métiers accessibles en ${ZONES[zone]}`, { taille: 11 });
  y -= 21;
  const metiersZone = METIERS.filter((m) => m[0] === zone);
  if (!metiersZone.length) {
    page.texte(79, y, "Aucune proposition pour l'instant dans cette zone.", { taille: 11 });
    y -= 20;
  }
  for (const [, nom, description] of metiersZone) {
    page.texte(106, y, nom, { taille: 14, gras: true });
    y -= 21;
    for (const morceau of decouper(description, 85)) {
      page.texte(79, y, morceau, { taille: 11 });
      y -= 13;
    }
    y -= 12;
  }
  return y;
}

function pagesDuRapportFictif() {
  const pages = [];

  // Page 1 : couverture
  let p = new PagePdf();
  p.texte(0, A4_H - 120, 'Ton rapport des possibles', { taille: 20, gras: true, centre: A4_W / 2 });
  p.texte(0, A4_H - 160, 'Rdv FICTIF', { taille: 12, centre: A4_W / 2 });
  p.texte(0, A4_H - 180, 'Jeune : Camille FICTIF', { taille: 12, centre: A4_W / 2 });
  p.texte(0, A4_H - 200, 'Rapport du 18/11/2026', { taille: 12, centre: A4_W / 2 });
  pages.push(p);

  // Page 2 : mesure d'intérêts professionnels (radar RIASEC)
  p = new PagePdf();
  p.texte(71, A4_H - 60, "MESURE D'INTÉRÊTS PROFESSIONNELS", { taille: 16, gras: true });
  dessinerRadar(p, 300, 400, 130, VALEURS_RIASEC);
  pages.push(p);

  // Page 3 : mesure d'aptitudes cognitives (histogramme 0-7)
  p = new PagePdf();
  p.texte(71, A4_H - 60, "MESURE D'APTITUDES COGNITIVES", { taille: 16, gras: true });
  dessinerHistogramme(p, APTITUDES);
  pages.push(p);

  // Page 4 : mesure de personnalité (radar HEXACO)
  p = new PagePdf();
  p.texte(71, A4_H - 60, 'MESURE DE PERSONNALITÉ', { taille: 16, gras: true });
  dessinerRadar(p, 300, 400, 130, VALEURS_HEXACO);
  pages.push(p);

  // Page 5 : champ des possibles (titre + zones 1 à 3)
  p = new PagePdf();
  p.texte(71, A4_H - 81, 'Ton champ des possibles par zone de métiers', { taille: 22, gras: true });
  let y = A4_H - 130;
  for (const zone of [1, 2, 3]) {
    y = dessinerZone(p, y, zone);
    if (y < 120 && zone < 3) {
      pages.push(p);
      p = new PagePdf();
      p.texte(71, A4_H - 81, 'Champ des possibles (suite)', { taille: 22, gras: true });
      y = A4_H - 130;
    }
  }
  pages.push(p);

  // Page suivante : zones 4 et 5
  p = new PagePdf();
  p.texte(71, A4_H - 81, 'Champ des possibles (suite)', { taille: 22, gras: true });
  y = A4_H - 130;
  for (const zone of [4, 5]) {
    y = dessinerZone(p, y, zone);
  }
  pages.push(p);

  // Dernière page : avertissement (travaux expérimentaux)
  p = new PagePdf();
  y = A4_H - 100;
  for (const morceau of decouper(AVERTISSEMENT, 95)) {
    p.texte(71, y, morceau, { taille: 11 });
    y -= 14;
  }
  pages.push(p);

  return pages;
}

// ─── Assemblage du fichier PDF ────────────────────────────────────────────────

export function genererPdfFictif() {
  const pages = pagesDuRapportFictif();
  const objets = []; // [numéro, contenu]
  const ajouter = (contenu) => {
    objets.push(contenu);
    return objets.length; // numéro d'objet (1-based)
  };

  const numCatalog = 1;
  const numPages = 2;
  ajouter(null); // placeholder catalog
  ajouter(null); // placeholder pages

  const fontRegulier = ajouter('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const fontGras = ajouter('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

  const pageNums = [];
  const contentNums = [];
  for (const p of pages) {
    const contenu = p.ops.join('\n');
    const stream = Buffer.from(contenu, 'latin1');
    const numContent = ajouter(`<< /Length ${stream.length} >>\nstream\n${contenu}\nendstream`);
    contentNums.push(numContent);
    const numPage = ajouter(null); // placeholder
    pageNums.push(numPage);
  }

  objets[numCatalog - 1] = `<< /Type /Catalog /Pages ${numPages} 0 R >>`;
  objets[numPages - 1] = `<< /Type /Pages /Kids [${pageNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageNums.length} >>`;
  pageNums.forEach((numPage, i) => {
    objets[numPage - 1] =
      `<< /Type /Page /Parent ${numPages} 0 R /MediaBox [0 0 ${A4_W} ${A4_H}] ` +
      `/Resources << /Font << /F1 ${fontRegulier} 0 R /F2 ${fontGras} 0 R >> >> /Contents ${contentNums[i]} 0 R >>`;
  });

  // Sérialise avec la table xref
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objets.forEach((contenu, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${contenu}\nendobj\n`;
  });
  const xrefStart = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objets.length + 1} /Root ${numCatalog} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}
