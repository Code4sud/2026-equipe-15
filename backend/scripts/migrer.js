// Reprend dans la base (prive/possibles.db) tous les jetons de l'ancienne
// table prive/liens.json. liens.json n'est pas modifié : on peut relancer la
// commande sans risque. Chaque jeton repris est valable 1 an à partir d'aujourd'hui.
//
//     npm run migrer

import 'dotenv/config';
import { migrerLiens } from '../src/liens.js';
import { config } from '../src/config.js';

const { repris, deja, ignores } = migrerLiens();
console.log(`${config.liensFichier} -> ${config.baseFichier}`);
console.log(`${repris} lien(s) repris, ${deja} déjà dans la base, ${ignores} entrée(s) ignorée(s) (jeton ou nom de fichier invalide)`);
