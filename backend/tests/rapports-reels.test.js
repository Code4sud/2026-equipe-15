// Tests sur les vrais rapports du dossier prive/ (ignoré par git).
//
// Ils ne tournent qu'en local, quand prive/ contient des PDF ; sinon ils sont
// sautés (sur GitHub, prive/ n'existe pas). Ils ne vérifient que des
// invariants : AUCUNE valeur, aucun intitulé de métier, aucun extrait tiré
// des rapports ne doit être écrit ici (règle 1 du dépôt).
//
// L'analyse est appelée directement : les PDF ne sont pas copiés dans
// storage/.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyserRapport } from '../src/report/analyzer.js';
import { SECTIONS } from '../src/report/sections.js';
import { construireFaits } from '../src/resume/faits.js';
import { raisonDeRefus } from '../src/resume/controle.js';
import { tableOnet, controlerMetiers } from '../src/onet/table.js';

// Table O*NET de prive/ (null si absente : le contrôle des métiers est alors sauté).
const TABLE = tableOnet();

const PRIVE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'prive');
const pdfs = fs.existsSync(PRIVE) ? fs.readdirSync(PRIVE).filter((f) => f.toLowerCase().endsWith('.pdf')).sort() : [];

if (!pdfs.length) {
  test('rapports réels de prive/', { skip: 'aucun PDF dans prive/' }, () => {});
}

const entier = (v) => Math.abs(v - Math.round(v)) <= 0.05;
const gabaritsVus = {}; // indice du gabarit d'aptitudes -> nombre de rapports

if (pdfs.length) {
  test.after(() => {
    for (const [i, n] of Object.entries(gabaritsVus)) console.log(`# gabarit d'aptitudes ${Number(i) + 1} : ${n} rapport(s)`);
  });
}

for (const fichier of pdfs) {
  test(`rapport réel ${fichier} : invariants de l'extraction`, async () => {
    const a = await analyserRapport(path.join(PRIVE, fichier), fichier);

    assert.ok(a.rdv, 'numéro de rendez-vous non lu');
    assert.ok(a.avertissement, 'avertissement final non lu');

    // Les trois graphiques : 6, 9 et 6 scores, tous lus sur le tracé.
    for (const [champ, nb] of [['interets_riasec', 6], ['aptitudes', 9], ['personnalite_hexaco', 6]]) {
      assert.equal(a[champ].length, nb, `${champ} : nombre de scores`);
      for (const s of a[champ]) {
        assert.notEqual(s.value, null, `${champ} / ${s.label} : valeur absente`);
        assert.equal(s.source.type, 'trace_vectoriel', `${champ} / ${s.label} : source`);
      }
    }

    // Radars : valeurs entre 0 et 100, libellés tous différents, encadrés
    // roses lus, et cohérents avec le tracé (un point fort n'est jamais
    // plus bas qu'une autre dimension).
    for (const champ of ['interets_riasec', 'personnalite_hexaco']) {
      const scores = a[champ];
      assert.equal(new Set(scores.map((s) => s.label)).size, 6, `${champ} : libellés en double`);
      for (const s of scores) assert.ok(s.value >= 0 && s.value <= 100.5, `${champ} / ${s.label} : hors échelle`);
      assert.ok(scores.every((s) => typeof s.point_fort === 'boolean'), `${champ} : point_fort non lu`);
      const forts = scores.filter((s) => s.point_fort);
      const autres = scores.filter((s) => !s.point_fort);
      assert.ok(forts.length >= 1, `${champ} : aucun point fort`);
      const minFort = Math.min(...forts.map((s) => s.value));
      const maxAutre = Math.max(...autres.map((s) => s.value));
      assert.ok(minFort >= maxAutre - 0.5, `${champ} : point fort plus bas qu'une autre dimension`);
    }

    // Aptitudes : valeurs entières entre 0 et 7 (une valeur non entière
    // signale une lecture fausse de l'échelle).
    for (const s of a.aptitudes) {
      assert.ok(entier(s.value), `aptitude ${s.label} : valeur non entière`);
      assert.ok(s.value >= 0 && s.value <= 7, `aptitude ${s.label} : hors de 0-7`);
    }
    // Les 9 libellés sont exactement ceux de l'un des gabarits connus, dans
    // l'ordre des barres : jamais un libellé d'un gabarit posé sur l'autre.
    const labels = a.aptitudes.map((s) => s.label);
    const gabarit = SECTIONS.aptitudes.gabarits.findIndex((g) => g.join('|') === labels.join('|'));
    assert.ok(gabarit >= 0, 'aptitudes : libellés hors des gabarits connus');
    gabaritsVus[gabarit] = (gabaritsVus[gabarit] || 0) + 1;

    // Champ des possibles : zones 1 à 5, 5 métiers au plus par zone, chaque
    // métier a une description (un nom sur deux lignes n'est pas coupé en
    // deux métiers), identifiants uniques.
    assert.ok(a.metiers.length > 0, 'aucun métier lu');
    for (let zone = 1; zone <= 5; zone++) {
      const n = a.metiers.filter((m) => m.zone === zone).length;
      assert.ok(n <= 5, `zone ${zone} : ${n} métiers`);
    }
    for (const m of a.metiers) {
      assert.ok(m.zone >= 1 && m.zone <= 5, `${m.id} : zone hors de 1-5`);
      assert.ok(m.description, `${m.id} : métier sans description`);
      assert.ok(m.source.page >= 1, `${m.id} : source`);
    }
    assert.equal(new Set(a.metiers.map((m) => m.id)).size, a.metiers.length, 'identifiants de métiers en double');

    // Chaque métier du rapport se retrouve dans la table O*NET par son
    // intitulé (sur un texte normalisé), avec un code O*NET valide.
    if (TABLE) {
      const { metiers, controle } = controlerMetiers(a.metiers, TABLE);
      assert.equal(controle.introuvables.length, 0, `${controle.introuvables.length} métier(s) introuvable(s) dans la table O*NET`);
      for (const m of metiers) {
        const codes = m.onet.code ? [m.onet.code] : m.onet.codes;
        assert.ok(codes.every((c) => /^\d{2}-\d{4}\.\d{2}$/.test(c)), `${m.id} : code O*NET`);
      }
    }

    // Aucune note d'extraction signalant une lecture douteuse.
    const douteuses = a.notes.filter((n) =>
      /non entières|au lieu de|non trouvés|aucun tracé|reconnu par sa forme|aucun gabarit|pas lisibles/.test(n)
    );
    assert.deepEqual(douteuses, [], 'notes de lecture douteuse');

    // Chaque dimension des radars a l'explication écrite sous son encadré.
    for (const s of [...a.interets_riasec, ...a.personnalite_hexaco]) {
      assert.ok(s.description && s.description.length > 30, `${s.label} : explication non lue`);
    }
    assert.ok(a.avertissement_page >= 1 && a.avertissement_page <= a.nb_pages, 'page de l’avertissement');

    // Résumé : faits avec une page du rapport, sans vocabulaire de score, et
    // phrases du repli conformes au contrôle — sans onboarding, et avec un
    // onboarding qui choisit le premier métier de chaque zone.
    const favoris = {};
    for (const m of a.metiers) favoris[m.zone] ??= m.id;
    const interets_metiers = Object.fromEntries(a.metiers.map((m, i) => [m.id, i % 2 ? 'interesse' : 'non']));
    for (const onboarding of [null, { favoris, interets_metiers }]) {
      const { faits } = construireFaits(a, onboarding);
      assert.ok(faits.length >= 4, 'moins de 4 faits pour le résumé');
      for (const f of faits) {
        assert.ok(f.page >= 1 && f.page <= a.nb_pages, `${f.id} : page hors du rapport`);
        assert.doesNotMatch(f.texte, /score|faible/i, `${f.id} : vocabulaire de score transmis`);
        assert.equal(raisonDeRefus(f.phrase, [f]), null, `${f.id} : phrase du repli refusée`);
      }
    }
  });
}
