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
import { normaliser } from '../text.js';
import { construireContexte } from './contexte.js';
import { SYSTEME, SCHEMA, message } from './instructions.js';

export const HORS_RAPPORT =
  "Ce n'est pas dans ton rapport. Tu peux en parler au psychologue ou à un conseiller du Centre des Possibles. " +
  "Le site orientation-regionsud.fr peut aussi t'aider.";
export const INDISPONIBLE =
  'Je ne peux pas te répondre pour le moment. Tu peux relire ton résumé, ou poser ta question au psychologue.';
const NB_ESSAIS = 2;

// Qwen recopie parfois l'identifiant du fait dans la phrase (« … (f1). ») ou
// numérote ses phrases (« 1. … ») : c'est retiré avant le contrôle, qui
// prendrait ces chiffres pour des nombres inventés et refuserait la réponse.
const ID_FAIT = '(?:f\\d+|z\\d+-m\\d+)';
const IDS_ENTRE_PARENTHESES = new RegExp(`\\s*[(\\[]\\s*${ID_FAIT}(?:\\s*(?:,|et)\\s*${ID_FAIT})*\\s*[)\\]]`, 'gi');
const DEBUT_DE_LISTE = /^\s*(?:\d+\s*[.)]|[-•*])\s+/;
const sansIdentifiants = (texte) =>
  typeof texte === 'string' ? texte.replace(IDS_ENTRE_PARENTHESES, '').replace(DEBUT_DE_LISTE, '').trim() : texte;

// Le rapport ne dit jamais qu'un trait « explique » un métier ou un choix :
// une phrase qui l'affirme est refusée (AGENTS.md, section 5 : ne rien inventer).
const CAUSE = /(^|[ '])(expliqu|c'est pour ca|c'est pourquoi|voila pourquoi|c'est grace)/;
const causeInventee = (texte) => CAUSE.test(normaliser(texte));

// Question sur les formations ou les études : le rapport n'en donne pas, mais
// il donne le temps de préparation de chaque piste. Le backend écrit la
// réponse lui-même, à partir des préférés du jeune (sinon une piste par zone).
const FORMATIONS = /(^|[ '])(formation|etude|ecole|diplome|apprentissage|alternance)/;
const SANS_FORMATIONS = 'Ton rapport ne donne pas de formations.';
const VOIR_AILLEURS = "Pour trouver une formation, parles-en au psychologue ou regarde sur orientation-regionsud.fr.";

function phrasesFormations(analyse, choix) {
  const parId = Object.fromEntries(analyse.metiers.map((m) => [m.id, m]));
  const choisis = (choix.favoris.length ? choix.favoris : choix.interesses).map((id) => parId[id]).filter(Boolean);
  const parZone = analyse.metiers.filter((m, i, tous) => tous.findIndex((x) => x.zone === m.zone) === i);
  const pistes = (choisis.length ? choisis : parZone)
    .map((m) => ({ m, duree: /accessibles? en (.+)$/.exec(m.zone_label || '')?.[1] }))
    .filter((p) => p.duree)
    .slice(0, 3);
  if (!pistes.length) return null;
  return [
    { texte: SANS_FORMATIONS, faits: [] },
    { texte: 'Il indique un temps de préparation pour chaque piste.', faits: [] },
    ...pistes.map(({ m, duree }) => ({ texte: `« ${m.nom} » : ${duree} de préparation.`, faits: [m.id] })),
    { texte: VOIR_AILLEURS, faits: [] },
  ];
}

export async function repondreQuestion(analyse, { question, historique = [], onboarding = null }, { llm = discuterJson } = {}) {
  const { contexte, choix } = construireContexte(analyse, onboarding);
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
    if (r?.dans_rapport === false) {
      const phrases = FORMATIONS.test(normaliser(question)) ? phrasesFormations(analyse, choix) : null;
      if (phrases) return resultat({ phrases, parId, dansRapport: false, mode: 'ia', refus });
      return resultat({ texte: HORS_RAPPORT, dansRapport: false, mode: 'ia', refus });
    }

    const phrases = [];
    for (const p of Array.isArray(r?.phrases) ? r.phrases : []) {
      const cites = faitsCites(p?.faits, parId);
      const texte = sansIdentifiants(p?.texte);
      const pourquoi = raisonDeRefus(texte, cites) ?? (causeInventee(texte) ? 'lien de cause absent du rapport' : null);
      if (pourquoi) refus.push(pourquoi);
      else phrases.push({ texte, faits: cites.map((f) => f.id) });
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
