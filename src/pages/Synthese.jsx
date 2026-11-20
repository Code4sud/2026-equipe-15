import { useEffect, useRef, useState } from 'react'
import { Headphones } from 'lucide-react'
import PageRecommandation, { SourceRapport } from '../components/PageRecommandation.jsx'
import synthese from '../data/synthese-fictive.json'
import { source, acces } from '../lib/donnees.js'
import { useResume } from '../lib/resume.js'
import { useOnboarding } from '../lib/stockage.js'

export default function Synthese() {
  return source === 'api' ? <SyntheseDuRapport /> : <SyntheseExemple />
}

// Rapport lu par l'API : le texte est celui du résumé, phrase par phrase, chacune avec sa page.
// La voix est celle de l'appareil (synthèse vocale du navigateur) : elle lit exactement ce texte.
function SyntheseDuRapport() {
  const [onboarding] = useOnboarding()
  const { statut, resume, reessayer } = useResume(onboarding)
  const [vitesse, setVitesse] = useState('1')
  const [lecture, setLecture] = useState(false)
  const [audioKo, setAudioKo] = useState(false)
  const lecteur = useRef(null)
  // Audio créé par l'API (voix Piper) quand elle est réglée ; sinon, la voix de l'appareil.
  const audioUrl = resume?.audio_url && !audioKo ? `${acces.api}${resume.audio_url}` : null
  const voixDisponible = typeof window !== 'undefined' && 'speechSynthesis' in window
  const pageDuFait = (id) => resume?.faits?.find((f) => f.id === id)?.page
  const phrases = (resume?.phrases ?? []).map((p) => ({ texte: p.texte, page: pageDuFait(p.faits?.[0]) }))

  useEffect(() => () => { if (voixDisponible) window.speechSynthesis.cancel() }, [voixDisponible])

  const ecouter = () => {
    window.speechSynthesis.cancel()
    const enonce = new SpeechSynthesisUtterance(resume.texte)
    enonce.lang = 'fr-FR'
    enonce.rate = Number(vitesse)
    enonce.onend = () => setLecture(false)
    enonce.onerror = () => setLecture(false)
    setLecture(true)
    window.speechSynthesis.speak(enonce)
  }
  const arreter = () => { window.speechSynthesis.cancel(); setLecture(false) }

  return <PageRecommandation titre="Écouter la synthèse" description="Prends le temps d’écouter. Tu peux aussi lire exactement le même texte juste en dessous." Icone={Headphones}>
    <section aria-labelledby="titre-lecture" className="carte p-5 sm:p-6">
      <h2 id="titre-lecture" className="text-xl font-bold">Ton rapport, à écouter</h2>
      {statut === 'chargement' && <p role="status" className="mt-2 text-base text-doux">Ton résumé s’écrit à partir de ton rapport. Quelques secondes…</p>}
      {statut === 'erreur' && <p role="alert" className="mt-2 text-base text-doux">Ton résumé n’est pas disponible pour l’instant. <button type="button" onClick={reessayer} className="min-h-11 font-semibold text-violet-clair hover:underline">Réessayer</button></p>}
      {statut === 'pret' && <>
        {audioUrl ? <>
          <p className="mb-5 mt-2 text-base text-doux">Une voix lit le résumé de ton rapport, mot pour mot. Tu peux faire une pause ou revenir en arrière.</p>
          <audio ref={lecteur} src={audioUrl} aria-label="Le résumé de ton rapport, lu à voix haute" controls preload="none" className="w-full" onError={() => setAudioKo(true)}>
            Ton navigateur ne peut pas lire cet audio. Le texte est disponible ci-dessous.
          </audio>
          <label className="mt-5 flex flex-wrap items-center gap-3 text-base">Vitesse de lecture
            <select value={vitesse} onChange={(e) => { setVitesse(e.target.value); if (lecteur.current) lecteur.current.playbackRate = Number(e.target.value) }} className="min-h-11 rounded-xl border border-ligne bg-carte-2 px-3 text-texte">
              <option value="0.8">Plus lentement</option><option value="1">Vitesse habituelle</option><option value="1.2">Un peu plus vite</option>
            </select>
          </label>
        </> : <>
        <p className="mb-5 mt-2 text-base text-doux">La voix de ton appareil lit le résumé de ton rapport, mot pour mot.</p>
        {voixDisponible ? <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={lecture ? arreter : ecouter} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-violet px-6 font-semibold text-white">
            <Headphones size={18} aria-hidden="true" />{lecture ? 'Arrêter' : 'Écouter'}
          </button>
          <label className="flex flex-wrap items-center gap-3 text-base">Vitesse de lecture
            <select value={vitesse} onChange={(e) => setVitesse(e.target.value)} disabled={lecture} className="min-h-11 rounded-xl border border-ligne bg-carte-2 px-3 text-texte">
              <option value="0.8">Plus lentement</option><option value="1">Vitesse habituelle</option><option value="1.2">Un peu plus vite</option>
            </select>
          </label>
        </div> : <p className="text-base text-doux">Ton navigateur ne peut pas lire le texte à voix haute. Tu peux le lire ci-dessous.</p>}
        </>}
      </>}
    </section>
    {statut === 'pret' && <section aria-labelledby="titre-texte" className="carte p-5 sm:p-6">
      <h2 id="titre-texte" className="text-xl font-bold">Le texte lu</h2>
      <div className="mt-4 space-y-5">{phrases.map((phrase, index) => <div key={index}>
        <p className="text-base leading-relaxed">{phrase.texte}</p>
        {phrase.page && <SourceRapport page={phrase.page} />}
      </div>)}</div>
      <p className="mt-6 border-t border-ligne pt-4 text-sm text-doux">Chaque phrase renvoie à la page de ton rapport d’où elle vient.</p>
    </section>}
  </PageRecommandation>
}

function SyntheseExemple() {
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
