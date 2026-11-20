// Informations du site orientation-regionsud.fr pour les métiers d'un rapport.
// Elles sont lues dans <dossier des rapports>/regionsud/ (prive/, jamais
// versionné) : correspondances.json (métier du rapport -> fiche du site) et
// fiches/<slug>.json. Sans ce dossier, rien n'est ajouté et l'assistant répond
// « ce n'est pas dans ton rapport » comme avant.
//
// Chaque fait garde l'adresse de la fiche : c'est la source montrée au jeune.
// La fiche est « la plus proche » du métier du rapport, pas toujours le même
// intitulé : le fait le dit, pour que la réponse le dise aussi.

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { normaliser } from '../text.js';

const SITE = 'https://www.orientation-regionsud.fr/';
export const FAITS_REGION_MAX = 6;

const dossier = () => path.join(config.rapportsDir, 'regionsud');

function lireJson(chemin) {
  try {
    return JSON.parse(fs.readFileSync(chemin, 'utf8'));
  } catch {
    return null;
  }
}

// La fiche retenue pour un métier du rapport, ou null.
export function ficheRegion(nomMetier) {
  const table = lireJson(path.join(dossier(), 'correspondances.json'));
  const slug = table?.[nomMetier]?.slug;
  if (typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) return null;
  const fiche = lireJson(path.join(dossier(), 'fiches', `${slug}.json`));
  return fiche && typeof fiche.url === 'string' && fiche.url.startsWith(SITE) ? fiche : null;
}

export const regionDisponible = () => fs.existsSync(dossier());

// Un métier a-t-il été cherché sur le site de la Région ? Oui s'il figure dans
// correspondances.json, avec ou sans fiche. Un métier jamais cherché (autre
// rapport que celui préparé) ne doit pas être présenté comme « sans fiche ».
export function metierCherche(nomMetier) {
  const table = lireJson(path.join(dossier(), 'correspondances.json'));
  return Boolean(table) && typeof table === 'object' && Object.hasOwn(table, nomMetier);
}

// Le site de la Région a-t-il été lu pour ce rapport ? (au moins un de ses métiers cherché)
export const regionLuePour = (analyse) => (analyse?.metiers ?? []).some((m) => metierCherche(m.nom));

// Formations de la Région pour un code ROME, lues dans regionsud/formations/<ROME>.json
// ({ formations: [...] }, préparé avant la démonstration, hors du dépôt). Liste vide si le fichier manque.
export function formationsRegion(codeRome) {
  if (typeof codeRome !== 'string' || !/^[A-Z]\d{4}$/.test(codeRome)) return [];
  const lu = lireJson(path.join(dossier(), 'formations', `${codeRome}.json`));
  return Array.isArray(lu?.formations) ? lu.formations : [];
}

// Ce que l'API renvoie sur un métier (champ `region`) : la fiche du site de la
// Région et ses formations, ou null quand le site n'a pas de fiche pour lui.
// À n'appeler que pour un métier cherché (metierCherche).
export function infosRegion(nomMetier) {
  const fiche = ficheRegion(nomMetier);
  if (!fiche) return null;
  return { ...fiche, formations: formationsRegion(fiche.code_rome) };
}

const liste = (elements, max) => (Array.isArray(elements) ? elements.filter((e) => typeof e === 'string' && e.trim()).slice(0, max) : []);
const sansPoint = (t) => String(t).trim().replace(/\.+$/, '');

// Le texte du fait : ce que le site de la Région dit, sans rien ajouter.
// « (Insee, Base tous salariés 2022) », repris de la fiche ; rien si elle ne nomme pas sa source.
function sourceDuSalaire(fiche) {
  const source = /Source\s*:\s*([^.]+)/.exec(String(fiche.salaire_source ?? ''))?.[1]?.trim();
  return source ? ` (${source})` : '';
}

function texteDuFait(metier, fiche) {
  const morceaux = [
    `Ce que dit le site orientation-regionsud.fr pour « ${metier.nom} » (fiche la plus proche sur ce site : « ${fiche.titre} »).`,
  ];
  if (Number.isInteger(fiche.salaire_median_net_mensuel)) {
    morceaux.push(
      `Salaire : la moitié des personnes qui exercent ce métier à temps plein gagnent plus de ${fiche.salaire_median_net_mensuel} euros net par mois${sourceDuSalaire(fiche)}. C'est un repère, pas une promesse.`
    );
  }
  if (fiche.acces) morceaux.push(`Comment y accéder : ${sansPoint(fiche.acces)}.`);
  const missions = liste(fiche.missions, 4).slice(1); // la première ligne est une phrase d'introduction
  if (missions.length) morceaux.push(`Missions : ${missions.map(sansPoint).join(' ; ')}.`);
  const horaires = liste(fiche.horaires, 4).filter((h) => h.startsWith('Travail'));
  if (horaires.length) morceaux.push(`Horaires : ${horaires.map(sansPoint).join(' ; ')}.`);
  if (fiche.recrute) morceaux.push('Le site le classe parmi les métiers qui recrutent en Région Sud.');
  if (fiche.formations_url) morceaux.push('Le site liste les formations de la région pour ce métier.');
  return morceaux.join(' ');
}

const mots = (texte) => normaliser(texte).split(/[^a-z0-9]+/).filter((m) => m.length > 3);

// Les faits de la Région utiles à une question : les métiers nommés dans la
// question ou la discussion, puis les préférés, puis les « ça m'intéresse ».
// Six au plus : le modèle ne reçoit pas les fiches de tous les métiers.
export function faitsRegion(analyse, { question = '', historique = [], choix = { favoris: [], interesses: [] } } = {}) {
  if (!fs.existsSync(dossier())) return [];
  const demande = new Set(mots([question, ...historique.map((m) => m.content || '')].join(' ')));
  const rang = (m) => {
    const cites = mots(m.nom).filter((mot) => demande.has(mot)).length;
    if (cites) return -10 * cites;
    if (choix.favoris.includes(m.id)) return 1;
    if (choix.interesses.includes(m.id)) return 2;
    return 3;
  };
  return analyse.metiers
    .map((m) => ({ m, fiche: ficheRegion(m.nom), rang: rang(m) }))
    .filter((x) => x.fiche && x.rang < 3)
    .sort((a, b) => a.rang - b.rang)
    .slice(0, FAITS_REGION_MAX)
    .map(({ m, fiche }) => ({
      id: `rs-${m.id}`,
      page: null,
      source: 'region',
      url: fiche.url,
      titre: `orientation-regionsud.fr : ${fiche.titre}`,
      noms: [m.nom, fiche.titre],
      texte: texteDuFait(m, fiche),
    }));
}
