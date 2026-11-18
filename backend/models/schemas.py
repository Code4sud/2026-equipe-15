"""Structures JSON (Pydantic) échangées par l'API.

Règle du sujet : rien n'est inventé. Chaque donnée retournée porte sa
`Source` (page du PDF, section, texte ou tracé vectoriel) pour pouvoir
montrer au jeune d'où vient chaque affirmation.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class Source(BaseModel):
    """D'où vient une donnée extraite du rapport."""

    page: int = Field(..., description="Page du PDF (à partir de 1)")
    section: str = Field(..., description="Section du rapport, ex. « champ des possibles »")
    type: Literal["texte", "trace_vectoriel", "absent"] = Field(
        ..., description="« texte » : lu dans le texte ; « trace_vectoriel » : lu sur le graphique ; « absent » : non lisible automatiquement"
    )
    detail: str = Field("", description="Précision lisible par l'équipe, ex. « anneau extérieur = 100 »")


class Score(BaseModel):
    """Un score lu sur un graphique du rapport (radar ou histogramme)."""

    label: str = Field(..., description="Nom de la dimension, ex. « Réaliste »")
    value: float | None = Field(None, description="Valeur lue ; None si le graphique n'est pas lisible en vectoriel")
    echelle_max: float = Field(..., description="Valeur du maximum de l'échelle (7 pour les aptitudes, 100 pour les radars en relatif)")
    source: Source


class Metier(BaseModel):
    """Un métier du champ des possibles, avec sa zone (temps de préparation)."""

    nom: str
    zone: int = Field(..., ge=1, le=5, description="Zone du rapport : 1 = 0-6 mois … 5 = 4-10 ans")
    description: str = ""
    source: Source


class ReportAnalysis(BaseModel):
    """Résultat complet de l'analyse d'un Rapport des Possibles."""

    id: str = Field(..., description="Identifiant de l'analyse (nom du JSON généré dans storage/outputs)")
    fichier: str = Field(..., description="Nom du PDF déposé")
    nb_pages: int
    rdv: str | None = Field(None, description="Numéro de rendez-vous mentionné dans le rapport, ex. « Rdv FICTIF »")
    sections_detectees: list[str] = Field(default_factory=list)
    interets_riasec: list[Score] = Field(default_factory=list, description="6 profils RIASEC (radar)")
    aptitudes: list[Score] = Field(default_factory=list, description="9 aptitudes cognitives, notées de 0 à 7 (histogramme)")
    personnalite_hexaco: list[Score] = Field(default_factory=list, description="6 dimensions HEXACO (radar)")
    metiers: list[Metier] = Field(default_factory=list, description="Métiers du champ des possibles, avec leur zone")
    avertissement: str | None = Field(None, description="Texte de l'avertissement final du rapport")
    notes: list[str] = Field(
        default_factory=list,
        description="Avertissements d'extraction : ce qui a été lu sur un tracé, ce qui n'a pas pu l'être, etc.",
    )
