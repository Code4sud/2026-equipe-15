// Thème du site : sombre par défaut, clair au choix. Le choix est gardé dans le navigateur.
// index.html applique le thème enregistré avant le premier affichage (même clé).
import { useCallback, useEffect, useState } from 'react'

const CLE_THEME = 'possibles.theme'
const COULEUR_BARRE = { sombre: '#12123a', clair: '#ffffff' }

function lire() {
  try {
    return localStorage.getItem(CLE_THEME) === 'clair' ? 'clair' : 'sombre'
  } catch {
    return 'sombre'
  }
}

export function useTheme() {
  const [theme, setTheme] = useState(lire)

  useEffect(() => {
    const racine = document.documentElement
    if (theme === 'clair') racine.dataset.theme = 'clair'
    else delete racine.dataset.theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COULEUR_BARRE[theme])
    try {
      localStorage.setItem(CLE_THEME, theme)
    } catch {
      /* stockage indisponible : le thème ne tient que pour cette visite */
    }
  }, [theme])

  const basculer = useCallback(() => setTheme((t) => (t === 'clair' ? 'sombre' : 'clair')), [])
  return [theme, basculer]
}
