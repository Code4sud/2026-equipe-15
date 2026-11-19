// Authentification de l'API — une seule variable d'environnement :
//
//   API_TOKEN=...   (dans backend/.env, jamais versionné)
//
// - Si API_TOKEN est défini  → chaque requête doit porter le header
//   « Authorization: Bearer <API_TOKEN> », sinon 401.
// - Si API_TOKEN est absent  → mode développement ouvert (les tests
//   automatiques passent alors sans token).

export function verifierToken(req, res, next) {
  const token = process.env.API_TOKEN;
  if (!token) return next(); // mode dev
  const header = req.headers.authorization || '';
  const [scheme, value] = header.split(' ');
  if (scheme === 'Bearer' && value === token) return next();
  res.status(401).json({ detail: "Code d'accès manquant ou invalide" });
}
