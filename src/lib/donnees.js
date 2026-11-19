// Les données affichées par le site. Deux sources possibles, choisies au démarrage (main.jsx) :
//   'exemple' : le rapport inventé du contrat (« Rdv FICTIF »), sans API. C'est ce que montre GitHub Pages.
//   'api'     : le rapport du jeune, lu par l'API du projet à partir de son lien (voir api.js).
// Les exports sont remplacés par installer() avant le premier affichage : les pages les lisent telles quelles.
import fictif from '../../contrat/rapport-fictif.json'
import { ZONES } from '../config.js'
import { INFOS_METIERS } from '../data/infos-metiers.js'
import { urlPdf } from './api.js'

export let source = 'exemple'
export let acces = null // { api, jeton } quand le rapport vient de l'API
export let rapport = fictif.rapport
// Résumé de l'exemple. Avec l'API, le résumé est écrit à la demande : voir resume.js.
export let resume = fictif.resume
export let pdfUrl = import.meta.env.BASE_URL + fictif.rapport_pdf_url
// Salaires, formations, journée type : exemples inventés, rattachés aux métiers de l'exemple seulement.
export let infosMetiers = INFOS_METIERS

export let metiers = []
export let zones = []

function deriver() {
  metiers = [...rapport.metiers].sort((a, b) => a.zone - b.zone)
  zones = ZONES.map((z) => ({ id: z.num, duree: z.duree, metiers: metiers.filter((m) => m.zone === z.num) }))
}
deriver()

export function installer({ api, jeton, rapport: lu }) {
  source = 'api'
  acces = { api, jeton }
  rapport = lu
  resume = null
  pdfUrl = urlPdf(api, jeton)
  infosMetiers = {}
  deriver()
}

// Catalogue entièrement inventé pour les métiers ajoutés avec le psychologue, sans appel à l'API.
export const autresMetiers = [
  'Métier fictif du paysage', 'Métier fictif du son',
  'Métier fictif de la cuisine', 'Métier fictif du dessin',
  'Métier fictif du sport', 'Métier fictif de la mécanique',
  'Métier fictif de la nature', 'Métier fictif du numérique',
  'Métier fictif de la couture', 'Métier fictif du spectacle',
].map((nom, index) => ({ id: `psy-${index + 1}`, nom }))

export const metierParId = (id) => rapport.metiers.find((m) => m.id === id)
export const metiersDeZone = (num) => rapport.metiers.filter((m) => m.zone === num)
export const dureeDeZone = (num) => ZONES.find((z) => z.num === num)?.duree ?? ''
