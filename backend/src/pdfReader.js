// Extraction de bas niveau des PDF du Rapport des Possibles. // JF — portage Node
//
// Responsabilité unique de ce module : lire le PDF et rendre son contenu
// brut, sans aucune interprétation sémantique (c'est le rôle de
// `report/analyzer.js`) :
// - le texte de chaque page ;
// - les lignes avec leur position et leur style (gras) ;
// - les mots avec leur position (étiquettes des graphiques) ;
// - les tracés vectoriels fermés (polygones des radars) ;
// - les rectangles pleins (barres des histogrammes).
//
// Équivalent Node de pdfplumber : pdfjs-dist (texte via getTextContent,
// tracés via getOperatorList). Coordonnées converties en origine
// haut-gauche (x0/x1/top/bottom), comme pdfplumber.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.min.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const STANDARD_FONTS = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'standard_fonts') + path.sep;

// Taille maximale d'un PDF accepté. 20 Mo par défaut, configurable par
// variable d'environnement, et de toute façon sous les 50 Mo interdits
// dans le dépôt.
// ─── Lecture du PDF ───────────────────────────────────────────────────────────

export async function extrairePages(chemin) {
  const data = new Uint8Array(fs.readFileSync(chemin));
  const doc = await pdfjs.getDocument({
    data,
    isEvalSupported: false,
    disableFontFace: true,
    standardFontDataUrl: STANDARD_FONTS,
  }).promise;
  try {
    const pages = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const [vx0, , vx1, vy1] = page.view;
      const largeur = vx1 - vx0;
      const hauteur = vy1 - page.view[1];
      // Conversion coordonnées PDF (origine bas-gauche) -> origine haut-gauche
      const X = (x) => x - vx0;
      const Y = (y) => vy1 - y;

      const opList = await page.getOperatorList();
      const fontes = mapFontes(page, doc, opList);
      const contenu = await page.getTextContent();
      const { lignes, texte } = extraireLignes(contenu, fontes, { hauteur, X, Y });
      const mots = contenu.items.map((it) => {
        const x0 = X(it.transform[4]);
        const haut = Y(it.transform[5]) - it.height;
        return { texte: it.str, x0, x1: x0 + it.width, yCentre: haut + it.height / 2 };
      });
      // Les tracés vectoriels sont lus dans la liste d'opérateurs avec la CTM
      // complète (init : flip top-left de pdfjs) : coordonnées finales en
      // (x, top), origine haut-gauche comme pdfplumber.
      const { courbes, barres } = extraireTraces(opList, { vx0, vy0: page.view[1], vy1 });

      pages.push({ numero: n, texte, largeur, hauteur, lignes, mots, courbes, barres });
    }
    return pages;
  } finally {
    await doc.destroy();
  }
}

// loadedName ("g_d0_f2") -> vrai nom de fonte ("Helvetica-Bold"), pour
// détecter le gras comme le faisait pdfplumber ("Bold" dans fontname).
function mapFontes(page, doc, opList) {
  const OPS = pdfjs.OPS;
  const fontes = {};
  for (let i = 0; i < opList.fnArray.length; i++) {
    if (opList.fnArray[i] === OPS.setFont) {
      const name = opList.argsArray[i][0];
      if (fontes[name]) continue;
      let obj = page.commonObjs.get(name);
      if (obj && obj.num !== undefined) obj = doc.xref.fetchIfRef(obj);
      fontes[name] = (obj && (obj.name || obj.BaseFont)) || '';
    }
  }
  return fontes;
}

// Regroupe les items texte en lignes : même verticale (à 2 pt près) ET
// écart horizontal faible (moins d'environ 0,6 fois la taille de police,
// soit un espace), sinon c'est une colonne ou un graphique voisin.
function extraireLignes(contenu, fontes, { hauteur, X, Y }) {
  const items = contenu.items.map((it) => {
    const t = it.transform;
    const x0 = X(t[4]);
    const baseline = Y(t[5]); // position verticale de référence (indépendante de la taille)
    const top = baseline - it.height;
    const taille = Math.hypot(t[2], t[3]) || it.height || 0;
    const nomFonte = fontes[it.fontName] || '';
    // Comme pdfplumber côté Python : gras si « Bold » est dans le nom de fonte.
    return { texte: it.str, haut: top, baseline, x0, x1: x0 + it.width, gras: /bold/i.test(nomFonte), taille };
  });
  // Regroupement sur la baseline (et non le haut) : des fontes de tailles
  // différentes sur une même ligne ont des tops différents mais la même baseline.
  items.sort((a, b) => Math.round(a.baseline / 2) - Math.round(b.baseline / 2) || a.x0 - b.x0);

  const lignes = [];
  for (const c of items) {
    const taille = c.taille || 0;
    const derniere = lignes[lignes.length - 1];
    if (derniere && Math.abs(derniere.baseline - c.baseline) <= 2 && c.x0 - derniere.x1 <= Math.max(6.0, 1.5 * taille)) {
      if (c.x0 - derniere.x1 > 0.25 * taille) derniere.texte += ' ';
      derniere.texte += c.texte;
      derniere.x0 = Math.min(derniere.x0, c.x0);
      derniere.x1 = Math.max(derniere.x1, c.x1);
      derniere.haut = Math.min(derniere.haut, c.haut);
      derniere.baseline = (derniere.baseline + c.baseline) / 2;
      derniere.gras = derniere.gras || c.gras;
      derniere.taille = Math.max(derniere.taille, taille);
    } else {
      lignes.push({ texte: c.texte, haut: c.haut, baseline: c.baseline, x0: c.x0, x1: c.x1, gras: c.gras, taille });
    }
  }
  for (const l of lignes) l.texte = l.texte.trim();
  const lignesFiltrees = lignes.filter((l) => l.texte);
  for (const l of lignesFiltrees) l.xCentre = (l.x0 + l.x1) / 2;
  return { lignes: lignesFiltrees, texte: lignesFiltrees.map((l) => l.texte).join('\n') };
}

function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

// Détecte un rectangle axis-aligned parmi 4 points : chaque point doit être
// un coin (x parmi {minX, maxX}, y parmi {minY, maxY}). Retourne
// { x0, x1, haut, bas } ou null.
function detecterRect(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const eps = 1e-6;
  const estCoin = points.every(
    (p) =>
      (Math.abs(p[0] - minX) < eps || Math.abs(p[0] - maxX) < eps) &&
      (Math.abs(p[1] - minY) < eps || Math.abs(p[1] - maxY) < eps)
  );
  if (!estCoin || maxX - minX < eps || maxY - minY < eps) return null;
  return { x0: minX, x1: maxX, haut: minY, bas: maxY };
}

// Échantillonne une courbe de Bézier cubique (8 segments), comme pdfplumber
// qui aplatit les courbes en points.
function bezier(p0, p1, p2, p3, n = 8) {
  const pts = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    pts.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return pts;
}

// Parcourt la liste d'opérateurs PDF et reconstitue les tracés :
// - path avec courbes ou ≥ 3 points -> Courbe (polygone de radar) ;
// - OPS.rectangle peint -> Barre (rectangle plein de l'histogramme).
// Gère aussi OPS.constructPath (sous-liste d'opérations de path), émis par
// certains producteurs de PDF (pdf-lib) à la place de moveTo/lineTo nus.
function extraireTraces(opList, { vx0, vy0, vy1 }) {
  const OPS = pdfjs.OPS;
  const courbes = [];
  const barres = [];

  let sousPaths = []; // [{ pts: [[x, top]...], cur, start, rect }]
  let courant = null;

  // Matrice de transformation courante (opérateur `cm`), initialisée au flip
  // top-left de pdfjs [1,0,0,-1,0,H] : les coordonnées finales sont directement
  // en (x, top), origine haut-gauche de la page.
  let ctm = [1, 0, 0, -1, 0, vy1]; // [a, b, c, d, e, f]
  const ctmStack = [];
  const mul = (m1, m2) => [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
  const appliqueCtm = (x, y) => [ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]];
  const conv = (x, y) => {
    const [tx, ty] = appliqueCtm(x, y);
    return [tx - vx0, ty - vy0];
  };

  const nouveauSousPath = () => {
    courant = { pts: [], cur: [0, 0], start: null, rect: null };
    sousPaths.push(courant);
  };
  const assurerCourant = () => {
    if (!courant) nouveauSousPath();
  };

  // Un seul opérateur de construction de path (moveTo, lineTo, courbe, rect…)
  const opPath = (f, a) => {
    switch (f) {
      case OPS.moveTo:
        if (!courant || courant.pts.length) nouveauSousPath(); // un moveTo ouvre un nouveau sous-path
        courant.cur = [a[0], a[1]];
        courant.start = courant.cur;
        courant.pts = [conv(a[0], a[1])];
        courant.rect = null;
        break;
      case OPS.lineTo:
        assurerCourant();
        if (!courant.start) courant.start = [a[0], a[1]]; // lineTo sans moveTo : ce point ouvre le sous-path
        courant.cur = [a[0], a[1]];
        courant.pts.push(conv(a[0], a[1]));
        break;
      case OPS.curveTo: {
        assurerCourant();
        const b = bezier(courant.cur, [a[0], a[1]], [a[2], a[3]], [a[4], a[5]]);
        courant.pts.push(...b.map((p) => conv(p[0], p[1])));
        courant.cur = [a[4], a[5]];
        break;
      }
      case OPS.curveTo2: {
        assurerCourant();
        const b = bezier(courant.cur, courant.cur, [a[0], a[1]], [a[2], a[3]]);
        courant.pts.push(...b.map((p) => conv(p[0], p[1])));
        courant.cur = [a[2], a[3]];
        break;
      }
      case OPS.curveTo3: {
        assurerCourant();
        const b = bezier(courant.cur, [a[0], a[1]], [a[2], a[3]], [a[2], a[3]]);
        courant.pts.push(...b.map((p) => conv(p[0], p[1])));
        courant.cur = [a[2], a[3]];
        break;
      }
      case OPS.rectangle: {
        assurerCourant();
        const [rx0, ry0] = conv(a[0], a[1]); const [rx1, ry1] = conv(a[0] + a[2], a[1] + a[3]); courant.rect = { x0: Math.min(rx0, rx1), x1: Math.max(rx0, rx1), haut: Math.min(ry0, ry1), bas: Math.max(ry0, ry1) };
        courant.pts = [
          [courant.rect.x0, courant.rect.haut],
          [courant.rect.x1, courant.rect.haut],
          [courant.rect.x1, courant.rect.bas],
          [courant.rect.x0, courant.rect.bas],
          [courant.rect.x0, courant.rect.haut],
        ];
        break;
      }
      case OPS.closePath:
        if (courant && courant.start) courant.pts.push(conv(courant.start[0], courant.start[1]));
        break;
      default:
        break;
    }
  };

  const enregistrer = (rempli) => {
    for (const sp of sousPaths) {
      let points = sp.pts.filter((p) => p && p[0] != null && p[1] != null);
      if (points.length >= 4 && dist(points[0], points[points.length - 1]) < 1e-6) points = points.slice(0, -1); // point de fermeture
      // Un rectangle peut arriver comme OPS.rectangle ou comme path fermé
      // à 4 côtés parallèles aux axes (certains producteurs de PDF).
      let rect = sp.rect;
      if (!rect && points.length === 4) rect = detecterRect(points);
      if (rect) {
        if (rempli) barres.push({ ...rect });
      } else if (points.length >= 3) {
        courbes.push({ points, remplie: rempli });
      }
    }
    sousPaths = [];
    courant = null;
  };

  const fn = opList.fnArray;
  const args = opList.argsArray;
  for (let i = 0; i < fn.length; i++) {
    const f = fn[i];
    const a = args[i];
    if (f === OPS.constructPath) {
      // a = [codes[], args aplatis] : sous-liste d'opérations de path
      const sousOps = a[0];
      const sousArgs = a[1];
      const NB_ARGS = {
        [OPS.moveTo]: 2,
        [OPS.lineTo]: 2,
        [OPS.curveTo]: 6,
        [OPS.curveTo2]: 4,
        [OPS.curveTo3]: 4,
        [OPS.rectangle]: 4,
        [OPS.closePath]: 0,
      };
      let k = 0;
      for (let j = 0; j < sousOps.length; j++) {
        const op = sousOps[j];
        const n = NB_ARGS[op] || 0;
        opPath(op, sousArgs.slice(k, k + n));
        k += n;
      }
      continue;
    }
    switch (f) {
      case OPS.moveTo:
      case OPS.lineTo:
      case OPS.curveTo:
      case OPS.curveTo2:
      case OPS.curveTo3:
      case OPS.rectangle:
      case OPS.closePath:
        opPath(f, a);
        break;
      case OPS.fill:
      case OPS.eoFill:
      case OPS.fillStroke:
      case OPS.eoFillStroke:
      case OPS.closeFillStroke:
      case OPS.closeEOFillStroke:
        enregistrer(true);
        break;
      case OPS.stroke:
      case OPS.closeStroke:
        enregistrer(false);
        break;
      case OPS.clip:
      case OPS.endPath:
        // Le path est consommé (clip ou fin sans peinture) : on le vide.
        sousPaths = [];
        courant = null;
        break;
      case OPS.transform:
        ctm = mul([a[0], a[1], a[2], a[3], a[4], a[5]], ctm);
        break;
      case OPS.save:
        ctmStack.push(ctm);
        break;
      case OPS.restore:
        if (ctmStack.length) ctm = ctmStack.pop();
        break;
      default:
        break; // opérateurs de couleur, image, etc. : le path courant est conservé
    }
  }
  for (const c of courbes) {
    c.centre = [c.points.reduce((s, p) => s + p[0], 0) / c.points.length, c.points.reduce((s, p) => s + p[1], 0) / c.points.length];
    c.plusLoinDuCentre = Math.max(...c.points.map((p) => dist(p, c.centre)));
  }
  for (const b of barres) {
    b.largeur = b.x1 - b.x0;
    b.hauteur = b.bas - b.haut;
    b.xCentre = (b.x0 + b.x1) / 2;
  }
  return { courbes, barres };
}

