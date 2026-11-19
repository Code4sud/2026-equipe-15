import { Link } from 'react-router-dom'
import { Check, FileText, ChevronRight, Pencil, Plus, Hourglass } from 'lucide-react'
import { resume, metierParId, metiersDeZone } from '../lib/donnees.js'
import { useOnboarding } from '../lib/stockage.js'
import { ZONES } from '../config.js'

export default function Resume() {
  return (
    <section aria-labelledby="titre-resume" className="carte apparait overflow-hidden p-5 sm:p-7">
      <div className="relative">
        <div aria-hidden="true" className="absolute -right-10 -top-16 h-44 w-44 rounded-full bg-violet/25 blur-3xl" />
        <p className="inline-flex items-center gap-2 rounded-full bg-violet/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-violet-clair">
          Mon rapport d'orientation
        </p>
        <h2 id="titre-resume" className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
          Résumé de ton rapport
        </h2>

        <ul className="mt-5 space-y-2">
          {resume.points.map((point) => (
            <li key={point.texte}>
              <Link
                to={`/rapport/${point.page}`}
                className="group flex min-h-11 items-start gap-3 rounded-2xl p-2.5 -mx-2.5 transition hover:bg-white/5"
              >
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
                  <Check size={14} strokeWidth={3} aria-hidden="true" />
                </span>
                <span className="flex-1">{point.texte}</span>
                <span className="mt-0.5 flex shrink-0 items-center gap-1 text-sm text-doux group-hover:text-violet-clair">
                  <FileText size={14} aria-hidden="true" />
                  page {point.page}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <Link
          to="/onboarding"
          className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-violet-clair hover:underline"
        >
          <Pencil size={15} aria-hidden="true" /> Modifier mes choix
        </Link>
      </div>

      <ZonesPreferees />
    </section>
  )
}

function ZonesPreferees() {
  const [onboarding] = useOnboarding()
  return (
    <div className="mt-6 border-t border-ligne pt-6">
      <h3 className="text-lg font-bold">Tes métiers préférés, par zone</h3>
      <p className="mt-1 text-sm text-doux">Chaque zone indique un temps de préparation. Aucune n'est meilleure qu'une autre.</p>
      <ol className="mt-4 grid gap-3 lg:grid-cols-5">
        {ZONES.map((zone, i) => (
          <li key={zone.num} className="apparait" style={{ animationDelay: `${80 + i * 60}ms` }}>
            <CarteZone zone={zone} favoriId={onboarding?.favoris?.[zone.num]} />
          </li>
        ))}
      </ol>
    </div>
  )
}

function CarteZone({ zone, favoriId }) {
  const vide = metiersDeZone(zone.num).length === 0
  const favori = favoriId ? metierParId(favoriId) : null
  const base = 'flex h-full min-h-[76px] items-center gap-3 rounded-2xl border border-ligne bg-carte-2 p-4 lg:flex-col lg:items-start lg:gap-2'
  const duree = (
    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-clair lg:order-first">
      <Hourglass size={13} aria-hidden="true" />
      {zone.duree}
    </span>
  )

  if (vide) {
    return (
      <div className={`${base} opacity-70`}>
        <div className="flex flex-1 flex-col gap-1">
          {duree}
          <span className="text-sm text-doux">Ton rapport ne propose pas de métier ici</span>
        </div>
      </div>
    )
  }

  if (!favori) {
    return (
      <div className={base}>
        <div className="flex flex-1 flex-col gap-1">
          {duree}
          <span className="text-sm text-doux">Pas encore de préféré</span>
        </div>
        <Link
          to={`/onboarding?zone=${zone.num}`}
          className="flex min-h-11 items-center gap-1 rounded-full bg-violet/15 px-4 text-sm font-semibold text-violet-clair hover:bg-violet/25 lg:mt-auto"
        >
          <Plus size={15} aria-hidden="true" /> Choisir
        </Link>
      </div>
    )
  }

  return (
    <Link
      to={`/metier/${favori.id}`}
      className={`${base} group transition hover:-translate-y-0.5 hover:border-violet/60 hover:bg-violet/10`}
    >
      <div className="flex flex-1 flex-col gap-1">
        {duree}
        <span className="font-bold leading-snug">{favori.nom}</span>
      </div>
      <ChevronRight size={20} aria-hidden="true" className="shrink-0 text-doux transition group-hover:translate-x-0.5 group-hover:text-violet-clair lg:hidden" />
    </Link>
  )
}
