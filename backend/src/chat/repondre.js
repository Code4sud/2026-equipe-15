// Réponse de l'assistant à une question du jeune :
// 1. Qwen (Ollama) reçoit les instructions, les faits du rapport, l'historique
//    court de la discussion et la question.
// 2. Chaque phrase passe par resume/controle.js (même contrôle que le résumé :
//    fait cité, pas de nombre inventé, pas de mot interdit, pas de vouvoiement).
// 3. « dans_rapport: false » : c'est le backend qui écrit la réponse fixe
//    « Ce n'est pas dans ton rapport » (le contrôle refuserait une phrase du
//    modèle qui parle de salaire ou de diplôme, même pour dire qu'il n'y en a pas).
// 4. Ollama absent, ou toutes les phrases refusées deux fois : message de repli.

import { discuterJson, configOllama, ErreurIA } from '../ai/ollama.js';
import { raisonDeRefus, faitsCites } from '../resume/controle.js';
import { construireContexte } from './contexte.js';
import { SYSTEME, SCHEMA, message } from './instructions.js';

export const HORS_RAPPORT =
  "Ce n'est pas dans ton rapport. Tu peux en parler au psychologue ou à un conseiller du Centre des Possibles. " +
  "Le site orientation-regionsud.fr peut aussi t'aider.";
export const INDISPONIBLE =
  'Je ne peux pas te répondre pour le moment. Tu peux relire ton résumé, ou poser ta question au psychologue.';
const NB_ESSAIS = 2;

export async function repondreQuestion(analyse, { question, historique = [], onboarding = null }, { llm = discuterJson } = {}) {
  const { contexte } = construireContexte(analyse, onboarding);
  const parId = Object.fromEntries(contexte.map((f) => [f.id, f]));
  const refus = [];
  let raison = null;

  for (let essai = 1; essai <= NB_ESSAIS; essai++) {
    let r;
    try {
      r = await llm({ systeme: SYSTEME, historique, message: message(contexte, question), schema: SCHEMA });
    } catch (e) {
      if (!(e instanceof ErreurIA)) throw e;
      raison = e.message;
      break;
    }
    if (r?.dans_rapport === false) return resultat({ texte: HORS_RAPPORT, dansRapport: false, mode: 'ia', refus });

    const phrases = [];
    for (const p of Array.isArray(r?.phrases) ? r.phrases : []) {
      const cites = faitsCites(p?.faits, parId);
      const pourquoi = raisonDeRefus(p?.texte, cites);
      if (pourquoi) refus.push(pourquoi);
      else phrases.push({ texte: p.texte.trim(), faits: cites.map((f) => f.id) });
    }
    if (phrases.length) return resultat({ phrases, parId, dansRapport: true, mode: 'ia', refus });
    raison = 'phrases du modèle refusées par le contrôle';
  }
  return resultat({ texte: INDISPONIBLE, dansRapport: null, mode: 'repli', raison, refus });
}

function resultat({ texte, phrases = [], parId = {}, dansRapport, mode, raison, refus }) {
  const ids = [...new Set(phrases.flatMap((p) => p.faits))];
  return {
    reponse: texte ?? phrases.map((p) => p.texte).join(' '),
    phrases,
    sources: ids.map((id) => ({ fait: id, page: parId[id].page, texte: parId[id].texte })),
    dans_rapport: dansRapport,
    genere_par: { mode, modele: mode === 'ia' ? configOllama().modele : null, ...(raison ? { raison } : {}) },
    controle: { phrases_refusees: refus.length, raisons: [...new Set(refus)] },
  };
}
