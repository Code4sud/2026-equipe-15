// Suppression des données au bout d'un an : pour chaque lien expiré, supprime
// les analyses, résumés et audios en cache, puis le PDF s'il n'a plus aucun
// lien actif. Le jeton reste dans la base, marqué « supprimé », et reçoit 404.
//
//     npm run purger                 # simulation : liste, ne supprime rien
//     npm run purger -- --confirmer  # supprime vraiment
//
// À lancer à la main, ou chaque nuit par une tâche planifiée (cron).

import 'dotenv/config';
import { purgerLiens } from '../src/liens.js';

const confirmer = process.argv.includes('--confirmer');
const resultats = purgerLiens({ confirmer });

if (!resultats.length) {
  console.log('Aucun lien expiré à purger.');
  process.exit(0);
}
for (const r of resultats) {
  const pdf = r.pdf_supprime ? 'PDF supprimé' : 'PDF gardé (absent, ou encore utilisé par un lien actif)';
  console.log(`${r.jeton} : expiré le ${r.expire_le.slice(0, 10)}, ${r.fichier} — ${confirmer ? pdf : pdf.replace('supprimé', 'à supprimer')}`);
}
console.log(confirmer ? `${resultats.length} lien(s) purgé(s).` : `Simulation : rien n'a été supprimé. Relancer avec « npm run purger -- --confirmer ».`);
