// Routes /report : analyse d'un Rapport des Possibles déjà rangé dans notre
// base (prive/), désigné par le jeton du lien reçu par mail. // JF
//
// GET /report/{jeton}        : analyse complète (JSON avec sources)
// GET /report/{jeton}/scores : uniquement les scores des graphiques, avec leurs
//                              sources (page, section, type de lecture)
//
// Pas d'authentification : le jeton (aléatoire, 128 bits) est la seule clé.
// Aucune route ne liste les jetons ni les rapports, et un jeton mal formé ou
// inconnu reçoit la même réponse 404.

import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { analyserRapport } from '../report/analyzer.js';
import { dossiersStockage } from '../storage.js';
import { rapportDuJeton } from '../liens.js';

export const router = Router();

// L'analyse est calculée à la première consultation, puis relue depuis
// storage/outputs/{jeton}.json (jamais versionné), sauf si le PDF a changé.
async function analyseDuJeton(jeton) {
  const pdf = rapportDuJeton(jeton);
  if (!pdf) return null;
  const { outputs } = dossiersStockage();
  const cache = path.join(outputs, `${jeton}.json`);
  if (fs.existsSync(cache) && fs.statSync(cache).mtimeMs >= fs.statSync(pdf).mtimeMs) {
    return JSON.parse(fs.readFileSync(cache, 'utf8'));
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

router.get('/:jeton', (req, res) => repondre(req, res, (analyse) => analyse));

router.get('/:jeton/scores', (req, res) =>
  repondre(req, res, (analyse) => ({
    interets_riasec: analyse.interets_riasec,
    aptitudes: analyse.aptitudes,
    personnalite_hexaco: analyse.personnalite_hexaco,
  }))
);
