// Les faits du résumé : tout ce que le résumé a le droit de dire, tiré de
// l'analyse du rapport (et des choix de l'onboarding), chacun avec la page du
// rapport d'où il vient. Le modèle d'IA ne reçoit que ces faits, et chaque
// phrase qu'il écrit doit en citer un (voir controle.js).
//
// Chaque fait : { id, page, texte, phrase }
//   texte  : ce que le modèle reçoit (peut citer le texte du rapport) ;
//   phrase : une phrase toute faite, simple, utilisée par le repli sans IA.
//
// Règles (AGENTS.md, section 5) : on compare la personne à elle-même (« ce
// qui ressort le plus chez toi »), jamais aux autres ; aucune valeur chiffrée
// de score n'est transmise ; les métiers sont des pistes.

// Dimensions dont le texte explicatif du rapport n'est pas transmis au modèle :
// il parle d'humeur et de stress, et AGENTS.md interdit toute déduction sur la
// santé. Le nom de la dimension reste cité ; l'interprétation revient au
// psychologue.
const SANS_DESCRIPTION = ['Émotivité'];

const AVIS = ['interesse', 'plus_tard', 'non'];

const liste = (noms) => {
  const q = noms.map((n) => `« ${n} »`);
  return q.length <= 1 ? q.join('') : `${q.slice(0, -1).join(', ')} et ${q[q.length - 1]}`;
};

// Le côté « valeur haute » de l'explication du rapport : les phrases qui
// précèdent celle qui parle de « score faible ».
function cotePointFort(description) {
  if (!description) return null;
  const phrases = description.split(/(?<=\.)\s+/);
  const garde = [];
  for (const p of phrases) {
    if (/faible/i.test(p)) break;
    garde.push(p);
  }
  // « Un score élevé indique que… » : pas de vocabulaire de score transmis au modèle.
  const texte = garde
    .join(' ')
    .replace(/^Un score élevé (indique|signale|reflète|correspond à)\s*(que\s*|qu[’']\s*)?/i, 'quand cette dimension ressort : ')
    .trim();
  return texte || null;
}

function faitRadar(id, scores, { titre, phrase }) {
  const forts = scores.filter((s) => s.point_fort === true).sort((a, b) => b.value - a.value);
  if (!forts.length) return null;
  const noms = forts.map((s) => s.label);
  const explications = forts
    .filter((s) => !SANS_DESCRIPTION.includes(s.label))
    .map((s) => [s.label, cotePointFort(s.description)])
    .filter(([, d]) => d)
    .map(([label, d]) => ` Ce que le rapport dit de « ${label} » : « ${d} »`)
    .join('');
  return {
    id,
    page: forts[0].source.page,
    texte: `${titre} : ${liste(noms)}.${explications}`,
    phrase: phrase(noms),
  };
}

// Onboarding reçu du front : on ne garde que ce qui désigne des métiers du
// rapport, avec des valeurs connues. Le reste est ignoré.
export function nettoyerOnboarding(onboarding, analyse) {
  const ids = new Set(analyse.metiers.map((m) => m.id));
  const favoris = [];
  const interesses = [];
  if (onboarding && typeof onboarding === 'object') {
    for (const id of Object.values(onboarding.favoris || {})) {
      if (typeof id === 'string' && ids.has(id) && !favoris.includes(id)) favoris.push(id);
    }
    for (const [id, avis] of Object.entries(onboarding.interets_metiers || {})) {
      if (ids.has(id) && AVIS.includes(avis) && avis === 'interesse') interesses.push(id);
    }
  }
  return { favoris: favoris.sort(), interesses: interesses.sort() };
}

export function construireFaits(analyse, onboarding = null) {
  const choix = nettoyerOnboarding(onboarding, analyse);
  const metierDe = Object.fromEntries(analyse.metiers.map((m) => [m.id, m]));
  const faits = [];
  const ajouter = (f) => {
    if (f && f.page >= 1) faits.push({ ...f, id: `f${faits.length + 1}` });
  };

  ajouter(
    faitRadar(null, analyse.interets_riasec, {
      titre: 'Les intérêts professionnels qui ressortent le plus dans ton rapport',
      phrase: (noms) =>
        noms.length > 1
          ? `Dans ton rapport, tes intérêts qui ressortent le plus sont ${liste(noms)}.`
          : `Dans ton rapport, ton intérêt qui ressort le plus est ${liste(noms)}.`,
    })
  );

  // Aptitudes : la ou les plus hautes chez ce jeune, sans valeur. Pas de fait
  // si les libellés lus sous les barres ne correspondent à aucun gabarit connu
  // (valeurs absentes), ni si plus de trois aptitudes sont à égalité.
  const libellesDouteux = analyse.notes.some((n) => n.includes('libellés écrits sous les barres'));
  const valeurs = analyse.aptitudes.map((s) => s.value).filter((v) => typeof v === 'number');
  if (!libellesDouteux && valeurs.length === analyse.aptitudes.length && Math.max(...valeurs) > 0) {
    const max = Math.max(...valeurs);
    const tops = analyse.aptitudes.filter((s) => s.value === max);
    if (tops.length <= 3) {
      const noms = tops.map((s) => s.label);
      ajouter({
        page: tops[0].source.page,
        texte:
          noms.length > 1
            ? `Parmi tes aptitudes cognitives, celles qui ressortent le plus chez toi : ${liste(noms)}.`
            : `Parmi tes aptitudes cognitives, celle qui ressort le plus chez toi : ${liste(noms)}.`,
        phrase:
          noms.length > 1
            ? `Parmi tes aptitudes, ${liste(noms)} sont celles qui ressortent le plus chez toi.`
            : `Parmi tes aptitudes, ${liste(noms)} est celle qui ressort le plus chez toi.`,
      });
    }
  }

  ajouter(
    faitRadar(null, analyse.personnalite_hexaco, {
      titre: 'Les traits de personnalité qui ressortent le plus dans ton rapport',
      phrase: (noms) => `Dans ta personnalité, ce qui ressort le plus : ${liste(noms)}.`,
    })
  );

  // Métiers : d'abord les choix du jeune, sinon ce que propose le rapport.
  if (choix.favoris.length) {
    const favoris = choix.favoris.map((id) => metierDe[id]);
    const details = favoris.map((m) => `« ${m.nom} » (zone ${m.zone}, ${m.zone_label || 'zone de métiers'})`);
    const zones = new Set(favoris.map((m) => m.zone)).size;
    ajouter({
      page: favoris[0].source.page,
      noms: favoris.map((m) => m.nom),
      texte:
        `Tu as choisi ${favoris.length} métier${favoris.length > 1 ? 's' : ''} préféré${favoris.length > 1 ? 's' : ''}, ` +
        `dans ${zones} zone${zones > 1 ? 's' : ''}, parmi les pistes de ton rapport : ${details.join(' ; ')}.`,
      phrase:
        favoris.length > 1
          ? `Tu as choisi ${favoris.length} métiers préférés, dans ${zones > 1 ? `${zones} zones différentes` : 'la même zone'}.`
          : `Ton métier préféré pour l'instant : « ${favoris[0].nom} ».`,
    });
  }
  if (choix.interesses.length) {
    const n = choix.interesses.length;
    ajouter({
      page: metierDe[choix.interesses[0]].source.page,
      texte: `Tu as marqué ${n} métier${n > 1 ? 's' : ''} de ton rapport comme intéressant${n > 1 ? 's' : ''}.`,
      phrase: `Tu as marqué ${n} métier${n > 1 ? 's' : ''} de ton rapport comme intéressant${n > 1 ? 's' : ''}.`,
    });
  }
  if (!choix.favoris.length && analyse.metiers.length) {
    const zones = [...new Set(analyse.metiers.map((m) => m.zone))].sort();
    const n = analyse.metiers.length;
    const libelles = zones.map((z) => {
      const m = analyse.metiers.find((x) => x.zone === z);
      return `zone ${z} : ${m.zone_label || 'zone de métiers'}`;
    });
    ajouter({
      page: analyse.metiers[0].source.page,
      texte:
        `Ton rapport te propose ${n} pistes de métiers, dans ${zones.length} zone${zones.length > 1 ? 's' : ''} ` +
        `(${libelles.join(' ; ')}). Une zone indique un temps de préparation, pas un niveau.`,
      phrase: `Ton rapport te propose ${n} pistes de métiers, à explorer à ton rythme.`,
    });
  }

  if (analyse.avertissement_page) {
    ajouter({
      page: analyse.avertissement_page,
      texte:
        'Ton rapport rappelle que ces résultats sont des pistes de réflexion, une image à un moment donné : ' +
        'ils peuvent évoluer, et ce sont des pistes, pas des consignes.',
      phrase: 'Ces résultats sont une image à un moment donné : ils peuvent évoluer.',
    });
  }

  return { faits, choix };
}
