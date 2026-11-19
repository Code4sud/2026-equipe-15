// Client minimal d'Ollama (modèle d'IA local, décision du 19/11).
//
// Variables d'environnement (backend/.env, voir .env.example) :
//   OLLAMA_URL         adresse d'Ollama (défaut : http://localhost:11434, celle d'Ollama)
//   OLLAMA_MODEL       nom du modèle — pas de valeur par défaut : le choix du modèle
//                      revient à l'équipe. Sans lui, le résumé passe en repli sans IA.
//   OLLAMA_TIMEOUT_MS  délai maximal d'une réponse (défaut : 90 000 ms)
//   OLLAMA_THINK       « false » coupe le mode « réflexion » des modèles qui en
//                      ont un (Qwen3…), bien plus lent ; non envoyé si vide

export class ErreurIA extends Error {}

export function configOllama() {
  const think = (process.env.OLLAMA_THINK || '').trim().toLowerCase();
  return {
    url: (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/+$/, ''),
    modele: process.env.OLLAMA_MODEL || null,
    delaiMs: Number(process.env.OLLAMA_TIMEOUT_MS || 90000),
    think: think === 'false' ? false : think === 'true' ? true : undefined,
  };
}

// Envoie un message au modèle et renvoie sa réponse en objet JSON. `schema`
// (JSON Schema) contraint la forme de la réponse (sorties structurées
// d'Ollama). Lève ErreurIA si Ollama est absent, lent, ou répond mal.
export async function discuterJson({ systeme, message, schema, temperature = 0.2 }) {
  const { url, modele, delaiMs, think } = configOllama();
  if (!modele) throw new ErreurIA('OLLAMA_MODEL non défini');
  let reponse;
  try {
    reponse = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modele,
        stream: false,
        format: schema || 'json',
        ...(think === undefined ? {} : { think }),
        options: { temperature },
        messages: [
          { role: 'system', content: systeme },
          { role: 'user', content: message },
        ],
      }),
      signal: AbortSignal.timeout(delaiMs),
    });
  } catch (e) {
    throw new ErreurIA(`Ollama injoignable (${e.name === 'TimeoutError' ? 'délai dépassé' : e.message})`);
  }
  if (!reponse.ok) throw new ErreurIA(`Ollama a répondu ${reponse.status}`);
  const corps = await reponse.json();
  // Un modèle « qui réfléchit » peut placer sa réflexion avant le JSON.
  const contenu = String(corps.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  try {
    return JSON.parse(contenu);
  } catch {
    throw new ErreurIA("réponse du modèle qui n'est pas du JSON");
  }
}
