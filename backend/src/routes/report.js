// Routes /report : analyse d'un Rapport des Possibles déjà rangé dans notre
// base (prive/), désigné par le jeton du lien reçu par mail. // JF
//
// GET  /report/{jeton}        : analyse complète (JSON avec sources)
// GET  /report/{jeton}/scores : uniquement les scores des graphiques, avec leurs
//                               sources (page, section, type de lecture)
// GET  /report/{jeton}/pdf    : le PDF du rapport, pour la visionneuse du site
//                               (PDF.js : lecture par morceaux acceptée)
// POST /report/{jeton}/resume : résumé écrit (4 phrases avec leur page, et un
//                               texte), corps facultatif { onboarding }
//
// Pas d'authentification : le jeton (aléatoire, 128 bits) est la seule clé.
// Aucune route ne liste les jetons ni les rapports, et un jeton mal formé ou
// inconnu reçoit la même réponse 404.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import { analyserRapport, VERSION_EXTRACTION } from '../report/analyzer.js';
import { dossiersStockage } from '../storage.js';
import { rapportDuJeton } from '../liens.js';
import { genererResume } from '../resume/generer.js';
import { nettoyerOnboarding } from '../resume/faits.js';
import { configOllama } from '../ai/ollama.js';

export const router = Router();

// L'analyse est calculée à la première consultation, puis relue depuis
// storage/outputs/{jeton}.json (jamais versionné), sauf si le PDF a changé.
async function analyseDuJeton(jeton) {
  const pdf = rapportDuJeton(jeton);
  if (!pdf) return null;
  const { outputs } = dossiersStockage();
  const cache = path.join(outputs, `${jeton}.json`);
  if (fs.existsSync(cache) && fs.statSync(cache).mtimeMs >= fs.statSync(pdf).mtimeMs) {
    const enCache = JSON.parse(fs.readFileSync(cache, 'utf8'));
    if (enCache.version_extraction === VERSION_EXTRACTION) return enCache;
  }
  const analyse = await analyserRapport(pdf, path.basename(pdf), jeton);
  fs.mkdirSync(outputs, { recursive: true });
  fs.writeFileSync(cache, JSON.stringify(analyse, null, 2));
  return analyse;
}

// Données personnelles : ni cache navigateur ou proxy, ni jeton transmis
// dans l'en-tête Referer vers d'autres sites.
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  next();
});

async function repondre(req, res, extraire) {
  try {
    const analyse = await analyseDuJeton(req.params.jeton);
    if (!analyse) return res.status(404).json({ detail: 'Rapport introuvable' });
    res.json(extraire(analyse));
  } catch (e) {
    console.error(e);
    res.status(500).json({ detail: "Erreur interne pendant l'analyse du rapport" });
  }
}

// `rapport_pdf_url` (contrat) : adresse du PDF, relative à la racine de l'API.
router.get('/:jeton', (req, res) =>
  repondre(req, res, (analyse) => ({ ...analyse, rapport_pdf_url: `/report/${analyse.id}/pdf` }))
);

// Le PDF lui-même. Même contrôle du jeton et même 404 que les autres routes.
// Nom de fichier neutre : le nom rangé dans prive/ (numéro du rapport) ne sort
// pas. Les requêtes « Range » de PDF.js sont servies (206) ; leurs en-têtes
// sont exposés au front, servi depuis une autre origine.
router.get('/:jeton/pdf', (req, res) => {
  const pdf = rapportDuJeton(req.params.jeton);
  if (!pdf) return res.status(404).json({ detail: 'Rapport introuvable' });
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': 'inline; filename="rapport.pdf"',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Range, Content-Length',
  });
  res.sendFile(pdf, { cacheControl: false }, (err) => {
    if (!err) return;
    if (!res.headersSent) return res.status(404).json({ detail: 'Rapport introuvable' });
    if (err.code !== 'ECONNABORTED') console.error(err); // ECONNABORTED : PDF.js a annulé la lecture
  });
});

router.get('/:jeton/scores', (req, res) =>
  repondre(req, res, (analyse) => ({
    interets_riasec: analyse.interets_riasec,
    aptitudes: analyse.aptitudes,
    personnalite_hexaco: analyse.personnalite_hexaco,
  }))
);

// Le résumé dépend des choix de l'onboarding (gardés dans le navigateur du
// jeune) : le front les envoie dans le corps. Mis en cache par jeton, choix et
// modèle ; un résumé entièrement en repli (Ollama absent) n'est pas gardé,
// pour que l'IA soit réessayée à l'appel suivant.
router.post('/:jeton/resume', async (req, res) => {
  try {
    const analyse = await analyseDuJeton(req.params.jeton);
    if (!analyse) return res.status(404).json({ detail: 'Rapport introuvable' });
    const onboarding = req.body?.onboarding ?? null;
    const cle = crypto
      .createHash('sha256')
      .update(JSON.stringify({ choix: nettoyerOnboarding(onboarding, analyse), modele: configOllama().modele }))
      .digest('hex')
      .slice(0, 16);
    const cache = path.join(dossiersStockage().outputs, `${req.params.jeton}-resume-${cle}.json`);
    const pdf = rapportDuJeton(req.params.jeton);
    if (fs.existsSync(cache) && fs.statSync(cache).mtimeMs >= fs.statSync(pdf).mtimeMs) {
      return res.json(JSON.parse(fs.readFileSync(cache, 'utf8')));
    }
    const resume = await genererResume(analyse, onboarding);
    if (resume.genere_par.mode !== 'repli') fs.writeFileSync(cache, JSON.stringify(resume, null, 2));
    res.json(resume);
  } catch (e) {
    console.error(e);
    res.status(500).json({ detail: 'Erreur interne pendant la génération du résumé' });
  }
});
