import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
