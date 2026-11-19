// Point d'entrée Express — Rapport des Possibles augmenté (équipe 15).
//
// Lancement en local :
//     cd backend
//     npm start            # ou : node server.js  (PORT=8000 par défaut)
//
// Authentification : voir src/auth.js — API_TOKEN dans backend/.env.
// Si API_TOKEN est défini, chaque requête exige « Authorization: Bearer <token> ».
// Sinon mode dev ouvert. Voir .env.example.

import 'dotenv/config';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import express from 'express';
import cors from 'cors';
import { config } from './src/config.js';
import { verifierToken } from './src/auth.js';
import { router as reportRouter } from './src/routes/report.js';

const app = express();

// En local / démo, la page peut être servie depuis un autre port (GitHub
// Pages, Vite…) : on autorise les requêtes cross-origin. En production,
// restreindre via CORS_ALLOW_ORIGINS (séparées par des virgules).
app.use(cors({ origin: config.corsAllowOrigins.includes('*') ? true : config.corsAllowOrigins }));

app.use(express.json({ limit: '1mb' }));
app.use(verifierToken);

app.use('/report', reportRouter);

app.get('/', (req, res) => {
  res.json({
    projet: 'Rapport des Possibles augmenté — équipe 15',
    auth: config.apiToken ? 'active' : 'desactivee (mode dev)',
    routes: ['/report', '/report/upload'],
  });
});

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  app.listen(config.port, () => console.log(`API Rapport des Possibles sur http://localhost:${config.port}`));
}

export default app;
