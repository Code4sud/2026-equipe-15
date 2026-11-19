import { useState } from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap, MapPin, Clock } from 'lucide-react'
import PageRecommandation from '../components/PageRecommandation.jsx'
import { rapport } from '../lib/donnees.js'
import { INFOS_METIERS } from '../data/infos-metiers.js'
import { listerFormations } from '../lib/recommandations.js'

export default function Formations() {
  const [metierId, setMetierId] = useState('')
  const [alternance, setAlternance] = useState(false)
  const formations = listerFormations(rapport.metiers, INFOS_METIERS, { metierId, alternance })
  return <PageRecommandation titre="Voir les formations" description="Explore les exemples de parcours et prépare tes questions sur le lieu, le coût ou l’accès." Icone={GraduationCap}>
    <aside className="carte border-dashed p-5">
      <h2 className="text-lg font-bold">Des exemples inventés pour la démo</h2>
      <p className="mt-2 text-base leading-relaxed text-doux">Les formations, villes, durées et conditions ci-dessous sont fictives. Ce ne sont pas des offres où t’inscrire. Ton rapport ne contient pas de formations vérifiées.</p>
    </aside>
    <section aria-label="Filtrer les exemples" className="carte space-y-4 p-5">
      <label className="flex flex-col gap-2 text-base font-semibold">Pour quel métier ?
        <select value={metierId} onChange={(e) => setMetierId(e.target.value)} className="min-h-12 w-full min-w-0 rounded-xl border border-ligne bg-carte-2 px-3 text-base text-texte">
          <option value="">Tous les métiers du rapport</option>{rapport.metiers.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
        </select>
      </label>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base"><input type="checkbox" checked={alternance} onChange={(e) => setAlternance(e.target.checked)} className="h-5 w-5 accent-violet" />Exemples en alternance seulement</label>
    </section>
    <p role="status" className="text-base text-doux">{formations.length} exemple{formations.length > 1 ? 's' : ''} affiché{formations.length > 1 ? 's' : ''}</p>
    {!formations.length && <p className="carte p-5 text-base text-doux">Aucun exemple pour ce choix. Cela ne veut pas dire qu’il n’existe pas de formation pour ce métier. Tu peux chercher avec le psychologue.</p>}
    {formations.map((formation) => <article key={formation.id} className="carte p-5 sm:p-6">
      <p className="text-sm font-semibold text-repere">Exemple inventé</p>
      <h2 className="mt-2 text-xl font-bold">{formation.nom}</h2>
      <Link to={`/metier/${formation.metier.id}`} className="inline-flex min-h-11 items-center text-base font-semibold text-violet-clair hover:underline">Pour {formation.metier.nom}</Link>
      <dl className="mt-3 space-y-3 text-base">
        <div><dt className="flex items-center gap-2 text-doux"><MapPin size={17} aria-hidden="true" />Lieu fictif</dt><dd className="mt-1">{formation.ville}</dd></div>
        <div><dt className="flex items-center gap-2 text-doux"><Clock size={17} aria-hidden="true" />Durée fictive</dt><dd className="mt-1">{formation.duree}</dd></div>
        <div><dt className="text-doux">Coût fictif</dt><dd className="mt-1">{formation.cout}</dd></div>
        <div><dt className="text-doux">Accès fictif</dt><dd className="mt-1">{formation.acces}</dd></div>
        <div><dt className="text-doux">Alternance dans cet exemple</dt><dd className="mt-1">{formation.alternance ? 'Oui' : 'Non'}</dd></div>
      </dl>
    </article>)}
    <section aria-labelledby="titre-chercher" className="carte p-5 sm:p-6">
      <h2 id="titre-chercher" className="text-xl font-bold">Chercher une vraie formation</h2>
      <p className="mt-2 text-base text-doux">Vérifie les dates, le coût, les déplacements et les conditions d’inscription avec l’établissement.</p>
      <a href="https://www.orientation-regionsud.fr/" target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-12 items-center justify-center rounded-xl bg-violet px-5 py-3 text-base font-semibold text-white">Consulter Orientation Région Sud<span className="sr-only"> (nouvel onglet)</span></a>
      <a href="https://www.onisep.fr/" target="_blank" rel="noreferrer" className="mt-3 flex min-h-11 items-center text-base font-semibold text-violet-clair hover:underline">Consulter l’ONISEP<span className="sr-only"> (nouvel onglet)</span></a>
    </section>
    <footer className="border-t border-ligne pt-5 text-base text-doux">
      <h2 className="font-semibold text-texte">D’où viennent ces informations ?</h2>
      <p className="mt-2">Les exemples sont les mêmes données inventées que sur les fiches métiers de la démo. Les sites cités sont des liens pour ta recherche ; ils ne sont pas la source de ces exemples.</p>
    </footer>
  </PageRecommandation>
}
