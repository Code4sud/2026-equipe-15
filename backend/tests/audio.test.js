// Tests de la synthèse vocale, avec un faux Piper (tests/outils/fauxPiper.js) :
// ni moteur réel ni voix à installer. Les tests de route utilisent un rapport
// de prive/ (sautés si prive/ est vide) ; les autres tournent partout.
// Ollama n'est jamais appelé : le résumé passe en repli.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const PRIVE = path.join(ICI, '..', '..', 'prive');
const pdfs = fs.existsSync(PRIVE) ? fs.readdirSync(PRIVE).filter((f) => f.toLowerCase().endsWith('.pdf')).sort() : [];

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-test-'));
const JOURNAL = path.join(TMP, 'journal.txt');
Object.assign(process.env, {
  BACKEND_STORAGE: TMP,
  RAPPORTS_DIR: PRIVE,
  LIENS_FICHIER: path.join(TMP, 'liens.json'),
  OLLAMA_MODEL: '',
  OLLAMA_URL: 'http://127.0.0.1:9',
  PIPER_BIN: path.join(ICI, 'outils', 'fauxPiper.js'),
  PIPER_MODELE: '/voix/inventee-fr.onnx',
  FAUX_PIPER_JOURNAL: JOURNAL,
});
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const { texteALire, fichierAudio, empreinteAudio, ErreurAudio } = await import('../src/audio/synthese.js');
const appels = () => (fs.existsSync(JOURNAL) ? fs.readFileSync(JOURNAL, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : []);
const viderJournal = () => fs.rmSync(JOURNAL, { force: true });

test('texte lu : le résumé, à la ponctuation près', () => {
  assert.equal(
    texteALire('Ton préféré : « Métier fictif / métière fictive ».  Il peut évoluer.'),
    'Ton préféré : Métier fictif ou métière fictive. Il peut évoluer.'
  );
  assert.notEqual(empreinteAudio('Texte inventé A.'), empreinteAudio('Texte inventé B.'));
  assert.match(empreinteAudio('Texte inventé A.'), /^[0-9a-f]{16}$/);
});

test('fichierAudio : un WAV créé une seule fois, même demandé deux fois en même temps', async () => {
  viderJournal();
  const dossier = path.join(TMP, 'unitaire');
  const [a, b] = await Promise.all([
    fichierAudio('Phrase inventée « une ».', dossier, 'essai'),
    fichierAudio('Phrase inventée « une ».', dossier, 'essai'),
  ]);
  assert.equal(a, b);
  assert.equal(fs.readFileSync(a).subarray(0, 4).toString(), 'RIFF');
  assert.equal(appels().length, 1);
  assert.deepEqual(appels()[0], { modele: '/voix/inventee-fr.onnx', texte: 'Phrase inventée une.' });
  await fichierAudio('Phrase inventée « une ».', dossier, 'essai'); // relu depuis le cache
  assert.equal(appels().length, 1);
  assert.deepEqual(fs.readdirSync(dossier), ['essai.wav']); // aucun fichier temporaire laissé
});

test('fichierAudio : panne ou moteur absent -> ErreurAudio, aucun fichier laissé', async () => {
  const dossier = path.join(TMP, 'pannes');
  process.env.FAUX_PIPER_ECHEC = '1';
  try {
    await assert.rejects(fichierAudio('Phrase inventée.', dossier, 'panne'), (e) => e instanceof ErreurAudio && /code 3/.test(e.message));
  } finally {
    delete process.env.FAUX_PIPER_ECHEC;
  }
  const bin = process.env.PIPER_BIN;
  process.env.PIPER_BIN = path.join(TMP, 'piper-absent');
  try {
    await assert.rejects(fichierAudio('Phrase inventée.', dossier, 'absent'), (e) => e instanceof ErreurAudio && /introuvable/.test(e.message));
  } finally {
    process.env.PIPER_BIN = bin;
  }
  assert.deepEqual(fs.existsSync(dossier) ? fs.readdirSync(dossier) : [], []);
});

test('routes : audio_url dans le résumé, WAV servi et gardé en cache', { skip: pdfs.length ? false : 'aucun PDF dans prive/' }, async () => {
  const { default: app } = await import('../server.js');
  const { creerLien } = await import('../src/liens.js');
  const { jeton } = creerLien(pdfs[0]);
  const serveur = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${serveur.address().port}`;
  const resumer = async (onboarding) =>
    (
      await fetch(`${base}/report/${jeton}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarding }),
      })
    ).json();
  try {
    viderJournal();
    const resume = await resumer(null);
    assert.match(resume.audio_url, new RegExp(`^/report/${jeton}/audio/[0-9a-f]{16}$`));

    const r = await fetch(`${base}${resume.audio_url}`);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'audio/wav');
    assert.equal(r.headers.get('content-disposition'), 'inline; filename="resume.wav"');
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.equal(r.headers.get('accept-ranges'), 'bytes');
    assert.equal(Buffer.from(await r.arrayBuffer()).subarray(0, 4).toString(), 'RIFF');
    // Ce qui est lu est le texte du résumé, rien de plus
    assert.deepEqual(appels().map((a) => a.texte), [texteALire(resume.texte)]);

    // Second appel : relu depuis le cache, Piper n'est pas relancé
    assert.equal((await fetch(`${base}${resume.audio_url}`)).status, 200);
    assert.equal(appels().length, 1);
    const partie = await fetch(`${base}${resume.audio_url}`, { headers: { Range: 'bytes=0-43' } });
    assert.equal(partie.status, 206);

    // Empreinte inconnue, mal formée, jeton inconnu
    assert.equal((await fetch(`${base}/report/${jeton}/audio/${'0'.repeat(16)}`)).status, 404);
    assert.equal((await fetch(`${base}/report/${jeton}/audio/pas-une-empreinte`)).status, 404);
    assert.equal((await fetch(`${base}/report/${'a'.repeat(32)}/audio/${'0'.repeat(16)}`)).status, 404);

    // Panne du moteur sur un autre texte -> 503, sans planter. Marquer un
    // métier comme intéressant ajoute une phrase : autre texte, autre audio.
    const analyse = await (await fetch(`${base}/report/${jeton}`)).json();
    const autre = await resumer({ interets_metiers: { [analyse.metiers[0].id]: 'interesse' } });
    assert.notEqual(autre.audio_url, resume.audio_url);
    process.env.FAUX_PIPER_ECHEC = '1';
    try {
      const panne = await fetch(`${base}${autre.audio_url}`);
      assert.equal(panne.status, 503);
      assert.deepEqual(await panne.json(), { detail: 'Synthèse vocale indisponible' });
    } finally {
      delete process.env.FAUX_PIPER_ECHEC;
    }

    // Sans voix réglée : pas d'adresse audio, et la route répond 503
    const modele = process.env.PIPER_MODELE;
    delete process.env.PIPER_MODELE;
    try {
      assert.equal((await resumer(null)).audio_url, null);
      assert.equal((await fetch(`${base}${resume.audio_url}`)).status, 503);
    } finally {
      process.env.PIPER_MODELE = modele;
    }
  } finally {
    serveur.close();
  }
});
