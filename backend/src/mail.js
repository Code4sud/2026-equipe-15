// Le mail qui envoie son lien au jeune, après son passage au Centre. Pour
// l'instant, il n'est pas envoyé : il est écrit dans un fichier .eml (ouvrable
// avec n'importe quel logiciel de messagerie), rangé dans prive/mails/ (ignoré
// par git), car il contient une adresse personnelle. Voir scripts/envoyerLien.js.

import crypto from 'node:crypto';

// Une adresse simple, sans retour à la ligne : rien ne peut être ajouté aux en-têtes.
const ADRESSE = /^[^\s@<>()",;:\\]+@[^\s@<>()",;:\\]+\.[^\s@<>()",;:\\]+$/;
export const adresseValide = (adresse) => typeof adresse === 'string' && adresse.length <= 254 && ADRESSE.test(adresse);

// En-tête avec accents (RFC 2047).
const entete = (texte) => `=?UTF-8?B?${Buffer.from(texte, 'utf8').toString('base64')}?=`;

export const SUJET = 'Ton Rapport des Possibles';

export function dateEnFrancais(date) {
  return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
}

export function texteDuMail({ lien, expireLe }) {
  return [
    'Bonjour,',
    '',
    'Merci pour ton passage au Centre des Possibles.',
    "Ton Rapport des Possibles t'attend ici, avec un résumé et un assistant pour t'aider à le relire :",
    '',
    lien,
    '',
    "Ce lien est personnel : ne le partage qu'avec les personnes de ton choix.",
    `Il reste valable jusqu'au ${dateEnFrancais(expireLe)}. Ensuite, ton rapport et ses analyses seront supprimés.`,
    '',
    'Tes résultats sont une image à un moment donné : ce sont des pistes, pas des consignes.',
    'Si tu as des questions, le psychologue ou un conseiller du Centre peut t\'aider.',
    '',
    'À bientôt !',
    "L'équipe Possibles.AI",
    '',
  ].join('\r\n');
}

export function construireMail({ destinataire, expediteur, lien, expireLe, date = new Date() }) {
  if (!adresseValide(destinataire)) throw new Error('adresse du destinataire invalide');
  if (/[\r\n]/.test(expediteur) || /[\r\n]/.test(lien)) throw new Error('retour à la ligne interdit dans un en-tête ou un lien');
  return [
    `From: ${expediteur}`,
    `To: ${destinataire}`,
    `Subject: ${entete(SUJET)}`,
    `Date: ${new Date(date).toUTCString()}`,
    `Message-ID: <${crypto.randomBytes(12).toString('hex')}@possibles.invalid>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    texteDuMail({ lien, expireLe }),
  ].join('\r\n');
}
