import { useEffect, useRef } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ArrowLeft, FileText } from 'lucide-react'
import EnTete from './EnTete.jsx'
import { rapport } from '../lib/donnees.js'

const PAGES = [
  ['/synthese', 'Écouter'], ['/profil', 'Mon profil'],
  ['/metiers', 'Les métiers'], ['/formations', 'Les formations'],
]

export default function PageRecommandation({ titre, description, Icone, children }) {
  const { pathname } = useLocation()
  const titreRef = useRef(null)
  useEffect(() => {
    window.scrollTo(0, 0)
    titreRef.current?.focus({ preventScroll: true })
  }, [pathname])
  return <>
    <EnTete />
    <main className="mx-auto max-w-4xl px-4 pb-10 pt-4">
      <Link to="/" className="inline-flex min-h-11 items-center gap-2 font-semibold text-doux hover:text-texte"><ArrowLeft size={18} aria-hidden="true" />Retour à ma page</Link>
      <header className="mb-6 mt-5">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-ligne px-3 py-1 text-sm text-doux">{rapport.rdv} · données inventées</p>
        <div className="flex items-start gap-3">
          <span className="mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet/15 text-violet-clair"><Icone size={23} aria-hidden="true" /></span>
          <h1 ref={titreRef} tabIndex={-1} className="min-w-0 text-3xl font-bold tracking-tight outline-none sm:text-4xl">{titre}</h1>
        </div>
        <p className="mt-3 text-base leading-relaxed text-doux">{description}</p>
      </header>
      <nav aria-label="Pages des recommandations" className="mb-6 flex flex-wrap gap-2">
        {PAGES.map(([url, label]) => <NavLink key={url} to={url} className={({ isActive }) => `inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold ${isActive ? 'border-violet bg-violet text-white' : 'border-ligne text-doux hover:border-violet-clair'}`}>{label}</NavLink>)}
      </nav>
      <div className="space-y-5">{children}</div>
      <p className="mt-8 border-t border-ligne pt-5 text-base text-doux">Le rapport ouvre des pistes. Tu peux en parler avec le psychologue et changer d’avis.</p>
    </main>
  </>
}

export function SourceRapport({ page, children }) {
  return <Link to={`/rapport/${page}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-violet-clair hover:underline"><FileText size={16} aria-hidden="true" />{children || `Voir dans ton rapport, page ${page}`}</Link>
}
