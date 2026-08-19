/**
 * Recommandation basée sur le contenu (content-based) : pas de machine
 * learning, juste un profil de genres construit à partir des films likés,
 * puis un score par film candidat = somme des poids de ses genres dans ce
 * profil. Simple, explicable, et suffisant pour ce projet — testable sans
 * DOM ni réseau.
 */

export function buildGenreProfile(likedMovies) {
  const profile = {};
  for (const movie of likedMovies) {
    for (const genre of movie.genres) {
      profile[genre] = (profile[genre] || 0) + 1;
    }
  }
  return profile;
}

export function scoreMovie(movie, profile) {
  return movie.genres.reduce((sum, genre) => sum + (profile[genre] || 0), 0);
}

/**
 * Renvoie jusqu'à `topN` films non-likés, triés par score de similarité de
 * genre décroissant (à score égal, le plus récent d'abord). Renvoie un
 * tableau vide si aucun film n'est liké — pas de recommandation à faire.
 */
export function recommend(movies, likedIds, topN = 10) {
  const likedSet = new Set(likedIds);
  const likedMovies = movies.filter((movie) => likedSet.has(movie.id));
  if (likedMovies.length === 0) return [];

  const profile = buildGenreProfile(likedMovies);

  const scored = movies
    .filter((movie) => !likedSet.has(movie.id))
    .map((movie) => ({ movie, score: scoreMovie(movie, profile) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.movie.year - a.movie.year);

  return scored.slice(0, topN).map((entry) => entry.movie);
}

/** Les 3 genres les plus représentés dans les likes, pour expliquer le "pourquoi". */
export function topProfileGenres(profile, count = 3) {
  return Object.entries(profile)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([genre]) => genre);
}
