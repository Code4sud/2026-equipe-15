import { Compass } from 'lucide-react'
import PageRecommandation from '../components/PageRecommandation.jsx'
import PartieProfil from '../components/GraphiquesProfil.jsx'
import { rapport } from '../lib/donnees.js'
import { useResume } from '../lib/resume.js'
import { useOnboarding } from '../lib/stockage.js'

// Page du rapport d'où vient une partie : celle que portent ses éléments, sinon la page habituelle.
const pageDe = (elements, habituelle) => elements.find((e) => e.source?.page)?.source.page ?? habituelle

export default function Profil() {
  const [onboarding] = useOnboarding()
  const { resume } = useResume(onboarding)
  const interets = rapport.interets_riasec ?? []
  const aptitudes = rapport.aptitudes ?? []
  const personnalite = rapport.personnalite_hexaco ?? []
  const pages = { interets: pageDe(interets, 4), aptitudes: pageDe(aptitudes, 5), personnalite: pageDe(personnalite, 6) }
  // La phrase du résumé qui s'appuie sur cette page du rapport, quand le résumé est prêt.
  const phrase = (page) => resume?.points?.find((p) => p.page === page)?.texte

  return <PageRecommandation titre="Mon profil" description="Ce qui ressort chez toi, en trois parties : ce qui t’attire, tes aptitudes, ta façon d’être." Icone={Compass}>
    <aside className="carte p-5 text-base leading-relaxed text-doux">
      <strong className="text-texte">C’est une photo du jour de ton passage.</strong> La fatigue ou la motivation ont pu jouer, et ça peut changer. Aucun profil ne vaut mieux qu’un autre.
    </aside>
    <PartieProfil
      id="interets" surtitre="Tes intérêts" titre="Ce qui t’attire"
      mesure="Cette partie montre les types d’activités qui t’attirent le plus. Plusieurs peuvent te plaire en même temps."
      elements={interets} page={pages.interets} phrase={phrase(pages.interets)}
    />
    <PartieProfil
      id="aptitudes" surtitre="Tes aptitudes" titre="Tes façons de réfléchir"
      mesure="Cette partie montre ce qui t’aide le plus quand tu dois comprendre, réfléchir ou trouver une idée. Une barre plus courte ne ferme aucune porte."
      elements={aptitudes} page={pages.aptitudes} phrase={phrase(pages.aptitudes)}
    />
    <PartieProfil
      id="personnalite" surtitre="Ta personnalité" titre="Ta façon d’être"
      mesure="Cette partie décrit ta façon d’aborder les gens et les situations. Chaque trait a ses atouts, qu’il ressorte beaucoup ou peu."
      elements={personnalite} page={pages.personnalite} phrase={phrase(pages.personnalite)}
    />
  </PageRecommandation>
}
