// Prépare le mail qui envoie son lien au jeune. Pour l'instant, le mail n'est
// pas envoyé : il est écrit dans un fichier .eml, dans prive/mails/ (ignoré par
// git, car il contient une adresse personnelle). Le lien est créé s'il
// n'existe pas encore (comme npm run lien).
//
//     npm run envoyer -- <fichier.pdf> <adresse@mail>
//
// Réglages (backend/.env) : SITE_URL (adresse du site), MAIL_EXPEDITEUR, MAILS_DIR.

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { creerLien, infoLien, adresseDuLien } from '../src/liens.js';
import { construireMail, adresseValide } from '../src/mail.js';
import { config } from '../src/config.js';

const [fichier, destinataire] = process.argv.slice(2);
if (!fichier || !destinataire) {
  console.error('Usage : npm run envoyer -- <fichier.pdf> <adresse@mail>  (fichier rangé dans prive/)');
  process.exit(1);
}
if (!adresseValide(destinataire)) {
  console.error('Adresse mail invalide.');
  process.exit(1);
}

try {
  const { jeton } = creerLien(fichier);
  const mail = construireMail({
    destinataire,
    expediteur: config.mailExpediteur,
    lien: adresseDuLien(jeton),
    expireLe: infoLien(jeton).expire_le,
  });
  fs.mkdirSync(config.mailsDir, { recursive: true });
  const horodatage = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const sortie = path.join(config.mailsDir, `${horodatage}-${jeton.slice(0, 8)}.eml`);
  fs.writeFileSync(sortie, mail, { mode: 0o600 });
  console.log(`Mail écrit : ${sortie}`);
  console.log('Il n\'a pas été envoyé : ouvre-le avec un logiciel de messagerie pour le relire ou l\'envoyer.');
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
