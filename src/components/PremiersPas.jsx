import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Check, ArrowUpRight, ChevronDown, MessageCircle } from 'lucide-react'
import { ZONES } from '../config.js'
import { rapport } from '../lib/donnees.js'
import { useOnboarding, usePremiersPasCoches } from '../lib/stockage.js'
import { construireReserve, repartir, nouvellesApres } from '../lib/premiersPas.js'
import { assistant } from '../lib/assistantEtat.js'

const DUREES = Object.fromEntries(ZONES.map((z) => [z.num, z.duree]))

function Etape({ etape, fait, nouvelle, onBasculer }) {
  const { pathname } = useLocation()
  const classesTexte = `flex-1 py-2.5 ${fait ? 'text-doux line-through' : ''}`
  return (
    <li className={`flex items-center gap-3 ${nouvelle ? 'apparait' : ''}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={fait}
        aria-label={etape.texte}
        onClick={() => onBasculer(etape.id)}
        className="grid h-11 w-11 shrink-0 place-items-center"
      >
        <span className={`grid h-6 w-6 place-items-center rounded-md border-2 transition ${fait ? 'border-coche bg-coche text-fond' : 'border-doux'}`}>
          {fait && <Check size={15} strokeWidth={3.5} aria-hidden="true" />}
        </span>
      </button>
      {etape.action === 'assistant' ? (
        // Ouvre l'assistant sur cette page (téléphone) et place le curseur dans sa zone de saisie.
        <button type="button" onClick={() => assistant.ouvrir(pathname, { focus: true })} className={`${classesTexte} inline-flex min-h-11 items-center gap-1.5 text-left hover:text-violet-clair`}>
          {etape.texte} <MessageCircle size={15} className="shrink-0" aria-hidden="true" />
        </button>
      ) : !etape.lien ? (
        <span className={classesTexte}>{etape.texte}</span>
      ) : etape.externe ? (
        <a href={etape.lien} target="_blank" rel="noreferrer" className={`${classesTexte} inline-flex items-center gap-1 hover:text-violet-clair`}>
          {etape.texte} <ArrowUpRight size={15} className="shrink-0" aria-hidden="true" />
          <span className="sr-only">(nouvel onglet)</span>
        </a>
      ) : (
        <Link to={etape.lien} className={`${classesTexte} hover:text-violet-clair`}>{etape.texte}</Link>
      )}
    </li>
  )
}

export default function PremiersPas() {
  const [onboarding] = useOnboarding()
  const [coches, basculer] = usePremiersPasCoches()
  const [nouvelles, setNouvelles] = useState([])
  const [annonce, setAnnonce] = useState('')
  const liste = useRef(null)
  const rangCoche = useRef(null)

  // Les étapes se déduisent du rapport et des choix de l'onboarding, sans IA : voir lib/premiersPas.js.
  const reserve = construireReserve({ metiers: rapport.metiers, onboarding, durees: DUREES })
  const { visibles, faites, total } = repartir(reserve, coches)
  const toutFait = total > 0 && faites.length === total

  // L'étape cochée quitte la liste : le clavier reprend sur la case qui a pris sa place.
  useEffect(() => {
    if (rangCoche.current === null) return
    const cases = liste.current?.querySelectorAll('button[role="checkbox"]') ?? []
    cases[Math.min(rangCoche.current, cases.length - 1)]?.focus({ preventScroll: true })
    rangCoche.current = null
  }, [coches])

  function auClic(id) {
    const rang = visibles.findIndex((e) => e.id === id)
    rangCoche.current = rang >= 0 ? rang : null
    const apparues = nouvellesApres(reserve, coches, id)
    setNouvelles(apparues.map((e) => e.id))
    setAnnonce(apparues.length ? `Nouvelle étape : ${apparues.map((e) => e.texte).join('. ')}` : '')
    basculer(id)
  }

  return (
    <section aria-labelledby="titre-pas" className="carte apparait p-5 sm:p-6" style={{ animationDelay: '120ms' }}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="titre-pas" className="text-lg font-semibold">Tes premiers pas</h2>
        <span className="shrink-0 text-sm text-doux">{faites.length} sur {total}</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ligne" aria-hidden="true">
        <div className="h-full w-full origin-left bg-repere transition-transform duration-300 ease-out" style={{ transform: `scaleX(${total ? faites.length / total : 0})` }} />
      </div>
      <p className="sr-only" aria-live="polite">{annonce}</p>

      {toutFait ? (
        <p className="apparait mt-4 rounded-xl bg-carte-2 p-4 leading-relaxed">
          Tu as fait tous tes premiers pas. Tu avances à ton rythme, et tu peux revenir sur chacun quand tu veux.
        </p>
      ) : (
        <ul ref={liste} className="mt-4 space-y-1">
          {visibles.map((etape) => (
            <Etape key={etape.id} etape={etape} fait={false} nouvelle={nouvelles.includes(etape.id)} onBasculer={auClic} />
          ))}
        </ul>
      )}

      {faites.length > 0 && (
        <details className="group mt-3 border-t border-ligne pt-1">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-doux hover:text-violet-clair [&::-webkit-details-marker]:hidden">
            Déjà fait ({faites.length})
            <ChevronDown size={18} className="shrink-0 transition group-open:rotate-180" aria-hidden="true" />
          </summary>
          <ul className="space-y-1 pb-1">
            {faites.map((etape) => (
              <Etape key={etape.id} etape={etape} fait nouvelle={false} onBasculer={auClic} />
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
