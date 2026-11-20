// L'état de l'assistant, partagé par toutes les pages : la discussion suit le jeune quand il ouvre une source
// (visionneuse PDF, fiche métier) et qu'il revient. Chaque page monte son propre assistant ; sans ce magasin,
// la discussion disparaissait à chaque changement de page.
// Recopié dans sessionStorage : la discussion survit à un rechargement, pas à la fermeture de l'onglet.
// Elle est liée au rapport affiché : un autre rapport ne la récupère pas.
import { useSyncExternalStore } from 'react'

export const CLE_ASSISTANT = 'possibles-ai:assistant'
const VERSION = 1
const MESSAGES_MAX = 60
const ECHEC = { de: 'ia', paragraphes: ['Je n’ai pas réussi à répondre. Repose ta question.'] }

// ouvertSur : la page (chemin) où la fenêtre de l'assistant est ouverte, ou null. En suivant un lien de la
// discussion, on voit la page demandée ; en revenant, l'assistant est rouvert là où on l'avait laissé.
export const etatVide = () => ({ messages: [], ouvertSur: null, pleinEcran: false, saisie: '', attente: false, focus: 0 })

// ---------- Fonctions pures ----------

const texteValide = (t) => typeof t === 'string' && t.trim().length > 0

function messageValide(m) {
  if (!m || typeof m !== 'object') return false
  if (m.de === 'moi') return texteValide(m.texte)
  if (m.de === 'ia') return Array.isArray(m.paragraphes) && m.paragraphes.length > 0 && m.paragraphes.every((p) => typeof p === 'string')
  return false
}

// Ce qui est enregistré : jamais l'attente d'une réponse (elle ne survit pas à un rechargement).
export function serialiser(etat, rapportId) {
  return JSON.stringify({
    v: VERSION,
    rapport: rapportId,
    messages: (etat?.messages ?? []).filter(messageValide).slice(-MESSAGES_MAX),
    ouvertSur: typeof etat?.ouvertSur === 'string' ? etat.ouvertSur : null,
    pleinEcran: etat?.pleinEcran === true,
    saisie: typeof etat?.saisie === 'string' ? etat.saisie : '',
  })
}

// Contenu abîmé, autre version ou autre rapport : on repart d'un assistant vide, sans erreur.
export function relire(brut, rapportId) {
  const vide = etatVide()
  if (typeof brut !== 'string' || !brut) return vide
  let lu
  try {
    lu = JSON.parse(brut)
  } catch {
    return vide
  }
  if (!lu || typeof lu !== 'object' || lu.v !== VERSION || lu.rapport !== rapportId) return vide
  const messages = Array.isArray(lu.messages) ? lu.messages.filter(messageValide).slice(-MESSAGES_MAX) : []
  let saisie = typeof lu.saisie === 'string' ? lu.saisie : ''
  // Une question restée sans réponse (page rechargée pendant l'attente) revient dans la zone de saisie.
  while (messages.at(-1)?.de === 'moi') {
    const orpheline = messages.pop()
    if (!saisie) saisie = orpheline.texte
  }
  return {
    ...vide,
    messages,
    ouvertSur: typeof lu.ouvertSur === 'string' ? lu.ouvertSur : null,
    pleinEcran: lu.pleinEcran === true,
    saisie,
  }
}

// L'historique envoyé à l'IA : [{ de, texte }].
export const versHistorique = (messages) =>
  messages.map((m) => ({ de: m.de, texte: m.de === 'moi' ? m.texte : m.paragraphes.join(' ') }))

// ---------- Le magasin ----------

// stockage : { getItem, setItem, removeItem } ou null. Tout accès est protégé (navigation privée).
export function creerMagasin({ stockage = null, rapportId = null } = {}) {
  let id = rapportId
  let etat = etatVide()
  let discussion = 0 // change à chaque « Nouvelle discussion » : une réponse en retard n'y est pas ajoutée
  const abonnes = new Set()

  const charger = () => {
    try {
      etat = relire(stockage?.getItem(CLE_ASSISTANT), id)
    } catch {
      etat = etatVide()
    }
  }
  const enregistrer = () => {
    try {
      stockage?.setItem(CLE_ASSISTANT, serialiser(etat, id))
    } catch { /* stockage indisponible : la discussion reste en mémoire */ }
  }
  const changer = (modif) => {
    etat = { ...etat, ...modif }
    enregistrer()
    for (const prevenir of abonnes) prevenir()
  }
  charger()

  return {
    lire: () => etat,
    abonner(prevenir) {
      abonnes.add(prevenir)
      return () => abonnes.delete(prevenir)
    },
    // Le rapport affiché est connu après le chargement du site : la discussion d'un autre rapport est écartée.
    brancher(nouvelId) {
      if (nouvelId === id) return
      id = nouvelId
      discussion += 1
      charger()
      for (const prevenir of abonnes) prevenir()
    },
    ecrire: (saisie) => changer({ saisie }),
    // Ouvre la fenêtre sur la page donnée et demande à placer le curseur dans la zone de saisie.
    ouvrir: (chemin, { focus = false } = {}) => changer({ ouvertSur: chemin, focus: etat.focus + (focus ? 1 : 0) }),
    fermer: () => changer({ ouvertSur: null }),
    basculerPleinEcran: () => changer({ pleinEcran: !etat.pleinEcran }),
    // « Nouvelle discussion » : tout est oublié, le stockage aussi. La fenêtre reste comme elle est.
    vider() {
      discussion += 1
      etat = { ...etat, messages: [], saisie: '', attente: false }
      try {
        stockage?.removeItem(CLE_ASSISTANT)
      } catch { /* rien à oublier */ }
      if (etat.ouvertSur || etat.pleinEcran) enregistrer()
      for (const prevenir of abonnes) prevenir()
    },
    // Pose une question. `repondre(question, historique)` renvoie la réponse (une promesse). La demande vit
    // ici, pas dans un composant : si le jeune change de page pendant l'attente, la réponse arrive quand même.
    async poser(texte, repondre) {
      const question = typeof texte === 'string' ? texte.trim() : ''
      if (!question || etat.attente) return false
      const historique = versHistorique(etat.messages)
      const enCours = discussion
      changer({ messages: [...etat.messages, { de: 'moi', texte: question }], saisie: '', attente: true })
      let reponse
      try {
        reponse = { de: 'ia', ...(await repondre(question, historique)) }
      } catch {
        reponse = ECHEC
      }
      if (enCours !== discussion) return false
      changer({ messages: [...etat.messages, messageValide(reponse) ? reponse : ECHEC], attente: false })
      return true
    },
  }
}

// ---------- Dans le navigateur ----------

function stockageSession() {
  try {
    return globalThis.sessionStorage ?? null
  } catch {
    return null
  }
}

export const assistant = creerMagasin({ stockage: stockageSession() })

export const useAssistant = () => useSyncExternalStore(assistant.abonner, assistant.lire, assistant.lire)

// Lien « recommencer=1 » : la discussion est oubliée avec les choix.
export function oublierDiscussion() {
  assistant.vider()
  assistant.fermer()
  try {
    stockageSession()?.removeItem(CLE_ASSISTANT)
  } catch { /* rien à oublier */ }
}
