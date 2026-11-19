// Orchestration de l'analyse d'un Rapport des Possibles : transforme les
// pages brutes de `pdfReader` en objet d'analyse (même forme JSON que
// l'ancien models/schemas.py) :
// - les sections du rapport ;
// - les scores des trois graphiques, lus sur les tracés vectoriels ;
// - les métiers du champ des possibles, avec leur zone ;
// - l'avertissement final.
//
// Règle du sujet : rien n'est inventé — chaque donnée porte sa source.

import crypto from 'node:crypto';
import { extrairePages } from '../pdfReader.js';
import {
  SECTIONS,
  CHAMPS_SCORES,
  detecterSections,
  pagesAvecTitreEnPremiereLigne,
  extraireRdv,
  extraireAvertissement,
} from './sections.js';
import { lireScores } from './scores.js';
import { extraireMetiers, pagesDuChamp } from './metiers.js';

// À augmenter à chaque changement de la forme de l'analyse : les analyses en
// cache d'une version précédente sont recalculées.
export const VERSION_EXTRACTION = 3;

export async function analyserRapport(chemin, nomFichier, idAnalyse = null) {
  const pages = await extrairePages(chemin);
  const sections = detecterSections(pages);
  const notes = [];

  const analyse = {
    id: idAnalyse || crypto.randomUUID().replace(/-/g, ''),
    version_extraction: VERSION_EXTRACTION,
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

  analyse.metiers = extraireMetiers(pages, pagesDuChamp(pages, sections), notes);
  analyse.avertissement = extraireAvertissement(pages, sections.avertissement || []);
  analyse.avertissement_page = analyse.avertissement ? sections.avertissement[sections.avertissement.length - 1] : null;
  analyse.notes = notes;
  return analyse;
}
