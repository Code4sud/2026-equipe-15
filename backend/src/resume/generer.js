// Génération du résumé écrit (bloc `resume` du contrat) :
//   points : 4 phrases courtes, chacune avec la page du rapport d'où elle vient ;
//   texte  : un texte d'environ 150 mots, qui servira aussi à l'audio.
//
// 1. construireFaits() : ce que le résumé a le droit de dire, avec les pages.
// 2. Le modèle (Ollama) reformule ces faits pour un jeune de 16 ans, en citant
//    pour chaque phrase le fait utilisé.
// 3. controle.js refuse toute phrase qui ne cite pas un fait, ajoute un nombre
//    ou emploie un mot interdit. Un second essai est fait si trop de phrases
//    sont refusées.
// 4. Ce qui manque est complété par les phrases toutes faites des faits (repli
//    sans IA) : la démo ne tombe jamais, même sans Ollama.

import { discuterJson, configOllama, ErreurIA } from '../ai/ollama.js';
import { construireFaits } from './faits.js';
import { raisonDeRefus, faitsCites } from './controle.js';

export const NB_POINTS = 4;
const NB_ESSAIS = 2;

const SYSTEME = `Tu aides un ou une jeune de 16 ans à relire son Rapport des Possibles, un bilan d'orientation.
Il ou elle lit peu : tu le tutoies, tu écris des phrases courtes (15 mots au plus), avec des mots simples, sans jargon.

Règles absolues :
- Tu n'utilises QUE les faits fournis. Tu n'ajoutes aucune information, aucun exemple, aucun métier qui n'y est pas.
- Chaque phrase cite l'identifiant du fait sur lequel elle s'appuie (par exemple "f2").
- Aucun chiffre de score, aucune note, aucun niveau. Tu ne compares jamais le jeune aux autres.
- Tu n'emploies jamais les mots « faible », « mauvais », « moyenne », « score », « niveau ».
- Rien sur la santé, le stress, la famille, l'origine ou la religion. Ni salaire, ni diplôme.
- Les métiers sont des pistes, pas des consignes. Une zone est un temps de préparation, pas une difficulté.
- Tu restes positif et honnête : ce sont des résultats à un moment donné, qui peuvent évoluer.
Tu réponds uniquement en JSON, en français.`;

const SCHEMA = {
  type: 'object',
  properties: {
    points: {
      type: 'array',
      items: {
        type: 'object',
        properties: { texte: { type: 'string' }, fait: { type: 'string' } },
        required: ['texte', 'fait'],
      },
    },
    texte: {
      type: 'array',
      items: {
        type: 'object',
        properties: { phrase: { type: 'string' }, faits: { type: 'array', items: { type: 'string' } } },
        required: ['phrase', 'faits'],
      },
    },
  },
  required: ['points', 'texte'],
};

function message(faits) {
  const lignes = faits.map((f) => `${f.id} (page ${f.page}) : ${f.texte}`).join('\n');
  return `Voici les faits tirés du rapport. Chaque fait a un identifiant.

${lignes}

Écris en JSON :
- "points" : ${NB_POINTS} phrases courtes, chacune sur un fait différent. Pour chaque phrase, "fait" est l'identifiant du fait utilisé.
- "texte" : 6 à 8 phrases qui racontent le rapport au jeune, environ 150 mots en tout, en reformulant avec tes mots. Pour chaque phrase, "faits" liste les identifiants des faits utilisés.`;
}

// Garde les phrases du modèle qui passent le contrôle ; compte les refus.
function trier(reponse, faitsParId) {
  const refus = [];
  const points = [];
  const utilises = new Set();
  for (const p of Array.isArray(reponse?.points) ? reponse.points : []) {
    const cites = faitsCites(p?.fait, faitsParId);
    const raison = raisonDeRefus(p?.texte, cites) || (cites.length && utilises.has(cites[0].id) ? 'fait déjà utilisé' : null);
    if (raison) {
      refus.push(raison);
      continue;
    }
    utilises.add(cites[0].id);
    points.push({ texte: p.texte.trim(), page: cites[0].page, fait: cites[0].id, origine: 'ia' });
  }
  const phrases = [];
  for (const p of Array.isArray(reponse?.texte) ? reponse.texte : []) {
    const cites = faitsCites(p?.faits, faitsParId);
    const raison = raisonDeRefus(p?.phrase, cites);
    if (raison) {
      refus.push(raison);
      continue;
    }
    phrases.push({ texte: p.phrase.trim(), faits: cites.map((f) => f.id), origine: 'ia' });
  }
  return { points: points.slice(0, NB_POINTS), phrases, refus };
}

export async function genererResume(analyse, onboarding = null, { llm = discuterJson } = {}) {
  const { faits, choix } = construireFaits(analyse, onboarding);
  const faitsParId = Object.fromEntries(faits.map((f) => [f.id, f]));
  const refus = [];
  let meilleur = { points: [], phrases: [] };
  let raison = null;

  if (!faits.length) raison = 'aucun fait lisible dans le rapport';
  for (let essai = 1; essai <= NB_ESSAIS && faits.length; essai++) {
    try {
      const r = trier(await llm({ systeme: SYSTEME, message: message(faits), schema: SCHEMA }), faitsParId);
      refus.push(...r.refus);
      if (r.points.length + r.phrases.length > meilleur.points.length + meilleur.phrases.length) meilleur = r;
      if (meilleur.points.length >= NB_POINTS && meilleur.phrases.length >= 4) break;
      raison = 'phrases du modèle refusées par le contrôle';
    } catch (e) {
      if (!(e instanceof ErreurIA)) throw e;
      raison = e.message;
      break;
    }
  }

  // Points : ceux du modèle, complétés par les phrases toutes faites des
  // faits qui ne sont pas encore utilisés.
  const points = [...meilleur.points];
  for (const f of faits) {
    if (points.length >= NB_POINTS) break;
    if (!points.some((p) => p.fait === f.id)) points.push({ texte: f.phrase, page: f.page, fait: f.id, origine: 'repli' });
  }
  // Texte : celui du modèle s'il a assez de phrases valides, sinon les
  // phrases toutes faites de tous les faits.
  const phrases =
    meilleur.phrases.length >= 4
      ? meilleur.phrases
      : faits.map((f) => ({ texte: f.phrase, faits: [f.id], origine: 'repli' }));

  const nbIa = points.filter((p) => p.origine === 'ia').length + phrases.filter((p) => p.origine === 'ia').length;
  const total = points.length + phrases.length;
  const mode = nbIa === 0 ? 'repli' : nbIa === total ? 'ia' : 'mixte';
  return {
    points,
    texte: phrases.map((p) => p.texte).join(' '),
    phrases,
    faits: faits.map(({ id, page, texte }) => ({ id, page, texte })),
    genere_par: {
      mode,
      modele: mode === 'repli' ? null : configOllama().modele,
      ...(mode === 'ia' ? {} : { raison: raison || 'phrases du modèle refusées par le contrôle' }),
    },
    controle: { phrases_refusees: refus.length, raisons: [...new Set(refus)] },
    choix_pris_en_compte: choix,
  };
}
