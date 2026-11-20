import test from 'node:test'
import assert from 'node:assert/strict'
import { lireJeton, adresseApi, urlPdf, preparerDonnees, demanderResume, chercherMetiers, CLE_JETON } from './api.js'

const JETON = 'a'.repeat(32)
const API = 'http://localhost:8000'

function stockageVide(contenu = {}) {
  const donnees = { ...contenu }
  return {
    getItem: (cle) => donnees[cle] ?? null,
    setItem: (cle, valeur) => { donnees[cle] = String(valeur) },
    removeItem: (cle) => { delete donnees[cle] },
    donnees,
  }
}

const reponse = (status, corps) => ({ ok: status >= 200 && status < 300, status, json: async () => corps })

test('lireJeton : dans le lien du jeune, avant ou après le #', () => {
  assert.equal(lireJeton({ hash: `#/?r=${JETON}`, search: '' }), JETON)
  assert.equal(lireJeton({ hash: `#/onboarding?r=${JETON}`, search: '' }), JETON)
  assert.equal(lireJeton({ hash: '#/', search: `?r=${JETON}` }), JETON)
  assert.equal(lireJeton({ hash: '#/?r=exemple', search: '' }), 'exemple')
  assert.equal(lireJeton({ hash: '#/', search: '' }), null)
  assert.equal(lireJeton({ hash: '#/?r=pas-un-jeton', search: '' }), null)
})

test('adresseApi : absente, vide ou avec une barre finale', () => {
  assert.equal(adresseApi({}), null)
  assert.equal(adresseApi({ VITE_API_URL: '  ' }), null)
  assert.equal(adresseApi({ VITE_API_URL: 'http://localhost:8000/' }), API)
  assert.equal(urlPdf(API, JETON), `${API}/report/${JETON}/pdf`)
})

test('preparerDonnees : sans API ou sans jeton, on montre l’exemple inventé', async () => {
  const jamais = async () => { throw new Error('aucun appel attendu') }
  assert.deepEqual(
    await preparerDonnees({ env: {}, lieu: { hash: `#/?r=${JETON}`, search: '' }, stockage: stockageVide(), fetch: jamais }),
    { mode: 'exemple' },
  )
  assert.deepEqual(
    await preparerDonnees({ env: { VITE_API_URL: API }, lieu: { hash: '#/', search: '' }, stockage: stockageVide(), fetch: jamais }),
    { mode: 'exemple' },
  )
})

test('preparerDonnees : le jeton du lien donne le rapport, et il est retenu pour la prochaine visite', async () => {
  const appels = []
  const stockage = stockageVide()
  const fetch = async (url) => { appels.push(url); return reponse(200, { id: JETON, metiers: [] }) }
  const r = await preparerDonnees({ env: { VITE_API_URL: API }, lieu: { hash: `#/?r=${JETON}`, search: '' }, stockage, fetch })
  assert.deepEqual(r, { mode: 'api', api: API, jeton: JETON, rapport: { id: JETON, metiers: [] } })
  assert.deepEqual(appels, [`${API}/report/${JETON}`])
  assert.equal(stockage.donnees[CLE_JETON], JETON)

  // Visite suivante sans jeton dans l'adresse : celui qui est retenu sert
  const suite = await preparerDonnees({ env: { VITE_API_URL: API }, lieu: { hash: '#/', search: '' }, stockage, fetch })
  assert.equal(suite.mode, 'api')
})

test('preparerDonnees : ?r=exemple oublie le jeton et revient à l’exemple', async () => {
  const stockage = stockageVide({ [CLE_JETON]: JETON })
  const r = await preparerDonnees({
    env: { VITE_API_URL: API }, lieu: { hash: '#/?r=exemple', search: '' }, stockage,
    fetch: async () => { throw new Error('aucun appel attendu') },
  })
  assert.deepEqual(r, { mode: 'exemple' })
  assert.equal(stockage.donnees[CLE_JETON], undefined)
})

test('preparerDonnees : lien inconnu ou API arrêtée, on le dit au lieu de montrer un faux rapport', async () => {
  const base = { env: { VITE_API_URL: API }, lieu: { hash: `#/?r=${JETON}`, search: '' } }
  const retenu = stockageVide({ [CLE_JETON]: JETON })
  const inconnu = await preparerDonnees({ ...base, stockage: retenu, fetch: async () => reponse(404, { detail: 'Rapport introuvable' }) })
  assert.deepEqual(inconnu, { mode: 'erreur', raison: 'introuvable' })
  assert.equal(retenu.donnees[CLE_JETON], undefined, 'un jeton inconnu est oublié')
  const arretee = await preparerDonnees({ ...base, stockage: stockageVide(), fetch: async () => { throw new TypeError('Failed to fetch') } })
  assert.deepEqual(arretee, { mode: 'erreur', raison: 'injoignable' })
  const cassee = await preparerDonnees({ ...base, stockage: stockageVide(), fetch: async () => reponse(500, {}) })
  assert.deepEqual(cassee, { mode: 'erreur', raison: 'injoignable' })
})

test('demanderResume : envoie les choix du jeune, sans la progression de l’écran', async () => {
  let recu
  const fetch = async (url, options) => { recu = { url, options }; return reponse(200, { points: [], texte: '' }) }
  const onboarding = {
    termine: true, interets_metiers: { 'z1-m1': 'interesse' }, favoris: { 1: 'z1-m1' }, ajouts_psy: [],
    progression: { ecran: 'recap', metier: 0, zone: 0 },
  }
  assert.deepEqual(await demanderResume({ api: API, jeton: JETON, onboarding, fetch }), { points: [], texte: '' })
  assert.equal(recu.url, `${API}/report/${JETON}/resume`)
  assert.equal(recu.options.method, 'POST')
  assert.deepEqual(JSON.parse(recu.options.body), {
    onboarding: { termine: true, interets_metiers: { 'z1-m1': 'interesse' }, favoris: { 1: 'z1-m1' }, ajouts_psy: [] },
  })
  await assert.rejects(demanderResume({ api: API, jeton: JETON, onboarding, fetch: async () => reponse(500, {}) }))
})

test('recherche de métiers : bonne adresse, résultats mis à la forme de ajouts_psy', async () => {
  let appele
  const fetch = async (url) => {
    appele = url
    return { ok: true, json: async () => ({ resultats: [
      { nom: 'Métier FICTIF de la table', code: '11-1011.00', dans_rapport: null },
      { nom: 'Métier FICTIF du rapport', code: '22-2022.00', dans_rapport: 'z1-m1' },
      { nom: '', code: '33' }, { nom: 'sans code' },
    ] }) }
  }
  const r = await chercherMetiers({ api: API, jeton: JETON, q: 'mét ier', fetch })
  assert.equal(appele, `${API}/report/${JETON}/metiers?q=m%C3%A9t%20ier&limite=8`)
  assert.deepEqual(r, [
    { id: 'onet-11-1011.00', nom: 'Métier FICTIF de la table', dansRapport: null },
    { id: 'onet-22-2022.00', nom: 'Métier FICTIF du rapport', dansRapport: 'z1-m1' },
  ])
  await assert.rejects(chercherMetiers({ api: API, jeton: JETON, q: 'x', fetch: async () => ({ ok: false, status: 503 }) }))
})
