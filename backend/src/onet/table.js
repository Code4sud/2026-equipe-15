// Table des métiers O*NET en français (tableur fourni par le Centre, rangé
// dans prive/ : le droit de la publier n'est pas confirmé, rien n'en est copié
// dans le dépôt). Sert à :
// - retrouver chaque métier d'un rapport par son intitulé exact (job_fr) ;
// - proposer des métiers à l'onboarding (recherche par intitulé).
//
// Colonnes lues : O*NET-SOC Code, job_en, job_fr, description_fr. Les colonnes
// « Zone réelle » (notes internes du Centre), jobZone et justification_jobZone
// ne sont jamais lues : la zone à citer est celle du rapport.

import fs from 'node:fs';
import { config } from '../config.js';
import { normaliser } from '../text.js';
import { lireClasseur } from './xlsx.js';

const COLONNES = { code: 'O*NET-SOC Code', job_en: 'job_en', job_fr: 'job_fr', description_fr: 'description_fr' };

// Clé de comparaison d'un intitulé : sans accents ni ponctuation, et lettres
// doublées écrasées (l'extraction du PDF perd parfois un « l » sur deux).
export function cleIntitule(texte) {
  return normaliser(texte)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/(.)\1+/g, '$1')
    .trim();
}

let memo = null; // { chemin, mtimeMs, table }

// Lit la table (mise en mémoire, relue si le fichier change). null si absente.
export function tableOnet() {
  const chemin = config.onetFichier;
  if (!fs.existsSync(chemin)) return null;
  const mtimeMs = fs.statSync(chemin).mtimeMs;
  if (memo && memo.chemin === chemin && memo.mtimeMs === mtimeMs) return memo.table;

  const feuilles = lireClasseur(chemin);
  const feuille = feuilles.find((f) => f.lignes[0]?.includes(COLONNES.job_fr));
  if (!feuille) throw new Error(`table O*NET : aucune feuille avec une colonne « ${COLONNES.job_fr} »`);
  const [entete, ...lignes] = feuille.lignes;
  const indice = Object.fromEntries(Object.entries(COLONNES).map(([cle, nom]) => [cle, entete.indexOf(nom)]));
  for (const [cle, i] of Object.entries(indice)) {
    if (i < 0) throw new Error(`table O*NET : colonne « ${COLONNES[cle]} » absente`);
  }
  const metiers = lignes
    .map((l) => ({
      code: String(l[indice.code] ?? '').trim(),
      job_en: String(l[indice.job_en] ?? '').trim(),
      job_fr: String(l[indice.job_fr] ?? '').trim(),
      description_fr: String(l[indice.description_fr] ?? '').trim(),
    }))
    .filter((m) => m.job_fr);
  for (const m of metiers) m.cle = cleIntitule(m.job_fr);
  // Quelques intitulés français reviennent sous plusieurs codes O*NET.
  const parCle = new Map();
  for (const m of metiers) parCle.set(m.cle, [...(parCle.get(m.cle) || []), m]);

  memo = { chemin, mtimeMs, table: { metiers, parCle } };
  return memo.table;
}

// Les métiers de la table qui portent cet intitulé (souvent un seul, parfois
// plusieurs codes pour un même intitulé ; [] si aucun).
export function trouverMetiers(table, nom) {
  return table.parCle.get(cleIntitule(nom)) ?? [];
}

// Contrôle des métiers d'une analyse contre la table : chaque métier reçoit
// `onet` ({ code, job_en }, ou { code: null, codes } si l'intitulé est
// ambigu, ou null s'il est introuvable). Le nom du métier n'est jamais
// corrigé. Renvoie le bilan du contrôle.
export function controlerMetiers(metiers, table) {
  if (!table) return { metiers, controle: { table: false, retrouves: 0, introuvables: [] } };
  const introuvables = [];
  let retrouves = 0;
  const enrichis = metiers.map((m) => {
    const trouves = trouverMetiers(table, m.nom);
    if (!trouves.length) {
      introuvables.push(m.nom);
      return { ...m, onet: null };
    }
    retrouves++;
    const onet = trouves.length === 1 ? { code: trouves[0].code, job_en: trouves[0].job_en } : { code: null, codes: trouves.map((t) => t.code) };
    return { ...m, onet };
  });
  return { metiers: enrichis, controle: { table: true, retrouves, introuvables } };
}

// Recherche pour l'onboarding : d'abord les intitulés qui commencent par le
// texte, puis ceux dont un mot commence par le texte. Rien avant 2 lettres.
export function chercherMetiers(table, texte, limite = 10) {
  const q = cleIntitule(texte);
  if (q.replace(/ /g, '').length < 2) return [];
  const debut = [];
  const mot = [];
  for (const [cle, [m]] of table.parCle) {
    // un intitulé présent sous plusieurs codes n'est proposé qu'une fois
    if (cle.startsWith(q)) debut.push(m);
    else if (` ${cle}`.includes(` ${q}`)) mot.push(m);
  }
  const tri = (a, b) => a.job_fr.localeCompare(b.job_fr, 'fr');
  return [...debut.sort(tri), ...mot.sort(tri)].slice(0, limite);
}
