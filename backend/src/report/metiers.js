// Extraction du champ des possibles : métiers et zones de métiers.

import { normaliser } from '../text.js';

// « 1ère ZONE DE MÉTIERS », « 2ème ZONE DE MÉTIERS »… (texte normalisé)
const ZONE_RE = /(\d+)\s*[a-z]*\s*zone de m/;

// Dans le champ des possibles : une ligne « Nème ZONE DE MÉTIERS » ouvre
// une zone (la ligne suivante donne son libellé « Métiers accessibles en
// … »), une ligne en gras de taille titre (≥ 13 pt) est un nom de métier,
// les lignes suivantes forment sa description.
export function extraireMetiers(pages, numerosPages, notes) {
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
