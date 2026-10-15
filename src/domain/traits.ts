import type { Demographie, Format, Rubrique } from "./types.ts";

/**
 * Ce qu'on sait d'une œuvre pour la recommander : ses « traits », sous forme
 * de clés lisibles (`genre:thriller`, `demo:seinen`, `credit:mappa`…).
 */
export interface Traits {
  id: string;
  titre: string;
  rubrique: Rubrique;
  format: Format;
  annee: number | null;
  /** Durée d'un film, ou d'un épisode pour une série. */
  duree_min: number | null;
  origines: string[];
  demographie: Demographie | null;
  /** Popularité 0..1 (voir `scorePopularite`). */
  score: number;
  cles: string[];
  affiche: string | null;
  couleur: string | null;
  episodes: number | null;
}

export type FamilleTrait = "genre" | "theme" | "demo" | "rubrique" | "origine" | "credit";

export function familleDe(cle: string): FamilleTrait {
  return cle.slice(0, cle.indexOf(":")) as FamilleTrait;
}

/**
 * Poids de chaque famille dans les goûts : un studio ou un réalisateur
 * partagé en dit plus long qu'une rubrique partagée.
 */
export const POIDS_FAMILLE: Record<FamilleTrait, number> = {
  genre: 1,
  theme: 0.6,
  demo: 0.7,
  credit: 1.2,
  rubrique: 0.5,
  origine: 0.4,
};

export function estFilm(format: Format): boolean {
  return format === "film" || format === "court";
}
