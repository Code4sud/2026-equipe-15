import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { OnboardingProvider, useOnboarding } from './lib/onboarding-context.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Accueil from './pages/Accueil.jsx'
import Metier from './pages/Metier.jsx'
import Bientot from './pages/Bientot.jsx'

// La visionneuse embarque PDF.js : chargée seulement quand on l'ouvre.
const Rapport = lazy(() => import('./pages/Rapport.jsx'))

function AccueilAvecChoix() {
  const [onboarding] = useOnboarding()
  return onboarding.termine ? <Accueil /> : <Navigate to="/onboarding" replace />
}

export default function App() {
  return (
    <HashRouter>
      <OnboardingProvider>
        <Suspense fallback={<p className="p-6 text-doux">Chargement…</p>}>
          <Routes>
            <Route path="/" element={<AccueilAvecChoix />} />
            <Route path="/rapport/:page" element={<Rapport />} />
            <Route path="/metier/:id" element={<Metier />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/bientot/:quoi" element={<Bientot />} />
            <Route path="*" element={<Bientot titre="Page introuvable" />} />
          </Routes>
        </Suspense>
      </OnboardingProvider>
    </HashRouter>
  )
}
