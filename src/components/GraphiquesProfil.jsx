// Une partie de la page « Mon profil » : ce qui ressort le plus, puis toutes les dimensions en barres triées.
// Aucun nombre n'est affiché : seule la longueur des barres compte, comparée à l'intérieur d'une même partie.
import { Info, Star } from 'lucide-react'
import { SourceRapport } from './PageRecommandation.jsx'

// Mots qu'on ne montre pas au jeune : vocabulaire de note, et sujets de santé (même liste d'idées que le contrôle du résumé).
const A_EVITER = /score|faible|mauvais|moyenne|niveau|angoiss|anxi|stress|\btendu|d[ée]pr[ei]|malad|\bsant[ée]|trouble|handicap|th[ée]rap/i

// Première phrase de la description du rapport, sans vocabulaire de note. Rien n'est ajouté au texte du rapport.
export function enClair(description) {
  if (typeof description !== 'string' || !description.trim()) return null
  const texte = description.trim()
  const phrase = (texte.match(/^[\s\S]*?[.!?…](?=\s|$)/)?.[0] ?? texte)
    .replace(/^Un score élevé (indique|signale|reflète|correspond à)\s*(que\s*|qu[’']\s*)?(l[’'])?/i, 'Quand ça ressort : ')
    .replace(/,\s*que\s+l[’']on\s+/g, ', on ')
  return A_EVITER.test(phrase) ? null : phrase
}

// Part de l'échelle occupée par la valeur, entre 0 et 1. Les échelles changent d'un rapport à l'autre.
function part(element) {
  const ratio = element.value / element.echelle_max
  return Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0
}

export function trier(elements) {
  return (elements ?? []).map((e) => ({ ...e, ratio: part(e) })).sort((a, b) => b.ratio - a.ratio)
}

// Ce qui ressort : les éléments mis en avant par le rapport, sinon la ou les barres les plus longues.
export function quiRessort(tries) {
  const misEnAvant = tries.filter((e) => e.point_fort === true)
  if (misEnAvant.length) {
    // Une barre aussi longue qu'un élément mis en avant ressort autant : elle porte la même marque.
    const seuil = Math.min(...misEnAvant.map((e) => e.ratio))
    const avecEgalites = tries.filter((e) => e.point_fort === true || e.ratio >= seuil)
    return avecEgalites.length < tries.length ? avecEgalites : misEnAvant
  }
  const plusLongues = tries.filter((e) => e.ratio > 0 && e.ratio === tries[0].ratio)
  return plusLongues.length < tries.length || tries.length === 1 ? plusLongues : []
}

function Marque() {
  return <span className="inline-flex items-center gap-1 rounded-full border border-repere px-2 py-0.5 text-sm font-semibold text-repere">
    <Star size={13} fill="currentColor" aria-hidden="true" />Ressort le plus
  </span>
}

export default function PartieProfil({ id, surtitre, titre, mesure, elements, page, phrase }) {
  const tries = trier(elements)
  const ressort = quiRessort(tries)
  const titreId = `titre-${id}`

  return <section aria-labelledby={titreId} className="carte p-5 sm:p-6">
    <p className="text-sm font-semibold text-repere">{surtitre}</p>
    <h2 id={titreId} className="mt-1 text-2xl font-bold">{titre}</h2>
    <p className="mt-2 text-base leading-relaxed text-doux">{mesure}</p>

    {!tries.length && <p className="mt-4 text-base text-doux">Cette partie n’est pas disponible dans ton rapport.</p>}

    {tries.length > 0 && <>
      <h3 className="mt-6 text-lg font-bold">Ce qui ressort le plus chez toi</h3>
      {ressort.length > 0
        ? <ul className="mt-3 grid gap-3 sm:grid-cols-2">{ressort.map((e) => {
          const explication = enClair(e.description)
          return <li key={e.label} className="rounded-2xl border border-repere bg-carte-2 p-4">
            <p className="flex items-center gap-2 text-lg font-bold">
              <Star size={18} fill="currentColor" aria-hidden="true" className="shrink-0 text-repere" />{e.label}
            </p>
            <p className="mt-1 text-base leading-relaxed text-doux">
              {explication || `À retrouver dans ton rapport, page ${e.source?.page ?? page}.`}
            </p>
          </li>
        })}</ul>
        : <p className="mt-3 text-base text-doux">Ici, rien ne se détache : tes barres ont la même longueur.</p>}
      {phrase && <p className="mt-4 border-l-4 border-repere pl-3 text-base leading-relaxed">{phrase}</p>}

      <h3 className="mt-7 text-lg font-bold">Le détail, en barres</h3>
      <p className="mt-2 flex items-start gap-2 rounded-xl bg-carte-2 p-3 text-sm leading-relaxed text-doux">
        <Info size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span>Plus la barre est longue, plus ça ressort chez toi. On compare tes résultats entre eux, pas avec ceux des autres.</span>
      </p>
      <p className="sr-only">Liste rangée de la barre la plus longue à la plus courte.</p>
      <ol className="mt-4 space-y-4">{tries.map((e, index) => {
        const fort = ressort.includes(e)
        const egale = index > 0 && e.ratio === tries[index - 1].ratio
        return <li key={e.label} className="sm:flex sm:items-center sm:gap-4">
          <p className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-base sm:mb-0 sm:w-64 sm:shrink-0">
            <span className={fort ? 'font-semibold' : undefined}>{e.label}</span>
            {fort && <Marque />}
            {egale && <span className="sr-only">(même longueur que la barre précédente)</span>}
          </p>
          <div aria-hidden="true" className="h-3.5 flex-1 rounded-full bg-carte-2">
            <div className={`h-full rounded-full ${fort ? 'bg-repere' : 'bg-violet-clair/70'}`} style={{ width: `${Math.max(4, e.ratio * 100)}%` }} />
          </div>
        </li>
      })}</ol>
    </>}

    <div className="mt-4"><SourceRapport page={page} /></div>
  </section>
}
