// Tests des routes /report de bout en bout : un rapport de prive/ (ignoré par
// git) est désigné par un jeton, comme dans le lien envoyé par mail. Les tests
// qui ont besoin d'un PDF sont sautés si prive/ est vide, et ne vérifient que
// des invariants — aucune valeur tirée d'un rapport n'est écrite ici.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PRIVE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'prive');
const pdfs = fs.existsSync(PRIVE) ? fs.readdirSync(PRIVE).filter((f) => f.toLowerCase().endsWith('.pdf')).sort() : [];
const sansPdf = pdfs.length ? false : 'aucun PDF dans prive/';

// Stockage et table des liens temporaires : ni storage/outputs ni
// prive/liens.json ne sont touchés. Tout est supprimé à la fin.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-test-'));
process.env.BACKEND_STORAGE = TMP;
process.env.RAPPORTS_DIR = PRIVE;
process.env.LIENS_FICHIER = path.join(TMP, 'liens.json');
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const { default: app } = await import('../server.js');
const { creerLien, rapportDuJeton } = await import('../src/liens.js');

async function avecServeur(fn) {
  const serveur = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    await fn(`http://127.0.0.1:${serveur.address().port}`);
  } finally {
    serveur.close();
  }
}

test('lien : jeton aléatoire de 32 caractères, stable pour un même rapport', { skip: sansPdf }, () => {
  const a = creerLien(pdfs[0]);
  assert.match(a.jeton, /^[0-9a-f]{32}$/);
  const b = creerLien(pdfs[0]);
  assert.deepEqual(b, { jeton: a.jeton, nouveau: false });
  assert.equal(rapportDuJeton(a.jeton), path.join(PRIVE, pdfs[0]));
  assert.throws(() => creerLien('absent.pdf'));
  assert.throws(() => creerLien('note.txt'));
});

test('GET /report/{jeton} : analyse du rapport, puis relue depuis le cache', { skip: sansPdf }, async () => {
  const { jeton } = creerLien(pdfs[0]);
  await avecServeur(async (base) => {
    const r = await fetch(`${base}/report/${jeton}`);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
    const analyse = await r.json();
    assert.equal(analyse.id, jeton);
    assert.ok(analyse.rdv);
    assert.ok(analyse.metiers.length > 0);

    // L'analyse est mise en cache, et la seconde lecture est identique
    assert.ok(fs.existsSync(path.join(TMP, 'outputs', `${jeton}.json`)));
    assert.deepEqual(await (await fetch(`${base}/report/${jeton}`)).json(), analyse);

    // Les scores des trois graphiques, avec leurs sources
    const rs = await (await fetch(`${base}/report/${jeton}/scores`)).json();
    assert.deepEqual(Object.keys(rs), ['interets_riasec', 'aptitudes', 'personnalite_hexaco']);
    assert.deepEqual([rs.interets_riasec.length, rs.aptitudes.length, rs.personnalite_hexaco.length], [6, 9, 6]);
    for (const s of [...rs.interets_riasec, ...rs.aptitudes, ...rs.personnalite_hexaco]) {
      assert.notEqual(s.value, null);
      assert.equal(s.source.type, 'trace_vectoriel');
    }
  });
});

test('jeton inconnu, mal formé ou pointant hors de prive/ -> même 404', async () => {
  // Une entrée piégée dans la table : un chemin au lieu d'un nom de fichier
  const piege = 'b'.repeat(32);
  fs.writeFileSync(process.env.LIENS_FICHIER, JSON.stringify({ ...lire(), [piege]: '../package.json.pdf' }));
  await avecServeur(async (base) => {
    for (const id of ['a'.repeat(32), piege, '1234','..%2F..%2Fetc%2Fpasswd', 'A'.repeat(32), 'constructor']) {
      const r = await fetch(`${base}/report/${id}`);
      assert.equal(r.status, 404, id);
      assert.deepEqual(await r.json(), { detail: 'Rapport introuvable' });
    }
  });
});

test('aucune route ne liste les rapports, plus d’upload ni d’authentification', async () => {
  await avecServeur(async (base) => {
    assert.equal((await fetch(`${base}/report`)).status, 404);
    assert.equal((await fetch(`${base}/report/`)).status, 404);
    assert.equal((await fetch(`${base}/report/upload`, { method: 'POST' })).status, 404);
    const accueil = await (await fetch(`${base}/`)).json();
    assert.ok(!('auth' in accueil));
  });
});

function lire() {
  return fs.existsSync(process.env.LIENS_FICHIER) ? JSON.parse(fs.readFileSync(process.env.LIENS_FICHIER, 'utf8')) : {};
}
