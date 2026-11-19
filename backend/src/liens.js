// Liens envoyés par mail : chaque rapport est désigné par un jeton aléatoire
// de 32 caractères hexadécimaux (128 bits), impossible à deviner. Sans
// authentification, ce jeton est la seule protection du rapport : il ne
// doit jamais être dérivé du numéro de rapport ni listé par l'API.
//
// Les liens sont rangés dans la base SQLite (voir base.js), avec une date
// d'expiration (1 an par défaut), une révocation possible et la trace de la
// suppression des données. Un lien expiré, révoqué ou supprimé reçoit le même
// 404 qu'un jeton inconnu.
//
// L'ancienne table prive/liens.json ({ "<jeton>": "rapport.pdf" }) est lue,
// jamais modifiée : un jeton qui n'est que dans liens.json est repris dans la
// base à sa première utilisation (ou par npm run migrer), avec une validité
// d'un an à partir de la reprise. Les liens déjà envoyés restent donc valables.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';
import { base } from './base.js';
import { dossiersStockage } from './storage.js';

export const JETON_VALIDE = /^[0-9a-f]{32}$/;
const JOUR_MS = 24 * 60 * 60 * 1000;

// Un simple nom de fichier PDF, rien d'autre : pas de « ../ » ni de chemin.
const nomValide = (nom) => typeof nom === 'string' && nom === path.basename(nom) && nom.toLowerCase().endsWith('.pdf');
const iso = (date) => date.toISOString();
const expiration = (depuis) => new Date(depuis.getTime() + config.lienDureeJours * JOUR_MS);

function lireAncienneTable() {
  if (!fs.existsSync(config.liensFichier)) return {};
  try {
    const table = JSON.parse(fs.readFileSync(config.liensFichier, 'utf8'));
    return table && typeof table === 'object' ? table : {};
  } catch (e) {
    console.error(`liens.json illisible : ${e.message}`);
    return {};
  }
}

const ligne = (jeton) => base().prepare('SELECT * FROM liens WHERE jeton = ?').get(jeton);

function inserer(jeton, fichier, maintenant) {
  base()
    .prepare('INSERT OR IGNORE INTO liens (jeton, fichier, cree_le, expire_le) VALUES (?, ?, ?, ?)')
    .run(jeton, fichier, iso(maintenant), iso(expiration(maintenant)));
}

// Reprend un jeton de liens.json absent de la base. null s'il n'y est pas.
function reprendre(jeton, maintenant) {
  const table = lireAncienneTable();
  if (!Object.hasOwn(table, jeton) || !nomValide(table[jeton])) return null;
  inserer(jeton, table[jeton], maintenant);
  return ligne(jeton);
}

const trouver = (jeton, maintenant) =>
  typeof jeton === 'string' && JETON_VALIDE.test(jeton) ? ligne(jeton) ?? reprendre(jeton, maintenant) : null;

// État d'un lien : actif, expire, revoque, supprime ou inconnu.
export function etatLien(lien, maintenant = new Date()) {
  if (!lien) return 'inconnu';
  if (lien.supprime_le) return 'supprime';
  if (lien.revoque_le) return 'revoque';
  if (new Date(lien.expire_le) <= maintenant) return 'expire';
  return 'actif';
}

// Le lien et son état, pour les scripts (jamais servi par l'API).
export function infoLien(jeton, maintenant = new Date()) {
  const lien = trouver(jeton, maintenant);
  return lien ? { ...lien, etat: etatLien(lien, maintenant) } : null;
}

// Chemin du PDF désigné par un jeton actif, ou null (jeton mal formé, inconnu,
// expiré, révoqué, supprimé, ou fichier hors du dossier des rapports).
export function rapportDuJeton(jeton, maintenant = new Date()) {
  const lien = trouver(jeton, maintenant);
  if (etatLien(lien, maintenant) !== 'actif' || !nomValide(lien.fichier)) return null;
  const chemin = path.join(config.rapportsDir, lien.fichier);
  return fs.existsSync(chemin) ? chemin : null;
}

// Crée (ou retrouve) le lien actif d'un rapport du dossier des rapports.
export function creerLien(nomFichier, maintenant = new Date()) {
  const nom = path.basename(nomFichier);
  if (!nom.toLowerCase().endsWith('.pdf')) throw new Error(`${nom} : ce n'est pas un PDF`);
  if (!fs.existsSync(path.join(config.rapportsDir, nom))) {
    throw new Error(`${nom} : absent de ${config.rapportsDir}`);
  }
  migrerLiens(maintenant); // un lien déjà envoyé (liens.json) est retrouvé plutôt que doublé
  const actif = base()
    .prepare(
      'SELECT jeton FROM liens WHERE fichier = ? AND revoque_le IS NULL AND supprime_le IS NULL AND expire_le > ? ORDER BY cree_le LIMIT 1'
    )
    .get(nom, iso(maintenant));
  if (actif) return { jeton: actif.jeton, nouveau: false };
  const jeton = crypto.randomBytes(16).toString('hex');
  inserer(jeton, nom, maintenant);
  return { jeton, nouveau: true };
}

// Reprend dans la base tous les jetons de liens.json, sans modifier ce fichier.
export function migrerLiens(maintenant = new Date()) {
  const bilan = { repris: 0, deja: 0, ignores: 0 };
  for (const [jeton, fichier] of Object.entries(lireAncienneTable())) {
    if (!JETON_VALIDE.test(jeton) || !nomValide(fichier)) bilan.ignores++;
    else if (ligne(jeton)) bilan.deja++;
    else {
      inserer(jeton, fichier, maintenant);
      bilan.repris++;
    }
  }
  return bilan;
}

// Supprime les fichiers générés pour un jeton dans storage/outputs : analyse,
// résumés, textes et audios ({jeton}.json, {jeton}-…). Renvoie leur nombre.
export function supprimerCache(jeton) {
  if (!JETON_VALIDE.test(jeton)) return 0;
  const { outputs } = dossiersStockage();
  if (!fs.existsSync(outputs)) return 0;
  let n = 0;
  for (const f of fs.readdirSync(outputs)) {
    if (f === `${jeton}.json` || f.startsWith(`${jeton}-`)) {
      fs.rmSync(path.join(outputs, f), { force: true });
      n++;
    }
  }
  return n;
}

// Révoque un lien (le jeton reçoit aussitôt 404) et supprime son cache.
// Renvoie null si le jeton est inconnu, sinon l'état d'avant et le cache supprimé.
export function revoquerLien(jeton, maintenant = new Date()) {
  const lien = trouver(jeton, maintenant);
  if (!lien) return null;
  const avant = etatLien(lien, maintenant);
  if (avant === 'actif' || avant === 'expire') {
    base().prepare('UPDATE liens SET revoque_le = ? WHERE jeton = ?').run(iso(maintenant), jeton);
  }
  return { etat_avant: avant, fichiers_supprimes: supprimerCache(jeton) };
}

// Suppression des données des liens expirés (1 an après la création par
// défaut) : cache de storage/outputs, puis le PDF s'il n'a plus aucun lien
// actif. La ligne est gardée avec supprime_le. Sans `confirmer`, rien n'est
// supprimé : la liste dit seulement ce qui le serait.
export function purgerLiens({ maintenant = new Date(), confirmer = false } = {}) {
  const expires = base()
    .prepare('SELECT * FROM liens WHERE supprime_le IS NULL AND expire_le <= ? ORDER BY expire_le')
    .all(iso(maintenant));
  const actifSurFichier = base().prepare(
    'SELECT 1 FROM liens WHERE fichier = ? AND supprime_le IS NULL AND revoque_le IS NULL AND expire_le > ? LIMIT 1'
  );
  return expires.map((lien) => {
    const pdf = nomValide(lien.fichier) ? path.join(config.rapportsDir, lien.fichier) : null;
    const garderPdf = !pdf || !fs.existsSync(pdf) || Boolean(actifSurFichier.get(lien.fichier, iso(maintenant)));
    const r = { jeton: lien.jeton, fichier: lien.fichier, expire_le: lien.expire_le, pdf_supprime: false, fichiers_supprimes: 0 };
    if (!confirmer) return { ...r, pdf_supprime: !garderPdf };
    r.fichiers_supprimes = supprimerCache(lien.jeton);
    if (!garderPdf) {
      fs.rmSync(pdf, { force: true });
      r.pdf_supprime = true;
    }
    base().prepare('UPDATE liens SET supprime_le = ? WHERE jeton = ?').run(iso(maintenant), lien.jeton);
    return r;
  });
}

// Adresse du site à mettre dans le mail : le front lit le jeton dans #/?r=.
export function adresseDuLien(jeton) {
  return `${config.siteUrl}#/?r=${jeton}`;
}
