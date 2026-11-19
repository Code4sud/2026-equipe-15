import { Link } from 'react-router-dom'
import { FileText, UserRound, Sparkles } from 'lucide-react'
import { NOM_PROJET } from '../config.js'

export default function EnTete() {
  return (
    <header className="sticky top-[var(--bandeau,0px)] z-30 border-b border-ligne bg-fond/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link to="/" className="flex min-h-11 items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet to-violet-fonce shadow-lg shadow-violet/30">
            <Sparkles size={18} aria-hidden="true" />
          </span>
          <span className="text-lg font-extrabold tracking-tight">{NOM_PROJET}</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            to="/rapport/1"
            className="flex min-h-11 items-center gap-2 rounded-full border border-ligne bg-carte-2 px-3 text-sm font-semibold transition hover:border-violet/60 sm:px-4"
          >
            <FileText size={18} aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Ton rapport complet</span>
          </Link>
          <Link
            to="/bientot/connexion"
            aria-label="Mon espace"
            className="grid h-11 w-11 place-items-center rounded-full border border-ligne bg-carte-2 transition hover:border-violet/60"
          >
            <UserRound size={18} aria-hidden="true" />
          </Link>
        </nav>
      </div>
    </header>
  )
}
