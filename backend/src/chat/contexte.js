// Les faits que l'assistant a le droit d'utiliser : ceux du résumé (points
// forts, aptitudes, choix de l'onboarding, avertissement, voir
// resume/faits.js), plus un fait par métier du rapport, pour pouvoir répondre
// sur un métier précis. Chaque fait garde la page du rapport d'où il vient.

import { construireFaits } from '../resume/faits.js';

export function construireContexte(analyse, onboarding = null) {
  const { faits, choix } = construireFaits(analyse, onboarding);
  const contexte = faits.map(({ id, page, texte, noms }) => ({ id, page, texte, noms }));
  for (const m of analyse.metiers) {
    contexte.push({
      id: m.id, // ex. « z2-m3 » : zone 2, 3e métier
      page: m.source.page,
      noms: [m.nom], // l'intitulé n'est pas soumis aux mots interdits (ex. « santé »)
      texte:
        `Piste de métier « ${m.nom} », zone ${m.zone}${m.zone_label ? ` (${m.zone_label})` : ''}` +
        (m.description ? ` : ${m.description}` : '.') +
        (choix.favoris.includes(m.id) ? " Le jeune l'a choisi parmi ses préférés." : ''),
    });
  }
  return { contexte, choix };
}
