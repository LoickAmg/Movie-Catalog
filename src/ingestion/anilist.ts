import { genresAnilist } from "../domain/genres.ts";
import { slugifier } from "../domain/texte.ts";
import type { Demographie, Format, Image, Titre, TypeRelation } from "../domain/types.ts";
import { texteBrut, type FicheSource, type RelationSource } from "./fiche.ts";
import type { ClientHttp } from "./http.ts";

/** Forme d'un média renvoyé par l'API GraphQL d'AniList (champs utilisés). */
export interface MediaAnilist {
  id: number;
  idMal: number | null;
  title: { romaji: string | null; english: string | null; native: string | null };
  synonyms: string[];
  format: string | null;
  episodes: number | null;
  duration: number | null;
  countryOfOrigin: string | null;
  isAdult: boolean;
  startDate: { year: number | null; month: number | null; day: number | null };
  genres: string[];
  tags: Array<{ name: string; rank: number; category: string; isMediaSpoiler: boolean }>;
  studios: { nodes: Array<{ id: number; name: string; isAnimationStudio: boolean }> };
  relations: { edges: Array<{ relationType: string; node: { id: number; type: string; format: string | null } }> };
  popularity: number | null;
  coverImage: { large: string | null; color: string | null } | null;
  bannerImage: string | null;
  description: string | null;
}

const REQUETE = `query ($page: Int, $parPage: Int, $pays: CountryCode) {
  Page(page: $page, perPage: $parPage) {
    pageInfo { hasNextPage }
    media(type: ANIME, isAdult: false, format_not: MUSIC, sort: POPULARITY_DESC, countryOfOrigin: $pays) {
      id idMal title { romaji english native } synonyms format episodes duration
      countryOfOrigin isAdult startDate { year month day } genres
      tags { name rank category isMediaSpoiler }
      studios(isMain: true) { nodes { id name isAnimationStudio } }
      relations { edges { relationType node { id type format } } }
      popularity coverImage { large color } bannerImage description(asHtml: false)
    }
  }
}`;

const PAR_PAGE = 50;

/**
 * Les médias les plus populaires d'AniList, hors contenu adulte et clips
 * musicaux ; `pays` restreint à une origine (CN, KR…), sinon toutes.
 */
export async function acquerirAnilist(http: ClientHttp, maximum: number, pays: string | null = null): Promise<MediaAnilist[]> {
  const medias: MediaAnilist[] = [];
  for (let page = 1; medias.length < maximum; page++) {
    const reponse = await http.json<{
      data?: { Page: { pageInfo: { hasNextPage: boolean }; media: MediaAnilist[] } };
      errors?: unknown;
    }>("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: REQUETE, variables: { page, parPage: PAR_PAGE, ...(pays ? { pays } : {}) } }),
    });
    if (!reponse.data) throw new Error(`AniList : ${JSON.stringify(reponse.errors)}`);
    medias.push(...reponse.data.Page.media);
    if (!reponse.data.Page.pageInfo.hasNextPage) break;
  }
  return medias.slice(0, maximum);
}

const FORMATS: Record<string, Format> = {
  TV: "serie",
  TV_SHORT: "serie",
  MOVIE: "film",
  OVA: "ova",
  ONA: "ona",
  SPECIAL: "special",
};

/** Formats « à épisodes » : une suite directe entre deux d'entre eux est une nouvelle saison. */
const FORMATS_SERIELS = new Set(["TV", "TV_SHORT", "ONA"]);

const RELATIONS: Record<string, TypeRelation> = {
  SEQUEL: "suite",
  PREQUEL: "prequelle",
  SIDE_STORY: "derive",
  SPIN_OFF: "derive",
  COMPILATION: "derive",
  ALTERNATIVE: "remake",
  PARENT: "meme_univers",
  CHARACTER: "meme_univers",
};

const DEMOGRAPHIES: Record<string, Demographie> = {
  Kids: "kodomo",
  Shounen: "shonen",
  Shoujo: "shojo",
  Seinen: "seinen",
  Josei: "josei",
};

const LANGUE_NATIVE: Record<string, string> = { JP: "ja", CN: "zh", KR: "ko", TW: "zh-Hant" };

/** Rang minimal (0-100) pour qu'un tag AniList devienne un thème. */
const RANG_THEME_MIN = 60;

export function normaliserAnilist(media: MediaAnilist, recupere_le: string): FicheSource | null {
  const format = media.format ? FORMATS[media.format] : undefined;
  if (!format || media.isAdult) return null;

  const pays = media.countryOfOrigin ?? null;
  const titres: Titre[] = [];
  const ajouter = (valeur: string | null, langue: string | null, type: Titre["type"]) => {
    if (valeur?.trim()) titres.push({ valeur: valeur.trim(), langue, type, source: "anilist" });
  };
  ajouter(media.title.native, pays ? (LANGUE_NATIVE[pays] ?? null) : null, "original");
  ajouter(media.title.romaji, pays === "JP" ? "ja-Latn" : null, "romaji");
  ajouter(media.title.english, "en", "officiel");
  for (const synonyme of media.synonyms) ajouter(synonyme, null, "alternatif");

  const demographie =
    media.tags.map((t) => (t.category === "Demographic" ? DEMOGRAPHIES[t.name] : undefined)).find(Boolean) ?? null;

  const themes = media.tags
    .filter((t) => t.category !== "Demographic" && !t.isMediaSpoiler && t.rank >= RANG_THEME_MIN)
    .map((t) => ({ slug: slugifier(t.name), libelle_en: t.name }));

  const relations: RelationSource[] = [];
  for (const arete of media.relations.edges) {
    const type = RELATIONS[arete.relationType];
    if (!type || arete.node.type !== "ANIME") continue;
    const memeOeuvre =
      (arete.relationType === "SEQUEL" || arete.relationType === "PREQUEL") &&
      FORMATS_SERIELS.has(media.format ?? "") &&
      FORMATS_SERIELS.has(arete.node.format ?? "");
    relations.push({ type, cible: `anilist:${arete.node.id}`, regrouper: memeOeuvre });
  }

  const images: Image[] = [];
  if (media.coverImage?.large) {
    images.push({ type: "affiche", url: media.coverImage.large, couleur: media.coverImage.color, source: "anilist" });
  }
  if (media.bannerImage) {
    images.push({ type: "banniere", url: media.bannerImage, couleur: null, source: "anilist" });
  }

  const { year, month, day } = media.startDate;
  const date_debut = year
    ? [year, month, day]
        .filter((v): v is number => v !== null)
        .map((v, i) => (i === 0 ? String(v) : String(v).padStart(2, "0")))
        .join("-")
    : null;

  return {
    source: "anilist",
    cle: `anilist:${media.id}`,
    identifiants: [
      { espace: "anilist", valeur: String(media.id), confiance: 1 },
      ...(media.idMal ? [{ espace: "mal" as const, valeur: String(media.idMal), confiance: 1 }] : []),
    ],
    titres,
    format,
    technique: "animation",
    origines: pays && /^[A-Z]{2}$/.test(pays) ? [pays] : [],
    public: null,
    demographie,
    adulte: false,
    annee: year,
    date_debut,
    duree_min: media.duration && media.duration > 0 ? media.duration : null,
    episodes: media.episodes,
    genres: genresAnilist(media.genres),
    themes,
    credits: media.studios.nodes
      .filter((s) => s.isAnimationStudio)
      .map((s) => ({ role: "studio" as const, nom: s.name, source: "anilist" as const })),
    synopsis: media.description ? [{ texte: texteBrut(media.description), langue: "en", source: "anilist" }] : [],
    images,
    popularite: media.popularity,
    relations,
    recupere_le,
  };
}
