#!/usr/bin/env python3
"""Build the browser catalogue from public media sources.

TMDB is used for current films and series when TMDB_BEARER_TOKEN is present.
TVmaze is used for a broad series index and does not require a key. The output
is a single catalog.json consumed by the static site; no credential is ever
written to public/.
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
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
    parser.add_argument("--movie-pages", type=int, default=int(os.getenv("TMDB_MOVIE_PAGES", "20")))
    parser.add_argument("--tv-pages", type=int, default=int(os.getenv("TMDB_TV_PAGES", "20")))
    parser.add_argument("--tvmaze-pages", type=int, default=int(os.getenv("TVMAZE_PAGES", "8")))
    parser.add_argument("--language", default=os.getenv("TMDB_LANGUAGE", "fr-FR"))
    parser.add_argument("--without-legacy", action="store_true", help="Do not retain the original static movie dataset")
    parser.add_argument("--allow-no-tmdb", action="store_true", help="Use TVmaze and legacy data if the TMDB token is absent")
    args = parser.parse_args()

    token = os.getenv("TMDB_BEARER_TOKEN")
    if not token and not args.allow_no_tmdb:
        print("TMDB_BEARER_TOKEN is required for a complete refresh. Use --allow-no-tmdb only for a local fallback.", file=sys.stderr)
        return 2

    items: list[dict[str, Any]] = [] if args.without_legacy else load_legacy()
    if token:
        items.extend(fetch_tmdb(token, "movie", args.movie_pages, args.language))
        items.extend(fetch_tmdb(token, "tv", args.tv_pages, args.language))
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
