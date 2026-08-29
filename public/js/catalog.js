/**
 * Logique pure de parcours du catalogue : recherche, filtrage par genre,
 * liste des genres, pagination, couleur de vignette de secours.
 * Aucune dépendance au DOM — testable directement en Node.
 */

export function validateMovies(value) {
  if (!Array.isArray(value)) throw new Error("Le catalogue doit être un tableau");
  return value.map((movie, index) => {
    if (!movie || typeof movie !== "object") {
      throw new Error(`Film invalide à l'index ${index}`);
    }
    if (!Number.isInteger(movie.id)) {
      throw new Error(`Film invalide à l'index ${index}: id manquant ou non entier`);
    }
    if (typeof movie.title !== "string" || movie.title.trim() === "") {
      throw new Error(`Film invalide à l'index ${index}: titre manquant`);
    }
    if (!Array.isArray(movie.genres) || movie.genres.some((genre) => typeof genre !== "string")) {
      throw new Error(`Film invalide à l'index ${index}: genres invalides`);
    }
    if (movie.cast !== undefined && (!Array.isArray(movie.cast) || movie.cast.some((actor) => typeof actor !== "string"))) {
      throw new Error(`Film invalide à l'index ${index}: casting invalide`);
    }
    if (movie.year !== undefined && (!Number.isInteger(movie.year) || movie.year < 1888 || movie.year > 2200)) {
      throw new Error(`Film invalide à l'index ${index}: année invalide`);
    }
    return movie;
  });
}

export function searchMovies(movies, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return movies;
  return movies.filter((movie) => {
    if (movie.title.toLowerCase().includes(q)) return true;
    return (movie.cast || []).some((actor) => actor.toLowerCase().includes(q));
  });
}

export function filterByGenre(movies, genre) {
  if (!genre) return movies;
  return movies.filter((movie) => movie.genres.includes(genre));
}

export function collectGenres(movies) {
  const set = new Set();
  for (const movie of movies) {
    for (const genre of movie.genres) set.add(genre);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
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

/**
 * Couleur de secours déterministe pour la vignette d'un film (utilisée tant
 * que l'affiche réelle n'a pas fini de charger, ou si elle échoue à
 * charger). Un simple hash de chaîne -> teinte HSL : même titre, même
 * couleur à chaque fois, sans dépendance externe.
 */
export function posterColor(title) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash << 5) - hash + title.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 45%, 28%)`;
}

const GENRE_EMOJI = {
  Action: "💥",
  Comedy: "😂",
  Drama: "🎭",
  Thriller: "🔪",
  Romance: "💕",
  Horror: "👻",
  "Science Fiction": "🚀",
  Animated: "🎨",
  Crime: "🕵️",
  Fantasy: "🧙",
  Biography: "📖",
  Adventure: "🗺️",
  Documentary: "🎥",
  Musical: "🎵",
  Supernatural: "🔮",
  War: "⚔️",
  Historical: "🏛️",
  Family: "👨‍👩‍👧",
  Superhero: "🦸",
  Sports: "🏆",
  Mystery: "🕵️‍♀️",
  Western: "🤠",
};

/** Emoji représentant le premier genre reconnu d'un film, sinon un clap générique. */
export function posterEmoji(genres) {
  for (const genre of genres || []) {
    if (GENRE_EMOJI[genre]) return GENRE_EMOJI[genre];
  }
  return "🎬";
}
