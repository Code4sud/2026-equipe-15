// Normalisation du texte pour comparer des titres et des mots-clés
// (« MESURE D’INTÉRÊTS » et « mesure d'interets » doivent donner la même forme).

export function normaliser(texte) {
  // Minuscules, apostrophes ramenées à ', sans accents, espaces réduits.
  // L'extraction PDF perd parfois les doubles « l » (« travaile ») :
  // on ne corrige pas le texte brut, on compare sur la version normalisée.
  const apostrophes = String(texte).toLowerCase().replace(/[’‘ʼ`´]/g, "'");
  // NFKD décompose, puis on retire les marques combinantes (accents U+0300–U+036F)
  const sansAccents = apostrophes.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return sansAccents.replace(/\s+/g, ' ').trim();
}
