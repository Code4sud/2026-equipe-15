"""Extraction sémantique du Rapport des Possibles. // JF

Transforme les pages brutes produites par `pdf_service` en une
`ReportAnalysis` (voir `models/schemas.py`) :

- les sections du rapport : chaque graphique a son titre en première
  ligne de page (« MESURE D'INTÉRÊTS PROFESSIONNELS »…), ce qui permet
  d'éviter le sommaire ;
- les **scores des graphiques**, lus sur les tracés vectoriels du PDF :
  radars = anneaux concentriques + polygone de données, histogramme =
  barres sur une même ligne de base. Chaque score porte sa source
  (page, section, type de lecture) ;
- les métiers du champ des possibles (« 1ère ZONE DE MÉTIERS »…), avec
  leur zone et sa description (« Métiers accessibles en 0 à 6 mois ») ;
- l'avertissement final (page « travaux expérimentaux »).

Si un graphique est une image (pas de tracé vectoriel), on ne devine
rien : les scores sont retournés avec `value=None` et
`source.type="absent"`, à lire avec un modèle de vision (voir
`ai_service` de Julien).
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

# ─── Structure connue du rapport (AGENTS.md, section 4, et les vrais PDF) ────
#
# `titre_en_premiere_ligne` : la section graphique commence par son titre en
# première ligne de page (le sommaire mentionne aussi les titres, au milieu
# de la page : on ne le confond pas avec la vraie page graphique).

SECTIONS: dict[str, dict] = {
    "interets": {
        "titre": "Intérêts professionnels",
        "mots_cles": ["mesure d'interets professionnels", "riasec"],
        "titre_en_premiere_ligne": True,
        "graphique": "radar",
        # Pas d'échelle chiffrée dans le rapport : on lit un relatif, l'anneau
        # extérieur vaut 100.
        "echelle_max": 100.0,
        "labels": ["Réaliste", "Investigateur", "Artistique", "Social", "Entreprenant", "Conventionnel"],
    },
    "aptitudes": {
        "titre": "Aptitudes cognitives",
        "mots_cles": ["mesure d'aptitudes cognitives"],
        "titre_en_premiere_ligne": True,
        "graphique": "histogramme",
        "echelle_max": 7.0,  # notées de 0 à 7 dans le rapport
        # Ordre des barres, de gauche à droite dans le rapport.
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
        "mots_cles": ["mesure de personnalite", "hexaco"],
        "titre_en_premiere_ligne": True,
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
    "champ": {
        "titre": "Champ des possibles",
        "mots_cles": ["champ des possibles", "zone de metiers"],
        "titre_en_premiere_ligne": False,
    },
    "avertissement": {
        "titre": "Avertissement",
        "mots_cles": ["avertissement", "travaux experimentaux", "resultats presentes dans ce bilan"],
        "titre_en_premiere_ligne": False,
    },
}

# Section -> champ de ReportAnalysis qui recevra les scores
CHAMPS_SCORES = {
    "interets": "interets_riasec",
    "aptitudes": "aptitudes",
    "personnalite": "personnalite_hexaco",
}

# « 1ère ZONE DE MÉTIERS », « 2ème ZONE DE MÉTIERS »… (texte normalisé)
ZONE_RE = re.compile(r"(\d+)\s*[a-z]*\s*zone de m")


class Etiquette(NamedTuple):
    """Un texte du graphique regroupé (ex. « Raisonnement déductif »)."""

    texte: str
    x_centre: float
    y_centre: float


# ─── Point d'entrée public ────────────────────────────────────────────────────


def analyser_rapport(chemin: Path, nom_fichier: str, id_analyse: str | None = None) -> ReportAnalysis:
    """Analyse un PDF de Rapport des Possibles et retourne le JSON structuré.

    `chemin` : PDF sur disque (déjà déposé dans `storage/uploads/`, ou un
    fichier local de `prive/` pour les tests).
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
        numeros = sections.get(cle, [])
        if cfg.get("titre_en_premiere_ligne"):
            # Pages dont la première ligne est le titre de la section
            # graphique (évite le sommaire).
            pages_titre = _pages_avec_titre_en_premiere_ligne(pages, cfg)
            numeros = pages_titre or numeros
        scores, note = _lire_scores(pages, numeros, cfg)
        if note:
            notes.append(f"{cfg['titre']} — {note}")
        setattr(analyse, champ, scores)

    analyse.metiers = _extraire_metiers(pages, sections.get("champ", []), notes)
    analyse.avertissement = _extraire_avertissement(pages, sections.get("avertissement", []))
    analyse.notes = notes
    return analyse


# ─── Sections et divers ───────────────────────────────────────────────────────


def detecter_sections(pages: list[PageExtraite]) -> dict[str, list[int]]:
    """Pour chaque section connue, les numéros de pages où elle apparaît
    (mots-clés cherchés dans le texte normalisé de toute la page)."""
    trouvees: dict[str, list[int]] = {}
    for page in pages:
        texte_norm = normaliser(page.texte)
        for cle, cfg in SECTIONS.items():
            if any(mot_cle in texte_norm for mot_cle in cfg["mots_cles"]):
                trouvees.setdefault(cle, []).append(page.numero)
    return trouvees


def _pages_avec_titre_en_premiere_ligne(pages: list[PageExtraite], cfg: dict) -> list[int]:
    """Pages dont la première ligne contient un mot-clé de la section."""
    resultat = []
    for page in pages:
        if page.lignes and any(mot_cle in normaliser(page.lignes[0].texte) for mot_cle in cfg["mots_cles"]):
            resultat.append(page.numero)
    return resultat


def extraire_rdv(pages: list[PageExtraite]) -> str | None:
    """Retourne la mention « Rdv … » du rapport (ex. « Rdv FICTIF » en test)."""
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
    """Lit un radar vectoriel : anneaux concentriques (ils partagent le
    centre du radar), polygone de données (excentré), étiquettes
    horizontales aux extrémités des axes."""
    candidats = [c for c in page.courbes if len(c.points) >= 5 and _est_polygone_radar(c, page)]
    if len(candidats) < 2:
        return [], None

    # Le centre du radar = le centre partagé par le plus de polygones.
    centre = _centre_le_plus_partage(candidats)
    anneaux = [c for c in candidats if _distance(c.centre, centre) <= 5]
    excentres = [c for c in candidats if _distance(c.centre, centre) > 5]
    if not excentres:  # polygone de données symétrique : repli sur le remplissage
        excentres = [c for c in candidats if c.remplie and c not in anneaux]
    if not excentres:
        return [], None

    donnees = max(excentres, key=lambda c: c.plus_loin_du_centre())
    anneau = max(anneaux, key=lambda c: c.plus_loin_du_centre())
    r_max = _distance_moyenne(anneau, centre)
    if r_max < 20:  # anneau dégénéré (point central), illisible
        return [], None

    note = f"lu sur le tracé vectoriel : distance au centre / rayon de l'anneau extérieur × {cfg['echelle_max']:g} (anneau = {cfg['echelle_max']:g})"
    axes = _labels_des_axes(anneau.points, page.lignes, centre, r_max)

    echelle = cfg["echelle_max"]
    scores = []
    for i, (angle, label_brut) in enumerate(axes):
        label = _label_canonique(label_brut, cfg["labels"])
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
    """Lit un histogramme vectoriel : barres posées sur une même ligne de
    base. La barre la plus haute vaut l'échelle max. Les étiquettes sont
    pivotées (verticales) dans le PDF : on associe les libellés connus de
    gauche à droite."""
    barres = [b for b in page.barres if b.hauteur >= 5 and b.largeur <= 120 and b.bas < 0.9 * page.hauteur]
    if not barres:
        return [], None
    bas_max = max(b.bas for b in barres)
    barres = [b for b in barres if bas_max - b.bas <= 3]  # même ligne de base
    barres.sort(key=lambda b: b.x_centre)
    h_max = max(b.hauteur for b in barres)

    echelle = cfg["echelle_max"]
    labels = cfg["labels"]
    note = (
        f"lu sur le tracé vectoriel : hauteur de la barre / barre la plus haute × {echelle:g} (la plus haute = {echelle:g}) ; "
        "étiquettes pivotées dans le PDF, associées par position de gauche à droite"
    )
    scores = []
    for i, barre in enumerate(barres):
        label = labels[i] if i < len(labels) else f"aptitude {i + 1}"
        valeur = round(barre.hauteur / h_max * echelle, 1)
        scores.append(
            Score(
                label=label,
                value=valeur,
                echelle_max=echelle,
                source=Source(page=page.numero, section=cfg["titre"], type="trace_vectoriel", detail=note),
            )
        )
    return scores, note


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


def _est_polygone_radar(c: Courbe, page: PageExtraite) -> bool:
    """Filtre les faux positifs : un polygone de radar fait au moins 25 pt de
    côté, a un rapport largeur/hauteur raisonnable (ni puce de légende, ni
    carte du sommaire), et n'est pas dans le bandeau de pied de page."""
    xs = [p[0] for p in c.points]
    ys = [p[1] for p in c.points]
    largeur = max(xs) - min(xs)
    hauteur = max(ys) - min(ys)
    cx, cy = c.centre
    return largeur >= 25 and hauteur >= 25 and 0.4 <= largeur / hauteur <= 2.5 and cy < 0.85 * page.hauteur


def _centre_le_plus_partage(courbes: list[Courbe], tol: float = 5) -> tuple[float, float]:
    """Centre partagé par le plus de polygones (les anneaux du radar)."""
    clusters: list[list[tuple[float, float]]] = []
    for c in courbes:
        for cluster in clusters:
            if _distance(cluster[0], c.centre) <= tol:
                cluster.append(c.centre)
                break
        else:
            clusters.append([c.centre])
    plus_gros = max(clusters, key=len)
    return (sum(p[0] for p in plus_gros) / len(plus_gros), sum(p[1] for p in plus_gros) / len(plus_gros))


def _labels_des_axes(points: list[tuple[float, float]], lignes: list, centre: tuple[float, float], r_max: float) -> list[tuple[float, str]]:
    """Pour chaque sommet de l'anneau extérieur (un axe), l'étiquette est la
    ligne courte (1 à 4 mots) située dans le cône de l'axe, entre 0,7 et 1,8
    fois le rayon : les libellés d'axes sont des lignes isolées autour du
    radar, ce qui exclut les paragraphes d'introduction de la page.
    Retourne [(angle, label), ...]."""
    angles: list[float] = []
    for p in points:
        a = round(_angle(p, centre), 3)
        if not angles or _ecart_angle(angles[-1], a) > 1e-3:
            angles.append(a)
    seuil = math.pi / max(len(angles), 3) * 1.5  # cône de recherche autour de l'axe

    candidats = []
    for ligne in lignes:
        nb_mots = len(ligne.texte.split())
        if not 1 <= nb_mots <= 4:
            continue
        pos = (ligne.x_centre, ligne.haut)
        d = _distance(pos, centre)
        if 0.7 * r_max <= d <= 1.8 * r_max:
            candidats.append((_angle(pos, centre), ligne.texte))

    # Une étiquette peut être coupée sur deux lignes : on regroupe les lignes
    # dont l'angle est quasi identique (les axes sont espacés de ~1 radian).
    candidats.sort(key=lambda t: t[0])
    groupes: list[list[tuple[float, str]]] = []
    for angle, texte in candidats:
        if groupes and _ecart_angle(groupes[-1][-1][0], angle) <= 0.12:
            groupes[-1].append((angle, texte))
        else:
            groupes.append([(angle, texte)])
    etiquettes = [
        (sum(a for a, _ in g) / len(g), " ".join(t for _, t in g))
        for g in groupes
    ]

    axes = []
    for i, a in enumerate(angles):
        meilleure = None
        for angle_e, texte in etiquettes:
            d = _ecart_angle(angle_e, a)
            if d <= seuil and (meilleure is None or d < meilleure[0]):
                meilleure = (d, texte)
        axes.append((a, meilleure[1] if meilleure else f"axe {i + 1}"))
    return axes


def _point_le_plus_proche(points: list[tuple[float, float]], angle: float, centre: tuple[float, float]) -> tuple[float, float]:
    return min(points, key=lambda p: _ecart_angle(_angle(p, centre), angle))


def _label_canonique(texte_brut: str, labels: list[str]) -> str:
    """Rattache une étiquette lue à son libellé connu (RIASEC, HEXACO…) par
    chevauchement de mots : nettoie les bribes de texte voisin récupérées avec
    l'étiquette, et ne retient que du vocabulaire du rapport."""
    mots = set(normaliser(texte_brut).split())
    meilleur, meilleur_score = texte_brut, 0
    for label in labels:
        score = len(set(normaliser(label).split()) & mots)
        if score > meilleur_score:
            meilleur, meilleur_score = label, score
    return meilleur


def _ordonner_scores(scores: list[Score], labels_connus: list[str]) -> list[Score]:
    """Remet les scores dans l'ordre connu des dimensions du rapport."""
    ordre = {normaliser(label): i for i, label in enumerate(labels_connus)}
    return sorted(scores, key=lambda s: ordre.get(normaliser(s.label), 999))


# ─── Champ des possibles (métiers et zones) ───────────────────────────────────


def _extraire_metiers(pages: list[PageExtraite], numeros_pages: list[int], notes: list[str]) -> list[Metier]:
    """Dans le champ des possibles : une ligne « Nème ZONE DE MÉTIERS » ouvre
    une zone (la ligne suivante donne son libellé « Métiers accessibles en
    … »), une ligne en gras de taille titre (≥ 13 pt) est un nom de métier,
    les lignes suivantes forment sa description."""
    metiers: list[Metier] = []
    zone: int | None = None
    zone_label = ""
    courant: Metier | None = None

    for numero in numeros_pages:
        page = pages[numero - 1]
        lignes = page.lignes
        for i, ligne in enumerate(lignes):
            texte_norm = normaliser(ligne.texte)
            if not texte_norm:
                continue
            m = ZONE_RE.search(texte_norm)
            if m:
                zone = int(m.group(1))
                zone_label = ""
                courant = None
                if i + 1 < len(lignes) and "metiers accessibles en" in normaliser(lignes[i + 1].texte):
                    zone_label = lignes[i + 1].texte.strip()
                continue
            if "champ des possibles" in texte_norm:
                continue
            if ligne.gras and zone is not None and ligne.taille >= 13 and len(ligne.texte) <= 90:
                courant = Metier(
                    nom=ligne.texte,
                    zone=zone,
                    zone_label=zone_label,
                    description="",
                    source=Source(page=numero, section="Champ des possibles", type="texte", detail="ligne en gras du rapport"),
                )
                metiers.append(courant)
            elif courant is not None:
                courant.description = (courant.description + " " + ligne.texte).strip()
            elif zone is not None and ("aucune proposition" in texte_norm or "zone vide" in texte_norm):
                notes.append(f"Zone {zone} (page {numero}) : {ligne.texte}")
    return metiers
