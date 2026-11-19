// Route de l'assistant (chatbot). // JULIEN
//
// POST /chat/{jeton} : une question sur le rapport, une réponse avec ses sources.
// Corps : { question, historique?, onboarding? }
//   question   : texte du jeune, 500 caractères au plus ;
//   historique : derniers messages affichés, [{ de: 'moi' | 'ia', texte }]
//                (mêmes noms que src/components/Assistant.jsx) ; 6 gardés ;
//   onboarding : bloc `onboarding` du contrat, comme pour le résumé.
// Renvoie { reponse, phrases, sources, dans_rapport, genere_par, controle }.
//
// Même 404 que /report pour un jeton mal formé ou inconnu ; 400 si la question
// est vide ou trop longue. Pas de cache (données personnelles).

import { Router } from 'express';
import { rapportDuJeton } from '../liens.js';
import { analyseDuJeton } from './report.js';
import { repondreQuestion } from '../chat/repondre.js';

export const QUESTION_MAX = 500;
export const HISTORIQUE_MAX = 6;
const MESSAGE_MAX = 1000;

export const router = Router();

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  next();
});

// Ne garde que les derniers échanges, avec des rôles connus et du texte.
export function nettoyerHistorique(h) {
  if (!Array.isArray(h)) return [];
  return h
    .filter((m) => m && ['moi', 'ia'].includes(m.de) && typeof m.texte === 'string' && m.texte.trim())
    .slice(-HISTORIQUE_MAX)
    .map((m) => ({ role: m.de === 'moi' ? 'user' : 'assistant', content: m.texte.trim().slice(0, MESSAGE_MAX) }));
}

router.post('/:jeton', async (req, res) => {
  try {
    // Le jeton d'abord : un jeton inconnu reçoit toujours le même 404.
    if (!rapportDuJeton(req.params.jeton)) return res.status(404).json({ detail: 'Rapport introuvable' });
    const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    if (!question) return res.status(400).json({ detail: 'Question vide' });
    if (question.length > QUESTION_MAX) return res.status(400).json({ detail: 'Question trop longue' });
    const analyse = await analyseDuJeton(req.params.jeton);
    if (!analyse) return res.status(404).json({ detail: 'Rapport introuvable' });
    const reponse = await repondreQuestion(analyse, {
      question,
      historique: nettoyerHistorique(req.body.historique),
      onboarding: req.body.onboarding ?? null,
    });
    res.json(reponse);
  } catch (e) {
    console.error(e);
    res.status(500).json({ detail: "Erreur interne pendant la réponse de l'assistant" });
  }
});
