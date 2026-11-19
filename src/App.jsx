import { lazy, Suspense } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import Accueil from './pages/Accueil.jsx'
import Metier from './pages/Metier.jsx'
import Bientot from './pages/Bientot.jsx'

// La visionneuse embarque PDF.js : chargée seulement quand on l'ouvre.
const Rapport = lazy(() => import('./pages/Rapport.jsx'))

export default function App() {
  return (
    <HashRouter>
      <Suspense fallback={<p className="p-6 text-doux">Chargement…</p>}>
        <Routes>
          <Route path="/" element={<Accueil />} />
          <Route path="/rapport/:page" element={<Rapport />} />
          <Route path="/metier/:id" element={<Metier />} />
          <Route path="/onboarding" element={<Bientot titre="Tes choix de métiers" />} />
          <Route path="/bientot/:quoi" element={<Bientot />} />
          <Route path="*" element={<Bientot titre="Page introuvable" />} />
        </Routes>
      </Suspense>
    </HashRouter>
  )
}
