// Le résumé du rapport. Avec l'exemple inventé, il est dans le fichier du contrat. Avec l'API, il est
// écrit à la demande à partir du rapport et des choix du jeune, et réécrit quand ces choix changent.
import { useEffect, useSyncExternalStore } from 'react'
import * as donnees from './donnees.js'
import { demanderResume } from './api.js'

// statut : 'chargement' | 'pret' | 'erreur'
let etat = { cle: null, statut: 'chargement', resume: null }
const abonnes = new Set()

function publier(suivant) {
  etat = suivant
  abonnes.forEach((prevenir) => prevenir())
}

const abonner = (prevenir) => {
  abonnes.add(prevenir)
  return () => abonnes.delete(prevenir)
}

// Deux onboardings qui donnent le même résumé ont la même clé : seuls les avis et les préférés comptent.
const cleDe = (onboarding) => JSON.stringify([onboarding?.interets_metiers ?? {}, onboarding?.favoris ?? {}])

async function charger(onboarding, cle) {
  publier({ cle, statut: 'chargement', resume: null })
  try {
    const resume = await demanderResume({ ...donnees.acces, onboarding, fetch: (...a) => window.fetch(...a) })
    if (etat.cle === cle) publier({ cle, statut: 'pret', resume })
  } catch {
    if (etat.cle === cle) publier({ cle, statut: 'erreur', resume: null })
  }
}

// Renvoie { statut, resume, reessayer }. `resume` suit le contrat : points [{ texte, page }], texte.
export function useResume(onboarding) {
  const courant = useSyncExternalStore(abonner, () => etat)
  const avecApi = donnees.source === 'api'
  const cle = avecApi ? cleDe(onboarding) : null

  useEffect(() => {
    if (avecApi && etat.cle !== cle) charger(onboarding, cle)
    // `cle` résume tout ce qui compte dans `onboarding`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avecApi, cle])

  if (!avecApi) return { statut: 'pret', resume: donnees.resume, reessayer: () => {} }
  if (courant.cle !== cle) return { statut: 'chargement', resume: null, reessayer: () => {} }
  return { ...courant, reessayer: () => charger(onboarding, cle) }
}
