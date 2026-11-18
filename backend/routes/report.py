"""Routes /report : dépôt d'un Rapport des Possibles (PDF) et analyse. // JF

POST /report/upload      : dépose un PDF (multipart), sauvegarde l'analyse
                           JSON dans `storage/outputs/` et la retourne
GET  /report             : liste les identifiants d'analyses générées
GET  /report/{id}        : relit une analyse complète
GET  /report/{id}/scores : uniquement les scores des graphiques, avec leurs
                           sources (page, section, type de lecture)

Le dossier de stockage se règle par la variable d'environnement
`BACKEND_STORAGE` (défaut : `backend/storage`) ; les tests l'écrasent.
"""
from __future__ import annotations

import os
import re
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from models.schemas import ReportAnalysis
from services import pdf_service, report_service

router = APIRouter(prefix="/report", tags=["report"])

# Identifiants d'analyse = 32 caractères hexadécimaux (uuid4), pour éviter
# toute lecture de fichier hors de storage/outputs.
_ID_VALIDE = re.compile(r"[0-9a-f]{32}")


def _dossiers_stockage() -> tuple[Path, Path]:
    base = Path(os.environ.get("BACKEND_STORAGE", Path(__file__).resolve().parents[1] / "storage"))
    return base / "uploads", base / "outputs"


def _chemin_analyse(analysis_id: str) -> Path:
    if not _ID_VALIDE.fullmatch(analysis_id):
        raise HTTPException(status_code=404, detail="Analyse inconnue")
    chemin = _dossiers_stockage()[1] / f"{analysis_id}.json"
    if not chemin.is_file():
        raise HTTPException(status_code=404, detail="Analyse inconnue")
    return chemin


@router.post("/upload", response_model=ReportAnalysis, status_code=201)
async def uploader_rapport(fichier: UploadFile = File(...)):
    """Reçoit un PDF, l'analyse, sauvegarde le JSON et le retourne."""
    contenu = await fichier.read()
    nom = fichier.filename or "rapport.pdf"
    try:
        chemin_pdf = pdf_service.sauvegarder_upload(contenu, _dossiers_stockage()[0], nom)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    analyse = report_service.analyser_rapport(chemin_pdf, nom)

    outputs = _dossiers_stockage()[1]
    outputs.mkdir(parents=True, exist_ok=True)
    (outputs / f"{analyse.id}.json").write_text(analyse.model_dump_json(indent=2), encoding="utf-8")
    return analyse


@router.get("", response_model=list[str])
def lister_analyses() -> list[str]:
    """Identifiants des analyses déjà générées (fichiers JSON de storage/outputs)."""
    outputs = _dossiers_stockage()[1]
    if not outputs.is_dir():
        return []
    return sorted(p.stem for p in outputs.glob("*.json"))


@router.get("/{analysis_id}", response_model=ReportAnalysis)
def lire_analyse(analysis_id: str) -> ReportAnalysis:
    chemin = _chemin_analyse(analysis_id)
    return ReportAnalysis.model_validate_json(chemin.read_text(encoding="utf-8"))


@router.get("/{analysis_id}/scores")
def lire_scores(analysis_id: str) -> dict:
    """Les scores des trois graphiques du rapport, avec leurs sources."""
    analyse = lire_analyse(analysis_id)
    return {
        "interets_riasec": analyse.interets_riasec,
        "aptitudes": analyse.aptitudes,
        "personnalite_hexaco": analyse.personnalite_hexaco,
    }
