/**
 * Modèle du domaine (lot 0, §2 et §4). Aucune dépendance au navigateur,
 * à une base de données ou à un fournisseur de données.
 */

export type SourceId = "anilist" | "wikidata" | "tvmaze" | "tmdb" | "editorial";

/** Espaces d'identifiants externes connus. */
export type EspaceId =
  | "wikidata"
  | "anilist"
  | "mal"
  | "tvmaze"
  | "imdb"
  | "tmdb_film"
  | "tmdb_serie";

export const FORMATS = ["film", "serie", "ova", "ona", "special", "court"] as const;
export type Format = (typeof FORMATS)[number];

export const TECHNIQUES = ["prises_de_vue_reelles", "animation", "mixte"] as const;
export type Technique = (typeof TECHNIQUES)[number];

export const PUBLICS = ["enfants", "famille", "ado", "adulte"] as const;
export type Public = (typeof PUBLICS)[number];

export const DEMOGRAPHIES = ["kodomo", "shonen", "shojo", "seinen", "josei"] as const;
export type Demographie = (typeof DEMOGRAPHIES)[number];

export const RUBRIQUES = ["film", "serie", "anime", "dessin_anime"] as const;
export type Rubrique = (typeof RUBRIQUES)[number];

export type TypeTitre = "original" | "romaji" | "officiel" | "alternatif";

export const TYPES_RELATION = [
  "suite",
  "prequelle",
  "adaptation",
  "remake",
  "derive",
  "meme_univers",
] as const;
export type TypeRelation = (typeof TYPES_RELATION)[number];

export type RoleCredit = "realisation" | "creation" | "studio";

export interface Provenance {
  source: SourceId;
  /** Date ISO 8601 de récupération. */
  recupere_le: string;
}

export interface Titre {
  valeur: string;
  /** Code BCP 47 (`fr`, `en`, `ja`, `ja-Latn`…), ou null si inconnu. */
  langue: string | null;
  type: TypeTitre;
  source: SourceId;
}

export interface IdentifiantExterne {
  espace: EspaceId;
  valeur: string;
  /** 1 = lien déclaré par une source ; < 1 = rapprochement heuristique. */
  confiance: number;
}

export interface Credit {
  role: RoleCredit;
  nom: string;
  source: SourceId;
}

export interface Synopsis {
  texte: string;
  langue: string;
  source: SourceId;
}

export interface Image {
  type: "affiche" | "banniere";
  url: string;
  /** Couleur dominante annoncée par la source (#rrggbb), si fournie. */
  couleur: string | null;
  source: SourceId;
}

/** Une saison, un « cour », ou l'unique partie d'un film. */
export interface Partie {
  /** Clé de la fiche source d'origine, ex. `anilist:16498`. */
  cle: string;
  ordre: number;
  titre: string;
  format: Format;
  annee: number | null;
  episodes: number | null;
  duree_min: number | null;
  source: SourceId;
}

export interface Relation {
  de: string;
  vers: string;
  type: TypeRelation;
  source: SourceId;
}

/** Ce que l'utilisateur pense comme « une œuvre ». */
export interface Oeuvre {
  id: string;
  titre_principal: string;
  titres: Titre[];
  rubrique: Rubrique;
  format: Format;
  technique: Technique;
  /** Pays ISO 3166-1 alpha-2 ; le premier est le pays principal. */
  origines: string[];
  public: Public | null;
  demographie: Demographie | null;
  adulte: boolean;
  annee: number | null;
  duree_min: number | null;
  genres: string[];
  themes: string[];
  parties: Partie[];
  identifiants: IdentifiantExterne[];
  credits: Credit[];
  synopsis: Synopsis[];
  images: Image[];
  popularite: Partial<Record<SourceId, number>>;
  /** Source de chaque champ dérivé d'une source précise. */
  provenance: Record<string, Provenance>;
}
