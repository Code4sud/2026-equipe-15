// Liens envoyés par mail : chaque rapport est désigné par un jeton aléatoire
// de 32 caractères hexadécimaux (128 bits), impossible à deviner. Sans
// authentification, ce jeton est la seule protection du rapport : il ne
// doit jamais être dérivé du numéro de rapport ni listé par l'API.
//
// La table jeton -> fichier PDF est un JSON rangé avec les rapports, dans
// prive/ (ignoré par git) :
//     { "<jeton>": "nom-du-rapport.pdf", ... }

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';

export const JETON_VALIDE = /^[0-9a-f]{32}$/;

function lireTable() {
  if (!fs.existsSync(config.liensFichier)) return {};
  return JSON.parse(fs.readFileSync(config.liensFichier, 'utf8'));
}

// Chemin du PDF désigné par un jeton, ou null (jeton mal formé, inconnu, ou
// fichier hors du dossier des rapports).
export function rapportDuJeton(jeton) {
  if (!JETON_VALIDE.test(jeton)) return null;
  const table = lireTable();
  if (!Object.hasOwn(table, jeton)) return null;
  const nom = table[jeton];
  // Un simple nom de fichier PDF, rien d'autre : pas de « ../ » ni de chemin.
  if (typeof nom !== 'string' || nom !== path.basename(nom) || !nom.toLowerCase().endsWith('.pdf')) return null;
  const chemin = path.join(config.rapportsDir, nom);
  return fs.existsSync(chemin) ? chemin : null;
}

// Crée (ou retrouve) le jeton d'un rapport du dossier des rapports.
export function creerLien(nomFichier) {
  const nom = path.basename(nomFichier);
  if (!nom.toLowerCase().endsWith('.pdf')) throw new Error(`${nom} : ce n'est pas un PDF`);
  if (!fs.existsSync(path.join(config.rapportsDir, nom))) {
    throw new Error(`${nom} : absent de ${config.rapportsDir}`);
  }
  const table = lireTable();
  const existant = Object.keys(table).find((j) => table[j] === nom);
  if (existant) return { jeton: existant, nouveau: false };
  const jeton = crypto.randomBytes(16).toString('hex');
  table[jeton] = nom;
  fs.mkdirSync(path.dirname(config.liensFichier), { recursive: true });
  fs.writeFileSync(config.liensFichier, JSON.stringify(table, null, 2) + '\n');
  return { jeton, nouveau: true };
}
