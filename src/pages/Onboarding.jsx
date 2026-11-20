import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { rapport, metiers, zones } from '../data/rapport.js';
import { useRechercheMetiers } from '../lib/rechercheMetiers.js';
import { apresAvis, apresPrefere, avisLabels, candidats, choisirAvis, entrerMetiers, entrerZone, retour } from '../lib/onboarding.js';
import { useOnboarding, useOnboardingStatus } from '../lib/onboarding-context.jsx';
import EnTete from '../components/EnTete.jsx';
import { revenir } from '../lib/defilement.jsx';
import '../styles.css';

const zonesRemplies = zones.filter((z) => z.metiers.length);
// Les métiers et le préféré se font zone par zone : ils partagent la même étape.
const etapes = ['Bienvenue', 'Tes métiers', 'D’autres idées', 'Récapitulatif'];
const etapeDe = { bienvenue: 0, metiers: 1, favoris: 1, ajouts: 2, recap: 3 };

function Icon({ name, className = '', ...props }) {
  const paths = {
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    book: <><path d="M12 6C8 3 4 4 2 5v15c3-2 7-2 10 0 3-2 7-2 10 0V5c-2-1-6-2-10 1ZM12 6v14" /></>,
    back: <path d="m14 6-6 6 6 6" />,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    star: <path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3-5.7-3-5.7 3 1.1-6.3-4.6-4.5 6.4-.9L12 3Z" />,
  };
  return <svg {...props} className={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.book}</svg>;
}

function Summary({ state }) {
  const nombre = Object.values(state.interets_metiers).filter((avis) => avis === 'interesse').length;
  return <>
    <div className="interest-count"><Icon name="heart" /><span>{nombre} métier{nombre > 1 ? 's' : ''} marqué{nombre > 1 ? 's' : ''} « Ça m’intéresse »</span></div>
    <h2 className="section-label">Tes préférés, par temps de préparation</h2>
    <ul className="summary-list">
      {zones.map((zone) => <li key={zone.id}>
        <span className="duration"><Icon name="clock" />{zone.duree}</span>
        <strong>{zone.metiers.find((m) => m.id === state.favoris[zone.id])?.nom || (zone.metiers.length ? 'Aucun pour l’instant' : 'Ton rapport ne propose pas de métier ici')}</strong>
      </li>)}
    </ul>
    <h2 className="section-label">Avec le psychologue</h2>
    {state.ajouts_psy.length ? <ul className="added-list">{state.ajouts_psy.map((m) => <li key={m.id}><Icon name="check" />{m.nom}</li>)}</ul> : <p className="muted">Tu n’as pas ajouté d’autre métier.</p>}
  </>;
}

export default function Onboarding() {
  const [state, update] = useOnboarding();
  const [storageError] = useOnboardingStatus();
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const titleRef = useRef(null);
  const screen = state.progression.ecran;
  const step = etapeDe[screen] ?? 0;

  // Depuis la page « Modifier mes choix » (/onboarding?ecran=ajouts) : seul l'écran d'ajout sert, puis on y retourne.
  const depuisChoix = state.termine && new URLSearchParams(location.search).get('ecran') === 'ajouts';
  const versChoix = () => revenir(navigate, '/choix');
  const entered = useRef(false);
  useEffect(() => {
    if (entered.current) return;
    entered.current = true;
    const numero = Number(new URLSearchParams(location.search).get('zone'));
    const index = zonesRemplies.findIndex((z) => z.id === numero);
    // Un jeune qui revient modifier ses choix garde « termine » : il peut repartir vers sa page à tout moment.
    if (depuisChoix) {
      update({ ...state, progression: { ...state.progression, ecran: 'ajouts' } });
    } else if (index >= 0 && state.termine) {
      update(entrerZone(state, zonesRemplies, index));
    } else if (state.termine) {
      update(entrerMetiers(state, zonesRemplies, metiers, 0));
    }
  }, [location.search, state, update, depuisChoix]);

  function go(ecran, changes = {}) {
    update({ ...state, progression: { ...state.progression, ...changes, ecran } });
  }
  useEffect(() => {
    setExpanded(false);
    titleRef.current?.focus();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [screen, state.progression.metier, state.progression.zone, location.pathname]);

  function answer(avis) {
    const index = state.progression.metier;
    update(apresAvis(choisirAvis(state, metiers[index], avis), zonesRemplies, metiers, index));
  }
  function back() {
    update(retour(state, zonesRemplies, metiers));
  }
  function addJob(event) {
    event.preventDefault();
    if (!selected || state.ajouts_psy.some((m) => m.id === selected.id)) return;
    update({ ...state, ajouts_psy: [...state.ajouts_psy, selected] });
    setQuery(''); setSelected(null);
  }

  const metier = metiers[state.progression.metier];
  const zoneDuMetier = metier && zones.find((z) => z.id === metier.zone);
  const rangDansZone = metier ? zoneDuMetier.metiers.findIndex((m) => m.id === metier.id) + 1 : 0;
  const zone = zonesRemplies[state.progression.zone];
  const disponibles = zone ? candidats(zone, state.interets_metiers) : [];
  const hasInterested = disponibles.some((m) => state.interets_metiers[m.id] === 'interesse');
  const recherche = useRechercheMetiers(query, state.ajouts_psy);
  const matches = recherche.resultats;

  return <div className="onboarding">
    <a className="skip-link" href="#contenu" onClick={(event) => { event.preventDefault(); document.getElementById('contenu')?.focus(); }}>Aller au contenu</a>
    <EnTete />
    <main id="contenu" tabIndex={-1} className="mx-auto w-full max-w-3xl px-4 sm:px-6">
      <p className="demo-badge">{rapport.rdv}</p>
      <nav aria-label="Les étapes de tes choix" className="steps">
        {etapes.map((label, index) => <div className={`step ${index === step ? 'current' : ''} ${index < step ? 'past' : ''}`} key={label} aria-current={index === step ? 'step' : undefined}>
          <span className="step-dot">{index < step ? <Icon name="check" /> : <span />}</span><span className="step-label">{label}</span>
        </div>)}
      </nav>
      {storageError && <p className="storage-warning" role="alert">Ton navigateur ne permet pas la sauvegarde. Tes choix restent disponibles dans cet onglet, mais ne seront pas gardés si tu le fermes.</p>}
      <section className={`panel ${screen === 'bienvenue' ? 'welcome' : ''}`}>
        {screen !== 'bienvenue' && <button className="back-button" onClick={depuisChoix && screen === 'ajouts' ? versChoix : back}><Icon name="back" />Retour</button>}
        {screen === 'bienvenue' ? <>
          <span className="eyebrow"><Icon name="book" />Ton rapport, tes envies</span>
          <h1 ref={titleRef} tabIndex={-1}>On reprend ton rapport <span className="text-violet-clair">ensemble</span></h1>
          <p className="intro">Ton rapport te propose des métiers. Dis-nous ceux qui te parlent, comme tu l’as fait avec le psychologue.</p>
          <p className="muted welcome-note">Ça prend deux minutes, et tu peux changer d’avis quand tu veux.</p>
          <div className="actions"><button className="primary" onClick={() => update(entrerMetiers(state, zonesRemplies, metiers, 0))}>C’est parti</button><span className="action-note"><Icon name="clock" />À ton rythme, sans bonne ou mauvaise réponse</span></div>
        </> : screen === 'metiers' && metier ? <>
          <div className="zone-banner" key={metier.zone}>
            <span className="zone-number">Zone {metier.zone}</span>
            <span className="duration"><Icon name="clock" />{zoneDuMetier.duree} de préparation</span>
          </div>
          <div className="progress-caption"><span>Métier {rangDansZone} sur {zoneDuMetier.metiers.length}</span><span>Ton avis compte</span></div>
          <progress className="job-progress" aria-label={`Métiers parcourus dans la zone ${metier.zone}`} max={zoneDuMetier.metiers.length} value={rangDansZone} />
          <span className="eyebrow job-eyebrow">Une piste de ton rapport</span>
          <h1 ref={titleRef} tabIndex={-1}>{metier.nom}</h1>
          <div className="description"><p id="description-metier">{expanded ? metier.description : `${metier.description.slice(0, 70).trimEnd()}…`}</p><button className="text-button" aria-expanded={expanded} aria-controls="description-metier" onClick={() => setExpanded(!expanded)}>{expanded ? 'Lire moins' : 'Lire la suite'}</button></div>
          {state.interets_metiers[metier.id] && <p className="previous-answer">Ton avis actuel : {avisLabels[state.interets_metiers[metier.id]]}</p>}
          <p className="muted small-note">Une piste, pas une consigne. Tu peux changer d’avis.</p>
          <div className="actions opinion-actions">
            <button className="primary" onClick={() => answer('interesse')}><Icon name="heart" />Ça m’intéresse</button>
            <button className="secondary" onClick={() => answer('plus_tard')}><Icon name="clock" />Pas pour l’instant</button>
            <button className="quiet" onClick={() => answer('non')}><Icon name="close" />Pas intéressé</button>
          </div>
        </> : screen === 'favoris' && zone ? <>
          <div className="zone-banner">
            <span className="zone-number">Zone {zone.id}</span>
            <span className="duration"><Icon name="clock" />{zone.duree} de préparation</span>
          </div>
          <span className="eyebrow job-eyebrow"><Icon name="star" />Ton préféré de la zone {zone.id}</span>
          <h1 ref={titleRef} tabIndex={-1}>Ton préféré parmi ceux-là ?</h1>
          <p className="intro">{hasInterested ? 'Parmi les métiers qui te parlent, choisis celui que tu as le plus envie d’explorer.' : disponibles.length ? 'Tu avais choisi « Pas pour l’instant ». L’un de ces métiers te parle quand même ?' : 'Tu n’as retenu aucun métier dans cette zone. Tu peux continuer et changer d’avis plus tard.'}</p>
          <div className="favorites" role="group" aria-label="Choisis un seul préféré">
            {disponibles.map((m) => <button key={m.id} className={`favorite ${state.favoris[zone.id] === m.id ? 'selected' : ''}`} aria-pressed={state.favoris[zone.id] === m.id} onClick={() => update({ ...state, favoris: { ...state.favoris, [zone.id]: m.id } })}><span className="choice-circle">{state.favoris[zone.id] === m.id && <Icon name="check" />}</span><span>{m.nom}</span><Icon name="star" /></button>)}
          </div>
          <p className="muted small-note">Ce temps de préparation ne ferme aucune porte.</p>
          <div className="actions">
            <button className="primary" disabled={!state.favoris[zone.id]} onClick={() => update(apresPrefere(state, zonesRemplies, metiers, state.progression.zone))}>Confirmer mon préféré</button>
            {!hasInterested && <button className="quiet" onClick={() => update(apresPrefere({ ...state, favoris: { ...state.favoris, [zone.id]: null } }, zonesRemplies, metiers, state.progression.zone))}>Aucun pour l’instant</button>}
          </div>
        </> : screen === 'ajouts' ? <>
          <span className="eyebrow"><Icon name="search" />D’autres idées · facultatif</span>
          <h1 ref={titleRef} tabIndex={-1}>Le psychologue t’a parlé d’autres métiers ?</h1>
          <p className="intro">Ajoute les pistes que vous avez évoquées ensemble. Tu peux aussi passer cette étape.</p>
          <form onSubmit={addJob}>
            <label className="search-label" htmlFor="job-search">Rechercher un métier</label>
            <div className="search-field"><Icon name="search" /><input id="job-search" type="search" autoComplete="off" value={query} placeholder="Tape au moins deux lettres…" onChange={(e) => { setQuery(e.target.value); setSelected(null); }} aria-describedby="search-help" /></div>
            <p id="search-help" className="muted search-help">{recherche.avecApi ? 'Les métiers de la base du Centre des Possibles.' : 'Liste d’exemple : tous les intitulés sont fictifs.'}</p>
            <div aria-live="polite" className="sr-only">{recherche.statut === 'pret' ? `${matches.length} résultat(s)` : ''}</div>
            {recherche.statut !== 'repos' && <ul className="search-results" aria-label="Métiers proposés" aria-busy={recherche.statut === 'chargement'}>
              {recherche.statut === 'chargement' && <li className="no-result">Recherche…</li>}
              {recherche.statut === 'erreur' && <li className="no-result">La recherche ne répond pas pour l’instant. Réessaie dans un moment.</li>}
              {matches.map((m) => m.dansRapport
                ? <li key={m.id} className="no-result">{m.nom} : déjà dans ton rapport</li>
                : <li key={m.id}><button type="button" aria-pressed={selected?.id === m.id} className={selected?.id === m.id ? 'chosen' : ''} onClick={() => { setSelected({ id: m.id, nom: m.nom }); setQuery(m.nom); }}><span>{m.nom}</span>{selected?.id === m.id && <Icon name="check" />}</button></li>)}
              {recherche.statut === 'pret' && !matches.length && <li className="no-result">{recherche.avecApi ? 'Aucun métier trouvé. Essaie un autre mot.' : 'Aucun métier dans cette liste d’exemple.'}</li>}
            </ul>}
            <button className="secondary add-button" type="submit" disabled={!selected}>Ajouter</button>
          </form>
          {state.ajouts_psy.length > 0 && <><h2 className="section-label">Tes pistes ajoutées</h2><ul className="added-list">{state.ajouts_psy.map((m) => <li key={m.id}><span>{m.nom}</span><button className="remove-button" aria-label={`Retirer ${m.nom}`} onClick={() => update({ ...state, ajouts_psy: state.ajouts_psy.filter((a) => a.id !== m.id) })}><Icon name="close" /></button></li>)}</ul></>}
          <div className="actions">{depuisChoix
            ? <button className="primary" onClick={versChoix}>Retour à mes choix</button>
            : <button className="primary" onClick={() => go('recap')}>{state.ajouts_psy.length ? 'Continuer' : 'Passer cette étape'}</button>}</div>
        </> : <>
          <span className="eyebrow"><Icon name="check" />Tes envies, en un coup d’œil</span>
          <h1 ref={titleRef} tabIndex={-1}>Voilà ce qu’on retient</h1>
          <p className="intro">Ces choix t’appartiennent. Tu pourras les modifier quand tu veux.</p>
          <Summary state={state} />
          <div className="actions"><button className="primary" onClick={() => { update({ ...state, termine: true }); navigate('/'); }}>Voir ma page</button></div>
        </>}
      </section>
      <footer className="page-footer"><Icon name="heart" /><p>Tu restes libre de choisir.<br className="sm:hidden" /> Le rapport ouvre des pistes.</p></footer>
    </main>
  </div>;
}
