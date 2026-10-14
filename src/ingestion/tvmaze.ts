import { genresTvmaze } from "../domain/genres.ts";
import type { Image } from "../domain/types.ts";
import { texteBrut, type FicheSource } from "./fiche.ts";
import type { ClientHttp } from "./http.ts";

/** Forme d'une série de l'index public de TVmaze (champs utilisés). */
export interface SerieTvmaze {
  id: number;
  name: string;
  type: string;
  language: string | null;
  genres: string[];
  runtime: number | null;
  averageRuntime: number | null;
  premiered: string | null;
  weight: number;
  externals: { imdb: string | null };
  image: { medium: string | null; original: string | null } | null;
  network: { country: { code: string } | null } | null;
  webChannel: { country: { code: string } | null } | null;
  summary: string | null;
}

/** Types TVmaze conservés : la fiction et le documentaire, pas la téléréalité ni les talk-shows. */
const TYPES_GARDES = new Set(["Scripted", "Animation", "Documentary"]);

const LANGUES: Record<string, string> = { English: "en", French: "fr" };
const PAYS_PAR_LANGUE: Record<string, string> = { Japanese: "JP", Chinese: "CN", Korean: "KR" };

/**
 * Parcourt l'index paginé de TVmaze (250 séries par page) et garde les
 * séries au-dessus d'un poids de popularité.
 */
export async function acquerirTvmaze(
  http: ClientHttp,
  options: { poidsMin: number; pagesMax: number },
): Promise<SerieTvmaze[]> {
  const series: SerieTvmaze[] = [];
  for (let page = 0; page < options.pagesMax; page++) {
    let lot: SerieTvmaze[];
    try {
      lot = await http.json<SerieTvmaze[]>(`https://api.tvmaze.com/shows?page=${page}`);
    } catch (erreur) {
      // TVmaze répond 404 après la dernière page.
      if (String(erreur).includes("HTTP 404")) break;
      throw erreur;
    }
    if (lot.length === 0) break;
    series.push(...lot.filter((s) => s.weight >= options.poidsMin));
  }
  return series;
}

export function normaliserTvmaze(serie: SerieTvmaze, recupere_le: string): FicheSource | null {
  if (!TYPES_GARDES.has(serie.type) || !serie.name?.trim()) return null;

  const animation = serie.type === "Animation" || serie.genres.includes("Anime");
  const pays = serie.network?.country?.code ?? serie.webChannel?.country?.code ?? null;
  const origines = pays ? [pays] : animation && serie.language ? [PAYS_PAR_LANGUE[serie.language]].filter(Boolean) : [];

  const images: Image[] = [];
  const affiche = serie.image?.original ?? serie.image?.medium;
  if (affiche) images.push({ type: "affiche", url: affiche, couleur: null, source: "tvmaze" });

  const genres = genresTvmaze(serie.genres);
  if (serie.type === "Documentary" && !genres.includes("documentaire")) genres.push("documentaire");

  return {
    source: "tvmaze",
    cle: `tvmaze:${serie.id}`,
    identifiants: [
      { espace: "tvmaze", valeur: String(serie.id), confiance: 1 },
      ...(serie.externals.imdb && /^tt\d+$/.test(serie.externals.imdb)
        ? [{ espace: "imdb" as const, valeur: serie.externals.imdb, confiance: 1 }]
        : []),
    ],
    titres: [
      {
        valeur: serie.name.trim(),
        langue: serie.language ? (LANGUES[serie.language] ?? null) : null,
        type: "officiel",
        source: "tvmaze",
      },
    ],
    format: "serie",
    technique: animation ? "animation" : "prises_de_vue_reelles",
    origines: origines.filter((o): o is string => typeof o === "string" && /^[A-Z]{2}$/.test(o)),
    public: serie.genres.includes("Children") ? "enfants" : serie.genres.includes("Adult") ? "adulte" : null,
    demographie: null,
    adulte: false,
    annee: serie.premiered ? Number(serie.premiered.slice(0, 4)) : null,
    date_debut: serie.premiered,
    duree_min: serie.averageRuntime ?? serie.runtime ?? null,
    episodes: null,
    genres,
    themes: [],
    credits: [],
    synopsis: serie.summary ? [{ texte: texteBrut(serie.summary), langue: "en", source: "tvmaze" }] : [],
    images,
    popularite: serie.weight,
    relations: [],
    recupere_le,
  };
}
