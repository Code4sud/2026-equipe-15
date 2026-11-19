// Tests de la base des liens (SQLite) : création, expiration, révocation,
// reprise de l'ancien liens.json et purge. Aucun vrai rapport : les « PDF »
// sont des fichiers vides, dans un dossier temporaire supprimé à la fin. Ces
// tests tournent aussi sur GitHub.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'liens-test-'));
const RAPPORTS = path.join(TMP, 'rapports');
const OUTPUTS = path.join(TMP, 'outputs');
process.env.BACKEND_STORAGE = TMP;
process.env.RAPPORTS_DIR = RAPPORTS;
process.env.LIENS_FICHIER = path.join(TMP, 'liens.json');
delete process.env.BASE_FICHIER;
delete process.env.LIEN_DUREE_JOURS;

const liens = await import('../src/liens.js');
const { base, fermerBases } = await import('../src/base.js');
const { config } = await import('../src/config.js');
const { default: app } = await import('../server.js');
const { creerLien, rapportDuJeton, infoLien, revoquerLien, purgerLiens, migrerLiens, adresseDuLien } = liens;

test.after(() => {
  fermerBases();
  fs.rmSync(TMP, { recursive: true, force: true });
});

const JOUR = 24 * 60 * 60 * 1000;
const T0 = new Date('2026-11-20T09:00:00Z');
const plus = (jours) => new Date(T0.getTime() + jours * JOUR);

let n = 0;
// Un faux PDF (fichier vide) au nom unique dans le dossier des rapports.
function fauxPdf() {
  fs.mkdirSync(RAPPORTS, { recursive: true });
  const nom = `fictif-${++n}.pdf`;
  fs.writeFileSync(path.join(RAPPORTS, nom), '');
  return nom;
}
// Des fichiers en cache pour un jeton, comme ceux des routes /report.
function cache(jeton) {
  fs.mkdirSync(OUTPUTS, { recursive: true });
  const noms = [`${jeton}.json`, `${jeton}-resume-0123456789abcdef.json`, `${jeton}-audio-0123456789abcdef.wav`];
  for (const f of noms) fs.writeFileSync(path.join(OUTPUTS, f), '{}');
  return noms;
}
const enCache = (jeton) => (fs.existsSync(OUTPUTS) ? fs.readdirSync(OUTPUTS).filter((f) => f.startsWith(jeton)) : []);

test('base : un fichier SQLite à côté de liens.json, table liens créée', () => {
  assert.equal(config.baseFichier, path.join(TMP, 'possibles.db'));
  creerLien(fauxPdf(), T0);
  assert.ok(fs.existsSync(config.baseFichier));
  const colonnes = base().prepare('PRAGMA table_info(liens)').all().map((c) => c.name);
  assert.deepEqual(colonnes, ['jeton', 'fichier', 'cree_le', 'expire_le', 'revoque_le', 'supprime_le']);
});

test('lien : jeton aléatoire, stable pour un même rapport, valable 1 an', () => {
  const nom = fauxPdf();
  const a = creerLien(nom, T0);
  assert.match(a.jeton, /^[0-9a-f]{32}$/);
  assert.equal(a.nouveau, true);
  assert.deepEqual(creerLien(nom, plus(10)), { jeton: a.jeton, nouveau: false });
  const info = infoLien(a.jeton, T0);
  assert.equal(info.fichier, nom);
  assert.equal(info.etat, 'actif');
  assert.equal(info.cree_le, T0.toISOString());
  assert.equal(info.expire_le, plus(365).toISOString());
  assert.equal(rapportDuJeton(a.jeton, T0), path.join(RAPPORTS, nom));
  assert.notEqual(creerLien(fauxPdf(), T0).jeton, a.jeton);
  assert.throws(() => creerLien('absent.pdf', T0));
  assert.throws(() => creerLien('note.txt', T0));
  assert.equal(adresseDuLien(a.jeton), `http://localhost:5173/#/?r=${a.jeton}`);
});

test('expiration : le lien ne marche plus après 1 an, un nouveau lien est alors créé', () => {
  const nom = fauxPdf();
  const { jeton } = creerLien(nom, T0);
  assert.ok(rapportDuJeton(jeton, plus(364)));
  assert.equal(rapportDuJeton(jeton, plus(365)), null);
  assert.equal(infoLien(jeton, plus(366)).etat, 'expire');
  const nouveau = creerLien(nom, plus(366));
  assert.equal(nouveau.nouveau, true);
  assert.notEqual(nouveau.jeton, jeton);
});

test('durée réglable : LIEN_DUREE_JOURS', () => {
  process.env.LIEN_DUREE_JOURS = '30';
  try {
    const { jeton } = creerLien(fauxPdf(), T0);
    assert.equal(infoLien(jeton, T0).expire_le, plus(30).toISOString());
  } finally {
    delete process.env.LIEN_DUREE_JOURS;
  }
});

test('révocation : 404 aussitôt, cache supprimé, PDF gardé, cache des autres intact', () => {
  const nom = fauxPdf();
  const { jeton } = creerLien(nom, T0);
  const autre = creerLien(fauxPdf(), T0).jeton;
  cache(jeton);
  cache(autre);
  assert.deepEqual(revoquerLien(jeton, plus(1)), { etat_avant: 'actif', fichiers_supprimes: 3 });
  assert.equal(rapportDuJeton(jeton, plus(1)), null);
  assert.equal(infoLien(jeton, plus(1)).etat, 'revoque');
  assert.deepEqual(enCache(jeton), []);
  assert.equal(enCache(autre).length, 3);
  assert.ok(fs.existsSync(path.join(RAPPORTS, nom)));
  // Révoquer deux fois ne change rien ; un jeton inconnu ou mal formé : null.
  assert.equal(revoquerLien(jeton, plus(2)).etat_avant, 'revoque');
  assert.equal(revoquerLien('d'.repeat(32)), null);
  assert.equal(revoquerLien('../etc'), null);
  // Le rapport révoqué peut recevoir un nouveau lien.
  assert.notEqual(creerLien(nom, plus(2)).jeton, jeton);
});

test('liens.json : repris dans la base sans être modifié ; entrées piégées ignorées', () => {
  const nom = fauxPdf();
  const ancien = 'e'.repeat(32);
  const table = { [ancien]: nom, ['f'.repeat(32)]: '../package.json.pdf', 'pas-un-jeton': nom };
  const texte = JSON.stringify(table, null, 2);
  fs.writeFileSync(config.liensFichier, texte);

  // Un lien déjà envoyé marche toujours, et il est repris à sa première utilisation.
  assert.equal(rapportDuJeton(ancien, T0), path.join(RAPPORTS, nom));
  assert.equal(infoLien(ancien, T0).expire_le, plus(365).toISOString());
  assert.equal(rapportDuJeton('f'.repeat(32), T0), null);
  assert.equal(base().prepare('SELECT count(*) AS n FROM liens WHERE jeton = ?').get('f'.repeat(32)).n, 0);
  // creerLien retrouve le lien déjà envoyé au lieu d'en créer un second.
  assert.deepEqual(creerLien(nom, T0), { jeton: ancien, nouveau: false });

  assert.deepEqual(migrerLiens(T0), { repris: 0, deja: 1, ignores: 2 });
  assert.equal(fs.readFileSync(config.liensFichier, 'utf8'), texte);
  fs.rmSync(config.liensFichier);
});

test('purge : simulation par défaut, puis suppression du cache et du PDF des liens expirés', () => {
  const nom = fauxPdf();
  const { jeton } = creerLien(nom, plus(-400)); // expiré depuis 35 jours
  const actif = creerLien(fauxPdf(), T0).jeton;
  cache(jeton);

  const simulation = purgerLiens({ maintenant: T0 }).find((r) => r.jeton === jeton);
  assert.equal(simulation.pdf_supprime, true); // « serait supprimé »
  assert.equal(enCache(jeton).length, 3);
  assert.ok(fs.existsSync(path.join(RAPPORTS, nom)));
  assert.ok(!purgerLiens({ maintenant: T0 }).some((r) => r.jeton === actif));

  const r = purgerLiens({ maintenant: T0, confirmer: true }).find((x) => x.jeton === jeton);
  assert.deepEqual([r.pdf_supprime, r.fichiers_supprimes], [true, 3]);
  assert.deepEqual(enCache(jeton), []);
  assert.ok(!fs.existsSync(path.join(RAPPORTS, nom)));
  assert.equal(infoLien(jeton, T0).etat, 'supprime');
  assert.ok(rapportDuJeton(actif, T0));
  // Déjà purgé : n'apparaît plus.
  assert.ok(!purgerLiens({ maintenant: T0, confirmer: true }).some((x) => x.jeton === jeton));
});

test('purge : le PDF est gardé si un autre lien actif l’utilise, et un jeton purgé ne revit pas', () => {
  const nom = fauxPdf();
  const vieux = creerLien(nom, plus(-400)).jeton;
  const neuf = creerLien(nom, T0).jeton; // nouveau lien pour le même rapport
  fs.writeFileSync(config.liensFichier, JSON.stringify({ [vieux]: nom }));
  const r = purgerLiens({ maintenant: T0, confirmer: true }).find((x) => x.jeton === vieux);
  assert.equal(r.pdf_supprime, false);
  assert.ok(fs.existsSync(path.join(RAPPORTS, nom)));
  assert.ok(rapportDuJeton(neuf, T0));
  // Toujours dans liens.json, mais marqué supprimé dans la base : 404.
  assert.equal(rapportDuJeton(vieux, T0), null);
  fs.rmSync(config.liensFichier);
});

test('routes : un lien révoqué ou expiré reçoit le même 404 qu’un jeton inconnu', async () => {
  const actif = creerLien(fauxPdf()).jeton;
  const revoque = creerLien(fauxPdf()).jeton;
  revoquerLien(revoque);
  const expire = creerLien(fauxPdf(), new Date(Date.now() - 400 * JOUR)).jeton;

  const serveur = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const base = `http://127.0.0.1:${serveur.address().port}`;
    assert.equal((await fetch(`${base}/report/${actif}/pdf`)).status, 200);
    for (const jeton of [revoque, expire, 'a'.repeat(32)]) {
      for (const route of [`/report/${jeton}`, `/report/${jeton}/pdf`]) {
        const r = await fetch(`${base}${route}`);
        assert.equal(r.status, 404, route);
        assert.deepEqual(await r.json(), { detail: 'Rapport introuvable' });
      }
      const chat = await fetch(`${base}/chat/${jeton}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: 'Pourquoi ces métiers ?' }),
      });
      assert.equal(chat.status, 404);
    }
  } finally {
    serveur.close();
  }
});
