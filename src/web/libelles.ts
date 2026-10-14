import { badgeAnime, type BadgeAnime } from "../domain/classification.ts";
import type { Demographie, EspaceId, Format, Rubrique } from "../domain/types.ts";

/** Libellés et adresses de l'interface. Pur : testable sans Next.js. */

export const RUBRIQUES_UI: Array<{ rubrique: Rubrique; chemin: string; libelle: string; singulier: string; accroche: string }> = [
  { rubrique: "film", chemin: "/films", libelle: "Films", singulier: "Film", accroche: "Du classique au tout récent" },
  { rubrique: "serie", chemin: "/series", libelle: "Séries", singulier: "Série", accroche: "À dévorer ou à savourer" },
  { rubrique: "anime", chemin: "/anime", libelle: "Anime", singulier: "Anime", accroche: "Japon, Chine, Corée" },
  { rubrique: "dessin_anime", chemin: "/dessins-animes", libelle: "Dessins animés", singulier: "Dessin animé", accroche: "L'animation du monde entier" },
];

export function rubriqueUI(rubrique: Rubrique) {
  return RUBRIQUES_UI.find((r) => r.rubrique === rubrique)!;
}

export const FORMATS_UI: Record<Format, string> = {
  film: "Film",
  serie: "Série",
  ova: "OVA",
  ona: "ONA",
  special: "Spécial",
  court: "Court métrage",
};

export const DEMOGRAPHIES_UI: Record<Demographie, string> = {
  kodomo: "Kodomo",
  shonen: "Shōnen",
  shojo: "Shōjo",
  seinen: "Seinen",
  josei: "Josei",
};

export const BADGES_UI: Record<BadgeAnime, string> = { japon: "Japon", donghua: "Donghua", aeni: "Aeni" };

/**
 * Concepts propres à l'interface (rubriques, badges, formats) qu'une fiche
 * Savoir peut expliquer, en plus des genres, thèmes et démographies du catalogue.
 */
export const CONCEPTS_INTERFACE = [
  "rubrique_anime",
  "rubrique_dessin_anime",
  "badge_japon",
  "badge_donghua",
  "badge_aeni",
  "format_ova",
  "format_ona",
  "format_special",
] as const;

export function conceptBadge(origines: readonly string[]): string | null {
  const badge = badgeAnime(origines);
  return badge ? `badge_${badge}` : null;
}

const NOMS_PAYS = new Intl.DisplayNames(["fr"], { type: "region" });

export function nomPays(code: string): string {
  try {
    return NOMS_PAYS.of(code) ?? code;
  } catch {
    return code;
  }
}

const NOMS_LANGUES = new Intl.DisplayNames(["fr"], { type: "language" });

export function nomLangue(code: string | null): string {
  if (!code) return "langue inconnue";
  if (code === "ja-Latn") return "japonais romanisé";
  if (code === "mul") return "plusieurs langues";
  try {
    return NOMS_LANGUES.of(code) ?? code;
  } catch {
    return code;
  }
}

export const SOURCES_UI: Record<string, { nom: string; url: string; licence: string }> = {
  anilist: { nom: "AniList", url: "https://anilist.co", licence: "données AniList" },
  wikidata: { nom: "Wikidata", url: "https://www.wikidata.org", licence: "CC0" },
  tvmaze: { nom: "TVmaze", url: "https://www.tvmaze.com", licence: "CC BY-SA" },
};

/** Lien vers la fiche d'une œuvre chez une source externe. */
export function lienExterne(espace: EspaceId, valeur: string): { nom: string; url: string } | null {
  switch (espace) {
    case "anilist":
      return { nom: "AniList", url: `https://anilist.co/anime/${valeur}` };
    case "mal":
      return { nom: "MyAnimeList", url: `https://myanimelist.net/anime/${valeur}` };
    case "wikidata":
      return { nom: "Wikidata", url: `https://www.wikidata.org/wiki/${valeur}` };
    case "tvmaze":
      return { nom: "TVmaze", url: `https://www.tvmaze.com/shows/${valeur}` };
    case "imdb":
      return { nom: "IMDb", url: `https://www.imdb.com/title/${valeur}/` };
    case "tmdb_film":
      return { nom: "TMDB", url: `https://www.themoviedb.org/movie/${valeur}` };
    case "tmdb_serie":
      return { nom: "TMDB", url: `https://www.themoviedb.org/tv/${valeur}` };
    default:
      return null;
  }
}

export const RELATIONS_UI: Record<string, string> = {
  prequelle: "Avant",
  suite: "Après",
  adaptation: "Adaptation",
  remake: "Autre version",
  derive: "Histoire dérivée",
  meme_univers: "Même univers",
};

export function formaterDuree(minutes: number | null, format: Format): string | null {
  if (!minutes) return null;
  if (format !== "film" && minutes < 90) return `${minutes} min par épisode`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h ${m.toString().padStart(2, "0")}` : `${m} min`;
}
