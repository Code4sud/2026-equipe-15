import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Sparkles, X, Send, MessageCircle, Maximize2, Minimize2, FileText, FlaskConical, ArrowRight, ArrowUpRight, RotateCcw } from 'lucide-react'
import { rapport, infosMetiers, acces } from '../lib/donnees.js'
import { useOnboarding } from '../lib/stockage.js'
import { demander, SUGGESTIONS_DEPART, QUESTION_MAX } from '../lib/chat.js'
import { assistant, useAssistant } from '../lib/assistantEtat.js'

// La discussion est liée au rapport affiché : celle d'un autre rapport n'est pas reprise.
assistant.brancher(acces?.jeton ?? 'exemple')

const ACCUEIL = 'Pose-moi tes questions sur ton rapport, les métiers ou les formations !'

function Puce() {
  return <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-repere" />
}

// Les sources d'une réponse : une page du rapport s'ouvre dans la visionneuse.
function Sources({ sources }) {
  if (!sources?.length) return null
  return (
    <div className="mt-3 border-t border-ligne pt-2.5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-doux">D'où ça vient</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {sources.map((s) => (
          <li key={`${s.type}-${s.page ?? s.label}`}>
            {s.type === 'rapport' ? (
              <Link to={`/rapport/${s.page}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-carte px-3 text-xs font-semibold text-violet-clair ring-1 ring-ligne transition hover:ring-violet-clair">
                <FileText size={13} aria-hidden="true" /> {s.label}
              </Link>
            ) : s.type === 'web' ? (
              <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-carte px-3 py-1 text-xs font-semibold text-violet-clair ring-1 ring-ligne transition hover:ring-violet-clair">
                <ArrowUpRight size={13} aria-hidden="true" className="shrink-0" /> {s.label}<span className="sr-only"> (nouvel onglet)</span>
              </a>
            ) : (
              <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-ligne px-3 text-xs font-semibold text-doux">
                <FlaskConical size={13} aria-hidden="true" /> {s.label}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function BulleIA({ m }) {
  return (
    <div className="flex items-end gap-2">
      <span aria-hidden="true" className="mb-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-violet text-white">
        <Sparkles size={14} />
      </span>
      <div className="apparait min-w-0 max-w-[88%] rounded-2xl rounded-bl-md bg-carte-2 px-4 py-3">
        {m.mode === 'repli' && (
          <p className="mb-2 rounded-lg bg-carte px-2.5 py-1.5 text-xs text-doux">L'IA ne répond pas pour l'instant : je te réponds directement avec ton rapport.</p>
        )}
        <div className="space-y-2">
          {m.paragraphes.map((p) => <p key={p}>{p}</p>)}
          {m.puces?.length > 0 && (
            <ul className="space-y-1.5">
              {m.puces.map((p) => <li key={p} className="flex gap-2.5"><Puce />{p}</li>)}
            </ul>
          )}
          {m.suiteParagraphes?.map((p) =>
            p.startsWith('• ') ? <p key={p} className="flex gap-2.5"><Puce />{p.slice(2)}</p> : <p key={p}>{p}</p>,
          )}
        </div>
        {m.liens?.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            {m.liens.map((l) =>
              l.href ? (
                <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-between gap-2 rounded-xl bg-carte px-3 text-sm font-semibold hover:text-violet-clair">
                  {l.label} <ArrowUpRight size={15} aria-hidden="true" /><span className="sr-only"> (nouvel onglet)</span>
                </a>
              ) : (
                <Link key={l.label} to={l.to} className="group inline-flex min-h-11 items-center justify-between gap-2 rounded-xl bg-carte px-3 text-sm font-semibold hover:text-violet-clair">
                  {l.label} <ArrowRight size={15} aria-hidden="true" className="transition group-hover:translate-x-0.5" />
                </Link>
              ),
            )}
          </div>
        )}
        <Sources sources={m.sources} />
      </div>
    </div>
  )
}

function EnTrainDEcrire() {
  return (
    <div className="flex items-end gap-2" role="status">
      <span aria-hidden="true" className="mb-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-violet text-white"><Sparkles size={14} /></span>
      <span className="flex gap-1 rounded-2xl rounded-bl-md bg-carte-2 px-4 py-3.5">
        <span className="points-attente text-doux" aria-hidden="true"><span /><span /><span /></span>
        <span className="sr-only">L'assistant écrit…</span>
      </span>
    </div>
  )
}

function Suggestions({ items, onChoisir, desactive }) {
  if (!items?.length) return null
  return (
    <div className="flex flex-wrap gap-2 pl-9">
      {items.map((s) => (
        <button key={s} type="button" disabled={desactive} onClick={() => onChoisir(s)} className="min-h-11 rounded-full border border-violet-clair/50 px-3.5 text-sm font-medium text-violet-clair transition hover:bg-violet/15 disabled:opacity-40">
          {s}
        </button>
      ))}
    </div>
  )
}

// La discussion vit dans le magasin partagé (lib/assistantEtat.js) : elle suit le jeune de page en page.
function Discussion({ id = 'msg-carte', hauteur = 'h-[520px]', visible = true, pleinEcran, onFermer, onBasculer }) {
  const [onboarding] = useOnboarding()
  const { messages, saisie, attente, focus } = useAssistant()
  const liste = useRef(null)
  const champ = useRef(null)
  const focusVu = useRef(focus)
  const enLigne = Boolean(acces)

  // Une nouvelle réponse s'affiche depuis son début ; sinon on suit le bas de la discussion.
  // Pareil à la réouverture et au retour d'une autre page : on retrouve le dernier message.
  useEffect(() => {
    const el = liste.current
    if (!el || !visible) return
    const derniere = el.querySelector('[data-derniere-ia]')
    if (derniere && !attente && messages.at(-1)?.de === 'ia') el.scrollTop = derniere.offsetTop - el.offsetTop - 8
    else el.scrollTop = el.scrollHeight
  }, [messages, attente, pleinEcran, visible])

  // « Pose une question à ton assistant » (premiers pas) : le curseur va dans la zone de saisie affichée.
  useEffect(() => {
    if (focus === focusVu.current) return
    focusVu.current = focus
    if (champ.current?.offsetParent) champ.current.focus()
  }, [focus])

  // La demande part du magasin : la réponse arrive même si le jeune a changé de page entre-temps.
  const envoyer = (texte) =>
    assistant.poser(texte, (question, historique) => demander(question, { historique, rapport, onboarding, infosMetiers, acces }))

  const derniere = messages.at(-1)

  return (
    <div className={`flex flex-col ${hauteur}`}>
      <div className="flex items-center justify-between gap-3 border-b border-ligne px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="relative grid h-10 w-10 place-items-center rounded-full bg-violet text-white">
            <Sparkles size={18} aria-hidden="true" />
            <span aria-hidden="true" className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-carte ${enLigne ? 'bg-emerald-400' : 'bg-repere'}`} />
          </span>
          <div>
            <p className="font-semibold leading-tight">Mon assistant IA</p>
            <p className="text-xs text-doux">{enLigne ? 'IA en local · elle s’appuie sur ton rapport' : 'Mode démo · il répond avec ton rapport'}</p>
          </div>
        </div>
        <div className="flex items-center">
          {messages.length > 0 && (
            <button type="button" onClick={assistant.vider} aria-label="Nouvelle discussion" className="grid h-11 w-11 place-items-center rounded-full hover:bg-texte/10">
              <RotateCcw size={18} aria-hidden="true" />
            </button>
          )}
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

      <div ref={liste} className="relative flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 ? (
          <div className="apparait flex flex-col items-center px-2 pt-2 text-center">
            <span aria-hidden="true" className="grid h-14 w-14 place-items-center rounded-2xl bg-violet/15 text-violet-clair"><Sparkles size={26} /></span>
            <p className="mt-3 font-semibold">{ACCUEIL}</p>
            <p className="mt-1 text-sm text-doux">Chaque réponse montre la page de ton rapport d'où elle vient.</p>
            <div className="mt-4 flex w-full flex-col gap-2">
              {SUGGESTIONS_DEPART.map((s) => (
                <button key={s} type="button" onClick={() => envoyer(s)} className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-ligne bg-carte-2 px-4 text-left text-sm font-semibold transition hover:border-violet-clair">
                  {s} <ArrowRight size={15} aria-hidden="true" className="shrink-0 text-violet-clair" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) =>
            m.de === 'moi' ? (
              <p key={i} className="apparait ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-violet px-4 py-2.5 text-white">{m.texte}</p>
            ) : (
              <div key={i} data-derniere-ia={i === messages.length - 1 ? '' : undefined}><BulleIA m={m} /></div>
            ),
          )
        )}
        {attente && <EnTrainDEcrire />}
        {!attente && derniere?.de === 'ia' && <Suggestions items={derniere.suggestions} onChoisir={envoyer} desactive={attente} />}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); envoyer(saisie) }}
        className="border-t border-ligne p-3"
        style={pleinEcran ? { paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' } : undefined}
      >
        <div className="flex gap-2">
          <label htmlFor={id} className="sr-only">Écrire un message</label>
          <input
            id={id}
            ref={champ}
            value={saisie}
            onChange={(e) => assistant.ecrire(e.target.value)}
            placeholder="Écrire un message…"
            autoComplete="off"
            maxLength={QUESTION_MAX}
            className="min-h-12 min-w-0 flex-1 rounded-full border border-ligne bg-carte-2 px-4 text-base placeholder:text-doux focus:border-violet-clair focus:outline-none"
          />
          <button type="submit" aria-label="Envoyer" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-violet text-white transition hover:bg-violet-fonce active:scale-95 disabled:opacity-40" disabled={!saisie.trim() || attente}>
            <Send size={19} aria-hidden="true" />
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-doux">L'assistant peut se tromper. Il ne remplace pas le psychologue.</p>
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
// Ouvert sur une page, il le reste quand on y revient (après la visionneuse PDF ou une fiche métier).
export function AssistantFlottant() {
  const { pathname } = useLocation()
  const { ouvertSur, pleinEcran } = useAssistant()
  const ouvert = ouvertSur === pathname
  const modal = ouvert && pleinEcran

  useEffect(() => {
    if (!ouvert) return
    const echap = (e) => e.key === 'Escape' && assistant.fermer()
    document.addEventListener('keydown', echap)
    return () => document.removeEventListener('keydown', echap)
  }, [ouvert])

  // La page reste défilable derrière la petite fenêtre, pas derrière le plein écran.
  useEffect(() => {
    // Sur ordinateur, la fenêtre flottante n'est pas affichée (lg:hidden) : rien à bloquer.
    if (!modal || window.matchMedia('(min-width: 1024px)').matches) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [modal])

  const cadre = pleinEcran
    ? 'inset-x-0 bottom-0 top-[var(--bandeau,0px)] bg-fond'
    : 'right-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] h-[min(34rem,calc(100dvh-var(--bandeau,0px)-5.5rem))] w-[min(23rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-ligne bg-carte shadow-2xl shadow-black/30'

  return (
    <div className="lg:hidden">
      {!ouvert && (
        <button
          type="button"
          onClick={() => assistant.ouvrir(pathname)}
          aria-label="Ouvrir l'assistant"
          className="fixed right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-violet text-white shadow-lg shadow-black/30 transition hover:bg-violet-fonce active:scale-95"
          style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        >
          <MessageCircle size={24} aria-hidden="true" />
        </button>
      )}
      <div role="dialog" aria-modal={modal} aria-label="Mon assistant IA" className={ouvert ? `fixed z-50 ${cadre} ${pleinEcran ? '' : 'fenetre-assistant'}` : 'hidden'}>
        <Discussion
          id="msg-flottant"
          hauteur="h-full"
          visible={ouvert}
          pleinEcran={pleinEcran}
          onBasculer={assistant.basculerPleinEcran}
          onFermer={assistant.fermer}
        />
      </div>
    </div>
  )
}
