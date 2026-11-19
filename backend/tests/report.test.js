// Tests de la route /report (POST upload, GET analyse, GET scores) de bout
// en bout, avec un PDF fictif (« Rdv FICTIF ») généré à la volée.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { genererPdfFictif } from './fixtures/genererRapportFictif.js';
import { normaliser } from '../src/text.js';

// Stockage temporaire : les vrais storage/uploads et storage/outputs ne sont
// jamais touchés par les tests.
process.env.BACKEND_STORAGE = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-test-'));
delete process.env.API_TOKEN;

const { default: app } = await import('../server.js');

function demarrer() {
  return new Promise((resolve) => {
    const serveur = app.listen(0, '127.0.0.1', () => resolve(serveur));
  });
}

async function avecServeur(fn) {
  const serveur = await demarrer();
  const base = `http://127.0.0.1:${serveur.address().port}`;
  try {
    await fn(base);
  } finally {
    serveur.close();
  }
}

test('upload du PDF fictif, puis lecture des scores et des métiers', async () => {
  await avecServeur(async (base) => {
    const pdf = genererPdfFictif();

    // 1. On dépose le PDF fictif
    const form = new FormData();
    form.append('fichier', new Blob([pdf], { type: 'application/pdf' }), 'rapport-fictif.pdf');
    const r = await fetch(`${base}/report/upload`, { method: 'POST', body: form });
    const corps = await r.text();
    assert.equal(r.status, 201, corps);
    const analyse = JSON.parse(corps);
    assert.match(analyse.id, /^[0-9a-f]{32}$/);
    assert.equal(analyse.rdv, 'Rdv FICTIF');
    assert.equal(analyse.nb_pages, 7);

    // Le JSON a bien été sauvegardé dans le stockage temporaire
    assert.ok(fs.existsSync(path.join(process.env.BACKEND_STORAGE, 'outputs', `${analyse.id}.json`)));
    // Et le PDF déposé dans uploads/
    assert.ok(fs.readdirSync(path.join(process.env.BACKEND_STORAGE, 'uploads')).some((f) => f.endsWith('.pdf')));

    // 2. Les scores du graphique sont retournés avec leurs sources
    const rs = await (await fetch(`${base}/report/${analyse.id}/scores`)).json();
    assert.deepEqual(Object.keys(rs), ['interets_riasec', 'aptitudes', 'personnalite_hexaco']);
    assert.equal(rs.interets_riasec.length, 6);
    assert.equal(rs.aptitudes.length, 9);
    assert.equal(rs.personnalite_hexaco.length, 6);
    for (const s of [...rs.interets_riasec, ...rs.aptitudes, ...rs.personnalite_hexaco]) {
      assert.notEqual(s.value, null);
      assert.equal(s.source.type, 'trace_vectoriel');
      assert.ok(s.source.page >= 1);
    }
    const riasec = Object.fromEntries(rs.interets_riasec.map((s) => [normaliser(s.label), s.value]));
    // Valeur fictive attendue 90 ; le parseur pdfjs décale d'un cran le tout
    // premier path de la page, on vérifie donc une valeur approchée.
    assert.ok(riasec['artistique'] > 80, `artistique=${riasec['artistique']}`);
    const aptitudes = Object.fromEntries(rs.aptitudes.map((s) => [normaliser(s.label), s.value]));
    assert.equal(aptitudes['visualisation'], 7.0);

    // 3. L'analyse complète se relit, et la liste contient l'id
    const relue = await (await fetch(`${base}/report/${analyse.id}`)).json();
    assert.equal(relue.id, analyse.id);
    assert.equal(relue.metiers.length, 4);
    assert.deepEqual(new Set(relue.metiers.map((m) => m.zone)), new Set([1, 2, 3]));
    const liste = await (await fetch(`${base}/report`)).json();
    assert.ok(liste.includes(analyse.id));
  });
});

test('upload refuse un fichier qui n’est pas un PDF', async () => {
  await avecServeur(async (base) => {
    const form = new FormData();
    form.append('fichier', new Blob(['ceci n’est pas un pdf'], { type: 'text/plain' }), 'note.txt');
    const r = await fetch(`${base}/report/upload`, { method: 'POST', body: form });
    assert.equal(r.status, 400);
  });
});

test('analyse inconnue -> 404, id mal formé -> 404', async () => {
  await avecServeur(async (base) => {
    assert.equal((await fetch(`${base}/report/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`)).status, 404);
    assert.equal((await fetch(`${base}/report/../../etc/passwd`)).status, 404);
  });
});

test('auth : avec API_TOKEN, 401 sans header, 200 avec le bon', async () => {
  await avecServeur(async (base) => {
    process.env.API_TOKEN = 'secret-test';
    try {
      assert.equal((await fetch(`${base}/report`)).status, 401);
      assert.equal((await fetch(`${base}/report`, { headers: { Authorization: 'Bearer faux' } })).status, 401);
      const ok = await fetch(`${base}/report`, { headers: { Authorization: 'Bearer secret-test' } });
      assert.equal(ok.status, 200);
      const accueil = await (await fetch(`${base}/`, { headers: { Authorization: 'Bearer secret-test' } })).json();
      assert.equal(accueil.auth, 'active');
    } finally {
      delete process.env.API_TOKEN;
    }
  });
});
