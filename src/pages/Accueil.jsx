import EnTete from '../components/EnTete.jsx'
import Resume from '../components/Resume.jsx'
import PremiersPas from '../components/PremiersPas.jsx'
import Recommandations from '../components/Recommandations.jsx'
import LiensUtiles from '../components/LiensUtiles.jsx'
import { AssistantCarte, AssistantFlottant } from '../components/Assistant.jsx'

export default function Accueil() {
  return (
    <>
      <EnTete />
      <main className="pb-securite mx-auto max-w-6xl px-4 pt-6 lg:pb-12">
        <div className="apparait mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Salut <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-1 text-doux">
            Voici ton rapport, en clair. Ce sont des <span className="font-semibold text-violet-clair">pistes</span>, et tu peux changer d'avis quand tu veux.
          </p>
        </div>

        {/* Téléphone : une colonne dans l'ordre du DOM. Ordinateur : résumé et recommandations à gauche. */}
        <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
          <div className="lg:col-span-2 lg:row-start-1"><Resume /></div>
          <aside className="space-y-5 lg:sticky lg:top-[calc(var(--bandeau,0px)+5.5rem)] lg:col-start-3 lg:row-span-2 lg:row-start-1">
            <PremiersPas />
            <AssistantCarte />
          </aside>
          <div className="lg:col-span-2 lg:row-start-2"><Recommandations /></div>
        </div>

        <footer className="mt-8 border-t border-ligne pt-4">
          <LiensUtiles />
        </footer>
      </main>
      <AssistantFlottant />
    </>
  )
}
