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
  // Ancienne table jeton -> fichier PDF, lue sans être modifiée (voir liens.js).
  get liensFichier() {
    return process.env.LIENS_FICHIER || path.join(this.rapportsDir, 'liens.json');
  },
  // Base SQLite des liens, à côté de liens.json (par défaut prive/possibles.db).
  get baseFichier() {
    return process.env.BASE_FICHIER || path.join(path.dirname(this.liensFichier), 'possibles.db');
  },
  // Durée de validité d'un lien, en jours (1 an par défaut).
  get lienDureeJours() {
    const n = Number(process.env.LIEN_DUREE_JOURS || 365);
    return Number.isFinite(n) && n > 0 ? n : 365;
  },
  // Adresse du site, pour le lien du mail : <SITE_URL>#/?r=<jeton>.
  get siteUrl() {
    return (process.env.SITE_URL || 'http://localhost:5173/').replace(/\/*$/, '/');
  },
  // Mails préparés (.eml) : dossier et expéditeur.
  get mailsDir() {
    return process.env.MAILS_DIR || path.join(this.rapportsDir, 'mails');
  },
  get mailExpediteur() {
    return process.env.MAIL_EXPEDITEUR || 'Possibles.AI <ne-pas-repondre@possibles.invalid>';
  },
  // Table des métiers O*NET en français (tableur du Centre, dans prive/).
  get onetFichier() {
    return process.env.ONET_FICHIER || path.join(this.rapportsDir, 'table-metiers-onet-fr-jobzones.xlsx');
  },
};
