import exemple from '../../contrat/rapport-fictif.json';

export const rapport = exemple.rapport;
export const metiers = [...rapport.metiers].sort((a, b) => a.zone - b.zone);
export const zones = [
  { id: 1, duree: '0 à 6 mois' },
  { id: 2, duree: '3 mois à 2 ans' },
  { id: 3, duree: '1 à 4 ans' },
  { id: 4, duree: '2 à 6 ans' },
  { id: 5, duree: '4 à 10 ans' },
].map((zone) => ({ ...zone, metiers: metiers.filter((m) => m.zone === zone.id) }));

// Catalogue entièrement inventé pour cette démonstration, sans appel au backend.
export const autresMetiers = [
  'Métier fictif du paysage', 'Métier fictif du son',
  'Métier fictif de la cuisine', 'Métier fictif du dessin',
  'Métier fictif du sport', 'Métier fictif de la mécanique',
  'Métier fictif de la nature', 'Métier fictif du numérique',
  'Métier fictif de la couture', 'Métier fictif du spectacle',
].map((nom, index) => ({ id: `psy-${index + 1}`, nom }));
