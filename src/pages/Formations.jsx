import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { GraduationCap, MapPin, Clock, CalendarDays, Building2, ExternalLink, Star, Heart } from 'lucide-react'
import PageRecommandation from '../components/PageRecommandation.jsx'
import { rapport, infosMetiers, metiers, source } from '../lib/donnees.js'
import { listerFormations } from '../lib/recommandations.js'
import { useOnboarding } from '../lib/stockage.js'

const SITE_REGION = 'https://www.orientation-regionsud.fr/'
const VISIBLES = 3
const dateFr = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.split('-').reverse().join('/') : '')
const lienSur = (url) => typeof url === 'string' && url.startsWith('https://')
const NouvelOnglet = () => <span className="sr-only"> (nouvel onglet)</span>

export default function Formations() {
  return source === 'api' ? <FormationsRegion /> : <FormationsExemple />
}

// Avec un vrai rapport : les formations lues sur orientation-regionsud.fr (metier.region.formations),
// regroupées par métier, les métiers choisis par le jeune d'abord. Rien n'est inventé ni classé.
// metier.region : objet (fiche lue), null (pas de fiche sur le site), absent (l'API n'a pas lu le site :
// pas de dossier regionsud/). Dans ce dernier cas, la page ne dit rien du site de la Région.
function FormationsRegion() {
  const [onboarding] = useOnboarding()
  const [params, setParams] = useSearchParams()
  const preferes = Object.values(onboarding?.favoris || {}).filter(Boolean)
  const rang = (m) => (preferes.includes(m.id) ? 0 : onboarding?.interets_metiers?.[m.id] === 'interesse' ? 1 : 2)
  const ordonnes = [...metiers].sort((a, b) => rang(a) - rang(b) || a.zone - b.zone)
  const choisis = ordonnes.filter((m) => rang(m) < 2)
  const demande = params.get('metier') || ''
  const choix = demande === 'tous' || ordonnes.some((m) => m.id === demande) ? demande : choisis.length ? 'choisis' : 'tous'
  const affiches = choix === 'tous' ? ordonnes : choix === 'choisis' ? choisis : ordonnes.filter((m) => m.id === choix)
  const dates = ordonnes.map((m) => m.region?.lu_le).filter(Boolean).sort()
  const luLe = dateFr(dates[dates.length - 1])
  const regionLue = metiers.some((m) => m.region !== undefined)

  return <PageRecommandation titre="Voir les formations" description={regionLue ? 'Des formations en région Sud pour les métiers de ton rapport. Elles viennent du site d’orientation de la Région.' : 'Ton rapport ne liste pas de formations. Voici où en chercher pour chacun de tes métiers.'} Icone={GraduationCap}>
    <section aria-label="Choisir un métier" className="carte p-5">
      <label className="flex flex-col gap-2 text-base font-semibold">Pour quel métier ?
        <select value={choix} onChange={(e) => setParams(e.target.value === 'choisis' ? {} : { metier: e.target.value }, { replace: true })} className="min-h-12 w-full min-w-0 rounded-xl border border-ligne bg-carte-2 px-3 text-base text-texte">
          {choisis.length > 0 && <option value="choisis">Mes préférés et ceux qui m’intéressent</option>}
          <option value="tous">Tous les métiers de mon rapport</option>
          {ordonnes.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
        </select>
      </label>
      {regionLue && <p className="mt-3 text-sm text-doux">L’ordre des formations est celui du site de la Région. Ce n’est pas un classement.</p>}
    </section>
    {affiches.map((m) => <GroupeMetier key={m.id} metier={m} etiquette={['prefere', 'interesse'][rang(m)]} />)}
    <footer className="border-t border-ligne pt-5 text-base text-doux">
      <h2 className="font-semibold text-texte">D’où viennent ces informations ?</h2>
      {regionLue ? <>
        <p className="mt-2">Ces formations ne sont pas dans ton rapport. Elles viennent du site d’orientation de la Région{luLe && `, lu le ${luLe}`}. Les dates et les places changent : vérifie sur le site ou avec l’établissement.</p>
        <a href={SITE_REGION} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 font-semibold text-violet-clair hover:underline"><ExternalLink size={16} className="shrink-0" aria-hidden="true" /><span>Source : orientation-regionsud.fr<NouvelOnglet /></span></a>
      </> : <p className="mt-2">Les métiers viennent de ton rapport. Ton rapport ne contient pas de formations : les liens ouvrent une recherche sur chaque site. Vérifie les dates et les conditions avec l’établissement.</p>}
    </footer>
  </PageRecommandation>
}

function GroupeMetier({ metier, etiquette }) {
  const [tout, setTout] = useState(false)
  const region = metier.region
  const formations = Array.isArray(region?.formations) ? region.formations : []
  const visibles = tout ? formations : formations.slice(0, VISIBLES)
  const reste = formations.length - VISIBLES
  const idTitre = `formations-${metier.id}`
  return <section aria-labelledby={idTitre} className="space-y-3">
    <header>
      {etiquette === 'prefere' && <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-repere"><Star size={16} aria-hidden="true" />Ton préféré</p>}
      {etiquette === 'interesse' && <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-repere"><Heart size={16} aria-hidden="true" />Ça t’intéresse</p>}
      <h2 id={idTitre} className="text-xl font-bold [overflow-wrap:anywhere]">{metier.nom}</h2>
      <Link to={`/metier/${metier.id}`} className="inline-flex min-h-11 items-center text-base font-semibold text-violet-clair hover:underline">Voir la fiche du métier</Link>
      {formations.length > 0 && <p className="text-sm text-doux">
        {region.titre && region.titre !== metier.nom && <>Fiche la plus proche sur le site de la Région : « {region.titre} ». </>}
        {formations.length > 1 ? `Les ${formations.length} premières formations listées par le site` : 'La formation listée par le site'}{dateFr(region.lu_le) && `, ${formations.length > 1 ? 'lues' : 'lue'} le ${dateFr(region.lu_le)}`}.
      </p>}
    </header>
    {!formations.length && <div className="carte p-5">
      {region === undefined
        ? <><h3 className="text-lg font-bold">Formations : où regarder</h3><p className="mt-1 text-base text-doux">Tu peux chercher sur ces sites, ou en parler avec le psychologue.</p></>
        : region === null
          ? <p className="text-base text-doux">Pas d’info disponible sur le site d’orientation de la Région pour ce métier. Ça ne veut pas dire qu’il n’existe pas de formation. Tu peux chercher ailleurs ou en parler avec le psychologue.</p>
          : <p className="text-base text-doux">Aucune formation relevée sur le site de la Région pour ce métier. Ça ne veut pas dire qu’il n’en existe pas. Tu peux chercher sur ces sites ou en parler avec le psychologue.</p>}
      <ul className="mt-2">
        {(metier.liens || []).filter((l) => lienSur(l.url) && (region !== null || l.site !== 'orientation-regionsud')).map((l) => <li key={l.url}><a href={l.url} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-2 text-base font-semibold text-violet-clair hover:underline"><ExternalLink size={16} className="shrink-0" aria-hidden="true" /><span>{l.titre}<NouvelOnglet /></span></a></li>)}
      </ul>
    </div>}
    {visibles.map((f, i) => <article key={f.url || i} className="carte apparait p-5">
      <h3 className="text-lg font-bold [overflow-wrap:anywhere]">{f.titre}</h3>
      <dl className="mt-3 space-y-2 text-base">
        {f.organisme && <div className="flex items-start gap-2"><dt className="shrink-0 text-doux"><Building2 size={17} className="mt-1" aria-hidden="true" /><span className="sr-only">Organisme</span></dt><dd className="min-w-0 [overflow-wrap:anywhere]">{f.organisme}</dd></div>}
        {f.ville && <div className="flex items-start gap-2"><dt className="shrink-0 text-doux"><MapPin size={17} className="mt-1" aria-hidden="true" /><span className="sr-only">Lieu</span></dt><dd className="min-w-0">{f.ville}{f.departement && ` (${f.departement})`}</dd></div>}
        {f.dates && <div className="flex items-start gap-2"><dt className="shrink-0 text-doux"><CalendarDays size={17} className="mt-1" aria-hidden="true" /><span className="sr-only">Dates de session</span></dt><dd className="min-w-0">Session : {f.dates}</dd></div>}
      </dl>
      {(f.type || f.alternance || f.financeur) && <ul className="mt-3 flex flex-wrap gap-2 text-sm">
        {f.type && <li className="rounded-full border border-ligne px-3 py-1 text-doux">{f.type}</li>}
        {f.alternance && <li className="rounded-full border border-ligne bg-carte-2 px-3 py-1 font-semibold">Alternance</li>}
        {f.financeur && <li className="rounded-full border border-ligne px-3 py-1 text-doux">Financeur indiqué : {f.financeur}</li>}
      </ul>}
      {lienSur(f.url) && <a href={f.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 text-base font-semibold text-violet-clair hover:underline"><ExternalLink size={16} className="shrink-0" aria-hidden="true" /><span>Voir la fiche sur le site de la Région<NouvelOnglet /></span></a>}
    </article>)}
    {reste > 0 && <button type="button" aria-expanded={tout} onClick={() => setTout(!tout)} className="min-h-11 w-full rounded-xl border border-ligne px-4 py-2 text-base font-semibold text-doux hover:border-violet-clair">{tout ? 'Afficher moins de formations' : `Afficher ${reste} autre${reste > 1 ? 's' : ''} formation${reste > 1 ? 's' : ''}`}</button>}
    {lienSur(region?.formations_url) && <a href={region.formations_url} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-violet px-5 py-3 text-center text-base font-semibold text-white"><span>Voir toutes les formations sur le site de la Région<NouvelOnglet /></span><ExternalLink size={18} className="shrink-0" aria-hidden="true" /></a>}
  </section>
}

// Sans API (démo publique) : exemples inventés, étiquetés comme tels.
function FormationsExemple() {
  const [metierId, setMetierId] = useState('')
  const [alternance, setAlternance] = useState(false)
  const formations = listerFormations(rapport.metiers, infosMetiers, { metierId, alternance })
  return <PageRecommandation titre="Voir les formations" description="Explore les exemples de parcours et prépare tes questions sur le lieu, le coût ou l’accès." Icone={GraduationCap}>
    <aside className="carte border-dashed p-5">
      <h2 className="text-lg font-bold">Des exemples inventés pour la démo</h2>
      <p className="mt-2 text-base leading-relaxed text-doux">Les formations, villes, durées et conditions ci-dessous sont fictives. Ce ne sont pas des offres où t’inscrire. Ton rapport ne contient pas de formations vérifiées.</p>
    </aside>
    <section aria-label="Filtrer les exemples" className="carte space-y-4 p-5">
      <label className="flex flex-col gap-2 text-base font-semibold">Pour quel métier ?
        <select value={metierId} onChange={(e) => setMetierId(e.target.value)} className="min-h-12 w-full min-w-0 rounded-xl border border-ligne bg-carte-2 px-3 text-base text-texte">
          <option value="">Tous les métiers du rapport</option>{rapport.metiers.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
        </select>
      </label>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base"><input type="checkbox" checked={alternance} onChange={(e) => setAlternance(e.target.checked)} className="h-5 w-5 accent-violet" />Exemples en alternance seulement</label>
    </section>
    <p role="status" className="text-base text-doux">{formations.length} exemple{formations.length > 1 ? 's' : ''} affiché{formations.length > 1 ? 's' : ''}</p>
    {!formations.length && <p className="carte p-5 text-base text-doux">Aucun exemple pour ce choix. Cela ne veut pas dire qu’il n’existe pas de formation pour ce métier. Tu peux chercher avec le psychologue.</p>}
    {formations.map((formation) => <article key={formation.id} className="carte p-5 sm:p-6">
      <p className="text-sm font-semibold text-repere">Exemple inventé</p>
      <h2 className="mt-2 text-xl font-bold">{formation.nom}</h2>
      <Link to={`/metier/${formation.metier.id}`} className="inline-flex min-h-11 items-center text-base font-semibold text-violet-clair hover:underline">Pour {formation.metier.nom}</Link>
      <dl className="mt-3 space-y-3 text-base">
        <div><dt className="flex items-center gap-2 text-doux"><MapPin size={17} aria-hidden="true" />Lieu fictif</dt><dd className="mt-1">{formation.ville}</dd></div>
        <div><dt className="flex items-center gap-2 text-doux"><Clock size={17} aria-hidden="true" />Durée fictive</dt><dd className="mt-1">{formation.duree}</dd></div>
        <div><dt className="text-doux">Coût fictif</dt><dd className="mt-1">{formation.cout}</dd></div>
        <div><dt className="text-doux">Accès fictif</dt><dd className="mt-1">{formation.acces}</dd></div>
        <div><dt className="text-doux">Alternance dans cet exemple</dt><dd className="mt-1">{formation.alternance ? 'Oui' : 'Non'}</dd></div>
      </dl>
    </article>)}
    <section aria-labelledby="titre-chercher" className="carte p-5 sm:p-6">
      <h2 id="titre-chercher" className="text-xl font-bold">Chercher une vraie formation</h2>
      <p className="mt-2 text-base text-doux">Vérifie les dates, le coût, les déplacements et les conditions d’inscription avec l’établissement.</p>
      <a href="https://www.orientation-regionsud.fr/" target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-12 items-center justify-center rounded-xl bg-violet px-5 py-3 text-base font-semibold text-white">Consulter Orientation Région Sud<span className="sr-only"> (nouvel onglet)</span></a>
      <a href="https://www.onisep.fr/" target="_blank" rel="noreferrer" className="mt-3 flex min-h-11 items-center text-base font-semibold text-violet-clair hover:underline">Consulter l’ONISEP<span className="sr-only"> (nouvel onglet)</span></a>
    </section>
    <footer className="border-t border-ligne pt-5 text-base text-doux">
      <h2 className="font-semibold text-texte">D’où viennent ces informations ?</h2>
      <p className="mt-2">Les exemples sont les mêmes données inventées que sur les fiches métiers de la démo. Les sites cités sont des liens pour ta recherche ; ils ne sont pas la source de ces exemples.</p>
    </footer>
  </PageRecommandation>
}
