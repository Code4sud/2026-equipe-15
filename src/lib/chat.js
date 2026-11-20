// L'assistant (étape 5). Deux façons de répondre, avec la même forme de réponse :
//
// 1. Le backend : POST {api}/chat/{jeton} (route de Julien, backend/src/routes/chat.js),
//    avec l'adresse et le jeton choisis au démarrage (lib/api.js, lib/donnees.js).
// 2. Le mode démo, sans réseau ni IA : des réponses construites uniquement avec les données du
//    rapport (et les exemples inventés étiquetés comme tels). Il sert de repli si le backend est
//    arrêté, pour que la démo ne tombe jamais.
//
// Une réponse : { paragraphes: [string], puces?: [string], sources: [Source], liens?: [{ to, label }],
//                 suggestions?: [string], mode: 'ia' | 'demo' | 'repli' }
// Une source :  { type: 'rapport', page, label } | { type: 'exemple', label, url? }
//
// Règles du sujet : tutoyer, ne rien inventer, savoir dire « ce n'est pas dans ton
// rapport », jamais de verdict ni de comparaison avec les autres.

const DUREES = { 1: '0 à 6 mois', 2: '3 mois à 2 ans', 3: '1 à 4 ans', 4: '2 à 6 ans', 5: '4 à 10 ans' }
const AVIS = { interesse: 'ça t’intéresse', plus_tard: 'pas pour l’instant', non: 'pas intéressé' }
export const SUGGESTIONS_DEPART = ['Pourquoi ces métiers ?', 'Quelles formations ?', 'Comment choisir entre deux métiers ?']
const SUGGESTIONS_AIDE = ['Quels sont mes points forts ?', 'C’est quoi une zone ?', 'Et le salaire ?']
const LIEN_REGION = 'https://www.orientation-regionsud.fr/'

export const normaliser = (s) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, ' ')

const contient = (q, mots) => mots.some((m) => q.includes(m))
const liste = (noms) => (noms.length <= 1 ? noms.join('') : `${noms.slice(0, -1).join(', ')} et ${noms.at(-1)}`)
const srcPage = (page, label) => ({ type: 'rapport', page, label: label ?? `Ton rapport, page ${page}` })
const SRC_EXEMPLE = { type: 'exemple', label: 'Exemple inventé pour la démo', url: LIEN_REGION }

function sansDoublons(sources) {
  const vus = new Set()
  return sources.filter((s) => {
    const cle = `${s.type}-${s.page ?? s.label}`
    if (vus.has(cle)) return false
    vus.add(cle)
    return true
  })
}

// --- Ce que le mode démo sait lire dans le rapport ---------------------------------------------

function lireContexte({ rapport, onboarding, infosMetiers = {} }) {
  const metiers = rapport?.metiers ?? []
  const parId = (id) => metiers.find((m) => m.id === id)
  const favoris = Object.keys(onboarding?.favoris ?? {})
    .sort()
    .map((z) => parId(onboarding.favoris[z]))
    .filter(Boolean)
  const forts = (dims) => (dims ?? []).filter((d) => d.point_fort)
  const aptitudes = [...(rapport?.aptitudes ?? [])].sort((a, b) => b.value - a.value)
  return {
    metiers, favoris, infosMetiers,
    avis: onboarding?.interets_metiers ?? {},
    interets: forts(rapport?.interets_riasec),
    personnalite: forts(rapport?.personnalite_hexaco),
    aptitude: aptitudes[0],
  }
}

// Les pages du « Champ des possibles », en une seule source : « pages 8 à 14 ».
function pagesMetiers(metiers) {
  const pages = [...new Set(metiers.map((m) => m.source?.page).filter(Boolean))].sort((a, b) => a - b)
  if (!pages.length) return []
  const [debut, fin] = [pages[0], pages.at(-1)]
  return [srcPage(debut, debut === fin ? undefined : `Ton rapport, pages ${debut} à ${fin}`)]
}

// --- Les réponses du mode démo -----------------------------------------------------------------

function surUnMetier(m, c) {
  const avis = c.avis[m.id]
  return {
    paragraphes: [
      `${m.nom} est dans ton rapport, avec un temps de préparation de ${DUREES[m.zone]}.`,
      `Ce que dit ton rapport : « ${m.description} »`,
      avis ? `Tu as répondu : ${AVIS[avis]}. Tu peux changer d’avis quand tu veux.` : 'Tu n’as pas encore donné ton avis sur ce métier.',
    ],
    sources: [srcPage(m.source.page)],
    liens: [{ to: `/metier/${m.id}`, label: `Voir la fiche de ${m.nom}` }],
    suggestions: ['Quelles formations ?', 'Comment choisir entre deux métiers ?'],
  }
}

function pourquoiCesMetiers(c) {
  if (!c.metiers.length) return pasDansLeRapport()
  const paragraphes = ['Les métiers viennent de la partie « Champ des possibles » de ton rapport. Ils sont rangés par temps de préparation.']
  const sources = [...pagesMetiers(c.metiers)]
  if (c.interets.length) {
    paragraphes.push(`Côté intérêts, ton rapport met en avant ${liste(c.interets.map((d) => d.label))}.`)
    sources.unshift(srcPage(c.interets[0].source.page))
  }
  if (c.favoris.length) {
    paragraphes.push(`Tu as gardé comme préférés : ${liste(c.favoris.map((m) => `${m.nom} (${DUREES[m.zone]})`))}.`)
  }
  paragraphes.push('Ce sont des pistes, pas des consignes. Un métier absent de ton rapport n’est pas fermé pour toi.')
  return {
    paragraphes, sources,
    liens: [{ to: '/metiers', label: 'Voir tous les métiers de ton rapport' }],
    suggestions: ['Quels sont mes points forts ?', 'Comment choisir entre deux métiers ?'],
  }
}

function pointsForts(c) {
  const puces = []
  const sources = []
  if (c.interets.length) {
    puces.push(`Tes intérêts : ${liste(c.interets.map((d) => d.label))}`)
    sources.push(srcPage(c.interets[0].source.page))
  }
  if (c.personnalite.length) {
    puces.push(`Ta personnalité : ${liste(c.personnalite.map((d) => d.label.toLowerCase()))}`)
    sources.push(srcPage(c.personnalite[0].source.page))
  }
  if (c.aptitude) {
    puces.push(`L’aptitude qui ressort le plus chez toi : ${c.aptitude.label.toLowerCase()}`)
    sources.push(srcPage(c.aptitude.source.page))
  }
  if (!puces.length) return pasDansLeRapport()
  return {
    paragraphes: ['Voici ce que ton rapport met en avant chez toi :'],
    puces,
    suiteParagraphes: ['C’est une image à un moment donné : ça peut changer avec le temps, la fatigue ou la motivation du jour.'],
    sources,
    liens: [{ to: '/profil', label: 'Explorer ton profil' }],
    suggestions: ['Pourquoi ces métiers ?', 'C’est quoi une zone ?'],
  }
}

function choisirEntreDeux(c) {
  const [a, b] = c.favoris.length >= 2 ? c.favoris : c.metiers.filter((m) => c.avis[m.id] === 'interesse')
  if (!a || !b) {
    return {
      paragraphes: [
        'Pour comparer, il te faut au moins deux métiers qui te parlent.',
        'Commence par donner ton avis sur les métiers de ton rapport, puis reviens me voir.',
      ],
      sources: [],
      liens: [{ to: '/onboarding', label: 'Choisir mes métiers préférés' }],
      suggestions: ['Pourquoi ces métiers ?'],
    }
  }
  return {
    paragraphes: [`Regardons ${a.nom} et ${b.nom} côte à côte :`],
    puces: [a, b].map((m) => `${m.nom} : ${DUREES[m.zone]} de préparation${c.avis[m.id] ? `, et tu as dit « ${AVIS[c.avis[m.id]]} »` : ''}`),
    suiteParagraphes: [
      'Quelques questions pour t’aider, il n’y a pas de mauvaise réponse :',
      '• Lequel tu as le plus envie de découvrir en vrai ?',
      '• Tu préfères commencer vite, ou te former plus longtemps ?',
      '• Tu peux en parler au psychologue ou à ta Mission locale : c’est toi qui décides.',
    ],
    sources: [srcPage(a.source.page), srcPage(b.source.page)],
    liens: [
      { to: `/metier/${a.id}`, label: `Fiche de ${a.nom}` },
      { to: `/metier/${b.id}`, label: `Fiche de ${b.nom}` },
    ],
    suggestions: ['Quelles formations ?', 'Et le salaire ?'],
  }
}

function formations(c) {
  const exemples = (c.favoris.length ? c.favoris : c.metiers)
    .flatMap((m) => (c.infosMetiers[m.id]?.formations ?? []).slice(0, 1).map((f) => `${f.nom} à ${f.ville}, ${f.duree} (pour ${m.nom})`))
    .slice(0, 3)
  return {
    paragraphes: [
      'Ton rapport ne liste pas de formations.',
      ...(exemples.length ? ['Pour la démo, voici des exemples inventés, pas des offres réelles :'] : []),
    ],
    puces: exemples,
    suiteParagraphes: ['Pour les vraies formations près de chez toi, regarde sur orientation-regionsud.fr ou demande à ta Mission locale.'],
    sources: exemples.length ? [SRC_EXEMPLE] : [],
    liens: [{ to: '/formations', label: 'Voir les formations' }, { href: LIEN_REGION, label: 'orientation-regionsud.fr' }],
    suggestions: ['Et le salaire ?', 'Comment choisir entre deux métiers ?'],
  }
}

function salaire(c) {
  const exemples = c.favoris
    .filter((m) => c.infosMetiers[m.id]?.salaire)
    .map((m) => `${m.nom} : ${c.infosMetiers[m.id].salaire.valeur} ${c.infosMetiers[m.id].salaire.precision}`)
  return {
    paragraphes: [
      'Ton rapport ne parle pas de salaire, alors je ne vais pas en inventer.',
      ...(exemples.length ? ['Sur les fiches de tes préférés, il y a des exemples inventés pour la démo :'] : []),
    ],
    puces: exemples,
    suiteParagraphes: ['Les vrais chiffres viendront d’orientation-regionsud.fr, avec un lien vers la page utilisée.'],
    sources: exemples.length ? [SRC_EXEMPLE] : [],
    liens: [{ href: LIEN_REGION, label: 'orientation-regionsud.fr' }],
    suggestions: ['Quelles formations ?'],
  }
}

function zones(c) {
  const parZone = [1, 2, 3, 4, 5].map((z) => {
    const n = c.metiers.filter((m) => m.zone === z).length
    return `${DUREES[z]} : ${n ? `${n} métier${n > 1 ? 's' : ''}` : 'aucun métier dans ton rapport'}`
  })
  return {
    paragraphes: ['Une zone, c’est le temps de préparation pour accéder à un métier. Ce n’est pas un niveau, et aucune zone n’est meilleure qu’une autre.'],
    puces: parZone,
    suiteParagraphes: ['Les zones ne ferment aucune porte.'],
    sources: pagesMetiers(c.metiers),
    suggestions: ['Pourquoi ces métiers ?', 'Comment choisir entre deux métiers ?'],
  }
}

function bonjour() {
  return {
    paragraphes: ['Salut ! Je suis là pour t’aider à comprendre ton rapport. Pose-moi une question, ou choisis une idée en dessous.'],
    sources: [],
    suggestions: SUGGESTIONS_DEPART,
  }
}

function merci() {
  return { paragraphes: ['Avec plaisir ! Si une autre question te vient, je suis là.'], sources: [], suggestions: SUGGESTIONS_AIDE }
}

function pasDansLeRapport() {
  return {
    paragraphes: [
      'Je ne trouve pas ça dans ton rapport, et je préfère ne pas inventer.',
      'Note ta question pour le psychologue ou ta Mission locale. En attendant, je peux t’aider sur ça :',
    ],
    sources: [],
    suggestions: [...SUGGESTIONS_DEPART.slice(0, 2), ...SUGGESTIONS_AIDE.slice(0, 1)],
  }
}

export function repondreDemo(question, contexte) {
  const q = normaliser(question)
  const c = lireContexte(contexte)
  const metier = c.metiers.find((m) => new RegExp(`(^|\\W)${normaliser(m.nom).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|\\W)`).test(q))

  let r
  if (metier) r = surUnMetier(metier, c)
  else if (contient(q, ['salaire', 'gagne', 'argent', 'paye', 'combien on'])) r = salaire(c)
  else if (contient(q, ['formation', 'etude', 'ecole', 'diplome', 'apprentissage', 'alternance'])) r = formations(c)
  else if (contient(q, ['choisir', 'hesite', 'entre deux', 'departager', 'comparer'])) r = choisirEntreDeux(c)
  else if (contient(q, ['point fort', 'points forts', 'qualite', 'profil', 'je suis bon', 'force'])) r = pointsForts(c)
  else if (contient(q, ['zone', 'temps de preparation', 'combien de temps', 'duree'])) r = zones(c)
  else if (contient(q, ['pourquoi', 'metier', 'propose'])) r = pourquoiCesMetiers(c)
  else if (contient(q, ['merci', 'super', 'top', 'cool'])) r = merci()
  else if (/^(salut|bonjour|coucou|hello|wesh|yo)\b/.test(q.trim())) r = bonjour()
  else r = pasDansLeRapport()

  return { puces: [], suiteParagraphes: [], liens: [], suggestions: [], ...r, sources: sansDoublons(r.sources), mode: 'demo' }
}

// --- Le backend ----------------------------------------------------------------------------------
// Route de Julien (branche julien/chatbot, backend/src/routes/chat.js) :
//   POST {api}/chat/{jeton}, corps { question (500 caractères au plus), historique [{ de, texte }], onboarding }
//   -> { reponse, phrases [{ texte, faits }], sources [{ fait, page, texte }], dans_rapport, genere_par { mode } }
// L'adresse et le jeton viennent de lib/donnees.js (« acces »), choisis au démarrage par lib/api.js.

export const QUESTION_MAX = 500

// Lit la réponse de la route /chat. Renvoie null si le modèle n'a pas pu répondre (repli côté backend) :
// le site répond alors lui-même avec le rapport, plutôt qu'un simple « réessaie plus tard ».
export function lireReponseBackend(json) {
  if (json?.genere_par?.mode === 'repli') return null
  const phrases = Array.isArray(json?.phrases) ? json.phrases.map((p) => p?.texte?.trim()).filter(Boolean) : []
  const paragraphes = phrases.length ? phrases : [String(json?.reponse ?? '').trim()].filter(Boolean)
  if (!paragraphes.length) throw new Error('Réponse vide')
  // Une source est une page du rapport, ou une fiche du site de la Région (adresse vérifiée ici).
  const pages = (json.sources ?? []).filter((s) => Number.isInteger(s?.page)).map((s) => srcPage(s.page))
  const fiches = (json.sources ?? [])
    .filter((s) => typeof s?.url === 'string' && s.url.startsWith('https://www.orientation-regionsud.fr/'))
    .map((s) => ({ type: 'web', url: s.url, label: String(s.titre ?? 'orientation-regionsud.fr') }))
  const horsRapport = json.dans_rapport === false
  return {
    paragraphes, puces: [], suiteParagraphes: [],
    // Pistes pour chercher ailleurs quand le site de la Région n'a pas de fiche (liens construits par l'API).
    liens: (Array.isArray(json.pistes) ? json.pistes : [])
      .filter((p) => typeof p?.url === 'string' && p.url.startsWith('https://') && typeof p?.titre === 'string')
      .map((p) => ({ href: p.url, label: p.titre })),
    sources: [...sansDoublons(pages).sort((a, b) => a.page - b.page), ...sansDoublons(fiches)],
    suggestions: horsRapport ? SUGGESTIONS_DEPART : [],
    mode: 'ia',
  }
}

async function demanderAuBackend(question, { api, jeton }, historique, onboarding) {
  const { termine, interets_metiers, favoris, ajouts_psy } = onboarding ?? {}
  const rep = await fetch(`${api}/chat/${jeton}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: question.slice(0, QUESTION_MAX),
      historique: historique.slice(-6),
      onboarding: { termine, interets_metiers, favoris, ajouts_psy },
    }),
    signal: AbortSignal.timeout(60000), // un petit modèle local peut prendre du temps
  })
  if (!rep.ok) throw new Error(`HTTP ${rep.status}`)
  return lireReponseBackend(await rep.json())
}

// Point d'entrée de l'interface. Avec l'API (contexte.acces) : l'IA du backend ; si elle ne répond pas,
// le mode démo répond avec le même rapport, en le signalant. Sans API : le mode démo. Jamais d'écran d'erreur.
// historique : [{ de: 'moi' | 'ia', texte }], la forme attendue par la route.
export async function demander(question, { historique = [], acces = null, ...contexte }) {
  if (acces?.api && acces?.jeton) {
    try {
      const r = await demanderAuBackend(question, acces, historique, contexte.onboarding)
      if (r) return r
    } catch {
      /* API arrêtée, route absente ou trop lente : réponse construite avec le rapport */
    }
    return { ...repondreDemo(question, contexte), mode: 'repli' }
  }
  await new Promise((ok) => setTimeout(ok, 450 + Math.random() * 400)) // le temps de « réfléchir »
  return repondreDemo(question, contexte)
}
