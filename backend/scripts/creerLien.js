// Crée le lien d'un rapport rangé dans prive/, à mettre dans le mail du jeune.
//
//     npm run lien -- rapport-des-possibles-XXXX.pdf
//
// Le jeton est rangé dans la base prive/possibles.db (ignorée par git), avec sa
// date d'expiration (1 an par défaut, LIEN_DUREE_JOURS). Relancer la commande
// pour un même rapport redonne le même jeton tant que le lien est actif.

import 'dotenv/config';
import { creerLien, infoLien, adresseDuLien } from '../src/liens.js';
import { dateEnFrancais } from '../src/mail.js';
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
    console.log(`  valable jusqu'au ${dateEnFrancais(infoLien(jeton).expire_le)}`);
    console.log(`  site : ${adresseDuLien(jeton)}`);
    console.log(`  API  : http://localhost:${config.port}/report/${jeton}`);
  } catch (e) {
    console.error(e.message);
    erreurs++;
  }
}
process.exit(erreurs ? 1 : 0);
