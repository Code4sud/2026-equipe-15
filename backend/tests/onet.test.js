// Tests de la lecture de la table O*NET, sur un petit classeur .xlsx INVENTÉ
// fabriqué ici (métiers fictifs) : ils tournent partout, sans la vraie table.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'onet-test-'));
const FICHIER = path.join(TMP, 'table-inventee.xlsx');
process.env.ONET_FICHIER = FICHIER;
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const { lireClasseur } = await import('../src/onet/xlsx.js');
const { tableOnet, trouverMetiers, controlerMetiers, chercherMetiers, cleIntitule } = await import('../src/onet/table.js');

// ─── Fabrication d'un .xlsx minimal (ZIP : entrées stockées ou compressées) ───

function zip(fichiers) {
  const locaux = [];
  const centraux = [];
  let decalage = 0;
  for (const [nom, contenu, compresser] of fichiers) {
    const brut = Buffer.from(contenu, 'utf8');
    const donnees = compresser ? zlib.deflateRawSync(brut) : brut;
    const n = Buffer.from(nom, 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(compresser ? 8 : 0, 8);
    local.writeUInt32LE(donnees.length, 18);
    local.writeUInt32LE(brut.length, 22);
    local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(compresser ? 8 : 0, 10);
    central.writeUInt32LE(donnees.length, 20);
    central.writeUInt32LE(brut.length, 24);
    central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE(decalage, 42);
    locaux.push(local, n, donnees);
    centraux.push(central, n);
    decalage += 30 + n.length + donnees.length;
  }
  const cd = Buffer.concat(centraux);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(fichiers.length, 8);
  fin.writeUInt16LE(fichiers.length, 10);
  fin.writeUInt32LE(cd.length, 12);
  fin.writeUInt32LE(decalage, 16);
  return Buffer.concat([...locaux, cd, fin]);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const lettre = (i) => String.fromCharCode(65 + i);

// Une feuille : chaînes partagées, sauf les nombres et une chaîne en ligne.
function feuilleXml(lignes, partages) {
  const rows = lignes.map((cellules, r) => {
    const cs = cellules.map((v, c) => {
      const ref = `${lettre(c)}${r + 1}`;
      if (v === null) return '';
      if (typeof v === 'number') return `<c r="${ref}"><v>${v}</v></c>`;
      if (v.startsWith('EN LIGNE:')) return `<c r="${ref}" t="inlineStr"><is><t>${esc(v.slice(9))}</t></is></c>`;
      if (!partages.includes(v)) partages.push(v);
      return `<c r="${ref}" t="s"><v>${partages.indexOf(v)}</v></c>`;
    });
    return `<row r="${r + 1}">${cs.join('')}</row>`;
  });
  return `<?xml version="1.0"?><worksheet><cols><col min="1" max="1"/></cols><sheetData>${rows.join('')}<row r="99"/></sheetData></worksheet>`;
}

const ENTETE = ['Zone réelle', 'O*NET-SOC Code', 'job_en', 'job_fr', 'description_fr', 'jobZone', 'justification_jobZone'];
const METIERS = [
  ['NOTE INTERNE INVENTÉE', '99-0001.00', 'Fictional baker', 'Boulanger fictif', 'Description inventée A & B.', 2, 'inventé'],
  [null, '99-0002.00', 'Fictional installer', 'Installateur fictif', 'EN LIGNE:Description inventée en ligne.', 3, 'inventé'],
  [null, '99-0003.00', 'Fictional guide one', 'Guide fictif', 'Inventé.', 1, 'inventé'],
  [null, '99-0004.00', 'Fictional guide two', 'Guide fictif', 'Inventé aussi.', 1, 'inventé'],
  [null, '99-0005.00', 'Fictional board agent', 'Agent de bord fictif', 'Inventé.', 2, 'inventé'],
];

function ecrireTable(metiers = METIERS) {
  const partages = [];
  const definitions = feuilleXml([['Zone', 'Définition'], [1, 'Définition inventée']], partages);
  const feuille = feuilleXml([ENTETE, ...metiers], partages);
  // Texte riche (plusieurs <r><t>) pour le premier intitulé partagé
  const sst = partages
    .map((s, i) => (i === 0 ? `<si><r><t>${esc(s.slice(0, 2))}</t></r><r><t xml:space="preserve">${esc(s.slice(2))}</t></r></si>` : `<si><t>${esc(s)}</t></si>`))
    .join('');
  fs.writeFileSync(
    FICHIER,
    zip([
      ['[Content_Types].xml', '<Types/>', false],
      ['xl/workbook.xml', '<workbook><sheets><sheet name="Définitions" sheetId="1" r:id="rId1"/><sheet name="Métiers &amp; zones" sheetId="2" r:id="rId2"/></sheets></workbook>', false],
      ['xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>', false],
      ['xl/sharedStrings.xml', `<sst>${sst}</sst>`, true],
      ['xl/worksheets/sheet1.xml', definitions, true],
      ['xl/worksheets/sheet2.xml', feuille, false],
    ])
  );
}

test('xlsx : feuilles, chaînes partagées, texte riche, en ligne, nombres, entités', () => {
  ecrireTable();
  const feuilles = lireClasseur(FICHIER);
  assert.deepEqual(feuilles.map((f) => f.nom), ['Définitions', 'Métiers & zones']);
  assert.equal(feuilles[0].lignes[0][0], 'Zone'); // texte riche en deux morceaux, recollé
  const [entete, premier, second] = feuilles[1].lignes;
  assert.deepEqual(entete, ENTETE);
  assert.equal(premier[4], 'Description inventée A & B.');
  assert.equal(premier[5], 2);
  assert.equal(second[0], null);
  assert.equal(second[4], 'Description inventée en ligne.');
  assert.equal(feuilles[1].lignes.length, METIERS.length + 1); // ligne vide ignorée
  const pasUnXlsx = path.join(TMP, 'pas-un-xlsx.xlsx');
  fs.writeFileSync(pasUnXlsx, 'ceci est du texte');
  assert.throws(() => lireClasseur(pasUnXlsx), /xlsx/);
});

test('table : colonnes utiles seulement, jamais « Zone réelle »', () => {
  ecrireTable();
  const table = tableOnet();
  assert.equal(table.metiers.length, METIERS.length);
  for (const m of table.metiers) {
    assert.deepEqual(Object.keys(m).sort(), ['cle', 'code', 'description_fr', 'job_en', 'job_fr']);
  }
  assert.ok(!JSON.stringify(table.metiers).includes('NOTE INTERNE'));
});

test('table : retrouver un métier malgré accents, casse et « l » perdus', () => {
  ecrireTable();
  const table = tableOnet();
  assert.equal(cleIntitule('Instalateur  FICTIF'), cleIntitule('Installateur fictif'));
  assert.equal(trouverMetiers(table, 'Instalateur fictif')[0].code, '99-0002.00');
  assert.equal(trouverMetiers(table, 'BOULANGER fictif')[0].code, '99-0001.00');
  assert.deepEqual(trouverMetiers(table, 'Métier absent'), []);
});

test('contrôle : code O*NET ajouté, intitulé ambigu ou introuvable signalé, nom jamais corrigé', () => {
  ecrireTable();
  const metiers = [
    { id: 'z1-m1', nom: 'Boulanger fictif' },
    { id: 'z1-m2', nom: 'Guide fictif' },
    { id: 'z2-m1', nom: 'Métier absent de la table' },
  ];
  const { metiers: enrichis, controle } = controlerMetiers(metiers, tableOnet());
  assert.deepEqual(enrichis[0].onet, { code: '99-0001.00', job_en: 'Fictional baker' });
  assert.deepEqual(enrichis[1].onet, { code: null, codes: ['99-0003.00', '99-0004.00'] });
  assert.equal(enrichis[2].onet, null);
  assert.deepEqual(enrichis.map((m) => m.nom), metiers.map((m) => m.nom));
  assert.deepEqual(controle, { table: true, retrouves: 2, introuvables: ['Métier absent de la table'] });
  assert.deepEqual(controlerMetiers(metiers, null).controle, { table: false, retrouves: 0, introuvables: [] });
});

test('recherche : début d’intitulé d’abord, puis début d’un mot ; rien avant 2 lettres', () => {
  ecrireTable();
  const table = tableOnet();
  assert.deepEqual(chercherMetiers(table, 'b'), []);
  assert.deepEqual(chercherMetiers(table, 'bo').map((m) => m.job_fr), ['Boulanger fictif', 'Agent de bord fictif']);
  assert.deepEqual(chercherMetiers(table, 'guide').map((m) => m.job_fr), ['Guide fictif']); // proposé une seule fois
  assert.deepEqual(chercherMetiers(table, 'FICT', 2).length, 2);
  assert.deepEqual(chercherMetiers(table, 'zzz'), []);
});

test('table : relue quand le fichier change, null quand il est absent', async () => {
  ecrireTable();
  assert.equal(tableOnet().metiers.length, METIERS.length);
  await new Promise((r) => setTimeout(r, 20));
  ecrireTable(METIERS.slice(0, 2));
  const maintenant = Date.now() / 1000 + 5;
  fs.utimesSync(FICHIER, maintenant, maintenant);
  assert.equal(tableOnet().metiers.length, 2);
  fs.rmSync(FICHIER);
  assert.equal(tableOnet(), null);
});
