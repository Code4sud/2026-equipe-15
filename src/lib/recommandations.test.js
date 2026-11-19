import test from 'node:test'
import assert from 'node:assert/strict'
import { modifierAvis, listerFormations } from './recommandations.js'

const metiers = [{ id: 'fictif-a', zone: 1 }, { id: 'fictif-b', zone: 1 }, { id: 'fictif-c', zone: 3 }]

test('changer un avis conserve un préféré qui reste admissible, et les choix des autres zones', () => {
  const state = { termine: true, interets_metiers: { 'fictif-a': 'interesse', 'fictif-b': 'non' }, favoris: { 1: 'fictif-a', 3: 'fictif-c' }, ajouts_psy: [] }
  const next = modifierAvis(state, metiers[1], 'plus_tard', metiers)
  assert.equal(next.favoris[1], 'fictif-a')
  assert.equal(next.favoris[3], 'fictif-c')
  assert.equal(next.termine, true)
  assert.equal(state.interets_metiers['fictif-b'], 'non')
})

test('un préféré refusé est retiré, sans effacer le métier ni les autres avis', () => {
  const state = { interets_metiers: { 'fictif-a': 'interesse', 'fictif-b': 'plus_tard' }, favoris: { 1: 'fictif-a' } }
  const next = modifierAvis(state, metiers[0], 'non', metiers)
  assert.equal(next.favoris[1], null)
  assert.equal(next.interets_metiers['fictif-a'], 'non')
  assert.equal(next.interets_metiers['fictif-b'], 'plus_tard')
})

test('un préféré reporté est retiré si un autre métier de la zone intéresse le jeune', () => {
  const state = { interets_metiers: { 'fictif-a': 'plus_tard', 'fictif-b': 'non' }, favoris: { 1: 'fictif-a' } }
  assert.equal(modifierAvis(state, metiers[1], 'interesse', metiers).favoris[1], null)
})

test('les formations combinent les filtres et n’inventent rien pour un métier sans données', () => {
  const infos = { 'fictif-a': { formations: [{ nom: 'Formation FICTIVE A', alternance: true }, { nom: 'Formation FICTIVE B', alternance: false }] } }
  assert.equal(listerFormations(metiers, infos).length, 2)
  const result = listerFormations(metiers, infos, { metierId: 'fictif-a', alternance: true })
  assert.equal(result.length, 1)
  assert.equal(result[0].metier.id, 'fictif-a')
  assert.deepEqual(listerFormations(metiers, infos, { metierId: 'fictif-c' }), [])
  assert.deepEqual(listerFormations([], infos), [])
})
