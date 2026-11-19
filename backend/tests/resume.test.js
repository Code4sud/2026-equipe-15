// Tests du résumé écrit, sans jamais appeler Ollama : le modèle est remplacé
// par une fonction factice. L'analyse utilisée est entièrement inventée
// (« Rdv FICTIF », métiers fictifs) : ces tests tournent aussi sur GitHub.

import test from 'node:test';
import assert from 'node:assert/strict';

process.env.OLLAMA_MODEL = '';
process.env.OLLAMA_URL = 'http://127.0.0.1:9'; // si un appel partait quand même, il échouerait aussitôt

const { construireFaits, nettoyerOnboarding } = await import('../src/resume/faits.js');
const { raisonDeRefus } = await import('../src/resume/controle.js');
const { genererResume, NB_POINTS } = await import('../src/resume/generer.js');
const { ErreurIA } = await import('../src/ai/ollama.js');

const src = (page) => ({ page, section: 'inventée', type: 'trace_vectoriel', detail: 'donnée inventée' });
const radar = (labels, valeurs, forts, page, descriptions = {}) =>
  labels.map((label, i) => ({
    label,
    value: valeurs[i],
    echelle_max: 100,
    point_fort: forts.includes(label),
    description: descriptions[label] ?? `Texte inventé sur ${label}.`,
    source: src(page),
  }));

// Analyse inventée, de la même forme que celle du backend.
function analyseFictive({ notes = [] } = {}) {
  return {
    id: 'f'.repeat(32),
    rdv: 'Rdv FICTIF',
    nb_pages: 8,
    interets_riasec: radar(
      ['Réaliste', 'Investigateur', 'Artistique', 'Social', 'Entreprenant', 'Conventionnel'],
      [80, 20, 90, 40, 10, 30],
      ['Réaliste', 'Artistique'],
      2
    ),
    aptitudes: [3, 2, 2, 1, 0, 5, 1, 2, 1].map((value, i) => ({
      label: `Aptitude fictive ${i + 1}`,
      value,
      echelle_max: 7,
      source: src(3),
    })),
    personnalite_hexaco: radar(
      ['Émotivité', 'Extraversion', 'Agréabilité', 'Caractère consciencieux', 'Humilité-honnêteté', 'Ouverture à l’expérience'],
      [90, 70, 20, 30, 40, 50],
      ['Émotivité', 'Extraversion'],
      4,
      {
        Émotivité: 'Un score élevé indique un texte inventé sur l’humeur. Un score faible indique autre chose.',
        Extraversion: 'Un score élevé signale qu’on est à l’aise en groupe. Un score faible correspond à autre chose.',
      }
    ),
    metiers: [
      { id: 'z1-m1', nom: 'Métier fictif A', zone: 1, zone_label: 'Métiers accessibles en 0 à 6 mois', description: 'Inventé.', source: src(5) },
      { id: 'z2-m1', nom: 'Métier fictif B de la santé', zone: 2, zone_label: 'Métiers accessibles en 3 mois à 2 ans', description: 'Inventé.', source: src(6) },
      { id: 'z3-m1', nom: 'Métier fictif C', zone: 3, zone_label: 'Métiers accessibles en 1 à 4 ans', description: 'Inventé.', source: src(6) },
    ],
    avertissement: 'Avertissement inventé.',
    avertissement_page: 8,
    notes,
  };
}

const ONBOARDING = {
  favoris: { 1: 'z1-m1', 2: 'z2-m1', 3: null, 4: 'inconnu', 5: null },
  interets_metiers: { 'z1-m1': 'interesse', 'z3-m1': 'interesse', 'z2-m1': 'non', 'z9-m9': 'interesse' },
};

// Modèle factice : lit les identifiants des faits dans le message, et répond
// avec `fabrique(ids)`.
function llmFactice(fabrique) {
  const appels = [];
  const llm = async ({ message, schema }) => {
    appels.push({ message, schema });
    const ids = [...message.matchAll(/^(f\d+) \(page \d+\)/gm)].map((m) => m[1]);
    return fabrique(ids, appels.length);
  };
  return { llm, appels };
}

// (pas de chiffre dans les phrases : un nombre absent des faits est refusé)
const lettre = (i) => 'ABCDEFGHIJ'[i];
const bonneReponse = (ids) => ({
  points: ids.slice(0, 4).map((id, i) => ({ texte: `Phrase simple et juste sur le fait ${lettre(i)}.`, fait: id })),
  texte: ids.map((id, i) => ({ phrase: `Une phrase courte sur le fait ${lettre(i)}.`, faits: [id] })),
});

test('faits : pages, choix nettoyés, rien de chiffré ni de « score faible »', () => {
  const { faits, choix } = construireFaits(analyseFictive(), ONBOARDING);
  assert.deepEqual(choix, { favoris: ['z1-m1', 'z2-m1'], interesses: ['z1-m1', 'z3-m1'] });
  assert.equal(new Set(faits.map((f) => f.id)).size, faits.length);
  for (const f of faits) {
    assert.ok(f.page >= 1 && f.page <= 8, f.id);
    assert.doesNotMatch(f.texte, /faible|score/i, f.id);
    assert.doesNotMatch(f.texte, /\b(80|90|70)\b/, `${f.id} : valeur de score transmise`);
  }
  const tout = faits.map((f) => f.texte).join(' ');
  assert.match(tout, /« Artistique » et « Réaliste »/); // du plus haut au moins haut
  assert.match(tout, /« Aptitude fictive 6 »/);
  assert.doesNotMatch(tout, /humeur/); // explication d'Émotivité non transmise
  assert.match(tout, /à l’aise en groupe/); // celle d'Extraversion, côté point fort seulement
});

test('faits : pas d’aptitude si les libellés lus sous les barres sont douteux', () => {
  const notes = ['Aptitudes cognitives — les libellés écrits sous les barres ne sont pas ceux attendus (…)'];
  const { faits } = construireFaits(analyseFictive({ notes }));
  assert.ok(!faits.some((f) => /aptitude/i.test(f.texte)));
  assert.deepEqual(nettoyerOnboarding('pas un objet', analyseFictive()), { favoris: [], interesses: [] });
});

test('faits : les phrases du repli respectent elles-mêmes le contrôle', () => {
  for (const onboarding of [null, ONBOARDING]) {
    for (const f of construireFaits(analyseFictive(), onboarding).faits) {
      assert.equal(raisonDeRefus(f.phrase, [f]), null, f.phrase);
    }
  }
});

test('contrôle : refuse ce qui n’est pas dans les faits ou enfreint les règles', () => {
  const fait = { id: 'f1', page: 2, texte: 'Tu as marqué 2 métiers comme intéressants.' };
  assert.equal(raisonDeRefus('Tu as aimé 2 métiers de ton rapport.', [fait]), null);
  assert.match(raisonDeRefus('Tu as aimé 3 métiers.', [fait]), /nombre absent/);
  assert.match(raisonDeRefus('Ta créativité est à 90 sur 100.', [fait]), /nombre absent/);
  assert.match(raisonDeRefus('Tu as aimé des métiers.', []), /aucun fait/);
  for (const t of [
    'Ton raisonnement est faible.',
    'Ton score est élevé.',
    'Tu es en dessous des autres.',
    'Ce métier paie un bon salaire.',
    'Vous aimez créer.',
    'Tu sembles stressé.',
    'Parles-en à ta famille.',
  ]) {
    assert.match(raisonDeRefus(t, [fait]) || '', /mot interdit/, t);
  }
  assert.match(raisonDeRefus('Tu as gagné 50 % de points.', [fait]), /symbole/);
  assert.match(raisonDeRefus('a'.repeat(300), [fait]), /trop longue/);
  // Un intitulé de métier cité par le fait peut contenir un mot de la liste
  const metier = { id: 'f2', page: 6, texte: 'Ton préféré : « Métier fictif B de la santé ».', noms: ['Métier fictif B de la santé'] };
  assert.equal(raisonDeRefus('Tu as choisi « Métier fictif B de la santé ».', [metier]), null);
  assert.match(raisonDeRefus('Pense à ta santé.', [metier]) || '', /mot interdit/);
});

test('résumé : phrases du modèle acceptées, chaque point avec la page de son fait', async () => {
  const { llm, appels } = llmFactice(bonneReponse);
  const r = await genererResume(analyseFictive(), ONBOARDING, { llm });
  assert.equal(appels.length, 1);
  assert.ok(appels[0].schema, 'réponse contrainte par un schéma JSON');
  assert.equal(r.genere_par.mode, 'ia');
  assert.equal(r.points.length, NB_POINTS);
  const pageDe = Object.fromEntries(r.faits.map((f) => [f.id, f.page]));
  for (const p of r.points) {
    assert.equal(p.origine, 'ia');
    assert.equal(p.page, pageDe[p.fait]);
  }
  assert.equal(r.texte, r.phrases.map((p) => p.texte).join(' '));
  assert.equal(r.controle.phrases_refusees, 0);
});

test('résumé : phrases inventées refusées et remplacées par le repli', async () => {
  const { llm } = llmFactice((ids) => ({
    points: [
      { texte: 'Tu gagneras un bon salaire.', fait: ids[0] }, // mot interdit
      { texte: 'Ta créativité vaut 90.', fait: ids[0] }, // nombre inventé
      { texte: 'Tu es doué pour tout.', fait: 'f99' }, // fait inexistant
      { texte: 'Phrase juste sur un fait.', fait: ids[1] },
    ],
    texte: [{ phrase: 'Ton score est faible.', faits: [ids[0]] }],
  }));
  const r = await genererResume(analyseFictive(), ONBOARDING, { llm });
  assert.equal(r.genere_par.mode, 'mixte');
  assert.equal(r.points.length, NB_POINTS);
  assert.deepEqual(r.points.filter((p) => p.origine === 'ia').map((p) => p.texte), ['Phrase juste sur un fait.']);
  assert.ok(r.phrases.every((p) => p.origine === 'repli'));
  assert.ok(r.controle.phrases_refusees >= 5);
  assert.ok(!/salaire|90|faible/.test(JSON.stringify(r.points) + r.texte));
});

test('résumé : second essai quand le premier est refusé', async () => {
  const { llm, appels } = llmFactice((ids, n) => (n === 1 ? { points: [], texte: [] } : bonneReponse(ids)));
  const r = await genererResume(analyseFictive(), null, { llm });
  assert.equal(appels.length, 2);
  assert.equal(r.genere_par.mode, 'ia');
});

test('résumé : Ollama absent ou non configuré -> repli complet, sans erreur', async () => {
  const r = await genererResume(analyseFictive(), ONBOARDING, {
    llm: async () => {
      throw new ErreurIA('Ollama injoignable');
    },
  });
  assert.equal(r.genere_par.mode, 'repli');
  assert.equal(r.genere_par.raison, 'Ollama injoignable');
  assert.equal(r.points.length, NB_POINTS);
  assert.ok(r.points.every((p) => p.origine === 'repli' && p.page >= 1));
  assert.match(r.texte, /image à un moment donné/);

  // Sans OLLAMA_MODEL, le vrai client refuse sans rien envoyer.
  const sansModele = await genererResume(analyseFictive(), null);
  assert.equal(sansModele.genere_par.mode, 'repli');
  assert.equal(sansModele.genere_par.raison, 'OLLAMA_MODEL non défini');
});
