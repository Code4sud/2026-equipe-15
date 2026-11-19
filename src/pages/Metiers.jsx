import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Star } from 'lucide-react'
import PageRecommandation, { SourceRapport } from '../components/PageRecommandation.jsx'
import { rapport } from '../lib/donnees.js'
import { ZONES } from '../config.js'
import { avisLabels } from '../lib/onboarding.js'
import { useOnboarding, useOnboardingStatus } from '../lib/onboarding-context.jsx'
import { modifierAvis } from '../lib/recommandations.js'

export default function Metiers() {
  const [onboarding, setOnboarding] = useOnboarding()
  const [storageError] = useOnboardingStatus()
  const [filtre, setFiltre] = useState('tous')
  const [annonce, setAnnonce] = useState('')
  return <PageRecommandation titre="Découvrir les métiers" description="Retrouve toutes les pistes de ton rapport. Même celles qui ne te parlent pas pour l’instant restent ici." Icone={Briefcase}>
    <label className="flex flex-wrap items-center gap-3 text-base">Afficher
      <select value={filtre} onChange={(e) => setFiltre(e.target.value)} className="min-h-11 max-w-full rounded-xl border border-ligne bg-carte px-3 text-texte">
        <option value="tous">Tous les métiers</option><option value="interesse">Ça m’intéresse</option><option value="plus_tard">Pas pour l’instant</option><option value="non">Pas intéressé</option>
      </select>
    </label>
    <p role="status" className="text-base text-doux">{annonce}</p>
    {storageError && <p role="alert" className="carte p-4 text-base text-doux">Ton navigateur ne permet pas la sauvegarde. Tes avis restent disponibles dans cet onglet seulement.</p>}
    {ZONES.map((zone) => {
      const tous = rapport.metiers.filter((m) => m.zone === zone.num)
      const visibles = tous.filter((m) => filtre === 'tous' || onboarding.interets_metiers[m.id] === filtre)
      return <section key={zone.num} aria-labelledby={`zone-${zone.num}`} className="space-y-3">
        <h2 id={`zone-${zone.num}`} className="pt-3 text-xl font-bold">{zone.duree} de préparation</h2>
        {!tous.length ? <p className="carte border-dashed p-5 text-base text-doux">Ton rapport ne propose pas de métier ici. Cela ne ferme aucune porte.</p> : !visibles.length ? <p className="carte p-5 text-base text-doux">Aucun métier avec cet avis dans cette zone.</p> : visibles.map((metier) => <article key={metier.id} className="carte p-5 sm:p-6">
          {onboarding.favoris[zone.num] === metier.id && <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-repere"><Star size={16} aria-hidden="true" />Ton préféré de cette zone</p>}
          <h3 className="text-xl font-bold"><Link to={`/metier/${metier.id}`} className="inline-flex min-h-11 items-center hover:text-violet-clair hover:underline">{metier.nom}</Link></h3>
          <p className="mt-2 text-base leading-relaxed text-doux">{metier.description}</p>
          <SourceRapport page={metier.source.page} />
          <fieldset className="mt-4 border-t border-ligne pt-4">
            <legend className="px-1 text-base font-semibold">Ton avis sur {metier.nom}</legend>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">{Object.entries(avisLabels).map(([valeur, label]) => <button key={valeur} type="button" aria-pressed={onboarding.interets_metiers[metier.id] === valeur} onClick={() => {
              setOnboarding(modifierAvis(onboarding, metier, valeur, rapport.metiers))
              setAnnonce(`${metier.nom} : ${label}.`)
            }} className={`min-h-11 rounded-xl border px-4 py-2 text-base font-semibold ${onboarding.interets_metiers[metier.id] === valeur ? 'border-violet bg-violet text-white' : 'border-ligne text-doux hover:border-violet-clair'}`}>{label}</button>)}</div>
          </fieldset>
        </article>)}
      </section>
    })}
  </PageRecommandation>
}
