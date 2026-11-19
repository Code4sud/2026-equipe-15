// Choix du jeune, gardés dans le navigateur (localStorage). Tout est protégé :
// en navigation privée, le site doit marcher même si rien ne s'enregistre.
import { useCallback, useEffect, useState } from 'react'
export { useOnboarding } from './onboarding-context.jsx'

const CLE_PREMIERS_PAS = 'possibles.premiers-pas'

function lire(cle, defaut) {
  try {
    const brut = localStorage.getItem(cle)
    return brut ? JSON.parse(brut) : defaut
  } catch {
    return defaut
  }
}

function ecrire(cle, valeur) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur))
  } catch {
    /* stockage indisponible : on continue sans */
  }
}

function useStocke(cle, defaut) {
  const [valeur, setValeur] = useState(() => lire(cle, defaut))
  useEffect(() => ecrire(cle, valeur), [cle, valeur])
  return [valeur, setValeur]
}

export function usePremiersPasCoches() {
  const [coches, setCoches] = useStocke(CLE_PREMIERS_PAS, {})
  const basculer = useCallback(
    (id) => setCoches((c) => ({ ...c, [id]: !c[id] })),
    [setCoches],
  )
  return [coches, basculer]
}
