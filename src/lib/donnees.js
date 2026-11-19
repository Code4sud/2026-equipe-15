// Données inventées (« Rdv FICTIF ») : seule source tant que l'API n'est pas branchée (étape 7).
import fictif from '../../contrat/rapport-fictif.json'
import { ZONES } from '../config.js'

export const rapport = fictif.rapport
export const resume = fictif.resume
export const onboardingParDefaut = fictif.onboarding
export const pdfUrl = import.meta.env.BASE_URL + fictif.rapport_pdf_url

export const metierParId = (id) => rapport.metiers.find((m) => m.id === id)
export const metiersDeZone = (num) => rapport.metiers.filter((m) => m.zone === num)
export const dureeDeZone = (num) => ZONES.find((z) => z.num === num)?.duree ?? ''
