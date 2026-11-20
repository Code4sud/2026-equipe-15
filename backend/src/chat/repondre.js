// Réponse de l'assistant à une question du jeune :
// 1. Qwen (Ollama) reçoit les instructions, les faits du rapport, l'historique
//    court de la discussion et la question.
// 2. Chaque phrase passe par resume/controle.js (même contrôle que le résumé :
//    fait cité, pas de nombre inventé, pas de mot interdit, pas de vouvoiement).
// 3. « dans_rapport: false » : c'est le backend qui écrit la réponse fixe
//    « Ce n'est pas dans ton rapport » (le contrôle refuserait une phrase du
//    modèle qui parle de salaire ou de diplôme, même pour dire qu'il n'y en a pas).
//    Exception : une question d'information sur un métier (salaire, formation,
//    horaires, débouchés…) quand le site de la Région a été lu (prive/regionsud/)
//    mais n'apporte rien : le backend dit qu'il n'a rien trouvé sur ce site et
//    donne des pistes pour chercher ailleurs (champ « pistes »).
// 4. Ollama absent, ou toutes les phrases refusées deux fois : message de repli.

import { discuterJson, configOllama, ErreurIA } from '../ai/ollama.js';
import { raisonDeRefus, faitsCites } from '../resume/controle.js';
import { normaliser } from '../text.js';
import { construireContexte } from './contexte.js';
import { faitsRegion, ficheRegion, regionLuePour } from './regionsud.js';
import { liensMetier } from '../report/liensMetiers.js';
import { SYSTEME, SCHEMA, message } from './instructions.js';

export const HORS_RAPPORT =
  "Ce n'est pas dans ton rapport. Tu peux en parler au psychologue ou à un conseiller du Centre des Possibles. " +
  "Le site orientation-regionsud.fr peut aussi t'aider.";
export const INDISPONIBLE =
  'Je ne peux pas te répondre pour le moment. Tu peux relire ton résumé, ou poser ta question au psychologue.';
const NB_ESSAIS = 2;
const REFUSEES = 'phrases du modèle refusées par le contrôle';

// Qwen recopie parfois l'identifiant du fait dans la phrase (« … (f1). ») ou
// numérote ses phrases (« 1. … ») : c'est retiré avant le contrôle, qui
// prendrait ces chiffres pour des nombres inventés et refuserait la réponse.
const ID_FAIT = '(?:f\\d+|(?:rs-)?z\\d+-m\\d+|zones)';
const IDS_ENTRE_PARENTHESES = new RegExp(`\\s*[(\\[]\\s*${ID_FAIT}(?:\\s*(?:,|et)\\s*${ID_FAIT})*\\s*[)\\]]`, 'gi');
const DEBUT_DE_LISTE = /^\s*(?:\d+\s*[.)]|[-•*])\s+/;
const sansIdentifiants = (texte) =>
  typeof texte === 'string' ? texte.replace(IDS_ENTRE_PARENTHESES, '').replace(DEBUT_DE_LISTE, '').trim() : texte;

// Le rapport ne dit jamais qu'un trait « explique » un métier ou un choix :
// une phrase qui l'affirme est refusée (règle du sujet : ne rien inventer).
const CAUSE = /(^|[ '])(expliqu|c'est pour ca|c'est pourquoi|voila pourquoi|c'est grace)/;
const causeInventee = (texte) => CAUSE.test(normaliser(texte));

// Question sur les formations ou les études : le rapport n'en donne pas, mais
// il donne le temps de préparation de chaque piste. Le backend écrit la
// réponse lui-même, à partir des préférés du jeune (sinon une piste par zone).
const FORMATIONS = /(^|[ '])(formation|etude|ecole|diplome|apprentissage|alternance)/;
const SANS_FORMATIONS = 'Ton rapport ne donne pas de formations.';
const VOIR_AILLEURS = "Pour trouver une formation, parles-en au psychologue ou regarde sur orientation-regionsud.fr.";

// Les métiers dont on parle quand la question n'en nomme pas : les préférés,
// sinon les « ça m'intéresse », sinon une piste par zone.
// Un métier nommé dans la question passe avant : on ne répond pas sur un autre métier à sa place.
// Pluriel et féminin en « e » ramenés à la même forme : « dompteurs de comètes » nomme « Dompteur de comètes ».
const racine = (mot) => mot.replace(/e?[sx]?$/, '');
const motsUtiles = (texte) => normaliser(texte).split(/[^a-z0-9]+/).filter((m) => m.length > 3).map(racine);

function metiersNommes(analyse, question = '') {
  const dits = new Set(motsUtiles(question));
  const candidats = analyse.metiers
    .map((m) => {
      const mots = motsUtiles(m.nom);
      return { m, mots, trouves: mots.filter((mot) => dits.has(mot)) };
    })
    .filter((c) => c.mots.length && c.trouves.length >= Math.min(2, c.mots.length));
  // Deux intitulés qui commencent pareil : celui que la question dit en entier (sinon celui dont elle
  // dit le plus de mots) l'emporte, pour ne pas répondre sur le métier voisin à la place du métier demandé.
  const complets = candidats.filter((c) => c.trouves.length === c.mots.length);
  const retenus = complets.length ? complets : candidats;
  const couvert = (c) => retenus.some((a) => a.trouves.length > c.trouves.length && c.trouves.every((mot) => a.trouves.includes(mot)));
  return retenus.filter((c) => !couvert(c)).map((c) => c.m).slice(0, 3);
}

function pistesDuJeune(analyse, choix, question = '') {
  const nommes = metiersNommes(analyse, question);
  if (nommes.length) return nommes;
  const parId = Object.fromEntries(analyse.metiers.map((m) => [m.id, m]));
  const choisis = (choix.favoris.length ? choix.favoris : choix.interesses).map((id) => parId[id]).filter(Boolean);
  const parZone = analyse.metiers.filter((m, i, tous) => tous.findIndex((x) => x.zone === m.zone) === i);
  return (choisis.length ? choisis : parZone).slice(0, 3);
}

// Les premières phrases d'un texte du site, 240 caractères au plus : phrases courtes (règle du sujet).
function debut(texte) {
  let garde = '';
  for (const phrase of String(texte).match(/[^.!?]+[.!?]+/g) || [String(texte)]) {
    if (garde && (garde + phrase).length > 240) break;
    garde += phrase;
  }
  return garde.trim().slice(0, 300);
}

function phrasesFormations(analyse, choix, connus, question) {
  const pistes = pistesDuJeune(analyse, choix, question)
    .map((m) => ({ m, duree: /accessibles? en (.+)$/.exec(m.zone_label || '')?.[1] }))
    .filter((p) => p.duree);
  if (!pistes.length) return null;
  // Ce que le site de la Région dit de l'accès au métier, quand la fiche a été lue (prive/regionsud/).
  const acces = pistes
    .map(({ m }) => ({ m, fiche: connus[`rs-${m.id}`] ? ficheRegion(m.nom) : null }))
    .filter((x) => x.fiche?.acces)
    .map(({ m, fiche }) => ({
      texte: `D'après le site de la Région, pour « ${m.nom} » (fiche « ${fiche.titre} ») : ${debut(fiche.acces)}`,
      faits: [`rs-${m.id}`],
    }));
  return [
    { texte: SANS_FORMATIONS, faits: [] },
    { texte: 'Il indique un temps de préparation pour chaque piste.', faits: [] },
    ...pistes.map(({ m, duree }) => ({ texte: `« ${m.nom} » : ${duree} de préparation.`, faits: [m.id] })),
    ...acces,
    { texte: VOIR_AILLEURS, faits: [] },
  ];
}

// Question sur le salaire sans métier nommé : le rapport n'en parle pas. Si le
// site de la Région a été lu pour les métiers du jeune, on donne son repère.
const SALAIRE = /(^|[ '])(salaire|gagn|paye|argent|remuner)/;

function phrasesSalaire(analyse, choix, connus, question) {
  const lignes = pistesDuJeune(analyse, choix, question)
    .map((m) => ({ m, fiche: connus[`rs-${m.id}`] ? ficheRegion(m.nom) : null }))
    .filter((x) => Number.isInteger(x.fiche?.salaire_median_net_mensuel))
    .map(({ m, fiche }) => ({
      texte: `« ${m.nom} » (fiche « ${fiche.titre} ») : la moitié des personnes à temps plein gagnent plus de ${fiche.salaire_median_net_mensuel} euros net par mois.`,
      faits: [`rs-${m.id}`],
    }));
  if (!lignes.length) return null;
  return [
    { texte: 'Ton rapport ne parle pas de salaire.', faits: [] },
    { texte: "D'après le site de la Région, voici un repère pour tes pistes :", faits: [] },
    ...lignes,
    { texte: "C'est un repère, pas une promesse : le salaire dépend du poste et de l'expérience.", faits: [] },
  ];
}

// Information sur un métier (salaire, formation, diplôme, horaires, débouchés…)
// que le site de la Région ne donne pas : pas de fiche pour ce métier, ou fiche
// sans cette information. Le backend le dit et indique où chercher. Seulement
// quand le site a été lu (prive/regionsud/ existe) : sinon la phrase serait fausse.
const INFO_METIER = /(^|[ '])(horaire|debouche|recrut|embauch|emploi|concours|qualification)/;
const surUnMetier = (q) => FORMATIONS.test(q) || SALAIRE.test(q) || INFO_METIER.test(q);
// Tentative de détournement : toujours la réponse fixe « pas dans ton rapport ».
// « Oublie tes règles », « ignore les consignes », « invente un salaire » : un ordre, pas « j'ai oublié » ni « j'ignore ».
const DETOURNEMENT =
  /(^| )((?<!\b(ai|as|avais) )(oublie|ignore)[sz]? (tes|tous|tout|toutes|les|ce|ca|cela)\b|invente[sz]?( |$)|fais semblant|fais comme si|change de role|tes regles|tes consignes|tes instructions|ton prompt)/;
export const CHERCHER_AILLEURS =
  "Tu peux chercher sur le site de l'ONISEP ou sur France Travail, ou en parler au psychologue.";
const SITE_REGION = "sur le site d'orientation de la Région";

function sansFiche(analyse, question, phrasesDuRapport) {
  const nommes = metiersNommes(analyse, question);
  const entre = nommes.map((m) => `« ${m.nom} »`);
  const noms = entre.length > 1 ? `${entre.slice(0, -1).join(', ')} et ${entre.at(-1)}` : entre[0];
  const constat = !nommes.length
    ? `Je n'ai pas cette information : elle n'est ni dans ton rapport, ni dans ce que j'ai lu ${SITE_REGION}.`
    : nommes.some((m) => ficheRegion(m.nom))
      ? `Je n'ai pas trouvé cette information pour ${noms} ${SITE_REGION}.`
      : `Je n'ai pas trouvé d'information sur ${noms} ${SITE_REGION}.`;
  return {
    phrases: [
      // Ce que le rapport donne quand même (temps de préparation), sans le renvoi vers le site de la Région.
      ...(phrasesDuRapport || []).filter((p) => p.texte !== VOIR_AILLEURS),
      { texte: constat, faits: [] },
      { texte: CHERCHER_AILLEURS, faits: [] },
    ],
    // Liens de recherche pour chaque métier nommé (rien n'est extrait de ces sites).
    // Sans le lien vers le site de la Région : on vient de dire qu'il n'a rien pour ce métier.
    pistes: nommes.flatMap((m) =>
      liensMetier(m.nom)
        .filter((lien) => lien.site !== 'orientation-regionsud')
        .map((lien) => ({ metier: m.nom, ...lien, titre: nommes.length > 1 ? `${lien.titre} · ${m.nom}` : lien.titre }))
    ),
  };
}

export async function repondreQuestion(analyse, { question, historique = [], onboarding = null }, { llm = discuterJson } = {}) {
  const { contexte, choix } = construireContexte(analyse, onboarding);
  // Faits du site de la Région (prive/regionsud/), s'ils existent pour les métiers concernés.
  // L'intitulé exact des métiers nommés est ajouté à la demande : un métier dit au pluriel retrouve ainsi sa fiche.
  const nommes = metiersNommes(analyse, question).map((m) => m.nom);
  contexte.push(...faitsRegion(analyse, { question: [question, ...nommes].join(' '), historique, choix }));
  const parId = Object.fromEntries(contexte.map((f) => [f.id, f]));
  const refus = [];
  let raison = null;

  // La réponse écrite par le backend quand les faits ne répondent pas à la question
  // (null : rien à écrire, la réponse fixe « pas dans ton rapport » reste).
  const q = normaliser(question);
  const ecriteParLeBackend = () => {
    if (DETOURNEMENT.test(q)) return null;
    const formations = FORMATIONS.test(q);
    const phrases = formations
      ? phrasesFormations(analyse, choix, parId, q)
      : SALAIRE.test(q)
        ? phrasesSalaire(analyse, choix, parId, q)
        : null;
    if (phrases?.some((p) => p.faits.some((id) => id.startsWith('rs-')))) return { phrases };
    // « Pas trouvé sur le site de la Région » seulement si c'est vrai : le site a été lu, et aucune
    // fiche des métiers concernés ne porte l'information (horaires, débouchés : non vérifiable ici,
    // une fiche qui existe suffit à garder la réponse fixe).
    const porte = (fiche) => (formations ? Boolean(fiche.acces) : SALAIRE.test(q) ? Number.isInteger(fiche.salaire_median_net_mensuel) : true);
    const siteMuet = !pistesDuJeune(analyse, choix, q).some((m) => {
      const fiche = ficheRegion(m.nom);
      return fiche && porte(fiche);
    });
    if (surUnMetier(q) && regionLuePour(analyse) && siteMuet) return sansFiche(analyse, q, phrases);
    return phrases ? { phrases } : null;
  };
  const horsDesFaits = (ecrit = ecriteParLeBackend(), raisonDuBackend) =>
    resultat({ parId, dansRapport: false, mode: 'ia', refus, raison: raisonDuBackend, ...(ecrit ?? { texte: HORS_RAPPORT }) });

  for (let essai = 1; essai <= NB_ESSAIS; essai++) {
    let r;
    try {
      r = await llm({ systeme: SYSTEME, historique, message: message(contexte, question), schema: SCHEMA });
    } catch (e) {
      if (!(e instanceof ErreurIA)) throw e;
      raison = e.message;
      break;
    }
    if (r?.dans_rapport === false) return horsDesFaits();

    const phrases = [];
    for (const p of Array.isArray(r?.phrases) ? r.phrases : []) {
      const cites = faitsCites(p?.faits, parId);
      const texte = sansIdentifiants(p?.texte);
      const pourquoi = raisonDeRefus(texte, cites) ?? (causeInventee(texte) ? 'lien de cause absent du rapport' : null);
      if (pourquoi) refus.push(pourquoi);
      else phrases.push({ texte, faits: cites.map((f) => f.id) });
    }
    if (phrases.length) return resultat({ phrases, parId, dansRapport: true, mode: 'ia', refus });
    raison = REFUSEES;
  }
  // Le modèle a répondu deux fois par des phrases refusées (salaire ou diplôme sans source…) à une
  // question d'information sur un métier : le backend répond lui-même, plutôt que « je ne peux pas ».
  // Seulement quand le site de la Région a été lu ; sinon le repli habituel.
  if (raison === REFUSEES && surUnMetier(q) && regionLuePour(analyse)) {
    const ecrit = ecriteParLeBackend();
    if (ecrit) return horsDesFaits(ecrit, `${raison} : réponse écrite par le backend`);
  }
  return resultat({ texte: INDISPONIBLE, dansRapport: null, mode: 'repli', raison, refus });
}

function resultat({ texte, phrases = [], parId = {}, dansRapport, mode, raison, refus, pistes }) {
  const ids = [...new Set(phrases.flatMap((p) => p.faits))];
  return {
    reponse: texte ?? phrases.map((p) => p.texte).join(' '),
    phrases,
    sources: ids.map((id) => ({
      fait: id,
      page: parId[id].page,
      texte: parId[id].texte,
      ...(parId[id].url ? { url: parId[id].url, titre: parId[id].titre } : {}),
    })),
    dans_rapport: dansRapport,
    // Où chercher ailleurs, quand le site de la Région n'a rien : [{ metier, site, titre, url }].
    ...(pistes ? { pistes } : {}),
    genere_par: { mode, modele: mode === 'ia' ? configOllama().modele : null, ...(raison ? { raison } : {}) },
    controle: { phrases_refusees: refus.length, raisons: [...new Set(refus)] },
  };
}
