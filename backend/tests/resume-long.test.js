// Version longue du résumé (src/resume/long.js), sur une analyse entièrement
// inventée (« Rdv FICTIF », métiers fictifs) et un modèle factice.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Dossier de rapports vide : aucune fiche de la Région, rien de réel.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-long-'));
process.env.RAPPORTS_DIR = TMP;
delete process.env.OLLAMA_MODEL;
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const { genererResumeLong } = await import('../src/resume/long.js');

const src = (page) => ({ page, section: 'inventée', type: 'trace_vectoriel', detail: 'donnée inventée' });
const radar = (labels, forts, page) =>
  labels.map((label) => ({ label, value: forts.includes(label) ? 90 : 20, echelle_max: 100, point_fort: forts.includes(label), description: `Texte inventé sur ${label}.`, source: src(page) }));

const analyse = {
  id: 'f'.repeat(32),
  rdv: 'Rdv FICTIF',
  nb_pages: 8,
  interets_riasec: radar(['Réaliste', 'Investigateur', 'Artistique', 'Social', 'Entreprenant', 'Conventionnel'], ['Réaliste', 'Artistique'], 2),
  aptitudes: [3, 5, 1].map((value, i) => ({ label: `Aptitude fictive ${i + 1}`, value, echelle_max: 7, source: src(3) })),
  personnalite_hexaco: radar(['Émotivité', 'Extraversion', 'Agréabilité', 'Caractère consciencieux', 'Humilité-honnêteté', 'Ouverture à l’expérience'], ['Extraversion', 'Agréabilité'], 4),
  metiers: [
    { id: 'z1-m1', nom: 'Métier fictif A', zone: 1, zone_label: 'Métiers accessibles en 0 à 6 mois', description: 'On range des objets inventés. On accueille des visiteurs inventés.', source: src(5) },
    { id: 'z2-m1', nom: 'Métier fictif B', zone: 2, zone_label: 'Métiers accessibles en 3 mois à 2 ans', description: 'On dessine des plans inventés.', source: src(6) },
  ],
  avertissement: 'Avertissement inventé.',
  avertissement_page: 8,
  notes: [],
};
const onboarding = { termine: true, interets_metiers: { 'z1-m1': 'interesse', 'z2-m1': 'interesse' }, favoris: { 1: 'z1-m1', 2: 'z2-m1' }, ajouts_psy: [] };
const court = { phrases: [{ texte: 'Ce qui ressort chez toi, ce sont Réaliste et Artistique.', faits: ['f1'], origine: 'ia' }], genere_par: { mode: 'ia' } };

test('version longue : résumé court, puis chaque préféré avec les phrases du modèle qui passent le contrôle', async () => {
  const llm = async () => ({
    metiers: [
      {
        id: 'z1-m1',
        phrases: [
          { texte: 'Tu ranges des objets et tu accueilles des visiteurs.', faits: ['z1-m1'] },
          { texte: 'Ça rejoint ton intérêt Réaliste (f1).', faits: ['z1-m1', 'f1'] },
          { texte: 'Ton profil explique ce métier.', faits: ['z1-m1', 'f1'] }, // lien de cause : refusé
          { texte: 'Tu gagneras 3000 euros.', faits: ['z1-m1'] }, // salaire inventé : refusé
        ],
      },
      { id: 'z2-m1', phrases: [{ texte: 'Tu dessines des plans.', faits: ['f1'] }] }, // ne cite pas son métier : refusé
      { id: 'z9-m9', phrases: [{ texte: 'Métier absent du rapport.', faits: ['z9-m9'] }] }, // ignoré
    ],
  });
  const r = await genererResumeLong(analyse, onboarding, court, { llm });
  const textes = r.phrases.map((p) => p.texte);
  assert.equal(r.version, 'longue');
  assert.equal(textes[0], court.phrases[0].texte);
  assert.ok(textes.includes('Regardons maintenant tes 2 métiers préférés.'));
  assert.ok(textes.includes('Le premier : « Métier fictif A ». Il faut compter 0 à 6 mois de préparation.'));
  assert.ok(textes.includes('Tu ranges des objets et tu accueilles des visiteurs.'));
  assert.ok(textes.includes('Ça rejoint ton intérêt Réaliste.')); // identifiant recopié retiré
  assert.ok(!textes.some((t) => /explique|3000|absent du rapport/.test(t)));
  // Le second métier n'a aucune phrase valide du modèle : description du rapport à la place.
  assert.ok(textes.includes('Ton rapport le décrit ainsi : On dessine des plans inventés.'));
  // Sans fiche de la Région préparée : aucune phrase de salaire, rien d'affirmé sur le site.
  assert.ok(!textes.some((t) => /Région|euros/.test(t)));
  assert.equal(textes.at(-1), "Tu peux en parler avec le psychologue : c'est toi qui décides.");
  assert.equal(r.texte, textes.join(' '));
  assert.deepEqual(r.metiers, ['z1-m1', 'z2-m1']);
  assert.ok(r.controle.phrases_refusees >= 3);
  // Chaque fait cité est rendu avec sa page, pour les sources du site.
  for (const p of r.phrases) for (const id of p.faits) assert.ok(r.faits.some((f) => f.id === id && Number.isInteger(f.page)));
});

test('version longue : sans modèle, la démo ne tombe pas ; sans préféré, on le dit', async () => {
  const { ErreurIA } = await import('../src/ai/ollama.js');
  const enPanne = async () => { throw new ErreurIA('Ollama injoignable'); };
  const r = await genererResumeLong(analyse, onboarding, court, { llm: enPanne });
  assert.ok(r.phrases.some((p) => p.texte.startsWith('Ton rapport le décrit ainsi : On range des objets inventés.')));
  assert.equal(r.genere_par.raison, 'Ollama injoignable');

  const sansChoix = await genererResumeLong(analyse, null, court, { llm: enPanne });
  assert.ok(sansChoix.phrases.some((p) => p.texte.startsWith("Tu n'as pas encore choisi de métier préféré.")));
  assert.deepEqual(sansChoix.metiers, []);
});
