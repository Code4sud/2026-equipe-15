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
// Jamais d'appel à Ollama dans les tests : sans modèle, le résumé passe en repli.
process.env.OLLAMA_MODEL = '';
process.env.OLLAMA_URL = 'http://127.0.0.1:9';
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

test('GET /report/{jeton}/pdf : le PDF pour la visionneuse, lecture par morceaux', { skip: sansPdf }, async () => {
  const { jeton } = creerLien(pdfs[0]);
  const original = fs.readFileSync(path.join(PRIVE, pdfs[0]));
  await avecServeur(async (base) => {
    // L'analyse donne l'adresse du PDF (contrat : rapport_pdf_url)
    const analyse = await (await fetch(`${base}/report/${jeton}`)).json();
    assert.equal(analyse.rapport_pdf_url, `/report/${jeton}/pdf`);

    // Le fichier entier, à l'identique, sous un nom neutre et sans cache
    const r = await fetch(`${base}${analyse.rapport_pdf_url}`, { headers: { Origin: 'http://localhost:5173' } });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'application/pdf');
    assert.equal(r.headers.get('content-disposition'), 'inline; filename="rapport.pdf"');
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('accept-ranges'), 'bytes');
    assert.ok(r.headers.get('access-control-allow-origin'));
    assert.match(r.headers.get('access-control-expose-headers'), /Content-Range/);
    const corps = Buffer.from(await r.arrayBuffer());
    assert.ok(corps.equals(original), 'PDF servi différent du fichier de prive/');

    // Une partie seulement, comme le demande PDF.js (206)
    const partie = await fetch(`${base}/report/${jeton}/pdf`, { headers: { Range: 'bytes=0-99' } });
    assert.equal(partie.status, 206);
    assert.equal(partie.headers.get('content-range'), `bytes 0-99/${original.length}`);
    assert.ok(Buffer.from(await partie.arrayBuffer()).equals(original.subarray(0, 100)));

    // PDF.js (la bibliothèque de la visionneuse) ouvre le rapport par l'API,
    // jusqu'à sa dernière page.
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.min.mjs');
    const doc = await pdfjs.getDocument({ url: `${base}${analyse.rapport_pdf_url}`, isEvalSupported: false }).promise;
    try {
      assert.equal(doc.numPages, analyse.nb_pages);
      const derniere = await doc.getPage(doc.numPages);
      assert.ok((await derniere.getTextContent()).items.length > 0);
    } finally {
      await doc.destroy();
    }
  });
});

test('POST /report/{jeton}/resume : 4 phrases avec leur page, repli sans Ollama', { skip: sansPdf }, async () => {
  const { jeton } = creerLien(pdfs[0]);
  await avecServeur(async (base) => {
    const analyse = await (await fetch(`${base}/report/${jeton}`)).json();
    const favoris = { 1: analyse.metiers[0].id, 2: 'inconnu' };
    const r = await fetch(`${base}/report/${jeton}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboarding: { favoris } }),
    });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    const resume = await r.json();
    assert.equal(resume.points.length, 4);
    for (const p of resume.points) {
      assert.ok(p.texte);
      assert.ok(p.page >= 1 && p.page <= analyse.nb_pages);
    }
    assert.ok(resume.texte.length > 0);
    assert.deepEqual(resume.genere_par, { mode: 'repli', modele: null, raison: 'OLLAMA_MODEL non défini' });
    assert.deepEqual(resume.choix_pris_en_compte.favoris, [analyse.metiers[0].id]);
    // Un résumé en repli n'est pas mis en cache : l'IA sera réessayée.
    assert.ok(!fs.readdirSync(path.join(TMP, 'outputs')).some((f) => f.includes('-resume-')));

    // Sans corps, ou avec un onboarding mal formé : toujours un résumé
    const vide = await fetch(`${base}/report/${jeton}/resume`, { method: 'POST' });
    assert.equal(vide.status, 200);
    const mal = await fetch(`${base}/report/${jeton}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboarding: 'n’importe quoi' }),
    });
    assert.equal(mal.status, 200);
    assert.equal((await fetch(`${base}/report/${'a'.repeat(32)}/resume`, { method: 'POST' })).status, 404);
  });
});

const TABLE_ONET = path.join(PRIVE, 'table-metiers-onet-fr-jobzones.xlsx');
const sansTable = sansPdf || (fs.existsSync(TABLE_ONET) ? false : 'table O*NET absente de prive/');

test('GET /report/{jeton} : métiers contrôlés contre la table O*NET', { skip: sansTable }, async () => {
  const { jeton } = creerLien(pdfs[0]);
  await avecServeur(async (base) => {
    const analyse = await (await fetch(`${base}/report/${jeton}`)).json();
    assert.equal(analyse.controle_onet.table, true);
    assert.equal(analyse.controle_onet.retrouves, analyse.metiers.length);
    assert.deepEqual(analyse.controle_onet.introuvables, []);
    for (const m of analyse.metiers) assert.ok(m.onet && (m.onet.code || m.onet.codes), m.id);

    // Table absente : l'analyse reste servie, sans contrôle
    process.env.ONET_FICHIER = path.join(TMP, 'absente.xlsx');
    try {
      const sans = await (await fetch(`${base}/report/${jeton}`)).json();
      assert.deepEqual(sans.controle_onet, { table: false, retrouves: 0, introuvables: [] });
      assert.equal(sans.metiers.length, analyse.metiers.length);
    } finally {
      delete process.env.ONET_FICHIER;
    }
  });
});

test('GET /report/{jeton}/metiers : recherche dans la table, derrière le jeton', { skip: sansTable }, async () => {
  const { jeton } = creerLien(pdfs[0]);
  await avecServeur(async (base) => {
    const chercher = async (q, extra = '') => {
      const r = await fetch(`${base}/report/${jeton}/metiers?q=${encodeURIComponent(q)}${extra}`);
      assert.equal(r.status, 200);
      return (await r.json()).resultats;
    };
    // Chaque métier du rapport, cherché par son intitulé : il est proposé,
    // avec son id dans le rapport.
    const analyse = await (await fetch(`${base}/report/${jeton}`)).json();
    for (const metier of analyse.metiers) {
      const resultats = await chercher(metier.nom, '&limite=20');
      assert.ok(resultats.length > 0 && resultats.length <= 20);
      for (const r of resultats) assert.deepEqual(Object.keys(r), ['nom', 'code', 'dans_rapport']);
      assert.ok(resultats.some((r) => r.dans_rapport === metier.id), `${metier.id} : non proposé par la recherche`);
    }

    assert.deepEqual(await chercher('a'), []); // rien avant 2 lettres
    assert.ok((await chercher('an', '&limite=500')).length <= 20); // limite plafonnée
    assert.ok((await chercher('an')).length <= 10); // 10 par défaut

    assert.equal((await fetch(`${base}/report/${'a'.repeat(32)}/metiers?q=an`)).status, 404);
    process.env.ONET_FICHIER = path.join(TMP, 'absente.xlsx');
    try {
      const r = await fetch(`${base}/report/${jeton}/metiers?q=an`);
      assert.equal(r.status, 503);
      assert.deepEqual(await r.json(), { detail: 'Table des métiers absente' });
    } finally {
      delete process.env.ONET_FICHIER;
    }
  });
});

test('jeton inconnu, mal formé ou pointant hors de prive/ -> même 404', async () => {
  // Une entrée piégée dans la table : un chemin au lieu d'un nom de fichier
  const piege = 'b'.repeat(32);
  fs.writeFileSync(process.env.LIENS_FICHIER, JSON.stringify({ ...lire(), [piege]: '../package.json.pdf' }));
  await avecServeur(async (base) => {
    for (const id of ['a'.repeat(32), piege, '1234', '..%2F..%2Fetc%2Fpasswd', 'A'.repeat(32), 'constructor']) {
      for (const route of [`/report/${id}`, `/report/${id}/pdf`]) {
        const r = await fetch(`${base}${route}`);
        assert.equal(r.status, 404, route);
        assert.deepEqual(await r.json(), { detail: 'Rapport introuvable' });
      }
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
