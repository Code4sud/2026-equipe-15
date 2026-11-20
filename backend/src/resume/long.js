// Version longue du résumé, pensée pour l'écoute (une à deux minutes) : le
// résumé court, puis un passage sur chacun des métiers préférés du jeune.
//
// Pour chaque métier :
//   - son temps de préparation (rapport) ;
//   - ce qu'on y fait, et ce que ça rejoint dans ce qui ressort chez le jeune :
//     trois phrases écrites par le modèle, chacune contrôlée (fait cité, rien
//     d'ajouté, pas de « ça explique ») ; à défaut, la description du rapport ;
//   - un repère de salaire et l'accès au métier, quand la fiche du site de la
//     Région a été préparée (prive/regionsud/), avec l'adresse de la fiche.
// Les phrases écrites par le code (temps de préparation, salaire, accès,
// conclusion) ne passent pas par le modèle : elles ne peuvent rien inventer.

import { discuterJson, configOllama, ErreurIA } from '../ai/ollama.js';
import { raisonDeRefus, faitsCites } from './controle.js';
import { construireContexte } from '../chat/contexte.js';
import { ficheRegion, metierCherche } from '../chat/regionsud.js';
import { normaliser } from '../text.js';

export const PISTES_MAX = 3;
const NB_ESSAIS = 2;

const SYSTEME = `Tu aides un ou une jeune de 16 ans à relire son Rapport des Possibles, un bilan d'orientation. Tes phrases seront lues à voix haute.
Pour chaque métier demandé, tu écris exactement trois phrases :
- phrases 1 et 2 : ce qu'on fait concrètement dans ce métier, d'après le fait du métier ;
- phrase 3 : ce que ce métier rejoint dans ce qui ressort chez le jeune (ses intérêts, ses aptitudes ou sa personnalité). Elle cite le fait du métier ET un fait du profil. Tu écris « ça rejoint », « tu y retrouves » ou « ça peut te plaire si ».

Règles absolues :
- Tu tutoies. Phrases courtes (18 mots au plus), mots simples, sans jargon.
- Uniquement ce que disent les faits. Chaque phrase cite les identifiants des faits utilisés.
- Jamais « tu es fait pour », « ça explique », « c'est pour ça », « donc ». Tu rapproches, tu ne déduis pas.
- Aucun chiffre, aucune note, aucun niveau. Jamais « faible », « mauvais », « moyenne », « score ».
- Rien sur la santé, le stress, la famille, l'origine, la religion, le salaire ou les diplômes.
- Ce sont des pistes, pas des consignes : tu ne dis jamais au jeune ce qu'il doit choisir.
Tu réponds uniquement en JSON, en français.`;

const SCHEMA = {
  type: 'object',
  properties: {
    metiers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          phrases: {
            type: 'array',
            items: {
              type: 'object',
              properties: { texte: { type: 'string' }, faits: { type: 'array', items: { type: 'string' } } },
              required: ['texte', 'faits'],
            },
          },
        },
        required: ['id', 'phrases'],
      },
    },
  },
  required: ['metiers'],
};

const CAUSE = /(^|[ '])(expliqu|c'est pour ca|c'est pourquoi|voila pourquoi|c'est grace|tu es fait|donc )/;
const ID_DANS_LE_TEXTE = /\s*[(\[]\s*(?:f\d+|z\d+-m\d+|zones)(?:\s*(?:,|et)\s*(?:f\d+|z\d+-m\d+|zones))*\s*[)\]]/gi;

// Les premières phrases d'un texte, `max` caractères au plus.
function debut(texte, max = 220) {
  let garde = '';
  for (const phrase of String(texte ?? '').match(/[^.!?]+[.!?]+/g) || [String(texte ?? '')]) {
    if (garde && (garde + phrase).length > max) break;
    garde += phrase;
  }
  return garde.trim().slice(0, max + 80);
}

const dureeDe = (m) => /accessibles? en (.+)$/.exec(m.zone_label || '')?.[1] ?? null;

// Les métiers dont on parle : les préférés, sinon les « ça m'intéresse ».
function pistesDe(analyse, choix) {
  const parId = Object.fromEntries(analyse.metiers.map((m) => [m.id, m]));
  const ids = choix.favoris.length ? choix.favoris : choix.interesses;
  return { pistes: ids.map((id) => parId[id]).filter(Boolean).slice(0, PISTES_MAX), preferes: choix.favoris.length > 0 };
}

function message(profil, pistes, parId) {
  const ligne = (f) => `${f.id}${f.page ? ` (page ${f.page})` : ''} : ${f.texte}`;
  return `Ce qui ressort chez le jeune (faits du profil) :
${profil.map(ligne).join('\n')}

Métiers à présenter, dans cet ordre (faits des métiers) :
${pistes.map((m) => ligne(parId[m.id])).join('\n')}`;
}

// Garde, pour chaque métier, les phrases du modèle qui passent le contrôle.
function trier(reponse, pistes, parId) {
  const gardees = {};
  const refus = [];
  for (const bloc of Array.isArray(reponse?.metiers) ? reponse.metiers : []) {
    if (!pistes.some((m) => m.id === bloc?.id)) continue;
    const phrases = [];
    for (const p of Array.isArray(bloc.phrases) ? bloc.phrases : []) {
      const texte = typeof p?.texte === 'string' ? p.texte.replace(ID_DANS_LE_TEXTE, '').trim() : p?.texte;
      const cites = faitsCites(p?.faits, parId);
      const pourquoi =
        raisonDeRefus(texte, cites) ??
        (!cites.some((f) => f.id === bloc.id) ? 'phrase qui ne cite pas son métier' : null) ??
        (CAUSE.test(` ${normaliser(texte)}`) ? 'lien de cause absent du rapport' : null);
      if (pourquoi) refus.push(pourquoi);
      else phrases.push({ texte, faits: cites.map((f) => f.id), origine: 'ia' });
    }
    if (phrases.length) gardees[bloc.id] = phrases.slice(0, 3);
  }
  return { gardees, refus };
}

// Ce que le site de la Région dit du métier : phrases écrites par le code, avec l'adresse de la fiche.
function phrasesRegion(metier, dejaDit) {
  if (!metierCherche(metier.nom)) return [];
  const fiche = ficheRegion(metier.nom);
  if (!fiche) {
    return [{ texte: "Pour ce métier, je n'ai pas trouvé d'information sur le site d'orientation de la Région.", faits: [], origine: 'code' }];
  }
  const source = { url: fiche.url, titre: `orientation-regionsud.fr : ${fiche.titre}` };
  const phrases = [];
  if (Number.isInteger(fiche.salaire_median_net_mensuel)) {
    phrases.push({
      texte: `D'après le site de la Région, fiche « ${fiche.titre} », la moitié des personnes qui font ce métier à temps plein gagnent plus de ${fiche.salaire_median_net_mensuel} euros net par mois.`,
      faits: [],
      origine: 'code',
      ...source,
    });
    if (!dejaDit.repere) {
      phrases.push({ texte: "C'est un repère, pas une promesse.", faits: [], origine: 'code' });
      dejaDit.repere = true;
    }
  }
  if (fiche.acces) phrases.push({ texte: `Pour y accéder, toujours d'après ce site : ${debut(fiche.acces)}`, faits: [], origine: 'code', ...source });
  return phrases;
}

const CONCLUSION = [
  'Ce sont des pistes, pas des consignes.',
  "Un métier absent de ton rapport n'est pas fermé pour toi.",
  'Tes résultats sont une image à un moment donné : ils peuvent évoluer.',
  "Tu peux en parler avec le psychologue : c'est toi qui décides.",
];

// `court` : le résumé court déjà généré (genererResume), dont les phrases ouvrent la version longue.
export async function genererResumeLong(analyse, onboarding, court, { llm = discuterJson } = {}) {
  const { contexte, choix } = construireContexte(analyse, onboarding);
  const parId = Object.fromEntries(contexte.map((f) => [f.id, f]));
  const { pistes, preferes } = pistesDe(analyse, choix);
  const profil = contexte.filter((f) => /^f\d+$/.test(f.id));
  const refus = [];
  let gardees = {};
  let raison = null;

  for (let essai = 1; essai <= NB_ESSAIS && pistes.length; essai++) {
    try {
      const r = trier(await llm({ systeme: SYSTEME, message: message(profil, pistes, parId), schema: SCHEMA }), pistes, parId);
      refus.push(...r.refus);
      if (Object.keys(r.gardees).length > Object.keys(gardees).length) gardees = r.gardees;
      if (pistes.every((m) => gardees[m.id])) break;
      raison = 'phrases du modèle refusées par le contrôle';
    } catch (e) {
      if (!(e instanceof ErreurIA)) throw e;
      raison = e.message;
      break;
    }
  }

  const phrases = (court?.phrases ?? []).map((p) => ({ texte: p.texte, faits: p.faits ?? [], origine: p.origine ?? 'ia' }));
  const code = (texte, faits = []) => ({ texte, faits, origine: 'code' });
  if (!pistes.length) {
    phrases.push(code("Tu n'as pas encore choisi de métier préféré. Quand ce sera fait, cette version en parlera."));
  } else {
    const n = pistes.length;
    phrases.push(
      code(preferes ? (n > 1 ? `Regardons maintenant tes ${n} métiers préférés.` : 'Regardons maintenant ton métier préféré.') : 'Regardons maintenant des métiers qui t’intéressent.')
    );
    const dejaDit = { repere: false };
    pistes.forEach((m, i) => {
      const duree = dureeDe(m);
      const rang = n > 1 ? ['Le premier', 'Le deuxième', 'Le troisième'][i] : 'Ce métier';
      phrases.push(code(`${rang} : « ${m.nom} ».${duree ? ` Il faut compter ${duree} de préparation.` : ''}`, [m.id]));
      if (gardees[m.id]) phrases.push(...gardees[m.id]);
      else if (m.description) phrases.push({ texte: `Ton rapport le décrit ainsi : ${debut(m.description)}`, faits: [m.id], origine: 'repli' });
      phrases.push(...phrasesRegion(m, dejaDit));
    });
  }
  phrases.push(...CONCLUSION.map((t) => code(t)));

  const nbIa = phrases.filter((p) => p.origine === 'ia').length;
  const attendues = pistes.length;
  const ecrits = pistes.filter((m) => gardees[m.id]).length;
  const mode = nbIa === 0 ? 'repli' : ecrits === attendues && court?.genere_par?.mode === 'ia' ? 'ia' : 'mixte';
  const cites = new Set(phrases.flatMap((p) => p.faits));
  return {
    version: 'longue',
    texte: phrases.map((p) => p.texte).join(' '),
    phrases,
    faits: contexte.filter((f) => cites.has(f.id)).map(({ id, page, texte }) => ({ id, page, texte })),
    metiers: pistes.map((m) => m.id),
    genere_par: { mode, modele: mode === 'repli' ? null : configOllama().modele, ...(mode === 'ia' ? {} : { raison: raison || 'phrases écrites par le code' }) },
    controle: { phrases_refusees: refus.length, raisons: [...new Set(refus)] },
  };
}
