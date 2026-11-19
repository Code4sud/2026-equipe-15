// Dossiers de stockage (lus à chaque appel : les tests écrasent BACKEND_STORAGE).

import path from 'node:path';
import { config } from './config.js';

export function dossiersStockage() {
  return {
    outputs: path.join(config.storage, 'outputs'),
  };
}
