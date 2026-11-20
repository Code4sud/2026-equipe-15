import { candidats } from './onboarding.js'

// Une modification d'avis garde le préféré s'il reste cohérent avec les choix de la zone.
export function modifierAvis(state, metier, valeur, metiers) {
  const interets_metiers = { ...state.interets_metiers, [metier.id]: valeur }
  const favoris = { ...state.favoris }
  const zone = { metiers: metiers.filter((m) => m.zone === metier.zone) }
  if (favoris[metier.zone] && !candidats(zone, interets_metiers).some((m) => m.id === favoris[metier.zone])) {
    favoris[metier.zone] = null
  }
  return { ...state, interets_metiers, favoris }
}

// L'étoile « Préféré » : un seul préféré par zone, parmi les candidats de la zone ; la retoucher l'enlève.
export function basculerPrefere(state, metier, metiers) {
  const zone = { metiers: metiers.filter((m) => m.zone === metier.zone) }
  if (!candidats(zone, state.interets_metiers).some((m) => m.id === metier.id)) return state
  const favoris = { ...state.favoris, [metier.zone]: state.favoris[metier.zone] === metier.id ? null : metier.id }
  return { ...state, favoris }
}

export function listerFormations(metiers, infos, { metierId = '', alternance = false } = {}) {
  return metiers
    .filter((m) => !metierId || m.id === metierId)
    .flatMap((metier) => (infos[metier.id]?.formations || [])
      .filter((formation) => !alternance || formation.alternance)
      .map((formation, index) => ({ ...formation, id: `${metier.id}-${index}`, metier })))
}
