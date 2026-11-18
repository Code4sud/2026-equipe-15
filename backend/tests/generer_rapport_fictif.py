"""Génère un Rapport des Possibles FICTIF pour les tests.

Toutes les données sont inventées (règle du dépôt : « Rdv FICTIF », jamais
de vrai numéro de rendez-vous, aucune donnée personnelle réelle).

Le PDF imite la structure des vrais rapports : page de couverture, sommaire
absent, pages graphiques titrées en première ligne (« MESURE DE… »), radars
en anneaux concentriques + polygone de données, histogramme à étiquettes
pivotées, champ des possibles en « Nème ZONE DE MÉTIERS », page finale de
« travaux expérimentaux ».
"""
from __future__ import annotations

import io
import math

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

# Valeurs fictives du radar RIASEC (pourcentage de l'anneau extérieur = 100)
VALEURS_RIASEC = {
    "Réaliste": 80,
    "Investigateur": 65,
    "Artistique": 90,
    "Social": 55,
    "Entreprenant": 40,
    "Conventionnel": 70,
}

# Valeurs fictives du radar HEXACO
VALEURS_HEXACO = {
    "Émotivité": 40,
    "Extraversion": 75,
    "Agréabilité": 55,
    "Caractère consciencieux": 85,
    "Humilité-honnêteté": 60,
    "Ouverture à l'expérience": 70,
}

# Aptitudes fictives, notées de 0 à 7, dans l'ordre des barres (gauche → droite)
APTITUDES = [
    ("Originalité", 6),
    ("Raisonnement déductif", 5),
    ("Raisonnement inductif", 5),
    ("Flexibilité des catégories", 4),
    ("Facilité avec les nombres", 3),
    ("Mémorisation", 6),
    ("Visualisation", 7),
    ("Attention sélective", 4),
    ("Partage du temps", 5),
]

ZONES = {1: "0 à 6 mois", 2: "3 mois à 2 ans", 3: "1 à 4 ans", 4: "2 à 6 ans", 5: "4 à 10 ans"}

METIERS = [
    (1, "Coiffeur / coiffeuse", "Tu coupes, coiffes et conseilles les clients d'un salon. La formation est courte."),
    (1, "Vendeur / vendeuse en magasin", "Tu accueilles les clients, encaisses et mets en rayon dans un magasin."),
    (2, "Boulanger / boulangère", "Tu fabriques le pain et les viennoiseries, souvent en commençant tôt le matin."),
    (3, "Infirmier / infirmière", "Tu soignes les patients à l'hôpital, après plusieurs années d'études."),
]

AVERTISSEMENT = (
    "« Les résultats présentés dans ce bilan proviennent de travaux expérimentaux. Ce sont des pistes "
    "de réflexion, pas des vérités : ils dépendent de la fatigue et de la motivation du jour du passage, "
    "et ils peuvent évoluer. »"
)


def _decouper(texte: str, largeur: int) -> list[str]:
    """Découpe un texte en lignes d'environ `largeur` caractères."""
    mots, lignes, courante = texte.split(), [], ""
    for mot in mots:
        if len(courante) + len(mot) + 1 > largeur:
            lignes.append(courante)
            courante = mot
        else:
            courante = f"{courante} {mot}".strip()
    if courante:
        lignes.append(courante)
    return lignes


def _dessiner_radar(c: canvas.Canvas, cx: float, cy: float, rayon: float, valeurs: dict[str, float]) -> None:
    """Radar vectoriel façon vrai rapport : anneaux concentriques (grille) +
    polygone de données (contour) + étiquettes horizontales aux axes."""
    labels = list(valeurs)
    n = len(labels)
    angles = [math.radians(90 - i * 360 / n) for i in range(n)]

    def point(angle: float, r: float) -> tuple[float, float]:
        return (cx + r * math.cos(angle), cy + r * math.sin(angle))

    # Anneaux concentriques = l'échelle (l'extérieur vaut 100 %)
    for k in (0.25, 0.5, 0.75, 1.0):
        p = c.beginPath()
        for i, a in enumerate(angles):
            x, y = point(a, rayon * k)
            p.moveTo(x, y) if i == 0 else p.lineTo(x, y)
        p.close()
        c.setStrokeColorRGB(0.75, 0.75, 0.75)
        c.drawPath(p, stroke=1, fill=0)

    # Polygone de données
    p = c.beginPath()
    for i, a in enumerate(angles):
        x, y = point(a, rayon * valeurs[labels[i]] / 100)
        p.moveTo(x, y) if i == 0 else p.lineTo(x, y)
    p.close()
    c.setStrokeColorRGB(0.2, 0.4, 0.8)
    c.setLineWidth(2)
    c.drawPath(p, stroke=1, fill=0)
    c.setLineWidth(1)

    # Étiquettes horizontales aux extrémités des axes
    c.setFillColorRGB(0, 0, 0)
    c.setFont("Helvetica", 9)
    for i, a in enumerate(angles):
        x, y = point(a, rayon + 28)
        c.drawCentredString(x, y, labels[i])


def _dessiner_histogramme(c: canvas.Canvas, aptitudes: list[tuple[str, int]]) -> None:
    """Histogramme vectoriel : 9 barres + étiquettes pivotées (verticales)
    dessous, comme dans le vrai rapport."""
    x0, y_base, largeur, ecart, h_max = 45, 220, 30, 27, 220
    for i, (label, valeur) in enumerate(aptitudes):
        x = x0 + i * (largeur + ecart)
        c.setFillColorRGB(0.2, 0.4, 0.8)
        c.rect(x, y_base, largeur, h_max * valeur / 7, stroke=0, fill=1)
        # étiquette pivotée de 90° sous la barre
        c.setFillColorRGB(0, 0, 0)
        c.setFont("Helvetica", 6.5)
        c.saveState()
        c.translate(x + largeur / 2, y_base - 8)
        c.rotate(-90)
        c.drawString(0, 0, label)
        c.restoreState()


def _dessiner_zone(c: canvas.Canvas, y: float, zone: int) -> float:
    """Dessine une zone du champ des possibles, retourne la verticale courante."""
    suffixe = "ère" if zone == 1 else "ème"
    c.setFillColorRGB(0, 0, 0)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(71, y, f"{zone}{suffixe} ZONE DE MÉTIERS")
    y -= 29
    c.setFont("Helvetica", 11)
    c.drawString(78, y, f"Métiers accessibles en {ZONES[zone]}")
    y -= 21
    metiers_zone = [m for m in METIERS if m[0] == zone]
    if not metiers_zone:
        c.drawString(79, y, "Aucune proposition pour l'instant dans cette zone.")
        y -= 20
    for _, nom, description in metiers_zone:
        c.setFont("Helvetica-Bold", 14)
        c.drawString(106, y, nom)
        y -= 21
        c.setFont("Helvetica", 11)
        for morceau in _decouper(description, 85):
            c.drawString(79, y, morceau)
            y -= 13
        y -= 12
    return y


def generer_pdf_fictif() -> bytes:
    """Retourne le contenu (bytes) d'un PDF de rapport totalement fictif."""
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    largeur, hauteur = A4

    # Page 1 : couverture
    c.setFont("Helvetica-Bold", 20)
    c.drawCentredString(largeur / 2, hauteur - 120, "Ton rapport des possibles")
    c.setFont("Helvetica", 12)
    c.drawCentredString(largeur / 2, hauteur - 160, "Rdv FICTIF")
    c.drawCentredString(largeur / 2, hauteur - 180, "Jeune : Camille FICTIF")
    c.drawCentredString(largeur / 2, hauteur - 200, "Rapport du 18/11/2026")
    c.showPage()

    # Page 2 : mesure d'intérêts professionnels (radar RIASEC)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(71, hauteur - 60, "MESURE D'INTÉRÊTS PROFESSIONNELS")
    _dessiner_radar(c, 300, 400, 130, VALEURS_RIASEC)
    c.showPage()

    # Page 3 : mesure d'aptitudes cognitives (histogramme 0-7)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(71, hauteur - 60, "MESURE D'APTITUDES COGNITIVES")
    _dessiner_histogramme(c, APTITUDES)
    c.showPage()

    # Page 4 : mesure de personnalité (radar HEXACO)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(71, hauteur - 60, "MESURE DE PERSONNALITÉ")
    _dessiner_radar(c, 300, 400, 130, VALEURS_HEXACO)
    c.showPage()

    # Page 5 : champ des possibles (titre + zones 1 à 3)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(71, hauteur - 81, "Ton champ des possibles par zone de métiers")
    y = hauteur - 130
    for zone in (1, 2, 3):
        y = _dessiner_zone(c, y, zone)
        if y < 120 and zone < 3:  # passage à la page suivante
            c.showPage()
            c.setFont("Helvetica-Bold", 22)
            c.drawString(71, hauteur - 81, "Champ des possibles (suite)")
            y = hauteur - 130
    c.showPage()

    # Page 6 : zones 4 et 5
    c.setFont("Helvetica-Bold", 22)
    c.drawString(71, hauteur - 81, "Champ des possibles (suite)")
    y = hauteur - 130
    for zone in (4, 5):
        y = _dessiner_zone(c, y, zone)
    c.showPage()

    # Page 7 : avertissement (travaux expérimentaux)
    c.setFont("Helvetica", 11)
    y = hauteur - 100
    for morceau in _decouper(AVERTISSEMENT, 95):
        c.drawString(71, y, morceau)
        y -= 14
    c.showPage()

    c.save()
    return buffer.getvalue()
