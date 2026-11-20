import { useState, useSyncExternalStore } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileText, ListChecks, Moon, ShieldCheck, Sun, Trash2, UserRound } from 'lucide-react'
import PageRecommandation from '../components/PageRecommandation.jsx'
import { rapport, source } from '../lib/donnees.js'
import { initialState } from '../lib/onboarding.js'
import { useOnboarding } from '../lib/onboarding-context.jsx'
import { oublierDiscussion } from '../lib/assistantEtat.js'

const BOUTON = 'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-ligne px-4 text-sm font-semibold transition hover:border-violet-clair sm:w-auto'
const BOUTON_PLEIN = 'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-violet px-5 text-sm font-semibold text-white transition hover:bg-violet-fonce sm:w-auto'

// Le thème est porté par l'en-tête (useTheme dans EnTete.jsx), qui l'écrit sur <html data-theme>.
// On lit cet attribut et on actionne le bouton de l'en-tête : un seul état, l'icône du haut reste juste.
const lireTheme = () => (document.documentElement.dataset.theme === 'clair' ? 'clair' : 'sombre')
function suivreTheme(prevenir) {
  const obs = new MutationObserver(prevenir)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => obs.disconnect()
}
const basculerTheme = () => document.querySelector('header button[aria-label^="Passer au thème"]')?.click()

const metiers = (n) => `${n} métier${n > 1 ? 's' : ''}`

function Carte({ id, titre, Icone, children }) {
  return <section aria-labelledby={id} className="carte p-4 sm:p-5">
    <h2 id={id} className="mb-3 flex items-center gap-2 text-lg font-bold"><Icone size={20} aria-hidden="true" className="shrink-0 text-violet-clair" />{titre}</h2>
    {children}
  </section>
}

function Ligne({ label, children }) {
  return <div className="flex items-baseline justify-between gap-3 py-2">
    <dt className="text-sm text-doux">{label}</dt>
    <dd className="text-right font-semibold">{children}</dd>
  </div>
}

// « Mon espace » : pas de compte. La page dit ce que le site garde sur cet appareil et permet de l'effacer.
export default function MonEspace() {
  const [onboarding, setOnboarding] = useOnboarding()
  const theme = useSyncExternalStore(suivreTheme, lireTheme)
  const [confirmation, setConfirmation] = useState(false)
  const navigate = useNavigate()
  const clair = theme === 'clair'

  const interesses = Object.values(onboarding.interets_metiers).filter((avis) => avis === 'interesse').length
  const preferes = Object.values(onboarding.favoris).filter(Boolean).length
  const ajouts = onboarding.ajouts_psy.length

  // Mêmes oublis que le lien « recommencer=1 » (main.jsx) : choix, premiers pas cochés, discussion.
  function effacer() {
    oublierDiscussion()
    try {
      for (const cle of ['possibles.onboarding', 'possibles.premiers-pas']) window.localStorage.removeItem(cle)
    } catch { /* stockage indisponible : rien à oublier */ }
    setOnboarding(initialState())
    navigate('/onboarding')
  }

  return <PageRecommandation titre="Mon espace" description="Ce que le site garde pour toi sur cet appareil." Icone={UserRound} navigation={false}>
    <Carte id="espace-rapport" titre="Ton rapport" Icone={FileText}>
      <dl className="mb-3 divide-y divide-ligne">
        <Ligne label="Rendez-vous">{source === 'api' ? rapport.rdv : `${rapport.rdv} · données inventées`}</Ligne>
        {rapport.nb_pages > 0 && <Ligne label="Longueur">{rapport.nb_pages} pages</Ligne>}
      </dl>
      <Link to="/rapport/1" className={BOUTON_PLEIN}><FileText size={18} aria-hidden="true" />Ouvrir ton rapport complet</Link>
    </Carte>

    <Carte id="espace-choix" titre="Tes choix" Icone={ListChecks}>
      <dl className="mb-3 divide-y divide-ligne">
        <Ligne label="Ça m’intéresse">{metiers(interesses)}</Ligne>
        <Ligne label="Tes préférés">{metiers(preferes)}</Ligne>
        <Ligne label="Ajoutés avec le psychologue">{metiers(ajouts)}</Ligne>
      </dl>
      <Link to="/choix" className={BOUTON}>Modifier mes choix</Link>
    </Carte>

    <Carte id="espace-apparence" titre="Apparence" Icone={clair ? Sun : Moon}>
      <p className="mb-3 text-base text-doux">Thème en cours : <span className="font-semibold text-texte">{clair ? 'clair' : 'sombre'}</span>.</p>
      <button type="button" onClick={basculerTheme} className={BOUTON}>
        {clair ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
        {clair ? 'Passer au thème sombre' : 'Passer au thème clair'}
      </button>
    </Carte>

    <Carte id="espace-donnees" titre="Tes données" Icone={ShieldCheck}>
      <ul className="mb-4 list-disc space-y-1.5 pl-5 text-base leading-relaxed text-doux">
        <li>Pas de compte, pas de mot de passe.</li>
        <li>Tes choix et ta discussion avec l’assistant restent dans ce navigateur.</li>
        <li>Ton rapport s’ouvre avec ton lien personnel. Ne le partage qu’avec les personnes de ton choix.</li>
      </ul>
      {confirmation
        ? <div role="group" aria-labelledby="espace-effacer" className="rounded-xl border border-ligne bg-carte-2 p-4">
          <p id="espace-effacer" className="font-semibold">Effacer tes choix sur cet appareil ?</p>
          <p className="mt-1 text-sm text-doux">Tes avis, tes préférés, tes métiers ajoutés, tes premiers pas cochés et ta discussion avec l’assistant seront oubliés. Tu recommenceras au début. Ton rapport ne change pas.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button type="button" autoFocus onClick={() => setConfirmation(false)} className={BOUTON}>Annuler</button>
            <button type="button" onClick={effacer} className={BOUTON_PLEIN}><Trash2 size={18} aria-hidden="true" />Oui, effacer</button>
          </div>
        </div>
        : <button type="button" onClick={() => setConfirmation(true)} className={BOUTON}><Trash2 size={18} aria-hidden="true" />Effacer mes choix sur cet appareil</button>}
    </Carte>

    <p className="text-sm text-doux">Cet outil ne remplace pas le psychologue : il t’aide à préparer la suite avec lui.</p>
  </PageRecommandation>
}
