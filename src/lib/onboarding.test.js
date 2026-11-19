import test from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, apresAvis, apresPrefere, candidats, choisirAvis, entrerMetiers, entrerZone, initialState, enregistrerChoix, lireChoix, retour } from './onboarding.js';

const metiers = [{ id: 'a', zone: 1 }, { id: 'b', zone: 1 }, { id: 'c', zone: 3 }];
const catalogue = [{ id: 'psy-1', nom: 'Métier FICTIF' }];
const zones = [{ id: 1, metiers: metiers.slice(0, 2) }, { id: 3, metiers: metiers.slice(2) }];
function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('reprend les trois avis, les ajouts, le préféré et le métier en cours après rechargement', () => {
  const storage = memoryStorage();
  let state = initialState();
  for (const [index, avis] of ['interesse', 'plus_tard', 'non'].entries()) state = choisirAvis(state, metiers[index], avis);
  state.favoris = { 1: 'a' };
  state.ajouts_psy = catalogue;
  state.progression = { ecran: 'metiers', metier: 2, zone: 0 };
  enregistrerChoix(storage, 'rdv-fictif', state);
  const restored = lireChoix(storage, 'rdv-fictif', metiers, catalogue);
  assert.deepEqual(restored.interets_metiers, { a: 'interesse', b: 'plus_tard', c: 'non' });
  assert.equal(restored.favoris[1], 'a');
  assert.deepEqual(restored.ajouts_psy, catalogue);
  assert.equal(restored.progression.metier, 2);
  assert.equal(restored.termine, false);
});

test('un seul intéressé est présélectionné et les zones vides ne sont pas nécessaires au parcours', () => {
  const state = { ...initialState(), interets_metiers: { a: 'interesse', b: 'plus_tard', c: 'interesse' } };
  assert.deepEqual(candidats(zones[0], state.interets_metiers), [metiers[0]]);
  assert.equal(entrerZone(state, zones, 0).favoris[1], 'a');
  const next = entrerZone(state, zones, 1);
  assert.equal(next.favoris[3], 'c');
  assert.equal(entrerZone(next, zones, 2).progression.ecran, 'ajouts');
});

test('sans intéressé, seuls les métiers reportés sont proposés ; tous refusés laisse continuer', () => {
  const state = { ...initialState(), interets_metiers: { a: 'non', b: 'plus_tard', c: 'non' } };
  assert.deepEqual(candidats(zones[0], state.interets_metiers), [metiers[1]]);
  assert.equal(entrerZone(state, zones, 0).favoris[1], null);
  assert.deepEqual(candidats(zones[1], state.interets_metiers), []);
  assert.equal(entrerZone(state, [], 0).progression.ecran, 'ajouts');
});

test('changer une réponse invalide le préféré de cette zone sans perdre les autres choix', () => {
  const state = { ...initialState(), interets_metiers: { a: 'interesse', c: 'interesse' }, favoris: { 1: 'a', 3: 'c' } };
  const next = choisirAvis(state, metiers[0], 'non');
  assert.equal(next.favoris[1], undefined);
  assert.equal(next.favoris[3], 'c');
  assert.equal(state.favoris[1], 'a');
});

test('la fin est persistée et un autre rapport ne récupère pas ces choix', () => {
  const storage = memoryStorage();
  enregistrerChoix(storage, 'rdv-fictif', { ...initialState(), termine: true });
  assert.equal(lireChoix(storage, 'rdv-fictif', metiers, catalogue).termine, true);
  assert.deepEqual(lireChoix(storage, 'autre-fictif', metiers, catalogue), initialState());
});

test('récupère les choix déjà enregistrés par la page d’accueil des collègues', () => {
  const storage = memoryStorage();
  storage.setItem('possibles.onboarding', JSON.stringify({
    termine: true, interets_metiers: { a: 'interesse' }, favoris: { 1: 'a' }, ajouts_psy: catalogue,
  }));
  const state = lireChoix(storage, 'rdv-fictif', metiers, catalogue);
  assert.equal(state.termine, true);
  assert.equal(state.favoris[1], 'a');
  assert.deepEqual(state.ajouts_psy, catalogue);
  enregistrerChoix(storage, 'rdv-fictif', state);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).onboarding.favoris[1], 'a');
});

test('des données locales malformées sont écartées et les positions sont bornées', () => {
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, 'invalide');
  assert.deepEqual(lireChoix(storage, 'rdv-fictif', metiers, catalogue), initialState());
  enregistrerChoix(storage, 'rdv-fictif', { interets_metiers: { a: 'invalide' }, favoris: { 1: 'inconnu' }, ajouts_psy: {}, progression: { ecran: 'metiers', metier: 100, zone: -1 } });
  const state = lireChoix(storage, 'rdv-fictif', metiers, catalogue);
  assert.deepEqual(state.interets_metiers, {});
  assert.equal(state.favoris[1], null);
  assert.deepEqual(state.ajouts_psy, []);
  assert.equal(state.progression.metier, 2);
  assert.equal(state.progression.zone, 0);
});

// Parcours zone par zone : les métiers d'une zone, son préféré, puis la zone suivante.
const en = (ecran, metier, zone) => ({ ...initialState(), interets_metiers: { a: 'interesse', b: 'interesse', c: 'interesse' }, progression: { ecran, metier, zone } });

test('zone par zone : on reste dans la zone tant qu’il reste un métier, puis on choisit son préféré', () => {
  assert.deepEqual(apresAvis(en('metiers', 0, 0), zones, metiers, 0).progression, { ecran: 'metiers', metier: 1, zone: 0 });
  const fin = apresAvis(en('metiers', 1, 0), zones, metiers, 1);
  assert.equal(fin.progression.ecran, 'favoris');
  assert.equal(fin.progression.zone, 0);
});

test('zone par zone : après le préféré, les métiers de la zone suivante, puis les ajouts après la dernière', () => {
  assert.deepEqual(apresPrefere(en('favoris', 1, 0), zones, metiers, 0).progression, { ecran: 'metiers', metier: 2, zone: 1 });
  assert.equal(apresPrefere(en('favoris', 2, 1), zones, metiers, 1).progression.ecran, 'ajouts');
  assert.equal(entrerMetiers(initialState(), [], [], 0).progression.ecran, 'ajouts');
});

test('zone par zone : le retour remonte le même chemin', () => {
  assert.equal(retour(en('metiers', 0, 0), zones, metiers).progression.ecran, 'bienvenue');
  assert.deepEqual(retour(en('metiers', 1, 0), zones, metiers).progression, { ecran: 'metiers', metier: 0, zone: 0 });
  assert.deepEqual(retour(en('favoris', 1, 0), zones, metiers).progression, { ecran: 'metiers', metier: 1, zone: 0 });
  const versZone1 = retour(en('metiers', 2, 1), zones, metiers);
  assert.equal(versZone1.progression.ecran, 'favoris');
  assert.equal(versZone1.progression.zone, 0);
  const versDerniere = retour(en('ajouts', 2, 1), zones, metiers);
  assert.equal(versDerniere.progression.ecran, 'favoris');
  assert.equal(versDerniere.progression.zone, 1);
  assert.equal(retour(en('recap', 2, 1), zones, metiers).progression.ecran, 'ajouts');
});
