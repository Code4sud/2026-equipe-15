import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { repondreDemo, lireReponseBackend, normaliser, demander } from './chat.js'

const fictif = JSON.parse(readFileSync(new URL('../../contrat/rapport-fictif.json', import.meta.url)))
const infosMetiers = {
  'z2-m3': { salaire: { valeur: '1 500 €', precision: 'exemple' }, formations: [{ nom: 'CAP fictif', ville: 'Nice', duree: '2 ans' }] },
}
const contexte = { rapport: fictif.rapport, onboarding: fictif.onboarding, infosMetiers }
const pagesDuRapport = new Set(fictif.rapport.metiers.map((m) => m.source.page)
  .concat([...fictif.rapport.interets_riasec, ...fictif.rapport.aptitudes, ...fictif.rapport.personnalite_hexaco].map((d) => d.source.page)))
const texte = (r) => [...r.paragraphes, ...r.puces, ...r.suiteParagraphes].join(' ')
const QUESTIONS = ['Pourquoi ces métiers ?', 'Quelles formations ?', 'Comment choisir entre deux métiers ?', 'Quels sont mes points forts ?',
  'C’est quoi une zone ?', 'Et le salaire ?', 'Parle-moi du Métier fictif E', 'Salut', 'Merci', 'Quel temps fait-il à Paris ?']

test('chaque source de page renvoie à une page qui existe dans le rapport', () => {
  for (const q of QUESTIONS) {
    for (const s of repondreDemo(q, contexte).sources.filter((s) => s.type === 'rapport')) {
      assert.ok(pagesDuRapport.has(s.page), `${q} : page ${s.page} absente du rapport`)
    }
  }
})

test('aucune réponse ne vouvoie, ne note ni ne juge', () => {
  const interdits = /\b(vous|votre|faible|mauvais|moyenne|niveau insuffisant|echec|sur 7|sur 100)\b/
  for (const q of QUESTIONS) assert.doesNotMatch(normaliser(texte(repondreDemo(q, contexte))), interdits, q)
})

test('le salaire et les formations ne sont jamais présentés comme venant du rapport', () => {
  for (const q of ['Et le salaire ?', 'Quelles formations ?']) {
    const r = repondreDemo(q, contexte)
    assert.match(r.paragraphes[0], /ne (parle|liste) pas/)
    assert.ok(r.sources.every((s) => s.type === 'exemple'))
  }
})

test('une question hors du rapport reçoit « je préfère ne pas inventer »', () => {
  const r = repondreDemo('Quel temps fait-il à Paris ?', contexte)
  assert.match(r.paragraphes[0], /ne pas inventer/)
  assert.equal(r.sources.length, 0)
})

test('un métier cité est retrouvé, avec sa page et un lien vers sa fiche', () => {
  const r = repondreDemo('parle moi du metier fictif e', contexte)
  assert.equal(r.sources[0].page, 10)
  assert.equal(r.liens[0].to, '/metier/z2-m3')
})

test('comparer prend les deux premiers préférés', () => {
  const r = repondreDemo('Comment choisir entre deux métiers ?', contexte)
  assert.equal(r.liens.length, 2)
  assert.match(texte(r), /Métier fictif A/)
})

test('la réponse de la route /chat est lue : phrases, pages triées sans doublon', () => {
  const r = lireReponseBackend({
    reponse: 'Premier. Second.', phrases: [{ texte: 'Premier.', faits: ['f1'] }, { texte: 'Second.', faits: ['f2'] }],
    sources: [{ fait: 'f2', page: 6 }, { fait: 'f1', page: 4 }, { fait: 'f3', page: 4 }, { fait: 'f4' }],
    dans_rapport: true, genere_par: { mode: 'ia' },
  })
  assert.deepEqual(r.paragraphes, ['Premier.', 'Second.'])
  assert.deepEqual(r.sources.map((s) => s.page), [4, 6])
  assert.equal(r.mode, 'ia')
})

test('hors rapport : la phrase fixe du backend, sans source ; repli du backend : null', () => {
  const r = lireReponseBackend({ reponse: "Ce n'est pas dans ton rapport.", phrases: [], sources: [], dans_rapport: false, genere_par: { mode: 'ia' } })
  assert.deepEqual(r.paragraphes, ["Ce n'est pas dans ton rapport."])
  assert.equal(r.sources.length, 0)
  assert.equal(lireReponseBackend({ reponse: 'Je ne peux pas te répondre', genere_par: { mode: 'repli' } }), null)
  assert.throws(() => lireReponseBackend({ reponse: '', genere_par: { mode: 'ia' } }))
})

test('API injoignable : le rapport répond quand même, en le signalant', async () => {
  const r = await demander('Quels sont mes points forts ?', { ...contexte, acces: { api: 'http://127.0.0.1:9', jeton: 'a'.repeat(32) } })
  assert.equal(r.mode, 'repli')
  assert.ok(r.sources.length > 0)
})
