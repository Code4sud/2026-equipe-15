import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Headphones, Pause, Play, RotateCcw, RotateCw, Square } from 'lucide-react'
import PageRecommandation, { SourceRapport } from '../components/PageRecommandation.jsx'
import synthese from '../data/synthese-fictive.json'
import { source, acces } from '../lib/donnees.js'
import { useResume } from '../lib/resume.js'
import { demanderResume } from '../lib/api.js'
import { useOnboarding } from '../lib/stockage.js'

const TITRE = 'Écouter la synthèse'
const DESCRIPTION = 'Prends le temps d’écouter. Tu peux aussi lire exactement le même texte juste en dessous.'
const VITESSES = [['0.8', 'Lent'], ['1', 'Normal'], ['1.2', 'Rapide']]

export default function Synthese() {
  return source === 'api' ? <SyntheseDuRapport /> : <SyntheseExemple />
}

function duree(secondes) {
  if (!Number.isFinite(secondes) || secondes < 0) return '0:00'
  return `${Math.floor(secondes / 60)}:${String(Math.floor(secondes % 60)).padStart(2, '0')}`
}

function ChoixVitesse({ vitesse, onChoisir, desactive }) {
  return (
    <div role="group" aria-label="Vitesse de lecture" className="flex rounded-full border border-ligne p-1">
      {VITESSES.map(([valeur, label]) => (
        <button
          key={valeur}
          type="button"
          aria-pressed={vitesse === valeur}
          disabled={desactive}
          onClick={() => onChoisir(valeur)}
          className={`min-h-11 rounded-full px-4 text-sm font-semibold transition-colors disabled:opacity-50 ${vitesse === valeur ? 'bg-violet text-white' : 'text-doux hover:text-texte'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function BoutonLecture({ joue, onClick, IconeArret = Pause, libelleArret = 'Mettre en pause' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={joue ? libelleArret : 'Écouter'}
      className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-violet text-white transition-colors hover:bg-violet-fonce"
    >
      {joue ? <IconeArret size={26} aria-hidden="true" fill="currentColor" /> : <Play size={26} aria-hidden="true" fill="currentColor" className="translate-x-0.5" />}
    </button>
  )
}

// Le lecteur : un grand bouton, la position dans l'audio, ±10 secondes et la vitesse.
// La balise <audio> fait la lecture ; ses commandes d'origine sont remplacées par celles-ci.
function LecteurAudio({ src, onErreur }) {
  const audio = useRef(null)
  const [joue, setJoue] = useState(false)
  const [temps, setTemps] = useState(0)
  const [total, setTotal] = useState(0)
  const [vitesse, setVitesse] = useState('1')

  useEffect(() => { if (audio.current) audio.current.playbackRate = Number(vitesse) }, [vitesse, src])

  const basculer = () => {
    const a = audio.current
    if (!a) return
    if (a.paused) a.play().catch(() => {})
    else a.pause()
  }
  const aller = (t) => {
    const a = audio.current
    if (!a) return
    a.currentTime = Math.min(Math.max(t, 0), total || 0)
    setTemps(a.currentTime)
  }
  const noterDuree = (e) => { if (Number.isFinite(e.currentTarget.duration)) setTotal(e.currentTarget.duration) }

  return (
    <div>
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onPlay={() => setJoue(true)}
        onPause={() => setJoue(false)}
        onEnded={() => setJoue(false)}
        onTimeUpdate={(e) => setTemps(e.currentTarget.currentTime)}
        onLoadedMetadata={noterDuree}
        onDurationChange={noterDuree}
        onError={onErreur}
      />
      <div className="flex items-center gap-4">
        <BoutonLecture joue={joue} onClick={basculer} />
        <div className="min-w-0 flex-1">
          <input
            type="range"
            min={0}
            max={total || 0}
            step="0.1"
            value={Math.min(temps, total || 0)}
            onChange={(e) => aller(Number(e.target.value))}
            aria-label="Position dans l’audio"
            aria-valuetext={`${duree(temps)} sur ${duree(total)}`}
            className="h-11 w-full cursor-pointer accent-violet"
          />
          <div className="flex justify-between text-sm tabular-nums text-doux" aria-hidden="true">
            <span>{duree(temps)}</span>
            <span>{duree(total)}</span>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button type="button" onClick={() => aller(temps - 10)} aria-label="Revenir 10 secondes en arrière" className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-ligne px-4 text-sm font-semibold transition-colors hover:border-violet-clair">
            <RotateCcw size={16} aria-hidden="true" /> 10 s
          </button>
          <button type="button" onClick={() => aller(temps + 10)} aria-label="Avancer de 10 secondes" className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-ligne px-4 text-sm font-semibold transition-colors hover:border-violet-clair">
            10 s <RotateCw size={16} aria-hidden="true" />
          </button>
        </div>
        <ChoixVitesse vitesse={vitesse} onChoisir={setVitesse} />
      </div>
    </div>
  )
}

// Sans audio de l'API : la voix de l'appareil lit le même texte (synthèse vocale du navigateur).
function LecteurAppareil({ texte }) {
  const [vitesse, setVitesse] = useState('1')
  const [lecture, setLecture] = useState(false)
  const disponible = typeof window !== 'undefined' && 'speechSynthesis' in window

  useEffect(() => () => { if (disponible) window.speechSynthesis.cancel() }, [disponible])

  if (!disponible) return <p className="text-base text-doux">Ton navigateur ne peut pas lire le texte à voix haute. Tu peux le lire ci-dessous.</p>

  const ecouter = () => {
    window.speechSynthesis.cancel()
    const enonce = new SpeechSynthesisUtterance(texte)
    enonce.lang = 'fr-FR'
    enonce.rate = Number(vitesse)
    enonce.onend = () => setLecture(false)
    enonce.onerror = () => setLecture(false)
    setLecture(true)
    window.speechSynthesis.speak(enonce)
  }
  const arreter = () => { window.speechSynthesis.cancel(); setLecture(false) }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <BoutonLecture joue={lecture} onClick={lecture ? arreter : ecouter} IconeArret={Square} libelleArret="Arrêter" />
        <p className="text-base text-doux">{lecture ? 'Lecture en cours…' : 'La voix de ton appareil lit le texte.'}</p>
      </div>
      <ChoixVitesse vitesse={vitesse} onChoisir={setVitesse} desactive={lecture} />
    </div>
  )
}

// L'audio de l'API est créé à la première demande (quelques secondes), puis gardé : on le demande dès
// l'ouverture de la page, pour qu'il soit prêt quand le jeune appuie sur « Écouter ».
// statut : 'absent' (pas de voix réglée côté API) | 'preparation' | 'pret' | 'erreur'
function useAudioPrepare(url) {
  const [etat, setEtat] = useState({ url: null, statut: 'absent', src: null })

  useEffect(() => {
    if (!url) return undefined
    let annule = false
    let objet = null
    window.fetch(url)
      .then((reponse) => {
        if (!reponse.ok) throw new Error(`audio indisponible (${reponse.status})`)
        return reponse.blob()
      })
      .then((fichier) => {
        if (annule) return
        objet = URL.createObjectURL(fichier)
        setEtat({ url, statut: 'pret', src: objet })
      })
      .catch(() => { if (!annule) setEtat({ url, statut: 'erreur', src: null }) })
    return () => {
      annule = true
      if (objet) URL.revokeObjectURL(objet)
    }
  }, [url])

  if (!url) return { statut: 'absent', src: null }
  if (etat.url !== url) return { statut: 'preparation', src: null }
  return etat
}

function CarteLecteur({ children, mention }) {
  return (
    <section aria-labelledby="titre-lecture" className="carte apparait p-5 sm:p-7">
      <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-repere">
        <Headphones size={14} aria-hidden="true" /> Résumé audio
      </p>
      <h2 id="titre-lecture" className="mt-1 text-2xl font-bold tracking-tight">Ton rapport, à écouter</h2>
      <p className="mb-6 mt-2 text-base text-doux">{mention}</p>
      {children}
    </section>
  )
}

function TexteLu({ phrases, note }) {
  return (
    <section aria-labelledby="titre-texte" className="carte apparait p-5 sm:p-7" style={{ animationDelay: '80ms' }}>
      <h2 id="titre-texte" className="text-xl font-bold">Le texte lu</h2>
      <ol className="mt-4 divide-y divide-ligne">
        {phrases.map((phrase, index) => (
          <li key={index} className="flex gap-3 py-4 first:pt-0 last:pb-0">
            <span aria-hidden="true" className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-carte-2 text-xs font-bold text-violet-clair">{index + 1}</span>
            <div className="min-w-0">
              <p className="text-base leading-relaxed">{phrase.texte}</p>
              {phrase.page && <SourceRapport page={phrase.page} />}
              {phrase.url?.startsWith('https://www.orientation-regionsud.fr/') && (
                <a href={phrase.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-violet-clair hover:underline">
                  <ArrowUpRight size={16} aria-hidden="true" />{phrase.titre ?? 'orientation-regionsud.fr'}<span className="sr-only"> (nouvel onglet)</span>
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-5 border-t border-ligne pt-4 text-sm text-doux">{note}</p>
    </section>
  )
}

// La version détaillée : le résumé, puis un passage sur chaque métier préféré. Elle n'est demandée à l'API
// que si le jeune la choisit, et gardée tant que ses choix ne changent pas.
const detailles = new Map()

function useResumeDetaille(onboarding, actif) {
  const cle = JSON.stringify([onboarding?.interets_metiers ?? {}, onboarding?.favoris ?? {}])
  const [etat, setEtat] = useState({ cle: null, statut: 'chargement', resume: null })
  const [essai, setEssai] = useState(0)

  useEffect(() => {
    if (!actif) return undefined
    if (detailles.has(cle)) {
      setEtat({ cle, statut: 'pret', resume: detailles.get(cle) })
      return undefined
    }
    let annule = false
    demanderResume({ ...acces, onboarding, version: 'longue', fetch: (...a) => window.fetch(...a) })
      .then((resume) => {
        detailles.set(cle, resume)
        if (!annule) setEtat({ cle, statut: 'pret', resume })
      })
      .catch(() => { if (!annule) setEtat({ cle, statut: 'erreur', resume: null }) })
    return () => { annule = true }
    // `cle` résume tout ce qui compte dans `onboarding`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif, cle, essai])

  const reessayer = () => { setEtat({ cle: null, statut: 'chargement', resume: null }); setEssai((n) => n + 1) }
  if (!actif || etat.cle !== cle) return { statut: 'chargement', resume: null, reessayer }
  return { ...etat, reessayer }
}

const VERSIONS = [['courte', 'L’essentiel'], ['longue', 'Version détaillée']]

// Rapport lu par l'API : le texte est celui du résumé, phrase par phrase, chacune avec sa source.
// L'audio est celui que l'API crée à partir de ce texte ; sans lui, la voix de l'appareil prend le relais.
function SyntheseDuRapport() {
  const [onboarding] = useOnboarding()
  const [version, setVersion] = useState('courte')
  const court = useResume(onboarding)
  const detaille = useResumeDetaille(onboarding, version === 'longue')
  const { statut, resume, reessayer } = version === 'longue' ? detaille : court
  const [audioKo, setAudioKo] = useState(null)
  const adresse = resume?.audio_url ? `${acces.api}${resume.audio_url}` : null
  const audio = useAudioPrepare(adresse && audioKo !== adresse ? adresse : null)
  const pageDuFait = (id) => resume?.faits?.find((f) => f.id === id)?.page
  const phrases = (resume?.phrases ?? []).map((p) => ({ texte: p.texte, page: pageDuFait(p.faits?.[0]), url: p.url, titre: p.titre }))
  const avecVoix = audio.statut === 'pret' || audio.statut === 'preparation'
  const mention = version === 'longue'
    ? 'Ton résumé, puis tes métiers préférés : ce qu’on y fait, ce que ça rejoint chez toi, et des repères pour y arriver.'
    : avecVoix ? 'Une voix de synthèse lit le résumé de ton rapport, mot pour mot.' : 'Le résumé de ton rapport, lu mot pour mot.'

  return (
    <PageRecommandation titre={TITRE} description={DESCRIPTION} Icone={Headphones}>
      <CarteLecteur mention={mention}>
        <div role="group" aria-label="Version à écouter" className="mb-6 grid grid-cols-2 gap-1 rounded-2xl bg-carte-2 p-1">
          {VERSIONS.map(([valeur, label]) => (
            <button
              key={valeur}
              type="button"
              aria-pressed={version === valeur}
              onClick={() => setVersion(valeur)}
              className={`min-h-11 rounded-xl px-3 text-sm font-semibold transition-colors ${version === valeur ? 'bg-violet text-white' : 'text-doux hover:text-texte'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {statut === 'chargement' && (
          <p role="status" className="flex items-center gap-3 font-semibold text-violet-clair">
            <span className="points-attente" aria-hidden="true"><span /><span /><span /></span>
            {version === 'longue' ? 'La version détaillée s’écrit à partir de ton rapport' : 'Ton résumé s’écrit à partir de ton rapport'}
          </p>
        )}
        {statut === 'erreur' && (
          <p role="alert" className="text-base text-doux">
            Ce texte n’est pas disponible pour l’instant.{' '}
            <button type="button" onClick={reessayer} className="min-h-11 font-semibold text-violet-clair hover:underline">Réessayer</button>
          </p>
        )}
        {statut === 'pret' && audio.statut === 'preparation' && (
          <p role="status" className="flex items-center gap-3 font-semibold text-violet-clair">
            <span className="points-attente" aria-hidden="true"><span /><span /><span /></span>
            {version === 'longue' ? 'La voix se prépare. Jusqu’à une minute la première fois…' : 'La voix se prépare. Quelques secondes…'}
          </p>
        )}
        {statut === 'pret' && audio.statut === 'pret' && <LecteurAudio key={audio.src} src={audio.src} onErreur={() => setAudioKo(adresse)} />}
        {statut === 'pret' && (audio.statut === 'absent' || audio.statut === 'erreur') && <LecteurAppareil key={version} texte={resume.texte} />}
      </CarteLecteur>
      {statut === 'pret' && <TexteLu phrases={phrases} note="Chaque phrase tirée de ton rapport renvoie à sa page. Les repères de salaire et d’accès viennent du site d’orientation de la Région, avec le lien vers la fiche." />}
    </PageRecommandation>
  )
}

function SyntheseExemple() {
  const [erreur, setErreur] = useState(false)
  return (
    <PageRecommandation titre={TITRE} description={DESCRIPTION} Icone={Headphones}>
      <CarteLecteur mention="Audio de démonstration : une voix de synthèse lit le résumé fictif.">
        <LecteurAudio src={`${import.meta.env.BASE_URL}audio/synthese-fictive.wav`} onErreur={() => setErreur(true)} />
        {erreur && <p role="alert" className="mt-4 text-base text-doux">L’audio n’est pas disponible pour l’instant. Tu peux lire le texte ci-dessous.</p>}
      </CarteLecteur>
      <TexteLu
        phrases={synthese.paragraphes}
        note="Les phrases sur ton profil renvoient aux pages du rapport fictif. Les autres phrases sont des repères pour lire le rapport avec le psychologue."
      />
    </PageRecommandation>
  )
}
