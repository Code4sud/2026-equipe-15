import { useId } from 'react'
import { Compass } from 'lucide-react'
import PageRecommandation, { SourceRapport } from '../components/PageRecommandation.jsx'
import { rapport, resume } from '../lib/donnees.js'

function Radar({ dimensions, titre }) {
  const id = useId()
  if (!dimensions.length) return <p className="text-base text-doux">Ce graphique n’est pas disponible dans ton rapport.</p>
  const point = (index, rayon) => {
    const angle = (Math.PI * 2 * index / dimensions.length) - Math.PI / 2
    return `${150 + Math.cos(angle) * rayon},${150 + Math.sin(angle) * rayon}`
  }
  const contour = dimensions.map((dimension, index) => point(index, Math.max(0, Math.min(1, dimension.value / dimension.echelle_max || 0)) * 115)).join(' ')
  return <svg viewBox="0 0 300 300" role="img" aria-labelledby={id} className="mx-auto my-4 w-full max-w-72 text-violet-clair">
    <title id={id}>{titre}. Les dimensions se lisent entre elles, pour une même personne. Les points mis en avant sont listés sous le graphique.</title>
    {[.33, .66, 1].map((facteur) => <polygon key={facteur} points={dimensions.map((_, i) => point(i, 115 * facteur)).join(' ')} fill="none" stroke="var(--color-ligne)" />)}
    {dimensions.map((dimension, i) => <line key={dimension.label} x1="150" y1="150" x2={point(i, 115).split(',')[0]} y2={point(i, 115).split(',')[1]} stroke="var(--color-ligne)" />)}
    <polygon points={contour} fill="currentColor" fillOpacity=".18" stroke="currentColor" strokeWidth="2.5" />
    {dimensions.map((dimension, index) => {
      const [x, y] = point(index, 115).split(',')
      return <text key={dimension.label} x={x} y={Number(y) + 5} textAnchor="middle" fontSize="16" fontWeight="600" fill={dimension.point_fort ? 'var(--color-repere)' : 'var(--color-doux)'}>{String.fromCharCode(65 + index)}</text>
    })}
  </svg>
}

function Dimensions({ dimensions }) {
  return <ul className="space-y-3">{dimensions.map((dimension, index) => <li key={dimension.label} className="flex items-start gap-3 text-base">
    <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-carte-2 text-sm text-doux">{String.fromCharCode(65 + index)}</span>
    <div><p className={dimension.point_fort ? 'font-semibold text-repere' : 'text-texte'}>{dimension.label}</p>{dimension.point_fort && <p className="text-sm text-doux">Mis en avant dans ton rapport</p>}</div>
  </li>)}</ul>
}

export default function Profil() {
  const aptitudes = rapport.aptitudes
  const maximum = Math.max(...aptitudes.map((a) => a.value))
  const explication = (page) => resume.points.find((p) => p.page === page)?.texte
  return <PageRecommandation titre="Explorer ton profil" description="Trois façons de mieux comprendre ton rapport. Ces graphiques comparent tes dimensions entre elles, jamais à celles des autres." Icone={Compass}>
    <aside className="carte p-5 text-base leading-relaxed text-doux">Ces résultats sont une image à un instant donné. La fatigue, le stress et la motivation peuvent jouer. Il n’y a pas de bon ou de mauvais profil.</aside>
    <section aria-labelledby="titre-interets" className="carte p-5 sm:p-6">
      <p className="text-sm font-semibold text-repere">Tes intérêts professionnels</p>
      <h2 id="titre-interets" className="mt-1 text-2xl font-bold">Ce qui t’attire</h2>
      <p className="mt-3 text-base leading-relaxed text-doux">Plusieurs centres d’intérêt peuvent coexister. Les dimensions en couleur sont celles mises en avant dans ton rapport.</p>
      <p className="mt-3 text-base font-semibold">{explication(4)}</p>
      <Radar dimensions={rapport.interets_riasec} titre="Tes intérêts professionnels" />
      <Dimensions dimensions={rapport.interets_riasec} />
      <div className="mt-4"><SourceRapport page={4} /></div>
    </section>
    <section aria-labelledby="titre-aptitudes" className="carte p-5 sm:p-6">
      <p className="text-sm font-semibold text-repere">Tes aptitudes</p>
      <h2 id="titre-aptitudes" className="mt-1 text-2xl font-bold">Tes façons de résoudre un problème</h2>
      <p className="mt-3 text-base leading-relaxed text-doux">Les barres montrent ce qui ressort entre tes différentes aptitudes, le jour de ton passage. Une barre plus courte ne ferme aucune porte.</p>
      <p className="mt-3 text-base font-semibold">{explication(5)}</p>
      <ul className="mt-6 space-y-5">{aptitudes.map((aptitude) => <li key={aptitude.label}>
        <p className={`mb-2 text-base ${aptitude.value === maximum ? 'font-semibold text-repere' : 'text-texte'}`}>{aptitude.label}</p>
        <div aria-hidden="true" className="h-3 overflow-hidden rounded-full bg-ligne"><div className={`h-full rounded-full ${aptitude.value === maximum ? 'bg-repere' : 'bg-violet-clair/50'}`} style={{ width: `${Math.max(0, Math.min(100, aptitude.value / aptitude.echelle_max * 100 || 0))}%` }} /></div>
        {aptitude.value === maximum && <p className="mt-2 text-sm text-doux">Un point qui ressort dans ce rapport</p>}
      </li>)}</ul>
      {!aptitudes.length && <p className="mt-4 text-base text-doux">Ces données ne sont pas disponibles dans ton rapport.</p>}
      <div className="mt-4"><SourceRapport page={5} /></div>
    </section>
    <section aria-labelledby="titre-personnalite" className="carte p-5 sm:p-6">
      <p className="text-sm font-semibold text-repere">Ta personnalité</p>
      <h2 id="titre-personnalite" className="mt-1 text-2xl font-bold">Ta façon d’aborder les situations</h2>
      <p className="mt-3 text-base leading-relaxed text-doux">Chaque dimension peut s’exprimer de plusieurs façons. Ce graphique ne résume pas qui tu es. Les dimensions en couleur sont mises en avant dans ton rapport.</p>
      <p className="mt-3 text-base font-semibold">{explication(6)}</p>
      <Radar dimensions={rapport.personnalite_hexaco} titre="Ta personnalité" />
      <Dimensions dimensions={rapport.personnalite_hexaco} />
      <div className="mt-4"><SourceRapport page={6} /></div>
    </section>
  </PageRecommandation>
}
