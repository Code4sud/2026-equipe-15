"""Tests de services/report_service.py sur le PDF fictif (Rdv FICTIF)."""
from __future__ import annotations

import io

import pytest
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from services import pdf_service, report_service
from services.pdf_service import normaliser
from tests.generer_rapport_fictif import APTITUDES, METIERS, VALEURS_HEXACO, VALEURS_RIASEC


@pytest.fixture(scope="module")
def analyse(chemin_pdf_fictif):
    return report_service.analyser_rapport(chemin_pdf_fictif, "rapport-fictif.pdf")


# ─── Structure générale ───────────────────────────────────────────────────────


def test_sections_et_rdv(analyse):
    assert analyse.nb_pages == 7
    assert analyse.rdv == "Rdv FICTIF"
    assert analyse.sections_detectees == [
        "Intérêts professionnels",
        "Aptitudes cognitives",
        "Personnalité",
        "Champ des possibles",
        "Avertissement",
    ]


def test_avertissement(analyse):
    assert analyse.avertissement is not None
    assert "expérimentaux" in analyse.avertissement


# ─── Scores des graphiques, avec leurs sources ────────────────────────────────


def test_scores_riasec_lus_sur_le_radar(analyse):
    scores = {normaliser(s.label): s for s in analyse.interets_riasec}
    assert set(scores) == {normaliser(l) for l in VALEURS_RIASEC}
    for label, attendu in VALEURS_RIASEC.items():
        score = scores[normaliser(label)]
        assert score.value == pytest.approx(attendu, abs=3), label
        assert score.echelle_max == 100.0
        # Chaque score porte sa source : page 2, lu sur le tracé vectoriel
        assert score.source.page == 2
        assert score.source.section == "Intérêts professionnels"
        assert score.source.type == "trace_vectoriel"


def test_scores_hexaco_lus_sur_le_radar(analyse):
    scores = {normaliser(s.label): s for s in analyse.personnalite_hexaco}
    assert set(scores) == {normaliser(l) for l in VALEURS_HEXACO}
    for label, attendu in VALEURS_HEXACO.items():
        score = scores[normaliser(label)]
        assert score.value == pytest.approx(attendu, abs=3), label
        assert score.source.page == 4
        assert score.source.type == "trace_vectoriel"


def test_scores_aptitudes_lus_sur_l_histogramme(analyse):
    scores = {normaliser(s.label): s for s in analyse.aptitudes}
    assert set(scores) == {normaliser(l) for l, _ in APTITUDES}
    for label, attendu in APTITUDES:
        score = scores[normaliser(label)]
        assert score.value == pytest.approx(attendu, abs=0.6), label
        assert score.echelle_max == 7.0
        assert score.source.page == 3
        assert score.source.type == "trace_vectoriel"


def test_ordre_des_scores_conforme_au_rapport(analyse):
    assert [normaliser(s.label) for s in analyse.interets_riasec] == [normaliser(l) for l in VALEURS_RIASEC]
    assert [normaliser(s.label) for s in analyse.aptitudes] == [normaliser(l) for l, _ in APTITUDES]


# ─── Champ des possibles ──────────────────────────────────────────────────────


def test_metiers_et_zones(analyse):
    assert len(analyse.metiers) == len(METIERS)
    for metier, (zone, nom, description) in zip(analyse.metiers, METIERS):
        assert metier.zone == zone
        assert normaliser(metier.nom) == normaliser(nom)
        assert normaliser(description) in normaliser(metier.description)
        assert metier.source.type == "texte"
        assert metier.source.section == "Champ des possibles"


def test_zones_vides_signalees_en_notes(analyse):
    assert any("Zone 4" in note for note in analyse.notes)
    assert any("Zone 5" in note for note in analyse.notes)


# ─── Repli honnête quand le graphique n'est pas vectoriel ─────────────────────


def test_scores_absents_si_pas_de_trace_vectoriel(tmp_path):
    """Un PDF avec la section mais un graphique en image : value=None,
    source.type='absent' — on n'invente aucune valeur."""
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(60, 750, "Aptitudes cognitives")
    c.setFont("Helvetica", 10)
    c.drawString(60, 720, "(graphique en image dans le vrai rapport)")
    c.showPage()
    c.save()
    chemin = tmp_path / "rapport-image.pdf"
    chemin.write_bytes(buffer.getvalue())

    analyse = report_service.analyser_rapport(chemin, "rapport-image.pdf")
    assert len(analyse.aptitudes) == 9  # les 9 labels connus
    assert all(s.value is None for s in analyse.aptitudes)
    assert all(s.source.type == "absent" for s in analyse.aptitudes)
    assert any("non extraites" in note for note in analyse.notes)


def test_detecter_sections(chemin_pdf_fictif):
    pages = pdf_service.extraire_pages(chemin_pdf_fictif)
    sections = report_service.detecter_sections(pages)
    assert sections["interets"] == [2]
    assert sections["aptitudes"] == [3]
    assert sections["personnalite"] == [4]
    assert sections["champ"] == [5, 6]
    assert sections["avertissement"] == [7]
