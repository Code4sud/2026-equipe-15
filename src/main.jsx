import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { preparerDonnees, lireJeton, doitRecommencer, sansRecommencer, CLE_JETON } from './lib/api.js'
import { STORAGE_KEY } from './lib/onboarding.js'
import { installer } from './lib/donnees.js'
import { oublierDiscussion } from './lib/assistantEtat.js'
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
// Lien « recommencer=1 » : les choix, les premiers pas cochés et la discussion avec l'assistant sont oubliés,
// l'onboarding repart du début.
function recommencerSiDemande() {
  if (!doitRecommencer(window.location)) return
  oublierDiscussion()
  try {
    for (const cle of [STORAGE_KEY, 'possibles.onboarding', 'possibles.premiers-pas']) stockage.removeItem(cle)
  } catch { /* stockage indisponible : rien à oublier */ }
  window.history.replaceState(null, '', window.location.pathname + window.location.search + sansRecommencer(window.location.hash))
}

async function demarrer() {
  const racine = createRoot(document.getElementById('root'))
  racine.render(<p className="p-6 text-doux">Chargement…</p>)
  recommencerSiDemande()
  const depart = await preparerDonnees({
    env: import.meta.env,
    lieu: window.location,
    stockage,
    fetch: (url, options) => window.fetch(url, { ...options, signal: AbortSignal.timeout(20000) }),
  })
  // Un autre lien collé dans l'onglet déjà ouvert : on retient son jeton et on recharge avec ce rapport.
  window.addEventListener('hashchange', () => {
    // Lien « recommencer » ouvert dans l'onglet déjà chargé : on recharge, le démarrage oublie les choix.
    if (doitRecommencer(window.location)) return window.location.reload()
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
