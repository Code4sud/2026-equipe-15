import { useEffect, useRef, useState } from 'react'
import { Bot, X, Send, MessageCircle, Maximize2, Minimize2 } from 'lucide-react'

const ACCUEIL = 'Pose-moi tes questions sur ton rapport, les métiers ou les formations !'
const SUGGESTIONS = ['Pourquoi ces métiers ?', 'Quelles formations ?', 'Comment choisir entre deux métiers ?']
// Pas encore branché sur le backend (étape 5) : réponse d'exemple.
const REPONSE_EXEMPLE = "Je ne suis pas encore branché. Bientôt, je te répondrai en m'appuyant uniquement sur ton rapport, avec la page d'où vient chaque information."

function Discussion({ id = 'msg-carte', hauteur = 'h-[420px]', pleinEcran, onFermer, onBasculer }) {
  const [messages, setMessages] = useState([{ de: 'ia', texte: ACCUEIL }])
  const [saisie, setSaisie] = useState('')
  const liste = useRef(null)

  // Garde le dernier message visible, y compris quand la fenêtre change de taille.
  useEffect(() => { const el = liste.current; if (el) el.scrollTop = el.scrollHeight }, [messages, pleinEcran])

  const envoyer = (texte) => {
    const t = texte.trim()
    if (!t) return
    setMessages((m) => [...m, { de: 'moi', texte: t }, { de: 'ia', texte: REPONSE_EXEMPLE }])
    setSaisie('')
  }

  return (
    <div className={`flex flex-col ${hauteur}`}>
      <div className="flex items-center justify-between gap-3 border-b border-ligne px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-violet/15 text-violet-clair">
            <Bot size={18} aria-hidden="true" />
          </span>
          <div>
            <p className="font-semibold leading-tight">Mon assistant IA</p>
            <p className="text-xs text-doux">Il s'appuie sur ton rapport</p>
          </div>
        </div>
        <div className="flex items-center">
          {onBasculer && (
            <button type="button" onClick={onBasculer} aria-label={pleinEcran ? "Réduire l'assistant" : "Agrandir l'assistant"} className="grid h-11 w-11 place-items-center rounded-full hover:bg-texte/10">
              {pleinEcran ? <Minimize2 size={19} aria-hidden="true" /> : <Maximize2 size={19} aria-hidden="true" />}
            </button>
          )}
          {onFermer && (
            <button type="button" onClick={onFermer} aria-label="Fermer l'assistant" className="grid h-11 w-11 place-items-center rounded-full hover:bg-texte/10">
              <X size={22} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div ref={liste} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.map((m, i) => (
          <p key={i} className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${m.de === 'moi' ? 'ml-auto rounded-br-md bg-violet text-white' : 'rounded-bl-md bg-carte-2'}`}>
            {m.texte}
          </p>
        ))}
        {messages.length === 1 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => envoyer(s)} className="min-h-11 rounded-full border border-violet-clair/50 px-4 text-sm font-medium text-violet-clair hover:bg-violet/15">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); envoyer(saisie) }}
        className="flex gap-2 border-t border-ligne p-3"
        style={pleinEcran ? { paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' } : undefined}
      >
        <label htmlFor={id} className="sr-only">Écrire un message</label>
        <input
          id={id}
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder="Écrire un message…"
          className="min-h-12 flex-1 rounded-full border border-ligne bg-carte-2 px-4 text-base placeholder:text-doux focus:border-violet-clair focus:outline-none"
        />
        <button type="submit" aria-label="Envoyer" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-violet text-white transition hover:bg-violet-fonce disabled:opacity-40" disabled={!saisie.trim()}>
          <Send size={19} aria-hidden="true" />
        </button>
      </form>
    </div>
  )
}

// Ordinateur : carte dans la colonne de droite.
export function AssistantCarte() {
  return (
    <section aria-label="Mon assistant IA" className="carte apparait hidden overflow-hidden lg:block" style={{ animationDelay: '180ms' }}>
      <Discussion />
    </section>
  )
}

// Téléphone : bouton flottant qui ouvre une petite fenêtre de discussion, agrandissable en plein écran.
export function AssistantFlottant() {
  const [ouvert, setOuvert] = useState(false)
  const [pleinEcran, setPleinEcran] = useState(false)
  const modal = ouvert && pleinEcran

  useEffect(() => {
    if (!ouvert) return
    const echap = (e) => e.key === 'Escape' && setOuvert(false)
    document.addEventListener('keydown', echap)
    return () => document.removeEventListener('keydown', echap)
  }, [ouvert])

  // La page reste défilable derrière la petite fenêtre, pas derrière le plein écran.
  useEffect(() => {
    if (!modal) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [modal])

  const cadre = pleinEcran
    ? 'inset-x-0 bottom-0 top-[var(--bandeau,0px)] bg-fond'
    : 'right-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] h-[min(27rem,calc(100dvh-var(--bandeau,0px)-5.5rem))] w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-ligne bg-carte shadow-2xl shadow-black/30'

  return (
    <div className="lg:hidden">
      {!ouvert && (
        <button
          type="button"
          onClick={() => setOuvert(true)}
          aria-label="Ouvrir l'assistant"
          className="fixed right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-violet text-white shadow-lg shadow-black/30 transition hover:bg-violet-fonce active:scale-95"
          style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        >
          <MessageCircle size={24} aria-hidden="true" />
        </button>
      )}
      {/* Reste monté une fois fermé : la discussion n'est pas perdue. */}
      <div role="dialog" aria-modal={modal} aria-label="Mon assistant IA" className={ouvert ? `fixed z-50 ${cadre}` : 'hidden'}>
        <Discussion
          id="msg-flottant"
          hauteur="h-full"
          pleinEcran={pleinEcran}
          onBasculer={() => setPleinEcran((p) => !p)}
          onFermer={() => setOuvert(false)}
        />
      </div>
    </div>
  )
}
