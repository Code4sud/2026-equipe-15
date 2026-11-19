// Le lien portait un jeton, mais le rapport n'a pas pu être lu. On le dit clairement :
// montrer l'exemple inventé à la place ferait croire au jeune que c'est son rapport.
const MESSAGES = {
  introuvable: {
    titre: "Ce lien ne mène à aucun rapport",
    texte: "Vérifie que tu as bien recopié le lien reçu, ou demande-le de nouveau au Centre des Possibles.",
  },
  injoignable: {
    titre: "Ton rapport n'est pas disponible pour l'instant",
    texte: "Le service qui lit ton rapport ne répond pas. Réessaie dans un moment.",
  },
}

export default function LienIndisponible({ raison }) {
  const { titre, texte } = MESSAGES[raison] ?? MESSAGES.injoignable
  const voirExemple = () => {
    window.location.hash = '#/?r=exemple'
    window.location.reload()
  }
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-10">
      <div className="carte p-6 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{titre}</h1>
        <p className="mt-3 text-base leading-relaxed text-doux">{texte}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={() => window.location.reload()} className="inline-flex min-h-12 items-center rounded-full bg-violet px-6 font-semibold text-white">
            Réessayer
          </button>
          <button type="button" onClick={voirExemple} className="inline-flex min-h-12 items-center rounded-full border border-ligne px-6 font-semibold">
            Voir un exemple inventé
          </button>
        </div>
      </div>
    </main>
  )
}
