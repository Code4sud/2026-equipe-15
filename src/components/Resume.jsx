import { Link } from 'react-router-dom'
import { Check, FileText, ChevronRight, Pencil, Plus } from 'lucide-react'
import { source, metierParId, metiersDeZone } from '../lib/donnees.js'
import { useResume } from '../lib/resume.js'
import { useOnboarding } from '../lib/stockage.js'
import { ZONES } from '../config.js'

export default function Resume() {
  const [onboarding] = useOnboarding()
  const { statut, resume, reessayer } = useResume(onboarding)
  const nombrePreferes = Object.values(onboarding.favoris).filter(Boolean).length
  const avecApi = source === 'api'
  // Exemple inventé : son dernier point décrit des choix de démonstration, remplacés par ceux du jeune.
  // Rapport lu par l'API : les 4 points sont écrits à partir du rapport et des choix, chacun avec sa page.
  const points = resume ? (avecApi ? resume.points : resume.points.slice(0, 3)) : []
  return (
    <section aria-labelledby="titre-resume" className="carte apparait overflow-hidden p-5 sm:p-7">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-repere">Mon rapport d'orientation</p>
        <h2 id="titre-resume" className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          Résumé de ton rapport
        </h2>

        <ul className="mt-4 divide-y divide-ligne border-t border-ligne">
          {statut === 'chargement' && <Attente />}
          {statut === 'erreur' && (
            <li role="alert" className="flex min-h-11 flex-wrap items-center gap-3 py-3 text-doux">
              Ton résumé n'est pas disponible pour l'instant.
              <button type="button" onClick={reessayer} className="min-h-11 font-semibold text-violet-clair hover:underline">Réessayer</button>
            </li>
          )}
          {points.map((point, i) => (
            <li key={point.texte} className="apparait" style={{ animationDelay: `${i * 90}ms` }}>
              <Link
                to={`/rapport/${point.page}`}
                className="group flex min-h-11 items-start gap-3 py-3"
              >
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-coche-fond text-coche">
                  <Check size={14} strokeWidth={3} aria-hidden="true" />
                </span>
                <span className="flex-1 group-hover:underline">{point.texte}</span>
                <span className="mt-0.5 flex shrink-0 items-center gap-1 text-sm font-semibold text-doux group-hover:text-violet-clair">
                  <FileText size={14} aria-hidden="true" />
                  page {point.page}
                </span>
              </Link>
            </li>
          ))}
          {!avecApi && (
            <li className="flex min-h-11 items-start gap-3 py-3">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-coche-fond text-coche">
                <Pencil size={14} aria-hidden="true" />
              </span>
              <span>Tu as retenu {nombrePreferes} métier{nombrePreferes > 1 ? 's' : ''} préféré{nombrePreferes > 1 ? 's' : ''}. Tu peux changer d'avis.</span>
            </li>
          )}
        </ul>

        {avecApi && statut === 'pret' && (
          <p className="mt-3 text-sm text-doux">
            {resume.genere_par?.mode === 'repli'
              ? 'Phrases tirées de ton rapport.'
              : resume.genere_par?.mode === 'mixte'
                ? "Phrases écrites à partir de ton rapport, avec l'aide d'une IA, et vérifiées une par une."
                : 'Phrases écrites par une IA à partir de ton rapport, et vérifiées une par une.'}{' '}
            Touche une phrase pour voir la page d'où elle vient.
          </p>
        )}

        <Link
          to="/onboarding"
          className="mt-1 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-violet-clair hover:underline"
        >
          <Pencil size={15} aria-hidden="true" /> Modifier mes choix
        </Link>
      </div>

      <ZonesPreferees />
    </section>
  )
}

// Pendant que l'IA écrit : un message, puis quatre lignes fantômes à la place des quatre phrases,
// pour que la page ne saute pas quand elles arrivent.
const LARGEURS = [['88%', '52%'], ['94%', '40%'], ['80%', '58%'], ['90%', '34%']]

function Attente() {
  return (
    <>
      <li role="status" className="flex min-h-11 items-center gap-3 py-3 font-semibold text-violet-clair">
        <span className="points-attente" aria-hidden="true"><span /><span /><span /></span>
        L'IA écrit ton résumé à partir de ton rapport
      </li>
      {LARGEURS.map(([longue, courte], i) => (
        <li key={i} aria-hidden="true" className="flex min-h-11 items-start gap-3 py-3">
          <span className="fantome mt-0.5 h-6 w-6 shrink-0" style={{ animationDelay: `${i * 120}ms` }} />
          <span className="flex flex-1 flex-col gap-2 pt-1">
            <span className="fantome h-3.5" style={{ width: longue, animationDelay: `${i * 120}ms` }} />
            <span className="fantome h-3.5" style={{ width: courte, animationDelay: `${i * 120}ms` }} />
          </span>
          <span className="fantome mt-1 h-3.5 w-12 shrink-0" style={{ animationDelay: `${i * 120}ms` }} />
        </li>
      ))}
    </>
  )
}

function ZonesPreferees() {
  const [onboarding] = useOnboarding()
  return (
    <div className="mt-6 border-t border-ligne pt-6">
      <h3 className="text-lg font-semibold">Tes métiers préférés, par zone</h3>
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
  const base = 'flex h-full min-h-[68px] items-center gap-3 rounded-xl px-4 py-3 lg:flex-col lg:items-start lg:gap-2'
  const duree = (
    <span className={`text-xs font-bold uppercase tracking-wide lg:order-first ${vide ? 'text-doux' : 'text-violet-clair'}`}>{zone.duree}</span>
  )

  if (vide) {
    return (
      <div className={`${base} border border-dashed border-ligne`}>
        <div className="flex flex-1 flex-col gap-1">
          {duree}
          <span className="text-sm text-doux">Ton rapport ne propose pas de métier ici</span>
        </div>
      </div>
    )
  }

  if (!favori) {
    return (
      <div className={`${base} bg-carte-2`}>
        <div className="flex flex-1 flex-col gap-1">
          {duree}
          <span className="text-sm text-doux">Pas encore de préféré</span>
        </div>
        <Link
          to={`/onboarding?zone=${zone.num}`}
          className="flex min-h-11 items-center gap-1 rounded-full bg-violet px-4 text-sm font-semibold text-white transition hover:bg-violet-fonce lg:mt-auto"
        >
          <Plus size={15} aria-hidden="true" /> Choisir
        </Link>
      </div>
    )
  }

  return (
    <Link
      to={`/metier/${favori.id}`}
      className={`${base} group bg-carte-2 transition hover:bg-violet/20`}
    >
      <div className="flex flex-1 flex-col gap-1">
        {duree}
        <span className="font-semibold leading-snug">{favori.nom}</span>
      </div>
      <ChevronRight size={20} aria-hidden="true" className="shrink-0 text-doux transition group-hover:translate-x-0.5 group-hover:text-violet-clair lg:hidden" />
    </Link>
  )
}
