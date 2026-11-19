"""Point d'entrée FastAPI — Rapport des Possibles augmenté (équipe 15).

Lancement en local :
    cd backend
    uvicorn main:app --reload

Authentification
----------------
Une seule variable d'environnement contrôle l'accès à toute l'API :

    API_TOKEN=...        (dans backend/.env, jamais versionné)

- Si `API_TOKEN` est défini  → chaque requête doit porter le header
  `Authorization: Bearer <API_TOKEN>`, sinon 401.
- Si `API_TOKEN` est absent  → mode développement ouvert (les tests
  automatiques continuent de passer sans token).

Côté page (frontend), le token est demandé une fois, stocké en
`sessionStorage`, et envoyé dans chaque appel `fetch` — voir le README.
"""
from __future__ import annotations

import os

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from routes import report

load_dotenv()

API_TOKEN = os.environ.get("API_TOKEN")

security = HTTPBearer(auto_error=False)


async def verifier_token(
    credentials: HTTPAuthorizationCredentials | None = Security(security),
) -> None:
    """Dépendance FastAPI : exige un Bearer token si API_TOKEN est configuré."""
    if API_TOKEN is None:
        return  # mode dev : pas de token configuré, on laisse passer
    if credentials is None or credentials.credentials != API_TOKEN:
        raise HTTPException(
            status_code=401,
            detail="Code d'accès manquant ou invalide",
            headers={"WWW-Authenticate": "Bearer"},
        )


app = FastAPI(
    title="Rapport des Possibles augmenté",
    description="API de l'équipe 15 — Hackathon Azuréen #3",
    dependencies=[Depends(verifier_token)],
)

# En local / démo, la page peut être servie depuis un autre port (GitHub Pages,
# Vite, etc.) : on autorise les requêtes cross-origin. En production, restreindre
# à l'origine réelle via la variable CORS_ALLOW_ORIGINS (séparée par des virgules).
_origines = os.environ.get("CORS_ALLOW_ORIGINS", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origines.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(report.router)


@app.get("/")
def accueil() -> dict:
    return {
        "projet": "Rapport des Possibles augmenté — équipe 15",
        "auth": "active" if API_TOKEN else "desactivee (mode dev)",
        "routes": ["/report", "/report/upload", "/docs"],
    }
