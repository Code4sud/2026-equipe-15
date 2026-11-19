// Point d'entrée Express — Rapport des Possibles augmenté (équipe 15).
//
// Lancement en local :
//     cd backend
//     npm start            # ou : node server.js  (PORT=8000 par défaut)
//
// Pas d'authentification : le jeune ouvre sa page depuis un lien reçu par
// mail, qui porte un jeton aléatoire (voir src/liens.js et `npm run lien`).

import 'dotenv/config';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import express from 'express';
import cors from 'cors';
import { config } from './src/config.js';
import { router as reportRouter } from './src/routes/report.js';
import { router as chatRouter } from './src/routes/chat.js';

const app = express();

// En local / démo, la page peut être servie depuis un autre port (GitHub
// Pages, Vite…) : on autorise les requêtes cross-origin. En production,
// restreindre via CORS_ALLOW_ORIGINS (séparées par des virgules).
app.use(cors({ origin: config.corsAllowOrigins.includes('*') ? true : config.corsAllowOrigins }));

app.use(express.json({ limit: '1mb' }));

app.use('/report', reportRouter);
app.use('/chat', chatRouter);

app.get('/', (req, res) => {
  res.json({
    projet: 'Rapport des Possibles augmenté — équipe 15',
    routes: ['/report/{jeton}', '/report/{jeton}/scores', 'POST /chat/{jeton}'],
  });
});

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  app.listen(config.port, () => console.log(`API Rapport des Possibles sur http://localhost:${config.port}`));
}

export default app;
