import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { rapport, metiers, zones, autresMetiers } from './data/rapport';
import { avisLabels, candidats, choisirAvis, entrerZone, enregistrerChoix, initialState, lireChoix } from './lib/onboarding';
import './styles.css';

const zonesRemplies = zones.filter((z) => z.metiers.length);
const etapes = ['Bienvenue', 'Tes envies', 'Tes préférés', 'D’autres idées', 'Récapitulatif'];
const ecrans = ['bienvenue', 'metiers', 'favoris', 'ajouts', 'recap'];

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
    spark: <><path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z" /></>,
  };
  return <svg {...props} className={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.book}</svg>;
}

function Illustration() {
  return <div className="report-art" aria-hidden="true">
    <div className="orbit orbit-one" /><div className="orbit orbit-two" />
    <div className="paper paper-back" />
    <div className="paper paper-front">
      <div className="paper-heading"><span /><Icon name="spark" /></div>
      <i /><i /><i />
      <div className="paper-chart"><span /><span /><span /><span /></div>
    </div>
    <div className="art-heart"><Icon name="heart" /></div>
    <div className="art-star"><Icon name="star" /></div>
  </div>;
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

function App() {
  const [initial] = useState(() => {
    try { return { state: lireChoix(window.localStorage, rapport.id, metiers, autresMetiers), error: false }; }
    catch { return { state: initialState(), error: true }; }
  });
  const [state, setState] = useState(initial.state);
  const [storageError, setStorageError] = useState(initial.error);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const titleRef = useRef(null);
  const accueil = location.pathname === '/' && state.termine;
  const screen = state.progression.ecran;
  const step = accueil ? 4 : ecrans.indexOf(screen);

  // L'écriture est immédiate, avant de passer à l'écran suivant.
  function update(next) {
    try {
      enregistrerChoix(window.localStorage, rapport.id, next);
      setStorageError(false);
    } catch { setStorageError(true); }
    setState(next);
  }
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
    const next = choisirAvis(state, metiers[index], avis);
    if (index + 1 < metiers.length) {
      update({ ...next, progression: { ...next.progression, metier: index + 1 } });
    } else update(entrerZone(next, zonesRemplies, 0));
  }
  function back() {
    if (screen === 'metiers') {
      state.progression.metier ? go('metiers', { metier: state.progression.metier - 1 }) : go('bienvenue');
    } else if (screen === 'favoris') {
      state.progression.zone ? update(entrerZone(state, zonesRemplies, state.progression.zone - 1)) : go(metiers.length ? 'metiers' : 'bienvenue', { metier: Math.max(0, metiers.length - 1) });
    } else if (screen === 'ajouts') {
      zonesRemplies.length ? update(entrerZone(state, zonesRemplies, zonesRemplies.length - 1)) : go('bienvenue');
    } else if (screen === 'recap') go('ajouts');
  }
  function addJob(event) {
    event.preventDefault();
    if (!selected || state.ajouts_psy.some((m) => m.id === selected.id)) return;
    update({ ...state, ajouts_psy: [...state.ajouts_psy, selected] });
    setQuery(''); setSelected(null);
  }
  function reopen() {
    update({ ...state, termine: false, progression: { ecran: 'metiers', metier: 0, zone: 0 } });
    navigate('/onboarding');
  }

  const metier = metiers[state.progression.metier];
  const zone = zonesRemplies[state.progression.zone];
  const disponibles = zone ? candidats(zone, state.interets_metiers) : [];
  const hasInterested = disponibles.some((m) => state.interets_metiers[m.id] === 'interesse');
  const normalize = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
  const matches = query.trim().length >= 2 ? autresMetiers.filter((m) => normalize(m.nom).includes(normalize(query.trim())) && !state.ajouts_psy.some((a) => a.id === m.id)) : [];

  return <>
    <a className="skip-link" href="#contenu" onClick={(event) => { event.preventDefault(); document.getElementById('contenu')?.focus(); }}>Aller au contenu</a>
    <header className="site-header">
      <div className="brand"><span className="brand-mark" aria-hidden="true">P</span><span><strong>Possibles<span className="brand-dot">.AI</span></strong><span className="brand-caption">Orientation augmentée</span></span></div>
      <span className="demo-badge">{rapport.rdv}</span>
    </header>
    <main id="contenu" tabIndex={-1} className="mx-auto w-full max-w-3xl px-4 sm:px-6">
      <nav aria-label="Les étapes de tes choix" className="steps">
        {etapes.map((label, index) => <div className={`step ${index === step ? 'current' : ''} ${index < step ? 'past' : ''}`} key={label} aria-current={index === step ? 'step' : undefined}>
          <span className="step-dot">{index < step ? <Icon name="check" /> : <span />}</span><span className="step-label">{label}</span>
        </div>)}
      </nav>
      {storageError && <p className="storage-warning" role="alert">Ton navigateur ne permet pas la sauvegarde. Tes choix restent disponibles dans cet onglet, mais ne seront pas gardés si tu le fermes.</p>}
      <section className={`panel ${screen === 'bienvenue' && !accueil ? 'welcome' : ''}`}>
        {screen !== 'bienvenue' && !accueil && <button className="back-button" onClick={back}><Icon name="back" />Retour</button>}
        {accueil ? <>
          <span className="eyebrow"><Icon name="check" />Tes choix</span>
          <h1 ref={titleRef} tabIndex={-1}>Tes choix sont enregistrés</h1>
          <p className="intro">Ta page d’accueil arrive à l’étape suivante. Tu peux déjà retrouver tes choix ici.</p>
          <Summary state={state} />
          <details className="saved-opinions"><summary>Revoir mes avis sur les {metiers.length} métiers</summary><ul>{metiers.map((m) => <li key={m.id}><span>{m.nom}</span><span>{avisLabels[state.interets_metiers[m.id]] || 'Pas encore vu'}</span></li>)}</ul></details>
          <div className="actions"><button className="primary" onClick={reopen}>Modifier mes choix</button></div>
        </> : screen === 'bienvenue' ? <>
          <span className="eyebrow"><Icon name="book" />Ton rapport, tes envies</span>
          <Illustration />
          <h1 ref={titleRef} tabIndex={-1}>On reprend ton rapport <span className="text-violet-300">ensemble</span></h1>
          <p className="intro">Ton rapport te propose des métiers. Dis-nous ceux qui te parlent, comme tu l’as fait avec le psychologue.</p>
          <p className="muted welcome-note">Ça prend deux minutes, et tu peux changer d’avis quand tu veux.</p>
          <div className="actions"><button className="primary" onClick={() => go(metiers.length ? 'metiers' : 'ajouts')}>C’est parti</button><span className="action-note"><Icon name="clock" />À ton rythme, sans bonne ou mauvaise réponse</span></div>
        </> : screen === 'metiers' && metier ? <>
          <div className="progress-caption"><span>Métier {state.progression.metier + 1} sur {metiers.length}</span><span>Ton avis compte</span></div>
          <progress className="job-progress" aria-label="Métiers parcourus" max={metiers.length} value={state.progression.metier + 1} />
          <p className="zone-announcement" key={metier.zone}>{metier.zone_label}</p>
          <div className="job-illustration" aria-hidden="true"><Icon name="book" /><span className="mini-spark"><Icon name="spark" /></span></div>
          <span className="eyebrow">Une piste de ton rapport</span>
          <h1 ref={titleRef} tabIndex={-1}>{metier.nom}</h1>
          <span className="duration duration-badge"><Icon name="clock" />{zones.find((z) => z.id === metier.zone).duree} de préparation</span>
          <div className="description"><p id="description-metier">{expanded ? metier.description : `${metier.description.slice(0, 70).trimEnd()}…`}</p><button className="text-button" aria-expanded={expanded} aria-controls="description-metier" onClick={() => setExpanded(!expanded)}>{expanded ? 'Lire moins' : 'Lire la suite'}</button></div>
          {state.interets_metiers[metier.id] && <p className="previous-answer">Ton avis actuel : {avisLabels[state.interets_metiers[metier.id]]}</p>}
          <p className="muted small-note">Une piste, pas une consigne. Tu peux changer d’avis.</p>
          <div className="actions opinion-actions">
            <button className="primary" onClick={() => answer('interesse')}><Icon name="heart" />Ça m’intéresse</button>
            <button className="secondary" onClick={() => answer('plus_tard')}><Icon name="clock" />Pas pour l’instant</button>
            <button className="quiet" onClick={() => answer('non')}><Icon name="close" />Pas intéressé</button>
          </div>
        </> : screen === 'favoris' && zone ? <>
          <span className="eyebrow"><Icon name="star" />Tes préférés · {state.progression.zone + 1} sur {zonesRemplies.length}</span>
          <h1 ref={titleRef} tabIndex={-1}>Ton préféré parmi ceux-là ?</h1>
          <span className="duration duration-badge"><Icon name="clock" />{zone.duree} de préparation</span>
          <p className="intro">{hasInterested ? 'Parmi les métiers qui te parlent, choisis celui que tu as le plus envie d’explorer.' : disponibles.length ? 'Tu avais choisi « Pas pour l’instant ». L’un de ces métiers te parle quand même ?' : 'Tu n’as retenu aucun métier dans cette zone. Tu peux continuer et changer d’avis plus tard.'}</p>
          <div className="favorites" role="group" aria-label="Choisis un seul préféré">
            {disponibles.map((m) => <button key={m.id} className={`favorite ${state.favoris[zone.id] === m.id ? 'selected' : ''}`} aria-pressed={state.favoris[zone.id] === m.id} onClick={() => update({ ...state, favoris: { ...state.favoris, [zone.id]: m.id } })}><span className="choice-circle">{state.favoris[zone.id] === m.id && <Icon name="check" />}</span><span>{m.nom}</span><Icon name="star" /></button>)}
          </div>
          <p className="muted small-note">Ce temps de préparation ne ferme aucune porte.</p>
          <div className="actions">
            <button className="primary" disabled={!state.favoris[zone.id]} onClick={() => update(entrerZone(state, zonesRemplies, state.progression.zone + 1))}>Confirmer mon préféré</button>
            {!hasInterested && <button className="quiet" onClick={() => update(entrerZone({ ...state, favoris: { ...state.favoris, [zone.id]: null } }, zonesRemplies, state.progression.zone + 1))}>Aucun pour l’instant</button>}
          </div>
        </> : screen === 'ajouts' ? <>
          <span className="eyebrow"><Icon name="spark" />D’autres idées · facultatif</span>
          <h1 ref={titleRef} tabIndex={-1}>Le psychologue t’a parlé d’autres métiers ?</h1>
          <p className="intro">Ajoute les pistes que vous avez évoquées ensemble. Tu peux aussi passer cette étape.</p>
          <form onSubmit={addJob}>
            <label className="search-label" htmlFor="job-search">Rechercher un métier</label>
            <div className="search-field"><Icon name="search" /><input id="job-search" type="search" autoComplete="off" value={query} placeholder="Tape au moins deux lettres…" onChange={(e) => { setQuery(e.target.value); setSelected(null); }} aria-describedby="search-help" /></div>
            <p id="search-help" className="muted search-help">Liste d’exemple : tous les intitulés sont fictifs.</p>
            <div aria-live="polite" className="sr-only">{query.trim().length >= 2 ? `${matches.length} résultat(s)` : ''}</div>
            {query.trim().length >= 2 && <ul className="search-results" aria-label="Métiers proposés">{matches.map((m) => <li key={m.id}><button type="button" aria-pressed={selected?.id === m.id} className={selected?.id === m.id ? 'chosen' : ''} onClick={() => { setSelected(m); setQuery(m.nom); }}><span>{m.nom}</span>{selected?.id === m.id && <Icon name="check" />}</button></li>)}{!matches.length && <li className="no-result">Aucun métier dans cette liste d’exemple.</li>}</ul>}
            <button className="secondary add-button" type="submit" disabled={!selected}>Ajouter</button>
          </form>
          {state.ajouts_psy.length > 0 && <><h2 className="section-label">Tes pistes ajoutées</h2><ul className="added-list">{state.ajouts_psy.map((m) => <li key={m.id}><span>{m.nom}</span><button className="remove-button" aria-label={`Retirer ${m.nom}`} onClick={() => update({ ...state, ajouts_psy: state.ajouts_psy.filter((a) => a.id !== m.id) })}><Icon name="close" /></button></li>)}</ul></>}
          <div className="actions"><button className="primary" onClick={() => go('recap')}>{state.ajouts_psy.length ? 'Continuer' : 'Passer cette étape'}</button></div>
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
    <Routes>
      <Route path="/" element={!state.termine ? <Navigate to="/onboarding" replace /> : null} />
      <Route path="/onboarding" element={state.termine ? <Navigate to="/" replace /> : null} />
      <Route path="*" element={<Navigate to={state.termine ? '/' : '/onboarding'} replace />} />
    </Routes>
  </>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><HashRouter><App /></HashRouter></React.StrictMode>);
