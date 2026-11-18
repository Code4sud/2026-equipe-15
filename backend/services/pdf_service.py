"""Extraction de bas niveau des PDF du Rapport des Possibles. // JF

Responsabilité unique de ce module : lire le PDF et rendre son contenu
brut, sans aucune interprétation sémantique (c'est le rôle de
`report_service`) :

- le texte de chaque page ;
- les lignes avec leur position et leur style (gras) ;
- les mots avec leur position (étiquettes des graphiques) ;
- les tracés vectoriels fermés (polygones des radars) ;
- les rectangles pleins (barres des histogrammes).

Un PDF déposé est d'abord sauvé dans `storage/uploads/` (jamais
versionné) : tout ce module lit ensuite le fichier sur disque.
"""
from __future__ import annotations

import math
import os
import re
import unicodedata
import uuid
from dataclasses import dataclass, field
from pathlib import Path

import pdfplumber

# Taille maximale d'un PDF accepté. 20 Mo par défaut, configurable par
# variable d'environnement, et de toute façon sous les 50 Mo interdits
# dans le dépôt.
MAX_UPLOAD_OCTETS = int(os.environ.get("MAX_UPLOAD_MO", "20")) * 1024 * 1024

DOSSIER_UPLOADS = Path(__file__).resolve().parents[1] / "storage" / "uploads"


# ─── Objets extraits d'une page ───────────────────────────────────────────────


@dataclass
class Mot:
    """Un mot et sa boîte, en coordonnées pdfplumber (origine en haut à
    gauche de la page)."""

    texte: str
    x0: float
    x1: float
    y_centre: float

    @property
    def x_centre(self) -> float:
        return (self.x0 + self.x1) / 2


@dataclass
class Ligne:
    """Une ligne de texte reconstituée, avec sa position horizontale et son
    style dominant."""

    texte: str
    haut: float  # position verticale (origine en haut)
    x0: float
    x1: float
    gras: bool
    taille: float

    @property
    def x_centre(self) -> float:
        return (self.x0 + self.x1) / 2


@dataclass
class Courbe:
    """Un tracé vectoriel fermé (ex. le polygone d'un radar)."""

    points: list[tuple[float, float]]
    remplie: bool

    @property
    def centre(self) -> tuple[float, float]:
        xs = [p[0] for p in self.points]
        ys = [p[1] for p in self.points]
        return (sum(xs) / len(xs), sum(ys) / len(ys))

    def plus_loin_du_centre(self) -> float:
        cx, cy = self.centre
        return max(((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 for x, y in self.points)


@dataclass
class Barre:
    """Un rectangle plein (ex. une barre d'histogramme)."""

    x0: float
    x1: float
    haut: float
    bas: float

    @property
    def largeur(self) -> float:
        return self.x1 - self.x0

    @property
    def hauteur(self) -> float:
        return self.bas - self.haut

    @property
    def x_centre(self) -> float:
        return (self.x0 + self.x1) / 2


@dataclass
class PageExtraite:
    """Tout ce qui a été lu sur une page du PDF."""

    numero: int  # à partir de 1
    texte: str
    lignes: list[Ligne] = field(default_factory=list)
    mots: list[Mot] = field(default_factory=list)
    courbes: list[Courbe] = field(default_factory=list)
    barres: list[Barre] = field(default_factory=list)


# ─── Upload ───────────────────────────────────────────────────────────────────


def sauvegarder_upload(contenu: bytes, dossier: Path | None = None, nom_original: str = "rapport.pdf") -> Path:
    """Sauve un PDF déposé dans `storage/uploads/` sous un nom unique.

    Lève `ValueError` si le fichier n'est pas un PDF ou dépasse la taille
    maximale autorisée.
    """
    if not nom_original.lower().endswith(".pdf"):
        raise ValueError(f"Seuls les PDF sont acceptés (reçu : {nom_original!r})")
    if len(contenu) > MAX_UPLOAD_OCTETS:
        raise ValueError(f"PDF trop volumineux : {len(contenu) / 1024 / 1024:.1f} Mo (max {MAX_UPLOAD_OCTETS / 1024 / 1024:.0f} Mo)")
    if not contenu.startswith(b"%PDF"):
        raise ValueError("Le fichier ne commence pas par %PDF : ce n'est pas un PDF valide")

    dossier = dossier or DOSSIER_UPLOADS
    dossier.mkdir(parents=True, exist_ok=True)
    chemin = dossier / f"{uuid.uuid4().hex}.pdf"
    chemin.write_bytes(contenu)
    return chemin


# ─── Lecture du PDF ───────────────────────────────────────────────────────────


def extraire_pages(chemin: Path) -> list[PageExtraite]:
    """Lit le PDF page par page : texte, lignes stylées, mots, tracés, barres."""
    pages: list[PageExtraite] = []
    with pdfplumber.open(str(chemin)) as pdf:
        for numero, page in enumerate(pdf.pages, start=1):
            pages.append(
                PageExtraite(
                    numero=numero,
                    texte=page.extract_text() or "",
                    lignes=_extraire_lignes(page.chars),
                    mots=_extraire_mots(page.extract_words()),
                    courbes=_extraire_courbes(page.curves),
                    barres=_extraire_barres(page.rects),
                )
            )
    return pages


def _extraire_mots(mots_pdfplumber: list[dict]) -> list[Mot]:
    return [
        Mot(texte=m["text"], x0=m["x0"], x1=m["x1"], y_centre=(m["top"] + m["bottom"]) / 2)
        for m in mots_pdfplumber
    ]


def _extraire_lignes(chars: list[dict]) -> list[Ligne]:
    """Regroupe les caractères en lignes : même verticale (à 2 pt près) ET
    écart horizontal faible (moins d'environ 0,6 fois la taille de police,
    soit un espace), sinon c'est une colonne ou un graphique voisin."""
    lignes: list[Ligne] = []
    for c in sorted(chars, key=lambda c: (round(c["top"] / 2), c["x0"])):
        taille = c.get("size", 0)
        if lignes and abs(lignes[-1].haut - c["top"]) <= 2 and c["x0"] - lignes[-1].x1 <= max(2.0, 0.6 * taille):
            ligne = lignes[-1]
            ligne.texte += c["text"]
            ligne.x0 = min(ligne.x0, c["x0"])
            ligne.x1 = max(ligne.x1, c["x1"])
            ligne.gras = ligne.gras or "Bold" in c.get("fontname", "")
            ligne.taille = max(ligne.taille, taille)
        else:
            lignes.append(
                Ligne(texte=c["text"], haut=c["top"], x0=c["x0"], x1=c["x1"], gras="Bold" in c.get("fontname", ""), taille=taille)
            )
    for ligne in lignes:
        ligne.texte = ligne.texte.strip()
    return [l for l in lignes if l.texte]


def _extraire_courbes(courbes_pdfplumber: list[dict]) -> list[Courbe]:
    """Garde les tracés d'au moins 3 points (polygones des radars). Le point
    de fermeture, s'il est répété, est retiré."""
    courbes = []
    for c in courbes_pdfplumber:
        brut = c.get("pts") or c.get("points") or []
        points = [(p[0], p[1]) for p in brut if p and p[0] is not None and p[1] is not None]
        if len(points) >= 4 and math.hypot(points[0][0] - points[-1][0], points[0][1] - points[-1][1]) < 1e-6:
            points = points[:-1]  # point de fermeture
        if len(points) >= 3:
            courbes.append(Courbe(points=points, remplie=bool(c.get("fill"))))
    return courbes


def _extraire_barres(rects_pdfplumber: list[dict]) -> list[Barre]:
    """Garde les rectangles pleins (barres des histogrammes)."""
    return [Barre(x0=r["x0"], x1=r["x1"], haut=r["top"], bas=r["bottom"]) for r in rects_pdfplumber if r.get("fill")]


# ─── Normalisation du texte ───────────────────────────────────────────────────


def normaliser(texte: str) -> str:
    """Minuscules, sans accents, espaces réduits : sert à comparer des titres
    et des mots-clés. L'extraction PDF perd parfois les doubles « l »
    (« travaile »), on ne corrige pas le texte brut : on compare sur la
    version normalisée."""
    decompose = unicodedata.normalize("NFKD", texte.lower())
    sans_accents = "".join(c for c in decompose if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", sans_accents).strip()
