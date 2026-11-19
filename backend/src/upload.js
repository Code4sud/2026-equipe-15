// Dépôt d'un PDF reçu (multipart) dans storage/uploads/ — jamais versionné.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';
import { dossiersStockage } from './storage.js';

export class ErreurUpload extends Error {}

export const MAX_UPLOAD_OCTETS = config.maxUploadOctets;

// ─── Upload ───────────────────────────────────────────────────────────────────

export function sauvegarderUpload(contenu, nomOriginal = 'rapport.pdf') {
  if (!nomOriginal.toLowerCase().endsWith('.pdf')) {
    throw new ErreurUpload(`Seuls les PDF sont acceptés (reçu : ${nomOriginal})`);
  }
  if (contenu.length > MAX_UPLOAD_OCTETS) {
    throw new ErreurUpload(
      `PDF trop volumineux : ${(contenu.length / 1048576).toFixed(1)} Mo (max ${MAX_UPLOAD_OCTETS / 1048576} Mo)`
    );
  }
  if (Buffer.from(contenu.slice(0, 5)).toString('latin1') !== '%PDF-') {
    throw new ErreurUpload("Le fichier ne commence pas par %PDF : ce n'est pas un PDF valide");
  }
  const { uploads: dossier } = dossiersStockage();
  fs.mkdirSync(dossier, { recursive: true });
  const chemin = path.join(dossier, crypto.randomUUID().replace(/-/g, '') + '.pdf');
  fs.writeFileSync(chemin, contenu);
  return chemin;
}

