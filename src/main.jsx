import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { preparerDonnees, lireJeton, CLE_JETON } from './lib/api.js'
import { installer } from './lib/donnees.js'
import LienIndisponible from './pages/LienIndisponible.jsx'
import './index.css'

// Le bandeau commun du hackathon reste collé en haut : on mesure sa hauteur
// pour que nos barres fixes se placent juste en dessous (--bandeau).
function suivreBandeau() {
  const maj = (el) => document.documentElement.style.setProperty('--bandeau', `${el?.offsetHeight ?? 0}px`)
  const brancher = () => {
    const el = document.getElementById('c4s-bandeau')
    if (!el) return false
    maj(el)
    new ResizeObserver(() => maj(el)).observe(el)
    return true
  }
  if (!brancher()) {
    const obs = new MutationObserver(() => brancher() && obs.disconnect())
    obs.observe(document.body, { childList: true })
  }
}
suivreBandeau()

// En navigation privée, l'accès au stockage peut échouer : le site doit marcher quand même.
const stockage = {
  getItem: (cle) => window.localStorage.getItem(cle),
  setItem: (cle, valeur) => window.localStorage.setItem(cle, valeur),
  removeItem: (cle) => window.localStorage.removeItem(cle),
}

// On sait d'abord quel rapport afficher (celui du lien, ou l'exemple inventé), puis on charge le site :
// les pages lisent leurs données dès leur import.
async function demarrer() {
  const racine = createRoot(document.getElementById('root'))
  racine.render(<p className="p-6 text-doux">Chargement…</p>)
  const depart = await preparerDonnees({
    env: import.meta.env,
    lieu: window.location,
    stockage,
    fetch: (url, options) => window.fetch(url, { ...options, signal: AbortSignal.timeout(20000) }),
  })
  // Un autre lien collé dans l'onglet déjà ouvert : on retient son jeton et on recharge avec ce rapport.
  window.addEventListener('hashchange', () => {
    const jeton = lireJeton(window.location)
    if (!jeton || jeton === (depart.jeton ?? 'exemple')) return
    try {
      if (jeton === 'exemple') stockage.removeItem(CLE_JETON)
      else stockage.setItem(CLE_JETON, jeton)
    } catch { /* le lien reste dans l'adresse */ }
    window.location.reload()
  })
  if (depart.mode === 'erreur') {
    racine.render(<StrictMode><LienIndisponible raison={depart.raison} /></StrictMode>)
    return
  }
  if (depart.mode === 'api') installer(depart)
  const { default: App } = await import('./App.jsx')
  racine.render(<StrictMode><App /></StrictMode>)
}
demarrer()
