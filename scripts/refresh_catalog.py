#!/usr/bin/env python3
"""Build the browser catalogue from public media sources.

Films récents : les jeux de données non commerciaux d'IMDb
(https://datasets.imdbws.com/), sans clé ni compte — deux fichiers TSV
compressés, mis à jour chaque jour par IMDb, téléchargés puis filtrés en
local. C'est la source par défaut, aucune configuration requise.

Séries : TVmaze, une API publique qui ne demande pas de clé.

TMDB reste utilisable en complément (films et séries plus riches : affiches,
synopsis) si TMDB_BEARER_TOKEN est présent, mais n'est plus requis pour un
catalogue complet — IMDb + TVmaze suffisent seuls.

L'ancien instantané Wikipedia (movies.json, figé à 2023) reste conservé comme
filet de secours hors-ligne. Le tout est fusionné dans un seul catalog.json
consommé par le site statique ; aucun identifiant n'est jamais écrit dans
public/.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import html
import json
import os
import re
import shutil
import sys
import time
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DATA = ROOT / "public" / "data"
LEGACY_PATH = PUBLIC_DATA / "movies.json"
OUTPUT_PATH = PUBLIC_DATA / "catalog.json"

IMDB_DATASETS_BASE = "https://datasets.imdbws.com"
IMDB_CACHE_DIR = ROOT / "data" / "imdb-cache"

# IMDb utilise ses propres étiquettes de genre (anglaises, stables depuis des
# années) ; on les fait correspondre au vocabulaire français déjà utilisé par
# TMDB_MOVIE_GENRES pour ne pas fragmenter le filtre genre du site avec deux
# langues différentes pour le même concept.
IMDB_GENRE_MAP = {
    "Action": "Action", "Adventure": "Aventure", "Animation": "Animation",
    "Biography": "Biographie", "Comedy": "Comédie", "Crime": "Crime",
    "Documentary": "Documentaire", "Drama": "Drame", "Family": "Famille",
    "Fantasy": "Fantastique", "Film-Noir": "Film noir", "History": "Histoire",
    "Horror": "Horreur", "Music": "Musique", "Musical": "Comédie musicale",
    "Mystery": "Mystère", "Romance": "Romance", "Sci-Fi": "Science-fiction",
    "Short": "Court métrage", "Sport": "Sport", "Thriller": "Thriller",
    "War": "Guerre", "Western": "Western",
}

TMDB_MOVIE_GENRES = {
    28: "Action", 12: "Aventure", 16: "Animation", 35: "Comédie", 80: "Crime",
    99: "Documentaire", 18: "Drame", 10751: "Famille", 14: "Fantastique",
    36: "Histoire", 27: "Horreur", 10402: "Musique", 9648: "Mystère",
    10749: "Romance", 878: "Science-fiction", 10770: "Téléfilm", 53: "Thriller",
    10752: "Guerre", 37: "Western",
}
TMDB_TV_GENRES = {
    10759: "Action et aventure", 16: "Animation", 35: "Comédie", 80: "Crime",
    99: "Documentaire", 18: "Drame", 10751: "Famille", 10762: "Jeunesse",
    9648: "Mystère", 10763: "Actualités", 10764: "Téléréalité",
    10765: "Science-fiction et fantastique", 10766: "Soap", 10767: "Talk-show",
    10768: "Guerre et politique", 37: "Western",
}


def request_json(url: str, headers: dict[str, str] | None = None, retries: int = 3) -> Any:
    request = Request(url, headers={"User-Agent": "movie-catalog-refresh/1.0", **(headers or {})})
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            with urlopen(request, timeout=30) as response:
                return json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
            last_error = error
            if attempt < retries:
                time.sleep(2 ** (attempt - 1))
    raise RuntimeError(f"Impossible de charger {url}: {last_error}")


def strip_html(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", value))).strip()


def year_from_date(value: str | None) -> int | None:
    if not value or not value[:4].isdigit():
        return None
    return int(value[:4])


def load_legacy() -> list[dict[str, Any]]:
    if not LEGACY_PATH.exists():
        return []
    return json.loads(LEGACY_PATH.read_text(encoding="utf-8"))


def tmdb_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Accept": "application/json"}


def fetch_tmdb(token: str, media_type: str, pages: int, language: str) -> list[dict[str, Any]]:
    if pages <= 0:
        return []
    genre_map = TMDB_MOVIE_GENRES if media_type == "movie" else TMDB_TV_GENRES
    results: list[dict[str, Any]] = []
    for page in range(1, pages + 1):
        params = {
            "language": language,
            "sort_by": "popularity.desc",
            "page": str(page),
            "include_adult": "false",
            "vote_count.gte": "20",
        }
        if media_type == "movie":
            params.update({"region": "FR", "with_watch_monetization_types": "flatrate|rent|buy"})
            endpoint = "discover/movie"
        else:
            params.update({"with_watch_monetization_types": "flatrate|rent|buy"})
            endpoint = "discover/tv"
        payload = request_json(f"https://api.themoviedb.org/3/{endpoint}?{urlencode(params)}", tmdb_headers(token))
        for item in payload.get("results", []):
            title = item.get("title") if media_type == "movie" else item.get("name")
            date = item.get("release_date") if media_type == "movie" else item.get("first_air_date")
            if not title:
                continue
            results.append({
                "id": int(item["id"]) if media_type == "movie" else 1_000_000 + int(item["id"]),
                "media_type": media_type,
                "title": title,
                "original_title": item.get("original_title") or item.get("original_name"),
                "year": year_from_date(date),
                "genres": [genre_map[g] for g in item.get("genre_ids", []) if g in genre_map],
                "overview": item.get("overview", ""),
                "rating": round(float(item.get("vote_average", 0) or 0), 1),
                "votes": int(item.get("vote_count", 0) or 0),
                "thumbnail": f"https://image.tmdb.org/t/p/w500{item['poster_path']}" if item.get("poster_path") else None,
                "homepage": f"https://www.themoviedb.org/{media_type}/{item['id']}",
                "source": "TMDB",
            })
    return results


def fetch_tvmaze(pages: int) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for page in range(pages):
        try:
            payload = request_json(f"https://api.tvmaze.com/shows?page={page}")
        except RuntimeError as error:
            if "404" in str(error):
                break
            raise
        if not payload:
            break
        for item in payload:
            title = item.get("name")
            if not title:
                continue
            rating = item.get("rating", {}).get("average")
            network = item.get("network") or item.get("webChannel") or {}
            results.append({
                "id": 1_000_000 + int(item["id"]),
                "media_type": "tv",
                "title": title,
                "original_title": title,
                "year": year_from_date(item.get("premiered")),
                "genres": item.get("genres", []) or ["Série"],
                "overview": strip_html(item.get("summary")),
                "rating": float(rating) if isinstance(rating, (float, int)) else None,
                "votes": 0,
                "thumbnail": ((item.get("image") or {}).get("original") or (item.get("image") or {}).get("medium")),
                "homepage": item.get("officialSite") or item.get("url"),
                "networks": [network.get("name")] if network.get("name") else [],
                "seasons": item.get("_embedded", {}).get("seasons") if isinstance(item.get("_embedded"), dict) else None,
                "source": "TVmaze",
            })
    return results


def _ensure_imdb_dataset(name: str, cache_dir: Path, offline: bool) -> Path | None:
    """Retourne le chemin local du fichier `{name}.tsv.gz` d'IMDb.

    Télécharge le fichier dans `cache_dir` (sans aucune clé — un simple
    fichier public, régénéré chaque jour par IMDb), sauf si `offline` est
    vrai et qu'une copie locale existe déjà. Ne lève jamais d'exception :
    une erreur réseau ou une copie locale absente renvoie `None`, pour que
    l'absence d'IMDb (pas d'accès réseau à ce moment précis) n'empêche
    jamais le reste du catalogue (legacy + TVmaze [+ TMDB]) de se
    construire.
    """
    destination = cache_dir / f"{name}.tsv.gz"
    if offline:
        return destination if destination.exists() else None

    cache_dir.mkdir(parents=True, exist_ok=True)
    url = f"{IMDB_DATASETS_BASE}/{name}.tsv.gz"
    request = Request(url, headers={"User-Agent": "movie-catalog-refresh/1.0"})
    temporary = destination.with_suffix(".tsv.gz.tmp")
    try:
        with urlopen(request, timeout=120) as response, open(temporary, "wb") as handle:
            shutil.copyfileobj(response, handle)
    except (HTTPError, URLError, TimeoutError, OSError) as error:
        print(f"IMDb : téléchargement de {name}.tsv.gz impossible ({error}) — ignoré.", file=sys.stderr)
        temporary.unlink(missing_ok=True)
        return destination if destination.exists() else None
    temporary.replace(destination)
    return destination


def _iter_imdb_tsv(path: Path):
    """Générateur streamé sur un `.tsv.gz` d'IMDb : jamais tout en mémoire.

    `title.basics.tsv.gz` décompressé pèse plus d'un gigaoctet (tous types
    de titres confondus : films, séries, épisodes, courts-métrages...) —
    on le lit ligne à ligne via `gzip` plutôt que de charger le fichier
    entier, et on ne garde en mémoire que les quelques milliers de films
    qui passent le filtre d'année.
    """
    with gzip.open(path, mode="rt", encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle, delimiter="\t", quoting=csv.QUOTE_NONE)
        header = next(reader)
        index = {name: i for i, name in enumerate(header)}
        for row in reader:
            if len(row) != len(header):
                continue  # ligne tronquée/corrompue : ignorée plutôt que de planter tout le traitement
            yield index, row


def fetch_imdb(since_year: int, cache_dir: Path = IMDB_CACHE_DIR, offline: bool = False) -> list[dict[str, Any]]:
    """Films IMDb depuis `since_year`, sans clé ni compte.

    Deux fichiers publics d'IMDb (`title.basics`, `title.ratings`), chacun un
    simple `.tsv.gz` régénéré chaque jour — aucune authentification, aucun
    quota de requêtes, contrairement à une API classique. Le catalogue
    contient déjà les films jusqu'à 2023 (instantané Wikipedia figé) ; cette
    fonction comble ce qui manque depuis, sans dupliquer ce qui existe déjà.
    """
    basics_path = _ensure_imdb_dataset("title.basics", cache_dir, offline)
    if basics_path is None:
        return []

    kept: dict[str, dict[str, Any]] = {}
    for index, row in _iter_imdb_tsv(basics_path):
        if row[index["titleType"]] != "movie":
            continue
        if row[index["isAdult"]] == "1":
            continue
        start_year = row[index["startYear"]]
        if start_year == r"\N" or not start_year.isdigit():
            continue
        if int(start_year) < since_year:
            continue
        tconst = row[index["tconst"]]
        raw_genres = row[index["genres"]]
        genres = [] if raw_genres == r"\N" else [
            IMDB_GENRE_MAP[g] for g in raw_genres.split(",") if g in IMDB_GENRE_MAP
        ]
        kept[tconst] = {
            "id": 5_000_000_000 + int(tconst[2:]),
            "media_type": "movie",
            "title": row[index["primaryTitle"]],
            "original_title": row[index["originalTitle"]],
            "year": int(start_year),
            "genres": genres,
            "overview": "",  # pas de synopsis dans le jeu de données non commercial
            "rating": None,
            "votes": 0,
            "thumbnail": None,  # pas d'affiche dans ce jeu de données ; le site bascule déjà sur une vignette de repli
            "homepage": f"https://www.imdb.com/title/{tconst}/",
            "source": "IMDb",
        }

    if not kept:
        return list(kept.values())

    ratings_path = _ensure_imdb_dataset("title.ratings", cache_dir, offline)
    if ratings_path is not None:
        for index, row in _iter_imdb_tsv(ratings_path):
            tconst = row[index["tconst"]]
            item = kept.get(tconst)
            if item is None:
                continue
            try:
                item["rating"] = round(float(row[index["averageRating"]]), 1)
                item["votes"] = int(row[index["numVotes"]])
            except ValueError:
                pass

    return list(kept.values())


def deduplicate(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[Any, str]] = set()
    output: list[dict[str, Any]] = []
    for item in items:
        key = (item.get("id"), item.get("media_type", "movie"))
        if key in seen:
            continue
        seen.add(key)
        item["genres"] = sorted({genre for genre in item.get("genres", []) if genre})
        output.append(item)
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--movie-pages", type=int, default=int(os.getenv("TMDB_MOVIE_PAGES", "0")),
                         help="Pages TMDB pour les films (0 = désactivé ; nécessite TMDB_BEARER_TOKEN)")
    parser.add_argument("--tv-pages", type=int, default=int(os.getenv("TMDB_TV_PAGES", "0")),
                         help="Pages TMDB pour les séries (0 = désactivé ; nécessite TMDB_BEARER_TOKEN)")
    parser.add_argument("--tvmaze-pages", type=int, default=int(os.getenv("TVMAZE_PAGES", "8")))
    parser.add_argument("--language", default=os.getenv("TMDB_LANGUAGE", "fr-FR"))
    parser.add_argument("--imdb-since-year", type=int, default=int(os.getenv("IMDB_SINCE_YEAR", "2024")),
                         help="Films IMDb à partir de cette année (défaut : 2024, la limite du jeu de données Wikipedia figé)")
    parser.add_argument("--no-imdb", action="store_true", help="Ne pas interroger les jeux de données IMDb")
    parser.add_argument("--imdb-offline", action="store_true",
                         help="Réutiliser les fichiers IMDb déjà en cache (data/imdb-cache/) sans retélécharger")
    parser.add_argument("--without-legacy", action="store_true", help="Do not retain the original static movie dataset")
    parser.add_argument("--allow-no-tmdb", action="store_true", help="Conservé pour compatibilité : n'a plus d'effet, TMDB n'est déjà plus requis")
    args = parser.parse_args()

    token = os.getenv("TMDB_BEARER_TOKEN")

    items: list[dict[str, Any]] = [] if args.without_legacy else load_legacy()
    if token:
        items.extend(fetch_tmdb(token, "movie", args.movie_pages, args.language))
        items.extend(fetch_tmdb(token, "tv", args.tv_pages, args.language))
    if not args.no_imdb:
        items.extend(fetch_imdb(args.imdb_since_year, offline=args.imdb_offline))
    items.extend(fetch_tvmaze(args.tvmaze_pages))
    items = deduplicate(items)
    items.sort(key=lambda item: (item.get("year") or 0, item.get("title", "").lower()), reverse=True)
    if not items:
        print("No catalogue item was produced", file=sys.stderr)
        return 1

    PUBLIC_DATA.mkdir(parents=True, exist_ok=True)
    temporary = OUTPUT_PATH.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(items, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    temporary.replace(OUTPUT_PATH)
    counts = {"movie": sum(item.get("media_type") not in {"tv"} for item in items), "tv": sum(item.get("media_type") == "tv" for item in items)}
    print(f"Wrote {len(items)} items to {OUTPUT_PATH} ({counts['movie']} films, {counts['tv']} series)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
