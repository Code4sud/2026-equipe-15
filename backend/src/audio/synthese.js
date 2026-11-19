// Synthèse vocale locale du résumé (deuxième restitution décidée le 19/11),
// avec Piper : un moteur ouvert qui tourne sur le processeur, hors ligne.
//
// Variables d'environnement (backend/.env, voir .env.example) :
//   PIPER_BIN      commande Piper (défaut : « piper », cherchée dans le PATH)
//   PIPER_MODELE   chemin du modèle de voix .onnx (avec son .onnx.json à côté).
//                  Sans lui, pas d'audio : le front affiche le texte seul.
//   PIPER_TIMEOUT_MS  délai maximal d'une synthèse (défaut : 120 000 ms)
// Le binaire et la voix restent hors du dépôt (plus de 50 Mo interdits).
//
// Le texte lu est le texte du résumé, à la ponctuation près : rien n'est
// ajouté à l'oral.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

export class ErreurAudio extends Error {}

export function configAudio() {
  return {
    bin: process.env.PIPER_BIN || 'piper',
    modele: process.env.PIPER_MODELE || null,
    delaiMs: Number(process.env.PIPER_TIMEOUT_MS || 120000),
  };
}

export const audioDisponible = () => Boolean(configAudio().modele);

// Le texte tel qu'il sera lu : guillemets retirés (lus comme des pauses
// bizarres), « / » des intitulés (« coiffeur / coiffeuse ») lu « ou ».
export function texteALire(texte) {
  return String(texte)
    .replace(/[«»“”"]/g, '')
    .replace(/\s+\/\s+/g, ' ou ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?])/g, '$1')
    .trim();
}

// Empreinte d'un audio : texte lu + voix. Sert de nom de fichier en cache.
export function empreinteAudio(texte) {
  return crypto.createHash('sha256').update(JSON.stringify([texteALire(texte), configAudio().modele])).digest('hex').slice(0, 16);
}

export const EMPREINTE_VALIDE = /^[0-9a-f]{16}$/;

// Lance Piper : le texte sur l'entrée standard, un fichier WAV en sortie.
function lancerPiper(texte, sortie) {
  const { bin, modele, delaiMs } = configAudio();
  return new Promise((resolve, reject) => {
    let erreur = '';
    let proc;
    try {
      proc = spawn(bin, ['--model', modele, '--output_file', sortie], { stdio: ['pipe', 'ignore', 'pipe'] });
    } catch (e) {
      return reject(new ErreurAudio(`Piper introuvable (${e.message})`));
    }
    const minuterie = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new ErreurAudio('synthèse vocale trop longue'));
    }, delaiMs);
    proc.stderr.on('data', (d) => (erreur = (erreur + d).slice(-500)));
    proc.on('error', (e) => {
      clearTimeout(minuterie);
      reject(new ErreurAudio(e.code === 'ENOENT' ? `Piper introuvable (${bin})` : e.message));
    });
    proc.on('close', (code) => {
      clearTimeout(minuterie);
      if (code === 0 && fs.existsSync(sortie) && fs.statSync(sortie).size > 44) resolve();
      else reject(new ErreurAudio(`Piper a échoué (code ${code}) ${erreur.trim()}`.trim()));
    });
    proc.stdin.on('error', () => {}); // Piper fermé avant la fin de l'écriture : géré par « close »
    proc.stdin.end(texteALire(texte) + '\n');
  });
}

// Synthèses en cours, pour ne pas lancer deux fois Piper sur le même texte.
const enCours = new Map();

// Fichier WAV du texte, créé au premier appel puis relu depuis `dossier`.
export async function fichierAudio(texte, dossier, nom) {
  const cible = path.join(dossier, `${nom}.wav`);
  if (fs.existsSync(cible)) return cible;
  if (!enCours.has(cible)) {
    const temporaire = `${cible}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    const tache = (async () => {
      fs.mkdirSync(dossier, { recursive: true });
      try {
        await lancerPiper(texte, temporaire);
        fs.renameSync(temporaire, cible);
        return cible;
      } finally {
        fs.rmSync(temporaire, { force: true });
        enCours.delete(cible);
      }
    })();
    enCours.set(cible, tache);
  }
  return enCours.get(cible);
}
