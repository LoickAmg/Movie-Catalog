import type { Db } from "../db/client.ts";
import { normaliserTitre } from "../domain/texte.ts";
import type { Demographie, EspaceId, Format, Rubrique, TypeRelation, TypeTitre } from "../domain/types.ts";

/**
 * Lecture du catalogue pour l'interface. Ne dépend que du port `Db` :
 * aucune connaissance de Next.js ni du navigateur.
 */

export interface CarteOeuvre {
  id: string;
  titre: string;
  rubrique: Rubrique;
  format: Format;
  annee: number | null;
  origines: string[];
  demographie: Demographie | null;
  affiche: string | null;
  couleur: string | null;
  genres: string[];
}

export interface PageResultats {
  total: number;
  resultats: CarteOeuvre[];
}

const COLONNES_CARTE = `
  o.id, o.titre_principal AS titre, o.rubrique, o.format, o.annee, o.origines, o.demographie,
  (SELECT i.url FROM image i WHERE i.oeuvre_id = o.id AND i.type = 'affiche' ORDER BY i.source LIMIT 1) AS affiche,
  (SELECT i.couleur FROM image i WHERE i.oeuvre_id = o.id AND i.couleur IS NOT NULL LIMIT 1) AS couleur,
  ARRAY(SELECT oc.concept_slug FROM oeuvre_concept oc JOIN concept c ON c.slug = oc.concept_slug
        WHERE oc.oeuvre_id = o.id AND c.type = 'genre' ORDER BY oc.concept_slug LIMIT 3) AS genres`;

type LigneCarte = CarteOeuvre & { total?: number };

function pageDe(lignes: LigneCarte[]): PageResultats {
  return {
    total: Number(lignes[0]?.total ?? 0),
    resultats: lignes.map(({ total: _total, ...carte }) => carte),
  };
}

export const TAILLE_PAGE = 24;

/**
 * Recherche dans tous les titres (originaux, romaji, traductions, synonymes).
 * Tous les mots doivent apparaître ; le titre exact passe avant un début de
 * titre, qui passe avant une simple présence, puis la popularité départage.
 */
export async function rechercher(
  db: Db,
  requete: { texte: string; rubrique?: Rubrique | null; page?: number; parPage?: number },
): Promise<PageResultats> {
  const phrase = normaliserTitre(requete.texte);
  const mots = phrase.split(" ").filter(Boolean);
  if (mots.length === 0) return { total: 0, resultats: [] };
  const parPage = requete.parPage ?? TAILLE_PAGE;
  const page = Math.max(1, requete.page ?? 1);
  const { rows } = await db.query<LigneCarte>(
    `WITH correspondances AS (
       SELECT t.oeuvre_id,
              MIN(CASE WHEN t.normalise = $1 THEN 0
                       WHEN t.normalise LIKE $1 || '%' THEN 1
                       WHEN t.normalise LIKE '% ' || $1 || '%' THEN 2
                       ELSE 3 END) AS rang
       FROM titre t
       WHERE NOT EXISTS (SELECT 1 FROM unnest($2::text[]) AS m(mot) WHERE position(m.mot IN t.normalise) = 0)
       GROUP BY t.oeuvre_id
     )
     SELECT ${COLONNES_CARTE}, count(*) OVER () AS total
     FROM correspondances c JOIN oeuvre o ON o.id = c.oeuvre_id
     WHERE ($3::text IS NULL OR o.rubrique = $3)
     ORDER BY c.rang, o.score DESC, o.id
     LIMIT $4 OFFSET $5`,
    [phrase, mots, requete.rubrique ?? null, parPage, (page - 1) * parPage],
  );
  // Au-delà de la dernière page, la requête ne renvoie aucune ligne, donc aucun total.
  if (rows.length === 0 && page > 1) return { total: (await rechercher(db, { ...requete, page: 1, parPage: 1 })).total, resultats: [] };
  return pageDe(rows);
}

export type Tri = "populaire" | "recent" | "ancien" | "titre";

export interface FiltresRubrique {
  rubrique: Rubrique;
  genre?: string | null;
  /** Première année de la décennie, ex. 1990. */
  decennie?: number | null;
  origine?: string | null;
  tri?: Tri;
  page?: number;
  parPage?: number;
}

const ORDRES: Record<Tri, string> = {
  populaire: "o.score DESC, o.id",
  recent: "o.annee DESC NULLS LAST, o.score DESC, o.id",
  ancien: "o.annee ASC NULLS LAST, o.score DESC, o.id",
  titre: "o.titre_principal COLLATE \"C\", o.id",
};

export async function listerRubrique(db: Db, filtres: FiltresRubrique): Promise<PageResultats> {
  const parPage = filtres.parPage ?? TAILLE_PAGE;
  const page = Math.max(1, filtres.page ?? 1);
  const { rows } = await db.query<LigneCarte>(
    `SELECT ${COLONNES_CARTE}, count(*) OVER () AS total
     FROM oeuvre o
     WHERE o.rubrique = $1
       AND ($2::text IS NULL OR EXISTS (SELECT 1 FROM oeuvre_concept oc WHERE oc.oeuvre_id = o.id AND oc.concept_slug = $2))
       AND ($3::int IS NULL OR (o.annee >= $3 AND o.annee < $3 + 10))
       AND ($4::text IS NULL OR o.origines[1] = $4)
     ORDER BY ${ORDRES[filtres.tri ?? "populaire"]}
     LIMIT $5 OFFSET $6`,
    [filtres.rubrique, filtres.genre ?? null, filtres.decennie ?? null, filtres.origine ?? null, parPage, (page - 1) * parPage],
  );
  if (rows.length === 0 && page > 1) return { total: (await listerRubrique(db, { ...filtres, page: 1, parPage: 1 })).total, resultats: [] };
  return pageDe(rows);
}

export async function populaires(db: Db, rubrique: Rubrique, nombre: number): Promise<CarteOeuvre[]> {
  return (await listerRubrique(db, { rubrique, parPage: nombre })).resultats;
}

/** Genres présents dans une rubrique, avec leur nombre d'œuvres, pour les filtres. */
export async function genresDeRubrique(
  db: Db,
  rubrique: Rubrique,
): Promise<Array<{ slug: string; libelle: string; nombre: number }>> {
  const { rows } = await db.query<{ slug: string; libelle: string; nombre: number }>(
    `SELECT c.slug, c.libelle_fr AS libelle, count(*)::int AS nombre
     FROM oeuvre_concept oc JOIN concept c ON c.slug = oc.concept_slug JOIN oeuvre o ON o.id = oc.oeuvre_id
     WHERE c.type = 'genre' AND o.rubrique = $1
     GROUP BY c.slug, c.libelle_fr ORDER BY c.libelle_fr`,
    [rubrique],
  );
  return rows;
}

/** Pays principaux d'une rubrique, du plus fréquent au moins fréquent. */
export async function originesDeRubrique(db: Db, rubrique: Rubrique): Promise<Array<{ pays: string; nombre: number }>> {
  const { rows } = await db.query<{ pays: string; nombre: number }>(
    `SELECT o.origines[1] AS pays, count(*)::int AS nombre FROM oeuvre o
     WHERE o.rubrique = $1 AND cardinality(o.origines) > 0
     GROUP BY 1 ORDER BY 2 DESC LIMIT 30`,
    [rubrique],
  );
  return rows;
}

export interface OeuvreDetaillee extends CarteOeuvre {
  technique: string;
  duree_min: number | null;
  titres: Array<{ valeur: string; langue: string | null; type: TypeTitre }>;
  parties: Array<{ cle: string; ordre: number; titre: string; format: Format; annee: number | null; episodes: number | null }>;
  credits: Array<{ role: string; nom: string }>;
  concepts: Array<{ slug: string; type: "genre" | "theme" | "demographie"; libelle: string | null }>;
  synopsis: Array<{ texte: string; langue: string; source: string }>;
  banniere: string | null;
  relations: Array<{ type: TypeRelation; oeuvre: CarteOeuvre }>;
  identifiants: Array<{ espace: EspaceId; valeur: string }>;
  provenance: Record<string, { source: string; recupere_le: string }>;
}

export async function oeuvreDetaillee(db: Db, id: string): Promise<OeuvreDetaillee | null> {
  const { rows } = await db.query<CarteOeuvre & { technique: string; duree_min: number | null; provenance: OeuvreDetaillee["provenance"] }>(
    `SELECT ${COLONNES_CARTE}, o.technique, o.duree_min, o.provenance FROM oeuvre o WHERE o.id = $1`,
    [id],
  );
  const base = rows[0];
  if (!base) return null;

  const [titres, parties, credits, concepts, synopsis, banniere, relations, identifiants] = await Promise.all([
    db.query<OeuvreDetaillee["titres"][number]>(
      `SELECT valeur, langue, type FROM titre WHERE oeuvre_id = $1
       ORDER BY CASE type WHEN 'officiel' THEN 0 WHEN 'original' THEN 1 WHEN 'romaji' THEN 2 ELSE 3 END, langue NULLS LAST`,
      [id],
    ),
    db.query<OeuvreDetaillee["parties"][number]>(
      "SELECT cle, ordre, titre, format, annee, episodes FROM partie WHERE oeuvre_id = $1 ORDER BY ordre",
      [id],
    ),
    db.query<OeuvreDetaillee["credits"][number]>("SELECT role, nom FROM credit WHERE oeuvre_id = $1 ORDER BY ordre", [id]),
    db.query<OeuvreDetaillee["concepts"][number]>(
      `SELECT c.slug, c.type, COALESCE(c.libelle_fr, c.libelle_en) AS libelle
       FROM oeuvre_concept oc JOIN concept c ON c.slug = oc.concept_slug WHERE oc.oeuvre_id = $1
       ORDER BY CASE c.type WHEN 'demographie' THEN 0 WHEN 'genre' THEN 1 ELSE 2 END, c.slug`,
      [id],
    ),
    db.query<OeuvreDetaillee["synopsis"][number]>(
      "SELECT texte, langue, source FROM synopsis WHERE oeuvre_id = $1 ORDER BY CASE langue WHEN 'fr' THEN 0 ELSE 1 END, source",
      [id],
    ),
    db.query<{ url: string }>("SELECT url FROM image WHERE oeuvre_id = $1 AND type = 'banniere' LIMIT 1", [id]),
    db.query<CarteOeuvre & { type_relation: TypeRelation }>(
      `SELECT r.type AS type_relation, ${COLONNES_CARTE}
       FROM relation r JOIN oeuvre o ON o.id = r.vers WHERE r.de = $1
       ORDER BY CASE r.type WHEN 'prequelle' THEN 0 WHEN 'suite' THEN 1 ELSE 2 END, o.annee`,
      [id],
    ),
    db.query<{ espace: EspaceId; valeur: string }>(
      "SELECT espace, valeur FROM identifiant_externe WHERE oeuvre_id = $1 ORDER BY espace, valeur",
      [id],
    ),
  ]);

  return {
    ...base,
    titres: titres.rows,
    parties: parties.rows,
    credits: credits.rows,
    concepts: concepts.rows,
    synopsis: synopsis.rows,
    banniere: banniere.rows[0]?.url ?? null,
    relations: relations.rows.map(({ type_relation, ...oeuvre }) => ({ type: type_relation, oeuvre })),
    identifiants: identifiants.rows,
  };
}

/** Œuvres désignées par des clés externes (`anilist:16498`, `wikidata:Q155653`), dans l'ordre donné. */
export async function oeuvresParCles(db: Db, cles: readonly string[]): Promise<CarteOeuvre[]> {
  if (cles.length === 0) return [];
  const { rows } = await db.query<CarteOeuvre & { cle: string }>(
    `SELECT DISTINCT ON (ie.espace || ':' || ie.valeur) ie.espace || ':' || ie.valeur AS cle, ${COLONNES_CARTE}
     FROM identifiant_externe ie JOIN oeuvre o ON o.id = ie.oeuvre_id
     WHERE ie.espace || ':' || ie.valeur = ANY($1::text[])`,
    [cles],
  );
  const parCle = new Map(rows.map(({ cle, ...carte }) => [cle, carte]));
  return cles.map((c) => parCle.get(c)).filter((c): c is CarteOeuvre => Boolean(c));
}

export async function statistiques(db: Db): Promise<Record<Rubrique, number>> {
  const { rows } = await db.query<{ rubrique: Rubrique; n: number }>(
    "SELECT rubrique, count(*)::int AS n FROM oeuvre GROUP BY rubrique",
  );
  const stats = { film: 0, serie: 0, anime: 0, dessin_anime: 0 };
  for (const r of rows) stats[r.rubrique] = r.n;
  return stats;
}
