"""Extraction sémantique du Rapport des Possibles. // JF

Transforme les pages brutes produites par `pdf_service` en une
`ReportAnalysis` (voir `models/schemas.py`) :

- les sections du rapport (intérêts, aptitudes, personnalité, champ des
  possibles, avertissement) ;
- les **scores des graphiques**, lus sur les tracés vectoriels du PDF
  (polygone des radars, barres des histogrammes) quand le texte ne les
  donne pas — chaque score porte sa source (page, section, type de lecture) ;
- les métiers du champ des possibles, avec leur zone ;
- l'avertissement final.

Si un graphique est une image (pas de tracé vectoriel), on ne devine rien :
les scores sont retournés avec `value=None` et `source.type="absent"`, à
lire avec un modèle de vision (voir `ai_service` de Julien).
"""
from __future__ import annotations

import math
import re
import uuid
from pathlib import Path
from typing import NamedTuple

from models.schemas import Metier, ReportAnalysis, Score, Source
from services import pdf_service
from services.pdf_service import Courbe, PageExtraite, normaliser

# ─── Ce qu'on connaît de la structure du rapport (voir AGENTS.md, section 4) ──

SECTIONS: dict[str, dict] = {
    "interets": {
        "titre": "Intérêts professionnels",
        "mots_cles": ["riasec", "interets professionnels"],
        "graphique": "radar",
        # Pas d'échelle chiffrée dans le rapport : on lit un relatif, l'anneau
        # extérieur vaut 100.
        "echelle_max": 100.0,
        "labels": ["Réaliste", "Investigateur", "Artistique", "Social", "Entreprenant", "Conventionnel"],
    },
    "aptitudes": {
        "titre": "Aptitudes cognitives",
        "mots_cles": ["aptitudes cognitives"],
        "graphique": "histogramme",
        "echelle_max": 7.0,  # notées de 0 à 7 dans le rapport
        "labels": [
            "Originalité",
            "Raisonnement déductif",
            "Raisonnement inductif",
            "Flexibilité des catégories",
            "Facilité avec les nombres",
            "Mémorisation",
            "Visualisation",
            "Attention sélective",
            "Partage du temps",
        ],
    },
    "personnalite": {
        "titre": "Personnalité",
        "mots_cles": ["hexaco", "personnalite"],
        "graphique": "radar",
        "echelle_max": 100.0,
        "labels": [
            "Émotivité",
            "Extraversion",
            "Agréabilité",
            "Caractère consciencieux",
            "Humilité-honnêteté",
            "Ouverture à l'expérience",
        ],
    },
    "champ": {"titre": "Champ des possibles", "mots_cles": ["champ des possibles"]},
    "avertissement": {"titre": "Avertissement", "mots_cles": ["avertissement"]},
}

# Section -> champ de ReportAnalysis qui recevra les scores
CHAMPS_SCORES = {
    "interets": "interets_riasec",
    "aptitudes": "aptitudes",
    "personnalite": "personnalite_hexaco",
}


class Etiquette(NamedTuple):
    """Un texte du graphique regroupé (ex. « Raisonnement déductif »)."""

    texte: str
    x_centre: float
    y_centre: float


# ─── Point d'entrée public ────────────────────────────────────────────────────


def analyser_rapport(chemin: Path, nom_fichier: str, id_analyse: str | None = None) -> ReportAnalysis:
    """Analyse un PDF de Rapport des Possibles et retourne le JSON structuré.

    `chemin` : PDF sur disque (déjà déposé dans `storage/uploads/`).
    """
    pages = pdf_service.extraire_pages(chemin)
    sections = detecter_sections(pages)
    notes: list[str] = []

    analyse = ReportAnalysis(
        id=id_analyse or uuid.uuid4().hex,
        fichier=nom_fichier,
        nb_pages=len(pages),
        rdv=extraire_rdv(pages),
        sections_detectees=[SECTIONS[cle]["titre"] for cle in SECTIONS if cle in sections],
    )

    for cle, champ in CHAMPS_SCORES.items():
        cfg = SECTIONS[cle]
        scores, note = _lire_scores(pages, sections.get(cle, []), cfg)
        if note:
            notes.append(f"{cfg['titre']} — {note}")
        setattr(analyse, champ, scores)

    analyse.metiers = _extraire_metiers(pages, sections.get("champ", []), notes)
    analyse.avertissement = _extraire_avertissement(pages, sections.get("avertissement", []))
    analyse.notes = notes
    return analyse


# ─── Sections et divers ───────────────────────────────────────────────────────


def detecter_sections(pages: list[PageExtraite]) -> dict[str, list[int]]:
    """Retourne, pour chaque section connue, les numéros de pages où elle
    apparaît (détection par mots-clés sur le texte normalisé)."""
    trouvees: dict[str, list[int]] = {}
    for page in pages:
        texte_norm = normaliser(page.texte)
        for cle, cfg in SECTIONS.items():
            if any(mot_cle in texte_norm for mot_cle in cfg["mots_cles"]):
                trouvees.setdefault(cle, []).append(page.numero)
    return trouvees


def extraire_rdv(pages: list[PageExtraite]) -> str | None:
    """Retourne la mention « Rdv … » du rapport, ex. « Rdv FICTIF » (tests)."""
    for page in pages:
        m = re.search(r"Rdv\s*n?°?\s*[A-Za-z0-9-]+", page.texte)
        if m:
            return m.group(0).strip()
    return None


def _extraire_avertissement(pages: list[PageExtraite], numeros: list[int]) -> str | None:
    if not numeros:
        return None
    return "\n".join(pages[n - 1].texte.strip() for n in numeros).strip() or None


# ─── Scores des graphiques ────────────────────────────────────────────────────


def _lire_scores(pages: list[PageExtraite], numeros_pages: list[int], cfg: dict) -> tuple[list[Score], str | None]:
    """Lit les scores sur la première page de la section qui contient un
    graphique. Repli honnête : labels connus, `value=None`, type « absent »."""
    for numero in numeros_pages:
        page = pages[numero - 1]
        if cfg["graphique"] == "radar":
            scores, note = _lire_radar(page, cfg)
        else:
            scores, note = _lire_histogramme(page, cfg)
        if scores:
            return scores, note

    # Aucun tracé vectoriel trouvé : on ne devine pas les valeurs.
    page_ref = numeros_pages[0] if numeros_pages else 1
    source = Source(
        page=page_ref,
        section=cfg["titre"],
        type="absent",
        detail="Scores présents sous forme d'image dans le PDF, non lisibles en vectoriel : à lire avec un modèle de vision (ai_service).",
    )
    scores = [Score(label=label, value=None, echelle_max=cfg["echelle_max"], source=source) for label in cfg["labels"]]
    return scores, "aucun tracé vectoriel trouvé, valeurs non extraites automatiquement"


def _lire_radar(page: PageExtraite, cfg: dict) -> tuple[list[Score], str | None]:
    """Lit un radar : anneau extérieur (échelle), polygone de données, et
    étiquettes placées aux extrémités des axes."""
    polygones = [c for c in page.courbes if len(c.points) >= 5]
    if not polygones:
        return [], None

    remplis = [c for c in polygones if c.remplie]
    if remplis:
        donnees = max(remplis, key=lambda c: c.plus_loin_du_centre())
        autres = [c for c in polygones if c is not donnees]
        anneau = max(autres, key=lambda c: c.plus_loin_du_centre()) if autres else None
    else:
        anneau = max(polygones, key=lambda c: c.plus_loin_du_centre())
        reste = [c for c in polygones if c is not anneau]
        donnees = max(reste, key=lambda c: c.plus_loin_du_centre()) if reste else anneau

    centre = anneau.centre if anneau is not None and anneau is not donnees else donnees.centre
    if anneau is not None and anneau is not donnees:
        r_max = _distance_moyenne(anneau, centre)
        note = f"lu sur le tracé vectoriel : distance au centre / rayon de l'anneau extérieur × {cfg['echelle_max']:g} (anneau = {cfg['echelle_max']:g})"
    else:
        r_max = donnees.plus_loin_du_centre()
        note = "anneau extérieur non détecté : échelle relative au point le plus éloigné du centre"

    etiquettes = _etiquettes_radar(page.mots, centre, r_max)
    axes = _associer_aux_etiquettes(anneau.points if anneau is not None and anneau is not donnees else donnees.points, etiquettes, centre)

    echelle = cfg["echelle_max"]
    scores = []
    for i, (angle, label) in enumerate(axes):
        point = _point_le_plus_proche(donnees.points, angle, centre)
        valeur = round(_distance(point, centre) / r_max * echelle, 1)
        scores.append(
            Score(
                label=label,
                value=valeur,
                echelle_max=echelle,
                source=Source(page=page.numero, section=cfg["titre"], type="trace_vectoriel", detail=note),
            )
        )
    return _ordonner_scores(scores, cfg["labels"]), note


def _lire_histogramme(page: PageExtraite, cfg: dict) -> tuple[list[Score], str | None]:
    """Lit un histogramme : barres posées sur une même ligne de base,
    étiquettes sous les barres. La barre la plus haute vaut l'échelle max."""
    barres = [b for b in page.barres if b.hauteur >= 5 and b.largeur <= 120]
    if not barres:
        return [], None
    bas_max = max(b.bas for b in barres)
    barres = [b for b in barres if bas_max - b.bas <= 3]  # même ligne de base
    barres.sort(key=lambda b: b.x_centre)
    h_max = max(b.hauteur for b in barres)

    etiquettes = _etiquettes_histogramme(page.lignes, bas_max)
    echelle = cfg["echelle_max"]
    note = f"lu sur le tracé vectoriel : hauteur de la barre / barre la plus haute × {echelle:g} (la plus haute = {echelle:g})"
    scores = []
    for i, barre in enumerate(barres):
        label = _etiquette_la_plus_proche(etiquettes, barre.x_centre) or f"aptitude {i + 1}"
        valeur = round(barre.hauteur / h_max * echelle, 1)
        scores.append(
            Score(
                label=label,
                value=valeur,
                echelle_max=echelle,
                source=Source(page=page.numero, section=cfg["titre"], type="trace_vectoriel", detail=note),
            )
        )
    return _ordonner_scores(scores, cfg["labels"]), note


# ─── Géométrie des graphiques ─────────────────────────────────────────────────


def _distance(p: tuple[float, float], centre: tuple[float, float]) -> float:
    return math.hypot(p[0] - centre[0], p[1] - centre[1])


def _distance_moyenne(courbe: Courbe, centre: tuple[float, float]) -> float:
    return sum(_distance(p, centre) for p in courbe.points) / len(courbe.points)


def _angle(p: tuple[float, float], centre: tuple[float, float]) -> float:
    return math.atan2(p[1] - centre[1], p[0] - centre[0])


def _ecart_angle(a: float, b: float) -> float:
    """Distance angulaire entre deux angles, modulo 2π."""
    d = abs(a - b) % (2 * math.pi)
    return min(d, 2 * math.pi - d)


def _etiquettes_radar(mots: list, centre: tuple[float, float], r_max: float, tol_angle: float = 0.35) -> list[tuple[float, str]]:
    """Regroupe les mots situés autour du radar (entre 0,7 et 1,8 fois le
    rayon) par angle : chaque groupe = l'étiquette d'un axe. La tolérance
    doit rester inférieure à la moitié de l'angle entre deux axes (π/6 pour
    un hexagone), sinon deux étiquettes voisines fusionneraient."""
    cx, cy = centre
    candidats = []
    for mot in mots:
        d = math.hypot(mot.x_centre - cx, mot.y_centre - cy)
        if 0.7 * r_max <= d <= 1.8 * r_max:
            candidats.append((_angle((mot.x_centre, mot.y_centre), centre), mot))
    candidats.sort(key=lambda t: t[0])

    groupes: list[tuple[list[float], list]] = []
    for angle, mot in candidats:
        if groupes and _ecart_angle(groupes[-1][0][-1], angle) <= tol_angle:
            groupes[-1][0].append(angle)
            groupes[-1][1].append(mot)
        else:
            groupes.append(([angle], [mot]))

    etiquettes = []
    for angles, mots_groupe in groupes:
        texte = " ".join(m.texte for m in sorted(mots_groupe, key=lambda m: m.x0))
        etiquettes.append((sum(angles) / len(angles), texte))
    return etiquettes


def _associer_aux_etiquettes(points: list[tuple[float, float]], etiquettes: list[tuple[float, str]], centre: tuple[float, float]) -> list[tuple[float, str]]:
    """Pour chaque sommet de l'anneau (un par axe), trouve l'étiquette la
    plus proche en angle. Retourne [(angle, label), ...]."""
    angles: list[float] = []
    for p in points:
        a = round(_angle(p, centre), 3)
        if not angles or _ecart_angle(angles[-1], a) > 1e-3:
            angles.append(a)
    seuil = math.pi / max(len(angles), 3) * 1.5
    axes = []
    for i, a in enumerate(angles):
        meilleure = None
        for angle_e, texte in etiquettes:
            d = _ecart_angle(a, angle_e)
            if d <= seuil and (meilleure is None or d < meilleure[0]):
                meilleure = (d, texte)
        axes.append((a, meilleure[1] if meilleure else f"axe {i + 1}"))
    return axes


def _point_le_plus_proche(points: list[tuple[float, float]], angle: float, centre: tuple[float, float]) -> tuple[float, float]:
    return min(points, key=lambda p: _ecart_angle(_angle(p, centre), angle))


def _etiquettes_histogramme(lignes: list, bas_max: float, tol_x: float = 30, tol_y: float = 20) -> list[Etiquette]:
    """Regroupe les lignes situées sous les barres en étiquettes : une
    étiquette = une ou deux lignes centrées au même endroit (étiquette
    éventuellement coupée sur deux lignes)."""
    candidats = sorted((l for l in lignes if l.haut > bas_max + 2), key=lambda l: l.x_centre)
    groupes: list[list] = []
    for ligne in candidats:
        for groupe in groupes:
            proche = any(abs(ligne.x_centre - autre.x_centre) <= tol_x and abs(ligne.haut - autre.haut) <= tol_y for autre in groupe)
            if proche:
                groupe.append(ligne)
                break
        else:
            groupes.append([ligne])

    etiquettes = []
    for groupe in groupes:
        groupe_trié = sorted(groupe, key=lambda l: l.haut)
        texte = " ".join(l.texte for l in groupe_trié)
        x_centre = sum(l.x_centre for l in groupe) / len(groupe)
        y_centre = sum(l.haut for l in groupe) / len(groupe)
        etiquettes.append(Etiquette(texte=texte, x_centre=x_centre, y_centre=y_centre))
    return etiquettes


def _etiquette_la_plus_proche(etiquettes: list[Etiquette], x: float) -> str | None:
    if not etiquettes:
        return None
    return min(etiquettes, key=lambda e: abs(e.x_centre - x)).texte


def _ordonner_scores(scores: list[Score], labels_connus: list[str]) -> list[Score]:
    """Remet les scores dans l'ordre connu des dimensions du rapport."""
    ordre = {normaliser(label): i for i, label in enumerate(labels_connus)}
    return sorted(scores, key=lambda s: ordre.get(normaliser(s.label), 999))


# ─── Champ des possibles (métiers et zones) ───────────────────────────────────


def _extraire_metiers(pages: list[PageExtraite], numeros_pages: list[int], notes: list[str]) -> list[Metier]:
    """Dans le champ des possibles : une ligne « Zone N (…) » ouvre une zone,
    une ligne en gras courte est un nom de métier, les lignes suivantes
    forment sa description."""
    metiers: list[Metier] = []
    zone: int | None = None
    courant: Metier | None = None

    for numero in numeros_pages:
        page = pages[numero - 1]
        for ligne in page.lignes:
            texte_norm = normaliser(ligne.texte)
            if not texte_norm:
                continue
            m = re.match(r"zone\s*([1-5])\b", texte_norm)
            if m:
                zone = int(m.group(1))
                courant = None
                continue
            if "champ des possibles" in texte_norm:
                continue
            if ligne.gras and zone is not None and len(ligne.texte) <= 90:
                courant = Metier(
                    nom=ligne.texte,
                    zone=zone,
                    description="",
                    source=Source(page=numero, section="Champ des possibles", type="texte", detail="ligne en gras du rapport"),
                )
                metiers.append(courant)
            elif courant is not None:
                courant.description = (courant.description + " " + ligne.texte).strip()
            elif zone is not None:
                notes.append(f"Zone {zone} (page {numero}) : {ligne.texte}")
    return metiers
