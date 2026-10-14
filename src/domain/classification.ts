import type { Format, Rubrique, Technique } from "./types.ts";

/**
 * Pays dont l'animation est rangée dans la rubrique « Anime » (lot 0, §2.2) :
 * Japon, Chine (donghua) et Corée (aeni).
 */
export const ORIGINES_ANIME = ["JP", "CN", "KR"] as const;

export type BadgeAnime = "japon" | "donghua" | "aeni";

const BADGES: Record<string, BadgeAnime> = { JP: "japon", CN: "donghua", KR: "aeni" };

/**
 * Rubrique de navigation, dérivée des axes. Les rubriques sont exclusives.
 * Une technique `mixte` suit la règle des prises de vue réelles tant qu'une
 * correction éditoriale ne dit pas le contraire.
 */
export function deriverRubrique(axes: {
  technique: Technique;
  format: Format;
  origines: readonly string[];
}): Rubrique {
  if (axes.technique === "animation") {
    const pays = axes.origines[0];
    return pays && (ORIGINES_ANIME as readonly string[]).includes(pays) ? "anime" : "dessin_anime";
  }
  return axes.format === "film" || axes.format === "court" ? "film" : "serie";
}

/** Badge d'origine affiché sur une œuvre de la rubrique Anime. */
export function badgeAnime(origines: readonly string[]): BadgeAnime | null {
  const pays = origines[0];
  return (pays && BADGES[pays]) || null;
}
