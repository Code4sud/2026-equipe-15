// Révoque un lien : le jeton reçoit aussitôt 404, et les analyses, résumés et
// audios générés pour lui (storage/outputs) sont supprimés. Le PDF est gardé.
//
//     npm run revoquer -- <jeton> [<jeton>…]

import 'dotenv/config';
import { revoquerLien } from '../src/liens.js';

const jetons = process.argv.slice(2);
if (!jetons.length) {
  console.error('Usage : npm run revoquer -- <jeton> [<jeton>…]');
  process.exit(1);
}

let erreurs = 0;
for (const jeton of jetons) {
  const r = revoquerLien(jeton);
  if (!r) {
    console.error(`${jeton} : jeton inconnu`);
    erreurs++;
    continue;
  }
  const deja = r.etat_avant === 'revoque' || r.etat_avant === 'supprime';
  console.log(`${jeton} : ${deja ? `déjà ${r.etat_avant === 'revoque' ? 'révoqué' : 'supprimé'}` : 'révoqué'}, ${r.fichiers_supprimes} fichier(s) en cache supprimé(s)`);
}
process.exit(erreurs ? 1 : 0);
