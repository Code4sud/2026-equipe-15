"""Tests de la route /report (POST upload, GET analyse, GET scores) de bout en bout."""
from __future__ import annotations

import re

from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes import report
from services.pdf_service import normaliser

def _client() -> TestClient:
    app = FastAPI()
    app.include_router(report.router)
    return TestClient(app)


def test_upload_puis_lecture_des_scores(storage_tmp, pdf_fictif_bytes):
    http = _client()

    # 1. On dépose le PDF fictif
    reponse = http.post(
        "/report/upload",
        files={"fichier": ("rapport-fictif.pdf", pdf_fictif_bytes, "application/pdf")},
    )
    assert reponse.status_code == 201, reponse.text
    analyse = reponse.json()
    assert re.fullmatch(r"[0-9a-f]{32}", analyse["id"])
    assert analyse["rdv"] == "Rdv FICTIF"
    assert analyse["nb_pages"] == 7

    # Le JSON a bien été sauvegardé dans le stockage temporaire
    assert (storage_tmp / "outputs" / f"{analyse['id']}.json").is_file()
    # Et le PDF déposé dans uploads/
    assert list((storage_tmp / "uploads").glob("*.pdf"))

    # 2. Les scores du graphique sont retournés avec leurs sources
    scores = http.get(f"/report/{analyse['id']}/scores").json()
    assert set(scores) == {"interets_riasec", "aptitudes", "personnalite_hexaco"}
    assert len(scores["interets_riasec"]) == 6
    assert len(scores["aptitudes"]) == 9
    assert len(scores["personnalite_hexaco"]) == 6
    for score in scores["interets_riasec"] + scores["aptitudes"] + scores["personnalite_hexaco"]:
        assert score["value"] is not None
        assert score["source"]["type"] == "trace_vectoriel"
        assert score["source"]["page"] >= 1
    riasec = {normaliser(s["label"]): s["value"] for s in scores["interets_riasec"]}
    assert riasec["artistique"] == max(riasec.values())  # 90 dans le PDF fictif
    aptitudes = {normaliser(s["label"]): s["value"] for s in scores["aptitudes"]}
    assert aptitudes["visualisation"] == 7.0

    # 3. L'analyse complète se relit, et la liste contient l'id
    relue = http.get(f"/report/{analyse['id']}").json()
    assert relue["id"] == analyse["id"]
    assert len(relue["metiers"]) == 4
    assert {m["zone"] for m in relue["metiers"]} == {1, 2, 3}
    assert analyse["id"] in http.get("/report").json()


def test_upload_refuse_un_non_pdf(storage_tmp):
    http = _client()
    reponse = http.post("/report/upload", files={"fichier": ("notes.txt", b"hello", "text/plain")})
    assert reponse.status_code == 400
    assert "PDF" in reponse.json()["detail"]


def test_analyse_inconnue_ou_id_invalide(storage_tmp):
    http = _client()
    assert http.get("/report/" + "0" * 32).status_code == 404
    assert http.get("/report/abc").status_code == 404
    assert http.get("/report/" + "0" * 32 + "/scores").status_code == 404
    assert http.get("/report").json() == []
