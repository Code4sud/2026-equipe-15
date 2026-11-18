"""Fixtures communes : un PDF de rapport FICTIF et un stockage temporaire."""
from __future__ import annotations

from pathlib import Path

import pytest

from tests.generer_rapport_fictif import generer_pdf_fictif


@pytest.fixture(scope="session")
def pdf_fictif_bytes() -> bytes:
    return generer_pdf_fictif()


@pytest.fixture(scope="session")
def chemin_pdf_fictif(tmp_path_factory, pdf_fictif_bytes) -> Path:
    chemin = tmp_path_factory.mktemp("pdf") / "rapport-fictif.pdf"
    chemin.write_bytes(pdf_fictif_bytes)
    return chemin


@pytest.fixture()
def storage_tmp(tmp_path, monkeypatch) -> Path:
    """Redirige BACKEND_STORAGE vers un dossier temporaire (les vrais
    storage/uploads et storage/outputs ne sont jamais touchés par les tests)."""
    dossier = tmp_path / "storage"
    monkeypatch.setenv("BACKEND_STORAGE", str(dossier))
    return dossier
