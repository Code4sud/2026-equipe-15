"""Génère un Rapport des Possibles FICTIF pour les tests.

Toutes les données sont inventées (règle du dépôt : « Rdv FICTIF », jamais
de vrai numéro de rendez-vous, aucune donnée personnelle réelle).

Structure mimétique du vrai rapport (17 pages dans l'exemple étudié) :
page 1 couverture, page 2 radar RIASEC, page 3 histogramme des aptitudes,
page 4 radar HEXACO, pages 5-6 champ des possibles, page 7 avertissement.
Les graphiques sont dessinés en vectoriel (comme des tracés de PDF), ce
que `report_service` sait relire.
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
    "Émotivité": 45,
    "Extraversion": 70,
    "Agréabilité": 60,
    "Caractère consciencieux": 80,
    "Humilité-honnêteté": 65,
    "Ouverture à l'expérience": 75,
}

# Aptitudes fictives, notées de 0 à 7
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
    "Les résultats présentés dans ce rapport sont expérimentaux. Ce sont des pistes de réflexion, "
    "pas des vérités : ils dépendent de la fatigue, du stress et de la motivation du jour du passage, "
    "et ils peuvent évoluer."
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
    """Dessine un radar vectoriel : anneau extérieur + polygone de données +
    étiquettes aux extrémités des axes."""
    labels = list(valeurs)
    n = len(labels)
    angles = [math.radians(90 - i * 360 / n) for i in range(n)]

    def point(angle: float, r: float) -> tuple[float, float]:
        return (cx + r * math.cos(angle), cy + r * math.sin(angle))

    # Anneau extérieur (l'échelle : 100 % du rayon)
    p = c.beginPath()
    for i, a in enumerate(angles):
        x, y = point(a, rayon)
        p.moveTo(x, y) if i == 0 else p.lineTo(x, y)
    p.close()
    c.setStrokeColorRGB(0.6, 0.6, 0.6)
    c.drawPath(p, stroke=1, fill=0)

    # Polygone de données
    p = c.beginPath()
    for i, a in enumerate(angles):
        x, y = point(a, rayon * valeurs[labels[i]] / 100)
        p.moveTo(x, y) if i == 0 else p.lineTo(x, y)
    p.close()
    c.setFillColorRGB(0.2, 0.4, 0.8)
    c.setFillAlpha(0.3)
    c.drawPath(p, stroke=1, fill=1)
    c.setFillAlpha(1)

    # Étiquettes aux extrémités des axes
    c.setFillColorRGB(0, 0, 0)
    c.setFont("Helvetica", 9)
    for i, a in enumerate(angles):
        x, y = point(a, rayon + 28)
        c.drawCentredString(x, y, labels[i])


def _dessiner_histogramme(c: canvas.Canvas, aptitudes: list[tuple[str, int]]) -> None:
    """Dessine un histogramme vectoriel : 9 barres + étiquettes dessous
    (coupées sur deux lignes pour tenir entre deux barres)."""
    x0, y_base, largeur, ecart, h_max = 45, 220, 30, 27, 220
    for i, (label, valeur) in enumerate(aptitudes):
        x = x0 + i * (largeur + ecart)
        c.setFillColorRGB(0.2, 0.4, 0.8)
        c.rect(x, y_base, largeur, h_max * valeur / 7, stroke=0, fill=1)
        c.setFillColorRGB(0, 0, 0)
        c.setFont("Helvetica", 6.5)
        if " " in label:
            premiere, reste = label.split(" ", 1)
            c.drawCentredString(x + largeur / 2, y_base - 10, premiere)
            c.drawCentredString(x + largeur / 2, y_base - 18, reste)
        else:
            c.drawCentredString(x + largeur / 2, y_base - 10, label)


def generer_pdf_fictif() -> bytes:
    """Retourne le contenu (bytes) d'un PDF de rapport totalement fictif."""
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    largeur, hauteur = A4

    # Page 1 : couverture
    c.setFont("Helvetica-Bold", 20)
    c.drawCentredString(largeur / 2, hauteur - 120, "Rapport des Possibles")
    c.setFont("Helvetica", 12)
    c.drawCentredString(largeur / 2, hauteur - 160, "Rdv FICTIF")
    c.drawCentredString(largeur / 2, hauteur - 180, "Jeune : Camille FICTIF")
    c.drawCentredString(largeur / 2, hauteur - 200, "Date du passage : 18/11/2026")
    c.showPage()

    # Page 2 : intérêts professionnels (radar RIASEC)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(60, hauteur - 60, "Intérêts professionnels (RIASEC)")
    _dessiner_radar(c, 300, 400, 130, VALEURS_RIASEC)
    c.showPage()

    # Page 3 : aptitudes cognitives (histogramme 0-7)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(60, hauteur - 60, "Aptitudes cognitives (notées de 0 à 7)")
    _dessiner_histogramme(c, APTITUDES)
    c.showPage()

    # Page 4 : personnalité (radar HEXACO)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(60, hauteur - 60, "Personnalité (HEXACO)")
    _dessiner_radar(c, 300, 400, 130, VALEURS_HEXACO)
    c.showPage()

    # Pages 5-6 : champ des possibles
    c.setFont("Helvetica-Bold", 16)
    c.drawString(60, hauteur - 60, "Champ des possibles")
    y = hauteur - 100
    for zone in (1, 2, 3, 4, 5):
        c.setFont("Helvetica-Bold", 12)
        c.drawString(60, y, f"Zone {zone} ({ZONES[zone]})")
        y -= 22
        metiers_zone = [m for m in METIERS if m[0] == zone]
        if not metiers_zone:
            c.setFont("Helvetica", 10)
            c.drawString(80, y, "Aucune proposition pour l'instant dans cette zone.")
            y -= 20
        for _, nom, description in metiers_zone:
            c.setFont("Helvetica-Bold", 11)
            c.drawString(80, y, nom)
            y -= 16
            c.setFont("Helvetica", 9)
            for morceau in _decouper(description, 90):
                c.drawString(100, y, morceau)
                y -= 13
            y -= 8
        if zone == 3 or (y < 120 and zone < 5):  # le champ des possibles tient sur deux pages
            c.showPage()
            c.setFont("Helvetica-Bold", 16)
            c.drawString(60, hauteur - 60, "Champ des possibles (suite)")
            y = hauteur - 100
    c.showPage()

    # Page 7 : avertissement
    c.setFont("Helvetica-Bold", 16)
    c.drawString(60, hauteur - 60, "Avertissement")
    c.setFont("Helvetica", 10)
    y = hauteur - 90
    for morceau in _decouper(AVERTISSEMENT, 95):
        c.drawString(60, y, morceau)
        y -= 14
    c.showPage()

    c.save()
    return buffer.getvalue()
