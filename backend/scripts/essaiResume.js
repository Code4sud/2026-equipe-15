// Essai du résumé écrit sur un rapport de prive/, dans le terminal, avec le
// modèle du .env (OLLAMA_MODEL). Rien n'est écrit sur le disque.
//
//     npm run resume -- rapport-des-possibles-XXXX.pdf
//
// Affiche les faits envoyés au modèle, les 4 points (avec leur page et leur
// origine : « ia » ou « repli »), le texte, et les phrases refusées par le
// contrôle. Sans onboarding : les choix du jeune ne sont pas pris en compte.

import 'dotenv/config';
import path from 'node:path';
import { config } from '../src/config.js';
import { configOllama } from '../src/ai/ollama.js';
import { analyserRapport } from '../src/report/analyzer.js';
import { genererResume } from '../src/resume/generer.js';

const fichier = process.argv[2];
if (!fichier) {
  console.error('Usage : npm run resume -- <fichier.pdf>  (fichier rangé dans prive/)');
  process.exit(1);
}

const { modele, url, think } = configOllama();
console.log(`Modèle : ${modele || '(aucun : repli sans IA)'} — ${url}${think === undefined ? '' : ` — think=${think}`}`);
const analyse = await analyserRapport(path.join(config.rapportsDir, path.basename(fichier)), path.basename(fichier));
const debut = Date.now();
const r = await genererResume(analyse, null);
console.log(`Généré en ${((Date.now() - debut) / 1000).toFixed(1)} s — mode ${r.genere_par.mode}${r.genere_par.raison ? ` (${r.genere_par.raison})` : ''}\n`);
console.log('Faits :');
for (const f of r.faits) console.log(`  ${f.id} (p. ${f.page}) ${f.texte}`);
console.log('\nPoints :');
for (const p of r.points) console.log(`  [${p.origine} ${p.fait} p. ${p.page}] ${p.texte}`);
console.log('\nTexte :');
for (const p of r.phrases) console.log(`  [${p.origine} ${p.faits.join(',')}] ${p.texte}`);
console.log(`\nPhrases refusées par le contrôle : ${r.controle.phrases_refusees}`);
for (const raison of r.controle.raisons) console.log(`  - ${raison}`);
