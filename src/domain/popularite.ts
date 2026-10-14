import type { SourceId } from "./types.ts";

/**
 * Score de popularité entre 0 et 1, comparable d'une source à l'autre.
 * Chaque source mesure à sa façon : membres AniList (jusqu'à ~1 million),
 * nombre d'articles Wikipédia (jusqu'à ~150), poids TVmaze (0 à 100,
 * très tassé vers le haut). On ramène chacune sur 0..1 et on garde la
 * meilleure. Ce n'est qu'un ordre de tri, pas une note de qualité.
 */
export function scorePopularite(popularite: Partial<Record<SourceId, number>>): number {
  const scores: number[] = [];
  const { anilist, wikidata, tvmaze } = popularite;
  if (anilist !== undefined && anilist > 0) scores.push(Math.log10(anilist) / 6);
  if (wikidata !== undefined && wikidata > 0) scores.push(Math.log10(wikidata) / Math.log10(150));
  // Le poids TVmaze sature à 100 pour beaucoup de séries récentes : plafonné à
  // 0,6 pour ne pas passer devant les séries reconnues par Wikipédia.
  if (tvmaze !== undefined) scores.push(Math.min(0.6, ((tvmaze - 85) / 15) * 0.6));
  const meilleur = scores.length ? Math.max(...scores) : 0;
  return Math.round(Math.min(1, Math.max(0, meilleur)) * 10_000) / 10_000;
}
