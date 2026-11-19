import { LIENS_UTILES } from '../config.js'

export default function LiensUtiles() {
  return (
    <nav aria-label="Liens utiles" className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-doux">
      <span className="font-semibold">Liens utiles :</span>
      {LIENS_UTILES.map((l) => (
        <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline-offset-4 hover:text-violet-clair hover:underline">
          {l.label}<span className="sr-only"> (nouvel onglet)</span>
        </a>
      ))}
    </nav>
  )
}
