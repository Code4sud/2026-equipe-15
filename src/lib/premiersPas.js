// Les « premiers pas » de l'accueil : une réserve ordonnée d'étapes, déduite du rapport et des choix
// du jeune par des règles simples, sans IA. Chaque étape mène à une page du site, à un site public,
// à une action du site (action: 'assistant' ouvre l'assistant), ou à une action dans la vraie vie
// (sans lien). Fonctions pures : rien n'est lu ni écrit ici.

export const NOMBRE_VISIBLE = 4

const LIEN_STAGE = 'https://www.1jeune1solution.gouv.fr/'

// metiers : rapport.metiers ({ id, nom, zone, source: { page } }).
// durees : { 1: '0 à 6 mois', … } pour nommer une zone par son temps de préparation.
export function construireReserve({ metiers: recus, onboarding = {}, durees = {} } = {}) {
  const metiers = Array.isArray(recus) ? recus : []
  const parId = new Map(metiers.map((m) => [m.id, m]))
  const avis = onboarding?.interets_metiers ?? {}
  const choix = onboarding?.favoris ?? {}
  const favoris = Object.keys(choix)
    .sort()
    .map((zone) => parId.get(choix[zone]))
    .filter(Boolean)
  const idsFavoris = new Set(favoris.map((m) => m.id))
  const fiche = (m) => ({ id: `fiche-${m.id}`, texte: `Lis la fiche de ${m.nom}`, lien: `/metier/${m.id}` })
  const etapes = []

  if (favoris.length === 0) {
    etapes.push({ id: 'choisir', texte: 'Choisis tes métiers préférés', lien: '/onboarding' })
  } else {
    etapes.push(...favoris.map(fiche))
    etapes.push({ id: 'formations', texte: `Regarde les formations pour ${favoris[0].nom}`, lien: `/formations?metier=${encodeURIComponent(favoris[0].id)}` })
  }
  etapes.push({ id: 'synthese', texte: 'Écoute le résumé de ton rapport', lien: '/synthese' })
  etapes.push({ id: 'profil', texte: 'Regarde ton profil', lien: '/profil' })
  etapes.push({ id: 'assistant', texte: 'Pose une question à ton assistant', action: 'assistant' })

  const page = favoris[0]?.source?.page
  if (Number.isInteger(page)) {
    etapes.push({ id: `rapport-${favoris[0].id}`, texte: `Retrouve ${favoris[0].nom} dans ton rapport`, lien: `/rapport/${page}` })
  }
  if (favoris.length >= 2) {
    etapes.push({ id: 'comparer', texte: `Compare ${favoris[0].nom} et ${favoris[1].nom} : note ce qui te plaît dans chacun`, lien: '/metiers' })
  }

  // Les métiers « ça m'intéresse » qui ne sont pas des préférés : trois fiches au plus.
  const interessants = metiers.filter((m) => avis[m.id] === 'interesse' && !idsFavoris.has(m.id))
  etapes.push(...interessants.slice(0, 3).map(fiche))

  const sansAvis = metiers.filter((m) => !avis[m.id]).length
  if (sansAvis > 0) {
    etapes.push({
      id: 'avis',
      texte: sansAvis === 1 ? 'Donne ton avis sur le métier pas encore vu' : `Donne ton avis sur les ${sansAvis} métiers pas encore vus`,
      lien: '/metiers',
    })
  }

  // Une zone sans préféré (seulement si le jeune a déjà commencé à choisir). Même règle que l'onboarding :
  // un préféré se choisit parmi les métiers « ça m'intéresse » ou « pas pour l'instant ». Sans aucun de ces
  // avis dans la zone, l'écran du préféré serait vide : c'est l'étape « avis » qui y mène.
  if (favoris.length > 0) {
    const zonesAvecFavori = new Set(favoris.map((m) => m.zone))
    const aChoisir = (m) => avis[m.id] === 'interesse' || avis[m.id] === 'plus_tard'
    const zonesSans = [...new Set(metiers.filter(aChoisir).map((m) => m.zone))].filter((z) => !zonesAvecFavori.has(z)).sort()
    for (const z of zonesSans) {
      const duree = durees[z]
      etapes.push({
        id: `zone-${z}`,
        texte: duree ? `Choisis un préféré parmi les métiers accessibles en ${duree}` : 'Choisis un préféré dans une autre zone',
        lien: `/onboarding?zone=${z}`,
      })
    }
  }

  for (const ajout of (onboarding?.ajouts_psy ?? []).slice(0, 2)) {
    if (ajout?.id && ajout?.nom) etapes.push({ id: `psy-${ajout.id}`, texte: `Note ce qui t’attire dans ${ajout.nom}` })
  }

  // Dans la vraie vie.
  etapes.push({ id: 'questions', texte: 'Note 3 questions pour le psychologue' })
  etapes.push({ id: 'confiance', texte: 'Parle de tes pistes à quelqu’un de confiance' })
  etapes.push({ id: 'stage', texte: 'Cherche un stage ou une immersion', lien: LIEN_STAGE, externe: true })
  etapes.push({ id: 'mission-locale', texte: 'Prends rendez-vous avec ta Mission locale' })

  // Un identifiant ne sert qu'une fois : la première étape qui le porte gagne.
  const vus = new Set()
  return etapes.filter((e) => !vus.has(e.id) && vus.add(e.id))
}

// Ce que la carte montre : les premières étapes pas encore cochées, les faites, et le compte.
export function repartir(reserve, coches = {}, nombre = NOMBRE_VISIBLE) {
  const restantes = reserve.filter((e) => !coches?.[e.id])
  const faites = reserve.filter((e) => coches?.[e.id])
  return { visibles: restantes.slice(0, nombre), faites, total: reserve.length }
}

// Les étapes qui apparaissent quand on coche ou décoche `id`.
export function nouvellesApres(reserve, coches = {}, id, nombre = NOMBRE_VISIBLE) {
  const avant = new Set(repartir(reserve, coches, nombre).visibles.map((e) => e.id))
  const apres = repartir(reserve, { ...coches, [id]: !coches?.[id] }, nombre).visibles
  return apres.filter((e) => !avant.has(e.id) && e.id !== id)
}
