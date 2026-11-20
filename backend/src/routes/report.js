// Routes /report : analyse d'un Rapport des Possibles déjà rangé dans notre
// base (prive/), désigné par le jeton du lien reçu par mail. // JF
//
// GET  /report/{jeton}        : analyse complète (JSON avec sources)
// GET  /report/{jeton}/scores : uniquement les scores des graphiques, avec leurs
//                               sources (page, section, type de lecture)
// GET  /report/{jeton}/pdf    : le PDF du rapport, pour la visionneuse du site
//                               (PDF.js : lecture par morceaux acceptée)
// POST /report/{jeton}/resume : résumé écrit (4 phrases avec leur page, et un
//                               texte), corps facultatif { onboarding } ;
//                               donne audio_url si la synthèse vocale est réglée
// GET  /report/{jeton}/audio/{empreinte} : le texte du résumé lu à voix haute
//                               (WAV, Piper), créé au premier appel
// GET  /report/{jeton}/metiers?q=… : recherche de métiers dans la table O*NET,
//                               pour l'onboarding (métiers vus avec le psychologue)
//
// Pas d'authentification : le jeton (aléatoire, 128 bits) est la seule clé.
// Aucune route ne liste les jetons ni les rapports, et un jeton mal formé ou
// inconnu reçoit la même réponse 404.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import { analyserRapport, VERSION_EXTRACTION } from '../report/analyzer.js';
import { dossiersStockage } from '../storage.js';
import { rapportDuJeton } from '../liens.js';
import { genererResume } from '../resume/generer.js';
import { genererResumeLong } from '../resume/long.js';
import { nettoyerOnboarding } from '../resume/faits.js';
import { configOllama } from '../ai/ollama.js';
import { audioDisponible, empreinteAudio, EMPREINTE_VALIDE, fichierAudio, ErreurAudio } from '../audio/synthese.js';
import { tableOnet, controlerMetiers, chercherMetiers, cleIntitule, trouverMetiers } from '../onet/table.js';
import { liensMetier } from '../report/liensMetiers.js';
import { metierCherche, infosRegion } from '../chat/regionsud.js';

// Table O*NET, ou null si elle est absente ou illisible (l'analyse reste
// servie sans le contrôle).
function tableOuNull() {
  try {
    return tableOnet();
  } catch (e) {
    console.error(`Table O*NET illisible : ${e.message}`);
    return null;
  }
}

export const router = Router();

// L'analyse est calculée à la première consultation, puis relue depuis
// storage/outputs/{jeton}.json (jamais versionné), sauf si le PDF a changé.
// Exportée pour routes/chat.js, qui partage ce cache.
export async function analyseDuJeton(jeton) {
  const pdf = rapportDuJeton(jeton);
  if (!pdf) return null;
  const { outputs } = dossiersStockage();
  const cache = path.join(outputs, `${jeton}.json`);
  if (fs.existsSync(cache) && fs.statSync(cache).mtimeMs >= fs.statSync(pdf).mtimeMs) {
    const enCache = JSON.parse(fs.readFileSync(cache, 'utf8'));
    if (enCache.version_extraction === VERSION_EXTRACTION) return enCache;
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

// `rapport_pdf_url` (contrat) : adresse du PDF, relative à la racine de l'API.
// Chaque métier est contrôlé contre la table O*NET (`onet` sur le métier,
// bilan dans `controle_onet`) ; un métier introuvable ajoute une note.
// Chaque métier reçoit aussi `liens` : où chercher salaires, études et offres
// (ONISEP, Région Sud, France Travail), avec l'intitulé exact de la table
// O*NET quand il est retrouvé (l'extraction du PDF perd parfois un « l »).
router.get('/:jeton', (req, res) =>
  repondre(req, res, (analyse) => {
    const table = tableOuNull();
    const controles = controlerMetiers(analyse.metiers, table);
    const controle = controles.controle;
    const metiers = controles.metiers.map((m) => {
      const officiels = table ? trouverMetiers(table, m.nom) : [];
      // `region` : fiche d'orientation-regionsud.fr lue dans prive/regionsud/. Absent si le métier n'y a pas
      // été cherché (dossier absent, ou rapport non préparé) ; null s'il a été cherché sans trouver de fiche.
      const region = metierCherche(m.nom) ? { region: infosRegion(m.nom) } : {};
      return { ...m, liens: liensMetier(officiels.length === 1 ? officiels[0].job_fr : m.nom), ...region };
    });
    const notes = controle.introuvables.map((nom) => `Champ des possibles — métier introuvable dans la table O*NET : « ${nom} »`);
    return {
      ...analyse,
      metiers,
      notes: [...analyse.notes, ...notes],
      controle_onet: controle,
      rapport_pdf_url: `/report/${analyse.id}/pdf`,
    };
  })
);

// Recherche pour l'écran « Le psychologue t'a parlé d'autres métiers ? ».
// Derrière le jeton : la table appartient au Centre, elle ne doit pas pouvoir
// être parcourue par n'importe qui. Renvoie l'intitulé, le code O*NET, et l'id
// du métier s'il est déjà dans le rapport.
router.get('/:jeton/metiers', async (req, res) => {
  try {
    const analyse = await analyseDuJeton(req.params.jeton);
    if (!analyse) return res.status(404).json({ detail: 'Rapport introuvable' });
    const table = tableOuNull();
    if (!table) return res.status(503).json({ detail: 'Table des métiers absente' });
    const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 10, 1), 20);
    const idDansRapport = new Map(analyse.metiers.map((m) => [cleIntitule(m.nom), m.id]));
    const resultats = chercherMetiers(table, String(req.query.q ?? ''), limite).map((m) => ({
      nom: m.job_fr,
      code: m.code,
      dans_rapport: idDansRapport.get(m.cle) ?? null,
    }));
    res.json({ resultats });
  } catch (e) {
    console.error(e);
    res.status(500).json({ detail: 'Erreur interne pendant la recherche de métiers' });
  }
});

// Le PDF lui-même. Même contrôle du jeton et même 404 que les autres routes.
// Nom de fichier neutre : le nom rangé dans prive/ (numéro du rapport) ne sort
// pas. Les requêtes « Range » de PDF.js sont servies (206) ; leurs en-têtes
// sont exposés au front, servi depuis une autre origine.
router.get('/:jeton/pdf', (req, res) => {
  const pdf = rapportDuJeton(req.params.jeton);
  if (!pdf) return res.status(404).json({ detail: 'Rapport introuvable' });
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': 'inline; filename="rapport.pdf"',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Range, Content-Length',
  });
  res.sendFile(pdf, { cacheControl: false }, (err) => {
    if (!err) return;
    if (!res.headersSent) return res.status(404).json({ detail: 'Rapport introuvable' });
    if (err.code !== 'ECONNABORTED') console.error(err); // ECONNABORTED : PDF.js a annulé la lecture
  });
});

router.get('/:jeton/scores', (req, res) =>
  repondre(req, res, (analyse) => ({
    interets_riasec: analyse.interets_riasec,
    aptitudes: analyse.aptitudes,
    personnalite_hexaco: analyse.personnalite_hexaco,
  }))
);

// Le résumé dépend des choix de l'onboarding (gardés dans le navigateur du
// jeune) : le front les envoie dans le corps. Mis en cache par jeton, choix et
// modèle ; un résumé entièrement en repli (Ollama absent) n'est pas gardé,
// pour que l'IA soit réessayée à l'appel suivant.
router.post('/:jeton/resume', async (req, res) => {
  try {
    const analyse = await analyseDuJeton(req.params.jeton);
    if (!analyse) return res.status(404).json({ detail: 'Rapport introuvable' });
    const onboarding = req.body?.onboarding ?? null;
    const pdf = rapportDuJeton(req.params.jeton);
    // Un résumé gardé est relu ; sinon il est écrit, et gardé sauf s'il est entièrement en repli.
    const garde = async (version, ecrire) => {
      const cle = crypto
        .createHash('sha256')
        .update(JSON.stringify({ choix: nettoyerOnboarding(onboarding, analyse), modele: configOllama().modele, ...(version ? { version } : {}) }))
        .digest('hex')
        .slice(0, 16);
      const cache = path.join(dossiersStockage().outputs, `${req.params.jeton}-resume-${cle}.json`);
      if (fs.existsSync(cache) && fs.statSync(cache).mtimeMs >= fs.statSync(pdf).mtimeMs) return JSON.parse(fs.readFileSync(cache, 'utf8'));
      const ecrit = await ecrire();
      if (ecrit.genere_par.mode !== 'repli') fs.writeFileSync(cache, JSON.stringify(ecrit, null, 2));
      return ecrit;
    };
    let resume = await garde(null, () => genererResume(analyse, onboarding));
    // « version: longue » : le résumé court, puis un passage sur chaque métier préféré (resume/long.js).
    if (req.body?.version === 'longue') {
      const court = resume;
      resume = await garde('longue', () => genererResumeLong(analyse, onboarding, court));
    }
    res.json({ ...resume, audio_url: preparerAudio(req.params.jeton, resume.texte) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ detail: 'Erreur interne pendant la génération du résumé' });
  }
});

// Audio du résumé. Le texte à lire est gardé à côté des analyses
// ({jeton}-texte-{empreinte}.txt) quand le résumé est demandé ; l'audio est
// créé au premier GET puis relu ({jeton}-audio-{empreinte}.wav). Sans voix
// réglée (PIPER_MODELE), pas d'adresse audio : le front affiche le texte seul.
function preparerAudio(jeton, texte) {
  if (!audioDisponible() || !texte) return null;
  const empreinte = empreinteAudio(texte);
  const { outputs } = dossiersStockage();
  const fichier = path.join(outputs, `${jeton}-texte-${empreinte}.txt`);
  if (!fs.existsSync(fichier)) {
    fs.mkdirSync(outputs, { recursive: true });
    fs.writeFileSync(fichier, texte);
  }
  return `/report/${jeton}/audio/${empreinte}`;
}

router.get('/:jeton/audio/:empreinte', async (req, res) => {
  const { jeton, empreinte } = req.params;
  if (!rapportDuJeton(jeton) || !EMPREINTE_VALIDE.test(empreinte)) {
    return res.status(404).json({ detail: 'Rapport introuvable' });
  }
  if (!audioDisponible()) return res.status(503).json({ detail: 'Synthèse vocale non configurée' });
  const { outputs } = dossiersStockage();
  const texte = path.join(outputs, `${jeton}-texte-${empreinte}.txt`);
  if (!fs.existsSync(texte)) return res.status(404).json({ detail: 'Audio introuvable : redemande le résumé' });
  try {
    const wav = await fichierAudio(fs.readFileSync(texte, 'utf8'), outputs, `${jeton}-audio-${empreinte}`);
    res.set({
      'Content-Type': 'audio/wav',
      'Content-Disposition': 'inline; filename="resume.wav"',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Range, Content-Length',
    });
    res.sendFile(wav, { cacheControl: false }, (err) => {
      if (err && err.code !== 'ECONNABORTED' && !res.headersSent) res.status(500).json({ detail: 'Erreur interne' });
    });
  } catch (e) {
    if (e instanceof ErreurAudio) {
      console.error(`Synthèse vocale : ${e.message}`);
      return res.status(503).json({ detail: 'Synthèse vocale indisponible' });
    }
    console.error(e);
    res.status(500).json({ detail: 'Erreur interne pendant la synthèse vocale' });
  }
});
