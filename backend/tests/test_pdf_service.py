"""Tests de services/pdf_service.py sur le PDF fictif."""
from __future__ import annotations

import pytest

from services import pdf_service
from services.pdf_service import normaliser


def test_extraire_pages_lit_toutes_les_pages(chemin_pdf_fictif):
    pages = pdf_service.extraire_pages(chemin_pdf_fictif)
    assert len(pages) == 7
    assert pages[0].numero == 1
    assert "Rdv FICTIF" in pages[0].texte
    assert "Rapport des Possibles" in pages[0].texte


def test_extraire_pages_retourne_les_tracés_vectoriels(chemin_pdf_fictif):
    pages = pdf_service.extraire_pages(chemin_pdf_fictif)
    # Radars des pages 2 (RIASEC) et 4 (HEXACO) : anneau + polygone de données
    assert len(pages[1].courbes) >= 2
    assert len(pages[3].courbes) >= 2
    # Histogramme de la page 3 : 9 barres
    assert len(pages[2].barres) == 9
    # Étiquettes des graphiques présentes en mots positionnés
    assert any(m.texte == "Réaliste" for m in pages[1].mots)
    assert any(m.texte == "Visualisation" for m in pages[2].mots)


def test_extraire_pages_retourne_les_lignes_stylées(chemin_pdf_fictif):
    pages = pdf_service.extraire_pages(chemin_pdf_fictif)
    lignes_champ = [l for l in pages[4].lignes if "Zone" in l.texte]
    assert lignes_champ, "les en-têtes de zone doivent apparaître en lignes"
    metiers = [l for l in pages[4].lignes if l.gras and "Coiffeur" in l.texte]
    assert metiers, "le nom du métier doit être détecté comme ligne en gras"


def test_normaliser(chemin_pdf_fictif):
    assert normaliser("Intérêts professionnels (RIASEC)") == "interets professionnels (riasec)"
    assert normaliser("  Champ   des\npossibles ") == "champ des possibles"
    assert normaliser("Émotivité") == "emotivite"


def test_sauvegarder_upload_accepte_un_pdf(tmp_path, pdf_fictif_bytes):
    chemin = pdf_service.sauvegarder_upload(pdf_fictif_bytes, tmp_path / "uploads", "rapport-fictif.pdf")
    assert chemin.is_file()
    assert chemin.suffix == ".pdf"
    assert chemin.read_bytes() == pdf_fictif_bytes


def test_sauvegarder_upload_refuse_un_non_pdf(tmp_path):
    with pytest.raises(ValueError, match="PDF"):
        pdf_service.sauvegarder_upload(b"texte", tmp_path, "notes.txt")
    with pytest.raises(ValueError, match="%PDF"):
        pdf_service.sauvegarder_upload(b"pas un pdf", tmp_path, "rapport.pdf")


def test_sauvegarder_upload_refuse_un_gros_fichier(tmp_path, monkeypatch):
    monkeypatch.setattr(pdf_service, "MAX_UPLOAD_OCTETS", 10)
    with pytest.raises(ValueError, match="trop volumineux"):
        pdf_service.sauvegarder_upload(b"%PDF-" + b"x" * 100, tmp_path, "gros.pdf")
