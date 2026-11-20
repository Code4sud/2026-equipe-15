// Recherche de l'écran « Le psychologue t'a parlé d'autres métiers ? ».
// Exemple inventé : le catalogue fictif, filtré dans le navigateur.
// Rapport lu par l'API : la table des métiers du Centre, interrogée après une courte pause de frappe.
import { useEffect, useState } from 'react'
import * as donnees from './donnees.js'
import { chercherMetiers } from './api.js'

const normaliser = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('fr')

// Renvoie { statut: 'repos' | 'chargement' | 'pret' | 'erreur', resultats, avecApi }.
export function useRechercheMetiers(texte, dejaAjoutes) {
  const q = texte.trim()
  const avecApi = donnees.source === 'api'
  const [etat, setEtat] = useState({ q: '', statut: 'repos', resultats: [] })

  useEffect(() => {
    if (!avecApi || q.length < 2) return undefined
    const controle = new AbortController()
    const minuteur = setTimeout(async () => {
      try {
        const resultats = await chercherMetiers({ ...donnees.acces, q, fetch: (...a) => window.fetch(...a), signal: controle.signal })
        setEtat({ q, statut: 'pret', resultats })
      } catch {
        if (!controle.signal.aborted) setEtat({ q, statut: 'erreur', resultats: [] })
      }
    }, 250)
    return () => { clearTimeout(minuteur); controle.abort() }
  }, [avecApi, q])

  const pasEncoreAjoute = (m) => !dejaAjoutes.some((a) => a.id === m.id)
  if (q.length < 2) return { statut: 'repos', resultats: [], avecApi }
  if (!avecApi) {
    const resultats = donnees.autresMetiers.filter((m) => normaliser(m.nom).includes(normaliser(q)) && pasEncoreAjoute(m))
    return { statut: 'pret', resultats, avecApi }
  }
  if (etat.q !== q) return { statut: 'chargement', resultats: [], avecApi }
  return { ...etat, resultats: etat.resultats.filter(pasEncoreAjoute), avecApi }
}
