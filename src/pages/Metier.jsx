import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Hourglass, FileText } from 'lucide-react'
import { metierParId, dureeDeZone } from '../lib/donnees.js'
import Bientot from './Bientot.jsx'

// Version minimale (l'étape 3 ajoutera les informations régionales et leurs sources).
export default function Metier() {
  const { id } = useParams()
  const metier = metierParId(id)
  if (!metier) return <Bientot titre="Ce métier n'est pas dans ton rapport" />

  return (
    <main className="pb-securite mx-auto max-w-2xl px-4 pt-4">
      <Link to="/" className="inline-flex min-h-11 items-center gap-2 font-semibold text-doux hover:text-texte">
        <ArrowLeft size={18} aria-hidden="true" /> Retour
      </Link>
      <article className="carte apparait mt-3 p-6">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-violet-clair">
          <Hourglass size={13} aria-hidden="true" /> {dureeDeZone(metier.zone)}
        </span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">{metier.nom}</h1>
        <p className="mt-4 text-lg leading-relaxed">{metier.description}</p>
        <Link to={`/rapport/${metier.source.page}`} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-violet-clair hover:underline">
          <FileText size={15} aria-hidden="true" /> Voir dans ton rapport, page {metier.source.page}
        </Link>
      </article>
      <p className="mt-4 text-center text-sm text-doux">Salaires, formations près de chez toi : bientôt ici, avec leurs sources.</p>
    </main>
  )
}
