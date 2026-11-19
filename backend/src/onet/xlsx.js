// Lecture minimale d'un classeur .xlsx, sans dépendance : un .xlsx est une
// archive ZIP de fichiers XML. On lit le répertoire central du ZIP, on
// décompresse les entrées utiles (zlib, inclus dans Node), puis on extrait
// les cellules d'une feuille. Suffisant pour la table des métiers : texte et
// nombres, pas de formules ni de mise en forme.

import fs from 'node:fs';
import zlib from 'node:zlib';

// ─── ZIP ──────────────────────────────────────────────────────────────────────

function entreesZip(buf) {
  // Fin du répertoire central : signature 0x06054b50, cherchée depuis la fin.
  let fin = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      fin = i;
      break;
    }
  }
  if (fin < 0) throw new Error("ce n'est pas un fichier .xlsx (archive ZIP) valide");
  const nb = buf.readUInt16LE(fin + 10);
  let pos = buf.readUInt32LE(fin + 16);
  const entrees = {};
  for (let k = 0; k < nb; k++) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) throw new Error('répertoire ZIP illisible');
    const methode = buf.readUInt16LE(pos + 10);
    const tailleCompressee = buf.readUInt32LE(pos + 20);
    const lNom = buf.readUInt16LE(pos + 28);
    const lExtra = buf.readUInt16LE(pos + 30);
    const lComm = buf.readUInt16LE(pos + 32);
    const local = buf.readUInt32LE(pos + 42);
    const nom = buf.toString('utf8', pos + 46, pos + 46 + lNom);
    entrees[nom] = { methode, tailleCompressee, local };
    pos += 46 + lNom + lExtra + lComm;
  }
  return entrees;
}

function lireEntree(buf, e) {
  const debut = e.local + 30 + buf.readUInt16LE(e.local + 26) + buf.readUInt16LE(e.local + 28);
  const donnees = buf.subarray(debut, debut + e.tailleCompressee);
  if (e.methode === 0) return donnees.toString('utf8');
  if (e.methode === 8) return zlib.inflateRawSync(donnees).toString('utf8');
  throw new Error(`compression ZIP non gérée (${e.methode})`);
}

// ─── XML ──────────────────────────────────────────────────────────────────────

const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function texteXml(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITES[e] ?? m;
  });
}

// Tout le texte des balises <t> d'un fragment (texte riche : plusieurs <r><t>).
const textesT = (fragment) => [...fragment.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => texteXml(m[1])).join('');

function indiceColonne(ref) {
  const lettres = ref.match(/^[A-Z]+/)[0];
  return [...lettres].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
}

// ─── Classeur ─────────────────────────────────────────────────────────────────

// Renvoie [{ nom, lignes }] dans l'ordre du classeur ; chaque ligne est un
// tableau de cellules (texte ou nombre, null si vide).
export function lireClasseur(chemin) {
  const buf = fs.readFileSync(chemin);
  const entrees = entreesZip(buf);
  const lire = (nom) => (entrees[nom] ? lireEntree(buf, entrees[nom]) : null);

  const partages = [...(lire('xl/sharedStrings.xml') || '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textesT(m[1]));
  const liens = Object.fromEntries(
    [...(lire('xl/_rels/workbook.xml.rels') || '').matchAll(/<Relationship\b[^>]*>/g)].map((m) => [
      m[0].match(/Id="([^"]+)"/)[1],
      m[0].match(/Target="([^"]+)"/)[1],
    ])
  );
  const feuilles = [...(lire('xl/workbook.xml') || '').matchAll(/<sheet\b[^>]*>/g)].map((m) => ({
    nom: texteXml(m[0].match(/name="([^"]*)"/)[1]),
    cible: liens[m[0].match(/r:id="([^"]+)"/)[1]],
  }));

  return feuilles.map(({ nom, cible }) => {
    const xml = lire(`xl/${cible.replace(/^\/?xl\//, '')}`) || '';
    const lignes = [];
    for (const r of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const cellules = [];
      for (const c of (r[1] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attributs = c[1];
        const contenu = c[2] || '';
        const ref = attributs.match(/r="([A-Z]+)\d+"/);
        const type = (attributs.match(/t="(\w+)"/) || [])[1];
        const v = (contenu.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        let valeur = null;
        if (type === 's' && v !== undefined) valeur = partages[Number(v)] ?? null;
        else if (type === 'inlineStr') valeur = textesT(contenu);
        else if (type === 'str' || type === 'b' || type === 'e') valeur = v !== undefined ? texteXml(v) : null;
        else if (v !== undefined) valeur = Number(v);
        cellules[ref ? indiceColonne(ref[1]) : cellules.length] = valeur;
      }
      if (cellules.some((x) => x !== null && x !== undefined && x !== '')) lignes.push(Array.from(cellules, (x) => x ?? null));
    }
    return { nom, lignes };
  });
}
