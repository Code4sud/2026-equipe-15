// Configuration : toutes les variables d'environnement, lues une seule fois.
// Voir .env.example (copié en .env en local, jamais versionné).

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env.PORT || 8000),
  // Origines CORS autorisées (séparées par des virgules, « * » = toutes, défaut)
  corsAllowOrigins: (process.env.CORS_ALLOW_ORIGINS || '*').split(',').map((s) => s.trim()),
  // Lus à chaque appel (getters) : les tests les changent à chaud.
  // Dossier des analyses générées (cache JSON, jamais versionné)
  get storage() {
    return process.env.BACKEND_STORAGE || path.join(__dirname, '..', 'storage');
  },
  // Dossier des Rapports des Possibles (PDF) : notre « base » de rapports.
  // Par défaut prive/ à la racine du dépôt, ignoré par git.
  get rapportsDir() {
    return process.env.RAPPORTS_DIR || path.join(__dirname, '..', '..', 'prive');
  },
  // Table jeton -> fichier PDF (un jeton par lien envoyé par mail).
  get liensFichier() {
    return process.env.LIENS_FICHIER || path.join(this.rapportsDir, 'liens.json');
  },
  // Table des métiers O*NET en français (tableur du Centre, dans prive/).
  get onetFichier() {
    return process.env.ONET_FICHIER || path.join(this.rapportsDir, 'table-metiers-onet-fr-jobzones.xlsx');
  },
};
