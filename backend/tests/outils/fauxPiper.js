#!/usr/bin/env node
// Faux Piper pour les tests : même interface (texte sur l'entrée standard,
// --model et --output_file), écrit un WAV de silence d'un dixième de seconde.
// Chaque appel est noté dans FAUX_PIPER_JOURNAL (un texte reçu par ligne).
// FAUX_PIPER_ECHEC=1 simule une panne.

import fs from 'node:fs';

const args = process.argv.slice(2);
const sortie = args[args.indexOf('--output_file') + 1];
const modele = args[args.indexOf('--model') + 1];

let texte = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => (texte += d));
process.stdin.on('end', () => {
  if (process.env.FAUX_PIPER_JOURNAL) {
    fs.appendFileSync(process.env.FAUX_PIPER_JOURNAL, JSON.stringify({ modele, texte: texte.trim() }) + '\n');
  }
  if (process.env.FAUX_PIPER_ECHEC === '1') {
    process.stderr.write('panne simulée\n');
    process.exit(3);
  }
  const echantillons = 22050 / 10; // 0,1 s à 22 050 Hz, mono, 16 bits
  const wav = Buffer.alloc(44 + echantillons * 2);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + echantillons * 2, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(22050, 24);
  wav.writeUInt32LE(44100, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(echantillons * 2, 40);
  fs.writeFileSync(sortie, wav);
});
