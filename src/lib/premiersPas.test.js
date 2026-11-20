import test from 'node:test'
import assert from 'node:assert/strict'
import { construireReserve, repartir, nouvellesApres } from './premiersPas.js'

// Données entièrement inventées.
const metiers = [
  { id: 'fictif-a', nom: 'Métier fictif A', zone: 1, source: { page: 8 } },
  { id: 'fictif-b', nom: 'Métier fictif B', zone: 1, source: { page: 8 } },
  { id: 'fictif-c', nom: 'Métier fictif C', zone: 2, source: { page: 9 } },
  { id: 'fictif-d', nom: 'Métier fictif D', zone: 3, source: { page: 10 } },
  { id: 'fictif-e', nom: 'Métier fictif E', zone: 4, source: { page: 11 } },
]
const durees = { 1: '0 à 6 mois', 2: '3 mois à 2 ans', 3: '1 à 4 ans', 4: '2 à 6 ans' }
const onboarding = {
  termine: true,
  interets_metiers: { 'fictif-a': 'interesse', 'fictif-b': 'interesse', 'fictif-c': 'interesse', 'fictif-d': 'plus_tard' },
  favoris: { 1: 'fictif-a', 2: 'fictif-c', 3: null },
  ajouts_psy: [{ id: 'psy-1', nom: 'Métier fictif ajouté' }],
}
const ids = (etapes) => etapes.map((e) => e.id)

test('sans préféré, la réserve commence par « choisir » et ne parle d’aucun métier', () => {
  const reserve = construireReserve({ metiers, onboarding: {}, durees })
  assert.equal(reserve[0].id, 'choisir')
  assert.ok(!ids(reserve).some((id) => id.startsWith('fiche-') || id === 'formations' || id === 'comparer'))
  assert.ok(ids(reserve).includes('synthese'))
})

test('avec des préférés, les identifiants déjà enregistrés sont gardés et l’ordre est stable', () => {
  const reserve = construireReserve({ metiers, onboarding, durees })
  assert.deepEqual(ids(reserve).slice(0, 6), ['fiche-fictif-a', 'fiche-fictif-c', 'formations', 'synthese', 'profil', 'assistant'])
  assert.ok(!ids(reserve).includes('choisir'))
  assert.equal(new Set(ids(reserve)).size, reserve.length)
})

test('les étapes se déduisent des choix : rapport, comparaison, intéressants, avis, zone sans préféré, ajout du psychologue', () => {
  const reserve = construireReserve({ metiers, onboarding, durees })
  const par = Object.fromEntries(reserve.map((e) => [e.id, e]))
  assert.equal(par.formations.lien, '/formations?metier=fictif-a')
  assert.equal(par['rapport-fictif-a'].lien, '/rapport/8')
  assert.match(par.comparer.texte, /Métier fictif A et Métier fictif C/)
  assert.equal(par['fiche-fictif-b'].lien, '/metier/fictif-b')
  assert.match(par.avis.texte, /le métier pas encore vu/)
  assert.equal(par['zone-3'].lien, '/onboarding?zone=3')
  assert.match(par['zone-3'].texte, /1 à 4 ans/)
  assert.ok(!par['zone-1'] && !par['zone-2'])
  // Zone 4 : aucun avis, donc rien à choisir comme préféré. C'est l'étape « avis » qui y mène.
  assert.ok(!par['zone-4'])
  assert.match(par['psy-psy-1'].texte, /Métier fictif ajouté/)
  assert.equal(par.stage.externe, true)
  assert.match(par.stage.lien, /^https:\/\/www\.1jeune1solution\.gouv\.fr\//)
})

test('un rapport sans métier ou des choix absents ne cassent rien', () => {
  for (const entree of [undefined, {}, { metiers: null, onboarding: null }, { metiers: [], onboarding: { favoris: { 1: 'inconnu' }, ajouts_psy: null } }]) {
    const reserve = construireReserve(entree)
    assert.equal(reserve[0].id, 'choisir')
    assert.ok(!ids(reserve).includes('avis'))
  }
})

test('chaque étape a un texte, et un lien interne commence par « / »', () => {
  for (const e of construireReserve({ metiers, onboarding, durees })) {
    assert.ok(e.texte.length > 0)
    if (e.lien && !e.externe) assert.ok(e.lien.startsWith('/'), e.id)
  }
})

test('la carte montre 4 étapes ; en cocher une fait apparaître la suivante de la réserve', () => {
  const reserve = construireReserve({ metiers, onboarding, durees })
  const { visibles, faites, total } = repartir(reserve, {})
  assert.deepEqual(ids(visibles), ['fiche-fictif-a', 'fiche-fictif-c', 'formations', 'synthese'])
  assert.equal(faites.length, 0)
  assert.equal(total, reserve.length)

  assert.deepEqual(ids(nouvellesApres(reserve, {}, 'fiche-fictif-a')), ['profil'])
  const coches = { 'fiche-fictif-a': true }
  assert.deepEqual(ids(nouvellesApres(reserve, coches, 'synthese')), ['assistant'])
  const apres = repartir(reserve, { ...coches, synthese: true })
  assert.deepEqual(ids(apres.visibles), ['fiche-fictif-c', 'formations', 'profil', 'assistant'])
  assert.deepEqual(ids(apres.faites), ['fiche-fictif-a', 'synthese'])
})

test('décocher remet l’étape à sa place sans rien annoncer de neuf, et les coches inconnues sont ignorées', () => {
  const reserve = construireReserve({ metiers, onboarding, durees })
  const coches = { 'fiche-fictif-a': true, 'ancienne-etape': true }
  assert.deepEqual(nouvellesApres(reserve, coches, 'fiche-fictif-a'), [])
  assert.equal(repartir(reserve, coches).faites.length, 1)
})

test('quand tout est coché, plus rien à montrer et le compte est juste', () => {
  const reserve = construireReserve({ metiers, onboarding, durees })
  const tout = Object.fromEntries(reserve.map((e) => [e.id, true]))
  const { visibles, faites, total } = repartir(reserve, tout)
  assert.equal(visibles.length, 0)
  assert.equal(faites.length, total)
})
