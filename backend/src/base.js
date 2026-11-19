// Base des liens : SQLite, avec le module node:sqlite intégré à Node (22.13 ou
// plus récent), sans dépendance. Un seul fichier, par défaut prive/possibles.db
// (ignoré par git), à côté de l'ancienne table prive/liens.json, qui n'est
// jamais modifiée (voir liens.js).
//
// Table `liens` : un jeton par lien envoyé par mail.
//   jeton       32 caractères hexadécimaux, la seule clé du rapport
//   fichier     nom du PDF dans le dossier des rapports
//   cree_le     date de création (ISO, UTC)
//   expire_le   date d'expiration (LIEN_DUREE_JOURS après la création, 1 an par défaut)
//   revoque_le  date de révocation (npm run revoquer), sinon NULL
//   supprime_le date de la suppression des données (npm run purger), sinon NULL :
//               la ligne est gardée, pour qu'un jeton supprimé ne revive jamais.

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS liens (
  jeton       TEXT PRIMARY KEY CHECK (length(jeton) = 32),
  fichier     TEXT NOT NULL,
  cree_le     TEXT NOT NULL,
  expire_le   TEXT NOT NULL,
  revoque_le  TEXT,
  supprime_le TEXT
);
CREATE INDEX IF NOT EXISTS liens_fichier ON liens (fichier);
`;

// Une connexion par fichier (les tests changent de dossier d'un fichier à l'autre).
const ouvertes = new Map();

export function base() {
  const chemin = config.baseFichier;
  let db = ouvertes.get(chemin);
  if (!db) {
    fs.mkdirSync(path.dirname(chemin), { recursive: true });
    db = new DatabaseSync(chemin);
    db.exec(SCHEMA);
    ouvertes.set(chemin, db);
  }
  return db;
}

export function fermerBases() {
  for (const db of ouvertes.values()) db.close();
  ouvertes.clear();
}
