/**
 * Recommandations content-based pour les films et les séries.
 * Le profil est construit localement à partir des favoris : aucun compte,
 * serveur ou modèle opaque n'est nécessaire.
 */

function asList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function personKey(value) {
  return String(value).trim().toLocaleLowerCase("fr");
}

function personNames(movie, field) {
  return asList(movie[field]).map(String).map((name) => name.trim()).filter(Boolean);
}

function buildPersonProfile(likedMovies, field) {
  const profile = new Map();
  for (const movie of likedMovies) {
    for (const name of personNames(movie, field)) {
      const key = personKey(name);
      const current = profile.get(key) || { name, count: 0 };
      current.count += 1;
      profile.set(key, current);
    }
  }
  return profile;
}

function matchedPeople(movie, profile, field) {
  return personNames(movie, field).filter((name) => profile.has(personKey(name)));
}

export function buildGenreProfile(likedMovies) {
  const profile = {};
  for (const movie of likedMovies) {
    for (const genre of movie.genres || []) {
      profile[genre] = (profile[genre] || 0) + 1;
    }
  }
  return profile;
}

export function buildPeopleProfile(likedMovies) {
  const directors = buildPersonProfile(likedMovies, "directors");
  const legacyDirectors = buildPersonProfile(likedMovies, "director");
  for (const [key, value] of legacyDirectors) {
    const current = directors.get(key) || { name: value.name, count: 0 };
    current.count += value.count;
    directors.set(key, current);
  }
  return { directors, actors: buildPersonProfile(likedMovies, "cast") };
}

export function scoreMovie(movie, profile) {
  return asList(movie.genres).reduce((sum, genre) => sum + (profile[genre] || 0), 0);
}

export function matchedGenres(movie, profile) {
  return (movie.genres || []).filter((genre) => profile[genre] > 0);
}

function popularitySignal(movie) {
  const rating = typeof movie.rating === "number" ? movie.rating / 10 : 0;
  const votes = typeof movie.votes === "number" ? Math.min(1, Math.log10(movie.votes + 1) / 6) : 0;
  return rating * 0.15 + votes * 0.1;
}

function recencySignal(movie) {
  const currentYear = new Date().getFullYear();
  const age = Math.max(0, currentYear - (movie.year || currentYear));
  return Math.max(0, 1 - age / 30) * 0.05;
}

export function scoreDetailed(movie, profile, peopleProfile = { directors: new Map(), actors: new Map() }) {
  const genres = matchedGenres(movie, profile);
  const directors = [
    ...matchedPeople(movie, peopleProfile.directors, "directors"),
    ...matchedPeople(movie, peopleProfile.directors, "director"),
  ];
  const actors = matchedPeople(movie, peopleProfile.actors, "cast");
  const directorWeight = [...new Set(directors)].reduce(
    (sum, name) => sum + (peopleProfile.directors.get(personKey(name))?.count || 0) * 3,
    0,
  );
  const actorWeight = actors.reduce(
    (sum, name) => sum + (peopleProfile.actors.get(personKey(name))?.count || 0) * 1.5,
    0,
  );
  return {
    movie,
    matchedGenres: genres,
    matchedDirectors: [...new Set(directors)],
    matchedActors: [...new Set(actors)],
    score: scoreMovie(movie, profile) + directorWeight + actorWeight
      + popularitySignal(movie) + recencySignal(movie),
  };
}

/**
 * Retourne les résultats enrichis avec les genres qui justifient chaque choix.
 * Les titres déjà aimés et les médias sans recouvrement sont exclus.
 */
export function recommendDetailed(movies, likedIds, topN = 10) {
  const likedSet = new Set(likedIds);
  const likedMovies = movies.filter((movie) => likedSet.has(movie.id));
  if (likedMovies.length === 0) return [];

  const profile = buildGenreProfile(likedMovies);
  const peopleProfile = buildPeopleProfile(likedMovies);
  return movies
    .filter((movie) => !likedSet.has(movie.id))
    .map((movie) => scoreDetailed(movie, profile, peopleProfile))
    .filter((entry) => entry.matchedGenres.length > 0
      || entry.matchedDirectors.length > 0
      || entry.matchedActors.length > 0)
    .sort((a, b) => {
      return b.score - a.score
        || (b.movie.year || 0) - (a.movie.year || 0)
        || a.movie.title.localeCompare(b.movie.title, "fr", { sensitivity: "base" });
    })
    .slice(0, topN);
}

/** Compatibilité : l'ancien appelant reçoit uniquement les médias. */
export function recommend(movies, likedIds, topN = 10) {
  return recommendDetailed(movies, likedIds, topN).map((entry) => entry.movie);
}

/** Les genres les plus représentés dans les favoris. */
export function topProfileGenres(profile, count = 3) {
  return Object.entries(profile)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([genre]) => genre);
}
