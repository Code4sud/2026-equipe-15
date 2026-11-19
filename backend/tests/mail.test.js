// Tests du mail du lien (.eml) et des liens de recherche des pages métier.
// Adresses et métiers inventés ; aucun mail n'est envoyé, aucun site appelé.

import test from 'node:test';
import assert from 'node:assert/strict';
import { construireMail, adresseValide, texteDuMail, dateEnFrancais, SUJET } from '../src/mail.js';
import { liensMetier, SITES } from '../src/report/liensMetiers.js';

const LIEN = `http://localhost:5173/#/?r=${'c'.repeat(32)}`;
const MAIL = {
  destinataire: 'jeune.fictif@exemple.invalid',
  expediteur: 'Possibles.AI <ne-pas-repondre@possibles.invalid>',
  lien: LIEN,
  expireLe: '2027-11-20T09:00:00.000Z',
  date: new Date('2026-11-20T09:00:00Z'),
};

test('mail : en-têtes, sujet encodé, lien et date d’expiration en français', () => {
  const eml = construireMail(MAIL);
  const fin = eml.indexOf('\r\n\r\n'); // la première ligne vide sépare les en-têtes du texte
  const entetes = eml.slice(0, fin);
  const corps = eml.slice(fin + 4);
  assert.match(entetes, /^From: Possibles\.AI <ne-pas-repondre@possibles\.invalid>\r\n/);
  assert.match(entetes, /\r\nTo: jeune\.fictif@exemple\.invalid\r\n/);
  const sujet = entetes.match(/\r\nSubject: =\?UTF-8\?B\?([^?]+)\?=\r\n/);
  assert.equal(Buffer.from(sujet[1], 'base64').toString('utf8'), SUJET);
  assert.match(entetes, /\r\nDate: Fri, 20 Nov 2026 09:00:00 GMT\r\n/);
  assert.match(entetes, /\r\nContent-Type: text\/plain; charset=utf-8\r\n/);
  assert.ok(corps.includes(`\r\n${LIEN}\r\n`));
  assert.ok(corps.includes("valable jusqu'au 20 novembre 2027"));
  assert.equal(corps, texteDuMail(MAIL));
});

test('mail : le texte tutoie et applique les règles du produit', () => {
  const texte = texteDuMail(MAIL);
  assert.match(texte, /Ce lien est personnel/);
  assert.match(texte, /image à un moment donné/);
  assert.match(texte, /pistes, pas des consignes/);
  assert.doesNotMatch(texte, /\b(vous|votre|vos)\b/i);
});

test('mail : adresse invalide ou tentative d’ajout d’en-tête refusée', () => {
  for (const mauvaise of ['', 'sans-arobase', 'a@b', 'a b@c.fr', 'a@c.fr\r\nBcc: x@y.fr', 'a@c.fr\nBcc: x@y.fr', null]) {
    assert.equal(adresseValide(mauvaise), false, String(mauvaise));
    assert.throws(() => construireMail({ ...MAIL, destinataire: mauvaise }));
  }
  assert.ok(adresseValide('prenom.nom+test@exemple.fr'));
  assert.throws(() => construireMail({ ...MAIL, expediteur: 'X\r\nBcc: y@z.fr' }));
  assert.throws(() => construireMail({ ...MAIL, lien: `${LIEN}\r\nBcc: y@z.fr` }));
});

test('date en français, à l’heure de Paris', () => {
  assert.equal(dateEnFrancais('2027-01-01T23:30:00Z'), '2 janvier 2027');
});

test('pages métier : trois liens de recherche, nom encodé, rien sans nom', () => {
  const liens = liensMetier('  Métier  fictif & co ');
  assert.deepEqual(liens.map((l) => l.site), ['onisep', 'orientation-regionsud', 'france-travail']);
  assert.equal(liens[0].url, `${SITES.onisep}M%C3%A9tier%20fictif%20%26%20co`);
  assert.equal(liens[1].url, 'https://www.orientation-regionsud.fr/metiers');
  assert.equal(liens[2].url, `${SITES.franceTravail}M%C3%A9tier%20fictif%20%26%20co`);
  for (const l of liens) {
    assert.ok(l.titre);
    assert.match(l.url, /^https:\/\//);
  }
  assert.deepEqual(liensMetier(''), []);
  assert.deepEqual(liensMetier(null), []);
});
