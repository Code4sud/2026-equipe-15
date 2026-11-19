import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Rocket } from 'lucide-react'

const TITRES = {
  synthese: 'Écouter la synthèse',
  profil: 'Explorer ton profil',
  metiers: 'Découvrir les métiers',
  formations: 'Voir les formations',
  connexion: 'Mon espace',
}

export default function Bientot({ titre }) {
  const { quoi } = useParams()
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <span className="apparait grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-violet to-violet-fonce shadow-xl shadow-violet/30">
        <Rocket size={36} aria-hidden="true" />
      </span>
      <h1 className="apparait mt-6 text-2xl font-extrabold">{titre ?? TITRES[quoi] ?? 'Bientôt disponible'}</h1>
      <p className="apparait mt-2 text-doux">Bientôt disponible. On y travaille !</p>
      <Link to="/" className="apparait mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-violet px-6 font-semibold hover:bg-violet-fonce">
        <ArrowLeft size={18} aria-hidden="true" /> Retour à ma page
      </Link>
    </main>
  )
}
