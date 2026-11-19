import { useRef, useState } from 'react'
import { Headphones } from 'lucide-react'
import PageRecommandation, { SourceRapport } from '../components/PageRecommandation.jsx'
import synthese from '../data/synthese-fictive.json'

export default function Synthese() {
  const lecteur = useRef(null)
  const [erreur, setErreur] = useState(false)
  const [vitesse, setVitesse] = useState('1')
  return <PageRecommandation titre="Écouter la synthèse" description="Prends le temps d’écouter. Tu peux aussi lire exactement le même texte juste en dessous." Icone={Headphones}>
    <section aria-labelledby="titre-lecture" className="carte p-5 sm:p-6">
      <h2 id="titre-lecture" className="text-xl font-bold">Ton rapport, à écouter</h2>
      <p className="mb-5 mt-2 text-base text-doux">Audio de démonstration : une voix de synthèse lit le résumé fictif. Tu peux faire une pause ou revenir en arrière.</p>
      <audio ref={lecteur} src={`${import.meta.env.BASE_URL}audio/synthese-fictive.wav`} aria-label="Synthèse audio du rapport fictif" controls preload="metadata" className="w-full" onError={() => setErreur(true)}>
        Ton navigateur ne peut pas lire cet audio. Le texte est disponible ci-dessous.
      </audio>
      {erreur && <p role="alert" className="mt-4 text-base text-doux">L’audio n’est pas disponible pour l’instant. Tu peux lire le texte ci-dessous.</p>}
      <label className="mt-5 flex flex-wrap items-center gap-3 text-base">Vitesse de lecture
        <select value={vitesse} onChange={(e) => { setVitesse(e.target.value); if (lecteur.current) lecteur.current.playbackRate = Number(e.target.value) }} className="min-h-11 rounded-xl border border-ligne bg-carte-2 px-3 text-texte">
          <option value="0.75">Plus lentement</option><option value="1">Vitesse habituelle</option><option value="1.25">Un peu plus vite</option>
        </select>
      </label>
    </section>
    <section aria-labelledby="titre-texte" className="carte p-5 sm:p-6">
      <h2 id="titre-texte" className="text-xl font-bold">Le texte lu</h2>
      <div className="mt-4 space-y-5">{synthese.paragraphes.map((paragraphe, index) => <div key={index}>
        <p className="text-base leading-relaxed">{paragraphe.texte}</p>
        {paragraphe.page && <SourceRapport page={paragraphe.page} />}
      </div>)}</div>
      <p className="mt-6 border-t border-ligne pt-4 text-sm text-doux">Les phrases sur ton profil renvoient aux pages du rapport fictif. Les autres phrases sont des repères pour lire le rapport avec le psychologue.</p>
    </section>
  </PageRecommandation>
}
