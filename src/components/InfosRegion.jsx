// Ce que le site d'orientation de la Région dit d'un métier (champ « region » renvoyé par l'API).
// Rien n'est inventé ici : chaque bloc n'apparaît que si la fiche de la Région donne l'information.
import { Link } from 'react-router-dom'
import { ArrowUpRight, Building2, CalendarClock, Euro, GraduationCap, TrendingUp } from 'lucide-react'

// Une source citée en bas de page : la pastille y descend.
export function Source({ n, children }) {
  const aller = () => document.getElementById(`source-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  return (
    <button
      type="button"
      onClick={aller}
      className="relative inline-flex min-h-8 items-center gap-1.5 rounded-full border border-ligne px-2.5 text-xs font-semibold text-doux transition hover:border-violet-clair hover:text-violet-clair after:absolute after:inset-x-0 after:-inset-y-1.5"
    >
      <span className="grid h-4 w-4 place-items-center rounded-full bg-carte-2 text-[10px] text-texte">{n}</span>
      {children}
    </button>
  )
}

const euros = (n) => Number(n).toLocaleString('fr-FR')
const propre = (t) => String(t ?? '').trim()
const sansPoint = (t) => propre(t).replace(/\s*[.:;]\s*$/, '')
// Un texte long devient une liste de phrases : pas de mur de texte sur téléphone.
const phrases = (t) => propre(t).split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Ý])/).filter(Boolean)
const DIFFICULTE = { moyen: 'moyenne', fort: 'forte', faible: 'faible' }

// Les repères du marché du travail, dits en clair. Un repère absent de la fiche n'est pas affiché.
function reperesMarche(indicateurs = {}) {
  const i = indicateurs ?? {}
  const lignes = []
  if (i.evolution_emploi_5_ans) lignes.push(`Évolution du nombre d'emplois en 5 ans : ${propre(i.evolution_emploi_5_ans)}.`)
  if (i.emplois_saisonniers) lignes.push(`${propre(i.emplois_saisonniers)} des emplois sont saisonniers.`)
  if (i.difficultes_recrutement) {
    const d = propre(i.difficultes_recrutement)
    lignes.push(`Difficulté des employeurs à recruter : ${DIFFICULTE[d.toLowerCase()] ?? d.toLowerCase()}.`)
  }
  if (i.demandeurs_emploi) {
    const n = Number(String(i.demandeurs_emploi).replace(/\s/g, ''))
    lignes.push(`${Number.isFinite(n) ? n.toLocaleString('fr-FR') : propre(i.demandeurs_emploi)} demandeurs d'emploi pour ce métier.`)
  }
  // Formulations du site : « des personnes qui exercent ce métier n'ont aucun diplôme / sont diplômées du supérieur ».
  if (i.sans_diplome) lignes.push(`${propre(i.sans_diplome)} des personnes qui font ce métier n'ont aucun diplôme.`)
  if (i.diplomes_du_superieur) lignes.push(`${propre(i.diplomes_du_superieur)} des personnes qui font ce métier ont un diplôme du supérieur.`)
  return lignes
}

function Carte({ id, Icone, titre, children, n = 2, pastille = 'Site de la Région' }) {
  return (
    <section aria-labelledby={id} className="carte apparait p-5 sm:p-6">
      <h2 id={id} className="flex items-center gap-2.5 text-lg font-bold">
        <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-carte-2 text-violet-clair">
          <Icone size={18} />
        </span>
        {titre}
      </h2>
      <div className="mt-3 space-y-3">{children}</div>
      <div className="mt-4"><Source n={n}>{pastille}</Source></div>
    </section>
  )
}

function Puces({ elements }) {
  return (
    <ul className="space-y-2">
      {elements.map((e) => (
        <li key={e} className="flex gap-2.5">
          <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-clair" />
          <span>{e}</span>
        </li>
      ))}
    </ul>
  )
}

// Le résumé du métier : la phrase d'introduction de la fiche, puis ses missions en liste courte.
export function ResumeRegion({ region, nomMetier }) {
  const [intro, ...missions] = (region.missions ?? []).map(propre).filter(Boolean)
  const autreTitre = propre(region.titre).toLowerCase() !== propre(nomMetier).toLowerCase()
  if (!intro && !autreTitre) return null
  return (
    <section aria-labelledby="titre-resume" className="carte apparait p-5 sm:p-7">
      <p className="text-xs font-bold uppercase tracking-wider text-repere">Site d'orientation de la Région</p>
      <h2 id="titre-resume" className="mt-0.5 text-xl font-bold tracking-tight">Le métier en bref</h2>
      {autreTitre && (
        <p className="mt-3 rounded-xl bg-carte-2 px-4 py-3 text-sm text-doux">
          Fiche la plus proche sur le site de la Région : <span className="font-semibold text-texte">«&nbsp;{region.titre}&nbsp;»</span>
        </p>
      )}
      {intro && <p className="mt-4 text-lg leading-relaxed">{intro}</p>}
      {missions.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-bold uppercase tracking-wide text-doux">Ce qu'on y fait</p>
          <Puces elements={missions.slice(0, 6)} />
        </div>
      )}
      <div className="mt-4"><Source n={2}>Site de la Région</Source></div>
    </section>
  )
}

export default function InfosRegion({ region, metierId }) {
  const salaire = Number(region.salaire_median_net_mensuel)
  const horaires = (region.horaires ?? []).map(propre).filter((h) => h.startsWith('Travail'))
  const conditions = (region.conditions ?? []).map(propre).filter(Boolean)
  const structures = (region.structures ?? []).map(propre).filter(Boolean)
  const reperes = reperesMarche(region.indicateurs)
  const acces = propre(region.acces)
  const etapesAcces = phrases(acces)

  return (
    <>
      {salaire > 0 && (
        <Carte id="titre-salaire" Icone={Euro} titre="Le salaire" n={3} pastille="Source du salaire">
          <p className="text-3xl font-bold tracking-tight">
            {euros(salaire)}&nbsp;€ <span className="text-base font-semibold text-doux">net par mois</span>
          </p>
          <p>La moitié des personnes à temps plein gagnent plus de {euros(salaire)}&nbsp;€ net par mois. L'autre moitié gagne moins.</p>
          <p className="text-sm text-doux">C'est un repère, pas une promesse.</p>
        </Carte>
      )}

      {(acces || region.formations_url) && (
        <Carte id="titre-acces" Icone={GraduationCap} titre="Comment y accéder">
          {acces && (etapesAcces.length > 2 ? <Puces elements={etapesAcces} /> : <p className="leading-relaxed">{acces}</p>)}
          <div className="grid gap-2 sm:grid-cols-2">
            {region.formations_url && (
              <a
                href={region.formations_url}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-violet px-4 py-2 font-semibold text-white hover:opacity-90"
              >
                Les formations en Région Sud <ArrowUpRight size={17} className="shrink-0" aria-hidden="true" />
                <span className="sr-only"> (nouvel onglet)</span>
              </a>
            )}
            <Link
              to={`/formations?metier=${encodeURIComponent(metierId)}`}
              className="flex min-h-12 items-center rounded-xl border border-ligne px-4 py-2 font-semibold hover:border-violet-clair hover:text-violet-clair"
            >
              Ouvrir ta page Formations
            </Link>
          </div>
        </Carte>
      )}

      {(horaires.length > 0 || conditions.length > 0) && (
        <Carte id="titre-conditions" Icone={CalendarClock} titre="Horaires et conditions de travail">
          {horaires.length > 0 && <Puces elements={horaires} />}
          {horaires.length > 0 && conditions.length > 0 && <hr className="border-ligne" />}
          {conditions.length > 0 && <Puces elements={conditions} />}
          <p className="text-sm text-doux">Ça dépend des postes : tout ne s'applique pas à chaque emploi.</p>
        </Carte>
      )}

      {structures.length > 0 && (
        <Carte id="titre-lieux" Icone={Building2} titre="Où on travaille">
          <ul className="flex flex-wrap gap-2">
            {structures.map((s) => (
              <li key={s} className="rounded-full bg-carte-2 px-3 py-1.5 text-sm font-semibold">{sansPoint(s)}</li>
            ))}
          </ul>
        </Carte>
      )}

      {(reperes.length > 0 || region.recrute) && (
        <Carte id="titre-marche" Icone={TrendingUp} titre="Le marché du travail en Région Sud">
          {region.recrute && (
            <p><span className="inline-block rounded-full bg-coche-fond px-3 py-1 text-sm font-bold text-coche">Métier qui recrute</span></p>
          )}
          {reperes.length > 0 && <Puces elements={reperes} />}
          <p className="text-sm text-doux">Ces chiffres décrivent la région, pas toi. Ils peuvent changer.</p>
        </Carte>
      )}
    </>
  )
}
