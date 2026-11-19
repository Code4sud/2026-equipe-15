// Génère public/rapport-fictif.pdf : un PDF 100 % inventé pour la visionneuse.
// Les PDF sont interdits dans le dépôt (garde-fous) : on le fabrique au lancement.
import { mkdirSync, writeFileSync } from 'node:fs'

const NB_PAGES = 17
const TITRES = {
  1: 'Rapport FICTIF', 4: 'Interets professionnels (fictif)', 5: 'Aptitudes cognitives (fictif)',
  6: 'Personnalite (fictif)', 8: 'Champ des possibles - zone 1 (fictif)', 10: 'Champ des possibles - zone 2 (fictif)',
  12: 'Champ des possibles - zone 3 (fictif)', 14: 'Champ des possibles - zone 4 (fictif)', 17: 'Avertissement (fictif)',
}

const objets = []
const ajouter = (corps) => { objets.push(corps); return objets.length }

const police = ajouter('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
const idPages = objets.length + 1
ajouter(null) // réservé pour /Pages
const kids = []
for (let p = 1; p <= NB_PAGES; p++) {
  const titre = TITRES[p] ?? `Page ${p} (fictive)`
  const flux = [
    'BT /F1 28 Tf 60 740 Td (' + titre + ') Tj ET',
    'BT /F1 14 Tf 60 700 Td (Rdv FICTIF - donnees inventees pour la demo) Tj ET',
    'BT /F1 12 Tf 60 60 Td (Page ' + p + ' sur ' + NB_PAGES + ') Tj ET',
    '0.45 0.36 0.95 RG 4 w 60 680 m 535 680 l S',
  ].join('\n')
  const contenu = ajouter(`<< /Length ${flux.length} >>\nstream\n${flux}\nendstream`)
  kids.push(ajouter(`<< /Type /Page /Parent ${idPages} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${police} 0 R >> >> /Contents ${contenu} 0 R >>`))
}
objets[idPages - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${NB_PAGES} >>`
const catalogue = ajouter(`<< /Type /Catalog /Pages ${idPages} 0 R >>`)

let pdf = '%PDF-1.4\n'
const offsets = []
objets.forEach((corps, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${corps}\nendobj\n` })
const xref = pdf.length
pdf += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`
pdf += offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')
pdf += `trailer\n<< /Size ${objets.length + 1} /Root ${catalogue} 0 R >>\nstartxref\n${xref}\n%%EOF\n`

mkdirSync('public', { recursive: true })
writeFileSync('public/rapport-fictif.pdf', pdf, 'latin1')
