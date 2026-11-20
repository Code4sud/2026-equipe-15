import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Star, X } from 'lucide-react'
import PageRecommandation from '../components/PageRecommandation.jsx'
import { rapport } from '../lib/donnees.js'
import { ZONES } from '../config.js'
import { avisLabels, candidats } from '../lib/onboarding.js'
import { useOnboarding, useOnboardingStatus } from '../lib/onboarding-context.jsx'
import { basculerPrefere, modifierAvis } from '../lib/recommandations.js'

// Tous les choix de l'onboarding sur un seul écran : chaque touche est enregistrée tout de suite.
export default function MesChoix() {
  const [onboarding, setOnboarding] = useOnboarding()
  const [storageError] = useOnboardingStatus()
  const [annonce, setAnnonce] = useState('')
  const avis = onboarding.interets_metiers

  return <PageRecommandation titre="Modifier mes choix" description="Change un avis ou ton préféré d’une zone. C’est enregistré tout de suite." Icone={Pencil} navigation={false}>
    <p role="status" className="sr-only">{annonce}</p>
    {storageError && <p role="alert" className="carte p-4 text-base text-doux">Ton navigateur ne permet pas la sauvegarde. Tes choix restent disponibles dans cet onglet seulement.</p>}
    <p className="flex items-start gap-2 text-sm text-doux"><Star size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-repere" />L’étoile marque ton préféré : un seul par zone, parmi les métiers qui t’intéressent.</p>

    {ZONES.map((zone) => {
      const metiers = rapport.metiers.filter((m) => m.zone === zone.num)
      const possibles = candidats({ metiers }, avis)
      return <section key={zone.num} aria-labelledby={`choix-zone-${zone.num}`}>
        <h2 id={`choix-zone-${zone.num}`} className="mb-2 text-lg font-bold">{zone.duree} <span className="font-normal text-doux">de préparation</span></h2>
        {!metiers.length
          ? <p className="rounded-xl border border-dashed border-ligne px-4 py-3 text-sm text-doux">Ton rapport ne propose pas de métier ici. Cela ne ferme aucune porte.</p>
          : <ul className="carte divide-y divide-ligne px-3 sm:px-4">
            {metiers.map((metier) => {
              const prefere = onboarding.favoris[zone.num] === metier.id
              const candidat = possibles.some((m) => m.id === metier.id)
              return <li key={metier.id} className="py-2">
                <div className="flex items-center gap-2">
                  <Link to={`/metier/${metier.id}`} className="flex min-h-11 min-w-0 flex-1 items-center font-semibold leading-snug hover:text-violet-clair hover:underline">{metier.nom}</Link>
                  <button
                    type="button"
                    aria-pressed={prefere}
                    disabled={!candidat}
                    aria-label={`Préféré : ${metier.nom}`}
                    onClick={() => {
                      setOnboarding(basculerPrefere(onboarding, metier, rapport.metiers))
                      setAnnonce(prefere ? `${metier.nom} n’est plus ton préféré.` : `${metier.nom} : ton préféré de cette zone.`)
                    }}
                    className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition disabled:opacity-40 ${prefere ? 'border-repere text-repere' : 'border-ligne text-doux enabled:hover:border-violet-clair'}`}
                  >
                    <Star size={16} aria-hidden="true" fill={prefere ? 'currentColor' : 'none'} />Préféré
                  </button>
                </div>
                <div role="group" aria-label={`Ton avis sur ${metier.nom}`} className="mt-1 grid grid-cols-3 gap-1.5">
                  {Object.entries(avisLabels).map(([valeur, label]) => <button
                    key={valeur}
                    type="button"
                    aria-pressed={avis[metier.id] === valeur}
                    onClick={() => {
                      setOnboarding(modifierAvis(onboarding, metier, valeur, rapport.metiers))
                      setAnnonce(`${metier.nom} : ${label}.`)
                    }}
                    className={`min-h-11 rounded-xl border px-1 py-1 text-[13px] font-semibold leading-tight transition ${avis[metier.id] === valeur ? 'border-violet bg-violet text-white' : 'border-ligne text-doux hover:border-violet-clair'}`}
                  >{label}</button>)}
                </div>
              </li>
            })}
          </ul>}
      </section>
    })}

    <section aria-labelledby="choix-psy">
      <h2 id="choix-psy" className="mb-2 text-lg font-bold">Avec le psychologue</h2>
      {onboarding.ajouts_psy.length
        ? <ul className="carte divide-y divide-ligne px-3 sm:px-4">
          {onboarding.ajouts_psy.map((metier) => <li key={metier.id} className="flex items-center gap-2 py-1">
            <span className="min-w-0 flex-1 font-semibold leading-snug">{metier.nom}</span>
            <button
              type="button"
              aria-label={`Retirer ${metier.nom}`}
              onClick={() => {
                setOnboarding({ ...onboarding, ajouts_psy: onboarding.ajouts_psy.filter((a) => a.id !== metier.id) })
                setAnnonce(`${metier.nom} retiré.`)
              }}
              className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-semibold text-doux hover:text-texte"
            ><X size={16} aria-hidden="true" />Retirer</button>
          </li>)}
        </ul>
        : <p className="text-sm text-doux">Tu n’as pas ajouté d’autre métier.</p>}
      <Link to="/onboarding?ecran=ajouts" className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-violet-clair hover:underline"><Plus size={16} aria-hidden="true" />Ajouter un métier</Link>
    </section>

    <div className="flex flex-col items-center gap-1 pt-2">
      <Link to="/" className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-violet px-6 font-semibold text-white transition hover:bg-violet-fonce sm:w-auto">Retour à ma page</Link>
      <Link to="/onboarding" className="inline-flex min-h-11 items-center text-sm text-doux hover:text-texte hover:underline">Refaire tout le parcours</Link>
    </div>
  </PageRecommandation>
}
