// Contrôle des phrases écrites par le modèle, avant de les montrer au jeune.
// Une phrase est refusée si elle :
// - ne cite aucun fait existant ;
// - contient un nombre absent des faits qu'elle cite (score, salaire…) ;
// - emploie un mot interdit par les règles du sujet (AGENTS.md, section 5) :
//   verdict, comparaison aux autres, santé, famille, salaire ou diplôme sans
//   source ;
// - vouvoie, est vide ou trop longue.
// Le contrôle ne juge pas le style : il garantit que rien n'est ajouté.

import { normaliser } from '../text.js';

// Mots interdits, comparés sur le texte normalisé (sans accents, minuscules),
// en début de mot : « faible » attrape aussi « faibles », « faiblesse ».
const INTERDITS = [
  // verdict, niveau, comparaison
  'faible', 'mauvais', 'mediocre', 'moyenne', 'nul', 'nulle', 'insuffisant', 'echec', 'incapable', 'inferieur',
  'superieur', 'en dessous', 'au-dessus', 'score', 'note', 'niveau', 'pourcentage', 'classement', 'meilleur que',
  'moins bon', 'les autres jeunes', 'la plupart des jeunes', 'par rapport aux autres', 'pas fait pour', 'impossible',
  'jamais reussir', 'tu dois', 'il faut que tu',
  // santé, origine, famille, religion : aucune déduction
  'angoiss', 'anxi', 'stress', 'tendu', 'depress', 'deprim', 'malad', 'sante', 'trouble', 'handicap', 'therap',
  'religion', 'origine', 'famille', 'parents',
  // informations sans source dans le rapport
  'salaire', 'gagner', 'euro', 'diplome', 'bac ', 'debouche',
  // vouvoiement
  'vous', 'votre', 'vos',
];

const LONGUEUR_MAX = 260;

// « 1 234 » est un seul nombre : les milliers séparés par une espace sont recollés.
function nombres(texte) {
  return (String(texte).replace(/(\d)[\s\u00a0\u202f](?=\d{3}(?!\d))/g, '$1').match(/\d+/g) || []).map(Number);
}

// Mots admis quand la phrase cite un fait venu d'une source externe nommée
// (site de la Région, `source: 'region'`) : le salaire ou le diplôme a alors une source.
const ADMIS_AVEC_SOURCE = ['salaire', 'gagner', 'euro', 'diplome', 'bac ', 'debouche', 'niveau'];

// Renvoie null si la phrase est acceptée, sinon la raison du refus.
export function raisonDeRefus(texte, faitsCites) {
  if (typeof texte !== 'string' || !texte.trim()) return 'phrase vide';
  if (texte.length > LONGUEUR_MAX) return 'phrase trop longue';
  if (!faitsCites.length) return 'aucun fait cité';
  const avecSource = faitsCites.some((f) => f.source === 'region');
  if ((avecSource ? /[%$]/ : /[%€$]/).test(texte)) return 'symbole interdit';
  const simplifier = (t) => ` ${normaliser(t).replace(/[^a-z0-9' -]/g, ' ').replace(/\s+/g, ' ')} `;
  let norm = simplifier(texte);
  // Un intitulé de métier cité par le fait peut contenir un mot de la liste
  // (« santé »…) : il est retiré avant la recherche des mots interdits.
  for (const nom of faitsCites.flatMap((f) => f.noms || [])) norm = norm.split(simplifier(nom).trim()).join(' ');
  for (const mot of INTERDITS) {
    if (avecSource && ADMIS_AVEC_SOURCE.includes(mot)) continue;
    const re = new RegExp(`[ '-]${mot.trim().replace(/[-]/g, '\\-')}${mot.endsWith(' ') ? ' ' : ''}`);
    if (re.test(norm)) return `mot interdit : ${mot.trim()}`;
  }
  const permis = new Set(faitsCites.flatMap((f) => nombres(f.texte)));
  const intrus = nombres(texte).filter((n) => !permis.has(n));
  if (intrus.length) return `nombre absent des faits : ${intrus.join(', ')}`;
  return null;
}

// Garde les faits cités qui existent, dans l'ordre, sans doublon.
export function faitsCites(ids, faitsParId) {
  const vus = new Set();
  return [].concat(ids || [])
    .filter((id) => typeof id === 'string' && faitsParId[id] && !vus.has(id) && vus.add(id))
    .map((id) => faitsParId[id]);
}
