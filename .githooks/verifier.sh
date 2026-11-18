#!/usr/bin/env bash
# Garde-fou du dépôt de l'équipe 15 : bloque ce qui ne doit jamais être publié.
#
#   verifier.sh --staged        fichiers sur le point d'être committés (hook pre-commit)
#   verifier.sh --commit <sha>  fichiers ajoutés ou modifiés par un commit (hook pre-push)
#   verifier.sh --all           tous les fichiers du dernier commit (GitHub Actions)
#
# Bloquant : Rapports des Possibles, PDF et tableurs, dossier prive/, fichiers .env,
# clés d'API, fichiers de plus de 50 Mo, projet.json invalide.
# Compatible bash 3.2 (macOS) et Git Bash (Windows).

set -u

MAX_OCTETS=$((50 * 1024 * 1024))       # GitHub refuse à 100 Mo, avertit à 50 Mo
MAX_CAPTURE=$((1024 * 1024))           # la doc demande moins de 1 Mo par capture
MAX_LECTURE=$((2 * 1024 * 1024))       # au-delà, le contenu n'est pas analysé

erreurs=0
avertissements=0

erreur() { printf '  ✗ %s\n' "$1" >&2; erreurs=$((erreurs + 1)); }
avertir() { printf '  ! %s\n' "$1" >&2; avertissements=$((avertissements + 1)); }

mode="${1:---staged}"
case "$mode" in
  --staged)
    prefixe=":"
    lister() { git diff --cached --name-only --diff-filter=ACMR -z; }
    ;;
  --commit)
    sha="${2:?usage : verifier.sh --commit <sha>}"
    prefixe="$sha:"
    lister() { git diff-tree --root --no-commit-id --name-only -r --diff-filter=ACMR -z "$sha"; }
    ;;
  --all)
    prefixe="HEAD:"
    lister() { git ls-tree -r --name-only -z HEAD; }
    ;;
  *)
    echo "usage : verifier.sh --staged | --commit <sha> | --all" >&2
    exit 2
    ;;
esac

# Vrai si le contenu du fichier courant contient le motif (fichiers binaires ignorés).
contient() { git cat-file -p "$prefixe$f" 2>/dev/null | LC_ALL=C grep -IqE -e "$1"; }
contient_i() { git cat-file -p "$prefixe$f" 2>/dev/null | LC_ALL=C grep -IqiE -e "$1"; }

# Valide du JSON lu sur l'entrée standard. Retour : 0 valide, 1 invalide, 2 aucun outil.
valider_json() {
  if python3 -c 'import json' >/dev/null 2>&1; then
    python3 -c 'import json,sys
try: json.load(sys.stdin.buffer)
except Exception as e: print(e); sys.exit(1)'
  elif python -c 'import json' >/dev/null 2>&1; then
    python -c 'import json,sys
try: json.load(getattr(sys.stdin, "buffer", sys.stdin))
except Exception as e: print(e); sys.exit(1)'
  elif node -e '' >/dev/null 2>&1; then
    node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{JSON.parse(s)}catch(e){console.log(e.message);process.exit(1)}})'
  else
    return 2
  fi
}

while IFS= read -r -d '' f; do
  minuscules=$(printf '%s' "$f" | LC_ALL=C tr 'A-Z' 'a-z')
  nom=${minuscules##*/}

  # 1. Emplacements et types de fichiers interdits
  case "/$minuscules" in
    */prive/*) erreur "$f : le dossier prive/ ne doit jamais être publié." ;;
  esac
  case "$nom" in
    rapport-des-possibles*)
      erreur "$f : un Rapport des Possibles ne va jamais dans le dépôt (il est public)." ;;
    *.pdf | *.xlsx | *.xls)
      erreur "$f : PDF et tableurs interdits dans le dépôt (risque de publier une donnée du Centre). Rangez-le dans prive/." ;;
    .env.example) ;;
    .env | .env.*)
      erreur "$f : un fichier .env contient des secrets. Committez un .env.example sans valeur." ;;
    *.pem | *.key | id_rsa | id_ed25519)
      erreur "$f : clé privée." ;;
  esac

  # 2. Taille
  taille=$(git cat-file -s "$prefixe$f" 2>/dev/null || echo 0)
  if [ "$taille" -gt "$MAX_OCTETS" ]; then
    erreur "$f : $((taille / 1024 / 1024)) Mo. GitHub refuse les fichiers de plus de 100 Mo ; gardez modèles, vidéos et jeux de données hors du dépôt."
  fi
  case "$minuscules" in
    captures/*.png | captures/*.jpg | captures/*.jpeg)
      [ "$taille" -gt "$MAX_CAPTURE" ] && avertir "$f : $((taille / 1024)) Ko. La doc demande moins de 1 Mo par capture." ;;
  esac

  # 3. projet.json : un fichier invalide donne une fiche vide, sans message d'erreur
  if [ "$f" = "projet.json" ]; then
    detail=$(git cat-file -p "$prefixe$f" 2>/dev/null | valider_json 2>&1)
    case $? in
      0) contient '"nom"[[:space:]]*:[[:space:]]*"Nom du projet"' &&
        avertir "projet.json : le nom est encore « Nom du projet », la fiche restera vide." ;;
      1) erreur "projet.json : JSON invalide ($detail). La fiche du site serait vide." ;;
      *) avertir "projet.json : ni python ni node trouvé, validité non vérifiée." ;;
    esac
  fi

  # 4. Contenu : clés d'API et extraits de rapports réels
  case "$minuscules" in
    .githooks/* | package-lock.json | */package-lock.json | *.lock | pnpm-lock.yaml | */pnpm-lock.yaml) continue ;;
  esac
  [ "$taille" -gt "$MAX_LECTURE" ] && continue

  if contient 'sk-ant-[A-Za-z0-9_-]{20,}' ||
    contient 'sk-[A-Za-z0-9_-]{32,}' ||
    contient 'hf_[A-Za-z0-9]{30,}' ||
    contient 'AIza[0-9A-Za-z_-]{35}' ||
    contient 'gsk_[A-Za-z0-9]{40,}' ||
    contient 'gh[pousr]_[A-Za-z0-9]{36,}' ||
    contient 'github_pat_[A-Za-z0-9_]{40,}' ||
    contient '-----BEGIN [A-Z ]*PRIVATE KEY-----' ||
    contient_i "(api_?key|secret|token|password|passwd)[a-z0-9_]*[\"']?[[:space:]]*[=:][[:space:]]*[\"']?[A-Za-z0-9_-]{24,}"; then
    erreur "$f : ressemble à une clé d'API ou à un secret. Passez par une variable d'environnement (.env)."
  fi

  if contient '[Rr][Dd][Vv][[:space:]]*[0-9]{4}'; then
    erreur "$f : contient un numéro de rendez-vous (« Rdv 1234 »), signe d'un extrait de vrai rapport. Les jeux de test sont inventés : utilisez « Rdv FICTIF »."
  fi
done < <(lister)

if [ "$erreurs" -gt 0 ]; then
  {
    echo
    echo "Bloqué : $erreurs problème(s) ci-dessus. Le dépôt est public, rien de tout cela ne doit partir."
    echo "Retirez le fichier (git restore --staged <fichier>) ou corrigez-le, puis recommencez."
    echo "Faux positif ? Demandez à l'équipe avant de contourner."
  } >&2
  exit 1
fi
exit 0
