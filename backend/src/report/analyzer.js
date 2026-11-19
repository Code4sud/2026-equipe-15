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
import { extraireMetiers } from './metiers.js';

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
