import { Link } from 'react-router-dom'
import { Headphones, Compass, Briefcase, GraduationCap } from 'lucide-react'

const CARTES = [
  { id: 'synthese', titre: 'Écouter la synthèse', sous: 'Le résumé audio de ton rapport.', Icone: Headphones },
  { id: 'profil', titre: 'Explorer ton profil', sous: 'Tes résultats et tes points forts.', Icone: Compass },
  { id: 'metiers', titre: 'Découvrir les métiers', sous: 'Tous les métiers de ton rapport.', Icone: Briefcase },
  { id: 'formations', titre: 'Voir les formations', sous: 'Les parcours pour y arriver.', Icone: GraduationCap },
]

export default function Recommandations() {
  return (
    <section aria-labelledby="titre-reco" className="apparait" style={{ animationDelay: '200ms' }}>
      <h2 id="titre-reco" className="mb-3 text-lg font-semibold">Nos recommandations pour toi</h2>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {CARTES.map(({ id, titre, sous, Icone }) => (
          <li key={id}>
            <Link to={`/${id}`} className="carte flex h-full min-h-40 flex-col p-4 transition hover:border-violet-clair">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-violet/15 text-violet-clair">
                <Icone size={20} aria-hidden="true" />
              </span>
              <span className="mt-auto pt-4 font-semibold leading-tight">{titre}</span>
              <span className="mt-1 text-sm leading-snug text-doux">{sous}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
