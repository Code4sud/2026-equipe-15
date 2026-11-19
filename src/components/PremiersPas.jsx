import { Link } from 'react-router-dom'
import { Check, ArrowUpRight } from 'lucide-react'
import { metierParId } from '../lib/donnees.js'
import { useOnboarding, usePremiersPasCoches } from '../lib/stockage.js'

// Les actions se déduisent des choix de l'onboarding, sans IA.
function construireActions(onboarding) {
  const favoris = Object.keys(onboarding?.favoris ?? {})
    .sort()
    .map((zone) => metierParId(onboarding.favoris[zone]))
    .filter(Boolean)

  if (favoris.length === 0) {
    return [{ id: 'choisir', texte: 'Choisis tes métiers préférés', lien: '/onboarding' }]
  }
  return [
    ...favoris.slice(0, 3).map((m) => ({ id: `fiche-${m.id}`, texte: `Lis la fiche de ${m.nom}`, lien: `/metier/${m.id}` })),
    { id: 'formations', texte: 'Regarde les formations près de chez toi', lien: 'https://www.orientation-regionsud.fr/', externe: true },
    { id: 'synthese', texte: 'Écoute la synthèse de ton rapport', lien: '/bientot/synthese' },
  ]
}

export default function PremiersPas() {
  const [onboarding] = useOnboarding()
  const [coches, basculer] = usePremiersPasCoches()
  const actions = construireActions(onboarding)
  const faites = actions.filter((a) => coches[a.id]).length
  const triees = [...actions.filter((a) => !coches[a.id]), ...actions.filter((a) => coches[a.id])]

  return (
    <section aria-labelledby="titre-pas" className="carte apparait p-5 sm:p-6" style={{ animationDelay: '120ms' }}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="titre-pas" className="text-lg font-semibold">Tes premiers pas</h2>
        <span className="text-sm text-doux" aria-live="polite">{faites} sur {actions.length}</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ligne" aria-hidden="true">
        <div className="h-full rounded-full bg-repere transition-all duration-500" style={{ width: `${(faites / actions.length) * 100}%` }} />
      </div>

      <ul className="mt-4 space-y-1">
        {triees.map((action) => {
          const fait = !!coches[action.id]
          const classesLien = `flex-1 py-2.5 ${fait ? 'text-doux line-through' : 'hover:text-violet-clair'}`
          return (
            <li key={action.id} className="flex items-center gap-3">
              <button
                type="button"
                role="checkbox"
                aria-checked={fait}
                aria-label={action.texte}
                onClick={() => basculer(action.id)}
                className="grid h-11 w-11 shrink-0 place-items-center"
              >
                <span className={`grid h-6 w-6 place-items-center rounded-md border-2 transition ${fait ? 'border-coche bg-coche text-fond' : 'border-doux'}`}>
                  {fait && <Check size={15} strokeWidth={3.5} aria-hidden="true" />}
                </span>
              </button>
              {action.externe ? (
                <a href={action.lien} target="_blank" rel="noreferrer" className={`${classesLien} inline-flex items-center gap-1`}>
                  {action.texte} <ArrowUpRight size={15} aria-hidden="true" />
                  <span className="sr-only">(nouvel onglet)</span>
                </a>
              ) : (
                <Link to={action.lien} className={classesLien}>{action.texte}</Link>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
