// Appels à l'API du projet (backend/), qui lit le rapport du jeune et écrit son résumé.
// Le site ne parle jamais au modèle d'IA : c'est l'API qui s'en charge.
//
// Le jeune arrive par un lien qui porte son jeton : …/#/?r=<jeton>. L'adresse de l'API vient de
// VITE_API_URL (fichier .env, voir .env.example). Sans l'un des deux, le site montre l'exemple inventé.

export const CLE_JETON = 'possibles-ai:jeton'
const JETON_VALIDE = /^[0-9a-f]{32}$/
// « ?r=exemple » : oublier son rapport et revoir l'exemple inventé.
const EXEMPLE = 'exemple'

export function lireJeton({ hash = '', search = '' }) {
  const apresLeHash = hash.includes('?') ? hash.slice(hash.indexOf('?')) : ''
  for (const requete of [apresLeHash, search]) {
    const r = new URLSearchParams(requete).get('r')
    if (r === EXEMPLE || JETON_VALIDE.test(r ?? '')) return r
  }
  return null
}

// « recommencer=1 » dans le lien : oublier les choix déjà faits et refaire l'onboarding depuis le début.
// Pratique pour préparer une démonstration ; le paramètre est retiré de l'adresse une fois appliqué.
const requetes = ({ hash = '', search = '' }) => [hash.includes('?') ? hash.slice(hash.indexOf('?')) : '', search]

export function doitRecommencer(lieu) {
  return requetes(lieu).some((requete) => new URLSearchParams(requete).get('recommencer') === '1')
}

export function sansRecommencer(hash) {
  if (!hash.includes('?')) return hash
  const chemin = hash.slice(0, hash.indexOf('?'))
  const parametres = new URLSearchParams(hash.slice(hash.indexOf('?')))
  parametres.delete('recommencer')
  const reste = parametres.toString()
  return reste ? `${chemin}?${reste}` : chemin
}

export function adresseApi(env) {
  const adresse = (env?.VITE_API_URL ?? '').trim().replace(/\/+$/, '')
  return adresse || null
}

export const urlPdf = (api, jeton) => `${api}/report/${jeton}/pdf`

function lireStocke(stockage) {
  try {
    const jeton = stockage.getItem(CLE_JETON)
    return JETON_VALIDE.test(jeton ?? '') ? jeton : null
  } catch {
    return null
  }
}

function retenir(stockage, jeton) {
  try {
    if (jeton) stockage.setItem(CLE_JETON, jeton)
    else stockage.removeItem(CLE_JETON)
  } catch {
    /* stockage indisponible : le lien reste le seul moyen d'ouvrir le rapport */
  }
}

// Décide de ce que le site affiche au démarrage :
//   { mode: 'exemple' }                    l'exemple inventé (pas d'API, ou pas de jeton)
//   { mode: 'api', api, jeton, rapport }   le rapport du jeune, lu par l'API
//   { mode: 'erreur', raison }             un jeton était là, mais le rapport n'a pas pu être lu :
//                                          on le dit, on ne montre pas un faux rapport à sa place
export async function preparerDonnees({ env, lieu, stockage, fetch }) {
  const api = adresseApi(env)
  const duLien = lireJeton(lieu)
  if (duLien === EXEMPLE) retenir(stockage, null)
  const jeton = duLien === EXEMPLE ? null : duLien ?? lireStocke(stockage)
  if (!api || !jeton) return { mode: 'exemple' }

  let reponse
  try {
    reponse = await fetch(`${api}/report/${jeton}`)
  } catch {
    return { mode: 'erreur', raison: 'injoignable' }
  }
  if (reponse.status === 404) {
    // Un jeton qui ne mène à rien n'est pas gardé : la visite suivante ne doit pas retomber sur l'erreur.
    retenir(stockage, null)
    return { mode: 'erreur', raison: 'introuvable' }
  }
  if (!reponse.ok) return { mode: 'erreur', raison: 'injoignable' }
  const rapport = await reponse.json()
  retenir(stockage, jeton)
  return { mode: 'api', api, jeton, rapport }
}

// Le résumé dépend des choix du jeune : on les envoie, sans l'état de l'écran d'onboarding.
// version : 'longue' pour la version détaillée (le résumé, puis un passage sur chaque métier préféré).
export async function demanderResume({ api, jeton, onboarding, fetch, version }) {
  const { termine, interets_metiers, favoris, ajouts_psy } = onboarding ?? {}
  const reponse = await fetch(`${api}/report/${jeton}/resume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ onboarding: { termine, interets_metiers, favoris, ajouts_psy }, ...(version ? { version } : {}) }),
  })
  if (!reponse.ok) throw new Error(`résumé indisponible (${reponse.status})`)
  return reponse.json()
}

// Recherche dans la table des métiers du Centre (O*NET), pour l'écran « Le psychologue t'a parlé
// d'autres métiers ? ». Un métier trouvé devient { id: 'onet-<code>', nom }, la forme de ajouts_psy.
// dans_rapport : l'id du métier s'il est déjà dans le rapport (il n'est alors pas à ajouter).
export const ID_ONET = /^onet-[0-9A-Za-z.-]{1,20}$/

export async function chercherMetiers({ api, jeton, q, fetch, signal }) {
  const reponse = await fetch(`${api}/report/${jeton}/metiers?q=${encodeURIComponent(q)}&limite=8`, { signal })
  if (!reponse.ok) throw new Error(`recherche indisponible (${reponse.status})`)
  const { resultats } = await reponse.json()
  return (Array.isArray(resultats) ? resultats : [])
    .filter((r) => typeof r?.nom === 'string' && r.nom.trim() && typeof r?.code === 'string')
    .map((r) => ({ id: `onet-${r.code}`, nom: r.nom.trim(), dansRapport: r.dans_rapport ?? null }))
    .filter((m) => ID_ONET.test(m.id))
}
