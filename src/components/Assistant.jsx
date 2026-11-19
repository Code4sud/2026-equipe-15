import { useEffect, useRef, useState } from 'react'
import { Bot, X, Send, MessageCircle } from 'lucide-react'

const ACCUEIL = 'Pose-moi tes questions sur ton rapport, les métiers ou les formations !'
const SUGGESTIONS = ['Pourquoi ces métiers ?', 'Quelles formations ?', 'Comment choisir entre deux métiers ?']
// Pas encore branché sur le backend (étape 5) : réponse d'exemple.
const REPONSE_EXEMPLE = "Je ne suis pas encore branché. Bientôt, je te répondrai en m'appuyant uniquement sur ton rapport, avec la page d'où vient chaque information."

function Discussion({ onFermer, pleinEcran }) {
  const [messages, setMessages] = useState([{ de: 'ia', texte: ACCUEIL }])
  const [saisie, setSaisie] = useState('')
  const bas = useRef(null)

  useEffect(() => { bas.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [messages])

  const envoyer = (texte) => {
    const t = texte.trim()
    if (!t) return
    setMessages((m) => [...m, { de: 'moi', texte: t }, { de: 'ia', texte: REPONSE_EXEMPLE }])
    setSaisie('')
  }

  return (
    <div className={`flex flex-col ${pleinEcran ? 'h-full' : 'h-[420px]'}`}>
      <div className="flex items-center justify-between gap-3 border-b border-ligne px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet to-violet-fonce">
            <Bot size={18} aria-hidden="true" />
          </span>
          <div>
            <p className="font-bold leading-tight">Mon assistant IA</p>
            <p className="text-xs text-doux">Il s'appuie sur ton rapport</p>
          </div>
        </div>
        {onFermer && (
          <button type="button" onClick={onFermer} aria-label="Fermer l'assistant" className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10">
            <X size={22} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.map((m, i) => (
          <p key={i} className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${m.de === 'moi' ? 'ml-auto rounded-br-md bg-violet text-white' : 'rounded-bl-md bg-carte-2'}`}>
            {m.texte}
          </p>
        ))}
        {messages.length === 1 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => envoyer(s)} className="min-h-11 rounded-full border border-violet/40 px-4 text-sm font-medium text-violet-clair hover:bg-violet/15">
                {s}
              </button>
            ))}
          </div>
        )}
        <div ref={bas} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); envoyer(saisie) }}
        className="flex gap-2 border-t border-ligne p-3"
        style={pleinEcran ? { paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' } : undefined}
      >
        <label htmlFor={pleinEcran ? 'msg-plein' : 'msg-carte'} className="sr-only">Écrire un message</label>
        <input
          id={pleinEcran ? 'msg-plein' : 'msg-carte'}
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder="Écrire un message…"
          className="min-h-12 flex-1 rounded-full border border-ligne bg-carte-2 px-4 text-base placeholder:text-doux focus:border-violet focus:outline-none"
        />
        <button type="submit" aria-label="Envoyer" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-violet transition hover:bg-violet-fonce disabled:opacity-40" disabled={!saisie.trim()}>
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

// Téléphone : bouton flottant qui ouvre la discussion en plein écran.
export function AssistantFlottant() {
  const [ouvert, setOuvert] = useState(false)

  useEffect(() => {
    if (!ouvert) return
    const echap = (e) => e.key === 'Escape' && setOuvert(false)
    document.addEventListener('keydown', echap)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', echap); document.body.style.overflow = '' }
  }, [ouvert])

  return (
    <div className="lg:hidden">
      {!ouvert && (
        <button
          type="button"
          onClick={() => setOuvert(true)}
          aria-label="Ouvrir l'assistant"
          className="fixed right-4 z-40 grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-violet to-violet-fonce shadow-xl shadow-violet/40 transition active:scale-95"
          style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        >
          <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-violet/30 [animation-duration:2.5s]" />
          <MessageCircle size={26} aria-hidden="true" className="relative" />
        </button>
      )}
      {ouvert && (
        <div role="dialog" aria-modal="true" aria-label="Mon assistant IA" className="fixed inset-x-0 bottom-0 top-[var(--bandeau,0px)] z-50 bg-fond">
          <Discussion pleinEcran onFermer={() => setOuvert(false)} />
        </div>
      )}
    </div>
  )
}
