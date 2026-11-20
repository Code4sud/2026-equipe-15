import test from 'node:test'
import assert from 'node:assert/strict'
import { CLE_ASSISTANT, assistant, creerMagasin, etatVide, oublierDiscussion, relire, serialiser, versHistorique } from './assistantEtat.js'

// Données entièrement inventées.
const question = { de: 'moi', texte: 'Pourquoi ces métiers ?' }
const reponse = {
  de: 'ia',
  paragraphes: ['Réponse inventée.', 'Deuxième phrase inventée.'],
  sources: [{ type: 'rapport', page: 8, label: 'Ton rapport, page 8' }],
  suggestions: ['Quelles formations ?'],
}
const etat = { ...etatVide(), messages: [question, reponse], ouvertSur: '/', pleinEcran: true, saisie: 'brouillon', attente: true, focus: 3 }

function fauxStockage(depart = {}) {
  const donnees = new Map(Object.entries(depart))
  return {
    donnees,
    getItem: (cle) => (donnees.has(cle) ? donnees.get(cle) : null),
    setItem: (cle, valeur) => donnees.set(cle, String(valeur)),
    removeItem: (cle) => donnees.delete(cle),
  }
}
const stockageCasse = {
  getItem() { throw new Error('interdit') },
  setItem() { throw new Error('interdit') },
  removeItem() { throw new Error('interdit') },
}

test('aller-retour : la discussion, la fenêtre et la saisie reviennent, pas l’attente', () => {
  const lu = relire(serialiser(etat, 'rapport-a'), 'rapport-a')
  assert.deepEqual(lu.messages, [question, reponse])
  assert.equal(lu.ouvertSur, '/')
  assert.equal(lu.pleinEcran, true)
  assert.equal(lu.saisie, 'brouillon')
  assert.equal(lu.attente, false)
  assert.equal(lu.focus, 0)
})

test('un autre rapport ne récupère pas la discussion', () => {
  assert.deepEqual(relire(serialiser(etat, 'rapport-a'), 'rapport-b'), etatVide())
  assert.deepEqual(relire(serialiser(etat, 'rapport-a'), null), etatVide())
})

test('un contenu abîmé donne un assistant vide, sans erreur', () => {
  for (const brut of [null, undefined, '', 'pas du json', '{"v":1', '42', 'null', '[]', '{"v":99,"rapport":"a","messages":[]}', 12]) {
    assert.deepEqual(relire(brut, 'a'), etatVide(), String(brut))
  }
})

test('les messages abîmés sont écartés, les champs mal typés remis à leur valeur de départ', () => {
  const brut = JSON.stringify({
    v: 1,
    rapport: 'a',
    messages: [question, null, 'texte', { de: 'moi' }, { de: 'moi', texte: '  ' }, { de: 'ia', paragraphes: 'x' }, { de: 'ia', paragraphes: [] }, { de: 'autre', texte: 'x' }, reponse],
    ouvertSur: 12,
    pleinEcran: 'oui',
    saisie: { a: 1 },
  })
  const lu = relire(brut, 'a')
  assert.deepEqual(lu.messages, [question, reponse])
  assert.equal(lu.ouvertSur, null)
  assert.equal(lu.pleinEcran, false)
  assert.equal(lu.saisie, '')
  assert.deepEqual(relire(JSON.stringify({ v: 1, rapport: 'a', messages: 'x' }), 'a').messages, [])
})

test('une question restée sans réponse revient dans la zone de saisie', () => {
  const lu = relire(serialiser({ ...etatVide(), messages: [question, reponse, { de: 'moi', texte: 'Et après ?' }] }, 'a'), 'a')
  assert.deepEqual(lu.messages, [question, reponse])
  assert.equal(lu.saisie, 'Et après ?')
  const avecBrouillon = relire(serialiser({ ...etatVide(), messages: [question], saisie: 'déjà écrit' }, 'a'), 'a')
  assert.deepEqual(avecBrouillon.messages, [])
  assert.equal(avecBrouillon.saisie, 'déjà écrit')
})

test('l’historique envoyé à l’IA : un texte par message', () => {
  assert.deepEqual(versHistorique([question, reponse]), [
    { de: 'moi', texte: 'Pourquoi ces métiers ?' },
    { de: 'ia', texte: 'Réponse inventée. Deuxième phrase inventée.' },
  ])
})

test('le magasin : poser une question ajoute la question puis la réponse, et prévient les abonnés', async () => {
  const stockage = fauxStockage()
  const magasin = creerMagasin({ stockage, rapportId: 'a' })
  let appels = 0
  const arreter = magasin.abonner(() => { appels += 1 })
  magasin.ecrire('brouillon')
  let recu
  const fini = magasin.poser('  Pourquoi ces métiers ?  ', async (q, historique) => {
    recu = { q, historique }
    return { paragraphes: ['Réponse inventée.'] }
  })
  assert.equal(magasin.lire().attente, true)
  assert.equal(magasin.lire().saisie, '')
  assert.deepEqual(magasin.lire().messages, [question])
  // Pendant l'attente, une seconde question est refusée.
  assert.equal(await magasin.poser('Autre question', async () => ({ paragraphes: ['x'] })), false)
  assert.equal(await fini, true)
  assert.deepEqual(recu, { q: 'Pourquoi ces métiers ?', historique: [] })
  assert.equal(magasin.lire().attente, false)
  assert.deepEqual(magasin.lire().messages, [question, { de: 'ia', paragraphes: ['Réponse inventée.'] }])
  assert.ok(appels >= 3)
  arreter()

  // Un autre magasin sur le même stockage (autre page, rechargement) retrouve la discussion.
  assert.deepEqual(creerMagasin({ stockage, rapportId: 'a' }).lire().messages, magasin.lire().messages)
  assert.deepEqual(creerMagasin({ stockage, rapportId: 'b' }).lire().messages, [])
})

test('le magasin : une réponse qui échoue ou qui est abîmée débloque l’attente', async () => {
  const magasin = creerMagasin({ stockage: fauxStockage(), rapportId: 'a' })
  await magasin.poser('Question', async () => { throw new Error('panne') })
  assert.equal(magasin.lire().attente, false)
  assert.equal(magasin.lire().messages.at(-1).de, 'ia')
  await magasin.poser('Question', async () => null)
  assert.equal(magasin.lire().attente, false)
  assert.equal(magasin.lire().messages.length, 4)
  assert.ok(magasin.lire().messages.at(-1).paragraphes[0].length > 0)
})

test('le magasin : « Nouvelle discussion » vide tout, même le stockage, et écarte la réponse en retard', async () => {
  const stockage = fauxStockage()
  const magasin = creerMagasin({ stockage, rapportId: 'a' })
  let repondre
  const fini = magasin.poser('Question', () => new Promise((ok) => { repondre = ok }))
  assert.ok(stockage.donnees.has(CLE_ASSISTANT))
  magasin.vider()
  assert.equal(stockage.donnees.has(CLE_ASSISTANT), false)
  assert.equal(magasin.lire().attente, false)
  repondre({ paragraphes: ['Trop tard.'] })
  assert.equal(await fini, false)
  assert.deepEqual(magasin.lire().messages, [])
  // La fenêtre ouverte le reste, sans la discussion.
  magasin.ouvrir('/')
  await magasin.poser('Question', async () => ({ paragraphes: ['Réponse inventée.'] }))
  magasin.vider()
  assert.equal(magasin.lire().ouvertSur, '/')
  assert.deepEqual(relire(stockage.getItem(CLE_ASSISTANT), 'a').messages, [])
  assert.equal(relire(stockage.getItem(CLE_ASSISTANT), 'a').ouvertSur, '/')
})

test('le magasin : la fenêtre est ouverte sur une page, et le focus n’est demandé que sur demande', () => {
  const magasin = creerMagasin({ stockage: fauxStockage(), rapportId: 'a' })
  magasin.ouvrir('/metier/fictif-a')
  assert.equal(magasin.lire().ouvertSur, '/metier/fictif-a')
  assert.equal(magasin.lire().focus, 0)
  magasin.ouvrir('/', { focus: true })
  assert.equal(magasin.lire().focus, 1)
  magasin.basculerPleinEcran()
  assert.equal(magasin.lire().pleinEcran, true)
  magasin.fermer()
  assert.equal(magasin.lire().ouvertSur, null)
})

test('le magasin : brancher un autre rapport écarte la discussion, rebrancher le même la garde', async () => {
  const stockage = fauxStockage()
  const magasin = creerMagasin({ stockage })
  magasin.brancher('a')
  await magasin.poser('Question', async () => ({ paragraphes: ['Réponse inventée.'] }))
  magasin.brancher('a')
  assert.equal(magasin.lire().messages.length, 2)
  magasin.brancher('b')
  assert.deepEqual(magasin.lire().messages, [])
})

test('le magasin : sans stockage, ou avec un stockage qui refuse tout, la discussion marche en mémoire', async () => {
  for (const stockage of [null, stockageCasse]) {
    const magasin = creerMagasin({ stockage, rapportId: 'a' })
    magasin.ecrire('abc')
    await magasin.poser('Question', async () => ({ paragraphes: ['Réponse inventée.'] }))
    assert.equal(magasin.lire().messages.length, 2)
    magasin.vider()
    assert.deepEqual(magasin.lire().messages, [])
  }
})

test('lien « recommencer » : la discussion est oubliée et la fenêtre refermée, même avant de connaître le rapport', async () => {
  // Au démarrage, le rapport n'est pas encore branché : rien ne doit casser.
  oublierDiscussion()
  assert.deepEqual(assistant.lire().messages, [])
  assistant.brancher('rapport-inventé')
  assistant.ouvrir('/')
  await assistant.poser('Question', async () => ({ paragraphes: ['Réponse inventée.'] }))
  assert.equal(assistant.lire().messages.length, 2)
  oublierDiscussion()
  assert.deepEqual(assistant.lire().messages, [])
  assert.equal(assistant.lire().ouvertSur, null)
  // Rien ne revient au démarrage suivant, quel que soit le stockage disponible.
  let brut = null
  try { brut = globalThis.sessionStorage?.getItem(CLE_ASSISTANT) ?? null } catch { /* pas de stockage ici */ }
  assert.deepEqual(relire(brut, 'rapport-inventé').messages, [])
})
