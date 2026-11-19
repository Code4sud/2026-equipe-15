import { Link } from 'react-router-dom'
import { Headphones, Compass, Briefcase, GraduationCap } from 'lucide-react'

const CARTES = [
  { id: 'synthese', titre: 'Écouter la synthèse', sous: 'Un résumé audio de 2 min de ton rapport.', Icone: Headphones, couleur: 'from-violet/35 to-violet/5 text-violet-clair' },
  { id: 'profil', titre: 'Explorer ton profil', sous: 'Tes résultats et tes points forts.', Icone: Compass, couleur: 'from-sky-400/30 to-sky-400/5 text-sky-300' },
  { id: 'metiers', titre: 'Découvrir les métiers', sous: 'Tous les métiers de ton rapport.', Icone: Briefcase, couleur: 'from-amber-400/30 to-amber-400/5 text-amber-300' },
  { id: 'formations', titre: 'Voir les formations', sous: 'Les parcours pour y arriver.', Icone: GraduationCap, couleur: 'from-pink-400/30 to-pink-400/5 text-pink-300' },
]

export default function Recommandations() {
  return (
    <section aria-labelledby="titre-reco" className="apparait" style={{ animationDelay: '200ms' }}>
      <h2 id="titre-reco" className="mb-3 text-lg font-bold">Nos recommandations pour toi</h2>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {CARTES.map(({ id, titre, sous, Icone, couleur }) => (
          <li key={id}>
            <Link
              to={`/bientot/${id}`}
              className={`group flex h-full min-h-40 flex-col rounded-3xl border border-ligne bg-gradient-to-b p-4 transition hover:-translate-y-1 hover:border-white/20 ${couleur}`}
            >
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-black/25 transition group-hover:scale-110">
                <Icone size={22} aria-hidden="true" />
              </span>
              <span className="mt-auto pt-4 font-bold leading-tight text-texte">{titre}</span>
              <span className="mt-1 text-sm leading-snug text-doux">{sous}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
