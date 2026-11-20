// Mémoire de défilement : en revenant en arrière (visionneuse du rapport, fiche métier…),
// on retrouve la page à l'endroit où on l'avait laissée. Une nouvelle page s'ouvre en haut.
import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

const positions = new Map() // location.key → window.scrollY
const DUREE_MAX = 2000 // le résumé de l'accueil arrive en différé : on réessaie le temps qu'il s'affiche

// Position atteignable aujourd'hui : la page peut encore être trop courte.
function positionPossible(voulue, hauteurPage, hauteurFenetre) {
  return Math.max(0, Math.min(voulue, hauteurPage - hauteurFenetre))
}

// « Retour » : l'entrée précédente de l'historique s'il y en a une, sinon la page donnée.
export function revenir(navigate, defaut = '/') {
  if (window.history.state?.idx > 0) navigate(-1)
  else navigate(defaut)
}

export default function MemoireDefilement() {
  const { key } = useLocation()
  const type = useNavigationType()
  const cle = useRef(key)
  const enCours = useRef(false) // une restauration est en cours : on ne retient pas les positions intermédiaires

  useEffect(() => {
    try { window.history.scrollRestoration = 'manual' } catch { /* navigateur ancien */ }
    const retenir = () => { if (!enCours.current) positions.set(cle.current, window.scrollY) }
    window.addEventListener('scroll', retenir, { passive: true })
    // Au moment de toucher un lien aussi : la position est alors sûre, même si un « scroll » a été sauté.
    window.addEventListener('click', retenir, { capture: true, passive: true })
    return () => {
      window.removeEventListener('scroll', retenir)
      window.removeEventListener('click', retenir, { capture: true })
    }
  }, [])

  // Avant l'affichage : la position de la page quittée ne doit pas être écrasée par celle de la nouvelle.
  useLayoutEffect(() => {
    cle.current = key
    const voulue = type === 'POP' ? positions.get(key) ?? 0 : 0
    if (!voulue) {
      window.scrollTo(0, 0)
      return
    }
    enCours.current = true
    const debut = performance.now()
    let attente = 0
    const finir = () => {
      enCours.current = false
      clearTimeout(attente)
      for (const e of ['wheel', 'touchstart', 'keydown', 'pointerdown']) window.removeEventListener(e, finir)
      positions.set(key, window.scrollY)
    }
    const essayer = () => {
      const possible = positionPossible(voulue, document.documentElement.scrollHeight, window.innerHeight)
      if (Math.abs(window.scrollY - possible) > 1) window.scrollTo(0, possible)
      if (possible >= voulue || performance.now() - debut > DUREE_MAX) finir()
      else attente = setTimeout(essayer, 50)
    }
    // Dès que la personne touche la page, on lui laisse la main.
    for (const e of ['wheel', 'touchstart', 'keydown', 'pointerdown']) window.addEventListener(e, finir, { passive: true })
    essayer()
    return () => {
      // Navigation pendant la restauration : la position voulue reste celle retenue.
      if (!enCours.current) return
      finir()
      positions.set(key, voulue)
    }
  }, [key, type])

  return null
}
