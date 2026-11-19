// Routes /report : dépôt d'un Rapport des Possibles (PDF) et analyse. // JF
//
// POST /report/upload      : dépose un PDF (multipart), sauvegarde l'analyse
//                            JSON dans `storage/outputs/` et la retourne
// GET  /report             : liste les identifiants d'analyses générées
// GET  /report/{id}        : relit une analyse complète
// GET  /report/{id}/scores : uniquement les scores des graphiques, avec leurs
//                            sources (page, section, type de lecture)

import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { ErreurUpload, MAX_UPLOAD_OCTETS, sauvegarderUpload } from '../upload.js';
import { analyserRapport } from '../report/analyzer.js';
import { dossiersStockage } from '../storage.js';

export const router = Router();

// Identifiants d'analyse = 32 caractères hexadécimaux (uuid4 sans tirets),
// pour éviter toute lecture de fichier hors de storage/outputs.
const ID_VALIDE = /^[0-9a-f]{32}$/;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_OCTETS, files: 1 },
});

function cheminAnalyse(analysisId) {
  if (!ID_VALIDE.test(analysisId)) return null;
  const chemin = path.join(dossiersStockage().outputs, `${analysisId}.json`);
  return fs.existsSync(chemin) ? chemin : null;
}

router.post('/upload', upload.single('fichier'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ detail: 'Champ « fichier » (PDF) manquant' });
    const cheminPdf = sauvegarderUpload(req.file.buffer, req.file.originalname);
    const analyse = await analyserRapport(cheminPdf, req.file.originalname);
    const { outputs } = dossiersStockage();
    fs.mkdirSync(outputs, { recursive: true });
    fs.writeFileSync(path.join(outputs, `${analyse.id}.json`), JSON.stringify(analyse, null, 2));
    res.status(201).json(analyse);
  } catch (e) {
    if (e instanceof ErreurUpload) return res.status(400).json({ detail: e.message });
    console.error(e);
    res.status(500).json({ detail: "Erreur interne pendant l'analyse du PDF" });
  }
});

router.get('', (req, res) => {
  // Identifiants des analyses déjà générées (fichiers JSON de storage/outputs).
  const { outputs } = dossiersStockage();
  if (!fs.existsSync(outputs)) return res.json([]);
  res.json(fs.readdirSync(outputs).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort());
});

router.get('/:analysisId', (req, res) => {
  const chemin = cheminAnalyse(req.params.analysisId);
  if (!chemin) return res.status(404).json({ detail: 'Analyse inconnue' });
  res.json(JSON.parse(fs.readFileSync(chemin, 'utf8')));
});

router.get('/:analysisId/scores', (req, res) => {
  // Les scores des trois graphiques du rapport, avec leurs sources.
  const chemin = cheminAnalyse(req.params.analysisId);
  if (!chemin) return res.status(404).json({ detail: 'Analyse inconnue' });
  const analyse = JSON.parse(fs.readFileSync(chemin, 'utf8'));
  res.json({
    interets_riasec: analyse.interets_riasec,
    aptitudes: analyse.aptitudes,
    personnalite_hexaco: analyse.personnalite_hexaco,
  });
});
