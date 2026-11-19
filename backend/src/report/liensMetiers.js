// Liens de recherche d'un métier, pour les pages métier du site : c'est là que
// le jeune trouvera salaires, études, formations et offres, avec leur source.
// Rien n'est extrait de ces sites (AGENTS.md, section 4) : on construit
// seulement l'adresse, et le jeune ouvre la page lui-même.
//
// Adresses vérifiées à la main le 19/11/2026 :
// - ONISEP : recherche limitée aux fiches métiers (context=metier) ;
// - France Travail : offres d'emploi (redirige vers la page de résultats) ;
// - orientation-regionsud.fr : sa recherche passe par un formulaire protégé,
//   sans adresse directe : lien vers sa page « Rechercher un métier ».

export const SITES = {
  onisep: 'https://www.onisep.fr/recherche?context=metier&text=',
  regionsud: 'https://www.orientation-regionsud.fr/metiers',
  franceTravail: 'https://candidat.francetravail.fr/offres/recherche?motsCles=',
};

export function liensMetier(nom) {
  const q = encodeURIComponent(String(nom ?? '').replace(/\s+/g, ' ').trim());
  if (!q) return [];
  return [
    { site: 'onisep', titre: 'Le métier, les études et les formations (ONISEP)', url: `${SITES.onisep}${q}` },
    { site: 'orientation-regionsud', titre: 'Chercher ce métier en Région Sud', url: SITES.regionsud },
    { site: 'france-travail', titre: "Les offres d'emploi (France Travail)", url: `${SITES.franceTravail}${q}` },
  ];
}
