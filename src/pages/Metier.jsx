import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, ArrowUpRight, Briefcase, ChevronLeft, ChevronRight, Clock, Euro, FileText, GraduationCap,
  HeartHandshake, Hourglass, MapPin, Star, Store, Sun, Sunrise, Sunset, Wrench, Info,
} from 'lucide-react'
import EnTete from '../components/EnTete.jsx'
import { AssistantFlottant } from '../components/Assistant.jsx'
import { metierParId, dureeDeZone } from '../lib/donnees.js'
import { useOnboarding } from '../lib/stockage.js'
import { candidats } from '../lib/onboarding.js'
import { zones } from '../data/rapport.js'
import { INFOS_METIERS, SOURCE_EXEMPLE } from '../data/infos-metiers.js'
import Bientot from './Bientot.jsx'

const ICONES = { store: Store, wrench: Wrench, heart: HeartHandshake }
const MOMENTS = [Sunrise, Sun, Sunset]
const AVIS = [
  { valeur: 'interesse', label: "Ça m'intéresse" },
  { valeur: 'plus_tard', label: 'Pas pour l’instant' },
  { valeur: 'non', label: 'Pas intéressé' },
]

// Une source citée en bas de page : la pastille y descend.
function Source({ n, children }) {
  const aller = () => document.getElementById(`source-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  return (
    <button
      type="button"
      onClick={aller}
      className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-ligne px-2.5 text-xs font-semibold text-doux transition hover:border-violet-clair hover:text-violet-clair"
    >
      <span className="grid h-4 w-4 place-items-center rounded-full bg-carte-2 text-[10px] text-texte">{n}</span>
      {children}
    </button>
  )
}

function Titre({ surtitre, children, id }) {
  return (
    <div className="mb-4">
      {surtitre && <p className="text-xs font-bold uppercase tracking-wider text-repere">{surtitre}</p>}
      <h2 id={id} className="mt-0.5 text-xl font-bold tracking-tight">{children}</h2>
    </div>
  )
}

// Illustration en aplats : pas de photo, une image simple qui donne l'idée du secteur.
function Illustration({ Icone }) {
  return (
    <div aria-hidden="true" className="relative h-36 overflow-hidden bg-violet sm:h-44">
      <span className="absolute -left-8 -top-10 h-36 w-36 rounded-full bg-violet-fonce" />
      <span className="absolute -bottom-14 left-1/3 h-32 w-32 rounded-full bg-repere/80" />
      <span className="absolute right-10 top-6 h-10 w-10 rounded-full border-4 border-white/40" />
      <span className="absolute bottom-6 right-24 h-4 w-4 rounded-full bg-white/70" />
      <span className="absolute inset-0 grid place-items-center">
        <span className="grid h-20 w-20 place-items-center rounded-3xl bg-white text-violet shadow-xl shadow-black/20 sm:h-24 sm:w-24">
          <Icone size={42} strokeWidth={1.75} />
        </span>
      </span>
    </div>
  )
}

function listeFavoris(onboarding) {
  return Object.keys(onboarding?.favoris ?? {})
    .sort()
    .map((z) => onboarding.favoris[z])
    .filter((id) => id && metierParId(id))
}

export default function Metier() {
  const { id } = useParams()
  const metier = metierParId(id)
  const [onboarding, setOnboarding] = useOnboarding()
  const [alternance, setAlternance] = useState(false)

  useEffect(() => { window.scrollTo(0, 0) }, [id])

  if (!metier) return <Bientot titre="Ce métier n'est pas dans ton rapport" />

  const infos = INFOS_METIERS[metier.id]
  const Icone = ICONES[infos?.icone] ?? Briefcase
  const avis = onboarding?.interets_metiers?.[metier.id]
  const favoris = listeFavoris(onboarding)
  const rang = favoris.indexOf(metier.id)
  const estFavori = rang !== -1
  const page = metier.source.page

  // Même règle que l'onboarding : le préféré d'une zone doit rester un de ses candidats.
  const changerAvis = (valeur) => {
    const interets_metiers = { ...onboarding.interets_metiers, [metier.id]: valeur }
    const favoris = { ...onboarding.favoris }
    const zone = zones.find((z) => z.id === metier.zone)
    if (favoris[metier.zone] && !candidats(zone, interets_metiers).some((m) => m.id === favoris[metier.zone])) {
      favoris[metier.zone] = null
    }
    setOnboarding({ ...onboarding, interets_metiers, favoris })
  }

  const formations = infos?.formations.filter((f) => !alternance || f.alternance) ?? []

  return (
    <>
      <EnTete />
      <main className="pb-securite mx-auto max-w-6xl px-4 pt-4 lg:pb-12">
        {/* Navigation : retour, et passage d'un préféré à l'autre */}
        <nav aria-label="Navigation du métier" className="flex items-center justify-between gap-2">
          <Link to="/" className="inline-flex min-h-11 items-center gap-2 font-semibold text-doux hover:text-texte">
            <ArrowLeft size={18} aria-hidden="true" /> Retour
          </Link>
          {estFavori && favoris.length > 1 && (
            <div className="flex items-center gap-1">
              <Link
                to={`/metier/${favoris[(rang - 1 + favoris.length) % favoris.length]}`}
                aria-label="Préféré précédent"
                className="grid h-11 w-11 place-items-center rounded-full border border-ligne hover:border-violet-clair"
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </Link>
              <span className="px-1 text-sm font-semibold text-doux">Préféré {rang + 1} sur {favoris.length}</span>
              <Link
                to={`/metier/${favoris[(rang + 1) % favoris.length]}`}
                aria-label="Préféré suivant"
                className="grid h-11 w-11 place-items-center rounded-full border border-ligne hover:border-violet-clair"
              >
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
            </div>
          )}
        </nav>

        {/* En-tête du métier */}
        <header key={metier.id} className="carte apparait mt-3 overflow-hidden">
          <Illustration Icone={Icone} />
          <div className="p-5 sm:p-7">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-carte-2 px-3 py-1 text-xs font-bold uppercase tracking-wide text-violet-clair">
                <Hourglass size={13} aria-hidden="true" /> {dureeDeZone(metier.zone)} de préparation
              </span>
              {estFavori && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-carte-2 px-3 py-1 text-xs font-bold uppercase tracking-wide text-repere">
                  <Star size={13} aria-hidden="true" fill="currentColor" /> Ton préféré de la zone {metier.zone}
                </span>
              )}
            </div>
            <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{metier.nom}</h1>
            {infos && (
              <p className="mt-2 text-lg text-doux">
                <span className="font-semibold text-texte">{infos.secteur}.</span> {infos.accroche}
              </p>
            )}
          </div>
        </header>

        <div className="mt-5 grid gap-5 lg:grid-cols-3 lg:items-start">
          {/* Colonne de droite sur ordinateur, en premier sur téléphone */}
          <aside className="space-y-5 lg:sticky lg:top-[calc(var(--bandeau,0px)+5.5rem)] lg:col-start-3 lg:row-start-1">
            <section aria-labelledby="titre-avis" className="carte apparait p-5" style={{ animationDelay: '60ms' }}>
              <h2 id="titre-avis" className="text-lg font-bold">Ton avis sur ce métier</h2>
              <div role="radiogroup" aria-labelledby="titre-avis" className="mt-3 grid gap-2">
                {AVIS.map((a) => {
                  const actif = avis === a.valeur
                  return (
                    <button
                      key={a.valeur}
                      type="button"
                      role="radio"
                      aria-checked={actif}
                      onClick={() => changerAvis(a.valeur)}
                      className={`min-h-12 rounded-xl border px-4 text-left font-semibold transition ${
                        actif ? 'border-violet bg-violet text-white' : 'border-ligne hover:border-violet-clair'
                      }`}
                    >
                      {a.label}
                    </button>
                  )
                })}
              </div>
              <p className="mt-3 text-sm text-doux">Tu peux changer d'avis quand tu veux. Ce métier reste dans ta liste.</p>
            </section>

            {infos && (
              <section aria-labelledby="titre-coup-oeil" className="carte apparait p-5" style={{ animationDelay: '120ms' }}>
                <h2 id="titre-coup-oeil" className="text-lg font-bold">En un coup d'œil</h2>
                <dl className="mt-3 space-y-3">
                  {[
                    { Ic: Euro, titre: 'Salaire au début', ...infos.salaire },
                    { Ic: GraduationCap, titre: 'Pour y arriver', ...infos.etudes },
                    { Ic: MapPin, titre: 'Où on travaille', ...infos.lieu },
                  ].map(({ Ic, titre, valeur, precision }) => (
                    <div key={titre} className="flex gap-3 rounded-xl bg-carte-2 p-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-carte text-violet-clair">
                        <Ic size={19} aria-hidden="true" />
                      </span>
                      <div>
                        <dt className="text-xs font-bold uppercase tracking-wide text-doux">{titre}</dt>
                        <dd className="font-bold">{valeur}</dd>
                        <dd className="text-sm text-doux">{precision}</dd>
                      </div>
                    </div>
                  ))}
                </dl>
                <div className="mt-3"><Source n={2}>Exemple inventé</Source></div>
              </section>
            )}
          </aside>

          <div className="space-y-5 lg:col-span-2 lg:row-start-1">
            {/* Ce que dit le rapport : la seule source réelle de cette page */}
            <section aria-labelledby="titre-rapport" className="carte apparait p-5 sm:p-7" style={{ animationDelay: '80ms' }}>
              <Titre id="titre-rapport" surtitre="Ton rapport">Ce que dit ton rapport</Titre>
              <blockquote className="border-l-4 border-repere pl-4 text-lg leading-relaxed">{metier.description}</blockquote>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Source n={1}>Ton rapport, page {page}</Source>
                <Link to={`/rapport/${page}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-violet-clair hover:underline">
                  <FileText size={15} aria-hidden="true" /> Ouvrir la page {page}
                </Link>
              </div>
            </section>

            {infos ? (
              <>
                <section aria-labelledby="titre-journee" className="carte apparait p-5 sm:p-7" style={{ animationDelay: '140ms' }}>
                  <Titre id="titre-journee" surtitre="Au quotidien">À quoi ressemble une journée</Titre>
                  <ul className="flex flex-wrap gap-2" aria-label="L'environnement de travail">
                    {infos.environnement.map((e) => (
                      <li key={e} className="rounded-full bg-carte-2 px-3 py-1.5 text-sm font-semibold">{e}</li>
                    ))}
                  </ul>
                  <ol className="mt-5 space-y-4">
                    {infos.journee.map((etape, i) => {
                      const Ic = MOMENTS[i] ?? Clock
                      return (
                        <li key={etape.moment} className="flex gap-3">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-carte-2 text-repere">
                            <Ic size={19} aria-hidden="true" />
                          </span>
                          <div>
                            <p className="font-bold">{etape.moment}</p>
                            <p className="text-doux">{etape.texte}</p>
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                  <div className="mt-4"><Source n={2}>Exemple inventé</Source></div>
                </section>

                <section aria-labelledby="titre-formations" className="carte apparait p-5 sm:p-7" style={{ animationDelay: '200ms' }}>
                  <Titre id="titre-formations" surtitre="Près de chez toi">Les formations pour y arriver</Titre>
                  <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl bg-carte-2 px-4">
                    <span className="font-semibold">Seulement en alternance</span>
                    <input type="checkbox" checked={alternance} onChange={(e) => setAlternance(e.target.checked)} className="peer sr-only" />
                    <span aria-hidden="true" className="relative h-7 w-12 rounded-full bg-ligne transition peer-checked:bg-violet peer-focus-visible:outline-3 peer-focus-visible:outline-violet-clair after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
                  </label>
                  <p className="mt-3 text-sm text-doux" aria-live="polite">
                    {formations.length} formation{formations.length > 1 ? 's' : ''}
                  </p>
                  <ul className="mt-2 grid gap-3 sm:grid-cols-2">
                    {formations.map((f) => (
                      <li key={f.nom} className="rounded-xl border border-ligne p-4">
                        <p className="font-bold leading-snug">{f.nom}</p>
                        <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                          <li className="flex items-center gap-1.5"><MapPin size={15} className="text-violet-clair" aria-hidden="true" />{f.ville}</li>
                          <li className="flex items-center gap-1.5"><Clock size={15} className="text-violet-clair" aria-hidden="true" />{f.duree}</li>
                          <li className="flex items-center gap-1.5"><Euro size={15} className="text-violet-clair" aria-hidden="true" />{f.cout}</li>
                          <li className="flex items-center gap-1.5"><FileText size={15} className="text-violet-clair" aria-hidden="true" />{f.acces}</li>
                        </ul>
                        {f.alternance && (
                          <span className="mt-3 inline-block rounded-full bg-coche-fond px-2.5 py-1 text-xs font-bold text-coche">En alternance possible</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4"><Source n={2}>Exemple inventé</Source></div>
                </section>
              </>
            ) : (
              <section className="carte apparait flex gap-3 p-5" style={{ animationDelay: '140ms' }}>
                <Info size={20} className="mt-0.5 shrink-0 text-violet-clair" aria-hidden="true" />
                <p className="text-doux">
                  Salaires, formations près de chez toi, journée type : bientôt ici, avec leurs sources. En attendant,
                  regarde sur{' '}
                  <a href="https://www.orientation-regionsud.fr/" target="_blank" rel="noreferrer" className="font-semibold text-violet-clair underline">
                    orientation-regionsud.fr<span className="sr-only"> (nouvel onglet)</span>
                  </a>.
                </p>
              </section>
            )}

            {/* D'où viennent ces informations : obligatoire sur toute page qui cite autre chose que le rapport */}
            <section aria-labelledby="titre-sources" className="apparait rounded-2xl border border-dashed border-ligne p-5 sm:p-7" style={{ animationDelay: '260ms' }}>
              <h2 id="titre-sources" className="text-lg font-bold">D'où viennent ces informations</h2>
              <ol className="mt-3 space-y-3 text-sm">
                <li id="source-1" className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-carte-2 text-xs font-bold">1</span>
                  <p>
                    <span className="font-semibold">Ton Rapport des Possibles</span>, page {page} : l'intitulé, la description et le temps de
                    préparation.{' '}
                    <Link to={`/rapport/${page}`} className="font-semibold text-violet-clair underline">Voir la page</Link>
                  </p>
                </li>
                {infos && (
                  <li id="source-2" className="flex gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-carte-2 text-xs font-bold">2</span>
                    <p>
                      <span className="font-semibold">{SOURCE_EXEMPLE.titre}</span> : salaire, études, lieux, journée et formations.{' '}
                      {SOURCE_EXEMPLE.detail}{' '}
                      <a href={SOURCE_EXEMPLE.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-violet-clair underline">
                        {SOURCE_EXEMPLE.lien} <ArrowUpRight size={13} aria-hidden="true" /><span className="sr-only"> (nouvel onglet)</span>
                      </a>
                    </p>
                  </li>
                )}
              </ol>
              <p className="mt-4 text-sm text-doux">Ce métier est une piste, pas une consigne. Parles-en avec le psychologue ou ta Mission locale.</p>
            </section>
          </div>
        </div>
      </main>
      <AssistantFlottant />
    </>
  )
}
