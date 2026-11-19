export const STORAGE_KEY = 'possibles-ai:onboarding:v1';
export const avisLabels = {
  interesse: 'Ça m’intéresse',
  plus_tard: 'Pas pour l’instant',
  non: 'Pas intéressé',
};

export function initialState() {
  return {
    termine: false,
    interets_metiers: {},
    favoris: {},
    ajouts_psy: [],
    progression: { ecran: 'bienvenue', metier: 0, zone: 0 },
  };
}

export function candidats(zone, avis) {
  const interesses = zone.metiers.filter((m) => avis[m.id] === 'interesse');
  return interesses.length ? interesses : zone.metiers.filter((m) => avis[m.id] === 'plus_tard');
}

export function choisirAvis(state, metier, avis) {
  const next = {
    ...state,
    interets_metiers: { ...state.interets_metiers, [metier.id]: avis },
    favoris: { ...state.favoris },
  };
  // Une réponse modifiée ne doit pas laisser un préféré devenu incompatible.
  delete next.favoris[metier.zone];
  return next;
}

export function entrerZone(state, zones, index) {
  const zone = zones[index];
  if (!zone) return { ...state, progression: { ...state.progression, ecran: 'ajouts' } };
  const disponibles = candidats(zone, state.interets_metiers);
  const favoris = { ...state.favoris };
  if (!disponibles.some((m) => m.id === favoris[zone.id])) favoris[zone.id] = null;
  if (disponibles.length === 1 && state.interets_metiers[disponibles[0].id] === 'interesse') {
    favoris[zone.id] = disponibles[0].id;
  }
  return { ...state, favoris, progression: { ...state.progression, ecran: 'favoris', zone: index } };
}

// Parcours zone par zone : les métiers d'une zone, puis son préféré, puis la zone suivante.
// `zones` ne contient que les zones qui ont des métiers ; `metiers` est trié par zone.
const indexDeZone = (zones, metier) => zones.findIndex((z) => z.id === metier.zone);
const vers = (state, progression) => ({ ...state, progression: { ...state.progression, ...progression } });

export function entrerMetiers(state, zones, metiers, index) {
  const zone = zones[index];
  const premier = zone ? metiers.findIndex((m) => m.zone === zone.id) : -1;
  return premier < 0 ? vers(state, { ecran: 'ajouts' }) : vers(state, { ecran: 'metiers', metier: premier, zone: index });
}

// Après un avis : le métier suivant de la même zone, sinon le choix du préféré de cette zone.
export function apresAvis(state, zones, metiers, index) {
  const suivant = metiers[index + 1];
  if (suivant && suivant.zone === metiers[index].zone) {
    return vers(state, { ecran: 'metiers', metier: index + 1, zone: indexDeZone(zones, suivant) });
  }
  return entrerZone(state, zones, indexDeZone(zones, metiers[index]));
}

export function apresPrefere(state, zones, metiers, index) {
  return entrerMetiers(state, zones, metiers, index + 1);
}

export function retour(state, zones, metiers) {
  const { ecran, metier, zone } = state.progression;
  if (ecran === 'metiers') {
    const precedent = metiers[metier - 1];
    if (!precedent) return vers(state, { ecran: 'bienvenue' });
    if (precedent.zone === metiers[metier].zone) return vers(state, { metier: metier - 1 });
    return entrerZone(state, zones, indexDeZone(zones, precedent));
  }
  if (ecran === 'favoris') {
    const dernier = metiers.findLastIndex((m) => m.zone === zones[zone]?.id);
    return dernier < 0 ? vers(state, { ecran: 'bienvenue' }) : vers(state, { ecran: 'metiers', metier: dernier });
  }
  if (ecran === 'ajouts') return zones.length ? entrerZone(state, zones, zones.length - 1) : vers(state, { ecran: 'bienvenue' });
  if (ecran === 'recap') return vers(state, { ecran: 'ajouts' });
  return state;
}

export function lireChoix(storage, rapportId, metiers, catalogue) {
  const empty = initialState();
  // Un localStorage bloqué est signalé à l'interface, plutôt que d'annoncer une sauvegarde.
  const raw = storage.getItem(STORAGE_KEY);
  const legacy = raw ? null : storage.getItem('possibles.onboarding');
  if (!raw && !legacy) return empty;
  let saved;
  try {
    saved = raw ? JSON.parse(raw) : { rapport_id: rapportId, onboarding: JSON.parse(legacy) };
  } catch { return empty; }
  if (saved?.rapport_id !== rapportId || !saved.onboarding) return empty;
  const input = saved.onboarding;
  const interets_metiers = {};
  for (const metier of metiers) {
    if (Object.hasOwn(avisLabels, input.interets_metiers?.[metier.id])) {
      interets_metiers[metier.id] = input.interets_metiers[metier.id];
    }
  }
  const favoris = {};
  for (let zone = 1; zone <= 5; zone++) {
    const disponibles = candidats({ metiers: metiers.filter((m) => m.zone === zone) }, interets_metiers);
    const id = input.favoris?.[zone];
    favoris[zone] = disponibles.some((m) => m.id === id) ? id : null;
  }
  const ajouts_psy = catalogue.filter((m) => Array.isArray(input.ajouts_psy) && input.ajouts_psy.some((a) => a?.id === m.id));
  const progression = input.progression || {};
  const ecrans = ['bienvenue', 'metiers', 'favoris', 'ajouts', 'recap'];
  const zoneCount = new Set(metiers.map((m) => m.zone)).size;
  const borne = (value, max) => Number.isInteger(value) ? Math.max(0, Math.min(value, Math.max(0, max - 1))) : 0;
  return {
    termine: input.termine === true,
    interets_metiers, favoris, ajouts_psy,
    progression: {
      ecran: ecrans.includes(progression.ecran) ? progression.ecran : 'bienvenue',
      metier: borne(progression.metier, metiers.length),
      zone: borne(progression.zone, zoneCount),
    },
  };
}

export function enregistrerChoix(storage, rapportId, state) {
  storage.setItem(STORAGE_KEY, JSON.stringify({ rapport_id: rapportId, onboarding: state }));
}
