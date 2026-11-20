import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Document, Page, pdfjs } from 'react-pdf'
import { ArrowLeft } from 'lucide-react'
import { pdfUrl } from '../lib/donnees.js'
import { revenir } from '../lib/defilement.jsx'

// Avec Vite, le worker de PDF.js doit être déclaré explicitement.
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

const RATIO_A4 = 842 / 595

function useLargeur() {
  const [l, setL] = useState(() => Math.min(window.innerWidth, 900))
  useEffect(() => {
    const maj = () => setL(Math.min(window.innerWidth, 900))
    window.addEventListener('resize', maj)
    return () => window.removeEventListener('resize', maj)
  }, [])
  return l
}

// Ne dessine une page que lorsqu'elle approche de l'écran.
function PageParesseuse({ numero, largeur, onVisible }) {
  const ref = useRef(null)
  const [proche, setProche] = useState(false)

  useEffect(() => {
    const el = ref.current
    const obsProche = new IntersectionObserver(([e]) => setProche(e.isIntersecting), { rootMargin: '150% 0px' })
    const obsVisible = new IntersectionObserver(([e]) => e.isIntersecting && onVisible(numero), { rootMargin: '-45% 0px -45% 0px' })
    obsProche.observe(el)
    obsVisible.observe(el)
    return () => { obsProche.disconnect(); obsVisible.disconnect() }
  }, [numero, onVisible])

  return (
    <div ref={ref} id={`page-${numero}`} className="mx-auto mb-3 scroll-mt-[calc(var(--bandeau,0px)+4rem)] overflow-hidden bg-white shadow-lg" style={{ width: largeur, minHeight: largeur * RATIO_A4 }}>
      {proche && <Page pageNumber={numero} width={largeur} renderTextLayer={false} renderAnnotationLayer={false} />}
    </div>
  )
}

export default function Rapport() {
  const { page } = useParams()
  const navigate = useNavigate()
  // « Retour » ramène à l'endroit d'où l'on venait (résumé, assistant, fiche métier…), pas en haut de l'accueil.
  const retour = (e) => { e.preventDefault(); revenir(navigate) }
  const demandee = Math.max(1, parseInt(page, 10) || 1)
  const largeur = useLargeur()
  const [nbPages, setNbPages] = useState(0)
  const [courante, setCourante] = useState(demandee)
  const [erreur, setErreur] = useState(false)

  useEffect(() => {
    if (!nbPages) return
    const cible = Math.min(demandee, nbPages)
    setCourante(cible)
    requestAnimationFrame(() => document.getElementById(`page-${cible}`)?.scrollIntoView())
  }, [nbPages, demandee])

  const message = (texte) => <p className="px-4 py-16 text-center text-doux">{texte}</p>

  return (
    <div className="min-h-dvh bg-carte-2">
      <header className="sticky top-[var(--bandeau,0px)] z-10 flex h-14 items-center justify-between border-b border-ligne bg-entete px-2">
        <Link to="/" onClick={retour} className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 font-semibold">
          <ArrowLeft size={18} aria-hidden="true" /> Retour
        </Link>
        {nbPages > 0 && <span className="pr-3 text-sm font-semibold text-doux" aria-live="polite">Page {courante} sur {nbPages}</span>}
      </header>
      {erreur ? (
        <div className="text-center">
          {message("Ton rapport n'est pas disponible pour l'instant.")}
          <Link to="/" onClick={retour} className="inline-flex min-h-12 items-center rounded-full bg-violet px-6 font-semibold text-white">Retour à ma page</Link>
        </div>
      ) : (
        <Document
          suspense={false}
          file={pdfUrl}
          loading={message('Ton rapport arrive…')}
          error={message("Ton rapport n'est pas disponible pour l'instant.")}
          onLoadSuccess={({ numPages }) => setNbPages(numPages)}
          onLoadError={() => setErreur(true)}
          className="py-3"
        >
          {Array.from({ length: nbPages }, (_, i) => (
            <PageParesseuse key={i + 1} numero={i + 1} largeur={largeur} onVisible={setCourante} />
          ))}
        </Document>
      )}
    </div>
  )
}
