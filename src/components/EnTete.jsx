import { Link } from 'react-router-dom'
import { FileText, UserRound, Sun, Moon } from 'lucide-react'
import { NOM_PROJET } from '../config.js'
import { useTheme } from '../lib/theme.js'

const [NOM, SUFFIXE] = NOM_PROJET.split('.')
const BOUTON_ROND = 'grid h-11 w-11 place-items-center rounded-full border border-ligne transition hover:border-violet-clair'

export default function EnTete() {
  const [theme, basculerTheme] = useTheme()
  const clair = theme === 'clair'

  return (
    <header className="sticky top-[var(--bandeau,0px)] z-30 border-b border-ligne bg-entete">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link to="/" className="flex min-h-11 items-center font-titre text-xl font-bold tracking-tight">
          {NOM}{SUFFIXE && <span className="text-repere">.{SUFFIXE}</span>}
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            to="/rapport/1"
            className="flex min-h-11 items-center gap-2 rounded-full border border-ligne px-3 text-sm font-semibold transition hover:border-violet-clair sm:px-4"
          >
            <FileText size={18} aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Ton rapport complet</span>
          </Link>
          <button
            type="button"
            onClick={basculerTheme}
            aria-label={clair ? 'Passer au thème sombre' : 'Passer au thème clair'}
            className={BOUTON_ROND}
          >
            {clair ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
          </button>
          <Link to="/espace" aria-label="Mon espace" className={BOUTON_ROND}>
            <UserRound size={18} aria-hidden="true" />
          </Link>
        </nav>
      </div>
    </header>
  )
}
