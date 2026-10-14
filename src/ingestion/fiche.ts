import type {
  Credit,
  Demographie,
  Format,
  IdentifiantExterne,
  Image,
  Public,
  SourceId,
  Synopsis,
  Technique,
  Titre,
  TypeRelation,
} from "../domain/types.ts";

/**
 * Une fiche telle qu'une source la décrit, déjà traduite dans notre
 * vocabulaire mais pas encore rapprochée des fiches des autres sources.
 */
export interface FicheSource {
  source: Exclude<SourceId, "editorial" | "tmdb">;
  /** `espace:valeur` de la fiche dans sa propre source, ex. `anilist:16498`. */
  cle: string;
  identifiants: IdentifiantExterne[];
  titres: Titre[];
  format: Format | null;
  technique: Technique | null;
  origines: string[];
  public: Public | null;
  demographie: Demographie | null;
  adulte: boolean;
  annee: number | null;
  /** Date de début (AAAA-MM-JJ, éventuellement tronquée) pour ordonner les parties. */
  date_debut: string | null;
  duree_min: number | null;
  episodes: number | null;
  genres: string[];
  themes: Array<{ slug: string; libelle_en: string }>;
  credits: Credit[];
  synopsis: Synopsis[];
  images: Image[];
  popularite: number | null;
  relations: RelationSource[];
  recupere_le: string;
}

export interface RelationSource {
  type: TypeRelation;
  /** Clé de la fiche cible, ex. `anilist:20958` ou `wikidata:Q123`. */
  cible: string;
  /**
   * Vrai quand la cible est une autre saison de la même œuvre (AniList
   * découpe chaque saison en fiche séparée) : les deux fiches fusionnent
   * au lieu d'être reliées.
   */
  regrouper: boolean;
}

export function cleDe(identifiant: Pick<IdentifiantExterne, "espace" | "valeur">): string {
  return `${identifiant.espace}:${identifiant.valeur}`;
}

/** Retire les balises HTML et les entités courantes d'un synopsis. */
export function texteBrut(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
