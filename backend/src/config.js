// Configuration : toutes les variables d'environnement, lues une seule fois.
// Voir .env.example (copié en .env en local, jamais versionné).

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env.PORT || 8000),
  // Auth Bearer : si défini, chaque requête exige « Authorization: Bearer <token> ».
  // Laissé vide en dev : l'API est alors ouverte (les tests passent sans token).
  // Lu à chaque appel (getter) : les tests peuvent changer API_TOKEN à chaud.
  get apiToken() {
    return process.env.API_TOKEN || null;
  },
  // Origines CORS autorisées (séparées par des virgules, « * » = toutes, défaut)
  corsAllowOrigins: (process.env.CORS_ALLOW_ORIGINS || '*').split(',').map((s) => s.trim()),
  // Dossier de stockage des PDF déposés et des analyses générées
  storage: process.env.BACKEND_STORAGE || path.join(__dirname, '..', 'storage'),
  // Taille maximale d'un PDF accepté, en octets (20 Mo par défaut, et de toute
  // façon sous les 50 Mo interdits dans le dépôt)
  maxUploadOctets: (parseInt(process.env.MAX_UPLOAD_MO || '20', 10)) * 1024 * 1024,
};
