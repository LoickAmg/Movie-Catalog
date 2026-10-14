/**
 * Logique pure du catalogue : validation, recherche, filtres, tri,
 * pagination et profils de média. Les helpers restent indépendants du DOM
 * pour être testables dans Node/Vitest.
 */

export const MEDIA_TYPES = Object.freeze({
  movie: "Film",
  tv: "Série",
});

export function mediaTypeOf(item) {
  return item?.media_type === "tv" || item?.type === "tv" ? "tv" : "movie";
}

export function mediaLabel(item) {
  return MEDIA_TYPES[mediaTypeOf(item)];
}

export function validateMovies(value) {
  if (!Array.isArray(value)) throw new Error("Le catalogue doit être un tableau");
  return value.map((movie, index) => {
    if (!movie || typeof movie !== "object") {
      throw new Error(`Média invalide à l'index ${index}`);
    }
    if (!Number.isInteger(movie.id)) {
      throw new Error(`Média invalide à l'index ${index}: id manquant ou non entier`);
    }
    if (typeof movie.title !== "string" || movie.title.trim() === "") {
      throw new Error(`Média invalide à l'index ${index}: titre manquant`);
    }
    if (!Array.isArray(movie.genres) || movie.genres.some((genre) => typeof genre !== "string")) {
      throw new Error(`Média invalide à l'index ${index}: genres invalides`);
    }
    if (movie.media_type != null && !["movie", "tv"].includes(movie.media_type)) {
      throw new Error(`Média invalide à l'index ${index}: type inconnu`);
    }
    if (movie.type != null && !["movie", "tv"].includes(movie.type)) {
      throw new Error(`Média invalide à l'index ${index}: type inconnu`);
    }
    if (movie.cast != null && (!Array.isArray(movie.cast) || movie.cast.some((actor) => typeof actor !== "string"))) {
      throw new Error(`Média invalide à l'index ${index}: casting invalide`);
    }
    if (movie.year != null && (!Number.isInteger(movie.year) || movie.year < 1888 || movie.year > 2200)) {
      throw new Error(`Média invalide à l'index ${index}: année invalide`);
    }
    if (movie.rating != null && (typeof movie.rating !== "number" || movie.rating < 0 || movie.rating > 10)) {
      throw new Error(`Média invalide à l'index ${index}: note invalide`);
    }
    return movie;
  });
}

export function searchMovies(movies, query) {
  const q = (query || "").trim().toLocaleLowerCase();
  if (!q) return movies;
  return movies.filter((movie) => {
    const haystack = [
      movie.title,
      movie.original_title,
      movie.overview,
      ...(movie.cast || []),
      ...(movie.networks || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase();
    return haystack.includes(q);
  });
}

export function filterByGenre(movies, genre) {
  if (!genre) return movies;
  return movies.filter((movie) => movie.genres.includes(genre));
}

export function filterByType(movies, type) {
  if (!type) return movies;
  return movies.filter((movie) => mediaTypeOf(movie) === type);
}

export function filterByYear(movies, year) {
  if (!year) return movies;
  const numericYear = Number(year);
  return movies.filter((movie) => movie.year === numericYear);
}

export function collectGenres(movies) {
  const set = new Set();
  for (const movie of movies) {
    for (const genre of movie.genres) set.add(genre);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function collectYears(movies) {
  return Array.from(new Set(movies.map((movie) => movie.year).filter(Number.isInteger))).sort((a, b) => b - a);
}

export function sortCatalog(items, sort = "recent") {
  return [...items].sort((a, b) => {
    if (sort === "rating") return (b.rating ?? -1) - (a.rating ?? -1) || (b.year ?? 0) - (a.year ?? 0);
    if (sort === "title") return a.title.localeCompare(b.title, "fr", { sensitivity: "base" });
    return (b.year ?? 0) - (a.year ?? 0) || a.title.localeCompare(b.title, "fr", { sensitivity: "base" });
  });
}

export function paginate(items, page, pageSize) {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    totalPages,
    totalItems,
  };
}

/** Couleur de secours déterministe utilisée en attendant une affiche réelle. */
export function posterColor(title) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash << 5) - hash + title.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 45%, 28%)`;
}

/** Fallback textuel volontairement sobre : aucune icône ou emoji dans l'UI. */
export function posterFallback(title, type = "movie") {
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
  return `${initials || "??"} · ${type === "tv" ? "SÉRIE" : "FILM"}`;
}

// Compatibilité avec les anciens tests/consommateurs. Le rendu applicatif
// utilise désormais posterFallback() et ne dépend plus de cette fonction.
const GENRE_EMOJI = {
  Horror: "👻",
  Comedy: "😂",
  Action: "💥",
  Drama: "🎭",
};

export function posterEmoji(genres) {
  return GENRE_EMOJI[genres?.find((genre) => GENRE_EMOJI[genre])] || "🎬";
}
