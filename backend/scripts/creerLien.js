// Crée le lien d'un rapport rangé dans prive/, à mettre dans le mail du jeune.
//
//     npm run lien -- rapport-des-possibles-XXXX.pdf
//
// Le jeton est ajouté à prive/liens.json (ignoré par git). Relancer la
// commande pour un même rapport redonne le même jeton.

import 'dotenv/config';
import { creerLien } from '../src/liens.js';
import { config } from '../src/config.js';

const fichiers = process.argv.slice(2);
if (!fichiers.length) {
  console.error('Usage : npm run lien -- <fichier.pdf> [<fichier.pdf>…]  (fichiers rangés dans prive/)');
  process.exit(1);
}

let erreurs = 0;
for (const fichier of fichiers) {
  try {
    const { jeton, nouveau } = creerLien(fichier);
    console.log(`${fichier} : ${jeton}${nouveau ? '' : ' (déjà créé)'}`);
    console.log(`  API : http://localhost:${config.port}/report/${jeton}`);
  } catch (e) {
    console.error(e.message);
    erreurs++;
  }
}
process.exit(erreurs ? 1 : 0);
